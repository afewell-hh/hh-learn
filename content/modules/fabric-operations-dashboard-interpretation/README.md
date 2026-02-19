---
title: "Dashboard Interpretation"
slug: "fabric-operations-dashboard-interpretation"
difficulty: "beginner"
estimated_minutes: 15
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - grafana
  - dashboards
  - observability
  - monitoring
description: "Master Grafana dashboards for fabric health checks. Learn to interpret BGP status, interface errors, hardware metrics, and ASIC resources daily."
order: 302
---

# Dashboard Interpretation

## Introduction

In Module 3.1, you learned how telemetry flows from switches to Prometheus. You ran PromQL queries to see raw metrics—CPU percentages, bandwidth rates, BGP neighbor states. You accessed Prometheus directly and explored the metrics that power your observability stack.

But in daily operations, you won't be writing PromQL queries every time you want to check fabric health. That's where **Grafana dashboards** come in—pre-built visualizations that answer common operational questions at a glance.

**The Morning Question:**

Every morning, a fabric operator asks:
- **Is my fabric healthy?**
- **Are all BGP sessions up?**
- **Are there any interface errors?**
- **Is any switch running hot or out of resources?**

Grafana dashboards answer these questions in seconds without writing queries.

**What You'll Learn:**

Hedgehog provides **6 pre-built Grafana dashboards**:
1. **Hedgehog Fabric** - BGP underlay health
2. **Hedgehog Switch Interface Counters** - Interface state and traffic
3. **Hedgehog Fabric Platform Stats** - Hardware health (PSU, fans, temperature)
4. **Hedgehog Fabric Logs** - Switch logs and error filtering
5. **Hedgehog mod of Node Exporter Full** - Linux system metrics
6. **Hedgehog Switch Critical Resources** - ASIC resource limits

You'll learn to **read** each dashboard (not build them), identify healthy vs unhealthy states, and create a morning health check workflow that takes less than 5 minutes.

**Context: Proactive vs Reactive Monitoring**

- **Reactive**: Wait for alerts or user reports, then investigate
- **Proactive**: Check dashboards daily, spot trends before they become problems

This module teaches proactive monitoring—catching issues early, building operational confidence, and maintaining fabric health systematically.

## Learning Objectives

By the end of this module, you will be able to:

1. **Interpret Fabric Dashboard** - Read VPC count, VNI allocation, and BGP session status
2. **Interpret Interfaces Dashboard** - Understand interface state, VLAN config, traffic rates, and errors
3. **Interpret Platform Dashboard** - Read switch resource usage (CPU, memory, disk, temperature)
4. **Interpret Logs Dashboard** - Filter and search switch logs for errors and events
5. **Interpret Node Exporter Dashboard** - Understand detailed Linux system metrics
6. **Interpret Switch Critical Resources Dashboard** - Identify ASIC resource exhaustion risks
7. **Create morning health check workflow** - Use dashboards systematically for daily monitoring

## Prerequisites

- Module 3.1 completion (Fabric Telemetry Overview)
- Understanding of Prometheus metrics and PromQL
- Familiarity with metric types (counters, gauges)
- Basic Grafana navigation (from Module 1.3)

> **Before You Begin the Lab**
>
> The hands-on exercises in this module require the **Hedgehog Virtual AI Data Center (vAIDC)** — a pre-configured GCP lab environment that includes a complete Hedgehog fabric, Grafana observability dashboards, and all required services ready to use.
>
> **Ensure your vAIDC is running before proceeding.** If you haven't set it up yet, complete the [Accessing the Hedgehog vAIDC](https://hedgehog.cloud/learn/courses/accessing-the-hedgehog-vaidc) module first — it takes about 20 minutes and only needs to be done once.

## Scenario: Morning Health Check Using Grafana Dashboards

It's Monday morning, and you're the on-call fabric operator. Your first task: verify the fabric is healthy before the business day begins. You'll use Grafana dashboards to perform a systematic health check in under 5 minutes.

**Environment Access:**
- **Grafana:** http://YOUR_VM_IP:3000 (username: `admin`, password: `admin`)

