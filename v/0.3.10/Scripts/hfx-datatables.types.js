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

  function parsePercent(raw) {
    var attr = parseAttrNumber(raw);
    if (!isNaN(attr)) return attr;
    var s = stripHtml(raw);
    if (!s) return NaN;
    s = s.replace('%', '').trim();
    if (!s) return NaN;
    s = s.replace(/[\u00A0\u2009\u202F]/g, ' ');
    s = s.replace(/[, ](?=\d{3}(\D|$))/g, '');
    s = s.replace(/^\s+|\s+$/g, '');
    var n = parseFloat(s.replace(',', '.'));
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
    var t = Date.parse(normalizeDateString(s));
    return isNaN(t) ? NaN : t;
  }

  function normalizeDateString(value) {
    var v = String(value);
    if (/^\d{4}-\d{2}-\d{2} /.test(v)) v = v.replace(' ', 'T');
    if (/ UTC$/.test(v)) v = v.replace(' UTC', 'Z');
    return v;
  }

  function parseIp(raw) {
    var key = parseIpKey(raw);
    return key == null ? '' : key;
  }

  function parseIpKey(raw) {
    var s = stripHtml(raw);
    if (!s) return null;
    s = s.trim();
    if (!s) return null;
    if (s[0] === '[' && s[s.length - 1] === ']') {
      s = s.substring(1, s.length - 1).trim();
    }
    var zoneIndex = s.indexOf('%');
    if (zoneIndex >= 0) s = s.substring(0, zoneIndex);
    if (s.indexOf(':') >= 0) return parseIpv6Key(s);
    return parseIpv4Key(s);
  }

  function parseIpv4Key(value) {
    var parts = String(value).split('.');
    if (parts.length !== 4) return null;
    var padded = '';
    for (var i = 0; i < 4; i++) {
      var p = parseInt(parts[i], 10);
      if (isNaN(p) || p < 0 || p > 255) return null;
      var seg = String(p);
      padded += ('000' + seg).slice(-3);
    }
    return 'v4:' + padded;
  }

  function parseIpv6Key(value) {
    var s = String(value).toLowerCase();
    if (!s) return null;
    var doubleIdx = s.indexOf('::');
    var left = [];
    var right = [];
    if (doubleIdx >= 0) {
      var leftPart = s.substring(0, doubleIdx);
      var rightPart = s.substring(doubleIdx + 2);
      left = leftPart ? leftPart.split(':') : [];
      right = rightPart ? rightPart.split(':') : [];
    } else {
      left = s.split(':');
    }

    var tail = right.length ? right : left;
    if (tail.length > 0 && tail[tail.length - 1].indexOf('.') >= 0) {
      var ipv4 = tail[tail.length - 1];
      var v4parts = ipv4.split('.');
      if (v4parts.length !== 4) return null;
      var b0 = parseInt(v4parts[0], 10);
      var b1 = parseInt(v4parts[1], 10);
      var b2 = parseInt(v4parts[2], 10);
      var b3 = parseInt(v4parts[3], 10);
      if ([b0, b1, b2, b3].some(function (b) { return isNaN(b) || b < 0 || b > 255; })) return null;
      var hexHi = ((b0 << 8) | b1).toString(16).padStart(4, '0');
      var hexLo = ((b2 << 8) | b3).toString(16).padStart(4, '0');
      tail.pop();
      tail.push(hexHi);
      tail.push(hexLo);
    }

    if (doubleIdx >= 0) {
      var missing = 8 - (left.length + right.length);
      if (missing < 0) return null;
      var expanded = [];
      for (var i = 0; i < left.length; i++) expanded.push(left[i]);
      for (var j = 0; j < missing; j++) expanded.push('0');
      for (var k = 0; k < right.length; k++) expanded.push(right[k]);
      left = expanded;
    }

    if (left.length !== 8) return null;
    var parts = [];
    for (var n = 0; n < left.length; n++) {
      var part = left[n];
      if (part === '') part = '0';
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      parts.push(('0000' + part).slice(-4));
    }
    return 'v6:' + parts.join('');
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
    addType('hfx-number', function (d) { return !isNaN(parseNumber(d)); }, function (d) {
      var v = parseNumber(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-numeric');
    addType('hfx-percent', function (d) { return !isNaN(parsePercent(d)); }, function (d) {
      var v = parsePercent(d);
      return isNaN(v) ? -Infinity : v;
    }, 'dt-type-numeric');
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
    addType('hfx-ip', function (d) { return parseIpKey(d) != null; }, function (d) {
      return parseIp(d);
    }, 'dt-type-numeric');
  }

  function initAttrOverrides(api) {
    try {
      registerCoreTypes();
      var attrs = {
        'number': function (d) { return parseNumber(d); },
        'numeric': function (d) { return parseNumber(d); },
        'num': function (d) { return parseNumber(d); },
        'file-size': function (d) { return parseFileSize(d); },
        'filesize': function (d) { return parseFileSize(d); },
        'percent': function (d) { return parsePercent(d); },
        'percentage': function (d) { return parsePercent(d); },
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
