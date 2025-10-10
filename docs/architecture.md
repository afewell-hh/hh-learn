# Architecture Overview

_Last updated: keep in sync when major platform or integration changes land._

## High-Level Components
- **HubSpot CMS** – Customer-facing learning experience. Pages under `/learn` use Clean.Pro templates backed by HubDB content.
- **Content Source (Git)** – Markdown modules in `content/modules/**` are the source of truth. `npm run sync:content` renders them to HTML and writes HubDB rows.
- **HubDB** – Stores rendered module HTML plus metadata (`hs_name`, `hs_path`, difficulty, estimated minutes, tags, etc.). Publishes the data consumed by dynamic pages.
- **External Services** – AWS Lambda + API Gateway host interactive features (quiz grading, progress tracking) accessed by HubSpot pages and future web apps.
- **CRM Integration** – HubSpot custom objects and behavioral events capture learner progress. Calls are made through the `@hubspot/api-client` from Lambda functions.

## Current Flows
1. **Authoring** – Contributors edit markdown in Git, open PRs, and merge to `main`.
2. **Sync** – `npm run sync:content` (locally or via GitHub Actions) converts markdown → HTML, applies front matter metadata, and updates the HubDB `modules` table with retry/backoff protection.
3. **Delivery** – HubSpot dynamic page template (`module-page.html`) reads HubDB rows. `/learn` lists modules, `/learn/{slug}` renders detail pages, and Clean.Pro handles styling.
4. **Analytics** – Published modules trigger HubSpot tracking (page analytics today, behavioral events once Lambda endpoints ship).

## Near-Term Enhancements
- **Lambda APIs** – Serverless functions already scaffolded in `src/` will expose quiz grading and progress endpoints. Deploy via `npm run deploy:aws` when ready.
- **HubDB Automation** – Expand sync script to support additional tables (pathways, labs) and structured relationships.
- **UI Extensions** – Evaluate HubSpot UI Extensions for authenticated widgets once Content Hub Enterprise access is available.

## Operational Touchpoints
- Secrets and retry behavior for the sync process live in [`docs/content-sync.md`](content-sync.md).
- Clean.Pro customization guardrails live in [`docs/theme-development.md`](theme-development.md).
- Infrastructure-as-code for Lambda is defined in `serverless.yml`; update this document when adding stages or cloud resources.
