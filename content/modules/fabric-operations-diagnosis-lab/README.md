---
title: "Hands-On Fabric Diagnosis Lab"
slug: "fabric-operations-diagnosis-lab"
difficulty: "intermediate"
estimated_minutes: 8
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - troubleshooting
  - diagnostics
  - hands-on
  - lab
description: "Apply systematic troubleshooting methodology in a hands-on lab, diagnosing a real VPCAttachment connectivity failure using hypothesis-driven investigation."
order: 402
---

## Introduction

In **Module 4.1a: Systematic Troubleshooting Framework**, you learned the methodology for diagnosing fabric issues:
- Hypothesis-driven investigation
- Common failure modes
- Layered diagnostic workflow (Resource check → Agent CRD → Grafana → Logs)
- Decision trees for structured diagnosis

Now it's time to **put that methodology into practice**.

### The Lab Scenario

You'll diagnose a real connectivity failure: **A VPCAttachment was created successfully — `kubectl describe` shows `Events: <none>` (expected) and agents are converged — but the server cannot communicate within the VPC.**

This is a classic troubleshooting challenge: Configuration looks correct, system reports success, but it doesn't work.

Using the systematic methodology from Module 4.1a, you'll:
1. Gather symptoms and form hypotheses
2. Test hypotheses systematically using kubectl and Grafana
3. Identify the root cause through elimination
4. Document your findings and solution

By the end of this lab, you'll have practiced the complete diagnostic workflow on a realistic scenario.

---

## Learning Objectives

By the end of this module, you will be able to:

1. **Apply hypothesis-driven investigation** - Form and test hypotheses systematically
2. **Use layered diagnostic workflow** - Progress from resource check to Agent CRD to Grafana
3. **Follow decision trees** - Apply structured diagnostic paths to real scenarios
4. **Identify VLAN configuration issues** - Diagnose VLAN conflicts and mismatches
5. **Document troubleshooting findings** - Create clear problem statements and solutions

---

## Prerequisites

Before starting this module, you should have:

**Completed Modules:**
- Module 4.1a: Systematic Troubleshooting Framework (methodology and decision trees)
- All previous courses (Courses 1-3)

**Understanding:**
- Hypothesis-driven investigation framework
- Common failure modes (VPC attachment, BGP, interface, configuration drift)
- Layered diagnostic workflow
- Decision trees for common scenarios

