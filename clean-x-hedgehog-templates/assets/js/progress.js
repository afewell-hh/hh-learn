/**
 * Hedgehog Learn – Progress interactions (CSP-safe)
 * - Attaches click handlers for Mark Started / Mark Complete
 * - Sends beacons to the /events/track endpoint
 * - Reads auth context from a data element rendered by the template
 * - Fetches constants.json directly (no inline JS required)
 */

(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
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
    var ctx = document.getElementById('hhl-auth-context');
    var url = ctx && ctx.getAttribute('data-constants-url');
    // Fallback to a best‑effort path if not provided
    if (!url) url = '/CLEAN x HEDGEHOG/templates/config/constants.json';
    return fetchJSON(url)
      .then(function (json) {
        return json || {};
      })
      .catch(function () {
        // Hard fallback to known API gateway used by this project
        return {
          TRACK_EVENTS_ENABLED: true,
          TRACK_EVENTS_URL: 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track',
          ENABLE_CRM_PROGRESS: true,
          ACTION_RUNNER_URL: '/learn/action-runner'
        };
      });
  }

  function getAuthContext() {
    // Use window.hhIdentity API for actual membership authentication
    var identity = window.hhIdentity ? window.hhIdentity.get() : null;
    var email = null;
    var contactId = null;
    if (identity) {
      email = identity.email || null;
      contactId = identity.contactId || null;
    }
    // Get enableCrm from auth context div
    var el = document.getElementById('hhl-auth-context');
    var enableCrm = false;
    if (el) {
      var enableAttr = el.getAttribute('data-enable-crm');
      enableCrm = (enableAttr || '').toString().toLowerCase() === 'true';
    }
    return { email: email, contactId: contactId, enableCrm: enableCrm };
  }

  function getActionRunnerBase(constants) {
    if (constants && constants.ACTION_RUNNER_URL) return constants.ACTION_RUNNER_URL;
    return '/learn/action-runner';
  }

  function buildRunnerUrl(base, redirectUrl, params) {
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
  }

  function deriveRedirectPath() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function setModuleState(slug, started, completed) {
    if (!slug) return;
    try {
      sessionStorage.setItem('hhl-module-state-' + slug, JSON.stringify({
        started: !!started,
        completed: !!completed,
        ts: new Date().toISOString()
      }));
    } catch {
      // ignore storage write failures
    }
  }

  function getModuleState(slug) {
    if (!slug) return null;
    try {
      var raw = sessionStorage.getItem('hhl-module-state-' + slug);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function consumeProgressResult(slug) {
    try {
      var raw = sessionStorage.getItem('hhl_last_action');
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.action !== 'record_progress') return null;
      if (slug && data.params && data.params.module_slug && data.params.module_slug !== slug) return null;
      sessionStorage.removeItem('hhl_last_action');
      return data;
    } catch {
      try { sessionStorage.removeItem('hhl_last_action'); } catch {}
      return null;
    }
  }

  function applyProgressFeedback(result, moduleSlug, startBtn, completeBtn, startText, completeText) {
    if (!result) return;
    var status = result.status || 'success';
    if (status === 'success') {
      var progressStatus = result.params && result.params.status;
      if (progressStatus === 'completed') {
        setModuleState(moduleSlug, true, true);
        if (completeBtn) {
          updateButtonState(completeBtn, 'success', completeText);
        }
        if (startBtn) {
          updateButtonState(startBtn, 'success', startText);
        }
        if (window.hhToast) {
          window.hhToast.show('Module marked complete!', 'success', 4200);
        }
      } else {
        setModuleState(moduleSlug, true, false);
        if (startBtn) {
          updateButtonState(startBtn, 'success', startText);
        }
        if (window.hhToast) {
          window.hhToast.show('Module marked as started!', 'success', 4000);
        }
      }
    } else if (status === 'error' && window.hhToast) {
      window.hhToast.show('We could not save your progress. Please try again.', 'error', 5200);
    }
  }

  function updateButtonState(button, state, originalText) {
    var states = {
      loading: { text: 'Saving...', disabled: true, style: 'opacity: 0.6; cursor: wait;' },
      success: { text: '✓ Saved', disabled: true, style: 'background: #D1FAE5; color: #065F46; border: 2px solid #6EE7B7;' },
      default: { text: originalText, disabled: false, style: '' }
    };

    var config = states[state] || states.default;
    button.textContent = config.text;
    button.disabled = config.disabled;
    button.style.cssText += config.style;
  }

  ready(function () {
    var startBtn = document.getElementById('hhl-mark-started');
    var completeBtn = document.getElementById('hhl-mark-complete');

    if (!startBtn && !completeBtn) return;

    // Store original button text
    var startBtnText = startBtn ? startBtn.textContent : '';
    var completeBtnText = completeBtn ? completeBtn.textContent : '';

    Promise.all([getConstants(), Promise.resolve(getAuthContext())]).then(function (res) {
      var constants = res[0];
      var auth = res[1];
      var debug = (localStorage.getItem('HHL_DEBUG') === 'true');
      if (debug) console.log('[hhl] progress.js attached', { constants, auth, hasStart: !!startBtn, hasComplete: !!completeBtn });

      var moduleSlugKey = (document.querySelector('meta[name="hhl:module_slug"]') || {}).content || window.location.pathname.split('/').filter(Boolean).pop();
      var pendingResult = consumeProgressResult(moduleSlugKey);
      var storedState = getModuleState(moduleSlugKey);

      if (storedState) {
        if (storedState.completed && completeBtn) {
          updateButtonState(completeBtn, 'success', completeBtnText);
        }
        if (storedState.started && startBtn) {
          updateButtonState(startBtn, 'success', startBtnText);
        }
      }

      function track(button, started, completed, originalText) {
        // The module/page should expose these as meta tags or data attributes; if not available, we try to infer from URL
        var moduleSlug = moduleSlugKey;
        var pathwaySlug = (document.querySelector('meta[name="hhl:pathway_slug"]') || {}).content || null;
        var courseSlug = (window.hhCourseContext && window.hhCourseContext.getContext()) ? window.hhCourseContext.getContext().courseSlug : null;
        var status = completed ? 'completed' : 'started';

        // Show loading state
        updateButtonState(button, 'loading', originalText);

        // Show loading toast if hhToast is available
        var toast = null;
        if (window.hhToast) {
          var loadingMessage = completed ? 'Marking module complete...' : 'Marking module started...';
          toast = window.hhToast.show(loadingMessage, 'loading', 0);
        }

        setModuleState(moduleSlug, started, completed);

        var runnerBase = getActionRunnerBase(constants);
        var params = {
          action: 'record_progress',
          module_slug: moduleSlug,
          status: status
        };
        if (pathwaySlug) params.pathway_slug = pathwaySlug;
        if (courseSlug) params.course_slug = courseSlug;

        updateButtonState(button, 'success', originalText);
        if (completed && startBtn) {
          updateButtonState(startBtn, 'success', startBtnText);
        }

        if (toast && window.hhToast) {
          var successMessage = completed ? 'Module marked complete!' : 'Module marked as started!';
          window.hhToast.update(toast, successMessage, 'success');
        }

        setTimeout(function () {
          var redirectTarget = deriveRedirectPath();
          if (debug) console.log('[hhl] progress runner redirect', params);
          window.location.href = buildRunnerUrl(runnerBase, redirectTarget, params);
        }, 200);
      }

      if (startBtn) {
        startBtn.addEventListener('click', function () {
          track(startBtn, 1, 0, startBtnText);
        });
      }
      if (completeBtn) {
        completeBtn.addEventListener('click', function () {
          track(completeBtn, 1, 1, completeBtnText);
        });
      }

      if (pendingResult) {
        applyProgressFeedback(pendingResult, moduleSlugKey, startBtn, completeBtn, startBtnText, completeBtnText);
      }
    });
  });
})();
