---
title: "VPC Attachments: Connecting Servers"
slug: "fabric-operations-vpc-attachments"
difficulty: "beginner"
estimated_minutes: 25
version: "v1.0.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - vpc
  - attachments
  - provisioning
  - operations
description: "Learn to connect servers to VPCs using VPCAttachments. Master MCLAG, ESLAG, Bundled, and Unbundled connection types with hands-on provisioning."
order: 202
---

# VPC Attachments: Connecting Servers

## Introduction

In Module 2.1, you created the `webapp-prod` VPC with two subnets: `web-servers` (static IPs) and `worker-nodes` (DHCP). Your VPC is fully configured and ready—but there's one problem: **no servers can reach it yet**.

A VPC without servers is like a road without cars—perfectly built but completely unused. To make your VPC operational, you need to **attach servers** to it. This is where **VPCAttachment** comes in.

VPCAttachment bridges the virtual and physical layers of your infrastructure. It binds a VPC subnet (virtual network) to a server connection (physical wiring), automatically configuring the switches to enable connectivity. Once attached, your servers can communicate within the VPC, and your three-tier application network comes to life.

In this module, you'll attach two servers to the `webapp-prod` VPC you created in Module 2.1, learning about different connection types and validating the complete connectivity workflow.

## Learning Objectives

By the end of this module, you will be able to:

1. **Create VPCAttachments** - Connect servers to VPC subnets using YAML manifests
2. **Distinguish connection types** - Explain MCLAG, ESLAG, Bundled, and Unbundled connections
3. **Validate server connectivity** - Confirm VPCAttachment status and server network access
4. **Troubleshoot attachment issues** - Diagnose common VPCAttachment problems
5. **Understand the three-tier hierarchy** - Recognize Wiring → VPC → VPCAttachment relationship

## Prerequisites

- Module 2.1 completion (VPC Provisioning Essentials)
- Existing VPC (`webapp-prod` from Module 2.1)
- Understanding of server-to-switch connections (from Module 1.1)
- kubectl access to Hedgehog fabric
- Basic familiarity with YAML syntax

## Scenario: Completing the Connectivity Workflow

The `webapp-prod` VPC is ready, but no servers can reach it yet. Your task: attach two servers to the VPC—`server-01` (MCLAG connection) to the `web-servers` subnet for static IPs, and `server-05` (ESLAG connection) to the `worker-nodes` subnet for DHCP. This will complete the connectivity workflow and make the VPC operational, allowing your web application to serve traffic and your worker nodes to scale dynamically.

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Lab Steps

### Step 1: Review Existing Infrastructure

**Objective:** Verify VPC exists and identify available server connections

Before attaching servers, confirm your infrastructure is ready. You'll verify the VPC from Module 2.1 exists and discover available servers and their connection types.

List switches in the fabric:

```bash
kubectl get switches
```

Expected output (similar to):
```
NAME       PROFILE   ROLE          DESCR           GROUPS        AGE
leaf-01    vs        server-leaf   VS-01 MCLAG 1   ["mclag-1"]   2h
leaf-02    vs        server-leaf   VS-02 MCLAG 1   ["mclag-1"]   2h
leaf-03    vs        server-leaf   VS-03 ESLAG 1   ["eslag-1"]   2h
leaf-04    vs        server-leaf   VS-04 ESLAG 1   ["eslag-1"]   2h
leaf-05    vs        server-leaf   VS-05                         2h
spine-01   vs        spine         VS-06                         2h
spine-02   vs        spine         VS-07                         2h
```

List servers in the fabric:

```bash
kubectl get servers
```

Expected output (similar to):
```
NAME        TYPE   DESCR                        AGE
server-01          S-01 MCLAG leaf-01 leaf-02   2h
server-02          S-02 MCLAG leaf-01 leaf-02   2h
server-03          S-03 Unbundled leaf-01       2h
server-04          S-04 Bundled leaf-02         2h
server-05          S-05 ESLAG leaf-03 leaf-04   2h
server-06          S-06 ESLAG leaf-03 leaf-04   2h
server-07          S-07 Unbundled leaf-03       2h
server-08          S-08 Bundled leaf-04         2h
server-09          S-09 Unbundled leaf-05       2h
server-10          S-10 Bundled leaf-05         2h
```

