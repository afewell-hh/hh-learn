/**
 * Shadow Live Test Suite — Issue #424, Layer 2
 *
 * Layer 2: Real live-shadow acceptance.
 * Module detail page tests (foundations-recap, welcome, vpc-provisioning) run with
 * ZERO mocks: real CDN JS, real Lambda, real DynamoDB. Auth via shadow_e2e_test_token
 * test bypass (accepted by /tasks/* and /admin/* via verifyCookieAuth() in Lambda).
 *
 * ─── UNAVOIDABLE MOCKS (My Learning only) ──────────────────────────────────
 *
 * MOCK 1: GET /auth/me
 *   Target:  /api\.hedgehog\.cloud\/auth\/me/
 *   Why:     Lambda cognitoMe() calls verifyJWT() with real Cognito JWKS validation.
 *            shadow_e2e_test_token is accepted ONLY by verifyCookieAuth() — used by
 *            /tasks/* and /admin/*. /auth/me does NOT call verifyCookieAuth() → 401 →
 *            shadow-my-learning.js receives empty identity and exits before the
 *            enrollment call. Changing Lambda routing is out of scope; this mock is
 *            permanently unavoidable for headless tests.
 *   What remains unproven:
 *            Real Cognito JWT auth flow (covered by the 'e2e' Playwright project).
 *
 * MOCK 2: GET /enrollments/list
 *   Target:  /api\.hedgehog\.cloud\/enrollments\/list/
 *   Why:     Test user (shadow-reviewer@hedgehog.cloud) is not enrolled in any course
 *            in the CRM. Real call returns empty enrollments → no course card rendered →
 *            nothing to verify in My Learning.
 *   What remains unproven:
 *            Real enrollment data shape from CRM. Mock shape matches production contract.
 *
 * MOCK 3: GET /hs/api/hubdb/v3/tables/.../rows
 *   Target:  /hubdb\/v3\/tables\/135381433\/rows/ (course table)
 *            /hubdb\/v3\/tables\/135621904\/rows/ (module completion_tasks table)
 *   Why:     HubDB API (/hs/api/hubdb/v3/) returns HTTP 404 outside a real HubSpot
 *            portal browser session. The endpoint requires HubSpot tracking cookies
 *            (__hstc, hubspotutk) set by visiting the portal. Not available in headless
 *            context and cannot be replicated with test bypass token.
 *   What remains unproven:
 *            Real HubDB row structure. Mock shape verified against sync:content output.
 *
 * ─── CDN ASSET VERIFICATION ────────────────────────────────────────────────
 * Section 1 captures the actual live CDN URL from a real page load and fetches it
 * directly. This is direct evidence that the deployed JS files contain the fixes,
 * independent of whether JS interception is active.
 *
 * ─── SCREENSHOTS ───────────────────────────────────────────────────────────
 * 6 screenshots saved to verification-output/issue-424/screenshots/:
 *   01-foundations-recap-neutral.png — neutral note visible, no legacy buttons
 *   02-welcome-quiz-visible.png      — interactive quiz section rendered from CDN JS
 *   03-welcome-quiz-fail.png         — fail feedback + retake button (real Lambda response)
 *   04-welcome-quiz-pass.png         — quiz passed badge (real Lambda grade)
 *   05-welcome-module-complete.png   — module complete banner after real lab attest
 *   06-my-learning-module-list.png   — task pills visible, module list open by default
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────
// Screenshot output directory
// ─────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCREENSHOTS_DIR = path.join(REPO_ROOT, 'verification-output', 'issue-424', 'screenshots');

// Ensure screenshots directory exists at module load time (sync, idempotent)
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const BASE = 'https://hedgehog.cloud';
const API_BASE = 'https://api.hedgehog.cloud/shadow';
const TEST_TOKEN = 'shadow_e2e_test_token';

const TEST_COOKIE = {
  name: 'hhl_access_token',
  value: TEST_TOKEN,
  domain: 'api.hedgehog.cloud',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict' as const,
};

const WRONG_ANSWERS: Record<string, string> = { q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'a' };
const RIGHT_ANSWERS: Record<string, string> = { q1: 'b', q2: 'b', q3: 'b', q4: 'b', q5: 'c' };

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────

async function setAuthCookie(ctx: BrowserContext) {
  await ctx.addCookies([TEST_COOKIE]);
}

async function resetModule(slug: string) {
  const ctx = await playwrightRequest.newContext();
  const resp = await ctx.post(`${API_BASE}/admin/test/reset`, {
    data: { module_slug: slug },
    headers: { Cookie: `hhl_access_token=${TEST_TOKEN}` },
  });
  const data = await resp.json();
  await ctx.dispose();
  return data;
}

async function submitQuizApi(moduleSlug: string, answers: Record<string, string>) {
  const ctx = await playwrightRequest.newContext();
  const answersArray = Object.entries(answers).map(([id, value]) => ({ id, value }));
  const resp = await ctx.post(`${API_BASE}/tasks/quiz/submit`, {
    data: { module_slug: moduleSlug, quiz_ref: 'quiz-1', answers: answersArray },
    headers: { Cookie: `hhl_access_token=${TEST_TOKEN}` },
  });
  const data = await resp.json();
  await ctx.dispose();
  return data;
}

async function attestLabApi(moduleSlug: string) {
  const ctx = await playwrightRequest.newContext();
  const resp = await ctx.post(`${API_BASE}/tasks/lab/attest`, {
    data: { module_slug: moduleSlug, task_slug: 'lab-main' },
    headers: { Cookie: `hhl_access_token=${TEST_TOKEN}` },
  });
  const data = await resp.json();
  await ctx.dispose();
  return data;
}

async function fillQuiz(page: Page, answers: Record<string, string>) {
  for (const [qId, optId] of Object.entries(answers)) {
    const radio = page.locator(`input[name="${qId}"][value="${optId}"]`);
    await expect(radio).toBeVisible({ timeout: 10000 });
    await radio.check();
  }
}

// ─────────────────────────────────────────────────────────────
// 1. CDN Asset Verification
//    No browser mocks — fetches real CDN URLs captured from live page loads.
// ─────────────────────────────────────────────────────────────
test.describe('CDN Asset Verification', () => {
  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context);
  });

  test('shadow-completion.js CDN copy contains hhl-no-task-note fix', async ({ page }) => {
    // Capture the actual CDN URL by listening to requests on a live page load.
    const completionUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('shadow-completion')) completionUrls.push(req.url());
    });

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    await page.waitForTimeout(5000);

    const cdnUrl = completionUrls[0];
    expect(cdnUrl, 'shadow-completion.js must be requested from CDN').toBeTruthy();

    // Fetch the actual CDN content and verify the no-task-note fix is present
    const resp = await page.request.get(cdnUrl);
    expect(resp.status()).toBe(200);
    const body = await resp.text();

    expect(body, 'CDN shadow-completion.js must contain hhl-no-task-note').toContain('hhl-no-task-note');
    expect(body, 'CDN shadow-completion.js must contain "No required tasks" text').toContain('No required tasks');
    // Verify the legacy button fix is also present
    expect(body, 'CDN shadow-completion.js must always hide legacy buttons').not.toContain('if (quizSection || labSection)');
  });

  test('shadow-my-learning.js CDN copy contains details[open] fix', async ({ page }) => {
    // Capture the actual CDN URL by listening to requests on a live page load.
    const myLearningUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('shadow-my-learning')) myLearningUrls.push(req.url());
    });

    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await page.waitForTimeout(5000);

    const cdnUrl = myLearningUrls[0];
    expect(cdnUrl, 'shadow-my-learning.js must be requested from CDN').toBeTruthy();

    // Fetch the actual CDN content and verify the details[open] fix is present
    const resp = await page.request.get(cdnUrl);
    expect(resp.status()).toBe(200);
    const body = await resp.text();

    expect(body, 'CDN shadow-my-learning.js must contain details[open] fix').toContain('enrollment-modules-toggle" open>');
    expect(body, 'CDN shadow-my-learning.js must use "Modules (N)" label').toContain('Modules (');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. foundations-recap — no-task neutral state [LIVE — zero mocks]
//    Real CDN shadow-completion.js must hide legacy buttons and inject no-task note.
// ─────────────────────────────────────────────────────────────
test.describe('foundations-recap — no-task neutral state [LIVE — zero mocks]', () => {
  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context);
  });

  test('legacy Mark Complete button is hidden (not visible)', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    // Wait for shadow-completion.js to execute
    await page.waitForTimeout(3000);
    const isVisible = await page.locator('#hhl-mark-complete').isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('legacy Mark Started button is hidden (not visible)', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    await page.waitForTimeout(3000);
    const isVisible = await page.locator('#hhl-mark-started').isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('no action-runner navigation on page load', async ({ page }) => {
    let actionRunnerNavigated = false;
    page.on('framenavigated', (frame) => {
      if (frame.url().includes('action-runner')) actionRunnerNavigated = true;
    });
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    await page.waitForTimeout(4000);
    expect(actionRunnerNavigated).toBe(false);
  });

  test('neutral no-task note is visible — screenshot 01', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    // Real CDN shadow-completion.js injects #hhl-no-task-note for no-task modules
    const note = page.locator('#hhl-no-task-note');
    await expect(note).toBeVisible({ timeout: 15000 });
    const noteText = await note.textContent();
    expect(noteText).toMatch(/no required tasks/i);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-foundations-recap-neutral.png'),
      fullPage: false,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 3. fabric-operations-welcome — quiz + lab [LIVE — zero mocks]
//    All API calls (quiz/submit, lab/attest, tasks/status) hit real Lambda + DynamoDB.
// ─────────────────────────────────────────────────────────────
test.describe('fabric-operations-welcome [LIVE — zero mocks]', () => {
  test.beforeAll(async () => {
    await resetModule('fabric-operations-welcome');
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context);
  });

  test('interactive quiz section is visible — screenshot 02', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    // Quiz section rendered by HubSpot template; shadow-completion.js binds handlers
    await expect(page.locator('#hhl-quiz-section')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.hhl-quiz-question')).toHaveCount(5, { timeout: 10000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-welcome-quiz-visible.png'),
      fullPage: false,
    });
  });

  test('no correct_answer leakage in page HTML', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    const html = await page.content();
    expect(html).not.toContain('"correct_answer"');
    expect(html).not.toContain('correct_answer');
  });

  test('wrong quiz submission → fail feedback + retake — screenshot 03', async ({ page }) => {
    await resetModule('fabric-operations-welcome');
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-quiz-section')).toBeVisible({ timeout: 15000 });

    await fillQuiz(page, WRONG_ANSWERS);
    await page.locator('#hhl-quiz-submit').click();

    // Real Lambda grades the quiz and returns pass:false
    await expect(page.locator('#hhl-quiz-feedback')).toBeVisible({ timeout: 20000 });
    const feedbackText = await page.locator('#hhl-quiz-feedback').textContent();
    expect(feedbackText).toMatch(/need.*pass|score:|retake/i);
    // showQuizFailed() renders a Retake Quiz button
    await expect(page.locator('#hhl-quiz-retake')).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-welcome-quiz-fail.png'),
      fullPage: false,
    });
  });

  test('correct quiz → pass badge; lab attest → module complete — screenshots 04 + 05', async ({ page }) => {
    await resetModule('fabric-operations-welcome');
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-quiz-section')).toBeVisible({ timeout: 15000 });

    // Submit correct answers — real Lambda grades and returns pass:true
    await fillQuiz(page, RIGHT_ANSWERS);
    await page.locator('#hhl-quiz-submit').click();

    await expect(page.locator('#hhl-quiz-feedback')).toBeVisible({ timeout: 20000 });
    const quizFeedback = await page.locator('#hhl-quiz-feedback').textContent();
    expect(quizFeedback).toMatch(/pass|passed/i);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-welcome-quiz-pass.png'),
      fullPage: false,
    });

    // Attest lab — real Lambda records lab-main attested
    const labBtn = page.locator('#hhl-lab-attest-btn');
    await expect(labBtn).toBeVisible({ timeout: 10000 });
    await labBtn.click();

    // Module complete banner appears when both tasks done
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-welcome-module-complete.png'),
      fullPage: false,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// 4. fabric-operations-vpc-provisioning — lab-only [LIVE — zero mocks]
// ─────────────────────────────────────────────────────────────
test.describe('fabric-operations-vpc-provisioning [LIVE — zero mocks]', () => {
  test.beforeAll(async () => {
    await resetModule('fabric-operations-vpc-provisioning');
  });

  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context);
  });

  test('lab attestation UI is visible', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    await expect(page.locator('#hhl-lab-section')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#hhl-lab-attest-btn')).toBeVisible({ timeout: 10000 });
  });

  test('lab attestation marks module complete', async ({ page }) => {
    await resetModule('fabric-operations-vpc-provisioning');
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    await expect(page.locator('#hhl-lab-attest-btn')).toBeVisible({ timeout: 15000 });

    await page.locator('#hhl-lab-attest-btn').click();

    await expect(page.locator('#hhl-lab-feedback')).toBeVisible({ timeout: 15000 });
    const labFeedback = await page.locator('#hhl-lab-feedback').textContent();
    expect(labFeedback).toMatch(/complete|lab.*done|attested/i);

    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 5. /learn-shadow/my-learning [LIVE — 3 unavoidable mocks]
//    Mocks: /auth/me (MOCK 1), /enrollments/list (MOCK 2), HubDB tables (MOCK 3).
//    All task status calls (/tasks/status/batch) hit real Lambda + DynamoDB.
// ─────────────────────────────────────────────────────────────
test.describe('My Learning [LIVE — 3 unavoidable mocks]', () => {
  const ENROLLED_COURSE_SLUG = 'network-like-hyperscaler-foundations';

  test.beforeAll(async () => {
    // Set up known live state: welcome complete, so progress counter shows ≥1
    await resetModule('fabric-operations-welcome');
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);
    await attestLabApi('fabric-operations-welcome');
  });

  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);

    // MOCK 1: /auth/me — verifyCookieAuth() not called by cognitoMe(); test token → 401
    // → empty identity → shadow-my-learning.js exits before enrollment call. Unavoidable.
    await page.route(/api\.hedgehog\.cloud\/auth\/me/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email: 'shadow-reviewer@hedgehog.cloud',
          userId: 'shadow-test-user',
          hubspotContactId: '',
          displayName: 'Shadow Reviewer',
          givenName: 'Shadow',
          familyName: 'Reviewer',
        }),
      });
    });

    // MOCK 2: /enrollments/list — test user not enrolled in CRM → empty response → no
    // course cards rendered. Unavoidable for this test identity.
    await page.route(/api\.hedgehog\.cloud\/enrollments\/list/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'authenticated',
          enrollments: {
            courses: [
              { slug: ENROLLED_COURSE_SLUG, enrolled_at: '2026-04-13T00:00:00.000Z' },
            ],
          },
        }),
      });
    });

    // MOCK 3a: HubDB course table — returns 404 outside HubSpot portal session; mock
    // provides module slug list. Shape matches sync:content output.
    await page.route(/hubdb\/v3\/tables\/135381433\/rows/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            values: {
              module_slugs_json: JSON.stringify([
                'fabric-operations-welcome',
                'fabric-operations-how-it-works',
                'fabric-operations-mastering-interfaces',
                'fabric-operations-foundations-recap',
              ]),
            },
          }],
        }),
      });
    });

    // MOCK 3b: HubDB module table — provides completion_tasks_json per module.
    // Shape matches sync:content output and production HubDB rows.
    const TASKS_QUIZ_LAB = JSON.stringify([
      { task_slug: 'quiz-1', task_type: 'quiz', graded: true, required: true },
      { task_slug: 'lab-main', task_type: 'lab_attestation', graded: false, required: true },
    ]);
    const TASKS_NO_REQUIRED = JSON.stringify([
      { task_slug: 'knowledge-check-1', task_type: 'knowledge_check', graded: false, required: false },
    ]);
    await page.route(/hubdb\/v3\/tables\/135621904\/rows/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { values: { hs_path: 'fabric-operations-welcome', hs_name: 'Welcome to Fabric Operations', completion_tasks_json: TASKS_QUIZ_LAB } },
            { values: { hs_path: 'fabric-operations-how-it-works', hs_name: 'How Hedgehog Works', completion_tasks_json: TASKS_QUIZ_LAB } },
            { values: { hs_path: 'fabric-operations-mastering-interfaces', hs_name: 'Mastering the Three Interfaces', completion_tasks_json: TASKS_QUIZ_LAB } },
            { values: { hs_path: 'fabric-operations-foundations-recap', hs_name: 'Foundations Recap', completion_tasks_json: TASKS_NO_REQUIRED } },
          ],
        }),
      });
    });
  });

  test('module list is visible without requiring user interaction — screenshot 06', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // details[open] fix: module list must be visible without clicking the accordion
    const moduleList = page.locator('.enrollment-modules-list');
    await expect(moduleList).toBeVisible({ timeout: 20000 });

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-my-learning-module-list.png'),
      fullPage: false,
    });
  });

  test('task pills visible — real /tasks/status/batch response', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // Task breakdowns load from REAL /tasks/status/batch Lambda call (not mocked)
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });
    const pills = page.locator('.shadow-task-pill');
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
  });

  test('welcome shows quiz passed + lab completed pills', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });

    // These pills are populated from REAL /tasks/status/batch response
    const quizPassedPill = page.locator('.task-pill-passed').filter({ hasText: /quiz.*passed/i });
    const labCompletedPill = page.locator('.task-pill-attested').filter({ hasText: /lab.*completed/i });

    await expect(quizPassedPill).toBeVisible({ timeout: 10000 });
    await expect(labCompletedPill).toBeVisible({ timeout: 10000 });
  });

  test('foundations-recap shows No required tasks pill', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });

    const noTaskPill = page.locator('.task-pill-no-tasks').filter({ hasText: /no required tasks/i });
    await expect(noTaskPill).toBeVisible({ timeout: 10000 });
  });

  test('progress counter is ≥1 after welcome completion', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.enrollment-card')).toBeVisible({ timeout: 20000 });

    const progressLabel = page.locator('.enrollment-progress-label');
    await expect(progressLabel).toBeVisible({ timeout: 10000 });
    const labelText = await progressLabel.first().textContent();
    // Must show "N of M" format (welcome is complete → N ≥ 1)
    expect(labelText).toMatch(/\d+ of \d+/);
    const match = labelText?.match(/(\d+) of/);
    const completed = match ? parseInt(match[1]) : 0;
    expect(completed, 'progress counter must be ≥1 after welcome completion').toBeGreaterThanOrEqual(1);
  });
});
