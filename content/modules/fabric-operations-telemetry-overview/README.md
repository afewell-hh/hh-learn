---
title: "Fabric Telemetry Overview"
slug: "fabric-operations-telemetry-overview"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.1.0"
validated_on: "2026-11-19"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - telemetry
  - prometheus
  - observability
  - metrics
description: "Trace switch metrics into Prometheus and query live fabric series in the released R0 lab."
order: 301
---

# Fabric Telemetry Overview

## Introduction

The released R0 lab includes a virtual Hedgehog fabric and a management cluster with Prometheus, Grafana and Loki. Switch telemetry helps you observe BGP state, interface traffic and errors over time. This module uses Prometheus directly so you can tell a fresh metric sample from a dashboard picture.

On this image, switch Alloy sends metrics by **remote write** to the lab endpoint, which delivers them to Prometheus. Grafana reads Prometheus. Logs go to Loki. The Prometheus **Targets** page lists jobs that Prometheus scrapes; a remote-write sender is not a scrape target. The old instruction to find an UP `fabric-proxy` target is therefore invalid even when switch metrics are healthy.

```text
Virtual switches: Fabric Agent metrics → Alloy → R0 remote-write endpoint
                                               ↓
Management cluster:                         Prometheus → Grafana
Virtual-switch logs: Alloy → Loki ───────────────────────→ Grafana
```

The released recipe points switch metrics at `http://172.30.0.2:9090/api/v1/write` through the host bridge. That is an internal lab address, not a URL for your browser. Prometheus is available in the browser at `http://YOUR_VM_IP:9090`; Grafana is at `http://YOUR_VM_IP:3000`. Replace `YOUR_VM_IP` with the lab VM address from the access lesson.

### Learning objectives

After this module, you can:

1. Explain the difference between a Prometheus scrape target and a remote-write sender.
2. Find switch metric series and their `hostname` labels in Prometheus.
3. Distinguish a counter from a gauge and use a bounded rate query.
4. Read BGP state as an observed value, allowing time for a fresh lab to converge.
5. Explain why a new VM cannot show history from before its first boot.

## Prerequisites

Start the released R0 lab VM and wait for its VLAB to become ready. Use `kubectl` as `ubuntu` on the VM; open browser URLs from your own browser. This module does not require a student VPC or attachment. A fresh VM may take several minutes to populate switch metrics. If your browser cannot reach the Prometheus port, check the access lesson's VM IP and firewall instructions before interpreting a blank page as missing telemetry.

## Lab: inspect live switch metrics

### Task 1: Open Prometheus and understand Targets

Open `http://YOUR_VM_IP:9090` and select the query view. Open **Status → Targets** once. It shows Prometheus scrape jobs for the management stack; it does not list seven switch remote-write senders or a `fabric-proxy` scrape target. Do not grade switch telemetry by requiring every target on this page to be UP. A management scrape target can be down while switch remote write still provides series, and the reverse is also possible.

On the VM, you can check whether Prometheus itself is ready:

```bash
curl --fail --silent --show-error http://127.0.0.1:9090/-/ready
```

A ready response proves the service answers; it does not prove any switch sample has arrived. Continue with the queries below.

### Task 2: Find switch series and hostname labels

Run these **instant queries** in the Prometheus expression box, one at a time:

```promql
fabric_agent_interface_in_utilization
fabric_agent_interface_in_utilization{hostname="leaf-01"}
count by (hostname) (fabric_agent_interface_in_utilization)
```

The first query lists interface utilization gauges. The second narrows to one switch. The third groups the observed series by `hostname`; on a converged R0 lab you should find the expected virtual-switch names, including `leaf-01`, `leaf-02`, `leaf-03`, `leaf-04`, `leaf-05`, `spine-01` and `spine-02`. Values near zero are normal on idle lab interfaces. Record the query time, one actual hostname/interface label pair and its value. Do not copy the example names as evidence if your result differs.

If there is no result just after boot, wait a few minutes and repeat once. The R0 release manifest enables Fabric Agent and Unix metrics with a 60-second collection interval, but transport and startup add delay. A missing sample at one instant does not identify which component failed.

### Task 3: Read BGP state after convergence

Run:

```promql
count(fabric_agent_bgp_neighbor_session_state)
count(fabric_agent_bgp_neighbor_session_state == 6)
fabric_agent_bgp_neighbor_session_state != 6
```

State value `6` means Established in this metric. The first two queries show how many neighbour series exist and how many currently report Established; the last lists non-established series. This seven-switch topology has shown **62 neighbour series** after convergence. It can show fewer Established sessions during boot or a transient flap, so 62/62 at every instant is not a success requirement. Record both counts and the time. If they differ, repeat after the fabric settles and investigate persistent differences with the affected `hostname` and peer labels.

The count is a metric observation, not proof that a student VPC or server attachment works. The course's VPC exercises use their own object and connectivity checks.

### Task 4: Compare a counter and a rate

Run:

```promql
fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/5"}
rate(fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/5"}[5m]) * 8
```

The octet counter accumulates bytes; its raw value is not the current link speed. `rate(...[5m]) * 8` estimates bits per second from samples in a five-minute window. A fresh VM may need time to collect enough samples before the rate appears. A utilization gauge such as `fabric_agent_interface_in_utilization` is an instantaneous reported level and does not need `rate()`.

To see whether a BGP sample is recent, you can also query:

```promql
time() - timestamp(fabric_agent_bgp_neighbor_session_state{hostname="leaf-01"})
```

This gives sample age in seconds for matching series. Record the observed age instead of assuming a fixed delivery delay.

### Task 5: Record the result and limits

In a local note, record the VM boot or collection time, Prometheus readiness result, and the actual outputs of one interface gauge, both BGP counts, and one counter or rate query. State whether all seven switch hostnames were visible **at the time you checked**. If a query returned no data, record that rather than inventing a value. The hands-on attestation means you performed these observations; it does not certify full fabric or dataplane health.

## Troubleshooting a missing series

Follow the evidence path in order:

1. Check `http://127.0.0.1:9090/-/ready` on the VM. A failed response points first to Prometheus or the management cluster.
2. Check the query spelling and time range. An instant series query is a better first check than a five-minute `rate()` right after boot.
3. Check whether other switch `hostname` labels are present. One missing hostname is different from no switch metrics at all.
4. Check VLAB readiness and Agent generations with `kubectl get agents`; distinguish a fabric startup problem from a telemetry-only gap.
5. Inspect the switch Alloy service and the configured telemetry target if the gap persists. Collect its status and logs before changing services. The Targets page cannot prove whether a remote-write sender is working.

Do not treat an empty `defaultAlloyConfig` display as proof that telemetry is disabled: the installed Fabricator may default and normalize that field while Agent telemetry targets remain configured. Avoid restarting Alloy or editing Fabricator objects as a first diagnostic step.

## Retention and a new VM

Prometheus stores time-series samples within its configured retention and available disk. This lesson does not promise a fixed 15-day window or imply that a fresh image contains 24 hours of useful prior telemetry. A new clone may contain captured build-time samples and then collects fresh data after boot; use sample timestamps before treating older points as current health. Normal stop/start of the same VM preserves its management storage, while a VM from a new immutable image has separate state. If a historical query has no data, check the actual first sample and query window before drawing a retention conclusion.

## Assessment preparation

Be ready to explain why `fabric_agent_*` series can be present while no `fabric-proxy` target appears on `/targets`, why a counter needs a rate for traffic speed, and why the BGP Established count may change during boot. Your local observation note is the evidence for this module's lab attestation.
