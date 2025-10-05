# Architecture Overview

**CMS/UI**: HubSpot CMS (Clean.Pro), pages under `/learn`, HubDB-driven lists/detail.
**Logic**: AWS Lambda + API Gateway (cheap/elastic).
**CRM**: HubSpot custom objects + custom behavioral events.

**MVP Endpoints**
- POST /events/track    -> record behavioral events, upsert progress objects
- POST /quiz/grade      -> grade answers from `quiz_schema_json` (HubDB), emit completion

**Future**
- /certificate/issue    -> generate PDF (HTML->PDF), store in S3, write URL to enrollment object
- Optional migrate logic to HubSpot serverless if plan upgrades to Content Hub Enterprise.
