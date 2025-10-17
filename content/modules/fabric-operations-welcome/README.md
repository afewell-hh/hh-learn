---
title: "Welcome to Fabric Operations"
slug: "fabric-operations-welcome"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - onboarding
  - kubernetes
  - networking
description: "Kick off the Hedgehog Fabric Operator journey, explore the vlab, and build confidence with kubectl-driven operations."
order: 101
---

# Module 1.1: Welcome to Fabric Operations

**Course:** Course 1 - Foundations & Interfaces
**Duration:** 15 minutes
**Prerequisites:** Basic command-line familiarity, general understanding of networks

---

## Introduction

### A Day in the Life

You're a Fabric Operator at a growing company. This morning, your team needs to onboard three new application servers to the production network. In traditional networking, this might mean: scheduling a maintenance window, manually configuring VLANs on multiple switches, updating routing tables, testing connectivity, and hoping nothing breaks.

With Hedgehog Fabric, you'll define the desired state in a few lines of YAML, apply it with kubectl, and let the fabric controller handle the rest. The switches configure themselves. The routes populate automatically. The connectivity validates itself.

Sound too good to be true? That's what hyperscalers figured out years ago. Now you can do it too.

### What You'll Learn

This pathway teaches you to **operate** a Hedgehog fabric with confidence. Not to design fabrics from scratch (that's a different course), but to:

- Provision network resources (VPCs, server attachments)
- Validate connectivity
- Monitor fabric health
- Troubleshoot common issues
- Know when to escalate to support

You'll use **Kubernetes-native tools** (kubectl) to manage a real network fabric. If you know Kubernetes, you'll feel at home. If you come from traditional networking, you'll discover a cleaner, safer way to manage network state.

### Learning Objectives

By the end of this module, you will be able to:

1. **Describe the Hedgehog Fabric Operator role** - Understand day-to-day responsibilities vs. design/architecture tasks
2. **Articulate the confidence-first learning approach** - Explain why we focus on common operations before edge cases
3. **Navigate the Hedgehog vlab environment** - Use kubectl to view fabric topology and resources
4. **Identify the three-tier resource hierarchy** - Recognize Switches/Servers (wiring) → VPCs → VPCAttachments
5. **Demonstrate kubectl basics** - Execute get and describe commands to inspect fabric state

### Setting Expectations

This pathway follows a proven approach designed to get you productive quickly:

- **Focus on what matters most:** We'll teach the 80% of tasks you'll do daily, not the 20% of edge cases you'll rarely encounter
- **Confidence before comprehensiveness:** You'll master core operations before diving into advanced scenarios
- **Hands-on, always:** Every module includes labs in a real Hedgehog environment
- **Support is strength:** You'll learn when and how to escalate effectively (it's a best practice, not a weakness)

---

## Core Concepts

### Concept 1: The Fabric Operator Role

You're not designing the network from scratch—that's already done. The fabric (switches, servers, connections) is wired and operational.

**Your responsibilities:**

- **Provision:** Create VPCs, attach servers to networks
- **Validate:** Confirm connectivity works as expected
- **Monitor:** Watch fabric health, detect anomalies
- **Troubleshoot:** Diagnose issues using kubectl and events
- **Escalate:** Package diagnostics and engage support when needed

**NOT your job (in this role):**

- Physical switch installation
- Initial fabric wiring diagram design
- Low-level BGP/EVPN configuration
- Hardware troubleshooting

Think of it like this: **You manage applications in Kubernetes without configuring kubelet on every node.** Similarly, you manage network resources without manually configuring SONiC on every switch.

### Concept 2: Kubernetes-Native Network Management

Hedgehog uses **Custom Resource Definitions (CRDs)** to represent network concepts:

```
Wiring Layer (Physical)
├─ Switch: Physical switch in the fabric
├─ Server: Physical server connected to switches
└─ Connection: How servers connect to switches (MCLAG, ESLAG, etc.)

VPC Layer (Virtual Networks)
├─ VPC: Virtual Private Cloud with isolated subnets
├─ VPCAttachment: Binds a VPC to a server connection
└─ VPCPeering: Connects two VPCs

External Layer (Outside Connectivity)
├─ External: External network definition
├─ ExternalAttachment: Border leaf connection
└─ ExternalPeering: VPC to external routing
```

You'll use **kubectl** just like managing Kubernetes resources:

