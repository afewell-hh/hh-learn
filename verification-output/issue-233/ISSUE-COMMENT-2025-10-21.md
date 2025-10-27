**Update – 2025-10-21 membership capture**

- Re-ran `tests/e2e/enrollment-flow.spec.ts` with `HHL_DEBUG` enabled: CTA remains **"Sign in to start course"** and `/events/track` stays blocked.
- Added a diagnostic Playwright helper (`tests/e2e/membership-diagnostic.spec.ts`) to log membership behavior on both a private page (`/tickets`) and a public course page.
- Result: login succeeds (`hs-membership-csrf` + `__hsmem` cookies present), but `/_hcms/api/membership/v1/profile` still returns **404** even on the private page. This confirms the membership profile API is not wired up in the portal, so public pages have no chance to detect identity.

Artifacts (Oct 21 2025 UTC):
- `verification-output/issue-233/membership-contrast-2025-10-21T04-43-15.143Z.json`
- `verification-output/issue-233/private-membership-1761021792478.png`
- `verification-output/issue-233/public-course-1761021794591.png`
- `verification-output/issue-233/playwright-2025-10-21.log`

Next action: keep Issue #233 open and proceed with Issue #242 (public-page auth alternative). We still need a membership profile response with status 200 to meet the original acceptance criteria.
