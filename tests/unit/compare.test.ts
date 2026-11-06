/**
 * compare primitive (issue #525): derivation, integrity rules, and the validator that enforces them.
 * Spec: docs/authoring-platform.md section 3.7.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const COMPARE_JS = join(ROOT, 'clean-x-hedgehog-templates/assets/js/compare.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require(COMPARE_JS);
const FIXTURE = join(ROOT, 'docs/examples/authoring-platform/modules/shrink-blast-radius-compare');
const SLUG = 'shrink-blast-radius-compare';

type Json = Record<string, any>;
const read = (p: string) => readFileSync(join(FIXTURE, p), 'utf-8');
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const baseIt = (): Json => JSON.parse(read('interactives.json')).interactives[0];
const baseTexts = () => ({ left: read('captures/tenant-sonic.txt'), right: read('captures/tenant-vpc.yaml') });
const codes = (it: Json, texts = baseTexts()) => core.checkCompare(it, texts).filter((p: Json) => p.level === 'error').map((p: Json) => p.code);

/** A fully captured, non-fixture variant, as the real instance will be after the data-only swap. */
function captured(): { it: Json; texts: { left: string; right: string } } {
  const it = clone(baseIt());
  for (const s of ['left', 'right']) {
    delete it[s].fixture;
    delete it[s].illustrative_reason;
    it[s].provenance = 'captured';
    it[s].captured_from = { system: s === 'left' ? 'SONiC' : 'Hedgehog Fabric', version: 'x.y', date: '2026-11-01' };
  }
  it.source_label = 'captured';
  const strip = (t: string) => t.split('\n').filter((l) => !/@fixture/.test(l)).join('\n');
  // Dropping the two leading fixture lines shifts physical line numbers; recompute the step ranges.
  const texts = { left: strip(baseTexts().left), right: strip(baseTexts().right) };
  it.steps = [{ id: 's1', title: 'a', left: [3, 5], right: [1, 10] }];
  return { it, texts };
}

describe('derivation (rule 1: counts are derived, never authored)', () => {
  it('counts non-blank, non-comment lines and # @device markers from the text', () => {
    const a = core.analyse('# comment\n! also comment\n// and this\n\n# @device a\nx\ny\n# @device b\nz\n');
    expect(a.lines).toBe(3);
    expect(a.devices).toEqual(['a', 'b']);
    expect(a.perDevice.a.lines).toBe(2);
    expect(a.perDevice.b.lines).toBe(1);
  });

  it('the fixture yields 23 SONiC lines over 3 devices and 19 YAML lines', () => {
    const t = baseTexts();
    expect(core.analyse(t.left)).toMatchObject({ lines: 23, devices: ['leaf-01', 'leaf-02', 'spine-01'] });
    expect(core.analyse(t.right).lines).toBe(19);
  });

  it('an authored counts key is COMPARE_COUNTS_AUTHORED, at the top level or on a side', () => {
    const top = baseIt(); top.counts = { left: 3, right: 1 };
    expect(codes(top)).toContain('COMPARE_COUNTS_AUTHORED');
    const side = baseIt(); side.left.counts = { lines: 3 };
    expect(codes(side)).toContain('COMPARE_COUNTS_AUTHORED');
  });
});

describe('provenance per pane (rule 2)', () => {
  it('the fixture is accepted by the shared rules', () => {
    expect(codes(baseIt())).toEqual([]);
  });

  it('weakest side wins', () => {
    const { it } = captured();
    expect(core.weakestLabel(it.left, it.right)).toBe('captured');
    expect(core.weakestLabel({ provenance: 'captured' }, { provenance: 'illustrative' })).toBe('illustrative');
    expect(core.weakestLabel({ provenance: 'illustrative' }, { provenance: 'captured' })).toBe('illustrative');
  });

  it('a fully captured instance (the data-only swap) passes', () => {
    const { it, texts } = captured();
    expect(codes(it, texts)).toEqual([]);
  });

  it.each(['system', 'version', 'date'])('captured needs captured_from.%s', (k) => {
    const { it, texts } = captured();
    delete it.left.captured_from[k];
    expect(codes(it, texts)).toContain('COMPARE_CAPTURED_FROM');
  });

  it('captured date must be a real, non-future calendar date', () => {
    for (const bad of ['2026-02-30', '11/05/2026', '2999-01-01']) {
      const { it, texts } = captured();
      it.left.captured_from.date = bad;
      expect(codes(it, texts)).toContain('COMPARE_DATE');
    }
  });

  it('illustrative needs illustrative_reason', () => {
    const it = baseIt(); delete it.left.illustrative_reason;
    expect(codes(it)).toContain('COMPARE_ILLUSTRATIVE');
  });

  it('unknown provenance is refused', () => {
    const it = baseIt(); it.right.provenance = 'measured';
    expect(codes(it)).toContain('COMPARE_PROVENANCE');
  });
});

