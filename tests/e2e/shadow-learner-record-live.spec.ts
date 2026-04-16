/**
 * Shadow Learner Record — Live Test Suite (Issue #452, Phase 5B)
 *
 * Layer 2 live shadow acceptance for the learner progress center pages.
 * Real CDN JS, real Lambda, real DynamoDB. Auth via shadow_e2e_test_token.
 *
 * Unavoidable mocks (same as existing shadow-live pattern):
 *   - /auth/me  (token bypass doesn't satisfy the JWT path used by cognitoMe)
 *   - /enrollments/list  (test user not enrolled via CRM)
 *   - HubDB /hs/api/hubdb/v3/tables/*  (no portal session in headless)
 *
 * Committed in skip-until-deployment state until the three publish steps
 * listed in the Phase 5B pre-implementation comment complete:
 *   1. upload:templates for learn-shadow/{courses,pathways,module-progress}.html
 *   2. HubDB dynamic-page bindings for the shadow courses/pathways tables
 *      and for the companion shadow_module_progress_pages table
 *   3. sync:content with the shadow-module-progress extension enabled
 *
 * Once deployed, remove .skip on the describes below.
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://hedgehog.cloud';
const API_BASE = 'https://api.hedgehog.cloud';
const TEST_TOKEN = 'shadow_e2e_test_token';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCREENSHOTS_DIR = path.join(REPO_ROOT, 'verification-output', 'issue-452', 'screenshots');

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

/** Ensure the screenshots dir exists when the suite actually runs. */
function ensureScreenshotsDir() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// ─── Unavoidable mocks ─────────────────────────────────────────
async function mockAuthMe(page: Page) {
  await page.route(/api\.hedgehog\.cloud\/auth\/me/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contactId: 'shadow-reviewer-id',
        email: 'shadow-reviewer@hedgehog.cloud',
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

// NOTE: HubDB mocks are required only for surfaces that fetch HubDB rows
// client-side. The new detail pages consume backend-computed responses;
// they only need HubDB for page-level HubL rendering (server-side, not mocked).

// ─────────────────────────────────────────────────────────────
// 1. Dashboard live render
// ─────────────────────────────────────────────────────────────

test.describe.skip('Dashboard live — requires deployment', () => {
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
    ensureScreenshotsDir();
  });

  test('renders pathway card with real pathway-status counts', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toBeVisible({ timeout: 30000 });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-my-learning-pathway-first.png'),
      fullPage: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Course & pathway detail live render
// ─────────────────────────────────────────────────────────────

test.describe.skip('Detail pages live — requires deployment', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await mockAuthMe(page);
    ensureScreenshotsDir();
  });

  test('course detail renders with live /shadow/course/status', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-title]')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-course-detail-live.png'), fullPage: true });
  });

  test('pathway detail renders with live /shadow/pathway/status', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-title]')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-pathway-detail-live.png'), fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Module learner-record live + sensitive-handling evidence
// ─────────────────────────────────────────────────────────────

test.describe.skip('Module learner-record live — requires deployment', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await mockAuthMe(page);
    ensureScreenshotsDir();
  });

  test('real attempt history renders without leaking correct-answer text', async ({ page }) => {
    let moduleProgressBody = '';
    page.on('response', async (resp) => {
      if (resp.url().includes('/shadow/module/progress')) {
        try { moduleProgressBody = await resp.text(); } catch {}
      }
    });

    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    await expect(page.locator('[data-module-title]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-module-attempt-row]').first().click({ trial: true }).catch(() => {});

    // DOM-level sensitive-handling proof
    const html = await page.content();
    expect(html).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);

    // Network-transcript sensitive-handling proof
    expect(moduleProgressBody).not.toMatch(/"correct_answer"/);
    expect(moduleProgressBody).not.toMatch(/"learner_identity"/);
    expect(moduleProgressBody).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);

    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, '..', 'network-transcripts', `shadow-module-progress-${Date.now()}.json`),
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

test.describe.skip('Parity evidence live — requires deployment', () => {
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
    ensureScreenshotsDir();
  });

  test('dashboard pathway-card counts == course-detail counts for foundations', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toBeVisible({ timeout: 30000 });
    const dashboardText = await page.locator('[data-dashboard-pathway-card]').innerText();

    await page.goto(`${BASE}/learn-shadow/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-title]')).toBeVisible({ timeout: 30000 });
    const courseText = await page.locator('[data-course-progress-label]').innerText();

    // Extract "X of Y" from both surfaces; they must agree.
    const m1 = dashboardText.match(/(\d+)\s*of\s*(\d+)/i);
    const m2 = courseText.match(/(\d+)\s*of\s*(\d+)/i);
    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();
    expect(m1![1]).toBe(m2![1]);
    expect(m1![2]).toBe(m2![2]);
  });
});
