/**
 * Hedgehog Learn – Course Breadcrumbs & Position Indicator
 * Updates breadcrumbs and shows module position when course context is present
 * Depends on: course-context.js, constants.json
 */
(function() {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function getConstants() {
    var ctx = document.getElementById('hhl-auth-context');
    var url = ctx && ctx.getAttribute('data-constants-url');
    if (!url) url = '/CLEAN x HEDGEHOG/templates/config/constants.json';
    return fetchJSON(url).catch(function() { return {}; });
  }

  /**
   * Fetch course data from HubDB
   * @param {string} courseSlug
   * @param {Object} constants
   * @returns {Promise<Object|null>} Course row or null
   */
  function fetchCourseData(courseSlug, constants) {
    if (!constants.HUBDB_COURSES_TABLE_ID) return Promise.resolve(null);

    var tableId = constants.HUBDB_COURSES_TABLE_ID;
    var url = '/_hcms/api/public/v2/hubdb/tables/' + tableId + '/rows?path__eq=' + encodeURIComponent(courseSlug);

    return fetchJSON(url).then(function(data) {
      if (data && data.objects && data.objects.length > 0) {
        return data.objects[0].values;
      }
      return null;
    }).catch(function() {
      return null;
    });
  }

  /**
   * Update breadcrumbs to show course context
   * @param {string} courseSlug
   * @param {string} courseName
   */
  function updateBreadcrumbs(courseSlug, courseName) {
    var breadcrumbsNav = document.getElementById('hhl-breadcrumbs');
    if (!breadcrumbsNav) return;

    var courseUrl = '/learn/courses/' + encodeURIComponent(courseSlug);
    var linkHTML = '<a href="' + courseUrl + '">← Back to ' + escapeHtml(courseName) + '</a>';

    // Replace the first child (default breadcrumb)
    var firstChild = breadcrumbsNav.firstElementChild;
    if (firstChild && firstChild.tagName === 'A') {
      firstChild.outerHTML = linkHTML;
    }
  }

  /**
   * Update position indicator to show "Module X of Y in {Course}"
   * @param {number} position - 1-based position
   * @param {number} total - Total modules
   * @param {string} courseName
   */
  function updatePositionIndicator(position, total, courseName) {
    var positionSpan = document.getElementById('hhl-course-position');
    if (!positionSpan) return;

    var text = 'Module ' + position + ' of ' + total + ' in ' + escapeHtml(courseName);
    positionSpan.textContent = text;
    positionSpan.style.display = 'inline';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Get module position in course
   * @param {string} moduleSlug
   * @param {Array} moduleSlugs - Course module slugs array
   * @returns {number} 1-based position, or 0 if not found
   */
  function getModulePosition(moduleSlug, moduleSlugs) {
    if (!moduleSlugs || !Array.isArray(moduleSlugs)) return 0;

    for (var i = 0; i < moduleSlugs.length; i++) {
      if (moduleSlugs[i] === moduleSlug) {
        return i + 1; // 1-based
      }
    }
    return 0;
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
    if (debug) console.log('[hhl] course-breadcrumbs.js - found context', context);

    // Fetch course data and update UI
    getConstants().then(function(constants) {
      return fetchCourseData(context.courseSlug, constants).then(function(courseData) {
        if (!courseData) {
          if (debug) console.log('[hhl] course-breadcrumbs.js - course not found');
          return;
        }

        var courseName = courseData.hs_name || courseData.name || context.courseSlug;

        // Update breadcrumbs
        updateBreadcrumbs(context.courseSlug, courseName);

        // Update position indicator if we have module list
        if (courseData.module_slugs_json) {
          try {
            var moduleSlugs = typeof courseData.module_slugs_json === 'string'
              ? JSON.parse(courseData.module_slugs_json)
              : courseData.module_slugs_json;

            var position = getModulePosition(moduleSlug, moduleSlugs);
            if (position > 0) {
              updatePositionIndicator(position, moduleSlugs.length, courseName);
            }

            if (debug) console.log('[hhl] course-breadcrumbs.js - updated', {
              courseName: courseName,
              position: position,
              total: moduleSlugs.length
            });
          } catch (e) {
            if (debug) console.error('[hhl] course-breadcrumbs.js - parse error', e);
          }
        }
      });
    }).catch(function(err) {
      if (debug) console.error('[hhl] course-breadcrumbs.js - error', err);
    });
  });
})();
