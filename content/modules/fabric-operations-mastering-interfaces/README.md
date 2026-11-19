---
title: "Mastering the Three Interfaces"
slug: "fabric-operations-mastering-interfaces"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.1.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - interfaces
  - kubectl
  - gitops
  - observability
description: "Master kubectl, GitOps, and Grafana workflows to operate Hedgehog Fabric with confidence across all interfaces."
order: 103
---

# Module 1.3: Mastering the Three Interfaces

**Course:** Course 1 - Foundations & Interfaces
**Duration:** 15 minutes
**Prerequisites:** Module 1.2: How Hedgehog Works

---

## Introduction

### The Fabric Operator's Toolkit

You've created your first VPC and watched the reconciliation magic happen. But in real operations, you'll face different scenarios:

- **Troubleshooting:** "This VPC isn't working—what's wrong?"
- **Auditing:** "Who changed the production VPC configuration last week?"
- **Monitoring:** "Is spine-01 healthy right now?"

Each scenario calls for a different tool. Knowing **when** to use kubectl, **when** to use Gitea, and **when** to use Grafana is what separates confident operators from confused ones.

This module teaches you to **choose the right interface for the job**—not just how to use each tool, but when and why.

### What You'll Learn

This module provides hands-on experience with all three operational interfaces:

- **kubectl:** Your lens into current cluster state
- **Gitea:** Your configuration history and audit trail
- **Grafana:** Your window into fabric health over time

You'll practice reading each interface, correlating information across them, and applying a systematic troubleshooting methodology.

### Learning Objectives

By the end of this module, you will be able to:

1. **Select the appropriate interface** for specific operational tasks (read current state, audit configuration, monitor health)
2. **Interpret kubectl output** including desired state, Agent status, and resource relationships
3. **Navigate Gitea** for configuration audit, commit history, and change diffs
4. **Read Grafana dashboards** for fabric health monitoring across all 6 Hedgehog dashboards
5. **Correlate information across interfaces** to troubleshoot configuration issues systematically
6. **Apply troubleshooting methodology** using the three-interface approach for common problems

### Setting Expectations

This module builds on your VPC creation experience from Module 1.2. We'll use the `test-vpc` you created to explore each interface systematically. By the end, you'll know exactly which tool to reach for when faced with any operational task.

---

## The Three Interfaces Framework

### Your Operational Dashboard

Think of managing Hedgehog Fabric like flying an aircraft. You don't use a single instrument—you use different displays for different purposes:

- **Altimeter** (current altitude) → **kubectl** (current cluster state)
- **Flight log** (where you've been) → **Gitea** (configuration history)
- **System health** (engine status, fuel) → **Grafana** (fabric health metrics)

Each interface provides unique information you can't get from the others.

### Interface Roles

| Interface | Primary Role | When to Use | Information Type |
|-----------|--------------|-------------|------------------|
| **kubectl** | **Read/Inspect** | Check stored objects, Agent state and topology | Current cluster state |
| **Gitea** | **Write/Audit** | Create/modify configs, review history, audit changes | Declarative desired state |
| **Grafana** | **Observe/Monitor** | View health trends, monitor metrics, identify patterns | Time-series operational data |

### Decision Matrix: Which Tool Do I Use?

**Use kubectl when you need to:**
- ✅ Check if a VPC exists and is reconciled
- ✅ Read API rejection messages and Agent status for failed changes
- ✅ List all resources of a specific type
- ✅ See current switch agent status
- ✅ Troubleshoot why something isn't working right now

**Use Gitea when you need to:**
- ✅ Create a new VPC configuration file
- ✅ Answer "who changed this VPC and when?"
- ✅ Compare current configuration to last week's version
- ✅ Review configuration before it gets deployed
- ✅ Maintain compliance audit trails

**Use Grafana when you need to:**
- ✅ View fabric health over the samples available on this VM
- ✅ Check if switches are experiencing CPU pressure
- ✅ Monitor interface traffic and error rates
- ✅ Aggregate logs from multiple switches
- ✅ Identify when a problem started occurring

**Key Insight:** These interfaces complement each other. A complete troubleshooting flow often uses all three: Gitea to verify configuration, kubectl to check deployment status, Grafana to monitor runtime health.

---

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center?hsLang=en-us) module first — it takes about 20 minutes and only needs to be done once.

## Part 1: The Read Interface - kubectl

