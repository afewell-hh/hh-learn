---
title: "Fixture Module — VPC provisioning (synthetic)"
slug: "fixture-vpc-provisioning"
validated_on: "2025-10-16"
pathway_slug: "network-like-hyperscaler"
---

# Fixture Module

Synthetic module used only by the experience-lab RED tests. It intentionally
mirrors the real NLH dual-block pattern (command in one fenced block, expected
output in a separate fenced block) so the anti-drift selector logic is exercised
against a stable, decoupled source. Do NOT wire this into content sync.

## Step 2: Apply the VPC

Apply the manifest:

```bash
kubectl apply -f webapp-prod-vpc.yaml
```

**Expected output:**

```
vpc.vpc.githedgehog.com/webapp-prod created
```

Verify the VPC appears:

```bash
kubectl get vpcs
```

## Step 3: Inspect pod logs

Pods live in the `fab` namespace, so `-n fab` is legitimate here:

```bash
kubectl logs -n fab deploy/fabric-ctrl
```
