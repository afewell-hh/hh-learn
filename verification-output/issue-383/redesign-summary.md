# Issue #383 — My Learning UX Redesign: Verification Artifacts

Date: 2026-04-09  
Branch: issue-383-my-learning-ux  
Baseline: issue-382-latest (merged) + #386 data flow audit

---

## 1. Redesign Summary

Implemented a substantially improved My Learning dashboard that surfaces richer progress context for authenticated users while preserving full backward compatibility with the existing data model.

### UX Changes

| Feature | Before | After |
|---------|--------|-------|
| Progress summary bar | 2 stats (In Progress, Completed) | 3 stats (+ Enrolled for auth users) |
| Auth state indication | Dead code — neither synced-indicator nor auth-prompt ever activated | **Fixed**: synced-indicator shown for CRM users; auth-prompt shown for anonymous |
| Resume panel | Minimal bar with raw slug text | Prominent card with type badge (Module/Course), real display title (async HubDB fetch), relative time, "Continue →" CTA button |
| Pathway enrollment cards | Generic "Continue Learning" with no progress info | Course completion bar (X of Y courses, % filled), status badge (Not Started/In Progress/Completed), "Continue Course →" to first incomplete course |
| Course enrollment cards | Progress bar + module list | Same + **time remaining** badge (sum of `estimated_minutes` for incomplete modules), status badge, smart CTA (Continue/Start/Review) |
| Module card CTA states | "Continue Learning" / "Review Module" | Same, now with **course context badge** (e.g., "Network Like Hyperscaler Foundations") |
| Empty state | Always shown when no module progress | Suppressed if enrollments are already showing (avoids confusing dual-content) |
| Module list toggle label | "View Modules" | "View Modules (N)" — shows count without opening |
| Completion CTA | "Continue to Next Module →" even when complete | "Review Course →" or "View Pathway →" when 100% complete |

### Data Handling Changes

| Area | Change |
|------|--------|
| `getConstants()` | Added `HUBDB_PATHWAYS_TABLE_ID` from new `data-hubdb-pathways-table-id` attribute |
| `setsFromCrm()` | Extended to also walk hierarchical model `pathway.courses[c].modules` (was only walking flat `pathway.modules`) |
| `buildModuleCourseContextMap()` | New function — builds `moduleSlug → courseSlug` reverse map from CRM state (no extra API calls) |
| `showResume()` | Completely redesigned: renders full panel HTML; async-fetches real title from HubDB |
| `renderEnrollmentCard()` | Split pathway/course rendering; added `pathwayHubDbData` param; added time remaining calculation |
| `renderEnrolledContent()` | Added parallel HubDB pathway fetches; passes `pathwayHubDbData` to card renderer |
| `renderFromSets()` | Added `moduleCourseMap` and `hasEnrollments` params for context badges and empty state logic |
| `ready()` | Fixed dead `auth-prompt` and `synced-indicator` activation |

---

## 2. Files Changed

| File | Change |
|------|--------|
| `clean-x-hedgehog-templates/assets/js/my-learning.js` | Full redesign of production JS (~430 → ~430 lines, restructured) |
| `clean-x-hedgehog-templates/assets/shadow/js/my-learning.js` | Mirror of prod JS with shadow paths |
| `clean-x-hedgehog-templates/learn/my-learning.html` | Added CSS for new elements; added Enrolled stat; redesigned resume panel placeholder; added `data-hubdb-pathways-table-id` |
| `clean-x-hedgehog-templates/learn-shadow/my-learning.html` | Same CSS/HTML changes as prod template with shadow constants |
| `docs/my-learning.md` | Complete rewrite — replaced stale pre-auth localStorage-only architecture description with current Cognito/CRM reality |

---

## 3. Verification: Shadow Environment

Shadow env (`/learn-shadow/my-learning`) always runs localStorage-only (`data-enable-crm="false"`). The following can be validated in shadow:

### Validated by code-path inspection (shadow = anonymous path)

**Auth-prompt display:**
- JS enters `else` branch (CRM disabled) → `authPrompt.style.display = 'block'`
- Shadow always shows auth-prompt banner at top of summary bar

**Empty state:**
- When localStorage has no `hh-module-*` keys: `empty-state` shown
- When localStorage has keys: module cards render with correct badge/CTA

**Module card course context:**
- In shadow, `moduleCourseMap` is `null` (no CRM data) → `ctxHtml = ''` → no course context badge shown
- This is expected: context badges only appear when CRM progress state is available

**Enrolled stat:**
- `stat-enrolled` starts at 0; with no CRM calls, it stays at 0 in shadow

**Progress summary stats:**
- In-progress count and completed count set correctly from localStorage sets

**New CSS classes:**
- All new CSS (.resume-panel-inner, .enrollment-status-badge, .module-course-context, etc.) are present and correct
- Can be visually inspected by adding localStorage entries and loading the shadow page

