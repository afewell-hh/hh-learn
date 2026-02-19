---
title: "Fabric Telemetry Overview"
slug: "fabric-operations-telemetry-overview"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - telemetry
  - prometheus
  - observability
  - metrics
description: "Learn how Hedgehog collects and stores fabric telemetry. Explore Prometheus queries, metric types, and data retention for network observability."
order: 301
---

# Fabric Telemetry Overview

## Introduction

In Course 2, you became proficient at provisioning VPCs, attaching servers, and validating connectivity. You created resources and verified they worked. But in production operations, provisioning is just the beginning. The real questions become:

- **Is my fabric healthy right now?**
- **How much traffic is flowing through each interface?**
- **Are my switches experiencing errors?**
- **Is my network performing as expected?**

This is where **observability** comes in—the ability to see what's happening inside your fabric over time. Course 2 was about **creating resources** (VPCs, attachments, validation). Course 3 is about **observing resources** (metrics, health, trends, diagnostics).

In this module, you'll learn how Hedgehog collects telemetry from switches, the path metrics take from switch to dashboard, different types of metrics (counters vs gauges), how to query raw metrics in Prometheus, and how long metrics are retained and why. You'll access the Prometheus UI directly and run queries to see the raw metrics that power Grafana dashboards.

Hedgehog uses the **LGTM stack** (Loki + Grafana + Tempo + Mimir) for observability:
- **Prometheus**: Time-series metrics database
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Alloy**: Telemetry collector (runs on switches)

In your lab environment, these tools run in the External Management K3s Cluster (EMKC) alongside ArgoCD and Gitea.

## Learning Objectives

By the end of this module, you will be able to:

1. **Explain telemetry architecture** - Describe how metrics flow from switches to Grafana
2. **Identify metric sources** - List where metrics originate (Alloy agents, fabric-proxy, Prometheus)
3. **Distinguish metric types** - Differentiate between counters, gauges, and their use cases
4. **Navigate Prometheus UI** - Query basic fabric metrics using PromQL
5. **Understand data retention** - Explain how long metrics are stored and why

## Prerequisites

- Course 1 completion (Foundations & Interfaces)
- Course 2 completion (Provisioning & Day 1 Operations)
- Understanding of GitOps workflow and three interfaces
- VPC provisioning experience
- Basic understanding of metrics and time-series data (helpful but not required)

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Scenario: Exploring Fabric Telemetry

You've been operating Hedgehog Fabric for several weeks. VPCs are provisioned, servers are attached, and traffic is flowing. Now you want to understand the telemetry system that monitors your fabric. In this hands-on exploration, you'll access Prometheus directly and run queries to see the raw metrics that power your observability stack.

**Environment Access:**
- **Prometheus:** http://YOUR_VM_IP:9090
- **Grafana:** http://YOUR_VM_IP:3000 (we'll use in Module 3.2)
- **kubectl:** Already configured

### Task 1: Access Prometheus UI

**Objective:** Navigate to Prometheus and understand the interface

1. **Open Prometheus in your browser:**
   - Navigate to http://YOUR_VM_IP:9090 (replace YOUR_VM_IP with your lab VM's IP address)
   - You should see the Prometheus query interface

2. **Explore the UI sections:**
   - **Graph tab**: Query and visualize metrics
   - **Alerts tab**: Active alerts (if configured)
   - **Status dropdown**:
     - **Targets**: View scrape targets (switches)
     - **Configuration**: Prometheus config
     - **Service Discovery**: How Prometheus finds targets

3. **Check scrape targets:**
   - Click **Status → Targets**
   - Look for fabric-proxy and other Hedgehog targets
   - Verify state = "UP" (healthy scraping)

   You can also navigate directly to http://YOUR_VM_IP:9090/targets

**Success Criteria:**
- ✅ Prometheus UI loads successfully
- ✅ Targets page shows fabric-related endpoints
- ✅ All targets show state = UP

### Task 2: Query Switch Metrics

**Objective:** Run basic PromQL queries to explore switch metrics

