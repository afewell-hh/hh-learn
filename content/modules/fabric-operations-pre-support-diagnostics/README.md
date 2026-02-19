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
- Check admission webhook errors and Agent CRD status

These skills enable you to self-resolve **many** common issues: VLAN conflicts, connection misconfigurations, subnet overlaps, and invalid CIDRs. When Grafana shows no traffic and an admission webhook error reveals a VLAN conflict, you know to choose a different VLAN. When a VPCAttachment fails because a connection doesn't exist, you fix the connection name. These are configuration errors—fixable with your observability toolkit.

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
- **Evidence collection** - What to gather (kubectl, logs, Agent status, Grafana screenshots)
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

You'll use Prometheus queries, Grafana dashboards, admission webhook output, and Agent CRD status together in a systematic escalation workflow. This integrated approach is what separates novice operators from experienced ones who can confidently navigate the boundary between self-resolution and escalation.

## Learning Objectives

By the end of this module, you will be able to:

1. **Execute diagnostic checklist** - Run comprehensive 6-step health check before escalation
2. **Collect fabric diagnostics systematically** - Gather kubectl outputs, logs, Agent status, and Grafana screenshots
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

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Scenario: Complete Pre-Escalation Diagnostic Collection

A user reports that their newly created VPC `customer-app-vpc` with VPCAttachment for `server-07` isn't working. Server-07 cannot reach other servers in the VPC. You'll execute the full diagnostic checklist, collect evidence, and determine if this requires escalation or self-resolution.

**Environment Access:**
- **Grafana:** http://YOUR_VM_IP:3000
- **Prometheus:** http://YOUR_VM_IP:9090
- **kubectl:** Already configured

### Task 1: Execute Pre-Escalation Checklist (3 minutes)

**Objective:** Systematically check fabric health using the 6-step checklist

**Step 1.1: Kubernetes Resource Health**

```bash
# Check VPC and VPCAttachment exist
kubectl get vpc customer-app-vpc
kubectl get vpcattachment -A | grep server-07

# Check controller pods
kubectl get pods -n fab
```

**Look for:** All pods in `Running` state. Pods in `CrashLoopBackOff` or `Error` → escalation trigger. **If controller is crashing, escalate immediately.**

---

**Step 1.2: Check Admission Webhook Errors and Agent Convergence**

```bash
# Verify resources exist (if missing, they were rejected by admission webhook)
kubectl get vpc customer-app-vpc
kubectl get vpcattachment | grep server-07

# Check Agent reconciliation convergence
kubectl get agents
# APPLIEDG == CURRENTG → config applied to all switches
# APPLIEDG < CURRENTG → still reconciling (wait and recheck)

# Describe resources (Events: <none> is expected for fabric CRDs)
kubectl describe vpcattachment customer-app-vpc--server-07
```

> **Note:** Fabric CRDs (VPC, VPCAttachment) do not emit Kubernetes events. Validation errors
> surface at `kubectl apply` time via admission webhooks. Check ArgoCD sync status for any
> webhook errors that occurred when the resource was created.

**Look for:**
- ✅ Resource exists + APPLIEDG == CURRENTG → configuration applied
- ❌ Resource missing → was rejected by admission webhook (check ArgoCD sync error)
- ❌ APPLIEDG < CURRENTG (not converging after 5+ minutes) → possible agent/controller issue

**Decision:** Admission webhook error with clear config error → self-resolve. Resource exists and
agents converged but issue persists → continue checklist.

---

**Step 1.3: Agent Status**

```bash
# Find switch for server-07
kubectl get connections | grep server-07

# Check agent and interface (agents are in default namespace)
kubectl get agent leaf-04
kubectl get agent leaf-04 -o json | jq '.status.state.interfaces["E1/8"]'
```

**Look for:**
- ✅ `oper: "up"`, low error counters
- ❌ `oper: "down"` or high `ind` (discards) counters → check cabling

---

**Step 1.4: BGP Health**

```bash
# Check BGP neighbors (agents in default namespace)
kubectl get agent leaf-04 -o jsonpath='{.status.state.bgpNeighbors}' | jq

# Alternative: Query Prometheus (state value 6 = Established)
curl -s 'http://YOUR_VM_IP:9090/api/v1/query?query=fabric_agent_bgp_neighbor_session_state!=6' | jq
```

**Look for:** All neighbors `state: "established"` (Agent CRD) or no results from PromQL (all sessions are 6=Established). If sessions are down, check spine connectivity.

---

