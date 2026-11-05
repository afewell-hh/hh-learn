# Hot Lab GCP VM lifecycle with enforced cost controls (#508)

Parent #497 · Gate #489 · Prerequisite for executing #501 on GCP.
Status: **design and code only. Nothing has been created in GCP.**

**Evidence tags:** `D` documented (vendor docs/known behaviour, not exercised here),
`S` source (this repo / this PR's files), `P` proven by execution, `U` unverified.
No code was executed in authoring this PR, so **nothing below is tagged `P`**.
Every `U` is converted into an out-of-band check in `RUNBOOK.md` §4.

---

## 1. The question: if every GitHub-side mechanism fails at once, what stops a VM running for a month?

**The instance's own `--max-run-duration` with `--instance-termination-action=DELETE`.**

Every VM is created with `--max-run-duration=<ttl>s --instance-termination-action=DELETE`
(`hotlab-vm-create.yml`, "Create instance"). The Compute Engine control plane, not GitHub,
a runner, an agent or a cron, stops and **deletes** the VM (and its auto-delete boot disk)
when the duration elapses. Simultaneously failing: GitHub down, runner never starting,
`always()` step skipped by a force-cancel, reaper schedule dropped or disabled after 60
days of inactivity, WIF/OIDC broken. None of those is on the path. `D, U`

Concretely, the worst case with all of GitHub gone is **ttl_minutes ≤ 480 → 8 hours of
VM time (~$4-8, §8), not a month**.

What this answer does and does **not** cover, stated plainly:

1. It holds only for instances **created with the flag**. The creator workflow always
   sets it and reads it back (`scheduling.maxRunDuration` / `instanceTerminationAction`)
   and tears the VM down if the read-back differs. But the creator SA could, if its
   workflow were altered, create without it. IAM cannot condition on scheduling fields.
   Mitigations: workflow is pinned by `workflow_ref`+`ref=main` (changes need a reviewed
   merge); the reaper deletes any `hotlab-*` VM lacking a valid `expires-at`; an optional
   org-policy custom constraint (§6, `U`) would make it server-enforced.
2. A **stop → start** restarts the run-duration clock. That requires someone to act via
   GitHub or via credentials; with GitHub gone nobody can start it. The `start`
   operation refuses VMs past `expires-at`. `D, U`
3. Disks only vanish if `autoDelete=true`; the creator sets and verifies that for every
   disk. Persistent disks created separately are out of scope and unsupported.
4. If a VM is created by a **different principal** (e.g. an owner in the console) none
   of this applies. This design controls the Hot Lab identities, not project owners.
5. **Not yet proven.** That `--max-run-duration` combined with the standard provisioning
   model and `DELETE` behaves as documented in `us-west4` on N1 is `D`. The
   coordinator's canary (RUNBOOK §4.1) converts it to `P` before anything depends on it.
   **If the canary does not self-delete, the design is wrong and must not ship.**

---

## 2. Identities

Three separate WIF pools, one per authority level. A sibling provider in a shared pool
can broaden a binding, so **no pool is shared**. Labapp identities are **not** reused.

| | read-only (exists, PR #507) | creator (new) | reaper (new) |
|---|---|---|---|
| Pool | `hotlab-inspector` | `hotlab-creator` | `hotlab-reaper` |
| Provider | existing | `github` | `github` |
| Service account | `roles/compute.viewer` | `hotlab-vm-creator` | `hotlab-vm-reaper` |
| Workflow file | `hotlab-cloud.yml` | `hotlab-vm-create.yml` | `hotlab-vm-reaper.yml` |
| `event_name` | `workflow_dispatch` | `workflow_dispatch` | `schedule`, `workflow_dispatch` |
| Can create VMs | no | **yes** (bounded) | **no** |
| Can delete VMs | no | yes, `hotlab-*` only | yes, `hotlab-*` only |

### Attribute conditions (shape verified on PR #507; each in its own provider)

Creator:
```
assertion.repository_id == '1046667618' &&
assertion.repository_owner_id == '193945001' &&
assertion.ref == 'refs/heads/main' &&
assertion.workflow_ref == 'afewell-hh/hh-learn/.github/workflows/hotlab-vm-create.yml@refs/heads/main' &&
assertion.event_name == 'workflow_dispatch'
```
Reaper: identical except `workflow_ref == '.../hotlab-vm-reaper.yml@refs/heads/main'` and
`assertion.event_name in ['schedule','workflow_dispatch']`. (`workflow_dispatch` is kept on
the reaper for manual dry-runs; it can only delete, so widening the trigger widens nothing
dangerous.)

Provider attribute mapping includes `attribute.workflow_ref=assertion.workflow_ref`; the
`roles/iam.workloadIdentityUser` binding on each SA targets
`principalSet://…/workloadIdentityPools/<pool>/attribute.workflow_ref/<exact workflow_ref>`,
so even within the pool only that one workflow can impersonate.

Inherited trust limits from #507 still apply: `workflow_ref` pins a path and ref, not
contents (a re-run of a historical main run gets a fresh token; add a `workflow_sha`
allowlist if that matters), and anything merged to `main` is trusted, so protect `main`
and `.github/workflows/hotlab-vm-*.yml` (CODEOWNERS + required review). Recommended
hardening: run the creator job under a GitHub **environment with required reviewers**
so each VM creation needs a human click (then also pin the `environment` claim).

### Roles (custom, no predefined `compute.instanceAdmin*`)

`hotlabVmCreator` (permissions `U`, finalised by the policy troubleshooter, RUNBOOK §4.2):
`compute.instances.{create,get,list,delete,start,stop,setLabels,setMetadata}`,
`compute.disks.{create,get}`, `compute.subnetworks.{use,get}`, `compute.networks.get`,
`compute.machineTypes.get`, `compute.zones.get`, `compute.regions.get`,
`compute.zoneOperations.get`, `compute.globalOperations.get`, `compute.projects.get`,
`compute.images.useReadOnly` (public Ubuntu image).
Deliberately **absent**: `compute.instances.setScheduling` (cannot strip the self-destruct
after creation), `setMachineType`, `setServiceAccount`, `compute.instances.osLogin`/SSH,
`iam.serviceAccounts.actAs` (VMs carry no SA), any IAM/billing/firewall/network write.

`hotlabVmReaper`: `compute.instances.{list,get,delete}`, `compute.zoneOperations.get`,
`compute.zones.list`. **No create, no setLabels, no setMetadata.**

IAM conditions on the mutating bindings (`U` – confirm condition support per permission):
```
resource.type == 'compute.googleapis.com/Instance' &&
resource.name.extract('/instances/{n}').startsWith('hotlab-') &&
resource.name.startsWith('projects/teched-473722/zones/us-west4-')
```
Applied to create/delete/start/stop/setLabels/setMetadata so the creator and reaper
physically cannot touch non-`hotlab-*` instances (e.g. Labapp's) and the creator cannot
create outside `us-west4` — a **server-enforced** zone allowlist. `list`/`get` regional
and operation permissions are granted in an unconditioned binding because they have no
instance resource to condition on.

---

## 3. Control matrix (the seven non-negotiables)

| # | Control | Mechanism | Where | Enforced by |
|---|---|---|---|---|
| 1 | Self-destruct | `--max-run-duration=<ttl>s --instance-termination-action=DELETE` (ttl 15-480 min) | create step; read-back in "Verify" | **GCP control plane** |
| 2 | Ownership labels | `managed-by, owner, ticket, run-id, created-at, expires-at` (epoch seconds) | create step; read-back; reaper treats missing/malformed as orphan | creator + reaper |
| 3 | Failure/cancel cleanup | `Teardown (always)` step, `always()` not `!cancelled()`, deletes by deterministic name `hotlab-<run_id>-<attempt>`, then re-lists to confirm | creator | GitHub Actions |
| 4 | Independent reaper | `hotlab-vm-reaper.yml`, 15-min cron, own pool+SA, no create permission, fails red if anything violating survives | reaper | GitHub Actions + IAM |
| 5 | Hard caps | concurrency ≤ 2, N1 machine allowlist, zone allowlist, TTL ≤ 480 min, disk ≤ 500 GB | see §6 | mixed — honest table below |
| 6 | Budget alert | Billing budget on the project, thresholds in RUNBOOK §3 | GCP Billing | GCP (alert only) |
| 7 | Visible inventory | existing `hotlab-cloud.yml` `inventory` (shows `labels`) | read-only identity | viewer role |

## 4. Failure analysis — what happens if each control fails *alone*

| Control fails | Result | What still stops the VM |
|---|---|---|
| 1 `--max-run-duration` not applied/ignored | VM would run until deleted | Creator read-back fails → teardown (3); reaper deletes at `expires-at` (4); budget alert (6) |
| 2 labels missing/wrong | Reaper cannot know expiry | Reaper treats as orphan and deletes on next sweep; max-run-duration (1) still deletes |
| 3 teardown skipped (force-cancel, runner lost, auth fail mid-way) | VM left after proof | max-run-duration (1) at ttl; reaper at `expires-at` (4) |
| 4 reaper not running (schedule dropped/disabled, SA broken) | No sweep | (1) and (3) still delete; failures of the reaper are visible (red run, or absence of runs in Actions) |
| 5 a cap is bypassed (e.g. creator edited) | Over-size/over-count VM | Reaper holds independent copies of the machine/zone/concurrency caps and lifetime cap; IAM zone/prefix condition; quota ceiling `INSTANCES=24`, `CPUS=200`; (1) still bounds duration |
| 6 budget alert not delivered | No human notice | (1)(3)(4) are unaffected — alert is detection only, **it does not stop spend** |
| 7 inventory unavailable | Less visibility | No effect on deletion paths |
| WIF/OIDC down | Cannot create (safe) or reap | (1) only — see §1 |

Two-at-once worth naming: *1 and 4 both fail* = a VM without the flag AND no reaper:
only teardown (3) and the budget alert remain. This is why the read-back in the creator
makes (1) fail loudly instead of silently, and why the reaper is scheduled every 15 min
with a red-on-failure contract.

## 5. Avoiding false assurance (lesson from #507)

* **No "provoke a failure" assertions.** The creator proves controls by reading back
  the created instance and comparing each field to its expected value
  (`jq -e` per field, named in the summary). A wrong value fails as *that* mismatch; a
  disabled API or bad flag fails earlier as a hard error in the step that caused it, not
  as a "confirmed".
* **Teardown and the reaper confirm by positive re-listing**, and a list/API error
  aborts the step (`set -e` on checked assignments) rather than being read as "gone" or
  "nothing to do".
* **"Cannot create" for the reaper SA and "cannot setScheduling" for the creator** are
  *not* asserted inside a workflow (that would require attempting a mutation). They are
  verified out-of-band with owner credentials using IAM Policy Troubleshooter, which
  returns an explicit `GRANTED`/`NOT_GRANTED` per permission (RUNBOOK §4.2).
* Pre-flight quota check reads the metric and uses `jq -e`, so a missing metric is an
  error, not a pass.

## 6. Server-side caps: what is and is not truly server-enforced

| Cap | Value | Server-side? |
|---|---|---|
| Zone allowlist | `us-west4-{a,b,c}` | **Yes** — IAM condition on `resource.name` for create (`U`: confirm condition support); also reaper |
| Name scope | `hotlab-*` | **Yes** — IAM condition on create/delete |
| Machine type | N1: `n1-standard-8`, `n1-highmem-4`, `n1-standard-16` | **Partly.** Not expressible in IAM conditions. Optional custom org-policy constraint on `compute.googleapis.com/Instance` (`resource.machineType`) **if the project sits in an Organization** (`U`). Otherwise: creator allowlist + independent reaper allowlist (deletes violators within ≤15 min) |
| Max concurrent | 2 | **No dedicated server-side cap.** Project quota `INSTANCES=24` is shared with Labapp and cannot be lowered without hurting it. Enforced by creator (serialised via `concurrency:`) and by the reaper (deletes newest beyond 2) |
| Lifetime | ≤ 480 min | Instance-level (`max-run-duration`) + reaper `lifetime-exceeds-cap` |
| Total capacity | `CPUS` 200, `INSTANCES` 24, `DISKS_TOTAL_GB` 4096 (quota) | Yes (project quota, shared) |

Honest summary: *duration, name scope and zone* are server-enforced; *machine type and
concurrency* are enforced by two independent GitHub-side workflows and bounded in blast
radius by quota. Hardening to server-side requires an Organization policy; whether
`teched-473722` is in an Organization is unknown to me (`U`).

## 7. `gcloud` invocation for the #501 proof

Proof sizing: minimal 2-fabric proof ≈ 24-34 GB → `n1-standard-8` (8 vCPU / 30 GB).
**Not** the ~92 GB production unit; `n1-standard-32` (Hedgehog vAIDC reference) is
deliberately outside the allowlist and needs a reviewed change. `n1-highmem-4` (26 GB)
is the cheaper floor; `n1-standard-16` (60 GB) the headroom option.

```
gcloud compute instances create hotlab-<run_id>-<attempt> \
  --project=teched-473722 --zone=us-west4-a \
  --machine-type=n1-standard-8 \
  --min-cpu-platform="Intel Skylake" \
  --enable-nested-virtualization \
  --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
  --boot-disk-size=200GB --boot-disk-type=pd-standard --boot-disk-auto-delete \
  --max-run-duration=14400s --instance-termination-action=DELETE \
  --no-service-account --no-scopes --no-address \
  --labels=managed-by=hotlab,owner=<actor>,ticket=501,run-id=<run_id>,created-at=<epoch>,expires-at=<epoch>
```

Nested-virt constraints `D`: Intel only — N1/N2/C2 or N4D; not E2, memory-optimized,
ARM, or AMD (other than N4D). In this project N2 (16 vCPU) and C2 (8) quota is too small
and N4D is not offered (per #501), so **N1**, which draws on the general `CPUS` pool
(limit 200). `-cpu host` passthrough in VLAB exposes the VM's CPU model to the nested
guest, so the CPU platform must be one that exposes `vmx`; N1 requires an explicit
`--min-cpu-platform` of Haswell or newer for nested virt, and the choice is pinned (via
`vars.HOTLAB_MIN_CPU_PLATFORM`, default Skylake) so the guest CPU model does not vary
between runs. `U`: that `Intel Skylake` is available in the chosen us-west4 zone — the
canary (RUNBOOK §4.1) checks this and the proof must confirm `vmx` in `/proc/cpuinfo`.

Disk: `pd-standard`, 200 GB default (VLAB's large sparse qcow2s; `SSD_TOTAL_GB` is only
500). `--no-address`: no public IP; egress needs Cloud NAT and access needs IAP, both
**coordinator bootstrap items** (RUNBOOK §2.5). No attached service account, so
compromise of the VM yields no GCP authority.

Quota pre-flight (creator, before create): reads `regions describe`, requires headroom
for `CPUS` ≥ vCPUs, `INSTANCES` ≥ 1, `DISKS_TOTAL_GB` ≥ disk size, and fails with a
named message. Note it checks quota *headroom now*, not other workloads' future use.

## 8. Cost (`U` — prices not fetched in this run)

I had no network/tool access to the Cloud Billing Catalog in this run, so **no dated
price is quoted as fact**. Indicative figures from public list pricing as I recall it
(on-demand N1, `us-central1`, ~2025; `us-west4` is typically somewhat higher):

* `n1-standard-8`: ≈ $0.38/h → plan on **≤ $0.50/h** for us-west4 (`U`)
* `pd-standard` 200 GB: ≈ $0.04/GB-month ≈ $0.011/h (`U`)
* **One 4 h proof run ≈ $2** (ceiling ≈ $0.52/h × 4 h).
* Absolute worst case at the caps (2 × `n1-standard-16`, ≈ $1/h each, 8 h) ≈ **$16** (`U`)

**Action for the coordinator:** replace with a dated figure from the Cloud Billing
Catalog API (RUNBOOK §2.7 gives the command) before relying on the budget threshold.

## 9. Start/stop model

Default is **ephemeral**: `create → hold → delete` in one run (`teardown=now`).
For multi-session work: `teardown=at-expiry` leaves the VM until its TTL, `stop` between
sessions (stops compute charges; the boot disk still bills), `start` to resume.
`expires-at` is absolute and **never extended**: reaper deletes a stopped VM past
expiry, and `start` refuses it. To work longer, create a new VM. A start restarts the
instance's max-run clock but cannot move `expires-at`, so total life is bounded by the
label (reaper) and, when GitHub is unavailable, by nobody being able to start it.

## 10. Deviations from the issue text, flagged for review

1. **Orphan scope.** The issue says unlabelled instances are orphans. In a project shared
   with Labapp, deleting *every* unlabelled instance would destroy unrelated workloads.
   I scoped orphans to **unlabelled `hotlab-*`** (and made the IAM condition match).
   Anything not named `hotlab-*` is invisible to the reaper by design.
2. **Workflow files are staged under `docs/hotlab/gcp-vm-lifecycle/workflows/`**, not
   `.github/workflows/`, because the authoring automation cannot write there. Copy them
   verbatim (RUNBOOK §2.1). The paths are part of the trust boundary.
3. **Machine-type and concurrency caps are not fully server-side** (§6).
4. **Nothing executed.** All YAML/jq is unlinted and unrun; treat first run as a dry run.
