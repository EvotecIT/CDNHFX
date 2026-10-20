// HtmlForgeX data runtime: datasets (columnar, gzip), the query engine, and the three places rows can live:
// in the page (inline), in chunk scripts next to the page (sidecar), or behind an endpoint that answers one page of
// rows per query (remote). Components read every dataset through HfxData.source(id).
(function () {
  // Invariant simple casing matches the server: no contextual final sigma or expanding dotted-I mapping.
  function fold(value) {
    var result = '';
    for (var character of String(value)) {
      var lower = character.toLowerCase();
      result += lower.length === character.length ? lower : character;
    }
    return result;
  }
  if (window.HfxData && window.HfxData.source) return;
  // Sidecar chunks that loaded before this script wait in a queue.
  var early = (window.HfxData && window.HfxData.queue) || [];

  // ------------------------------------------------------------------ utils
  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dict() { return Object.create(null); }
  function fail(code, message, extra) {
    var e = new Error(message); e.code = code;
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k];
    return e;
  }

  // Dates are epoch milliseconds. Date columns hold a calendar date at UTC midnight; date-time columns hold an instant,
  // shown in UTC unless the column asks for the viewer's local time. Formats match HtmlForgeX ReportValueFormatter.
  // A report shell lets the reader choose UTC. Columns that show local time then show, parse and search UTC.
  function readerWantsUtc() {
    try { return document.documentElement.getAttribute('data-hfx-time-zone') === 'utc'; } catch (_) { return false; }
  }
  function formatDate(ms, type, mode, local, seconds) {
    var d = new Date(ms);
    var utc = type === 'date' || !local;
    var day = (utc ? d.getUTCFullYear() : d.getFullYear()) + '-' + pad((utc ? d.getUTCMonth() : d.getMonth()) + 1) + '-' + pad(utc ? d.getUTCDate() : d.getDate());
    if (type === 'date') return day;
    var time = pad(utc ? d.getUTCHours() : d.getHours()) + ':' + pad(utc ? d.getUTCMinutes() : d.getMinutes());
    return day + ' ' + time + (mode === 'export' || seconds ? ':' + pad(utc ? d.getUTCSeconds() : d.getSeconds()) : '');
  }
  // Shortest round-trip text (JavaScript number formatting), mirrored by ReportValueFormatter.FormatNumber.
  function formatNumber(n) { return n === 0 ? '0' : String(n); }
  var NUMBER_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  var DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i;
  function parseNumber(s) { return NUMBER_TEXT.test(s) ? Number(s) : NaN; }
  // Parses yyyy-MM-dd[ HH:mm[:ss[.fff]]][Z|UTC|+hh:mm]. Without a zone the value is UTC, or local time for local columns.
  function parseDateText(s, type, local) {
    var m = DATE_TEXT.exec(s);
    if (!m) return NaN;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    if (y < 1 || y > 9999 || mo < 0 || mo > 11 || d < 1) return NaN;
    var calendar = new Date(0); calendar.setUTCFullYear(y, mo + 1, 0);
    if (d > calendar.getUTCDate()) return NaN;
    calendar.setUTCFullYear(y, mo, d); calendar.setUTCHours(0, 0, 0, 0);
    if (type === 'date') return calendar.getTime();
    var h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0), ms = m[7] ? Math.floor(+('0.' + m[7]) * 1000) : 0;
    if (h > 23 || mi > 59 || se > 59) return NaN;
    var zone = m[8];
    var t;
    if (!zone && local) { var clock = new Date(0); clock.setFullYear(y, mo, d); clock.setHours(h, mi, se, ms); t = clock.getTime(); }
    else {
      calendar.setUTCHours(h, mi, se, ms); t = calendar.getTime();
      if (zone && !/^(z|utc)$/i.test(zone)) {
        var sign = zone[0] === '-' ? -1 : 1, digits = zone.slice(1).replace(':', '');
        var zh = +digits.slice(0, 2), zm = +digits.slice(2, 4);
        if (zh > 14 || zm > 59 || (zh === 14 && zm !== 0)) return NaN;
        t -= sign * ((+digits.slice(0, 2)) * 60 + (+digits.slice(2, 4))) * 60000;
      }
    }
    return isNaN(t) || t < -62135596800000 || t > 253402300799999 ? NaN : t;
  }
  // Today's calendar date in the viewer's time zone, as a UTC-midnight value like Date column values.
  function todayAsDate(now) { var d = new Date(now); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }

  // --------------------------------------------------------------- decoding
  function base64ToBytes(text) {
    var bin = atob(text.replace(/\s+/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function decode(encoding, payload) {
    if (encoding === 'json') return Promise.resolve(typeof payload === 'string' ? JSON.parse(payload) : payload);
    if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') {
      return Promise.reject(fail('unsupported', 'This browser cannot decompress the data.'));
    }
    var stream = new Blob([base64ToBytes(payload)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text().then(function (json) { return JSON.parse(json); });
  }

  // ---------------------------------------------------------------- columns
  var KIND_OF_TYPE = { number: 'n', datetime: 't', date: 't', boolean: 'b' };

  function Column(meta, data, index) {
    this.id = meta.id;
    this.label = meta.label || meta.id;
    this.type = meta.type || 'text';
    this.group = meta.group || null;
    this.description = meta.description || null;
    this.hidden = !!meta.hidden;
    this.key = !!meta.key;
    // Whether the record drawer lists the column (a key hidden in the grid is left out by the schema).
    this.drawer = meta.drawer !== false;
    this.width = meta.width || null;
    // Layout intent for a host grid that fits its columns (priority, pinned, rowHeader, minWidth, maxWidth, fixed,
    // flex, autoSize), in the grid's wire names. The built-in viewport ignores it.
    this.layout = meta.layout || null;
    this.format = meta.format || null;
    // A link column whose values are link text names the column of each row's address (ReportDatasetColumn.Link(string)).
    this.linkTarget = meta.linkTarget || null;
    this.tones = meta.tones || null;
    // Tones shown as plain muted text (ReportDatasetColumn.QuietTones): tokens success, neutral and info.
    this.quiet = meta.quiet || null;
    this.local = !!meta.local;
    this.seconds = !!meta.seconds;
    this.index = index;
    data = data || {};
    if (data.d) { this.kind = 'd'; this.dict = data.d; this.idx = data.i; }
    else if (data.s) { this.kind = 's'; this.values = data.s; }
    else if (data.n) { this.kind = 'n'; this.values = data.n; }
    else if (data.t) { this.kind = 't'; this.values = data.t; }
    else if (data.b) { this.kind = 'b'; this.values = data.b; }
    else {
      // A column described before any of its rows arrived takes the storage of its type; a text column takes the
      // storage of the first chunk appended to it.
      this.kind = KIND_OF_TYPE[this.type] || 's';
      this.values = [];
      // Only a category keeps one dictionary across chunks, as its values repeat; free text stays plain text.
      this.open = this.kind === 's' && this.type === 'category';
    }
    this._lower = null;
  }
  Column.prototype.isNumeric = function () { return this.kind === 'n' || this.kind === 't'; };
  Column.prototype.isDate = function () { return this.kind === 't'; };
  Column.prototype.raw = function (r) {
    switch (this.kind) {
      case 'd': var i = this.idx[r]; return i === undefined || i < 0 ? null : this.dict[i];
      case 'b': var b = this.values[r]; return b === null || b === undefined ? null : b === 1;
      default: var v = this.values[r]; return v === undefined ? null : v;
    }
  };
  // Writes a value as raw() returns it (used when rows arrive page by page and are kept by position).
  Column.prototype.store = function (r, value) {
    if (this.kind === 'd') return;
    this.values[r] = value === null || value === undefined ? null : this.kind === 'b' ? (value ? 1 : 0) : value;
  };
  // Appends the rows of one chunk (the same column-by-column format as a whole dataset).
  Column.prototype.append = function (data, count) {
    data = data || {};
    var r, x, self = this;
    if (this.open && !this.values.length) {
      this.open = false;
      if (data.d) { this.kind = 'd'; this.dict = []; this.idx = []; this.values = undefined; this._index = dict(); }
    }
    if (this.kind === 'd') {
      if (!this._index) { this._index = dict(); for (r = 0; r < this.dict.length; r++) this._index[this.dict[r]] = r; }
      var intern = function (text) {
        var at = self._index[text];
        if (at === undefined) { at = self.dict.length; self.dict.push(text); self._index[text] = at; }
        return at;
      };
      if (data.d) {
        var map = data.d.map(intern);
        for (r = 0; r < count; r++) { x = data.i[r]; this.idx.push(x === undefined || x < 0 ? -1 : map[x]); }
      } else {
        var texts = data.s || [];
        for (r = 0; r < count; r++) { x = texts[r]; this.idx.push(x === null || x === undefined ? -1 : intern(String(x))); }
      }
    } else if (this.kind === 's') {
      if (data.d) for (r = 0; r < count; r++) { x = data.i[r]; this.values.push(x === undefined || x < 0 ? null : data.d[x]); }
      else { var s = data.s || []; for (r = 0; r < count; r++) this.values.push(s[r] === undefined ? null : s[r]); }
    } else {
      var src = data.n || data.t || data.b || [];
      for (r = 0; r < count; r++) this.values.push(src[r] === undefined ? null : src[r]);
    }
    this._lower = null;
  };
  Column.prototype.textOf = function (value, mode) {
    if (value === null || value === undefined) return '';
    switch (this.kind) {
      case 'n': return formatNumber(value);
      case 't': return formatDate(value, this.type, mode, mode === 'export' ? this.local : this.showsLocal(), this.seconds);
      case 'b': return value ? 'Yes' : 'No';
      default: return String(value);
    }
  };
  Column.prototype.text = function (r, mode) { return this.textOf(this.raw(r), mode); };
  // Whether the column is shown in the reader's time zone right now. Exports keep the column's declared zone.
  Column.prototype.showsLocal = function () { return this.local && !readerWantsUtc(); };
  // Lower-cased display text, cached once per column (dictionary entries or per row).
  Column.prototype.lower = function (r) {
    if (!this._lower) {
      var self = this;
      if (this.kind === 'd') this._lower = this.dict.map(fold);
      else { this._lower = new Array(this.values.length); for (var i = 0; i < this.values.length; i++) this._lower[i] = fold(self.text(i, 'display')); }
    }
    if (this.kind === 'd') { var i2 = this.idx[r]; return i2 < 0 ? '' : this._lower[i2]; }
    return this._lower[r];
  };
  Column.prototype.tone = function (value) {
    if (!this.tones || value === null || value === undefined) return null;
    var s = this.textOf(value, 'export');
    if (Object.prototype.hasOwnProperty.call(this.tones, s)) return this.tones[s];
    var lower = s.toLowerCase();
    for (var k in this.tones) if (Object.prototype.hasOwnProperty.call(this.tones, k) && k.toLowerCase() === lower) return this.tones[k];
    return null;
  };
  Column.prototype.parse = function (text) {
    if (text === null || text === undefined) return null;
    var s = String(text).trim();
    if (!s) return null;
    if (this.kind === 'n') { var n = parseNumber(s); return isNaN(n) ? s : n; }
    if (this.kind === 't') { var t = parseDateText(s, this.type, this.showsLocal()); return isNaN(t) ? s : t; }
    if (this.kind === 'b') {
      var l = s.toLowerCase();
      if (l === 'true' || l === 'yes' || l === '1' || l === 'y') return true;
      if (l === 'false' || l === 'no' || l === '0' || l === 'n') return false;
      return s;
    }
    return s;
  };
  // Distinct values of the given rows with their counts: most frequent first, equal counts in code unit order.
  Column.prototype.distinct = function (rows) {
    var counts = dict(), order = [];
    for (var i = 0; i < rows.length; i++) {
      var v = this.text(rows[i], 'export');
      if (!v) continue;
      if (!counts[v]) { counts[v] = 0; order.push(v); }
      counts[v] += 1;
    }
    order.sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : a > b ? 1 : 0); });
    return order.map(function (v) { return { value: v, count: counts[v] }; });
  };

  // --------------------------------------------------------------- datasets
  function Dataset(payload) {
    var self = this;
    this.id = payload.id;
    this.title = payload.title || payload.id;
    this.rows = payload.data ? (payload.rows || 0) : 0;
    this.columns = (payload.columns || []).map(function (meta, i) { return new Column(meta, (payload.data || [])[i], i); });
    this.byId = dict();
    this.columns.forEach(function (c) { self.byId[c.id.toLowerCase()] = c; });
    this.keyColumn = this.columns.filter(function (c) { return c.key; })[0] || null;
    this._lookups = dict();
  }
  Dataset.prototype.column = function (id) { return id ? this.byId[String(id).toLowerCase()] || null : null; };
  // Adds the rows of one chunk: { rows: n, data: [one entry per column] }.
  Dataset.prototype.append = function (chunk) {
    var count = (chunk && chunk.rows) || 0, data = (chunk && chunk.data) || [];
    for (var i = 0; i < this.columns.length; i++) this.columns[i].append(data[i], count);
    this.rows += count;
    this._lookups = dict();
  };
  // Rows whose column value equals text (case-insensitive), via a lazily built index. With a separator, a cell holding
  // several keys ("a@x; b@x") matches each of them.
  Dataset.prototype.lookup = function (columnId, text, separator) {
    var col = this.column(columnId);
    if (!col) return [];
    var cacheKey = col.id + (separator ? '|' + separator : '');
    var map = this._lookups[cacheKey];
    if (!map) {
      map = dict();
      for (var r = 0; r < this.rows; r++) {
        var k = col.text(r, 'display');
        if (!k) continue;
        var keys = separator ? k.split(separator) : [k];
        for (var i = 0; i < keys.length; i++) {
          var key = fold(keys[i].trim());
          if (!key) continue;
          var list = map[key] || (map[key] = []);
          if (list[list.length - 1] !== r) list.push(r);
        }
      }
      this._lookups[cacheKey] = map;
    }
    return map[fold(String(text || '').trim())] || [];
  };

  // ---------------------------------------------------------------- filters
  var OPS = {
    '=': 'eq', '==': 'eq', 'eq': 'eq', 'equals': 'eq', 'is': 'eq', 'equalto': 'eq',
    '!=': 'ne', '<>': 'ne', 'ne': 'ne', 'neq': 'ne', 'not-equals': 'ne', 'is-not': 'ne', 'notequalto': 'ne',
    'in': 'in', 'any-of': 'in', 'not-in': 'nin', 'nin': 'nin', 'none-of': 'nin', 'notin': 'nin',
    'contains': 'contains', 'like': 'contains', 'not-contains': 'ncontains', 'ncontains': 'ncontains', 'not-like': 'ncontains', 'notcontains': 'ncontains',
    'contains-token': 'token', 'containstoken': 'token',
    '<': 'lt', 'lt': 'lt', 'lessthan': 'lt', '<=': 'le', 'le': 'le', 'lte': 'le', 'lessthanorequal': 'le',
    '>': 'gt', 'gt': 'gt', 'greaterthan': 'gt', '>=': 'ge', 'ge': 'ge', 'gte': 'ge', 'greaterthanorequal': 'ge',
    'empty': 'empty', 'is-empty': 'empty', 'null': 'empty', 'isempty': 'empty',
    'not-empty': 'nempty', 'is-not-empty': 'nempty', 'not-null': 'nempty', 'isnotempty': 'nempty',
    'next-days': 'next', 'within-next-days': 'next', 'withinnextdays': 'next',
    'last-days': 'last', 'within-last-days': 'last', 'withinlastdays': 'last',
    'before-now': 'past', 'past': 'past', 'beforenow': 'past', 'after-now': 'future', 'future': 'future', 'afternow': 'future',
    'older-than-days': 'older', 'older-than': 'older', 'olderthandays': 'older'
  };
  var OP_TOKENS = { eq: '=', ne: '!=', 'in': 'in', nin: 'not-in', contains: 'contains', token: 'contains-token', ncontains: 'not-contains', lt: '<', le: '<=', gt: '>', ge: '>=', empty: 'empty', nempty: 'not-empty', next: 'next-days', last: 'last-days', past: 'before-now', future: 'after-now', older: 'older-than-days' };
  var DAY = 86400000;

  function normOp(op) { return OPS[String(op || '=').toLowerCase()] || 'eq'; }

  function compare(a, b) {
    if (typeof a !== typeof b) return NaN;
    if (typeof a === 'number') return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'boolean') return a === b ? 0 : (a ? 1 : -1);
    var x = fold(a), y = fold(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function buildPredicate(ds, filter, now) {
    var col = ds.column(filter.column);
    if (!col) return function () { return true; };
    var op = normOp(filter.op);
    var values = (filter.values || (filter.value !== undefined ? [filter.value] : [])).map(String);
    var operands = values.map(function (v) { return col.parse(v); });
    var first = operands.length ? operands[0] : null;
    var lowered = values.map(fold);
    var days = values.length ? parseNumber(values[0].trim()) : NaN;
    // Date columns are calendar dates: relative filters compare with today's date rather than this instant.
    var ref = col.type === 'date' ? todayAsDate(now) : now;
    function none() { return false; }
    function eqAny(v) { for (var i = 0; i < operands.length; i++) if (operands[i] !== null && compare(v, operands[i]) === 0) return true; return false; }
    function containsAny(r) { var t = col.lower(r); for (var i = 0; i < lowered.length; i++) if (t.indexOf(lowered[i]) >= 0) return true; return false; }
    switch (op) {
      case 'eq': case 'in': return function (r) { var v = col.raw(r); return v !== null && eqAny(v); };
      case 'ne': case 'nin': return function (r) { var v = col.raw(r); return v === null || !eqAny(v); };
      case 'contains': return function (r) { return col.raw(r) !== null && containsAny(r); };
      case 'token': return function (r) { return values.length === 2 && values[1] && col.raw(r) !== null &&
        String(col.raw(r)).split(values[1]).some(function (part) { return fold(part.trim()) === fold(values[0].trim()); }); };
      case 'ncontains': return function (r) { return col.raw(r) === null || !containsAny(r); };
      case 'lt': return function (r) { var v = col.raw(r); return v !== null && first !== null && compare(v, first) < 0; };
      case 'le': return function (r) { var v = col.raw(r); return v !== null && first !== null && compare(v, first) <= 0; };
      case 'gt': return function (r) { var v = col.raw(r); return v !== null && first !== null && compare(v, first) > 0; };
      case 'ge': return function (r) { var v = col.raw(r); return v !== null && first !== null && compare(v, first) >= 0; };
      case 'empty': return function (r) { return col.raw(r) === null; };
      case 'nempty': return function (r) { return col.raw(r) !== null; };
      case 'next': return isNaN(days) ? none : function (r) { var v = col.raw(r); return typeof v === 'number' && v >= ref && v <= ref + days * DAY; };
      case 'last': return isNaN(days) ? none : function (r) { var v = col.raw(r); return typeof v === 'number' && v <= ref && v >= ref - days * DAY; };
      case 'older': return isNaN(days) ? none : function (r) { var v = col.raw(r); return typeof v === 'number' && v < ref - days * DAY; };
      case 'past': return function (r) { var v = col.raw(r); return typeof v === 'number' && v < ref; };
      case 'future': return function (r) { var v = col.raw(r); return typeof v === 'number' && v > ref; };
    }
    return function () { return true; };
  }

  // ------------------------------------------------------------------ query
  // Rows matching a query in result order: filters, search over the query's search columns (its columns, or all
  // visible columns, when none are listed), sort with empty values last and a stable tie order, then the row limit.
  // Same evaluation as ReportQueryEngine.
  function runQuery(ds, spec, now) {
    var keyValues = null, selected = null;
    if (spec.keys !== undefined) {
      if (!Array.isArray(spec.keys) || spec.keys.some(function (key) { return typeof key !== 'string' || !key.trim(); })) throw fail('key', 'Row identities must be nonempty text.');
      selected = new Set(spec.keys);
    }
    if (spec.stableKeyOrder || selected) {
      if (!ds.keyColumn || !/^(text|category)$/.test(ds.keyColumn.type)) throw fail('key', 'Row-key selection and stable ordering require a declared text key.');
      var seenKeys = new Set(); keyValues = [];
      for (var row = 0; row < ds.rows; row++) {
        var id = ds.keyColumn.raw(row);
        if (typeof id !== 'string' || !id.trim() || seenKeys.has(id)) throw fail('key', 'Stable keys must be nonempty and unique.');
        seenKeys.add(id); keyValues.push(id);
      }
      if (selected) selected.forEach(function (key) { if (!seenKeys.has(key)) throw fail('key', 'A selected row identity is absent from this dataset.'); });
    }
    var stableKeys = spec.stableKeyOrder ? keyValues : null;
    var preds = (spec.filters || []).map(function (f) { return buildPredicate(ds, f, now); });
    var term = fold((spec.search || '').trim());
    var ids = spec.searchIn && spec.searchIn.length ? spec.searchIn
      : spec.columns && spec.columns.length ? spec.columns : ds.columns.filter(function (c) { return !c.hidden; }).map(function (c) { return c.id; });
    var searchCols = ids.map(function (id) { return ds.column(id); }).filter(Boolean);
    var out = [];
    for (var r = 0; r < ds.rows; r++) {
      var ok = !selected || selected.has(keyValues[r]);
      if (ok) for (var p = 0; p < preds.length; p++) if (!preds[p](r)) { ok = false; break; }
      if (ok && term) {
        ok = false;
        for (var c = 0; c < searchCols.length; c++) if (searchCols[c].lower(r).indexOf(term) >= 0) { ok = true; break; }
      }
      if (ok) out.push(r);
    }
    var sort = spec.sort || [];
    if (sort.length || stableKeys) {
      var keys = sort.map(function (s) { return { col: ds.column(s.column), desc: !!s.descending }; }).filter(function (k) { return k.col; });
      var pos = new Int32Array(ds.rows);
      for (var i = 0; i < out.length; i++) pos[out[i]] = i;
      out.sort(function (a, b) {
        for (var k = 0; k < keys.length; k++) {
          var va = keys[k].col.raw(a), vb = keys[k].col.raw(b);
          if (va === null && vb === null) continue;
          if (va === null) return 1;
          if (vb === null) return -1;
          var res = compare(va, vb);
          if (res !== 0 && !isNaN(res)) return keys[k].desc ? -res : res;
        }
        return stableKeys ? (stableKeys[a] < stableKeys[b] ? -1 : stableKeys[a] > stableKeys[b] ? 1 : 0) : pos[a] - pos[b];
      });
    }
    if (spec.limit > 0 && out.length > spec.limit) out.length = spec.limit;
    return out;
  }

  var FACET_LIMIT = 12, CURSOR = 'o:';

  // One page of a query, as a dataset endpoint answers it: the rows of the page by index, how many rows matched,
  // the cursor of the next page and the value counts the query asked for. Same evaluation as ReportQueryEngine.
  function queryPage(ds, spec, now) {
    var all = runQuery(ds, { filters: spec.filters, search: spec.search, searchIn: spec.searchIn, columns: spec.columns, sort: spec.sort, stableKeyOrder: spec.stableKeyOrder, keys: spec.keys }, now);
    var start = spec.offset > 0 ? spec.offset : 0;
    if (spec.after) {
      // The same grammar as ReportQueryEngine: the prefix and plain digits.
      var match = /^o:(\d{1,10})$/.exec(String(spec.after));
      if (!match || Number(match[1]) > 2147483647) throw fail('cursor', 'The cursor is not one this dataset returned.');
      start = Number(match[1]);
    }
    start = Math.min(start, all.length);
    var take = spec.limit === null || spec.limit === undefined || spec.limit < 0 ? all.length - start : Math.min(spec.limit, all.length - start);
    var facets = (spec.facets || []).map(function (f) {
      var id = typeof f === 'string' ? f : f.column, limit = (typeof f === 'object' && f.limit > 0) ? f.limit : FACET_LIMIT;
      var col = ds.column(id);
      if (!col) throw fail('column', 'Unknown facet column "' + id + '".');
      var values = col.distinct(all);
      return { column: col.id, values: values.slice(0, limit), truncated: values.length > limit };
    });
    return {
      total: all.length, offset: start, rows: all.slice(start, start + take),
      next: start + take < all.length ? CURSOR + (start + take) : null, facets: facets
    };
  }

  // ------------------------------------------------------------------- csv
  function guardFormula(text) { return /^[=+\-@\t\r]/.test(text) ? "'" + text : text; }
  function csvField(text, separator) { return text.indexOf(separator || ',') >= 0 || /["\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; }
  function headerOf(col, labels) { return labels && Object.prototype.hasOwnProperty.call(labels, col.id) && labels[col.id] ? String(labels[col.id]) : col.label; }
  function csvLines(cols, rows, separator) {
    separator = separator || ',';
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], line = new Array(cols.length);
      for (var j = 0; j < cols.length; j++) {
        var c = cols[j], t = c.text(r, 'export');
        line[j] = csvField(c.type === 'text' || c.type === 'category' ? guardFormula(t) : t, separator);
      }
      out.push(line.join(separator));
    }
    return out;
  }
  function csvHeader(cols, labels, separator) { return cols.map(function (c) { return csvField(guardFormula(headerOf(c, labels)), separator); }).join(separator || ','); }
  function toCsv(cols, rows, labels) { return [csvHeader(cols, labels)].concat(csvLines(cols, rows)).join('\r\n') + '\r\n'; }

  // ---------------------------------------------------------------- sources
  function findDatasetNode(id) {
    var nodes = qsa(document, 'script[data-hfx-dataset]');
    for (var i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-hfx-dataset') === id) return nodes[i];
    return null;
  }

  // Hosted reports name one endpoint for datasets that are not described in the page, with {id} as the placeholder.
  function endpointFor(id) {
    var shell = document.querySelector('[data-hfx-data-endpoint]');
    var template = shell && shell.getAttribute('data-hfx-data-endpoint');
    return template ? template.replace(/\{id\}/g, function () { return encodeURIComponent(id); }) : null;
  }

  // Sidecar chunks are script files next to the page. Each calls HfxData.register(id, chunk, document), which also
  // works when the report is opened from the file system or under an injected base address, where fetch does not.
  var waiting = dict(), arrived = dict();
  function chunkKey(id, chunk) { return id + '\u0000' + chunk; }
  function register(id, chunk, doc) {
    var key = chunkKey(id, chunk), waiter = waiting[key];
    if (waiter) { delete waiting[key]; waiter(doc); }
    else arrived[key] = doc;
  }
  function loadChunk(id, chunk, src) {
    return new Promise(function (resolve, reject) {
      var key = chunkKey(id, chunk);
      if (arrived[key]) { var doc = arrived[key]; delete arrived[key]; resolve(doc); return; }
      var script = document.createElement('script');
      function done() { delete waiting[key]; if (script.parentNode) script.parentNode.removeChild(script); }
      waiting[key] = function (d) { done(); resolve(d); };
      script.src = src;
      script.onload = function () {
        if (!waiting[key]) return;
        done();
        reject(fail('missing', 'Part ' + (chunk + 1) + ' of dataset "' + id + '" was not found in ' + src + '.'));
      };
      script.onerror = function () {
        done();
        reject(fail('network', 'Part ' + (chunk + 1) + ' of dataset "' + id + '" could not be loaded from ' + src + '.', { retryable: true }));
      };
      document.head.appendChild(script);
    });
  }

  var RETRIES = 2, RETRY_STATUS = { 408: true, 429: true, 502: true, 503: true, 504: true }, GET_LIMIT = 1500;

  function wait(ms, signal) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { if (signal) signal.removeEventListener('abort', stop); resolve(); }, ms);
      function stop() { clearTimeout(timer); reject(fail('aborted', 'The request was cancelled.', { name: 'AbortError' })); }
      if (signal) { if (signal.aborted) stop(); else signal.addEventListener('abort', stop); }
    });
  }
  function isAbort(err) { return !!err && (err.name === 'AbortError' || err.code === 'aborted'); }

  // The query as a dataset endpoint reads it (ReportQueryJson): canonical operator tokens, operands as text.
  function wireQuery(spec, dataset) {
    var q = {};
    if (spec.stableKeyOrder) q.stableKeyOrder = true;
    if (spec.keys !== undefined) q.keys = spec.keys.slice();
    if (dataset) {
      q.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      q.displayUtc = readerWantsUtc();
    }
    if (spec.columns && spec.columns.length) q.columns = spec.columns.slice();
    if (spec.searchIn && spec.searchIn.length) q.searchIn = spec.searchIn.slice();
    if (spec.filters && spec.filters.length) {
      q.filters = spec.filters.map(function (f) {
        var op = normOp(f.op), column = dataset && dataset.column(f.column);
        var values = (f.values || (f.value !== undefined ? [f.value] : [])).map(String);
        if (column && column.type === 'datetime' && /^(eq|ne|in|nin|gt|ge|lt|le)$/.test(op)) {
          values = values.map(function (value) {
            var instant = parseDateText(value.trim(), column.type, column.showsLocal());
            return isNaN(instant) ? value : new Date(instant).toISOString();
          });
        }
        return { column: f.column, op: OP_TOKENS[op], values: values };
      });
    }
    if (spec.sort && spec.sort.length) q.sort = spec.sort.map(function (s) { return s.descending ? { column: s.column, descending: true } : { column: s.column }; });
    if (spec.search && String(spec.search).trim()) q.search = String(spec.search);
    if (spec.after) q.after = String(spec.after);
    if (spec.offset > 0) q.offset = spec.offset;
    if (spec.limit !== null && spec.limit !== undefined && spec.limit >= 0) q.limit = spec.limit;
    if (spec.facets && spec.facets.length) {
      q.facets = spec.facets.map(function (f) { return typeof f === 'string' ? { column: f, limit: FACET_LIMIT } : { column: f.column, limit: f.limit > 0 ? f.limit : FACET_LIMIT }; });
    }
    return q;
  }

  // Asks the endpoint for one page. A short query travels in the address (GET), a long one
  // in the body. Failures that are likely to pass (the network, 408, 429, 502, 503, 504) are tried again twice, after
  // the pause the server names or a growing one; the caller's signal cancels the request and the pauses.
  function fetchPage(href, spec, signal, dataset) {
    var body = JSON.stringify(wireQuery(spec, dataset)), attempt = 0;
    var queryUrl = href + (href.indexOf('?') < 0 ? '?' : '&') + 'q=' + encodeURIComponent(body);
    function once() {
      var get = queryUrl.length <= GET_LIMIT;
      var url = get ? queryUrl : href;
      var init = { method: get ? 'GET' : 'POST', credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
      if (signal) init.signal = signal;
      if (!get) { init.headers['Content-Type'] = 'application/json'; init.body = body; }
      return fetch(url, init).then(function (response) {
        if (response.ok) return response.json();
        return response.text().then(function (text) {
          var message = '', again = true;
          try {
            var parsed = JSON.parse(text);
            message = (parsed && (parsed.message || parsed.error)) || '';
            // A dataset endpoint says when asking again cannot help (a query that ran past its time limit).
            if (parsed && parsed.retry === false) again = false;
          } catch (_) { }
          var after = Number(response.headers.get('Retry-After'));
          throw fail('http', message ? String(message) : 'The server answered ' + response.status + '.', {
            status: response.status, retryable: again && RETRY_STATUS[response.status] === true, retryAfter: after > 0 ? Math.min(after, 10) * 1000 : 0
          });
        });
      }, function (err) {
        if (isAbort(err)) throw err;
        throw fail('network', 'The server could not be reached.', { retryable: true });
      });
    }
    function run() {
      return once().then(null, function (err) {
        if (isAbort(err) || !err.retryable || attempt >= RETRIES) throw err;
        attempt += 1;
        return wait(err.retryAfter || 300 * Math.pow(2, attempt - 1), signal).then(run);
      });
    }
    return run();
  }

  function facetMap(list) {
    var map = dict();
    (list || []).forEach(function (f) { map[String(f.column).toLowerCase()] = { values: f.values || [], truncated: !!f.truncated }; });
    return map;
  }

  function Source(id) {
    this.id = id;
    this.node = findDatasetNode(id);
    this.meta = null;
    this.href = null;
    this.pageSize = 200;
    var node = this.node, kind = node ? node.getAttribute('data-hfx-dataset-source') : null;
    if (node && (kind === 'sidecar' || kind === 'remote')) {
      try { this.meta = JSON.parse(node.textContent || '{}'); } catch (_) { this.meta = {}; }
    }
    if (kind === 'remote') this.href = node.getAttribute('data-hfx-dataset-href');
    if (!node) { this.href = endpointFor(id); kind = this.href ? 'remote' : 'missing'; }
    this.kind = kind || 'inline';
    if (this.meta && this.meta.pageSize > 0) this.pageSize = this.meta.pageSize;
    this.rows = node ? Number(node.getAttribute('data-hfx-dataset-rows')) || 0 : 0;
    this.loaded = 0;
    this._load = null;
    this._progress = [];
    this._schema = null;
    this._partial = null;
  }

  // The whole dataset, for sources whose rows can be held by the page. Sidecar chunks load one after the other and
  // onProgress(loadedRows, totalRows) is told after each; a failed load can be started again and continues with the
  // chunk that failed.
  Source.prototype.load = function (onProgress) {
    var self = this;
    // Every component that waits for the rows is told the progress, not only the first one that asked.
    if (onProgress && this._progress.indexOf(onProgress) < 0) this._progress.push(onProgress);
    if (this._load) return this._load;
    if (this.kind === 'remote') return Promise.reject(fail('remote', 'Dataset "' + this.id + '" is queried from its endpoint; it is not loaded as a whole.'));
    if (this.kind === 'missing') return Promise.reject(fail('missing', 'Dataset "' + this.id + '" is not embedded in this page.'));
    var work;
    if (this.kind === 'sidecar') {
      var chunks = (this.meta && this.meta.chunks) || [];
      var ds = this._partial || (this._partial = { dataset: new Dataset({ id: this.id, title: this.meta.title, columns: this.meta.columns }), next: 0 });
      var step = function () {
        if (ds.next >= chunks.length) return ds.dataset;
        var at = ds.next;
        return loadChunk(self.id, at, chunks[at].src)
          .then(function (doc) { return decode(doc.encoding || 'json', doc.payload); })
          .then(function (chunk) {
            ds.dataset.append(chunk);
            ds.next = at + 1;
            self.loaded = ds.dataset.rows;
            self._progress.forEach(function (listener) { try { listener(self.loaded, self.rows); } catch (_) { } });
            return step();
          });
      };
      work = Promise.resolve().then(step);
    } else {
      work = decode(this.node.getAttribute('data-hfx-dataset-encoding') || 'json', this.node.textContent || '').then(function (payload) { return new Dataset(payload); });
    }
    this._load = work.then(function (dataset) { self.rows = dataset.rows; self.loaded = dataset.rows; self._progress = []; return dataset; }, function (err) { self._load = null; throw err; });
    return this._load;
  };

  // The columns of the dataset without rows: from the description in the page, or from the endpoint.
  Source.prototype.schema = function (signal) {
    var self = this;
    function fresh(meta) {
      if (signal && signal.aborted) throw fail('aborted', 'The request was cancelled.', { name: 'AbortError' });
      return new Dataset(meta);
    }
    if (this.kind !== 'remote') return this.load();
    if (this._schema) return this._schema.then(fresh);
    var work;
    if (this.meta && this.meta.columns) work = Promise.resolve({ id: this.id, title: this.meta.title, columns: this.meta.columns });
    else if (this.kind === 'remote') {
      // Metadata is shared; cancelling one explorer must not cancel another explorer's schema load.
      work = fetchPage(this.href, { limit: 0 }).then(function (doc) {
        if (doc.total > self.rows) self.rows = doc.total;
        return { id: self.id, title: doc.title, columns: doc.schema || doc.columns || [] };
      });
    } else work = this.load();
    this._schema = work.then(null, function (err) { self._schema = null; throw err; });
    return this._schema.then(fresh);
  };

  // One page of a query: { total, offset, count, next, facets, truncated, dataset } where dataset holds the rows of
  // the page (row 0 is the first row of the page). options.signal cancels; options.now is the reference time of
  // relative date filters for sources evaluated in the page.
  Source.prototype.query = function (spec, options) {
    spec = spec || {};
    var self = this, signal = options && options.signal;
    if (this.kind === 'remote') {
      return this.schema(signal).then(function (dataset) { return fetchPage(self.href, spec, signal, dataset); }).then(function (doc) {
        return {
          total: doc.total || 0, offset: doc.offset || 0, count: doc.rows || 0, next: doc.next || null, truncated: !!doc.truncated,
          facets: facetMap(doc.facets), dataset: new Dataset({ id: self.id, rows: doc.rows || 0, columns: doc.columns || [], data: doc.data || [] })
        };
      });
    }
    return this.load().then(function (ds) {
      if (signal && signal.aborted) throw fail('aborted', 'The request was cancelled.', { name: 'AbortError' });
      var page = queryPage(ds, spec, (options && options.now) || Date.now());
      var ids = spec.columns && spec.columns.length ? spec.columns : ds.columns.filter(function (c) { return !c.hidden; }).map(function (c) { return c.id; });
      var cols = ids.map(function (id) { return ds.column(id); }).filter(Boolean);
      var part = new Dataset({ id: ds.id, title: ds.title, columns: cols.map(metaOf) });
      cols.forEach(function (c, i) { for (var r = 0; r < page.rows.length; r++) part.columns[i].store(r, c.raw(page.rows[r])); });
      part.rows = page.rows.length;
      return { total: page.total, offset: page.offset, count: page.rows.length, next: page.next, truncated: false, facets: facetMap(page.facets), dataset: part };
    });
  };

  function metaOf(c) {
    return { id: c.id, label: c.label, type: c.type, group: c.group, description: c.description, hidden: c.hidden, key: c.key, drawer: c.drawer, width: c.width, layout: c.layout, format: c.format, linkTarget: c.linkTarget, tones: c.tones, quiet: c.quiet, local: c.local, seconds: c.seconds };
  }

  var sources = dict();
  function source(id) { return sources[id] || (sources[id] = new Source(id)); }

  window.HfxData = {
    register: register,
    source: source,
    // The whole dataset of an inline or sidecar source.
    loadDataset: function (id, onProgress) { return source(id).load(onProgress); },
    isAbort: isAbort,
    toCsv: toCsv,
    internals: {
      Dataset: Dataset, Column: Column, buildPredicate: buildPredicate, runQuery: runQuery, queryPage: queryPage, wireQuery: wireQuery,
      formatNumber: formatNumber, parseNumber: parseNumber, normOp: normOp, OP_TOKENS: OP_TOKENS, toCsv: toCsv, csvHeader: csvHeader, csvLines: csvLines,
      headerOf: headerOf, dict: dict, fold: fold
    }
  };
  for (var q = 0; q < early.length; q++) register(early[q][0], early[q][1], early[q][2]);
})();
