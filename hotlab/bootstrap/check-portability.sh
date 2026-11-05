#!/usr/bin/env bash
# Static guard for the hard rule: no provider-specific commands in the guest path.
# Called by bootstrap.sh preflight (before any change) and runnable in CI.
#
# Exit codes:  0 = clean   1 = provider reference found   2 = the scan itself failed
# (grep error, unreadable tree, no files scanned). A scan error is NEVER treated as clean.
#
# Scans every file under the bootstrap tree except this script and *.md docs (docs must be
# free to name providers). Whitespace between words matches tabs as well as spaces.
#   check-portability.sh              scan the tree this script lives in
#   check-portability.sh --self-test  prove the guard fails on a hit and on a scan error
set -uo pipefail

S='[[:space:]]+'
PATTERN="\
g""cloud|g""sutil|\
metadata\\.google|computeMetadata|metadata\\.azure|169\\.254\\.169\\.254|169\\.254\\.170\\.2|\
googleapis|google-guest-agent|google-osconfig-agent|google-compute-engine|\
azure-cli|walinuxagent|waagent|aws-cli|awscli|amazon-ssm-agent|ec2-metadata|\
\\bIMDS|\
\\baz${S}(vm|network|group|account|login|storage)|\
\\baws${S}(ec2|s3|ssm|sts|iam|configure)|\
\\boci${S}(compute|os)|\\bdoctl\\b|\
\\bqm${S}(create|start|stop|clone|set|importdisk|template)|\\bpvesh\\b|\\bpct${S}(create|start)"

scan() { # scan DIR — prints hits; returns 0 clean, 1 hit, 2 error
  local dir="$1" rc nfiles
  [[ -d "${dir}" && -r "${dir}" ]] || { echo "check-portability: cannot read ${dir}" >&2; return 2; }
  nfiles="$(find "${dir}" -type f ! -name check-portability.sh ! -name '*.md' | wc -l)"
  [[ "${nfiles}" -gt 0 ]] || { echo "check-portability: no files to scan under ${dir}" >&2; return 2; }
  grep -rEniI --exclude=check-portability.sh --exclude='*.md' -e "${PATTERN}" -- "${dir}"
  rc=$?
  case "${rc}" in
    0) return 1 ;;   # grep found matches
    1) return 0 ;;   # grep found none
    *) echo "check-portability: grep failed (rc=${rc})" >&2; return 2 ;;
  esac
}

if [[ "${1:-}" == "--self-test" ]]; then
  t="$(mktemp -d)"; trap 'rm -rf "${t}"' EXIT
  printf 'echo ok\n' > "${t}/clean.sh"
  scan "${t}" >/dev/null 2>&1; [[ $? -eq 0 ]] || { echo "self-test FAIL: clean tree not clean"; exit 1; }
  printf 'x\taws\ts3 ls\n' > "${t}/dirty.sh"
  scan "${t}" >/dev/null 2>&1; [[ $? -eq 1 ]] || { echo "self-test FAIL: tab-separated 'aws s3' not caught"; exit 1; }
  scan "${t}/does-not-exist" >/dev/null 2>&1; [[ $? -eq 2 ]] || { echo "self-test FAIL: scan error not reported as 2"; exit 1; }
  echo "check-portability: self-test OK"; exit 0
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scan "${HERE}"; rc=$?
case "${rc}" in
  0) echo "check-portability: OK" ;;
  1) echo "check-portability: FAIL (provider-specific reference above)" >&2; exit 1 ;;
  *) echo "check-portability: ERROR (scan did not complete; treating as failure)" >&2; exit 2 ;;
esac
