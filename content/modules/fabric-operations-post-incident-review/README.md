---
title: "Post-Incident Review"
slug: "fabric-operations-post-incident-review"
difficulty: "intermediate"
estimated_minutes: 20
version: "v1.1.0"
validated_on: "2026-11-19"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - post-incident
  - review
  - continuous-improvement
  - sre
  - blameless-culture
description: "Write an evidence-based, blameless review that separates a reported symptom from observed lab results and unresolved causes."
order: 404
---

## Introduction

A post-incident review (PIR) records what was observed, what remains unknown, and what a team will improve. A useful review does not need to invent a root cause. In this lab, you will draft a **preliminary review** from the reported server-07 connectivity issue in Diagnosis Lab and, if available, your controlled GitOps rollback in Rollback & Recovery.

The released R0 lab does **not** contain the old `customer-app-vpc` incident fixture. The previous story that a VLAN changed from 1025 to 1020, that VLANs 1020–1029 are reserved, and that support restored connectivity with VLAN 1030 was not observed. No outage, support response or server recovery was proven by these lessons. Treat those claims as discarded examples, not evidence for your review.

### Learning objectives

After this module, you can:

1. Build a timeline from actual observations and label reported symptoms separately.
2. Distinguish an evidence gap or hypothesis from a confirmed root cause.
3. Write specific, measurable improvement actions with owners and due dates.
4. Explain what further evidence would be needed to close a real incident review.

## Evidence you may use

If you completed Diagnosis Lab (4.2), use your local evidence report. It should distinguish the **reported** server-07 symptom from the VPC, attachment, Connection, Agent and Grafana observations. If you completed Rollback & Recovery (4.3), add your own creation and revert commit hashes, the practice VPC UID, ArgoCD's exact synced revisions and the VPC's final absence. That rollback was a controlled exercise on an unattached VPC; it was not a repair of the reported server-07 issue.

Neither prior module is required. On a fresh released R0 VM, run this short read-only check as `ubuntu` and record the time in UTC:

```bash
set -o pipefail
date -u +'%Y-%m-%dT%H:%M:%SZ'
kubectl config current-context
kubectl get vpc customer-app-vpc -o name --ignore-not-found
kubectl get vpcattachments -o json | jq '[.items[] | select((.spec.subnet // "") | startswith("customer-app-vpc/")) | .metadata.name]'
kubectl get connections -o json | jq '[.items[] | select(.metadata.name | startswith("server-07--")) | .metadata.name]'
kubectl get agents
```

On the released R0 baseline, context `vlab` is expected, the named VPC is absent, the attachment search is empty, and the Connection lookup identifies the actual server-07 wiring. `set -o pipefail` keeps a failed `kubectl` read from being hidden by `jq`. Record the values you see rather than copying an old port name. A missing object at collection time does **not** show whether a request was submitted, rejected or later deleted. If a command fails, record the error and stop drawing conclusions from its missing output.

If you have no 4.3 record, use this **illustrative** rollback record only to practice the review format: "A learner pushed a creation commit, observed a VPC UID, pushed a revert commit, then saw ArgoCD Synced at the revert revision and the VPC absent." It provides no hash, timestamp, outage or proof about your VM. Mark it as a sample in your worksheet.

## Lab: write a preliminary review

Create a local file such as `post-incident-review.md`. Do not push it to the teaching GitOps repository or attach logs that contain credentials. Include the following sections.

### 1. Scope and status

Use a title such as **Reported server-07 connectivity issue: evidence review**. State the collection time, lab image or version if known, and your evidence sources. Label the case **unverified** unless you have a real failed connectivity test, its intended VPC/attachment manifests, and the submission or sync result. The sample 4.3 rollback is a separate controlled check.

### 2. Timeline

Use only timestamps you actually recorded. A compact table works:

| Time (UTC) | Event or check | Evidence | Classification |
| --- | --- | --- | --- |
| Your collection time | Named VPC and attachment lookup | Command output or local report | Observed |
| Your collection time | Actual server-07 Connection and Agent check | Command output or local report | Observed |
| If available | Practice VPC create, revert and final prune | Your Git hashes, VPC UID and Argo revision | Controlled exercise |

Write **time unknown** for a reported event without a timestamp. Do not insert the old 10:00–14:20 sequence, a fabricated support reply, or a made-up time to detect or restore. A timeline of observations is useful even when the incident itself cannot yet be reconstructed.

### 3. What happened, and what remains unknown

Separate three kinds of statement:

- **Reported:** someone says server-07 could not reach a VPC gateway. This is a claim until a relevant test and intended configuration are provided.
- **Observed:** the named VPC and attachment are absent at collection time; the real Connection and Agent states are whatever your commands returned. If you used 4.3, ArgoCD created and pruned your unattached practice VPC at your recorded revisions.
- **Unknown:** whether the reported VPC was submitted, what admission or ArgoCD returned, whether server-07 actually lost connectivity, when any symptom began or ended, and what caused it.

Do not call a VLAN conflict, webhook rejection, switch misconfiguration or successful service recovery a finding without evidence. The pinned Fabric release does not silently reassign the claimed VLAN in the old story.

### 4. Contributing factors and causal questions

The "5 Whys" method can organize questions, but a chain of guesses is not a root cause. Start with the first unverified claim, then list what would answer it:

1. What destination and source were tested, and what exact command failed? Request the command, output and time.
2. What VPC and attachment were intended? Request their YAML and the `kubectl apply` or ArgoCD sync result.
3. Did the objects exist at the reported time? Request revision history and time-stamped object or controller evidence.
4. If objects existed, did Agents converge and did a gateway or server test fail? Collect the relevant Agent, interface and dataplane evidence.
5. Only after those answers, identify a confirmed technical or process cause and its contributing conditions.

For this lab, a defensible process **hypothesis** is that a report without submission history slows diagnosis. The current checks do not prove why that history was missing or that it caused an outage.

### 5. Improvement actions

Write two or three actions, each with an owner, due date and a measurable completion check. Choose from gaps your review actually found. Examples:

| Action | Owner and due date | Completion check |
| --- | --- | --- |
| Add a support intake checklist requiring the intended VPC/attachment YAML, submission or sync result, source/destination test and UTC time | Assign a real owner and date | Next practice report contains all four fields or explicitly marks each unavailable |
| Add a GitOps rollback checklist that records creation and revert hashes, ArgoCD synced revision, and final resource state | Assign a real owner and date | Next controlled revert records both revisions and proves the object is absent |
| Add a post-change Agent convergence check for exercises that actually attach servers | Assign a real owner and date | Next attachment exercise records APPLIEDG = CURRENTG on affected Agents after create and delete |

These actions improve evidence and verification. Do not document VLANs 1020–1029 as reserved, request a fix for an unproven automatic VLAN reassignment, or claim the controlled revert restored traffic.

### 6. Communication and closure

Write a two-sentence status update for a learner or support engineer: what you observed, what remains unknown, and the next evidence you need. Then mark the review **preliminary / awaiting incident evidence**. A real PIR can be closed only after the symptom, timeline, impact, cause, recovery and follow-up owners have been checked. The 4.3 exercise can be marked complete separately when its create/revert/prune evidence is present.

Review your worksheet for credentials and unsupported claims before sharing it. The lab attestation means you wrote this local evidence review; it does not certify that an outage was resolved or that a root cause was found.

## Assessment preparation

The quiz checks blameless language, the difference between observed absence and inferred cause, a measurable improvement action, and how to respond to a repeated pattern **if** verified PIRs establish one. The lab attestation records your worksheet. No cloud mutation is required for this module.
