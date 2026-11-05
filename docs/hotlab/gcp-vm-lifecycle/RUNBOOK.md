# Runbook: Hot Lab GCP VM lifecycle (#508)

**Every command in §2-§4 is for the coordinator with owner credentials. The authoring
automation executed none of them. Review `DESIGN.md` first.** Substitute
`P=teched-473722`, `PN=<project number>`.

## 1. Files

| Staged here | Install as |
|---|---|
| `workflows/hotlab-vm-create.yml` | `.github/workflows/hotlab-vm-create.yml` |
| `workflows/hotlab-vm-reaper.yml` | `.github/workflows/hotlab-vm-reaper.yml` |

Install paths must match exactly: they are in the provider attribute conditions.
Protect `main` and these two files (CODEOWNERS, required review).

## 2. Bootstrap (owner credentials, after review)

### 2.1 Install workflows
`git mv` / copy the two files, merge to `main`. Do **not** set the repo variables
below until the identities exist.

### 2.2 Service accounts
```
gcloud iam service-accounts create hotlab-vm-creator --project=$P --display-name="Hot Lab VM creator"
gcloud iam service-accounts create hotlab-vm-reaper  --project=$P --display-name="Hot Lab VM reaper"
```

### 2.3 Custom roles (permission lists: DESIGN §2; finalise via §4.2)
```
gcloud iam roles create hotlabVmCreator --project=$P --title="Hot Lab VM creator" \
  --permissions=compute.instances.create,compute.instances.get,compute.instances.list,compute.instances.delete,compute.instances.start,compute.instances.stop,compute.instances.setLabels,compute.instances.setMetadata,compute.disks.create,compute.disks.get,compute.subnetworks.use,compute.subnetworks.get,compute.networks.get,compute.machineTypes.get,compute.zones.get,compute.regions.get,compute.zoneOperations.get,compute.globalOperations.get,compute.projects.get,compute.images.useReadOnly
gcloud iam roles create hotlabVmReaper --project=$P --title="Hot Lab VM reaper" \
  --permissions=compute.instances.list,compute.instances.get,compute.instances.delete,compute.zoneOperations.get,compute.zones.list
```

### 2.4 Pools, providers, bindings (separate pool per identity)
```
for ROLE in creator reaper; do
  gcloud iam workload-identity-pools create hotlab-$ROLE --project=$P --location=global \
    --display-name="Hot Lab $ROLE"
done

COMMON="assertion.repository_id == '1046667618' && assertion.repository_owner_id == '193945001' && assertion.ref == 'refs/heads/main'"
CREATOR_WF="afewell-hh/hh-learn/.github/workflows/hotlab-vm-create.yml@refs/heads/main"
REAPER_WF="afewell-hh/hh-learn/.github/workflows/hotlab-vm-reaper.yml@refs/heads/main"

gcloud iam workload-identity-pools providers create-oidc github --project=$P --location=global \
  --workload-identity-pool=hotlab-creator --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.workflow_ref=assertion.workflow_ref" \
  --attribute-condition="$COMMON && assertion.workflow_ref == '$CREATOR_WF' && assertion.event_name == 'workflow_dispatch'"

gcloud iam workload-identity-pools providers create-oidc github --project=$P --location=global \
  --workload-identity-pool=hotlab-reaper --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.workflow_ref=assertion.workflow_ref" \
  --attribute-condition="$COMMON && assertion.workflow_ref == '$REAPER_WF' && assertion.event_name in ['schedule','workflow_dispatch']"

# impersonation: exact workflow_ref only
gcloud iam service-accounts add-iam-policy-binding hotlab-vm-creator@$P.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/hotlab-creator/attribute.workflow_ref/$CREATOR_WF"
gcloud iam service-accounts add-iam-policy-binding hotlab-vm-reaper@$P.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/hotlab-reaper/attribute.workflow_ref/$REAPER_WF"
```

Project role bindings — one **unconditioned** binding (for list/get/operations, which have
no instance resource) and one **conditioned** binding (for the mutating verbs). Because a
custom role cannot be partly conditioned, split each role into a read part and a mutate
part, or bind the whole role with the condition and verify with §4.2 that list/get still
work; adjust until the troubleshooter output matches DESIGN §2. Condition:
```
resource.type == 'compute.googleapis.com/Instance' && resource.name.extract('/instances/{n}').startsWith('hotlab-') && resource.name.startsWith('projects/teched-473722/zones/us-west4-')
```
(`U`: confirm Compute honours `resource.name` conditions for each permission.)

### 2.5 Network and access (needed because VMs have no public IP)
Cloud NAT + router on the chosen network/region for egress, and an IAP firewall rule
(`35.235.240.0/20` → tcp:22) for access. Grant humans (not the SAs)
`roles/iap.tunnelResourceAccessor` and `roles/compute.osLogin`. Connect with
`gcloud compute ssh <vm> --tunnel-through-iap --zone <z>`. Coordinator decision; not in this PR.