**Step 1.5: Grafana Dashboard Review**

Review dashboards at http://YOUR_VM_IP:3000 (admin/admin):
- **Hedgehog Fabric:** BGP sessions, switch health
- **Hedgehog Switch Interface Counters:** leaf-04/E1/8 state, VLAN, traffic
- **Hedgehog Fabric Platform Stats:** CPU/memory, temperature, fan speed
- **Hedgehog Fabric Logs:** ERROR logs for leaf-04
- **Hedgehog Switch Critical Resources:** ASIC route/nexthop utilization

---

**Step 1.6: Controller and Agent Logs**

```bash
# Controller logs
kubectl logs -n fab deployment/fabric-ctrl --tail=200 | grep -i error

# If crashed, get previous logs
kubectl logs -n fab deployment/fabric-ctrl --previous
```

**Look for:** ERROR/PANIC messages, reconciliation loops. Escalate if found.

---

**Checklist Outcomes:**

**A) Self-Resolve:** Clear config errors (VLAN conflict, connection not found, subnet overlap) → Fix in Gitea

**B) Escalate:** Controller crashes, agent issues, no errors but doesn't work, hardware failures → Collect diagnostics

**Success Criteria:**
- ✅ Executed all 6 steps
- ✅ Identified self-resolve vs escalation
- ✅ Documented findings

---

### Task 2: Collect Diagnostic Evidence (2-3 minutes)

**Objective:** Gather complete diagnostic bundle for support

**Quick Collection Script:**

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTDIR="hedgehog-diagnostics-${TIMESTAMP}"
mkdir -p ${OUTDIR}

# Problem description
echo "Issue: server-07 cannot reach other servers in customer-app-vpc" > ${OUTDIR}/diagnostic-timestamp.txt
date >> ${OUTDIR}/diagnostic-timestamp.txt

# Collect CRDs
kubectl get vpc,vpcattachment,vpcpeering -o yaml > ${OUTDIR}/crds-vpc.yaml
kubectl get switches,servers,connections -o yaml > ${OUTDIR}/crds-wiring.yaml
kubectl get agents -o yaml > ${OUTDIR}/crds-agents.yaml

# Collect system events (fabric CRDs do not emit K8s events, but system events may help)
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > ${OUTDIR}/events.log
kubectl logs -n fab deployment/fabric-ctrl --tail=2000 > ${OUTDIR}/controller.log
kubectl logs -n fab deployment/fabric-ctrl --previous > ${OUTDIR}/controller-previous.log 2>/dev/null || echo "No previous logs" > ${OUTDIR}/controller-previous.log

# Collect status and versions
kubectl get pods -n fab > ${OUTDIR}/pods-fab.txt
kubectl version > ${OUTDIR}/kubectl-version.txt
kubectl get agents -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.version}{"\n"}{end}' > ${OUTDIR}/agent-versions.txt

# Collect agent details for affected switch (leaf-04)
kubectl get agent leaf-04 -o yaml > ${OUTDIR}/agent-leaf-04.yaml
kubectl get agent leaf-04 -o jsonpath='{.status.state.interfaces}' | jq > ${OUTDIR}/agent-leaf-04-interfaces.json

# Compress
tar czf ${OUTDIR}.tar.gz ${OUTDIR}
echo "Created: ${OUTDIR}.tar.gz"
```

**Collect Grafana Screenshots:**

1. Navigate to "Hedgehog Switch Interface Counters" dashboard, filter leaf-04/E1/8, screenshot
2. Navigate to "Hedgehog Fabric Logs" dashboard, filter leaf-04, screenshot errors
3. Add to bundle: `cp grafana-*.png ${OUTDIR}/ && tar czf ${OUTDIR}.tar.gz ${OUTDIR}`

**Success Criteria:**
- ✅ Diagnostic bundle created with CRDs, events, logs, Agent status, versions
- ✅ Grafana screenshots captured
- ✅ Bundle includes problem statement

---

### Task 3: Determine Escalation Decision (1 minute)

**Objective:** Decide if issue requires support escalation

**Self-Resolve (Configuration Errors):**
- VLAN conflict, subnet overlap, connection not found, invalid CIDR, missing VPC → Fix in Gitea, commit

**Escalate (System/Unexpected Issues):**
- Controller crashes, agent disconnects, no errors but doesn't work, hardware failures, performance issues

**Document Decision:**

```bash
echo "Decision: [Self-Resolve/Escalate]" >> ${OUTDIR}/diagnostic-timestamp.txt
echo "Reason: [Explanation]" >> ${OUTDIR}/diagnostic-timestamp.txt
```

**Success Criteria:**
- ✅ Clear decision documented with reasoning

---

### Task 4: Write Support Ticket (2 minutes)

**Objective:** Document issue clearly for support

**Support Ticket Template:**

```markdown
# Issue Summary
**Problem:** [One-sentence description]
**Severity:** [P1-P4]
**Impacted Resources:** [VPCs, servers, switches]
**Started:** [Timestamp UTC]
**Recent Changes:** [What changed?]

