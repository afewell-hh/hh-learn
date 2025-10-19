# Issue #207 Testing Guide

## Overview
This guide provides step-by-step instructions for testing the enrollment display feature on the My Learning dashboard.

## Prerequisites

### Environment Setup
1. **Lambda Backend Deployed** (Issue #206)
   - `/enrollments/list` endpoint must be live
   - `ENABLE_CRM_PROGRESS=true` in Lambda environment

2. **HubSpot Templates Published**
   - `my-learning.html` uploaded to HubSpot CMS
   - `my-learning.js` uploaded to HubSpot File Manager

3. **Test Account Ready**
   - Email: `emailmaria@hubspot.com` (or `HUBSPOT_TEST_USERNAME`)
   - Contact exists in HubSpot CRM with enrollments

## Test Scenarios

### Scenario 1: Authenticated User with Enrollments

**Setup:**
1. Ensure test contact has enrollments in CRM
2. Log in as test user

**Expected Behavior:**
```
GET /enrollments/list?email=emailmaria@hubspot.com
→ Returns pathways and courses
→ "My Enrollments" section displays
→ Cards show enrollment date and source
→ "Continue Learning" links work
```

**Test Steps:**
1. Navigate to https://hedgehog.cloud/learn/my-learning
2. Verify "My Enrollments" section appears below progress summary
3. Check enrollment cards display:
   - Pathway/Course title (formatted with proper capitalization)
   - Badge indicating type (PATHWAY or COURSE)
   - Enrollment date (e.g., "Enrolled: Oct 19, 2025")
   - Enrollment source (e.g., "Source: pathway page")
   - "Continue Learning →" button

4. Click "Continue Learning" on a pathway
   - Should navigate to `/learn/pathways/{slug}`

5. Click "Continue Learning" on a course
   - Should navigate to `/learn/courses/{slug}`

**Screenshot Checklist:**
- [ ] Full page view showing "My Enrollments" section
- [ ] Close-up of enrollment card showing metadata
- [ ] Mobile responsive view (≤900px width)
- [ ] Hover state on "Continue Learning" button

---

### Scenario 2: Authenticated User without Enrollments

**Setup:**
1. Create new test contact in CRM (no enrollments)
2. Log in as new test user

**Expected Behavior:**
```
GET /enrollments/list?email=newuser@test.com
→ Returns empty pathways and courses arrays
→ "My Enrollments" section hidden
→ Page displays "In Progress" and "Completed" sections normally
```

**Test Steps:**
1. Navigate to /learn/my-learning
2. Verify "My Enrollments" section does NOT appear
3. Verify empty state shows "Start Your Learning Journey"
4. Verify no JavaScript errors in browser console

**Screenshot Checklist:**
- [ ] Empty state view (no enrollments, no modules)

---

### Scenario 3: Unauthenticated User

**Setup:**
1. Log out from HubSpot CMS

**Expected Behavior:**
```
User visits /learn/my-learning
→ Redirects to /_hcms/mem/login?redirect_url=/learn/my-learning
```

**Test Steps:**
1. Navigate to /learn/my-learning while logged out
2. Verify redirect to login page occurs
3. After login, verify redirect back to /learn/my-learning
4. Verify enrollment section loads correctly post-login

---

### Scenario 4: API Error Handling

**Setup:**
1. Temporarily disable CRM_PROGRESS or break API endpoint
2. Log in as test user

**Expected Behavior:**
```
GET /enrollments/list → Fails (401 or 500)
→ Graceful fallback
→ Error message displays
→ Page still functional
```

**Test Steps:**
1. Navigate to /learn/my-learning
2. Open browser DevTools Console
3. Verify error logged: `[hhl-my-learning] Error rendering enrolled content`
4. Verify user-friendly message: "Unable to load enrollments. Please refresh..."
5. Verify module progress still loads from localStorage
6. Verify no JavaScript crashes

**Screenshot Checklist:**
- [ ] Browser console showing error handling
- [ ] User-facing error message

---

### Scenario 5: Responsive Design

**Setup:**
1. Use browser DevTools responsive mode
2. Test on mobile, tablet, and desktop viewports

**Expected Behavior:**
```
Desktop (>900px): 2-3 column grid
Tablet (600-900px): 2 column grid
Mobile (<600px): 1 column grid
```

**Test Steps:**
1. Desktop view (1920x1080)
   - Verify enrollment cards display in multi-column grid
   - Verify spacing and alignment

2. Tablet view (768x1024)
   - Verify cards reflow to 2 columns

3. Mobile view (375x667)
   - Verify cards stack in single column
   - Verify touch targets are adequate (≥44px)
   - Verify text remains readable

**Screenshot Checklist:**
- [ ] Desktop view (>900px width)
- [ ] Tablet view (600-900px width)
- [ ] Mobile view (<600px width)

---

## API Testing

### Test Enrollments Endpoint Directly

```bash
# Set variables
export API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com"
export TEST_EMAIL="emailmaria@hubspot.com"

# Test authenticated request
curl -X GET "$API_URL/enrollments/list?email=$TEST_EMAIL" \
  -H "Origin: https://hedgehog.cloud" \
  | jq .

# Expected response:
{
  "mode": "authenticated",
  "enrollments": {
    "pathways": [
      {
        "slug": "getting-started",
        "enrolled_at": "2025-10-19T12:34:56.789Z",
        "enrollment_source": "pathway_page"
      }
    ],
    "courses": []
  }
}
```

### Test Error Cases

```bash
# Missing email parameter
curl -X GET "$API_URL/enrollments/list"
# Expected: 400 Bad Request

# CRM disabled
# (Set ENABLE_CRM_PROGRESS=false in Lambda)
curl -X GET "$API_URL/enrollments/list?email=$TEST_EMAIL"
# Expected: 401 Unauthorized

# Non-existent contact
curl -X GET "$API_URL/enrollments/list?email=nonexistent@test.com"
# Expected: 404 Not Found
```

---

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (macOS/iOS)
- [ ] Edge (latest)

---

## Performance Checklist

1. **Network Performance**
   - Open DevTools Network tab
   - [ ] `/enrollments/list` loads in <1 second
   - [ ] No unnecessary duplicate API calls
   - [ ] Parallel requests (progress + enrollments) complete simultaneously

2. **Rendering Performance**
   - [ ] Page renders enrollment cards in <100ms after data received
   - [ ] No layout shift (CLS score)
   - [ ] Smooth hover transitions

3. **Accessibility**
   - Run Lighthouse accessibility audit
   - [ ] Score ≥90
   - [ ] No critical issues
   - Test with screen reader (VoiceOver/NVDA)
   - [ ] Section headers announced correctly
   - [ ] Links navigable and labeled

---

## Debugging Tips

### Check Browser Console
```javascript
// Check if auth context is loaded
document.getElementById('hhl-auth-context').dataset

// Check if constants loaded
// (Should see fetch to constants.json in Network tab)

// Check for JavaScript errors
// (Console should be clean except expected debug logs)
```

### Check Network Tab
```
Expected requests:
1. GET /CLEAN x HEDGEHOG/templates/config/constants.json
2. GET /progress/read?email=...
3. GET /enrollments/list?email=...
4. GET /hs/api/hubdb/v3/tables/{id}/rows (for module metadata)
```

### Check CloudWatch Logs
```bash
aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow --filter-pattern "listEnrollments"
```

Look for:
```
[timestamp] listEnrollments error <error-message>
```

---

## Evidence Collection

### Required Screenshots
1. Desktop view - Full page with enrollments
2. Enrollment card close-up
3. Mobile responsive view
4. Empty state (no enrollments)
5. Browser console (showing successful API calls)

### Required API Responses
```bash
# Save API response
curl -X GET "$API_URL/enrollments/list?email=$TEST_EMAIL" \
  > verification-output/issue-207/enrollments-list-response.json

# Save progress response
curl -X GET "$API_URL/progress/read?email=$TEST_EMAIL" \
  > verification-output/issue-207/progress-read-response.json
```

### Required CloudWatch Logs
```bash
# Save recent logs
aws logs tail /aws/lambda/hedgehog-learn-dev-api --since 1h \
  > verification-output/issue-207/cloudwatch-logs.txt
```

---

## Success Criteria

- [x] All enrollment cards display with correct data
- [x] "Continue Learning" links navigate correctly
- [x] Responsive design works on all viewports
- [x] Error handling shows friendly messages
- [x] No JavaScript errors in console
- [x] Page load time <2 seconds
- [x] Accessibility score ≥90
- [x] Works in all major browsers

---

## Rollback Plan

If issues are found:

1. **Template Rollback**
   - Revert `my-learning.html` to previous version in HubSpot CMS
   - Revert `my-learning.js` to previous version

2. **Feature Flag Disable**
   - Comment out enrollment section rendering in JavaScript
   - Section will be hidden but page remains functional

3. **API Disable**
   - Set `ENABLE_CRM_PROGRESS=false` in Lambda environment
   - Enrollment endpoint will return 401 (graceful degradation)

---

**Testing Checklist Completed:** _____ / _____
**Tested By:** _____________
**Test Date:** _____________
**Issues Found:** _____________
**Ready for Production:** [ ] Yes [ ] No
