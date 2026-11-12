#!/usr/bin/env node
/**
 * build-compare-standalone.mjs — render a `compare` interactive as ONE self-contained HTML file.
 *
 *   node scripts/build-compare-standalone.mjs <module-dir> <interactive-id> [-o out.html]
 *
 * WHY THIS EXISTS (customer direction, 2026-11-09): the technical asset is the valuable part,
 * and it should not be welded to one placement. The HubL include
 * (clean-x-hedgehog-templates/learn/macros/compare.html) renders this same interactive inside
 * HubSpot. This script renders the same payload, through the same renderer, with no HubSpot and
 * no network -- so the asset can be opened from a file, served from localhost, embedded in a
 * doc or a deck, reviewed without a CMS page, or placed somewhere nobody has thought of yet.
 *
 * ONE SOURCE OF TRUTH. The payload comes from scripts/build-compare-payload.mjs, which refuses
 * to emit anything that fails the shared integrity rules in compare.js. The CSS and the renderer
 * are the same files HubSpot serves. There is no second copy of the look, the rules, or the
 * count derivation, so the standalone build and the CMS build cannot drift apart.
 *
 * SELF-CONTAINED IS ENFORCED, NOT INTENDED. The output is scanned before it is written and the
 * build fails if a single off-box reference survives. An asset that silently needs the network
 * is not portable, and one that phones home is not honest about collecting nothing.
 *
 * Read-only. Reads the module directory and two repo assets; writes one file (or stdout).
 * Uploads nothing, publishes nothing, touches no live page.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPayload } from './build-compare-payload.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(REPO, 'clean-x-hedgehog-templates/assets/css/interactive.css');
const JS = join(REPO, 'clean-x-hedgehog-templates/assets/js/compare.js');

/** Anything that would make the file reach off the box once opened. */
const OFF_BOX = [
  [/https?:\/\//i, 'absolute http(s) URL'],
  [/\bsrc\s*=\s*["']?\/\//i, 'protocol-relative src'],
  [/<link\b/i, '<link> element (stylesheets must be inlined)'],
  [/<script\b[^>]*\bsrc\s*=/i, '<script src> (the renderer must be inlined)'],
  [/\bfetch\s*\(/i, 'fetch() call'],
  [/XMLHttpRequest|navigator\.sendBeacon|EventSource|new\s+WebSocket/i, 'network API'],
  [/@import\b/i, 'CSS @import'],
  [/url\(\s*["']?(?!data:)[^)"']*\/\//i, 'CSS url() pointing off-box'],
];

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Neither inlined block may contain a sequence that closes its own element early. */
function assertInlinable(text, what) {
  const bad = /<\/(script|style)\b/i.exec(text);
  if (bad) throw new Error(`${what} contains "${bad[0]}", which would close its inline element early`);
}

export async function buildStandalone(moduleDir, id) {
  const { interactive, texts } = await buildPayload(moduleDir, id);
  const [css, js] = await Promise.all([readFile(CSS, 'utf-8'), readFile(JS, 'utf-8')]);
  assertInlinable(css, 'interactive.css');
  assertInlinable(js, 'compare.js');

  // `<` is escaped so the payload cannot break out of its own <script> element.
  const payload = JSON.stringify({ interactive, texts }).replace(/</g, '\\u003c');
  const title = interactive.title || id;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!--
  Self-contained render of the "${esc(id)}" compare interactive.
  Built by scripts/build-compare-standalone.mjs from
  ${esc(moduleDir)}/interactives.json and its captures.

  No network of any kind: no stylesheet link, no script src, no fetch, no beacon, no font, no
  image request. Everything shown is in this file. Nothing is recorded and nothing leaves the
  browser. Open it from disk, serve it from localhost, or embed it -- it behaves the same.

  The honesty labels this component renders travel with it, by design: a reader who meets this
  asset with no surrounding context still sees what the material is and what it does not show.
-->
<style>
${css}
/* Standalone frame only. The component's own look is the CSS above, unmodified. */
html { color-scheme: light dark; }
body { margin:0; background:#fff; color:#16202a;
  font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
main { max-width:72rem; margin:0 auto; padding:1.5rem 1rem 3rem; }
@media (prefers-color-scheme: dark) {
  body { background:#12171c; color:#e8eef4; }
}
</style>
</head>
<body>
<main>
  <div class="hh-ix hh-ix-compare" data-hh-compare>
    <p class="hh-ix-caption">This comparison needs JavaScript. It sets the configuration written by hand for each device beside the Hedgehog objects that produce the same outcome.</p>
    <script type="application/json">${payload}</script>
  </div>
</main>
<script>
${js}
</script>
</body>
</html>
`;

  for (const [re, what] of OFF_BOX) {
    const m = re.exec(html);
    if (m) throw new Error(`refusing to write a build that is not self-contained: ${what} (${JSON.stringify(m[0].slice(0, 60))})`);
  }
  return html;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const oi = args.findIndex((a) => a === '-o' || a === '--out');
  const out = oi >= 0 ? args[oi + 1] : null;
  const rest = oi >= 0 ? args.filter((_, k) => k !== oi && k !== oi + 1) : args;
  const [dir, id] = rest;
  if (!dir || !id) {
    console.error('usage: build-compare-standalone.mjs <module-dir> <interactive-id> [-o out.html]');
    process.exit(2);
  }
  buildStandalone(dir, id)
    .then(async (html) => {
      if (out) { await writeFile(out, html, 'utf-8'); console.error(`wrote ${out} (${html.length} bytes, self-contained)`); }
      else process.stdout.write(html);
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