List server connections:

```bash
kubectl get connections | grep server-
```

Expected output (similar to):
```
server-01--mclag--leaf-01--leaf-02   mclag          2h
server-02--mclag--leaf-01--leaf-02   mclag          2h
server-03--unbundled--leaf-01        unbundled      2h
server-04--bundled--leaf-02          bundled        2h
server-05--eslag--leaf-03--leaf-04   eslag          2h
server-06--eslag--leaf-03--leaf-04   eslag          2h
server-07--unbundled--leaf-03        unbundled      2h
server-08--bundled--leaf-04          bundled        2h
server-09--unbundled--leaf-05        unbundled      2h
server-10--bundled--leaf-05          bundled        2h
```

Verify the VPC from Module 2.1 exists:

```bash
kubectl get vpc webapp-prod
```

Expected output:
```
NAME          IPV4NS    VLANNS    AGE
webapp-prod   default   default   15m
```

View VPC details to confirm subnets:

```bash
kubectl get vpc webapp-prod -o yaml | grep -A 20 "subnets:"
```

You should see the two subnets you created: `web-servers` (10.10.10.0/24) and `worker-nodes` (10.10.20.0/24 with DHCP).

**Identify target servers for attachment:**

For this lab, you'll attach:
- **server-01**: MCLAG connection to leaf-01 and leaf-02 → will attach to `web-servers` subnet (static IP)
- **server-05**: ESLAG connection to leaf-03 and leaf-04 → will attach to `worker-nodes` subnet (DHCP)

**Success Criteria:**

- ✅ Can list switches, servers, and connections
- ✅ VPC `webapp-prod` exists with two subnets
- ✅ Identified server-01 (MCLAG) and server-05 (ESLAG) connection types

### Step 2: Create VPCAttachment for server-01 (MCLAG, Static IP)

**Objective:** Bind server-01 to the web-servers subnet

Create the VPCAttachment manifest for server-01:

```bash
cat > server-01-attachment.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-01-web-servers
  namespace: default
spec:
  connection: server-01--mclag--leaf-01--leaf-02
  subnet: webapp-prod/web-servers
EOF
```

**Understanding the YAML:**

- **apiVersion/kind**: Defines this as a VPCAttachment resource
- **metadata.name**: Descriptive name for this attachment (`server-01-web-servers`)
- **spec.connection**: References the Connection CRD name (must match exactly)
- **spec.subnet**: VPC/subnet format (`vpc-name/subnet-name`)

**Key points about this attachment:**

- **Connection type**: MCLAG (dual-homed to leaf-01 and leaf-02 for redundancy)
- **Subnet**: `web-servers` (IPv4 subnet without DHCP, for static IP assignment)
- **Result**: VLAN 1010 will be configured on server-01's ports on both switches

Apply the VPCAttachment:

```bash
kubectl apply -f server-01-attachment.yaml
```

Expected output:
```
vpcattachment.vpc.githedgehog.com/server-01-web-servers created
```

Validate the attachment was created:

```bash
# List all VPCAttachments
kubectl get vpcattachments

# Get detailed information
kubectl describe vpcattachment server-01-web-servers
```

Verify reconciliation by checking agent generation status (APPLIEDG should equal CURRENTG):

```bash
kubectl get agents
```

Expected output once reconciliation is complete (leaf-01 and leaf-02 handle this MCLAG connection):
```
NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION   REBOOTREQ
leaf-01    server-leaf   VS-01 MCLAG 1   30s       <N>        <N>        v0.96.2
leaf-02    server-leaf   VS-02 MCLAG 1   30s       <N>        <N>        v0.96.2
...
```

If APPLIEDG is lower than CURRENTG, wait 15–30 seconds and re-run. Convergence typically takes 15–60 seconds.

Note: VPCAttachment events do not appear in `kubectl get events` — use agent generation counters to track reconciliation.

**Success Criteria:**

- ✅ VPCAttachment created successfully
- ✅ Agent APPLIEDG == CURRENTG on leaf-01 and leaf-02
- ✅ No errors shown in `kubectl describe vpcattachment server-01-web-servers`

### Step 3: Create VPCAttachment for server-05 (ESLAG, DHCP)

