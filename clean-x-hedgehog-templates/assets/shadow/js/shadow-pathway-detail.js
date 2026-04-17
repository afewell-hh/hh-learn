/**
 * Shadow Pathway Detail client JS (Issue #452, Phase 5B)
 *
 * Fetches GET /shadow/pathway/status and renders:
 *   - header (title, status badge, "X of Y courses complete")
 *   - progress bar
 *   - per-course rollup rows (title, status, "X of Y modules" label)
 *   - CTA (Start / Continue / Review) routing to first-incomplete course
 *   - breadcrumbs (My Learning)
 *   - pathway cert link (when pathway_cert_id present)
 */
(function () {
  'use strict';

  var SHADOW_API_BASE = 'https://api.hedgehog.cloud/shadow';
  var CERT_VIEW_URL = '/learn-shadow/certificate?id=';

  var ctxEl = document.getElementById('shadow-pathway-detail-context');
  if (!ctxEl) return;
  var pathwaySlug = ctxEl.getAttribute('data-pathway-slug') || '';
  if (!pathwaySlug) return;

  var root = document.getElementById('shadow-pathway-detail-root');
  if (!root) return;

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function statusBadge(status) {
    var label = status === 'complete' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started';
    var cls = status === 'complete' ? 'status-completed' : status === 'in_progress' ? 'status-in-progress' : 'status-not-started';
    return '<span class="enrollment-status-badge ' + cls + '" data-pathway-status-badge>' + label + '</span>';
  }

  function renderCourseRow(c) {
    var link = '/learn-shadow/courses/' + encodeURIComponent(c.course_slug);
    return '<a data-pathway-course-row data-course-slug="' + escapeHtml(c.course_slug) + '" class="pathway-course-row" href="' + link + '">' +
      '<div class="pathway-course-title">' + escapeHtml(c.course_title) + '</div>' +
      '<div class="pathway-course-meta">' +
        statusBadge(c.course_status) +
        '<span class="pathway-course-progress">' + c.modules_completed + ' of ' + c.modules_total + ' modules</span>' +
      '</div>' +
      '</a>';
  }

  function firstIncompleteCourseLink(data) {
    var first = (data.courses || []).find(function (c) { return c.course_status !== 'complete'; });
    if (first) return '/learn-shadow/courses/' + encodeURIComponent(first.course_slug);
    var firstAny = (data.courses || [])[0];
    return firstAny ? '/learn-shadow/courses/' + encodeURIComponent(firstAny.course_slug) : null;
  }

  function renderCta(data) {
    var href = firstIncompleteCourseLink(data) || '#';
    var label = data.pathway_status === 'complete' ? 'Review Pathway \u2192' :
      data.pathway_status === 'not_started' ? 'Start Pathway \u2192' : 'Continue \u2192';
    return '<div class="enrollment-actions"><a data-pathway-cta class="enrollment-cta" href="' + href + '">' + label + '</a></div>';
  }

  function renderPathway(data) {
    var percent = data.courses_total > 0 ? Math.round((data.courses_completed / data.courses_total) * 100) : 0;
    var coursesHtml = (data.courses || []).map(renderCourseRow).join('');
    var certHtml = data.pathway_cert_id
      ? '<div class="pathway-cert-link"><a data-pathway-cert-link href="' + CERT_VIEW_URL + encodeURIComponent(data.pathway_cert_id) + '" target="_blank" rel="noopener">View Pathway Certificate</a></div>'
      : '';

    root.innerHTML =
      '<div class="shadow-mode-banner" role="note"><span>\u26a0</span><span><strong>Shadow mode</strong> \u2014 progress reflects the shadow environment.</span></div>' +
      '<nav class="shadow-breadcrumbs"><a href="/learn-shadow/my-learning" data-breadcrumb-dashboard>My Learning</a></nav>' +
      '<header class="pathway-header">' +
        '<h1 data-pathway-title>' + escapeHtml(data.pathway_title) + '</h1>' +
        statusBadge(data.pathway_status) +
        '<div class="enrollment-progress-label">' + data.courses_completed + ' of ' + data.courses_total + ' courses complete</div>' +
        '<div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:' + percent + '%"></div></div>' +
      '</header>' +
      '<section class="pathway-courses">' + coursesHtml + '</section>' +
      renderCta(data) +
      certHtml;
  }

  function renderError(body) {
    var msg = 'Couldn\u2019t load pathway progress.';
    if (body && body.error === 'pathway not found') msg = 'Pathway not found.';
    root.innerHTML = '<div data-pathway-error class="pathway-error">' + escapeHtml(msg) + ' <button data-pathway-retry type="button">Retry</button></div>';
    var retry = root.querySelector('[data-pathway-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  function renderLoading() {
    root.innerHTML = '<div class="pathway-loading">Loading...</div>';
  }

  function load() {
    renderLoading();
    fetch(SHADOW_API_BASE + '/pathway/status?pathway_slug=' + encodeURIComponent(pathwaySlug), { credentials: 'include' })
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
        renderPathway(data);
      })
      .catch(function (err) {
        console.error('[shadow-pathway-detail] fetch failed:', err);
        renderError(null);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
