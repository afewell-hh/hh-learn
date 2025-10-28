# Membership Auth Verification – Research + Execution (Post-Issue #272)

## Context
Issue #272 deployed native HubSpot membership authentication for all Learn pages (see `docs/adr/001-public-page-authentication.md`). The project lead has personally re-confirmed that the `.env` credentials (`HUBSPOT_TEST_USERNAME` / `HUBSPOT_TEST_PASSWORD`) log in successfully via the left-nav “Sign In” link on `/learn`. Troubleshooting should assume those credentials are valid and focus on verifying the implementation.

## Phase 1 – Research & Planning (deliverable: `verification-output/issue-272/MEMBERSHIP-RESEARCH.md`)
1. Review repository sources:
   - `clean-x-hedgehog-templates/assets/js/login-helper.js`
   - `clean-x-hedgehog-templates/assets/js/auth-context.js`
   - `tests/helpers/auth.ts` (`loginViaMembership` helper)
   - `tests/e2e/native-login-flow.spec.ts`, `tests/e2e/login-and-track.spec.ts`
2. Use web search (HubSpot developer/site docs, community posts) to confirm current guidance on:
   - Membership login vs. private content
   - Availability of `request_contact.is_logged_in` on public pages
   - Recommended authentication/testing flows on the 2025 platform
   Capture up-to-date URLs and summarize relevant takeaways.
3. Document findings + planned verification steps in `MEMBERSHIP-RESEARCH.md`. Include assumptions, any gaps, and explicitly note that the provided credentials should work with the native left-nav flow.
4. Do not begin execution until the research deliverable is committed.

## Phase 2 – Execution & Verification (after Phase 1 complete)
1. **Automated validation**
   - `npm install && npx playwright install`
   - `npx playwright test tests/e2e/native-login-flow.spec.ts`
   - `npx playwright test tests/e2e/login-and-track.spec.ts`
   - Optional regression (JWT helper): `npx playwright test tests/e2e/enrollment-flow.spec.ts`
   - Store traces/screenshots in `verification-output/issue-272/<date>-playwright/`.
2. **Manual UX checks** using the same credentials (assume they are valid):
   - Clear cookies/private window.
   - Visit `https://hedgehog.cloud/learn/courses/getting-started-virtual-lab`.
   - Click “Sign in to start course” (or left-nav “Sign In”) to follow the native `/_hcms/mem/login` flow.
   - After login, confirm: CTA no longer shows “Sign in”; `/learn/my-learning` shows personalized data.
   - Capture console output:
     ```js
     document.getElementById('hhl-auth-context')?.dataset;
     (window as any).hhIdentity?.get();
     ```
   - Save before/after screenshots and console JSON in `verification-output/issue-272/` (e.g., `membership-validation-YYYYMMDD/`).
3. **Documentation**
   - Update `verification-output/issue-272/DEPLOYMENT-TEST-RESULTS.md` with results, linking to evidence.
   - Append findings to `verification-output/issue-272/IMPLEMENTATION-SUMMARY.md` (“✅ Membership verification complete” section) once everything passes.
4. **If issues remain**
   - Ensure the login path matches the left-nav flow; double-check research assumptions.
   - Capture network logs/errors describing where `request_contact` fails.
   - Document blockers clearly and skip the GitHub comment until resolved.

## References
- `docs/adr/001-public-page-authentication.md` (Option D: Native Membership Identity Injection)
- `docs/auth-public-login-alternative.md`
- `tests/README.md#authentication-helpers`

Please post research findings before executing Phase 2.