**Environment:**
- kubectl configured and authenticated
- Grafana access (http://YOUR_VM_IP:3000)
- Hedgehog fabric with at least one VPC deployed

---

## Scenario

**Incident Report:**

A developer reports that **server-07** in VPC **customer-app-vpc** cannot reach the gateway or other servers in the VPC. The VPCAttachment was created this morning using the standard GitOps workflow.

**Initial Investigation:**

You run `kubectl describe vpcattachment customer-app-vpc-server-07` and see `Events: <none>` — expected for fabric CRDs. The resource exists. `kubectl get agents` shows all agents converged (APPLIEDG == CURRENTG).

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

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Hands-On Lab

### Lab Overview

**Objective:** Diagnose a VPCAttachment connectivity failure using systematic troubleshooting methodology.

**Scenario:** Server-07 in VPC `customer-app-vpc` cannot reach the gateway or other servers. The VPCAttachment was created this morning — `kubectl describe` shows `Events: <none>` (expected) and agents are converged.

**Environment:**
- kubectl: Already configured
- Grafana: http://YOUR_VM_IP:3000 (admin/admin)
- Server access: Available if needed

**Known Information:**
- VPC: `customer-app-vpc`
- Subnet: `frontend` (10.20.10.0/24, gateway 10.20.10.1, VLAN 1025)
- Server: `server-07`
- Connection: `server-07--unbundled--leaf-04` (correct connection name)
- VPCAttachment: `customer-app-vpc-server-07`

---

### Task 1: Gather Symptoms and Form Hypotheses

**Estimated Time:** 2 minutes

**Objective:** Document symptoms and generate possible causes using systematic methodology.

#### Step 1.1: Document Symptoms

Write down what you know (use a text file or notebook):

```
Symptoms:
- Expected behavior: server-07 should ping gateway 10.20.10.1
- Actual behavior: ping fails with "Destination Host Unreachable"
- Recent change: VPCAttachment created today via GitOps
- kubectl describe: Events: <none> (expected — fabric CRDs do not emit K8s events)

Timeline:
- VPCAttachment created: This morning (10:00 AM)
- Issue reported: This morning (10:15 AM)
- First check (kubectl describe): No errors visible
```

This documentation helps you:
- Clarify what's actually broken
- Establish a timeline
- Identify recent changes

#### Step 1.2: Form Hypotheses

Based on symptoms, list possible causes. Use the common failure modes from Module 4.1a:

**Hypothesis List:**

1. **Wrong connection name** - VPCAttachment references incorrect switch or connection
2. **Wrong subnet** - VPCAttachment references non-existent subnet
3. **VLAN not configured** - Reconciliation failed, VLAN 1025 not on switch interface
4. **VLAN mismatch** - VLAN conflict caused different VLAN to be allocated
5. **Interface down** - leaf-04 Ethernet interface is operationally down
6. **Server interface misconfigured** - Server enp2s1 not configured correctly
7. **nativeVLAN mismatch** - VPCAttachment and server expect different VLAN tagging

**Why these hypotheses?**
- Covers configuration issues (1, 2, 4, 7)
- Covers connectivity issues (3, 5)
- Covers server-side issues (6)

#### Success Criteria

- ✅ Symptoms documented clearly
- ✅ At least 5 hypotheses listed
- ✅ Hypotheses cover configuration, connectivity, and server issues

**Time check:** You should complete this in 2 minutes or less. Don't overthink—list possibilities quickly, you'll test them systematically.

---

### Task 2: Test Hypotheses with kubectl

**Estimated Time:** 3 minutes

**Objective:** Systematically test each hypothesis using kubectl commands.

#### Step 2.1: Check VPCAttachment Configuration

Test hypotheses 1 and 2: Wrong connection or wrong subnet.

```bash
# Get full VPCAttachment spec
kubectl get vpcattachment customer-app-vpc-server-07 -o yaml

# Check connection reference
kubectl get vpcattachment customer-app-vpc-server-07 -o jsonpath='{.spec.connection}'
# Expected: server-07--unbundled--leaf-04

# Check subnet reference
kubectl get vpcattachment customer-app-vpc-server-07 -o jsonpath='{.spec.subnet}'
# Expected: customer-app-vpc/frontend
```

**Verify connection exists:**
```bash
kubectl get connection server-07--unbundled--leaf-04
# Should show: Connection exists
```

**Test Result:**
- Connection reference: ✅ Correct (server-07--unbundled--leaf-04)
- Subnet reference: ✅ Correct (customer-app-vpc/frontend)

**Hypotheses 1 and 2: ELIMINATED**

---

#### Step 2.2: Verify Subnet Exists in VPC

Test hypothesis 2 more thoroughly:

```bash
# Check if frontend subnet exists in customer-app-vpc
kubectl get vpc customer-app-vpc -o yaml | grep -A 5 "frontend:"

# Expected output shows:
#   frontend:
#     subnet: 10.20.10.0/24
#     gateway: 10.20.10.1
#     vlan: 1025
```

**Test Result:**
- Subnet exists: ✅
- VLAN specified: 1025

**Hypothesis 2: ELIMINATED (subnet exists)**

---

#### Step 2.3: Check Agent CRD for leaf-04

Test hypotheses 3, 4, and 5: VLAN configuration and interface state.

**Identify which interface server-07 connects to:**
```bash
kubectl get connection server-07--unbundled--leaf-04 -o yaml | grep "port:"
# Expected output: leaf-04/E1/8
```

**Check interface state in Agent CRD:**
```bash
# Check if interface is up
kubectl get agent leaf-04 -o json | jq '.status.state.interfaces["E1/8"].oper'
# Expected: "up"

# Check which VLANs are configured
kubectl get agent leaf-04 -o json | jq '.status.state.interfaces["E1/8"].vlans'
# Look for: VLAN list
```

**CRITICAL FINDING:**

The Agent CRD shows:
```json
{
  "oper": "up",
  "admin": "up",
  "vlans": [1020],
  ...
}
```

**Interface E1/8 is up (✅) but VLAN is 1020, not 1025!**

**Test Result:**
- Interface oper: ✅ Up (Hypothesis 5 eliminated)
- VLAN configured: ❌ VLAN 1020, expected 1025

**Hypothesis 4: CONFIRMED (VLAN mismatch)**

---

#### Step 2.4: Investigate Why VLAN is Wrong

Now that you've identified the mismatch, investigate the root cause:

```bash
# Check VPC configuration again
kubectl get vpc customer-app-vpc -o yaml | grep -A 10 "frontend:"

# Check all VLANs currently in use
kubectl get vpc -A -o yaml | grep "vlan:" | sort

# Look for VLAN 1025 usage
kubectl get vpc -A -o yaml | grep "1025"
```

**Discovery:**

Another VPC (`existing-vpc-prod`) is using VLAN 1025. When `customer-app-vpc` was created, the VLANNamespace automatically allocated VLAN 1020 instead due to the conflict!

**Root Cause Identified:**

VLAN conflict. The VPC subnet definition manually specifies VLAN 1025, but the VLANNamespace allocated VLAN 1020 because 1025 was already in use by another VPC.

**Why kubectl describe showed no errors:**

The controller successfully reconciled the VPCAttachment with VLAN 1020 (the allocated VLAN). No error occurred from the controller's perspective—the configuration just doesn't match the operator's expectation.

---

#### Step 2.5: Document Root Cause

Write your findings:

```
Root Cause:
- VLAN conflict between customer-app-vpc and existing-vpc-prod
- VPC subnet manually specified VLAN 1025
- VLANNamespace allocated VLAN 1020 instead (1025 already in use)
- Switch configured with VLAN 1020 (correct according to allocation)
- Server expects VLAN 1025 (incorrect expectation)

Evidence:
- Agent CRD shows VLAN 1020 on leaf-04/E1/8
- VPC spec shows VLAN 1025 in subnet definition
- existing-vpc-prod is using VLAN 1025

Solution:
- Update customer-app-vpc frontend subnet VLAN to 1020 (match allocation)
- OR choose a different unused VLAN for customer-app-vpc
```

#### Success Criteria

- ✅ Hypotheses tested systematically
- ✅ Root cause identified (VLAN mismatch due to conflict)
- ✅ Evidence documented
- ✅ Solution path clear

**Time check:** You should complete this in 3 minutes or less with practice.

---

### Task 3: Validate with Grafana

**Estimated Time:** 1-2 minutes

**Objective:** Confirm findings using Grafana dashboards for visual validation.

#### Step 3.1: Check Interfaces Dashboard

1. Open Grafana: http://YOUR_VM_IP:3000 (admin/admin)
2. Navigate to "Hedgehog Switch Interface Counters" dashboard
3. Set filters:
   - Switch: `leaf-04`
   - Interface: `E1/8`
4. Observe:
   - **Operational State:** Should show "up"
   - **VLANs Configured:** Should show VLAN 1020
   - **Traffic Patterns:** Should show minimal or no traffic (server can't communicate)

**Expected Finding:**

Grafana confirms:
- Interface is up ✅
- VLAN 1020 configured ✅
- Low or zero traffic (consistent with connectivity failure)

---

#### Step 3.2: Check Fabric Dashboard

1. Navigate to "Hedgehog Fabric" dashboard
2. Check BGP sessions for leaf-04
3. Verify all BGP sessions are established

**Expected Finding:**

All BGP sessions show "established" state, confirming this is not a BGP routing issue.

---

#### Step 3.3: Correlation Check

Look at Grafana timeline:
- When was VLAN 1020 added to E1/8? (Should correlate with VPCAttachment creation time)
- Any interface state changes around that time? (Should show VLAN added, no flapping)

**What Grafana Tells You:**

- Visual confirmation of Agent CRD findings
- No intermittent issues (interface stable)
- VLAN was added successfully (just the wrong VLAN ID)

#### Success Criteria

- ✅ Grafana confirms VLAN 1020 configured (not 1025)
- ✅ Interface is up and stable
- ✅ BGP sessions healthy (not a routing issue)

**Time check:** 1-2 minutes for visual confirmation.

---

### Task 4: Document Root Cause and Solution

**Estimated Time:** 1 minute

**Objective:** Write clear problem statement and solution for handoff or documentation.

#### Step 4.1: Problem Statement

Write a concise problem statement:

```
Problem Statement:

VPCAttachment customer-app-vpc-server-07 created successfully without errors,
but server-07 cannot communicate within VPC.

Root Cause:
VLAN conflict. VPC subnet specifies VLAN 1025, but switch interface configured
with VLAN 1020 due to conflict with existing-vpc-prod (already using VLAN 1025).
VLANNamespace automatically allocated VLAN 1020 instead.

Controller reconciled successfully with VLAN 1020 (no errors), but configuration
does not match operator expectation (VLAN 1025).

Impact:
- Server-07 has no connectivity within customer-app-vpc
- Application dependent on server-07 is down
```

---

#### Step 4.2: Solution Options

Document solution paths:

**Option 1 (Recommended): Update VPC VLAN to match allocation**

```bash
# Edit customer-app-vpc in Gitea
# Change frontend subnet VLAN from 1025 to 1020

# In Gitea: network-like-hyperscaler/vpcs/customer-app-vpc.yaml
spec:
  subnets:
    frontend:
      subnet: 10.20.10.0/24
      gateway: 10.20.10.1
      vlan: 1020  # Changed from 1025

# Commit change
git add vpcs/customer-app-vpc.yaml
git commit -m "Fix VLAN conflict: use allocated VLAN 1020 for customer-app-vpc frontend"
git push

# Wait for ArgoCD sync
kubectl get vpc customer-app-vpc -w

# Verify Agent convergence after ArgoCD sync
kubectl get agents   # Wait for APPLIEDG == CURRENTG
```

**Why recommended:** Aligns configuration with reality (VLAN 1020 already allocated and configured).

---

**Option 2: Choose unused VLAN**

```bash
# Check available VLANs
kubectl get vpc -A -o yaml | grep "vlan:" | sort

# Identify unused VLAN (e.g., 1026)

# Edit customer-app-vpc in Gitea
# Change frontend subnet VLAN to 1026

# Commit to Gitea, wait for sync
```

**Why consider:** If VLAN 1025 has significance (e.g., organizational standard).

---

**Option 3: Remove VLAN specification (let VLANNamespace allocate)**

```bash
# Edit customer-app-vpc in Gitea
# Remove manual VLAN specification

spec:
  subnets:
    frontend:
      subnet: 10.20.10.0/24
      gateway: 10.20.10.1
      # vlan: 1025  # Remove this line

# VLANNamespace will auto-allocate next available VLAN
```

**Why consider:** Prevents future conflicts, follows GitOps best practices.

---

#### Step 4.3: Prevention

Document how to prevent this issue in the future:

```
Prevention:

1. Do not manually specify VLANs in VPC subnets unless required
   - Let VLANNamespace auto-allocate to avoid conflicts

2. If manual VLAN required, check for conflicts first:
   kubectl get vpc -A -o yaml | grep "vlan:" | sort

3. Use VLANNamespace ranges to segregate VLAN usage:
   - VLANNamespace "production": 1000-1999
   - VLANNamespace "development": 2000-2999

4. Verify admission webhook accepted VPC at apply time:
   Check ArgoCD sync history for any webhook errors when VPC was applied
```

#### Success Criteria

- ✅ Root cause documented clearly
- ✅ Solution options identified with pros/cons
- ✅ Next steps defined
- ✅ Prevention measures documented

---

### Lab Summary

**What You Accomplished:**

You successfully diagnosed a VPCAttachment connectivity failure using systematic troubleshooting methodology:

1. ✅ Gathered symptoms and formed hypotheses
2. ✅ Tested hypotheses systematically using kubectl
3. ✅ Identified root cause (VLAN mismatch due to conflict)
4. ✅ Validated findings with Grafana
5. ✅ Documented solution path and prevention measures

**Key Techniques Used:**

- Hypothesis-driven investigation (not random checking)
- Layered diagnostic approach (resource check → Agent CRD → Grafana)
- Evidence-based elimination (tested each hypothesis)
- Root cause identification (VLAN conflict, not symptoms)

**Time to Resolution:**

- Task 1: 2 minutes (symptoms and hypotheses)
- Task 2: 3 minutes (hypothesis testing)
- Task 3: 1-2 minutes (Grafana validation)
- Task 4: 1 minute (documentation)
- **Total: 7-8 minutes from symptom to solution**

**Contrast with Random Checking:**

Without systematic methodology, you might have:
- Checked controller logs (no useful info)
- Restarted the controller (no effect)
- Deleted and recreated VPCAttachment (same result)
- Checked BGP (not relevant)
- Escalated to support (with no evidence)
- **Spent 30+ minutes without identifying root cause**

---

## Troubleshooting

### Common Lab Challenges

#### Challenge: "All my hypotheses were eliminated, but the issue persists"

**What this means:** Your initial hypothesis list didn't include the actual root cause.

**What to do:**
1. Review your evidence collection (Agent CRD, Grafana, logs)
2. Form new hypotheses based on what you *did* find
3. Example: If VLAN is configured and interface is up, maybe VLAN ID is wrong

**Key insight:** Hypothesis-driven investigation is iterative. Eliminating hypotheses is progress—it narrows the problem space.

---

#### Challenge: "I found the root cause but don't know how to fix it"

**What this means:** Diagnosis succeeded, but solution implementation is unclear.

**What to do:**
1. Consult Module 2.2 (VPC Design Patterns) for configuration guidance
2. Check Module 1.3 (GitOps Workflow) for making changes
3. Reference Hedgehog documentation for CRD field definitions

**Key insight:** Diagnosis and resolution are separate skills. This module focuses on diagnosis—Module 4.2 covers rollback and recovery.

---

#### Challenge: "kubectl commands are slow or timing out"

**What this means:** Kubernetes API server may be under load or network issues.

**What to do:**
1. Check kubectl cluster-info and basic connectivity
2. Use `--request-timeout` flag to extend timeout
3. If persistent, check control node resources (CPU, memory)

---

#### Challenge: "Grafana dashboards show 'No Data'"

**What this means:** Telemetry may not be configured or Prometheus/Loki not accessible.

**What to do:**
1. Check if telemetry is configured in Fabricator
2. Rely on kubectl and Agent CRD for this lab
3. Grafana validation is optional if telemetry is not configured

**Reference:** Module 3.1 (Telemetry and Prometheus) for telemetry setup.

---

#### Challenge: "I'm not sure which hypothesis to test first"

**What this means:** You need a prioritization strategy.

**What to do:**
Test hypotheses in this order:
1. **Fastest to check:** Resource existence + Agent convergence (10-30 seconds)
2. **Most likely:** Common failure modes from Module 4.1a
3. **Highest impact:** Issues that would affect multiple resources

**Key insight:** Start with quick checks, then move to detailed investigation.

---

### Debugging the Diagnostic Process

If you're stuck, ask yourself:

1. **Did I collect evidence from all four layers?**
   - Resource check + Agent convergence, Agent CRD, Grafana, logs

2. **Am I testing hypotheses or guessing?**
   - Each hypothesis should have a specific test

3. **Am I documenting what I find?**
   - Write down results to avoid re-checking

4. **Have I used decision trees?**
   - Follow Decision Tree 3 for "VPCAttachment shows success but doesn't work"

5. **Am I comparing expected vs. actual?**
   - VPC expects VLAN 1025, Agent CRD shows VLAN 1020 → mismatch

---

## Resources

### Reference Documentation

**Hedgehog CRD Reference:**
- VPC and VPCAttachment spec fields
- Agent CRD status fields (interfaces, bgpNeighbors, platform)
- Connection CRD structure

**Observability and Diagnostics:**
- Module 3.1: Telemetry and Prometheus
- Module 3.2: Grafana Dashboards
- Module 3.3: Agent CRD Deep Dive
- Module 3.4: Pre-Escalation Diagnostic Checklist

**GitOps Workflow:**
- Module 1.3: GitOps with Hedgehog Fabric
- Module 4.2: Rollback and Recovery (upcoming)

---

### Quick Reference: Diagnostic Commands

**Layer 1: Resource Check + Agent Convergence**
```bash
# Check if resources exist (missing = admission webhook rejected)
kubectl get vpc <name>
kubectl get vpcattachment <name>

# Check Agent convergence (APPLIEDG == CURRENTG means applied)
kubectl get agents

# Describe resource (Events: <none> is expected for fabric CRDs)
kubectl describe vpcattachment <name>
```

**Layer 2: Agent CRD**
```bash
# Check agent readiness (default namespace)
kubectl get agents

# View interface state
kubectl get agent <switch> -o json | jq '.status.state.interfaces["E1/<N>"]'

# View BGP neighbors
kubectl get agent <switch> -o jsonpath='{.status.state.bgpNeighbors}' | jq
```

**Layer 3: Grafana (http://YOUR_VM_IP:3000, admin/admin)**
- Hedgehog Fabric
- Hedgehog Switch Interface Counters
- Hedgehog Fabric Logs

**Layer 4: Logs**
```bash
# Controller logs
kubectl logs -n fab deployment/fabric-ctrl --tail=200

# Agent logs (use label selector)
kubectl logs -n fab -l "wiring.githedgehog.com/agent=<switch>"
```

---

### Decision Tree Quick Reference

**Use Decision Tree 1 when:**
- Server cannot communicate within VPC
- VPCAttachment exists, no errors

**Use Decision Tree 2 when:**
- Cross-VPC connectivity fails
- VPCPeering exists

**Use Decision Tree 3 when:**
- kubectl describe shows success
- Server has no connectivity
- No obvious errors

---

### Common VLAN Issues

| Symptom | Root Cause | Solution |
|---------|------------|----------|
| VLAN mismatch (allocated ≠ specified) | VLAN conflict | Update VPC VLAN to match allocation |
| VLAN not configured on interface | Wrong connection reference | Fix VPCAttachment connection field |
| VLAN configured but wrong ID | Manual VLAN specification conflict | Remove manual VLAN, let VLANNamespace allocate |
| nativeVLAN mismatch | VPCAttachment nativeVLAN ≠ server config | Align nativeVLAN setting with server interface |

---

### Common BGP Issues

| Symptom | Root Cause | Solution |
|---------|------------|----------|
| BGP state: idle | Neighbor IP unreachable | Check ExternalAttachment switch IP and neighbor IP |
| BGP state: active | ASN mismatch or config error | Verify ASN in ExternalAttachment matches external router |
| BGP established but no routes | Permit list missing subnets | Update VPCPeering or ExternalPeering permit |
| Routes filtered | Community mismatch | Check External inboundCommunity and outboundCommunity |

---

### Escalation Criteria

**When to escalate to support:**

1. **All decision tree paths exhausted**
   - Followed relevant decision tree to end
   - Issue doesn't match known patterns

2. **Evidence collected but root cause unclear**
   - Completed all 4 layers of diagnostic workflow
   - Findings don't point to specific root cause

3. **Suspected platform issue**
   - Agent CRD shows switch failures (PSU, temperature)
   - Controller logs show internal errors

4. **Time-sensitive production outage**
   - Issue blocking critical services
   - Need expert assistance to resolve quickly

**Before escalating, ensure you have:**
- ✅ Symptoms documented
- ✅ Hypotheses tested
- ✅ Evidence collected (events, Agent CRD, Grafana, logs)
- ✅ Decision tree followed
- ✅ Relevant kubectl outputs saved

Reference Module 4.3 (Coordinating with Support) for escalation procedures.

---

### Next Steps

**Module 4.2: Rollback and Recovery**

Learn how to safely undo changes when things go wrong:
- GitOps rollback procedures
- Safe deletion order for Hedgehog resources
- Handling stuck resources
- Emergency recovery patterns

**Module 4.3: Coordinating with Support**

Learn how to work effectively with Hedgehog support:
- Crafting effective support tickets
- Providing diagnostic evidence
- Troubleshooting with support engineers
- Post-resolution follow-up

**Module 4.4: Post-Incident Review**

Learn how to conduct effective post-incident reviews:
- Documenting incidents
- Root cause analysis
- Prevention measures
- Knowledge sharing

---

## Assessment

Test your understanding of systematic troubleshooting methodology.

### Question 1: Troubleshooting Methodology

**Scenario:** Server-03 in VPC `prod-vpc` cannot reach server-04 in the same VPC. Both VPCAttachments exist and all agents are converged (APPLIEDG == CURRENTG).

What is your NEXT diagnostic step using systematic methodology?

- A) Restart the fabric controller
- B) Check Agent CRD to verify VLANs configured on both switch interfaces
- C) Escalate to support immediately
- D) Delete and recreate both VPCAttachments

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Check Agent CRD to verify VLANs configured on both switch interfaces

