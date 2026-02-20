---
title: "Mastering the Three Interfaces"
slug: "fabric-operations-mastering-interfaces"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.0.0"
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
2. **Interpret kubectl output** including events, reconciliation status, and resource relationships
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
| **kubectl** | **Read/Inspect** | Check current state, view events, troubleshoot issues | Real-time cluster state |
| **Gitea** | **Write/Audit** | Create/modify configs, review history, audit changes | Declarative desired state |
| **Grafana** | **Observe/Monitor** | View health trends, monitor metrics, identify patterns | Time-series operational data |

### Decision Matrix: Which Tool Do I Use?

**Use kubectl when you need to:**
- ✅ Check if a VPC exists and is reconciled
- ✅ View error events from failed configurations
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
- ✅ View fabric health trends over the past 24 hours
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

**Why this matters:** Before troubleshooting any VPC issue, you need to confirm it exists and check for error events. kubectl is your first diagnostic tool.

**Commands:**

```bash
# List all VPCs in the cluster
kubectl get vpcs

# Get detailed information about your VPC
kubectl get vpc test-vpc -o yaml

# Check for reconciliation events (most important!)
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
  Generation:          2
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

- **Events: \<none>** - This is **good news**! Hedgehog VPCs do not currently emit Kubernetes events, so an empty Events section means no errors occurred. If error events are present, they indicate a problem.
- **Spec fields present** - Your configuration is stored in the cluster
- **Two subnets visible** - Both `default` and `backend` subnets from Module 1.2's Task 5

**Understanding VPC Status:**

Hedgehog VPCs have minimal status fields. Verify reconciliation succeeded using agent status instead:

```bash
# Confirm agents applied the config (APPLIEDG should equal CURRENTG)
kubectl get agents
```

**Validation exercise:**

Run `kubectl describe vpc test-vpc` and `kubectl get agents`, then answer:
- Are there any error or warning events in the VPC? (Expected: No — Events: \<none>)
- Do all agent APPLIEDG values match CURRENTG? (Expected: Yes)

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
default     leaf-01    server-leaf   VS-01 MCLAG 1   2m        v0.87.4
default     leaf-02    server-leaf   VS-02 MCLAG 1   3m        v0.87.4
default     leaf-03    server-leaf   VS-03 ESLAG 1   2m        v0.87.4
default     leaf-04    server-leaf   VS-04 ESLAG 1   3m        v0.87.4
default     leaf-05    server-leaf   VS-05           5m        v0.87.4
default     spine-01   spine         VS-06           4m        v0.87.4
default     spine-02   spine         VS-07           3m        v0.87.4
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

**Why this matters:** `describe` is human-readable and shows events (critical for troubleshooting). `get -o yaml` gives you exact field values for validation.

**Commands:**

```bash
# Human-readable summary with events
kubectl describe vpc test-vpc

# Raw YAML for exact field inspection
kubectl get vpc test-vpc -o yaml

# Tabular list view
kubectl get vpcs
```

**When to use each:**

| Command | Best For | Example Use Case |
|---------|----------|------------------|
| `kubectl describe` | Troubleshooting | Check for error events during VPC creation |
| `kubectl get -o yaml` | Field validation | Verify exact VLAN ID or subnet CIDR |
| `kubectl get` (tabular) | Quick inventory | List all VPCs to see what exists |

**Key teaching point:**

The Events section at the bottom of `kubectl describe` output is **your first troubleshooting checkpoint**. Always check events before diving deeper into logs or switch state.

---

### Part 1 Summary

**What you practiced:**
- ✅ Inspecting VPC state with kubectl
- ✅ Understanding event-based reconciliation (no errors = success)
- ✅ Listing fabric resources (switches, connections)
- ✅ Choosing between `describe` and `get` commands

**kubectl Quick Reference:**

```bash
# VPC operations
kubectl get vpcs                      # List all VPCs
kubectl describe vpc <name>           # Check events (most important!)
kubectl get vpc <name> -o yaml        # View full configuration

