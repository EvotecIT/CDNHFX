(function () {
  'use strict';

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(fmt, d, h, m, s) {
    var out = fmt || 'HH:mm:ss';
    out = out.replace(/DD/g, pad2(d));
    out = out.replace(/HH/g, pad2(h));
    out = out.replace(/MM/g, pad2(m));
    out = out.replace(/SS/g, pad2(s));
    return out;
  }

  function safeCallGlobal(fnName, el) {
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
        fn(el);
      }
    } catch (e) {
      // swallow
    }
  }

  function initCountdowns(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;

      var nodes = root.querySelectorAll('[data-hfx-countdown]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.__hfx_countdown_init) continue;
        el.__hfx_countdown_init = true;

        var endIso = el.getAttribute('data-hfx-countdown-end');
        if (!endIso) continue;
        var end = new Date(endIso);
        if (isNaN(end.getTime())) continue;

        var fmt = el.getAttribute('data-hfx-countdown-format') || 'HH:mm:ss';
        var onComplete = el.getAttribute('data-hfx-countdown-oncomplete');
        var eventName = el.getAttribute('data-hfx-countdown-complete-event');

        function update() {
          var now = new Date();
          var diff = Math.floor((end.getTime() - now.getTime()) / 1000);
          if (diff <= 0) {
            el.textContent = formatTime(fmt, 0, 0, 0, 0);
            if (el.__hfx_countdown_timer) {
              clearInterval(el.__hfx_countdown_timer);
              el.__hfx_countdown_timer = null;
            }

            if (eventName) {
              try {
                el.dispatchEvent(new CustomEvent(eventName, { detail: { element: el } }));
              } catch (e) {
                // swallow
              }
            }
            safeCallGlobal(onComplete, el);
            return;
          }

          var d = Math.floor(diff / 86400);
          var h = Math.floor((diff % 86400) / 3600);
          var m = Math.floor((diff % 3600) / 60);
          var s = diff % 60;
          el.textContent = formatTime(fmt, d, h, m, s);
        }

        update();
        el.__hfx_countdown_timer = setInterval(update, 1000);
      }
    } catch (e) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. HTMX or client-side injected fragments)
  window.hfxInitCountdowns = initCountdowns;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initCountdowns(document); });
  } else {
    initCountdowns(document);
  }
})();

