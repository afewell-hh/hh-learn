/**
 * HHL Cognito OAuth Frontend Integration (Issue #306 - Phase 6)
 *
 * This module integrates AWS Cognito OAuth authentication with the HubSpot CMS frontend.
 * It replaces JWT-based authentication with Cognito OAuth using httpOnly cookies.
 *
 * ## Features
 * - Fetches user profile from `/auth/me` endpoint (uses httpOnly cookies automatically)
 * - Emits `hhl:identity` custom event when authentication state is resolved
 * - Provides backward-compatible `window.hhIdentity` API
 * - Gracefully handles anonymous sessions (401 responses)
 * - Supports Cognito OAuth login/logout flows
 *
 * ## Authentication Flow
 * 1. Page loads → calls `/auth/me` to check authentication status
 * 2. If cookies present and valid → returns user profile → authenticated state
 * 3. If no cookies or invalid → returns 401 → anonymous state
 * 4. Login: redirect to `/auth/login?redirect_url=<current_page>`
 * 5. Logout: redirect to `/auth/logout` → clears cookies
 *
 * ## API Compatibility
 * This module maintains backward compatibility with existing code that uses:
 * - `window.hhIdentity.ready` (Promise)
 * - `window.hhIdentity.get()` (returns identity object)
 * - `window.hhIdentity.isAuthenticated()` (returns boolean)
 * - `hhl:identity` custom event
 *
 * @see https://github.com/afewell-hh/hh-learn/issues/306
 * @see docs/specs/issue-299-external-sso-spec.md
 *
 * @module cognito-auth-integration
 */
