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
| 2 | fabric-operations-how-it-works | ✅ PASS (fixed: agent namespace -n fab→default; VPC events don't appear — corrected) |
| 3 | fabric-operations-mastering-interfaces | ✅ PASS (fixed: myfirst-vpc→test-vpc; 3 Grafana UIDs; Grafana password; Gitea repo structure; kubectl logs cmd) |
| 4 | fabric-operations-foundations-recap | ✅ PASS (no lab — reflection module) |
| 5 | fabric-operations-vpc-provisioning | ✅ PASS (fixed: VPC name web-app-prod→webapp-prod (11-char limit); fixed event expectations) |
| 6 | fabric-operations-vpc-attachments | ✅ PASS (fixed: -n fab flags on switches/servers/connections; VPC name; event expectations; expected output columns) |
| 7 | fabric-operations-connectivity-validation | ✅ PASS (fixed: -n fab flags; VPC name; event expectations; expected output columns; event concepts → agent generation docs) |
| 8 | fabric-operations-decommission-cleanup | ✅ PASS (fixed: -n fab flags; VPC name; event expectations; expected output columns; webhook error message) |
| 9 | fabric-operations-telemetry-overview | ✅ PASS (fixed: localhost→YOUR_VM_IP URLs; cpu_usage_percent→fabric_agent_interface_in_utilization; interface_bytes_out→fabric_agent_interface_out_octets; bgp_neighbor_state→fabric_agent_bgp_neighbor_session_state with numeric state 6=Established; switch→hostname label; EthernetN→E1/N) |
| 10 | fabric-operations-dashboard-interpretation | ✅ PASS (fixed: localhost→YOUR_VM_IP; prom-operator→admin; all 6 dashboard names wrong; BGP count 40→62; BGP panel names; Interface dashboard variable-based; Platform panel names; Logs panel names; EthernetN→E1/N) |
| 11 | fabric-operations-events-status | ✅ PASS (major rewrite: entire "kubectl events" premise wrong — fabric CRDs emit no K8s events; rewrote to use admission webhooks + Agent CRD generation counters) |
| 12 | fabric-operations-pre-support-diagnostics | ✅ PASS (fixed: -n fab flags; fabric-controller-manager→fabric-ctrl; localhost→YOUR_VM_IP; bgp metric/label names; EthernetN→E1/N; events step→admission webhook + Agent CRD; all 6 Grafana dashboard names) |
| 13 | fabric-operations-troubleshooting-framework | ✅ PASS (fixed: Layer 1 "K8s Events" completely rewritten to "Resource Existence + Agent Convergence"; -n fab flags; localhost→YOUR_VM_IP; EthernetN→E1/N with jq bracket notation; counter fields ine/oute→ind/outbps; fabric-controller-manager→fabric-ctrl) |
| 14 | fabric-operations-diagnosis-lab | ✅ PASS (fixed: -n fab flags; localhost→YOUR_VM_IP; fabric-controller-manager→fabric-ctrl; EthernetN→E1/N; kubectl events refs→resource check + Agent CRD; Grafana dashboard names; assessment answers) |
| 15 | fabric-operations-rollback-recovery | ✅ PASS (fixed: localhost→YOUR_VM_IP; Gitea username student→student01; removed hardcoded ArgoCD password; -n fab flags; EthernetN→E1/N; fabric-controller-manager→fabric-ctrl; kubectl events→Agent convergence; Grafana dashboard names) |
| 16 | fabric-operations-post-incident-review | ✅ PASS (fixed: "no error events"→admission webhook framing; timeline "checked kubectl events"→admission webhook + Agent CRD; Ethernet8→E1/8; "Events →"→"Resource check →"; HCFO competency kubectl events→admission webhook errors) |

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
| 2: how-it-works | Module 1 complete | test-vpc (VLANs 1998/1999, subnets 10.99.1.0/24 + 10.99.2.0/24) |
| 3: mastering-interfaces | test-vpc exists | None (read-only exploration) |
| 4: foundations-recap | None | None (no lab) |
| 5: vpc-provisioning | Fresh fab state OK | webapp-prod VPC (VLANs 1010/1020, subnets 10.10.10.0/24 + 10.10.20.0/24) |
| 6: vpc-attachments | webapp-prod exists | server-01-web-servers (webapp-prod/web-servers), server-05-worker-nodes (webapp-prod/worker-nodes) |
| 7: connectivity-validation | Both VPCAttachments exist | None (read-only validation) |
| 8: decommission-cleanup | Both VPCAttachments exist | All webapp-prod resources DELETED; fabric back to clean state |
| 9 | Clean fabric (only test-vpc remains from module 2) | None (read-only Prometheus queries) |
| 10+ | Clean fabric (only test-vpc remains from module 2) | TBD |

---

## Content Fixes Applied This Session

| # | Module | Issue | Fix | Git Commit |
|---|--------|-------|-----|------------|
| 1 | accessing-the-hedgehog-virtual-ai-data-center | `--min-cpu-platform="Intel Cascade Lake"` incompatible with n1-standard-32 | Removed flag | 4e95b75 |
| 2-10 | Various NLH modules | See session report for details | Various fixes | See report |
| 11 | fabric-operations-events-status | Entire module built on kubectl events which don't exist for fabric CRDs | Complete rewrite using admission webhooks + Agent CRD generation counters | a0505fe |
| 12 | fabric-operations-pre-support-diagnostics | -n fab flags, controller name, localhost URLs, events step, interface naming, Grafana names | Multiple targeted fixes | 6b695be |
| 13 | fabric-operations-troubleshooting-framework | Layer 1 "K8s Events" wrong, -n fab flags, localhost, interface naming, counter fields, controller name | Complete Layer 1 rewrite + targeted fixes | 3e57111 |
| 14 | fabric-operations-diagnosis-lab | -n fab flags, localhost, controller name, interface naming, kubectl events, Grafana names, assessment answers | Multiple targeted fixes | 93e67a3 |
| 15 | fabric-operations-rollback-recovery | localhost URLs, Gitea username, hardcoded ArgoCD password, -n fab flags, interface naming, controller name, kubectl events | Multiple targeted fixes | 21b65ec |
| 16 | fabric-operations-post-incident-review | "no error events" framing, timeline kubectl events, Ethernet8→E1/8, "Events →" in diagnostic layer list, HCFO competency | Minor targeted fixes | 13c19d5 |

---

## Key Files

- `lab-validation/PROTOCOL.md` — Full validation protocol
- `lab-validation/RESUMPTION.md` — This file (resumption guide)
- `lab-validation/reports/session-20260219-01.md` — Detailed session log with per-step output
- `content/modules/[slug]/README.md` — Source files to fix when issues are found
- `.env` — Contains credentials (never expose values in issues/commits)
