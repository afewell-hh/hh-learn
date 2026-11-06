---
title: "Shrink the blast radius: one tenant, two ways"
slug: "shrink-blast-radius-compare"
difficulty: "beginner"
estimated_minutes: 5
version: "v0.1.0"
description: "FIXTURE instance of the compare primitive: the per-switch SONiC configuration for a tenant beside the Hedgehog VPC that produces it."
order: 900
---

> FIXTURE module, unpublished. It exists to exercise the `compare` renderer (issue #525). Both
> capture files are marked `# @fixture` and are NOT real captures. To ship the real instance,
> replace `captures/tenant-sonic.txt` and `captures/tenant-vpc.yaml` with the VLAB captures, then in
> `interactives.json` set each side to `provenance: "captured"` with `captured_from`, remove
> `fixture` and `illustrative_reason`, set `source_label` to `captured`, and re-point the `steps`
> line ranges. No renderer or template change is needed; the validator refuses a half-converted file.

## Segmenting workloads

Isolating one tenant's workloads from another's normally means touching every switch on the path.

<!-- hh:interactive id="tenant-old-vs-new" -->

The comparison above is counted from the two files themselves, not from numbers typed into the page.
