# Lab Validation — Resumption Guide

If you are a new agent picking up this work, read this file first. It tells you exactly where we are and how to continue.

---

## Current Status

**Session:** session-20260219-01
**Phase:** Phase 0 — Sequential validation of all 16 NLH modules on one VM
**Active VM:** `hedgehog-lab` in GCP project `teched-473722`, zone `us-west1-c`
**VM IP:** 34.169.168.110 (check if still valid — see "Check VM status" below)
**VM Image:** hedgehog-vaidc-v20260114

### Module Progress

| # | Module Slug | Status |
|---|-------------|--------|
| 1 | fabric-operations-welcome | ✅ PASS |
| 2 | fabric-operations-how-it-works | 🔲 NOT STARTED |
| 3 | fabric-operations-mastering-interfaces | 🔲 NOT STARTED |
| 4 | fabric-operations-foundations-recap | 🔲 NOT STARTED |
| 5 | fabric-operations-vpc-provisioning | 🔲 NOT STARTED |
| 6 | fabric-operations-vpc-attachments | 🔲 NOT STARTED |
| 7 | fabric-operations-connectivity-validation | 🔲 NOT STARTED |
| 8 | fabric-operations-decommission-cleanup | 🔲 NOT STARTED |
| 9 | fabric-operations-telemetry-overview | 🔲 NOT STARTED |
| 10 | fabric-operations-dashboard-interpretation | 🔲 NOT STARTED |
| 11 | fabric-operations-events-status | 🔲 NOT STARTED |
| 12 | fabric-operations-pre-support-diagnostics | 🔲 NOT STARTED |
| 13 | fabric-operations-troubleshooting-framework | 🔲 NOT STARTED |
| 14 | fabric-operations-diagnosis-lab | 🔲 NOT STARTED |
| 15 | fabric-operations-rollback-recovery | 🔲 NOT STARTED |
| 16 | fabric-operations-post-incident-review | 🔲 NOT STARTED |

**UPDATE THIS TABLE** as you complete modules.

---

## How to Resume

### Step 1: Check VM status

```bash
gcloud compute instances list --project=teched-473722 --format="table(name,zone,status,networkInterfaces[0].accessConfigs[0].natIP)"
```

- If **RUNNING**: proceed directly to Step 2
- If **TERMINATED/STOPPED**: start it: `gcloud compute instances start hedgehog-lab --zone=us-west1-c --project=teched-473722`, then wait ~2 min
- If **missing**: the VM was deleted — create a new one with the command in PROTOCOL.md, then re-run all completed modules' state-creating steps (see Dependency Map below) before resuming at the next incomplete module

### Step 2: Verify fabric is ready

```bash
gcloud compute ssh hedgehog-lab --zone=us-west1-c --project=teched-473722 --command="kubectl get switches"
```

Expected: 7 switches listed. If the API server is not ready yet, retry every 60s up to 10 times.

### Step 3: Resume at the next incomplete module

Look at the Module Progress table above. Find the first 🔲 entry. That's where you pick up.

**Important:** If the previous session validated modules that created Kubernetes state (VPCs, VPCAttachments, etc.), that state should still be present on the VM (assuming it wasn't deleted). Verify by checking what the next module expects as prerequisites, then confirm it's present before proceeding.

### Step 4: Update this file

After completing each module, update the Module Progress table and the Dependency Map below.

---

## Validation Protocol Summary

For each module:
1. Fetch lab content from `https://hedgehog.cloud/learn/modules/[slug]` (use WebFetch to get rendered web content)
2. Parse all lab steps before executing anything
3. Execute CLI steps via: `gcloud compute ssh hedgehog-lab --zone=us-west1-c --project=teched-473722 --command="..."`
4. Execute GUI steps (ArgoCD :8080, Gitea :3001, Grafana :3000) via Playwright from dev host to VM IP
5. On failure: fix `content/modules/[slug]/README.md`, re-verify fix works, commit immediately to main, run `npm run sync:content`
6. Log results in `lab-validation/reports/session-20260219-01.md` and update this file's Module Progress table

**Fix commit format:** `fix(lab): [slug] — [what was wrong and what was fixed]`

**Working directory:** `/home/ubuntu/afewell-hh/hh-learn`

---

## SSH / Access Reference

```bash
# SSH to VM
gcloud compute ssh hedgehog-lab --zone=us-west1-c --project=teched-473722

# Run a command via SSH
gcloud compute ssh hedgehog-lab --zone=us-west1-c --project=teched-473722 --command="kubectl get vpcs"

# VM service URLs (replace IP if it changed)
# Grafana:    http://34.169.168.110:3000  (admin / admin)
# Gitea:      http://34.169.168.110:3001  (student01 / hedgehog123)
# ArgoCD:     http://34.169.168.110:8080  (admin / see below)
# Prometheus: http://34.169.168.110:9090

# Get ArgoCD password
gcloud compute ssh hedgehog-lab --zone=us-west1-c --project=teched-473722 \
  --command="kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d && echo"
```

---

## Dependency Map (updated as modules complete)

| Module | State assumed at start | State created |
|--------|----------------------|---------------|
| 1: welcome | Fresh fabric | None (read-only) |
| 2+ | TBD during validation | TBD |

---

## Content Fixes Applied This Session

| # | Module | Issue | Fix | Git Commit |
|---|--------|-------|-----|------------|
| 1 | accessing-the-hedgehog-virtual-ai-data-center | `--min-cpu-platform="Intel Cascade Lake"` incompatible with n1-standard-32 | Removed flag | 4e95b75 |

---

## Key Files

- `lab-validation/PROTOCOL.md` — Full validation protocol
- `lab-validation/RESUMPTION.md` — This file (resumption guide)
- `lab-validation/reports/session-20260219-01.md` — Detailed session log with per-step output
- `content/modules/[slug]/README.md` — Source files to fix when issues are found
- `.env` — Contains credentials (never expose values in issues/commits)
