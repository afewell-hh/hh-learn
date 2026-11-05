#!/usr/bin/env bash
# Hot Lab VM reaper sweep (#508). Installed at scripts/hotlab/vm-reaper-sweep.sh.
#
# This file is NOT run from the workspace checkout. .github/workflows/hotlab-vm-reaper.yml
# fetches it from the GitHub Contents API at the commit SHA in repo variable
# HOTLAB_REAPER_SCRIPT_SHA (set by a repo admin after review), checks that SHA is an
# ancestor of main, validates the response, and runs it from RUNNER_TEMP. Merging a change
# to this file therefore does NOT change what the reaper identity executes until an admin
# bumps the variable. The caps below live here, not in the workflow, for the same reason.
# Required env: PROJECT, DRY_RUN ("true"/"false"), GITHUB_STEP_SUMMARY.
# What is and is not checked: see the header of the reaper workflow.
set -euo pipefail

# Reaper-owned copies of the caps (intentionally independent of the creator).
MAX_CONCURRENT="2"
MAX_LIFETIME_S="29400"   # 480 min + 10 min slack; policy maximum for ANY deadline
MIN_DISK_GB="50"
MAX_DISK_GB="500"
ALLOWED_ZONES="us-west4-a,us-west4-b,us-west4-c"
ALLOWED_MACHINES="n2-standard-8,n2-highmem-4,n2-standard-16"
: "${PROJECT:?}" "${DRY_RUN:?}"

now="$(date +%s)"
echo "### Reaper sweep (now=${now}, dry_run=${DRY_RUN})" >> "$GITHUB_STEP_SUMMARY"

list() { gcloud compute instances list --project="$PROJECT" --filter="name~'^hotlab-'" --format=json; }
list > all.json     # a list error aborts the run (set -e): never read as "empty"
jq -e 'type=="array"' all.json >/dev/null

# Disks are listed separately because instance JSON carries only the disk
# SOURCE url, not its type. A list error aborts the run (set -e).
gcloud compute disks list --project="$PROJECT" --filter="name~'^hotlab-'" --format=json > disks.json
jq -e 'type=="array"' disks.json >/dev/null
disks_json="$(jq '[.[] | {(.name): {type: (.type|split("/")|last), size: (.sizeGb|tonumber)}}] | add // {}' disks.json)"

# Pass 0: normalise terminationTime and creationTimestamp (server-set, not a
# label) to epoch seconds (GCP may return offsets/fractions).
# Unparseable => "bad"; absent => "".
: > tt.tsv
while IFS=$'\t' read -r n t c; do
  [ -n "$n" ] || continue
  if [ -n "$t" ]; then e="$(date -d "$t" +%s 2>/dev/null || echo bad)"; else e=""; fi
  if [ -n "$c" ]; then ce="$(date -d "$c" +%s 2>/dev/null || echo bad)"; else ce=""; fi
  printf '%s\t%s\t%s\n' "$n" "$e" "$ce" >> tt.tsv
done < <(jq -r '.[] | [.name, (.scheduling.terminationTime // ""), (.creationTimestamp // "")] | @tsv' all.json)
tt_json="$(jq -Rn '[inputs | split("\t") | {(.[0]): {tt: .[1], cr: .[2]}}] | add // {}' < tt.tsv)"

