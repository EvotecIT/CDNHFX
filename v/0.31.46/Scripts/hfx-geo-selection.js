(function () {
  'use strict';

  if (window.hfxGeoSelection) return;

  function normGroup(groupId) {
    try { return groupId == null ? '' : String(groupId); } catch (_e) { return ''; }
  }

  function nowMs() { try { return Date.now ? Date.now() : (new Date()).getTime(); } catch (_e) { return 0; } }

  var _state = {}; // groupId -> { kind, key, keys, sourceType, sourceId, affectsTables, tableMode, ts }
  var _subs = [];

  function get(groupId) {
    try { return _state[normGroup(groupId)] || null; } catch (_e) { return null; }
  }

  function normalizeKeys(keyOrKeys) {
    try {
      var out = [];
      if (Array.isArray(keyOrKeys)) {
        for (var i = 0; i < keyOrKeys.length; i++) {
          var v = keyOrKeys[i];
          var s = (v == null) ? '' : String(v);
          s = s.trim();
          if (s) out.push(s);
        }
      } else {
        var s0 = (keyOrKeys == null) ? '' : String(keyOrKeys);
        s0 = s0.trim();
        if (s0) out.push(s0);
      }
      return out;
    } catch (_e) {
      return [];
    }
  }

  function subscribe(handler) {
    if (typeof handler !== 'function') return function () { };
    _subs.push(handler);
    return function () {
      try {
        for (var i = _subs.length - 1; i >= 0; i--) {
          if (_subs[i] === handler) _subs.splice(i, 1);
        }
      } catch (_e) { /* swallow */ }
    };
  }

  function publish(ev) {
    try {
      for (var i = 0; i < _subs.length; i++) {
        try { _subs[i](ev); } catch (_e) { /* swallow */ }
      }
    } catch (_e2) { /* swallow */ }
  }

  function normalizeTableMode(mode) {
    try {
      var s = (mode == null) ? '' : String(mode);
      s = s.trim().toLowerCase();
      if (!s) return 'all';
      if (s === 'source' || s === 'sourceonly' || s === 'source-only' || s === 'source_only') return 'source';
      return 'all';
    } catch (_e) {
      return 'all';
    }
  }

  // keyOrKeys can be a string or an array of strings
  function select(groupId, kind, keyOrKeys, meta) {
    try {
      var g = normGroup(groupId);
      var ks = normalizeKeys(keyOrKeys);
      if (!ks || !ks.length) return false;
      var kd = String(kind || '');
      if (!kd) kd = 'marker';

      var affectsTables = true;
      var sourceType = '';
      var sourceId = '';
      var tableMode = 'all';
      if (meta) {
        if (meta.affectsTables === false) affectsTables = false;
        if (meta.sourceType) sourceType = String(meta.sourceType);
        if (meta.sourceId) sourceId = String(meta.sourceId);
        if (meta.tableMode != null) tableMode = normalizeTableMode(meta.tableMode);
      }

      var ev = {
        type: 'select',
        groupId: g,
        kind: kd,
        key: ks[0],
        keys: ks,
        affectsTables: affectsTables,
        tableMode: tableMode,
        sourceType: sourceType,
        sourceId: sourceId,
        ts: nowMs()
      };

      _state[g] = ev;
      publish(ev);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function clear(groupId, meta) {
    try {
      var g = normGroup(groupId);
      var sourceType = '';
      var sourceId = '';
      var tableMode = 'all';
      if (meta) {
        if (meta.sourceType) sourceType = String(meta.sourceType);
        if (meta.sourceId) sourceId = String(meta.sourceId);
        if (meta.tableMode != null) tableMode = normalizeTableMode(meta.tableMode);
      }

      try { delete _state[g]; } catch (_d) { _state[g] = null; }

      var ev = {
        type: 'clear',
        groupId: g,
        kind: '',
        key: '',
        keys: [],
        affectsTables: true,
        tableMode: tableMode,
        sourceType: sourceType,
        sourceId: sourceId,
        ts: nowMs()
      };
      publish(ev);
      return true;
    } catch (_e) {
      return false;
    }
  }

  window.hfxGeoSelection = {
    get: get,
    select: select,
    clear: clear,
    subscribe: subscribe
  };
})();