### Task 1: Check BGP Fabric Health (2 minutes)

**Objective:** Verify all BGP sessions are established

**Steps:**

1. **Open Grafana:**
   - Navigate to http://YOUR_VM_IP:3000
   - Sign in (admin / admin)

2. **Access Fabric Dashboard:**
   - Click **Dashboards** (left sidebar)
   - Select **"Hedgehog Fabric"** dashboard

3. **Check BGP Session State Panel:**
   - Locate the **"BGP Session State"** status-history panel (in the "BGP Neighbor State" section)
   - Each cell represents a switch+neighbor pair over time
   - **Expected healthy state:** All cells show green (Established)
   - ✅ If all cells are green, all BGP sessions are established
   - ❌ If any cells are red or non-green, identify which switch/neighbor has an issue

   > **Note:** The status-history visualization shows state changes over time. A solid green row means a session has been consistently established. There are 62 BGP sessions in a healthy 7-switch fabric.

4. **Review BGP Neighbor Configuration Panel:**
   - Locate the **"BGP Neighbor"** status-history panel
   - Shows whether BGP neighbor configurations are applied correctly
   - **Expected healthy state:** All entries show applied/configured state (green)
   - **Red flag:** Any entries showing an error state

5. **Check BGP Dropped Connections:**
   - Find the **"BGP Dropped connections"** time series panel (under the "BGP Neighbors Stats" section)
   - Set time range to "Last 24 hours"
   - **Healthy:** Flat line near zero (no dropped connections)
   - **Unhealthy:** Spikes indicate sessions dropping and reconnecting

**Success Criteria:**
- ✅ All BGP sessions established
- ✅ No flaps in last 24 hours
- ✅ Prefix counts stable

**If Unhealthy:**
- Note which switch and neighbor has issue
- Check Logs Dashboard for BGP-related errors
- Proceed to Module 3.3 for event correlation techniques

### Task 2: Check Interface Health (1-2 minutes)

**Objective:** Verify all expected interfaces are up and error-free

**Steps:**

1. **Access Interfaces Dashboard:**
   - Click **Dashboards** → **"Hedgehog Switch Interface Counters"**
   - At the top of the dashboard, use the variable dropdowns to select a **node** (e.g., leaf-01) and an **interface** (e.g., E1/1)

2. **Check Interface State:**
   - Locate the **"$interface"** state-timeline panel (under the "Interface status" section)
   - **Healthy:** Solid green bar — interface has been continuously up
   - **Unhealthy:** Any gaps or red areas — interface went down during that period
   - Repeat for each key interface (server ports, spine uplinks)

3. **Check Error Counters:**
   - Find the **"Errors and discards"** time series panel (under "Interface stats")
   - **Healthy:** Flat line near zero
   - **Unhealthy:** Rising values indicate cable or signal problems

   **Common error causes:**
   ```
   Growing CRC errors → Bad cable or dirty fiber
   Growing discards   → Congestion (packet drops)
   ```

4. **Check Interface Utilization:**
   - Locate the **"Interface Utilization"** time series panel
   - **Healthy:** < 70%
   - **Warning:** 70-90%
   - **Critical:** > 90%
   - **Action:** If > 90%, note for capacity planning

**Success Criteria:**
- ✅ Key interfaces show solid green state-timeline
- ✅ No growing error counters
- ✅ Utilization < 90%

### Task 3: Check Hardware Health (1 minute)

**Objective:** Verify switches are not experiencing hardware issues

**Steps:**

1. **Access Platform Dashboard:**
   - Click **Dashboards** → **"Hedgehog Fabric Platform Stats"**
   - Select a **node** from the variable dropdown to inspect a specific switch

2. **Check CPU and ASIC Temperatures:**
   - Locate the **"CPU Temperature"** and **"Switch ASIC Temperature"** stat panels (under "Chip Temperatures")
   - **Healthy thresholds:**
     - CPU < 70°C
     - ASIC < 80°C
   - **Unhealthy:** Approaching or exceeding threshold → Investigate cooling

