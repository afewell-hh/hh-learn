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
    return base + separator + 'redirect_url=' + encodeURIComponent(window.location.pathname + window.location.search);
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

  function fetchEnrollmentFromCRM(constants, auth, contentType, slug) {
    return new Promise(function(resolve) {
      var url = buildEnrollmentsUrl(constants, auth);
      if (!url) {
        resolve(null);
        return;
      }
      fetch(url, { credentials: 'omit' })
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

  /**
   * Send enrollment beacon to backend
   */
  function sendEnrollmentBeacon(constants, auth, contentType, slug) {
    if (!constants || !constants.TRACK_EVENTS_URL) {
      if (debug) console.log('[hhl-enroll] No tracking URL configured');
      return;
    }

    var eventName = contentType === 'pathway'
      ? 'learning_pathway_enrolled'
      : 'learning_course_enrolled';

    var payload = {
      ts: new Date().toISOString()
    };

    // Determine enrollment source from current page
    var enrollmentSource = 'unknown';
    var currentPath = window.location.pathname.toLowerCase();
    if (currentPath.includes('/pathways/')) {
      enrollmentSource = 'pathway_page';
    } else if (currentPath.includes('/courses/')) {
      enrollmentSource = 'course_page';
    } else if (currentPath.includes('/learn') || currentPath === '/') {
      enrollmentSource = 'catalog';
    }

    var eventData = {
      eventName: eventName,
      payload: payload,
      enrollment_source: enrollmentSource
    };

    // Add slug as top-level field for easier backend processing
    if (contentType === 'pathway') {
      eventData.pathway_slug = slug;
    } else {
      eventData.course_slug = slug;
    }

    // Add contact identifier if authenticated
    if (auth.enableCrm && (auth.email || auth.contactId)) {
      eventData.contactIdentifier = {};
      if (auth.email) eventData.contactIdentifier.email = auth.email;
      if (auth.contactId) eventData.contactIdentifier.contactId = auth.contactId;
    }

    if (debug) console.log('[hhl-enroll] Sending beacon:', eventData);

    // Use sendBeacon if available, otherwise fetch
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
      navigator.sendBeacon(constants.TRACK_EVENTS_URL, blob);
    } else {
      fetch(constants.TRACK_EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        credentials: 'omit',
        keepalive: true
      }).catch(function(err) {
        if (debug) console.error('[hhl-enroll] Beacon failed:', err);
      });
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
    } catch (e) {
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
    } catch (e) {
      if (debug) console.error('[hhl-enroll] Failed to save state:', e);
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, type) {
    // Check if toast container exists, create if not
    var container = document.getElementById('hhl-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hhl-toast-container';
      container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
      document.body.appendChild(container);
    }

    // Create toast element
    var toast = document.createElement('div');
    toast.className = 'hhl-toast hhl-toast-' + type;
    toast.style.cssText = [
      'background: ' + (type === 'success' ? '#D1FAE5' : '#FEF3C7'),
      'border: 1px solid ' + (type === 'success' ? '#6EE7B7' : '#FCD34D'),
      'color: ' + (type === 'success' ? '#065F46' : '#92400E'),
      'padding: 12px 20px',
      'border-radius: 8px',
      'margin-bottom: 10px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
      'min-width: 250px',
      'font-size: 0.875rem',
      'font-weight: 500',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'animation: slideIn 0.3s ease-out'
    ].join(';');

    var icon = type === 'success' ? '✓' : 'ℹ️';
    toast.innerHTML = '<span style="font-size:1.2em">' + icon + '</span><span>' + message + '</span>';

    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(function() {
        container.removeChild(toast);
      }, 300);
    }, 3000);
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
    // Prevent double-clicks
    if (button.disabled) return;

    button.disabled = true;
    button.innerHTML = 'Enrolling...';
    button.setAttribute('aria-disabled', 'true');

    // Set enrollment state
    setEnrollmentState(contentType, slug, true);

    // Send beacon
    sendEnrollmentBeacon(constants, auth, contentType, slug);

    // Update UI after brief delay (simulate network request)
    setTimeout(function() {
      updateButtonUI(button, true, contentType);
      unbindClick(button);

      var message = contentType === 'pathway'
        ? 'Successfully enrolled in pathway!'
        : 'Successfully enrolled in course!';
      showToast(message, 'success');

      if (debug) console.log('[hhl-enroll] Enrollment complete:', contentType, slug);
    }, 500);
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
            return;
          }

          updateButtonUI(button, false, contentType);
          bindClick(button, function() {
            handleEnrollClick(button, contentType, slug, auth, constants);
          });

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