### Your Window into Current State

kubectl shows you what's happening **right now** in the cluster. Think of it as taking a snapshot of the fabric at this exact moment. It's your go-to tool for real-time inspection and troubleshooting.

---

### Task 1.1: Inspect Your VPC

**Objective:** View the VPC you created in Module 1.2 and verify its reconciliation

**Why this matters:** Before troubleshooting a VPC, confirm its stored spec and distinguish it from reported switch state.

**Commands:**

```bash
# List all VPCs in the cluster
kubectl get vpcs

# Get detailed information about your VPC
kubectl get vpc test-vpc -o yaml

# Read the human-readable object summary
kubectl describe vpc test-vpc
```

**Expected output from kubectl describe:**

```
Name:         test-vpc
Namespace:    default
Labels:       fabric.githedgehog.com/ipv4ns=default
              fabric.githedgehog.com/vlanns=default
Annotations:  kubectl.kubernetes.io/last-applied-configuration: {...}
API Version:  vpc.githedgehog.com/v1beta1
Kind:         VPC
Metadata:
  Creation Timestamp:  2026-xx-xxTxx:xx:xxZ
  Generation:          1 or 2
  Resource Version:    xxxxxx
  UID:                 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Spec:
  Ipv4Namespace:  default
  Subnets:
    Default:
      Dhcp:
        Enable:  true
        Range:
          End:    10.99.1.99
          Start:  10.99.1.10
      Gateway:  10.99.1.1
      Subnet:   10.99.1.0/24
      Vlan:     1999
    Backend:
      Gateway:  10.99.2.1
      Subnet:   10.99.2.0/24
      Vlan:     1998
  Vlan Namespace:  default
Events:            <none>
```

**What to look for:**

- **Events: \<none>** - This Fabric release does not emit Kubernetes Events for VPC operations. Empty Events do not prove successful reconciliation.
- **Spec fields present** - Your configuration is stored in the cluster
- **Stored subnets visible** - `default` is required; `backend` appears only if you completed Module 1.2's optional Task 5

**Understanding VPC Status:**

Hedgehog VPCs have minimal status fields. Verify reconciliation succeeded using agent status instead:

```bash
# Confirm agents applied the config (APPLIEDG should equal CURRENTG)
kubectl get agents
```

**Validation exercise:**

Run `kubectl describe vpc test-vpc` and `kubectl get agents`, then answer:
- Does the VPC exist, and which subnets are stored? (Expected: `default`; `backend` only after optional Task 5)
- Do all Agent APPLIEDG values match CURRENTG at the baseline? (Expected: Yes; this does not prove the unattached VPC reached a switch)

---

### Task 1.2: Explore Fabric Resources

**Objective:** Discover what other Hedgehog resources exist and their relationships

**Why this matters:** Understanding the full topology helps you troubleshoot connectivity issues and plan VPC attachments.

**Commands:**

```bash
# List all switches (agents)
kubectl get agents -A

# List all connections between switches and servers
kubectl get connections -A

# List all VPC attachments (servers connected to VPCs)
kubectl get vpcattachments -A
```

**Expected output - Switches:**

```
NAMESPACE   NAME       ROLE          DESCR           APPLIED   VERSION
default     leaf-01    server-leaf   VS-01 MCLAG 1   2m        v0.96.2
default     leaf-02    server-leaf   VS-02 MCLAG 1   3m        v0.96.2
default     leaf-03    server-leaf   VS-03 ESLAG 1   2m        v0.96.2
default     leaf-04    server-leaf   VS-04 ESLAG 1   3m        v0.96.2
default     leaf-05    server-leaf   VS-05           5m        v0.96.2
default     spine-01   spine         VS-06           4m        v0.96.2
default     spine-02   spine         VS-07           3m        v0.96.2
```

**What this tells you:**
- 🔍 7 switches total: 2 spines, 5 server-leaf switches
- 🔍 ROLE column distinguishes spine from leaf
- 🔍 APPLIED column shows last successful config push
- 🔍 VERSION shows the Hedgehog agent version running on each switch

**Expected output - Connections:**

```
NAME                                 TYPE           AGE
leaf-01--mclag-domain--leaf-02       mclag-domain   2h
server-01--mclag--leaf-01--leaf-02   mclag          2h
server-02--mclag--leaf-01--leaf-02   mclag          2h
server-03--unbundled--leaf-01        unbundled      2h
server-04--bundled--leaf-02          bundled        2h
...
```

