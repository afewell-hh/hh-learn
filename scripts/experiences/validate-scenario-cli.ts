#!/usr/bin/env ts-node
/**
 * validate-scenario-cli — CI entry point that validates the real Fabric Operator
 * scenario against the real content/modules sources (Epic #478 / #482).
 *
 * Usage: npx ts-node scripts/experiences/validate-scenario-cli.ts [scenarioPath]
 * Exits non-zero (and prints each error) on any anti-drift / schema / fact-lint / continuity failure.
 */
import * as fs from 'fs';
import * as path from 'path';
import { validateScenario } from '../../src/experiences/validate-scenario';

const ROOT = process.cwd();
const scenarioPath =
  process.argv[2] || path.join(ROOT, 'content/experiences/fabric-operator/scenario.v1.json');

const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));

const result = validateScenario(scenario, {
  resolveModule: (slug: string) => path.join(ROOT, 'content/modules', slug, 'README.md'),
});

if (result.ok) {
  console.log(`✓ ${path.relative(ROOT, scenarioPath)} validated against real content/modules sources.`);
  process.exit(0);
} else {
  console.error(`✗ ${path.relative(ROOT, scenarioPath)} failed validation:`);
  for (const e of result.errors) {
    console.error(`  [${e.code}]${e.stepId ? ` (${e.stepId})` : ''} ${e.message}`);
  }
  process.exit(1);
}
