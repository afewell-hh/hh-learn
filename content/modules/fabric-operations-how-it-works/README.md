---
title: "How Hedgehog Works: The Control Model"
slug: "fabric-operations-how-it-works"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.1.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - control-plane
  - kubernetes
  - vpc
  - automation
description: "Understand Hedgehog's declarative control loop, create your first VPC, and trace reconciliation from CRDs to switches."
order: 102
---

# Module 1.2: How Hedgehog Works: The Control Model

**Course:** Course 1 - Foundations & Interfaces
**Duration:** 15 minutes
**Prerequisites:** Module 1.1: Welcome to Fabric Operations

---

## Introduction

### The Magic Explained

In Module 1.1, you used kubectl to explore the fabric. You saw switches, servers, and connections—all represented as Kubernetes resources. But how does typing `kubectl apply -f vpc.yaml` actually configure switches?

It's not magic. It's **declarative infrastructure** with a well-designed control loop. Understanding this pattern is the key to operating confidently: you'll know what's happening behind the scenes, when things are working, and how to detect when they're not.

### From Intent to Reality

**Traditional networking:** You configure each switch manually. If a switch reboots, you reconfigure it. If you want consistency, you write scripts.

**Hedgehog approach:** You declare your intent once. The fabric continuously reconciles actual state to match desired state. If a switch reboots, it automatically rejoins and reconfigures itself.

This declarative model lets you manage network intent without configuring each switch by hand.

### What You'll Learn

This module demystifies the control model:

- How CRDs represent network intent
- How controllers watch for changes and take action
- How switch agents apply configurations
- How to observe this process in real-time

You'll create your first VPC, inspect the stored intent, and distinguish that from switch-facing Agent state.

### Learning Objectives

By the end of this module, you will be able to:

1. **Explain the CRD reconciliation pattern** - Describe how desired state (kubectl apply) becomes actual state (switch configuration)
2. **Identify the key components** - Recognize Fabric Controller, Agent CRDs, and switch agents in the control flow
3. **Observe reconciliation in action** - Inspect the VPC object and understand when Agent status can confirm a switch change
4. **Interpret Agent CRD status** - Use Agent CRD to view switch operational state and reconciliation progress
5. **Understand abstraction boundaries** - Explain what the operator manages (CRDs) vs. what the system manages (switch configs)

---

## Core Concepts

### Concept 1: Desired State vs. Current State

Every declarative system has two views of the world:

**Desired State:** What you want (defined in CRDs)

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: my-vpc
spec:
  subnets:
    default:
      subnet: 10.10.1.0/24
      vlan: 1001
```

**Current State:** What exists right now (switch configurations, actual VLANs, routes)

**The Control Loop:** Continuously measures the gap and takes actions to close it.

```
┌─────────────┐
│ Desired     │  "I want VPC with VLAN 1001"
│ State       │
│ (CRD)       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controller  │  "Compare desired vs. current"
│ Loop        │  "Generate switch configs"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Current     │  "VLAN 1001 is configured on switches"
│ State       │
│ (Switches)  │
└─────────────┘
```

If current ≠ desired, the controller takes action. If current = desired, nothing happens (idempotent).

### Concept 2: The Hedgehog Control Plane Components

**Three key actors:**

**1. Fabric Controller (Control Plane)**

- Runs in Kubernetes (fab namespace)
- Watches for CRD changes (VPC, VPCAttachment, etc.)
- Computes desired switch configurations
- Generates Agent CRD specs (instructions for switches)
- Doesn't directly touch switches—works through Agents

**2. Agent CRD (Bridge)**

- One Agent CRD per switch (lives in Kubernetes)
- Contains two key sections:
  - `spec`: Desired configuration (written by Fabric Controller)
  - `status`: Current state (reported by switch agent)
- The "contract" between controller and switch

**3. Switch Agent (On Each Switch)**

- Runs on SONiC switches (not in Kubernetes)
- Watches its Agent CRD for spec changes
- Applies configurations via gNMI (SONiC config interface)
- Reports status back to Agent CRD (NOS version, interface states, BGP neighbors, etc.)

**Data Flow:**

```
You                  Fabric Controller       Agent CRD         Switch Agent        SONiC Switch
│                           │                    │                  │                    │
├─ apply attached VPC ────>│                    │                  │                    │
│                           │                    │                  │                    │
│                           ├─ Watch VPC CRD     │                  │                    │
│                           ├─ Compute config    │                  │                    │
│                           │                    │                  │                    │
│                           ├─ Update Agent spec ───>               │                    │
│                           │                    │                  │                    │
│                           │                    │<── Watch spec ───┤                    │
│                           │                    │                  │                    │
│                           │                    │                  ├─ Apply via gNMI ──>│
│                           │                    │                  │                    │
│                           │                    │                  │<─── Config ACK ────┤
│                           │                    │                  │                    │
│                           │                    │<── Report status─┤                    │
│                           │                    │                  │                    │
│<─── kubectl get vpc ──────┤                    │                  │                    │
│     (shows desired spec)  │                    │                  │                    │
```

### Concept 3: Switch-Facing Reconciliation

When a VPC has attachments that affect switches, the control loop proceeds through these stages:

**Example: Updating an attached VPC**

1. **Updated:** The VPC desired spec changes in Kubernetes
2. **Reconciling:** Fabric Controller picks up the change
3. **Computing:** Controller calculates which switches, if any, need configuration
4. **Agent Update:** Controller writes changed specs to relevant Agent CRDs when needed
5. **Applying:** Switch agents apply configurations via gNMI
6. **Status Report:** Affected Agents report the applied generation in Agent CRD status
7. **Observe:** The VPC object shows desired state; Agent status reports applied generations when a switch configuration changes

You can observe reconciliation progress via **Agent CRD status**:

```bash
# Check that the agent's applied generation matches its current generation
kubectl get agents