# Fabric topology
kubectl get agents -A                 # List switches
kubectl get connections -A            # List server connections
kubectl get vpcattachments -A         # List VPC-to-server bindings

# General troubleshooting
kubectl get events --sort-by='.lastTimestamp' | tail -20
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

1. Open Gitea in your browser: `http://YOUR_VM_IP:3001` (or `http://localhost:3001` if using RDP inside the VM)
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

**Access:** `http://YOUR_VM_IP:3000` (username: `admin`, password: `admin`) — use `http://localhost:3000` if accessing from inside the VM via RDP

**The 6 Hedgehog Dashboards:**

1. **Fabric Dashboard** - Overall fabric health (MOST IMPORTANT)
2. **Platform Dashboard** - Control plane health (MOST IMPORTANT)
3. **Interfaces Dashboard** - Port status and traffic
4. **Logs Dashboard** - Aggregated syslog
5. **Node Exporter Dashboard** - Switch hardware metrics
6. **Switch CRM Dashboard** - ASIC capacity monitoring

**Time allocation:**
- Dashboards 1-2: ~1 minute each (critical for daily operations)
- Dashboards 3-6: ~30-60 seconds each (overview only)

---

### Task 3.1: Fabric Dashboard

**Purpose:** High-level fabric health overview - your daily starting point

**URL:** `http://localhost:3000/d/ab831ceb-cf5c-474a-b7e9-83dcd075c218/fabric`

**Key panels to look for:**
- **Switch Status** - Green/red indicators for each switch
- **Fabric Topology** - Visual representation of spine-leaf architecture
- **Active VPCs** - Count of deployed VPCs
- **Connection Health** - MCLAG/ESLAG status

**What healthy looks like:**
- ✅ All switches showing green status
- ✅ VPC count matches `kubectl get vpcs | wc -l` output
- ✅ No red indicators or alerts
- ✅ All connections showing as established

**Why this dashboard matters:**

This is your **first checkpoint each day**. Before making any changes to the fabric, glance at this dashboard to confirm everything is healthy. Red indicators warrant investigation before you proceed.

**Validation exercise:**

Open the Fabric dashboard and answer:
- How many switches are showing "Up" status? (Expected: 7 - all switches)
- Does the VPC count match what you see in kubectl? (Expected: Yes)

---

### Task 3.2: Platform Dashboard

**Purpose:** Hedgehog control plane health (Kubernetes & Fabricator controller)

**URL:** `http://localhost:3000/d/f8a648b9-5510-49ca-9273-952ba6169b7v/platform`

**Key panels to look for:**
- **Control Node Status** - CPU, memory, disk usage of control plane
- **Fabricator Controller** - Reconciliation rate, error count
- **Kubernetes API** - API server request rate and latency
- **etcd Health** - Cluster database metrics

**What healthy looks like:**
- ✅ Control node CPU < 80%
- ✅ Fabricator error count = 0
- ✅ API server responding with low latency
- ✅ etcd healthy with no frequent leader elections

**Why this dashboard matters:**

The control plane is the **brain of Hedgehog**. If the control plane is unhealthy (high CPU, Fabricator errors), your VPC changes won't apply correctly. Monitor this dashboard during and after VPC deployments.

**What to expect:** CPU/memory spikes during reconciliation are normal. Sustained high usage or error counts are not.

**Validation exercise:**

Open the Platform dashboard and observe:
- What's the current CPU usage? (Expected: Typically < 50%, varies by activity)
- Are there any Fabricator errors? (Expected: 0 errors)

---

### Task 3.3: Interfaces Dashboard

**Purpose:** Switch port utilization, link status, and error rates

**URL:** `http://localhost:3000/d/a5e5b12d-b340-4753-8f83-af8d54304822/interfaces`

**Key panels to look for:**
- **Port Status** - Up/down state for all interfaces
- **Traffic Rates** - Ingress/egress bandwidth usage
- **Error Counters** - CRC errors, drops, discards
- **Interface Types** - Fabric links, server links, MCLAG peer links

