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
description: "Monitor fabric health using kubectl events and Agent CRD status, correlating with Grafana metrics for complete troubleshooting visibility."
order: 303
---

# Events & Status Monitoring

## Introduction

In Module 3.2, you learned to interpret Grafana dashboards—answering questions like "Are BGP sessions up?" and "Are there interface errors?"

Dashboards show **what** is happening (metrics over time).

But when something goes wrong, you need to know **why** it's happening.

That's where **kubectl events and Agent CRD status** come in—they provide:
- **Configuration errors:** "VLAN 1010 already in use"
- **Reconciliation status:** "VPC successfully created"
- **Dependency issues:** "Connection server-01--mclag not found"
- **Switch state details:** BGP neighbor state, interface status, platform health

### The Troubleshooting Question

A user reports: "My server can't reach the VPC."

**Grafana tells you:**
- Interface is up
- No packet errors
- VLAN is configured

**But that's not enough. You need to know:**
- Did VPCAttachment reconcile successfully? *(kubectl events)*
- Is the switch Agent ready? *(Agent CRD status)*
- Was there a configuration error? *(kubectl events)*
- What's the exact VLAN and interface? *(Agent CRD state)*

### What You'll Learn

- How to monitor Kubernetes events for fabric resources
- How to interpret Agent CRD status fields
- How to track VPC lifecycle through events
- Common error event patterns and their meanings
- How to correlate kubectl data with Grafana metrics

### The Integration

```
Grafana:    "Interface Ethernet5 has no traffic"
                        ↓
kubectl events: "VPCAttachment failed: VLAN conflict"
                        ↓
Agent CRD:  "VLAN 1010 already used by VPC other-vpc"
                        ↓
Solution:   Change VLAN in VPC spec
```

This module teaches you to use kubectl and Grafana **together** for complete observability.

**The Complete Observability Picture:**

Grafana dashboards are powerful—they show you metrics, trends, and anomalies. But they can't show you why a VPC failed to create or why a VPCAttachment didn't configure a VLAN. That requires Kubernetes events and the Agent CRD.

Think of it this way:
- **Grafana** = Your speedometer and dashboard lights (symptoms)
- **kubectl events** = Your engine diagnostic codes (what went wrong)
- **Agent CRD** = Your engine control unit data (exact state)

In production operations, you'll use all three together. This integrated troubleshooting approach is what separates novice operators from experienced ones. You'll start with a symptom in Grafana, use kubectl events to find configuration errors, check Agent CRD for exact switch state, and correlate all three to identify root cause.

**Why This Matters:**

Modern fabric operations require correlation across multiple data sources. A single data source rarely tells the complete story. Learning to seamlessly move between Grafana, kubectl events, and Agent CRD queries will make you significantly more effective at troubleshooting and will prepare you for the diagnostic collection workflow in Module 3.4.

## Learning Objectives

By the end of this module, you will be able to:

1. **Monitor kubectl events** - Track VPC lifecycle events and reconciliation status
2. **Interpret Agent CRD status** - Read switch operational state from Agent CRD status fields
3. **Track VPC lifecycle** - Follow VPC creation, attachment, and deletion through events
4. **Identify error patterns** - Recognize common failure events (VLAN conflicts, subnet overlaps, missing connections)
5. **Correlate kubectl and Grafana** - Cross-reference events with metrics for complete troubleshooting picture
6. **Apply integrated troubleshooting** - Use both kubectl events and Grafana dashboards together

## Prerequisites

- Module 3.1 completion (Fabric Telemetry Overview)
- Module 3.2 completion (Dashboard Interpretation)
- Module 1.3 completion (kubectl basics from Course 1)
- Understanding of Kubernetes events
- Familiarity with VPC and VPCAttachment resources

## Scenario: Integrated Troubleshooting with kubectl and Grafana

You provisioned a new VPC called `testapp-vpc` with a VPCAttachment for `server-03`. The server reports it's not getting DHCP. You'll use both Grafana and kubectl to diagnose the issue.

**Environment Access:**
- **Grafana:** http://localhost:3000
- **kubectl:** Already configured

### Task 1: Identify Symptom in Grafana (1 minute)

**Objective:** Use Grafana to observe the issue

**Steps:**

1. **Open Grafana Interfaces Dashboard:**
   - Navigate to http://localhost:3000
   - Dashboards → "Hedgehog Interfaces"

2. **Find server-03 interface:**
   - Look for the leaf switch interface connected to server-03
   - In vlab, you can check Connection CRDs to identify the interface:
     ```bash
     kubectl get connections -n fab | grep server-03
     ```

