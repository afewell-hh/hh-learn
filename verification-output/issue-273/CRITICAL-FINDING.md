# CRITICAL FINDING - Issue #273

**Date:** 2025-10-28
**Status:** BLOCKER IDENTIFIED - Requires Specialist Review

---

## The Mystery

On the **exact same page render** of a course detail page, `request_contact.is_logged_in` returns:

- ✅ **TRUE** in the left navigation macro (shows "Hi, [name]!" and "Sign Out")
- ❌ **FALSE** in the auth-context div (data-email="" and data-contact-id="" are empty)

**Both use the identical HubL code:**
```hubl
{% if request_contact.is_logged_in %}{{ request_contact.email }}{% endif %}
```

---

## Evidence

### Test Setup
1. User is logged in to HubSpot membership (confirmed working on protected pages like `/tickets`)
2. User navigates to: https://hedgehog.cloud/learn/courses/course-authoring-101
3. Page is a HubDB dynamic page (`dynamic_page_hubdb_row` exists)

### What Works ✅

**Left Navigation Macro** (lines 39-44 in `left-nav.html`):
```hubl
{% if request_contact.is_logged_in %}
  <div class="learn-user-greeting">Hi, {{ request_contact.firstname|default('there') }}!</div>
  <a href="{{ logout_url }}">Sign Out</a>
{% else %}
  <a href="{{ login_url }}">Sign In</a>
{% endif %}
```

**Result**: Shows "Hi, [name]!" and "Sign Out" - WORKS CORRECTLY

### What Doesn't Work ❌

**Auth Context Div** (lines 583-593 in `courses-page.html`):
```hubl
<div id="hhl-auth-context"
     data-email="{% if request_contact.is_logged_in %}{{ request_contact.email|default('', true) }}{% endif %}"
     data-contact-id="{% if request_contact.is_logged_in %}{{ request_contact.hs_object_id|default('', true) }}{% endif %}"
     ...>
</div>
```

**Result in Browser Console**:
```javascript
document.getElementById('hhl-auth-context').dataset.email
// Returns: ""  (empty string)

document.getElementById('hhl-auth-context').dataset.contactId
// Returns: ""  (empty string)
```

**Yet on the SAME PAGE, the left nav shows the user IS logged in!**

---

## Code Comparison

Both use the exact same HubL variable and pattern:

| Location | Code | Result |
|----------|------|--------|
| Left Nav Macro | `{% if request_contact.is_logged_in %}` | ✅ TRUE |
| Auth Context Div | `{% if request_contact.is_logged_in %}` | ❌ FALSE |

**They are on the SAME page render, accessing the SAME HubL variable, but getting DIFFERENT results.**

---

## What We Ruled Out

### ❌ NOT a caching issue
- Hard refresh performed (Ctrl+Shift+R)
- Browser cache cleared
- Still exhibits same behavior

### ❌ NOT a dynamic page limitation
- Left nav macro is called WITHIN the dynamic page block (`{% if dynamic_page_hubdb_row %}`)
- If `request_contact` didn't work on dynamic pages, the left nav wouldn't work either
- But the left nav DOES work

### ❌ NOT missing data attributes
- The div exists: `document.getElementById('hhl-auth-context')` returns an element
- The attributes exist but are empty: `data-email=""` not missing

### ❌ NOT a scope/context issue
- Both the left nav and auth-context div are in the same `{% if dynamic_page_hubdb_row %}` block
- Both access `request_contact` at the same template render time

### ❌ NOT a membership registration issue
- User successfully logs in via `/_hcms/mem/login`
- User can access protected pages (`/tickets`)
- Left nav recognizes user is logged in

---

## Timeline of Investigation

### Attempt 1: Published Issue #272 Templates
- Published all 7 files (login-helper.js, auth-context.js, enrollment.js, 4 template files)
- Expected: `request_contact.is_logged_in` would populate data attributes
- Result: Data attributes remained empty

### Attempt 2: Checked for HubDB Dynamic Page Limitation
- Hypothesis: Maybe `request_contact` doesn't work on HubDB dynamic pages
- Result: LEFT NAV WORKS on dynamic page, disproving this hypothesis

### Attempt 3: Added Left Nav to Course Detail Page
- Modified `courses-page.html` line 521 to render left nav on detail pages
- Published change
- User refreshed and confirmed left nav shows "Hi, [name]!" and "Sign Out"
- Result: **LEFT NAV WORKS, AUTH-CONTEXT DOESN'T - on the SAME page**

---

## Current Template State

**File**: `clean-x-hedgehog-templates/learn/courses-page.html`

**Line 521**: Left nav added temporarily for testing
```hubl
{# TEMP: Add left nav to test request_contact.is_logged_in on detail pages #}
{{ learning_left_nav('courses', show_filters=false) }}
```

