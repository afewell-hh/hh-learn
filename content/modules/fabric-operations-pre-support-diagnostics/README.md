---
title: "Pre-Support Diagnostic Checklist"
slug: "fabric-operations-pre-support-diagnostics"
difficulty: "intermediate"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - kubernetes
  - diagnostics
  - troubleshooting
  - support
  - escalation
description: "Execute systematic diagnostic collection and write effective support tickets with comprehensive evidence for fabric issue escalation."
order: 304
---

# Pre-Support Diagnostic Checklist

## Introduction

You've completed Modules 3.1-3.3, learning to:
- Query Prometheus metrics
- Interpret Grafana dashboards
- Check kubectl events and Agent CRD status

These skills enable you to self-resolve **many** common issues: VLAN conflicts, connection misconfigurations, subnet overlaps, and invalid CIDRs. When Grafana shows no traffic and kubectl events reveal a VLAN conflict, you know to choose a different VLAN. When a VPCAttachment fails because a connection doesn't exist, you fix the connection name. These are configuration errors—fixable with your observability toolkit.

But sometimes, despite your troubleshooting, you'll encounter issues that require **support escalation**:
- Controller crashes repeatedly
- Agent disconnects without clear cause
- Switch hardware failures
- VPC appears successful but traffic doesn't flow
- Performance degradation with unknown root cause
- Unexpected fabric behavior that doesn't match configuration

### The Critical Question

**When do I escalate versus keep troubleshooting?**

**And when I escalate, what information does support need?**

This module answers both questions. You'll learn a systematic approach to pre-escalation diagnostics that ensures you've tried basic troubleshooting, collected comprehensive evidence, and can make confident escalation decisions. You'll practice the complete workflow: checklist execution, diagnostic collection, escalation decision-making, and support ticket writing.

### The Support Philosophy

> **"Support is not a last resort—it's a strategic resource."**

Escalating early with good diagnostics is **better** than spending hours on an unsolvable problem. Support teams are partners in reliability, not judges of your troubleshooting ability. The key is knowing when to escalate and providing the right data when you do.

This module teaches you to:
1. **Try first** - Execute systematic health check to identify configuration issues
2. **Collect diagnostics** - Gather comprehensive evidence (kubectl + Grafana)
3. **Escalate confidently** - Make informed escalation decisions with complete data

### What You'll Learn

- **Pre-escalation diagnostic checklist** - Systematic 6-step health check before escalation
- **Evidence collection** - What to gather (kubectl, logs, events, Agent status, Grafana screenshots)
- **Escalation triggers** - When to escalate versus self-resolve
- **Support ticket best practices** - Clear problem statement with relevant diagnostics
- **Diagnostic package creation** - Bundle diagnostics for support team
- **Support boundaries** - Configuration issues versus bugs

### The Integration

This module brings together all Course 3 skills:

```
Module 3.1 (Prometheus)  ──┐
Module 3.2 (Grafana)     ──┼──> Complete
Module 3.3 (kubectl)     ──┘     Diagnostic
                                 Workflow
```

You'll use Prometheus queries, Grafana dashboards, kubectl events, and Agent CRD status together in a systematic escalation workflow. This integrated approach is what separates novice operators from experienced ones who can confidently navigate the boundary between self-resolution and escalation.

## Learning Objectives

By the end of this module, you will be able to:

1. **Execute diagnostic checklist** - Run comprehensive 6-step health check before escalation
2. **Collect fabric diagnostics systematically** - Gather kubectl outputs, logs, events, Agent status, and Grafana screenshots
3. **Identify escalation triggers** - Determine when to escalate versus self-resolve
4. **Write effective support tickets** - Document issues clearly with relevant diagnostics
5. **Package diagnostics** - Create diagnostic bundle for support team
6. **Understand support boundaries** - Know what support can help with versus operational configuration issues

## Prerequisites

- Module 3.1 completion (Fabric Telemetry Overview)
- Module 3.2 completion (Dashboard Interpretation)
- Module 3.3 completion (Events & Status Monitoring)
- Understanding of kubectl, Grafana, and Prometheus
- Experience with VPC troubleshooting from Course 2

## Scenario: Complete Pre-Escalation Diagnostic Collection

A user reports that their newly created VPC `customer-app-vpc` with VPCAttachment for `server-07` isn't working. Server-07 cannot reach other servers in the VPC. You'll execute the full diagnostic checklist, collect evidence, and determine if this requires escalation or self-resolution.

**Environment Access:**
- **Grafana:** http://localhost:3000
- **Prometheus:** http://localhost:9090
- **kubectl:** Already configured

### Task 1: Execute Pre-Escalation Checklist (3 minutes)

**Objective:** Systematically check fabric health using the 6-step checklist

The pre-escalation checklist ensures you've tried basic troubleshooting and collected necessary diagnostics before deciding whether to escalate. Each step answers specific questions about fabric health.

**Step 1.1: Kubernetes Resource Health**

```bash
# Check if VPC exists
kubectl get vpc customer-app-vpc
```

**Expected output:**
```
NAME                AGE
customer-app-vpc    5m
```

**What this tells you:** VPC resource was created successfully in Kubernetes.

```bash
# Check if VPCAttachment exists
kubectl get vpcattachment -A | grep server-07
```

**Expected output:**
```
NAMESPACE   NAME                           AGE
default     customer-app-vpc--server-07    4m
```

**What this tells you:** VPCAttachment resource exists for server-07.

```bash
# Check controller pods
kubectl get pods -n fab
```

**Expected output:**
```
NAME                                      READY   STATUS    RESTARTS   AGE
fabric-controller-manager-xxx             1/1     Running   0          2h
fabric-proxy-xxx                          1/1     Running   0          2h
```

**Look for:**
- ✅ All pods in `Running` state
- ❌ Pods in `CrashLoopBackOff` or `Error` state → escalation trigger

**If controller is crashing, escalate immediately** - this is not a configuration issue you can self-resolve.

---

**Step 1.2: Check Events**

```bash
# VPC events
kubectl get events --field-selector involvedObject.name=customer-app-vpc
```

**Expected output (healthy):**
```
LAST SEEN   TYPE     REASON              MESSAGE
5m          Normal   Created             VPC created successfully
5m          Normal   VNIAllocated        Allocated VNI 100010
5m          Normal   SubnetsConfigured   3 subnets configured
5m          Normal   Ready               VPC is ready
```

**Expected output (problem - VLAN conflict):**
```
LAST SEEN   TYPE      REASON          MESSAGE
5m          Normal    Created         VPC created successfully
4m          Warning   VLANConflict    VLAN 1010 already in use by vpc-prod/default
```

**What to look for:**
- ✅ `Normal` events: Created, VNIAllocated, SubnetsConfigured, Ready
- ❌ `Warning` events: ValidationFailed, VLANConflict, SubnetOverlap

```bash
# VPCAttachment events
kubectl describe vpcattachment customer-app-vpc--server-07
```

**Expected output (healthy):**
```
Events:
  Type    Reason              Message
  ----    ------              -------
  Normal  Created             VPCAttachment created
  Normal  ConnectionFound     Connection server-07--unbundled--leaf-04 found
  Normal  VLANConfigured      VLAN 1010 configured on leaf-04/Ethernet8
  Normal  Ready               VPCAttachment ready
```

**Expected output (problem - connection not found):**
```
Events:
  Type     Reason                Message
  ----     ------                -------
  Normal   Created               VPCAttachment created
  Warning  DependencyMissing     Connection server-07--mclag not found
```

**Decision point:**
- **Warning events with clear config errors** (VLAN conflict, connection not found) → self-resolve
- **No error events but server still can't communicate** → escalate

---

**Step 1.3: Agent Status**

```bash
# Which switch connects to server-07?
kubectl get connections -n fab | grep server-07
```

**Example output:**
```
server-07--unbundled--leaf-04
```

**Result:** server-07 is connected to leaf-04.

```bash
# Check leaf-04 agent
kubectl get agent leaf-04 -n fab
```

**Expected output:**
```
NAME       ROLE          DESCR    APPLIED   VERSION
leaf-04    server-leaf   VS-04    2m        v0.87.4
```

**What this tells you:** Agent is present, recently applied config (2m ago), running version v0.87.4.

```bash
# Check interface state
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.interfaces.Ethernet8}' | jq
```

**Expected output (healthy):**
```json
{
  "enabled": true,
  "admin": "up",
  "oper": "up",
  "mac": "00:11:22:33:44:55",
  "speed": "25G",
  "counters": {
    "inb": 123456789,
    "outb": 987654321,
    "ine": 0,
    "oute": 0
  }
}
```

**Look for:**
- ✅ `oper: "up"` - Interface operational
- ✅ Low error counters (`ine`, `oute` near 0)
- ❌ `oper: "down"` - Physical connectivity issue
- ❌ High error counters - Hardware or cabling issue

**If interface is down or has high errors, check physical cabling first.**

---

**Step 1.4: BGP Health**

```bash
# Check BGP neighbors for leaf-04
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq
```

**Expected output (healthy):**
```json
{
  "default": {
    "172.30.128.1": {
      "state": "established",
      "enabled": true,
      "localAS": 65104,
      "peerAS": 65100
    },
    "172.30.128.2": {
      "state": "established",
      "enabled": true,
      "localAS": 65104,
      "peerAS": 65100
    }
  }
}
```

**Look for:**
- ✅ All neighbors `state: "established"`
- ❌ `state: "idle"` or `state: "active"` → BGP session down

**Alternative: Query Prometheus for all BGP neighbors not established**

```bash
curl -s 'http://localhost:9090/api/v1/query?query=bgp_neighbor_state{state!="established"}' | jq
```

**Expected output (healthy):** `"result": []` (empty array)

