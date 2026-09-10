/**
 * validate-scenario — schema + anti-drift + fact-lint + continuity validator for the
 * Slice 1 Fabric Operator replay scenario (Epic #478 / #482, incl. the #482 amendment).
 *
 * Guarantees that every expert-visible replay line is backed EXACTLY by validated
 * source (dual command/output block anchoring), that dates reconcile with module
 * frontmatter, that composite arcs are honest about entity switches, and that stale
 * fabric language cannot pass.
 *
 * Pure Node/TS (no network) so it runs in the content CI job. The browser player never
 * imports this module.
 */
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import matter from 'gray-matter';

export type ErrorCode =
  | 'SCHEMA'
  | 'VALIDATED_ON_MISMATCH'
  | 'ANCHOR_NOT_FOUND'
  | 'BLOCK_NOT_FOUND'
  | 'EXACT_MATCH'
  | 'FACT_LINT'
  | 'CONTINUITY'
  | 'MISSING_SOURCE'
  | 'MODULE_NOT_FOUND';

export interface ValidationError {
  code: ErrorCode;
  stepId?: string;
  message: string;
}

export interface ValidateOptions {
  /** Resolve a scenario `source.module` slug to an absolute README path. */
  resolveModule: (moduleSlug: string) => string;
  /** Path to the JSON schema; defaults to content/experiences/scenario.schema.json. */
  schemaPath?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

// Both the jest suite and the CLI run from the repo root, so resolve the schema
// relative to cwd (avoids import.meta under CommonJS compilation).
const DEFAULT_SCHEMA_PATH = path.resolve(process.cwd(), 'content/experiences/scenario.schema.json');

// ---------------------------------------------------------------------------
// Markdown helpers (heading/section/fenced-block extraction)
// ---------------------------------------------------------------------------

interface Heading {
  level: number;
  text: string;
  line: number;
}

function parseHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  md.split('\n').forEach((line, i) => {
    // Ignore `#` lines inside fenced code blocks (e.g. bash comments), which are
    // NOT markdown headings — treating them as headings truncates sections.
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i });
  });
  return out;
}

/** Return the [startLine, endLine) range of the section whose heading contains `anchor`. */
function findSection(md: string, anchor: string): { start: number; end: number } | 'none' | 'ambiguous' {
  const headings = parseHeadings(md);
  const matches = headings.filter((h) => h.text.includes(anchor));
  if (matches.length === 0) return 'none';
  if (matches.length > 1) return 'ambiguous';
  const h = matches[0];
  const lines = md.split('\n');
  let end = lines.length;
  for (const other of headings) {
    if (other.line > h.line && other.level <= h.level) {
      end = other.line;
      break;
    }
  }
  return { start: h.line + 1, end };
}

