---
title: "Accessing the Hedgehog Virtual AI Data Center (vAIDC)"
slug: "accessing-the-hedgehog-virtual-ai-data-center"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.0.0"
validated_on: "2026-02-19"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - vaidc
  - gcp
  - onboarding
  - lab
description: "Deploy and connect to the Hedgehog Virtual AI Data Center (vAIDC) — the pre-configured GCP lab environment used for all Network Like a Hyperscaler hands-on exercises."
order: 100
---

# Accessing the Hedgehog Virtual AI Data Center (vAIDC)

**Duration:** 20 minutes
**Prerequisites:** A Google Cloud account with an active project and billing enabled

---

## Introduction

The **Hedgehog Virtual AI Data Center (vAIDC)** is a pre-configured Google Cloud VM image that contains everything you need to complete the hands-on lab exercises in the Network Like a Hyperscaler pathway. Rather than installing software yourself, you launch the vAIDC image and get a fully functional Hedgehog fabric environment — switches, control plane, observability stack, and all — ready in minutes.

### What's Included in the vAIDC

The vAIDC image comes pre-loaded with:

- A running Hedgehog VLAB (virtual fabric with spine/leaf switches and servers)
- **Grafana** — fabric observability dashboards
- **Gitea** — Git server for lab configuration files
- **ArgoCD** — GitOps controller
- **Prometheus** — metrics collection

All services start automatically when the VM boots. You access them through your browser using the VM's public IP address.

### Why a Pre-Built Image?

The Network Like a Hyperscaler pathway focuses on **operating** a fabric, not installing one. The vAIDC eliminates setup friction so you can spend your time learning fabric operations — provisioning VPCs, monitoring health, troubleshooting issues — rather than configuring infrastructure.

---

## Prerequisites

Before you can launch your vAIDC, you need:

