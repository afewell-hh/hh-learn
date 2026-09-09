/**
 * RED (Phase 4, #485) — scenario schema + anti-drift validator (#482 spec).
 *
 * Pins validateScenario(scenario, opts): the CI gate that guarantees expert-visible
 * replay lines are backed EXACTLY by validated source, and that stale/fake fabric
 * language cannot pass.
 *
 * Contract under test:
 *   validateScenario(scenario, { resolveModule: (slug) => absoluteReadmePath })
 *     => { ok: boolean, errors: Array<{ code: string, stepId?: string, message: string }> }
 *   error codes: SCHEMA | VALIDATED_ON_MISMATCH | ANCHOR_NOT_FOUND | BLOCK_NOT_FOUND
 *              | EXACT_MATCH | FACT_LINT | CONTINUITY
 *
 * FAILS TODAY: src/experiences/validate-scenario.ts does not exist yet (RED).
 */
import * as fs from 'fs';
import * as path from 'path';
import { validateScenario } from '../../src/experiences/validate-scenario';

const FIX = path.resolve(__dirname, '../fixtures/experiences');
const MODULE_PATH = path.join(FIX, 'module-fixture.md');
const resolveModule = () => MODULE_PATH; // fixture stands in for content/modules/<slug>/README.md

function loadValid(): any {
  return JSON.parse(fs.readFileSync(path.join(FIX, 'scenario.valid.json'), 'utf8'));
}
const codes = (r: { errors: Array<{ code: string }> }) => r.errors.map((e) => e.code);

describe('validateScenario — schema gate', () => {
  it('accepts the valid fixture scenario', () => {
    const r = validateScenario(loadValid(), { resolveModule });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects a missing required field (honestyLabel)', () => {
    const s = loadValid();
    delete s.honestyLabel;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('SCHEMA');
  });

  it('rejects output.mode "live" in v1 (Slice 2 seam is reserved, not allowed yet)', () => {
    const s = loadValid();
    s.acts[0].steps[0].output.mode = 'live';
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('SCHEMA');
  });

  it('rejects unknown properties (additionalProperties:false)', () => {
    const s = loadValid();
    s.acts[0].steps[0].surprise = true;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('SCHEMA');
  });
});

describe('validateScenario — validated_on reconciliation', () => {
  it('fails when source.validated_on disagrees with module frontmatter', () => {
    const s = loadValid();
    s.acts[0].steps[0].source.validated_on = '2025-11-01'; // frontmatter says 2025-10-16
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('VALIDATED_ON_MISMATCH');
  });
});

describe('validateScenario — dual-source anchoring + exact match (#482 amendment)', () => {
  it('resolves separate command (bash) and output (text) blocks and matches both', () => {
    const r = validateScenario(loadValid(), { resolveModule });
    expect(r.ok).toBe(true);
  });

  it('fails when the source heading/anchor is renamed (drift)', () => {
    const s = loadValid();
    s.acts[0].steps[0].source.command.anchor = 'Step 2: Apply the VPC RENAMED';
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('ANCHOR_NOT_FOUND');
  });

  it('fails when the block index is out of range', () => {
    const s = loadValid();
    s.acts[0].steps[0].source.output.blockIndex = 9;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('BLOCK_NOT_FOUND');
  });

  it('fails when output.text no longer matches the anchored block exactly', () => {
    const s = loadValid();
    s.acts[0].steps[0].output.text = 'vpc.vpc.githedgehog.com/webapp-prod created AND EXTRA';
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('EXACT_MATCH');
  });

  it('fails when command is not an exact line within the anchored bash block', () => {
    const s = loadValid();
    s.acts[0].steps[0].command = 'kubectl apply -f WRONG.yaml';
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('EXACT_MATCH');
  });
});

describe('validateScenario — fact-lint', () => {
  it('flags stale "reconciliation events" language in narrative', () => {
    const s = loadValid();
    s.acts[0].steps[0].narrative = 'You Observed reconciliation events in the output.';
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('FACT_LINT');
  });

  it('flags EthernetN interface naming (should be E1/N)', () => {
    const s = loadValid();
    s.acts[0].steps[0].narrative = 'Check interface Ethernet5 on the leaf.';
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('FACT_LINT');
  });

  it('context-sensitive -n fab: flags it on a fabric-CRD verb', () => {
    const s = loadValid();
    s.acts[0].steps[0].command = 'kubectl get vpcs -n fab';
    // (also breaks exact-match, but the fact-lint code must be present)
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('FACT_LINT');
  });

  it('context-sensitive -n fab: does NOT flag it on pod/log/exec commands', () => {
    const s = loadValid();
    // legitimate per lab-validation/reports/session-20260219-01.md:116
    s.acts[0].steps[0].narrative = 'Pods are in fab: kubectl logs -n fab deploy/fabric-ctrl';
    const r = validateScenario(s, { resolveModule });
    expect(codes(r)).not.toContain('FACT_LINT');
  });
});

describe('validateScenario — continuity coherence (#482 §0/§4.5)', () => {
  it('fails a "continuous" scenario whose acts reference different primary VPCs', () => {
    const s = loadValid();
    s.continuity = 'continuous';
    s.entities.vpcs.push({ id: 'webapp-vpc', vlans: [1010] });
    s.acts.push({
      id: 'recover',
      title: 'Recover',
      primaryEntities: ['webapp-vpc'],
      steps: [{ id: 'noop', kind: 'narrative', narrative: 'different fabric' }],
    });
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('CONTINUITY');
  });

  it('requires a transition narrative on a composite act that switches primary entity', () => {
    const s = loadValid();
    s.entities.vpcs.push({ id: 'webapp-vpc', vlans: [1010] });
    s.acts.push({
      id: 'recover',
      title: 'Recover',
      primaryEntities: ['webapp-vpc'],
      steps: [{ id: 'noop', kind: 'narrative', narrative: '' }], // empty transition -> fail
    });
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('CONTINUITY');
  });
});
