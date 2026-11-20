# Personas, paths, and what comes after an exercise

Draft for customer review. Proposes who we are writing for, how exercises chain so people keep
going, and a security track as the first fully specified path.

## The governing rule: cover the personas, never label the reader

The discovery junction (#529) deliberately asks the visitor nothing — a click shows interest,
not a role or a buying stage. That rule holds here.

Personas are a tool for deciding **what to build and what to offer next**. They are never shown
to the reader, never used to gate content, and never inferred from one click. Somebody who opens
a security exercise may be a security lead, or may be a platform owner whose board just asked
about tenant separation. The option set after each exercise should serve both without asking
which they are.

What that buys us: if the inference is wrong, nothing breaks. The reader simply sees options,
picks one, and we learn from what gets opened rather than from what we guessed.

## Proposed personas

Five, chosen because each produces genuinely different content rather than a different tone of
voice. **This set is a proposal and the customer's call** — it is the part of this document where
market knowledge beats my judgement.

| Persona | What they are measured on | The question they arrive with | Can they kill a deal? |
|---|---|---|---|
| **Platform owner** — VP Infrastructure, Head of Platform, neocloud founder-operator | Utilisation, time to revenue, headcount | "Can we run this without hiring a network team?" | They usually *start* the deal |
| **Network architect** | Does the design hold up | "Is this real EVPN, what happens when it breaks, can I see inside it?" | **Yes — most often the one who does** |
| **Security and compliance lead** | Provable separation, auditability | "How do I show a reviewer that these two tenants are apart?" | Yes, late and expensively |
| **Day-2 operator / SRE** | MTTR, change safety | "What is this like at 3am when I did not build it?" | Rarely, but they shape renewal |
| **AI platform lead** — owns the training or inference workload | Job completion, throughput | "Will the network hold my jobs back?" | They set the performance bar |

An economic buyer exists above these, but they rarely read an exercise. They read what one of
the five forwards them, which is an argument for every exercise having a shareable summary.

## How exercises chain

Each exercise ends with **three or four honest next steps**. The rules:

1. **One continues the track** the reader is already on. Momentum is the point.
2. **At least one crosses to a different track**, chosen to serve a different persona. This is
   how a security reader discovers the performance story without being asked who they are.
3. **Labels say what you will see, not who you are.** Never "For security teams". Always
   "Watch a change get reverted by the controller".
4. **Honesty labels travel with the option**, as on the junction: captured, illustrative,
   control-plane only, roadmap.
5. **No dead ends.** If a destination does not exist yet, it is not offered.

Measurement, when it exists: which option is taken, and whether the next exercise is completed.
Not "which persona is this". We do not need to know, and guessing invites the profiling the
junction was built to avoid.

## The security track

The customer's view, which I share: Hedgehog's security story is substantial and largely untold,
and it deserves the same treatment a dedicated security product would give it.

**Status discipline applies throughout.** Each exercise below is marked with what it would rest
on. Anything on the roadmap is labelled as roadmap wherever it appears, in the exercise and in
the option that leads to it. We do not let a reader believe a planned capability ships today.

| # | Exercise | The question it answers | Rests on |
|---|---|---|---|
| 1 | **Shrink the blast radius** *(built)* | What does one tenant actually cost, and where can separation silently break? | Captured VLAB config, control-plane evidence |
| 2 | **Every enforcement point, one API** | Fabric and gateway policy expressed through a single surface — what does that do for consistency? | Shipping product; needs a captured example |
| 3 | **Config that cannot drift** | Someone changes a switch by hand at 2am. What happens? | Continuous reconciliation; demonstrable in VLAB |
| 4 | **Can you prove what changed?** | A reviewer asks who changed tenant separation, when, and why. | Declared intent in git + reconciled state |
| 5 | **One place to see the whole path** | Why per-device telemetry fails at review time, and what normalised metrics across fabric, gateway and shared services change | Needs confirmation of what ships today vs roadmap |
| 6 | **The perimeter as a declared object** | NAT, security groups and external access as objects rather than per-box config | Gateway; confirm current feature set |
| 7 | **Reviewing a tenant before it ships** | A security reviewer reads 27 lines instead of six switch configs | Follows directly from exercise 1 |

Exercise 3 is the one I would build next. It is the most visceral — a reader watches a hand-made
change get reverted — it is fully demonstrable in a VLAB today with no roadmap dependency, and it
answers the objection a network architect raises in the first meeting.

**A boundary that applies to the whole track.** Per #492, configuration and replayed control-plane
operations are control-plane evidence. They show what each switch was told to be. They do not
demonstrate traffic behaviour between tenants, and no exercise in this track may imply they do.
A data-plane exercise is possible but needs separately qualified evidence, and would be honest
about being a lab result rather than a guarantee.

## Open questions for the customer

1. **Is the persona set right?** Particularly: is the network architect the most common deal-killer
   in your experience, and is there a sixth persona — procurement, or a sovereign/regulated buyer —
   that deserves its own path?
2. **Exercise 5 and 6 need a feature-status check.** What ships today versus near-term roadmap for
   gateway capabilities and cross-fabric metric normalisation? I will not write either until the
   line is clear.
3. **Is there an existing security narrative** — a whitepaper, a deck, an analyst conversation —
   that this track should align to rather than invent alongside?
