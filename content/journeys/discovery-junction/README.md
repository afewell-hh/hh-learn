# R1 discovery junction (#529)

## Read this first (for a reader with no project context)

**What this is.** A single static page, `index.html`, that gives a visitor a handful of honest routes to answer one question: *does Hedgehog make SONiC manageable?* SONiC is open-source network-switch software. Many visitors already want or need it. Their open question is whether it can be run without it becoming a burden, especially in GPU clusters.

**Why it exists.** hedgehog.cloud's most prominent call to action is a **Download** button. For most visitors, download is a dead end: they are not yet ready to install and operate anything. They want to explore first, and, in the customer's words, before talking to staff. This page gives them somewhere useful to go instead.

**What it is not.** It is not a quiz, a profile builder, or a lead-capture form. It asks the visitor nothing. It has no script, no form, no tracking and no stored state. A click shows interest, not role or buying stage, and this page does not pretend otherwise. It is a *routing* improvement, judged by the conversation script in `walkthrough.md`, not by click counts.

**Status.** Assembled offline for review. Not a HubSpot template, not provisioned, not published. No CMS writes. The next stage, when it comes, is an unlisted copy of the page in HubSpot. Parent #498; roadmap `docs/platform-roadmap.md` §4 R1 and §3 P1.

**Approval path.** Prototype, then the customer approves, then the customer takes it to their own team for review before moving to production. That second review is by people who have not followed this project, which is why this README explains the reasoning rather than assuming it.

## Why these four routes, and why download is kept

The routes answer the questions the customer says the audience arrives with:

| Visitor's question | Route | Why it is there |
|---|---|---|
| "Is this hard to keep safe and in step with my applications?" | **Shrink the blast radius** (primary) | Segmentation is the sharpest pain: most networks are hard on the outside and soft in the middle. |
| "Is there evidence this performs, and is it worth the cost or the supply-chain trouble?" | **See the published performance results** | Published results are the assurance this audience says it trusts. |
| "Does this follow an accepted design?" | **See an OCP reference architecture** | OCP reference architectures are the other named source of assurance. |
| "What is it actually like to run?" | **Watch an operator work through a fabric** | Managing SONiC directly is the daunting part. A replay lets the visitor judge the day-to-day load. |

**Download is kept, as its own labelled section.** A small number of visitors are a fit and want to install now; it works for them today and removing it would harm them. It sits apart so a button called "Download" always does what it says and never opens a menu. The page itself is reached from a differently named entry, **"Explore how it works"**.

**Contact is a quiet text link, not a card.** The customer's diagnosis is that visitors want to explore before talking to staff, so contact is available but secondary.

## What the honesty labels mean

| Label on the page | Meaning |
|---|---|
| *Illustrative example: shows configuration, not tested traffic behaviour* | The segmentation example shows what is configured. It does **not** show what traffic actually does. No claim of isolation is made. |
| *Replay of recorded steps* | The replay plays back recorded operations. It is not a live system. |
| *Published by Hedgehog, not measured here* | The performance figures are Hedgehog's own published claims, hosted on the pages that own them. This project did not measure them and does not restate the numbers. The page points to them instead. |

## Routes and status

| Route | Destination | Link status |
|---|---|---|
| **Shrink the blast radius** (primary) | `compare` interactive, instance `shrink-blast-radius-compare` (#527) | Placeholder `#`, `pending-527-route`. Depends on #527 and the #489 gates. |
| See the published performance results | `https://hedgehog.cloud/network-performance`, plus the FarmGPU case study and the results write-up | Wired. Verified HTTP 200 by the customer. |
| See an OCP reference architecture | `https://hedgehog.cloud/ocp-reference-architecture-for-ai-networks` | Wired. Verified HTTP 200. |
| Watch an operator work through a fabric | Replay, PR #488. Route `/learn/experience/fabric-operator` is provisional | Placeholder `#`, `provisional-488-route`. Built, unpublished, behind `EXPERIENCE_LAB_ENABLED=false`. |
| Download | `https://hedgehog.cloud/download` | Wired. The existing route, preserved unchanged. |
| Contact | Existing contact route | Placeholder `#`, `pending-url`. No URL was supplied and none was invented. |

**Ownership.** The customer states that nobody really owns the existing site pages, so no outside owner is waited on. This page links to the existing pages and does not migrate, mirror or restyle them. Shared navigation, forms and marketing automation are untouched.

## Segmentation copy (binding)

Primary label **"Shrink the blast radius"**, verbatim. Supporting copy is the customer's framing: hard on the outside and soft in the middle; cloud VPC made segmentation cheap enough to be the default; on-prem it is still a project each time because tooling cannot keep up with application and facility change.

- **Claim:** segmentation you can actually maintain. This is a tooling and operational argument that can be demonstrated.
- **Never claim:** anything provably, guaranteed or fully isolated, or any equivalent. Per #492, architecture intent and replayed control-plane operations do not demonstrate isolation. That needs separately qualified data-plane evidence, which does not exist yet. The audience's motivation is security, which makes this the easiest line to cross.
- The word "isolation" is kept out of the entry entirely, and the unit test fails if it appears.

**One path, dual framing.** The entry label speaks to the larger audience who own a single network; "secure multi-tenancy" as a label was invisible to them. Multi-tenancy language lives **inside the destination**, as one application of the capability rather than the capability itself, for visitors who self-identify. It is not a second route and not on the entry.

- **Existing page to link from inside the `compare` destination:** `https://hedgehog.cloud/product/multitenancy`. #527 owns the destination, so it is not edited here.
- Suggested text for the destination:
  > If you run infrastructure for several tenants, this is the same capability applied to them: each tenant's segments are defined, changed and reviewed through the same tooling, so keeping them in step with that tenant's needs stays a routine change rather than a project. This example shows configuration, not tested traffic behaviour. [How Hedgehog approaches multi-tenancy](https://hedgehog.cloud/product/multitenancy)
- **Evidence slot, reserved.** The destination should carry a visibly **pending** slot for the R5 leased-pair evidence (allowed and blocked paths with healthy controls). Until it ships, the slot says so. Even then, control-plane evidence from a CPU/VLAB lease is not proof of data-plane isolation unless separately qualified.

## Performance material: cite, do not echo

Hedgehog publishes strong results (a fabric efficiency benchmark against InfiniBand and RoCEv2 clusters, and a customer-reported cost comparison). They matter to the procurement-driven part of the audience. They are **vendor-published claims**. The page therefore describes what exists, labels it "Published by Hedgehog, not measured here", and links to the owning pages. Specific figures stay on those pages; the unit test fails if a percentage or throughput number appears on the entry. If a figure is ever quoted elsewhere, attribute it to the source page and keep it clear of any isolation wording.

## What the entry deliberately does not do

No profiling questions, no custom event schema, no registration, no claim entitlements (#521 deferred), no CMS writes. It does not claim a click is a profile.

## Where measurement would go (D7 not resolved here)

Per the roadmap's R1 item 5: entry-page visits (denominator), attributable transitions per route, and no-onward-transition, with coverage limits stated. It would sit on HubSpot page analytics on the entry page, or native CTA click reporting, if the account supports it. Neither is confirmed. If neither works, R1 is a routing improvement evaluated by `walkthrough.md`. Nothing in `index.html` anticipates a mechanism.

## Not done here

- Screenshots at desktop and 320px: the sandbox has no installed dependencies and no approval to install them.
- Real hrefs for the `compare` page, the replay and contact. Their routes are not settled.
- The jest test has not been run in the sandbox (no `node_modules`).
