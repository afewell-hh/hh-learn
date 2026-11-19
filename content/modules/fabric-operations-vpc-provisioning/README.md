---
title: "VPC Provisioning Essentials"
slug: "fabric-operations-vpc-provisioning"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.1.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - vpc
  - provisioning
  - operations
description: "Master VPC provisioning with hands-on creation of IPv4 and DHCPv4 subnets. Learn to validate configurations and troubleshoot common issues."
order: 201
---

# VPC Provisioning Essentials

## Introduction

In Course 1, you explored Hedgehog fabric as a read-only observer. Now you're ready to **provision real infrastructure**. In this module, you'll create your first production-ready VPC with multiple subnets, learning the complete workflow from YAML creation to validation. This is where Fabric Operators spend most of their time—provisioning network resources safely and confidently using declarative infrastructure.

## Learning Objectives

By the end of this module, you will be able to:

1. **Provision a VPC** - Create a VPC using kubectl apply with YAML manifest
2. **Distinguish subnet types** - Explain the difference between IPv4 (static) and DHCPv4 subnets
3. **Validate VPC creation** - Use kubectl get/describe to confirm VPC status
4. **Interpret VPC observations** - Distinguish API acceptance, desired spec, and Agent status; know why an empty Events section is inconclusive
5. **Troubleshoot common issues** - Diagnose and fix VPC provisioning problems

## Prerequisites

- Course 1 completion (Foundations & Interfaces)
- kubectl access to Hedgehog fabric
- Basic YAML editing skills
- Understanding of IP subnets and CIDR notation

## Scenario: Onboarding a New Application

Your company is deploying a new application called "webapp-prod" that requires network isolation. The application has two tiers: web servers that need static IP assignments (so you can configure load balancers), and worker nodes that can use DHCP (since they scale dynamically). You'll create a VPC with two subnets—one IPv4 subnet for static assignments and one DHCPv4 subnet for dynamic assignments—providing complete network segmentation for this workload.

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center?hsLang=en-us) module first — it takes about 20 minutes and only needs to be done once.

## Lab Steps

### Step 1: Create VPC YAML Manifest

**Objective:** Define a VPC with two subnets (one IPv4, one DHCPv4)

Create the VPC manifest file:

```bash
cat > webapp-prod-vpc.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: webapp-prod
  namespace: default
spec:
  ipv4Namespace: default
  vlanNamespace: default
  subnets:
    web-servers:
      subnet: 10.10.10.0/24
      gateway: 10.10.10.1
      vlan: 1010
    worker-nodes:
      subnet: 10.10.20.0/24
      gateway: 10.10.20.1
      vlan: 1020
      dhcp:
        enable: true
        range:
          start: 10.10.20.10
          end: 10.10.20.250
EOF
```

**Understanding the YAML:**

- **apiVersion/kind:** Defines this as a VPC resource
- **metadata.name:** Unique identifier for this VPC ("webapp-prod")
- **ipv4Namespace/vlanNamespace:** Groups for managing IP and VLAN allocations (use "default" for most cases)
- **subnets:** Dictionary of subnet definitions
  - **web-servers:** IPv4 subnet (no DHCP = static IPs only)
    - 10.10.10.0/24 provides 254 usable IPs (.1-.254)
    - Gateway at .1 (first usable IP)
    - VLAN 1010 for layer 2 isolation
  - **worker-nodes:** DHCPv4 subnet (DHCP enabled)
    - 10.10.20.0/24 subnet
    - DHCP range: .10-.250 (241 IPs available)
    - Gateway at .1 (outside DHCP range)

**Validation:**

```bash
# Verify YAML syntax (should show no errors)
cat webapp-prod-vpc.yaml | grep -E '(apiVersion|kind|name|subnet|vlan)'

# Count subnets (should be 2)
grep -c "subnet:" webapp-prod-vpc.yaml
```

**Success Criteria:**

- ✅ YAML file created with correct syntax
- ✅ Two subnets defined (web-servers and worker-nodes)
- ✅ One subnet has DHCP enabled, one does not