**What this tells you:**
- 🔍 Connection names are self-documenting: `server--type--switches`
- 🔍 Types include mclag (dual-homed), eslag, bundled (port-channel), unbundled (single link)
- 🔍 Connections are pre-configured during fabric installation (Day 1, not Day 2)

**Validation exercise:**

Run the commands above and answer:
- How many spine switches are in the fabric? (Expected: 2)
- What connection type is used by server-01? (Expected: mclag)

---

### Task 1.3: Understanding kubectl describe vs get

**Objective:** Learn when to use `describe` versus `get` for different information needs

**Why this matters:** `describe` is human-readable; `get -o yaml` gives exact spec fields. VPC Events are usually empty in this release.

**Commands:**

```bash
# Human-readable summary; Events may be empty
kubectl describe vpc test-vpc

# Raw YAML for exact field inspection
kubectl get vpc test-vpc -o yaml

# Tabular list view
kubectl get vpcs
```

**When to use each:**

| Command | Best For | Example Use Case |
|---------|----------|------------------|
| `kubectl describe` | Object summary | Read spec and metadata; Events may be empty |
| `kubectl get -o yaml` | Field validation | Verify exact VLAN ID or subnet CIDR |
| `kubectl get` (tabular) | Quick inventory | List all VPCs to see what exists |

**Key teaching point:**

For VPCs in this Fabric release, an empty Events section is expected and inconclusive. Read the VPC spec, affected Agent state and any admission error from the command that failed.

---

### Part 1 Summary

**What you practiced:**
- ✅ Inspecting VPC state with kubectl
- ✅ Distinguishing VPC desired state from Agent applied state
- ✅ Listing fabric resources (switches, connections)
- ✅ Choosing between `describe` and `get` commands

**kubectl Quick Reference:**

```bash
# VPC operations
kubectl get vpcs                      # List all VPCs
kubectl describe vpc <name>           # Read a human-readable object summary
kubectl get vpc <name> -o yaml        # View full configuration

# Fabric topology
kubectl get agents -A                 # List switches
kubectl get connections -A            # List server connections
kubectl get vpcattachments -A         # List VPC-to-server bindings

# General troubleshooting
kubectl get agents
```

---

## Part 2: The Write Interface - Gitea

### Your Configuration Time Machine

Gitea provides Git-based version control for your network configurations. Every change is tracked: who made it, when, and why. This isn't just compliance—it's **operational confidence**. You can see exactly what changed when things break, and you can roll back safely.

---

### Task 2.1: View Commit History

**Objective:** Understand when and why configurations changed

**Why this matters:** When troubleshooting, knowing **when** a configuration changed helps correlate problems with specific changes. For audits, you need to answer "who changed what, when."

**Steps:**

1. Open Gitea in your browser: `http://YOUR_VM_IP:3001`
2. Navigate to the `student/hedgehog-config` repository
3. Click **Commits** in the top navigation
4. Review the commit history

