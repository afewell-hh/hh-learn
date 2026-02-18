/**
 * Hedgehog Learn – Pageview beacon (CSP-safe)
 * Sends a lightweight 'learning_page_viewed' event for module/course detail pages
 * Only sends when CRM sync is enabled and the user is logged in (email or contactId present)
 */
(function(){
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function fetchJSON(u){ return fetch(u, { credentials:'omit' }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }); }
  function getConstants(){
    // Issue #345: Read constants from data attributes (no more CORS fetch)
    var ctx = document.getElementById('hhl-auth-context');
    var trackEventsUrl = ctx && ctx.getAttribute('data-track-events-url');
    return Promise.resolve({
      TRACK_EVENTS_URL: trackEventsUrl || null,
      TRACK_EVENTS_ENABLED: !!trackEventsUrl
    });
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
      enableCrm = (enableAttr || '').toString().toLowerCase() === 'true';
    }
    return { enableCrm: enableCrm, email: email, contactId: contactId };
  }
  function send(constants, auth, payload){
    if (!constants || !constants.TRACK_EVENTS_ENABLED || !constants.TRACK_EVENTS_URL) return;
    if (!auth.enableCrm || (!auth.email && !auth.contactId)) return;
    var debug = (localStorage.getItem('HHL_DEBUG') === 'true');
    var body = { eventName:'learning_page_viewed', payload: payload, contactIdentifier:{} };
    if (auth.email) body.contactIdentifier.email = auth.email;
    if (auth.contactId) body.contactIdentifier.contactId = auth.contactId;
    try{
      if (debug) console.log('[hhl] pageview', body);
      if (navigator.sendBeacon){
        var blob = new Blob([JSON.stringify(body)], { type:'application/json' });
        navigator.sendBeacon(constants.TRACK_EVENTS_URL, blob);
      } else {
        fetch(constants.TRACK_EVENTS_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), keepalive:true }).catch(function(){});
      }
    }catch(e){/* no-op */}
  }
  function detect(){
    // Module detail emits <meta name="hhl:module_slug">; course detail emits <meta name="hhl:course_slug">
    var m = document.querySelector('meta[name="hhl:module_slug"]');
    var c = document.querySelector('meta[name="hhl:course_slug"]');
    if (m && m.content) return { type:'module', slug: m.content };
    if (c && c.content) return { type:'course', slug: c.content };
    return null;
  }
  ready(function(){
    var info = detect();
    if (!info) return; // Only detail pages
    Promise.all([getConstants(), Promise.resolve(getAuth())]).then(function(res){
      var constants = res[0];
      var auth = res[1];
      var payload = { content_type: info.type, slug: info.slug, ts: new Date().toISOString() };

      // Add course context if viewing a module from a course
      if (info.type === 'module' && window.hhCourseContext) {
        var context = window.hhCourseContext.getContext();
        if (context && context.courseSlug) {
          payload.course_slug = context.courseSlug;
        }
      }

      send(constants, auth, payload);
    });
  });
})();
