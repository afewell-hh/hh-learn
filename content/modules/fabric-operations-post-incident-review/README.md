---
title: "Post-Incident Review"
slug: "fabric-operations-post-incident-review"
difficulty: "intermediate"
estimated_minutes: 12
version: "v1.0.0"
validated_on: "2025-10-17"
pathway_slug: "network-like-hyperscaler"
pathway_name: "Network Like a Hyperscaler"
tags:
  - hedgehog
  - fabric
  - post-incident
  - review
  - continuous-improvement
  - sre
  - blameless-culture
description: "Conduct blameless post-incident reviews, document lessons learned, and build operational knowledge for continuous improvement."
order: 404
---

## Introduction

You've completed an incident:
- Diagnosed the issue (Module 4.1)
- Rolled back the problematic change (Module 4.2)
- Worked with support (Module 4.3)
- Resolved the outage

**Most teams stop here.** Incident resolved, move on to the next task.

**High-performing teams add one more step:** Post-incident review.

### Learning From What Went Wrong

**Why conduct post-incident reviews?**

- **Incidents are expensive learning opportunities** - Already paid the cost (downtime, lost productivity), maximize the learning
- **Same issues recur if root causes aren't addressed** - Fixing symptoms doesn't prevent recurrence
- **Team knowledge improves when insights are shared** - One person's lesson becomes everyone's knowledge
- **Process gaps become visible through reflection** - See systemic issues that daily operations hide

**Traditional response to incidents:**
```
Incident occurs → Firefight → Resolve → Blame someone → Move on → Same incident recurs
```

**High-performing team response:**
```
Incident occurs → Firefight → Resolve → Post-Incident Review → Document learnings →
Update processes → Implement improvements → Incident prevented/easier next time
```

### SRE Culture - Blameless Reviews

Site Reliability Engineering (SRE) teaches:

> **"Failure is inevitable in complex systems. Learning from failure is optional."**

Post-incident reviews (PIRs) embody SRE principles:

**Blameless culture:**
- Focus on systems and processes, not individuals
- "What allowed this mistake?" not "Who made this mistake?"
- Psychological safety to report issues honestly

**Continuous improvement:**
- Every incident improves operations
- Track patterns to identify systemic issues
- Measure improvement over time

**Shared learning:**
- Team knowledge grows through documentation
- New operators learn from past incidents
- Organizational memory prevents forgotten lessons

**Forward-looking:**
- "How do we prevent this?" not "Who caused this?"
- Create actionable improvements
- Update runbooks and processes

### What You'll Learn

**Blameless Post-Incident Review:**
- Creating factual timelines (what happened, when)
- Identifying root cause with 5 Whys technique
- Distinguishing root cause from proximate cause
- Facilitating reviews without blame

**Action Item Creation:**
- SMART action items (Specific, Measurable, Actionable, Relevant, Time-bound)
- Categorizing improvements (immediate, short-term, long-term)
- Assigning ownership and due dates
- Tracking completion

**Operational Knowledge Management:**
- Updating runbooks based on incidents
- Building troubleshooting guides
- Creating searchable PIR repository
- Sharing learnings with team

### Module Scenario

You'll conduct a post-incident review for the VLAN conflict issue from Modules 4.1-4.3:
- Document complete timeline from detection to resolution
- Identify root cause using 5 Whys
- Extract lessons learned
- Create 2-3 actionable improvements with SMART criteria

By the end of this module, you'll complete the incident lifecycle and contribute to continuous improvement culture.

---

## Learning Objectives

By the end of this module, you will be able to:

1. **Conduct blameless post-incident reviews** - Facilitate reviews focused on learning, not blaming
2. **Document lessons learned** - Create actionable improvement items from incidents
3. **Update operational runbooks** - Improve documentation based on incident experiences
4. **Identify systemic improvements** - Recognize patterns that require process or tool changes
5. **Build operational knowledge** - Contribute to team learning and continuous improvement

---

## Prerequisites

Before starting this module, you should have:

**Completed Modules:**
- Module 4.1: Diagnosing Fabric Issues (provides incident to review)
- Module 4.2: Rollback & Recovery (resolution actions documented)
- Module 4.3: Coordinating with Support (escalation timeline)
- All previous courses (Courses 1-3)

**Understanding:**
- Incident lifecycle (detection → diagnosis → resolution)
- Troubleshooting methodology
- GitOps rollback procedures
- Support escalation process

**Context:**
- This module reviews the VLAN conflict incident from Modules 4.1-4.3
- You'll use real incident data to practice PIR skills

---

## Scenario

**Incident Summary (from Modules 4.1-4.3):**

**What happened:**
- VPCAttachment `customer-app-vpc-server-07` created successfully (no error events)
- Server-07 had no connectivity within VPC
- Root cause: VLAN mismatch (VPC expected 1025, switch configured with 1020)
- Attempted fix: Update VPC to VLAN 1020 → Failed with "VLAN reserved for system use" error
- Resolution: Escalated to support, updated VPC to VLAN 1030, connectivity restored

**Timeline:**
- 10:00 UTC: VPCAttachment created
- 10:07 UTC: Issue reported (no connectivity)
- 10:15-10:45 UTC: Investigation and diagnosis
- 11:00 UTC: Attempted self-resolution (failed)
- 11:30 UTC: Escalated to support
- 14:00 UTC: Support responded with solution
- 14:20 UTC: Incident resolved