**What healthy looks like:**
- ✅ All fabric links (spine↔leaf) showing up
- ✅ Error rates < 0.1% (occasional errors are normal, sustained errors indicate problems)
- ✅ Traffic patterns match expected workload
- ✅ No excessive packet drops

**Why this dashboard matters:**

Interface health is your early warning system for **physical layer issues**: bad cables, transceiver failures, or link saturation. If users report connectivity problems, check this dashboard for interface errors.

**Validation exercise:**

Open the Interfaces dashboard and check:
- Are all fabric links (spine-to-leaf) showing "Up"? (Expected: Yes)
- Do you see any interfaces with high error rates? (Expected: No, or very low)

---

### Task 3.4: Logs Dashboard

**Purpose:** Aggregated syslog messages from all switches

**URL:** `http://localhost:3000/d/c42a51e5-86a8-42a0-b1c9-d1304ae655bv/logs`

**Key panels to look for:**
- **Recent Logs** - Stream of syslog messages
- **Log Levels** - Count by severity (INFO, WARNING, ERROR)
- **Top Log Sources** - Which switches are logging most
- **Search Box** - Filter logs by keyword

**What healthy looks like:**
- ✅ Mostly INFO level logs (routine operations)
- ✅ No ERROR level logs (or investigate if present)
- ✅ WARNING logs during config changes are normal
- ✅ Logs from all 7 switches present

**Why this dashboard matters:**

Logs are your **black box recorder** for the fabric. When troubleshooting intermittent issues or reconstructing events, searchable, time-stamped logs from all switches are essential.

**Validation exercise:**

Open the Logs dashboard and try:
- Search for "VPC" or "test-vpc" in the search box
- Do you see logs related to your VPC creation? (Expected: Possibly — VNI assignment and VLAN configuration logs may appear)

---

### Task 3.5: Node Exporter Dashboard

**Purpose:** Switch hardware metrics (CPU, memory, disk, system load)

**URL:** `http://localhost:3000/d/rYdddlPWv/node-exporter-full-2`

**Key panels to look for:**
- **CPU Usage** - Per-switch CPU utilization
- **Memory Usage** - RAM consumption
- **Disk I/O** - Read/write rates and disk space
- **System Load** - 1/5/15 minute load averages

**What healthy looks like:**
- ✅ CPU usage < 80% (brief spikes during config push are okay)
- ✅ Memory usage stable (not steadily growing)
- ✅ Disk space > 20% free

**Why this dashboard matters:**

These are your **switch vital signs**—Linux OS-level metrics. High CPU or memory usage can indicate switch software issues, not network issues. Disk space problems can prevent logging.

**Quick skim:** This dashboard has many panels. Focus on the top-level summary panels for CPU and memory. Deep dives happen during capacity planning or performance troubleshooting.

---

### Task 3.6: Switch CRM Dashboard

**Purpose:** Critical Resource Monitoring - ASIC resources (TCAM, route tables, neighbors)

**URL:** `http://localhost:3000/d/fb08315c-cabb-4da7-9db9-2e17278f1781/switch-critical-resources`

**Key panels to look for:**
- **TCAM Utilization** - ACL and route table space used
- **Route Count** - IPv4/IPv6 routes programmed
- **ARP/ND Neighbors** - Neighbor table entries
- **VXLAN Tunnels** - VTEP count

**What healthy looks like:**
- ✅ TCAM usage < 80% (leaving room for growth)
- ✅ Route count matches expected topology
- ✅ Neighbor entries stable
- ✅ VXLAN tunnels correlate with VPC count

**Why this dashboard matters:**

Switch ASICs have **finite hardware resources**. TCAM (Ternary Content Addressable Memory) stores ACLs and routes. If you approach capacity limits, the switch may reject new VPCs or routes. This dashboard helps you plan capacity.

**Quick skim:** Note the utilization percentages. If anything is approaching 80%, that's a signal to plan for fabric expansion.

---

### Part 3 Summary

**What you explored:**
- ✅ Purpose of each of the 6 Grafana dashboards
- ✅ Key metrics to monitor in each dashboard
- ✅ How to navigate between dashboards
- ✅ What "healthy" looks like in each context