3. **Check Fan Speed:**
   - Find the **"Fan Tray Speed"** stat panel (under "FRU Temp and RPM")
   - **Healthy:** All fans reporting > 0 RPM (e.g., > 3000 RPM)
   - **Unhealthy:** Fan = 0 RPM → Thermal risk

4. **Check Air Temperatures:**
   - Locate **"Front Fan Air Temp"** and **"PSU Air Temp"** gauge panels
   - **Healthy:** Ambient < 45°C
   - **Unhealthy:** High ambient temperatures → Investigate data center HVAC

**Success Criteria:**
- ✅ CPU and ASIC temperatures within limits
- ✅ Fan tray speed > 0 RPM
- ✅ Ambient temperatures < 45°C

### Task 4: Check for Recent Errors (1 minute)

**Objective:** Identify any error logs in last 1 hour

**Steps:**

1. **Access Logs Dashboard:**
   - Click **Dashboards** → **"Hedgehog Fabric Logs"**
   - Select a **node** from the variable dropdown to see logs for a specific switch

2. **Check Syslog Errors:**
   - Locate the **"Errors - $node"** log panel (under the "Syslog" section)
   - Set time range: "Last 1 hour"
   - **Healthy:** Empty or very few entries
   - **Unhealthy:** Many error messages → Investigate

3. **Review BGP Log Entries:**
   - Find the **"BGP Logs - $node"** panel
   - Review for unexpected BGP state changes or error messages
   - **Healthy:** No unexpected state changes
   - **Unhealthy:** Repeated connection refused or neighbor down messages

   **Example error to investigate:**
   ```
   [leaf-02] ERROR: Interface E1/5 link down
   [spine-01] ERROR: BGP neighbor 172.30.128.5 connection refused
   ```

4. **Check Full Log (if needed):**
   - Under "Full log" section, use the **"Full Output for $file on $node"** panel
   - Select a specific log file from the `$file` dropdown for detailed review

**Success Criteria:**
- ✅ Errors panel shows no unexpected errors
- ✅ BGP Logs panel shows no connection failures

### Task 5: Optional - Check ASIC Resources (1 minute)

**Objective:** Verify no ASIC resources nearing capacity

**Steps:**

1. **Access Switch Critical Resources Dashboard:**
   - Click **Dashboards** → **"Hedgehog Switch Critical Resources"**
   - Select a **node** (switch) from the variable dropdown

2. **Scan IPv4 Resource Utilization:**
   - Under "IPv4 Resource Usage", review gauge panels:
     - **"$node Routes Available"** — IPv4 routing table capacity
     - **"$node Nexthops"** — ECMP nexthop table capacity
     - **"$node Neighbors Available"** — ARP/neighbor table capacity
   - **Healthy:** Gauges show significant available capacity
   - **Warning:** Any gauge approaching full
   - **Critical:** Any resource nearing maximum

3. **Check ACL and Misc Resources:**
   - Expand the **"ACL Resources Available"** and **"Misc Critical Resources"** rows
   - Verify no resources are near capacity

4. **Note Resources for Capacity Planning:**
   - If any resource > 70% used, document for future planning
   - ASIC resources are hardware limits and cannot be increased

**Success Criteria:**
- ✅ All ASIC resources show healthy available capacity

### Lab Summary

**What you accomplished:**

You performed a complete fabric health check using 5 Grafana dashboards in under 5 minutes:
- ✅ Verified BGP underlay health (Fabric Dashboard)
- ✅ Checked interface state and errors (Interfaces Dashboard)
- ✅ Confirmed hardware health (Platform Dashboard)
- ✅ Scanned for recent error logs (Logs Dashboard)
- ✅ Reviewed ASIC resource usage (Critical Resources Dashboard)

**What you learned:**

- Morning health check takes < 5 minutes with dashboards
- Each dashboard answers specific operational questions
- "Healthy" has clear, measurable criteria
- Dashboards enable proactive monitoring (catch issues before alerts)
- Systematic workflows prevent overlooking critical issues

**Morning Health Check Checklist:**

