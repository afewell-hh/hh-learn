---
title: "Introduction to Kubernetes"
slug: "intro-to-kubernetes"
difficulty: "beginner"
estimated_minutes: 45
version: "1.0.0"
validated_on: "2025-10-06"
tags:
  - kubernetes
  - containers
  - pods
  - fundamentals
description: "Learn Kubernetes fundamentals and deploy your first pod in this hands-on introduction to container orchestration."
---

# Introduction to Kubernetes

## Overview

Welcome to your first Kubernetes module! In this hands-on lab, you'll learn the fundamentals of Kubernetes and deploy your first pod. By the end of this module, you'll understand core Kubernetes concepts and have practical experience with basic kubectl commands.

## Learning Objectives

- Understand what Kubernetes is and why it's used
- Learn about the Kubernetes architecture and core components
- Deploy and manage your first pod
- Inspect pod status and logs
- Understand basic kubectl commands

## Lab: Deploy Your First Pod

### Prerequisites

- A running Kubernetes cluster (minikube, kind, or cloud provider)
- kubectl CLI installed and configured
- Basic understanding of containers and Docker

### Step 1: Verify Cluster Access

First, let's verify that your kubectl is properly configured and can communicate with your cluster.

```bash
kubectl cluster-info
```

You should see output showing your cluster endpoints. Now check the nodes in your cluster:

```bash
kubectl get nodes
```

This command shows all nodes in your cluster and their status. You should see at least one node in the "Ready" state.

### Step 2: Create a Namespace

Namespaces provide a way to organize and isolate resources within a cluster. Let's create a namespace for this lab:

```bash
kubectl create namespace intro-lab
```

Verify the namespace was created:

```bash
kubectl get namespaces
```

### Step 3: Deploy Your First Pod

Create a file named `first-pod.yaml` with the following content:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  namespace: intro-lab
  labels:
    app: nginx
    environment: learning
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    ports:
    - containerPort: 80
      name: http
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
```

Deploy the pod:

```bash
kubectl apply -f first-pod.yaml
```

### Step 4: Verify Pod Status

Check the status of your pod:

```bash
kubectl get pods -n intro-lab
```

For more detailed information:

```bash
kubectl describe pod nginx-pod -n intro-lab
```

Wait until the STATUS shows "Running". This may take a few moments as Kubernetes pulls the container image.

### Step 5: View Pod Logs

Kubernetes makes it easy to view logs from your containers:

```bash
kubectl logs nginx-pod -n intro-lab
```

For continuous log streaming, add the `-f` flag:

```bash
kubectl logs -f nginx-pod -n intro-lab
```

Press Ctrl+C to stop streaming.

### Step 6: Execute Commands Inside the Pod

You can execute commands inside a running pod using `kubectl exec`:

```bash
kubectl exec nginx-pod -n intro-lab -- nginx -v
```

For an interactive shell:

```bash
kubectl exec -it nginx-pod -n intro-lab -- /bin/bash
```

Once inside, you can explore the container. Try these commands:

```bash
# View running processes
ps aux

# Check the nginx configuration
cat /etc/nginx/nginx.conf

# Exit the container
exit
```

### Step 7: Port Forwarding

To access your pod locally, use port forwarding:

```bash
kubectl port-forward pod/nginx-pod -n intro-lab 8080:80
```

Open a browser and navigate to `http://localhost:8080`. You should see the nginx welcome page. Press Ctrl+C to stop port forwarding.

### Step 8: View Pod Resources

Check resource usage of your pod:

```bash
kubectl top pod nginx-pod -n intro-lab
```

Note: This requires the metrics-server to be installed in your cluster.

### Step 9: Update Pod Labels

Labels are key-value pairs that help organize and select resources. Add a new label:

```bash
kubectl label pod nginx-pod -n intro-lab version=v1
```

View all labels:

```bash
kubectl get pod nginx-pod -n intro-lab --show-labels
```

### Step 10: Clean Up

When you're done, delete the resources:

```bash
kubectl delete pod nginx-pod -n intro-lab
kubectl delete namespace intro-lab
```

Verify the pod is deleted:

```bash
kubectl get pods -n intro-lab
```

## Concepts

### What is Kubernetes?

Kubernetes (often abbreviated as K8s) is an open-source container orchestration platform that automates the deployment, scaling, and management of containerized applications. Originally developed by Google and now maintained by the Cloud Native Computing Foundation (CNCF), Kubernetes has become the de facto standard for container orchestration.

### Why Kubernetes?

