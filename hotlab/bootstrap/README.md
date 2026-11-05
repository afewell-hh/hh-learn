# Hot Lab portable bootstrap (issue #510, parent #497)

Takes a plain **Ubuntu 24.04 amd64** VM to a running Hot Lab (ops cluster + VLAB as a
resumable service). **No provider-specific commands exist anywhere in this tree**;
`check-portability.sh` enforces that mechanically.

Evidence tags: **D** documented, **S** sourced from `afewell-hh/labapp` (path cited),
**P** proven by execution, **U** unverified. *Nothing in this PR is tagged P: the
authoring environment could not execute scripts or reach the network.*

## Layers

| Layer | Provider-specific | Where |
|---|---|---|
| Provision (VM, disk, network, nested virt) | yes, thin | #508 (GCP) / Proxmox later: **not in this tree** |
| Bootstrap (booted Ubuntu → running lab) | **no** | `hotlab/bootstrap/` |

Entry contract: *root, fresh Ubuntu, network egress, `/etc/hotlab/bootstrap.env` present.*
The guest never queries a metadata server; everything it needs is in that file.

## Input contract (provision layer → guest)

Template: `config/bootstrap.env.example`. Deliver to `/etc/hotlab/bootstrap.env`, root-owned, 0600.

| Input | Required | Notes |
|---|---|---|
| `/dev/kvm` | yes | Nested virt must be on. GCP: nested-virtualization flag; Proxmox: CPU type `host`; libvirt: `host-passthrough`. Bootstrap fails fast if absent. |
| `HOTLAB_MGMT_IMAGE` | ops | `image@sha256:<64 hex>`; non-digest refs are rejected. |
| `HOTLAB_ARGOCD_CHART_VERSION`, `HOTLAB_GITEA_CHART_VERSION` | ops | Exact versions. `REPLACE_ME` placeholders abort the run. |
| `HOTLAB_BIND_ADDRESS` | no | Default `127.0.0.1`. Firewalling is the provision layer's job. |
| `HOTLAB_HHFAB_INIT_ARGS` | VLAB | **No default (fail closed).** Must carry the fabric credentials. `--dev` (public upstream dev credentials) is refused unless `HOTLAB_ALLOW_DEV_CREDENTIALS=1`. |
| `HOTLAB_EXPECT_SWITCHES/CONTROLS/SERVERS` | VLAB | Required; `verify.sh` asserts exact QEMU counts by VM-name prefix. There is no "0 = skip" any more. |
| `HOTLAB_VLAB_HEALTH_CMD` | VLAB | Required switch/control health probe (exit 0 only when healthy). Operator-supplied because the 0.43.1 command is unverified. |
| `HOTLAB_SWITCH_NOS_CMD` | persistence test | `CMD <switch>` exits 0 only if that switch runs its installed NOS. |
| `HOTLAB_VLAB_GEN_ARGS`, `HOTLAB_VLAB_UP_ARGS` | no | Passed to hhfab verbatim (**U**). `-f/--recreate` rejected. |
| Booleans | no | `HOTLAB_ENABLE_OPS/VLAB`: 1/0, true/false, yes/no, on/off; anything else aborts (no silent disable). |

**Preflight.** `bootstrap.sh` validates the entire contract (file owner/mode, arch/OS, `/dev/kvm`, digests, versions, argument characters, expectations, the portability guard) in one `preflight_contract` call *before* any package install, download, account creation, sudoers change or state directory.

## Run it

```bash
# Path A: any provider with cloud-init. Provision layer delivers user-data.yaml plus the env file.
#   cloud-init/user-data.yaml  (needs HOTLAB_BOOTSTRAP_REPO + 40-hex HOTLAB_BOOTSTRAP_REF in the env file)

# Path B: no cloud-init (Proxmox console, libvirt, bare metal). Identical code:
sudo install -d -m 0755 /etc/hotlab && sudo install -m 0600 bootstrap.env /etc/hotlab/bootstrap.env
sudo bash hotlab/bootstrap/bootstrap.sh         # converges, then runs verify.sh
sudo bash hotlab/bootstrap/verify.sh            # any time, read-only
# (scripts are committed without the exec bit; always invoke via `bash`)
```

- **GCP prototype:** #508's provision step creates the VM (nested virt on) and supplies the same env file via instance user-data/`write_files`. Nothing in the guest changes.
- **Proxmox production:** VM CPU `host`, cloud-init drive carrying `user-data.yaml` + env file, or Path B from the console. Same `bootstrap.sh`.
- Idempotence design: flock; every download is skipped when the on-disk sha256 already matches the pin; `apt-get install` and `helm upgrade --install` converge; an existing k3d cluster is *started, never recreated*; secrets are generated once and reused; unit install overwrites identical content. **U: a second run was not executed.**

## What was adopted from labapp, what changed

