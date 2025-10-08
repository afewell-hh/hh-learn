---
title: "Accessing the Hedgehog Virtual Lab with Google Cloud"
slug: "accessing-the-hedgehog-virtual-lab-with-google-cloud"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0"
validated_on: "2025-10-08"
pathway_slug: "getting-started"
pathway_name: "Getting Started"
tags: [hedgehog, virtual-lab, gcp, onboarding, access]
description: "Create and configure a Google Cloud VM suitable for running the Hedgehog Virtual Lab so you can begin hands-on learning with Hedgehog Fabric."
order: 10

# Agent-ready maintenance (optional but recommended)
products:
  - name: hedgehog-virtual-lab
    repo: hedgehog-cloud/virtual-lab
    min_version: 1.0.0
scenarios:
  - id: gcp-vm-setup
    title: "Create a GCP VM for the Hedgehog Virtual Lab"
    persona: "Platform learner"
    environment: "Google Cloud SDK (gcloud) installed; GCP project with compute permissions"
    steps:
      - id: verify-sdk
        goal: "Confirm Google Cloud SDK is installed"
        commands:
          - gcloud --version
        validate:
          - gcloud --version | grep -i "Google Cloud SDK"
      - id: authenticate
        goal: "Authenticate to your Google Cloud account"
        commands:
          - gcloud auth login
        validate:
          - test -n "$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
      - id: create-vm
        goal: "Create a VM with nested virtualization enabled"
        commands:
          - gcloud compute instances create hedgehog-vlab --project=YOUR_PROJECT_ID --zone=YOUR_ZONE --machine-type=n2-standard-32 --enable-nested-virtualization --network-interface=network-tier=PREMIUM,stack-type=IPV4_ONLY,subnet=default --maintenance-policy=MIGRATE --provisioning-model=STANDARD --create-disk=auto-delete=yes,boot=yes,image=projects/ubuntu-os-cloud/global/images/ubuntu-minimal-2404-noble-amd64-v20250930,mode=rw,size=200,type=pd-balanced --threads-per-core=2 --visible-core-count=16
        validate:
          - gcloud compute instances describe hedgehog-vlab --zone=YOUR_ZONE --format="value(status)" | grep RUNNING
ai_hints:
  environment: "local"
  retries: 1
---

# Accessing the Hedgehog Virtual Lab with Google Cloud

Welcome! This guide will help you create a Google Cloud virtual machine that's ready to run the Hedgehog Virtual Lab. We'll walk through each step to get you up and running quickly, and we'll make sure you understand what's happening along the way.

## What You'll Learn
- Understand the VM requirements for running Hedgehog VLAB
- Create a properly configured Google Cloud VM with nested virtualization
- Connect to your VM and prepare for VLAB installation

## Prerequisites
- A Google Cloud account with an active project
- Google Cloud SDK (gcloud) installed on your local machine
- Basic familiarity with command-line tools

