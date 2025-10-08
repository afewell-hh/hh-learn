---
title: AI-Assisted Content Maintenance
owner: hh-learn project lead
status: living
last-reviewed: 2025-10-08
---

# AI-Assisted Content Maintenance

HHL centers learning content around hands‑on lab exercises because they are concrete, verifiable, and ideal for AI‑assisted maintenance. This document defines the opinionated patterns that make our content “agent‑ready” and the GitOps workflow that keeps it current as products ship new releases.

## Principles
- Lab‑first: every module contains one or more executable lab exercises that drive the learning.
- Scenario‑based: prefer realistic “day‑in‑the‑life” scenarios over feature tours.
- Verifiable steps: each exercise step has explicit commands and validation checks.
- Traceability: map modules to the products and versions they cover.
- Safety: agents propose changes via PRs; humans review and approve.

## Authoring Requirements (Agent‑Ready Labs)
Add these front matter fields to modules (see course-authoring):
```yaml
products:                     # The software this module covers
  - name: hedgehog-platform
    repo: hedgehog-cloud/platform
    min_version: 1.6.0
    channels: [stable]
scenarios:
  - id: sso-tenant-onboarding
    title: "Onboard a new tenant with SSO"
    persona: "Platform engineer"
    environment: "k8s >=1.29, ingress-nginx, oidc idp"
    steps:
      - id: create-namespace
        goal: "Create isolated namespace for tenant"
        commands:
          - kubectl create namespace acme
        validate:
          - kubectl get ns acme -o json | jq -e '.status.phase=="Active"'
      - id: deploy-ingress
        goal: "Expose app via ingress"
        commands:
          - kubectl apply -f k8s/ingress.yaml -n acme
        validate:
          - kubectl get ingress -n acme | grep web
ai_hints:
  retries: 1
  environment: docker|k8s|minikube|kind
  notes: "Prefer curl over wget; avoid raw Host: headers"
```

Guidelines:
- Use stable `id` values for scenarios and steps; agents rely on them.
- Prefer deterministic commands and validations with clear pass/fail.
- Provide minimal environment spec (k8s version, required controllers, cloud creds).
- Keep “explanatory text” separate from the step blocks; agents can prioritize the step blocks.

## GitOps Maintenance Flow
Trigger: a new product release is published (or on schedule) → create validation tasks → run agent validation → open PRs.

1. Release signal
   - From upstream repos via repository_dispatch (event: `product_release`) or schedule.
2. Planning tasks
   - A workflow opens Issues per affected module (labels: `type/content`, milestone=current) with release metadata.
3. Validation run (future)
   - A validation job provisions the lab environment, executes step `commands`, and evaluates `validate` checks.
   - On success: opens a PR bumping `validated_on` and `version` where applicable.
   - On failure: opens an Issue with failed steps and logs; proposes diff suggestions.
4. Review
   - Reviewer confirms changes; merge triggers HubDB sync → publish.

## Repository Configuration
Add a mapping file at repo root to connect products to modules:
```
.hhl-products.yml
products:
  hedgehog-platform:
    repo: hedgehog-cloud/platform
    modules: [intro-to-kubernetes, kubernetes-networking, kubernetes-storage]
```

## Security & Guardrails
- GitHub Actions use the repo’s token with least privilege; no direct prod access.
- Validation environments are ephemeral; never persist credentials in logs.
- Agent output is advisory; PRs require human review.

## Roadmap
- v0.6: Release‑triggered issue creation + PR bump on successful dry‑run.
- v0.7: Scenario framework + validation harness prototype.