```
Daily Fabric Health Check (5 minutes)
────────────────────────────────────
☐ BGP sessions all established (Fabric Dashboard)
☐ No BGP flaps in last 24h
☐ Interfaces up and error-free (Interfaces Dashboard)
☐ PSUs operational, fans running (Platform Dashboard)
☐ Temperatures within limits
☐ ERROR log count near zero (Logs Dashboard)
☐ ASIC resources < 90% (Critical Resources Dashboard)
```

## Concepts & Deep Dive

Now that you've performed a morning health check hands-on, let's explore each dashboard in detail. Understanding what each panel shows and what "healthy" looks like will deepen your operational mastery.

### Concept 1: Fabric Dashboard - BGP Underlay Health

**Purpose:** Monitor the BGP fabric underlay that connects all switches

The Fabric Dashboard is your primary tool for verifying that the BGP underlay—the foundation of your fabric—is stable and routing correctly. Without healthy BGP sessions, VPCs cannot communicate across switches.

**Key Panels:**

**1. BGP Session State** (status-history)

- **Metric:** BGP session state per switch+neighbor pair over time
- **Healthy State:** All cells green (Established, state=6)
- **Unhealthy State:** Red or non-green cells indicate non-established sessions
- **Interpretation:** Each row is a switch+neighbor pair; color coding shows state over time. A solid green row = consistently established.

**2. BGP Neighbor** (status-history)

- **Metric:** BGP neighbor configuration status
- **Healthy State:** All entries show applied/configured (green)
- **Unhealthy State:** Any entries in error state

**3. BGP Dropped Connections** (time series)

- **Metric:** Count of dropped BGP connections per neighbor over time
- **Healthy State:** Flat line near zero (no drops)
- **Unhealthy State:** Spikes indicate session instability (investigate physical layer or BGP config)

**4. BGP Prefixes** (time series)

- **Metric:** Number of routes exchanged per neighbor
- **Healthy State:** Consistent count (e.g., 10-20 prefixes per neighbor)
- **Unhealthy State:** Sudden drop to 0 (neighbor lost routes)

**Dashboard Actions:**

- **Daily Health Check:** Verify BGP Sessions count matches expected (e.g., 62)
- **Troubleshooting:** Identify which switch/neighbor has session down
- **Trend Analysis:** Check for flapping patterns over last 24 hours
- **Capacity Planning:** Monitor prefix counts as VPCs scale

**What "Healthy" Looks Like:**
- All sessions green/established
- Stable prefix counts
- No flaps in last 24 hours
- Uptime > last change window

**What "Unhealthy" Looks Like:**
- Any session not established
- Frequent session flaps (more than 1-2 per day)
- Prefix count = 0 for established sessions
- Sessions down for > 5 minutes

### Concept 2: Interfaces Dashboard - Traffic and Errors

**Purpose:** Monitor interface state, traffic rates, and error counters

The Interfaces Dashboard gives you visibility into the health of every network interface across your fabric. This is where you identify congestion, cable problems, and capacity issues.

**Key Panels:**

**1. $interface state-timeline** (under "Interface status")

- **Metric:** Interface operational state over time (up/down)
- **How to use:** Select node and interface from variable dropdowns at top
- **Healthy State:** Solid green bar (interface continuously up)
- **Unhealthy State:** Gaps or red areas (interface went down)
- **Example:**
  ```
  leaf-01 / E1/1: [████████████] green = continuously up
  leaf-01 / E1/5: [████░░░█████] gap at 10:15 = interface went down
  ```

**2. Bits per second rate** (time series, under "Interface stats")

- **Metric:** Bits per second in/out over time
- **Healthy State:** Consistent traffic matching workload
- **Unhealthy State:** Unexpected spikes or drops to zero
- **Example:**
  - Server interface: 2 Gbps steady (expected)
  - Server interface: sustained 10 Gbps (possible saturation)

**3. Interface Utilization** (time series)

- **Metric:** Percentage of link capacity used
- **Healthy State:** < 70% utilization (headroom available)
- **Warning State:** 70-90% (nearing capacity)
- **Critical State:** > 90% (congestion risk)
- **Example:**
  ```
  E1/1: 45% (healthy)
  E1/2: 85% (warning - consider upgrade)
  E1/3: 95% (critical - likely packet drops)
  ```