1. **Query interface utilization for all switches:**

   In the Prometheus query box, enter:
   ```promql
   fabric_agent_interface_in_utilization
   ```

   Click **Execute**

   **Expected result:** List of interfaces across all switches with utilization gauge values:
   ```
   fabric_agent_interface_in_utilization{hostname="leaf-01",interface="E1/1"} 0
   fabric_agent_interface_in_utilization{hostname="leaf-01",interface="E1/2"} 0
   ...
   ```

   > **Note:** In the lab environment traffic is minimal, so utilization values will be near 0. In production, you'd see real percentage values representing interface load.

   Click **Graph** tab to see time series visualization

2. **Query interface utilization for a specific switch:**
   ```promql
   fabric_agent_interface_in_utilization{hostname="leaf-01"}
   ```

   **Expected result:** Utilization gauge values filtered to leaf-01 only

3. **Query interface byte counters:**
   ```promql
   fabric_agent_interface_out_octets{hostname="leaf-01"}
   ```

   **Expected result:** Counter values for all interfaces on leaf-01:
   ```
   fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/1"} 152345678901
   fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/2"} 98234567890
   ...
   ```

   **Note:** These are counters (large numbers that keep increasing)

4. **Calculate bandwidth utilization:**
   ```promql
   rate(fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/5"}[5m]) * 8
   ```

   **Expected result:** Bits per second over last 5 minutes:
   ```
   {hostname="leaf-01",interface="E1/5"} 1497  # ~1.5 Kbps (lab traffic only)
   ```

   **Explanation:**
   - `rate([5m])` calculates bytes/sec over 5 minutes
   - `* 8` converts bytes to bits
   - Result is bandwidth in bits per second

**Success Criteria:**
- ✅ Interface utilization metrics display for all switches
- ✅ Interface byte counters visible
- ✅ Bandwidth calculation returns values

### Task 3: Explore BGP Metrics

**Objective:** Query BGP neighbor status to verify fabric underlay

1. **Query all BGP neighbors:**
   ```promql
   fabric_agent_bgp_neighbor_session_state
   ```

   **Expected result:** BGP neighbors with numeric state values (6 = Established):
   ```
   fabric_agent_bgp_neighbor_session_state{hostname="leaf-01",peer_address="172.30.128.1",...} 6
   fabric_agent_bgp_neighbor_session_state{hostname="leaf-01",peer_address="172.30.128.2",...} 6
   ...
   ```

   > **Note:** BGP session state is reported as an integer. The value `6` means Established — this is the standard BGP state machine encoding.

2. **Filter for non-established neighbors (find problems):**
   ```promql
   fabric_agent_bgp_neighbor_session_state != 6
   ```

   **Expected result:** Empty (all neighbors healthy) or list of down neighbors

3. **Count total BGP sessions:**
   ```promql
   count(fabric_agent_bgp_neighbor_session_state)
   ```

   **Expected result:** 62 (total BGP sessions across all switches in a 7-switch fabric)

4. **Count established BGP sessions:**
   ```promql
   count(fabric_agent_bgp_neighbor_session_state == 6)
   ```

   **Expected result:** 62 (should match total if fabric is healthy)

**Success Criteria:**
- ✅ BGP metrics visible
- ✅ All neighbors show state value 6 (Established)
- ✅ Count queries both return 62 (total matches established when fabric is healthy)

### Task 4: Understand Metric Labels

**Objective:** Learn how labels identify specific metrics

1. **Query metrics with multiple labels:**
   ```promql
   fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/1"}
   ```

   **Observe labels:**
   - `hostname="leaf-01"` - Which switch
   - `interface="E1/1"` - Which interface

2. **Query with partial label matching:**
   ```promql
   fabric_agent_interface_out_octets{hostname=~"leaf-.*"}
   ```

   **Explanation:** `=~` means "matches regex", `leaf-.*` matches all leaf switches

3. **List all unique switches in metrics:**
   ```promql
   count by (hostname) (fabric_agent_interface_out_octets)
   ```

   **Expected result:** One entry per switch

