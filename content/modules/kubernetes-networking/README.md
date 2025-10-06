---
title: "Kubernetes Networking: Services, Ingress, and Network Policies"
slug: "kubernetes-networking"
difficulty: "intermediate"
estimated_minutes: 75
version: "1.0.0"
validated_on: "2025-10-06"
tags:
  - kubernetes
  - networking
  - services
  - ingress
  - network-policies
  - load-balancing
description: "Learn how to expose applications, route traffic, and secure network communication in Kubernetes through Services, Ingress, and Network Policies."
---

# Kubernetes Networking: Services, Ingress, and Network Policies

## Overview

Networking in Kubernetes can seem complex at first, but understanding how pods communicate and how to expose applications is crucial for running production workloads. This module covers Services for load balancing, Ingress for HTTP routing, and Network Policies for securing traffic between pods.

## Learning Objectives

- Understand Kubernetes networking fundamentals
- Create and configure different types of Services (ClusterIP, NodePort, LoadBalancer)
- Implement Ingress for external HTTP/HTTPS access
- Configure Ingress Controllers
- Secure pod-to-pod communication with Network Policies
- Understand service discovery and DNS in Kubernetes

## Lab: Kubernetes Networking in Action

### Prerequisites

- Completed previous modules (Introduction to Kubernetes recommended)
- kubectl CLI installed and configured
- A running Kubernetes cluster
- Ingress controller installed (nginx-ingress, traefik, or similar)

### Step 1: Set Up the Lab Environment

Create a namespace and deploy sample applications:

```bash
kubectl create namespace networking-lab
```

Create a simple backend application deployment. Save as `backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: networking-lab
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
        version: v1
    spec:
      containers:
      - name: backend
        image: hashicorp/http-echo:latest
        args:
          - "-text=Hello from Backend Pod: $(HOSTNAME)"
          - "-listen=:8080"
        ports:
        - containerPort: 8080
        env:
        - name: HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
```

Deploy the application:

```bash
kubectl apply -f backend-deployment.yaml
```

Verify the pods are running:

```bash
kubectl get pods -n networking-lab -l app=backend
```

### Step 2: Create a ClusterIP Service

ClusterIP is the default Service type, providing internal cluster access. Create `clusterip-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-clusterip
  namespace: networking-lab
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
```

Apply the service:

```bash
kubectl apply -f clusterip-service.yaml
```

View the service:

```bash
kubectl get svc backend-clusterip -n networking-lab
```

Note the CLUSTER-IP address. This IP is only accessible from within the cluster.

Test the service from within the cluster:

```bash
kubectl run test-pod --image=busybox --rm -it --restart=Never -n networking-lab -- sh
```

Inside the pod, test the service:

```sh
wget -qO- http://backend-clusterip
# Try multiple times to see load balancing
wget -qO- http://backend-clusterip
wget -qO- http://backend-clusterip
exit
```

You should see responses from different backend pods, demonstrating load balancing.

### Step 3: Service Discovery with DNS

Kubernetes provides automatic DNS-based service discovery. Test it:

```bash
kubectl run dns-test --image=busybox --rm -it --restart=Never -n networking-lab -- sh
```

Inside the pod:

```sh
# Test service name resolution
nslookup backend-clusterip

# Access using DNS name
wget -qO- http://backend-clusterip.networking-lab.svc.cluster.local

# Short form (within same namespace)
wget -qO- http://backend-clusterip

exit
```

Service DNS names follow the pattern: `<service-name>.<namespace>.svc.cluster.local`

### Step 4: Create a NodePort Service

NodePort exposes the service on each node's IP at a static port. Create `nodeport-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-nodeport
  namespace: networking-lab
spec:
  type: NodePort
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
    nodePort: 30080
```

Apply the service:

```bash
kubectl apply -f nodeport-service.yaml
```

View the service:

```bash
kubectl get svc backend-nodeport -n networking-lab
```

Get your node's IP:

```bash
kubectl get nodes -o wide
```

Access the service using any node's IP and the NodePort:

```bash
# Replace <NODE_IP> with actual node IP
curl http://<NODE_IP>:30080
```

For local clusters like minikube:

```bash
minikube service backend-nodeport -n networking-lab
```

### Step 5: Create a LoadBalancer Service

LoadBalancer services are typically used in cloud environments. Create `loadbalancer-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-loadbalancer
  namespace: networking-lab