# APPLIED column shows the last time config was applied to the switch
# APPLIEDG and CURRENTG columns should match when reconciliation is complete
```

**Note on Kubernetes Events:** In the current version of Hedgehog Fabric, the fabric controller does not emit Kubernetes events for VPC operations. If you run `kubectl get events --field-selector involvedObject.name=<vpc-name>` after creating a VPC, you will typically see no results — this is expected behavior, not an error. Verify reconciliation via agent status instead (shown in the lab below).

Agent generation is a window into switch-facing changes. An unattached VPC can be stored without changing an Agent generation.

### Concept 4: Why This Model Matters for Operators

**Benefits:**

1. **Self-healing:** Switch reboots? Agent reapplies config automatically
2. **Declarative:** Describe what you want, not how to configure it
3. **Idempotent:** Apply the same YAML repeatedly—safe and predictable
4. **Observable:** VPC desired state and Agent status show different parts of the control loop
5. **Git-friendly:** CRDs are YAML files—version control, code review, GitOps

**What You Control:**

- VPC definitions (subnets, VLANs, DHCP)
- VPCAttachments (which servers connect to which VPCs)
- VPCPeering (inter-VPC connectivity)
- External connectivity (border leaf peering)

**What the System Controls:**

- Individual switch configurations (SONiC config DB)
- BGP peering between switches
- VXLAN tunnel setup
- Route distribution

You work at a higher abstraction level—the system handles the complexity. This isn't a limitation; it's **empowerment**. You're freed from managing thousands of configuration lines across dozens of switches, allowing you to focus on network intent rather than implementation details.

### Concept 5: The Agent CRD as Source of Truth

Remember from Module 1.1: Most Hedgehog CRDs have minimal status fields. The real operational state lives in **Agent CRDs**.

**Agent CRD contains:**

- NOS version (SONiC version)
- Platform info (switch model)
- Interface states (up/down, speed)
- BGP neighbor status (established, down)
- ASIC resource usage (routes, nexthops)
- System health metrics

**Why this matters:**

- VPC desired spec shows the requested network; check Agent CRDs for reported switch state
- Troubleshooting connectivity → Check Agent CRD for interface status
- Monitoring fabric health → Watch Agent CRD status fields

Agent CRDs are your deep observability layer.

---

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center?hsLang=en-us) module first — it takes about 20 minutes and only needs to be done once.

## Hands-On Lab

### Lab Title: Create a VPC and Observe Reconciliation

**Overview:**

You'll create your first VPC, read its desired spec, and inspect Agent CRDs to see how switches report their state. An unattached VPC may not change any Agent spec, so this lab does not claim to observe a switch reconfiguration.

**Environment:**

- Same Hedgehog vlab from Module 1.1
- kubectl access to create VPCs
- Access to VPC and Agent resources

---

### Task 1: Prepare to Observe

**Objective:** Confirm you can read the VPC and Agent resources before creating anything

**Steps:**

```bash
kubectl config current-context
kubectl get agents
```

**Note:** The pinned Fabric version does not emit Kubernetes Events for VPC operations. A separate event watcher is not needed for this lab.

**Success Criteria:**

- ✅ Have terminal(s) ready
- ✅ kubectl access verified

---

### Task 2: Create Your First VPC

**Objective:** Create a simple VPC and apply it to the fabric

**Steps:**

**Create VPC YAML:**

```bash
cat > test-vpc.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: test-vpc
  namespace: default
