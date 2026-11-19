---
title: "Events & Status Monitoring"
slug: "fabric-operations-events-status"
difficulty: "intermediate"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - kubernetes
  - events
  - troubleshooting
  - observability
description: "Monitor fabric health using admission webhook validation, Agent CRD generation tracking, and Grafana metrics for complete troubleshooting visibility."
order: 303
---

# Events & Status Monitoring

## Introduction

In Module 3.2, you learned to interpret Grafana dashboards—answering questions like "Are BGP sessions up?" and "Are there interface errors?"

Dashboards show **what** is happening (metrics over time).

But when something goes wrong, you need to know **why** it's happening.

That's where **admission webhook errors and Agent CRD status** come in—they provide:
- **Validation errors at apply time:** "admission webhook denied the request: VPC has attachments"
- **Reconciliation tracking:** APPLIEDG == CURRENTG means config is fully applied
- **Switch state details:** BGP neighbor state, interface status, platform health

> **Note:** Hedgehog fabric controllers (VPC, VPCAttachment) do **not** emit Kubernetes events. `kubectl describe vpc` will show `Events: <none>`. Instead, validation errors surface immediately via admission webhooks at `kubectl apply` time, and reconciliation progress is tracked via Agent CRD generation counters.

### The Troubleshooting Question

A user reports: "My server can't reach the VPC."

**Grafana may tell you:**
- Whether interface metrics are present
- Interface state and traffic counters, when available

**But that's not enough. You need to know:**
- Does the requested VPC or VPCAttachment exist? *(Kubernetes object reads)*
- Which switch port serves the server? *(Connection CRD)*
- Did the current Agent generation apply? *(APPLIEDG == CURRENTG)*
- Was there a configuration error when a change was submitted? *(admission webhook output)*

### What You'll Learn

- How admission webhook validation works for fabric resources
- How to interpret Agent CRD status fields and generation counters
- How to track VPC lifecycle using Agent CRD and admission webhook errors
- Common error patterns and their meanings
- How to correlate kubectl data with Grafana metrics

### The Integration

```
Grafana:    Observe interface state and counters
                        ↓
kubectl get: Confirm VPC, attachment, and Connection objects
kubectl apply: Admission error, if a change was submitted and rejected
kubectl get agents: Compare APPLIEDG and CURRENTG
                        ↓
Agent CRD:  Interface operational state and generation counters
                        ↓
Conclusion: State only what the observed evidence supports
```

This module teaches you to use kubectl and Grafana **together** for complete observability.

**The Complete Observability Picture:**

Grafana dashboards are powerful—they show you metrics, trends, and anomalies. But they can't show you why a VPC failed to create or why a VPCAttachment didn't configure a VLAN. That requires understanding admission webhook errors and the Agent CRD.

Think of it this way:
- **Grafana** = Your speedometer and dashboard lights (symptoms)
- **Admission webhooks** = Your engine error codes (validation failures at apply time)
- **Agent CRD** = Your engine control unit data (exact switch state and reconciliation status)

In production operations, use these sources together. Start with the reported symptom, establish which desired objects exist, use any apply-time webhook output and Agent CRD state to diagnose, and verify a later fix with the appropriate object and metrics checks.

**Why This Matters:**

Modern fabric operations require correlation across multiple data sources. A single data source rarely tells the complete story. Learning to seamlessly move between Grafana, admission webhook errors, and Agent CRD queries will make you significantly more effective at troubleshooting and will prepare you for the diagnostic collection workflow in Module 3.4.

## Learning Objectives

By the end of this module, you will be able to:

1. **Identify admission webhook errors** - Recognize validation failures at `kubectl apply` time
2. **Interpret Agent CRD status** - Read switch operational state from Agent CRD status fields
3. **Track VPC lifecycle** - Follow VPC creation, attachment, and deletion using Agent CRD generation counters
4. **Identify error patterns** - Recognize common failure modes (VLAN conflicts, subnet overlaps, missing connections)
5. **Correlate kubectl and Grafana** - Cross-reference Agent CRD data with Grafana metrics for complete troubleshooting picture
6. **Apply integrated troubleshooting** - Use Agent CRD, admission webhook output, and Grafana dashboards together

## Prerequisites

- Module 3.1 completion (Fabric Telemetry Overview)
- Module 3.2 completion (Dashboard Interpretation)
- Module 1.3 completion (kubectl basics from Course 1)
- Understanding of Kubernetes events
- Familiarity with VPC and VPCAttachment resources

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center?hsLang=en-us) module first — it takes about 20 minutes and only needs to be done once.

## Scenario: Investigate a DHCP request on the released lab

A user says `server-03` cannot get an address from `testapp-vpc`. Your first job is to establish what was actually requested and applied. The released R0 VM does not seed `testapp-vpc` or a server-03 VPCAttachment, so this exercise uses the real, read-only baseline. It works on a fresh VM and after the earlier VPC decommission lesson. Do not create a fault, VPC, or attachment for this module.