**Explanation:**

Following the diagnostic workflow (Layer 1: Events → Layer 2: Agent CRD):

1. **You've completed Layer 1** (resource check + agents converged) - configuration accepted
2. **Next step is Layer 2** (Agent CRD) - verify switch configuration

**Why B is correct:**
- Agent CRD shows actual switch interface configuration
- Reveals if VLANs are properly configured
- Tests hypothesis: "VLAN configuration issue"
- Follows systematic layered approach

**Example commands:**
```bash
# Identify which switches server-03 and server-04 connect to
kubectl get vpcattachment prod-vpc-server-03 -o jsonpath='{.spec.connection}'
kubectl get vpcattachment prod-vpc-server-04 -o jsonpath='{.spec.connection}'

# Check Agent CRD for those switches
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'
kubectl get agent leaf-02 -o json | jq '.status.state.interfaces["E1/6"]'

# Look for: VLAN configured, interface oper=up
```

**Why others are wrong:**

**A) Restart controller:**
- No evidence of controller failure
- Premature action without diagnosis
- Could disrupt fabric unnecessarily
- VPCAttachments exist (controller is working)

**C) Escalate to support:**
- Haven't completed basic troubleshooting
- No evidence collected yet from Agent CRD or Grafana
- Should check switch state first
- Escalation should be last resort after diagnostic workflow