(function() {
  'use strict';

  // Prevent double-loading
  if (window.hhCognitoAuth && window.hhCognitoAuth.__initialized) {
    console.warn('[cognito-auth] Already initialized, skipping');
    return;
  }

  var debug = localStorage.getItem('HHL_DEBUG') === 'true';

  /**
   * Get constants configuration from DOM (Issue #345 - no more constants.json fetch)
   */
  function getConfig() {
    var authDiv = document.getElementById('hhl-auth-context');
    var config = {
      authMeUrl: '/auth/me',
      authLoginUrl: '/auth/login',
      authLogoutUrl: '/auth/logout',
    };

    if (authDiv) {
      config.authMeUrl = authDiv.getAttribute('data-auth-me-url') || config.authMeUrl;
      config.authLoginUrl = authDiv.getAttribute('data-auth-login-url') || config.authLoginUrl;
      config.authLogoutUrl = authDiv.getAttribute('data-auth-logout-url') || config.authLogoutUrl;
    }

    // Return config synchronously (no fetch)
    return Promise.resolve(config);
  }

  function ensureEnrollmentHelpers() {
    if (typeof window.waitForIdentityReady === 'function' && typeof window.getAuth === 'function') {
      return;
    }

    function parseBoolean(value) {
      if (typeof value === 'boolean') return value;
      if (!value) return false;
      var normalized = value.toString().trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }

    window.waitForIdentityReady = window.waitForIdentityReady || function() {
      try {
        if (window.hhIdentity && window.hhIdentity.ready && typeof window.hhIdentity.ready.then === 'function') {
          return window.hhIdentity.ready;
        }
      } catch (error) {}
      return Promise.resolve(null);
    };

    window.getAuth = window.getAuth || function() {
      var el = document.getElementById('hhl-auth-context');
      var identity = (window.hhIdentity && typeof window.hhIdentity.get === 'function')
        ? window.hhIdentity.get()
        : null;
      var authenticated = identity ? !!identity.authenticated : parseBoolean(el && el.getAttribute('data-authenticated'));
      var email = identity && identity.email ? identity.email : (el && el.getAttribute('data-email')) || null;
      var contactId = identity && identity.contactId ? identity.contactId : (el && el.getAttribute('data-contact-id')) || null;
      return {
        authenticated: authenticated,
        email: email,
        contactId: contactId,
        enableCrm: parseBoolean(el && el.getAttribute('data-enable-crm')),
        trackEventsUrl: el && el.getAttribute('data-track-events-url')
      };
    };

    window.getActionRunnerBase = window.getActionRunnerBase || function(constants) {
      if (constants && constants.ACTION_RUNNER_URL) return constants.ACTION_RUNNER_URL;
      return '/learn/action-runner';
    };

    window.buildRunnerUrl = window.buildRunnerUrl || function(base, redirectUrl, params) {
      var runner = base || '/learn/action-runner';
      var search = new URLSearchParams();
      Object.keys(params || {}).forEach(function(key) {
        var value = params[key];
        if (value !== undefined && value !== null && value !== '') {
          search.set(key, value);
        }
      });
      if (redirectUrl) search.set('redirect_url', redirectUrl);
      return runner + '?' + search.toString();
    };

    window.deriveEnrollmentSource = window.deriveEnrollmentSource || function() {
      var path = window.location.pathname || '';
      if (path.indexOf('/pathways/') >= 0) return 'pathway_page';
      if (path.indexOf('/courses/') >= 0) return 'course_page';
      if (path.indexOf('/modules/') >= 0) return 'module_page';
      return 'learn_page';
    };

    window.bindClick = window.bindClick || function(button, handler) {
      if (!button || typeof handler !== 'function') return;
      window.unbindClick && window.unbindClick(button);
      var wrapped = function(event) {
        if (event) event.preventDefault();
        handler();
      };
      button.__hhlEnrollHandler = wrapped;
      button.addEventListener('click', wrapped);
    };

    window.unbindClick = window.unbindClick || function(button) {
      if (!button) return;
      var existing = button.__hhlEnrollHandler;
      if (existing) {
        button.removeEventListener('click', existing);
        button.__hhlEnrollHandler = null;
      }
    };
  }

  ensureEnrollmentHelpers();

  /**
   * Fetch user profile from /auth/me endpoint
   * Uses httpOnly cookies automatically via credentials: 'include'
   *
   * @returns {Promise<Object|null>} User profile or null if not authenticated
   */
  function fetchAuthMe(authMeUrl) {
    if (debug) {
      console.log('[cognito-auth] Fetching user profile from', authMeUrl);
    }

    return fetch(authMeUrl, {
      method: 'GET',
      credentials: 'include', // Include httpOnly cookies
      headers: {
        'Accept': 'application/json',
      },
    })
      .then(function(response) {
        if (response.ok) {
          return response.json().then(function(data) {
            if (debug) {
              console.log('[cognito-auth] Authenticated user profile received', {
                hasEmail: !!data.email,
                hasUserId: !!data.userId,
              });
            }
            return data;
          });
        } else if (response.status === 401) {
          // Not authenticated (no valid cookies)
          if (debug) {
            console.log('[cognito-auth] Not authenticated (401) - anonymous session');
          }
          return null;
        } else {
          // Other error status
          if (debug) {
            console.warn('[cognito-auth] /auth/me returned status:', response.status);
          }
          return null;
        }
      })
      .catch(function(error) {
        // Network error or other fetch failure
        if (debug) {
          console.error('[cognito-auth] Failed to fetch /auth/me:', error.message);
        }
        return null;
      });
  }

  /**
   * Transform /auth/me response to window.hhIdentity format
   * Maps Cognito profile fields to legacy format for compatibility
   */
  function transformProfile(profile) {
    if (!profile) {
      return {
        email: '',
        contactId: '',
        userId: '',
        displayName: '',
        firstname: '',
        lastname: '',
        authenticated: false,
      };
    }

    return {
      email: profile.email || '',
      contactId: profile.hubspotContactId || '', // HubSpot CRM sync creates this
      userId: profile.userId || '',
      displayName: profile.displayName || profile.email || '',
      firstname: profile.givenName || '',
      lastname: profile.familyName || '',
      authenticated: true,
      // Include raw Cognito data for advanced use cases
      _cognitoProfile: profile,
    };
  }

  /**
   * Update DOM with auth context data
   */
  function updateAuthContextDom(identity) {
    var node = document.getElementById('hhl-auth-context');
    if (!node) return;

    try {
      node.setAttribute('data-email', identity.email || '');
      node.setAttribute('data-contact-id', identity.contactId || '');
      node.setAttribute('data-user-id', identity.userId || '');
      node.setAttribute('data-authenticated', identity.authenticated ? 'true' : 'false');

      if (identity.firstname) {
        node.setAttribute('data-firstname', identity.firstname);
      } else {
        node.removeAttribute('data-firstname');
      }

      if (identity.lastname) {
        node.setAttribute('data-lastname', identity.lastname);
      } else {
        node.removeAttribute('data-lastname');
      }

      if (debug) {
        console.log('[cognito-auth] Updated DOM auth context');
      }
    } catch (err) {
      if (debug) {
        console.warn('[cognito-auth] Failed to update DOM:', err.message);
      }
    }
  }

  /**
   * Toggle UI elements based on auth state
   * Shows/hides elements with data-auth-state="authenticated|anonymous"
   */
  function applyAuthState(identity) {
    var state = identity && identity.authenticated ? 'authenticated' : 'anonymous';
    var nodes = document.querySelectorAll('[data-auth-state]');

    nodes.forEach(function(node) {
      var expectedState = node.getAttribute('data-auth-state');
      if (expectedState === state) {
        node.style.display = '';  // Show matching state
      } else {
        node.style.display = 'none';  // Hide non-matching state
      }
    });

    // Update user greeting if authenticated
    if (state === 'authenticated') {
      var greetingNode = document.getElementById('auth-user-greeting');
      if (greetingNode && identity.firstname) {
        greetingNode.textContent = 'Hi, ' + identity.firstname + '!';
      } else if (greetingNode) {
        greetingNode.textContent = 'Hi there!';
      }
    }

    if (debug) {
      console.log('[cognito-auth] Applied auth state:', state);
    }
  }

  /**
   * Emit hhl:identity event for downstream consumers
   */
  function emitIdentityEvent(identity) {
    try {
      if (typeof CustomEvent === 'function') {
        var event = new CustomEvent('hhl:identity', {
          detail: identity,
          bubbles: true,
          cancelable: false,
        });
        document.dispatchEvent(event);

        if (debug) {
          console.log('[cognito-auth] Dispatched hhl:identity event');
        }
      }
    } catch (e) {
      if (debug) {
        console.warn('[cognito-auth] Failed to dispatch event:', e.message);
      }
    }
  }

  /**
   * Initialize Cognito authentication
   * Fetches user profile and updates identity state
   */
  function initCognitoAuth() {
    return getConfig().then(function(config) {
      return fetchAuthMe(config.authMeUrl).then(function(profile) {
        var identity = transformProfile(profile);

        // Update DOM
        updateAuthContextDom(identity);

        // Toggle UI elements based on auth state
        applyAuthState(identity);

        // Emit event
        emitIdentityEvent(identity);

        // Update global identity object
        if (window.hhIdentity) {
          window.hhIdentity._identity = identity;
          window.hhIdentity._resolved = true;
          // Ensure legacy hhIdentity variants expose the full Cognito API.
          window.hhIdentity.get = function() {
            return this._identity;
          };
          window.hhIdentity.isAuthenticated = function() {
            return !!(this._identity && this._identity.authenticated);
          };
          window.hhIdentity.isReady = function() {
            return !!this._resolved;
          };
          window.hhIdentity.login = function(redirectPath) {
            return login(redirectPath);
          };
          window.hhIdentity.logout = function(redirectPath) {
            return logout(redirectPath);
          };
          if (!window.hhIdentity.ready || typeof window.hhIdentity.ready.then !== 'function') {
            window.hhIdentity.ready = Promise.resolve(identity);
          }
        }

        if (debug) {
          console.log('[cognito-auth] Identity resolved:', {
            authenticated: identity.authenticated,
            email: identity.email,
          });
        }

        return identity;
      });
    });
  }

  /**
   * Redirect to Cognito login
   */
  function login(redirectPath) {
    return getConfig().then(function(config) {
      var path = redirectPath || window.location.pathname + window.location.search + window.location.hash;
      var loginUrl = config.authLoginUrl + '?redirect_url=' + encodeURIComponent(path);

      if (debug) {
        console.log('[cognito-auth] Redirecting to login:', loginUrl);
      }

      window.location.href = loginUrl;
    });
  }

  /**
   * Redirect to Cognito logout
   */
  function logout(redirectPath) {
    return getConfig().then(function(config) {
      var logoutUrl = config.authLogoutUrl;

      if (redirectPath) {
        logoutUrl += '?redirect_url=' + encodeURIComponent(redirectPath);
      }

      if (debug) {
        console.log('[cognito-auth] Redirecting to logout:', logoutUrl);
      }

      window.location.href = logoutUrl;
    });
  }

  /**
   * Backward-compatible window.hhIdentity API
   * Maintains compatibility with existing code
   */
  if (!window.hhIdentity) {
    window.hhIdentity = {
      _identity: null,
      _resolved: false,
      ready: null,

      get: function() {
        return this._identity;
      },

      isAuthenticated: function() {
        return !!(this._identity && this._identity.authenticated);
      },

      isReady: function() {
        return this._resolved;
      },

      // Cognito OAuth login (replaces JWT login)
      login: function(redirectPath) {
        return login(redirectPath);
      },

      // Cognito OAuth logout
      logout: function(redirectPath) {
        return logout(redirectPath);
      },
    };

    // Initialize and set ready promise
    window.hhIdentity.ready = initCognitoAuth();
  } else {
    // hhIdentity already exists (from auth-context.js)
    // Override with Cognito auth
    if (debug) {
      console.log('[cognito-auth] Replacing existing hhIdentity with Cognito auth');
    }

    var existingIdentity = window.hhIdentity;

    // Preserve any existing state
    window.hhIdentity = {
      _identity: existingIdentity._identity || null,
      _resolved: false,
      ready: initCognitoAuth(),

      get: function() {
        return this._identity;
      },

      isAuthenticated: function() {
        return !!(this._identity && this._identity.authenticated);
      },

      isReady: function() {
        return this._resolved;
      },

      login: function(redirectPath) {
        return login(redirectPath);
      },

      logout: function(redirectPath) {
        return logout(redirectPath);
      },
    };
  }

  /**
   * Public API: window.hhCognitoAuth
   */
  window.hhCognitoAuth = {
    __initialized: true,
    login: login,
    logout: logout,
    refresh: initCognitoAuth,
  };

  if (window.hhIdentity && (typeof window.hhIdentity.login !== 'function' || typeof window.hhIdentity.logout !== 'function')) {
    initCognitoAuth();
  }

  if (debug) {
    console.log('[cognito-auth] Cognito OAuth integration initialized');
  }
})();
