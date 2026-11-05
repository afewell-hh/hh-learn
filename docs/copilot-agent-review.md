# Model-selected independent review via the Copilot cloud agent

How this project obtains independent code/design review with an explicitly chosen
model. Verified working on `afewell-hh/hh-learn` on 2026-11-05.

## Two different products — pick the right one

| | Built-in Copilot PR reviewer | **Copilot cloud agent** |
|---|---|---|
| How | Request `Copilot` as a PR reviewer, or enable auto-review in settings | `gh agent-task` / `POST agents/repos/{owner}/{repo}/tasks` |
| Model selection | **No** | **Yes**, via a `model` field |
| Repo setting needed | Yes, must be enabled | No |
| Effort control | Lite / Balanced / Max (~$0.25 / $1.50 / $10 per review) | Controlled by the prompt |

**This project uses the cloud agent and deliberately does not use automated
built-in review**, because built-in review cannot specify a model. The lead
orchestrates reviews so the model is explicit and recorded. This matches the
convention across the other `afewell-hh` repos.

A previous attempt to add a workflow auto-requesting the built-in reviewer was
closed unmerged (PR #506) for this reason.

## Prerequisites

- **`gh` 2.102+.** `gh agent-task` is built in; there is no extension to install.
  This repo's host was on 2.4.0 (2022) and the subcommand simply did not exist —
  check `gh --version` first.
- **A user-to-server credential** (a `gho_` token from `gh auth login`), not an
  Actions `GITHUB_TOKEN`.
- An account entitled to Copilot. No repository setting is required.
- The feature is preview; verify availability rather than assuming it.

## Submitting a review

Build the JSON with `jq` and POST it. Note the prompt heredoc delimiter below is
`PROMPTEND`, not `EOF`, because review prompts frequently contain the string
`EOF` themselves:

```bash
REPO=afewell-hh/hh-learn
BRANCH=<candidate-branch>
SHA=$(git rev-parse "origin/$BRANCH")

read -r -d '' PROMPT <<'PROMPTEND'
Review-only task. Review commit <SHA> on branch <BRANCH> of <REPO>.
... criteria and prohibitions ...
PROMPTEND

jq -n --arg prompt "$PROMPT" --arg branch "$BRANCH" \
  '{prompt:$prompt,base_ref:$branch,model:"gpt-6.1-sol",create_pull_request:false}' \
  | gh api "agents/repos/$REPO/tasks" --method POST --input -
```

## Verify the model actually took effect

Requesting a model is not the same as getting one. Read the task back:

```bash
gh api "agents/repos/$REPO/tasks/$TASK_ID" \
  --jq '{state, sessions:[.sessions[]?|{id,model,state}]}'
```

`sessions[].model` must equal **`sweagent-capi:gpt-6.1-sol`**. A missing or
mismatched model is **not** confirmation — investigate entitlement or API errors
rather than silently accepting a fallback to Auto.

`sessions` is often empty immediately after submission; poll until it populates.

## Retrieve the report

Use the **full session UUID**, not the task id — they are different values and
this is an easy mistake:

```bash
gh agent-task view "$SESSION_UUID" --repo "$REPO" --log
```

`--log` alone is a point-in-time snapshot. For a bounded wait use
`--log --follow` with a finite timeout, or poll `sessions[0].state` until
`completed` / `failed`.

## Writing the prompt

The prompt is the whole review. Name:

- the **exact commit SHA** and branch;
- the **consequential sources** — which files actually matter, and what did not change;
- enough **context** for the reviewer to judge intent, including relevant API or
  platform semantics it cannot infer from the diff;
- **numbered criteria**, each wanting a per-criterion verdict, not just a list of
  whatever the reviewer noticed;
- a demand that satisfied criteria are stated explicitly rather than omitted — so
  silence is never ambiguous.

Then state the prohibitions explicitly: no edits, no commits or pushes, no opening
or modifying pull requests, no executing/building/importing/testing code, no
access to credentials or secrets, no cloud or infrastructure operations, no
delegation.

**"Review-only" is an instruction, not a security sandbox.** Verify afterwards
that the reviewer branch matches the candidate with no commits or files added.

## Recording a review

Post to the PR or issue: task id, session id, model **as confirmed in
`sessions[].model`**, reviewed SHA, the branch check, coverage, every finding with
severity, and the disposition of each. Record findings assessed as *satisfied* too,
not only defects.

**A new candidate commit requires a fresh review** of what changed. Applying
findings creates a new SHA, so the fixes themselves are unreviewed until you say so.

## Known limits

- `premium_requests` has come back `null`, so the API is not attributing usage.
  Session owner alone does not establish the billing payer.
- The reviewer sees the repository, not the wider environment. It cannot read
  local checkouts of other repos, so embed verified facts (with `file:line` and a
  pinned revision) in the prompt or the ticket.
- It can be wrong. In one round it inferred action defaults that reading the
  upstream source contradicted. Treat findings as expert input to verify, not
  verdicts to apply blindly.

## Why this is worth the cost

Across five reviews on this repo the process found real defects, **two of which
were introduced by the lead in the act of fixing the previous one**:

- A security control that gave **false assurance** — a probe treating every
  nonzero exit as proof of permission denial, when a disabled API or bad flag
  produced the identical "confirmed" result.
- A **HIGH** fork-PR code-execution path through a credentialed agent, reachable
  because PR conversation comments arrive as `issue_comment` in the base repo
  context, where fork protections do not apply.
- A **malformed tool allowlist**: `claude_args` is shell-tokenized, so an
  unquoted comma-separated list shredded every multi-word rule, and the
  "restriction" restricted nothing because supplied tools *merge* with defaults
  rather than replacing them.

Each was invisible to the author and cheap to find with a second reader.
