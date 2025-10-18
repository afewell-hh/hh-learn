#!/bin/bash
set -e

START_TIME=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)

echo "Checking Lambda Duration metrics..."
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=hedgehog-learn-dev-api \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Average,Maximum \
  --region us-west-2 \
  --output json > verification-output/issue-188/cloudwatch-lambda-duration-24h.json

echo "Checking API Gateway Latency metrics..."
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiId,Value=hvoog2lnha \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Average,Maximum,Minimum \
  --region us-west-2 \
  --output json > verification-output/issue-188/cloudwatch-apigateway-latency-24h.json

echo "Checking Lambda Errors..."
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=hedgehog-learn-dev-api \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --region us-west-2 \
  --output json > verification-output/issue-188/cloudwatch-lambda-errors-24h.json

echo "Done! Check verification-output/issue-188/ for results."
