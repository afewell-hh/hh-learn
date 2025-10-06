---
title: "Kubernetes Storage: Persistent Volumes and Storage Classes"
slug: "kubernetes-storage"
difficulty: "intermediate"
estimated_minutes: 60
version: "1.0.0"
validated_on: "2025-10-06"
tags:
  - kubernetes
  - storage
  - persistent-volumes
  - pvc
  - storage-classes
description: "Master Kubernetes storage concepts including Persistent Volumes, PersistentVolumeClaims, and StorageClasses through hands-on labs."
---

# Kubernetes Storage: Persistent Volumes and Storage Classes

## Overview

Containers are ephemeral by design, but many applications require persistent data that survives pod restarts and rescheduling. This module explores Kubernetes storage abstractions that enable stateful applications to run reliably in your cluster.

## Learning Objectives

- Understand the difference between ephemeral and persistent storage
- Create and manage Persistent Volumes (PV)
- Use PersistentVolumeClaims (PVC) to request storage
- Configure and use StorageClasses for dynamic provisioning
- Implement storage in real-world application scenarios
- Understand volume access modes and reclaim policies

## Lab: Working with Kubernetes Storage

### Prerequisites

- Completed "Introduction to Kubernetes" module
- kubectl CLI installed and configured
- A running Kubernetes cluster with storage capabilities
- Basic understanding of pods and deployments

### Step 1: Set Up the Lab Environment

Create a namespace for this lab:

```bash
kubectl create namespace storage-lab
```

Verify your cluster's default storage class:

```bash
kubectl get storageclass
```

Most clusters come with a default StorageClass (marked with `(default)` annotation). This will be used for dynamic provisioning.

### Step 2: Create a PersistentVolume Manually

First, let's create a static PersistentVolume. Create a file named `manual-pv.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: manual-pv
  labels:
    type: local
spec:
  storageClassName: manual
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: "/mnt/data"
  persistentVolumeReclaimPolicy: Retain
```

Apply the PersistentVolume:

```bash
kubectl apply -f manual-pv.yaml
```

View the PersistentVolume:

```bash
kubectl get pv manual-pv
```

The STATUS should show "Available", meaning it's ready to be claimed.

### Step 3: Create a PersistentVolumeClaim

Now let's claim the storage we just created. Create `manual-pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: manual-pvc
  namespace: storage-lab
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

Apply the PersistentVolumeClaim:

```bash
kubectl apply -f manual-pvc.yaml
```

Check the PVC status:

```bash
kubectl get pvc -n storage-lab
```

The STATUS should show "Bound", indicating it's successfully bound to the PV. Verify the binding:

```bash
kubectl get pv manual-pv
```

The STATUS should now show "Bound" and the CLAIM column should reference your PVC.

### Step 4: Use the PVC in a Pod

Create a pod that uses the PersistentVolumeClaim. Create `pod-with-pvc.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: storage-demo-pod
  namespace: storage-lab
spec:
  containers:
  - name: nginx
    image: nginx:1.21
    ports:
    - containerPort: 80
    volumeMounts:
    - name: persistent-storage
      mountPath: /usr/share/nginx/html
  volumes:
  - name: persistent-storage
    persistentVolumeClaim:
      claimName: manual-pvc
```

Deploy the pod:

```bash
kubectl apply -f pod-with-pvc.yaml
```

Wait for the pod to be running:

```bash
kubectl get pod storage-demo-pod -n storage-lab -w
```

Press Ctrl+C once the pod is running.

### Step 5: Test Data Persistence

Write data to the persistent volume:

```bash
kubectl exec storage-demo-pod -n storage-lab -- sh -c "echo 'Hello from Persistent Storage!' > /usr/share/nginx/html/index.html"
```

Verify the data:

```bash
kubectl exec storage-demo-pod -n storage-lab -- cat /usr/share/nginx/html/index.html
```

Test with port-forwarding:

```bash
kubectl port-forward pod/storage-demo-pod -n storage-lab 8080:80
```

Visit `http://localhost:8080` in your browser - you should see your custom message. Press Ctrl+C to stop port-forwarding.

### Step 6: Demonstrate Data Persistence Across Pod Deletion

Delete the pod:

```bash
kubectl delete pod storage-demo-pod -n storage-lab
```

Recreate the pod:

```bash
kubectl apply -f pod-with-pvc.yaml
```

Wait for it to be running, then check if the data persisted:

```bash
kubectl exec storage-demo-pod -n storage-lab -- cat /usr/share/nginx/html/index.html
```

