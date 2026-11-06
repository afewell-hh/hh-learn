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

/**
 * Two independent axes (docs/authoring-platform.md section 4.1):
 *   KIND     = what the learner did            (explore | practice | lab | assessment | transfer)
 *   EVIDENCE = how strongly we know they did it (observed | attested | checked)
 * A task carries one value on each. Neither is derived from the other;
 * KIND_EVIDENCE says which pairs are legal.
 */
export const CREDIT_KINDS = ['explore', 'practice', 'lab', 'assessment', 'transfer'];
/** Weakest to strongest. observed: the browser saw it, nothing sent. attested: the learner said so, the server recorded it. checked: the server graded it against a key it holds. */
export const EVIDENCE_TIERS = ['observed', 'attested', 'checked'];
export const EVIDENCE_RANK = { observed: 0, attested: 1, checked: 2 };

/** Which evidence tiers each kind may carry. A pair not listed is refused. */
export const KIND_EVIDENCE = {
  explore: ['observed', 'checked'],
  practice: ['observed', 'attested', 'checked'],
  lab: ['attested', 'checked'],      // a browser cannot observe a lab being done
  assessment: ['checked'],           // "assessment" claims something was graded
  transfer: ['checked'],             // a correctness claim on an unfamiliar problem needs a key
};

/** Legacy task_type -> default kind and evidence. interactive_check is resolved from its interactive. */
export const DEFAULT_KIND = {
  quiz: 'assessment',
  lab_attestation: 'lab',
  knowledge_check: 'practice',
};
export const DEFAULT_EVIDENCE = {
  quiz: 'checked',
  lab_attestation: 'attested',
  knowledge_check: 'checked',
};

/** Finish events that may earn Observed credit, by primitive. Viewing, scrolling and dwell are deliberately absent. */
export const COMPLETES_ON = {
  replay: ['all_steps'],
  compare: ['all_steps'],
  explorer: ['objects_visited'],
};
const VIEW_EVENTS = ['view', 'scroll', 'dwell', 'time', 'click', 'open'];

/** Words an observed-basis milestone may not use: they claim grading or certification browser-observed evidence cannot support. */
export const ASSESSMENT_VOCAB = /\b(certif\w*|pass(?:ed|es)?|assess\w*|proficien\w*|master\w*|competen\w*|verified|graded|scor(?:e|ed|es|ing)|exam\w*|demonstrat\w*|qualif\w*|attest\w*)\b/i;

/** Open registry of leasable endpoint roles (lab-server / lab-pair). Not an enum: new roles must not need a schema change. */
export const KNOWN_ENDPOINT_ROLES = ['gpu-host', 'compute-host', 'compute-agentic-host'];

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
  compare: { klass: 'C0', available: true, label_field: 'captured_at', needs: ['left', 'right', 'equivalence', 'caption'] },
  shell: { klass: 'C2', available: false, needs: ['image', 'ttl_minutes'] },
  'lab-server': { klass: 'C3', available: false, needs: ['servers', 'fabric_write', 'max_minutes'] },
  'lab-pair': { klass: 'C4', available: false, needs: ['servers', 'fabric_write', 'max_minutes'] },
};

/** Evidence-source labels the UI renders. `live` is only valid for classes that have a broker. */
export const SOURCE_LABELS = ['recorded', 'cached', 'simulated', 'captured', 'illustrative', 'live'];
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

/**
 * The evidence tier a milestone can honestly claim: the weakest tier among the
 * inclusion-minimal sets of tasks that satisfy the rule. A milestone reachable
 * by an observed-only path is an observed-basis milestone, however strong its
 * other paths are. `tasks` is Map slug -> {kind, credit, evidence}.
 * Returns null if undeterminable (a task has no resolved evidence, or > 16 tasks).
 */