| Item | labapp source (S) | Here | Why different |
|---|---|---|---|
| k3d v5.7.4 + sha256 | `build/provision/install-k3d.sh` | `lib/pins.sh`, `bootstrap.sh` | Same pin and digest; inlined helper. |
| kubectl 1.35.0, helm 3.19.4, hhfab 0.43.1 digests | `install-kubectl.py`, `observability-inputs.yaml`, provision README | `lib/pins.sh` | labapp cloud-config used `stable.txt`/`get-helm-3 main`/`i.hhdev.io/hhfab` (all floating). Digests are copied, **U** until first run. |
| Ops cluster config | `management-cluster.yaml` | `ops/management-cluster.yaml` | Added ArgoCD 8080 and Gitea 3001 mappings; names/paths parameterised. |
| Observability values | `observability-values.yaml` (chart 65.2.0) | `ops/observability-values.yaml` | + NodePorts, Alertmanager off (memory). **U** against chart. |
| VLAB unit | `hhfab-vlab-resume.service`, `journald@labapp-vlab.conf` | `vlab/` | Single start/resume unit; labapp's `vlab_core.py` gate/ready state machine **not ported**. |
| Docker | `get.docker.com` | Ubuntu `docker.io` (optional exact version) | Script is unpinned and non-idempotent. Version is recorded, not pinned, by default. |

**Dropped, with reasons:** xrdp, xfce4, Firefox, VS Code, `.desktop`/mimeapps files, DISPLAY exports, xfconf, `chpasswd ubuntu:HHLab.Admin!` and desktop autologin. They serve a single-user workstation; on a shared always-on host they are attack surface. Node 20 also dropped (nothing headless here uses it). `tcpdump/iftop/traceroute`, `gh`, `kustomize`, `yq`, `oras` dropped for leanness; trivially re-addable. ORAS especially: re-add if the course images need pulling by OCI artefact. I found no part of the desktop stack worth keeping.

Service account `hotlab`: no password, `nologin` shell. It has `NOPASSWD: ALL` sudo because hhfab shells out to sudo for TAP devices (labapp `archive2/installer/modules/hhfab-vlab.service` note, S). That is broader than I want; narrowing needs the observed command list from a real run (Open item 2).

## Verification

`bash verify.sh` (bounded wait, `HOTLAB_READY_TIMEOUT`, default 1800 s; `--no-wait` for a snapshot) asserts: Docker; k3d cluster and node Ready; every container of every pod ready in `monitoring|argocd|gitea`; HTTP answers on 9090/3000/8080/3001; **usable KVM as the service identity** (opens `/dev/kvm` rw as `hotlab` and starts QEMU with `-accel kvm` as `hotlab`); unit enabled; and **VLAB ready** = unit not failed, `init.done` and `gen.done` markers present, exact switch/control/server QEMU counts for *this lab's* processes, `HOTLAB_VLAB_HEALTH_CMD` passes, and the same still true after `HOTLAB_READY_STABLE` seconds with no unit restart. `Type=exec` "active" is never used as readiness. **U:** none of this has been executed; the health probe is only as good as the command the operator supplies.

Static guard: `bash hotlab/bootstrap/check-portability.sh` (exit 0 clean, 1 hit, **2 scan error, never treated as clean**; `--self-test` proves both failure paths). It scans every non-`.md` file in the tree, covers provider CLIs, agent packages, metadata endpoints and Proxmox `qm`/`pvesh`, tolerates tabs, and is invoked by `bootstrap.sh` preflight. Also run `shellcheck -x` on `*.sh` and `bash -n` per file.

## VLAB state and recovery

`vlab/vlab-run.sh` tracks **init** and **gen** separately with markers under `$HOTLAB_VLAB_DIR/.hotlab/`, written only after the stage's command succeeded *and* its output was checked (`fab.yaml` non-empty; gen must write a new non-empty file). A crash between stages leaves no marker, so the next start resumes at the incomplete stage. A partial init (`fab.yaml`, no marker, no VM disks) is moved to `.hotlab/quarantine/` and redone. If VM disks already exist the script **never re-inits and never regenerates**: it adopts/continues or exits 64 with instructions (`RestartPreventExitStatus=64`; `StartLimitBurst=5/h` bounds other restart loops). Nothing under `vlab/` is ever deleted or overwritten by the scripts, and `-f/--recreate` is rejected in config and at runtime.

