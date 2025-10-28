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

## Scenario: Exploring Fabric Telemetry

You've been operating Hedgehog Fabric for several weeks. VPCs are provisioned, servers are attached, and traffic is flowing. Now you want to understand the telemetry system that monitors your fabric. In this hands-on exploration, you'll access Prometheus directly and run queries to see the raw metrics that power your observability stack.

**Environment Access:**
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 (we'll use in Module 3.2)
- **kubectl:** Already configured

### Task 1: Access Prometheus UI

**Objective:** Navigate to Prometheus and understand the interface

1. **Open Prometheus in your browser:**
   - Navigate to http://localhost:9090
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

**Success Criteria:**
- ✅ Prometheus UI loads successfully
- ✅ Targets page shows fabric-related endpoints
- ✅ All targets show state = UP

### Task 2: Query Switch Metrics

**Objective:** Run basic PromQL queries to explore switch metrics

1. **Query CPU usage for all switches:**

   In the Prometheus query box, enter:
   ```promql
   cpu_usage_percent
   ```

   Click **Execute**

   **Expected result:** List of switches with CPU percentages:
   ```
   cpu_usage_percent{switch="leaf-01"} 18.5
   cpu_usage_percent{switch="leaf-02"} 22.3
   cpu_usage_percent{switch="spine-01"} 12.1
   ...
   ```

   Click **Graph** tab to see time series visualization

2. **Query CPU for a specific switch:**
   ```promql
   cpu_usage_percent{switch="leaf-01"}
   ```

   **Expected result:** Single time series for leaf-01

3. **Query interface byte counters:**
   ```promql
   interface_bytes_out{switch="leaf-01"}
   ```

   **Expected result:** Counter values for all interfaces on leaf-01:
   ```
   interface_bytes_out{switch="leaf-01",interface="Ethernet1"} 152345678901
   interface_bytes_out{switch="leaf-01",interface="Ethernet2"} 98234567890
   ...
   ```

   **Note:** These are counters (large numbers that keep increasing)

4. **Calculate bandwidth utilization:**
   ```promql
   rate(interface_bytes_out{switch="leaf-01",interface="Ethernet1"}[5m]) * 8
   ```

   **Expected result:** Bits per second over last 5 minutes:
   ```
   {switch="leaf-01",interface="Ethernet1"} 125600000  # ~125 Mbps
   ```

   **Explanation:**
   - `rate([5m])` calculates bytes/sec over 5 minutes
   - `* 8` converts bytes to bits
   - Result is bandwidth in bits per second

**Success Criteria:**
- ✅ CPU metrics display for all switches
- ✅ Interface counters visible
- ✅ Bandwidth calculation returns reasonable values

### Task 3: Explore BGP Metrics

**Objective:** Query BGP neighbor status to verify fabric underlay

1. **Query all BGP neighbors:**
   ```promql
   bgp_neighbor_state
   ```

   **Expected result:** BGP neighbors with state labels:
   ```
   bgp_neighbor_state{switch="leaf-01",neighbor="172.30.128.1",state="established"} 1
   bgp_neighbor_state{switch="leaf-01",neighbor="172.30.128.2",state="established"} 1
   ...
   ```

2. **Filter for non-established neighbors (find problems):**
   ```promql
   bgp_neighbor_state{state!="established"}
   ```

   **Expected result:** Empty (all neighbors healthy) or list of down neighbors

3. **Count total BGP sessions:**
   ```promql
   count(bgp_neighbor_state)
   ```

   **Expected result:** Total number of BGP sessions in fabric (e.g., 40)

4. **Count established BGP sessions:**
   ```promql
   count(bgp_neighbor_state{state="established"})
   ```

   **Expected result:** Should match total (if fabric is healthy)

**Success Criteria:**
- ✅ BGP metrics visible
- ✅ All (or most) neighbors show state="established"
- ✅ Count queries return expected numbers

### Task 4: Understand Metric Labels

**Objective:** Learn how labels identify specific metrics

1. **Query metrics with multiple labels:**
   ```promql
   interface_bytes_out{switch="leaf-01",interface="Ethernet1"}
   ```

   **Observe labels:**
   - `switch="leaf-01"` - Which switch
   - `interface="Ethernet1"` - Which interface

2. **Query with partial label matching:**
   ```promql
   interface_bytes_out{switch=~"leaf-.*"}
   ```

   **Explanation:** `=~` means "matches regex", `leaf-.*` matches all leaf switches

3. **List all unique switches in metrics:**
   ```promql
   count by (switch) (cpu_usage_percent)
   ```

   **Expected result:** One entry per switch

**Key Insight:** Labels allow you to filter and aggregate metrics. Every metric has labels like `switch`, `interface`, `neighbor`, etc.

**Success Criteria:**
- ✅ Understand how labels filter metrics
- ✅ Can query specific switch or interface
- ✅ See how regex matching works

### Lab Summary

**What you accomplished:**
- ✅ Accessed Prometheus UI and verified scrape targets
- ✅ Queried switch CPU and interface metrics
- ✅ Examined BGP neighbor status
- ✅ Calculated bandwidth utilization using PromQL
- ✅ Understood metric labels and filtering

**What you learned:**
- Prometheus provides raw metric access for your fabric
- PromQL enables powerful filtering and calculations
- Labels identify specific metrics (switch, interface, neighbor)
- Counters require `rate()` function for meaningful data
- BGP metrics help verify fabric underlay health

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
- Web UI: http://localhost:3000

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
interface_bytes_out{switch="leaf-01",interface="Ethernet1"} 1523456789
interface_bytes_out{switch="leaf-01",interface="Ethernet1"} 1523789012  # 2 minutes later
interface_bytes_out{switch="leaf-01",interface="Ethernet1"} 1524123456  # 2 minutes later
```

**Using Counters:**
- Raw counter values aren't directly useful (just big numbers)
- Use `rate()` function to calculate per-second rates
- Example: `rate(interface_bytes_out[5m])` = bytes per second over last 5 minutes

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
cpu_usage_percent{switch="leaf-01"} 23.5
cpu_usage_percent{switch="leaf-01"} 45.2  # 2 minutes later (CPU spike)
cpu_usage_percent{switch="leaf-01"} 18.7  # 2 minutes later (CPU normalized)
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
# Get CPU usage for all switches
cpu_usage_percent
```

**2. Filter by labels:**
```promql
# Get CPU usage for specific switch
cpu_usage_percent{switch="leaf-01"}

# Get interface bytes for specific interface
interface_bytes_out{switch="leaf-01", interface="Ethernet1"}
```

**3. Calculate rates (for counters):**
```promql
# Bytes per second transmitted over last 5 minutes
rate(interface_bytes_out{switch="leaf-01", interface="Ethernet1"}[5m])
```

**4. Aggregate across labels:**
```promql
# Total bytes per second across all interfaces on leaf-01
sum(rate(interface_bytes_out{switch="leaf-01"}[5m]))

# Average CPU across all switches
avg(cpu_usage_percent)

# Maximum temperature across all sensors
max(temperature_celsius)
```

**5. Arithmetic operations:**
```promql
# Convert bytes/sec to bits/sec
rate(interface_bytes_out[5m]) * 8

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
# BGP neighbors that are down
bgp_neighbor_state{state!="established"}

# Interface error rate
rate(interface_errors_in[5m])

# Switches with high CPU
cpu_usage_percent > 80

# Total VPCs in fabric
count(kube_vpc_info)
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
rate(interface_bytes_out[5m])

# Last 7 days (within retention)
rate(interface_bytes_out[7d])

# Last 30 days (ERROR - exceeds retention)
rate(interface_bytes_out[30d])  # Returns no data
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
   - Navigate to http://localhost:9090/targets
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
   # WRONG
   rate(cpu_usage_percent[5m])

   # CORRECT
   cpu_usage_percent
   ```

2. **Forgetting time range with rate():**
   ```promql
   # WRONG
   rate(interface_bytes_out)

   # CORRECT
   rate(interface_bytes_out[5m])
   ```

3. **Invalid label syntax:**
   ```promql
   # WRONG
   interface_bytes_out{switch=leaf-01}

   # CORRECT
   interface_bytes_out{switch="leaf-01"}
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
sum by (switch) (metric)           # Sum per switch
avg by (switch,interface) (metric) # Average per switch+interface
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
