# Module 1.2: How Hedgehog Works: The Control Model

**Course:** Course 1 - Foundations & Interfaces
**Duration:** 15 minutes
**Prerequisites:** Module 1.1: Welcome to Fabric Operations

---

## Introduction

### The Magic Explained

In Module 1.1, you used kubectl to explore the fabric. You saw switches, servers, and connections—all represented as Kubernetes resources. But how does typing `kubectl apply -f vpc.yaml` actually configure switches?

It's not magic. It's **declarative infrastructure** with a well-designed control loop. Understanding this pattern is the key to operating confidently: you'll know what's happening behind the scenes, when things are working, and how to detect when they're not.

### From Intent to Reality

**Traditional networking:** You configure each switch manually. If a switch reboots, you reconfigure it. If you want consistency, you write scripts.

**Hedgehog approach:** You declare your intent once. The fabric continuously reconciles actual state to match desired state. If a switch reboots, it automatically rejoins and reconfigures itself.

This is how hyperscalers run networks at scale—and now you can too.

### What You'll Learn

This module demystifies the control model:

- How CRDs represent network intent
- How controllers watch for changes and take action
- How switch agents apply configurations
- How to observe this process in real-time

You'll create your first VPC and watch the reconciliation happen step by step.

### Learning Objectives

By the end of this module, you will be able to:

1. **Explain the CRD reconciliation pattern** - Describe how desired state (kubectl apply) becomes actual state (switch configuration)
2. **Identify the key components** - Recognize Fabric Controller, Agent CRDs, and switch agents in the control flow
3. **Observe reconciliation in action** - Watch Kubernetes events as a VPC is created and configured
4. **Interpret Agent CRD status** - Use Agent CRD to view switch operational state and reconciliation progress
5. **Understand abstraction boundaries** - Explain what the operator manages (CRDs) vs. what the system manages (switch configs)

---

## Core Concepts

### Concept 1: Desired State vs. Current State

Every declarative system has two views of the world:

**Desired State:** What you want (defined in CRDs)

```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: my-vpc
spec:
  subnets:
    default:
      subnet: 10.10.1.0/24
      vlan: 1001
```

**Current State:** What exists right now (switch configurations, actual VLANs, routes)

**The Control Loop:** Continuously measures the gap and takes actions to close it.

```
┌─────────────┐
│ Desired     │  "I want VPC with VLAN 1001"
│ State       │
│ (CRD)       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Controller  │  "Compare desired vs. current"
│ Loop        │  "Generate switch configs"
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Current     │  "VLAN 1001 is configured on switches"
│ State       │
│ (Switches)  │
└─────────────┘
```

If current ≠ desired, the controller takes action. If current = desired, nothing happens (idempotent).

### Concept 2: The Hedgehog Control Plane Components

**Three key actors:**

**1. Fabric Controller (Control Plane)**

- Runs in Kubernetes (fab namespace)
- Watches for CRD changes (VPC, VPCAttachment, etc.)
- Computes desired switch configurations
- Generates Agent CRD specs (instructions for switches)
- Doesn't directly touch switches—works through Agents

**2. Agent CRD (Bridge)**

- One Agent CRD per switch (lives in Kubernetes)
- Contains two key sections:
  - `spec`: Desired configuration (written by Fabric Controller)
  - `status`: Current state (reported by switch agent)
- The "contract" between controller and switch

**3. Switch Agent (On Each Switch)**

- Runs on SONiC switches (not in Kubernetes)
- Watches its Agent CRD for spec changes
- Applies configurations via gNMI (SONiC config interface)
- Reports status back to Agent CRD (NOS version, interface states, BGP neighbors, etc.)

**Data Flow:**

```
You                  Fabric Controller       Agent CRD         Switch Agent        SONiC Switch
│                           │                    │                  │                    │
├─ kubectl apply vpc.yaml ─>│                    │                  │                    │
│                           │                    │                  │                    │
│                           ├─ Watch VPC CRD     │                  │                    │
│                           ├─ Compute config    │                  │                    │
│                           │                    │                  │                    │
│                           ├─ Update Agent spec ───>               │                    │
│                           │                    │                  │                    │
│                           │                    │<── Watch spec ───┤                    │
│                           │                    │                  │                    │
│                           │                    │                  ├─ Apply via gNMI ──>│
│                           │                    │                  │                    │
│                           │                    │                  │<─── Config ACK ────┤
│                           │                    │                  │                    │
│                           │                    │<── Report status─┤                    │
│                           │                    │                  │                    │
│<─── kubectl get vpc ──────┤                    │                  │                    │
│     (shows Ready)         │                    │                  │                    │
```

