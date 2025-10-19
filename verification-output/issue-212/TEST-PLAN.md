# Issue #212: Catalog Filters - Test Plan

## Overview

This document outlines the comprehensive test plan for verifying the catalog filter functionality meets all acceptance criteria from Issue #212.

## Test Environment

- **Base URL:** `https://hedgehog.cloud` (production) or staging environment
- **Test Pages:** `/learn/catalog`
- **Browsers:** Chrome (latest), Firefox (latest), Safari (latest)
- **Viewports:** Desktop (1366x900), Mobile (390x844)

## Automated Test Suite

**Location:** `/tests/e2e-catalog-filters.spec.ts`

### Test Cases

| # | Test Name | Description | Assertion |
|---|-----------|-------------|-----------|
| 1 | Display all filter controls enabled | Verifies search, checkboxes, select, and button are enabled | All controls have `enabled` state |
| 2 | Show results count | Verifies results counter displays and updates | "Showing X of Y items" visible |
| 3 | Filter by search term | Types in search box and verifies filtering | Cards filtered by title/tags |
| 4 | Filter by type (modules only) | Selects only "Modules" checkbox | Only module cards visible |
| 5 | Filter by level (beginner only) | Selects only "Beginner" checkbox | Only beginner cards visible |
| 6 | Filter by duration | Selects "Under 30 min" | Only cards ≤30 min visible |
| 7 | Combine multiple filters | Applies type=module AND level=beginner | Cards match both criteria |
| 8 | Clear all filters | Clicks "Clear Filters" button | All filters reset, all items shown |
| 9 | "All" checkbox logic for type | Tests auto-toggle behavior | "All" syncs with individual selections |
| 10 | Show no results message | Searches for non-existent term | "No results" message displayed |
| 11 | Keyboard accessible | Tabs and uses Space to interact | All controls keyboard navigable |
| 12 | Proper ARIA labels | Checks aria-label attributes | All controls have descriptive labels |
| 13 | Work on mobile viewport | Tests filters on 390px width | Filters functional on mobile |
| 14 | Handle edge cases | Tests empty results, all unchecked, etc. | Graceful handling |

### Running the Tests

```bash
# Run all tests
npx playwright test tests/e2e-catalog-filters.spec.ts

# Run with UI (headed mode)
npx playwright test tests/e2e-catalog-filters.spec.ts --headed

# Run specific test
npx playwright test tests/e2e-catalog-filters.spec.ts -g "should filter by search term"

# Generate HTML report
npx playwright test tests/e2e-catalog-filters.spec.ts --reporter=html

# Debug mode
npx playwright test tests/e2e-catalog-filters.spec.ts --debug
```

## Manual Test Cases

### Test Case 1: Visual Verification

**Objective:** Confirm filters are visually enabled and styled correctly

**Steps:**
1. Navigate to `/learn/catalog`
2. Observe the left sidebar filter panel

**Expected Results:**
- [ ] Search input has white background (not grayed)
- [ ] All checkboxes are clickable (not disabled appearance)
- [ ] Duration dropdown is clickable
- [ ] "Clear Filters" button is visible and styled
- [ ] Results count shows "Showing X of Y items"
- [ ] NO "Filters coming soon!" message

**Pass Criteria:** All visual elements match expected state

---

### Test Case 2: Search Filter

**Objective:** Verify search filters by title and tags

**Steps:**
1. Navigate to `/learn/catalog`
2. Note initial item count
3. Type "kubernetes" in search box
4. Wait 500ms for debounce

**Expected Results:**
- [ ] Only items with "kubernetes" in title or tags remain visible
- [ ] Results count updates: "Showing N of M items" (N < M)
- [ ] Hidden cards have `display: none` or `.hidden` class
- [ ] Search input retains focus while typing

**Pass Criteria:** Filtering works, count updates, UX smooth

---

### Test Case 3: Type Filter - Single Selection

**Objective:** Filter by content type

**Steps:**
1. Navigate to `/learn/catalog`
2. Uncheck "All" in Type section
3. Check only "Modules"

**Expected Results:**
- [ ] Only cards with `data-type="module"` visible
- [ ] Course and Pathway cards hidden
- [ ] Results count reflects filtered items
- [ ] "All" checkbox remains unchecked

**Pass Criteria:** Only modules displayed

---

### Test Case 4: Type Filter - Multiple Selection

**Objective:** Filter by multiple types

**Steps:**
1. Navigate to `/learn/catalog`
2. Uncheck "All" in Type section
3. Check "Modules" and "Courses" (leave "Pathways" unchecked)

**Expected Results:**
- [ ] Module and Course cards visible
- [ ] Pathway cards hidden
- [ ] Results count = modules + courses
- [ ] "All" checkbox remains unchecked

**Pass Criteria:** Union of selected types displayed

---

### Test Case 5: Level Filter

**Objective:** Filter by difficulty level

