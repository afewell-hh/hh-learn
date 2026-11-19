---
title: "Dashboard Interpretation"
slug: "fabric-operations-dashboard-interpretation"
difficulty: "beginner"
estimated_minutes: 20
version: "v1.1.0"
validated_on: "2026-11-19"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - grafana
  - dashboards
  - observability
description: "Tour the six released R0 dashboards, interpret real switch signals, and recognize virtual-hardware and fresh-history limits."
order: 302
---

# Dashboard Interpretation

## Introduction

Grafana turns Prometheus metrics and Loki logs into views you can inspect quickly. The released R0 VM contains six course dashboards. A dashboard is a way to ask questions about the fabric; a green cell or an empty panel is not, by itself, proof that a server can forward traffic.

The lab uses **virtual switches**. Some dashboards were designed for physical hardware and can show `No data` or `N/A` for sensors or ASIC limits. A new VM also lacks a full day of useful switch history. Record those limits honestly instead of treating them as lab failures.

### Learning objectives

After this module, you can:

1. Find the six course dashboards and select a real switch and interface.
2. Read current BGP state, interface traffic and errors, and switch logs.
3. Distinguish unavailable virtual-hardware panels from a real observed fault.
4. Choose a time range supported by the VM's actual samples and describe what the panel does not prove.

## Prerequisites and access

Start the released R0 lab VM and let its fabric and telemetry settle. Open `http://YOUR_VM_IP:3000` in your browser, replacing `YOUR_VM_IP` with the lab VM address from the access lesson. Sign in with the course Grafana login `admin` / `admin`. This is a read-only tour; it does not require a student VPC or attachment.

The shipped dashboards are:

| Dashboard title | UID | Main question |
| --- | --- | --- |
| Hedgehog Fabric | `ab831ceb-cf5c-474a-b7e9-83dcd075c218` | What BGP state is visible? |
| Hedgehog Switch Interface Counters | `a5e5b12d-b340-4753-8f83-af8d54304822` | What is one interface doing? |
| Hedgehog Fabric Logs | `c42a51e5-86a8-42a0-b1c9-d1304ae655bv` | Which switch logs are present? |
| Hedgehog Fabric Platform Stats | `f8a648b9-5510-49ca-9273-952ba6169b7v` | Are physical sensor series available? |
| Hedgehog Switch Critical Resources | `fb08315c-cabb-4da7-9db9-2e17278f1781` | Which route and nexthop values are reported? |
| Hedgehog mod of Node Exporter Full | `rYdddlPWv` | What host CPU and memory data is present? |

The dashboard UID helps you identify the right saved dashboard if search results have similar names. Use the titles in **Dashboards** to open them; the URL slug may differ.

## Lab: an evidence-based dashboard tour

Create a local note with the collection time, selected time range, dashboard selectors and what you actually saw. Start with **Last 15 minutes** or the available interval since this VM booted. Extend the range only if data exists. In the earlier 24-hour browser view, Fabric status-history cells represented roughly 15-minute intervals; a green cell at that resolution can hide a short flap. A shorter range may render at finer resolution. Do not write “no flaps in 24 hours” from a fresh VM or this panel alone.

### Task 1: Fabric BGP view

Open **Hedgehog Fabric** and use its **Switch** selector. In the **BGP Neighbor** and **BGP Session State** sections, identify one visible switch and neighbor pair and its current displayed state. After convergence, the seven-switch lab has shown 62 BGP neighbour series, with Established represented by state 6 in the underlying metric. During boot or a transient change, fewer may be Established. Record the time, selected range and any non-established row you actually see. The **BGP Dropped connections**, prefixes, updates and keepalives panels can add context, but a flat or green history view alone does not prove every session stayed up continuously.

If you need a precise current count, Course 3.1 shows the Prometheus queries for total and Established BGP series. A dashboard history panel and a current instant query answer different questions.

### Task 2: One real interface

Open **Hedgehog Switch Interface Counters**. Select **leaf-01** and **E1/1** in the **Switch** and **Interface** dropdowns; these selectors were visible in the released-image browser tour. If that series is unavailable on your VM, choose a switch and interface that the dropdowns actually list and record your choice.

