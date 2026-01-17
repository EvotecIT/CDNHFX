(function () {
  'use strict';

  function resolveElement(elOrId) {
    try {
      if (!elOrId) return null;
      if (typeof elOrId === 'string') return document.getElementById(elOrId);
      if (elOrId.nodeType === 1) return elOrId;
      return null;
    } catch (_e) {
      return null;
    }
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

  function isInitialized(el) {
    try {
      return el && el.getAttribute && el.getAttribute('data-hfx-jvm-init') === '1';
    } catch (_e) {
      return false;
    }
  }

  function markInitialized(el) {
    try { if (el && el.setAttribute) el.setAttribute('data-hfx-jvm-init', '1'); } catch (_e) { /* ignore */ }
  }

  function storeMap(id, map) {
    if (!id || !map) return;
    try {
      window.htmlForgeXJsVectorMaps = window.htmlForgeXJsVectorMaps || {};
      window.htmlForgeXJsVectorMaps[id] = map;
    } catch (_e) { /* ignore */ }
  }

  function resolveTableId(tableElOrId) {
    try {
      if (!tableElOrId) return '';
      if (typeof tableElOrId === 'string') return String(tableElOrId);
      if (tableElOrId.nodeType === 1 && tableElOrId.id) return String(tableElOrId.id);
      return '';
    } catch (_e) {
      return '';
    }
  }

  function clearDataTablesMarkerFilter(tableIdOrElOrId, keyColumnHeader, opts) {
    try {
      var tableId = resolveTableId(tableIdOrElOrId);
      if (!tableId) return false;
      var header = String(keyColumnHeader || '');
      if (!header) return false;

      var $ = window.jQuery || window.$;
      if (!$) return false;

      var sel = '#' + tableId;
      var api = null;
      try { api = $(sel).DataTable(); } catch (_dt) { api = null; }
      if (!api) return false;

      var idxMap = {};
      try { if (window.hfxDtShared && hfxDtShared.headerIndexMap) idxMap = hfxDtShared.headerIndexMap(sel); } catch (_hm) { idxMap = {}; }
      var keyIdx = idxMap[header];
      if (typeof keyIdx !== 'number') return false;

      var resetGlobalSearch = !!(opts && opts.resetGlobalSearch);
      var resetColumnSearches = !!(opts && opts.resetColumnSearches);
      try {
        if (resetGlobalSearch && api.search) api.search('');
        if (resetColumnSearches && api.columns) api.columns().search('');
        if (api.column) api.column(keyIdx).search('');
        if (api.draw) api.draw(false);
      } catch (_e) { /* swallow */ }

      try { $(sel + ' tbody tr.table-active').removeClass('table-active'); } catch (_h0) { /* swallow */ }
      try { $(sel).removeAttr('data-hfx-geo-selected-header').removeAttr('data-hfx-geo-selected-key'); } catch (_ps) { /* swallow */ }

      return true;
    } catch (_e2) {
      return false;
    }
  }

  function applyDataTablesMarkerFilter(tableIdOrElOrId, keyColumnHeader, key, opts) {
    try {
      var tableId = resolveTableId(tableIdOrElOrId);
      if (!tableId) return false;
      var header = String(keyColumnHeader || '');
      if (!header) return false;

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

      var value = String(keys[0] || '');

      var $ = window.jQuery || window.$;
      if (!$) return false;

      var sel = '#' + tableId;
      var api = null;
      try { api = $(sel).DataTable(); } catch (_dt) { api = null; }
      if (!api) return false;

      var idxMap = {};
      try { if (window.hfxDtShared && hfxDtShared.headerIndexMap) idxMap = hfxDtShared.headerIndexMap(sel); } catch (_hm) { idxMap = {}; }
      var keyIdx = idxMap[header];
      if (typeof keyIdx !== 'number') return false;

      var exact = true;
      var resetGlobalSearch = false;
      var resetColumnSearches = false;
      var scrollToRow = true;
      var highlightRow = true;
      var highlightMs = 1200;
      var persistSelection = false;
      if (opts) {
        if (opts.exact === false) exact = false;
        if (opts.resetGlobalSearch) resetGlobalSearch = true;
        if (opts.resetColumnSearches) resetColumnSearches = true;
        if (opts.scrollToRow === false) scrollToRow = false;
        if (opts.highlightRow === false) highlightRow = false;
        if (typeof opts.highlightMs === 'number') highlightMs = opts.highlightMs;
        if (opts.persistSelection === true) persistSelection = true;
      }

      try {
        if (resetGlobalSearch && api.search) api.search('');
        if (resetColumnSearches && api.columns) api.columns().search('');
      } catch (_rs) { /* swallow */ }

      var pattern = exact ? '^' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' : value;
      var useRegex = exact;

      if (keys.length > 1) {
        var parts = [];
        for (var i = 0; i < keys.length; i++) {
          try { parts.push(String(keys[i] || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); } catch (_p0) { /* swallow */ }
        }
        if (parts.length) {
          if (exact) pattern = '^(?:' + parts.join('|') + ')$';
          else pattern = '(?:' + parts.join('|') + ')';
          useRegex = true;
        }
      }

      if (persistSelection) {
        try {
          $(sel).attr('data-hfx-geo-selected-header', header);
          $(sel).attr('data-hfx-geo-selected-key', value);
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

                var im = {};
                try { if (window.hfxDtShared && hfxDtShared.headerIndexMap) im = hfxDtShared.headerIndexMap(sel); } catch (_hm2) { im = {}; }
                var kIdx = im[hdr];
                if (typeof kIdx !== 'number') return;

                var nodes = null;
                try { nodes = api.rows({ search: 'applied' }).nodes(); } catch (_rn) { try { nodes = api.rows().nodes(); } catch (_rn2) { nodes = null; } }
                if (!nodes || !nodes.length) return;

                try { $(sel + ' tbody tr.table-active').removeClass('table-active'); } catch (_h0) { /* swallow */ }

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
              var nodes = null;
              try { nodes = api.rows({ search: 'applied' }).nodes(); } catch (_rn) { try { nodes = api.rows().nodes(); } catch (_rn2) { nodes = null; } }
              if (!nodes || !nodes.length) return;
              var node = nodes[0];
              if (!node) return;

              if (highlightRow) {
                try { $(sel + ' tbody tr.table-active').removeClass('table-active'); } catch (_h0) { /* swallow */ }
                try { $(node).addClass('table-active'); } catch (_h1) { /* swallow */ }
                if (!persistSelection && highlightMs && highlightMs > 0) {
                  setTimeout(function () { try { $(node).removeClass('table-active'); } catch (_h2) { /* swallow */ } }, highlightMs);
                }
              }

              if (scrollToRow && node.scrollIntoView) {
                try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_sv) { try { node.scrollIntoView(); } catch (_sv2) { } }
              }
            } catch (_e) { /* swallow */ }
          });
        } catch (_on) { /* swallow */ }
      }

      try { api.column(keyIdx).search(pattern, useRegex, false).draw(false); } catch (_s0) { return false; }

      return true;
    } catch (_e2) {
      return false;
    }
  }

  function clearVectorMapSelection(mapElOrId) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      var map = el.__hfx_jvm_map || null;
      if (!map) {
        var id = el.id ? String(el.id) : '';
        map = (window.htmlForgeXJsVectorMaps && id) ? window.htmlForgeXJsVectorMaps[id] : null;
      }
      if (!map) return false;

      try { if (map.clearSelectedMarkers) map.clearSelectedMarkers(); } catch (_m0) { /* swallow */ }
      try { if (map.clearSelectedRegions) map.clearSelectedRegions(); } catch (_r0) { /* swallow */ }
      try { if (map.setSelectedMarkers) map.setSelectedMarkers([]); } catch (_m1) { /* swallow */ }
      try { if (map.setSelectedRegions) map.setSelectedRegions([]); } catch (_r1) { /* swallow */ }

      el.__hfx_jvm_selected_kind = null;
      el.__hfx_jvm_selected_key = null;
      el.__hfx_jvm_selected_keys = [];
      return true;
    } catch (_e) {
      return false;
    }
  }

  function setSelectedVectorMarker(mapEl, key) {
    try {
      var map = mapEl.__hfx_jvm_map || null;
      if (!map) return false;

      var idxByName = mapEl.__hfx_jvm_marker_idx_by_name || map.__hfx_jvm_marker_idx_by_name || {};

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

      var idxs = [];
      var usedKeys = [];
      for (var i = 0; i < keys.length; i++) {
        var k = String(keys[i] || '');
        if (!k) continue;
        var idx = idxByName[k];
        if (typeof idx !== 'number') continue;
        idxs.push(idx);
        usedKeys.push(k);
      }
      if (!idxs.length) return false;

      try { clearVectorMapSelection(mapEl); } catch (_c0) { /* swallow */ }
      try { if (map.setSelectedMarkers) map.setSelectedMarkers(idxs); } catch (_s0) { /* swallow */ }

      mapEl.__hfx_jvm_selected_kind = 'marker';
      mapEl.__hfx_jvm_selected_key = String(usedKeys[0] || '');
      mapEl.__hfx_jvm_selected_keys = usedKeys;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function setSelectedVectorRegion(mapEl, code) {
    try {
      var map = mapEl.__hfx_jvm_map || null;
      if (!map) return false;

      var codes = null;
      try {
        if (Array.isArray(code)) {
          codes = [];
          for (var ci = 0; ci < code.length; ci++) {
            var s0 = (code[ci] == null) ? '' : String(code[ci]);
            s0 = s0.trim();
            if (s0) codes.push(s0);
          }
        }
      } catch (_ca) { codes = null; }
      if (!codes || !codes.length) codes = [String(code || '').trim()];
      if (!codes[0]) return false;

      try { clearVectorMapSelection(mapEl); } catch (_c0) { /* swallow */ }
      try { if (map.setSelectedRegions) map.setSelectedRegions(codes); } catch (_s0) { /* swallow */ }

      mapEl.__hfx_jvm_selected_kind = 'region';
      mapEl.__hfx_jvm_selected_key = String(codes[0] || '');
      mapEl.__hfx_jvm_selected_keys = codes;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function focusMarker(mapElOrId, key, opts) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      var map = el.__hfx_jvm_map || null;
      if (!map) return false;

      var ok = setSelectedVectorMarker(el, key);

      // Best-effort focus to marker coords (jsVectorMap supports setFocus with coords).
      try {
        if (map.setFocus && el.__hfx_jvm_options && el.__hfx_jvm_marker_idx_by_name) {
          var idx = (el.__hfx_jvm_marker_idx_by_name || {})[String(key || '')];
          if (typeof idx === 'number') {
            var m = (el.__hfx_jvm_options.markers && el.__hfx_jvm_options.markers[idx]) ? el.__hfx_jvm_options.markers[idx] : null;
            if (m && m.coords && m.coords.length === 2) {
              var scale = (opts && typeof opts.scale === 'number') ? opts.scale : 2.8;
              var animate = !(opts && opts.animate === false);
              map.setFocus({ coords: [m.coords[0], m.coords[1]], scale: scale, animate: animate });
            }
          }
        }
      } catch (_f0) { /* swallow */ }

      return ok;
    } catch (_e) {
      return false;
    }
  }

  function focusRegion(mapElOrId, code, opts) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      var map = el.__hfx_jvm_map || null;
      if (!map) return false;

      var ok = setSelectedVectorRegion(el, code);

      // Best-effort focus to region bounds.
      try {
        if (map.setFocus) {
          var animate = !(opts && opts.animate === false);
          map.setFocus({ region: String(code || ''), animate: animate });
        }
      } catch (_f0) { /* swallow */ }

      return ok;
    } catch (_e) {
      return false;
    }
  }

  function clearMarkerClickBindings(mapEl) {
    try {
      var binds = mapEl.__hfx_jvm_marker_click_bindings || [];
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

  function clearRegionClickBindings(mapEl) {
    try {
      var binds = mapEl.__hfx_jvm_region_click_bindings || [];
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

  function handleVectorMarkerClick(mapEl, markerName) {
    try {
      var binds = mapEl.__hfx_jvm_marker_click_bindings || [];
      if (!binds || !binds.length) return false;

      var ok = false;
      for (var i = 0; i < binds.length; i++) {
        var b = binds[i] || {};
        if (!b.tableId || !b.keyColumnHeader) continue;
        if (applyDataTablesMarkerFilter(b.tableId, b.keyColumnHeader, markerName, b.opts || null)) ok = true;
      }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  function handleVectorRegionClick(mapEl, code) {
    try {
      var binds = mapEl.__hfx_jvm_region_click_bindings || [];
      if (!binds || !binds.length) return false;

      var ok = false;
      for (var i = 0; i < binds.length; i++) {
        var b = binds[i] || {};
        if (!b.tableId || !b.keyColumnHeader) continue;
        if (applyDataTablesMarkerFilter(b.tableId, b.keyColumnHeader, code, b.opts || null)) ok = true;
      }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  function applyVectorMapClearClick(mapEl) {
    try {
      if (mapEl.__hfx_jvm_clear_bind) return;
      mapEl.__hfx_jvm_clear_bind = true;
      mapEl.addEventListener('click', function () {
        try {
          if (mapEl.__hfx_jvm_ignore_next_click) {
            mapEl.__hfx_jvm_ignore_next_click = false;
            return;
          }
        } catch (_ig) { /* swallow */ }

        var hasSelection = !!(mapEl.__hfx_jvm_selected_key && String(mapEl.__hfx_jvm_selected_key));
        if (!hasSelection) return;
        try { clearVectorMapSelection(mapEl); } catch (_c0) { /* swallow */ }
        try { clearMarkerClickBindings(mapEl); } catch (_c1) { /* swallow */ }
        try { clearRegionClickBindings(mapEl); } catch (_c2) { /* swallow */ }
        try { geoEmitClear(mapEl, { sourceType: 'vectormap', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '' }); } catch (_gc) { /* swallow */ }
      });
    } catch (_e) { /* swallow */ }
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
          if (String(ev.sourceType || '') === 'vectormap' && String(ev.sourceId || '') === String(el.id || '')) return;

          if (ev.type === 'clear') {
            var tm0 = '';
            try { tm0 = String(ev.tableMode || '').toLowerCase(); } catch (_tm0) { tm0 = ''; }
            try { clearVectorMapSelection(el); } catch (_c0) { /* swallow */ }
            if (tm0 !== 'source') {
              try { clearMarkerClickBindings(el); } catch (_c1) { /* swallow */ }
              try { clearRegionClickBindings(el); } catch (_c2) { /* swallow */ }
            }
            return;
          }

          if (ev.type !== 'select') return;
          var keys = null;
          try { if (Array.isArray(ev.keys) && ev.keys.length) keys = ev.keys; } catch (_k0) { keys = null; }
          if (!keys || !keys.length) keys = [String(ev.key || '')];
          if (!keys[0]) return;
          var kind = String(ev.kind || '');
          var tm1 = '';
          try { tm1 = String(ev.tableMode || '').toLowerCase(); } catch (_tm1) { tm1 = ''; }

          if (kind === 'region') {
            try { setSelectedVectorRegion(el, keys); } catch (_s0) { /* swallow */ }
            if (ev.affectsTables !== false && tm1 !== 'source') {
              try { handleVectorRegionClick(el, keys); } catch (_f0) { /* swallow */ }
            }
            return;
          }

          if (kind !== 'marker') return;
          try { setSelectedVectorMarker(el, keys); } catch (_s1) { /* swallow */ }
          if (ev.affectsTables !== false && tm1 !== 'source') {
            try { handleVectorMarkerClick(el, keys); } catch (_f1) { /* swallow */ }
          }
        } catch (_e0) { /* swallow */ }
      });

      return true;
    } catch (_e) {
      return false;
    }
  }

  function applyMarkerClickBindings(mapEl, map, options) {
    try {
      var binds = mapEl.__hfx_jvm_marker_click_bindings || [];
      if (!binds || !binds.length) return;
      if (!map || !map.params) return;
      if (mapEl.__hfx_jvm_marker_hooked) return;
      mapEl.__hfx_jvm_marker_hooked = true;

      var prev = map.params.onMarkerClick;
      map.params.onMarkerClick = function (ev, idx) {
        try {
          try { mapEl.__hfx_jvm_ignore_next_click = true; } catch (_f) { /* swallow */ }

          var name = null;
          try {
            var mi = parseInt(String(idx), 10);
            var m = (options && options.markers && typeof mi === 'number' && !isNaN(mi) && options.markers[mi]) ? options.markers[mi] : null;
            name = (m && m.name) ? String(m.name) : null;
          } catch (_m0) { name = null; }
          if (!name) name = String(idx);

          // Toggle: clicking the currently selected marker clears selection + filters.
          try {
            var currentKind = mapEl.__hfx_jvm_selected_kind != null ? String(mapEl.__hfx_jvm_selected_kind) : '';
            var isSelected = false;
            try {
              var arr = mapEl.__hfx_jvm_selected_keys || null;
              if (currentKind === 'marker' && arr && arr.length) {
                for (var ai = 0; ai < arr.length; ai++) {
                  if (String(arr[ai] || '') === String(name)) { isSelected = true; break; }
                }
              } else {
                var currentKey = mapEl.__hfx_jvm_selected_key != null ? String(mapEl.__hfx_jvm_selected_key) : '';
                if (currentKind === 'marker' && currentKey && currentKey === String(name)) isSelected = true;
              }
            } catch (_sk) { isSelected = false; }

            if (isSelected) {
              try { clearVectorMapSelection(mapEl); } catch (_csel) { /* swallow */ }
              clearMarkerClickBindings(mapEl);
              try { geoEmitClear(mapEl, { sourceType: 'vectormap', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '' }); } catch (_gc) { /* swallow */ }
              return;
            }
          } catch (_tg) { /* swallow */ }

          try { setSelectedVectorMarker(mapEl, name); } catch (_sel) { /* swallow */ }
          handleVectorMarkerClick(mapEl, name);
          try { geoEmitSelect(mapEl, 'marker', String(name || ''), { sourceType: 'vectormap', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '', affectsTables: true }); } catch (_gs) { /* swallow */ }
        } catch (_e) { /* swallow */ }

        try { if (typeof prev === 'function') prev(ev, idx); } catch (_p) { /* swallow */ }
      };
    } catch (_e) { /* swallow */ }
  }

  function applyRegionClickBindings(mapEl, map) {
    try {
      var binds = mapEl.__hfx_jvm_region_click_bindings || [];
      if (!binds || !binds.length) return;
      if (!map || !map.params) return;
      if (mapEl.__hfx_jvm_region_hooked) return;
      mapEl.__hfx_jvm_region_hooked = true;

      var prev = map.params.onRegionClick;
      map.params.onRegionClick = function (ev, code) {
        try {
          try { mapEl.__hfx_jvm_ignore_next_click = true; } catch (_f) { /* swallow */ }

          var c = String(code || '');
          if (!c) return;

          // Toggle: clicking the currently selected region clears selection + filters.
          try {
            var currentKind = mapEl.__hfx_jvm_selected_kind != null ? String(mapEl.__hfx_jvm_selected_kind) : '';
            var isSelected = false;
            try {
              var arr = mapEl.__hfx_jvm_selected_keys || null;
              if (currentKind === 'region' && arr && arr.length) {
                for (var ai = 0; ai < arr.length; ai++) {
                  if (String(arr[ai] || '') === String(c)) { isSelected = true; break; }
                }
              } else {
                var currentKey = mapEl.__hfx_jvm_selected_key != null ? String(mapEl.__hfx_jvm_selected_key) : '';
                if (currentKind === 'region' && currentKey && currentKey === String(c)) isSelected = true;
              }
            } catch (_sk) { isSelected = false; }

            if (isSelected) {
              try { clearVectorMapSelection(mapEl); } catch (_csel) { /* swallow */ }
              clearRegionClickBindings(mapEl);
              try { geoEmitClear(mapEl, { sourceType: 'vectormap', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '' }); } catch (_gc) { /* swallow */ }
              return;
            }
          } catch (_tg) { /* swallow */ }

          try { setSelectedVectorRegion(mapEl, c); } catch (_sel) { /* swallow */ }
          handleVectorRegionClick(mapEl, c);
          try { geoEmitSelect(mapEl, 'region', String(c || ''), { sourceType: 'vectormap', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '', affectsTables: true }); } catch (_gs) { /* swallow */ }
        } catch (_e) { /* swallow */ }

        try { if (typeof prev === 'function') prev(ev, code); } catch (_p) { /* swallow */ }
      };
    } catch (_e) { /* swallow */ }
  }

  function bindMarkerClicksToDataTables(mapElOrId, tableElOrId, keyColumnHeader, opts) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;

      var tableId = resolveTableId(tableElOrId);
      if (!tableId) return false;

      var header = String(keyColumnHeader || '');
      if (!header) return false;

      try { if (!el.__hfx_jvm_marker_click_bindings) el.__hfx_jvm_marker_click_bindings = []; } catch (_b0) { /* swallow */ }
      try { el.__hfx_jvm_marker_click_bindings.push({ tableId: tableId, keyColumnHeader: header, opts: opts || null }); } catch (_b1) { /* swallow */ }

      var map = el.__hfx_jvm_map || null;
      if (map) {
        applyMarkerClickBindings(el, map, el.__hfx_jvm_options || null);
        applyVectorMapClearClick(el);
      }

      return true;
    } catch (_e) {
      return false;
    }
  }

  function bindRegionClicksToDataTables(mapElOrId, tableElOrId, keyColumnHeader, opts) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;

      var tableId = resolveTableId(tableElOrId);
      if (!tableId) return false;

      var header = String(keyColumnHeader || '');
      if (!header) return false;

      try { if (!el.__hfx_jvm_region_click_bindings) el.__hfx_jvm_region_click_bindings = []; } catch (_b0) { /* swallow */ }
      try { el.__hfx_jvm_region_click_bindings.push({ tableId: tableId, keyColumnHeader: header, opts: opts || null }); } catch (_b1) { /* swallow */ }

      var map = el.__hfx_jvm_map || null;
      if (map) {
        applyRegionClickBindings(el, map);
        applyVectorMapClearClick(el);
      }

      return true;
    } catch (_e) {
      return false;
    }
  }

  function initOne(el, options, cfg) {
    try {
      if (!el) return null;
      if (isInitialized(el)) return null;
      markInitialized(el);

      var id = (cfg && cfg.id) ? String(cfg.id) : (el.id ? String(el.id) : '');
      var markerLabelsFromName = !!(cfg && cfg.markerLabelsFromName);
      var regionLabelsFromName = !!(cfg && cfg.regionLabelsFromName);

      var map = null;

      // Functions cannot be serialized as JSON; attach label renderers here.
      try {
        if (markerLabelsFromName || regionLabelsFromName) {
          options.labels = options.labels || {};
          if (markerLabelsFromName) {
            options.labels.markers = {
              render: function (marker) {
                try { return marker && marker.name ? marker.name : ''; } catch (_e) { return ''; }
              }
            };
          }
          if (regionLabelsFromName) {
            // Region label render receives a region code; resolve the display name from the map dataset.
            options.labels.regions = {
              render: function (code) {
                try {
                  return map && map._mapData && map._mapData.paths && map._mapData.paths[code] && map._mapData.paths[code].name
                    ? map._mapData.paths[code].name
                    : String(code || '');
                } catch (_e) { return String(code || ''); }
              }
            };
          }
        }
      } catch (_e) { /* ignore */ }

      try { options.selector = el; } catch (_e) { try { options.selector = '#' + id; } catch (_e2) { } }

      try { map = new jsVectorMap(options); } catch (_e) { return null; }
      storeMap(id, map);
      try { el.__hfx_jvm_map = map; } catch (_e) { /* ignore */ }
      try { el.__hfx_jvm_options = options; } catch (_e) { /* ignore */ }

      // Marker name -> index lookup to support focus + linking.
      try {
        var idxByName = {};
        var ms = options && options.markers ? options.markers : null;
        if (ms && ms.length) {
          for (var i = 0; i < ms.length; i++) {
            var m0 = ms[i] || {};
            if (!m0.name) continue;
            var n = String(m0.name);
            if (!n) continue;
            idxByName[n] = i;
          }
        }
        el.__hfx_jvm_marker_idx_by_name = idxByName;
        map.__hfx_jvm_marker_idx_by_name = idxByName;
      } catch (_ix) { /* ignore */ }

      // Apply pending DataTables click bindings (if any were registered before init).
      try { applyMarkerClickBindings(el, map, options); } catch (_mb) { /* ignore */ }
      try { applyRegionClickBindings(el, map); } catch (_rb) { /* ignore */ }
      try { applyVectorMapClearClick(el); } catch (_cb) { /* ignore */ }
      try { setupGeoSelectionSync(el); } catch (_gs) { /* ignore */ }

      function resize() { try { map.updateSize(); } catch (_e) { } }
      try { window.addEventListener('resize', resize); } catch (_e) { }
      try {
        if (window.ResizeObserver) {
          var ro = new ResizeObserver(function () { resize(); });
          ro.observe(el);
          el.__hfx_jvm_ro = ro;
        }
      } catch (_e) { }

      return map;
    } catch (_e) {
      return null;
    }
  }

  function init(elOrSelector, options, cfg) {
    var el = elOrSelector;
    try { if (typeof elOrSelector === 'string') el = document.querySelector(elOrSelector); } catch (_e) { /* ignore */ }
    return initOne(el, options || {}, cfg || {});
  }

  window.hfxJsVectorMap = window.hfxJsVectorMap || {};
  window.hfxJsVectorMap.init = init;

  window.hfxVectorMapFocusMarker = focusMarker;
  window.hfxVectorMapFocusRegion = focusRegion;
  window.hfxVectorMapSelectMarker = function (mapElOrId, key) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      if (!el.__hfx_jvm_map) return false;
      return setSelectedVectorMarker(el, key);
    } catch (_e) { return false; }
  };
  window.hfxVectorMapSelectRegion = function (mapElOrId, code) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      if (!el.__hfx_jvm_map) return false;
      return setSelectedVectorRegion(el, code);
    } catch (_e) { return false; }
  };
  window.hfxVectorMapBindMarkerClicksToDataTables = bindMarkerClicksToDataTables;
  window.hfxVectorMapBindRegionClicksToDataTables = bindRegionClicksToDataTables;
  window.hfxVectorMapClearSelection = clearVectorMapSelection;

  function clearSelectionAndFilters(mapElOrId) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      var ok = false;
      try { if (clearVectorMapSelection(el)) ok = true; } catch (_c0) { /* swallow */ }
      try { if (clearMarkerClickBindings(el)) ok = true; } catch (_c1) { /* swallow */ }
      try { if (clearRegionClickBindings(el)) ok = true; } catch (_c2) { /* swallow */ }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  window.hfxVectorMapClearSelectionAndFilters = clearSelectionAndFilters;

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
})();