**Grafana Dashboard Quick Reference:**

| Dashboard | Use When | Key Metrics | Priority |
|-----------|----------|-------------|----------|
| **Fabric** | Daily health check | Switch status, VPC count | 🔴 Critical |
| **Platform** | Control plane issues | Fabricator errors, CPU | 🔴 Critical |
| **Interfaces** | Link/connectivity problems | Port status, error rates | 🟡 Important |
| **Logs** | Troubleshooting, auditing | Error logs, event timeline | 🟡 Important |
| **Node Exporter** | Performance issues | CPU, memory, disk | 🟢 Monitoring |
| **CRM** | Capacity planning | TCAM usage, route count | 🟢 Monitoring |

**Key takeaway:** Grafana shows you **trends over time**. Use it to answer questions like "when did this start?" and "is this getting worse?" that kubectl can't answer.

---

## Integrated Troubleshooting Scenario

### "My VPC Isn't Working" - A Decision Tree

You've now practiced using each interface individually. Real troubleshooting requires using **all three together** in a systematic flow. Let's walk through a common scenario.

---

### The Scenario

A colleague messages you:

> "I created a VPC called `broken-vpc` but servers can't get DHCP addresses. Can you help troubleshoot?"

Where do you start? Which interface do you check first?

---

### Step 1: Check Configuration (Gitea)

**Question:** Is the VPC configured correctly in Git?

**Why start here:** Git is the **source of truth**. If the configuration is wrong in Gitea, nothing else matters—the VPC will be created incorrectly.

**Actions:**

1. Open Gitea (`http://YOUR_VM_IP:3001`) → navigate to `student/hedgehog-config` repository
2. Browse to `active/` directory
3. Find and open `broken-vpc.yaml` (if it exists there)
4. Review the DHCP configuration

**What to look for:**

```yaml
spec:
  subnets:
    default:
      dhcp:
        enable: true        # ✅ Should be true
        range:
          start: 10.x.x.10  # ✅ Should be a valid IP in the subnet
          end: 10.x.x.250   # ✅ Should be greater than start
      subnet: 10.x.x.0/24   # ✅ Should match the IP range
      vlan: 1001            # ✅ Should be in valid VLAN range
```

**If configuration is wrong:**
- Fix it in Gitea (edit the file, commit the change)
- Wait for ArgoCD to sync (or trigger manual sync)
- The VPC will reconcile with the correct configuration

**If configuration looks correct:**
- Move to Step 2 (check deployment status)

---

### Step 2: Check Deployment Status (kubectl)

**Question:** Did the VPC actually get created in the cluster? Did it reconcile successfully?

**Why check this:** The configuration might be correct in Git, but ArgoCD might not have synced it yet, or the Fabricator controller might have encountered an error during reconciliation.

**Actions:**

```bash
# Check if VPC exists
kubectl get vpc broken-vpc

# Check for error events (MOST IMPORTANT)
kubectl describe vpc broken-vpc

# Focus on the Events section at the bottom
kubectl describe vpc broken-vpc | tail -20
```

**What to look for in Events:**

**Healthy VPC (no errors):**
```
Events:  <none>
```
No error events means the VPC reconciled successfully. If DHCP still isn't working, the issue is likely at the runtime layer (check Grafana in Step 3).

**VPC with reconciliation errors:**
```
Events:
  Type     Reason             Message
  ----     ------             -------
  Warning  ReconcileFailed    Subnet 10.10.10.0/24 overlaps with existing VPC 'prod-vpc'
  Warning  ReconcileFailed    Invalid VLAN 999 not in vlanNamespace 'default' range
  Error    DHCPRangeInvalid   DHCP range 10.10.10.10-10.10.10.5 invalid: start > end
```

**Common error events and what they mean:**

| Error Event | Problem | Fix |
|-------------|---------|-----|
| "Subnet overlaps..." | IP conflict with another VPC | Change subnet to non-overlapping range |
| "Invalid VLAN..." | VLAN ID not in allowed range | Use VLAN within vlanNamespace range |
| "DHCP range invalid" | start IP > end IP, or range outside subnet | Fix DHCP range in Gitea |

