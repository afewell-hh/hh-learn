E2E Testing (Playwright)

Overview
- Headless E2E verifies the learn module page emits /events/track beacons and (optionally) that HubSpot contact properties update when authenticated.

Local Run
- Prereqs: Node 22+, Chrome dependencies.
- Env (examples):
  - HUBSPOT_TEST_USERNAME=you@example.com
  - HUBSPOT_TEST_PASSWORD=********
  - HUBSPOT_API_TOKEN=pat-na1-… (Project App distribution token; must include crm.objects.contacts.read)
- Commands:
  - npx playwright install --with-deps chromium
  - npm run test:e2e

GitHub Actions
- Workflow: .github/workflows/e2e.yml
- Triggers: push (main/pr61), PR to main, nightly (09:00 UTC), manual.
- Matrix Strategy: Tests run in parallel across 3 modules:
  - Accessing the Hedgehog Virtual Lab with Google Cloud
  - Deploying the Virtual Lab on AWS
  - Kubernetes Networking Fundamentals
- Secrets used:
  - HUBSPOT_TEST_USERNAME, HUBSPOT_TEST_PASSWORD (required)
  - HUBSPOT_API_TOKEN (optional; enables CRM property check)
  - SLACK_WEBHOOK_URL / TEAMS_WEBHOOK_URL (optional; notify on failure)
- Artifact: playwright-report-{run_id}-{job_index} (HTML report, traces, screenshots, video on failure).

Module URL Override
- Default: Matrix runs across 3 predefined module URLs.
- Override: set MODULE_URL env locally or use workflow_dispatch input in Actions to test a specific module.

Branch Protection Setup
To require E2E tests before merging to main:
1. Go to GitHub → Settings → Branches → Branch protection rules
2. Add/edit rule for `main` branch
3. Enable "Require status checks to pass before merging"
4. Search for and select: "e2e" (this is the job name from e2e.yml)
5. Enable "Require branches to be up to date before merging" (recommended)
6. Save changes

Note: The workflow must run at least once before the "e2e" check appears in the list.

Notes
- Site uses navigator.sendBeacon; test inspects page.on('request') to assert POSTs to /events/track.
- If CSP blocks inline JS, ensure module-page.html loads external progress.js and that constants.json is published.
