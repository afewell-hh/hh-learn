#!/usr/bin/env bash
# Stage 4 (guest, as hotlab): acceptance checks 1-7 from issue #501, machine-readable.
# Usage: bash 40-checks.sh proof.env <check>
#   adopt         check 1  controller adopts switches in both Fabrics
#   nics          check 2  multi-fabric server NICs / stable naming (snapshot; run again later to compare)
#   converge      check 3  Agent generation convergence per Fabric (control-plane)
#   lldp-bgp      check 4  LLDP neighbours and BGP session state per switch
#   probes        check 5  one positive + one negative probe, each with controls
#   restart       checks 6+7  reboot RESTART_SWITCH; blast radius; marker persistence
#   vlab-restart  check 7b OPTIONAL: stop/start the VLAB unit to test NOS-install persistence (needs --confirm)
#   all           1,2,3,4,5 then restart (does NOT run vlab-restart)
#
# Scope discipline (#492): convergence and BGP state are CONTROL-PLANE evidence. The probes are
# a VLAB-emulated data-plane observation (software switches in nested KVM). Nothing here
# supports an ASIC, GPU, RDMA or line-rate claim, and every record says so.
# Each check records PASS only when its controls held; otherwise INCONCLUSIVE/FAIL.
set -euo pipefail
# shellcheck source=/dev/null
source "${1:?usage: 40-checks.sh proof.env <check>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"
check="${2:?check name}"

# ---------------------------------------------------------------- helpers
agents_json() { kctl get agents -A -o json; }

# Converged iff, for every named switch, an Agent exists and status.lastAppliedGen == metadata.generation.
# U: field names (printer columns APPLIEDG/CURRENTG per the ticket); the raw table is captured too.
agent_report() { # JSONFILE -> TSV: name applied current heartbeat
  jq -r '.items[] | [.metadata.name, (.status.lastAppliedGen // "null"), (.metadata.generation // "null"), (.status.lastHeartbeat // "null")] | @tsv' "$1"
}
switch_converged() { # JSONFILE SWITCH
  jq -e --arg s "$2" '.items[] | select(.metadata.name==$s) | (.status.lastAppliedGen != null) and (.status.lastAppliedGen == .metadata.generation)' "$1" >/dev/null
}

# ---------------------------------------------------------------- check 1
do_adopt() {
  cap c1-switches kctl get switches -A -o wide || true
  cap c1-agents-table kctl get agents -A -o wide || true
  if ! cap c1-agents-json agents_json; then
    rec c1-adopt 1-adopt FAIL control-plane "cannot read Agent objects from control node" raw/c1-agents-json.txt; return 0
  fi
  # strip our two framing lines ('$ cmd' and '[exit n]') to get pure JSON
  sed '1d;$d' "${RAW_DIR}/c1-agents-json.txt" | sed '$d' > "${RAW_DIR}/c1-agents.json"
  local f missing
  for f in ${PROOF_FABRICS}; do
    missing=""
    for s in $(fabric_switches "$f"); do
      jq -e --arg s "$s" '.items[] | select(.metadata.name==$s)' "${RAW_DIR}/c1-agents.json" >/dev/null || missing+="$s "
    done
    if [[ -z "$missing" ]]; then
      rec "c1-adopt-$f" 1-adopt PASS control-plane "all expected switches of Fabric '$f' have Agent objects ($(fabric_switches "$f"))" raw/c1-agents-table.txt
    else
      rec "c1-adopt-$f" 1-adopt FAIL control-plane "Fabric '$f' switches without Agent objects: $missing" raw/c1-agents-table.txt
    fi
  done
}