### Concept 3: Reconciliation and Events

When you apply a CRD, a series of events occurs:

**Example: Creating a VPC**

1. **Created:** VPC object appears in Kubernetes
2. **Reconciling:** Fabric Controller picks up the change
3. **Computing:** Controller calculates which switches need configuration
4. **Agent Update:** Controller writes specs to relevant Agent CRDs
5. **Applying:** Switch agents apply configurations via gNMI
6. **Status Report:** Agents report success back to Agent CRD status
7. **Ready:** VPC status becomes Ready (when all switches configured)

Each step generates **Kubernetes events** that you can observe:

```bash
kubectl get events --field-selector involvedObject.name=my-vpc

# Example events:
# Normal  Created         VPC created
# Normal  Reconciling     Fabric controller processing
# Normal  AgentUpdated    Agent specs generated
# Normal  Ready           VPC reconciliation complete
```

Events are your window into the control loop.

### Concept 4: Why This Model Matters for Operators

**Benefits:**

1. **Self-healing:** Switch reboots? Agent reapplies config automatically
2. **Declarative:** Describe what you want, not how to configure it
3. **Idempotent:** Apply the same YAML repeatedly—safe and predictable
4. **Observable:** Events and Agent status show exactly what's happening
5. **Git-friendly:** CRDs are YAML files—version control, code review, GitOps

**What You Control:**

- VPC definitions (subnets, VLANs, DHCP)
- VPCAttachments (which servers connect to which VPCs)
- VPCPeering (inter-VPC connectivity)
- External connectivity (border leaf peering)

**What the System Controls:**

- Individual switch configurations (SONiC config DB)
- BGP peering between switches
- VXLAN tunnel setup
- Route distribution

You work at a higher abstraction level—the system handles the complexity. This isn't a limitation; it's **empowerment**. You're freed from managing thousands of configuration lines across dozens of switches, allowing you to focus on network intent rather than implementation details.

### Concept 5: The Agent CRD as Source of Truth

Remember from Module 1.1: Most Hedgehog CRDs have minimal status fields. The real operational state lives in **Agent CRDs**.

**Agent CRD contains:**

- NOS version (SONiC version)
- Platform info (switch model)
- Interface states (up/down, speed)
- BGP neighbor status (established, down)
- ASIC resource usage (routes, nexthops)
- System health metrics

**Why this matters:**

- VPC says "Ready" but you want to see *which switches* configured it → Check Agent CRDs
- Troubleshooting connectivity → Check Agent CRD for interface status
- Monitoring fabric health → Watch Agent CRD status fields

Agent CRDs are your deep observability layer.

---

## Hands-On Lab

### Lab Title: Create a VPC and Observe Reconciliation

**Overview:**

You'll create your first VPC, watch Kubernetes events as it reconciles, and inspect Agent CRDs to see how switches report their state. This is your first time *creating* something (not just exploring), and you'll see the control loop in action.

**Environment:**

- Same Hedgehog vlab from Module 1.1
- kubectl access to create VPCs
- Events visible during active reconciliation

---

### Task 1: Prepare to Observe

**Objective:** Open a second terminal to watch events in real-time (optional but recommended)

**Steps (if using two terminals):**

```bash
# Terminal 1: You'll create the VPC here
# (this is your main terminal)

# Terminal 2 (optional): Watch events continuously
kubectl get events --watch --field-selector involvedObject.kind=VPC

# This will stream events as they happen
# You'll see events appear as you create the VPC in Terminal 1
```

**Note:** If you only have one terminal, you can view events after creating the VPC—it works fine, just less dramatic!

**Success Criteria:**

- ✅ Have terminal(s) ready
- ✅ kubectl access verified

---

### Task 2: Create Your First VPC