**4. Errors and discards** (time series)

- **Metric:** Error and discard counters per interface over time
- **Healthy State:** Flat line near zero
- **Unhealthy State:** Rising values indicate cable or signal problem

**Understanding Error Types:**

| Error Type | Cause | Action |
|------------|-------|--------|
| **CRC Errors** | Bad cable, dirty fiber, EMI | Replace cable/clean fiber |
| **Frame Errors** | Physical layer issues | Check cable, duplex settings |
| **Discards** | Congestion, buffer full | Check utilization, consider QoS |

**Example:**
```
Interface    CRC Errors   Frame Errors   Discards
E1/1         0            0              0          ← Healthy
E1/2         1,234        523            0          ← Cable problem
E1/3         0            0              52,341     ← Congestion (drops)
```

**Dashboard Actions:**

- **Daily Health Check:** Scan for red (down) interfaces or high error rates
- **Capacity Planning:** Identify interfaces consistently > 70% utilized
- **Troubleshooting:** Correlate traffic drop with VPC connectivity issues
- **Validation:** After VPCAttachment, verify VLAN appears on interface

**What "Healthy" Looks Like:**
- All expected interfaces up (green)
- Error counters flat (not increasing)
- Utilization < 70%
- Traffic patterns match workload expectations

**What "Unhealthy" Looks Like:**
- Expected interfaces down
- Growing error counters (cable degradation)
- Utilization > 90% (congestion risk)
- Traffic anomalies (unexpected spikes/drops)

### Concept 3: Platform Dashboard - Hardware Health

**Purpose:** Monitor switch hardware (PSU, fans, temperature, optics)

The Platform Dashboard provides visibility into the physical health of your switches. This is preventive maintenance—catching hardware failures before they cause outages.

**Key Panels:**

**1. CPU Temperature and Switch ASIC Temperature** (stat panels)

- **Metric:** Current temperature in Celsius
- **Healthy State:** CPU < 70°C, ASIC < 80°C
- **Unhealthy State:** Approaching or exceeding thresholds
- **Example:**
  ```
  CPU Temperature: 55°C (OK)
  Switch ASIC Temperature: 85°C (WARNING - check cooling)
  ```

**2. Fan Tray Speed** (stat)

- **Metric:** Fan RPM
- **Healthy State:** All fans reporting > 0 RPM (e.g., > 3000 RPM)
- **Unhealthy State:** Fan = 0 RPM (failed) → thermal risk
- **Example:**
  ```
  Fan Tray Speed: 5,200 RPM (OK)
  Fan Tray Speed: 0 RPM     (FAILED - thermal risk)
  ```

**3. Front Fan Air Temp and PSU Air Temp** (gauge panels)

- **Metric:** Air temperature at fan tray and PSU in Celsius
- **Healthy State:** Ambient < 45°C
- **Unhealthy State:** High ambient temperature → investigate data center HVAC
- **Example:**
  ```
  Front Fan Air Temp: 35°C (OK)
  PSU Air Temp: 48°C (WARNING - data center HVAC issue)
  ```

**Dashboard Actions:**

- **Daily Health Check:** Scan for stopped fans and high temperatures
- **Preventive Maintenance:** Act on fan failures before thermal damage
- **Capacity Planning:** Track temperature trends (data center cooling)
- **Node Variable:** Select each switch to check hardware per-switch

**What "Healthy" Looks Like:**
- CPU and ASIC temperatures below thresholds
- Fan tray speed > 0 RPM (fans running)
- Ambient air temperatures < 45°C

**What "Unhealthy" Looks Like:**
- Fan speed = 0 (fan failure, thermal risk)
- CPU/ASIC temperatures approaching limits
- High ambient temperatures (data center cooling issue)

### Concept 4: Logs Dashboard - Error Filtering

**Purpose:** Aggregate and search switch logs for troubleshooting

The Logs Dashboard gives you a centralized view of syslog messages from all switches. This is essential for troubleshooting—correlating metrics anomalies with log events.