/** Collect fenced code blocks (by language) inside a line range. Bare ``` => 'text'. */
function collectBlocks(md: string, start: number, end: number, lang: string): string[] {
  const lines = md.split('\n');
  const blocks: string[] = [];
  let inBlock = false;
  let fenceLang = '';
  let buf: string[] = [];
  for (let i = start; i < end; i++) {
    const line = lines[i];
    const fence = /^```(.*)$/.exec(line.trim());
    if (fence && !inBlock) {
      inBlock = true;
      fenceLang = (fence[1] || '').trim() || 'text';
      buf = [];
    } else if (fence && inBlock) {
      inBlock = false;
      if (fenceLang === lang) blocks.push(buf.join('\n'));
    } else if (inBlock) {
      buf.push(line);
    }
  }
  return blocks;
}

/**
 * Normalization applied identically to both sides of an exact-block comparison.
 * Only strips LEADING "# " annotation lines (e.g. "# Expected output (similar to):")
 * and trailing whitespace — interior comment lines are preserved so real comment-line
 * drift inside an output block is NOT silently accepted.
 */
function normalizeBlock(text: string): string {
  const lines = text.split('\n');
  let start = 0;
  while (start < lines.length && /^#\s/.test(lines[start])) start += 1;
  return lines.slice(start).join('\n').replace(/\s+$/g, '');
}

// ---------------------------------------------------------------------------
// Fact-lint (all 12 approved rules from #482, incl. context-sensitive ones)
// ---------------------------------------------------------------------------

function factLintHits(text: string): string[] {
  const hits: string[] = [];
  const add = (rule: string) => hits.push(rule);

  if (/reconciliation events/i.test(text)) add('1:reconciliation-events');
  if (/Events provide visibility/i.test(text)) add('2:events-provide-visibility');
  if (/Observed reconciliation events/i.test(text)) add('3:observed-reconciliation-events');
  // 4: kubectl get events without an "expected empty / no results / <none>" disclaimer
  if (/kubectl get events/i.test(text) && !/(no results|expected|<none>|returns nothing)/i.test(text)) {
    add('4:kubectl-get-events-no-disclaimer');
  }
  if (/\bEthernet\d/.test(text)) add('5:ethernetN');
  if (/fabric-controller-manager/.test(text)) add('6:fabric-controller-manager');
  // 7: -n fab is stale ONLY on a fabric-CRD verb; legitimate for pod/log/exec.
  if (
    /-n\s+fab\b/.test(text) &&
    /kubectl\s+(get|apply|describe|delete|edit)\s+(vpcs?|vpcattachments?|switches|servers|connections|agents)\b/i.test(
      text,
    )
  ) {
    add('7:-n-fab-on-fabric-crd');
  }
  if (/localhost:(3000|3001|8080|9090)\b/.test(text)) add('8:localhost-port');
  if (/prom-operator/.test(text)) add('9:prom-operator');
  // 10: Gitea user is student01, not "student"
  if (/\bstudent\b/.test(text)) add('10:student-not-student01');
  if (/(cpu_usage_percent|interface_bytes_out|bgp_neighbor_state)/.test(text)) add('11:stale-metric');
  // 12: BGP state asserted as the string "Established" (numeric 6 is correct)
  if (/BGP[\s\S]{0,60}string\s*["']?Established/i.test(text)) add('12:bgp-established-string');

  return hits;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validateScenario(scenario: any, opts: ValidateOptions): ValidationResult {
  const errors: ValidationError[] = [];
  const schemaPath = opts.schemaPath || DEFAULT_SCHEMA_PATH;

  // Gate 1: schema. On failure, stop — later gates assume a well-formed shape.
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(scenario)) {
    for (const e of validate.errors || []) {
      errors.push({ code: 'SCHEMA', message: `${e.instancePath || '/'} ${e.message}` });
    }
    return { ok: false, errors };
  }

  // ajv's type guard narrows `scenario` to `unknown` here; alias to an explicit any.
  const doc: any = scenario;
  const acts: any[] = doc.acts;

  // Gate 5: continuity coherence.
  if (doc.continuity === 'continuous') {
    const primaries = new Set<string>();
    for (const act of acts) for (const p of act.primaryEntities || []) primaries.add(p);
    if (primaries.size > 1) {
      errors.push({
        code: 'CONTINUITY',
        message: `continuity:"continuous" but acts reference multiple primary entities: ${[...primaries].join(', ')}`,
      });
    }
  } else if (doc.continuity === 'composite') {
    for (let i = 1; i < acts.length; i++) {
      const prev = JSON.stringify(acts[i - 1].primaryEntities || []);
      const cur = JSON.stringify(acts[i].primaryEntities || []);
      if (prev !== cur) {
        const firstStep = acts[i].steps[0];
        const transition = (firstStep && firstStep.narrative ? String(firstStep.narrative) : '').trim();
        if (!transition) {
          errors.push({
            code: 'CONTINUITY',
            stepId: firstStep && firstStep.id,
            message: `composite act "${acts[i].id}" switches primary entity without a transition narrative`,
          });
        }
      }
    }
  }

  // Gates 2/3/4/6: per-step provenance + fact-lint.
  for (const act of acts) {
    for (const step of act.steps) {
      const stepId = step.id;

      // Gate 6: fact-lint over authored replay content. Because output.text/command
      // must exactly match the cited source blocks (gate 4), scanning them here also
      // scans the resolved source blocks.
      const lintText = [step.narrative, step.command, step.output && step.output.text]
        .filter(Boolean)
        .join('\n');
      if (factLintHits(lintText).length > 0) {
        errors.push({
          code: 'FACT_LINT',
          stepId,
          message: `stale/fake fabric language: ${factLintHits(lintText).join(', ')}`,
        });
      }

      // Gate: expert-visible content MUST be pinned to a source selector, so a command
      // or output cannot bypass anti-drift by simply omitting its provenance.
      const source = step.source;
      if (step.kind === 'command' && !(source && source.command)) {
        errors.push({ code: 'MISSING_SOURCE', stepId, message: 'command step requires source.command selector' });
      }
      if (step.output && step.output.text !== undefined && !(source && source.output)) {
        errors.push({ code: 'MISSING_SOURCE', stepId, message: 'output.text requires source.output selector' });
      }

      if (!source) continue;

      // Read the cited module once.
      let md: string;
      let frontmatter: any;
      try {
        const raw = fs.readFileSync(opts.resolveModule(source.module), 'utf8');
        const parsed = matter(raw);
        md = parsed.content;
        frontmatter = parsed.data;
      } catch {
        errors.push({ code: 'MODULE_NOT_FOUND', stepId, message: `cannot read module ${source.module}` });
        continue;
      }

      // Gate 2: validated_on reconciliation.
      if (String(frontmatter.validated_on) !== String(source.validated_on)) {
        errors.push({
          code: 'VALIDATED_ON_MISMATCH',
          stepId,
          message: `source.validated_on ${source.validated_on} != module frontmatter ${frontmatter.validated_on}`,
        });
      }

      // Gates 3/4: per selector (command, output).
      const selectors: Array<{ kind: 'command' | 'output'; sel: any; expected: string | undefined }> = [];
      if (source.command) selectors.push({ kind: 'command', sel: source.command, expected: step.command });
      if (source.output) selectors.push({ kind: 'output', sel: source.output, expected: step.output && step.output.text });

      for (const { kind, sel, expected } of selectors) {
        const section = findSection(md, sel.anchor);
        if (section === 'none') {
          errors.push({ code: 'ANCHOR_NOT_FOUND', stepId, message: `${kind} anchor "${sel.anchor}" not found in ${source.module}` });
          continue;
        }
        if (section === 'ambiguous') {
          errors.push({ code: 'ANCHOR_NOT_FOUND', stepId, message: `${kind} anchor "${sel.anchor}" is ambiguous in ${source.module}` });
          continue;
        }
        const blocks = collectBlocks(md, section.start, section.end, sel.blockLang);
        const block = blocks[sel.blockIndex];
        if (block === undefined) {
          errors.push({ code: 'BLOCK_NOT_FOUND', stepId, message: `${kind} block [${sel.blockLang}#${sel.blockIndex}] not found under "${sel.anchor}"` });
          continue;
        }
        if (expected === undefined) {
          errors.push({ code: 'EXACT_MATCH', stepId, message: `${kind} has no value to match against source` });
          continue;
        }
        if (sel.match === 'exact-block') {
          if (normalizeBlock(block) !== normalizeBlock(expected)) {
            errors.push({ code: 'EXACT_MATCH', stepId, message: `${kind} output.text does not exactly match anchored block` });
          }
        } else {
          // exact-line: expected must equal a full line within the block.
          const lines = block.split('\n').map((l) => l.trim());
          if (!lines.includes(expected.trim())) {
            errors.push({ code: 'EXACT_MATCH', stepId, message: `${kind} "${expected}" is not an exact line in anchored block` });
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
