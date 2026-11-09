# R1 discovery junction (#529)

## Read this first (for a reader with no project context)

**What this is.** A single static page, `index.html`, that gives a visitor a handful of honest routes into one subject: *what Hedgehog does for an AI network*. The site's own line is "AI needs a new network." This page is where a visitor goes to find out whether that is true for them, before installing anything and before talking to anyone.

**Why it exists.** hedgehog.cloud's most prominent call to action is a **Download** button. For most visitors, download is a dead end: they are not yet ready to install and operate anything. They want to explore first, and, in the customer's words, before talking to staff. This page gives them somewhere useful to go instead.

**What it is not.** It is not a quiz, a profile builder, or a lead-capture form. It asks the visitor nothing. It has no script, no form, no tracking and no stored state. A click shows interest, not role or buying stage, and this page does not pretend otherwise. It is a *routing* improvement, judged by the conversation script in `walkthrough.md`, not by click counts.

**Messaging frame (set by the customer 2026-11-07, refined 2026-11-09).** AI networking is the message. Hedgehog is positioned as the best at it, and the page answers the concerns that follow. Those concerns fall into two families:

1. **AI workload performance.** Does the network throttle the GPUs, and how long do jobs take to finish? Every idle or starved GPU-hour is money.
2. **Service enablement.** How quickly does the cluster become something teams and paying customers can use, and can an existing platform team run it?

SONiC is an enabler, not the message. It does not appear on the page. The first draft led with "Find out whether Hedgehog makes SONiC manageable"; that headline is withdrawn.

**The top line is deliberately general, and that is a decision, not an omission.** The customer's instruction on 2026-11-09: *"people are aware that networking is really important and makes a big difference for AI workload performance and job completion time and they are aware its really complicated and hard to get right and so I think at the highest level we should use a more generally impactful messaging and save more narrowly use case focused messaging until deeper down some path."*

So the headline and opening line state only the premise the audience already holds — the network drives performance and job completion time, and it is the hardest part to get right — and every narrower message sits on a card of its own. In particular **segmentation does not lead.** Many readers are not yet aware they need it, so leading with it loses them. It keeps its own card, under the customer's own label, and the deeper use-case split belongs further along a path where a use case can actually be inferred rather than guessed at the front door.

**What is carried over unchanged from the first draft.** Four routes, the preserved Download section, the quiet contact link, the honesty labels, and the no-profiling rule: no form, no quiz, no script, no tracking, no stored state. The headline, the opening line and every card's copy have been rewritten twice, to the frame above.

**Status.** Assembled offline for review. Not a HubSpot template, not provisioned, not published. No CMS writes. The next stage, when it comes, is an unlisted copy of the page in HubSpot. Parent #498; roadmap `docs/platform-roadmap.md` §4 R1 and §3 P1.

**Approval path.** Prototype, then the customer approves, then the customer takes it to their own team for review before moving to production. That second review is by people who have not followed this project, which is why this README explains the reasoning rather than assuming it.

## Why these four routes, and why download is kept

The routes answer the questions the customer says the audience arrives with:

| Visitor's question | Concern family | Route | Why it is there |
|---|---|---|---|
| "Will the network throttle my GPUs, and how long will jobs take?" | AI workload performance | **See the results from a GPU cloud that runs it** (primary) | This is the premise the audience already holds, so it leads. The evidence is an operator publishing figures from their own production cluster, which is the strongest thing we can honestly point at. |
| "Does this follow a design somebody else has already validated?" | AI workload performance | **See an OCP reference architecture** | An open, published blueprint is the other named source of assurance, and it answers the supply-chain and hardware-choice question too. |
| "Is this hard to keep safe and in step with my applications?" | Service enablement | **Shrink the blast radius** | Segmentation is the sharpest pain for the readers who have felt it. It does not lead, because many readers have not yet felt it. |
| "Can the team I already have run this?" | Service enablement | **Watch an operator work through a fabric** | The audience is platform and DevOps teams, not network operations. A replay lets the visitor judge the day-to-day load for themselves. |