**Objective:** Bind server-05 to the worker-nodes subnet with DHCP

Create the VPCAttachment manifest for server-05:

```bash
cat > server-05-attachment.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-05-worker-nodes
  namespace: default
spec:
  connection: server-05--eslag--leaf-03--leaf-04
  subnet: webapp-prod/worker-nodes
EOF
```

**Key points about this attachment:**

- **Connection type**: ESLAG (EVPN-based multi-homing to leaf-03 and leaf-04)
- **Subnet**: `worker-nodes` (DHCPv4 subnet for dynamic IP assignment)
- **DHCP range**: 10.10.20.10-250 (configured in the VPC subnet)
- **Result**: VLAN 1020 will be configured on server-05's ports, DHCP server will offer IPs

Apply the VPCAttachment:

```bash
kubectl apply -f server-05-attachment.yaml
```

Expected output:
```
vpcattachment.vpc.githedgehog.com/server-05-worker-nodes created
```

Validate the attachment:

```bash
# List VPCAttachments (should see both now)
kubectl get vpcattachments

# Get detailed information
kubectl describe vpcattachment server-05-worker-nodes
```

**Success Criteria:**

- ✅ VPCAttachment created successfully
- ✅ Server-05 will receive DHCP IP from range when booted (10.10.20.10-250)
- ✅ No error events

### Step 4: Validate VPCAttachments

**Objective:** Confirm both attachments are operational

List all VPCAttachments to see the complete picture:

```bash
kubectl get vpcattachments
```

Expected output (similar to):
```
NAME                       AGE
server-01-web-servers      2m
server-05-worker-nodes     1m
```

Describe each attachment to see detailed status:

```bash
# Check server-01 attachment
kubectl describe vpcattachment server-01-web-servers

# Check server-05 attachment
kubectl describe vpcattachment server-05-worker-nodes
```

Verify reconciliation by checking agent generation status:

```bash
# All agents should show APPLIEDG == CURRENTG once reconciliation is complete
kubectl get agents
```

Note: VPCAttachment events do not appear in `kubectl get events` — agent generation counters are the correct way to verify reconciliation.

Verify connection types match expectations:

```bash
# Verify server-01 uses MCLAG
kubectl get connection server-01--mclag--leaf-01--leaf-02 -o yaml | grep -A 5 "mclag:"

# Verify server-05 uses ESLAG
kubectl get connection server-05--eslag--leaf-03--leaf-04 -o yaml | grep -A 5 "eslag:"
```

**Success Criteria:**

- ✅ Both attachments appear in list
- ✅ Agent APPLIEDG == CURRENTG (reconciliation complete)
- ✅ No errors shown in kubectl describe for either attachment
- ✅ Connection types confirmed (MCLAG vs ESLAG)

### Step 5: Understand Connection Type Impact

**Objective:** Learn what happens on the switches for different connection types

**Server-01 (MCLAG) Configuration:**

MCLAG (Multi-Chassis Link Aggregation) provides active-active redundancy:

- **Switches involved**: leaf-01 and leaf-02
- **Redundancy**: If leaf-01 fails, server-01 stays connected via leaf-02
- **Technology**: Proprietary MCLAG protocol coordinates both switches
- **Port configuration**: VLAN 1010 applied to both switch ports
- **Active-Active**: Both links carry traffic simultaneously

View the MCLAG connection details:

```bash
kubectl get connection server-01--mclag--leaf-01--leaf-02 -o yaml
```

**Server-05 (ESLAG) Configuration:**

ESLAG (EVPN ESI LAG) provides standards-based multi-homing:

- **Switches involved**: leaf-03 and leaf-04
- **Redundancy**: If leaf-03 fails, server-05 stays connected via leaf-04
- **Technology**: EVPN RFC 7432 (standards-based, not proprietary)
- **Port configuration**: VLAN 1020 applied to both switch ports
- **Active-Active**: Both links carry traffic
- **ESI**: Ethernet Segment Identifier coordinates EVPN multi-homing

View the ESLAG connection details:

```bash
kubectl get connection server-05--eslag--leaf-03--leaf-04 -o yaml
```

**What happens during VPCAttachment reconciliation:**