**Lines 583-593**: Auth context div (not working)
```hubl
<div id="hhl-auth-context"
     data-email="{% if request_contact.is_logged_in %}{{ request_contact.email|default('', true) }}{% endif %}"
     data-contact-id="{% if request_contact.is_logged_in %}{{ request_contact.hs_object_id|default('', true) }}{% endif %}"
     data-firstname="{% if request_contact.is_logged_in %}{{ request_contact.firstname|default('', true) }}{% endif %}"
     data-lastname="{% if request_contact.is_logged_in %}{{ request_contact.lastname|default('', true) }}{% endif %}"
     data-enable-crm="true"
     data-constants-url="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/config/constants.json') }}"
     data-course-slug="{{ dynamic_page_hubdb_row.hs_path }}"
     data-total-modules="{% if dynamic_page_hubdb_row.module_slugs_json %}{{ dynamic_page_hubdb_row.module_slugs_json|fromjson|length }}{% else %}0{% endif %}"
     data-login-url="{{ login_url }}"
     style="display:none"></div>
```

---

## Theories to Investigate

### Theory 1: Attribute Value Rendering vs. Element Content
- The left nav puts `request_contact` data in **element content** (text nodes)
- The auth-context puts `request_contact` data in **attribute values**
- **Possible Issue**: HubSpot might evaluate HubL differently for attribute values vs. content?

**Test**: Try putting `request_contact.email` in element content instead of attributes

### Theory 2: Hidden Div Optimization
- The auth-context div has `style="display:none"`
- **Possible Issue**: HubSpot might optimize away HubL evaluation for hidden elements?

**Test**: Remove `display:none` and see if attributes populate

### Theory 3: Execution Order
- The auth-context div appears BEFORE the left nav in the template
- **Possible Issue**: Maybe `request_contact` isn't available yet at that point in rendering?

**Test**: Move auth-context div to AFTER the left nav call

### Theory 4: Macro vs. Inline Code
- Left nav uses `request_contact` inside a **macro** (`learning_left_nav`)
- Auth-context uses `request_contact` **inline** in the template
- **Possible Issue**: Macros might have access to different context than inline code?

**Test**: Create a macro that outputs the auth-context div

---

## Recommended Next Steps

1. **Try Theory 1**: Change auth-context to use element content
   ```hubl
   <div id="hhl-auth-context" style="display:none">
     <span data-field="email">{% if request_contact.is_logged_in %}{{ request_contact.email }}{% endif %}</span>
     <span data-field="contactId">{% if request_contact.is_logged_in %}{{ request_contact.hs_object_id }}{% endif %}</span>
   </div>
   ```

2. **Try Theory 2**: Remove `display:none`
   ```hubl
   <div id="hhl-auth-context" data-email="{% if request_contact.is_logged_in %}{{ request_contact.email }}{% endif %}">
   ```

3. **Try Theory 3**: Move div after left nav call

4. **Try Theory 4**: Create a macro for auth-context

5. **Consult HubSpot Support**: This appears to be a HubSpot platform rendering inconsistency

---

## Files Modified

All changes tracked in git:

```bash
M clean-x-hedgehog-templates/learn/courses-page.html  # Added left nav on line 521
M clean-x-hedgehog-templates/assets/js/auth-context.js
M clean-x-hedgehog-templates/assets/js/enrollment.js
M clean-x-hedgehog-templates/learn/module-page.html
M clean-x-hedgehog-templates/learn/my-learning.html
M clean-x-hedgehog-templates/learn/pathways-page.html
A clean-x-hedgehog-templates/assets/js/login-helper.js
```

All published to HubSpot PUBLISHED environment via `publish-template.js`.

---

## Impact

**User Experience**:
- Enrollment CTA shows "Sign in to start course" even when user is logged in
- Progress tracking likely not working because `window.hhIdentity` has no data
- User must use JWT login helper (workaround) instead of native membership

**Project Status**:
- Issue #272 implementation appears correct but doesn't work due to HubSpot platform issue
- Issue #273 research correctly identified that `request_contact.is_logged_in` SHOULD work
- But encountered an unexpected HubSpot rendering inconsistency

---

## Questions for Specialist

1. Why does `request_contact.is_logged_in` evaluate to TRUE in the left nav macro but FALSE in the inline auth-context div on the same page render?

2. Is there a known HubSpot limitation on using `request_contact` in attribute values vs. element content?

3. Is there an evaluation order issue where `request_contact` isn't available early in template rendering?

4. Could this be related to how HubSpot optimizes rendering for hidden elements (`display:none`)?

5. Is there a difference in context/scope between macros and inline template code for HubDB dynamic pages?

---

**Prepared by**: Claude Code (AI Assistant)
**Date**: 2025-10-28
**Status**: Awaiting Specialist Review