**Key Panels:**

**1. Errors - $node** (log panel, under Syslog section)

- **Content:** Filtered syslog errors for the selected node
- **Use Case:** Check if a specific switch has error-level syslog messages
- **Example:**
  ```
  [leaf-02] Oct 17 10:15:45 ERROR: Interface E1/5 link down
  [leaf-02] Oct 17 10:16:02 ERROR: BGP neighbor 172.30.128.5 connection refused
  ```
- **Healthy State:** Empty or very few entries

**2. BGP Logs - $node** (log panel, under Syslog section)

- **Content:** BGP-related syslog messages for the selected node
- **Use Case:** Monitor BGP state changes and adjacency events
- **Healthy State:** No unexpected state changes or error messages

**3. Errors - $node / WARNINGS - $node** (log panels, under Agent section)

- **Content:** Fabric agent errors and warnings for the selected node
- **Use Case:** Identify agent-level issues (CRD reconciliation errors, etc.)

**4. Full Output for $file on $node** (log panel, under Full log section)

- **Content:** Complete log file output for selected file and node
- **Use Case:** Detailed investigation when errors are found above
- **Select:** Use the `$file` variable dropdown to choose a specific log file

**Dashboard Actions:**

- **Daily Health Check:** Select each node, check "Errors - $node" panel for syslog errors
- **Troubleshooting:** Use "BGP Logs - $node" to investigate BGP-related events
- **Incident Investigation:** Check error logs correlate with metrics anomalies
- **Node Variable:** Must select a node — logs are shown per-switch

**What "Healthy" Looks Like:**
- "Errors - $node" panel is empty or shows very few entries
- "BGP Logs - $node" shows no unexpected state changes
- Agent errors panel is empty

**What "Unhealthy" Looks Like:**
- Repeated error messages in "Errors - $node"
- BGP state changes or connection refused in "BGP Logs - $node"
- Many agent errors (indicates reconciliation problems)

### Concept 5: Node Exporter Dashboard - System Metrics

**Purpose:** Deep dive into Linux OS metrics (CPU, memory, disk, network I/O)

The Node Exporter Dashboard provides detailed visibility into the SONiC operating system running on each switch. This is useful for diagnosing performance issues or resource exhaustion.

**Key Panels:**

**1. CPU Utilization**

- **Metric:** Percentage breakdown (user, system, idle, iowait)
- **Healthy State:** < 70% total utilization, low iowait
- **Unhealthy State:** > 80% sustained, high iowait (disk bottleneck)
- **Example:**
  ```
  User: 25%
  System: 15%
  IOWait: 5%
  Idle: 55%
  Total: 45% (healthy)
  ```

**2. Load Average**

- **Metric:** 1-min, 5-min, 15-min load average
- **Healthy State:** Load < number of CPUs
- **Unhealthy State:** Load > CPUs (queued processes)
- **Example:**
  ```
  1-min: 2.5
  5-min: 2.2
  15-min: 1.8
  (Assuming 4 CPUs: healthy - load < 4)
  ```

**3. Memory Usage**

- **Metric:** Total, used, available, buffers/cache
- **Healthy State:** Available > 20% of total
- **Unhealthy State:** Available < 10% (memory pressure)
- **Example:**
  ```
  Total: 16 GB
  Used: 10 GB
  Available: 5 GB (31% - healthy)
  ```

**4. Disk Space**

- **Metric:** Used/available per filesystem
- **Healthy State:** < 80% used
- **Unhealthy State:** > 90% used (risk of full disk)
- **Example:**
  ```
  /: 45% used (OK)
  /var/log: 92% used (WARNING - rotate logs)
  ```

**5. Disk I/O**

- **Metric:** Read/write operations per second, throughput
- **Use Case:** Identify disk bottlenecks
- **Example:**
  ```
  Read: 150 IOPS, 25 MB/s
  Write: 300 IOPS, 50 MB/s
  ```

**6. Network Throughput (All Interfaces)**

