/**
 * Production Pathway Detail — server-authoritative progress mount
 * (Issue #459, Phase 5B).
 *
 * Mirrors shadow-pathway-detail.js (#452) but speaks to the bare production
 * /pathway/status endpoint and routes all in-DOM links through /learn/...
 *
 * Mounts ADDITIVELY into the existing production pathway detail template:
 *   - Reads context from #pathway-detail-context (data-pathway-slug).
 *   - Renders into #pathway-progress-detail-root.
 *   - Does NOT replace the existing enrollment CTA (#hhl-enrollment-cta),
 *     JSON-LD ItemList, OG metadata, or breadcrumbs.
 *
 * Server-authoritative invariants:
 *   - courses_completed / courses_total are rendered verbatim.
 *   - No client-side rollup recomputation.
 *
 * Production-only: never injects a shadow-mode banner. Never emits
 * /learn-shadow/ URLs.
 */
(function () {
  'use strict';

  var API_BASE = 'https://api.hedgehog.cloud';
  var CERT_VIEW_URL = '/learn/certificate?id=';

  var ctxEl = document.getElementById('pathway-detail-context');
  if (!ctxEl) return;

  var pathwaySlug = ctxEl.getAttribute('data-pathway-slug') || '';
  if (!pathwaySlug) return;

  var root = document.getElementById('pathway-progress-detail-root');
  if (!root) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // `scope` differentiates the pathway-level header badge from per-course-row
  // badges so callers can target a single node (Issue #465 — removes the
  // [data-pathway-status-badge] strict-mode collision in the deterministic
  // suite while keeping the same visual + semantic styling).
  function statusBadge(status, scope) {
    var label = status === 'complete' ? 'Completed' : status === 'in_progress' ? 'In Progress' : 'Not Started';
    var cls = status === 'complete' ? 'status-completed' : status === 'in_progress' ? 'status-in-progress' : 'status-not-started';
    var attr = scope === 'course' ? 'data-pathway-course-status-badge' : 'data-pathway-status-badge';
    return '<span class="enrollment-status-badge ' + cls + '" ' + attr + '>' + label + '</span>';
  }

  function renderCourseRow(c) {
    var link = '/learn/courses/' + encodeURIComponent(c.course_slug);
    return '<a data-pathway-course-row data-course-slug="' + escapeHtml(c.course_slug) + '" class="pathway-course-row" href="' + link + '">' +
      '<div class="pathway-course-title">' + escapeHtml(c.course_title) + '</div>' +
      '<div class="pathway-course-meta">' +
        statusBadge(c.course_status, 'course') +
        '<span class="pathway-course-progress">' + c.modules_completed + ' of ' + c.modules_total + ' modules</span>' +
      '</div>' +
      '</a>';
  }

  function firstIncompleteCourseLink(data) {
    var first = (data.courses || []).find(function (c) { return c.course_status !== 'complete'; });
    if (first) return '/learn/courses/' + encodeURIComponent(first.course_slug);
    var firstAny = (data.courses || [])[0];
    return firstAny ? '/learn/courses/' + encodeURIComponent(firstAny.course_slug) : null;
  }

  function renderCta(data) {
    var href = firstIncompleteCourseLink(data) || '#';
    var label = data.pathway_status === 'complete' ? 'Review Pathway →' :
      data.pathway_status === 'not_started' ? 'Start Pathway →' : 'Continue →';
    return '<div class="enrollment-actions"><a data-pathway-cta class="enrollment-cta" href="' + href + '">' + label + '</a></div>';
  }

  function renderPathway(data) {
    var percent = data.courses_total > 0 ? Math.round((data.courses_completed / data.courses_total) * 100) : 0;
    var coursesHtml = (data.courses || []).map(renderCourseRow).join('');
    var certHtml = data.pathway_cert_id
      ? '<div class="pathway-cert-link"><a data-pathway-cert-link href="' + CERT_VIEW_URL + encodeURIComponent(data.pathway_cert_id) + '" target="_blank" rel="noopener">View Pathway Certificate</a></div>'
      : '';

    root.innerHTML =
      '<header class="pathway-progress-header">' +
        '<h2 data-pathway-title style="font-size:1.5rem;margin:0 0 12px;">' + escapeHtml(data.pathway_title) + ' — Your Progress</h2>' +
        statusBadge(data.pathway_status) +
        '<div class="enrollment-progress-label" style="margin-top:12px;">' + data.courses_completed + ' of ' + data.courses_total + ' courses complete</div>' +
        '<div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:' + percent + '%"></div></div>' +
      '</header>' +
      '<section class="pathway-courses" style="margin-top:16px;">' + coursesHtml + '</section>' +
      renderCta(data) +
      certHtml;
  }

  function renderError(body) {
    var msg = 'Couldn’t load pathway progress.';
    if (body && body.error === 'pathway not found') msg = 'Pathway not found.';
    root.innerHTML = '<div data-pathway-error class="pathway-error">' + escapeHtml(msg) + ' <button data-pathway-retry type="button">Retry</button></div>';
    var retry = root.querySelector('[data-pathway-retry]');
    if (retry) retry.addEventListener('click', load);
  }

  function renderLoading() {
    root.innerHTML = '<div class="pathway-loading">Loading progress...</div>';
  }

  function load() {
    renderLoading();
    fetch(API_BASE + '/pathway/status?pathway_slug=' + encodeURIComponent(pathwaySlug), { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401) {
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
        renderPathway(data);
      })
      .catch(function (err) {
        console.error('[production-pathway-detail] fetch failed:', err);
        renderError(null);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
