/**
 * HHL Membership Identity Bootstrapper (Issue #234)
 *
 * This module detects HubSpot CMS membership logins client-side and provides
 * a unified API for downstream scripts to access authenticated user identity.
 *
 * ## Features
 * - Fetches membership profile from HubSpot CMS API once per page load
 * - Emits `hhl:identity` custom event with { email, contactId } when resolved
 * - Provides promise-based API via `window.hhIdentity.ready`
 * - Provides synchronous access via `window.hhIdentity.get()` after resolution
 * - Gracefully handles anonymous sessions (returns empty email/contactId)
 * - Caches result in memory to prevent duplicate network requests
 * - Privacy-safe debug logging when HHL_DEBUG is enabled
 *
 * ## Usage
 *
 * ### Promise-based (Recommended)
 * ```javascript
 * window.hhIdentity.ready.then(function(identity) {
 *   if (identity.email) {
 *     console.log('User is authenticated:', identity.email);
 *   } else {
 *     console.log('User is anonymous');
 *   }
 * });
 * ```
 *
 * ### Event-based
 * ```javascript
 * document.addEventListener('hhl:identity', function(event) {
 *   var identity = event.detail; // { email: '', contactId: '' }
 *   // Use identity here
 * });
 * ```
 *
 * ### Synchronous (after ready resolves)
 * ```javascript
 * var identity = window.hhIdentity.get();
 * if (identity) {
 *   // Identity is available
 * }
 * ```
 *
 * ## Related Issues
 * - Issue #234: Implement membership identity bootstrapper
 * - Issue #233: Membership login regression on Learn pages
 * - Issue #237: Membership session instrumentation
 *
 * @module auth-context
 */
(function() {
  'use strict';

  // Check if already initialized (prevent double-loading)
  if (window.hhIdentity) {
    if (window.hhDebug && window.hhDebug.enabled) {
      window.hhDebug.warn('auth-context', 'Already initialized, skipping');
    }
    return;
  }

  var debug = localStorage.getItem('HHL_DEBUG') === 'true';

  /**
   * Identity state
   * Cached in memory to prevent duplicate API calls
   */
  var identityCache = null;
  var identityResolved = false;
  var identityPromise = null;

  /**
   * Fetch membership profile from HubSpot CMS API
   * Returns { email: string, contactId: string } or null on error
   *
   * @returns {Promise<Object>}
   */
  function fetchMembershipProfile() {
    var apiUrl = '/_hcms/api/membership/v1/profile';

    if (debug && window.hhDebug) {
      window.hhDebug.log('auth-context', 'Fetching membership profile from ' + apiUrl);
    }

    return fetch(apiUrl, {
      method: 'GET',
      credentials: 'include', // Include session cookies
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(function(response) {
        if (response.ok) {
          return response.json().then(function(data) {
            if (debug && window.hhDebug) {
              window.hhDebug.log('auth-context', 'Profile API success', {
                hasEmail: !!data.email,
                hasContactId: !!(data.contactId || data.vid || data.hs_object_id)
              });
            }

            // Extract contact ID (try multiple field names for compatibility)
            var contactId = data.contactId ||
                           data.hs_object_id ||
                           data.vid ||
                           '';

            // Convert to string if numeric
            if (contactId && typeof contactId === 'number') {
              contactId = String(contactId);
            }

            return {
              email: data.email || '',
              contactId: contactId
            };
          });
        } else if (response.status === 404) {
          // 404 = No membership session (anonymous user)
          if (debug && window.hhDebug) {
            window.hhDebug.log('auth-context', 'Profile API returned 404 - anonymous session');
          }
          return { email: '', contactId: '' };
        } else {
          // Other error status
          if (debug && window.hhDebug) {
            window.hhDebug.warn('auth-context', 'Profile API error status: ' + response.status);
          }
          return { email: '', contactId: '' };
        }
      })
      .catch(function(error) {
        // Network error or other fetch failure
        if (debug && window.hhDebug) {
          window.hhDebug.error('auth-context', 'Profile API fetch failed', error.message);
        }
        return { email: '', contactId: '' };
      });
  }

  /**
   * Initialize identity detection
   * Fetches profile and caches result
   *
   * @returns {Promise<Object>}
   */
  function initIdentity() {
    // Return cached promise if already initialized
    if (identityPromise) {
      return identityPromise;
    }

    identityPromise = fetchMembershipProfile()
      .then(function(identity) {
        // Cache the identity
        identityCache = identity;
        identityResolved = true;

        if (debug && window.hhDebug) {
          window.hhDebug.log('auth-context', 'Identity resolved', {
            hasEmail: !!identity.email,
            hasContactId: !!identity.contactId,
            isAuthenticated: !!(identity.email || identity.contactId)
          });
        }

        // Emit custom event for downstream consumers
        try {
          // eslint-disable-next-line no-undef
          var event = new CustomEvent('hhl:identity', {
            detail: identity,
            bubbles: true,
            cancelable: false
          });
          document.dispatchEvent(event);

          if (debug && window.hhDebug) {
            window.hhDebug.log('auth-context', 'Dispatched hhl:identity event');
          }
        } catch (e) {
          // CustomEvent not supported in old browsers, use fallback
          if (debug && window.hhDebug) {
            window.hhDebug.warn('auth-context', 'CustomEvent not supported', e.message);
          }
        }

        return identity;
      });

    return identityPromise;
  }

  /**
   * Public API: window.hhIdentity
   *
   * Provides unified interface for accessing membership identity
   */
  window.hhIdentity = {
    /**
     * Promise that resolves when identity is detected
     * @type {Promise<Object>}
     *
     * @example
     * window.hhIdentity.ready.then(function(identity) {
     *   console.log('Email:', identity.email);
     *   console.log('Contact ID:', identity.contactId);
     * });
     */
    ready: null,

    /**
     * Get identity synchronously (returns null if not yet resolved)
     * @returns {Object|null} Identity object or null if not yet available
     *
     * @example
     * var identity = window.hhIdentity.get();
     * if (identity) {
     *   console.log('User is authenticated:', identity.email);
     * }
     */
    get: function() {
      if (!identityResolved) {
        if (debug && window.hhDebug) {
          window.hhDebug.warn('auth-context', 'Identity not yet resolved, returning null');
        }
        return null;
      }
      return identityCache;
    },

    /**
     * Check if identity has been resolved
     * @returns {boolean}
     */
    isReady: function() {
      return identityResolved;
    },

    /**
     * Check if user is authenticated (has email or contactId)
     * @returns {boolean|null} True if authenticated, false if anonymous, null if not yet resolved
     */
    isAuthenticated: function() {
      if (!identityResolved) return null;
      return !!(identityCache && (identityCache.email || identityCache.contactId));
    }
  };

  // Initialize immediately
  window.hhIdentity.ready = initIdentity();

  if (debug && window.hhDebug) {
    window.hhDebug.log('auth-context', 'Bootstrapper initialized');
  }

})();
