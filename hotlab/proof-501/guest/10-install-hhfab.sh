#!/usr/bin/env bash
# Stage 1 (guest): install the 26.05 hhfab from a checksum-pinned archive.
# There is deliberately NO default URL or digest: how 26.05 is obtained is an operator
# input that must be recorded in the report. The hotlab/bootstrap pin set only covers
# hhfab 0.43.1 and is not duplicated here. Never installs an unverified binary.
# Usage: sudo bash 10-install-hhfab.sh /path/to/proof.env
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: 10-install-hhfab.sh proof.env}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"

: "${HHFAB_2605_URL:?set HHFAB_2605_URL in proof.env}"
: "${HHFAB_2605_ARCHIVE_SHA256:?set HHFAB_2605_ARCHIVE_SHA256 in proof.env}"
[[ "${HHFAB_2605_ARCHIVE_SHA256}" =~ ^[0-9a-f]{64}$ ]] || die "HHFAB_2605_ARCHIVE_SHA256 must be 64 lowercase hex"
[[ "${HHFAB_2605_URL}" == https://* ]] || die "HHFAB_2605_URL must be https"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
curl -fsSL --retry 3 -o "${work}/hhfab.tgz" "${HHFAB_2605_URL}"
got="$(sha256sum "${work}/hhfab.tgz" | cut -d' ' -f1)"
if [[ "$got" != "${HHFAB_2605_ARCHIVE_SHA256}" ]]; then
  rec hhfab-2605-download 1-install FAIL host "archive sha256 ${got} != pinned ${HHFAB_2605_ARCHIVE_SHA256}"
  exit 1
fi
rec hhfab-2605-download 1-install PASS host "archive sha256 matches pin (${got})"

tar -xzOf "${work}/hhfab.tgz" "${HHFAB_2605_MEMBER}" > "${work}/hhfab"
install -m 0755 "${work}/hhfab" /usr/local/bin/hhfab
cap hhfab-2605-version hhfab version || true
rec hhfab-2605-version 1-install OBSERVED host "installed binary sha256 $(sha256sum /usr/local/bin/hhfab | cut -d' ' -f1); version output in raw" "raw/hhfab-2605-version.txt"
echo "Record in the report: URL, archive digest, binary digest, 'hhfab version' output. Confirm it corresponds to Hedgehog 26.05 (U)."