**Environment access:** `kubectl` runs as `ubuntu` on the lab VM in the default `vlab` context. Open Grafana at `http://YOUR_VM_IP:3000` in your own browser.

### Task 1: Find server-03's actual switch port

Run these commands on the lab VM:

```bash
kubectl get connections | grep '^server-03--'
kubectl get connection server-03--unbundled--leaf-01 -o jsonpath='{.spec.unbundled.link.switch.port}' && echo
```

The released wiring maps `server-03/enp2s1` to `leaf-01/E1/7`. The first command is the lookup; if your lab shows another connection, use its actual name and switch port in the remaining steps. A Connection describes cabling. It does not establish that the server has a VPC attachment.

### Task 2: Check whether the requested VPC and attachment exist

```bash
kubectl get vpc testapp-vpc -o name --ignore-not-found
kubectl get vpcattachments -o json | jq '[.items[] | select(.spec.subnet | startswith("testapp-vpc/")) | {name: .metadata.name, subnet: .spec.subnet, connection: .spec.connection}]'
```

On a fresh released R0 VM, the first command prints nothing and the second prints `[]`. These observations mean the requested VPC and attachment are absent. They do **not** prove why: nobody may have submitted them, they may have been deleted, or an earlier apply may have failed. An admission webhook error appears at `kubectl apply` time; Kubernetes Events do not reconstruct one after the fact for these fabric resources. If your lab has different objects, record the actual names and inspect their specs instead of treating the baseline output as a fault.

### Task 3: Inspect the relevant Agent's applied state

```bash
kubectl get agents
kubectl get agent leaf-01 -o json | jq '{currentGeneration: .metadata.generation, appliedGeneration: .status.lastAppliedGen, appliedCondition: [.status.conditions[]? | select(.type == "Applied") | .status], interface: .status.state.interfaces["E1/7"]}'
```

Compare `APPLIEDG` and `CURRENTG` for leaf-01 and the other switches. Equal generations mean the current desired Agent configuration has been applied; a prior `Applied=True` condition alone does not prove that. The interface object shows operational state and counters. It does not list VLAN membership. With no server-03 VPCAttachment, do not infer that a tenant VLAN or DHCP service should be present on that port.

### Task 4: Compare the switch view with Grafana

Open **Hedgehog Switch Interface Counters** in Grafana. Set the **Switch** variable to `leaf-01` and the **Interface** variable to `E1/7`. Record the interface state and any counters or traffic series that the dashboard actually displays. A quiet port on a lab with no tenant attachment is not, by itself, evidence of a switch or DHCP fault. Grafana does not prove that a VPC, VPCAttachment, or VLAN was accepted; use the Kubernetes objects and Agent generations for those questions.

### Task 5: State the diagnosis and next action

For the fresh R0 baseline, the supported diagnosis is: the reported `testapp-vpc` is currently absent and `server-03` has no attachment to it. The physical Connection exists, but it cannot supply DHCP for an absent VPC. The submission history is unknown, so record the missing desired objects and hand the request to the VPC provisioning workflow from Course 2. Do not claim an admission rejection, switch failure, VLAN conflict, or successful repair without evidence. This module makes no changes, so it has no cleanup step.

If your lab already has a `testapp-vpc` and a server-03 attachment, compare their actual specs with the Connection, check the relevant Agent generations, and investigate the observed interface state. The printed fresh-baseline diagnosis no longer applies in that case.

### Lab Summary

You used real lab objects to separate physical wiring, desired VPC configuration, applied Agent state, and interface metrics. The key lesson is to check whether the requested VPC and attachment exist before diagnosing DHCP or switch behavior. Admission errors are visible when a change is submitted; Agent generation counters show application of accepted desired state; Grafana shows observed switch metrics.

## Concepts & Deep Dive

### Concept 1: Kubernetes Events and Hedgehog Fabric

**What Are Kubernetes Events?**

Events are timestamped records of actions taken by Kubernetes controllers. Standard Kubernetes components
(pods, deployments, services) emit events you can see with `kubectl get events`.

**Hedgehog Fabric CRDs Do NOT Emit Kubernetes Events**

> **Important:** Hedgehog fabric controllers (VPC, VPCAttachment, Switch, Connection) do **not** emit
> Kubernetes events during reconciliation. If you run `kubectl describe vpc test-vpc`, you will see:
> ```
> Events:  <none>
> ```
> This is expected behavior — not a bug or missing data.

**What to Use Instead**

Hedgehog fabric provides two mechanisms for operational feedback:

**1. Admission Webhook Validation (at apply time)**

When you `kubectl apply` a VPC or VPCAttachment, the admission webhook validates the spec immediately.
If there is a conflict or invalid spec, the error is returned synchronously:

```bash
kubectl apply -f myvpc.yaml
# Error from server (Forbidden): error when applying patch to:
# Resource: "wiring.githedgehog.com/v1beta1, Resource=vpcs"
# admission webhook "vvpc.kb.io" denied the request: <reason>
```

