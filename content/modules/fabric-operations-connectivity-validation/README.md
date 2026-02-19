---
title: "Connectivity Validation"
slug: "fabric-operations-connectivity-validation"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.0.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - validation
  - connectivity
  - operations
  - troubleshooting
description: "Validate VPC and VPCAttachment deployments with hands-on testing. Learn to verify connectivity, interpret events, and troubleshoot issues."
order: 203
---

# Connectivity Validation

## Introduction

In Modules 2.1 and 2.2, you provisioned infrastructure—creating the `webapp-prod` VPC with two subnets and attaching two servers (`server-01` and `server-05`). You followed the declarative workflow: write YAML, apply it, and trust that the fabric controller handles the rest.

But trust alone isn't enough in production. Before handing off to the application team, you need to **validate** that everything works as expected. Declarative infrastructure doesn't eliminate the need for verification—it just changes how you verify.

In this module, you'll learn validation workflows that Fabric Operators use daily: inspecting VPC configurations, checking VPCAttachment status, reading reconciliation events, exploring Agent CRDs for switch-level state, and building a validation checklist you can use for every deployment.

## Learning Objectives

By the end of this module, you will be able to:

1. **Validate VPC deployments** - Verify VPC configuration matches desired state
2. **Validate VPCAttachment status** - Confirm server-to-VPC connectivity is operational
3. **Interpret reconciliation events** - Read events to understand what happened during deployment
4. **Use Agent CRDs for validation** - Inspect switch-level configuration state
5. **Troubleshoot deployment issues** - Diagnose and fix common validation failures

## Prerequisites

- Module 2.1 completion (VPC Provisioning Essentials)
- Module 2.2 completion (VPC Attachments)
- Existing `webapp-prod` VPC with 2 VPCAttachments (server-01, server-05)
- kubectl access to Hedgehog fabric
- Understanding of Kubernetes events and CRDs

## Scenario: Pre-Production Validation

You've deployed the `webapp-prod` VPC and attached `server-01` (web tier) and `server-05` (worker tier). Before handing off to the application team, you need to validate the network connectivity is operational. You'll verify VPC status, check VPCAttachment reconciliation, inspect Agent CRDs to see switch-level configuration, and run validation tests to ensure everything works as expected. This validation workflow is critical—it catches configuration issues before they impact production traffic.

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Lab Steps

### Step 1: Review Deployed Infrastructure

**Objective:** Verify expected resources exist and understand current state

Before validating configurations in detail, confirm all expected resources are present.

List VPCs in the fabric:

```bash
kubectl get vpcs
```

Expected output (similar to):
```
NAME          IPV4NS    VLANNS    AGE
webapp-prod   default   default   25m
```

List VPCAttachments:

```bash
kubectl get vpcattachments
```

Expected output (similar to):
```
NAME                     VPCSUBNET                  CONNECTION                           NATIVEVLAN   AGE
server-01-web-servers    webapp-prod/web-servers    server-01--mclag--leaf-01--leaf-02                15m
server-05-worker-nodes   webapp-prod/worker-nodes   server-05--eslag--leaf-03--leaf-04                12m
```

Quick status check of all resources:

```bash
# View VPC with basic info
kubectl get vpc webapp-prod

# View VPCAttachments with basic info
kubectl get vpcattachments
```

**Verification checklist:**

- ✅ VPC `webapp-prod` exists
- ✅ VPCAttachment `server-01-web-servers` exists
- ✅ VPCAttachment `server-05-worker-nodes` exists
- ✅ No obvious errors in basic listing

**Success Criteria:**

- ✅ VPC webapp-prod exists
- ✅ Both VPCAttachments exist (server-01, server-05)
- ✅ No obvious errors in kubectl get output

### Step 2: Validate VPC Configuration

**Objective:** Confirm VPC configuration matches desired state

Use `kubectl describe` to view comprehensive VPC details:

```bash
kubectl describe vpc webapp-prod
```

