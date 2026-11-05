#!/usr/bin/env bash
# Hot Lab portable bootstrap. Entry contract: root on a fresh Ubuntu 24.04 amd64
# VM with network egress and /etc/hotlab/bootstrap.env supplied by the provision
# layer. Idempotent: every stage converges; a second run changes nothing.
# No provider CLI, no metadata server, no provider SDK. Enforced by check-portability.sh.
#
# Usage: bootstrap.sh [--skip-verify]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "${HERE}/lib/common.sh"
# shellcheck source=lib/pins.sh
. "${HERE}/lib/pins.sh"

require_root
load_config
export DEBIAN_FRONTEND=noninteractive

# ALL contract validation happens here, before any package install, download, account
# creation, sudoers change, or state directory. Side-effect free (see lib/common.sh).
preflight_contract "${HERE}"

# Serialise concurrent runs (cloud-init + operator).
mkdir -p "${HOTLAB_STATE_DIR}"
exec 9>"${HOTLAB_STATE_DIR}/.bootstrap.lock"
flock -n 9 || die "another bootstrap run holds the lock"

stage_packages() {
  log "stage: packages"
  apt-get update -qq
  # Headless set only. Dropped vs labapp: xrdp xfce4 firefox code nodejs net-tools
  # tcpdump/iftop/traceroute and friends (kept lean; add via HOTLAB_EXTRA_PACKAGES if wanted).
  apt-get install -y -qq --no-install-recommends \
    ca-certificates curl git jq tar gzip unzip gettext-base util-linux \
    qemu-kvm socat tmux htop iotop rsync openssh-server sudo
}

stage_docker() {
  log "stage: docker"
  # Deviation from labapp: labapp pipes get.docker.com to sh (unpinned, re-runs reinstall).
  # Ubuntu's docker.io is used: apt-managed, idempotent, optionally version-pinned.
  if [[ -n "${HOTLAB_DOCKER_APT_VERSION}" ]]; then
    apt-get install -y -qq "docker.io=${HOTLAB_DOCKER_APT_VERSION}"
  else
    apt-get install -y -qq docker.io
  fi
  systemctl enable --now docker
}

stage_tools() {
  log "stage: pinned tools"
  local work; work="$(mktemp -d)"; trap 'rm -rf "${work}"' RETURN

  if ! have_binary_sha /usr/local/bin/kubectl "${KUBECTL_SHA256}"; then
    fetch_verified "${KUBECTL_URL}" "${KUBECTL_SHA256}" "${work}/kubectl"
    install_if_changed "${work}/kubectl" /usr/local/bin/kubectl
  fi
  if ! have_binary_sha /usr/local/bin/k3d "${K3D_SHA256}"; then
    fetch_verified "${K3D_URL}" "${K3D_SHA256}" "${work}/k3d"
    install_if_changed "${work}/k3d" /usr/local/bin/k3d
  fi
  if ! have_binary_sha /usr/local/bin/helm "${HELM_MEMBER_SHA256}"; then
    fetch_verified "${HELM_URL}" "${HELM_ARCHIVE_SHA256}" "${work}/helm.tgz"
    tar -xzOf "${work}/helm.tgz" "${HELM_MEMBER}" > "${work}/helm"
    [[ "$(file_sha256 "${work}/helm")" == "${HELM_MEMBER_SHA256}" ]] || die "helm member checksum mismatch"
    install_if_changed "${work}/helm" /usr/local/bin/helm
  fi
  case "${HOTLAB_HHFAB_VERSION}" in   # version already validated by preflight
    0.43.1)
      if ! have_binary_sha /usr/local/bin/hhfab "${HHFAB_0_43_1_MEMBER_SHA256}"; then
        fetch_verified "${HHFAB_0_43_1_URL}" "${HHFAB_0_43_1_ARCHIVE_SHA256}" "${work}/hhfab.tgz"
        tar -xzOf "${work}/hhfab.tgz" "${HHFAB_MEMBER}" > "${work}/hhfab"
        [[ "$(file_sha256 "${work}/hhfab")" == "${HHFAB_0_43_1_MEMBER_SHA256}" ]] || die "hhfab member checksum mismatch"
        install_if_changed "${work}/hhfab" /usr/local/bin/hhfab
      fi ;;
    *) die "hhfab ${HOTLAB_HHFAB_VERSION} has no pin in lib/pins.sh (only 0.43.1)" ;;
  esac
}