**D) Delete and recreate VPCAttachments:**
- No diagnosis performed yet
- May not fix underlying issue (e.g., VLAN conflict)
- Could make troubleshooting harder (lose state)
- Action without understanding root cause

**Systematic approach:** Complete evidence collection (all 4 layers) before taking corrective action.

**Module Reference:** Module 4.1a - Concept 3: Diagnostic Workflow (Layer 2: Agent CRD Status)
</details>

---

### Question 2: Common Failure Modes

**Scenario:** You observe these symptoms:
- VPCPeering between `vpc-a` and `vpc-b` exists
- kubectl describe shows no errors
- Server in `vpc-a` can ping its own gateway
- Server in `vpc-a` CANNOT ping server in `vpc-b`

Which failure mode is most likely?

- A) BGP peering problem (sessions down)
- B) VPC isolation settings or permit list misconfiguration
- C) Interface errors (physical layer issue)
- D) Configuration drift (GitOps reconciliation failure)

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) VPC isolation settings or permit list misconfiguration

**Explanation:**

**Symptoms indicate:**
- ✅ Intra-VPC connectivity works (can ping gateway)
- ❌ Cross-VPC connectivity fails
- ✅ VPCPeering resource exists
- ✅ No error events

This pattern strongly suggests a **permit list issue**.