1. **Fabric Controller detects VPCAttachment** - Watches for new/changed VPCAttachment CRDs
2. **Validates references** - Ensures Connection exists and VPC/subnet exists
3. **Identifies switches** - Determines which switches serve this connection
4. **Computes configuration** - Calculates VLAN on server-facing ports, VXLAN tunnel config, BGP EVPN routes
5. **Updates Agent CRDs** - Writes switch configurations to Agent CRD specs
6. **Switch agents apply config** - Each switch agent configures its local switch
7. **Status reported** - Success or errors shown in events

**From an operator perspective:**

- VPCAttachment workflow is the same regardless of connection type
- MCLAG vs ESLAG vs Bundled vs Unbundled differences are handled by the fabric
- You simply reference the connection name—the fabric does the rest

**Success Criteria:**

- ✅ Understand MCLAG provides dual-switch redundancy
- ✅ Understand ESLAG provides standards-based multi-homing
- ✅ Can explain what VPCAttachment does on switches
- ✅ Ready to attach more servers independently

## Concepts & Deep Dive

### The Three-Tier Hierarchy

Hedgehog infrastructure has three layers that work together:

**Layer 1: Wiring (Physical Infrastructure)**

This layer defines physical devices and their connections:

- **Switch** - Physical switch in the fabric (e.g., leaf-01, spine-01)
- **Server** - Physical server (e.g., server-01)
- **Connection** - Server-to-switch wiring (e.g., server-01--mclag--leaf-01--leaf-02)

**Layer 2: VPC (Virtual Networks)**

This layer defines virtual networks:

- **VPC** - Virtual Private Cloud with one or more subnets
- **Subnet** - IP address range within a VPC (e.g., web-servers: 10.10.10.0/24)

**Layer 3: VPCAttachment (Binding Virtual to Physical)**

This layer bridges the two:

- **VPCAttachment** - Binds a Connection (physical) to a VPC subnet (virtual)

**The hierarchy visualized:**

```
Wiring Layer (Physical)
├─ Switch CRD ──────────► leaf-01
├─ Server CRD ──────────► server-01
└─ Connection CRD ──────► server-01--mclag--leaf-01--leaf-02
                              ▼
                    VPCAttachment CRD
                              ▼
VPC Layer (Virtual)
└─ VPC CRD ─────────────► webapp-prod
   └─ Subnet ───────────► web-servers (10.10.10.0/24)
```

**Why this matters:**

- Wiring layer is managed by platform team (typically set once)
- VPC layer is managed by network operators (create/modify VPCs)
- VPCAttachment layer is managed by operators to connect servers to VPCs
- This separation enables self-service networking without touching physical wiring

### VPCAttachment CRD Deep Dive

**Required Fields:**

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: <attachment-name>              # Descriptive name
  namespace: default                   # Usually default
spec:
  connection: <connection-crd-name>    # Full connection name
  subnet: <vpc-name>/<subnet-name>     # VPC/subnet format
```

**Field Explanations:**

- **metadata.name**: Choose a descriptive name like `webapp-frontend-server-01`
- **metadata.namespace**: Usually `default` (matches VPC namespace)
- **spec.connection**: MUST be the exact Connection CRD name (e.g., `server-01--mclag--leaf-01--leaf-02`)
- **spec.subnet**: Format is `<vpc-name>/<subnet-name>` (e.g., `webapp-prod/web-servers`)

**Status Fields:**

VPCAttachment status is minimal — the Events section in `kubectl describe` is typically empty. Track reconciliation progress using agent generation counters:

```bash
# APPLIEDG should match CURRENTG after reconciliation (typically 15–60 seconds)
kubectl get agents
```

If APPLIEDG lags behind CURRENTG, reconciliation is still in progress. Once they match, the configuration has been applied to the switches. For a specific attachment, check which switches serve its connection (e.g., leaf-01 and leaf-02 for MCLAG, leaf-03 and leaf-04 for ESLAG) and verify those agents have converged.

### Connection Types and VPCAttachments

When you create a VPCAttachment, the connection type determines how the fabric configures redundancy and bandwidth. As an operator, you reference the connection name—the fabric handles the complexity.

#### MCLAG (Multi-Chassis Link Aggregation)

**What it is:**

MCLAG dual-homes a server to two switches using traditional MCLAG protocol.

**Characteristics:**

- **Redundancy**: Active-active to two switches (e.g., leaf-01 + leaf-02)
- **Bandwidth**: Aggregated bandwidth across two links
- **Failure handling**: If one switch fails, server stays connected
- **Technology**: Proprietary MCLAG protocol

**Connection CRD Example:**

```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: server-01--mclag--leaf-01--leaf-02
  namespace: default
