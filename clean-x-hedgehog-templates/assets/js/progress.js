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

  function fetchJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
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
          TRACK_EVENTS_URL: 'https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track',
          ENABLE_CRM_PROGRESS: true,
        };
      });
  }

  function getAuthContext() {
    var el = document.getElementById('hhl-auth-context');
    if (!el) return {};
    return {
      email: el.getAttribute('data-email') || null,
      contactId: el.getAttribute('data-contact-id') || null,
      enableCrm: (el.getAttribute('data-enable-crm') || 'false') === 'true',
    };
  }

  function sendBeacon(constants, auth, eventName, payload) {
    var debug = (localStorage.getItem('HHL_DEBUG') === 'true');
    if (!constants || !constants.TRACK_EVENTS_ENABLED || !constants.TRACK_EVENTS_URL) return;

    var eventData = { eventName: eventName, payload: payload };
    if (auth.enableCrm && (auth.email || auth.contactId)) {
      eventData.contactIdentifier = {};
      if (auth.email) eventData.contactIdentifier.email = auth.email;
      if (auth.contactId) eventData.contactIdentifier.contactId = auth.contactId;
    }

    try {
      if (debug) console.log('[hhl] send', eventName, eventData);
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
        navigator.sendBeacon(constants.TRACK_EVENTS_URL, blob);
      } else {
        fetch(constants.TRACK_EVENTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) {
      // swallow
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

      function track(button, started, completed, originalText) {
        // The module/page should expose these as meta tags or data attributes; if not available, we try to infer from URL
        var moduleSlug = (document.querySelector('meta[name="hhl:module_slug"]') || {}).content || window.location.pathname.split('/').filter(Boolean).pop();
        var pathwaySlug = (document.querySelector('meta[name="hhl:pathway_slug"]') || {}).content || null;
        var courseSlug = (window.hhCourseContext && window.hhCourseContext.getContext()) ? window.hhCourseContext.getContext().courseSlug : null;
        var ts = new Date().toISOString();

        // Show loading state
        updateButtonState(button, 'loading', originalText);

        // Show loading toast if hhToast is available
        var toast = null;
        if (window.hhToast) {
          var loadingMessage = completed ? 'Marking module complete...' : 'Marking module started...';
          toast = window.hhToast.show(loadingMessage, 'loading', 0);
        }

        // Simulate network delay for better UX (beacons are fire-and-forget)
        setTimeout(function() {
          if (started && !completed) {
            sendBeacon(constants, auth, 'learning_module_started', { module_slug: moduleSlug, pathway_slug: pathwaySlug, course_slug: courseSlug, ts: ts });
          }
          if (completed) {
            sendBeacon(constants, auth, 'learning_module_completed', { module_slug: moduleSlug, pathway_slug: pathwaySlug, course_slug: courseSlug, ts: ts });
          }

          // Update button to success state
          updateButtonState(button, 'success', originalText);

          // Update toast to success
          if (toast && window.hhToast) {
            var successMessage = completed
              ? 'Module marked complete!'
              : 'Module marked as started!';
            window.hhToast.update(toast, successMessage, 'success');
          }

          // Reset button after 2 seconds (but keep visual feedback)
          setTimeout(function() {
            // Keep the checkmark for completed, reset for started
            if (!completed) {
              updateButtonState(button, 'default', originalText);
            }
          }, 2000);
        }, 500);
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
    });
  });
})();
