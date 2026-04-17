/**
 * Shadow Course Detail client JS (Issue #452, Phase 5B)
 *
 * Fetches GET /shadow/course/status and renders:
 *   - header (title, status badge, "X of Y" progress label)
 *   - progress bar
 *   - per-module rows (title, status icon, "No required tasks" pill when
 *     has_required_tasks=false, task chips when tasks non-empty)
 *   - CTA (Start / Continue / Review) routing to first-incomplete module
 *   - breadcrumbs (pathway → My Learning)
 *   - course cert link (when course_cert_id present)
 *
 * All rollup counts come verbatim from the server response. Never recompute
 * course progress client-side.
 */
(function () {
  'use strict';

  var SHADOW_API_BASE = 'https://api.hedgehog.cloud/shadow';
  var CERT_VIEW_URL = '/learn-shadow/certificate?id=';

  var ctxEl = document.getElementById('shadow-course-detail-context');
  if (!ctxEl) return;

  var courseSlug = ctxEl.getAttribute('data-course-slug') || '';
  if (!courseSlug) return;

  var root = document.getElementById('shadow-course-detail-root');
  if (!root) return;

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function statusBadge(status) {
    var label = status === 'complete' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started';
    var cls = status === 'complete' ? 'status-completed' : status === 'in_progress' ? 'status-in-progress' : 'status-not-started';
    return '<span class="enrollment-status-badge ' + cls + '" data-course-status-badge>' + label + '</span>';
  }

  function moduleIcon(m) {
    if (m.module_status === 'complete') return '\u2713';
    if (m.module_status === 'in_progress') return '\u25D0';
    if (m.module_status === 'no_tasks') return '\u2013';
    return '\u25CB';
  }

  function renderModuleRow(m) {
    var link = '/learn-shadow/modules/' + encodeURIComponent(m.module_slug);
    var record = '/learn-shadow/module-progress?module=' + encodeURIComponent(m.module_slug);
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
    return '<div data-course-module-row data-status="' + escapeHtml(m.module_status) + '" class="enrollment-module-item ' +
      (m.module_status === 'complete' ? 'completed' : m.module_status === 'in_progress' ? 'in-progress' : m.module_status === 'no_tasks' ? 'no-tasks' : 'not-started') + '">' +
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
    if (first) return '/learn-shadow/modules/' + encodeURIComponent(first.module_slug);
    var firstAny = (data.modules || [])[0];
    return firstAny ? '/learn-shadow/modules/' + encodeURIComponent(firstAny.module_slug) : null;
  }

  function renderCta(data) {
    var href = firstIncompleteModuleLink(data) || '#';
    var label = data.course_status === 'complete' ? 'Review Course \u2192' :
      data.course_status === 'in_progress' ? 'Continue to Next Module \u2192' : 'Start Course \u2192';
    return '<div class="enrollment-actions"><a href="' + href + '" class="enrollment-cta" data-course-cta>' + label + '</a></div>';
  }

  function renderCourse(data) {
    var percent = data.modules_total > 0 ? Math.round((data.modules_completed / data.modules_total) * 100) : 0;
    var modulesHtml = (data.modules || []).map(renderModuleRow).join('');
    var certHtml = data.course_cert_id
      ? '<div class="course-cert-link"><a data-course-cert-link href="' + CERT_VIEW_URL + encodeURIComponent(data.course_cert_id) + '" target="_blank" rel="noopener">View Course Certificate</a></div>'
      : '';

    root.innerHTML =
      '<div class="shadow-mode-banner" role="note"><span>\u26a0</span><span><strong>Shadow mode</strong> \u2014 progress reflects the shadow environment.</span></div>' +
      '<nav class="shadow-breadcrumbs"><a href="/learn-shadow/my-learning" data-breadcrumb-dashboard>My Learning</a></nav>' +
      '<header class="course-header">' +
        '<h1 data-course-title>' + escapeHtml(data.course_title) + '</h1>' +
        statusBadge(data.course_status) +
        '<div data-course-progress-label class="enrollment-progress-label">' +
          data.modules_completed + ' of ' + data.modules_total + ' modules complete' +
        '</div>' +
        '<div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:' + percent + '%"></div></div>' +
      '</header>' +
      '<section class="course-modules">' + modulesHtml + '</section>' +
      renderCta(data) +
      certHtml;
  }

  function renderError(body) {
    var msg = 'Couldn\u2019t load progress. Course content is still viewable below.';
    if (body && body.error === 'course not found') msg = 'Course not found.';
    root.innerHTML = '<div data-course-error class="course-error">' + escapeHtml(msg) +
      ' <button data-course-retry type="button">Retry</button></div>';
    var retry = root.querySelector('[data-course-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  function renderLoading() {
    root.innerHTML = '<div data-course-loading class="course-loading">Loading...</div>';
  }

  function load() {
    renderLoading();
    fetch(SHADOW_API_BASE + '/course/status?course_slug=' + encodeURIComponent(courseSlug), { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = 'https://api.hedgehog.cloud/auth/login?redirect_url=' + encodeURIComponent(window.location.pathname);
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
        console.error('[shadow-course-detail] fetch failed:', err);
        renderError(null);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