**If BGP sessions are down, this affects fabric-wide routing. Check spine connectivity and BGP configuration.**

---

**Step 1.5: Grafana Dashboard Review**

Open Grafana and review relevant dashboards:

**Fabric Dashboard:**
- Navigate to http://localhost:3000 → Dashboards → "Hedgehog Fabric"
- Check: Are all BGP sessions up?
- Check: VPC count as expected?

**Interfaces Dashboard:**
- Navigate to "Hedgehog Interfaces"
- Find leaf-04/Ethernet8
- Check: Interface operational state (up/down)?
- Check: Any high error rates?
- Check: Is VLAN configured and visible?
- Check: Is there traffic flowing?

**Platform Dashboard:**
- Navigate to "Hedgehog Platform"
- Filter for leaf-04
- Check: High CPU/memory?
- Check: Temperature warnings?
- Check: Failed PSUs or fans?

**Logs Dashboard:**
- Navigate to "Hedgehog Logs"
- Filter for leaf-04
- Check: Recent ERROR logs?
- Check: What do error messages say?

**Critical Resources Dashboard:**
- Navigate to "Hedgehog Critical Resources"
- Check: Any ASIC resource > 90% utilization?

**What Grafana reveals:**
- Symptoms (interface down, no traffic, errors)
- Trends (when issue started)
- Correlated problems (multiple switches affected)

---

**Step 1.6: Controller and Agent Logs**

```bash
# Fabric controller logs (last 200 lines)
kubectl logs -n fab deployment/fabric-controller-manager --tail=200
```

**Look for:**
- ❌ `ERROR` or `PANIC` messages
- ❌ Reconciliation loops (same resource reconciling repeatedly)
- ❌ Unexpected crashes or restarts

```bash
# Filter for ERROR logs only
kubectl logs -n fab deployment/fabric-controller-manager --tail=200 | grep -i error
```

**If controller crashed recently, get previous logs:**

```bash
kubectl logs -n fab deployment/fabric-controller-manager --previous
```

**Agent logs (if needed - agents run on switches):**

Agents run on switches, not in Kubernetes. To check agent logs:

```bash
# SSH to switch
hhfab vlab ssh leaf-04

# Check agent service status
systemctl status hedgehog-fabric-agent

# View agent logs
journalctl -u hedgehog-fabric-agent -n 100
```

---

**Checklist Outcomes:**

After completing the 6-step checklist, you'll have one of two outcomes:

**A) Self-Resolvable Configuration Issue**

Examples:
- VLAN conflict → Change VLAN in VPC YAML
- Connection not found → Fix connection name in VPCAttachment
- Subnet overlap → Choose non-overlapping subnet
- Invalid CIDR notation → Fix CIDR in VPC YAML

**Action:** Fix configuration in Gitea, commit, verify resolution.

**B) Escalation-Worthy Issue**

Examples:
- Controller crashing repeatedly
- Agent disconnecting without clear cause
- No error events, but server can't communicate
- Configuration looks correct, but behavior is unexpected
- Hardware failures (beyond PSU/fan replacement)
- BGP sessions flapping without network issues

**Action:** Proceed to Task 2 (collect full diagnostics) and Task 4 (write support ticket).

**Success Criteria:**
- ✅ Executed all 6 checklist steps
- ✅ Identified whether issue is configuration error or escalation-worthy
- ✅ Documented findings for next steps

---

### Task 2: Collect Diagnostic Evidence (2-3 minutes)

**Objective:** Gather complete diagnostic bundle for support

If the checklist revealed an escalation-worthy issue, you need to collect comprehensive diagnostics. Support teams need specific data to troubleshoot effectively.

**Option A: Manual Collection**

Create a diagnostics directory and collect key resources:

```bash
# Create diagnostics directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTDIR="hedgehog-diagnostics-${TIMESTAMP}"
mkdir -p ${OUTDIR}

# Record problem description
echo "Issue: server-07 cannot reach other servers in customer-app-vpc" > ${OUTDIR}/diagnostic-timestamp.txt
date >> ${OUTDIR}/diagnostic-timestamp.txt
echo "" >> ${OUTDIR}/diagnostic-timestamp.txt
```

**Collect CRDs:**

```bash
# VPC resources
kubectl get vpc,vpcattachment,vpcpeering -A -o yaml > ${OUTDIR}/crds-vpc.yaml

# Wiring resources
kubectl get switches,servers,connections -n fab -o yaml > ${OUTDIR}/crds-wiring.yaml

# Agents
kubectl get agents -n fab -o yaml > ${OUTDIR}/crds-agents.yaml

# Namespaces
kubectl get ipv4namespace,vlannamespace -A -o yaml > ${OUTDIR}/crds-namespaces.yaml
```

**Collect Events:**

```bash
# All events, last hour
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > ${OUTDIR}/events.log

# Warning events only
kubectl get events --all-namespaces --field-selector type=Warning > ${OUTDIR}/events-warnings.log
```

**Collect Logs:**

```bash
# Fabric controller logs
kubectl logs -n fab deployment/fabric-controller-manager --tail=2000 > ${OUTDIR}/controller.log

# If controller crashed, get previous logs
kubectl logs -n fab deployment/fabric-controller-manager --previous > ${OUTDIR}/controller-previous.log 2>/dev/null || echo "No previous controller logs" > ${OUTDIR}/controller-previous.log
```

**Collect Status:**

```bash
# Pod status
kubectl get pods -n fab > ${OUTDIR}/pods-fab.txt
kubectl describe pods -n fab > ${OUTDIR}/pods-fab-describe.txt

# Agent list
kubectl get agents -n fab > ${OUTDIR}/agents-list.txt
```

**Collect Version Info:**

```bash
# Kubernetes version
kubectl version > ${OUTDIR}/kubectl-version.txt

# Controller version
kubectl get deployment -n fab fabric-controller-manager -o jsonpath='{.spec.template.spec.containers[0].image}' > ${OUTDIR}/controller-version.txt

# Agent versions
kubectl get agents -n fab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.version}{"\n"}{end}' > ${OUTDIR}/agent-versions.txt
```

**Collect Topology:**

```bash
# Fabric topology
kubectl get switches -n fab > ${OUTDIR}/switches.txt
kubectl get servers -n fab > ${OUTDIR}/servers.txt
kubectl get connections -n fab > ${OUTDIR}/connections.txt
```

**Collect Agent Details for Affected Switches:**

For server-07 connected to leaf-04:

```bash
# Full agent YAML
kubectl get agent leaf-04 -n fab -o yaml > ${OUTDIR}/agent-leaf-04.yaml

# BGP neighbors
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq > ${OUTDIR}/agent-leaf-04-bgp.json

# Interfaces
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.interfaces}' | jq > ${OUTDIR}/agent-leaf-04-interfaces.json

# Platform health
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.platform}' | jq > ${OUTDIR}/agent-leaf-04-platform.json
```

**Compress Diagnostics:**

```bash
# Create compressed bundle
tar czf ${OUTDIR}.tar.gz ${OUTDIR}

# Show result
echo "Diagnostics collected: ${OUTDIR}.tar.gz"
ls -lh ${OUTDIR}.tar.gz
```

---

**Option B: Use Diagnostic Script**

If you created the diagnostic collection script from Concept 5:

```bash
./diagnostic-collect.sh

# Follow prompts:
# Problem description: "server-07 cannot reach other servers in customer-app-vpc"
# Affected switches: leaf-04
```

The script automates the manual collection process above.

---

**Collect Grafana Screenshots:**

Support teams benefit from visual evidence showing symptoms in context.

**Interfaces Dashboard Screenshot:**
1. Navigate to Grafana → Dashboards → "Hedgehog Interfaces"
2. Filter to show leaf-04/Ethernet8
3. Ensure time range shows when issue occurred
4. Take screenshot (browser screenshot tool or Print Screen)
5. Save as `grafana-interfaces-leaf04-eth8.png`

**Logs Dashboard Screenshot:**
1. Navigate to "Hedgehog Logs"
2. Filter for `switch="leaf-04"`
3. Show any error logs
4. Take screenshot
5. Save as `grafana-logs-leaf04.png`

**Add screenshots to diagnostic bundle:**

```bash
# If screenshots in current directory
cp grafana-*.png ${OUTDIR}/
tar czf ${OUTDIR}.tar.gz ${OUTDIR}
```

---

**Success Criteria:**
- ✅ Diagnostic bundle created (.tar.gz file)
- ✅ Grafana screenshots captured
- ✅ All checklist items documented in diagnostic-timestamp.txt
- ✅ Bundle includes CRDs, events, logs, Agent status, versions, and topology

**What you've collected:**
- **Problem statement** in diagnostic-timestamp.txt
- **Kubernetes state** (CRDs, events, pods)
- **Controller logs** (current and previous)
- **Agent status** for affected switches
- **Version information** (controller, agents, Kubernetes)
- **Topology** (switches, connections, servers)
- **Visual evidence** (Grafana screenshots)

This comprehensive package gives support everything they need to investigate without requesting additional information.

---

### Task 3: Determine Escalation Decision (1 minute)

**Objective:** Decide if issue requires support escalation based on evidence

You've executed the checklist and collected diagnostics. Now make the escalation decision.

**Decision Matrix:**

**Self-Resolve: Configuration Errors (Do NOT Escalate)**

If you found clear configuration errors in kubectl events:

- **VLAN conflict** → Change VLAN in VPC YAML, commit to Gitea
- **Subnet overlap** → Change subnet in VPC YAML
- **Connection not found** → Fix connection name in VPCAttachment
- **Invalid CIDR** → Fix CIDR notation
- **Missing VPC reference** → Create VPC first, then VPCAttachment

**Action:** Fix in Gitea, commit, wait for ArgoCD sync, verify resolution in Grafana and kubectl.