**Key sections to review in the output:**

**1. Spec section (what you requested):**

Look for:
- **Subnets**: Two subnets should be present (`web-servers` and `worker-nodes`)
- **web-servers subnet**:
  - Subnet: 10.10.10.0/24
  - Gateway: 10.10.10.1
  - VLAN: 1010
  - No DHCP configuration (static IP subnet)
- **worker-nodes subnet**:
  - Subnet: 10.10.20.0/24
  - Gateway: 10.10.20.1
  - VLAN: 1020
  - DHCP enabled with range 10.10.20.10-250

View subnets in detail:

```bash
# Extract subnet configuration
kubectl get vpc webapp-prod -o yaml | grep -A 20 "subnets:"
```

**2. Reconciliation status:**

Note: Hedgehog VPC operations do not emit Kubernetes events. Track reconciliation via agent generation counters instead:

```bash
kubectl get agents
```

Expected: APPLIEDG == CURRENTG on all agents (all convergent = VPC configuration has been pushed to switches).

Verify DHCP configuration for worker-nodes:

```bash
kubectl get vpc webapp-prod -o jsonpath='{.spec.subnets.worker-nodes.dhcp}' | jq
```

Expected output:
```json
{
  "enable": true,
  "range": {
    "start": "10.10.20.10",
    "end": "10.10.20.250"
  }
}
```

**Success Criteria:**

- ✅ Subnets configured correctly (CIDRs, gateways, VLANs)
- ✅ VLANs assigned as expected (1010, 1020)
- ✅ DHCP enabled for worker-nodes with correct range
- ✅ Agent APPLIEDG == CURRENTG (all converged)

### Step 3: Validate VPCAttachment Status

**Objective:** Confirm VPCAttachments reconciled successfully

Describe both VPCAttachments to review their status:

```bash
# Check server-01 attachment (MCLAG, static IP subnet)
kubectl describe vpcattachment server-01-web-servers
```

**Key items to verify:**

- **Spec section**:
  - Connection: `server-01--mclag--leaf-01--leaf-02` (correct connection reference)
  - Subnet: `webapp-prod/web-servers` (correct VPC/subnet format)

- **Events section**: Note — VPCAttachment operations do not emit Kubernetes events. The Events section of `kubectl describe vpcattachment` will be empty — this is normal.

Check the second VPCAttachment:

```bash
# Check server-05 attachment (ESLAG, DHCP subnet)
kubectl describe vpcattachment server-05-worker-nodes
```

Verify reconciliation via agent generation counters:

```bash
# APPLIEDG should equal CURRENTG on all agents
kubectl get agents
```

Verify connection references are correct:

```bash
# Verify server-01 connection exists and matches
kubectl get connection server-01--mclag--leaf-01--leaf-02

# Verify server-05 connection exists and matches
kubectl get connection server-05--eslag--leaf-03--leaf-04
```

Expected output for each: Connection details showing the server-to-switch wiring.

**Success Criteria:**

- ✅ Both attachments show correct spec (connection and subnet references)
- ✅ Agent APPLIEDG == CURRENTG (configuration applied to switches)
- ✅ No error shown in kubectl describe
- ✅ Connection references match expected values (MCLAG for server-01, ESLAG for server-05)

### Step 4: Inspect Agent CRDs (Switch-Level Validation)

**Objective:** Verify switch-level configuration state

Agent CRDs are the **source of truth** for switch state. Each switch has an Agent CRD that shows:
- **Spec**: What the fabric controller wants configured
- **Status**: What the switch agent has actually applied

**Identify switches involved in connections:**

- **server-01** (MCLAG): Connected to `leaf-01` and `leaf-02`
- **server-05** (ESLAG): Connected to `leaf-03` and `leaf-04`

List all switches:

```bash
kubectl get switches
```

View Agent CRD for leaf-01:

```bash
kubectl get agent leaf-01 -o yaml
```

**What to look for in Agent CRD:**

