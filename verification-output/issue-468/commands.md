# Issue #468 — Post-deploy verification commands

**Pre-condition:** lead has confirmed that the production lambda
`hedgehog-learn-production-api` has been redeployed from main at or after
merge commit `009127530d3e5e37827859fbcde1a3ff5deea30c` (PR #467).

Until the lead confirms, do **not** run anything below.

## Step 1 — AWS env snapshot (proves the deployed function is the expected production function/config)

Run with operator AWS credentials in the production account:

```bash
aws lambda get-function-configuration \
  --function-name hedgehog-learn-production-api \
  --region us-west-2 \
  > verification-output/issue-468/lambda-config-snapshot.json

jq '{
  FunctionName,
  LastModified,
  Runtime,
  Version,
  CodeSha256,
  app_stage: .Environment.Variables.APP_STAGE,
  enable_test_bypass: .Environment.Variables.ENABLE_TEST_BYPASS
}' verification-output/issue-468/lambda-config-snapshot.json
```

Expected (the canonical safe-state for the dual guard):

| Key | Expected value |
| --- | --- |
| `APP_STAGE` | `production` |
| `ENABLE_TEST_BYPASS` | `false` (or unset / absent) |

> Note: even if `ENABLE_TEST_BYPASS=true` accidentally leaks back in, the new
> dual guard prevents bypass behavior because `APP_STAGE !== 'shadow'`.
> But the **safe-state** assertion is still "ENABLE_TEST_BYPASS is not true on prod".

## Step 2 — curl probe matrix (one command)

```bash
scripts/verify-issue-468-post-deploy.sh
```

Default arguments are wired to production:
- `--api-base` `https://api.hedgehog.cloud`
- `--out` `verification-output/issue-468/post-deploy-evidence.txt`
- `--cert-id` a fresh UUID for the nonexistent-certificate probe

To target a non-default base (e.g. for a dry run against the dev API):

```bash
scripts/verify-issue-468-post-deploy.sh \
  --api-base https://dev-api.hedgehog.cloud \
  --out verification-output/issue-468/dev-dry-run-evidence.txt
```

The script:
- captures `-i` headers + body for every probe into the evidence file,
- prints a PASS/FAIL summary table on stdout,
- exits 0 only if `S-PRIMARY` (the bypass-cookie probe on `/course/status`)
  returns the expected `401`. Other probes' drift is recorded but does
  not fail the script — see the README's drift observation.

## Step 3 — fill in the summary

Copy the template and complete it, citing both artifacts above:

```bash
cp verification-output/issue-468/post-deploy-summary.md.template \
   verification-output/issue-468/post-deploy-summary.md
$EDITOR verification-output/issue-468/post-deploy-summary.md
```

## Step 4 — post the verification comment on #468

The comment must include:
- timestamp of the AWS snapshot
- timestamp of the curl matrix
- explicit PASS/FAIL for `S-PRIMARY`
- per-probe verdict table
- pointers to both artifact files
- explicit statement whether the auth-side blocker for Layer 2 live
  verification is now cleared

## Tooling requirements

- `bash` (>= 4)
- `curl`
- `aws` CLI configured for the production account (Step 1 only)
- `jq` (Step 1 readability; the raw JSON is the authoritative artifact)
- `uuidgen` (optional; falls back to `/dev/urandom`)

No node, no playwright, no project install required — the harness is
intentionally portable so it can be run from any operator workstation.