# Environment
**Hedgehog Version:** Controller image, Agent versions
**Fabric Topology:** Spine/leaf count
**Kubernetes Version:** [version]

# Symptoms
**Observable:** [What you see in Grafana/kubectl/logs]
**Expected:** [What should happen]
**Actual:** [What is happening]

# Diagnostics Completed
**Checklist:** [✅ admission webhook check, Agent convergence, BGP health, Grafana, logs, CRDs]
**Troubleshooting Attempted:** [What you tried and results]
**Findings:** [What you discovered]

# Attachments
**Diagnostic Bundle:** hedgehog-diagnostics-[timestamp].tar.gz
**Grafana Screenshots:** [filenames with descriptions]

# Impact
**Users Affected:** [number/type]
**Business Impact:** [critical/non-critical]
**Workaround:** [if any]
```

**Save ticket:**

```bash
# Add to bundle
cp support-ticket.md ${OUTDIR}/
tar czf ${OUTDIR}.tar.gz ${OUTDIR}
```

**Key Principles:**
- Be concise and specific
- Show your troubleshooting work
- Attach complete diagnostics
- Avoid speculation, stick to observations
- Professional tone

**Success Criteria:**
- ✅ Clear problem statement with diagnostics
- ✅ Troubleshooting documented
- ✅ Professional, specific tone

---

### Lab Summary

**What You Accomplished:**

You completed the full pre-escalation diagnostic workflow:
- ✅ Executed systematic 6-step health check (Kubernetes resources, admission webhook errors, agents, BGP, Grafana, logs)
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

The 6-step checklist ensures systematic troubleshooting before escalation.

**Why Checklists?** Prevent skipped steps, reduce cognitive load, ensure consistent quality.

**The 6 Steps:**

1. **Kubernetes Resources:** Verify VPCs, Agents, controller pods exist and running
2. **Events:** Check for Warning events indicating config errors vs bugs
3. **Agent Status:** Confirm agents connected, Ready, recent heartbeat
4. **BGP Health:** All sessions established (use kubectl or Prometheus)
5. **Grafana:** Check Fabric, Interfaces, Platform, Logs, Critical Resources dashboards
6. **Logs:** Check controller/agent logs for ERROR/PANIC messages

**Decision Matrix:**

| Indicator | Self-Resolve | Escalate |
|-----------|--------------|----------|
| Admission webhook | VLAN conflict, connection not found | Resource applied but config doesn't converge |
| Pods | Running | CrashLoopBackOff |
| Agent convergence | APPLIEDG == CURRENTG | APPLIEDG stuck below CURRENTG |
| BGP | Established | Flapping without cause |
| Logs | Config validation errors | PANIC, fatal errors |

**Using the Checklist:** Execute all steps → Document findings → Correlate data → Make decision → Act

---

### Concept 2: Evidence Collection

Complete diagnostic package includes:

1. **Problem Statement:** What broke, when, what changed, expected vs actual
2. **CRDs:** Full YAML of VPCs, wiring, agents, namespaces
3. **System events:** `kubectl get events -n fab` (K8s system component events; fabric CRDs emit no events)
4. **Logs:** Controller logs (current + previous if crashed)
5. **Agent Status:** Per-switch YAML with BGP, interfaces, platform health
6. **Versions:** Kubernetes, controller, agent versions
7. **Topology:** Switches, connections, servers
8. **Grafana Screenshots:** Interfaces, Logs, Fabric, Platform dashboards
9. **Timestamp:** When diagnostics collected

**Package it:**
```bash
tar czf hedgehog-diagnostics-$(date +%Y%m%d-%H%M%S).tar.gz hedgehog-diagnostics-*/
```

**Don't include:** Secrets/credentials (redact), unrelated resources, excessive logs, binaries

---

### Concept 3: Escalation Triggers

**ESCALATE When:**

1. **Controller Issues:** CrashLoopBackOff, PANIC/fatal errors, repeated restarts, reconciliation loops
2. **Agent Issues:** Repeated disconnects (not reboot), can't connect (switch reachable), unexpected errors
3. **Hardware Failures:** Switch not booting, kernel panics, persistent sensor errors
4. **Unexpected Behavior:** Ready status but doesn't work, config not applied, impossible metrics, BGP flapping
5. **Performance Issues:** Degradation without capacity issues, slow reconciliation, API unresponsive
6. **Data Plane:** Traffic not forwarding despite correct config, unexplained packet loss, VXLAN issues

**DO NOT ESCALATE (Self-Resolve):**

1. **Config Errors:** VLAN conflict, subnet overlap, invalid CIDR, connection not found, missing VPC
2. **Expected Warnings:** Unused interfaces down, VPC deletion blocked by attachments, validation errors
3. **Operational Questions:** How to configure, best practices, capacity → Check docs

**Decision Tree:**

```
Issue → Checklist → Clear config error? YES → Self-resolve
                 ↓ NO
                 → Controller/Agent crash? YES → Escalate
                 ↓ NO
                 → Hardware failure? YES → Escalate
                 ↓ NO
                 → Config correct but not working? YES → Escalate
                 ↓ NO
                 → Operational question? YES → Check docs