Inspect the interface state, utilization, bits per second, and **Errors and discards** panels for the selected port. Record the displayed values or `No data`. A near-zero traffic rate can be normal in an idle lab. A rising error or discard counter warrants investigation, but a single nonzero historical count does not identify a cable fault or congestion on a virtual switch. Do not apply fixed 70% or 90% “healthy” thresholds without workload context.

### Task 3: Switch logs

Open **Hedgehog Fabric Logs** and select **leaf-01** in the **Switch** dropdown. The dashboard's default selection can show `No data`; select a real switch before concluding logs are absent. Inspect **Errors**, **BGP Logs** and **WARNINGS** for the chosen time range. Record one actual timestamped line if present, or note that none matched your selection. A search for `VPC` is optional; no hit does not prove that a VPC event never happened. Loki logs need interpretation alongside object and metric evidence.

### Task 4: Platform and critical resources

Open **Hedgehog Fabric Platform Stats**, select **leaf-01** with **Host Name**, and note which temperature, fan and PSU panels have data. In this virtual-switch lab, CPU/ASIC temperature, fan speed and air-temperature panels have shown `No data`. That is expected for missing physical sensors and is **not** a failed hardware-health check. If a panel does return a value, report the value and source; do not claim a physical cooling or PSU condition from a virtual switch.

Open **Hedgehog Switch Critical Resources** and select the same switch with **Switch**. The released browser tour showed values for **Routes Available** and **Nexthops**, so this dashboard is not universally empty. Record any reported route, nexthop or neighbor value. These counters are useful as displayed software signals, but a virtual switch value does not prove physical ASIC or TCAM capacity. Do not require every ACL or hardware panel to report a value for this lab.

### Task 5: Node Exporter host data

Open **Hedgehog mod of Node Exporter Full**. Note the selected **Host** before interpreting the panels. The released browser tour showed CPU and RAM samples; the default host also showed an uptime value, while **Root FS Used**, **RootFS Total** and **SWAP Used** showed `N/A`. A virtual-switch selection can have CPU/RAM series without a root filesystem series. Record what is present for **your** selection rather than marking the whole dashboard healthy or broken.

A high system-load gauge shortly after boot can be a startup transient. Record the time and compare with a later sample before calling it an incident.

### Task 6: Summarize what the dashboards establish

Write a short table in your local note:

| View | Selected variable and time range | Observed value or `No data` | What it does not prove |
| --- | --- | --- | --- |
| Fabric BGP | One switch/neighbor | Current state or history cell | No short flap occurred |
| Interface Counters | One switch/interface | State, traffic and errors | Student server connectivity |
| Logs | One switch | Matching line or no match | A missing log means no event occurred |
| Platform / Critical Resources | One virtual switch | Available values and unavailable sensors | Physical hardware health |
| Node Exporter | One host or switch | CPU/RAM and any `N/A` panels | Every filesystem has telemetry |

The hands-on attestation means you toured and recorded these views. It does not certify the fabric, a physical switch, or a student application's connectivity. Use the course's VPC and attachment exercises for those checks.

## When a panel says No data

1. Check the dashboard time range against the VM's first available sample. A new clone cannot supply a full 24-hour history from its own running time.
2. Check the **node**, **interface** and log-file variables. The Logs dashboard may open on a selection that has no matching lines.
3. Compare a switch metric in Prometheus using Course 3.1. If Prometheus has fresh series but one panel is empty, inspect the panel query and labels before diagnosing telemetry transport.
4. For logs, select the right switch and query window in Loki/Grafana. Metrics and logs take different paths.
5. For temperature, fan, PSU, ASIC/TCAM, root filesystem or swap views, ask whether the virtual switch exports that series. Record `N/A` as a limit when it does not.

A short investigation should name the exact panel, selector, time range and data source. Avoid restarting services or changing fabric configuration because one optional panel is blank.

## Assessment preparation

Be ready to explain why one `No data` panel can be normal, why an interface error trend needs context, why a coarse green history cell cannot rule out a short flap, and why a virtual-switch route value is not a physical ASIC capacity test. Your local observation note is the evidence for this module's lab attestation.
