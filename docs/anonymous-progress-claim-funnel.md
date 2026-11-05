# Anonymous-progress-to-claim funnel (#521)

**Status:** design for review. No implementation, no HubSpot activity, no cookie or auth changes. Everything below marked **[design]** is a proposal; everything marked **[verified in repo]** was read in code; **[unverified]** needs a fact checked before build; **[LEGAL]** needs a legal answer, not an engineering one.

Parent: #478. Consumes the credit model of #520. Sits beside #498 (discovery junction). Reuses the shipped auth and attainment surface of #385/#397. Implementation and any HubSpot change remain behind the #489 customer checkpoints.

---

## 1. Summary

The customer's inversion: conventional funnels ask for registration **before** value. This gives value **first**, and earned credit becomes the reason to register. Registration is a **claim action**, not a toll gate. Every rule below is subordinate to that: a visitor never has to register, sign in, or accept anything to start earning, continue earning, or read content.

The design in six sentences:

1. **State:** a small, browser-held **ledger** (`localStorage`, no visitor ID, no server copy). It lists *which credits were earned*, nothing else about the visitor.
2. **Honesty:** the visitor is told what the ledger is and where it lives **before the first write**, and the UI only ever says "in this browser", never "you have". Loss is survivable by construction: credits are re-earnable, and nothing is promised that the mechanism cannot deliver.
3. **Trust:** the ledger is forgeable and that is acceptable, because **nothing a forged ledger can buy has value**. Anonymous credit is an explicitly lower **tier** (`explore`). It can produce exploration badges. It can **never** contribute to a certificate, `module-complete`, or any verified milestone.
4. **Claim:** on the visitor's own action, the ledger is sent to an authenticated endpoint. The server accepts **keys only**, looks weights up from the published catalog, writes each credit idempotently, and records **provenance** on every record.
5. **Prompting:** a mechanical policy (§6): an offer needs a completed badge, is an inline card (never a modal), is capped, dismissal is remembered, nothing is ever blocked, and with no persistence there is **no push offer at all**.
6. **Roadmap:** three increments (§10), each shippable alone. The smallest is ledger + honest notice + a *pull-only* claim.

---

## 2. What exists and what this reuses

**[verified in repo]**