The output is extensive, but focus on these areas:

**1. Spec section** (desired configuration):
- Look for VLAN configuration on server-facing ports
- Check for VXLAN tunnel configuration
- Verify BGP EVPN route configuration

**2. Status section** (applied configuration):
- Check if status reflects spec (configuration applied successfully)
- Look for any error messages or failed applications

View specific switch port configuration (example):

```bash
# Get leaf-01 Agent CRD and look for server-01 port configuration
kubectl get agent leaf-01 -o yaml | grep -A 10 "E1/5"
```

(Note: Port names may vary based on your environment)

**Understanding Agent CRDs:**

- **Spec = Intent**: What the fabric controller computed for this switch
- **Status = Reality**: What the switch agent successfully applied
- **Mismatch = Problem**: If spec and status diverge, configuration failed

You don't need to understand every field in the Agent CRD. The key insight: if VPCAttachment events show success, the Agent CRDs should reflect the configuration.

**Success Criteria:**

- ✅ Can view Agent CRDs for relevant switches (leaf-01, leaf-02, leaf-03, leaf-04)
- ✅ Agent CRDs contain VPC-related configuration in spec
- ✅ Understand Agent CRD is source of truth for switch state

### Step 5: Validation Methodology (Conceptual)

**Objective:** Understand end-to-end validation approach

In a vlab environment, servers are simulated, so actual ping tests may not be possible. However, understanding the **validation methodology** is critical for production deployments.

**Validation layers (from abstract to physical):**

1. **VPC validation**: Does the VPC exist with correct subnets?
2. **VPCAttachment validation**: Did VPCAttachments reconcile successfully?
3. **Agent CRD validation**: Are switches configured correctly?
4. **Physical connectivity validation**: Can servers actually communicate?

**Production connectivity tests (when servers are real):**

**For server-01 (static IP subnet):**

```bash
# SSH to server-01
# Manually configure IP (since it's a static subnet)
sudo ip addr add 10.10.10.10/24 dev eth0
sudo ip route add default via 10.10.10.1

# Test gateway reachability
ping -c 3 10.10.10.1

# Test connectivity to another server in the same VPC (if applicable)
ping -c 3 10.10.10.20
```

**For server-05 (DHCP subnet):**

```bash
# SSH to server-05
# Request DHCP IP
sudo dhclient eth0

# Verify IP received in DHCP range
ip addr show eth0

# Expected: IP in range 10.10.20.10-250

# Test gateway reachability
ping -c 3 10.10.20.1
```

**In vlab environment:**

Since servers are simulated, focus on:
- kubectl describe output showing no errors
- Event inspection showing successful reconciliation
- Agent CRD verification showing configuration applied

**Validation checklist summary:**

- ✅ VPC exists with correct subnets
- ✅ VPCAttachments reconciled without errors
- ✅ Events show successful configuration application
- ✅ Agent CRDs contain expected configuration
- ✅ (Production only) Servers can reach gateway and communicate

**Success Criteria:**

- ✅ Understand validation methodology
- ✅ Know what tests to run in production
- ✅ Can explain expected outcomes for connectivity tests

## Concepts & Deep Dive

### Validation Philosophy

**Why validate declarative infrastructure?**

Declarative systems like Kubernetes promise self-healing and correctness, but they're not magic. Validation catches:

- **Configuration errors**: Typos in YAML, invalid references, CIDR overlaps
- **Reconciliation failures**: Controller bugs, network issues, switch problems
- **Environmental issues**: Resource exhaustion, DHCP conflicts, VLAN collisions
- **Timing issues**: Configuration applied but BGP hasn't converged yet

**Trust but verify**: Declarative infrastructure reduces manual work, but operators still need to confirm the desired state matches reality.

### Validation Layers

Hedgehog infrastructure validation has multiple layers:

**Layer 1: Kubernetes resource validation**
- Does the VPC CRD exist?
- Do VPCAttachment CRDs exist?
- Are there any error events?
- Tool: `kubectl get`, `kubectl describe`