Before Kubernetes, deploying containerized applications at scale was challenging. Teams faced issues with:

- **Manual scaling**: Adding or removing containers based on demand required manual intervention
- **No self-healing**: Failed containers needed manual detection and restart
- **Complex networking**: Connecting containers across multiple hosts was difficult
- **Resource inefficiency**: Without intelligent scheduling, resources were often wasted
- **Configuration management**: Managing environment-specific configurations was error-prone

Kubernetes solves these problems by providing a robust platform that handles these concerns automatically, allowing developers to focus on building applications rather than managing infrastructure.

### Kubernetes Architecture

Kubernetes follows a master-worker architecture with two main types of nodes:

#### Control Plane Components

The control plane makes global decisions about the cluster and detects and responds to cluster events:

- **API Server**: The front-end for the Kubernetes control plane, exposing the Kubernetes API
- **etcd**: A consistent and highly-available key-value store used as Kubernetes' backing store for all cluster data
- **Scheduler**: Watches for newly created pods with no assigned node and selects a node for them to run on
- **Controller Manager**: Runs controller processes that regulate the state of the cluster
- **Cloud Controller Manager**: Links your cluster into your cloud provider's API (for cloud deployments)

#### Worker Node Components

Worker nodes run the actual application workloads:

- **kubelet**: An agent that ensures containers are running in a pod
- **kube-proxy**: Maintains network rules on nodes, allowing network communication to your pods
- **Container Runtime**: The software responsible for running containers (Docker, containerd, CRI-O, etc.)

### Understanding Pods

A Pod is the smallest deployable unit in Kubernetes. Think of it as a wrapper around one or more containers. Key characteristics:

- **Single IP address**: All containers in a pod share the same network namespace and IP address
- **Shared storage**: Containers in a pod can share volumes
- **Lifecycle**: All containers in a pod are scheduled together and run on the same node
- **Ephemeral**: Pods are designed to be disposable and replaceable

Most commonly, a pod contains a single container, but multi-container pods are used for tightly coupled applications where containers need to share resources.

### Kubernetes Objects and Declarative Configuration

Kubernetes uses a declarative model where you describe the desired state of your system in YAML or JSON files. The Kubernetes control plane then works continuously to maintain that desired state. This is fundamentally different from imperative approaches where you specify step-by-step how to achieve a goal.

For example, instead of saying "start 3 nginx containers," you declare "I want 3 nginx pods running," and Kubernetes figures out how to make it happen and maintains that state.

### Labels and Selectors

Labels are key-value pairs attached to objects like pods, services, and deployments. They're used for:

- **Organization**: Group related resources together
- **Selection**: Query and filter resources
- **Routing**: Determine which pods receive traffic from a service

Selectors allow you to identify a set of objects based on their labels, enabling powerful and flexible resource management.

### Namespaces

Namespaces provide a mechanism for isolating groups of resources within a single cluster. They're useful for:

- **Multi-tenancy**: Separating resources for different teams or projects
- **Environment separation**: Dividing development, staging, and production environments
- **Resource quotas**: Limiting resource consumption per namespace
- **Access control**: Applying different RBAC policies to different namespaces

### The kubectl CLI

kubectl is your primary interface to Kubernetes. It communicates with the API server to perform operations on your cluster. Common patterns:

- `kubectl get`: List resources
- `kubectl describe`: Show detailed information about a resource
- `kubectl apply`: Create or update resources from files
- `kubectl delete`: Remove resources
- `kubectl logs`: View container logs
- `kubectl exec`: Execute commands in containers

Understanding kubectl is essential for effective Kubernetes management.

## Additional Resources

- [Official Kubernetes Documentation](https://kubernetes.io/docs/home/) - The comprehensive official documentation
- [Kubernetes Basics Tutorial](https://kubernetes.io/docs/tutorials/kubernetes-basics/) - Interactive tutorial from the Kubernetes project
- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/) - Deep dive into Kubernetes concepts and architecture
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/) - Quick reference for common kubectl commands
- [Kubernetes API Reference](https://kubernetes.io/docs/reference/kubernetes-api/) - Complete API documentation for all Kubernetes resources

## Next Steps

Now that you've deployed your first pod and understand Kubernetes fundamentals, you're ready to explore more advanced topics:

- Deployments and ReplicaSets for managing multiple pod replicas
- Services for networking and load balancing
- ConfigMaps and Secrets for configuration management
- Persistent storage with Volumes and PersistentVolumeClaims

Continue to the next module to deepen your Kubernetes knowledge!
