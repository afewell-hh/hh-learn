#!/usr/bin/env bash
# Stage 2 (guest, as the hotlab user): baseline single-fabric VLAB. Needs no wiring
# diagram, so it can run before PR #509 lands. Proves KVM + 26.05 + hhfab work at all.
# Usage: bash 20-baseline.sh /path/to/proof.env [--stop]
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: 20-baseline.sh proof.env [--stop]}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VLAB_DIR="${PROOF_DIR}/baseline"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"

if [[ "${2:-}" == "--stop" ]]; then vlab_stop; rec baseline-stop 2-baseline OBSERVED host "baseline VLAB stopped"; exit 0; fi

mkdir -p "${VLAB_DIR}"
cd "${VLAB_DIR}"
if [[ ! -f fab.yaml ]]; then
  # shellcheck disable=SC2086
  cap baseline-init "${HHFAB}" init ${HHFAB_INIT_ARGS} || { rec baseline-init 2-baseline FAIL host "hhfab init failed" raw/baseline-init.txt; exit 1; }
  # shellcheck disable=SC2086
  cap baseline-gen "${HHFAB}" vlab gen ${HHFAB_BASELINE_GEN_ARGS} || { rec baseline-gen 2-baseline FAIL host "hhfab vlab gen failed" raw/baseline-gen.txt; exit 1; }
fi
cap baseline-validate "${HHFAB}" validate || { rec baseline-validate 2-baseline FAIL control-plane "hhfab validate rejected the default topology" raw/baseline-validate.txt; exit 1; }

# shellcheck disable=SC2086
vlab_start "${VLAB_DIR}" ${HHFAB_UP_ARGS}
rec baseline-start 2-baseline OBSERVED host "hhfab vlab up started in tmux session 'vlab' (log: ${PROOF_OUT}/vlab-up.log)"

# Ready = control node answers and at least one Agent object exists. Convergence is
# judged by 40-checks.sh with the same rules as the multi-fabric run.
if wait_for "${CONVERGE_TIMEOUT_S:-900}" 15 kctl get agents -A; then
  cap baseline-agents kctl get agents -A -o wide || true
  rec baseline-up 2-baseline PASS control-plane "control node reachable and Agent objects listed (not yet judged converged)" raw/baseline-agents.txt
else
  rec baseline-up 2-baseline FAIL control-plane "control node/agents not reachable within ${CONVERGE_TIMEOUT_S:-900}s; see ${PROOF_OUT}/vlab-up.log"
  exit 1
fi
echo "Baseline up. Next: bash 40-checks.sh ${1} converge   (reuses the same convergence rule), then --stop before the multi-fabric run."