### Step 2: Apply VPC Configuration

**Objective:** Submit the VPC to the fabric and verify creation

Apply the VPC manifest:

```bash
kubectl apply -f webapp-prod-vpc.yaml
```

**Expected output:**

```
vpc.vpc.githedgehog.com/webapp-prod created
```

**Immediately verify creation:**

```bash
# Check VPC appears in list
kubectl get vpcs

# Expected output (similar to):
# NAME            AGE
# webapp-prod    5s
```

**Check the fabric's existing Agent status:**

```bash
# Confirm APPLIEDG matches CURRENTG on all seven Agents
kubectl get agents
```

> **What this proves:** `kubectl apply` and `kubectl get vpc` confirm the API accepted and stores the VPC. This VPC has no attachments yet, so its subnets need not enter any switch Agent spec or increase an Agent generation. Matching `APPLIEDG` and `CURRENTG` shows the existing switch configuration is caught up; it is not proof that this unattached VPC reached a switch. The current Fabric release does not emit VPC operation events.

**Success Criteria:**

- ✅ VPC appears in `kubectl get vpcs` output
- ✅ No error messages during apply
- ✅ Existing Agent generations match; no generation increase is required for an unattached VPC

### Step 3: Inspect VPC Status

**Objective:** View detailed VPC information and confirm readiness

Use kubectl describe to see comprehensive VPC details:

```bash
kubectl describe vpc webapp-prod
```

**Key sections to review:**

**1. Metadata section:**
```
Name:         webapp-prod
Namespace:    default
Labels:       <none>
Annotations:  <none>
API Version:  vpc.githedgehog.com/v1beta1
Kind:         VPC
```

**2. Spec section (what you requested):**
```
Spec:
  Ipv4 Namespace:  default
  Vlan Namespace:  default
  Subnets:
    web-servers:
      Subnet:   10.10.10.0/24
      Gateway:  10.10.10.1
      Vlan:     1010
    worker-nodes:
      Subnet:   10.10.20.0/24
      Gateway:  10.10.20.1
      Vlan:     1020
      Dhcp:
        Enable: true
        Range:
          Start: 10.10.20.10
          End:   10.10.20.250
```

**3. Events section (at the bottom):**
```
Events:  <none>
```

> **Expected:** The Events section may be empty because this Fabric release does not emit VPC operation events. Its absence neither proves success nor rules out an error. Check the apply result and stored spec; Course 2.2 checks switch application after attaching servers.

**Verification checklist:**

```bash
# Check existing fabric health; an unattached VPC need not change Agent specs
kubectl get agents

# APPLIEDG should equal CURRENTG for all agents
```

**Success Criteria:**

- ✅ VPC shows both subnets with correct CIDR blocks
- ✅ VLANs assigned (1010 and 1020)
- ✅ DHCP range visible for worker-nodes subnet
- ✅ Understand that an empty Events section is inconclusive

### Step 4: Inspect Agent Status Before Attachment

**Objective:** Read the existing switch status without attributing a generation change to this unattached VPC

Check the seven Agents before the VPC is attached to any server:

```bash
# Check all agents — APPLIEDG should equal CURRENTG
kubectl get agents
```

**Expected output (generation numbers vary; equality shows current switch specs are applied):**

```
NAME       ROLE          DESCR           APPLIED   APPLIEDG   CURRENTG   VERSION
leaf-01    server-leaf   VS-01 MCLAG 1   2m        7          7          v0.96.2
leaf-02    server-leaf   VS-02 MCLAG 1   2m        7          7          v0.96.2
...
```

**Inspect a specific Agent's reported condition:**

```bash
# Check Applied condition = True
kubectl get agent leaf-01 -o yaml | grep -A 5 "conditions:"
```

**Understanding the stages:**

1. **VPC created:** Object stored in Kubernetes etcd
2. **VPC remains unattached:** Its subnets are stored as desired state; no switch configuration change is required yet
3. **Course 2.2 attaches servers:** The controller adds the relevant VPC and attachment configuration to the affected Agent specs
4. **Switch agents apply:** The affected Agents report `APPLIEDG == CURRENTG` after processing that change

