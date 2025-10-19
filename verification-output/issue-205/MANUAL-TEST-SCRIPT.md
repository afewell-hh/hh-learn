# Manual Test Script: Explicit Enrollment Flows

**Issue**: #205
**Tester**: _____________
**Date**: _____________
**Environment**: Production (hedgehog.cloud)

## Pre-Test Setup

- [ ] Templates published to HubSpot (pathways-page.html, courses-page.html, enrollment.js)
- [ ] Lambda deployed with updated enrollment event handling
- [ ] Test account credentials available
- [ ] Browser DevTools ready (Chrome/Firefox recommended)

## Test 1: Pathway Enrollment (Authenticated User)

**Test URL**: https://hedgehog.cloud/learn/pathways/course-authoring-expert

### Steps

1. **Login**
   - [ ] Navigate to https://hedgehog.cloud/learn/register
   - [ ] Enter test credentials and login
   - [ ] **Result**: Successfully logged in

2. **Navigate to Pathway Page**
   - [ ] Navigate to pathway detail page
   - [ ] **Result**: Page loads successfully
   - [ ] **Screenshot**: `pathway-enrollment-cta-before.png`

3. **Verify CTA Block Appears**
   - [ ] Enrollment CTA block is visible below pathway header
   - [ ] Title reads: "Ready to Begin This Learning Pathway?"
   - [ ] Description mentions progress tracking
   - [ ] Button shows: "Enroll in Pathway"
   - [ ] Button styling: Blue background (#1a4e8a), white text
   - [ ] **Result**: All elements present and styled correctly

4. **Open DevTools - Network Tab**
   - [ ] Open browser DevTools (F12)
   - [ ] Switch to Network tab
   - [ ] Filter for `/events/track`
   - [ ] **Result**: Network monitoring ready

5. **Click Enrollment Button**
   - [ ] Click "Enroll in Pathway" button
   - [ ] **Result**: Button immediately shows "Enrolling..."
   - [ ] **Screenshot**: `pathway-enrollment-cta-enrolling.png`

6. **Verify Toast Notification**
   - [ ] Toast appears in top-right corner (within 500ms)
   - [ ] Toast message: "Successfully enrolled in pathway!"
   - [ ] Toast has green background (#D1FAE5)
   - [ ] Toast auto-dismisses after ~3 seconds
   - [ ] **Result**: Toast displays and dismisses correctly
   - [ ] **Screenshot**: `pathway-enrollment-toast.png`

7. **Verify Button State Update**
   - [ ] Button text changes to: "✓ Enrolled in Pathway"
   - [ ] Button background changes to green (#D1FAE5)
   - [ ] Button border is green (#6EE7B7)
   - [ ] Button is disabled (cursor: not-allowed)
   - [ ] **Result**: Button state updated correctly
   - [ ] **Screenshot**: `pathway-enrollment-cta-after.png`

8. **Verify Network Beacon**
   - [ ] DevTools Network tab shows POST to `/events/track`
   - [ ] Request payload contains:
     ```json
     {
       "eventName": "learning_pathway_enrolled",
       "contactIdentifier": { "email": "...", "contactId": "..." },
       "payload": { "pathway_slug": "...", "ts": "..." }
     }
     ```
   - [ ] Response status: 200 OK
   - [ ] Response body: `{"status": "persisted", "mode": "authenticated", "backend": "properties"}`
   - [ ] **Result**: Beacon sent and acknowledged
   - [ ] **Screenshot**: `network-beacon-pathway.png`
   - [ ] **Save**: Copy request payload to `pathway-enrollment-payload.json`

9. **Verify localStorage**
   - [ ] Open DevTools → Application → Local Storage → hedgehog.cloud
   - [ ] Key `hh-enrollment-pathway-course-authoring-expert` exists
   - [ ] Value is valid JSON: `{"enrolled": true, "enrolled_at": "2025-..."}`
   - [ ] **Result**: localStorage updated correctly
   - [ ] **Screenshot**: `localStorage-pathway-enrollment.png`

10. **Test Page Refresh (State Persistence)**
    - [ ] Refresh the page (F5)
    - [ ] **Result**: Page reloads
    - [ ] Enrollment CTA block still visible
    - [ ] Button immediately shows "✓ Enrolled in Pathway" (green)
    - [ ] Button is disabled
    - [ ] No new network request to `/events/track`
    - [ ] **Result**: State persisted across page load

11. **Verify CRM Update**
    - [ ] Navigate to HubSpot CRM
    - [ ] Search for test user contact
    - [ ] View contact properties
    - [ ] `hhl_progress_state` contains:
      ```json
      {
        "course-authoring-expert": {
          "enrolled": true,
          "enrolled_at": "2025-10-19T...",
          "modules": {}
        }
      }
      ```
    - [ ] `hhl_progress_updated_at`: Current date (YYYY-MM-DD)
    - [ ] `hhl_progress_summary`: Reflects enrollment
    - [ ] **Result**: CRM properties updated
    - [ ] **Screenshot**: `hubspot-contact-properties-pathway.png`

**Test 1 Result**: ☐ Pass ☐ Fail

**Notes/Issues**:
```


```

---

## Test 2: Course Enrollment (Authenticated User)

**Test URL**: https://hedgehog.cloud/learn/courses/course-authoring-101

### Steps

1. **Navigate to Course Page**
   - [ ] Navigate to course detail page
   - [ ] **Result**: Page loads successfully
   - [ ] **Screenshot**: `course-enrollment-cta-before.png`

2. **Verify CTA Block Appears**
   - [ ] Enrollment CTA block is visible below course header
   - [ ] Title reads: "Ready to Start This Course?"
   - [ ] Description mentions progress tracking and personalized resources
   - [ ] Button shows: "Start Course"
   - [ ] Button styling: Blue background (#1a4e8a), white text
   - [ ] **Result**: All elements present and styled correctly

3. **Open DevTools - Network Tab**
   - [ ] Open browser DevTools (F12)
   - [ ] Switch to Network tab
   - [ ] Filter for `/events/track`
   - [ ] **Result**: Network monitoring ready

4. **Click Enrollment Button**
   - [ ] Click "Start Course" button
   - [ ] **Result**: Button immediately shows "Enrolling..."
   - [ ] **Screenshot**: `course-enrollment-cta-enrolling.png`

5. **Verify Toast Notification**
   - [ ] Toast appears in top-right corner (within 500ms)
   - [ ] Toast message: "Successfully enrolled in course!"
   - [ ] Toast has green background (#D1FAE5)
   - [ ] Toast auto-dismisses after ~3 seconds
   - [ ] **Result**: Toast displays and dismisses correctly
   - [ ] **Screenshot**: `course-enrollment-toast.png`

6. **Verify Button State Update**
   - [ ] Button text changes to: "✓ Enrolled in Course"
   - [ ] Button background changes to green (#D1FAE5)
   - [ ] Button border is green (#6EE7B7)
   - [ ] Button is disabled (cursor: not-allowed)
   - [ ] **Result**: Button state updated correctly
   - [ ] **Screenshot**: `course-enrollment-cta-after.png`

7. **Verify Network Beacon**
   - [ ] DevTools Network tab shows POST to `/events/track`
   - [ ] Request payload contains:
     ```json
     {
       "eventName": "learning_course_enrolled",
       "contactIdentifier": { "email": "...", "contactId": "..." },
       "payload": { "course_slug": "...", "ts": "..." }
     }
     ```
   - [ ] Response status: 200 OK
   - [ ] Response body: `{"status": "persisted", "mode": "authenticated", "backend": "properties"}`
   - [ ] **Result**: Beacon sent and acknowledged
   - [ ] **Screenshot**: `network-beacon-course.png`
   - [ ] **Save**: Copy request payload to `course-enrollment-payload.json`

8. **Verify localStorage**
   - [ ] Open DevTools → Application → Local Storage → hedgehog.cloud
   - [ ] Key `hh-enrollment-course-course-authoring-101` exists
   - [ ] Value is valid JSON: `{"enrolled": true, "enrolled_at": "2025-..."}`
   - [ ] **Result**: localStorage updated correctly
   - [ ] **Screenshot**: `localStorage-course-enrollment.png`

9. **Test Page Refresh (State Persistence)**
   - [ ] Refresh the page (F5)
   - [ ] **Result**: Page reloads
   - [ ] Enrollment CTA block still visible
   - [ ] Button immediately shows "✓ Enrolled in Course" (green)
   - [ ] Button is disabled
   - [ ] No new network request to `/events/track`
   - [ ] **Result**: State persisted across page load

10. **Verify CRM Update**
    - [ ] Navigate to HubSpot CRM
    - [ ] Search for test user contact
    - [ ] View contact properties
    - [ ] `hhl_progress_state` now contains:
      ```json
      {
        "course-authoring-expert": { ... },
        "courses": {
          "course-authoring-101": {
            "enrolled": true,
            "enrolled_at": "2025-10-19T...",
            "modules": {}
          }
        }
      }
      ```
    - [ ] `hhl_progress_updated_at`: Current date (YYYY-MM-DD)
    - [ ] `hhl_progress_summary`: Reflects both enrollments
    - [ ] **Result**: CRM properties updated
    - [ ] **Screenshot**: `hubspot-contact-properties-course.png`

**Test 2 Result**: ☐ Pass ☐ Fail

**Notes/Issues**:
```


```

---

## Test 3: Unauthenticated User (Enrollment Hidden)

### Steps

1. **Logout**
   - [ ] Logout from hedgehog.cloud
   - [ ] **Result**: Successfully logged out

2. **Navigate to Pathway Page**
   - [ ] Navigate to https://hedgehog.cloud/learn/pathways/course-authoring-expert
   - [ ] **Result**: Page loads successfully
   - [ ] Enrollment CTA block is **NOT visible**
   - [ ] **Result**: CTA hidden for unauthenticated users
   - [ ] **Screenshot**: `pathway-unauthenticated.png`

3. **Navigate to Course Page**
   - [ ] Navigate to https://hedgehog.cloud/learn/courses/course-authoring-101
   - [ ] **Result**: Page loads successfully
   - [ ] Enrollment CTA block is **NOT visible**
   - [ ] **Result**: CTA hidden for unauthenticated users
   - [ ] **Screenshot**: `course-unauthenticated.png`

**Test 3 Result**: ☐ Pass ☐ Fail

**Notes/Issues**:
```


```

---

## Test 4: Debug Mode

### Steps

1. **Enable Debug Mode**
   - [ ] Re-login to hedgehog.cloud
   - [ ] Open browser console
   - [ ] Run: `localStorage.setItem('HHL_DEBUG', 'true')`
   - [ ] **Result**: Debug mode enabled

2. **Test with Debug Logging**
   - [ ] Navigate to pathway page
   - [ ] Verify console shows: `[hhl-enroll] enrollment.js loaded`
   - [ ] Verify console shows: `[hhl-enroll] Initialized: {contentType, slug, auth: !!email}`
   - [ ] Click enrollment button (on different pathway if already enrolled)
   - [ ] Verify console shows: `[hhl-enroll] Sending beacon:` with full payload
   - [ ] Verify console shows: `[hhl-enroll] Saved state:` with localStorage key
   - [ ] Verify console shows: `[hhl-enroll] Enrollment complete:` with type and slug
   - [ ] **Result**: Debug logging works correctly
   - [ ] **Screenshot**: `console-debug-output.png`

3. **Disable Debug Mode**
   - [ ] Run: `localStorage.removeItem('HHL_DEBUG')`
   - [ ] Refresh page
   - [ ] **Result**: No debug logging in console

**Test 4 Result**: ☐ Pass ☐ Fail

**Notes/Issues**:
```


```

---

## Overall Test Summary

**Total Tests**: 4
**Passed**: _____
**Failed**: _____

### Critical Issues

```


```

### Non-Critical Issues

```


```

### Recommendations

```


```

---

## Evidence Artifacts Checklist

Screenshots:
- [ ] `pathway-enrollment-cta-before.png`
- [ ] `pathway-enrollment-cta-enrolling.png`
- [ ] `pathway-enrollment-cta-after.png`
- [ ] `pathway-enrollment-toast.png`
- [ ] `course-enrollment-cta-before.png`
- [ ] `course-enrollment-cta-enrolling.png`
- [ ] `course-enrollment-cta-after.png`
- [ ] `course-enrollment-toast.png`
- [ ] `localStorage-pathway-enrollment.png`
- [ ] `localStorage-course-enrollment.png`
- [ ] `network-beacon-pathway.png`
- [ ] `network-beacon-course.png`
- [ ] `hubspot-contact-properties-pathway.png`
- [ ] `hubspot-contact-properties-course.png`
- [ ] `pathway-unauthenticated.png`
- [ ] `course-unauthenticated.png`
- [ ] `console-debug-output.png`

Payload Files:
- [ ] `pathway-enrollment-payload.json`
- [ ] `course-enrollment-payload.json`

---

## Sign-Off

**Tester Signature**: _________________________
**Date**: _____________

**Reviewed By**: _________________________
**Date**: _____________

**Approved for Deployment**: ☐ Yes ☐ No (reason: _______________)
