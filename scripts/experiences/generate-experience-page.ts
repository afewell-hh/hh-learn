#!/usr/bin/env ts-node
/**
 * generate-experience-page — inject the safely-serialized scenario JSON island into the
 * CMS template clean-x-hedgehog-templates/learn/experience/fabric-operator.html between the
 * HHL_SCENARIO_ISLAND markers (Epic #478 / #484).
 *
 * HubL cannot read/serialize JSON at render time (Issue #327), so the island content is
 * produced at build time with serializeIsland() — the same helper the unit tests pin — and
 * committed into the template. The player reads the island via textContent + JSON.parse
 * (no fetch, no CORS, no backend).
 *
 * Usage: npx ts-node scripts/experiences/generate-experience-page.ts [--check]
 */
import * as fs from 'fs';
import * as path from 'path';
import { serializeIsland } from '../../src/experiences/serialize-island';

const ROOT = process.cwd();
const SCENARIO = path.join(ROOT, 'content/experiences/fabric-operator/scenario.v1.json');
const TEMPLATE = path.join(ROOT, 'clean-x-hedgehog-templates/learn/experience/fabric-operator.html');

const START = '<!-- HHL_SCENARIO_ISLAND:START -->';
const END = '<!-- HHL_SCENARIO_ISLAND:END -->';

function inject(templateText: string, islandBody: string): string {
  const startIdx = templateText.indexOf(START);
  const endIdx = templateText.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error('HHL_SCENARIO_ISLAND markers not found in template');
  }
  // Preserve the indentation of the START marker line.
  const lineStart = templateText.lastIndexOf('\n', startIdx) + 1;
  const indent = templateText.slice(lineStart, startIdx);
  const block =
    `${START}\n` +
    `${indent}<script type="application/json" id="hhl-exp-scenario">${islandBody}</script>\n` +
    `${indent}${END}`;
  return templateText.slice(0, startIdx) + block + templateText.slice(endIdx + END.length);
}

function main(): void {
  const scenario = JSON.parse(fs.readFileSync(SCENARIO, 'utf8'));
  const islandBody = serializeIsland(scenario);
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const updated = inject(template, islandBody);

  if (process.argv.includes('--check')) {
    if (template !== updated) {
      console.error('✗ fabric-operator.html island is out of date. Run: npm run generate:page');
      process.exit(1);
    }
    console.log('✓ fabric-operator.html island matches the current scenario (reproducible).');
    return;
  }
  fs.writeFileSync(TEMPLATE, updated, 'utf8');
  console.log(`✓ injected scenario island into ${path.relative(ROOT, TEMPLATE)} (${islandBody.length} bytes)`);
}

main();
