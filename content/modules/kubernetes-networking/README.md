---
title: "Kubernetes Networking: Services, Ingress, and Network Policies"
slug: "kubernetes-networking"
difficulty: "intermediate"
estimated_minutes: 50
version: "v1.30"
validated_on: "2025-10-01"
pathway_slug: "kubernetes-fundamentals"
pathway_name: "Kubernetes Fundamentals"
tags:
  - kubernetes
  - networking
  - services
  - ingress
  - network-policies
---

# Kubernetes Networking: Services, Ingress, and Network Policies

Master Kubernetes networking concepts including Services, Ingress controllers, and Network Policies for secure communication between pods.

## Lab: Kubernetes Networking in Action

### Prerequisites
- Completed "Introduction to Kubernetes" module
- Access to a Kubernetes cluster
- kubectl CLI configured
- Ingress controller installed (e.g., nginx-ingress)

### Step 1: Create a Namespace and Deployment

Create a namespace:

```bash
kubectl create namespace networking-lab
```

Create a deployment with multiple replicas:

```bash
kubectl create deployment web --image=nginx:latest --replicas=3 --namespace=networking-lab
```

Verify the pods are running:

```bash
kubectl get pods -n networking-lab -o wide
```

Note the IP addresses of each pod.

### Step 2: Create a ClusterIP Service

Create a file named `service-clusterip.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-service
  namespace: networking-lab
spec:
  selector:
    app: web
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP
```

Apply the Service:

```bash
kubectl apply -f service-clusterip.yaml
```

Get the Service details:

```bash
kubectl get service web-service -n networking-lab
```

Test the Service from within the cluster:

```bash
kubectl run test-pod --image=busybox --namespace=networking-lab --rm -it --restart=Never -- wget -qO- http://web-service
```

### Step 3: Explore Service Discovery

Services are automatically registered in DNS:

```bash
kubectl run dns-test --image=busybox --namespace=networking-lab --rm -it --restart=Never -- nslookup web-service
```

The service is accessible at: `web-service.networking-lab.svc.cluster.local`

### Step 4: Create a NodePort Service

Create a file named `service-nodeport.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport
  namespace: networking-lab
spec:
  selector:
    app: web
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
    nodePort: 30080
  type: NodePort
```

Apply the NodePort Service:

```bash
kubectl apply -f service-nodeport.yaml
```

Get the Service info:

```bash
kubectl get service web-nodeport -n networking-lab
```

Access the service on any node's IP at port 30080.

### Step 5: Create a LoadBalancer Service

Create a file named `service-loadbalancer.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-loadbalancer
  namespace: networking-lab
spec:
  selector:
    app: web
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer
```

Apply the LoadBalancer Service:

```bash
kubectl apply -f service-loadbalancer.yaml
```

Wait for external IP assignment:

```bash
kubectl get service web-loadbalancer -n networking-lab --watch
```

(This requires a cloud provider or MetalLB)

### Step 6: Create an Ingress Resource

First, create a second deployment:

```bash
kubectl create deployment api --image=hashicorp/http-echo --namespace=networking-lab -- -text="API Response"
```

Create a Service for the API:

```bash
kubectl expose deployment api --port=5678 --namespace=networking-lab
```

Create a file named `ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  namespace: networking-lab
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: web.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 80
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api
            port:
              number: 5678
```

Apply the Ingress:

```bash
kubectl apply -f ingress.yaml
```

Check Ingress status:

```bash
kubectl get ingress -n networking-lab
```

Test with curl (add hosts to /etc/hosts or use Host header):

```bash
curl -H "Host: web.example.com" http://<ingress-ip>
curl -H "Host: api.example.com" http://<ingress-ip>
```

### Step 7: Implement Network Policies

By default, all pods can communicate with each other. Let's restrict this.

Create a file named `network-policy-deny-all.yaml`:

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
kubectl apply -f network-policy-deny-all.yaml
```

Test connectivity (it should fail):

```bash
kubectl run test-pod --image=busybox --namespace=networking-lab --rm -it --restart=Never -- wget -qO- --timeout=5 http://web-service
```

### Step 8: Allow Specific Traffic

Create a file named `network-policy-allow-web.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-web-traffic
  namespace: networking-lab
spec:
  podSelector:
    matchLabels:
      app: web
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 80
```

Apply the policy:

```bash
kubectl apply -f network-policy-allow-web.yaml
```

Also allow DNS:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: networking-lab
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
```

```bash
kubectl apply -f network-policy-allow-dns.yaml
```

Now test again (should work):

```bash
kubectl run test-pod --image=busybox --namespace=networking-lab --rm -it --restart=Never -- wget -qO- http://web-service
```

### Step 9: Verify Network Policy Enforcement

Try accessing from a different namespace (should fail):

```bash
kubectl create namespace other-namespace
kubectl run test-pod --image=busybox --namespace=other-namespace --rm -it --restart=Never -- wget -qO- --timeout=5 http://web-service.networking-lab
```

### Step 10: Clean Up

Delete the namespace:

```bash
kubectl delete namespace networking-lab
kubectl delete namespace other-namespace
```

## Concepts: Understanding Kubernetes Networking

### The Kubernetes Networking Model

Kubernetes imposes the following fundamental requirements on any networking implementation:

