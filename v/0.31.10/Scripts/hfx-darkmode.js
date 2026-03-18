(function () {
  'use strict';
  var DEFAULT_STORAGE_KEY = 'theme';
  var DEFAULT_A11Y_KEY = 'hfx-a11y';

  function normalizeTheme(val) {
    var v = String(val || '').toLowerCase();
    if (v === 'dark' || v === 'light') return v;
    if (v === 'auto' || v === 'system') return 'auto';
    if (v === 'dark-black' || v === 'black' || v === 'darkblack') return 'dark-black';
    if (v === 'dark-carbon' || v === 'carbon' || v === 'darkcarbon') return 'dark-carbon';
    return null;
  }

  function normalizeA11y(val) {
    var s = String(val || '').toLowerCase().replace(/[+_]/g, ' ');
    if (!s || s === 'none' || s === 'default') return '';
    var parts = s.split(/\s+/);
    var hc = false;
    var cb = false;
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      if (t === 'high-contrast' || t === 'highcontrast' || t === 'contrast' || t === 'hc') hc = true;
      if (t === 'color-blind' || t === 'colorblind' || t === 'colorblind-safe' || t === 'cb') cb = true;
    }
    if (hc && cb) return 'high-contrast color-blind';
    if (hc) return 'high-contrast';
    if (cb) return 'color-blind';
    return '';
  }

  function baseModeOf(themeToken) {
    var t = normalizeTheme(themeToken);
    if (t === 'dark') return 'dark';
    if (t === 'light') return 'light';
    if (t === 'dark-black') return 'dark';
    if (t === 'dark-carbon') return 'dark';
    if (t === 'auto') return 'auto';
    return null;
  }

  function getPreferredTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function getRootAttr(name) {
    try {
      return document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute(name)
        : null;
    } catch (_e) {
      return null;
    }
  }

  function resolveAutoTheme() {
    var mode = getPreferredTheme();
    var token = mode;

    // Allow documents to specify different defaults for dark/light while in auto mode.
    try {
      if (mode === 'dark') {
        var defDark = normalizeTheme(getRootAttr('data-hfx-theme-default-dark'));
        if (defDark && baseModeOf(defDark) === 'dark') token = defDark;
      } else {
        var defLight = normalizeTheme(getRootAttr('data-hfx-theme-default-light'));
        if (defLight && baseModeOf(defLight) === 'light') token = defLight;
      }
    } catch (_e) { /* swallow */ }

    return { mode: mode, token: token, selection: 'auto' };
  }

  function resolveThemeSelection(selectionToken) {
    var sel = normalizeTheme(selectionToken);
    if (sel == null || sel === 'auto') return resolveAutoTheme();

    var mode = baseModeOf(sel);
    if (mode !== 'dark' && mode !== 'light') return resolveAutoTheme();

    return { mode: mode, token: sel, selection: sel };
  }

  function applyTheme(mode, token, selection) {
    var prevMode = null;
    var prevToken = null;
    try {
      prevMode = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-bs-theme')
        : null;
    } catch (_p) {
      prevMode = null;
    }
    try {
      prevToken = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-hfx-theme')
        : null;
    } catch (_p2) {
      prevToken = null;
    }
    try {
      document.documentElement.setAttribute('data-bs-theme', mode);
    } catch (e) {
      // swallow
    }
    try {
      if (document.body) document.body.setAttribute('data-bs-theme', mode);
    } catch (e2) {
      // swallow
    }

    try {
      if (token && document && document.documentElement && document.documentElement.setAttribute) {
        document.documentElement.setAttribute('data-hfx-theme', token);
      }
    } catch (_t1) { /* swallow */ }
    try {
      if (token && document.body) document.body.setAttribute('data-hfx-theme', token);
    } catch (_t2) { /* swallow */ }

    try {
      var sel = selection || 'auto';
      if (document && document.documentElement && document.documentElement.setAttribute) {
        document.documentElement.setAttribute('data-hfx-theme-selection', sel);
      }
      if (document.body) document.body.setAttribute('data-hfx-theme-selection', sel);
    } catch (_s) { /* swallow */ }

    try { updateThemeAria(selection); } catch (_a11y) { /* swallow */ }

    // Notify integrations (charts, maps, etc.). Fires only when the theme value changes.
    try {
      if ((prevMode !== mode || prevToken !== token) && window && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('hfx:themechange', { detail: { theme: mode, variant: token, selection: selection || 'auto' } }));
      }
    } catch (_evt) {
      // swallow
    }
  }

  function getStoredTheme(key) {
    try {
      var t = localStorage.getItem(key);
      var n = normalizeTheme(t);
      // Back-compat: treat 'auto' as no explicit preference.
      return n === 'auto' ? null : n;
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(key, theme) {
    try {
      if (theme === 'auto' || theme == null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, theme);
      }
    } catch (e) {
      // swallow
    }
  }

  function getUrlTheme(paramName) {
    try {
      if (!window || !window.location) return null;
      var url = new URL(window.location.href);
      var v = url.searchParams.get(paramName || 'theme');
      return normalizeTheme(v);
    } catch (e) {
      return null;
    }
  }

  function getThemeFromHref(href) {
    try {
      if (!href) return null;
      var url = new URL(href, window.location.href);
      return normalizeTheme(url.searchParams.get('theme'));
    } catch (e) {
      return null;
    }
  }

  function applyResolvedTheme(selectionToken, key) {
    var resolved = resolveThemeSelection(selectionToken);

    try {
      if (resolved.selection === 'auto' || resolved.selection == null) setStoredTheme(key, 'auto');
      else setStoredTheme(key, resolved.selection);
    } catch (_e) { /* swallow */ }

    applyTheme(resolved.mode, resolved.token, resolved.selection);
  }

  function getDocumentStorageKey() {
    try {
      var k = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-hfx-darkmode-key')
        : null;
      return (k && String(k)) ? String(k) : null;
    } catch (e) {
      return null;
    }
  }

  function getDocumentA11yKey() {
    try {
      var k = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-hfx-a11y-key')
        : null;
      return (k && String(k)) ? String(k) : null;
    } catch (e) {
      return null;
    }
  }

  function getStoredA11y(key) {
    try {
      var v = localStorage.getItem(key);
      var n = normalizeA11y(v);
      return n || null;
    } catch (e) {
      return null;
    }
  }

  function setStoredA11y(key, selection) {
    try {
      if (!selection) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, selection);
      }
    } catch (e) {
      // swallow
    }
  }

  function syncA11yToBody() {
    try {
      if (!document || !document.body) return;
      var v = null;
      try { v = document.documentElement && document.documentElement.getAttribute ? document.documentElement.getAttribute('data-hfx-a11y') : null; } catch (_e1) { v = null; }
      if (v) document.body.setAttribute('data-hfx-a11y', v);
      else document.body.removeAttribute('data-hfx-a11y');
    } catch (_e2) {
      // swallow
    }
  }

  function applyA11ySelection(selection, key) {
    var sel = normalizeA11y(selection);
    var prev = null;
    try {
      prev = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-hfx-a11y')
        : null;
    } catch (_p) {
      prev = null;
    }

    try {
      if (sel) document.documentElement.setAttribute('data-hfx-a11y', sel);
      else document.documentElement.removeAttribute('data-hfx-a11y');
    } catch (_a) { }

    syncA11yToBody();

    try { setStoredA11y(key, sel); } catch (_s) { }

    try { updateA11yAria(sel); } catch (_a11y) { }

    try {
      if (prev !== sel && window && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('hfx:a11ychange', { detail: { selection: sel || 'none' } }));
      }
    } catch (_evt) { }
  }

  function applyInitialA11y(storageKey) {
    try {
      var stored = getStoredA11y(storageKey);
      if (stored) {
        applyA11ySelection(stored, storageKey);
      } else {
        syncA11yToBody();
        updateA11yAria(null);
      }
    } catch (_e) {
      // swallow
    }
  }

  function updateThemeAria(selection) {
    try {
      if (!document || !document.querySelectorAll) return;
      var sel = normalizeTheme(selection);
      if (!sel || sel === 'auto') sel = 'auto';

      var items = document.querySelectorAll('[data-hfx-theme-item]');
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var token = normalizeTheme(el.getAttribute('data-hfx-theme-item')) || 'auto';
        var active = (token === sel);
        try { el.setAttribute('aria-checked', active ? 'true' : 'false'); } catch (_a1) { }
        try {
          if (active) el.setAttribute('aria-current', 'true');
          else el.removeAttribute('aria-current');
        } catch (_a2) { }
      }
    } catch (_e) { }
  }

  function updateA11yAria(selection) {
    try {
      if (!document || !document.querySelectorAll) return;
      var sel = normalizeA11y(selection);
      if (!sel) sel = '';

      var items = document.querySelectorAll('[data-hfx-a11y-item]');
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var token = normalizeA11y(el.getAttribute('data-hfx-a11y-item'));
        if (!token) token = '';
        var active = (token === sel);
        try { el.setAttribute('aria-checked', active ? 'true' : 'false'); } catch (_a1) { }
        try {
          if (active) el.setAttribute('aria-current', 'true');
          else el.removeAttribute('aria-current');
        } catch (_a2) { }
      }

      var toggles = document.querySelectorAll('[data-hfx-a11y-set]');
      for (var t = 0; t < toggles.length; t++) {
        var tel = toggles[t];
        var ttoken = normalizeA11y(tel.getAttribute('data-hfx-a11y-set'));
        if (!ttoken) ttoken = '';
        var tactive = (ttoken === sel);
        try { tel.setAttribute('aria-pressed', tactive ? 'true' : 'false'); } catch (_p) { }
      }
    } catch (_e) { }
  }

  function applyInitialTheme(storageKey) {
    // Apply initial theme early to avoid flashes (especially in ThemeMode.System / Auto).
    // 1) URL ?theme=dark|light|auto overrides
    // 2) Stored preference (dark|light)
    // 3) System preference (auto)
    try {
      var urlTheme = getUrlTheme('theme');
      if (urlTheme) {
        applyResolvedTheme(urlTheme, storageKey);
      } else {
        var stored = getStoredTheme(storageKey);
        applyResolvedTheme(stored || 'auto', storageKey);
      }
    } catch (e) {
      // swallow
    }
  }

  function initDarkMode(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;

      var nodes = root.querySelectorAll('[data-hfx-darkmode-set], [data-hfx-a11y-set], a.hide-theme-dark[href], a.hide-theme-light[href]');
      var links = [];
      var a11yLinks = [];
      var qpLinks = [];
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        if (!node) continue;
        if (node.getAttribute && node.getAttribute('data-hfx-darkmode-set') != null) links.push(node);
        if (node.getAttribute && node.getAttribute('data-hfx-a11y-set') != null) a11yLinks.push(node);
        try {
          if (node.classList && (node.classList.contains('hide-theme-dark') || node.classList.contains('hide-theme-light'))) qpLinks.push(node);
        } catch (_cl) { }
      }

      // Determine storage key (document attribute wins), then first toggle, then 'theme'.
      var storageKey = getDocumentStorageKey();
      if (!storageKey && links && links.length) {
        try { storageKey = links[0].getAttribute('data-hfx-darkmode-key'); } catch (_k1) { storageKey = null; }
      }
      storageKey = storageKey || DEFAULT_STORAGE_KEY;

      // Ensure <body> gets the resolved theme too.
      // When this script runs in <head>, `document.body` may not exist yet, so the early apply only updates <html>.
      // Re-applying here (once body exists) keeps html/body in sync and prevents "mixed theme" states.
      applyInitialTheme(storageKey);

      // Apply persisted accessibility overrides (if any).
      var a11yKey = getDocumentA11yKey();
      if (!a11yKey && a11yLinks && a11yLinks.length) {
        try { a11yKey = a11yLinks[0].getAttribute('data-hfx-a11y-key'); } catch (_ak1) { a11yKey = null; }
      }
      a11yKey = a11yKey || DEFAULT_A11Y_KEY;
      applyInitialA11y(a11yKey);

      for (var i = 0; i < links.length; i++) {
        var el = links[i];
        if (el.__hfx_darkmode_init) continue;
        el.__hfx_darkmode_init = true;

        var key = el.getAttribute('data-hfx-darkmode-key') || storageKey;
        var setTo = normalizeTheme(el.getAttribute('data-hfx-darkmode-set'));
        if (!setTo) continue;

        el.addEventListener('click', function (e) {
          if (e && e.defaultPrevented) return;
          // Allow modifier/middle-clicks to behave like normal links.
          if (e && e.button && e.button !== 0) return;
          if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;

          // QueryParameter mode should actually navigate to ?theme=... for shareable/SSR-friendly links.
          // When href points to a theme query, let the browser update the URL (default Tabler behavior).
          var href = this.getAttribute('href');
          var hrefTheme = getThemeFromHref(href);
          var allowNavigation = !!(hrefTheme && href && href !== '#');
          if (!allowNavigation) e.preventDefault();

          var key2 = this.getAttribute('data-hfx-darkmode-key') || storageKey;
          var setTo2 = normalizeTheme(this.getAttribute('data-hfx-darkmode-set'));
          if (!setTo2) return;
          applyResolvedTheme(setTo2, key2);
        });
      }

      for (var a = 0; a < a11yLinks.length; a++) {
        var ae = a11yLinks[a];
        if (ae.__hfx_a11y_init) continue;
        ae.__hfx_a11y_init = true;

        ae.addEventListener('click', function (e) {
          if (e && e.defaultPrevented) return;
          if (e && e.button && e.button !== 0) return;
          if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;

          if (e) e.preventDefault();

          var key2 = this.getAttribute('data-hfx-a11y-key') || a11yKey;
          var setTo2 = normalizeA11y(this.getAttribute('data-hfx-a11y-set'));
          applyA11ySelection(setTo2, key2);
        });
      }

      // Back-compat: Tabler-style query links (no data attributes) used by some components
      // e.g. <a class="hide-theme-dark" href="?theme=dark">…</a>
      try {
        for (var j = 0; j < qpLinks.length; j++) {
          var qel = qpLinks[j];
          if (qel.__hfx_darkmode_qp_init) continue;
          qel.__hfx_darkmode_qp_init = true;

          qel.addEventListener('click', function (e) {
            if (e && e.defaultPrevented) return;
            if (e && e.button && e.button !== 0) return;
            if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;

            var href = this.getAttribute('href');
            var t = getThemeFromHref(href);
            if (!t) return;
            // If this is a real query link, let the browser update the URL (QueryParameter mode).
            if (!(href && href !== '#')) e.preventDefault();
            applyResolvedTheme(t, storageKey);
          });
        }
      } catch (_qp) { /* swallow */ }

      // Follow system theme when no explicit stored preference exists
      try {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq && mq.addEventListener) {
          mq.addEventListener('change', function (e) {
            var storedNow = getStoredTheme(storageKey);
            if (storedNow) return;
            applyResolvedTheme('auto', storageKey);
          });
        }
      } catch (e3) {
        // swallow
      }
    } catch (e4) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. HTMX or client-side injected fragments)
  window.hfxInitDarkMode = initDarkMode;

  // Apply theme immediately (best-effort) to minimize flashes.
  var earlyStorageKey = getDocumentStorageKey() || DEFAULT_STORAGE_KEY;
  applyInitialTheme(earlyStorageKey);
  var earlyA11yKey = getDocumentA11yKey() || DEFAULT_A11Y_KEY;
  applyInitialA11y(earlyA11yKey);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initDarkMode(document); });
  } else {
    initDarkMode(document);
  }
})();