**Layer 2: Reconciliation validation**
- Did the fabric controller process the resources?
- Did reconciliation complete successfully?
- Tool: `kubectl get agents` (APPLIEDG == CURRENTG confirms reconciliation)

**Layer 3: Switch-level validation**
- Are switches configured with correct VLANs?
- Are VXLAN tunnels established?
- Are BGP EVPN routes present?
- Tool: Agent CRD inspection

**Layer 4: Physical connectivity validation**
- Can servers reach their gateway?
- Can servers communicate with each other?
- Is DHCP working (if enabled)?
- Tool: ping, SSH to servers, dhclient

Each layer validates a different aspect. Errors at higher layers prevent lower layers from working.

### Agent CRD as Source of Truth

**What is an Agent CRD?**

Every switch in the fabric has a corresponding Agent CRD. It's the operational state record for that switch.

**Agent CRD structure:**

```yaml
apiVersion: agent.githedgehog.com/v1beta1
kind: Agent
metadata:
  name: leaf-01
  namespace: default
spec:
  # What the fabric controller wants configured on this switch
  # Computed from VPCs, VPCAttachments, and Connections
  switchProfile: leaf
  config:
    vlans:
      1010:
        vxlan: 101010
        subnet: 10.10.10.0/24
      1020:
        vxlan: 102020
        subnet: 10.10.20.0/24
    ports:
      E1/5:
        mode: access
        vlan: 1010
status:
  # What the switch agent has applied
  # Updated by the switch agent after applying config
  applied: true
  lastApplied: "2025-10-16T10:30:00Z"
```

**Spec vs Status:**

- **Spec**: Desired state (what should be configured)
- **Status**: Actual state (what was successfully applied)

**When spec and status match**: Configuration applied successfully
**When they diverge**: Configuration failed (check agent logs)

**Agent CRD workflow:**

1. Fabric controller computes switch configuration from VPC/VPCAttachment CRDs
2. Fabric controller writes configuration to Agent CRD spec
3. Switch agent (running on the switch or as a pod) watches Agent CRD
4. Switch agent applies configuration via gNMI to SONiC switch OS
5. Switch agent updates Agent CRD status with applied state

**When to inspect Agent CRDs:**

- **Troubleshooting**: VPCAttachment succeeded but connectivity fails
- **Deep validation**: Verifying VLAN/VXLAN/BGP configuration
- **Learning**: Understanding what happens on switches

### Reconciliation Validation

Hedgehog Fabric controllers do not emit Kubernetes events for VPC or VPCAttachment operations — `kubectl get events` will show an empty Events section for these resources. This is expected behavior. Instead, track reconciliation using Agent generation counters.

**Reading agent generation counters:**

```bash
kubectl get agents
```

Example output (all converged):
```
NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION   REBOOTREQ
leaf-01    server-leaf   VS-01 MCLAG 1   30s       9          9          v0.96.2
leaf-02    server-leaf   VS-02 MCLAG 1   29s       9          9          v0.96.2
leaf-03    server-leaf   VS-03 ESLAG 1   28s       7          7          v0.96.2
leaf-04    server-leaf   VS-04 ESLAG 1   27s       7          7          v0.96.2
...
```

- **CURRENTG**: Generation of the current desired config (increments when VPC/VPCAttachment changes)
- **APPLIEDG**: Generation that the switch agent has applied to the physical switch
- **APPLIEDG == CURRENTG**: Reconciliation complete; the switch reflects the desired config
- **APPLIEDG < CURRENTG**: Reconciliation in progress; wait 15–60 seconds and re-check

**Using generation counters for troubleshooting:**

- **APPLIEDG stays below CURRENTG**: Agent not receiving config; check agent pod logs in the `fab` namespace
- **CURRENTG not incrementing after YAML change**: Controller not picking up the change; check controller pod logs
- **APPLIEDG converged but connectivity fails**: Config applied to switches; problem is at the server OS level

