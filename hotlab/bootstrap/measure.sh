#!/usr/bin/env bash
# Sizing measurement harness (issue #510). Read-only. Run as root ON the running Hot Lab
# host, after VLAB has converged (run verify.sh first). Produces MEASURED figures only.
#
# Usage: measure.sh LABEL [CPU_SAMPLE_SECONDS=60]
#   e.g. measure.sh converged 60 ; measure.sh idle-30min 300
# Loads the same contract file as bootstrap.sh (HOTLAB_ENV_FILE, default /etc/hotlab/bootstrap.env)
# so it measures THIS lab's QEMUs (cwd/cmdline under HOTLAB_VLAB_DIR), not other QEMUs on the host.
# Output dir: ${HOTLAB_STATE_DIR}/measure/<UTC timestamp>-<LABEL>/
#   host.txt    /proc/meminfo excerpt, committed vs resident, swap, nproc, kernel, KSM/THP state
#   qemu.tsv    one row per lab QEMU: pid, name, allocated_MiB(-m), Rss_MiB, Pss_MiB, Swap_MiB
#   cpu.txt     host CPU busy % over the window; per-QEMU CPU % for processes present throughout
#   docker.txt  `docker stats --no-stream` for the k3d cluster containers
#   summary.txt totals. Exit status is non-zero if ANY measurement failed or was unstable.
# Producing commands are echoed into each file header.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
. "${HERE}/lib/common.sh"
require_root
load_config
label="${1:?usage: measure.sh LABEL [SECONDS]}"
secs="${2:-60}"
is_uint "${secs}" && [[ "${secs}" -gt 0 ]] || die "SECONDS must be a positive integer"
[[ "${label}" =~ ^[A-Za-z0-9._-]+$ ]] || die "LABEL must match [A-Za-z0-9._-]+"
out="${HOTLAB_STATE_DIR}/measure/$(date -u +%Y%m%dT%H%M%SZ)-${label}"
mkdir -p "${out}"
problems=()

kib_to_mib() { awk -v k="$1" 'BEGIN{printf "%.1f", k/1024}'; }

# ---- host memory: committed vs resident -------------------------------------
{
  echo "# source: /proc/meminfo, nproc, uname -r, /sys/kernel/mm/{ksm/run,transparent_hugepage/enabled}"
  grep -E '^(MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree|CommitLimit|Committed_AS|AnonPages|Shmem):' /proc/meminfo
  echo "nproc: $(nproc)"
  echo "kernel: $(uname -r)"
  echo "ksm_run: $(cat /sys/kernel/mm/ksm/run 2>/dev/null || echo n/a)"
  echo "thp_enabled: $(cat /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || echo n/a)"
} > "${out}/host.txt"

# ---- per-QEMU RSS / PSS (lab QEMUs only) ------------------------------------
{
  echo "# source: /proc/PID/exe (qemu-system-*), cwd/cmdline under ${HOTLAB_VLAB_DIR}; /proc/PID/cmdline (-name, -m); /proc/PID/smaps_rollup (Rss, Pss, Swap)"
  printf 'pid\tname\talloc_MiB\trss_MiB\tpss_MiB\tswap_MiB\n'
} > "${out}/qemu.tsv"
sum_alloc=0; sum_rss=0; sum_pss=0; n=0
mapfile -t pids0 < <(hotlab_qemu_pids)
for pid in "${pids0[@]}"; do
  [[ -r "/proc/${pid}/smaps_rollup" ]] || { problems+=("pid ${pid}: smaps_rollup unreadable/exited"); continue; }
  name="$(qemu_vm_name "${pid}")"
  mem="$(tr '\0' '\n' < "/proc/${pid}/cmdline" 2>/dev/null | awk '$0=="-m"{getline; print; exit}')"   # 6144, 6G, 6144M, or size=..,slots=..
  mem="${mem%%,*}"; mem="${mem#size=}"
  case "${mem}" in
    *[Gg]) alloc=$(( ${mem%[Gg]} * 1024 )) ;;
    *[Mm]) alloc="${mem%[Mm]}" ;;
    ''|*[!0-9]*) alloc=0; problems+=("pid ${pid}: could not parse -m '${mem}'") ;;
    *) alloc="${mem}" ;;
  esac
  rollup="$(cat "/proc/${pid}/smaps_rollup" 2>/dev/null)" || { problems+=("pid ${pid}: exited during read"); continue; }
  rss="$(awk '/^Rss:/{print $2}' <<<"${rollup}")"; pss="$(awk '/^Pss:/{print $2}' <<<"${rollup}")"; swp="$(awk '/^Swap:/{print $2}' <<<"${rollup}")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "${pid}" "${name:-?}" "${alloc}" "$(kib_to_mib "${rss}")" "$(kib_to_mib "${pss}")" "$(kib_to_mib "${swp}")" >> "${out}/qemu.tsv"
  sum_alloc=$((sum_alloc + alloc)); sum_rss=$((sum_rss + rss)); sum_pss=$((sum_pss + pss)); n=$((n + 1))
