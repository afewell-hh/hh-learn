/**
 * Shadow Certificate Display (Issue #429)
 *
 * Powers the /learn-shadow/certificate?id=<certId> CMS page.
 *
 * Flow:
 *   1. Read certId from URL query param (?id=...)
 *   2. Fetch GET /shadow/certificate/<certId>  — public, no auth
 *   3. Optionally fetch GET /auth/me  — for learner name (best-effort, no auth required)
 *   4. Render a certificate card in #certificate-container
 *
 * On error: show a human-readable "not found" message.
 *
 * Shadow-only: only renders on pages with #certificate-container present.
 *
 * @see Issue #429
 * @see GET /shadow/certificate/:certId (#427)
 * @see GET /auth/me (#303)
 */
(function () {
  'use strict';

  var SHADOW_API_BASE = 'https://api.hedgehog.cloud/shadow';
  var AUTH_API_BASE = 'https://api.hedgehog.cloud';

  var container = document.getElementById('certificate-container');
  if (!container) return; // Not on the certificate page

  // ----------------------------------------------------------------
  // Utilities
  // ----------------------------------------------------------------

  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (e) {
      // Fallback for older browsers
      var match = window.location.search.match(new RegExp('[?&]' + name + '=([^&]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    }
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      });
    } catch (e) { return isoString; }
  }

  function slugToTitle(slug) {
    if (!slug) return '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
  }

  function showError(msg) {
    container.innerHTML =
      '<div class="cert-display-error">' +
        '<p>' + msg + '</p>' +
        '<a href="/learn-shadow/my-learning" class="cert-back-link">Back to My Learning</a>' +
      '</div>';
  }

  function renderCertificate(certData, learnerName) {
    var entityTitle = certData.entityTitle
      ? certData.entityTitle
      : slugToTitle(certData.entitySlug || '');
    var typeLabel = certData.entityType === 'course' ? 'Course' : 'Module';
    var dateStr = formatDate(certData.issuedAt);
    var verifyUrl = window.location.href;
    var name = learnerName || 'Certificate Holder';

    container.innerHTML =
      '<div class="cert-display-card">' +
        '<div class="cert-display-header">' +
          '<div class="cert-display-brand">Hedgehog Learn</div>' +
        '</div>' +
        '<div class="cert-display-body">' +
          '<h1 class="cert-display-heading">Certificate of Completion</h1>' +
          '<p class="cert-display-subheading">This certifies that</p>' +
          '<div class="cert-display-learner">' + name + '</div>' +
          '<p class="cert-display-subheading">has successfully completed the ' + typeLabel.toLowerCase() + '</p>' +
          '<div class="cert-display-entity">' + entityTitle + '</div>' +
          (dateStr ? '<p class="cert-display-date">Completed on ' + dateStr + '</p>' : '') +
        '</div>' +
        '<div class="cert-display-footer">' +
          '<div class="cert-display-verify">' +
            '<span class="cert-verify-label">Certificate ID:</span> ' +
            '<span class="cert-verify-id">' + certData.certId + '</span>' +
          '</div>' +
          '<div class="cert-display-verify">' +
            '<span class="cert-verify-label">Verify at:</span> ' +
            '<a href="' + verifyUrl + '" class="cert-verify-link">' + verifyUrl + '</a>' +
          '</div>' +
          '<div class="cert-display-actions">' +
            '<button type="button" class="cert-copy-link-btn" id="cert-copy-link-btn">Copy Verification Link</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Bind copy link button
    var copyBtn = document.getElementById('cert-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = verifyUrl;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy Verification Link'; }, 2000);
          }).catch(function () {
            copyBtn.textContent = 'Copy failed';
            setTimeout(function () { copyBtn.textContent = 'Copy Verification Link'; }, 2000);
          });
        } else {
          try {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy Verification Link'; }, 2000);
          } catch (e) {
            copyBtn.textContent = 'Copy failed';
            setTimeout(function () { copyBtn.textContent = 'Copy Verification Link'; }, 2000);
          }
        }
      });
    }
  }

  // ----------------------------------------------------------------
  // Main flow
  // ----------------------------------------------------------------

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var certId = getQueryParam('id');

    if (!certId) {
      showError('No certificate ID provided. Please check the link.');
      return;
    }

    // Validate basic UUID-ish shape before fetching (client-side sanity check)
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(certId)) {
      showError('Certificate not found or invalid link.');
      return;
    }

    // Show loading indicator
    container.innerHTML = '<div class="cert-display-loading">Loading certificate...</div>';

    // Fetch certificate data (public endpoint)
    fetch(SHADOW_API_BASE + '/certificate/' + encodeURIComponent(certId))
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (certData) {
        if (!certData) {
          showError('Certificate not found or invalid link.');
          return;
        }

        // Best-effort: try to get learner name from /auth/me (requires being logged in)
        fetch(AUTH_API_BASE + '/auth/me', { credentials: 'include' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (meData) {
            var learnerName = null;
            if (meData) {
              var first = meData.givenName || '';
              var last = meData.familyName || '';
              if (first && last) {
                learnerName = first + ' ' + last;
              } else {
                learnerName = meData.email || null;
              }
            }
            renderCertificate(certData, learnerName);
          })
          .catch(function () {
            // Not logged in or /auth/me failed: render without name
            renderCertificate(certData, null);
          });
      })
      .catch(function (err) {
        console.error('[shadow-certificate] Fetch error:', err);
        showError('Unable to load certificate. Please try again later.');
      });
  });

}());
