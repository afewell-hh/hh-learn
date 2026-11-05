#!/usr/bin/env bash
# End-state assertions. Exit 0 only if every enabled check passes. Read-only.
# Usage: verify.sh [--no-wait]      (reads /etc/hotlab/bootstrap.env like bootstrap.sh)
# Default: waits, bounded, for ops services and VLAB readiness (HOTLAB_READY_TIMEOUT s,
# default 1800). --no-wait = single-shot snapshot.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "${HERE}/lib/common.sh"
load_config
WAIT=1; [[ "${1:-}" == "--no-wait" ]] && WAIT=0
[[ "$(id -u)" -eq 0 ]] || die "run as root (reads /proc and runs probes as the service user)"

fails=0
report() { # report NAME RC
  if [[ "$2" -eq 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1"; fails=$((fails + 1)); fi
}
check() { # check NAME CMD...
  local name="$1"; shift
  "$@" >/dev/null 2>&1; report "${name}" $?
}
# check_wait NAME TIMEOUT CMD... — bounded retry (no retry when --no-wait).
check_wait() {
  local name="$1" t="$2"; shift 2
  [[ "${WAIT}" -eq 1 ]] || t=0
  local deadline=$((SECONDS + t))
  while ! "$@" >/dev/null 2>&1; do
    if [[ "${SECONDS}" -ge "${deadline}" ]]; then report "${name}" 1; return; fi
    sleep 5
  done
  report "${name}" 0
}
http_ok() { curl -fsS --max-time 10 -o /dev/null "$1"; }

check "docker daemon healthy"       docker info
check "k3d binary present"          test -x /usr/local/bin/k3d
check "no desktop stack (xrdp)"     bash -c '! dpkg -s xrdp >/dev/null 2>&1'
check "no usable password for ubuntu" bash -c '[[ "$(passwd -S ubuntu 2>/dev/null | awk "{print \$2}")" != "P" ]]'

if [[ "${HOTLAB_ENABLE_OPS}" == "1" ]]; then
  export KUBECONFIG="${HOTLAB_STATE_DIR}/kubeconfig"
  check_wait "k3d cluster running" 120 bash -c "k3d cluster list -o json | jq -e --arg n '${HOTLAB_K3D_CLUSTER}' 'any(.[]; .name==\$n and .serversRunning>=1)'"
  check_wait "k8s node Ready" 120 bash -c "kubectl get nodes --no-headers | grep -q ' Ready'"
  for ns in monitoring argocd gitea; do
    # Every non-completed pod Running AND every container ready (a "1/2 Running" pod fails).
    check_wait "all pods ready in ${ns}" 300 bash -c "kubectl -n ${ns} get pods -o json | jq -e '([.items[] | select(.status.phase!=\"Succeeded\") | select(.status.phase!=\"Running\" or (([.status.containerStatuses[]?.ready] | all) | not))] | length) == 0 and (.items | length) > 0'"
  done
  b="${HOTLAB_BIND_ADDRESS/0.0.0.0/127.0.0.1}"
  check_wait "prometheus :9090 answers" 120 http_ok "http://${b}:9090/-/ready"
  check_wait "grafana :3000 answers"    120 http_ok "http://${b}:3000/api/health"
  check_wait "argocd :8080 answers"     120 http_ok "http://${b}:8080/healthz"
  check_wait "gitea :3001 answers"      120 http_ok "http://${b}:3001/api/healthz"
fi

# ---- VLAB ---------------------------------------------------------------------
# kvm_usable_as_service: the service identity (not root) can open /dev/kvm rw AND qemu can
# initialise the KVM accelerator as that identity. exit 124 from timeout == qemu started
# and is paused (-S), i.e. accel init succeeded; immediate non-zero == KVM unusable.
kvm_usable_as_service() {
  [[ -c /dev/kvm ]] || return 1
  run_as_vlab bash -c 'exec 3<>/dev/kvm' || return 1
  local rc
  timeout 8 runuser -u "${HOTLAB_VLAB_USER}" -- qemu-system-x86_64 -accel kvm -machine none \
    -display none -nodefaults -no-user-config -S -monitor none -serial none </dev/null >/dev/null 2>&1
  rc=$?
  [[ "${rc}" -eq 124 ]]
}

# Count lab QEMUs by role (VM name prefix). Sets N_SWITCH N_CONTROL N_SERVER N_OTHER.
count_roles() {
  N_SWITCH=0; N_CONTROL=0; N_SERVER=0; N_OTHER=0
  local pid name
  for pid in $(hotlab_qemu_pids); do
    name="$(qemu_vm_name "${pid}")"
    case "${name}" in
      switch*) N_SWITCH=$((N_SWITCH + 1)) ;;
      control*) N_CONTROL=$((N_CONTROL + 1)) ;;
      server*) N_SERVER=$((N_SERVER + 1)) ;;
      *) N_OTHER=$((N_OTHER + 1)) ;;
    esac
  done
}