**Expected commit history (similar to — your VM's history will vary):**

```
59ad4e4c  Fix VPCAttachment example format                   some days ago  labstudent
e7ad155e  Update lab-info.yaml with correct credentials      some days ago  labstudent
4ceb46b8  Test push from labstudent                          some days ago  labstudent
3ee76cf0  Remove test VPC after validation                   some days ago  labstudent
89e4c8fb  Add myfirst-vpc for Module 1.2 validation          some days ago  labstudent
```

**What each commit shows:**
- 📜 **Commit SHA** (59ad4e4c) - Unique identifier for this exact configuration state
- 📜 **Commit message** - Human-readable description of what changed
- 📜 **Timestamp** - When the change was made
- 📜 **Author** - Who made the change

**Validation exercise:**

Browse the commit history and find a commit that added or removed a VPC:
- What's the commit message? (Example: "Add myfirst-vpc for Module 1.2 validation")
- Who made the change and when?

**Why Git for network configuration?**

Traditional networking has no native audit trail. If someone misconfigures a switch, you might never know who or when unless you manually check logs. Git gives you:
- **Accountability:** Every change is attributed to an author
- **History:** Complete timeline of all configuration changes
- **Rollback:** Can revert to any previous configuration state
- **Code review:** Changes can be reviewed before deployment

---

### Task 2.2: View File Changes (Diffs)

**Objective:** Compare configurations across commits to understand what changed

**Why this matters:** When a VPC stops working after a change, seeing the **exact diff** helps you identify the problem. Diffs also help during code reviews.

**Steps:**

1. In Gitea commit history, click on any commit (e.g., the latest one)
2. Gitea shows the **diff** view with changes highlighted
3. Observe additions (green, + prefix) and deletions (red, - prefix)

**Example diff view** (click the "Add myfirst-vpc for Module 1.2 validation" commit to see a real example):

```diff
examples/vpc-simple.yaml → added to active/

+ apiVersion: vpc.githedgehog.com/v1beta1
+ kind: VPC
+ metadata:
+   name: myfirst-vpc      # GREEN: Added
+   namespace: default
+ spec:
+   ipv4Namespace: default
+   vlanNamespace: default
+   subnets:
+     default:
+       subnet: 10.0.10.0/24
+       gateway: 10.0.10.1
+       vlan: 1010
```

**What the diff tells you:**
- 🔄 **Red lines (-)** show what was removed
- 🔄 **Green lines (+)** show what was added
- 🔄 **Context lines** (no prefix) show unchanged configuration
- 🔄 **File rename** detected (my-first-vpc.yaml → myfirst-vpc.yaml)

**Real-world scenario:**

Imagine a colleague tells you: "I updated prod-vpc yesterday and now DHCP isn't working."

With Gitea, you can:
1. Find yesterday's commits
2. View the diff
3. Spot the issue: `dhcp.enable: true` changed to `dhcp.enable: false`
4. Revert the file and commit the fix

**Validation exercise:**

Click on a commit that modified a VPC file and answer:
- What field(s) changed?
- Can you identify what was added vs. removed?

---

### Task 2.3: Explore Repository Structure

**Objective:** Understand how Hedgehog configurations are organized

**Why this matters:** Knowing where to create new VPC files, where to find examples, and how directories are structured makes you efficient during operations.

**Steps:**

1. Navigate to the repository root
2. Browse the directory structure

**Expected structure:**

```
hedgehog-config/
├── README.md                          # Repository documentation
├── active/                            # Active configurations (applied to fabric)
│   ├── .gitkeep                       # Keeps directory in git when empty
│   └── lab-info.yaml                  # Lab environment information
└── examples/                          # Example/template YAML files
    ├── vpc-simple.yaml                # Single-subnet VPC template
    ├── vpc-multi-subnet.yaml          # Multi-subnet VPC template
    └── vpcattachment-example.yaml     # VPCAttachment template
```

**What this structure tells you:**
- 📁 **`active/`** — configurations applied to the fabric (this is where you'd place real configs)
- 📁 **`examples/`** — template files showing correct YAML syntax for each resource type
- 📁 **Flat structure** — no deep nesting makes files easy to find

**Where to create new resources:**
- New VPC? → Copy from `examples/vpc-simple.yaml` into `active/` and customize
- New attachment? → Copy from `examples/vpcattachment-example.yaml` into `active/` and customize

**Validation exercise:**

Browse to `examples/vpc-simple.yaml` and answer:
- What VPC name does the example use? (Expected: `simple-vpc`)
- What subnet CIDR is configured? (Expected: `10.10.10.0/24`)
- What's the purpose of the `active/` directory? (Expected: Where you place configs that are actually applied to the fabric)

---

### Part 2 Summary

**What you practiced:**
- ✅ Viewing Git commit history in Gitea
- ✅ Reading diffs to understand configuration changes
- ✅ Navigating repository structure
- ✅ Understanding why Git provides audit trail for compliance

**Gitea Quick Reference:**

| Feature | How to Access | Use Case |
|---------|---------------|----------|
| **Commits Tab** | Click "Commits" in top nav | View change history |
| **Diff View** | Click on any commit | See what changed |
| **File Browser** | Click on files/folders | Navigate repository |
| **Blame View** | Click "Blame" on file | See who last changed each line (advanced) |

**Key takeaway:** Gitea is your **configuration audit trail**. Use it to answer "who/what/when" questions about changes, and to compare configurations across time.

---

## Part 3: The Observe Interface - Grafana

### Your Fabric Health Dashboard

Grafana visualizes metrics and logs collected from switches over time. While kubectl shows you "what's happening right now," Grafana shows you **trends**: Is CPU usage increasing? Are interfaces dropping packets? When did this error pattern start?

Hedgehog provides **6 pre-built dashboards** covering different aspects of fabric health. In this task, you'll tour all six to understand what each one monitors.

**Important timing note:** We'll take a **skim approach** (6 dashboards in 5-6 minutes). The goal is familiarity, not mastery. You'll see these dashboards again in Course 3 (Observability) where we'll go deeper.

---

### Grafana Dashboard Tour Overview

Sign in at `http://YOUR_VM_IP:3000` with `admin` / `admin`. Open each saved dashboard by title from **Dashboards**; URL slugs may differ. Use **Last 15 minutes** or samples available since this VM booted. A fresh clone cannot provide a full day of its own history.

| Dashboard title | UID | Runnable read |
| --- | --- | --- |
| Hedgehog Fabric | `ab831ceb-cf5c-474a-b7e9-83dcd075c218` | Select a **Switch** and read a BGP neighbor's state. |
| Hedgehog Switch Interface Counters | `a5e5b12d-b340-4753-8f83-af8d54304822` | Select a **Switch** and **Interface**; read state, traffic, errors and discards. |
| Hedgehog Fabric Logs | `c42a51e5-86a8-42a0-b1c9-d1304ae655bv` | Select a **Switch**; read one timestamped line or note no match. |
| Hedgehog Fabric Platform Stats | `f8a648b9-5510-49ca-9273-952ba6169b7v` | Select **Host Name**; note which physical-sensor panels have `No data`. |
| Hedgehog Switch Critical Resources | `fb08315c-cabb-4da7-9db9-2e17278f1781` | Select a **Switch**; record any route, nexthop or neighbor value. |
| Hedgehog mod of Node Exporter Full | `rYdddlPWv` | Select a **Host**; read CPU and RAM, and record any `N/A` filesystem or swap panel. |

### Task 3.1: Tour the six views

Open the six titles above. For each one, record the selected switch, interface or host; the time range; and one actual displayed value or `No data`. On **Hedgehog Fabric**, note the current BGP view rather than assuming a green history cell rules out short flaps. On **Hedgehog Fabric Logs**, a `VPC` search is optional and no hit is not a failure.

The virtual switches may not export physical temperature, fan, PSU or ASIC/TCAM capacity series. `No data` on those panels is an observation, not a physical hardware fault. Route and nexthop values on **Hedgehog Switch Critical Resources** remain useful as displayed counters. On **Hedgehog mod of Node Exporter Full**, CPU/RAM may appear while Root FS or SWAP shows `N/A`. Do not impose fixed CPU, error-rate or capacity thresholds without workload and source context. Course 3.2 examines these panels in depth.

**Validation exercise:** Which title shows the BGP view? Which shows one interface's errors and discards? Which selected switch has a recent log line? Name one unavailable virtual-hardware series and one metric that is present. Record the values you actually see; the displayed state can change during boot.

### Part 3 Summary

**What you explored:**
- ✅ Purpose of each of the 6 Grafana dashboards
- ✅ Key metrics to monitor in each dashboard
- ✅ How to navigate between dashboards
- ✅ Which dashboard panels have samples and which have virtual-hardware limits

**Grafana Dashboard Quick Reference:**

| Dashboard | Useful read in this virtual lab |
| --- | --- |
| Hedgehog Fabric | BGP neighbor state and history at the available resolution |
| Hedgehog Switch Interface Counters | One port's state, traffic, errors and discards |
| Hedgehog Fabric Logs | Timestamped switch logs for a selected switch |
| Hedgehog Fabric Platform Stats | Available physical-sensor series or `No data` |
| Hedgehog Switch Critical Resources | Reported routes, nexthops and neighbors; no physical ASIC claim |
| Hedgehog mod of Node Exporter Full | CPU/RAM and any unavailable root filesystem or swap series |

**Key takeaway:** Grafana shows you **trends over time**. Use it to answer questions like "when did this start?" and "is this getting worse?" that kubectl can't answer.

---

## Integrated Troubleshooting Scenario

The following DHCP incident is **illustrative**. This R0 lab does not seed `broken-vpc`, `broken-vpc.yaml` or a DHCP fault. Do not create or alter an object to make the story appear real. The runnable reads below use the `test-vpc` from Module 1.2 and the Gitea teaching history.

A colleague says a server has no DHCP lease. First ask for the exact VPC and VPCAttachment names, the server connection and the time of failure. Determine whether the desired configuration came from a Gitea commit synced by ArgoCD or a direct `kubectl apply`. The `test-vpc` in Module 1.2 was applied directly, so it has no Gitea commit to audit.

### Step 1: Read available configuration and history

Open `http://YOUR_VM_IP:3001/student/hedgehog-config` and inspect the `active/` tree and `myfirst-vpc` add/remove commits. Record an author, timestamp and changed file. These teaching commits demonstrate Git history; they are not the history of `test-vpc`. For a real GitOps incident, inspect the commit and ArgoCD sync revision of the **named** VPC before proposing a change.

### Step 2: Read actual cluster state

```bash
kubectl get vpc test-vpc -o yaml
kubectl describe vpc test-vpc
kubectl get vpcattachments
kubectl get agents
```

Confirm that `test-vpc` exists and read its stored subnet spec. It is unattached in this module, so no server DHCP claim follows from its existence. A VPC `Events: <none>` line is expected in Fabric v0.96.2 and **does not prove** reconciliation or server connectivity. For a real attached VPC, confirm the named VPCAttachment and connection, then check affected Agent desired entries, `APPLIEDG == CURRENTG`, the server lease and a bounded dataplane test. An admission rejection may stop an invalid object before it exists; use the returned API error instead of inventing a VPC warning event.

### Step 3: Read observed fabric health

Open **Hedgehog Fabric** and **Hedgehog Switch Interface Counters** in Grafana. Select a real switch and port and record the displayed BGP state, link state and error/discard trend. Open **Hedgehog Fabric Logs**, select a switch and note a timestamped line or no match. These views can narrow a real incident but do not diagnose the unseeded story. Use actual timestamps and object names when correlating Git, cluster and telemetry evidence.

**Decision rule:** Treat missing configuration, a mismatched Agent generation, a server without a lease and a blank dashboard panel as different findings. Gather the named object's admission result, attachment, Agent and server evidence before changing or restarting anything.

**Validation exercise:** Explain why `kubectl get vpc test-vpc` proves storage but not a DHCP lease, why `Events: <none>` is inconclusive, and which Gitea history entry you can actually inspect.

## Wrap-Up

### Key Takeaways

You've now mastered the three-interface operational model:

1. **kubectl = Current State**
   - Use for: Real-time inspection, troubleshooting, checking reconciliation
   - Key commands: `kubectl get vpc test-vpc -o yaml` and `kubectl get agents`

2. **Gitea = Configuration History**
   - Use for: Auditing changes, reviewing diffs, maintaining compliance
   - Key feature: Commit history with diffs

3. **Grafana = Health Trends**
   - Use for: Monitoring metrics over time, identifying patterns, capacity planning
   - Key dashboards: Fabric (daily check), Platform (control plane), Interfaces (links)

4. **Troubleshooting = All Three Together**
   - Flow: identify the actual source (Git or direct apply) → read the named cluster objects and Agents → correlate current telemetry
   - A VPC `Events: <none>` line is inconclusive in this release

### What You've Accomplished

- ✅ Explored kubectl to inspect VPCs and fabric resources
- ✅ Navigated Gitea to view commit history and diffs
- ✅ Toured all 6 Grafana dashboards
- ✅ Applied systematic troubleshooting methodology

### Confidence Check

You should now feel confident answering:
- "Which interface should I use to check if a VPC is deployed correctly?" → kubectl
- "How do I see who changed a VPC configuration last week?" → Gitea commit history
- "Where can I view available switch CPU usage samples?" → Grafana Node Exporter dashboard
- "My VPC isn't working—where do I start troubleshooting?" → Identify its config source, inspect the named VPC and attachment with kubectl, then correlate Agent and Grafana evidence

### Preview of Module 1.4

Next module wraps up Course 1 with a recap of what you've learned (Modules 1.1-1.3) and previews Course 2, where you'll use these interfaces to perform actual provisioning operations: creating VPCs, attaching servers, and validating connectivity.

---

## Assessment

### Question 1: Interface Selection

**Stem:** You need to view the CPU usage samples available for spine-01. Which interface should you use?

A) kubectl
B) Gitea
C) Grafana
D) ArgoCD