```bash
kubectl get vpcs                    # List all VPCs
kubectl describe vpc my-vpc         # Get VPC details
kubectl apply -f vpc.yaml           # Create/update VPC
kubectl get events                  # See what happened
```

### Concept 3: Declarative, Self-Healing Infrastructure

**Traditional networking:** Log into each switch, type commands, hope you didn't make a typo.

**Hedgehog approach:**

1. **Declare desired state** (YAML): "I want VPC 'production' with subnet 10.10.1.0/24"
2. **Apply it** (kubectl): The fabric controller receives your intent
3. **Reconciliation happens** (automatic): Controllers configure switches to match desired state
4. **Status reflects reality** (observable): kubectl shows current state and any issues

If a switch reboots? The fabric controller automatically reapplies configuration. No manual intervention.

### Concept 4: The Learning Philosophy

This pathway follows a proven approach:

1. **Train for reality, not rote:** You'll learn workflows, not memorize commands
2. **Focus on what matters:** Common operations, not rare edge cases
3. **Confidence first:** Small wins build competence over time
4. **Learn by doing:** Hands-on labs in every module
5. **Support as strength:** We'll teach you how to escalate effectively

You don't need to become a networking expert or Kubernetes guru overnight. You need to be **confident and competent** in the core operations. Everything else builds from there.

---

## Hands-On Lab

### Lab Title: Explore Your Fabric Environment

**Overview:**
You'll use kubectl to explore the Hedgehog vlab environment, viewing switches, servers, and connections. This is your first hands-on experience—designed to build confidence through successful exploration.

**Environment:**

- Hedgehog vlab with default spine-leaf topology
- 2 spine switches, 5 leaf switches, 10 servers
- kubectl already configured and ready to use

**Important:** All commands in this lab are read-only. You can't break anything—we're just exploring.

---

### Task 1: Verify Environment Access

**Objective:** Confirm kubectl can communicate with the Hedgehog control plane

**Steps:**

```bash
# Check cluster access
kubectl cluster-info
```

**Expected output (similar to):**

```
Kubernetes control plane is running at https://127.0.0.1:6443
CoreDNS is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
Metrics-server is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/https:metrics-server:https/proxy
```

**Validation:**

```bash
# Verify you can access the fab namespace
kubectl get pods -n fab
```

**Expected:** Several pods running (fabric-ctrl, fabric-boot, fabricator-ctrl, etc.)

**Success Criteria:**

- ✅ kubectl cluster-info shows control plane URL
- ✅ Pods in fab namespace are Running

---

### Task 2: View Fabric Topology

**Objective:** Explore the physical fabric resources (switches, servers, connections)

**Steps:**

```bash
# List all switches in the fabric
kubectl get switches
```

**Expected output:**

```
NAME       PROFILE   ROLE          DESCR           GROUPS        AGE
leaf-01    vs        server-leaf   VS-01 MCLAG 1   ["mclag-1"]   11h
leaf-02    vs        server-leaf   VS-02 MCLAG 1   ["mclag-1"]   11h
leaf-03    vs        server-leaf   VS-03 ESLAG 1   ["eslag-1"]   11h
leaf-04    vs        server-leaf   VS-04 ESLAG 1   ["eslag-1"]   11h
leaf-05    vs        server-leaf   VS-05                         11h
spine-01   vs        spine         VS-06                         11h
spine-02   vs        spine         VS-07                         11h
```

**Count the switches:**

- How many spine switches? \_\_\_\_\_\_\_ (Answer: 2)
- How many leaf switches? \_\_\_\_\_\_\_ (Answer: 5)

**Note:** Look at the ROLE column to distinguish spine from server-leaf switches.

```bash
# List all servers
kubectl get servers
```

**Expected output:**

```
NAME        TYPE   DESCR                        AGE
server-01          S-01 MCLAG leaf-01 leaf-02   11h
server-02          S-02 MCLAG leaf-01 leaf-02   11h
server-03          S-03 Unbundled leaf-01       11h
server-04          S-04 Bundled leaf-02         11h
server-05          S-05 ESLAG leaf-03 leaf-04   11h
server-06          S-06 ESLAG leaf-03 leaf-04   11h
server-07          S-07 Unbundled leaf-03       11h
server-08          S-08 Bundled leaf-04         11h
server-09          S-09 Unbundled leaf-05       11h
server-10          S-10 Bundled leaf-05         11h
```

