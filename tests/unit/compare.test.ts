/**
 * compare primitive (issue #525): derivation, integrity rules, and the validator that enforces them.
 * Spec: docs/authoring-platform.md section 3.7.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
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
    it[s].captured_from = { system: s === 'left' ? 'SONiC' : 'Hedgehog Fabric', version: '9.9.9-test', date: '2026-11-01' };
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

// ---------------------------------------------------------------------------
// Revision pass on PR #527: each test below would have caught the original defect.
// ---------------------------------------------------------------------------

describe('fix 1: device counts cannot be inflated', () => {
  it('imaginary markers with no configuration under them are not devices, and are an error', () => {
    const t = baseTexts();
    const inflated = t.left + Array.from({ length: 11 }, (_, i) => `# @device imaginary-${i}\n`).join('');
    const a = core.analyse(inflated);
    expect(a.devices).toEqual(['leaf-01', 'leaf-02', 'spine-01']);
    expect(a.emptyDevices).toHaveLength(11);
    expect(codes(baseIt(), { ...t, left: inflated })).toContain('COMPARE_DEVICE_EMPTY');
  });

  it('declaring the imaginary devices does not make them count', () => {
    const t = baseTexts();
    const it = baseIt();
    const names = Array.from({ length: 11 }, (_, i) => `imaginary-${i}`);
    it.left.devices = [...it.left.devices, ...names];
    const left = t.left + names.map((n) => `# @device ${n}\n`).join('');
    const c = codes(it, { ...t, left });
    expect(c).toContain('COMPARE_DEVICE_EMPTY');
    expect(c).toContain('COMPARE_DEVICES');
    expect(core.checkCompare(it, { ...t, left }).derived.left.devices).toHaveLength(3);
  });

  it('a section holding only comments or blanks is empty', () => {
    const a = core.analyse('# @device a\n# just a comment\n\n# @device b\nreal line\n');
    expect(a.devices).toEqual(['b']);
    expect(a.emptyDevices).toEqual(['a']);
  });

  it.each([
    ['nameless', '# @device\nx\n'],
    ['trailing garbage', '# @device leaf-01 and also leaf-02\nx\n'],
    ['bad characters', '# @device le af;rm\nx\n'],
    ['glued suffix', '# @devices leaf-01\nx\n'],
    ['hyphen suffix', '# @device-leaf-01\nx\n'],
  ])('a malformed marker (%s) is an error, not a comment', (_n, left) => {
    const a = core.analyse(left);
    expect(a.malformedMarkers).toHaveLength(1);
    expect(codes(baseIt(), { ...baseTexts(), left })).toContain('COMPARE_MARKER');
  });

  it.each([
    ['heredoc', 'cat <<EOF\n# @device ghost\nbody\nEOF\n'],
    ['indented heredoc', 'cat <<-EOF\n\t# @device ghost\n\tEOF\n'],
    ['multi-line double quote', 'set banner "line one\n# @device ghost\nend"\n'],
    ['yaml block scalar', 'description: |\n  # @device ghost\n  text\nnext: 1\n'],
  ])('a marker-looking line inside a %s is content, not a device', (_n, body) => {
    const a = core.analyse('# @device real\n' + body);
    expect(a.devices).toEqual(['real']);
    expect(a.ambiguousMarkers).toHaveLength(1);
    expect(codes(baseIt(), { ...baseTexts(), left: '# @device real\n' + body })).toContain('COMPARE_MARKER');
  });

  it('an apostrophe inside a word does not open a quote', () => {
    const a = core.analyse("# @device a\ndescription: it's fine\n# @device b\nx\n");
    expect(a.devices).toEqual(['a', 'b']);
    expect(a.unterminated).toBe(false);
  });

  it('an unterminated heredoc is an error', () => {
    expect(codes(baseIt(), { ...baseTexts(), left: '# @device a\ncat <<EOF\nbody\n' })).toContain('COMPARE_MARKER');
  });

  it('configuration before the first marker belongs to no device and is refused', () => {
    expect(codes(baseIt(), { ...baseTexts(), left: 'stray line\n# @device a\nx\n' })).toContain('COMPARE_DEVICES');
  });
});

describe('fix 3: captured metadata and fairness statements must be meaningful', () => {
  it.each([
    ['whitespace system', 'system', '   '],
    ['object system', 'system', { a: 1 }],
    ['placeholder system', 'system', 'TBD'],
    ['numeric system', 'system', 42],
    ['whitespace version', 'version', '\n\t '],
    ['placeholder version', 'version', 'unknown'],
    ['version without a digit', 'version', 'latest'],
    ['array version', 'version', ['1']],
  ])('rejects captured_from with %s', (_n, key, value) => {
    const { it, texts } = captured();
    it.left.captured_from[key as string] = value;
    expect(codes(it, texts)).toContain('COMPARE_CAPTURED_FROM');
  });

  it('rejects a non-object captured_from', () => {
    const { it, texts } = captured();
    it.left.captured_from = 'SONiC 4.2 on 2026-11-01';
    expect(codes(it, texts)).toContain('COMPARE_CAPTURED_FROM');
  });

  it('whitespace-only baseline or representative_basis no longer clears the length threshold', () => {
    const { it, texts } = captured();
    it.left.baseline = ' '.repeat(20);
    it.left.representative_basis = ' '.repeat(80);
    const c = codes(it, texts);
    expect(c).toContain('COMPARE_BASELINE');
    expect(c).toContain('COMPARE_REPRESENTATIVE');
  });

  it('a placeholder fairness statement is refused even when long enough', () => {
    const { it, texts } = captured();
    it.left.representative_basis = 'TODO fill this in later when we know what to say here';
    it.left.baseline = 'lorem ipsum dolor sit amet';
    const c = codes(it, texts);
    expect(c).toContain('COMPARE_REPRESENTATIVE');
    expect(c).toContain('COMPARE_BASELINE');
  });

  it('hard_way cannot pass with meaningless provenance or fairness text', () => {
    const { it, texts } = captured();
    it.hard_way = true;
    it.left.completeness = 'complete';
    it.left.captured_from = { system: ' ', version: ' ', date: '2026-11-01' };
    it.left.baseline = '          ';
    it.left.representative_basis = ' '.repeat(60);
    expect(codes(it, texts)).toEqual(expect.arrayContaining(['COMPARE_CAPTURED_FROM', 'COMPARE_BASELINE', 'COMPARE_REPRESENTATIVE']));
  });

  it('an illustrative reason or an equivalence outcome of whitespace or a placeholder is refused', () => {
    const it = baseIt();
    it.left.illustrative_reason = 'n/a';
    it.equivalence.outcome = '          ';
    const c = codes(it);
    expect(c).toContain('COMPARE_ILLUSTRATIVE');
    expect(c).toContain('COMPARE_EQUIVALENCE');
  });

  it('a genuine captured instance is still accepted', () => {
    const { it, texts } = captured();
    expect(codes(it, texts)).toEqual([]);
  });
});

describe('fix 4: the strip measures authoring effort, not device involvement', () => {
  const src = readFileSync(COMPARE_JS, 'utf-8');
  it('says "configured by hand" and states that generated configuration is not counted', () => {
    expect(src).toContain('configured by hand');
    expect(src).toMatch(/authoring effort, not device involvement/);
    expect(src).toMatch(/does not mean no device is configured/);
  });
});

describe('fix 5: shared checks reject what the validator rejects', () => {
  it('source_label is checked by the shared rules (builder and renderer)', () => {
    const it = baseIt();
    it.source_label = 'captured';
    expect(codes(it)).toContain('HONESTY_MISMATCH');
    it.source_label = 'live';
    expect(codes(it)).toContain('HONESTY_LABEL');
  });

  it('evidence-plane vocabulary and plane overclaim are checked by the shared rules', () => {
    const it = baseIt();
    it.evidence_plane = 'wire';
    expect(codes(it)).toContain('EVIDENCE_PLANE');
    const o = baseIt();
    o.claims_data_plane = true;
    expect(codes(o)).toContain('PLANE_OVERCLAIM');
  });

  it.each([
    ['fractional', [1.5, 2.5]],
    ['numeric strings', ['1', '2']],
    ['null', [null, 2]],
    ['reversed', [5, 2]],
    ['zero based', [0, 2]],
  ])('step ranges must be integers: %s', (_n, range) => {
    const it = baseIt();
    it.steps[0].left = range;
    expect(codes(it)).toContain('COMPARE_STEP_RANGE');
  });

  it.each([['an object', { a: 1 }], ['a string', 'nope'], ['a number', 5], ['true', true]])('a non-array steps (%s) fails validation instead of throwing', (_n, steps) => {
    const it = baseIt();
    it.steps = steps;
    expect(() => core.checkCompare(it, baseTexts())).not.toThrow();
    expect(codes(it)).toContain('COMPARE_STEPS');
  });

  it('a non-object step entry fails cleanly', () => {
    const it = baseIt();
    it.steps = [null, 'x'];
    expect(() => core.checkCompare(it, baseTexts())).not.toThrow();
    expect(codes(it)).toContain('COMPARE_STEP_RANGE');
  });
});

describe('fix 2: symlinks cannot defeat module confinement', () => {
  let tmp: string;
  let dir: string;
  let outside: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cmp-sym-'));
    dir = join(tmp, 'modules', SLUG);
    cpSync(FIXTURE, dir, { recursive: true });
    outside = join(tmp, 'outside-secret.txt');
    writeFileSync(outside, '# @device leaked\nSECRET-OUTSIDE-CONTENT\n');
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const setSrc = (name: 'left' | 'right', src: string) => {
    const p = join(dir, 'interactives.json');
    const doc = JSON.parse(readFileSync(p, 'utf-8'));
    doc.interactives[0][name].src = src;
    writeFileSync(p, JSON.stringify(doc));
  };
  const replaceWithLink = (rel: string, target: string) => {
    rmSync(join(dir, rel));
    symlinkSync(target, join(dir, rel));
  };
  const validate = () => {
    try {
      return { status: 0, json: JSON.parse(execFileSync('node', ['scripts/validate-authoring.mjs', '--modules-dir', join(tmp, 'modules'), '--json'], { cwd: ROOT, encoding: 'utf-8' })) };
    } catch (e: any) {
      return { status: e.status as number, json: JSON.parse(e.stdout) };
    }
  };
  const build = () => {
    try {
      const out = execFileSync('node', ['scripts/build-compare-payload.mjs', dir, 'tenant-old-vs-new'], { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, out, err: '' };
    } catch (e: any) {
      return { status: e.status as number, out: String(e.stdout), err: String(e.stderr) };
    }
  };

  it('the validator rejects a capture symlinked to a file outside the module', () => {
    replaceWithLink('captures/tenant-sonic.txt', outside);
    const r = validate();
    expect(r.status).toBe(1);
    expect((r.json.report[SLUG] as Json[]).map((i) => i.code)).toContain('COMPARE_SRC_PATH');
  });

  it('the payload builder refuses it and embeds nothing', () => {
    replaceWithLink('captures/tenant-sonic.txt', outside);
    const r = build();
    expect(r.status).toBe(1);
    expect(r.out).not.toContain('SECRET-OUTSIDE-CONTENT');
    expect(r.err).toMatch(/outside the module directory/);
  });

  it('a symlinked directory inside the module that points outside is refused', () => {
    symlinkSync(tmp, join(dir, 'captures-link'));
    setSrc('left', 'captures-link/outside-secret.txt');
    const r = build();
    expect(r.status).toBe(1);
    expect(r.out).not.toContain('SECRET-OUTSIDE-CONTENT');
    expect(r.err).toMatch(/outside the module directory/);
  });

  it('a symlink that stays inside the module is still allowed', () => {
    symlinkSync('tenant-sonic.txt', join(dir, 'captures', 'alias.txt'));
    setSrc('left', 'captures/alias.txt');
    expect(build().status).toBe(0);
  });

  it('a dangling symlink is reported as missing, not followed', () => {
    replaceWithLink('captures/tenant-sonic.txt', join(tmp, 'does-not-exist'));
    const r = build();
    expect(r.status).toBe(1);
    expect(r.err).toMatch(/not found/);
  });
});
