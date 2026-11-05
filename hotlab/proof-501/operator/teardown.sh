#!/usr/bin/env bash
# Operator workstation. Deletes the proof VM through the #508 workflow (operation=delete),
# then verifies it is gone with the read-only inventory operation, and prints the
# lifetime for the cost line. Never calls `gcloud compute instances delete` directly.
# Default is DRY RUN. The VM also self-destructs at its absolute terminationTime and the
# reaper sweeps it; this script is the prompt, expected path ("stop the instance when idle").
#
# Usage: teardown.sh [--execute] INSTANCE [PROOF_START_UTC] [HOURLY_RATE_USD]
set -euo pipefail
EXECUTE=0; [[ "${1:-}" == "--execute" ]] && { EXECUTE=1; shift; }
inst="${1:?instance name hotlab-<runid>-<attempt>}"
start="${2:-}"; rate="${3:-}"
[[ "$inst" =~ ^hotlab-[a-z0-9-]+$ ]] || { echo "refusing non-hotlab instance name" >&2; exit 2; }
REPO=afewell-hh/hh-learn

echo "Before deleting: pull the evidence off the VM (README step 7). Deleting the VM deletes the boot disk."
cmd=(gh workflow run hotlab-vm-create.yml --repo "$REPO" -f operation=delete -f instance_name="$inst")
printf 'Will dispatch:'; printf ' %q' "${cmd[@]}"; echo
if (( ! EXECUTE )); then echo "DRY RUN: re-run with --execute."; else
  "${cmd[@]}"
  now="$(date -u +%FT%TZ)"
  echo "Delete requested at ${now}."
  echo "Verify absence: gh workflow run hotlab-cloud.yml --repo ${REPO} -f operation=inventory, and read the run summary."
  if [[ -n "$start" && -n "$rate" ]]; then
    s="$(date -u -d "$start" +%s)"; e="$(date -u -d "$now" +%s)"
    awk -v s="$s" -v e="$e" -v r="$rate" 'BEGIN{h=(e-s)/3600; printf "Running time ~%.2f h x $%s/h = ~$%.2f (compute only; add disk; confirm with billing)\n", h, r, h*r}'
  else
    echo "For the cost line pass PROOF_START_UTC and HOURLY_RATE_USD, or compute: hours running x dated list price."
  fi
fi
