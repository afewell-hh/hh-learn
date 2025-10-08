---
title: "Accessing the Hedgehog Virtual Lab with Microsoft Azure"
slug: "accessing-the-hedgehog-virtual-lab-with-microsoft-azure"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0"
validated_on: "2025-10-08"
pathway_slug: "getting-started"
pathway_name: "Getting Started"
tags: [hedgehog, virtual-lab, azure, onboarding, access]
description: "Create and configure a Microsoft Azure VM suitable for running the Hedgehog Virtual Lab so you can begin hands-on learning with Hedgehog Fabric."
order: 12

# Agent-ready maintenance (optional but recommended)
products:
  - name: hedgehog-virtual-lab
    repo: hedgehog-cloud/virtual-lab
    min_version: 1.0.0
scenarios:
  - id: azure-vm-setup
    title: "Create an Azure VM for the Hedgehog Virtual Lab"
    persona: "Platform learner"
    environment: "Azure CLI (az) installed; Azure subscription with compute permissions"
    steps:
      - id: verify-cli
        goal: "Confirm Azure CLI is installed"
        commands:
          - az version
        validate:
          - az version | jq -e 'has("azure-cli")'
      - id: sign-in
        goal: "Sign in to Azure"
        commands:
          - az login
        validate:
          - test -n "$(az account show --query id -o tsv 2>/dev/null || true)"
      - id: create-resource-group
        goal: "Create a resource group for VLAB resources"
        commands:
          - az group create --name hedgehog-vlab-rg --location westus2
        validate:
          - az group show --name hedgehog-vlab-rg --query provisioningState -o tsv | grep Succeeded
      - id: create-vm
        goal: "Create a VM with nested virtualization support"
        commands:
          - az vm create --resource-group hedgehog-vlab-rg --name hedgehog-vlab --location westus2 --size Standard_D32s_v3 --image Canonical:ubuntu-24_04-lts:server:latest --admin-username ubuntu --generate-ssh-keys --os-disk-size-gb 200 --security-type Standard
        validate:
          - az vm show --resource-group hedgehog-vlab-rg --name hedgehog-vlab --query provisioningState -o tsv | grep Succeeded
ai_hints:
  environment: "local"
  retries: 1
---

# Accessing the Hedgehog Virtual Lab with Microsoft Azure

Welcome! This guide will help you create a Microsoft Azure virtual machine that's ready to run the Hedgehog Virtual Lab. We'll walk through each step to get you up and running quickly, and we'll make sure you understand what's happening along the way.

## What You'll Learn
- Understand the VM requirements for running Hedgehog VLAB
- Create a properly configured Azure VM with nested virtualization support
- Connect to your VM and prepare for VLAB installation

## Prerequisites
- A Microsoft Azure account with an active subscription
- Azure CLI (az) installed on your local machine
- Basic familiarity with command-line tools

