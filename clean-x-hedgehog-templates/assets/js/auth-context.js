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
  var STORED_IDENTITY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  function updateAuthContextDom(identity) {
    var node = document.getElementById('hhl-auth-context');
    if (!node) return;
    try {
      var email = identity && identity.email ? identity.email : '';
      var contactId = identity && identity.contactId ? String(identity.contactId) : '';
      if (typeof node.setAttribute === 'function') {
        node.setAttribute('data-email', email);
        node.setAttribute('data-contact-id', contactId);
        if (identity && identity.firstname) {
          node.setAttribute('data-firstname', identity.firstname);
        } else {
          node.removeAttribute('data-firstname');
        }
        if (identity && identity.lastname) {
          node.setAttribute('data-lastname', identity.lastname);
        } else {
          node.removeAttribute('data-lastname');
        }
      }
    } catch (err) {
      if (debug && window.hhDebug) {
        window.hhDebug.warn('auth-context', 'Failed to update auth context DOM', err && err.message ? err.message : err);
      }
    }
  }

  function emitIdentityEvent(identity) {
    if (typeof document === 'undefined') return;
    try {
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        var modernEvent = new window.CustomEvent('hhl:identity', {
          detail: identity,
          bubbles: true,
          cancelable: false
        });
        document.dispatchEvent(modernEvent);
        if (debug && window.hhDebug) {
          window.hhDebug.log('auth-context', 'Dispatched hhl:identity event');
        }
        return;
      }
      if (typeof document.createEvent === 'function') {
        var legacyEvent = document.createEvent('CustomEvent');
        if (legacyEvent && legacyEvent.initCustomEvent) {
          legacyEvent.initCustomEvent('hhl:identity', true, false, identity);
          document.dispatchEvent(legacyEvent);
          if (debug && window.hhDebug) {
            window.hhDebug.log('auth-context', 'Dispatched hhl:identity event (legacy)');
          }
        }
      }
    } catch (e) {
      if (debug && window.hhDebug) {
        window.hhDebug.warn('auth-context', 'Failed to dispatch hhl:identity event', e && e.message ? e.message : e);
      }
    }
  }

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
   * Helper function to get constants.json configuration
   * @param {Object} opts - Options object with constantsUrl
   * @param {Function} callback - Callback function
   */
  function getConstants(opts, callback) {
    var constantsUrl = opts.constantsUrl || '/learn/config/constants.json';
    fetch(constantsUrl)
      .then(function(response) {
        if (!response.ok) throw new Error('Failed to fetch constants');
        return response.json();
      })
      .then(callback)
      .catch(function(err) {
        if (debug && window.hhDebug) {
          window.hhDebug.error('auth-context', 'Failed to load constants', err.message);
        }
        callback(null);
      });
  }

  /**
   * Check if stored JWT token is valid and not expired
   * @returns {string|null} Token string or null if invalid/expired
   */
  function checkStoredToken() {
    try {
      var token = localStorage.getItem('hhl_auth_token');
      var expires = localStorage.getItem('hhl_auth_token_expires');

      if (!token || !expires) {
        return null;
      }

      // Check expiry (with 15-minute buffer for refresh)
      var expiryTime = parseInt(expires, 10);
      var bufferMs = 15 * 60 * 1000; // 15 minutes

      if (Date.now() >= (expiryTime - bufferMs)) {
        // Token expired or about to expire
        localStorage.removeItem('hhl_auth_token');
        localStorage.removeItem('hhl_auth_token_expires');
        localStorage.removeItem('hhl_identity_from_jwt');
        return null;
      }

      return token;
    } catch (e) {
      if (debug && window.hhDebug) {
        window.hhDebug.warn('auth-context', 'Failed to check stored token', e.message);
      }
      return null;
    }
  }

  /**
   * Attempt to login with email-only authentication via JWT
   * Returns JWT token from Lambda /auth/login endpoint
   * @param {string} email - User email address
   * @param {string} constantsUrl - URL to constants.json
   * @returns {Promise<Object>} Identity object with email, contactId, etc.
   */
  function attemptJWTLogin(email, constantsUrl) {
    return new Promise(function(resolve, reject) {
      getConstants({ constantsUrl: constantsUrl }, function(constants) {
        if (!constants || !constants.AUTH_LOGIN_URL) {
          reject(new Error('AUTH_LOGIN_URL not configured in constants'));
          return;
        }

        if (debug && window.hhDebug) {
          window.hhDebug.log('auth-context', 'Attempting JWT login for ' + email);
        }

        fetch(constants.AUTH_LOGIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({ email: email })
        })
        .then(function(response) {
          if (!response.ok) {
            return response.json().then(function(err) {
              throw new Error(err.error || 'Login failed');
            });
          }
          return response.json();
        })
        .then(function(data) {
          // Store JWT token
          try {
            localStorage.setItem('hhl_auth_token', data.token);
            localStorage.setItem('hhl_auth_token_expires', Date.now() + (24 * 60 * 60 * 1000));
            localStorage.setItem('hhl_identity_from_jwt', JSON.stringify({
              email: data.email || email,
              contactId: String(data.contactId || ''),
              firstname: data.firstname || '',
              lastname: data.lastname || ''
            }));

            if (debug && window.hhDebug) {
              window.hhDebug.log('auth-context', 'JWT login successful');
            }
          } catch (e) {
            if (debug && window.hhDebug) {
              window.hhDebug.warn('auth-context', 'Failed to store JWT token', e.message);
            }
          }

          // Return identity
          resolve({
            email: data.email || email,
            contactId: String(data.contactId || ''),
            firstname: data.firstname || '',
            lastname: data.lastname || ''
          });
        })
        .catch(function(err) {
          if (debug && window.hhDebug) {
            window.hhDebug.error('auth-context', 'JWT login failed', err.message);
          }
          reject(err);
        });
      });
    });
  }

  /**
   * Initialize identity detection
   * Priority order (Issue #272):
   * 1. HubL server-side data attributes (NEW - preferred for native membership)
   * 2. JWT token from localStorage (for test automation only)
   * 3. sessionStorage (from legacy handshake - deprecated)
   * 4. window.hhServerIdentity (alternative server-side injection)
   * 5. Membership profile API (fallback for private pages)
   *
   * @returns {Promise<Object>}
   */
  function initIdentity() {
    // Return cached promise if already initialized
    if (identityPromise) {
      return identityPromise;
    }

    // Priority 0: Check HubL data attributes from server-side rendering (Issue #272)
    // This is the new preferred method for native HubSpot membership authentication
    var authContextDiv = document.getElementById('hhl-auth-context');
    if (authContextDiv) {
      var serverEmail = authContextDiv.getAttribute('data-email');
      var serverContactId = authContextDiv.getAttribute('data-contact-id');
      var serverFirstname = authContextDiv.getAttribute('data-firstname');
      var serverLastname = authContextDiv.getAttribute('data-lastname');

      if (serverEmail || serverContactId) {
        if (debug && window.hhDebug) {
          window.hhDebug.log('auth-context', 'Using HubL data attributes from server-side rendering (Issue #272)');
        }

        identityPromise = Promise.resolve({
          email: serverEmail || '',
          contactId: serverContactId || '',
          firstname: serverFirstname || '',
          lastname: serverLastname || ''
        });

        return identityPromise.then(function(identity) {
          identityCache = identity;
          identityResolved = true;
          updateAuthContextDom(identity);
          if (debug && window.hhDebug) {
            window.hhDebug.log('auth-context', 'Identity resolved from HubL data attributes', {
              hasEmail: !!identity.email,
              hasContactId: !!identity.contactId,
              isAuthenticated: !!(identity.email || identity.contactId)
            });
          }
          emitIdentityEvent(identity);
          return identity;
        });
      }
    }

    // Priority 1: Check JWT token from localStorage (for test automation only - Issue #251)
    var token = checkStoredToken();
    if (token) {
      // Token is valid, check for stored identity
      try {
        var storedJwtIdentity = localStorage.getItem('hhl_identity_from_jwt');
        if (storedJwtIdentity) {
          var parsed = JSON.parse(storedJwtIdentity);
          if (parsed && (parsed.email || parsed.contactId)) {
            if (debug && window.hhDebug) {
              window.hhDebug.log('auth-context', 'Using JWT token identity from localStorage (test automation)');
            }
            identityPromise = Promise.resolve(parsed);
            return identityPromise.then(function(identity) {
              identityCache = identity;
              identityResolved = true;
              updateAuthContextDom(identity);
              if (debug && window.hhDebug) {
                window.hhDebug.log('auth-context', 'Identity resolved from JWT', {
                  hasEmail: !!identity.email,
                  hasContactId: !!identity.contactId,
                  isAuthenticated: !!(identity.email || identity.contactId)
                });
              }
              emitIdentityEvent(identity);
              return identity;
            });
          }
        }
      } catch (e) {
        if (debug && window.hhDebug) {
          window.hhDebug.warn('auth-context', 'Failed to read JWT identity from localStorage', e.message);
        }
      }
    }

    // Priority 2: Check sessionStorage (from auth handshake page - deprecated, Issue #244)
    var storedIdentity = null;
    try {
      var stored = sessionStorage.getItem('hhl_identity');
      if (stored) {
        storedIdentity = JSON.parse(stored);
        var ts = 0;
        if (storedIdentity && storedIdentity.timestamp) {
          ts = Date.parse(storedIdentity.timestamp);
        }
        var isFresh = !ts || (Date.now() - ts) <= STORED_IDENTITY_TTL_MS;
        if (!isFresh) {
          sessionStorage.removeItem('hhl_identity');
          storedIdentity = null;
        }
        if (storedIdentity && (storedIdentity.email || storedIdentity.contactId)) {
          if (debug && window.hhDebug) {
            window.hhDebug.log('auth-context', 'Using sessionStorage identity from handshake page (deprecated)');
          }
          identityPromise = Promise.resolve({
            email: storedIdentity.email || '',
            contactId: String(storedIdentity.contactId || ''),
            firstname: storedIdentity.firstname || '',
            lastname: storedIdentity.lastname || ''
          });
          return identityPromise.then(function(identity) {
            identityCache = identity;
            identityResolved = true;
            updateAuthContextDom(identity);
            if (debug && window.hhDebug) {
              window.hhDebug.log('auth-context', 'Identity resolved from sessionStorage', {
                hasEmail: !!identity.email,
                hasContactId: !!identity.contactId,
                isAuthenticated: !!(identity.email || identity.contactId)
              });
            }
            emitIdentityEvent(identity);
            return identity;
          });
        }
      }
    } catch (e) {
      if (debug && window.hhDebug) {
        window.hhDebug.warn('auth-context', 'Failed to read sessionStorage', e.message);
      }
    }

    // Priority 3: Check if server-side identity is available (window.hhServerIdentity)
    if (window.hhServerIdentity && (window.hhServerIdentity.email || window.hhServerIdentity.contactId)) {
      if (debug && window.hhDebug) {
        window.hhDebug.log('auth-context', 'Using server-side identity bootstrap (window.hhServerIdentity)');
      }

      // Resolve immediately with server identity
      identityPromise = Promise.resolve({
        email: window.hhServerIdentity.email || '',
        contactId: String(window.hhServerIdentity.contactId || ''),
        firstname: window.hhServerIdentity.firstname || '',
        lastname: window.hhServerIdentity.lastname || ''
      });
    } else {
      // Priority 4: Fallback to membership profile API (works on private pages)
      if (debug && window.hhDebug) {
        window.hhDebug.log('auth-context', 'No server identity found, fetching from membership API');
      }
      identityPromise = fetchMembershipProfile();
    }

    identityPromise = identityPromise
      .then(function(identity) {
        // Cache the identity
        identityCache = identity;
        identityResolved = true;
        updateAuthContextDom(identity);

        if (debug && window.hhDebug) {
          window.hhDebug.log('auth-context', 'Identity resolved', {
            hasEmail: !!identity.email,
            hasContactId: !!identity.contactId,
            isAuthenticated: !!(identity.email || identity.contactId)
          });
        }

        // Emit custom event for downstream consumers
        emitIdentityEvent(identity);

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
    },

    /**
     * Login with email via JWT authentication (Issue #251)
     * @param {string} email - User email address
     * @returns {Promise<Object>} Identity object with email, contactId, etc.
     *
     * @example
     * window.hhIdentity.login('user@example.com')
     *   .then(function(identity) {
     *     console.log('Logged in:', identity.email);
     *   })
     *   .catch(function(err) {
     *     console.error('Login failed:', err);
     *   });
     */
    login: function(email) {
      var authDiv = document.getElementById('hhl-auth-context');
      var constantsUrl = authDiv ? authDiv.getAttribute('data-constants-url') : '/learn/config/constants.json';

      return attemptJWTLogin(email, constantsUrl)
        .then(function(identity) {
          // Update cached identity
          identityCache = identity;
          identityResolved = true;
          updateAuthContextDom(identity);
          emitIdentityEvent(identity);

          if (debug && window.hhDebug) {
            window.hhDebug.log('auth-context', 'Login successful via JWT', {
              hasEmail: !!identity.email,
              hasContactId: !!identity.contactId
            });
          }

          return identity;
        });
    },

    /**
     * Logout user by clearing JWT token and identity cache (Issue #251)
     *
     * @example
     * window.hhIdentity.logout();
     * location.reload(); // Refresh to show anonymous state
     */
    logout: function() {
      try {
        localStorage.removeItem('hhl_auth_token');
        localStorage.removeItem('hhl_auth_token_expires');
        localStorage.removeItem('hhl_identity_from_jwt');
        identityCache = null;
        identityResolved = false;
        identityPromise = null;

        if (debug && window.hhDebug) {
          window.hhDebug.log('auth-context', 'Logged out - JWT token cleared');
        }
      } catch (e) {
        if (debug && window.hhDebug) {
          window.hhDebug.error('auth-context', 'Failed to logout', e.message);
        }
      }
    }
  };

  // Initialize immediately
  window.hhIdentity.ready = initIdentity();

  if (debug && window.hhDebug) {
    window.hhDebug.log('auth-context', 'Bootstrapper initialized');
  }

})();
