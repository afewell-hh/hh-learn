/**
 * Enrollment Management for Pathways and Courses
 * Handles explicit enrollment flows with localStorage persistence and CRM sync
 */

(function() {
  'use strict';

  var debug = localStorage.getItem('HHL_DEBUG') === 'true';

  function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (!value) return false;
    var normalized = value.toString().trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  /**
   * Get authentication context primarily from HubL-rendered data attributes.
   * Falls back to window.hhIdentity for email/contact ID if HubL data is absent
   * (e.g., older templates or automated tests).
   */
  function getAuth() {
    var authDiv = document.getElementById('hhl-auth-context');
    var enableCrm = false;
    var constantsUrl = '';
    var loginUrl = '';
    var authenticated = false;
    var email = '';
    var contactId = '';

    if (authDiv) {
      enableCrm = parseBoolean(authDiv.getAttribute('data-enable-crm'));
      constantsUrl = authDiv.getAttribute('data-constants-url') || '';
      loginUrl = authDiv.getAttribute('data-login-url') || '';
      authenticated = parseBoolean(authDiv.getAttribute('data-authenticated'));
      email = authDiv.getAttribute('data-email') || '';
      contactId = authDiv.getAttribute('data-contact-id') || '';
    }

    if ((!email || !contactId) && window.hhIdentity && typeof window.hhIdentity.get === 'function') {
      var identity = window.hhIdentity.get();
      if (identity) {
        if (!email) email = identity.email || '';
        if (!contactId) contactId = identity.contactId || '';
        if (!authenticated && identity.email) authenticated = true;
      }
    }

    if (debug) {
      console.log('[hhl-enroll] Auth context:', {
        authenticated: authenticated,
        hasEmail: !!email,
        hasContactId: !!contactId,
        enableCrm: enableCrm,
        source: authDiv ? 'hubl' : 'hhIdentity'
      });
    }

    return {
      email: email,
      contactId: contactId,
      enableCrm: enableCrm,
      constantsUrl: constantsUrl,
      loginUrl: loginUrl,
      authenticated: authenticated
    };
  }

  function unbindClick(button) {
    if (button && button.__hhlHandler) {
      button.removeEventListener('click', button.__hhlHandler);
      button.__hhlHandler = null;
    }
  }

  function bindClick(button, handler) {
    if (!button) return;
    unbindClick(button);
    button.__hhlHandler = handler;
    button.addEventListener('click', handler);
  }

  function waitForIdentityReady() {
    if (window.hhIdentity && window.hhIdentity.ready && typeof window.hhIdentity.ready.then === 'function') {
      return window.hhIdentity.ready.catch(function(err) {
        if (debug) console.warn('[hhl-enroll] hhIdentity.ready rejected', err);
      });
    }
    return Promise.resolve();
  }

  function buildEnrollmentsUrl(constants, auth) {
    if (!constants || !constants.TRACK_EVENTS_URL) return null;
    if (!auth.enableCrm || (!auth.email && !auth.contactId)) return null;
    var base = constants.TRACK_EVENTS_URL;
    if (base.indexOf('/events/track') >= 0) {
      base = base.replace('/events/track', '');
    }
    var params = [];
    if (auth.email) params.push('email=' + encodeURIComponent(auth.email));
    if (auth.contactId) params.push('contactId=' + encodeURIComponent(auth.contactId));
    return base + '/enrollments/list' + (params.length ? '?' + params.join('&') : '');
  }

  function getActionRunnerBase(constants) {
    if (constants && constants.ACTION_RUNNER_URL) return constants.ACTION_RUNNER_URL;
    return '/learn/action-runner';
  }

  function buildRunnerUrl(base, redirectUrl, params) {
    var runner = base || '/learn/action-runner';
    var search = new URLSearchParams();
    Object.keys(params || {}).forEach(function(key){
      var value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, value);
      }
    });
    if (redirectUrl) {
      search.set('redirect_url', redirectUrl);
    }
    return runner + '?' + search.toString();
  }

  function deriveEnrollmentSource() {
    var currentPath = window.location.pathname.toLowerCase();
    if (currentPath.indexOf('/pathways/') >= 0) return 'pathway_page';
    if (currentPath.indexOf('/courses/') >= 0) return 'course_page';
    if (currentPath.indexOf('/learn') >= 0) return 'catalog';
    return 'unknown';
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

  function fetchEnrollmentFromCRM(constants, auth, contentType, slug) {
    return new Promise(function(resolve) {
      var url = buildEnrollmentsUrl(constants, auth);
      if (!url) {
        resolve(null);
        return;
      }
      fetch(url, {
        credentials: 'omit',
        headers: buildAuthHeaders()
      })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          if (!data || data.mode !== 'authenticated' || !data.enrollments) {
            resolve(null);
            return;
          }
          var list = contentType === 'pathway'
            ? (data.enrollments.pathways || [])
            : (data.enrollments.courses || []);
          var match = list.find(function(entry) { return entry && entry.slug === slug; });
          resolve(match || null);
        })
        .catch(function(err) {
          if (debug) console.warn('[hhl-enroll] Failed to fetch CRM enrollment:', err);
          resolve(null);
        });
    });
  }

  /**
   * Fetch constants.json for API endpoints
   */
  function getConstants(auth, callback) {
    if (!auth.constantsUrl) {
      if (debug) console.log('[hhl-enroll] No constants URL');
      callback({});
      return;
    }

    fetch(auth.constantsUrl)
      .then(function(res) { return res.json(); })
      .then(function(data) { callback(data || {}); })
      .catch(function(err) {
        if (debug) console.error('[hhl-enroll] Failed to fetch constants:', err);
        callback({});
      });
  }

  function consumeRunnerResult(contentType, slug) {
    try {
      var raw = sessionStorage.getItem('hhl_last_action');
      if (!raw) return null;
      var data = JSON.parse(raw);
      var expected = 'enroll_' + contentType;
      if (!data || data.action !== expected) return null;
      if (slug && data.params && data.params.slug && data.params.slug !== slug) return null;
      sessionStorage.removeItem('hhl_last_action');
      return data;
    } catch (error) {
      if (debug) console.warn('[hhl-enroll] Failed to parse runner result:', error);
      try { sessionStorage.removeItem('hhl_last_action'); } catch (cleanupError) {
        if (debug) console.warn('[hhl-enroll] Failed to clear runner result cache:', cleanupError);
      }
      return null;
    }
  }

  function applyRunnerFeedback(result, contentType) {
    if (!result) return;
    if (result.status === 'success') {
      if (window.hhToast) {
        var message = contentType === 'pathway'
          ? 'You are enrolled in this pathway.'
          : 'Course enrollment confirmed.';
        window.hhToast.show(message, 'success', 4200);
      }
    } else if (result.status === 'error') {
      if (window.hhToast) {
        window.hhToast.show('We could not complete your last enrollment. Please try again.', 'error', 5200);
      }
    }
  }

  /**
   * Get enrollment state from localStorage
   */
  function getEnrollmentState(contentType, slug) {
    var key = 'hh-enrollment-' + contentType + '-' + slug;
    var stored = localStorage.getItem(key);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch (error) {
      if (debug) console.warn('[hhl-enroll] Failed to read cached enrollment state:', error);
      return null;
    }
  }

  /**
   * Set enrollment state in localStorage
   */
  function setEnrollmentState(contentType, slug, enrolled, enrolledAt) {
    var key = 'hh-enrollment-' + contentType + '-' + slug;
    var state = {
      enrolled: enrolled,
      enrolled_at: enrolled ? (enrolledAt || new Date().toISOString()) : null
    };

    try {
      localStorage.setItem(key, JSON.stringify(state));
      if (debug) console.log('[hhl-enroll] Saved state:', key, state);
    } catch (error) {
      if (debug) console.error('[hhl-enroll] Failed to save state:', error);
    }
  }

  /**
   * Update button UI based on enrollment state
   */
  function updateButtonUI(button, isEnrolled, contentType) {
    if (isEnrolled) {
      button.innerHTML = contentType === 'pathway'
        ? '✓ Enrolled in Pathway'
        : '✓ Enrolled in Course';
      button.style.background = '#D1FAE5';
      button.style.color = '#065F46';
      button.style.border = '2px solid #6EE7B7';
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.innerHTML = contentType === 'pathway'
        ? 'Enroll in Pathway'
        : 'Start Course';
      button.style.background = '#1a4e8a';
      button.style.color = '#fff';
      button.style.border = 'none';
      button.disabled = false;
      button.style.cursor = 'pointer';
      button.setAttribute('aria-disabled', 'false');
    }
  }

  /**
   * Handle enrollment button click
   */
  function handleEnrollClick(button, contentType, slug, auth, constants) {
    if (button.disabled) return;

    var runnerBase = getActionRunnerBase(constants);
    var redirectPath = window.location.pathname + window.location.search + window.location.hash;
    var actionKey = 'enroll_' + contentType;
    var source = deriveEnrollmentSource();

    // Persist local enrollment flag immediately for optimistic UI
    setEnrollmentState(contentType, slug, true, new Date().toISOString());

    button.disabled = true;
    button.innerHTML = 'Enrolling...';
    button.style.cursor = 'wait';
    button.setAttribute('aria-disabled', 'true');

    updateButtonUI(button, true, contentType);
    unbindClick(button);

    var params = {
      action: actionKey,
      slug: slug,
      source: source
    };

    var courseContext = window.hhCourseContext && window.hhCourseContext.getContext ? window.hhCourseContext.getContext() : null;
    if (courseContext && courseContext.courseSlug) {
      params.course_slug = courseContext.courseSlug;
    }

    setTimeout(function() {
      if (debug) console.log('[hhl-enroll] Redirecting to action runner', params);
      window.location.href = buildRunnerUrl(runnerBase, redirectPath, params);
    }, 150);
  }

  /**
   * Initialize enrollment UI for a specific content item
   * Assumes the server already rendered the correct anonymous/authenticated CTA state.
   */
  function initEnrollmentUI(contentType, slug) {
    var ctaContainer = document.getElementById('hhl-enrollment-cta');
    var helper = document.getElementById('hhl-enroll-helper');
    waitForIdentityReady().finally(function() {
      var auth = getAuth();
      var button = document.getElementById('hhl-enroll-button');

      if (!button && auth && auth.authenticated && ctaContainer) {
        var loginLink = document.getElementById('hhl-enroll-login');
        if (loginLink) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = loginLink.className || 'enrollment-button';
          button.id = 'hhl-enroll-button';
          button.setAttribute('data-content-type', contentType);
          if (slug) button.setAttribute('data-content-slug', slug);
          button.textContent = contentType === 'pathway' ? 'Enroll in Pathway' : 'Start Course';
          ctaContainer.replaceChild(button, loginLink);
          if (helper) {
            helper.style.display = 'none';
            helper.textContent = '';
          }
          if (debug) console.log('[hhl-enroll] Upgraded login link to enrollment button via client identity');
        }
      }

      if (!button) {
        if (debug) console.log('[hhl-enroll] No enrollment button found; CTA remains a login link', { authenticated: auth && auth.authenticated });
        return;
      }

      if (!auth.authenticated) {
        if (debug) console.log('[hhl-enroll] Auth not resolved client-side; CTA handled by server');
        return;
      }

      if (helper) {
        helper.style.display = 'none';
        helper.textContent = '';
      }

      var pendingResult = consumeRunnerResult(contentType, slug);

      getConstants(auth, function(constants) {
        var canCheckCrm = auth.enableCrm && (auth.email || auth.contactId);

        if (!canCheckCrm) {
          if (debug) console.warn('[hhl-enroll] CRM lookup disabled; falling back to local state');
          finalizeWithLocalState(button, contentType, slug, auth, constants, pendingResult);
          return;
        }

        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.innerHTML = 'Checking enrollment...';

        fetchEnrollmentFromCRM(constants, auth, contentType, slug).then(function(match) {
          if (match) {
            setEnrollmentState(contentType, slug, true, match.enrolled_at || undefined);
          }

          var localState = getEnrollmentState(contentType, slug);
          var isEnrolled = !!match || (localState && localState.enrolled);

          if (isEnrolled) {
            updateButtonUI(button, true, contentType);
            unbindClick(button);
          } else {
            updateButtonUI(button, false, contentType);
            bindClick(button, function() {
              handleEnrollClick(button, contentType, slug, auth, constants);
            });
          }

          if (pendingResult) {
            applyRunnerFeedback(pendingResult, contentType);
            pendingResult = null;
          }

          if (debug) console.log('[hhl-enroll] Initialized (CRM)', { contentType: contentType, slug: slug, enrolled: isEnrolled });
        }).catch(function() {
          if (debug) console.warn('[hhl-enroll] CRM lookup failed; reverting to local state');
          finalizeWithLocalState(button, contentType, slug, auth, constants, pendingResult);
        });
      });
    });
  }

  function finalizeWithLocalState(button, contentType, slug, auth, constants, pendingResult) {
    var state = getEnrollmentState(contentType, slug);
    var fallbackEnrolled = !!(state && state.enrolled);
    updateButtonUI(button, fallbackEnrolled, contentType);
    if (!fallbackEnrolled) {
      bindClick(button, function() {
        handleEnrollClick(button, contentType, slug, auth, constants || {});
      });
    } else {
      unbindClick(button);
    }
    if (pendingResult) {
      applyRunnerFeedback(pendingResult, contentType);
    }
  }

  /**
   * Add CSS for toast animations
   */
  function addToastStyles() {
    if (document.getElementById('hhl-toast-styles')) return;

    var style = document.createElement('style');
    style.id = 'hhl-toast-styles';
    style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(style);
  }

  /**
   * Initialize on DOM ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addToastStyles();
      // Initialization happens when called externally with initEnrollmentUI
    });
  } else {
    addToastStyles();
  }

  // Expose init function globally
  window.hhInitEnrollment = initEnrollmentUI;

  if (debug) console.log('[hhl-enroll] enrollment.js loaded');
})();