# One readiness evaluation. Prints the first unmet condition to stdout; returns 0 if ready.
# Returns 2 when the condition is terminal (unit failed), so the wait loop stops early.
vlab_ready_once() {
  local st="${HOTLAB_VLAB_DIR}/.hotlab"
  if systemctl is-failed --quiet hotlab-vlab.service; then echo "unit hotlab-vlab.service is in failed state"; return 2; fi
  systemctl is-active --quiet hotlab-vlab.service || { echo "unit not active"; return 1; }
  [[ -e "${st}/init.done" ]] || { echo "hhfab init not complete"; return 1; }
  [[ -e "${st}/gen.done" ]] || { echo "hhfab vlab gen not complete"; return 1; }
  count_roles
  [[ "${N_SWITCH}" -eq "${HOTLAB_EXPECT_SWITCHES}" && "${N_CONTROL}" -eq "${HOTLAB_EXPECT_CONTROLS}" && "${N_SERVER}" -eq "${HOTLAB_EXPECT_SERVERS}" ]] \
    || { echo "topology: switches ${N_SWITCH}/${HOTLAB_EXPECT_SWITCHES} controls ${N_CONTROL}/${HOTLAB_EXPECT_CONTROLS} servers ${N_SERVER}/${HOTLAB_EXPECT_SERVERS} (other ${N_OTHER})"; return 1; }
  # Switch/control health: operator-supplied probe, run as the service identity in the VLAB dir.
  # Must exit 0 only when switches/control are actually healthy (e.g. fabric agents registered).
  timeout 180 run_as_vlab bash -c "cd '${HOTLAB_VLAB_DIR}' && ${HOTLAB_VLAB_HEALTH_CMD}" >/dev/null 2>&1 \
    || { echo "HOTLAB_VLAB_HEALTH_CMD failed"; return 1; }
  return 0
}

if [[ "${HOTLAB_ENABLE_VLAB}" == "1" ]]; then
  require_vlab_expectations
  check "usable KVM as ${HOTLAB_VLAB_USER}" kvm_usable_as_service
  check "hotlab-vlab.service enabled (resume on boot)" systemctl is-enabled --quiet hotlab-vlab.service

  deadline=$((SECONDS + HOTLAB_READY_TIMEOUT)); [[ "${WAIT}" -eq 1 ]] || deadline=${SECONDS}
  restarts0=""; reason=""; ready=1
  while :; do
    reason="$(vlab_ready_once)"; rc=$?
    if [[ "${rc}" -eq 0 ]]; then
      # Stability window: ready now AND still ready, with no unit restart, after HOTLAB_READY_STABLE s.
      restarts0="$(systemctl show -p NRestarts --value hotlab-vlab.service)"
      [[ "${WAIT}" -eq 1 ]] && sleep "${HOTLAB_READY_STABLE}"
      reason="$(vlab_ready_once)"; rc=$?
      if [[ "${rc}" -eq 0 && "$(systemctl show -p NRestarts --value hotlab-vlab.service)" == "${restarts0}" ]]; then ready=0; break; fi
      reason="${reason:-unit restarted during stability window}"
    fi
    [[ "${rc}" -eq 2 ]] && break
    [[ "${SECONDS}" -ge "${deadline}" ]] && break
    sleep 10
  done
  if [[ "${ready}" -eq 0 ]]; then
    report "VLAB ready (init+gen done, topology ${HOTLAB_EXPECT_SWITCHES}sw/${HOTLAB_EXPECT_CONTROLS}ctl/${HOTLAB_EXPECT_SERVERS}srv, health probe ok, stable ${HOTLAB_READY_STABLE}s)" 0
  else
    report "VLAB ready: ${reason:-timeout after ${HOTLAB_READY_TIMEOUT}s}" 1
  fi
fi

echo "---"
if [[ "${fails}" -eq 0 ]]; then echo "verify: ALL PASS"; else echo "verify: ${fails} FAILED"; exit 1; fi