describe('fixtures cannot pass as captures', () => {
  it('fixture:true with provenance captured is refused', () => {
    const { it, texts } = captured();
    it.left.fixture = true;
    expect(codes(it, texts)).toContain('COMPARE_FIXTURE_CAPTURED');
  });
  it('a captured side whose file still says @fixture is refused', () => {
    const { it, texts } = captured();
    texts.left = '# @fixture left over\n' + texts.left;
    expect(codes(it, texts)).toContain('COMPARE_FIXTURE_CAPTURED');
  });
  it('fixture:true requires the marker inside the file, and vice versa', () => {
    const a = baseTexts(); a.left = a.left.replace('@fixture', 'fixture-not-marker');
    expect(codes(baseIt(), a)).toContain('COMPARE_FIXTURE_MARK');
    const it = baseIt(); delete it.left.fixture;
    expect(codes(it)).toContain('COMPARE_FIXTURE_MARK');
  });
});

describe('old-way fairness (rule 3) and hard_way (rule 5)', () => {
  it.each([
    ['baseline', 'COMPARE_BASELINE'],
    ['representative_basis', 'COMPARE_REPRESENTATIVE'],
    ['completeness', 'COMPARE_COMPLETENESS'],
  ])('old way needs %s', (field, code) => {
    const it = baseIt(); delete it.left[field];
    expect(codes(it)).toContain(code);
  });
  it('an excerpt must say what was omitted', () => {
    const it = baseIt(); it.left.completeness = 'excerpt';
    expect(codes(it)).toContain('COMPARE_OMITTED');
    it.left.omitted = 'leaf-03 to leaf-08';
    expect(codes(it)).not.toContain('COMPARE_OMITTED');
  });
  it('hard_way refuses illustrative or excerpted old way', () => {
    const it = baseIt(); it.hard_way = true;
    expect(codes(it)).toContain('COMPARE_HARD_WAY');
    const { it: c, texts } = captured(); c.hard_way = true;
    expect(codes(c, texts)).toEqual([]);
    c.left.completeness = 'excerpt'; c.left.omitted = 'x';
    expect(codes(c, texts)).toContain('COMPARE_HARD_WAY');
  });
});

describe('equivalence (rule 4) and evidence plane', () => {
  it('equivalence must exist with an outcome', () => {
    const none = baseIt(); delete none.equivalence;
    expect(codes(none)).toContain('COMPARE_EQUIVALENCE');
    const noOutcome = baseIt(); delete noOutcome.equivalence.outcome;
    expect(codes(noOutcome)).toContain('COMPARE_EQUIVALENCE');
  });
  it('differs requires the difference spelled out', () => {
    const it = baseIt(); it.equivalence = { status: 'differs', outcome: 'x' };
    expect(codes(it)).toContain('COMPARE_DIFFERENCE');
    it.equivalence.difference = 'the Hedgehog side also needs a switch group';
    expect(codes(it)).not.toContain('COMPARE_DIFFERENCE');
  });
  it('configuration is never data-plane proof', () => {
    const it = baseIt(); it.evidence_plane = 'data-plane';
    expect(codes(it)).toContain('COMPARE_PLANE');
  });
});

