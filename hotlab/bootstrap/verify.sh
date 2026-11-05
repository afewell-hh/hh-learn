#!/usr/bin/env bash
# End-state assertions. Exit 0 only if every enabled check passes. Read-only.
# Usage: verify.sh   (reads /etc/hotlab/bootstrap.env like bootstrap.sh)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "${HERE}/lib/common.sh"
load_config

fails=0
check() { # check NAME CMD...
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "PASS  ${name}"; else echo "FAIL  ${name}"; fails=$((fails + 1)); fi
}
http_ok() { curl -fsS --max-time 10 -o /dev/null "$1"; }

check "/dev/kvm present"            test -c /dev/kvm
check "docker daemon healthy"       docker info
check "k3d binary present"          test -x /usr/local/bin/k3d
check "no desktop stack (xrdp)"     bash -c '! dpkg -s xrdp >/dev/null 2>&1'
check "no static password for ubuntu" bash -c '[[ "$(passwd -S ubuntu 2>/dev/null | awk "{print \$2}")" != "P" ]]'

if [[ "${HOTLAB_ENABLE_OPS}" == "1" ]]; then
  export KUBECONFIG="${HOTLAB_STATE_DIR}/kubeconfig"
  check "k3d cluster running"       bash -c "k3d cluster list -o json | jq -e --arg n '${HOTLAB_K3D_CLUSTER}' 'any(.[]; .name==\$n and .serversRunning>=1)'"
  check "k8s node Ready"            bash -c "kubectl get nodes --no-headers | grep -q ' Ready'"
  for ns in monitoring argocd gitea; do
    check "pods ready in ${ns}"     bash -c "! kubectl -n ${ns} get pods --no-headers | grep -Ev 'Running|Completed' | grep -q ."
  done
  b="${HOTLAB_BIND_ADDRESS/0.0.0.0/127.0.0.1}"
  check "prometheus :9090 answers"  http_ok "http://${b}:9090/-/ready"
  check "grafana :3000 answers"     http_ok "http://${b}:3000/api/health"
  check "argocd :8080 answers"      http_ok "http://${b}:8080/healthz"
  check "gitea :3001 answers"       http_ok "http://${b}:3001/api/healthz"
fi

if [[ "${HOTLAB_ENABLE_VLAB}" == "1" ]]; then
  check "hotlab-vlab.service active" systemctl is-active --quiet hotlab-vlab.service
  check "hotlab-vlab.service enabled (resume on boot)" systemctl is-enabled --quiet hotlab-vlab.service
  if [[ "${HOTLAB_EXPECT_VMS}" -gt 0 ]]; then
    n="$(pgrep -fc 'qemu-system-x86_64' || true)"
    check "qemu VM count == ${HOTLAB_EXPECT_VMS} (found ${n})" test "${n}" -eq "${HOTLAB_EXPECT_VMS}"
  fi
  # NOTE: "VLAB converged" is approximated by unit-active + expected VM count. It does
  # not prove switch/agent readiness; extend with an hhfab-native readiness probe once
  # the operator confirms one for the pinned version (README open item).
fi

echo "---"
if [[ "${fails}" -eq 0 ]]; then echo "verify: ALL PASS"; else echo "verify: ${fails} FAILED"; exit 1; fi
