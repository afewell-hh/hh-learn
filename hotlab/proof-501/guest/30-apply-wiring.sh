#!/usr/bin/env bash
# Stage 3 (guest, as hotlab): load the wiring diagram (PR #509) and run the FIRST gating
# question: does fabric/fabricator accept a Server with Connections into multiple Fabrics?
#
# If hhfab validate/build rejects it, this script records the exact error, runs
# locate-error.sh to find file:line in the supplied source checkouts, writes verdict
# REJECTED and STOPS (exit 3). It never edits, patches or forks fabric/fabricator and
# never rewrites the diagram to dodge the error. That is a separate customer decision.
# Usage: bash 30-apply-wiring.sh /path/to/proof.env
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: 30-apply-wiring.sh proof.env}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VLAB_DIR="${PROOF_DIR}/multifabric"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"

: "${WIRING_SRC:?set WIRING_SRC to the lab-wiring/ai-factory-26.05 checkout}"
[[ -d "${WIRING_SRC}" ]] || die "WIRING_SRC not a directory: ${WIRING_SRC}"

vlab_stop   # only one VLAB fits in RAM
rm -rf "${VLAB_DIR}"; mkdir -p "${VLAB_DIR}"
cp -r "${WIRING_SRC}" "${VLAB_DIR}/wiring-input"
cap wiring-files find "${VLAB_DIR}/wiring-input" -type f -exec sha256sum {} +
rec wiring-input 3-wiring OBSERVED host "copied wiring diagram; file digests in raw/wiring-files.txt (record the PR #509 commit in the report)" raw/wiring-files.txt

cd "${VLAB_DIR}"
# U: how a wiring diagram is fed to `hhfab init` in 26.05. HHFAB_WIRING_FLAG is configurable;
# the captured `hhfab init --help` shows the truth.
# shellcheck disable=SC2086
if ! cap wiring-init "${HHFAB}" init ${HHFAB_INIT_ARGS} ${HHFAB_WIRING_FLAG} "${VLAB_DIR}/wiring-input"; then
  rec wiring-init 3-wiring REJECTED control-plane "hhfab init failed with the wiring diagram" raw/wiring-init.txt
  bash "${HERE}/locate-error.sh" "${1}" wiring-init || true
  exit 3
fi
rec wiring-init 3-wiring PASS host "hhfab init accepted the wiring input (syntax level only)" raw/wiring-init.txt

if ! cap wiring-validate "${HHFAB}" validate; then
  rec wiring-validate 3-wiring REJECTED control-plane "hhfab validate REJECTED the multi-fabric wiring; exact error in raw/wiring-validate.txt" raw/wiring-validate.txt
  bash "${HERE}/locate-error.sh" "${1}" wiring-validate || true
  echo "STOP: multi-fabric wiring rejected. This is a valid result. Report raw/wiring-validate.txt and raw/locate-wiring-validate.txt." >&2
  exit 3
fi
rec wiring-validate 3-wiring PASS control-plane "hhfab validate accepted the wiring (static validation only; says nothing about runtime behaviour)" raw/wiring-validate.txt

# shellcheck disable=SC2086
vlab_start "${VLAB_DIR}" ${HHFAB_UP_ARGS}
rec multifabric-start 3-wiring OBSERVED host "hhfab vlab up started in tmux 'vlab' (log ${PROOF_OUT}/vlab-up.log)"

# A failure here (build/up) is also a legitimate rejection: capture and stop, do not retry with edits.
if ! wait_for "${CONVERGE_TIMEOUT_S:-900}" 15 kctl get agents -A; then
  cap vlab-up-tail tail -n 200 "${PROOF_OUT}/vlab-up.log" || true
  rec multifabric-up 3-wiring FAIL control-plane "control node/agents not reachable in ${CONVERGE_TIMEOUT_S:-900}s. If vlab-up.log shows a build/validation error it is a rejection: run locate-error.sh and stop." raw/vlab-up-tail.txt
  bash "${HERE}/locate-error.sh" "${1}" vlab-up-tail || true
  exit 3
fi
rec multifabric-up 3-wiring PASS control-plane "control node reachable; Agent objects listed"
echo "Wiring accepted and VLAB started. Next: bash 40-checks.sh ${1} all"