**If you see error events:**
- The event message tells you exactly what's wrong
- Fix the issue in Gitea (go back to Step 1)
- Commit the fix and wait for reconciliation

**If no error events:**
- VPC is correctly deployed
- Move to Step 3 (check runtime health)

---

### Step 3: Check Fabric Health (Grafana)

**Question:** Are the switches healthy and able to serve DHCP requests?

**Why check this:** Even if the VPC is correctly configured and deployed, switches might be unhealthy (down, CPU overloaded, Fabricator errors) and unable to forward DHCP traffic.

**Actions:**

1. **Open Fabric Dashboard**
   - URL: `http://localhost:3000/d/ab831ceb-cf5c-474a-b7e9-83dcd075c218/fabric`
   - Check: Are all switches showing green (Up) status?
   - Red switches indicate hardware/connectivity issues

2. **Open Platform Dashboard**
   - URL: `http://localhost:3000/d/f8a648b9-5510-49ca-9273-952ba6169b7v/platform`
   - Check: Is Fabricator error count = 0?
   - Errors here mean reconciliation loop is failing

3. **Open Logs Dashboard**
   - URL: `http://localhost:3000/d/c42a51e5-86a8-42a0-b1c9-d1304ae655bv/logs`
   - Search for "broken-vpc" or "DHCP"
   - Look for error messages related to DHCP relay or VPC configuration

**What to look for:**

- **Red switches** → Hardware/connectivity issue, escalate to infrastructure team
- **Fabricator errors > 0** → Control plane issue, check Fabricator logs with `kubectl logs -n fab deployment/fabric-ctrl`
- **DHCP relay errors in logs** → Switches trying but failing to forward DHCP, check network connectivity between servers and switches

**If Grafana shows healthy state:**
- Switches are up, control plane is healthy, no errors in logs
- The issue may be server-side (DHCP client not running, interface down)
- Or VPCAttachment might be missing (server not actually connected to VPC)

---

### Troubleshooting Decision Tree Diagram

```
My VPC Isn't Working
    ↓
Is the config correct in Gitea?
    ├─ NO → Fix config in Gitea, commit, wait for sync
    └─ YES → ↓
              Does kubectl show the VPC exists?
                  ├─ NO → Check ArgoCD sync status
                  └─ YES → ↓
                            Are there error events in kubectl describe?
                                ├─ YES → Fix issue shown in event message (back to Gitea)
                                └─ NO → ↓
                                          Are switches healthy in Grafana?
                                              ├─ NO → Check Fabric/Platform dashboards, escalate if needed
                                              └─ YES → Check Logs dashboard, verify VPCAttachment, check server DHCP client
```

---

### Key Troubleshooting Principles

1. **Start at the source** (Gitea) - Wrong configuration is the most common issue
2. **Verify deployment** (kubectl) - Check that desired state reached the cluster
3. **Check runtime health** (Grafana) - Ensure switches can execute the configuration
4. **Follow events** - Error events tell you exactly what's wrong
5. **Correlate across interfaces** - No single interface has the complete picture

**Validation exercise:**

Answer these questions to check your understanding:
- If a VPC has no error events in kubectl, what does that mean? (Expected: VPC reconciled successfully)
- Where would you look to see who last modified a VPC configuration? (Expected: Gitea commit history)
- Which Grafana dashboard shows if switches are up or down? (Expected: Fabric Dashboard)

---

## Wrap-Up

### Key Takeaways

You've now mastered the three-interface operational model:

1. **kubectl = Current State**
   - Use for: Real-time inspection, troubleshooting, checking reconciliation
   - Key command: `kubectl describe` to view events

2. **Gitea = Configuration History**
   - Use for: Auditing changes, reviewing diffs, maintaining compliance
   - Key feature: Commit history with diffs

3. **Grafana = Health Trends**
   - Use for: Monitoring metrics over time, identifying patterns, capacity planning
   - Key dashboards: Fabric (daily check), Platform (control plane), Interfaces (links)

