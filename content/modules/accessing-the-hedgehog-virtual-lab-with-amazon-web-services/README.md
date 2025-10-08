---
title: "Accessing the Hedgehog Virtual Lab with Amazon Web Services"
slug: "accessing-the-hedgehog-virtual-lab-with-amazon-web-services"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0"
validated_on: "2025-10-08"
pathway_slug: "getting-started"
pathway_name: "Getting Started"
tags: [hedgehog, virtual-lab, aws, onboarding, access]
description: "Create and configure an AWS EC2 metal instance suitable for running the Hedgehog Virtual Lab so you can begin hands-on learning with Hedgehog Fabric."
order: 11

# Agent-ready maintenance (optional but recommended)
products:
  - name: hedgehog-virtual-lab
    repo: hedgehog-cloud/virtual-lab
    min_version: 1.0.0
scenarios:
  - id: aws-metal-setup
    title: "Create an AWS EC2 metal instance for the Hedgehog Virtual Lab"
    persona: "Platform learner"
    environment: "AWS CLI v2 installed; IAM credentials with EC2 permissions"
    steps:
      - id: verify-cli
        goal: "Confirm AWS CLI is installed"
        commands:
          - aws --version
        validate:
          - aws --version | grep -i "aws-cli"
      - id: configure-credentials
        goal: "Configure AWS credentials"
        commands:
          - aws configure
        validate:
          - aws sts get-caller-identity --query Account --output text | grep -E "^[0-9]{12}$"
      - id: create-key-pair
        goal: "Create SSH key pair for instance access"
        commands:
          - aws ec2 create-key-pair --key-name hedgehog-vlab-key --query 'KeyMaterial' --output text > ~/.ssh/hedgehog-vlab-key.pem && chmod 400 ~/.ssh/hedgehog-vlab-key.pem
        validate:
          - test -f ~/.ssh/hedgehog-vlab-key.pem
      - id: launch-instance
        goal: "Launch a metal instance for VLAB"
        commands:
          - aws ec2 run-instances --image-id resolve:ssm:/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --instance-type c5n.metal --key-name hedgehog-vlab-key --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=200,VolumeType=gp3}' --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hedgehog-vlab}]'
        validate:
          - aws ec2 describe-instances --filters "Name=tag:Name,Values=hedgehog-vlab" --query 'Reservations[0].Instances[0].State.Name' --output text | grep -E "pending|running"
ai_hints:
  environment: "local"
  retries: 1
---

# Accessing the Hedgehog Virtual Lab with Amazon Web Services

Welcome! This guide will help you create an Amazon Web Services EC2 metal instance that's ready to run the Hedgehog Virtual Lab. We'll walk through each step to get you up and running quickly, and we'll make sure you understand what's happening along the way.

## What You'll Learn
- Understand why AWS requires metal instances for VLAB
- Create a properly configured EC2 metal instance
- Connect to your instance and prepare for VLAB installation

## Prerequisites
- An AWS account with an active subscription
- AWS CLI v2 installed on your local machine
- Basic familiarity with command-line tools
- IAM permissions to create EC2 instances, key pairs, and security groups

