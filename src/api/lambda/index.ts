import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { getHubSpotClient } from '../../shared/hubspot.js';
import type { TrackEventInput, QuizGradeInput, QuizGradeResult } from '../../shared/types.js';

const ok = (body: unknown = {}) => ({ statusCode: 200, body: JSON.stringify(body) });
const bad = (code: number, msg: string) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const path = (event.rawPath || '').toLowerCase();
    if (event.requestContext.http.method !== 'POST') return bad(405, 'POST only');

    if (path.endsWith('/events/track')) return await track(event.body || '');
    if (path.endsWith('/quiz/grade')) return await grade(event.body || '');

    return bad(404, 'Not found');
  } catch (err: any) {
    console.error('Handler error', err);
    return bad(500, 'Internal error');
  }
};

async function track(raw: string) {
  const schema = z.object({
    eventName: z.enum([
      'learning_module_started',
      'learning_module_completed',
      'learning_pathway_enrolled',
    ]),
    contactIdentifier: z
      .object({
        email: z.string().email().optional(),
        contactId: z.string().optional(),
      })
      .optional(),
    payload: z.record(z.any()).optional(),
  });

  const parse = schema.safeParse(JSON.parse(raw || '{}'));
  if (!parse.success) return bad(400, 'Invalid payload');

  const input = parse.data as TrackEventInput;

  // Check if CRM persistence is enabled
  const enableCrmProgress = process.env.ENABLE_CRM_PROGRESS === 'true';

  if (!enableCrmProgress) {
    // Anonymous mode - just log
    console.log('Track event (anonymous)', input.eventName, input.payload);
    return ok({ status: 'logged', mode: 'anonymous' });
  }

  // CRM persistence enabled - require contact identifier
  if (!input.contactIdentifier?.email && !input.contactIdentifier?.contactId) {
    console.log('Track event (no identity)', input.eventName);
    return ok({ status: 'logged', mode: 'anonymous' });
  }

  try {
    const hubspot = getHubSpotClient();

    // Send custom behavioral event completion to HubSpot
    // Event names in HubSpot must be prefixed with portal ID, but we'll use a generic event approach
    // See: https://developers.hubspot.com/docs/guides/api/analytics-and-events/custom-events/custom-event-completions

    const eventData: any = {
      eventName: input.eventName,
      occurredAt: new Date(), // Use Date object, not ISO string
      properties: {
        ...(input.payload || {}),
      },
    };

    // Identify contact by email or contactId
    if (input.contactIdentifier.email) {
      eventData.email = input.contactIdentifier.email;
    } else if (input.contactIdentifier.contactId) {
      eventData.objectId = input.contactIdentifier.contactId;
    }

    // Send event to HubSpot (v11 client)
    await hubspot.events.send.behavioralEventsTrackingApi.send(eventData as any);

    console.log('Track event (persisted)', input.eventName, input.contactIdentifier);
    return ok({ status: 'persisted', mode: 'authenticated' });
  } catch (err: any) {
    console.error('Failed to persist event to CRM:', err.message || err);
    // Return success even if CRM persistence fails - don't break user experience
    return ok({ status: 'logged', mode: 'fallback', error: err.message });
  }
}

async function grade(raw: string) {
  const schema = z.object({
    module_slug: z.string().min(1),
    answers: z.array(z.object({ id: z.string(), value: z.any() })),
  });

  const parse = schema.safeParse(JSON.parse(raw || '{}'));
  if (!parse.success) return bad(400, 'Invalid payload');

  const input = parse.data as QuizGradeInput;

  // TODO: fetch quiz schema from HubDB (modules.quiz_schema_json) and compute score.
  // Placeholder logic:
  const result: QuizGradeResult = { score: 100, pass: true };
  console.log('Graded module', input.module_slug, '=>', result);

  // Optionally emit completion event
  return ok(result);
}
