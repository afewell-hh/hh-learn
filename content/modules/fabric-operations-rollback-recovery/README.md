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
- Gitea access (http://YOUR_VM_IP:3001)
- ArgoCD access (http://YOUR_VM_IP:8080)
- Grafana access (http://YOUR_VM_IP:3000)

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

GitOps rollback uses Git as the source of truth, providing:
- **Audit trail** - Git history tracks all changes and rollbacks
- **Reproducibility** - Same procedure every time
- **Safety** - ArgoCD validates before applying
- **No drift** - Git and cluster stay synchronized

#### GitOps Rollback Procedure (5 Steps)

##### Step 1: Identify Problematic Commit

```bash
# View recent Git history
cd /path/to/hedgehog-config
git log --oneline --graph --decorate -10

# Example output:
# a1b2c3d (HEAD -> main) Update webapp-vpc VLAN to 1050
```

**Identify commit to revert:** Use commit message, timestamp, and `git show <commit-hash>` to find the problematic change.

##### Step 2: Revert the Commit (Git)

```bash
# Revert the specific commit (creates NEW commit that undoes changes)
git revert a1b2c3d

# Edit commit message to add context (why rollback needed)
# Review diff with: git show HEAD
# Push revert commit
git push origin main
```

##### Step 3: Trigger ArgoCD Sync

**Option A: Wait for auto-sync** (3 minutes) or **Option B: Manual sync via UI or CLI:**

```bash
# ArgoCD CLI
argocd app sync hedgehog-config
argocd app wait hedgehog-config --health
```

##### Step 4: Verify Rollback

```bash
# Verify VLAN reverted
kubectl get vpc webapp-vpc -o jsonpath='{.spec.subnets.frontend.vlan}'
# Expected: 1010

# Verify Agent convergence (config applied to switches)
kubectl get agents
# Expected: APPLIEDG == CURRENTG for all switches

# Verify Agent CRD (switch configuration)
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'
# Expected: vlans list contains 1010
```

##### Step 5: Validate Connectivity

**Check Grafana:** Verify VLAN 1010 on switch interface, no VLAN conflicts, traffic flowing.

**Test connectivity (if available):**

```bash
# Ping gateway and other servers
ping -c 4 10.10.1.1
# Expected: 0% packet loss
```

---

### Concept 2: Safe Deletion Order

#### Why Order Matters

Deleting resources in wrong order causes stuck resources, orphaned configurations, and partial failures. **Rule:** Delete from leaves to roots (children before parents).

**Safe deletion order:**
```
VPCAttachment → VPCPeering → ExternalPeering → VPC → Namespaces
```

If resource A references resource B in its spec, delete A before B.

#### Example: Delete VPC and Attachments

**✅ Correct Order:**

```bash
# Step 1: Delete all VPCAttachments
kubectl delete vpcattachment vpc-prod-server-01 vpc-prod-server-02 vpc-prod-server-03

# Step 2: Delete VPCPeerings (if any)
kubectl delete vpcpeering vpc-prod--vpc-staging

# Step 3: Delete VPC
kubectl delete vpc vpc-prod
# Should complete in <30 seconds if dependencies cleared
```

**Verification:** Check DHCPSubnets auto-deleted, VLAN removed from Agent CRD, VPC count decreased in Grafana.

---

### Concept 3: Kubernetes Finalizers

#### What Are Finalizers?

Finalizers are hooks that prevent resource deletion until cleanup completes. They ensure dependencies are deleted first, switch configurations are cleaned up, and no orphaned resources remain.

#### Finalizer Workflow

1. User deletes resource → Kubernetes sets `deletionTimestamp`
2. Resource enters "Terminating" state
3. Controller performs cleanup (remove switch VLANs, delete DHCPSubnets, etc.)
4. Controller removes finalizer
5. Kubernetes completes deletion

#### Stuck Resources (Finalizer Not Removed)

**Common causes:**
1. **VPCAttachments still exist** - Delete VPCAttachments first
2. **Agent disconnected** - Wait for reconnection
3. **Controller error** - Check logs, restart if needed

#### Recovery: Remove Finalizer Manually (Last Resort)

**⚠️ WARNING:** Only do this after 30+ minutes, with dependencies deleted, and controller logs checked.

```bash
# Remove finalizer to force deletion
kubectl patch vpc vpc-prod --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
```

**Caution:** May leave orphaned switch configurations. Verify cleanup in Agent CRD after removal.

---

### Concept 4: Partial Failure Recovery

#### Scenario 1: Stuck VPCAttachment (Agent Disconnected)

**Recovery Options:**

**Option A: Wait for Agent Reconnection (Preferred)**
- Controller removes finalizer automatically when agent returns
- Safe, no orphaned configurations

**Option B: Force Delete (Emergency, after 30+ min)**
```bash
kubectl patch vpcattachment vpc-prod-server-01 --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
```
⚠️ May leave orphaned switch VLAN. Check Agent CRD after reconnection.

#### Scenario 2: ArgoCD Sync Failure

**Common causes:** Invalid YAML (syntax error, wrong field name), missing namespace, RBAC issue.

**Recovery:**

```bash
# Step 1: Validate YAML locally
kubectl apply --dry-run=client -f vpcs/webapp-vpc.yaml

# Step 2: Fix YAML in Git, commit, and push
git add vpcs/webapp-vpc.yaml
git commit -m "Fix YAML syntax in rollback commit"
git push origin main

# Step 3: Retry sync
argocd app sync hedgehog-config
```

#### Scenario 3: Reconciliation Timeout

**Common causes:** Controller resource constraints, slow Agent response, large reconciliation queue.

**Recovery:**

**Option A: Wait** (10-15 min, usually resolves)

**Option B: Restart Controller** (if hung)
```bash
kubectl rollout restart deployment/fabric-ctrl -n fab
```

**Option C: Escalate** (if >30 min or repeated failures)

---

### Concept 5: Emergency Procedures

#### When to Escalate vs. Self-Resolve

**Self-Resolve:** Stuck resource due to missed dependency deletion, YAML syntax error, reconciliation timeout <15 min, agent disconnected.

**Escalate:** Controller repeatedly crashing, finalizer removal doesn't complete deletion, partial failure with inconsistent state, stuck resource >30 min after manual intervention.

---

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

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
- **Gitea:** http://YOUR_VM_IP:3001 (username: `student01`, password: `hedgehog123`)
- **ArgoCD:** http://YOUR_VM_IP:8080 (username: `admin`, password: see below)
- **kubectl:** Already configured
- **Grafana:** http://YOUR_VM_IP:3000 (admin/admin)

> **ArgoCD password:** `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d && echo`

**Git Repository:** `student/hedgehog-config`

---

### Task 1: Identify and Revert Problematic Commit

**Estimated Time:** 3 minutes

**Objective:** Use Git to rollback the VLAN change that caused the conflict.

#### Steps

```bash
# Navigate to repository
cd /path/to/hedgehog-config

# View recent history
git log --oneline -5

# Revert the commit (e.g., a1b2c3d)
git revert a1b2c3d

# Add context to commit message explaining why rollback needed
# Save and exit editor

# Push to remote
git push origin main
```

**Success Criteria:** Revert commit exists, VLAN changed 1050 → 1010, changes pushed to main.

---

### Task 2: Trigger ArgoCD Sync and Verify

**Estimated Time:** 2 minutes

**Objective:** Apply rollback to cluster via ArgoCD and verify successful sync.

#### Steps

```bash
# Trigger sync (or wait 3 min for auto-sync)
argocd app sync hedgehog-config
argocd app wait hedgehog-config --health

# Verify VLAN reverted
kubectl get vpc webapp-vpc -o jsonpath='{.spec.subnets.frontend.vlan}'
# Expected: 1010

# Verify Agent convergence after ArgoCD sync
kubectl get agents
# Expected: APPLIEDG == CURRENTG for all switches

# Verify Agent CRD shows VLAN 1010
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'
```

**Success Criteria:** ArgoCD synced, kubectl shows VLAN 1010, agents converged (APPLIEDG == CURRENTG), Agent CRD shows VLAN 1010.

---

### Task 3: Validate Connectivity Restored

**Estimated Time:** 1 minute

**Objective:** Confirm servers can communicate after rollback.

#### Steps

**Verify in Grafana:**
- Navigate to "Hedgehog Fabric": switch health looks good
- "Hedgehog Switch Interface Counters": VLAN 1010 configured on relevant interface, traffic flowing

**Test connectivity (optional):**
```bash
ping -c 4 10.0.10.1  # Gateway
# Expected: 0% packet loss
```

**Success Criteria:** Grafana confirms VLAN 1010, no conflicts, traffic flowing.

---

### Task 4 (Bonus): Practice Safe Deletion Order

**Estimated Time:** 1-2 minutes

**Objective:** Safely delete a test VPCAttachment.

**Scenario:** Delete `webapp-vpc-server-03`.

#### Steps

```bash
# Delete VPCAttachment
kubectl delete vpcattachment webapp-vpc-server-03

# Verify deletion completes (<30 seconds)
kubectl get vpcattachment webapp-vpc-server-03
# Expected: Error: not found

# Verify VLAN removed from Agent CRD
kubectl get agent leaf-03 -o json | jq '.status.state.interfaces["E1/8"]'

# Verify VPC still exists
kubectl get vpc webapp-vpc
```

**Success Criteria:** VPCAttachment deleted, finalizer removed automatically, VLAN removed from switch, VPC intact.

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
# Check agent status (agents in default namespace)
kubectl get agent leaf-03

# If agent not Ready, wait for reconnection

# If agent Ready but VPCAttachment still stuck, check controller logs
kubectl logs -n fab deployment/fabric-ctrl | grep webapp-vpc-server-03

# If stuck >30 minutes, manually remove finalizer (last resort)
kubectl patch vpcattachment webapp-vpc-server-03 --type='json' -p='[{"op": "remove", "path": "/metadata/finalizers"}]'
```

#### Challenge: "Connectivity still broken after rollback"

**Symptom:** kubectl shows VLAN 1010, but servers still can't communicate.

**Diagnosis:**

```bash
# Check Agent CRD to confirm switch configuration
kubectl get agent leaf-01 -o json | jq '.status.state.interfaces["E1/5"]'

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
- ✅ Checked Agent convergence (kubectl get agents, APPLIEDG == CURRENTG)
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

`git revert` creates a NEW commit that undoes changes, preserving Git history (audit trail), safe for shared branches, and ArgoCD compatible.

**Why others are wrong:**
- **A)** Rewrites history, breaks collaborators' clones, loses audit trail
- **C)** Bypasses GitOps, creates drift (Git ≠ cluster), no audit trail
- **D)** Creates detached HEAD, cannot push to branch