The data should still be there! This demonstrates that data persists beyond the pod lifecycle.

### Step 7: Dynamic Provisioning with StorageClasses

Now let's use dynamic provisioning. Create `dynamic-pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
  namespace: storage-lab
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
  # storageClassName omitted to use default StorageClass
```

Apply the PVC:

```bash
kubectl apply -f dynamic-pvc.yaml
```

Watch as Kubernetes automatically provisions a PV:

```bash
kubectl get pvc dynamic-pvc -n storage-lab -w
```

Once bound, check the automatically created PV:

```bash
kubectl get pv
```

You'll see a new PV was created automatically to satisfy the claim!

### Step 8: Create a StatefulSet with Persistent Storage

StatefulSets are perfect for stateful applications. Create `statefulset-storage.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-svc
  namespace: storage-lab
spec:
  clusterIP: None
  selector:
    app: nginx-stateful
  ports:
  - port: 80
    name: web
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
  namespace: storage-lab
spec:
  serviceName: "nginx-svc"
  replicas: 3
  selector:
    matchLabels:
      app: nginx-stateful
  template:
    metadata:
      labels:
        app: nginx-stateful
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: www
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: www
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 1Gi
```

Apply the StatefulSet:

```bash
kubectl apply -f statefulset-storage.yaml
```

Watch the StatefulSet pods being created:

```bash
kubectl get pods -n storage-lab -l app=nginx-stateful -w
```

Notice how they're created sequentially: web-0, web-1, web-2. Press Ctrl+C when all are running.

View the PVCs created automatically:

```bash
kubectl get pvc -n storage-lab
```

You should see three PVCs (www-web-0, www-web-1, www-web-2), one for each StatefulSet pod.

### Step 9: Test StatefulSet Storage Independence

Write unique data to each pod:

```bash
for i in 0 1 2; do
  kubectl exec web-$i -n storage-lab -- sh -c "echo 'Data from web-$i' > /usr/share/nginx/html/index.html"
done
```

Verify each pod has its own data:

```bash
for i in 0 1 2; do
  echo "Content from web-$i:"
  kubectl exec web-$i -n storage-lab -- cat /usr/share/nginx/html/index.html
