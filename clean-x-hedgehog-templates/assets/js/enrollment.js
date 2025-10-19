/**
 * Enrollment Management for Pathways and Courses
 * Handles explicit enrollment flows with localStorage persistence and CRM sync
 */

(function() {
  'use strict';

  var debug = localStorage.getItem('HHL_DEBUG') === 'true';

  /**
   * Get authentication context from hidden div
   */
  function getAuth() {
    var authDiv = document.getElementById('hhl-auth-context');
    if (!authDiv) return { enableCrm: false };

    return {
      email: authDiv.getAttribute('data-email') || '',
      contactId: authDiv.getAttribute('data-contact-id') || '',
      enableCrm: authDiv.getAttribute('data-enable-crm') === 'true',
      constantsUrl: authDiv.getAttribute('data-constants-url') || ''
    };
  }

  /**
   * Fetch constants.json for API endpoints
   */
  function getConstants(auth, callback) {
    if (!auth.constantsUrl) {
      if (debug) console.log('[hhl-enroll] No constants URL');
      callback(null);
      return;
    }

    fetch(auth.constantsUrl)
      .then(function(res) { return res.json(); })
      .then(function(data) { callback(data); })
      .catch(function(err) {
        if (debug) console.error('[hhl-enroll] Failed to fetch constants:', err);
        callback(null);
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
  function setEnrollmentState(contentType, slug, enrolled) {
    var key = 'hh-enrollment-' + contentType + '-' + slug;
    var state = {
      enrolled: enrolled,
      enrolled_at: enrolled ? new Date().toISOString() : null
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
    } else {
      button.innerHTML = contentType === 'pathway'
        ? 'Enroll in Pathway'
        : 'Start Course';
      button.style.background = '#1a4e8a';
      button.style.color = '#fff';
      button.style.border = 'none';
      button.disabled = false;
      button.style.cursor = 'pointer';
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

    // Set enrollment state
    setEnrollmentState(contentType, slug, true);

    // Send beacon
    sendEnrollmentBeacon(constants, auth, contentType, slug);

    // Update UI after brief delay (simulate network request)
    setTimeout(function() {
      updateButtonUI(button, true, contentType);

      var message = contentType === 'pathway'
        ? 'Successfully enrolled in pathway!'
        : 'Successfully enrolled in course!';
      showToast(message, 'success');

      if (debug) console.log('[hhl-enroll] Enrollment complete:', contentType, slug);
    }, 500);
  }

  /**
   * Initialize enrollment UI for a specific content item
   */
  function initEnrollmentUI(contentType, slug) {
    var auth = getAuth();

    // Only show enrollment CTA for authenticated users
    if (!auth.email && !auth.contactId) {
      if (debug) console.log('[hhl-enroll] User not authenticated, hiding enrollment CTA');
      var ctaBlock = document.getElementById('hhl-enrollment-cta');
      if (ctaBlock) {
        ctaBlock.style.display = 'none';
      }
      return;
    }

    // Get enrollment button
    var button = document.getElementById('hhl-enroll-button');
    if (!button) {
      if (debug) console.log('[hhl-enroll] No enrollment button found');
      return;
    }

    // Check current enrollment state
    var state = getEnrollmentState(contentType, slug);
    var isEnrolled = state && state.enrolled;

    // Update button UI
    updateButtonUI(button, isEnrolled, contentType);

    // If not enrolled, set up click handler
    if (!isEnrolled) {
      getConstants(auth, function(constants) {
        button.addEventListener('click', function() {
          handleEnrollClick(button, contentType, slug, auth, constants);
        });

        if (debug) console.log('[hhl-enroll] Initialized:', { contentType, slug, auth: !!auth.email });
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
