# Issue #405 Verification — Shadow DynamoDB Tables

**Date:** 2026-04-12
**Branch:** issue-405-shadow-dynamodb-tables
**Stage deployed:** shadow

---

## Goal

Provision three shadow-only DynamoDB tables for the completion framework, wire shadow-stage environment variables into Lambda, and keep production/non-shadow stages unaffected.

---

## DynamoDB Tables — AWS Status

All three tables confirmed ACTIVE in us-west-2:

| Table | Status | Billing | SSE | PITR |
|---|---|---|---|---|
| hedgehog-learn-task-records-shadow | ACTIVE | PAY_PER_REQUEST | Enabled | ENABLED |
| hedgehog-learn-task-attempts-shadow | ACTIVE | PAY_PER_REQUEST | Enabled | ENABLED |
| hedgehog-learn-entity-completions-shadow | ACTIVE | PAY_PER_REQUEST | Enabled | ENABLED |

PITR status verified via `aws dynamodb describe-continuous-backups` (not `describe-table`, which shows DISABLED until first write).

---

## Lambda Environment Variables

Confirmed via `aws lambda get-function-configuration --function-name hedgehog-learn-shadow-api`:

```
APP_STAGE: shadow
TASK_RECORDS_TABLE: hedgehog-learn-task-records-shadow
TASK_ATTEMPTS_TABLE: hedgehog-learn-task-attempts-shadow
ENTITY_COMPLETIONS_TABLE: hedgehog-learn-entity-completions-shadow
ENABLE_TEST_BYPASS: false
```

`APP_STAGE: shadow` ensures all completion framework Lambda guards (`process.env.APP_STAGE !== 'shadow'`) pass correctly at runtime.

---

## Stage Isolation Verification

CloudFormation Condition `IsShadowStage: !Equals ['${sls:stage}', 'shadow']` gates all three tables.

Verified by packaging both stages before deploy:
- **dev stage:** `Fn::Equals: ['dev', 'shadow']` → condition false → tables not created
- **shadow stage:** `Fn::Equals: ['shadow', 'shadow']` → condition true → tables created

IAM statements use hardcoded `Fn::Sub` ARNs (not `Fn::GetAtt`) so the policy deploys safely to all stages without referencing conditionally non-existent resources.

---

## Files Changed

- `serverless.yml` — three edits:
  1. Added `APP_STAGE`, `TASK_RECORDS_TABLE`, `TASK_ATTEMPTS_TABLE`, `ENTITY_COMPLETIONS_TABLE` to `provider.environment`
  2. Added IAM statement for shadow table access using `Fn::Sub` ARNs
  3. Added `Conditions.IsShadowStage` and three `AWS::DynamoDB::Table` resources with `Condition: IsShadowStage`

- `infrastructure/dynamodb/task-records-shadow-table.json` — schema doc
- `infrastructure/dynamodb/task-attempts-shadow-table.json` — schema doc
- `infrastructure/dynamodb/entity-completions-shadow-table.json` — schema doc

---

## Production Impact

None. The three new DynamoDB tables are shadow-only (CloudFormation Condition). The new env vars are present in production Lambda but only used when code checks `APP_STAGE === 'shadow'` first. IAM policy grants access to shadow table ARNs in all stages, which is harmless since those tables only exist in the shadow stack.
