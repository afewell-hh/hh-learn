# Contributing Guide (Hedgehog Learn)

**Updated:** 2025-10-30

Keep this guide open whenever you edit CMS files. The publishing checklist below is mandatory—skip a step and you will see stale content.

---

## 1. Publishing checklist (run in order)

1. **Edit locally** and update (or add) a build marker near the bottom of each modified template:
   ```html
   <div class="hhl-build" data-build="2025-10-30T04:30Z"></div>
   ```
2. **Upload the project bundle** (keeps HubSpot aware of new source files):
   ```bash
   hs project upload --account=hh
   ```
3. **Publish every changed file** via the Source Code v3 API:
   ```bash
   npm run publish:template -- \
     --path "CLEAN x HEDGEHOG/templates/…" \
     --local "clean-x-hedgehog-templates/…"
   ```
   Run this once for *each* `.html`, `.css`, `.js`, or `.json` you touched. Use `npm run publish:constants` for `config/constants.json`.
4. **Publish the pages** so the new templates go live immediately:
   ```bash
   npm run publish:pages
   ```
5. **Verify from the edge** (must show the new timestamp). Example:
   ```bash
   curl -s https://hedgehog.cloud/learn/pathways/getting-started | grep data-build
   ```
   If the timestamp doesn’t match step 1, repeat step 3 for that template and rerun this check.
6. **Hard-refresh in a browser** (`Ctrl/Cmd+Shift+R`) and confirm the UI & console output look correct.

No timestamp = not deployed. Do **not** debug functionality until the timestamp check passes.

---

## 2. What lives where

| Area | Purpose | Commands | Notes |
| --- | --- | --- | --- |
| `src/` (HubSpot Project) | App components, cards, functions | `hs project upload` | Fast deploy, minimal cache |
| `clean-x-hedgehog-templates/` | CMS templates & referenced assets | `npm run publish:template` | Must use Source Code v3; File Manager will NOT work |
| Live pages | Marketing pages served to users | `npm run publish:pages` | Flushes page-level cache after template changes |

---

## 3. Verification protocol

1. Build marker present in the source file.
2. `publish:template` run for every modified file.
3. `publish:pages` completed.
4. `curl … | grep data-build` shows the new timestamp for each affected page.
5. Browser hard-refresh matches expected UI (no stale markup/JS).

If any step fails, fix it first—HubSpot will *not* self-correct.

---

## 4. Common mistakes (and fixes)

| Mistake | Why it happens | Fix |
| --- | --- | --- |
| Using `hs filemanager upload` for templates | File Manager ≠ Design Manager; HubSpot keeps serving the old source | Always use `npm run publish:template` |
| Waiting for "cache to clear" | Wrong deployment method, so nothing new reached the CDN | Redo the checklist (publish template, publish pages, verify timestamp) |
| Debugging before verifying | Deploy failed silently, so you're testing old code | Only start QA after the timestamp check succeeds |
| Forgetting page publish | Template updated, but the page still points at the old build | Always run `npm run publish:pages` after publishing templates |
| Creating new page but it stays in DRAFT | Page provisioned via `provision-pages.ts` but not added to `PAGES_TO_PUBLISH` array | Add page slug + ID to `PAGES_TO_PUBLISH` in `scripts/hubspot/publish-pages.ts`, then run `npm run publish:pages` |

---

## 5. Creating new pages (important workflow)

When you create a new CMS page, you must complete **two separate steps**:

### Step 1: Provision the page (creates it in DRAFT state)
```bash
node dist/scripts/hubspot/provision-pages.js --allow-create
```

This creates or updates the page in HubSpot, but leaves it in **DRAFT** state. The page exists but is not publicly accessible.

### Step 2: Add to publish list and publish

**CRITICAL:** After provisioning, you must manually add the new page to the `PAGES_TO_PUBLISH` array in `scripts/hubspot/publish-pages.ts`:

```typescript
const PAGES_TO_PUBLISH = [
  { slug: 'learn', id: '197177162603' },
  { slug: 'learn/your-new-page', id: 'PAGE_ID_FROM_PROVISION_OUTPUT' },  // ← Add this
  // ... other pages
];
```

Then publish it:
```bash
npm run publish:pages
```

**Why this matters:** The `publish:pages` script only publishes pages listed in the `PAGES_TO_PUBLISH` array. If you skip this step, your page will remain in DRAFT state and return 404 or redirect to other pages.

**Common symptom:** "I provisioned a page but it's not accessible" → You forgot to add it to the array.

---

## 6. Handy commands