**Example:**
```bash
# Found event: "VLAN 1010 already in use by vpc-prod"
# Check used VLANs
kubectl get vpc -o yaml | grep "vlan:" | sort -u

# Output:
# vlan: 1001
# vlan: 1010
# vlan: 1020

# Choose unused VLAN: 1011
# Edit customer-app-vpc in Gitea, change vlan: 1010 to vlan: 1011
# Commit → ArgoCD syncs → VPC reconciles successfully
```

---

**Escalate: Unexpected Behavior or System Issues**

If you encountered any of these scenarios:

**Controller Issues:**
- Controller pod CrashLoopBackOff
- Controller logs show PANIC or fatal errors
- Controller repeatedly restarting
- Reconciliation loops (same resource reconciling without success)

**Agent Issues:**
- Agent disconnects repeatedly (not due to switch reboot)
- Agent cannot connect to switch (switch reachable, credentials correct)
- Agent status shows unexpected errors

**Configuration Applied But Doesn't Work:**
- VPC/VPCAttachment shows "Ready" with no error events
- Configuration looks correct in kubectl and Agent CRD
- But traffic doesn't flow or server can't communicate
- No events explain the issue

**Hardware or Platform Issues:**
- Switch not booting (beyond your control)
- Switch kernel panics
- Hardware sensor errors (beyond PSU/fan replacement)

**Performance Issues:**
- Severe performance degradation (not explained by capacity)
- Controller taking very long to reconcile
- Metrics show impossible values

**Action:** Proceed to Task 4 (write support ticket).

---

**Document Your Decision:**

```bash
echo "Decision: [Self-Resolve / Escalate]" >> ${OUTDIR}/diagnostic-timestamp.txt
echo "Reason: [Brief explanation]" >> ${OUTDIR}/diagnostic-timestamp.txt
echo "" >> ${OUTDIR}/diagnostic-timestamp.txt
```

**Example (Self-Resolve):**
```
Decision: Self-Resolve
Reason: kubectl events show VLAN 1010 conflict with vpc-prod. Will change customer-app-vpc to VLAN 1011.
```

**Example (Escalate):**
```
Decision: Escalate
Reason: VPCAttachment shows Ready with no error events. Agent CRD shows VLAN configured correctly on leaf-04/Ethernet8. Interface is up. But server-07 cannot communicate with VPC. No events or logs explain issue.
```

**Success Criteria:**
- ✅ Clear escalation decision documented
- ✅ Reasoning based on checklist findings
- ✅ Next steps identified (fix config OR write support ticket)

---

### Task 4: Write Support Ticket (2 minutes)

**Objective:** Document issue with clear problem statement and diagnostics

If escalating, create a support ticket that enables efficient troubleshooting.

**Support Ticket Template:**

Create file `support-ticket.md` in your diagnostics directory:

```markdown
# Issue Summary

**Problem:** Server-07 cannot reach other servers in VPC customer-app-vpc despite successful VPCAttachment reconciliation

**Severity:** P3 (Minor - affects one server in dev environment)

**Impacted Resources:**
- VPC: customer-app-vpc
- Server: server-07
- Switch: leaf-04, Ethernet8

**Started:** 2025-10-17 14:30 UTC

**Recent Changes:** Created new VPC customer-app-vpc and attached server-07 (first server in this VPC)

---

# Environment

**Hedgehog Version:**
- Controller: ghcr.io/githedgehog/fabric-controller:v0.87.4
- Agents: v0.87.4 (all switches)

**Fabric Topology:**
- Spines: 2 (spine-01, spine-02)
- Leaves: 5 (leaf-01 through leaf-05)
- Servers: 10

**Kubernetes Version:**
Client: v1.31.2
Server: v1.31.1+k3s1

---

# Symptoms

**Observable Symptoms:**
1. kubectl shows VPC and VPCAttachment as "Ready" with no error events
2. Grafana Interfaces Dashboard shows leaf-04/Ethernet8 up with VLAN 1025 configured
3. Server-07 receives DHCP lease (10.20.10.15)
4. Server-07 cannot ping other servers in VPC (none attached yet - VPC has only this server)
5. Server-07 can ping gateway 10.20.10.1

**Expected Behavior:**
Server should have connectivity within VPC. Even with only one server, gateway should respond to all traffic.

**Actual Behavior:**
Server receives DHCP successfully and can reach gateway, but connectivity appears limited to gateway only.

---

# Diagnostics Completed

**Checklist:**
- [x] kubectl events checked - VPC and VPCAttachment show Normal events only
- [x] Agent status reviewed - leaf-04 ready, interface up, VLAN 1025 configured
- [x] BGP health verified - all sessions established
- [x] Grafana dashboards checked - interface shows up, VLAN configured, minimal traffic
- [x] Controller logs collected - no errors for customer-app-vpc
- [x] VPC/VPCAttachment CRDs collected (attached: crds-vpc.yaml)

**Troubleshooting Attempted:**
1. Verified VPC YAML has no VLAN conflicts (VLAN 1025 unused)
2. Verified VPCAttachment references correct connection (server-07--unbundled--leaf-04)
3. Checked Agent CRD - VLAN 1025 configured on Ethernet8, interface oper=up
4. Confirmed DHCPSubnet created (customer-app-vpc--default)
5. Server gets DHCP lease successfully (10.20.10.15)
6. Verified no permit list restrictions (VPC is not isolated)
7. Server can ping gateway 10.20.10.1

**Findings:**
All configuration appears correct per Hedgehog documentation. Server gets DHCP and can ping gateway, suggesting basic L2/L3 connectivity works. But full VPC connectivity unclear since no other servers attached yet.

**Question:** Is additional configuration required for single-server VPC? Or should gateway connectivity be sufficient validation at this stage before adding more servers?

---

# Attachments

**Diagnostic Bundle:** hedgehog-diagnostics-20251017-143000.tar.gz (2.3 MB)

**Contents:**
- crds-vpc.yaml, crds-wiring.yaml, crds-agents.yaml, crds-namespaces.yaml
- events.log, events-warnings.log
- controller.log, controller-previous.log
- agent-leaf-04.yaml, agent-leaf-04-bgp.json, agent-leaf-04-interfaces.json, agent-leaf-04-platform.json
- pods-fab.txt, pods-fab-describe.txt, agents-list.txt
- kubectl-version.txt, controller-version.txt, agent-versions.txt
- switches.txt, servers.txt, connections.txt
- grafana-interfaces-leaf04-eth8.png
- grafana-logs-leaf04.png

**Grafana Screenshots:**
- grafana-interfaces-leaf04-eth8.png - Shows leaf-04/Ethernet8 state, VLAN 1025, minimal traffic
- grafana-logs-leaf04.png - Shows no DHCP errors or unusual log entries

---

# Impact

**Users Affected:** 1 server (development environment)
**Business Impact:** Low (non-critical development environment)
**Workaround:** None identified

---

# Additional Context

This is the first VPC for customer-app workload. Testing connectivity before attaching additional servers to ensure configuration is correct. Uncertain if issue is configuration error or expected behavior when VPC has single server.

No similar issues observed with other VPCs (vpc-prod, vpc-staging) which have multiple servers attached and working connectivity.
```

---

**Key Principles for Effective Tickets:**

1. **Be Concise** - One-sentence summary at top
2. **Be Specific** - Exact resource names, timestamps, error messages
3. **Show Your Work** - List troubleshooting attempts and findings
4. **Attach Diagnostics** - Complete diagnostic bundle
5. **Describe Impact** - Severity, affected users, business impact
6. **Avoid Assumptions** - Report observations, not conclusions (unless clear)
7. **Include Screenshots** - Visual evidence from Grafana

**What NOT to include:**
- Speculation without evidence ("I think it might be...")
- Vague descriptions ("it's not working")
- Missing diagnostics ("I didn't collect logs")
- Emotional language ("this is frustrating")

**Tone:**
- Professional and factual
- Assume support is your partner, not adversary
- Provide context, not just symptoms

---

**Add ticket to diagnostic bundle:**

```bash
# Save support ticket
cp support-ticket.md ${OUTDIR}/

# Recompress bundle
tar czf ${OUTDIR}.tar.gz ${OUTDIR}

echo "Support ticket ready: ${OUTDIR}.tar.gz includes support-ticket.md"
```

---

**Success Criteria:**
- ✅ Clear, one-sentence problem statement
- ✅ Diagnostics attached and referenced
- ✅ Troubleshooting steps documented with results
- ✅ Impact and severity described
- ✅ Professional, concise, specific tone

**What happens next:**
1. Submit ticket to support portal
2. Attach diagnostic bundle (.tar.gz)
3. Reference Grafana screenshots in ticket
4. Support responds with initial findings or requests for clarification
5. Collaborate with support on resolution

**Average support response time** (varies by severity):
- P1 (Critical): < 1 hour
- P2 (Major): < 4 hours
- P3 (Minor): < 24 hours
- P4 (Question): < 48 hours

---

### Lab Summary

**What You Accomplished:**

You completed the full pre-escalation diagnostic workflow:
- ✅ Executed systematic 6-step health check (Kubernetes, events, agents, BGP, Grafana, logs)
- ✅ Collected comprehensive diagnostics (CRDs, events, logs, Agent status, versions, topology)
- ✅ Made escalation decision (self-resolve vs escalate)
- ✅ Wrote effective support ticket (clear, concise, with evidence)
- ✅ Created diagnostic bundle for support (compressed, complete, well-organized)

**Key Takeaways:**

