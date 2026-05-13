/**
 * Production Learner Record — Live Test Suite (Issue #459, Phase 5B)
 *
 * Layer 2 live production acceptance for the /learn parity slice. Real CDN
 * JS, real Lambda (bare production HttpApi j1bxg3z9rf per #460), real
 * DynamoDB.
 *
 * Unavoidable mocks (mirror shadow-live pattern):
 *   - /auth/me  (test bypass cookies don't satisfy the JWT path used by
 *     cognitoMe; real Cognito login is out of scope for headless layer 2)
 *   - /enrollments/list  (test user not enrolled via CRM)
 *
 * Committed in skip-until-deployment state. Two prerequisites must be met
 * before un-skipping:
 *   1. Templates uploaded + pages published in HubSpot:
 *      - clean-x-hedgehog-templates/learn/courses-page.html        (modify)
 *      - clean-x-hedgehog-templates/learn/pathways-page.html       (modify)
 *      - clean-x-hedgehog-templates/learn/module-page.html         (modify)
 *      - clean-x-hedgehog-templates/learn/my-learning.html         (unchanged
 *        DOM; only the JS module behind production-my-learning.js changes)
 *      - clean-x-hedgehog-templates/learn/module-progress.html     (new)
 *      - new STATIC page registered at /learn/module-progress via
 *        scripts/hubspot/provision-pages.ts
 *   2. A production-equivalent e2e test-auth mechanism is available — either
 *      a permanent e2e bypass token (the production-side of #461) or a real
 *      Cognito-issued cookie persisted into tests/e2e/.auth/user.json. Until
 *      then, calls to /pathway/status, /course/status, and /module/progress
 *      return 401 from the bare production handler and the surfaces render
 *      their error/empty states instead of populated data.
 *
 * Once both prerequisites are met, remove .skip from the describes below
 * and re-run the suite. Screenshots and network transcripts land in
 * verification-output/issue-459/.
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://hedgehog.cloud';
const API_BASE = 'https://api.hedgehog.cloud';
const TEST_TOKEN = 'production_e2e_test_token';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCREENSHOTS_DIR = path.join(REPO_ROOT, 'verification-output', 'issue-459', 'screenshots');
const TRANSCRIPTS_DIR = path.join(REPO_ROOT, 'verification-output', 'issue-459', 'network-transcripts');

const TEST_COOKIE = {
  name: 'hhl_access_token',
  value: TEST_TOKEN,
  domain: 'api.hedgehog.cloud',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict' as const,
};

const PATHWAY_SLUG = 'network-like-hyperscaler';
const COURSE_SLUG = 'network-like-hyperscaler-foundations';
const MODULE_SLUG = 'fabric-operations-welcome';
const KNOWN_CORRECT_ANSWER_TEXT = 'kubectl get switch';

async function setAuthCookie(ctx: BrowserContext) {
  await ctx.addCookies([TEST_COOKIE]);
}

function ensureDirs() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

// ─── Unavoidable mocks ─────────────────────────────────────────
async function mockAuthMe(page: Page) {
  await page.route(/api\.hedgehog\.cloud\/auth\/me/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contactId: 'production-reviewer-id',
        email: 'production-reviewer@hedgehog.cloud',
      }),
    });
  });
}

async function mockEnrollments(page: Page, shape: any) {
  await page.route(/api\.hedgehog\.cloud\/enrollments\/list/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(shape),
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 1. Dashboard live render — server-authoritative cards
// ─────────────────────────────────────────────────────────────

test.describe.skip('Production dashboard live — requires deployment', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await mockAuthMe(page);
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: {
        pathways: [{ slug: PATHWAY_SLUG, enrolled_at: '2026-04-01T00:00:00.000Z' }],
        courses: [],
      },
    });
    ensureDirs();
  });

  test('renders pathway card with real /pathway/status counts', async ({ page }) => {
    await page.goto(`${BASE}/learn/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toBeVisible({ timeout: 30000 });
    // Production invariant — no shadow banner on the production page even live.
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-my-learning-pathway-first.png'),
      fullPage: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Course & pathway detail live render
// ─────────────────────────────────────────────────────────────

test.describe.skip('Production detail pages live — requires deployment', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await mockAuthMe(page);
    ensureDirs();
  });

  test('course detail renders additively with live /course/status', async ({ page }) => {
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    // The new mount must populate alongside the existing enrollment CTA.
    await expect(page.locator('[data-course-title]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#hhl-enrollment-cta')).toBeVisible();
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-course-detail-live.png'), fullPage: true });
  });

  test('pathway detail renders additively with live /pathway/status', async ({ page }) => {
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-title]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#hhl-enrollment-cta')).toBeVisible();
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-pathway-detail-live.png'), fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Module learner-record live + sensitive-handling evidence
// ─────────────────────────────────────────────────────────────

test.describe.skip('Production module learner-record live — requires deployment', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await mockAuthMe(page);
    ensureDirs();
  });

  test('real attempt history renders without leaking correct-answer text', async ({ page }) => {
    let moduleProgressBody = '';
    page.on('response', async (resp) => {
      // Production endpoint is bare — no /shadow/ prefix.
      if (/api\.hedgehog\.cloud\/module\/progress/.test(resp.url())) {
        try { moduleProgressBody = await resp.text(); } catch {}
      }
    });

    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('[data-module-title]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-module-attempt-row]').first().click({ trial: true }).catch(() => {});

    // DOM-level sensitive-handling proof
    const html = await page.content();
    expect(html).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);

    // Network-transcript sensitive-handling proof
    expect(moduleProgressBody).not.toMatch(/"correct_answer"/);
    expect(moduleProgressBody).not.toMatch(/"learner_identity"/);
    expect(moduleProgressBody).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);

    // Production page must not be marked noindex.
    const robots = await page.locator('meta[name="robots"]').count();
    if (robots > 0) {
      const content = await page.locator('meta[name="robots"]').first().getAttribute('content');
      expect(content || '').not.toMatch(/noindex/i);
    }
    // No shadow banner under /learn/*.
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);

    fs.writeFileSync(
      path.join(TRANSCRIPTS_DIR, `production-module-progress-${Date.now()}.json`),
      moduleProgressBody || '{}'
    );

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-answer-review-live.png'),
      fullPage: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Parity evidence (dashboard counts vs course-detail counts, live)
// ─────────────────────────────────────────────────────────────

test.describe.skip('Production parity evidence live — requires deployment', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await mockAuthMe(page);
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: {
        pathways: [{ slug: PATHWAY_SLUG }],
        courses: [],
      },
    });
    ensureDirs();
  });

  test('dashboard pathway-card counts == course-detail counts for foundations', async ({ page }) => {
    await page.goto(`${BASE}/learn/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toBeVisible({ timeout: 30000 });
    const dashboardText = await page.locator('[data-dashboard-pathway-card]').innerText();

    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-title]')).toBeVisible({ timeout: 30000 });
    const courseText = await page.locator('[data-course-progress-label]').innerText();

    const m1 = dashboardText.match(/(\d+)\s*of\s*(\d+)/i);
    const m2 = courseText.match(/(\d+)\s*of\s*(\d+)/i);
    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();
    expect(m1![1]).toBe(m2![1]);
    expect(m1![2]).toBe(m2![2]);
  });
});
