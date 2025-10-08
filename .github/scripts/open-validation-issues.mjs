#!/usr/bin/env node
import fs from 'node:fs';

const product = process.env.PRODUCT;
const version = process.env.VERSION;
const channel = process.env.CHANNEL || 'stable';
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!product || !version) {
  console.error('Missing PRODUCT or VERSION');
  process.exit(1);
}
if (!token) {
  console.error('Missing GH_TOKEN/GITHUB_TOKEN');
  process.exit(1);
}

const cfg = fs.existsSync('.hhl-products.yml') ? fs.readFileSync('.hhl-products.yml', 'utf8') : '';
function parseYaml(y) {
  // tiny YAML -> JSON: only supports a subset sufficient for our file
  const lines = y.split(/\r?\n/);
  const out = {}; const stack = [out]; const indents = [0];
  let path = ['root'];
  function set(obj, key, value) { obj[key] = value; }
  let current = out;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^\s*/)[0].length;
    while (indent < indents[indents.length-1]) { stack.pop(); indents.pop(); current = stack[stack.length-1]; }
    if (/-\s*(.+)/.test(line.trim())) {
      const val = RegExp.$1.trim();
      if (!Array.isArray(current._arr)) current._arr = [];
      current._arr.push(val);
      continue;
    }
    const m = line.trim().match(/^([^:]+):\s*(.*)$/);
    if (m) {
      const key = m[1].trim();
      const rest = m[2];
      if (!rest) {
        const obj = {};
        set(current, key, obj);
        stack.push(obj); indents.push(indent+2); current = obj;
      } else if (rest === '') {
        const obj = {};
        set(current, key, obj);
        stack.push(obj); indents.push(indent+2); current = obj;
      } else {
        set(current, key, rest.replace(/^"|"$/g,''));
      }
    }
  }
  function finalize(node){
    for (const k of Object.keys(node)) if (typeof node[k] === 'object') finalize(node[k]);
    if (node._arr) { const arr = node._arr.map(s=>s.replace(/^"|"$/g,'')); delete node._arr; return arr; }
    return node;
  }
  return finalize(out);
}

const cfgObj = cfg ? parseYaml(cfg) : { products: {} };
const prod = cfgObj.products?.[product];
if (!prod) {
  console.error(`Product '${product}' not defined in .hhl-products.yml`);
  process.exit(1);
}
const modules = prod.modules || [];

async function gh(path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hhl-release-trigger',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${path}: ${t}`);
  }
  return res.json();
}

const [owner, name] = repo.split('/');

for (const slug of modules) {
  const title = `maint: Validate ${slug} for ${product}@${version} (${channel})`;
  const body = `Auto-generated maintenance task.\n\n**Release**\n- Product: ${product}\n- Version: ${version}\n- Channel: ${channel}\n\n**Module**\n- ${slug}\n\n**Outcome**\n- [ ] Run validation steps (scenario steps in front matter)\n- [ ] Open PR bumping \`validated_on\` / \`version\` if all pass\n- [ ] File issues for failures with logs`;
  const labels = ['type/content', 'area/content'];
  await gh(`/repos/${owner}/${name}/issues`, { title, body, labels });
  console.log(`Opened validation issue for ${slug}`);
}

console.log('Done creating validation issues.');

