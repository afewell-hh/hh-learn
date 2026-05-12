/**
 * Production Course Detail — server-authoritative progress mount
 * (Issue #459, Phase 5B).
 *
 * Mirrors shadow-course-detail.js (#452) but speaks to the bare production
 * /course/status endpoint and routes all in-DOM links through /learn/...
 *
 * Mounts ADDITIVELY into the existing production course detail template:
 *   - Reads context from #course-detail-context (data-course-slug).
 *   - Renders into #course-progress-detail-root.
 *   - Does NOT replace the existing enrollment CTA (#hhl-enrollment-cta),
 *     content blocks, JSON-LD, OG metadata, or breadcrumbs.
 *
 * Server-authoritative invariants:
 *   - modules_completed / modules_total are rendered verbatim.
 *   - has_required_tasks=false modules show a "No required tasks" pill and
 *     are excluded from the denominator on the server side already.
 *   - No /tasks/status/batch call on course detail load.
 *
 * Production-only: never injects a shadow-mode banner. Never emits
 * /learn-shadow/ URLs.
 */
(function () {
  'use strict';

  var API_BASE = 'https://api.hedgehog.cloud';
  var CERT_VIEW_URL = '/learn/certificate?id=';

  var ctxEl = document.getElementById('course-detail-context');
  if (!ctxEl) return;

  var courseSlug = ctxEl.getAttribute('data-course-slug') || '';
  if (!courseSlug) return;

  var root = document.getElementById('course-progress-detail-root');
  if (!root) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function statusBadge(status) {
    var label = status === 'complete' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started';
    var cls = status === 'complete' ? 'status-completed' : status === 'in_progress' ? 'status-in-progress' : 'status-not-started';
    return '<span class="enrollment-status-badge ' + cls + '" data-course-status-badge>' + label + '</span>';
  }

  function moduleIcon(m) {
    if (m.module_status === 'complete') return '✓';
    if (m.module_status === 'in_progress') return '◐';
    if (m.module_status === 'no_tasks') return '–';
    return '○';
  }

  function renderModuleRow(m) {
    var link = '/learn/modules/' + encodeURIComponent(m.module_slug);
    var record = '/learn/module-progress?module=' + encodeURIComponent(m.module_slug);
    var pill = '';
    if (m.module_status === 'no_tasks') {
      pill = '<span class="shadow-task-pill task-pill-no-tasks">No required tasks</span>';
    } else {
      var t = m.tasks || {};
      var quiz = t['quiz-1'];
      var lab = t['lab-main'];
      var pills = [];
      if (quiz) {
        if (quiz.status === 'passed') pills.push('<span class="shadow-task-pill task-pill-passed">Quiz: Passed' + (quiz.score !== undefined ? ' (' + quiz.score + '%)' : '') + '</span>');
        else if (quiz.status === 'failed') pills.push('<span class="shadow-task-pill task-pill-failed">Quiz: Failed' + (quiz.score !== undefined ? ' (' + quiz.score + '%)' : '') + '</span>');
      }
      if (lab && lab.status === 'attested') pills.push('<span class="shadow-task-pill task-pill-attested">Lab: Completed</span>');
      pill = pills.join('');
    }
    var statusClass = m.module_status === 'complete'
      ? 'completed'
      : m.module_status === 'in_progress'
        ? 'in-progress'
        : m.module_status === 'no_tasks'
          ? 'no-tasks'
          : 'not-started';
    return '<div data-course-module-row data-status="' + escapeHtml(m.module_status) + '" class="enrollment-module-item ' + statusClass + '">' +
      '<div class="enrollment-module-row">' +
        '<span class="enrollment-module-status">' + moduleIcon(m) + '</span>' +
        '<a href="' + link + '" class="enrollment-module-link">' + escapeHtml(m.module_title) + '</a>' +
        '<a href="' + record + '" class="enrollment-module-record-link" data-module-progress-link>Progress</a>' +
      '</div>' +
      (pill ? '<div class="shadow-task-breakdown">' + pill + '</div>' : '') +
      '</div>';
  }

  function firstIncompleteModuleLink(data) {
    var first = (data.modules || []).find(function (m) {
      return m.has_required_tasks && m.module_status !== 'complete';
    });
    if (first) return '/learn/modules/' + encodeURIComponent(first.module_slug);
    var firstAny = (data.modules || [])[0];
    return firstAny ? '/learn/modules/' + encodeURIComponent(firstAny.module_slug) : null;
  }

  function renderCta(data) {
    var href = firstIncompleteModuleLink(data) || '#';
    var label = data.course_status === 'complete' ? 'Review Course →' :
      data.course_status === 'in_progress' ? 'Continue to Next Module →' : 'Start Course →';
    return '<div class="enrollment-actions"><a href="' + href + '" class="enrollment-cta" data-course-cta>' + label + '</a></div>';
  }

  function renderCourse(data) {
    var percent = data.modules_total > 0 ? Math.round((data.modules_completed / data.modules_total) * 100) : 0;
    var modulesHtml = (data.modules || []).map(renderModuleRow).join('');
    var certHtml = data.course_cert_id
      ? '<div class="course-cert-link"><a data-course-cert-link href="' + CERT_VIEW_URL + encodeURIComponent(data.course_cert_id) + '" target="_blank" rel="noopener">View Course Certificate</a></div>'
      : '';

    root.innerHTML =
      '<header class="course-progress-header">' +
        '<h2 data-course-title style="font-size:1.5rem;margin:0 0 12px;">' + escapeHtml(data.course_title) + ' — Your Progress</h2>' +
        statusBadge(data.course_status) +
        '<div data-course-progress-label class="enrollment-progress-label" style="margin-top:12px;">' +
          data.modules_completed + ' of ' + data.modules_total + ' modules complete' +
        '</div>' +
        '<div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:' + percent + '%"></div></div>' +
      '</header>' +
      '<section class="course-modules" style="margin-top:16px;">' + modulesHtml + '</section>' +
      renderCta(data) +
      certHtml;
  }

  function renderError(body) {
    var msg = 'Couldn’t load progress. Course content is still viewable below.';
    if (body && body.error === 'course not found') msg = 'Course not found.';
    root.innerHTML = '<div data-course-error class="course-error">' + escapeHtml(msg) +
      ' <button data-course-retry type="button">Retry</button></div>';
    var retry = root.querySelector('[data-course-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  function renderLoading() {
    root.innerHTML = '<div data-course-loading class="course-loading">Loading progress...</div>';
  }

  function load() {
    renderLoading();
    fetch(API_BASE + '/course/status?course_slug=' + encodeURIComponent(courseSlug), { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) {
          // Stay on page; let the existing enrollment CTA's login link surface auth.
          renderError({ error: 'unauthenticated' });
          return null;
        }
        if (!r.ok) {
          return r.json().catch(function () { return { error: 'HTTP ' + r.status }; }).then(function (b) {
            renderError(b);
            return null;
          });
        }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        renderCourse(data);
      })
      .catch(function (err) {
        console.error('[production-course-detail] fetch failed:', err);
        renderError(null);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
