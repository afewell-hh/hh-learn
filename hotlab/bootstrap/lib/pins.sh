#!/usr/bin/env bash
# Pinned artefacts. EVERY value below was copied from afewell-hh/labapp
# (build/provision/install-k3d.sh, install-kubectl.py, observability-inputs.yaml,
# README "Offline official hhfab configuration proof") and NOT re-fetched here
# (this authoring environment had no network/exec). Tag: S (sourced from labapp
# files), U (not re-verified against upstream by this change).

K3D_VERSION="v5.7.4"
K3D_URL="https://github.com/k3d-io/k3d/releases/download/${K3D_VERSION}/k3d-linux-amd64"
K3D_SHA256="1ac1da365236736a8df8c32107b54aca208384ab1d9a06771443c85ad698a5eb"

KUBECTL_VERSION="1.35.0"
KUBECTL_URL="https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
KUBECTL_SHA256="a2e984a18a0c063279d692533031c1eff93a262afcc0afdc517375432d060989"

HELM_VERSION="3.19.4"
HELM_URL="https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz"
HELM_ARCHIVE_SHA256="759c656fbd9c11e6a47784ecbeac6ad1eb16a9e76d202e51163ab78504848862"
HELM_MEMBER="linux-amd64/helm"
HELM_MEMBER_SHA256="ea22096683b9b61005584501e36168a1eadc5b6883a89df299f5a55e4e2dd283"

# hhfab 0.43.1 (the labapp-observed lane). 0.50.4 deliberately not pinned here.
HHFAB_0_43_1_URL="https://github.com/githedgehog/fabricator/releases/download/v0.43.1/hhfab-linux-amd64-v0.43.1.tar.gz"
HHFAB_0_43_1_ARCHIVE_SHA256="b1387342191a329772c2595504ec6ff129eb45980727c1c86d9901ef4d9f37a4"
HHFAB_MEMBER="hhfab-linux-amd64/hhfab"
HHFAB_0_43_1_MEMBER_SHA256="b5c7e0265339b9b95fa1073967bfb6c6fede6086755c85eca24cb80637b04e37"

KPS_CHART_VERSION="65.2.0"   # kube-prometheus-stack, labapp observability-inputs.yaml
KPS_REPO="https://prometheus-community.github.io/helm-charts"
ARGOCD_REPO="https://argoproj.github.io/argo-helm"
GITEA_REPO="https://dl.gitea.com/charts/"
