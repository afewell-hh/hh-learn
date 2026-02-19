---
title: "Systematic Troubleshooting Framework"
slug: "fabric-operations-troubleshooting-framework"
difficulty: "intermediate"
estimated_minutes: 10
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - troubleshooting
  - diagnostics
  - methodology
  - decision-trees
description: "Learn systematic troubleshooting methodology using hypothesis-driven investigation, decision trees, and integrated diagnostic workflows for Hedgehog fabric operations."
order: 401
---

## Introduction

You've designed VPCs, attached servers, validated connectivity, and monitored fabric health. Your Hedgehog fabric is operational.

Then one morning: **"Server-07 can't reach the database. The application is down."**

You could panic. Or you could apply **systematic troubleshooting methodology**—the difference between experienced operators and beginners.

Beginners randomly check things, hoping to stumble on the issue. Experts use **hypothesis-driven investigation**, eliminating possibilities systematically until they identify the root cause.

### Building on Pre-Escalation Diagnostics

In Module 3.4, you learned the **pre-escalation diagnostic checklist**—collecting evidence for support tickets. That checklist taught you *what* to collect: events, Agent CRD status, Grafana metrics, and logs.

Module 4.1a teaches you **how to diagnose issues independently** using that evidence:
- **Form hypotheses** based on symptoms
- **Test hypotheses** with kubectl and Grafana
- **Eliminate possibilities** systematically
- **Identify root cause** with confidence

### What You'll Learn

**Troubleshooting Methodology:**
- Hypothesis-driven investigation framework
- Systematic evidence collection order
- Root cause identification through elimination

**Common Failure Modes:**
- VPC attachment issues (incorrect subnet, connection, or VLAN)
- BGP peering problems (Agent CRD state inspection)
- Interface errors (Grafana Interface Dashboard analysis)
- Configuration drift (GitOps reconciliation failures)

**Diagnostic Workflow:**
- Layer 1: Kubernetes events (fastest check)
- Layer 2: Agent CRD status (detailed switch state)
- Layer 3: Grafana dashboards (visual metrics and trends)
- Layer 4: Controller logs (reconciliation details)

**Decision Trees:**
- Server cannot communicate in VPC
- Cross-VPC connectivity fails
- VPCAttachment shows success but doesn't work

### The Scenario

You'll learn systematic methodology for diagnosing connectivity failures. The framework you master here applies to any fabric issue you encounter.

This module focuses on **the methodology itself**—how to think systematically about troubleshooting. In Module 4.1b, you'll apply this methodology in a hands-on troubleshooting lab.

---

## Learning Objectives

By the end of this module, you will be able to:

1. **Apply systematic troubleshooting methodology** - Use hypothesis-driven investigation to diagnose fabric issues
2. **Identify common failure modes** - Recognize VPC attachment issues, BGP problems, interface errors, and configuration drift
3. **Construct diagnostic workflows** - Build investigation paths from events → Agent CRDs → Grafana metrics → logs
4. **Differentiate issue types** - Distinguish between configuration, connectivity, and platform issues
5. **Use decision trees for diagnosis** - Follow structured decision paths to identify root causes

---

## Prerequisites

Before starting this module, you should have:

**Completed Courses:**
- Course 1: Foundations & Interfaces (kubectl proficiency, GitOps workflow)
- Course 2: Provisioning & Connectivity (VPC and VPCAttachment creation experience)
- Course 3: Observability & Fabric Health (Prometheus metrics, Grafana dashboards, Agent CRD inspection, diagnostic checklist)

**Understanding:**
- How VPCs and VPCAttachments should work (expected behavior)
- Agent CRD structure and status fields
- Grafana dashboard navigation
- kubectl events and describe commands

