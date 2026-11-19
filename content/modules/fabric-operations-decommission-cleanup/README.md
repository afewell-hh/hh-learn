---
title: "Decommission & Cleanup"
slug: "fabric-operations-decommission-cleanup"
difficulty: "beginner"
estimated_minutes: 25
version: "v1.1.0"
validated_on: "2026-11-19"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - decommission
  - cleanup
  - lifecycle
  - operations
description: "Delete the course VPC and attachments in dependency order, then observe bounded Agent convergence."
order: 204
---

# Decommission & Cleanup

## Introduction

Courses 2.1–2.3 create `webapp-prod`, attach server-01 and server-05, and inspect the resulting state. This module removes those **course-owned** resources in dependency order. It does not delete the `test-vpc` from Foundations or any other learner's VPC. The application-migration story is an example; the lab does not prove an application was serving traffic or has been migrated.

Deleting a Kubernetes object and applying the resulting switch configuration are separate observations. The `kubectl delete` response says the API accepted the deletion. Agent desired specs and `APPLIEDG == CURRENTG` show what the control plane later reported. A separate dataplane test would be needed to prove traffic behavior.

### Learning objectives

After this module, you can:

1. Identify the exact VPC and attachments owned by the exercise.
2. Save the VPC manifest and delete attachments before the VPC.
3. Wait for the affected Agents to converge after each deletion stage.
4. Verify the named resources and Agent desired entries are gone without treating an empty `grep` as proof.
5. Explain when to stop and preserve evidence rather than forcing cleanup.

## Prerequisites

Complete Courses 2.1–2.3 on the same running lab VM. The expected objects are `webapp-prod`, `server-01-web-servers` and `server-05-worker-nodes`. Run all Bash blocks below as `ubuntu` in the same terminal session; Task 3 uses the bounded helper defined in Task 2. If any expected object is missing or another student is editing the same fabric, stop and inspect before deleting anything.

## Lab: remove the course-owned resources

### Task 1: Inventory and back up

```bash
set -o pipefail
kubectl config current-context
kubectl get vpcs
kubectl get vpcattachments -o wide
kubectl get vpc webapp-prod -o yaml > webapp-prod-backup.yaml
kubectl get vpcattachments -o json | jq -e '[.items[] | select((.spec.subnet // "") | startswith("webapp-prod/")) | .metadata.name] | sort == ["server-01-web-servers", "server-05-worker-nodes"]'
kubectl get agents
```

Expect context `vlab` and a `true` result from the attachment check. The two names are not `web-app` attachments; they refer to subnets under `webapp-prod`. Keep `webapp-prod-backup.yaml` in your local home directory for the course record. Do not proceed if the JSON check is false or an API command fails. A separate `test-vpc` may still be present from Course 1.2 and is outside this deletion.

### Task 2: Delete attachments, then wait for the four leaves

Delete only the two named attachments:

```bash
kubectl delete vpcattachment server-01-web-servers &&
kubectl delete vpcattachment server-05-worker-nodes &&
kubectl get vpcattachments -o json | jq -e '[.items[] | select((.spec.subnet // "") | startswith("webapp-prod/"))] | length == 0'
```

Define a bounded check for the affected leaves. After attachment deletion, it checks that both attachment entries have left each Agent's desired spec; the VPC entry may still be present. After VPC deletion, it checks that the VPC entry has also gone. Both stages require all four reported applied generations to match their current generations. It polls for up to ten minutes because a prior released-image run took about 195 seconds after attachment deletion; a fixed 30-second assumption was too short.

```bash
wait_for_affected_leaves() {
  local phase="$1" attempt agents
  case "$phase" in attachments|vpc) ;; *) echo 'Choose attachments or vpc' >&2; return 1 ;; esac
  for attempt in $(seq 1 60); do
    agents=$(kubectl get agents -o json) || return 1
    if printf '%s\n' "$agents" | jq -e --arg phase "$phase" '
      [.items[]
       | select(.metadata.name == "leaf-01" or .metadata.name == "leaf-02" or .metadata.name == "leaf-03" or .metadata.name == "leaf-04")
       | select(
           (.status.lastAppliedGen == .metadata.generation) and
           (.spec.vpcAttachments["server-01-web-servers"] == null) and
           (.spec.vpcAttachments["server-05-worker-nodes"] == null) and
           ($phase == "attachments" or .spec.vpcs["webapp-prod"] == null)
         )]
      | length == 4' >/dev/null; then
      printf 'Affected leaves converged after %s checks (%s)\n' "$attempt" "$phase"
      return 0
    fi
    sleep 10
  done
  echo 'Affected leaves did not converge within ten minutes' >&2
  return 1
}
wait_for_affected_leaves attachments
kubectl get agents
```

If the check times out or `kubectl` fails, **stop**. Record the command error or `kubectl get agents` output and ask for help. Do not delete the VPC, strip finalizers or rewrite Agent objects to make the lesson pass. The deletion can be in flight after the API removes an attachment.

### Task 3: Delete the VPC, then check convergence again

First confirm no attachment still references this VPC, then remove only `webapp-prod`:

```bash
wait_for_affected_leaves attachments &&
kubectl get vpcattachments -o json | jq -e '[.items[] | select((.spec.subnet // "") | startswith("webapp-prod/"))] | length == 0' &&
kubectl delete vpc webapp-prod &&
wait_for_affected_leaves vpc
```

The second wait is intentional: VPC deletion is another change, even if it converges quickly. If it times out, preserve the Agent status and stop. Do not infer success from the delete command alone.

### Task 4: Verify the final state

```bash
VPC_AFTER=$(kubectl get vpc webapp-prod -o name --ignore-not-found) && test -z "$VPC_AFTER" && echo 'webapp-prod absent'
kubectl get vpcattachments -o json | jq -e '[.items[] | select((.spec.subnet // "") | startswith("webapp-prod/"))] | length == 0'
wait_for_affected_leaves vpc
kubectl get agents
kubectl get vpcs
```

The first check fails if the API read fails; an empty string is only meaningful after a successful read. The attachment check examines the `spec.subnet` key rather than a guessed name fragment. The helper checks **all four** relevant Agent specs and their generations. An absent VPC key in an Agent's desired spec alone would not prove that Agent applied the change; matching `APPLIEDG` and `CURRENTG` adds that reported-applied observation. These checks do not claim a dataplane teardown test.

`test-vpc` may remain from Foundations. The success condition here is that **this** course VPC and its attachments are absent and the affected Agents have converged, not that every fabric resource has been erased.

### Task 5: Record what happened

In a local note, record the backup filename, the names you deleted, the completion time for each wait, the final resource checks and any error. Keep the backup until you no longer need it for the course; do not re-apply it just to redo this lab. The hands-on attestation means you completed the named deletion and checks above.

## Recovery and lifecycle concepts

Remove dependent attachments and peerings through their owning workflow before deleting a real VPC. A controller may hold a deletion with a finalizer while it cleans up. If a resource remains `Terminating` or an Agent does not converge, inspect the object, dependents, Agent status and controller logs before acting. Removing finalizers or forcing deletion can bypass cleanup and is not part of this student exercise.

Keeping a VPC is appropriate when its application still needs it, another lab step depends on it, or deletion ownership is unclear. Deleting the wrong VPC is harder to recover from than waiting for evidence. This lab's authorized targets are only the two named attachments and `webapp-prod`.

## Assessment preparation

Be ready to explain the dependency order, the difference between API deletion and Agent convergence, why `grep web-app` did not test these attachment names, and why a missing VLAN string in one Agent YAML is not proof that four switches applied cleanup. Your local record is evidence for the lab attestation.
