---
title: "Kubernetes Storage: Persistent Volumes and Claims"
slug: "kubernetes-storage"
difficulty: "intermediate"
estimated_minutes: 45
version: "v1.30"
validated_on: "2025-10-01"
pathway_slug: "kubernetes-fundamentals"
pathway_name: "Kubernetes Fundamentals"
description: "Learn persistent storage in Kubernetes using Persistent Volumes, Persistent Volume Claims, and StorageClasses with a hands-on lab."
tags:
  - kubernetes
  - storage
  - persistent-volumes
  - stateful
---

# Kubernetes Storage: Persistent Volumes and Claims

Learn how to manage persistent storage in Kubernetes using Persistent Volumes (PVs), Persistent Volume Claims (PVCs), and Storage Classes.

## Lab: Working with Persistent Storage

### Prerequisites
- Completed "Introduction to Kubernetes" module
- Access to a Kubernetes cluster with a storage provisioner
- kubectl CLI configured

### Step 1: Create a Namespace

Create a namespace for this lab:

```bash
kubectl create namespace storage-lab
```

### Step 2: Create a Persistent Volume

Create a file named `pv.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data
```

Apply the PersistentVolume:

```bash
kubectl apply -f pv.yaml
```

Verify the PV was created:

```bash
kubectl get pv
```

The STATUS should show "Available".

### Step 3: Create a Persistent Volume Claim

Create a file named `pvc.yaml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: storage-lab
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
  storageClassName: manual
```

Apply the PVC:

```bash
kubectl apply -f pvc.yaml
```

Check the PVC status:

```bash
kubectl get pvc -n storage-lab
```

The PVC should be "Bound" to the PV.

### Step 4: Use the PVC in a Pod

Create a file named `pod-with-pvc.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: storage-pod
  namespace: storage-lab
spec:
  containers:
  - name: app
    image: nginx:latest
    volumeMounts:
    - mountPath: /usr/share/nginx/html
      name: storage
  volumes:
  - name: storage
    persistentVolumeClaim:
      claimName: my-pvc
```

Create the pod:

```bash
kubectl apply -f pod-with-pvc.yaml
```

Wait for the pod to be running:

```bash
kubectl wait --for=condition=Ready pod/storage-pod -n storage-lab --timeout=60s
```

### Step 5: Write Data to Persistent Storage

Write some content to the persistent volume:

```bash
kubectl exec -it storage-pod -n storage-lab -- /bin/bash -c "echo 'Hello from persistent storage!' > /usr/share/nginx/html/index.html"
```

Verify the content:

```bash
kubectl exec storage-pod -n storage-lab -- cat /usr/share/nginx/html/index.html
```

### Step 6: Test Persistence

Delete the pod:

```bash
kubectl delete pod storage-pod -n storage-lab
```

Recreate the pod using the same YAML:

```bash
kubectl apply -f pod-with-pvc.yaml
```

Wait for the pod to be ready:

```bash
kubectl wait --for=condition=Ready pod/storage-pod -n storage-lab --timeout=60s
```

Verify the data persisted:

```bash
kubectl exec storage-pod -n storage-lab -- cat /usr/share/nginx/html/index.html
```

You should see the same content!

### Step 7: Explore Storage Classes

List available storage classes in your cluster:

```bash
kubectl get storageclass
```

Get details on a storage class:

```bash
kubectl describe storageclass <storage-class-name>
```

### Step 8: Create a Dynamic PVC

Create a file named `dynamic-pvc.yaml`:

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
  storageClassName: <default-storage-class>