### Validation Checklist

Use this comprehensive checklist for every VPC deployment:

**VPC Validation:**
- [ ] VPC exists (`kubectl get vpc <name>`)
- [ ] Subnets configured correctly (CIDR, gateway, VLAN)
- [ ] DHCP settings correct (if applicable)
- [ ] Agent APPLIEDG == CURRENTG (`kubectl get agents`)

**VPCAttachment Validation:**
- [ ] VPCAttachments exist (`kubectl get vpcattachments`)
- [ ] Connection references correct and exist
- [ ] Subnet references correct (VPC/subnet format)
- [ ] Agent APPLIEDG == CURRENTG on relevant switches (reconciliation complete)
- [ ] No error shown in `kubectl describe vpcattachment <name>`

**Agent CRD Validation (Advanced):**
- [ ] VLANs configured on server-facing ports
- [ ] VXLAN tunnels established
- [ ] BGP EVPN routes present
- [ ] Agent status shows applied configuration

**Server-Level Validation (Production):**
- [ ] Server NIC configured with correct IP/VLAN
- [ ] Server can ping gateway
- [ ] Server can reach other servers in VPC
- [ ] DHCP working (if applicable)

**Common validation workflow:**

1. Start with high-level checks (does VPC exist?)
2. Move to reconciliation checks (did it apply successfully?)
3. Dive into Agent CRDs only if issues arise
4. Test physical connectivity last (after configuration confirmed)

### Common Validation Failures and Causes

**Issue: VPC shows in kubectl get but describe shows errors**

**Symptom**: VPC exists but events show warnings

**Cause**: Validation error in spec (CIDR overlap, VLAN conflict, invalid configuration)

**Investigation**:
```bash
kubectl describe vpc <name>
kubectl get events --field-selector involvedObject.name=<vpc-name>
```

**Fix**: Review events for specific error, fix YAML, reapply

---

**Issue: VPCAttachment reconciliation stuck in "Reconciling" state**

**Symptom**: Events show "Reconciling" but never "Applied"

**Cause**: Connection doesn't exist, VPC reference invalid, or subnet doesn't exist

**Investigation**:
```bash
kubectl describe vpcattachment <name>
kubectl get connection <connection-name>
kubectl get vpc <vpc-name>
```

**Fix**: Verify connection and VPC exist, correct references in VPCAttachment YAML

---

**Issue: Agent CRD spec updated but status not matching**

**Symptom**: Agent spec shows config, but status doesn't reflect applied state

**Cause**: Switch connectivity issues, agent pod not running, gNMI failure

**Investigation**:
```bash
kubectl get agent <switch-name> -o yaml
kubectl get pods | grep agent
kubectl logs <agent-pod-name>
```

**Fix**: Check agent pods, verify switch reachability, review agent logs

---

**Issue: Server has no connectivity despite successful VPCAttachment**

**Symptom**: VPCAttachment shows "Applied" but server can't reach network

**Cause**: Server OS network not configured, wrong VLAN on server NIC

**Investigation**:
```bash
# SSH to server
ip addr show
ip route show

# Check if VLAN subinterface needed
# For native VLAN: eth0 configured directly
# For tagged VLAN: eth0.1010 subinterface needed
```

**Fix**: Configure server network, verify VLAN tagging matches fabric configuration

---

**Issue: DHCP not assigning IP to server**

**Symptom**: Server not getting DHCP IP on worker-nodes subnet

**Cause**: Server DHCP client not running, DHCP range exhausted, or server NIC not requesting DHCP

**Investigation**:
```bash
# On server
sudo systemctl status dhclient
sudo journalctl -u dhclient

# On fabric
kubectl get vpc <vpc-name> -o jsonpath='{.spec.subnets.<subnet-name>.dhcp}' | jq
```

**Fix**: Start DHCP client on server, expand DHCP range if exhausted, verify server NIC configuration

