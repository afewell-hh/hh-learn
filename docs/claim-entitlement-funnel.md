# Claim-entitlement funnel (#521)

**Status:** design for review. No implementation, no HubSpot activity, no cookie or auth changes.
Tags: **[repo]** read in code · **[design]** proposal · **[unverified]** a fact to check before build · **[LEGAL]** needs a legal answer, not an engineering one.

Parent #478. Consumes the badge model of #520 (`docs/authoring-platform.md` on branch `claude/issue-520-20261105-1013`). Beside #498. Reuses the Cognito auth and storage of #385/#397. Bounded by #489 and #492 (guidance is bypassable). Supersedes the earlier "anonymous credit" draft on branch `claude/issue-521-20261105-1033`, which rested on a premise the customer has since corrected.

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
{ "e": [["<badge_id>", <unlocked_day>], ...],   // unlocked_day = days since epoch
  "d": [<dismissed_day>, <count_at_dismissal>, <dismissals>] }   // prompting state, §4
```

- **Entitlements are badge IDs plus the day they were unlocked.** Nothing else about the visitor: no visitor ID, no page history, no timestamps finer than a day, no device data.
- Cap of 16 entries (a few hundred bytes, far under the 4 KB cookie limit). Beyond the cap, the oldest is dropped.
- `Max-Age` 30 days, `SameSite=Lax`, `Secure`, not `HttpOnly` (page script must read it).

### 2.2 Cookie rather than `localStorage`

- The customer says cookie, and a cookie has native expiry, which matches "temporary".
- The visitor arrives from a **product page**. If product pages and `/learn` are different hosts under one registrable domain, only a cookie with `Domain=` set can be shared between them; `localStorage` cannot **[unverified: confirm the hosts]**. The cost is that the cookie is sent on requests to every host under that domain; at a few hundred bytes this is acceptable, and the domain choice should be minimal (not a parent of unrelated systems).
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
- **Nothing is sent anywhere before the visitor claims.** There is no unlock event, no server log of unlocks, and nothing is given to HubSpot or any other tool.

This argument fails, and the cookie becomes analytics, the moment anyone (a) adds an ID, (b) reports unlocks to a server or pixel "to measure the funnel", or (c) reads it from an analytics script. Funnel conversion is measured the #480 way: registrations and badge mints are visible in HubSpot-native tooling and the claim write. **Do not add unlock beacons.** Put this sentence in the build ticket as an acceptance criterion.

---

## 3. Mint-on-claim flow

### 3.1 Flow

1. The visitor presses **Claim** on the offer or chip. Page script stores a tiny `claim intent` marker in `sessionStorage` (a handoff across the redirect, deleted after use) and sends them to the existing `GET /auth/signup?redirect_url=<this page>` (or `/auth/login`) **[repo: `cognito-auth.ts` `handleSignup`/`handleLogin`, PKCE, redirect sanitised]**.
2. Cognito registers or authenticates them. `handleCallback` sets the existing `hhl_access_token`/`hhl_refresh_token` cookies and redirects back to the page **[repo]**. The entitlement cookie is untouched by this: different cookie, first-party.
3. On return, script sees an authenticated session (`/auth/me` **[repo]**) and the entitlements, and calls **`POST /entitlements/redeem`** with `{ "entitlements": [["badge_id", day], ...] }`. The body is sent explicitly, not relied on from the cookie jar.
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
| Each `badge_id` exists in the published catalog and is flagged claimable-by-entitlement | The unlock day (checked only for plausibility: not in the future, within TTL plus 3 days of grace) |
| Badge label and criteria are taken from the catalog, never from the request | Nothing about the visitor's identity beyond the account |

**Provenance** on the minted item, a single small attribute **[design]**: `source: "claim-entitlement"`, plus `unlocked_day` and `minted_at`. Reason: the evidence is self-reported in a browser, and badges earned while signed in through server-graded checks are stronger evidence. Keeping the label costs one string, lets the learner record and any future Open Badges export (#520 §4.5) describe the badge honestly, and means the cookie never has to be hardened. If the customer does not want any distinction, this is the one line to drop.

**Existing certificates, completion records and `task_statuses` are never read or written by this flow.** Entitlement badges are eligible only for exploration-tier badges that no milestone, `module-complete` or certificate depends on (see §6 for what that needs from #520).

### 3.4 An existing user who explored anonymously, then signs in

The visitor signs in with the normal login rather than pressing Claim, so no `claim intent` marker exists.
- On return, script sees an authenticated session **and** entitlements.
- It shows a **one-time inline card**: "This browser has 2 unlocked badges you can add to <email>." with **Add them** and **Not now**, plus a quiet **Discard** link.
- Nothing is minted without the click. A shared or borrowed computer could otherwise mint someone else's exploration onto a signed-in account.
- If the account already holds some of them, those show as "already in your account" and are not re-minted (§3.2).
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
- Show a push when the visitor's storage choice is "declined" (§7), other than the chip.
- Pre-tick marketing consent, or tie claiming to a newsletter opt-in.
- Write copy that implies the badge already exists, or invents scarcity or urgency.

**Offer copy states what is actually on the table:**
> You've unlocked the **Fabric Basics** badge. It's yours to claim if you register: it isn't on an account yet. This browser will remember it for up to 30 days. **[Claim by registering]** **[Not now]**

Registration is for claiming, so the offer also says what registering is for ("create a free account"), nothing more.

---

## 5. Escalating signal, and mechanics rejected

The signal is the count, which is true and gets stronger on its own: **"1 badge available to claim"** → **"3 badges available to claim"**, with names on expand. A short list of what each badge certifies (criteria from the catalog) is shown on the claim page, so the visitor knows what they are getting.

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
| **Stable, immutable `badge_id`** once published | The cookie and the server both refer to it; renaming would orphan unlocks |
| **A public catalog of badges** (`id`, `label`, `criteria`) readable without auth | The chip and offer render names from it; the server validates against it |
| **A flag marking a badge claimable-by-entitlement** (e.g. `claimable: "entitlement"`) | Only exploration badges may be minted from a self-reported cookie |
| **That flag is refused for any badge a certificate, `module-complete` or verified milestone depends on** (validator rule) | Keeps verified attainment unforgeable and certificates untouched |
| **A defined unlock event for entitlement badges** | #520 says viewing earns nothing and credit comes from server-graded checks. Anonymous unlocks cannot use an answer key in the browser (#298 hides quiz answers), so the unlock event must be client-observable (finishing a guided walkthrough, replay or explorer) **or** use a stateless pass/fail check endpoint that stores nothing |
| **Provenance attribute allowed on `BADGE#` items** | §3.3 |

