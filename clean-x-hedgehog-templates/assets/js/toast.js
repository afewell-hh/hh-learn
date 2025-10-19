/**
 * Toast Notification Utility for Hedgehog Learn
 * Provides accessible, CSP-safe toast notifications with auto-dismiss
 */

(function() {
  'use strict';

  /**
   * Initialize toast styles (singleton pattern)
   */
  function initToastStyles() {
    if (document.getElementById('hhl-toast-styles')) return;

    var style = document.createElement('style');
    style.id = 'hhl-toast-styles';
    style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(style);
  }

  /**
   * Show toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type of toast: 'success', 'info', 'error', or 'loading'
   * @param {number} duration - Duration in milliseconds (0 = no auto-dismiss)
   * @returns {HTMLElement} The toast element (useful for manual dismissal)
   */
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration !== undefined ? duration : 3000;

    // Ensure styles are initialized
    initToastStyles();

    // Check if toast container exists, create if not
    var container = document.getElementById('hhl-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'hhl-toast-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-label', 'Notifications');
      container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
      document.body.appendChild(container);
    }

    // Create toast element
    var toast = document.createElement('div');
    toast.className = 'hhl-toast hhl-toast-' + type;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    // Define colors based on type
    var colors = {
      success: { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', icon: '✓' },
      info: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', icon: 'ℹ️' },
      error: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', icon: '✕' },
      loading: { bg: '#E0E7FF', border: '#A5B4FC', text: '#3730A3', icon: '⟳' }
    };

    var color = colors[type] || colors.info;

    toast.style.cssText = [
      'background: ' + color.bg,
      'border: 1px solid ' + color.border,
      'color: ' + color.text,
      'padding: 12px 20px',
      'border-radius: 8px',
      'margin-bottom: 10px',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
      'min-width: 250px',
      'font-size: 0.875rem',
      'font-weight: 500',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'animation: slideIn 0.3s ease-out'
    ].join(';');

    toast.innerHTML = '<span style="font-size:1.2em" aria-hidden="true">' + color.icon + '</span><span>' + message + '</span>';

    container.appendChild(toast);

    // Auto-remove after duration (if not loading and duration > 0)
    if (type !== 'loading' && duration > 0) {
      setTimeout(function() {
        removeToast(toast);
      }, duration);
    }

    return toast;
  }

  /**
   * Remove a toast element with fade animation
   * @param {HTMLElement} toast - The toast element to remove
   */
  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease-out';
    setTimeout(function() {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Update an existing toast's message and type
   * @param {HTMLElement} toast - The toast element to update
   * @param {string} message - New message
   * @param {string} type - New type
   */
  function updateToast(toast, message, type) {
    if (!toast) return;

    var colors = {
      success: { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', icon: '✓' },
      info: { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', icon: 'ℹ️' },
      error: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', icon: '✕' },
      loading: { bg: '#E0E7FF', border: '#A5B4FC', text: '#3730A3', icon: '⟳' }
    };

    var color = colors[type] || colors.info;

    // Update styling
    toast.style.background = color.bg;
    toast.style.borderColor = color.border;
    toast.style.color = color.text;
    toast.className = 'hhl-toast hhl-toast-' + type;

    // Update content
    toast.innerHTML = '<span style="font-size:1.2em" aria-hidden="true">' + color.icon + '</span><span>' + message + '</span>';

    // Auto-remove if not loading
    if (type !== 'loading') {
      setTimeout(function() {
        removeToast(toast);
      }, 3000);
    }
  }

  // Expose globally
  window.hhToast = {
    show: showToast,
    remove: removeToast,
    update: updateToast
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToastStyles);
  } else {
    initToastStyles();
  }

})();