**Count the servers:** \_\_\_\_\_\_\_ (Answer: 10)

**Note:** The DESCR column shows how each server connects to the fabric—MCLAG, ESLAG, Bundled, or Unbundled.

```bash
# View connections (how servers connect to switches)
kubectl get connections
```

**Expected output shows various connection types:**

- MCLAG (multi-chassis link aggregation)
- ESLAG (EVPN-based ESI LAG)
- Bundled (port channel to single switch)
- Unbundled (single link)
- Fabric (spine-to-leaf interconnects)

**Success Criteria:**

- ✅ Can list switches and count them correctly (7 total)
- ✅ Can list servers (10 total)
- ✅ Can view connections showing various types

---

### Task 3: Inspect a Specific Resource

**Objective:** Use kubectl describe to view detailed information

**Steps:**

```bash
# Get detailed information about leaf-01
kubectl describe switch leaf-01
```

**What to look for:**

The output contains many fields. Focus on these key ones:

- **Role:** Shows the switch's function (server-leaf or spine)
- **Groups:** Shows redundancy groups (e.g., mclag-1 means paired with leaf-02)
- **Redundancy:** Shows the redundancy type (mclag, eslag, or none)
- **ASN:** The switch's BGP autonomous system number
- **Profile:** vs (virtual switch in this lab)

**You don't need to understand every field**—we'll explore more in later modules. For now, practice finding specific information.

**Questions to answer:**

1. What is the role of leaf-01? \_\_\_\_\_\_\_ (Answer: server-leaf)
2. Is leaf-01 part of a redundancy group? \_\_\_\_\_\_\_ (Answer: Yes, mclag-1)

```bash
# Inspect server-01
kubectl describe server server-01
```

**Look for:**

- **Description:** Shows which switches it connects to
- **Connection type:** MCLAG, ESLAG, etc.

**Success Criteria:**

- ✅ Can describe a switch and identify its role
- ✅ Can describe a server and see its connections
- ✅ Understand that describe shows more detail than get

---

### Task 4: Explore Events (Optional)

**Objective:** See Kubernetes events for fabric resources

**Steps:**

```bash
# View recent events in the default namespace
kubectl get events --sort-by='.lastTimestamp' | tail -20
```

**What are events?**

Events show what the fabric controller is doing:

- Reconciling resources
- Configuration changes
- Status updates

**Note on Events:**

> If you don't see recent events, that's normal! Kubernetes events expire after about an hour. In active environments (like when creating VPCs or troubleshooting issues), you'll see events showing what the fabric controller is doing. We'll use events extensively in later modules during hands-on provisioning tasks.

**Success Criteria:**

- ✅ Can view events (even if the list is empty or you don't understand all of them yet)

---

### Lab Summary

**What you did:**

- ✅ Verified kubectl access to Hedgehog control plane
- ✅ Explored fabric topology (switches, servers, connections)
- ✅ Inspected detailed resource information with describe
- ✅ Observed Kubernetes events

**What you learned:**

- kubectl is your primary tool for fabric management
- Hedgehog represents infrastructure as Kubernetes resources
- The fabric has physical resources (switches, servers) and virtual resources (VPCs, which you'll explore next)
- You can inspect state without making any changes (read-only exploration builds confidence)

**Key takeaway:** You just successfully navigated a production-like fabric environment using only kubectl. No switch CLI, no manual configuration, no fear of breaking things. This is how hyperscalers operate at scale.

---

## Wrap-Up

### Key Takeaways

1. **Your role:** Fabric Operator managing day-to-day network operations
2. **Your tool:** kubectl to manage Kubernetes-native network resources
3. **Your approach:** Declarative, confidence-building, focused on common tasks
4. **Your support:** Escalation is a strength, not a weakness

### Preview of Module 1.2

Next, you'll dive deeper into **how Hedgehog works under the hood**: CRD reconciliation, the controller pattern, and how your kubectl commands become switch configurations. You'll understand the "magic" so it's not magic anymore—just well-designed automation.

---

## Assessment

### Quiz Questions

**Question 1: Multiple Choice**

What is the primary role of a Hedgehog Fabric Operator?

- A) Design network topologies and select switch hardware
- B) Provision VPCs, validate connectivity, and monitor fabric health
- C) Manually configure BGP peering on each switch
- D) Write custom Kubernetes controllers for network automation

