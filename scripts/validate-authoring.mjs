#!/usr/bin/env node
/**
 * validate-authoring.mjs — authoring-contract validator for content/modules/*
 *
 * Design: docs/authoring-platform.md (issue #520). Read-only: touches no HubSpot,
 * AWS, or DynamoDB state, and is not wired into sync or CI.
 *
 *   node scripts/validate-authoring.mjs                      # all of content/modules
 *   node scripts/validate-authoring.mjs --modules-dir DIR    # another tree (e.g. the worked example)
 *   node scripts/validate-authoring.mjs --module SLUG        # one module
 *   node scripts/validate-authoring.mjs --strict             # warnings fail the run
 *   node scripts/validate-authoring.mjs --allow-unavailable  # accept interactive classes not yet deployable
 *   node scripts/validate-authoring.mjs --json               # machine-readable output
 *
 * Exit code 1 if any error (or any warning under --strict).
 * The checks run in two layers:
 *   - legacy layer: applies to every module today (task_type enum, quiz_ref integrity, ...)
 *   - v1 layer: applies only to keys the design adds (kind/credit, milestones,
 *     interactives, prerequisites). Absent keys are never an error, so the 20
 *     shipped modules are judged only by the legacy layer.
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Closed vocabularies — the single place the enums live. Keep in sync with
// the Lambdas (see docs/authoring-platform.md §7 "Where the enum must also change").
// ---------------------------------------------------------------------------

export const LEGACY_TASK_TYPES = ['quiz', 'lab_attestation', 'knowledge_check'];
export const NEW_TASK_TYPES = ['interactive_check'];
export const TASK_TYPES = [...LEGACY_TASK_TYPES, ...NEW_TASK_TYPES];

export const CREDIT_KINDS = ['read', 'practice', 'lab', 'assessment', 'transfer'];
/** Kinds that are evidence of understanding rather than exposure. */
export const EVIDENCE_KINDS = ['lab', 'assessment', 'transfer'];

/** Legacy task_type -> default credit kind. */
export const DEFAULT_KIND = {
  quiz: 'assessment',
  lab_attestation: 'lab',
  knowledge_check: 'practice',
  interactive_check: 'assessment',
};

/**
 * Interactive primitive catalogue. `klass` is the #502 exercise class,
 * `available` is whether it can run on infrastructure that exists today.
 * Flip `available` only when the capability ships (C3/C4 depend on #497).
 */
export const INTERACTIVE_TYPES = {
  snapshot: { klass: 'C0', available: true, label_field: 'as_of', needs: ['src', 'as_of', 'caption'] },
  replay: { klass: 'C0', available: true, label_field: 'recorded_at', needs: ['src', 'recorded_at', 'caption'] },
  explorer: { klass: 'C1', available: true, label_field: 'fixture_captured_at', needs: ['fixture', 'fixture_captured_at', 'caption'] },
  predict: { klass: 'C0', available: true, label_field: 'fixture_captured_at', needs: ['fixture', 'fixture_captured_at', 'prompt'] },
  shell: { klass: 'C2', available: false, needs: ['image', 'ttl_minutes'] },
  'lab-server': { klass: 'C3', available: false, needs: ['servers', 'fabric_write', 'max_minutes'] },
  'lab-pair': { klass: 'C4', available: false, needs: ['servers', 'fabric_write', 'max_minutes'] },
};

/** Evidence-source labels the UI renders. `live` is only valid for classes that have a broker. */
export const SOURCE_LABELS = ['recorded', 'cached', 'simulated', 'live'];
export const EVIDENCE_PLANES = ['control-plane', 'data-plane', 'none'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_FRONTMATTER = ['title', 'slug', 'difficulty', 'estimated_minutes', 'version', 'description', 'order'];
const MARKER_RE = /<!--\s*hh:interactive\s+id="([^"]+)"\s*-->/g;

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Evaluate a milestone rule against a map task_slug -> {kind, credit, earned}. */
export function evalRule(rule, tasks) {
  if (!rule || typeof rule !== 'object') return false;
  if (Array.isArray(rule.tasks)) {
    return rule.tasks.every((s) => tasks[s]?.earned === true);
  }
  if (typeof rule.points === 'number') {
    const eligible = Object.values(tasks).filter(
      (t) => t.earned && (!rule.kinds || rule.kinds.includes(t.kind))
    );
    const total = eligible.reduce((n, t) => n + t.credit, 0);
    if (total < rule.points) return false;
    for (const [kind, floor] of Object.entries(rule.min_by_kind || {})) {
      const got = Object.values(tasks)
        .filter((t) => t.earned && t.kind === kind)
        .reduce((n, t) => n + t.credit, 0);
      if (got < floor) return false;
    }
    return true;
  }
  if (Array.isArray(rule.any)) return rule.any.some((r) => evalRule(r, tasks));
  if (Array.isArray(rule.all)) return rule.all.every((r) => evalRule(r, tasks));
  return false;
}