1. **Pods can communicate with all other pods** on any node without NAT
2. **Agents on a node** can communicate with all pods on that node
3. **Pods in the host network** can communicate with all pods on all nodes without NAT

This creates a "flat" network where every pod gets its own IP address and can communicate directly with other pods.

### Services: The Abstraction Layer

Pods are ephemeral—they can be created, destroyed, and moved around. Their IP addresses change. Services provide a stable endpoint for accessing a set of pods.

**How Services Work:**

1. Service gets a stable virtual IP (ClusterIP)
2. kube-proxy maintains iptables/IPVS rules on each node
3. Traffic to the Service IP is load-balanced to backend pods
4. Service selector determines which pods receive traffic

### Service Types

**ClusterIP (Default)**
- Service is only accessible within the cluster
- Gets a virtual IP from the service CIDR range
- Used for internal communication between services

**NodePort**
- Exposes service on each node's IP at a static port (30000-32767)
- Automatically creates a ClusterIP service
- External traffic → NodePort → ClusterIP → Pods
- Use case: Simple external access, development environments

**LoadBalancer**
- Exposes service externally using cloud provider's load balancer
- Automatically creates NodePort and ClusterIP services
- Cloud provider provisions external load balancer
- Use case: Production external access on cloud platforms

**ExternalName**
- Maps service to a DNS name
- No proxying, just DNS CNAME record
- Use case: Accessing external services with a consistent internal name

### Ingress: HTTP/HTTPS Routing

Ingress provides HTTP and HTTPS routing to services based on hostnames and paths. Unlike Services, Ingress is not a service type—it's a separate resource that sits in front of services.

**Benefits of Ingress:**

- **Single entry point**: One load balancer for multiple services
- **Host-based routing**: Route based on hostname (virtual hosting)
- **Path-based routing**: Route based on URL path
- **TLS termination**: Handle SSL/TLS certificates centrally
- **Cost effective**: One load balancer instead of many

**Ingress Controllers:**

Ingress resources don't do anything by themselves—you need an Ingress controller:

- **NGINX Ingress Controller**: Most popular, feature-rich
- **Traefik**: Modern, easy to use, automatic Let's Encrypt
- **HAProxy Ingress**: High performance
- **Cloud-specific**: AWS ALB, Google Cloud Load Balancer, Azure Application Gateway

### DNS in Kubernetes

Kubernetes runs a DNS service (typically CoreDNS) that provides DNS resolution for services and pods.

**Service DNS Names:**

Format: `<service-name>.<namespace>.svc.cluster.local`

- Within same namespace: Just use `<service-name>`
- Cross-namespace: Use `<service-name>.<namespace>`
- Fully qualified: Use full FQDN

**Pod DNS Names:**

Format: `<pod-ip-with-dashes>.<namespace>.pod.cluster.local`

Example: `10-244-1-5.default.pod.cluster.local`

### Network Policies: Microsegmentation

By default, Kubernetes allows all pods to communicate with each other. Network Policies provide firewall rules to control pod-to-pod traffic.

**Network Policy Features:**

- **Pod selector**: Which pods the policy applies to
- **Ingress rules**: Incoming traffic controls
- **Egress rules**: Outgoing traffic controls
- **Namespace selector**: Allow traffic from specific namespaces
- **IP block selector**: Allow traffic from specific CIDR blocks

**Important Notes:**

- Network Policies are additive (allow-list, not deny-list)
- Requires a CNI plugin that supports Network Policies (Calico, Cilium, Weave)
- Default deny-all is a common starting point
- Policies are applied at the pod level, not the service level

### Container Network Interface (CNI)

Kubernetes uses CNI plugins to set up pod networking. Popular CNI plugins include:

- **Calico**: Feature-rich, supports Network Policies, BGP routing
- **Cilium**: eBPF-based, high performance, observability
- **Flannel**: Simple, overlay network
- **Weave Net**: Encrypted overlay network
- **AWS VPC CNI**: Native AWS VPC networking
- **Multus**: Multiple network interfaces per pod

### Common Networking Patterns

**Service Mesh (Advanced):**
- Istio, Linkerd, Consul Connect
- Advanced traffic management, security, observability
- Sidecar proxies for each pod

**East-West Traffic:**
- Service-to-service communication within the cluster
- Use ClusterIP services
- Implement Network Policies for security

**North-South Traffic:**
- External traffic entering/leaving the cluster
- Use LoadBalancer or Ingress
- Implement TLS termination at Ingress

**Multi-Cluster Networking:**
- Connect pods across multiple clusters
- Tools: Submariner, Cilium Cluster Mesh, Istio multi-cluster

### Best Practices

1. **Use Services for discovery**: Don't rely on pod IPs
2. **Implement Network Policies**: Start with default deny-all
3. **Use Ingress for HTTP/HTTPS**: More cost-effective than multiple LoadBalancers
4. **Monitor network traffic**: Use tools like Cilium Hubble
5. **Plan IP address space**: Avoid CIDR conflicts
6. **Secure with TLS**: Use cert-manager for automatic certificate management
7. **Test network policies**: Verify policies work as expected
8. **Document network architecture**: Maintain diagrams of traffic flows

Understanding Kubernetes networking is essential for building secure, scalable applications.

## Resources

- [Kubernetes Networking Documentation](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
