#!/usr/bin/env bash
# Runs as the unit's service account. Two independently tracked, output-verified stages
# (init, gen), then `hhfab vlab up`. Safe to re-enter after a failure at any point.
#
# Invariants:
#  - This script NEVER deletes or overwrites anything under vlab/ (VM disks).
#  - A stage is "done" only when its marker exists; markers are written after the stage's
#    command succeeded AND its output was checked. A crash mid-stage leaves no marker.
#  - Deterministic state problems exit 64; the unit has RestartPreventExitStatus=64 so
#    the restart loop does not spin on something only an operator can fix.
# U: hhfab 0.43.1 flag sets come from HOTLAB_* inputs and are not verified here.
set -euo pipefail

DIR="${HOTLAB_VLAB_DIR:?}"
cd "${DIR}"
STATE="${DIR}/.hotlab"
install -d -m 0700 "${STATE}" "${STATE}/quarantine"

fatal() { echo "vlab-run: FATAL: $*" >&2; exit 64; }
mark() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$2" > "${STATE}/$1.tmp"; mv -f "${STATE}/$1.tmp" "${STATE}/$1"; }

# One runner at a time; the lock fd is inherited by hhfab so it is held for the unit's life.
exec 8> "${STATE}/run.lock"
flock -n 8 || fatal "another vlab-run holds ${STATE}/run.lock"

# Defence in depth (preflight already rejects these): never recreate VMs.
for a in ${HOTLAB_VLAB_UP_ARGS:-}; do
  case "${a}" in -f|-f=*|--recreate|--recreate=*) fatal "refusing '${a}': it would recreate VM disks" ;; esac
done

have_vm_disks() { [[ -d "${DIR}/vlab" ]] && find "${DIR}/vlab" -name os.img -size +0 -print -quit 2>/dev/null | grep -q .; }

if have_vm_disks; then
  echo "vlab-run: existing VM disks (will be reused, never recreated):"
  find "${DIR}/vlab" -name 'os.img' -printf '  %p %s bytes inode=%i\n'
fi

# ---- stage 1: init -----------------------------------------------------------
if [[ ! -e "${STATE}/init.done" ]]; then
  if [[ -s fab.yaml ]] && have_vm_disks; then
    # VMs exist, so init demonstrably completed before (e.g. markers lost). Adopt; do not re-init.
    echo "vlab-run: fab.yaml and VM disks present without init marker; adopting"
    mark init.done "adopted"
  else
    if [[ -e fab.yaml ]]; then
      q="${STATE}/quarantine/fab.yaml.$(date -u +%Y%m%dT%H%M%SZ)"
      echo "vlab-run: partial init detected (fab.yaml without init marker, no VM disks); moving it to ${q}"
      mv -f fab.yaml "${q}"
    fi
    echo "vlab-run: hhfab init"
    # shellcheck disable=SC2086
    hhfab init ${HOTLAB_HHFAB_INIT_ARGS:-}
    [[ -s fab.yaml ]] || fatal "hhfab init exited 0 but fab.yaml is missing or empty"
    mark init.done "fab.yaml $(stat -c %s fab.yaml) bytes"
    rm -f "${STATE}/gen.done"        # a fresh init invalidates any earlier generation
  fi
fi

# ---- stage 2: generate wiring -------------------------------------------------
if [[ ! -e "${STATE}/gen.done" ]]; then
  if have_vm_disks; then
    # Regenerating could change topology underneath disks that were built for the old one.
    fatal "VM disks exist but generation is not recorded. Refusing to regenerate. If the existing wiring is correct: touch ${STATE}/gen.done. Otherwise remove vlab/ deliberately."
  fi
  echo "vlab-run: hhfab vlab gen"
  stamp="${STATE}/gen.stamp"; : > "${stamp}"
  # shellcheck disable=SC2086
  hhfab vlab gen ${HOTLAB_VLAB_GEN_ARGS:-}
  # Output check that does not assume a path: some non-empty file outside vlab/ and
  # .hotlab/ must be newer than the stamp (generation writes the wiring diagram).
  out="$(find "${DIR}" \( -path "${DIR}/vlab" -o -path "${STATE}" \) -prune -o -type f -size +0 -newer "${stamp}" -print -quit)"
  [[ -n "${out}" ]] || fatal "hhfab vlab gen exited 0 but wrote no new non-empty file"
  mark gen.done "${out}"
fi

echo "vlab-run: init=$(cat "${STATE}/init.done") gen=$(cat "${STATE}/gen.done")"
# shellcheck disable=SC2086
exec hhfab vlab up ${HOTLAB_VLAB_UP_ARGS:-}
