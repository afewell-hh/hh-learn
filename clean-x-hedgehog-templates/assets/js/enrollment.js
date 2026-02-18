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

  function waitForIdentityReady() {
    try {
      if (window.hhIdentity && window.hhIdentity.ready && typeof window.hhIdentity.ready.then === 'function') {
        return window.hhIdentity.ready;
      }
    } catch (error) {
      if (debug) console.warn('[hhl-enroll] Failed to read hhIdentity.ready:', error);
    }
    return Promise.resolve(null);
  }

  function getAuth() {
    var el = document.getElementById('hhl-auth-context');
    var identity = (window.hhIdentity && typeof window.hhIdentity.get === 'function')
      ? window.hhIdentity.get()
      : null;
    var authenticated = identity ? !!identity.authenticated : parseBoolean(el && el.getAttribute('data-authenticated'));
    var email = identity && identity.email ? identity.email : (el && el.getAttribute('data-email')) || null;
    var contactId = identity && identity.contactId ? identity.contactId : (el && el.getAttribute('data-contact-id')) || null;
    return {
      authenticated: authenticated,
      email: email,
      contactId: contactId,
      enableCrm: parseBoolean(el && el.getAttribute('data-enable-crm')),
      trackEventsUrl: el && el.getAttribute('data-track-events-url')
    };
  }

  function fetchEnrollmentFromCRM(constants, auth, contentType, slug) {
    return new Promise(function(resolve) {
      var url = buildEnrollmentsUrl(constants, auth);
      if (!url) {
        resolve(null);
        return;
      }
      fetch(url, {
        credentials: 'include'
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
   * Get constants from data attributes (Issue #345 - no more CORS fetch)
   */
  function getConstants(auth, callback) {
    // Return constants synchronously from data attributes
    callback({
      TRACK_EVENTS_URL: auth.trackEventsUrl || null,
      ACTION_RUNNER_URL: '/learn/action-runner'
    });
  }

  function buildEnrollmentsUrl(constants, auth) {
    var track = (constants && constants.TRACK_EVENTS_URL) || (auth && auth.trackEventsUrl) || '';
    if (!track) return null;

    var base = track.indexOf('/events/track') >= 0
      ? track.replace('/events/track', '/enrollments/list')
      : track.replace(/\/?$/, '/enrollments/list');

    if (!auth || (!auth.email && !auth.contactId)) return base;
    var query = auth.contactId
      ? 'contactId=' + encodeURIComponent(auth.contactId)
      : 'email=' + encodeURIComponent(auth.email);
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + query;
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

  function deriveEnrollmentSource() {
    var path = window.location.pathname || '';
    if (path.indexOf('/pathways/') >= 0) return 'pathway_page';
    if (path.indexOf('/courses/') >= 0) return 'course_page';
    if (path.indexOf('/modules/') >= 0) return 'module_page';
    return 'learn_page';
  }

  function bindClick(button, handler) {
    if (!button || typeof handler !== 'function') return;
    unbindClick(button);
    var wrapped = function(event) {
      if (event) event.preventDefault();
      handler();
    };
    button.__hhlEnrollHandler = wrapped;
    button.addEventListener('click', wrapped);
  }

  function unbindClick(button) {
    if (!button) return;
    var existing = button.__hhlEnrollHandler;
    if (existing) {
      button.removeEventListener('click', existing);
      button.__hhlEnrollHandler = null;
    }
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
   * Re-initialize enrollment UI when auth state changes (Issue #345)
   */
  var currentContentType = null;
  var currentSlug = null;

  function detectEnrollmentContext() {
    var cta = document.getElementById('hhl-enrollment-cta');
    if (!cta) return null;
    var contentType = cta.getAttribute('data-content-type') || '';
    var slug = cta.getAttribute('data-content-slug') || '';

    if (!slug) {
      var authCtx = document.getElementById('hhl-auth-context');
      if (authCtx) {
        slug = authCtx.getAttribute('data-course-slug') ||
               authCtx.getAttribute('data-pathway-slug') ||
               authCtx.getAttribute('data-module-slug') ||
               '';
      }
    }

    if (!contentType) return null;
    return { contentType: contentType, slug: slug };
  }

  function initEnrollmentUIWrapper(contentType, slug) {
    currentContentType = contentType;
    currentSlug = slug;
    initEnrollmentUI(contentType, slug);
  }

  // Listen for auth state changes from cognito-auth-integration.js
  document.addEventListener('hhl:identity', function(event) {
    if (debug) console.log('[hhl-enroll] Auth state changed, re-initializing enrollment UI');
    if (!currentContentType) {
      var ctx = detectEnrollmentContext();
      if (ctx) {
        initEnrollmentUIWrapper(ctx.contentType, ctx.slug);
        return;
      }
    }
    if (currentContentType) {
      initEnrollmentUI(currentContentType, currentSlug || '');
    }
  });

  /**
   * Initialize on DOM ready
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addToastStyles();
      var ctx = detectEnrollmentContext();
      if (ctx) {
        initEnrollmentUIWrapper(ctx.contentType, ctx.slug);
      }
    });
  } else {
    addToastStyles();
    var ctxNow = detectEnrollmentContext();
    if (ctxNow) {
      initEnrollmentUIWrapper(ctxNow.contentType, ctxNow.slug);
    }
  }

  // Expose init function globally
  window.hhInitEnrollment = initEnrollmentUIWrapper;

  if (debug) console.log('[hhl-enroll] enrollment.js loaded');
})();