This is how you learn about VLAN conflicts, subnet overlaps, invalid CIDRs, and other validation errors —
**at apply time**, not after polling for events.

**2. Agent CRD Generation Counters (reconciliation status)**

After a resource is applied successfully, reconciliation happens asynchronously. Monitor convergence via:

```bash
kubectl get agents
```

```
NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION
leaf-01    server-leaf   VS-01 MCLAG 1   2m        12         12         v0.96.2
leaf-05    server-leaf   VS-05           1m        11         11         v0.96.2
```

- **APPLIEDG == CURRENTG:** Config fully applied to this switch
- **APPLIEDG < CURRENTG:** Reconciliation in progress (wait and retry)

**Kubernetes Events That DO Work in Hedgehog**

Standard K8s system events (for pods, deployments, etc. in the `fab` namespace) are available:

```bash
# System events for pods and deployments
kubectl get events -n fab --sort-by='.lastTimestamp'

# All namespaces (system events only)
kubectl get events --all-namespaces --sort-by='.lastTimestamp'
```

These show events like pod scheduling, container restarts, etc. — but NOT fabric CRD reconciliation.

**Summary: The Right Tool for Each Question**

| Question | Tool |
|----------|------|
| Did VPC spec pass validation? | Check for admission webhook error at `kubectl apply` |
| Is reconciliation complete? | `kubectl get agents` — APPLIEDG == CURRENTG? |
| What is the exact switch state? | `kubectl get agent leaf-01 -o json \| jq ...` |
| Are there pod/deployment issues? | `kubectl get events -n fab` |
| Why is traffic 0? | Combine Grafana + Agent CRD interface status |

### Concept 2: Agent CRD Status - Switch State

**What is Agent CRD?**

The **Agent CRD** is Hedgehog's internal representation of each switch. It contains **comprehensive switch operational state**—everything happening on the switch right now.

**Why Agent CRD Matters:**

While VPC, VPCAttachment, and Connection CRDs have minimal status (`status: {}`), the **Agent CRD has detailed status fields**:

- Switch version and uptime
- Interface operational state (up/down, counters)
- BGP neighbor state
- Platform health (PSU, fans, temperature)
- ASIC resource usage
- Configuration application status

**Accessing Agent CRD:**

```bash
# List all switch agents
kubectl get agents
```

**Expected output:**
```
NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION   REBOOTREQ
leaf-01    server-leaf   VS-01 MCLAG 1   2m        10         10         v0.96.2
leaf-02    server-leaf   VS-02 MCLAG 1   3m        10         10         v0.96.2
spine-01   spine         VS-06           4m        8          8          v0.96.2
```

> **Key columns:** `APPLIEDG` (applied generation) and `CURRENTG` (current generation) must be equal for config to be fully applied. If `APPLIEDG < CURRENTG`, the agent is still applying the latest configuration.

**Get Full Agent Status:**

```bash
# Full YAML output
kubectl get agent leaf-01 -o yaml

# Human-readable description
kubectl describe agent leaf-01
```

**Key Status Fields:**

**1. Agent Heartbeat and Version:**

```bash
# Last heartbeat timestamp
kubectl get agent leaf-01 -o jsonpath='{.status.lastHeartbeat}'
# Output: 2025-10-17T10:30:00Z

# Agent version
kubectl get agent leaf-01 -o jsonpath='{.status.version}'
# Output: v0.87.4
```

**Interpretation:** Recent heartbeat (within last 2-3 minutes) means agent is connected and healthy.

**2. Configuration Application Status:**

```bash
# When was config last applied?
kubectl get agent leaf-01 -o jsonpath='{.status.lastAppliedTime}'
# Output: 2025-10-17T10:29:55Z

# What generation was applied?
kubectl get agent leaf-01 -o jsonpath='{.status.lastAppliedGen}'
# Output: 15
```

**Interpretation:** Recent `lastAppliedTime` means controller is actively configuring switch.

**3. Interface State:**

```bash
# All interfaces
kubectl get agent leaf-01 -o jsonpath='{.status.state.interfaces}' | jq

# Specific interface
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'
```

**Example output:**

```json
{
  "enabled": true,
  "admin": "up",
  "oper": "up",
  "mac": "00:11:22:33:44:55",
  "speed": "25G",
  "counters": {
    "inb": 123456789,
    "outb": 987654321,
    "ind": 2,
    "outbps": 408
  }
}
```

**Field Meanings:**
- `enabled`: Port enabled in configuration
- `admin`: Administrative state (up/down)
- `oper`: Operational state (actual link state)
- `speed`: Link speed
- `counters.inb`: Input bytes
- `counters.outb`: Output bytes
- `counters.ind`: Input discards
- `counters.outbps`: Output bits per second

**4. BGP Neighbor State:**