## Troubleshooting

### Issue: VPC validation shows "subnet overlap" warning in events

**Symptom:** VPC describes shows warning event about subnet overlap

**Cause:** Subnet CIDR overlaps with another VPC's subnet

**Fix:**

```bash
# List all VPCs and their subnets to identify overlap
kubectl get vpcs -o yaml | grep -E "(name:|subnet:)"

# Example output showing overlap:
#   name: existing-vpc
#     subnet: 10.10.0.0/16    # Overlaps with webapp-prod subnets!
#   name: webapp-prod
#     subnet: 10.10.10.0/24

# Solution: Change webapp-prod subnets to non-overlapping range
# Edit VPC YAML and change subnet CIDRs
# Then reapply:
kubectl apply -f webapp-prod-vpc.yaml
```

### Issue: VPCAttachment events show "Connection not found"

**Symptom:** VPCAttachment describe shows error event "Connection 'server-01' not found"

**Cause:** Connection name in VPCAttachment doesn't match any Connection CRD

**Fix:**

```bash
# List connections to find correct name
kubectl get connections | grep server-01

# Expected output:
# server-01--mclag--leaf-01--leaf-02   2h

# Update VPCAttachment YAML with full connection name
# Wrong:
#   connection: server-01
# Correct:
#   connection: server-01--mclag--leaf-01--leaf-02

# Reapply:
kubectl apply -f server-01-attachment.yaml
```

### Issue: Agent CRD shows configuration in spec but status is empty

**Symptom:** Agent CRD spec has VLAN/VXLAN config but status field is empty or outdated

**Cause:** Switch agent not running, switch unreachable, or gNMI communication failure

**Fix:**

```bash
# Check if agent pods are running
kubectl get pods -n fab | grep agent

# If agent pod is not running or crashing:
kubectl describe pod <agent-pod-name> -n fab
kubectl logs <agent-pod-name> -n fab

# Check if switch is reachable from agent pod
kubectl exec -n fab <agent-pod-name> -- ping <switch-ip>

# If switch is unreachable, verify switch management connectivity
# If agent is crashing, check logs for gNMI authentication issues
```

### Issue: Agents converged but server can't ping gateway

**Symptom:** Agent APPLIEDG == CURRENTG (configuration applied to switches), but server has no network connectivity

**Cause:** Server OS network configuration missing or incorrect

**Fix:**

```bash
# SSH to server and check network configuration
ip addr show
ip route show

# For static IP subnet (web-servers):
# Manually configure IP if not present
sudo ip addr add 10.10.10.10/24 dev eth0
sudo ip route add default via 10.10.10.1

# For DHCP subnet (worker-nodes):
# Start DHCP client if not running
sudo dhclient eth0

# Verify VLAN configuration (if using tagged VLANs)
# If VPCAttachment expects VLAN tagging, create subinterface:
sudo ip link add link eth0 name eth0.1020 type vlan id 1020
sudo ip link set eth0.1020 up
sudo dhclient eth0.1020
```

### Issue: No events visible for VPC or VPCAttachment

**Symptom:** kubectl describe for VPC or VPCAttachment shows an empty Events section

**Cause:** This is expected. The Hedgehog Fabric controller does not emit Kubernetes events for VPC or VPCAttachment operations.

**What to check instead:**

```bash
# Use agent generation counters to verify reconciliation
kubectl get agents

# If CURRENTG is not incrementing after an apply, check the controller:
kubectl get pods -n fab | grep controller

# If controller is not running:
kubectl describe pod <controller-pod-name> -n fab
kubectl logs <controller-pod-name> -n fab
```

### Issue: DHCP range exhausted, servers not getting IPs

**Symptom:** New servers on DHCP subnet fail to get IP, DHCP events in logs show range exhausted

**Cause:** DHCP range too small for number of servers

**Fix:**