**Need to install AWS CLI?** Visit the [AWS CLI installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

## Understanding the Requirements

The Hedgehog Virtual Lab creates a complete virtual network fabric using multiple virtual machines to simulate switches, servers, and a control node. While Hedgehog's control software is lightweight, the lab uses Broadcom SONiC Virtual Switch VMs, which require substantial resources.

### Why Metal Instances?

**AWS does not support nested virtualization on standard EC2 instances.** To run VLAB, which needs to create VMs inside VMs, you must use a **bare metal instance**. These instances give you direct access to the physical server's processor and memory, allowing you to run KVM/QEMU for nested virtualization.

### Recommended Instance Types

AWS metal instances are generally larger than what you'd find with nested virtualization support on other clouds. We recommend any x86/x64 metal instance with **at least 32 vCPUs and 128GB RAM**. Good options include:

- **c5n.metal**: 72 vCPUs, 192 GB RAM (~$3.89/hour) - Good balance of compute and cost
- **c6i.metal**: 128 vCPUs, 256 GB RAM (~$5.44/hour) - More powerful, higher cost
- **m5.metal**: 96 vCPUs, 384 GB RAM - Memory-optimized alternative
- **Any newer metal instance** that meets the minimum specs

**Important:** Make sure to select an **x86/x64 architecture** instance, not ARM-based (Graviton) instances, as the VLAB software is designed for x86/x64 processors.

**Note:** These specs exceed the official [VLAB documentation requirements](https://docs.hedgehog.cloud/latest/vlab/overview/), but AWS doesn't offer smaller metal instances. The extra resources can be useful for larger topologies or running multiple experiments.

**Cost Warning:** Metal instances are significantly more expensive than standard VMs. Be sure to stop or terminate your instance when not in use to avoid unexpected charges!

## Step 1: Set Up Your AWS Environment

First, let's make sure you're authenticated and ready to create resources.

### Verify AWS CLI Installation

```bash
aws --version
```

You should see output showing AWS CLI version 2.x. If not, please install the CLI first.

### Configure AWS Credentials

```bash
aws configure
```

You'll be prompted for:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-west-2`)
- Output format (use `json` or `table`)

### Verify Your Identity

```bash
aws sts get-caller-identity
```

You should see your account ID, user ID, and ARN.

## Step 2: Create an SSH Key Pair

You'll need an SSH key to connect to your instance.

### Create and Save the Key

```bash
aws ec2 create-key-pair \
  --key-name hedgehog-vlab-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/hedgehog-vlab-key.pem

chmod 400 ~/.ssh/hedgehog-vlab-key.pem
```

This creates a new key pair in AWS and saves the private key locally. The `chmod 400` makes it readable only by you (required by SSH).

## Step 3: Launch Your Metal Instance

Now we'll launch an EC2 metal instance configured for running the Hedgehog Virtual Lab.

### The Command

```bash
aws ec2 run-instances \
  --image-id resolve:ssm:/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --instance-type c5n.metal \
  --key-name hedgehog-vlab-key \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=200,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hedgehog-vlab}]'
```

### What This Command Does

Let's break down the key parameters:

- **`--image-id resolve:ssm:...`**: Automatically resolves to the latest Ubuntu 24.04 LTS AMI for your region (no need to look up AMI IDs!)
- **`--instance-type c5n.metal`**: Launches a bare metal instance with 72 vCPUs and 192GB RAM
- **`--key-name hedgehog-vlab-key`**: Uses the SSH key we just created
- **`--block-device-mappings`**: Creates a 200GB GP3 EBS volume (VLAB needs substantial disk space)
- **`--tag-specifications`**: Tags the instance with a friendly name for easy identification

### Customize for Your Environment

Before running the command, you may want to:
- Change `c5n.metal` to a different metal instance type if needed
- Adjust the region (set with `aws configure` or add `--region us-west-2`)
- Change `hedgehog-vlab` to a different name

### Add a Security Group (Optional but Recommended)

The command above uses your default VPC and security group. For better security, create a security group that allows SSH only from your IP:

```bash
# Get your public IP
MY_IP=$(curl -s https://checkip.amazonaws.com)

# Create a security group
aws ec2 create-security-group \
  --group-name hedgehog-vlab-sg \
  --description "Security group for Hedgehog VLAB"

# Allow SSH from your IP only
aws ec2 authorize-security-group-ingress \
  --group-name hedgehog-vlab-sg \
  --protocol tcp \
  --port 22 \
  --cidr ${MY_IP}/32
```

Then add `--security-groups hedgehog-vlab-sg` to the run-instances command.

### Run the Command

Copy the command with your customizations and run it. The instance will take several minutes to launch. You'll see JSON output with instance details.

**Save the Instance ID** from the output—you'll need it for management commands.

### Wait for the Instance to Be Ready

Check the instance status:

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=hedgehog-vlab" \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text
```

Wait until it shows `running`.

## Step 4: Connect to Your Instance

Once your instance is running, you can connect via SSH.

### Get the Public IP Address

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=hedgehog-vlab" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

### Connect via SSH

```bash
ssh -i ~/.ssh/hedgehog-vlab-key.pem ubuntu@YOUR_INSTANCE_PUBLIC_IP
```

On first connection, you'll be asked to verify the host key fingerprint—type "yes" to continue.

You should see an Ubuntu welcome message and a command prompt.

## Next Steps: Installing the VLAB

Congratulations! You now have a metal instance ready for the Hedgehog Virtual Lab. The installation process from here is identical regardless of whether you're running on AWS, Google Cloud, Azure, or bare metal.

### What Comes Next

You'll need to:
1. Install Docker, QEMU/KVM, and other prerequisites
2. Install the `hhfab` utility
3. Initialize and run the VLAB
4. Access the control node and switches

All of these steps are covered in detail in the [VLAB Overview documentation](https://docs.hedgehog.cloud/latest/vlab/overview/) starting at the **"Installing Prerequisites"** section.

**Look for our companion module:** We're creating a separate "Setting up the VLAB" module that will walk through the installation steps in the same friendly format as this guide—stay tuned!

## Troubleshooting

### "aws: command not found"
Install the AWS CLI following the [official installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

### Authentication Issues
- Make sure you've run `aws configure` with valid credentials
- Verify your credentials with `aws sts get-caller-identity`
- Check that your IAM user/role has EC2 permissions

### Instance Launch Fails
- **Quota/Limit issues**: Metal instances often have lower service quotas. Request a quota increase in the AWS Service Quotas console for "Running On-Demand All Standard instances"
- **Region availability**: Not all regions have all metal instance types. Try a different region or instance type.
- **AMI not found**: The SSM parameter resolver requires AWS CLI v2. Upgrade if you're using v1.

### Can't SSH to the Instance
- Wait 2-3 minutes after the instance shows "running" for it to fully boot
- Check that your security group allows SSH (port 22) from your IP
- Verify the key file has correct permissions: `ls -l ~/.ssh/hedgehog-vlab-key.pem` should show `-r--------`
- Make sure you're using the correct username (`ubuntu` for Ubuntu AMIs)

### Instance Launches But Immediately Stops
- Check CloudWatch logs or instance status checks
- Metal instances take longer to initialize than standard instances—wait a few minutes

## Cost Considerations

**Metal instances are expensive!** The c5n.metal costs approximately $3.89/hour (~$2,800/month) if left running continuously. Here are some tips to manage costs:

- **Stop when not in use**: `aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID`
- **Start when needed**: `aws ec2 start-instances --instance-ids YOUR_INSTANCE_ID`
- **Terminate when completely done**: `aws ec2 terminate-instances --instance-ids YOUR_INSTANCE_ID`

**Important:** Stopped instances still incur EBS storage charges (about $20/month for 200GB). To completely stop charges, terminate the instance—but note that this deletes the instance and its data!

**Cost-Saving Tips:**
- Use the instance during business hours only
- Consider Spot Instances for even lower costs (with interruption risk)
- Use Reserved Instances if you plan to use VLAB long-term
- Set up billing alerts to avoid surprises

## Resources

- [Hedgehog VLAB Documentation](https://docs.hedgehog.cloud/latest/vlab/overview/)
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [EC2 Metal Instances Overview](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html#ec2-nitro-instances)
- [EC2 Pricing Calculator](https://calculator.aws/)

---

**Ready to continue?** Once you've completed the VLAB installation steps from the [official documentation](https://docs.hedgehog.cloud/latest/vlab/overview/), you'll have a complete Hedgehog Fabric environment to explore and learn!

