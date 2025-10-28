# Server-Rendered Enrollment CTA – Align With Left-Nav Membership Logic

## Context
Issue #272 delivered native membership login, but the hero CTA on public course/pathway pages still relies on client-side identity (which never resolves without the old handshake). The left navigation already renders correctly using HubL (`request_contact.is_logged_in`). We need to make the hero CTA (and any similar components) behave the same way: render login vs. start/enrolled states server-side, with JavaScript only handling post-click behavior.

## Goals
- Render “Sign in to start course/enroll” vs. “Start course / Enrolled” entirely via HubL at page render time.
- Remove reliance on `window.hhIdentity` for initial CTA state; keep JS only for enrolling or post-login refresh.
- Ensure there is still a native login link (`/_hcms/mem/login?redirect_url=...`) for anonymous visitors.
- Document the change, update tests, and capture verification evidence.

## Phase 1 – Research & Plan
1. Review existing CTA logic:
   - `clean-x-hedgehog-templates/learn/courses-page.html`
   - `clean-x-hedgehog-templates/learn/pathways-page.html`
   - `clean-x-hedgehog-templates/assets/js/enrollment.js`
2. Identify UI states to handle on the server:
   - Anonymous (show login link)
   - Authenticated + not enrolled (show “Start course/Enroll” button)
   - Authenticated + enrolled (show success state)
3. Confirm whether we can read CRM enrollment state via HubL or if we keep the JS enrollment fetch/post-login refresh.
4. Document the planned markup changes and JS adjustments in `docs/adr/001-public-page-authentication.md` (append a short addendum).
5. Deliverable: `verification-output/issue-274/PLAN.md` summarizing the new server-rendered approach.

## Phase 2 – Implement
1. Update templates to include HubL conditional blocks, mirroring left-nav logic.
2. Ensure anonymous CTA uses `{{ login_url }}?redirect_url={{ request.path_and_query|urlencode }}`.
3. Adjust `enrollment.js` to skip login prompts; it should detect server-rendered state and only handle enrollment clicks for authenticated users.
4. Remove or simplify any client-side identity polling not needed after the change.
5. Maintain existing analytics hooks and toast messaging.

## Phase 3 – Testing & Verification
1. Manual tests with known membership user:
   - Anonymous → CTA shows login link
   - After login → CTA shows “Start course” or enrolled state
   - Enrollment flow still works (redirects to action runner)
2. Automated checks:
   - Update/create Playwright test to assert CTA text server-side (use `page.textContent` before any JS).
   - Ensure existing enrollment tests still pass (modify as needed to account for server-rendered state).
3. Capture before/after screenshots and console output in `verification-output/issue-274/`.

## Deliverables
- Updated templates & scripts
- `verification-output/issue-274/PLAN.md`
- Test evidence (`tests/e2e/...` updates + artifacts)
- Documentation updates (ADR addendum, README/test notes)

Once plan & implementation are ready, coordinate deployment via `hs project upload` or publish script.