> **Note:** An `Applied=True` condition may already exist from earlier switch configuration. It does not by itself prove this VPC was installed. Course 2.2 creates the named attachments and checks affected Agent generations. VPC operation events are not emitted in this release.

**Success Criteria:**

- ✅ Agent APPLIEDG matches CURRENTG for all 7 agents at baseline
- ✅ Inspect leaf-01's `Applied=True` condition without treating it as VPC-specific evidence
- ✅ Explain why this unattached VPC has not yet caused a switch configuration change

### Step 5: Validate Configuration Matches Desired State

**Objective:** Confirm actual state matches what you requested

Compare your YAML to the applied configuration:

```bash
# View original YAML spec
cat webapp-prod-vpc.yaml | grep -A 20 "subnets:"

# View applied configuration
kubectl get vpc webapp-prod -o yaml | grep -A 20 "subnets:"

# They should match exactly
```

**Verify VPC is ready for server attachments:**

```bash
# Check that VPC exists and has no errors
kubectl get vpc webapp-prod

# VPC should appear with no error indicators
# (Status field may be empty - that's normal)
```

**Review DHCP configuration:**

```bash
# Inspect DHCP settings for worker-nodes subnet
kubectl get vpc webapp-prod -o jsonpath='{.spec.subnets.worker-nodes.dhcp}' | jq

# Expected output (similar to):
# {
#   "enable": true,
#   "range": {
#     "start": "10.10.20.10",
#     "end": "10.10.20.250"
#   }
# }
```

**Success Criteria:**

- ✅ Applied config matches desired state in YAML
- ✅ VPC appears stable (no errors when queried)
- ✅ DHCP range configured correctly
- ✅ VPC ready for VPCAttachment operations (next module)

### Lab Summary

**What you accomplished:**

- ✅ Created production-ready VPC manifest with two subnets
- ✅ Applied VPC configuration using kubectl
- ✅ Validated VPC status and configuration
- ✅ Distinguished the stored VPC spec from switch application and absent VPC events
- ✅ Confirmed desired state matches actual state

**What you learned:**

- IPv4 subnets (no DHCP) are for static IP assignments
- DHCPv4 subnets (DHCP enabled) provide dynamic IP allocation
- VPC reconciliation happens automatically via the control loop
- This release does not emit VPC operation events; inspect the stored object and, after attachment, affected Agent specs and applied generations
- kubectl is your primary tool for VPC lifecycle management

**Next steps:**

In Module 2.2, you'll learn to attach servers to this VPC using VPCAttachments, completing the connectivity workflow.

## Concepts & Deep Dive

### VPC Architecture in Hedgehog

A VPC (Virtual Private Cloud) provides network isolation using VXLAN overlays and VLAN segmentation:

**What is a VPC?**

- Logical network boundary isolating workloads
- Contains one or more subnets (layer 3 networks)
- Maps to VXLANs for fabric-wide isolation
- Uses VLANs for server-facing ports

**VPC vs. Traditional VLAN Management:**

| Traditional VLANs | Hedgehog VPCs |
|-------------------|---------------|
| Manual VLAN provisioning per switch | Declare VPC once, fabric handles VLAN allocation |
| Switch-by-switch configuration | Kubernetes-native YAML definition |
| Spreadsheet tracking | kubectl get vpcs |
| Configuration drift risk | Declarative, self-healing |
| Limited scalability (4096 VLANs) | VXLAN provides 16M+ VNIs |

**VPC Isolation Mechanisms:**

1. **VXLAN (fabric core):** VNI (VXLAN Network Identifier) isolates traffic between spine and leaf switches
2. **VLAN (server access):** Traditional VLANs tag traffic on server-facing ports
3. **VRF (routing):** Each VPC has isolated routing table on switches

### IPv4 vs DHCPv4 Subnets

**IPv4 Subnet (Static):**

```yaml
web-servers:
  subnet: 10.10.10.0/24
  gateway: 10.10.10.1
  vlan: 1010
  # No DHCP section = static IP assignment only
```

