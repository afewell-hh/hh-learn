import { getHubSpotClient } from '../shared/hubspot.js';
import fs from 'node:fs';

(async () => {
  const hubspot = getHubSpotClient();
  // TODO: read local MD/JSON, upsert rows into HubDB via CMS/HUBDB API.
  // This is a placeholder to keep the script wire-up ready.
  const schemas = ['labs', 'modules', 'pathways'].map((n) =>
    JSON.parse(fs.readFileSync(`hubdb-schemas/${n}.schema.json`, 'utf8')),
  );
  console.log('Loaded schemas:', schemas.map((s) => s.name).join(', '));
})();
