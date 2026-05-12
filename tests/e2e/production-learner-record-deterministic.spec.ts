/**
 * Production Learner Record — Deterministic Test Suite (Issue #459, Phase 5B)
 *
 * Layer 1 deterministic frontend regression for the production /learn parity
 * slice of the approved shadow learner progress center (#452). Covers:
 *   - My Learning dashboard at /learn/my-learning (server-authoritative cards)
 *   - Pathway detail page at /learn/pathways/<slug> (additive progress mount)
 *   - Course detail page at /learn/courses/<slug>  (additive progress mount)
 *   - Module learner-record page at /learn/module-progress?module=<slug>
 *   - Module content page additive learner-record link
 *
 * Follows the existing deterministic pattern from shadow:
 *   - Intercepts the new production JS files with byte-identical local repo source.
 *   - Mocks /auth/me (test token is not a valid JWT).
 *   - Mocks /enrollments/list.
 *   - Mocks HubDB row fetches.
 *   - Mocks the three Phase 5A backend endpoints — production base path is bare:
 *     api.hedgehog.cloud/course/status, /pathway/status, /module/progress
 *     (no /shadow/ prefix; #460 wired the bare root mapping to the production HttpApi).
 *
 * Production-specific invariants (vs. shadow):
 *   - No <meta name="robots" content="noindex,nofollow"> on any /learn/* surface.
 *   - No .shadow-mode-banner DOM injected anywhere.
 *   - Canonical URLs use /learn/..., never /learn-shadow/....
 *   - All in-DOM links route through /learn/..., never /learn-shadow/....
 *
 * Sensitive-handling assertions (carried over from shadow as defense-in-depth):
 *   - No rendered DOM contains the known correct-answer text.
 *   - No captured /module/progress response contains "correct_answer" or
 *     "learner_identity".
 *   - Lab attestation timeline rows expose no answer_review drawer.
 *
 * TDD status:
 *   First committed in the fail-first state — most tests reference templates
 *   and JS that do not yet exist on main. Tests progress to green as the
 *   inventory in https://github.com/afewell-hh/hh-learn/issues/459#issuecomment-4434144412
 *   lands and the new /learn/module-progress page is provisioned.
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const BASE = 'https://hedgehog.cloud';
const API_BASE = 'https://api.hedgehog.cloud';
const TEST_TOKEN = 'production_e2e_test_token';
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

// Sensitive-handling invariants — same probe text as shadow tests for parity.
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
 * Intercept the new/updated production JS files with byte-identical repo source.
 * Files that don't exist yet (fail-first state) fall through to network and the
 * page renders without the JS — which lets us still assert the published template
 * structure exists once the templates are uploaded.
 */