```

**Rule:** If admission webhook error or `kubectl get` clearly explains (config error) → Self-resolve. If no explanation found or unexpected behavior → Escalate.

---

### Concept 4: Support Ticket Best Practices

**Essential Components:**

1. **Clear Summary:** One-sentence problem statement (specific, not vague)
2. **Severity:** P1 (critical) → P4 (question) with business impact
3. **Impacted Resources:** Exact VPCs, servers, switches
4. **Timeline:** When started, what changed
5. **Symptoms:** Observable evidence (Grafana/kubectl/logs)
6. **Expected vs Actual:** What should vs does happen
7. **Troubleshooting:** What you tried and results
8. **Diagnostics:** Attached bundle with contents list
9. **Environment:** Versions (controller, agents, k8s), topology
10. **Impact:** Users affected, business impact, workarounds

**Key Principles:**
- Be concise and specific
- Show your work
- Attach complete diagnostics
- Report observations, not speculation
- Professional tone

**Common Mistakes to Avoid:**
- ❌ Vague: "It's not working" → ✅ Specific: "Server-03 cannot reach VPC gateway 10.10.1.1"
- ❌ Missing diagnostics → ✅ Attached bundle
- ❌ No troubleshooting → ✅ Documented attempts
- ❌ Emotional language → ✅ Professional tone

---

### Concept 5: Diagnostic Collection Automation

Automate collection for consistency and speed (30 seconds vs 5-10 minutes manual).

**Basic Script Structure:**

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTDIR="hedgehog-diagnostics-${TIMESTAMP}"
mkdir -p ${OUTDIR}

# Problem description prompt
read -p "Problem description: " DESC
echo "Issue: ${DESC}" > ${OUTDIR}/diagnostic-timestamp.txt
date >> ${OUTDIR}/diagnostic-timestamp.txt

# Collect CRDs, events, logs
kubectl get vpc,vpcattachment,vpcpeering -o yaml > ${OUTDIR}/crds-vpc.yaml 2>&1
kubectl get switches,servers,connections -o yaml > ${OUTDIR}/crds-wiring.yaml 2>&1
kubectl get agents -o yaml > ${OUTDIR}/crds-agents.yaml 2>&1
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > ${OUTDIR}/events.log 2>&1
kubectl logs -n fab deployment/fabric-ctrl --tail=2000 > ${OUTDIR}/controller.log 2>&1

# Versions and status
kubectl version > ${OUTDIR}/kubectl-version.txt 2>&1
kubectl get pods -n fab > ${OUTDIR}/pods-fab.txt 2>&1
kubectl get agents -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.version}{"\n"}{end}' > ${OUTDIR}/agent-versions.txt 2>&1

# Per-switch details (prompt for affected switches)
read -p "Affected switches (comma-separated): " SWITCHES
for switch in ${SWITCHES//,/ }; do
    kubectl get agent ${switch} -o yaml > ${OUTDIR}/agent-${switch}.yaml 2>&1
    kubectl get agent ${switch} -o jsonpath='{.status.state.interfaces}' | jq > ${OUTDIR}/agent-${switch}-interfaces.json 2>&1
done

# Compress
tar czf ${OUTDIR}.tar.gz ${OUTDIR}
echo "Created: ${OUTDIR}.tar.gz ($(du -h ${OUTDIR}.tar.gz | cut -f1))"
```

