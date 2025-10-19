/**
 * Hedgehog Learn – Course Context Manager
 * Detects and manages course context for module pages accessed from courses
 * Stores context in sessionStorage for refresh resilience
 */
(function() {
  window.hhCourseContext = window.hhCourseContext || {};

  /**
   * Parse course context from URL query parameter
   * Expected format: ?from=course:{course-slug}
   * @returns {Object|null} { courseSlug: string } or null
   */
  function parseUrlContext() {
    var params = new URLSearchParams(window.location.search);
    var from = params.get('from');

    if (from && from.indexOf('course:') === 0) {
      var courseSlug = from.substring(7); // Remove 'course:' prefix
      if (courseSlug) {
        return { courseSlug: courseSlug };
      }
    }
    return null;
  }

  /**
   * Get course context from sessionStorage
   * @returns {Object|null}
   */
  function getStoredContext() {
    try {
      var moduleSlug = (document.querySelector('meta[name="hhl:module_slug"]') || {}).content;
      if (!moduleSlug) return null;

      var key = 'hh-course-context-' + moduleSlug;
      var stored = sessionStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Silent fail
    }
    return null;
  }

  /**
   * Store course context in sessionStorage
   * @param {Object} context - { courseSlug: string }
   */
  function storeContext(context) {
    try {
      var moduleSlug = (document.querySelector('meta[name="hhl:module_slug"]') || {}).content;
      if (!moduleSlug || !context) return;

      var key = 'hh-course-context-' + moduleSlug;
      sessionStorage.setItem(key, JSON.stringify(context));
    } catch (e) {
      // Silent fail
    }
  }

  /**
   * Get active course context (URL takes precedence over stored)
   * @returns {Object|null} { courseSlug: string } or null
   */
  function getContext() {
    var urlContext = parseUrlContext();
    if (urlContext) {
      storeContext(urlContext); // Update storage
      return urlContext;
    }
    return getStoredContext();
  }

  /**
   * Clear course context for current module
   */
  function clearContext() {
    try {
      var moduleSlug = (document.querySelector('meta[name="hhl:module_slug"]') || {}).content;
      if (moduleSlug) {
        var key = 'hh-course-context-' + moduleSlug;
        sessionStorage.removeItem(key);
      }
    } catch (e) {
      // Silent fail
    }
  }

  /**
   * Add course context parameter to a URL
   * @param {string} url - Base URL
   * @param {string} courseSlug - Course slug
   * @returns {string} URL with context parameter
   */
  function addContextToUrl(url, courseSlug) {
    if (!url || !courseSlug) return url;

    var separator = url.indexOf('?') === -1 ? '?' : '&';
    return url + separator + 'from=course:' + encodeURIComponent(courseSlug);
  }

  // Public API
  window.hhCourseContext = {
    getContext: getContext,
    clearContext: clearContext,
    addContextToUrl: addContextToUrl,
    parseUrlContext: parseUrlContext
  };

  // Debug logging
  var debug = (localStorage.getItem('HHL_DEBUG') === 'true');
  if (debug) {
    var ctx = getContext();
    console.log('[hhl] course-context.js loaded', { context: ctx });
  }
})();
