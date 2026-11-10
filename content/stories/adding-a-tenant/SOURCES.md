# Sources for "Eight Nodes, Six Switches"

Every factual claim on the page, with its origin. Written so that a prospect, a
competitor or our own legal review can check each one without asking us.

**Rule applied throughout:** if a figure could not be opened at its primary source, it is not
on the page. Several well-known statistics failed that test and are listed at the bottom so
nobody re-introduces them.

---

## Measured by us

| Claim on the page | How it was obtained |
|---|---|
| 35 configuration objects and 24 lines of routing config appear on one leaf when one tenant is added | Hedgehog VLAB, 1 spine / 2 SONiC VS leaves / 2 servers, hhfab v0.51.4, fabric agent v0.144.1, SONiC 4.5.2-Enterprise_Base, captured 2026-11-09. Every switch's running config read via `sonic-cfggen -d` and `vtysh show running-config` before and after applying one VPC + one VPCAttachment; the page shows the difference. |
| 27 lines of declared intent | The applied `VPC` and `VPCAttachment`, verbatim. |
| Per-decision object counts (19 for route policy, 5 for BGP identity, etc.) | Derived from the same capture by grouping the 35 objects by the decision each serves. All 35 map to exactly one decision; none are unaccounted for. |
| The operator's file contains no `vni`, `route-target`, `irb`, `anycast`, `suppress`, `mtu`, `bgp`, `evpn` or `vxlan` | Grep of the captured file. |

Raw capture and conversion notes: `docs/examples/authoring-platform/modules/shrink-blast-radius-compare/`.

## Arithmetic on measured values — labelled as such on the page

| Claim | Working |
|---|---|
| 120 values must agree for a four-network tenant across six switches | 4 per-network decisions × 4 networks × 6 switches = 96; plus 4 per-tenant decisions × 6 switches = 24. Shown on the page with the split visible, deliberately not "8 × 4 × 6 = 192", which would double-count per-VRF decisions. |
| $568/hour, $13,600/day, $95,000/week | 64 GPUs (8 nodes × 8) × $8.87/GPU-hour. |

## Third-party sources

| Claim | Source | Sample / date | URL |
|---|---|---|---|
| Network-related issues are the largest share of IT service outages, "driven primarily by configuration and change management failures" | Uptime Institute, *Annual Outage Analysis 2026*, Fig. 11 | n=122, published May 2026. Leading cause in every Uptime resiliency survey since 2021 | `https://datacenter.uptimeinstitute.com/rs/711-RIA-145/images/2026.AnnualOutageAnalysis.pdf` |
| 92% say human error was at least a minor contributor to their most recent significant outage | Uptime Institute, *AOA 2026*, Fig. 13 | n=220 | as above |
| 87% say their outage could have been avoided with better management, processes or configuration | Uptime Institute, *AOA 2026*, citing its 2025 data centre survey | n=98 | as above |
| 1 in 5 say their most recent major outage cost over $1M; 57% over $100k | Uptime Institute, *AOA 2026* | n=94 | as above |
| The rise in IT and networking outages is "likely caused by increased IT and network complexity, leading to issues with change management and misconfigurations" | Uptime Institute, *Annual Outage Analysis 2025* | — | `https://datacenter.uptimeinstitute.com/rs/711-RIA-145/images/2025.AnnualOutageAnalysis.pdf` |
| ~70% of outages come from changes to a live system | Google, *Site Reliability Engineering*, O'Reilly 2016, Introduction | **No methodology published.** Page labels it as Google's operational experience, not research | `https://sre.google/sre-book/introduction/` |
| Idle GPUs become unallocatable because capacity is stranded, lacks matching CPUs, or violates network-locality constraints | Alibaba Serverless Infrastructure characterisation, USENIX OSDI 2026, abstract | 155,410 GPUs, 37,707 nodes, 14M jobs, 6 months of 2025 | `https://www.usenix.org/system/files/osdi26-li-suyi.pdf` |
| 5% of idle GPUs unallocatable for a 1-GPU request, 28% for an 8-GPU/128-CPU request | Same paper, Figure 13 | as above | as above |
| GPU allocation "directly affects revenue" | Same paper, §GPU allocation | as above | as above |
| $8.87 per GPU per hour, HGX B200 | Lambda, public pricing page, read 2026-11-10 | 256+ GPUs, 2 weeks to 1 year — their **lowest** published tier | `https://lambda.ai/pricing` |

**Disclosure to apply elsewhere:** FarmGPU, cited on other Hedgehog assets, is a Hedgehog
customer. That relationship should be stated wherever their results are used. It is not cited
on this page.

---

## Rejected — do not re-introduce

Each of these would have strengthened the page and collapsed under one click.

| Claim | Why it was rejected |
|---|---|
| "Gartner: 80% of outages are caused by people and process issues" | The most repeated statistic in this field. **No retrievable Gartner document.** Traces variously to a 1999 note and an expired "through 2015" prediction; propagates through vendor blogs citing each other. Uptime's figures say the same thing with real provenance. |
| "Downtime costs $5,600 per minute" (Gartner) | Origin identified — a 2014 Gartner blog post — but the URL is retired, the author presented it as the midpoint of a $140k–$540k/hour range, and it is twelve years old. |
| "CoreWeave: 35–45% MFU" | **CoreWeave told the SEC it "does not use these metrics to evaluate its operations or business and these metrics do not relate to any specific customer"** (DRSLTR, 2025-01-22). Removed from their FY2025 10-K. The figure actually originates with Meta's Llama 3 paper — cite Meta if needed. |
| "Even a 1% utilization change has substantial operational impact" attributed to the Alibaba paper | Searched the full PDF text. **The sentence is not in it.** |
| "97% of network professionals say human error causes outages" | Dimensional Research / Veriflow 2016. Vendor-sponsored, decade old, and the primary PDF is gone — Veriflow was acquired and the domain is dead. Survives only in news coverage. |
| Juniper "State of Network Automation" change-lead-time figures | Primary PDF returns 404. |
| "GPT-4 achieved 32–36% MFU" | Traces to a leak, never an OpenAI disclosure. |
| "DeepSeek-V3 achieved 21.4%/42.9% MFU" | The technical report contains no MFU figure; these are third-party arithmetic. |
| "The $401 billion idle-GPU problem" | Synthetic: a Gartner spend forecast multiplied by a vendor's utilisation figure. Neither organisation makes the claim. |
| "MLPerf shows N% of peak FLOPs" | MLCommons' own rules state utilisation is not an MLPerf metric. |
| "Run:ai: 83% of GPUs are idle" | The 83% is the sum of two self-reported qualitative buckets, not an idle measurement. Routinely misquoted. 2021, and Run:ai is now part of NVIDIA. |

**Still unverified, needs a human:** the Gartner press release behind the $401B and $2.52T
spend figures is bot-blocked and must be opened in a real browser before any Gartner number
is used anywhere.
