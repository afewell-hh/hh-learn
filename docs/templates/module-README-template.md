---
title: "<Concise, scannable module title>"
slug: "<lowercase-hyphen-slug>"
difficulty: "beginner"   # beginner|intermediate|advanced
estimated_minutes: 30
version: "vX.Y.Z"        # optional
validated_on: "2025-10-08"
pathway_slug: "<optional-pathway-slug>"
pathway_name: "<Optional Pathway Name>"
tags: [tag1, tag2, tag3]
media:
  - type: "image"
    url: "https://hedgehog.cloud/hubfs/path/to-diagram.png"
    alt: "Describe what the learner should notice in the diagram."
    caption: "Optional short caption that reinforces the learning point."
    credit: "Photo credit or source if required."
  - type: "video"
    url: "https://cdn.example.com/workflow-demo.mp4"
    alt: "Summarize what the video demonstrates."
    thumbnail_url: "https://cdn.example.com/workflow-demo-poster.jpg"
description: "120–160 chars. What learners will achieve and why it matters."
order: 100

# Agent-ready maintenance (optional but recommended)
products:
  - name: hedgehog-platform
    repo: hedgehog-cloud/platform
    min_version: 1.6.0
scenarios:
  - id: core-task
    title: "<Scenario title – day-in-the-life>"
    persona: "<Who is doing this>"
    environment: "k8s >=1.29, ingress-nginx, cluster-admin"
    steps:
      - id: step-1
        goal: "<Goal of the step>"
        commands:
          - kubectl create namespace learn-k8s
        validate:
          - kubectl get ns learn-k8s -o json | jq -e '.status.phase=="Active"'
      - id: step-2
        goal: "<Goal of the step>"
        commands:
          - kubectl apply -f k8s/deploy.yaml -n learn-k8s
        validate:
          - kubectl rollout status deploy/web -n learn-k8s
ai_hints:
  environment: "kind"
  retries: 1
---

# <Module Title>

Intro paragraph: what learners will do and why it matters.

## Learning Objectives
- Objective 1
- Objective 2
- Objective 3

## Prerequisites
- Access to a Kubernetes cluster (kind/minikube/cloud)
- kubectl configured
- Basic familiarity with <topic>

## Scenario: <Scenario Title>
Provide brief context for the scenario (who, what, why). Keep it realistic and task-focused.

### Step 1: <Step Name>
Explain what’s happening. Then show commands.

```bash
# Commands reflect steps[].commands
echo "example"
```

Validation (what success looks like):
```bash
# Commands reflect steps[].validate
echo "validate"
```

### Step 2: <Step Name>
Explanation and commands…

## Concepts & Deep Dive
Provide supporting explanations, diagrams, and links. Keep this section separate from executable steps.

## Troubleshooting
- Symptom → Cause → Fix

## Resources
- Link to authoritative docs and references
