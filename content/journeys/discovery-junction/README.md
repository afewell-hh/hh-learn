# R1 discovery junction (#529)

## Read this first (for a reader with no project context)

**What this is.** A single static page, `index.html`, that gives a visitor a handful of honest routes into one subject: *what Hedgehog does for an AI network*. The site's own line is "AI needs a new network." This page is where a visitor goes to find out whether that is true for them, before installing anything and before talking to anyone.

**Why it exists.** hedgehog.cloud's most prominent call to action is a **Download** button. For most visitors, download is a dead end: they are not yet ready to install and operate anything. They want to explore first, and, in the customer's words, before talking to staff. This page gives them somewhere useful to go instead.

**What it is not.** It is not a quiz, a profile builder, or a lead-capture form. It asks the visitor nothing. It has no script, no form, no tracking and no stored state. A click shows interest, not role or buying stage, and this page does not pretend otherwise. It is a *routing* improvement, judged by the conversation script in `walkthrough.md`, not by click counts.

**Messaging frame (set by the customer, 2026-11-07).** AI networking is the message. Hedgehog is positioned as the best at it, and the page answers the concerns that follow from it, which fall into two families:

1. **AI workload performance.** Does the network throttle the GPUs? Every idle or starved GPU-hour is money.
2. **Service enablement.** How quickly does the cluster become something teams and paying customers can actually use, and can an existing platform team run it?

SONiC is an enabler, not the message. It does not appear on the page. The earlier draft led with "Find out whether Hedgehog makes SONiC manageable"; that headline is withdrawn.

**What changed from the earlier draft, and what did not.** The four routes, the preserved Download section, the quiet contact link, the honesty labels and the no-profiling rule are all unchanged. The headline, the lede and every card's copy were rewritten to the frame above, and one label and one destination changed:

