# Formative walkthrough script: discovery junction (#529)

**Purpose:** find defects in the journey with about five people, per #492 §3. This needs no measurement extension (D7). It is not a statistic and does not validate the journey. It exposes where the junction moves the dead end one page downstream.

**This script asks people about their task, not to be profiled.** Nothing here becomes a question on the page.

## Setup

- **Five people**, at least two of whom run a network they own (single-owner), at least one who runs infrastructure for others (multi-tenant), and at least one whose first concern is AI workload performance rather than how the cluster is shared out. Not Hedgehog staff.
- Use the offline `index.html` with working destinations substituted, or screen-share the live destinations. One person at a time. Think aloud. Do not explain the page.
- Record per participant: the route first chosen, the time to first click, whether they returned without an answer, and their own words at each question below.

## Script

1. **Context (2 min).** "Tell me what you are trying to find out about networking for your GPU or AI infrastructure right now." Write down their stated question verbatim. This is the yardstick for "relevant" below.
2. **First look (no clicking).** "What do you think each of these will show you? What would you expect Download to do?" Record any route misread, and whether they expect Download to open a menu.
3. **Task.** "Use this page to get closer to your question." Observe. Do not hint. Let them leave any route.
4. **After each destination.** "What did you learn? What would you do next?" (Ask this before they navigate away.)
5. **Download.** "If you wanted to install this today, where would you go?" Observe whether they find Download, and whether they believe it is for them.
6. **Contact.** "If you wanted a person, what would you do?" Record whether they found it and whether they tried routes first.
7. **Comprehension check, segmentation copy.** Ask: "In your own words, what does this say Hedgehog does for segmentation? What does it **not** tell you?"
8. **Comprehension check, benchmark attribution.** Ask: "Who measured the performance results, and what would you still want to see?" Record whether the participant takes the figures as Hedgehog's own marketing, as independent, or cannot tell.

## What counts as a relevant answer, versus merely clicking

A click is not success. For each participant, a route counts as **found a relevant answer** only if all three hold:

1. **They state, unprompted, something they learned** that addresses the question they gave in step 1, in their own words, not a read-back of the page's heading.
2. **They can point to where on the destination it was.**
3. **They do not say "that's not what I wanted" or return to the junction to try another route** within the same attempt, unless they then say the earlier route contributed.

**Merely clicking:** opens a route, scans, returns within moments, or leaves without a learned statement. Count it as a click, not a find.

## What counts as a useful next step

At step 4, the participant names a **concrete action available from where they are**: open a specific document, try the next route for a stated reason, forward the page to a named colleague, download, or contact. These do not count: "go back", "search for it", "I don't know", or a next step that exists only because the page ended.

If a destination leaves people with no next step, record it as a **dead end moved downstream**, against that destination, even if it was clicked often.

## Defects to log, whether or not anyone completes the task

| Defect | Evidence |
|---|---|
| CTA promise mismatch | Anyone expects "Download" to show a menu, or expects the entry to start an install |
| Download lost | Anyone with a genuine install intent cannot find the download route, or cannot tell it is for them |
| Label misread | Participant predicts a route's content wrongly in step 2 |
| Primary label not recognised | A single-owner participant does not see "Give every team and customer their own slice of the cluster" as relevant to them, or reads it as being only about renting capacity out |
| Multi-tenant visitor lost | A multi-tenant participant does not find themselves in the destination |
| **Isolation overclaim** | **Any participant in step 7 says the page shows or promises that tenants or segments are isolated, secure, or proven safe. One occurrence is a defect: change the copy.** |
| Contact treated as peer | Participant goes to contact first, or does not see it as secondary |
| Benchmark attribution misread | In step 8, a participant cannot tell who measured the results, or believes Hedgehog measured them itself |
| No route fits | Participant's question from step 1 matches none of the routes. This is the most valuable finding |

## Reading the result (agree this before running)

- With five people, treat every defect as a finding, not a vote. One person misreading the copy rule is enough to act on.
- Do not read a route's share of first clicks as validation or failure. Equal shares are not automatically ambiguous, and unequal shares are not automatically validation.
- **Journey is working** if most participants reach a relevant answer **and** a useful next step on at least one route, nobody hits the CTA mismatch or the isolation overclaim, and everyone who wants to download can. If most clicks are only clicks, the menu has moved the dead end and the destinations need work, not the entry.
- Record, per route, how many participants found an answer, how many only clicked, and how many had a next step.
