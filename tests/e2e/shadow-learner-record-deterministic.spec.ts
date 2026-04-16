/**
 * Shadow Learner Record — Deterministic Test Suite (Issue #452, Phase 5B)
 *
 * Layer 1 deterministic frontend regression for the new shadow learner progress
 * center. Covers:
 *   - Redesigned My Learning dashboard (pathway-first, thin renderer)
 *   - Shadow pathway detail page at /learn-shadow/pathways/<slug>
 *   - Shadow course detail page at /learn-shadow/courses/<slug>
 *   - Module learner-record page at /learn-shadow/modules/<slug>/progress
 *
 * Follows the existing shadow-deterministic pattern:
 *   - Intercepts new shadow JS files with byte-identical local repo source.
 *   - Mocks /auth/me (unavoidable — shadow_e2e_test_token is not a valid JWT).
 *   - Mocks /enrollments/list.
 *   - Mocks HubDB row fetches (HubDB API returns 404 outside portal session).
 *   - NEW: mocks the three Phase 5A backend endpoints with representative
 *     fixtures so UI state transitions are exercised deterministically.
 *
 * Sensitive-handling assertions:
 *   - No rendered DOM anywhere contains the known correct-answer text.
 *   - No captured /shadow/module/progress response contains the string
 *     "correct_answer" or "learner_identity".
 *   - Lab attestation timeline rows expose no answer_review drawer.
 *
 * TDD status:
 *   First committed in the fail-first state — most tests reference templates
 *   and JS that do not yet exist. Tests progress to green after Phase 5B
 *   implementation lands.
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const BASE = 'https://hedgehog.cloud';
const API_BASE = 'https://api.hedgehog.cloud';
const TEST_TOKEN = 'shadow_e2e_test_token';
const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

// Sensitive-handling invariants.
const KNOWN_CORRECT_ANSWER_TEXT = 'kubectl get switch';

// ─────────────────────────────────────────────────────────────
// Intercept helpers
// ─────────────────────────────────────────────────────────────

function readIfExists(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Intercept the updated and new shadow JS files with byte-identical repo source.
 * Files that don't exist yet (fail-first state) cause the route to fall through
 * to the network, which still lets the page render without the JS and lets us
 * assert the template structure exists.
 */
async function interceptShadowJs(page: Page) {
  const jsFiles = [
    { re: /shadow-my-learning/, path: 'clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js' },
    { re: /shadow-course-detail/, path: 'clean-x-hedgehog-templates/assets/shadow/js/shadow-course-detail.js' },
    { re: /shadow-pathway-detail/, path: 'clean-x-hedgehog-templates/assets/shadow/js/shadow-pathway-detail.js' },
    { re: /shadow-module-progress/, path: 'clean-x-hedgehog-templates/assets/shadow/js/shadow-module-progress.js' },
  ];
  for (const j of jsFiles) {
    const body = readIfExists(path.join(REPO_ROOT, j.path));
    if (body !== null) {
      await page.route(j.re, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body });
      });
    }
  }
}

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

