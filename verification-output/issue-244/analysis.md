The key insight: All pages (catalog, courses, pathways, modules) extend the same base.html template.

This means request_contact.is_logged_in is available on ALL pages.

My implementation added window.hhServerIdentity to base.html, so it should already be working!

Possible issues:
1. HubSpot page caching (test uses ?hs_no_cache=1 to bypass)
2. request_contact.is_logged_in is false after login (HubSpot limitation on public pages)
3. Timing - server identity may not be set yet when auth-context.js runs