3. **Observe symptoms:**
   - **Expected:** Interface UP, VLAN configured, traffic flowing
   - **Actual:** What do you see?
     - Is interface up or down?
     - Is VLAN configured?
     - Is there traffic?

**Expected Finding:** Interface UP, but no traffic or VLAN not visible

**Success Criteria:**
- ✅ Located server-03's interface in Grafana
- ✅ Identified symptom (e.g., interface UP but no traffic)
- ✅ Noted which switch and interface

### Task 2: Check VPC and VPCAttachment Events (2 minutes)

**Objective:** Use kubectl to check resource reconciliation status

**Steps:**

1. **List VPCs:**

   ```bash
   kubectl get vpc testapp-vpc
   ```

   **Expected output:**
   ```
   NAME           AGE
   testapp-vpc    5m
   ```

2. **Check VPC events:**

   ```bash
   kubectl get events --field-selector involvedObject.name=testapp-vpc --sort-by='.lastTimestamp'
   ```

   **Expected output (healthy):**
   ```
   LAST SEEN   TYPE     REASON              OBJECT            MESSAGE
   5m          Normal   Created             vpc/testapp-vpc   VPC created successfully
   5m          Normal   VNIAllocated        vpc/testapp-vpc   Allocated VNI 100010
   5m          Normal   SubnetsConfigured   vpc/testapp-vpc   3 subnets configured
   5m          Normal   Ready               vpc/testapp-vpc   VPC is ready
   ```

   **Or use describe for combined view:**
   ```bash
   kubectl describe vpc testapp-vpc
   ```

   **Look for:**
   - ✅ Normal events: Created, VNIAllocated, SubnetsConfigured, Ready
   - ❌ Warning events: ValidationFailed, VLANConflict, SubnetOverlap

3. **List VPCAttachments:**

   ```bash
   kubectl get vpcattachment -A | grep server-03
   ```

   **Expected output:**
   ```
   NAMESPACE   NAME                    AGE
   default     testapp-vpc-server-03   4m
   ```

4. **Check VPCAttachment events:**

   ```bash
   kubectl get events --field-selector involvedObject.kind=VPCAttachment --sort-by='.lastTimestamp' | grep server-03
   ```

   **Or describe the attachment:**
   ```bash
   kubectl describe vpcattachment testapp-vpc-server-03
   ```

   **Expected output (healthy):**
   ```
   LAST SEEN   TYPE     REASON              OBJECT                          MESSAGE
   4m          Normal   Created             vpcattachment/...server-03      VPCAttachment created
   4m          Normal   ConnectionFound     vpcattachment/...server-03      Connection server-03--mclag found
   4m          Normal   VLANConfigured      vpcattachment/...server-03      VLAN 1010 configured on leaf-05/Ethernet7
   4m          Normal   Ready               vpcattachment/...server-03      VPCAttachment ready
   ```

   **Example problem (VLAN conflict):**
   ```
   LAST SEEN   TYPE      REASON          OBJECT                          MESSAGE
   4m          Normal    Created         vpcattachment/...server-03      VPCAttachment created
   3m          Warning   VLANConflict    vpcattachment/...server-03      VLAN 1010 already in use by vpc-1/default
   ```

   **Example problem (connection not found):**
   ```
   LAST SEEN   TYPE      REASON              OBJECT                          MESSAGE
   4m          Normal    Created             vpcattachment/...server-03      VPCAttachment created
   3m          Warning   DependencyMissing   vpcattachment/...server-03      Connection server-03--mclag not found
   ```

**Success Criteria:**
- ✅ Identified if VPC or VPCAttachment has errors
- ✅ Found specific error event message
- ✅ Determined next troubleshooting step

**Common Issues to Find:**
- VLAN conflict (VLAN already in use)
- Connection not found (wrong connection name)
- Subnet overlap (IP address conflict)

### Task 3: Check Agent CRD for Switch State (2 minutes)

**Objective:** Verify switch-level configuration using Agent CRD

**Steps:**

1. **Identify which switch has server-03:**

   ```bash
   # List connections to find server-03
   kubectl get connections -n fab | grep server-03
   ```

   **Example output:**
   ```
   server-03--unbundled--leaf-05
   ```

   **Result:** server-03 connected to leaf-05, Ethernet7 (example)

2. **Check Agent status for leaf-05:**

   ```bash
   kubectl get agent leaf-05 -n fab
   ```

   **Expected output:**
   ```
   NAME       ROLE          DESCR           APPLIED   VERSION
   leaf-05    server-leaf   VS-05           2m        v0.87.4
   ```

   **Success:** Agent is present and has recent APPLIED time

