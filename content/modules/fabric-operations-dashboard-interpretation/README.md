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
1. **Fabric Dashboard** - BGP underlay health
2. **Interfaces Dashboard** - Interface state and traffic
3. **Platform Dashboard** - Hardware health (PSU, fans, temperature)
4. **Logs Dashboard** - Switch logs and error filtering
5. **Node Exporter Dashboard** - Linux system metrics
6. **Switch Critical Resources Dashboard** - ASIC resource limits

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

## Scenario: Morning Health Check Using Grafana Dashboards

It's Monday morning, and you're the on-call fabric operator. Your first task: verify the fabric is healthy before the business day begins. You'll use Grafana dashboards to perform a systematic health check in under 5 minutes.

**Environment Access:**
- **Grafana:** http://localhost:3000 (username: `admin`, password: `prom-operator`)

### Task 1: Check BGP Fabric Health (2 minutes)

**Objective:** Verify all BGP sessions are established

**Steps:**

1. **Open Grafana:**
   - Navigate to http://localhost:3000
   - Sign in (admin / prom-operator)

2. **Access Fabric Dashboard:**
   - Click **Dashboards** (left sidebar)
   - Select **"Hedgehog Fabric"** dashboard

3. **Check BGP Sessions Overview Panel:**
   - Locate "BGP Sessions" panel (top of dashboard)
   - **Expected healthy state:**
     ```
     Total Sessions: 40
     Established: 40
     Down: 0
     ```
   - ✅ If Established = Total, fabric underlay is healthy
   - ❌ If Down > 0, identify which neighbor is down

4. **Review BGP Neighbor Table:**
   - Scroll to "BGP Neighbor Status" table
   - Scan "State" column - all should say "established"
   - Check "Prefixes Received" - should be > 0
   - **Red flag:** Any row with State ≠ "established"

   **Example healthy row:**
   ```
   Switch    Neighbor         State         Prefixes  Uptime
   leaf-01   172.30.128.1    established   12        3d 5h
   leaf-01   172.30.128.2    established   12        3d 5h
   ```

5. **Check for Session Flaps:**
   - Find "BGP Session Flaps" time series panel
   - Set time range to "Last 24 hours"
   - **Healthy:** Flat line (no state changes)
   - **Unhealthy:** Spikes indicate sessions going up/down

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
   - Click **Dashboards** → **"Hedgehog Interfaces"**

2. **Check Interface State Overview:**
   - Locate "Interface Operational State" panel
   - **Healthy:** Expected interfaces show green (Up)
   - **Unhealthy:** Expected interfaces show red (Down)
   - **Note:** Unused ports down = OK

3. **Check Error Counters:**
   - Find "Interface Errors" panel or table
   - **Healthy:** Error rate = 0 or flat line
   - **Unhealthy:** Growing error count (indicates problem)

   **Example of problem:**
   ```
   Interface    CRC Errors   Frame Errors   Discards
   Ethernet1    0            0              0          ← Healthy
   Ethernet5    1,234        523            0          ← Cable problem
   Ethernet7    0            0              52,341     ← Congestion (drops)
   ```

4. **Check Interface Utilization:**
   - Locate "Interface Utilization %" panel
   - **Healthy:** < 70%
   - **Warning:** 70-90%
   - **Critical:** > 90%
   - **Action:** If > 90%, note for capacity planning

**Success Criteria:**
- ✅ All expected interfaces up
- ✅ No growing error counters
- ✅ Utilization < 90%

### Task 3: Check Hardware Health (1 minute)

**Objective:** Verify switches are not experiencing hardware issues

**Steps:**

1. **Access Platform Dashboard:**
   - Click **Dashboards** → **"Hedgehog Platform"**

2. **Check PSU Status:**
   - Locate "PSU Status" panel
   - **Healthy:** All PSUs = OK
   - **Unhealthy:** Any PSU = Failed → Schedule replacement

3. **Check Fan Speeds:**
   - Find "Fan Speeds" panel
   - **Healthy:** All fans > 0 RPM (e.g., > 3000 RPM)
   - **Unhealthy:** Any fan = 0 RPM → Thermal risk