```bash
# All BGP neighbors
kubectl get agent leaf-01 -o jsonpath='{.status.state.bgpNeighbors}' | jq

# Check specific neighbor state
kubectl get agent leaf-01 -o jsonpath='{.status.state.bgpNeighbors.default["172.30.128.10"].state}'
# Output: established
```

**Expected BGP states:**
- `established` = Session up, routes exchanged
- `idle` = Session down
- `active`, `connect` = Attempting connection
- `opensent`, `openconfirm` = Establishing session

**5. Platform Health:**

```bash
# PSU status
kubectl get agent leaf-01 -o jsonpath='{.status.state.platform.psus}' | jq

# Fan status
kubectl get agent leaf-01 -o jsonpath='{.status.state.platform.fans}' | jq

# Temperature
kubectl get agent leaf-01 -o jsonpath='{.status.state.platform.temps}' | jq
```

**Example PSU output:**
```json
{
  "PSU1": {
    "presence": true,
    "status": true,
    "inVoltage": 120.0,
    "outVoltage": 12.0
  }
}
```

**6. ASIC Critical Resources:**

```bash
kubectl get agent leaf-01 -o jsonpath='{.status.state.criticalResources}' | jq
```

**Example output:**

```json
{
  "stats": {
    "ipv4RoutesUsed": 150,
    "ipv4RoutesAvailable": 32000,
    "ipv4NexthopsUsed": 200,
    "ipv4NexthopsAvailable": 16000
  }
}
```

**Interpretation:** Watch for resources approaching capacity (> 80% used).

**Agent Conditions:**

```bash
# Check whether the agent reports its configuration as applied
kubectl get agent leaf-01 -o jsonpath='{.status.conditions[?(@.type=="Applied")].status}'
# Output: True
```

`Applied` is the condition this fabric version reports for leaf-01. Compare `APPLIEDG` with `CURRENTG` to confirm the latest generation has been applied; the condition alone does not establish that.

**Why This Matters:**

Agent CRD status reports observed switch state, including interface operation and BGP neighbors. The Agent spec holds desired configuration. This fabric version does not list VLAN membership under interface status; compare desired objects and Agent generations before drawing a configuration conclusion.

**Practical Example:**

**Problem:** Server can't reach VPC
**Grafana:** Interface up, no traffic
**Agent CRD Check:**
```bash
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'
```
**Finding:** Interface operational; this read alone does not say whether a tenant VLAN was requested
**Next Step:** Check the VPCAttachment and VPC specs, then Agent APPLIEDG/CURRENTG convergence and any recorded apply-time error

### Concept 3: VPC Lifecycle Monitoring

**How Hedgehog Tracks VPC Lifecycle**

When you create a VPC via GitOps (Gitea commit → ArgoCD sync), the lifecycle progresses through these
observable stages:

> **Reminder:** Fabric controllers do NOT emit Kubernetes events. Lifecycle is tracked via:
> 1. Admission webhook response (at apply time)
> 2. Agent CRD generation counters (reconciliation progress)
> 3. Resource existence and `kubectl describe` output

**VPC Creation — Success Path**

```bash
# 1. ArgoCD applies VPC to cluster
kubectl apply -f vpc.yaml
# Output: vpc.wiring.githedgehog.com/myvpc created  (or unchanged)
# No error = webhook accepted the spec

# 2. Check resource exists
kubectl get vpc
# NAME      IPV4NS     VLANNS     AGE
# myvpc     default    default    10s
# test-vpc  default    default    5h

# An unattached VPC does not enter a switch Agent spec or change its generation.
# Check Agent convergence after an attachment changes switch configuration.
```

**VPC Creation — Validation Failure**

If the spec is invalid (VLAN conflict, subnet overlap, etc.), the admission webhook rejects it:

```bash
kubectl apply -f vpc.yaml
# Error from server (Forbidden): admission webhook "vvpc.kb.io" denied the request: ...
# VPC is NOT created — fix the spec and re-apply
```

**VPCAttachment — Success Path**

```bash
# 1. Apply VPCAttachment
kubectl apply -f attachment.yaml
# Output: vpcattachment.wiring.githedgehog.com/vpc1-srv01 created
# No error = webhook accepted

# 2. Confirm resource exists
kubectl get vpcattachment
# NAME           VPCSUBNET             CONNECTION                    NATIVEVLAN   AGE
# vpc1-srv01     myvpc/default         server-01--mclag--leaf-01--leaf-02    false    15s

# 3. Monitor Agent convergence
kubectl get agents
# Wait for APPLIEDG == CURRENTG on the relevant leaf switches
```

**VPCAttachment — Connection Not Found**

If an attachment references a non-existent Connection, inspect the apply-time error and correct the reference before checking Agent convergence:

```bash
# Check correct connection name
kubectl get connections | grep server-05
# The released wiring uses server-05--eslag--leaf-03--leaf-04

# Then verify Agent convergence after fix
kubectl get agents
```

**VPC Deletion — Guarded by Admission Webhook**

