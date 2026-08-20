(function () {
  'use strict';

  function parseBool(val) {
    if (val === null || val === undefined) return null;
    var v = String(val).toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'no') return false;
    return null;
  }

  function initToasts(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;
      if (typeof bootstrap === 'undefined' || !bootstrap.Toast) return;

      var nodes = root.querySelectorAll('.toast[data-hfx-toast]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.__hfx_toast_init) continue;
        el.__hfx_toast_init = true;

        var delayAttr = el.getAttribute('data-hfx-toast-delay');
        var delay = delayAttr ? parseInt(delayAttr, 10) : 0;
        if (isNaN(delay)) delay = 0;

        var autohideAttr = parseBool(el.getAttribute('data-hfx-toast-autohide'));
        var autohide = autohideAttr !== null ? autohideAttr : delay > 0;

        var animationAttr = parseBool(el.getAttribute('data-hfx-toast-animation'));
        var animation = animationAttr !== null ? animationAttr : true;

        var showAttr = parseBool(el.getAttribute('data-hfx-toast-show'));
        var show = showAttr !== null ? showAttr : true;

        var options = { autohide: autohide, animation: animation };
        if (delay > 0) options.delay = delay;

        var instance = bootstrap.Toast.getOrCreateInstance
          ? bootstrap.Toast.getOrCreateInstance(el, options)
          : new bootstrap.Toast(el, options);

        if (show) {
          instance.show();
        }
      }
    } catch (e) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. HTMX or client-side injected fragments)
  window.hfxInitToasts = initToasts;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initToasts(document); });
  } else {
    initToasts(document);
  }
})();