spec:
  mclag:
    links:
      - server:
          port: server-01/enp2s1
        switch:
          port: leaf-01/E1/5
      - server:
          port: server-01/enp2s2
        switch:
          port: leaf-02/E1/5
```

**When to use:**

- High-availability servers requiring dual-homed redundancy
- Web servers, API servers, databases
- Any server where uptime is critical

**VPCAttachment for MCLAG:**

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-01-web-servers
spec:
  connection: server-01--mclag--leaf-01--leaf-02
  subnet: webapp-prod/web-servers
```

From your perspective as an operator, the VPCAttachment is simple. The fabric automatically configures both switches.

#### ESLAG (Ethernet Segment LAG / EVPN Multi-homing)

**What it is:**

ESLAG dual-homes a server to two switches using standards-based EVPN.

**Characteristics:**

- **Redundancy**: Active-active to two switches (e.g., leaf-03 + leaf-04)
- **Standards-based**: EVPN RFC 7432 (not proprietary)
- **Bandwidth**: Aggregated bandwidth across two links
- **Scalability**: Can extend to more than 2 switches (future capability)
- **ESI**: Uses Ethernet Segment Identifier for EVPN coordination

**Connection CRD Example:**

```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: server-05--eslag--leaf-03--leaf-04
  namespace: default
spec:
  eslag:
    links:
      - server:
          port: server-05/enp2s1
        switch:
          port: leaf-03/E1/1
      - server:
          port: server-05/enp2s2
        switch:
          port: leaf-04/E1/1
```

**When to use:**

- Modern multi-homing with standards-based EVPN
- Servers requiring redundancy with vendor interoperability
- Scalable multi-homing scenarios

**VPCAttachment for ESLAG:**

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-05-worker-nodes
spec:
  connection: server-05--eslag--leaf-03--leaf-04
  subnet: webapp-prod/worker-nodes
```

Like MCLAG, the VPCAttachment syntax is identical—the fabric handles the EVPN complexity.

#### Bundled (Port Channel / LAG)

**What it is:**

Bundled connections aggregate multiple links to a **single switch** using LACP.

**Characteristics:**

- **No switch redundancy**: All links go to one switch
- **Bandwidth aggregation**: 2x or more link bandwidth
- **Active-active**: Load balancing across links
- **Simpler**: No multi-switch coordination

**Connection CRD Example:**

```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: server-10--bundled--leaf-05
  namespace: default
spec:
  bundled:
    links:
      - server:
          port: server-10/enp2s1
        switch:
          port: leaf-05/E1/2
      - server:
          port: server-10/enp2s2
        switch:
          port: leaf-05/E1/3
```

**When to use:**

- Bandwidth aggregation without switch redundancy requirement
- Cost-sensitive deployments
- Servers where switch-level HA is not required

**VPCAttachment for Bundled:**

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-10-workers
spec:
  connection: server-10--bundled--leaf-05
  subnet: webapp-prod/worker-nodes
```

#### Unbundled (Single Link)

**What it is:**

Unbundled connections use a single server port to a single switch port.

**Characteristics:**

- **Simplest**: One link, one switch
- **No redundancy**: Switch or link failure disconnects server
- **No aggregation**: Single link bandwidth
- **Lowest complexity**: Easiest to configure

**Connection CRD Example:**

```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: server-09--unbundled--leaf-05
  namespace: default
spec:
  unbundled:
    link:
      server:
        port: server-09/enp2s1
      switch:
        port: leaf-05/E1/1
```

**When to use:**

- Development environments
- Non-critical workloads
- Cost-sensitive deployments
- Testing and prototyping

**VPCAttachment for Unbundled:**

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-09-database
spec:
  connection: server-09--unbundled--leaf-05
  subnet: webapp-prod/database