export function milestoneBasis(rule, tasks) {
  const slugs = [...tasks.keys()];
  if (slugs.length > 16 || slugs.some((s) => !tasks.get(s).evidence || !tasks.get(s).kind)) return null;
  const satisfying = [];
  for (let mask = 1; mask < 1 << slugs.length; mask++) {
    const earned = Object.fromEntries(slugs.map((s, i) => [s, { ...tasks.get(s), earned: Boolean(mask & (1 << i)) }]));
    if (evalRule(rule, earned)) satisfying.push(mask);
  }
  if (satisfying.length === 0) return null;
  const minimal = satisfying.filter((m) => !satisfying.some((o) => o !== m && (o & m) === o));
  let weakest = Infinity;
  for (const m of minimal) {
    for (let i = 0; i < slugs.length; i++) {
      if (m & (1 << i)) weakest = Math.min(weakest, EVIDENCE_RANK[tasks.get(slugs[i]).evidence]);
    }
  }
  return EVIDENCE_TIERS[weakest];
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
        // interactive_check kind/evidence are resolved after interactives.json is read.
        kind = kind ?? DEFAULT_KIND[t.task_type];
        let credit = t.credit;
        if (credit !== undefined && !(typeof credit === 'number' && credit > 0)) {
          err('CREDIT_VALUE', `${where}: credit must be a positive number`);
          credit = undefined;
        }
        if (t.grading !== undefined) err('GRADING_RENAMED', `${where}: "grading" was replaced by "evidence" (observed | attested | checked); see docs/authoring-platform.md section 4.1`);
        let evidence = t.evidence;
        if (evidence !== undefined && !EVIDENCE_TIERS.includes(evidence)) {
          err('EVIDENCE_UNKNOWN', `${where}: evidence "${evidence}" is not one of ${EVIDENCE_TIERS.join(', ')}`);
          evidence = undefined;
        }
        if (t.task_type !== 'interactive_check') {
          const implied = DEFAULT_EVIDENCE[t.task_type];
          if (evidence !== undefined && implied && evidence !== implied) {
            err('EVIDENCE_TYPE', `${where}: ${t.task_type} is always "${implied}" evidence; "${evidence}" is only available on interactive_check`);
          }
          evidence = implied;
        } else {
          if (!t.interactive_ref) err('INTERACTIVE_REF_MISSING', `${where}: interactive_check requires interactive_ref`);
          if (t.required === true) warn('NEW_TASK_REQUIRED', `${where}: a required interactive_check changes who is "complete"; for modules already live keep it required:false`);
        }
        tasks.set(t.task_slug, { kind, credit: credit ?? 1, evidence, type: t.task_type, required: t.required === true, raw: t });
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
          if (it.type === 'compare') {
            const bothCaptured = it.left?.provenance === 'captured' && it.right?.provenance === 'captured';
            const want = bothCaptured ? 'captured' : 'illustrative';
            if (it.source_label !== want) err('HONESTY_MISMATCH', `${where}: compare is labelled by its weakest side; with sides ${it.left?.provenance}/${it.right?.provenance} the label must be "${want}"`);
          }
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
        // Finish event for Observed credit. Exactly one way to earn: a key-checked `check`, or an observed `completes_on`.
        if (it.completes_on !== undefined) {
          if (it.check) err('INTERACTIVE_BOTH', `${where}: declare either "check" (key-checked) or "completes_on" (browser-observed), not both; use two interactives or two tasks`);
          if (VIEW_EVENTS.includes(it.completes_on)) {
            err('VIEW_NOT_CREDIT', `${where}: completes_on "${it.completes_on}" is exposure, not a finish. Viewing, scrolling, clicking and dwell time never earn credit`);
          } else if (!(COMPLETES_ON[it.type] || []).includes(it.completes_on)) {
            err('COMPLETES_ON', `${where}: ${it.type} has no observable finish "${it.completes_on}" (allowed: ${(COMPLETES_ON[it.type] || ['none']).join(', ')})`);
          }
          if (it.completes_on === 'objects_visited' && !(Array.isArray(it.required_objects) && it.required_objects.length > 0)) {
            err('REQUIRED_OBJECTS', `${where}: objects_visited needs a non-empty "required_objects" list, so "finished" is checkable`);
          }
        }
        if (it.type === 'compare') await validateCompare(it, where, dir, err, warn);
        if (Array.isArray(it.servers)) {
          for (const s of it.servers) {
            if (!s || typeof s.role !== 'string' || !SLUG_RE.test(s.role)) err('ENDPOINT_ROLE', `${where}: each server needs a kebab-case "role"`);
            else if (!KNOWN_ENDPOINT_ROLES.includes(s.role)) warn('ENDPOINT_ROLE_UNKNOWN', `${where}: endpoint role "${s.role}" is not in the known registry (${KNOWN_ENDPOINT_ROLES.join(', ')}); roles are an open set, but #497/#500 must model it before it can lease`);
          }
        }
      }
    }
  }
  // Resolve kind/evidence for interactive_check from the interactive it points at, then check the pair.
  for (const [slug, t] of tasks) {
    if (t.type === 'interactive_check') {
      const ref = t.raw.interactive_ref;
      const target = declared.get(ref);
      if (!interactives) {
        err('INTERACTIVES_FILE_MISSING', `task "${slug}": interactive_check but no interactives.json`);
      } else if (ref && !target) {
        err('INTERACTIVE_REF', `task "${slug}": interactive_ref "${ref}" not declared in interactives.json`);
      } else if (target) {
        const derived = target.check ? 'checked' : target.completes_on ? 'observed' : undefined;
        if (!derived) err('INTERACTIVE_NO_FINISH', `task "${slug}": interactive "${ref}" has neither a "check" (key-checked) nor a "completes_on" (browser-observed), so there is nothing to earn credit from`);
        if (t.evidence !== undefined && derived && t.evidence !== derived) err('EVIDENCE_MISMATCH', `task "${slug}": evidence "${t.evidence}" but interactive "${ref}" provides "${derived}" evidence`);
        t.evidence = t.evidence ?? derived;
      }
      t.kind = t.kind ?? (t.evidence === 'observed' ? 'explore' : t.evidence === 'checked' ? 'practice' : undefined);
    }
    // The independent-axes rule: which (kind, evidence) pairs exist.
    if (t.kind && t.evidence && !KIND_EVIDENCE[t.kind].includes(t.evidence)) {
      err('KIND_EVIDENCE', `task "${slug}": kind "${t.kind}" cannot rest on "${t.evidence}" evidence (allowed: ${KIND_EVIDENCE[t.kind].join(', ')}). Declare the activity honestly instead of borrowing a stronger kind`);
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
        // Basis: the weakest evidence tier any minimal path to this milestone rests on.
        // An observed-basis milestone is legal ("exploration"), but it may not use the
        // vocabulary of grading, and may not carry a certificate.
        const basis = milestoneBasis(m.rule, tasks);
        if (basis === 'observed') {
          const hit = `${m.label ?? ''} ${m.criteria ?? ''}`.match(ASSESSMENT_VOCAB);
          if (hit) err('BASIS_VOCABULARY', `${where}: reachable on browser-observed evidence alone, so its label/criteria may not claim grading or certification (found "${hit[0]}"). Say what the learner did, e.g. "finished the walkthrough"`);
          if (m.certificate === true) err('BASIS_CERTIFICATE', `${where}: a certificate cannot rest on browser-observed evidence`);
        }
        if (basis === null && !issues.some((i) => i.level === 'error' && /^(TASK_|KIND_|EVIDENCE_|INTERACTIVE_)/.test(i.code))) {
          warn('BASIS_UNKNOWN', `${where}: evidence basis could not be determined (more than 16 tasks, or unresolved task evidence)`);
        }
        if (m.claimable !== undefined) {
          // Claim-entitlement (#521). Single-page-view evaluation (design section 4.8, option a).
          if (m.claimable !== 'entitlement') err('CLAIMABLE_VALUE', `${where}: claimable must be "entitlement"`);
          if (m.id === 'module-complete') err('CLAIMABLE_MODULE_COMPLETE', `${where}: module-complete can never be claimable by entitlement`);
          if (m.certificate === true) err('CLAIMABLE_CERTIFICATE', `${where}: a certificate milestone cannot be claimable by entitlement`);
          if (!Array.isArray(m.rule?.tasks) || Object.keys(m.rule).length !== 1) {
            err('CLAIMABLE_RULE_FORM', `${where}: a claimable milestone must use the {"tasks": [...]} rule form so the browser can evaluate it from in-page state`);
          } else {
            if (m.rule.tasks.length > 3) warn('CLAIMABLE_MANY_TASKS', `${where}: ${m.rule.tasks.length} tasks must all finish in one page view; a reload restarts evaluation. Keep it to 3 or fewer`);
            for (const ref of m.rule.tasks) {
              const rt = tasks.get(ref);
              if (!rt) continue;
              if (rt.type !== 'interactive_check') err('CLAIMABLE_TASK_TYPE', `${where}: task "${ref}" is ${rt.type}; a claimable milestone may use only interactive_check tasks (the others need an account)`);
              if (rt.required) err('CLAIMABLE_TASK_REQUIRED', `${where}: task "${ref}" is required; completion must not depend on an exploration badge`);
              if (rt.evidence !== 'observed') err('CLAIMABLE_TASK_EVIDENCE', `${where}: task "${ref}" has evidence "${rt.evidence}"; before an account exists only "observed" tasks can be evaluated (no answer key reaches the browser)`);
              if (rt.type === 'interactive_check' && !markerIds.includes(rt.raw.interactive_ref)) {
                err('CLAIMABLE_NOT_ON_PAGE', `${where}: task "${ref}" uses interactive "${rt.raw.interactive_ref}", which is not placed in this module's README; every input must be on the page being viewed`);
              }
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

/**
 * `compare` primitive ("old way vs Hedgehog way"). Rules exist to make a straw man
 * impossible to ship quietly: counts are derived from the captured files rather than
 * authored, the old-way side must state its baseline and completeness, and equivalence
 * of outcome must be stated or the difference disclosed.
 */
async function validateCompare(it, where, dir, err, warn) {
  if ('counts' in it) err('COMPARE_COUNTS_AUTHORED', `${where}: counts are derived from the source files by the renderer and validator; remove the authored "counts" so they cannot be inflated`);
  const sides = {};
  for (const name of ['left', 'right']) {
    const side = it[name];
    const w = `${where} ${name}`;
    if (!side || typeof side !== 'object') continue; // INTERACTIVE_FIELD already reported
    if (!['old_way', 'hedgehog_way', 'other'].includes(side.role)) err('COMPARE_ROLE', `${w}: role must be old_way | hedgehog_way | other`);
    if (typeof side.label !== 'string' || !side.label.trim()) err('COMPARE_LABEL', `${w}: label required`);
    if (!['captured', 'illustrative'].includes(side.provenance)) err('COMPARE_PROVENANCE', `${w}: provenance must be "captured" or "illustrative"`);
    if (side.provenance === 'captured') {
      const cf = side.captured_from || {};
      for (const k of ['system', 'version', 'date']) if (!cf[k]) err('COMPARE_CAPTURED_FROM', `${w}: captured_from.${k} required (which system and version, on what date)`);
    }
    if (side.provenance === 'illustrative' && !side.illustrative_reason) err('COMPARE_ILLUSTRATIVE', `${w}: an illustrative side needs "illustrative_reason" (why it is not captured)`);
    if (typeof side.src !== 'string') { err('COMPARE_SRC', `${w}: src (path to the captured text) required`); continue; }
    sides[name] = side;
  }
  const old = [it.left, it.right].find((s) => s?.role === 'old_way');
  if (old) {
    if (!old.baseline || String(old.baseline).length < 10) err('COMPARE_BASELINE', `${where}: the old-way side must state its baseline (for example "manual per-device CLI, no automation") so a reader can judge fairness`);
    if (!['complete', 'excerpt'].includes(old.completeness)) err('COMPARE_COMPLETENESS', `${where}: old-way completeness must be "complete" or "excerpt"`);
    if (old.completeness === 'excerpt' && !old.omitted) err('COMPARE_OMITTED', `${where}: an excerpted old-way side must say what was omitted; counts will be shown as "excerpt"`);
    if (!old.representative_basis || String(old.representative_basis).length < 40) err('COMPARE_REPRESENTATIVE', `${where}: old-way side needs "representative_basis" (at least a sentence): why this is how the task is genuinely done, not a straw man`);
    if (old.provenance === 'illustrative') warn('COMPARE_OLD_ILLUSTRATIVE', `${where}: the old-way side is illustrative; prefer a captured configuration. The pane will be labelled illustrative`);
  }
  if (it.hard_way === true) {
    if (!old || old.provenance !== 'captured' || old.completeness !== 'complete') {
      err('COMPARE_HARD_WAY', `${where}: hard_way:true requires a captured, complete old-way side. A hard-way campaign that is excerpted or illustrative is a straw man`);
    }
  }
  const eq = it.equivalence;
  if (eq && typeof eq === 'object') {
    if (!['same', 'differs'].includes(eq.status)) err('COMPARE_EQUIVALENCE', `${where}: equivalence.status must be "same" or "differs"`);
    if (!eq.outcome) err('COMPARE_EQUIVALENCE', `${where}: equivalence.outcome (what both sides achieve) required`);
    if (eq.status === 'differs' && !eq.difference) err('COMPARE_DIFFERENCE', `${where}: equivalence.status "differs" requires "difference" (the disclosed gap in outcome)`);
  } else if (eq !== undefined) {
    err('COMPARE_EQUIVALENCE', `${where}: equivalence must be an object { status, outcome, difference? }`);
  }
  // Derive counts and cross-check devices and step ranges.
  return await deriveCompareCounts(it, sides, where, dir, err);
}

/** Counts shown to the learner come from here, never from the author. Device markers are `# @device <name>` lines. */
async function deriveCompareCounts(it, sides, where, dir, err) {
  for (const [name, side] of Object.entries(sides)) {
    let text;
    try { text = await readFile(join(dir, side.src), 'utf-8'); } catch { err('ASSET_MISSING', `${where} ${name}: src "${side.src}" not found`); continue; }
    const lines = text.split('\n');
    const devices = new Set(lines.map((l) => l.match(/^\s*(?:#|!)\s*@device\s+(\S+)/)?.[1]).filter(Boolean));
    const content = lines.filter((l) => l.trim() && !/^\s*(#|!|\/\/)/.test(l));
    side.derived = { lines: content.length, devices: devices.size };
    if (Array.isArray(side.devices) && side.devices.length > 1 && devices.size === 0) {
      err('COMPARE_DEVICES', `${where} ${name}: declares ${side.devices.length} devices but the source has no "# @device <name>" markers, so the device count cannot be verified`);
    }
    if (Array.isArray(side.devices) && devices.size > 0 && (side.devices.length !== devices.size || side.devices.some((d) => !devices.has(d)))) {
      err('COMPARE_DEVICES', `${where} ${name}: devices ${JSON.stringify(side.devices)} do not match the markers in ${side.src} (${[...devices].join(', ')})`);
    }
    for (const [i, step] of (it.steps || []).entries()) {
      const r = step?.[name === 'left' ? 'left' : 'right'];
      if (!Array.isArray(r) || r.length !== 2 || !(r[0] >= 1 && r[1] >= r[0] && r[1] <= lines.length)) {
        err('COMPARE_STEP_RANGE', `${where} steps[${i}].${name}: expected [firstLine, lastLine] within ${side.src} (${lines.length} lines)`);
      }
    }
  }
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