spec:
  type: LoadBalancer
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
```

Apply the service:

```bash
kubectl apply -f loadbalancer-service.yaml
```

View the service:

```bash
kubectl get svc backend-loadbalancer -n networking-lab
```

In cloud environments, you'll see an EXTERNAL-IP assigned (may take a minute). In local clusters, it may show `<pending>` if no load balancer is configured.

### Step 6: Deploy a Frontend Application

Create a frontend deployment. Save as `frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: networking-lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: networking-lab
spec:
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
```

Deploy the frontend:

```bash
kubectl apply -f frontend-deployment.yaml
```

### Step 7: Configure Ingress

Ingress provides HTTP and HTTPS routing to services. First, verify your Ingress controller is installed:

```bash
kubectl get pods -n ingress-nginx
# Or check your specific ingress controller namespace
```

Create an Ingress resource. Save as `ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: networking-lab
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: frontend.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: backend.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-clusterip
            port:
              number: 80
```

Apply the Ingress:

```bash
kubectl apply -f ingress.yaml
```

View the Ingress:

```bash
kubectl get ingress -n networking-lab
```

For local testing, add entries to your `/etc/hosts` file:

```bash
# Get the Ingress controller's IP
kubectl get svc -n ingress-nginx

# Add to /etc/hosts (use appropriate IP)
echo "127.0.0.1 frontend.local backend.local" | sudo tee -a /etc/hosts
```

If using minikube, enable ingress:

```bash
minikube addons enable ingress
```

Test the Ingress:

```bash
curl http://frontend.local
curl http://backend.local
```

### Step 8: Path-Based Routing

Update the Ingress to use path-based routing. Create `ingress-path-based.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: path-based-ingress
  namespace: networking-lab
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: app.local
    http:
      paths:
      - path: /frontend
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
      - path: /backend
        pathType: Prefix
        backend:
          service:
            name: backend-clusterip
            port:
              number: 80
```

Apply the updated Ingress:

```bash
kubectl apply -f ingress-path-based.yaml
```

Test path-based routing:

```bash
curl http://app.local/frontend
curl http://app.local/backend
```

### Step 9: Implement Network Policies

Network Policies control traffic between pods. By default, all pods can communicate with each other. Let's restrict this.

First, create an isolated namespace:

```bash
kubectl label namespace networking-lab environment=test
```

Create a default deny policy. Save as `deny-all-policy.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: networking-lab
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

Apply the policy:

```bash
kubectl apply -f deny-all-policy.yaml
```

Test connectivity (it should fail):

```bash
kubectl run test-pod --image=busybox --rm -it --restart=Never -n networking-lab -- wget -qO- http://backend-clusterip --timeout=5
```

The request should timeout, showing the policy is working.

### Step 10: Create Selective Network Policies

Now allow specific traffic. Create `allow-frontend-to-backend.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: networking-lab
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-frontend
  namespace: networking-lab
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 80
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: networking-lab
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53
  - to:
    - podSelector: {}
```

Apply the policies:

```bash
kubectl apply -f allow-frontend-to-backend.yaml
```

View all network policies:

```bash
kubectl get networkpolicies -n networking-lab
```

Test that frontend can reach backend:

```bash
kubectl exec -it deployment/frontend -n networking-lab -- curl http://backend-clusterip --max-time 5
```

This should work now, but other pods still cannot access backend directly.

### Step 11: Clean Up

Remove all resources:

```bash
kubectl delete namespace networking-lab
```

If you modified `/etc/hosts`, remove the entries:

```bash
sudo sed -i '/frontend.local/d' /etc/hosts
sudo sed -i '/backend.local/d' /etc/hosts
sudo sed -i '/app.local/d' /etc/hosts
```

## Concepts

### Kubernetes Networking Model

Kubernetes imposes the following fundamental requirements on any networking implementation:

1. **Pods can communicate with all other pods** without NAT
2. **Nodes can communicate with all pods** without NAT
3. **Each pod sees itself with the same IP** that other pods see it with

This flat networking model simplifies application deployment and makes Kubernetes networks behave more like traditional networks.

### Understanding Services

Services are an abstract way to expose applications running on a set of pods. They provide:

- **Stable networking**: Services have fixed IPs and DNS names, even as pods come and go
- **Load balancing**: Traffic is distributed across multiple pod replicas
- **Service discovery**: Pods can find services using DNS or environment variables
- **Decoupling**: Applications don't need to know about pod IPs

#### Service Types

**ClusterIP (Default)**:
- Creates a virtual IP accessible only within the cluster
- Used for internal service-to-service communication
- Most common service type for microservices architectures

**NodePort**:
- Exposes the service on each node's IP at a static port (30000-32767 by default)
- Allows external traffic to reach the service via `<NodeIP>:<NodePort>`
- Useful for development or when you don't have a load balancer
- Not recommended for production due to port management complexity

**LoadBalancer**:
- Creates an external load balancer in supported cloud providers (AWS, GCP, Azure)
- Automatically assigns an external IP address
- Best for exposing services to the internet in cloud environments
- Each LoadBalancer service costs money in cloud environments