**Need to install gcloud?** Visit the [Google Cloud SDK installation guide](https://cloud.google.com/sdk/docs/install).

## Understanding the Requirements

The Hedgehog Virtual Lab creates a complete virtual network fabric using multiple virtual machines to simulate switches, servers, and a control node. While Hedgehog's control software is lightweight, the lab uses Broadcom SONiC Virtual Switch VMs, which require substantial resources.

### Recommended VM Size
We recommend the **n2-standard-32** machine type for the default VLAB topology. This provides:
- 32 vCPUs (16 physical cores with 2 threads each)
- 128 GB RAM
- Nested virtualization support

**Note:** This is slightly below the official [VLAB documentation requirements](https://docs.hedgehog.cloud/latest/vlab/overview/) (which are based on conservative SONiC virtual switch recommendations), but works well in practice for learning and testing. If you plan to run larger topologies or need guaranteed performance, consider a larger instance.

**Important:** We make no performance guarantees for the VLAB environment—different use cases may require different VM sizes. The VLAB is designed for learning and testing, not production workloads.

## Step 1: Set Up Your Google Cloud Environment

First, let's make sure you're authenticated and ready to create resources.

### Verify gcloud Installation

```bash
gcloud --version
```

You should see output showing the Google Cloud SDK version. If not, please install the SDK first.

### Authenticate to Google Cloud

```bash
gcloud auth login
```

This will open your browser for authentication. Follow the prompts to sign in.

### Set Your Project and Preferred Zone

Replace `YOUR_PROJECT_ID` with your actual GCP project ID, and choose a zone close to you:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud config set compute/zone us-west1-c
```

**Tip:** You can list available zones with `gcloud compute zones list`.

## Step 2: Create Your VLAB Virtual Machine

Now we'll create a VM configured specifically for running the Hedgehog Virtual Lab. The command below looks long, but we'll break down what it does.

### The Command

```bash
gcloud compute instances create hedgehog-vlab \
  --project=YOUR_PROJECT_ID \
  --zone=us-west1-c \
  --machine-type=n2-standard-32 \
  --enable-nested-virtualization \
  --network-interface=network-tier=PREMIUM,stack-type=IPV4_ONLY,subnet=default \
  --maintenance-policy=MIGRATE \
  --provisioning-model=STANDARD \
  --create-disk=auto-delete=yes,boot=yes,image=projects/ubuntu-os-cloud/global/images/ubuntu-minimal-2404-noble-amd64-v20250930,mode=rw,size=200,type=pd-balanced \
  --threads-per-core=2 \
  --visible-core-count=16
```

### What This Command Does

Let's break down the key flags:

- **`--machine-type=n2-standard-32`**: Creates a VM with 32 vCPUs and 128GB RAM
- **`--enable-nested-virtualization`**: Critical! Allows the VM to run other VMs inside it (required for VLAB). This flag can **only** be set from the command line.
- **`--image=...ubuntu-minimal-2404...`**: Uses Ubuntu 24.04 LTS, which is tested and recommended for VLAB
- **`--create-disk=...size=200...`**: Creates a 200GB disk (VLAB needs substantial disk space for all the virtual switches and servers)
- **`--threads-per-core=2 --visible-core-count=16`**: Configures 16 physical cores with hyperthreading enabled

**Prefer using the GUI?** You can configure most of these settings in the Google Cloud Console, then click "EQUIVALENT COMMAND LINE" at the bottom of the VM creation form to get the gcloud command. Just make sure to add the `--enable-nested-virtualization` flag—it's only available via the command line!

### Customize for Your Environment

Before running the command, replace:
- `YOUR_PROJECT_ID` with your GCP project ID
- `us-west1-c` with your preferred zone (if different)
- `hedgehog-vlab` with a different name if you prefer

### Run the Command

Copy the command with your values and run it. It will take a couple of minutes to create and start your VM.

You should see output indicating the VM was created successfully and is now running.

## Step 3: Connect to Your VM

Once your VM is running, connect via SSH:

```bash
gcloud compute ssh hedgehog-vlab --zone=us-west1-c
```

This will open an SSH connection to your new VM. You should see an Ubuntu welcome message and a command prompt.

## Next Steps: Installing the VLAB

Congratulations! You now have a VM ready for the Hedgehog Virtual Lab. The installation process from here is identical regardless of whether you're running on Google Cloud, AWS, Azure, or bare metal.

### What Comes Next

You'll need to:
1. Install Docker, QEMU/KVM, and other prerequisites
2. Install the `hhfab` utility
3. Initialize and run the VLAB
4. Access the control node and switches

All of these steps are covered in detail in the [VLAB Overview documentation](https://docs.hedgehog.cloud/latest/vlab/overview/) starting at the **"Installing Prerequisites"** section.

**Look for our companion module:** We're creating a separate "Setting up the VLAB" module that will walk through the installation steps in the same friendly format as this guide—stay tuned!

## Troubleshooting

### "gcloud: command not found"
Install the Google Cloud SDK following the [official installation guide](https://cloud.google.com/sdk/docs/install).

### Authentication Issues
Make sure you're logged in with `gcloud auth login` and your account has the necessary permissions to create compute instances in your project.

### VM Creation Fails
- **Quota issues**: Your project may not have enough quota for a 32-vCPU instance. Check your quotas in the GCP Console under IAM & Admin → Quotas.
- **Zone availability**: Try a different zone if the machine type isn't available in your selected zone.

### Can't SSH to the VM
- Wait a minute or two after creation for SSH keys to propagate
- Check that your firewall rules allow SSH (port 22)
- Try `gcloud compute ssh hedgehog-vlab --zone=YOUR_ZONE --tunnel-through-iap` if direct SSH isn't working

## Cost Considerations

The n2-standard-32 instance is a substantial VM and will incur meaningful costs if left running. Here are some tips:

- **Stop when not in use**: `gcloud compute instances stop hedgehog-vlab --zone=YOUR_ZONE`
- **Start when needed**: `gcloud compute instances start hedgehog-vlab --zone=YOUR_ZONE`
- **Delete when done**: `gcloud compute instances delete hedgehog-vlab --zone=YOUR_ZONE`

Even when stopped, you'll be charged for disk storage, but it's much less than the running VM cost.

## Resources

- [Hedgehog VLAB Documentation](https://docs.hedgehog.cloud/latest/vlab/overview/)
- [Google Cloud SDK Documentation](https://cloud.google.com/sdk/docs)
- [GCP Nested Virtualization Guide](https://cloud.google.com/compute/docs/instances/nested-virtualization/overview)
- [GCP VM Instance Pricing](https://cloud.google.com/compute/vm-instance-pricing)

---

**Ready to continue?** Once you've completed the VLAB installation steps from the [official documentation](https://docs.hedgehog.cloud/latest/vlab/overview/), you'll have a complete Hedgehog Fabric environment to explore and learn!