**Why B is correct:**

VPCPeering failure modes include:

1. **Permit list missing subnets** - VPCPeering exists but doesn't include required subnets
   ```yaml
   spec:
     permit:
       - vpc-a: {subnets: [frontend]}  # Missing backend subnet!
         vpc-b: {subnets: [dmz]}
   ```

2. **VPC isolation=true without permit** - Subnet marked isolated but no permit list entry
   ```yaml
   # In vpc-a:
   subnets:
     backend:
       isolated: true  # Isolated from other subnets
   # But VPCPeering permit doesn't include backend → blocked
   ```

3. **Different IPv4Namespaces** - VPCPeering requires same namespace
   ```bash
   kubectl get vpc vpc-a -o jsonpath='{.spec.ipv4Namespace}'
   # Output: production
   kubectl get vpc vpc-b -o jsonpath='{.spec.ipv4Namespace}'
   # Output: development  # DIFFERENT! VPCPeering won't work
   ```

**Diagnostic steps:**
```bash
# Check permit list
kubectl get vpcpeering vpc-a--vpc-b -o yaml

# Look for:
spec:
  permit:
    - vpc-a: {subnets: [...]}
      vpc-b: {subnets: [...]}

# Verify both subnets are included

# Check VPC isolation flags
kubectl get vpc vpc-a -o jsonpath='{.spec.subnets.*.isolated}'
```

