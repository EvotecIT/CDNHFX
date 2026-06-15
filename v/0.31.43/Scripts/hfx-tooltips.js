(function () {
  'use strict';

  function initTooltipsAndPopovers(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;
      if (typeof bootstrap === 'undefined') return;

      if (bootstrap.Tooltip) {
        var tooltipNodes = root.querySelectorAll('[data-bs-toggle="tooltip"]');
        for (var i = 0; i < tooltipNodes.length; i++) {
          var el = tooltipNodes[i];
          if (el.__hfx_tooltip_init) continue;
          el.__hfx_tooltip_init = true;

          if (bootstrap.Tooltip.getOrCreateInstance) {
            bootstrap.Tooltip.getOrCreateInstance(el);
          } else {
            new bootstrap.Tooltip(el);
          }
        }
      }

      if (bootstrap.Popover) {
        var popoverNodes = root.querySelectorAll('[data-bs-toggle="popover"]');
        for (var j = 0; j < popoverNodes.length; j++) {
          var elp = popoverNodes[j];
          if (elp.__hfx_popover_init) continue;
          elp.__hfx_popover_init = true;

          if (bootstrap.Popover.getOrCreateInstance) {
            bootstrap.Popover.getOrCreateInstance(elp);
          } else {
            new bootstrap.Popover(elp);
          }
        }
      }
    } catch (e) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. client-side injected fragments)
  window.hfxInitTooltips = initTooltipsAndPopovers;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initTooltipsAndPopovers(document); });
  } else {
    initTooltipsAndPopovers(document);
  }
})();

