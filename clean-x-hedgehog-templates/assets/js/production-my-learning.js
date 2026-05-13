/**
 * Production My Learning dashboard — server-authoritative renderer
 * (Issue #459, Phase 5B; supersedes the Issue #436 implementation).
 *
 * Mirrors the approved shadow Phase 5B renderer (shadow-my-learning.js, #452)
 * but speaks to the bare production endpoints. No shadow banner, no shadow
 * route forms, no /shadow/ API prefix.
 *
 * Flow (dashboard load):
 *   1. GET /enrollments/list   — source of truth for enrollments (CRM)
 *   2. For each enrolled pathway:
 *        GET /pathway/status?pathway_slug=<slug>
 *   3. For each standalone course (pathway_slug === null in enrollments):
 *        GET /course/status?course_slug=<slug>
 *   4. GET /certificates       — certificates section
 *
 * Contract:
 *   - Progress bars use modules_completed / modules_total (or courses_*)
 *     verbatim from the server response. The client NEVER recomputes.
 *   - /tasks/status/batch is NOT called on dashboard load.
 *   - Partial failure is per-card: Promise.allSettled is used; failed
 *     cards render an inline error with a Retry button; other cards render.
 *
 * Production-only: gracefully no-ops when #hhl-auth-context[data-shadow="true"]
 * is present (i.e., on shadow pages where shadow-my-learning.js handles the UI).
 *
 * Ownership boundary with my-learning.js (Issue #459):
 *   The dashboard runs both this script and the legacy my-learning.js. To
 *   prevent stomp/race on shared DOM, each script owns a disjoint surface:
 *
 *     production-my-learning.js (this file) owns:
 *       - #enrolled-grid (cards)
 *       - #enrolled-section (visibility)
 *       - #enrolled-count (the (N) label next to the section header)
 *       - #stat-enrolled (enrollment-level count)
 *       - #certificates-grid + #certificates-section + #certificates-count
 *       - the #loading-state / #main-content-container toggle
 *
 *     my-learning.js (legacy) owns:
 *       - #last-viewed-panel (Resume Panel)
 *       - #in-progress-section / #in-progress-modules / #in-progress-count
 *       - #completed-section / #completed-modules / #completed-count
 *       - #stat-in-progress (module-level — semantically NOT the same as
 *         this script's pathways-in-progress count)
 *       - #stat-completed (module-level — semantically NOT the same as
 *         this script's pathways-completed count)
 *
 *   The boundary is declared by the template via
 *   data-enrollment-renderer="production-my-learning" on #hhl-auth-context.
 *   my-learning.js checks that marker and skips its own #enrolled-grid
 *   rendering; this script checks it as a precondition and no-ops without it.
 *   With this guarded boundary the dashboard has exactly one owner per node.
 */
