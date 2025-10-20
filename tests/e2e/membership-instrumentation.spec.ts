/**
 * Membership Profile Instrumentation Test (Issue #237)
 *
 * IMPORTANT: These are LIVE INTEGRATION TESTS that hit production (hedgehog.cloud)
 * to diagnose real membership session behavior for Issue #233.
 *
 * These tests are SKIPPED BY DEFAULT to avoid:
 * - External dependencies in CI/CD
 * - Failures in disconnected environments
 * - Brittleness from production changes
 *
 * To run these tests, set the environment variable:
 *   RUN_LIVE_TESTS=true npx playwright test tests/e2e/membership-instrumentation.spec.ts --headed
 *
 * Captures:
 * - Membership profile API responses (/_hcms/api/membership/v1/profile)
 * - Cookie names and persistence across redirects
 * - Auth context bootstrapper state
 * - HubSpot tracking variables
 */

import 'dotenv/config';
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const COURSE_URL = process.env.COURSE_URL || 'https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1';
const OUTPUT_DIR = path.join(process.cwd(), 'verification-output', 'issue-237');
const RUN_LIVE_TESTS = process.env.RUN_LIVE_TESTS === 'true';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Helper to save captured data to JSON file
 */
function saveCapture(filename: string, data: any) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[CAPTURE] Saved to ${filepath}`);
}

test.describe('Membership instrumentation (Issue #237)', () => {

  test('capture anonymous session behavior', async ({ page, context }) => {
    test.skip(!RUN_LIVE_TESTS, 'Live tests disabled - set RUN_LIVE_TESTS=true to run');
    const capture: any = {
      test: 'anonymous session',
      timestamp: new Date().toISOString(),
      url: COURSE_URL,
      steps: []
    };

    // Clear all cookies to ensure anonymous state
    await context.clearCookies();

    // Navigate to course page
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Wait for scripts to load

    // Capture cookies (names only)
    const cookies = await context.cookies();
    const cookieNames = cookies.map(c => c.name);
    const hubspotCookies = cookies.filter(c =>
      c.name.startsWith('hs') ||
      c.name.startsWith('__hs') ||
      c.name.includes('hubspot')
    );

    capture.steps.push({
      step: 'initial page load',
      cookies: {
        total: cookieNames.length,
        names: cookieNames,
        hubspot_count: hubspotCookies.length,
        hubspot_names: hubspotCookies.map(c => c.name)
      }
    });

    // Capture auth context
    const authContext = await page.evaluate(() => {
      const el = document.getElementById('hhl-auth-context');
      if (!el) return { error: 'Element not found' };
      return {
        exists: true,
        email: el.getAttribute('data-email'),
        contactId: el.getAttribute('data-contact-id'),
        enableCrm: el.getAttribute('data-enable-crm'),
        constantsUrl: el.getAttribute('data-constants-url'),
        loginUrl: el.getAttribute('data-login-url')
      };
    });

    capture.steps.push({
      step: 'auth context check',
      authContext
    });

    // Try to fetch membership profile API
    const profileApiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/_hcms/api/membership/v1/profile', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        const result: any = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: {
            'content-type': response.headers.get('content-type'),
            'cache-control': response.headers.get('cache-control')
          }
        };

        if (response.ok) {
          const data = await response.json();
          result.body = data;
          result.bodyKeys = Object.keys(data);
        } else {
          result.bodyText = await response.text();
        }

        return result;
      } catch (error: any) {
        return {
          error: error.message,
          stack: error.stack
        };
      }
    });

    capture.steps.push({
      step: 'membership profile API call',
      response: profileApiResponse
    });

    // Check if debug module is loaded
    const debugModuleState = await page.evaluate(() => {
      return {
        hhDebugExists: typeof (window as any).hhDebug !== 'undefined',
        hhDebugEnabled: (window as any).hhDebug?.enabled || false,
        enableHhlDebugExists: typeof (window as any).enableHhlDebug === 'function',
        disableHhlDebugExists: typeof (window as any).disableHhlDebug === 'function'
      };
    });

    capture.steps.push({
      step: 'debug module check',
      debugModule: debugModuleState
    });

    // Save capture
    saveCapture('anonymous-session-capture.json', capture);

    // Assertions
    expect(authContext).toBeDefined();
    expect(cookieNames.length).toBeGreaterThan(0); // Should have at least tracking cookies
  });

  test('capture authenticated session behavior', async ({ page, context }) => {
    test.skip(!RUN_LIVE_TESTS, 'Live tests disabled - set RUN_LIVE_TESTS=true to run');

    const username = process.env.HUBSPOT_TEST_USERNAME as string;
    const password = process.env.HUBSPOT_TEST_PASSWORD as string;

    test.skip(!username || !password, 'Test credentials not provided');

    const capture: any = {
      test: 'authenticated session',
      timestamp: new Date().toISOString(),
      url: COURSE_URL,
      credentials: {
        username: username ? '(provided)' : '(missing)',
        password: password ? '(provided)' : '(missing)'
      },
      steps: []
    };

    // Clear cookies to start fresh
    await context.clearCookies();

    // Navigate to course page
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Capture pre-login state
    const preLoginCookies = await context.cookies();
    capture.steps.push({
      step: 'pre-login cookies',
      cookies: {
        total: preLoginCookies.length,
        names: preLoginCookies.map(c => c.name)
      }
    });

    // Click sign in button
    const ctaButton = page.locator('#hhl-enroll-button');
    await ctaButton.waitFor({ state: 'visible', timeout: 10000 });
    const initialText = await ctaButton.innerText();
    capture.steps.push({
      step: 'pre-login CTA state',
      buttonText: initialText
    });

    // Navigate to login
    await Promise.all([
      page.waitForURL(/_hcms\/mem\/login/, { timeout: 20000 }),
      ctaButton.click()
    ]);

    // Capture cookies after redirect to login
    const loginPageCookies = await context.cookies();
    capture.steps.push({
      step: 'login page redirect',
      url: page.url(),
      cookies: {
        total: loginPageCookies.length,
        names: loginPageCookies.map(c => c.name),
        new_cookies: loginPageCookies
          .filter(c => !preLoginCookies.find(pc => pc.name === c.name))
          .map(c => c.name)
      }
    });

    // Fill in login form
    const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(username);

    const passwordInput = page.locator('input[type="password"], input[name="password"], input#password').first();
    await passwordInput.fill(password);

    // Submit login
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();

    // Capture network responses during login
    const loginResponses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('_hcms') || response.url().includes('membership')) {
        const allHeaders = response.headers();
        const filteredHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(allHeaders)) {
          if (key.toLowerCase().includes('set-cookie') ||
              key.toLowerCase().includes('location') ||
              key.toLowerCase().includes('content-type')) {
            filteredHeaders[key] = value;
          }
        }

        loginResponses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: filteredHeaders
        });
      }
    });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
      submitButton.click()
    ]);

    capture.steps.push({
      step: 'login form submission',
      loginResponses
    });

    // Wait for redirect back to course page
    await page.waitForURL(/\/learn\/courses\//, { timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for scripts to execute

    // Capture post-login cookies
    const postLoginCookies = await context.cookies();
    const newCookiesAfterLogin = postLoginCookies.filter(c =>
      !preLoginCookies.find(pc => pc.name === c.name)
    );

    capture.steps.push({
      step: 'post-login cookies',
      url: page.url(),
      cookies: {
        total: postLoginCookies.length,
        names: postLoginCookies.map(c => c.name),
        new_cookies: newCookiesAfterLogin.map(c => ({
          name: c.name,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite
        }))
      }
    });

    // Capture post-login auth context
    const postLoginAuthContext = await page.evaluate(() => {
      const el = document.getElementById('hhl-auth-context');
      if (!el) return { error: 'Element not found' };
      return {
        exists: true,
        email: el.getAttribute('data-email'),
        contactId: el.getAttribute('data-contact-id'),
        enableCrm: el.getAttribute('data-enable-crm'),
        constantsUrl: el.getAttribute('data-constants-url'),
        loginUrl: el.getAttribute('data-login-url'),
        hasEmail: !!(el.getAttribute('data-email')),
        hasContactId: !!(el.getAttribute('data-contact-id'))
      };
    });

    capture.steps.push({
      step: 'post-login auth context',
      authContext: postLoginAuthContext
    });

    // Capture membership profile API response
    const postLoginProfileApi = await page.evaluate(async () => {
      try {
        const response = await fetch('/_hcms/api/membership/v1/profile', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });

        const result: any = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: {
            'content-type': response.headers.get('content-type'),
            'cache-control': response.headers.get('cache-control')
          }
        };

        if (response.ok) {
          const data = await response.json();
          // Redact PII but keep structure
          result.bodyKeys = Object.keys(data);
          result.hasEmail = !!data.email;
          result.hasContactId = !!(data.contactId || data.vid || data.hs_object_id);
          result.isLoggedIn = !!data.is_logged_in;
        } else {
          result.bodyText = await response.text();
        }

        return result;
      } catch (error: any) {
        return {
          error: error.message
        };
      }
    });

    capture.steps.push({
      step: 'post-login membership profile API',
      response: postLoginProfileApi
    });

    // Capture CTA button state
    const postLoginButtonText = await ctaButton.innerText();
    capture.steps.push({
      step: 'post-login CTA state',
      buttonText: postLoginButtonText
    });

    // Save capture
    saveCapture('authenticated-session-capture.json', capture);

    // Take screenshots
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'post-login-page.png'),
      fullPage: true
    });

    // Assertions
    expect(postLoginAuthContext).toBeDefined();
    console.log('\n[CAPTURE SUMMARY]');
    console.log('Pre-login cookies:', preLoginCookies.length);
    console.log('Post-login cookies:', postLoginCookies.length);
    console.log('New cookies after login:', newCookiesAfterLogin.length);
    console.log('Auth context has email:', postLoginAuthContext.hasEmail);
    console.log('Auth context has contactId:', postLoginAuthContext.hasContactId);
    console.log('Profile API status:', postLoginProfileApi.status);
    console.log('\nFull capture saved to:', OUTPUT_DIR);
  });

  test('test debug module with HHL_DEBUG enabled', async ({ page, context }) => {
    test.skip(!RUN_LIVE_TESTS, 'Live tests disabled - set RUN_LIVE_TESTS=true to run');

    // Clear cookies
    await context.clearCookies();

    // Navigate and enable debug mode
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });

    // Enable debug mode
    await page.evaluate(() => {
      localStorage.setItem('HHL_DEBUG', 'true');
    });

    // Reload to trigger debug instrumentation
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[hhl')) {
        consoleLogs.push(text);
      }
    });

    // Trigger debug checks manually
    const debugOutput = await page.evaluate(() => {
      const debug = (window as any).hhDebug;
      if (!debug) return { error: 'Debug module not loaded' };

      // Capture console output by overriding console methods temporarily
      const logs: string[] = [];
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = (...args: any[]) => {
        logs.push('LOG: ' + args.join(' '));
        originalLog.apply(console, args);
      };
      console.warn = (...args: any[]) => {
        logs.push('WARN: ' + args.join(' '));
        originalWarn.apply(console, args);
      };
      console.error = (...args: any[]) => {
        logs.push('ERROR: ' + args.join(' '));
        originalError.apply(console, args);
      };

      // Run debug checks
      debug.runAll();

      // Restore console
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;

      return {
        enabled: debug.enabled,
        logs: logs.slice(0, 50) // Limit to prevent huge output
      };
    });

    const capture = {
      test: 'debug module verification',
      timestamp: new Date().toISOString(),
      debugOutput,
      consoleLogs: consoleLogs.slice(0, 50)
    };

    saveCapture('debug-module-output.json', capture);

    expect(debugOutput.enabled).toBe(true);
  });
});
