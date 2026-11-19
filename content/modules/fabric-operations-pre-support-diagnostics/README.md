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

You'll use Prometheus queries, Grafana dashboards, any available submission or admission output, and Agent CRD status together in a systematic escalation workflow. The live exercise shows how to keep a reported symptom separate from observed state.

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
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center?hsLang=en-us) module first — it takes about 20 minutes and only needs to be done once.

## Scenario: Complete Pre-Escalation Diagnostic Collection

A user reports that `server-07` cannot reach a proposed `customer-app-vpc`. First establish whether that configuration exists. The released R0 VM does not seed this VPC or a server-07 attachment, so this exercise works from a fresh VM without creating a fault or changing fabric objects. Treat the report as unconfirmed until the evidence supports it.

**Environment Access:**
- **Grafana:** http://YOUR_VM_IP:3000
- **Prometheus:** http://YOUR_VM_IP:9090
- **kubectl:** Already configured

### Task 1: Run the six-step pre-escalation checklist

Run these commands as `ubuntu` on the lab VM. Keep the same shell open for Tasks 1 and 2. The reported name is a search key, not proof that a VPC was submitted or accepted. The browser URLs use `YOUR_VM_IP`; commands run on the VM can reach Prometheus at `127.0.0.1`.

**1. Resource and controller health**

```bash
discover_server_07() {
  VPC=customer-app-vpc
  kubectl get connections | grep '^server-07--' || true
  mapfile -t matches < <(kubectl get connections -o name | grep '/server-07--unbundled--' || true)
  if [ "${#matches[@]}" -ne 1 ]; then
    echo 'Expected one unbundled server-07 Connection; inspect the listed wiring before continuing' >&2
    return 1
  fi
  CONN=${matches[0]}
  LINK=$(kubectl get "$CONN" -o jsonpath='{.spec.unbundled.link.switch.port}')
  if [[ "$LINK" != */* ]]; then
    echo 'Unexpected switch port format; inspect the Connection before continuing' >&2
    return 1
  fi
  SW=${LINK%%/*}
  PORT=${LINK#*/}
  printf 'server-07 connection=%s switch=%s port=%s\n' "$CONN" "$SW" "$PORT"
}
discover_server_07
kubectl get vpc "$VPC" --ignore-not-found -o name
kubectl get vpcattachments -o json | jq --arg vpc "$VPC" '[.items[] | select((.spec.subnet // "") | startswith($vpc + "/")) | {name: .metadata.name, subnet: .spec.subnet, connection: .spec.connection}]'
kubectl get pods -n fab
```

On the released wiring, the Connection is `server-07--unbundled--leaf-03` at `leaf-03/E1/3`. If the lookup reports zero or multiple unbundled Connections, stop and inspect the wiring; the later commands require one selected switch and port. An empty VPC name or attachment array means the desired object is absent **now**; it does not prove why it is absent. Check the submitting user's `kubectl apply` output or ArgoCD sync history before claiming a webhook rejection. Confirm that the controller pod is healthy before using later results.

**2. Agent reconciliation**

```bash
kubectl get agents
kubectl get agent "$SW" -o json | jq '{name: .metadata.name, currentGeneration: .metadata.generation, appliedGeneration: .status.lastAppliedGen, appliedCondition: [.status.conditions[]? | select(.type == "Applied") | .status]}'
```

Compare `APPLIEDG` with `CURRENTG`. Equal values mean the latest desired Agent configuration applied; they do not prove this reported VPC exists or that server traffic flows. If they differ, wait and recheck before escalating.

**3. Server connection and interface state**

```bash
kubectl get "$CONN" -o yaml
kubectl get agent "$SW" -o json | jq --arg port "$PORT" '{switch: .metadata.name, interface: $port, state: (.status.state.interfaces[$port] // null)}'
```

Record the actual port, operational state and counters. Interface status does not show tenant VLAN membership. If no attachment exists, do not expect tenant DHCP from this Connection.

**4. BGP health**

```bash
kubectl get agent "$SW" -o json | jq '.status.state.bgpNeighbors // {}'
curl -fsSG --data-urlencode 'query=fabric_agent_bgp_neighbor_session_state' http://127.0.0.1:9090/api/v1/query | jq '{series: (.data.result | length), notEstablished: [.data.result[]? | select(.value[1] != "6") | .metric]}'
```

Prometheus state `6` means Established. Check that `series` is greater than zero before interpreting an empty `notEstablished` array; no series is a telemetry gap, not proof that every session is healthy. BGP health is context, not an explanation for a VPC that is absent.

**5. Grafana review**

Open `http://YOUR_VM_IP:3000` (admin/admin). In **Hedgehog Switch Interface Counters**, select the discovered switch and port and record the shown state and traffic counters. In **Hedgehog Fabric**, review BGP sessions. In **Hedgehog Fabric Logs**, search for the switch and report whether matching logs appear. The virtual switches may have no temperature, fan, ASIC or filesystem sensor series; do not report missing hardware-only panels as a fault. These dashboards do not display configured tenant VLAN membership.

**6. Controller logs**

```bash
kubectl logs -n fab deployment/fabric-ctrl --tail=200 | grep -iE 'error|panic' || true
kubectl get pods -n fab
```

No matches are a valid result. Collect `--previous` logs only if the controller restarted. Do not infer a crash from an empty grep result.

For the fresh released image, the expected finding is an absent `customer-app-vpc` and no attachment to it. The Connection, Agent and telemetry checks describe the healthy baseline; they do not establish a DHCP failure. Record that the request needs its desired configuration or submission history before support escalation can be decided.

### Task 2: Collect a local diagnostic bundle

The bundle contains cluster details. Keep it on the VM and review it for sensitive values before sharing it with anyone.