**Duration:** 4 hours 20 minutes (detection to resolution)

**Your Task:**

Conduct a complete post-incident review to extract learnings and create improvements that prevent recurrence.

---

## Core Concepts & Deep Dive

### Concept 1: Blameless Culture

#### What is a Blameless Culture?

**Traditional approach (blame-focused):**
- "Who made the mistake?"
- "Why didn't they check before applying the change?"
- "This person needs retraining."
- Focus on individual actions

**Blameless approach (systems-focused):**
- "Why did the system allow this mistake?"
- "What process would have caught this earlier?"
- "How do we make the right thing easy to do?"
- Focus on systemic improvements

#### Key Principles

**Principle 1: Systems Thinking**

Incidents result from **system failures**, not individual failures.

**System failures include:**
- **Process gaps** - No VLAN conflict checking before VPC creation
- **Tool limitations** - VLANNamespace doesn't show which VLANs are in use
- **Documentation gaps** - VLAN reservation ranges not documented
- **Design issues** - No validation that prevents conflicts at creation time

**Human error is a symptom, not a root cause.**

When someone makes a "mistake," ask:
- What allowed that mistake to reach production?
- What tools or checks would have caught it earlier?
- How do we make the correct action the easy action?

**Example:**

**Blame-focused question:**
> "Why did Alice commit the wrong VLAN to Git?"

**Systems-focused question:**
> "Why doesn't our Git workflow validate VLAN conflicts before accepting commits?"

The second question leads to actionable improvements (pre-commit hooks, CI/CD validation). The first question leads nowhere useful.

---

**Principle 2: Forward-Looking Questions**

**Avoid backward-looking blame:**
- "Who committed the broken YAML?"
- "Why didn't you test before pushing to prod?"
- "How could you not know VLAN 1025 was in use?"

**Ask forward-looking improvement questions:**
- "What would have caught this error earlier in the process?"
- "How can we make VLAN selection less error-prone?"
- "What tools or checks would prevent this in the future?"

**Difference:**

| Blame Question | Forward-Looking Question | Leads To |
|----------------|-------------------------|----------|
| "Who broke it?" | "What in our process allowed this?" | Process improvement |
| "Why didn't you check?" | "How do we make checking automatic?" | Tool development |
| "You should have known." | "How do we make knowledge explicit?" | Documentation update |

---

**Principle 3: Psychological Safety**

Teams with blameless culture exhibit:
- **Report incidents honestly** - Don't hide issues out of fear
- **Share near-misses** - "I almost made this mistake" is valuable learning
- **Ask for help early** - Not seen as weakness
- **Experiment with improvements** - Failure during experimentation is acceptable
- **Admit mistakes quickly** - Reduces mean time to resolution

**Without psychological safety:**
- **Incidents get hidden** - Fear of blame prevents reporting
- **Knowledge isn't shared** - Protective, siloed behavior
- **Improvements don't happen** - Risk-averse culture avoids change
- **Mean time to resolution increases** - People hesitate to escalate
- **Recurring incidents** - Lessons learned aren't captured or shared

**Building psychological safety in PIRs:**
- Facilitator sets blameless tone at start
- Redirect blame to system focus
- Celebrate learning and honesty
- Thank participants for sharing insights
- Document improvements, not individual mistakes

---

### Concept 2: Post-Incident Review Template

#### PIR Structure (4 Sections)

**Section 1: What Happened? (Timeline)**

Document the incident chronologically with factual observations.

**Example Timeline:**

```
2025-10-17 10:00 UTC - VPCAttachment customer-app-vpc-server-07 created via Gitea commit
2025-10-17 10:05 UTC - ArgoCD synced VPCAttachment to cluster successfully
2025-10-17 10:07 UTC - Developer reported: server-07 no connectivity to VPC gateway
2025-10-17 10:15 UTC - Investigation started (checked kubectl events - no errors found)
2025-10-17 10:30 UTC - Agent CRD checked: VLAN 1020 on leaf-04/Ethernet8 (VPC expects 1025)
2025-10-17 10:45 UTC - Root cause identified: VLAN conflict (1025 in use, system allocated 1020)
2025-10-17 11:00 UTC - Attempted fix: Updated VPC YAML to VLAN 1020
2025-10-17 11:05 UTC - ArgoCD sync failed: "VLAN 1020 reserved for system use"
2025-10-17 11:30 UTC - Escalated to support (P2 ticket) with complete diagnostics
2025-10-17 14:00 UTC - Support responded: VLANs 1020-1029 reserved, use 1030+
2025-10-17 14:15 UTC - Updated VPC to VLAN 1030, ArgoCD synced successfully
2025-10-17 14:20 UTC - Connectivity verified, incident resolved
```

**Goal:** Factual timeline with timestamps. No interpretation, blame, or conclusions yet.

**Metrics:**
- **Mean Time to Detect (MTTD):** 7 minutes (10:00 creation → 10:07 reported)
- **Mean Time to Resolve (MTTR):** 4 hours 13 minutes (10:07 detected → 14:20 resolved)

---

