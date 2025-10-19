import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'https://hedgehog.cloud';

test.describe('Catalog Filters - Issue #212', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/learn/catalog`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#catalog-grid', { timeout: 10000 });
  });

  test('should display all filter controls enabled', async ({ page }) => {
    // Verify search input is enabled
    const searchInput = page.locator('#filter-search');
    await expect(searchInput).toBeEnabled();
    await expect(searchInput).toHaveAttribute('placeholder', /search/i);

    // Verify type checkboxes are enabled
    const typeCheckboxes = page.locator('input[name="type"]');
    await expect(typeCheckboxes).toHaveCount(4); // All, Modules, Courses, Pathways
    for (let i = 0; i < await typeCheckboxes.count(); i++) {
      await expect(typeCheckboxes.nth(i)).toBeEnabled();
    }

    // Verify level checkboxes are enabled
    const levelCheckboxes = page.locator('input[name="level"]');
    await expect(levelCheckboxes).toHaveCount(4); // All, Beginner, Intermediate, Advanced
    for (let i = 0; i < await levelCheckboxes.count(); i++) {
      await expect(levelCheckboxes.nth(i)).toBeEnabled();
    }

    // Verify duration select is enabled
    const durationSelect = page.locator('#filter-duration');
    await expect(durationSelect).toBeEnabled();

    // Verify clear filters button exists and is enabled
    const clearButton = page.locator('#clear-filters');
    await expect(clearButton).toBeEnabled();
  });

  test('should show results count', async ({ page }) => {
    const resultsCount = page.locator('.learn-filter-results');
    await expect(resultsCount).toBeVisible();

    const visibleCount = page.locator('#visible-count');
    const totalCount = page.locator('#total-count');

    await expect(visibleCount).toBeVisible();
    await expect(totalCount).toBeVisible();

    // Both should have numeric values
    const visible = await visibleCount.textContent();
    const total = await totalCount.textContent();
    expect(parseInt(visible || '0')).toBeGreaterThan(0);
    expect(parseInt(total || '0')).toBeGreaterThan(0);
  });

  test('should filter by search term', async ({ page }) => {
    const searchInput = page.locator('#filter-search');
    const visibleCount = page.locator('#visible-count');

    // Get initial count
    const initialCount = await visibleCount.textContent();

    // Type search term
    await searchInput.fill('kubernetes');
    await page.waitForTimeout(500); // Wait for debounce

    // Count should change (unless all items contain "kubernetes")
    const newCount = await visibleCount.textContent();

    // Verify at least one card is visible or no results message shown
    const catalogGrid = page.locator('#catalog-grid');
    const noResults = page.locator('#no-results');

    if (parseInt(newCount || '0') > 0) {
      await expect(catalogGrid).toBeVisible();
      await expect(noResults).toBeHidden();
    } else {
      await expect(catalogGrid).toBeHidden();
      await expect(noResults).toBeVisible();
    }
  });

  test('should filter by type (modules only)', async ({ page }) => {
    // Uncheck "All"
    await page.locator('input[name="type"][value="all"]').uncheck();

    // Check only "module"
    await page.locator('input[name="type"][value="module"]').check();
    await page.waitForTimeout(300);

    // Verify only module cards are visible
    const visibleCards = page.locator('.catalog-card:not(.hidden)');
    const count = await visibleCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const cardType = await visibleCards.nth(i).getAttribute('data-type');
        expect(cardType).toBe('module');
      }
    }
  });

  test('should filter by level (beginner only)', async ({ page }) => {
    // Uncheck "All"
    await page.locator('input[name="level"][value="all"]').uncheck();

    // Check only "beginner"
    await page.locator('input[name="level"][value="beginner"]').check();
    await page.waitForTimeout(300);

    // Verify only beginner cards are visible
    const visibleCards = page.locator('.catalog-card:not(.hidden)');
    const count = await visibleCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const cardLevel = await visibleCards.nth(i).getAttribute('data-level');
        // Allow empty levels or beginner
        if (cardLevel) {
          expect(cardLevel).toBe('beginner');
        }
      }
    }
  });

  test('should filter by duration', async ({ page }) => {
    const durationSelect = page.locator('#filter-duration');

    // Select "Under 30 min"
    await durationSelect.selectOption('0-30');
    await page.waitForTimeout(300);

    // Verify only cards with duration < 30 are visible
    const visibleCards = page.locator('.catalog-card:not(.hidden)');
    const count = await visibleCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const duration = await visibleCards.nth(i).getAttribute('data-duration');
        if (duration) {
          expect(parseInt(duration)).toBeLessThanOrEqual(30);
        }
      }
    }
  });

  test('should combine multiple filters', async ({ page }) => {
    // Filter by type=module AND level=beginner
    await page.locator('input[name="type"][value="all"]').uncheck();
    await page.locator('input[name="type"][value="module"]').check();
    await page.locator('input[name="level"][value="all"]').uncheck();
    await page.locator('input[name="level"][value="beginner"]').check();
    await page.waitForTimeout(300);

    // Verify visible cards match both filters
    const visibleCards = page.locator('.catalog-card:not(.hidden)');
    const count = await visibleCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const cardType = await visibleCards.nth(i).getAttribute('data-type');
        const cardLevel = await visibleCards.nth(i).getAttribute('data-level');
        expect(cardType).toBe('module');
        if (cardLevel) {
          expect(cardLevel).toBe('beginner');
        }
      }
    }
  });

  test('should clear all filters', async ({ page }) => {
    const clearButton = page.locator('#clear-filters');
    const searchInput = page.locator('#filter-search');
    const visibleCount = page.locator('#visible-count');
    const totalCount = page.locator('#total-count');

    // Apply some filters
    await searchInput.fill('test');
    await page.locator('input[name="type"][value="all"]').uncheck();
    await page.locator('input[name="type"][value="module"]').check();
    await page.locator('#filter-duration').selectOption('0-30');
    await page.waitForTimeout(500);

    // Click clear filters
    await clearButton.click();
    await page.waitForTimeout(300);

    // Verify all filters are reset
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('#filter-duration')).toHaveValue('all');

    // All checkboxes should be checked
    const allTypeCheckboxes = page.locator('input[name="type"]');
    for (let i = 0; i < await allTypeCheckboxes.count(); i++) {
      await expect(allTypeCheckboxes.nth(i)).toBeChecked();
    }

    const allLevelCheckboxes = page.locator('input[name="level"]');
    for (let i = 0; i < await allLevelCheckboxes.count(); i++) {
      await expect(allLevelCheckboxes.nth(i)).toBeChecked();
    }

    // Visible count should equal total count
    const visible = await visibleCount.textContent();
    const total = await totalCount.textContent();
    expect(visible).toBe(total);
  });

  test('should handle "All" checkbox logic for type', async ({ page }) => {
    const allCheckbox = page.locator('input[name="type"][value="all"]');
    const moduleCheckbox = page.locator('input[name="type"][value="module"]');
    const courseCheckbox = page.locator('input[name="type"][value="course"]');
    const pathwayCheckbox = page.locator('input[name="type"][value="pathway"]');

    // Uncheck one specific type
    await moduleCheckbox.uncheck();
    await page.waitForTimeout(100);

    // "All" should automatically uncheck
    await expect(allCheckbox).not.toBeChecked();

    // Re-check the module
    await moduleCheckbox.check();
    await page.waitForTimeout(100);

    // Now all individual items are checked, so "All" should auto-check
    await expect(allCheckbox).toBeChecked();
  });

  test('should show no results message when filters match nothing', async ({ page }) => {
    const searchInput = page.locator('#filter-search');
    const noResults = page.locator('#no-results');
    const catalogGrid = page.locator('#catalog-grid');

    // Search for something that definitely doesn't exist
    await searchInput.fill('xyzzynonexistentcontent123');
    await page.waitForTimeout(500);

    // Should show no results message
    await expect(noResults).toBeVisible();
    await expect(catalogGrid).toBeHidden();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab to search input
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Continue tabbing until we reach the search input (varies by page structure)

    const searchInput = page.locator('#filter-search');
    await searchInput.focus();
    await expect(searchInput).toBeFocused();

    // Type using keyboard
    await page.keyboard.type('cloud');
    await page.waitForTimeout(500);

    // Tab to checkboxes and use Space to toggle
    await page.keyboard.press('Tab');
    const firstTypeCheckbox = page.locator('input[name="type"]').first();
    await firstTypeCheckbox.focus();

    // Space should toggle checkbox
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  });

  test('should have proper ARIA labels', async ({ page }) => {
    // Search input
    const searchInput = page.locator('#filter-search');
    await expect(searchInput).toHaveAttribute('aria-label', /search/i);

    // Duration select
    const durationSelect = page.locator('#filter-duration');
    await expect(durationSelect).toHaveAttribute('aria-label', /duration/i);

    // Clear button
    const clearButton = page.locator('#clear-filters');
    await expect(clearButton).toHaveAttribute('aria-label', /clear/i);

    // Results count should have aria-live
    const resultsCount = page.locator('.learn-filter-results');
    await expect(resultsCount).toHaveAttribute('aria-live', 'polite');
  });

  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/learn/catalog`, { waitUntil: 'domcontentloaded' });

    // Open mobile nav if needed
    const navToggle = page.locator('#learn-nav-toggle');
    if (await navToggle.isVisible()) {
      await navToggle.click();
      await page.waitForTimeout(300);
    }

    // Filters should still be functional
    const searchInput = page.locator('#filter-search');
    await expect(searchInput).toBeEnabled();

    await searchInput.fill('test');
    await page.waitForTimeout(500);

    // Verify filtering works
    const visibleCount = page.locator('#visible-count');
    await expect(visibleCount).toBeVisible();
  });
});
