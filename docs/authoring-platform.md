# Authoring platform: interactive primitives and typed attainment

**Status:** design for review (issue #520). Nothing here is implemented except a read-only validator (`scripts/validate-authoring.mjs`). No HubSpot activity, no schema migration, no change to any shipped module.
**Inputs:** #502 (C0–C6 classes), #495 (authoring research and quality layer), the shipped attainment code (`tasks-status.ts`, `certificate-issuance.ts`, `tasks-quiz-submit.ts`, `src/sync/markdown-to-hubdb.ts`) and `content/modules/*/completion.json`.

**Evidence tags used below:** **[code]** read in this repo; **[design]** my proposal; **[unverified]** not checked, flagged for review.

---

## 1. Summary

1. An author adds an interactive element with **one marker line in the README plus one entry in a new optional `interactives.json`**. The marker is an HTML comment, so today's renderer ignores it and the page degrades to ordinary prose.
2. Attainment becomes typed by adding optional `kind` and `credit` to tasks already in `completion.json`, and an optional `milestones` array whose rules can be met by **more than one combination** of credits.
3. **The zero-infrastructure path is the default.** Four primitives (`snapshot`, `replay`, `explorer`, `predict`) are C0/C1 and run from static files. The validator *rejects* C2–C4 primitives until the capability exists, so no author is blocked on #497 and none can ship something that cannot run.
4. **Backward compatibility is structural, not procedural:** none of the shipped code reads the new keys, and the reserved milestone `module-complete` is defined to be exactly today's completion rule (§5).
5. A validator ships with the schema (§7) and checks references, credit arithmetic and honesty labels.

---

## 2. What exists today, and one correction

- A module is `README.md` + optional `completion.json` + optional `quiz.json` **[code]**.
- Sync reads exactly two keys of `completion.json`, `completion_tasks` and `awards_certificate`, and ignores the rest (`src/sync/markdown-to-hubdb.ts`, around line 187) **[code]**. This is why additive keys are safe.
- Completion is `computeModuleStatus` in `tasks-quiz-submit.ts`: every task with `required: true` must be `passed` (quiz) or `attested` (lab) **[code]**.
- Certificates: `issueCertificateIfComplete` runs only when module status is `complete`, checks the HubDB `awards_certificate` flag (fail-closed), and writes the certificate with a conditional put keyed `USER#<id>` / `CERT#module#<slug>`, so issuance is idempotent **[code]**. I found no revocation path in the files read.

**Correction to G4.** `task_type` is not validated against the JSON, but there *is* a compile-time union at `tasks-quiz-submit.ts:153` (`'quiz' | 'lab_attestation' | 'knowledge_check'`). It never sees `completion.json` at runtime, so the substance of G4 stands. Three further findings sharpen it **[code]**:

- **A typo'd `task_type` can count as satisfied.** In `computeModuleStatus`, only `quiz` and `lab_attestation` can set `allSatisfied = false` once a status exists. A required task with any other `task_type` and any recorded status is silently treated as done.
- **`shadow-aggregation.ts:115` hard-codes `quiz` and `lab_attestation`.** A new task type added in one place and not there will be ignored in aggregation. The validator's enum (§7) lists every place that must change together.
- **`knowledge_check` with `required: true` can never be satisfied** (it is filtered as "not required by default" in a comment, but not in code). The validator makes that an error.

I could not run the validator in this session (the sandbox denied executing it), so I make no claim about what it reports on the 20 live modules. From reading, I expect the legacy layer to pass all of them; the first real run is a review step (§11).

---

## 3. Interactive primitives

### 3.1 Declaration

Two parts, deliberately small:

```markdown
## No lab available? Work the same fault from a recording

<!-- hh:interactive id="replay-vlan-conflict" -->
```

```jsonc
// interactives.json (optional, next to README.md)
{ "interactives": [ {
    "id": "replay-vlan-conflict",
    "type": "replay",
    "caption": "…", "src": "replays/vlan-conflict.json",
    "recorded_at": "2026-11-05",
    "source_label": "recorded",          // mandatory honesty label
    "evidence_plane": "control-plane",   // control-plane | data-plane | none
    "check": { "questions": [ /* same shape as quiz.json */ ] }   // optional; makes it creditable
} ] }
```

Why a sidecar plus a marker rather than a rich fenced block: the sidecar follows the existing `README.md` + JSON convention, answer keys stay out of the markdown (as `quiz.json` already does: it "must NEVER be served to the client", `markdown-to-hubdb.ts`), and the marker is invisible to the renderer that exists today **[design]**.

### 3.2 Catalogue

| Primitive | #502 class | Deployable today | Lease | Author supplies | Renders | Tracked | Cost | Label the UI must show |
|---|---|---|---|---|---|---|---|---|
| `snapshot` | C0 | **yes** | none | `src`, `as_of`, `caption` (image or exported panel) | Cached image/panel with its capture time | nothing | zero | **Cached, as of `<date>`** |
| `replay` | C0 | **yes** | none | `src` (recorded step list), `recorded_at`, `caption` | Step-through of a recorded command/output sequence | step reached (UI state only) | zero | **Recorded `<date>`. Not live.** |
| `explorer` | C1 (fixture form) | **yes** | none | `fixture` (JSON of objects), `fixture_captured_at`, `caption` | Browsable objects from a captured fixture | nothing | zero | **Simulated from a fixture captured `<date>`** |
| `predict` | C0 | **yes** | none | `fixture`, `fixture_captured_at`, `prompt`, a `check` | Commit a prediction, then reveal the fixture | graded answer via `interactive_check` | zero | **Simulated from a fixture** |
| `shell` | C2 | no | session slot | `image`, `ttl_minutes` | Sandboxed shell | — | shared host | Control-plane vs data-plane per step |
| `lab-server` | C3 | no | 1 pool server | `servers`, `fabric_write`, `max_minutes` | Leased server | — | 1 pool server | Both planes, labelled per step |
| `lab-pair` | C4 | no | 2 pool servers | as above | Leased pair | — | 2 pool servers | As C3 |

C5 is documented in #502 as deferred and has no primitive. C6 (dedicated VLAB) is what `lab_attestation` already is: the learner runs it themselves and attests.

**`explorer` is the C1 form that works today.** True C1 is a live read-only view of the shared fabric, which needs the #502 broker. A fixture-backed explorer teaches the same skill (reading objects, following references) with no infrastructure. It is labelled *simulated* and never *live*. When a live read path exists, the same primitive gains `source: "live"`; authors change one field, not their content **[design]**.

**What the learner never gets credit for: viewing.** A `snapshot`, `replay` or `explorer` on its own earns nothing (§6). It only earns credit through a `check` whose answer key the server holds.

### 3.3 Honesty is data, not prose

`source_label` and `evidence_plane` are required fields, and the validator enforces consistency (§7): a `replay` must be `recorded`, a fixture-backed type must be `simulated`, `live` is rejected on anything with no live backend, and a primitive that claims data-plane behaviour with only control-plane evidence fails. Anything mentioning GPU, RDMA or line-rate requires an explicit `disclosure_ack` (#492) **[design]**.

### 3.4 Why most authors never need a lab

An author following #502's decision rule stops at the first "yes": cached (C0), live-read (C1), shell (C2). Three of those four are runnable today as static files. The `lab-server`/`lab-pair` entries exist so the schema is stable when #497 lands, but `validate-authoring.mjs` rejects them without `--allow-unavailable`, so a module cannot ship depending on infrastructure that does not exist.

### 3.5 What must be built for these to render (not in this PR)

A renderer for four types (a small JS component bundle plus a HubL include), a sync step carrying `interactives.json` to HubDB, and a grading path for `interactive_check`. See §9.

---

## 4. Attainment model

### 4.1 Typed credit

Optional additions to a task in `completion.json`:

| Field | Meaning | Default when absent |
|---|---|---|
| `kind` | `read` · `practice` · `lab` · `assessment` · `transfer` | `quiz`→`assessment`, `lab_attestation`→`lab`, `knowledge_check`→`practice` |
| `credit` | positive number: the weight this task contributes when satisfied | `1` |

A task earns its **full credit when it reaches its success status** (`passed`, `attested`, or `checked` for `interactive_check`). There is no partial credit in v1 **[design]**.

**What happens to `quiz.json` points.** They keep their current job: question points roll up to a score, the score is compared with `passing_score`, and the task passes or fails. The task's `credit` is a separate, author-chosen weight. This resolves "points aggregate to nothing": question points aggregate to a *task*, and task credit aggregates to a *milestone*. Two levels, each with one meaning, rather than mixing them **[design]**.

Why `read` exists but may not carry a milestone alone: it records exposure and is allowed, but the validator rejects any milestone satisfiable using only `read`/`practice` credit (§7).

### 4.2 Milestones with multiple paths

```jsonc
"milestones": [
  { "id": "module-complete",
    "label": "Module complete",
    "criteria": "Passed the module assessment and attested the hands-on lab.",
    "certificate": true,
    "rule": { "tasks": ["quiz-1", "lab-main"] } },

  { "id": "diagnosis-practiced",
    "label": "Diagnosis practiced",
    "criteria": "Reached a correct root cause from a recorded session or the hands-on lab, and passed the assessment or a transfer problem.",
    "rule": { "any": [
      { "tasks": ["quiz-1", "lab-main"] },
      { "tasks": ["diagnose-replay", "transfer-unfamiliar"] },
      { "points": 8, "min_by_kind": { "transfer": 4 } }
    ] } }
]
```

A rule is exactly one of:

- `{"tasks": [...]}`: all named tasks satisfied.
- `{"points": N, "kinds": [...], "min_by_kind": {...}}`: total credit of satisfied tasks (optionally restricted to `kinds`) is at least N, and each `min_by_kind` floor is met. **This is the JetBrains-style "different quantities and types of credit reach a common level".**
- `{"any": [rule…]}` / `{"all": [rule…]}`: composition. `any` is "several paths to the same milestone".

That grammar is the whole language: no expressions, no scripting, evaluated by a ~25-line pure function (`evalRule` in the validator is the reference implementation) **[design]**.

### 4.3 Prerequisites and transfer

- **Prerequisites** (G3): `"prerequisites": [{"module": "<slug>", "milestone": "module-complete", "enforce": "advise"}]`. v1 supports **`advise` only**: the UI shows "recommended first" and the validator checks the target milestone exists. Hard gating is rejected for v1: with 20 live modules and learners arriving from search, a block would strand people, and the existing `order`/`pathway_slug` already express sequence. Revisit when a lease-backed primitive makes gating a capacity matter **[design]**.
- **Transfer**: a task of `kind: transfer` is an `interactive_check` on a fault or topology **not shown in the teaching content**, graded against a server-held key. The worked example uses `predict-missing-connection` (a different fault than the lab's VLAN conflict). Deliberately *not* attempted in v1: variant pools to stop answer sharing. Without them, a transfer check is weaker evidence once answers circulate; a pool keyed on a per-learner hash is the straightforward fix and is listed in §9 **[design]**.

### 4.4 Equal paths are not equal evidence

In the example, the replay path reaches `diagnosis-practiced` without a lab, but **not** `module-complete`. A recording and a transfer check on a fixture are *simulated/recorded* evidence of control-plane reasoning; a lab attestation is self-attested but performed on a real fabric. They are different claims, so the certificate path stays the shipped one and the new path earns a milestone (and badge, §6). Whether any zero-lab path should also award the certificate is a **customer decision** (open question 1) **[design]**.

### 4.5 Open Badges 3.0

**Recommendation: shape for it now, issue later.**

- *Now, at no cost:* every milestone has a stable `id`, a `label` and human-readable `criteria`. Those are the fields an Open Badges achievement needs, so nothing must be re-authored later.
- *Later, only on customer demand:* issue each milestone as an Open Badges 3.0 credential.

Trade-off:

| For | Against |
|---|---|
| Portable: the learner can hold it in a wallet or on LinkedIn, which supports the "attainment, not completion" message | Requires signing key custody and rotation |
| Standards-based, avoids a proprietary format | Needs a stable public verification URL for every credential, which is a long-term hosting commitment |
| Maps cleanly onto milestones | Recipient identity (email) in a portable credential is a privacy decision |
| | Revocation and re-issuance on content changes need a policy |

My understanding is that Open Badges 3.0 is a 1EdTech specification built on W3C Verifiable Credentials. **[unverified]**: I did not re-read the current spec this session, so confirm the version and signing requirements before any build **[design]**.

---

## 5. Backward compatibility (explicit)

**Principle:** no shipped code path reads a new key, and one reserved milestone is pinned to today's behaviour.

1. **Existing `completion.json` files are valid unchanged.** The new keys (`kind`, `credit`, `milestones`, `prerequisites`) are optional. The legacy defaults in §4.1 give every shipped task a kind and credit without editing it.
2. **Completion is untouched.** `computeModuleStatus` keeps deciding `complete`. Milestones are *derived* from task statuses on read, and nothing writes a changed completion status. For a module without `milestones`, an implicit `module-complete` equal to "every required task" is synthesized, which is the same rule by construction **[design]**.
3. **`module-complete` is reserved and validator-pinned.** If an author declares it, its rule must be exactly `{"tasks":[every required task]}`; anything else is error `MODULE_COMPLETE_DRIFT`. So the thing a certificate means cannot change by editing a milestone.
4. **Certificates keep their trigger and keys.** `issueCertificateIfComplete` still fires on module status `complete` and the HubDB `awards_certificate` flag. The `CERT#module#<slug>` key and `certId` format do not change, and issuance remains write-once. Milestone badges, if built, use a **new** sort-key prefix (`BADGE#…`) in the same table, so no existing item is touched **[design]**.
5. **New tasks on live modules must be `required: false`.** Adding a *required* task to a module whose learners already completed it would make them incomplete on the next recompute. The validator warns on a required `interactive_check`; reviewers should treat any newly required task in a live module as a breaking change.
6. **Unknown keys are inert at runtime.** Sync reads two keys (§2). The validator warns on unknown top-level keys so typos are caught before they are silently ignored.
7. **Rollback is deleting files.** Removing `interactives.json`, the marker lines and the new keys restores the exact shipped module.

---

## 6. Gamification, bounded

Per #489 it is optional, and the goal is understanding and usefulness, not clicks or dwell. Every mechanic kept below is a *view of the attainment model*, not a separate points economy.

### Kept

| Mechanic | Why it is allowed |
|---|---|
| **Progress toward a milestone**, e.g. "7 of 8 points; finish the transfer problem or the lab" | It shows the learner which evidence is missing. It is a read of §4.2. |
| **Credit visibility**: what each task contributes and what kind it is | Makes the model legible, so learners choose paths knowingly |
| **Path choice display**: "two ways to reach this" | Directly exposes multi-path milestones |
| **Milestone badges** (Open Badges-shaped, §4.5) | Awarded only for evidence-bearing milestones the validator has proven are not exposure-only |
| **Opt-out**: hide gamified surfaces per learner | Gamification is optional by #489 |

### Rejected

| Mechanic | Why rejected |
|---|---|
| **Streaks and daily goals** | Reward showing up, not understanding; punish the learner who studies in bursts |
| **Points for time-on-site, page views, scroll depth, or clicks** | These are exactly the metrics the customer said not to optimise. They also make `read`-only paths look like attainment. |
| **Points per attempt / attempt-count rewards** | Rewards retrying over reasoning; incentivises answer-mining |
| **Public leaderboards** | Rank on speed or volume, and expose learners; also pressure toward gaming the metric |
| **Speed bonuses and timers** | Penalise careful diagnosis, the skill the content teaches |
| **Lives / hearts** | Artificial scarcity with no pedagogical basis for technical troubleshooting |
| **Randomised or loot-style rewards** | Variable-ratio reinforcement rewards compulsion, not competence |
| **Viewing a replay/snapshot earning credit** | Exposure is not understanding. Interactives earn only through a server-graded `check`. |
| **XP that converts across unrelated modules** | Hides which evidence was actually produced; a number that means nothing in particular |

---

## 7. Authoring contract and validator

### 7.1 Files

| File | Status | Contents |
|---|---|---|
| `README.md` | existing | Frontmatter + markdown. New: optional `<!-- hh:interactive id="…" -->` marker lines |
| `completion.json` | existing | `completion_tasks`, `awards_certificate` (unchanged). New optional: task `kind`/`credit`/`interactive_ref`, `milestones`, `prerequisites` |
| `quiz.json` | existing | Unchanged |
| `interactives.json` | **new, optional** | Interactive declarations and their `check` blocks |
| assets (`replays/`, `fixtures/`, images) | new, optional | Referenced by relative path |

### 7.2 The validator

`node scripts/validate-authoring.mjs` (also `npm run validate:authoring`). Read-only; exit 1 on any error. Flags: `--module SLUG`, `--modules-dir DIR`, `--strict`, `--allow-unavailable`, `--json`.

| Layer | Checks |
|---|---|
| **Legacy** (all 20 modules today) | README frontmatter required keys and slug = directory; `task_type` in the closed enum (**G4**); unique kebab-case `task_slug`; boolean `required`/`graded`/`awards_certificate`; `knowledge_check` not required; quiz task has `quiz.json`, `quiz_ref` = `quiz_id`, task `passing_score` = quiz `passing_score`; question ids unique, `correct_answer` is an option id, positive `points`; unknown top-level keys |
| **Reference integrity** | marker ↔ `interactives.json` agree both ways; `interactive_ref` targets exist and have a `check`; asset paths exist; milestone rules reference real tasks; prerequisite module and milestone exist |
| **Credit arithmetic** | each milestone is satisfiable with everything earned; each `any` branch is individually reachable; milestone not satisfiable by `read`/`practice` alone; `module-complete` pinned (§5); orphan credits (non-required, unreferenced) warned |
| **Honesty** | `source_label` and `evidence_plane` present and consistent with the type; `live` rejected where no backend exists; data-plane claims need data-plane evidence; GPU/RDMA/line-rate need `disclosure_ack`; unavailable classes rejected without a flag |

### 7.3 Where the enum must also change

The validator holds the closed vocabularies in one block at the top of the file. A new `task_type` must also change, in the same PR **[code]**: `CompletionTask` in `tasks-quiz-submit.ts:153`, `computeModuleStatus` there, the `quiz`/`lab_attestation` filter at `shadow-aggregation.ts:115`, and the write endpoint that records the status. Making the Lambdas import the enum from `src/shared/` instead of redeclaring it is the real fix for G4's drift; it is runtime work and out of scope here **[design]**.

### 7.4 Not wired in

I did not add the validator to CI (I cannot modify workflows) or to sync. Recommended next step: run it in sync as a hard gate once the first real run is clean (§11).

---

## 8. Worked example: `fabric-operations-diagnosis-lab`

Copyable files are in [`docs/examples/authoring-platform/modules/fabric-operations-diagnosis-lab/`](examples/authoring-platform/modules/fabric-operations-diagnosis-lab/). Run it with:

```bash
node scripts/validate-authoring.mjs --modules-dir docs/examples/authoring-platform/modules
```

(Not executed in this session; see §2.)

**Starting point (live today):** a quiz (`quiz-1`, 12 questions, pass at 75) and a lab attestation (`lab-main`), both required, certificate awarded. It is the lab that needs a learner-provisioned vAIDC.

**What the author changes**

1. **README:** add two headings and two marker lines (see the example's `README.md`). Bump `version` to `v1.1.0`.
2. **`interactives.json` (new):** a `replay` and a `predict`, each with a one-question `check`.
3. **`completion.json`:** add `kind`/`credit` to the two existing tasks (optional; defaults would apply), add two **non-required** `interactive_check` tasks, add two milestones and one advisory prerequisite.
4. **Assets:** `replays/vlan-conflict.json` and `fixtures/missing-connection.json`. Their contents in this example are *illustrative*, derived from the lab text rather than captured, and say so in a `_note` field. A shipped replay must be captured from a real session.

**What the learner experiences**

| Learner | Does | Gets |
|---|---|---|
| Has a vAIDC | Quiz + lab (exactly as today) | `module-complete` → **certificate unchanged**; also `diagnosis-practiced` |
| No lab available | Replay check + transfer problem | `diagnosis-practiced` (**no certificate**); progress shows "lab or quiz still needed for the certificate" |
| Anyone | Only watches the replay | Nothing; viewing is not credited |

**Credit arithmetic of the example:** quiz 4 (`assessment`) + lab 6 (`lab`) + replay check 3 (`assessment`) + transfer 4 (`transfer`) = 17 total. `diagnosis-practiced` can be reached by quiz+lab, by replay+transfer, or by any 8 points including at least 4 of `transfer` credit. Each branch is checked for reachability by the validator, and a branch of only `read`/`practice` credit would be rejected.

**Compatibility check for this module:** `module-complete` equals `{"tasks":["quiz-1","lab-main"]}`, which is today's rule; both new tasks are `required: false`; existing certificates are untouched (§5).

---

## 9. Data-model change versus genuinely new build

| Item | Over #385/#397 infrastructure | Notes |
|---|---|---|
| Task `kind`/`credit`, `milestones`, `prerequisites` in `completion.json` | **Data-model change** (additive JSON) | Sync today forwards only two keys, so carrying milestones needs a sync change and a **new HubDB column** (e.g. `milestones_json`). HubDB schema change: deferred, not done here |
| Milestone status | **Derived, no new DynamoDB attribute** | Computed from `task_statuses` already stored by the write endpoints (`tasks-status.ts` reads that map) |
| `interactive_check` task type | **Small extension** | Grading can reuse the existing pure quiz grading function; needs the answer key stored server-side (same rule as `quiz.json`), so likely a new HubDB column or folding keys into the existing quiz schema column |
| Milestone evaluator | **New, small** | Pure function; `evalRule` is the reference |
| Interactive renderer (`snapshot`, `replay`, `explorer`, `predict`) | **Genuinely new build** | JS component + HubL include; must honour the label fields |
| `interactives.json` sync | New | Strip answer keys from the client payload |
| Progress UI (progress to milestone, credit visibility) | New | Reads derived milestone state |
| Milestone badges | New | `BADGE#` items in the existing certificates table |
| Open Badges issuance | New, deferred | §4.5 |
| Variant pools for transfer checks | New, deferred | §4.3 |
| `shell`, `lab-server`, `lab-pair` | Blocked on #497 and the #502 broker | Schema reserved; validator rejects until available |
| Validator | **Done in this PR** | Read-only |

**Suggested order, each step useful on its own** **[design]**: (1) run and fix the validator against live content, then gate sync on it; (2) lift the enum into `src/shared/` and share it with the Lambdas; (3) milestone evaluator plus progress UI over *existing* tasks, which gives live modules typed credit with zero content change; (4) the four zero-infrastructure renderers and `interactive_check`; (5) badges. Steps 1–3 deliver value before any interactive renderer exists.

---

## 10. Occam's razor check

An author's first interactive element: one marker line, one entry in `interactives.json` (6–8 fields), and optionally one task and one `check`. No new tool, no build step, no lab. Credit and milestones are optional: a module with none behaves as it does today. The most complex thing an author may write is a three-line `any` rule, and the validator tells them if it is wrong.

What I cut to stay small: partial credit, expressions in rules, hard gating, per-learner variant pools, a separate badge schema.

---

## 11. Open questions for review

1. **Certificate equivalence:** should any zero-lab path award the same certificate as the lab path? I recommend no (badge only), because the evidence differs (§4.4).
2. **Who may declare `credit`?** It is author-chosen and unconstrained apart from positive. Is a review rule needed for relative weights?
3. **First validator run:** I could not execute it. Please run `node scripts/validate-authoring.mjs` and `--modules-dir docs/examples/authoring-platform/modules`. Anything it flags is either a real drift or a validator bug, and I want to know which.
4. **Marker syntax:** an HTML comment is safe today. Is a visible/`:::` directive preferable once the renderer exists?
5. **Transfer integrity:** are transfer checks without variant pools acceptable for a first release?
6. **Open Badges:** is portability wanted now, or is the stable-id groundwork enough?
7. **`interactive_check` answer storage:** new HubDB column versus folding into `quiz_schema_json`.
