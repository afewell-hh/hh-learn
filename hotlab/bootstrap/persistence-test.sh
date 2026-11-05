#!/usr/bin/env bash
# Operator runtime test: do VLAB switches resume their INSTALLED NOS after a restart, or
# does every restart re-run the ONIE install?  (Issue #510 review finding 4.)
#
# Static reading of hhfab cannot settle this, so this test does. Evidence tags:
#   S/D  hhfab `vlab up` reuses a VM dir when os.img (+ EFI files for ONIE switches) exist and
#        has no backing file / recreate on restart unless --recreate (-f) is passed. Read from
#        githedgehog/fabricator master pkg/hhfab/vlabrunner.go by summary, NOT from the pinned
#        v0.43.1 tag. => disk reuse is expected (U for 0.43.1), but "disk reused" does not by
#        itself prove "booted straight into the NOS" (that depends on the EFI vars/boot order
#        persisted with the VM). Only the NOS probe below proves it.
#
# Usage (as root, on a converged host, after verify.sh passed):
#   bash persistence-test.sh before
#   systemctl restart hotlab-vlab        # run 1: service restart.  Then run 2: reboot the VM.
#   bash persistence-test.sh after       # waits (bounded) for readiness, then asserts
# Needs HOTLAB_SWITCH_NOS_CMD in the env file: a command, run as the service user in the VLAB
# dir, invoked as `CMD <switch-vm-name>`, that exits 0 ONLY IF that switch is running its
# installed NOS (not ONIE). Operator supplies it from `hhfab vlab ssh --help` for 0.43.1.
# Pass criteria (all must hold for every switch):
#   1. os.img and EFI-vars files have the same inode and birth time as before (not recreated)
#   2. HOTLAB_SWITCH_NOS_CMD exits 0 within HOTLAB_PERSIST_NOS_TIMEOUT (default 600s) AFTER the
#      restart, i.e. the installed NOS came back without a reinstall that outlasts that bound
#   3. verify.sh passes
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "${HERE}/lib/common.sh"
require_root
load_config
require_vlab_expectations
require_input HOTLAB_SWITCH_NOS_CMD
mode="${1:?usage: persistence-test.sh before|after}"
snap="${HOTLAB_STATE_DIR}/persistence-snapshot.tsv"
timeout_s="${HOTLAB_PERSIST_NOS_TIMEOUT:-600}"

# Identity of every per-VM disk/EFI file: path, inode, birth time, (size is informational).
take_snapshot() {
  find "${HOTLAB_VLAB_DIR}/vlab" -type f \( -name 'os.img' -o -name '*efi*' -o -name '*vars*' \) \
    -printf '%p\t%i\t%B@\t%s\n' | sort
}
switch_names() {
  local pid n
  for pid in $(hotlab_qemu_pids); do n="$(qemu_vm_name "${pid}")"; [[ "${n}" == switch* ]] && echo "${n}"; done | sort -u
}

case "${mode}" in
  before)
    [[ "$(switch_names | wc -l)" -eq "${HOTLAB_EXPECT_SWITCHES}" ]] || die "expected ${HOTLAB_EXPECT_SWITCHES} running switches; run verify.sh first"
    for s in $(switch_names); do
      timeout 120 run_as_vlab bash -c "cd '${HOTLAB_VLAB_DIR}' && ${HOTLAB_SWITCH_NOS_CMD} ${s}" >/dev/null 2>&1 \
        || die "precondition: ${s} is not running its installed NOS yet (nothing to preserve)"
    done
    take_snapshot > "${snap}"
    [[ -s "${snap}" ]] || die "no VM disk files found under ${HOTLAB_VLAB_DIR}/vlab"
    log "snapshot of $(wc -l < "${snap}") files written to ${snap}. Now restart the service (and later, reboot), then run: persistence-test.sh after"
    ;;
  after)
    [[ -s "${snap}" ]] || die "no snapshot; run 'before' first"
    fail=0
    # 1. identity unchanged
    if diff <(cut -f1-3 "${snap}") <(take_snapshot | cut -f1-3) >/dev/null; then
      echo "PASS  VM disk + EFI files not recreated (same path, inode, birth time)"
    else
      echo "FAIL  VM disk/EFI files changed identity:"; diff <(cut -f1-3 "${snap}") <(take_snapshot | cut -f1-3) || true; fail=1
    fi
    # readiness (bounded) then NOS probe per switch
    bash "${HERE}/verify.sh" || fail=1
    for s in $(switch_names); do
      deadline=$((SECONDS + timeout_s)); ok=1
      until timeout 120 run_as_vlab bash -c "cd '${HOTLAB_VLAB_DIR}' && ${HOTLAB_SWITCH_NOS_CMD} ${s}" >/dev/null 2>&1; do
        [[ "${SECONDS}" -lt "${deadline}" ]] || { ok=0; break; }; sleep 10
      done
      if [[ "${ok}" -eq 1 ]]; then echo "PASS  ${s} resumed installed NOS"; else echo "FAIL  ${s} did not reach installed NOS within ${timeout_s}s (reinstalling from ONIE?)"; fail=1; fi
    done
    [[ "${fail}" -eq 0 ]] && echo "persistence-test: PASS" || { echo "persistence-test: FAIL" >&2; exit 1; }
    ;;
  *) die "usage: persistence-test.sh before|after" ;;
esac
