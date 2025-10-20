/**
 * HHL Debug Instrumentation Module
 *
 * Provides centralized debug logging and membership session instrumentation.
 * Enable via: localStorage.setItem('HHL_DEBUG', 'true')
 * Disable via: localStorage.removeItem('HHL_DEBUG')
 *
 * This module automatically logs:
 * - Auth bootstrapper context on page load
 * - Membership profile API responses (when available)
 * - Cookie information (names only, no values for privacy)
 * - HubSpot CMS membership session state
 *
 * Related Issues: #237, #233, #234, #235
 */
(function() {
  'use strict';

  // Initialize debug state
  var enabled = localStorage.getItem('HHL_DEBUG') === 'true';

  /**
   * Global debug interface
   * Provides consistent logging across all HHL modules
   */
  window.hhDebug = {
    enabled: enabled,

    /**
     * Log a debug message
     * @param {string} module - Module name (e.g., 'enroll', 'progress', 'auth')
     * @param {string} message - Message to log
     * @param {*} data - Optional data to include
     */
    log: function(module, message, data) {
      if (!this.enabled) return;
      var prefix = '[hhl:' + module + ']';
      if (data !== undefined) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    },

    /**
     * Log a warning
     * @param {string} module - Module name
     * @param {string} message - Warning message
     * @param {*} data - Optional data to include
     */
    warn: function(module, message, data) {
      if (!this.enabled) return;
      var prefix = '[hhl:' + module + ']';
      if (data !== undefined) {
        console.warn(prefix, message, data);
      } else {
        console.warn(prefix, message);
      }
    },

    /**
     * Log an error
     * @param {string} module - Module name
     * @param {string} message - Error message
     * @param {*} data - Optional data to include
     */
    error: function(module, message, data) {
      if (!this.enabled) return;
      var prefix = '[hhl:' + module + ']';
      if (data !== undefined) {
        console.error(prefix, message, data);
      } else {
        console.error(prefix, message);
      }
    },

    /**
     * Log auth bootstrapper context
     * Inspects the #hhl-auth-context div and logs all data attributes
     */
    bootstrapper: function() {
      if (!this.enabled) return;

      var div = document.getElementById('hhl-auth-context');
      if (!div) {
        this.error('bootstrap', 'Auth context element NOT FOUND - #hhl-auth-context missing from page');
        return;
      }

      // Extract values (privacy-safe: redact actual values)
      var email = div.getAttribute('data-email');
      var contactId = div.getAttribute('data-contact-id');
      var hasEmail = !!(email);
      var hasContactId = !!(contactId);
      var isAuthenticated = hasEmail || hasContactId;

      console.group('[hhl:bootstrap] Auth Context Loaded');
      console.log('Element found:', div);

      // Log presence/absence only, not actual values (privacy-safe)
      console.log('email:', hasEmail ? '(redacted - present)' : '(empty)');
      console.log('contactId:', hasContactId ? '(redacted - present)' : '(empty)');

      console.log('enableCrm:', div.getAttribute('data-enable-crm'));
      console.log('constantsUrl:', div.getAttribute('data-constants-url'));
      console.log('loginUrl:', div.getAttribute('data-login-url'));

      console.log('---');
      console.log('Authenticated:', isAuthenticated);
      console.log('Has Email:', hasEmail);
      console.log('Has Contact ID:', hasContactId);
      console.groupEnd();
    },

    /**
     * Log cookie information (names only, no values for privacy)
     * Filters to show HubSpot-related cookies
     */
    cookies: function() {
      if (!this.enabled) return;

      var allCookies = document.cookie.split(';');
      var cookieNames = allCookies.map(function(cookie) {
        return cookie.trim().split('=')[0];
      });

      // Filter to HubSpot-related cookies
      var hubspotCookies = cookieNames.filter(function(name) {
        return name.indexOf('hs') === 0 ||
               name.indexOf('hubspot') > -1 ||
               name.indexOf('__hs') === 0;
      });

      console.group('[hhl:cookies] Cookie Information');
      console.log('Total cookies:', cookieNames.length);
      console.log('HubSpot cookies:', hubspotCookies.length);
      console.log('HubSpot cookie names:', hubspotCookies);
      console.log('All cookie names:', cookieNames);
      console.groupEnd();
    },

    /**
     * Attempt to fetch membership profile API
     * Logs the response status and key fields (without exposing PII)
     * This is the API that HubSpot uses internally for membership sessions
     */
    membershipProfile: function() {
      if (!this.enabled) return;

      var apiUrl = '/_hcms/api/membership/v1/profile';

      this.log('membership', 'Fetching membership profile from ' + apiUrl);

      fetch(apiUrl, {
        method: 'GET',
        credentials: 'include', // Include cookies for session
        headers: {
          'Accept': 'application/json'
        }
      })
        .then(function(response) {
          console.group('[hhl:membership] Profile API Response');
          console.log('Status:', response.status, response.statusText);
          console.log('OK:', response.ok);
          console.log('Headers:', {
            'content-type': response.headers.get('content-type'),
            'cache-control': response.headers.get('cache-control')
          });

          if (response.ok) {
            return response.json().then(function(data) {
              console.log('Response body (keys only):', Object.keys(data || {}));

              // Log non-PII fields if available
              if (data) {
                console.log('Has email:', !!data.email);
                console.log('Has contact ID:', !!(data.contactId || data.vid || data.hs_object_id));
                console.log('Logged in:', !!data.is_logged_in);

                // Log structure without exposing actual values
                if (data.email) console.log('Email present: (redacted)');
                if (data.contactId) console.log('Contact ID present: (redacted)');
                if (data.vid) console.log('VID present: (redacted)');
                if (data.hs_object_id) console.log('hs_object_id present: (redacted)');
              }

              console.groupEnd();
            });
          } else if (response.status === 404) {
            console.warn('Profile API returned 404 - membership session may not exist');
            console.log('This could indicate:');
            console.log('  1. User is not logged in via CMS membership');
            console.log('  2. Membership feature not enabled on this portal');
            console.log('  3. Session cookies not being sent/persisted');
            console.groupEnd();
          } else {
            console.error('Profile API returned error status:', response.status);
            console.groupEnd();
          }
        })
        .catch(function(error) {
          console.group('[hhl:membership] Profile API Error');
          console.error('Fetch failed:', error.message);
          console.log('This could indicate:');
          console.log('  1. Network connectivity issue');
          console.log('  2. CORS policy blocking the request');
          console.log('  3. API endpoint not available');
          console.groupEnd();
        });
    },

    /**
     * Run all instrumentation checks
     * Called automatically on page load when HHL_DEBUG is enabled
     */
    runAll: function() {
      if (!this.enabled) {
        console.log('[hhl:debug] Debug mode disabled. Enable with: localStorage.setItem("HHL_DEBUG", "true")');
        return;
      }

      console.log('%c[hhl:debug] Debug mode ENABLED', 'color: #00A4BD; font-weight: bold; font-size: 14px;');
      console.log('[hhl:debug] Disable with: localStorage.removeItem("HHL_DEBUG")');
      console.log('[hhl:debug] Running instrumentation checks...');
      console.log('---');

      this.bootstrapper();
      this.cookies();
      this.membershipProfile();
    }
  };

  // Auto-run instrumentation on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.hhDebug.runAll();
    });
  } else {
    // DOM already loaded
    window.hhDebug.runAll();
  }

  // Expose helper for manual testing
  window.enableHhlDebug = function() {
    localStorage.setItem('HHL_DEBUG', 'true');
    console.log('[hhl:debug] Debug mode enabled. Reload the page to see instrumentation.');
  };

  window.disableHhlDebug = function() {
    localStorage.removeItem('HHL_DEBUG');
    console.log('[hhl:debug] Debug mode disabled. Reload the page.');
  };

})();
