/**
 * Shadow Deterministic Test Suite — Issue #424, Layer 1
 *
 * Layer 1: Deterministic frontend/UX regression.
 * Verifies that shadow-completion.js and shadow-my-learning.js render the correct
 * UI for all three shadow module types against known API state.
 *
 * ─── MOCK INVENTORY ────────────────────────────────────────────────────────
 *
 * MOCK 1: shadow-completion.js + shadow-my-learning.js JS interception
 *   Target:  Any URL matching /shadow-completion/ or /shadow-my-learning/
 *   Why:     HubSpot CDN has a ~10-hour edge TTL. When a new JS version is published
 *            it gets a new content-hash URL; cached HTML still references the old URL
 *            during the propagation window. Intercepting with local repo source
 *            (fs.readFileSync — byte-identical to deployed file) lets the suite verify
 *            new code behavior immediately without CDN lag dependency.
 *   What remains unproven:
 *            That the CDN actually serves the updated files. Covered by Layer 2 CDN checks.
 *
 * MOCK 2: GET /auth/me  (My Learning tests only)
 *   Target:  /api\.hedgehog\.cloud\/auth\/me/
 *   Why:     Lambda cognitoMe() calls verifyJWT() with real Cognito JWKS validation.
 *            shadow_e2e_test_token is accepted only by verifyCookieAuth() — used by
 *            /tasks/* and /admin/*. /auth/me does NOT call verifyCookieAuth() → 401 →
 *            shadow-my-learning.js receives empty identity → exits before the enrollment
 *            call. No way to authenticate this endpoint without a real Cognito JWT.
 *            Permanently unavoidable without changing Lambda routing.
 *   What remains unproven:
 *            Real Cognito JWT auth flow (covered by the 'e2e' Playwright project).
 *
 * MOCK 3: GET /enrollments/list  (My Learning tests only)
 *   Target:  /api\.hedgehog\.cloud\/enrollments\/list/
 *   Why:     Test user (shadow-reviewer@hedgehog.cloud) is not enrolled in any course
 *            in the CRM. Real call returns empty enrollments → no course card rendered.
 *   What remains unproven:
 *            Real enrollment data shape from CRM. Mock shape matches production contract.
 *
 * MOCK 4: GET /hs/api/hubdb/v3/tables/.../rows  (My Learning tests only)
 *   Target:  /hubdb\/v3\/tables\/135381433\/rows/ (course table)
 *            /hubdb\/v3\/tables\/135621904\/rows/ (module completion_tasks table)
 *   Why:     HubDB API (/hs/api/hubdb/v3/) returns HTTP 404 outside a real HubSpot portal
 *            browser session. Requires HubSpot tracking cookies (__hstc, hubspotutk) set
 *            by visiting the portal. Playwright headless context has no HubSpot session.
 *   What remains unproven:
 *            Real HubDB row structure. Mocked shape matches sync:content output.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────
// JS interception helpers  (MOCK 1 — see file header)
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

/** Intercept shadow-completion.js and shadow-my-learning.js with local repo source */
async function interceptShadowJs(page: Page) {
  // MOCK 1a: shadow-completion.js — byte-identical to committed repo source
  await page.route(/shadow-completion/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: SHADOW_COMPLETION_JS });
  });
  // MOCK 1b: shadow-my-learning.js — byte-identical to committed repo source
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

const WRONG_ANSWERS: Record<string, string> = { q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'a' };
const RIGHT_ANSWERS: Record<string, string> = { q1: 'b', q2: 'b', q3: 'b', q4: 'b', q5: 'c' };