# ---------------------------------------------------------------- check 2
nic_snapshot() { # NODE OUTFILE
  node_ssh "$1" 'for i in /sys/class/net/*; do n=$(basename "$i"); [ "$n" = lo ] && continue; printf "%s %s %s\n" "$n" "$(cat "$i/address" 2>/dev/null)" "$(basename "$(readlink -f "$i/device" 2>/dev/null)")"; done | sort' > "$2"
}
do_nics() {
  local tag="${NIC_SNAPSHOT_TAG:-initial}" snap="${RAW_DIR}/c2-nics-${tag}-${MULTI_SERVER}.txt"
  if ! nic_snapshot "${MULTI_SERVER}" "$snap"; then
    rec c2-nics 2-nics FAIL host "cannot ssh to ${MULTI_SERVER}" ; return 0
  fi
  cap "c2-ip-${tag}" node_ssh "${MULTI_SERVER}" 'ip -br link; ip -br addr' || true
  # Connections that reference the server (U: schema; exact-string match anywhere in the object).
  cap c2-connections kctl get connections -A -o json || true
  local derived="n/a"
  if sed '1d;$d' "${RAW_DIR}/c2-connections.txt" | sed '$d' > "${RAW_DIR}/c2-connections.json" && jq -e . "${RAW_DIR}/c2-connections.json" >/dev/null 2>&1; then
    derived="$(jq --arg s "${MULTI_SERVER}" '[.items[] | select([.. | strings] | index($s))] | length' "${RAW_DIR}/c2-connections.json")"
  fi
  local n; n="$(wc -l < "$snap" | tr -d ' ')"
  local expect="${EXPECTED_MULTI_SERVER_NICS:-}"
  rec "c2-nics-${tag}" 2-nics OBSERVED host "${MULTI_SERVER}: ${n} non-loopback NICs (incl. management); Connections referencing it per control node: ${derived}; expected (diagram): ${expect:-unset}" "raw/c2-nics-${tag}-${MULTI_SERVER}.txt"
  if [[ -n "$expect" ]] && (( n >= expect + 1 )); then
    rec "c2-nic-count" 2-nics PASS host "NIC count ${n} >= expected data NICs ${expect} + 1 management (verify the +1 assumption; U)" "raw/c2-nics-${tag}-${MULTI_SERVER}.txt"
  else
    rec "c2-nic-count" 2-nics INCONCLUSIVE host "EXPECTED_MULTI_SERVER_NICS unset or NIC count (${n}) below expected+1; judge from raw" "raw/c2-nics-${tag}-${MULTI_SERVER}.txt"
  fi
  # Stability: compare with the earliest snapshot if this is a later run.
  local first="${RAW_DIR}/c2-nics-initial-${MULTI_SERVER}.txt"
  if [[ "$tag" != initial && -f "$first" ]]; then
    if diff -u "$first" "$snap" > "${RAW_DIR}/c2-nics-diff-${tag}.txt"; then
      rec "c2-nic-stability-${tag}" 2-nics PASS host "interface names, MACs and PCI addresses identical to the initial snapshot" "raw/c2-nics-diff-${tag}.txt"
    else
      rec "c2-nic-stability-${tag}" 2-nics FAIL host "interface naming/MAC/PCI differs from the initial snapshot" "raw/c2-nics-diff-${tag}.txt"
    fi
  fi
}

# ---------------------------------------------------------------- check 3
do_converge() {
  local f s ok deadline=$(( SECONDS + ${CONVERGE_TIMEOUT_S:-900} )) all
  all=""; for f in ${PROOF_FABRICS}; do all+="$(fabric_switches "$f") "; done
  while :; do
    agents_json > "${RAW_DIR}/c3-agents.json" 2>"${RAW_DIR}/c3-agents.err" || true
    ok=1
    for s in $all; do jq -e . "${RAW_DIR}/c3-agents.json" >/dev/null 2>&1 && switch_converged "${RAW_DIR}/c3-agents.json" "$s" || ok=0; done
    (( ok )) && break
    (( SECONDS < deadline )) || break
    sleep 15
  done
  cap c3-agents-table kctl get agents -A -o wide || true
  jq -e . "${RAW_DIR}/c3-agents.json" >/dev/null 2>&1 && agent_report "${RAW_DIR}/c3-agents.json" > "${RAW_DIR}/c3-agent-gens.tsv" || true
  # Fabric CRDs emit no Kubernetes events (#368, #481): record the count only as context, never as evidence.
  cap c3-events kctl get events -A --no-headers || true
  for f in ${PROOF_FABRICS}; do
    local bad=""
    for s in $(fabric_switches "$f"); do
      jq -e . "${RAW_DIR}/c3-agents.json" >/dev/null 2>&1 && switch_converged "${RAW_DIR}/c3-agents.json" "$s" || bad+="$s "
    done
    if [[ -z "$bad" ]]; then
      rec "c3-converge-$f" 3-converge PASS control-plane "Fabric '$f': every Agent has lastAppliedGen == generation (CONTROL-PLANE only; not isolation or data-plane proof)" raw/c3-agent-gens.tsv
    else
      rec "c3-converge-$f" 3-converge FAIL control-plane "Fabric '$f' not converged within ${CONVERGE_TIMEOUT_S:-900}s (or fields unreadable, U): $bad" raw/c3-agents-table.txt
    fi
  done
}