<details>
<summary>Show Answer</summary>

**Correct Answer:** C (Grafana)

**Explanation:**

Grafana stores time-series samples and can display trends within the data available since this VM booted. kubectl shows current cluster state. Gitea contains the teaching repository history; ArgoCD reports GitOps sync state. The Node Exporter dashboard can show CPU samples for a selected host.

**Learning Objective:** LO #1 - Select the appropriate interface

</details>

---

### Question 2: VPC and Agent Evidence

**Stem:** You apply an unattached `test-vpc`. `kubectl get vpc test-vpc` succeeds, but no Agent generation changes. What can you conclude?

A) The VPC does not exist
B) The API stored the VPC, while no switch-facing change is shown by Agent generations
C) All server DHCP leases have been verified
D) The Fabricator controller must be restarted

<details>
<summary>Show Answer</summary>

**Correct Answer:** B

**Explanation:** The VPC read proves stored desired state. Without an attachment, its edit need not enter any Agent spec. Empty VPC Events and unchanged Agent generations do not prove a server dataplane outcome.

**Learning Objective:** LO #2 - Interpret kubectl output

</details>

---

### Question 3: Gitea Audit Trail

**Stem:** Your manager asks: "When was the teaching `myfirst-vpc` configuration changed and by whom?" Which Gitea feature should you use?

