(function () {
  'use strict';

  function safeCallGlobal(fnName, ev) {
    try {
      if (!fnName) return;
      var name = String(fnName).trim();
      if (!name) return;

      // normalize "foo()", "foo();" -> "foo"
      if (name.endsWith('();')) name = name.slice(0, -3);
      if (name.endsWith('()')) name = name.slice(0, -2);
      if (name.endsWith(';')) name = name.slice(0, -1);
      name = name.trim();
      if (!name) return;

      var fn = window[name];
      if (typeof fn === 'function') {
        fn(ev);
      }
    } catch (e) {
      // swallow
    }
  }

  function initStarRatings(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;
      if (typeof StarRating === 'undefined') return;

      var nodes = root.querySelectorAll('select[data-hfx-star-rating]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.__hfx_star_rating_init) continue;
        el.__hfx_star_rating_init = true;

        // star-rating.js reads additional options from data-options JSON automatically
        new StarRating(el);

        var onChange = el.getAttribute('data-hfx-star-rating-onchange');
        if (onChange) {
          el.__hfx_star_rating_onchange = onChange;
          el.addEventListener('change', function (ev) { safeCallGlobal(this.__hfx_star_rating_onchange, ev); });
        }
      }
    } catch (e) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. HTMX or client-side injected fragments)
  window.hfxInitStarRatings = initStarRatings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initStarRatings(document); });
  } else {
    initStarRatings(document);
  }
})();