**Steps:**
1. Navigate to `/learn/catalog`
2. Uncheck "All" in Level section
3. Check only "Beginner"

**Expected Results:**
- [ ] Only cards with `data-level="beginner"` visible
- [ ] Items with no level (empty) may also appear (verify expected behavior)
- [ ] Results count updates
- [ ] Other difficulty cards hidden

**Pass Criteria:** Beginner items displayed correctly

---

### Test Case 6: Duration Filter

**Objective:** Filter by time duration

**Steps:**
1. Navigate to `/learn/catalog`
2. Select "Under 30 min" from Duration dropdown

**Expected Results:**
- [ ] Only cards with `data-duration ≤ 30` visible
- [ ] Longer content hidden
- [ ] Results count reflects filtered subset
- [ ] Dropdown retains selection

**Pass Criteria:** Duration filtering accurate

---

### Test Case 7: Combined Filters

**Objective:** Multiple filters work together (intersection)

**Steps:**
1. Navigate to `/learn/catalog`
2. Search for "cloud"
3. Select Type = "Modules"
4. Select Level = "Beginner"
5. Select Duration = "Under 30 min"

**Expected Results:**
- [ ] Only items matching ALL criteria visible:
  - Contains "cloud" in title/tags
  - Is a module
  - Is beginner level
  - Duration ≤ 30 minutes
- [ ] If no items match, "No results" message shown
- [ ] Results count shows filtered count

**Pass Criteria:** Intersection logic correct

---

### Test Case 8: Clear Filters

**Objective:** Reset all filters to default state

**Steps:**
1. Navigate to `/learn/catalog`
2. Apply several filters (search, type, level, duration)
3. Note filtered count
4. Click "Clear Filters" button

**Expected Results:**
- [ ] Search input clears to empty
- [ ] All Type checkboxes become checked
- [ ] All Level checkboxes become checked
- [ ] Duration dropdown resets to "Any duration"
- [ ] All items reappear
- [ ] Results count shows: "Showing M of M items" (all items)

**Pass Criteria:** Complete reset to initial state

---

### Test Case 9: "All" Checkbox Logic

**Objective:** "All" auto-toggles based on individual selections

**Steps:**
1. Navigate to `/learn/catalog`
2. Uncheck "Modules" (Type section)
3. Observe "All" checkbox
4. Re-check "Modules"
5. Observe "All" checkbox

**Expected Results:**
- [ ] When "Modules" unchecked: "All" unchecks automatically
- [ ] When all individual items checked: "All" checks automatically
- [ ] Clicking "All" checks/unchecks all other items in group

**Pass Criteria:** "All" syncs with individual state

---

### Test Case 10: No Results State

**Objective:** Display appropriate message when no matches

**Steps:**
1. Navigate to `/learn/catalog`
2. Search for "xyznonexistentcontent123"

**Expected Results:**
- [ ] Message "No items match your current filters. Try adjusting your selections." displays
- [ ] Catalog grid hidden (`display: none`)
- [ ] Results count shows: "Showing 0 of M items"
- [ ] No JavaScript errors in console

**Pass Criteria:** Graceful empty state handling

---

### Test Case 11: Keyboard Navigation

**Objective:** Verify full keyboard accessibility

**Steps:**
1. Navigate to `/learn/catalog`
2. Press Tab repeatedly to cycle through filters
3. Use Space to toggle checkboxes
4. Use Arrow keys in dropdown
5. Press Enter on "Clear Filters" button

**Expected Results:**
- [ ] All controls receive visible focus outline
- [ ] Focus order is logical (top to bottom)
- [ ] Space toggles checkboxes
- [ ] Enter activates buttons
- [ ] Arrow keys navigate dropdown options
- [ ] Escape key (if implemented) clears focus

**Pass Criteria:** Full keyboard operability

---

### Test Case 12: Screen Reader Compatibility

**Objective:** Verify assistive technology support

**Tools:** NVDA (Windows), VoiceOver (Mac), or JAWS

**Steps:**
1. Navigate to `/learn/catalog` with screen reader active
2. Tab to search input
3. Tab through checkboxes
4. Tab to "Clear Filters" button
5. Apply a filter and listen for announcements

**Expected Results:**
- [ ] Search input announced with label "Search by title or tags"
- [ ] Checkboxes announced with labels and checked state
- [ ] Dropdown announced with label and current selection
- [ ] Button announced as "Clear all filters"
- [ ] Results count changes announced via `aria-live="polite"`
- [ ] Form structure (fieldset/legend) properly announced

**Pass Criteria:** All controls properly announced

---

### Test Case 13: Mobile Responsive

**Objective:** Filters work on mobile viewport

**Steps:**
1. Open browser DevTools
2. Set viewport to 390 x 844 (iPhone 12 Pro)
3. Navigate to `/learn/catalog`
4. Click mobile nav toggle button
5. Apply filters

