---
title: "Decommission & Cleanup"
slug: "fabric-operations-decommission-cleanup"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - decommission
  - cleanup
  - lifecycle
  - operations
description: "Learn safe decommissioning workflows for VPCs and VPCAttachments. Understand cleanup order, validation, and lifecycle management best practices."
order: 204
---

# Decommission & Cleanup

## Introduction

In Modules 2.1-2.3, you completed the provisioning workflow: creating the `web-app-prod` VPC, attaching two servers, and validating connectivity. Your infrastructure is operational and serving traffic. But what happens when it's time to decommission?

Every resource has a lifecycle—from creation to deletion. Proper decommissioning is as critical as proper provisioning. Delete resources in the wrong order, and you risk orphaned configurations, switch misconfigurations, or leaving resources that consume fabric capacity unnecessarily.

In this final module of Course 2, you'll learn safe decommissioning workflows: deleting VPCAttachments before VPCs, validating cleanup completion, and understanding when to keep versus delete resources. This completes the full Day 1 operations lifecycle: **Provision → Attach → Validate → Cleanup**.

## Learning Objectives

By the end of this module, you will be able to:

1. **Decommission VPCAttachments safely** - Remove server-to-VPC connections in correct order
2. **Decommission VPCs safely** - Delete VPCs after all attachments removed
3. **Validate cleanup completion** - Verify resources deleted and switches reconfigured
4. **Understand lifecycle management** - Know when to keep vs delete resources
5. **Apply Day 1 operations knowledge** - Complete the provisioning→validation→cleanup workflow

## Prerequisites

- Module 2.1 completion (VPC Provisioning Essentials)
- Module 2.2 completion (VPC Attachments)
- Module 2.3 completion (Connectivity Validation)
- Existing `web-app-prod` VPC with 2 VPCAttachments (from previous modules)
- kubectl access to Hedgehog fabric

## Scenario: Application Decommission

The `web-app-prod` application is being decommissioned after a successful migration to a new platform. Your task: safely remove the VPCAttachments and VPC without disrupting other fabric operations. You'll follow the proper cleanup order (attachments first, then VPC), validate each step, and verify the fabric returns to a clean state. This is your opportunity to complete the full lifecycle workflow and demonstrate Day 1 operations mastery.

## Lab Steps

### Step 1: Pre-Decommission Review

**Objective:** Identify resources to delete and understand current state

Before deleting anything, understand what you're removing and document the current state for validation.

List current VPCs:

```bash
kubectl get vpcs
```

Expected output (similar to):
```
NAME           AGE
web-app-prod   2h
```

List current VPCAttachments:

```bash
kubectl get vpcattachments
```

Expected output (similar to):
```
NAME                       AGE
server-01-web-servers      2h
server-05-worker-nodes     2h
```

Review what will be deleted:

**Resources to decommission:**
- **web-app-prod VPC** with 2 subnets:
  - web-servers (10.10.10.0/24, VLAN 1010)
  - worker-nodes (10.10.20.0/24, VLAN 1020, DHCP enabled)
- **server-01-web-servers VPCAttachment** (MCLAG connection to leaf-01/leaf-02)
- **server-05-worker-nodes VPCAttachment** (ESLAG connection to leaf-03/leaf-04)

Document current state for later validation:

```bash
# Save current VPC configuration
kubectl get vpc web-app-prod -o yaml > web-app-prod-backup.yaml

# List attachments for documentation
kubectl get vpcattachments -o wide
```

**Critical decommissioning order:**

```
1. Delete VPCAttachments FIRST (server-01-web-servers, server-05-worker-nodes)
2. Validate all attachments removed
3. Delete VPC LAST (web-app-prod)
4. Validate cleanup complete
```

**Success Criteria:**

- ✅ Identified all resources to delete (1 VPC, 2 VPCAttachments)
- ✅ Documented current state
- ✅ Understand decommissioning order: **Attachments → VPC**

### Step 2: Delete VPCAttachments (Must Delete First)

**Objective:** Remove server-to-VPC connections before deleting VPC

**CRITICAL RULE: Always delete VPCAttachments BEFORE deleting the VPC.**

VPCAttachments depend on the VPC they reference. Deleting the VPC first would leave orphaned attachments that reference a non-existent VPC, causing reconciliation errors.

Delete the first VPCAttachment (server-01):

