# Issue #298 Verification: Hide Quiz Answers Behind click-to-reveal

## Date
2026-04-15

## Summary

Six NLH module README.md files were reviewed. Three already had `<details>` blocks in their Assessment sections (no changes needed). Three required edits to wrap answer/explanation content behind `<details><summary>Show Answer</summary>...</details>` blocks.

## Modules Updated (edits applied)

| Module | File | Questions Wrapped |
|--------|------|-------------------|
| fabric-operations-welcome | content/modules/fabric-operations-welcome/README.md | 5 |
| fabric-operations-how-it-works | content/modules/fabric-operations-how-it-works/README.md | 5 |
| fabric-operations-mastering-interfaces | content/modules/fabric-operations-mastering-interfaces/README.md | 6 |

## Modules Already Compliant (no changes needed)

| Module | File | Notes |
|--------|------|-------|
| fabric-operations-diagnosis-lab | content/modules/fabric-operations-diagnosis-lab/README.md | Already had `<details>` blocks |
| fabric-operations-post-incident-review | content/modules/fabric-operations-post-incident-review/README.md | Already had `<details>` blocks |
| fabric-operations-rollback-recovery | content/modules/fabric-operations-rollback-recovery/README.md | Already had `<details>` blocks |

## Edit Pattern Applied

For each quiz question in the Assessment section, the answer and explanation text (everything from `**Correct Answer:**` / `**Answer:**` through the explanation and rubric) was wrapped as follows:

```markdown
<details>
<summary>Show Answer</summary>

**Correct Answer:** X

**Explanation:**
...

</details>

---
```

Rules followed:
- Question text and answer options left visible (outside `<details>`)
- `---` separator kept outside (after `</details>`)
- Practical Assessment success criteria (✅ instructions) left unwrapped — these are task instructions, not answers
- No `<details>` nesting introduced
- Nothing outside `## Assessment` sections was modified

## Content Sync

`npm run sync:content` was run after all edits and completed successfully:

- 20 modules updated in HubDB
- 3 archived modules soft-tagged
- HubDB table published

Sync output confirmed: `Summary: 20 succeeded, 0 failed`