/** Collect every task slug a rule mentions by name. */
export function ruleTaskRefs(rule, out = new Set()) {
  if (!rule || typeof rule !== 'object') return out;
  if (Array.isArray(rule.tasks)) rule.tasks.forEach((s) => out.add(s));
  for (const key of ['any', 'all']) {
    if (Array.isArray(rule[key])) rule[key].forEach((r) => ruleTaskRefs(r, out));
  }
  return out;
}

/** True if a rule mentions points/kinds (so it implicitly references tasks by kind). */
function ruleUsesPoints(rule) {
  if (!rule || typeof rule !== 'object') return false;
  if (typeof rule.points === 'number') return true;
  return ['any', 'all'].some((k) => Array.isArray(rule[k]) && rule[k].some(ruleUsesPoints));
}

function ruleShapeError(rule, path = 'rule') {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return `${path} must be an object`;
  const forms = ['tasks', 'points', 'any', 'all'].filter((k) => k in rule);
  if (forms.length !== 1) return `${path} must have exactly one of tasks | points | any | all (found ${forms.length ? forms.join(', ') : 'none'})`;
  if (forms[0] === 'tasks' && (!Array.isArray(rule.tasks) || rule.tasks.length === 0)) return `${path}.tasks must be a non-empty array`;
  if (forms[0] === 'points') {
    if (!(typeof rule.points === 'number' && rule.points > 0)) return `${path}.points must be a positive number`;
    for (const k of rule.kinds || []) if (!CREDIT_KINDS.includes(k)) return `${path}.kinds contains unknown kind "${k}"`;
    for (const k of Object.keys(rule.min_by_kind || {})) if (!CREDIT_KINDS.includes(k)) return `${path}.min_by_kind has unknown kind "${k}"`;
  }
  for (const k of ['any', 'all']) {
    if (k in rule) {
      if (!Array.isArray(rule[k]) || rule[k].length === 0) return `${path}.${k} must be a non-empty array`;
      for (let i = 0; i < rule[k].length; i++) {
        const e = ruleShapeError(rule[k][i], `${path}.${k}[${i}]`);
        if (e) return e;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Module validation
// ---------------------------------------------------------------------------

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf-8'));
}

/**
 * Validate one module directory. Returns [{level:'error'|'warn', code, message}].
 * `allSlugs`/`milestoneIndex` support cross-module prerequisite checks.
 */
export async function validateModule(dir, opts = {}) {
  const { allowUnavailable = false, moduleIndex = null } = opts;
  const dirName = dir.split('/').pop();
  const issues = [];
  const err = (code, message) => issues.push({ level: 'error', code, message });
  const warn = (code, message) => issues.push({ level: 'warn', code, message });

  // --- README frontmatter -------------------------------------------------
  let body = '';
  let fm = {};
  try {
    const parsed = matter(await readFile(join(dir, 'README.md'), 'utf-8'));
    fm = parsed.data;
    body = parsed.content;
  } catch {
    err('README_MISSING', 'README.md missing or unreadable');
    return issues;
  }
  for (const k of REQUIRED_FRONTMATTER) {
    if (fm[k] === undefined || fm[k] === '') err('FRONTMATTER_MISSING', `frontmatter "${k}" is required`);
  }
  if (fm.slug && fm.slug !== dirName) err('SLUG_MISMATCH', `frontmatter slug "${fm.slug}" != directory "${dirName}"`);
  if (fm.slug && !SLUG_RE.test(fm.slug)) err('SLUG_FORMAT', `slug "${fm.slug}" is not kebab-case`);

  // --- completion.json (legacy layer) --------------------------------------
  const completionPath = join(dir, 'completion.json');
  let completion = null;
  if (await exists(completionPath)) {
    try { completion = await readJson(completionPath); }
    catch (e) { err('COMPLETION_JSON', `completion.json is not valid JSON: ${e.message}`); }
  } else {
    warn('COMPLETION_ABSENT', 'no completion.json: module has no tasks and cannot award a certificate');
  }

  // --- quiz.json ------------------------------------------------------------
  let quiz = null;
  const quizPath = join(dir, 'quiz.json');
  if (await exists(quizPath)) {
    try { quiz = await readJson(quizPath); }
    catch (e) { err('QUIZ_JSON', `quiz.json is not valid JSON: ${e.message}`); }
  }
  if (quiz) validateQuestions(quiz, 'quiz.json', err, warn, { moduleSlug: dirName });

  const tasks = new Map(); // slug -> {kind, credit, type, required}
  if (completion) {
    const list = completion.completion_tasks;
    if (!Array.isArray(list)) {
      err('COMPLETION_SHAPE', 'completion_tasks must be an array');
    } else {
      for (const t of list) {
        const where = `task "${t?.task_slug}"`;
        if (!t || typeof t.task_slug !== 'string' || !SLUG_RE.test(t.task_slug)) {
          err('TASK_SLUG', `${where}: task_slug missing or not kebab-case`);
          continue;
        }
        if (tasks.has(t.task_slug)) { err('TASK_DUPLICATE', `${where}: duplicate task_slug`); continue; }

        if (!TASK_TYPES.includes(t.task_type)) {
          err('TASK_TYPE_UNKNOWN', `${where}: task_type "${t.task_type}" is not one of ${TASK_TYPES.join(', ')}`);
        }
        if (typeof t.required !== 'boolean') err('TASK_REQUIRED', `${where}: required must be boolean`);
        if (typeof t.graded !== 'boolean') err('TASK_GRADED', `${where}: graded must be boolean`);
        if (typeof t.label !== 'string' || !t.label.trim()) warn('TASK_LABEL', `${where}: label missing`);

        // Behavioural facts from tasks-quiz-submit.ts computeModuleStatus / shadow-aggregation.ts
        if (t.task_type === 'knowledge_check' && t.required === true) {
          err('KNOWLEDGE_CHECK_REQUIRED', `${where}: knowledge_check never satisfies computeModuleStatus; required:true would make the module uncompletable`);
        }
        if (t.task_type === 'quiz' && t.graded !== true) warn('QUIZ_UNGRADED', `${where}: quiz task has graded:false`);
        if (t.task_type === 'lab_attestation' && t.graded === true) warn('LAB_GRADED', `${where}: lab_attestation is self-attested; graded:true is misleading`);

        if (t.task_type === 'quiz') {
          if (!quiz) {
            err('QUIZ_FILE_MISSING', `${where}: quiz task but no quiz.json`);
          } else {
            if (t.quiz_ref && t.quiz_ref !== quiz.quiz_id) err('QUIZ_REF', `${where}: quiz_ref "${t.quiz_ref}" != quiz.json quiz_id "${quiz.quiz_id}"`);
            if (!t.quiz_ref) warn('QUIZ_REF_ABSENT', `${where}: quiz_ref missing`);
            if (t.passing_score !== undefined && quiz.passing_score !== undefined && t.passing_score !== quiz.passing_score) {
              err('PASSING_SCORE_DRIFT', `${where}: passing_score ${t.passing_score} != quiz.json passing_score ${quiz.passing_score}`);
            }
          }
        }

        // v1 layer: kind/credit (optional)
        let kind = t.kind;
        if (kind !== undefined && !CREDIT_KINDS.includes(kind)) {
          err('KIND_UNKNOWN', `${where}: kind "${kind}" is not one of ${CREDIT_KINDS.join(', ')}`);
          kind = undefined;
        }
        kind = kind ?? DEFAULT_KIND[t.task_type] ?? 'practice';
        let credit = t.credit;
        if (credit !== undefined && !(typeof credit === 'number' && credit > 0)) {
          err('CREDIT_VALUE', `${where}: credit must be a positive number`);
          credit = undefined;
        }
        if (t.grading !== undefined) {
          if (!['server', 'client'].includes(t.grading)) err('GRADING_VALUE', `${where}: grading must be "server" or "client"`);
          else if (t.grading === 'client' && t.task_type !== 'interactive_check') err('GRADING_CLIENT_TYPE', `${where}: grading "client" (Observed tier) is only allowed on interactive_check`);
        }
        if (t.task_type === 'interactive_check') {
          if (!t.interactive_ref) err('INTERACTIVE_REF_MISSING', `${where}: interactive_check requires interactive_ref`);
          if (t.required === true) warn('NEW_TASK_REQUIRED', `${where}: a required interactive_check changes who is "complete"; for modules already live keep it required:false`);
        }
        tasks.set(t.task_slug, { kind, credit: credit ?? 1, type: t.task_type, required: t.required === true, raw: t });
      }
      if (completion.awards_certificate === true && ![...tasks.values()].some((t) => t.required)) {
        warn('CERT_NO_REQUIRED', 'awards_certificate is true but no task is required — completion is vacuous');
      }
    }
    if (typeof completion.awards_certificate !== 'boolean') err('AWARDS_CERT', 'awards_certificate must be boolean');

    const known = new Set(['completion_tasks', 'awards_certificate', 'milestones', 'prerequisites']);
    for (const k of Object.keys(completion)) {
      if (!known.has(k)) warn('UNKNOWN_KEY', `completion.json: unknown top-level key "${k}" (sync ignores it)`);
    }
  }

  // --- interactives.json (v1 layer) ----------------------------------------
  const interactivePath = join(dir, 'interactives.json');
  let interactives = null;
  if (await exists(interactivePath)) {
    try { interactives = await readJson(interactivePath); }
    catch (e) { err('INTERACTIVES_JSON', `interactives.json is not valid JSON: ${e.message}`); }
  }
  const markerIds = [...body.matchAll(MARKER_RE)].map((m) => m[1]);
  const declared = new Map();
  if (interactives) {
    if (!Array.isArray(interactives.interactives)) {
      err('INTERACTIVES_SHAPE', 'interactives.json: "interactives" must be an array');
    } else {
      for (const it of interactives.interactives) {
        const where = `interactive "${it?.id}"`;
        if (!it || typeof it.id !== 'string' || !SLUG_RE.test(it.id)) { err('INTERACTIVE_ID', `${where}: id missing or not kebab-case`); continue; }
        if (declared.has(it.id)) { err('INTERACTIVE_DUPLICATE', `${where}: duplicate id`); continue; }
        declared.set(it.id, it);
        const spec = INTERACTIVE_TYPES[it.type];
        if (!spec) { err('INTERACTIVE_TYPE', `${where}: type "${it.type}" is not one of ${Object.keys(INTERACTIVE_TYPES).join(', ')}`); continue; }
        if (!spec.available && !allowUnavailable) {
          err('CLASS_UNAVAILABLE', `${where}: ${it.type} is class ${spec.klass}, which needs infrastructure not yet deployed (#497). Use --allow-unavailable to design ahead.`);
        }
        for (const field of spec.needs) {
          if (it[field] === undefined || it[field] === '') err('INTERACTIVE_FIELD', `${where}: ${it.type} requires "${field}"`);
        }
        // Honesty label: mandatory and must agree with the type.
        if (!SOURCE_LABELS.includes(it.source_label)) {
          err('HONESTY_LABEL', `${where}: source_label must be one of ${SOURCE_LABELS.join(', ')}`);
        } else {
          if (it.source_label === 'live' && !spec.available) { /* design-ahead only; allowed with flag */ }
          if (it.source_label === 'live' && spec.available) err('HONESTY_LIVE', `${where}: ${it.type} has no live backend today; it cannot be labelled "live"`);
          if (it.type === 'replay' && it.source_label !== 'recorded') err('HONESTY_MISMATCH', `${where}: replay must be labelled "recorded"`);
          if (it.type === 'snapshot' && it.source_label !== 'cached') err('HONESTY_MISMATCH', `${where}: snapshot must be labelled "cached"`);
          if ((it.type === 'explorer' || it.type === 'predict') && it.source_label !== 'simulated') err('HONESTY_MISMATCH', `${where}: ${it.type} runs on a fixture and must be labelled "simulated"`);
        }
        if (!EVIDENCE_PLANES.includes(it.evidence_plane)) {
          err('EVIDENCE_PLANE', `${where}: evidence_plane must be one of ${EVIDENCE_PLANES.join(', ')} (control-plane evidence is not data-plane evidence)`);
        }
        if (it.claims_data_plane === true && it.evidence_plane !== 'data-plane') {
          err('PLANE_OVERCLAIM', `${where}: claims data-plane behaviour but evidence_plane is "${it.evidence_plane}"`);
        }
        const text = JSON.stringify(it).toLowerCase();
        if (/\b(gpu|rdma|line[- ]?rate)\b/.test(text) && it.disclosure_ack !== true) {
          err('HONESTY_CLAIM', `${where}: mentions GPU/RDMA/line-rate; set disclosure_ack:true only after confirming no performance claim is made (#492)`);
        }
        for (const f of ['src', 'fixture']) {
          if (typeof it[f] === 'string' && !it[f].startsWith('http')) {
            if (!(await exists(join(dir, it[f])))) err('ASSET_MISSING', `${where}: ${f} "${it[f]}" not found`);
          }
        }
        if (it.check) {
          validateQuestions(it.check, `interactive "${it.id}".check`, err, warn, { requireModule: false });
        }
      }
    }
    for (const t of tasks.values()) {
      if (t.type === 'interactive_check') {
        const ref = t.raw.interactive_ref;
        const target = declared.get(ref);
        if (ref && !target) err('INTERACTIVE_REF', `task "${t.raw.task_slug}": interactive_ref "${ref}" not declared in interactives.json`);
        else if (target && !target.check) err('CHECK_MISSING', `task "${t.raw.task_slug}": interactive "${ref}" has no "check" (no server-held answer key to grade)`);
      }
    }
  } else {
    for (const t of tasks.values()) {
      if (t.type === 'interactive_check') err('INTERACTIVES_FILE_MISSING', `task "${t.raw.task_slug}": interactive_check but no interactives.json`);
    }
  }
  // Marker <-> declaration agreement, both directions.
  for (const id of markerIds) {
    if (!declared.has(id)) err('MARKER_UNDECLARED', `README marker hh:interactive id="${id}" has no entry in interactives.json`);
  }
  for (const id of declared.keys()) {
    if (!markerIds.includes(id)) warn('INTERACTIVE_UNPLACED', `interactive "${id}" is declared but never placed in README.md`);
  }
  if (new Set(markerIds).size !== markerIds.length) err('MARKER_DUPLICATE', 'README places the same interactive id more than once');

  // Interactives that nothing consumes: exposure only, which the design does not credit.
  if (interactives) {
    const consumed = new Set([...tasks.values()].filter((t) => t.type === 'interactive_check').map((t) => t.raw.interactive_ref));
    for (const id of declared.keys()) {
      if (!consumed.has(id)) warn('INTERACTIVE_NO_CREDIT', `interactive "${id}" has no interactive_check task — it teaches but earns nothing (this is allowed; viewing is deliberately not credited)`);
    }
  }

  // --- milestones: reference integrity + credit arithmetic -----------------
  const milestones = completion?.milestones;
  if (milestones !== undefined) {
    if (!Array.isArray(milestones)) {
      err('MILESTONES_SHAPE', 'milestones must be an array');
    } else {
      const ids = new Set();
      const legacyRequired = [...tasks.entries()].filter(([, t]) => t.required).map(([s]) => s);
      for (const m of milestones) {
        const where = `milestone "${m?.id}"`;
        if (!m || typeof m.id !== 'string' || !SLUG_RE.test(m.id)) { err('MILESTONE_ID', `${where}: id missing or not kebab-case`); continue; }
        if (ids.has(m.id)) { err('MILESTONE_DUPLICATE', `${where}: duplicate id`); continue; }
        ids.add(m.id);
        if (typeof m.label !== 'string' || !m.label.trim()) err('MILESTONE_LABEL', `${where}: label required`);
        if (typeof m.criteria !== 'string' || !m.criteria.trim()) err('MILESTONE_CRITERIA', `${where}: criteria (human-readable, shown to the learner and reusable as Open Badges criteria) required`);
        const shape = ruleShapeError(m.rule);
        if (shape) { err('RULE_SHAPE', `${where}: ${shape}`); continue; }

        for (const ref of ruleTaskRefs(m.rule)) {
          if (!tasks.has(ref)) err('RULE_TASK_REF', `${where}: rule references unknown task "${ref}"`);
        }

        // Reachability: with every task earned, the milestone must be satisfiable.
        const everything = Object.fromEntries([...tasks.entries()].map(([s, t]) => [s, { ...t, earned: true }]));
        if (!evalRule(m.rule, everything)) {
          err('MILESTONE_UNREACHABLE', `${where}: not satisfiable even if every credit is earned (check points thresholds, kinds and min_by_kind)`);
        }
        // Every `any` branch must individually be reachable (dead alternative paths mislead learners).
        if (Array.isArray(m.rule.any)) {
          m.rule.any.forEach((branch, i) => {
            if (!evalRule(branch, everything)) err('BRANCH_UNREACHABLE', `${where}: any[${i}] can never be satisfied`);
          });
        }
        // Exposure-only rule: satisfiable without lab/assessment/transfer evidence.
        const noEvidence = Object.fromEntries([...tasks.entries()].map(([s, t]) => [s, { ...t, earned: !EVIDENCE_KINDS.includes(t.kind) }]));
        if (evalRule(m.rule, noEvidence)) {
          err('MILESTONE_EXPOSURE_ONLY', `${where}: reachable using only read/practice credit; every path must include lab, assessment or transfer credit`);
        }
        if (m.claimable !== undefined) {
          // Claim-entitlement (#521): exploration-tier only; must not touch verified attainment.
          if (m.claimable !== 'entitlement') err('CLAIMABLE_VALUE', `${where}: claimable must be "entitlement"`);
          if (m.id === 'module-complete') err('CLAIMABLE_MODULE_COMPLETE', `${where}: module-complete can never be claimable by entitlement`);
          if (m.certificate === true) err('CLAIMABLE_CERTIFICATE', `${where}: a certificate milestone cannot be claimable by entitlement`);
          if (!Array.isArray(m.rule?.tasks) || Object.keys(m.rule).length !== 1) {
            err('CLAIMABLE_RULE_FORM', `${where}: a claimable milestone must use the {"tasks": [...]} rule form so the browser can evaluate it`);
          } else {
            for (const ref of m.rule.tasks) {
              const rt = tasks.get(ref);
              if (!rt) continue;
              if (rt.type !== 'interactive_check') err('CLAIMABLE_TASK_TYPE', `${where}: task "${ref}" is ${rt.type}; claimable milestones may reference only interactive_check tasks (Verified tasks need an account)`);
              if (rt.required) err('CLAIMABLE_TASK_REQUIRED', `${where}: task "${ref}" is required; completion must not depend on an exploration badge`);
              if (rt.raw.grading !== 'client') err('CLAIMABLE_TASK_GRADING', `${where}: task "${ref}" must set grading:"client" (Observed tier) to be evaluable before an account exists`);
            }
          }
        }
        if (m.certificate === true && completion.awards_certificate !== true) {
          warn('CERT_FLAG_MISMATCH', `${where}: certificate:true but awards_certificate is not true — no certificate will be issued`);
        }
        if (m.id === 'module-complete') {
          // Must reproduce computeModuleStatus: every required task, nothing else.
          const refs = ruleTaskRefs(m.rule);
          const same = m.rule.tasks && refs.size === legacyRequired.length && legacyRequired.every((s) => refs.has(s));
          if (!same) err('MODULE_COMPLETE_DRIFT', 'milestone "module-complete" is reserved: its rule must be exactly {"tasks":[<every required task>]}, so certificates keep their shipped meaning');
        }
      }
      // Orphan credit: a non-required credit-bearing task no milestone can ever use.
      const referenced = new Set();
      let pointsRules = false;
      for (const m of milestones) {
        if (!m?.rule) continue;
        ruleTaskRefs(m.rule).forEach((s) => referenced.add(s));
        if (ruleUsesPoints(m.rule)) pointsRules = true;
      }
      for (const [slug, t] of tasks) {
        if (t.required || referenced.has(slug)) continue;
        const explicitCredit = t.raw.credit !== undefined;
        if (!pointsRules) warn('ORPHAN_CREDIT', `task "${slug}" is not required and no milestone references it — it earns nothing`);
        else if (!explicitCredit) warn('ORPHAN_CREDIT', `task "${slug}" has no explicit credit and is not referenced by name; it contributes 1 point by default — set credit explicitly`);
      }
    }
  }

  // --- prerequisites -------------------------------------------------------
  const prereqs = completion?.prerequisites;
  if (prereqs !== undefined) {
    if (!Array.isArray(prereqs)) err('PREREQ_SHAPE', 'prerequisites must be an array');
    else for (const p of prereqs) {
      const where = `prerequisite ${JSON.stringify(p)}`;
      if (!p?.module || !p?.milestone) { err('PREREQ_SHAPE', `${where}: needs module and milestone`); continue; }
      if (p.enforce !== undefined && !['advise'].includes(p.enforce)) err('PREREQ_ENFORCE', `${where}: enforce "${p.enforce}" unsupported in v1 (only "advise")`);
      if (p.module === dirName) err('PREREQ_SELF', `${where}: module cannot require itself`);
      if (moduleIndex) {
        const target = moduleIndex.get(p.module);
        if (!target) err('PREREQ_MODULE', `${where}: module not found`);
        else if (!target.has(p.milestone)) err('PREREQ_MILESTONE', `${where}: module "${p.module}" declares no milestone "${p.milestone}" (implicit "module-complete" is always available)`);
      }
    }
  }

  return issues;
}

function validateQuestions(quiz, where, err, warn, { moduleSlug, requireModule = true } = {}) {
  if (requireModule && moduleSlug && quiz.module_slug && quiz.module_slug !== moduleSlug) {
    err('QUIZ_MODULE', `${where}: module_slug "${quiz.module_slug}" != "${moduleSlug}"`);
  }
  if (quiz.passing_score !== undefined && !(quiz.passing_score >= 0 && quiz.passing_score <= 100)) {
    err('QUIZ_PASSING', `${where}: passing_score must be 0-100`);
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    err('QUIZ_QUESTIONS', `${where}: questions must be a non-empty array`);
    return;
  }
  const ids = new Set();
  for (const q of quiz.questions) {
    const w = `${where} question "${q?.id}"`;
    if (!q?.id || ids.has(q.id)) { err('QUESTION_ID', `${w}: id missing or duplicate`); continue; }
    ids.add(q.id);
    if (typeof q.stem !== 'string' || !q.stem.trim()) err('QUESTION_STEM', `${w}: stem required`);
    if (!(typeof q.points === 'number' && q.points > 0)) err('QUESTION_POINTS', `${w}: points must be a positive number`);
    if (Array.isArray(q.options)) {
      const optIds = q.options.map((o) => o.id);
      if (new Set(optIds).size !== optIds.length) err('OPTION_DUPLICATE', `${w}: duplicate option ids`);
      const answers = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
      for (const a of answers) if (!optIds.includes(a)) err('ANSWER_NOT_AN_OPTION', `${w}: correct_answer "${a}" is not an option id`);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function loadMilestoneIndex(modulesDir, slugs) {
  const index = new Map();
  for (const slug of slugs) {
    const set = new Set(['module-complete']);
    try {
      const c = await readJson(join(modulesDir, slug, 'completion.json'));
      for (const m of c.milestones || []) if (m?.id) set.add(m.id);
    } catch { /* reported by validateModule */ }
    index.set(slug, set);
  }
  return index;
}

async function main(argv) {
  const flag = (n) => argv.includes(n);
  const val = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const modulesDir = resolve(val('--modules-dir') || join(process.cwd(), 'content/modules'));
  const only = val('--module');
  const all = (await readdir(modulesDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const targets = only ? all.filter((s) => s === only) : all;
  if (only && targets.length === 0) { console.error(`module "${only}" not found in ${modulesDir}`); return 2; }
  // Prerequisite targets resolve against the shipped tree too, so an example
  // directory can point at real modules.
  const shippedDir = resolve(process.cwd(), 'content/modules');
  const moduleIndex = await loadMilestoneIndex(shippedDir, (await readdir(shippedDir)).sort().filter((s) => !s.startsWith('.')));
  for (const [slug, set] of await loadMilestoneIndex(modulesDir, all)) moduleIndex.set(slug, set);

  const report = {};
  let errors = 0, warnings = 0;
  for (const slug of targets) {
    const issues = await validateModule(join(modulesDir, slug), { allowUnavailable: flag('--allow-unavailable'), moduleIndex });
    report[slug] = issues;
    errors += issues.filter((i) => i.level === 'error').length;
    warnings += issues.filter((i) => i.level === 'warn').length;
  }

  if (flag('--json')) {
    console.log(JSON.stringify({ modulesDir, errors, warnings, report }, null, 2));
  } else {
    for (const [slug, issues] of Object.entries(report)) {
      if (issues.length === 0) { console.log(`ok    ${slug}`); continue; }
      console.log(`${issues.some((i) => i.level === 'error') ? 'FAIL' : 'warn'}  ${slug}`);
      for (const i of issues) console.log(`  ${i.level === 'error' ? 'error' : 'warn '} [${i.code}] ${i.message}`);
    }
    console.log(`\n${targets.length} module(s), ${errors} error(s), ${warnings} warning(s)`);
  }
  return errors > 0 || (flag('--strict') && warnings > 0) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