**Section 2: Why Did It Happen? (Root Cause)**

Identify underlying cause using structured technique. Don't stop at first obvious answer.

**5 Whys Technique:**

Start with symptom, ask "why" five times to reach root cause:

**1. Why did server-07 have no connectivity?**
- Because VPC VLAN (1025) didn't match switch VLAN (1020)

**2. Why didn't VPC VLAN match switch VLAN?**
- Because VLAN 1025 was already in use by another VPC, so system auto-allocated 1020

**3. Why wasn't VLAN conflict detected before VPC creation?**
- Because VLANNamespace doesn't validate VLAN availability at creation time

**4. Why doesn't VLANNamespace validate VLAN conflicts?**
- Because it defines ranges, not tracks usage (current design limitation)

**5. Why wasn't VLAN reservation (1020-1029) documented for operators?**
- Because system reservations aren't exposed via API or operator documentation

**Root Cause:**

No pre-creation validation for VLAN conflicts. VLANNamespace allows VLAN selection from range without checking current usage or communicating reserved ranges.

**Contributing Factors:**
- Documentation gap: Reserved VLANs (1020-1029) not listed in runbook
- Operator knowledge gap: Didn't know to manually check existing VPC VLANs first
- Error message unclear: "Reserved for system use" but no list of reserved VLANs provided
- No tooling to show available VLANs programmatically

**Root Cause vs. Proximate Cause:**

| Type | Description | Example | Can Recur? |
|------|-------------|---------|------------|
| **Proximate Cause** | Immediate trigger | Operator chose VLAN 1025 | Yes - next operator can make same choice |
| **Root Cause** | Systemic issue | No VLAN conflict validation | No - if fixed, prevents recurrence |

**Always address root cause, not just proximate cause.**

---

**Section 3: How Was It Resolved? (Actions Taken)**

Document resolution path with what worked and what could improve.

**Immediate Actions:**
1. Diagnosed VLAN mismatch using Agent CRD inspection (10:30 UTC)
2. Attempted self-resolution by updating VPC VLAN to 1020 (11:00 UTC)
3. Encountered "reserved VLAN" error blocking self-resolution (11:05 UTC)
4. Escalated to support with complete diagnostics (11:30 UTC)
5. Received clarification from support: VLANs 1020-1029 reserved (14:00 UTC)
6. Updated VPC to VLAN 1030 and synced via ArgoCD (14:15 UTC)
7. Verified connectivity restored (14:20 UTC)

**What Worked Well:**
- Systematic troubleshooting using Module 4.1 methodology identified root cause quickly
- Complete diagnostic bundle attachment enabled fast support response
- ArgoCD GitOps workflow made rollback/update safe and auditable

**What Could Be Improved:**
- Earlier escalation after first failed fix attempt (11:05) could have saved ~3 hours
- Documentation of reserved VLANs would have prevented initial issue
- VLAN validation tooling would catch conflicts before creation

**Time Breakdown:**
- **Detection:** 7 minutes (fast - developer reported immediately)
- **Diagnosis:** 38 minutes (10:15-10:53, systematic troubleshooting)
- **Failed self-resolution:** 35 minutes (11:00-11:35)
- **Waiting for support:** 2 hours 30 minutes (11:30-14:00)
- **Resolution application:** 20 minutes (14:00-14:20)

**Opportunities:** Biggest time saver would be preventing issue entirely through VLAN validation or earlier escalation recognition.

---

**Section 4: How Do We Prevent Recurrence? (Improvements)**

Create actionable improvements categorized by timeline.

**Immediate (Do This Week):**
1. Update operator runbook: Document reserved VLAN ranges (1020-1029)
2. Create VLAN selection checklist: Check existing VPCs, avoid reserved ranges, document choices
3. Add VLAN conflict troubleshooting example to diagnostic guide

**Short-Term (Do This Month):**
4. File Hedgehog GitHub issue requesting documentation of reserved VLANs in official docs
5. Create kubectl helper script (show-available-vlans.sh) to list reserved, used, and available VLANs

**Long-Term (Product Team Proposals):**
6. Feature request: VLANNamespace API to expose available VLANs with validation
7. Feature request: VPC creation pre-validation with clear error messages and suggestions

**Prioritization:** Focus on immediate/short-term (operator-actionable). Long-term documents desired product improvements.

---

### Concept 3: Creating Actionable Improvements

#### What Makes a Good Action Item?

**Bad Action Items (Too Vague):**
- "Be more careful with VLAN selection" ❌ Not specific, not measurable
- "Check things before creating VPCs" ❌ Not actionable ("things"?)
- "Improve documentation" ❌ Not time-bound or owned

**Good Action Items (Specific, Measurable, Owned):**
- "Document reserved VLANs 1020-1029 in operator runbook section 'VLAN Selection Guidelines' (Owner: Alice, Due: Oct 20)" ✅
- "Create show-available-vlans.sh script and commit to kubectl-fabric-helpers repo (Owner: Bob, Due: Oct 25)" ✅
- "File Hedgehog GitHub issue requesting VLAN validation feature with use case and examples (Owner: Charlie, Due: Oct 18)" ✅

#### SMART Criteria

**S - Specific:**
- What exactly will be done?
- Where will it be documented/implemented?
- What content will be included?

