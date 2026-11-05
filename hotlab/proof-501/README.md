# #501 GCP prototype + bounded multi-fabric proof: automation and runbook (Part A)

Parent #497 · Gate #489 · Ticket #501 · Depends on #508 (PR #514, VM controls), #510 (PR #512, guest bootstrap), #500 (PR #509, wiring).

**Status: written, not executed.** The authoring environment had no interpreters, no KVM and no cloud access, so no script here has been run, not even `bash -n`. Everything below is therefore tagged **S** (this tree) or **U**; nothing is **P**. First action for the operator: `bash hotlab/proof-501/check-static.sh` (syntax + guards + shellcheck if present).

Tags: **D** documented · **S** source · **P** proven by execution · **U** unverified.

## 1. Scope and non-goals
Executes the *bounded* proof: 2 Fabrics, 1 control node, 1 server attached to both Fabrics, 1 peer server. Not the 92 GB production topology. No public exposure, no HubSpot activity. If the multi-fabric server is rejected, capture the exact error and file:line and **stop**; do not patch or fork fabric/fabricator (separate customer decision).

## 2. Design constraints (and where each is honoured)
| Constraint | Source | Honoured by |
|---|---|---|
| VLAB needs KVM: `-machine q35,accel=kvm,smm=on`, `-cpu host`, UEFI pflash (`fabricator pkg/hhfab/vlabrunner.go:385,406-407` at `v0.43.1-52-g4c7784de`) | S (per ticket) | `guest/00-preflight.sh` verifies `/dev/kvm`, `vmx`, and starts QEMU with those machine flags before anything else |
| Nested virt unsupported on E2, memory-optimized, ARM, AMD except N4D; Linux KVM L1 only; expect >10% CPU and I/O penalty | D (Google docs) | Intel N2 only (`operator/provision.sh` allowlist); plan for worse than 10%: use generous timeouts (`CONVERGE_TIMEOUT_S`, `RESTART_TIMEOUT_S`) |
| `-cpu host` passthrough constrains machine type | S | N2 + `--min-cpu-platform="Intel Cascade Lake"` (production precedent `labapp/deploy-lab.sh`; that flag is recorded *incompatible* with n1-standard-32, `lab-validation/RESUMPTION.md`). The flag is applied by the #508 workflow (`vars.HOTLAB_MIN_CPU_PLATFORM`), not here |
| Quota: `CPUS`=200, `N2_CPUS`=200, `C2_CPUS`=8, `N2D_CPUS`=16, `INSTANCES`=24, `DISKS_TOTAL_GB`=4096, `SSD_TOTAL_GB`=500 (JSON-parsed by key) | D (corrected on #501) | n2-standard-16 needs 16 N2 CPUs; the #508 pre-flight checks quota by key |
| Size for the minimal proof | ticket | default `n2-standard-16` (64 GB vs ~27.5 GB allocated); `n2-standard-8` (32 GB) is the "retry smaller" option |
| pd-balanced, not SSD | ticket | **Mismatch:** the #508 creator hard-codes `--boot-disk-type=pd-standard`. Record it; do not work around it here. A reviewed change to #508 is needed if pd-balanced is required |
| Create only via #508 controls | ticket | `operator/provision.sh` dispatches `hotlab-vm-create.yml`; `check-static.sh` fails on any direct `gcloud compute instances create/delete` |
| Do not duplicate the bootstrap | ticket | `operator/stage.sh` ships `hotlab/bootstrap/` and the guest runs its `bootstrap.sh` with the ops and VLAB stages **off** |

## 3. Layout
```
hotlab/proof-501/
  README.md                this runbook
  RESULTS-TEMPLATE.md      issue-comment template (control-plane vs data-plane kept separate)
  proof.env.example        every wiring-dependent input; no defaults for 26.05
  check-static.sh          bash -n, shellcheck, guards (no direct create, no fabric patching)
  operator/provision.sh    dispatch #508 creator (dry-run default)
  operator/stage.sh        IAP scp of bootstrap + proof + env + wiring
  operator/teardown.sh     dispatch #508 delete, verify, cost line (dry-run default)
  guest/lib.sh             evidence recorder + node/kubectl access templates
  guest/00-preflight.sh    /dev/kvm first
  guest/10-install-hhfab.sh checksum-pinned 26.05 hhfab (no default URL/digest)
  guest/20-baseline.sh     single-fabric VLAB, needs no wiring diagram
  guest/30-apply-wiring.sh multi-fabric gate: validate/up, stop on REJECTED
  guest/locate-error.sh    read-only grep for file:line of a captured error
  guest/40-checks.sh       acceptance checks 1-7
  guest/report.sh          evidence.jsonl -> summary.json / summary.md (no verdict)
```

## 4. Runbook (operator end to end)

### 4.0 Before anything
1. `bash hotlab/proof-501/check-static.sh` locally. Fix anything it reports.
2. Confirm #514's creator workflow is installed on `main` at `.github/workflows/hotlab-vm-create.yml` (it is staged under `docs/hotlab/gcp-vm-lifecycle/workflows/` until then), its WIF/vars are bootstrapped, and Cloud NAT + IAP exist (#514 RUNBOOK 2.5). Without NAT the VM has no egress and bootstrap fails. **U**
3. Decide on 26.05: you need an https URL and sha256 for the 26.05 `hhfab` archive. This tree deliberately has none. Write down where it came from.

### 4.1 Provision (via #508)
```bash
bash hotlab/proof-501/operator/provision.sh                    # dry run, read the output
bash hotlab/proof-501/operator/provision.sh --execute          # dispatches the creator
```
Wait for the run summary; confirm it shows the control read-back all PASS (terminationTime == expires-at, labels, nested virt). Note the instance name `hotlab-<run>-<attempt>`. Default TTL is 360 min, absolute; **record start time and the hourly price now.** Stop/start is allowed (`operation=stop|start` on the same workflow) but the deadline does not move.

### 4.2 Stage and bootstrap
Prepare `bootstrap.env` from `hotlab/bootstrap/config/bootstrap.env.example` with `HOTLAB_ENABLE_OPS=0`, `HOTLAB_ENABLE_VLAB=0` (the proof drives hhfab itself so you control the working directory; the ops stack is not part of this proof). Prepare `proof.env` from `proof.env.example`. Then:
```bash
bash hotlab/proof-501/operator/stage.sh INSTANCE us-west4-a bootstrap.env proof.env path/to/lab-wiring/ai-factory-26.05
```
and run the printed guest commands (extract, install env, `sudo bash .../bootstrap.sh`).
Note: the pinned hhfab in bootstrap is 0.43.1 and bootstrap may install it; stage 1 below overwrites `/usr/local/bin/hhfab` with the 26.05 build. If bootstrap refuses to proceed without the stage, that is a #512 matter to report, not to patch here. **U**

### 4.3 On the VM (as the `hotlab` user: `sudo -iu hotlab`; add it to `kvm,docker` is done by bootstrap)
```bash
cd ~/p501/hotlab/proof-501 && P=~/p501/proof.env
sudo bash guest/00-preflight.sh $P         # STOP here if /dev/kvm or the QEMU smoke test fails
sudo bash guest/10-install-hhfab.sh $P     # 26.05, checksum-pinned
bash guest/00-preflight.sh $P              # re-run: now also captures hhfab --help output (needed to confirm flags)
```
Read `raw/preflight-*-help.txt` and correct `HHFAB_*` flags and `NODE_SSH_PREFIX` in `proof.env` if they differ. All of those are **U**.

### 4.4 Baseline (can run before #509 lands)
```bash
bash guest/20-baseline.sh $P               # init, gen (default topology), validate, up (tmux 'vlab')
bash guest/40-checks.sh $P converge        # same rule as the multi-fabric run
bash guest/20-baseline.sh $P --stop
```
Only one VLAB fits in RAM; stop the baseline before 4.5.

### 4.5 Multi-fabric gate
```bash
bash guest/30-apply-wiring.sh $P ; echo rc=$?
```
- rc 0: accepted and up; continue.
- **rc 3: REJECTED.** Read `raw/wiring-validate.txt` and `raw/locate-wiring-validate.txt`. Open the matching `FABRIC_SRC`/`FABRICATOR_SRC` tag and confirm the file:line by reading it. Fill the template §4/§5 with the exact error and file:line. Run `guest/report.sh`, tear down (4.8), **stop**. Do not edit the diagram to evade the error, and do not patch fabric.

### 4.6 Acceptance checks
```bash
bash guest/40-checks.sh $P adopt           # 1
bash guest/40-checks.sh $P nics            # 2 (initial snapshot)
bash guest/40-checks.sh $P converge        # 3
bash guest/40-checks.sh $P lldp-bgp        # 4
bash guest/40-checks.sh $P probes          # 5 (needs POS_*/NEG_* from the diagram's VPC/IP plan)
bash guest/40-checks.sh $P restart         # 6 + 7 (reboots RESTART_SWITCH; re-snapshots NICs; marker persistence)
bash guest/40-checks.sh $P vlab-restart --confirm   # OPTIONAL 7b: stop/start whole VLAB in the same directory
bash guest/report.sh $P
```
Or `40-checks.sh $P all` for 1-6. Read each status literally: INCONCLUSIVE means a control failed (e.g. destination not demonstrably alive), and must be reported as inconclusive, not retried until it passes.

What each check does and what it does **not** show:
| Check | Method (all commands are U for 26.05 until the `--help` captures are read) | Not shown |
|---|---|---|
| 1 | Agent object exists per expected switch, grouped per Fabric by `SWITCHES_<fabric>` | That the switch is healthy, only that it was adopted |
| 2 | `/sys/class/net` names, MACs, PCI addresses on the multi-fabric server; count vs `EXPECTED_MULTI_SERVER_NICS`; diff against the initial snapshot after the switch restart | Mapping NIC → Connection (read it from the diagram) |
| 3 | `status.lastAppliedGen == metadata.generation` per Agent (the APPLIEDG/CURRENTG columns), polled; Kubernetes events are recorded as context only (none expected, #368/#481) | Isolation or forwarding correctness |
| 4 | `show lldp table` row count; every BGP peer entry in `vtysh show bgp summary json` is `Established` | That routes are right |
| 5 | `ping -c5` positive; negative with three controls: destination reachable out-of-band, address configured and answering locally, source can reach `NEG_CTRL_DST_IP`, and positive passed | **Qualified isolation.** One emulated observation; requires separate data-plane evidence |
| 6 | NOS `sudo reboot` of `RESTART_SWITCH`; uptime reset proves it happened; other switches, both servers must not reset uptime; Fabrics reconverge; NIC names unchanged | Behaviour of a hard power-off of the VM |
| 7 | Marker files in `$HOME` and `/etc` plus `sonic-installer list` before/after reboot; optional full VLAB stop/start with qcow2 listing | Persistence across `hhfab vlab` rebuild with a fresh directory (expected not to persist) |

### 4.7 Collect evidence (before deleting the VM)
```bash
tar -C "$(dirname "$PROOF_OUT")" -czf /tmp/proof501-out.tgz "$(basename "$PROOF_OUT")"
```
Copy it off with `gcloud compute scp --tunnel-through-iap --zone ZONE INSTANCE:/tmp/proof501-out.tgz .`. Fill `RESULTS-TEMPLATE.md` from `summary.md` and `raw/`; paste as the comment on #501.

### 4.8 Teardown
```bash
bash hotlab/proof-501/operator/teardown.sh INSTANCE                       # dry run
bash hotlab/proof-501/operator/teardown.sh --execute INSTANCE START_UTC HOURLY_RATE_USD
```
Then run `hotlab-cloud.yml` with `operation=inventory` and confirm the instance is absent. The terminationTime and the reaper are the backstop, not the plan. Stop for review; do not extend to the production topology.

## 5. Open items (all U, found while writing; none resolved)
1. **hhfab 26.05 CLI**: `init` wiring flag, `vlab gen` flags, `vlab ssh` syntax, `validate` existence and semantics are assumed from 0.43.x habits. `00-preflight.sh` captures `--help` to settle it.
2. **Control-node kubectl**: `KCTL_CMD="sudo k3s kubectl"` and Agent field names `status.lastAppliedGen`, `metadata.generation` are assumed.
3. **SONiC commands**: `sudo show lldp table`, `sudo vtysh -c 'show bgp summary json'`, `sonic-installer list`; remote-quoting through `hhfab vlab ssh` is untested.
4. **Wiring diagram contents** (#509): not readable from the authoring branch; fabric/switch/server names, IP plan and probe targets are inputs, never defaults. The check on "per-Fabric VPCAttachment coherence" is answered by the operator in the template, from objects the diagram actually contains.
5. **#514 creator** does not deliver user-data or `bootstrap.env`, uses pd-standard, and requires NAT/IAP to be in place.
6. **Bootstrap with VLAB off** and an unpinned 26.05 hhfab: whether `bootstrap.sh` tolerates this is unverified.
7. `locate-error.sh` is a literal-string grep heuristic and gives candidates only.
8. Cost: no hourly price is hard-coded. Record the dated list price for the chosen type.
