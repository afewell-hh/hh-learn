/**
 * Shadow Completion Framework UI (Issue #410)
 *
 * Handles quiz + lab attestation UX for shadow module pages only.
 *
 * On page load:
 *   - Reads module_slug from #hhl-shadow-module-context data attribute
 *   - Calls GET /tasks/status to restore prior task state
 * On quiz submit:
 *   - Collects radio answers from server-rendered quiz form
 *   - POSTs to /tasks/quiz/submit; shows pass/fail feedback
 * On lab attest:
 *   - POSTs to /tasks/lab/attest; replaces button with "Lab Completed" indicator
 *
 * When both tasks are done, shows a module-complete banner at top of page.
 *
 * Shadow-only: gracefully no-ops when #hhl-shadow-module-context is absent
 * (i.e., on production module pages and list pages).
 *
 * Auth: all API calls use credentials:'include' so the browser sends the
 * hhl_access_token httpOnly cookie set at /auth/callback.
 *
 * @see Issue #410
 * @see /tasks/quiz/submit (#407), /tasks/lab/attest (#408), /tasks/status (#409)
 */
(function () {
  'use strict';

  // Shadow task endpoints are served under the /shadow path mapping on the
  // production custom domain.  This keeps the request host as api.hedgehog.cloud,
  // so the host-only SameSite=Strict auth cookie is sent by the browser.
  // See Issue #421 and serverless.yml ShadowApiPathMapping.
  var API_BASE = 'https://api.hedgehog.cloud/shadow';
  var LOGIN_URL = 'https://api.hedgehog.cloud/auth/login';

  // ----------------------------------------------------------------
  // Bootstrap: read module context
  // ----------------------------------------------------------------

  var ctxEl = document.getElementById('hhl-shadow-module-context');
  if (!ctxEl) return; // Guard: not a shadow module detail page

  var moduleSlug = ctxEl.getAttribute('data-module-slug');
  if (!moduleSlug) return;

  var quizSection = document.getElementById('hhl-quiz-section');
  var labSection = document.getElementById('hhl-lab-section');

  // Always hide legacy CTA buttons on shadow module detail pages.
  // The shadow completion framework handles all task UX; the legacy
  // action-runner path is not supported in shadow and produces
  // "Configuration error / Missing action endpoint" when clicked.
  // (Previously only hidden when quiz or lab section existed — that left
  //  no-task modules like knowledge-check recap modules with broken buttons.)
  var legacyComplete = document.getElementById('hhl-mark-complete');
  if (legacyComplete) legacyComplete.style.display = 'none';
  var legacyStarted = document.getElementById('hhl-mark-started');
  if (legacyStarted) legacyStarted.style.display = 'none';

  // No-task module: when neither quiz nor lab is present, replace the
  // hidden legacy button area with a coherent neutral-state note.
  if (!quizSection && !labSection) {
    var ctaEl = document.querySelector('.module-progress-cta');
    if (ctaEl) {
      ctaEl.innerHTML = '<p id="hhl-no-task-note" style="' +
        'color:#6B7280;font-size:0.9rem;font-style:italic;margin:0;">' +
        'No required tasks \u2014 read through the content and use any knowledge checks below.' +
        '</p>';
    }
  }

  // ----------------------------------------------------------------
  // Bind event handlers
  // ----------------------------------------------------------------

  if (quizSection) {
    var submitBtn = document.getElementById('hhl-quiz-submit');
    if (submitBtn) submitBtn.addEventListener('click', handleQuizSubmit);
  }

  if (labSection) {
    var labBtn = document.getElementById('hhl-lab-attest-btn');
    if (labBtn) labBtn.addEventListener('click', handleLabAttest);
  }

  // ----------------------------------------------------------------
  // Restore task state on page load
  // ----------------------------------------------------------------

  restoreTaskState();

  function restoreTaskState() {
    fetch(API_BASE + '/tasks/status?module_slug=' + encodeURIComponent(moduleSlug), {
      method: 'GET',
      credentials: 'include',
    })
      .then(function (resp) {
        if (resp.status === 401) return null; // Not signed in: show initial state silently
        if (!resp.ok) return null;
        return resp.json();
      })
      .then(function (data) {
        if (!data) return;

        if (data.module_status === 'complete') {
          restoreAllDone(data.tasks || {});
          showModuleComplete(data.cert_id || null);
          return;
        }

        if (data.module_status === 'in_progress') {
          var tasks = data.tasks || {};

          var quizTask = tasks['quiz-1'];
          if (quizTask) {
            if (quizTask.status === 'passed') {
              showQuizPassed(quizTask.score !== undefined ? quizTask.score + '%' : '');
            } else if (quizTask.status === 'failed') {
              showQuizFailed(
                quizTask.score !== undefined ? quizTask.score + '%' : '',
                quizTask.attempts
              );
            }
          }

          var labTask = tasks['lab-main'];
          if (labTask && labTask.status === 'attested') {
            showLabCompleted();
          }
        }
        // not_started: keep initial server-rendered state
      })
      .catch(function () {
        // Network error: keep initial state — fail open, don't block the page
      });
  }

  function restoreAllDone(tasks) {
    if (quizSection) {
      var quizTask = tasks['quiz-1'] || {};
      showQuizPassed(quizTask.score !== undefined ? quizTask.score + '%' : '');
    }
    if (labSection) {
      showLabCompleted();
    }
  }

  // ----------------------------------------------------------------
  // Quiz submission
  // ----------------------------------------------------------------

  function handleQuizSubmit() {
    var btn = document.getElementById('hhl-quiz-submit');
    var answers = [];
    var allAnswered = true;

    var questions = document.querySelectorAll('#hhl-quiz-form .hhl-quiz-question');
    questions.forEach(function (qEl) {
      var qId = qEl.getAttribute('data-q-id');
      var checked = qEl.querySelector('input[type="radio"]:checked');
      if (checked) {
        answers.push({ id: qId, value: checked.value });
      } else {
        allAnswered = false;
      }
    });

    if (!allAnswered) {
      showFeedback('hhl-quiz-feedback', 'Please answer all questions before submitting.', 'warning');
      return;
    }

    var quizRef = quizSection
      ? quizSection.getAttribute('data-quiz-ref') || 'quiz-1'
      : 'quiz-1';

    if (btn) btn.disabled = true;

    fetch(API_BASE + '/tasks/quiz/submit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module_slug: moduleSlug,
        quiz_ref: quizRef,
        answers: answers,
      }),
    })
      .then(function (resp) {
        if (resp.status === 401) { showAuthPrompt(); return null; }
        if (!resp.ok) {
          showFeedback('hhl-quiz-feedback', 'Something went wrong. Your progress may not have been saved. Please try again.', 'fail');
          if (btn) btn.disabled = false;
          return null;
        }
        return resp.json();
      })
      .then(function (result) {
        if (!result) return;
        var score = result.score !== undefined ? result.score + '%' : '';
        if (result.pass) {
          showQuizPassed(score);
          if (result.module_complete) showModuleComplete(result.cert_id || null);
        } else {
          showQuizFailed(score, result.attempts);
          if (btn) btn.disabled = false;
        }
      })
      .catch(function () {
        showFeedback('hhl-quiz-feedback', 'Could not reach the server. Please check your connection.', 'fail');
        if (btn) btn.disabled = false;
      });
  }

  // ----------------------------------------------------------------
  // Lab attestation
  // ----------------------------------------------------------------

  function handleLabAttest() {
    var btn = document.getElementById('hhl-lab-attest-btn');
    if (btn) btn.disabled = true;

    fetch(API_BASE + '/tasks/lab/attest', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module_slug: moduleSlug,
        task_slug: 'lab-main',
      }),
    })
      .then(function (resp) {
        if (resp.status === 401) { showAuthPrompt(); return null; }
        if (!resp.ok) {
          showFeedback('hhl-lab-feedback', 'Something went wrong. Your progress may not have been saved. Please try again.', 'fail');
          if (btn) btn.disabled = false;
          return null;
        }
        return resp.json();
      })
      .then(function (result) {
        if (!result) return;
        showLabCompleted();
        if (result.module_complete) showModuleComplete(result.cert_id || null);
      })
      .catch(function () {
        showFeedback('hhl-lab-feedback', 'Could not reach the server. Please check your connection.', 'fail');
        if (btn) btn.disabled = false;
      });
  }

  // ----------------------------------------------------------------
  // UI state helpers
  // ----------------------------------------------------------------

  function showQuizPassed(score) {
    var form = document.getElementById('hhl-quiz-form');
    var btn = document.getElementById('hhl-quiz-submit');
    var feedback = document.getElementById('hhl-quiz-feedback');
    if (form) form.style.display = 'none';
    if (btn) btn.style.display = 'none';
    if (feedback) {
      feedback.style.display = '';
      feedback.innerHTML =
        '<div class="hhl-task-badge hhl-task-badge--pass">Quiz Passed \u2713' +
        (score ? ' \u2014 Score: ' + score : '') +
        '</div>';
    }
  }

  function showQuizFailed(score, attempts) {
    var btn = document.getElementById('hhl-quiz-submit');
    var feedback = document.getElementById('hhl-quiz-feedback');
    if (btn) btn.style.display = 'none';
    if (feedback) {
      feedback.style.display = '';
      var att = attempts ? ' (Attempt ' + attempts + ')' : '';
      feedback.innerHTML =
        '<div class="hhl-task-badge hhl-task-badge--fail">Score: ' +
        (score || '0%') + att +
        ' \u2014 Need 75% to pass.</div>' +
        '<button type="button" id="hhl-quiz-retake" class="hhl-retake-btn">Retake Quiz</button>';
      var retakeBtn = document.getElementById('hhl-quiz-retake');
      if (retakeBtn) {
        retakeBtn.addEventListener('click', function () {
          resetQuizForm();
          if (btn) { btn.style.display = ''; btn.disabled = false; }
          feedback.style.display = 'none';
        });
      }
    }
  }

  function resetQuizForm() {
    var form = document.getElementById('hhl-quiz-form');
    if (form) {
      form.style.display = '';
      form.querySelectorAll('input[type="radio"]').forEach(function (r) {
        r.checked = false;
      });
    }
  }

  function showLabCompleted() {
    var btn = document.getElementById('hhl-lab-attest-btn');
    var feedback = document.getElementById('hhl-lab-feedback');
    if (btn) btn.style.display = 'none';
    if (feedback) {
      feedback.style.display = '';
      feedback.innerHTML = '<div class="hhl-task-badge hhl-task-badge--pass">Lab Completed \u2713</div>';
    }
  }

  function showModuleComplete(certId) {
    if (document.getElementById('hhl-module-complete-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'hhl-module-complete-banner';
    banner.className = 'hhl-module-complete';
    banner.setAttribute('role', 'status');
    var certLink = '';
    if (certId) {
      certLink = ' \u2014 <a href="/learn-shadow/certificate?id=' +
        encodeURIComponent(certId) +
        '" class="hhl-cert-link" target="_blank" rel="noopener noreferrer">' +
        '\uD83C\uDF93 View Certificate</a>';
    }
    banner.innerHTML = '<strong>Module Complete \u2713</strong> \u2014 All tasks finished.' + certLink;
    var detail = document.querySelector('.module-detail');
    if (detail) detail.insertBefore(banner, detail.firstChild);
  }

  function showAuthPrompt() {
    var redirectUrl = encodeURIComponent(window.location.href);
    showGlobalError(
      'Please sign in to save your progress. <a href="' +
        LOGIN_URL + '?redirect_url=' + redirectUrl +
        '">Sign in</a>'
    );
  }

  function showFeedback(elId, msg, type) {
    var el = document.getElementById(elId);
    if (el) {
      el.style.display = '';
      el.innerHTML = '<div class="hhl-task-badge hhl-task-badge--' + (type || 'warning') + '">' + msg + '</div>';
    }
  }

  function showGlobalError(msg) {
    var existing = document.getElementById('hhl-completion-error');
    if (existing) { existing.innerHTML = msg; return; }
    var el = document.createElement('div');
    el.id = 'hhl-completion-error';
    el.className = 'hhl-error-banner';
    el.innerHTML = msg;
    var detail = document.querySelector('.module-detail');
    if (detail) detail.insertBefore(el, detail.firstChild);
  }

}());