```bash
# Check current DHCP configuration
kubectl get vpc webapp-prod -o jsonpath='{.spec.subnets.worker-nodes.dhcp}' | jq

# Current range: 10.10.20.10 to 10.10.20.250 = 241 IPs

# Solution 1: Expand DHCP range to larger subnet
kubectl edit vpc webapp-prod
# Change subnet from /24 to /23 (512 IPs)
# Update DHCP end range accordingly

# Solution 2: Reclaim unused IPs
# Identify servers that are no longer active and remove VPCAttachments
kubectl get vpcattachments | grep worker-nodes
kubectl delete vpcattachment <unused-attachment>

# Solution 3: Add another DHCP subnet
# Create additional subnet in VPC with separate DHCP range
```

## Resources

### Hedgehog CRDs

**VPC** - Virtual Private Cloud definition

- View all: `kubectl get vpcs`
- View specific: `kubectl get vpc <name>`
- Inspect details: `kubectl describe vpc <name>`
- View YAML: `kubectl get vpc <name> -o yaml`

**VPCAttachment** - Binds server connection to VPC subnet

- View all: `kubectl get vpcattachments`
- View specific: `kubectl get vpcattachment <name>`
- Inspect: `kubectl describe vpcattachment <name>`
- View YAML: `kubectl get vpcattachment <name> -o yaml`

**Agent** - Per-switch operational state

- View all: `kubectl get agents`
- View specific: `kubectl get agent <switch-name>`
- Inspect: `kubectl describe agent <switch-name>`
- View YAML: `kubectl get agent <switch-name> -o yaml`

**Connection** - Server-to-switch wiring

- View all: `kubectl get connections`
- View server connections: `kubectl get connections | grep server-`

### kubectl Commands Reference

**Validation commands:**

```bash
# List VPCs
kubectl get vpcs

# Describe VPC with full details
kubectl describe vpc <name>

# List VPCAttachments
kubectl get vpcattachments

# Describe VPCAttachment
kubectl describe vpcattachment <name>

# View events sorted by time
kubectl get events --sort-by='.lastTimestamp' | tail -20

# View events for specific resource
kubectl get events --field-selector involvedObject.name=<resource-name>

# View all events in fabric namespace
kubectl get events --sort-by='.lastTimestamp'
```

**Agent CRD inspection:**

```bash
# List all agents (switches)
kubectl get agents

# View agent YAML (full configuration)
kubectl get agent <switch-name> -o yaml

# Describe agent with events
kubectl describe agent <switch-name>

# Filter agent config for specific port
kubectl get agent <switch-name> -o yaml | grep -A 10 "<port-name>"
```

**Reconciliation monitoring (replaces event-based checks):**

```bash
# Check reconciliation status for all switches
kubectl get agents

# Watch reconciliation in real-time
kubectl get agents --watch

# Note: kubectl get events returns empty for VPC and VPCAttachment objects —
# this is expected. Agent generation counters are the correct reconciliation indicator.
```

**DHCP verification:**

```bash
# Check DHCP configuration for subnet
kubectl get vpc <vpc-name> -o jsonpath='{.spec.subnets.<subnet-name>.dhcp}' | jq

# View entire VPC YAML
kubectl get vpc <vpc-name> -o yaml
```

### Related Modules

- Previous: [Module 2.2: VPC Attachments](./module-2.2-vpc-attachments.md)
- Next: Module 2.4: Decommission & Cleanup (completes Course 2)
- Pathway: [Network Like a Hyperscaler](../../pathways/network-like-hyperscaler.json)

### External Documentation

- [Hedgehog VPC Documentation](https://docs.hedgehog.io/)
- [Hedgehog Agent CRD Reference](https://docs.hedgehog.io/)
- [Kubernetes Events](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/)
- [kubectl Command Reference](https://kubernetes.io/docs/reference/kubectl/)

---

**Module Complete!** You've successfully learned VPC and VPCAttachment validation workflows. Ready to learn decommissioning and cleanup in Module 2.4.
