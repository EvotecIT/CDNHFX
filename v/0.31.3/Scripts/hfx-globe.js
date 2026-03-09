(function () {
  'use strict';

  function parseJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_e) { return null; }
  }

  function getTheme() {
    try {
      var t = null;
      try {
        t = document && document.documentElement && document.documentElement.getAttribute
          ? document.documentElement.getAttribute('data-bs-theme')
          : null;
      } catch (_e1) { t = null; }
      if (!t) {
        try {
          t = document && document.body && document.body.getAttribute
            ? document.body.getAttribute('data-bs-theme')
            : null;
        } catch (_e2) { t = null; }
      }
      t = String(t || '').toLowerCase();
      return t === 'dark' ? 'dark' : 'light';
    } catch (_e) {
      return 'light';
    }
  }

  function getCssVar(name) {
    try {
      if (!name) return '';
      var s = String(name || '').trim();
      if (!s) return '';
      if (!window.getComputedStyle) return '';
      var cs = window.getComputedStyle(document.documentElement);
      var v = (cs && cs.getPropertyValue) ? String(cs.getPropertyValue(s) || '') : '';
      if ((!v || !String(v).trim()) && document && document.body) {
        try {
          var cs2 = window.getComputedStyle(document.body);
          v = (cs2 && cs2.getPropertyValue) ? String(cs2.getPropertyValue(s) || '') : v;
        } catch (_e2) { /* swallow */ }
      }
      return String(v || '').trim();
    } catch (_e) {
      return '';
    }
  }

  function resolveCssVar(value) {
    try {
      if (value == null) return value;
      var s = String(value || '').trim();
      if (!s) return s;
      if (s.indexOf('var(') !== 0) return s;

      var inner = s.substring(4, s.length - 1);
      var parts = inner.split(',');
      var name = String(parts[0] || '').trim();
      var fallback = parts.length > 1 ? String(parts.slice(1).join(',') || '').trim() : '';
      var v = name ? getCssVar(name) : '';
      return v || fallback || s;
    } catch (_e) {
      return value;
    }
  }

  function safeNumber(v, def) {
    return typeof v === 'number' && !isNaN(v) ? v : def;
  }

  function escapeRegex(text) {
    try {
      return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (_e) {
      return '';
    }
  }

  function resolveTableId(tableElOrId) {
    try {
      if (!tableElOrId) return '';
      if (typeof tableElOrId === 'string') {
        var s = String(tableElOrId);
        if (s.charAt(0) === '#') s = s.substring(1);
        return s;
      }
      if (tableElOrId.nodeType === 1) return tableElOrId.id || '';
      return '';
    } catch (_e) {
      return '';
    }
  }

  function findHeaderIndex(idxMap, keyColumnHeader) {
    try {
      if (!idxMap) return null;
      if (typeof idxMap[keyColumnHeader] === 'number') return idxMap[keyColumnHeader];
      var target = String(keyColumnHeader || '').toLowerCase();
      for (var k in idxMap) {
        if (!Object.prototype.hasOwnProperty.call(idxMap, k)) continue;
        if (String(k).toLowerCase() === target && typeof idxMap[k] === 'number') return idxMap[k];
      }
      return null;
    } catch (_e) {
      return null;
    }
  }

  function filterDataTablesByMarkerKey(tableIdOrElOrId, keyColumnHeader, key, opts) {
    try {
      var $ = window.jQuery || window.$;
      if (!$ || !$.fn || !$.fn.DataTable) return false;

      var tableId = resolveTableId(tableIdOrElOrId);
      if (!tableId) return false;

      var sel = '#' + tableId;
      if (!$.fn.DataTable.isDataTable || !$.fn.DataTable.isDataTable(sel)) return false;
      var api = $(sel).DataTable();
      if (!api) return false;

      var idxMap = null;
      try {
        if (window.hfxDtShared && hfxDtShared.headerIndexMap) idxMap = hfxDtShared.headerIndexMap(sel);
      } catch (_m0) { idxMap = null; }
      if (!idxMap) {
        idxMap = {};
        try {
          $(sel).find('thead th').each(function (i) {
            try {
              var t = ($(this).text() || '').trim();
              if (t) idxMap[t] = i;
            } catch (_ht) { /* swallow */ }
          });
        } catch (_m1) { /* swallow */ }
      }

      var keyIdx = findHeaderIndex(idxMap, keyColumnHeader);
      if (typeof keyIdx !== 'number') return false;

      var exact = !(opts && opts.exact === false);
      var resetGlobalSearch = !!(opts && opts.resetGlobalSearch === true);
      var resetColumnSearches = !!(opts && opts.resetColumnSearches === true);
      var scrollToRow = !(opts && opts.scrollToRow === false);
      var highlightRow = !(opts && opts.highlightRow === false);
      var highlightMs = (opts && typeof opts.highlightMs === 'number') ? opts.highlightMs : 1200;
      var persistSelection = !!(opts && opts.persistSelection === true);

      if (resetGlobalSearch) { try { api.search(''); } catch (_sg) { /* swallow */ } }
      if (resetColumnSearches) { try { api.columns().search(''); } catch (_sc) { /* swallow */ } }

      var keys = null;
      try {
        if (Array.isArray(key)) {
          keys = [];
          for (var ki = 0; ki < key.length; ki++) {
            var s0 = (key[ki] == null) ? '' : String(key[ki]);
            s0 = s0.trim();
            if (s0) keys.push(s0);
          }
        }
      } catch (_ka) { keys = null; }
      if (!keys || !keys.length) keys = [String(key || '').trim()];
      if (!keys[0]) return false;

      var val = String(keys[0] || '');
      var term = exact ? ('^' + escapeRegex(val) + '$') : val;
      var useRegex = exact;
      var useSmart = !exact;

      if (keys.length > 1) {
        var escKeys = [];
        for (var ek = 0; ek < keys.length; ek++) {
          try { escKeys.push(escapeRegex(String(keys[ek] || ''))); } catch (_ex) { /* swallow */ }
        }
        if (escKeys.length) {
          if (exact) term = '^(?:' + escKeys.join('|') + ')$';
          else term = '(?:' + escKeys.join('|') + ')';
          useRegex = true;
          useSmart = false;
        }
      }

      if (persistSelection) {
        try {
          $(sel).attr('data-hfx-geo-selected-header', String(keyColumnHeader || ''));
          $(sel).attr('data-hfx-geo-selected-key', val);
        } catch (_ps) { /* swallow */ }

        try {
          var tEl = $(sel).get(0);
          if (tEl && !tEl.__hfx_geo_persist_bound) {
            tEl.__hfx_geo_persist_bound = true;
            $(sel).on('draw.dt.hfxGeoPersist', function () {
              try {
                var hdr = ($(sel).attr('data-hfx-geo-selected-header') || '').trim();
                var skey = ($(sel).attr('data-hfx-geo-selected-key') || '').trim();
                if (!hdr || !skey) return;

                var im = null;
                try { if (window.hfxDtShared && hfxDtShared.headerIndexMap) im = hfxDtShared.headerIndexMap(sel); } catch (_m0) { im = null; }
                if (!im) {
                  im = {};
                  try {
                    $(sel).find('thead th').each(function (i) {
                      try { var t = ($(this).text() || '').trim(); if (t) im[t] = i; } catch (_ht) { /* swallow */ }
                    });
                  } catch (_m1) { /* swallow */ }
                }

                var kIdx = findHeaderIndex(im, hdr);
                if (typeof kIdx !== 'number') return;

                var nodes = null;
                try { nodes = api.rows({ filter: 'applied' }).nodes(); } catch (_rn) { try { nodes = api.rows().nodes(); } catch (_rn2) { nodes = null; } }
                if (!nodes || !nodes.length) return;

                try { $(sel).find('tbody tr.table-active').removeClass('table-active'); } catch (_rh) { /* swallow */ }

                for (var ni = 0; ni < nodes.length; ni++) {
                  var row = nodes[ni];
                  if (!row) continue;
                  var $tr = $(row);
                  if ($tr.hasClass('child')) $tr = $tr.prev();
                  var $td = $tr.find('td').eq(kIdx);
                  var v0 = ($td.attr('data-raw') || $td.text() || '').trim();
                  if (String(v0) === String(skey)) {
                    try { $tr.addClass('table-active'); } catch (_ha) { /* swallow */ }
                    break;
                  }
                }
              } catch (_e0) { /* swallow */ }
            });
          }
        } catch (_pb) { /* swallow */ }
      }

      if (scrollToRow || highlightRow) {
        try {
          $(sel).one('draw.dt.hfxGeoFrom', function () {
            try {
              var nodes = api.rows({ filter: 'applied' }).nodes();
              if (!nodes || !nodes.length) return;
              var row = nodes[0];

              if (highlightRow) {
                try { $(sel).find('tbody tr.table-active').removeClass('table-active'); } catch (_rh) { /* swallow */ }
                try { $(row).addClass('table-active'); } catch (_rh2) { /* swallow */ }
                if (!persistSelection && highlightMs > 0) {
                  try {
                    setTimeout(function () { try { $(row).removeClass('table-active'); } catch (_rr) { /* swallow */ } }, highlightMs);
                  } catch (_rt) { /* swallow */ }
                }
              }

              if (scrollToRow && row && row.scrollIntoView) {
                try { row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
                catch (_sv) { try { row.scrollIntoView(true); } catch (_sv2) { /* swallow */ } }
              }
            } catch (_dr) { /* swallow */ }
          });
        } catch (_on) { /* swallow */ }
      }

      try {
        api.column(keyIdx).search(term, useRegex, useSmart).draw();
        return true;
      } catch (_sr) {
        try { api.column(keyIdx).search(val).draw(); return true; } catch (_sr2) { /* swallow */ }
      }

      return false;
    } catch (_e) {
      return false;
    }
  }

  function clearDataTablesMarkerFilter(tableIdOrElOrId, keyColumnHeader, opts) {
    try {
      var $ = window.jQuery || window.$;
      if (!$ || !$.fn || !$.fn.DataTable) return false;

      var tableId = resolveTableId(tableIdOrElOrId);
      if (!tableId) return false;

      var sel = '#' + tableId;
      if (!$.fn.DataTable.isDataTable || !$.fn.DataTable.isDataTable(sel)) return false;
      var api = $(sel).DataTable();
      if (!api) return false;

      var idxMap = null;
      try {
        if (window.hfxDtShared && hfxDtShared.headerIndexMap) idxMap = hfxDtShared.headerIndexMap(sel);
      } catch (_m0) { idxMap = null; }
      if (!idxMap) {
        idxMap = {};
        try {
          $(sel).find('thead th').each(function (i) {
            try {
              var t = ($(this).text() || '').trim();
              if (t) idxMap[t] = i;
            } catch (_ht) { /* swallow */ }
          });
        } catch (_m1) { /* swallow */ }
      }

      var keyIdx = findHeaderIndex(idxMap, keyColumnHeader);
      if (typeof keyIdx !== 'number') return false;

      var resetGlobalSearch = !!(opts && opts.resetGlobalSearch === true);
      var resetColumnSearches = !!(opts && opts.resetColumnSearches === true);

      if (resetGlobalSearch) { try { api.search(''); } catch (_sg) { /* swallow */ } }

      if (resetColumnSearches) {
        try { api.columns().search(''); } catch (_sc) { /* swallow */ }
      } else {
        try { api.column(keyIdx).search(''); } catch (_sc2) { /* swallow */ }
      }

      try { $(sel).find('tbody tr.table-active').removeClass('table-active'); } catch (_rh) { /* swallow */ }
      try { $(sel).removeAttr('data-hfx-geo-selected-header').removeAttr('data-hfx-geo-selected-key'); } catch (_ps) { /* swallow */ }

      try { api.draw(); return true; } catch (_dr) { /* swallow */ }
      return false;
    } catch (_e) {
      return false;
    }
  }

  function handleMarkerClick(globeEl, markerKey) {
    try {
      var binds = globeEl.__hfx_globe_marker_click_bindings || [];
      if (!binds || !binds.length) return;
      for (var i = 0; i < binds.length; i++) {
        var b = binds[i] || {};
        if (!b.tableId || !b.keyColumnHeader) continue;
        filterDataTablesByMarkerKey(b.tableId, b.keyColumnHeader, markerKey, b.opts || null);
      }
    } catch (_e) { /* swallow */ }
  }

  function clearMarkerClickBindings(globeEl) {
    try {
      var binds = globeEl.__hfx_globe_marker_click_bindings || [];
      if (!binds || !binds.length) return false;
      var ok = false;
      for (var i = 0; i < binds.length; i++) {
        var b = binds[i] || {};
        if (!b.tableId || !b.keyColumnHeader) continue;
        if (clearDataTablesMarkerFilter(b.tableId, b.keyColumnHeader, b.opts || null)) ok = true;
      }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  function bindMarkerClicksToDataTables(globeElOrId, tableElOrId, keyColumnHeader, opts) {
    try {
      var el = resolveElement(globeElOrId);
      if (!el) return false;

      var tableId = resolveTableId(tableElOrId);
      if (!tableId) return false;

      var header = String(keyColumnHeader || '');
      if (!header) return false;

      try { if (!el.__hfx_globe_marker_click_bindings) el.__hfx_globe_marker_click_bindings = []; } catch (_b0) { /* swallow */ }
      try { el.__hfx_globe_marker_click_bindings.push({ tableId: tableId, keyColumnHeader: header, opts: opts || null }); } catch (_b1) { /* swallow */ }

      // Ensure initialized so markers get rendered and become clickable.
      if (!el.__hfx_globe) initOne(el);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function initOne(el) {
    try {
      if (!el || el.__hfx_globe_init) return;
      el.__hfx_globe_init = true;

      var Globe = window.Globe;
      if (!Globe) {
        // Allow retry if the library is loaded later.
        el.__hfx_globe_init = false;
        return;
      }

      var cfg = parseJson(el.getAttribute('data-hfx-globe-config')) || {};
      var height = cfg.height;
      if (height) {
        try { el.style.height = String(height); } catch (_h) { /* swallow */ }
      }

      // Create globe instance
      var globe = Globe()(el);
      el.__hfx_globe = globe;
      try { setupGeoSelectionSync(el); } catch (_gs) { /* swallow */ }

      // Performance preset (renderer pixel ratio cap)
      try {
        var preset = safeNumber(cfg.performancePreset, 0);
        if (preset && typeof globe.renderer === 'function') {
          var renderer = null;
          try { renderer = globe.renderer(); } catch (_rr) { renderer = null; }
          if (renderer && typeof renderer.setPixelRatio === 'function') {
            var dpr = safeNumber(window.devicePixelRatio, 1);
            var cap = null;
            if (preset === 1) cap = 1.5;       // Balanced
            else if (preset === 2) cap = 1.0;  // LowPower
            else if (preset === 3) cap = 2.0;  // HighQuality
            if (cap != null) {
              try { renderer.setPixelRatio(Math.min(cap, dpr)); } catch (_spr) { /* swallow */ }
            }
          }
        }
      } catch (_pp) { /* swallow */ }

      // Basic look
      if (typeof globe.showNavInfo === 'function') {
        try { globe.showNavInfo(false); } catch (_n) { /* swallow */ }
      }
      if (cfg.backgroundColor != null && typeof globe.backgroundColor === 'function') {
        try { globe.backgroundColor(resolveCssVar(cfg.backgroundColor)); } catch (_b) { /* swallow */ }
      }

      // Theme-aware texture + theme-derived colors
      var lightUrl = String(cfg.textureLight || '');
      var darkUrl = String(cfg.textureDark || lightUrl || '');
      var lastTheme = null;

      function applyTheme() {
        try {
          if (!lightUrl && !darkUrl) return;
          var theme = getTheme();
          if (theme === lastTheme) return;
          lastTheme = theme;
          var url = theme === 'dark' ? (darkUrl || lightUrl) : (lightUrl || darkUrl);
          if (url && typeof globe.globeImageUrl === 'function') globe.globeImageUrl(url);

          // Re-apply any theme-derived colors on theme changes (CSS vars -> resolved values).
          try { applyThemeColors(); } catch (_tc) { /* swallow */ }
        } catch (_t) { /* swallow */ }
      }

      // Apply theme once after we have a globe instance.
      applyTheme();

      // Atmosphere
      var disableAtmosphere = cfg.disableAtmosphere === true;
      if (typeof globe.showAtmosphere === 'function') {
        try { globe.showAtmosphere(!disableAtmosphere); } catch (_a0) { /* swallow */ }
      }
      if (!disableAtmosphere) {
        if (cfg.atmosphereColor && typeof globe.atmosphereColor === 'function') {
          try { globe.atmosphereColor(resolveCssVar(cfg.atmosphereColor)); } catch (_a1) { /* swallow */ }
        }
        if (typeof cfg.atmosphereAltitude === 'number' && typeof globe.atmosphereAltitude === 'function') {
          try { globe.atmosphereAltitude(cfg.atmosphereAltitude); } catch (_a2) { /* swallow */ }
        }
      }

      // Markers via HTML overlays
      var markers = Array.isArray(cfg.markers) ? cfg.markers : [];
      if (markers.length && typeof globe.htmlElementsData === 'function') {
        try { globe.htmlElementsData(markers); } catch (_d0) { /* swallow */ }
        if (typeof globe.htmlLat === 'function') globe.htmlLat(function (d) { return d && typeof d.lat === 'number' ? d.lat : 0; });
        if (typeof globe.htmlLng === 'function') globe.htmlLng(function (d) { return d && typeof d.lng === 'number' ? d.lng : 0; });
        if (typeof globe.htmlAltitude === 'function') globe.htmlAltitude(function (_d) { return 0.01; });
        if (typeof globe.htmlElement === 'function') {
          globe.htmlElement(function (d) {
            var result = null;
            try {
              if (d && d.templateId) {
                var tpl = document.getElementById(String(d.templateId));
                if (tpl && tpl.content) {
                  var frag = tpl.content.cloneNode(true);
                  var host = document.createElement('div');
                  host.appendChild(frag);
                  var first = host.firstElementChild;
                  if (first) result = first;
                }
              }

              if (!result) {
                var wrap = document.createElement('div');
                wrap.className = 'hfx-globe-marker';
                if (d && d.color) {
                  try { wrap.style.setProperty('--hfx-globe-marker-color', String(d.color)); } catch (_c) { /* swallow */ }
                }

                var dot = document.createElement('span');
                dot.className = 'hfx-globe-dot';
                wrap.appendChild(dot);

                var label = (d && d.label) ? String(d.label) : '';
                if (label) {
                  var text = document.createElement('span');
                  text.className = 'hfx-globe-label';
                  text.textContent = label;
                  wrap.appendChild(text);
                }

                result = wrap;
              }
            } catch (_e2) {
              var fallback = document.createElement('span');
              fallback.textContent = '';
              result = fallback;
            }

            // Optional: marker click -> DataTables filter (binders stored on globe element).
            try {
              var k = (d && d.key) ? String(d.key) : '';
              if (k && result && result.addEventListener) {
                try { result.setAttribute('data-hfx-globe-marker-key', k); } catch (_a) { /* swallow */ }
                try { result.style.cursor = 'pointer'; } catch (_cur) { /* swallow */ }
                try {
                  if (!el.__hfx_globe_marker_el_by_key) el.__hfx_globe_marker_el_by_key = {};
                  el.__hfx_globe_marker_el_by_key[k] = result;
                } catch (_rk) { /* swallow */ }
                result.addEventListener('click', function (evt) {
                  try { if (evt && evt.preventDefault) evt.preventDefault(); } catch (_pd) { /* swallow */ }
                  try { if (evt && evt.stopPropagation) evt.stopPropagation(); } catch (_sp) { /* swallow */ }
                  try { if (evt && evt.stopImmediatePropagation) evt.stopImmediatePropagation(); } catch (_sip) { /* swallow */ }

                  // Toggle: clicking the currently selected marker clears selection + filters.
                  try {
                    var isSelected = false;
                    try {
                      var arr = el.__hfx_globe_selected_keys || null;
                      if (arr && arr.length) {
                        for (var ai = 0; ai < arr.length; ai++) {
                          if (String(arr[ai] || '') === String(k)) { isSelected = true; break; }
                        }
                      } else {
                        var current = el.__hfx_globe_selected_key != null ? String(el.__hfx_globe_selected_key) : '';
                        if (current && current === String(k)) isSelected = true;
                      }
                    } catch (_sk) { isSelected = false; }

                    if (isSelected) {
                      try { clearGlobeSelection(el); } catch (_csel) { /* swallow */ }
                      clearMarkerClickBindings(el);
                      try { geoEmitClear(el, { sourceType: 'globe', sourceId: (el && el.id) ? String(el.id) : '' }); } catch (_gc) { /* swallow */ }
                      return;
                    }
                  } catch (_tg) { /* swallow */ }

                  try { setSelectedGlobeMarker(el, k); } catch (_sel0) { /* swallow */ }
                  handleMarkerClick(el, k);
                  try { geoEmitSelect(el, 'marker', String(k || ''), { sourceType: 'globe', sourceId: (el && el.id) ? String(el.id) : '', affectsTables: true }); } catch (_gs) { /* swallow */ }
                });
              }
            } catch (_cl) { /* swallow */ }

            return result;
          });
        }

        // Optional: marker registry for cross-component linking.
        try {
          var dict = {};
          for (var mi = 0; mi < markers.length; mi++) {
            var mk = markers[mi] || {};
            if (mk.key) dict[String(mk.key)] = mk;
          }
          el.__hfx_globe_marker_by_key = dict;
        } catch (_mk) { /* swallow */ }
      }

      // Background click clears selection + bound DataTables filters.
      try {
        if (!el.__hfx_globe_clear_bind) {
          el.__hfx_globe_clear_bind = true;

          var down = null;
          var threshold = 6;
          var maxMs = 700;

          function isMarkerTarget(target) {
            try {
              var n = target;
              while (n && n !== el) {
                if (n.nodeType !== 1) { n = n.parentNode; continue; }
                if (n.getAttribute && n.getAttribute('data-hfx-globe-marker-key')) return true;
                n = n.parentNode;
              }
              return false;
            } catch (_t) { return false; }
          }

          function onDown(e) {
            try {
              // Only primary button for mouse/pointer.
              if (e && typeof e.button === 'number' && e.button !== 0) return;
              down = { x: e && e.clientX ? e.clientX : 0, y: e && e.clientY ? e.clientY : 0, t: Date.now(), target: e ? e.target : null };
            } catch (_d) { down = null; }
          }

          function onUp(e) {
            try {
              if (!down) return;
              var dx = Math.abs((e && e.clientX ? e.clientX : 0) - down.x);
              var dy = Math.abs((e && e.clientY ? e.clientY : 0) - down.y);
              var dt = Date.now() - (down.t || 0);
              var target = e ? e.target : null;
              down = null;

              if (dx > threshold || dy > threshold) return; // drag
              if (dt > maxMs) return;
              if (isMarkerTarget(target)) return;

              var hasSelection = !!(el.__hfx_globe_selected_key && String(el.__hfx_globe_selected_key));
              if (!hasSelection) return;

              try { clearGlobeSelection(el); } catch (_c0) { /* swallow */ }
              clearMarkerClickBindings(el);
              try { geoEmitClear(el, { sourceType: 'globe', sourceId: (el && el.id) ? String(el.id) : '' }); } catch (_gc) { /* swallow */ }
            } catch (_u) { down = null; }
          }

          if (window.PointerEvent) {
            el.addEventListener('pointerdown', onDown);
            el.addEventListener('pointerup', onUp);
          } else {
            el.addEventListener('mousedown', onDown);
            el.addEventListener('mouseup', onUp);
            // touch fallback
            el.addEventListener('touchstart', function (e) {
              try {
                var t = e && e.touches && e.touches.length ? e.touches[0] : null;
                down = { x: t && t.clientX ? t.clientX : 0, y: t && t.clientY ? t.clientY : 0, t: Date.now(), target: e ? e.target : null };
              } catch (_ts) { down = null; }
            });
            el.addEventListener('touchend', function (e) {
              try {
                var t = e && e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : null;
                onUp({ clientX: t && t.clientX ? t.clientX : 0, clientY: t && t.clientY ? t.clientY : 0, target: e ? e.target : null });
              } catch (_te) { down = null; }
            });
          }
        }
      } catch (_bg) { /* swallow */ }

      function applyThemeColors() {
        try {
          var primary = resolveCssVar('var(--tblr-primary, #066fd1)');
          var body = resolveCssVar('var(--tblr-body-color, #1f2937)');

          // Background color may be CSS-var driven.
          if (cfg.backgroundColor != null && typeof globe.backgroundColor === 'function') {
            try { globe.backgroundColor(resolveCssVar(cfg.backgroundColor)); } catch (_bg2) { /* swallow */ }
          }

          // Atmosphere color may be CSS-var driven.
          if (!disableAtmosphere && cfg.atmosphereColor && typeof globe.atmosphereColor === 'function') {
            try { globe.atmosphereColor(resolveCssVar(cfg.atmosphereColor)); } catch (_ac2) { /* swallow */ }
          }

          if (arcs.length && typeof globe.arcColor === 'function') {
            globe.arcColor(function (d) {
              try {
                if (d && d.color) return resolveCssVar(d.color);
                return primary;
              } catch (_c) { return primary; }
            });
          }

          if (labels.length && typeof globe.labelColor === 'function') {
            globe.labelColor(function (d) {
              try {
                if (d && d.color) return resolveCssVar(d.color);
                return body;
              } catch (_c) { return body; }
            });
          }

          if (rings.length && typeof globe.ringColor === 'function') {
            globe.ringColor(function (d) {
              try {
                if (d && d.color) return resolveCssVar(d.color);
                return primary;
              } catch (_c) { return primary; }
            });
          }
        } catch (_e) { /* swallow */ }
      }

      // Arcs
      var arcs = Array.isArray(cfg.arcs) ? cfg.arcs : [];
      if (arcs.length && typeof globe.arcsData === 'function') {
        try { globe.arcsData(arcs); } catch (_ad) { /* swallow */ }
        if (typeof globe.arcStartLat === 'function') globe.arcStartLat(function (d) { return d && typeof d.startLat === 'number' ? d.startLat : 0; });
        if (typeof globe.arcStartLng === 'function') globe.arcStartLng(function (d) { return d && typeof d.startLng === 'number' ? d.startLng : 0; });
        if (typeof globe.arcEndLat === 'function') globe.arcEndLat(function (d) { return d && typeof d.endLat === 'number' ? d.endLat : 0; });
        if (typeof globe.arcEndLng === 'function') globe.arcEndLng(function (d) { return d && typeof d.endLng === 'number' ? d.endLng : 0; });
        if (typeof globe.arcStroke === 'function') globe.arcStroke(function (d) { return safeNumber(d && d.stroke, 0.6); });
        if (typeof globe.arcAltitude === 'function') globe.arcAltitude(function (d) { return safeNumber(d && d.altitude, 0.2); });
        if (typeof globe.arcLabel === 'function') globe.arcLabel(function (d) { return d && d.label ? String(d.label) : ''; });

        // Optional dashed arcs
        var hasDash = false;
        for (var ai = 0; ai < arcs.length; ai++) {
          var a = arcs[ai] || {};
          if (typeof a.dashLength === 'number' || typeof a.dashGap === 'number' || typeof a.dashAnimateTime === 'number' || typeof a.dashInitialGap === 'number') {
            hasDash = true;
            break;
          }
        }
        if (hasDash) {
          if (typeof globe.arcDashLength === 'function') globe.arcDashLength(function (d) { return safeNumber(d && d.dashLength, 0.4); });
          if (typeof globe.arcDashGap === 'function') globe.arcDashGap(function (d) { return safeNumber(d && d.dashGap, 0.2); });
          if (typeof globe.arcDashInitialGap === 'function') globe.arcDashInitialGap(function (d) { return safeNumber(d && d.dashInitialGap, 0); });
          if (typeof globe.arcDashAnimateTime === 'function') globe.arcDashAnimateTime(function (d) { return safeNumber(d && d.dashAnimateTime, 4000); });
        }
      }

      // Labels
      var labels = Array.isArray(cfg.labels) ? cfg.labels : [];
      if (labels.length && typeof globe.labelsData === 'function') {
        try { globe.labelsData(labels); } catch (_ld) { /* swallow */ }
        if (typeof globe.labelLat === 'function') globe.labelLat(function (d) { return d && typeof d.lat === 'number' ? d.lat : 0; });
        if (typeof globe.labelLng === 'function') globe.labelLng(function (d) { return d && typeof d.lng === 'number' ? d.lng : 0; });
        if (typeof globe.labelText === 'function') globe.labelText(function (d) { return d && d.text ? String(d.text) : ''; });
        if (typeof globe.labelAltitude === 'function') globe.labelAltitude(function (d) { return safeNumber(d && d.altitude, 0.01); });
        if (typeof globe.labelSize === 'function') globe.labelSize(function (d) { return safeNumber(d && d.size, 0.7); });
        if (typeof globe.labelIncludeDot === 'function') globe.labelIncludeDot(function (d) { return d && d.includeDot === true; });
        if (typeof globe.labelDotRadius === 'function') globe.labelDotRadius(function (d) { return safeNumber(d && d.dotRadius, 0.2); });
      }

      // Heatmap
      var heatmap = cfg.heatmap || null;
      var heatPts = heatmap && Array.isArray(heatmap.points) ? heatmap.points : [];
      if (heatPts.length && typeof globe.heatmapsData === 'function') {
        try { globe.heatmapsData(heatPts); } catch (_hd) { /* swallow */ }
        if (typeof globe.heatmapPointLat === 'function') globe.heatmapPointLat(function (d) { return d && typeof d.lat === 'number' ? d.lat : 0; });
        if (typeof globe.heatmapPointLng === 'function') globe.heatmapPointLng(function (d) { return d && typeof d.lng === 'number' ? d.lng : 0; });
        if (typeof globe.heatmapPointWeight === 'function') globe.heatmapPointWeight(function (d) { return safeNumber(d && d.weight, 1); });
        if (typeof heatmap.bandwidth === 'number' && typeof globe.heatmapBandwidth === 'function') { try { globe.heatmapBandwidth(heatmap.bandwidth); } catch (_hbw) { } }
        if (typeof heatmap.colorSaturation === 'number' && typeof globe.heatmapColorSaturation === 'function') { try { globe.heatmapColorSaturation(heatmap.colorSaturation); } catch (_hcs) { } }
        if (typeof heatmap.baseAltitude === 'number' && typeof globe.heatmapBaseAltitude === 'function') { try { globe.heatmapBaseAltitude(heatmap.baseAltitude); } catch (_hba) { } }
        if (typeof heatmap.topAltitude === 'number' && typeof globe.heatmapTopAltitude === 'function') { try { globe.heatmapTopAltitude(heatmap.topAltitude); } catch (_hta) { } }
      }

      // Rings / pulses
      var rings = Array.isArray(cfg.rings) ? cfg.rings : [];
      if (rings.length && typeof globe.ringsData === 'function') {
        try { globe.ringsData(rings); } catch (_rg0) { /* swallow */ }
        if (typeof globe.ringLat === 'function') globe.ringLat(function (d) { return d && typeof d.lat === 'number' ? d.lat : 0; });
        if (typeof globe.ringLng === 'function') globe.ringLng(function (d) { return d && typeof d.lng === 'number' ? d.lng : 0; });
        if (typeof globe.ringAltitude === 'function') globe.ringAltitude(function (d) { return safeNumber(d && d.altitude, 0.01); });
        if (typeof globe.ringMaxRadius === 'function') globe.ringMaxRadius(function (d) { return safeNumber(d && d.maxRadius, 2); });
        if (typeof globe.ringPropagationSpeed === 'function') globe.ringPropagationSpeed(function (d) { return safeNumber(d && d.propagationSpeed, 1); });
        if (typeof globe.ringRepeatPeriod === 'function') globe.ringRepeatPeriod(function (d) { return safeNumber(d && d.repeatPeriod, 2000); });
      }

      // Apply CSS-var derived colors after data layers are configured.
      try { applyThemeColors(); } catch (_atc) { /* swallow */ }

      // Controls
      var controls = null;
      try { controls = (typeof globe.controls === 'function') ? globe.controls() : null; } catch (_c0) { controls = null; }
      if (controls) {
        try {
          controls.enableZoom = cfg.enableZoom === true;
          // GlobeGL already disables pan; keep it that way for dashboards.
          if (typeof controls.enablePan !== 'undefined') controls.enablePan = false;

          var autoRotate = cfg.autoRotate === true;
          if (typeof controls.autoRotate !== 'undefined') controls.autoRotate = autoRotate;
          if (autoRotate && typeof controls.autoRotateSpeed !== 'undefined') {
            controls.autoRotateSpeed = safeNumber(cfg.autoRotateSpeed, 0.35);
          }
        } catch (_c1) { /* swallow */ }
      }

      // Sizing / responsiveness
      function resize() {
        try {
          if (!el.isConnected) return;
          var w = el.clientWidth || el.offsetWidth || 0;
          var h = el.clientHeight || el.offsetHeight || 0;
          if (w <= 0 || h <= 0) return;
          if (typeof globe.width === 'function') globe.width(w);
          if (typeof globe.height === 'function') globe.height(h);
        } catch (_r) { /* swallow */ }
      }

      try { setTimeout(resize, 0); } catch (_s) { /* swallow */ }

      if (window.ResizeObserver) {
        try {
          var ro = new ResizeObserver(function () { resize(); });
          ro.observe(el);
          el.__hfx_globe_ro = ro;
        } catch (_ro) { /* swallow */ }
      } else {
        window.addEventListener('resize', resize);
      }

      // React to theme changes (data-bs-theme + Tabler theme engine attributes)
      try {
        if (window.MutationObserver) {
          var mo = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
              var m = muts[i];
              if (!m || m.type !== 'attributes') continue;
              var name = m.attributeName;
              if (name === 'data-bs-theme' || name === 'data-bs-theme-base' || name === 'data-bs-theme-primary' || name === 'data-bs-theme-radius' || name === 'data-bs-theme-font') {
                try { applyTheme(); } catch (_t1) { /* swallow */ }
                try { applyThemeColors(); } catch (_t2) { /* swallow */ }
                break;
              }
            }
          });
          mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme', 'data-bs-theme-base', 'data-bs-theme-primary', 'data-bs-theme-radius', 'data-bs-theme-font'] });
          try { if (document && document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['data-bs-theme', 'data-bs-theme-base', 'data-bs-theme-primary', 'data-bs-theme-radius', 'data-bs-theme-font'] }); } catch (_ob) { /* swallow */ }
          el.__hfx_globe_mo = mo;
        }
      } catch (_moe) { /* swallow */ }

    } catch (_e) {
      try { el.__hfx_globe_init = false; } catch (_e2) { /* swallow */ }
    }
  }

  function init(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;

      var els = root.querySelectorAll('[data-hfx-globe="1"]');
      if (!els || !els.length) return;

      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.__hfx_globe_init) continue;

        if (window.htmlForgeXWhenVisible) {
          try {
            window.htmlForgeXWhenVisible(el, function (node) { initOne(node); });
            continue;
          } catch (_wv) { /* fall back */ }
        }

        initOne(el);
      }
    } catch (_e) { /* swallow */ }
  }

  function resolveElement(elOrId) {
    try {
      if (!elOrId) return null;
      if (typeof elOrId === 'string') return document.getElementById(elOrId);
      if (elOrId.nodeType === 1) return elOrId;
      return null;
    } catch (_e) { return null; }
  }

  function geoGroupId(el) {
    try {
      if (!el || !el.getAttribute) return '';
      return String(el.getAttribute('data-hfx-geo-group') || '');
    } catch (_e) { return ''; }
  }

  function geoTableMode(el) {
    try {
      if (!el || !el.getAttribute) return 'all';
      var s = String(el.getAttribute('data-hfx-geo-table-mode') || '');
      s = s.trim().toLowerCase();
      return s ? s : 'all';
    } catch (_e) { return 'all'; }
  }

  function geoEmitSelect(el, kind, key, meta) {
    try {
      if (!window.hfxGeoSelection || typeof window.hfxGeoSelection.select !== 'function') return false;
      meta = meta || {};
      if (meta.tableMode == null) meta.tableMode = geoTableMode(el);
      return window.hfxGeoSelection.select(geoGroupId(el), kind, key, meta || null);
    } catch (_e) { return false; }
  }

  function geoEmitClear(el, meta) {
    try {
      if (!window.hfxGeoSelection || typeof window.hfxGeoSelection.clear !== 'function') return false;
      meta = meta || {};
      if (meta.tableMode == null) meta.tableMode = geoTableMode(el);
      return window.hfxGeoSelection.clear(geoGroupId(el), meta || null);
    } catch (_e) { return false; }
  }

  function setupGeoSelectionSync(el) {
    try {
      if (!el) return false;
      if (el.__hfx_geo_selection_sync) return true;
      el.__hfx_geo_selection_sync = true;

      if (!window.hfxGeoSelection || typeof window.hfxGeoSelection.subscribe !== 'function') return false;

      var groupId = geoGroupId(el);
      window.hfxGeoSelection.subscribe(function (ev) {
        try {
          if (!ev || !ev.type) return;
          if (String(ev.groupId || '') !== String(groupId || '')) return;
          if (String(ev.sourceType || '') === 'globe' && String(ev.sourceId || '') === String(el.id || '')) return;

          if (ev.type === 'clear') {
            var tm0 = '';
            try { tm0 = String(ev.tableMode || '').toLowerCase(); } catch (_tm0) { tm0 = ''; }
            if (tm0 === 'source') {
              try { clearGlobeSelection(el); } catch (_c0) { /* swallow */ }
            } else {
              try { clearSelectionAndFilters(el); } catch (_c1) { /* swallow */ }
            }
            return;
          }

          if (ev.type !== 'select') return;
          if (String(ev.kind || '') !== 'marker') return;
          var keys = null;
          try { if (Array.isArray(ev.keys) && ev.keys.length) keys = ev.keys; } catch (_k0) { keys = null; }
          if (!keys || !keys.length) keys = [String(ev.key || '')];
          if (!keys[0]) return;

          try { setSelectedGlobeMarker(el, keys); } catch (_s0) { /* swallow */ }
          var tm1 = '';
          try { tm1 = String(ev.tableMode || '').toLowerCase(); } catch (_tm1) { tm1 = ''; }
          if (ev.affectsTables !== false && tm1 !== 'source') {
            try { handleMarkerClick(el, keys); } catch (_f0) { /* swallow */ }
          }
        } catch (_e0) { /* swallow */ }
      });

      return true;
    } catch (_e) {
      return false;
    }
  }

  function clearGlobeSelection(globeElOrId) {
    try {
      var el = resolveElement(globeElOrId);
      if (!el) return false;
      try {
        var els = el.__hfx_globe_selected_els || null;
        if (els && els.length) {
          for (var i = 0; i < els.length; i++) {
            var node = els[i];
            if (node && node.classList) {
              try { node.classList.remove('hfx-globe-selected'); } catch (_r0) { /* swallow */ }
            }
          }
        } else {
          var prev = el.__hfx_globe_selected_el || null;
          if (prev && prev.classList) {
            try { prev.classList.remove('hfx-globe-selected'); } catch (_r1) { /* swallow */ }
          }
        }
      } catch (_r2) { /* swallow */ }

      el.__hfx_globe_selected_el = null;
      el.__hfx_globe_selected_key = null;
      el.__hfx_globe_selected_els = [];
      el.__hfx_globe_selected_keys = [];
      return true;
    } catch (_e) {
      return false;
    }
  }

  function setSelectedGlobeMarker(globeElOrId, key) {
    try {
      var el = resolveElement(globeElOrId);
      if (!el) return false;

      // Ensure initialized.
      if (!el.__hfx_globe) initOne(el);

      var keys = null;
      try {
        if (Array.isArray(key)) {
          keys = [];
          for (var ki = 0; ki < key.length; ki++) {
            var s0 = (key[ki] == null) ? '' : String(key[ki]);
            s0 = s0.trim();
            if (s0) keys.push(s0);
          }
        }
      } catch (_ka) { keys = null; }
      if (!keys || !keys.length) keys = [String(key || '').trim()];
      if (!keys[0]) return false;

      // Clear previous selection.
      try {
        var prevEls = el.__hfx_globe_selected_els || null;
        if (prevEls && prevEls.length) {
          for (var pi = 0; pi < prevEls.length; pi++) {
            var pnode = prevEls[pi];
            if (pnode && pnode.classList) pnode.classList.remove('hfx-globe-selected');
          }
        } else {
          var prev = el.__hfx_globe_selected_el || null;
          if (prev && prev.classList) prev.classList.remove('hfx-globe-selected');
        }
      } catch (_c0) { /* swallow */ }

      var dict = el.__hfx_globe_marker_el_by_key || {};
      var selectedEls = [];
      var selectedKeys = [];

      for (var ii = 0; ii < keys.length; ii++) {
        var k = String(keys[ii] || '');
        if (!k) continue;
        var node = dict[k] || null;
        if (node && node.classList) {
          try { node.classList.add('hfx-globe-selected'); } catch (_a) { /* swallow */ }
          selectedEls.push(node);
          selectedKeys.push(k);
        }
      }

      if (selectedKeys.length) {
        el.__hfx_globe_selected_els = selectedEls;
        el.__hfx_globe_selected_keys = selectedKeys;
        el.__hfx_globe_selected_el = selectedEls[0] || null;
        el.__hfx_globe_selected_key = selectedKeys[0] || null;
        return true;
      }

      // Marker elements might not be created yet (fresh init). Retry once.
      try {
        setTimeout(function () {
          try {
            var d2 = el.__hfx_globe_marker_el_by_key || {};
            var els2 = [];
            var keys2 = [];
            for (var i2 = 0; i2 < keys.length; i2++) {
              var kk = String(keys[i2] || '');
              if (!kk) continue;
              var n2 = d2[kk] || null;
              if (n2 && n2.classList) {
                try { n2.classList.add('hfx-globe-selected'); } catch (_a2) { /* swallow */ }
                els2.push(n2);
                keys2.push(kk);
              }
            }
            if (keys2.length) {
              el.__hfx_globe_selected_els = els2;
              el.__hfx_globe_selected_keys = keys2;
              el.__hfx_globe_selected_el = els2[0] || null;
              el.__hfx_globe_selected_key = keys2[0] || null;
            }
          } catch (_rt) { /* swallow */ }
        }, 0);
      } catch (_st) { /* swallow */ }

      return false;
    } catch (_e) {
      return false;
    }
  }

  // Public helper: focus a marker by key (point-of-view).
  function focusMarker(globeElOrId, key, opts) {
    try {
      var el = resolveElement(globeElOrId);
      if (!el) return false;

      // Ensure initialized.
      if (!el.__hfx_globe) initOne(el);

      var globe = el.__hfx_globe;
      if (!globe) return false;

      var dict = el.__hfx_globe_marker_by_key || {};
      var mk = dict[String(key || '')] || null;
      if (!mk || typeof mk.lat !== 'number' || typeof mk.lng !== 'number') return false;

      var altitude = 1.2;
      var ms = 900;
      if (opts) {
        if (typeof opts.altitude === 'number') altitude = opts.altitude;
        if (typeof opts.ms === 'number') ms = opts.ms;
      }

      if (typeof globe.pointOfView === 'function') {
        globe.pointOfView({ lat: mk.lat, lng: mk.lng, altitude: altitude }, ms);
        try { setSelectedGlobeMarker(el, key); } catch (_sel) { /* swallow */ }
        return true;
      }
      return false;
    } catch (_e) {
      return false;
    }
  }

  function clearSelectionAndFilters(globeElOrId) {
    try {
      var el = resolveElement(globeElOrId);
      if (!el) return false;
      var ok = false;
      try { if (clearGlobeSelection(el)) ok = true; } catch (_c0) { /* swallow */ }
      try { if (clearMarkerClickBindings(el)) ok = true; } catch (_c1) { /* swallow */ }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  window.hfxInitGlobes = init;
  window.hfxGlobeFocusMarker = focusMarker;
  window.hfxGlobeSelectMarker = setSelectedGlobeMarker;
  window.hfxGlobeBindMarkerClicksToDataTables = bindMarkerClicksToDataTables;
  window.hfxGlobeClearSelection = clearGlobeSelection;
  window.hfxGlobeClearSelectionAndFilters = clearSelectionAndFilters;

  if (!window.hfxGeoClearSelectionAll) {
    window.hfxGeoClearSelectionAll = function (root) {
      try {
        if (!root) root = document;
        var ok = false;

        try {
          if (window.hfxLeafletClearSelectionAndFilters && root.querySelectorAll) {
            var ms = root.querySelectorAll('[data-hfx-leaflet=\"1\"]');
            for (var i = 0; i < ms.length; i++) {
              try { if (window.hfxLeafletClearSelectionAndFilters(ms[i])) ok = true; } catch (_l0) { /* swallow */ }
            }
          }
        } catch (_l1) { /* swallow */ }

        try {
          if (window.hfxGlobeClearSelectionAndFilters && root.querySelectorAll) {
            var gs = root.querySelectorAll('[data-hfx-globe=\"1\"]');
            for (var j = 0; j < gs.length; j++) {
              try { if (window.hfxGlobeClearSelectionAndFilters(gs[j])) ok = true; } catch (_g0) { /* swallow */ }
            }
          }
        } catch (_g1) { /* swallow */ }

        try {
          if (window.hfxVectorMapClearSelectionAndFilters && root.querySelectorAll) {
            var vs = root.querySelectorAll('[data-hfx-jvm=\"1\"]');
            for (var k = 0; k < vs.length; k++) {
              try { if (window.hfxVectorMapClearSelectionAndFilters(vs[k])) ok = true; } catch (_v0) { /* swallow */ }
            }
          }
        } catch (_v1) { /* swallow */ }

        return ok;
      } catch (_e) {
        return false;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
