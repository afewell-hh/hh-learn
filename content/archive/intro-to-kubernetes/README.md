---
title: "Introduction to Kubernetes"
slug: "intro-to-kubernetes"
difficulty: "beginner"
estimated_minutes: 30
version: "v1.30"
validated_on: "2025-10-01"
pathway_slug: "kubernetes-fundamentals"
pathway_name: "Kubernetes Fundamentals"
tags:
  - kubernetes
  - containers
  - orchestration
  - docker
---

# Introduction to Kubernetes

Welcome to your first Kubernetes module! In this hands-on lab, you'll learn the fundamentals of Kubernetes by deploying your first containerized application.

## Lab: Deploy Your First Application

### Prerequisites
- Access to a Kubernetes cluster (minikube, kind, or cloud provider)
- kubectl CLI installed and configured

### Step 1: Verify Cluster Access

First, let's verify that your Kubernetes cluster is running and accessible:

```bash
kubectl cluster-info
```

You should see output showing your cluster endpoints. Next, check the nodes in your cluster:

```bash
kubectl get nodes
```

This will display all nodes in your cluster along with their status.

### Step 2: Create a Namespace

Namespaces provide logical isolation for your resources. Create a namespace for this lab:

```bash
kubectl create namespace learn-k8s
```

Verify the namespace was created:

```bash
kubectl get namespaces
```

### Step 3: Deploy Your First Pod

A Pod is the smallest deployable unit in Kubernetes. Let's deploy a simple nginx web server:

```bash
kubectl run nginx --image=nginx:latest --namespace=learn-k8s
```

Check the status of your pod:

```bash
kubectl get pods --namespace=learn-k8s
```

Wait until the STATUS shows "Running".

### Step 4: Inspect the Pod

Get detailed information about your pod:

```bash
kubectl describe pod nginx --namespace=learn-k8s
```

This command shows extensive details including events, container status, and resource allocations.

### Step 5: Access Pod Logs

View the logs from your nginx container:

```bash
kubectl logs nginx --namespace=learn-k8s
```

Follow logs in real-time:

```bash
kubectl logs -f nginx --namespace=learn-k8s
```

Press Ctrl+C to stop following logs.

### Step 6: Execute Commands in the Pod

You can run commands inside a running container:

```bash
kubectl exec nginx --namespace=learn-k8s -- nginx -v
```

Open an interactive shell:

```bash
kubectl exec -it nginx --namespace=learn-k8s -- /bin/bash
```

Type `exit` to leave the shell.

### Step 7: Expose the Pod with a Service

Create a Service to make your nginx pod accessible:

```bash
kubectl expose pod nginx --port=80 --namespace=learn-k8s --type=NodePort
```

Get the service details:

```bash
kubectl get service nginx --namespace=learn-k8s
```

### Step 8: Test Connectivity

Port-forward to access the service locally:

```bash
kubectl port-forward service/nginx 8080:80 --namespace=learn-k8s
```

In another terminal or browser, visit `http://localhost:8080`. You should see the nginx welcome page.

### Step 9: Scale with a Deployment

While we created a single Pod, in production you'll use Deployments. Create a deployment:

```bash
kubectl create deployment web --image=nginx:latest --replicas=3 --namespace=learn-k8s
```

Watch the pods being created:

```bash
kubectl get pods --namespace=learn-k8s --watch
```

### Step 10: Clean Up

Remove all resources in the namespace:

```bash
kubectl delete namespace learn-k8s
```

Verify deletion:

```bash
kubectl get namespaces
```

## Concepts: Understanding Kubernetes Fundamentals

### What is Kubernetes?

Kubernetes (often abbreviated as K8s) is an open-source container orchestration platform that automates the deployment, scaling, and management of containerized applications. Originally developed by Google and now maintained by the Cloud Native Computing Foundation (CNCF), Kubernetes has become the de facto standard for container orchestration.

### Why Kubernetes?

As applications grow in complexity and scale, managing containers manually becomes impractical. Kubernetes solves this by providing:

- **Automated rollouts and rollbacks**: Deploy new versions safely with automatic rollback on failure
- **Service discovery and load balancing**: Automatic DNS and load balancing for your services
- **Storage orchestration**: Automatically mount storage systems of your choice
- **Self-healing**: Restarts failed containers, replaces containers, and kills containers that don't respond to health checks
- **Secret and configuration management**: Deploy and update secrets and configuration without rebuilding images
- **Horizontal scaling**: Scale your application up and down with a simple command

### Core Kubernetes Components

**Control Plane Components:**

The control plane manages the cluster and makes global decisions about the cluster:

- **API Server (kube-apiserver)**: The front-end for the Kubernetes control plane. All administrative tasks go through the API server.
- **etcd**: Consistent and highly-available key-value store used as Kubernetes' backing store for all cluster data.
- **Scheduler (kube-scheduler)**: Watches for newly created Pods and assigns them to nodes.
- **Controller Manager (kube-controller-manager)**: Runs controller processes that regulate the state of the cluster.

**Node Components:**

These components run on every node:

- **kubelet**: An agent that ensures containers are running in a Pod.
- **kube-proxy**: Maintains network rules on nodes, allowing network communication to your Pods.
- **Container Runtime**: Software responsible for running containers (e.g., Docker, containerd, CRI-O).

### Kubernetes Objects

Kubernetes uses objects to represent the state of your cluster. Key objects include:

**Pod**: The smallest deployable unit, representing one or more containers that share storage and network resources.

**Deployment**: Manages a replicated application, providing declarative updates for Pods and ReplicaSets.

**Service**: An abstract way to expose an application running on a set of Pods as a network service.

**Namespace**: Virtual clusters backed by the same physical cluster, used for dividing cluster resources between multiple users.

**ConfigMap & Secret**: Objects for storing configuration data and sensitive information separately from application code.

### The Kubernetes Architecture

Kubernetes follows a master-worker architecture:

1. **Master Node (Control Plane)**: Makes global decisions and detects/responds to cluster events
2. **Worker Nodes**: Run your application workloads in Pods

The control plane maintains the desired state of the cluster, while kubelet on each node ensures that containers are running and healthy.

### Desired State Management

Kubernetes operates on the principle of **desired state**. You declare the desired state of your application (e.g., "I want 3 replicas of my nginx app"), and Kubernetes works continuously to maintain that state. If a Pod crashes, Kubernetes automatically starts a new one to maintain your desired count.

### Benefits of the Kubernetes Approach

1. **Declarative Configuration**: Describe what you want, not how to achieve it
2. **Infrastructure as Code**: Version control your infrastructure configurations
3. **Portability**: Run on any cloud provider or on-premises
4. **Ecosystem**: Extensive ecosystem of tools and extensions
5. **Community**: Large, active community and enterprise support

Understanding these fundamentals is crucial as you continue your Kubernetes journey. Every advanced concept builds on these core principles.

## Resources

- [Official Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubernetes Basics Tutorial](https://kubernetes.io/docs/tutorials/kubernetes-basics/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes API Reference](https://kubernetes.io/docs/reference/kubernetes-api/)
- [CNCF Kubernetes Certification](https://www.cncf.io/certification/cka/)
