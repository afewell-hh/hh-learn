#!/usr/bin/env bash
# Stage 0 (guest): verify /dev/kvm and nested-virt prerequisites BEFORE anything else.
# Read-only. Writes evidence; exits non-zero if KVM is unusable.
# Usage: bash 00-preflight.sh /path/to/proof.env
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: 00-preflight.sh proof.env}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"

fail=0

if [[ -c /dev/kvm ]]; then
  rec kvm-device 0-preflight PASS host "/dev/kvm is a character device"
else
  rec kvm-device 0-preflight FAIL host "/dev/kvm missing: nested virtualization not exposed to this guest"
  fail=1
fi

cap kvm-cpu-flags grep -m1 -oE 'vmx|svm' /proc/cpuinfo || true
if grep -qx 'vmx' "${RAW_DIR}/kvm-cpu-flags.txt"; then
  rec kvm-cpu-vmx 0-preflight PASS host "vmx flag present (Intel VT-x visible to the guest)" "raw/kvm-cpu-flags.txt"
else
  rec kvm-cpu-vmx 0-preflight FAIL host "no vmx flag; nested virt needs an Intel N1/N2/C2 type or N4D" "raw/kvm-cpu-flags.txt"
  fail=1
fi

cap kvm-intel-nested cat /sys/module/kvm_intel/parameters/nested || true
rec kvm-intel-nested 0-preflight OBSERVED host "kvm_intel nested parameter: $(sed -n '2p' "${RAW_DIR}/kvm-intel-nested.txt" | tr -d '\n' || true)" "raw/kvm-intel-nested.txt"

# Identity of the host, recorded so the report can state what actually ran.
cap host-lscpu lscpu || true
cap host-mem free -m || true
cap host-disk df -h / "${PROOF_DIR:-/}" || true
cap host-dmi sh -c 'cat /sys/devices/virtual/dmi/id/product_name /sys/devices/virtual/dmi/id/sys_vendor 2>/dev/null' || true
rec host-shape 0-preflight OBSERVED host "recorded lscpu/free/df/dmi (see raw/host-*.txt)" "raw/host-lscpu.txt"

# Prove QEMU can actually start a KVM guest with the machine flags VLAB uses
# (q35, accel=kvm, smm=on, -cpu host). This is what fails if the machine type is wrong.
if command -v qemu-system-x86_64 >/dev/null; then
  if cap qemu-kvm-smoke timeout 20 qemu-system-x86_64 -machine q35,accel=kvm,smm=on -cpu host \
       -m 128 -display none -nodefaults -S -monitor none -serial none -qmp stdio </dev/null; then
    :
  fi
  # -S -qmp stdio with /dev/null stdin exits immediately; success of init (no 'kvm' error) is what matters.
  if grep -qiE "could not access KVM|failed to initialize kvm|Invalid accelerator" "${RAW_DIR}/qemu-kvm-smoke.txt"; then
    rec qemu-kvm-smoke 0-preflight FAIL host "QEMU could not start with accel=kvm -cpu host" "raw/qemu-kvm-smoke.txt"
    fail=1
  else
    rec qemu-kvm-smoke 0-preflight PASS host "QEMU started with -machine q35,accel=kvm,smm=on -cpu host (no KVM init error)" "raw/qemu-kvm-smoke.txt"
  fi
else
  rec qemu-kvm-smoke 0-preflight SKIPPED host "qemu-system-x86_64 not installed yet (bootstrap installs qemu-kvm)"
fi

# Tooling the later stages need.
for t in jq tmux docker sudo; do
  if command -v "$t" >/dev/null; then :; else rec "tool-$t" 0-preflight FAIL host "$t not installed (run hotlab/bootstrap first)"; fail=1; fi
done

if command -v hhfab >/dev/null; then
  cap preflight-hhfab-version hhfab version || true
  cap preflight-ssh-help hhfab vlab ssh --help || true
  cap preflight-init-help hhfab init --help || true
  cap preflight-gen-help hhfab vlab gen --help || true
  cap preflight-up-help hhfab vlab up --help || true
  rec hhfab-cli 0-preflight OBSERVED host "captured hhfab version and --help for init/vlab gen/vlab up/vlab ssh; compare with proof.env flags (all U)" "raw/preflight-hhfab-version.txt"
fi

exit "$fail"
