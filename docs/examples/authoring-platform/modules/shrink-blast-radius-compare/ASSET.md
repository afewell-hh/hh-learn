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

## Status: captured from a real fabric

**Both panes are real.** Captured on 2026-11-09 from a Hedgehog VLAB — 1 spine, 2 SONiC VS leaves,
2 servers — on hhfab v0.51.4, fabric agent v0.144.1, SONiC 4.5.2-Enterprise_Base.

| | |
|---|---|
| **Left** | The configuration one tenant put on the switch: each switch's own running config (`sonic-cfggen -d` and `vtysh show running-config`), differenced before and after. 59 lines across 35 configuration objects and 24 lines of routing config, on one device. |
| **Right** | The `VPC` and `VPCAttachment` the operator wrote, verbatim. 27 lines. |

Both sides come from **the same run, the same fabric, the same moment**, so they correspond by
construction rather than by assertion.

### How the capture was taken, and two things that had to be got right

1. **The convergence check had a race.** Polled immediately after applying the tenant, the controller
   had not yet bumped any agent's generation, so every agent still read `lastAppliedGen == generation`
   and the loop declared success against the *old* state. The first run produced a byte-identical
   before and after. The capture now records each agent's generation *before* the apply and waits for
   one to move past its baseline before waiting for convergence, then verifies the two snapshots
   actually differ and fails loudly if they do not.
2. **The left side is counted conservatively.** Expanding each configuration object into one line per
   field would have given 76 lines instead of 35, padded with defaults nobody types
   (`BGP_GLOBALS` alone carries about 25). One line per object is used instead: no field is selected,
   dropped or reworded, so there is no editorial judgement in the count — and the number that results
   is the smaller one. Routing configuration is verbatim and already omits defaults.

### Only one device appears, and that is the honest result

The fixture this replaced implied three devices and a step called *"repeat on every other device"*.
The real capture shows **one**: `leaf-01`, the switch this tenant's server attaches to. `leaf-02` and
`spine-01` were untouched. That step was removed rather than kept as a claim the evidence does not
support. A tenant with servers on more leaves lands on each of them.

### Re-capturing

`capture.sh` and `make-panes.mjs` from the capture run are not in this repository — they drive a local
VLAB, which needs roughly 45 GB of disk and about 25 minutes to boot. Converting a fresh capture is a
data-only swap of the two files in `captures/` plus the `captured_from` dates; the validator refuses a
half-converted instance.

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