A) File browser
B) Commit history
C) Branch manager
D) Pull requests

<details>
<summary>Show Answer</summary>

**Correct Answer:** B (Commit history)

**Explanation:**

The commit history in Gitea shows all changes with timestamps, authors, and commit messages. Each commit records who made the change and when. The file browser shows current file contents but not history. Branch manager and pull requests are for workflow management, not historical audit.

**Learning Objective:** LO #3 - Navigate Gitea

</details>

---

### Question 4: Grafana Dashboard Selection

**Stem:** You want to inspect a selected virtual switch port's errors and discards. Which Grafana dashboard is most useful?

A) Fabric Dashboard
B) Platform Dashboard
C) Interfaces Dashboard
D) Node Exporter Dashboard

<details>
<summary>Show Answer</summary>

**Correct Answer:** C (Interfaces Dashboard)

**Explanation:**

The Hedgehog Switch Interface Counters dashboard shows a selected port's state, traffic, errors and discards. On this virtual switch, these counters do not by themselves identify a physical cable or transceiver fault.

**Learning Objective:** LO #4 - Read Grafana dashboards

</details>

---

### Question 5: Troubleshooting Methodology

**Stem:** A Git-managed VPC appears to be configured correctly in Gitea, but servers are not receiving DHCP addresses. What should you check next?

