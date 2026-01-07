(function (global) {
  'use strict';
  if (global.hfxDtTypes) return;

  var $ = global.jQuery || global.$;
  function addType(name, detect, pre, className) {
    try {
      if (!$ || !$.fn || !$.fn.dataTable || !$.fn.dataTable.ext || !$.fn.dataTable.ext.type) return;
      var dt = $.fn.dataTable;
      if (dt.ext.type.order[name + '-pre']) return;
      if (className && dt.ext.type.className) dt.ext.type.className[name] = className;
      if (typeof detect === 'function' && dt.ext.type.detect) {
        var fn = function (d) { return detect(d) ? name : null; };
        try { Object.defineProperty(fn, 'name', { value: name }); } catch (_) { }
        dt.ext.type.detect.unshift(fn);
      }
      dt.ext.type.order[name + '-pre'] = pre;
    } catch (_) { }
  }

  function stripHtml(s) {
    if (s == null) return '';
    return String(s).replace(/<[^>]*>/g, '').trim();
  }

  function extractDataAttr(raw, attr) {
    if (raw == null || typeof raw !== 'string') return null;
    try {
      var re = new RegExp(attr + '\\s*=\\s*([\\\"\\\'])(.*?)\\1', 'i');
      var m = re.exec(raw);
      if (m && m[2] != null) return m[2];
    } catch (_) { }
    return null;
  }

  function parseAttrNumber(raw) {
    var v = extractDataAttr(raw, 'data-order') || extractDataAttr(raw, 'data-raw');
    if (v == null) return NaN;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? NaN : n;
  }

  function parseNumber(raw) {
    if (raw == null) return NaN;
    if (typeof raw === 'number') return raw;
    var attr = parseAttrNumber(raw);
    if (!isNaN(attr)) return attr;
    var s = stripHtml(raw);
    if (!s) return NaN;
    s = s.replace(/[\u00A0\u2009\u202F]/g, ' ');
    s = s.replace(/[, ](?=\d{3}(\D|$))/g, '');
    s = s.replace(/^\s+|\s+$/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  function parseFileSize(raw) {
    var attr = parseAttrNumber(raw);
    if (!isNaN(attr)) return attr;
    var s = stripHtml(raw);
    if (!s) return NaN;
    var m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(b|kb|mb|gb|tb|pb|kib|mib|gib|tib|pib)$/i);
    if (!m) return NaN;
    var num = parseFloat(m[1].replace(',', '.'));
    if (isNaN(num)) return NaN;
    var unit = m[2].toLowerCase();
    var pow = { b: 0, kb: 1, mb: 2, gb: 3, tb: 4, pb: 5, kib: 1, mib: 2, gib: 3, tib: 4, pib: 5 }[unit] || 0;
    var base = (unit.indexOf('i') >= 0) ? 1024 : 1000;
    return num * Math.pow(base, pow);
  }

  function parseDurationMs(raw) {
    var attr = parseAttrNumber(raw);
    if (!isNaN(attr)) return attr;
    var s = stripHtml(raw);
    if (!s) return NaN;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    var m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(ms|s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i);
    if (!m) return NaN;
    var num = parseFloat(m[1].replace(',', '.'));
    if (isNaN(num)) return NaN;
    var unit = m[2].toLowerCase();
    var mult = 1;
    if (unit === 'ms') mult = 1;
    else if (unit === 's' || unit === 'sec' || unit === 'secs' || unit === 'second' || unit === 'seconds') mult = 1000;
    else if (unit === 'm' || unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') mult = 60000;
    else if (unit === 'h' || unit === 'hr' || unit === 'hrs' || unit === 'hour' || unit === 'hours') mult = 3600000;
    else if (unit === 'd' || unit === 'day' || unit === 'days') mult = 86400000;
    return num * mult;
  }

  function parseAgeMinutes(raw) {
    var ms = parseDurationMs(raw);
    return isNaN(ms) ? NaN : (ms / 60000);
  }

  function parseDateTicks(raw) {
    var attr = parseAttrNumber(raw);
    if (!isNaN(attr)) return attr;
    var s = stripHtml(raw);
    if (!s) return NaN;
    if (/^\d{9,}$/.test(s)) return parseFloat(s);
    var t = Date.parse(s);
    return isNaN(t) ? NaN : t;
  }

  function parseIp(raw) {
    var s = stripHtml(raw);
    if (!s) return NaN;
    var parts = s.split('.');
    if (parts.length !== 4) return NaN;
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var p = parseInt(parts[i], 10);
      if (isNaN(p) || p < 0 || p > 255) return NaN;
      n = n * 256 + p;
    }
    return n;
  }

  function detectByAttr(attrs) {
    return function (data, type, row, meta) {
      if (type !== 'sort' && type !== 'type') return data;
      try {
        if (!meta || meta.settings === undefined) return data;
        var tbl = meta.settings.nTable;
        if (!tbl) return data;
        var td = meta.cell;
        if (!td) return data;
        var dtType = (td.getAttribute('data-hfx-type') || '').toLowerCase();
        if (!dtType && meta && meta.settings && meta.settings.aoColumns && meta.settings.aoColumns[meta.col]) {
          var th = meta.settings.aoColumns[meta.col].nTh;
          if (th && th.getAttribute) dtType = (th.getAttribute('data-hfx-type') || '').toLowerCase();
        }
        if (dtType && attrs[dtType]) return attrs[dtType](data);
      } catch (_) { }
      return data;
    };
  }

  function registerCoreTypes() {
    addType('hfx-file-size', function (d) { return !isNaN(parseFileSize(d)); }, function (d) {
      var v = parseFileSize(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-numeric');
    addType('hfx-duration', function (d) { return !isNaN(parseDurationMs(d)); }, function (d) {
      var v = parseDurationMs(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-numeric');
    addType('hfx-age-minutes', function (d) { return !isNaN(parseAgeMinutes(d)); }, function (d) {
      var v = parseAgeMinutes(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-numeric');
    addType('hfx-date-ticks', function (d) { return !isNaN(parseDateTicks(d)); }, function (d) {
      var v = parseDateTicks(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-date');
    addType('hfx-ip', function (d) { return !isNaN(parseIp(d)); }, function (d) {
      var v = parseIp(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-numeric');
  }

  function initAttrOverrides(api) {
    try {
      registerCoreTypes();
      var attrs = {
        'file-size': function (d) { return parseFileSize(d); },
        'filesize': function (d) { return parseFileSize(d); },
        'duration': function (d) { return parseDurationMs(d); },
        'age-minutes': function (d) { return parseAgeMinutes(d); },
        'date-ticks': function (d) { return parseDateTicks(d); },
        'ip': function (d) { return parseIp(d); },
        'ip-address': function (d) { return parseIp(d); }
      };
      if ($ && $.fn && $.fn.dataTable) {
        $.fn.dataTable.ext.type.order['hfx-attr-pre'] = detectByAttr(attrs);
      }
      if (api && api.columns) {
        api.columns().every(function () {
          var col = this;
          var header = col.header();
          if (!header) return;
          var type = (header.getAttribute('data-hfx-type') || '').toLowerCase();
          if (!type) return;
          col.type('hfx-attr');
        });
      }
    } catch (_) { }
  }

  function applyTableTypeMap(api, map) {
    if (!api || !map) return;
    try {
      registerCoreTypes();
      var keys = Object.keys(map);
      if (!keys.length) return;
      var idxMap = {};
      if (global.hfxDtShared && hfxDtShared.headerIndexMap) {
        idxMap = hfxDtShared.headerIndexMap('#' + api.table().node().id);
      }
      keys.forEach(function (header) {
        var idx = idxMap && idxMap[header];
        if (typeof idx !== 'number') return;
        try { api.column(idx).type(map[header]); } catch (_) { }
      });
    } catch (_) { }
  }

  global.hfxDtTypes = {
    register: registerCoreTypes,
    initAttrOverrides: initAttrOverrides,
    applyTableTypeMap: applyTableTypeMap
  };

  registerCoreTypes();
})(window);