**M - Measurable:**
- How will we know it's complete?
- What are the success criteria?
- Can we verify completion objectively?

**A - Actionable:**
- Can someone actually do this?
- Do they have the tools/access needed?
- Is the action clear?

**R - Relevant:**
- Does this prevent recurrence?
- Does it address root cause or contributing factor?
- Is it worth the effort?

**T - Time-bound:**
- When will it be done?
- Is the deadline realistic?
- Does priority match urgency?

#### SMART Action Item Example

```markdown
Title: Document Reserved VLAN Ranges
Owner: Alice Thompson
Due Date: 2025-10-20
Priority: High

Description: Update operator runbook section "VLAN Selection Guidelines" documenting reserved VLAN ranges (1020-1029), kubectl command to check existing VLANs, recommended selection procedure, and troubleshooting tips.

Success Criteria:
- Runbook section created with reserved VLANs documented
- kubectl command example included
- Committed to docs repository

Status: In Progress
```

**Key elements:** Specific owner and deadline, measurable success criteria, actionable steps.

---

### Concept 4: Operational Knowledge Management

#### Building Team Knowledge

Post-incident reviews create **organizational memory**—knowledge that persists beyond individual team members.

**Knowledge Artifacts:**

**1. PIR Documents**
- Incident history and timeline
- Root cause analysis
- Lessons learned
- Action items tracked to completion

**2. Updated Runbooks**
- Procedures improved based on real experience
- New troubleshooting steps added
- Known issues documented with workarounds

**3. Troubleshooting Guides**
- Common failure modes and solutions
- Decision trees for diagnosis
- Quick reference commands

**4. Known Issues List**
- Product limitations with workarounds
- Configuration gotchas
- Environment-specific quirks

#### Knowledge Sharing Practices

**1. Team PIR Review Meetings (15-30 min)**
- Present PIR findings to team
- Discuss action items
- Share insights and questions
- Build shared understanding

**2. Documentation Repository**
- Git repository for PIRs and runbooks
- Searchable by date, tag, or keyword
- Indexed for easy navigation

**3. New Operator Onboarding**
- Review past PIRs as learning material
- "Here's what we've learned" orientation
- Understand common issues before encountering them

**4. Quarterly Pattern Analysis**
- Review all PIRs from quarter
- Identify recurring root causes
- Prioritize systemic improvements
- Track incident reduction metrics

#### Continuous Improvement Cycle

```
Incident Occurs
    ↓
Troubleshoot & Resolve (Modules 4.1-4.3)
    ↓
Post-Incident Review (Module 4.4) ← YOU ARE HERE
    ↓
Document Lessons Learned
    ↓
Update Runbooks & Processes
    ↓
Share Knowledge with Team
    ↓
Implement Improvements (SMART action items)
    ↓
Monitor for Recurrence
    ↓
(Fewer incidents over time, faster resolution when they occur)
```

**Goal:** Each incident makes the next one:
- Less likely to occur (prevention through improvements)
- Faster to detect (better monitoring)
- Faster to resolve (documented procedures)

**Metrics to Track:**
- Incident frequency (decreasing over time)
- Mean time to detect (MTTD - decreasing)
- Mean time to resolve (MTTR - decreasing)
- Recurring incident rate (decreasing)
- Runbook utilization (increasing)

---

## Hands-On Lab

### Lab Overview

**Title:** Conduct Post-Incident Review

**Scenario:**

Conduct a PIR for the VLAN conflict incident from Modules 4.1-4.3.

**Duration:** 4-5 minutes

**Tasks:**
1. Document timeline (1-2 min)
2. Identify root cause using 5 Whys (1-2 min)
3. Create 2-3 SMART action items (1-2 min)
4. (Optional) Update personal runbook (1 min)

---

### Task 1: Document Timeline

**Estimated Time:** 1-2 minutes

**Objective:** Create factual chronological timeline of the incident.

#### Step 1.1: List Key Events

Using information from Modules 4.1-4.3, list events in chronological order.

**Your Timeline:**

```
YYYY-MM-DD HH:MM UTC - [Event description]
```

**Events to Include:**
- VPCAttachment created (via Gitea commit)
- ArgoCD synced resource
- Issue reported by user/developer
- Investigation started
- Root cause identified (VLAN mismatch)
- Attempted self-resolution (updating VPC YAML)
- Self-resolution failed (reserved VLAN error)
- Escalated to support (with diagnostics)
- Support response received
- Resolution applied (VPC updated to VLAN 1030)
- Connectivity verified
- Incident resolved

**Fill in Timeline:** Create 10-12 timestamped entries from VPCAttachment creation through incident resolution, including investigation milestones, failed attempts, escalation, and final resolution.

#### Step 1.2: Calculate Metrics

**Mean Time to Detect (MTTD):** Time from incident start (10:00) to detection (10:07) = 7 minutes

**Mean Time to Resolve (MTTR):** Time from detection (10:07) to resolution (14:20) = 4 hours 13 minutes

#### Success Criteria

- ✅ At least 10 timeline entries
- ✅ Events in chronological order with timestamps
- ✅ Factual descriptions (no blame language like "Alice made mistake")
- ✅ Metrics calculated (MTTD and MTTR)

