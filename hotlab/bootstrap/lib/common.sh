#!/usr/bin/env bash
# Shared helpers. Sourced, never executed. Provider-neutral: no cloud CLI, no
# metadata-server calls. Everything the guest needs comes from HOTLAB_ENV_FILE.

log() { echo "hotlab-bootstrap: $*"; }
warn() { echo "hotlab-bootstrap: WARN: $*" >&2; }
die() { echo "hotlab-bootstrap: ERROR: $*" >&2; exit 1; }

require_root() { [[ "$(id -u)" -eq 0 ]] || die "must run as root"; }

is_uint() { [[ "${1:-}" =~ ^[0-9]+$ ]]; }

# norm_bool VARNAME — accept 1/true/yes/on and 0/false/no/off (any case); anything else
# is a hard error. Rewrites VARNAME to canonical 1/0. (A silent "not 1 == off" is how
# HOTLAB_ENABLE_OPS=true used to disable ops without a word.)
norm_bool() {
  local _n="$1" _v="${!1:-}"
  case "${_v,,}" in
    1|true|yes|on) printf -v "${_n}" '%s' 1 ;;
    0|false|no|off) printf -v "${_n}" '%s' 0 ;;
    *) die "${_n}='${_v}' is not a boolean (use 1/0, true/false, yes/no, on/off)" ;;
  esac
}

# Load the operator-supplied contract file and apply defaults. Defaults here are for
# NON-security-relevant knobs only. There is deliberately no default for hhfab init
# arguments (credentials): see preflight_contract.
load_config() {
  HOTLAB_ENV_FILE="${HOTLAB_ENV_FILE:-/etc/hotlab/bootstrap.env}"
  [[ -r "${HOTLAB_ENV_FILE}" ]] || die "config file ${HOTLAB_ENV_FILE} not readable (see README: input contract)"
  # shellcheck disable=SC1090
  set -a; . "${HOTLAB_ENV_FILE}"; set +a

  : "${HOTLAB_STATE_DIR:=/var/lib/hotlab}"
  : "${HOTLAB_VLAB_USER:=hotlab}"
  : "${HOTLAB_VLAB_DIR:=${HOTLAB_STATE_DIR}/vlab}"
  : "${HOTLAB_BIND_ADDRESS:=127.0.0.1}"
  : "${HOTLAB_HHFAB_VERSION:=0.43.1}"
  : "${HOTLAB_HHFAB_INIT_ARGS:=}"           # NO default: operator must supply (fail closed)
  : "${HOTLAB_ALLOW_DEV_CREDENTIALS:=0}"    # explicit prototype-only opt-in for `--dev`
  : "${HOTLAB_VLAB_GEN_ARGS:=}"
  : "${HOTLAB_VLAB_UP_ARGS:=--kill-stale}"
  : "${HOTLAB_EXPECT_SWITCHES:=}"           # required when VLAB enabled
  : "${HOTLAB_EXPECT_CONTROLS:=}"
  : "${HOTLAB_EXPECT_SERVERS:=}"
  : "${HOTLAB_VLAB_HEALTH_CMD:=}"           # required when VLAB enabled
  : "${HOTLAB_SWITCH_NOS_CMD:=}"            # required only by persistence-test.sh
  : "${HOTLAB_READY_TIMEOUT:=1800}"
  : "${HOTLAB_READY_STABLE:=30}"
  : "${HOTLAB_ENABLE_VLAB:=1}"
  : "${HOTLAB_ENABLE_OPS:=1}"
  : "${HOTLAB_K3D_CLUSTER:=hotlab-mgmt}"
  : "${HOTLAB_DOCKER_APT_VERSION:=}"
  norm_bool HOTLAB_ENABLE_VLAB
  norm_bool HOTLAB_ENABLE_OPS
  norm_bool HOTLAB_ALLOW_DEV_CREDENTIALS
  export HOTLAB_STATE_DIR HOTLAB_VLAB_USER HOTLAB_VLAB_DIR HOTLAB_BIND_ADDRESS \
    HOTLAB_HHFAB_VERSION HOTLAB_HHFAB_INIT_ARGS HOTLAB_ALLOW_DEV_CREDENTIALS \
    HOTLAB_VLAB_GEN_ARGS HOTLAB_VLAB_UP_ARGS \
    HOTLAB_EXPECT_SWITCHES HOTLAB_EXPECT_CONTROLS HOTLAB_EXPECT_SERVERS \
    HOTLAB_VLAB_HEALTH_CMD HOTLAB_SWITCH_NOS_CMD HOTLAB_READY_TIMEOUT HOTLAB_READY_STABLE \
    HOTLAB_ENABLE_VLAB HOTLAB_ENABLE_OPS HOTLAB_K3D_CLUSTER HOTLAB_DOCKER_APT_VERSION
}