stage_user() {
  log "stage: service account"
  # Non-login service account: no password, no auto-login, no RDP. labapp's static
  # 'ubuntu' password is intentionally not carried over.
  if ! id "${HOTLAB_VLAB_USER}" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "${HOTLAB_STATE_DIR}/home" --shell /usr/sbin/nologin "${HOTLAB_VLAB_USER}"
  fi
  usermod -aG kvm,docker "${HOTLAB_VLAB_USER}"
  install -d -o "${HOTLAB_VLAB_USER}" -g "${HOTLAB_VLAB_USER}" -m 0750 "${HOTLAB_VLAB_DIR}"
  install -d -o root -g root -m 0700 "${HOTLAB_STATE_DIR}/secrets"
  # hhfab shells out to sudo for TAP devices (labapp bug #21 note). Scoped to the
  # service account only. OPEN ITEM: narrow to the observed command set.
  printf '%s ALL=(root) NOPASSWD: ALL\n' "${HOTLAB_VLAB_USER}" > /etc/sudoers.d/hotlab-vlab
  chmod 0440 /etc/sudoers.d/hotlab-vlab
  visudo -cf /etc/sudoers.d/hotlab-vlab >/dev/null || die "sudoers fragment invalid"
}

# Generate a secret once; never regenerate (idempotent), never log.
secret() {
  local f="${HOTLAB_STATE_DIR}/secrets/$1"
  if [[ ! -s "${f}" ]]; then
    (umask 077; head -c 24 /dev/urandom | base64 | tr -d '/+=\n' > "${f}")
  fi
  cat "${f}"
}

# Write a 0600 helm values file holding one secret. Secrets never go on a command line
# (visible in /proc/*/cmdline and `ps`). The secret is read into a variable first and
# validated, because a failed `$(secret ...)` inside an argument is NOT caught by set -e and
# would silently pass an EMPTY admin password to helm (this was bootstrap.sh:153 before).
secret_values_file() { # secret_values_file SECRET_NAME OUTFILE YAML_TEMPLATE_WITH_%s
  local pw; pw="$(secret "$1")" || die "could not generate secret $1"
  [[ "${pw}" =~ ^[A-Za-z0-9]{20,}$ ]] || die "secret $1 is empty or malformed"
  (umask 077; printf "$3" "${pw}" > "$2")
}