1. **Checklist ensures thoroughness** - Don't skip steps, even if you think you know the issue
2. **Evidence collection is systematic** - kubectl + Grafana + logs provide complete picture
3. **Escalation triggers are clear** - Configuration errors = self-resolve, unexpected behavior = escalate
4. **Support tickets need specifics** - Problem statement + diagnostics + troubleshooting attempts
5. **Diagnostic automation saves time** - Script collection vs manual (see Concept 5)
6. **Early escalation with good data is better than endless troubleshooting**

**Real-World Application:**

This workflow applies to production fabric operations:
- When on-call and encountering fabric issues
- When users report VPC connectivity problems
- When Grafana alerts fire for fabric components
- When changes don't produce expected results

**The diagnostic checklist and support ticket template are directly usable in production.**

---

## Concepts & Deep Dive

### Concept 1: Pre-Escalation Diagnostic Checklist

The 6-step pre-escalation checklist is a systematic approach that ensures you've tried basic troubleshooting and collected necessary diagnostics before escalation.

**Why a Checklist?**

Studies show checklists improve outcomes in complex systems (aviation, medicine, infrastructure operations). They:
- Prevent skipping critical steps
- Reduce cognitive load during incidents
- Ensure consistent troubleshooting quality
- Build confidence in escalation decisions

**The 6-Step Checklist:**

**Step 1: Kubernetes Resource Health**

**Objective:** Verify all expected resources exist and controller is running

**Commands:**
```bash
# Check all fabric CRDs
kubectl get vpc,vpcattachment,vpcpeering -A
kubectl get switches,servers,connections,agents -n fab

# Check controller pods
kubectl get pods -n fab
```

**Questions to answer:**
- Are all expected resources present?
- Are controller pods running (not CrashLoopBackOff)?
- Are there any pods in error state?

**Escalate if:**
- Controller pods are crashing
- Resources exist but pods show errors

---

**Step 2: Kubernetes Events (Last 1 Hour)**

**Objective:** Check for configuration errors or reconciliation failures

**Commands:**
```bash
# Warning events (all namespaces)
kubectl get events --all-namespaces --field-selector type=Warning --sort-by='.lastTimestamp'

# VPC-specific events
kubectl get events --field-selector involvedObject.kind=VPC
kubectl get events --field-selector involvedObject.kind=VPCAttachment

# Events for specific resource
kubectl get events --field-selector involvedObject.name=<vpc-name>
```

**Questions to answer:**
- Are there any Warning events?
- Do error messages indicate configuration issue (fixable) or bug (escalate)?
- Are events related to the reported issue?

**Self-resolve if:**
- VLANConflict, SubnetOverlap, DependencyMissing, ValidationFailed
- Events clearly explain what's wrong

**Escalate if:**
- Unexpected errors without clear resolution
- No events, but issue persists

---

**Step 3: Switch Agent Status**

**Objective:** Verify switch agents are connected and ready

**Commands:**
```bash
# List all agents
kubectl get agents -n fab

# Check for agents not Ready
kubectl get agents -n fab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}'

# Check agent for specific switch
kubectl get agent <switch> -n fab -o yaml
```

**Questions to answer:**
- Are all switches showing agents?
- Are all agents Ready?
- When was last heartbeat? (recently = healthy)

**Escalate if:**
- Agent repeatedly disconnecting (not due to switch reboot)
- Agent shows Ready but configuration not applying
- Agent cannot connect to switch (switch is reachable)

---

**Step 4: BGP Health**

**Objective:** Verify fabric underlay is healthy

**Commands:**
```bash
# Check BGP neighbors for specific switch
kubectl get agent <switch> -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq

# Query Prometheus for all non-established neighbors
curl -s 'http://localhost:9090/api/v1/query?query=bgp_neighbor_state{state!="established"}'
```

**Questions to answer:**
- Are all BGP sessions established?
- If sessions down, which switches and neighbors affected?
- Is issue isolated to one switch or fabric-wide?

**Self-resolve if:**
- BGP down due to recent switch reboot (sessions will re-establish)
- Configuration error (wrong AS number, wrong neighbor IP)

**Escalate if:**
- BGP sessions flapping without network changes
- Sessions won't establish despite correct configuration

---

**Step 5: Grafana Dashboard Review**

**Objective:** Observe symptoms and identify patterns

**Dashboards to check:**

**Fabric Dashboard:**
- BGP sessions all up?
- VPC count as expected?
- Any anomalies in fabric metrics?

**Interfaces Dashboard:**
- High error rates on any interface?
- Unexpected down interfaces?
- Traffic patterns normal?

**Platform Dashboard:**
- High CPU/memory on any switch?
- Temperature warnings?
- Failed PSUs or fans?

**Logs Dashboard:**
- Recent ERROR logs?
- What do error messages say?
- Patterns in log entries?

**Critical Resources Dashboard:**
- Any ASIC resource > 90% utilization?
- Route table exhaustion?
- ACL table full?

**Escalate if:**
- Metrics show impossible values (negative counters, >100% CPU)
- Dashboards show issues not explained by configuration

---

**Step 6: Controller and Agent Logs**

**Objective:** Check for errors, panics, or unexpected behavior in logs

**Commands:**
```bash
# Fabric controller logs (last 200 lines)
kubectl logs -n fab deployment/fabric-controller-manager --tail=200

# Filter for errors
kubectl logs -n fab deployment/fabric-controller-manager --tail=200 | grep -i error

# Previous controller logs (if crashed)
kubectl logs -n fab deployment/fabric-controller-manager --previous

# Agent logs (on switch)
hhfab vlab ssh <switch>
journalctl -u hedgehog-fabric-agent -n 100
```

**Questions to answer:**
- Are there ERROR or PANIC messages in controller logs?
- Do logs explain the issue?
- Are there reconciliation loops (same resource reconciling repeatedly)?

**Escalate if:**
- Controller logs show PANIC, fatal errors, or crashes
- Reconciliation loops without resolution
- Unexpected errors not explained by configuration

---

**Checklist Summary:**

| Step | Focus | Self-Resolve Indicators | Escalate Indicators |
|------|-------|-------------------------|---------------------|
| 1. Resources | Kubernetes state | Resources exist, pods running | Controller crashing, pods in error |
| 2. Events | Configuration errors | VLAN conflict, connection not found | Unexpected errors, no events but issue persists |
| 3. Agents | Switch connectivity | Agents ready, recent heartbeat | Agent disconnecting, can't connect despite switch reachable |
| 4. BGP | Fabric underlay | All sessions established | Sessions flapping, won't establish |
| 5. Grafana | Symptoms & trends | Clear symptoms matching events | Impossible metrics, unexplained issues |
| 6. Logs | Detailed errors | Configuration validation errors | PANICs, fatal errors, crashes |

**Using the Checklist:**

1. **Execute all steps** - Don't skip steps even if you think you know the issue
2. **Document findings** - Note what you found in each step
3. **Correlate data** - Events + Grafana + Logs often tell complete story
4. **Make decision** - Self-resolve or escalate based on findings
5. **Act** - Fix configuration OR collect diagnostics and escalate

---

### Concept 2: Evidence Collection

Support teams need specific evidence to troubleshoot effectively. Incomplete diagnostics lead to back-and-forth requests that slow resolution.

**The Complete Diagnostic Package:**

**1. Problem Statement**

Clear description of what's not working:
- What is broken? (specific symptom)
- When did it start? (timestamp)
- What changed recently? (configuration, upgrades, etc.)
- Expected behavior vs actual behavior

**Example:**
```
Problem: Server-07 cannot reach other servers in VPC customer-app-vpc
Started: 2025-10-17 14:30 UTC
Recent changes: Created new VPC and attached server-07
Expected: Server should have VPC connectivity
Actual: Server gets DHCP but cannot communicate beyond gateway
```

---

**2. Kubernetes CRD State**

Full YAML representation of all relevant resources:

```bash
# VPC resources
kubectl get vpc,vpcattachment,vpcpeering -A -o yaml > crds-vpc.yaml

# Wiring resources (switches, servers, connections)
kubectl get switches,servers,connections -n fab -o yaml > crds-wiring.yaml

# Agents (switch operational state)
kubectl get agents -n fab -o yaml > crds-agents.yaml

# Namespaces (IPv4/VLAN allocation)
kubectl get ipv4namespace,vlannamespace -A -o yaml > crds-namespaces.yaml
```

**Why full YAML?**
- Shows complete spec (desired state)
- Shows complete status (actual state)
- Includes annotations, labels, generation numbers
- Support can diff against expected configuration

---

**3. Kubernetes Events**

Recent events for all fabric resources:

```bash
# All events, sorted by timestamp
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > events.log

# Warning events only
kubectl get events --all-namespaces --field-selector type=Warning > events-warnings.log
```

**Why events?**
- Show reconciliation history
- Reveal configuration errors
- Indicate dependency issues
- Events expire after 1 hour, so collect early

---

**4. Controller Logs**

Logs from fabric controller (current and previous):

```bash
# Current controller logs (last 2000 lines)
kubectl logs -n fab deployment/fabric-controller-manager --tail=2000 > controller.log

# Previous controller logs (if crashed)
kubectl logs -n fab deployment/fabric-controller-manager --previous > controller-previous.log
```

**Why previous logs?**
- Crashes appear in previous logs
- PANIC messages occur before restart
- Current logs may not show root cause

---

**5. Agent Status (Per Affected Switch)**

Detailed Agent CRD status for affected switches:

```bash
# Full agent YAML (includes all status fields)
kubectl get agent <switch> -n fab -o yaml > agent-<switch>.yaml

# BGP neighbors (JSON for readability)
kubectl get agent <switch> -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq > agent-<switch>-bgp.json

# Interfaces (operational state, counters)
kubectl get agent <switch> -n fab -o jsonpath='{.status.state.interfaces}' | jq > agent-<switch>-interfaces.json

# Platform health (PSU, fans, temperature)
kubectl get agent <switch> -n fab -o jsonpath='{.status.state.platform}' | jq > agent-<switch>-platform.json
```