**Key Insight:** Labels allow you to filter and aggregate metrics. Hedgehog fabric metrics use `hostname` to identify the switch and `interface` (or `peer_address` for BGP) to identify the specific resource.

**Success Criteria:**
- ✅ Understand how labels filter metrics
- ✅ Can query specific switch or interface
- ✅ See how regex matching works

### Lab Summary

**What you accomplished:**
- ✅ Accessed Prometheus UI and verified scrape targets
- ✅ Queried switch interface utilization and byte counter metrics
- ✅ Examined BGP neighbor status using numeric state values
- ✅ Calculated bandwidth utilization using PromQL
- ✅ Understood metric labels and filtering

**What you learned:**
- Prometheus provides raw metric access for your fabric
- PromQL enables powerful filtering and calculations
- Hedgehog fabric metrics use `hostname` to identify switches (e.g., `hostname="leaf-01"`)
- Counters require `rate()` function for meaningful data
- BGP session state is numeric: 6 = Established

## Concepts & Deep Dive

### Telemetry Architecture

Understanding how metrics flow from switches to your dashboard helps you troubleshoot when metrics are missing.

**The Telemetry Flow:**

```
┌─────────────────────────────────────────┐
│          SONiC Switch (e.g., leaf-01)   │
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │Fabric Agent  │◄───│Alloy Collector│ │
│  │(metrics      │    │(scrapes every │ │
│  │ source)      │    │ 120 seconds)  │ │
│  └──────────────┘    └───────┬───────┘ │
│                               │         │
│  ┌──────────────┐             │         │
│  │Node Exporter │◄────────────┘         │
│  │(system       │                       │
│  │ metrics)     │                       │
│  └──────────────┘                       │
│                               │         │
└───────────────────────────────┼─────────┘
                                │
                                │ Push metrics
                                ▼
                    ┌───────────────────┐
                    │  Control Node     │
                    │  ┌─────────────┐  │
                    │  │fabric-proxy │  │
                    │  │(aggregator) │  │
                    │  └──────┬──────┘  │
                    └─────────┼─────────┘
                              │
                              │ Remote Write
                              ▼
                  ┌───────────────────────┐
                  │   EMKC Cluster        │
                  │  ┌─────────────────┐  │
                  │  │  Prometheus     │  │
                  │  │  (stores metrics)│  │
                  │  └────────┬────────┘  │
                  │           │           │
                  │           ▼           │
                  │  ┌─────────────────┐  │
                  │  │   Grafana       │  │
                  │  │  (visualizes)   │  │
                  │  └─────────────────┘  │
                  └───────────────────────┘
```

**Components Explained:**

**1. Alloy Agents (on each switch)**
- Grafana's telemetry collector
- Scrapes Fabric Agent metrics every 120 seconds
- Scrapes Node Exporter metrics (CPU, memory, disk)
- Collects syslog for log aggregation
- Configured via `defaultAlloyConfig` in Fabricator

**2. fabric-proxy (control node)**
- Receives metrics from all Alloy agents
- Forwards to Prometheus via Remote Write protocol
- Runs as a service on port 31028
- Single aggregation point for all switch telemetry

**3. Prometheus (EMKC)**
- Time-series database for metrics
- Stores data with timestamps
- Provides PromQL query language
- Retention: 15 days by default (configurable)

**4. Grafana (EMKC)**
- Queries Prometheus for data
- Renders visualizations and dashboards
- Provides 6 pre-built Hedgehog dashboards
- Web UI: http://YOUR_VM_IP:3000

**Key Insight:** Metrics start on switches, flow through fabric-proxy, land in Prometheus, and are visualized in Grafana. Understanding this flow helps troubleshoot when metrics are missing.

### Metric Sources

Hedgehog collects metrics from four primary sources:

**1. Fabric Agent (Switch Metrics)**

The Fabric Agent runs on each SONiC switch and provides:
- **BGP metrics**: Neighbor status (up/down), prefixes received/sent
- **Interface metrics**: Packet counters, byte counters, error rates, operational state
- **ASIC critical resources**: Route table usage, ARP table size, ACL capacity
- **Platform metrics**: PSU voltage, fan speeds, temperature sensors