# Pass 1: per-instance rule violations. First match wins.
# The deadline cap uses server-side creationTimestamp, NOT the created-at
# label, so a tampered label cannot hide an overlong deadline.
jq -r --arg now "$now" --arg ml "$MAX_LIFETIME_S" --arg zones "$ALLOWED_ZONES" --arg machines "$ALLOWED_MACHINES" \
      --arg mind "$MIN_DISK_GB" --arg maxd "$MAX_DISK_GB" \
      --argjson tt "$tt_json" --argjson dk "$disks_json" '
  ($now|tonumber) as $now | ($ml|tonumber) as $ml | ($mind|tonumber) as $mind | ($maxd|tonumber) as $maxd |
  .[] | . as $i
  | ($i.labels // {}) as $l
  | ($i.zone|split("/")|last) as $z
  | ($i.machineType|split("/")|last) as $mt
  | ($i.scheduling // {}) as $s
  | ($tt[$i.name] // {}) as $t
  | ([($i.metadata.items // [])[] | {(.key): .value}] | add // {}) as $md
  | ((($i.disks // [])[0].source // "") | split("/") | last) as $dname
  | ($dk[$dname] // null) as $disk
  | (["managed-by","owner","ticket","run-id","created-at","expires-at"] | map(select($l[.] == null))) as $missing
  | (if ($missing|length) > 0 then "missing-labels:" + ($missing|join(","))
     elif $l["managed-by"] != "hotlab" then "managed-by-not-hotlab"
     elif (($l["created-at"]|test("^[0-9]+$"))|not) or (($l["expires-at"]|test("^[0-9]+$"))|not) then "malformed-timestamps"
     elif ($l["expires-at"]|tonumber) <= $now then "expired"
     elif ($s | has("maxRunDuration")) then "maxRunDuration-present-resets-on-restart"
     elif ($s.instanceTerminationAction // "") != "DELETE" then "terminationAction-not-DELETE"
     elif ($t.tt // "") == "" then "terminationTime-missing"
     elif $t.tt == "bad" then "terminationTime-unparseable"
     elif ($t.tt|tonumber) <= $now then "terminationTime-passed"
     elif ($t.cr // "") == "" or $t.cr == "bad" then "creationTimestamp-missing-or-unparseable"
     elif (($t.tt|tonumber) - ($t.cr|tonumber)) > $ml then "deadline-exceeds-policy-max"
     elif (($t.tt|tonumber) - $now) > $ml then "deadline-too-far-in-future"
     elif (($l["expires-at"]|tonumber) - $now) > $ml then "expires-at-too-far-in-future"
     elif (($t.tt|tonumber) - ($l["expires-at"]|tonumber) | fabs) > 60 then "terminationTime-differs-from-expires-at"
     elif ($s.automaticRestart // true) != false then "automaticRestart-not-false"
     elif ($s.onHostMaintenance // "") != "TERMINATE" then "onHostMaintenance-not-TERMINATE"
     elif ($s.provisioningModel // "STANDARD") != "STANDARD" then "provisioningModel-not-STANDARD"
     elif (($md["enable-oslogin"] // "") | ascii_upcase) != "TRUE" then "enable-oslogin-not-TRUE"
     elif (($md["block-project-ssh-keys"] // "") | ascii_upcase) != "TRUE" then "block-project-ssh-keys-not-TRUE"
     elif (($i.networkInterfaces // []) | length) != 1 then "nic-count-not-1"
     elif (($i.networkInterfaces // []) | map((.accessConfigs // []) + (.ipv6AccessConfigs // [])) | add // [] | length) > 0 then "external-ip"
     elif (($i.serviceAccounts // []) | length) > 0 then "service-account-attached"
     elif ($i.deletionProtection // false) then "deletion-protection-set"
     elif (($i.disks // []) | (length != 1 or (.[0].boot != true) or (.[0].autoDelete != true))) then "disk-list-not-single-autodelete-boot"
     elif $disk == null then "boot-disk-not-found-in-disk-list"
     elif $disk.type != "pd-standard" then "boot-disk-type-not-pd-standard"
     elif ($disk.size < $mind or $disk.size > $maxd) then "boot-disk-size-out-of-range"
     elif (($l["expires-at"]|tonumber) - ($l["created-at"]|tonumber)) > $ml then "lifetime-exceeds-cap"
     elif (($z | IN($zones|split(",")[])) | not) then "zone-not-allowed"
     elif (($mt | IN($machines|split(",")[])) | not) then "machine-type-not-allowed"
     else empty end) as $reason
  | [$i.name, $z, $reason] | @tsv' all.json > violators.tsv

# Pass 2: over-concurrency among the survivors (keep oldest, delete newest).
viol_json="$(cut -f1 violators.tsv | jq -R . | jq -s .)"
jq -r --argjson viol "$viol_json" --argjson max "$MAX_CONCURRENT" '
  map(select(.name as $n | (any($viol[]; . == $n)) | not))
  | sort_by(.creationTimestamp) | .[$max:] | .[]
  | [.name, (.zone|split("/")|last), "over-concurrency-cap"] | @tsv' all.json >> violators.tsv

total="$(jq 'length' all.json)"
nviol="$(wc -l < violators.tsv)"
echo "hotlab-* instances: ${total}; violating: ${nviol}" | tee -a "$GITHUB_STEP_SUMMARY"
if [ "$nviol" -gt 0 ]; then
  { echo ""; echo '| instance | zone | reason |'; echo '|---|---|---|'; \
    awk -F'\t' '{print "| "$1" | "$2" | "$3" |"}' violators.tsv; } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$DRY_RUN" = "true" ]; then
  echo "Dry run: nothing deleted." | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi

errors=0
while IFS=$'\t' read -r name zone reason; do
  [ -n "$name" ] || continue
  echo "Deleting ${name} (${zone}): ${reason}"
  if ! gcloud compute instances delete "$name" --zone "$zone" --project "$PROJECT" --quiet; then
    echo "::error::delete failed for ${name}"; errors=$((errors+1))
  fi
done < violators.tsv

# Positive confirmation: re-list and require every violator to be gone.
list > after.json
remaining="$(jq -r --argjson viol "$(cut -f1 violators.tsv | jq -R . | jq -s .)" \
  '[.[] | select(.name as $n | any($viol[]; . == $n)) | .name] | join(",")' after.json)"
if [ -n "$remaining" ] || [ "$errors" -ne 0 ]; then
  echo "::error::Reaper could not clear: '${remaining}' (delete errors: ${errors})"
  exit 1
fi
echo "Sweep complete; all violators confirmed absent." | tee -a "$GITHUB_STEP_SUMMARY"