3. **Check interface state in Agent CRD:**

   ```bash
   # View interface Ethernet7 state
   kubectl get agent leaf-05 -n fab -o jsonpath='{.status.state.interfaces.Ethernet7}' | jq
   ```

   **Expected output (healthy):**

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
       "ine": 0,
       "oute": 0
     }
   }
   ```

   **Look for:**
   - Is `oper` = "up"? (Interface operational)
   - Are there VLANs listed? (VLAN configuration)
   - Are there any error counters? (Hardware issues)

4. **Check all interfaces (optional):**

   ```bash
   # View all interfaces
   kubectl get agent leaf-05 -n fab -o jsonpath='{.status.state.interfaces}' | jq
   ```

5. **Check configuration application status:**

   ```bash
   # When was config last applied?
   kubectl get agent leaf-05 -n fab -o jsonpath='{.status.lastAppliedTime}'
   ```

   **Expected output:**
   ```
   2025-10-17T10:29:55Z
   ```

   **Interpretation:**
   - Recent timestamp (within last few minutes) = good (config applying)
   - Old timestamp (hours/days old) = problem (config not applying)

**Success Criteria:**
- ✅ Verified interface operational state
- ✅ Checked if VLAN configured at switch level
- ✅ Confirmed agent applied config recently

### Task 4: Correlate kubectl and Grafana Findings (1 minute)

**Objective:** Combine kubectl and Grafana data to identify root cause

**Analysis Template:**

**Grafana Symptom:**
- Interface: leaf-05/Ethernet7
- State: UP
- VLAN: Not visible or wrong VLAN
- Traffic: 0 bps

**kubectl Events:**
- VPC Event: [Normal/Warning] [Reason] [Message]
- VPCAttachment Event: [Normal/Warning] [Reason] [Message]

**Agent CRD Status:**
- Interface oper: [up/down]
- Config applied: [timestamp]
- VLANs: [list]

**Root Cause:**
- Example: VPCAttachment failed due to VLAN conflict → VLAN never configured → No DHCP

**Solution:**
- Example: Change VPC VLAN from 1010 to 1011, commit to Gitea

**Example Correlation Scenario 1:**

**Grafana:** Interface Ethernet7 UP, 0 bps traffic
**kubectl events:** Warning: VLANConflict - VLAN 1010 already in use by vpc-1/default
**Agent CRD:** Interface operational, no VLANs configured
**Root Cause:** VPCAttachment failed due to VLAN conflict, so VLAN never applied to interface
**Solution:** Change testapp-vpc VLAN to unused VLAN (check: `kubectl get vpc -o yaml | grep vlan:`)

**Example Correlation Scenario 2:**

**Grafana:** Interface Ethernet7 UP, 0 bps traffic
**kubectl events:** Warning: DependencyMissing - Connection server-03--mclag not found
**Agent CRD:** Interface operational, no VLANs configured
**Root Cause:** VPCAttachment references wrong connection name (server-03--mclag doesn't exist)
**Solution:** Fix connection name in VPCAttachment (check: `kubectl get connections -n fab | grep server-03`)

**Success Criteria:**
- ✅ Identified root cause from event messages
- ✅ Correlated kubectl findings with Grafana symptom
- ✅ Proposed solution based on error type

### Task 5: Monitor Resolution (Optional, 1 minute)

**Objective:** Verify fix by monitoring events and Grafana

**Steps:**

1. **Watch VPC/VPCAttachment events:**

   ```bash
   kubectl get events --field-selector involvedObject.kind=VPCAttachment --watch
   ```

2. **Apply fix:**
   - If VLAN conflict: Change VLAN in VPC YAML in Gitea, commit
   - If connection not found: Fix connection name in VPCAttachment YAML in Gitea, commit
   - ArgoCD will sync changes automatically

3. **Observe events:**
   - Wait for ArgoCD sync (30-60 seconds)
   - Watch for Normal events appearing:
     ```
     TYPE     REASON              MESSAGE
     Normal   ConnectionFound     Connection server-03--unbundled--leaf-05 found
     Normal   VLANConfigured      VLAN 1011 configured on leaf-05/Ethernet7
     Normal   Ready               VPCAttachment ready
     ```

4. **Check Grafana Interfaces Dashboard:**
   - VLAN now visible on interface
   - Traffic appearing (server gets DHCP and starts communicating)

5. **Verify on server (optional):**
   ```bash
   hhfab vlab ssh server-03
   ip addr show  # Should show DHCP IP address
   ```

**Success Criteria:**
- ✅ Events show successful reconciliation
- ✅ Grafana shows VLAN configured and traffic
- ✅ Server receives DHCP address

### Lab Summary

**What You Accomplished:**

You performed integrated troubleshooting using kubectl and Grafana:
- ✅ Identified symptom in Grafana (interface no traffic)
- ✅ Checked kubectl events for configuration errors
- ✅ Reviewed Agent CRD status for switch state
- ✅ Correlated kubectl and Grafana data to find root cause
- ✅ Proposed solution based on event messages

**Key Takeaways:**

1. **Grafana shows "what"** (metrics, symptoms)
2. **kubectl events show "why"** (configuration errors, reconciliation failures)
3. **Agent CRD shows "exactly"** (precise switch state)
4. **Integrated approach** (Grafana + kubectl) enables root cause analysis
5. **Events expire after 1 hour** - check soon after operations
6. **Event patterns are recognizable** (VLAN conflict, connection not found, etc.)

**Troubleshooting Workflow:**

```
Symptom (Grafana)
      ↓