| Fact | Where | Consequence |
|---|---|---|
| Auth cookies are `HttpOnly; Secure; SameSite=Strict`; access token path `/`, refresh path `/auth` | `src/api/lambda/cognito-auth.ts:317-330, 579-583` | The ledger **cannot** live in the auth cookies, and JS cannot read them. The claim endpoint authenticates via the existing session, not via anything in the ledger. |
| Login/signup carry a signed `state` JWT with a sanitised relative `redirect_url` (≤500 chars, no scheme) | `cognito-auth.ts:260-313` | The claim returns the visitor to the page they were on. No new redirect surface. The ledger is **not** put in `state` (length, and it would sit in URLs). |
| Per-user task records `USER#<id>` / `TASK#MODULE#<slug>#<task>`; module completion `COMPLETION#MODULE#<slug>` with `task_statuses` | `tasks-quiz-submit.ts:323-410` | The module completion record feeds certificates. **Anonymous credit must never be written into `task_statuses`.** See §5.4. |
| Certificate idempotency: conditional `PutItem` with `attribute_not_exists(PK) AND attribute_not_exists(SK)`, race loser re-reads | `certificate-issuance.ts:60-115` | The same pattern gives idempotent claims. |
| Custom analytics beacon removed; experience routes limited to HubSpot-native analytics (#480) | `docs/events-and-analytics.md` describes the legacy beacon; #480 removed it | The ledger must not become a beacon. See §3.3. |

**What this design needs from #520** is in §4. It is a list of interface requirements, not a parallel model.

---

## 3. Anonymous progress state

### 3.1 Decision

**First-party `localStorage`, key `hhl.ledger.v1`, written by the page only after the notice in §7.1 is accepted.** No anonymous identifier. No server-side copy.

### 3.2 Why not the alternatives

| Option | Verdict | Reason |
|---|---|---|
| **`localStorage`** (chosen) | Chosen | Capacity is ample, nothing is transmitted on every request, and it is readable by the page script that renders the progress chip. No HubSpot/CDN request carries it. |
| First-party cookie | Rejected as default | The customer said "cookies"; the *behaviour* they want (persist across visits) is the same. A cookie is sent with **every request** to the host, including HubSpot-served pages, for no benefit: nothing server-side reads it before claim. 4 KB cap. **Legally it is not different** (see §7.3), so cookie-versus-storage is an engineering choice only. **Exception:** if product pages and `/learn` turn out to be on different origins, a cookie scoped to the parent domain is the fallback **[unverified: confirm both surfaces share an origin]**. |
| Server-side with anonymous ID | Rejected for v1 | It requires **anonymous write endpoints** (abuse surface, cost), and the ID itself is stored in a cookie or `localStorage`, so it does **not** fix cleared storage or a second device. It also creates a persistent visitor identifier, which is exactly the thing that makes the "this is application state, not analytics" argument hard to win. It buys nothing the ledger does not, and costs the argument in §3.3. |
| `sessionStorage` | Rejected as the ledger | Does not survive the visit, which defeats "accumulate across visits". Used only for the short claim handoff (§5.1). |

### 3.3 Application state, not analytics (the argument, stated so it can be challenged)

#480 restricts experience routes to HubSpot-native analytics and removed the custom beacon. The ledger is a different thing, for four reasons that are properties of the design, not assertions about intent:

1. **No identifier.** The ledger holds credit keys and timestamps. There is no visitor ID, session ID, or fingerprint in it, so we cannot link two visits, two devices, or a visit to a person from it.
2. **Nothing leaves the browser until the visitor presses Claim.** No beacon, no background sync, no `sendBeacon`, no write on earn. We cannot observe the ledger. The only server contact is a visitor-initiated, authenticated claim.
3. **It is read to render the visitor's own UI**: the progress chip, the "2 of 3" bar, whether to show an offer. It has no other consumer.
4. **It is not an input to measurement.** Offer impressions, dismissals and claims must not be turned into custom events. Funnel measurement stays on HubSpot-native analytics of the CTA/claim click, per #480.

**The honest limit of this argument:** it holds only if the four properties stay true. Any later feature that sends ledger contents to a server without a visitor action, adds a visitor ID, or feeds ledger data to HubSpot properties converts this into tracking and re-opens #480. §10 lists those as "waits, with a reason". **[LEGAL]** whether regulators accept "application state" as a category distinct from tracking is jurisdiction-dependent (§7.3).

### 3.4 Ledger shape **[design]**

```json
{
  "v": 1,
  "c": { "explore-fabric/replay-check": 28790412, "explore-fabric/topology-predict": 28790418 },
  "dm": { "fabric-explorer": 28791100 },
  "n": { "notice": "accepted", "at": 28790400 }
}
```

- `c`: credit key → minutes since epoch earned. **Keys only. No weights, no kinds, no scores** (§5.3 explains why this matters for forgery).
- `dm`: milestone id → when the offer was dismissed (§6).
- `n`: the visitor's answer to the first-write notice.
- Hard caps: ≤ 64 credit entries, ≤ 8 KB serialised, `v` checked on read, unknown/oversized/malformed ledger **discarded silently and treated as empty** (never an error the visitor sees).

### 3.5 Loss is normal: what the design promises

The mechanism loses state when storage is cleared, in private windows, in another browser, and on another device. So the design promises **only what survives that**:

- **Never** "you have earned", "your badge", "saved", "your progress is safe". **Always** "in this browser".
- The persistent chip always carries the fixed line: **"Kept in this browser only. Register to keep it for good."**
- Credit is **cheap to re-earn and idempotent**: same check, same key, so losing a ledger costs the visitor the clicks, never the right to the outcome. Explore checks are deliberately short and deterministic.
- A different device shows an **empty** ledger and **says nothing about the other one**. We do not know it exists, and we do not pretend to.
- Permanence is offered as exactly one thing: **registering**, which moves credits from a browser to an account. That is the only sentence about durability that is true.

### 3.6 Capacity and tamper posture

- **Client-held credit is forgeable. This is acceptable and stated plainly.** A visitor can edit `localStorage` and grant themselves any keys. What they gain is a longer list in their own browser and, after claim, an **exploration-tier badge on their own account** labelled self-reported. It costs us nothing and gives them nothing a competitor, employer or customer should rely on.
- **We deliberately do not engineer against it**: no signing, no server receipts, no obfuscation, no anti-tamper. That machinery would be paid for with anonymous endpoints, secrets and rotation, to protect a thing of no value. (If that ever stops being true, §10 names the upgrade path.)
- **What forgery cannot do** is the real control, and it is structural, not a check (§5.3, §5.4): weights come from the catalog, tiers cannot cross into verified milestones, certificates never see anonymous credit, and key counts are capped.

---

## 4. Interface needed from #520

#520 has posted its model (`docs/authoring-platform.md` on its branch, `claude/issue-520-20261105-1013`): task `kind` + `credit`, `milestones` with `tasks`/`points`/`any`/`all` rules, milestone status **derived** from stored task statuses, `module-complete` pinned to the required tasks, and a validator rule that no milestone may be met by `read`/`practice` credit alone. I have **not** invented a parallel model. I need the following from it. Where #520 already provides one, I say so; where it does not, it is a **request**. Please reconcile in #520 rather than in this document.

| # | I need | #520 today | Status |
|---|---|---|---|
| **R1. What a credit is** | A credit is "task `T` of module `M` reached its success status". It carries `kind` and `weight` **defined by the catalog**, not by whoever holds it. | Tasks have `kind`/`credit`. | Compatible. State it as the definition. |
| **R2. What identifies it** | A stable **credit key** `<module_slug>/<task_id>`, identical whether earned anonymously or signed in. | Task ids exist per module. | **Request:** declare the key format normative and immutable once published. Renaming a task id orphans every ledger in the wild. |
| **R3. What makes two credits the same** | Same key = same credit. A learner holds **at most one record per key**; re-earning is a no-op; where both anonymous and verified evidence exist, **verified supersedes** (§5.3). | Task records are keyed per user per task already. | Compatible. State the rule. |
| **R4. A tier** | `tier: "explore" \| "verified"` on tasks and milestones. `explore` = may be earned and graded client-side, answer key may ship in the bundle, counts only toward `explore` milestones. `verified` = server-graded (today's behaviour). Default `verified`. | Not present. #520 says interactive checks are server-graded and keys are server-held. | **Request. This is the main gap.** Without it, explore checks either require anonymous server grading (the opposite of zero-infrastructure) or are forced into the verified model. |
| **R5. Validator exemption and its mirror** | An `explore` milestone is exempt from the "not satisfiable by read/practice alone" rule, **because it never certifies anything**. The mirror rule: a `verified` milestone, and `module-complete`, may **not** count `explore`-tier credit; validator-enforced. | Rule exists without exemption. | **Request.** |
| **R6. A pure evaluator** | `evaluate(milestone, satisfiedKeys: Set<string>, catalog) -> {met, remaining, nextKeys}` in `src/shared/`, with **no DynamoDB read**, runnable in the browser and in Lambda with identical results. | #520 says milestone status is derived from stored `task_statuses`; the evaluator is "new build". | **Request:** make it pure and give it a set of keys as input. This is the hard point from the #520 addendum. A milestone must be evaluable against credits that arrived **before an account existed**, so the evaluator cannot take a user ID. |
| **R7. A public catalog** | A static, versioned JSON of `{credit key -> kind, weight, tier}` and the milestone rules, published to the same place as the page assets. Carries `catalog_version`. | Authoring files are in the repo; sync pushes some to HubDB. | **Request** (build step; no HubDB change needed if it is emitted as a static asset). |
| **R8. Provenance field** | A credit record may carry `provenance { source, earned_at, claimed_at, claim_id, catalog_version }`. Absence means `server_graded`. | None. | **Request.** Additive; existing records read as `server_graded`. |
| **R9. Separate storage namespace** | Credit records for `explore` tier live under their own sort-key prefix, **not** in `COMPLETION#MODULE#<slug>.task_statuses`. | Milestone status is derived from `task_statuses` with "no new DynamoDB attribute". | **Request, and a constraint on #520.** See §5.4. |

If #520 declines R4/R5, this funnel can still ship but only as a **non-credit** experience (progress chip with no claim), which loses the point. That is the dependency, stated so the reviewer can decide.

---

## 5. The claim flow

### 5.1 Mechanics **[design]**

Reuses the shipped Cognito hosted-UI login/signup and the existing session. New: one authenticated endpoint and one client handoff.

1. Visitor presses **Claim** (a pull, or the card from §6). Nothing is claimed before this click.
2. The page copies the current ledger to a **handoff** key (`hhl.claim-handoff`, `localStorage` if the ledger is persisted, otherwise `sessionStorage`, written **now, on the visitor's action**, expiring in 30 minutes). Purpose: the redirect to Cognito unloads the page.
3. The page sends the visitor to the existing `/auth/signup` or `/auth/login` with `redirect_url` = the current learn path. **No ledger in the URL, in `state`, or in a fragment.**
4. On return, the page sees an authenticated session **and** a handoff, and does a single `POST /claims` with `{ "claim_id": "<client uuid>", "keys": ["m/t", ...], "ledger_v": 1 }`, authenticated by the existing access-token cookie. The identity comes from the session. **Nothing in the body names a user.**
5. On a success response the page deletes the handoff **and** the ledger, shows the result (§5.5), and from then on writes credits to the server as normal.

**[unverified]** Whether signup completes in the same tab. If email confirmation opens a link in another browser, the handoff is not there. Fallback is not an error: the ledger (if persisted) is still in the original browser, and the visitor can press Claim there after signing in. Needs to be tested against the real Cognito flow before build.

### 5.2 What the server does at claim time

The endpoint is **authenticated only**. Abuse is therefore bounded per account, and no anonymous write endpoint exists.

| Step | Check | On failure |
|---|---|---|
| 1 | Valid session (existing token verification) | 401. Client keeps the handoff and shows nothing alarming. |
| 2 | Body ≤ 8 KB, ≤ 64 keys, `ledger_v` known, `claim_id` is a UUID | 400 |
| 3 | De-duplicate keys | silent |
| 4 | Each key exists in the **current** published catalog with `tier: explore` | key dropped, returned under `rejected` with reason (`unknown`, `not_explore_tier`, `retired`); the claim continues for the others |
| 5 | Weights and kinds come from the **catalog**, never from the request | n/a |
| 6 | Timestamps (if any) clamped to `<= now` | clamped |
| 7 | Per key: conditional `PutItem` with `attribute_not_exists(PK) AND attribute_not_exists(SK)` (same pattern as `certificate-issuance.ts:99`); on `ConditionalCheckFailed`, read the existing record and report `already_held` | `already_held` is a normal outcome, not an error |
| 8 | Derive `explore` milestones from the account's `explore` credits with the §4-R6 evaluator; write badge records idempotently | same pattern |

**Taken on trust:** that the visitor actually did the exploration; that the ledger came from a browser they used; the `earned_at` values (recorded as `client_reported`).
**Verified:** identity (session); that each key is a real, currently-published, explore-tier credit; weights/kinds/milestone rules (server-side, from the catalog); shape and size.

### 5.3 What the learner record says about provenance

Every claimed credit record stores:

```json
{
  "PK": "USER#<sub>", "SK": "CREDIT#explore-fabric/replay-check",
  "tier": "explore",
  "provenance": {
    "source": "anonymous_claimed",
    "earned_at_client": "2026-11-05T10:12:00Z",
    "claimed_at": "2026-11-12T09:03:11Z",
    "claim_id": "<uuid>",
    "catalog_version": "2026-11-05.1",
    "ledger_v": 1
  }
}
```

- Badges derived from these display their provenance in words: **"Fabric Explorer: earned through guided exploration, self-reported before registration."** The label is not optional and not hideable.
- **Upgrade, never downgrade.** If the learner later earns the same key with server-graded evidence, the record becomes `source: server_graded` and keeps `first_seen_anonymous_at`. A verified record is never overwritten by an anonymous claim.

### 5.4 Safety of existing certificates and completion records

- Certificates (`CERT#...`) are issued from `COMPLETION#MODULE#<slug>` produced by `computeModuleStatus`. **Anonymous credit never touches either.** It is written to `CREDIT#...` records, a separate sort-key namespace. The existing `begins_with(SK, 'TASK#MODULE#<slug>#')` query (`tasks-quiz-submit.ts:369-375`) cannot see it.
- This matters concretely: #520 found that in `computeModuleStatus` a required task with an unknown `task_type` counts as satisfied once any status exists. Writing anonymous credit into `task_statuses` would put unverified data one typo away from a certificate. Hence R9.
- No existing record is read-modify-written by a claim. Rollback is deleting the `CREDIT#` records and the endpoint.
- Existing certificates and completion records stay valid and untouched. Backward compatibility holds trivially because the claim only **adds** a new record type.

### 5.5 Idempotency, double claim, and conflicts

| Case | Behaviour | Why this is acceptable |
|---|---|---|
| Same account claims the same ledger twice (retry, double click, two tabs) | Second request returns every key as `already_held`. No duplicates. | Per-key conditional write. |
| Same ledger claimed by **two different accounts** (shared computer, copied storage) | Both succeed, each independently. **We do not prevent this.** | The ledger has no identity, and credits are not a finite resource. No one is deprived. The result is a self-reported exploration badge on two accounts. Preventing it would require an anonymous visitor ID (rejected in §3.2). |
| Visitor **already has an account**, explored anonymously, then signs in | The page shows an inline, dismissible, one-time card: *"This browser holds 2 credits. Add them to your account?"* Accepting runs the same claim. Declining leaves the ledger alone. **Nothing is merged silently.** | Silent merge on sign-in would be a surprise write to an account. The union is safe (set semantics) but must be a choice. |
| Account already holds a key with server-graded evidence | `already_held`; the anonymous entry is dropped, never replaces. | §5.3. |
| Catalog changed since earning (key retired or renamed) | That key is `rejected: retired`; the visitor is told how many of N were recognised. | Honest, not silent. This is why R2 says keys are immutable once published. |
| Claim fails midway | Per-key writes are independent and idempotent; retrying completes the rest. | |
| Registration succeeds but claim call fails | Ledger and handoff are kept; the chip says "Not added yet. Try again". Never claims success it did not get. | |

---

## 6. Prompting rules: "low pressure" made mechanical

The customer said "very low pressure" twice. These are rules a unit test can check. They live in one config object (`claim-offer-policy.json`) and one pure function `shouldOffer(ledger, policy, context) -> {show, reason}` with a decision-table test, so the behaviour is reviewable without reading UI code.

### 6.1 Two different things: the chip and the offer

| | **Chip** (pull) | **Offer** (push) |
|---|---|---|
| What | Small persistent element: *"2 of 3 toward Fabric Explorer. Kept in this browser only. [Register to keep it]"* | An inline card offering to claim a **completed badge** |
| Appears | From the first credit, always (if a ledger exists) | Only when all of §6.2 holds |
| Counts as a "prompt"? | No. It is a status display with a link the visitor may use any time. | Yes. Subject to the caps. |

### 6.2 When an offer may appear (all must hold)

| Rule | Value |
|---|---|
| **Minimum credit** | The ledger completes at least one `explore` milestone, i.e. there is **a real badge to claim**. Credit counts alone never trigger an offer. |
| **Only after the visitor's own action** | The offer appears after a check result has been shown and the page is at rest. Never on load, on a timer, on scroll, on exit intent, or mid-interaction. |
| **Not signed in** | A signed-in visitor sees no offer (only the one-time merge card in §5.5). |
| **Persistence accepted** | If the visitor declined storage, **no offer is pushed at all**, because dismissal cannot be remembered and an offer that returns every page view is pressure. They still have the chip's Claim link (pull). |
| **Frequency cap** | At most **1 offer per milestone completion**, at most **1 offer per browser session**, and at least **7 days** since the last dismissal of any offer. |
| **Dismissal** | Remembered in the ledger (`dm`). A dismissed milestone is **never offered again**. A *different* newly completed milestone may be, subject to the other caps. |
| **No escalation** | The caps are **fixed**. They do not loosen as credit grows. More credit changes the *content* of the card (a true count), never its frequency or prominence. |

### 6.3 Never block content (per #492: guidance must be bypassable)

- The card is **inline**, after the content the visitor was reading, never an overlay, modal, interstitial, sticky banner, or focus trap.
- It never displaces or delays the primary "continue" control, never auto-scrolls, never steals focus, never animates for attention.
- Dismiss is one click, present at first paint, same visual weight as Claim, and does not ask why.
- No step of any exploration is gated on the offer, on registration, or on accepting storage.
- There are **no countdowns, no "limited", no "only N left", no "you'll lose", no streak or expiry language, and no confirm-shaming** ("No thanks, I don't want my badge").

### 6.4 What the offer says

Fixed template; only the facts vary:

> **You've completed Fabric Explorer.** This browser has 3 credits toward it. Register to add them to your account, where they're kept permanently. Without registering they stay in this browser until you clear its data. You can keep exploring either way.
> **[Claim and register]  [Not now]**

It states what is on the table (a self-reported exploration badge and the credits), says plainly what happens if they do nothing, and invents nothing. If registration is also the way to reach gamified paths, that is said as a fact once the claim succeeds (§10), not used as the hook here.

---

## 7. Privacy and consent

### 7.1 What the visitor is told, when state is first written

The notice appears **at the first credit, before any write**. It is shown with the earn result, not instead of it: the credit is displayed to the visitor on this page regardless of their choice.

> **You earned a credit.**
> To remember it between visits we can save a small note in this browser. It lists what you've completed. It isn't sent to us, and it has no name or ID in it. **It stays on this device only. Clearing your browser data, using a private window, or switching device will lose it.** Registering later lets you keep it permanently.
> **[Save in this browser]  [Don't save]**

- Two buttons of equal prominence. No pre-selection. The answer is stored in `n` and not asked again.
- Wording is for plain-language review by content and legal, but **the facts in bold are the requirement**, because they are what makes the promise true.
- A visible **"Forget this browser's progress"** control sits in the chip, always, for shared machines. It deletes the ledger and dismissals.

**[LEGAL]** I chose an explicit opt-in at the point of first write as the **conservative** default. If counsel confirms a notice alone suffices for this feature, the buttons can become a single acknowledgement. The opposite is not safe to assume.

### 7.2 Behaviour when persistence is declined

The experience works in full. Credits are held **in memory for the current page view only**; the chip still shows "2 of 3" and says *"Not saved. Leaving this page will lose it. Register to keep it."* It does not persist across navigation, which is stated. No push offer is shown (§6.2). The chip's Claim link works for credits in memory right now, using a handoff written on that click (§5.1).

### 7.3 Where a legal answer is required (not guessed here)

| # | Question | Why it is open |
|---|---|---|
| **L1** | Is a `localStorage` ledger for "progress the visitor is actively earning" within an exemption (strictly necessary / functional / requested service) in each jurisdiction we serve (EU/UK ePrivacy, GDPR, US state laws)? | Rules on storing or reading information on a device generally cover `localStorage` as well as cookies, so cookie-versus-storage does not decide it. Whether *remembering progress the visitor did not explicitly ask us to save* counts as a service they requested is the contested part. That is why §7.1 asks. |
| **L2** | Does a notice-plus-choice at first write satisfy the requirement, or is more (a category in the site consent banner) needed? | Depends on L1. |
| **L3** | Relationship to the HubSpot cookie banner. Our design treats this as **separate**: declining HubSpot analytics does not disable the ledger, and accepting HubSpot analytics is not treated as consent to the ledger. Is that separation acceptable, or must they be one surface? | Two prompts may itself be a user-experience problem. |
| **L4** | How to treat browser privacy signals (Global Privacy Control, Do Not Track): as a decline of persistence (my default, since it costs nothing), or as irrelevant to a first-party functional feature? | Depends on L1. |
| **L5** | Is the claim an acceptable processing step once the visitor registers: does the registration notice and privacy policy cover storing `CREDIT#` records and self-reported timestamps, and what is the erasure path for them? | After claim, the keys and timestamps become personal data of an account. |
| **L6** | Is the "Forget this browser's progress" control and the retention in §7.4 sufficient, or are other disclosures needed? | |

Engineering sets the defaults conservatively until these are answered. **Nothing in this PR touches cookies, consent, or HubSpot configuration.**

### 7.4 Retention

| State | Retention |
|---|---|
| Ledger in the browser | Rolling **180 days from the last write**. Expiry is enforced by the page on read (an expired ledger is discarded). It is a client-side promise only; we cannot enforce deletion on a device we do not control, and we say "this browser" accordingly. |
| Claim handoff | 30 minutes, deleted on success. |
| **Unclaimed state on our servers** | **None exists.** This is a property of the design: no anonymous ID, no anonymous writes. There is nothing to retain or purge. |
| Claimed credits (`CREDIT#`) | Same lifecycle as the account's other learner records. **Erasure path to be confirmed with the account-deletion process** **[unverified]**, and see L5. |
| Policy numbers (180 days, 30 minutes, 7 days) | Starting values, not findings. They are config and are a reviewer decision. |

---

## 8. Escalating perceived value, honestly

The only thing that escalates is **a true number**. The signal is "you have earned N things", which is accurate and, as it grows, becomes more compelling on its own.

### 8.1 What is shown, and when

| Moment | Shown | Not shown |
|---|---|---|
| After any credit | Chip: *"2 credits in this browser. 1 more for Fabric Explorer."* The remainder comes from the §4-R6 evaluator's `remaining`, so it is the true shortfall. | No claim ask |
| Badge completed | The badge, what it means, its provenance wording, and (if §6.2 holds) the offer | |
| Returning visit | Chip restores: *"3 credits, 1 badge, in this browser."* A visitor who has stopped doing anything sees a status line and nothing else. | No "welcome back, you're losing…" |
| Several milestones | A plain list of what has been earned and the next unfinished milestone with its true remainder | |
| After claim | What was added, what was not recognised, and (once, factually) the paths the account can now continue on (§10, increment 3) | |

### 8.2 Rejected mechanics, with the reason

| Rejected | Why |
|---|---|
| Streaks, daily goals, "come back tomorrow" | Optimise visits, not understanding (#489). Also fits badly with a ledger that can silently vanish. |
| Loss framing ("your 5 badges will disappear unless you register") | The loss is real, so it is **disclosed once, neutrally** (§3.5, §7.1). Repeating it as a threat converts disclosure into pressure. |
| Countdowns, expiry timers, "limited-time badge", invented scarcity or urgency | Dishonest. Credits are not scarce. |
| Fake or inflated social proof ("12,000 engineers claimed this") | Not ours to state unless true and sourced; not needed. |
| Endowed progress (starting a bar at 20%) | Manufactured pressure on an unearned number. Progress starts at 0. |
| Locked/blurred badge teasers designed to provoke, and "you're 1 click away!" copy | Teases reward instead of showing what was earned. |
| Rising nag frequency as credit grows | Caps are fixed (§6.2). |
| Exit-intent popups, modals, interstitials, sticky claim bars | Violates §6.3. |
| Credit for time on page, clicks, or viewing | #520 already rules this out; ledger entries come only from a completed check. |
| Public leaderboards, cross-module XP, speed bonuses | Out of scope and against #489. |
| Emailing "you have unclaimed badges" | Requires identity we do not have pre-claim; would also require an opt-in. |
| Pre-ticked marketing consent in the registration flow | The claim must not be a marketing opt-in vehicle. |

---

## 9. Worked walkthrough

**Illustrative content.** Module `explore-fabric` is a hypothetical product-exploration module, not a live one. `explore` milestone `fabric-explorer` is met by any 3 of its 4 `explore` credits. Keys, weights and the milestone are assumed under §4 R1-R7. The visitor is **Sam**. All times and counts are made up for the example.

| | |
|---|---|
| **Credits in the catalog** | `explore-fabric/replay-check` (w1), `explore-fabric/topology-predict` (w1), `explore-fabric/fault-predict` (w1), `explore-fabric/vpc-check` (w1). All `tier: explore`. |
| **Milestone** | `fabric-explorer`: `{ "tier": "explore", "points": 3 }` |

### Step 1. Sam arrives from a product page (Mon, laptop, no account)

- **Context:** a familiar product page; a link to the guided replay. Sam is not told to register. Content is fully open.
- **Stored:** nothing. No ledger, no cookie from us, no server record.
- **Shown:** the replay. No chip (no ledger).
- **Verified:** nothing; nothing to verify.

### Step 2. Sam earns the first credit

- Sam answers the replay's "what changed?" check correctly (a completed check, not a view).
- **Shown first:** the earn result *and* the §7.1 notice, with **Save in this browser / Don't save**.
- Sam chooses **Save in this browser**.
- **Stored:** `localStorage hhl.ledger.v1 = {v:1, c:{"explore-fabric/replay-check":M1}, n:{notice:"accepted"}}`. No server write, no network call.
- **Shown after:** chip: *"1 credit in this browser. 2 more for Fabric Explorer. Kept in this browser only. [Register to keep it]"*. No offer (no completed badge).
- **Verified:** nothing is verified, and the UI says "in this browser", never "saved".

### Step 3. Sam earns the second credit

- **Stored:** `c` gains `explore-fabric/topology-predict`.
- **Shown:** chip *"2 credits in this browser. 1 more for Fabric Explorer."* Still no offer, because there is no completed badge. The only ask is the always-visible chip link.
- **Verified:** nothing.

### Step 4. Sam leaves (closes the tab)

- **Stored:** the ledger stays in the laptop's browser. Nothing on our servers; we do not know Sam exists.
- **Shown:** nothing.

### Step 5. Sam returns two days later, **same laptop and browser**

- **Stored:** unchanged. Retention clock (180 days) was reset by the last write.
- **Shown:** page loads, ledger read, chip restores: *"2 credits in this browser. 1 more for Fabric Explorer."* No "welcome back", no pressure.
- **Verified:** nothing. The ledger is read for display only.

### Step 6. Sam earns the third credit

- **Stored:** `c` now has 3 keys.
- **Evaluated in the browser** by the R6 evaluator over the 3 keys and the published catalog: `fabric-explorer` is **met**.
- **Shown:** the badge, and, because §6.2 holds (completed badge, no session offer yet, no dismissal, signed out, persistence accepted, after Sam's own action), the §6.4 inline card. Sam can ignore it; the next exploration step is the primary control.
- **Verified:** nothing server-side yet. The badge is shown as "completed, in this browser".

### Step 7. (Branch A) Sam presses **Not now**

- **Stored:** `dm: {"fabric-explorer": M2}`. Never offered again for this milestone; any other offer waits 7 days from now.
- **Shown:** the card collapses to the chip. The Claim link remains.
- Sam can come back at any time and press the chip link.

### Step 8. (Branch B, the main path) Sam presses **Claim and register**

- **Stored:** the handoff, `hhl.claim-handoff = {ledger copy}`, written now, on Sam's click.
- **Redirect:** to the existing `/auth/signup`, `redirect_url` = current learn path. No ledger in the URL.
- Sam registers (Cognito hosted UI) and is returned to the page.

### Step 9. The claim

- **Client:** sees a session and a handoff; `POST /claims { claim_id, keys:[3 keys], ledger_v:1 }` with the existing session cookie.
- **Server (§5.2):** checks the session; checks size and shape; looks each key up in the catalog, all `explore`, all current; takes weight and kind from the catalog; writes three `CREDIT#...` records with conditional puts (all `claimed`); evaluates `fabric-explorer` with the same evaluator over the account's explore credits; writes the badge record.
- **Stored (server):** three `CREDIT#` records with `provenance.source = "anonymous_claimed"`, `claim_id`, `claimed_at`, `catalog_version`, `earned_at_client`; one badge record. **No `TASK#`, no `COMPLETION#`, no `CERT#` record is written or modified.**
- **Shown:** *"Added 3 credits and the Fabric Explorer badge to your account. This badge is marked as self-reported exploration."* The local ledger and handoff are cleared.
- **Verified:** Sam's identity (session); that all 3 keys are real published explore-tier credits; the weights and the milestone result (recomputed server-side). **Taken on trust:** that Sam did the exploration, and the earn times.
- **Idempotency check:** if Sam reloads and the request is replayed, the response is `3 already_held`, no duplicates.

### Step 10. Sam later opens the product page on a **phone** (different device)

Two sub-cases, both stated honestly:

**10a. Not signed in on the phone.**
- **Stored:** nothing there. The phone has no ledger.
- **Shown:** the page, no chip. We do **not** know about the laptop and say nothing about it. If Sam earns a credit, the §7.1 notice appears afresh and a new, separate ledger starts.
- A plain link: *"Already registered? Sign in to see your account."* (A link, not an offer.)
- **Verified:** nothing.

**10b. Signed in on the phone.**
- **Stored (server):** the 3 credits and the badge from step 9.
- **Shown:** *"3 credits, 1 badge, on your account."* It follows Sam to any device, which is the only durability we claim.
- If this phone's browser also holds an unclaimed ledger (say 1 credit), the **one-time merge card** (§5.5) offers to add it. Nothing is merged silently.

### Step 11. (Failure case) The laptop's storage was cleared before step 6

- **Stored:** the ledger is gone.
- **Shown:** no chip. Sam starts again from 0; the notice reappears at the first credit. The earlier two credits are gone; the notice at step 2 said they could be.
- **What the design buys:** the original promise ("in this browser only; clearing data loses it") was true. The re-earn is 3 short, deterministic checks. No promised value was lost, because none was promised beyond the browser.

---

## 10. LMS feature roadmap, feature by feature

Each increment is independently shippable. All depend on #520 steps 1-3 (validator, shared evaluator, milestone catalog), plus the §4 requests.

### Increment 1: the smallest useful version
- Ledger + first-write notice + decline mode.
- The chip (pull). **No push offers.**
- One `explore` milestone on one product-page replay (C0, zero infrastructure, no lease).
- `POST /claims` + `CREDIT#` records + provenance + idempotent writes.
- A plain "Explored" section on the account page listing claimed credits and badges with provenance wording.
- **Value alone:** visitors get a guided, progress-tracked product experience that works with no account; those who want to keep it can. Registration is already a claim action.

### Increment 2: low-pressure prompting and resilience
- The §6 push offer under the policy file and decision-table test; dismissal memory.
- The signed-in merge card.
- Optional **progress export/import** (a copyable text code) so a visitor who will not register can still move credits between devices. This directly addresses "second device" without an account; it is a convenience, not a promise.
- Per-product-page milestones and a "what's next" list from the evaluator's `nextKeys`.

### Increment 3: continue after claim
- After a successful claim, surface the gamified learning paths and recommend where the claimed credits lead (milestone-to-path mapping, authored, not inferred).
- Open Badges shaping for explore badges **if** #520 decides on portability (its open question). Explore badges would be issued only with the provenance wording intact.

### What explicitly waits, and why
| Waits | Reason |
|---|---|
| Signed server receipts so anonymous credit can count toward verified milestones | Requires anonymous grading endpoints and secrets. Only worth it if explore credit gains external value. The `tier` model leaves room for it. |
| Cross-device without registration (server-side anonymous ID) | Reintroduces a persistent visitor identifier; re-opens §3.3 and #480. |
| Certificates from anonymous credit | Never. Certificates require verified evidence (#520 §5). |
| Any server-side use of the ledger before a claim, or ledger-based segmentation in HubSpot | Breaks the "application state, not analytics" argument; needs a separate legal and #480 decision. |
| Email nudges about unclaimed badges | Needs identity and opt-in. |
| Funnel measurement beyond HubSpot-native analytics | #480. |

---

## 11. Honesty and constraints checklist

| Constraint | How it is met |
|---|---|
| Never imply earned credit is safe when it is in a browser | UI says only "in this browser"; the loss statement is in the notice at the **first write**, and a fixed line in the chip, not a footer (§3.5, §7.1). |
| Registration is never required to start or continue earning | §1, §6.3, §9 steps 1-6. |
| Content is never blocked; guidance is bypassable (#492) | §6.3. |
| Existing certificates and completion records untouched | §5.4: claims only add `CREDIT#` records and never modify `TASK#`, `COMPLETION#`, or `CERT#`. |
| Gamification bounded (#489) | §8.2 rejects streaks, scarcity, loss framing and the rest. Credit comes only from completed checks, never views or time. |
| Depends on #520's typed credit model | §4 lists exact requirements instead of inventing a model. |
| Application state, not analytics (#480) | §3.3, with its stated limits. |

## 12. Open questions for the reviewer

1. **R4/R5 tier model** (§4). Is an `explore` tier acceptable to #520/the customer? Without it the funnel cannot grant claimable credit without anonymous server grading.
2. **"Real credit".** The customer said "real credit". In this design, anonymous credit yields an *exploration-tier, self-reported* badge, never a verified milestone or certificate. Is that the customer's meaning of "real"? If not, the alternative is signed receipts (§10, waits), which costs an anonymous endpoint.
3. **Opt-in at first write** (§7.1). Conservative by design; a legal answer could simplify it (L1, L2).
4. **Shared origin** for product pages and `/learn` **[unverified]**. Decides `localStorage` versus a parent-domain cookie.
5. **Cognito signup in one tab?** **[unverified]** Decides whether the handoff survives (§5.1).
6. **Policy numbers** (≥1 completed badge, 7-day cap, 180-day ledger, 30-minute handoff): starting values for review.
7. **Same ledger claimed by two accounts is allowed** (§5.5). Confirm that is acceptable for exploration-tier badges.
