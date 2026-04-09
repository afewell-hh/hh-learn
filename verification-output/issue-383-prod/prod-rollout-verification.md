# Issue #383 — My Learning UX Redesign: Production Rollout Verification

Date: 2026-04-09  
Branch: issue-383-prod-rollout  
Approved shadow baseline: issue-383-shadow-only (PR #393, project-lead approved 2026-04-09)

---

## 1. Rollout Scope

This is a production-only port of the approved shadow implementation (#393).  
Shadow files are unchanged. Only production files are modified.

### Files Changed

| File | Change |
|------|--------|
| `clean-x-hedgehog-templates/assets/js/my-learning.js` | Production JS ported from approved shadow version |
| `clean-x-hedgehog-templates/learn/my-learning.html` | Production template ported from approved shadow version |

### Files Unchanged (shadow preserved)

| File | Status |
|------|--------|
| `clean-x-hedgehog-templates/assets/shadow/js/my-learning.js` | Unchanged — approved shadow version |
| `clean-x-hedgehog-templates/learn-shadow/my-learning.html` | Unchanged — approved shadow version |
| `docs/my-learning.md` | Unchanged — already updated in #393 |

---

## 2. Shadow → Production Diff (URL paths only)

All logic is identical between shadow and production. The only differences are URL paths:

| Context | Shadow | Production |
|---------|--------|------------|
| Module links | `/learn-shadow/modules/<slug>` | `/learn/<slug>` |
| Course links | `/learn-shadow/courses/<slug>` | `/learn/courses/<slug>` |
| Pathway links | `/learn-shadow/pathways/<slug>` | `/learn/pathways/<slug>` |
| Resume module href | `/learn-shadow/modules/<slug>` | `/learn/<slug>` |
| Resume course href | `/learn-shadow/courses/<slug>` | `/learn/courses/<slug>` |
| Empty state CTA | `/learn-shadow/pathways` | `/learn/pathways` |

### Template-level differences

| Aspect | Shadow | Production |
|--------|--------|------------|
| `ENABLE_CRM_PROGRESS` | `false` | `true` |
| `TRACK_EVENTS_ENABLED` | `false` | `true` |
| `TRACK_EVENTS_URL` | `''` | `'https://api.hedgehog.cloud/events/track'` |
| `ACTION_RUNNER_URL` | `/learn-shadow/action-runner` | `/learn/action-runner` |
| Left nav macro | `learn-shadow/macros/left-nav.html` | `learn/macros/left-nav.html` |
| CSS/JS assets | `assets/shadow/css|js/` | `assets/css|js/` |
| `cognito-auth-integration.js` | `learn-shadow/assets/js/` | `learn/assets/js/` |
| `noindex, nofollow` meta | Present | Absent |
| Canonical URL | `/learn-shadow/my-learning` | `/learn/my-learning` |

---

## 3. Pre-Publish Safety Checks (verified by code inspection)

### No shadow paths in production files
- `grep learn-shadow assets/js/my-learning.js` → 0 matches ✅
- `grep learn-shadow learn/my-learning.html` → 0 matches ✅

### CRM enabled
- `data-enable-crm` evaluates to `"true"` (ENABLE_CRM_PROGRESS: true) ✅
- `TRACK_EVENTS_URL` is set → `/progress/read` and `/enrollments/list` derived correctly ✅

### No noindex in production template
- `grep noindex learn/my-learning.html` → 0 matches ✅

### Auth flow unchanged
- `waitForIdentityReady()` still awaited before any CRM calls ✅
- CRM gate: `auth.enableCrm && (auth.email || auth.contactId)` — same as approved shadow ✅
- `synced-indicator` shown for CRM auth users ✅
- `auth-prompt` shown for anonymous users (same as shadow, but on prod this is the fallback path) ✅

### Backward compatibility
- `setsFromCrm()` handles both flat and hierarchical CRM progress models ✅
- `getAllProgress()` localStorage fallback unchanged ✅
- No CRM schema changes; read-only redesign ✅

---

## 4. Validated Directly (shadow approval)

The following were validated on the live shadow site by the project lead on 2026-04-09:

- Page loads without JS errors
- Loading spinner shown initially
- Empty state shown when localStorage has no progress
- Module cards render correctly with badge/CTA after adding localStorage test entries
- Progress summary stats (In Progress, Completed, Enrolled=0) correct
- Auth-prompt banner shown (was dead code before #383 — now activated by JS)
- Shadow links use `/learn-shadow/` prefix — verified no `/learn/` leak in shadow

---

## 5. Production-Only Behaviors (code-path inspection only)

These require an authenticated CRM user on production and cannot be shadow-verified:

| Behavior | Basis |
|----------|-------|
| `synced-indicator` shown for authenticated users | JS:syncEl.style.display='flex' when CRM path taken |
| Resume panel renders with real title | `showResume()` uses CRM `last_viewed` + async HubDB title fetch |
| Pathway enrollment cards show course progress | `renderEnrollmentCard(type='pathway')` reads CRM courses + HubDB course_slugs_json |
| Course enrollment cards show time remaining | `renderEnrollmentCard(type='course')` sums `estimated_minutes` for incomplete modules |
| Module cards show course context badge | `buildModuleCourseContextMap()` builds map from CRM progress |
| Empty state suppressed when enrollments present | `hasEnrollments` flag from `/enrollments/list` response |
| Enrolled stat shows > 0 | Set in `renderEnrolledCards()` after enrollment API returns |
| CRM fallback to localStorage on API failure | `.catch(function(){ renderFromSets(localSets, null, false); })` |

---

## 6. Known Limitations (unchanged from shadow, data model constraints)

| Limitation | Impact |
|------------|--------|
| Single `last_viewed` per CRM user | Resume panel shows only one item, not per-pathway context |
| No `estimated_minutes` fallback | Time remaining badge only shows when HubDB has field populated |
| Course completion is Lambda/content-driven | Content changes to `content/courses/*.json` retroactively affect completion |
| `module_slugs_json` HubDB must match `content/courses/*.json` | Drift breaks enrollment card module order |

---

## 7. Publish Command (when approved)

```bash
# Production JS
npm run publish:template -- \
  --path "CLEAN x HEDGEHOG/templates/assets/js/my-learning.js" \
  --local "clean-x-hedgehog-templates/assets/js/my-learning.js"

# Production template
npm run publish:template -- \
  --path "CLEAN x HEDGEHOG/templates/learn/my-learning.html" \
  --local "clean-x-hedgehog-templates/learn/my-learning.html"
```

Do NOT publish shadow files as part of this rollout. Shadow was published as part of #393.