```

Replace `<default-storage-class>` with your cluster's default storage class, then apply:

```bash
kubectl apply -f dynamic-pvc.yaml
```

Watch the PV be automatically provisioned:

```bash
kubectl get pv,pvc -n storage-lab
```

### Step 9: Create a StatefulSet with Storage

Create a file named `statefulset.yaml`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
  namespace: storage-lab
spec:
  serviceName: "web"
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
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

Create the StatefulSet:

```bash
kubectl apply -f statefulset.yaml
```

Watch the pods and PVCs being created:

```bash
kubectl get pods,pvc -n storage-lab -w
```

Each pod gets its own PVC automatically!

### Step 10: Clean Up

Delete all resources:

```bash
kubectl delete namespace storage-lab
kubectl delete pv my-pv
```

## Concepts: Understanding Kubernetes Storage

### The Storage Problem in Kubernetes

By default, containers are ephemeral—when a Pod is deleted, all its data is lost. For stateful applications like databases, this is unacceptable. Kubernetes provides several abstractions to handle persistent storage.

### Storage Architecture

Kubernetes storage architecture consists of several key components:

1. **Persistent Volumes (PV)**: Cluster-wide storage resources
2. **Persistent Volume Claims (PVC)**: Requests for storage by users
3. **Storage Classes**: Dynamic provisioning of storage
4. **Volume Plugins**: Interfaces to storage systems

### Persistent Volumes (PV)

A PersistentVolume is a piece of storage in the cluster that has been provisioned by an administrator or dynamically provisioned using Storage Classes. It's a cluster resource, just like a node.

**Key Properties:**

- **Capacity**: Size of the storage
- **Access Modes**: How the volume can be mounted (ReadWriteOnce, ReadOnlyMany, ReadWriteMany)
- **Reclaim Policy**: What happens when the PVC is deleted (Retain, Recycle, Delete)
- **Storage Class**: For dynamic provisioning
- **Volume Type**: The underlying storage system (hostPath, NFS, AWS EBS, etc.)

### Persistent Volume Claims (PVC)

A PersistentVolumeClaim is a request for storage by a user. It's similar to how a Pod consumes node resources; a PVC consumes PV resources.

**Binding Process:**

1. User creates a PVC with desired storage size and access mode
2. Kubernetes finds a matching PV (or dynamically provisions one)
3. The PVC is bound to the PV
4. Pods can now use the PVC

### Access Modes

Storage can be mounted in different modes:

- **ReadWriteOnce (RWO)**: Volume can be mounted read-write by a single node
- **ReadOnlyMany (ROX)**: Volume can be mounted read-only by many nodes
- **ReadWriteMany (RWX)**: Volume can be mounted read-write by many nodes

Not all storage types support all access modes. For example, AWS EBS only supports RWO.

### Storage Classes

Storage Classes provide a way to describe different "classes" of storage. They enable dynamic provisioning of PVs.

**Benefits:**

- No manual PV creation by administrators
- Automatic provisioning when PVC is created
- Different tiers of storage (SSD vs HDD, fast vs slow)
- Cloud provider integration (AWS EBS, Google Persistent Disk, Azure Disk)

**Example Storage Class:**

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
```

### Reclaim Policies

When a PVC is deleted, the PV can be handled in three ways:

- **Retain**: Manual reclamation—PV still exists with data
- **Delete**: Automatically delete the PV and underlying storage
- **Recycle**: (Deprecated) Basic scrub and make available for new claim

For production workloads with important data, "Retain" is typically the safest choice.

### StatefulSets and Storage

StatefulSets are designed for stateful applications. They provide:

- **Stable network identifiers**: Each pod gets a predictable name
- **Stable storage**: PVCs persist across pod rescheduling
- **Ordered deployment and scaling**: Pods are created/deleted in order

The `volumeClaimTemplates` field in a StatefulSet automatically creates a PVC for each pod replica, ensuring each has dedicated storage.

### Best Practices

1. **Use Storage Classes**: Enable dynamic provisioning for flexibility
2. **Size appropriately**: Request storage sizes based on actual needs
3. **Choose correct access mode**: Use RWO when possible for better performance
4. **Set resource limits**: Prevent storage exhaustion
5. **Back up data**: Implement backup strategies for critical data
6. **Monitor usage**: Track storage consumption and performance
7. **Test persistence**: Verify data survives pod restarts
8. **Use StatefulSets for stateful apps**: Databases, message queues, etc.

### Common Use Cases

- **Databases**: PostgreSQL, MySQL, MongoDB with persistent data
- **Message Queues**: RabbitMQ, Kafka with durable messages
- **Shared Configuration**: ConfigMaps and Secrets mounted as volumes
- **Log Aggregation**: Persistent storage for log files
- **CI/CD Artifacts**: Build artifacts and caches

Understanding storage is crucial for running stateful applications successfully in Kubernetes.

## Resources

- [Kubernetes Storage Documentation](https://kubernetes.io/docs/concepts/storage/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Volume Snapshots](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)