**Objective:** Create a simple VPC and apply it to the fabric

**Steps:**

**Create VPC YAML:**

```bash
cat > test-vpc.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: test-vpc
  namespace: default
spec:
  ipv4Namespace: default
  vlanNamespace: default
  subnets:
    default:
      subnet: 10.99.1.0/24
      gateway: 10.99.1.1
      vlan: 1999
      dhcp:
        enable: true
        range:
          start: 10.99.1.10
          end: 10.99.1.99
EOF
```

**Apply the VPC:**

```bash
kubectl apply -f test-vpc.yaml

# Expected output:
# vpc.vpc.githedgehog.com/test-vpc created
```

**Immediately check events (Terminal 1):**

```bash
kubectl get events --field-selector involvedObject.name=test-vpc --sort-by='.lastTimestamp'

# You should see events like:
# Normal  Created         VPC test-vpc created
# Normal  Reconciling     Processing VPC configuration
# (more events as reconciliation progresses)
```

**Validation:**

```bash
# Check VPC status
kubectl get vpc test-vpc

# Expected output:
# NAME       AGE
# test-vpc   30s

# Get full VPC details
kubectl get vpc test-vpc -o yaml | grep -A 5 status:

# Status may be empty {} initially, or show conditions
```

**Success Criteria:**

- ✅ VPC created without errors
- ✅ Events visible showing reconciliation
- ✅ VPC object exists in cluster

---

### Task 3: Observe Agent CRD Updates

**Objective:** See how the Fabric Controller updates Agent CRDs with configuration

**Steps:**

```bash
# View all Agent CRDs (one per switch)
kubectl get agents -n fab

# Expected output:
# NAME       AGE
# leaf-01    Xh
# leaf-02    Xh
# ... (7 agents total)
```

**Inspect an Agent to see configuration:**

```bash
# Look at leaf-01's Agent CRD
kubectl get agent leaf-01 -n fab -o yaml | head -50

# Look for these sections:
# - spec: Contains desired configuration (from Fabric Controller)
# - status: Contains switch operational state (from switch agent)
```

**Check Agent status for VPC-related info:**

```bash
# View Agent status (switch reported state)
kubectl get agent leaf-01 -n fab -o yaml | grep -A 20 "status:"

# Look for:
# - nos.version: SONiC version
# - platform: Switch platform info
# - interfaces: Interface states
# - bgpNeighbors: BGP peering status (if relevant)
```

**Observation Questions:**

1. Can you see the NOS version in the Agent status? _______
2. Are interfaces listed in the status? _______
3. What information does the Agent provide that VPC doesn't? _______

**Success Criteria:**

- ✅ Can view Agent CRDs
- ✅ Can see spec and status sections
- ✅ Understand Agent shows switch operational state

---

### Task 4: Verify VPC is Ready

**Objective:** Confirm reconciliation completed successfully

**Steps:**

```bash
# Check VPC status (wait 30-60 seconds after creation)
kubectl get vpc test-vpc -o yaml | grep -A 10 status:

# Look for status fields (may be minimal or empty)
```

**Check recent events:**

```bash
kubectl get events --field-selector involvedObject.name=test-vpc --sort-by='.lastTimestamp' | tail -10

# Look for "Ready" or "ReconcileSuccess" events
```

**Describe the VPC:**

```bash
kubectl describe vpc test-vpc

# Look at the Events section at the bottom
# Should show creation, reconciliation, and completion
```

**Key Insight:**

Even if VPC status is minimal, **events tell the story**. You can see:

- When VPC was created
- When controller reconciled it
- If any errors occurred
- When reconciliation completed

**Success Criteria:**

- ✅ VPC shows no error events
- ✅ Reconciliation events visible
- ✅ VPC object stable (can be retrieved without errors)

---

### Task 5: Optional - Modify and Re-Reconcile

**Objective:** See reconciliation happen again when you change desired state

**Steps:**

**Modify the VPC (add a second subnet):**