describe('device markers and step ranges', () => {
  it('device list must equal the markers', () => {
    const it = baseIt(); it.left.devices = ['leaf-01', 'leaf-02'];
    expect(codes(it)).toContain('COMPARE_DEVICES');
    const other = baseIt(); other.left.devices = ['leaf-01', 'leaf-02', 'spine-99'];
    expect(codes(other)).toContain('COMPARE_DEVICES');
  });
  it('several declared devices with no markers cannot be verified', () => {
    const t = baseTexts(); t.left = t.left.replace(/# @device .*\n/g, '');
    expect(codes(baseIt(), t)).toContain('COMPARE_DEVICES');
  });
  it('duplicate markers are refused', () => {
    const t = baseTexts(); t.left += '# @device leaf-01\nconfig save -y\n';
    expect(codes(baseIt(), t)).toContain('COMPARE_DEVICES');
  });
  it('step ranges must sit inside the file', () => {
    const it = baseIt(); it.steps[0].left = [1, 999];
    expect(codes(it)).toContain('COMPARE_STEP_RANGE');
  });
});

describe('renderer is network-free (per #480)', () => {
  const src = readFileSync(COMPARE_JS, 'utf-8') + readFileSync(join(ROOT, 'clean-x-hedgehog-templates/assets/css/interactive.css'), 'utf-8') + readFileSync(join(ROOT, 'clean-x-hedgehog-templates/learn/macros/compare.html'), 'utf-8');
  it.each(['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'api.hedgehog.cloud', '/events/track', 'createElement(\'script\')', 'createElement(\'img\')', '@import', 'url(http'])(
    'contains no %s',
    (token) => { expect(src).not.toContain(token); },
  );
});

describe('validate-authoring.mjs on compare', () => {
  let tmp: string;
  let dir: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cmp-'));
    dir = join(tmp, SLUG);
    cpSync(FIXTURE, dir, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  function validate(modulesDir: string) {
    try {
      const out = execFileSync('node', ['scripts/validate-authoring.mjs', '--modules-dir', modulesDir, '--json'], { cwd: ROOT, encoding: 'utf-8' });
      return { status: 0, json: JSON.parse(out) };
    } catch (e: any) {
      return { status: e.status as number, json: JSON.parse(e.stdout) };
    }
  }
  const mutate = (fn: (doc: Json) => void) => {
    const p = join(dir, 'interactives.json');
    const doc = JSON.parse(readFileSync(p, 'utf-8'));
    fn(doc.interactives[0]);
    writeFileSync(p, JSON.stringify(doc, null, 2));
  };
  const issueCodes = (r: Json) => (r.json.report[SLUG] as Json[]).filter((i) => i.level === 'error').map((i) => i.code);

  it('accepts the fixture instance with only the two expected warnings', () => {
    // Illustrative old way (it is a fixture) and no credit task (opening the panes earns nothing, by design).
    const r = validate(tmp);
    expect(r.status).toBe(0);
    expect(r.json.errors).toBe(0);
    expect(r.json.report[SLUG].map((i: Json) => i.code).sort()).toEqual(['COMPARE_OLD_ILLUSTRATIVE', 'INTERACTIVE_NO_CREDIT']);
  });

  it('rejects an authored counts key', () => {
    mutate((it) => { it.counts = { left: 3, right: 1 }; });
    const r = validate(tmp);
    expect(r.status).toBe(1);
    expect(issueCodes(r)).toContain('COMPARE_COUNTS_AUTHORED');
  });

  it('rejects a primitive label stronger than its weakest side', () => {
    mutate((it) => { it.source_label = 'captured'; });
    expect(issueCodes(validate(tmp))).toContain('HONESTY_MISMATCH');
  });

  it('rejects data-plane evidence on a compare', () => {
    mutate((it) => { it.evidence_plane = 'data-plane'; });
    expect(issueCodes(validate(tmp))).toContain('COMPARE_PLANE');
  });

  it('rejects a device count that disagrees with the markers', () => {
    mutate((it) => { it.left.devices = ['leaf-01', 'leaf-02']; });
    expect(issueCodes(validate(tmp))).toContain('COMPARE_DEVICES');
  });

  it('confines src to the module directory', () => {
    mutate((it) => { it.left.src = '../../../../../package.json'; });
    expect(issueCodes(validate(tmp))).toContain('COMPARE_SRC_PATH');
  });

  it('reports a missing src file once', () => {
    mutate((it) => { it.right.src = 'captures/nope.yaml'; });
    const c = issueCodes(validate(tmp));
    expect(c.filter((x) => x === 'ASSET_MISSING').length).toBeGreaterThanOrEqual(1);
    expect(c).not.toContain('COMPARE_SRC');
  });

  it('reports step ranges outside the file', () => {
    mutate((it) => { it.steps[0].right = [1, 500]; });
    expect(issueCodes(validate(tmp))).toContain('COMPARE_STEP_RANGE');
  });

  it('keeps all 20 shipped modules at 0 errors and 0 warnings', () => {
    const r = validate(join(ROOT, 'content/modules'));
    expect(r.status).toBe(0);
    expect(Object.keys(r.json.report)).toHaveLength(20);
    expect(r.json.errors).toBe(0);
    expect(r.json.warnings).toBe(0);
  });
});
