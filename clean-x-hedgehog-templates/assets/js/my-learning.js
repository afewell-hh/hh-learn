/**
 * Hedgehog Learn – My Learning dashboard (CSP-safe) — #383 UX redesign
 *
 * Production version. For shadow version see assets/shadow/js/my-learning.js.
 *
 * - Authenticated users (Cognito): hydrate from CRM via /progress/read + /enrollments/list
 * - Anonymous users: fall back to localStorage (hh-module-* keys)
 * - All CRM calls gated on waitForIdentityReady() and data-enable-crm="true"
 * - HubDB used for display metadata only (names, descriptions, time estimates, ordering)
 */
(function(){
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function fetchJSON(u){ return fetch(u, { credentials: 'include' }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }

  function getConstants(){
    var ctx = document.getElementById('hhl-auth-context');
    var trackEventsUrl = ctx && ctx.getAttribute('data-track-events-url');
    return Promise.resolve({
      TRACK_EVENTS_URL: trackEventsUrl || null,
      TRACK_EVENTS_ENABLED: !!trackEventsUrl,
      HUBDB_COURSES_TABLE_ID: (ctx && ctx.getAttribute('data-hubdb-courses-table-id')) || null,
      HUBDB_MODULES_TABLE_ID: (ctx && ctx.getAttribute('data-hubdb-modules-table-id')) || null,
      HUBDB_PATHWAYS_TABLE_ID: (ctx && ctx.getAttribute('data-hubdb-pathways-table-id')) || null
    });
  }

  function getAuth(){
    var identity = window.hhIdentity ? window.hhIdentity.get() : null;
    var email = '';
    var contactId = '';
    if (identity) { email = identity.email || ''; contactId = identity.contactId || ''; }
    var el = document.getElementById('hhl-auth-context');
    var enableCrm = false;
    var loginUrl = '';
    if (el) {
      var enableAttr = el.getAttribute('data-enable-crm');
      enableCrm = enableAttr && enableAttr.toString().toLowerCase() === 'true';
      loginUrl = el.getAttribute('data-auth-login-url') || '';
    }
    return { enableCrm: enableCrm, email: email, contactId: contactId, loginUrl: loginUrl };
  }

  function waitForIdentityReady() {
    try {
      if (window.hhIdentity && window.hhIdentity.ready && typeof window.hhIdentity.ready.then === 'function') {
        return window.hhIdentity.ready;
      }
    } catch (error) {}
    return Promise.resolve(null);
  }

  function getReadUrl(constants){
    var track = (constants && constants.TRACK_EVENTS_URL) || '';
    if (track && track.indexOf('/events/track') >= 0) return track.replace('/events/track','/progress/read');
    return '/progress/read';
  }

  function getEnrollmentsUrl(constants){
    var track = (constants && constants.TRACK_EVENTS_URL) || '';
    if (track && track.indexOf('/events/track') >= 0) return track.replace('/events/track','/enrollments/list');
    return '/enrollments/list';
  }

  function getAllProgress(){
    var prog = { inProgress: new Set(), completed: new Set() };
    try {
      for (var i=0;i<localStorage.length;i++){
        var key = localStorage.key(i);
        if (key && key.startsWith('hh-module-')){
          var slug = key.replace('hh-module-','');
          try {
            var data = JSON.parse(localStorage.getItem(key)||'{}');
            if (data.completed) prog.completed.add(slug);
            else if (data.started) prog.inProgress.add(slug);
          } catch(e){}
        }
      }
    } catch(e){}
    return prog;
  }

  function setsFromCrm(progress){
    var res = { inProgress: new Set(), completed: new Set() };
    try {
      if (!progress) return res;
      Object.keys(progress).forEach(function(key){
        if (key === 'courses') {
          var courses = progress.courses || {};
          Object.keys(courses).forEach(function(courseSlug){
            var courseModules = (courses[courseSlug] && courses[courseSlug].modules) || {};
            Object.keys(courseModules).forEach(function(slug){
              var m = courseModules[slug] || {};
              if (m.completed) res.completed.add(slug);
              else if (m.started) res.inProgress.add(slug);
            });
          });
        } else {
          var flatMods = (progress[key] && progress[key].modules) || {};
          Object.keys(flatMods).forEach(function(slug){
            var m = flatMods[slug] || {};
            if (m.completed) res.completed.add(slug);
            else if (m.started) res.inProgress.add(slug);
          });
          var nestedCourses = (progress[key] && progress[key].courses) || {};
          Object.keys(nestedCourses).forEach(function(courseSlug){
            var courseModules = (nestedCourses[courseSlug] && nestedCourses[courseSlug].modules) || {};
            Object.keys(courseModules).forEach(function(slug){
              var m = courseModules[slug] || {};
              if (m.completed) res.completed.add(slug);
              else if (m.started) res.inProgress.add(slug);
            });
          });
        }
      });
    } catch(e){}
    return res;
  }

  function buildModuleCourseContextMap(progress){
    var map = {};
    try {
      if (!progress) return map;
      Object.keys(progress).forEach(function(key){
        if (key === 'courses') {
          var courses = progress.courses || {};
          Object.keys(courses).forEach(function(courseSlug){
            var mods = (courses[courseSlug] && courses[courseSlug].modules) || {};
            Object.keys(mods).forEach(function(slug){ map[slug] = courseSlug; });
          });
        } else {
          var nestedCourses = (progress[key] && progress[key].courses) || {};
          Object.keys(nestedCourses).forEach(function(courseSlug){
            var mods = (nestedCourses[courseSlug] && nestedCourses[courseSlug].modules) || {};
            Object.keys(mods).forEach(function(slug){ map[slug] = courseSlug; });
          });
          var flatMods = (progress[key] && progress[key].modules) || {};
          Object.keys(flatMods).forEach(function(slug){ if (!map[slug]) map[slug] = key; });
        }
      });
    } catch(e){}
    return map;
  }

  function q(id){ return document.getElementById(id); }

  function formatDate(isoString){
    if (!isoString) return '';
    try { return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch(e) { return ''; }
  }

  function formatRelativeTime(isoString){
    if (!isoString) return '';
    try {
      var diffDays = Math.floor((new Date() - new Date(isoString)) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'today';
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return diffDays + ' days ago';
      if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
      return formatDate(isoString);
    } catch(e) { return formatDate(isoString); }
  }

  function formatMinutes(min){
    if (!min || min <= 0) return '';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + 'h' + (m ? ' ' + m + 'm' : '');
  }

  function slugToTitle(slug){
    if (!slug) return '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); });
  }

  function statusBadgeHtml(label, cssClass){
    return '<span class="enrollment-status-badge '+cssClass+'">'+label+'</span>';
  }

  function showResume(last, constants){
    try {
      if (!last || !last.type || !last.slug) return;
      var panel = q('last-viewed-panel');
      if (!panel) return;
      // Production paths: modules at /learn/<slug>, courses at /learn/courses/<slug>
      var href = last.type === 'course' ? ('/learn/courses/' + last.slug) : ('/learn/' + last.slug);
      var timeStr = last.at ? ('Last viewed ' + formatRelativeTime(last.at)) : '';
      var typeLabel = last.type === 'course' ? 'Course' : 'Module';
      var typeCss = last.type === 'course' ? 'resume-type-course' : 'resume-type-module';
      var initialTitle = slugToTitle(last.slug);

      panel.innerHTML = '\
        <div class="resume-panel-inner">\
          <div class="resume-panel-left">\
            <span class="resume-type-badge '+typeCss+'">'+typeLabel+'</span>\
            <div class="resume-title" id="resume-title">'+initialTitle+'</div>\
            '+(timeStr?'<div class="resume-meta">'+timeStr+'</div>':'')+'\
          </div>\
          <a href="'+href+'" class="resume-cta">Continue \u2192</a>\
        </div>';
      panel.style.display = 'block';

      var tableId = last.type === 'course' ? constants.HUBDB_COURSES_TABLE_ID : constants.HUBDB_MODULES_TABLE_ID;
      if (tableId) {
        fetchJSON('/hs/api/hubdb/v3/tables/'+tableId+'/rows?hs_path__eq='+encodeURIComponent(last.slug))
          .then(function(data){
            var row = data && data.results && data.results[0];
            var title = row && ((row.values && row.values.hs_name) || row.hs_name);
            if (title) { var el = q('resume-title'); if (el) el.textContent = title; }
          })
          .catch(function(){});
      }
    } catch(e){}
  }

  function renderModuleCard(module, isCompleted, courseContext){
    var a = document.createElement('a');
    // Production: module links use /learn/<slug> directly
    a.href = '/learn/' + (module.path || module.hs_path || '');
    a.className = 'module-card';
    var minutes = (module.values && module.values.estimated_minutes) || module.estimated_minutes || 0;
    var name = (module.values && module.values.hs_name) || module.hs_name || 'Untitled Module';
    var desc = (module.values && module.values.meta_description) || module.meta_description || '';
    var ctxHtml = courseContext ? '<div class="module-card-course"><span class="module-course-context">'+slugToTitle(courseContext)+'</span></div>' : '';
    a.innerHTML = '<div class="module-card-header">\
        <span class="module-progress-badge '+(isCompleted?'completed':'')+'">'+(isCompleted?'Completed':'In Progress')+'</span>\
        <span class="module-time">'+minutes+' min</span>\
      </div>\
      '+ctxHtml+'\
      <h3>'+name+'</h3>' + (desc?('<p>'+desc.substring(0,150)+(desc.length>150?'...':'')+'</p>'):'') + '\
      <span class="module-cta">'+(isCompleted?'Review Module':'Continue Learning')+' \u2192</span>';
    return a;
  }

  function renderEnrollmentCard(item, type, courseMetadata, progressData, pathwayHubDbData){
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    var slug = item.slug || '';
    var enrolledAt = item.enrolled_at || '';

    if (type === 'pathway') {
      var href = '/learn/pathways/' + slug;
      var title = slugToTitle(slug);
      var pathwayCrm = (progressData && progressData.progress && progressData.progress[slug]) || {};
      var crmCourses = pathwayCrm.courses || {};
      var completedCount = Object.keys(crmCourses).filter(function(cs){ return crmCourses[cs] && crmCourses[cs].completed; }).length;
      var courseSlugs = (pathwayHubDbData && pathwayHubDbData.course_slugs && pathwayHubDbData.course_slugs.length)
        ? pathwayHubDbData.course_slugs : Object.keys(crmCourses);
      var totalCount = courseSlugs.length;
      var pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      var isComplete = !!pathwayCrm.completed;
      var hasStarted = !!pathwayCrm.started || completedCount > 0;

      var badge = isComplete ? statusBadgeHtml('Completed','status-completed') :
                  (hasStarted ? statusBadgeHtml('In Progress','status-in-progress') :
                  statusBadgeHtml('Not Started','status-not-started'));

      var nextCourse = null;
      for (var i = 0; i < courseSlugs.length; i++) {
        var cs = courseSlugs[i];
        if (!crmCourses[cs] || !crmCourses[cs].completed) { nextCourse = cs; break; }
      }

      var html = '<div class="enrollment-card-header">\
          <h3><a href="'+href+'" style="color:#1a4e8a;text-decoration:none;">'+title+'</a></h3>\
          <div class="enrollment-badges"><span class="enrollment-badge">pathway</span>'+badge+'</div>\
        </div>';
      if (enrolledAt) html += '<div class="enrollment-meta"><div class="enrollment-date">Enrolled '+formatDate(enrolledAt)+'</div></div>';
      if (totalCount > 0) {
        html += '<div class="enrollment-progress">\
          <div class="enrollment-progress-label">'+completedCount+' of '+totalCount+' courses complete</div>\
          <div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:'+pct+'%"></div></div>\
        </div>';
      }
      if (isComplete) {
        html += '<div class="enrollment-actions"><a href="'+href+'" class="enrollment-cta enrollment-cta--done">View Pathway \u2192</a></div>';
      } else if (nextCourse) {
        html += '<div class="enrollment-actions"><a href="/learn/courses/'+nextCourse+'" class="enrollment-cta">Continue Course \u2192</a></div>';
      } else {
        html += '<div class="enrollment-actions"><a href="'+href+'" class="enrollment-cta">Start Pathway \u2192</a></div>';
      }

      card.innerHTML = html;
      return card;
    }

    // Course card
    var href = '/learn/courses/' + slug;
    var title = slugToTitle(slug);
    var html = '';

    if (courseMetadata && courseMetadata.modules && courseMetadata.modules.length > 0) {
      var modules = courseMetadata.modules;
      var completedMods = 0;
      var totalMods = modules.length;
      var nextMod = null;
      var remainMins = 0;

      modules.forEach(function(mod){
        if (mod.completed) {
          completedMods++;
        } else {
          remainMins += mod.estimated_minutes || 0;
          if (!nextMod) nextMod = mod;
        }
      });

      var pct = totalMods > 0 ? Math.round((completedMods / totalMods) * 100) : 0;
      var isComplete = completedMods === totalMods;
      var badge = isComplete ? statusBadgeHtml('Completed','status-completed') :
                  (completedMods > 0 ? statusBadgeHtml('In Progress','status-in-progress') :
                  statusBadgeHtml('Not Started','status-not-started'));

      html = '<div class="enrollment-card-header">\
          <h3><a href="'+href+'" style="color:#1a4e8a;text-decoration:none;">'+title+'</a></h3>\
          <div class="enrollment-badges"><span class="enrollment-badge">course</span>'+badge+'</div>\
        </div>';
      if (enrolledAt) html += '<div class="enrollment-meta"><div class="enrollment-date">Enrolled '+formatDate(enrolledAt)+'</div></div>';

      html += '<div class="enrollment-progress">\
        <div class="enrollment-progress-header">\
          <span class="enrollment-progress-label">'+completedMods+' of '+totalMods+' modules complete</span>\
          '+(remainMins>0&&!isComplete?'<span class="enrollment-time-remaining">'+formatMinutes(remainMins)+' left</span>':'')+'\
        </div>\
        <div class="enrollment-progress-bar"><div class="enrollment-progress-fill" style="width:'+pct+'%"></div></div>\
      </div>';

      html += '<details class="enrollment-modules-toggle">\
        <summary class="enrollment-modules-summary">View Modules ('+totalMods+')</summary>\
        <div class="enrollment-modules-list">';
      modules.forEach(function(mod){
        var modPath = mod.path || mod.hs_path || mod.slug;
        var modName = mod.name || mod.hs_name || slugToTitle(modPath);
        var modStatus = mod.completed ? '\u2713' : (mod.started ? '\u25D0' : '\u25CB');
        var modStatusClass = mod.completed ? 'completed' : (mod.started ? 'in-progress' : 'not-started');
        html += '<div class="enrollment-module-item '+modStatusClass+'">\
          <span class="enrollment-module-status">'+modStatus+'</span>\
          <a href="/learn/'+modPath+'" class="enrollment-module-link">'+modName+'</a>\
        </div>';
      });
      html += '</div></details>';

      if (isComplete) {
        html += '<div class="enrollment-actions"><a href="'+href+'" class="enrollment-cta enrollment-cta--done">Review Course \u2192</a></div>';
      } else if (nextMod) {
        var nextPath = nextMod.path || nextMod.hs_path || nextMod.slug;
        html += '<div class="enrollment-actions"><a href="/learn/'+nextPath+'" class="enrollment-cta">Continue to Next Module \u2192</a></div>';
      } else {
        html += '<div class="enrollment-actions"><a href="'+href+'" class="enrollment-cta">Start Course \u2192</a></div>';
      }
    } else {
      html = '<div class="enrollment-card-header">\
          <h3><a href="'+href+'" style="color:#1a4e8a;text-decoration:none;">'+title+'</a></h3>\
          <div class="enrollment-badges"><span class="enrollment-badge">course</span></div>\
        </div>';
      if (enrolledAt) html += '<div class="enrollment-meta"><div class="enrollment-date">Enrolled '+formatDate(enrolledAt)+'</div></div>';
      html += '<div class="enrollment-actions"><a href="'+href+'" class="enrollment-cta">Continue Learning \u2192</a></div>';
    }

    card.innerHTML = html;
    return card;
  }

  function renderEnrolledContent(enrollments, constants, progressData){
    try {
      var pathways = enrollments.pathways || [];
      var courses = enrollments.courses || [];
      var enrolledSection = q('enrolled-section');
      var enrolledGrid = q('enrolled-grid');
      if (!enrolledSection || !enrolledGrid) return;
      enrolledGrid.innerHTML = '';

      if (pathways.length === 0 && courses.length === 0){
        enrolledSection.style.display = 'none';
        return;
      }

      var COURSES_TABLE_ID = constants.HUBDB_COURSES_TABLE_ID;
      var MODULES_TABLE_ID = constants.HUBDB_MODULES_TABLE_ID;
      var PATHWAYS_TABLE_ID = constants.HUBDB_PATHWAYS_TABLE_ID;

      function getCourseProgress(courseSlug){
        if (!progressData || !progressData.progress || !courseSlug) return null;
        var prog = progressData.progress;
        if (prog.courses && prog.courses[courseSlug]) return prog.courses[courseSlug];
        var found = null;
        Object.keys(prog).forEach(function(pk){
          if (pk !== 'courses' && prog[pk] && prog[pk].courses && prog[pk].courses[courseSlug]) {
            found = prog[pk].courses[courseSlug];
          }
        });
        return found;
      }

      function buildFallbackCourseMetadataMap(){
        var fallback = {};
        courses.forEach(function(course){
          var courseSlug = (course && course.slug) || '';
          if (!courseSlug) return;
          var cp = getCourseProgress(courseSlug);
          var modMap = (cp && cp.modules) || {};
          var modSlugs = Object.keys(modMap);
          if (!modSlugs.length) return;
          fallback[courseSlug] = {
            modules: modSlugs.map(function(ms){
              var mp = modMap[ms] || {};
              return { slug:ms, path:ms, hs_path:ms, name:slugToTitle(ms), hs_name:slugToTitle(ms), estimated_minutes:0, started:!!mp.started, completed:!!mp.completed };
            })
          };
        });
        return Object.keys(fallback).length ? fallback : null;
      }

      var pathwayFetches = pathways.map(function(pw){
        var slug = pw.slug || '';
        if (!PATHWAYS_TABLE_ID || !slug) return Promise.resolve(null);
        return fetchJSON('/hs/api/hubdb/v3/tables/'+PATHWAYS_TABLE_ID+'/rows?hs_path__eq='+encodeURIComponent(slug))
          .then(function(d){
            if (!d || !d.results || !d.results.length) return null;
            var row = d.results[0];
            var json = (row.values && row.values.course_slugs_json) || row.course_slugs_json || '[]';
            var slugs = []; try { slugs = JSON.parse(json); } catch(e){}
            return { pathwaySlug: slug, course_slugs: slugs };
          })
          .catch(function(){ return null; });
      });

      var courseFetches = courses.map(function(course){
        var slug = course.slug || '';
        if (!COURSES_TABLE_ID || !slug) return Promise.resolve(null);
        return fetchJSON('/hs/api/hubdb/v3/tables/'+COURSES_TABLE_ID+'/rows?hs_path__eq='+encodeURIComponent(slug))
          .then(function(d){
            if (!d || !d.results || !d.results.length) return null;
            var row = d.results[0];
            var json = (row.values && row.values.module_slugs_json) || row.module_slugs_json || '[]';
            var slugs = []; try { slugs = JSON.parse(json); } catch(e){}
            return { courseSlug: slug, moduleSlugs: slugs };
          })
          .catch(function(){ return null; });
      });

      Promise.all([Promise.all(pathwayFetches), Promise.all(courseFetches)]).then(function(res){
        var pathwaysData = res[0];
        var coursesData = res[1];

        var allModSlugs = [];
        coursesData.forEach(function(cd){ if (cd && cd.moduleSlugs) allModSlugs = allModSlugs.concat(cd.moduleSlugs); });
        allModSlugs = Array.from(new Set(allModSlugs));

        if (!allModSlugs.length || !MODULES_TABLE_ID) {
          renderEnrolledCards(pathways, courses, buildFallbackCourseMetadataMap(), progressData, pathwaysData);
          return;
        }

        var filter = allModSlugs.map(function(s){ return 'hs_path__eq='+encodeURIComponent(s); }).join('&');
        fetchJSON('/hs/api/hubdb/v3/tables/'+MODULES_TABLE_ID+'/rows?'+filter+'&tags__not__icontains=archived')
          .then(function(d){
            var modMap = {};
            ((d && d.results) || []).forEach(function(m){
              var s = (m.values && m.values.hs_path) || m.hs_path || m.path;
              if (s) modMap[s] = m;
            });

            var courseMetadataMap = {};
            coursesData.forEach(function(cd){
              if (!cd) return;
              var cp = getCourseProgress(cd.courseSlug);
              courseMetadataMap[cd.courseSlug] = {
                modules: cd.moduleSlugs.map(function(ms){
                  var md = modMap[ms] || {};
                  var mp = (cp && cp.modules && cp.modules[ms]) || {};
                  return {
                    slug: ms,
                    path: (md.values && md.values.hs_path) || md.hs_path || ms,
                    hs_path: (md.values && md.values.hs_path) || md.hs_path || ms,
                    name: (md.values && md.values.hs_name) || md.hs_name || '',
                    hs_name: (md.values && md.values.hs_name) || md.hs_name || '',
                    estimated_minutes: (md.values && md.values.estimated_minutes) || md.estimated_minutes || 0,
                    started: !!mp.started,
                    completed: !!mp.completed
                  };
                })
              };
            });

            renderEnrolledCards(pathways, courses, courseMetadataMap, progressData, pathwaysData);
          })
          .catch(function(err){
            console.error('[hhl-my-learning] Error fetching module metadata:', err);
            renderEnrolledCards(pathways, courses, buildFallbackCourseMetadataMap(), progressData, pathwaysData);
          });
      }).catch(function(err){
        console.error('[hhl-my-learning] Error fetching enrollment metadata:', err);
        renderEnrolledCards(pathways, courses, buildFallbackCourseMetadataMap(), progressData, []);
      });

      function renderEnrolledCards(pathways, courses, courseMetadataMap, progressData, pathwaysData){
        var pwMap = {};
        (pathwaysData||[]).forEach(function(pd){ if (pd && pd.pathwaySlug) pwMap[pd.pathwaySlug] = pd; });

        pathways.forEach(function(pw){
          enrolledGrid.appendChild(renderEnrollmentCard(pw, 'pathway', null, progressData, pwMap[pw.slug]||null));
        });
        courses.forEach(function(course){
          var meta = courseMetadataMap ? courseMetadataMap[course.slug] : null;
          enrolledGrid.appendChild(renderEnrollmentCard(course, 'course', meta, progressData, null));
        });

        var total = pathways.length + courses.length;
        var countEl = q('enrolled-count');
        if (countEl) countEl.textContent = '(' + total + ')';
        enrolledSection.style.display = 'block';

        var statEl = q('stat-enrolled');
        if (statEl) statEl.textContent = total;
      }
    } catch(e){
      console.error('[hhl-my-learning] Error rendering enrolled content:', e);
      var errorGrid = q('enrolled-grid');
      if (errorGrid) {
        errorGrid.innerHTML = '<div style="padding:20px;text-align:center;color:#666;"><p>Unable to load enrollments. Please refresh to try again.</p></div>';
      }
    }
  }

  ready(function(){
    waitForIdentityReady().finally(function(){
      Promise.resolve(getConstants()).then(function(constants){
        var MODULES_TABLE_ID = constants.HUBDB_MODULES_TABLE_ID;
        var auth = getAuth();
        var localSets = getAllProgress();

        function renderFromSets(sets, moduleCourseMap, hasEnrollments){
          var slugs = Array.from(new Set([].concat(Array.from(sets.inProgress), Array.from(sets.completed))));
          function done(modules){
            q('loading-state').style.display = 'none';
            q('main-content-container').style.display = 'block';
            var inProg = modules.filter(function(m){ return sets.inProgress.has(m.path); });
            var comp = modules.filter(function(m){ return sets.completed.has(m.path); });
            q('stat-in-progress').textContent = inProg.length;
            q('stat-completed').textContent = comp.length;
            if (inProg.length===0 && comp.length===0){
              if (!hasEnrollments) q('empty-state').style.display = 'block';
              return;
            }
            if (inProg.length>0){
              q('in-progress-count').textContent = '('+inProg.length+')';
              var c1 = q('in-progress-modules');
              inProg.forEach(function(m){
                var ctx = moduleCourseMap ? moduleCourseMap[m.path] : null;
                c1.appendChild(renderModuleCard(m, false, ctx));
              });
              q('in-progress-section').style.display = 'block';
            }
            if (comp.length>0){
              q('completed-count').textContent = '('+comp.length+')';
              var c2 = q('completed-modules');
              comp.forEach(function(m){
                var ctx = moduleCourseMap ? moduleCourseMap[m.path] : null;
                c2.appendChild(renderModuleCard(m, true, ctx));
              });
              q('completed-section').style.display = 'block';
            }
          }
          if (!MODULES_TABLE_ID || slugs.length===0){ return done([]); }
          var filter = slugs.map(function(s){ return 'hs_path__eq='+encodeURIComponent(s); }).join('&');
          fetchJSON('/hs/api/hubdb/v3/tables/'+MODULES_TABLE_ID+'/rows?'+filter+'&tags__not__icontains=archived')
            .then(function(data){ done((data && data.results)||[]); })
            .catch(function(){ done([]); });
        }

        if (auth.enableCrm && (auth.email || auth.contactId)){
          var syncEl = document.querySelector('.synced-indicator');
          if (syncEl) syncEl.style.display = 'flex';

          var readUrl = getReadUrl(constants);
          var enrollUrl = getEnrollmentsUrl(constants);
          var query = auth.contactId ? ('?contactId='+encodeURIComponent(auth.contactId)) : ('?email='+encodeURIComponent(auth.email));

          Promise.all([
            fetchJSON(readUrl + query).catch(function(){ return null; }),
            fetchJSON(enrollUrl + query).catch(function(){ return null; })
          ]).then(function(results){
            var progressData = results[0];
            var enrollmentData = results[1];

            if (progressData && progressData.mode === 'authenticated' && progressData.last_viewed){
              showResume(progressData.last_viewed, constants);
            }

            var hasEnrollments = !!(enrollmentData && enrollmentData.mode === 'authenticated' && enrollmentData.enrollments &&
              ((enrollmentData.enrollments.pathways || []).length + (enrollmentData.enrollments.courses || []).length) > 0);

            if (enrollmentData && enrollmentData.mode === 'authenticated' && enrollmentData.enrollments){
              renderEnrolledContent(enrollmentData.enrollments, constants, progressData);
            }

            var moduleCourseMap = null;
            if (progressData && progressData.progress) {
              moduleCourseMap = buildModuleCourseContextMap(progressData.progress);
            }

            if (progressData && progressData.mode === 'authenticated' && progressData.progress){
              return renderFromSets(setsFromCrm(progressData.progress), moduleCourseMap, hasEnrollments);
            }
            renderFromSets(localSets, null, hasEnrollments);
          }).catch(function(){ renderFromSets(localSets, null, false); });
        } else {
          var authPrompt = q('auth-prompt');
          if (authPrompt) authPrompt.style.display = 'block';
          renderFromSets(localSets, null, false);
        }
      });
    });
  });
})();
