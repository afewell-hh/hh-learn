/**
 * Shadow My Learning dashboard (Issue #411)
 *
 * Displays task-based completion status for enrolled modules/courses in the
 * shadow environment. Task data comes from DynamoDB via the shadow backend —
 * NOT from CRM hhl_progress_state.
 *
 * Page-load flow (2 Lambda API calls):
 *   1. GET /enrollments/list  — which courses the learner is enrolled in (CRM)
 *   2. GET /tasks/status/batch?module_slugs=…  — shadow DynamoDB task statuses
 *
 * Plus HubDB API calls to resolve module metadata (name, completion_tasks_json)
 * for enrolled courses — these are not Lambda calls.
 *
 * All module links use /learn-shadow/modules/<slug>.
 * Course completion is derived client-side from module statuses.
 *
 * Modules with no required tasks (empty completion_tasks or required:false only)
 * are shown as "Complete (no tasks required)" rather than forcing misleading UI.
 *
 * Shadow-only: gracefully no-ops if #hhl-auth-context[data-shadow] is absent.
 *
 * @see Issue #411
 * @see GET /tasks/status/batch (#411)
 * @see GET /enrollments/list (production endpoint, CRM-backed)
 * @see GET /tasks/status (#409) — single-module version used by module page
 */
(function () {
  'use strict';

  var API_BASE = 'https://api.hedgehog.cloud';

  // Guard: only run on shadow pages
  var ctxEl = document.getElementById('hhl-auth-context');
  if (!ctxEl || ctxEl.getAttribute('data-shadow') !== 'true') return;

  // ----------------------------------------------------------------
  // Utilities
  // ----------------------------------------------------------------

  function q(id) { return document.getElementById(id); }

  function fetchJSON(url) {
    return fetch(url, { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function slugToTitle(slug) {
    if (!slug) return '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
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

  function getTableIds() {
    var el = document.getElementById('hhl-auth-context');
    return {
      courses: (el && el.getAttribute('data-hubdb-courses-table-id')) || '135381433',
      modules: (el && el.getAttribute('data-hubdb-modules-table-id')) || '135621904',
    };
  }

  function statusBadgeHtml(label, cssClass) {
    return '<span class="enrollment-status-badge ' + cssClass + '">' + label + '</span>';
  }

  // ----------------------------------------------------------------
  // Determine if a module has required shadow-tracked tasks.
  // Returns an object: { hasQuiz, hasLab, hasNoRequiredTasks }
  // ----------------------------------------------------------------
  function parseTaskTypes(completionTasksJson) {
    var tasks = [];
    if (completionTasksJson) {
      try { tasks = JSON.parse(completionTasksJson); } catch (e) {}
    }
    var hasQuiz = false;
    var hasLab = false;
    var hasAnyRequired = false;
    tasks.forEach(function (t) {
      if (t.task_type === 'quiz' && t.required !== false) hasQuiz = true;
      if (t.task_type === 'lab_attestation' && t.required !== false) hasLab = true;
      if (t.required !== false) hasAnyRequired = true;
    });
    return {
      hasQuiz: hasQuiz,
      hasLab: hasLab,
      hasNoRequiredTasks: !hasAnyRequired
    };
  }

  // ----------------------------------------------------------------
  // Build task breakdown pills HTML for a module
  // ----------------------------------------------------------------
  function buildTaskBreakdownHtml(shadowStatus, taskTypes) {
    if (taskTypes.hasNoRequiredTasks) {
      return '<div class="shadow-task-breakdown">' +
        '<span class="shadow-task-pill task-pill-no-tasks">No required tasks</span>' +
        '</div>';
    }

    var pills = [];
    var tasks = (shadowStatus && shadowStatus.tasks) || {};

    if (taskTypes.hasQuiz) {
      var quizTask = tasks['quiz-1'];
      if (quizTask && quizTask.status === 'passed') {
        var scoreStr = quizTask.score !== undefined ? ' (' + quizTask.score + '%)' : '';
        pills.push('<span class="shadow-task-pill task-pill-passed">Quiz: Passed' + scoreStr + '</span>');
      } else if (quizTask && quizTask.status === 'failed') {
        var failScore = quizTask.score !== undefined ? ' (' + quizTask.score + '%' : '';
        var attempts = quizTask.attempts ? ', attempt ' + quizTask.attempts : '';
        var closeStr = (failScore || attempts) ? failScore + attempts + ')' : '';
        pills.push('<span class="shadow-task-pill task-pill-failed">Quiz: Failed' + closeStr + '</span>');
      } else {
        pills.push('<span class="shadow-task-pill task-pill-not-started">Quiz: Not started</span>');
      }
    }

    if (taskTypes.hasLab) {
      var labTask = tasks['lab-main'];
      if (labTask && labTask.status === 'attested') {
        pills.push('<span class="shadow-task-pill task-pill-attested">Lab: Completed</span>');
      } else {
        pills.push('<span class="shadow-task-pill task-pill-not-started">Lab: Not started</span>');
      }
    }

    if (!pills.length) return '';
    return '<div class="shadow-task-breakdown">' + pills.join('') + '</div>';
  }

  // ----------------------------------------------------------------
  // Determine module display status from shadow data
  // Returns: 'complete' | 'in-progress' | 'not-started'
  // ----------------------------------------------------------------
  function moduleDisplayStatus(shadowStatus, taskTypes) {
    if (taskTypes.hasNoRequiredTasks) return 'complete';
    if (!shadowStatus || shadowStatus.module_status === 'not_started') return 'not-started';
    if (shadowStatus.module_status === 'complete') return 'complete';
    return 'in-progress';
  }

  // ----------------------------------------------------------------
  // Render a single enrollment course card with shadow task data
  // ----------------------------------------------------------------
  function renderShadowCourseCard(course, moduleRows, shadowStatuses) {
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    var slug = course.slug || '';
    var enrolledAt = course.enrolled_at || '';

    var title = slugToTitle(slug);
    var href = '/learn-shadow/courses/' + slug;

    // Build module status list
    var modulesHtml = '';
    var completedCount = 0;
    var totalCount = moduleRows.length;
    var nextModPath = null;

    var moduleItems = moduleRows.map(function (mod) {
      var modPath = (mod.values && mod.values.hs_path) || mod.hs_path || (mod.path || '');
      var modName = (mod.values && mod.values.hs_name) || mod.hs_name || slugToTitle(modPath);
      var taskJson = (mod.values && mod.values.completion_tasks_json) || '';
      var taskTypes = parseTaskTypes(taskJson);
      var shadowStatus = shadowStatuses[modPath];
      var dispStatus = moduleDisplayStatus(shadowStatus, taskTypes);

      if (dispStatus === 'complete') completedCount++;
      if (dispStatus !== 'complete' && !nextModPath) nextModPath = modPath;

      var statusIcon = dispStatus === 'complete' ? '\u2713' : (dispStatus === 'in-progress' ? '\u25D0' : '\u25CB');
      var breakdown = buildTaskBreakdownHtml(shadowStatus, taskTypes);
      var modLink = '/learn-shadow/modules/' + modPath;

      return '<div class="enrollment-module-item ' + dispStatus + '">' +
        '<div class="enrollment-module-row">' +
          '<span class="enrollment-module-status">' + statusIcon + '</span>' +
          '<a href="' + modLink + '" class="enrollment-module-link">' + modName + '</a>' +
        '</div>' +
        (breakdown || '') +
        '</div>';
    });

    modulesHtml = moduleItems.join('');

    var pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    var isComplete = (totalCount > 0 && completedCount === totalCount);
    var hasStarted = completedCount > 0 || moduleRows.some(function (mod) {
      var modPath = (mod.values && mod.values.hs_path) || mod.hs_path || (mod.path || '');
      var shadowStatus = shadowStatuses[modPath];
      return shadowStatus && shadowStatus.module_status !== 'not_started';
    });

    var badge = isComplete
      ? statusBadgeHtml('Completed', 'status-completed')
      : (hasStarted
        ? statusBadgeHtml('In Progress', 'status-in-progress')
        : statusBadgeHtml('Not Started', 'status-not-started'));

    var html = '<div class="enrollment-card-header">' +
      '<h3><a href="' + href + '" style="color:#1a4e8a;text-decoration:none;">' + title + '</a></h3>' +
      '<div class="enrollment-badges"><span class="enrollment-badge">course</span>' + badge + '</div>' +
      '</div>';

    if (enrolledAt) {
      html += '<div class="enrollment-meta"><div>Enrolled ' + formatDate(enrolledAt) + '</div></div>';
    }

    if (totalCount > 0) {
      html += '<div class="enrollment-progress">' +
        '<div class="enrollment-progress-header">' +
          '<span class="enrollment-progress-label">' + completedCount + ' of ' + totalCount + ' modules complete</span>' +
        '</div>' +
        '<div class="enrollment-progress-bar">' +
          '<div class="enrollment-progress-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '</div>';

      html += '<details class="enrollment-modules-toggle">' +
        '<summary class="enrollment-modules-summary">View Modules (' + totalCount + ')</summary>' +
        '<div class="enrollment-modules-list">' + modulesHtml + '</div>' +
        '</details>';
    }

    if (isComplete) {
      html += '<div class="enrollment-actions"><a href="' + href + '" class="enrollment-cta enrollment-cta--done">Review Course \u2192</a></div>';
    } else if (nextModPath) {
      html += '<div class="enrollment-actions"><a href="/learn-shadow/modules/' + nextModPath + '" class="enrollment-cta">Continue to Next Module \u2192</a></div>';
    } else {
      html += '<div class="enrollment-actions"><a href="' + href + '" class="enrollment-cta">Start Course \u2192</a></div>';
    }

    card.innerHTML = html;
    return { card: card, isComplete: isComplete, isStarted: hasStarted };
  }

  // ----------------------------------------------------------------
  // Main entry point
  // ----------------------------------------------------------------

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    waitForIdentityReady().finally(function () {
      var auth = getAuth();
      var tableIds = getTableIds();

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
        // Unauthenticated: show auth prompt
        showMain();
        var authPrompt = q('auth-prompt');
        if (authPrompt) authPrompt.style.display = 'block';
        return;
      }

      // --- Step 1: Fetch enrollments ---
      var query = auth.contactId
        ? '?contactId=' + encodeURIComponent(auth.contactId)
        : '?email=' + encodeURIComponent(auth.email);

      var enrollUrl = API_BASE + '/enrollments/list' + query;

      fetchJSON(enrollUrl)
        .then(function (enrollData) {
          if (!enrollData || enrollData.mode !== 'authenticated') {
            showEmpty();
            return;
          }
          var courses = (enrollData.enrollments && enrollData.enrollments.courses) || [];
          if (courses.length === 0) {
            showEmpty();
            return;
          }

          // --- Step 2: Fetch HubDB module metadata for all enrolled courses ---
          var courseSlugs = courses.map(function (c) { return c.slug; }).filter(Boolean);

          var courseFetches = courseSlugs.map(function (slug) {
            return fetch('/hs/api/hubdb/v3/tables/' + tableIds.courses + '/rows?hs_path__eq=' + encodeURIComponent(slug))
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (d) {
                if (!d || !d.results || !d.results.length) return { courseSlug: slug, moduleSlugs: [] };
                var row = d.results[0];
                var json = (row.values && row.values.module_slugs_json) || row.module_slugs_json || '[]';
                var slugs = [];
                try { slugs = JSON.parse(json); } catch (e) {}
                return { courseSlug: slug, moduleSlugs: slugs };
              })
              .catch(function () { return { courseSlug: slug, moduleSlugs: [] }; });
          });

          Promise.all(courseFetches).then(function (courseMetaArr) {
            // Collect all unique module slugs
            var allModSlugsSet = {};
            courseMetaArr.forEach(function (cm) {
              cm.moduleSlugs.forEach(function (s) { allModSlugsSet[s] = true; });
            });
            var allModSlugs = Object.keys(allModSlugsSet);

            if (allModSlugs.length === 0) {
              renderEnrolledSection(courses, courseMetaArr, {}, {});
              return;
            }

            // Fetch HubDB module rows (includes completion_tasks_json)
            var filter = allModSlugs
              .map(function (s) { return 'hs_path__eq=' + encodeURIComponent(s); })
              .join('&');
            var modFetch = fetch('/hs/api/hubdb/v3/tables/' + tableIds.modules + '/rows?' + filter + '&tags__not__icontains=archived')
              .then(function (r) { return r.ok ? r.json() : { results: [] }; })
              .catch(function () { return { results: [] }; });

            // --- Step 3: Fetch shadow task statuses (batch) ---
            var batchUrl = API_BASE + '/tasks/status/batch?module_slugs=' +
              allModSlugs.map(encodeURIComponent).join(',');
            var batchFetch = fetch(batchUrl, { credentials: 'include' })
              .then(function (r) { return r.ok ? r.json() : null; })
              .catch(function () { return null; });

            Promise.all([modFetch, batchFetch]).then(function (results) {
              var modData = results[0];
              var batchData = results[1];

              // Build module row lookup: slug → HubDB row
              var modRowMap = {};
              ((modData && modData.results) || []).forEach(function (row) {
                var s = (row.values && row.values.hs_path) || row.hs_path || row.path;
                if (s) modRowMap[s] = row;
              });

              // Shadow statuses map: slug → { module_status, tasks }
              var shadowStatuses = (batchData && batchData.statuses) || {};

              renderEnrolledSection(courses, courseMetaArr, modRowMap, shadowStatuses);
            });
          });
        })
        .catch(function (err) {
          console.error('[shadow-my-learning] Error fetching enrollments:', err);
          showEmpty();
        });

      // ----------------------------------------------------------------
      // Render enrolled section with resolved data
      // ----------------------------------------------------------------
      function renderEnrolledSection(courses, courseMetaArr, modRowMap, shadowStatuses) {
        var enrolledSection = q('enrolled-section');
        var enrolledGrid = q('enrolled-grid');
        if (!enrolledSection || !enrolledGrid) { showMain(); return; }

        // Build course slug → moduleSlugs map
        var courseModMap = {};
        courseMetaArr.forEach(function (cm) {
          courseModMap[cm.courseSlug] = cm.moduleSlugs;
        });

        var totalEnrolled = 0;
        var totalComplete = 0;
        var totalInProgress = 0;

        courses.forEach(function (course) {
          var slug = course.slug || '';
          var moduleSlugs = courseModMap[slug] || [];
          var moduleRows = moduleSlugs
            .map(function (s) { return modRowMap[s] || null; })
            .filter(Boolean);

          var result = renderShadowCourseCard(course, moduleRows, shadowStatuses);
          enrolledGrid.appendChild(result.card);
          totalEnrolled++;
          if (result.isComplete) totalComplete++;
          else if (result.isStarted) totalInProgress++;
        });

        // Update counters
        var countEl = q('enrolled-count');
        if (countEl) countEl.textContent = '(' + totalEnrolled + ')';

        var statComplete = q('stat-complete');
        var statInProg = q('stat-in-progress');
        var statEnrolled = q('stat-enrolled');
        if (statComplete) statComplete.textContent = totalComplete;
        if (statInProg) statInProg.textContent = totalInProgress;
        if (statEnrolled) statEnrolled.textContent = totalEnrolled;

        enrolledSection.style.display = 'block';
        showMain();

        if (totalEnrolled === 0) {
          var es = q('empty-state');
          if (es) es.style.display = 'block';
        }
      }
    });
  });

}());