**Environment:**
- kubectl configured and authenticated
- Grafana access (http://localhost:3000)
- Hedgehog fabric with at least one VPC deployed

---

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Scenario

**Incident Report:**

A developer reports that **server-07** in VPC **customer-app-vpc** cannot reach the gateway or other servers in the VPC. The VPCAttachment was created this morning using the standard GitOps workflow.

**Initial Investigation:**

You run `kubectl describe vpcattachment customer-app-vpc-server-07` and see no error events. The resource exists, the controller processed it successfully, and there are no warnings.

But the server still has no connectivity.

**Your Task:**

Use systematic troubleshooting methodology to identify the root cause and document a solution.

**Known Information:**
- VPC: `customer-app-vpc`
- Subnet: `frontend` (10.20.10.0/24, gateway 10.20.10.1, VLAN 1025)
- Server: `server-07`
- Expected Connection: `server-07--unbundled--leaf-04`
- VPCAttachment: `customer-app-vpc-server-07`
- Symptom: Server cannot ping gateway 10.20.10.1

---

## Core Concepts & Deep Dive

### Concept 1: Troubleshooting Methodology (Hypothesis-Driven Investigation)

#### The Problem with Random Checking

Beginners troubleshoot by checking things randomly:
- "Let me check the controller logs"
- "Maybe it's a BGP issue"
- "Did the switch reboot?"
- "Is DNS working?"

This wastes time and misses systematic patterns. Worse, you might check dozens of things without finding the root cause, or accidentally stumble on the solution without understanding *why* it works.

#### Systematic Approach: Hypothesis-Driven Investigation

Professional troubleshooting follows a structured methodology:

**Step 1: Gather Symptoms**

Document what you know:
- **What is not working?** (Specific behavior: "server-07 cannot ping 10.20.10.1")
- **What is the expected behavior?** (Server should ping gateway successfully)
- **When did it start?** (This morning after VPCAttachment creation)
- **What changed recently?** (VPCAttachment created, committed to Git, synced by ArgoCD)

**Step 2: Form Hypotheses**

Based on symptoms, generate possible causes:
- **Configuration error:** VLAN mismatch, wrong connection reference, incorrect subnet
- **Connectivity issue:** BGP session down, interface down, physical layer problem
- **Platform issue:** Switch failure, resource exhaustion, controller error

**Step 3: Test Hypotheses**

For each hypothesis, design a specific test:
- **If VLAN mismatch** → Check Agent CRD interface configuration
- **If BGP down** → Check Agent CRD bgpNeighbors state
- **If interface down** → Check Grafana Interface Dashboard

**Step 4: Eliminate or Confirm**

Each test either:
- **Eliminates** hypothesis (BGP is established → not a BGP issue)
- **Confirms** hypothesis (VLAN 1010 expected, VLAN 1020 configured → VLAN mismatch confirmed!)

**Step 5: Identify Root Cause**

When one hypothesis is confirmed and others eliminated:
- Root cause identified
- Solution becomes clear
- You can document findings with confidence

#### Example Walkthrough

**Symptoms:**
- Server-07 in VPC `webapp-vpc`, subnet `frontend`
- Expected: ping 10.0.10.1 (gateway)
- Actual: "Destination Host Unreachable"
- Recent change: VPCAttachment created today

**Hypotheses:**
1. VLAN not configured on switch interface (configuration issue)
2. Interface is down (connectivity issue)
3. Server network interface misconfigured (server issue)
4. BGP session down (routing issue)

**Tests:**

**Hypothesis 1: VLAN not configured**
```bash
# Check Agent CRD for leaf-04 (server-07 connects to leaf-04)
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.interfaces.Ethernet8}' | jq

# Look for: vlans field contains 1010
```

**Result:** VLAN 1010 is configured on Ethernet8 ✅ (Hypothesis 1 eliminated)

**Hypothesis 2: Interface down**
```bash
# Check Grafana Interface Dashboard for leaf-04/Ethernet8
# Or check Agent CRD:
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.interfaces.Ethernet8.oper}'

# Look for: oper=up
```

**Result:** Ethernet8 oper=up ✅ (Hypothesis 2 eliminated)

**Hypothesis 3: Server misconfigured**
```bash
# SSH to server-07
ip link show enp2s1.1010

# Look for: interface exists and is up
```

**Result:** Server interface enp2s1.1010 is up and tagged ✅ (Hypothesis 3 eliminated)

**Hypothesis 4: BGP down**
```bash
# Check Agent CRD bgpNeighbors
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.bgpNeighbors.default}' | jq

# Look for: all neighbors state=established
```

**Result:** All BGP sessions established ✅ (Hypothesis 4 eliminated)

**Wait—all tests passed, but still broken?**

When all initial hypotheses are eliminated, revise your hypothesis list. This is where systematic methodology shines: you don't give up or escalate prematurely. You form *new* hypotheses based on evidence.

**Revised Hypothesis:** VPCAttachment references **wrong connection**.

**Test:**
```bash
kubectl get vpcattachment webapp-vpc-server-07 -o jsonpath='{.spec.connection}'
# Output: server-07--unbundled--leaf-05
```

**Root Cause Found:** VPCAttachment references `leaf-05` but server-07 actually connects to `leaf-04`.

**Solution:** Update VPCAttachment connection reference in Gitea to `server-07--unbundled--leaf-04`, commit, wait for ArgoCD sync.

#### Why This Methodology Works

- **Eliminates guesswork:** You test, don't guess
- **Builds evidence:** Each test adds to your knowledge
- **Enables explanation:** You can document *why* the issue occurred
- **Transfers to new scenarios:** The methodology applies to issues you've never seen before
- **Supports escalation:** If you must escalate, you provide tested hypotheses and evidence

---

### Concept 2: Common Failure Modes

Knowing common failure patterns helps you form hypotheses quickly. Here are the most frequent issues in Hedgehog fabrics:

#### Failure Mode 1: VPC Attachment Issues

**Symptoms:**
- VPCAttachment created, no error events in kubectl describe
- Server cannot communicate within VPC (cannot ping gateway or other servers)

**Common Root Causes:**

1. **Wrong connection name**
   - VPCAttachment references incorrect Connection CRD
   - Example: VPCAttachment specifies `leaf-05` but server connects to `leaf-04`

2. **Wrong subnet**
   - VPCAttachment references non-existent subnet
   - Example: VPCAttachment specifies `vpc-1/database` but VPC only has `vpc-1/frontend`

3. **VLAN conflict**
   - VPC subnet specifies VLAN already in use
   - VLANNamespace allocates different VLAN
   - Configuration and actual allocation mismatch

4. **nativeVLAN mismatch**
   - VPCAttachment expects untagged VLAN (`nativeVLAN: true`)
   - Server expects tagged VLAN (interface enp2s1.1010)
   - Or vice versa

**Diagnostic Path:**

```
Check VPCAttachment spec
  ↓
Verify connection exists: kubectl get connection <name> -n fab
  ↓
Verify subnet exists in VPC: kubectl get vpc <vpc> -o yaml | grep <subnet>
  ↓
Check Agent CRD for switch interface: Is VLAN configured?
  ↓
Check Grafana Interface Dashboard: Is interface up?
  ↓
Check VLAN ID matches expected
```

**Resolution:**
- Update VPCAttachment connection or subnet reference in Git
- Fix VPC VLAN assignment if conflict exists
- Adjust nativeVLAN setting to match server configuration

---

#### Failure Mode 2: BGP Peering Problems

**Symptoms:**
- Cross-VPC connectivity fails (VPCPeering exists)
- External connectivity fails (ExternalPeering exists)
- Grafana Fabric Dashboard shows BGP sessions down

**Common Root Causes:**

1. **BGP session not established**
   - Neighbor IP unreachable
   - ASN mismatch
   - Interface IP misconfigured

2. **Route not advertised**
   - VPCPeering permit list misconfiguration
   - ExternalPeering prefix filter blocks routes

3. **Community mismatch**
   - External community filter blocks routes
   - Inbound/outbound community misconfigured

**Diagnostic Path:**

```
Check Grafana Fabric Dashboard: Which BGP sessions down?
  ↓
Check Agent CRD bgpNeighbors for affected switch
  ↓
Identify neighbor IP and state (idle, active, established)
  ↓
If state != established:
  - Check ExternalAttachment neighbor IP/ASN
  - Check switch interface IP configured correctly
  - Check external router reachability
  ↓
If state = established but routes missing:
  - Check VPCPeering permit list
  - Check ExternalPeering prefix filters
  - Check community configuration
```

**Resolution:**
- Fix neighbor IP or ASN in ExternalAttachment
- Update VPCPeering permit list to include required subnets
- Verify ExternalPeering prefix filters allow expected routes
- Correct community configuration in External resource

---

#### Failure Mode 3: Interface Errors

**Symptoms:**
- Intermittent connectivity failures
- Packet loss
- Grafana Interface Dashboard shows errors

**Common Root Causes:**

1. **Physical layer issue**
   - Bad cable, SFP, or switch port
   - Dirty fiber optic connector

2. **MTU mismatch**
   - Server configured with MTU 9000
   - Switch configured with MTU 1500
   - Fragmentation issues

3. **Congestion**
   - Traffic exceeds interface capacity
   - No QoS configured

4. **Configuration error**
   - Speed/duplex mismatch
   - LACP misconfiguration on bundled/MCLAG connection

**Diagnostic Path:**

```
Check Grafana Interface Dashboard: Which interface has errors?
  ↓
Check Agent CRD interface counters: ine (input errors), oute (output errors)
  ↓
Check interface speed and MTU configuration
  ↓
Check physical layer: SFP status, cable integrity
  ↓
If congestion: Check traffic patterns in Grafana
  ↓
If LACP issue: Check server LACP configuration
```

**Resolution:**
- Replace faulty cable or SFP
- Align MTU configuration across server and switch
- Implement QoS or upgrade link capacity
- Fix speed/duplex or LACP configuration

---

#### Failure Mode 4: Configuration Drift (GitOps Reconciliation Failures)

**Symptoms:**
- Git shows correct configuration
- kubectl shows different configuration
- ArgoCD shows "OutOfSync" status

**Common Root Causes:**

1. **Manual kubectl changes**
   - Someone applied changes directly (bypassing Git)
   - ArgoCD detects drift

2. **ArgoCD sync disabled**
   - Auto-sync turned off manually
   - Changes in Git not applied

3. **Git webhook broken**
   - ArgoCD not notified of commits
   - Manual sync required

4. **Reconciliation error**
   - Controller failed to apply configuration
   - Dependency missing or validation failed

**Diagnostic Path:**

```
Check ArgoCD application status: Synced or OutOfSync?
  ↓
Compare Git YAML to kubectl get <resource> -o yaml
  ↓
Check ArgoCD sync history: Last successful sync?
  ↓
Check controller logs for reconciliation errors
  ↓
Check kubectl events for VPC/VPCAttachment errors
```

**Resolution:**
- Revert manual kubectl changes, re-sync from Git
- Re-enable ArgoCD auto-sync
- Fix Git webhook configuration
- Resolve dependency or validation errors in Git configuration

---

### Concept 3: Diagnostic Workflow (Evidence Collection Order)

When facing an issue, collect evidence in this order for maximum efficiency:

#### Layer 1: Kubernetes Events (Fastest Check)

**Why first?** Events quickly reveal configuration errors, validation failures, and reconciliation issues.

```bash
# Check for recent Warning events
kubectl get events --field-selector type=Warning --sort-by='.lastTimestamp'

# Check events for specific resource
kubectl describe vpc webapp-vpc
kubectl describe vpcattachment webapp-vpc-server-07
```

**Look for:**
- `VLANConflict`, `SubnetOverlap` (configuration errors)
- `DependencyMissing` (VPC/Connection not found)
- `ReconcileFailed` (controller errors)
- `ValidationFailed` (spec validation errors)

**What events tell you:**
- Whether the controller accepted the configuration
- If validation passed
- If dependencies exist
- If reconciliation succeeded

**Time investment:** 10-30 seconds

**When to move on:** If no Warning events exist, proceed to Layer 2.

---

#### Layer 2: Agent CRD Status (Detailed Switch State)

**Why second?** Agent CRD is the source of truth for actual switch configuration and operational state.

```bash
# Check agent readiness
kubectl get agents -n fab

# View detailed switch state
kubectl get agent leaf-04 -n fab -o yaml

# Check BGP neighbors
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq

# Check interface state
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.interfaces.Ethernet8}' | jq
```

**Look for:**
- **BGP neighbor state:** `established` vs `idle` or `active`
- **Interface oper state:** `up` vs `down`
- **VLAN configuration:** Which VLANs are configured on which interfaces
- **Interface counters:** `ine` (input errors), `oute` (output errors)
- **Platform health:** PSU status, fan speeds, temperature

**What Agent CRD tells you:**
- Actual switch configuration (not just desired state)
- Operational status (up/down, established/idle)
- Performance metrics (errors, counters)
- Hardware health

**Time investment:** 1-2 minutes

**When to move on:** If Agent CRD shows expected configuration and healthy state, proceed to Layer 3.

---

#### Layer 3: Grafana Dashboards (Visual Metrics and Trends)

**Why third?** Grafana provides visual trends and historical context that kubectl cannot.

**Fabric Dashboard:**
- BGP session health (all established?)
- BGP session flapping (repeated up/down transitions)
- VPC count (as expected?)

**Interfaces Dashboard:**
- Interface operational state (up/down over time)
- Error rates (input errors, output errors)
- Traffic patterns (bandwidth utilization, spikes, drops)
- Packet counters (unicast, broadcast, multicast)

**Logs Dashboard:**
- Recent ERROR logs (switch or controller)
- Filter by switch name for targeted investigation
- Syslog patterns (BGP state changes, interface flaps)

**Look for:**
- Interfaces with high error rates (physical layer issues)
- BGP sessions flapping (routing instability)
- Traffic patterns indicating congestion or no traffic
- Log patterns correlating with symptom timing

**What Grafana tells you:**
- Historical trends (when did it start?)
- Intermittent issues (not visible in current state)
- Correlation between events (BGP flap coincides with interface errors)

**Time investment:** 2-3 minutes

**When to move on:** If Grafana confirms hypotheses or reveals new patterns, validate with logs.

---

#### Layer 4: Controller Logs (Reconciliation Details)

**Why fourth?** Controller logs explain *why* reconciliation succeeded or failed.

```bash
# Check controller logs for specific resource
kubectl logs -n fab deployment/fabric-controller-manager | grep webapp-vpc-server-07

# Check for errors
kubectl logs -n fab deployment/fabric-controller-manager --tail=200 | grep -i error

# Follow logs live
kubectl logs -n fab deployment/fabric-controller-manager -f
```

**Look for:**
- Reconciliation loops (same resource reconciling repeatedly)
- Errors during configuration application
- Validation failures
- Dependency resolution issues

**What controller logs tell you:**
- Why controller made specific decisions
- Why configuration wasn't applied
- Timing of reconciliation attempts

**Time investment:** 2-5 minutes

**When to use:**
- Events show `ReconcileFailed` but reason unclear
- Configuration should be applied but isn't
- Debugging GitOps sync issues

---

#### Summary: Layered Diagnostic Approach

| Layer | Tool | Purpose | Time | When to Use |
|-------|------|---------|------|-------------|
| 1 | kubectl events | Quick error check | 10-30s | Always first |
| 2 | Agent CRD | Switch state verification | 1-2min | After events |
| 3 | Grafana | Trends and historical context | 2-3min | For intermittent issues or validation |
| 4 | Controller logs | Reconciliation debugging | 2-5min | When reconciliation fails or behavior unclear |

**Total time for full diagnostic:** 5-10 minutes

This layered approach ensures you:
- Start with fastest checks (events)
- Progress to detailed state (Agent CRD)
- Validate with trends (Grafana)
- Deep-dive only when necessary (logs)

---

### Concept 4: Decision Trees for Common Scenarios

Decision trees provide structured diagnostic paths for frequent issues. Follow the tree from top to bottom, testing at each decision point.

#### Decision Tree 1: Server Cannot Communicate in VPC

```
Server cannot ping gateway or other servers in VPC
  │
  ├─ Check kubectl events for VPCAttachment
  │    │
  │    ├─ Warning events present?
  │    │    ├─ YES → Read error message, fix configuration
  │    │    └─ NO → Continue investigation
  │
  ├─ Check Agent CRD for switch
  │    │
  │    ├─ Is interface oper=up?
  │    │    ├─ NO → Physical layer issue (cable, SFP, port)
  │    │    └─ YES → Continue
  │    │
  │    ├─ Is VLAN configured on interface?
  │    │    ├─ NO → VPCAttachment wrong connection or reconciliation failed
  │    │    └─ YES → Continue
  │    │
  │    ├─ Is VLAN ID correct?
  │    │    ├─ NO → Configuration error (VLAN mismatch or conflict)
  │    │    └─ YES → Continue
  │
  ├─ Check server network interface
  │    │
  │    ├─ Is interface up and tagged with VLAN?
  │    │    ├─ NO → Server configuration issue
  │    │    └─ YES → Continue
  │
  ├─ Check Grafana Interface Dashboard
  │    │
  │    ├─ High error rates on interface?
  │    │    ├─ YES → Physical layer issue or MTU mismatch
  │    │    └─ NO → Escalate (unexpected issue)
```

**Example Usage:**

1. Server-07 cannot ping gateway 10.20.10.1
2. Check events: No warnings → Continue
3. Check Agent CRD leaf-04 Ethernet8: oper=up → Continue
4. Check VLAN on Ethernet8: VLAN 1020 configured
5. VPC expects VLAN 1025 → **VLAN mismatch identified!**

---

#### Decision Tree 2: Cross-VPC Connectivity Fails (VPCPeering Exists)

```
Server in VPC-1 cannot reach server in VPC-2
  │
  ├─ Check kubectl events for VPCPeering
  │    │
  │    ├─ Warning events?
  │    │    ├─ YES → Configuration error in permit list
  │    │    └─ NO → Continue
  │
  ├─ Verify VPCPeering permit includes both subnets
  │    │
  │    ├─ Permit list missing subnet?
  │    │    ├─ YES → Add subnet to permit list
  │    │    └─ NO → Continue
  │
  ├─ Check both VPCs in same IPv4Namespace
  │    │
  │    ├─ Different namespaces?
  │    │    ├─ YES → Configuration error (VPCPeering requires same namespace)
  │    │    └─ NO → Continue
  │
  ├─ Check BGP sessions in Grafana Fabric Dashboard
  │    │
  │    ├─ BGP sessions down?
  │    │    ├─ YES → Investigate BGP issue (Agent CRD bgpNeighbors)
  │    │    └─ NO → Continue
  │
  ├─ Check VPC subnet isolation flags
  │    │
  │    ├─ isolated: true but no permit?
  │    │    ├─ YES → Add permit list entry
  │    │    └─ NO → Escalate (unexpected issue)
```

**Example Usage:**

1. VPC-1 server cannot reach VPC-2 server
2. Check events: No warnings → Continue
3. Check VPCPeering permit list: Only includes VPC-1 frontend, missing VPC-2 backend
4. **Permit list incomplete → Add VPC-2 backend to permit**

---

#### Decision Tree 3: VPCAttachment Shows Success But Doesn't Work

```
kubectl describe shows no errors, but server has no connectivity
  │
  ├─ Verify VPCAttachment references correct connection
  │    │
  │    ├─ kubectl get vpcattachment <name> -o jsonpath='{.spec.connection}'
  │    │
  │    ├─ Connection matches server's actual connection?
  │    │    ├─ NO → Root cause found: Wrong connection reference
  │    │    └─ YES → Continue
  │
  ├─ Verify subnet exists in VPC
  │    │
  │    ├─ kubectl get vpc <vpc> -o yaml | grep <subnet>
  │    │
  │    ├─ Subnet exists?
  │    │    ├─ NO → Root cause found: Subnet doesn't exist
  │    │    └─ YES → Continue
  │
  ├─ Check Agent CRD for switch
  │    │
  │    ├─ VLAN configured on interface?
  │    │    ├─ NO → Reconciliation failed (check controller logs)
  │    │    └─ YES → Continue
  │
  ├─ Check nativeVLAN setting
  │    │
  │    ├─ VPCAttachment nativeVLAN matches server expectation?
  │    │    ├─ NO → Root cause found: nativeVLAN mismatch
  │    │    └─ YES → Escalate (unexpected issue)
```

**Example Usage:**

1. VPCAttachment created, no events, but server has no connectivity
2. Check connection: `server-07--unbundled--leaf-04` → Matches
3. Check subnet exists: `customer-app-vpc/frontend` → Exists
4. Check Agent CRD: VLAN 1020 configured
5. VPC expects VLAN 1025 → **VLAN mismatch (allocation conflict)**

---

## Conclusion

You've mastered the systematic troubleshooting framework for Hedgehog fabric operations!

### What You Learned

**Troubleshooting Methodology:**
- Hypothesis-driven investigation framework
- Evidence-based elimination of possibilities
- Root cause identification with confidence

**Common Failure Modes:**
- VPC attachment issues (VLAN conflicts, wrong connections)
- BGP peering problems (permit lists, communities)
- Interface errors (physical layer, MTU, congestion)
- Configuration drift (GitOps sync issues)

**Diagnostic Workflow:**
- Layer 1: kubectl events (fastest check)
- Layer 2: Agent CRD (detailed switch state)
- Layer 3: Grafana (trends and historical context)
- Layer 4: Controller logs (reconciliation details)

**Decision Trees:**
- Server cannot communicate in VPC
- Cross-VPC connectivity fails
- VPCAttachment shows success but doesn't work

### Key Takeaways

1. **Systematic approach beats random checking** - Hypothesis-driven investigation saves time and ensures thorough diagnosis

2. **Evidence collection order matters** - Start fast (events), then detailed (Agent CRD), then historical (Grafana)

3. **"Success" doesn't mean "working"** - No error events doesn't guarantee correct configuration (e.g., VLAN mismatch)

4. **Decision trees provide structure** - Follow diagnostic paths for common scenarios to avoid missing steps

5. **Root cause identification requires testing** - Eliminate possibilities until one remains, don't assume

### Next Steps

In **Module 4.1b: Hands-On Fabric Diagnosis Lab**, you'll apply this methodology in a real troubleshooting scenario. You'll:
- Use the layered diagnostic approach
- Apply decision trees to identify root cause
- Practice hypothesis-driven investigation
- Document findings and solutions

The framework you learned here is the foundation for all troubleshooting work. Master it now, and you'll diagnose issues confidently in any scenario.

---

**You're now equipped with systematic troubleshooting methodology. See you in Module 4.1b for hands-on practice!**
