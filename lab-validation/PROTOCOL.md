# Lab Validation Protocol

## Purpose

Defines the repeatable agent-driven process for validating NLH pathway lab exercises from the student perspective. Catches broken instructions, fixes them in curriculum source, and verifies fixes before moving on.

## Scope

**Phase 0 (current):** Sequential validation of all 16 NLH modules on a single student VM in pathway order. One VM, all modules in sequence.

## Module Order (Phase 0)

**Course 1 — Foundations & Interfaces**
1. fabric-operations-welcome
2. fabric-operations-how-it-works
3. fabric-operations-mastering-interfaces
4. fabric-operations-foundations-recap

**Course 2 — Provisioning & Day 1 Operations**
5. fabric-operations-vpc-provisioning
6. fabric-operations-vpc-attachments
7. fabric-operations-connectivity-validation
8. fabric-operations-decommission-cleanup

**Course 3 — Observability**
9. fabric-operations-telemetry-overview
10. fabric-operations-dashboard-interpretation
11. fabric-operations-events-status
12. fabric-operations-pre-support-diagnostics

**Course 4 — Troubleshooting**
13. fabric-operations-troubleshooting-framework
14. fabric-operations-diagnosis-lab
15. fabric-operations-rollback-recovery
16. fabric-operations-post-incident-review

## Infrastructure

- **Dev host:** /home/ubuntu/afewell-hh/hh-learn (this machine)
- **Student VM:** GCP project teched-473722, zone us-west1-c, instance hedgehog-lab
- **VM image:** hedgehog-vaidc-v20260114
- **SSH:** `gcloud compute ssh hedgehog-lab --zone=us-west1-c --project=teched-473722 --command="..."`
- **GUI access (Playwright from dev host):** http://VM_IP:3000 (Grafana), :3001 (Gitea), :8080 (ArgoCD), :9090 (Prometheus)
- **Content source read from:** https://hedgehog.cloud/learn (rendered web, not local files)

## Pre-flight Checklist

1. Launch VM via gcloud
2. Poll SSH every 30s until available (max 10 min)
3. Verify fabric ready: `kubectl get switches` returns 7 switches (max 10 attempts × 60s)
4. Create session report at lab-validation/reports/session-YYYYMMDD-HH.md

## Per-Module Validation Protocol

For each module:

1. **Fetch content** — Load module page from hedgehog.cloud/learn using Playwright
2. **Parse lab section** — Extract discrete ordered steps BEFORE executing anything (separate parse errors from execution errors). Log full step list in session report.
3. **Execute each step:**
   - CLI steps: `gcloud compute ssh hedgehog-lab ... --command="..."` — capture FULL output
   - GUI steps (ArgoCD/Gitea/Grafana): Playwright from dev host to VM public IP
4. **Validate semantically** — Check structure and meaning, not exact string matching (pod names have random suffixes, timestamps vary, etc.)
5. **On failure:**
   a. Log: exact command, full output, expected vs actual in session report
   b. Identify correct instruction
   c. Edit content/modules/[slug]/README.md
   d. Re-execute corrected step to verify it works
   e. Log fix and verification result
   f. `git commit -m "fix(lab): [slug] - [brief description]"` immediately
   g. `npm run sync:content`
   h. Continue to next step
6. **Log module completion** — pass/fail summary, screenshot paths, dependency notes

## Fix Strategy

- Fixes go to `content/modules/[slug]/README.md` only (never HubDB directly)
- Every fix committed to main immediately after verification (before moving on)
- Commit message format: `fix(lab): [slug] — [what was wrong and what was fixed]`
- Run `npm run sync:content` after each fix commit

## Dependency Tracking

Note for each module:
- What state it assumes at start (from previous modules)
- What state it leaves behind (that future modules might depend on)

This feeds Phase 1 (dependency map) and Phase 2 (fast-forward scripts).

## Session Report Format

See reports/session-YYYYMMDD-HH.md for live session report.

Each step entry includes:
- Step description
- Command(s) executed
- Full output
- PASS / FAIL / SKIP
- If FAIL: root cause, fix applied, verification result