1. **Google Cloud Account** — Sign up at [https://cloud.google.com](https://cloud.google.com) (free trial available)
2. **GCP Project with Billing Enabled** — Create a project and enable billing in the GCP Console
3. **gcloud CLI** — Install from [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install), or use Google Cloud Shell (no install needed)

### Quota Requirements

The vAIDC requires an **n1-standard-32** instance (32 vCPUs, 120 GB RAM). You may need to request a quota increase for your project:

- GCP Console → IAM & Admin → Quotas → search "CPUs" for your target region
- The default quota for new projects is often 8–24 vCPUs; request an increase if needed

**Recommended region:** `us-west1` (Oregon) — the vAIDC image is hosted in the `teched-473722` project and deploys fastest from this region. Alternative: `us-central1` if `us-west1` has availability issues.

---

## Option A: Deploy Using Scripts (Recommended)

We provide a set of simple scripts to manage your vAIDC lifecycle. This is the easiest approach.

### Step 1: Clone the Lab Repository

```bash
git clone https://github.com/afewell-hh/labapp.git
cd labapp
```

### Step 2: Deploy the vAIDC

Replace `YOUR_PROJECT_ID` with your actual GCP project ID:

```bash
./deploy-lab.sh YOUR_PROJECT_ID
```

The script will:
1. Configure your GCP project
2. Enable required APIs
3. Create the VM from the vAIDC image
4. Configure firewall rules to allow access to lab services
5. Display the VM's IP address and service URLs when complete

**Deployment takes 2–5 minutes.** Services will be fully ready within 5–10 minutes of VM startup.

### Managing Your Lab (Stop, Start, Delete)

Use these scripts to control your vAIDC:

| Script | Purpose |
|--------|---------|
| `./stop-lab.sh YOUR_PROJECT_ID` | Pause the VM to save costs (data is preserved) |
| `./start-lab.sh YOUR_PROJECT_ID` | Resume a stopped VM |
| `./cleanup-lab.sh YOUR_PROJECT_ID` | Delete everything when you're completely done |

**Always stop your lab when not actively using it.** See the Cost Management section below.

---

## Option B: One-Click Deploy via Cloud Shell

If you don't have the gcloud CLI installed locally, use Google Cloud Shell:

1. Click the button below to open Cloud Shell with the lab repository:

   [![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/afewell-hh/labapp&cloudshell_open_in_editor=STUDENT_QUICK_START.md)

2. In Cloud Shell, run:

   ```bash
   ./deploy-lab.sh YOUR_PROJECT_ID
   ```

Cloud Shell is free, pre-authenticated with your Google account, and has gcloud pre-installed.

---

## Option C: Manual Deployment

If you prefer to run each step individually (or for troubleshooting):

### Step 1: Set Your Project

```bash
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Enable Required APIs

```bash
gcloud services enable compute.googleapis.com
```

### Step 3: Create the VM

```bash
gcloud compute instances create hedgehog-lab \
  --zone=us-west1-c \
  --machine-type=n1-standard-32 \
  --image=hedgehog-vaidc-v20260114 \
  --image-project=teched-473722 \
  --boot-disk-size=300GB \
  --boot-disk-type=pd-balanced \
  --enable-nested-virtualization \
  --min-cpu-platform="Intel Cascade Lake" \
  --tags=http-server,https-server
```

### Step 4: Create Firewall Rules

```bash
gcloud compute firewall-rules create allow-vaidc-services \
  --allow=tcp:80,tcp:443,tcp:3000,tcp:3001,tcp:8080,tcp:9090 \
  --target-tags=http-server,https-server \
  --description="Allow access to Hedgehog vAIDC services"
```

### Step 5: Get Your VM's IP Address

```bash
gcloud compute instances describe hedgehog-lab \
  --zone=us-west1-c \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

---

## Accessing Lab Services

After your VM is running (allow 5–10 minutes for all services to initialize):

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| **Grafana** | `http://YOUR_VM_IP:3000` | admin / admin |
| **Gitea** | `http://YOUR_VM_IP:3001` | student01 / hedgehog123 |
| **ArgoCD** | `http://YOUR_VM_IP:8080` | admin / (see below) |
| **Prometheus** | `http://YOUR_VM_IP:9090` | No login required |

Replace `YOUR_VM_IP` with the IP address shown after deployment.

> **Security Note:** These services are exposed over public IP addresses. For personal lab use, this is acceptable for short durations. When you're not actively working on labs, stop the VM to reduce both costs and exposure. Never use default credentials for anything containing sensitive data.

### Get the ArgoCD Admin Password

```bash
gcloud compute ssh hedgehog-lab --zone=us-west1-c --command="kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d && echo"
```

---

## Connecting to the VM

### SSH Access

```bash
gcloud compute ssh hedgehog-lab --zone=us-west1-c
```

Once connected, you can run `kubectl` commands against the Hedgehog control plane:

```bash
# Verify kubectl access
kubectl cluster-info

# Check the fabric namespace
kubectl get pods -n fab
```

### Desktop Access (RDP)

If you prefer a graphical desktop interface:

- **Address:** `YOUR_VM_IP:3389`
- **Username:** `ubuntu`
- **Password:** `HHLab.Admin!`

### Check Lab Status (After SSH)

```bash
# Check VLAB status
cd ~/hhfab && hhfab vlab inspect

# View running containers
docker ps

# Check Kubernetes pods
kubectl get pods -A
```

---

## Cost Management

The n1-standard-32 instance is a powerful machine with meaningful costs. Manage them carefully:

| Resource | Estimated Cost |
|----------|----------------|
| VM running (n1-standard-32) | ~$1.10/hour |
| VM stopped (disk storage only) | ~$51/month |
| VM deleted | $0 |

### Best Practices

- **Stop the VM whenever you're not actively working** — `./stop-lab.sh YOUR_PROJECT_ID`
- **Resume when you return** — `./start-lab.sh YOUR_PROJECT_ID`
- **Delete when completely done** — `./cleanup-lab.sh YOUR_PROJECT_ID`

Stopping vs. deleting: stopping preserves your VM state (kubectl context, any changes you made) and only charges for disk storage. Deleting removes everything. For a multi-week course, stop between sessions; delete when you've finished the pathway.

---

## Troubleshooting

### VM Won't Start / Quota Error

Your project may not have sufficient vCPU quota for an n1-standard-32 instance.

1. Go to GCP Console → IAM & Admin → Quotas
2. Filter by "CPUs" for your region
3. Request a quota increase (usually approved within minutes for modest requests)
4. Try an alternative zone: `./deploy-lab.sh YOUR_PROJECT_ID us-central1-a`

### Services Not Accessible After 10 Minutes

- Verify firewall rules exist: `gcloud compute firewall-rules list | grep vaidc`
- Check the VM has an external IP: `gcloud compute instances list`
- SSH into the VM and check service status: `docker ps`

### SSH Connection Issues

- Ensure you're authenticated: `gcloud auth login`
- Try Cloud Console SSH: Console → Compute Engine → VM instances → SSH button
- Try IAP tunneling: `gcloud compute ssh hedgehog-lab --zone=us-west1-c --tunnel-through-iap`

### Script Permission Denied

```bash
chmod +x deploy-lab.sh stop-lab.sh start-lab.sh cleanup-lab.sh
```

---

## Wrap-Up

You now have a fully functional Hedgehog Virtual AI Data Center running. Here's what you have:

- ✅ A Hedgehog VLAB with spine/leaf switches and servers
- ✅ kubectl configured and pointing at the Hedgehog control plane
- ✅ Grafana, Gitea, ArgoCD, and Prometheus all accessible via browser
- ✅ Scripts to start, stop, and clean up your lab

**Keep this module bookmarked.** You'll refer back to it throughout the Network Like a Hyperscaler pathway — especially the service access table and the start/stop scripts.

---

## Resources

- [Hedgehog Documentation](https://docs.hedgehog.cloud)
- [Lab Repository (scripts)](https://github.com/afewell-hh/labapp)
- [Google Cloud SDK Installation](https://cloud.google.com/sdk/docs/install)
- [GCP Quota Management](https://cloud.google.com/docs/quota)
- [Course Materials](https://hedgehog.cloud/learn)
