---
title: Platform Roadmap and Target Architecture
owner: hh-learn project lead
status: draft-for-customer-review
issue: "#517"
parent: "#478"
gate-authority: "#489"
written: 2026-11-05
supersedes: docs/roadmap.md (once accepted; not edited by this PR)
---

# Platform Roadmap and Target Architecture

Research, synthesis and writing only. This document authorises nothing: no HubSpot activity, no infrastructure, no spend, no merges. Every increment below names the #489 checkpoint it still needs.

## 0. Read this first

**Destination.** One platform where a visitor can *see what AI infrastructure makes possible* (a guided walkthrough, then a shared live lab, then their own leased server). A thin learner record sits underneath and turns what they do into typed credit. Technical marketing leads; formal courses are the secondary path on the same rails.

**Shape of the plan.** Three small tracks that run in parallel and share only a few interfaces, so none can block another.

| Track | What ships first | Needs HubSpot? | Earliest gate |
|---|---|---|---|
| **A. Walkthrough + CTA** (#498) | The download button leads to a short discovery junction that routes visitors to the evidence that fits them; the guided replay (PR #488) is one destination | Yes | #489 cp1 (disposition), then cp3 |
| **B. Hot Lab** (#497) | A private shared lab running read-only experiences (C0–C2) | No | Authorised 2026-11-04 for design/sizing/prototype |
| **C. Learner record** (#385/#397 evolution) | Typed credit derived from records that already exist | Yes (templates), AWS | Needs a deployment baseline first (R3) |

**The first three increments:** R1 (a discovery junction behind the download CTA: profiling entry, routing, destinations), R2 (the lab proof, then a private first unit), R3 (a read-only deployment baseline, not a cleanup). Section 4 has detail.

**What is consciously left broken.** Production stays as it is. Repo and production cleanup are deferred and tied to explicit triggers (section 5). Today's problems get fixed because the new thing replaces the old thing, with one exception: production-safety knowledge gaps need a read-only look, not a patch (section 3, P3, P4 and P9). Two of the original uncertainties have since been resolved favourably by read-only probes (section 7.1).

### Tag legend

**S** shipped (exists and, as far as repo evidence shows, works) · **D** designed (written down and reviewed or reviewable, not built) · **P** prototyped or partly built, not accepted · **U** unbuilt or unknown. Where I have not verified something myself, the text says "per #N" and the claim stays at that issue's confidence. **[R]** marks a recommendation of mine, not a customer decision.

### Honesty boundaries that apply to everything below

Carried from #492 (including its final amendment), #490 and #493:

1. VLAB acceptance and convergence (`APPLIEDG==CURRENTG`) is **control-plane** evidence only.
2. Connectivity, isolation and negative-connectivity claims need a **separately qualified data-plane environment**. Hedgehog documents VLAB as unsuitable for data-plane testing. #493 notes the current VLAB demo docs describe positive and negative probes, so the supported scope for the pinned release must be recorded rather than assumed either way.
3. No CPU or VLAB demonstration proves GPU, RDMA/RoCE or line-rate behaviour. Simulated GPU inventory and CPU-executed workloads are disclosed in the experience itself.
4. Hedgehog is the network. Scheduling, GPU, storage, inference and retrieval belong to their real providers and are labelled as such.

---

## 1. Target architecture

Seven layers. Each has a purpose and a current state. The state is the honest part: most of the right-hand side is design or unknown.

```
 Visitors / learners
        |
 [Delivery surfaces]  HubSpot CMS: /learn, product pages, /learn/experience/*
        |                    |                          |
 [Content & authoring]   [Interactive experiences]   [Learner record & attainment]
   content/ -> HubDB        replay | shared lab | VLAB     completion, certificates, credit
        |                        |                              |
        |                [Lab substrate: Hot Lab]          [Identity]
        |                 fabric units, broker, ops          HubSpot membership / Cognito
        |
 [Analytics] HubSpot-native events across all of the above
```

### 1.1 Content and authoring: **S** today, **U** for the direction

- **S.** Markdown modules under `content/modules/` (20 present), course and pathway JSON under `content/courses/` and `content/pathways/`, rendered and pushed to HubDB by `npm run sync:content`, `sync:courses`, `sync:pathways`. Templates live in `clean-x-hedgehog-templates/learn/`.
- **S, with a correction to the ticket.** The module sync *does* delete HubDB rows with no matching content directory (`SYNC_DELETE_MISSING` defaults to `true`, `src/sync/markdown-to-hubdb.ts:339`), and handles `content/archive/` by tag or delete. The **course and pathway syncs have no delete path** (no equivalent in `courses-to-hubdb.ts` or `pathways-to-hubdb.ts`). So orphaned rows are a courses/pathways problem. Whether modules have orphans too depends on how the sync was last run (U).
- **U, direction from #495.** A specialised agentic authoring and maintenance workflow. #495 is a research backlog: nothing installed, nothing tested, no tool shown to satisfy all three of planning/authoring, interactive delivery and technical verification/maintenance. Shortlist: OpenMAIC, LiaScript, H5P, CourseCode, plus commercial options. The roadmap treats this as an evaluation (R7), not an architecture commitment.
- **Design rule [R].** One topology/state model should feed the diagram, the explanation, the simulation and the assessment (#495). This is the one authoring principle worth fixing early, because it is cheap now and expensive to retrofit.

### 1.2 Delivery surfaces: **S** for `/learn`, **P** for experience routes

- **S.** HubSpot CMS templates for catalog, module, course, pathway, My Learning, certificate, register and action-runner pages. A parallel `learn-shadow/` template set and a `shadow` AWS stage exist as an isolated test environment (PRs #377–#393 are open, so how far that isolation is complete is U).
- **P.** The experience route `/learn/experience/fabric-operator` exists only inside draft PR #488, flag `EXPERIENCE_LAB_ENABLED` default off. Route and CTAs are provisional per #489.
- **U.** Product-page integration: where the walkthrough and lab entry points sit on hedgehog.cloud itself. This is a cp3 question, not yet a design.
- **Constraint.** Anything touching HubSpot is held behind #489 checkpoints 3–5. An unpublished clone alone does not isolate shared templates, assets, modules, global content or HubDB; unlinked published pages are public.

### 1.3 Learner record and attainment: **S** foundation, **U** typed credit

- **S per #385/#397.** Completion tracking, certificates, HubDB storage and the My Learning dashboard. `serverless.yml` already defines users, enrollments, progress and **badges** DynamoDB tables for the shadow/production stages.
- **U.** The JetBrains-Academy-style model: typed points accumulating toward milestones, with several paths to one milestone. #498 frames this as **a data-model evolution of #385/#397, not a new build**, and I agree. Optional: Open Badges 3.0 for off-site portability (research item, #498).
- **Recommendation [R].** Define credit as a *derived view over existing completion and lease records*, with a `kind` and a weight, rather than a new store. Lab leases (R5) become one more source of records. This keeps the model small and lets it evolve.
- **What is not certain.** Which of the two identity and record paths is *actually serving production today* (see 1.5). Typed credit cannot be scheduled until that is known.

### 1.4 Interactive experiences: three kinds, one vocabulary

| Kind | State | What it proves | Cost to run |
|---|---|---|---|
| **Static replay** | **P**: PR #488 (draft, unmerged). Real-source anti-drift validation across 5 modules, adversarial JSON-island round-trip, zero-network e2e guard, axe checks, default-off flag | Illustrates a workflow from validated capture; makes no live claim | Static assets only |
| **Live shared lab** | **D** (#497 and children) | Real Hedgehog control plane, shared, read-mostly, then leased | Lab hardware |
| **Dedicated VLAB** | **S** (today's per-student model, C6) | Everything a student needs for destructive or deep work | One VM per student |

#488 was a devc sequencing decision, not a customer acceptance of replay as a substitute for the always-on lab (#489). The roadmap respects that: the replay is useful on its own merits as the CTA destination, and the lab is not delayed or replaced by it.

### 1.5 Identity: **S**, but production state is **U**

- **Repo evidence of two paths.** `docs/auth-and-progress.md` (2025-10-28) names HubSpot Membership as the production baseline. Issues #299/#308 and the `cognito-auth.ts` Lambda describe a Cognito + DynamoDB external SSO and progress store. #460 states the shadow API has the learner-progress routes and the root production mapping does not.
- **Amendment (2026-11-05, probed).** The records below were contradictory when I wrote them; a read-only probe has since resolved the question in the running system. The learner-progress routes return 401 on `hvoog2lnha` and are served on the bare domain, so #460 was remediated by remapping the domain. What remains is a **split-brain topology** (P9). The paragraphs below are kept as originally written, except the symptom, which is corrected.
- **Contradictory records about #460.** Its body says the root mapping points at `dev-hedgehog-learn` (`hvoog2lnha`). Its investigation comment says *not remediated*. #461's body says #460 "already resolved" the mapping. The #515 safety note in #497 says the bare mapping *has pointed* at the dev stage. I cannot resolve this from the repo, so **the current production identity and API topology is U**.
- **A concrete symptom (corrected).** `clean-x-hedgehog-templates/config/constants.json` points four constants at API `hvoog2lnha`, the stack named *dev*: `AUTH_LOGIN_URL`, `AUTH_ME_URL`, `AUTH_LOGOUT_URL` and `TRACK_EVENTS_URL`. Probing shows these are live and working, so the *dev* stack serves production auth and event tracking (P9). My first draft named only `TRACK_EVENTS_URL` and suggested events were mis-aimed; that was too narrow and too pessimistic.
- **Per-tier implication [R]:**

| Class (#502) | Identity required | Why |
|---|---|---|
| C0 cached, C1 shared read, C2 sandboxed shell | **Anonymous**, rate-limited | These exist to show value fast. Gating them behind registration contradicts the design principle |
| C3 leased server, C4 leased pair | **Registered**, one active lease each | A lease needs an owner for quotas, abuse limits and credit attribution |
| C6 dedicated VLAB | Registered, as today | Unchanged |

The lease broker (#503) must accept whatever identity provider is authoritative, so the identity question does not block the lab.

### 1.6 Lab substrate (the Hot Lab): **D** end to end, **P** in pieces

Decisions already made and not reopened here: lease servers, not switches; a fabric unit is a horizontal scaling stamp; the shared environment is the default for early learning and dedicated VLAB is reserved for work that needs it.

| Component | State | Notes |
|---|---|---|
| **Fabric unit** (frontend, dual-plane backend, storage fabric, gateway, shared-service VMs, server pool) | **D** (#497, #500; wiring diagram in PR #509) | Roughly 97 GB planning figure per unit from allocated VM sizes (#499). VLAB `DefaultSizes` are conservative minimums, and the production vAIDC runs well under half its host (#499 coordinator note), so treat the figure as an upper bound |
| **Sizing** | **D** (#499 delivered, two options) | Redundant (3 servers + backup) or non-redundant (1 + backup). Engineering has not selected |
| **Provision/bootstrap split** | **P** (#508/PR #514 GCP lifecycle; #510/PR #512 portable bootstrap) | Hard rule: no provider commands in guest scripts, so the same code runs on GCP and Proxmox |
| **Multi-fabric proof** | **P** (#501 Part A is PR #516; Part B is operator-executed) | Not yet run. Nothing about the substrate is proven until it is |
| **Session broker** | **D** (#503; #502 classes feed it) | Substrate-agnostic. Atomic claim, hard TTL, generation fencing at execution, revoke-first cleanup, quarantine, multi-unit routing |
| **Ops stack** (Argo CD, LGTM, Gitea, NetBox, broker) | **D** in #494, **held** as #504 | Waits for sizing selection |
| **Workspace tier** | **U**, held as #505 | Waits for #502 and #503 |
| **Substrate choice** (hhfab/VLAB, Clabernetes, NVIDIA Air) | **U** | #490 current recommendation: Clabernetes as leading self-hosted candidate, VLAB as known baseline, Air as a complementary NVIDIA-specific option. Nothing proven |
| **Image hosting rights** | **U**, blocking for public exposure | Written answers needed from Hedgehog and Broadcom (#490 F6). Private evaluation does not need them |

### 1.7 Analytics: **S** thin, **U** for what the platform needs

- **S.** `/events/track` Lambda beacons (`learning_module_started`, `learning_module_completed`, `learning_pathway_enrolled`) plus HubSpot page analytics. The ingestion route is live and validating (P9); see the topology finding in 1.5.
- **Decision on record (#480).** HubSpot-native analytics only for the experience routes.
- **U, what the platform needs.** A short list, deliberately not a dashboard programme:
  1. **CTA distribution and journey progression** from the download button (#498): which destination each visitor chose, and whether they reached a next step. Not dwell time.
  2. **Comprehension and task success for experiences**, not clicks (#492 finding 4). Needs the small formative study from #492 §3, which has *not* been run.
  3. **Lab operations metrics** (time-to-ready, queue depth, cleanup failures, quarantine count) in the lab's own LGTM stack, not in HubSpot.
- Event ingestion for lab usage should reuse the same beacon contract so credit and funnel analysis share one vocabulary [R].

---

## 2. Audience and journey model

**Confirmed by the customer (#489):** AI infrastructure is the primary domain. The design principle is *"I can immediately see what this infrastructure makes possible."* Technical marketing is primary, formal courses secondary. Show the AI service outcome first; configuration and CLI are optional evidence.

### 2.1 Why prospects arrive, per the customer (#498, 2026-11-05) **S** (as testimony)

This is the first real audience data the project has had. It is the customer's own account, recorded close to verbatim on #498. It is testimony, not measured behaviour. Earlier drafts of this section reasoned from invented personas; the evidence below takes precedence over them.

**Six stated motivations**

1. **Complexity.** "A lot tentatively believe AI networking is complex and want a solution to help simplify it." The broadest motivation, and not a specific capability.
2. **Secure multi-tenancy.** "Many primarily want to be able to handle secure multi-tenancy."
3. **Hyperscaler-like, VPC-centric networking.** "Many are attracted to the idea it can help them have hyperscaler-like VPC-centric networking solutions."
4. **Procurement and cost.** SONiC interest is often procurement-driven: supply chain delays acquiring NVIDIA or other name-brand gear, and in some cases cost savings.
5. **SONiC is daunting to run directly,** particularly in a GPU cluster.
6. **Assurance comes from evidence.** Published performance results and OCP reference architectures are what convince them that Hedgehog makes SONiC dramatically easier to adopt.

**Five profile dimensions these imply** (what a progressive profile would capture)

| Dimension | Values | Steers |
|---|---|---|
| Primary pain | complexity, multi-tenancy, procurement/supply chain, cost | Which story leads |
| Hardware posture | SONiC committed, evaluating SONiC, locked to name-brand | Procurement relief or capability |
| Environment | GPU cluster, general data centre | Whether AI-factory framing applies |
| Role | evaluator, operator, architect, buyer | Depth and register |
| Assurance needed | performance data, reference architecture, hands-on proof | Which evidence to surface, and whether a lab is wanted at all |

**Implication.** For a meaningful share of visitors **the decision is already partly made**: they want or need SONiC, and the open question is whether Hedgehog makes it *manageable*. That is a different conversation from "why software-defined networking", and the site serves neither today. Some of these visitors are best served by evidence the company already owns (published results, OCP reference architectures), which needs no lab and no new build.

**Customer constraints.** A few questions, answerable in seconds, no registration. Bypassable (#492). The profile **steers; it never gates**. Anything illustrative is labelled, and no performance claim is made that the cited published results do not back.

### 2.2 Working profiles **[R]**

The customer has not signed off a persona list. The six below are working profiles assembled from #492's personas and #498. **They predate 2.1.** Treat them as a draft to re-cut against the five dimensions above, not as findings.

| Profile | Wants | Natural entry | Journey I would route them on |
|---|---|---|---|
| **Neocloud platform owner** | Onboard tenants onto shared hardware with real isolation, quickly | Product page, download CTA | Replay (R1) → shared lab C0–C2 (R4) → tenant-pair exercise C4 (R6) |
| **Enterprise AI platform team** | Internal multi-team access on finite GPU estate | Product page, search | Replay → shared lab → consult |
| **Inference / app team** | Their service must reach retrieval and data services, with boundaries | Docs, product page | Outcome-first story B (replay) → C2 shell to inspect |
| **Infra owner / SRE** | Tell fast whether the network is implicated in a slowdown | Observability page | C0/C1 telemetry (validated signals only) → diagnosis exercise |
| **Existing Hedgehog user / student** | Hands-on practice with the fabric | `/learn`, VLAB docs | Existing courses → C3/C4 leased exercises → dedicated VLAB for advanced work |
| **Evaluator without a lab** (the download-button majority per #498) | See the product work without installing it | Download button | Replay, then a consult option. This is the group currently stranded |

**Where each journey dead-ends today:**

| Profile | Current dead end | Absorbed by |
|---|---|---|
| Evaluator / most CTA visitors | Download leads to an install-and-operate path most visitors cannot take (#498: "very much a dead end"). No response to the highest-intent signal on the site | R1 |
| Neocloud / enterprise decision makers | No place on the site to *see* tenant isolation or a service outcome. `/learn` is course-first | R1 (replay), R4 (live, read-only) |
| Inference / SRE profiles | No observability or application-connectivity experience exists | R4 (C0/C1), with the #492 truth-labelling rules |
| Existing students | Hands-on means a full dedicated VLAB VM per student. Heavy for early-stage learning; no lighter option | R5 (C3) |
| Everyone registered | Completion is recorded, but attainment is flat: no typed credit, no multiple paths to a milestone | R6 |
| Course authors | Interactive and visual content is hand-built per lesson; no maintenance map from source change to affected content | R7 (evaluation only) |

**Gap against 2.1.** The table has no row for the SONiC-committed buyer whose open question is manageability, or the procurement-driven evaluator who needs published performance data. Both are in the stated audience, and neither is served by a lab or a replay.

**Evidence limits to remember [R].** #492's nine findings come largely from student and consumer studies. They support design hypotheses (adaptive and bypassable guidance, a quick visible win, verifiable over asserted claims), not conversion forecasts. There is no peer-reviewed causal evidence that an interactive demo improves enterprise evaluation. The roadmap therefore measures *comprehension and journey progression*, and sets no conversion targets.

---

## 3. Existing-site problem inventory, each mapped to its redesign home

The customer's instruction is to fix existing-site problems *in league with* the redesign. For each problem: what breaks today, which increment absorbs it as a by-product, and the cost of never fixing it. "Absorbed" means the new work makes the old problem disappear, not that it is patched first.

Increment names (R1–R7) are defined in section 4.

### P1. Download-CTA dead end (#498)

- **Breaks today.** The highest-intent signal on the site routes most of the audience nowhere useful (customer's words: a dead end that "won't go anywhere").
- **Absorbed by R1.** The CTA becomes a discovery junction (section 4). The guided replay (#488) is one destination among several, and the real download route is kept for visitors it fits.
- **If never fixed.** Demand for self-service discovery keeps being observed and wasted. This is the only item in the inventory with direct commercial cost, which is why it comes first.

### P2. Stale repo content and unknown drift between repo and production

- **Breaks today.** The repo holds a large amount of historical material I did not audit line by line: about 20 root-level analysis, handoff and status files and 22 `docs/issue-*` entries (for example `ANALYSIS-SUMMARY.md`, `AUTH-ANALYSIS-*.md`, `docs/issue-*-*.md`), `docs/roadmap.md` last reviewed 2025-10-19, and `docs/architecture.md` describing a state that predates the shadow stage. It is unknown how far the repo matches what runs at hedgehog.cloud, and the fixed `hvoog2lnha` URL in `constants.json` is one concrete mismatch candidate.
- **Absorbed by:** R3 (a one-time, read-only snapshot of what is actually deployed, so the drift is *measured*) and then R6/R7 as each surface is replaced. When a surface is rebuilt, its old templates, docs and tests are deleted in the same PR. No standalone cleanup increment.
- **If never fixed.** New agents and humans keep reading stale instructions as authoritative, which is how the project has already lost time (see P3, P8).

### P3. Lambda auto-deploy broken ~7 months; deployment provenance unclear

- **Breaks today.** Per #497, `deploy-aws.yml` ran on every push to main with an empty `APP_STAGE` (which `serverless.yml:26` defaults to `dev`) and failed from 2026-04-09. PR #515 made it dispatch-only with a required stage. About seven months of Lambda changes sit on main with no record of what is deployed where.
- **`dev` is partially production (amendment).** Given P9, `dev` is not a sandbox: the stack of that name serves live auth and event tracking. An empty `APP_STAGE` silently resolving to `dev` therefore meant an accidental deploy could change live production behaviour. PR #515's required-explicit-stage guard is a **safety control, not hygiene**. Anyone reading "dev" as safe to experiment on would be wrong.
- **Not a patch, but not nothing.** #515 removed the hazard (an accidental deploy at the wrong stage). It did not establish provenance.
- **Absorbed by R3.** Before *any* increment that changes the API (typed credit in R6, broker integration in R5 where it touches the learner record), do a read-only provenance check: for each stage, which code version is running, which API id maps to which domain, which environment values are set. Then the first real deploy is a deliberate, diffed event with an explicit stage.
- **If never fixed.** The first API change will deploy seven months of unreviewed drift at once, on top of an unknown mapping. This is the one place where deferral becomes risky, so the ordering matters more than the effort.
- **Constraint.** The #515 note says treat production as authoritative and the repo as only a candidate. R3 respects that: it reads, it does not write.

### P4. Production-safety questions that "holding steady" does not answer

I flag this one against the customer's strategic steer, and say plainly where I think it needs care. See section 7 for the labelled disagreement.

- **Status (amendment):** P4a and P4b are resolved favourably in the running system; see 7.1. The text below records the original reasoning.
- **P4a: test-bypass hardening (#461).** The permanent guard (`isTestBypassEnabled()` requiring both `ENABLE_TEST_BYPASS` and `APP_STAGE=shadow`) is present in `cognito-auth.ts` on main. Because Lambda deploys failed from 2026-04-09, I cannot tell from the repo whether it is *deployed*. #461 says production was protected by an operational config reset, which is not the same thing.
- **P4b: production API topology (#460).** Contradictory records (section 1.5).
- **Absorbed by R3.** Both are answerable by a read-only look. Neither needs code.
- **If never fixed.** P4a is a latent authentication bypass if config ever drifts again; P4b means nobody can say with confidence which stage the live site's API calls hit.

### P5. Lint failures on main (~173 errors) and a long-red `build` job

- **Breaks today.** Per the ticket and #311, about 173 pre-existing lint errors, a build job red for a long time, and branch protection not restored. I did not re-run lint here; the figure is the ticket's.
- **Absorbed by:** a rule rather than a cleanup. **[R]** New code (the experience routes, broker-facing contracts, credit model) lives in new directories under its own required, green check, and existing code is not touched to satisfy it. Old failing code leaves the tree when its surface is replaced (R6/R7). #311 stays open until then.
- **If never fixed.** Red CI keeps teaching everyone to ignore CI, and review signals stay weak. This is a tax, not a failure, and the cheapest mitigation is the scoped green check above.

### P6. Unmerged work with real value: PR #487 and PR #488

- **Breaks today.** PR #488 is a complete, heavily tested guided replay sitting as a draft; PR #487 is a small content correction (#481) that #488 declares as a dependency. Both are frozen by the customer hold. The VPC module still carries the stale reconciliation-events claim.
- **Absorbed by R1.** **Decided (D2, coordinator):** use #488 as a destination and merge #487 with it. This decides *reuse of the asset*. It is not permission to merge or publish past #489's gates; the route and CTA wording remain customer-reviewable at cp3.
- **If never fixed.** The most complete asset in the tree rots as the content it validates against changes, and the stale content claim stays in front of learners.

### P7. Orphaned and stale HubDB rows; archived content that sync does not delete

- **Breaks today.** The ticket asserts sync does not delete. From the code: the **module** sync deletes by default; the **course and pathway** syncs never delete. `content/archive/` also holds modules, courses and pathways, and `scripts/detect-orphans.ts` exists to report broken references. Whether production HubDB actually has orphans is U.
- **Absorbed by R3 and R6.** R3 includes a read-only HubDB row count versus repo content. When the credit model touches courses and pathways (R6), the sync gets a delete or archive path for those tables as part of that change.
- **If never fixed.** Orphaned course/pathway rows can appear in the catalog or in progress counts, with no one noticing because nothing reports them.

### P8. About 17 stale-open issues (#434, #435, #446–#457, #459, #460, #461)

- **Breaks today.** The board says work remains where the customer says it merged. It misleads any agent that reads the tracker, as the Hot Lab tickets showed when agents could not read sibling issues.
- **What I verified.** Only #461's code is visibly on main. The set is not uniform: #460's own comments say *not remediated*, so closing it as done would hide P4b. I did not verify merge status for the others.
- **Absorbed by:** a single reconciliation pass at the R6/R7 trigger (section 5), in which each issue is closed with a link to its merged PR, or kept open with a reason. Not before.
- **If never fixed.** Coordinators and agents keep rediscovering the same history. Mild cost; no production effect.
- **One cheap note [R].** The 17 close in minutes once the mapping exists, but that is exactly the kind of tidy-up the customer deferred, so I have not scheduled it earlier.

### Further problems found while reading

| # | Problem | Evidence | Absorbed by | If never fixed |
|---|---|---|---|---|
| P9 | **Split-brain API topology.** `constants.json` hardcodes `hvoog2lnha` (the stack named *dev*) for four constants: `AUTH_LOGIN_URL`, `AUTH_ME_URL`, `AUTH_LOGOUT_URL`, `TRACK_EVENTS_URL`. Probed: auth and events are served by that stack; learner-progress and certificates exist **only** on the bare domain (404 on `hvoog2lnha`). `POST /events/track` returns `400 SCHEMA_VALIDATION_FAILED` on both hosts (route live, validation working); the earlier GET 404 was an API Gateway method mismatch. #460 was remediated by remapping the domain, but `constants.json` still carries the old id for auth and events | Read-only probes (2026-11-05); `constants.json`; #460 | R3 (full baseline); any later change is deliberate, not a hotfix | **Analytics are not untrustworthy.** The risk is structural: two stacks are jointly production, `dev` is not a sandbox (P3), and changing or tearing down `dev` would break login and tracking |
| P10 | Shadow environment is half in the tree | Open PRs #377–#381, #390, #393 | R1/R6 preview isolation work (cp3 needs an isolation answer anyway) decides whether to reuse or discard | Two template sets (`learn/`, `learn-shadow/`) drift apart |
| P11 | Other long-open PRs/docs: #225, #291, #292 | `gh pr list` | The R6/R7 reconciliation | Noise only |
| P12 | vAIDC machine-type inconsistency: module docs say `n1-standard-32`; `labapp` deploys `n2-standard-32` and `lab-validation/RESUMPTION.md` records the Cascade Lake flag as incompatible with n1 | #499 coordinator note | The content pass that accompanies R2 (the lab proof will establish the truth) | Learners follow instructions that may fail |
| P13 | Course authoring has no maintenance map from a source or release change to affected content | #495; `docs/roadmap.md` v0.6/v0.7 unmet | R7 | Content ages silently |
| P14 | The old `docs/roadmap.md` describes v0.1–v0.7 and a "Learn MVP" plan from 2025-10 | `docs/roadmap.md` | This document supersedes it when accepted | Two roadmaps in the tree |

### Summary map

| Problem | Absorbing increment | Needs |
|---|---|---|
| P1 CTA dead end | **R1** | cp1, then cp3–cp5 |
| P2 stale content, drift | R3, then R6/R7 | read-only inspection approval, then surface replacement |
| P3 Lambda deployment provenance | **R3** | read-only inspection approval |
| P4 bypass guard, API topology | **R3** (probe slice already run; mechanism still to confirm) | same |
| P5 lint/build | scoped green check from R1; removal at R6/R7 | none |
| P6 #487/#488 | **R1** | D2 decided; cp3–cp5 for publication |
| P7 orphaned rows | R3 (measure), R6 (fix) | read-only inspection, then credit work |
| P8 stale issues | R6/R7 reconciliation | none |
| P9 split-brain topology | **R3** | same |
| P10–P14 | as listed | as listed |

---

## 4. Sequencing with gates

### Principles

1. **Ship something small first.** R1 can reuse a built, tested asset. No increment waits on the lab.
2. **Tracks do not block one another.** A and B share no dependencies (the customer decoupled them on 2026-11-04). C depends on R3, not on the lab.
3. **A proof before a promise.** The lab is public only after the isolation design, the licensing answers and the isolation checks pass.
4. **No increment needs the whole architecture.** Every row in the table is useful if the rows after it never happen.

### Gates used

| Gate | Source | Meaning |
|---|---|---|
| **cp1** Product direction | #489 | Customer chooses the next slice |
| **cp2** Always-on architecture | #489, advanced 2026-11-04 | Design, sizing and prototyping authorised; procurement and public exposure **not** |
| **cp3** Website preview plan | #489 | Exact target page and draft scope approved before any HubSpot write |
| **cp4** UAT | #489 | Customer reviews unpublished preview and evidence |
| **cp5** Release | #489 | Customer approves exact diff, window, rollback |
| **G-hw** | #489 2026-11-04 | No hardware procurement before engineering selects a sizing option |
| **G-pub** | #489 2026-11-04 | No public ingress to the lab before an isolation design and licensing answers |

### Increments

Order within a track is a dependency order; tracks run side by side.

| ID | Delivers | Depends on | Gate | Verified by |
|---|---|---|---|---|
| **R1** Discovery junction behind the CTA (Track A) | Reshaped 2026-11-05 (see "R1 as a discovery junction"): a renamed entry, a few-question profiling step, routing to destinations that include #488 and the real download route, and an approved measurement definition before release | D2 decided (use #488, merge #487); an approved measurement definition (D7); for the live step, HubSpot preview isolation | cp1 for the spec; **cp3 → cp4 → cp5** for anything in HubSpot | Spec and measurement definition: customer sign-off. Live: #488's zero-network and axe checks, the agreed measures, and a small formative study per #492 §3 |
| **R2** Lab proof and first private unit (Track B) | **Prerequisite met:** the bounded multi-fabric proof ran (PR #519; see "R2 proof result"). Remaining: sizing selection (D3) and a first fabric unit running privately on lab hardware. Next proof question: per-Fabric VPC coherence across a shared server | #499 (done), #500/PR #509, #508/PR #514, #510/PR #512, #501 Part A/PR #516 | cp2 (granted for prototype); **G-hw** for hardware | Proof criteria from #490/#501. Met so far (control-plane only): see "R2 proof result". Still to verify: VPC coherence per Fabric, restart behaviour. No data-plane or performance claim |
| **R3** Deployment baseline (shared prerequisite) | A read-only snapshot: which API stage serves which domain, which Lambda code and environment values run per stage, HubDB counts versus repo, templates deployed versus repo. It answers P3, P4, P7, P9 | Customer approval of read-only inspection (AWS and HubSpot read access) | Falls inside **cp3** for HubSpot; AWS read-only needs explicit approval. Writes: none | A written report with evidence; no production change |
| **R4** Shared read-only experiences (Track B) | C0 cached feeds and C1/C2 read-only experiences served from the private unit; tenant story with disclosed real-vs-illustrative labels | R2 | cp2; **G-pub** before any public exposure; cp3–cp5 before any HubSpot placement | Convergence evidence labelled control-plane; concurrent-viewer test against the C1/C2 bounds (#502); staleness and expiry behaviour demonstrated; truth-label review against #492 rules |
| **R5** Leased exercises (Track B) | The broker (#503) in its smallest form: C3 single leased server, then C4 pair. Registered users, one active lease, hard TTL, verified cleanup | R4, #503 reviewed, #505 workspace tier designed | **G-pub** (isolation design), licensing answers for any hosted/anonymous use | #493's first proof: two concurrent sessions, expiry mid-operation, broker crash/restart, cleanup and reassignment, stale job rejected after reassignment; unaffected-slot checks without throughput claims. Isolation/negative-connectivity needs a separately qualified data-plane environment |
| **R6** Typed credit (Track C) | A `kind` + weight view over completion and lease records, milestones with multiple paths; delete/archive path for courses and pathways in the sync | R3 (so deployment is deliberate), R1 for the surface, R5 for lab-derived credit | cp3–cp5 for template changes; AWS deployment is a deliberate, explicit-stage event | Existing completion/certificate tests stay green; new credit rules have unit tests; a before/after record comparison |
| **R7** Authoring evaluation (off critical path) | One demanding lesson authored three ways (OpenMAIC, one hosted tool, the current workflow), judged on correctness, provenance, visual interaction, accessibility, maintenance on a small source change | Customer approval of lesson, rubric and budget | None on the critical path; spend needs approval | #495's comparison rubric; the maintenance-update test is the deciding criterion |

### R1 as a discovery junction **P** (design reshaped; assets built)

Reshaped after a review (session `ee76d19c`, verdict "adopt with specific changes", accepted in full). The review rejected two claims in the earlier R1, and both rejections were correct:

- **"A click equals a profile" is false.** A click reveals interest, not role, seniority or buying stage. R1 does not claim behavioural profiling from clicks.
- **"Plain links make the measurement free" is false.** Four ordinary links do not produce a four-way click report in HubSpot page analytics. #480 restricts the platform to page analytics and removed the custom beacon, and raw destination page-views are useless because those pages receive traffic from elsewhere. As first written, the experiment failed its own evidentiary test.

**What R1 is**

1. **An entry named to match what it delivers,** with **the actual download route preserved** for visitors it fits. Replacing it would have broken the path for the minority it genuinely serves.
2. **Paths that cover the stated motivations** (2.1), with **secure multi-tenancy and VPC-centric networking explicit**. It was a named primary motivation and mapped to none of the earlier four paths. Evidence the company already owns (published results, OCP reference architectures) is a path in its own right.
3. **Contact is secondary,** not a peer option.
4. **#488 is one destination,** not the destination.
5. **An approved measurement definition before release:** entry-page visits, attributable transitions per destination, no-onward-transition, plus coverage limits and the denominator. There are two candidate mechanisms and **neither is yet demonstrated:** native page-transition attribution, or native CTA click reporting, whose availability in this account must be confirmed. **If neither works, R1 is described honestly as a routing improvement evaluated by a small formative study (#492 §3), not as behavioural profiling. No custom event system.**
6. **A popular link is not success.** A menu can move the dead end one page downstream. "No onward transition" and each destination's own next step are part of the acceptance test.
7. **Scope boundary.** Benchmarks, architecture docs, forms, shared navigation and marketing automation each need their own owner. No asset migration is justified merely to make links convenient.

**Cheapest first slice [R].** Some profiles are best served by evidence the company already owns, which needs no lab and no new build. The lowest-cost version of R1 routes to the published performance results and OCP reference architectures: it needs only the entry, the routing and the measurement definition. #488 joins as a destination at the same gates. Profiling steers and never gates, and every step is bypassable.

### R2 proof result (PR #519, control-plane only) **S**

On hhfab v0.51.3 GA with fabric/agent v0.144.1:

- The API accepts a Server with Connections into two Fabrics, **with a negative control** showing validation genuinely enforces fabric membership.
- `hhfab vlab up` reported `VLAB is ready took=16m18s` with zero `ERR`.
- Two Fabrics were instantiated and the switches were correctly partitioned.
- **All four agents converged: `APPLIEDG == CURRENTG == 1`, heartbeating.**
- `gpu-01` has `enp2s1`→`fe-leaf-01` (default) and `enp2s2`→`be-leaf-01` (backend), both UP with carrier.

**Scope.** Control-plane evidence only. No VPCs were created, so **per-Fabric VPC coherence across a shared server is still unverified**; it is the next proof question. No data-plane, isolation or performance claim follows (#492 boundary). The architectural unknown for R2 is closed; what remains is D3 and the first private unit.

### Two automation traps from the proof

Both cost time and will recur:

1. **A failed `hhfab init` leaves `include/` empty, and `hhfab validate` then passes** against the default config. A green validate means nothing unless `include/` is confirmed populated.
2. **`VLAB is ready` fires about 6 minutes before agents apply config.** It means control plane up and VMs launched, not convergence. Automation must poll `APPLIEDG` (against `CURRENTG`).

### How R1 and R2 stay independent

- R1 touches only static assets, a flag and HubSpot (behind cp3–cp5). It uses no lab.
- R2 touches only lab infrastructure. It uses no HubSpot.
- They meet at one point: **R4 may later enrich R1's replay with a live view**, via a single interface (the C0 cached feed contract). Until R4 ships, the replay is complete without it.

### What "usable quickly" means here

R1's destinations already exist (#488, plus published results and reference architectures). The new work is the entry, the routing and the measurement definition. Its delay is the approval gates and the measurement question, not a large build. R2's proof has run; it is mostly built (provision, bootstrap, wiring diagram, runbook exist as PRs awaiting review) and now waits on the sizing choice (D3). R3 is a bounded read-only task. I give no calendar estimates because I have no throughput data for the review loop. If R1 and R2 are both blocked on approvals, the approvals are the critical path, not the engineering.

### Capacity note for R4/R5 (quantified in #499/#502, all unmeasured)

C0–C2 take no pool-server lease, so they never compete for the scarce resource; only C3/C4 size the pool. #502 shows illustrative throughput of about 8–27 C3 sessions per hour for 8–16 pool servers at 30–45 minute leases. These are placeholders until reset time and pool size are measured by R2.

---

## 5. Explicit non-goals and deferrals

### What this platform will not be

1. **Not a replacement LMS or CMS.** HubSpot stays the delivery surface. #495 says explicitly not to migrate platforms to obtain an authoring feature.
2. **Not a performance or hardware certification lab.** No GPU, RDMA/RoCE, line-rate, buffer, PFC/ECN or throughput claim from any CPU or VLAB experience.
3. **Not a compute, storage or inference platform.** Hedgehog's contribution is the network. Other components are attributed to their real providers.
4. **Not a freeform lab.** Authors choose from the closed C0–C6 menu (C5 documented only). Visitors get no controller credentials, arbitrary YAML or shell on shared infrastructure.
5. **Not dependent on gamification.** Optional per #489; understanding, usefulness and trust beat clicks and dwell.
6. **Not a migration plan.** Nothing in this roadmap moves production content or data as an end in itself.
7. **Not a programme with a long build before anything ships.** See the Occam checks below.

### Consciously left broken for now

Written plainly so deferral is not mistaken for oversight:

| Left as is | Why | Consequence accepted | Trigger that ends the deferral |
|---|---|---|---|
| The ~173 lint errors and red `build` job on main | The customer will not spend time propping up the current state | Weak CI signal on old code | A surface is replaced (R1 for the CTA surface, R6/R7 for the rest): that surface's code is deleted, not fixed. Branch protection is restored when the last red surface goes |
| Stale root and `docs/` files; `docs/roadmap.md` | Repo cleanup is deferred | New readers can be misled | This document supersedes `docs/roadmap.md` once accepted. Other files go with the surface or topic they describe |
| The ~17 stale-open issues | Housekeeping without production effect | Misleading board | The R6/R7 reconciliation pass (P8) |
| Orphaned HubDB rows | Unknown size; no visible harm reported | Possible hidden catalog noise | R3 measures; R6 adds a delete path for courses and pathways |
| `learn-shadow/` templates and the open shadow PRs | Isolation approach is undecided (P10) | Two template sets | The cp3 isolation design for R1 decides reuse or retire |
| The `constants.json` auth and tracking URLs (four constants on the `dev`-named stack) | Working in production; the risk is structural, not a fault | Auth and events depend on a stack named *dev* | R3 documents it; any remap is a deliberate change, not a hotfix |
| The vAIDC `n1` vs `n2` content wording | Truth depends on R2's results | Possible learner confusion | The content pass that follows R2 |

### The exception, stated honestly

The deferral applies to *maintenance and cleanup*. It cannot honestly cover the *knowledge* gaps P3, P4 and P9. Probes have since closed two of them (7.1), but deployment provenance and the mechanism behind the 401s remain unknown. R3 is therefore a read-only measurement, scheduled before any API change, not a clean-up and not a patch. If the customer declines even that, R6 (and any other API change) should be treated as blocked, because the first deploy is unsafe without it.

### Occam checks

- Track A needs **no new engineering** to reach its first customer-visible state.
- Track B's first visitor value (C0–C2) needs **no broker, no workspace tier and no leases.** The broker is built only when C3 is wanted.
- Track C is **one derived view and a few columns**, not a new service.
- R7 is **one lesson and a rubric**, not a tooling programme.
- The substrate decision (hhfab, Clabernetes or Air) is **not on the critical path of any increment's design**: the broker, classes and contracts are substrate-agnostic.

---

## 6. Open customer decisions

Only genuine forks. Things with an obvious default are in section 6.2 as recommendations the customer can simply let stand.

### 6.1 Forks that need an answer

**D1. Lead discovery: ANSWERED (customer, 2026-11-05; record on #498).** The customer rejected the fork posed in #489 (*"more AI services from the hardware I own"* versus *"independent access for more teams and customers"*). **Progressive profiling is the entry; the lead story is what the profile routes to.** Start with generally applicable questions and build a profile that steers later ones. Neither former option is the opener; both remain candidate *destinations*. Audience evidence is in 2.1 and the reshaped R1 is in section 4. My earlier lean to Option 2 is withdrawn as moot.

**D2. Disposition of PR #488 and PR #487: DECIDED (coordinator, not a customer question).** Use #488 as a destination and merge #487 with it. **Boundary:** deciding to reuse the asset is not permission to merge or publish past #489's gates. The route and CTA wording remain customer-reviewable at cp3.

**D3. Hardware sizing option (engineering decision, already pending).** Redundant (three lab servers plus backup, 16 concurrent single leases, third server has headroom for a third unit) or non-redundant (one server plus backup, 8 concurrent single leases, full outage on server loss). Blocks G-hw, #504 and the ops stack design. Not blocking R1 or R3. Not a decision for this document; listed because it gates R2's second half.

**D4. Hosting the Broadcom SONiC image: licensing, not access (external answer).** Access is confirmed: the private `ghcr.io/githedgehog/sonic-bcm-private/sonic-bcm-base` image **is** pullable with a `read:packages` credential for a `githedgehog` org member (the proof's boot failed on exactly this until authenticated, then succeeded). That is access, **not permission**. The production Hot Lab host will need the same registry credential. The open content is unchanged and external: written answers from Hedgehog and Broadcom on copying among customer hosts, operating a service with anonymous viewers, giving visitors shell access, and redistribution (#490 F6). Private evaluation does not need them. Public lab exposure (G-pub) does. If the answer to anonymous-viewer hosting is no, R4 ships only as cached/replayed content and the public live lab becomes a separate question.

**D5. Approval of the read-only deployment baseline (R3).** Does the customer approve a read-only inspection of the AWS stages and of the live HubSpot objects, before any API change? Option: decline and accept that every API-touching increment (R6) stays blocked. This is a real fork because it appears to cut against "don't invest in production". I recommend approving it **[R]**; it writes nothing.

**Partly pre-answered at zero cost.** A slice of R3 has already been run: seven read-only HTTP GETs and one deliberately invalid POST. It wrote nothing, took minutes, and resolved 7.1 and P9. The cheap part has been shown harmless and valuable, which strengthens the case for approving the rest (AWS configuration, Lambda versions, HubDB counts, deployed templates).

**D7. Approve a bounded native measurement extension? (new; R1's evaluability depends on it.)** R1 cannot be judged unless its approved measurement definition (section 4) is actually measurable. Two native mechanisms are candidates and neither is yet demonstrated. This fork matters only if the first check shows neither works.
- *Option 1: confirm native mechanisms first and approve nothing more.* If neither works, R1 ships as a routing improvement evaluated by a small formative study (#492 §3). Cost: no behavioural data, and no claim of profiling.
- *Option 2: approve a bounded native extension,* limited to HubSpot-native capability and scoped and reviewed at cp3. Cost: added scope and an approval, in tension with #480's page-analytics-only position and the removal of the custom beacon.
- **No custom event system is on offer in either option.**
- *[R] Option 1 first.* Bring Option 2 back only with evidence that the native check failed and the formative study cannot answer the question. Blocks: R1's release, not its design.

**D6. Credit types and external portability.** Which attainment primitives does the customer want (for example read/watch, lab, assessment), and should credit be portable as Open Badges 3.0? Not needed until R6, and not for R1–R5. List here so it is not forgotten.

### 6.2 Defaults I will proceed with unless told otherwise

These are not decisions I am inviting; they follow from decisions already made.

1. **Anonymous for C0–C2, registered for C3 and above** (1.5).
2. **HubSpot-native analytics for experience routes** (#480).
3. **C5 stays documented only** (#502).
4. **Substrate-agnostic broker and classes**, so the hhfab/Clabernetes/Air choice can wait for the proof (#503).
5. **Gamification stays optional** (#489).

### 6.3 Not a decision now

- **Substrate choice.** Evidence-gated by the proof, not a customer fork today.
- **Procurement.** Waits on engineering (D3).

---

## 7. Where I disagree with a recorded position

Labelled as requested. None of these reopens a made decision.

**7.1. The production-is-steady premise: two resolved favourably, one mechanism still unknown (amended).** I originally flagged two gaps: whether the #461 bypass hardening is deployed, and which API stage the live site calls (#460). Read-only probes have since given evidence on both:

- **#461:** the bypass probe from #458, which once returned 200 with real data, now returns **401** on `/course/status`, `/pathway/status` and `/tasks/status`. Not exploitable.
- **#460:** all four learner-progress routes return **401** (route present, auth enforced), not 404. Resolved in the running system, though the topology is split (P9).

**Still unknown: the mechanism.** A 401 does not distinguish *code hardened* from *config disabled*. A config-only defence is one bad environment change from reopening, and deployment provenance (P3) is still unestablished. R3 remains the way to settle it, still read-only.

**This supports the customer's steer rather than qualifying it.** Production is holding steady, and the evidence says so. The residual risk is that the defence may not survive a config change, not that it is broken today.

**7.2. Fidelity versus first value for the Hot Lab.** The confirmed fidelity target (frontend fabric, dual-plane backend, storage fabric, gateway, shared services, leasable pool) is a roughly 19–21 VM unit by the #499 arithmetic. Everything in R4 (C0–C2) can run on far less, and some of it on a cached feed. I do not dispute the target. I disagree only if anyone treats the full unit as a precondition for the first visitor-facing experience. **Recommendation [R]:** the first private unit is the smallest that supports one C1/C2 story honestly; fidelity grows by adding to it. That is consistent with the confirmed prewired-fabric-first direction.

**7.3. Sequence of the held Hot Lab children.** #504 (ops stack) and #505 (workspace tier) are held behind sizing and the broker. The sequence is sensible, but C0/C1 visitor value needs neither. I would let R4 proceed on a minimal static feed while those wait, so the lab shows something before the full ops stack exists. This is a sequencing point, not a challenge to the architecture.

**7.4. "Replay is not a substitute" cuts both ways.** #489 is right that replay was not customer-accepted as a substitute for the always-on lab. By the same logic the lab is not a prerequisite for the CTA fix (#498 says so). I read the record as supporting *both* tracks starting independently, and this document is built that way. It would be an error to hold R1 until R4 exists.

---

## 8. Source index

| Topic | Source |
|---|---|
| Epic, hold, gate advancement | #478, #489 (comments 2026-09-12, 2026-09-30, 2026-11-04) |
| Infrastructure research and amendments | #490 (original, two amendments, 2026-10-20 update) |
| Leased write sessions; GitOps/LGTM/access | #493, #494 |
| UX evidence, three amendments, editorial correction | #492 |
| Authoring and visual-learning research | #495 |
| Hot Lab epic and children | #497 and #499–#505, #508, #510, #501 |
| CTA journey, walkthrough, attainment | #498 |
| Exercise classes | #502 |
| Session broker | #503 |
| Repo | `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/events-and-analytics.md`, `docs/project-management.md`, `docs/roadmap.md`, `docs/auth-and-progress.md`; `serverless.yml`; `src/sync/*`; `clean-x-hedgehog-templates/config/constants.json` |

### Limits of this document

- I read the issues through `gh issue view`. #499, #502 and #503 I read in part (their posted proposals are long; I took their summaries and verdicts, not every table). #500, #504, #505, #508 and #510 I read only as summarised in #497 and #499.
- I could not re-measure lint or build state, and I did not check the merge status of most of the 17 stale issues.
- I did not access AWS or HubSpot. Nothing here is a fresh audit of production.
