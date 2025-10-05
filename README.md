# Hedgehog Learn
Learning platform for hedgehog.cloud (HubSpot CMS + Clean.Pro). Logic on AWS Lambda.
- CMS: HubSpot (pages/templates/modules/HubDB)
- Logic: AWS Lambda + API Gateway (events, quiz grading, certificates)
- CRM: HubSpot (custom objects + behavioral events) via @hubspot/api-client

## Quick start
- `npm i`
- Copy `.env.example` to `.env` and fill values
- `npm run build` (TypeScript -> dist)
- (Optional) Deploy Lambda via the Serverless Framework: `npm run deploy:aws`
