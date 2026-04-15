# Issue #405 Verification — Shadow DynamoDB Tables

**Date:** 2026-04-12 (rev 2 — shadow-only env var scoping)
**Branch:** issue-405-shadow-dynamodb-tables
**Stage deployed:** shadow

---

## Goal

Provision three shadow-only DynamoDB tables for the completion framework, wire shadow-stage environment variables into Lambda, and keep production/non-shadow stages unaffected — including ensuring the table-name env vars are absent outside shadow.

---

## DynamoDB Tables — AWS Status

All three tables confirmed ACTIVE in us-west-2:

| Table | Status | Billing | SSE | PITR |
|---|---|---|---|---|
| hedgehog-learn-task-records-shadow | ACTIVE | PAY_PER_REQUEST | Enabled | ENABLED |
| hedgehog-learn-task-attempts-shadow | ACTIVE | PAY_PER_REQUEST | Enabled | ENABLED |
| hedgehog-learn-entity-completions-shadow | ACTIVE | PAY_PER_REQUEST | Enabled | ENABLED |

PITR status verified via `aws dynamodb describe-continuous-backups`.

---

## Lambda Environment Variables (shadow stage)

Confirmed via `aws lambda get-function-configuration --function-name hedgehog-learn-shadow-api`:

```
APP_STAGE: shadow
TASK_RECORDS_TABLE: hedgehog-learn-task-records-shadow
TASK_ATTEMPTS_TABLE: hedgehog-learn-task-attempts-shadow
ENTITY_COMPLETIONS_TABLE: hedgehog-learn-entity-completions-shadow
```

---

## Shadow-Only Env Var Scoping (rev 2 fix)

The three table env vars are now scoped via Serverless Framework v3 `params` block:

```yaml
params:
  shadow:
    taskRecordsTable: ${self:service}-task-records-shadow
    taskAttemptsTable: ${self:service}-task-attempts-shadow
    entityCompletionsTable: ${self:service}-entity-completions-shadow
  default:
    taskRecordsTable: ''
    taskAttemptsTable: ''
    entityCompletionsTable: ''
```

`provider.environment` references them as `${param:taskRecordsTable}` etc.

**Resolution verified by packaging both stages and inspecting the CloudFormation templates:**

Dev stage (`APP_STAGE=dev`):
```
TASK_RECORDS_TABLE: ''
TASK_ATTEMPTS_TABLE: ''
ENTITY_COMPLETIONS_TABLE: ''
```

Shadow stage (`APP_STAGE=shadow`):
```
TASK_RECORDS_TABLE: hedgehog-learn-task-records-shadow
TASK_ATTEMPTS_TABLE: hedgehog-learn-task-attempts-shadow
ENTITY_COMPLETIONS_TABLE: hedgehog-learn-entity-completions-shadow
```

Shadow table names are never injected into dev or prod Lambda runtime configuration.

---

## Stage Isolation — DynamoDB Tables

CloudFormation Condition `IsShadowStage: !Equals ['${sls:stage}', 'shadow']` gates all three tables. Tables only provisioned when deploying the shadow stack. Dev/prod stacks do not create these tables.

IAM statements use hardcoded `Fn::Sub` ARNs (not `Fn::GetAtt`) so the policy deploys safely to all stages without referencing conditionally non-existent resources.

---

## Files Changed

- `serverless.yml` — four edits:
  1. Added `params` block at top with per-stage resolution for the three table params
  2. Added `APP_STAGE` to `provider.environment`
  3. Added `TASK_RECORDS_TABLE/TASK_ATTEMPTS_TABLE/ENTITY_COMPLETIONS_TABLE` using `${param:...}` references
  4. Added IAM statement for shadow table access using `Fn::Sub` ARNs
  5. Added `Conditions.IsShadowStage` and three `AWS::DynamoDB::Table` resources with `Condition: IsShadowStage`

- `infrastructure/dynamodb/task-records-shadow-table.json` — schema doc
- `infrastructure/dynamodb/task-attempts-shadow-table.json` — schema doc
- `infrastructure/dynamodb/entity-completions-shadow-table.json` — schema doc

---

## Production Impact

None. DynamoDB tables are gated by `Condition: IsShadowStage` (absent from dev/prod stacks). Table-name env vars resolve to empty string in dev/prod — shadow table names are not present in non-shadow Lambda runtime config.