**Use cases:**
- Database servers (fixed IPs for connection strings)
- Load balancer backends (consistent targets)
- Servers you manage with tools like Ansible
- Services requiring DNS A records

**IP management:** You assign and track IPs manually (IP Address Management tools help at scale)

---

**DHCPv4 Subnet (Dynamic):**

```yaml
worker-nodes:
  subnet: 10.10.20.0/24
  gateway: 10.10.20.1
  vlan: 1020
  dhcp:
    enable: true
    range:
      start: 10.10.20.10
      end: 10.10.20.250
```

**Use cases:**
- Kubernetes worker nodes (ephemeral, autoscaling)
- Compute instances in cloud-like environments
- Testing/development servers (temporary)
- Any workload where IP doesn't need to be stable

**IP management:** Hedgehog DHCP server automatically assigns IPs from the range

**DHCP Range Considerations:**

- Reserve space outside the range for static assignments (e.g., .1-.9)
- Size range based on maximum expected servers
- Example: /24 subnet = 254 usable IPs
  - Gateway: .1
  - Static reservations: .2-.9 (8 IPs)
  - DHCP range: .10-.250 (241 IPs)
  - Broadcast: .255

**Can you mix static and DHCP in one subnet?**

Yes! Even with DHCP enabled, you can assign static IPs **outside** the DHCP range:

```yaml
subnet: 10.10.20.0/24
gateway: 10.10.20.1
dhcp:
  enable: true
  range:
    start: 10.10.20.100  # DHCP starts at .100
    end: 10.10.20.250    # DHCP ends at .250
# You can statically assign 10.10.20.2 - 10.10.20.99
```

### VPC CRD Deep Dive

**Key Spec Fields:**

```yaml
spec:
  ipv4Namespace: default        # Groups VPCs for IP allocation management
  vlanNamespace: default        # Groups VPCs for VLAN allocation management
  subnets:
    <subnet-name>:              # User-defined name (descriptive)
      subnet: 10.0.0.0/24       # CIDR block
      gateway: 10.0.0.1         # Default gateway IP
      vlan: 1000                # VLAN ID (manual or auto-assigned)
      dhcp:                     # Optional DHCP configuration
        enable: true
        range:
          start: 10.0.0.10
          end: 10.0.0.250
        pxeURL: http://...      # Optional PXE boot server
```

**Status Fields:**

VPC status is intentionally minimal. Most operational state lives in Agent CRDs (as you learned in Module 1.2).

```yaml
status:
  # Status fields are minimal or empty
  # After attachment, use affected Agent CRDs for switch state
```

**Why minimal status?**

- VPC is declarative intent (what you want)
- Agent CRDs contain switch operational state (what exists)
- This release does not emit VPC operation events; an empty Events section is inconclusive
- This separation keeps VPC definition clean and focused

**Auto-assigned VLANs:**

If you omit `vlan: <id>`, Hedgehog auto-assigns from the VLAN namespace pool:

```yaml
web-servers:
  subnet: 10.10.10.0/24
  gateway: 10.10.10.1
  # vlan: omitted - will be auto-assigned
```