spec:
  ipv4Namespace: default
  vlanNamespace: default
  subnets:
    default:
      subnet: 10.99.1.0/24
      gateway: 10.99.1.1
      vlan: 1999
      dhcp:
        enable: true
        range:
          start: 10.99.1.10
          end: 10.99.1.99
EOF
```

**Apply the VPC:**

```bash
kubectl apply -f test-vpc.yaml

# Expected output:
# vpc.vpc.githedgehog.com/test-vpc created
```

**Verify VPC was created:**

```bash
# Check VPC appears in list
kubectl get vpc test-vpc

# Expected output:
# NAME       IPV4NS    VLANNS    AGE
# test-vpc   default   default   5s
```

**Inspect Agent generations:**

```bash
# Check baseline Agent status. An unattached VPC need not change any Agent.
kubectl get agents

# Expected baseline: APPLIEDG == CURRENTG for all seven Agents.
# NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION
# leaf-01    server-leaf   VS-01 MCLAG 1   2m        6          6          v0.96.2
# ...
```

> **Note on events:** The current Fabric version does not emit Kubernetes Events for VPC operations. Read `test-vpc` to confirm its stored spec; Agent status reports only the current switch baseline for this unattached VPC.

**Success Criteria:**

- ✅ VPC created without errors (`vpc.vpc.githedgehog.com/test-vpc created`)
- ✅ VPC object exists in cluster (`kubectl get vpc test-vpc` succeeds)
- ✅ Agent APPLIEDG and CURRENTG match (baseline Agent state; the unattached VPC may not change them)

---

### Task 3: Inspect Agent CRD State

**Objective:** Distinguish the VPC desired spec from Agent configuration and status

**Steps:**

```bash
# View all Agent CRDs (one per switch) — agents live in the default namespace
kubectl get agents

# Expected output:
# NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION
# leaf-01    server-leaf   VS-01 MCLAG 1   Xm        6          6          v0.96.2
# leaf-02    server-leaf   VS-02 MCLAG 1   Xm        6          6          v0.96.2
# ... (7 agents total)
```

**Inspect an Agent to see configuration:**

```bash
# Look at leaf-01's Agent CRD
kubectl get agent leaf-01 -o yaml | head -50

# Look for these sections:
# - spec: Contains desired configuration (from Fabric Controller)
# - status: Contains switch operational state (from switch agent)
```

**Check Agent status for reconciliation and operational info:**

```bash
# View Agent status (switch reported state)
kubectl get agent leaf-01 -o yaml | grep -A 20 "status:"

# Look for:
# - conditions: Applied=True means switch successfully received config
# - lastAppliedGen / lastAppliedTime: When config was last applied
# - state.bgpNeighbors: BGP peering status
```

**Observation Questions:**

1. Can you see the NOS version in the Agent status? _______
2. Are interfaces listed in the status? _______
3. What information does the Agent provide that VPC doesn't? _______

**Success Criteria:**

- ✅ Can view Agent CRDs
- ✅ Can see spec and status sections
- ✅ Understand Agent shows switch operational state

---

### Task 4: Verify the VPC Object and Agent Baseline

**Objective:** Confirm the VPC was stored and inspect reported Agent state without assuming an unattached VPC reconfigured switches

**Steps:**

```bash
# Read the stored VPC intent; status may be empty
kubectl get vpc test-vpc -o yaml
```

**Inspect agent status:**

```bash
# Check agent conditions — Applied=True means switch received and applied config
kubectl get agent leaf-01 -o yaml | grep -A 10 "conditions:"

# Expected output:
# conditions:
# - message: Config applied, gen=6
#   reason: ApplySucceeded
#   status: "True"
#   type: Applied
```

**Describe the VPC:**

```bash
kubectl describe vpc test-vpc

# Shows spec and metadata; the Events section will be empty — this is expected
```

**Key Insight:**

VPC status is intentionally minimal, and Hedgehog does not currently emit Kubernetes events for VPC operations. For a switch configuration change, `Applied=True` and `APPLIEDG == CURRENTG` report that the Agent applied its current spec. The unattached `test-vpc` may not enter an Agent spec, so these values alone do not prove this VPC reached a switch.

**Success Criteria:**

- ✅ VPC object stable (can be retrieved without errors)
- ✅ Agent conditions show `Applied=True` for the current Agent spec, if present
- ✅ Agent APPLIEDG matches CURRENTG for all switches at the observed baseline

---

### Task 5: Optional - Modify the Unattached VPC

**Objective:** Change VPC desired state and observe what the API stores

**Steps:**

**Modify the VPC (add a second subnet):**

```bash
cat > test-vpc-updated.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: test-vpc
  namespace: default