---

### Task 2: Root Cause Analysis

**Estimated Time:** 1-2 minutes

**Objective:** Use 5 Whys to identify systemic root cause.

#### Step 2.1: Complete 5 Whys

Start with the symptom "server-07 has no connectivity" and ask "why" five times:
1. Why did server-07 have no connectivity?
2. Why [answer to #1]?
3. Why [answer to #2]?
4. Why [answer to #3]?
5. Why [answer to #4]?

Each "why" should dig deeper from the proximate cause toward the systemic root cause.

#### Step 2.2: State Root Cause

Based on your 5 Whys analysis, identify:
- **Root Cause:** The systemic issue (process gap, tool limitation, or documentation gap)
- **Contributing Factors:** 2-3 additional factors that enabled the issue

#### Step 2.3: Verify Root Cause

**Root Cause Test:** "If we fix this root cause, would the same incident be impossible or much less likely?"

Your answer: Yes / No

If "No," your root cause may be a proximate cause. Keep asking "why" until you reach a systemic issue.

#### Success Criteria

- ✅ Root cause is systemic (process gap, tool limitation, documentation gap)
- ✅ Root cause is NOT individual blame ("operator chose wrong VLAN")
- ✅ Contributing factors identified
- ✅ Root cause passes verification test (fixing it would prevent recurrence)

---

### Task 3: Create SMART Action Items

**Estimated Time:** 1-2 minutes

**Objective:** Define 2-3 specific, actionable improvements.

#### Step 3.1: Brainstorm Improvements

What could prevent this incident from recurring?

**Your Ideas:**

1. _______________________________________
2. _______________________________________
3. _______________________________________
4. _______________________________________

**Categories to Consider:**
- Documentation updates (runbook, troubleshooting guide)
- Scripts or tools (kubectl helpers, validation scripts)
- Process changes (checklist, peer review)
- Feature requests (product improvements)

#### Step 3.2: Make Action Items SMART

Choose 2-3 improvements and apply SMART criteria. For each action item, define:
- **Title:** Clear, specific description
- **Owner:** Specific person responsible
- **Due Date:** Realistic deadline
- **Description:** What will be done, including specific steps
- **Success Criteria:** 2-3 measurable, verifiable outcomes

#### Success Criteria

- ✅ Each action item has specific owner
- ✅ Each action item has realistic due date
- ✅ Description is specific (not vague like "be more careful")
- ✅ Success criteria are measurable and verifiable
- ✅ Action items address root cause or contributing factors

---

### Task 4: Update Personal Runbook (Optional)

**Estimated Time:** 1 minute

**Objective:** Document VLAN selection procedure for future reference.

#### Step 4.1: Create Runbook Section

Add to your personal troubleshooting runbook:

```markdown
## VLAN Selection for New VPCs

**Before Creating VPC:**
1. Check VLANNamespace range: `kubectl get vlannamespace default -o jsonpath='{.spec.ranges}'`
2. Check existing VPC VLANs: `kubectl get vpc -A -o yaml | grep "vlan:" | sort | uniq`
3. Avoid reserved VLANs: 1020-1029 (system reserved)
4. Choose available VLAN from range, not in use, not reserved
5. Document chosen VLAN in VPC design notes

**Troubleshooting:**
- "VLAN conflict": Choose different VLAN
- "VLAN reserved": Avoid 1020-1029 range
- Use show-available-vlans.sh script or escalate if unclear
```

#### Success Criteria

- ✅ Runbook section created with clear title
- ✅ Procedure has numbered steps
- ✅ kubectl commands included with examples
- ✅ Reserved VLANs documented
- ✅ Troubleshooting tips included

---

### Lab Summary

**What You Accomplished:**

You conducted a blameless post-incident review with:
- ✅ Factual timeline with timestamps and metrics
- ✅ Root cause identified using 5 Whys technique
- ✅ Systemic root cause (not individual blame)
- ✅ 2-3 SMART action items created
- ✅ Personal runbook updated with learnings

**Key Takeaways:**

1. **Blameless reviews focus on systems, not people** - "What allowed this?" not "Who did this?"
2. **5 Whys reveals root cause** - Keep asking "why" until you reach a systemic issue
3. **SMART action items are actionable** - Specific, Measurable, Assigned, Relevant, Time-bound
4. **Operational knowledge compounds** - Each PIR improves team competency
5. **Continuous improvement is iterative** - Small improvements add up over time

**This PIR Would:**
- Prevent VLAN conflict recurrence through documentation and tooling
- Improve team knowledge about VLAN selection
- Create reusable procedures for future operators
- Demonstrate professional operational practices

---

## Troubleshooting

### Common Lab Challenges

#### Challenge: "I can't identify a systemic root cause"

**Symptom:** Your root cause is individual action, not systemic.

**Solution:** Keep asking "why" until you reach system issue. Test: "If we fix this, can the same mistake happen again?" If YES, keep digging.

---

#### Challenge: "My action items are vague"

**Symptom:** Action items like "Improve documentation" or "Be more careful."

**Solution:** Apply SMART criteria: Specific owner, deadline, measurable success criteria, actionable steps.

---

#### Challenge: "Timeline is incomplete"

**Solution:** Include creation, detection, investigation, diagnosis, resolution attempts, escalation, and final resolution with timestamps.

---

## Resources

### Reference Documentation

**Related Modules:**
- Module 4.1: Diagnosing Fabric Issues (incident details)
- Module 4.2: Rollback & Recovery (resolution actions)
- Module 4.3: Coordinating with Support (escalation timeline)

**PIR Templates:**
- Complete template (provided in Concept 2)
- SMART action item template (provided in Concept 3)

**SRE Best Practices:**
- Google SRE Book: "Postmortem Culture: Learning from Failure"
- Etsy's "Blameless PostMortems and Just Culture"
- Atlassian Incident Handbook: "Post-Incident Reviews"

### Quick Reference: PIR Checklist

**Before PIR:**
- [ ] Gather incident timeline from logs, tickets, chat
- [ ] Collect diagnostic evidence and resolution steps
- [ ] Schedule PIR meeting within 1-3 days of resolution
- [ ] Invite participants (operators, support, stakeholders)

**During PIR:**
- [ ] Set blameless tone at opening
- [ ] Document factual timeline
- [ ] Conduct 5 Whys for root cause
- [ ] Brainstorm improvements (defer judgment)
- [ ] Create SMART action items with owners

**After PIR:**
- [ ] Publish PIR document to team repository
- [ ] Track action items to completion
- [ ] Update runbooks and procedures
- [ ] Share learnings with team
- [ ] Monitor for recurrence

### 5 Whys Quick Reference

**How to use:**

1. Start with symptom/problem statement
2. Ask "Why did this happen?" → Record answer
3. Ask "Why [answer to 2]?" → Record answer
4. Ask "Why [answer to 3]?" → Record answer
5. Ask "Why [answer to 4]?" → Record answer
6. Ask "Why [answer to 5]?" → Record answer ← ROOT CAUSE

**Root cause characteristics:**
- Systemic (process, tool, design issue)
- Actionable (can be addressed with improvements)
- Preventive (fixing it prevents recurrence)

**If you reach individual blame ("operator mistake"), keep asking "why" - you haven't reached root cause yet.**

### SMART Action Item Checklist

**Before finalizing action item, verify:**

- [ ] **Specific:** What exactly will be done? Where?
- [ ] **Measurable:** How will we verify completion?
- [ ] **Actionable:** Can assigned person do this? Do they have access/tools?
- [ ] **Relevant:** Does this address root cause or contributing factor?
- [ ] **Time-bound:** When will this be done? Is deadline realistic?

**If any criteria not met, refine action item until all criteria satisfied.**

---

## Assessment

### Question 1: Blameless Culture

**Scenario:** During a PIR, someone says: "This outage happened because Alice pushed wrong YAML. She should have tested it first."

What is the BEST blameless response?

- A) "You're right, Alice should have been more careful."
- B) "Let's focus on Alice's training plan."
- C) "This isn't Alice's fault, it's the system's fault."
- D) "Let's discuss what process or validation would have caught this error before production."

