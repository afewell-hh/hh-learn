---
title: "Rollback & Recovery"
slug: "fabric-operations-rollback-recovery"
difficulty: "intermediate"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - rollback
  - recovery
  - gitops
  - kubernetes
  - finalizers
description: "Master GitOps rollback workflows, safe resource deletion order, Kubernetes finalizers, and partial failure recovery using Git revert and ArgoCD."
order: 402
---

## Introduction

In Module 4.1, you diagnosed issues using systematic troubleshooting methodology. You formed hypotheses, collected evidence, and identified root causes.

But sometimes, diagnosis reveals that **the change itself was the problem.**

### When You Need to Undo

Consider these scenarios:

**Scenario 1: VLAN Conflict**
- You updated VPC `webapp-vpc` frontend subnet to use VLAN 1050
- This caused a VLAN conflict with another VPC
- Result: Connectivity broken for 20 web servers

**Scenario 2: Peering Breaks Isolation**
- You created a VPCPeering between `production` and `development` VPCs
- Security policy requires strict isolation
- Result: Unexpected cross-environment traffic

**Scenario 3: DHCP Misconfiguration**
- You modified DHCP settings, reducing the IP range
- Existing servers lost their leases
- Result: Servers cannot obtain IP addresses

In these cases, you need to **rollback the change**—quickly, safely, and completely.

### Why GitOps Rollback?

Beginners might panic and manually delete resources with kubectl. This causes:
- **No audit trail** - Who changed what? When? Why?
- **Configuration drift** - Git no longer matches cluster state
- **Incomplete rollback** - Easy to miss dependent resources
- **No reproducibility** - Can't repeat the rollback if needed

Experts use **GitOps rollback workflows** that provide:
- **Audit trail** - Git commit history shows exactly what changed and why
- **Reproducibility** - Rollback procedure can be repeated if needed
- **Safety** - ArgoCD ensures consistent state between Git and cluster
- **Testability** - Can review rollback diff before applying

### What You'll Learn

**GitOps Rollback Workflow:**
- Using `git revert` to create rollback commits (preserves history)
- Triggering ArgoCD sync to apply rollback
- Verifying recovery in kubectl and Grafana
- Understanding when rollback is appropriate

**Safe Deletion Order:**
- Why order matters (dependencies and finalizers)
- Correct sequence: VPCAttachment → VPCPeering → VPC
- Avoiding stuck resources during deletion
- Verifying cleanup completed successfully

**Kubernetes Finalizers:**
- What finalizers are and why they exist
- How finalizers protect against incomplete deletion
- Diagnosing stuck resources (resources in "Terminating" state)
- When manual finalizer removal is appropriate (last resort)

**Partial Failure Recovery:**
- Handling stuck resources (Agent disconnected, reconciliation timeout)
- ArgoCD sync failures (invalid YAML, dependency missing)
- Reconciliation timeouts (controller resource constraints)
- Emergency procedures (when to escalate vs. self-resolve)

### Module Scenario

You'll perform a rollback of a VPC configuration change that caused VLAN conflicts:
- Identify and revert the problematic Git commit
- Trigger ArgoCD sync to apply the rollback
- Verify connectivity restored with kubectl and Grafana
- (Bonus) Practice safe VPCAttachment deletion

By the end of this module, you'll have the skills to safely undo changes and recover from failures using GitOps best practices.

---

## Learning Objectives

By the end of this module, you will be able to:

1. **Execute safe rollback procedures** - Use Git revert and ArgoCD sync to undo configuration changes
2. **Understand Kubernetes finalizers** - Explain how finalizers protect against incomplete deletion
3. **Follow safe deletion order** - Delete resources in correct dependency order (VPCAttachment → VPC → namespace resources)
4. **Recover from partial failures** - Handle stuck resources, finalizer issues, and reconciliation timeouts
5. **Identify escalation triggers** - Recognize when rollback/recovery requires support intervention

---

## Prerequisites

Before starting this module, you should have:

**Completed Modules:**
- Module 4.1: Diagnosing Fabric Issues (hypothesis-driven troubleshooting)
- Module 1.2: GitOps Workflow (Git operations, ArgoCD sync)
- Course 2: Provisioning & Connectivity (VPC lifecycle experience)

**Understanding:**
- Basic Git operations (commit, push, diff)
- kubectl resource management
- VPC and VPCAttachment dependencies
- How finalizers work in Kubernetes

