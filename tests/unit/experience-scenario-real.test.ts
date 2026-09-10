/**
 * Real-source acceptance (Phase 5 GREEN, #486): the SHIPPED scenario
 * content/experiences/fabric-operator/scenario.v1.json must validate against the
 * ACTUAL content/modules/**\/README.md sources — synthetic fixtures alone are
 * insufficient (devb). This is the CI gate that guarantees every expert-visible
 * replay line is backed exactly by validated curriculum, dates reconcile, the
 * composite arc is honest, and no stale fabric language ships.
 */
import * as fs from 'fs';
import * as path from 'path';
import { validateScenario } from '../../src/experiences/validate-scenario';

const ROOT = process.cwd();
const SCENARIO = path.join(ROOT, 'content/experiences/fabric-operator/scenario.v1.json');

describe('real Fabric Operator scenario — validated against real content/modules', () => {
  it('passes schema + dual-source anti-drift + fact-lint + continuity', () => {
    const scenario = JSON.parse(fs.readFileSync(SCENARIO, 'utf8'));
    const result = validateScenario(scenario, {
      resolveModule: (slug: string) => path.join(ROOT, 'content/modules', slug, 'README.md'),
    });
    // Surface the exact failures if any, so anti-drift regressions are actionable.
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