<details>
<summary>Answer & Explanation</summary>

**Answer:** D

**Why D is correct:** Focuses on systems thinking (process gap), forward-looking improvements, and actionable solutions like pre-commit validation, staging environments, or peer review workflows.

**Why others wrong:** A and B focus on individual blame, C is too vague without actionable steps.

**Blameless principle:** "Human error is a symptom of systemic issues. Fix the system, not the human."
</details>

---

### Question 2: Root Cause Analysis

**Scenario:** Which statement represents a ROOT CAUSE (vs. proximate cause)?

- A) "Server had no connectivity because VLAN was wrong."
- B) "VLAN was wrong because operator chose VLAN 1025."
- C) "Operator chose VLAN 1025 because they didn't check existing VPCs."
- D) "VLANNamespace doesn't validate VLAN conflicts at creation time."

<details>
<summary>Answer & Explanation</summary>

**Answer:** D

**Why D is root cause:** Systemic (system design limitation), actionable (feature request), preventive (fixes all similar incidents). System would validate and prevent conflicts automatically.

**Why others are proximate:** A describes symptom, B and C are human actions. Fixing these doesn't prevent next operator from same mistake.

**Root Cause Test:** "If we fix this, would same incident be impossible?" Only D passes: YES (system prevents mistake).
</details>

---

### Question 3: SMART Action Items

**Scenario:** Which action item is BEST (most SMART)?

- A) "Be more careful when selecting VLANs."
- B) "Update documentation about VLANs."
- C) "Document reserved VLAN ranges (1020-1029) in operator runbook section 'VLAN Selection', including kubectl command. Owner: Alice. Due: Oct 20, 2025."
- D) "Someone should write down VLAN stuff somewhere."

<details>
<summary>Answer & Explanation</summary>

**Answer:** C

**Why C is SMART:** Specific (what/where), Measurable (clear success criteria), Actionable (Alice can do it), Relevant (prevents VLAN conflicts), Time-bound (Oct 20 deadline).

**Why others fail:** A is vague and not measurable. B lacks specifics on what/where/who/when. D has no owner, deadline, or specific scope.
</details>

---

### Question 4: Continuous Improvement

**Scenario:** Your team has 5 PIRs this month. All 5 were VLAN-related config errors. What's the BEST next step?

