# Fabric Operator replay — provenance ledger

Every expert-visible command/output line in `scenario.v1.json` is anchored to an exact,
validated block in a real NLH curriculum module. `npm run validate:scenario` (and the
`experience-scenario-real` jest test) enforce this in CI: schema + dual-source exact-block
anti-drift + `validated_on` reconciliation + fact-lint + composite-continuity. If a cited
module is re-validated or restructured, the check fails until this scenario is refreshed.

**Content-freshness owner:** hh-learn lead / project lead (until delegated).

**Honesty:** this is an Option A **composite** replay — chapters are separately-validated real
workflows across different fabrics, with explicit on-screen transitions. No entity was renamed
and no output was invented (`continuity: "composite"`; see #479/#480/#482 and the #485 decision).

## Chapter → source map

| Act | Step | Source module | validated_on | Anchor (heading) | Block |
|-----|------|---------------|--------------|------------------|-------|
| provision | apply-vpc (cmd) | fabric-operations-vpc-provisioning | 2025-10-16 | Step 2: Apply VPC Configuration | bash #0, exact-line |
| provision | apply-vpc (out) | fabric-operations-vpc-provisioning | 2025-10-16 | Step 2: Apply VPC Configuration | text #0, exact-block |
| provision | verify-agents (cmd) | fabric-operations-vpc-provisioning | 2025-10-16 | Step 4: Verify Reconciliation via Agent Status | bash #0, exact-line |
| attach | apply-attach (cmd) | fabric-operations-vpc-attachments | 2025-10-16 | Create VPCAttachment for server-01 | bash #1, exact-line |
| attach | apply-attach (out) | fabric-operations-vpc-attachments | 2025-10-16 | Create VPCAttachment for server-01 | text #0, exact-block |
| validate | list-vpcs (cmd) | fabric-operations-connectivity-validation | 2025-10-16 | Step 1: Review Deployed Infrastructure | bash #0, exact-line |
| validate | list-attachments (cmd) | fabric-operations-connectivity-validation | 2025-10-16 | Step 1: Review Deployed Infrastructure | bash #1, exact-line |
| break | break-note | — (narrative transition; no source) | — | — | — |
| diagnose | diagnose-intro | — (narrative transition; no source) | — | — | — |
| diagnose | inspect-attachment (cmd) | fabric-operations-diagnosis-lab | 2025-10-17 | Step 2.1: Check VPCAttachment Configuration | bash #0, exact-line |
| recover | recover-intro | — (narrative transition; no source) | — | — | — |
| recover | git-revert (cmd) | fabric-operations-rollback-recovery | 2025-10-17 | Step 2: Revert the Commit (Git) | bash #0, exact-line |
| recover | verify-vlan (cmd) | fabric-operations-rollback-recovery | 2025-10-17 | Step 4: Verify Rollback | bash #0, exact-line |

## Composite-arc entity transitions (honest, on-screen)

- provision / attach / validate operate on **webapp-prod** (Course 2, validated 2025-10-16).
- break / recover operate on **webapp-vpc** (Troubleshooting course, validated 2025-10-17).
- diagnose operates on **customer-app-vpc / server-07** (Troubleshooting course, validated 2025-10-17).

Each entity switch is introduced by a narrative-only transition step (`break-note`,
`diagnose-intro`, `recover-intro`), enforced by the continuity gate so the shift is never silent.

## Not cited

The replay does **not** cite the `fabric-operations-vpc-provisioning` "Lab Summary" lines corrected
under #481 — provenance anchors point only at the validated Step blocks.
