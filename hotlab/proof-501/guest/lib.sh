#!/usr/bin/env bash
# Shared helpers for the #501 proof. Source, do not execute.
# Evidence model: every observation is one JSON line in $PROOF_OUT/evidence.jsonl and
# the raw command output is kept in $PROOF_OUT/raw/<id>.txt. Nothing is "passed" by
# default: a check with an unmet control is INCONCLUSIVE, never PASS.
#
# Record tag "P" means "observed by running a command in this run". Interpretation
# of what an observation means stays U until a human reviews it (see RESULTS-TEMPLATE.md).

: "${PROOF_OUT:?PROOF_OUT must be set (source proof.env first)}"
RAW_DIR="${PROOF_OUT}/raw"
EVIDENCE="${PROOF_OUT}/evidence.jsonl"
mkdir -p "${RAW_DIR}"
touch "${EVIDENCE}"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }
die() { log "FATAL: $*"; exit 2; }

# rec ID CHECK STATUS SCOPE OBSERVATION [RAWFILE]
#   STATUS: PASS | FAIL | INCONCLUSIVE | OBSERVED | REJECTED | SKIPPED
#   SCOPE : control-plane | data-plane-vlab-emulated | host | environment
rec() {
  local id="$1" check="$2" status="$3" scope="$4" obs="$5" raw="${6:-}"
  jq -nc --arg id "$id" --arg check "$check" --arg status "$status" --arg scope "$scope" \
    --arg obs "$obs" --arg raw "$raw" --arg ts "$(date -u +%FT%TZ)" \
    '{ts:$ts,id:$id,check:$check,status:$status,scope:$scope,tag:"P",observation:$obs,raw:$raw,
      claims_excluded:["ASIC","GPU","RDMA","line-rate"]}' >> "${EVIDENCE}"
  log "[$check] $id => $status: $obs"
}

# cap ID CMD...   Run a command; store "$ cmd", output and exit code in raw/ID.txt.
# Never aborts the script; returns the command's exit status.
cap() {
  local id="$1"; shift
  local f="${RAW_DIR}/${id}.txt" rc=0
  printf '$ %s\n' "$*" > "$f"
  "$@" >> "$f" 2>&1 || rc=$?
  printf '\n[exit %s]\n' "$rc" >> "$f"
  return "$rc"
}

# Ways to reach VLAB VMs. Templates, because the exact hhfab CLI is U for 26.05;
# 00-preflight.sh captures `hhfab vlab ssh --help` so a wrong template is visible.
: "${NODE_SSH_PREFIX:=hhfab vlab ssh -n %NODE% --}"
: "${KCTL_CMD:=sudo k3s kubectl}"
: "${CONTROL_NODE:=control-1}"
: "${VLAB_DIR:=${PROOF_DIR:-.}/multifabric}"

node_ssh() { # NODE command...
  local node="$1"; shift
  local -a base
  read -ra base <<< "${NODE_SSH_PREFIX//%NODE%/${node}}"
  ( cd "${VLAB_DIR}" && "${base[@]}" "$@" )
}
kctl() { node_ssh "${CONTROL_NODE}" "${KCTL_CMD}" "$@"; }

# Poll until a command succeeds or TIMEOUT seconds pass.
wait_for() { # TIMEOUT INTERVAL command...
  local timeout="$1" interval="$2"; shift 2
  local end=$(( SECONDS + timeout ))
  until "$@" >/dev/null 2>&1; do
    (( SECONDS < end )) || return 1
    sleep "$interval"
  done
}

# Per-fabric switch lists come from SWITCHES_<fabric> in proof.env.
fabric_switches() {
  local name="SWITCHES_$1"
  printf '%s' "${!name-}"
}
all_switches() {
  local f
  for f in ${PROOF_FABRICS}; do fabric_switches "$f"; printf ' '; done
}

HHFAB="${HHFAB:-hhfab}"
vlab_stop() {
  if tmux has-session -t vlab 2>/dev/null; then
    log "stopping VLAB tmux session"
    tmux send-keys -t vlab C-c
    wait_for 300 5 bash -c '! tmux has-session -t vlab' || tmux kill-session -t vlab
  fi
}
vlab_start() { # DIR ARGS...
  local dir="$1"; shift
  if tmux has-session -t vlab 2>/dev/null; then die "tmux session 'vlab' exists; run vlab_stop first"; fi
  tmux new-session -d -s vlab "cd '${dir}' && ${HHFAB} vlab up $* 2>&1 | tee -a '${PROOF_OUT}/vlab-up.log'"
}
