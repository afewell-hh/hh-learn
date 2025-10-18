# Issue 188 Verification Evidence

**Run date:** 2025-10-17

## HTTP Endpoint Checks
- `curl` headers for `/learn` landing page: `learn-landing-headers.txt`
- `curl` headers for `/learn/modules`: `modules-headers.txt`
- `curl` headers for `/learn/courses`: `courses-headers.txt`
- `curl` headers for `/learn/pathways`: `pathways-headers.txt`
- `curl` headers for `/learn/my-learning`: `my-learning-headers.txt`
- `curl` headers for module detail (`fabric-operations-welcome`): `module-fabric-operations-welcome-headers.txt`
- `curl` headers for course detail (`network-like-hyperscaler-foundations`): `course-network-like-hyperscaler-foundations-headers.txt`
- `curl` headers for pathway detail (`network-like-hyperscaler`): `pathway-network-like-hyperscaler-headers.txt`
- HTTP 200 matrix for modules/courses/pathways: `module-status-codes.txt`, `course-status-codes.txt`, `pathway-status-codes.txt`

## API Checks
- Anonymous beacon test payload/response: `events-track-anon-response.json`
- Quiz grade API response: `quiz-grade-response.json`
- Progress read (no params): `progress-read-response.json`
- Progress read with email (nonexistent contact): `progress-read-email-response.json`
- Authenticated beacon test payload/response: `events-track-auth-response.json`
- Progress read with HubSpot contact ID (post-token refresh): `progress-read-contact-auth2-response.json`

## Constants Verification
- Live constants.json snapshot: `constants-json-live.json`

## AWS Environment Verification
- CloudWatch alarms export (includes composite `hedgehog-learn-dev-api-red`): `aws-cloudwatch-alarms.json`
- Lambda log group retention export: `aws-log-groups.json`
- Lambda config snapshot (sanitized): `aws-lambda-config-sanitized.json`
- CloudWatch tail showing previous 401 errors cleared after token refresh: `aws-logs-tail-2025-10-17T1747Z.txt` (see run log)
- GitHub Actions secrets restored on 2025-10-17 (`HUBSPOT_PRIVATE_APP_TOKEN`, `HUBSPOT_ACCOUNT_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) so future deploy runs can load credentials.

## Content Scope Snapshots
- Parsed module/course/pathway names captured from JSON-LD in downloaded HTML (see command history in shell logs).

## Prior Sync Logs Reviewed
- `verification-output/issue-183-sync-content-2025-10-17.log`
- `verification-output/issue-183-sync-courses-2025-10-17.log`
- `verification-output/issue-183-sync-pathways-2025-10-17.log`

## Outstanding Dependencies
- Content team sign-off pending for editorial review checklist.
- UI/UX verification for CTA rendering, filtering, and responsive behaviour pending.
- Lighthouse/accessibility performance passes pending.
- Successful GitHub “Deploy AWS (manual)” dispatch still pending (API dispatch returned 204 but no new workflow run recorded; GH CLI manual trigger produced no run—needs owner follow-up). See dispatch attempt log: `github-deploy-dispatch-2025-10-17T1857Z.log`.
- Additional dispatch attempt after restoring secrets captured in `github-deploy-dispatch-2025-10-17T1936Z.log` (still no workflow_dispatch run created — GitHub shows only push-triggered failures).
- Follow-up brief for Content/UX handoff captured in `content-ux-coordination-2025-10-17.md`.
