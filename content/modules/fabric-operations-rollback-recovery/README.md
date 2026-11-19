---
title: "Rollback & Recovery"
slug: "fabric-operations-rollback-recovery"
difficulty: "intermediate"
estimated_minutes: 20
version: "v1.1.0"
validated_on: "2026-11-19"
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
description: "Practice a student-owned Git revert and ArgoCD prune, then review safe deletion order, finalizers, and partial failure recovery."
order: 403
---

## Introduction

A GitOps rollback is a new commit that undoes an earlier change while preserving the history of both actions. In this lab, you will create one **student-owned, unattached practice VPC** through the teaching repository, observe ArgoCD create it, revert your actual creation commit, and verify ArgoCD prunes the VPC. No server is attached, so this tests the Git → ArgoCD → Kubernetes rollback path. It does not claim to restore a dataplane outage.

The released R0 VM has the `student/hedgehog-config` repository in Gitea and an ArgoCD application named `hedgehog-config` that reads its `active/` directory. The example `webapp-vpc` and commit `a1b2c3d` are not seeded. You will use the commit hash Git gives you, never a placeholder.

### Learning objectives

After this module, you can:

1. Create and identify a small GitOps change you own.
2. Use `git revert` to undo its exact commit without rewriting shared history.
3. Observe the ArgoCD sync and Kubernetes resource before and after prune.
4. Explain safe deletion order and the role of finalizers without forcing deletion.
5. Preserve evidence and stop cleanly if a sync or rollback fails.

### Prerequisites and scope

Start with a running released R0 lab VM. You need `kubectl` and `argocd` as `ubuntu`, and the course Gitea student login for Git prompts. No pre-existing student VPC is required. This lab temporarily creates and then deletes `r0-revert`; it leaves two new commits in the teaching repository and no practice VPC. Do not run it concurrently with another learner editing the same repo.

Run the shell blocks in one terminal session so `CREATE` and `REVERT` remain available. Keep credentials out of command lines, repository files, screenshots and support bundles. Git may prompt for the course student username and password; enter them at the prompt, never in the clone URL. Do not use your GitHub or GCP account for this lab.

## Lab: create, revert and prune your own VPC

### Task 1: Confirm the baseline and prepare the repository

Run as `ubuntu` on the lab VM:

```bash
set -o pipefail
kubectl config current-context
argocd app get hedgehog-config
argocd app get hedgehog-config -o json | jq -e '.spec.syncPolicy.automated.prune == true'
kubectl get vpc r0-revert -o name --ignore-not-found
kubectl get vpcs -o json | jq '[.items[] | select(any(.spec.subnets[]?; .subnet == "10.99.91.0/24" or .vlan == 1997)) | .metadata.name]'
WORKDIR=$(mktemp -d "$HOME/rollback-lab-XXXXXX")
git clone http://127.0.0.1:3001/student/hedgehog-config.git "$WORKDIR/hedgehog-config"
cd "$WORKDIR/hedgehog-config"
git status --short
git branch --show-current
```

Expect context `vlab`, an accessible ArgoCD app with automatic prune enabled, no `r0-revert`, an empty `[]` reservation check, a clean Git checkout and branch `main`. The temporary work directory avoids altering any earlier course checkout. If the name, subnet or VLAN is already in use, **stop** and choose different unused values within the namespace rules before creating anything. The repository may contain teaching files with lab information; do not copy their contents into evidence or commits.

### Task 2: Commit and observe the creation

The released default IPv4Namespace includes `10.99.0.0/16`, and the VLAN namespace allows 1000–2999. `r0-revert` is within the VPC name limit. Create only this new file under ArgoCD's `active/` path:

```bash
set -o pipefail
cat > active/r0-revert.yaml <<'VPC_YAML'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: r0-revert
  namespace: default
spec:
  ipv4Namespace: default
  vlanNamespace: default
  subnets:
    practice:
      subnet: 10.99.91.0/24
      gateway: 10.99.91.1
      vlan: 1997
VPC_YAML
kubectl apply --dry-run=server -f active/r0-revert.yaml
git config user.name 'Lab Student'
git config user.email 'labstudent@example.invalid'
git add active/r0-revert.yaml
git commit -m 'Add rollback practice VPC'
CREATE=$(git rev-parse HEAD)
printf 'Creation commit: %s\n' "$CREATE"
git push origin main
wait_for_revision() {
  local revision="$1" attempt
  for attempt in $(seq 1 18); do
    if argocd app get hedgehog-config --refresh -o json | jq -e --arg revision "$revision" '.status.sync.status == "Synced" and .status.sync.revision == $revision' >/dev/null; then
      return 0
    fi
    sleep 10
  done
  echo "ArgoCD did not sync revision $revision within 180 seconds" >&2
  return 1
}
wait_for_revision "$CREATE"
kubectl get vpc r0-revert -o json | jq -e '{name: .metadata.name, uid: .metadata.uid, subnet: .spec.subnets.practice} | select(.name == "r0-revert" and .uid != null and .subnet.subnet == "10.99.91.0/24")'
argocd app get hedgehog-config
```