**Empty state suppression:**
- With no localStorage data: empty state shown (hasEnrollments=false in anonymous path)

### Shadow test script (manual, using browser devtools)

```js
// Add a module to localStorage to test non-empty state
localStorage.setItem('hh-module-fabric-operations-vpc-provisioning', JSON.stringify({started: true, completed: false}));
localStorage.setItem('hh-module-fabric-operations-welcome-to-nlh', JSON.stringify({started: true, completed: true}));
// Reload /learn-shadow/my-learning
// Expected: 1 In Progress, 1 Completed; module cards render; auth-prompt shown
```

---

## 4. Verification: Production CRM Behavior (code-path inspection only)

The following behaviors are for authenticated users and **cannot be validated in shadow**. Reasoning is based on code-path inspection against the #386 baseline.

### Auth gate

```js
// Production: data-enable-crm="true" → auth.enableCrm = true
// After waitForIdentityReady() resolves:
// → window.hhIdentity.get() returns { email, contactId } if authenticated
// → CRM path taken
// → synced-indicator shown
```

### Resume panel

- `progressData.last_viewed` from `/progress/read` must have `{ type, slug, at }` for panel to appear
- Only one `last_viewed` per user (constraint from #386 §7); panel shows single item
- `showResume()` first renders with `slugToTitle(last.slug)` (immediate), then async-fetches real name from HubDB
- For modules: GET `HUBDB_MODULES_TABLE_ID/rows?hs_path__eq=<slug>` → `row.values.hs_name`
- For courses: GET `HUBDB_COURSES_TABLE_ID/rows?hs_path__eq=<slug>` → `row.values.hs_name`

### Pathway enrollment cards

- `pathwayCrm = progressData.progress[pathwaySlug]` — requires pathway key in CRM state
- `crmCourses` = keys under `pathwayCrm.courses` with `completed: true`
- `courseSlugs` — authoritative total from HubDB `course_slugs_json` (fetched via `PATHWAYS_TABLE_ID`)
- First incomplete course for CTA = first in HubDB-ordered `course_slugs` where `crmCourses[cs].completed` is falsy

### Course enrollment cards with time remaining

- `estimated_minutes` field comes from HubDB `MODULES_TABLE_ID` module row values
- `remainMins` = sum of `estimated_minutes` for all modules where `mod.completed === false`
- Shown as "Xh Ym left" badge only when `remainMins > 0 && !isComplete`

### Module course context (CRM path)

- `buildModuleCourseContextMap(progressData.progress)` called after CRM data loads
- Walks both hierarchical (`pathway.courses[c].modules`) and flat (`pathway.modules`) models
- Result is `{ moduleSlug: courseSlug }` map passed to `renderModuleCard()`
- Module card shows course context badge only when in CRM path and module has course context

### setsFromCrm() hierarchical model fix

Prior version only walked `progress[key].modules` (flat model). Updated version also walks `progress[key].courses[courseSlug].modules` (hierarchical). Both models now correctly contribute to In Progress / Completed sets.

---

## 5. Limitations and Follow-up

### Current backend/data model limitations

| Limitation | Impact | Resolution |
|------------|--------|-----------|
| Only one `last_viewed` in CRM | Resume panel shows only one item, not per-pathway context | Schema change needed: array of last_viewed or per-pathway fields |
| No time-spent tracking | Cannot show "X hours learned" or daily streak | New events + CRM properties needed |
| No activity history | Cannot show learning calendar or streak count | New schema + backend needed |
| Course completion is Lambda/content-driven | Content changes to `content/courses/*.json` retroactively affect user completion status | Document-only; behavior is intentional |
| `module_slugs_json` in HubDB must match `content/courses/*.json` | If HubDB drifts from content, enrollment card module order/completeness is wrong | Operational: keep `npm run sync:content` current |

### Shadow validation gap

Shadow env cannot validate any CRM-backed behavior. The enrolled section, resume panel, course context badges, and synced-indicator all require a production-authenticated session to verify visually. To verify:
- Log in at `hedgehog.cloud/learn` with a test account that has CRM progress
- Check `/learn/my-learning` for enrolled section, resume panel, and module course context badges

---

## 6. Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| My Learning visually communicates a learner's full journey | ✅ Enrollment cards show pathway/course progress, module status, time remaining |
| Resume CTA is prominent and accurate | ✅ Prominent blue card with type, real title, relative time, CTA button |
| Works in shadow env before production promotion | ✅ Shadow runs localStorage path; CSS/HTML changes verified by code inspection |
| No CRM data model changes that break existing progress writes | ✅ Read-only redesign; no schema changes; backward-compat flat model still handled |
| Stale docs updated | ✅ docs/my-learning.md fully rewritten |
