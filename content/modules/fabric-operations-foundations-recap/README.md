---
title: "Course 1 Recap & Forward Map"
slug: "fabric-operations-foundations-recap"
difficulty: "beginner"
estimated_minutes: 10
version: "v1.0.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - recap
  - readiness
  - learning-path
  - networking
description: "Celebrate Course 1 wins, reinforce key concepts, and map your progression into provisioning and connectivity."
order: 104
---

# Module 1.4: Course 1 Recap & Forward Map

**Course:** Course 1 - Foundations & Interfaces
**Duration:** 8-10 minutes
**Prerequisites:** Modules 1.1, 1.2, and 1.3 (completed)

---

## Introduction

### You've Come a Long Way

Three modules ago, you might have thought managing network infrastructure meant SSH-ing into switches, typing arcane commands, and hoping nothing breaks. Now you know better.

You've explored a production-style fabric using kubectl. You've created a VPC using GitOps. You've monitored switches with Grafana dashboards. You've learned to think like a Hedgehog operator.

Before we move forward, let's take a moment to consolidate what you've learned—and preview where you're going next.

### Course 1 Complete

This module marks the completion of **Course 1: Foundations & Interfaces**. You've built the foundation—now it's time to build on it.

**What this module covers:**
- Quick recap of Modules 1.1-1.3 (what you've learned)
- Knowledge check questions (test your understanding)
- Preview of Course 2 (where you're going next)
- Confidence-building for the next phase

**What's different about this module:**
- No hands-on lab (this is reflection time)
- Self-check questions (answers provided, non-graded)
- Shorter duration (8-10 minutes)
- Focus on consolidation and readiness

Let's celebrate what you've accomplished and prepare for what's next.

---

## Course 1 Summary

### Module 1.1 Recap: Welcome to Fabric Operations

**What You Learned:**

Hedgehog Fabric is **pre-installed, declaratively-managed infrastructure**. Your role as a Fabric Operator is to provision, validate, monitor, and troubleshoot network resources—not to install switches or design topologies from scratch.

You learned that network resources are represented as **Kubernetes CRDs**: switches, servers, connections, and VPCs all exist as objects you can inspect with kubectl.

**Key Moment:**

You successfully explored the fabric topology using kubectl—listing switches, servers, and connections—without touching a single switch CLI. That was your first taste of abstraction as empowerment.

**Confidence Win:**

"I can navigate a fabric environment safely using kubectl commands."

---

### Module 1.2 Recap: How Hedgehog Works

**What You Learned:**

The **GitOps workflow** became clear: Git is the source of truth, ArgoCD deploys changes, the Fabric Controller orchestrates configuration, Agent CRDs act as a bridge, and Switch Agents execute on each switch.

You were introduced to **three operational interfaces**:
- **Gitea**: Write and configure (edit YAML, commit changes)
- **ArgoCD**: Deploy and observe (sync status, deployment progress)
- **Grafana**: Monitor and validate (dashboards, metrics, trends)

You created **your first VPC** (`myfirst-vpc`) using the browser-based GitOps workflow.

**Key Moment:**

You committed a VPC configuration to Git, watched ArgoCD sync it, validated with kubectl, and observed it in Grafana—all without SSHing to a single switch. The abstraction clicked.

**Confidence Win:**

"I can create a VPC using the GitOps workflow and observe the reconciliation happen across all three interfaces."

---

### Module 1.3 Recap: Mastering the Three Interfaces

**What You Learned:**

You mastered **when to use each interface**:
- **kubectl**: Read and inspect current state, check events, troubleshoot issues
- **Gitea**: Write configurations, audit change history, review diffs
- **Grafana**: Observe trends over time, monitor health, aggregate metrics

You learned that Hedgehog VPCs use **event-based reconciliation**: no error events means successful deployment. You toured **all 6 Grafana dashboards**: Fabric, Platform, Interfaces, Logs, Node Exporter, and Switch CRM.

Most importantly, you learned a **troubleshooting methodology**: Check configuration (Gitea) → Verify deployment (kubectl) → Monitor health (Grafana).

**Key Moment:**

You navigated all three interfaces fluently, correlating information across tools to understand fabric state. You learned to select the right tool for the job.

**Confidence Win:**

"I know which interface to use for any given task, and I can troubleshoot by correlating data across kubectl, Gitea, and Grafana."

---

### How It All Fits Together

**The Full Operator Workflow:**

```
┌─────────────────────────────────────────────────────────┐
│ COURSE 1: What You Now Understand                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. FABRIC FOUNDATION (Module 1.1)                      │
│     • Pre-installed spine-leaf topology                 │
│     • Switches, servers, connections (Day 1 complete)   │
│     • Kubernetes-native abstractions (CRDs)             │
│                                                          │
│  2. GITOPS CONTROL MODEL (Module 1.2)                   │
│     • Git → ArgoCD → Fabric Controller → Agents         │
│     • Declarative desired state (you declare intent)    │
│     • Automatic reconciliation (system does the work)   │
│                                                          │
│  3. THREE OPERATIONAL INTERFACES (Module 1.3)           │
│     • Gitea: Write/configure/audit                      │
│     • kubectl: Read/inspect/troubleshoot                │
│     • Grafana: Observe/monitor/trend                    │
│                                                          │
│  RESULT: You can operate a Hedgehog Fabric confidently  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**A Day in Your Life as a Fabric Operator:**

1. Check Grafana Fabric Dashboard (morning health check)
2. Provision new VPC via Gitea (project requirement)
3. Watch ArgoCD sync the change (verify deployment)
4. Use kubectl to validate reconciliation (check events)
5. Monitor Grafana Interfaces Dashboard (confirm VLANs applied)
6. Move on to next task, confident the fabric handled the details

**You Now Operate Like a Hyperscaler:**
- Infrastructure as code (Git)
- Automated reconciliation (controllers)
- Multi-layer observability (events, metrics, logs)
- Confidence through abstraction (no manual switch config)

---

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center?hsLang=en-us) module first — it takes about 20 minutes and only needs to be done once.

## Knowledge Check

These questions help reinforce key concepts. They're not graded—they're for your own confidence check.

### Question 1: Fabric Foundation

**Scenario:** Your manager asks, "What's a Fabric Operator's primary responsibility?"

Which answer best describes your role?

- A) Design network topologies and select switch hardware
- B) Provision VPCs, validate connectivity, and monitor fabric health
- C) Manually configure BGP on switches
- D) Install and cable physical switches

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Provision VPCs, validate connectivity, and monitor fabric health

**Explanation:**

As a Fabric Operator, you manage Day 2 operations on pre-installed infrastructure. The physical fabric (switches, cabling) is already deployed. Your focus is on creating and managing virtual network resources (VPCs), ensuring connectivity works, and monitoring fabric health.

- **A is incorrect:** Design is typically done during Day 0/1 (before operator role)
- **C is incorrect:** You don't manually configure switches—controllers handle that
- **D is incorrect:** Physical installation is Day 0 work, not Day 2 operations

**Module 1.1 Reference:** Fabric Operator role definition, Day 2 operations focus

</details>

---

### Question 2: GitOps Workflow

**Scenario:** You need to create a new VPC called `dev-network`. What's the correct order of operations?

- A) kubectl apply → ArgoCD sync → Git commit → Grafana check
- B) Git commit (Gitea) → ArgoCD sync → kubectl validate → Grafana monitor
- C) Grafana monitor → Git commit → kubectl apply → ArgoCD sync
- D) ArgoCD sync → kubectl validate → Git commit → Grafana check

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Git commit (Gitea) → ArgoCD sync → kubectl validate → Grafana monitor

**Explanation:**

The GitOps workflow follows this sequence:

1. **Git commit (Gitea):** Create VPC YAML file in the `vpcs/` directory, commit to repository (source of truth)
2. **ArgoCD sync:** ArgoCD detects the Git change and deploys the VPC CRD to the cluster
3. **kubectl validate:** Verify VPC was created, check events for reconciliation status
4. **Grafana monitor:** Observe fabric metrics to confirm VPC is operational

**Why this order matters:**
- Git must be first (source of truth in GitOps)
- ArgoCD reacts to Git changes (automation)
- kubectl validates what ArgoCD deployed (verification)
- Grafana monitors runtime behavior (observability)

Other options break the GitOps pattern or have incorrect sequencing.

**Module 1.2 Reference:** GitOps control model, five-actor flow

</details>

---

### Question 3: Interface Selection for Troubleshooting

**Scenario:** You suspect a VPC isn't working correctly. Which interface should you check FIRST to understand the problem?

- A) Gitea (check VPC configuration)
- B) Grafana (check switch health)
- C) kubectl (check VPC events for errors)
- D) ArgoCD (check sync status)

<details>
<summary>Answer & Explanation</summary>

**Answer:** C) kubectl (check VPC events for errors)

**Explanation:**

When troubleshooting a non-working VPC, start with `kubectl describe vpc <name>` to check events. Hedgehog uses event-based reconciliation for VPCs—error events immediately tell you what's wrong (e.g., "Subnet overlaps with existing VPC").

**After checking events:**
- If events show a **configuration error** → Fix in Gitea (go back to source)
- If events show **no errors but VPC still not working** → Check Grafana for switch health
- If **VPC doesn't exist** → Check ArgoCD sync status

**Why kubectl first:**
Starting with kubectl events gives you the most direct troubleshooting information. Events tell you exactly what failed during reconciliation.

**Module 1.3 Reference:** Troubleshooting methodology, event-based reconciliation

</details>

---

### Question 4: Three Interfaces - Decision Making

**Match each task to the appropriate interface:**

| Task | Interface |
|------|-----------|
| 1. View historical CPU usage trends for spine-01 over 24 hours | ? |
| 2. See who changed the `prod-vpc` configuration last week | ? |
| 3. Check if a VPC has reconciliation errors | ? |
| 4. Create a new VPC with subnet 10.20.30.0/24 | ? |

<details>
<summary>Answers & Explanation</summary>

**Answers:**

1. **Grafana** - Time-series metrics and trends (Node Exporter Dashboard shows CPU over time)
2. **Gitea** - Audit trail / commit history (shows author, timestamp, and what changed)
3. **kubectl** - Current state and events (`kubectl describe vpc <name>` shows events)
4. **Gitea** - Write configuration (create YAML file in `vpcs/`, commit to Git)

**Key Principle:**
- **kubectl = Read** (inspect current state, troubleshoot)
- **Gitea = Write** (configure, audit history)
- **Grafana = Observe** (trends, metrics, monitoring)

**Why these choices:**
1. Grafana stores time-series data (kubectl only shows current snapshot)
2. Gitea tracks all Git commits with author and timestamp
3. kubectl events show reconciliation results in real-time
4. GitOps workflow requires Git as source of truth

**Module 1.3 Reference:** Interface decision matrix, tool selection framework

</details>

---

### Knowledge Check Summary

**How did you do?**
- **4/4 correct**: Excellent! You've mastered the foundational concepts.
- **3/4 correct**: Strong understanding. Review any questions you missed.
- **2/4 or fewer**: Revisit Modules 1.1-1.3 to reinforce concepts before continuing.

**Remember:** These are for your benefit, not graded assessment. Course 2 builds on these foundations, so make sure you feel confident before moving forward.

---

## Forward Map to Course 2

### Course 1 vs Course 2: What Changes?

**Course 1 (Where You Are Now):**
- ✅ Understood how Hedgehog Fabric works
- ✅ Learned the GitOps workflow
- ✅ Mastered the three operational interfaces
- ✅ Created a simple VPC (`myfirst-vpc`)
- ✅ Observed fabric health in Grafana

**Key characteristic:** **Exploration and understanding** (mostly read-only focus + one simple VPC)

---

**Course 2 (Where You're Going):**
- 🎯 Design and create VPCs from scratch (subnet planning, VLAN allocation)
- 🎯 Attach servers to VPCs (VPCAttachment CRD)
- 🎯 Validate end-to-end connectivity (testing workflows)
- 🎯 Decommission resources safely (cleanup procedures)
- 🎯 Handle real-world provisioning scenarios

**Key characteristic:** **Hands-on provisioning operations** (creating, modifying, validating, deleting)

---

### Preview: Course 2 Modules

#### Module 2.1: Define VPC Network

**What You'll Learn:**
- VPC design considerations (subnet sizing, IP allocation strategies)
- VLAN selection from namespaces (avoiding conflicts)
- Multi-subnet VPCs (multiple L2 domains within one VPC)
- DHCP configuration options (ranges, custom DNS, reservations)
- IPv4/VLAN namespace concepts and constraints

**Hands-On:**
- Create a VPC with multiple subnets
- Configure DHCP with custom ranges and options
- Plan IP allocation for a multi-tenant scenario

**What's New:**

You'll make **design decisions** (not just follow templates). Which subnet size? Which VLAN? These choices have operational consequences. Module 2.1 teaches you to think through requirements before creating VPCs.

---

#### Module 2.2: Attach Servers to VPC

**What You'll Learn:**
- VPCAttachment CRD (binding servers to VPC subnets)
- Connection types (MCLAG, ESLAG, unbundled, bundled)
- Subnet selection for attachments
- Server inventory review (which servers are available?)
- Native vs tagged VLAN configuration

**Hands-On:**
- Attach a server to your VPC
- Verify switch configuration (VLAN on correct ports)
- Observe VPCAttachment reconciliation in Grafana
- Troubleshoot attachment failures

**What's New:**

You'll connect **virtual networks (VPCs) to physical infrastructure (servers)**. This bridges abstraction layers. Understanding how VPCAttachments translate into switch port configurations is key to troubleshooting connectivity.

---

#### Module 2.3: Connectivity Validation

**What You'll Learn:**
- End-to-end connectivity testing workflows
- Using kubectl to inspect Agent CRD interface states
- Reading Grafana metrics to confirm traffic flow
- Troubleshooting common connectivity issues (DHCP, reachability)
- Understanding DHCP relay (switches forwarding DHCP requests)

**Hands-On:**
- Validate server can obtain DHCP lease from VPC
- Test server-to-server connectivity within VPC
- Use Grafana Interfaces Dashboard to confirm VLANs applied
- Diagnose and fix a misconfigured attachment

**What's New:**

You'll **validate that your configurations actually work** (not just trust reconciliation). Testing builds operational confidence. You'll learn systematic validation approaches that apply to any VPC deployment.

---

#### Module 2.4: Decommission & Cleanup

**What You'll Learn:**
- Safe VPC deletion order (attachments first, then VPC)
- Verifying no active servers before deletion
- GitOps deletion workflow (delete YAML files from Git)
- Cleanup validation (ensure switches removed configuration)
- When to archive vs delete configurations

**Hands-On:**
- Safely decommission a VPC
- Remove VPCAttachments first (proper dependency order)
- Verify cleanup in kubectl and Grafana
- Understand orphaned resource prevention

**What's New:**

You'll learn to **undo your work safely**. Decommissioning is a critical Day 2 skill often overlooked in training. Understanding deletion order prevents operational issues like orphaned VLANs or stranded switch configurations.

---

### Course 2: What You'll Be Able to Do

By the end of Course 2, you'll be able to:

1. **Design VPCs** tailored to specific workload requirements
2. **Provision VPCs** using GitOps workflow confidently and independently
3. **Attach servers** to VPCs with correct connection types
4. **Validate connectivity** end-to-end (DHCP, ping, traffic)
5. **Troubleshoot** provisioning issues using all three interfaces systematically
6. **Decommission** VPCs and attachments safely without leaving orphaned resources
7. **Operate independently** for common Day 2 provisioning tasks

**This is when you become productive as a Fabric Operator.**

Course 1 gave you the knowledge. Course 2 gives you the skills.

---

## Motivation & Next Steps

### You're Ready

**Course 1 gave you the foundation:**
- You understand the fabric architecture and GitOps control model
- You know the GitOps workflow and how reconciliation works
- You've mastered the three operational interfaces
- You've created a VPC and observed reconciliation

**Course 2 will give you the skills:**
- VPC design and provisioning for real workloads
- Server connectivity and validation
- Systematic validation and troubleshooting
- Lifecycle management (create → use → decommission)

**The difference?**

Course 1 was about **understanding how Hedgehog works**. Course 2 is about **getting work done as a Fabric Operator**.

---

### Confidence Statement

You've completed Course 1, which means:

✅ You can navigate Hedgehog Fabric using kubectl
✅ You understand GitOps workflow and why it matters
✅ You know which interface to use for any task
✅ You've successfully created a VPC using the three interfaces
✅ You can troubleshoot by correlating data across kubectl, Gitea, and Grafana

**You're not an expert yet—that's not the goal.** You're a **confident beginner** ready to tackle hands-on provisioning operations. That's exactly where you should be.

---

### What Happens Next

**Immediate Next Step:**

Begin **Course 2, Module 2.1: Define VPC Network**

You'll design your first production-style VPC from scratch, making real design decisions about subnets and VLANs. Everything you learned in Course 1 will be applied.

**Mindset for Course 2:**

- **Experiment:** You're working in a lab environment—try things, make mistakes, learn from them
- **Validate:** Use all three interfaces to confirm your work
- **Troubleshoot:** When things don't work (and they won't always), you have the tools to diagnose
- **Escalate:** If you're stuck, that's normal—support is part of learning, not a sign of weakness

**Remember the Learning Philosophy:**

- Confidence before comprehensiveness (master core operations first)
- Focus on what matters most (common tasks, not edge cases)
- Learn by doing, not watching (hands-on every module)
- Support is strength, not weakness (escalate when appropriate)

---

### Final Encouragement

Three modules ago, this might have seemed daunting:

> "Manage a data center network using GitOps and Kubernetes? That's not for me."

Now you know it's not just possible—**you've already done it.**

You've explored a fabric, created a VPC, monitored switches, and troubleshot issues using kubectl, Gitea, and Grafana. The foundation is solid.

The leap from Course 1 to Course 2 is smaller than it feels. You have the foundation. Course 2 adds depth and practice through repetition and real-world scenarios.

**Trust your preparation. You've earned this confidence.**

Welcome to Course 2. Let's get to work.

---

## Reference

### Course 1 Module Links

**Module 1.1: Welcome to Fabric Operations**
- Fabric Operator role definition
- Kubernetes-native management overview
- kubectl basics for fabric exploration

**Module 1.2: How Hedgehog Works**
- GitOps workflow (Git → ArgoCD → Fabric Controller → Agents)
- Three interfaces introduction (Gitea, ArgoCD, Grafana)
- VPC creation walkthrough

**Module 1.3: Mastering the Three Interfaces**
- Interface decision matrix (when to use which tool)
- Event-based reconciliation model
- All 6 Grafana dashboards
- Troubleshooting methodology

### Key Concepts Reference

**GitOps Workflow:**
```
Git (source of truth)
  ↓
ArgoCD (deployment automation)
  ↓
Fabric Controller (orchestration)
  ↓
Agent CRDs (bridge to switches)
  ↓
Switch Agents (execution on switches)
```

**Three-Interface Model:**

| Interface | Role | When to Use |
|-----------|------|-------------|
| **kubectl** | Read/Inspect | Check state, view events, troubleshoot |
| **Gitea** | Write/Audit | Create configs, review history |
| **Grafana** | Observe/Monitor | View trends, monitor health |

**Troubleshooting Flow:**
1. **Gitea** - Verify configuration is correct
2. **kubectl** - Check deployment status and events
3. **Grafana** - Monitor runtime health

### Grafana Dashboards Quick Reference

1. **Fabric Dashboard** - Overall fabric health (daily check)
2. **Platform Dashboard** - Control plane health (Fabricator, K8s API)
3. **Interfaces Dashboard** - Port status and traffic
4. **Logs Dashboard** - Aggregated syslog
5. **Node Exporter Dashboard** - Switch hardware metrics
6. **Switch CRM Dashboard** - ASIC capacity monitoring

### Course 2 Preview

**Module 2.1:** Define VPC Network (VPC design considerations)
**Module 2.2:** Attach Servers to VPC (VPCAttachment CRD)
**Module 2.3:** Connectivity Validation (testing workflows)
**Module 2.4:** Decommission & Cleanup (safe deletion)

### Related Documentation

- [Hedgehog Learning Philosophy](../../../network-like-hyperscaler/hedgehogLearningPhilosophy.md)
- [CRD Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md)
- [Workflow Reference](../../../network-like-hyperscaler/research/WORKFLOWS.md)
- [Module Dependency Graph](../../../network-like-hyperscaler/MODULE_DEPENDENCY_GRAPH.md)
- [Project Plan](../../../network-like-hyperscaler/PROJECT_PLAN.md)

---

**Course 1 Complete!** 🎉 You're ready to continue to Course 2, Module 2.1: Define VPC Network.