4. **Troubleshooting = All Three Together**
   - Flow: Gitea (config) → kubectl (deployment) → Grafana (runtime health)
   - Always check events first
   - Error events tell you what's wrong

### What You've Accomplished

- ✅ Explored kubectl to inspect VPCs and fabric resources
- ✅ Navigated Gitea to view commit history and diffs
- ✅ Toured all 6 Grafana dashboards
- ✅ Applied systematic troubleshooting methodology

### Confidence Check

You should now feel confident answering:
- "Which interface should I use to check if a VPC is deployed correctly?" → kubectl
- "How do I see who changed a VPC configuration last week?" → Gitea commit history
- "Where can I view switch CPU usage trends over the past day?" → Grafana Node Exporter dashboard
- "My VPC isn't working—where do I start troubleshooting?" → Check config in Gitea, then events in kubectl, then health in Grafana

### Preview of Module 1.4

Next module wraps up Course 1 with a recap of what you've learned (Modules 1.1-1.3) and previews Course 2, where you'll use these interfaces to perform actual provisioning operations: creating VPCs, attaching servers, and validating connectivity.

---

## Assessment

### Question 1: Interface Selection

**Stem:** You need to view historical CPU usage trends for spine-01 over the last 24 hours. Which interface should you use?

A) kubectl
B) Gitea
C) Grafana
D) ArgoCD

**Correct Answer:** C (Grafana)

**Explanation:**

Grafana stores time-series metrics and displays trends over time. kubectl shows current state only (a snapshot). Gitea is for configuration history, not runtime metrics. ArgoCD is for GitOps deployment, not monitoring. The Node Exporter dashboard in Grafana shows CPU usage trends.

**Learning Objective:** LO #1 - Select the appropriate interface

---

### Question 2: kubectl Event Interpretation

**Stem:** You run `kubectl describe vpc test-vpc` and see this in the Events section:

```
Warning  ReconcileFailed  2m  fabricator  Subnet 10.10.10.0/24 overlaps with existing VPC 'prod-vpc'
```

What does this mean?

A) The VPC is being deployed normally (this warning is expected)
B) The VPC configuration has an error that must be fixed
C) The VPC is waiting for switches to become available
D) The Fabricator controller needs to be restarted

**Correct Answer:** B (The VPC configuration has an error that must be fixed)

**Explanation:**

Warning and Error events indicate configuration problems that prevent successful reconciliation. This specific event shows a subnet conflict—the VPC cannot be created until you choose a non-overlapping subnet. You need to fix the configuration in Gitea and recommit. No error/warning events = successful reconciliation.

**Learning Objective:** LO #2 - Interpret kubectl output

---

### Question 3: Gitea Audit Trail

**Stem:** Your manager asks: "When was the production-vpc modified and by whom?" Which Gitea feature should you use?

A) File browser
B) Commit history
C) Branch manager
D) Pull requests

**Correct Answer:** B (Commit history)

**Explanation:**

The commit history in Gitea shows all changes with timestamps, authors, and commit messages. Each commit records who made the change and when. The file browser shows current file contents but not history. Branch manager and pull requests are for workflow management, not historical audit.

**Learning Objective:** LO #3 - Navigate Gitea

---

### Question 4: Grafana Dashboard Selection

**Stem:** You suspect a switch is dropping packets due to a bad cable or transceiver. Which Grafana dashboard is MOST useful?

A) Fabric Dashboard
B) Platform Dashboard
C) Interfaces Dashboard
D) Node Exporter Dashboard

**Correct Answer:** C (Interfaces Dashboard)

**Explanation:**

The Interfaces Dashboard shows detailed per-port metrics including error counters (CRC errors, frame errors), drop counters, and discard counters—all indicators of physical layer issues like bad cables or transceivers. The Fabric Dashboard shows high-level health but not detailed error counters. Platform Dashboard monitors control plane, not switch ports. Node Exporter shows OS metrics, not interface errors.

**Learning Objective:** LO #4 - Read Grafana dashboards

