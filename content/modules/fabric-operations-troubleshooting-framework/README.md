---
title: "Systematic Troubleshooting Framework"
slug: "fabric-operations-troubleshooting-framework"
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
  - methodology
  - decision-trees
description: "Learn hypothesis-driven troubleshooting with evidence checks, decision paths, and diagnostic workflows for Hedgehog fabric operations."
order: 401
---

## Introduction

A useful troubleshooting method starts with a report, then tests what the system actually shows. The report may describe a configuration that was never submitted, a change that failed admission, an object that was deleted, or a real forwarding problem. Each calls for a different next step.

This module builds on the Pre-Support Diagnostic Checklist. It teaches you to form hypotheses, choose tests that can distinguish them, and stop when the evidence does not support a root cause. It is a **read-only framework**: no VPC or fault fixture is required, and you will not change the fabric.

### Learning objectives

After this module, you can:

1. Separate a reported symptom from observed resource and switch state.
2. Order checks from resource existence through reconciliation, operational state, telemetry and logs.
3. Explain what each check proves and what it leaves unresolved.
4. Revise hypotheses when a test contradicts the initial incident story.
5. Record a supported next action or escalation request without inventing a root cause.

### Prerequisites

You should know how to run `kubectl` on the lab VM and navigate Grafana. The released R0 VM has a running fabric, but it does not seed a student VPC for this module. Earlier courses explain VPCs, VPCAttachments and Agent generations; you do not need to preserve their objects to complete this lesson.

## Scenario: an unconfirmed VPC connectivity report

A user reports that `server-07` cannot reach a gateway in `customer-app-vpc`. They say an attachment was submitted earlier. You have no manifest, apply output or ArgoCD sync result yet.

On a fresh released R0 VM, `customer-app-vpc` and a server-07 attachment to it are absent. The actual wiring Connection is `server-07--unbundled--leaf-03`, with switch port `leaf-03/E1/3`. These facts are the starting observations, not a prearranged VLAN fault. The report is still useful: it tells you what configuration and history to request.

### The hypothesis loop

For every proposed cause, write down a test and what both possible results would mean.

| Hypothesis | First test | Interpretation |
|---|---|---|
| The requested VPC or attachment is absent | Read the named VPC and attachment list | Absence is current state. Request the manifest and submission history; it does not prove a webhook rejected it. |
| The attachment targets the wrong Connection | Compare its `.spec.connection` with `kubectl get connections` | Only test this if the attachment exists. A mismatch is a concrete configuration finding. |
| The switch has not applied the latest desired configuration | Compare Agent `APPLIEDG` and `CURRENTG` | A gap means wait and recheck. Equality means the current Agent generation applied, not that application traffic works. |
| The server port is down | Inspect the relevant Agent interface and Grafana | `oper` and counters describe operational state. They do not report configured tenant VLAN membership. |
| Routing or telemetry is unhealthy | Inspect Agent BGP state and fresh Prometheus samples | A down session needs investigation. Zero metric series is a telemetry gap, not proof all sessions are healthy. |

The most efficient next test is often the first resource check. If the reported objects are absent, a switch-port counter cannot explain why the user's desired VPC is missing.

## Read-only investigation on the released lab

Run the following as `ubuntu` on the VM. The commands use the released wiring; use the Connection lookup and substitute its result if a later image changes the topology.

```bash
kubectl get vpc customer-app-vpc -o name --ignore-not-found
kubectl get vpcattachments -o json | jq '[.items[] | select((.spec.subnet // "") | startswith("customer-app-vpc/")) | {name: .metadata.name, subnet: .spec.subnet, connection: .spec.connection}]'
kubectl get connections | grep '^server-07--'
kubectl get connection server-07--unbundled--leaf-03 -o jsonpath='{.spec.unbundled.link.switch.port}' && echo
kubectl get agents
kubectl get agent leaf-03 -o json | jq '{currentGeneration: .metadata.generation, appliedGeneration: .status.lastAppliedGen, appliedCondition: [.status.conditions[]? | select(.type == "Applied") | .status], interface: (.status.state.interfaces["E1/3"] // null)}'
```

On the released baseline, the VPC command prints nothing and the attachment query prints `[]`. The attachment filter selects `.spec.subnet` values beginning with `customer-app-vpc/`, the `vpc/subnet` reference form. The Connection lookup returns `server-07--unbundled--leaf-03` and `leaf-03/E1/3`. The port JSONPath applies to an **unbundled** Connection; if your wiring shows a different type, inspect that Connection's YAML before choosing a port. Compare `APPLIEDG` with `CURRENTG` for all seven Agents; use leaf-03's interface object for operational state. If the reported VPC exists in your lab, inspect its actual spec and attachment before deciding whether a connection mismatch is possible.

**What you can conclude:** the reported VPC and attachment are absent now on a fresh R0 VM. The Connection exists independently of any VPC. An interface reported `up` and equal Agent generations do not establish DHCP, gateway reachability, or VLAN configuration. Ask the user for the intended VPC and attachment manifests and the result of `kubectl apply` or the ArgoCD sync. An admission error can be identified from that submission result; `kubectl get` alone cannot reconstruct one.

### Add operational context when the objects exist