### 2.6 Repo variables (Settings → Variables)
`HOTLAB_GCP_PROJECT` (exists), `HOTLAB_CREATOR_WIF_PROVIDER`, `HOTLAB_CREATOR_SA_EMAIL`,
`HOTLAB_REAPER_WIF_PROVIDER`, `HOTLAB_REAPER_SA_EMAIL`, optional `HOTLAB_MIN_CPU_PLATFORM`.
Provider value form: `projects/$PN/locations/global/workloadIdentityPools/hotlab-<role>/providers/github`.

### 2.7 Budget alert and dated price
```
gcloud billing budgets create --billing-account=<ACCOUNT_ID> \
  --display-name="hotlab-teched-473722" \
  --budget-amount=50USD --filter-projects=projects/$P \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 \
  --notifications-rule-pubsub-topic=<optional> 
```
Proposed: **$50/month, alerts at 50% / 90% / 100%**, to the billing-account admins
plus **`<recipient email — coordinator to set>`** via a Cloud Monitoring email
channel. A budget **alerts, it does not stop spend**. (Also confirm that this project's
existing spend does not already exceed $50; if shared with Labapp, filter by label
`managed-by=hotlab` or raise the figure.)
Dated price: query the Cloud Billing Catalog (service "Compute Engine", SKU "N2 Instance Core/Ram running in Americas/us-west4", plus the pd-standard SKU) and record the figure and date in
DESIGN §8.

### 2.8 Optional server-side machine-type cap
If `teched-473722` is in an Organization: custom org-policy constraint on
`compute.googleapis.com/Instance` denying creation when `resource.machineType` is not in
the allowlist, scoped to this project. Skip if standalone.

## 3. Day-to-day
* Create: Actions → *Hot Lab VM (creator)* → `create`, ticket, machine, zone, ttl, hold.
* Inspect any time: *Hot Lab Cloud (trusted)* → `inventory` (shows labels; read-only).
* Reaper first use: run *Hot Lab VM (reaper)* via **workflow_dispatch with dry_run=true**,
  read the summary, then let the schedule run live.
* Early teardown: cancel the creator run (teardown step runs), or `delete` operation.

## 4. Out-of-band verification (replaces "provoke a failure" tests)

### 4.1 Self-destruct canary (the one that matters)
With owner credentials, create a throwaway VM named `hotlab-canary-<date>` using the
**same flags** as the workflow but `--machine-type=n2-standard-2` and
`--termination-time` ≈ 15 minutes ahead (absolute RFC3339 UTC; use the shortest the API
accepts), same labels. Confirm:
(a) creation succeeds with `--min-cpu-platform="Intel Cascade Lake"` + nested virt in the
chosen zone (settles the CPU-platform/zone `U`), and that your `gcloud` accepts
`--termination-time` (else use the REST `instances.insert` body, DESIGN §1.6),
(b) `gcloud compute instances describe` shows `scheduling.terminationTime`,
`instanceTerminationAction: DELETE` and **no** `maxRunDuration`,
(c) **with no workflow, reaper or human acting** (the reaper must be disabled or the
canary must not match its rules: name it outside `hotlab-` if you need to exclude the
reaper, accepting it then differs from the real shape only by name), the instance and its
boot disk are gone at the deadline (`gcloud compute instances list`, `gcloud compute disks list`),
(d) **stop/start does not extend it**: create a second canary with a ~20 min deadline,
`stop` it at ~5 min, `start` it at ~10 min, and confirm it is still deleted at the original
deadline; also note what happens if the deadline passes while it is *stopped* (deleted
then, or at next start).
Record the results in the PR. If (c) or (d) fails, stop: DESIGN §1 is invalid.

### 4.2 Permission scoping (explicit GRANTED / NOT_GRANTED)
```
gcloud policy-troubleshoot iam //cloudresourcemanager.googleapis.com/projects/$P \
  --principal-email=hotlab-vm-reaper@$P.iam.gserviceaccount.com --permission=compute.instances.create   # expect NOT_GRANTED
... --permission=compute.instances.delete  (with resource=…/instances/hotlab-x → GRANTED; …/instances/labapp-x → NOT_GRANTED)
gcloud policy-troubleshoot iam … --principal-email=hotlab-vm-creator@… --permission=compute.instances.setScheduling   # NOT_GRANTED
```
Also check `gcloud projects get-iam-policy $P` lists only the intended bindings for the
two SAs and that no other principal can impersonate them
(`gcloud iam service-accounts get-iam-policy`).

### 4.3 First live runs
1. Reaper dry-run with no instances → green, "violating: 0".
2. Creator `create`, `hold_minutes=5`, `n2-standard-8` → read-back all PASS, teardown confirmed.
3. Creator `create` then cancel mid-hold → teardown still runs.
4. Reaper live after manually creating (owner) an unlabelled `hotlab-orphan` → deleted.

## 5. Incident / kill switch
1. Disable the creator workflow (Actions UI) — stops new VMs.
2. `gcloud iam service-accounts disable hotlab-vm-creator@$P.iam.gserviceaccount.com`.
3. Inventory; delete stragglers: `gcloud compute instances delete <name> --zone <z>`.
4. Do **not** disable the reaper while VMs exist.
