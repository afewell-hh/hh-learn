# Phase 0B: Live Verification — Issue #372

## Verification Method

Fetched live shadow pages and parsed `data-enable-crm` and `data-track-events-url` attributes from the `#hhl-auth-context` div after templates were uploaded and all 7 shadow CMS pages were republished.

Date: 2026-04-07

---

## Shadow Page Results

| Page | URL | data-enable-crm | data-track-events-url | Status |
|---|---|---|---|---|
| learn-shadow (get-started) | hedgehog.cloud/learn-shadow | no auth-context div (correct) | no auth-context div (correct) | ✓ |
| learn-shadow/modules | hedgehog.cloud/learn-shadow/modules | `false` | `""` (empty) | ✓ |
| learn-shadow/courses | hedgehog.cloud/learn-shadow/courses | `false` | `""` (empty) | ✓ |
| learn-shadow/pathways | hedgehog.cloud/learn-shadow/pathways | `false` | `""` (empty) | ✓ |
| learn-shadow/my-learning | hedgehog.cloud/learn-shadow/my-learning | `false` | `""` (empty) | ✓ |
| learn-shadow/action-runner | hedgehog.cloud/learn-shadow/action-runner | `false` | `""` (empty) | ✓ |

Note: `learn-shadow/register` has no `#hhl-auth-context` div (registration page — correct).
Note: `learn-shadow` (get-started page) has no `#hhl-auth-context` div (pre-auth landing — correct).

---

## Production Isolation Check

Confirmed production `/learn` pages are **unchanged**:

| Page | data-enable-crm | data-track-events-url | Status |
|---|---|---|---|
| learn/modules | `true` | `https://api.hedgehog.cloud/events/track` | ✓ unchanged |
| learn/courses | `true` | `https://api.hedgehog.cloud/events/track` | ✓ unchanged |

Production templates and assets were not modified by Phase 0B work.

---

## Template Diff Summary

### Constants block changes (all 8 shadow templates)

```diff
- 'ENABLE_CRM_PROGRESS': true,
+ 'ENABLE_CRM_PROGRESS': false,
- 'TRACK_EVENTS_ENABLED': true,
- 'TRACK_EVENTS_URL': 'https://api.hedgehog.cloud/events/track',
+ 'TRACK_EVENTS_ENABLED': false,
+ 'TRACK_EVENTS_URL': '',
```

Templates updated: action-runner.html, catalog.html, courses-page.html, module-page.html, my-learning.html, pathways-page.html, register.html, get-started.html (get-started has no auth-context div, constants change is still correct for consistency)

### Data attribute changes (6 shadow templates)

```diff
- data-track-events-url="https://api.hedgehog.cloud/events/track"
+ data-track-events-url="{{ constants.TRACK_EVENTS_URL }}"
- data-enable-crm="true"
+ data-enable-crm="{{ 'true' if constants.ENABLE_CRM_PROGRESS else 'false' }}"
```

Templates updated: action-runner.html, catalog.html, courses-page.html, module-page.html, my-learning.html, pathways-page.html

**Critical finding:** The original shadow templates (cloned from production in Phase 0A) had these data attributes hardcoded, bypassing the constants block entirely. The constants block alone would not have been sufficient — both the constants AND the data attribute rendering had to be updated.
