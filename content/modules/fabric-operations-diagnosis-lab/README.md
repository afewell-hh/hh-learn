---
title: "Hands-On Fabric Diagnosis Lab"
slug: "fabric-operations-diagnosis-lab"
difficulty: "intermediate"
estimated_minutes: 15
version: "v1.1.0"
validated_on: "2026-11-19"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - troubleshooting
  - diagnostics
  - hands-on
  - lab
description: "Practice hypothesis-driven diagnosis on a read-only fabric baseline, separating reported symptoms from observed state and documenting the next supported action."
order: 402
---

## Introduction

In the Troubleshooting Framework module, you learned to test a reported symptom against observed resources before naming a root cause. This lab lets you practice that method on a fresh released R0 VM. It uses the real fabric baseline and creates no VPC, attachment, conflict or repair.

A developer reports that `server-07` cannot reach `customer-app-vpc` and says an attachment was submitted. The ticket does not include the manifest, `kubectl apply` output, ArgoCD sync result or a server-side ping. Your task is to find what the lab currently shows and write the next supported action. A report is a starting hypothesis, not a verified incident state.

### Learning objectives

By the end of this lab, you can:

1. Classify reported, observed and unknown facts.
2. Use read-only VPC, VPCAttachment, Connection and Agent checks in a useful order.
3. Distinguish Agent generation convergence from server connectivity.
4. Interpret Grafana interface and log views without inventing VLAN data.
5. Document a supported next action and the evidence needed for a deeper diagnosis.

### Prerequisites

Know the read-only checks from Course 4.1 and have `kubectl` configured as `ubuntu` on the lab VM. Use your browser for Grafana at `http://YOUR_VM_IP:3000`. This module has **no VPC or VPCAttachment prerequisite**. It also works after the earlier decommission lesson removes `webapp-prod`.

## Incident claim audit

The user's story includes several possible explanations: the desired VPC may be absent, an attachment may reference the wrong Connection, the latest Agent generation may be pending, or a real forwarding fault may exist. A VLAN conflict is only a hypothesis until the relevant objects and submission result support it.

The released R0 wiring connects server-07 to `leaf-03/E1/3` through `server-07--unbundled--leaf-03`. The VM does **not** seed `customer-app-vpc`, its attachment, or the fictional `existing-vpc-prod`. The pinned fabric v0.96.2 does not silently move a manually chosen VLAN 1025 to 1020, and `.status.state.interfaces` has no `vlans` field. Do not build the old incident story into the lab as a fixture.

### Task 1: Check the reported resources and real wiring

Run these commands as `ubuntu` on the lab VM:

```bash
kubectl get vpc customer-app-vpc -o name --ignore-not-found
kubectl get vpcattachments -o json | jq '[.items[] | select((.spec.subnet // "") | startswith("customer-app-vpc/")) | {name: .metadata.name, subnet: .spec.subnet, connection: .spec.connection}]'
kubectl get connections | grep '^server-07--'
kubectl get connection server-07--unbundled--leaf-03 -o jsonpath='{.spec.unbundled.link.switch.port}' && echo
```

On a fresh released VM, the first command prints nothing, the attachment query prints `[]`, and the Connection reports `leaf-03/E1/3`. The attachment filter uses the `vpc/subnet` form of `.spec.subnet`. If your wiring differs, inspect the discovered Connection's YAML and use its actual switch port. A Connection describes wiring independently of any tenant VPC.

**Record:** VPC absent now; no matching attachment now; server-07 wiring exists. Do not write “webhook rejected the VPC” from these reads. The configuration might never have been submitted, might have been rejected at apply time, or might have been deleted later. The submission result is still unknown.

### Task 2: Check reconciliation and the switch port

```bash
kubectl get agents
kubectl get agent leaf-03 -o json | jq '{currentGeneration: .metadata.generation, appliedGeneration: .status.lastAppliedGen, appliedCondition: [.status.conditions[]? | select(.type == "Applied") | .status], interface: (.status.state.interfaces["E1/3"] // null)}'
```

