/**
 * Learning Left Navigation - Mobile drawer functionality
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const nav = document.getElementById('learn-left-nav');
    const toggle = document.getElementById('learn-nav-toggle');
    const overlay = document.getElementById('learn-nav-overlay');

    if (!nav || !toggle || !overlay) {
      return; // Not a page with left nav
    }

    // Toggle nav on button click
    toggle.addEventListener('click', function() {
      const isActive = nav.classList.contains('active');
      if (isActive) {
        closeNav();
      } else {
        openNav();
      }
    });

    // Close nav when clicking overlay
    overlay.addEventListener('click', closeNav);

    // Close nav on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && nav.classList.contains('active')) {
        closeNav();
      }
    });

    function openNav() {
      nav.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    function closeNav() {
      nav.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = ''; // Restore scroll
    }
  }
})();