**Benefits:** Consistency, completeness, speed, error handling

**Redacting Secrets:**
```bash
find ${OUTDIR} -type f -exec sed -i 's/password:.*/password: REDACTED/g' {} \;
find ${OUTDIR} -type f -exec sed -i 's/token:.*/token: REDACTED/g' {} \;
```

---

## Troubleshooting

### Issue: Diagnostic Bundle Too Large

**Symptom:** Bundle exceeds upload limit (>10 MB)

**Solutions:**
1. Reduce log tail: `--tail=500` instead of `--tail=2000`
2. Split into multiple bundles (CRDs, logs, agent status separately)
3. Upload to cloud storage and share link

---

### Issue: kubectl Commands Timing Out

**Symptom:** Script hangs on kubectl commands

**Solutions:**
1. Add timeout: `kubectl get vpc -A -o yaml --request-timeout=30s`
2. Collect only critical resources
3. Increase cluster timeout in kubeconfig

---

### Issue: Previous Controller Logs Not Available

**Symptom:** `kubectl logs --previous` fails

**Cause:** Controller hasn't crashed (expected)

**Solution:** Script handles gracefully with `2>/dev/null || echo "No previous logs"`

---

### Issue: Agent CRD Has No Status

**Symptom:** `kubectl get agent <switch>` shows `status: {}`

**Troubleshooting:**
1. Check if agent pod exists: `kubectl get pods -n fab -l "wiring.githedgehog.com/agent=<switch>"`
2. Check switch registered: `kubectl get switch <switch>`
3. Check boot logs: `hhfab vlab serial <switch>`
4. Check fabric-boot: `kubectl logs -n fab deployment/fabric-boot`

**Solution:** Wait for registration or investigate boot failure

---

### Issue: Redacting Sensitive Information

**Automated redaction:**
```bash
find ${DIR} -type f -exec sed -i 's/password:.*/password: REDACTED/g' {} \;
find ${DIR} -type f -exec sed -i 's/token:.*/token: REDACTED/g' {} \;
```

**Manual review:** `grep -ri "password\|token\|secret" hedgehog-diagnostics-*/`

---

### Issue: Support Requests Additional Data

**Common requests:**
1. Time-range metrics: `curl 'http://YOUR_VM_IP:9090/api/v1/query_range?query=...'`
2. Switch CLI: `hhfab vlab ssh leaf-04 "show running-config"`
3. Detailed interface stats: `kubectl get agent leaf-04 -o json | jq '.status.state.interfaces["E1/8"]'`

**Best practice:** Keep original bundle, add supplemental files to ticket

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
kubectl get vpc,vpcattachment
kubectl get switches,agents
kubectl get pods -n fab

# 2. Admission Webhook / Agent Convergence
# Check ArgoCD for webhook errors at sync time
kubectl get agents   # APPLIEDG == CURRENTG?

# 3. Switch Agent Status
kubectl get agents
kubectl get agent <switch> -o yaml

# 4. BGP Health
kubectl get agent <switch> -o jsonpath='{.status.state.bgpNeighbors}' | jq
curl -s 'http://YOUR_VM_IP:9090/api/v1/query?query=fabric_agent_bgp_neighbor_session_state!=6' | jq

# 5. Grafana Dashboards (http://YOUR_VM_IP:3000, admin/admin)
# - Hedgehog Fabric (BGP, switch health)
# - Hedgehog Switch Interface Counters (interface state, errors)
# - Hedgehog Fabric Platform Stats (hardware health)
# - Hedgehog Fabric Logs (error logs)

# 6. Controller Logs
kubectl logs -n fab deployment/fabric-ctrl --tail=200 | grep -i error
```

**Diagnostic Collection:**

```bash
# Use automated script
./diagnostic-collect.sh

# OR manual collection
OUTDIR="hedgehog-diagnostics-$(date +%Y%m%d-%H%M%S)"
mkdir -p ${OUTDIR}

kubectl get vpc,vpcattachment -o yaml > ${OUTDIR}/crds-vpc.yaml
kubectl get events --all-namespaces --sort-by='.lastTimestamp' > ${OUTDIR}/events.log
kubectl logs -n fab deployment/fabric-ctrl --tail=2000 > ${OUTDIR}/controller.log
kubectl get agent <switch> -o yaml > ${OUTDIR}/agent-<switch>.yaml

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
