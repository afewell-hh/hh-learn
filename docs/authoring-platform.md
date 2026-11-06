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
6. **Look and feel is specified per primitive (§3.6)**, including where the current CMS templates would hold it back.
7. **Credit has two independent axes (§4.1):** *kind* (what the learner did: explore, practice, lab, assessment, transfer) and *evidence* (how strongly we know: observed, attested, checked). An exploration badge is honest about being browser-observed and never borrows assessment vocabulary to qualify.
8. **#521 gets an explicit interface (§4.6–§4.8):** one vocabulary, the minted-badge record as **the** contract (§4.7), and a decision on pre-account evaluation: v1 milestones must be fully evaluable within one page view (§4.8).
9. **A first-class `compare` primitive (§3.7)** for the recurring "old way vs Hedgehog way" pattern, with derived counts, a no-straw-man rule set and stated equivalence.

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
    // optional, and at most one of these two makes it creditable:
    "check": { "questions": [ /* same shape as quiz.json */ ] },   // key-checked  -> "checked" evidence
    "completes_on": "all_steps"                                     // browser-seen  -> "observed" evidence
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
| `compare` | C0 | **yes** | none | `left`, `right` (each a captured text with provenance), `equivalence`, `caption`; optional `steps` | Two synchronised panes with derived counts (§3.7) | step reached (UI state only); optional finish event | zero | **Captured `<system> <version>`, `<date>`**, or **Illustrative** if either side is |
| `shell` | C2 | no | session slot | `image`, `ttl_minutes` | Sandboxed shell | — | shared host | Control-plane vs data-plane per step |
| `lab-server` | C3 | no | 1 pool server | `servers` (each `{ "role": … }`, open set), `fabric_write`, `max_minutes` | Leased server | — | 1 pool server | Both planes, labelled per step |
| `lab-pair` | C4 | no | 2 pool servers | as above | Leased pair | — | 2 pool servers | As C3 |

C5 is documented in #502 as deferred and has no primitive. C6 (dedicated VLAB) is what `lab_attestation` already is: the learner runs it themselves and attests.

**`explorer` is the C1 form that works today.** True C1 is a live read-only view of the shared fabric, which needs the #502 broker. A fixture-backed explorer teaches the same skill (reading objects, following references) with no infrastructure. It is labelled *simulated* and never *live*. When a live read path exists, the same primitive gains `source: "live"`; authors change one field, not their content **[design]**.