```bash
cat > test-vpc-updated.yaml <<'EOF'
apiVersion: vpc.githedgehog.com/v1beta1
kind: VPC
metadata:
  name: test-vpc
  namespace: default
spec:
  ipv4Namespace: default
  vlanNamespace: default
  subnets:
    default:
      subnet: 10.99.1.0/24
      gateway: 10.99.1.1
      vlan: 1999
      dhcp:
        enable: true
        range:
          start: 10.99.1.10
          end: 10.99.1.99
    backend:
      subnet: 10.99.2.0/24
      gateway: 10.99.2.1
      vlan: 1998
EOF
```

**Apply the update:**

```bash
kubectl apply -f test-vpc-updated.yaml

# Expected output:
# vpc.vpc.githedgehog.com/test-vpc configured
```

**Watch events:**

```bash
kubectl get events --field-selector involvedObject.name=test-vpc --sort-by='.lastTimestamp' | tail -10

# You should see new reconciliation events as the update is applied
```

**Observe:** The controller detects the change, updates Agent specs, switches reconfigure—all automatically.

**Success Criteria:**

- ✅ Update applied without errors
- ✅ New reconciliation events visible
- ✅ VPC now has two subnets (verify with `kubectl get vpc test-vpc -o yaml`)

---

### Lab Summary

**What you did:**

- ✅ Created your first VPC using kubectl apply
- ✅ Watched Kubernetes events during reconciliation
- ✅ Inspected Agent CRDs to see switch operational state
- ✅ Verified VPC reconciliation completed successfully
- ✅ (Optional) Modified VPC and watched re-reconciliation

**What you learned:**

- Declarative infrastructure: You declare desired state, the system reconciles
- Control loop: Fabric Controller → Agent CRD → Switch Agent → SONiC
- Events are your observability window into reconciliation
- Agent CRDs contain deep switch operational state
- Changes are automatically reconciled (self-healing)

**Key insight:** You didn't log into a single switch, yet network configuration happened across the fabric. That's the power of the abstraction—and why understanding the control model lets you operate confidently.

---

## Wrap-Up

### Key Takeaways

1. **Desired state (CRD) → Actual state (switches)** via the reconciliation loop
2. **Three actors:** Fabric Controller, Agent CRD, Switch Agent
3. **Events show progress:** Watch reconciliation happen in real-time
4. **Agent CRDs are deep observability:** Switch operational state lives here
5. **Abstraction means power:** You manage intent, the system handles complexity

### Real-World Impact

You now understand:

- Why kubectl apply is safe (idempotent, declarative)
- What "reconciling" means (closing the gap between desired and actual)
- Where to look when troubleshooting (events, Agent CRD status)
- Why Hedgehog is self-healing (continuous reconciliation)

### Preview of Module 1.3

Next, you'll go deeper into **kubectl and YAML workflows**: how to write VPC specs, validate before applying, use kubectl efficiently, and follow best practices for managing CRDs. You'll become fluent in the primary tool you'll use daily.

---

## Assessment

### Quiz Questions

**Question 1: Multiple Choice**

In the Hedgehog control model, what is the role of the **Fabric Controller**?

- A) Directly configures switches via SSH
- B) Watches CRDs, computes configurations, updates Agent CRD specs
- C) Runs on switches and applies configurations
- D) Stores VPC definitions in a database

**Correct Answer:** B

**Explanation:**

The Fabric Controller runs in Kubernetes, watches for CRD changes (VPCs, VPCAttachments, etc.), computes desired switch configurations, and writes them to Agent CRD specs. It doesn't directly touch switches (that's the Switch Agent's job, C), doesn't use SSH (A), and CRDs are stored in Kubernetes etcd, not a separate database (D).

---

**Question 2: Scenario-Based**

You create a VPC with `kubectl apply -f vpc.yaml`. What is the correct order of operations?

1. Switch Agent applies config via gNMI
2. Fabric Controller updates Agent CRD spec
3. VPC CRD created in Kubernetes
4. Fabric Controller watches VPC CRD and computes config

**Answer:** 3 → 4 → 2 → 1

**Explanation:**

Correct flow: VPC CRD created (3), Fabric Controller watches and computes (4), Controller updates Agent spec (2), Switch Agent applies via gNMI (1). This is the reconciliation loop in action.

---

**Question 3: True/False**

True or False: If a switch reboots, you must manually re-run `kubectl apply` to reconfigure it.

**Answer:** False

**Explanation:**

