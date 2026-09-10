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

describe('validateScenario — fact-lint (all 12 approved rules from #482 must be enforced)', () => {
  // Each positive case only mutates `narrative` (free text, fact-linted but not
  // anchored), so FACT_LINT is the only expected error — proving the specific rule
  // is enforced, not merely that "something" fails.
  const positives: Array<{ rule: string; narrative?: string; command?: string }> = [
    { rule: '1 reconciliation events', narrative: 'You saw reconciliation events in the output.' },
    { rule: '2 Events provide visibility', narrative: 'Events provide visibility into the provisioning process.' },
    { rule: '3 Observed reconciliation events', narrative: 'Observed reconciliation events during apply.' },
    { rule: '4 kubectl get events w/o disclaimer', narrative: 'Run kubectl get events to watch VPC status.' },
    { rule: '5 EthernetN naming', narrative: 'Inspect interface Ethernet5 on the leaf.' },
    { rule: '6 fabric-controller-manager', narrative: 'Restart the fabric-controller-manager pod.' },
    { rule: '8 localhost:PORT', narrative: 'Open http://localhost:3000 for Grafana.' },
    { rule: '9 prom-operator', narrative: 'Log in to Grafana with prom-operator.' },
    { rule: '10 student (not student01)', narrative: 'Log in to Gitea as user student today.' },
    { rule: '11a stale metric cpu_usage_percent', narrative: 'Query cpu_usage_percent in Prometheus.' },
    { rule: '11b stale metric interface_bytes_out', narrative: 'Query interface_bytes_out.' },
    { rule: '11c stale metric bgp_neighbor_state', narrative: 'Query bgp_neighbor_state.' },
    { rule: '12 BGP Established as string', narrative: 'Confirm BGP neighbor state is the string "Established".' },
    { rule: '7 -n fab on fabric CRD', command: 'kubectl get vpcs -n fab' },
  ];
  it.each(positives)('flags rule [$rule]', ({ narrative, command }) => {
    const s = loadValid();
    if (narrative !== undefined) s.acts[0].steps[0].narrative = narrative;
    if (command !== undefined) s.acts[0].steps[0].command = command;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('FACT_LINT');
  });

  // Context-sensitive / correct usages must NOT be flagged.
  const negatives: Array<{ rule: string; narrative: string }> = [
    { rule: '7 -n fab on pod/log/exec is legitimate', narrative: 'Pods live in fab: kubectl logs -n fab deploy/fabric-ctrl' },
    { rule: '10 student01 is the correct Gitea user', narrative: 'Log in to Gitea as student01.' },
    { rule: '5 E1/N is the correct interface format', narrative: 'Inspect interface E1/5 on the leaf.' },
    { rule: '6 fabric-ctrl is the correct controller name', narrative: 'Restart the fabric-ctrl pod.' },
    { rule: '4 kubectl get events WITH the expected-empty disclaimer', narrative: 'kubectl get events returns no results — this is expected for fabric CRDs.' },
  ];
  it.each(negatives)('does NOT flag [$rule]', ({ narrative }) => {
    const s = loadValid();
    s.acts[0].steps[0].narrative = narrative;
    const r = validateScenario(s, { resolveModule });
    expect(codes(r)).not.toContain('FACT_LINT');
  });
});

describe('validateScenario — mandatory provenance selectors (devb #486)', () => {
  it('fails a command step that omits source.command', () => {
    const s = loadValid();
    delete s.acts[0].steps[0].source.command;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('MISSING_SOURCE');
  });

  it('fails when output.text is present but source.output is missing', () => {
    const s = loadValid();
    delete s.acts[0].steps[0].source.output;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('MISSING_SOURCE');
  });

  it('fails a command step with no source at all', () => {
    const s = loadValid();
    delete s.acts[0].steps[0].source;
    const r = validateScenario(s, { resolveModule });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('MISSING_SOURCE');
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