4. **Check Temperature:**
   - Locate "Temperature Sensors" panel
   - **Healthy thresholds:**
     - CPU < 70°C
     - ASIC < 80°C
     - Ambient < 45°C
   - **Unhealthy:** Any sensor exceeding threshold → Investigate cooling

**Success Criteria:**
- ✅ All PSUs operational
- ✅ All fans running
- ✅ Temperatures within limits

### Task 4: Check for Recent Errors (1 minute)

**Objective:** Identify any error logs in last 1 hour

**Steps:**

1. **Access Logs Dashboard:**
   - Click **Dashboards** → **"Hedgehog Logs"**

2. **Check Error Count:**
   - Locate "Log Level Breakdown" panel
   - Set time range: "Last 1 hour"
   - **Healthy:** ERROR count = 0 or very low (< 5)
   - **Unhealthy:** ERROR count > 10 → Investigate

3. **Review Error Logs (if present):**
   - If errors present, locate "Syslog Stream" panel
   - Filter by `level="error"`
   - Read error messages to identify issues

   **Example:**
   ```
   [leaf-02] ERROR: Interface Ethernet5 link down
   [spine-01] ERROR: BGP neighbor 172.30.128.5 connection refused
   ```

**Success Criteria:**
- ✅ ERROR count near zero
- ✅ No unexpected critical errors

### Task 5: Optional - Check ASIC Resources (1 minute)

**Objective:** Verify no ASIC resources nearing capacity

**Steps:**

1. **Access Switch Critical Resources Dashboard:**
   - Click **Dashboards** → **"Switch Critical Resources"**

2. **Scan Resource Utilization:**
   - Review all panels (Route Table, ARP Table, FDB, ACL)
   - **Healthy:** All < 80% capacity
   - **Warning:** Any resource 80-90%
   - **Critical:** Any resource > 90%

3. **Note Resources for Capacity Planning:**
   - If any resource > 70%, document for future planning
   - ASIC resources are hardware limits and cannot be increased

**Success Criteria:**
- ✅ All ASIC resources < 90% capacity

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

**1. BGP Sessions Overview**

- **Metric:** Count of BGP sessions (total, established, down)
- **Healthy State:** All sessions = Established
- **Unhealthy State:** Any sessions in Idle, Connect, or Active state
- **Example:**
  ```
  Total Sessions: 40
  Established: 40
  Down: 0
  ```

**2. BGP Neighbor Status Table**

- **Columns:** Switch, Neighbor IP, State, Prefixes Received, Uptime
- **Healthy Row:** State = "established", Prefixes > 0, Uptime > 1 hour
- **Unhealthy Row:** State ≠ "established", Prefixes = 0
- **Example:**
  ```
  Switch    Neighbor         State         Prefixes  Uptime
  leaf-01   172.30.128.1    established   12        3d 5h
  leaf-01   172.30.128.2    established   12        3d 5h
  leaf-02   172.30.128.1    Idle          0         0s      ← PROBLEM
  ```

**3. BGP Session Flaps**

- **Metric:** BGP session state changes over time
- **Healthy State:** Flat line (no changes)
- **Unhealthy State:** Spikes indicate session instability
- **Interpretation:** Graph showing session going down and back up = flapping (investigate physical layer or BGP config)

**4. Prefixes Received/Advertised**

- **Metric:** Number of routes exchanged per neighbor
- **Healthy State:** Consistent count (e.g., 10-20 prefixes per neighbor)
- **Unhealthy State:** Sudden drop to 0 (neighbor lost routes)

**Dashboard Actions:**

- **Daily Health Check:** Verify BGP Sessions count matches expected (e.g., 40)
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

**1. Interface Operational State**

- **Metric:** Up (green) or Down (red) per interface
- **Healthy State:** All configured interfaces up
- **Unhealthy State:** Expected-up interfaces showing down
- **Example:**
  ```
  leaf-01/Ethernet1: UP    (server connection)
  leaf-01/Ethernet2: UP    (server connection)
  leaf-01/Ethernet48: UP   (spine uplink)
  leaf-01/Ethernet49: DOWN (unused port - OK)
  ```

**2. Interface Traffic Rate**