**ExternalName**:
- Maps a service to a DNS name
- No proxying or load balancing; just DNS CNAME record
- Useful for integrating external services

### Service Discovery and DNS

Kubernetes runs a DNS server (CoreDNS) that automatically creates DNS records for services. When a service is created, it gets:

- **A DNS A record**: `<service-name>.<namespace>.svc.cluster.local`
- **Within same namespace**: Can use just `<service-name>`
- **Across namespaces**: Use `<service-name>.<namespace>`

Pods also get DNS records: `<pod-ip-with-dashes>.<namespace>.pod.cluster.local`

This automatic DNS makes service discovery trivial - just use the service name!

### How Services Work

Services use selectors to identify the pods they route traffic to. The Kubernetes control plane continuously monitors pods matching the selector and updates the service's endpoints.

The kube-proxy component on each node watches for service and endpoint changes and configures iptables (or IPVS) rules to route traffic appropriately. This happens transparently - applications just see a stable service IP.

### Ingress: HTTP/HTTPS Routing

While Services expose applications, Ingress provides HTTP and HTTPS routing with features like:

- **Host-based routing**: Route based on hostname (e.g., app1.example.com vs app2.example.com)
- **Path-based routing**: Route based on URL path (e.g., /api vs /web)
- **SSL/TLS termination**: Handle HTTPS at the edge
- **Name-based virtual hosting**: Multiple domains on one IP

#### Ingress Controllers

Ingress resources are just configuration; you need an Ingress Controller to actually implement the routing. Popular options:

- **NGINX Ingress Controller**: Most common, feature-rich
- **Traefik**: Modern, cloud-native, excellent documentation
- **HAProxy Ingress**: High-performance, production-grade
- **Contour**: Built on Envoy proxy
- **Cloud provider controllers**: ALB (AWS), GCLB (GCP), etc.

Each controller has different features and annotations, so always check controller-specific documentation.

### Network Policies: Securing Pod Communication

By default, Kubernetes allows all pods to communicate with each other. Network Policies provide firewall rules for pod-to-pod traffic.

Network Policies are:
- **Namespaced resources**: Apply to pods in their namespace
- **Additive**: Multiple policies combine (logical OR)
- **Whitelist-based**: You specify what's allowed; everything else is denied
- **Label-based**: Use selectors to identify pods

#### Policy Types

**Ingress**: Controls incoming traffic to pods
**Egress**: Controls outgoing traffic from pods

#### Best Practices for Network Policies

1. **Start with deny-all**: Create a default deny policy, then explicitly allow needed traffic
2. **Use specific selectors**: Be precise about what traffic should be allowed
3. **Consider DNS**: Always allow DNS (UDP port 53 to kube-system)
4. **Test thoroughly**: Network Policies can break applications if misconfigured
5. **Document policies**: Clearly document why each policy exists
6. **Layer security**: Network Policies are one layer; use RBAC, Pod Security, etc. too

### CNI: Container Network Interface

Kubernetes uses CNI plugins to implement its networking model. Popular CNI plugins:

- **Calico**: Feature-rich, includes Network Policy support, good for large clusters
- **Flannel**: Simple, lightweight, easy to set up
- **Weave Net**: Automatic encryption, easy to use
- **Cilium**: eBPF-based, excellent observability and security
- **Canal**: Combines Flannel and Calico

Your choice of CNI affects network performance, features (like Network Policies), and complexity.

### Service Mesh: Advanced Networking

For very complex microservices architectures, consider a service mesh like:

- **Istio**: Full-featured, complex, provides traffic management, security, observability
- **Linkerd**: Lightweight, easier to use, good performance
- **Consul**: HashiCorp's service mesh solution

Service meshes provide advanced features like mTLS, circuit breaking, advanced traffic routing, and detailed observability, but add significant complexity.

## Additional Resources

- [Kubernetes Networking Documentation](https://kubernetes.io/docs/concepts/cluster-administration/networking/) - Official networking concepts
- [Service Documentation](https://kubernetes.io/docs/concepts/services-networking/service/) - Comprehensive service guide
- [Ingress Documentation](https://kubernetes.io/docs/concepts/services-networking/ingress/) - Ingress concepts and examples
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) - Network policy guide and recipes
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) - How Kubernetes DNS works

## Next Steps

With networking mastered, you can:

- Explore service mesh technologies for advanced traffic management
- Learn about multi-cluster networking with cluster federation
- Study advanced security patterns with mutual TLS
- Implement sophisticated traffic routing and canary deployments
- Build production-grade microservices architectures

Continue your Kubernetes journey with advanced topics and real-world scenarios!
