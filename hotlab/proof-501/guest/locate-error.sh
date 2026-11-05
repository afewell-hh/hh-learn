#!/usr/bin/env bash
# Locate (read-only grep) the file:line in fabric/fabricator source that emits an error
# captured in raw/<id>.txt. Never modifies the source checkouts.
# Usage: bash locate-error.sh proof.env RAW_ID
# Heuristic: take error-looking lines, strip variable-looking tokens, search each remaining
# literal fragment with grep -F. Output is a CANDIDATE list for a human to confirm (tag U).
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: locate-error.sh proof.env RAW_ID}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"
id="${2:?RAW_ID}"
src="${RAW_DIR}/${id}.txt"
out="${RAW_DIR}/locate-${id}.txt"
[[ -f "$src" ]] || die "no such raw file: $src"

: > "$out"
roots=()
[[ -n "${FABRIC_SRC:-}" && -d "${FABRIC_SRC}" ]] && roots+=("${FABRIC_SRC}")
[[ -n "${FABRICATOR_SRC:-}" && -d "${FABRICATOR_SRC}" ]] && roots+=("${FABRICATOR_SRC}")
if (( ${#roots[@]} == 0 )); then
  echo "FABRIC_SRC/FABRICATOR_SRC not set: cannot locate. Check out the tags matching 'hhfab version' and re-run." | tee -a "$out"
  rec "locate-${id}" 3-wiring INCONCLUSIVE host "no source checkouts configured; file:line NOT determined" "raw/locate-${id}.txt"
  exit 0
fi

# Candidate fragments: quoted strings and the text after 'error'/'invalid'/'failed', 12+ chars, no digits-only.
mapfile -t frags < <(grep -iE 'error|invalid|failed|not allowed|must|cannot|rejected' "$src" \
  | sed -E 's/^[^:]*(ERR|error|Error)[^:]*:[[:space:]]*//' \
  | sed -E 's/[0-9a-f]{8,}|"[^"]*"|\x27[^\x27]*\x27//g' \
  | tr ':' '\n' | sed -E 's/^[[:space:]]+|[[:space:]]+$//g' | awk 'length($0)>=12' | sort -u | head -20)

found=0
for fr in "${frags[@]}"; do
  for r in "${roots[@]}"; do
    hits="$(grep -rnF --include='*.go' -- "$fr" "$r" 2>/dev/null | head -5 || true)"
    if [[ -n "$hits" ]]; then
      { echo "## fragment: $fr"; echo "$hits"; } >> "$out"
      found=1
    fi
  done
done
if (( found )); then
  rec "locate-${id}" 3-wiring OBSERVED host "candidate file:line matches for the error text (human must confirm the right one): raw/locate-${id}.txt" "raw/locate-${id}.txt"
else
  echo "no literal match; error text may be built from format strings. Search the source manually using raw/${id}.txt." | tee -a "$out"
  rec "locate-${id}" 3-wiring INCONCLUSIVE host "no literal match found; file:line NOT determined automatically" "raw/locate-${id}.txt"
fi
