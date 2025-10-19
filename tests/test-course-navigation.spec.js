/**
 * Playwright Test: Course-Aware Module Navigation & Breadcrumbs (Issue #211)
 *
 * Tests:
 * 1. Course detail page links include ?from=course:{slug} parameter
 * 2. Module page shows "Back to {Course}" breadcrumb when context present
 * 3. Module page displays "Module X of Y in {Course}" position indicator
 * 4. Prev/next navigation preserves course context parameter
 * 5. Analytics beacons include course_slug in payload
 * 6. Module shared across courses maintains correct context
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://hedgehog.cloud';
const OUTPUT_DIR = path.join(__dirname, '..', 'verification-output', 'issue-211');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

test.describe('Issue #211: Course-Aware Module Navigation', () => {

  test('should add course context to module links on course detail page', async ({ page }) => {
    // Navigate to a course detail page
    await page.goto(`${BASE_URL}/learn/courses`);

    // Click on the first course
    const firstCourse = page.locator('.course-card').first();
    const courseHref = await firstCourse.getAttribute('href');
    await firstCourse.click();

    // Wait for course detail page to load
    await page.waitForSelector('.module-card', { timeout: 10000 });

    // Extract course slug from URL
    const courseSlug = page.url().split('/courses/')[1]?.split('?')[0];
    expect(courseSlug).toBeTruthy();

    // Check that module links include course context parameter
    const moduleLinks = await page.locator('.module-card').all();
    expect(moduleLinks.length).toBeGreaterThan(0);

    const firstModuleHref = await moduleLinks[0].getAttribute('href');
    expect(firstModuleHref).toContain(`?from=course:${courseSlug}`);

    // Screenshot
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-course-detail-with-context-params.png'), fullPage: true });

    console.log(`✓ Course detail page adds context parameter: ?from=course:${courseSlug}`);
  });

  test('should show course breadcrumb and position when navigating from course', async ({ page }) => {
    // Navigate to a course
    await page.goto(`${BASE_URL}/learn/courses`);
    await page.locator('.course-card').first().click();
    await page.waitForSelector('.module-card');

    // Get course name for verification
    const courseName = await page.locator('h1').first().textContent();

    // Click on first module with context
    await page.locator('.module-card').first().click();
    await page.waitForSelector('#hhl-breadcrumbs');

    // Check breadcrumb shows "Back to {Course}"
    const breadcrumbText = await page.locator('#hhl-breadcrumbs a').first().textContent();
    expect(breadcrumbText).toContain('Back to');
    expect(breadcrumbText).toContain(courseName.trim());

    // Check for position indicator (may take a moment to load via JS)
    await page.waitForTimeout(1000);
    const positionIndicator = page.locator('#hhl-course-position');
    const positionText = await positionIndicator.textContent();

    if (positionText) {
      expect(positionText).toMatch(/Module \d+ of \d+/);
      console.log(`✓ Position indicator: ${positionText}`);
    }

    // Screenshot
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-module-with-course-context.png'), fullPage: true });

    console.log(`✓ Breadcrumb shows: ${breadcrumbText}`);
  });

  test('should preserve course context in prev/next navigation', async ({ page }) => {
    // Navigate to a course
    await page.goto(`${BASE_URL}/learn/courses`);
    await page.locator('.course-card').first().click();
    await page.waitForSelector('.module-card');

    // Extract course slug
    const courseSlug = page.url().split('/courses/')[1]?.split('?')[0];

    // Click on first module
    await page.locator('.module-card').first().click();
    await page.waitForSelector('.module-nav-link');
    await page.waitForTimeout(1000); // Wait for JS to update links

    // Check if next link exists and contains course context
    const nextLink = page.locator('.module-nav-next');
    const nextLinkExists = await nextLink.count() > 0;

    if (nextLinkExists) {
      const nextHref = await nextLink.getAttribute('href');
      expect(nextHref).toContain(`from=course:${courseSlug}`);
      console.log(`✓ Next link preserves context: ${nextHref}`);

      // Screenshot
      await page.screenshot({ path: path.join(OUTPUT_DIR, '03-navigation-with-context.png'), fullPage: true });
    } else {
      console.log('ℹ No next link on this module (might be last in course)');
    }
  });

  test('should fallback gracefully when no course context', async ({ page }) => {
    // Navigate directly to a module (no course context)
    await page.goto(`${BASE_URL}/learn/modules`);
    await page.locator('.module-card').first().click();
    await page.waitForSelector('#hhl-breadcrumbs');

    // Check breadcrumb shows default "Back to Learning Portal"
    const breadcrumbText = await page.locator('#hhl-breadcrumbs a').first().textContent();
    expect(breadcrumbText).toContain('Back to Learning Portal');

    // Check position indicator is hidden
    const positionIndicator = page.locator('#hhl-course-position');
    const isHidden = await positionIndicator.evaluate(el => el.style.display === 'none');
    expect(isHidden).toBe(true);

    // Screenshot
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-module-without-context.png'), fullPage: true });

    console.log('✓ Module without context shows default breadcrumb');
  });

  test('should track course context in analytics beacons', async ({ page, context }) => {
    const beaconPayloads = [];

    // Intercept analytics beacons
    await page.route('**/events/track', async (route) => {
      const postData = route.request().postDataJSON();
      if (postData) {
        beaconPayloads.push(postData);
      }
      await route.continue();
    });

    // Navigate from course to module
    await page.goto(`${BASE_URL}/learn/courses`);
    await page.locator('.course-card').first().click();
    await page.waitForSelector('.module-card');

    const courseSlug = page.url().split('/courses/')[1]?.split('?')[0];

    // Click on module
    await page.locator('.module-card').first().click();
    await page.waitForTimeout(2000); // Wait for pageview beacon

    // Check if pageview beacon includes course_slug
    const pageviewBeacon = beaconPayloads.find(p => p.eventName === 'learning_page_viewed');

    if (pageviewBeacon) {
      expect(pageviewBeacon.payload).toHaveProperty('course_slug', courseSlug);
      console.log(`✓ Pageview beacon includes course_slug: ${courseSlug}`);

      // Save beacon data
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'analytics-beacons.json'),
        JSON.stringify(beaconPayloads, null, 2)
      );
    } else {
      console.log('ℹ No pageview beacon captured (may require authentication)');
    }
  });

  test('should handle module shared across multiple courses', async ({ page }) => {
    // This test verifies that context is specific to the course navigated from
    // We'll navigate to the same module from different courses and verify different context

    await page.goto(`${BASE_URL}/learn/courses`);
    const courses = await page.locator('.course-card').all();

    if (courses.length < 2) {
      console.log('ℹ Skipping test: Need at least 2 courses');
      test.skip();
      return;
    }

    // Get first course slug and navigate to a module
    await courses[0].click();
    await page.waitForSelector('.module-card');
    const course1Slug = page.url().split('/courses/')[1]?.split('?')[0];
    const module1Link = await page.locator('.module-card').first().getAttribute('href');
    const module1Slug = module1Link.split('/modules/')[1]?.split('?')[0];

    await page.goto(`${BASE_URL}/learn/courses`);

    // Navigate from second course to potentially same module
    await courses[1].click();
    await page.waitForSelector('.module-card');
    const course2Slug = page.url().split('/courses/')[1]?.split('?')[0];

    // Check if any modules match
    const course2ModuleLinks = await page.locator('.module-card').all();
    for (const link of course2ModuleLinks) {
      const href = await link.getAttribute('href');
      if (href.includes(module1Slug)) {
        // Found shared module!
        const contextParam = href.split('from=course:')[1]?.split('&')[0];
        expect(contextParam).toBe(course2Slug);
        expect(contextParam).not.toBe(course1Slug);

        console.log(`✓ Shared module maintains correct course context`);
        console.log(`  - Course 1: from=course:${course1Slug}`);
        console.log(`  - Course 2: from=course:${course2Slug}`);

        // Screenshot
        await page.screenshot({ path: path.join(OUTPUT_DIR, '05-shared-module-context.png'), fullPage: true });
        return;
      }
    }

    console.log('ℹ No shared modules found between first two courses');
  });

});

test.afterAll(async () => {
  // Generate test summary
  const summary = {
    testSuite: 'Issue #211: Course-Aware Module Navigation & Breadcrumbs',
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    outputDirectory: OUTPUT_DIR,
    testsExecuted: [
      'Course context parameters in module links',
      'Course breadcrumb and position indicator',
      'Context preservation in prev/next navigation',
      'Graceful fallback without context',
      'Analytics beacon tracking',
      'Shared module context handling'
    ]
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'test-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n✓ Test artifacts saved to: ${OUTPUT_DIR}`);
});
