/**
 * Shadow Module Learner-Record client JS (Issue #452, Phase 5B)
 *
 * Fetches GET /shadow/module/progress and renders:
 *   - module header (title, overall status badge)
 *   - per-task list (status chip, best_score, attempts, last_attempt_at)
 *   - attempt timeline (DESC) with expandable answer-review drawer (quiz only)
 *   - breadcrumbs (course → pathway → My Learning)
 *   - "Open Module Content" CTA and optional "View Certificate" CTA
 *
 * Sensitive-handling rules — enforced here too as defense in depth:
 *   - The renderer NEVER prints `correct_answer` or `learner_identity`.
 *     (Backend already strips them, but this is belt-and-braces.)
 *   - Lab attestation attempts never render an answer-review drawer.
 *   - Schema-drift rows display "Question no longer available" instead of
 *     the stale question text.
 */
(function () {
  'use strict';

  var SHADOW_API_BASE = 'https://api.hedgehog.cloud/shadow';
  var CERT_VIEW_URL = '/learn-shadow/certificate?id=';

  var ctxEl = document.getElementById('shadow-module-progress-context');
  if (!ctxEl) return;
  var moduleSlug = ctxEl.getAttribute('data-module-slug') || '';
  if (!moduleSlug) return;

  var root = document.getElementById('shadow-module-progress-root');
  if (!root) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function statusBadge(status) {
    var map = {
      complete: ['Completed', 'status-completed'],
      in_progress: ['In Progress', 'status-in-progress'],
      not_started: ['Not Started', 'status-not-started'],
      no_tasks: ['No Required Tasks', 'status-not-started'],
    };
    var pair = map[status] || ['Not Started', 'status-not-started'];
    return '<span class="enrollment-status-badge ' + pair[1] + '">' + pair[0] + '</span>';
  }

  function renderTaskRow(t) {
    var statusLabel = t.status || 'not_started';
    var best = t.best_score !== undefined ? ' \u2022 Best ' + t.best_score + '%' : '';
    var attempts = t.attempt_count !== undefined ? ' \u2022 ' + t.attempt_count + ' attempt' + (t.attempt_count === 1 ? '' : 's') : '';
    return '<div data-module-task-row data-task-slug="' + escapeHtml(t.task_slug) + '" class="module-task-row">' +
      '<div class="module-task-title">' + escapeHtml(t.task_title || t.task_slug) +
        (t.required ? '' : ' <span class="module-task-optional">(optional)</span>') +
      '</div>' +
      '<div class="module-task-meta">' + escapeHtml(statusLabel) + best + attempts + '</div>' +
      '</div>';
  }

  function renderAnswerReview(answerReview) {
    if (!Array.isArray(answerReview) || answerReview.length === 0) return '';
    var rows = answerReview.map(function (r) {
      if (r.schema_drift) {
        return '<div data-module-answer-review-row data-is-correct="null" class="answer-review-row drift">' +
          '<div class="answer-review-q">Question no longer available</div>' +
          '<div class="answer-review-submitted">You answered: ' + escapeHtml(r.submitted_answer_text) + '</div>' +
          '</div>';
      }
      var correctness = r.is_correct === true ? 'correct' : r.is_correct === false ? 'incorrect' : 'unknown';
      return '<div data-module-answer-review-row data-is-correct="' + (r.is_correct === true ? 'true' : r.is_correct === false ? 'false' : 'null') +
        '" class="answer-review-row ' + correctness + '">' +
        '<div class="answer-review-q">' + escapeHtml(r.question_text || '') + '</div>' +
        '<div class="answer-review-submitted">Your answer: ' + escapeHtml(r.submitted_answer_text) + '</div>' +
        '<div class="answer-review-indicator">' + (r.is_correct === true ? '\u2713 Correct' : r.is_correct === false ? '\u2717 Incorrect' : '') + '</div>' +
        '</div>';
    });
    return '<div class="answer-review-list">' + rows.join('') + '</div>';
  }

  function renderAttemptRow(a) {
    var isQuiz = a.task_type === 'quiz';
    var drawer = isQuiz ? renderAnswerReview(a.answer_review) : '';
    var details = isQuiz
      ? '<details class="module-attempt-detail"><summary>View answer review</summary>' + drawer + '</details>'
      : '<div class="module-attempt-note">Lab attested</div>';
    var scoreStr = a.score !== undefined ? ' (' + a.score + '%)' : '';
    return '<div data-module-attempt-row data-task-type="' + escapeHtml(a.task_type) + '" class="module-attempt-row">' +
      '<div class="module-attempt-header">' +
        '<span class="module-attempt-when">' + escapeHtml(a.attempted_at) + '</span>' +
        '<span class="module-attempt-outcome">' + escapeHtml(a.outcome) + scoreStr + '</span>' +
      '</div>' +
      details +
      '</div>';
  }

  function renderBreadcrumbs(b) {
    var parts = ['<a href="/learn-shadow/my-learning">My Learning</a>'];
    if (b && b.parent_pathway_slug) {
      parts.push('<a data-module-breadcrumb-pathway href="/learn-shadow/pathways/' + encodeURIComponent(b.parent_pathway_slug) + '">' + escapeHtml(b.parent_pathway_title) + '</a>');
    }
    if (b && b.parent_course_slug) {
      parts.push('<a data-module-breadcrumb-course href="/learn-shadow/courses/' + encodeURIComponent(b.parent_course_slug) + '">' + escapeHtml(b.parent_course_title) + '</a>');
    }
    parts.push('<span class="current">Progress</span>');
    return '<nav class="shadow-breadcrumbs">' + parts.join(' <span class="sep">\u203a</span> ') + '</nav>';
  }

  function renderModule(data) {
    var tasksHtml = Array.isArray(data.tasks) && data.tasks.length
      ? data.tasks.map(renderTaskRow).join('')
      : '<div class="module-tasks-none">No tracked tasks for this module.</div>';

    var attemptsHtml;
    if (!Array.isArray(data.attempts) || data.attempts.length === 0) {
      attemptsHtml = '<div data-module-attempts-empty class="module-attempts-empty">No attempts yet \u2014 open the module to begin.</div>';
    } else {
      attemptsHtml = data.attempts.map(renderAttemptRow).join('');
    }

    var certHtml = data.module_cert_id
      ? '<a data-module-cert-link class="enrollment-cta" href="' + CERT_VIEW_URL + encodeURIComponent(data.module_cert_id) + '" target="_blank" rel="noopener">View Module Certificate</a>'
      : '';

    var contentHref = '/learn-shadow/modules/' + encodeURIComponent(data.module_slug);

    root.innerHTML =
      '<div class="shadow-mode-banner" role="note"><span>\u26a0</span><span><strong>Shadow mode</strong> \u2014 progress reflects the shadow environment.</span></div>' +
      renderBreadcrumbs(data.breadcrumbs) +
      '<header class="module-record-header">' +
        '<h1 data-module-title>' + escapeHtml(data.module_title) + '</h1>' +
        statusBadge(data.module_status) +
      '</header>' +
      '<section class="module-record-tasks"><h2>Required tasks</h2>' + tasksHtml + '</section>' +
      '<section class="module-record-timeline"><h2>Attempt history</h2>' + attemptsHtml + '</section>' +
      '<div class="enrollment-actions">' +
        '<a class="enrollment-cta" href="' + contentHref + '">Open Module Content \u2192</a>' +
        certHtml +
      '</div>';
  }

  function renderError() {
    root.innerHTML = '<div data-module-error class="module-error">Couldn\u2019t load your record for this module. <button data-module-retry type="button">Retry</button></div>';
    var retry = root.querySelector('[data-module-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  function renderLoading() {
    root.innerHTML = '<div class="module-loading">Loading...</div>';
  }

  function load() {
    renderLoading();
    fetch(SHADOW_API_BASE + '/module/progress?module_slug=' + encodeURIComponent(moduleSlug), { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = 'https://api.hedgehog.cloud/auth/login?redirect_url=' + encodeURIComponent(window.location.pathname);
          return null;
        }
        if (!r.ok) { renderError(); return null; }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        renderModule(data);
      })
      .catch(function (err) {
        console.error('[shadow-module-progress] fetch failed:', err);
        renderError();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