# Fail closed on unfilled required inputs / placeholders.
require_input() {
  local name
  for name in "$@"; do
    local val="${!name:-}"
    [[ -n "${val}" ]] || die "required input ${name} is unset"
    [[ "${val}" != *REPLACE_ME* ]] || die "required input ${name} still holds a REPLACE_ME placeholder"
  done
}

# Topology expectations: required whenever VLAB is enabled (no "0 disables the check").
require_vlab_expectations() {
  require_input HOTLAB_EXPECT_SWITCHES HOTLAB_EXPECT_CONTROLS HOTLAB_EXPECT_SERVERS
  local n
  for n in HOTLAB_EXPECT_SWITCHES HOTLAB_EXPECT_CONTROLS HOTLAB_EXPECT_SERVERS; do
    is_uint "${!n}" || die "${n} must be a non-negative integer"
  done
  [[ "${HOTLAB_EXPECT_SWITCHES}" -ge 1 && "${HOTLAB_EXPECT_CONTROLS}" -ge 1 ]] \
    || die "HOTLAB_EXPECT_SWITCHES and HOTLAB_EXPECT_CONTROLS must each be >= 1"
}

# Single up-front validation of the whole contract. Runs BEFORE any package install,
# download, account creation, or sudoers change. Pure shell/coreutils; no side effects.
# Caller must have run load_config. HERE = bootstrap tree root.
preflight_contract() {
  local here="$1" mode owner
  log "preflight: validating input contract"

  # Provider-neutrality guard runs first, on the tree we are about to execute.
  bash "${here}/check-portability.sh" || die "portability guard failed; refusing to run"

  [[ "$(uname -m)" == "x86_64" ]] || die "amd64 only"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID}" == "ubuntu" ]] || die "Ubuntu only (got ${ID})"

  # The env file is sourced as shell: it must not be writable/readable by others.
  owner="$(stat -c '%u' "${HOTLAB_ENV_FILE}")"; mode="$(stat -c '%a' "${HOTLAB_ENV_FILE}")"
  [[ "${owner}" == "0" ]] || die "${HOTLAB_ENV_FILE} must be root-owned"
  (( (8#${mode} & 8#077) == 0 )) || die "${HOTLAB_ENV_FILE} mode is ${mode}; must be 0600 (it is sourced as shell and may hold secrets)"

  [[ "${HOTLAB_VLAB_USER}" =~ ^[a-z_][a-z0-9_-]{0,30}$ ]] || die "HOTLAB_VLAB_USER invalid"
  [[ "${HOTLAB_K3D_CLUSTER}" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || die "HOTLAB_K3D_CLUSTER invalid"
  local p
  for p in HOTLAB_STATE_DIR HOTLAB_VLAB_DIR; do
    [[ "${!p}" =~ ^/[A-Za-z0-9._/-]+$ ]] || die "${p} must be an absolute path of [A-Za-z0-9._/-]"
  done
  [[ "${HOTLAB_BIND_ADDRESS}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "HOTLAB_BIND_ADDRESS must be an IPv4 address"
  is_uint "${HOTLAB_READY_TIMEOUT}" && is_uint "${HOTLAB_READY_STABLE}" || die "HOTLAB_READY_TIMEOUT/STABLE must be integers"
  [[ "${HOTLAB_HHFAB_VERSION}" == "0.43.1" ]] || die "hhfab ${HOTLAB_HHFAB_VERSION} has no pin in lib/pins.sh (only 0.43.1)"

  if [[ "${HOTLAB_ENABLE_OPS}" == "1" ]]; then
    require_input HOTLAB_MGMT_IMAGE HOTLAB_ARGOCD_CHART_VERSION HOTLAB_GITEA_CHART_VERSION
    [[ "${HOTLAB_MGMT_IMAGE}" =~ @sha256:[0-9a-f]{64}$ ]] || die "HOTLAB_MGMT_IMAGE must be digest-pinned (image@sha256:...)"
    local v
    for v in HOTLAB_ARGOCD_CHART_VERSION HOTLAB_GITEA_CHART_VERSION; do
      [[ "${!v}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.+-][0-9A-Za-z.-]+)?$ ]] || die "${v} must be an exact version (no ranges, no latest)"
    done
  fi

  if [[ "${HOTLAB_ENABLE_VLAB}" == "1" ]]; then
    [[ -c /dev/kvm ]] || die "/dev/kvm missing: nested virtualization is not exposed to this guest (provision-layer input)"
    # Credentials: no default. The operator supplies the hhfab init arguments.
    require_input HOTLAB_HHFAB_INIT_ARGS HOTLAB_VLAB_HEALTH_CMD
    require_vlab_expectations
    local a
    for a in HOTLAB_HHFAB_INIT_ARGS HOTLAB_VLAB_GEN_ARGS HOTLAB_VLAB_UP_ARGS; do
      # These land in a systemd Environment= line and are word-split by vlab-run.sh.
      [[ "${!a}" =~ ^[A-Za-z0-9_=,.:/@+\ -]*$ ]] || die "${a} contains characters outside [A-Za-z0-9_=,.:/@+ -]"
    done
    if [[ " ${HOTLAB_HHFAB_INIT_ARGS} " == *" --dev "* && "${HOTLAB_ALLOW_DEV_CREDENTIALS}" != "1" ]]; then
      die "--dev embeds public upstream credentials; refusing on a shared host. Supply real credentials in HOTLAB_HHFAB_INIT_ARGS, or set HOTLAB_ALLOW_DEV_CREDENTIALS=1 for a throwaway prototype"
    fi
    reject_destructive_flags "${HOTLAB_VLAB_UP_ARGS}" "${HOTLAB_HHFAB_INIT_ARGS}"
  fi
  log "preflight: ok"
}

# VM disks must never be recreated by an operator-supplied flag.
reject_destructive_flags() {
  local up="$1" init="$2" a
  for a in ${up}; do
    case "${a}" in -f|-f=*|--recreate|--recreate=*) die "HOTLAB_VLAB_UP_ARGS contains '${a}': recreating VMs would wipe installed switch NOS disks" ;; esac
  done
  for a in ${init}; do
    case "${a}" in -f|--force|--force=*) die "HOTLAB_HHFAB_INIT_ARGS contains '${a}': re-init over existing state is handled by vlab-run.sh, not by flags" ;; esac
  done
}

run_as_vlab() { runuser -u "${HOTLAB_VLAB_USER}" -- env HOME="${HOTLAB_STATE_DIR}/home" "$@"; }

# PIDs of QEMU processes belonging to THIS lab (cwd under, or cmdline referencing,
# HOTLAB_VLAB_DIR). Excludes unrelated QEMU on the host. Run as root.
hotlab_qemu_pids() {
  local d pid exe cwd
  for d in /proc/[0-9]*; do
    pid="${d#/proc/}"
    exe="$(readlink "${d}/exe" 2>/dev/null)" || continue
    case "${exe##*/}" in qemu-system-*) ;; *) continue ;; esac
    cwd="$(readlink "${d}/cwd" 2>/dev/null || true)"
    if [[ "${cwd}" == "${HOTLAB_VLAB_DIR}" || "${cwd}" == "${HOTLAB_VLAB_DIR}/"* ]] \
      || tr '\0' ' ' < "${d}/cmdline" 2>/dev/null | grep -qF -- "${HOTLAB_VLAB_DIR}/"; then
      echo "${pid}"
    fi
  done
}

# VM name from the QEMU -name argument (e.g. switch-1, control-1, server-01).
qemu_vm_name() {
  tr '\0' '\n' < "/proc/$1/cmdline" 2>/dev/null | awk '$0=="-name"{getline; print; exit}' | cut -d, -f1
}

file_sha256() { sha256sum "$1" | awk '{print $1}'; }

# fetch_verified URL EXPECTED_SHA256 DEST — bounded download, hash-checked, atomic.
fetch_verified() {
  local url="$1" sha="$2" dest="$3" tmp
  tmp="$(mktemp "${dest}.XXXXXX")"
  if ! timeout --kill-after=5 600 curl --fail --silent --show-error --location --proto '=https' \
    --retry 3 --connect-timeout 15 --max-time 300 --speed-limit 1024 --speed-time 30 \
    --output "${tmp}" "${url}"; then
    rm -f "${tmp}"; die "download failed: ${url}"
  fi
  if [[ "$(file_sha256 "${tmp}")" != "${sha}" ]]; then
    rm -f "${tmp}"; die "checksum mismatch for ${url}"
  fi
  mv -f "${tmp}" "${dest}"
}

# install_if_changed SRC DEST — install 0755 only when content differs (idempotent).
install_if_changed() {
  local src="$1" dest="$2"
  if [[ -f "${dest}" ]] && [[ "$(file_sha256 "${src}")" == "$(file_sha256 "${dest}")" ]]; then
    chmod 0755 "${dest}"; return 0
  fi
  install -o root -g root -m 0755 "${src}" "${dest}"
}

# have_binary_sha DEST SHA — true when DEST already has the pinned digest.
have_binary_sha() { [[ -f "$1" ]] && [[ "$(file_sha256 "$1")" == "$2" ]]; }
