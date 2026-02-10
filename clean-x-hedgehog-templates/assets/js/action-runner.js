/**
 * Hedgehog Learn – Private Action Runner (Issue #245)
 * Executes enrollment and progress operations on a private HubSpot page
 * so public pages never need to send contact identifiers with actions.
 */
(function(){
  'use strict';

  function ready(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function parseJSON(value, fallback){
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function sanitizeRedirect(url){
    if (!url) return '/learn';
    try {
      var anchor = document.createElement('a');
      anchor.href = url;
      if (!anchor.host) {
        return url.charAt(0) === '/' ? url : '/learn';
      }
      if (anchor.host !== window.location.host) return '/learn';
      return anchor.pathname + anchor.search + anchor.hash;
    } catch {
      return '/learn';
    }
  }

  function buildLoginRedirect(loginUrl, redirectUrl){
    var base = loginUrl || '/_hcms/mem/login';
    var target = redirectUrl || '/learn';
    var join = base.indexOf('?') >= 0 ? '&' : '?';
    return base + join + 'redirect_url=' + encodeURIComponent(target);
  }

  function redirectToLogin(loginUrl, redirectUrl){
    var target = redirectUrl || (window.location.pathname + window.location.search + window.location.hash);
    if (window.hhLoginHelper && typeof window.hhLoginHelper.login === 'function') {
      window.hhLoginHelper.login(target);
      return;
    }
    window.location.href = buildLoginRedirect(loginUrl, target);
  }

  function setStatus(opts){
    var titleEl = document.getElementById('action-runner-title');
    var messageEl = document.getElementById('action-runner-message');
    var detailsEl = document.getElementById('action-runner-details');
    var spinnerEl = document.getElementById('action-runner-spinner');
    var badgeEl = document.getElementById('runner-badge');
    var iconEl = document.getElementById('runner-icon');

    if (opts.icon && iconEl) iconEl.textContent = opts.icon;
    if (opts.badge && badgeEl) badgeEl.textContent = opts.badge;
    if (titleEl && typeof opts.title === 'string') titleEl.textContent = opts.title;
    if (messageEl && typeof opts.message === 'string') messageEl.textContent = opts.message;
    if (detailsEl) {
      if (opts.details) {
        detailsEl.innerHTML = opts.details;
        detailsEl.style.display = 'block';
      } else {
        detailsEl.innerHTML = '';
        detailsEl.style.display = 'none';
      }
    }
    if (spinnerEl) spinnerEl.style.display = opts.showSpinner ? 'block' : 'none';
  }

  function showActions(primaryLabel, primaryHandler, secondaryHref){
    var actionsEl = document.getElementById('action-runner-actions');
    var primaryBtn = document.getElementById('action-runner-primary');
    var secondaryBtn = document.getElementById('action-runner-secondary');
    if (!actionsEl || !primaryBtn || !secondaryBtn) return;
    actionsEl.style.display = 'flex';
    primaryBtn.textContent = primaryLabel || 'Return to Learn';
    primaryBtn.onclick = null;
    if (typeof primaryHandler === 'function') {
      primaryBtn.addEventListener('click', function(evt){
        evt.preventDefault();
        primaryHandler();
      }, { once: true });
    } else if (typeof primaryHandler === 'string') {
      primaryBtn.href = primaryHandler;
    }
    if (secondaryHref) secondaryBtn.href = secondaryHref;
  }

  function storeResult(payload){
    try {
      sessionStorage.setItem('hhl_last_action', JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }

  function buildEventPayload(actionKey, params, status){
    var now = new Date().toISOString();
    if (actionKey === 'enroll_pathway') {
      return [{
        eventName: 'learning_pathway_enrolled',
        payload: {
          pathway_slug: params.slug,
          course_slug: params.course_slug || null,
          ts: now
        },
        enrollment_source: params.source || 'action_runner'
      }];
    }
    if (actionKey === 'enroll_course') {
      return [{
        eventName: 'learning_course_enrolled',
        payload: {
          course_slug: params.slug,
          pathway_slug: params.pathway_slug || null,
          ts: now
        },
        enrollment_source: params.source || 'action_runner'
      }];
    }
    if (actionKey === 'record_progress') {
      var modulePayload = {
        module_slug: params.module_slug,
        pathway_slug: params.pathway_slug || null,
        course_slug: params.course_slug || null,
        ts: now
      };
      if (status === 'completed') {
        return [
          { eventName: 'learning_module_started', payload: modulePayload },
          { eventName: 'learning_module_completed', payload: modulePayload }
        ];
      }
      return [{ eventName: 'learning_module_started', payload: modulePayload }];
    }
    return [];
  }

  function parseTrackResponse(response){
    if (!response.ok) {
      return response.text().then(function(text){
        var error = new Error('Track endpoint returned ' + response.status);
        error.responseText = text;
        error.code = 'http_' + response.status;
        throw error;
      });
    }

    var contentType = response.headers && response.headers.get ? response.headers.get('content-type') || '' : '';

    if (contentType.indexOf('application/json') >= 0) {
      return response.json().catch(function(){
        return {};
      });
    }

    return response.text().then(function(text){
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    });
  }

  function ensurePersisted(result){
    if (result && result.status === 'persisted' && result.mode === 'authenticated') {
      return result;
    }

    var error = new Error('Event did not persist to CRM');
    if (result && result.mode === 'anonymous') {
      error.code = 'missing_identity';
    } else {
      error.code = 'persistence_unconfirmed';
    }
    error.responseData = result || null;
    throw error;
  }

  function executeEvents(trackUrl, contactIdentifier, events){
    if (!events.length) return Promise.resolve();
    var queue = Promise.resolve();
    events.forEach(function(evt){
      queue = queue.then(function(){
        var body = {
          eventName: evt.eventName,
          payload: evt.payload
        };
        if (evt.enrollment_source) {
          body.enrollment_source = evt.enrollment_source;
        }
        if (contactIdentifier && (contactIdentifier.email || contactIdentifier.contactId)) {
          body.contactIdentifier = {};
          if (contactIdentifier.email) body.contactIdentifier.email = contactIdentifier.email;
          if (contactIdentifier.contactId) body.contactIdentifier.contactId = contactIdentifier.contactId;
        }
        return fetch(trackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify(body)
        })
          .then(parseTrackResponse)
          .then(ensurePersisted);
      });
    });
    return queue;
  }

  function runAction(context, params, redirectUrl){
    var actionKey = context.actionKey;
    var status = params.get('status') || '';
    var payloadEvents = buildEventPayload(actionKey, {
      slug: params.get('slug'),
      source: params.get('source'),
      course_slug: params.get('course_slug'),
      pathway_slug: params.get('pathway_slug'),
      module_slug: params.get('module_slug')
    }, status);

    if (!payloadEvents.length) {
      var err = new Error('Unsupported action payload');
      err.code = 'payload_unsupported';
      return Promise.reject(err);
    }

    return executeEvents(context.trackUrl, context.contactIdentifier, payloadEvents).then(function(){
      storeResult({
        action: actionKey,
        status: 'success',
        redirect: redirectUrl,
        timestamp: new Date().toISOString(),
        params: {
          slug: params.get('slug'),
          module_slug: params.get('module_slug'),
          status: status,
          source: params.get('source') || null
        }
      });
    });
  }

  function humanize(actionKey, phase){
    var base = {
      'enroll_pathway': { start: 'Enrolling you in the pathway…', success: 'Pathway enrolled!', failure: 'Unable to enroll in the pathway.' },
      'enroll_course': { start: 'Enrolling you in the course…', success: 'Course enrolled!', failure: 'Unable to enroll in the course.' },
      'record_progress': { start: 'Saving your progress…', success: 'Progress saved!', failure: 'Unable to save your progress.' }
    };
    var phrases = base[actionKey] || base.record_progress;
    return phrases[phase] || '';
  }

  function validateRequired(config, params){
    var missing = [];
    (config.required || []).forEach(function(name){
      if (!params.get(name)) missing.push(name);
    });
    return missing;
  }

  ready(function(){
    var contextNode = document.getElementById('hhl-action-runner');
    if (!contextNode) return;
    if (contextNode.dataset.isEditor === 'true') return;

    var params = new URLSearchParams(window.location.search);
    var actionKey = (params.get('action') || '').toLowerCase();
    var redirectUrl = sanitizeRedirect(params.get('redirect_url') || '/learn');
    var allowedActions = parseJSON(contextNode.dataset.actions, {});
    var trackUrl = contextNode.dataset.trackUrl || '';
    var loginUrl = contextNode.dataset.loginUrl || 'https://api.hedgehog.cloud/auth/login';

    // Ensure secondary button always points home page to keep exit path
    var secondaryBtn = document.getElementById('action-runner-secondary');
    if (secondaryBtn) secondaryBtn.href = redirectUrl;

    // Check action validity BEFORE auth - preserve previous behavior
    if (!actionKey || !allowedActions[actionKey]) {
      setStatus({
        icon: '⛔️',
        badge: 'Action blocked',
        title: 'Unsupported action requested',
        message: 'The requested action is not on the approved whitelist.',
        details: 'Double-check the link you used. If this keeps happening, contact support.',
        showSpinner: false
      });
      showActions('Return to Learn', function(){ window.location.href = '/learn'; }, redirectUrl);
      return;
    }

    // Wait for Cognito identity to be ready
    // DO NOT use server-side dataset.isLoggedIn - it reflects HubSpot Membership, not Cognito
    if (!window.hhIdentity || !window.hhIdentity.ready) {
      setStatus({
        icon: '⚠️',
        badge: 'Auth not ready',
        title: 'Authentication system not loaded',
        message: 'Please refresh the page to complete this action.',
        showSpinner: false
      });
      showActions('Refresh page', function(){ window.location.reload(); }, redirectUrl);
      return;
    }

    // Use window.hhIdentity.ready promise to wait for auth state
    window.hhIdentity.ready
      .then(function() {
        var identityData = window.hhIdentity.get() || {};
        var isLoggedIn = window.hhIdentity.isAuthenticated();
        var contactIdentifier = {
          email: identityData.email || '',
          contactId: identityData.contactId || ''
        };

        // Action already validated above - check auth state

        if (!isLoggedIn) {
      setStatus({
        icon: '🔒',
        badge: 'Sign-in required',
        title: 'Please sign in to continue',
        message: 'This secure action can only run while you are signed in.',
        details: 'You will be redirected to the login screen so we can verify your identity safely.',
        showSpinner: false
      });
      showActions('Sign in to continue', function(){
        redirectToLogin(loginUrl, window.location.pathname + window.location.search + window.location.hash);
      }, '/learn');
      return;
    }

    if (!trackUrl) {
      setStatus({
        icon: '⚠️',
        badge: 'Configuration error',
        title: 'Missing action endpoint',
        message: 'We could not locate the backend endpoint required to run this action.',
        details: 'Try reloading the page. If the problem persists, contact the Learn team.',
        showSpinner: false
      });
      showActions('Reload', function(){ window.location.reload(); }, redirectUrl);
      return;
    }

    if (!contactIdentifier.email && !contactIdentifier.contactId) {
      setStatus({
        icon: '🛑',
        badge: 'Identity unavailable',
        title: 'We could not verify your identity',
        message: 'Please sign in again so we can complete this action securely.',
        showSpinner: false
      });
      showActions('Sign in again', function(){
        redirectToLogin(loginUrl, window.location.pathname + window.location.search + window.location.hash);
      }, '/learn');
      return;
    }

    var actionConfig = allowedActions[actionKey] || {};
    var missingParams = validateRequired(actionConfig, params);
    if (missingParams.length) {
      setStatus({
        icon: '📝',
        badge: 'Incomplete request',
        title: 'Missing required information',
        message: 'We need a bit more detail to finish this action.',
        details: 'Missing parameters: <strong>' + missingParams.join(', ') + '</strong>',
        showSpinner: false
      });
      showActions('Return to previous page', function(){ window.location.href = redirectUrl; }, '/learn');
      return;
    }

    setStatus({
      icon: '⚙️',
      badge: 'Processing',
      title: humanize(actionKey, 'start'),
      message: 'We are securely contacting the Hedgehog Learn backend. This usually takes a moment.',
      details: '',
      showSpinner: true
    });

    runAction({
      actionKey: actionKey,
      trackUrl: trackUrl,
      contactIdentifier: contactIdentifier
    }, params, redirectUrl).then(function(){
      setStatus({
        icon: '✅',
        badge: 'Success',
        title: humanize(actionKey, 'success'),
        message: 'Redirecting you back in just a moment.',
        details: '',
        showSpinner: false
      });
      showActions('Return now', function(){ window.location.href = redirectUrl; }, redirectUrl);
      setTimeout(function(){
        window.location.href = redirectUrl;
      }, 1200);
    }).catch(function(error){
      console.error('[hhl-action-runner] Action failed:', error);
      storeResult({
        action: actionKey,
        status: 'error',
        redirect: redirectUrl,
        timestamp: new Date().toISOString(),
        error: error && error.message ? error.message : 'unknown'
      });
      var detail = '';
      if (error && error.responseData) {
        try {
          var pretty = JSON.stringify(error.responseData, null, 2);
          detail = '<pre style="text-align:left; white-space:pre-wrap;">' + pretty.substring(0, 600) + '</pre>';
        } catch {
          detail = '<pre style="text-align:left; white-space:pre-wrap;">' + String(error.responseData).substring(0, 400) + '</pre>';
        }
      } else if (error && error.responseText) {
        detail = '<pre style="text-align:left; white-space:pre-wrap;">' + error.responseText.substring(0, 400) + '</pre>';
      }
      var failureMessage = 'No changes were made. You can retry or head back to the previous page.';
      if (error && error.code === 'missing_identity') {
        failureMessage = 'We could not confirm your membership session, so enrollment was not saved. Please sign in again and retry.';
      } else if (error && error.code === 'persistence_unconfirmed') {
        failureMessage = 'We could not confirm that your enrollment saved to CRM. Please retry in a moment or contact support.';
      }

      setStatus({
        icon: '⚠️',
        badge: 'Action failed',
        title: humanize(actionKey, 'failure'),
        message: failureMessage,
        details: detail,
        showSpinner: false
      });
      showActions('Try again', function(){ window.location.reload(); }, redirectUrl);
    });
      })
      .catch(function(error) {
        // Handle auth initialization failure
        setStatus({
          icon: '⚠️',
          badge: 'Auth failed',
          title: 'Authentication check failed',
          message: 'We could not verify your authentication status.',
          details: 'Please try refreshing the page. If the problem persists, contact support.',
          showSpinner: false
        });
        showActions('Refresh page', function(){ window.location.reload(); }, redirectUrl);

        if (console && console.error) {
          console.error('[action-runner] Auth initialization failed:', error);
        }
      });
  });
})();
