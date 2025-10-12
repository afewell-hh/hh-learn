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
        var filter = slugs.map(function(s){ return 'path__eq='+encodeURIComponent(s); }).join('&');
        fetchJSON('/hs/api/hubdb/v3/tables/'+MODULES_TABLE_ID+'/rows?'+filter+'&tags__not__icontains=archived')
          .then(function(data){ done((data && data.results)||[]); })
          .catch(function(){ done([]); });
      }

      if (auth.enableCrm && (auth.email || auth.contactId)){
        var readUrl = getReadUrl(constants);
        var q = auth.contactId ? ('?contactId='+encodeURIComponent(auth.contactId)) : ('?email='+encodeURIComponent(auth.email));
        fetchJSON(readUrl + q)
          .then(function(json){
            if (json && json.mode === 'authenticated' && json.progress){
              return renderFromSets(setsFromCrm(json.progress));
            }
            renderFromSets(localSets);
          })
          .catch(function(){ renderFromSets(localSets); });
      } else {
        renderFromSets(localSets);
      }
    });
  });
})();