**2. Node Exporter (System Metrics)**

Linux system metrics from each switch:
- **CPU**: Utilization (user, system, idle, iowait), load average
- **Memory**: Total/available/free, swap usage
- **Disk**: Space used/available, I/O operations
- **Network**: Interface traffic (all ports), connection states

**3. Fabric Controller (Control Plane Metrics)**

Kubernetes controller metrics:
- CRD reconciliation status
- VPC allocation counts
- Controller health and performance
- API request latencies

**4. DHCP Server (Network Services Metrics)**

DHCP service metrics:
- Lease counts per VPC subnet
- Pool utilization percentage
- DHCP request/response rates
- Lease expiration tracking

**Metric Access Pattern:**
- **Fabric Agent**: Exposed on switch, scraped by Alloy
- **Node Exporter**: Built into SONiC OS, scraped by Alloy
- **Controller**: Exposes metrics on control plane, scraped directly by Prometheus
- **DHCP**: Metrics available via controller

### Metric Types

Prometheus uses different metric types for different data. Understanding the difference is crucial for writing correct queries.

**Counters (Monotonically Increasing)**

- **Definition**: Values that only go up (never decrease)
- **Reset**: Only reset to 0 when system restarts
- **Examples**:
  - Bytes transmitted on interface (keeps counting up)
  - Total BGP updates received (cumulative)
  - Packet errors (total count)

**Counter Example:**
```
fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/1"} 1523456789
fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/1"} 1523789012  # 2 minutes later
fabric_agent_interface_out_octets{hostname="leaf-01",interface="E1/1"} 1524123456  # 2 minutes later
```

**Using Counters:**
- Raw counter values aren't directly useful (just big numbers)
- Use `rate()` function to calculate per-second rates
- Example: `rate(fabric_agent_interface_out_octets[5m])` = bytes per second over last 5 minutes

**Gauges (Point-in-Time Values)**

- **Definition**: Values that can go up or down
- **Fluctuate**: Represent current state at moment of scrape
- **Examples**:
  - CPU percentage (0-100%)
  - Interface operational state (up=1, down=0)
  - BGP neighbor count (can increase or decrease)
  - Temperature in Celsius (varies with load)

**Gauge Example:**
```
fabric_agent_interface_in_utilization{hostname="leaf-01",interface="E1/1"} 12.5
fabric_agent_interface_in_utilization{hostname="leaf-01",interface="E1/1"} 45.2  # 2 minutes later (traffic burst)
fabric_agent_interface_in_utilization{hostname="leaf-01",interface="E1/1"} 18.7  # 2 minutes later (normalized)
```

**Using Gauges:**
- Values are directly meaningful
- Can use directly in dashboards
- Can set alerts on thresholds (e.g., CPU > 80%)

**Why This Matters:**

Choosing the right PromQL function depends on metric type:
- `rate()` or `irate()` for counters (calculate change rate)
- Direct value or `avg()` for gauges
- Using `rate()` on a gauge or treating a counter like a gauge produces incorrect results

### Introduction to PromQL

PromQL is the query language for Prometheus, similar to SQL for databases. It enables powerful filtering, aggregation, and calculation capabilities.

**Basic Query Patterns:**

**1. Select a metric:**
```promql
# Get interface utilization for all switches
fabric_agent_interface_in_utilization
```

**2. Filter by labels:**
```promql
# Get interface utilization for specific switch
fabric_agent_interface_in_utilization{hostname="leaf-01"}

# Get interface bytes for specific interface
fabric_agent_interface_out_octets{hostname="leaf-01", interface="E1/1"}
```

**3. Calculate rates (for counters):**
```promql
# Bytes per second transmitted over last 5 minutes
rate(fabric_agent_interface_out_octets{hostname="leaf-01", interface="E1/1"}[5m])
```

