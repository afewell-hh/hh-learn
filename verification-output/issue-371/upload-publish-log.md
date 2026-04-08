# Issue #371 — Template Upload & Publish Log

Date: 2026-04-08

## Template Upload (DRAFT)

Command: `node dist/scripts/hubspot/upload-templates.js`

Result: **63 files uploaded successfully, 0 failures** (1 file outside allowlist skipped: `layouts/base.html` — correct, intentionally not uploaded via this script).

Shadow files uploaded to DRAFT:
- `CLEAN x HEDGEHOG/templates/learn-shadow/action-runner.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/assets/js/cognito-auth-integration.js` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/catalog.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/courses-page.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/debug-hubdb.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/get-started.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/macros/left-nav.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/module-page.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/my-learning.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/pathways-page.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/register.html` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/catalog.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/learn-landing.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/left-nav.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/module-media.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/registration.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/action-runner.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/auth-context.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/catalog-filters.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/course-breadcrumbs.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/course-context.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/course-navigation.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/courses.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/debug.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/enrollment.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/left-nav.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/login-helper.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/my-learning.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/pageview.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/pathways.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/progress.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/toast.js` ✓

## Template Publish (DRAFT → PUBLISHED)

Command: `node dist-cjs/scripts/hubspot/publish-template.js --path ... --local ...`

Validation: HubSpot Source Code API validation passed for all templates below.

Published successfully (29 files):
- `CLEAN x HEDGEHOG/templates/learn-shadow/module-page.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/courses-page.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/pathways-page.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/my-learning.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/register.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/action-runner.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/catalog.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/macros/left-nav.html` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/assets/js/cognito-auth-integration.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/catalog.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/learn-landing.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/left-nav.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/module-media.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/css/registration.css` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/action-runner.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/auth-context.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/catalog-filters.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/course-breadcrumbs.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/course-context.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/course-navigation.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/courses.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/enrollment.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/left-nav.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/login-helper.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/my-learning.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/pageview.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/pathways.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/progress.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/toast.js` ✓
- `CLEAN x HEDGEHOG/templates/assets/shadow/js/debug.js` ✓
- `CLEAN x HEDGEHOG/templates/learn-shadow/get-started.html` ✓ (after learn-landing.css was recovered)

Skipped/failed (pre-existing issues):
- `CLEAN x HEDGEHOG/templates/learn-shadow/debug-hubdb.html` — validation error: references `authoring-basics` HubDB row which no longer exists. Pre-existing issue in production template. Not used as a provisioned page.

## Shadow CMS Pages Provisioned

Command: `node dist/scripts/hubspot/provision-shadow-pages.js --allow-create --publish`
Publish: `PATCH state=PUBLISHED` via CMS Pages API

| Page Name | Slug | HubSpot ID | State |
|-----------|------|-----------|-------|
| Learn Shadow — Get Started | `learn-shadow` | 210727657869 | PUBLISHED |
| Learn Shadow — Modules | `learn-shadow/modules` | 210723427736 | PUBLISHED |
| Learn Shadow — Courses | `learn-shadow/courses` | 210727657871 | PUBLISHED |
| Learn Shadow — Pathways | `learn-shadow/pathways` | 210723427738 | PUBLISHED |
| Learn Shadow — My Learning | `learn-shadow/my-learning` | 210723427741 | PUBLISHED |
| Learn Shadow — Register | `learn-shadow/register` | 210727657873 | PUBLISHED |
| Learn Shadow — Action Runner | `learn-shadow/action-runner` | 210727657875 | PUBLISHED |

## HTTP Verification

### Shadow pages (all return HTTP 200):
- https://hedgehog.cloud/learn-shadow → HTTP 200 ✓
- https://hedgehog.cloud/learn-shadow/modules → HTTP 200 ✓
- https://hedgehog.cloud/learn-shadow/courses → HTTP 200 ✓
- https://hedgehog.cloud/learn-shadow/pathways → HTTP 200 ✓
- https://hedgehog.cloud/learn-shadow/my-learning → HTTP 200 ✓
- https://hedgehog.cloud/learn-shadow/register → HTTP 200 ✓
- https://hedgehog.cloud/learn-shadow/action-runner → HTTP 200 ✓

### Production pages (all return HTTP 200, templates UNCHANGED):
- https://hedgehog.cloud/learn → HTTP 200 ✓ (template: `CLEAN x HEDGEHOG/templates/learn/get-started.html`)
- https://hedgehog.cloud/learn/modules → HTTP 200 ✓ (template: `CLEAN x HEDGEHOG/templates/learn/module-page.html`)
- https://hedgehog.cloud/learn/courses → HTTP 200 ✓ (template: `CLEAN x HEDGEHOG/templates/learn/courses-page.html`)
- https://hedgehog.cloud/learn/pathways → HTTP 200 ✓ (template: `CLEAN x HEDGEHOG/templates/learn/pathways-page.html`)
- https://hedgehog.cloud/learn/my-learning → HTTP 200 ✓ (template: `CLEAN x HEDGEHOG/templates/learn/my-learning.html`)
- https://hedgehog.cloud/learn/register → HTTP 200 ✓ (template: `CLEAN x HEDGEHOG/templates/learn/register.html`)