A) Recreate the VPC configuration file in Gitea
B) Use kubectl to inspect the named VPC, its attachment and affected Agents
C) Check Grafana for switch health
D) Contact support immediately

<details>
<summary>Show Answer</summary>

**Correct Answer:** B (Inspect the named VPC, its attachment and affected Agents)

**Explanation:**

First identify the exact VPC and attachment and whether the configuration came from Git. The next read is the named cluster objects and affected Agent state. A VPC Events section may be empty even when more evidence is needed; follow with server and telemetry checks for a real DHCP incident.

**Learning Objective:** LO #5 - Correlate information across interfaces

</details>

---

### Question 6: Interface Correlation

**Stem:** You see in Grafana Fabric Dashboard that spine-01 is showing "Down" status. What should you do FIRST?

A) Reboot spine-01 immediately
B) Check kubectl for spine-01 Agent status and current spec
C) Edit spine-01 configuration in Gitea
D) Check Platform Dashboard

<details>
<summary>Show Answer</summary>

**Correct Answer:** B (Check kubectl for spine-01 Agent status and current spec)

**Explanation:**

The dashboard is a symptom. Read the named Agent spec and status to identify what it reports at this moment, then correlate other evidence. Do not reboot or edit configuration based on one panel.

**Learning Objective:** LO #6 - Apply troubleshooting methodology

</details>

---

### Practical Assessment

**Task:** Using kubectl, Gitea, and Grafana, answer these questions about your fabric:

1. **kubectl:** How many VPCs exist in the cluster right now?
2. **Gitea:** Who created the `myfirst-vpc` configuration and when?
3. **Grafana:** What BGP state is displayed for one selected switch and neighbor in Hedgehog Fabric?

**Success Criteria:**

