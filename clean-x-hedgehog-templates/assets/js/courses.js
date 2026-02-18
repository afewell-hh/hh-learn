/**
 * Hedgehog Learn – Courses page interactions (CSP-safe)
 * - Shows CRM-backed progress counts and bar for authenticated users
 * - Falls back to local storage for anonymous users
 * - (Legacy) Enrollment beacons now handled via /learn/action-runner (Issue #245)
 * - Exposes window.hhUpdateCourseProgress(started, completed)
 */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  /**
   * Build fetch headers with JWT token if available (Issue #251)
   */
  function buildAuthHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    try {
      var token = localStorage.getItem('hhl_auth_token');
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return headers;
  }

  function fetchJSON(url) {
    return fetch(url, {
      credentials: 'omit',
      headers: buildAuthHeaders()
    }).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + url);
      return r.json();
    });
  }

  function getConstants() {
    // Issue #345: Read constants from data attributes (no more CORS fetch)
    var ctx = document.getElementById('hhl-auth-context');
    var trackEventsUrl = ctx && ctx.getAttribute('data-track-events-url');
    return Promise.resolve({
      TRACK_EVENTS_URL: trackEventsUrl || null,
      TRACK_EVENTS_ENABLED: !!trackEventsUrl
    });
  }

  function getAuth() {
    var el = document.getElementById('hhl-auth-context');
    if (!el) return { enableCrm: false };
    var identity = (window.hhIdentity && typeof window.hhIdentity.get === 'function') ? window.hhIdentity.get() : null;
    var email = identity && identity.email ? identity.email : (el.getAttribute('data-email') || null);
    var contactId = identity && identity.contactId ? identity.contactId : (el.getAttribute('data-contact-id') || null);
    return {
      email: email,
      contactId: contactId,
      enableCrm: (el.getAttribute('data-enable-crm') || 'false') === 'true'
    };
  }

  function sendEnrollment(constants, auth, courseSlug) {
    // Deprecated: explicit enrollment now routes through /learn/action-runner (Issue #245)
    // We keep the session flag to avoid re-triggering legacy flows, but no network requests occur here.
    try {
      var key = 'hh-course-enrolled-' + courseSlug;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, 'true');
      }
    } catch (e) {}
  }

  function getLocalProgress(courseSlug) {
    try {
      var raw = localStorage.getItem('hh-course-progress-' + courseSlug);
      return raw ? JSON.parse(raw) : { started:0, completed:0 };
    } catch(e) { return { started:0, completed:0 }; }
  }

  function fetchCRMProgress(constants, auth, courseSlug) {
    // Return promise that resolves to progress data
    if (!constants || !constants.TRACK_EVENTS_URL || !auth.enableCrm || (!auth.email && !auth.contactId)) {
      return Promise.resolve(null); // Fall back to local storage
    }

    var apiBase = constants.TRACK_EVENTS_URL.replace('/events/track', '');
    var params = new URLSearchParams({
      type: 'course',
      slug: courseSlug
    });
    if (auth.email) params.append('email', auth.email);
    if (auth.contactId) params.append('contactId', auth.contactId);

    var url = apiBase + '/progress/aggregate?' + params.toString();

    return fetch(url, { credentials: 'omit' })
      .then(function(r) {
        if (!r.ok) throw new Error('Failed to fetch progress');
        return r.json();
      })
      .then(function(data) {
        if (data.mode === 'authenticated') {
          return {
            started: data.started || 0,
            completed: data.completed || 0,
            enrolled: data.enrolled || false
          };
        }
        return null;
      })
      .catch(function(err) {
        console.warn('[hhl] Failed to fetch CRM progress:', err);
        return null;
      });
  }

  function renderProgress(totalModules, courseSlug, progressData) {
    var startedEl = document.getElementById('progress-started');
    var completedEl = document.getElementById('progress-completed');
    var barEl = document.getElementById('progress-bar');
    var authPrompt = document.getElementById('auth-prompt');
    if (startedEl) startedEl.textContent = progressData.started;
    if (completedEl) completedEl.textContent = progressData.completed;
    var pct = totalModules > 0 ? Math.round((progressData.completed / totalModules) * 100) : 0;
    if (barEl) barEl.style.width = pct + '%';

    // Only show auth prompt if using local storage AND has some progress
    if (authPrompt && !progressData.fromCRM && (progressData.started > 0 || progressData.completed > 0)) {
      authPrompt.style.display = 'flex';
    }
  }

  ready(function(){
    var node = document.querySelector('[data-course-slug]');
    var courseSlug = node ? node.getAttribute('data-course-slug') : (window.location.pathname.split('/').filter(Boolean).pop() || 'unknown');
    var totalNode = document.querySelector('[data-total-modules]');
    var totalModules = totalNode ? parseInt(totalNode.getAttribute('data-total-modules')||'0',10) : 0;

    Promise.all([getConstants(), Promise.resolve(getAuth())]).then(function(res){
      var constants = res[0]; var auth = res[1];

      // Try to fetch CRM progress first, fall back to local storage
      fetchCRMProgress(constants, auth, courseSlug).then(function(crmProgress){
        var progressData;
        if (crmProgress) {
          // Use CRM data
          progressData = {
            started: crmProgress.started,
            completed: crmProgress.completed,
            fromCRM: true
          };
        } else {
          // Fall back to local storage
          var localProgress = getLocalProgress(courseSlug);
          progressData = {
            started: localProgress.started,
            completed: localProgress.completed,
            fromCRM: false
          };
        }

        renderProgress(totalModules, courseSlug, progressData);
        sendEnrollment(constants, auth, courseSlug);

        // Expose update function (for legacy compatibility)
        window.hhUpdateCourseProgress = function(started, completed){
          try {
            localStorage.setItem('hh-course-progress-' + courseSlug, JSON.stringify({ started: started, completed: completed, lastUpdated: new Date().toISOString() }));
          } catch(e) {}
          var updatedData = { started: started, completed: completed, fromCRM: false };
          renderProgress(totalModules, courseSlug, updatedData);
        };
      });
    });
  });
})();
