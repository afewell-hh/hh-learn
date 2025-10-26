/**
 * Helper utilities for cleaning up test data in HubSpot CRM
 *
 * These utilities help manage test contact state between test runs,
 * allowing for idempotent and repeatable API smoke tests.
 *
 * Usage:
 *   import { resetContactProgress, deleteTestEnrollments } from './helpers/hubspot-cleanup';
 */

import { Client } from '@hubspot/api-client';

/**
 * Get HubSpot client using environment token
 */
export function getHubSpotClient(): Client {
  const token =
    process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||
    process.env.HUBSPOT_API_TOKEN ||
    process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error(
      'No HubSpot access token available. Set HUBSPOT_PROJECT_ACCESS_TOKEN, ' +
      'HUBSPOT_API_TOKEN, or HUBSPOT_PRIVATE_APP_TOKEN environment variable.'
    );
  }

  return new Client({ accessToken: token });
}

/**
 * Find contact by email
 */
export async function findContactByEmail(email: string): Promise<string | null> {
  const client = getHubSpotClient();

  try {
    const searchResponse = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ' as any,
          value: email,
        }],
      }],
      properties: ['email'],
      limit: 1,
      after: undefined,
      sorts: [],
    } as any);

    if (!searchResponse.results || searchResponse.results.length === 0) {
      return null;
    }

    return searchResponse.results[0].id;
  } catch (error) {
    console.error(`Failed to find contact: ${error}`);
    return null;
  }
}

/**
 * Reset contact progress properties to empty/initial state
 *
 * This clears the hhl_progress_state custom property, effectively
 * resetting the contact's learning progress to a clean slate.
 *
 * @param email - Contact email address
 * @returns true if reset was successful, false otherwise
 */
export async function resetContactProgress(email: string): Promise<boolean> {
  const client = getHubSpotClient();

  try {
    // Find contact ID
    const contactId = await findContactByEmail(email);
    if (!contactId) {
      console.warn(`Contact not found for email: ${email}`);
      return false;
    }

    // Reset progress properties
    await client.crm.contacts.basicApi.update(contactId, {
      properties: {
        hhl_progress_state: JSON.stringify({ modules: {}, pathways: {}, courses: {} }),
        hhl_progress_updated_at: new Date().toISOString().split('T')[0],
        hhl_progress_summary: 'Reset for testing',
      },
    });

    console.log(`✓ Reset progress for contact: ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to reset contact progress: ${error}`);
    return false;
  }
}

/**
 * Clear specific module progress from contact
 *
 * This removes a specific module from the progress state without
 * clearing all progress.
 *
 * @param email - Contact email address
 * @param moduleSlugs - Array of module slugs to clear
 * @returns true if successful, false otherwise
 */
export async function clearModuleProgress(
  email: string,
  moduleSlugs: string[]
): Promise<boolean> {
  const client = getHubSpotClient();

  try {
    const contactId = await findContactByEmail(email);
    if (!contactId) {
      console.warn(`Contact not found for email: ${email}`);
      return false;
    }

    // Get current progress state
    const contact = await client.crm.contacts.basicApi.getById(contactId, ['hhl_progress_state']);
    let progressState: any = { modules: {}, pathways: {}, courses: {} };

    try {
      if (contact.properties.hhl_progress_state) {
        progressState = JSON.parse(contact.properties.hhl_progress_state);
      }
    } catch (err) {
      console.warn('Failed to parse existing progress state, starting fresh');
    }

    // Remove specified modules
    // Ensure modules object exists before attempting deletion
    progressState.modules ??= {};
    moduleSlugs.forEach(slug => {
      delete progressState.modules[slug];
    });

    // Update contact
    await client.crm.contacts.basicApi.update(contactId, {
      properties: {
        hhl_progress_state: JSON.stringify(progressState),
        hhl_progress_updated_at: new Date().toISOString().split('T')[0],
      },
    });

    console.log(`✓ Cleared ${moduleSlugs.length} module(s) for contact: ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to clear module progress: ${error}`);
    return false;
  }
}