**Why per-switch status?**
- Shows exact switch operational state
- Reveals interface status, VLAN configuration
- Indicates hardware issues (temperature, PSU failures)
- Critical for correlating Grafana symptoms with switch state

---

**6. Prometheus Queries (If Relevant)**

Export specific metrics related to issue:

```bash
# Example: BGP sessions down
curl -s 'http://localhost:9090/api/v1/query?query=bgp_neighbor_state{state!="established"}' > bgp-down.json

# Example: Interface error rates
curl -s 'http://localhost:9090/api/v1/query?query=rate(interface_errors_in[5m])' > interface-errors.json

# Example: High CPU switches
curl -s 'http://localhost:9090/api/v1/query?query=cpu_usage_percent>80' > high-cpu.json
```

**Why Prometheus queries?**
- Captures metrics at time of issue
- Shows quantitative data (error rates, utilization)
- Supplements Grafana screenshots

---

**7. Grafana Dashboard Screenshots**

Visual evidence from Grafana dashboards:

**What to screenshot:**
- Interfaces Dashboard showing affected interface
- Logs Dashboard showing error logs
- Fabric Dashboard showing BGP status
- Critical Resources Dashboard (if capacity issue)
- Platform Dashboard (if hardware issue)

**Screenshot best practices:**
- Include dashboard name in screenshot
- Show relevant time range (when issue occurred)
- Highlight affected resources (circle or annotate)
- Save as PNG with descriptive filename

**Example filenames:**
- `grafana-interfaces-leaf04-eth8.png`
- `grafana-logs-leaf04-errors.png`
- `grafana-fabric-bgp-down.png`

---

**8. Version Information**

Software versions for all components:

```bash
# Kubernetes version
kubectl version > kubectl-version.txt

# Fabric controller version
kubectl get deployment -n fab fabric-controller-manager -o jsonpath='{.spec.template.spec.containers[0].image}' > controller-version.txt

# Agent versions (all switches)
kubectl get agents -n fab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.version}{"\n"}{end}' > agent-versions.txt
```

**Why versions matter?**
- Known bugs in specific versions
- Compatibility issues
- Upgrade/downgrade context

---

**9. Topology Information**

Fabric topology (switches, connections, servers):

```bash
# All switches
kubectl get switches -n fab > switches.txt

# All connections
kubectl get connections -n fab > connections.txt

# All servers
kubectl get servers -n fab > servers.txt
```

**Why topology?**
- Understand fabric layout
- Identify affected switches
- Correlation with symptoms (e.g., all servers on leaf-03 affected)

---

**10. Timestamp Marker**

Timestamp when diagnostics collected:

```bash
# Mark diagnostic collection time
date > diagnostic-timestamp.txt
echo "Issue: server-07 cannot reach VPC" >> diagnostic-timestamp.txt
echo "Collected by: operator-username" >> diagnostic-timestamp.txt
```

**Why timestamp?**
- Correlates diagnostics with metrics and logs
- Shows when issue was observed
- Helps support understand timeline

---

**Packaging Diagnostics:**

```bash
# Compress all files
tar czf hedgehog-diagnostics-$(date +%Y%m%d-%H%M%S).tar.gz hedgehog-diagnostics-*/

# Verify bundle
tar tzf hedgehog-diagnostics-*.tar.gz | head -20
```

**Typical bundle size:** 2-5 MB (compressed)

**Bundle structure:**
```
hedgehog-diagnostics-20251017-143000/
├── diagnostic-timestamp.txt
├── crds-vpc.yaml
├── crds-wiring.yaml
├── crds-agents.yaml
├── crds-namespaces.yaml
├── events.log
├── events-warnings.log
├── controller.log
├── controller-previous.log
├── agent-leaf-04.yaml
├── agent-leaf-04-bgp.json
├── agent-leaf-04-interfaces.json
├── agent-leaf-04-platform.json
├── pods-fab.txt
├── pods-fab-describe.txt
├── agents-list.txt
├── kubectl-version.txt
├── controller-version.txt
├── agent-versions.txt
├── switches.txt
├── connections.txt
├── servers.txt
├── grafana-interfaces-leaf04-eth8.png
└── grafana-logs-leaf04.png
```

---

**What NOT to Collect:**

- **Secrets or credentials** - Redact passwords, tokens, keys
- **Unrelated resources** - Don't include all cluster resources
- **Excessive logs** - Last 2000 lines sufficient (not entire log history)
- **Binary files** - Text formats only (except screenshots)

**Redacting Sensitive Information:**

```bash
# Remove secrets from YAML before including
sed -i 's/password:.*/password: REDACTED/g' crds-*.yaml
sed -i 's/token:.*/token: REDACTED/g' crds-*.yaml
```

---

### Concept 3: Escalation Triggers

Knowing when to escalate versus self-resolve is a critical skill that develops with experience. This concept provides clear guidelines.

**ESCALATE When:**

**1. Controller Issues**

- **Controller pod CrashLoopBackOff**
  - Symptom: `kubectl get pods -n fab` shows controller restarting
  - Why escalate: Controller code bug, requires support investigation

- **Controller logs show PANIC or fatal errors**
  - Symptom: `kubectl logs` shows `PANIC`, `fatal error`, segmentation fault
  - Why escalate: Internal error, not operator fixable

- **Controller repeatedly restarting**
  - Symptom: High restart count in pod status
  - Why escalate: Indicates unstable state, needs code fix

- **Reconciliation loops**
  - Symptom: Controller logs show same resource reconciling repeatedly without success
  - Why escalate: Logic error in reconciliation, not configuration

---

**2. Agent Connectivity Issues**

- **Agent disconnects repeatedly** (not due to switch reboot)
  - Symptom: Agent pod shows connection errors in logs
  - Why escalate: Could indicate networking or gNMI issues

- **Agent cannot connect to switch** (switch reachable, credentials correct)
  - Symptom: `kubectl logs` shows connection failures, but switch is reachable via ping/SSH
  - Why escalate: Authentication or protocol issue

- **Agent status shows unexpected errors**
  - Symptom: Agent CRD status has errors not explained by configuration
  - Why escalate: Requires support diagnosis

---

**3. Hardware Failures**

- **Switch not booting**
  - Symptom: Switch doesn't appear in `kubectl get switches` after expected boot time
  - Why escalate: Hardware or image issue beyond operator control

- **Switch kernel panics**
  - Symptom: Serial console shows kernel panic messages
  - Why escalate: OS-level issue or hardware fault

- **Hardware sensor errors** (beyond PSU/fan replacement)
  - Symptom: Platform metrics show persistent hardware errors
  - Why escalate: Likely hardware RMA needed

---

**4. Unexpected Behavior**

- **VPC/VPCAttachment appears successful but doesn't work**
  - Symptom: kubectl shows "Ready", no error events, but traffic doesn't flow
  - Why escalate: Configuration looks correct but behavior is wrong

- **Configuration applied but not taking effect**
  - Symptom: Agent CRD shows old configuration, despite controller logs showing successful apply
  - Why escalate: Configuration application logic issue

- **Metrics show impossible values**
  - Symptom: CPU > 100%, negative counters, nonsensical values
  - Why escalate: Telemetry collection bug

- **BGP sessions flapping without network issues**
  - Symptom: BGP sessions repeatedly down/up, but interfaces are stable
  - Why escalate: Could indicate BGP implementation issue

---

**5. Performance Issues**

- **Severe performance degradation** (not explained by capacity)
  - Symptom: Operations take much longer than normal, but resources are not exhausted
  - Why escalate: Could indicate controller or agent performance bug

- **Controller taking very long to reconcile**
  - Symptom: VPC creation takes minutes instead of seconds
  - Why escalate: Reconciliation logic issue

- **API server slow or unresponsive**
  - Symptom: kubectl commands timeout or take very long
  - Why escalate: Kubernetes or controller issue

---

**6. Data Plane Issues**

- **Traffic forwarding failures** (config looks correct)
  - Symptom: Packets not forwarding despite correct configuration
  - Why escalate: Potential ASIC or forwarding logic issue

- **Packet loss not explained by congestion**
  - Symptom: High packet loss on uncongested interfaces
  - Why escalate: Hardware or driver issue

- **VNI conflicts or VXLAN issues**
  - Symptom: VNI allocated correctly but VXLAN tunnels not working
  - Why escalate: Underlay or VXLAN implementation issue

---

**DO NOT ESCALATE (Self-Resolve) When:**

**1. Configuration Errors**

Clear error events indicating operator mistakes:

- **VLAN conflicts**
  - Event: `VLANConflict: VLAN 1010 already in use`
  - Fix: Choose different VLAN

- **Subnet overlaps**
  - Event: `SubnetOverlap: 10.0.10.0/24 overlaps with vpc-2`
  - Fix: Choose non-overlapping subnet

- **Invalid CIDR notation**
  - Event: `ValidationFailed: Invalid CIDR 10.0.10.0/33`
  - Fix: Correct CIDR notation

- **Connection not found**
  - Event: `DependencyMissing: Connection server-05--mclag not found`
  - Fix: Correct connection name in VPCAttachment

- **Missing VPC reference**
  - Event: `DependencyMissing: VPC vpc-prod not found`
  - Fix: Create VPC before VPCAttachment

---

**2. Expected Warnings**

Normal operational warnings that don't indicate bugs:

- **Unused interfaces down**
  - Event: `InterfaceDown: Ethernet10`
  - Why expected: No server attached to this interface

- **VPC deletion blocked by active attachments**
  - Event: `DependencyExists: Cannot delete vpc-prod, 3 VPCAttachments active`
  - Why expected: Must delete attachments before VPC

