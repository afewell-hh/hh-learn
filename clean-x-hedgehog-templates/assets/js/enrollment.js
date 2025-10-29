/**
 * Enrollment Management for Pathways and Courses
 * Handles explicit enrollment flows with localStorage persistence and CRM sync
 */

(function() {
  'use strict';

  var debug = localStorage.getItem('HHL_DEBUG') === 'true';

  /**
   * Get authentication context from window.hhIdentity API
   * Falls back to #hhl-auth-context div for non-identity fields (constants, login URLs)
   */
  function getAuth() {
    // Get identity from window.hhIdentity (uses actual membership session, not personalization tokens)
    var identity = window.hhIdentity ? window.hhIdentity.get() : null;
    var email = '';
    var contactId = '';

    if (identity) {
      email = identity.email || '';
      contactId = identity.contactId || '';
    }

    // Get other config from auth context div
    var authDiv = document.getElementById('hhl-auth-context');
    var enableCrm = false;
    var constantsUrl = '';
    var loginUrl = '';

    if (authDiv) {
      var enableAttr = authDiv.getAttribute('data-enable-crm');
      if (enableAttr) {
        enableCrm = enableAttr.toString().toLowerCase() === 'true';
      }
      constantsUrl = authDiv.getAttribute('data-constants-url') || '';
      loginUrl = authDiv.getAttribute('data-login-url') || '';
    }

    if (debug) {
      console.log('[hhl-enroll] Auth context:', {
        hasEmail: !!email,
        hasContactId: !!contactId,
        enableCrm: enableCrm,
        source: identity ? 'hhIdentity' : 'fallback'
      });
    }

    return {
      email: email,
      contactId: contactId,
      enableCrm: enableCrm,
      constantsUrl: constantsUrl,
      loginUrl: loginUrl
    };
  }

  function deriveLoginUrl(auth, constants) {
    if (auth && auth.loginUrl) return auth.loginUrl;
    if (constants && constants.LOGIN_URL) return constants.LOGIN_URL;
    return '/_hcms/mem/login';
  }

  function buildLoginRedirect(loginUrl) {
    var base = loginUrl || '/_hcms/mem/login';
    var separator = base.indexOf('?') >= 0 ? '&' : '?';
    // Redirect to handshake page to capture identity, then back to current page (Issue #244)
    var handshakeUrl = '/learn/auth-handshake?redirect_url=' + encodeURIComponent(window.location.pathname + window.location.search);
    return base + separator + 'redirect_url=' + encodeURIComponent(handshakeUrl);
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

  function renderSignInState(button, helper, loginUrl, contentType) {
    if (!button) return;
    unbindClick(button);
    button.disabled = false;
    button.setAttribute('aria-disabled', 'false');
    button.innerHTML = contentType === 'pathway'
      ? 'Sign in to enroll'
      : 'Sign in to start course';
    button.style.background = '#1a4e8a';
    button.style.color = '#fff';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    var redirect = buildLoginRedirect(loginUrl);
    bindClick(button, function(event) {
      event.preventDefault();
      window.location.href = redirect;
    });

    if (helper) {
      helper.style.display = 'block';
      helper.innerHTML = 'Please <a href="' + redirect + '">sign in</a> to ' + (contentType === 'pathway' ? 'enroll in this pathway.' : 'start this course.');
    }
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
   * Posts enrollment event directly to /events/track (Issue #276 fix)
   */
  function handleEnrollClick(button, contentType, slug, auth, constants) {
    if (button.disabled) return;

    var source = deriveEnrollmentSource();
    var timestamp = new Date().toISOString();

    // Persist local enrollment flag immediately for optimistic UI
    setEnrollmentState(contentType, slug, true, timestamp);

    button.disabled = true;
    button.innerHTML = 'Enrolling...';
    button.style.cursor = 'wait';
    button.setAttribute('aria-disabled', 'true');

    // Build enrollment event payload
    var eventName = contentType === 'pathway' ? 'learning_pathway_enrolled' : 'learning_course_enrolled';
    var eventPayload = {
      eventName: eventName,
      payload: {
        ts: timestamp,
        enrollment_source: source
      }
    };

    // Add slug fields
    if (contentType === 'pathway') {
      eventPayload.pathway_slug = slug;
      eventPayload.payload.pathway_slug = slug;
    } else {
      eventPayload.course_slug = slug;
      eventPayload.payload.course_slug = slug;

      // Add pathway context if in a course within a pathway
      var courseContext = window.hhCourseContext && window.hhCourseContext.getContext ? window.hhCourseContext.getContext() : null;
      if (courseContext && courseContext.pathwaySlug) {
        eventPayload.pathway_slug = courseContext.pathwaySlug;
        eventPayload.payload.pathway_slug = courseContext.pathwaySlug;
      }
    }

    if (debug) console.log('[hhl-enroll] Posting enrollment event:', eventPayload);

    // POST enrollment event directly to /events/track
    var trackUrl = constants && constants.TRACK_EVENTS_URL;
    if (!trackUrl) {
      console.error('[hhl-enroll] TRACK_EVENTS_URL not configured');
      updateButtonUI(button, true, contentType);
      saveEnrollmentResult('error', contentType, slug, 'missing_track_url');
      if (window.hhToast) {
        window.hhToast.show('Enrollment configuration error', 'error', 5000);
      }
      return;
    }

    fetch(trackUrl, {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify(eventPayload),
      credentials: 'omit'
    })
      .then(function(response) {
        if (!response.ok) {
          return response.json().then(function(error) {
            throw new Error(error.error || 'HTTP ' + response.status);
          });
        }
        return response.json();
      })
      .then(function(data) {
        if (debug) console.log('[hhl-enroll] Enrollment event tracked:', data);

        // Update UI to enrolled state
        updateButtonUI(button, true, contentType);

        // Save success result
        saveEnrollmentResult('success', contentType, slug);

        // Show success toast
        if (window.hhToast) {
          var message = contentType === 'pathway'
            ? 'You are enrolled in this pathway.'
            : 'Course enrollment confirmed.';
          window.hhToast.show(message, 'success', 4200);
        }
      })
      .catch(function(error) {
        console.error('[hhl-enroll] Enrollment failed:', error);

        // Keep optimistic UI but save error
        updateButtonUI(button, true, contentType);
        saveEnrollmentResult('error', contentType, slug, error.message);

        // Show error toast
        if (window.hhToast) {
          window.hhToast.show('Enrollment saved locally. Will sync when online.', 'warning', 5000);
        }
      });
  }

  /**
   * Save enrollment result to sessionStorage for feedback
   */
  function saveEnrollmentResult(status, contentType, slug, errorMessage) {
    try {
      var result = {
        status: status,
        action: 'enroll_' + contentType,
        params: { slug: slug },
        timestamp: new Date().toISOString()
      };
      if (errorMessage) {
        result.error = errorMessage;
      }
      sessionStorage.setItem('hhl_last_action', JSON.stringify(result));
      if (debug) console.log('[hhl-enroll] Saved enrollment result:', result);
    } catch (e) {
      if (debug) console.warn('[hhl-enroll] Cannot save result:', e);
    }
  }

  /**
   * Initialize enrollment UI for a specific content item
   * Waits for window.hhIdentity to be ready before checking authentication
   */
  function initEnrollmentUI(contentType, slug) {
    // Get enrollment button
    var button = document.getElementById('hhl-enroll-button');
    if (!button) {
      if (debug) console.log('[hhl-enroll] No enrollment button found');
      return;
    }

    var helper = document.getElementById('hhl-enroll-helper');

    // Wait for identity to be resolved before proceeding
    if (window.hhIdentity && window.hhIdentity.ready) {
      window.hhIdentity.ready.then(function() {
        proceedWithInit();
      }).catch(function(err) {
        if (debug) console.warn('[hhl-enroll] Identity check failed, proceeding anyway:', err);
        proceedWithInit();
      });
    } else {
      // Fallback if hhIdentity not available (shouldn't happen if auth-context.js loaded)
      if (debug) console.warn('[hhl-enroll] window.hhIdentity not available, proceeding without it');
      proceedWithInit();
    }

    function proceedWithInit() {
      var auth = getAuth();
      var pendingResult = consumeRunnerResult(contentType, slug);

      getConstants(auth, function(constants) {
        var loginUrl = deriveLoginUrl(auth, constants);

        if (!auth.email && !auth.contactId) {
          renderSignInState(button, helper, loginUrl, contentType);
          return;
        }

        if (helper) {
          helper.style.display = 'none';
          helper.textContent = '';
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
            if (pendingResult) {
              applyRunnerFeedback(pendingResult, contentType);
              pendingResult = null;
            }
            return;
          }

          updateButtonUI(button, false, contentType);
          bindClick(button, function() {
            handleEnrollClick(button, contentType, slug, auth, constants);
          });

          if (pendingResult) {
            applyRunnerFeedback(pendingResult, contentType);
            pendingResult = null;
          }

          if (debug) console.log('[hhl-enroll] Initialized (CRM)', { contentType: contentType, slug: slug });
        }).catch(function() {
          if (debug) console.warn('[hhl-enroll] Falling back to local enrollment state');
          var state = getEnrollmentState(contentType, slug);
          var fallbackEnrolled = state && state.enrolled;
          updateButtonUI(button, !!fallbackEnrolled, contentType);
          if (!fallbackEnrolled) {
            bindClick(button, function() {
              handleEnrollClick(button, contentType, slug, auth, constants);
            });
          } else {
            unbindClick(button);
          }
          if (pendingResult) {
            applyRunnerFeedback(pendingResult, contentType);
            pendingResult = null;
          }
        });
      });
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