# ---------------------------------------------------------------- check 4
do_lldp_bgp() {
  local f s
  for f in ${PROOF_FABRICS}; do
    for s in $(fabric_switches "$f"); do
      cap "c4-lldp-$s" node_ssh "$s" sudo show lldp table || true
      local n; n="$(grep -cE '^(Ethernet|eth|E1/|PortChannel)' "${RAW_DIR}/c4-lldp-$s.txt" || true)"
      if (( n >= ${LLDP_MIN_NEIGHBORS:-1} )); then
        rec "c4-lldp-$s" 4-lldp-bgp PASS control-plane "[$f] $s: $n LLDP neighbour rows (>= ${LLDP_MIN_NEIGHBORS:-1}); compare against the diagram for exactness" "raw/c4-lldp-$s.txt"
      else
        rec "c4-lldp-$s" 4-lldp-bgp FAIL control-plane "[$f] $s: $n LLDP neighbour rows (< ${LLDP_MIN_NEIGHBORS:-1}); parse pattern is U" "raw/c4-lldp-$s.txt"
      fi
      cap "c4-bgp-$s" node_ssh "$s" sudo vtysh -c "'show bgp summary json'" || true
      sed '1d;$d' "${RAW_DIR}/c4-bgp-$s.txt" | sed '$d' > "${RAW_DIR}/c4-bgp-$s.json"
      if jq -e . "${RAW_DIR}/c4-bgp-$s.json" >/dev/null 2>&1; then
        local total est
        total="$(jq '[.. | objects | select(has("remoteAs") and has("state"))] | length' "${RAW_DIR}/c4-bgp-$s.json")"
        est="$(jq '[.. | objects | select(has("remoteAs") and has("state") and .state=="Established")] | length' "${RAW_DIR}/c4-bgp-$s.json")"
        if (( total > 0 && total == est )); then
          rec "c4-bgp-$s" 4-lldp-bgp PASS control-plane "[$f] $s: ${est}/${total} BGP peer entries Established" "raw/c4-bgp-$s.txt"
        else
          rec "c4-bgp-$s" 4-lldp-bgp FAIL control-plane "[$f] $s: ${est}/${total} BGP peer entries Established" "raw/c4-bgp-$s.txt"
        fi
      else
        rec "c4-bgp-$s" 4-lldp-bgp INCONCLUSIVE control-plane "[$f] $s: could not parse 'show bgp summary json' (command/user is U)" "raw/c4-bgp-$s.txt"
      fi
    done
  done
}

# ---------------------------------------------------------------- check 5
ping_from() { # ID NODE IFACE DST -> sets PING_RC
  local id="$1" node="$2" iface="$3" dst="$4" opt=""
  [[ -n "$iface" ]] && opt="-I $iface"
  PING_RC=0
  cap "$id" node_ssh "$node" "ping -c 5 -W 2 $opt $dst" || PING_RC=$?
}
dest_alive_controls() { # ID NODE IP -> returns 0 iff the endpoint is demonstrably alive
  local id="$1" node="$2" ip="$3" rc=0
  cap "${id}-mgmt" node_ssh "$node" true || rc=1                                  # reachable out-of-band
  cap "${id}-addr" node_ssh "$node" "ip -o addr show | grep -F ' ${ip}/'" || rc=1 # address configured
  cap "${id}-self" node_ssh "$node" "ping -c 2 -W 2 ${ip}" || rc=1                # answers locally
  return "$rc"
}
do_probes() {
  : "${POS_DST_IP:?set POS_DST_IP}" "${NEG_DST_IP:?set NEG_DST_IP}" "${NEG_CTRL_DST_IP:?set NEG_CTRL_DST_IP}"
  local scope=data-plane-vlab-emulated

  # Positive
  ping_from c5-pos "${POS_SRC_NODE}" "${POS_SRC_IFACE:-}" "${POS_DST_IP}"
  local pos_rc="$PING_RC"
  if (( pos_rc == 0 )); then
    rec c5-positive 5-probes PASS "$scope" "${POS_SRC_NODE} -> ${POS_DST_IP}: 5/5 replies. Single VLAB-emulated observation; no throughput/latency/ASIC claim." raw/c5-pos.txt
  else
    dest_alive_controls c5-pos-dst "${POS_DST_NODE}" "${POS_DST_IP}" && alive=alive || alive=NOT-alive
    rec c5-positive 5-probes FAIL "$scope" "${POS_SRC_NODE} -> ${POS_DST_IP} failed (ping rc ${pos_rc}); destination endpoint control: ${alive}. If NOT-alive the failure is the endpoint, not the fabric." raw/c5-pos.txt
  fi

  # Negative: needs (a) dead-endpoint control, (b) source-path control, (c) positive succeeded.
  ping_from c5-neg "${NEG_SRC_NODE}" "${NEG_SRC_IFACE:-}" "${NEG_DST_IP}"
  local neg_rc="$PING_RC" ctl_ok=1 why=""
  dest_alive_controls c5-neg-dst "${NEG_DST_NODE}" "${NEG_DST_IP}" || { ctl_ok=0; why+="destination not demonstrably alive; "; }
  ping_from c5-neg-srcctl "${NEG_SRC_NODE}" "${NEG_SRC_IFACE:-}" "${NEG_CTRL_DST_IP}"
  (( PING_RC == 0 )) || { ctl_ok=0; why+="source cannot reach NEG_CTRL_DST_IP (source path unhealthy); "; }
  (( pos_rc == 0 )) || { ctl_ok=0; why+="positive probe did not pass; "; }
  if (( neg_rc == 0 )); then
    rec c5-negative 5-probes FAIL "$scope" "${NEG_SRC_NODE} -> ${NEG_DST_IP} SUCCEEDED but was expected to be unreachable (isolation not observed)." raw/c5-neg.txt
  elif (( ctl_ok )); then
    rec c5-negative 5-probes PASS "$scope" "${NEG_SRC_NODE} -> ${NEG_DST_IP} failed while dest-alive and source-path controls held. One emulated observation; NOT a qualified isolation claim (needs separately qualified data-plane evidence per #492)." raw/c5-neg.txt
  else
    rec c5-negative 5-probes INCONCLUSIVE "$scope" "probe failed but controls did not hold: ${why}A failure here cannot be attributed to isolation." raw/c5-neg.txt
  fi
}

