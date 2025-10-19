/**
 * Hedgehog Learn – Pathways page interactions (CSP-safe)
 * - Shows local progress counts and bar
 * - Emits one-time pathway enrollment beacon per session when authenticated
 * - Exposes window.hhUpdatePathwayProgress(started, completed)
 */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + url);
      return r.json();
    });
  }

  function getConstants() {
    var ctx = document.getElementById('hhl-auth-context');
    var url = ctx && ctx.getAttribute('data-constants-url');
    if (!url) url = '/CLEAN x HEDGEHOG/templates/config/constants.json';
    return fetchJSON(url).catch(function(){ return { TRACK_EVENTS_ENABLED:false }; });
  }

  function getAuth() {
    var el = document.getElementById('hhl-auth-context');
    if (!el) return { enableCrm: false };
    return {
      email: el.getAttribute('data-email') || null,
      contactId: el.getAttribute('data-contact-id') || null,
      enableCrm: (el.getAttribute('data-enable-crm') || 'false') === 'true'
    };
  }

  function sendEnrollment(constants, auth, pathwaySlug) {
    if (!constants || !constants.TRACK_EVENTS_ENABLED || !constants.TRACK_EVENTS_URL) return;
    try {
      var key = 'hh-pathway-enrolled-' + pathwaySlug;
      if (sessionStorage.getItem(key)) return;
      var payload = { eventName: 'learning_pathway_enrolled', payload: { pathway_slug: pathwaySlug, ts: new Date().toISOString() } };
      if (auth.enableCrm && (auth.email || auth.contactId)) {
        payload.contactIdentifier = {};
        if (auth.email) payload.contactIdentifier.email = auth.email;
        if (auth.contactId) payload.contactIdentifier.contactId = auth.contactId;
      }
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(constants.TRACK_EVENTS_URL, blob);
      } else {
        fetch(constants.TRACK_EVENTS_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), keepalive:true }).catch(function(){});
      }
      sessionStorage.setItem(key, 'true');
    } catch (e) {}
  }

  function getLocalProgress(pathwaySlug) {
    try {
      var raw = localStorage.getItem('hh-pathway-progress-' + pathwaySlug);
      return raw ? JSON.parse(raw) : { started:0, completed:0 };
    } catch(e) { return { started:0, completed:0 }; }
  }

  function fetchCRMProgress(constants, auth, pathwaySlug) {
    // Return promise that resolves to progress data
    if (!constants || !constants.TRACK_EVENTS_URL || !auth.enableCrm || (!auth.email && !auth.contactId)) {
      return Promise.resolve(null); // Fall back to local storage
    }

    var apiBase = constants.TRACK_EVENTS_URL.replace('/events/track', '');
    var params = new URLSearchParams({
      type: 'pathway',
      slug: pathwaySlug
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

  function renderProgress(totalModules, pathwaySlug, progressData) {
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
    var node = document.querySelector('[data-pathway-slug]');
    var pathwaySlug = node ? node.getAttribute('data-pathway-slug') : (window.location.pathname.split('/').filter(Boolean).pop() || 'unknown');
    var totalNode = document.querySelector('[data-total-modules]');
    var totalModules = totalNode ? parseInt(totalNode.getAttribute('data-total-modules')||'0',10) : 0;

    Promise.all([getConstants(), Promise.resolve(getAuth())]).then(function(res){
      var constants = res[0]; var auth = res[1];

      // Try to fetch CRM progress first, fall back to local storage
      fetchCRMProgress(constants, auth, pathwaySlug).then(function(crmProgress){
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
          var localProgress = getLocalProgress(pathwaySlug);
          progressData = {
            started: localProgress.started,
            completed: localProgress.completed,
            fromCRM: false
          };
        }

        renderProgress(totalModules, pathwaySlug, progressData);
        sendEnrollment(constants, auth, pathwaySlug);

        // Expose update function (for legacy compatibility)
        window.hhUpdatePathwayProgress = function(started, completed){
          try {
            localStorage.setItem('hh-pathway-progress-' + pathwaySlug, JSON.stringify({ started: started, completed: completed, lastUpdated: new Date().toISOString() }));
          } catch(e) {}
          var updatedData = { started: started, completed: completed, fromCRM: false };
          renderProgress(totalModules, pathwaySlug, updatedData);
        };
      });
    });
  });
})();

