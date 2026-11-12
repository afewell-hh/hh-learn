---
title: "Shrink the blast radius: one tenant, two ways"
slug: "shrink-blast-radius-compare"
difficulty: "beginner"
estimated_minutes: 5
version: "v1.0.0"
description: "Captured from a Hedgehog VLAB: the configuration one tenant puts on a switch, beside the two objects the operator writes to cause it."
order: 900
---

## Segmenting workloads

Isolating one tenant's workloads from another's normally means touching every switch on the path.

The comparison below is **captured, not illustrated**. One `VPC` and one `VPCAttachment` were applied
to a running Hedgehog VLAB, and each switch's own running configuration was read before and after.
The left pane is the difference: what the tenant actually put on the switch. The right pane is what
the operator wrote to cause it.

<!-- hh:interactive id="tenant-old-vs-new" -->

Both counts are derived from the two files themselves, not typed into the page. Only `leaf-01` appears
on the left, because that is the one switch this tenant's server attaches to; a tenant with servers on
more leaves lands on each of them.