If an attachment is present, read its `.spec.connection` and `.spec.subnet`, then compare the Connection with the server's real wiring and the subnet with the VPC spec. For a possible forwarding fault, check the server interface and a gateway ping **from that server**, as taught in Connectivity Validation. Running `ip link` on the lab host describes the host, not the nested `server-07` VM.

Use Agent status and Grafana to inspect the relevant port. The Agent's `.status.state.interfaces` contains operational fields and counters; it has no `vlans` array in fabric v0.96.2. A quiet port or no error counter alone does not prove traffic is forwarding. When a student VPC is absent, do not expect a tenant interface or gateway to exist on the server.

For BGP context, read the Agent's `bgpNeighbors` and the **Hedgehog Fabric** dashboard. Fresh Prometheus samples may take a few minutes after boot. If a metric query returns no series, wait and repeat before treating it as a telemetry problem. In **Hedgehog Switch Interface Counters**, select the discovered switch and port; record the interface state and actual counter series. In **Hedgehog Fabric Logs**, select the switch and interpret each log line in context. Virtual switches do not provide physical temperature, fan, SFP or ASIC sensor evidence.

## Four layers of diagnosis

### 1. Desired resources and submission result

Read the VPC, VPCAttachment, Connection and ArgoCD application state. Use a recorded `kubectl apply` error or ArgoCD sync error to diagnose validation. Hedgehog fabric CRDs do not emit success or rejection Events; `Events: <none>` from `kubectl describe` is expected and proves neither success nor failure. A missing object may have never been submitted, may have failed admission, or may have been deleted.

### 2. Reconciliation and operational state

Compare Agent applied/current generations, then inspect the Agent serving the actual Connection. Equal generations show that the latest desired Agent spec was applied. The `Applied=True` condition may persist across restarts, so compare generations as well. Inspect interface `oper` and counters and BGP neighbor state. These checks describe switch state; they do not substitute for a server traffic test.

### 3. Trends and logs

Use Grafana to compare state over time, provided metrics arrived for the period you select. A fresh VM has no 24-hour history. Switch logs can suggest a hypothesis, but a generic `ERR` line is not automatically the cause of the user's report. Correlate the log timestamp, switch and operation with the reported change.

### 4. Targeted controller investigation

When a present object fails to converge or ArgoCD shows a sync problem, read a bounded controller log tail:

```bash
kubectl logs -n fab deployment/fabric-ctrl --tail=200 | grep -iE 'error|panic' || true
kubectl get pods -n fab
```

No grep matches are a valid observation. `kubectl logs --previous` is relevant only if the controller restarted. An empty log search does not establish that the user's configuration is correct.

## Decision paths

### A server cannot reach a VPC gateway

1. **Is the VPC present?** If no, ask for the manifest and submission history. Stop the switch diagnosis until the desired object is established.
2. **Is the server attached to the intended subnet and real Connection?** If no, use the actual object and wiring to identify the specific mismatch. If the attachment is absent, request its manifest and submission result.
3. **Have the affected Agents applied the current generation?** If no, wait and recheck; persistent divergence warrants controller and Agent diagnostics.
4. **Is the switch interface operational?** If no, inspect the link and server. On a physical fabric, cable or SFP checks may apply; in VLAB, use the virtual Connection and VM status.
5. **Can the server reach the gateway?** Test from the nested server with the expected VLAN and IP configuration. Only a real dataplane test can confirm that path.
6. **Still unexplained?** Check BGP, metrics and logs, then escalate with observed outputs rather than a guessed root cause.

### Cross-VPC connectivity fails

Verify both VPCs, their attachments and any VPCPeering first. Check the peering spec, Agent convergence and the actual endpoint paths. If routing is suspected, inspect BGP sessions and route evidence. A missing peering object does not by itself reveal whether it was never requested, rejected or deleted.

### GitOps says the configuration is synced, but traffic fails

Confirm the ArgoCD application revision and compare the live VPC/attachment specs with the intended files under `active/`. Then inspect Agent generations and run a server-side traffic test. “Synced” reports that ArgoCD's tracked live objects match the desired revision; it is not a forwarding or application-health test. If an object is missing, inspect the sync result before attributing it to a webhook.

## Practice: write a supported next action

For the fresh R0 observations above, write three lines:

1. **Reported:** server-07 cannot reach `customer-app-vpc`; the claimed earlier submission is unverified.
2. **Observed:** the VPC and matching attachment are absent; server-07 is physically connected to leaf-03/E1/3; record the actual Agent generation and interface state you saw.
3. **Next action:** revise the initial VLAN-fault hypothesis: without the VPC and attachment, there is no tenant VLAN for this report to inspect. Request the desired manifests and apply or ArgoCD sync result. Do not claim a VLAN conflict, automatic reassignment, switch failure or successful repair from this baseline.

If you have an actual VPC and attachment from another exercise, repeat the resource and Connection comparison with their real names. Do not create a fault for this module. The Pre-Support Diagnostic Checklist shows how to save a private evidence bundle when a real incident requires escalation.

## Key points

- Start with the desired objects and their submission result; then test reconciliation and operational state.
- `APPLIEDG == CURRENTG` is an application check. It does not prove a gateway ping or DHCP lease.
- Agent interface status and Grafana counters do not expose tenant VLAN membership in this fabric version.
- An absent object, `Events: <none>`, or an empty metric result needs context before it supports a diagnosis.
- Revise your hypothesis when evidence contradicts the initial incident story.
