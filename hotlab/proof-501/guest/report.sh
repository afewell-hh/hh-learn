#!/usr/bin/env bash
# Render evidence.jsonl into (a) summary.json (machine-readable) and (b) a Markdown table
# to paste into RESULTS-TEMPLATE.md. Read-only. Produces NO verdict: the verdict is a human
# decision recorded in the template, because "multi-fabric server works" needs checks 1-4
# plus controlled probes and a reviewer.
# Usage: bash report.sh proof.env
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: report.sh proof.env}"
: "${PROOF_OUT:?}"
EV="${PROOF_OUT}/evidence.jsonl"
[[ -s "$EV" ]] || { echo "no evidence at $EV" >&2; exit 1; }

jq -s '{
  generated: (now | todate),
  counts: (group_by(.status) | map({(.[0].status): length}) | add),
  by_check: (group_by(.check) | map({check: .[0].check, statuses: (group_by(.status) | map({(.[0].status): length}) | add)})),
  rejected: ([.[] | select(.status=="REJECTED")] | length > 0),
  any_inconclusive: ([.[] | select(.status=="INCONCLUSIVE")] | length > 0),
  any_fail: ([.[] | select(.status=="FAIL")] | length > 0),
  records: .
}' "$EV" > "${PROOF_OUT}/summary.json"

{
  echo "| check | id | status | scope | observation |"
  echo "|---|---|---|---|---|"
  jq -r '. | "| \(.check) | \(.id) | **\(.status)** | \(.scope) | \(.observation | gsub("\\|"; "/") | gsub("\n"; " ")) |"' "$EV"
} > "${PROOF_OUT}/summary.md"

echo "wrote ${PROOF_OUT}/summary.json and summary.md"
jq -r '"counts: \(.counts)  rejected: \(.rejected)  inconclusive: \(.any_inconclusive)  fail: \(.any_fail)"' "${PROOF_OUT}/summary.json"