stage_ops() {
  [[ "${HOTLAB_ENABLE_OPS}" == "1" ]] || { log "stage: ops (disabled)"; return 0; }
  log "stage: ops cluster + stack"

  install -d -m 0755 "${HOTLAB_STATE_DIR}/management-storage"
  export HOTLAB_MGMT_IMAGE HOTLAB_BIND_ADDRESS HOTLAB_STATE_DIR HOTLAB_K3D_CLUSTER
  local cfg="${HOTLAB_STATE_DIR}/management-cluster.rendered.yaml"
  envsubst '${HOTLAB_MGMT_IMAGE} ${HOTLAB_BIND_ADDRESS} ${HOTLAB_STATE_DIR} ${HOTLAB_K3D_CLUSTER}' \
    < "${HERE}/ops/management-cluster.yaml" > "${cfg}"

  if k3d cluster list -o json | jq -e --arg n "${HOTLAB_K3D_CLUSTER}" 'any(.[]; .name==$n)' >/dev/null; then
    log "k3d cluster ${HOTLAB_K3D_CLUSTER} exists; starting if stopped (never recreated)"
    k3d cluster start "${HOTLAB_K3D_CLUSTER}" >/dev/null
  else
    k3d cluster create --config "${cfg}"
  fi

  export KUBECONFIG="${HOTLAB_STATE_DIR}/kubeconfig"
  (umask 077; k3d kubeconfig get "${HOTLAB_K3D_CLUSTER}" > "${KUBECONFIG}")
  kubectl wait --for=condition=Ready node --all --timeout=300s

  helm repo add prometheus-community "${KPS_REPO}" --force-update >/dev/null
  helm repo add argo "${ARGOCD_REPO}" --force-update >/dev/null
  helm repo add gitea-charts "${GITEA_REPO}" --force-update >/dev/null
  helm repo update >/dev/null

  local sv="${HOTLAB_STATE_DIR}/secrets"
  secret_values_file grafana-admin "${sv}/grafana.values.yaml" 'grafana:\n  adminPassword: "%s"\n'
  secret_values_file gitea-admin "${sv}/gitea.values.yaml" 'gitea:\n  admin:\n    password: "%s"\n'

  helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
    --version "${KPS_CHART_VERSION}" --namespace monitoring --create-namespace \
    -f "${HERE}/ops/observability-values.yaml" -f "${sv}/grafana.values.yaml" --wait --timeout 10m

  helm upgrade --install argocd argo/argo-cd \
    --version "${HOTLAB_ARGOCD_CHART_VERSION}" --namespace argocd --create-namespace \
    -f "${HERE}/ops/argocd-values.yaml" --wait --timeout 10m

  helm upgrade --install gitea gitea-charts/gitea \
    --version "${HOTLAB_GITEA_CHART_VERSION}" --namespace gitea --create-namespace \
    -f "${HERE}/ops/gitea-values.yaml" -f "${sv}/gitea.values.yaml" --wait --timeout 10m
}

stage_vlab() {
  [[ "${HOTLAB_ENABLE_VLAB}" == "1" ]] || { log "stage: vlab (disabled)"; return 0; }
  log "stage: vlab unit"
  install -d -m 0755 /usr/local/lib/hotlab
  install -m 0755 "${HERE}/vlab/vlab-run.sh" /usr/local/lib/hotlab/vlab-run.sh
  install -m 0644 "${HERE}/vlab/hotlab-vlab.service" /etc/systemd/system/hotlab-vlab.service
  install -m 0644 "${HERE}/vlab/journald@hotlab-vlab.conf" /etc/systemd/journald@hotlab-vlab.conf
  # Drop-in carries the contract values so the unit never reads the secrets-bearing env file.
  install -d -m 0755 /etc/systemd/system/hotlab-vlab.service.d
  cat > /etc/systemd/system/hotlab-vlab.service.d/10-contract.conf <<EOF
[Service]
User=${HOTLAB_VLAB_USER}
Group=${HOTLAB_VLAB_USER}
WorkingDirectory=${HOTLAB_VLAB_DIR}
Environment=HOTLAB_VLAB_DIR=${HOTLAB_VLAB_DIR}
Environment="HOTLAB_HHFAB_INIT_ARGS=${HOTLAB_HHFAB_INIT_ARGS}"
Environment="HOTLAB_VLAB_GEN_ARGS=${HOTLAB_VLAB_GEN_ARGS}"
Environment="HOTLAB_VLAB_UP_ARGS=${HOTLAB_VLAB_UP_ARGS}"
EOF
  systemctl daemon-reload
  systemctl restart systemd-journald@hotlab-vlab.service 2>/dev/null || true
  # enable = resume on every boot. start is a no-op if already running (idempotent).
  systemctl enable hotlab-vlab.service
  # Async start is fine ONLY because verify.sh (run below) does bounded readiness waiting.
  # If the unit is already running, changed drop-in values apply at the next restart; we
  # deliberately do not restart a running lab (that would interrupt VMs).
  systemctl start --no-block hotlab-vlab.service
}

stage_packages
stage_docker
stage_tools
stage_user
stage_ops
stage_vlab

log "bootstrap converged"
if [[ "${1:-}" != "--skip-verify" ]]; then
  exec bash "${HERE}/verify.sh"
fi