- A) Accept that VLAN issues are common
- B) Recognize pattern and prioritize systemic improvement (VLAN validation tooling)
- C) Require operators to re-read VLAN documentation
- D) Add more warning labels to Gitea

<details>
<summary>Answer & Explanation</summary>

**Answer:** B

**Why B is correct:** 5 incidents with same root cause = systemic issue. Requires systemic fix (validation tooling, pre-commit hooks, staging environment) not individual training. High ROI: tooling investment < ongoing incident response time.

**Why others wrong:** A is defeatist (not continuous improvement). C didn't prevent first 5 incidents (manual process still error-prone). D is weakest error prevention (warnings don't change behavior).

**SRE principle:** "Recurring incidents indicate systemic issues. Fix the system, not symptoms."
</details>

---

## Conclusion

🎉 **You've completed Module 4.4: Post-Incident Review!**

🏆 **You've completed Course 4: Troubleshooting, Recovery & Escalation!**

🎊 **You've completed the entire Network Like a Hyperscaler pathway!**

### What You Learned in Module 4.4

**Blameless Culture:**
- Focus on systems and processes, not individuals
- Use forward-looking questions
- Build psychological safety for honest reporting

**Post-Incident Review Structure:**
- Section 1: What Happened? (Timeline)
- Section 2: Why Did It Happen? (Root Cause via 5 Whys)
- Section 3: How Was It Resolved? (Actions Taken)
- Section 4: How Do We Prevent Recurrence? (Improvements)

**SMART Action Items:**
- Specific, Measurable, Actionable, Relevant, Time-bound
- Owned by specific person with realistic due date
- Verifiable completion criteria

**Operational Knowledge Management:**
- Build team knowledge through PIR documentation
- Update runbooks and troubleshooting guides
- Share learnings through team meetings
- Track patterns for systemic improvements

### What You Learned in Course 4

**Module 4.1: Diagnosing Fabric Issues**
- Systematic troubleshooting using hypothesis-driven investigation
- Common failure modes and decision trees
- Layered diagnostic approach (Events → Agent CRD → Grafana → Logs)

**Module 4.2: Rollback & Recovery**
- GitOps rollback workflows with git revert and ArgoCD
- Safe deletion order (VPCAttachment → VPCPeering → VPC)
- Kubernetes finalizers and stuck resource troubleshooting
- Partial failure recovery scenarios

**Module 4.3: Coordinating with Support**
- Effective support ticket writing with complete diagnostics
- Communication best practices (prompt, contextual, professional)
- Support ticket lifecycle understanding
- Strategic escalation (when to escalate vs. self-resolve)

**Module 4.4: Post-Incident Review**
- Blameless culture and facilitation
- Root cause analysis with 5 Whys
- SMART action item creation
- Continuous improvement mindset

### What You Accomplished in the Entire Pathway

**Course 1: Foundations & Interfaces**
- Understood Hedgehog architecture and declarative control model
- Mastered three interfaces: Gitea (Git), kubectl (API), Grafana (observability)
- Experienced GitOps workflow firsthand

**Course 2: Provisioning & Connectivity**
- Designed and deployed VPCs with subnets and DHCP
- Attached servers to VPCs with proper connection references
- Validated connectivity through multiple methods
- Decommissioned resources safely in correct order

**Course 3: Observability & Fabric Health**
- Queried Prometheus metrics for fabric state
- Interpreted Grafana dashboards (Fabric, Interfaces, Logs)
- Monitored Agent CRD status for detailed switch state
- Collected comprehensive diagnostics for support

**Course 4: Troubleshooting, Recovery & Escalation**
- Diagnosed fabric issues with systematic methodology
- Rolled back changes safely using GitOps
- Coordinated with support effectively and professionally
- Conducted blameless post-incident reviews

---

## You Are Now a Hedgehog Certified Fabric Operator (HCFO)

### What This Means

**You can confidently operate a Hedgehog fabric:**

✅ **Provision network resources** (VPCs, attachments, peerings) using declarative GitOps

✅ **Monitor fabric health** (Grafana dashboards, kubectl events, Agent CRD inspection)

✅ **Troubleshoot issues** (systematic diagnosis, decision trees, layered investigation)

✅ **Recover from failures** (GitOps rollback, safe deletion, finalizer troubleshooting)

✅ **Collaborate with support** (effective escalation, clear communication, professional tickets)

✅ **Improve operations** (post-incident reviews, runbook updates, knowledge sharing)

### What You Are NOT (Yet)

**You are not:**
- ❌ A fabric architect (designing large fabrics from scratch)
- ❌ A Hedgehog developer (contributing to Hedgehog codebase)
- ❌ A networking expert (deep BGP/EVPN/VXLAN protocol knowledge)

**But you ARE:**
- ✅ **Competent** - Can perform daily operations independently
- ✅ **Confident** - Trust your systematic troubleshooting methodology
- ✅ **Collaborative** - Know when and how to engage support effectively
- ✅ **Continuous learner** - Improve operations with each incident
- ✅ **Blameless** - Focus on systems, not individuals
- ✅ **GitOps-native** - Understand declarative infrastructure as code

### Your Operational Readiness

