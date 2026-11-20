/**
 * Standalone build of the compare primitive (issue #525).
 *
 * The asset has to work away from HubSpot: openable from disk, servable from localhost,
 * embeddable wherever the team decides it belongs. Two properties carry that, and both are
 * tested here rather than assumed:
 *
 *   1. SELF-CONTAINED. Not one off-box reference survives in the output. An asset that needs
 *      the network is not portable, and one that quietly reaches out is not honest about
 *      collecting nothing.
 *   2. SAME SOURCE OF TRUTH. The payload comes from build-compare-payload.mjs, which refuses
 *      anything failing the shared integrity rules, so a declaration the CMS render would
 *      reject cannot be smuggled out as a standalone file instead.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const FIXTURE = 'docs/examples/authoring-platform/modules/shrink-blast-radius-compare';
const ID = 'tenant-old-vs-new';

function build(dir = FIXTURE, id = ID): { status: number; out: string; err: string } {
  try {
    const out = execFileSync('node', ['scripts/build-compare-standalone.mjs', dir, id], {
      cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out, err: '' };
  } catch (e: any) {
    return { status: e.status ?? 1, out: e.stdout ?? '', err: e.stderr ?? '' };
  }
}

describe('#525 compare — standalone build', () => {
  const built = build();

  it('produces a complete HTML document for the declared interactive', () => {
    expect(built.status).toBe(0);
    expect(built.out).toMatch(/^<!doctype html>/i);
    expect(built.out.trimEnd()).toMatch(/<\/html>$/);
    expect(built.out).toContain('data-hh-compare');
    expect(built.out).toContain(ID);
  });

  it('inlines the same renderer, stylesheet and payload the CMS include uses', () => {
    const js = readFileSync(join(ROOT, 'clean-x-hedgehog-templates/assets/js/compare.js'), 'utf-8');
    const css = readFileSync(join(ROOT, 'clean-x-hedgehog-templates/assets/css/interactive.css'), 'utf-8');
    const payload = execFileSync('node', ['scripts/build-compare-payload.mjs', FIXTURE, ID], {
      cwd: ROOT, encoding: 'utf-8',
    }).trim();
    // Byte-identical, not a reimplementation: the two render targets cannot drift.
    expect(built.out).toContain(js);
    expect(built.out).toContain(css);
    expect(built.out).toContain(payload);
  });

  it('reaches off-box in no way at all', () => {
    const banned: Array<[RegExp, string]> = [
      [/https?:\/\//i, 'absolute URL'],
      [/\bsrc\s*=\s*["']?\/\//i, 'protocol-relative src'],
      [/<link\b/i, '<link> element'],
      [/<script\b[^>]*\bsrc\s*=/i, '<script src>'],
      [/\bfetch\s*\(/i, 'fetch()'],
      [/XMLHttpRequest|navigator\.sendBeacon|EventSource|new\s+WebSocket/i, 'network API'],
      [/@import\b/i, 'CSS @import'],
      [/get_asset_url/i, 'HubL asset helper'],
    ];
    for (const [re, what] of banned) {
      expect({ what, found: re.test(built.out) }).toEqual({ what, found: false });
    }
  });

  it('escapes the payload so it cannot break out of its own script element', () => {
    const inline = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(built.out);
    expect(inline).not.toBeNull();
    expect(inline![1]).not.toContain('<');
    expect(() => JSON.parse(inline![1].replace(/\\u003c/g, '<'))).not.toThrow();
  });

  it('refuses an interactive that does not exist, rather than emitting an empty shell', () => {
    const r = build(FIXTURE, 'no-such-interactive');
    expect(r.status).not.toBe(0);
    expect(r.out).toBe('');
    expect(r.err).toMatch(/no compare interactive/i);
  });

  it('refuses a declaration that fails the shared integrity rules', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'hh-standalone-'));
    const dir = join(tmp, 'mod');
    cpSync(join(ROOT, FIXTURE), dir, { recursive: true });
    const doc = JSON.parse(readFileSync(join(dir, 'interactives.json'), 'utf-8'));
    // Configuration is control-plane evidence; claiming the data plane is the rule that matters most.
    doc.interactives[0].evidence_plane = 'data-plane';
    writeFileSync(join(dir, 'interactives.json'), JSON.stringify(doc, null, 2));
    const r = build(dir, ID);
    expect(r.status).not.toBe(0);
    expect(r.out).toBe('');
    expect(r.err).toMatch(/COMPARE_PLANE/);
  });

  it('carries its own honesty labels, so the asset is readable out of context', () => {
    // A reader meeting this file with no surrounding page must still see what it is.
    expect(built.out).toContain('illustrative');
    expect(built.out).toContain('control-plane');
    expect(built.out).toMatch(/needs JavaScript/i); // no-JS fallback prose is server-rendered
  });
});