Events (kubectl get events)
      ↓
Agent CRD (kubectl get agent ... -o jsonpath)
      ↓
Controller Logs (if needed)
      ↓
Root Cause → Solution
```

## Concepts & Deep Dive

### Concept 1: Kubernetes Event Monitoring

**What Are Kubernetes Events?**

Events are timestamped records of actions taken by Kubernetes controllers. In Hedgehog, events track:
- Resource creation/updates
- Reconciliation success/failure
- Configuration validation errors
- Dependency resolution

**Event Types:**

**1. Normal Events (Informational)**
- Successful operations
- Reconciliation progress
- State transitions

**2. Warning Events (Errors/Issues)**
- Validation failures
- Dependency problems
- Reconciliation errors

**Viewing All Events:**

```bash
# All events, recent first
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# Events in specific namespace
kubectl get events -n default --sort-by='.lastTimestamp'

# Events in fab namespace (switches, agents)
kubectl get events -n fab --sort-by='.lastTimestamp'

# Watch events live
kubectl get events --all-namespaces --watch
```

**Filtering Events:**

```bash
# Only Warning events
kubectl get events --all-namespaces --field-selector type=Warning

# Events for specific resource
kubectl get events --field-selector involvedObject.name=myvpc

# Events for specific resource type
kubectl get events --field-selector involvedObject.kind=VPC

# Combine filters
kubectl get events --field-selector involvedObject.kind=VPC,type=Warning
```

**Event Fields:**

```
LAST SEEN   TYPE      REASON              OBJECT           MESSAGE
2m          Normal    Created             vpc/myvpc        VPC created successfully
1m          Normal    VNIAllocated        vpc/myvpc        Allocated VNI 100010
30s         Warning   VLANConflict        vpc/test-vpc     VLAN 1010 already in use by vpc-1
```

- **LAST SEEN:** How long ago event occurred
- **TYPE:** Normal or Warning
- **REASON:** Short event reason code (VLANConflict, DependencyMissing, etc.)
- **OBJECT:** Resource that triggered event
- **MESSAGE:** Detailed human-readable message

**Event Retention:**

Kubernetes retains events for **1 hour by default**. After 1 hour, events are deleted.

**Best Practice:** Check events soon after operations. For long-term audit, export events or use logging system.

**Why Events Matter:**

Events provide immediate feedback on what the controller is doing with your resources. When you create a VPC, events tell you:
- Was the VPC created successfully?
- Was a VNI allocated?
- Did any validation fail?
- Are there any conflicts?

Without events, you'd have to guess why a resource isn't working. With events, the controller tells you exactly what happened.

**Event Workflow Example:**

```bash
# Create a VPC
kubectl apply -f vpc.yaml

# Immediately check events
kubectl get events --field-selector involvedObject.name=myvpc --watch

# See real-time feedback:
# 0s    Normal   Created        VPC created successfully
# 2s    Normal   VNIAllocated   Allocated VNI 100010
# 5s    Normal   Ready          VPC is ready
```

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
kubectl get agents -n fab
```

**Expected output:**
```
NAME       ROLE          DESCR           APPLIED   VERSION
leaf-01    server-leaf   VS-01 MCLAG 1   2m        v0.87.4
leaf-02    server-leaf   VS-02 MCLAG 1   3m        v0.87.4
spine-01   spine         VS-06           4m        v0.87.4
```

**Get Full Agent Status:**

```bash
# Full YAML output
kubectl get agent leaf-01 -n fab -o yaml

# Human-readable description
kubectl describe agent leaf-01 -n fab
```

**Key Status Fields:**

**1. Agent Heartbeat and Version:**

```bash
# Last heartbeat timestamp
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.lastHeartbeat}'
# Output: 2025-10-17T10:30:00Z

# Agent version
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.version}'
# Output: v0.87.4
```

