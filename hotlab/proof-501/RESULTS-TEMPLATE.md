# #501 results (paste as the issue comment; fill every field or write `NOT RUN`)

Tag every statement **D** documented · **S** source (file:line) · **P** proven by execution in this run · **U** unverified.
Machine-readable evidence: `summary.json` / `summary.md` / `evidence.jsonl` / `raw/` from `guest/report.sh`.

## 0. Boundaries (keep these sentences)
- VLAB convergence and BGP/LLDP state are **control-plane** evidence.
- Probe results are single observations in **software switches on nested KVM**. They are not qualified isolation evidence and support **no** ASIC, GPU, RDMA or line-rate claim (#492).
- Nothing in fabric/fabricator was patched, forked or rewritten to obtain these results. [ ] confirmed

## 1. Instance and cost
| Field | Value |
|---|---|
| Creator workflow run (#514 path) | |
| Instance name / zone | |
| Machine type, vCPU/RAM | |
| Boot disk (type, GB) — note creator uses pd-standard, ticket asked pd-balanced | |
| `terminationTime` (absolute) | |
| Hourly list price, **date and source** | |
| Running hours (start→delete, UTC) incl. stops | |
| Compute cost (hours × rate) + disk estimate | |
| Deleted at / how confirmed (`hotlab-cloud` inventory run) | |

## 2. KVM and 26.05 provenance
| Item | Value | Tag |
|---|---|---|
| `/dev/kvm`, vmx, QEMU `-machine q35,accel=kvm,smm=on -cpu host` smoke (raw/kvm-*, qemu-kvm-smoke) | | |
| How 26.05 hhfab was obtained (URL, archive sha256, binary sha256, `hhfab version`) | | |
| Evidence it is the 26.05 release | | U unless confirmed |
| hhfab flags actually used (`init`, `gen`, `up`) vs `--help` captures | | |
| Wiring diagram commit (PR #509) | | |

## 3. Baseline single-fabric VLAB
Result (stage 2): up / not up; time to converge; `evidence.jsonl` ids `baseline-*`; exact errors if any.

## 4. Multi-fabric proof
**Gate (stage 3):** `hhfab init/validate/vlab up` ACCEPTED / REJECTED.
If REJECTED: paste `raw/wiring-validate.txt` verbatim and the confirmed **file:line** (from `raw/locate-*.txt`, confirmed by a human reading the source at the matching tag). **Stop here; do not continue to the checks.**

| # | Acceptance check | Evidence ids | Status (PASS / FAIL / INCONCLUSIVE / NOT RUN) | Scope | Exact observation | Tag |
|---|---|---|---|---|---|---|
| 1 | Controller adopts switches in both Fabrics | `c1-adopt-*` | | control-plane | | |
| 2 | Multi-fabric server NICs per Connection, stable naming | `c2-*` | | host | | |
| 3 | Both Fabrics converge (Agent lastAppliedGen == generation; no K8s events, #368/#481) | `c3-converge-*` | | control-plane | | |
| 4 | LLDP / BGP within each Fabric | `c4-*` | | control-plane | | |
| 5a | Positive probe (+ controls) | `c5-positive` | | data-plane, VLAB-emulated | | |
| 5b | Negative probe (+ dead-endpoint and source-path controls) | `c5-negative` | | data-plane, VLAB-emulated | | |
| 6 | Restart one switch: rest of fabric and server survive | `c6-*` | | host + control-plane | | |
| 7 | Writable-disk / NOS-install state persists across restart | `c7-*`, `v7-*` | | host | | |

Rules for the Status column: a probe is PASS only if its controls held. INCONCLUSIVE is a result, not a failure to report.

### Per-Fabric VPCAttachment coherence (PR #509 README tagged-U assumption)
Is per-Fabric VPCAttachment coherent when each Fabric owns its own address and VLAN namespaces? Answer with the exact objects accepted/rejected and the observed behaviour. **NOT RUN** if the diagram contains no such objects.

## 5. Verdict
One of:
- **ACCEPTED AND WORKS (control-plane)**: a Server with Connections into multiple Fabrics was accepted, came up, both Fabrics converged, probes behaved with controls. State the limits in §0.
- **ACCEPTED, PARTIAL**: list which checks failed or were inconclusive.
- **REJECTED**: exact error and file:line. No workaround attempted.

Verdict: 

## 6. Commands and outputs
Attach or link: `evidence.jsonl`, `summary.json`, `raw/` (tarball). Quote the exact commands from the `$ ...` first line of each raw file for anything cited above.

## 7. Not done / deviations
List every step skipped, every flag that differed from this runbook, and every U left open.