# ---------------------------------------------------------------- checks 6+7
uptime_of() { node_ssh "$1" 'cut -d" " -f1 /proc/uptime' 2>/dev/null | tail -1; }
do_restart() {
  local sw="${RESTART_SWITCH:?}" marker
  marker="hotlab-501-$(date -u +%s)-$RANDOM"
  # --- before
  local n others=""
  for n in $(all_switches); do [[ "$n" == "$sw" ]] || others+="$n "; done
  local -A up_before=()
  for n in ${MULTI_SERVER} ${PEER_SERVER}; do up_before[$n]="$(uptime_of "$n")"; done
  for n in $others; do up_before[$n]="$(uptime_of "$n")"; done
  agents_json > "${RAW_DIR}/c6-agents-before.json" 2>/dev/null || true
  cap c7-installer-before node_ssh "$sw" 'sudo sonic-installer list' || true
  cap c7-marker-write node_ssh "$sw" "echo ${marker} > \$HOME/${marker}; echo ${marker} | sudo tee /etc/${marker} >/dev/null; sync" || true
  cap c7-qcow-before sh -c "find '${VLAB_DIR}' -xdev \\( -name '*.qcow2' -o -name '*.img' \\) -printf '%p %s %TY-%Tm-%TdT%TH:%TM:%TS\\n' 2>/dev/null | sort" || true
  local up_sw_before; up_sw_before="$(uptime_of "$sw")"

  # --- restart (NOS-level reboot; VM stays defined so disk/NOS state is what is tested)
  rec c6-restart-issue 6-restart OBSERVED host "issuing 'sudo reboot' on ${sw} (uptime before: ${up_sw_before}s)"
  cap c6-reboot node_ssh "$sw" 'sudo reboot' || true
  wait_for 120 3 bash -c "! ( cd '${VLAB_DIR}' && ${NODE_SSH_PREFIX//%NODE%/${sw}} true )" || true
  if wait_for "${RESTART_TIMEOUT_S:-900}" 10 node_ssh "$sw" true; then
    rec c6-switch-back 6-restart OBSERVED host "${sw} reachable again"
  else
    rec c6-switch-back 6-restart FAIL host "${sw} did not come back within ${RESTART_TIMEOUT_S:-900}s"
  fi
  local up_sw_after; up_sw_after="$(uptime_of "$sw")"
  if [[ -n "$up_sw_after" ]] && awk -v a="$up_sw_after" -v b="$up_sw_before" 'BEGIN{exit !(a+0 < b+0)}'; then
    rec c6-switch-rebooted 6-restart PASS host "uptime reset (${up_sw_before}s -> ${up_sw_after}s): the switch really rebooted"
  else
    rec c6-switch-rebooted 6-restart INCONCLUSIVE host "uptime did not reset (${up_sw_before} -> ${up_sw_after}); reboot not demonstrated"
  fi

  # --- reconverge, then blast radius
  do_converge
  do_lldp_bgp
  for n in ${MULTI_SERVER} ${PEER_SERVER} $others; do
    local after; after="$(uptime_of "$n")"
    if [[ -n "$after" ]] && awk -v a="$after" -v b="${up_before[$n]:-0}" 'BEGIN{exit !(a+0 >= b+0)}'; then
      rec "c6-survive-$n" 6-restart PASS host "$n kept running through the switch restart (uptime ${up_before[$n]}s -> ${after}s, no reset)"
    else
      rec "c6-survive-$n" 6-restart FAIL host "$n did not survive: uptime ${up_before[$n]:-?}s -> ${after:-unreachable}"
    fi
  done
  NIC_SNAPSHOT_TAG=after-switch-restart do_nics

  # --- check 7: writable-disk / NOS-install state across the restart
  cap c7-installer-after node_ssh "$sw" 'sudo sonic-installer list' || true
  cap c7-marker-read node_ssh "$sw" "cat \$HOME/${marker}; cat /etc/${marker}" || true
  if [[ "$(grep -c "^${marker}$" "${RAW_DIR}/c7-marker-read.txt" || true)" == 2 ]]; then
    rec c7-marker 7-persistence PASS host "marker written to \$HOME and /etc survived the NOS reboot" raw/c7-marker-read.txt
  else
    rec c7-marker 7-persistence FAIL host "marker missing after reboot (writable state NOT preserved for ${sw})" raw/c7-marker-read.txt
  fi
  if diff <(sed '1d' "${RAW_DIR}/c7-installer-before.txt") <(sed '1d' "${RAW_DIR}/c7-installer-after.txt") >/dev/null; then
    rec c7-nos-image 7-persistence PASS host "sonic-installer list identical before/after (NOS was not reinstalled)" raw/c7-installer-after.txt
  else
    rec c7-nos-image 7-persistence FAIL host "sonic-installer list differs before/after" raw/c7-installer-after.txt
  fi
}