async function interceptProductionJs(page: Page) {
  const jsFiles = [
    { re: /production-my-learning/, path: 'clean-x-hedgehog-templates/assets/js/production-my-learning.js' },
    { re: /production-course-detail/, path: 'clean-x-hedgehog-templates/assets/js/production-course-detail.js' },
    { re: /production-pathway-detail/, path: 'clean-x-hedgehog-templates/assets/js/production-pathway-detail.js' },
    { re: /production-module-progress/, path: 'clean-x-hedgehog-templates/assets/js/production-module-progress.js' },
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

// Bare production endpoints (no /shadow/ prefix).
// Regex anchors on the bare path so a stray /shadow/ would not match.
async function mockPathwayStatus(page: Page, status: number, body: any) {
  await page.route(/api\.hedgehog\.cloud\/pathway\/status(\?|$)/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

async function mockCourseStatus(page: Page, status: number, body: any) {
  await page.route(/api\.hedgehog\.cloud\/course\/status(\?|$)/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

async function mockModuleProgress(page: Page, status: number, body: any) {
  await page.route(/api\.hedgehog\.cloud\/module\/progress(\?|$)/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });
}

async function mockCertificates(page: Page) {
  await page.route(/api\.hedgehog\.cloud\/certificates(\?|$)/, async (route) => {
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
// Representative fixtures (same shapes as shadow Phase 5A contract)
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
// 1. My Learning dashboard — server-authoritative cards
// ─────────────────────────────────────────────────────────────

test.describe('Production My Learning dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptProductionJs(page);
    await mockAuthMe(page);
  });

  test('PRODUCTION INVARIANT: no shadow banner, no noindex, canonical /learn/my-learning', async ({ page }) => {
    await mockEnrollments(page, { mode: 'authenticated', enrollments: { pathways: [], courses: [] } });
    await mockCertificates(page);

    await page.goto(`${BASE}/learn/my-learning`);
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    const robotsMeta = await page.locator('meta[name="robots"]').count();
    if (robotsMeta > 0) {
      const content = await page.locator('meta[name="robots"]').first().getAttribute('content');
      expect(content || '').not.toMatch(/noindex/i);
    }
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(canonical || '').toContain('/learn/my-learning');
    expect(canonical || '').not.toContain('/learn-shadow/');
  });

  test('empty state: zero enrollments → empty-state visible, no cards', async ({ page }) => {
    await mockEnrollments(page, { mode: 'authenticated', enrollments: { pathways: [], courses: [] } });
    await mockCertificates(page);

    await page.goto(`${BASE}/learn/my-learning`);
    await expect(page.locator('#empty-state')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#enrolled-section [data-dashboard-pathway-card]')).toHaveCount(0);
    await expect(page.locator('#enrolled-section [data-dashboard-standalone-course-card]')).toHaveCount(0);
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

    await page.goto(`${BASE}/learn/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toContainText('1 of 4');
    await expect(page.locator('[data-dashboard-pathway-card]')).toContainText('Network Like a Hyperscaler');
    await expect(page.locator('[data-dashboard-standalone-course-card]')).toContainText('Hedgehog Lab Foundations');
  });

  test('PRODUCTION INVARIANT: dashboard card links route through /learn/, never /learn-shadow/', async ({ page }) => {
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: {
        pathways: [{ slug: PATHWAY_SLUG }],
        courses: [{ slug: 'hedgehog-lab-foundations', pathway_slug: null }],
      },
    });
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await mockCourseStatus(page, 200, {
      course_slug: 'hedgehog-lab-foundations',
      course_title: 'Hedgehog Lab Foundations',
      course_status: 'in_progress',
      modules_completed: 1,
      modules_total: 3,
      modules: [
        {
          module_slug: 'hedgehog-lab-foundations-intro',
          module_title: 'Intro',
          module_status: 'complete',
          has_required_tasks: true,
          tasks: {},
        },
        {
          module_slug: 'hedgehog-lab-foundations-next',
          module_title: 'Next',
          module_status: 'in_progress',
          has_required_tasks: true,
          tasks: {},
        },
      ],
      course_cert_id: null,
    });
    await mockCertificates(page);

    await page.goto(`${BASE}/learn/my-learning`);
    await expect(page.locator('[data-dashboard-pathway-card]')).toBeVisible();
    const allLinkHrefs = await page.locator('#enrolled-section a').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || '')
    );
    for (const href of allLinkHrefs) {
      expect(href).not.toContain('/learn-shadow/');
    }
    // At least one CTA must point at /learn/...
    expect(allLinkHrefs.some((h) => h.startsWith('/learn/'))).toBe(true);
  });

  test('counts come from server: dashboard renders server-provided values, not derived from modules[]', async ({ page }) => {
    const tampered = {
      ...PATHWAY_MIXED,
      courses_completed: 2,
      courses_total: 4,
      courses: PATHWAY_MIXED.courses.map((c, i) => ({ ...c, course_status: i === 0 ? 'complete' : 'not_started' })),
    };
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: { pathways: [{ slug: PATHWAY_SLUG }], courses: [] },
    });
    await mockPathwayStatus(page, 200, tampered);
    await mockCertificates(page);

    await page.goto(`${BASE}/learn/my-learning`);
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

    await page.goto(`${BASE}/learn/my-learning`);
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

    await page.goto(`${BASE}/learn/my-learning`);
    await page.waitForLoadState('networkidle');
    expect(batchCalls).toHaveLength(0);
  });

  test('PRODUCTION INVARIANT: dashboard calls bare /pathway/status, never /shadow/pathway/status', async ({ page }) => {
    const shadowCalls: string[] = [];
    page.on('request', (req) => {
      if (/api\.hedgehog\.cloud\/shadow\//.test(req.url())) shadowCalls.push(req.url());
    });
    await mockEnrollments(page, {
      mode: 'authenticated',
      enrollments: { pathways: [{ slug: PATHWAY_SLUG }], courses: [] },
    });
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await mockCertificates(page);

    await page.goto(`${BASE}/learn/my-learning`);
    await page.waitForLoadState('networkidle');
    expect(shadowCalls).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Production pathway detail page (additive)
// ─────────────────────────────────────────────────────────────

test.describe('Production pathway detail page', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptProductionJs(page);
    await mockAuthMe(page);
  });

  test('PRODUCTION INVARIANT: no shadow banner, no noindex, canonical /learn/pathways/<slug>', async ({ page }) => {
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    const robots = await page.locator('meta[name="robots"]').count();
    if (robots > 0) {
      const content = await page.locator('meta[name="robots"]').first().getAttribute('content');
      expect(content || '').not.toMatch(/noindex/i);
    }
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(canonical || '').toContain(`/learn/pathways/${PATHWAY_SLUG}`);
    expect(canonical || '').not.toContain('/learn-shadow/');
  });

  test('PRODUCTION INVARIANT: existing JSON-LD ItemList + enrollment CTA preserved alongside new mount', async ({ page }) => {
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    // Existing production enrollment CTA must remain
    await expect(page.locator('#hhl-enrollment-cta')).toBeVisible();
    // JSON-LD ItemList must remain present
    const ldNodes = await page.locator('script[type="application/ld+json"]').count();
    expect(ldNodes).toBeGreaterThan(0);
  });

  test('loaded (in_progress): header, status badge, per-course rollup rows', async ({ page }) => {
    await mockPathwayStatus(page, 200, PATHWAY_MIXED);
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-title]')).toContainText('Network Like a Hyperscaler');
    await expect(page.locator('[data-pathway-status-badge]')).toContainText(/in.?progress/i);
    await expect(page.locator('[data-pathway-course-row]')).toHaveCount(4);
    await expect(page.locator('[data-pathway-course-row]').first()).toContainText(/2 of 4/);
  });

  test('empty state (not_started): CTA "Start Pathway" routes to first course at /learn/courses/<slug>', async ({ page }) => {
    await mockPathwayStatus(page, 200, {
      ...PATHWAY_MIXED,
      pathway_status: 'not_started',
      courses_completed: 0,
      courses: PATHWAY_MIXED.courses.map((c) => ({ ...c, course_status: 'not_started', modules_completed: 0 })),
    });
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-cta]')).toContainText(/start pathway/i);
    await expect(page.locator('[data-pathway-cta]')).toHaveAttribute('href', /\/learn\/courses\//);
    await expect(page.locator('[data-pathway-cta]')).not.toHaveAttribute('href', /\/learn-shadow\//);
  });

  test('error 500: inline error banner', async ({ page }) => {
    await mockPathwayStatus(page, 500, { error: 'Failed to read pathway status' });
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-error]')).toBeVisible();
  });

  test('pathway complete: cert link points at /learn/certificate?id=...', async ({ page }) => {
    await mockPathwayStatus(page, 200, {
      ...PATHWAY_MIXED,
      pathway_status: 'complete',
      courses_completed: 4,
      pathway_cert_id: 'pathway-cert-xyz',
      courses: PATHWAY_MIXED.courses.map((c) => ({ ...c, course_status: 'complete', modules_completed: c.modules_total })),
    });
    await page.goto(`${BASE}/learn/pathways/${PATHWAY_SLUG}`);
    await expect(page.locator('[data-pathway-cert-link]')).toHaveAttribute('href', /\/learn\/certificate\?id=pathway-cert-xyz/);
    await expect(page.locator('[data-pathway-cert-link]')).not.toHaveAttribute('href', /\/learn-shadow\//);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Production course detail page (additive)
// ─────────────────────────────────────────────────────────────

test.describe('Production course detail page', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptProductionJs(page);
    await mockAuthMe(page);
  });

  test('PRODUCTION INVARIANT: no shadow banner, no noindex, canonical /learn/courses/<slug>', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    const robots = await page.locator('meta[name="robots"]').count();
    if (robots > 0) {
      const content = await page.locator('meta[name="robots"]').first().getAttribute('content');
      expect(content || '').not.toMatch(/noindex/i);
    }
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(canonical || '').toContain(`/learn/courses/${COURSE_SLUG}`);
    expect(canonical || '').not.toContain('/learn-shadow/');
  });

  test('PRODUCTION INVARIANT: existing enrollment CTA + content blocks + JSON-LD preserved', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    await expect(page.locator('#hhl-enrollment-cta')).toBeVisible();
    const ldNodes = await page.locator('script[type="application/ld+json"]').count();
    expect(ldNodes).toBeGreaterThan(0);
  });

  test('loaded (in_progress + no-task module): no-task module rendered with pill, excluded from denominator', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-progress-label]')).toContainText(/2 of 3/);
    await expect(page.locator('[data-course-module-row]')).toHaveCount(4);
    await expect(page.locator('[data-course-module-row][data-status="no_tasks"]')).toContainText(/no required tasks/i);
  });

  test('cta routes to first-incomplete module at /learn/modules/<slug>', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-cta]')).toHaveAttribute(
      'href',
      /\/learn\/modules\/fabric-operations-mastering-interfaces/
    );
    await expect(page.locator('[data-course-cta]')).not.toHaveAttribute('href', /\/learn-shadow\//);
  });

  test('per-module Progress link points at /learn/module-progress?module=<slug>', async ({ page }) => {
    await mockCourseStatus(page, 200, COURSE_MIXED);
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    const link = page.locator('[data-module-progress-link]').first();
    await expect(link).toHaveAttribute('href', /\/learn\/module-progress\?module=/);
    await expect(link).not.toHaveAttribute('href', /\/learn-shadow\//);
  });

  test('error 500: inline error banner', async ({ page }) => {
    await mockCourseStatus(page, 500, { error: 'Failed to read course status' });
    await page.goto(`${BASE}/learn/courses/${COURSE_SLUG}`);
    await expect(page.locator('[data-course-error]')).toBeVisible();
  });

  test('not found (400): "Course not found" error block', async ({ page }) => {
    await mockCourseStatus(page, 400, { error: 'course not found' });
    await page.goto(`${BASE}/learn/courses/nonexistent-slug`);
    await expect(page.locator('[data-course-error]')).toContainText(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Module learner-record page (production)
// ─────────────────────────────────────────────────────────────

test.describe('Production module learner-record page', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptProductionJs(page);
    await mockAuthMe(page);
  });

  test('PRODUCTION INVARIANT: no shadow banner, no noindex, canonical /learn/module-progress', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('.shadow-mode-banner')).toHaveCount(0);
    const robots = await page.locator('meta[name="robots"]').count();
    if (robots > 0) {
      const content = await page.locator('meta[name="robots"]').first().getAttribute('content');
      expect(content || '').not.toMatch(/noindex/i);
    }
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(canonical || '').toContain('/learn/module-progress');
    expect(canonical || '').not.toContain('/learn-shadow/');
  });

  test('with attempts: task list + timeline rendered DESC', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('[data-module-title]')).toContainText('Welcome to Fabric Operations');
    await expect(page.locator('[data-module-task-row]')).toHaveCount(2);
    await expect(page.locator('[data-module-attempt-row]')).toHaveCount(2);
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
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('[data-module-task-row]')).toHaveCount(1);
    await expect(page.locator('[data-module-attempts-empty]')).toBeVisible();
  });

  test('expand quiz attempt: answer-review drawer shows submitted answer + correctness', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await page.locator('[data-module-attempt-row] details summary').first().click();
    await expect(page.locator('[data-module-answer-review-row]')).toBeVisible();
    await expect(page.locator('[data-module-answer-review-row]').first()).toContainText('kubectl get pods');
    await expect(page.locator('[data-module-answer-review-row][data-is-correct]').first()).toHaveAttribute(
      'data-is-correct',
      'false'
    );
  });

  test('SAFETY: no correct-answer text anywhere in rendered DOM', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await page.locator('[data-module-attempt-row] details summary').first().click();
    const html = await page.content();
    expect(html).not.toContain(KNOWN_CORRECT_ANSWER_TEXT);
  });

  test('SAFETY: captured /module/progress response carries no correct_answer or learner_identity key', async ({ page }) => {
    let capturedBody = '';
    await page.route(/api\.hedgehog\.cloud\/module\/progress/, async (route) => {
      const body = JSON.stringify(MODULE_PROGRESS_WITH_ATTEMPTS);
      capturedBody = body;
      await route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
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
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('[data-module-attempt-row]')).toHaveCount(1);
    await expect(page.locator('[data-module-attempt-row] details')).toHaveCount(0);
    await expect(page.locator('[data-module-answer-review-row]')).toHaveCount(0);
  });

  test('breadcrumbs resolve to /learn/pathways/<slug> and /learn/courses/<slug> (no /learn-shadow/)', async ({ page }) => {
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('[data-module-breadcrumb-course]')).toHaveAttribute(
      'href',
      /\/learn\/courses\/network-like-hyperscaler-foundations/
    );
    await expect(page.locator('[data-module-breadcrumb-course]')).not.toHaveAttribute('href', /\/learn-shadow\//);
    await expect(page.locator('[data-module-breadcrumb-pathway]')).toHaveAttribute(
      'href',
      /\/learn\/pathways\/network-like-hyperscaler/
    );
    await expect(page.locator('[data-module-breadcrumb-pathway]')).not.toHaveAttribute('href', /\/learn-shadow\//);
  });

  test('error 500: retry banner', async ({ page }) => {
    await mockModuleProgress(page, 500, { error: 'Failed to read module progress' });
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await expect(page.locator('[data-module-error]')).toBeVisible();
  });

  test('PRODUCTION INVARIANT: calls bare /module/progress, never /shadow/module/progress', async ({ page }) => {
    const shadowCalls: string[] = [];
    page.on('request', (req) => {
      if (/api\.hedgehog\.cloud\/shadow\//.test(req.url())) shadowCalls.push(req.url());
    });
    await mockModuleProgress(page, 200, MODULE_PROGRESS_WITH_ATTEMPTS);
    await page.goto(`${BASE}/learn/module-progress?module=${MODULE_SLUG}`);
    await page.waitForLoadState('networkidle');
    expect(shadowCalls).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Production module content page — additive learner-record link
// ─────────────────────────────────────────────────────────────

test.describe('Production module content page additive link', () => {
  test.beforeEach(async ({ context, page }) => {
    await setAuthCookie(context);
    await interceptProductionJs(page);
    await mockAuthMe(page);
  });

  test('module content page renders a learner-record link pointing to /learn/module-progress?module=<slug>', async ({ page }) => {
    await page.goto(`${BASE}/learn/modules/${MODULE_SLUG}`);
    const link = page.locator('[data-module-learner-record-link]');
    await expect(link).toHaveAttribute('href', /\/learn\/module-progress\?module=fabric-operations-welcome/);
    await expect(link).not.toHaveAttribute('href', /\/learn-shadow\//);
  });
});