Compare `APPLIEDG` and `CURRENTG` for all Agents. Equal values mean each Agent applied its current desired generation. In this released fabric, an `Applied=True` condition can persist across a restart, so compare generations too. The interface object shows operational state and counters; it does **not** show tenant VLAN membership. An operational port does not prove DHCP or gateway reachability for an absent VPC.

If the generations differ, wait and repeat the check before classifying it as persistent divergence. If Task 1 found a different switch or port, substitute those values in the second command.

### Task 3: Review telemetry without inventing a fault

Open **Hedgehog Switch Interface Counters** in Grafana (admin/admin), select Switch `leaf-03` and Interface `E1/3`, and record the visible state and input/output series. Open **Hedgehog Fabric** for BGP context. In **Hedgehog Fabric Logs**, select `leaf-03` and record any relevant entries with their timestamps. A generic log error or an empty chart is not, by itself, the cause of this VPC report. Switch metrics may take a few minutes to appear after a fresh boot; wait and retry if the port is missing from the selector at first.

On the released-image validation clone, E1/3 appeared Up with input/output series after telemetry settled, and the BGP query returned live series. Those observations describe that clone at that time. They do not establish a server-07 tenant gateway ping, a DHCP lease, or a configured tenant VLAN.

### Task 4: Revise the hypothesis and write the handoff

Complete this table from your own command output:

| Claim | Your class | Evidence or missing test |
|---|---|---|
| “server-07 cannot reach the proposed VPC gateway” | ___ | ___ |
| `customer-app-vpc` is absent now | ___ | ___ |
| A server-07 VPCAttachment to that VPC is absent now | ___ | ___ |
| The webhook rejected the submission | ___ | ___ |
| VLAN 1025 was silently reassigned to 1020 | ___ | ___ |
| The relevant Agent applied its latest generation | ___ | ___ |

**Self-check after completing it:** The gateway symptom is reported, while the absent VPC and attachment are observed on a fresh VM. The webhook outcome is unknown without submission history. Automatic 1025→1020 reassignment is unsupported by this fabric. Classify Agent application from the current generation comparison, not from the condition alone.

Write a short handoff with **reported symptom**, **observed facts**, **unknown submission history**, and **next action**. On the fresh baseline, the next action is to request the intended VPC and attachment manifests plus the apply or ArgoCD sync result. A real forwarding diagnosis begins only after the desired objects exist. If the objects do exist in your lab, compare their actual subnet/Connection fields, then run a server-side gateway test before naming a dataplane cause.

**Lab success:** You ran the read-only checks, reviewed the actual dashboard views, and documented a supported next action. You did not create a fault, modify fabric objects or claim a repair.

## How to test a VLAN-conflict claim

A server expecting one VLAN while its VPC configuration requests another is a possible incident hypothesis. Test it against real objects and submission output. On the released R0 baseline, neither `customer-app-vpc` nor `existing-vpc-prod` is present; 10.20.10.0/24 is outside this image's default IPv4Namespace; and fabric v0.96.2 does not expose an interface `.vlans` status field or silently reassign a conflicting manually chosen VLAN. Those facts cannot confirm a VLAN-conflict root cause for this report.

When a real attachment exists, compare its subnet and Connection fields with the VPC and wiring specs. Use Agent generations for applied desired state, interface status and Grafana for operational context, and a server-side test for the dataplane. If a validation error occurred, use the recorded apply or ArgoCD sync output. The Pre-Support Diagnostic Checklist shows how to package evidence privately for support.

## Assessment preparation

The graded quiz asks what each observation proves and which test should come next. It does not require a seeded VPC or a destructive repair. Before taking it, check that you can explain:

- Why an absent object does not identify the reason for its absence.
- What `APPLIEDG == CURRENTG` establishes and what it does not.
- Why `.status.state.interfaces["E1/3"].vlans` cannot diagnose this fabric version.
- Which evidence is needed before calling a VLAN conflict, DHCP failure or webhook rejection a root cause.

The lab attestation confirms that you performed the read-only investigation and wrote the handoff. It is separate from the graded quiz.
