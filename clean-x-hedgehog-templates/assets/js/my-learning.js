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
    var el = document.getElementById('hhl-auth-context');
    if (!el) return { enableCrm:false };
    return {
      enableCrm: el.getAttribute('data-enable-crm') === 'true',
      email: el.getAttribute('data-email') || '',
      contactId: el.getAttribute('data-contact-id') || ''
    };
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
      Object.keys(progress).forEach(function(pathway){
        var modules = (progress[pathway] && progress[pathway].modules) || {};
        Object.keys(modules).forEach(function(slug){
          var m = modules[slug] || {};
          if (m.completed) res.completed.add(slug);
          else if (m.started) res.inProgress.add(slug);
        });
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
  function renderEnrollmentCard(item, type, modulesTable){
    var card = document.createElement('div');
    card.className = 'enrollment-card';
    var slug = item.slug || '';
    var enrolledAt = item.enrolled_at || '';
    var source = item.enrollment_source || 'unknown';
    var href = type === 'pathway' ? ('/learn/pathways/' + slug) : ('/learn/courses/' + slug);
    var title = slug.replace(/-/g, ' ').replace(/\b\w/g, function(l){ return l.toUpperCase(); });
    var sourceLabel = source.replace(/_/g, ' ');
    card.innerHTML = '<div class="enrollment-card-header">\
        <h3><a href="'+href+'" style="color:#1a4e8a; text-decoration:none;">'+title+'</a></h3>\
        <span class="enrollment-badge">'+type+'</span>\
      </div>\
      <div class="enrollment-meta">\
        <div class="enrollment-date"><strong>Enrolled:</strong> '+formatDate(enrolledAt)+'</div>\
        <div class="enrollment-source"><strong>Source:</strong> '+sourceLabel+'</div>\
      </div>\
      <div class="enrollment-actions">\
        <a href="'+href+'" class="enrollment-cta">Continue Learning →</a>\
      </div>';
    return card;
  }
  function renderEnrolledContent(enrollments){
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

      // Render pathways
      pathways.forEach(function(pathway){
        enrolledGrid.appendChild(renderEnrollmentCard(pathway, 'pathway'));
      });

      // Render courses
      courses.forEach(function(course){
        enrolledGrid.appendChild(renderEnrollmentCard(course, 'course'));
      });

      // Update count and show section
      var totalEnrolled = pathways.length + courses.length;
      var enrolledCount = q('enrolled-count');
      if (enrolledCount) enrolledCount.textContent = '(' + totalEnrolled + ')';
      enrolledSection.style.display = 'block';
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
            renderEnrolledContent(enrollmentData.enrollments);
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