**Expected Results:**
- [ ] Nav opens as overlay/drawer
- [ ] Filters visible and accessible
- [ ] Touch targets ≥ 44x44px
- [ ] Search, checkboxes, dropdown all work via touch
- [ ] Results update correctly
- [ ] Clear button works

**Pass Criteria:** Full functionality on mobile

---

### Test Case 14: Browser Compatibility

**Objective:** Ensure cross-browser support

**Browsers:** Chrome, Firefox, Safari

**Steps:**
1. Test all above scenarios in each browser
2. Check for visual consistency
3. Verify no JavaScript errors

**Expected Results:**
- [ ] Chrome: All features work
- [ ] Firefox: All features work
- [ ] Safari: All features work
- [ ] Checkbox accent colors display (may vary by browser)
- [ ] No console errors in any browser

**Pass Criteria:** Consistent behavior across browsers

---

## Accessibility Testing

### Lighthouse Audit

**Tool:** Chrome DevTools > Lighthouse

**Steps:**
1. Navigate to `/learn/catalog`
2. Open DevTools (F12)
3. Go to "Lighthouse" tab
4. Select "Accessibility" category
5. Click "Analyze page load"

**Pass Criteria:**
- [ ] Accessibility score ≥ 95
- [ ] No critical accessibility issues
- [ ] All form elements have labels
- [ ] Color contrast meets WCAG AA
- [ ] ARIA usage is correct

**Store Report:** `verification-output/issue-212/lighthouse-report.html`

---

### axe DevTools

**Tool:** axe DevTools browser extension

**Steps:**
1. Install axe DevTools extension
2. Navigate to `/learn/catalog`
3. Open axe DevTools panel
4. Click "Scan"

**Pass Criteria:**
- [ ] 0 critical issues
- [ ] 0 serious issues
- [ ] Minor issues documented for future improvement

**Store Report:** `verification-output/issue-212/axe-report.json`

---

## Performance Testing

### Filter Response Time

**Objective:** Filters update quickly without lag

**Steps:**
1. Navigate to catalog with many items (20+ items)
2. Type quickly in search box
3. Toggle multiple checkboxes rapidly
4. Change dropdown repeatedly

**Expected Results:**
- [ ] Search debounces at 300ms (doesn't lag browser)
- [ ] Checkbox changes apply within 100ms
- [ ] Dropdown changes apply within 100ms
- [ ] No visible jank or reflow
- [ ] Smooth user experience

**Pass Criteria:** All interactions feel instant

---

## Regression Testing

### Verify Existing Features Still Work

**Areas to Check:**
1. [ ] Catalog cards display correctly
2. [ ] Card links navigate to correct pages
3. [ ] Left nav menu links work
4. [ ] Mobile nav toggle works
5. [ ] User authentication (Sign In/Out) works
6. [ ] Page loads without errors
7. [ ] No CSS conflicts or style regressions

---

## Test Data Requirements

### Catalog Content Needed for Full Testing

To properly test all filter combinations, the catalog should contain:

- [ ] At least 3 modules with different levels
- [ ] At least 2 courses with different levels
- [ ] At least 1 pathway
- [ ] Items with duration < 30 min
- [ ] Items with duration 30-60 min
- [ ] Items with duration > 60 min
- [ ] Items tagged with various topics (e.g., "kubernetes", "networking", "cloud")
- [ ] Mix of beginner, intermediate, and advanced levels

**If test data is insufficient:** Create sample HubDB entries for testing purposes

---

## Deliverables

### Evidence to Store in `verification-output/issue-212/`

1. **test-results.txt** - Playwright test output
   ```bash
   npx playwright test tests/e2e-catalog-filters.spec.ts > verification-output/issue-212/test-results.txt 2>&1
   ```

2. **lighthouse-report.html** - Accessibility audit
   - Run in Chrome DevTools
   - Save HTML report

3. **axe-report.json** - axe DevTools scan results
   - Export from axe extension

4. **screenshots/**
   - `filters-enabled.png` - All filters in enabled state
   - `filters-active.png` - Filters actively filtering content
   - `no-results.png` - No results state
   - `mobile-filters.png` - Mobile viewport with filters

5. **manual-test-results.md** - Checklist from this document with pass/fail notes

6. **browser-compatibility.md** - Cross-browser test results

---

## Sign-Off Checklist

Before closing Issue #212, verify:

- [ ] All 14 automated tests pass
- [ ] All manual test cases pass
- [ ] Lighthouse accessibility score ≥ 95
- [ ] axe DevTools shows 0 critical/serious issues
- [ ] Tested in Chrome, Firefox, Safari
- [ ] Tested on mobile viewport
- [ ] Screen reader compatibility verified
- [ ] Documentation updated (if needed)
- [ ] Verification artifacts stored
- [ ] No regressions introduced
- [ ] Stakeholder approval obtained

---

**Test Plan Version:** 1.0
**Last Updated:** 2025-10-19
**Owner:** hh-learn project team