You cannot delete a VPC that has active VPCAttachments:

```bash
kubectl delete vpc myvpc
# Error from server (Forbidden): admission webhook "vvpc.kb.io" denied the request:
# VPC has attachments
```

Delete VPCAttachments first:
```bash
kubectl delete vpcattachment vpc1-srv01 vpc1-srv05
kubectl delete vpc myvpc
# vpc.wiring.githedgehog.com "myvpc" deleted
```

**Tracking VPC Lifecycle — Summary:**

```bash
# Check VPC exists and was accepted
kubectl get vpc

# Confirm VPCAttachments exist
kubectl get vpcattachment

# Check kubectl describe (Events section will show <none> — this is normal)
kubectl describe vpc myvpc

# Monitor reconciliation convergence
kubectl get agents

# Verify config applied to switches
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'
```

**Best Practice:** Always check Agent APPLIEDG/CURRENTG convergence after create/delete operations to
confirm the change has been applied to all relevant switches.

### Concept 4: Common Error Patterns

Understanding common error patterns helps you quickly diagnose issues without guessing.

> **Note:** These errors surface as **admission webhook errors at `kubectl apply` time** — not as
> Kubernetes events after the fact. If `kubectl apply` returns no error, the spec was accepted.

**Error Pattern 1: VLAN Conflict**

**Admission webhook error:**
```
Error from server (Forbidden): admission webhook "vvpc.kb.io" denied the request:
spec.vlans[0].vid: VLAN 1010 already allocated to vpc-1
```

**Cause:** VPC subnet specifies VLAN already used by another VPC in same VLANNamespace

**Solution:**
1. Check existing VLANs: `kubectl get vpc -o yaml | grep vlan:`
2. Choose unused VLAN (e.g., 1011)
3. Update VPC YAML in Gitea
4. Commit change

**Grafana Correlation:** An interface metric cannot establish why a VPC was rejected. Use the apply error and confirm the desired VPC object is absent.

**Example workflow:**
```bash
# Find all used VLANs
kubectl get vpc -o yaml | grep "vlan:" | sort -u

# Output:
# vlan: 1001
# vlan: 1010
# vlan: 1020

# Choose unused VLAN: 1011
# Edit VPC in Gitea, change vlan: 1010 to vlan: 1011
# Commit → ArgoCD syncs → VPC applies successfully
```

---

**Error Pattern 2: Subnet Overlap**

**Admission webhook error:**
```
Error from server (Forbidden): admission webhook "vvpc.kb.io" denied the request:
spec.subnets[0].subnet: 10.0.10.0/24 overlaps with existing VPC vpc-2/backend
```

**Cause:** VPC subnet overlaps with another VPC in same IPv4Namespace

**Solution:**
1. Check existing subnets: `kubectl get vpc -o yaml | grep subnet:`
2. Choose non-overlapping subnet (e.g., 10.0.20.0/24)
3. Update VPC YAML in Gitea

**Grafana Correlation:** A dashboard cannot establish that this subnet was rejected. Use the apply error and VPC object read.

**IPv4Namespace Example:**
```yaml
# IPv4Namespace defines allowed ranges
spec:
  subnets:
    - 10.0.0.0/16  # VPCs must use non-overlapping subnets within this range
```

**Finding available subnets:**
```bash
# List all VPC subnets
kubectl get vpc -o yaml | grep "subnet:" | sort

# Choose a /24 that's not in use
```

---

**Error Pattern 3: VPC Has Active Attachments (Deletion Blocked)**

**Admission webhook error:**
```
Error from server (Forbidden): admission webhook "vvpc.kb.io" denied the request:
VPC has attachments
```

**Cause:** Attempting to delete a VPC while VPCAttachments still reference it

**Solution:**
1. List VPCAttachments: `kubectl get vpcattachment`
2. Delete all attachments referencing this VPC
3. Then delete the VPC

**Example workflow:**
```bash
# Find attachments
kubectl get vpcattachment | grep myvpc

# Delete them first
kubectl delete vpcattachment vpc1-srv01 vpc1-srv05

# Then delete VPC
kubectl delete vpc myvpc
```

---

**Error Pattern 4: Invalid CIDR**

**Admission webhook error:**
```
Error from server (Invalid): admission webhook validation:
spec.subnets[0]: invalid CIDR notation "10.0.10.0/33"
```

**Cause:** Invalid CIDR notation (prefix length > 32 for IPv4)

**Solution:**
1. Fix CIDR notation (e.g., /24 instead of /33)
2. Update VPC YAML in Gitea

**Common CIDR mistakes:**
- `/33` or higher (max is /32 for IPv4)
- Missing prefix length (e.g., `10.0.10.0`)
- Invalid IP (e.g., `10.0.256.0/24`)

---

**Error Pattern 5: Agent Generation Stalled**