**Why others are wrong:**

**A) BGP peering problem:**
- Intra-VPC connectivity works, so fabric underlay BGP likely up
- Would affect more than just cross-VPC traffic
- Symptoms would include gateway unreachable
- Check with: `kubectl get agent <switch> -o jsonpath='{.status.state.bgpNeighbors}' | jq`

**C) Interface errors:**
- Would affect intra-VPC connectivity too
- Server can ping gateway (interface working)
- Would see errors in Grafana Interface Dashboard
- Symptoms: intermittent failures, packet loss

**D) Configuration drift:**
- VPCPeering exists (not a sync issue)
- No evidence of ArgoCD OutOfSync
- kubectl describe shows no errors
- No evidence of reconciliation failure (ArgoCD shows Synced, agents converged)

**Decision Tree:** Use Decision Tree 2 (Cross-VPC Connectivity Fails) from Module 4.1a.

**Module Reference:** Module 4.1a - Concept 2: Common Failure Modes
</details>

---

### Question 3: Decision Trees

**Scenario:** Using Decision Tree 3 ("VPCAttachment Shows Success But Doesn't Work"), you've verified:
- VPCAttachment references correct connection ✅
- Subnet exists in VPC ✅
- Agent CRD shows VLAN configured on interface ✅

According to the decision tree, what should you check NEXT?