```

#### Connection Type Decision Tree

```
Do you need switch redundancy?
├─ YES → Do you have MCLAG or ESLAG pair available?
│        ├─ MCLAG pair (leaf-01/02) → Use MCLAG
│        └─ ESLAG pair (leaf-03/04) → Use ESLAG
│
└─ NO  → Do you need bandwidth aggregation?
         ├─ YES → Use Bundled (port channel)
         └─ NO  → Use Unbundled (single link)
```

### What Happens During VPCAttachment Reconciliation

**Step-by-step process:**

1. **Fabric Controller detects VPCAttachment**
   - Controller watches for new/changed VPCAttachment CRDs
   - Detects your `kubectl apply` or GitOps sync

2. **Validates references**
   - Does the Connection exist? (`server-01--mclag--leaf-01--leaf-02`)
   - Does the VPC and subnet exist? (`webapp-prod/web-servers`)

3. **Identifies switches**
   - Which switches serve this connection?
   - For MCLAG: leaf-01 and leaf-02
   - For ESLAG: leaf-03 and leaf-04

4. **Computes configuration**
   - VLAN on server-facing ports (e.g., VLAN 1010)
   - VXLAN tunnel configuration
   - BGP EVPN routes for VPC connectivity
   - DHCP relay configuration (if DHCPv4 subnet)

5. **Updates Agent CRDs**
   - Controller writes switch configurations to Agent CRD specs
   - Each switch has its own Agent CRD

6. **Switch agents apply config**
   - Switch agents watch their Agent CRD
   - Detect spec changes
   - Apply configuration to physical switch via gNMI
   - Configure ports, VLANs, VXLAN, BGP

7. **Status reported**
   - Agent CRD APPLIEDG increments to match CURRENTG once config is applied to switches
   - Note: VPCAttachment events are typically empty — use `kubectl get agents` to track status

**Timeline:**

- VPCAttachment creation: < 1 second (Kubernetes write)
- Reconciliation: 5-15 seconds (depends on fabric size)
- Configuration application: 10-30 seconds (switch agents apply config)
- Full convergence: 30-60 seconds (BGP EVPN convergence)

### Static IP Assignment on VPCAttachments

For IPv4 subnets (without DHCP), you can optionally specify a static IP in the VPCAttachment:

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-01-web-servers
spec:
  connection: server-01--mclag--leaf-01--leaf-02
  subnet: webapp-prod/web-servers
  staticAddress: 10.10.10.10  # Optional static IP assignment
```

**When to use:**

- Servers requiring fixed IPs (databases, load balancer backends)
- IP address management tracked in Hedgehog
- DNS A records pointing to specific IPs

**If omitted:**

Server uses its own network configuration (manual IP assignment in server OS).

**Note:**

For DHCPv4 subnets, omit `staticAddress`—the DHCP server will assign IPs dynamically.

### Multiple Attachments Per Server

A server can attach to multiple VPCs or multiple subnets within the same VPC:

**Example: Server in two subnets**

```yaml
# Attachment 1: server-01 to web-servers subnet
---
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-01-web-servers
spec:
  connection: server-01--mclag--leaf-01--leaf-02
  subnet: webapp-prod/web-servers
---
# Attachment 2: server-01 to worker-nodes subnet
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPCAttachment
metadata:
  name: server-01-workers
spec:
  connection: server-01--mclag--leaf-01--leaf-02
  subnet: webapp-prod/worker-nodes
```

**Result:**

Server-01 has access to both VLANs (1010 and 1020).

**Use cases:**

- Management network + production network
- Multiple application tiers on same server
- Separate storage network
- Development + testing networks

**Server NIC configuration:**

When using multiple attachments, configure VLAN subinterfaces on the server OS:

```bash
# Example on Linux server
# eth0.1010 for web-servers VLAN
# eth0.1020 for worker-nodes VLAN
```

## Troubleshooting

### Issue: VPCAttachment fails with "Connection not found"

**Symptom:** Error during apply: `Connection "server-01" not found`

**Cause:** Connection name doesn't match any Connection CRD

**Fix:**