**Observed via `kubectl get agents`:**
```
NAME       ROLE          DESCR   APPLIED   APPLIEDG   CURRENTG   VERSION
leaf-03    server-leaf   VS-03   15m       8          12         v0.96.2
```

`APPLIEDG (8) != CURRENTG (12)` — agent is stalled, not applying new config

**Cause:** Switch agent disconnected or switch offline

**Solution:**
1. Check agent pod:
   ```bash
   kubectl get pods -n fab | grep leaf-03
   ```
2. Check agent logs:
   ```bash
   kubectl logs -n fab -l "wiring.githedgehog.com/agent=leaf-03"
   ```
3. Check switch reachability:
   ```bash
   hhfab vlab serial leaf-03
   ```
4. Check fabric-boot logs:
   ```bash
   kubectl logs -n fab deployment/fabric-boot
   ```

**Grafana Correlation:** Fabric Dashboard shows switch missing metrics



### Concept 5: Status-Metric Correlation

**Using kubectl, Agent CRD, and Grafana Dashboards Together**

The most powerful troubleshooting approach combines multiple data sources. Here are realistic scenarios
showing how to correlate kubectl status with Grafana metrics.

> **Reminder:** `kubectl get events` returns empty for fabric CRD (VPC/VPCAttachment) operations.
> Validation errors surface via admission webhooks at apply time; reconciliation is tracked via
> Agent CRD generation counters.

**Scenario 1: Interface No Traffic**

**Grafana shows:**
- Interfaces Dashboard: leaf-01/E1/5 has 0 bps traffic
- Interface state: UP

**kubectl investigation:**

```bash
# Check if VPCAttachment exists for this interface
kubectl get vpcattachment

# Check Agent convergence
kubectl get agents
# If APPLIEDG < CURRENTG for leaf-01 → reconciliation in progress

# Check if VPCAttachment was even accepted (look in deployment history or ArgoCD)
# A webhook-rejected VPCAttachment would NOT appear in kubectl get vpcattachment
```

**Agent CRD investigation:**

```bash
# Check interface state
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'

# This reports operational fields and counters, not VLAN membership
```

**Root Cause Determination:**
- If VPCAttachment is missing: Check whether it was ever submitted, deleted, or rejected at apply time
- If VPCAttachment exists but APPLIEDG < CURRENTG: Reconciliation still in progress
- If APPLIEDG == CURRENTG but connectivity still fails: Check the attachment connection, VPC subnet, and server OS configuration

**Correlation:**
- Grafana observation: Interface UP, with the traffic value actually shown
- Agent CRD: Interface operational state and applied/current generations
- Root cause: Determine from the desired objects and any apply-time error; a quiet interface alone is inconclusive

**Solution:** Correct the specific problem supported by those checks, then verify the accepted objects and Agent convergence

---

**Scenario 2: BGP Session Down**

**Grafana shows:**
- Fabric Dashboard: BGP session leaf-01 ↔ spine-01 down

**kubectl investigation:**

```bash
# Check Agent CRD for BGP state
kubectl get agent leaf-01 -o jsonpath='{.status.state.bgpNeighbors.default["172.30.128.1"]}' | jq
```

**Output shows:**
```json
{
  "state": "idle",
  "enabled": true,
  "localAS": 65101,
  "peerAS": 65100
}
```

**Check Agent convergence and controller logs:**
```bash
# Check agent generation — is config stalled?
kubectl get agents

# Check fabric controller logs for any errors
kubectl logs -n fab deployment/fabric-ctrl --tail=50 | grep -i error
```

**Root Cause:** Spine-01 not reachable from leaf-01 (physical/network issue) OR config not applied

**Correlation:**
- Grafana symptom: BGP session down
- Agent CRD: BGP neighbor state = "idle"
- Agent CRD: APPLIEDG vs CURRENTG — if stalled, controller may be having issues
- Root cause: Network connectivity issue OR configuration not applied to switch

**Solution:** Investigate spine-01 Agent status, check physical links via `hhfab vlab serial`

---

**Scenario 3: Server Can't Get DHCP**

**Grafana shows:**
- Interfaces Dashboard: leaf-02/E1/10 UP, traffic minimal
- Logs Dashboard: No DHCP errors

**kubectl investigation:**

```bash
# Check DHCPSubnet resources; absence alone does not identify the cause
kubectl get dhcpsubnet

# Expected: myvpc--default (one per VPC subnet)
# If missing, check whether VPC itself was accepted:
kubectl get vpc
# If myvpc is missing, check whether it was submitted, deleted, or rejected.
# Use ArgoCD or the original apply output to identify a webhook error.
```

**Possible root cause:** If the apply history records a subnet-overlap webhook error, the VPC was rejected and its DHCPSubnet was never created. Without that record, absence alone does not establish why.

**Correlation:**
- Grafana symptom: Server not getting DHCP (no traffic)
- kubectl resources: The VPC and DHCPSubnet are absent
- Apply or ArgoCD history: Check for the specific webhook error
- Root cause: Name subnet overlap only if that error was actually recorded

