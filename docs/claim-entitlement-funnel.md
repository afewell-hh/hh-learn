# Claim-entitlement funnel (#521)

**Status:** design for review. No implementation, no HubSpot activity, no cookie or auth changes.
Tags: **[repo]** read in code · **[design]** proposal · **[unverified]** a fact to check before build · **[LEGAL]** needs a legal answer, not an engineering one.

Parent #478. Consumes the badge model of #520 (PR #522, `docs/authoring-platform.md` §4.6; where this doc restates #520, #520 governs). Beside #498. Reuses the Cognito auth and storage of #385/#397. Bounded by #489 and #492 (guidance is bypassable). Supersedes the earlier "anonymous credit" draft on branch `claude/issue-521-20261105-1033`, which rested on a premise the customer has since corrected.

---

## 1. The model

> *"If people remain anonymous and have the potential to claim a badge, they get nothing unless they claim it. Anonymous users can't earn a badge because we have to assign a badge to a user, but they can earn a TEMPORARY right to CLAIM a badge if they register, and if for any reason their tracking cookie gets killed before they claim it, they get nothing."*

- **A badge cannot exist without a user.** Badges are rows on accounts.
- An anonymous visitor can hold a **claim entitlement**: a temporary, browser-bound right to have a specific badge minted if they register.
- **Registering mints the badge.** Nothing is transferred, because nothing existed to transfer.
- Lose the cookie, lose the entitlement. Never claim, get nothing. That is the design, not a failure mode.

**Inversion kept intact:** value first, registration as a claim action. A visitor never has to register, sign in, or accept anything to start exploring, to unlock, or to keep reading.

**Honest by construction:** the visitor does not have a badge, and the UI says exactly that. Nothing is promised that a cleared cookie could break, so there is no durability copy to write.

**Vocabulary (used consistently, including in UI strings):**

| Do not say | Say |
|---|---|
| you earned a badge | you have unlocked a badge you can claim |
| anonymous credit / anonymous badge | claim entitlement |
| claiming transfers your badge | registering mints your badge |

---

## 2. Client-side entitlement record

### 2.1 What is stored

One first-party cookie, written by page script **[design]**:

```
hhl_ent = v1.<base64url(JSON)>
{ "e": [["<module_slug>.<milestone_id>", <unlocked_day>], ...],   // unlocked_day = days since epoch
  "d": [<dismissed_day>, <count_at_dismissal>, <dismissals>] }   // prompting state, §4
```

- **Entitlements are #520 badge IDs (`<module_slug>.<milestone_id>`, immutable once published) plus the day they were unlocked.** Nothing else about the visitor: no visitor ID, no page history, no timestamps finer than a day, no device data.
- Cap of 16 entries (a few hundred bytes, far under the 4 KB cookie limit). Beyond the cap, the oldest is dropped.
- `Max-Age` 30 days, `SameSite=Lax`, `Secure`, not `HttpOnly` (page script must read it). **Increment 1 is host-only** (no `Domain=`, so the `__Host-` prefix is available; see §2.2). `Domain=` arrives only with cross-host product pages (Increment 3).

### 2.1a Dependency on #520: what the browser can evaluate before an account exists

The cookie stores the **outcome** of a browser-side evaluation (a badge ID), not the task credits beneath it. That is sufficient only if the milestone can be decided **within one page view**. A milestone needing two experiences completed on different pages or visits would leave the browser unable to tell that both were done, because no task evidence persists. **#520 has decided: Option A.** v1 claimable milestones must be fully evaluable within a single page view (#520 §4.6). Option B is named in #520 §4.8 as the next increment, with its minimum shape specified so this doc can leave room for it.