- **Metric:** Bits per second (bps) or packets per second (pps)
- **Visualization:** Time series graph per interface
- **Healthy State:** Consistent traffic matching workload
- **Unhealthy State:** Unexpected spikes or drops to zero
- **Example:**
  - Server interface: 2 Gbps steady (expected)
  - Server interface: 10 Gbps sustained (possible saturation - investigate)

**3. Interface Utilization**

- **Metric:** Percentage of link capacity used
- **Healthy State:** < 70% utilization (headroom available)
- **Warning State:** 70-90% (nearing capacity)
- **Critical State:** > 90% (congestion risk)
- **Example:**
  ```
  Ethernet1: 45% (healthy)
  Ethernet2: 85% (warning - consider upgrade)
  Ethernet3: 95% (critical - likely packet drops)
  ```

**4. Error Counters**

- **Metric:** CRC errors, frame errors, discards per interface
- **Healthy State:** 0 errors, or very low error rate
- **Unhealthy State:** Growing error count (cable issue, duplex mismatch)

**Understanding Error Types:**

| Error Type | Cause | Action |
|------------|-------|--------|
| **CRC Errors** | Bad cable, dirty fiber, EMI | Replace cable/clean fiber |
| **Frame Errors** | Physical layer issues | Check cable, duplex settings |
| **Discards** | Congestion, buffer full | Check utilization, consider QoS |

**Example:**
```
Interface    CRC Errors   Frame Errors   Discards
Ethernet1    0            0              0          ← Healthy
Ethernet2    1,234        523            0          ← Cable problem
Ethernet3    0            0              52,341     ← Congestion (drops)
```

**5. VLAN Configuration**