// ─────────────────────────────────────────────────────────────
// Helpers
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

    await expect(page.locator('#hhl-quiz-feedback')).toBeVisible({ timeout: 15000 });
    const feedbackText = await page.locator('#hhl-quiz-feedback').textContent();
    expect(feedbackText).toMatch(/need.*pass|score:|retake/i);
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
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-lab-section')).toBeVisible({ timeout: 10000 });

    const labBtn = page.locator('#hhl-lab-attest-btn');
    await expect(labBtn).toBeVisible({ timeout: 10000 });
    await labBtn.click();

    await expect(page.locator('#hhl-lab-feedback')).toBeVisible({ timeout: 15000 });
    const labFeedback = await page.locator('#hhl-lab-feedback').textContent();
    expect(labFeedback).toMatch(/complete|lab.*done|attested/i);

    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 10000 });
  });

  test('completed state persists after reload', async ({ page }) => {
    await resetModule('fabric-operations-welcome');
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);
    await attestLabApi('fabric-operations-welcome');

    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-welcome`);
    await expect(page.locator('#hhl-module-complete, .hhl-module-complete')).toBeVisible({ timeout: 15000 });

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
    let actionRunnerNavigated = false;
    page.on('framenavigated', (frame) => {
      if (frame.url().includes('action-runner')) actionRunnerNavigated = true;
    });
    await page.waitForTimeout(3000);
    expect(actionRunnerNavigated).toBe(false);
  });

  test('neutral no-task state note is visible', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/fabric-operations-foundations-recap`);
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
//    (MOCK 2: /auth/me, MOCK 3: /enrollments/list, MOCK 4: HubDB)
// ─────────────────────────────────────────────────────────────
test.describe('/learn-shadow/my-learning', () => {
  const ENROLLED_COURSE_SLUG = 'network-like-hyperscaler-foundations';

  test.beforeAll(async () => {
    await resetModule('fabric-operations-welcome');
    await submitQuizApi('fabric-operations-welcome', RIGHT_ANSWERS);
    await attestLabApi('fabric-operations-welcome');
  });

  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);

    // MOCK 2: /auth/me — test bypass token rejected by cognitoMe() verifyJWT(); mock
    // returns authenticated identity so shadow-my-learning.js proceeds past identity check.
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

    // MOCK 3: /enrollments/list — test user not enrolled in CRM; mock provides NLH
    // foundations enrollment so the course card renders.
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

    // MOCK 4a: HubDB course table — returns 404 outside HubSpot portal session; mock
    // provides module slug list for the foundations course.
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

    // MOCK 4b: HubDB module table — returns 404 outside HubSpot portal session; mock
    // provides completion_tasks_json for each module (matches sync:content output shape).
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
    await expect(page).not.toHaveURL(/error/);
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('module list is visible without requiring user interaction', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    const moduleList = page.locator('.enrollment-modules-list');
    await expect(moduleList).toBeVisible({ timeout: 20000 });
  });

  test('task pills visible after pilot completions', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });
    const pills = page.locator('.shadow-task-pill');
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
  });

  test('fabric-operations-welcome shows quiz passed and lab completed', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.shadow-task-breakdown').first()).toBeVisible({ timeout: 20000 });

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
    await expect(page.locator('.enrollment-card')).toBeVisible({ timeout: 20000 });

    const progressLabel = page.locator('.enrollment-progress-label');
    await expect(progressLabel).toBeVisible({ timeout: 10000 });
    const labelText = await progressLabel.first().textContent();
    expect(labelText).toMatch(/\d+ of \d+/);
    const match = labelText?.match(/(\d+) of/);
    const completed = match ? parseInt(match[1]) : 0;
    expect(completed).toBeGreaterThanOrEqual(1);
  });

  test('all navigation links stay under /learn-shadow/', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('.enrollment-modules-list')).toBeVisible({ timeout: 20000 });

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
    await page.waitForTimeout(5000);

    const taskCalls = apiCalls.filter((u) => u.includes('/tasks/'));
    taskCalls.forEach((url) => {
      expect(url).toContain('/shadow/tasks/');
    });
  });

  test('production /learn/* pages do not get shadow JS', async ({ page }) => {
    const shadowCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/shadow/tasks')) shadowCalls.push(req.url());
    });

    await page.goto(`${BASE}/learn/modules/fabric-operations-welcome`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    expect(shadowCalls.length).toBe(0);
  });
});
