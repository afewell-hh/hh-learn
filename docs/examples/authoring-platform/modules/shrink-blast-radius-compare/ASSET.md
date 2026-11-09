# `shrink-blast-radius-compare` — the asset, and where it can go

`README.md` in this directory is the **module content**: what a reader sees, with the frontmatter
and the `<!-- hh:interactive -->` placement marker the validator requires. This file is about the
**asset itself** — what it is, how it is built, and why it is not tied to any one placement.

## What it is

One interactive that sets **the configuration an operator writes by hand, per device** beside
**the Hedgehog objects that produce the same outcome**, and steps a reader through both at once:
define the tenant network, attach a server, repeat on every other device.

It renders two ways from one declaration:

| Target | Built by | Where it runs |
|---|---|---|
| HubSpot CMS | `clean-x-hedgehog-templates/learn/macros/compare.html` | A CMS template that passes it the payload |
| Standalone HTML | `scripts/build-compare-standalone.mjs` | Anywhere: a local file, localhost, an embed, a doc, a deck |

Both consume the **same payload** from `scripts/build-compare-payload.mjs`, rendered by the **same**
`compare.js` and styled by the **same** `interactive.css`. There is no second copy of the look, the
integrity rules or the count derivation, so the two targets cannot drift apart or disagree about
whether a pane is honestly labelled. `tests/unit/compare-standalone.test.ts` asserts the inlined
renderer and stylesheet are byte-identical to the files HubSpot serves.

```bash
# the portable asset: one file, no network
node scripts/build-compare-standalone.mjs \
  docs/examples/authoring-platform/modules/shrink-blast-radius-compare \
  tenant-old-vs-new -o compare.html
```

## Positioning: a suggestion, not a constraint

The suggested placement is the **R1 discovery junction** (`content/journeys/discovery-junction`),
as the destination of its *Shrink the blast radius* route — part of giving the site's Download
button a useful alternative for visitors who are not ready to install.

**That is a recommendation, and the asset does not depend on it.** Customer direction, 2026-11-09:
the technical assets are the valuable part, the website may be revised, and the broader team may
see different or additional value in them. So the asset is built to be repositionable:

- **No placement is hard-coded.** Nothing in the declaration, the payload or either renderer knows
  about the junction, the Download button, or any page.
- **No host dependency.** The standalone build needs no CMS, no server, no build step at the point
  of use, and no network. `build-compare-standalone.mjs` scans its own output and refuses to write
  a file with a single off-box reference in it.
- **It carries its own context.** Title, caption, provenance labels, the evidence-plane pill and
  the counts-derivation note all travel inside the component, so a reader meeting it cold still
  sees what the material is and what it does not show.
- **No tracking.** It makes no request of any kind and records nothing. The only event it emits is
  a local DOM `CustomEvent` a host page may listen for, or ignore.

Uses it already supports with no modification: embedded in docs, attached to a sales conversation,
shown in a talk, dropped into a blog post, or used as a reviewable artifact in a design discussion.
If the team wants it somewhere nobody has thought of, that should cost a file copy, not a rebuild.

## Status: the renderer is real, the data is not

**The component is finished. The content is a fixture and is labelled as one, loudly.** Both panes
declare `"fixture": true` with an `illustrative_reason`, `source_label` is `illustrative`, and the
renderer shows a *Fixture data* pill plus: *"Fixture: this content was written to exercise the
component. It is not configuration captured from a real system and must not be quoted as evidence."*

Replacing it is a **data-only swap** — see the conversion note at the top of `README.md` for the
exact steps. Both captures come from **one VLAB run**: the configuration is generated from a wiring
diagram, so a single run produces both sides and they are guaranteed to correspond. That run has
not happened; it needs a VM, which is gated. `tests/unit/compare.test.ts` already exercises the
captured variant, so the swap is covered before the data exists.

## What it does and does not claim

- **Claims:** segmentation you can actually maintain. An authoring-effort and operational argument,
  which configuration can demonstrate.
- **Counts are derived, never authored.** `compare.js` computes lines written and devices configured
  by hand from the source text; a declaration cannot assert a number. "Devices configured by hand"
  counts `# @device` sections with real configuration under them, so `0` means *nobody typed it*,
  not *no device is configured*.
- **Never claims** anything provable, guaranteed or isolated. Per #492, configuration and replayed
  control-plane operations are **control-plane evidence** and do not demonstrate data-plane
  behaviour. `evidence_plane` may be `control-plane` or `none`; the validator rejects `data-plane`.
- **Fewer lines is not a performance, correctness or cost claim,** and the component says so in the
  panel beneath the counts.
