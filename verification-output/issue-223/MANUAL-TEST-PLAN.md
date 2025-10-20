# Issue #223 Manual Test Plan
**My Learning Dashboard Module Listings**

## Test Environment
- **URL**: `https://hedgehog.cloud/learn/my-learning`
- **Test Contact**: Use authenticated test account with enrollments
- **Browser**: Chrome, Firefox, Safari (test all three)
- **Devices**: Desktop, Tablet, Mobile

## Pre-Test Setup

### 1. Verify Test Contact Has Enrollments
```bash
# Check enrollments via API
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts?email=emailmaria@hubspot.com&properties=hhl_progress_state"
```

Expected: Contact should have `hhl_progress_state` with at least one enrolled course

### 2. Verify Test Course Exists in HubDB
- Course: "getting-started-virtual-lab"
- Expected modules: 3 (GCP, AWS, Azure virtual lab access modules)

---

## Test Cases

### TC-1: Enrollment Cards Display Module Listings

**Objective**: Verify enrolled courses show nested module lists

**Steps**:
1. Log in to `/learn/my-learning`
2. Locate the "My Enrollments" section
3. Find a course enrollment card (e.g., "Getting Started Virtual Lab")
4. Verify the following elements are visible:
   - Course title as clickable link
   - "course" badge
   - Enrollment date
   - Enrollment source
   - Progress bar with label "X of Y modules complete (Z%)"

**Expected Result**:
- ✅ All elements render correctly
- ✅ Progress percentage matches actual completion state
- ✅ No console errors

**Actual Result**: _[To be filled during testing]_

---

### TC-2: Module List Collapse/Expand Functionality

**Objective**: Verify "View Modules" toggle works correctly

**Steps**:
1. From TC-1, locate the "View Modules" summary/toggle
2. Verify it shows a right-pointing arrow (▶) when collapsed
3. Click "View Modules"
4. Verify the module list expands
5. Verify the arrow rotates to point down (▼)
6. Click "View Modules" again to collapse
7. Verify the list collapses and arrow rotates back

**Expected Result**:
- ✅ Details element expands/collapses smoothly
- ✅ Arrow animation works
- ✅ Hover state shows visual feedback

**Actual Result**: _[To be filled during testing]_

---

### TC-3: Module Status Indicators Display Correctly

**Objective**: Verify module status icons match CRM progress data

**Steps**:
1. Expand the module list (from TC-2)
2. For each module, verify status indicator:
   - Completed modules show ✓ (green)
   - In-progress modules show ◐ (blue)
   - Not-started modules show ○ (gray)
3. Cross-reference with CRM data to confirm accuracy

**Expected Result**:
- ✅ Status icons match CRM `hhl_progress_state` data
- ✅ Colors are correct for each status
- ✅ All modules in the course are listed

**Actual Result**: _[To be filled during testing]_

---

### TC-4: Module Links Navigate Correctly

**Objective**: Verify clicking module names navigates to module pages

**Steps**:
1. Expand module list
2. Click on a module name link
3. Verify navigation to `/learn/{module-slug}`
4. Verify module page loads correctly
5. Use browser back button to return to My Learning
6. Verify state is preserved (module list stays expanded)

**Expected Result**:
- ✅ Links navigate to correct module pages
- ✅ Module pages load without errors
- ✅ Browser back preserves UI state

**Actual Result**: _[To be filled during testing]_

---

### TC-5: "Continue to Next Module" Button Logic

**Objective**: Verify Continue button links to correct module

**Test Scenario A: Course with in-progress module**
1. Locate a course with at least one in-progress module
2. Verify "Continue to Next Module →" button appears
3. Click the button
4. Verify navigation to the first in-progress module

**Test Scenario B: Course with no progress**
1. Locate a course with all modules not started
2. Verify "Continue to Next Module →" button appears
3. Click the button
4. Verify navigation to the first module in the course

**Test Scenario C: Course with all modules completed**
1. Locate a course with all modules completed
2. Verify "View Course →" button appears instead
3. Click the button
4. Verify navigation to the course detail page

**Expected Result**:
- ✅ Button text changes based on completion status
- ✅ Links navigate to correct destination
- ✅ No broken links

**Actual Result**: _[To be filled during testing]_

---

### TC-6: Progress Bar Accuracy

**Objective**: Verify progress bar percentages are correct

