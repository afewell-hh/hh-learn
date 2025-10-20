/**
 * Hedgehog Learn – My Learning dashboard (CSP-safe)
 * - Authenticated users: hydrate from CRM via GET /progress/read
 * - Logged-out users: fall back to localStorage
 * - Fetches module metadata from HubDB and renders In Progress and Completed sections
 */
(function(){
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function fetchJSON(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
  function getConstants(){
    var ctx = document.getElementById('hhl-auth-context');
    var url = ctx && ctx.getAttribute('data-constants-url');
    if(!url) url = '/CLEAN x HEDGEHOG/templates/config/constants.json';
    return fetchJSON(url).catch(function(){ return {}; });
  }
  function getAuth(){
    // Use window.hhIdentity API for actual membership authentication
    var identity = window.hhIdentity ? window.hhIdentity.get() : null;
    var email = '';
    var contactId = '';
    if (identity) {
      email = identity.email || '';
      contactId = identity.contactId || '';
    }
    // Get enableCrm from auth context div
    var el = document.getElementById('hhl-auth-context');
    var enableCrm = false;
    if (el) {
      var enableAttr = el.getAttribute('data-enable-crm');
      enableCrm = enableAttr && enableAttr.toString().toLowerCase() === 'true';
    }
    return { enableCrm: enableCrm, email: email, contactId: contactId };
  }
  function getReadUrl(constants){
    var track = (constants && constants.TRACK_EVENTS_URL) || '';
    // Derive: replace /events/track with /progress/read; fallback to relative
    if (track && track.indexOf('/events/track') >= 0) return track.replace('/events/track','/progress/read');
    return '/progress/read';
  }
  function getEnrollmentsUrl(constants){
    var track = (constants && constants.TRACK_EVENTS_URL) || '';
    // Derive: replace /events/track with /enrollments/list; fallback to relative
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
          try { var data = JSON.parse(localStorage.getItem(key)||'{}');
            if (data.completed) prog.completed.add(slug); else if (data.started) prog.inProgress.add(slug);
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

      // Process each top-level key
      Object.keys(progress).forEach(function(key){
        // Skip the 'courses' key as it's a container, not a pathway
        if (key === 'courses') {
          // Process courses separately - they have nested structure
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
          // Process pathway modules
          var modules = (progress[key] && progress[key].modules) || {};
          Object.keys(modules).forEach(function(slug){
            var m = modules[slug] || {};
            if (m.completed) res.completed.add(slug);
            else if (m.started) res.inProgress.add(slug);
          });
        }
      });
    } catch(e){}
    return res;
  }
  function renderModuleCard(module, isCompleted){
    var a = document.createElement('a');
    a.href = '/learn/' + (module.path || module.hs_path || '');
    a.className = 'module-card';
    var minutes = (module.values && module.values.estimated_minutes) || module.estimated_minutes || 0;
    var name = (module.values && module.values.hs_name) || module.hs_name || 'Untitled Module';
    var desc = (module.values && module.values.meta_description) || module.meta_description || '';
    a.innerHTML = '<div class="module-card-header">\
        <span class="module-progress-badge '+(isCompleted?'completed':'')+'">'+(isCompleted?'Completed':'In Progress')+'</span>\
        <span class="module-time">'+minutes+' min</span>\
      </div>\
      <h3>'+name+'</h3>' + (desc?('<p>'+desc.substring(0,150)+(desc.length>150?'...':'')+'</p>'):'') + '\
      <span class="module-cta">'+(isCompleted?'Review Module':'Continue Learning')+' →</span>';
    return a;
  }
  function q(id){ return document.getElementById(id); }
  function showResume(last){
    try{
      if (!last || !last.type || !last.slug) return;
      var panel = q('last-viewed-panel');
      var link = q('last-viewed-link');
      var meta = q('last-viewed-meta');
      var href = last.type === 'course' ? ('/learn/courses/' + last.slug) : ('/learn/' + last.slug);
      link.href = href;
      link.textContent = (last.type==='course'?'Course: ':'Module: ') + last.slug;
      if (last.at) meta.textContent = '· viewed ' + last.at;
      panel.style.display = 'block';
    }catch(e){}
  }
  function formatDate(isoString){
    if (!isoString) return '';
    try {
      var d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch(e) { return ''; }
  }
  function formatRelativeTime(isoString){
    if (!isoString) return '';
    try {
      var now = new Date();
      var then = new Date(isoString);
      var diffMs = now - then;
      var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'today';
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return diffDays + ' days ago';
      if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
      return formatDate(isoString);
    } catch(e) { return formatDate(isoString); }
  }
  function renderEnrollmentCard(item, type, courseMetadata, progressData){
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    var slug = item.slug || '';
    var enrolledAt = item.enrolled_at || '';
    var source = item.enrollment_source || 'unknown';
    var href = type === 'pathway' ? ('/learn/pathways/' + slug) : ('/learn/courses/' + slug);
    var title = slug.replace(/-/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); });
    var sourceLabel = source.replace(/_/g, ' ');

    // Build card header
    var html = '<div class="enrollment-card-header">\
        <h3><a href="'+href+'" style="color:#1a4e8a; text-decoration:none;">'+title+'</a></h3>\
        <span class="enrollment-badge">'+type+'</span>\
      </div>\
      <div class="enrollment-meta">\
        <div class="enrollment-date"><strong>Enrolled:</strong> '+formatDate(enrolledAt)+'</div>\
        <div class="enrollment-source"><strong>Source:</strong> '+sourceLabel+'</div>\
      </div>';

    // Add module listings if courseMetadata is provided
    if (courseMetadata && courseMetadata.modules && courseMetadata.modules.length > 0){
      var modules = courseMetadata.modules;
      var completedCount = 0;
      var totalCount = modules.length;
      var nextIncompleteModule = null;

      // Calculate completion count and find next incomplete
      modules.forEach(function(mod){
        if (mod.completed) {
          completedCount++;
        } else if (!nextIncompleteModule && mod.started) {
          nextIncompleteModule = mod;
        } else if (!nextIncompleteModule && !mod.started) {
          nextIncompleteModule = mod;
        }
      });

      var progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Add progress bar
      html += '<div class="enrollment-progress">\
        <div class="enrollment-progress-label">'+completedCount+' of '+totalCount+' modules complete ('+progressPercent+'%)</div>\
        <div class="enrollment-progress-bar">\
          <div class="enrollment-progress-fill" style="width:'+progressPercent+'%"></div>\
        </div>\
      </div>';

      // Add collapsible module list
      html += '<details class="enrollment-modules-toggle">\
        <summary class="enrollment-modules-summary">View Modules</summary>\
        <div class="enrollment-modules-list">';

      modules.forEach(function(mod){
        var modPath = mod.path || mod.hs_path || mod.slug;
        var modName = mod.name || mod.hs_name || modPath.replace(/-/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); });
        var modStatus = mod.completed ? '✓' : (mod.started ? '◐' : '○');
        var modStatusClass = mod.completed ? 'completed' : (mod.started ? 'in-progress' : 'not-started');
        html += '<div class="enrollment-module-item '+modStatusClass+'">\
          <span class="enrollment-module-status">'+modStatus+'</span>\
          <a href="/learn/'+modPath+'" class="enrollment-module-link">'+modName+'</a>\
        </div>';
      });

      html += '</div></details>';

      // Update "Continue" button to link to next incomplete module
      if (nextIncompleteModule) {
        var nextPath = nextIncompleteModule.path || nextIncompleteModule.hs_path || nextIncompleteModule.slug;
        html += '<div class="enrollment-actions">\
          <a href="/learn/'+nextPath+'" class="enrollment-cta">Continue to Next Module →</a>\
        </div>';
      } else {
        html += '<div class="enrollment-actions">\
          <a href="'+href+'" class="enrollment-cta">View Course →</a>\
        </div>';
      }
    } else {
      // No module metadata, show generic "Continue Learning" button
      html += '<div class="enrollment-actions">\
        <a href="'+href+'" class="enrollment-cta">Continue Learning →</a>\
      </div>';
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

      // Clear existing content
      enrolledGrid.innerHTML = '';

      if (pathways.length === 0 && courses.length === 0){
        enrolledSection.style.display = 'none';
        return;
      }

      var COURSES_TABLE_ID = constants.HUBDB_COURSES_TABLE_ID;
      var MODULES_TABLE_ID = constants.HUBDB_MODULES_TABLE_ID;

      // Fetch course metadata for all enrolled courses
      var coursePromises = courses.map(function(course){
        var courseSlug = course.slug || '';
        if (!COURSES_TABLE_ID || !courseSlug) return Promise.resolve(null);

        return fetchJSON('/hs/api/hubdb/v3/tables/'+COURSES_TABLE_ID+'/rows?hs_path__eq='+encodeURIComponent(courseSlug))
          .then(function(data){
            if (!data || !data.results || data.results.length === 0) return null;
            var courseRow = data.results[0];
            var moduleSlugsJson = (courseRow.values && courseRow.values.module_slugs_json) || courseRow.module_slugs_json || '[]';
            var moduleSlugs = [];
            try {
              moduleSlugs = JSON.parse(moduleSlugsJson);
            } catch(e){}

            return {
              courseSlug: courseSlug,
              moduleSlugs: moduleSlugs,
              courseRow: courseRow
            };
          })
          .catch(function(){ return null; });
      });

      // Wait for all course metadata to load
      Promise.all(coursePromises).then(function(coursesData){
        // Fetch module metadata for all unique module slugs
        var allModuleSlugs = [];
        coursesData.forEach(function(courseData){
          if (courseData && courseData.moduleSlugs) {
            allModuleSlugs = allModuleSlugs.concat(courseData.moduleSlugs);
          }
        });

        // Remove duplicates
        allModuleSlugs = Array.from(new Set(allModuleSlugs));

        if (allModuleSlugs.length === 0 || !MODULES_TABLE_ID) {
          // No modules to fetch, render without module metadata
          renderEnrolledCards(pathways, courses, null, null);
          return;
        }

        // Fetch all module metadata in one batch
        var filter = allModuleSlugs.map(function(s){ return 'hs_path__eq='+encodeURIComponent(s); }).join('&');
        fetchJSON('/hs/api/hubdb/v3/tables/'+MODULES_TABLE_ID+'/rows?'+filter+'&tags__not__icontains=archived')
          .then(function(data){
            var modules = (data && data.results) || [];

            // Build a map of moduleSlug -> moduleData
            var moduleMap = {};
            modules.forEach(function(mod){
              var slug = (mod.values && mod.values.hs_path) || mod.hs_path || mod.path;
              if (slug) moduleMap[slug] = mod;
            });

            // Build course metadata with modules and progress
            var courseMetadataMap = {};
            coursesData.forEach(function(courseData){
              if (!courseData) return;
              var courseSlug = courseData.courseSlug;
              var moduleSlugs = courseData.moduleSlugs;

              // Get progress data for this course
              var courseProgress = null;
              if (progressData && progressData.progress) {
                var prog = progressData.progress;
                // Check in courses container
                if (prog.courses && prog.courses[courseSlug]) {
                  courseProgress = prog.courses[courseSlug];
                }
                // Also check in pathways
                Object.keys(prog).forEach(function(pathwaySlug){
                  if (pathwaySlug !== 'courses' && prog[pathwaySlug].courses && prog[pathwaySlug].courses[courseSlug]) {
                    courseProgress = prog[pathwaySlug].courses[courseSlug];
                  }
                });
              }

              // Build module list with progress
              var modulesWithProgress = moduleSlugs.map(function(modSlug){
                var modData = moduleMap[modSlug] || {};
                var modProgress = (courseProgress && courseProgress.modules && courseProgress.modules[modSlug]) || {};
                return {
                  slug: modSlug,
                  path: (modData.values && modData.values.hs_path) || modData.hs_path || modSlug,
                  hs_path: (modData.values && modData.values.hs_path) || modData.hs_path || modSlug,
                  name: (modData.values && modData.values.hs_name) || modData.hs_name || '',
                  hs_name: (modData.values && modData.values.hs_name) || modData.hs_name || '',
                  started: modProgress.started || false,
                  completed: modProgress.completed || false
                };
              });

              courseMetadataMap[courseSlug] = {
                modules: modulesWithProgress
              };
            });

            renderEnrolledCards(pathways, courses, courseMetadataMap, progressData);
          })
          .catch(function(err){
            console.error('[hhl-my-learning] Error fetching module metadata:', err);
            renderEnrolledCards(pathways, courses, null, null);
          });
      }).catch(function(err){
        console.error('[hhl-my-learning] Error fetching course metadata:', err);
        renderEnrolledCards(pathways, courses, null, null);
      });

      function renderEnrolledCards(pathways, courses, courseMetadataMap, progressData){
        // Render pathways
        pathways.forEach(function(pathway){
          enrolledGrid.appendChild(renderEnrollmentCard(pathway, 'pathway', null, progressData));
        });

        // Render courses with metadata
        courses.forEach(function(course){
          var courseMetadata = courseMetadataMap ? courseMetadataMap[course.slug] : null;
          enrolledGrid.appendChild(renderEnrollmentCard(course, 'course', courseMetadata, progressData));
        });

        // Update count and show section
        var totalEnrolled = pathways.length + courses.length;
        var enrolledCount = q('enrolled-count');
        if (enrolledCount) enrolledCount.textContent = '(' + totalEnrolled + ')';
        enrolledSection.style.display = 'block';
      }
    } catch(e){
      console.error('[hhl-my-learning] Error rendering enrolled content:', e);
      // Show error state to user
      var errorGrid = q('enrolled-grid');
      if (errorGrid) {
        errorGrid.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">\
          <p>Unable to load enrollments. Please refresh the page to try again.</p>\
        </div>';
      }
    }
  }

  ready(function(){
    Promise.resolve(getConstants()).then(function(constants){
      var MODULES_TABLE_ID = constants.HUBDB_MODULES_TABLE_ID;
      var auth = getAuth();
      // default: localStorage fallback
      var localSets = getAllProgress();

      function renderFromSets(sets){
        var slugs = Array.from(new Set([].concat(Array.from(sets.inProgress), Array.from(sets.completed))));
        function done(modules){
          q('loading-state').style.display = 'none';
          q('main-content-container').style.display = 'block';
          var inProg = modules.filter(function(m){ return sets.inProgress.has(m.path); });
          var comp = modules.filter(function(m){ return sets.completed.has(m.path); });
          q('stat-in-progress').textContent = inProg.length;
          q('stat-completed').textContent = comp.length;
          if (inProg.length===0 && comp.length===0){ q('empty-state').style.display = 'block'; return; }
          if (inProg.length>0){
            q('in-progress-count').textContent = '('+inProg.length+')';
            var c1 = q('in-progress-modules'); inProg.forEach(function(m){ c1.appendChild(renderModuleCard(m,false)); });
            q('in-progress-section').style.display = 'block';
          }
          if (comp.length>0){
            q('completed-count').textContent = '('+comp.length+')';
            var c2 = q('completed-modules'); comp.forEach(function(m){ c2.appendChild(renderModuleCard(m,true)); });
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
        var readUrl = getReadUrl(constants);
        var enrollUrl = getEnrollmentsUrl(constants);
        var query = auth.contactId ? ('?contactId='+encodeURIComponent(auth.contactId)) : ('?email='+encodeURIComponent(auth.email));

        // Fetch both progress and enrollments in parallel
        Promise.all([
          fetchJSON(readUrl + query).catch(function(){ return null; }),
          fetchJSON(enrollUrl + query).catch(function(){ return null; })
        ]).then(function(results){
          var progressData = results[0];
          var enrollmentData = results[1];

          // Show resume panel if available
          if (progressData && progressData.mode === 'authenticated' && progressData.last_viewed){
            showResume(progressData.last_viewed);
          }

          // Render enrolled content if available
          if (enrollmentData && enrollmentData.mode === 'authenticated' && enrollmentData.enrollments){
            renderEnrolledContent(enrollmentData.enrollments, constants, progressData);
          }

          // Render module progress
          if (progressData && progressData.mode === 'authenticated' && progressData.progress){
            return renderFromSets(setsFromCrm(progressData.progress));
          }
          renderFromSets(localSets);
        }).catch(function(){ renderFromSets(localSets); });
      } else {
        renderFromSets(localSets);
      }
    });
  });
})();