**Interpretation:** Recent heartbeat (within last 2-3 minutes) means agent is connected and healthy.

**2. Configuration Application Status:**

```bash
# When was config last applied?
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.lastAppliedTime}'
# Output: 2025-10-17T10:29:55Z

# What generation was applied?
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.lastAppliedGen}'
# Output: 15
```

**Interpretation:** Recent `lastAppliedTime` means controller is actively configuring switch.

**3. Interface State:**

```bash
# All interfaces
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces}' | jq

# Specific interface
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq
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
    "ine": 0,
    "oute": 0
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
- `counters.ine`: Input errors
- `counters.oute`: Output errors

**4. BGP Neighbor State:**

```bash
# All BGP neighbors
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq

# Check specific neighbor state
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.bgpNeighbors.default["172.30.128.10"].state}'
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
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.platform.psus}' | jq

# Fan status
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.platform.fans}' | jq

# Temperature
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.platform.temps}' | jq
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
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.criticalResources}' | jq
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
# Check if agent is Ready
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
# Output: True
```

**Why This Matters:**

Agent CRD status provides **source of truth for switch state** at Kubernetes level. When Grafana shows an issue, Agent CRD tells you the exact switch state—interface operational status, BGP neighbor state, VLAN configuration, and more.

**Practical Example:**

**Problem:** Server can't reach VPC
**Grafana:** Interface up, no traffic
**Agent CRD Check:**
```bash
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq
```
**Finding:** Interface operational but no VLANs configured
**Next Step:** Check VPCAttachment events for why VLAN not configured

### Concept 3: VPC Lifecycle Event Tracking

**VPC Creation Event Sequence**

When you create a VPC via GitOps (Gitea commit → ArgoCD sync), events track the lifecycle:

**Successful VPC Creation:**

```
Time    Type    Reason              Object          Message
0s      Normal  Created             vpc/myvpc       VPC created successfully
2s      Normal  VNIAllocated        vpc/myvpc       Allocated VNI 100010
5s      Normal  SubnetsConfigured   vpc/myvpc       3 subnets configured
10s     Normal  Ready               vpc/myvpc       VPC is ready
```

**How to watch this in real-time:**
```bash
# Create VPC
kubectl apply -f vpc.yaml

# Watch events
kubectl get events --field-selector involvedObject.name=myvpc --watch
```

**Failed VPC Creation (VLAN Conflict):**

```
Time    Type     Reason              Object          Message
0s      Normal   Created             vpc/badVPC      VPC created successfully
2s      Warning  ValidationFailed    vpc/badVPC      VLAN 1010 already in use by vpc-1/default
```

**What happens:** Controller creates VPC object but validation fails during reconciliation. VPC exists in Kubernetes but isn't operational.

**VPCAttachment Event Sequence**

**Successful Attachment:**

```
Time    Type    Reason              Object                      Message
0s      Normal  Created             vpcattachment/vpc1-srv01    VPCAttachment created
3s      Normal  ConnectionFound     vpcattachment/vpc1-srv01    Connection server-01--mclag found
5s      Normal  VLANConfigured      vpcattachment/vpc1-srv01    VLAN 1010 configured on leaf-01/Ethernet5
8s      Normal  Ready               vpcattachment/vpc1-srv01    VPCAttachment ready
```

**What this tells you:**
- Controller found the Connection resource
- VLAN was successfully configured on the switch interface
- VPCAttachment is fully operational

**Failed Attachment (Connection Not Found):**

```
Time    Type     Reason                  Object                      Message
0s      Normal   Created                 vpcattachment/vpc1-srv05    VPCAttachment created
2s      Warning  DependencyMissing       vpcattachment/vpc1-srv05    Connection server-05--mclag not found
```

**What this tells you:** VPCAttachment references a Connection that doesn't exist. Check Connection name and fix VPCAttachment spec.

**VPC Deletion Event Sequence**

**Successful Deletion:**

```
Time    Type    Reason              Object          Message
0s      Normal  Deleting            vpc/myvpc       VPC deletion initiated
2s      Normal  DetachingServers    vpc/myvpc       Removing VPCAttachments
5s      Normal  ReleasingVNI        vpc/myvpc       VNI 100010 released
8s      Normal  Deleted             vpc/myvpc       VPC deleted successfully
```

**Failed Deletion (Active Attachments):**

```
Time    Type     Reason                  Object          Message
0s      Normal   Deleting                vpc/myvpc       VPC deletion initiated
2s      Warning  DependencyExists        vpc/myvpc       Cannot delete: 2 VPCAttachments still active
```

**What this tells you:** You must delete all VPCAttachments before deleting the VPC.

**Tracking VPC Lifecycle:**

```bash
# Watch VPC events live
kubectl get events --field-selector involvedObject.name=myvpc --watch