- ✅ Uses correct kubectl command (`kubectl get vpcs`)
- ✅ Navigates to Gitea commit history and identifies author/timestamp
- ✅ Opens Hedgehog Fabric and records a displayed switch/neighbor BGP state
- ✅ Can explain which interface was appropriate for each question
- ✅ Demonstrates understanding of when to use each interface

**Rubric:**

- **Full credit (10 points):** Correctly uses all three interfaces and provides accurate answers
- **Partial credit (6-9 points):** Uses 2-3 interfaces correctly but struggles with one
- **Minimal credit (3-5 points):** Uses 1 interface correctly but needs guidance on others
- **No credit (0-2 points):** Cannot use interfaces appropriately or answers are incorrect

---

## Reference

### kubectl Commands Reference

**VPC inspection:**
```bash
kubectl get vpcs                      # List all VPCs
kubectl describe vpc <name>           # Read a human-readable object summary
kubectl get vpc <name> -o yaml        # View full VPC configuration
```

**Fabric topology:**
```bash
kubectl get agents -A                 # List all switches (agents)
kubectl get connections -A            # List server connections
kubectl get vpcattachments -A         # List VPC-to-server attachments
```

**Agent status after a switch-facing change:**
```bash
kubectl get agents                      # Compare applied and current generations
kubectl get agent leaf-01 -o yaml       # Inspect the named Agent's spec and status
```

VPC Events are typically empty on this Fabric release; an empty section does not establish reconciliation.

---

### Gitea Quick Reference

**Navigation:**
- **Repository URL:** `http://YOUR_VM_IP:3001/student/hedgehog-config`
- **Commits:** Click "Commits" tab to view history
- **Diff View:** Click on any commit to see changes
- **File Browser:** Click files/folders to navigate

**What to use Gitea for:**
- View configuration history (commits)
- See what changed between versions (diffs)
- Audit who made which changes (author and timestamp)
- Browse repository structure (find where to create new files)

---

### Grafana Quick Reference

**Access:** `http://YOUR_VM_IP:3000` (admin/admin)

**Dashboard URLs:**

1. **Fabric Dashboard** (daily health check)
   - URL: `/d/ab831ceb-cf5c-474a-b7e9-83dcd075c218/fabric`
   - Use for: Overall fabric health, switch status, VPC count

2. **Platform Dashboard** (control plane health)
   - URL: `/d/f8a648b9-5510-49ca-9273-952ba6169b7v/platform`
   - Use for: available platform panels; physical sensors may show `No data`

3. **Interfaces Dashboard** (port health)
   - URL: `/d/a5e5b12d-b340-4753-8f83-af8d54304822/interfaces`
   - Use for: Interface status, traffic rates, error counters

4. **Logs Dashboard** (syslog aggregation)
   - URL: `/d/c42a51e5-86a8-42a0-b1c9-d1304ae655bv/logs`
   - Use for: Searching logs, troubleshooting, audit trail

5. **Node Exporter Dashboard** (system metrics)
   - URL: `/d/rYdddlPWv/node-exporter-full-2`
   - Use for: CPU, memory, disk usage on switches

6. **Switch CRM Dashboard** (capacity monitoring)
   - URL: `/d/fb08315c-cabb-4da7-9db9-2e17278f1781/switch-critical-resources`
   - Use for: reported routes and nexthops; no physical ASIC capacity claim

---

### Troubleshooting Flow Reference

**Standard flow for "VPC not working" issues:**

1. **Source** - Identify whether this VPC came from Gitea/ArgoCD or direct apply
2. **kubectl** - Read the named VPC, attachments and affected Agents
3. **Grafana and server** - Correlate selected telemetry with an actual lease or dataplane check

**Quick checks:**

```bash
# 1. Read the named VPC's desired state; substitute a real name
kubectl get vpc <name> -o yaml

# 2. Check switch health
kubectl get agents -A

# 3. Check Grafana Fabric Dashboard
# (open in browser)
```

---

### Related Documentation

- [Hedgehog Learning Philosophy](../../../network-like-hyperscaler/hedgehogLearningPhilosophy.md)
- [CRD Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md)
- [Observability Guide](../../../network-like-hyperscaler/research/OBSERVABILITY.md)
- [Module Dependency Graph](../../../network-like-hyperscaler/MODULE_DEPENDENCY_GRAPH.md)

---

**Module Complete!** You've mastered the three-interface operational model. Ready to continue to Module 1.4: Course 1 Recap.
