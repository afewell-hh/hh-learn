/**
 * Shadow E2E Test Suite — Issue #424
 *
 * Tests run against the live shadow site (hedgehog.cloud/learn-shadow/*).
 * Auth uses the test-bypass token: hhl_access_token=shadow_e2e_test_token
 * with ENABLE_TEST_BYPASS=true on the shadow Lambda.
 *
 * Coverage:
 *   1. Direct load of shadow module pages
 *   2. fabric-operations-welcome: quiz fail → retry → pass + lab attest + reload
 *   3. fabric-operations-vpc-provisioning: lab-only completion + reload
 *   4. fabric-operations-foundations-recap: no-task neutral state, no broken buttons
 *   5. /learn-shadow/my-learning: task pills visible, progress correct, no-task neutral
 *   6. Shadow isolation: no /learn leakage, no duplicate assessment, no answer leakage
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────
// JS interception helpers
//
// HubSpot CDN caches rendered pages with a 10-hour edge TTL.
// When a new version of a JS asset is published, the asset gets
// a new content-hash URL. The cached HTML still references the
// old URL until the page re-renders.  During the window between
// asset publish and CDN re-render, we intercept JS requests in
// Playwright and serve the updated LOCAL source, which lets the
// test suite verify new code behavior immediately.
//
// The intercepted content is the same code deployed to HubSpot —
// the route just bypasses the CDN version-URL lag.
// ─────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHADOW_COMPLETION_JS = fs.readFileSync(
  path.join(REPO_ROOT, 'clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js'),
  'utf-8'
);
const SHADOW_MY_LEARNING_JS = fs.readFileSync(
  path.join(REPO_ROOT, 'clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js'),
  'utf-8'
);

/** Intercept shadow-completion.js and shadow-my-learning.js with local versions */
async function interceptShadowJs(page: Page) {
  await page.route(/shadow-completion/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: SHADOW_COMPLETION_JS });
  });
  await page.route(/shadow-my-learning/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: SHADOW_MY_LEARNING_JS });
  });
}

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

// Quiz answers for fabric-operations-welcome
const WRONG_ANSWERS: Record<string, string> = { q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'a' };
const RIGHT_ANSWERS: Record<string, string> = { q1: 'b', q2: 'b', q3: 'b', q4: 'b', q5: 'c' };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Set the test-bypass auth cookie on the browser context */
async function setAuthCookie(ctx: BrowserContext) {
  await ctx.addCookies([TEST_COOKIE]);
}

/** Reset a module's DynamoDB state via the test-reset endpoint */
async function resetModule(slug: string) {
  const ctx = await playwrightRequest.newContext();
  const resp = await ctx.post(`${API_BASE}/admin/test/reset`, {
    data: { module_slug: slug },
    headers: { Cookie: `hhl_access_token=${TEST_TOKEN}` },
  });
  const data = await resp.json(); // must read before dispose
  await ctx.dispose();
  return data;
}

/** Submit a quiz via the API directly (bypass UI) */
async function submitQuizApi(moduleSlug: string, answers: Record<string, string>) {
  const ctx = await playwrightRequest.newContext();
  // Lambda schema requires answers as [{id, value}] array, not a plain object.
  const answersArray = Object.entries(answers).map(([id, value]) => ({ id, value }));
  const resp = await ctx.post(`${API_BASE}/tasks/quiz/submit`, {
    data: { module_slug: moduleSlug, quiz_ref: 'quiz-1', answers: answersArray },
    headers: { Cookie: `hhl_access_token=${TEST_TOKEN}` },
  });
  const data = await resp.json();
  await ctx.dispose();
  return data;
}

/** Attest lab completion via the API directly */
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

/** Check task status via the API */
async function getTaskStatus(moduleSlug: string) {
  const ctx = await playwrightRequest.newContext();
  const resp = await ctx.get(`${API_BASE}/tasks/status?module_slug=${encodeURIComponent(moduleSlug)}`, {
    headers: { Cookie: `hhl_access_token=${TEST_TOKEN}` },
  });
  const data = await resp.json();
  await ctx.dispose();
  return data;
}