**When to use auto-assignment:**
- Rapid prototyping (don't care about specific VLAN IDs)
- Avoiding VLAN conflicts in large fabrics
- Letting the system manage allocation

**When to manually specify:**
- Integrating with existing networks (must match specific VLANs)
- Regulatory compliance (VLAN-based auditing)
- Troubleshooting with external tools that expect specific VLANs

### Reconciliation for VPCs

**What happens when you `kubectl apply -f vpc.yaml`?**

**Step-by-step reconciliation:**

1. **Kubernetes API Server:** Stores VPC CRD in etcd
2. **Fabric Controller Watch:** Detects new/changed VPC
3. **Validation:** Controller validates spec (CIDR, VLAN ranges, namespace membership)
4. **Compute Configuration:** Controller determines:
   - Which switches need this VPC configuration
   - VXLAN VNI assignment
   - VLAN-to-VXLAN mappings
   - BGP EVPN route targets
5. **Before attachment:** No switch needs this VPC solely because the VPC object exists
6. **After attachment:** Controller writes the VPC and attachment into affected Agent specs
7. **Configuration Application:** Affected switch agents apply their changed specs
8. **Status Reporting:** Those Agents report `APPLIEDG == CURRENTG` when caught up

**Timeline:**

- VPC creation: < 1 second (Kubernetes write)
- Reconciliation: 5-15 seconds (depends on fabric size)
- Full propagation: 30-60 seconds (BGP convergence)

**When is a VPC "Ready"?**

Before attachment, confirm that `kubectl apply` succeeded and `kubectl get vpc webapp-prod -o yaml` contains the intended subnets. After Course 2.2 creates attachments, inspect those objects, the affected Agents' desired specs, and `APPLIEDG == CURRENTG`. An empty VPC Events section or minimal VPC status cannot substitute for those checks. Neither stage alone proves a server obtained a lease or passed traffic.

### VPC Naming Best Practices

**Important constraint:** VPC names must be **11 characters or fewer**. The fabric admission webhook enforces this limit.

**Good VPC names (≤ 11 chars):**

- `webapp-prod` (11) - Application name + environment
- `ml-train-dev` — too long (12); use `mltrain-dev` (11) instead
- `data-plane1` (11) - Function + identifier
- `acme-prod` (9) - Tenant + environment

**Avoid:**

- `web-app-prod` (12) — too long, will be rejected ❌
- `vpc-1` - Not descriptive
- `test` - Too generic
- `johns-vpc` - Owner names (people change roles)
- `10.10.10.0` - Using IP as name (IPs may change)

**Subnet naming:**

- Descriptive: `web-servers`, `worker-nodes`, `database-tier`
- Functional: `frontend`, `backend`, `storage`
- By role: `compute`, `control-plane`, `ingress`

**Namespace strategy:**

- **Single namespace:** Most deployments use `ipv4Namespace: default` and `vlanNamespace: default`
- **Multi-namespace:** For large organizations needing isolation:
  - By team: `ipv4Namespace: team-network`, `vlanNamespace: team-network`
  - By environment: `ipv4Namespace: production`, `vlanNamespace: production`
  - By region: `ipv4Namespace: us-west`, `vlanNamespace: us-west`

## Troubleshooting

### Issue: VPC creation or configuration fails

**Symptom:** `kubectl apply` is rejected, the VPC is absent, or its stored spec differs from the manifest

**Possible cause:** Configuration validation error or VLAN conflict

**Fix:**

```bash
# Read the actual API response and stored spec, if present
kubectl get vpc webapp-prod -o yaml

# An empty Events section is not proof of success or failure
kubectl describe vpc webapp-prod

# If VLAN conflict, change VLAN ID in YAML
# If subnet overlap, choose different subnet range
# Then reapply:
kubectl apply -f webapp-prod-vpc.yaml
```

### Issue: Subnet CIDR overlap error

**Symptom:** Error during apply: "subnet overlaps with existing VPC"

**Cause:** Another VPC already uses overlapping IP space

**Fix:**

```bash
# List all VPCs and their subnets
kubectl get vpcs -o yaml | grep -E "(name:|subnet:)"

# Example output:
#   name: existing-vpc
#     subnet: 10.10.0.0/16
#   name: webapp-prod
#     subnet: 10.10.10.0/24  # Overlaps with 10.10.0.0/16!

# Solution: Choose non-overlapping subnet
# Edit webapp-prod-vpc.yaml:
# Change: subnet: 10.10.10.0/24
# To:     subnet: 10.20.10.0/24

# Reapply:
kubectl apply -f webapp-prod-vpc.yaml
```

### Issue: DHCPv4 range too small

**Symptom:** Servers fail to get DHCP addresses, DHCP exhaustion warnings in logs

**Cause:** DHCP range doesn't accommodate number of servers

**Fix:**

```bash
# Calculate needed size:
# - Current range: .10 to .250 = 241 IPs
# - Needed: 300 servers

# Solution 1: Expand to /23 (512 IPs)
# Edit YAML:
#   subnet: 10.10.20.0/23      # was /24
#   gateway: 10.10.20.1
#   dhcp:
#     range:
#       start: 10.10.20.10
#       end: 10.10.21.250        # Now spans into .21.x range

# Solution 2: Use multiple subnets
# Create worker-nodes-2 subnet with additional DHCP range

# Reapply configuration:
kubectl apply -f webapp-prod-vpc.yaml
```

### Issue: "VPC not found" after creation

**Symptom:** `kubectl get vpc webapp-prod` returns "not found" immediately after apply

**Cause:** Wrong namespace or kubectl context

**Fix:**

```bash
# Check current namespace
kubectl config view --minify | grep namespace

# If empty, you're in default namespace - verify VPC namespace matches
cat webapp-prod-vpc.yaml | grep namespace

# List VPCs in all namespaces
kubectl get vpcs -A

# If VPC is in different namespace, specify it:
kubectl get vpc webapp-prod -n <namespace>

# Or set your default namespace:
kubectl config set-context --current --namespace=<namespace>
```

### Issue: VLAN ID conflict with existing infrastructure

**Symptom:** VPC applies but connectivity fails; external VLAN already in use

**Cause:** Specified VLAN conflicts with existing network infrastructure outside Hedgehog

**Fix:**

```bash
# If integrating with existing network, document VLAN usage
# Create a VLAN allocation spreadsheet or use IPAM tool

# Change VLAN to unused ID
# Edit webapp-prod-vpc.yaml:
#   vlan: 1010  # Change to unused VLAN, e.g., 2010

# Reapply:
kubectl apply -f webapp-prod-vpc.yaml

# If you don't care about specific VLAN, omit it entirely:
# Remove "vlan: 1010" line - Hedgehog will auto-assign
```

## Resources

### Hedgehog CRDs

**VPC** - Virtual Private Cloud definition

- View all: `kubectl get vpcs`
- View specific: `kubectl get vpc <name>`
- Inspect details: `kubectl describe vpc <name>`
- View YAML: `kubectl get vpc <name> -o yaml`
- Delete: `kubectl delete vpc <name>`

### kubectl Commands Reference

**VPC lifecycle:**

```bash
# Create or update VPC
kubectl apply -f vpc.yaml

# List VPCs
kubectl get vpcs

# List VPCs in all namespaces
kubectl get vpcs -A

# Get VPC details
kubectl describe vpc <name>

# View VPC in YAML format
kubectl get vpc <name> -o yaml

# View specific field (e.g., subnets)
kubectl get vpc <name> -o jsonpath='{.spec.subnets}' | jq

# Delete VPC
kubectl delete vpc <name>

# Delete VPC from file
kubectl delete -f vpc.yaml
```

**Event caveat:**

Kubernetes Events are useful for resources that emit them, but this Fabric release does not emit events for VPC operations. Do not wait for an event or infer success from an empty event list. Use the API response and stored VPC spec here, then the affected Agent specs and applied generations after attachment.

**Validation and troubleshooting:**

```bash
# Check the stored object and compare its spec with the manifest
kubectl get vpc <name> -o yaml

# View all VPCs with their subnets
kubectl get vpcs -o yaml | grep -E "(name:|subnet:)"

# Verify DHCP configuration
kubectl get vpc <name> -o jsonpath='{.spec.subnets.*.dhcp}' | jq
```

### Related Modules

- Previous: [Module 1.4: Course 1 Recap](../fabric-operations-foundations-recap/README.md)
- Next: Module 2.2: VPC Attachments (coming soon)
- Pathway: [Network Like a Hyperscaler](../../pathways/network-like-hyperscaler.json)

### External Documentation

- [Hedgehog VPC Documentation](https://docs.hedgehog.io/docs/concepts/vpc)
- [Hedgehog Fabric Guide](https://docs.hedgehog.io/)
- [Kubernetes Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)
- [Kubernetes Events](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/)
- [Understanding CIDR Notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing)

---

**Module Complete!** You've successfully learned VPC provisioning. Ready to attach servers to this VPC in Module 2.2.