- **Metric:** Total bytes in/out across all network interfaces
- **Use Case:** Overall switch traffic
- **Example:**
  ```
  In: 5 Gbps
  Out: 4.8 Gbps
  ```

**Dashboard Actions:**

- **Performance Troubleshooting:** Identify if switch CPU/memory is bottleneck
- **Capacity Planning:** Track resource usage trends over time
- **Disk Management:** Proactively clear logs before disk fills
- **Baseline Understanding:** Know "normal" resource usage for comparison

**What "Healthy" Looks Like:**
- CPU < 70%, low iowait
- Memory available > 20%
- Disk usage < 80%
- Load average < CPU count

**What "Unhealthy" Looks Like:**
- CPU sustained > 80%
- High iowait (disk bottleneck)
- Memory available < 10%
- Disk > 90% full

### Concept 6: Switch Critical Resources Dashboard - ASIC Limits

**Purpose:** Monitor programmable ASIC hardware table capacity (prevents resource exhaustion)

The Switch Critical Resources Dashboard is unique to network switches. Unlike CPU or memory, ASIC resources are **hardware limits that cannot be increased**. When an ASIC table fills, the switch cannot accept new entries, causing connectivity failures.

**Key Panels:**

**1. IPv4 Route Table**

- **Metric:** Routes used / routes available
- **Healthy State:** < 80% capacity
- **Critical State:** > 90% (risk of route installation failure)
- **Example:**
  ```
  leaf-01: 15,000 / 32,768 routes (46% - OK)
  spine-01: 28,000 / 32,768 routes (85% - WARNING)
  ```

**2. IPv4 Nexthop Table**

- **Metric:** Nexthops used / available
- **Use Case:** Tracks ECMP paths
- **Example:**
  ```
  Used: 2,048 / 4,096 (50% - OK)
  ```

**3. IPv4 Neighbor (ARP) Table**

- **Metric:** ARP entries used / available
- **Healthy State:** < 80% capacity
- **Risk:** Large subnets with many hosts can exhaust ARP table
- **Example:**
  ```
  Used: 8,192 / 16,384 (50% - OK)
  Used: 15,500 / 16,384 (95% - CRITICAL)
  ```

**4. FDB (Forwarding Database) Capacity**

- **Metric:** MAC addresses learned / capacity
- **Use Case:** Layer 2 forwarding table
- **Example:**
  ```
  Used: 12,000 / 32,768 MACs (37% - OK)
  ```

**5. ACL Table Usage**

- **Metric:** ACL entries used / available
- **Use Case:** Security rules, permit lists
- **Example:**
  ```
  Used: 512 / 2,048 (25% - OK)
  ```

**6. IPMC (IP Multicast) Table**

- **Metric:** Multicast entries used / available
- **Use Case:** Multicast routing (if enabled)

**Critical Concept: Hardware Limits**

Unlike CPU or memory, ASIC resources are **fixed at manufacture**:
- Cannot be upgraded
- Cannot be expanded
- Exhaustion causes hard failures (not performance degradation)

**When ASIC tables fill:**
- New routes rejected (connectivity lost)
- New ARP entries fail (hosts unreachable)
- ACL rules not applied (security gaps)

**Dashboard Actions:**

- **Daily Health Check:** Verify no resource > 90% used
- **Capacity Planning:** Identify resources trending toward limits
- **Scale Planning:** If ARP table nearing limit, consider subnet redesign
- **Alert Thresholds:** Set alerts at 80% capacity

**What "Healthy" Looks Like:**
- All resources < 80% capacity
- Stable usage (not rapidly growing)
- Headroom for growth

**What "Unhealthy" Looks Like:**
- Any resource > 90% (immediate risk)
- Rapidly growing usage (trend toward exhaustion)
- No mitigation plan for full tables

## Troubleshooting

### Issue 1: Dashboard Shows "No Data"

**Symptom:** Panels empty or showing "No Data"

**Possible Causes:**
- Prometheus not receiving metrics
- Time range issue
- Data source misconfigured

**Fix:**

1. **Check Prometheus targets:**
   - Navigate to http://YOUR_VM_IP:9090/targets
   - Verify fabric-proxy target is UP
   - Check last scrape time