```bash
kubectl delete vpcattachment server-01-web-servers
```

Expected output:
```
vpcattachment.vpc.githedgehog.com "server-01-web-servers" deleted
```

Delete the second VPCAttachment (server-05):

```bash
kubectl delete vpcattachment server-05-worker-nodes
```

Expected output:
```
vpcattachment.vpc.githedgehog.com "server-05-worker-nodes" deleted
```

Verify VPCAttachments are deleted:

```bash
# List all VPCAttachments (web-app resources should be gone)
kubectl get vpcattachments

# Specifically check for web-app attachments (should return empty)
kubectl get vpcattachments | grep web-app
```

Check cleanup reconciliation events:

```bash
# View events for attachment deletions
kubectl get events --sort-by='.lastTimestamp' | tail -20

# Look for events indicating cleanup reconciliation
```

**What happens during VPCAttachment deletion:**

1. Fabric controller detects VPCAttachment deletion
2. Identifies affected switches (leaf-01, leaf-02 for server-01; leaf-03, leaf-04 for server-05)
3. Computes cleanup configuration:
   - Remove VLAN from server-facing ports
   - Remove VXLAN tunnels (if no other VPCs using them)
   - Remove BGP EVPN routes
4. Updates Agent CRDs (removes config from Agent spec)
5. Switch agents apply cleanup (unconfigure ports)
6. VPCAttachment deleted from Kubernetes

**Wait for reconciliation to complete** (typically 10-30 seconds).

**Success Criteria:**

- ✅ Both VPCAttachments deleted successfully
- ✅ `kubectl get vpcattachments` shows no web-app resources
- ✅ Events show successful cleanup reconciliation
- ✅ No error events

### Step 3: Delete VPC (After Attachments Removed)

**Objective:** Remove VPC only after all attachments are gone

Before deleting the VPC, verify no attachments remain:

```bash
# Check for any remaining attachments referencing web-app-prod
kubectl get vpcattachments | grep web-app-prod

# Expected: No results (empty output)
```

**If any attachments remain, DO NOT proceed.** Delete them first.

Delete the VPC:

```bash
kubectl delete vpc web-app-prod
```

Expected output:
```
vpc.vpc.githedgehog.com "web-app-prod" deleted
```

Verify VPC deletion:

```bash
# Attempt to get the VPC (should return NotFound error)
kubectl get vpc web-app-prod
```

Expected output:
```
Error from server (NotFound): vpcs.vpc.githedgehog.com "web-app-prod" not found
```

This error is **expected and correct**—it confirms the VPC is deleted.

Check VPC cleanup events:

```bash
# View recent events
kubectl get events --sort-by='.lastTimestamp' | tail -20
```

List remaining VPCs to confirm:

```bash
# web-app-prod should not appear in this list
kubectl get vpcs
```

**What happens during VPC deletion:**

1. Fabric controller verifies no attachments exist (deletion would fail if attachments remain)
2. Removes VPC configuration:
   - VXLAN VNI released back to namespace pool
   - VLAN namespace entries removed
   - IP namespace entries removed
3. VPC deleted from Kubernetes

**Success Criteria:**

- ✅ VPC deleted successfully
- ✅ `kubectl get vpc web-app-prod` returns NotFound error
- ✅ Events show successful VPC cleanup
- ✅ No error events
- ✅ VPC no longer appears in `kubectl get vpcs`

### Step 4: Validate Cleanup Completion

**Objective:** Verify all resources deleted and switches reconfigured

Verify VPC completely removed:

```bash
# Should return NotFound error
kubectl get vpc web-app-prod
```

Verify VPCAttachments completely removed:

```bash
# web-app resources should be gone
kubectl get vpcattachments | grep web-app
```

Check Agent CRDs for switch cleanup:

```bash
# Check leaf-01 (should no longer have VLAN 1010 for server-01)
kubectl get agent leaf-01 -n fab -o yaml | grep -A 5 "1010"

# Check leaf-03 (should no longer have VLAN 1020 for server-05)
kubectl get agent leaf-03 -n fab -o yaml | grep -A 5 "1020"
```

**Expected result:** VLANs 1010 and 1020 should be removed from the relevant Agent CRDs, indicating switches have been reconfigured.

Verify no orphaned resources:

