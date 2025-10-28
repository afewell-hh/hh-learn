import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { test } from '@playwright/test';
import { loginViaMembership } from '../helpers/auth';

const COURSE_SLUG = process.env.COURSE_SLUG || 'course-authoring-101';
const COURSE_URL =
  process.env.COURSE_URL ||
  `https://hedgehog.cloud/learn/courses/${COURSE_SLUG}?hs_no_cache=1`;
const LOGIN_BASE =
  process.env.HS_MEMBERSHIP_LOGIN_URL ||
  'https://hedgehog.cloud/_hcms/mem/login';
const PRIVATE_REDIRECT =
  process.env.HS_MEMBERSHIP_PRIVATE_URL ||
  'https://hedgehog.cloud/tickets';
const OUTPUT_DIR = path.join(
  process.cwd(),
  'verification-output',
  'issue-233'
);

test.describe('Membership diagnostic capture', () => {
  test('collects private vs public membership evidence', async ({
    page,
    context
  }) => {
    const username = process.env.HUBSPOT_TEST_USERNAME as string | undefined;
    const password = process.env.HUBSPOT_TEST_PASSWORD as string | undefined;

    test.skip(!username || !password, 'Test credentials are not configured');

    await context.clearCookies();
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('HHL_DEBUG', 'true');
      } catch {
        /* ignore */
      }
    });

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const consoleLogs: Array<{
      stage: 'private' | 'public';
      type: string;
      text: string;
      url: string;
    }> = [];
    let stage: 'private' | 'public' = 'private';

    page.on('console', message => {
      consoleLogs.push({
        stage,
        type: message.type(),
        text: message.text(),
        url: page.url()
      });
    });

    await loginViaMembership(page, {
      email: username!,
      password: password!,
      loginUrl: `${LOGIN_BASE}?redirect_url=${encodeURIComponent(
        PRIVATE_REDIRECT
      )}`,
      expectRedirectContains: PRIVATE_REDIRECT
    });

    const privateUrl = page.url();

    const privateProfile = await page.evaluate(async () => {
      try {
        const resp = await fetch('/_hcms/api/membership/v1/profile', {
          credentials: 'include'
        });
        const status = resp.status;
        const body = resp.headers.get('content-type')?.includes('json')
          ? await resp.json()
          : await resp.text();
        return { status, body };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    const privateScreenshotPath = path.join(
      OUTPUT_DIR,
      `private-membership-${Date.now()}.png`
    );
    await page.screenshot({ path: privateScreenshotPath, fullPage: true });

    stage = 'public';

    const cookiesAfterLogin = await context.cookies();

    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });

    const publicUrl = page.url();

    const authContext = await page.evaluate(() => {
      const el = document.getElementById('hhl-auth-context');
      if (!el) return null;
      return {
        email: el.getAttribute('data-email'),
        contactId: el.getAttribute('data-contact-id'),
        enableCrm: el.getAttribute('data-enable-crm')
      };
    });

    const courseCtaText = await page
      .locator('#hhl-enroll-button')
      .innerText()
      .catch(() => null);

    const publicProfile = await page.evaluate(async () => {
      try {
        const resp = await fetch('/_hcms/api/membership/v1/profile', {
          credentials: 'include'
        });
        const status = resp.status;
        const body = resp.headers.get('content-type')?.includes('json')
          ? await resp.json()
          : await resp.text();
        return { status, body };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    const publicScreenshotPath = path.join(
      OUTPUT_DIR,
      `public-course-${Date.now()}.png`
    );
    await page.screenshot({ path: publicScreenshotPath, fullPage: true });

    const now = new Date().toISOString();
    const output = {
      capturedAt: now,
      loginBase: LOGIN_BASE,
      privateRedirect: PRIVATE_REDIRECT,
      courseUrl: COURSE_URL,
      privateUrl,
      publicUrl,
      privateProfile,
      publicProfile,
      authContext,
      courseCtaText,
      consoleLogs,
      cookies: cookiesAfterLogin.map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite
      }))
    };

    const outputPath = path.join(
      OUTPUT_DIR,
      `membership-contrast-${now.replace(/[:]/g, '-')}.json`
    );
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  });
});