```bash
# List all connections to find the correct name
kubectl get connections | grep server-01

# Expected output:
# server-01--mclag--leaf-01--leaf-02   2h

# Update your VPCAttachment YAML with exact connection name
# Wrong:
#   connection: server-01
# Correct:
#   connection: server-01--mclag--leaf-01--leaf-02

# Reapply:
kubectl apply -f server-01-attachment.yaml
```

### Issue: VPCAttachment fails with "Subnet not found"

**Symptom:** Error during apply: `Subnet "web-servers" not found in VPC "webapp-prod"`

**Cause:** VPC/subnet format incorrect or subnet doesn't exist in VPC

**Fix:**

```bash
# Verify VPC exists
kubectl get vpc webapp-prod

# Check subnet names in VPC
kubectl get vpc webapp-prod -o yaml | grep -A 2 "subnets:"

# Expected output shows subnet names:
#   subnets:
#     web-servers:
#       subnet: 10.10.10.0/24
#     worker-nodes:
#       subnet: 10.10.20.0/24

# Ensure VPCAttachment uses correct format:
# Format: <vpc-name>/<subnet-name>
# Correct: webapp-prod/web-servers
# Wrong: web-servers (missing VPC name)

# Update YAML and reapply
kubectl apply -f server-01-attachment.yaml
```

### Issue: VPCAttachment created but server has no connectivity

**Symptom:** VPCAttachment shows no errors, but server can't reach network

**Cause:** Server OS network configuration not set, or wrong VLAN on server NIC

**Fix:**

```bash
# Step 1: Verify VPCAttachment reconciled successfully
kubectl describe vpcattachment server-01-web-servers

# Step 1b: Verify agent generation counters converged (APPLIEDG == CURRENTG)
# leaf-01 and leaf-02 handle MCLAG connections
kubectl get agents

# Step 2: Check server OS network configuration
# SSH to server and verify interface config

# For static IP subnet (no DHCP):
# Manually configure IP on server
# Example on Linux:
sudo ip addr add 10.10.10.10/24 dev eth0
sudo ip route add default via 10.10.10.1

# For DHCP subnet:
# Verify DHCP client is running
sudo systemctl status dhclient
# Or request DHCP:
sudo dhclient eth0

# Step 3: Verify VLAN configuration (if server expects tagged VLAN)
# Check if server NIC is configured for VLAN tagging
# If VPCAttachment has nativeVLAN: false, server needs VLAN subinterface
```

### Issue: DHCP not working for server on DHCPv4 subnet

**Symptom:** Server doesn't get DHCP IP from worker-nodes subnet

**Cause:** DHCP client not running on server, or server NIC not requesting DHCP

**Fix:**

```bash
# Step 1: Verify VPCAttachment to DHCPv4 subnet
kubectl get vpcattachment server-05-worker-nodes -o yaml

# Verify subnet has DHCP enabled:
kubectl get vpc webapp-prod -o jsonpath='{.spec.subnets.worker-nodes.dhcp}' | jq

# Expected output:
# {
#   "enable": true,
#   "range": {
#     "start": "10.10.20.10",
#     "end": "10.10.20.250"
#   }
# }

# Step 2: Check DHCP client on server
# SSH to server
sudo systemctl status dhclient  # or NetworkManager, dhcpcd

# Start DHCP client if not running:
sudo dhclient eth0

# Step 3: Check for DHCP range exhaustion
# If range is full, expand DHCP range in VPC:
kubectl edit vpc webapp-prod
# Modify dhcp.range.end to larger value
```

### Issue: Multiple VPCAttachments to same server causing conflicts

**Symptom:** Server connectivity intermittent, some VLANs work, others don't

**Cause:** Server OS not configured for multiple VLANs/subnets

**Fix:**

```bash
# Step 1: List all VPCAttachments for the server
kubectl get vpcattachments | grep server-01

# Example output:
# server-01-web-servers     5m
# server-01-workers         3m

# Step 2: Identify VLANs for each attachment
kubectl get vpc webapp-prod -o yaml | grep vlan

# Example output:
# web-servers: vlan: 1010
# worker-nodes: vlan: 1020

# Step 3: Configure VLAN subinterfaces on server
# SSH to server and create VLAN interfaces
# Example on Linux:
sudo ip link add link eth0 name eth0.1010 type vlan id 1010
sudo ip link add link eth0 name eth0.1020 type vlan id 1020
sudo ip link set eth0.1010 up
sudo ip link set eth0.1020 up

# Step 4: Assign IPs to VLAN interfaces
sudo ip addr add 10.10.10.10/24 dev eth0.1010  # web-servers
sudo dhclient eth0.1020                         # worker-nodes (DHCP)
```