**4. Aggregate across labels:**
```promql
# Total bytes per second across all interfaces on leaf-01
sum(rate(fabric_agent_interface_out_octets{hostname="leaf-01"}[5m]))

# Average interface utilization across all switches
avg(fabric_agent_interface_in_utilization)

# Count of established BGP sessions
count(fabric_agent_bgp_neighbor_session_state == 6)
```

**5. Arithmetic operations:**
```promql
# Convert bytes/sec to bits/sec
rate(fabric_agent_interface_out_octets[5m]) * 8

# Calculate percentage
(memory_used / memory_total) * 100
```

**Common Functions:**

- `rate()`: Per-second average rate over time range
- `irate()`: Instant rate (last 2 data points)
- `sum()`: Add values across dimensions
- `avg()`: Average values
- `max()` / `min()`: Maximum/minimum values
- `count()`: Count number of time series

**Time Ranges:**

- `[5m]`: Last 5 minutes
- `[1h]`: Last 1 hour
- `[24h]`: Last 24 hours

**Example Queries:**

```promql
# BGP neighbors that are not established (down or transitioning)
fabric_agent_bgp_neighbor_session_state != 6

# Interface outbound byte rate
rate(fabric_agent_interface_out_octets{hostname="leaf-01"}[5m])

# Interfaces with high utilization
fabric_agent_interface_in_utilization > 80

# Count all BGP sessions in fabric
count(fabric_agent_bgp_neighbor_session_state)
```

**Pro Tip:** Start simple, add complexity incrementally. Test in Prometheus UI before using in Grafana dashboards.

### Data Retention and Aggregation

**How Long Are Metrics Stored?**

Prometheus stores all metrics for **15 days by default** in your environment. After 15 days, data is automatically deleted to manage disk space.

**Why 15 Days?**

- Sufficient for troubleshooting recent issues
- Balances storage cost with usefulness
- Captures weekly patterns (7 days × 2)
- Allows historical comparison

**What Happens After 15 Days?**

- Metrics are deleted (no long-term storage by default)
- For long-term retention, use Mimir (Prometheus long-term storage)
- Grafana dashboards will show "No Data" for queries beyond retention

**Scrape Interval: 120 seconds (2 minutes)**

- Alloy scrapes metrics every 2 minutes
- This is the resolution of your data
- You cannot see changes faster than 2 minutes
- Reduces switch CPU load compared to 1-second scraping

**Data Resolution Trade-offs:**

- **Faster scraping (e.g., 30 sec)**: Higher resolution, more disk space, more switch CPU
- **Slower scraping (e.g., 5 min)**: Lower resolution, less disk space, less switch CPU
- **Hedgehog default (2 min)**: Balanced for typical network monitoring

**Storage Calculations:**

Approximate storage per switch:
- ~100 metrics per switch
- 120-second interval = 30 samples per hour
- 30 samples × 24 hours × 15 days = 10,800 samples per metric
- Total: ~1 million data points per switch (minimal disk usage)

**Querying Across Time:**

```promql
# Last 5 minutes (always available)
rate(fabric_agent_interface_out_octets[5m])

# Last 7 days (within retention)
rate(fabric_agent_interface_out_octets[7d])

# Last 30 days (ERROR - exceeds retention)
rate(fabric_agent_interface_out_octets[30d])  # Returns no data
```

**Best Practice:** For long-term capacity planning, export Grafana dashboard snapshots monthly or configure Mimir for extended retention.

## Troubleshooting

### No Metrics Appearing in Prometheus

**Symptom:** Prometheus shows no switch metrics or "No Data" on queries

**Cause:** Alloy agents not configured or fabric-proxy not running

**Fix:**

1. **Verify Alloy configuration:**
   ```bash
   kubectl get fabricator -n fab -o yaml | grep -A 20 defaultAlloyConfig
   ```

   If `defaultAlloyConfig: {}`, telemetry is disabled. See Hedgehog documentation for enabling Alloy.

2. **Check fabric-proxy status:**
   ```bash
   kubectl get svc -n fab fabric-proxy
   kubectl get pods -n fab | grep fabric-proxy
   ```