**Download is kept, as its own labelled section.** A small number of visitors are a fit and want to install now; it works for them today and removing it would harm them. It sits apart so a button called "Download" always does what it says and never opens a menu. The page itself is reached from a differently named entry, **"Explore how it works"**.

**Contact is a quiet text link, not a card.** The customer's diagnosis is that visitors want to explore before talking to staff, so contact is available but secondary.

## What the honesty labels mean

| Label on the page | Meaning |
|---|---|
| *Illustrative example: shows configuration, not tested traffic behaviour* | The segmentation example shows what is configured. It does **not** show what traffic actually does. No claim of isolation is made. |
| *Replay of recorded steps* | The replay plays back recorded operations. It is not a live system. |
| *FarmGPU's own published figures, measured on their cluster, not here* | The figures are FarmGPU's, measured on FarmGPU's cluster and published by FarmGPU. They are not an independent benchmark of Hedgehog as a product, and this project measured nothing and restates no numbers. The page points to the owning page instead. See **Attribution** below; this label wording is binding. |

## Routes and status

| Route | Destination | Link status |
|---|---|---|
| **See the results from a GPU cloud that runs it** (primary) | `https://hedgehog.cloud/case-studies/farmgpu`, plus `/network-performance` as a secondary link | Wired. Both verified HTTP 200. |
| Shrink the blast radius | `compare` interactive, instance `shrink-blast-radius-compare` (#527) | Placeholder `#`, `pending-527-route`. Depends on #527 and the #489 gates. |
| See an OCP reference architecture | `https://hedgehog.cloud/ocp-reference-architecture-for-ai-networks` | Wired. Verified HTTP 200. |
| Watch an operator work through a fabric | Replay, PR #488. Route `/learn/experience/fabric-operator` is provisional | Placeholder `#`, `provisional-488-route`. Built, unpublished, behind `EXPERIENCE_LAB_ENABLED=false`. |
| Download | `https://hedgehog.cloud/download` | Wired. The existing route, preserved unchanged. |
| Contact | Existing contact route | Placeholder `#`, `pending-url`. No URL was supplied and none was invented. |

**Ownership.** The customer states that nobody really owns the existing site pages, so no outside owner is waited on. This page links to the existing pages and does not migrate, mirror or restyle them. Shared navigation, forms and marketing automation are untouched.

## Segmentation copy (binding)

Label **"Shrink the blast radius"**, verbatim, on its own card and **not** the leading one. Supporting copy is the customer's framing: hard on the outside and soft in the middle; cloud VPC made segmentation cheap enough to be the default; on hardware you own it is still hand work because tooling cannot keep up with application and facility change.

**Why it does not lead.** The second draft promoted this card to the top line and relabelled it "Give every team and customer their own slice of the cluster". The customer rejected that on 2026-11-09: it is a good message, but *"there are a lot of people who arent aware of the needs and benefits of segmentation"*, so leading with it loses them. The verbatim label is restored, the card is demoted to an ordinary card, and the deeper use-case split waits until a point in a path where a use case can be inferred rather than guessed at the front door.

- **Claim:** segmentation you can actually maintain. This is a tooling and operational argument that can be demonstrated.
- **Never claim:** anything provably, guaranteed or fully isolated, or any equivalent. Per #492, architecture intent and replayed control-plane operations do not demonstrate isolation. That needs separately qualified data-plane evidence, which does not exist yet. The audience's motivation is security, which makes this the easiest line to cross.
- The word "isolation" is kept out of the entry entirely, and the unit test fails if it appears. The same test now also fails on "SONiC", on a percentage or a throughput figure, and on "outperform", "fastest", "best in" and "industry-leading".

**One path, dual framing.** The entry label speaks to the larger audience who own a single network; "secure multi-tenancy" as a label was invisible to them. Multi-tenancy language lives **inside the destination**, as one application of the capability rather than the capability itself, for visitors who self-identify. It is not a second route and not on the entry.

- **Existing page to link from inside the `compare` destination:** `https://hedgehog.cloud/product/multitenancy`. #527 owns the destination, so it is not edited here.
- Suggested text for the destination:
  > If you run infrastructure for several tenants, this is the same capability applied to them: each tenant's segments are defined, changed and reviewed through the same tooling, so keeping them in step with that tenant's needs stays a routine change rather than a project. This example shows configuration, not tested traffic behaviour. [How Hedgehog approaches multi-tenancy](https://hedgehog.cloud/product/multitenancy)
- **Evidence slot, reserved.** The destination should carry a visibly **pending** slot for the R5 leased-pair evidence (allowed and blocked paths with healthy controls). Until it ships, the slot says so. Even then, control-plane evidence from a CPU/VLAB lease is not proof of data-plane isolation unless separately qualified.

## Attribution: what the performance evidence actually is

**Correction, and why this section is binding.** An earlier draft of this page credited the results to **SemiAnalysis** and labelled them *"Measured by SemiAnalysis, reported by Hedgehog."* That was wrong. The customer corrected it on 2026-11-09:

> *"our experience with semi-analysis is indirect, they do not directly evaluate networking solutions, they only evaluate neoclouds on a number of criteria, they dont specifically publish a network rating per provider. Our commentary about semi-analysis comes from FarmGPU, who had their env analyzed by semi-analyisis, but the formal published report did not say hardly anything about networking, which is fairly normal."*

So there is **no independent third-party benchmark of Hedgehog as a networking product.** SemiAnalysis rate neoclouds, not fabrics. What does exist:

1. **FarmGPU's own publications about FarmGPU's own cluster** — an NCCL all-reduce figure, a cost comparison with proprietary InfiniBand, and a deployment time. These are an operator's measurements of their own production system. That is real evidence, and it is what the page cites.
2. **JM Hands, FarmGPU's chief executive, speaking publicly** — blogs and talks — about the praise SemiAnalysis gave the Hedgehog and Celestica fabric during their review of FarmGPU's cloud. He chairs the Open Compute Project's neocloud working group, which is why the page names him: the weight here is his standing in the field, not a vendor endorsement.

**Rules that follow, enforced by the unit test:**

- The entry page **cites FarmGPU and never names SemiAnalysis.** Naming them at the front door invites exactly the misreading the customer corrected, and an entry card has no room to state the chain precisely. The test fails on "SemiAnalysis" and on "ClusterMAX".
- The label is *FarmGPU's own published figures, measured on their cluster, not here* — not "independent", not "third-party", not "benchmarked".
- No figure is restated on the entry. The test fails on any percentage or throughput number, and on *outperform*, *fastest*, *best in* and *industry-leading*.

**Flagged for the customer, about an existing live page.** `https://hedgehog.cloud/blog/industry-leading-ai-network-performance` states that SemiAnalysis "completed ClusterMAX testing" and that the Hedgehog-based clouds outperformed named InfiniBand and RoCEv2 clusters. Against the correction above, that page's framing is stronger than the chain supports. The second draft of this junction linked to it as the primary proof route; **it has been removed from the entry** rather than routing readers through our weakest attribution. That page is the customer's to review and nothing here changes it.

## What the entry deliberately does not do

No profiling questions, no custom event schema, no registration, no claim entitlements (#521 deferred), no CMS writes. It does not claim a click is a profile.

## Where measurement would go (D7 not resolved here)

Per the roadmap's R1 item 5: entry-page visits (denominator), attributable transitions per route, and no-onward-transition, with coverage limits stated. It would sit on HubSpot page analytics on the entry page, or native CTA click reporting, if the account supports it. Neither is confirmed. If neither works, R1 is a routing improvement evaluated by `walkthrough.md`. Nothing in `index.html` anticipates a mechanism.

## Not done here

- Screenshots at desktop and 320px: the sandbox has no installed dependencies and no approval to install them.
- Real hrefs for the `compare` page, the replay and contact. Their routes are not settled.
- The jest test has not been run in the sandbox (no `node_modules`).
