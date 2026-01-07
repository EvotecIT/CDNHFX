(function () {
  'use strict';

  function getTheme() {
    try {
      var t = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-bs-theme')
        : null;
      if (t === 'dark' || t === 'light') return t;
    } catch (_e1) { /* ignore */ }

    try {
      var b = document && document.body && document.body.getAttribute
        ? document.body.getAttribute('data-bs-theme')
        : null;
      if (b === 'dark' || b === 'light') return b;
    } catch (_e2) { /* ignore */ }

    return 'light';
  }

  function getA11ySelection() {
    try {
      var v = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-hfx-a11y')
        : null;
      if (!v && document && document.body && document.body.getAttribute) v = document.body.getAttribute('data-hfx-a11y');
      v = v ? String(v).toLowerCase() : '';
      if (!v) return '';
      var hc = v.indexOf('high-contrast') >= 0;
      var cb = v.indexOf('color-blind') >= 0;
      if (hc && cb) return 'high-contrast color-blind';
      if (hc) return 'high-contrast';
      if (cb) return 'color-blind';
      return '';
    } catch (_e) {
      return '';
    }
  }

  function resolveThemeStyle(cfg, mode, followTheme) {
    if (!cfg) return null;
    if (!followTheme) return cfg.style || cfg.styleLight || cfg.styleDark || null;
    if (mode === 'dark') return cfg.styleDark || cfg.style || null;
    return cfg.styleLight || cfg.style || null;
  }

  function resolveA11yStyle(cfg, selection) {
    if (!cfg || !selection) return null;
    if (selection === 'high-contrast color-blind') return cfg.styleA11yCombined || cfg.styleA11yHighContrast || cfg.styleA11yColorBlind || null;
    if (selection === 'high-contrast') return cfg.styleA11yHighContrast || cfg.styleA11yCombined || null;
    if (selection === 'color-blind') return cfg.styleA11yColorBlind || cfg.styleA11yCombined || null;
    return null;
  }

  function resolveEffectiveStyle(cfg, mode, a11ySelection, followTheme) {
    var a11yStyle = resolveA11yStyle(cfg, a11ySelection);
    if (a11yStyle) return a11yStyle;
    return resolveThemeStyle(cfg, mode, followTheme);
  }

  function isInitialized(el) {
    try {
      return el && el.getAttribute && el.getAttribute('data-hfx-mapbox-init') === '1';
    } catch (_e) {
      return false;
    }
  }

  function markInitialized(el) {
    try { if (el && el.setAttribute) el.setAttribute('data-hfx-mapbox-init', '1'); } catch (_e) { /* ignore */ }
  }

  function storeMap(id, map) {
    if (!id || !map) return;
    try {
      window.htmlForgeXMapboxMaps = window.htmlForgeXMapboxMaps || {};
      window.htmlForgeXMapboxMaps[id] = map;
    } catch (_e) { /* ignore */ }
  }

  function storeMeta(id, meta) {
    if (!id || !meta) return;
    try {
      window.htmlForgeXMapboxMeta = window.htmlForgeXMapboxMeta || {};
      window.htmlForgeXMapboxMeta[id] = meta;
    } catch (_e) { /* ignore */ }
  }

  function removeMarkers(meta) {
    try {
      if (!meta || !meta.markerObjects) return;
      for (var i = 0; i < meta.markerObjects.length; i++) {
        try { meta.markerObjects[i].remove(); } catch (_m) { /* ignore */ }
      }
      meta.markerObjects = [];
    } catch (_e) { /* ignore */ }
  }

  function createMarkers(map, markerSpecs) {
    var out = [];
    try {
      var markers = markerSpecs || [];
      for (var i = 0; i < markers.length; i++) {
        var m = markers[i] || {};
        var color = m.color ? String(m.color) : 'var(--tblr-primary)';
        out.push(new mapboxgl.Marker({ color: color }).setLngLat([m.lng, m.lat]).addTo(map));
      }
    } catch (_e) { /* ignore */ }
    return out;
  }

  function applyTheme(meta) {
    if (!meta || !meta.map || (!meta.followTheme && !meta.followA11y)) return;

    var mode = getTheme();
    var a11ySelection = meta.followA11y ? getA11ySelection() : '';
    var nextStyle = resolveEffectiveStyle(meta.cfg, mode, a11ySelection, meta.followTheme);
    if (!nextStyle) return;
    if (meta.currentStyle === nextStyle && meta.currentTheme === mode && meta.currentA11y === a11ySelection) return;

    var map = meta.map;

    // Preserve camera state before setStyle (style swaps reset view in some cases).
    var camera = null;
    try {
      camera = {
        center: (map.getCenter && map.getCenter()) ? map.getCenter() : null,
        zoom: (typeof map.getZoom === 'function') ? map.getZoom() : null,
        bearing: (typeof map.getBearing === 'function') ? map.getBearing() : null,
        pitch: (typeof map.getPitch === 'function') ? map.getPitch() : null
      };
    } catch (_c) { camera = null; }

    // Avoid duplicate markers after style swaps.
    removeMarkers(meta);

    function restore() {
      try {
        if (camera && typeof map.jumpTo === 'function') {
          var opts = {};
          if (camera.center) opts.center = camera.center;
          if (camera.zoom != null) opts.zoom = camera.zoom;
          if (camera.bearing != null) opts.bearing = camera.bearing;
          if (camera.pitch != null) opts.pitch = camera.pitch;
          map.jumpTo(opts);
        }
      } catch (_r) { /* ignore */ }

      try { meta.markerObjects = createMarkers(map, meta.markerSpecs || []); } catch (_m) { /* ignore */ }
    }

    try {
      // style.load fires after a style swap finishes loading.
      if (typeof map.once === 'function') {
        map.once('style.load', restore);
      } else if (typeof map.on === 'function') {
        map.on('style.load', function handler() {
          try { if (typeof map.off === 'function') map.off('style.load', handler); } catch (_off) { /* ignore */ }
          restore();
        });
      }
    } catch (_e) { /* ignore */ }

    try {
      meta.currentStyle = nextStyle;
      meta.currentTheme = mode;
      meta.currentA11y = a11ySelection;
      map.setStyle(nextStyle);
    } catch (_s) {
      // Best-effort restore if setStyle fails (e.g., map not ready yet).
      try { restore(); } catch (_sr) { /* ignore */ }
    }
  }

  function updateAllThemes() {
    try {
      var meta = window && window.htmlForgeXMapboxMeta ? window.htmlForgeXMapboxMeta : null;
      if (!meta) return;
      for (var id in meta) {
        if (!Object.prototype.hasOwnProperty.call(meta, id)) continue;
        applyTheme(meta[id]);
      }
    } catch (_e) { /* ignore */ }
  }

  function ensureThemeListener() {
    try {
      if (window.__hfxMapboxThemeInit) return;
      window.__hfxMapboxThemeInit = true;

      window.addEventListener('hfx:themechange', function () {
        // Defer to allow CSS/layout to settle after <html data-bs-theme> changes.
        try { setTimeout(updateAllThemes, 0); } catch (_t) { updateAllThemes(); }
      });
      window.addEventListener('hfx:a11ychange', function () {
        try { setTimeout(updateAllThemes, 0); } catch (_t2) { updateAllThemes(); }
      });
    } catch (_e) { /* ignore */ }
  }

  function initOne(el, cfg) {
    try {
      if (!el || !cfg) return null;
      if (isInitialized(el)) return null;
      markInitialized(el);

      if (typeof mapboxgl === 'undefined' || !mapboxgl || !mapboxgl.Map) return null;

      var id = (cfg.id != null) ? String(cfg.id) : (el.id ? String(el.id) : '');
      var token = (cfg.accessToken != null) ? String(cfg.accessToken) : '';
      if (!token) return null;

      try { mapboxgl.accessToken = token; } catch (_e) { /* ignore */ }

      var followTheme = !!cfg.followTheme;
      var followA11y = !!cfg.followA11y;
      var style = cfg.style;
      var a11ySelection = followA11y ? getA11ySelection() : '';
      if (followTheme || followA11y) {
        var mode = getTheme();
        var s2 = resolveEffectiveStyle(cfg, mode, a11ySelection, followTheme);
        if (s2) style = s2;
      }

      var map = new mapboxgl.Map({
        container: el,
        style: style,
        center: cfg.center,
        zoom: cfg.zoom
      });

      var markerSpecs = cfg.markers || [];
      var markerObjects = createMarkers(map, markerSpecs);

      function resize() { try { map.resize(); } catch (_e) { } }
      try { window.addEventListener('resize', resize); } catch (_e) { }
      try {
        if (window.ResizeObserver) {
          var ro = new ResizeObserver(function () { resize(); });
          ro.observe(el);
          el.__hfx_mapbox_ro = ro;
        }
      } catch (_e) { }

      storeMap(id, map);
      storeMeta(id, {
        id: id,
        map: map,
        cfg: cfg,
        followTheme: followTheme,
        followA11y: followA11y,
        currentStyle: style || null,
        currentTheme: getTheme(),
        currentA11y: a11ySelection,
        markerSpecs: markerSpecs,
        markerObjects: markerObjects
      });

      ensureThemeListener();
      return map;
    } catch (_e) {
      return null;
    }
  }

  function init(elOrSelector, cfg) {
    var el = elOrSelector;
    try { if (typeof elOrSelector === 'string') el = document.querySelector(elOrSelector); } catch (_e) { /* ignore */ }
    return initOne(el, cfg || {});
  }

  function initById(id, cfg) {
    var mapId = (id == null) ? '' : String(id);
    var config = cfg || {};
    if (!config.id) config.id = mapId;

    function boot() {
      var el = null;
      try { el = document.getElementById(mapId); } catch (_e) { el = null; }
      return initOne(el, config);
    }

    var lazy = !!config.lazyInit;
    if (lazy && window.htmlForgeXWhenVisible) {
      try {
        window.htmlForgeXWhenVisible('#' + mapId, function (el) { initOne(el, config); });
        return null;
      } catch (_w) { /* fallthrough */ }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
      return null;
    }

    return boot();
  }

  window.hfxMapbox = window.hfxMapbox || {};
  window.hfxMapbox.init = init;
  window.hfxMapbox.initById = initById;
})();
