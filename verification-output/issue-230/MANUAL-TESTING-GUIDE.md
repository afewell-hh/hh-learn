# Manual Testing Guide for Issue #230
## Quick Reference for Human Testers

**Estimated Time**: 30-45 minutes
**Test Account**: afewell@gmail.com / Ar7far7!
**Live Site**: https://hedgehog.cloud/learn

---

## Setup

1. **Prepare Two Browser Windows**:
   - Window A: Regular browsing session (for authenticated tests)
   - Window B: Incognito/Private mode (for anonymous tests)

2. **Tools Needed**:
   - Screenshot tool
   - Browser DevTools (Network tab, Console)

3. **Clear Cache**: Add `?hs_no_cache=1` to all URLs

---

## Test Scenarios (6 Tests Total)

### 📋 TEST 1: Anonymous Course Page
**Window**: Incognito
**URL**: https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1

**Checklist**:
- [ ] CTA block is visible (doesn't hide)
- [ ] Button text: "Sign in to start course"
- [ ] Helper text: "Please sign in to start this course"
- [ ] Button is clickable
- [ ] Clicking redirects to login page

**Screenshot**: `manual-tests/test1-anonymous-course.png`

---

### 📋 TEST 2: Anonymous Pathway Page
**Window**: Incognito
**URL**: https://hedgehog.cloud/learn/pathways/course-authoring-expert?hs_no_cache=1

**Checklist**:
- [ ] CTA block is visible
- [ ] Button text: "Sign in to enroll"
- [ ] Helper text: "Please sign in to enroll in this pathway"
- [ ] Button is clickable
- [ ] Clicking redirects to login page

**Screenshot**: `manual-tests/test2-anonymous-pathway.png`

---

### 📋 TEST 3: Authenticated Course (Not Enrolled)
**Window**: Regular (logged in)
**URL**: https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1

**Pre-requisite**: Log in as afewell@gmail.com, ensure NOT enrolled in this course

**Checklist**:
- [ ] Button text: "Start Course" (NOT "Sign in...")
- [ ] No helper text visible
- [ ] Click button → Shows "Enrolling..." state
- [ ] After enrollment → "✓ Enrolled in Course"
- [ ] Button becomes disabled
- [ ] Toast notification appears

**Screenshots**:
- Before: `manual-tests/test3-auth-course-before.png`
- After: `manual-tests/test3-auth-course-after.png`

**Network Tab**: Capture `/enrollments/enroll` POST request

---

### 📋 TEST 4: Already Enrolled Course (CRM Check)
**Window**: Regular (logged in)
**URL**: https://hedgehog.cloud/learn/courses/api-test-course?hs_no_cache=1

**Pre-requisite**:
- Log in as afewell@gmail.com
- **Clear localStorage** (DevTools → Application → Local Storage → Clear All)
- User IS already enrolled (per API verification)

**Checklist**:
- [ ] On page load, button immediately shows "✓ Enrolled in Course"
- [ ] Button is disabled
- [ ] Network tab shows `/enrollments/list` call fetching CRM data
- [ ] No "Start Course" button visible

**Screenshot**: `manual-tests/test4-already-enrolled.png`
**Network Tab**: Capture `/enrollments/list` GET request

---

### 📋 TEST 5: My Learning Dashboard
**Window**: Regular (logged in)
**URL**: https://hedgehog.cloud/learn/my-learning?hs_no_cache=1

**Checklist**:
- [ ] "My Courses" section visible
- [ ] "api-test-course" appears with:
  - [ ] Module listings (nested)
  - [ ] Progress indicator (1/2 modules)
  - [ ] Status icons (✓ completed, ⚪ incomplete)
  - [ ] "Continue" link
- [ ] "My Pathways" section visible
- [ ] "api-test-pathway" appears with:
  - [ ] Nested course/module listings
  - [ ] Progress bar
  - [ ] "Continue Learning" CTA

**Screenshots**:
- Dashboard: `manual-tests/test5-my-learning.png`
- Course detail: `manual-tests/test5-course-detail.png`

---

### 📋 TEST 6: Module Progress Tracking
**Window**: Regular (logged in)
**URL**: Navigate from My Learning → api-test-course → any incomplete module

**Checklist**:
- [ ] Module loads successfully
- [ ] Start/complete module triggers `/events/track` API call
- [ ] Return to My Learning → Progress updated
- [ ] Re-check `/progress/read` API → Completion timestamp present

**Screenshot**: `manual-tests/test6-module-progress.png`
**Network Tab**: Capture `/events/track` POST request

---

## API Verification Commands

Use these to verify CRM state during testing:

### Get Current Enrollment State
```bash
curl -s "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/enrollments/list?email=afewell@gmail.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq .
```

### Get Progress Data
```bash
curl -s "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/progress/read?email=afewell@gmail.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq .
```

### Get JWT Token
```bash
curl -s -X POST "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"afewell@gmail.com"}' | jq -r .token
```

---

## Screenshot Naming Convention

Save all screenshots to: `verification-output/issue-230/manual-tests/`

| Test | Filename |
|------|----------|
| Test 1 | `test1-anonymous-course.png` |
| Test 2 | `test2-anonymous-pathway.png` |
| Test 3 (before) | `test3-auth-course-before.png` |
| Test 3 (after) | `test3-auth-course-after.png` |
| Test 4 | `test4-already-enrolled.png` |
| Test 5 (dashboard) | `test5-my-learning.png` |
| Test 5 (course detail) | `test5-course-detail.png` |
| Test 6 | `test6-module-progress.png` |

---

## Console Log Capture

For each test, open Browser DevTools (F12) → Console tab.

**After page loads, copy console output** and paste into:
`verification-output/issue-230/manual-tests/console-logs.txt`

Format:
```
=== TEST 1: Anonymous Course Page ===
[console output here]

=== TEST 2: Anonymous Pathway Page ===
[console output here]

...
```

---

## Network Tab Capture

For Tests 3, 4, and 6, capture network requests:

1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Perform the test action (enroll, load page, etc.)
4. Right-click the relevant request → Copy → Copy as cURL
5. Save to `verification-output/issue-230/manual-tests/network-requests.txt`

---

## Known Issues to Watch For

⚠️ **Authentication Gap (Issues #233, #239, #242)**:
- If you encounter 404 errors on public pages when NOT logged in
- This is a known issue blocking full anonymous visitor testing
- Document the error and note it in results

⚠️ **Cache Issues**:
- Always use `?hs_no_cache=1` query parameter
- Clear localStorage between tests (DevTools → Application → Storage)
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) if needed

---

## After Testing

1. **Update Verification Summary**:
   - Open `verification-output/issue-230/VERIFICATION-SUMMARY.md`
   - Check off completed tests in Section 2
   - Add any observations to Section 5 (Known Issues)

2. **Comment on GitHub Issues**:
   - Issue #226: Summary of Tests 1-3 results
   - Issue #227: Summary of Tests 4-6 results
   - Issue #230: Link to this verification summary

3. **Close Issues** (if all tests pass):
   - `gh issue comment 230 -F verification-output/issue-230/VERIFICATION-SUMMARY.md`
   - `gh issue close 230 --reason completed`

---

**Need Help?**
- Full documentation: `verification-output/issue-230/VERIFICATION-SUMMARY.md`
- API responses: `verification-output/issue-230/api/`
- Related issues: #191, #221, #226, #227, #233, #239, #242