| #520 decision | What this doc does |
|---|---|
| **A. v1 claimable milestones are evaluated within a single page view. DECIDED for v1 (#520 §4.6).** | Cookie shape stays as in §2.1. The #520 validator rejects a `claimable` milestone whose rule spans more than one page view. **Increment 1 and v1 build to this.** |
| **B. A temporary task-evidence shape. Specified as the next increment (#520 §4.8); not v1.** | Add a `t` field holding satisfied `[module_slug, task_slug]` pairs, written under the same TTL and caps, **but not under the v1 notice**. That notice (§7.1) describes remembering an already-unlocked badge. Persisting partial task evidence changes what is stored and therefore the consent scope (#520 §4.8 says so, and this doc's v1 privacy analysis does not cover it). **Option B needs its own consent treatment, designed when it is built**: a revised notice and fresh legal answers on L1–L3 for the new data. Nothing here extends the v1 notice to `t`. The browser evaluates `evalRule` over `t` to derive `e`, and redemption re-evaluates server-side. Shape, caps and trust rules are whatever #520 §4.8 specifies; this doc only persists it. Needs cookie `v2` and a revised size cap. The `t` field is reserved room, not built in v1. |

Increment 1 is built to Option A and would work unchanged under B, because a single-page-view milestone is the common subset. Multi-experience milestones wait on Option B (§9).

### 2.2 Cookie rather than `localStorage`

- The customer says cookie, and a cookie has native expiry, which matches "temporary".
- A visitor may arrive from a **product page**. If product pages and `/learn` are different hosts under one registrable domain, only a cookie with `Domain=` set can be shared between them; `localStorage` cannot **[unverified: confirm the hosts]**. A `Domain=` cookie is sent to, and writable from, every host under that domain, which adds cookie-tossing exposure (any sibling host or script can overwrite it, and `__Host-` is unavailable). Forged contents are already accepted (§2.4), so the harm is limited to overwrite or deletion, but it is why **Increment 1 is host-only, on the host that serves both the experience and the claim**. `Domain=` (limited to hosts we control, and L6) waits for Increment 3.
- Server-set vs script-set: script-set is chosen so that no anonymous server endpoint is needed, which keeps "no server-side anonymous records" true. **[unverified]** Some browsers (Safari's tracking prevention) cap the lifetime of script-written cookies at about 7 days. The effective lifetime is therefore browser-dependent, and the TTL in §2.3 is an **upper bound, never a promise**. UI copy says "up to" and "at the latest".

### 2.3 TTL recommendation: yes, a fixed 30-day TTL per entitlement

The cookie's own expiry is the primary bound, but it is slid forward by every write (each new unlock rewrites the cookie), so on its own an early entitlement could live indefinitely. **Recommendation: also store `unlocked_day` per entitlement and treat it as expired 30 days after unlock. Fixed, never extended by revisits.**

For:
- Makes "temporary" true per entitlement rather than per cookie write, so a frequent visitor's oldest unlock does not live forever.
- Gives one honest, checkable date: "claim by 3 Dec". The visitor can plan.
- Bounds how long a stale unlock can be redeemed, and the server can enforce it at redemption (§3) with a small grace.

Against:
- It discards entitlements a returning visitor would have claimed eventually.
- A date is a deadline, and deadlines are the classic pressure device.

**Resolution:** the cost of discarding is low because **re-doing the experience unlocks the badge again** (the entitlement is renewed with a new date; the badge is still minted at most once per account). Pressure is the risk to manage, and it is managed by *how the date is shown*, not by hiding it:
- State the date once, in plain text, in the chip and the offer. No countdown, no colour change as it nears, no "last chance", no "X days left".
- No reminders. We have no email before registration, and we will not add one.
- On expiry, nothing is shown. No "you lost 2 badges" message (that is loss framing, §5).
- 30 days is a starting value, not a finding. Reasonable range 14–60.

If the customer prefers no explicit TTL, the design still works with cookie lifetime alone; the cost is the open-ended life described above, which contradicts the word they emphasised.

### 2.4 Forgeability: what it means here

The cookie can be edited. **That is fine and the design does not defend against it.** No authoritative record exists before claim. At worst, a forged entitlement mints an exploration badge for someone who registered an account. The cost to us is near zero, and nobody else is harmed: there is no shared scarcity, ranking or leaderboard.

What is trusted vs verified at claim time is in §3.3. The one place forgery would matter is if an entitlement-minted badge were ever treated as proof of verified skill, so §3.3 labels these badges instead of trying to harden the cookie.

### 2.5 Application state, not analytics (#480)

#480 limits experience routes to HubSpot-native analytics and removed the custom beacon. This cookie differs in kind:
- It is **read only to render the visitor's own UI** (the chip, the offer) and to be handed to the claim endpoint when *they* press Claim.
- It carries **no identifier**, so it cannot be joined, counted or used to recognise a returning visitor.
- **We send nothing on unlock, and no server code reads the cookie before the visitor claims.** There is no unlock event, no unlock log, and nothing is given to HubSpot or any other tool. Stated precisely: like any cookie, the browser attaches it to ordinary requests to the host, so it can appear in CDN or access logs even though nothing reads it. That is in scope for L1 and L5, and the design does not log the `hhl_ent` header where we control logging.

This argument fails, and the cookie becomes analytics, the moment anyone (a) adds an ID, (b) reports unlocks to a server or pixel "to measure the funnel", or (c) reads it from an analytics script. Funnel conversion is measured the #480 way: registrations and badge mints are visible in HubSpot-native tooling and the claim write. **Do not add unlock beacons.** Put this sentence in the build ticket as an acceptance criterion.

---

## 3. Mint-on-claim flow

### 3.1 Flow

1. The visitor presses **Claim** on the offer or chip. This is only possible when entitlements are held in the cookie (§7.2: claiming requires accepted storage). Page script sends them to the existing `GET /auth/signup?redirect_url=<this page>?hhl_claim=1` (or `/auth/login`) **[repo: `cognito-auth.ts` `handleSignup`/`handleLogin`, PKCE, redirect sanitised; [unverified] that the sanitiser preserves the query string]**. The intent travels in the return URL, so no `sessionStorage` is used.
2. Cognito registers or authenticates them. `handleCallback` sets the existing `hhl_access_token`/`hhl_refresh_token` cookies and redirects back to the page **[repo]**. The entitlement cookie is untouched by this: different cookie, first-party.
3. On return the entitlements are still in the cookie. It survives the redirect, and page memory is not relied on anywhere. With an authenticated session (`/auth/me` **[repo]**) and `hhl_claim=1`, script calls **`POST /entitlements/redeem`** with `{ "entitlements": [["<module_slug>.<milestone_id>", day], ...] }`. Without the parameter (normal login, §3.4) it shows the confirm card instead. The body is sent explicitly, not relied on from the cookie jar.
4. The server authenticates from the existing cookies, and for each entry writes a badge (§3.2). It responds `{ minted: [...], already_held: [...], rejected: [...] }`.
5. Script removes **every returned id** (minted, already held, or rejected) from the cookie, then shows "2 badges added to your account" and, if relevant, "1 was already in your account".

**Route name:** do not use `/claim` or `/auth/claim`. `POST /auth/claim` already exists and means something else (inviting a CRM contact into Cognito) **[repo: `index.ts`, `cognito-auth.ts` `handleClaim`]**. `/entitlements/redeem` avoids the collision, and "redeem" is accurate: the entitlement is consumed.

### 3.2 Write, idempotency, single consumption

- Item: `PK = USER#<userId>`, `SK = BADGE#<badge_id>` in the existing progress table, written with `ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)`. That is exactly the write-once pattern certificate issuance uses **[repo: `certificate-issuance.ts`]**, and `BADGE#` is the new sort-key prefix #520 reserves, so no existing item is touched.
- **Repeat redemption by the same account is a no-op** (`already_held`). Retrying after a network failure, two tabs, or double-clicking are all safe.
- **"Consumed once" is a client-side property plus a server-side per-account one.** The server holds no record of unredeemed entitlements, so it cannot stop the *same cookie value* being redeemed by two accounts (a shared computer, or a copied cookie). That is acceptable: each account receives an exploration badge the cookie said it had unlocked, and a badge held by two people costs nothing. The client removes entries after redemption, so ordinary use does not repeat it. Closing this would need a server-side registry of anonymous entitlements, which the customer asked us to drop.

### 3.3 What is verified, what is trusted, what is recorded

| Verified at claim time | Taken on trust |
|---|---|
| The caller is an authenticated Cognito user (session cookie, existing path) | That the visitor did the experience, and when |
| Each `badge_id` exists in the published catalog and is flagged `claimable: "entitlement"` | The unlock day (checked only for plausibility: not more than 1 day in the future, to allow clock skew; not older than the 30-day TTL plus 3 days of grace) |
| Badge label and criteria are taken from the catalog, never from the request | Nothing about the visitor's identity beyond the account |

**Provenance** on the minted item follows #520 §4.6 **[adopted, not invented]**: `source: "claim-entitlement"`, `unlocked_day`, `minted_at`, **`basis`** (copied from the catalog entry at mint, never from the request), **`definition_hash`** (catalog value at mint) and **`module_version`**, the module version in the catalog **at mint time, read server-side and frozen** (never taken from the request). The badge identifier is the canonical `<module_slug>.<milestone_id>`, so `SK = BADGE#<module_slug>.<milestone_id>`. A minted badge is never revoked or rewritten by later edits to the module.

Caveat, stated plainly: `module_version` records the definition in force when the badge was minted, not when the visitor unlocked it. The cookie does not carry a version, because it would be as forgeable as everything else in it. If the milestone was retired or made non-claimable in between, redemption rejects it (#520 condition 4). The provenance label exists because the evidence is self-reported in a browser; it lets the learner record and any future Open Badges export describe the badge honestly.

**Existing certificates, completion records and `task_statuses` are never read or written by this flow.** Entitlement badges are eligible only for exploration-tier badges that no milestone, `module-complete` or certificate depends on (see §6 for what that needs from #520).

### 3.4 An existing user who explored anonymously, then signs in

The visitor signs in with the normal login rather than pressing Claim, so the return URL has no `hhl_claim=1`. This card is also the fallback whenever that parameter is lost.
- On return, script sees an authenticated session **and** entitlements.
- It shows a **one-time inline card**: "This browser has 2 unlocked badges you can add to <email>." with **Add them** and **Not now**, plus a quiet **Discard** link.
- Nothing is minted without the click. A shared or borrowed computer could otherwise mint someone else's exploration onto a signed-in account.
- If the account already holds some of them, those show as "already in your account" and are not re-minted (§3.2).
- This card is not a push offer and does not count against the once-per-session limit in §4. It appears at most once per session, only on a signed-in page that holds entitlements.
- **Not now** leaves entitlements to expire normally and does not ask again that session. **Discard** clears them.

### 3.5 Different device or cleared cookie

Not handled, by design. A second device begins with no entitlements. A cleared cookie loses them. Neither shows an error, since nothing was promised. Badges already minted live on the account and are available from any device after sign-in.

---

## 4. Prompting rules ("low pressure", made mechanical)

State lives in the same cookie (`d`), so the rules are enforced in the client and cost nothing server-side. Initial values are starting points **[design]**.

**An offer ("push") may appear only if all hold:**
1. The visitor has at least **1 unlocked entitlement** (the offer *is* the unlock moment).
2. The trigger is **the visitor's own completion** of an experience, not a timer, scroll position, page load or exit intent.
3. No push has been shown in this **session** (a push is at most once per session).
4. Not suppressed by dismissal (below).
5. The visitor is not signed in.

**Dismissal is remembered.** "Not now" writes `d = [today, current_count, dismissals+1]`.
- After a dismissal, the next push needs **a new unlock and (7 days elapsed or at least 2 more entitlements than at dismissal)**.
- After **2 dismissals, no more pushes.** Only the chip remains.
- Dismissal being lost with the cookie is accepted.

**The chip (pull) is always available** while entitlements exist: "2 badges available to claim · until 3 Dec at the latest · Claim". It never animates, never takes focus and is never a modal. Claiming from the chip needs no prior push.

**Never:**
- Block, dim, or cover content; delay the next step; or make any content depend on registering (#492).
- Use a modal, interstitial, sticky overlay that hides content, auto-focus, or sound.
- Show a push, chip or Claim button when the visitor's storage choice is "declined" (§7.2). There is nothing to claim without stored state.
- Pre-tick marketing consent, or tie claiming to a newsletter opt-in.
- Write copy that implies the badge already exists, or invents scarcity or urgency.

**Offer copy states what is actually on the table:**
> You've unlocked the **Fabric Basics** badge. It's yours to claim if you register: it isn't on an account yet. This browser will remember it for up to 30 days. **[Claim by registering]** **[Not now]**

Registration is for claiming, so the offer also says what registering is for ("create a free account"), nothing more.

---

## 5. Escalating signal, and mechanics rejected

The signal is the count, which is true and gets stronger on its own: **"1 badge available to claim"** → **"3 badges available to claim"**, with names on expand. A short list of what the visitor completed for each badge (its `rule` from the catalog, in plain words) is shown on the claim page, so the visitor knows what they are getting.

**Rejected** (each manufactures pressure or optimises clicks, against #489):
- Streaks, daily goals, "keep it going".
- Countdown timers and colour escalation near expiry; "last chance" copy.
- **Loss framing**: "you'll lose your badges" and "you lost 2 badges" messages.
- Endowed-progress tricks (pre-filled bars), fake "almost there" states.
- Leaderboards, "N others claimed this".
- Exit-intent popups; rising nag frequency; re-prompts on every page.
- Points for clicks, dwell time or page views.
- Registration walls on later steps, or "register to see the answer".

---

## 6. What this needs from #520

I rely on #520's badge idea (milestone → badge, `BADGE#` prefix, stable IDs **[#520 §4.5, §5]**) and do not invent a parallel model. What I need to be true:

| Need | Why |
|---|---|
| **Stable, immutable `badge_id` = `<module_slug>.<milestone_id>`** once published (#520 §4.6) | The cookie and the server both refer to it; renaming would orphan unlocks |
| **A public catalog of badges** with #520's full field set: `id`, `label`, `rule`, `basis`, `claimable`, `definition_hash`, readable without auth | The chip and offer render names from it; the server validates against it. `definition_hash` makes the frozen-definition contract checkable: the server records the hash in force at mint (§3.3), so a minted badge ties to the exact definition it was minted under |
| **A flag marking a badge claimable-by-entitlement** (e.g. `claimable: "entitlement"`) | Only exploration badges may be minted from a self-reported cookie |
| **That flag is refused for any badge a certificate, `module-complete` or verified milestone depends on** (validator rule) | Keeps verified attainment unforgeable and certificates untouched |
| **A defined unlock event for entitlement badges** | #520 §4.6: a browser-observed completion (`basis: observed` in #520's evidence-basis vocabulary **[exact enum value unverified: #520's doc is not on this branch; use whatever it specifies]**), evaluated in the browser with no answer key (#298). A stateless pass/fail endpoint is the alternative; browser-only first |
| **Option A (single-page-view evaluation), decided for v1** | §2.1a. Option B is #520's specified next increment (§4.8) |
| **Evidence strength kept separate from activity type** | An observed-basis `interactive_check` must be able to back an exploration badge without being relabelled lab, assessment or transfer, or the badge criteria would imply assessment. Badge copy says "completed the walkthrough", never "demonstrated", "passed", "graded" or "certified" (#520 prohibits grading and certification vocabulary for observed-basis badges). A browser-observed badge records that something was completed, nothing more. #520 is addressing this; I align to its answer |
| **Provenance and frozen `module_version` on `BADGE#` items** | §3.3 |

If #520 prefers that exploration badges not exist at all, this funnel has nothing to mint, so that is the first question to settle with the customer.

---

## 7. Consent and privacy

The exposure is lighter than durable progress tracking: one first-party functional cookie holding badge IDs and a day, set by the visitor's own action, containing no identifier, never sent to a tracking tool, expiring in at most 30 days.

### 7.1 What the visitor is told, and when

At the moment of first unlock, before the first write (inline, next to the offer):
> To claim this badge you need to register, and this browser has to remember that you unlocked it, for up to 30 days. It doesn't identify you. If you clear cookies or use another browser, the chance to claim it is gone, and you won't have the badge. **[Remember it so I can claim]** **[No thanks]**

### 7.2 If storage is declined, or the site's cookie banner says no to functional cookies

**Claiming requires accepting functional storage.** The entitlement *is* the stored state, and registering means leaving the page for Cognito, which destroys anything held in page memory. So there is no declined-storage claim path, and none is offered: no chip, no Claim button, no push, and no `sessionStorage` handoff.

The experience itself works fully and is unchanged. After "No thanks" the visitor sees one plain line, "Not remembered. You won't be able to claim a badge for this.", with a **Change my mind** link that shows the §7.1 notice again. The right is temporary and tied to storage, and they chose not to keep it.

Global Privacy Control is treated as "No thanks" in Increment 1. That only removes persistence, so it is a safe conservative default pending L4.

### 7.3 Legal answers needed (none guessed here)

**Gating, one rule used everywhere:** Increment 1 ships only after **L1, L2, L3 and L5** are answered. L4 has a safe default (GPC treated as decline). L6 is not triggered by a host-only cookie; it gates Increment 3.

- **L1 [LEGAL]** Is a cookie remembering badges the visitor just unlocked "strictly necessary" or an equivalent exemption in each jurisdiction we serve? The visitor did not explicitly ask us to save it, which makes the exemption arguable rather than clear.
- **L2 [LEGAL]** Does the notice-and-choice in §7.1 satisfy consent where consent is needed, and must the write wait for the answer (the design assumes it does)?
- **L3 [LEGAL]** How does this relate to the HubSpot cookie banner: does our own prompt duplicate it, or should the site banner's functional-cookie category govern?
- **L4 [LEGAL]** Should Global Privacy Control or Do Not Track change anything, given nothing is shared or used for tracking?
- **L5 [LEGAL]** Is the registration notice and privacy policy enough to cover minting a badge from browser-held data and the resulting account record?
- **L6 [LEGAL]** Is a cookie with `Domain=` shared across product pages and `/learn` acceptable?

**Retention:** unclaimed entitlements expire with the cookie, at most 30 days after unlock. No server-side copy exists. Claimed badges are account data under the account's normal lifecycle. A visible **Forget** control (clears the cookie) sits in the chip menu.

---

## 8. Worked walkthrough

This is the **full-design** walkthrough (multiple badges, cross-page, re-offer rules), so it describes Increment 3 behaviour. Each badge here is a single-page-view milestone (Option A, §2.1a). §8.1 shows exactly what Increment 1 does. Sam arrives from a product page on day 0.

| Step | Stored | Shown | Verified |
|---|---|---|---|
| **0. Arrives from a product page** | Nothing | The page looks as expected. No banner, no prompt | Nothing |
| **1. Completes the first guided experience (day 0)** | After the notice and "Remember it so I can claim" (§7.1): `hhl_ent` = `{e:[["fabric-basics.explored-fabric",D0]]}` | Inline card: "You've unlocked the Fabric Basics badge. It's yours to claim if you register." Content stays fully usable | Nothing. No request is made |
| **1b. Presses "Not now"** | `d = [D0, 1, 1]` | Card closes. Chip: "1 badge available to claim" | Nothing |
| **2. Completes a second experience (day 0, same session)** | `e` = `[fabric-basics, vlan-basics]` | Chip updates to "2 badges available to claim · until D30 at the latest". **No push**: dismissed today, and +1 < +2 | Nothing |
| **3. Leaves, returns on day 9, same browser** | Cookie unchanged | Chip: "2 badges available" (unlock dates visible). No push on load | Nothing |
| **4. Completes a third experience (day 9)** | `e` = 3 entries; `d` unchanged | Push allowed: new unlock, ≥7 days since dismissal, first push this session. Card: "You've unlocked 3 badges you can claim." Chip shows 3 | Nothing |
| **5. Presses Claim** | Nothing new. Entitlement cookie holds 3 | Redirect to Cognito signup with return URL `…?hhl_claim=1` (existing flow) | Cognito: email, password, account creation |
| **6. Returns, signed in** | Auth cookies (existing). Entitlement cookie still has 3 (page memory is not used) | "Adding 3 badges…" | Session valid via `/auth/me` |
| **7. `POST /entitlements/redeem`** | Server: 3 × `BADGE#<module_slug>.<milestone_id>` items, each with `source: claim-entitlement`, `unlocked_day`, `minted_at`, `basis`, `definition_hash`, frozen `module_version`. Client: cookie entries removed | "3 badges added to your account." Links to the badges page and to the learning paths | Identity: yes. Each badge id in catalog and claimable: yes. Unlocked day plausible and within TTL+3d: yes. That Sam did the experiences: **no, trusted** |
| **8. Double click / reload on step 7** | Nothing new | "Already in your account" | Conditional write rejects repeats |
| **9. Later, a different device (phone)** | Phone: nothing | No chip. Signing in shows the 3 badges from the account. Any new exploration on the phone starts fresh entitlements (a badge Sam holds shows as "already in your account" if redeemed again) | Account badges: server record |

**Variants**
- *Cookie cleared between steps 3 and 5:* chip gone, no entitlements. Nothing was promised, so nothing is reported as lost.
- *Existing account:* Sam signs in via normal login at step 5 instead. On return, the card in §3.4 asks before minting.
- *Expired:* an entitlement 31 days old is dropped on read and not mentioned. Re-doing the experience unlocks it again.
- *Storage declined at step 1 ("No thanks"):* nothing is stored, and no chip, push or Claim button ever appears. The visitor sees "Not remembered. You won't be able to claim a badge for this." and can use **Change my mind**. The experience itself is unaffected.

### 8.1 Increment 1 walkthrough (one experience, one badge, host-only cookie)

Sam reaches the experience on `/learn` (the host that also serves the claim), day 0.

| Step | Stored | Shown | Verified |
|---|---|---|---|
| **0. Arrives** | Nothing | Normal page, no banner or prompt | Nothing |
| **1. Finishes the walkthrough** | Nothing yet | Inline card with the §7.1 notice: remember this browser so you can claim? | Nothing |
| **2a. "Remember it so I can claim"** | `hhl_ent` (host-only) `{e:[["<module_slug>.<milestone_id>",D0]]}`, `Max-Age` 30 d | "You've unlocked the **X** badge. It's yours to claim if you register: it isn't on an account yet. This browser will remember it for up to 30 days." **[Claim by registering]** **[Not now]**. Chip: "1 badge available to claim · until D30 at the latest" | Nothing, no request |
| **2b. "No thanks"** | Nothing | "Not remembered. You won't be able to claim a badge for this." No chip. End of the funnel for this visit | Nothing |
| **3. "Not now"** | `d` set (dismissed D0) | Card closes. Chip stays. **No further push ever** (Increment 1 has one badge, so there is no re-offer; this is stricter than §4, not a departure) | Nothing |
| **4. Leaves, returns day 9** | Cookie unchanged | Chip only, no push | Nothing |
| **5. Presses Claim** (chip or card) | Cookie unchanged | Redirect to Cognito signup, return URL has `hhl_claim=1` | Cognito creates the account |
| **6. Returns, signed in** | Entitlement cookie still present | "Adding your badge…" | Session via `/auth/me` |
| **7. `POST /entitlements/redeem`** | `BADGE#<module_slug>.<milestone_id>` with `source`, `unlocked_day`, `minted_at`, `basis`, `definition_hash`, frozen `module_version`. Cookie entry removed | "1 badge added to your account." | Identity yes; id in catalog and `claimable: "entitlement"` yes; day within TTL+3d and not >1 day future yes; that Sam did it: **trusted** |
| **8. Different device** | Nothing on the phone | No chip. After sign-in, the account shows the badge | Account record |
| **9. Existing user signs in normally (no `hhl_claim`)** | Cookie present | Confirm card: "This browser has 1 unlocked badge you can add to <email>." **Add it** / **Not now** / **Discard**. Nothing is minted without a click | As step 7, after the click |
| **10. Cookie cleared before step 5, or 31 days pass** | Nothing / expired entry dropped | Nothing. No "you lost" message | n/a |

---

## 9. Feature roadmap

Each increment ships value on its own.

Rule for the cut: **anything the Increment 1 copy or §4 policy promises ships in Increment 1.** A feature is deferred only if Increment 1 makes no promise that depends on it.

**Increment 1: one experience, one badge, unlock to mint.** Honestly shippable alone, because it contains every piece its own copy relies on:
- One Observed-tier experience with a single-page-view milestone (§2.1a Option A), on the same host as the claim; **host-only** cookie.
- The §7.1 notice with a real choice; decline stores nothing and shows no claim UI (§7.2); GPC treated as decline.
- Cookie `hhl_ent` with the 30-day TTL **enforced** (dropped on read, checked at redeem), because the copy says "up to 30 days". Date shown once as plain text.
- One push at unlock, dismissal remembered, then chip only. That is a strict subset of §4, so it cannot violate it. The re-offer rules (7 days / +2, two-dismissal stop) are not needed with one badge and are not built.
- The chip, **Forget** control (it is how "Clearing cookies removes them" stays easy to do), and the §3.4 confirm card for signed-in visitors, which is also the fallback when `hhl_claim` is lost.
- `POST /entitlements/redeem` with #520 provenance (`source`, `unlocked_day`, `minted_at`, `basis`, `definition_hash`, frozen `module_version`), write-once. Acceptance tests: idempotent double-redeem; unknown or non-claimable id rejected; future-dated and expired day rejected; oversized payload (more than 16 entries or a body cap) rejected; unauthenticated call rejected; `Content-Type: application/json` plus Origin check so a third-party page cannot post for a signed-in user; per-account rate limit; no unlock beacon exists (§2.5).
- **Gate:** legal L1, L2, L3, L5 (§7.3); #520 items in §6 (immutable ids, catalog, `claimable` flag and validator rule, Observed unlock event, provenance and `module_version` on `BADGE#`, Option A).

**Increment 2: more badges.** Several single-page-view badges on several `/learn` experiences. Adds the push re-offer rules (7 days or +2, two dismissals then chip only), the "N badges available" escalating chip, and the criteria list on the claim page. Consent handling is already settled for Increment 1 (L3 is a gate there), so nothing consent-related is deferred to here.

**Increment 3: product pages and beyond.** `Domain=` cookie shared with product-page hosts (needs L6, `Domain` limited to hosts we control, cookie-tossing note from §2.2), and post-claim surfacing of gamified learning paths and next steps (the customer's "once claimed, encourage ongoing participation"), bounded by #489.

**Waits on #520 (not scheduled):** multi-experience milestones. They need Option B's temporary task-evidence shape (§2.1a, #520 §4.8), the next increment on #520's side.

**Explicitly waits / not built:** Open Badges 3.0 export (#520 §4.5, customer demand); cross-device continuity (out of scope by design); server-side anonymous records; reminders or emails to unregistered visitors; any gating of content; counting unlocks as certificate or `module-complete` progress.

---

## 10. Decisions for the customer / owner

1. Confirm exploration-tier badges exist in #520 (§6), with provenance shown on the learner record or not (§3.3).
2. TTL: fixed 30 days, shown as a plain date (recommended), or cookie lifetime only (§2.3).
3. Confirm product pages and `/learn` hosts, and that Cognito signup completes in a single tab **[unverified]** (§2.2, §3.1).
4. Accept that one cookie value can be redeemed by two accounts (§3.2).
5. Obtain legal answers L1, L2, L3 and L5 before Increment 1 ships; L6 before Increment 3 (§7.3). L4 has a safe default.
6. Settled: #520 chose Option A for v1; Option B is its specified next increment (§2.1a). No action needed.
7. Claiming requires accepting functional storage; there is no declined-storage claim path (§7.2). Confirm that is acceptable.