# Check VPC and related resources
kubectl get events --field-selector involvedObject.kind=VPC
kubectl get events --field-selector involvedObject.kind=VPCAttachment
kubectl get events --field-selector involvedObject.kind=DHCPSubnet
```

**Best Practice:** Always watch events when creating/deleting VPCs to see immediate feedback on success or failure.

### Concept 4: Common Error Event Patterns

Understanding common error patterns helps you quickly diagnose issues without guessing.

**Error Pattern 1: VLAN Conflict**

**Event:**
```
Type: Warning
Reason: VLANConflict
Message: VLAN 1010 already in use by vpc-1/default
```

**Cause:** VPC subnet specifies VLAN already used by another VPC in same VLANNamespace

**Solution:**
1. Check existing VLANs: `kubectl get vpc -o yaml | grep vlan:`
2. Choose unused VLAN (e.g., 1011)
3. Update VPC YAML in Gitea
4. Commit change

**Grafana Correlation:** Interface shows no VLAN configured (VPC reconciliation failed)

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
# Commit → ArgoCD syncs → VPC reconciles successfully
```

---

**Error Pattern 2: Subnet Overlap**

**Event:**
```
Type: Warning
Reason: SubnetOverlap
Message: Subnet 10.0.10.0/24 overlaps with existing VPC vpc-2/backend
```

**Cause:** VPC subnet overlaps with another VPC in same IPv4Namespace

**Solution:**
1. Check existing subnets: `kubectl get vpc -o yaml | grep subnet:`
2. Choose non-overlapping subnet (e.g., 10.0.20.0/24)
3. Update VPC YAML in Gitea

**Grafana Correlation:** No DHCP leases visible (VPC reconciliation failed)

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

**Error Pattern 3: Connection Not Found**

**Event:**
```
Type: Warning
Reason: DependencyMissing
Message: Connection server-05--mclag--leaf-01--leaf-02 not found
```

**Cause:** VPCAttachment references a Connection that doesn't exist

**Solution:**
1. List available connections: `kubectl get connections -n fab`
2. Find correct connection name for server-05
3. Update VPCAttachment YAML with correct connection name

**Grafana Correlation:** Interface shows as down or no VLAN (attachment failed)

**Connection naming patterns:**
- MCLAG: `server-01--mclag--leaf-01--leaf-02`
- ESLAG: `server-05--eslag--leaf-03--leaf-04`
- Bundled: `server-10--bundled--leaf-05`
- Unbundled: `server-09--unbundled--leaf-05`

**Example workflow:**
```bash
# Find connections for server-05
kubectl get connections -n fab | grep server-05

# Output:
# server-05--unbundled--leaf-05

# Fix VPCAttachment spec:
# connection: server-05--unbundled--leaf-05  # (not mclag)
```

---

**Error Pattern 4: Invalid CIDR**

**Event:**
```
Type: Warning
Reason: ValidationFailed
Message: Invalid subnet CIDR: 10.0.10.0/33
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

**Error Pattern 5: Agent Not Ready**

**Event:**
```
Type: Warning
Reason: AgentNotReady
Message: Switch leaf-03 agent not ready, configuration pending
```

**Cause:** Switch agent disconnected or switch offline

**Solution:**
1. Check agent status: `kubectl get agents -n fab`
2. Verify switch reachable: `ping leaf-03.fabric.local`
3. Check agent logs: `kubectl logs -n fab agent-leaf-03`
4. If switch down, investigate switch console/power

**Grafana Correlation:** Fabric Dashboard shows switch missing metrics

**Agent troubleshooting:**
```bash
# Check agent pod
kubectl get pods -n fab | grep agent-leaf-03

# If pod is missing, switch hasn't registered
# Check switch serial console:
hhfab vlab serial leaf-03

# Check fabric-boot logs:
kubectl logs -n fab deployment/fabric-boot
```

### Concept 5: Event-Metric Correlation

**Using kubectl Events and Grafana Dashboards Together**

The most powerful troubleshooting approach combines multiple data sources. Here are realistic scenarios showing how to correlate events with metrics.

**Scenario 1: Interface No Traffic**

**Grafana shows:**
- Interfaces Dashboard: leaf-01/Ethernet5 has 0 bps traffic
- Interface state: UP

**kubectl investigation:**

```bash
# Check if VPCAttachment exists for this interface
kubectl get vpcattachment -A

# Check events for VPCAttachment
kubectl get events --field-selector involvedObject.kind=VPCAttachment

