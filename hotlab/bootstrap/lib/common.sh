#!/usr/bin/env bash
# Shared helpers. Sourced, never executed. Provider-neutral: no cloud CLI, no
# metadata-server calls. Everything the guest needs comes from HOTLAB_ENV_FILE.

log() { echo "hotlab-bootstrap: $*"; }
warn() { echo "hotlab-bootstrap: WARN: $*" >&2; }
die() { echo "hotlab-bootstrap: ERROR: $*" >&2; exit 1; }

require_root() { [[ "$(id -u)" -eq 0 ]] || die "must run as root"; }

# Load the operator-supplied contract file and apply defaults.
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
  : "${HOTLAB_HHFAB_INIT_ARGS:=--dev --gateway=false}"
  : "${HOTLAB_VLAB_GEN_ARGS:=}"
  : "${HOTLAB_VLAB_UP_ARGS:=--kill-stale}"
  : "${HOTLAB_EXPECT_VMS:=0}"
  : "${HOTLAB_ENABLE_VLAB:=1}"
  : "${HOTLAB_ENABLE_OPS:=1}"
  : "${HOTLAB_K3D_CLUSTER:=hotlab-mgmt}"
  : "${HOTLAB_DOCKER_APT_VERSION:=}"
  export HOTLAB_STATE_DIR HOTLAB_VLAB_USER HOTLAB_VLAB_DIR HOTLAB_BIND_ADDRESS \
    HOTLAB_HHFAB_VERSION HOTLAB_HHFAB_INIT_ARGS HOTLAB_VLAB_GEN_ARGS HOTLAB_VLAB_UP_ARGS \
    HOTLAB_EXPECT_VMS HOTLAB_ENABLE_VLAB HOTLAB_ENABLE_OPS HOTLAB_K3D_CLUSTER \
    HOTLAB_DOCKER_APT_VERSION
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