**Steps**:
1. For a course with mixed progress (e.g., 1 of 3 complete)
2. Verify progress label shows "1 of 3 modules complete (33%)"
3. Verify progress bar fill width matches percentage
4. Complete another module
5. Refresh page
6. Verify progress updates to "2 of 3 modules complete (67%)"

**Expected Result**:
- ✅ Label text is accurate
- ✅ Percentage calculation is correct
- ✅ Visual bar width matches percentage
- ✅ Updates reflect new progress after refresh

**Actual Result**: _[To be filled during testing]_

---

### TC-7: Pathway Enrollments (Graceful Degradation)

**Objective**: Verify pathway cards render without errors

**Steps**:
1. Locate a pathway enrollment card (if available)
2. Verify card displays basic information
3. Verify no module list is shown (expected for MVP)
4. Verify "Continue Learning →" button links to pathway page
5. Check console for errors

**Expected Result**:
- ✅ Pathway cards render without module listings
- ✅ No console errors or warnings
- ✅ Links work correctly

**Actual Result**: _[To be filled during testing]_

---

### TC-8: Anonymous User Fallback

**Objective**: Verify no errors for logged-out users

**Steps**:
1. Log out or open incognito window
2. Navigate to `/learn/my-learning`
3. Verify redirect to login page occurs
4. Check browser console for errors

**Expected Result**:
- ✅ Redirect to login page
- ✅ No JavaScript errors in console

**Actual Result**: _[To be filled during testing]_

---

### TC-9: Mobile Responsive Design

**Objective**: Verify UI works on mobile devices

**Steps**:
1. Open My Learning page on mobile device or resize browser
2. Verify enrollment cards stack vertically
3. Verify module list is readable and interactive
4. Tap "View Modules" toggle
5. Verify expand/collapse works on touch
6. Tap module links and Continue button

**Expected Result**:
- ✅ Layout adapts to small screens
- ✅ Text is readable (no overflow)
- ✅ Touch interactions work smoothly
- ✅ Progress bar displays correctly

**Actual Result**: _[To be filled during testing]_

---

### TC-10: Performance with Multiple Enrollments

**Objective**: Verify page loads efficiently with many enrollments

**Steps**:
1. Use test account with 5+ course enrollments
2. Measure page load time (DevTools Network tab)
3. Verify all enrollment cards render
4. Check for console warnings (e.g., rate limits)
5. Verify HubDB API calls are batched

**Expected Result**:
- ✅ Page loads in < 3 seconds
- ✅ All cards render successfully
- ✅ No rate limit errors
- ✅ Module metadata fetched in batch (not individual requests)

**Actual Result**: _[To be filled during testing]_

---

## Browser Compatibility Testing

### Chrome
- [ ] All test cases pass
- [ ] No console errors
- [ ] Details element works

### Firefox
- [ ] All test cases pass
- [ ] No console errors
- [ ] Details element works

### Safari
- [ ] All test cases pass
- [ ] No console errors
- [ ] Details element works (known quirks with `<details>`)

---

## Regression Testing

### Existing Functionality Should Still Work

1. **In Progress Section**
   - [ ] Individual module cards display for started modules
   - [ ] "In Progress" count is accurate

2. **Completed Section**
   - [ ] Individual module cards display for completed modules
   - [ ] "Completed" count is accurate

3. **Resume Panel**
   - [ ] "Resume" panel shows last viewed module/course
   - [ ] Link navigates correctly

4. **Progress Stats**
   - [ ] Summary stats at top show correct counts
   - [ ] "Synced across devices" indicator shows when authenticated

---

## Post-Deployment Verification

After deploying to production:

1. **Verify on Live Site**
   ```
   https://hedgehog.cloud/learn/my-learning
   ```

2. **Check Analytics**
   - No spike in JavaScript errors
   - Page load time within acceptable range

3. **Monitor Support Channels**
   - No user reports of missing module listings
   - No complaints about broken links

4. **Capture Screenshots**
   - Desktop view with expanded module list
   - Mobile view with collapsed module list
   - Progress bar at various percentages
   - Different module status combinations

---

## Test Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | Claude | 2025-10-20 | ✅ Implementation Complete |
| QA Tester | _[TBD]_ | _[TBD]_ | ⏳ Pending |
| Product Owner | _[TBD]_ | _[TBD]_ | ⏳ Pending |

---

## Notes

- All test cases should pass before merging to main
- Document any failures with screenshots and console logs
- Create follow-up issues for any discovered bugs
- Update this document with actual test results