```bash
# List all VPCAttachments to ensure none reference deleted VPC
kubectl get vpcattachments -o yaml | grep "web-app-prod"

# Expected: No results
```

Review cleanup event timeline:

```bash
# View all recent events to see cleanup progression
kubectl get events --sort-by='.lastTimestamp' | tail -30
```

**Validation checklist:**

- ✅ VPC web-app-prod deleted (NotFound error when queried)
- ✅ VPCAttachments deleted (no web-app resources in list)
- ✅ Agent CRDs updated (VLANs removed from switch configurations)
- ✅ No orphaned resources
- ✅ Events show successful cleanup reconciliation
- ✅ Fabric returned to clean state

**Success Criteria:**

- ✅ All validation checks passed
- ✅ Fabric state clean (no web-app resources)
- ✅ Switches reconfigured (VLANs removed)
- ✅ No errors in cleanup process

### Step 5: Course 2 Completion - Full Lifecycle Review

**Objective:** Understand the complete Day 1 operations workflow

You've now completed the **entire Day 1 operations lifecycle** for Hedgehog Fabric:

**Module 2.1: Provision VPC**
- Created web-app-prod VPC with two subnets
- Configured IPv4 (static) and DHCPv4 subnets
- Learned VPC CRD structure and reconciliation

**Module 2.2: Attach Servers**
- Attached server-01 (MCLAG) to web-servers subnet
- Attached server-05 (ESLAG) to worker-nodes subnet
- Understood connection types and VPCAttachment workflow

**Module 2.3: Validate Connectivity**
- Validated VPC and VPCAttachment configurations
- Inspected Agent CRDs for switch-level state
- Learned event-based validation and troubleshooting

**Module 2.4: Decommission & Cleanup** (this module)
- Deleted VPCAttachments in correct order
- Deleted VPC after attachments removed
- Validated cleanup completion

**Complete Lifecycle:**

```
Provision → Attach → Validate → Operate → Decommission
```

**When to keep vs delete resources:**

