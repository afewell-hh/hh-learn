# Hot Lab GCP VM lifecycle with enforced cost controls (#508)

Parent #497 · Gate #489 · Prerequisite for executing #501 on GCP.
Status: **design and code only. Nothing has been created in GCP.**

**Evidence tags:** `D` documented (vendor docs/known behaviour, not exercised here),
`S` source (this repo / this PR's files), `P` proven by execution, `U` unverified.
No code was executed in authoring this PR, so **nothing below is tagged `P`**.
Every `U` is converted into an out-of-band check in `RUNBOOK.md` §4.

---

## 1. The question: if every GitHub-side mechanism fails at once, what stops a VM running for a month?

**The instance's own `scheduling.terminationTime` (an absolute RFC 3339 deadline) with
`instanceTerminationAction: DELETE`.**

> **Revision (post-review).** The first revision of this design used
> `--max-run-duration=<ttl>s`. That was wrong: a *duration* restarts when the instance is
> stopped and started, so a stop/start loop extends life indefinitely and defeats the one
> control the design rests on. labapp's `build/gcp/lifecycle/spec.py` `validate_body`
> rejects it (`"duration limits reset on restart; use terminationTime"`) and sets an
> absolute `terminationTime`. This design adopts that, and **treats the presence of
> `maxRunDuration` as a validation failure** in both the creator read-back and the reaper
> (not merely a missing `terminationTime`). `S` (labapp spec.py, read 2026-11-05)

Every VM is created with `--termination-time=<expires-at as RFC3339 UTC>
--instance-termination-action=DELETE` (`hotlab-vm-create.yml`, "Create instance"). The
`expires-at` label is the **same instant**, and the read-back compares them as epochs. The
Compute Engine control plane, not GitHub, a runner, an agent or a cron, deletes the VM
(and its auto-delete boot disk) at that wall-clock time, however many times it was
stopped and started. Simultaneously failing: GitHub down, runner never starting,
`always()` step skipped by a force-cancel, reaper schedule dropped or disabled after 60
days of inactivity, WIF/OIDC broken. None of those is on the path. `D, U`

Concretely, the worst case with all of GitHub gone, **for a VM created by this
workflow**, is the TTL cap, ≤ 480 minutes from creation → at most 8 hours of VM time
(§8), not a month, and a stop/start cannot push that out. For a VM created by the
creator identity *outside* this workflow without the field, see caveat 1: with GitHub
gone nothing GCP-side bounds it.

What this answer does and does **not** cover, stated plainly:

1. **The backstop is workflow-enforced, NOT identity-enforced.** It holds for instances
   created *through `hotlab-vm-create.yml`*. The creator **identity** is not constrained
   to set it: nothing in IAM stops `hotlab-vm-creator` from calling `instances.insert`
   without `terminationTime` (or with one years away) — e.g. from an altered workflow
   merged to `main`, or any other code path that obtains a token for that identity.
   **This is permanent, not pending verification. No server-side mechanism can enforce a
   deadline.** `D`:
   * *IAM Conditions cannot.* The
     [IAM conditions attribute reference](https://docs.cloud.google.com/iam/docs/conditions-attribute-reference)
     limits conditions to predefined attributes (resource type/service/name/tags,
     principal type/subject, and request attributes such as access levels, date/time,
     destination IP/port, URL path/host). There is no way to condition on a request-body
     field like `scheduling.terminationTime`. (Coordinator-verified 2026-11-05.)
   * *Org Policy custom constraints cannot.* The
     [Compute Engine custom constraints](https://docs.cloud.google.com/compute/docs/access/custom-constraints)
     supported-fields table for `compute.googleapis.com/Instance` lists exactly one
     `scheduling` subtree, `scheduling.nodeAffinities.*`. `scheduling.terminationTime`,
     `scheduling.instanceTerminationAction` and `scheduling.maxRunDuration` are not
     supported fields and cannot appear in a constraint condition. (Table re-read by me
     on 2026-11-05; coordinator confirmed `teched-473722` sits in organization
     `1057998954523`, so the existence of an Organization is not the obstacle.)
   Nothing in this design is waiting on, or should be read as promising, a later
   server-side deadline control. **Therefore: the creator-side read-back and `always()`
   teardown are checks inside one workflow, and the reaper is permanently load-bearing,
   not merely a second line of defence.** Its own code path is hardened accordingly
   (fetched at a pinned, admin-bumped SHA: §11 item 3). Against an identity that creates
   an unbounded instance, the actual controls are: the reaper (which deletes any
   `hotlab-*` VM lacking a valid `terminationTime`, with `maxRunDuration`, or with a
   deadline beyond the policy maximum — measured from server-set `creationTimestamp`,
   not from labels — within ≤10 min of a cron tick, or immediately after a creator run
   completes), the IAM name/zone conditions, quota and the budget alert (detection only).
   If the reaper is also down (schedule dropped/disabled), an out-of-policy VM is **not**
   stopped by any GCP-side mechanism. Remaining caveat: the reaper cannot delete a VM
   with `deletionProtection` set (it goes red instead), and a creator-identity VM named
   outside `hotlab-` is prevented by IAM condition (`U`), not by the reaper.
2. **Stop → start no longer extends life** (the defect in revision 1). The deadline is
   absolute. `U`: what GCP does when the deadline passes while the instance is
   *stopped* (deleted at the deadline vs. at next start) is not something I could confirm;
   either way the reaper deletes it at `expires-at`, `start` refuses expired VMs, and
   nobody can start it with GitHub gone. RUNBOOK §4.1 canary part (d) tests this.
3. Disks only vanish if `autoDelete=true`; the creator creates exactly one disk (boot,
   auto-delete) and verifies it. Persistent disks created separately are unsupported.
4. If a VM is created by a **different principal** (e.g. an owner in the console) none
   of this applies. This design controls the Hot Lab identities, not project owners.
5. **Not yet proven.** That `terminationTime` + `DELETE` + `STANDARD` provisioning
   behaves as documented on an N2 nested-virt VM in `us-west4` is `D`. labapp uses the
   same field (`S`) but I did not see evidence of an observed deletion. The canary
   (RUNBOOK §4.1) converts it to `P` before anything depends on it.
   **If the canary does not self-delete, the design is wrong and must not ship.**
6. `U`: whether the installed `gcloud` exposes `--termination-time`. If not, the workflow
   must create via the `instances.insert` REST body (as labapp does). The read-back is
   identical either way, so a flag that is silently ignored fails the read-back.

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

`hotlabVmReaper`: `compute.instances.{list,get,delete}`, `compute.disks.list` (to verify
boot-disk type/size), `compute.zoneOperations.get`,
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
| 1 | Self-destruct | `scheduling.terminationTime` (absolute; = `expires-at`) + `instanceTerminationAction=DELETE` (ttl 15-480 min). `maxRunDuration` **forbidden** | create step; read-back in "Verify" (absent `maxRunDuration` asserted); reaper rechecks | **GCP control plane for VMs created via the workflow**; *not* identity-enforced (§1 caveat 1) |
| 2 | Ownership labels | `managed-by, owner, ticket, run-id, created-at, expires-at` (epoch seconds) | create step; read-back; reaper treats missing/malformed as orphan | creator + reaper |
| 2b | Reviewed shape (labapp-derived) | no `accessConfigs`/IPv6, exactly 1 NIC, no SA, `deletionProtection=false`, `automaticRestart=false`, `onHostMaintenance=TERMINATE`, `provisioningModel=STANDARD`, `block-project-ssh-keys`+`enable-oslogin`=TRUE, one auto-delete boot disk, `pd-standard` 50–500 GB (reaper via `disks list`), machine type/zone in allowlist | read-back; the reaper re-checks every item listed here | creator + reaper (GitHub-side; not identity-enforced) |
| 3 | Failure/cancel cleanup | `Teardown (always)`: `always()` plus `job.status != 'success'`, so failure/timeout/cancel delete even with `teardown=at-expiry`; only `at-expiry` + all-green keeps the VM. Deletes by deterministic name, then re-lists | creator | GitHub Actions; best-effort (force-cancel / lost runner can skip it) |
| 4 | Independent reaper | `hotlab-vm-reaper.yml`: cron `7,17,27,37,47,57` **and** `workflow_run` on creator completion; own pool+SA, no create permission; fails red if a violator survives. Sweep logic fetched at an admin-pinned SHA (§11 item 3). **Permanently load-bearing** for anything not created through the creator workflow (§1, §6a) | reaper | GitHub Actions + IAM |
| 5 | Hard caps | concurrency ≤ 2, N2 machine allowlist, zone allowlist, TTL ≤ 480 min, disk ≤ 500 GB | see §6 | mixed — honest table below |
| 6 | Budget alert | Billing budget on the project, thresholds in RUNBOOK §3 | GCP Billing | GCP (alert only) |
| 7 | Visible inventory | existing `hotlab-cloud.yml` `inventory` (shows `labels`) | read-only identity | viewer role |

## 4. Failure analysis — what happens if each control fails *alone*

| Control fails | Result | What still stops the VM |
|---|---|---|
| 1 `terminationTime` not applied/ignored, or `maxRunDuration` set instead | VM would run until deleted (or, with `maxRunDuration`, until a stop/start loop is stopped) | Creator read-back fails (named mismatch) → teardown (3); reaper flags `terminationTime-missing` / `maxRunDuration-present…` and deletes (4); budget alert (6) |
| 2 labels missing/wrong | Reaper cannot know expiry | Reaper treats as orphan and deletes on next sweep; `terminationTime` (1) still deletes |
| 3 teardown skipped (force-cancel, runner lost, auth fail mid-way) | VM left after proof | `terminationTime` (1) at the deadline; reaper at `expires-at` (4) |
| 4 reaper not running (schedule dropped/disabled, SA broken) | No sweep | (1) and (3) still delete; failures of the reaper are visible (red run, or absence of runs in Actions) |
| 5 a cap is bypassed (e.g. creator edited, or identity used directly) | Over-size/over-count VM | Reaper holds independent copies of the machine/zone/concurrency/lifetime/disk caps and deletes within one cron tick; IAM zone/prefix condition (`U`); quota ceiling (shared, loose: §6a); (1) bounds duration only if the field was set |
| 2b shape violated (public IP, SA, extra disk, deletion protection) | Larger blast radius, or reaper cannot delete | Read-back fails → teardown; reaper reports reason and deletes; `deletion-protection-set` makes the run red because the reaper cannot delete it |
| stop/start abused to extend life | Would defeat a duration | Not possible with an absolute `terminationTime`; `start` refuses past `expires-at`; reaper deletes stopped expired VMs |
| 6 budget alert not delivered | No human notice | (1)(3)(4) are unaffected — alert is detection only, **it does not stop spend** |
| 7 inventory unavailable | Less visibility | No effect on deletion paths |
| WIF/OIDC down | Cannot create (safe) or reap | (1) only — see §1 |

Two-at-once worth naming: *1 and 4 both fail* = a VM without the flag AND no reaper:
only teardown (3) and the budget alert remain. This is why the read-back in the creator
makes (1) fail loudly instead of silently, and why the reaper is scheduled every 10 min (and on creator completion)
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
| Machine type | N2: `n2-standard-8`, `n2-highmem-4`, `n2-standard-16` | **Enforceable, not yet applied.** Not expressible in IAM conditions; expressible as an Org Policy custom constraint on `resource.machineType` (`D`; project is in organization `1057998954523`). Draft: §6b. Until an org admin applies it: creator allowlist + independent reaper allowlist (deletes violators within one ≤10 min cron tick or on creator completion, if the reaper is running; not server-side) |
| Max concurrent | 2 | **No dedicated server-side cap.** Project quota `INSTANCES=24` is shared with Labapp and cannot be lowered without hurting it. Enforced by creator (serialised via `concurrency:`) and by the reaper (deletes newest beyond 2) |
| Lifetime | ≤ 480 min | Instance-level (`terminationTime`) + reaper `lifetime-exceeds-cap` |
| Total capacity | `CPUS` 200, `N2_CPUS` 200, `INSTANCES` 24, `DISKS_TOTAL_GB` 4096, `SSD_TOTAL_GB` 500 (quota; identical in us-west4/us-central1/us-east4; JSON-parsed by key per coordinator's correction) | Yes (project quota, shared) |

Honest summary: *name scope and zone* are server-enforced by IAM conditions (`U`, until
checked); *instance lifetime* is server-enforced **only for instances created with the
field** (not identity-enforced, **permanently**: §1, §6a); *concurrency, disk and
deadline caps* are enforced by two GitHub-side workflows (creator, reaper) and bounded in
blast radius only by shared quota. *Machine type, zone, external IPv4, deletion
protection and required labels* **can** be made server-side by Org Policy (project is in
an Organization, `D`) but **are not yet**: drafts in §6b, application is an external
request to a Hedgehog GCP org admin (RUNBOOK §6).

### 6a. Permanently unenforceable server-side (the reaper owns these, forever)

`D` for the deadline fields (citations in §1 caveat 1): neither IAM Conditions nor Org
Policy custom constraints can see them.

| Cap | Why no server-side control exists | Who bounds it |
|---|---|---|
| Deadline: `scheduling.terminationTime` present and ≤ policy max | Not a supported custom-constraint field; not an IAM condition attribute | Instance field for VMs made via the workflow; **reaper** (`terminationTime-missing`, `deadline-exceeds-policy-max`, `deadline-too-far-in-future`) for everything else |
| `instanceTerminationAction=DELETE`, `maxRunDuration` absent | Same: `scheduling.*` is supported only for `nodeAffinities.*` | **Reaper** |
| `automaticRestart`, `onHostMaintenance`, `provisioningModel` | Same | **Reaper** |
| Concurrent instance count ≤ 2 | A constraint evaluates one resource at a time and cannot count peers (reasoning, `S`; the supported-fields list has no counter). Project quota `INSTANCES=24` is shared with Labapp | Creator list-then-create (this workflow only) and **reaper** (deletes newest beyond 2) |
| IPv6 external addressing | `ipv6AccessConfigs` is not a supported field (only `accessConfigs.name/natIP`) | **Reaper** |
| Boot disk type/size, single-disk shape | Disk fields are not in the supported list | **Reaper** (via `disks list`) |

Consequence for an out-of-policy VM made by the creator identity outside the workflow,
before the reaper next runs (≤10 min cron lag, or sooner via `workflow_run`; unbounded if
the reaper is down): no deadline, any lifetime, more than 2 concurrently, up to remaining
shared quota (`N2_CPUS` 200 / `CPUS` 200, `INSTANCES` 24 minus Labapp's). Cost of such a
burst is `U` (no dated prices) and is detected only by the budget alert. Items in §6b
shrink *which* VMs can exist, but none of them bounds duration.

### 6b. Enforceable via Org Policy, drafted but NOT applied

`D`: the supported-fields table for `compute.googleapis.com/Instance` includes
`machineType`, `zone`, `labels`, `deletionProtection`, `networkInterfaces.accessConfigs.*`
(read 2026-11-05). Drafts are in `org-policy/`; none is applied; application requires a
**Hedgehog GCP organization administrator** (coordinator has no org-level permissions:
`getIamPolicy` on `organizations/1057998954523` is denied, and `orgpolicy.googleapis.com`
is not enabled on the project, deliberately not enabled; RUNBOOK §6).

| Cap | Draft | Fields used | Remaining gap |
|---|---|---|---|
| Machine type allowlist | `org-policy/machine-type.yaml` | `machineType` | none beyond scope (below) |
| Zone allowlist | `org-policy/zone.yaml` | `zone` | create-time value shape (short name vs URL) `U`; `contains` tolerates both |
| No external IPv4 | `org-policy/no-external-ip.yaml` | `networkInterfaces.accessConfigs.*` | IPv6 not covered; reaper still checks |
| No deletion protection | `org-policy/no-deletion-protection.yaml` | `deletionProtection` | none; protects the reaper's ability to delete |
| Required ownership labels | `org-policy/required-labels.yaml` | `labels` | presence only, not value sanity (`expires-at` format stays reaper-checked) |

Candidate not drafted: `resourceStatus.effectiveInstanceMetadata.enableOsloginMetadataValue`
and `blockProjectSshKeysMetadataValue` are supported fields, which would make OS Login
and block-project-ssh-keys server-enforceable. They live under `resourceStatus` (output
status), so I do not know whether they are populated at CREATE evaluation (`U`); test
under `dryRunSpec` before drafting. Likewise `advancedMachineFeatures.enableNestedVirtualization`
and `minCpuPlatform` are supported.

**The scoping problem (important, new finding).** `resource.name` is *not* a supported
Instance field (only InstanceGroup has `name`), and the project is shared with Labapp.
Constraints apply to every instance in the project they are attached to, so an
unscoped machine-type allowlist would block Labapp's own VMs. The drafts therefore scope
with `resource.selfLink.contains('/instances/hotlab-')` (`selfLink` is a supported field).
`U`: whether `selfLink` is populated when a CREATE is evaluated. If it is not, the scope
clause is never true and **every constraint is silently inert**, which is false assurance.
RUNBOOK §6.3 therefore requires a deliberate violating create under `dryRunSpec`, and
only trusts a constraint after seeing it fire on that and stay quiet on a conforming VM.
Two other options if scoping fails: (a) scope by label (`labels['managed-by']=='hotlab'`),
which misses unlabelled VMs, so it cannot replace the labels constraint; or (b) **move
Hot Lab to a dedicated project** (recommended if `selfLink` scoping fails, and arguably
better regardless): constraints then apply unconditionally, quotas stop being shared with
Labapp, and the budget is isolated. That is a coordinator decision; it is not in this PR.

Even fully applied, §6b does not make the VM self-destruct, bound concurrency, or bound
duration; §6a stays on the reaper.

## 7. `gcloud` invocation for the #501 proof

Proof sizing: minimal 2-fabric proof ≈ 24-34 GB → default **`n2-standard-8`** (8 vCPU /
32 GB). **Not** the ~92 GB production unit. `n2-highmem-4` (4 vCPU / 32 GB) is the
cheaper-CPU floor; `n2-standard-16` (64 GB) is the headroom option and the **ceiling**
for the prototype ("`n2-standard-16` or smaller"). `n2-standard-32` (labapp's
`VLAB_MACHINE`, Hedgehog vAIDC) is quota-feasible but deliberately outside the allowlist
and needs a reviewed change in both workflows.

```
gcloud compute instances create hotlab-<run_id>-<attempt> \
  --project=teched-473722 --zone=us-west4-a \
  --machine-type=n2-standard-8 \
  --min-cpu-platform="Intel Cascade Lake" \
  --enable-nested-virtualization \
  --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
  --boot-disk-size=200GB --boot-disk-type=pd-standard --boot-disk-auto-delete \
  --provisioning-model=STANDARD \
  --termination-time=<expires-at as RFC3339 UTC> --instance-termination-action=DELETE \
  --maintenance-policy=TERMINATE --no-restart-on-failure --no-deletion-protection \
  --no-service-account --no-scopes --no-address \
  --metadata=block-project-ssh-keys=TRUE,enable-oslogin=TRUE \
  --labels=managed-by=hotlab,owner=<actor>,ticket=501,run-id=<run_id>,created-at=<epoch>,expires-at=<epoch>
```

Nested-virt constraints `D`: Intel only — N1/N2/C2 or N4D; not E2, memory-optimized,
ARM, or AMD (other than N4D). **Quota (corrected 2026-11-05, parsed by key, identical in
us-west4/us-central1/us-east4):** `CPUS`=200, `N2_CPUS`=200, `C2_CPUS`=8, `N2D_CPUS`=16,
`INSTANCES`=24, `DISKS_TOTAL_GB`=4096, `SSD_TOTAL_GB`=500. So N2 is feasible (C2 too
small; N2D is AMD → unsupported). The earlier "design against N1" guidance came from
misaligned positional arrays and is withdrawn. `S`: labapp `deploy-lab.sh` already runs
`n2-standard-32` with `--min-cpu-platform="Intel Cascade Lake"` in production; I match
that platform (override with `vars.HOTLAB_MIN_CPU_PLATFORM`). `-cpu host` passthrough in
VLAB exposes the VM's CPU model to the nested guest, so the platform is pinned so it does
not vary between runs. `U`: Cascade Lake availability in the chosen us-west4 zone — the
canary (RUNBOOK §4.1) checks it, and the proof must confirm `vmx` in `/proc/cpuinfo`.
`onHostMaintenance=TERMINATE` because nested-virt VMs cannot live-migrate (labapp does
the same); with `DELETE` a host event therefore deletes the VM, which is acceptable
for a disposable proof VM.

Disk: `pd-standard`, 200 GB default (VLAB's large sparse qcow2s; `SSD_TOTAL_GB` is only
500). **Exactly one disk** (the auto-delete boot disk); the read-back and reaper reject any
other disk list.

### Access path (explicit)
No public IP (`accessConfigs`/`ipv6AccessConfigs` forbidden, asserted at read-back and
by the reaper). Access is **IAP TCP forwarding + OS Login**:
`gcloud compute ssh <vm> --tunnel-through-iap --zone <z>`, with `enable-oslogin=TRUE` and
`block-project-ssh-keys=TRUE` fixed so no project/instance SSH key can bypass IAM. The
human needs `roles/iap.tunnelResourceAccessor` and `roles/compute.osLogin` (granted to
people, never to the creator/reaper SAs). Egress for package/image pulls needs Cloud NAT.
Both the IAP firewall rule (`35.235.240.0/20` → tcp:22) and Cloud NAT are **coordinator
bootstrap items** (RUNBOOK §2.5). No attached service account, so compromise of the VM
yields no GCP authority.

### Quota pre-flight
Reads `regions describe --format=json` and looks each metric up **by key**
(`.quotas[] | select(.metric==$m)`), requires **exactly one** match (zero or several is an
error, not a pass), then needs headroom for `CPUS` ≥ vCPUs, `<FAMILY>_CPUS` (here
`N2_CPUS`) ≥ vCPUs, `INSTANCES` ≥ 1, `DISKS_TOTAL_GB` ≥ disk size, failing with a named
message. It never aligns parallel arrays. It checks headroom *now*, not other
workloads' future use.

## 8. Cost (`U` — prices not fetched in this run)

I had no network/tool access to the Cloud Billing Catalog in this run, so **no dated
price is quoted as fact**. Indicative figures from public list pricing as I recall it
(on-demand N2, `us-central1`, ~2025; `us-west4` is typically somewhat higher):

* `n2-standard-8`: ≈ $0.39/h → plan on **≤ $0.50/h** for us-west4 (`U`)
* `n2-standard-16` ≈ $0.78/h → plan on **≤ $1.00/h** (`U`)
* `pd-standard` 200 GB: ≈ $0.04/GB-month ≈ $0.011/h (`U`)
* **One 4 h proof run on `n2-standard-8` ≈ $2** (ceiling ≈ $0.52/h × 4 h).
* Absolute worst case at the caps (2 × `n2-standard-16`, ≈ $1/h each, 8 h) ≈ **$16** (`U`)
* Not in the allowlist, for reference: `n2-standard-32` ≈ 2× `n2-standard-16`.

**Action for the coordinator:** replace with a dated figure from the Cloud Billing
Catalog API (RUNBOOK §2.7 gives the command) before relying on the budget threshold.

## 9. Start/stop model

Default is **ephemeral**: `create → hold → delete` in one run (`teardown=now`).
For multi-session work: `teardown=at-expiry` leaves the VM until its TTL, `stop` between
sessions (stops compute charges; the boot disk still bills), `start` to resume.
`expires-at` and `scheduling.terminationTime` are the same absolute instant and are
**never extended**: stop/start does not move either, the reaper deletes a stopped VM past
expiry, and `start` refuses it. To work longer, create a new VM. Total life is therefore
bounded by the instance-level deadline even across any number of stop/start cycles.

## 10. Deviations from the issue text, flagged for review

1. **Orphan scope.** The issue says unlabelled instances are orphans. In a project shared
   with Labapp, deleting *every* unlabelled instance would destroy unrelated workloads.
   I scoped orphans to **unlabelled `hotlab-*`** (and made the IAM condition match).
   Anything not named `hotlab-*` is invisible to the reaper by design.
2. **Workflow files are staged under `docs/hotlab/gcp-vm-lifecycle/workflows/`**, not
   `.github/workflows/`, because the authoring automation cannot write there. Copy them
   verbatim (RUNBOOK §2.1). The paths are part of the trust boundary.
3. **Machine-type and concurrency caps are not server-side today** (§6). Deadline and
   concurrency are permanently not enforceable server-side (§6a); machine type and
   others are enforceable once an org admin applies §6b.
6. **Reaper script is fetched at an admin-pinned SHA** (§11 item 3), adding a repo
   variable `HOTLAB_REAPER_SCRIPT_SHA` and a second approval step to change reaper logic.
4. **Nothing executed.** All YAML/jq is unlinted and unrun; treat first run as a dry run.
5. **`maxRunDuration` replaced by `terminationTime`** (see §1), per the labapp reuse
   inventory posted after the first revision.

## 11. labapp lifecycle module: consume or reimplement?

`S`: I read `build/gcp/lifecycle/spec.py`, `store.py` and
`.github/workflows/labapp-lifecycle-cleanup.yml` and the directory listing (≈250 KB code,
≈390 KB tests, Python). I did **not** read `controller.py` (67 KB) or the rest in full.

**What I adopted (ideas, in-workflow):** absolute `terminationTime`+`DELETE`; rejecting
`maxRunDuration`; no `accessConfigs`; fixed OS Login / block-project-ssh-keys metadata;
`deletionProtection=false`, `automaticRestart=false`, `TERMINATE` maintenance; machine-type
and disk-list pinning; separate creator/reaper pools.

**Why not consume the module wholesale, and what I recommend:**

| Option | Verdict |
|---|---|
| Submodule | Not now. The module hardcodes `PROJECT`, `ZONE=us-central1-a`, `MACHINE_TYPE=e2-standard-2`, `SLOT_PREFIX=labapp-lc-s1`, `labapp-*` labels and a name regex `^labapp-lc-s1-r…`. Its `validate_body` accepts a finite table of labapp profiles; none is a Hot Lab shape. A submodule pins labapp's whole tree and its release cadence into hh-learn (a HubSpot/Node repo with no Python toolchain), and a submodule update would silently alter the code a privileged workflow runs. |
| Subtree / vendored copy | Reject. Forks a 640 KB security-sensitive module with 4 hardcoded profiles; every labapp fix needs manual re-sync, and the tests would not pass unchanged. It also puts untrusted-by-this-repo code under review burden here. |
| Published package | **Recommended end state**, conditional on labapp first parameterising the module (project, zone, name prefix, label namespace, profile table) and publishing a versioned, hash-pinned artifact. Then hh-learn depends on an exact version/digest and fetches it the way labapp's cleanup does. |
| Reimplement in-workflow (this PR) | **Recommended now, for the prototype.** ~100 lines of `gcloud`+`jq` that I can state completely and the coordinator can review in one sitting, with every invariant checked by read-back. |

**What the CAS ledger buys, and why I don't need it yet.** labapp's `store.py` makes
capacity a durable, generation-matched (`if_generation_match`) record in GCS, so two
concurrent creators cannot both pass a count check (a TOCTOU race). My concurrency cap is
a *list-then-create* check serialised by a GitHub `concurrency:` group. That is **weaker**:
it only serialises runs of this one workflow; a second creator path, a re-run racing a
cancel, or a runner in another repo would not be serialised. It is bounded by the reaper
(deletes newest beyond the cap within one ≤10 min cron tick or on creator completion), `INSTANCES`=24 quota, and cost caps, so
the failure mode is a brief overshoot of 1–2 small VMs, not unbounded spend. If the
Hot Lab grows beyond a single manual creator, adopt the CAS ledger (a GCS bucket with
object-generation preconditions, a **GCP resource I have not created**) rather than
strengthening the list-count.

**Where I judge labapp's approach wrong or poor-fit for us (reasoned, not exhaustive):**
1. *Python controller for a 1-VM prototype* is a large trusted surface (the cleanup job
   executes ≈12 fetched modules with cleanup-identity credentials). Appropriate for
   labapp's multi-profile access-recovery flows; disproportionate here.
2. *`workflow_run` trigger on the reaper.* **Adopted in review round 2.** The earlier
   draft omitted it; now the reaper runs on `workflow_run: completed` of "Hot Lab VM
   (creator)" plus cron `7,17,27,37,47,57 * * * *` (labapp's cadence). Trust note: the
   job checks out nothing and reads nothing from the triggering run (not even its
   conclusion), and `workflow_run` only fires for workflow files on the default branch, so
   a fork/PR cannot cause it to run attacker content. The WIF condition allows
   `event_name == workflow_run` for this one pinned `workflow_ref`. I did *not* copy
   labapp's fetch-by-pinned-SHA step originally; that was reversed, see item 3.
3. *Fetching code from `main` by SHA at runtime.* **Reversed and adopted** (previously
   "not adopted"). The earlier reasoning ("it's inline, so nothing to fetch") ignored
   that inline code in a workflow file changes with any merge to `main`, which is
   exactly the altered-code threat the reaper must survive now that it is permanently
   load-bearing (§1). The sweep is now `scripts/hotlab/vm-reaper-sweep.sh`, fetched via
   the Contents API at the SHA in repo variable `HOTLAB_REAPER_SCRIPT_SHA`, validated
   (40-hex; SHA is an ancestor of `main` via the compare API; `type=file`, exact path,
   base64, size ≤ 64 KiB, decoded length equals reported size, shebang, `bash -n`), and
   run from `RUNNER_TEMP`. It happens *before* GCP authentication, so an invalid pin
   never obtains a token. Caps are in the script, so they are pinned too.
   **What this buys:** merging a change to the sweep logic does not change what the
   reaper identity executes until a repo admin bumps the variable after review (a
   second, separate approval).
   **What it does not buy:** the workflow file, including the fetch step, is still
   changed by a merge to `main`, and WIF pins `workflow_ref` (a path), not file content.
   An optional extra is to pin the OIDC `job_workflow_sha` claim in the reaper provider's
   attribute condition, so each workflow edit also needs an owner-side provider update
   (`U`: claim presence and format not verified; RUNBOOK §2.4). Not applied by default
   because it makes every workflow edit an owner action.
4. *`READ_ONLY` second disk with `autoDelete=false`* leaves a disk requiring explicit
   reconciliation; I forbid it (single auto-delete boot disk) because Hot Lab has no
   image-copy need.
5. *Pinned `gcloud` 540.0.0 and runner OS.* I adopt the idea but did not pin: I could not
   confirm that `--termination-time` exists in that version. Pin after the dry run.

**Net:** reimplement the thin invariants now; treat labapp as the reference spec; revisit
a versioned package once labapp parameterises it.