/**
 * Delete test enrollments from contact progress
 *
 * This removes enrollments with specific slugs from the contact's
 * progress state. Useful for cleaning up test data.
 *
 * @param email - Contact email address
 * @param options - Object with pathwaySlugs and/or courseSlugs arrays
 * @returns true if successful, false otherwise
 */
export async function deleteTestEnrollments(
  email: string,
  options: { pathwaySlugs?: string[]; courseSlugs?: string[] }
): Promise<boolean> {
  const client = getHubSpotClient();

  try {
    const contactId = await findContactByEmail(email);
    if (!contactId) {
      console.warn(`Contact not found for email: ${email}`);
      return false;
    }

    // Get current progress state
    const contact = await client.crm.contacts.basicApi.getById(contactId, ['hhl_progress_state']);
    let progressState: any = { modules: {}, pathways: {}, courses: {} };

    try {
      if (contact.properties.hhl_progress_state) {
        progressState = JSON.parse(contact.properties.hhl_progress_state);
      }
    } catch (err) {
      console.warn('Failed to parse existing progress state, starting fresh');
    }

    // Remove specified pathways
    if (options.pathwaySlugs) {
      // Ensure pathways object exists before attempting deletion
      progressState.pathways ??= {};
      options.pathwaySlugs.forEach(slug => {
        delete progressState.pathways[slug];
      });
    }

    // Remove specified courses
    if (options.courseSlugs) {
      // Ensure courses object exists before attempting deletion
      progressState.courses ??= {};
      options.courseSlugs.forEach(slug => {
        delete progressState.courses[slug];
      });
    }

    // Update contact
    await client.crm.contacts.basicApi.update(contactId, {
      properties: {
        hhl_progress_state: JSON.stringify(progressState),
        hhl_progress_updated_at: new Date().toISOString().split('T')[0],
      },
    });

    console.log(`✓ Deleted test enrollments for contact: ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete test enrollments: ${error}`);
    return false;
  }
}

/**
 * Get contact's current progress state
 *
 * Helper to inspect contact progress during debugging.
 *
 * @param email - Contact email address
 * @returns Progress state object or null if not found
 */
export async function getContactProgress(email: string): Promise<any | null> {
  const client = getHubSpotClient();

  try {
    const contactId = await findContactByEmail(email);
    if (!contactId) {
      return null;
    }

    const contact = await client.crm.contacts.basicApi.getById(contactId, [
      'hhl_progress_state',
      'hhl_progress_updated_at',
      'hhl_progress_summary',
    ]);

    let progressState: any = null;
    try {
      if (contact.properties.hhl_progress_state) {
        progressState = JSON.parse(contact.properties.hhl_progress_state);
      }
    } catch (err) {
      console.warn('Failed to parse progress state');
    }

    return {
      state: progressState,
      updatedAt: contact.properties.hhl_progress_updated_at,
      summary: contact.properties.hhl_progress_summary,
    };
  } catch (error) {
    console.error(`Failed to get contact progress: ${error}`);
    return null;
  }
}

/**
 * Create or update a test contact
 *
 * Ensures a test contact exists with specific properties.
 * Useful for setting up known test state.
 *
 * @param email - Contact email address
 * @param properties - Additional contact properties
 * @returns Contact ID or null if failed
 */
export async function ensureTestContact(
  email: string,
  properties: Record<string, any> = {}
): Promise<string | null> {
  const client = getHubSpotClient();

  try {
    // Check if contact exists
    let contactId = await findContactByEmail(email);

    if (contactId) {
      // Update existing contact
      await client.crm.contacts.basicApi.update(contactId, { properties });
      console.log(`✓ Updated test contact: ${email}`);
    } else {
      // Create new contact
      const response = await client.crm.contacts.basicApi.create({
        properties: {
          email,
          ...properties,
        },
        associations: [],
      });
      contactId = response.id;
      console.log(`✓ Created test contact: ${email}`);
    }

    return contactId;
  } catch (error) {
    console.error(`Failed to ensure test contact: ${error}`);
    return null;
  }
}