**Keep resources when:**
- Application temporarily offline (maintenance, updates)
- Troubleshooting connectivity issues (keep for debugging)
- Resource reserved for future use
- Testing in progress (don't delete mid-test)

**Delete resources when:**
- Application permanently decommissioned
- Migration to new VPC complete
- Testing finished (dev/test environments)
- Resource no longer needed
- Cleaning up failed deployments

**Deletion impact:**

- **VPCAttachment deletion**: Server immediately loses VPC connectivity
- **VPC deletion**: All subnets, VLANs, and routing removed
- **Recovery**: Can re-create from YAML manifests (but auto-assigned VLANs may change)

**Production best practices:**

1. **Verify before deleting**: Confirm with application team
2. **Plan maintenance window**: Deletion causes immediate connectivity loss
3. **Document deletion**: Record why, when, who approved
4. **Check dependencies**: Ensure no other resources depend on VPC
5. **Validate after deletion**: Confirm cleanup completed successfully
6. **Save manifests**: Keep YAML backups for recovery if needed

**Success Criteria:**

- ✅ Understand complete Day 1 lifecycle workflow
- ✅ Know when to delete vs keep resources
- ✅ Understand deletion impact and recovery options
- ✅ Ready for production decommissioning tasks
- ✅ **Course 2 Complete!**

## Concepts & Deep Dive

### Decommissioning Order: Why Attachments First

**The Golden Rule: Always delete VPCAttachments BEFORE deleting VPCs.**

This order is not a best practice—it's a **requirement** for safe decommissioning.

**Why this order matters:**

**1. Dependency chain**

VPCAttachments depend on VPCs. Each VPCAttachment references a VPC and subnet:

```yaml
spec:
  connection: server-01--mclag--leaf-01--leaf-02
  subnet: web-app-prod/web-servers  # References VPC
```

If you delete the VPC first, VPCAttachments reference a non-existent VPC, causing reconciliation errors.

**2. Switch configuration order**

Server ports need to be unconfigured (VLANs removed) before the VPC configuration is removed from the fabric. Deleting the VPC first leaves switches partially configured.

**3. Orphaned resources**

Deleting the VPC first creates orphaned VPCAttachments that no longer serve any purpose but still exist in Kubernetes, consuming resources and causing confusion.

**4. Reconciliation failures**

The fabric controller cannot properly reconcile VPCAttachments without the parent VPC definition. Events will show errors, and manual cleanup becomes necessary.

**What happens if you delete VPC first?**

```bash
# DON'T DO THIS - Wrong order!
kubectl delete vpc web-app-prod  # VPC deleted
kubectl delete vpcattachment server-01-web-servers  # Attachment references deleted VPC
```

**Consequences:**
- VPCAttachments reference non-existent VPC
- Events show reconciliation errors: "VPC web-app-prod not found"
- Switch ports may not be properly unconfigured
- Manual cleanup required
- Agent CRDs may retain partial configuration

**Correct decommissioning order:**

```bash
# Step 1: Delete ALL VPCAttachments first
kubectl delete vpcattachment server-01-web-servers
kubectl delete vpcattachment server-05-worker-nodes

# Step 2: Verify all attachments deleted
kubectl get vpcattachments | grep web-app-prod  # Should be empty

# Step 3: Delete VPC
kubectl delete vpc web-app-prod

# Step 4: Validate cleanup complete
kubectl get vpc web-app-prod  # Should return NotFound
```

**Kubernetes safeguards:**

Kubernetes has some protections:
- If you attempt to delete a VPC with active attachments, the deletion may be blocked
- Finalizers prevent premature deletion in some cases

However, **don't rely on safeguards alone**. Follow the correct order as a matter of operational discipline.

### Cleanup Reconciliation Process

Understanding what happens during deletion helps troubleshoot cleanup issues.

**VPCAttachment deletion reconciliation:**

**1. Kubernetes receives delete request**

```bash
kubectl delete vpcattachment server-01-web-servers
```

Kubernetes marks the resource for deletion.

**2. Fabric Controller detects deletion**

The fabric controller watches for deleted VPCAttachment CRDs and picks up the deletion event.

**3. Identifies affected switches**

Controller determines which switches serve this connection:
- server-01 (MCLAG): leaf-01 and leaf-02
- server-05 (ESLAG): leaf-03 and leaf-04

**4. Computes cleanup configuration**

Controller calculates what needs to be removed:
- Remove VLAN from server-facing ports (e.g., VLAN 1010 from port E1/5)
- Remove VXLAN tunnels (if no other VPCs using the same VNI)
- Remove BGP EVPN routes for this VPC/subnet
- Remove DHCP relay configuration (if applicable)

**5. Updates Agent CRDs**

Controller removes configuration from affected Agent CRD specs:

```yaml
# Before deletion: Agent spec contains VLAN 1010
spec:
  ports:
    E1/5:
      mode: access
      vlan: 1010

# After deletion: VLAN 1010 removed from port config
spec:
  ports:
    E1/5:
      mode: disabled  # or removed entirely
```

**6. Switch agents apply cleanup**

Each switch agent (running on or for the switch):
- Watches its Agent CRD
- Detects spec change (VLAN removed)
- Applies configuration to physical switch via gNMI
- Unconfigures port, removes VLAN, updates routing

**7. VPCAttachment deleted**

Once reconciliation completes, the VPCAttachment is fully removed from Kubernetes.

**Timeline:**
- VPCAttachment deletion request: < 1 second
- Reconciliation: 10-30 seconds (depends on fabric size)
- Switch configuration cleanup: 10-20 seconds
- Full cleanup: 30-60 seconds

---

**VPC deletion reconciliation:**

**1. Kubernetes receives delete request**

```bash
kubectl delete vpc web-app-prod
```

**2. Fabric Controller verifies no attachments**

Controller checks if any VPCAttachments reference this VPC. If attachments exist, deletion may be blocked or delayed.

**3. Removes VPC configuration**

- **VXLAN VNI released**: VNI returned to namespace pool for reuse
- **VLAN namespace entries removed**: VLANs 1010 and 1020 freed
- **IP namespace entries removed**: Subnet CIDRs freed

**4. VPC deleted**

VPC removed from Kubernetes etcd.

**Timeline:**
- VPC deletion: < 5 seconds (namespace cleanup is fast)

### When to Keep vs Delete Resources

Decommissioning is not always the right choice. Understanding when to keep versus delete resources is critical for production operations.

**Keep resources when:**

**1. Application temporarily offline**
- Planned maintenance windows
- Software updates or patches
- Database migrations
- Temporary scaling down

**Why:** Re-creating VPCs and attachments later is more work than keeping them.

**2. Troubleshooting connectivity issues**
- Debugging network problems
- Investigating performance issues
- Testing configuration changes

**Why:** Deleting resources during troubleshooting eliminates evidence and makes root cause analysis harder.

**3. Resource reserved for future use**
- Pre-provisioned for upcoming deployment
- Capacity planning (staging environment ready)
- Reserved for specific team or project

**Why:** Reprovisioning later may result in different auto-assigned VLANs or other configuration drift.

**4. Testing in progress**
- Development environments with active work
- Integration tests running
- Performance benchmarks in flight

**Why:** Deleting mid-test invalidates results and wastes effort.

---

**Delete resources when:**

**1. Application permanently decommissioned**
- Service retired, no longer needed
- Business unit shut down
- Product end-of-life

**Why:** Keeping unused resources wastes fabric capacity and creates confusion.

**2. Migration to new VPC complete**
- Traffic cut over to new infrastructure
- Old VPC verified empty
- Rollback window passed

**Why:** No reason to keep old infrastructure after successful migration.

**3. Testing finished**
- Development testing complete
- Staging environment no longer needed
- Temporary test infrastructure

**Why:** Test environments should be ephemeral to free resources for other tests.

**4. Resource no longer needed**
- Over-provisioned capacity being scaled down
- Duplicate or redundant resources
- Misconfigured resources being replaced

**Why:** Clean up reduces operational complexity.

**5. Cleaning up failed deployments**
- VPC provisioned incorrectly (wrong subnets, VLANs)
- Attachments created in error
- Testing mistakes

**Why:** Start fresh rather than trying to fix broken configurations.

---

**Production decommissioning checklist:**

Before deleting resources in production, verify:

- [ ] Application team confirms decommission approved
- [ ] No active traffic to servers in VPC
- [ ] Maintenance window scheduled (deletion causes immediate connectivity loss)
- [ ] Backup of YAML manifests saved (for recovery if needed)
- [ ] Dependencies checked (no other resources depend on this VPC)
- [ ] Decommission documented (who, what, when, why)
- [ ] Post-deletion validation plan ready

### Deletion Impact and Recovery

**VPCAttachment deletion impact:**

**Immediate effects:**
- **Server connectivity**: Server immediately loses VPC connectivity
- **Active connections**: All active TCP/UDP connections dropped
- **Switch ports**: VLANs removed from server-facing ports within 10-30 seconds
- **No warning**: Deletion is immediate, no graceful shutdown

**What survives:**
- **Server OS configuration**: Server network config (static IPs, routes) unchanged
- **Server itself**: Server CRD and Connection CRD remain
- **VPC**: VPC still exists and can be attached to other servers

**Recovery:**
Re-create the VPCAttachment from YAML manifest:

```bash
kubectl apply -f server-01-attachment.yaml
```

Connectivity restores within 30-60 seconds after reconciliation.

---

**VPC deletion impact:**

**Immediate effects:**
- **All subnets deleted**: Every subnet in the VPC removed
- **All VLANs released**: VLANs returned to namespace pool for reuse
- **All routing removed**: VPC routing tables deleted from fabric
- **Cannot have attachments**: Deletion blocked if attachments exist

**What survives:**
- **Servers**: Server CRDs and Connection CRDs remain (can attach to other VPCs)
- **Switches**: Switch hardware unaffected, Agent CRDs updated

**Recovery:**
Re-create the VPC from YAML manifest:

```bash
kubectl apply -f web-app-prod-vpc.yaml
```

**Important recovery notes:**
- If VLANs were auto-assigned, new VLANs may differ (namespace reuses freed VLANs)
- All VPCAttachments must be re-created after VPC restored
- Full recovery time: 1-2 minutes (VPC creation + attachment reconciliation)

**Cannot delete VPC if attachments exist:**

```bash
kubectl delete vpc web-app-prod
# Error: VPC has active attachments
```

**Error message (example):**
```
Error: cannot delete VPC "web-app-prod": active VPCAttachments exist
```

**Solution:**
1. List all attachments: `kubectl get vpcattachments | grep web-app-prod`
2. Delete each attachment: `kubectl delete vpcattachment <name>`
3. Retry VPC deletion: `kubectl delete vpc web-app-prod`

### Orphaned Resources and Cleanup

**What are orphaned resources?**

Orphaned resources are Kubernetes objects that no longer serve a purpose but still exist, consuming resources and causing operational confusion.

**Common causes:**

1. **Deleting VPC before VPCAttachments** (most common)
   - VPCAttachments reference non-existent VPC
   - Reconciliation errors in events
   - Switch ports may retain partial configuration

2. **Manual switch configuration without CRD cleanup**
   - Direct switch CLI changes bypassing Hedgehog
   - Agent CRDs out of sync with switch reality

3. **Failed reconciliation leaving partial config**
   - Controller or agent pod crashed mid-reconciliation
   - Network issues during cleanup
   - Agent CRD spec updated but status not reflecting completion

**How to identify orphaned VPCAttachments:**

```bash
# List all VPCAttachments
kubectl get vpcattachments

# Check each attachment's VPC reference
kubectl get vpcattachment <name> -o yaml | grep "subnet:"

# Example orphaned attachment:
#   subnet: web-app-prod/web-servers  # VPC doesn't exist!
```

Verify the VPC exists:

```bash
kubectl get vpc web-app-prod
# Error from server (NotFound): vpcs.vpc.githedgehog.com "web-app-prod" not found
```

If VPC doesn't exist but VPCAttachment does, it's orphaned.

**How to clean up orphaned VPCAttachments:**

```bash
# Delete the orphaned VPCAttachment
kubectl delete vpcattachment server-01-web-servers

# Verify deletion
kubectl get vpcattachment server-01-web-servers
# Error from server (NotFound) - expected
```

Check Agent CRDs to ensure switch cleanup occurred:

```bash
kubectl get agent leaf-01 -n fab -o yaml | grep -A 5 "1010"
# Should not show VLAN 1010 configuration
```

**Prevention strategies:**

1. **Always follow correct deletion order** (attachments → VPC)
2. **Validate cleanup after each deletion**
3. **Use GitOps** (Git is source of truth, prevents manual errors)
4. **Monitor events** for reconciliation errors
5. **Avoid manual switch configuration** (use Hedgehog CRDs only)

## Troubleshooting

### Issue: Cannot delete VPC - "VPC has active attachments"

**Symptom:** `kubectl delete vpc web-app-prod` fails with error message

**Error message:**
```
Error: cannot delete VPC "web-app-prod": active VPCAttachments exist
```

**Cause:** One or more VPCAttachments still reference the VPC

**Fix:**

```bash
# Step 1: List all VPCAttachments
kubectl get vpcattachments

# Step 2: Identify attachments referencing this VPC
kubectl get vpcattachments -o yaml | grep "web-app-prod"

# Example output:
#   subnet: web-app-prod/web-servers
#   subnet: web-app-prod/worker-nodes

# Step 3: Delete each attachment
kubectl delete vpcattachment server-01-web-servers
kubectl delete vpcattachment server-05-worker-nodes

# Step 4: Verify all attachments deleted
kubectl get vpcattachments | grep web-app-prod
# Should return empty

# Step 5: Retry VPC deletion
kubectl delete vpc web-app-prod

# Should succeed now
```

### Issue: VPCAttachment deleted but switch ports not cleaned up

**Symptom:** Agent CRD still shows VLAN configuration after VPCAttachment deleted

**Example:**
```bash
kubectl get agent leaf-01 -n fab -o yaml | grep "1010"
# Still shows VLAN 1010 configuration even though attachment deleted
```

**Cause:** Reconciliation not complete, or agent pod issue

**Fix:**

```bash
# Step 1: Wait for reconciliation to complete (30-60 seconds)
sleep 60

# Step 2: Check again
kubectl get agent leaf-01 -n fab -o yaml | grep "1010"

# Step 3: If still present, check agent pod status
kubectl get pods -n fab | grep agent

# Step 4: Check agent logs for errors
kubectl logs <agent-pod-name> -n fab | tail -50

# Step 5: Check events for reconciliation progress
kubectl get events -n fab --sort-by='.lastTimestamp' | tail -20

# Step 6: If agent pod crashed, restart it
kubectl delete pod <agent-pod-name> -n fab
# Pod will restart and reapply configuration

# Step 7: Verify cleanup after restart
kubectl get agent leaf-01 -n fab -o yaml | grep "1010"
```

### Issue: Orphaned VPCAttachment after VPC accidentally deleted

**Symptom:** VPCAttachment exists but references non-existent VPC

**Example:**
```bash
kubectl get vpcattachment server-01-web-servers
# NAME                      AGE
# server-01-web-servers     3h

kubectl describe vpcattachment server-01-web-servers
# Shows error: VPC "web-app-prod" not found
```

**Cause:** VPC deleted before attachments (wrong order)

**Fix:**

```bash
# Step 1: Confirm VPC is gone
kubectl get vpc web-app-prod
# Error from server (NotFound) - confirms VPC deleted

# Step 2: Delete orphaned VPCAttachment
kubectl delete vpcattachment server-01-web-servers

# Step 3: Verify deletion
kubectl get vpcattachment server-01-web-servers
# Error from server (NotFound) - expected

# Step 4: Check for other orphaned attachments
kubectl get vpcattachments -o yaml | grep "web-app-prod"
# Should return nothing

# Step 5: Verify switch cleanup
kubectl get agent leaf-01 -n fab -o yaml | grep "1010"
# VLAN 1010 should be removed
```

**Prevention:** Always delete VPCAttachments BEFORE VPC.

### Issue: VPC deletion stuck in "Terminating" state

**Symptom:** `kubectl get vpc` shows VPC in Terminating state for extended time

**Example:**
```bash
kubectl get vpcs
# NAME           STATUS        AGE
# web-app-prod   Terminating   5m
```

**Cause:** Finalizers preventing deletion, or controller issue

**Fix:**

```bash
# Step 1: Check VPC for finalizers
kubectl get vpc web-app-prod -o yaml | grep finalizers -A 5

# Step 2: Check events for errors
kubectl get events --field-selector involvedObject.name=web-app-prod --sort-by='.lastTimestamp'

# Step 3: Verify no attachments exist
kubectl get vpcattachments | grep web-app-prod
# Should be empty - if not, delete attachments

# Step 4: Check fabric controller pod
kubectl get pods -n fab | grep controller
kubectl logs <controller-pod-name> -n fab | tail -50

# Step 5: If finalizers blocking, remove them (advanced - use caution)
kubectl patch vpc web-app-prod -p '{"metadata":{"finalizers":[]}}' --type=merge

# Step 6: Verify deletion completes
kubectl get vpc web-app-prod
# Should return NotFound
```

**Note:** Removing finalizers manually should be a last resort. Usually waiting or restarting the controller resolves the issue.

### Issue: Accidentally deleted VPC - can I recover it?

**Symptom:** VPC deleted by mistake, need to restore

**Cause:** Human error, wrong VPC name, accidental command

**Fix:**

```bash
# Step 1: Check if you have a backup YAML manifest
ls -la web-app-prod-vpc.yaml

# If you saved the YAML earlier:
kubectl apply -f web-app-prod-vpc.yaml

# If you don't have the YAML, you'll need to recreate from scratch

# Step 2: Recreate VPC manually
cat > web-app-prod-vpc.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: web-app-prod
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

kubectl apply -f web-app-prod-vpc.yaml

# Step 3: Verify VPC created
kubectl get vpc web-app-prod

# Step 4: Recreate VPCAttachments
kubectl apply -f server-01-attachment.yaml
kubectl apply -f server-05-attachment.yaml

# Step 5: Validate connectivity (Module 2.3)
kubectl describe vpc web-app-prod
kubectl describe vpcattachment server-01-web-servers
```

**Important notes:**
- If VLANs were auto-assigned originally, new assignment may differ
- All VPCAttachments must be recreated after VPC restored
- Recovery time: 1-2 minutes for full reconciliation
- **Prevention:** Always save YAML manifests before deletion (or use GitOps)

### Issue: Server still has connectivity after VPCAttachment deleted

**Symptom:** Server can still reach network after VPCAttachment deleted

**Example:**
```bash
# VPCAttachment deleted
kubectl get vpcattachment server-01-web-servers
# Error from server (NotFound)

# But server still has network connectivity
# SSH to server: ping 10.10.10.1 works
```

**Cause:** Server OS network configuration not changed (static IP remains)

**Explanation:**

VPCAttachment deletion removes **fabric-side configuration** (VLANs on switch ports, VXLAN tunnels, routing). It does NOT change **server-side configuration** (IP addresses, routes in server OS).

The server still has the IP address and routes configured in its operating system, but:
- The fabric is no longer forwarding traffic for that VLAN
- Server cannot reach other servers in the VPC
- Server cannot reach resources outside the VPC

**This is expected behavior.**

**Fix (if you want to remove server network config):**

```bash
# SSH to server
ssh server-01

# Remove IP address
sudo ip addr del 10.10.10.10/24 dev eth0

# Remove default route
sudo ip route del default via 10.10.10.1

# Verify connectivity gone
ping 10.10.10.1
# Should fail: Network is unreachable
```

**In production:** Server OS configuration is typically managed separately (Ansible, configuration management tools). VPCAttachment manages fabric config only.

## Resources

### Hedgehog CRDs

**VPC** - Virtual Private Cloud definition

- View all: `kubectl get vpcs`
- Delete: `kubectl delete vpc <name>`
- View YAML: `kubectl get vpc <name> -o yaml`

**VPCAttachment** - Binds server connection to VPC subnet

- View all: `kubectl get vpcattachments`
- Delete: `kubectl delete vpcattachment <name>`
- View YAML: `kubectl get vpcattachment <name> -o yaml`

**Agent** - Per-switch operational state (for cleanup validation)

- View all: `kubectl get agents -n fab`
- View specific: `kubectl get agent <switch-name> -n fab -o yaml`
- Validate cleanup: Check for removed VLANs after deletion

**Connection** - Server-to-switch wiring (not deleted in this module)

- View all: `kubectl get connections -n fab`
- Note: Connections persist after VPCAttachment deletion

### kubectl Commands Reference

**Decommissioning workflow:**

```bash
# Step 1: Pre-decommission review
kubectl get vpcs
kubectl get vpcattachments
kubectl get vpc <name> -o yaml > backup.yaml  # Save backup

# Step 2: Delete VPCAttachments FIRST
kubectl delete vpcattachment <name>

# Step 3: Verify attachments deleted
kubectl get vpcattachments | grep <vpc-name>  # Should be empty

# Step 4: Delete VPC
kubectl delete vpc <name>

# Step 5: Verify VPC deleted
kubectl get vpc <name>  # Should return NotFound

# Step 6: Validate cleanup
kubectl get events --sort-by='.lastTimestamp' | tail -20
kubectl get agent <switch-name> -n fab -o yaml | grep <vlan>
```

**Event monitoring during cleanup:**

```bash
# View recent events
kubectl get events --sort-by='.lastTimestamp' | tail -20

# Watch events in real-time
kubectl get events --watch

# View events for specific resource
kubectl get events --field-selector involvedObject.name=<resource-name>

# View events in fab namespace (agents)
kubectl get events -n fab --sort-by='.lastTimestamp'
```

**Validation commands:**

```bash
# Verify resource deleted (should return NotFound)
kubectl get vpc <name>
kubectl get vpcattachment <name>

# List all resources to confirm deletion
kubectl get vpcs
kubectl get vpcattachments

# Check Agent CRD for cleanup
kubectl get agent <switch-name> -n fab -o yaml | grep -A 5 "<vlan-id>"
```

**Recovery commands:**

```bash
# Restore from backup YAML
kubectl apply -f backup.yaml

# Recreate VPCAttachments
kubectl apply -f attachment.yaml
```

### Related Modules

- Previous: [Module 2.3: Connectivity Validation](./module-2.3-connectivity-validation.md)
- Module 2.1: [VPC Provisioning Essentials](./module-2.1-vpc-provisioning.md)
- Module 2.2: [VPC Attachments](./module-2.2-vpc-attachments.md)
- **Course 2 Complete!** Preview Course 3: Observability & Fabric Health

### External Documentation

- [Hedgehog VPC Documentation](https://docs.hedgehog.io/)
- [Hedgehog Lifecycle Management](https://docs.hedgehog.io/)
- [Kubernetes Resource Deletion](https://kubernetes.io/docs/concepts/architecture/garbage-collection/)
- [kubectl delete Command Reference](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_delete/)

---

**Module Complete!** You've successfully learned safe decommissioning workflows and completed Course 2: Provisioning & Day 1 Operations. You now understand the full lifecycle: Provision → Attach → Validate → Cleanup. Ready to move on to Course 3: Observability & Fabric Health!

**Course 2 Achievement Unlocked:** Day 1 Operations Master