---

### Question 5: Troubleshooting Methodology

**Stem:** A VPC appears to be configured correctly in Gitea, but servers aren't receiving DHCP addresses. What should you check NEXT?

A) Recreate the VPC configuration file in Gitea
B) Use kubectl to verify the VPC was deployed and check for error events
C) Check Grafana for switch health
D) Contact support immediately

**Correct Answer:** B (Use kubectl to verify the VPC was deployed and check for error events)

**Explanation:**

Follow the systematic troubleshooting flow: Config (Gitea) → Deployment (kubectl) → Health (Grafana). If Gitea config looks correct, the next step is to verify the VPC actually deployed successfully using kubectl and check for error events. The events will tell you if reconciliation failed. Only after confirming kubectl shows successful deployment should you move to Grafana to check runtime health.

**Learning Objective:** LO #5 - Correlate information across interfaces

---

### Question 6: Interface Correlation

**Stem:** You see in Grafana Fabric Dashboard that spine-01 is showing "Down" status. What should you do FIRST?

A) Reboot spine-01 immediately
B) Check kubectl for spine-01 Agent status and events
C) Edit spine-01 configuration in Gitea
D) Check Platform Dashboard

**Correct Answer:** B (Check kubectl for spine-01 Agent status and events)

**Explanation:**

Grafana shows symptoms (switch down), but kubectl can tell you more detail about WHY: Agent not reporting, configuration errors, reconciliation issues, etc. Always gather more information before taking action. Rebooting (A) without understanding the root cause could make things worse. Editing config (C) is premature—you don't know if configuration is the issue yet. Platform Dashboard (D) shows control plane health, not specific switch status.

**Learning Objective:** LO #6 - Apply troubleshooting methodology

---

### Practical Assessment

**Task:** Using kubectl, Gitea, and Grafana, answer these questions about your fabric:

1. **kubectl:** How many VPCs exist in the cluster right now?
2. **Gitea:** Who created the `myfirst-vpc` configuration and when?
3. **Grafana:** Are all switches showing healthy status in the Fabric Dashboard?

**Success Criteria:**

- ✅ Uses correct kubectl command (`kubectl get vpcs`)
- ✅ Navigates to Gitea commit history and identifies author/timestamp
- ✅ Opens Grafana Fabric Dashboard and interprets switch status
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
kubectl describe vpc <name>           # Check events for reconciliation status
kubectl get vpc <name> -o yaml        # View full VPC configuration
```

**Fabric topology:**
```bash
kubectl get agents -A                 # List all switches (agents)
kubectl get connections -A            # List server connections
kubectl get vpcattachments -A         # List VPC-to-server attachments
```

**Event inspection:**
```bash
kubectl get events --sort-by='.lastTimestamp' | tail -20   # Recent events
kubectl get events --field-selector involvedObject.name=<name>  # Events for specific resource
kubectl describe <resource-type> <name>                     # Events in context
```

---

### Gitea Quick Reference

**Navigation:**
- **Repository URL:** `http://localhost:3001/student/hedgehog-config`
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

**Access:** `http://localhost:3000` (admin/prom-operator)

**Dashboard URLs:**

1. **Fabric Dashboard** (daily health check)
   - URL: `/d/ab831ceb-cf5c-474a-b7e9-83dcd075c218/fabric`
   - Use for: Overall fabric health, switch status, VPC count

2. **Platform Dashboard** (control plane health)
   - URL: `/d/f8a648b9-5510-49ca-9273-952ba6169b7v/platform`
   - Use for: Fabricator errors, control node CPU/memory, API latency

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
   - Use for: TCAM usage, route table capacity, capacity planning

---

### Troubleshooting Flow Reference

**Standard flow for "VPC not working" issues:**

1. **Gitea** - Verify configuration is correct in Git
2. **kubectl** - Check if VPC exists and has error events
3. **Grafana** - Confirm switches are healthy and operational

**Quick checks:**

```bash
# 1. Check VPC exists and has no errors
kubectl describe vpc <name> | grep -A 5 Events

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
