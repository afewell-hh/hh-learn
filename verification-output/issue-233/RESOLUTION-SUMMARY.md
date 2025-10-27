# Issue #233 – Public Page Login Regression (Post-PR #241 Review)

**Review Date:** 2025-10-21  
**Reviewer:** Codex (follow-up to Claude Code’s Oct 21 entry)  
**Status:** 🔁 Reopen Required — membership bootstrapper fails on public pages  
**Related Issues/PRs:** #233, #234, #235, #237, #238, PR #241

## Executive Summary

- The merged identity bootstrapper (`clean-x-hedgehog-templates/assets/js/auth-context.js`) still relies on HubSpot’s membership profile endpoint (`/_hcms/api/membership/v1/profile`).  
- On **public** Learn course pages the endpoint returns **404** immediately after login, leaving the CTA stuck on “Sign in to start course” and blocking CRM progress beacons.  
- HubSpot **Private Content** is already enabled (Settings → Website → Private Content), and membership login succeeds on a diagnostic private page. The failure is not portal misconfiguration.  
- Playwright evidence captured on 2025-10-21 (`verification-output/issue-233/playwright-test-results.log`) reproduces the regression confirmed in Issue #233’s acceptance criteria. The issue must remain open.

## Evidence Snapshot

| Artifact | Observation |
|----------|-------------|
| `verification-output/issue-233/playwright-test-results.log` | `/_hcms/api/membership/v1/profile` → **404** after login; CTA text unchanged |
| DOM dump (`auth-context` data attributes) | `data-email=""`, `data-contact-id=""` despite valid credentials |
| HubSpot portal check | **Private Content Enabled**; membership login works on gated test page |
| GitHub Issue 【turn2view0†233】 | Acceptance criteria require authenticated CTA state and enrollment persistence on public page |
| PR 【turn4view0†235】 | Refactors reuse identity bootstrapper but still assumes membership API succeeds |

## Findings

1. **Architecture gap:** Membership profile endpoint only resolves identity for pages marked as private, so the bootstrapper cannot satisfy the “public page with optional sign-in” requirement.  
2. **Test coverage:** `tests/e2e/enrollment-flow.spec.ts` accurately flags the regression; the red status is expected until a new auth path exists.  
3. **Documentation drift:** Project docs (`docs/auth-and-progress.md`, `docs/deployment-guide-v0.3.md`) still implied membership would solve the problem; updated in this review.  
4. **Ticket hygiene:** Claim in PR #241 about new `verification-output/issue-235/` artifacts is inaccurate — directory absent on main.

## Required Actions

1. **Reopen Issue #233** (or create follow-up) noting that membership-based solution does not satisfy public-page login. Attach the 2025-10-21 Playwright log and mark configuration as “Verified: Private Content enabled; still failing.”  
2. **Create blocking P0:** “Design & implement public-page authentication alternative” (links to Issues #233/#234/#235/#237/#238 and new Issue #239 mandate). Record in iteration backlog.  
3. **Deliver alternative auth approach:** evaluate HubSpot OAuth proxy or lightweight custom auth service using Project App tokens to mint signed session state for public pages.  
4. **Keep Playwright test failing intentionally** until alternative lands; document expectation in issue thread to prevent false closure.

## Validation Plan (Schedule 2025-10-22)

1. Log in on a temporary **private** test page to verify membership credentials remain valid (captures baseline proof).  
2. Immediately load a **public** course page and repeat the same actions; record the 404 response from `/_hcms/api/membership/v1/profile`, the stuck CTA, and console output.  
3. File the results alongside this summary to reinforce the architectural pivot decision and unblock solution design.

## Attachments & References

- Playwright console + failure trace (2025-10-21) — `verification-output/issue-233/playwright-test-results.log`  
- Ticket context: Issue #233【turn2view0†233】, PR #241【turn4view0†235】, Issue #239【turn14view0†239】  
- Updated documentation: `docs/auth-and-progress.md`, `docs/deployment-guide-v0.3.md`, `docs/iterations/2025-10-20-plan.md`

---

_Prepared for sprint review to ensure regression remains tracked and the new public auth initiative is blocked until resolved._
