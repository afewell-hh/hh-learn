import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

const COURSE_SLUG = 'example-course';
const ENROLLMENT_SCRIPT = readFileSync('clean-x-hedgehog-templates/assets/js/enrollment.js', 'utf8');

// Read actual constants to get configured login URLs
const CONSTANTS = JSON.parse(readFileSync('clean-x-hedgehog-templates/config/constants.json', 'utf8'));

function authContext(attrs: Record<string, string>) {
  const attrString = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  return `<div id="hhl-auth-context" ${attrString}></div>`;
}

function anonymousTemplate(attrs: Record<string, string>) {
  const loginUrl = attrs['data-login-url'] || CONSTANTS.LOGIN_URL || '/_hcms/mem/login';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Enrollment CTA Test</title>
      </head>
      <body>
        ${authContext(attrs)}
        <div class="enrollment-cta-block" id="hhl-enrollment-cta">
          <div class="enrollment-cta-title">Ready?</div>
          <div class="enrollment-cta-description">Test description</div>
          <a id="hhl-enroll-login" class="enrollment-button" href="${loginUrl}?redirect_url=%2Fmock-course">
            Sign in to start course
          </a>
          <p class="enrollment-cta-helper" id="hhl-enroll-helper">Already registered? <a href="${loginUrl}?redirect_url=%2Fmock-course">Sign in</a> to continue.</p>
        </div>
      </body>
    </html>
  `;
}

function authenticatedTemplate(attrs: Record<string, string>) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Enrollment CTA Test</title>
      </head>
      <body>
        ${authContext(attrs)}
        <div class="enrollment-cta-block" id="hhl-enrollment-cta">
          <div class="enrollment-cta-title">Ready?</div>
          <div class="enrollment-cta-description">Test description</div>
          <button type="button" class="enrollment-button" id="hhl-enroll-button" data-content-type="course" data-content-slug="${COURSE_SLUG}">
            Start Course
          </button>
          <p class="enrollment-cta-helper" id="hhl-enroll-helper" style="display:none;"></p>
        </div>
      </body>
    </html>
  `;
}

async function loadPage(page, body: string, origin: string) {
  const handler = async (route: any) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body });
  };
  await page.route(origin, handler);
  await page.route(origin + '/', handler);
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.unroute(origin, handler);
  await page.unroute(origin + '/', handler);
}

test.describe('Enrollment CTA (DOM)', () => {
  test('leaves server-rendered login link intact for anonymous visitors', async ({ page }) => {
    const origin = 'https://enrollment.test';
    await loadPage(page, anonymousTemplate({
      'data-email': '',
      'data-contact-id': '',
      'data-enable-crm': 'false',
      'data-constants-url': '',
      'data-login-url': CONSTANTS.LOGIN_URL || '/_hcms/mem/login',
      'data-authenticated': 'false'
    }), origin);

    await page.addScriptTag({ content: ENROLLMENT_SCRIPT });
    await page.waitForFunction(() => typeof (window as any).hhInitEnrollment === 'function');
    await page.evaluate((slug) => { (window as any).hhInitEnrollment('course', slug); }, COURSE_SLUG);

    await expect(page.locator('#hhl-enroll-button')).toHaveCount(0);
    const loginLink = page.locator('#hhl-enroll-login');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', /_hcms\/mem\/login/);

    const helper = page.locator('#hhl-enroll-helper');
    await expect(helper).toBeVisible();
    await expect(helper).toContainText(/sign in/i);
  });

  test('binds enrollment handler for authenticated visitors without CRM data', async ({ page }) => {
    const origin = 'https://enrollment-authless.test';

    await loadPage(page, authenticatedTemplate({
      'data-email': 'learner@example.com',
      'data-contact-id': '12345',
      'data-enable-crm': 'false',
      'data-constants-url': '',
      'data-login-url': CONSTANTS.LOGIN_URL || '/_hcms/mem/login',
      'data-authenticated': 'true'
    }), origin);

    await page.addScriptTag({ content: ENROLLMENT_SCRIPT });
    await page.waitForFunction(() => typeof (window as any).hhInitEnrollment === 'function');
    await page.evaluate((slug) => { (window as any).hhInitEnrollment('course', slug); }, COURSE_SLUG);

    const button = page.locator('#hhl-enroll-button');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveText(/start course/i);
  });

  test.skip('uses CRM enrollment data when available (needs JWT auth flow update)', async ({ page }) => {
    // TODO: This test needs to be updated for JWT auth flow (Issue #258)
    // The enrollment.js now sends JWT tokens in Authorization headers,
    // and the mocked API responses may need adjustment to match the new flow
    const origin = 'https://enrollment-auth.test';
    const constantsUrl = origin + '/fake/constants.json';
    const trackBase = 'https://api.example.com';

    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.type(), msg.text()));

    await page.route(constantsUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          TRACK_EVENTS_URL: trackBase + '/events/track',
          LOGIN_URL: CONSTANTS.LOGIN_URL || '/_hcms/mem/login'
        })
      });
    });

    await page.route(/https:\/\/api\.example\.com\/enrollments\/list.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'authenticated',
          enrollments: {
            courses: [
              { slug: COURSE_SLUG, enrolled_at: '2025-10-20T00:00:00Z', enrollment_source: 'test' }
            ]
          }
        })
      });
    });

    await loadPage(page, authenticatedTemplate({
      'data-email': 'learner@example.com',
      'data-contact-id': '12345',
      'data-enable-crm': 'true',
      'data-constants-url': constantsUrl,
      'data-login-url': CONSTANTS.LOGIN_URL || '/_hcms/mem/login',
      'data-authenticated': 'true'
    }), origin);

    // Set up mock JWT token in localStorage (Issue #253 - enrollment.js uses JWT headers)
    await page.evaluate(() => {
      localStorage.setItem('hhl_auth_token', 'mock-jwt-token-for-test');
      localStorage.setItem('hhl_auth_token_expires', String(Date.now() + 24 * 60 * 60 * 1000));
    });

    await page.addScriptTag({ content: ENROLLMENT_SCRIPT });
    await page.waitForFunction(() => typeof (window as any).hhInitEnrollment === 'function');
    await page.evaluate((slug) => { (window as any).hhInitEnrollment('course', slug); }, COURSE_SLUG);

    // Wait for enrollment state to be fetched and button to update
    // The button text should change from initial state to enrolled state
    await page.waitForFunction(() => {
      var btn = document.getElementById('hhl-enroll-button');
      return !!btn && /enrolled in course/i.test((btn.textContent || '').toLowerCase());
    }, null, { timeout: 10000 });

    const button = page.locator('#hhl-enroll-button');
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveText(/enrolled in course/i);
  });
});
