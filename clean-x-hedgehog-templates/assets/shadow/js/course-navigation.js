/**
 * Hedgehog Learn – Course-Aware Navigation
 * Updates prev/next navigation links to preserve course context
 * Depends on: course-context.js
 */
(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /**
   * Add course context parameter to navigation links
   * @param {string} courseSlug
   */
  function updateNavigationLinks(courseSlug) {
    if (!courseSlug) return;

    var debug = (localStorage.getItem('HHL_DEBUG') === 'true');

    // Find all prev/next navigation links
    var prevLink = document.querySelector('.module-nav-link.module-nav-prev');
    var nextLink = document.querySelector('.module-nav-link.module-nav-next');

    if (prevLink) {
      var prevHref = prevLink.getAttribute('href');
      if (prevHref && window.hhCourseContext) {
        var newHref = window.hhCourseContext.addContextToUrl(prevHref, courseSlug);
        prevLink.setAttribute('href', newHref);
        if (debug) console.log('[hhl] course-navigation.js - updated prev link', newHref);
      }
    }

    if (nextLink) {
      var nextHref = nextLink.getAttribute('href');
      if (nextHref && window.hhCourseContext) {
        var newNextHref = window.hhCourseContext.addContextToUrl(nextHref, courseSlug);
        nextLink.setAttribute('href', newNextHref);
        if (debug) console.log('[hhl] course-navigation.js - updated next link', newNextHref);
      }
    }
  }

  ready(function() {
    // Only run on module detail pages
    var moduleSlug = (document.querySelector('meta[name="hhl:module_slug"]') || {}).content;
    if (!moduleSlug) return;

    // Check for course context
    if (!window.hhCourseContext) return;
    var context = window.hhCourseContext.getContext();
    if (!context || !context.courseSlug) return;

    var debug = (localStorage.getItem('HHL_DEBUG') === 'true');
    if (debug) console.log('[hhl] course-navigation.js - preserving context', context);

    // Update navigation links to include course context
    updateNavigationLinks(context.courseSlug);
  });
})();
