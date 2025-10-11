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
- Secrets used:
  - HUBSPOT_TEST_USERNAME, HUBSPOT_TEST_PASSWORD (required)
  - HUBSPOT_API_TOKEN (optional; enables CRM property check)
  - SLACK_WEBHOOK_URL / TEAMS_WEBHOOK_URL (optional; notify on failure)
- Artifact: playwright-report (HTML report, traces, screenshots, video on failure).

Module URL Override
- Default: Google Cloud VLAB module URL.
- Override: set MODULE_URL env locally or the workflow_dispatch input in Actions.

Notes
- Site uses navigator.sendBeacon; test inspects page.on('request') to assert POSTs to /events/track.
- If CSP blocks inline JS, ensure module-page.html loads external progress.js and that constants.json is published.