The switch agent automatically re-reads its Agent CRD when it comes back online and reapplies all configurations. This is **self-healing**—one of the key benefits of declarative infrastructure. Manual intervention is not required.

---

**Question 4: Multiple Choice**

Where can you find detailed information about a switch's BGP neighbors and interface states?

- A) VPC CRD status field
- B) Agent CRD status field
- C) Fabric Controller logs only
- D) You must SSH into the switch

**Correct Answer:** B

**Explanation:**

Agent CRD status contains comprehensive switch operational state reported by the switch agent, including BGP neighbors, interface states, ASIC resources, and NOS version. VPC status (A) is minimal. Controller logs (C) help but aren't the primary source. SSH (D) is possible but not the operator's tool—kubectl is.

---

**Question 5: Practical**

You create a VPC but want to verify reconciliation completed successfully. What kubectl commands would you use? (List 2)

**Answer:**

```bash
# Option 1: Check events for reconciliation status
kubectl get events --field-selector involvedObject.name=<vpc-name> --sort-by='.lastTimestamp'

# Option 2: Describe VPC to see events in summary
kubectl describe vpc <vpc-name>

# Option 3: Get VPC status (if populated)
kubectl get vpc <vpc-name> -o yaml | grep -A 10 status:
```

**Rubric:**

- Full credit: Any 2 valid commands that show reconciliation status
- Partial credit: 1 valid command
- No credit: Commands that don't reveal reconciliation state

---

### Practical Assessment

**Task:** Create a VPC, verify it reconciled successfully, then delete it cleanly.

**Steps:**

1. Create VPC with `kubectl apply -f vpc.yaml`
2. Use kubectl to verify reconciliation (events or describe)
3. Delete VPC with `kubectl delete vpc <name>`
4. Verify deletion completed (no lingering resources)

**Success Criteria:**

- ✅ VPC created without errors
- ✅ Used appropriate kubectl commands to verify reconciliation
- ✅ Can explain what events indicate success
- ✅ Deleted VPC cleanly
- ✅ Understands reconciliation happened both on create and delete

---

## Reference

### Hedgehog CRDs Used in This Module

**VPC** - Virtual Private Cloud with isolated subnets

- View: `kubectl get vpc`
- Inspect: `kubectl describe vpc <name>`
- Apply: `kubectl apply -f vpc.yaml`
- [Full Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md#vpc)

**Agent** - Switch agent containing detailed operational state

- View: `kubectl get agents -n fab`
- Inspect: `kubectl get agent <switch-name> -n fab -o yaml`
- [Full Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md#agent)

### kubectl Commands Reference

**VPC creation:**

```bash
kubectl apply -f vpc.yaml        # Create or update VPC
kubectl get vpc <name>           # View VPC summary
kubectl describe vpc <name>      # View VPC details and events
kubectl get vpc <name> -o yaml   # View full VPC YAML
kubectl delete vpc <name>        # Delete VPC
```

**Event observation:**

```bash
kubectl get events --field-selector involvedObject.name=<name>  # Filter events by resource
kubectl get events --watch                                      # Watch events in real-time
kubectl get events --sort-by='.lastTimestamp'                   # Sort events by time
kubectl describe vpc <name>                                     # View events in context
```

**Agent CRD inspection:**

```bash
kubectl get agents -n fab                         # List all agents
kubectl get agent <switch-name> -n fab -o yaml    # View agent details
kubectl describe agent <switch-name> -n fab       # View agent summary
```

### Workflow Reference

This module uses **Workflow 1: Create VPC from Scratch** from the workflow reference:

- [WORKFLOWS.md - Workflow 1](../../../network-like-hyperscaler/research/WORKFLOWS.md#workflow-1-create-vpc-from-scratch)

### Related Documentation

- [Hedgehog Learning Philosophy](../../../network-like-hyperscaler/hedgehogLearningPhilosophy.md)
- [CRD Reference](../../../network-like-hyperscaler/research/CRD_REFERENCE.md)
- [Module Dependency Graph](../../../network-like-hyperscaler/MODULE_DEPENDENCY_GRAPH.md)

---

**Module Complete!** Ready to continue to Module 1.3: Interfaces: kubectl/YAML.