# Found event:
# Warning  VLANConflict  VPCAttachment/vpc1-srv01  VLAN 1010 conflict
```

**Agent CRD investigation:**

```bash
# Check interface state
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# Output shows:
# "oper": "up"  (interface operational)
# No VLANs configured (missing in output)
```

**Root Cause:** VPCAttachment failed due to VLAN conflict, so VLAN never configured on interface

**Correlation:**
- Grafana symptom: Interface UP, no traffic
- kubectl events: VLAN conflict error
- Agent CRD: No VLAN configured
- Root cause: VLAN conflict prevented configuration

**Solution:** Fix VLAN conflict in VPC YAML

---

**Scenario 2: BGP Session Down**

**Grafana shows:**
- Fabric Dashboard: BGP session leaf-01 ↔ spine-01 down

**kubectl investigation:**

```bash
# Check Agent CRD for BGP state
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.bgpNeighbors.default["172.30.128.1"]}' | jq
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

**Check switch events:**
```bash
kubectl get events -n fab --field-selector involvedObject.name=leaf-01

# Found event:
# Warning  ConfigApplyFailed  switch/leaf-01  BGP peer 172.30.128.1 not reachable
```

**Root Cause:** Spine-01 not reachable from leaf-01 (network issue)

**Correlation:**
- Grafana symptom: BGP session down
- Agent CRD: BGP neighbor state = "idle"
- kubectl events: BGP peer not reachable
- Root cause: Network connectivity issue between leaf and spine

**Solution:** Investigate spine-01 connectivity (check spine-01 agent, physical links)

---

**Scenario 3: Server Can't Get DHCP**

**Grafana shows:**
- Interfaces Dashboard: leaf-02/Ethernet10 UP, traffic minimal
- Logs Dashboard: No DHCP errors

**kubectl investigation:**

```bash
# Check DHCPSubnet resources
kubectl get dhcpsubnet -A

# Expected: myvpc--default
# Found: Missing!

# Check VPC events
kubectl get events --field-selector involvedObject.name=myvpc

# Found event:
# Warning  SubnetOverlap  vpc/myvpc  Subnet 10.0.10.0/24 overlaps with vpc-2
```

**Root Cause:** VPC reconciliation failed due to subnet overlap, so DHCPSubnet never created

**Correlation:**
- Grafana symptom: Server not getting DHCP (no traffic)
- kubectl events: Subnet overlap error
- kubectl resources: DHCPSubnet missing
- Root cause: Subnet overlap prevented VPC creation

**Solution:** Fix subnet overlap in VPC YAML

---

**Integration Workflow:**

```
1. Grafana: Identify symptom (no traffic, session down, etc.)
           ↓
2. kubectl events: Check for configuration errors
           ↓
3. Agent CRD status: Verify switch state
           ↓
4. Controller logs: Detailed reconciliation info (if needed)
           ↓
5. Solution: Fix configuration, verify in Grafana
```

**Best Practice:** Start with Grafana for symptoms, use kubectl events for diagnosis, check Agent CRD for confirmation, return to Grafana for verification after fix.

## Troubleshooting

### Issue: Events are Missing / Expired

**Symptom:** `kubectl get events` returns no results or only recent events

**Cause:** Kubernetes events expire after 1 hour

**Solution:**

1. **Check event age:**
   ```bash
   kubectl get events --all-namespaces --sort-by='.lastTimestamp' | head -20
   ```

2. **If events expired:**
   - Reproduce issue to generate new events
   - Check controller logs for historical data:
     ```bash
     kubectl logs -n fab deployment/fabric-controller-manager
     ```

3. **For long-term audit:**
   - Configure event export to external logging system
   - Use Loki/Elasticsearch for long-term event storage
   - Take screenshots/copies of events during incidents

**Prevention:** Check events soon after operations, don't wait hours to troubleshoot.

---

### Issue: Agent CRD Has No Status Data

**Symptom:** `kubectl get agent leaf-01 -n fab -o yaml` shows `status: {}` or minimal data

**Possible Causes:**
1. Agent not connected to switch
2. Switch not fully registered
3. Agent pod not running

**Solution:**

1. **Check agent pod:**
   ```bash
   kubectl get pods -n fab | grep agent-leaf-01
   ```

   **Expected:** Pod Running

2. **Check agent logs:**
   ```bash
   kubectl logs -n fab agent-leaf-01
   ```

   **Look for:** Connection errors, gNMI errors

