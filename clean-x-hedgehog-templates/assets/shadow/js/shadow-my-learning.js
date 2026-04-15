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
 * are shown with a "No required tasks" pill but are NOT auto-counted as complete.
 * They are excluded from the course completion denominator — only modules with
 * at least one required task count toward course progress. Per policy #402/#403/#404:
 * empty task declarations do not become implicit completion-by-default.
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

  // Production API base: enrollments and auth endpoints (on custom domain).
  var API_BASE = 'https://api.hedgehog.cloud';
  // Shadow task endpoints use the /shadow path mapping on the same custom domain.
  // Keeps the request host as api.hedgehog.cloud so the host-only SameSite=Strict
  // cookie is sent.  See Issue #421 and serverless.yml ShadowApiPathMapping.
  var SHADOW_API_BASE = 'https://api.hedgehog.cloud/shadow';

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
  // Build certificate badge HTML for a completed module.
  // certId comes from the tasks/status single-module endpoint (cert_id field).
  // When certId is available the badge links directly to the verification page.
  // When certId is absent (batch endpoint used) the badge is display-only.
  // ----------------------------------------------------------------
  function buildCertBadgeHtml(certId) {
    var label = '\uD83C\uDF93 Certificate earned';
    if (certId) {
      return '<div class="shadow-cert-badge">' +
        '<a href="/shadow/certificate/' + encodeURIComponent(certId) + '" ' +
          'class="shadow-cert-link" target="_blank" rel="noopener noreferrer">' +
          label + ' &mdash; View Certificate</a>' +
        '</div>';
    }
    return '<div class="shadow-cert-badge">' + label + '</div>';
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
  // Determine module display status from shadow data.
  // Returns: 'complete' | 'in-progress' | 'not-started' | 'no-tasks'
  //
  // 'no-tasks' is a distinct neutral state for modules with no required tasks.
  // These modules are NOT auto-completed and do NOT count toward course
  // completion totals. Per policy #402/#403/#404.
  // ----------------------------------------------------------------
  function moduleDisplayStatus(shadowStatus, taskTypes) {
    if (taskTypes.hasNoRequiredTasks) return 'no-tasks';
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

    // Build module status list.
    // completedCount and taskModuleCount exclude 'no-tasks' modules:
    // per policy #402/#403/#404, modules with no required tasks do not count
    // toward or against course completion — only modules with explicit required
    // tasks (quiz / lab_attestation) participate in the progress denominator.
    var modulesHtml = '';
    var completedCount = 0;
    var taskModuleCount = 0; // modules that have at least one required task
    var nextModPath = null;

    var moduleItems = moduleRows.map(function (mod) {
      var modPath = (mod.values && mod.values.hs_path) || mod.hs_path || (mod.path || '');
      var modName = (mod.values && mod.values.hs_name) || mod.hs_name || slugToTitle(modPath);
      var taskJson = (mod.values && mod.values.completion_tasks_json) || '';
      var taskTypes = parseTaskTypes(taskJson);
      var shadowStatus = shadowStatuses[modPath];
      var dispStatus = moduleDisplayStatus(shadowStatus, taskTypes);

      if (dispStatus !== 'no-tasks') {
        taskModuleCount++;
        if (dispStatus === 'complete') completedCount++;
        // First non-complete task-module is the next action target
        if (dispStatus !== 'complete' && !nextModPath) nextModPath = modPath;
      }

      var statusIcon = dispStatus === 'complete'
        ? '\u2713'
        : (dispStatus === 'in-progress'
          ? '\u25D0'
          : (dispStatus === 'no-tasks' ? '\u2013' : '\u25CB'));
      var breakdown = buildTaskBreakdownHtml(shadowStatus, taskTypes);
      // cert_id is present in single-module tasks/status responses but not in batch responses.
      // Show the badge whenever the module is complete; link to verify page when certId is available.
      var certBadge = (dispStatus === 'complete')
        ? buildCertBadgeHtml((shadowStatus && shadowStatus.cert_id) || null)
        : '';
      var modLink = '/learn-shadow/modules/' + modPath;

      return '<div class="enrollment-module-item ' + dispStatus + '">' +
        '<div class="enrollment-module-row">' +
          '<span class="enrollment-module-status">' + statusIcon + '</span>' +
          '<a href="' + modLink + '" class="enrollment-module-link">' + modName + '</a>' +
        '</div>' +
        (breakdown || '') +
        (certBadge || '') +
        '</div>';
    });

    modulesHtml = moduleItems.join('');

    // Progress math uses taskModuleCount (not total module count) so that
    // no-task modules do not dilute or inflate completion percentage.
    var pct = taskModuleCount > 0 ? Math.round((completedCount / taskModuleCount) * 100) : 0;
    var isComplete = (taskModuleCount > 0 && completedCount === taskModuleCount);
    // hasStarted: at least one task-module has DynamoDB activity
    var hasStarted = completedCount > 0 || moduleRows.some(function (mod) {
      var modPath = (mod.values && mod.values.hs_path) || mod.hs_path || (mod.path || '');
      var taskJson = (mod.values && mod.values.completion_tasks_json) || '';
      var taskTypes = parseTaskTypes(taskJson);
      if (taskTypes.hasNoRequiredTasks) return false; // exclude no-task modules
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

    var totalCount = moduleRows.length; // all modules, for "View Modules (N)" label
    if (totalCount > 0) {
      // Progress label uses taskModuleCount so no-task modules don't appear in denominator
      var progressLabel = taskModuleCount > 0
        ? completedCount + ' of ' + taskModuleCount + ' task modules complete'
        : 'No task modules';
      html += '<div class="enrollment-progress">' +
        '<div class="enrollment-progress-header">' +
          '<span class="enrollment-progress-label">' + progressLabel + '</span>' +
        '</div>' +
        '<div class="enrollment-progress-bar">' +
          '<div class="enrollment-progress-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '</div>';

      // open by default so task pills are visible without requiring user interaction.
      // Shadow reviewers need to see task state immediately — AC #424 requirement.
      html += '<details class="enrollment-modules-toggle" open>' +
        '<summary class="enrollment-modules-summary">Modules (' + totalCount + ')</summary>' +
        '<div class="enrollment-modules-list">' + modulesHtml + '</div>' +
        '</details>';
    }

    if (isComplete) {
      html += '<div class="enrollment-cert-section">' + buildCertBadgeHtml(null) + '</div>';
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
            // Uses SHADOW_API_BASE (/shadow path mapping) so the auth cookie is sent.
            var batchUrl = SHADOW_API_BASE + '/tasks/status/batch?module_slugs=' +
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
