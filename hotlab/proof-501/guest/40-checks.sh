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

# Fail closed: adopt/converge/membership claims need explicit, validated expectations.
# Records FAIL (never PASS) and returns 1 when they are missing or malformed.
topology_ok() { # ID CHECK
  local id="$1" chk="$2" f s list why="" seen=" " nf=0
  for f in ${PROOF_FABRICS:-}; do
    nf=$((nf+1))
    if ! [[ "$f" =~ ^[A-Za-z0-9_]+$ ]]; then why+="fabric label '$f' invalid; "; continue; fi
    list="$(fabric_switches "$f")"
    if [[ -z "${list//[[:space:]]/}" ]]; then why+="SWITCHES_$f is empty or unset; "; continue; fi
    for s in $list; do
      [[ "$s" =~ ^[a-z0-9][a-z0-9.-]*$ ]] || why+="switch name '$s' invalid; "
      if [[ "$seen" == *" $s "* ]]; then why+="switch '$s' listed more than once; "; fi
      seen+="$s "
    done
  done
  if (( nf < 2 )); then why+="PROOF_FABRICS must name at least 2 Fabrics (has $nf); "; fi
  [[ -n "${MULTI_SERVER:-}" ]] || why+="MULTI_SERVER unset; "
  [[ -n "${PEER_SERVER:-}" ]] || why+="PEER_SERVER unset; "
  if [[ -n "${MULTI_SERVER:-}" && "${MULTI_SERVER:-}" == "${PEER_SERVER:-}" ]]; then why+="MULTI_SERVER and PEER_SERVER are the same; "; fi
  if [[ -n "$why" ]]; then
    rec "${id}-topology" "$chk" FAIL environment "topology expectations missing/invalid, failing closed (no PASS without them): ${why}"
    return 1
  fi
  return 0
}
json_body() { sed '1d;$d' "$1" | sed '$d' > "$2"; } # strip cap() framing lines

# Membership from the CLUSTER, not from input labels. A Connection "references" a node when
# the node name is the part before '/' of any string in the object (ports look like node/port; U schema).
# PASS requires: each Fabric's expected switches exist as Switch objects, MULTI_SERVER has >=1
# Connection landing on a switch of EVERY Fabric, and no Connection joins switches of two Fabrics.
check_membership() {
  local conns="${RAW_DIR}/c1-connections.json" sws="${RAW_DIR}/c1-switches.json" f s n bad="" absent=""
  cap c1-connections kctl get connections -A -o json || true
  cap c1-switches-json kctl get switches -A -o json || true
  json_body "${RAW_DIR}/c1-connections.txt" "$conns"; json_body "${RAW_DIR}/c1-switches-json.txt" "$sws"
  if ! jq -e '.items | type=="array"' "$conns" >/dev/null 2>&1 || ! jq -e '.items | type=="array" and length>0' "$sws" >/dev/null 2>&1; then
    rec c1-membership 1-adopt FAIL control-plane "cannot read Connection/Switch objects from the cluster; Fabric membership NOT established" raw/c1-connections.txt
    return 0
  fi
  local nfab_hit=0 nfab=0 swj
  for f in ${PROOF_FABRICS}; do
    nfab=$((nfab+1)); absent=""
    for s in $(fabric_switches "$f"); do
      jq -e --arg s "$s" '.items[] | select(.metadata.name==$s)' "$sws" >/dev/null || absent+="$s "
    done
    [[ -z "$absent" ]] || bad+="Fabric '$f' expected switches absent from cluster: $absent; "
    swj="$(jq -nc '$ARGS.positional' --args $(fabric_switches "$f"))"
    n="$(jq --arg m "${MULTI_SERVER}" --argjson sw "$swj" \
      '[.items[] | [.. | strings | split("/")[0]] as $r | select(($r|index($m)) != null and ($r | any(. as $x | $sw | index($x) != null)))] | length' "$conns")"
    rec "c1-membership-$f" 1-adopt OBSERVED control-plane "Connections in the cluster joining ${MULTI_SERVER} to a '$f' switch ($(fabric_switches "$f")): $n" raw/c1-connections.txt
    if (( n >= 1 )); then nfab_hit=$((nfab_hit+1)); else bad+="${MULTI_SERVER} has no Connection to any switch of Fabric '$f'; "; fi
  done
  # cross-Fabric Connections mean the input grouping does not match reality
  local fa fb ja jb x
  for fa in ${PROOF_FABRICS}; do for fb in ${PROOF_FABRICS}; do
    [[ "$fa" < "$fb" ]] || continue
    ja="$(jq -nc '$ARGS.positional' --args $(fabric_switches "$fa"))"; jb="$(jq -nc '$ARGS.positional' --args $(fabric_switches "$fb"))"
    x="$(jq --argjson a "$ja" --argjson b "$jb" '[.items[] | [.. | strings | split("/")[0]] as $r | select(($r | any(. as $y | $a | index($y) != null)) and ($r | any(. as $y | $b | index($y) != null)))] | length' "$conns")"
    (( x == 0 )) || bad+="$x Connection(s) join switches of '$fa' and '$fb' (grouping inconsistent with cluster); "
  done; done
  if [[ -z "$bad" ]] && (( nfab_hit == nfab )); then
    rec c1-multi-fabric-server 1-adopt PASS control-plane "${MULTI_SERVER} has Connections landing in all ${nfab} Fabrics per cluster Connection objects (CONTROL-PLANE object evidence only; existence in the API != working data path)" raw/c1-connections.txt
  else
    rec c1-multi-fabric-server 1-adopt FAIL control-plane "multi-Fabric attachment of ${MULTI_SERVER} NOT established from the cluster: ${bad}" raw/c1-connections.txt
  fi
}