**GitOps Principle:** Always make changes via Git commits. Never rewrite shared branch history.
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

**Correct order (leaves to roots):**
1. VPCAttachments depend on VPC - delete first
2. VPCPeering depends on both VPCs - delete before VPC
3. VPC - delete last after dependencies cleared

**Why others are wrong:**
- **A)** VPC stuck in "Terminating" while VPCAttachments exist
- **C)** VPC still stuck (VPCAttachments not deleted)
- **D)** Race condition, unpredictable results, orphaned configs

**Rule:** Delete children before parents. Leaves before branches.
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

**Why B is first:**
- Most common cause (80% of stuck finalizers)
- Safe to check (read-only)
- Easy to fix (delete dependencies)
- Controller removes finalizer automatically once cleared

**Why others are wrong:**
- **A)** Premature, dangerous (orphans switch configs), skips diagnosis
- **C)** Doesn't address root cause, disrupts operations unnecessarily
- **D)** Premature escalation, common self-resolvable issue

**Troubleshooting order:** Check dependencies → Check controller logs → Check agents → Manual removal (last resort after 30+ min)
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

**Why B is correct:**
- Fixes root cause (invalid YAML in Git)
- Preserves GitOps (all changes tracked)
- Maintains audit trail
- Reproducible across environments

**Why others are wrong:**
- **A)** Loses audit trail, doesn't fix YAML, complicates troubleshooting
- **C)** `--force` doesn't fix invalid YAML syntax
- **D)** Bypasses GitOps, creates drift, ArgoCD will overwrite

**GitOps Principle:** Always fix issues in Git first, then sync. Never bypass Git with manual kubectl changes.
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