- A) Controller logs for reconciliation errors
- B) Grafana Interface Dashboard for errors
- C) nativeVLAN setting matches server expectation
- D) Escalate immediately (all checks passed)

<details>
<summary>Answer & Explanation</summary>

**Answer:** C) nativeVLAN setting matches server expectation

**Explanation:**

**Decision Tree 3 path:**

```
VPCAttachment shows success but doesn't work
  ↓
Verify connection reference ✅ (already checked)
  ↓
Verify subnet exists ✅ (already checked)
  ↓
Check Agent CRD for VLAN ✅ (already checked)
  ↓
→ Check nativeVLAN setting ← YOU ARE HERE
  ↓
Escalate if still unresolved
```

**Why C is correct:**

**nativeVLAN mismatch is a common issue:**

**Scenario 1: VPCAttachment expects tagged, server expects untagged**
```yaml
# VPCAttachment
spec:
  nativeVLAN: false  # Switch sends tagged VLAN 1010 traffic

# Server interface (expects untagged)
# Interface: enp2s1 (no VLAN subinterface)
# Result: Server sees VLAN-tagged frames, doesn't process them → no connectivity
```

**Scenario 2: VPCAttachment expects untagged, server expects tagged**
```yaml
# VPCAttachment
spec:
  nativeVLAN: true  # Switch sends untagged traffic

# Server interface (expects tagged)
# Interface: enp2s1.1010 (VLAN subinterface)
# Result: Server expects VLAN tag, receives untagged → no connectivity
```

**How to check:**

```bash
# VPCAttachment nativeVLAN setting
kubectl get vpcattachment customer-app-vpc-server-07 -o jsonpath='{.spec.nativeVLAN}'
# Output: false (tagged) or true (untagged)

# Server interface configuration (SSH to server)
ip link show
# Look for:
# enp2s1: <BROADCAST,MULTICAST,UP,LOWER_UP>  ← Untagged interface
# enp2s1.1010: <BROADCAST,MULTICAST,UP,LOWER_UP>  ← Tagged interface

# If VPCAttachment nativeVLAN=false, server should have enp2s1.1010
# If VPCAttachment nativeVLAN=true, server should have enp2s1 (no subinterface)
```

**Resolution:**

```bash
# Option 1: Update VPCAttachment to match server
# In Gitea: change nativeVLAN setting

# Option 2: Update server interface configuration
# Add VLAN subinterface or remove it to match VPCAttachment
```

**Why others are wrong:**

**A) Controller logs:**
- Agent CRD shows VLAN configured (reconciliation succeeded)
- Logs won't reveal server-side configuration issue
- Controller successfully applied configuration
- No error events (controller perspective is success)

**B) Grafana Interface Dashboard:**
- Already verified VLAN configured via Agent CRD
- Physical layer likely working (VLAN present)
- Doesn't check nativeVLAN setting (tagged vs. untagged)
- Grafana shows interface up, VLAN configured—appears healthy

**D) Escalate immediately:**
- Decision tree not complete yet
- One more hypothesis to test (nativeVLAN)
- Premature escalation
- Should exhaust decision tree before escalating

**Best Practice:**

Always check nativeVLAN when:
- VPCAttachment exists, no errors
- VLAN configured correctly
- Interface up
- Server still has no connectivity

This is a **configuration mismatch** between VPCAttachment and server—easy to overlook but common in practice.

**Module Reference:** Module 4.1a - Concept 4: Decision Trees (Decision Tree 3)
</details>

---

### Question 4: Diagnostic Workflow

**Scenario:** You're investigating a connectivity issue. Resources exist, agents are converged (APPLIEDG == CURRENTG), and Agent CRD shows all interfaces up with VLANs configured correctly. Server still cannot communicate.

Why should you check Grafana BEFORE checking controller logs?

- A) Grafana is faster to load than kubectl logs
- B) Grafana provides visual trends and historical context (e.g., intermittent errors over time)
- C) Controller logs are unreliable
- D) Grafana is always the first troubleshooting step

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Grafana provides visual trends and historical context (e.g., intermittent errors over time)

**Explanation:**

**Diagnostic Workflow Order:**

1. **Resource check + Agent convergence** - Fast check for existence and reconciliation
2. **Agent CRD** - Current switch state (detailed config)
3. **Grafana** - Historical trends and visual patterns ← YOU ARE HERE
4. **Controller logs** - Reconciliation details (specific events)

**Why Grafana before controller logs:**

**Grafana reveals patterns that kubectl cannot:**

**Example 1: Intermittent Interface Errors**
```
Agent CRD (right now):
- Interface E1/8: oper=up, ind=0 (no discards)
- Looks healthy!

Grafana Switch Interface Counters (last 6 hours):
- 10:00 AM: 0 discards
- 11:30 AM: Spike to 10,000 input discards
- 12:00 PM: Back to 0 discards
- Pattern: Intermittent issue, not current state problem
```

**Without Grafana:** You see current state (healthy) and miss the intermittent errors.

**With Grafana:** You see the spike and know to investigate physical layer or MTU issues.