2. **Adjust time range:**
   - Click time range picker (top right)
   - Try "Last 5 minutes" or "Last 1 hour"
   - Ensure time range is within data retention (15 days)

3. **Verify data source:**
   - Grafana → Configuration → Data Sources
   - Ensure Prometheus is default and URL is correct

### Issue 2: Can't Find Specific Dashboard

**Symptom:** Dashboard not appearing in list

**Possible Causes:**
- Dashboard not imported
- Search term incorrect
- Dashboard in different folder

**Fix:**

1. **Search by name:**
   - Use search box in Dashboards menu
   - Try partial names: "Fabric", "Interfaces", "Platform"

2. **Check dashboard list:**
   - Dashboards → Browse
   - Look in all folders

3. **Import if missing:**
   - Dashboards → Import
   - Upload JSON from `/docs/user-guide/boards/` directory

### Issue 3: Unsure if Metric Value is "Healthy"

**Symptom:** Panel shows value but unclear if it's good/bad

**Cause:** Missing context about healthy ranges

**Fix:**

Reference the healthy/unhealthy criteria in this module:

| Dashboard | Metric | Healthy | Unhealthy |
|-----------|--------|---------|-----------|
| **BGP** | Sessions down | 0 | > 0 |
| **Interfaces** | Utilization | < 70% | > 90% |
| **Platform** | CPU temp | < 70°C | > 80°C |
| **Platform** | ASIC temp | < 80°C | > 90°C |
| **Platform** | Fan speed | > 3000 RPM | 0 RPM |
| **Logs** | ERROR count/hour | < 5 | > 10 |
| **ASIC Resources** | Capacity | < 80% | > 90% |

### Issue 4: Metric Interpretation Confusion

**Symptom:** Counter value very large (e.g., billions)

**Cause:** Viewing raw counter instead of rate

**Fix:**

1. **Check if panel uses rate():**
   - Click panel title → Edit
   - Check PromQL query
   - Should use `rate(metric[5m])` for counters

2. **Adjust panel query:**
   - For byte counters: `rate(fabric_agent_interface_out_octets[5m]) * 8` (converts to bps)
   - For packet counters: `rate(fabric_agent_interface_out_pkts[5m])`

3. **Reference Module 3.1:**
   - Review counter vs gauge concepts
   - Remember: counters always increase, use rate() to see change

## Resources

### Grafana Documentation

- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
- [Prometheus Data Source](https://grafana.com/docs/grafana/latest/datasources/prometheus/)
- [Time Series Visualizations](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/)

### Hedgehog Documentation

- Hedgehog Observability Guide (OBSERVABILITY.md in research folder)
- Hedgehog Fabric Controller Documentation
- Grafana Dashboard JSON files (`/docs/user-guide/boards/`)

### Related Modules

- Previous: [Module 3.1: Fabric Telemetry Overview](module-3.1-fabric-telemetry-overview.md)
- Next: Module 3.3: Events & Status Monitoring (coming soon)
- Pathway: Network Like a Hyperscaler

### Dashboard Quick Reference

**Dashboard Access:**
- URL: http://YOUR_VM_IP:3000
- Login: admin / admin
- Location: Dashboards → Browse

**6 Hedgehog Dashboards:**

1. **Hedgehog Fabric** - BGP underlay health
2. **Hedgehog Switch Interface Counters** - Interface state, traffic, errors
3. **Hedgehog Fabric Platform Stats** - PSU, fans, temperature, optics
4. **Hedgehog Fabric Logs** - Syslog aggregation and search
5. **Hedgehog mod of Node Exporter Full** - Linux system metrics (CPU, memory, disk)
6. **Hedgehog Switch Critical Resources** - ASIC resource capacity

**Common Time Ranges:**
- Last 5 minutes (real-time monitoring)
- Last 1 hour (health checks)
- Last 24 hours (daily trends)
- Last 7 days (weekly patterns)

---

**Module Complete!** You've learned to interpret Grafana dashboards for daily fabric health checks. Ready to correlate metrics with Kubernetes events in Module 3.3.
