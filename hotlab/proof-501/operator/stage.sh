#!/usr/bin/env bash
# Operator workstation. Copies hotlab/bootstrap (PR #512, called not duplicated), this
# proof directory, your filled proof.env/bootstrap.env and the wiring checkout to the VM
# over IAP + OS Login, then prints the guest commands. It does not create or modify any
# cloud resource. Requires PR #512 and PR #509 content to be checked out locally.
#
# Usage: stage.sh INSTANCE ZONE BOOTSTRAP_ENV PROOF_ENV WIRING_DIR
set -euo pipefail
inst="${1:?instance (hotlab-<runid>-<attempt>)}"; zone="${2:?zone}"
benv="${3:?bootstrap.env}"; penv="${4:?proof.env}"; wiring="${5:?lab-wiring/ai-factory-26.05 dir}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "${here}/../../.." && pwd)"
[[ "$inst" =~ ^hotlab-[a-z0-9-]+$ ]] || { echo "refusing non-hotlab instance name" >&2; exit 2; }
[[ -d "${repo}/hotlab/bootstrap" ]] || { echo "hotlab/bootstrap missing: PR #512 is not in this checkout" >&2; exit 2; }
[[ -d "$wiring" ]] || { echo "wiring dir not found: $wiring" >&2; exit 2; }
grep -q 'HOTLAB_ENABLE_OPS=0' "$benv" && grep -q 'HOTLAB_ENABLE_VLAB=0' "$benv" || {
  echo "bootstrap.env must set HOTLAB_ENABLE_OPS=0 and HOTLAB_ENABLE_VLAB=0 (the proof drives hhfab itself; see README)" >&2; exit 2; }

stage="$(mktemp -d)"; trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/hotlab"
cp -r "${repo}/hotlab/bootstrap" "${repo}/hotlab/proof-501" "$stage/hotlab/"
cp -r "$wiring" "$stage/wiring"
cp "$benv" "$stage/bootstrap.env"; cp "$penv" "$stage/proof.env"
tar -C "$stage" -czf "$stage.tgz" .
trap 'rm -rf "$stage" "$stage.tgz"' EXIT

gcloud compute scp --tunnel-through-iap --zone "$zone" "$stage.tgz" "${inst}:/tmp/proof501.tgz"
cat <<EOF

Staged. On the VM (gcloud compute ssh --tunnel-through-iap --zone ${zone} ${inst}):
  mkdir -p ~/p501 && tar -C ~/p501 -xzf /tmp/proof501.tgz
  sudo install -d -m 0755 /etc/hotlab && sudo install -m 0600 ~/p501/bootstrap.env /etc/hotlab/bootstrap.env
  sudo bash ~/p501/hotlab/bootstrap/bootstrap.sh          # docker, qemu, jq, tmux, hotlab user
  See hotlab/proof-501/README.md section 4 for the remaining steps.
EOF
