/**
 * Hedgehog Learn – My Learning dashboard (CSP-safe)
 * - Reads local progress and fetches module metadata from HubDB
 * - Renders in-progress and completed sections
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
      var p = getAllProgress();
      var slugs = Array.from(new Set([].concat(Array.from(p.inProgress), Array.from(p.completed))));
      function done(modules){
        q('loading-state').style.display = 'none';
        q('main-content-container').style.display = 'block';
        var inProg = modules.filter(m => p.inProgress.has(m.path));
        var comp = modules.filter(m => p.completed.has(m.path));
        q('stat-in-progress').textContent = inProg.length;
        q('stat-completed').textContent = comp.length;
        if (inProg.length===0 && comp.length===0){ q('empty-state').style.display = 'block'; return; }
        if (inProg.length>0){
          q('in-progress-count').textContent = '('+inProg.length+')';
          var c1 = q('in-progress-modules'); inProg.forEach(m => c1.appendChild(renderModuleCard(m,false)));
          q('in-progress-section').style.display = 'block';
        }
        if (comp.length>0){
          q('completed-count').textContent = '('+comp.length+')';
          var c2 = q('completed-modules'); comp.forEach(m => c2.appendChild(renderModuleCard(m,true)));
          q('completed-section').style.display = 'block';
        }
      }
      if (!MODULES_TABLE_ID || slugs.length===0){ return done([]); }
      var filter = slugs.map(function(s){ return 'path__eq='+encodeURIComponent(s); }).join('&');
      fetchJSON('/hs/api/hubdb/v3/tables/'+MODULES_TABLE_ID+'/rows?'+filter+'&tags__not__icontains=archived')
        .then(function(data){ done((data && data.results)||[]); })
        .catch(function(){ done([]); });
    });
  });
})();