3. **Verify Prometheus is running:**
   ```bash
   curl http://localhost:9090/-/healthy
   ```

### Metrics Missing for Specific Switch

**Symptom:** Metrics appear for some switches but not others

**Cause:** Alloy agent on specific switch stopped or not running

**Fix:**

1. **Check Prometheus targets:**
   - Navigate to http://YOUR_VM_IP:9090/targets
   - Look for down targets

2. **SSH to affected switch and check Alloy:**
   ```bash
   hhfab vlab ssh leaf-01
   systemctl status alloy
   ```

3. **Restart Alloy if needed:**
   ```bash
   systemctl restart alloy
   ```

### PromQL Query Syntax Errors

**Symptom:** "parse error" or "bad_data" when running queries

**Cause:** Incorrect PromQL syntax

**Common Mistakes:**

1. **Using rate() on gauges:**
   ```promql
   # WRONG - rate() requires a counter, not a gauge
   rate(fabric_agent_interface_in_utilization[5m])

   # CORRECT - gauges are used directly
   fabric_agent_interface_in_utilization
   ```

2. **Forgetting time range with rate():**
   ```promql
   # WRONG
   rate(fabric_agent_interface_out_octets)

   # CORRECT
   rate(fabric_agent_interface_out_octets[5m])
   ```

3. **Invalid label syntax:**
   ```promql
   # WRONG
   fabric_agent_interface_out_octets{hostname=leaf-01}

   # CORRECT
   fabric_agent_interface_out_octets{hostname="leaf-01"}
   ```

### Retention Window Exceeded

**Symptom:** Query returns no data for time periods older than 15 days

**Cause:** Default retention is 15 days

**Solution:**

- For recent troubleshooting: Use data within 15-day window
- For long-term analysis: Configure Mimir or Grafana Cloud for extended retention
- For incident documentation: Export Grafana dashboard snapshots to PDF

## Resources

### Prometheus Documentation

- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [PromQL Functions](https://prometheus.io/docs/prometheus/latest/querying/functions/)
- [Prometheus Query Examples](https://prometheus.io/docs/prometheus/latest/querying/examples/)

### Hedgehog Documentation

- Hedgehog Observability Guide (see OBSERVABILITY.md in research folder)
- Hedgehog Fabric Controller Documentation
- Grafana Dashboard Guide

### Related Modules

- Previous: [Module 2.4: Decommission & Cleanup](../course-2-provisioning/module-2.4-decommission-cleanup.md)
- Next: Module 3.2: Dashboard Interpretation (coming soon)
- Pathway: Network Like a Hyperscaler

### PromQL Cheat Sheet

**Basic Selectors:**
```promql
metric_name                          # All time series for this metric
metric_name{label="value"}          # Filter by exact label match
metric_name{label=~"regex"}         # Filter by regex match
metric_name{label!="value"}         # Exclude label value
```

**Time Ranges:**
```promql
metric_name[5m]    # Last 5 minutes
metric_name[1h]    # Last 1 hour
metric_name[1d]    # Last 1 day
```

**Rate Functions:**
```promql
rate(counter[5m])      # Average rate over 5 min
irate(counter[5m])     # Instant rate (last 2 points)
```

**Aggregation:**
```promql
sum(metric)                        # Sum across all labels
avg(metric)                        # Average
max(metric) / min(metric)          # Maximum / Minimum
count(metric)                      # Count time series
sum by (hostname) (metric)           # Sum per switch
avg by (hostname,interface) (metric) # Average per switch+interface
```

**Arithmetic:**
```promql
metric * 8             # Multiply (e.g., bytes to bits)
metric / 1000000       # Divide (e.g., to megabytes)
metric_a + metric_b    # Add metrics
```

**Comparison:**
```promql
metric > 100           # Greater than
metric < 50            # Less than
metric == 1            # Equals (exact)
```

---

**Module Complete!** You've learned the fundamentals of fabric telemetry and Prometheus. Ready to interpret Grafana dashboards in Module 3.2.
