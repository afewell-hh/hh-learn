# Phase 0C: Shadow Page Inventory — Issue #373

## Shadow URL Prefix

`/learn-shadow` — chosen in Phase 0A (#371), confirmed and documented in `docs/shadow-environment.md`.

The issue suggested `/learn-next` or `/learn-dev`; `/learn-shadow` was selected and accepted in the Phase 0A review. This issue confirms that choice.

---

## Provisioned Shadow Pages

All 7 shadow pages confirmed **PUBLISHED** via HubSpot CMS Pages API (2026-04-09).

| Page Name | Slug | HubSpot ID | State | Template |
|---|---|---|---|---|
| Learn Shadow — Get Started | `learn-shadow` | 210727657869 | PUBLISHED | `learn-shadow/get-started.html` |
| Learn Shadow — Modules | `learn-shadow/modules` | 210723427736 | PUBLISHED | `learn-shadow/module-page.html` |
| Learn Shadow — Courses | `learn-shadow/courses` | 210727657871 | PUBLISHED | `learn-shadow/courses-page.html` |
| Learn Shadow — Pathways | `learn-shadow/pathways` | 210723427738 | PUBLISHED | `learn-shadow/pathways-page.html` |
| Learn Shadow — My Learning | `learn-shadow/my-learning` | 210723427741 | PUBLISHED | `learn-shadow/my-learning.html` |
| Learn Shadow — Register | `learn-shadow/register` | 210727657873 | PUBLISHED | `learn-shadow/register.html` |
| Learn Shadow — Action Runner | `learn-shadow/action-runner` | 210727657875 | PUBLISHED | `learn-shadow/action-runner.html` |

All pages use the `learn-shadow/` template path prefix, isolating them from production templates.

---

## Page → Template → Asset Binding

Each shadow page binds to:
- **Template**: `CLEAN x HEDGEHOG/templates/learn-shadow/<template>.html` (isolated copy, not the production template)
- **CSS**: `CLEAN x HEDGEHOG/templates/assets/shadow/css/` (isolated copies)
- **JS**: `CLEAN x HEDGEHOG/templates/assets/shadow/js/` (isolated copies with shadow-safe paths)

HubDB table bindings use the same production tables (read-only access; data isolation is Phase 0C+ future work per `docs/shadow-environment.md`).

---

## Anti-Indexing Controls

### Template-level (primary)

All 9 shadow templates include:
```html
<meta name="robots" content="noindex, nofollow">
```
This is the primary and reliable noindex mechanism. The HubSpot v3 CMS Pages API does not expose `metaRobotsNoIndex`/`metaRobotsNoFollow` fields — attempts to set them via the API payload are silently ignored. Template-level meta tags are rendered on every page response.

### Sitemap

Shadow pages confirmed absent from `https://hedgehog.cloud/sitemap.xml`.

### HubSpot Page Naming

All shadow pages use the prefix `Learn Shadow — ` in their HubSpot page name, making non-production status visible to operators in the CMS dashboard.

### robots.txt — Operator Step Required

Current `hedgehog.cloud/robots.txt` does not have a `Disallow: /learn-shadow` rule. HubSpot does not expose robots.txt editing via API. An operator must add the rule manually:

**Steps:**
1. HubSpot portal → **Website** → **Pages** → **Settings** → **Crawlers & Indexing**
2. Under "Custom robots.txt additions", add:
   ```
   Disallow: /learn-shadow
   Disallow: /learn-shadow/
   ```
3. Save and confirm the updated robots.txt at `https://hedgehog.cloud/robots.txt`.

Note: The `noindex` meta tag is defense layer 1 and is already in place. The robots.txt disallow is defense layer 2. The shadow environment is safe for use without the robots.txt change, but the change should be made before any extended shadow testing period.

---

## Production Page Isolation

Production `/learn` pages confirmed PUBLISHED and using production templates (not shadow templates):

| Slug | State | Template |
|---|---|---|
| `learn` | PUBLISHED | `learn/get-started.html` |
| `learn/modules` | PUBLISHED | `learn/module-page.html` |
| `learn/courses` | PUBLISHED | `learn/courses-page.html` |

---

## Bug Fixed: Provision Script Publish Mechanism

Previous runs of `npm run provision:shadow-pages -- --publish` appeared to succeed but left all pages in DRAFT state. Root cause: `hubspot.cms.pages.sitePagesApi.schedule()` does not work for page publishing in this context. Fixed by replacing with a direct `PATCH /cms/v3/pages/site-pages/{id}` with `{"state": "PUBLISHED"}`. Pages confirmed PUBLISHED via API after fix.
