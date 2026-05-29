#!/usr/bin/env bash
#
# Post-deploy verification harness for Issue #468 (production rollout of the
# Issue #461 Cognito dual-guard hardening).
#
# Runs the canonical probe matrix against a deployed API base. Captures
# headers + body for every probe, writes a structured evidence file, and
# emits a PASS/FAIL summary on stdout. Exits non-zero if the primary
# security probe (S-PRIMARY) does not return 401.
#
# IMPORTANT: this script is pure-curl. It does NOT mutate production.
# It calls only safe, read-style endpoints plus one POST to /admin/test/reset
# (which is itself dual-guarded on the server and is expected to return 403
# on production — the call is the test).
#
# Usage:
#   scripts/verify-issue-468-post-deploy.sh [--api-base URL] [--out PATH]
#                                            [--cert-id ID]
#
# Defaults:
#   --api-base   https://api.hedgehog.cloud
#   --out        verification-output/issue-468/post-deploy-evidence.txt
#   --cert-id    randomly-generated UUID-shaped string
#
# Environment overrides (lower precedence than flags):
#   API_BASE, OUT_FILE, CERT_ID
#
# Required tools: bash, curl. Optional: uuidgen (falls back to /dev/urandom).

set -u
set -o pipefail

# ---------------------------------------------------------------------------
# Defaults / argument parsing
# ---------------------------------------------------------------------------
API_BASE="${API_BASE:-https://api.hedgehog.cloud}"
OUT_FILE="${OUT_FILE:-verification-output/issue-468/post-deploy-evidence.txt}"
CERT_ID="${CERT_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base) API_BASE="$2"; shift 2 ;;
    --out)      OUT_FILE="$2"; shift 2 ;;
    --cert-id)  CERT_ID="$2";  shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$CERT_ID" ]]; then
  if command -v uuidgen >/dev/null 2>&1; then
    CERT_ID="$(uuidgen | tr 'A-Z' 'a-z')"
  else
    CERT_ID="probe-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
fi

# Trim trailing slash from API_BASE for clean concatenation.
API_BASE="${API_BASE%/}"

# Ensure output directory exists.
mkdir -p "$(dirname "$OUT_FILE")"

SENTINEL_COOKIE='hhl_access_token=shadow_e2e_test_token'
TS_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ---------------------------------------------------------------------------
# Probe definitions
#
# Each row: ID | label | METHOD | path-with-query | expected_status |
#           cookie | extra_args
#
# Use '-' for "no cookie" and "-" for "no extra args".
# ---------------------------------------------------------------------------

# Canonical paths preserved verbatim from the Issue #468 directive.
# A drift note: /course/status, /pathway/status, /module/progress are not
# registered routes in the current main (renamed/relocated upstream); after
# deploy these may resolve as 404 from the dispatcher rather than 401 from
# the auth layer. Either outcome confirms the bypass cookie is NOT honored.
# This script records the literal expected codes from the issue body and
# notes any drift in the FAIL column for the lead to adjudicate.

PROBES=(
  "S-NOAUTH-1|GET /course/status (no cookie)|GET|/course/status?course_slug=hedgehog-lab-foundations|401|-|-"
  "S-NOAUTH-2|GET /pathway/status (no cookie)|GET|/pathway/status?pathway_slug=network-like-hyperscaler|401|-|-"
  "S-NOAUTH-3|GET /module/progress (no cookie)|GET|/module/progress?module_slug=fabric-operations-welcome|401|-|-"
  "S-NOAUTH-4|GET /certificates (no cookie)|GET|/certificates|401|-|-"
  "S-NOAUTH-5|GET /certificate/{nonexistent} (no cookie)|GET|/certificate/${CERT_ID}|404|-|-"
  "S-ADMIN-1|POST /admin/test/reset with sentinel cookie|POST|/admin/test/reset|403|${SENTINEL_COOKIE}|-d {}"
  "S-PRIMARY|GET /course/status with sentinel cookie|GET|/course/status?course_slug=hedgehog-lab-foundations|401|${SENTINEL_COOKIE}|-"
)

# ---------------------------------------------------------------------------
# Run probes
# ---------------------------------------------------------------------------