do_vlab_restart() {
  [[ "${3:-}" == "--confirm" ]] || die "vlab-restart stops ALL VLAB VMs for a restart test; pass --confirm"
  local sw="${RESTART_SWITCH:?}" marker
  marker="hotlab-501-vlab-$(date -u +%s)"
  cap v7-marker-write node_ssh "$sw" "echo ${marker} | sudo tee /etc/${marker} >/dev/null; sync" || true
  cap v7-qcow-before sh -c "find '${VLAB_DIR}' -xdev \\( -name '*.qcow2' -o -name '*.img' \\) -printf '%p %s %TY-%Tm-%TdT%TH:%TM:%TS\\n' | sort" || true
  vlab_stop
  rec v7-stopped 7-persistence OBSERVED host "VLAB stopped (tmux session ended)"
  # shellcheck disable=SC2086
  vlab_start "${VLAB_DIR}" ${HHFAB_UP_ARGS}
  rec v7-started 7-persistence OBSERVED host "hhfab vlab up re-run in the SAME directory (resume path)"
  if ! wait_for "${CONVERGE_TIMEOUT_S:-900}" 15 node_ssh "$sw" true; then
    rec v7-resume 7-persistence FAIL host "${sw} unreachable after vlab restart"; return 0
  fi
  cap v7-qcow-after sh -c "find '${VLAB_DIR}' -xdev \\( -name '*.qcow2' -o -name '*.img' \\) -printf '%p %s %TY-%Tm-%TdT%TH:%TM:%TS\\n' | sort" || true
  cap v7-marker-read node_ssh "$sw" "cat /etc/${marker}" || true
  if grep -qx "${marker}" "${RAW_DIR}/v7-marker-read.txt"; then
    rec v7-marker 7-persistence PASS host "marker survived a full VLAB stop/start in the same directory" raw/v7-marker-read.txt
  else
    rec v7-marker 7-persistence FAIL host "marker lost across VLAB stop/start: disk state is NOT preserved by resume (or the VMs were rebuilt; compare qcow2 timestamps)" raw/v7-marker-read.txt
  fi
  do_converge
}

case "$check" in
  adopt)        do_adopt ;;
  nics)         NIC_SNAPSHOT_TAG="${NIC_SNAPSHOT_TAG:-initial}" do_nics ;;
  converge)     do_converge ;;
  lldp-bgp)     do_lldp_bgp ;;
  probes)       do_probes ;;
  restart)      do_restart ;;
  vlab-restart) do_vlab_restart "$@" ;;
  all)          do_adopt; NIC_SNAPSHOT_TAG=initial do_nics; do_converge; do_lldp_bgp; do_probes; do_restart ;;
  *)            die "unknown check: $check" ;;
esac