**Day 1 (Ready Now):**
- Provision VPCs and VPCAttachments using Gitea/kubectl
- Monitor fabric health using Grafana dashboards
- Respond to basic connectivity issues
- Collect diagnostics and escalate when appropriate

**Week 1:**
- Handle most common operational tasks independently
- Use troubleshooting decision trees for diagnosis
- Perform GitOps rollbacks when needed
- Conduct post-incident reviews with team

**Month 1:**
- Build personal runbook from incidents encountered
- Contribute to team knowledge sharing
- Mentor new operators using PIR documentation
- Identify patterns and propose systemic improvements

**Ongoing:**
- Continuous learning through incidents and PIRs
- Stay current with Hedgehog releases and features
- Participate in operations community
- Share learnings and best practices

---

## Next Steps

### Immediate Actions (This Week)

1. **Practice in lab environment**
   - Repeat key modules if needed (especially 4.1 troubleshooting)
   - Experiment with intentional failures to practice diagnosis
   - Build muscle memory for kubectl commands

2. **Create personal runbook**
   - Document procedures learned in pathway
   - Add VLAN selection guidelines from Module 4.4
   - Include kubectl cheat sheet and common commands
   - Add troubleshooting decision trees from Module 4.1

3. **Set up diagnostic tools**
   - Save diagnostic collection script from Module 3.4
   - Bookmark Grafana dashboards (Fabric, Interfaces, Logs)
   - Configure kubectl aliases for common commands
   - Create show-available-vlans.sh helper script

4. **Review support templates**
   - Save support ticket template from Module 4.3
   - Save PIR template from Module 4.4
   - Practice writing both for lab incidents

### First 30 Days (Building Experience)

1. **Shadow senior operators**
   - Observe during incidents and learn their approach
   - Ask questions about decision-making process
   - Compare their methodology to modules learned

2. **Conduct PIRs for all issues**
   - Even small issues deserve brief PIRs (5-10 min)
   - Practice 5 Whys technique until it becomes natural
   - Build habit of documentation and learning

3. **Build personal knowledge base**
   - Document every issue encountered (even if trivial)
   - Create troubleshooting tips section
   - Track learnings from support interactions
   - Organize by topic (VPCs, connectivity, BGP, etc.)

4. **Contribute to team knowledge**
   - Share interesting findings in team channels
   - Update team runbooks with new learnings
   - Present PIR findings in team meetings
   - Help onboard new operators

### Ongoing (Continuous Improvement)

1. **Stay current with Hedgehog**
   - Review release notes for new features
   - Test new functionality in lab before production
   - Update runbooks when procedures change
   - Participate in Hedgehog community discussions

2. **Deepen expertise**
   - Read Hedgehog architecture documentation
   - Learn more about BGP/EVPN/VXLAN (networking foundation)
   - Understand Kubernetes controllers and CRDs deeper
   - Study SRE best practices (Google SRE book)

3. **Participate in operational excellence**
   - Attend or lead post-incident reviews
   - Propose and implement systemic improvements
   - Track incident metrics (frequency, MTTR, recurring patterns)
   - Contribute to automation and tooling

4. **Share knowledge**
   - Mentor new operators
   - Write blog posts or documentation
   - Present learnings to broader team
   - Contribute to open source (if comfortable)

---

## The Hedgehog Learning Philosophy in Action

Throughout this pathway, you experienced:

✅ **Train for Reality, Not Rote**
- Production-like scenarios throughout (VLAN conflicts, BGP issues, support escalation)
- Real commands, real troubleshooting, real documentation

✅ **Focus on What Matters Most**
- Common, high-impact operations (VPC provisioning, connectivity validation, troubleshooting)
- Not comprehensive (didn't cover every CRD), but confident (can handle most scenarios)

✅ **Confidence Before Comprehensiveness**
- Small wins leading to competence
- Each module built on previous success
- Lab success criteria celebrated progress

✅ **Learn by Doing, Not Watching**
- Hands-on labs in every module (no passive video watching)
- Practice actual kubectl commands and GitOps workflows
- Build muscle memory through repetition

✅ **Teach the Why Behind the How**
- Explained GitOps benefits (not just "use Git")
- Explained finalizers purpose (not just "don't remove them")
- Explained blameless culture rationale (not just "don't blame")

✅ **Support as Part of Learning**
- Normalized escalation as professional practice (Module 4.3)
- Blameless culture encourages asking for help (Module 4.4)
- Psychological safety emphasized throughout

✅ **Continuous Learning Over Static Mastery**
- Post-incident reviews for ongoing improvement (Module 4.4)
- Runbook updates based on experience
- Growth mindset: "Each incident makes me better"

---

## Thank You for Completing This Pathway!

You've learned to **network like a hyperscaler**—not by memorizing switch commands, but by mastering:
- Declarative infrastructure as code (GitOps)
- Observability and data-driven operations (Grafana, metrics)
- Systematic troubleshooting (hypothesis-driven investigation)
- Operational excellence (blameless culture, continuous improvement)

**You're ready to operate Hedgehog fabrics with confidence.**

**Welcome to the community of Hedgehog Certified Fabric Operators!**

🎉 **Congratulations on completing all 16 modules!** 🎉

---

**Course 4 Complete** | **Entire Pathway Complete** | **HCFO Certified** ✅