**Endpoint roles are an open set.** `servers` entries name a `role` (`gpu-host`, `compute-host`, and the customer's *compute server that supports server-side agentic delivery*, provisionally `compute-agentic-host`). The validator accepts any kebab-case role and only warns on one outside the known list, so a new server role in #497/#500 needs no schema change. Whether vAIF can lease that role is #497's decision, not this document's.

**What the learner never gets credit for: viewing.** A `snapshot`, `replay`, `explorer` or `compare` on its own earns nothing (§6). Credit comes only from one of two declared events (§4.1): a `check` whose answer key the server holds (**checked** evidence), or a `completes_on` finish event that is more than looking (**observed** evidence). `view`, `scroll`, `click`, `dwell` and `time` are rejected by name as finish events.

### 3.3 Honesty is data, not prose

`source_label` and `evidence_plane` are required fields, and the validator enforces consistency (§7): a `replay` must be `recorded`, a fixture-backed type must be `simulated`, `live` is rejected on anything with no live backend, and a primitive that claims data-plane behaviour with only control-plane evidence fails. Anything mentioning GPU, RDMA or line-rate requires an explicit `disclosure_ack` (#492) **[design]**.

### 3.4 Why most authors never need a lab

An author following #502's decision rule stops at the first "yes": cached (C0), live-read (C1), shell (C2). Three of those four are runnable today as static files. The `lab-server`/`lab-pair` entries exist so the schema is stable when #497 lands, but `validate-authoring.mjs` rejects them without `--allow-unavailable`, so a module cannot ship depending on infrastructure that does not exist.

### 3.5 What must be built for these to render (not in this PR)

A renderer for five types (a small JS component bundle plus a HubL include), a sync step carrying `interactives.json` to HubDB, and a grading path for `interactive_check`. See §9.

### 3.6 Look and feel (a requirement, not a preference)

The customer bar: a rich, modern, elegantly styled toolkit, *not* a clunky university LMS. Below, per primitive, is what it should look and feel like. These are **[design]** descriptions to hold the renderer to, not mockups.

**Shared principles for every primitive**
- **Content is the interface.** Primitives are full-width cards inside the reading column with generous whitespace, one accent colour, a restrained type scale, and no chrome (no borders-in-borders, no gradients-as-decoration, no stock iconography).
- **Motion that explains.** Transitions of 120–200 ms that show cause and effect (a step advancing, a reveal). Respect `prefers-reduced-motion`; nothing animates on its own.
- **The honesty label is a design element, not a footnote.** A small, consistent pill in the card's top-left ("Recorded 5 Nov 2026", "Simulated from a fixture", "Cached, as of …") in the same place on every primitive, readable at a glance, never hidden behind a tooltip. The label is also the one place the HSX principle shows: the more faithful the emulation, the more important it is that the pill is unmistakable.
- **Keyboard first, accessible by default**: full keyboard operation, visible focus, WCAG AA contrast, screen-reader text for every state change. Light and dark themes from the same tokens.
- **Fast.** No framework payload for a static card; a primitive that is not on the page costs nothing.

| Primitive | Looks and feels like |
|---|---|
| `snapshot` | A crisp captured panel with a soft frame, the capture time in the label pill, and click-to-zoom. Reads as a screenshot someone cared about, not an attachment. |
| `replay` | A terminal-style player: monospaced command/output on a dark surface with a slim step scrubber (previous / next, keys ←/→, step N of M). Output reveals line by line over a moment, with a "skip to end" control. Closer to a clean code-walkthrough than a video player. |
| `explorer` | A two-pane object browser: a searchable list on the left, a detail view on the right with linked references you can follow, and a breadcrumb trail. It feels like the real fabric UI's read-only cousin, not a table dump. |
| `predict` | A calm three-beat card: the question, a commit control ("Lock in my answer"), then a reveal that shows the fixture evidence with the relevant lines highlighted and a short explanation. The reveal is the reward; there is no confetti. |
| `compare` | Two panes of equal weight under a slim count strip, scrolling in step. Each pane carries its own provenance pill; the strip shows derived counts (lines, devices, objects) with an "excerpt" flag where applicable. Differences are shown by emphasis, not red/green shaming, and the equivalence statement sits between the panes and the strip, never in a footnote. Below ~900 px the panes stack. Needs the wide-block layout (below). |
| `shell`, `lab-server`, `lab-pair` | A full terminal pane with a step rail beside it, a persistent per-step plane indicator (control-plane / data-plane), and a quiet lease-time readout. Unavailable until #497, so this is a target, not a promise. |

**The fidelity bar for lab-backed primitives.** The customer's reference is the Hollywood Stock Exchange: *so good you wouldn't know it's not real if you didn't know.* HSX is excellent because of the **thoroughness of its emulation**, not because it conceals anything; every player knows it is not real money. We adopt the same split: **maximum fidelity, unambiguous labelling.** Fidelity work (realistic prompts, realistic latency of output, realistic object relationships) is encouraged. The label rules in §3.3 do not loosen with fidelity; they tighten, because a convincing emulation is exactly where a reader could mistake simulation for live. A vAIF-backed primitive therefore shows "Hedgehog Virtual AI Factory (vAIF): a virtual environment" and, per step, the plane the evidence comes from; no GPU, RDMA or line-rate claim is made (#492).

**Where the existing CMS templates would hold this back [code].** Said plainly:
1. **No shared design tokens.** `clean-x-hedgehog-templates` has no `:root` custom properties; each template carries its own inline `<style>` (`module-page.html` embeds its CSS inside a ~1,270-line file) and the four files in `assets/css/` are page-specific. There is no common colour, spacing or type scale for a primitive to inherit, so a primitive would either hard-code values or look foreign.
2. **Module body is injected as `|safe` HTML into `.module-content`** (`module-page.html`, `dynamic_page_hubdb_row.full_content|safe`), styled by descendant rules there (for example `.module-content code` uses `Courier New`, `pre` has fixed styling). Primitives rendered inside it inherit those rules and must defend against them.
3. **The reading column is a fixed layout** in that template, so a full-bleed explorer or a wide terminal pane needs a layout affordance the template does not have.
4. **No component or build pipeline** for the templates: JS is loaded as individual `defer` files. A modern, stateful widget (explorer, replay) is workable as a dependency-free bundle, but anything needing a framework build is new tooling.

**What this implies [design]:**
- Ship the primitives behind **one new stylesheet** (`assets/css/interactive.css`) defining design tokens (colour, radius, spacing, type, light/dark) under a `.hh-ix` namespace, so primitives are styled independently of the legacy template CSS. The tokens are then available for the template refresh to adopt later; this PR does not touch templates.
- Render each primitive into a **scoped container** (`.hh-ix`) with its own resets, ideally via a shadow root or equivalent isolation for the explorer and player, so `.module-content` rules cannot leak in.
- Add a **wide-block layout option** to `module-page.html` for explorer/terminal primitives (a template change, listed in §9).
- Be honest about the limit: primitives can feel modern *inside their card* with the above, but the page around them (header, left-nav, typography of the prose) will still read as the current template until it adopts the same tokens. That page-level refresh is a separate piece of work and the customer should know the primitives alone do not deliver the whole feel.
- The bar is checked by review of a rendered build, not by the validator. **I have not built or screenshotted any primitive**; the descriptions above are the acceptance target.

### 3.7 The `compare` primitive: old way vs Hedgehog way

**Why a primitive.** Curriculum feedback on #524: "show how someone would configure something the old way vs the Hedgehog way". The customer's generalisation is that SONiC configuration is categorically representative of manual NOS configuration whatever the NOS, so the pattern recurs across nearly every capability (add a tenant, segment workloads, attach a server, validate the result). Every author rebuilding it would drift, and the first inflated "old way" would damage the whole programme. It is the vehicle for a "SONiC the hard way / SONiC the easy way" campaign modelled on *Kubernetes the Hard Way*, which only works if the hard way is genuinely hard and complete.

**Class C0, runs today.** Two captured text files, no lease, no backend.

```jsonc
{ "id": "tenant-old-vs-new", "type": "compare",
  "caption": "Add a tenant: per-switch SONiC configuration vs one VPC object.",
  "source_label": "captured",            // weakest side wins: "illustrative" if either side is
  "evidence_plane": "control-plane",     // configuration is control-plane evidence, never data-plane
  "left": {
    "role": "old_way", "label": "SONiC, configured by hand",
    "provenance": "captured",
    "captured_from": { "system": "SONiC", "version": "<release>", "date": "<YYYY-MM-DD>" },
    "src": "captures/tenant-sonic.txt",  // "# @device leaf-01" lines mark per-device sections
    "devices": ["leaf-01", "leaf-02", "spine-01"],
    "baseline": "Manual per-device CLI; no automation or templating",
    "completeness": "complete",          // complete | excerpt (excerpt requires "omitted")
    "representative_basis": "Reproduces the steps in the vendor's own VLAN/VRF/BGP configuration guide for this topology."
  },
  "right": {
    "role": "hedgehog_way", "label": "Hedgehog, one VPC",
    "provenance": "captured",
    "captured_from": { "system": "Hedgehog Fabric", "version": "<release>", "date": "<YYYY-MM-DD>" },
    "src": "captures/tenant-vpc.yaml", "devices": []
  },
  "equivalence": {
    "status": "same",                    // same | differs
    "outcome": "Two workloads in separate tenants, each reachable only within its tenant.",
    "difference": null                   // required when status is "differs"
  },
  "steps": [ { "id": "s1", "title": "Create the tenant", "left": [1, 40], "right": [1, 12] } ],
  "hard_way": false                      // true = part of a hard-way campaign; see rules below
}
```

(The values in angle brackets are placeholders; **no captured SONiC or Hedgehog file exists in this repo**, so there is no shipped instance of this primitive yet, and I have not invented one.)

**What is tracked.** Nothing by default. An author may add a `completes_on: "all_steps"` (`observed` evidence: the learner stepped through every synchronised step) or a `check` (a key-checked question such as "how many devices did the old way touch?" asked before the counts are revealed). Opening the panes earns nothing.

**The no-straw-man rules, made mechanical.**

1. **Counts are derived, never authored.** The renderer and validator count non-blank, non-comment lines from the source files and devices from the `# @device` markers. An authored `counts` key is an error (`COMPARE_COUNTS_AUTHORED`), so a number cannot be inflated by editing metadata. A device count that does not match the markers is an error.
2. **Provenance on each side.** `captured` needs system, version and date. `illustrative` needs an `illustrative_reason`, and the pane is labelled **Illustrative**. The primitive's own label is the weaker of the two.
3. **The old-way side states its fairness.** `baseline` (for example "manual per-device CLI, no automation": a reader who would automate it can see what is being compared), `completeness`, and a `representative_basis` of at least a sentence saying why this is how the task is genuinely done. An excerpt must say what was omitted and its counts are shown as "excerpt". A reviewer, not the validator, decides whether the basis is true; the validator ensures it is stated.
4. **Equivalence is stated or the gap is disclosed.** `equivalence.outcome` says what both sides achieve; `status: "differs"` requires `difference`. The panes must not be presented as equal when they are not.
5. **`hard_way: true` is the strictest case.** It requires a captured, complete old-way side; an excerpted or illustrative hard way is refused (`COMPARE_HARD_WAY`), because a hard-way campaign that omits the hard part is exactly the straw man.
6. **What the counts do not say.** Fewer lines authored is not a claim about performance, correctness or operating cost. Where the right-hand side relies on a controller generating switch configuration, the primitive shows "authored" and "generated" counts separately so the learner sees what was done for them. No GPU, RDMA or line-rate claim is made (#492).

**Validator coverage (not run).** Roles, provenance, `captured_from`, baseline, completeness, omitted, representative basis, equivalence and difference, `hard_way`, authored counts, device markers, step ranges inside the files, and the label-equals-weakest-side rule. Not covered: whether the old way is *actually* representative, and whether the two sides really are equivalent. Those need a human reviewer and, ideally, a captured outcome for each side.

---

## 4. Attainment model

### 4.1 Typed credit: two independent axes

An earlier revision of this document let one field, `kind`, carry both *what the learner did* and *how strongly we know they did it*. That forced an honest exploration task to be labelled `assessment` or `transfer` just to qualify for a milestone, so an exploration badge's criteria implied assessment. They are separate questions and are now separate fields.

Optional additions to a task in `completion.json`:

| Field | Axis | Values | Default when absent |
|---|---|---|---|
| `kind` | **Activity**: what the learner did | `explore` · `practice` · `lab` · `assessment` · `transfer` | `quiz`→`assessment`, `lab_attestation`→`lab`, `knowledge_check`→`practice`; `interactive_check`→`explore` if observed, `practice` if checked |
| `evidence` | **Evidence strength**: how we know | `observed` · `attested` · `checked` | `quiz`→`checked`, `lab_attestation`→`attested`, `knowledge_check`→`checked`; `interactive_check` is derived from its interactive (below) |
| `credit` | Weight when satisfied | positive number | `1` |

The `read` kind of the first revision is removed: reading has no finish event that is more than viewing, and viewing earns nothing (§6).

**Evidence tiers**, weakest to strongest, defined by *who could be wrong or lying*:

| Tier | Meaning | Who holds the truth | Needs an account | Example |
|---|---|---|---|---|
| `observed` | The browser saw a finish event (every step of a walkthrough reached; every required object opened). No answer key exists and nothing is sent. | Nobody; it is self-reported by the page | **No** | `explorer` with `objects_visited` |
| `attested` | The learner states they did it; the server records the statement | The learner | Yes | `lab_attestation` (as shipped) |
| `checked` | The server grades an answer against a key it holds | The server | Yes | `quiz` (as shipped), a `predict` check |

For `interactive_check` the tier is derived from the interactive, not chosen: an interactive with a `check` yields `checked`; one with a `completes_on` yields `observed`; both or neither is an error. Authors may write `evidence` for clarity; a disagreement with the derivation is an error.

**Which (kind, evidence) pairs are permitted, and why.**

| kind ↓ / evidence → | observed | attested | checked |
|---|---|---|---|
| `explore` | **yes** (the exploration badge case) | no: nothing to attest | yes (a question about what was seen) |
| `practice` | yes | yes | yes |
| `lab` | **no**: a browser cannot observe a lab being done | yes (shipped behaviour) | yes (future automated lab check) |
| `assessment` | **no** | **no** | **yes**: the word claims something was graded |
| `transfer` | **no** | **no** | **yes**: a correctness claim on an unfamiliar problem needs a key |

Each refusal is a statement about what the word promises. `assessment` and `transfer` imply someone checked an answer, so they cannot rest on a page's own say-so; `lab` implies work on an environment, which a browser cannot see. Everything else is allowed, including the combination the first revision effectively forbade: an `explore` task on `observed` evidence. The validator reports a refused pair as `KIND_EVIDENCE`.

A task earns its **full credit when it reaches its success status** (`passed`, `attested`, or `checked` for `interactive_check`; for observed tasks, the finish event). There is no partial credit in v1 **[design]**.

**What happens to `quiz.json` points.** They keep their current job: question points roll up to a score, the score is compared with `passing_score`, and the task passes or fails. The task's `credit` is a separate, author-chosen weight. This resolves "points aggregate to nothing": question points aggregate to a *task*, and task credit aggregates to a *milestone*. Two levels, each with one meaning, rather than mixing them **[design]**.

**Milestone basis (replaces the first revision's "no exposure-only milestone" rule).** Instead of forbidding weak-evidence milestones, the validator computes each milestone's **basis**: the weakest evidence tier among the inclusion-minimal sets of tasks that satisfy its rule (`milestoneBasis`). A milestone with any observed-only path has basis `observed`, however strong its other paths are. Then:

| Basis | Allowed? | Constraints |
|---|---|---|
| `observed` | **Yes: an exploration milestone** | Label and criteria may not use grading vocabulary (`passed`, `assessed`, `graded`, `certified`, `mastered`, `demonstrated`, `attested`, `verified`, `proficient`, `score`, `exam`…): error `BASIS_VOCABULARY`. May not set `certificate: true` (`BASIS_CERTIFICATE`). May be `claimable` (§4.6) |
| `attested` | Yes | May carry a certificate (the shipped lab path) |
| `checked` | Yes | May carry a certificate |

The learner-facing surfaces show the basis as a plain phrase, and the minted badge records it (§4.7): *"Basis: observed in your browser"*, *"Basis: self-attested lab"*, *"Basis: answers checked"*. The badge is honest about what it rests on and does not need to borrow any other word to exist. A mixed `any` rule is judged by its weakest path, so adding an observed shortcut to an assessed milestone changes it to an observed milestone and the vocabulary rule then bites; a `points` branch that should not admit observed credit says so with `kinds` (the worked example does this).

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

### 4.6 The interface #521 needs (one vocabulary, two surfaces)

#521 (`docs/claim-entitlement-funnel.md`, PR #523) was corrected by the customer after the addendum that asked this question: **a badge cannot exist without a user, and an anonymous visitor holds only a temporary, browser-bound *claim entitlement*; registering *mints* the badge.** That changes the hard question from "how do credits that arrived before an account get evaluated?" to "what must a milestone be so the *browser* can decide an entitlement exists, and the *server* can mint the badge later without trusting more than it should?" I answer both, and say where this departs from the literal wording of the addendum.

**What a credit is.** A credit is a satisfied task: the pair `(module_slug, task_slug)` in the `satisfied` state. Its properties (`kind`, `credit`) come from the task *definition*, not from the stored record. Today the stored form is the entry in `task_statuses` **[code]**; no new record type is needed. One vocabulary serves both surfaces: a click-through explorer check and a graded lab are both tasks with a `kind` and a `credit`; they differ in those two fields and in an evidence tier (below), not in type.

**What identifies it.** `(module_slug, task_slug)`. Milestones are identified by `(module_slug, milestone_id)`, and the **badge id #521 stores in the cookie is the string `<module_slug>.<milestone_id>`**, immutable once published (changing a milestone's meaning means a new id).

**What makes two credits the same.** Same `(module_slug, task_slug)`. Satisfaction is monotonic and idempotent *within one learner record*: earning it twice, or on two devices while signed in to the same account, is one credit. This sameness rule applies only to credits stored in `task_statuses`. An anonymous, browser-observed completion is **not** a credit in this sense: it is never stored server-side and never merges into, seeds, or is counted with an account's credits (see "Why the cookie carries the result" below and §4.7). A learner who completes the same task anonymously and later while signed in has an entitlement outcome from the first and a credit from the second, and the two are unrelated records. A badge is likewise unique per `(user, badge_id)`, which is exactly the conditional write #521 §3.2 specifies. Re-weighting a task changes derived milestone status for future evaluation; **a minted badge is frozen** with the `module_version` it was minted under, so later edits never revoke or rewrite it.

**Evidence, not kind, decides who can be evaluated without an account.** The tiers are defined in §4.1. `observed` credit needs no account and no key; `attested` and `checked` credit need a signed-in learner. That is a property of the *evidence*, so a pre-account milestone is selected by evidence and says nothing about kind: an exploration milestone is a perfectly ordinary `explore`/`observed` task, with no assessment word attached.

**What a milestone needs so it can be evaluated before an account exists.** Six conditions; a milestone that meets them may be marked `"claimable": "entitlement"`:
1. **A stable public definition**: `id`, `label`, `criteria`, rule and basis, served without authentication (the chip and offer render from it, and the server validates against it). Answer keys are never part of it.
2. **A rule over `observed` tasks only**, and only the `{"tasks": [...]}` form. The browser then evaluates it with the same pure function the server uses (`evalRule`), shipped as a few lines of JS. A `points` rule is rejected for claimable milestones in v1 (§4.8).
3. **No dependency of verified attainment on it**: not `module-complete`, not `certificate: true`, and no `attested` or `checked` task in the rule. A forged cookie can then mint, at worst, an exploration badge. This is the rule #521 §6 asks for.
4. **Re-readable at claim time**: the server re-reads the catalog entry at redemption, so a milestone that was retired or is no longer claimable is rejected, not minted.
5. **A defined unlock event**: the finish of the observed task (`completes_on`). For a stateless variant, a check endpoint may return pass/fail and store nothing (the option #521 §6 leaves open); I recommend the browser-only form first because it adds no server surface.
6. **Evaluable within one page view**: every task is an `interactive_check` whose interactive is placed on this module's page, and the milestone has at most three tasks. This is the decision in §4.8.

**Why the cookie carries the result, not the credits.** The customer's correction removes anonymous credit storage. The cookie holds `[badge_id, unlocked_day]` pairs (#521 §2.1), the *outcome* of a browser-side evaluation, not the task credits underneath it. So no anonymous credit is "transferred" into the learner record, because none ever existed server-side. The mint creates a `BADGE#` item whose full shape is the contract in §4.7.

**Where this departs from the addendum's literal wording, plainly.** The addendum asked that an anonymous click-through credit and a graded-lab credit be "the same kind of object" so that "claim what you earned" resolves into the learner record. With the corrected #521 model they are the same *vocabulary* (task, kind, evidence, credit, milestone, evaluator, badge id) but **they do not become the same *record***: the anonymous side ends at an entitlement for a badge, and the account side starts from a minted badge whose `basis` and `source` say it rests on observed evidence. I think that is correct, because it keeps `observed` evidence from ever counting toward a certificate or a `points` milestone. If the customer wants more than that, there is a larger option:

- **Option B, now named as the next increment (§4.8): carry the task evidence.** It is how a milestone spanning page views or visits becomes evaluable, and §4.8 specifies its minimum shape so #521 can leave room for it.

**What the validator enforces for this** (`scripts/validate-authoring.mjs`, written but not run, see §2): a milestone with `claimable` must not be `module-complete`, must not set `certificate: true`, must use the `{"tasks": [...]}` form, may reference only `interactive_check` tasks that are not required, have `observed` evidence, and whose interactives are placed in this module's README (warning above three tasks). Every `observed` task must have a `completes_on` that is a real finish for its primitive; `view`, `scroll`, `click`, `dwell` and `time` are rejected by name (`VIEW_NOT_CREDIT`). Not checked: that the renderer actually fires the finish event; that needs the renderer's event contract.

### 4.7 The minted-badge record: **the** contract for #521

This section is normative. #521 should adopt it verbatim; where `docs/claim-entitlement-funnel.md` §3.2–§3.3 differs (it records only source, unlock day and mint time, and does not name the identifier), this section governs. The principle: **the record must identify the definition that was actually awarded, not just when it was awarded.**

**Identifier.** `badge_id = "<module_slug>.<milestone_id>"`, for example `fabric-operations-diagnosis-lab.fabric-explored`. Lowercase kebab-case segments joined by one dot (neither segment can contain a dot). It is the cookie value, the catalog key and the sort-key suffix. It is **immutable once published**: changing what a milestone means requires a new `milestone_id`; renaming or retiring never reuses an id.

**Item.** One item per `(user, badge_id)` in the existing certificates table, written with `attribute_not_exists(PK) AND attribute_not_exists(SK)` so it is write-once (the pattern `certificate-issuance.ts` already uses):

| Attribute | Value | Notes |
|---|---|---|
| `PK` | `USER#<userId>` | As certificates |
| `SK` | `BADGE#<badge_id>` | New prefix; no existing item is touched |
| `badge_id` | `<module_slug>.<milestone_id>` | Redundant with `SK`, kept for queries |
| `module_slug`, `milestone_id` | strings | |
| `module_version` | the module's frontmatter `version` **at mint time** | Frozen. Later edits never rewrite it |
| `definition_hash` | `sha256` of the canonical JSON of `{label, criteria, rule, basis, kinds_and_credits_of_referenced_tasks}` as served in the public catalog at mint time | Identifies the definition actually awarded |
| `definition` | snapshot `{label, criteria, basis}` | So the learner record renders without the catalog, and can never silently change |
| `basis` | `observed` · `attested` · `checked` | The milestone's basis (§4.1). A conservative statement: the learner may have taken a stronger path |
| `source` | `task-evidence` · `claim-entitlement` | How it was minted: evaluated from the learner's recorded tasks, or redeemed from an entitlement |
| `unlocked_day` | days since epoch | Present only when `source` is `claim-entitlement` |
| `minted_at` | ISO-8601 UTC | |

**Rules.**
1. **Only `observed`-basis milestones may be minted from `claim-entitlement`.** `attested` and `checked` badges are minted only from `source: "task-evidence"`, by the server, from recorded task statuses.
2. **No entitlement is ever evidence for a certificate, `module-complete` or a `points` rule.** A `BADGE#` item is never read by `computeModuleStatus` or `issueCertificateIfComplete`.
3. **Redemption awards the definition current at redemption.** The cookie carries only the id and day, so the server cannot know which definition was on the page when the visitor unlocked it. It mints the current published definition, records its `module_version` and `definition_hash`, and rejects the id if the milestone is retired or no longer claimable. Because meaning changes require a new id (above), "current definition of this id" is the same meaning the visitor saw, up to wording; the hash makes any wording change visible.
4. **A minted badge is frozen.** Neither a content edit nor a re-weighting rewrites or revokes it. A genuinely wrong badge is withdrawn by an explicit, logged operation that sets a `revoked_at`, not by recomputation.
5. **Satisfaction is monotonic and idempotent.** A repeat mint for the same `(user, badge_id)` is a no-op (`already_held`).

Credits themselves keep the identity from the start of this section: `(module_slug, task_slug)`, with `kind` and `credit` read from the task definition, never from the stored record.

### 4.8 Decision: how a milestone is evaluated before an account exists

The reviewer's formulation: *minting a badge need not import credits into the account, but evaluating its eligibility still needs the inputs.* #521 stores only badge outcomes. So a milestone that needs two experiences cannot be evaluated across a page change or a return visit unless something carries the first experience forward. Two options:

- **(a)** v1 claimable milestones must be fully evaluable within a single page view.
- **(b)** Define a temporary task-evidence record that #521 persists.

**Decision: (a) for v1, with (b) specified below as the named next increment.** Reasons:

1. **It needs nothing from #521 that #521 does not already have.** The cookie stays `[badge_id, unlocked_day]`. The evaluator's inputs are in-page state that exists for the life of the view: the `completes_on` events the page itself observed. Nothing new is stored, sent or consented to. (b) would change the cookie's meaning from *outcomes* to *outcomes plus partial progress*, which the privacy analysis in #521 §2.5 and §7 did not cover and which re-introduces, in miniature, the anonymous credit record the customer's correction removed.
2. **It matches how the evidence is gathered.** An observed finish is a statement by the page about the page. There is no server-side check that could ever detect a forged "step 1 done last week", so persisting partial observed progress would add storage and consent surface for evidence that is no stronger for having been stored.
3. **It constrains authors in a useful direction.** A milestone that can be completed in one sitting, on one page, with at most three tasks is exactly the shape of a "try this and take a badge" experience. Longer arcs are what account-held courses, `attested` and `checked` evidence, and signed-in `task-evidence` badges are for.
4. **Its cost is honest and small.** A visitor who completes one of two tasks and reloads restarts that milestone. The unlock for any milestone already completed is unaffected, because that outcome is already in the cookie. The UI should say "finish both on this page" rather than imply progress is saved. The validator enforces the shape: all tasks `interactive_check`, `observed`, not required, interactives placed on this page, and warns above three tasks.

**What (a) means concretely.** The evaluator is the same pure `evalRule`. Its input is a set of `task_slug` values satisfied *in this page view*. When the rule becomes true the page fires the unlock event once, #521 writes `[badge_id, today]`, and the in-page set is discarded with the view.

**(b), the next increment: the minimum #521 would have to persist.** Specified now so the cookie format can leave room (an additive `v2`; `v1` readers ignore it):

| Needed | Shape | Why it is the minimum |
|---|---|---|
| What identifies a satisfied task | `[module_slug, task_slug]` | The same identity as a credit (§4.7). Nothing else identifies it |
| When | `unlocked_day` per pair | Needed for the same fixed 30-day expiry as an entitlement |
| What the evaluator reads | the set of pairs for one module, plus the milestone rule from the public catalog | `evalRule` needs only which tasks are satisfied; kind and credit come from the catalog, as always |
| What it may never contain | answers, timings, device data, visitor identifiers | As #521 §2.1 |

Under (b), a milestone that is a `{"tasks": […]}` rule over observed tasks can span visits. A `points` rule over observed tasks would also become evaluable in the browser, because `kind` and `credit` come from the catalog. Two rules would be added: observed pairs may only ever mint `basis: "observed"` badges, and they are never imported into `task_statuses`. I do not recommend (b) until a real exploration milestone needs more than one page view; at that point it is a cookie-format change in #521, and no change to the model in this document.

**Not designed here:** the cookie format, prompting rules, TTL, consent and the redeem endpoint. They are #521's.

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
| **Milestone badges** (Open Badges-shaped, §4.5) | Every badge states its basis (observed, attested or checked). An observed-basis badge is allowed but cannot use grading vocabulary, and no badge is awarded for viewing (§4.1) |
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
| **Viewing a replay/snapshot earning credit** | Exposure is not understanding. An interactive earns only through a key-checked `check` or a declared finish event (`completes_on`) that is more than looking; the evidence tier is recorded and shown. |
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
| **Credit arithmetic** | each milestone is satisfiable with everything earned; each `any` branch is individually reachable; each (kind, evidence) pair is permitted (§4.1); each milestone's basis is computed, observed-basis milestones may not use grading vocabulary or carry a certificate; claimable milestones meet the six conditions (§4.6); `module-complete` pinned (§5); orphan credits (non-required, unreferenced) warned |
| **Honesty** | `source_label` and `evidence_plane` present and consistent with the type; `live` rejected where no backend exists; data-plane claims need data-plane evidence; GPU/RDMA/line-rate need `disclosure_ack`; unavailable classes rejected without a flag. `compare`: label equals the weaker side's provenance, counts derived not authored, old-way baseline/completeness/representativeness stated, equivalence stated or gap disclosed, `hard_way` requires captured and complete. Finish events: `view`/`scroll`/`click`/`dwell` rejected |

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

**Starting point (live today):** a quiz (`quiz-1`, 12 questions, pass at 75) and a lab attestation (`lab-main`), both required, certificate awarded. It is the lab that needs a learner-provisioned Hedgehog Virtual AI Factory (vAIF).

**What the author changes**

1. **README:** add three headings and three marker lines (see the example's `README.md`). Bump `version` to `v1.1.0`.
2. **`interactives.json` (new):** an `explorer` that finishes on `objects_visited` (no check), a `replay` and a `predict`, each of the latter with a one-question `check`.
3. **`completion.json`:** add `kind`/`credit` to the two existing tasks (optional; defaults would apply), add three **non-required** `interactive_check` tasks (one `explore`/`observed`, two `checked`), add three milestones and one advisory prerequisite.
4. **Assets:** `replays/vlan-conflict.json` and `fixtures/missing-connection.json`. Their contents in this example are *illustrative*, derived from the lab text rather than captured, and say so in a `_note` field. A shipped replay must be captured from a real session.

**What the learner experiences**

| Learner | Does | Gets |
|---|---|---|
| Has a vAIF | Quiz + lab (exactly as today) | `module-complete` → **certificate unchanged**; also `diagnosis-practiced` |
| No lab available | Replay check + transfer problem | `diagnosis-practiced` (**no certificate**); progress shows "lab or quiz still needed for the certificate" |
| Anyone | Only watches the replay | Nothing; viewing is not credited |
| Anyone, no account | Opens the three objects in the explorer on the page | An entitlement to claim `fabric-explored` (basis: **observed**). No certificate, no `diagnosis-practiced`, nothing that implies it was graded |

**Credit arithmetic of the example:** quiz 4 (`assessment`/`checked`) + lab 6 (`lab`/`attested`) + replay check 3 (`assessment`/`checked`) + transfer 4 (`transfer`/`checked`) + explore 1 (`explore`/`observed`) = 18 total. `diagnosis-practiced` can be reached by quiz+lab, by replay+transfer, or by 8 points drawn from `lab`/`assessment`/`transfer` credit including at least 4 of `transfer`. Its basis is therefore `attested` (the weakest minimal path is lab + transfer or quiz + lab).

**Why the `kinds` filter on that third branch is there.** It states intent: observed `explore` credit does not count toward this milestone. With today's weights it changes nothing (the explore task's single point is never the deciding point). But if someone later re-weighted `explore-fabric-objects` to `credit: 4` and removed the filter, `explore-fabric-objects + transfer-unfamiliar` (4+4, with 4 of `transfer`) would satisfy the branch on browser-observed evidence for half of it. The weakest minimal path would then include an `observed` task, the milestone's basis would drop to `observed`, and the validator would reject the words "passed" and "assessment" in its criteria (`BASIS_VOCABULARY`). I traced that case by hand; the validator is unrun, so treat it as the intended behaviour, not a verified one.

**The exploration badge.** `fabric-explored` is `claimable: "entitlement"`: one task, `explore`/`observed`, interactive placed on the page, not required, no certificate. Its criteria say what the learner did ("Opened the VPC, VPCAttachment and Connection objects… no answers were checked") and avoid grading words. It borrows no assessment vocabulary and needs no `assessment` or `transfer` label to exist.

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
| `interactive.css` tokens, `.hh-ix` scoped containers, wide-block layout option in `module-page.html` | New | §3.6; the page-level template refresh is separate |
| Public badge catalog (`id`, `label`, `criteria`, `basis`, `claimable`, `definition_hash`) and `evidence` on tasks | New, small | The interface #521 consumes (§4.6–§4.8); redeem endpoint is #521's |
| `compare` renderer and its derived counts | New | §3.7. Needs captured SONiC and Hedgehog source files, which do not exist in the repo yet |
| Milestone badges | New | `BADGE#` items in the existing certificates table |
| Open Badges issuance | New, deferred | §4.5 |
| Variant pools for transfer checks | New, deferred | §4.3 |
| `shell`, `lab-server`, `lab-pair` | Blocked on #497 and the #502 broker | Schema reserved; validator rejects until available |
| Validator | **Done in this PR** | Read-only |

**Suggested order, each step useful on its own** **[design]**: (1) run and fix the validator against live content, then gate sync on it; (2) lift the enum into `src/shared/` and share it with the Lambdas; (3) milestone evaluator plus progress UI over *existing* tasks, which gives live modules typed credit with zero content change; (4) the five zero-infrastructure renderers and `interactive_check`; (5) badges. Steps 1–3 deliver value before any interactive renderer exists.

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
8. **Pre-account evaluation (§4.8): decided, not open.** v1 claimable milestones are evaluable within one page view; the task-evidence shape for (b) is specified for the next increment. Please object if the customer already has a multi-visit exploration milestone in mind, since that pulls (b) forward.
9. **Observed evidence:** is a browser-observed finish an acceptable unlock event for exploration badges, given that it is self-reported? The model labels it as such (`basis: observed`) rather than hiding it.
10. **Minted-record contract (§4.7):** confirm `<module_slug>.<milestone_id>`, the frozen `module_version` and `definition_hash`, and "redemption awards the current definition". #521 should adopt §4.7 verbatim.
11. **Vocabulary rule:** the list of words an observed-basis milestone may not use (`ASSESSMENT_VOCAB` in the validator) is a judgement. Is it the right list?
12. **`compare` (§3.7):** is "derived, never authored" counting acceptable, and who reviews the `representative_basis` of an old-way side? The validator can only check that it is stated. The captured SONiC and Hedgehog sources must be supplied by someone with a real topology.
13. **Look and feel (§3.6):** is a scoped stylesheet plus a wide-block layout option acceptable now, with the page-level template refresh as separate work?