**Need to install Azure CLI?** Visit the [Azure CLI installation guide](https://learn.microsoft.com/cli/azure/install-azure-cli).

## Understanding the Requirements

The Hedgehog Virtual Lab creates a complete virtual network fabric using multiple virtual machines to simulate switches, servers, and a control node. While Hedgehog's control software is lightweight, the lab uses Broadcom SONiC Virtual Switch VMs, which require substantial resources.

### Recommended VM Size
We recommend the **Standard_D32s_v3** VM size for the default VLAB topology. This provides:
- 32 vCPUs
- 128 GB RAM
- Support for nested virtualization (critical for VLAB)
- Premium SSD storage support

**Note:** This is slightly below the official [VLAB documentation requirements](https://docs.hedgehog.cloud/latest/vlab/overview/) (which are based on conservative SONiC virtual switch recommendations), but works well in practice for learning and testing. If you plan to run larger topologies or need guaranteed performance, consider a larger instance.

**Important:** We make no performance guarantees for the VLAB environment—different use cases may require different VM sizes. The VLAB is designed for learning and testing, not production workloads.

### Why Standard_D32s_v3?
Azure supports nested virtualization on specific VM series including Dv3, Dv4, Dv5, Ev3, Ev4, Ev5, and Fsv2 series. The D32s_v3 offers the right balance of compute, memory, and cost for VLAB workloads with:
- 4 GiB memory per vCPU ratio
- Intel Xeon processors with Hyper-Threading
- Premium storage support for better disk performance

## Step 1: Set Up Your Azure Environment

First, let's make sure you're authenticated and ready to create resources.

### Verify Azure CLI Installation

```bash
az version
```

You should see output showing the Azure CLI version. If not, please install the CLI first.

### Sign in to Azure

```bash
az login
```

This will open your browser for authentication. Follow the prompts to sign in.

### Set Your Active Subscription

If you have multiple subscriptions, list them and set the one you want to use:

```bash
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_NAME_OR_ID"
```

Verify your active subscription:

```bash
az account show --output table
```

## Step 2: Create a Resource Group

Azure uses resource groups to organize related resources. Let's create one for your VLAB:

```bash
az group create --name hedgehog-vlab-rg --location westus2
```

**Tip:** Choose a location close to you. See available regions with `az account list-locations --output table`.

## Step 3: Create Your VLAB Virtual Machine

Now we'll create a VM configured specifically for running the Hedgehog Virtual Lab.

### The Command

```bash
az vm create \
  --resource-group hedgehog-vlab-rg \
  --name hedgehog-vlab \
  --location westus2 \
  --size Standard_D32s_v3 \
  --image Canonical:ubuntu-24_04-lts:server:latest \
  --admin-username ubuntu \
  --generate-ssh-keys \
  --os-disk-size-gb 200 \
  --security-type Standard
```

### What This Command Does

Let's break down the key flags:

- **`--resource-group hedgehog-vlab-rg`**: Places the VM in the resource group we just created
- **`--size Standard_D32s_v3`**: Creates a VM with 32 vCPUs and 128GB RAM that supports nested virtualization
- **`--image Canonical:ubuntu-24_04-lts:server:latest`**: Uses Ubuntu 24.04 LTS, which is tested and recommended for VLAB
- **`--os-disk-size-gb 200`**: Creates a 200GB disk (VLAB needs substantial disk space for all the virtual switches and servers)
- **`--security-type Standard`**: Uses standard security (Trusted Launch can interfere with nested virtualization)
- **`--generate-ssh-keys`**: Automatically creates SSH keys for secure access

**Important about Security Type:** We explicitly set `--security-type Standard` because the default Trusted Launch security type may be incompatible with nested virtualization. This is a critical setting for VLAB to work properly.

**Prefer using the Portal?** You can configure most of these settings in the Azure Portal, but make sure to:
1. Select a VM size from the Dv3, Dv4, Dv5, Ev3, Ev4, or Ev5 series (these support nested virtualization)
2. Set Security Type to "Standard" (found in the Management tab)
3. Use Ubuntu 24.04 LTS as the operating system

### Customize for Your Environment

Before running the command, you may want to replace:
- `westus2` with your preferred region
- `hedgehog-vlab-rg` with a different resource group name
- `hedgehog-vlab` with a different VM name

### Run the Command

Copy the command with your values and run it. The VM creation takes several minutes. You'll see JSON output showing the VM details when it completes.

**Note the public IP address** in the output—you'll need it to connect!

## Step 4: Connect to Your VM

Once your VM is created, you can connect via SSH.

### Get the Public IP Address

If you didn't note it from the creation output:

```bash
az vm show --resource-group hedgehog-vlab-rg --name hedgehog-vlab \
  --show-details --query publicIps -o tsv
```

### Connect via SSH

```bash
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

On first connection, you'll be asked to verify the host key fingerprint—type "yes" to continue.

You should see an Ubuntu welcome message and a command prompt.

## Next Steps: Installing the VLAB

Congratulations! You now have a VM ready for the Hedgehog Virtual Lab. The installation process from here is identical regardless of whether you're running on Azure, Google Cloud, AWS, or bare metal.

### What Comes Next

You'll need to:
1. Install Docker, QEMU/KVM, and other prerequisites
2. Install the `hhfab` utility
3. Initialize and run the VLAB
4. Access the control node and switches

All of these steps are covered in detail in the [VLAB Overview documentation](https://docs.hedgehog.cloud/latest/vlab/overview/) starting at the **"Installing Prerequisites"** section.

**Look for our companion module:** We're creating a separate "Setting up the VLAB" module that will walk through the installation steps in the same friendly format as this guide—stay tuned!

## Troubleshooting

### "az: command not found"
Install the Azure CLI following the [official installation guide](https://learn.microsoft.com/cli/azure/install-azure-cli).

### Authentication Issues
Make sure you're logged in with `az login` and your account has the necessary permissions to create resources in your subscription.

### VM Creation Fails
- **Quota issues**: Your subscription may not have enough quota for a 32-vCPU instance. Check your quotas in the Azure Portal under Subscriptions → Usage + quotas.
- **Region availability**: Try a different region if the VM size isn't available. Check availability with `az vm list-skus --location westus2 --size Standard_D --output table`.
- **Image not found**: Verify the Ubuntu image with `az vm image list --publisher Canonical --offer ubuntu-24_04-lts --all --output table`.

### Can't SSH to the VM
- Wait a minute or two after creation for the VM to fully boot
- Check that your Network Security Group (NSG) allows SSH (port 22)—it should be open by default
- Verify your SSH key was generated correctly in `~/.ssh/`
- Try `az vm show --resource-group hedgehog-vlab-rg --name hedgehog-vlab --query powerState -o tsv` to confirm the VM is running

### Nested Virtualization Not Working
Make sure you:
1. Selected a VM size from a series that supports nested virtualization (Dv3, Dv4, Dv5, Ev3, Ev4, Ev5, Fsv2)
2. Set Security Type to "Standard" (not Trusted Launch)

## Cost Considerations

The Standard_D32s_v3 instance is a substantial VM and will incur meaningful costs if left running. Here are some tips:

- **Deallocate when not in use**: `az vm deallocate --resource-group hedgehog-vlab-rg --name hedgehog-vlab`
- **Start when needed**: `az vm start --resource-group hedgehog-vlab-rg --name hedgehog-vlab`
- **Delete when done**: `az group delete --name hedgehog-vlab-rg --yes --no-wait` (deletes the entire resource group)

When deallocated, you won't be charged for compute, but you will still pay for storage. To completely stop charges, delete the resource group.

**Tip:** Use auto-shutdown to automatically deallocate the VM at a scheduled time each day. You can configure this in the Azure Portal under the VM's settings.

## Resources

- [Hedgehog VLAB Documentation](https://docs.hedgehog.cloud/latest/vlab/overview/)
- [Azure CLI Documentation](https://learn.microsoft.com/cli/azure/)
- [Azure Nested Virtualization Overview](https://learn.microsoft.com/azure/virtual-machines/nested-virtualization)
- [Azure VM Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

---

**Ready to continue?** Once you've completed the VLAB installation steps from the [official documentation](https://docs.hedgehog.cloud/latest/vlab/overview/), you'll have a complete Hedgehog Fabric environment to explore and learn!