declare -a RESULTS=()  # rows: "ID|label|expected|actual|verdict"

{
  printf '=== Issue #468 — Post-deploy verification matrix ===\n'
  printf 'Captured at: %s\n' "$TS_UTC"
  printf 'API base:    %s\n' "$API_BASE"
  printf 'Cert ID:     %s\n' "$CERT_ID"
  printf 'Tooling:     %s\n' "$(curl --version | head -1)"
  printf 'Branch HEAD: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  printf '\n'
} > "$OUT_FILE"

run_probe() {
  local id="$1" label="$2" method="$3" path="$4" expected="$5" cookie="$6" extra="$7"

  local url="${API_BASE}${path}"
  local -a curl_args=(-sS -i -X "$method" -o /tmp/issue-468-body.$$ -w '%{http_code}' "$url")
  if [[ "$cookie" != "-" ]]; then
    curl_args+=(-H "Cookie: ${cookie}")
  fi
  if [[ "$extra" != "-" ]]; then
    # shellcheck disable=SC2206
    local -a extra_arr=($extra)
    curl_args+=("${extra_arr[@]}")
  fi

  {
    printf -- '--------------------------------------------------------------------------------\n'
    printf '[%s] %s\n' "$id" "$label"
    printf 'Probe URL : %s\n' "$url"
    printf 'Method    : %s\n' "$method"
    printf 'Expected  : %s\n' "$expected"
    printf 'Cookie    : %s\n' "${cookie/-/<none>}"
    printf 'Extra args: %s\n' "${extra/-/<none>}"
  } >> "$OUT_FILE"

  local headers_file=/tmp/issue-468-headers.$$
  local status_code
  status_code="$(curl "${curl_args[@]}" 2>/dev/null > "$headers_file" || echo '000')"

  {
    printf -- '--- summary line (status code) ---\n%s\n' "$status_code"
    printf -- '--- -i headers ---\n'
    cat "$headers_file" 2>/dev/null || true
    printf -- '\n--- body ---\n'
    cat /tmp/issue-468-body.$$ 2>/dev/null || true
    printf '\n\n'
  } >> "$OUT_FILE"

  rm -f "$headers_file" /tmp/issue-468-body.$$

  local verdict
  if [[ "$status_code" == "$expected" ]]; then
    verdict="PASS"
  else
    verdict="FAIL"
  fi
  RESULTS+=("${id}|${label}|${expected}|${status_code}|${verdict}")
}

for row in "${PROBES[@]}"; do
  IFS='|' read -r id label method path expected cookie extra <<<"$row"
  run_probe "$id" "$label" "$method" "$path" "$expected" "$cookie" "$extra"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

primary_verdict=""
fail_count=0
{
  printf -- '--------------------------------------------------------------------------------\n'
  printf '=== SUMMARY ===\n'
  printf '%-12s | %-50s | %-8s | %-6s | %s\n' "ID" "Label" "Expected" "Actual" "Verdict"
  printf '%-12s-+-%-50s-+-%-8s-+-%-6s-+-%s\n' '------------' '--------------------------------------------------' '--------' '------' '-------'
  for r in "${RESULTS[@]}"; do
    IFS='|' read -r id label expected actual verdict <<<"$r"
    printf '%-12s | %-50s | %-8s | %-6s | %s\n' "$id" "$label" "$expected" "$actual" "$verdict"
    [[ "$verdict" == "FAIL" ]] && fail_count=$((fail_count+1))
    [[ "$id" == "S-PRIMARY" ]] && primary_verdict="$verdict"
  done
  printf '\n'
  printf 'Primary security probe (S-PRIMARY): %s\n' "${primary_verdict:-MISSING}"
  printf 'Total failures: %s of %s\n' "$fail_count" "${#RESULTS[@]}"
} | tee -a "$OUT_FILE"

echo
echo "Evidence written to: $OUT_FILE"

# Non-zero exit only if the primary security probe failed. Other drift
# (e.g. 404 from renamed routes) is reported but does not fail the script —
# the lead adjudicates per the prep comment.
if [[ "$primary_verdict" != "PASS" ]]; then
  echo "ERROR: primary security probe did not return the expected status." >&2
  exit 1
fi

exit 0