done
```

Each pod should display its unique content, demonstrating that each has its own persistent storage.

### Step 10: Clean Up

Delete the StatefulSet and service:

```bash
kubectl delete statefulset web -n storage-lab
kubectl delete service nginx-svc -n storage-lab
```

Note: StatefulSet PVCs are not automatically deleted. Delete them manually:

```bash
kubectl delete pvc -n storage-lab -l app=nginx-stateful
```

Clean up other resources:

```bash
kubectl delete pod storage-demo-pod -n storage-lab --ignore-not-found
kubectl delete pvc manual-pvc dynamic-pvc -n storage-lab
kubectl delete pv manual-pv
kubectl delete namespace storage-lab
```

## Concepts

### The Storage Challenge in Kubernetes

Containers are designed to be stateless and ephemeral. When a container stops, all data inside it is lost. However, many real-world applications - databases, file servers, content management systems - require persistent data that survives container restarts, pod rescheduling, and even node failures.

Kubernetes solves this challenge through a sophisticated storage abstraction layer that separates storage management from application deployment.

### Volumes: The Foundation

Volumes are the most basic storage abstraction in Kubernetes. A volume is a directory accessible to containers in a pod. Unlike container filesystems, volumes have a lifetime matching the pod's lifetime (not the container's).

There are many volume types:
- **emptyDir**: Temporary storage that exists as long as the pod exists
- **hostPath**: Mounts a file or directory from the host node
- **configMap/secret**: Special volume types for configuration data
- **persistentVolumeClaim**: References a PersistentVolume (what we focus on in this module)

### PersistentVolumes (PV): The Storage Resources

A PersistentVolume is a piece of storage in the cluster that has been provisioned by an administrator or dynamically provisioned using StorageClasses. Think of it as a storage resource, similar to how a Node is a compute resource.

Key characteristics:
- **Lifecycle independent of pods**: PVs exist beyond pod lifecycles
- **Cluster-level resources**: Not namespaced; available cluster-wide
- **Can be statically or dynamically provisioned**
- **Various backend types**: NFS, iSCSI, cloud provider storage, etc.

PVs have several important properties:

**Capacity**: The amount of storage available
**Access Modes**:
- ReadWriteOnce (RWO): Volume can be mounted as read-write by a single node
- ReadOnlyMany (ROX): Volume can be mounted as read-only by many nodes
- ReadWriteMany (RWX): Volume can be mounted as read-write by many nodes
- ReadWriteOncePod (RWOP): Volume can be mounted as read-write by a single pod

**Reclaim Policy**: What happens when a PVC is deleted:
- Retain: Manual reclamation required; data is preserved
- Delete: PV and underlying storage are deleted automatically
- Recycle: Deprecated; basic scrub (rm -rf /volume/*)

### PersistentVolumeClaims (PVC): Requesting Storage

A PersistentVolumeClaim is a request for storage by a user. It's similar to how a pod consumes node resources - a PVC consumes PV resources.

PVCs specify:
- **Storage size**: How much storage is needed
- **Access modes**: How the storage will be accessed
- **StorageClass**: What type of storage (optional)

The key benefit of PVCs is abstraction: developers can request storage without knowing the underlying storage infrastructure details. This separation of concerns allows platform teams to manage storage separately from application teams.

### The Binding Process

When a PVC is created, Kubernetes tries to find a matching PV:

1. Kubernetes looks for a PV that satisfies the PVC's requirements (size, access mode, storage class)
2. If found, the PV is bound to the PVC (one-to-one relationship)
3. If no suitable PV exists and a StorageClass is specified, dynamic provisioning occurs
4. Once bound, the PVC can be used by pods

This binding is exclusive - a PV can only be bound to one PVC at a time.

### StorageClasses: Dynamic Provisioning

StorageClasses enable dynamic provisioning of storage. Instead of pre-creating PVs, administrators define StorageClasses that describe "classes" of storage available in the cluster.

Benefits of dynamic provisioning:
- **Eliminates pre-provisioning**: No need to create PVs manually
- **On-demand storage**: Storage is created when needed
- **Different storage tiers**: SSD vs HDD, local vs network, etc.
- **Cloud provider integration**: Automatically creates cloud storage resources

A StorageClass specifies:
- **Provisioner**: What system provisions the storage (AWS EBS, GCE PD, Azure Disk, etc.)
- **Parameters**: Provider-specific parameters (disk type, IOPS, etc.)
- **Reclaim policy**: What happens when PVC is deleted
- **Volume binding mode**: When to bind and provision (immediate or wait for pod)

### StatefulSets and Storage

StatefulSets are designed for stateful applications that need:
- Stable, unique network identifiers
- Stable, persistent storage
- Ordered, graceful deployment and scaling

Volume Claim Templates in StatefulSets automatically create a PVC for each pod replica. These PVCs are not deleted when the StatefulSet scales down or is deleted, preserving data for potential future use.

This makes StatefulSets perfect for databases, message queues, and other applications where each instance needs its own persistent state.

### Best Practices for Kubernetes Storage

1. **Use StorageClasses for dynamic provisioning**: Avoid manual PV creation in production
2. **Choose appropriate access modes**: Most applications need RWO; only use RWX when truly necessary
3. **Set resource requests appropriately**: Request the storage you need, not more
4. **Understand reclaim policies**: Use Retain for critical data, Delete for non-critical
5. **Monitor storage usage**: Track PV/PVC usage to avoid running out of space
6. **Consider backup strategies**: Storage persistence doesn't replace backups
7. **Use StatefulSets for stateful workloads**: Don't use Deployments with persistent storage
8. **Label and organize PVs/PVCs**: Use labels for easier management and troubleshooting

### Storage Performance Considerations

Different storage backends have vastly different performance characteristics:

- **Local storage**: Highest performance but not portable across nodes
- **Network block storage**: Good performance, portable, limited concurrent access
- **Network file storage**: Lower performance, fully portable, supports RWX
- **Cloud provider storage**: Performance varies by tier and type

Choose storage based on your application's requirements for performance, durability, and access patterns.

## Additional Resources

- [Kubernetes Storage Documentation](https://kubernetes.io/docs/concepts/storage/) - Official storage concepts guide
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) - Detailed PV and PVC documentation
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/) - StorageClass configuration and usage
- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) - StatefulSet concepts and patterns
- [Volume Snapshots](https://kubernetes.io/docs/concepts/storage/volume-snapshots/) - Creating and using storage snapshots

## Next Steps

Now that you understand Kubernetes storage, you're ready to:

- Explore advanced storage features like volume snapshots and cloning
- Learn about CSI (Container Storage Interface) drivers
- Implement storage solutions for real-world stateful applications
- Study disaster recovery and backup strategies for Kubernetes storage

Continue building your Kubernetes expertise with the next module on networking!
