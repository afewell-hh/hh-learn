/**
 * /admin/test/reset 403-in-production smoke (Issue #458, Phase 5A — L4)
 *
 * Defense-in-depth gate: hits real https://api.hedgehog.cloud/admin/test/reset
 * and asserts that production refuses the operation regardless of who calls it.
 *
 * Three distinct probes catch three distinct failure modes:
 *   - dropping the stage gate           → no-auth probe still 403
 *   - allowing bypass via Cookie alone  → cookie probe still 403
 *   - 403 from the wrong reason         → body-shape probe forces the 403 to be
 *                                         the stage gate, not an upstream block
 *
 * Implementation reference: src/api/lambda/admin-test-reset.ts:200-205
 *   if (process.env.APP_STAGE !== 'shadow') {
 *     return jsonResp(403, { error: 'Not available in this environment' }, origin);
 *   }
 *
 * Test plan source: Issue #457 §"`/admin/test/reset` 403-in-production smoke (L4)".
 */
import { test, expect } from '@playwright/test';

const PROD_RESET_URL = 'https://api.hedgehog.cloud/admin/test/reset';
const STAGE_GATE_BODY_PATTERN = /not available in this environment/i;

test.describe('Production /admin/test/reset hard block (smoke)', () => {
  test('POST /admin/test/reset on production returns 403 (no auth)', async ({ request }) => {
    const resp = await request.post(PROD_RESET_URL);
    expect(resp.status()).toBe(403);
  });

  test('POST /admin/test/reset on production returns 403 (with shadow_e2e_test_token cookie)', async ({ request }) => {
    const resp = await request.post(PROD_RESET_URL, {
      headers: { Cookie: 'hhl_access_token=shadow_e2e_test_token' },
    });
    expect(resp.status()).toBe(403);
  });

  test('response body says "Not available in this environment" (proves stage gate, not auth gate)', async ({ request }) => {
    const resp = await request.post(PROD_RESET_URL);
    const body = await resp.json().catch(() => ({} as { error?: string }));
    expect(body.error).toMatch(STAGE_GATE_BODY_PATTERN);
  });
});