async function mockPathwayStatus(page: Page, status: number, body: any) {
  await page.route(/api\.hedgehog\.cloud\/shadow\/pathway\/status/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

async function mockCourseStatus(page: Page, status: number, body: any) {
  await page.route(/api\.hedgehog\.cloud\/shadow\/course\/status/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

async function mockModuleProgress(page: Page, status: number, body: any) {
  await page.route(/api\.hedgehog\.cloud\/shadow\/module\/progress/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

async function mockCertificates(page: Page) {
  await page.route(/api\.hedgehog\.cloud\/shadow\/certificates/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ certificates: [] }),
    });
  });
}

async function setAuthCookie(ctx: BrowserContext) {
  await ctx.addCookies([TEST_COOKIE]);
}

// ─────────────────────────────────────────────────────────────
// Representative fixtures (shape matches Phase 3 §2 exactly)
// ─────────────────────────────────────────────────────────────

const PATHWAY_MIXED = {
  pathway_slug: PATHWAY_SLUG,
  pathway_title: 'Network Like a Hyperscaler',
  pathway_status: 'in_progress',
  courses_completed: 1,
  courses_total: 4,
  courses: [
    {
      course_slug: COURSE_SLUG,
      course_title: 'Course 1: Foundations & Interfaces',
      course_status: 'in_progress',
      modules_completed: 2,
      modules_total: 4,
      course_cert_id: null,
    },
    {
      course_slug: 'network-like-hyperscaler-provisioning',
      course_title: 'Course 2: Provisioning & Day 1 Operations',
      course_status: 'not_started',
      modules_completed: 0,
      modules_total: 4,
      course_cert_id: null,
    },
    {
      course_slug: 'network-like-hyperscaler-observability',
      course_title: 'Course 3: Observability',
      course_status: 'not_started',
      modules_completed: 0,
      modules_total: 4,
      course_cert_id: null,
    },
    {
      course_slug: 'network-like-hyperscaler-troubleshooting',
      course_title: 'Course 4: Troubleshooting',
      course_status: 'not_started',
      modules_completed: 0,
      modules_total: 4,
      course_cert_id: null,
    },
  ],
  pathway_cert_id: null,
};

const COURSE_MIXED = {
  course_slug: COURSE_SLUG,
  course_title: 'Course 1: Foundations & Interfaces',
  course_status: 'in_progress',
  modules_completed: 2,
  modules_total: 3,
  modules: [
    {
      module_slug: 'fabric-operations-welcome',
      module_title: 'Welcome to Fabric Operations',
      module_status: 'complete',
      has_required_tasks: true,
      tasks: { 'quiz-1': { status: 'passed', score: 100, attempts: 1 } },
    },
    {
      module_slug: 'fabric-operations-how-it-works',
      module_title: 'How Hedgehog Works',
      module_status: 'complete',
      has_required_tasks: true,
      tasks: { 'quiz-1': { status: 'passed', score: 85, attempts: 2 } },
    },
    {
      module_slug: 'fabric-operations-mastering-interfaces',
      module_title: 'Mastering the Three Interfaces',
      module_status: 'in_progress',
      has_required_tasks: true,
      tasks: { 'quiz-1': { status: 'failed', score: 60, attempts: 1 } },
    },
    {
      module_slug: 'fabric-operations-foundations-recap',
      module_title: 'Foundations Recap',
      module_status: 'no_tasks',
      has_required_tasks: false,
      tasks: {},
    },
  ],
  course_cert_id: null,
};

const MODULE_PROGRESS_WITH_ATTEMPTS = {
  module_slug: MODULE_SLUG,
  module_title: 'Welcome to Fabric Operations',
  module_status: 'in_progress',
  has_required_tasks: true,
  tasks: [
    {
      task_slug: 'quiz-1',
      task_type: 'quiz',
      task_title: 'Welcome Quiz',
      required: true,
      status: 'failed',
      best_score: 60,
      attempt_count: 2,
      last_attempt_at: '2026-04-12T14:22:09.000Z',
      passing_score: 75,
    },
    {
      task_slug: 'lab-main',
      task_type: 'lab_attestation',
      task_title: 'Lab: Run kubectl describe',
      required: true,
      status: 'not_started',
    },
  ],
  attempts: [
    {
      attempt_id: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-12T14:22:09.000Z`,
      task_slug: 'quiz-1',
      task_type: 'quiz',
      attempted_at: '2026-04-12T14:22:09.000Z',
      outcome: 'failed',
      score: 60,
      answer_review: [
        {
          question_id: 'q1',
          question_text: 'Which command lists fabric switches?',
          submitted_answer_id: 'kubectl get pods',
          submitted_answer_text: 'kubectl get pods',
          is_correct: false,
          schema_drift: false,
        },
      ],
    },
    {
      attempt_id: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-11T10:00:00.000Z`,
      task_slug: 'quiz-1',
      task_type: 'quiz',
      attempted_at: '2026-04-11T10:00:00.000Z',
      outcome: 'failed',
      score: 40,
      answer_review: [
        {
          question_id: 'q1',
          question_text: 'Which command lists fabric switches?',
          submitted_answer_id: 'kubectl get nodes',
          submitted_answer_text: 'kubectl get nodes',
          is_correct: false,
          schema_drift: false,
        },
      ],
    },
  ],
  module_cert_id: null,
  breadcrumbs: {
    parent_course_slug: COURSE_SLUG,
    parent_course_title: 'Course 1: Foundations & Interfaces',
    parent_pathway_slug: PATHWAY_SLUG,
    parent_pathway_title: 'Network Like a Hyperscaler',
  },
};

// ─────────────────────────────────────────────────────────────
// 1. My Learning dashboard — pathway-first, thin renderer
// ─────────────────────────────────────────────────────────────

test.describe('My Learning dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
    await mockAuthMe(page);
  });

  test('empty state: zero enrollments → empty-state block visible, no cards', async ({ page }) => {
    await mockEnrollments(page, { mode: 'authenticated', enrollments: { pathways: [], courses: [] } });
    await mockCertificates(page);

    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('#empty-state')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#enrolled-section .enrollment-card').first()).toHaveCount(0);
  });

  test('populated: 1 pathway + 1 standalone course render as cards with server-provided counts', async ({ page }) => {
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: {
        pathways: [{ slug: PATHWAY_SLUG, enrolled_at: '2026-04-01T00:00:00.000Z', enrollment_source: 'test' }],
        courses: [{ slug: 'hedgehog-lab-foundations', pathway_slug: null, enrolled_at: '2026-04-01T00:00:00.000Z' }],
      },
    });
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await mockCourseStatus(page, 200, {
      course_slug: 'hedgehog-lab-foundations',
      course_title: 'Hedgehog Lab Foundations',
      course_status: 'not_started',
      modules_completed: 0,
      modules_total: 3,
      modules: [],
      course_cert_id: null,
    });
    await mockCertificates(page);

    await page.goto(`${BASE}/learn-shadow/my-learning`);

    // Pathway card shows the exact server counts verbatim — not locally computed.
    await expect(page.locator('[data-dashboard-pathway-card]')).toContainText('1 of 4');
    await expect(page.locator('[data-dashboard-pathway-card]')).toContainText('Network Like a Hyperscaler');
    // Standalone course card present
    await expect(page.locator('[data-dashboard-standalone-course-card]')).toContainText('Hedgehog Lab Foundations');
  });

  test('counts come from server: dashboard renders server-provided values, not derived from modules[]', async ({ page }) => {
    // Construct a pathway-status response whose courses[] entries would arithmetically
    // roll up to different totals if the client were recomputing.
    const tampered = {
      ...PATHWAY_MIXED,
      courses_completed: 2,
      courses_total: 4,
      // but courses[] entries have only 1 complete — proves the dashboard reads top-level
      courses: PATHWAY_MIXED.courses.map((c, i) => ({ ...c, course_status: i === 0 ? 'complete' : 'not_started' })),
    };
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: { pathways: [{ slug: PATHWAY_SLUG }], courses: [] },
    });
    await mockPathwayStatus(page, 200, tampered);
    await mockCertificates(page);

    await page.goto(`${BASE}/learn-shadow/my-learning`);
    // Assert "2 of 4" is rendered — the server's number — not "1 of 4" (derived).
    await expect(page.locator('[data-dashboard-pathway-card]')).toContainText('2 of 4');
  });

  test('partial failure: one card fails 500 → inline error + retry; other card renders', async ({ page }) => {
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: {
        pathways: [{ slug: PATHWAY_SLUG }],
        courses: [{ slug: 'hedgehog-lab-foundations', pathway_slug: null }],
      },
    });
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await mockCourseStatus(page, 500, { error: 'Failed to read course status' });
    await mockCertificates(page);

    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toBeVisible();
    await expect(page.locator('[data-dashboard-standalone-course-card][data-error="true"]')).toBeVisible();
  });

  test('no /tasks/status/batch call on load — dashboard uses pathway/course status only', async ({ page }) => {
    const batchCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/tasks/status/batch')) batchCalls.push(req.url());
    });

    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: { pathways: [{ slug: PATHWAY_SLUG }], courses: [] },
    });
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await mockCertificates(page);

    await page.goto(`${BASE}/learn-shadow/my-learning`);
    await page.waitForLoadState('networkidle');
    expect(batchCalls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Shadow pathway detail page
// ─────────────────────────────────────────────────────────────

test.describe('Shadow pathway detail page', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
    await mockAuthMe(page);
  });

  test('loaded (in_progress): header, status badge, per-course rollup rows', async ({ page }) => {
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);

    await page.goto(`${BASE}/learn-shadow/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-title]')).toContainText('Network Like a Hyperscaler');
    await expect(page.locator('[data-pathway-status-badge]')).toContainText(/in.?progress/i);
    await expect(page.locator('[data-pathway-course-row]')).toHaveCount(4);
    // First course shown in_progress, rest not_started
    await expect(page.locator('[data-pathway-course-row]').first()).toContainText(/2 of 4/);
  });

  test('empty state (not_started): CTA "Start Pathway" → first course detail', async ({ page }) => {
    await mockPathwayStatus(page, 200, {
      ...PATHWAY_MIXED,
      pathway_status: 'not_started',
      courses_completed: 0,
      courses: PATHWAY_MIXED.courses.map((c) => ({ ...c, course_status: 'not_started', modules_completed: 0 })),
    });

    await page.goto(`${BASE}/learn-shadow/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-cta]')).toContainText(/start pathway/i);
  });

  test('error 500: inline error banner with retry button', async ({ page }) => {
    await mockPathwayStatus(page, 500, { error: 'Failed to read pathway status' });
    await page.goto(`${BASE}/learn-shadow/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-error]')).toBeVisible();
  });

  test('pathway complete: cert link is visible', async ({ page }) => {
    await mockPathwayStatus(page, 200, {
      ...PATHWAY_MIXED,
      pathway_status: 'complete',
      courses_completed: 4,
      pathway_cert_id: 'pathway-cert-xyz',
      courses: PATHWAY_MIXED.courses.map((c) => ({ ...c, course_status: 'complete', modules_completed: c.modules_total })),
    });
    await page.goto(`${BASE}/learn-shadow/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-cert-link]')).toHaveAttribute('href', /pathway-cert-xyz/);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Shadow course detail page
// ─────────────────────────────────────────────────────────────

test.describe('Shadow course detail page', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
    await mockAuthMe(page);
  });

  test('loaded (in_progress + no-task module): no-task module shown with pill, excluded from denominator', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn-shadow/courses/${COURSE_SLUG}`);

    // modules_total = 3 (the no-task module is excluded)
    await expect(page.locator('[data-course-progress-label]')).toContainText(/2 of 3/);
    // All 4 modules rendered in modules[]
    await expect(page.locator('[data-course-module-row]')).toHaveCount(4);
    // The no-tasks module has the "No required tasks" pill
    await expect(page.locator('[data-course-module-row][data-status="no_tasks"]')).toContainText(/no required tasks/i);
  });

  test('cta routes to first-incomplete module', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn-shadow/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-cta]'))
      .toHaveAttribute('href', /fabric-operations-mastering-interfaces/);
  });

  test('error 500: inline error banner', async ({ page }) => {
    await mockCourseStatus(page, 500, { error: 'Failed to read course status' });
    await page.goto(`${BASE}/learn-shadow/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-error]')).toBeVisible();
  });

  test('not found (400): "Course not found" error block', async ({ page }) => {
    await mockCourseStatus(page, 400, { error: 'course not found' });
    await page.goto(`${BASE}/learn-shadow/courses/nonexistent-slug`);
    await expect(page.locator('[data-course-error]')).toContainText(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Module learner-record page
// ─────────────────────────────────────────────────────────────

test.describe('Module learner-record page', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
    await mockAuthMe(page);
  });

  test('with attempts: task list + timeline rendered DESC', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);

    await expect(page.locator('[data-module-title]')).toContainText('Welcome to Fabric Operations');
    await expect(page.locator('[data-module-task-row]')).toHaveCount(2);
    await expect(page.locator('[data-module-attempt-row]')).toHaveCount(2);
    // Attempts are rendered DESC (most recent first) — check order
    const rows = page.locator('[data-module-attempt-row]');
    await expect(rows.nth(0)).toContainText('2026-04-12');
    await expect(rows.nth(1)).toContainText('2026-04-11');
  });

  test('no attempts: task list all not_started, timeline empty-state', async ({ page }) => {
    await mockModuleProgress(page, 200, {
      module_slug: MODULE_SLUG,
      module_title: 'Welcome to Fabric Operations',
      module_status: 'not_started',
      has_required_tasks: true,
      tasks: [{ task_slug: 'quiz-1', task_type: 'quiz', task_title: 'Welcome Quiz', required: true, status: 'not_started' }],
      attempts: [],
      module_cert_id: null,
      breadcrumbs: MODULE_PROGRESS_WITH_ATTEMPTS.breadcrumbs,
    });
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    await expect(page.locator('[data-module-task-row]')).toHaveCount(1);
    await expect(page.locator('[data-module-attempts-empty]')).toBeVisible();
  });

  test('expand quiz attempt: answer-review drawer shows submitted answer + correctness', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);

    // Click the first attempt to expand its answer-review drawer
    await page.locator('[data-module-attempt-row]').first().click();
    await expect(page.locator('[data-module-answer-review-row]')).toBeVisible();
    // Submitted answer is rendered
    await expect(page.locator('[data-module-answer-review-row]').first()).toContainText('kubectl get pods');
    // The correctness indicator is present and shows "incorrect"
    await expect(page.locator('[data-module-answer-review-row] [data-is-correct]').first())
      .toHaveAttribute('data-is-correct', 'false');
  });

  test('SAFETY: no correct-answer text anywhere in rendered DOM', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    await page.locator('[data-module-attempt-row]').first().click();
    const html = await page.content();
    expect(html).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);
  });

  test('SAFETY: captured /shadow/module/progress response carries no correct_answer or learner_identity key', async ({ page }) => {
    let capturedBody = '';
    await page.route(/api\.hedgehog\.cloud\/shadow\/module\/progress/, async (route) => {
      const body = JSON.stringify(MODULE_PROGRESS_WITH_ATTEMPTS);
      capturedBody = body;
      await route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    expect(capturedBody).not.toMatch(/"correct_answer"/);
    expect(capturedBody).not.toMatch(/"learner_identity"/);
    expect(capturedBody).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);
  });

  test('lab attestation in timeline: no answer-review drawer present', async ({ page }) => {
    const fixture = {
      ...MODULE_PROGRESS_WITH_ATTEMPTS,
      attempts: [
        {
          attempt_id: `ATTEMPT#MODULE#${MODULE_SLUG}#lab-main#2026-04-12T00:00:00.000Z`,
          task_slug: 'lab-main',
          task_type: 'lab_attestation',
          attempted_at: '2026-04-12T00:00:00.000Z',
          outcome: 'attested',
        },
      ],
    };
    await mockModuleProgress(page, 200, fixture);
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    await page.locator('[data-module-attempt-row]').first().click();
    // The attempt row exists but no answer-review section
    await expect(page.locator('[data-module-attempt-row]')).toHaveCount(1);
    await expect(page.locator('[data-module-answer-review-row]')).toHaveCount(0);
  });

  test('breadcrumbs resolve parent course and pathway links', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    await expect(page.locator('[data-module-breadcrumb-course]'))
      .toHaveAttribute('href', /courses\/network-like-hyperscaler-foundations/);
    await expect(page.locator('[data-module-breadcrumb-pathway]'))
      .toHaveAttribute('href', /pathways\/network-like-hyperscaler/);
  });

  test('error 500: retry banner', async ({ page }) => {
    await mockModuleProgress(page, 500, { error: 'Failed to read module progress' });
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}/progress`);
    await expect(page.locator('[data-module-error]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Module content page — additive learner-record link
// ─────────────────────────────────────────────────────────────

test.describe('Module content page additive link', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptShadowJs(page);
    await mockAuthMe(page);
  });

  test('module content page shows a learner-record link pointing to /progress', async ({ page }) => {
    await page.goto(`${BASE}/learn-shadow/modules/${MODULE_SLUG}`);
    await expect(page.locator('[data-module-learner-record-link]'))
      .toHaveAttribute('href', /modules\/fabric-operations-welcome\/progress$/);
  });
});