**Correct Answer:** B

**Explanation:**
Fabric Operators manage day-to-day network operations using kubectl to provision resources (VPCs, attachments), validate connectivity, and monitor health. Physical design (A), low-level protocol configuration (C), and controller development (D) are outside the operator role scope. This pathway focuses on **operating** an existing fabric, not designing or implementing it.

---

**Question 2: Scenario-Based**

You need to view all switches in the fabric and identify which ones are spines vs. leaves. What kubectl command would you use?

**Answer:**

```bash
kubectl get switches
```

This lists all switches with their ROLE field showing "spine" or "server-leaf".

**Rubric:**

- Full credit: `kubectl get switches` (exact or close variation)
- Partial credit: Mentions kubectl and switches but wrong syntax
- No credit: Suggests logging into switches or using non-kubectl tools

---

**Question 3: True/False**

True or False: In Hedgehog, you must manually log into each switch to configure VLANs when creating a new VPC.

**Answer:** False

**Explanation:**
Hedgehog uses declarative management. You define the VPC in YAML and apply it with kubectl. The fabric controller automatically configures all necessary switches to realize the desired state. You never manually configure switches for routine operations—that's the whole point of the abstraction.

---

**Question 4: Multiple Choice**

According to the Hedgehog learning philosophy, which statement is correct?

- A) You must master all edge cases before attempting basic operations
- B) Focus on common, high-impact tasks to build confidence and immediate productivity
- C) Avoid using support—figure everything out independently
- D) Memorize all kubectl commands before trying labs

**Correct Answer:** B

**Explanation:**
The learning philosophy emphasizes "Focus on What Matters Most" and "Confidence Before Comprehensiveness." You'll learn the 80% of operations you'll do daily (B), not rare edge cases (A). Support is encouraged when needed (C is wrong). Learning by doing beats memorization (D is wrong).

---

**Question 5: Practical - Open Ended**

Based on what you explored in the lab, how many total switches are in the vlab environment, and how are they split between spines and leaves?

**Answer:**
7 total switches: 2 spines and 5 leaves

**Rubric:**

- Full credit: Correct numbers (7 total, 2 spines, 5 leaves)
- Partial credit: Correct total but wrong breakdown, or vice versa
- No credit: Incorrect numbers

---

### Practical Assessment

**Task:** Using only kubectl commands, determine which switches server-05 is connected to.

**Success Criteria:**

- ✅ Uses `kubectl describe server server-05` or equivalent
- ✅ Correctly identifies the connected switches from the description
- ✅ Can explain whether it's MCLAG, ESLAG, or another connection type

**Expected Process:**

```bash
kubectl describe server server-05
# Output shows: "S-05 ESLAG leaf-03 leaf-04"
# Answer: Connected to leaf-03 and leaf-04 via ESLAG
```

---

## Reference

### Hedgehog CRDs Used in This Module

- **Switch** - Physical switch in the fabric
  - View: `kubectl get switches`
  - Inspect: `kubectl describe switch <name>`
- **Server** - Physical server connected to switches
  - View: `kubectl get servers`
  - Inspect: `kubectl describe server <name>`
- **Connection** - Physical and logical connections between devices
  - View: `kubectl get connections`
  - Shows MCLAG, ESLAG, bundled, unbundled, fabric types

### kubectl Commands Reference

**Cluster access:**

```bash
kubectl cluster-info              # Verify cluster connectivity
kubectl get pods -n fab           # View fabric control plane pods
```

**Resource listing:**

```bash
kubectl get switches              # List all switches
kubectl get servers               # List all servers
kubectl get connections           # List all connections
```

**Resource inspection:**

```bash
kubectl describe switch <name>    # Get detailed switch information
kubectl describe server <name>    # Get detailed server information
```

**Event viewing:**

```bash
kubectl get events --sort-by='.lastTimestamp'  # View recent events
```

### Related Documentation

- [Hedgehog Learning Philosophy](../../../network-like-hyperscaler/hedgehogLearningPhilosophy.md)
- [CRD Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md)
- [Module Dependency Graph](../../../network-like-hyperscaler/MODULE_DEPENDENCY_GRAPH.md)

---

**Module Complete!** Ready to continue to Module 1.2: How Hedgehog Works.