- **Metric:** VLANs configured on each interface
- **Use Case:** Verify VPCAttachment applied correct VLANs
- **Example:**
  ```
  Ethernet1: VLAN 1010, 1020 (expected for server-01)
  Ethernet2: VLAN 1030        (expected for server-02)
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

**1. PSU Status**

- **Metric:** Operational state (OK/Failed) per PSU
- **Healthy State:** All PSUs = OK
- **Unhealthy State:** Any PSU = Failed or Not Present
- **Example:**
  ```
  Switch    PSU1   PSU2
  leaf-01   OK     OK       ← Healthy
  leaf-02   OK     FAILED   ← Replace PSU2
  ```

**2. PSU Voltage**

- **Metric:** Input/output voltage in volts
- **Healthy State:** Within expected range (e.g., 11.5V - 12.5V for 12V rail)
- **Unhealthy State:** Voltage outside range (power supply issue)
- **Example:**
  ```
  PSU1 Output: 12.1V (OK)
  PSU2 Output: 10.2V (Low - failing PSU)
  ```

**3. Fan Speeds**

- **Metric:** RPM (revolutions per minute) per fan
- **Healthy State:** All fans > minimum threshold (e.g., > 3000 RPM)
- **Unhealthy State:** Fan = 0 RPM (failed) or very low
- **Example:**
  ```
  Fan Tray 1: 5,200 RPM (OK)
  Fan Tray 2: 5,100 RPM (OK)
  Fan Tray 3: 0 RPM     (FAILED - thermal risk)
  ```

**4. Temperature Sensors**

- **Metric:** Celsius per sensor (CPU, ASIC, ambient, PSU)
- **Healthy State:** Below warning thresholds
  - CPU: < 70°C
  - ASIC: < 80°C
  - Ambient: < 45°C
- **Unhealthy State:** Approaching or exceeding limits
- **Example:**
  ```
  CPU Temp: 55°C (OK)
  ASIC Temp: 85°C (WARNING - check cooling)
  Ambient: 48°C (WARNING - data center HVAC issue)
  ```

**5. Transceiver Optics (DOM)**

- **Metric:** TX/RX power, temperature per optical interface
- **Healthy State:** Within optic specifications
- **Unhealthy State:** Low RX power (dirty/bad fiber), high temp (failing optic)
- **Example:**
  ```
  Ethernet48 (Spine Uplink):
    TX Power: -2.5 dBm (OK)
    RX Power: -3.1 dBm (OK)
    Temp: 45°C (OK)

  Ethernet49:
    RX Power: -15.2 dBm (CRITICAL - signal loss, check fiber)
  ```

**Dashboard Actions:**

- **Daily Health Check:** Scan for failed PSUs, stopped fans, high temps
- **Preventive Maintenance:** Schedule PSU/fan replacement before failure
- **Capacity Planning:** Track temperature trends (data center cooling)
- **Optics Validation:** After fiber installation, verify RX power in range

**What "Healthy" Looks Like:**
- All PSUs operational
- All fans running > minimum RPM
- Temperatures well below limits
- Optic power levels within spec

**What "Unhealthy" Looks Like:**
- Failed PSU (single point of failure)
- Fan failure (thermal risk)
- High temperatures (cooling insufficient)
- Low optical RX power (fiber issue)

### Concept 4: Logs Dashboard - Error Filtering

**Purpose:** Aggregate and search switch logs for troubleshooting

The Logs Dashboard gives you a centralized view of syslog messages from all switches. This is essential for troubleshooting—correlating metrics anomalies with log events.

**Key Panels:**

**1. Syslog Stream**

- **Content:** Live stream of syslog messages from all switches
- **Use Case:** Watch log messages in real-time
- **Filter By:** Log level, switch, time range
- **Example:**
  ```
  [leaf-01] Oct 17 10:15:23 INFO: BGP neighbor 172.30.128.1 established
  [leaf-02] Oct 17 10:15:45 ERROR: Interface Ethernet5 link down
  [spine-01] Oct 17 10:16:02 WARNING: High CPU usage detected
  ```

**2. Log Level Breakdown**

- **Metric:** Count of logs by severity (ERROR, WARNING, INFO, DEBUG)
- **Healthy State:** Few or no ERRORs
- **Unhealthy State:** Spike in ERROR count
- **Example:**
  ```
  Last 1 hour:
    ERROR: 2
    WARNING: 12
    INFO: 523
  ```

**3. Error Rate Visualization**

- **Metric:** Errors per minute over time
- **Healthy State:** Flat line near zero
- **Unhealthy State:** Spike indicates incident
- **Example:** Graph shows spike at 10:15 (correlate with interface down event)

**4. Log Search / Filtering**

- **Capability:** Full-text search across all logs
- **Use Cases:**
  - Find all BGP-related errors: `bgp AND error`
  - Find logs for specific switch: `switch="leaf-01"`
  - Find interface events: `interface AND (up OR down)`

**Dashboard Actions:**

- **Daily Health Check:** Check ERROR count (should be 0 or near 0)
- **Troubleshooting:** Search for specific error messages
- **Incident Investigation:** Correlate log spike with metrics change
- **Audit Trail:** Review configuration change logs

**What "Healthy" Looks Like:**
- ERROR count = 0 or very low
- No unusual log patterns
- Warnings are expected/known (e.g., unused ports)

**What "Unhealthy" Looks Like:**
- ERROR count > 10 in last hour
- Repeating error messages
- Unexpected critical errors

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
   - Navigate to http://localhost:9090/targets
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
   - For byte counters: `rate(interface_bytes_out[5m]) * 8` (converts to bps)
   - For packet counters: `rate(interface_packets_out[5m])`

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
- URL: http://localhost:3000
- Login: admin / prom-operator
- Location: Dashboards → Browse

**6 Hedgehog Dashboards:**

1. **Hedgehog Fabric** - BGP underlay health
2. **Hedgehog Interfaces** - Interface state, traffic, errors
3. **Hedgehog Platform** - PSU, fans, temperature, optics
4. **Hedgehog Logs** - Syslog aggregation and search
5. **Node Exporter** - Linux system metrics (CPU, memory, disk)
6. **Switch Critical Resources** - ASIC resource capacity

**Common Time Ranges:**
- Last 5 minutes (real-time monitoring)
- Last 1 hour (health checks)
- Last 24 hours (daily trends)
- Last 7 days (weekly patterns)

---

**Module Complete!** You've learned to interpret Grafana dashboards for daily fabric health checks. Ready to correlate metrics with Kubernetes events in Module 3.3.