If #520 prefers that exploration badges not exist at all, this funnel has nothing to mint, so that is the first question to settle with the customer.

---

## 7. Consent and privacy

The exposure is lighter than durable progress tracking: one first-party functional cookie holding badge IDs and a day, set by the visitor's own action, containing no identifier, never sent to a tracking tool, expiring in at most 30 days.

### 7.1 What the visitor is told, and when

At the moment of first unlock, before the first write (inline, next to the offer):
> This browser will remember the badges you've unlocked, for up to 30 days, so you can claim them if you register. It doesn't identify you. Clearing cookies removes them. **[OK]** **[Don't remember]**

### 7.2 If storage is declined, or the site's cookie banner says no to functional cookies

The experience works fully. Entitlements are held **in memory for the current page view only**; the chip shows for that view; the visitor can still press Claim, and the handoff marker goes through `sessionStorage` for the duration of the redirect. No push offers are shown. Nothing persists across visits. That is the honest result: the right is temporary and they declined to let the browser keep it.

### 7.3 Legal answers needed (none guessed here)

- **L1 [LEGAL]** Is a cookie remembering badges the visitor just unlocked "strictly necessary" or an equivalent exemption in each jurisdiction we serve? The visitor did not explicitly ask us to save it, which makes the exemption arguable rather than clear.
- **L2 [LEGAL]** Does the notice-and-choice in §7.1 satisfy consent where consent is needed, and must the write wait for the answer (the design assumes it does)?
- **L3 [LEGAL]** How does this relate to the HubSpot cookie banner: does our own prompt duplicate it, or should the site banner's functional-cookie category govern?
- **L4 [LEGAL]** Should Global Privacy Control or Do Not Track change anything, given nothing is shared or used for tracking?
- **L5 [LEGAL]** Is the registration notice and privacy policy enough to cover minting a badge from browser-held data and the resulting account record?
- **L6 [LEGAL]** Is a cookie with `Domain=` shared across product pages and `/learn` acceptable?

**Retention:** unclaimed entitlements expire with the cookie, at most 30 days after unlock. No server-side copy exists. Claimed badges are account data under the account's normal lifecycle. A visible **Forget** control (clears the cookie) sits in the chip menu.

---

## 8. Worked walkthrough

The visitor Sam arrives from a product page on day 0.

| Step | Stored | Shown | Verified |
|---|---|---|---|
| **0. Arrives from a product page** | Nothing | The page looks as expected. No banner, no prompt | Nothing |
| **1. Completes the first guided experience (day 0)** | After the notice and OK (§7.1): `hhl_ent` = `{e:[[fabric-basics,D0]]}` | Inline card: "You've unlocked the Fabric Basics badge. It's yours to claim if you register." Content stays fully usable | Nothing. No request is made |
| **1b. Presses "Not now"** | `d = [D0, 1, 1]` | Card closes. Chip: "1 badge available to claim" | Nothing |
| **2. Completes a second experience (day 0, same session)** | `e` = `[fabric-basics, vlan-basics]` | Chip updates to "2 badges available to claim · until D30 at the latest". **No push**: dismissed today, and +1 < +2 | Nothing |
| **3. Leaves, returns on day 9, same browser** | Cookie unchanged | Chip: "2 badges available" (unlock dates visible). No push on load | Nothing |
| **4. Completes a third experience (day 9)** | `e` = 3 entries; `d` unchanged | Push allowed: new unlock, ≥7 days since dismissal, first push this session. Card: "You've unlocked 3 badges you can claim." Chip shows 3 | Nothing |
| **5. Presses Claim** | `claim intent` in `sessionStorage` | Redirect to Cognito signup (existing flow) | Cognito: email, password, account creation |
| **6. Returns, signed in** | Auth cookies (existing). Entitlement cookie still has 3 | "Adding 3 badges…" | Session valid via `/auth/me` |
| **7. `POST /entitlements/redeem`** | Server: 3 × `BADGE#…` items, each with `source: claim-entitlement`, unlocked day, mint time. Client: cookie entries removed, `sessionStorage` cleared | "3 badges added to your account." Links to the badges page and to the learning paths | Identity: yes. Each badge id in catalog and claimable: yes. Unlocked day plausible and within TTL+3d: yes. That Sam did the experiences: **no, trusted** |
| **8. Double click / reload on step 7** | Nothing new | "Already in your account" | Conditional write rejects repeats |
| **9. Later, a different device (phone)** | Phone: nothing | No chip. Signing in shows the 3 badges from the account. Any new exploration on the phone starts fresh entitlements (a badge Sam holds shows as "already in your account" if redeemed again) | Account badges: server record |

**Variants**
- *Cookie cleared between steps 3 and 5:* chip gone, no entitlements. Nothing was promised, so nothing is reported as lost.
- *Existing account:* Sam signs in via normal login at step 5 instead. On return, the card in §3.4 asks before minting.
- *Expired:* an entitlement 31 days old is dropped on read and not mentioned. Re-doing the experience unlocks it again.
- *Storage declined at step 1:* steps 1–2 work for that page view only; no push; chip and Claim still work within the view; nothing survives leaving.

---

## 9. Feature roadmap

Each increment ships value on its own.

**Increment 1 (smallest useful).** Entitlement cookie and notice; one product-page experience with an unlock event; the chip; one-per-session push with dismissal remembered; `POST /entitlements/redeem` writing `BADGE#` items; the minimal "added to your account" message. This delivers the full loop: unlock → claim → real badge. **Gate:** legal answers L1–L2 and the #520 items in §6.

**Increment 2.** Existing-user confirm card (§3.4); 30-day TTL display and server check; the 7-day / +2 re-offer rules; "Forget" control; badge list on the claim page with criteria; more experiences on more product pages; consent-banner integration (L3).

**Increment 3.** After claim, surface the gamified learning paths and next-step suggestions on the account (the customer's "once claimed, encourage ongoing participation"), bounded by #489.

**Explicitly waits / not built:** Open Badges 3.0 export (#520 §4.5, customer demand); cross-device continuity (out of scope by design); server-side anonymous records; reminders or emails to unregistered visitors; any gating of content; counting unlocks as certificate or `module-complete` progress.

---

## 10. Decisions for the customer / owner

1. Confirm exploration-tier badges exist in #520 (§6), with provenance shown on the learner record or not (§3.3).
2. TTL: fixed 30 days, shown as a plain date (recommended), or cookie lifetime only (§2.3).
3. Confirm product pages and `/learn` hosts, and that Cognito signup completes in a single tab **[unverified]** (§2.2, §3.1).
4. Accept that one cookie value can be redeemed by two accounts (§3.2).
5. Obtain legal answers L1–L6 before Increment 1 ships.