spec:
  ipv4Namespace: default
  vlanNamespace: default
  subnets:
    default:
      subnet: 10.99.1.0/24
      gateway: 10.99.1.1
      vlan: 1999
      dhcp:
        enable: true
        range:
          start: 10.99.1.10
          end: 10.99.1.99
    backend:
      subnet: 10.99.2.0/24
      gateway: 10.99.2.1
      vlan: 1998
EOF
```

**Apply the update:**

```bash
kubectl apply -f test-vpc-updated.yaml

# Expected output:
# vpc.vpc.githedgehog.com/test-vpc configured
```

**Verify the VPC update:**

```bash
# The VPC-only edit need not change any Agent generation while unattached
kubectl get agents

# Then confirm both subnets are present in the VPC spec:
kubectl get vpc test-vpc -o yaml | grep -E "(backend|default|subnet:)"
```

**Observe:** The VPC object changes. Without a VPCAttachment, the edit need not enter any switch Agent spec or advance `APPLIEDG`. Course 2 attaches servers and observes the switch-facing change.

**Success Criteria:**

- ✅ Update applied without errors (`vpc.vpc.githedgehog.com/test-vpc configured`)
- ✅ VPC now has two subnets (backend and default visible in YAML)
- ✅ No Agent generation increment is required for this unattached VPC edit

---

### Lab Summary

**What you did:**

- ✅ Created your first VPC using kubectl apply
- ✅ Inspected VPC desired state and Agent baseline separately
- ✅ Inspected Agent CRDs to see switch operational state
- ✅ Verified that the VPC desired spec was stored and read the Agent baseline
- ✅ (Optional) Modified the unattached VPC and checked the stored spec

**What you learned:**

- Declarative infrastructure: You declare desired state, the system reconciles
- Control loop: Fabric Controller → Agent CRD → Switch Agent → SONiC
- VPC desired state and Agent status answer different questions; VPC Events are absent in this release
- Agent CRDs contain deep switch operational state
- Changes are automatically reconciled (self-healing)

**Key insight:** You didn't log into a single switch, yet network configuration happened across the fabric. That's the power of the abstraction—and why understanding the control model lets you operate confidently.

---

## Wrap-Up

### Key Takeaways

1. **Desired state (CRD) → Actual state (switches)** via the reconciliation loop
2. **Three actors:** Fabric Controller, Agent CRD, Switch Agent
3. **Observe the right signal:** Read VPC desired state; use Agent status when a switch spec changes
4. **Agent CRDs are deep observability:** Switch operational state lives here
5. **Abstraction means power:** You manage intent, the system handles complexity

### Real-World Impact

You now understand:

- Why kubectl apply is safe (idempotent, declarative)
- What "reconciling" means (closing the gap between desired and actual)
- Where to look when troubleshooting (VPC desired state and Agent CRD status)
- Why Hedgehog is self-healing (continuous reconciliation)

### Preview of Module 1.3

Next, you'll go deeper into **kubectl and YAML workflows**: how to write VPC specs, validate before applying, use kubectl efficiently, and follow best practices for managing CRDs. You'll become fluent in the primary tool you'll use daily.

---

## Assessment

### Quiz Questions

**Question 1: Multiple Choice**

In the Hedgehog control model, what is the role of the **Fabric Controller**?

- A) Directly configures switches via SSH
- B) Watches CRDs, computes configurations, updates Agent CRD specs
- C) Runs on switches and applies configurations
- D) Stores VPC definitions in a database

<details>
<summary>Show Answer</summary>

**Correct Answer:** B

**Explanation:**

The Fabric Controller runs in Kubernetes, watches for CRD changes (VPCs, VPCAttachments, etc.), computes desired switch configurations, and writes them to Agent CRD specs. It doesn't directly touch switches (that's the Switch Agent's job, C), doesn't use SSH (A), and CRDs are stored in Kubernetes etcd, not a separate database (D).

</details>

---

**Question 2: Scenario-Based**

You update an existing VPC that already has a server attachment, producing a switch-facing configuration change. What is the correct order of operations?

1. Switch Agent applies config via gNMI
2. Fabric Controller updates Agent CRD spec
3. VPC CRD spec updated in Kubernetes
4. Fabric Controller watches VPC CRD and computes config

<details>
<summary>Show Answer</summary>

**Answer:** 3 → 4 → 2 → 1

**Explanation:**

Correct flow for a switch-facing change: VPC CRD spec updated (3), Fabric Controller watches and computes (4), Controller updates affected Agent specs (2), and those Switch Agents apply via gNMI (1). The unattached `test-vpc` in this lab need not update an Agent spec.

</details>

---

**Question 3: True/False**

True or False: If a switch reboots, you must manually re-run `kubectl apply` to reconfigure it.

<details>
<summary>Show Answer</summary>

**Answer:** False

**Explanation:**

The switch agent automatically re-reads its Agent CRD when it comes back online and reapplies all configurations. This is **self-healing**—one of the key benefits of declarative infrastructure. Manual intervention is not required.

</details>

---

**Question 4: Multiple Choice**

Where can you find detailed information about a switch's BGP neighbors and interface states?

- A) VPC CRD status field
- B) Agent CRD status field
- C) Fabric Controller logs only
- D) You must SSH into the switch

<details>
<summary>Show Answer</summary>

**Correct Answer:** B

**Explanation:**

Agent CRD status contains comprehensive switch operational state reported by the switch agent, including BGP neighbors, interface states, ASIC resources, and NOS version. VPC status (A) is minimal. Controller logs (C) help but aren't the primary source. SSH (D) is possible but not the operator's tool—kubectl is.

</details>

---

**Question 5: Practical**

You apply an unattached VPC. Which two kubectl reads distinguish stored VPC intent from reported switch state?

<details>
<summary>Show Answer</summary>

**Answer:**

```bash
kubectl get vpc test-vpc -o yaml  # Confirms the desired VPC spec was stored
kubectl get agents                # Shows reported applied/current generations
```

The VPC read proves the API stored the object. Agent generation equality reports the Agents' current configuration baseline; an unattached VPC may not change any Agent spec or generation. An empty VPC Events section does not prove reconciliation or dataplane behavior.

</details>

---

### Practical Assessment

**Task:** Inspect the `test-vpc` you created and explain what the API and Agents each report. Keep it for Module 1.3.

**Steps:**

1. Confirm `test-vpc` exists and inspect its spec with `kubectl get vpc test-vpc -o yaml`.
2. Run `kubectl get agents` and compare `APPLIEDG` with `CURRENTG` on all seven.
3. Explain why an unattached VPC may leave Agent generations unchanged.
4. Keep `test-vpc` in place: Module 1.3 reads it, and Course 2 creates a separate `webapp-prod` VPC.

**Success Criteria:**

- ✅ VPC exists with the expected stored subnet spec.
- ✅ Agent baseline was read without claiming the VPC reached switches.
- ✅ Can explain why empty VPC Events are not success evidence.
- ✅ `test-vpc` remains available for the next module.

---

## Reference

### Hedgehog CRDs Used in This Module

**VPC** - Virtual Private Cloud with isolated subnets

- View: `kubectl get vpc`
- Inspect: `kubectl describe vpc <name>`
- Apply: `kubectl apply -f vpc.yaml`
- [Full Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md#vpc)

**Agent** - Switch agent containing detailed operational state

- View: `kubectl get agents`
- Inspect: `kubectl get agent <switch-name> -o yaml`
- [Full Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md#agent)

### kubectl Commands Reference

**VPC creation:**

```bash
kubectl apply -f test-vpc.yaml   # Create or update this lab VPC
kubectl get vpc <name>           # View VPC summary
kubectl describe vpc <name>      # View VPC details; Events may be empty
kubectl get vpc <name> -o yaml   # View full VPC YAML
kubectl delete vpc <name>        # Delete only when a later lab no longer needs it
```

**Agent status after a switch-facing change:**

```bash
kubectl get agents                         # Compare APPLIEDG and CURRENTG
kubectl get agent leaf-01 -o yaml          # Inspect applied condition and spec
```

An empty VPC Events section is expected in this Fabric release and is not a reconciliation check.

**Agent CRD inspection:**

```bash
kubectl get agents                         # List all agents (in default namespace)
kubectl get agent <switch-name> -o yaml    # View agent details
kubectl describe agent <switch-name>       # View agent summary
```

### Workflow Reference

This module uses **Workflow 1: Create VPC from Scratch** from the workflow reference:

- [WORKFLOWS.md - Workflow 1](../../../network-like-hyperscaler/research/WORKFLOWS.md#workflow-1-create-vpc-from-scratch)

### Related Documentation

- [Hedgehog Learning Philosophy](../../../network-like-hyperscaler/hedgehogLearningPhilosophy.md)
- [CRD Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md)
- [Module Dependency Graph](../../../network-like-hyperscaler/MODULE_DEPENDENCY_GRAPH.md)

---

**Module Complete!** Ready to continue to Module 1.3: Interfaces: kubectl/YAML.