(function () {
  'use strict';

  // Bare production endpoints — no /shadow/ prefix (see #460 root-mapping fix).
  var API_BASE = 'https://api.hedgehog.cloud';

  // Guard 1: only run on production pages — skip shadow.
  var ctxEl = document.getElementById('hhl-auth-context');
  if (!ctxEl || ctxEl.getAttribute('data-shadow') === 'true') return;

  // Guard 2 (Issue #459): only render enrollments when this template has
  // explicitly declared us as the enrollment-grid owner. Without the marker,
  // legacy my-learning.js owns #enrolled-grid + enrolled-count + stat-enrolled
  // and we must not write to those nodes. Templates opt in by setting
  // data-enrollment-renderer="production-my-learning" on #hhl-auth-context.
  if (ctxEl.getAttribute('data-enrollment-renderer') !== 'production-my-learning') return;

  // ----------------------------------------------------------------
  // Utilities
  // ----------------------------------------------------------------

  function q(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'include' }).then(function (r) {
      if (!r.ok) {
        var err = new Error('HTTP ' + r.status);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try { return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function waitForIdentityReady() {
    try {
      if (window.hhIdentity && window.hhIdentity.ready && typeof window.hhIdentity.ready.then === 'function') {
        return window.hhIdentity.ready;
      }
    } catch (e) {}
    return Promise.resolve(null);
  }

  function getAuth() {
    var identity = window.hhIdentity ? window.hhIdentity.get() : null;
    var el = document.getElementById('hhl-auth-context');
    var enableCrm = false;
    var loginUrl = '';
    var email = '';
    var contactId = '';
    if (el) {
      var attr = el.getAttribute('data-enable-crm');
      enableCrm = attr && attr.toLowerCase() === 'true';
      loginUrl = el.getAttribute('data-auth-login-url') || '';
    }
    if (identity) { email = identity.email || ''; contactId = identity.contactId || ''; }
    return { enableCrm: enableCrm, email: email, contactId: contactId, loginUrl: loginUrl };
  }

  function statusBadgeHtml(label, cssClass) {
    return '<span class="enrollment-status-badge ' + cssClass + '">' + label + '</span>';
  }

  // ----------------------------------------------------------------
  // Renderers — thin over server-provided shape
  // ----------------------------------------------------------------

  function firstIncompleteCourseSlug(pathwayData) {
    var c = (pathwayData.courses || []).find(function (x) { return x.course_status !== 'complete'; });
    return c ? c.course_slug : ((pathwayData.courses || [])[0] || {}).course_slug;
  }

  function pathwayBadge(status) {
    if (status === 'complete') return statusBadgeHtml('Completed', 'status-completed');
    if (status === 'in_progress') return statusBadgeHtml('In Progress', 'status-in-progress');
    return statusBadgeHtml('Not Started', 'status-not-started');
  }

  function renderPathwayCardElement(enrollment, data) {
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    card.setAttribute('data-dashboard-pathway-card', '');
    card.setAttribute('data-pathway-slug', data.pathway_slug);

    var pct = data.courses_total > 0 ? Math.round((data.courses_completed / data.courses_total) * 100) : 0;
    var href = '/learn/pathways/' + encodeURIComponent(data.pathway_slug);
    var firstIncomplete = firstIncompleteCourseSlug(data);
    var ctaHref = firstIncomplete
      ? '/learn/courses/' + encodeURIComponent(firstIncomplete)
      : href;
    var ctaLabel = data.pathway_status === 'complete' ? 'Review Pathway →' :
      data.pathway_status === 'not_started' ? 'Start Pathway →' : 'Continue →';

    var enrolledAt = enrollment.enrolled_at ? '<div>Enrolled ' + formatDate(enrollment.enrolled_at) + '</div>' : '';

    card.innerHTML =
      '<div class="enrollment-card-header">' +
        '<h3><a href="' + href + '" style="color:#1a4e8a;text-decoration:none;">' + escapeHtml(data.pathway_title) + '</a></h3>' +
        '<div class="enrollment-badges"><span class="enrollment-badge">pathway</span>' + pathwayBadge(data.pathway_status) + '</div>' +
      '</div>' +
      (enrolledAt ? '<div class="enrollment-meta">' + enrolledAt + '</div>' : '') +
      '<div class="enrollment-progress">' +
        '<div class="enrollment-progress-header">' +
          '<span class="enrollment-progress-label">' + data.courses_completed + ' of ' + data.courses_total + ' courses complete</span>' +
        '</div>' +
        '<div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="enrollment-actions"><a class="enrollment-cta" href="' + ctaHref + '">' + ctaLabel + '</a></div>';
    return card;
  }

  function firstIncompleteModuleSlug(courseData) {
    var m = (courseData.modules || []).find(function (x) {
      return x.has_required_tasks && x.module_status !== 'complete';
    });
    if (m) return m.module_slug;
    var any = (courseData.modules || [])[0];
    return any ? any.module_slug : null;
  }

  function courseBadge(status) {
    if (status === 'complete') return statusBadgeHtml('Completed', 'status-completed');
    if (status === 'in_progress') return statusBadgeHtml('In Progress', 'status-in-progress');
    return statusBadgeHtml('Not Started', 'status-not-started');
  }

  function renderStandaloneCourseCardElement(enrollment, data) {
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    card.setAttribute('data-dashboard-standalone-course-card', '');
    card.setAttribute('data-course-slug', data.course_slug);

    var pct = data.modules_total > 0 ? Math.round((data.modules_completed / data.modules_total) * 100) : 0;
    var href = '/learn/courses/' + encodeURIComponent(data.course_slug);
    var nextMod = firstIncompleteModuleSlug(data);
    var ctaHref = data.course_status === 'complete'
      ? href
      : nextMod
        ? '/learn/modules/' + encodeURIComponent(nextMod)
        : href;
    var ctaLabel = data.course_status === 'complete' ? 'Review Course →' :
      data.course_status === 'not_started' ? 'Start Course →' : 'Continue to Next Module →';

    var enrolledAt = enrollment.enrolled_at ? '<div>Enrolled ' + formatDate(enrollment.enrolled_at) + '</div>' : '';

    card.innerHTML =
      '<div class="enrollment-card-header">' +
        '<h3><a href="' + href + '" style="color:#1a4e8a;text-decoration:none;">' + escapeHtml(data.course_title) + '</a></h3>' +
        '<div class="enrollment-badges"><span class="enrollment-badge">course</span>' + courseBadge(data.course_status) + '</div>' +
      '</div>' +
      (enrolledAt ? '<div class="enrollment-meta">' + enrolledAt + '</div>' : '') +
      '<div class="enrollment-progress">' +
        '<div class="enrollment-progress-header">' +
          '<span class="enrollment-progress-label">' + data.modules_completed + ' of ' + data.modules_total + ' modules complete</span>' +
        '</div>' +
        '<div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="enrollment-actions"><a class="enrollment-cta" href="' + ctaHref + '">' + ctaLabel + '</a></div>';
    return card;
  }

  function renderPartialFailureCard(kind, enrollment, retryFn) {
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    if (kind === 'pathway') {
      card.setAttribute('data-dashboard-pathway-card', '');
      card.setAttribute('data-error', 'true');
      card.setAttribute('data-pathway-slug', enrollment.slug);
    } else {
      card.setAttribute('data-dashboard-standalone-course-card', '');
      card.setAttribute('data-error', 'true');
      card.setAttribute('data-course-slug', enrollment.slug);
    }
    card.innerHTML =
      '<div class="enrollment-card-header"><h3>' + escapeHtml(enrollment.slug) + '</h3></div>' +
      '<div class="dashboard-card-error">' +
        'Couldn’t load progress for this ' + kind + '. ' +
        '<button type="button" data-dashboard-retry>Retry</button>' +
      '</div>';
    card.querySelector('[data-dashboard-retry]').addEventListener('click', function () {
      card.innerHTML = '<div class="dashboard-card-loading">Retrying...</div>';
      retryFn();
    });
    return card;
  }

  // ----------------------------------------------------------------
  // Certificates section (production route form)
  // ----------------------------------------------------------------

  function fetchAndRenderCertificates() {
    var certsSection = q('certificates-section');
    if (!certsSection) return;

    fetch(API_BASE + '/certificates', { credentials: 'include' })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) return null;
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        renderCertificatesSection(certsSection, data && data.certificates ? data.certificates : []);
      })
      .catch(function () {
        renderCertificatesSection(certsSection, []);
      });
  }

  function renderCertificatesSection(certsSection, certificates) {
    var certsGrid = q('certificates-grid');
    var certsCount = q('certificates-count');
    if (!certsGrid) return;
    if (certsCount) certsCount.textContent = '(' + certificates.length + ')';

    if (certificates.length === 0) {
      certsGrid.innerHTML =
        '<p class="certs-empty-note">No certificates earned yet. Complete a module or course to earn your first certificate.</p>';
    } else {
      var html = '';
      certificates.forEach(function (cert) {
        var title = cert.entityTitle || cert.entitySlug || 'Certificate';
        var dateStr = cert.issuedAt ? formatDate(cert.issuedAt) : '';
        var viewUrl = '/learn/certificate?id=' + encodeURIComponent(cert.certId);
        var typeLabel = cert.entityType === 'pathway' ? 'Pathway' : cert.entityType === 'course' ? 'Course' : 'Module';
        html +=
          '<div class="cert-card">' +
            '<div class="cert-card-icon">🎓</div>' +
            '<div class="cert-card-body">' +
              '<div class="cert-card-title">' + escapeHtml(title) + '</div>' +
              '<div class="cert-card-meta">' +
                '<span class="cert-type-badge cert-type-' + escapeHtml(cert.entityType) + '">' + typeLabel + '</span>' +
                (dateStr ? '<span class="cert-date">Earned ' + dateStr + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="cert-card-actions">' +
              '<a href="' + viewUrl + '" class="cert-action-btn cert-action-view" target="_blank" rel="noopener noreferrer">View Certificate</a>' +
              '<button type="button" class="cert-action-btn cert-action-copy" data-cert-url="' + viewUrl + '">Copy Link</button>' +
            '</div>' +
          '</div>';
      });
      certsGrid.innerHTML = html;

      var copyBtns = certsGrid.querySelectorAll('.cert-action-copy');
      copyBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var url = btn.getAttribute('data-cert-url');
          var absUrl = window.location.origin + url;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(absUrl).then(function () {
              btn.textContent = 'Copied!';
              setTimeout(function () { btn.textContent = 'Copy Link'; }, 2000);
            }).catch(function () {
              btn.textContent = 'Copy failed';
              setTimeout(function () { btn.textContent = 'Copy Link'; }, 2000);
            });
          }
        });
      });
    }
    certsSection.style.display = 'block';
  }

  // ----------------------------------------------------------------
  // Main entry
  // ----------------------------------------------------------------

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    waitForIdentityReady().finally(function () {
      var auth = getAuth();

      function showMain() {
        var ls = q('loading-state');
        var mc = q('main-content-container');
        if (ls) ls.style.display = 'none';
        if (mc) mc.style.display = 'block';
      }

      function showEmpty() {
        showMain();
        var es = q('empty-state');
        if (es) es.style.display = 'block';
      }

      if (!auth.enableCrm || (!auth.email && !auth.contactId)) {
        showMain();
        var authPrompt = q('auth-prompt');
        if (authPrompt) authPrompt.style.display = 'block';
        return;
      }

      var query = auth.contactId
        ? '?contactId=' + encodeURIComponent(auth.contactId)
        : '?email=' + encodeURIComponent(auth.email);
      var enrollUrl = API_BASE + '/enrollments/list' + query;

      fetchJSON(enrollUrl).catch(function (err) {
        if (err && err.status === 401) {
          window.location.href = (auth.loginUrl || 'https://api.hedgehog.cloud/auth/login') +
            '?redirect_url=' + encodeURIComponent(window.location.pathname);
        } else {
          console.error('[production-my-learning] /enrollments/list failed:', err);
        }
        showEmpty();
        return null;
      }).then(function (enrollData) {
        if (!enrollData) return;
        if (enrollData.mode !== 'authenticated') { showEmpty(); return; }
        var pathways = (enrollData.enrollments && enrollData.enrollments.pathways) || [];
        var courses = (enrollData.enrollments && enrollData.enrollments.courses) || [];
        var standalones = courses.filter(function (c) { return !c.pathway_slug; });

        if (pathways.length === 0 && standalones.length === 0) { showEmpty(); return; }

        renderDashboard(pathways, standalones);
      });

      function renderDashboard(pathways, standalones) {
        var grid = q('enrolled-grid');
        var section = q('enrolled-section');
        if (!grid || !section) { showMain(); return; }

        var totalEnrolled = pathways.length + standalones.length;
        var cardsRendered = 0;
        var cardsExpected = totalEnrolled;

        function finalize() {
          cardsRendered++;
          if (cardsRendered >= cardsExpected) {
            var countEl = q('enrolled-count');
            if (countEl) countEl.textContent = '(' + totalEnrolled + ')';
            // Issue #459 — single ownership of the dashboard summary stats.
            // production-my-learning.js owns ONLY #enrolled-grid,
            // #enrolled-section, enrolled-count, and stat-enrolled. The
            // existing production semantics of stat-in-progress and
            // stat-completed are module-level (populated by my-learning.js
            // from CRM /progress/read). We deliberately do NOT write to
            // those nodes here to avoid stomping the legacy module-level
            // semantics under the same DOM IDs.
            var statEnrolled = q('stat-enrolled');
            if (statEnrolled) statEnrolled.textContent = totalEnrolled;
            section.style.display = 'block';
            showMain();
            fetchAndRenderCertificates();
          }
        }

        // Pathway cards
        pathways.forEach(function (enrollment) {
          var placeholder = document.createElement('div');
          placeholder.className = 'enrollment-card';
          placeholder.setAttribute('data-dashboard-pathway-card', '');
          placeholder.setAttribute('data-pathway-slug', enrollment.slug);
          placeholder.innerHTML = '<div class="dashboard-card-loading">Loading pathway...</div>';
          grid.appendChild(placeholder);

          function loadPathway() {
            fetchJSON(API_BASE + '/pathway/status?pathway_slug=' + encodeURIComponent(enrollment.slug))
              .then(function (data) {
                var real = renderPathwayCardElement(enrollment, data);
                placeholder.replaceWith(real);
              })
              .catch(function (err) {
                if (err && err.status === 401) {
                  window.location.href = (auth.loginUrl || 'https://api.hedgehog.cloud/auth/login') +
                    '?redirect_url=' + encodeURIComponent(window.location.pathname);
                  return;
                }
                var err2 = renderPartialFailureCard('pathway', enrollment, function () { loadPathway(); });
                placeholder.replaceWith(err2);
                placeholder = err2;
              })
              .finally(finalize);
          }
          loadPathway();
        });

        // Standalone course cards
        standalones.forEach(function (enrollment) {
          var placeholder = document.createElement('div');
          placeholder.className = 'enrollment-card';
          placeholder.setAttribute('data-dashboard-standalone-course-card', '');
          placeholder.setAttribute('data-course-slug', enrollment.slug);
          placeholder.innerHTML = '<div class="dashboard-card-loading">Loading course...</div>';
          grid.appendChild(placeholder);

          function loadCourse() {
            fetchJSON(API_BASE + '/course/status?course_slug=' + encodeURIComponent(enrollment.slug))
              .then(function (data) {
                var real = renderStandaloneCourseCardElement(enrollment, data);
                placeholder.replaceWith(real);
              })
              .catch(function (err) {
                if (err && err.status === 401) {
                  window.location.href = (auth.loginUrl || 'https://api.hedgehog.cloud/auth/login') +
                    '?redirect_url=' + encodeURIComponent(window.location.pathname);
                  return;
                }
                var err2 = renderPartialFailureCard('course', enrollment, function () { loadCourse(); });
                placeholder.replaceWith(err2);
                placeholder = err2;
              })
              .finally(finalize);
          }
          loadCourse();
        });

        if (totalEnrolled === 0) finalize();
      }
    });
  });

}());
