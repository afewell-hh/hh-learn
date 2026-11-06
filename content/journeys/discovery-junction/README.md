# R1 discovery junction (#529), offline assembly

**Status:** assembled offline for review. Not a HubSpot template, not provisioned, not published. No CMS writes. #489 checkpoints 3 to 5 are untouched. Parent #498; roadmap `docs/platform-roadmap.md` §4 R1 and §3 P1.

`index.html` is a self-contained static page: no script, no form, no network, no tracking, no state. Every destination `href` is a `#` placeholder carrying a `data-link-status`, because the real URLs belong to other owners and none was invented. `tests/unit/discovery-junction.test.ts` enforces the copy rule and the "not profiling machinery" constraint.

## The entry

| Element | Decision |
|---|---|
| Entry name (the CTA that leads here) | **"Explore how it works"**. It must not be labelled "Download". |
| Page heading | Find out whether Hedgehog makes SONiC manageable. This is the customer's open question for visitors who already want or need SONiC. |
| Questions asked of the visitor | **None.** The visitor picks a route by the question closest to theirs. No profile is inferred or stored. |
| Download | Kept as its own labelled **"Download"** section with the existing route, below the routes, with an honest fit statement. A "Download" button never serves a menu. |
| Contact | One quiet text link below the download section. Not a card and not a peer of the routes. |

## Routes

| Route | Destination | Owner | Status |
|---|---|---|---|
| **Shrink the blast radius** (primary) | `compare` interactive, instance `shrink-blast-radius-compare` (#527) | This project | Page route pending #527 and #489 gates |
| See the published performance results | Existing page | Marketing website owner **[owner to name]** | Link pending owner. Not migrated or copied |
| See an OCP reference architecture | Existing page | Marketing website / architecture docs owner **[owner to name]** | Link pending owner. Not migrated or copied |
| Watch an operator work through a fabric | Replay, PR #488 (route `/learn/experience/fabric-operator` is provisional) | This project | Built, unpublished, behind `EXPERIENCE_LAB_ENABLED=false`. Route and wording are customer-reviewable at cp3 |
| Download | Existing download route | Marketing website owner **[owner to name]** | Preserved. Not touched |
| Contact | Existing contact route | Marketing website owner **[owner to name]** | Preserved. Secondary |

**Owned elsewhere, not ours:** the performance results, the OCP reference architectures, the download route, the contact route, shared site navigation, forms and marketing automation. Nothing here migrates, mirrors or restyles them. The entry that links to them is the only new thing. Where the real link is not yet known, the placeholder stays a placeholder.

## Segmentation copy (binding)

Primary label **"Shrink the blast radius"**, verbatim. Supporting copy is the customer's framing: hard on the outside and soft in the middle; cloud VPC made segmentation cheap enough to be the default; on-prem it is still a project each time because tooling cannot keep up with application and facility change.

- **Claim:** segmentation you can actually maintain, a tooling and operational argument that can be shown.
- **Never claim:** that anything is provably, guaranteed or fully isolated, or any equivalent. Per #492, architecture intent and replayed control-plane operations do not demonstrate isolation; that needs separately qualified data-plane evidence that does not exist.
- The card carries the label "Illustrative example: shows configuration, not tested traffic behaviour". The word "isolation" is kept out of the entry entirely, and the test fails if it appears.
- **One path, dual framing.** The entry does not mention multi-tenancy. Multi-tenancy language belongs **inside the destination**, for visitors who self-identify, as one application of the capability. Suggested text for the `compare` instance (owned by #527, not edited here):
  > If you run infrastructure for several tenants, this is the same capability applied to them: each tenant's segments are defined, changed and reviewed through the same tooling, so keeping them in step with that tenant's needs stays a routine change rather than a project. This example shows configuration, not tested traffic behaviour.
- **Evidence slot, reserved.** The destination should carry a visibly **pending** slot for the R5 leased-pair evidence (allowed and blocked paths with healthy controls). Until it ships, the slot says so. Even then, control-plane evidence from a CPU/VLAB lease is not proof of data-plane isolation unless separately qualified.

## What the entry deliberately does not do

No profiling questions, no custom event schema, no registration, no claim entitlements (#521 deferred), no CMS writes. It does not claim a click is a profile.

## Where measurement would go (D7 not resolved here)

Per the roadmap's R1 item 5: entry-page visits (denominator), attributable transitions per route, and no-onward-transition, with coverage limits stated. It would sit on HubSpot page analytics on the entry page, or native CTA click reporting, if the account supports it. Neither is confirmed. If neither works, R1 is a routing improvement evaluated by `walkthrough.md`. Nothing in `index.html` anticipates a mechanism.

## Not done here

- Screenshots at desktop and 320px: the sandbox has no installed dependencies and no approval to install them. See the PR for how to produce them.
- Real hrefs for performance results, OCP architectures, download and contact. These need their owners.
