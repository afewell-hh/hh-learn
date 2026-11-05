#!/usr/bin/env bash
# Static guards for this tree. Executes nothing in GCP and nothing from the wiring diagram.
#   bash hotlab/proof-501/check-static.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rc=0
while IFS= read -r f; do
  bash -n "$f" || { echo "SYNTAX: $f"; rc=1; }
done < <(find "$here" -name '*.sh' -type f)

# The #508 controls are the only creation path. Match code lines only (not comments/docs).
if grep -rnE '^[^#]*gcloud[[:space:]]+compute[[:space:]]+instances[[:space:]]+(create|delete)' "$here" --include='*.sh'; then
  echo "GUARD: direct instance create/delete found; use the #508 workflow"; rc=1
fi
if grep -rnE '^[^#]*(--max-run-duration|--machine-type)' "$here" --include='*.sh'; then
  echo "GUARD: provisioning flags belong to the #508 workflow, not this tree"; rc=1
fi
# Never modify fabric/fabricator.
if grep -rnE '^[^#]*(git[[:space:]]+(apply|am|commit|push)|patch[[:space:]]+-p|sed[[:space:]]+-i)[^#]*(FABRIC|FABRICATOR)_SRC' "$here" --include='*.sh'; then
  echo "GUARD: scripts must not modify fabric/fabricator source"; rc=1
fi
if command -v shellcheck >/dev/null; then
  find "$here" -name '*.sh' -type f -exec shellcheck -x -e SC1091,SC2154 {} + || rc=1
else
  echo "note: shellcheck not installed; skipped"
fi
exit "$rc"