done
[[ "${n}" -gt 0 ]] || problems+=("no lab QEMU processes found under ${HOTLAB_VLAB_DIR}")

# ---- steady-state CPU over the sample window --------------------------------
# Host: /proc/stat 'user' already INCLUDES guest and 'nice' includes guest_nice, so total =
# fields 2..9 (user nice system idle iowait irq softirq steal) and guest/guest_nice (10,11)
# are NOT added again. busy = total - idle - iowait - steal.
cpu_host() { awk '/^cpu /{t=0; for(i=2;i<=9;i++)t+=$i; print t, $5+$6+$9}' /proc/stat; }
# Per-process: utime+stime (utime includes guest time) and starttime (field 22) to detect PID reuse.
# comm may contain spaces/parens, so strip through the LAST ')' first.
proc_cpu() { # prints "ticks starttime" or fails
  local s; s="$(cat "/proc/$1/stat" 2>/dev/null)" || return 1
  s="${s##*) }"
  awk '{print $12+$13, $20}' <<<"${s}"
}
declare -A tk0 st0
for pid in "${pids0[@]}"; do
  if read -r a b < <(proc_cpu "${pid}"); then tk0[$pid]="${a}"; st0[$pid]="${b}"; fi
done
read -r tot0 idle0 < <(cpu_host)
sleep "${secs}"
read -r tot1 idle1 < <(cpu_host)
mapfile -t pids1 < <(hotlab_qemu_pids)
hz="$(getconf CLK_TCK)"
{
  echo "# source: /proc/stat (host; fields 2..9, guest excluded to avoid double counting), /proc/PID/stat utime+stime (fields 14+15; starttime 22 guards PID reuse); window=${secs}s; CLK_TCK=${hz}"
  awk -v t0="${tot0}" -v t1="${tot1}" -v i0="${idle0}" -v i1="${idle1}" \
    'BEGIN{d=t1-t0; if(d<=0){print "host_cpu_busy_pct\tNA"} else {printf "host_cpu_busy_pct\t%.1f\n", 100*((t1-t0)-(i1-i0))/d}}'
  for pid in "${!tk0[@]}"; do
    if read -r b sb < <(proc_cpu "${pid}") && [[ "${sb}" == "${st0[$pid]}" ]]; then
      awk -v p="${pid}" -v a="${tk0[$pid]}" -v b="${b}" -v hz="${hz}" -v s="${secs}" \
        'BEGIN{d=b-a; if(d<0)d=0; printf "qemu_pid_%s_cpu_pct_of_one_core\t%.1f\n", p, 100*d/hz/s}'
    else
      echo "qemu_pid_${pid}_cpu_pct_of_one_core	EXITED_DURING_WINDOW"
      problems+=("pid ${pid} exited/changed during CPU window")
    fi
  done
  for pid in "${pids1[@]}"; do
    [[ -n "${tk0[$pid]+x}" ]] || { echo "qemu_pid_${pid}_cpu_pct_of_one_core	NEW_DURING_WINDOW"; problems+=("pid ${pid} appeared during CPU window"); }
  done
} > "${out}/cpu.txt"

# ---- ops stack containers ----------------------------------------------------
docker_rc=0
{
  echo "# source: docker ps --filter name=k3d-${HOTLAB_K3D_CLUSTER} -q ; docker stats --no-stream <ids>"
  if [[ "${HOTLAB_ENABLE_OPS}" == "1" ]]; then
    ids="$(docker ps --filter "name=k3d-${HOTLAB_K3D_CLUSTER}" -q)" || docker_rc=$?
    if [[ "${docker_rc}" -eq 0 && -z "${ids}" ]]; then echo "ERROR: no running k3d containers for ${HOTLAB_K3D_CLUSTER}"; docker_rc=1; fi
    if [[ "${docker_rc}" -eq 0 ]]; then
      # shellcheck disable=SC2086
      docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' ${ids} || docker_rc=$?
    fi
  else
    echo "ops disabled; not measured"
  fi
} > "${out}/docker.txt" 2>&1
[[ "${docker_rc}" -eq 0 ]] || problems+=("docker measurement failed (rc=${docker_rc}); see docker.txt")

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
  echo "host_cpu_busy_pct_${secs}s: $(awk '/^host_cpu_busy_pct/{print $2}' "${out}/cpu.txt")"
  echo "measurement_problems: ${#problems[@]}"
  for p in "${problems[@]}"; do echo "  - ${p}"; done
} | tee "${out}/summary.txt"
echo "measure: wrote ${out}"
[[ "${#problems[@]}" -eq 0 ]] || { echo "measure: INCOMPLETE/UNSTABLE; do not use these numbers for sizing" >&2; exit 1; }