- **Validation errors on initial VPC creation**
  - Event: `ValidationFailed: Invalid YAML syntax`
  - Why expected: Typo in YAML, fix syntax

---

**3. Operational Questions**

Questions about how to use Hedgehog (not bugs):

- **How to configure X?** → Check documentation
- **Best practices for VPC design?** → Consult design guides
- **How many VPCs can I create?** → Capacity planning (check ASIC resources dashboard)

These are not support tickets—they're documentation questions.

---

**Gray Area (Try First, Then Escalate):**

Some issues require investigation before deciding:

- **Intermittent issues**
  - Try: Collect diagnostics during occurrence, check for patterns
  - Escalate if: Persists without explanation

- **Slow reconciliation**
  - Try: Check controller CPU/memory first
  - Escalate if: Resources are normal but still slow

- **Logs show warnings but no errors**
  - Try: Investigate warnings first, check if system is functional
  - Escalate if: Warnings persist and functionality impaired

**Rule of Thumb:**
- **If events/logs clearly explain issue** (configuration error) → Self-resolve
- **If events/logs show unexpected errors or no explanation** → Escalate

---

**Escalation Decision Tree:**

```
Issue observed
     ↓
Execute 6-step checklist
     ↓
Found clear configuration error? ────YES───> Self-resolve (fix config)
     ↓ NO
     ↓
Controller/Agent crashing? ─────────YES───> Escalate (system issue)
     ↓ NO
     ↓
Hardware failure? ──────────────────YES───> Escalate (hardware issue)
     ↓ NO
     ↓
Configuration correct but not working? ──YES───> Escalate (unexpected behavior)
     ↓ NO
     ↓
Operational question? ──────────────YES───> Check docs (not a support ticket)
     ↓ NO
     ↓
Uncertain? Try self-resolve first, escalate if no progress in 1 hour
```

---

**Real-World Example: VLAN Conflict (Self-Resolve)**

**Symptom:** Server can't get DHCP

**Checklist findings:**
- Step 1: VPC and VPCAttachment exist, controller running
- Step 2: Event shows `VLANConflict: VLAN 1010 already in use by vpc-prod`
- Step 5: Grafana shows no VLAN configured on interface

**Decision:** Self-resolve (clear configuration error)

**Action:**
```bash
# Check used VLANs
kubectl get vpc -o yaml | grep "vlan:"
# Choose unused VLAN (1011)
# Edit VPC in Gitea, change vlan: 1010 to vlan: 1011
# Commit → ArgoCD syncs → Issue resolved
```

**Time to resolution:** 5 minutes

---

**Real-World Example: Controller Crash (Escalate)**

**Symptom:** VPCs not reconciling

**Checklist findings:**
- Step 1: Controller pod in CrashLoopBackOff
- Step 6: Controller logs show `PANIC: runtime error: invalid memory address`

**Decision:** Escalate (controller crash)

**Action:**
- Collect full diagnostics
- Write support ticket with PANIC message
- Include controller-previous.log showing crash
- Attach diagnostic bundle

**Support identifies:** Known bug in v0.87.3, fixed in v0.87.5
**Resolution:** Upgrade controller → Issue resolved

**Time to resolution:** 2 hours (including support response)

---

**Real-World Example: Configuration Correct But Not Working (Escalate)**

**Symptom:** Server gets DHCP but can't communicate

**Checklist findings:**
- Step 1: VPC and VPCAttachment Ready
- Step 2: No error events
- Step 3: Agent ready, interface up, VLAN configured
- Step 4: BGP sessions established
- Step 5: Grafana shows interface up, VLAN configured
- Step 6: No controller errors

**Decision:** Escalate (unexpected behavior, configuration appears correct)

**Action:**
- Collect full diagnostics (CRDs, events, logs, Agent status, Grafana screenshots)
- Write support ticket explaining findings
- Note that all configuration appears correct per documentation

**Support identifies:** Edge case in DHCP relay configuration for single-server VPCs
**Resolution:** Support provides configuration adjustment → Issue resolved

**Time to resolution:** 4 hours (including support investigation)

---

### Concept 4: Support Ticket Best Practices

An effective support ticket enables rapid troubleshooting without back-and-forth requests for information.

**The Anatomy of a Great Support Ticket:**

**1. Clear One-Sentence Summary**

**Good:**
> "VPC vpc-prod reconciles successfully but server-03 cannot reach other servers in VPC"

**Bad:**
> "VPC not working. Please help ASAP."

**Why it matters:** Support triages tickets based on summary. Clear summary speeds routing to right engineer.

---

**2. Severity Level**

Indicate business impact:

- **P1 (Critical):** Production down, customer-facing impact, revenue loss
- **P2 (Major):** Production degraded, workaround exists, significant impact
- **P3 (Minor):** Non-production affected, low impact, no workaround
- **P4 (Question):** Informational, how-to, best practice question

**Example:**
```
Severity: P3 (Minor - affects one server in dev environment)
```

---

**3. Impacted Resources**

List specific resources affected:

**Good:**
```
Impacted Resources:
- VPC: vpc-prod
- Servers: server-05, server-06
- Switches: leaf-03
```

**Bad:**
```
Some VPC isn't working
```

---

**4. Timeline**

When did issue start and what changed?

**Good:**
```
Started: 2025-10-17 10:30 UTC
Recent Changes: Created new VPCAttachment for server-06 to vpc-prod/frontend subnet at 10:25 UTC
```

**Bad:**
```
Issue started today
```

---

**5. Observable Symptoms**

What you see in Grafana/kubectl/logs:

**Good:**
```
Symptoms:
1. Grafana Interfaces Dashboard: leaf-03/Ethernet10 shows up, but 0 traffic
2. kubectl events: VPCAttachment shows "Ready" with no errors
3. Server reports DHCP timeout
4. Agent CRD shows VLAN 1015 configured on leaf-03/Ethernet10
```

**Bad:**
```
Server can't connect
```

---

**6. Expected vs Actual Behavior**

**Good:**
```
Expected Behavior:
Server should receive DHCP lease from 10.10.1.10-10.10.1.99 range

Actual Behavior:
Server DHCP request times out, no lease received
```

**Bad:**
```
It's not working like it should
```

---

**7. Troubleshooting Attempted**

Show your work—what did you try?

**Good:**
```
Troubleshooting Attempted:
1. Checked kubectl events for vpc-prod and VPCAttachment - no errors
2. Verified VLAN 1015 configured on leaf-03/Ethernet10 in Agent CRD
3. Confirmed DHCPSubnet resource created (vpc-prod--frontend)
4. Checked DHCP server logs - no requests received from server-05 MAC
5. Verified server network interface up and requesting DHCP
6. Confirmed no VLAN conflicts (VLAN 1015 unused by other VPCs)

Findings:
All configuration appears correct, but DHCP requests from server-05 not reaching DHCP server. Switch shows interface up and VLAN configured. No errors in any logs.
```

**Bad:**
```
I tried fixing it but it didn't work
```

---

**8. Diagnostics Attached**

**Good:**
```
Attachments:

Diagnostic Bundle: hedgehog-diagnostics-20251017-103000.tar.gz (2.3 MB)

Contents:
- crds-vpc.yaml, crds-wiring.yaml, crds-agents.yaml
- events.log, events-warnings.log
- controller.log, controller-previous.log
- agent-leaf-03.yaml, agent-leaf-03-interfaces.json
- grafana-interfaces-screenshot.png
- grafana-logs-screenshot.png
- kubectl-version.txt, controller-version.txt, agent-versions.txt
```

**Bad:**
```
I can send logs if you need them
```

---

**9. Environment Details**

**Good:**
```
Hedgehog Version:
- Controller: ghcr.io/githedgehog/fabric-controller:v0.87.4
- Agents: v0.87.4 (all switches)

Fabric Topology:
- Spines: 2 (spine-01, spine-02)
- Leaves: 5 (leaf-01 through leaf-05)
- Servers: 10

Kubernetes Version: v1.31.1+k3s1
```

**Bad:**
```
Latest version
```

---

**10. Impact and Urgency**

**Good:**
```
Users Affected: 2 servers (server-05, server-06)
Business Impact: Development environment, non-critical
Workaround: None identified
```

**Bad:**
```
This is urgent
```

---

**Complete Support Ticket Template:**

```markdown
# Issue Summary

**Problem:** [One-sentence description]

**Severity:** [P1/P2/P3/P4]

**Impacted Resources:**
- VPCs: [list]
- Servers: [list]
- Switches: [list]

**Started:** [Date/time UTC]

**Recent Changes:** [What changed in last 24 hours?]

---

# Environment

**Hedgehog Version:**
- Controller: [image tag]
- Agents: [version]

**Fabric Topology:**
- Spines: [count and names]
- Leaves: [count and names]
- Servers: [count]

**Kubernetes Version:** [version]

---

# Symptoms

**Observable Symptoms:**
1. [What you see in Grafana/kubectl/logs]
2. [Specific error messages]
3. [Metrics showing issue]

**Expected Behavior:**
[What should be happening?]

**Actual Behavior:**
[What is actually happening?]

---

# Diagnostics Completed

**Checklist:**
- [ ] kubectl events checked (attached: events.log)
- [ ] Agent status reviewed (attached: agent-<switch>.yaml)
- [ ] BGP health verified
- [ ] Grafana dashboards checked (screenshots attached)
- [ ] Controller logs collected (attached: controller.log)
- [ ] VPC/VPCAttachment CRDs collected (attached: crds-vpc.yaml)

**Troubleshooting Attempted:**
1. [What did you try?]
2. [What were the results?]

**Findings:**
[What did you discover during troubleshooting?]

---

# Attachments

**Diagnostic Bundle:** hedgehog-diagnostics-[timestamp].tar.gz

**Contents:**
- [list files in bundle]

**Grafana Screenshots:**
- [filename] - [description]

---

# Impact

**Users Affected:** [number and type]
**Business Impact:** [production/dev, critical/non-critical]
**Workaround:** [if any]

---

# Additional Context

[Any other relevant information]
```