### Writable-disk persistence (review finding 4): partially answered, runtime test required
- **Read, not run (S/D, version U):** upstream `githedgehog/fabricator` `pkg/hhfab/vlabrunner.go` (master, read via a summarising fetch, **not the pinned v0.43.1 tag**) reuses a VM directory when `os.img` (and, for ONIE switches, the EFI code/vars files) exist, logs "Using existing", and creates a plain disk with no backing file; the only recreate path is `vlab up --recreate (-f)`. So restart should reuse the same installed disk, and the EFI vars copy that holds boot order lives in the same VM directory. That is why we forbid `-f` and never touch `vlab/`.
- **What that does not prove:** that a switch *boots the installed NOS* rather than re-entering ONIE install, nor that behaviour matches 0.43.1, nor what an unclean `SIGTERM` stop (`KillMode=control-group`) does to the guest filesystem.
- **Operator test:** `persistence-test.sh before` → `systemctl restart hotlab-vlab` → `persistence-test.sh after`, then repeat across a VM reboot. It asserts per-VM disk/EFI file inode + birth time unchanged and that `HOTLAB_SWITCH_NOS_CMD <switch>` reaches the installed NOS within `HOTLAB_PERSIST_NOS_TIMEOUT` (600 s). The timeout is a heuristic: a fast reinstall inside it would pass the NOS probe, so the identity check is the stronger evidence. **Neither outcome is assumed; no result exists yet.**

## Measurement (sizing for #499)

`measure.sh LABEL [SECONDS]` writes MEASURED figures with the producing commands in each file header. It loads the same env contract, measures only QEMUs whose cwd/cmdline is under `HOTLAB_VLAB_DIR`, computes host CPU from `/proc/stat` fields 2..9 (guest time is already inside user/nice, so it is not added twice), reports per-QEMU CPU only for processes present for the whole window (PID reuse guarded by starttime; exited/new processes are flagged, never negative), records KSM/THP state, scopes `docker stats` to the k3d containers, and **exits non-zero with a `measurement_problems` list if anything failed or was unstable** (do not use such numbers for #499). **No measurements are included in this PR**: this workflow cannot execute. Operator procedure on a converged host:

```bash
sudo bash hotlab/bootstrap/measure.sh converged 60
sleep 1800; sudo bash hotlab/bootstrap/measure.sh idle-30min 300
cat /var/lib/hotlab/measure/*-converged/summary.txt
```

Expected `summary.txt` format (field names only; values to be filled by the run):

```
qemu_processes: <n>   qemu_allocated_MiB_total: <sum of -m>   qemu_rss_MiB_total: <..>   qemu_pss_MiB_total: <..>
host_MemTotal_MiB / host_MemAvailable_MiB / host_Committed_AS_MiB / host_cpu_busy_pct_<N>s
```

Report committed (`qemu_allocated`, `Committed_AS`) vs resident (RSS/PSS) and CPU after convergence. Note PSS can undercount if KSM/THP is in play; record `/sys/kernel/mm/ksm/run` alongside.

### Sizing plan (estimates, **U**, not measured)
- Minimal 2-fabric proof ≈ 4 switches + control + 2 servers ≈ 27.5 GB allocated (ticket figure). Start `n2-standard-16` (16 vCPU/64 GB), pd-balanced, then retry `n2-standard-8` (8/32) and report fit. This tree creates no VMs.
- Ops stack adds a k3s server plus Prometheus, Grafana, ArgoCD, Gitea; its resident size is unmeasured.

### n1 vs n2 reconciliation (D)
- hh-learn `content/modules/accessing-the-hedgehog-virtual-ai-data-center/README.md:59,89` documents **n1-standard-32** (~$1.10/h at line 213).
- labapp `deploy-lab.sh:32,38` deploys **n2-standard-32** with `--min-cpu-platform="Intel Cascade Lake"`.
- hh-learn `lab-validation/RESUMPTION.md:131` records that flag as **incompatible with n1-standard-32** (fix 4e95b75 removed the flag from the vAIDC module), and the separate `accessing-the-hedgehog-virtual-lab-with-google-cloud` module already uses n2-standard-32.
- **Authoritative for the production vAIDC image: n2-standard-32** (it is what the working deploy script runs, and Cascade Lake is an n2 CPU platform). The vAIDC module's n1 text is a docs inconsistency to correct. This is a documentary conclusion (D), not a launched-VM test.

## Open items (all need an operator run)
1. **hhfab flags (U):** there is no longer a default init argument set. The operator supplies credentials and flags (`hhfab init --help`). `--kill-stale`, the minimal-topology `vlab gen` flags (4 switches, 2 servers) and the health-probe command are unconfirmed. Wiring itself is #500. **`--dev` embeds upstream public development credentials** (labapp provision README); allowed only with explicit `HOTLAB_ALLOW_DEV_CREDENTIALS=1`.
2. **sudoers:** narrow `NOPASSWD: ALL` to the real command set.
3. **Chart values (U):** ArgoCD/Gitea/kube-prometheus-stack key names are not checked against pinned chart versions; Gitea/ArgoCD chart versions and the k3s digest must be supplied.
4. **Pins (U):** copied from labapp, not re-downloaded here.
5. **Not ported:** labapp's `vlab_core.py`, trial/guardian units, `ensure-bridge-ipv4.py`, `configure-student-kubeconfig.py`. Bridge/network wiring for multi-fabric belongs to #500; kubeconfig staging to #503/#505.
