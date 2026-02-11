# Issue #326 - Final Resolution ✅

## Problem

Action-runner.html template had empty `data-actions` and `data-track-url` attributes, causing "Unsupported action requested" errors in production.

## Root Cause

**The `request_json` HubL filter does NOT exist.**

The template was using:
```hubl
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
```

This line never worked because `request_json` is not a valid HubL filter. HubL has `fromjson` (which parses JSON strings), but **no filter exists to fetch and parse JSON from URLs**.

## Solution

**Inline the constants directly in the template** instead of trying to fetch them:

```hubl
{% set constants = {
  'TRACK_EVENTS_URL': 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track',
  'AUTH_LOGIN_URL': 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login',
  ... (other constants)
} %}

{% set action_config = {
  'enroll_pathway': {...},
  'enroll_course': {...},
  'record_progress': {...}
} %}

<div id="hhl-action-runner"
     data-track-url="{{ constants.TRACK_EVENTS_URL }}"
     data-actions="{{ action_config|tojson|escape_attr }}">
</div>
```

## Key Changes

1. **Removed invalid `request_json` usage**
2. **Inlined constants dictionary** directly in template
3. **Created separate `action_config` variable** for clarity
4. **Used correct filters**: `tojson` → `escape_attr` (not `escapehtml`)
5. **Republished template AND page** to pick up changes

## Verification

### Before Fix
```html
<div id="hhl-action-runner"
     data-track-url=""
     data-actions="">
</div>
```

### After Fix
```html
<div id="hhl-action-runner"
     data-track-url="https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track"
     data-actions="{&quot;enroll_course&quot;:{&quot;event&quot;:&quot;learning_course_enrolled&quot;,&quot;required&quot;:[&quot;slug&quot;],&quot;optional&quot;:[&quot;source&quot;,&quot;pathway_slug&quot;]},&quot;enroll_pathway&quot;:{...},&quot;record_progress&quot;:{...}}">
</div>
```

## E2E Test Results

**Before**: Test skipped with "unsupported action" warning
**After**: ✅ Test passing

```
[e2e] › Issue #319: action runner shows sign-in required for anonymous users
  1 passed (5.2s)
```

## Important Lessons

1. **HubL cannot fetch external content** - No filters exist for HTTP requests or file fetching
2. **`request_json` never existed** - Common misconception, but it's not in HubL docs
3. **`fromjson` only parses** - It doesn't fetch, just parses already-loaded JSON strings
4. **Page republish required** - Publishing template alone isn't enough; page must be republished to pick up changes
5. **Correct attribute escaping**: Use `escape_attr` for HTML attributes, not `escapehtml`

## Files Modified

- `clean-x-hedgehog-templates/learn/action-runner.html` - Inlined constants
- `clean-x-hedgehog-templates/config/constants.json` - Added missing AUTH_ME_URL and AUTH_LOGOUT_URL
- `scripts/force-republish-page.ts` - Created utility to force page republish

## Commands Used

```bash
# Publish template
npm run publish:template -- \
  --path="CLEAN x HEDGEHOG/templates/learn/action-runner.html" \
  --local="clean-x-hedgehog-templates/learn/action-runner.html"

# Force republish page
npm run build:scripts-cjs && node dist-cjs/scripts/force-republish-page.js

# Verify fix
curl -s "https://hedgehog.cloud/learn/action-runner?action=test" | grep hhl-action-runner

# Run E2E tests
npx playwright test --grep "action runner shows sign-in required"
```

## Status

✅ **RESOLVED**
- Data attributes now populated correctly
- E2E tests passing
- Production site working as expected

---

**Resolution Date**: 2026-02-10
**Resolved By**: Agent A (with collaboration from user)
**Issue**: https://github.com/afewell-hh/hh-learn/issues/326

## Sources

- [HubL Filters Documentation](https://developers.hubspot.com/docs/cms/reference/hubl/filters)
- [HubSpot Community: Use JSON from a file in a template](https://community.hubspot.com/t5/CMS-Development/Use-JSON-from-a-file-in-a-template/m-p/514490)