---

**7 Key Principles:**

1. **Be Concise** - One-sentence summary at top
2. **Be Specific** - Exact resource names, timestamps, error messages
3. **Show Your Work** - List troubleshooting attempts
4. **Attach Diagnostics** - Complete diagnostic bundle
5. **Describe Impact** - Severity, affected users
6. **Avoid Assumptions** - Report observations, not conclusions (unless clear)
7. **Include Screenshots** - Visual evidence from Grafana

---

**Common Mistakes to Avoid:**

❌ **Vague descriptions:** "It's not working"
✅ **Specific symptoms:** "Server-03 cannot reach VPC gateway 10.10.1.1"

❌ **Missing diagnostics:** "Can send logs if needed"
✅ **Attached diagnostics:** "Diagnostic bundle attached (2.3 MB)"

❌ **No troubleshooting shown:** "Please fix this"
✅ **Troubleshooting documented:** "Checked events, Agent status, BGP health - all normal"

❌ **Emotional language:** "This is frustrating and blocking us"
✅ **Professional tone:** "Issue is blocking dev environment, workaround needed"

❌ **Speculation:** "I think it might be a BGP issue"
✅ **Observations:** "All BGP sessions established per Agent CRD"

---

### Concept 5: Diagnostic Collection Automation

Manually collecting diagnostics is time-consuming and error-prone. Automating the process ensures consistency and completeness.

**The Diagnostic Collection Script:**

Save this as `diagnostic-collect.sh`:

```bash
#!/bin/bash
# Hedgehog Fabric Diagnostic Collection Script
# Version: 1.0
# Usage: ./diagnostic-collect.sh

set -e  # Exit on error

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTDIR="hedgehog-diagnostics-${TIMESTAMP}"
mkdir -p ${OUTDIR}

echo "========================================="
echo "Hedgehog Fabric Diagnostic Collection"
echo "Timestamp: ${TIMESTAMP}"
echo "Output Directory: ${OUTDIR}"
echo "========================================="
echo ""

# Problem description
echo "Enter brief problem description (one line):"
read PROBLEM_DESC
echo "Issue: ${PROBLEM_DESC}" > ${OUTDIR}/diagnostic-timestamp.txt
date >> ${OUTDIR}/diagnostic-timestamp.txt
echo "Collected by: ${USER}" >> ${OUTDIR}/diagnostic-timestamp.txt
echo "" >> ${OUTDIR}/diagnostic-timestamp.txt

# CRDs
echo "Collecting CRDs..."
kubectl get vpc,vpcattachment,vpcpeering -A -o yaml > ${OUTDIR}/crds-vpc.yaml 2>&1
kubectl get switches,servers,connections -n fab -o yaml > ${OUTDIR}/crds-wiring.yaml 2>&1
kubectl get agents -n fab -o yaml > ${OUTDIR}/crds-agents.yaml 2>&1
kubectl get ipv4namespace,vlannamespace -A -o yaml > ${OUTDIR}/crds-namespaces.yaml 2>&1

# Events
echo "Collecting events..."
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > ${OUTDIR}/events.log 2>&1
kubectl get events --all-namespaces --field-selector type=Warning > ${OUTDIR}/events-warnings.log 2>&1

# Logs
echo "Collecting logs..."
kubectl logs -n fab deployment/fabric-controller-manager --tail=2000 > ${OUTDIR}/controller.log 2>&1
kubectl logs -n fab deployment/fabric-controller-manager --previous > ${OUTDIR}/controller-previous.log 2>/dev/null || echo "No previous controller logs available" > ${OUTDIR}/controller-previous.log

# Status
echo "Collecting status..."
kubectl get pods -n fab > ${OUTDIR}/pods-fab.txt 2>&1
kubectl describe pods -n fab > ${OUTDIR}/pods-fab-describe.txt 2>&1
kubectl get agents -n fab > ${OUTDIR}/agents-list.txt 2>&1

# Versions
echo "Collecting version info..."
kubectl version > ${OUTDIR}/kubectl-version.txt 2>&1
kubectl get deployment -n fab fabric-controller-manager -o jsonpath='{.spec.template.spec.containers[0].image}' > ${OUTDIR}/controller-version.txt 2>&1
kubectl get agents -n fab -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.version}{"\n"}{end}' > ${OUTDIR}/agent-versions.txt 2>&1

# Topology
echo "Collecting topology..."
kubectl get switches -n fab > ${OUTDIR}/switches.txt 2>&1
kubectl get servers -n fab > ${OUTDIR}/servers.txt 2>&1
kubectl get connections -n fab > ${OUTDIR}/connections.txt 2>&1

# Agent details for affected switches
echo ""
echo "Enter comma-separated list of affected switches (e.g., leaf-01,leaf-03) or press Enter to skip:"
read AFFECTED_SWITCHES

if [ ! -z "$AFFECTED_SWITCHES" ]; then
    IFS=',' read -ra SWITCHES <<< "$AFFECTED_SWITCHES"
    for switch in "${SWITCHES[@]}"; do
        switch=$(echo $switch | xargs)  # Trim whitespace
        echo "Collecting detailed status for ${switch}..."
        kubectl get agent ${switch} -n fab -o yaml > ${OUTDIR}/agent-${switch}.yaml 2>&1
        kubectl get agent ${switch} -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq > ${OUTDIR}/agent-${switch}-bgp.json 2>&1
        kubectl get agent ${switch} -n fab -o jsonpath='{.status.state.interfaces}' | jq > ${OUTDIR}/agent-${switch}-interfaces.json 2>&1
        kubectl get agent ${switch} -n fab -o jsonpath='{.status.state.platform}' | jq > ${OUTDIR}/agent-${switch}-platform.json 2>&1
    done
fi

# Compress
echo ""
echo "Compressing diagnostics..."
tar czf ${OUTDIR}.tar.gz ${OUTDIR}

echo ""
echo "========================================="
echo "Diagnostic collection complete!"
echo "Package: ${OUTDIR}.tar.gz"
echo "Size: $(du -h ${OUTDIR}.tar.gz | cut -f1)"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Review diagnostics for sensitive information (redact if needed)"
echo "2. Take Grafana dashboard screenshots (if relevant)"
echo "3. Create support ticket with problem description"
echo "4. Attach ${OUTDIR}.tar.gz to support ticket"
echo ""
```

---

**Using the Script:**

**1. Make executable:**

```bash
chmod +x diagnostic-collect.sh
```

**2. Run collection:**

```bash
./diagnostic-collect.sh
```

**3. Follow prompts:**

```
Enter brief problem description (one line):
> server-07 cannot reach customer-app-vpc despite successful VPCAttachment

Enter comma-separated list of affected switches (e.g., leaf-01,leaf-03) or press Enter to skip:
> leaf-04
```

**4. Output:**

```
========================================
Hedgehog Fabric Diagnostic Collection
Timestamp: 20251017-143000
Output Directory: hedgehog-diagnostics-20251017-143000
========================================

Collecting CRDs...
Collecting events...
Collecting logs...
Collecting status...
Collecting version info...
Collecting topology...
Collecting detailed status for leaf-04...

Compressing diagnostics...

========================================
Diagnostic collection complete!
Package: hedgehog-diagnostics-20251017-143000.tar.gz
Size: 2.3M
========================================

Next steps:
1. Review diagnostics for sensitive information (redact if needed)
2. Take Grafana dashboard screenshots (if relevant)
3. Create support ticket with problem description
4. Attach hedgehog-diagnostics-20251017-143000.tar.gz to support ticket
```

---

**Script Benefits:**

- **Consistency:** Same diagnostics collected every time
- **Completeness:** Won't forget critical files
- **Speed:** 30 seconds vs 5-10 minutes manual collection
- **Error handling:** Handles missing resources gracefully
- **Automation:** Can be run by junior operators or in scripts

**Customization:**

Add project-specific checks:

```bash
# Custom checks section
echo "Collecting custom resources..."
kubectl get mycompany-crd -A -o yaml > ${OUTDIR}/custom-resources.yaml 2>&1
```

---

**Advanced: Automatic Collection on Alert**

Integrate with monitoring alerts to automatically collect diagnostics:

```bash
# alert-handler.sh
#!/bin/bash
# Called by alertmanager when alert fires

ALERT_NAME=$1
ALERT_SEVERITY=$2

if [ "$ALERT_SEVERITY" = "critical" ]; then
    echo "Critical alert fired: ${ALERT_NAME}"
    echo "Auto-collecting diagnostics..."
    /path/to/diagnostic-collect.sh <<EOF
Auto-collected for alert: ${ALERT_NAME}
all
EOF
    echo "Diagnostics collected automatically"
fi
```

This creates a diagnostic bundle every time a critical alert fires, ensuring you have data even if issue is intermittent.

---

**Redacting Sensitive Information:**

Before submitting diagnostics to external support:

```bash
# Create sanitized version
cp -r ${OUTDIR} ${OUTDIR}-sanitized

# Redact passwords and tokens
find ${OUTDIR}-sanitized -type f -exec sed -i 's/password:.*/password: REDACTED/g' {} \;
find ${OUTDIR}-sanitized -type f -exec sed -i 's/token:.*/token: REDACTED/g' {} \;
find ${OUTDIR}-sanitized -type f -exec sed -i 's/key:.*/key: REDACTED/g' {} \;

# Recompress
tar czf ${OUTDIR}-sanitized.tar.gz ${OUTDIR}-sanitized/

echo "Sanitized bundle ready: ${OUTDIR}-sanitized.tar.gz"
```