**Solution:** Correct the recorded error, if any; otherwise confirm the desired VPC was submitted before changing its YAML

---

**Integration Workflow:**

```
1. Grafana: Identify symptom (no traffic, BGP down, no DHCP, etc.)
           ↓
2. kubectl: Does resource exist? (kubectl get vpc/vpcattachment/dhcpsubnet)
           ↓
3. Agent CRD: APPLIEDG == CURRENTG? (kubectl get agents)
           ↓
4. Agent CRD: Interface/BGP state (kubectl get agent ... -o json | jq ...)
           ↓
5. Controller logs (if needed: kubectl logs -n fab deployment/fabric-ctrl)
           ↓
6. Solution: Fix configuration, verify in Grafana
```

**Best Practice:** Start with Grafana for symptoms, use `kubectl get agents` to check reconciliation
convergence, use Agent CRD for exact switch state, and return to Grafana for verification after fix.

## Troubleshooting

### Issue: kubectl get events Shows No Fabric Resource Events

**Symptom:** `kubectl get events` returns no results, or `kubectl describe vpc ...` shows `Events: <none>`

**Explanation:** This is **expected behavior**. Hedgehog fabric controllers (VPC, VPCAttachment) do not
emit Kubernetes events. There are no events to see — this is not an error condition.

**What to use instead:**

1. **Check for admission webhook errors** (at apply time):
   ```bash
   # Re-apply the resource and look for webhook errors
   kubectl apply -f vpc.yaml
   # If there's a problem: "Error from server (Forbidden): admission webhook ... denied"
   ```

2. **Check Agent generation convergence:**
   ```bash
   kubectl get agents
   # APPLIEDG == CURRENTG means reconciliation is complete
   ```

3. **Check controller logs for detailed info:**
   ```bash
   kubectl logs -n fab deployment/fabric-ctrl --tail=100
   ```

4. **For system component events** (pods, deployments — these DO have events):
   ```bash
   kubectl get events -n fab --sort-by='.lastTimestamp'
   ```

---

### Issue: Agent CRD Has No Status Data

**Symptom:** `kubectl get agent leaf-01 -o yaml` shows `status: {}` or minimal data

**Possible Causes:**
1. Agent not connected to switch
2. Switch not fully registered
3. Agent pod not running

**Solution:**

1. **Check agent pod:**
   ```bash
   kubectl get pods -n fab -l "wiring.githedgehog.com/agent=leaf-01"
   ```

   **Expected:** Pod Running

2. **Check agent logs:**
   ```bash
   kubectl logs -n fab -l "wiring.githedgehog.com/agent=leaf-01"
   ```

   **Look for:** Connection errors, gNMI errors

3. **Verify switch registration:**
   ```bash
   kubectl get switch leaf-01
   ```

4. **Check switch reachability:**
   ```bash
   ping leaf-01.fabric.local
   ```

5. **If switch not registered:**
   - Check fabric-boot logs:
     ```bash
     kubectl logs -n fab deployment/fabric-boot
     ```
   - Check switch serial console:
     ```bash
     hhfab vlab serial leaf-01
     ```

---

### Issue: kubectl get events Returns No Results for Fabric Resources

**Symptom:** `kubectl get events --field-selector involvedObject.kind=VPC` returns no results

**Explanation:** This is **expected**. Hedgehog fabric controllers do not emit K8s events for VPC,
VPCAttachment, Switch, Connection, or Agent CRDs. `kubectl describe vpc myvpc` will show `Events: <none>`.

**Use the correct monitoring tools:**

1. **For validation errors** — check at apply time:
   ```bash
   kubectl apply -f vpc.yaml  # Look for webhook error in the response
   ```

2. **For reconciliation status:**
   ```bash
   kubectl get agents  # APPLIEDG == CURRENTG = converged
   ```

3. **For system component events** (these DO work):
   ```bash
   # Pod and deployment events in fab namespace
   kubectl get events -n fab --sort-by='.lastTimestamp'
   ```

4. **For resource existence:**
   ```bash
   kubectl get vpc
   kubectl get vpcattachment
   kubectl describe vpc myvpc  # Shows spec/status, Events: <none> is normal
   ```

---

### Issue: Agent CRD jsonpath Queries Return Empty

**Symptom:** `kubectl get agent ... -o json | jq '.status.state.interfaces["E1/5"]'` returns nothing

**Possible Causes:**
1. Interface name incorrect
2. Agent status not populated
3. jsonpath syntax error

**Solution:**

1. **Verify interface exists:**
   ```bash
   # List all interfaces
   kubectl get agent leaf-01 -o jsonpath='{.status.state.interfaces}' | jq 'keys'
   ```

   **Output:** Array of interface names (e.g., `["E1/0", "E1/1", ...]`)

2. **Check status exists:**
   ```bash
   kubectl get agent leaf-01 -o yaml | grep -A 10 "state:"
   ```