The server-side dry-run checks this manifest against the live API and admission webhook without persisting it. If it fails, do not commit; inspect the error and correct the file. The push triggers ArgoCD's automatic sync; the bounded wait checks that it reached your **actual creation revision**. Record the VPC UID. This unattached VPC need not change an Agent generation, and no gateway or DHCP test is expected.

If a Git push or the revision wait fails, stop and preserve the command output. Inspect the actual application status and repository history before trying again; do not directly `kubectl apply` or delete a resource to hide a GitOps failure. This app tracks `main` with auto-sync, so `argocd app sync --revision <commit>` is rejected; use the revision wait above.

### Task 3: Revert the exact commit and verify prune

Use the `CREATE` value from Task 2. `git revert` makes a new commit that reverses the file addition while preserving the creation commit in history:

```bash
set -o pipefail
git revert --no-edit "$CREATE"
REVERT=$(git rev-parse HEAD)
printf 'Revert commit: %s\n' "$REVERT"
git log -2 --format='%h %s'
git push origin main
wait_for_revision "$REVERT"
VPC_AFTER=$(kubectl get vpc r0-revert -o name --ignore-not-found) && test -z "$VPC_AFTER" && echo 'Practice VPC pruned'
argocd app get hedgehog-config
```

Confirm that the Git log contains **both** your creation commit and its revert, ArgoCD reports Synced at the **revert revision**, and the named VPC is absent. The application's automatic prune performs the deletion after the revert push. Do not claim that any server connectivity was restored: no server was attached in this exercise.

If revert conflicts or prune fails, keep the Git and ArgoCD output and ask for help. Do not force-push, delete the teaching repository, remove finalizers, or manually delete the VPC as a substitute for proving GitOps rollback.

If the shell closes after the creation push, open the checkout under the `rollback-lab-...` directory and inspect `git log --format='%H %s' -- active/r0-revert.yaml` to recover your actual creation hash. Confirm it is your commit before reverting; do not create a second practice VPC or guess a hash. Stop after any failed command and resolve that error before moving to the next step.

### Lab completion record

Write down the creation hash, revert hash, VPC UID observed after creation, final `kubectl get` result and ArgoCD sync status. Keep this record local and omit credentials or other repository contents. The lab attestation is appropriate when the practice VPC is absent and the two commits remain in Git.

## Recovery concepts

### Safe deletion order

When a real VPC has dependents, remove the VPCAttachments and VPCPeerings through the owning GitOps path before removing the VPC. Verify each resource is gone and its affected Agents converge before relying on cleanup. This lab's practice VPC has no dependents, so no attachment or peering deletion is performed. A missing dependent object is not a reason to create a fixture for this lesson.

### Finalizers

Kubernetes finalizers can keep a resource in `Terminating` while a controller performs cleanup. If deletion stalls, inspect the resource, its dependents, controller health and logs. Removing a finalizer can bypass cleanup and leave fabric state behind; it is an escalation decision, not a routine student command. This lesson does not remove finalizers.

### Partial failure

If ArgoCD reports a sync error, read the exact failing resource and message. For a manifest you own, compare it with the live schema using `kubectl apply --dry-run=server -f active/<your-file>.yaml`, fix the file in Git, commit and resync. A client-only dry-run may miss webhook rejection. If `git revert` conflicts, inspect the conflict and resolve the intended file in Git before pushing. Keep both commits and the error output for diagnosis; avoid rewriting shared history.

A rollback is complete when the desired Git revision, ArgoCD's reported sync state and the live resource state agree. A separate server traffic test is needed before claiming application recovery.

## Assessment preparation

The graded quiz checks why `git revert` is safer than a force-push, the dependency order for deleting a VPC with attachments, what to inspect when finalizers stall, and how to respond to a sync error. The hands-on attestation records that you completed the student-owned create/revert/prune cycle above. Neither assessment requires an invented `webapp-vpc` incident or a made-up commit hash.