### Issue: "Namespace mismatch" error

**Symptom:** Error during apply: `VPCAttachment namespace doesn't match VPC namespace`

**Cause:** VPCAttachment and VPC are in different Kubernetes namespaces

**Fix:**

```bash
# Check VPC namespace
kubectl get vpc webapp-prod -A

# Example output:
# NAMESPACE   NAME           AGE
# default     webapp-prod   1h

# Ensure VPCAttachment uses same namespace
# Edit VPCAttachment YAML:
# metadata:
#   namespace: default  # Must match VPC namespace

# Reapply:
kubectl apply -f server-01-attachment.yaml
```

## Resources

### Hedgehog CRDs

**VPCAttachment** - Binds server connection to VPC subnet

- View all: `kubectl get vpcattachments`
- View specific: `kubectl get vpcattachment <name>`
- Inspect: `kubectl describe vpcattachment <name>`
- View YAML: `kubectl get vpcattachment <name> -o yaml`
- Delete: `kubectl delete vpcattachment <name>`

**Connection** - Server-to-switch wiring (from Module 1.1)

- View all: `kubectl get connections`
- View server connections: `kubectl get connections | grep server-`
- View specific: `kubectl get connection <name> -o yaml`

**VPC** - Virtual network (from Module 2.1)

- View all: `kubectl get vpcs`
- View specific: `kubectl get vpc <name>`
- Inspect: `kubectl describe vpc <name>`

**Server** - Physical server definition

- View all: `kubectl get servers`
- View specific: `kubectl get server <name> -o yaml`

### kubectl Commands

**VPCAttachment lifecycle:**

```bash
# Create VPCAttachment
kubectl apply -f attachment.yaml

# List all VPCAttachments
kubectl get vpcattachments

# List in all namespaces
kubectl get vpcattachments -A

# Get VPCAttachment details
kubectl describe vpcattachment <name>

# View as YAML
kubectl get vpcattachment <name> -o yaml

# Check reconciliation status (events are empty; use agent generation counters)
kubectl get agents

# Delete VPCAttachment
kubectl delete vpcattachment <name>

# Delete from file
kubectl delete -f attachment.yaml
```

**Discovery and validation:**

```bash
# List servers
kubectl get servers
# List connections
kubectl get connections
# Filter for server connections
kubectl get connections | grep server-

# Get connection details
kubectl get connection <connection-name> -o yaml

# Verify VPC and subnets
kubectl get vpc <vpc-name>
kubectl get vpc <vpc-name> -o yaml | grep -A 20 "subnets:"

# Check DHCP configuration
kubectl get vpc <vpc-name> -o jsonpath='{.spec.subnets.<subnet-name>.dhcp}' | jq
```

**Reconciliation monitoring:**

```bash
# VPCAttachment events are typically empty — use agent generation counters instead
# Check all agents: APPLIEDG should equal CURRENTG after 15–60 seconds
kubectl get agents

# Watch agents in real-time until converged
kubectl get agents --watch
```

### Related Modules

- Previous: [Module 2.1: VPC Provisioning Essentials](./module-2.1-vpc-provisioning.md)
- Next: Module 2.3: Day 1 Operations (coming soon)
- Module 1.1: [Welcome to Fabric Operations](../course-1-foundations/fabric-operations-welcome/README.md) (for Server/Connection review)

### External Documentation

- [Hedgehog VPCAttachment Documentation](https://docs.hedgehog.io/)
- [Hedgehog Fabric Architecture](https://docs.hedgehog.io/)
- [EVPN VXLAN Overview](https://datatracker.ietf.org/doc/html/rfc7432)
- [Understanding MCLAG](https://en.wikipedia.org/wiki/Multi-chassis_link_aggregation_group)

---

**Module Complete!** You've successfully learned VPCAttachment provisioning and connected servers to VPCs. In Module 2.3, you'll learn Day 1 operations for managing VPCs and attachments.