**Example 2: BGP Flapping**
```
Agent CRD (right now):
- BGP neighbor 172.30.128.10: state=established
- Looks healthy!

Grafana Fabric Dashboard (last 24 hours):
- BGP session up/down 15 times
- Pattern: Flapping session, unstable routing
```

**Without Grafana:** You see current state (established) and miss the instability.

**With Grafana:** You see the flapping and investigate route filtering or keepalive issues.

**Example 3: Traffic Patterns**
```
Agent CRD (right now):
- Interface E1/8: oper=up
- Counters: inb=123456 (historical total), outb=654321

Grafana Interface Dashboard (last 1 hour):
- Traffic: Zero bytes in/out for entire hour
- Pattern: Interface up but no traffic (server not sending)
```

**Without Grafana:** You see non-zero counters (historical total) and assume traffic flowing.

**With Grafana:** You see zero current traffic and know server-side issue.

**Controller logs:**
- Show reconciliation events (discrete actions)
- Don't show operational metrics over time
- Useful for understanding "why did controller make this decision?"
- Not useful for "is this interface flapping over time?"

**Example controller log:**
```
2025-10-17T10:15:00Z INFO Reconciling VPCAttachment customer-app-vpc-server-07
2025-10-17T10:15:01Z INFO VLAN 1020 configured on leaf-04/E1/8
2025-10-17T10:15:02Z INFO Reconciliation successful
```

Logs show discrete reconciliation success, not ongoing operational state.

**Why others are wrong:**

**A) Grafana is faster:**
- Not the reason for ordering
- kubectl can be just as fast (or faster)
- Speed is not the primary consideration
- Order is about information type, not speed

**C) Controller logs unreliable:**
- **False** - controller logs are critical for reconciliation debugging
- Just not useful for trending/historical analysis
- Logs are reliable but serve different purpose
- Use logs for "why did controller fail?" not "is interface flapping?"

**D) Grafana always first:**
- **False** - Resource check + Agent convergence should be first (fastest check)
- Correct order: Resource check → Agent CRD → Grafana → Logs
- Grafana is Layer 3, not Layer 1
- Resource check catches rejected specs; Agent convergence catches reconciliation stalls

**When to use each tool:**

| Tool | When to Use |
|------|-------------|
| kubectl get + agents | First check: Resource accepted? Agents converged? |
| Agent CRD | Second: What is current switch state? |
| Grafana | Third: Are there patterns over time? Intermittent issues? |
| Controller logs | Fourth: Why did reconciliation fail or succeed? |

**Practical Example:**

**Scenario:** Server reports "occasional packet loss"

1. **Resource check:** Resources exist, APPLIEDG == CURRENTG (rules out rejection/stall)
2. **Agent CRD:** Interface up, 0 errors right now (looks healthy)
3. **Grafana:** Shows error spike every 15 minutes for last 6 hours → **Root cause visible!**
4. **Controller logs:** Not needed (issue is operational, not reconciliation)

**Grafana revealed the intermittent pattern that Agent CRD (current state) missed.**

**Module Reference:** Module 4.1a - Concept 3: Diagnostic Workflow (Layer 3: Grafana Dashboards)
</details>

---

## Conclusion

You've completed Module 4.1b: Hands-On Fabric Diagnosis Lab!

### What You Learned

**Practical Application:**
- Applied hypothesis-driven investigation to real scenario
- Used layered diagnostic workflow (Events → Agent CRD → Grafana)
- Followed decision trees for structured diagnosis
- Identified VLAN mismatch through systematic testing

**Troubleshooting Skills:**
- Form and test hypotheses systematically
- Eliminate possibilities through evidence
- Document findings clearly
- Propose multiple solution options

**Time Efficiency:**
- Diagnosed issue in 7-8 minutes using systematic approach
- Contrast: Random checking could take 30+ minutes without success
- Systematic methodology saves time and ensures thorough diagnosis

### Key Takeaways

1. **Systematic approach is faster** - 7-8 minutes with methodology vs. 30+ minutes randomly checking

2. **Hypothesis elimination is progress** - Each test narrows the problem space

3. **VLAN conflicts are subtle** - Controller shows success but configuration doesn't match expectation

4. **Documentation enables handoff** - Clear problem statement and solution options support team collaboration

5. **Prevention matters** - Document lessons to prevent recurrence

### Troubleshooting Mindset

As you continue operating Hedgehog fabrics:

- **Stay systematic:** Don't jump to conclusions based on hunches
- **Test hypotheses:** Verify assumptions with evidence
- **Document findings:** Track what you've checked to avoid re-work
- **Think about "why":** Understand the cause, not just the symptom
- **Iterate when needed:** If all hypotheses eliminated, form new ones based on evidence

### Course 4 Progress

**Completed:**
- ✅ Module 4.1a: Systematic Troubleshooting Framework
- ✅ Module 4.1b: Hands-On Fabric Diagnosis Lab

**Up Next:**
- Module 4.2: Rollback and Recovery (safe undo procedures, handling stuck resources)
- Module 4.3: Coordinating with Support (effective tickets, working with engineers)
- Module 4.4: Post-Incident Review (documentation, prevention, knowledge sharing)

---

**You're now equipped to diagnose fabric issues systematically and confidently. See you in Module 4.2!**
