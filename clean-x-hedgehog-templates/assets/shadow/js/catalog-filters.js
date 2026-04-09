/**
 * Catalog Filters - Client-side filtering for learning catalog
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
    const searchInput = document.getElementById('filter-search');
    const durationSelect = document.getElementById('filter-duration');
    const typeCheckboxes = document.querySelectorAll('input[name="type"]');
    const levelCheckboxes = document.querySelectorAll('input[name="level"]');
    const clearButton = document.getElementById('clear-filters');
    const catalogGrid = document.getElementById('catalog-grid');
    const noResults = document.getElementById('no-results');
    const visibleCount = document.getElementById('visible-count');
    const totalCount = document.getElementById('total-count');

    if (!catalogGrid) return; // Exit if catalog grid doesn't exist

    const allCards = Array.from(catalogGrid.querySelectorAll('.catalog-card'));
    const totalItems = allCards.length;

    // Set initial total count
    if (totalCount) totalCount.textContent = totalItems;

    // Attach event listeners
    if (searchInput) {
      searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    if (durationSelect) {
      durationSelect.addEventListener('change', applyFilters);
    }

    // Type checkboxes with "All" logic
    typeCheckboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        handleCheckboxGroup('type', this);
        applyFilters();
      });
    });

    // Level checkboxes with "All" logic
    levelCheckboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        handleCheckboxGroup('level', this);
        applyFilters();
      });
    });

    if (clearButton) {
      clearButton.addEventListener('click', clearAllFilters);
    }

    // Initial filter application
    applyFilters();

    /**
     * Handle "All" checkbox logic for a group
     */
    function handleCheckboxGroup(groupName, changedCheckbox) {
      const allCheckbox = document.getElementById(`${groupName}-all`);
      const otherCheckboxes = Array.from(
        document.querySelectorAll(`input[name="${groupName}"]:not([value="all"])`)
      );

      if (changedCheckbox.value === 'all') {
        // If "All" was clicked
        if (changedCheckbox.checked) {
          // Check all others
          otherCheckboxes.forEach(cb => cb.checked = true);
        } else {
          // Uncheck all others
          otherCheckboxes.forEach(cb => cb.checked = false);
        }
      } else {
        // If a specific option was clicked
        const allOthersChecked = otherCheckboxes.every(cb => cb.checked);
        if (allCheckbox) {
          allCheckbox.checked = allOthersChecked;
        }
      }
    }

    /**
     * Apply all filters to catalog cards
     */
    function applyFilters() {
      const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const durationRange = durationSelect ? durationSelect.value : 'all';

      // Get selected types (excluding "all")
      const selectedTypes = Array.from(
        document.querySelectorAll('input[name="type"]:checked:not([value="all"])')
      ).map(cb => cb.value);

      // Get selected levels (excluding "all")
      const selectedLevels = Array.from(
        document.querySelectorAll('input[name="level"]:checked:not([value="all"])')
      ).map(cb => cb.value);

      let visibleItems = 0;

      allCards.forEach(card => {
        const cardType = card.dataset.type;
        const cardLevel = card.dataset.level || '';
        const cardDuration = parseInt(card.dataset.duration) || 0;
        const cardTitle = card.dataset.title || '';
        const cardTags = card.dataset.tags || '';

        let show = true;

        // Filter by search term (searches title and tags)
        if (searchTerm && !cardTitle.includes(searchTerm) && !cardTags.includes(searchTerm)) {
          show = false;
        }

        // Filter by type
        if (selectedTypes.length > 0 && !selectedTypes.includes(cardType)) {
          show = false;
        }

        // Filter by level (allow items with no level if "all" is selected or empty levels)
        if (selectedLevels.length > 0 && cardLevel) {
          if (!selectedLevels.includes(cardLevel)) {
            show = false;
          }
        }

        // Filter by duration
        if (durationRange !== 'all' && cardDuration > 0) {
          const [min, max] = durationRange.split('-').map(Number);
          if (cardDuration < min || (max && cardDuration > max)) {
            show = false;
          }
        }

        // Apply visibility
        if (show) {
          card.classList.remove('hidden');
          visibleItems++;
        } else {
          card.classList.add('hidden');
        }
      });

      // Update results count
      if (visibleCount) {
        visibleCount.textContent = visibleItems;
      }

      // Show/hide "no results" message
      if (noResults) {
        if (visibleItems === 0) {
          noResults.style.display = 'block';
          if (catalogGrid) catalogGrid.style.display = 'none';
        } else {
          noResults.style.display = 'none';
          if (catalogGrid) catalogGrid.style.display = 'grid';
        }
      }
    }

    /**
     * Clear all filters and reset to defaults
     */
    function clearAllFilters() {
      // Clear search
      if (searchInput) searchInput.value = '';

      // Reset duration
      if (durationSelect) durationSelect.value = 'all';

      // Check all type checkboxes
      typeCheckboxes.forEach(cb => cb.checked = true);

      // Check all level checkboxes
      levelCheckboxes.forEach(cb => cb.checked = true);

      // Reapply filters
      applyFilters();

      // Announce to screen readers
      announceToScreenReader('All filters have been cleared');
    }

    /**
     * Debounce function for search input
     */
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    /**
     * Announce message to screen readers
     */
    function announceToScreenReader(message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      setTimeout(() => announcement.remove(), 1000);
    }
  }
})();