```bash
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
OUTDIR="hedgehog-diagnostics-${TIMESTAMP}"
mkdir -p "$OUTDIR"
printf 'Reported issue: server-07 cannot reach %s\nCollection time: %s UTC\n' "$VPC" "$(date -u +%FT%TZ)" > "$OUTDIR/report.txt"
printf 'Connection: %s\nSwitch: %s\nPort: %s\n' "$CONN" "$SW" "$PORT" >> "$OUTDIR/report.txt"
kubectl get vpc "$VPC" --ignore-not-found -o yaml > "$OUTDIR/reported-vpc.yaml"
kubectl get vpcattachments -o json | jq --arg vpc "$VPC" '[.items[] | select((.spec.subnet // "") | startswith($vpc + "/"))]' > "$OUTDIR/reported-attachments.json"
kubectl get "$CONN" -o yaml > "$OUTDIR/server-connection.yaml"
kubectl get agents > "$OUTDIR/agents.txt"
kubectl get agent "$SW" -o yaml > "$OUTDIR/affected-agent.yaml"
kubectl get pods -n fab > "$OUTDIR/fab-pods.txt"
kubectl get events -n fab --sort-by='.lastTimestamp' > "$OUTDIR/fab-events.txt"
kubectl logs -n fab deployment/fabric-ctrl --tail=500 > "$OUTDIR/controller.log"
kubectl version > "$OUTDIR/kubectl-version.txt"
tar czf "$OUTDIR.tar.gz" "$OUTDIR"
printf 'Local bundle: %s.tar.gz\n' "$OUTDIR"
```

If the controller has restarted, add its previous log with `kubectl logs -n fab deployment/fabric-ctrl --previous > "$OUTDIR/controller-previous.log"` and recreate the archive. Save Grafana screenshots under descriptive names in `$OUTDIR`, then recreate the archive. Empty reported-object files are useful evidence. Do not add secrets or unrelated objects.

### Task 3: Record a supported decision

Open `$OUTDIR/report.txt` and add a decision with the evidence behind it. On a fresh R0 VM, record **configuration/request history needed**: the reported VPC and attachment are absent, and no submission result was provided. Ask for the intended VPC/attachment manifests and the `kubectl apply` result or ArgoCD sync result. A known admission error with a clear configuration fix can be self-resolved. Escalate a controller crash, persistent Agent divergence or unexplained forwarding failure only when the corresponding evidence exists.

### Task 4: Draft a support handoff

Create `$OUTDIR/support-ticket.md` with the report, observed resource names, collection time, checklist results, versions, and any screenshots. Mark unverified symptoms as **reported**, state what was actually observed, and leave severity and impact as **unknown** until confirmed. Include the decision from Task 3 and the next requested evidence. Recreate the archive after adding the draft:

```bash
tar czf "$OUTDIR.tar.gz" "$OUTDIR"
```

Review the bundle manually before sharing it. List its contents with `tar tzf "$OUTDIR.tar.gz"` and check file sizes. A word search for `password`, `token` and `secret` can help find material to inspect, but automated replacement does not reliably redact credentials.

**Success criteria:** You ran all six read-only checks, saved a local evidence bundle, separated the user's report from observed state, and wrote a supported next action. No VPC, attachment or fault was created.

---

### Lab Summary

You practiced the pre-escalation workflow on a real fabric baseline: discover the actual topology, verify the reported objects, inspect Agent and BGP state, review Grafana and logs, and package only relevant evidence. An absent object calls for configuration or submission history; it is not, by itself, evidence of a failed webhook or switch.

---
## Concepts & Deep Dive

### Concept 1: Pre-Escalation Diagnostic Checklist

The 6-step checklist ensures systematic troubleshooting before escalation.

**Why Checklists?** Prevent skipped steps, reduce cognitive load, ensure consistent quality.

**The 6 Steps:**

1. **Kubernetes Resources:** Verify VPCs, Agents, controller pods exist and running
2. **Submission and system events:** Check the apply or ArgoCD result for admission errors; Kubernetes system events provide separate context
3. **Agent Status:** Compare applied/current generations and inspect available operational state
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
4. **Unexpected Behavior:** Configuration is present and converged but forwarding fails, impossible metrics, BGP flapping
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

**Rule:** A recorded admission error can explain a rejected submission. An absent object from `kubectl get` alone cannot. Request the configuration and submission history when they are missing; escalate unexplained behavior after the relevant checks.

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

Automate collection for consistency. The Task 2 commands are the runnable baseline example; adjust the scope and filenames to the actual incident.

Use the Task 2 collection block as the basic script. It binds output names to the discovered Connection and switch, limits the controller log tail, and leaves the archive on the VM for review. Check each command result before sharing a bundle.

**Before sharing:** Inspect the collected files manually for credentials and unrelated data. Search terms can help locate values to review, but a simple text substitution is not reliable redaction.

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

**Manual review:** Inspect each file before sharing. `grep -riE 'password|token|secret' "$OUTDIR"` can locate candidates, but a negative search does not prove that the bundle contains no credentials.

---

### Issue: Support Requests Additional Data

**Common requests:**
1. Time-range metrics: `curl 'http://YOUR_VM_IP:9090/api/v1/query_range?query=...'`
2. Detailed interface stats: `kubectl get agent "$SW" -o json | jq --arg port "$PORT" '.status.state.interfaces[$port]'`

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

Use Task 1's six steps in order: verify the reported objects and controller, compare Agent generations, inspect the discovered server port, check BGP series, review Grafana, and check controller logs. Use submission or ArgoCD history to identify an admission error; object absence alone cannot identify its cause.

**Diagnostic Collection:**

Use Task 2's local collection commands. Review the files and the archive before any support handoff.

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
