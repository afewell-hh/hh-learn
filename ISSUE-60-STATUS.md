---
title: Issue #60 – Projects Access Token Migration
owner: hh-learn project lead
status: in-progress
last-reviewed: 2025-10-17
---

# Issue #60 – Projects Access Token Migration

**Status (2025-10-17):** Code and configuration landed in PR #61, but the Projects Access Token migration is **not complete** until manual verification artifacts are captured and linked on the GitHub issue. Treat the issue as active work.

## Completed
- Project scopes updated and deployed with Build #16; app installation now exposes the required static bearer token.
- Serverless configuration, `.env.example`, and shared HubSpot client prefer `HUBSPOT_PROJECT_ACCESS_TOKEN` with Private App token as temporary fallback.
- Verification assets exist (`docs/issue-60-verification-guide.md`, `scripts/verify-issue-60.sh`) and are ready to run once a fresh token is issued.

## Outstanding
- Generate a new Project Access Token via HubSpot UI, store it locally, and add it as the `HUBSPOT_PROJECT_ACCESS_TOKEN` GitHub secret.
- Redeploy the AWS Lambda/API Gateway stack with the project token set so authenticated beacons persist successfully.
- Execute the verification guide end-to-end and post the artifacts (BEFORE/AFTER contact state, POST/GET responses) back to [Issue #60](https://github.com/afewell-hh/hh-learn/issues/60).

## References
- Detailed steps: `docs/issue-60-verification-guide.md`
- Automation: `scripts/verify-issue-60.sh`
- Source of truth: [GitHub Issue #60](https://github.com/afewell-hh/hh-learn/issues/60)