- The primary card was **"Shrink the blast radius"** (the customer's own verbatim words, previously recorded as binding). It is now **"Give every team and customer their own slice of the cluster"**, which names the AI-cluster outcome rather than the security mechanism. The blast-radius phrase is kept in the card body, where it still names the mechanism, and the unit test asserts both. **This is a change to copy the customer previously fixed, so it is flagged for an explicit yes or no.**
- The performance card now opens on `/blog/industry-leading-ai-network-performance`, which carries the actual SemiAnalysis ClusterMAX results, instead of `/network-performance`, which is benefit copy with no figures on it. `/network-performance` is kept as a secondary link.
- Its honesty label changed from *Published by Hedgehog, not measured here* to *Measured by SemiAnalysis, reported by Hedgehog, not measured here*. The testing is third-party; the reporting is not. The old label understated the strongest evidence on the page.

**Status.** Assembled offline for review. Not a HubSpot template, not provisioned, not published. No CMS writes. The next stage, when it comes, is an unlisted copy of the page in HubSpot. Parent #498; roadmap `docs/platform-roadmap.md` §4 R1 and §3 P1.

**Approval path.** Prototype, then the customer approves, then the customer takes it to their own team for review before moving to production. That second review is by people who have not followed this project, which is why this README explains the reasoning rather than assuming it.

## Why these four routes, and why download is kept

The routes answer the questions the customer says the audience arrives with:

| Visitor's question | Concern family | Route | Why it is there |
|---|---|---|---|
| "How do I get the next team, or the next customer, onto this cluster without it being a project?" | Service enablement | **Give every team and customer their own slice of the cluster** (primary) | Time to the next workload is time to revenue. Most networks are hard on the outside and soft in the middle, so each addition is hand work. |
| "Will the network throttle my GPUs, and is Ethernet really competitive with InfiniBand?" | AI workload performance | **See how a Hedgehog fabric measured against InfiniBand** | Independent measurement is the assurance this audience says it trusts, and it is the strongest evidence Hedgehog has. |
| "Does this follow a design somebody else has already validated?" | AI workload performance | **See an OCP reference architecture** | An open, published blueprint is the other named source of assurance, and it answers the supply-chain and hardware-choice question too. |
| "Can the team I already have run this?" | Service enablement | **Watch an operator work through a fabric** | The audience is platform and DevOps teams, not network operations. A replay lets the visitor judge the day-to-day load for themselves. |

**Download is kept, as its own labelled section.** A small number of visitors are a fit and want to install now; it works for them today and removing it would harm them. It sits apart so a button called "Download" always does what it says and never opens a menu. The page itself is reached from a differently named entry, **"Explore how it works"**.

**Contact is a quiet text link, not a card.** The customer's diagnosis is that visitors want to explore before talking to staff, so contact is available but secondary.

## What the honesty labels mean

| Label on the page | Meaning |
|---|---|
| *Illustrative example: shows configuration, not tested traffic behaviour* | The segmentation example shows what is configured. It does **not** show what traffic actually does. No claim of isolation is made. |
| *Replay of recorded steps* | The replay plays back recorded operations. It is not a live system. |
| *Measured by SemiAnalysis, reported by Hedgehog, not measured here* | The ClusterMAX testing was run by SemiAnalysis, an independent analyst firm. The write-up and the figures are Hedgehog's own, hosted on the pages that own them. This project measured nothing and restates no numbers. The page points to them instead. |

## Routes and status

| Route | Destination | Link status |
|---|---|---|
| **Give every team and customer their own slice of the cluster** (primary) | `compare` interactive, instance `shrink-blast-radius-compare` (#527) | Placeholder `#`, `pending-527-route`. Depends on #527 and the #489 gates. The instance id is unchanged; only the entry label moved. |
| See how a Hedgehog fabric measured against InfiniBand | `https://hedgehog.cloud/blog/industry-leading-ai-network-performance`, plus the FarmGPU case study and `/network-performance` | Wired. All three verified HTTP 200. |
| See an OCP reference architecture | `https://hedgehog.cloud/ocp-reference-architecture-for-ai-networks` | Wired. Verified HTTP 200. |
| Watch an operator work through a fabric | Replay, PR #488. Route `/learn/experience/fabric-operator` is provisional | Placeholder `#`, `provisional-488-route`. Built, unpublished, behind `EXPERIENCE_LAB_ENABLED=false`. |
| Download | `https://hedgehog.cloud/download` | Wired. The existing route, preserved unchanged. |
| Contact | Existing contact route | Placeholder `#`, `pending-url`. No URL was supplied and none was invented. |

**Ownership.** The customer states that nobody really owns the existing site pages, so no outside owner is waited on. This page links to the existing pages and does not migrate, mirror or restyle them. Shared navigation, forms and marketing automation are untouched.

## Segmentation copy (binding)

Primary label **"Shrink the blast radius"**, verbatim. Supporting copy is the customer's framing: hard on the outside and soft in the middle; cloud VPC made segmentation cheap enough to be the default; on-prem it is still a project each time because tooling cannot keep up with application and facility change.

- **Claim:** segmentation you can actually maintain. This is a tooling and operational argument that can be demonstrated.
- **Never claim:** anything provably, guaranteed or fully isolated, or any equivalent. Per #492, architecture intent and replayed control-plane operations do not demonstrate isolation. That needs separately qualified data-plane evidence, which does not exist yet. The audience's motivation is security, which makes this the easiest line to cross.
- The word "isolation" is kept out of the entry entirely, and the unit test fails if it appears. The same test now also fails on "SONiC", on a percentage or a throughput figure, and on "outperform", "fastest", "best in" and "industry-leading".

**One path, dual framing.** The entry label speaks to the larger audience who own a single network; "secure multi-tenancy" as a label was invisible to them. Multi-tenancy language lives **inside the destination**, as one application of the capability rather than the capability itself, for visitors who self-identify. It is not a second route and not on the entry.

- **Existing page to link from inside the `compare` destination:** `https://hedgehog.cloud/product/multitenancy`. #527 owns the destination, so it is not edited here.
- Suggested text for the destination:
  > If you run infrastructure for several tenants, this is the same capability applied to them: each tenant's segments are defined, changed and reviewed through the same tooling, so keeping them in step with that tenant's needs stays a routine change rather than a project. This example shows configuration, not tested traffic behaviour. [How Hedgehog approaches multi-tenancy](https://hedgehog.cloud/product/multitenancy)
- **Evidence slot, reserved.** The destination should carry a visibly **pending** slot for the R5 leased-pair evidence (allowed and blocked paths with healthy controls). Until it ships, the slot says so. Even then, control-plane evidence from a CPU/VLAB lease is not proof of data-plane isolation unless separately qualified.

## Performance material: cite, do not echo

SemiAnalysis ran ClusterMAX testing on B200 clusters at FarmGPU and RunPod, both on Hedgehog, alongside InfiniBand and RoCEv2 clusters. FarmGPU separately reports an NCCL all-reduce figure, a cost comparison with InfiniBand and a deployment time. These matter to the procurement-driven part of the audience, and the independent half of that is the strongest evidence on the site.

The split matters and the page states it: **the testing is third-party, the write-up and the figures are Hedgehog's.** Hence the label *Measured by SemiAnalysis, reported by Hedgehog, not measured here*. Specific figures stay on the owning pages; the unit test fails if a percentage or throughput number, or a superlative, appears on the entry. If a figure is ever quoted elsewhere, attribute it to the source page and keep it clear of any isolation wording.

**Still to verify before external use.** The internal pitch framework carries a standing note to re-confirm the ClusterMAX ranking and the Zipline cost claim before using them with customers. This page does not restate either, so it does not depend on that check, but the destinations do.

## What the entry deliberately does not do

No profiling questions, no custom event schema, no registration, no claim entitlements (#521 deferred), no CMS writes. It does not claim a click is a profile.

## Where measurement would go (D7 not resolved here)

Per the roadmap's R1 item 5: entry-page visits (denominator), attributable transitions per route, and no-onward-transition, with coverage limits stated. It would sit on HubSpot page analytics on the entry page, or native CTA click reporting, if the account supports it. Neither is confirmed. If neither works, R1 is a routing improvement evaluated by `walkthrough.md`. Nothing in `index.html` anticipates a mechanism.

## Not done here

- Screenshots at desktop and 320px: the sandbox has no installed dependencies and no approval to install them.
- Real hrefs for the `compare` page, the replay and contact. Their routes are not settled.
- The jest test has not been run in the sandbox (no `node_modules`).