```bash
# Publish template / asset
npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/foo.html" --local "clean-x-hedgehog-templates/learn/foo.html"

# Publish constants.json
npm run publish:constants

# Publish all public pages (flush page cache)
npm run publish:pages

# Validate template syntax before publishing
npm run validate:template -- --path "…" --local "…" --env published

# Verify deployment (timestamp must match your change)
curl -s https://hedgehog.cloud/learn/<slug> | grep data-build
```

Scripts live in `scripts/hubspot/`. If a task isn’t covered here, check that directory before inventing your own tooling.

---

## 7. Local iteration (quick tips)

- Use the test HTML pages under `clean-x-hedgehog-templates/` or JSDOM-based tests for rapid JS iteration.
- Keep console logging until after a successful deploy; remove noisy logs once confirmed live.
- Commit only source files—never the generated CDN output.

---

Need help? Share the commands you ran **and** the latest timestamp check in project chat. Those two data points solve most issues in minutes.

---

## 8. Environment cheatsheet

### Local `.env`

| Variables | Purpose / usage |
| --- | --- |
| `HUBSPOT_LEARN_APP_DISTRIBUTION_TOKEN`, `HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_PROJECT_ACCESS_TOKEN`, `HUBSPOT_PERSONAL_ACCESS_KEY`, `HUBSPOT_DEVELOPER_API_KEY` | HubSpot authentication for CLI, REST APIs, and Source Code v3 publishing scripts. These are auto-loaded by the npm scripts—do not copy them into commands manually. |
| `HUBSPOT_ACCOUNT_ID` | Portal ID (`21430285`). Needed when a command asks for `--account` (e.g., `hs project upload --account=hh`). |
| `HUBDB_MODULES_TABLE_ID`, `HUBDB_COURSES_TABLE_ID`, `HUBDB_PATHWAYS_TABLE_ID`, `HUBDB_CATALOG_TABLE_ID` | Table identifiers consumed by the sync jobs (`npm run sync:content`, `sync:courses`, `sync:pathways`). |
| `AWS_REGION`, `APP_STAGE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SERVERLESS_ACCESS_KEY` | Credentials/stage info for Serverless deployments. Required when running `npm run deploy:aws` or other Lambda maintenance. |
| `GITHUB_TOKEN`, `PROTECTION_TOKEN`, `REVIEWER_TOKEN` | Automation tokens for repo scripts (labeling, review helpers, etc.). Leave them in place; they’re imported by the automation tooling. |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | Used by any build/publish steps that need to pull or push Docker images. |
| `ENABLE_CRM_PROGRESS`, `JWT_SECRET` | Feature/config flags surfaced to Lambda/CMS code. Change only when rotating secrets or toggling CRM progress. |
| `HUBSPOT_TEST_USERNAME`, `HUBSPOT_TEST_EMAIL`, `HUBSPOT_TEST_PASSWORD` | Test credentials consumed by Playwright suites. Do not use them for manual browsing. |

> ⚠️ These values are sensitive. The tooling already loads `.env` via `dotenv`; avoid echoing them or checking them into git.

### GitHub Action secrets

Workflows read the following (see `.github/workflows`):

| Secret | Used by | Notes |
| --- | --- | --- |
| `HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_API_TOKEN` | Workflows that hit HubSpot APIs (template validation, sync, e2e) | Keep aligned with the values in `.env` |
| `HUBSPOT_TEST_USERNAME`, `HUBSPOT_TEST_PASSWORD` | Playwright E2E suites | Same test user as local runs |
| `SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL` | Optional failure notifications | Leave unset to disable notifications |

If you need to add a new secret, create it in GitHub → Settings → Secrets and update the workflow that consumes it.

Refer to each workflow file for additional secrets; add new ones via repo settings before referencing `secrets.*` in YAML.

---

## 9. CI expectations

Continuous integration comprises:

- **`ci.yml`** – runs `npm ci`, lint, build, and unit tests on every push/PR.
- **`e2e*.yml` suites** – Playwright end-to-end checks (smoke, catalog, navigation, nightly auth, etc.).
- **Validation workflows** – HubL linting (`validate-templates.yml`), content verification (`validate-detail-content.yml`, etc.).
- **Sync/publish jobs** – e.g., `publish-constants.yml`, `sync-content.yml` for automation.

### Your responsibilities

1. **Keep pipelines green.** If any workflow fails because of your change, fix it or coordinate a follow-up PR immediately.
2. **Add or update automated tests** for new behavior. Feature changes without regression coverage will be rejected.
3. **Run relevant suites locally** when feasible (`npm run lint`, `npm run build`, targeted Playwright tests) before pushing.
4. **When CI is unstable**, note the failing job in your PR description and link to tracking issues/workarounds.

Anti-regression testing is not optional—every functional change must ship with either new automated coverage or an update to the existing suites listed above.
