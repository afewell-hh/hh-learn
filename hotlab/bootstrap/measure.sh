#!/usr/bin/env bash
# Sizing measurement harness (issue #510). Read-only. Run as root ON the running Hot Lab
# host, after VLAB has converged. Produces MEASURED figures; nothing here estimates.
#
# Usage: measure.sh LABEL [CPU_SAMPLE_SECONDS=60]
#   e.g. measure.sh converged 60 ; measure.sh idle-30min 300
# Output dir: ${HOTLAB_STATE_DIR:-/var/lib/hotlab}/measure/<UTC timestamp>-<LABEL>/
#   host.txt    /proc/meminfo excerpt, committed vs resident, swap, nproc, kernel
#   qemu.tsv    one row per QEMU process: pid, name, allocated_MiB(-m), Rss_MiB, Pss_MiB, Swap_MiB
#   cpu.txt     host CPU busy % over the sample window and per-QEMU CPU % (utime+stime delta)
#   docker.txt  `docker stats --no-stream` for the k3d containers
#   summary.txt totals: sum allocated, sum RSS, sum PSS, host MemAvailable, Committed_AS
# Commands that produce each figure are echoed into the file header.
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "measure: run as root (needed for /proc/PID/smaps_rollup)" >&2; exit 1; }
label="${1:?usage: measure.sh LABEL [SECONDS]}"
secs="${2:-60}"
out="${HOTLAB_STATE_DIR:-/var/lib/hotlab}/measure/$(date -u +%Y%m%dT%H%M%SZ)-${label}"
mkdir -p "${out}"

kib_to_mib() { awk -v k="$1" 'BEGIN{printf "%.1f", k/1024}'; }

# ---- host memory: committed vs resident -------------------------------------
{
  echo "# source: /proc/meminfo, nproc, uname -r"
  grep -E '^(MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree|CommitLimit|Committed_AS|AnonPages|Shmem):' /proc/meminfo
  echo "nproc: $(nproc)"
  echo "kernel: $(uname -r)"
} > "${out}/host.txt"

# ---- per-QEMU RSS / PSS ------------------------------------------------------
{
  echo "# source: pgrep -f qemu-system-x86_64 ; /proc/PID/cmdline (-name, -m) ; /proc/PID/smaps_rollup (Rss, Pss, Swap)"
  printf 'pid\tname\talloc_MiB\trss_MiB\tpss_MiB\tswap_MiB\n'
} > "${out}/qemu.tsv"
sum_alloc=0; sum_rss=0; sum_pss=0; n=0
for pid in $(pgrep -f 'qemu-system-x86_64' || true); do
  [[ -r "/proc/${pid}/smaps_rollup" ]] || continue
  args="$(tr '\0' '\n' < "/proc/${pid}/cmdline")"
  name="$(echo "${args}" | awk '$0=="-name"{getline; print; exit}' | cut -d, -f1)"
  mem="$(echo "${args}" | awk '$0=="-m"{getline; print; exit}')"   # e.g. 6144, 6G, 6144M
  case "${mem}" in
    *G|*g) alloc=$(( ${mem%[Gg]} * 1024 )) ;;
    *M|*m) alloc="${mem%[Mm]}" ;;
    ''|*[!0-9]*) alloc=0 ;;
    *) alloc="${mem}" ;;
  esac
  rss="$(awk '/^Rss:/{print $2}' "/proc/${pid}/smaps_rollup")"
  pss="$(awk '/^Pss:/{print $2}' "/proc/${pid}/smaps_rollup")"
  swp="$(awk '/^Swap:/{print $2}' "/proc/${pid}/smaps_rollup")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "${pid}" "${name:-?}" "${alloc}" "$(kib_to_mib "${rss}")" "$(kib_to_mib "${pss}")" "$(kib_to_mib "${swp}")" >> "${out}/qemu.tsv"
  sum_alloc=$((sum_alloc + alloc)); sum_rss=$((sum_rss + rss)); sum_pss=$((sum_pss + pss)); n=$((n + 1))
done

# ---- steady-state CPU over the sample window --------------------------------
cpu_total() { awk '/^cpu /{t=0; for(i=2;i<=NF;i++)t+=$i; print t, $5+$6}' /proc/stat; }   # total, idle+iowait
proc_ticks() { awk '{print $14+$15}' "/proc/$1/stat" 2>/dev/null || echo 0; }
declare -A t0
for pid in $(pgrep -f 'qemu-system-x86_64' || true); do t0[$pid]="$(proc_ticks "$pid")"; done
read -r tot0 idle0 < <(cpu_total)
sleep "${secs}"
read -r tot1 idle1 < <(cpu_total)
hz="$(getconf CLK_TCK)"
{
  echo "# source: /proc/stat (host), /proc/PID/stat fields 14+15 (per QEMU); window=${secs}s; CLK_TCK=${hz}"
  awk -v t0="${tot0}" -v t1="${tot1}" -v i0="${idle0}" -v i1="${idle1}" \
    'BEGIN{printf "host_cpu_busy_pct\t%.1f\n", 100*((t1-t0)-(i1-i0))/(t1-t0)}'
  for pid in "${!t0[@]}"; do
    t1p="$(proc_ticks "${pid}")"
    awk -v p="${pid}" -v a="${t0[$pid]}" -v b="${t1p}" -v hz="${hz}" -v s="${secs}" \
      'BEGIN{printf "qemu_pid_%s_cpu_pct_of_one_core\t%.1f\n", p, 100*(b-a)/hz/s}'
  done
} > "${out}/cpu.txt"

# ---- ops stack containers ----------------------------------------------------
{
  echo "# source: docker stats --no-stream"
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' 2>&1 || true
} > "${out}/docker.txt"

# ---- summary -----------------------------------------------------------------
{
  echo "label: ${label}"
  echo "qemu_processes: ${n}"
  echo "qemu_allocated_MiB_total: ${sum_alloc}"
  echo "qemu_rss_MiB_total: $(kib_to_mib "${sum_rss}")"
  echo "qemu_pss_MiB_total: $(kib_to_mib "${sum_pss}")"
  echo "host_MemTotal_MiB: $(kib_to_mib "$(awk '/^MemTotal:/{print $2}' /proc/meminfo)")"
  echo "host_MemAvailable_MiB: $(kib_to_mib "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)")"
  echo "host_Committed_AS_MiB: $(kib_to_mib "$(awk '/^Committed_AS:/{print $2}' /proc/meminfo)")"
  echo "host_cpu_busy_pct_${secs}s: $(awk '/host_cpu_busy_pct/{print $2}' "${out}/cpu.txt")"
} | tee "${out}/summary.txt"
echo "measure: wrote ${out}"