# ---------------------------------------------------------------- check 1
do_adopt() {
  topology_ok c1 1-adopt || return 0
  cap c1-switches kctl get switches -A -o wide || true
  cap c1-agents-table kctl get agents -A -o wide || true
  if ! cap c1-agents-json agents_json; then
    rec c1-adopt 1-adopt FAIL control-plane "cannot read Agent objects from control node" raw/c1-agents-json.txt; return 0
  fi
  json_body "${RAW_DIR}/c1-agents-json.txt" "${RAW_DIR}/c1-agents.json"
  if ! jq -e '.items | type=="array" and length>0' "${RAW_DIR}/c1-agents.json" >/dev/null 2>&1; then
    rec c1-adopt 1-adopt FAIL control-plane "Agent data unreadable or empty; no adoption can be claimed" raw/c1-agents-table.txt; return 0
  fi
  local f s missing
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
  check_membership
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
  topology_ok c3 3-converge || return 0
  local f s ok deadline=$(( SECONDS + ${CONVERGE_TIMEOUT_S:-900} )) all
  all=""; for f in ${PROOF_FABRICS}; do all+="$(fabric_switches "$f") "; done
  while :; do
    agents_json > "${RAW_DIR}/c3-agents.json" 2>"${RAW_DIR}/c3-agents.err" || true
    ok=1
    # unreadable/empty Agent data is never convergence
    jq -e '.items | type=="array" and length>0' "${RAW_DIR}/c3-agents.json" >/dev/null 2>&1 || ok=0
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
    jq -e '.items | type=="array" and length>0' "${RAW_DIR}/c3-agents.json" >/dev/null 2>&1 || bad+="[Agent data unreadable or empty] "
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
  topology_ok c4 4-lldp-bgp || return 0
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
# A probe's exit code is NOT evidence of a specific condition. ping_from runs the probe on the
# remote node behind sentinel lines and classifies what was actually printed:
#   REPLIES_ALL | REPLIES_PARTIAL | NO_REPLY  -> the probe ran (PROBE_START seen, PROBE_RC seen)
#   ERROR                                     -> transport (ssh/hhfab), missing ping, bad interface,
#                                                bad arguments, ping rc>=2, or unparseable output.
# NO_REPLY requires: PROBE_START, ping rc exactly 1, and "N transmitted, 0 received" parsed from output.
# Sets PROBE_CLASS PROBE_TX PROBE_RX PROBE_DETAIL (all derived from the output file raw/ID.txt).
ping_from() { # ID NODE IFACE DST [COUNT]
  local id="$1" node="$2" iface="$3" dst="$4" count="${5:-5}" opt="" cmd f="${RAW_DIR}/$1.txt" rc=0 line prc
  PROBE_CLASS=ERROR; PROBE_TX=""; PROBE_RX=""; PROBE_DETAIL=""
  if ! [[ "$dst" =~ ^[0-9A-Fa-f:.]+$ ]]; then PROBE_DETAIL="argument error: destination '$dst' is not an IP literal"; return 0; fi
  if [[ -n "$iface" ]]; then
    if ! [[ "$iface" =~ ^[A-Za-z0-9_.@-]+$ ]]; then PROBE_DETAIL="argument error: interface '$iface' invalid"; return 0; fi
    opt="-I $iface"
  fi
  cmd='command -v ping >/dev/null 2>&1 || { echo PROBE_NO_PING; exit 0; }; '
  if [[ -n "$iface" ]]; then cmd+="[ -d /sys/class/net/${iface} ] || { echo PROBE_NO_IFACE; exit 0; }; "; fi
  cmd+="echo PROBE_START; ping -c ${count} -W 2 ${opt} ${dst}; echo PROBE_RC=\$?"
  cap "$id" node_ssh "$node" "$cmd" || rc=$?
  # sentinels are matched as WHOLE lines; the "$ cmd" framing line can never equal them
  if grep -qx 'PROBE_NO_PING' "$f"; then PROBE_DETAIL="tool error: ping not installed on $node"; return 0; fi
  if grep -qx 'PROBE_NO_IFACE' "$f"; then PROBE_DETAIL="interface error: ${iface} does not exist on $node"; return 0; fi
  if ! grep -qx 'PROBE_START' "$f"; then PROBE_DETAIL="transport error: remote probe never started on $node (ssh/hhfab rc ${rc}); see raw/$id.txt"; return 0; fi
  line="$(grep -E '^PROBE_RC=[0-9]+$' "$f" | tail -1 || true)"
  if [[ -z "$line" ]]; then PROBE_DETAIL="probe started on $node but did not finish (no PROBE_RC)"; return 0; fi
  prc="${line#PROBE_RC=}"
  line="$(grep -E '[0-9]+ packets transmitted, [0-9]+ (packets )?received' "$f" | tail -1 || true)"
  if [[ -z "$line" ]]; then PROBE_DETAIL="ping rc ${prc} but no packet statistics in output (argument/tool error)"; return 0; fi
  PROBE_TX="$(sed -E 's/^([0-9]+) packets transmitted.*/\1/' <<<"$line")"
  PROBE_RX="$(sed -E 's/^[0-9]+ packets transmitted, ([0-9]+) (packets )?received.*/\1/' <<<"$line")"
  PROBE_DETAIL="${PROBE_RX}/${PROBE_TX} replies observed (ping rc ${prc}): ${line}"
  if (( PROBE_TX < 1 || prc >= 2 )); then PROBE_CLASS=ERROR; PROBE_DETAIL="ping error (rc ${prc}): ${line}"; return 0; fi
  if (( PROBE_RX == 0 )); then
    if (( prc == 1 )); then PROBE_CLASS=NO_REPLY; else PROBE_CLASS=ERROR; PROBE_DETAIL+=" [0 received but rc ${prc}; inconsistent]"; fi
  elif (( PROBE_RX == PROBE_TX )); then PROBE_CLASS=REPLIES_ALL
  else PROBE_CLASS=REPLIES_PARTIAL
  fi
}
# Destination endpoint control, bound to the address under test: reachable out-of-band, the exact
# address is configured on a named interface that is operationally up, and it answers locally
# (all replies, parsed). Sets DEST_DEV. Returns 0 iff all hold.
dest_alive_controls() { # ID NODE IP
  local id="$1" node="$2" ip="$3" rc=0 cmd
  DEST_DEV=""
  [[ "$ip" =~ ^[0-9A-Fa-f:.]+$ ]] || return 1
  cap "${id}-mgmt" node_ssh "$node" true || rc=1
  cmd='dev=$(ip -o addr show | awk -v ip=@IP@ '"'"'{split($4,a,"/"); if (a[1]==ip) {print $2; exit}}'"'"'); '
  cmd+='[ -n "$dev" ] || { echo DEST_NO_ADDR; exit 0; }; echo "DEST_DEV=$dev"; echo "DEST_STATE=$(cat /sys/class/net/$dev/operstate 2>/dev/null)"'
  cap "${id}-addr" node_ssh "$node" "${cmd//@IP@/$ip}" || rc=1
  DEST_DEV="$(sed -n 's/^DEST_DEV=//p' "${RAW_DIR}/${id}-addr.txt" | tail -1)"
  if [[ -z "$DEST_DEV" ]] || ! grep -qx 'DEST_STATE=up' "${RAW_DIR}/${id}-addr.txt"; then rc=1; fi
  ping_from "${id}-self" "$node" "" "$ip" 2
  [[ "$PROBE_CLASS" == REPLIES_ALL ]] || rc=1
  return "$rc"
}
do_probes() {
  : "${POS_DST_IP:?set POS_DST_IP}" "${NEG_DST_IP:?set NEG_DST_IP}" "${NEG_CTRL_DST_IP:?set NEG_CTRL_DST_IP}"
  local scope=data-plane-vlab-emulated

  # Positive. Reports what ping printed, never what the exit code implies.
  ping_from c5-pos "${POS_SRC_NODE}" "${POS_SRC_IFACE:-}" "${POS_DST_IP}"
  local pos_class="$PROBE_CLASS" pos_detail="$PROBE_DETAIL" alive
  local pos_obs="${POS_SRC_NODE}${POS_SRC_IFACE:+ (via ${POS_SRC_IFACE})} -> ${POS_DST_IP}: ${pos_detail}"
  case "$pos_class" in
    REPLIES_ALL)
      rec c5-positive 5-probes PASS "$scope" "${pos_obs}. Single VLAB-emulated observation; no throughput/latency/ASIC claim." raw/c5-pos.txt ;;
    REPLIES_PARTIAL)
      rec c5-positive 5-probes INCONCLUSIVE "$scope" "${pos_obs}. Partial loss: path is lossy, not a clean positive; judge from raw." raw/c5-pos.txt ;;
    NO_REPLY)
      dest_alive_controls c5-pos-dst "${POS_DST_NODE}" "${POS_DST_IP}" && alive="alive on ${DEST_DEV}" || alive=NOT-alive
      rec c5-positive 5-probes FAIL "$scope" "${pos_obs}; destination endpoint control: ${alive}. If NOT-alive the failure is the endpoint, not the fabric." raw/c5-pos.txt ;;
    *)
      rec c5-positive 5-probes INCONCLUSIVE "$scope" "probe did not run to a usable result: ${pos_detail}" raw/c5-pos.txt ;;
  esac

  # Negative. PASS needs POSITIVE evidence of the no-reply condition (probe ran, 0 received, ping rc 1)
  # plus controls bound to the same path: (a) the destination address is configured on an up interface
  # and answers locally, (b) the same source node + same interface gets ALL replies from NEG_CTRL_DST_IP,
  # (c) the positive probe was clean. Transport/tool/argument errors are INCONCLUSIVE, never PASS.
  ping_from c5-neg "${NEG_SRC_NODE}" "${NEG_SRC_IFACE:-}" "${NEG_DST_IP}"
  local neg_class="$PROBE_CLASS" neg_detail="$PROBE_DETAIL" ctl_ok=1 why=""
  local neg_obs="${NEG_SRC_NODE}${NEG_SRC_IFACE:+ (via ${NEG_SRC_IFACE})} -> ${NEG_DST_IP}: ${neg_detail}"
  case "$neg_class" in
    REPLIES_ALL|REPLIES_PARTIAL)
      rec c5-negative 5-probes FAIL "$scope" "${neg_obs}. Replies were observed but the target was expected to be unreachable (isolation not observed)." raw/c5-neg.txt
      return 0 ;;
    ERROR)
      rec c5-negative 5-probes INCONCLUSIVE "$scope" "negative probe did not run to a usable result, so no-reply was NOT established: ${neg_detail}" raw/c5-neg.txt
      return 0 ;;
  esac
  if [[ "${NEG_CTRL_DST_IP}" == "${NEG_DST_IP}" ]]; then ctl_ok=0; why+="NEG_CTRL_DST_IP equals NEG_DST_IP; "; fi
  dest_alive_controls c5-neg-dst "${NEG_DST_NODE}" "${NEG_DST_IP}" || { ctl_ok=0; why+="destination ${NEG_DST_IP} not demonstrably alive on an up interface and answering locally; "; }
  ping_from c5-neg-srcctl "${NEG_SRC_NODE}" "${NEG_SRC_IFACE:-}" "${NEG_CTRL_DST_IP}"
  [[ "$PROBE_CLASS" == REPLIES_ALL ]] || { ctl_ok=0; why+="source path control (${NEG_SRC_NODE}${NEG_SRC_IFACE:+ via ${NEG_SRC_IFACE}} -> ${NEG_CTRL_DST_IP}) did not get all replies: ${PROBE_DETAIL}; "; }
  [[ "$pos_class" == REPLIES_ALL ]] || { ctl_ok=0; why+="positive probe was not a clean all-replies result; "; }
  if (( ctl_ok )); then
    rec c5-negative 5-probes PASS "$scope" "${neg_obs}. Destination alive on ${DEST_DEV}; same-source/same-interface control to ${NEG_CTRL_DST_IP} got all replies. One emulated observation; NOT a qualified isolation claim (needs separately qualified data-plane evidence per #492)." raw/c5-neg.txt
  else
    rec c5-negative 5-probes INCONCLUSIVE "$scope" "${neg_obs}; controls did not hold: ${why}A no-reply here cannot be attributed to isolation." raw/c5-neg.txt
  fi
}

# ---------------------------------------------------------------- checks 6+7
uptime_of() { node_ssh "$1" 'cut -d" " -f1 /proc/uptime' 2>/dev/null | tail -1; }
do_restart() {
  topology_ok c6 6-restart || return 0
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