**Environment:**
- kubectl configured and authenticated
- Gitea access (http://localhost:3001)
- ArgoCD access (http://localhost:8080)
- Grafana access (http://localhost:3000)

---

## Scenario

**Incident Background:**

Earlier today, you updated VPC `webapp-vpc` to change the `frontend` subnet VLAN from 1010 to 1050. The change was committed to Git and synced via ArgoCD successfully.

**Problem Discovered:**

VLAN 1050 is already in use by another VPC (`customer-app-vpc`). The change caused a VLAN conflict, breaking connectivity for 20 web servers in `webapp-vpc`.

**Your Task:**

Perform a GitOps rollback to restore connectivity:
1. Revert the problematic Git commit (VLAN 1010 → 1050)
2. Sync the rollback through ArgoCD
3. Verify connectivity restored
4. (Bonus) Practice safe resource deletion procedures

**Success Criteria:**
- Git history shows revert commit (audit trail preserved)
- ArgoCD synced successfully
- `webapp-vpc` frontend subnet using VLAN 1010 again
- Connectivity verified in kubectl and Grafana
- No configuration drift (Git matches cluster)

---

## Core Concepts & Deep Dive

### Concept 1: GitOps Rollback Workflow

#### Why GitOps Rollback?

**Traditional rollback approach:**
- Manually edit resources with kubectl
- Hope you remember the old configuration
- No audit trail of the rollback action
- Risk of configuration drift (Git ≠ cluster)

**GitOps rollback approach:**
- **Git history is the source of truth**
- Every change is a commit with full context
- Rollback = create new revert commit
- ArgoCD ensures cluster matches Git

#### Benefits of GitOps Rollback

**Audit Trail:**
- Git history shows who changed what, when, and why
- Rollback commits documented alongside original changes
- Can trace configuration evolution over time

**Reproducible:**
- Same rollback procedure every time
- Can apply to multiple environments
- Can be automated with scripts or CI/CD

**Safe:**
- ArgoCD validates configuration before applying
- Kubernetes admission controllers check resource validity
- Can review diff before committing rollback

**Testable:**
- Can use `git diff` to review changes before push
- Can test rollback in non-production environment first
- Can use `kubectl apply --dry-run` to validate

#### GitOps Rollback Procedure (5 Steps)

##### Step 1: Identify Problematic Commit

```bash
# View recent Git history
cd /path/to/hedgehog-config
git log --oneline --graph --decorate -10

# Example output:
# a1b2c3d (HEAD -> main) Update webapp-vpc VLAN to 1050
# e4f5g6h Fix DHCP range for vpc-staging
# i7j8k9l Add VPCPeering between prod and staging
```

**Identify commit to revert:** `a1b2c3d` (VPC VLAN change that caused conflict)

**Tips for identifying the right commit:**
- Look for commit message describing the problematic change
- Check commit timestamp (when did the issue start?)
- Use `git show <commit-hash>` to review the diff
- Look for changes to VPC, VPCAttachment, or VPCPeering resources

##### Step 2: Revert the Commit (Git)

```bash
# Revert the specific commit
git revert a1b2c3d

# Git creates NEW commit that undoes changes from a1b2c3d
# Opens editor for commit message (default: "Revert 'Update webapp-vpc VLAN to 1050'")
```

**Important:** `git revert` creates a **new commit** that undoes changes. It doesn't delete history (good for audit trail).

**Edit commit message to provide context:**

```
Revert "Update webapp-vpc VLAN to 1050"

This reverts commit a1b2c3d.

Reason: VLAN 1050 conflicts with customer-app-vpc, causing
connectivity failure for 20 webapp servers.

Rollback restores VLAN 1010 to restore connectivity.

Incident: INC-2025-10-17-001
```

**Review the revert diff before committing:**

```bash
# View diff of what will be reverted
git show HEAD

# Expected output shows VLAN changing from 1050 back to 1010
```

**Push to remote:**

```bash
git push origin main
```

##### Step 3: Trigger ArgoCD Sync

ArgoCD polls Git repository (default: every 3 minutes). You can wait or trigger manually for faster recovery.

**Option A: Wait for Auto-Sync**

```bash
# Watch ArgoCD status
kubectl get applications -n argocd -w

# Expected: hedgehog-config status changes:
# "Synced" → "OutOfSync" → "Syncing" → "Synced"
```

**Option B: Manual Sync (Faster) - ArgoCD UI**

1. Open ArgoCD: http://localhost:8080
2. Click `hedgehog-config` application
3. Click **"Sync"** button
4. Review sync diff (shows VLAN 1050 → 1010)
5. Click **"Synchronize"**
6. Watch sync progress until status shows "Synced" (green checkmark)

**Option C: Manual Sync - ArgoCD CLI**

```bash
# Trigger sync
argocd app sync hedgehog-config

# Wait for sync completion
argocd app wait hedgehog-config --health

# Expected output: "Application hedgehog-config synced successfully"
```

##### Step 4: Verify Rollback

**Check VPC configuration:**

```bash
# Verify VLAN reverted to original value
kubectl get vpc webapp-vpc -o jsonpath='{.spec.subnets.frontend.vlan}'
# Expected output: 1010

# Check full VPC configuration
kubectl get vpc webapp-vpc -o yaml | grep -A 10 "frontend:"
```

**Check events:**

```bash
# Check recent events for webapp-vpc
kubectl get events --field-selector involvedObject.name=webapp-vpc --sort-by='.lastTimestamp'

# Expected events:
# Normal  VPCUpdated       VPC configuration reconciled
# Normal  VLANUpdated      VLAN changed from 1050 to 1010

# Verify no errors
kubectl get events --field-selector type=Warning | grep webapp-vpc
# Expected: No Warning events
```

**Verify Agent CRD (switch configuration):**

```bash
# Check which switches have webapp-vpc attachments
kubectl get vpcattachment | grep webapp-vpc

# Check Agent CRD for switch interface configuration
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# Expected: VLAN 1010 in vlans list (not 1050)
```

##### Step 5: Validate Connectivity

**Check Grafana:**

1. Open Fabric Dashboard
2. Navigate to VPC metrics section
3. Verify `webapp-vpc` shows VLAN 1010
4. Verify no VLAN conflicts
5. Check Interface Dashboard: Verify traffic flowing on webapp-vpc interfaces

**Test connectivity (if server access available):**

```bash
# SSH to affected server or use kubectl exec
# Ping gateway
ping -c 4 10.10.1.1

# Expected: 0% packet loss

# Ping another server in VPC
ping -c 4 10.10.1.10

# Expected: 0% packet loss
```

#### GitOps Rollback Complete

**Success indicators:**
- ✅ Git history shows revert commit (audit trail)
- ✅ ArgoCD synced cluster to match Git
- ✅ kubectl shows reverted configuration
- ✅ Grafana confirms VPC healthy
- ✅ Connectivity validated

**What you've accomplished:**
- Safe rollback with full audit trail
- No configuration drift (Git = cluster)
- Reproducible procedure for future rollbacks
- Documented reason for rollback in Git commit

---

### Concept 2: Safe Deletion Order

#### Why Order Matters

Hedgehog resources have **dependencies**:
- VPCAttachment depends on VPC (references VPC subnet)
- VPC depends on IPv4Namespace and VLANNamespace
- VPCPeering depends on both VPCs
- DHCPSubnet depends on VPC (auto-created)

**Deleting in wrong order causes:**
- **Stuck resources** - Finalizers prevent deletion until dependencies resolved
- **Orphaned configurations** - Switch VLANs not cleaned up properly
- **Partial failures** - Some resources deleted, others remain in "Terminating" state

**Analogy:** Deleting a building before removing the furniture. The building can't be demolished until everything inside is cleared out first.

#### Safe Deletion Order (General Rule)

**Delete from leaves to roots (children before parents):**

```
1. VPCAttachment (depends on VPC + Connection)
   ↓
2. VPCPeering (depends on VPCs)
   ↓
3. ExternalPeering (depends on VPC + External)
   ↓
4. VPC (depends on IPv4Namespace + VLANNamespace)
   ↓
5. External resources (if no longer needed)
   ↓
6. Namespaces (IPv4Namespace, VLANNamespace) - rarely deleted
```

**Dependency diagram:**

```
IPv4Namespace, VLANNamespace (root)
         ↓
       VPC (parent)
      /   |   \
     /    |    \
VPCAttachment VPCPeering ExternalPeering (children)
```

**Rule of thumb:** If resource A references resource B in its spec, delete A before B.

#### Example: Delete VPC and Attachments

**❌ Wrong Order (Causes Problems):**

```bash
# Delete VPC first (WRONG!)
kubectl delete vpc vpc-prod

# Result: VPC stuck in "Terminating" state for minutes or hours
# Reason: VPCAttachments still reference VPC (finalizers prevent deletion)

kubectl get vpc vpc-prod
# Output: vpc-prod ... Terminating ... (stuck)
```

**✅ Correct Order:**

```bash
# Step 1: List and delete all VPCAttachments
kubectl get vpcattachment | grep vpc-prod
# Output: vpc-prod-server-01, vpc-prod-server-02, vpc-prod-server-03

kubectl delete vpcattachment vpc-prod-server-01
kubectl delete vpcattachment vpc-prod-server-02
kubectl delete vpcattachment vpc-prod-server-03

# Wait for deletion to complete (watch for finalizer removal)
kubectl get vpcattachment | grep vpc-prod
# Expected: No results (all deleted)

# Step 2: Delete VPCPeerings (if any)
kubectl get vpcpeering | grep vpc-prod
# Output: vpc-prod--vpc-staging

kubectl delete vpcpeering vpc-prod--vpc-staging

# Wait for deletion
kubectl get vpcpeering vpc-prod--vpc-staging
# Expected: Error: not found

# Step 3: Delete VPC
kubectl delete vpc vpc-prod

# Wait for deletion (should complete in <30 seconds if dependencies cleared)
kubectl get vpc vpc-prod
# Expected: Error: "vpc.vpc.githedgehog.com "vpc-prod" not found"
```

#### Verification After Deletion

**Check for orphaned resources:**

```bash
# Verify DHCPSubnets auto-deleted with VPC
kubectl get dhcpsubnet -n default | grep vpc-prod
# Expected: No results

# Check Agent CRD - VLAN removed from switches
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# Expected: VLAN no longer in vlans list for interfaces that had VPCAttachments
```

**Check Grafana:**

1. Open Fabric Dashboard
2. Verify VPC count decreased by 1
3. Check Interface Dashboard: VLAN removed from relevant interfaces
4. No error events in Logs Dashboard

#### Decision Tree: Safe Deletion

```
Need to delete VPC?
  │
  ├─ Check for VPCAttachments
  │    │
  │    ├─ VPCAttachments exist?
  │    │    ├─ YES → Delete VPCAttachments first (Step 1)
  │    │    └─ NO → Continue to Step 2
  │
  ├─ Check for VPCPeerings
  │    │
  │    ├─ VPCPeerings exist?
  │    │    ├─ YES → Delete VPCPeerings (Step 2)
  │    │    └─ NO → Continue to Step 3
  │
  ├─ Check for ExternalPeerings
  │    │
  │    ├─ ExternalPeerings exist?
  │    │    ├─ YES → Delete ExternalPeerings (Step 3)
  │    │    └─ NO → Continue to Step 4
  │
  └─ Delete VPC (Step 4)
       │
       └─ Verify deletion completed (<30 seconds)
```

---

### Concept 3: Kubernetes Finalizers

#### What Are Finalizers?

Finalizers are **hooks that prevent resource deletion** until cleanup actions complete.

**Analogy:** Like a lock on a door. You can't delete the resource until the finalizer (lock) is removed by the controller.

**Example VPC with finalizer:**

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: vpc-prod
  namespace: default
  finalizers:
    - vpc.githedgehog.com/finalizer  # Prevents deletion until removed
spec:
  ...
```

#### Finalizer Purpose

Finalizers ensure:
1. **Dependencies deleted first** - VPCAttachments removed before VPC
2. **Switch configurations cleaned up** - VLANs removed from interfaces
3. **Associated resources deleted** - DHCPSubnets auto-deleted with VPC
4. **No orphaned state** - Controller can verify cleanup completed

**Without finalizers:**
- VPC could be deleted while VPCAttachments still exist
- Switch VLANs would remain configured (orphaned)
- DHCPSubnets would remain (orphaned)
- Cluster state inconsistent with Git

**With finalizers:**
- Controller ensures dependencies removed first
- Controller cleans up switch configurations
- Controller removes finalizer only after cleanup succeeds
- Safe deletion with no orphaned resources

#### Finalizer Workflow

**Step 1: User deletes resource**

```bash
kubectl delete vpc vpc-prod
```

**Step 2: Kubernetes sets deletionTimestamp**

```yaml
metadata:
  name: vpc-prod
  deletionTimestamp: "2025-10-17T10:30:00Z"  # Marked for deletion
  finalizers:
    - vpc.githedgehog.com/finalizer  # Still present
```

Resource enters **"Terminating" state**. It's marked for deletion but not yet removed from etcd.

**Step 3: Controller processes finalizer**

Controller sees deletionTimestamp and performs cleanup:
- Checks if VPCAttachments still exist (if yes, wait)
- Cleans up switch configurations (removes VLANs from interfaces)
- Deletes DHCPSubnets
- Verifies cleanup completed successfully

**Step 4: Controller removes finalizer**

```yaml
metadata:
  finalizers: []  # Finalizer removed (lock unlocked)
```

**Step 5: Kubernetes completes deletion**

Resource fully deleted from etcd. Resource no longer exists.

```bash
kubectl get vpc vpc-prod
# Error: "vpc.vpc.githedgehog.com "vpc-prod" not found"
```

#### Stuck Resources (Finalizer Not Removed)

**Symptom:**

```bash
kubectl get vpc vpc-prod
# Output: vpc-prod ... Terminating ... (stuck for 10+ minutes)
```

**Diagnosis:**

```bash
# Check if finalizers still present
kubectl get vpc vpc-prod -o jsonpath='{.metadata.finalizers}'
# Output: ["vpc.githedgehog.com/finalizer"]

# Check deletionTimestamp
kubectl get vpc vpc-prod -o jsonpath='{.metadata.deletionTimestamp}'
# Output: 2025-10-17T10:30:00Z (10 minutes ago)

# Check controller logs for errors
kubectl logs -n fab deployment/fabric-controller-manager | grep vpc-prod

# Look for errors preventing finalizer removal
```

**Common causes:**

1. **VPCAttachments still exist**
   - Controller waiting for VPCAttachments to be deleted first
   - Solution: Delete VPCAttachments manually

2. **Controller cannot reach switches**
   - Agent disconnected, controller can't clean up switch VLANs
   - Solution: Wait for Agent to reconnect, or escalate

3. **Controller error during cleanup**
   - Bug, resource exhaustion, or unexpected error
   - Solution: Check controller logs, restart controller if needed

#### Recovery: Remove Finalizer Manually (Last Resort)

**⚠️ WARNING: Only do this if:**
- VPCAttachments confirmed deleted
- Controller logs show cleanup completed (or Agent disconnected)
- Resource stuck for >30 minutes
- Support has recommended manual finalizer removal

**Manual finalizer removal:**

```bash
# Remove finalizer to force deletion
kubectl patch vpc vpc-prod --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# Resource immediately deleted
kubectl get vpc vpc-prod
# Expected: Error: not found
```

**⚠️ Caution:** Manually removing finalizers can leave orphaned switch configurations. Only use as emergency procedure after confirming:
1. Dependencies deleted (VPCAttachments, VPCPeerings)
2. Controller logs show cleanup completed (or Agent disconnected preventing cleanup)
3. Waited >30 minutes for controller to remove finalizer automatically

**After manual finalizer removal:**

```bash
# Verify switch configurations cleaned up
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# Check for orphaned VLANs
# If found, may need manual switch cleanup (escalate to support)
```

---

### Concept 4: Partial Failure Recovery

#### Scenario 1: Stuck VPCAttachment (Agent Disconnected)

**Symptoms:**
- VPCAttachment stuck in "Terminating" state for >5 minutes
- Agent for the switch is offline
- Finalizer prevents deletion

**Diagnosis:**

```bash
# Check VPCAttachment status
kubectl get vpcattachment vpc-prod-server-01
# Output: vpc-prod-server-01 ... Terminating ...

# Check agent status
kubectl get agent leaf-01 -n fab
# Output: Ready = False (agent disconnected)

# Check VPCAttachment finalizers
kubectl get vpcattachment vpc-prod-server-01 -o jsonpath='{.metadata.finalizers}'
# Output: ["vpcattachment.githedgehog.com/finalizer"]
```

**Recovery:**

**Option A: Wait for Agent Reconnection (Preferred)**

```bash
# Wait for agent to reconnect
kubectl get agent leaf-01 -n fab -w

# When agent becomes Ready, controller removes finalizer automatically
# VPCAttachment deletion completes
```

**Pros:**
- Safe (controller completes cleanup properly)
- No orphaned switch configurations
- Preserves audit trail

**Cons:**
- May take several minutes
- Requires agent to reconnect

**Option B: Force Delete (Emergency)**

```bash
# Remove finalizer manually
kubectl patch vpcattachment vpc-prod-server-01 --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# VPCAttachment deleted immediately
```

**⚠️ WARNING:** Switch VLAN may not be cleaned up properly. Manual cleanup may be required.

**After force delete:**

```bash
# Check Agent CRD when agent reconnects
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# If VLAN still present (orphaned), escalate to support for manual cleanup
```

#### Scenario 2: ArgoCD Sync Failure

**Symptoms:**
- Git revert committed successfully
- ArgoCD shows "OutOfSync" status
- Sync fails with error: "Failed to sync application"
- Cluster state not updated

**Diagnosis:**

```bash
# Check ArgoCD application status
kubectl get application hedgehog-config -n argocd -o yaml

# Look for sync errors in status.conditions

# Check ArgoCD logs
kubectl logs -n argocd deployment/argocd-application-controller | grep hedgehog-config

# Look for specific error messages
```

**Common causes:**

1. **Invalid YAML in Git**
   - Syntax error in reverted state
   - Missing required field
   - Invalid field value

2. **Namespace missing**
   - ArgoCD can't create resource (namespace doesn't exist)
   - Namespace was deleted

3. **RBAC issue**
   - ArgoCD service account lacks permissions
   - Kubernetes admission controller blocking creation

**Recovery:**

**Step 1: Validate YAML locally**

```bash
# Check YAML syntax
kubectl apply --dry-run=client -f vpcs/webapp-vpc.yaml

# Expected output if valid: "vpc.vpc.githedgehog.com/webapp-vpc created (dry run)"
# Expected output if invalid: "Error: invalid YAML syntax at line X"
```

**Step 2: Fix YAML in Git and commit**

```bash
# Edit file to fix syntax error
nano vpcs/webapp-vpc.yaml

# Commit fix
git add vpcs/webapp-vpc.yaml
git commit -m "Fix YAML syntax in rollback commit"
git push origin main
```

**Step 3: Retry ArgoCD sync**

```bash
# Trigger manual sync
argocd app sync hedgehog-config

# Wait for completion
argocd app wait hedgehog-config --health

# Expected: Sync succeeds with corrected YAML
```

**Prevention:**
- Always validate YAML with `--dry-run` before committing
- Use Git pre-commit hooks to validate YAML syntax
- Test rollback in non-production environment first

#### Scenario 3: Reconciliation Timeout

**Symptoms:**
- VPC or VPCAttachment creation/update takes >5 minutes
- No error events in kubectl describe
- Controller logs show repeated reconciliation attempts
- Resource eventually succeeds or times out

**Diagnosis:**

```bash
# Check controller resource usage
kubectl top pod -n fab

# Expected: Check if controller CPU/memory constrained

# Check agent status
kubectl get agents -n fab

# Check if agents are slow to respond or disconnected

# Check controller logs for timeout errors
kubectl logs -n fab deployment/fabric-controller-manager | grep -i timeout
```

**Common causes:**

1. **Controller resource constrained**
   - CPU limit reached (throttling)
   - Memory limit reached (OOM risk)
   - High reconciliation queue backlog

2. **Agent slow to apply configuration**
   - Switch overloaded with config changes
   - Network latency between controller and switch
   - Agent resource constraints

3. **Large number of resources reconciling**
   - Many VPCs/VPCAttachments created simultaneously
   - Queue backlog
   - Controller processing sequentially

**Recovery:**

**Option A: Wait (Usually Resolves)**

```bash
# Wait 10-15 minutes for reconciliation to complete
kubectl get events --watch | grep <resource-name>

# Monitor controller logs
kubectl logs -n fab deployment/fabric-controller-manager -f

# Look for reconciliation completion
```

**Pros:**
- Safe (controller completes reconciliation properly)
- No intervention required

**Cons:**
- May take 10-15 minutes
- Issue may recur with similar changes

**Option B: Restart Controller (If Hung)**

```bash
# Check if controller is responsive
kubectl get pods -n fab

# If controller CrashLoopBackOff or not Ready:
kubectl rollout restart deployment/fabric-controller-manager -n fab

# Wait for controller to restart
kubectl rollout status deployment/fabric-controller-manager -n fab

# Check reconciliation resumes
kubectl get events --watch
```

**Option C: Escalate (If Persistent)**

If reconciliation takes >30 minutes or controller keeps restarting:
- Collect diagnostics (Module 3.4 checklist)
- Check controller resource limits (may need increase)
- Escalate to support (Module 4.3 procedures)

---

### Concept 5: Emergency Procedures

#### When to Escalate vs. Self-Resolve

**Self-Resolve (You can fix it):**

| Scenario | Action |
|----------|--------|
| Stuck resource due to missed VPCAttachment deletion | Delete VPCAttachment, then retry VPC deletion |
| ArgoCD sync failure due to YAML syntax error | Fix YAML in Git, commit, retry sync |
| Reconciliation timeout <15 minutes | Wait for controller to complete |
| Agent disconnected causing stuck finalizer | Wait for Agent to reconnect, or force-delete after >30 min |

**Escalate to Support (Need help):**

| Scenario | Why Escalate |
|----------|--------------|
| Controller repeatedly crashing during rollback | Platform issue requiring support investigation |
| Finalizer removal doesn't complete deletion | Controller bug or unexpected state |
| Partial failure leaves fabric in inconsistent state | Requires expert validation and cleanup |
| Rollback causes new errors | Configuration corruption or unexpected dependency |
| Stuck resource >30 min after manual finalizer removal | Orphaned switch configuration requiring manual cleanup |

#### Emergency: Force Delete Resource

**Use ONLY when:**
- Resource stuck >30 minutes
- Finalizer removal attempted manually
- VPCAttachments confirmed deleted
- Support has recommended force-delete

```bash
# Force delete (ignores finalizers and grace period)
kubectl delete vpc vpc-prod --force --grace-period=0

# Expected: Resource deleted immediately

# ⚠️ WARNING: May leave orphaned switch configurations
```

**After force delete:**

```bash
# Verify in Agent CRD
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces}' | jq

# Check for orphaned VLANs

# Verify in Grafana Interface Dashboard
# Look for unexpected VLAN configurations

# If orphaned configs found, escalate to support for manual cleanup
```

#### Emergency: Rollback a Rollback

If the rollback itself causes issues (rare but possible):

```bash
# View Git history
git log --oneline -5

# Output:
# a1b2c3d (HEAD) Revert VPC VLAN change (rollback commit)
# e4f5g6h Update webapp-vpc VLAN to 1050 (original change)

# Revert the revert (restore original change)
git revert a1b2c3d

# Edit commit message
# Commit message: "Restore original VPC VLAN change (rollback was incorrect)"
git push origin main

# Trigger ArgoCD sync
argocd app sync hedgehog-config
```

**When to rollback a rollback:**
- Rollback introduced new errors
- Original change was actually correct (diagnosis was wrong)
- VLAN conflict was on the other VPC (not this one)

---

## Hands-On Lab

### Lab Overview

**Title:** Rollback a VPC Configuration Change

**Scenario:**

Earlier today, you updated VPC `webapp-vpc` to use VLAN 1050 for the `frontend` subnet. This caused a VLAN conflict with another VPC, breaking connectivity for 20 web servers.

**Your task:**
1. Identify and revert the problematic commit in Git
2. Trigger ArgoCD sync to apply the rollback
3. Verify connectivity restored
4. (Bonus) Practice safe VPCAttachment deletion

**Environment:**
- **Gitea:** http://localhost:3001 (username: `student`, password: `hedgehog123`)
- **ArgoCD:** http://localhost:8080 (username: `admin`, password: `qV7hX0NMroAUhwoZ`)
- **kubectl:** Already configured
- **Grafana:** http://localhost:3000

**Git Repository:** `student/hedgehog-config`

---

### Task 1: Identify and Revert Problematic Commit

**Estimated Time:** 3 minutes

**Objective:** Use Git to rollback the VLAN change that caused the conflict.

#### Step 1.1: Review Git History (Gitea Web UI)

1. Open Gitea: http://localhost:3001
2. Sign in (username: `student`, password: `hedgehog123`)
3. Navigate to `student/hedgehog-config` repository
4. Click **"Commits"** to view commit history

5. Identify recent commit:
   - **Commit message:** "Update webapp-vpc frontend VLAN to 1050"
   - **Author:** student
   - **Date:** Today
   - **Note the commit hash** (first 7 characters, e.g., `a1b2c3d`)

#### Step 1.2: Revert via Git CLI

**Option A: Command Line (Recommended)**

```bash
# Navigate to repository
cd /path/to/hedgehog-config  # (provided in environment)

# View recent history
git log --oneline -5

# Expected output:
# a1b2c3d (HEAD -> main) Update webapp-vpc frontend VLAN to 1050
# e4f5g6h Add DHCP range for backend subnet
# ...

# Revert the specific commit
git revert a1b2c3d

# Git opens editor with commit message
# Edit to add context:
# "Revert 'Update webapp-vpc frontend VLAN to 1050'
#
# Reason: VLAN 1050 conflicts with customer-app-vpc, causing
# connectivity failure for 20 webapp servers.
#
# This rollback restores VLAN 1010 to restore connectivity."

# Save and exit editor

# View diff to confirm revert
git show HEAD

# Expected: frontend VLAN reverted from 1050 to original value (1010)

# Push to remote
git push origin main

# Expected output: "1 file changed, 1 insertion(+), 1 deletion(-)"
```

**Option B: Gitea Web UI (Alternative)**

1. In Gitea, click commit `a1b2c3d`
2. View the diff (shows VLAN change 1010 → 1050)
3. Click **"Browse Source"** to navigate to commit state
4. Navigate to `vpcs/webapp-vpc.yaml`
5. Click **"Edit File"**
6. Manually change VLAN from 1050 back to 1010
7. Commit message: "Revert VLAN change (caused conflict)"
8. Click **"Commit Changes"**

#### Success Criteria

- ✅ Git commit reverted (new revert commit exists)
- ✅ Git diff shows VLAN changed from 1050 back to 1010
- ✅ Changes pushed to main branch
- ✅ Commit message includes context (why rollback needed)

**Validation:**

```bash
# Verify revert commit exists
git log --oneline -3

# Should show revert commit as HEAD

# Verify VLAN changed back to 1010
git show HEAD | grep "vlan:"
# Should show: -  vlan: 1050  and  +  vlan: 1010
```

---

### Task 2: Trigger ArgoCD Sync and Verify

**Estimated Time:** 2 minutes

**Objective:** Apply rollback to cluster via ArgoCD and verify successful sync.

#### Step 2.1: Watch ArgoCD Detect Change

1. Open ArgoCD UI: http://localhost:8080
2. Sign in (username: `admin`, password: `qV7hX0NMroAUhwoZ`)
3. Find `hedgehog-config` application
4. Status should change: "Synced" → "OutOfSync" (Git ahead of cluster)

**Note:** This may take up to 3 minutes (default polling interval). You can proceed to manual sync immediately.

#### Step 2.2: Trigger Sync

**Option A: ArgoCD UI (Visual)**

1. Click `hedgehog-config` application tile
2. Click **"Sync"** button at the top
3. Review sync diff (shows VLAN 1050 → 1010)
4. Click **"Synchronize"**
5. Watch sync progress:
   - Status: "Syncing" (yellow)
   - Resources updating
   - Status: "Synced" (green checkmark)

**Option B: ArgoCD CLI (Faster)**

```bash
# Trigger sync
argocd app sync hedgehog-config

# Expected output: "Syncing application hedgehog-config..."

# Wait for completion
argocd app wait hedgehog-config --health

# Expected output: "Application hedgehog-config synced successfully"
```

#### Step 2.3: Verify with kubectl

```bash
# Check VPC VLAN configuration
kubectl get vpc webapp-vpc -o jsonpath='{.spec.subnets.frontend.vlan}'

# Expected output: 1010 (reverted from 1050)

# Check events for webapp-vpc
kubectl get events --field-selector involvedObject.name=webapp-vpc --sort-by='.lastTimestamp'

# Expected events:
# Normal  VPCUpdated      VPC configuration reconciled
# Normal  VLANUpdated     VLAN changed from 1050 to 1010

# Verify no errors
kubectl get events --field-selector type=Warning | grep webapp-vpc

# Expected: No Warning events
```

**Check Agent CRD (switch configuration):**

```bash
# Find which switches have webapp-vpc frontend subnet
kubectl get vpcattachment | grep webapp-vpc | grep frontend

# Example output: webapp-vpc-server-01 (attached to leaf-01)

# Check leaf-01 interface configuration
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# Expected: VLAN 1010 in vlans list (not 1050)
```

#### Success Criteria

- ✅ ArgoCD status shows "Synced" and "Healthy"
- ✅ kubectl shows webapp-vpc frontend VLAN = 1010
- ✅ No Warning events
- ✅ Agent CRD shows VLAN 1010 configured on switch interfaces
- ✅ Events show VPC reconciliation completed

---

### Task 3: Validate Connectivity Restored

**Estimated Time:** 1 minute

**Objective:** Confirm servers can communicate after rollback.

#### Step 3.1: Verify in Grafana

1. Open Grafana: http://localhost:3000
2. Navigate to "Hedgehog Fabric" dashboard
3. Check VPC metrics:
   - `webapp-vpc` shows VLAN 1010
   - No VLAN conflicts indicator
   - VPC shows healthy status

4. Navigate to "Hedgehog Interfaces" dashboard
5. Filter: `switch="leaf-01"`, `interface="Ethernet5"`
6. Verify:
   - Interface operational state: up
   - VLAN 1010 configured
   - Traffic flowing (bandwidth graph shows activity)

#### Step 3.2: Test Connectivity (Optional)

If server access available:

```bash
# SSH to server-01 or use kubectl exec
# (Assumes server-01 is in webapp-vpc)

# Ping gateway
ping -c 4 10.0.10.1

# Expected: 0% packet loss

# Ping another server in VPC
ping -c 4 10.0.10.11

# Expected: 0% packet loss
```

#### Success Criteria

- ✅ Grafana confirms VLAN 1010 on webapp-vpc interfaces
- ✅ Grafana shows no VLAN conflicts
- ✅ Interface Dashboard shows traffic flowing
- ✅ Connectivity tests pass (if performed)
- ✅ No error events in Logs Dashboard

---

### Task 4 (Bonus): Practice Safe Deletion Order

**Estimated Time:** 1-2 minutes

**Objective:** Safely delete a test VPCAttachment using correct deletion order.

**Scenario:** Delete `webapp-vpc-server-03` (test server no longer needed).

#### Step 4.1: Verify VPCAttachment Exists

```bash
# Check if VPCAttachment exists
kubectl get vpcattachment webapp-vpc-server-03

# Expected: VPCAttachment found

# Check if VPC has other attachments (should NOT delete VPC yet)
kubectl get vpcattachment | grep webapp-vpc

# Expected: Multiple attachments (server-01, server-02, server-03)
```

#### Step 4.2: Delete VPCAttachment (Correct Order)

```bash
# Delete VPCAttachment
kubectl delete vpcattachment webapp-vpc-server-03

# Watch deletion progress
kubectl get vpcattachment webapp-vpc-server-03 -w

# Expected: Resource enters "Terminating" state briefly, then fully deleted

# Verify finalizer removed (deletion should complete in <30 seconds)
kubectl get vpcattachment webapp-vpc-server-03
# Expected: Error: not found
```

#### Step 4.3: Verify Cleanup

```bash
# Check Agent CRD - VLAN should be removed from interface
# (Assumes server-03 connected to leaf-03/Ethernet8)
kubectl get agent leaf-03 -n fab -o jsonpath='{.status.state.interfaces.Ethernet8}' | jq

# Expected: VLAN 1010 no longer in vlans list (if no other attachments on that interface)

# Verify VPC still exists (not deleted with attachment)
kubectl get vpc webapp-vpc

# Expected: VPC still present (deletion order correct)
```

#### Success Criteria

- ✅ VPCAttachment deleted successfully
- ✅ Finalizer removed automatically by controller
- ✅ VLAN removed from switch interface (verified in Agent CRD)
- ✅ VPC remains intact (not deleted with attachment)
- ✅ No errors in kubectl events

**What you learned:**
- Safe deletion order prevents stuck resources
- Finalizers protect against incomplete deletion
- Controller handles cleanup automatically when order is correct

---

### Lab Summary

**What You Accomplished:**

You successfully performed a production-style rollback and recovery:
1. ✅ Reverted problematic Git commit using `git revert`
2. ✅ Synced rollback to cluster via ArgoCD
3. ✅ Verified connectivity restored with kubectl and Grafana
4. ✅ (Bonus) Practiced safe VPCAttachment deletion

**Key Takeaways:**

1. **GitOps rollback is safe and auditable** - Git history tracks all changes and reversions
2. **ArgoCD ensures consistency** - Cluster state always matches Git
3. **Deletion order prevents stuck resources** - VPCAttachment before VPC
4. **Finalizers protect against incomplete cleanup** - Ensure switch configs cleaned up
5. **Manual finalizer removal is last resort** - Only when stuck >30 minutes and confirmed safe

**Recovery Mindset:**
- Plan rollback before making changes (know how to undo)
- Test rollback in non-prod first (if possible)
- Verify after rollback (don't assume it worked)
- Document recovery procedures (for team knowledge)

---

## Troubleshooting

### Common Lab Challenges

#### Challenge: "Git revert created conflicts"

**Symptom:** Git revert fails with merge conflicts.

**Cause:** The file has been modified since the commit you're reverting.

**Solution:**

```bash
# Git will show conflict markers in the file
# Edit the file to resolve conflicts

nano vpcs/webapp-vpc.yaml

# Look for conflict markers:
# <<<<<<< HEAD
# current version
# =======
# reverted version
# >>>>>>> parent of a1b2c3d

# Manually resolve by keeping the correct VLAN value

# Stage resolved file
git add vpcs/webapp-vpc.yaml

# Complete the revert
git revert --continue

# Push to remote
git push origin main
```

#### Challenge: "ArgoCD shows OutOfSync but sync fails"

**Symptom:** ArgoCD detects change but sync operation fails with error.

**Cause:** YAML syntax error, missing namespace, or RBAC issue.

**Solution:**

```bash
# Validate YAML locally
kubectl apply --dry-run=client -f vpcs/webapp-vpc.yaml

# If invalid, check ArgoCD logs for specific error
kubectl logs -n argocd deployment/argocd-application-controller | grep hedgehog-config

# Fix YAML in Git based on error message
# Commit and push fix
# Retry ArgoCD sync
```

#### Challenge: "VPCAttachment stuck in Terminating state"

**Symptom:** VPCAttachment not deleting after several minutes.

**Cause:** Agent disconnected, controller can't clean up switch configuration.

**Solution:**

```bash
# Check agent status
kubectl get agent leaf-03 -n fab

# If agent not Ready, wait for reconnection

# If agent Ready but VPCAttachment still stuck, check controller logs
kubectl logs -n fab deployment/fabric-controller-manager | grep webapp-vpc-server-03

# If stuck >30 minutes, manually remove finalizer (last resort)
kubectl patch vpcattachment webapp-vpc-server-03 --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
```

#### Challenge: "Connectivity still broken after rollback"

**Symptom:** kubectl shows VLAN 1010, but servers still can't communicate.

**Diagnosis:**

```bash
# Check Agent CRD to confirm switch configuration
kubectl get agent leaf-01 -n fab -o jsonpath='{.status.state.interfaces.Ethernet5}' | jq

# Check if VLAN actually updated on switch (not just in VPC CRD)

# Check server interface configuration
# (SSH to server or use kubectl exec)
ip addr show enp2s1.1010

# Check for other issues (use Module 4.1 troubleshooting methodology)
```

**Common causes:**
- Agent not updated switch configuration yet (wait 1-2 minutes)
- Server interface still configured for VLAN 1050
- Different root cause (VLAN wasn't the issue)

---

## Resources

### Reference Documentation

**GitOps Workflow:**
- Module 1.2: GitOps with Hedgehog Fabric (Git operations, ArgoCD sync)
- WORKFLOWS.md (lines 768-861): Workflow 7 - Cleanup and Rollback

**CRD Reference:**
- CRD_REFERENCE.md: VPC, VPCAttachment finalizers and status fields
- Understanding resource dependencies and deletion order

**Related Modules:**
- Module 4.1: Diagnosing Fabric Issues (hypothesis-driven troubleshooting)
- Module 4.3: Coordinating with Support (when to escalate)

### Quick Reference: Rollback Commands

**Git Rollback:**
```bash
# View commit history
git log --oneline --graph -10

# Revert specific commit
git revert <commit-hash>

# View revert diff
git show HEAD

# Push revert
git push origin main
```

**ArgoCD Sync:**
```bash
# Trigger sync
argocd app sync hedgehog-config

# Wait for completion
argocd app wait hedgehog-config --health

# Check sync status
argocd app get hedgehog-config

# View sync history
argocd app history hedgehog-config
```

**Safe Deletion:**
```bash
# Step 1: Delete VPCAttachments
kubectl delete vpcattachment <name>

# Step 2: Delete VPCPeerings
kubectl delete vpcpeering <name>

# Step 3: Delete VPC
kubectl delete vpc <name>

# Verify deletion
kubectl get vpc <name>
# Expected: Error: not found
```

**Finalizer Troubleshooting:**
```bash
# Check finalizers
kubectl get vpc <name> -o jsonpath='{.metadata.finalizers}'

# Check deletionTimestamp
kubectl get vpc <name> -o jsonpath='{.metadata.deletionTimestamp}'

# Remove finalizer (last resort)
kubectl patch vpc <name> --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
```

### Escalation Checklist

**Before escalating, ensure you have:**
- ✅ Attempted rollback using Git revert
- ✅ Verified Git commit pushed successfully
- ✅ Triggered ArgoCD sync
- ✅ Checked kubectl events for errors
- ✅ Checked controller logs for reconciliation errors
- ✅ Waited >30 minutes for stuck resources
- ✅ Verified Agent connectivity
- ✅ Documented all steps attempted

**Escalate when:**
- Controller repeatedly crashes during rollback
- Finalizer removal doesn't complete deletion (after manual removal)
- Partial failure leaves fabric in inconsistent state
- Rollback causes new errors (configuration corruption)
- Stuck resource >30 min after manual finalizer removal

Reference Module 4.3 for escalation procedures and creating effective support tickets.

---

## Assessment

### Question 1: GitOps Rollback

**Scenario:** You need to rollback a VPC configuration change. The problematic commit is `a1b2c3d`. What is the CORRECT command sequence?

**A:**
```bash
git reset --hard HEAD~1
git push --force
```

**B:**
```bash
git revert a1b2c3d
git push origin main
```

**C:**
```bash
kubectl delete vpc vpc-prod
kubectl apply -f vpc-prod-backup.yaml
```

**D:**
```bash
git checkout a1b2c3d~1
git push origin main
```

<details>
<summary>Answer & Explanation</summary>

**Answer:** B

```bash
git revert a1b2c3d
git push origin main
```

**Explanation:**

**Why B is correct:**

`git revert` creates a NEW commit that undoes changes from the specified commit:
- **Preserves Git history** (audit trail intact)
- **Safe for shared branches** (doesn't rewrite history)
- **ArgoCD compatible** (detects new commit and syncs cluster)
- **Reversible** (can revert the revert if needed)

**Workflow:**
1. `git revert a1b2c3d` - Creates revert commit that undoes changes
2. Git opens editor for commit message (add context about why)
3. `git push origin main` - Pushes revert commit to remote
4. ArgoCD detects change and syncs (or manual sync)
5. Cluster state reverted to match Git

**Why others are wrong:**

**A) git reset --hard + push --force:**
- **DANGEROUS:** Rewrites Git history (loses audit trail)
- `--force` push can break collaborators' clones
- Not compatible with GitOps best practices
- No record of why rollback was needed
- Can't recover original commit easily

**C) kubectl delete + apply:**
- **Bypasses GitOps:** Manual kubectl changes not tracked in Git
- Creates configuration drift (Git ≠ cluster)
- No audit trail in Git
- ArgoCD will detect OutOfSync and may re-apply wrong config
- Not reproducible (no procedure documented)

**D) git checkout + push:**
- `git checkout` creates detached HEAD (not a commit)
- Cannot push detached HEAD to branch
- Invalid Git operation for this purpose
- Would need `git checkout -b` to create branch, then merge

**GitOps Principle:** Always make changes via Git commits. Never rewrite history on shared branches. Never bypass Git by using kubectl directly for configuration changes.

**Module 4.2 Reference:** Concept 1 - GitOps Rollback Workflow
</details>

---

### Question 2: Safe Deletion Order

**Scenario:** You need to delete VPC `prod-vpc`. It has 3 VPCAttachments and 1 VPCPeering. What is the CORRECT deletion order?

- A) Delete VPC → Delete VPCAttachments → Delete VPCPeering
- B) Delete VPCAttachments → Delete VPCPeering → Delete VPC
- C) Delete VPCPeering → Delete VPC → Delete VPCAttachments
- D) Delete all resources simultaneously with `kubectl delete vpc,vpcattachment,vpcpeering --all`

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Delete VPCAttachments → Delete VPCPeering → Delete VPC

**Explanation:**

**Correct deletion order (leaves to roots, children before parents):**

**Step 1: Delete VPCAttachments**
- VPCAttachments depend on VPC (reference VPC subnet)
- VPC finalizer waits for all VPCAttachments to be deleted first
- Delete all 3 VPCAttachments before moving to next step

**Step 2: Delete VPCPeering**
- VPCPeering depends on both VPCs
- Must be deleted before either VPC can be fully deleted
- Ensures no orphaned peering configurations

**Step 3: Delete VPC**
- Only delete VPC after all dependent resources removed
- VPC finalizer can now complete cleanup (remove DHCPSubnets, clean switch configs)
- VPC deletion completes successfully

**Commands:**
```bash
# Step 1: Delete VPCAttachments
kubectl delete vpcattachment prod-vpc-server-01
kubectl delete vpcattachment prod-vpc-server-02
kubectl delete vpcattachment prod-vpc-server-03

# Wait for deletion to complete
kubectl get vpcattachment | grep prod-vpc
# Expected: No results

# Step 2: Delete VPCPeering
kubectl delete vpcpeering prod-vpc--staging-vpc

# Wait for deletion
kubectl get vpcpeering prod-vpc--staging-vpc
# Expected: Error: not found

# Step 3: Delete VPC
kubectl delete vpc prod-vpc

# Verify deletion (<30 seconds if dependencies cleared)
kubectl get vpc prod-vpc
# Expected: Error: not found
```

**Why this order matters:**

**VPC Finalizer Behavior:**
- When you try to delete VPC first, finalizer checks for VPCAttachments
- If VPCAttachments still exist, finalizer doesn't remove itself
- VPC stuck in "Terminating" state until VPCAttachments deleted
- Correct order avoids stuck resources

**Why others are wrong:**

**A) VPC first:**
- VPC enters "Terminating" state (stuck)
- Finalizer prevents deletion while VPCAttachments exist
- Must manually delete VPCAttachments to unstick
- Wrong order causes delays and confusion

**C) VPCPeering first, VPC second:**
- VPC still stuck (VPCAttachments still reference it)
- Must delete VPCAttachments first before VPC
- Wrong order: VPCAttachments should be first

**D) Delete all simultaneously:**
- Kubernetes processes deletions in parallel
- Race condition: VPC may try to delete before attachments
- Can leave orphaned switch configurations
- No guaranteed order = unpredictable results
- May cause stuck resources requiring manual intervention

**General Rule:** Always delete dependent resources (children) before the resources they depend on (parents). Think of dependencies as a tree: delete leaves before branches, branches before trunk.

**Module 4.2 Reference:** Concept 2 - Safe Deletion Order
</details>

---

### Question 3: Finalizers

**Scenario:** You deleted VPC `test-vpc` 15 minutes ago, but it's still showing "Terminating" status. You check and find finalizers still present. What should you do FIRST?

- A) Immediately remove finalizers with `kubectl patch`
- B) Check if VPCAttachments still exist and delete them
- C) Restart the fabric controller
- D) Escalate to support immediately

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Check if VPCAttachments still exist and delete them

**Explanation:**

**Finalizer Troubleshooting Order:**

**Step 1: Check for dependent resources** (most common cause)

```bash
# Check if VPCAttachments still reference VPC
kubectl get vpcattachment | grep test-vpc

# If found, delete them
kubectl delete vpcattachment test-vpc-server-01
kubectl delete vpcattachment test-vpc-server-02

# Wait for deletion to complete
kubectl get vpcattachment | grep test-vpc
# Expected: No results

# VPC finalizer should now be removed automatically
kubectl get vpc test-vpc
# Expected: Deletion completes within 30 seconds
```

**Why this is first:**
- **Most common cause** of stuck finalizers: dependent resources still exist
- **Safe to check** (read-only operation, no risk)
- **Easy to fix** (delete VPCAttachments using safe deletion order)
- **Controller will automatically remove finalizer** once dependencies cleared

**Step 2: Check controller logs** (if no VPCAttachments found)

```bash
kubectl logs -n fab deployment/fabric-controller-manager | grep test-vpc

# Look for errors preventing finalizer removal
# Examples: Agent unreachable, cleanup errors, resource conflicts
```

**Step 3: Check agent connectivity** (if controller shows agent errors)

```bash
kubectl get agents -n fab

# If agents disconnected, wait for reconnection
# Controller will complete cleanup once agents back online
```

**Step 4: Manual finalizer removal** (last resort, after 30+ minutes and all checks completed)

```bash
kubectl patch vpc test-vpc --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'

# WARNING: Only after confirming dependencies deleted and cleanup completed or blocked
```

**Why others are wrong:**

**A) Immediately remove finalizers:**
- **Premature:** Haven't diagnosed root cause yet
- **Dangerous:** May leave orphaned switch configurations (VLANs not cleaned up)
- **Skips troubleshooting:** Should check for dependencies first
- **Last resort only:** Manual finalizer removal is emergency procedure

**Consequences of premature finalizer removal:**
```bash
# VPC deleted but VPCAttachments still exist
# Switch VLANs orphaned (not cleaned up)
# DHCPSubnets orphaned
# Cluster state inconsistent
# Requires manual cleanup or support escalation
```

**C) Restart controller:**
- **Doesn't address root cause:** VPCAttachments still exist (if that's the issue)
- **Disrupts fabric operations** unnecessarily
- **Controller restart won't remove finalizers** if dependencies still present
- **Should diagnose first:** Check dependencies before taking disruptive actions

**Controller restart appropriate when:**
- Controller hung or not responding
- Controller logs show error state
- After verifying dependencies deleted

**D) Escalate immediately:**
- **Premature escalation:** Common issue that operators can self-resolve
- **Support will ask:** "Did you check for VPCAttachments first?"
- **Wastes support resources:** Should complete basic troubleshooting first
- **Escalate only after:** 30+ minutes stuck AND all troubleshooting steps completed

**When to escalate:**
- Stuck >30 minutes after deleting all dependencies
- Manual finalizer removal doesn't complete deletion
- Controller logs show unexpected errors
- Agent reconnection doesn't allow cleanup to complete

**Troubleshooting Principle:**

Always check for dependent resources before taking more disruptive actions. Most stuck finalizer issues are caused by:
1. VPCAttachments still existing (80% of cases)
2. Agent disconnected (15% of cases)
3. Controller errors (5% of cases)

**Module 4.2 Reference:** Concept 3 - Kubernetes Finalizers (Stuck Resources section)
</details>

---

### Question 4: Partial Failure Recovery

**Scenario:** ArgoCD sync failed with error "Failed to sync application: invalid YAML". Your rollback commit is in Git, but cluster state hasn't changed. What is the NEXT step?

- A) Delete the Git commit and start over
- B) Validate YAML locally with `kubectl apply --dry-run`, fix errors, and commit fix
- C) Force ArgoCD to sync with `--force` flag
- D) Manually apply YAML with kubectl (bypass ArgoCD)

<details>
<summary>Answer & Explanation</summary>

**Answer:** B) Validate YAML locally with `kubectl apply --dry-run`, fix errors, and commit fix

**Explanation:**

**ArgoCD Sync Failure Recovery Workflow:**

**Step 1: Diagnose YAML issue (local validation)**

```bash
# Validate YAML syntax
kubectl apply --dry-run=client -f vpcs/webapp-vpc.yaml

# If valid:
# Output: "vpc.vpc.githedgehog.com/webapp-vpc created (dry run)"

# If invalid:
# Output: "Error: error validating "vpcs/webapp-vpc.yaml": error validating data:
#          ValidationError(VPC.spec.subnets.frontend): unknown field "vlan_id"
#          in com.githedgehog.vpc.v1beta1.VPC.spec.subnets.frontend"
```

**Step 2: Fix YAML in Git**

```bash
# Edit file to fix error (e.g., "vlan_id" should be "vlan")
nano vpcs/webapp-vpc.yaml

# Example fix:
# Before:
#   subnets:
#     frontend:
#       vlan_id: 1010  # Wrong field name
#
# After:
#   subnets:
#     frontend:
#       vlan: 1010  # Correct field name

# Validate fix locally
kubectl apply --dry-run=client -f vpcs/webapp-vpc.yaml
# Expected: Validation succeeds

# Commit fix
git add vpcs/webapp-vpc.yaml
git commit -m "Fix YAML field name in rollback commit (vlan_id → vlan)"
git push origin main
```

**Step 3: Retry ArgoCD sync**

```bash
# Trigger manual sync
argocd app sync hedgehog-config

# Wait for completion
argocd app wait hedgehog-config --health

# Expected: Sync succeeds with corrected YAML
```

**Why B is correct:**

- **Root cause:** Invalid YAML in Git (syntax error, wrong field name, missing required field)
- **Solution:** Fix YAML at the source (Git), then sync
- **GitOps preserved:** All changes tracked in Git (including the fix)
- **Audit trail:** Fix commit documents what went wrong and how it was resolved
- **Reproducible:** Can apply same fix in other environments if needed

**Common YAML errors:**
- Wrong field name (`vlan_id` instead of `vlan`)
- Missing required field (e.g., `subnet` field)
- Invalid field value (e.g., VLAN 9999 outside VLANNamespace range)
- Indentation error (YAML syntax)
- Wrong API version (e.g., `v1alpha1` instead of `v1beta1`)

**Why others are wrong:**

**A) Delete Git commit:**
- **Loses audit trail:** Why was commit created? What was attempted?
- **Doesn't fix YAML:** Deleting commit doesn't address syntax error
- **Not GitOps best practice:** Fix forward with new commit, don't rewrite history
- **Complicates troubleshooting:** Can't see what was tried

**Better approach:** Keep problematic commit in history, add fix commit on top. Shows full troubleshooting journey.

**C) Force sync:**
- **`--force` doesn't fix invalid YAML:** ArgoCD still can't parse invalid YAML
- **Force flag purpose:** Override cluster-side changes, not fix YAML syntax
- **Won't resolve issue:** ArgoCD validation still fails with same error
- **May make things worse:** Force sync could bypass safety checks

**When `--force` is appropriate:**
- Manual kubectl changes made (configuration drift)
- Need to override OutOfSync status
- NOT for fixing YAML syntax errors

**D) Manually apply with kubectl:**
- **Bypasses GitOps:** Cluster ≠ Git (configuration drift created)
- **No audit trail:** Change not tracked in Git
- **ArgoCD will overwrite:** Next sync will revert manual change
- **Defeats purpose of GitOps:** Loses all benefits of declarative config

**Consequences of bypassing GitOps:**
```bash
# Manually apply YAML with kubectl
kubectl apply -f webapp-vpc-fixed.yaml

# Cluster now has correct config, but Git still has broken YAML

# Next ArgoCD sync:
# ArgoCD sees Git (broken YAML) ≠ Cluster (fixed)
# ArgoCD tries to sync Git to Cluster
# Sync fails again with same YAML error
# OR sync succeeds and reverts your manual fix
# Result: Configuration drift and confusion
```

**GitOps Recovery Principle:**

**Always fix issues in Git first, then sync.** Never bypass Git with manual kubectl changes for configuration managed by ArgoCD.

**Exception:** Emergency hotfix in production (then immediately commit to Git to restore consistency).

**Module 4.2 Reference:** Concept 4 - Partial Failure Recovery (Scenario 2: ArgoCD Sync Failure)
</details>

---

## Conclusion

You've completed Module 4.2: Rollback & Recovery!

### What You Learned

**GitOps Rollback Workflow:**
- Using `git revert` to create safe rollback commits
- Triggering ArgoCD sync to apply rollbacks
- Verifying rollback success with kubectl and Grafana
- Understanding when rollback is appropriate vs. fixing forward

**Safe Deletion Order:**
- Why order matters (dependencies and finalizers)
- Correct sequence: VPCAttachment → VPCPeering → VPC
- Avoiding stuck resources during deletion
- Verifying cleanup completed successfully

**Kubernetes Finalizers:**
- What finalizers are and why they protect resources
- How finalizers ensure complete cleanup
- Diagnosing stuck resources (Terminating state)
- When manual finalizer removal is appropriate (last resort)

**Partial Failure Recovery:**
- Handling stuck resources (Agent disconnected, reconciliation timeout)
- Recovering from ArgoCD sync failures
- Emergency procedures and escalation criteria

### Key Takeaways

1. **GitOps rollback is safe and auditable** - Git history provides complete audit trail of changes and rollbacks

2. **Deletion order prevents stuck resources** - Always delete children before parents (VPCAttachment before VPC)

3. **Finalizers are safety mechanisms** - They prevent incomplete deletion and ensure proper cleanup

4. **Fix issues in Git, not kubectl** - Maintain GitOps principles even during recovery

5. **Manual intervention is last resort** - Exhaust troubleshooting before manual finalizer removal or force delete

### Recovery Mindset

As you continue operating Hedgehog fabrics:

- **Plan rollback before changes** - Know how to undo before making changes
- **Test in non-prod first** - Validate rollback procedures in safe environments
- **Verify after rollback** - Don't assume rollback worked, confirm with kubectl and Grafana
- **Document recovery procedures** - Share knowledge with team
- **Follow safe deletion order** - Prevent stuck resources by deleting dependencies first

### Course 4 Progress

**Completed:**
- ✅ Module 4.1: Diagnosing Fabric Issues
- ✅ Module 4.2: Rollback & Recovery

**Up Next:**
- Module 4.3: Coordinating with Support (effective tickets, working with engineers)
- Module 4.4: Post-Incident Review (documentation, prevention, knowledge sharing)

**Overall Pathway Progress:** 14/16 modules complete (87.5%)

---

**You're now equipped to safely rollback changes and recover from failures using GitOps best practices. See you in Module 4.3!**