---

## Troubleshooting

### Issue: Diagnostic Bundle Too Large

**Symptom:** Compressed bundle exceeds support portal upload limit (e.g., 10 MB)

**Cause:** Logs or CRDs contain excessive data

**Solution:**

**1. Reduce log tail:**

```bash
# Instead of --tail=2000, use --tail=500
kubectl logs -n fab deployment/fabric-controller-manager --tail=500 > controller.log
```

**2. Split bundle:**

Create multiple smaller bundles:

```bash
# Bundle 1: CRDs and events
tar czf diagnostics-part1.tar.gz crds-*.yaml events*.log

# Bundle 2: Logs
tar czf diagnostics-part2.tar.gz *.log

# Bundle 3: Agent status
tar czf diagnostics-part3.tar.gz agent-*.yaml agent-*.json
```

**3. Use file sharing service:**

For very large bundles:

```bash
# Upload to cloud storage
aws s3 cp hedgehog-diagnostics-*.tar.gz s3://mybucket/diagnostics/
# Share link with support
```

---

### Issue: kubectl Commands Timing Out During Collection

**Symptom:** Script hangs on `kubectl get` commands

**Cause:** API server slow or unresponsive

**Solution:**

**1. Add timeout to kubectl:**

```bash
# Add --request-timeout flag
kubectl get vpc -A -o yaml --request-timeout=30s > crds-vpc.yaml 2>&1 || echo "VPC collection timed out" > crds-vpc.yaml
```

**2. Collect only critical resources:**

```bash
# Skip non-essential resources if API server is slow
kubectl get vpc,vpcattachment -A -o yaml > crds-vpc.yaml
# Skip namespaces if not relevant
```

**3. Increase timeout for slow environments:**

```bash
export KUBECONFIG=/path/to/config
kubectl config set-cluster default --server=https://... --request-timeout=60s
```

---

### Issue: Previous Controller Logs Not Available

**Symptom:** `kubectl logs --previous` returns "previous terminated container not found"

**Cause:** Controller hasn't crashed or restarted

**Solution:**

This is expected and not an issue. Only collect previous logs if controller actually crashed.

```bash
# Script already handles this gracefully:
kubectl logs -n fab deployment/fabric-controller-manager --previous > controller-previous.log 2>/dev/null || echo "No previous controller logs available" > controller-previous.log
```

The error suppression (`2>/dev/null`) and fallback message ensure script continues without failing.

---

### Issue: Agent CRD Has No Status Data

**Symptom:** `kubectl get agent <switch> -n fab -o yaml` shows `status: {}`

**Cause:** Agent not connected to switch or switch not registered

**Troubleshooting:**

**1. Check agent pod:**

```bash
kubectl get pods -n fab | grep agent-<switch>
```

If pod doesn't exist, switch hasn't registered yet.

**2. Check switch registration:**

```bash
kubectl get switch <switch> -n fab
```

If switch doesn't exist, it hasn't completed boot and registration.

**3. Check switch serial console:**

```bash
hhfab vlab serial <switch>
```

Look for boot errors or registration failures.

**4. Check fabric-boot logs:**

```bash
kubectl logs -n fab deployment/fabric-boot
```

Look for switch DHCP and registration events.

**Solution:** Wait for switch to complete registration, or investigate registration failure if switch is stuck.

---

### Issue: How to Redact Sensitive Information from Diagnostics

**Symptom:** Diagnostics contain passwords, tokens, or proprietary data

**Cause:** CRDs and logs may contain sensitive information

**Solution:**

**Automated redaction:**

```bash
# Create redaction script: redact-sensitive.sh
#!/bin/bash
DIR=$1

# Redact common secret patterns
find ${DIR} -type f -exec sed -i 's/password:\s*.*/password: REDACTED/g' {} \;
find ${DIR} -type f -exec sed -i 's/token:\s*.*/token: REDACTED/g' {} \;
find ${DIR} -type f -exec sed -i 's/secret:\s*.*/secret: REDACTED/g' {} \;
find ${DIR} -type f -exec sed -i 's/key:\s*.*/key: REDACTED/g' {} \;
find ${DIR} -type f -exec sed -i 's/apiKey:\s*.*/apiKey: REDACTED/g' {} \;

# Redact IP addresses if needed
# find ${DIR} -type f -exec sed -i 's/[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}/X.X.X.X/g' {} \;

echo "Sensitive information redacted in ${DIR}"
```

**Usage:**

```bash
chmod +x redact-sensitive.sh

# Redact diagnostics before sharing
./redact-sensitive.sh hedgehog-diagnostics-20251017-143000/

# Recompress
tar czf hedgehog-diagnostics-20251017-143000-redacted.tar.gz hedgehog-diagnostics-20251017-143000/
```

**Manual review:**

Always review diagnostics before sharing externally:

```bash
# Check for sensitive data
grep -ri "password\|token\|secret" hedgehog-diagnostics-*/

# Manually redact if found
vim crds-vpc.yaml  # Search for sensitive fields
```

**Best practice:** Redact first, then share. Easier than trying to recall sensitive data after sharing.

---

### Issue: Support Requests Additional Information Not in Bundle

**Symptom:** Support asks for data you didn't collect initially

**Cause:** Issue requires additional context beyond standard diagnostics

**Solution:**

Common additional requests and how to collect:

**1. Specific time range metrics:**

```bash
# Export Prometheus metrics for specific time range
curl -s 'http://localhost:9090/api/v1/query_range?query=bgp_neighbor_state&start=2025-10-17T14:00:00Z&end=2025-10-17T15:00:00Z&step=60s' > bgp-timeseries.json
```

**2. Switch SONiC CLI output:**

```bash
hhfab vlab ssh leaf-04 "show running-config" > leaf-04-running-config.txt
hhfab vlab ssh leaf-04 "show ip route" > leaf-04-routes.txt
hhfab vlab ssh leaf-04 "show bgp summary" > leaf-04-bgp-summary.txt
```

**3. Detailed interface statistics:**

```bash
kubectl get agent leaf-04 -n fab -o jsonpath='{.status.state.interfaces.Ethernet8}' | jq > leaf-04-eth8-detailed.json
```

**4. Historical events (if available):**

```bash
# If events haven't expired
kubectl get events --field-selector involvedObject.name=customer-app-vpc --sort-by='.lastTimestamp' -o yaml > vpc-events-history.yaml
```

**5. Network traces:**

```bash
# Packet capture on switch (if needed)
hhfab vlab ssh leaf-04 "sudo tcpdump -i Ethernet8 -w /tmp/capture.pcap -c 1000"
hhfab vlab scp leaf-04:/tmp/capture.pcap ./leaf-04-capture.pcap
```

**Best practice:** Keep original diagnostic bundle. Add new files as supplemental attachments to support ticket.

---

## Resources

### Kubernetes Documentation

- [Kubernetes Events](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/)
- [kubectl Reference](https://kubernetes.io/docs/reference/kubectl/)
- [Troubleshooting Applications](https://kubernetes.io/docs/tasks/debug/)

### Hedgehog Documentation

- Hedgehog CRD Reference (CRD_REFERENCE.md in research folder)
- Hedgehog Observability Guide (OBSERVABILITY.md in research folder)
- Hedgehog Fabric Controller Documentation

### Related Modules

- Previous: [Module 3.3: Events & Status Monitoring](module-3.3-events-status-monitoring.md)
- Pathway: Network Like a Hyperscaler

### Diagnostic Collection Quick Reference

**6-Step Checklist:**

```bash
# 1. Kubernetes Resource Health
kubectl get vpc,vpcattachment -A
kubectl get switches,agents -n fab
kubectl get pods -n fab

# 2. Events (Last Hour)
kubectl get events --all-namespaces --field-selector type=Warning --sort-by='.lastTimestamp'

# 3. Switch Agent Status
kubectl get agents -n fab
kubectl get agent <switch> -n fab -o yaml

# 4. BGP Health
kubectl get agent <switch> -n fab -o jsonpath='{.status.state.bgpNeighbors}' | jq

# 5. Grafana Dashboards
# - Fabric Dashboard (BGP, VPC health)
# - Interfaces Dashboard (interface state, errors)
# - Platform Dashboard (hardware health)
# - Logs Dashboard (error logs)

# 6. Controller Logs
kubectl logs -n fab deployment/fabric-controller-manager --tail=200 | grep -i error
```

**Diagnostic Collection:**

```bash
# Use automated script
./diagnostic-collect.sh

# OR manual collection
OUTDIR="hedgehog-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p ${OUTDIR}

kubectl get vpc,vpcattachment -A -o yaml > ${OUTDIR}/crds-vpc.yaml
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > ${OUTDIR}/events.log
kubectl logs -n fab deployment/fabric-controller-manager --tail=2000 > ${OUTDIR}/controller.log
kubectl get agent <switch> -n fab -o yaml > ${OUTDIR}/agent-<switch>.yaml

tar czf ${OUTDIR}.tar.gz ${OUTDIR}
```

---

**Course 3 Complete!** You've mastered Hedgehog fabric observability and diagnostic collection. You can now:
- Monitor fabric health proactively (Grafana dashboards)
- Troubleshoot issues systematically (kubectl + Grafana)
- Collect comprehensive diagnostics (6-step checklist)
- Make confident escalation decisions (self-resolve vs escalate)
- Write effective support tickets (clear, specific, with evidence)

**Your Next Steps:**
- Apply this workflow in your Hedgehog fabric operations
- Customize the diagnostic script for your environment
- Build confidence in escalation decisions
- Partner with support as a strategic resource for reliability

**You are now equipped with the complete observability and escalation toolkit for Hedgehog fabric operations.**
