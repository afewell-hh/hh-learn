# Issue #371 — CMS Asset Inventory and Clone/Share Decisions

## Decision Summary

| Asset | HubSpot Path | Local Path | Decision | Rationale |
|-------|-------------|------------|----------|-----------|
| Base layout | `CLEAN x HEDGEHOG/templates/layouts/base.html` | `clean-x-hedgehog-templates/layouts/base.html` | **SHARE** | Theme infrastructure; changes affect all pages regardless of shadow/prod. Shadow templates extend it unchanged. Only clone if base changes are needed (document when that happens). |
| Production templates (9) | `CLEAN x HEDGEHOG/templates/learn/*.html` | `clean-x-hedgehog-templates/learn/*.html` | **SHARED (source)** | These are the production originals — unchanged by this issue. |
| Shadow templates (9) | `CLEAN x HEDGEHOG/templates/learn-shadow/*.html` | `clean-x-hedgehog-templates/learn-shadow/*.html` | **CLONE** | Any template edit during shadow work would affect live production pages if shared. |
| Macro: left-nav | `CLEAN x HEDGEHOG/templates/learn/macros/left-nav.html` | `clean-x-hedgehog-templates/learn/macros/left-nav.html` | **CLONE** → shadow | Imported by all list-view templates; must match shadow template namespace. |
| cognito-auth-integration.js (learn/) | `CLEAN x HEDGEHOG/templates/learn/assets/js/cognito-auth-integration.js` | same under `learn/` | **CLONE** → shadow | In-template JS asset; changes would affect production pages. |
| CSS assets (4) | `CLEAN x HEDGEHOG/templates/assets/css/*.css` | `clean-x-hedgehog-templates/assets/css/` | **CLONE** → shadow | Mutable assets shared by template require_css calls; any change would affect production templates. |
| JS assets (16) | `CLEAN x HEDGEHOG/templates/assets/js/*.js` | `clean-x-hedgehog-templates/assets/js/` | **CLONE** → shadow | Mutable assets; changes would cross-impact production pages. |
| learn-landing.css | `CLEAN x HEDGEHOG/templates/assets/css/learn-landing.css` | (was missing from repo) | **CLONE** → shadow + recovered to repo | Existed in HubSpot portal but not in git. Fetched from published environment and added to both `assets/css/` and `assets/shadow/css/`. |
| constants.json | `CLEAN x HEDGEHOG/templates/config/constants.json` | `clean-x-hedgehog-templates/config/constants.json` | **SHARE (Phase 0A)** | Shadow env uses same production HubDB tables in Phase 0A. Data isolation is future work (Phase 0B+). The inline-constants pattern (Issue #327) means templates don't actually load this at runtime. |

## Shadow Asset Namespace

All shadow assets live under distinct paths that make environment identity obvious:

- **Templates**: `CLEAN x HEDGEHOG/templates/learn-shadow/` (previously `learn/`)
- **Shadow CSS**: `CLEAN x HEDGEHOG/templates/assets/shadow/css/` (previously `assets/css/`)
- **Shadow JS**: `CLEAN x HEDGEHOG/templates/assets/shadow/js/` (previously `assets/js/`)
- **Shadow Cognito JS**: `CLEAN x HEDGEHOG/templates/learn-shadow/assets/js/` (previously `learn/assets/js/`)

## Reference Updates in Shadow Templates

All shadow templates had the following path substitutions applied:

| Original | Shadow |
|---------|--------|
| `/CLEAN x HEDGEHOG/templates/learn/macros/left-nav.html` | `/CLEAN x HEDGEHOG/templates/learn-shadow/macros/left-nav.html` |
| `/CLEAN x HEDGEHOG/templates/assets/css/` | `/CLEAN x HEDGEHOG/templates/assets/shadow/css/` |
| `/CLEAN x HEDGEHOG/templates/assets/js/` | `/CLEAN x HEDGEHOG/templates/assets/shadow/js/` |
| `/CLEAN x HEDGEHOG/templates/learn/assets/js/` | `/CLEAN x HEDGEHOG/templates/learn-shadow/assets/js/` |
| `'ACTION_RUNNER_URL': '/learn/action-runner'` | `'ACTION_RUNNER_URL': '/learn-shadow/action-runner'` |

## Known Pre-existing Issues (not introduced by this PR)

1. **debug-hubdb.html**: References `hs_path__eq=authoring-basics` which no longer exists in HubDB (module was archived). Template fails HubSpot validation. Exists in both prod and shadow. Not provisioned as a CMS page.

2. **learn-landing.css missing from git**: The production `get-started.html` template references `assets/css/learn-landing.css` which existed in HubSpot but was absent from the repo. This issue was discovered during shadow env work and **recovered**: the file was fetched from the published environment and committed to git.

## Phase 0A Limitations (follow-up work needed)

1. **HubDB data**: Shadow pages bind to the same production HubDB tables. Data isolation (separate shadow HubDB tables with test content) is Phase 0B work.
2. **Canonical URLs**: Shadow templates still have hardcoded `/learn/` paths in `canonical_url` constructions. This is acceptable for dev/test use but should be addressed if shadow env is used for SEO-sensitive testing.
3. **`base.html` not cloned**: If base layout changes are needed for shadow work, a shadow base layout will need to be created at that time. The relative `../../` paths in base.html constrain where it can live.
4. **Catalog page**: Shadow catalog page template is published but the `/learn-shadow/catalog` page slug is not provisioned as a CMS page (only the action-runner and the 6 main pages are provisioned). The `catalog.html` template is available in the shadow namespace for future use.
