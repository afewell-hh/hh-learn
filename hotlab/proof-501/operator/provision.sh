#!/usr/bin/env bash
# Operator workstation. Requests the proof VM THROUGH the #508 controlled creator
# workflow (hotlab-vm-create.yml: absolute terminationTime + DELETE, ownership labels,
# always() teardown, independent reaper). This script NEVER calls
# `gcloud compute instances create` itself (check-static.sh enforces that).
#
# Default is DRY RUN: prints the dispatch it would make. Pass --execute to dispatch.
# Prerequisites (U until verified): PR #514 merged AND its workflow installed at
# .github/workflows/hotlab-vm-create.yml on main (it is staged under docs/ until then),
# the creator WIF identity bootstrapped, vars set, and Cloud NAT + IAP (PR #514 RUNBOOK 2.5).
#
# Usage: provision.sh [--execute] [--machine n2-standard-16] [--ttl 360] [--disk 300] [--zone us-west4-a]
set -euo pipefail

MACHINE=n2-standard-16        # 16 vCPU / 64 GB vs ~27.5 GB allocated; n2-standard-8 (32 GB) may be tried after
TTL=360                       # minutes; creator allows 15-480. Absolute deadline, survives stop/start.
DISK=300                      # GB boot disk (creator allows 50-500). VLAB qcow2 maxima ~300 GB, sparse.
ZONE=us-west4-a
EXECUTE=0
REPO=afewell-hh/hh-learn
WORKFLOW=hotlab-vm-create.yml

while (( $# )); do
  case "$1" in
    --execute) EXECUTE=1 ;;
    --machine) MACHINE="$2"; shift ;;
    --ttl) TTL="$2"; shift ;;
    --disk) DISK="$2"; shift ;;
    --zone) ZONE="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

# Only machine types the creator allowlists (all Intel N2: nested-virt capable; N2_CPUS quota 200).
case "$MACHINE" in n2-standard-8|n2-highmem-4|n2-standard-16) ;; *) echo "creator allowlist is n2-standard-8|n2-highmem-4|n2-standard-16" >&2; exit 2;; esac

# teardown=at-expiry on purpose: with teardown=now the creator job HOLDS a runner for
# hold_minutes and then deletes; a proof session needs the VM to outlive that job.
# The terminationTime + reaper still bound the lifetime.
cmd=(gh workflow run "$WORKFLOW" --repo "$REPO"
  -f operation=create -f ticket=501
  -f machine_type="$MACHINE" -f zone="$ZONE"
  -f ttl_minutes="$TTL" -f hold_minutes=0 -f teardown=at-expiry
  -f boot_disk_gb="$DISK")

echo "Will dispatch (via the #508 controls):"
printf '  %q' "${cmd[@]}"; echo
cat <<EOF

Cost to record: machine_type=${MACHINE}, hard max lifetime ${TTL} min (absolute). Look up the
CURRENT list price for ${MACHINE} in ${ZONE} and write it, with the date and source, in the
results. The ticket's reference prices are n1-standard-32 ~\$1.52/h and n2-standard-32 ~\$1.55/h;
a 16 vCPU instance is roughly half. Do not reuse those as the actual rate.

Known mismatches between the ticket and the creator, to note in the report:
  - ticket says pd-balanced; the creator hard-codes --boot-disk-type=pd-standard (#514).
  - the creator attaches no service account, no external IP, and delivers no user-data:
    the guest needs Cloud NAT egress, and bootstrap files are pushed with stage.sh over IAP.
EOF

if (( ! EXECUTE )); then echo; echo "DRY RUN: nothing dispatched. Re-run with --execute."; exit 0; fi

"${cmd[@]}"
sleep 8
run_id="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId')"
echo "Dispatched run ${run_id}: https://github.com/${REPO}/actions/runs/${run_id}"
echo "Instance name will be hotlab-${run_id}-1 (hotlab-<run id>-<attempt>); confirm in the run summary."
echo "Next: watch the run; then ./stage.sh hotlab-${run_id}-1 ${ZONE}"