3. **Verify switch registration:**
   ```bash
   kubectl get switch leaf-01 -n fab
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

### Issue: kubectl get events Returns No Results

**Symptom:** Command succeeds but shows no events

**Possible Causes:**
1. Events expired (> 1 hour old)
2. Wrong namespace
3. Resource name mismatch

**Solution:**

1. **Check all namespaces:**
   ```bash
   kubectl get events --all-namespaces --sort-by='.lastTimestamp'
   ```

2. **Check specific namespace:**
   ```bash
   kubectl get events -n fab
   kubectl get events -n default
   ```

3. **Verify resource name:**
   ```bash
   # List resources first
   kubectl get vpc
   kubectl get vpcattachment

   # Then query events with correct name
   kubectl get events --field-selector involvedObject.name=<exact-name>
   ```

4. **Use describe for events:**
   ```bash
   kubectl describe vpc myvpc
   # Events appear at bottom of output
   ```

---

### Issue: Agent CRD jsonpath Queries Return Empty

**Symptom:** `kubectl get agent ... -o jsonpath='{.status.state.interfaces.Ethernet5}'` returns nothing

**Possible Causes:**
1. Interface name incorrect
2. Agent status not populated
3. jsonpath syntax error

**Solution:**

1. **Verify interface exists:**
   ```bash
   # List all interfaces
   kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces}' | jq 'keys'
   ```

   **Output:** Array of interface names (e.g., `["Ethernet0", "Ethernet1", ...]`)

2. **Check status exists:**
   ```bash
   kubectl get agent leaf-01 -n fab -o yaml | grep -A 10 "state:"
   ```

3. **Use correct interface name:**
   - SONiC interfaces: `Ethernet0`, `Ethernet1`, etc. (not `Ethernet5` if switch only has 0-3)
   - Check Connection CRDs for actual port names

4. **Test jsonpath syntax:**
   ```bash
   # Simple test
   kubectl get agent leaf-01 -n fab -o jsonpath='{.status.lastHeartbeat}'
   ```

---

### Issue: How to Export Events for Long-Term Audit

**Symptom:** Need to retain events beyond 1-hour Kubernetes retention

**Solution:**

**Option 1: Export to file**
```bash
# Export all events
kubectl get events --all-namespaces -o yaml > events-$(date +%Y%m%d-%H%M%S).yaml

# Export specific resource events
kubectl get events --field-selector involvedObject.name=myvpc -o yaml > vpc-events.yaml
```

**Option 2: Continuous export to logging system**
```bash
# Watch events and pipe to logger
kubectl get events --all-namespaces --watch -o json | \
  while read line; do
    echo "$line" | jq -r '[.lastTimestamp, .type, .reason, .involvedObject.name, .message] | @tsv'
  done | logger -t k8s-events
```

**Option 3: Use event exporter**
- Deploy Kubernetes event exporter to push events to Elasticsearch/Loki
- Example: [opsgenie/kubernetes-event-exporter](https://github.com/opsgenie/kubernetes-event-exporter)

**Option 4: Grafana Loki integration**
- Configure Alloy to collect Kubernetes events
- Query historical events in Grafana Logs Dashboard

**Best Practice:** For production, configure event export to external logging. For labs/dev, export to file when troubleshooting.

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

**Event Monitoring:**

```bash
# All events, recent first
kubectl get events --all-namespaces --sort-by='.lastTimestamp'

# Warning events only
kubectl get events --all-namespaces --field-selector type=Warning

# Events for specific resource
kubectl get events --field-selector involvedObject.name=myvpc

# Events for resource type
kubectl get events --field-selector involvedObject.kind=VPC

# Watch events live
kubectl get events --all-namespaces --watch

# Events in last hour (all events are < 1 hour due to retention)
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | head -20
```

**Agent CRD Queries:**

```bash
# List all agents
kubectl get agents -n fab

# Get agent full status
kubectl get agent leaf-01 -n fab -o yaml

# Check agent heartbeat
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.lastHeartbeat}'

# Check agent version
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.version}'

# View all interfaces
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces}' | jq

# View specific interface
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# View BGP neighbors
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq

# View specific BGP neighbor state
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.bgpNeighbors.default["172.30.128.10"].state}'

# View platform health
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.platform}' | jq

# View ASIC resources
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.criticalResources}' | jq

# Check agent conditions (Ready)
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
```

**VPC/VPCAttachment Queries:**

```bash
# List VPCs with events
kubectl describe vpc myvpc

# Get VPCAttachment events
kubectl describe vpcattachment vpc1-srv01

# List DHCPSubnets
kubectl get dhcpsubnet -A

# Check Connection exists
kubectl get connection -n fab | grep server-01
```

---

**Module Complete!** You've learned to use kubectl events and Agent CRD status for integrated troubleshooting with Grafana. Ready for diagnostic collection in Module 3.4.