3. **Use correct interface name:**
   - SONiC interfaces: `E1/0`, `E1/1`, etc. (not `E1/5` if switch only has 0-3)
   - Check Connection CRDs for actual port names

4. **Test jsonpath syntax:**
   ```bash
   # Simple test
   kubectl get agent leaf-01 -o jsonpath='{.status.lastHeartbeat}'
   ```

---

### Issue: How to Audit Fabric Operations History

**Symptom:** Need historical record of fabric configuration changes

**Solution:**

Since Hedgehog fabric controllers do not emit K8s events, use these approaches for audit:

**Option 1: Controller logs**
```bash
# Recent controller activity
kubectl logs -n fab deployment/fabric-ctrl --tail=200

# Save logs to file
kubectl logs -n fab deployment/fabric-ctrl > fabric-ctrl-$(date +%Y%m%d-%H%M%S).log
```

**Option 2: Agent CRD history**
```bash
# Generation history shows how many times config has changed
kubectl get agents
# CURRENTG shows total generation count (increments on each config change)
```

**Option 3: GitOps audit trail (Gitea + ArgoCD)**
- All VPC/VPCAttachment changes go through Git (Gitea)
- ArgoCD shows sync history with timestamps
- Gitea shows commit history — every change is recorded

**Option 4: Grafana Loki (fabric logs)**
- Fabric controller logs are shipped to Loki
- Query in Grafana Logs Dashboard: `Errors - $node` panel
- Historical log retention depends on Loki configuration

**Best Practice:** For fabric operation audits, use GitOps history (Gitea) + controller logs.
The GitOps model means every configuration change is a git commit — this IS your audit trail.

## Resources

### Kubernetes Documentation

- [Kubernetes Events](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/)
- [kubectl get events](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#-em-events-em-)
- [Field Selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/)

### Hedgehog Documentation

- Hedgehog CRD Reference (CRD_REFERENCE.md in research folder)
- Hedgehog Observability Guide (OBSERVABILITY.md in research folder)
- Hedgehog Fabric Controller Documentation

### Related Modules

- Previous: [Module 3.2: Dashboard Interpretation](module-3.2-dashboard-interpretation.md)
- Next: Module 3.4: Pre-Support Diagnostic Checklist (coming soon)
- Pathway: Network Like a Hyperscaler

### kubectl Commands Quick Reference

**Admission Webhook Validation:**

```bash
# Apply a resource — admission webhook validates immediately
# Success: resource created/configured
kubectl apply -f vpc.yaml

# Failure: webhook error printed synchronously
# Error from server (Forbidden): admission webhook "vvpc.kb.io" denied the request: ...
```

**Agent Generation Monitoring (Reconciliation Status):**

```bash
# List all agents with generation counters
kubectl get agents
# APPLIEDG == CURRENTG → config fully applied
# APPLIEDG < CURRENTG → reconciliation in progress

# Watch agents until converged
kubectl get agents -w
```

**System Component Events (pods/deployments — these DO have events):**

```bash
# Events for pods/deployments in fab namespace
kubectl get events -n fab --sort-by='.lastTimestamp'

# Warning events for system components
kubectl get events -n fab --field-selector type=Warning
```

**Agent CRD Queries:**

```bash
# List all agents
kubectl get agents

# Get agent full status
kubectl get agent leaf-01 -o yaml

# Check agent heartbeat
kubectl get agent leaf-01 -o jsonpath='{.status.lastHeartbeat}'

# Check agent version
kubectl get agent leaf-01 -o jsonpath='{.status.version}'

# View all interfaces
kubectl get agent leaf-01 -o jsonpath='{.status.state.interfaces}' | jq

# View specific interface
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'

# View BGP neighbors
kubectl get agent leaf-01 -o jsonpath='{.status.state.bgpNeighbors}' | jq

# View specific BGP neighbor state
kubectl get agent leaf-01 -o jsonpath='{.status.state.bgpNeighbors.default["172.30.128.10"].state}'

# View platform health
kubectl get agent leaf-01 -o jsonpath='{.status.state.platform}' | jq

# View ASIC resources
kubectl get agent leaf-01 -o jsonpath='{.status.state.criticalResources}' | jq

# Check agent condition (Applied)
kubectl get agent leaf-01 -o jsonpath='{.status.conditions[?(@.type=="Applied")].status}'
```

**VPC/VPCAttachment Queries:**

```bash
# List VPCs (Events: <none> is expected)
kubectl describe vpc myvpc

# Describe VPCAttachment (Events: <none> is expected)
kubectl describe vpcattachment vpc1-srv01

# List DHCPSubnets (missing = VPC was rejected or not yet reconciled)
kubectl get dhcpsubnet

# Check Connection exists
kubectl get connections | grep server-01
```

---

**Module Complete!** You've learned to use admission webhook validation, Agent CRD generation counters, and Grafana metrics for integrated fabric troubleshooting. Ready for diagnostic collection in Module 3.4.
