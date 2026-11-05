#!/usr/bin/env bash
# Static guard for the hard rule: no provider-specific commands in the guest path.
# Run in CI or by hand. Exits 1 on any hit. Patterns are split so this file does
# not match itself. README/docs are excluded (they must be free to name providers).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pat="g""cloud|metadata\.g""oogle|169\.254\.169\.254|g""sutil|googleapis|az ""vm|aws ""ec2|ec2-metadata|IMDS|google-compute-engine|qm ""create"
if grep -rEn --include='*.sh' --include='*.yaml' --include='*.service' --include='*.conf' --include='*.example' \
  --exclude='check-portability.sh' -e "${pat}" "${HERE}"; then
  echo "check-portability: FAIL (provider-specific reference above)" >&2
  exit 1
fi
echo "check-portability: OK"
