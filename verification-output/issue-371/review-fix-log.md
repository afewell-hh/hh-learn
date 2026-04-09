# Issue #371 — Review Fix Log (commit ab70289)

Date: 2026-04-09

Three issues identified in review of PR #377 were fixed in this commit.

---

## Fix 1: module-page.html was gitignored

**Root cause:** `.gitignore` line 18 contained `module-page.html` (bare filename, matched all paths).

**Fix:** Changed to `/module-page.html` (anchored to repo root only). The root-level `module-page.html` scratchpad file continues to be ignored; `clean-x-hedgehog-templates/learn-shadow/module-page.html` is now tracked.

**Verification:**
```
git check-ignore -v clean-x-hedgehog-templates/learn-shadow/module-page.html
→ NOT IGNORED

git check-ignore -v module-page.html
→ .gitignore:18:/module-page.html  (root file still ignored)
```

---

## Fix 2: Internal links still routing to production /learn

**Root cause:** First pass of sed only updated asset references and the `ACTION_RUNNER_URL` constant. All href-based navigation links, canonical URLs, og:url, rel=prev/next, and JS fallback URLs still pointed to `/learn/`.

**Fix:** Applied `s|/learn/|/learn-shadow/|g` across all shadow template HTML files and the cognito-auth-integration.js. Files updated:

- `macros/left-nav.html` — nav links (modules/courses/pathways/my-learning/register)
- `get-started.html` — hero CTAs, pathway/catalog/course card links
- `courses-page.html` — canonical_url var, og:url, back-to-courses link, module card hrefs, `?from=course:` query links
- `pathways-page.html` — canonical_url var, og:url, back-to-pathways, course links, `modules_base_path` template var
- `module-page.html` — canonical_url var, og:url, rel=prev/next, prereq links, nav links, module card hrefs
- `my-learning.html` — empty-state pathway CTA
- `catalog.html` — type-based href routing for modules/courses/pathways
- `assets/js/cognito-auth-integration.js` — hardcoded fallback `'/learn/action-runner'`

**Verification (live HTML check):**

| Page | HTTP | noindex | /learn/ hrefs | /learn-shadow/ hrefs |
|------|------|---------|---------------|----------------------|
| /learn-shadow | 200 | 1 | 0 | 14 |
| /learn-shadow/modules | 200 | 1 | 0 | 28 |
| /learn-shadow/courses | 200 | 1 | 0 | 9 |

Production pages have 0 noindex tags (unchanged).

---

## Fix 3: Anti-indexing not implemented

**Fix:**

**Template-level (primary):** Added `<meta name="robots" content="noindex, nofollow">` immediately after `{{ super() }}` in `{% block head %}` in all 8 shadow page templates. For `debug-hubdb.html` (no HubL block structure), added directly inside `<head>`.

**CMS page-level (belt-and-suspenders):** Updated all 7 existing shadow CMS pages via `PATCH /cms/v3/pages/site-pages/{id}` with `{"metaRobotsNoIndex": true, "metaRobotsNoFollow": true}`.

**Script:** Added `metaRobotsNoIndex: true` and `metaRobotsNoFollow: true` to the `provision-shadow-pages.ts` page payload so future page provisioning automatically sets both protection layers.

**Verification:**
```bash
curl -s https://hedgehog.cloud/learn-shadow | grep -i "robots"
→ <meta name="robots" content="noindex, nofollow">

# Production pages:
curl -s https://hedgehog.cloud/learn | grep -ic "noindex"
→ 0  (production is NOT affected)
```

---

## Pre-existing issue (not a blocker for #371)

`get-started.html` (shadow) inherits the `request_json` usage from production template — this filter does not exist in HubL (Issue #327 fix documented this). The production template has the same issue. Cleanup should be tracked in a separate issue.
