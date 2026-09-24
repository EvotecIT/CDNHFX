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

  function drawStar(span) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'gl-star-full');
    path.setAttribute('d', 'M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z');
    svg.appendChild(path);
    span.appendChild(svg);
  }

  function initStarRatings(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;
      if (typeof StarRating === 'undefined') return;

      var nodes = Array.prototype.slice.call(root.querySelectorAll('select[data-hfx-star-rating]'));
      if (root.matches && root.matches('select[data-hfx-star-rating]')) nodes.unshift(root);
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.__hfx_star_rating_init) continue;
        // Inline SVG keeps both online and standalone output independent of vendor image URLs.
        new StarRating(el, { stars: drawStar });
        if (!el.widget) continue;
        el.__hfx_star_rating_init = true;

        // The pinned vendor reset handler treats the first star's index (0) as empty.
        // Let the browser restore defaultSelected, then synchronize the visible widget.
        var form = el.form;
        if (form) {
          var widget = el.widget;
          form.removeEventListener('reset', widget.events.reset);
          widget.events.reset = (function (control, rating) {
            return function (event) {
              setTimeout(function () {
                if (!event.defaultPrevented && control.widget === rating) {
                  rating.selectValue(rating.selected(), false);
                }
              }, 0);
            };
          })(el, widget);
          form.addEventListener('reset', widget.events.reset);
        }

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
