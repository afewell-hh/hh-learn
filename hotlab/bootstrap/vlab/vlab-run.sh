#!/usr/bin/env bash
# Runs as the unit's service account. First start: init + gen. Later starts (reboot):
# state already exists, so only `vlab up` runs and resumes it.
# U: hhfab 0.43.1 flag sets come from HOTLAB_* inputs and are not verified here.
set -euo pipefail
cd "${HOTLAB_VLAB_DIR:?}"

if [[ ! -f fab.yaml ]]; then
  echo "vlab-run: first start, running hhfab init"
  # shellcheck disable=SC2086
  hhfab init ${HOTLAB_HHFAB_INIT_ARGS:-}
  # shellcheck disable=SC2086
  hhfab vlab gen ${HOTLAB_VLAB_GEN_ARGS:-}
else
  echo "vlab-run: existing state found, resuming"
fi

# shellcheck disable=SC2086
exec hhfab vlab up ${HOTLAB_VLAB_UP_ARGS:-}