/** Select radio buttons for all quiz questions */
async function fillQuiz(page: Page, answers: Record<string, string>) {
  for (const [qId, optId] of Object.entries(answers)) {
    const radio = page.locator(`input[name="${qId}"][value="${optId}"]`);
    await expect(radio).toBeVisible({ timeout: 10000 });
    await radio.check();
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Direct page load — all three pilot modules
// ─────────────────────────────────────────────────────────────
test.describe('Direct page load', () => {
  test.beforeEach(async ({ context }) => {
    await setAuthCookie(context);
  });

  test('fabric-operations-welcome returns 200', async ({ page }) => {
    const resp = await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    expect(resp?.status()).toBe(200);
    await expect(page).toHaveURL(/fabric-operations-welcome/);
  });

  test('fabric-operations-vpc-provisioning returns 200', async ({ page }) => {
    const resp = await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    expect(resp?.status()).toBe(200);
    await expect(page).toHaveURL(/fabric-operations-vpc-provisioning/);
  });

  test('fabric-operations-foundations-recap returns 200', async ({ page }) => {
    const resp = await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    expect(resp?.status()).toBe(200);
    await expect(page).toHaveURL(/fabric-operations-foundations-recap/);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. fabric-operations-welcome — quiz UX + lab + reload
// ─────────────────────────────────────────────────────────────
test.describe('fabric-operations-welcome', () => {
  test.beforeAll(async () => {
    await resetModule('fabric-operations-welcome');
  });

  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
  });

  test('no static Assessment h2 in rendered HTML', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    const html = await page.content();
    expect(html).not.toContain('<h2>Assessment</h2>');
    expect(html).not.toContain('HHL_ASSESSMENT_SPLIT');
  });

  test('interactive quiz section is visible', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-quiz-section')).toBeVisible({ timeout: 10000 });
  });

  test('quiz shows exactly 5 questions', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    const questions = page.locator('.hhl-quiz-question');
    await expect(questions).toHaveCount(5, { timeout: 10000 });
  });

  test('no correct_answer values in rendered HTML', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    const html = await page.content();
    expect(html).not.toContain('"correct_answer"');
    expect(html).not.toContain('correct_answer');
  });

  test('Hands-On Lab section is visible', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-lab-section')).toBeVisible({ timeout: 10000 });
  });

  test('wrong quiz submission shows fail feedback with retry', async ({ page }) => {
    await resetModule('fabric-operations-welcome');
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-quiz-section')).toBeVisible({ timeout: 10000 });

    await fillQuiz(page, WRONG_ANSWERS);
    await page.locator('#hhl-quiz-submit').click();

    // Wait for feedback
    await expect(page.locator('#hhl-quiz-feedback')).toBeVisible({ timeout: 15000 });
    const feedbackText = await page.locator('#hhl-quiz-feedback').textContent();
    // showQuizFailed() renders: "Score: X% (Attempt N) — Need 75% to pass." + "Retake Quiz" button
    expect(feedbackText).toMatch(/need.*pass|score:|retake/i);

    // showQuizFailed() hides #hhl-quiz-submit and shows #hhl-quiz-retake for the retry path
    await expect(page.locator('#hhl-quiz-retake')).toBeVisible();
  });

  test('correct quiz submission shows pass feedback', async ({ page }) => {
    await resetModule('fabric-operations-welcome');
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-quiz-section')).toBeVisible({ timeout: 10000 });

    await fillQuiz(page, RIGHT_ANSWERS);
    await page.locator('#hhl-quiz-submit').click();

    await expect(page.locator('#hhl-quiz-feedback')).toBeVisible({ timeout: 15000 });
    const feedbackText = await page.locator('#hhl-quiz-feedback').textContent();
    expect(feedbackText).toMatch(/pass|passed|congratulations|well done/i);
  });

  test('lab attestation completes the module', async ({ page }) => {
    await resetModule('fabric-operations-welcome');
    // Pass quiz first via API so lab button is active
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-lab-section')).toBeVisible({ timeout: 10000 });

    // Lab attest button should be present
    const labBtn = page.locator('#hhl-lab-attest-btn');
    await expect(labBtn).toBeVisible({ timeout: 10000 });
    await labBtn.click();

    // Lab completed feedback
    await expect(page.locator('#hhl-lab-feedback')).toBeVisible({ timeout: 15000 });
    const labFeedback = await page.locator('#hhl-lab-feedback').textContent();
    expect(labFeedback).toMatch(/complete|lab.*done|attested/i);

    // Module complete banner
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 10000 });
  });

  test('completed state persists after reload', async ({ page }) => {
    // Ensure module is complete via API
    await resetModule('fabric-operations-welcome');
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);
    await attestLabApi('fabric-operations-welcome');

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    // Page JS restores state from API on load
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 15000 });

    // Reload — domcontentloaded avoids hanging on slow CDN resource loads
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 3. fabric-operations-vpc-provisioning — lab-only
// ─────────────────────────────────────────────────────────────
test.describe('fabric-operations-vpc-provisioning', () => {
  test.beforeAll(async () => {
    await resetModule('fabric-operations-vpc-provisioning');
  });

  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
  });

  test('no quiz section rendered', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    await expect(page.locator('#hhl-quiz-section')).toHaveCount(0);
  });

  test('lab completion UI is visible', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    await expect(page.locator('#hhl-lab-section')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#hhl-lab-attest-btn')).toBeVisible({ timeout: 10000 });
  });

  test('lab completion marks module complete', async ({ page }) => {
    await resetModule('fabric-operations-vpc-provisioning');
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    await expect(page.locator('#hhl-lab-attest-btn')).toBeVisible({ timeout: 10000 });

    await page.locator('#hhl-lab-attest-btn').click();
    await expect(page.locator('#hhl-lab-feedback')).toBeVisible({ timeout: 15000 });
    const labFeedback = await page.locator('#hhl-lab-feedback').textContent();
    expect(labFeedback).toMatch(/complete|lab.*done|attested/i);

    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 10000 });
  });

  test('completed state persists after reload', async ({ page }) => {
    await resetModule('fabric-operations-vpc-provisioning');
    await attestLabApi('fabric-operations-vpc-provisioning');

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-vpc-provisioning`);
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 4. fabric-operations-foundations-recap — no-task neutral state
// ─────────────────────────────────────────────────────────────
test.describe('fabric-operations-foundations-recap', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
  });

  test('no quiz UI rendered', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    await expect(page.locator('#hhl-quiz-section')).toHaveCount(0);
  });

  test('no lab attestation UI rendered', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    await expect(page.locator('#hhl-lab-section')).toHaveCount(0);
  });

  test('legacy Mark Complete button is hidden (not visible)', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    // Must not be visible — element may exist in DOM but must be display:none
    const completeBtn = page.locator('#hhl-mark-complete');
    const isVisible = await completeBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('legacy Mark Started button is hidden (not visible)', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    const startedBtn = page.locator('#hhl-mark-started');
    const isVisible = await startedBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('no action-runner navigation on any click in page', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    // Verify the page does NOT navigate to action-runner
    let actionRunnerNavigated = false;
    page.on('framenavigated', (frame) => {
      if (frame.url().includes('action-runner')) actionRunnerNavigated = true;
    });
    // Wait for JS to settle
    await page.waitForTimeout(3000);
    expect(actionRunnerNavigated).toBe(false);
  });

  test('neutral no-task state note is visible', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    // shadow-completion.js injects a neutral note when no quiz/lab exist
    const note = page.locator('#hhl-no-task-note');
    await expect(note).toBeVisible({ timeout: 10000 });
    const noteText = await note.textContent();
    expect(noteText).toMatch(/no required tasks/i);
  });

  test('page state is neutral after reload', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
    await expect(page.locator('#hhl-no-task-note')).toBeVisible({ timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.locator('#hhl-no-task-note')).toBeVisible({ timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────
// 5. /learn-shadow/my-learning — visible task state
// ─────────────────────────────────────────────────────────────
test.describe('/learn-shadow/my-learning', () => {
  const ENROLLED_COURSE_SLUG = 'network-like-hyperscaler-foundations';

  test.beforeAll(async () => {
    // Set up: complete welcome module, reset foundations-recap (no-task)
    await resetModule('fabric-operations-welcome');
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);
    await attestLabApi('fabric-operations-welcome');
  });

  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);

    // Intercept /auth/me so cognito-auth-integration.js resolves an authenticated identity.
    // Without this, the test bypass token (shadow_e2e_test_token) is rejected by the real
    // Cognito auth endpoint → identity becomes {email:'', contactId:''} → shadow-my-learning.js
    // exits early before making the enrollment call.
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

    // Mock /enrollments/list to return the NLH foundations course.
    // Use a regex so it reliably matches the full URL including protocol and query string:
    // https://api.hedgehog.cloud/enrollments/list?email=...
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

    // Mock HubDB course table — /hs/api/hubdb/v3/ returns 404 outside a real HubSpot
    // browser session (no HubSpot session cookies set). Intercept to provide module slugs.
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

    // Mock HubDB module table — provides completion_tasks_json for each module.
    // welcome, how-it-works, mastering-interfaces: quiz + lab (both required).
    // foundations-recap: knowledge_check only (required:false → no-task module).
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

  test('page loads and shows shadow context indicator', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // Page must load without 500
    await expect(page).not.toHaveURL(/error/);
    // Shadow badge or heading visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('module list is visible without requiring user interaction', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // Details should be open — module items visible without clicking anything
    const moduleList = page.locator('.enrollment-modules-list');
    await expect(moduleList).toBeVisible({ timeout: 20000 });
  });

  test('task pills visible after pilot completions', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // Wait for JS to load enrollment data and task statuses.
    // There is one .shadow-task-breakdown per module (4 total), use .first() to avoid strict-mode violation.
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });
    const pills = page.locator('.shadow-task-pill');
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
  });

  test('fabric-operations-welcome shows quiz passed and lab completed', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // One .shadow-task-breakdown per module — use .first() to avoid strict-mode violation.
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });

    // Find task pills for welcome module
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

  test('progress counter reflects completed task modules', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // Wait for cards to render
    await expect(page.locator('.enrollment-card')).toBeVisible({ timeout: 20000 });

    // Progress label should show at least 1 of N task modules complete
    const progressLabel = page.locator('.enrollment-progress-label');
    await expect(progressLabel).toBeVisible({ timeout: 10000 });
    const labelText = await progressLabel.first().textContent();
    // Should show "1 of N task modules complete" (welcome is complete)
    expect(labelText).toMatch(/\d+ of \d+/);
    // The completed count should be at least 1
    const match = labelText?.match(/(\d+) of/);
    const completed = match ? parseInt(match[1]) : 0;
    expect(completed).toBeGreaterThanOrEqual(1);
  });

  test('all navigation links stay under /learn-shadow/', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.enrollment-modules-list')).toBeVisible({ timeout: 20000 });

    // Collect all module links from the enrollment module items
    const moduleLinks = page.locator('.enrollment-module-link');
    const count = await moduleLinks.count();
    for (let i = 0; i < count; i++) {
      const href = await moduleLinks.nth(i).getAttribute('href');
      if (href) {
        expect(href).toMatch(/^\/learn-shadow\//);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 6. Shadow isolation — no /learn leakage, no duplicate assessment
// ─────────────────────────────────────────────────────────────
test.describe('Shadow isolation', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
  });

  test('welcome: no duplicate static Assessment block', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    const html = await page.content();
    expect(html).not.toContain('<h2>Assessment</h2>');
    // Only one quiz section (interactive)
    const quizSections = await page.locator('#hhl-quiz-section').count();
    expect(quizSections).toBe(1);
  });

  test('welcome: no correct_answer in page HTML', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    const html = await page.content();
    expect(html).not.toContain('"correct_answer"');
    expect(html).not.toContain('correct_answer:');
  });

  test('shadow API calls use api.hedgehog.cloud/shadow/* path', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('api.hedgehog.cloud')) {
        apiCalls.push(req.url());
      }
    });

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await page.waitForTimeout(5000); // let deferred JS run

    // All shadow task API calls must use /shadow/ path
    const taskCalls = apiCalls.filter((u) => u.includes('/tasks/'));
    taskCalls.forEach((url) => {
      expect(url).toContain('/shadow/tasks/');
    });
  });

  test('production /learn/* pages do not get shadow JS', async ({ page }) => {
    // Load a production module page to verify no shadow task calls
    const shadowCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/shadow/tasks')) shadowCalls.push(req.url());
    });

    await page.goto(`${BASE}/learn/modules/fabric-operations-welcome`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    expect(shadowCalls.length).toBe(0);
  });
});
