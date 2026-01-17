/**
 * HubSpot Native Login Helper (Issue #272)
 *
 * Shared utility for building HubSpot native membership login URLs.
 * This replaces the custom JWT-based login flow with HubSpot's native
 * membership authentication, which provides better security, SSO support,
 * and aligns with HubSpot's "golden path" for authentication.
 *
 * @see https://github.com/afewell/hh-learn/issues/272
 * @see HUBSPOT-AUTH-QUICK-SUMMARY.md for research findings
 */

(function() {
  'use strict';

  /**
   * Build native HubSpot login URL with redirect
   *
   * @param {string} [redirectPath=null] - Optional redirect path (defaults to current page)
   * @returns {string} Full login URL with redirect_url parameter
   *
   * @example
   * // Redirect back to current page after login
   * window.location.href = window.hhLoginHelper.buildLoginUrl();
   *
   * @example
   * // Redirect to specific page after login
   * window.location.href = window.hhLoginHelper.buildLoginUrl('/learn/my-learning');
   */
  function buildLoginUrl(redirectPath) {
    var path = redirectPath || window.location.pathname + window.location.search + window.location.hash;
    var loginBase = '/_hcms/mem/login';

    // Encode the redirect URL to prevent issues with special characters
    var encodedPath = encodeURIComponent(path);

    return loginBase + '?redirect_url=' + encodedPath;
  }

  /**
   * Build native HubSpot logout URL with redirect
   *
   * @param {string} [redirectPath=null] - Optional redirect path (defaults to current page)
   * @returns {string} Full logout URL with redirect_url parameter
   *
   * @example
   * // Redirect back to current page after logout
   * window.location.href = window.hhLoginHelper.buildLogoutUrl();
   *
   * @example
   * // Redirect to home page after logout
   * window.location.href = window.hhLoginHelper.buildLogoutUrl('/learn');
   */
  function buildLogoutUrl(redirectPath) {
    var path = redirectPath || window.location.pathname + window.location.search + window.location.hash;
    var logoutBase = '/_hcms/mem/logout';

    // Encode the redirect URL to prevent issues with special characters
    var encodedPath = encodeURIComponent(path);

    return logoutBase + '?redirect_url=' + encodedPath;
  }

  /**
   * Navigate to login page with optional redirect
   *
   * @param {string} [redirectPath=null] - Optional redirect path after login
   *
   * @example
   * // Simple login redirect
   * window.hhLoginHelper.login();
   *
   * @example
   * // Login then redirect to specific page
   * window.hhLoginHelper.login('/learn/courses/course-authoring-101');
   */
  function login(redirectPath) {
    window.location.href = buildLoginUrl(redirectPath);
  }

  /**
   * Navigate to logout page with optional redirect
   *
   * @param {string} [redirectPath=null] - Optional redirect path after logout
   *
   * @example
   * // Simple logout redirect
   * window.hhLoginHelper.logout();
   *
   * @example
   * // Logout then redirect to home
   * window.hhLoginHelper.logout('/learn');
   */
  function logout(redirectPath) {
    window.location.href = buildLogoutUrl(redirectPath);
  }

  /**
   * Check if user is authenticated (from window.hhIdentity)
   *
   * @returns {boolean} True if user has email or contactId, false otherwise
   *
   * @example
   * if (window.hhLoginHelper.isAuthenticated()) {
   *   console.log('User is logged in');
   * } else {
   *   console.log('User is anonymous');
   * }
   */
  function isAuthenticated() {
    if (!window.hhIdentity || typeof window.hhIdentity.isAuthenticated !== 'function') {
      // Fallback: check if identity exists manually
      var identity = window.hhIdentity && window.hhIdentity.get ? window.hhIdentity.get() : null;
      return !!(identity && (identity.email || identity.contactId));
    }

    return window.hhIdentity.isAuthenticated();
  }

  /**
   * Public API: window.hhLoginHelper
   *
   * Provides utilities for HubSpot native authentication flows
   */
  window.hhLoginHelper = {
    /**
     * Build login URL with redirect
     * @type {Function}
     */
    buildLoginUrl: buildLoginUrl,

    /**
     * Build logout URL with redirect
     * @type {Function}
     */
    buildLogoutUrl: buildLogoutUrl,

    /**
     * Navigate to login page
     * @type {Function}
     */
    login: login,

    /**
     * Navigate to logout page
     * @type {Function}
     */
    logout: logout,

    /**
     * Check if user is authenticated
     * @type {Function}
     */
    isAuthenticated: isAuthenticated
  };

  if (localStorage.getItem('HHL_DEBUG') === 'true' && window.hhDebug) {
    window.hhDebug.log('login-helper', 'HubSpot native login helper initialized');
  }

})();
