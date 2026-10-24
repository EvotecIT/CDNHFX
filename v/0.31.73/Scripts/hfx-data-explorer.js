// HtmlForgeX data explorer: virtual grid, views, filters, record drawer and exports over a dataset of the data runtime.
(function () {
  if (window.HfxDataExplorer) return;

  // ------------------------------------------------------------------ utils
  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function closest(el, sel) { try { return el && el.closest ? el.closest(sel) : null; } catch (_) { return null; } }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function attr(n, name, value) { n.setAttribute(name, value); return n; }
  // A column tone is a severity token, or a status (an operational state, or an outcome with its severity) written as
  // the attributes a status chip of the report views carries, so a value looks the same here as everywhere else.
  function toneAttrs(n, tone) {
    if (typeof tone === 'string') return attr(n, 'data-sev', tone);
    if (tone.state) return attr(n, 'data-state', tone.state);
    if (tone.outcome) attr(n, 'data-outcome', tone.outcome);
    if (tone.severity) attr(n, 'data-severity', tone.severity);
    return n;
  }
  function fmt(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, function (m, k) { return values && values[k] !== undefined ? values[k] : m; });
  }
  // Only http, https, mailto and file addresses (including relative paths) become links. The address is resolved
  // exactly as the browser would resolve it, so tabs, newlines or control characters cannot disguise a script URL.
  var LINK_PROTOCOLS = { 'http:': true, 'https:': true, 'mailto:': true, 'file:': true };
  function safeHref(value) {
    var s = String(value || '').trim();
    if (!s) return null;
    try {
      var url = new URL(s, document.baseURI || location.href);
      return LINK_PROTOCOLS[url.protocol] === true ? url.href : null;
    } catch (_) { return null; }
  }
  // Explorer rows that name a page element open it through the assessment report when one is on the page.
  var MAX_ROW_TARGETS = 500;
  // An assessment report opens its checks first (also ones kept in a closed chapter); a target that is a report entity
  // ("type/key", the address the report gives an entity, which no element of the page carries as its id) opens in the
  // report's drawer, stepping through the neighbouring rows' entities.
  function openPageTarget(ids, index, from, returnFocus) {
    var api = window.hfxAssessment;
    if (api && typeof api.openTargets === 'function' && api.openTargets(ids, index, from)) return true;
    var report = window.hfxReport;
    if (report && typeof report.openEntities === 'function' && typeof report.isEntityId === 'function' && report.isEntityId(ids[index])) {
      var entities = ids.filter(function (id) { return report.isEntityId(id); });
      if (report.openEntities(entities, entities.indexOf(ids[index]), returnFocus || from)) return true;
    }
    if (api && typeof api.openTargets === 'function') return false;
    if (report && typeof report.reveal === 'function' && document.getElementById(ids[index])) return report.reveal(ids[index]);
    var el = document.getElementById(ids[index]);
    if (!el) return false;
    el.scrollIntoView({ block: 'start' });
    return true;
  }
  // A link to an address. Without a label the text is the address's last path segment; with one (a link-text column)
  // the label is the text. An address that is a report entity opens the entity's panel in the report's drawer, as an
  // entity link does, instead of handing the bare fragment to the browser.
  function linkNode(value, label) {
    var href = safeHref(value);
    var named = label !== undefined && label !== null && String(label) !== '';
    if (!href) return document.createTextNode(String(named ? label : value || ''));
    var a = document.createElement('a');
    var shown = String(value).trim();
    a.href = href;
    a.className = 'hfx-dx-link';
    a.textContent = named ? String(label) : shown.split(/[\\/]/).pop() || shown;
    a.title = shown;
    var report = window.hfxReport;
    var entity = report && typeof report.entityFromHref === 'function' ? report.entityFromHref(shown) : null;
    if (entity) attr(a, 'data-hfx-dx-entity', entity);
    a.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!entity || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (report.openEntities([entity], 0, a)) e.preventDefault();
    });
    return a;
  }
  function num(n) { try { return Number(n).toLocaleString(); } catch (_) { return String(n); } }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dict() { return Object.create(null); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function storageGet(key) { try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (_) { return null; } }
  function storageSet(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) { } }
  var uid = 0;
  function nextId(prefix) { uid += 1; return prefix + '-' + uid; }

  // The data runtime (hfx-data.js) owns datasets, the query engine and where rows live; the explorer draws them.
  var Data = window.HfxData;
  if (!Data || !Data.source) { try { console.error('HtmlForgeX data explorer: hfx-data.js is not loaded.'); } catch (_) { } return; }
  var I = Data.internals;
  var viewportRenderers = dict();
  var normOp = I.normOp, OP_TOKENS = I.OP_TOKENS, runQuery = I.runQuery, headerOf = I.headerOf, toCsv = I.toCsv;

  // ---------------------------------------------------------------- filters
  // English words; a report writes its own as labels.operators (DataExplorerLabels.FilterWords, ReportFilterLabels).
  var OP_LABELS = { eq: 'is', ne: 'is not', 'in': 'is any of', nin: 'is none of', contains: 'contains', ncontains: 'does not contain', token: 'contains', startsWith: 'starts with', lt: '<', le: '≤', gt: '>', ge: '≥', empty: 'is empty', nempty: 'is not empty', next: 'in the next {days} days', last: 'in the last {days} days', past: 'is in the past', future: 'is in the future', older: 'older than {days} days' };
  function opWord(labels, op) {
    var words = labels && labels.operators, word = words && typeof words[op] === 'string' ? words[op] : OP_LABELS[op];
    return word == null ? op : word;
  }

  function opsFor(col) {
    if (col.kind === 't') return ['lt', 'le', 'gt', 'ge', 'next', 'last', 'older', 'past', 'future', 'empty', 'nempty'];
    if (col.kind === 'n') return ['eq', 'ne', 'lt', 'le', 'gt', 'ge', 'empty', 'nempty'];
    if (col.kind === 'b') return ['eq', 'empty', 'nempty'];
    return ['eq', 'ne', 'in', 'nin', 'contains', 'ncontains', 'empty', 'nempty'];
  }
  function needsValue(op) { return ['empty', 'nempty', 'past', 'future'].indexOf(op) < 0; }

  // Yes/no values in the report's words (labels.yes and labels.no, ReportFilterLabels.Yes/No). Only what the reader sees
  // changes: filters, exports and the search keep matching the stored values (Yes, No, true, false…).
  var TRUE_TEXTS = ['true', 'yes', '1', 'y'], FALSE_TEXTS = ['false', 'no', '0', 'n'];
  function booleanWord(labels, text) {
    var lower = String(text == null ? '' : text).trim().toLowerCase();
    if (TRUE_TEXTS.indexOf(lower) >= 0) return (labels && labels.yes) || 'Yes';
    if (FALSE_TEXTS.indexOf(lower) >= 0) return (labels && labels.no) || 'No';
    return text;
  }
  function valueText(labels, col, value, mode) {
    if (col.kind === 'b' && value !== null && value !== undefined) return value ? (labels && labels.yes) || 'Yes' : (labels && labels.no) || 'No';
    return col.textOf(value, mode);
  }
  // Thresholds paint the number itself; their explanation belongs to the tooltip and record details.
  function numericText(node, column, value, text, details) {
    if (column.type !== 'number' || !column.numericTones.length) return false;
    var rule = column.numericTone(value);
    var number = el('span', 'hfx-dx-number-tone', text); node.appendChild(number);
    if (!rule) return true;
    toneAttrs(number, rule.tone);
    attr(node, 'title', text + (rule.label ? ' — ' + rule.label : ''));
    if (details && rule.label) node.appendChild(el('span', 'hfx-dx-threshold-label', ' — ' + rule.label));
    return true;
  }

  function describeFilter(ds, f, labels) {
    var col = ds.column(f.column);
    var op = normOp(f.op);
    var values = f.values || [];
    if (col && col.kind === 'b') values = values.map(function (v) { return booleanWord(labels, v); });
    else if (col && col.type === 'category') values = values.map(function (v) { return col.textOf(col.parse(v), 'display'); });
    var label = col ? col.label : f.column, word = opWord(labels, op);
    if (!needsValue(op)) return label + ' ' + word;
    if (op === 'next' || op === 'last' || op === 'older') return label + ' ' + word.replace('{days}', values[0] || '?');
    if (op === 'token') return label + ' ' + word + ' ' + (values[0] || '');
    return label + ' ' + word + ' ' + values.join(', ');
  }
  function removeFilterLabel(labels, text) { return (labels && labels.removeFilter || 'Remove filter: {filter}').replace('{filter}', text); }

  // --------------------------------------------------------------- explorer
  var instances = {};
  var MAX_CANVAS = 8000000;
  // Widest a column grows from its content; wider values show a tooltip. Code and addresses get more room.
  var MAX_WIDTH = { text: 360, category: 280, number: 160, datetime: 170, date: 130, boolean: 120 };
  var WIDE_WIDTH = 480, MIN_WIDTH = 56, SAMPLE_ROWS = 400, CELL_PAD = 20, CHIP_PAD = 26;
  var measureContext;

  function textWidth(text, font) {
    if (measureContext === undefined) {
      var canvas = document.createElement('canvas');
      measureContext = canvas.getContext ? canvas.getContext('2d') : null;
    }
    if (!measureContext) return text.length * 7;
    measureContext.font = font;
    return measureContext.measureText(text).width;
  }

  function Explorer(root) {
    this.root = root;
    var node = root.querySelector('script[data-hfx-dx-config]');
    this.cfg = node ? JSON.parse(node.textContent || '{}') : {};
    this.labels = this.cfg.labels || {};
    this.id = this.cfg.id || root.id || nextId('hfx-dx');
    // A synchronous same-ID replacement can register before the removal observer runs. Retire its detached
    // predecessor before replacing the registry entry; connected moves retain their existing owner.
    var predecessor = instances[this.id];
    if (predecessor && predecessor.root !== root && !predecessor.root.isConnected) predecessor.destroy();
    this.rowHeight = this.cfg.density === 'comfortable' ? 38 : 31;
    this.views = this.cfg.views || [];
    this.storageKey = 'hfx-dx:' + (location.pathname || '') + ':' + this.id;
    var stored = this.cfg.savedViews ? storageGet(this.storageKey) : null;
    this.saved = Array.isArray(stored) ? stored.filter(function (v) { return v && typeof v === 'object' && typeof v.id === 'string'; }) : [];
    this.state = null;
    this.order = [];
    this.active = -1;
    this.drawerRow = -1;
    this.loaded = false;
    this.pending = null;
    // A remote dataset is drawn from pages of rows kept by their position in the result.
    this.remote = null;
    this.total = 0;
    this.seq = 0;
    this.pages = dict();
    this.cursors = dict();
    this.facets = dict();
    this.inflight = 0;
    this.pendingDrawer = -1;
    this.inShellDrawer = false;
    instances[this.id] = this;
    root.hfxDataExplorer = this;
    this.watch();
  }

  Explorer.prototype.watch = function () {
    var self = this;
    if (typeof IntersectionObserver === 'undefined') { this.load(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) { io.disconnect(); self.load(); return; }
    }, { rootMargin: '300px' });
    this.visibilityObserver = io;
    io.observe(this.root);
  };

  // The status line above the grid: loading progress, or an error with an action that tries again.
  Explorer.prototype.setStatus = function (text, isError, retry) {
    var s = this.root.querySelector('[data-hfx-dx-status]');
    if (!s) { s = el('p', 'hfx-dx-status'); attr(s, 'data-hfx-dx-status', '1'); attr(s, 'role', 'status'); var body = this.root.querySelector('[data-hfx-dx-body]'); body.insertBefore(s, body.firstChild); }
    s.textContent = text;
    s.classList.toggle('is-error', !!isError);
    s.hidden = !text;
    if (text && retry) {
      var again = el('button', 'hfx-dx-btn hfx-dx-retry', this.labels.retry || 'Try again'); attr(again, 'type', 'button');
      again.addEventListener('click', retry);
      s.appendChild(document.createTextNode(' '));
      s.appendChild(again);
    }
  };

  Explorer.prototype.errorText = function (err) {
    if (err && err.code === 'unsupported') return this.labels.unsupported;
    var reason = String((err && err.message) || err || '');
    return this.labels.loadError ? fmt(this.labels.loadError, { reason: reason }).trim() : reason;
  };

  Explorer.prototype.load = function () {
    if (this.destroyed) return Promise.resolve();
    if (this.loading) return this.loading;
    var self = this, labels = this.labels;
    var src = this.source = Data.source(this.cfg.dataset);
    this.failed = false;
    function ready(ds) {
      if (self.destroyed) return;
      self.ds = ds;
      self.build();
      var initial = self.views.filter(function (v) { return v.default; })[0] || self.views[0] || null;
      self.applyView(initial, true, !!self.pending);
      if (self.pending) { var p = self.pending; self.pending = null; self.apply(p); }
      self.loaded = true;
      self.root.dispatchEvent(new CustomEvent('hfx-dx:ready', { bubbles: true, detail: { id: self.id } }));
      return self.remote ? self.queryLoading : null;
    }
    function failed(err) {
      if (self.destroyed) return;
      // A failed load is not repeated on its own; the reader decides.
      self.loading = null;
      self.failed = true;
      self.setStatus(self.errorText(err), true, function () {
        self.setStatus(fmt(labels.loading, { rows: num(src.rows || self.cfg.rows || 0) }));
        self.load();
      });
    }
    if (src.kind === 'remote') {
      // The server holds the rows: the grid needs only the columns to start, then asks for pages.
      this.remote = src;
      if (!src.rows && this.cfg.rows) src.rows = this.cfg.rows;
      this.loading = src.schema().then(ready).then(null, failed);
    } else {
      this.loading = src.load(function (loaded, rows) {
        if (self.destroyed) return;
        if (rows > loaded) self.setStatus(fmt(labels.loadingProgress || labels.loading, { loaded: num(loaded), rows: num(rows) }));
      }).then(ready).then(null, failed);
    }
    return this.loading;
  };

  // ---- state
  Explorer.prototype.defaultColumns = function () {
    return this.ds.columns.filter(function (c) { return !c.hidden; }).map(function (c) { return c.id; });
  };

  Explorer.prototype.applyView = function (view, initial, deferRefresh) {
    if (this.ds && this.ds.rowIdentity === 'ordinal' && view && (view.keys !== undefined || view.stableKeyOrder)) throw new Error('Ordinal snapshot identity cannot replay saved selections or stable-key ordering across reports.');
    var ds = this.ds;
    var cols = (view && view.columns && view.columns.length ? view.columns : this.defaultColumns()).filter(function (id) { return ds.column(id); });
    this.state = {
      view: view ? view.id : null,
      columns: cols.map(function (id) { return ds.column(id).id; }),
      keys: view && view.keys !== undefined ? view.keys.slice() : undefined,
      filters: (view && view.filters || []).map(function (f) { return { column: f.column, op: f.op, values: (f.values || []).slice(), fromView: true }; }),
      sort: (view && view.sort || []).map(function (s) { return { column: s.column, descending: !!s.descending }; }),
      search: view && view.search || '',
      searchIn: view && view.searchIn ? view.searchIn.slice() : undefined,
      stableKeyOrder: !!(view && view.stableKeyOrder),
      labels: (view && view.labels) ? JSON.parse(JSON.stringify(view.labels)) : {},
      limit: view && view.limit > 0 ? view.limit : 0,
      quick: dict()
    };
    var search = this.root.querySelector('[data-hfx-dx-search]');
    if (search) search.value = this.state.search;
    this.renderViews();
    if (!deferRefresh) this.refresh(!initial);
  };

  Explorer.prototype.apply = function (spec) {
    if (this.ds && this.ds.rowIdentity === 'ordinal' && spec.keys !== undefined) throw new Error('Ordinal snapshot identity cannot replay selected keys across reports.');
    if (!this.ds) { this.pending = spec; this.load(); return; }
    var view = null;
    if (spec.view) {
      view = this.views.filter(function (v) { return v.id === spec.view; })[0] || this.saved.filter(function (v) { return v.id === spec.view; })[0] || null;
    }
    this.applyView(view || this.currentView(), false, true);
    if (spec.filters) {
      var self = this;
      spec.filters.forEach(function (f) { self.state.filters.push({ column: f.column, op: f.op || '=', values: [].concat(f.values !== undefined ? f.values : (f.value !== undefined ? [f.value] : [])).map(String) }); });
    }
    if (spec.search !== undefined) { this.state.search = spec.search; var s = this.root.querySelector('[data-hfx-dx-search]'); if (s) s.value = spec.search; }
    if (spec.keys !== undefined) this.state.keys = spec.keys.slice();
    this.refresh(true);
  };

  // Whether the reader selected values of a quick filter column.
  Explorer.prototype.hasQuick = function (colId) {
    var set = this.state.quick[colId];
    return !!set && Object.keys(set).some(function (k) { return set[k]; });
  };

  // The query the grid shows: the filters of the view and the reader, the quick filter selections (without the one
  // of skipQuick), the search and the sort.
  Explorer.prototype.querySpec = function (skipQuick, skipExternal) {
    var st = this.state;
    var filters = st.filters.map(function (f) { return { column: f.column, op: f.op, values: f.values }; });
    // Filters other components apply through linked views (setExternalFilter) narrow the rows too, outside saved views.
    if (!skipExternal) this.externalFilters().forEach(function (f) { filters.push({ column: f.column, op: 'in', values: f.values }); });
    Object.keys(st.quick).forEach(function (colId) {
      if (colId === skipQuick) return;
      var set = st.quick[colId];
      var vals = Object.keys(set).filter(function (k) { return set[k]; });
      if (vals.length) filters.push({ column: colId, op: 'in', values: vals });
    });
    return { filters: filters, search: st.search, searchIn: st.searchIn, columns: st.columns, sort: st.sort, limit: st.limit,
      stableKeyOrder: !!(this.cfg.stableKeyOrder || st.stableKeyOrder), keys: st.keys };
  };

  Explorer.prototype.compute = function () {
    this.queryTime = this.referenceTime(); this.order = runQuery(this.ds, this.querySpec(), this.queryTime);
    this.acceptExportQuery(this.querySpec(), this.queryTime);
  };

  // Rows in the current result, the row at a position of it (-1 while a remote page has not arrived), and back.
  Explorer.prototype.size = function () { return this.remote ? this.total : this.order.length; };
  Explorer.prototype.rowAt = function (i) { return this.remote ? (this.pageLoaded(i) ? i : -1) : this.order[i]; };
  Explorer.prototype.indexOfRow = function (r) { return this.remote ? r : this.order.indexOf(r); };

  Explorer.prototype.refresh = function (notify) {
    if (this.destroyed) return;
    if (this.remote) { this.refreshRemote(notify); return; }
    this.compute();
    this.draw(notify);
  };

  Explorer.prototype.draw = function (notify) {
    this.refreshViewCounts();
    if (this.renderer) {
      this.renderQuick(); this.renderChips(); this.updateCount();
      this.active = this.size() ? 0 : -1; this.renderer.update();
      if (notify) this.root.dispatchEvent(new CustomEvent('hfx-dx:change', { bubbles: true, detail: this.definition() }));
      return;
    }
    this.renderHeader();
    this.renderQuick();
    this.renderChips();
    this.updateCount();
    var total = this.size() * this.rowHeight;
    this.scale = total > MAX_CANVAS ? total / MAX_CANVAS : 1;
    this.canvas.style.height = Math.round(total / this.scale) + 'px';
    this.viewport.scrollTop = 0;
    this.active = this.size() ? 0 : -1;
    this.pool.forEach(function (row) { row.el.hidden = true; row.r = -2; });
    this.renderRows(true);
    this.renderEmpty();
    if (notify) {
      try { this.root.dispatchEvent(new CustomEvent('hfx-dx:change', { bubbles: true, detail: this.definition() })); } catch (_) { }
    }
  };

  // ---- remote datasets
  // A remote dataset is never held as a whole. The grid keeps the pages around the rows on screen, by their position
  // in the result, and asks the endpoint for the others as the reader scrolls. Every change of filters, search or
  // sort cancels what is still on its way and starts again from the first page.
  var PAGE_CACHE = 40, PAGE_REQUESTS = 4, QUICK_VALUES = 12, EXPORT_PAGE = 1000;

  Explorer.prototype.pageOf = function (i) { return Math.floor(i / this.pageSize); };
  Explorer.prototype.pageLoaded = function (i) { return this.pages[this.pageOf(i)] === 'loaded'; };
  Explorer.prototype.pageLimit = function (p) {
    var size = this.pageSize, limit = this.state.limit;
    return limit > 0 ? Math.max(0, Math.min(size, limit - p * size)) : size;
  };

  // Every column is asked for, so the record drawer has the whole row; preserve the view's explicit search scope,
  // or the visible columns it would search in a dataset held by the page.
  Explorer.prototype.remoteSpec = function (skipQuick) {
    var spec = this.querySpec(skipQuick);
    if (!(spec.searchIn && spec.searchIn.length)) spec.searchIn = spec.columns.slice();
    spec.columns = this.ds.columns.map(function (c) { return c.id; });
    delete spec.limit;
    return spec;
  };

  Explorer.prototype.setBusy = function (busy) {
    if (!this.viewport) return;
    attr(this.viewport, 'aria-busy', busy ? 'true' : 'false');
    this.root.classList.toggle('is-busy', !!busy);
    if (busy) { this.count.textContent = this.labels.updating || '…'; this.count.setAttribute('data-short', '…'); }
  };

  // One explorer submits its rows and optional counts in order, leaving room in the host's caller gate.
  // A superseded queued request never reaches the endpoint; an active request retains its slot until it settles.
  Explorer.prototype.queryRemote = function (query, options) {
    var self = this;
    options = options || {};
    var pending = (this.remoteQueue || Promise.resolve()).then(function () {
      if (self.destroyed || (options.signal && options.signal.aborted)) {
        var error = new Error('The query was cancelled.'); error.name = 'AbortError'; throw error;
      }
      return self.remote.query(query, options);
    });
    this.remoteQueue = pending.then(function () {}, function () {});
    return pending;
  };

  Explorer.prototype.refreshRemote = function (notify) {
    var self = this, ds = this.ds;
    this.seq += 1;
    var seq = this.seq;
    this.failedQuery = false;
    if (this.abort) { try { this.abort.abort(); } catch (_) { } }
    this.abort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var options = { signal: this.abort ? this.abort.signal : undefined };
    this.pages = dict();
    this.cursors = dict();
    this.inflight = 0;
    this.pendingDrawer = -1;
    this.sizeChanged = false;
    this.refetched = dict();
    // Each query starts from the page size the page asks for; a server that caps it lower is adopted per explorer.
    this.pageSize = this.remote.pageSize;
    ds.columns.forEach(function (c) { c.values = []; c._lower = null; });
    this.renderChips();
    this.setStatus('');
    this.setBusy(true);

    var quick = (this.cfg.quick || []).map(function (id) { return ds.column(id); }).filter(Boolean);
    var exportSpec = JSON.parse(JSON.stringify(this.querySpec())), exportTime = this.referenceTime();
    this.queryTime = exportTime;
    var spec = this.remoteSpec();
    spec.offset = 0;
    spec.limit = this.pageLimit(0);
    // The values of a quick filter are counted over the rows the other filters leave, so each chip shows what
    // clicking it would keep: a column with a selection of its own is counted by a query without that selection.
    // Counts travel in their own requests: a server that will not count a column of a large table (it rejects the
    // facet as too expensive) leaves those chips out, and the rows still arrive.
    var facetJobs = [], counted = quick.filter(function (c) { return !self.hasQuick(c.id); });
    function counts(query) { facetJobs.push(query); }
    if (counted.length) {
      var shared = this.remoteSpec();
      shared.limit = 0;
      shared.facets = counted.map(function (c) { return { column: c.id, limit: QUICK_VALUES }; });
      counts(shared);
    }
    quick.filter(function (c) { return self.hasQuick(c.id); }).forEach(function (c) {
      var own = self.remoteSpec(c.id);
      own.limit = 0;
      own.facets = [{ column: c.id, limit: QUICK_VALUES }];
      counts(own);
    });

    // The rows are drawn as soon as they arrive; the counts fill the chips when they come.
    this.facets = dict();
    this.queryLoading = this.queryRemote(spec, options).then(function (first) {
      if (seq !== self.seq) return;
      // A server with a smaller page size cap answers with fewer rows and a cursor: this grid adopts its page size.
      if (first.count > 0 && first.count < spec.limit && first.next) self.pageSize = first.count;
      self.total = self.state.limit > 0 ? Math.min(self.state.limit, first.total) : first.total;
      self.failedQuery = false;
      self.storePage(0, first);
      self.sizeChanged = false;
      self.setBusy(false);
      self.loadedQuery = seq;
      self.acceptExportQuery(exportSpec, exportTime);
      self.draw(notify);
    }, function (err) {
      if (seq !== self.seq || Data.isAbort(err)) return;
      self.total = 0;
      self.facets = dict();
      self.failedQuery = true;
      self.setBusy(false);
      self.draw(false);
      self.setStatus(self.errorText(err), true, function () { self.refresh(false); });
    });
    facetJobs.forEach(function (query) {
      self.queryRemote(query, options).then(function (res) {
        if (seq !== self.seq || !res.facets) return;
        Object.keys(res.facets).forEach(function (k) { self.facets[k] = res.facets[k].values; });
        if (self.loadedQuery === seq) self.renderQuick();
      }, function () { /* Optional counts may be refused while the rows remain usable. */ });
    });
  };

  Explorer.prototype.storePage = function (p, res) {
    var ds = this.ds, base = p * this.pageSize;
    res.dataset.columns.forEach(function (c) {
      var target = ds.column(c.id);
      if (!target) return;
      for (var r = 0; r < res.count; r++) target.store(base + r, c.raw(r));
    });
    if (p > 0 && res.next && res.count < this.pageLimit(p) && !this.refetched[p]) {
      // A page that continued from a cursor came back short while more rows follow (rows were removed since the page
      // before it). It is asked for once more by its position, so no row of the grid stays blank.
      this.refetched[p] = true;
      delete this.cursors[p];
      delete this.pages[p];
      return;
    }
    this.pages[p] = 'loaded';
    // The cursor of a page continues after its last row: the next page costs the same however deep it is.
    if (res.next) this.cursors[p + 1] = res.next;
    // Live data can shrink between two pages: a page that ends the result early ends the grid there.
    else if (base + res.count < this.total) { this.total = base + res.count; this.sizeChanged = true; }
    this.evictPages(p);
  };

  // Keeps the pages nearest to the one just loaded; the rows of the others are dropped and asked for again if the
  // reader comes back to them.
  Explorer.prototype.evictPages = function (near) {
    var self = this, size = this.pageSize;
    var loaded = Object.keys(this.pages).filter(function (k) { return self.pages[k] === 'loaded'; }).map(Number);
    if (loaded.length <= PAGE_CACHE) return;
    loaded.sort(function (a, b) { return Math.abs(b - near) - Math.abs(a - near); });
    loaded.slice(0, loaded.length - PAGE_CACHE).forEach(function (p) {
      delete self.pages[p];
      self.ds.columns.forEach(function (c) { for (var r = p * size; r < (p + 1) * size; r++) delete c.values[r]; });
    });
  };

  Explorer.prototype.ensurePage = function (p) {
    var self = this, seq = this.seq;
    // A resize can redraw the old viewport while a replacement query's first page is still pending.
    // Wait for that page to establish the new result before requesting any viewport pages.
    if (this.loadedQuery !== seq) return;
    if (p < 0 || this.pages[p] || p * this.pageSize >= this.total) return;
    // A fast scroll passes many pages; only a few are asked for at once, and the rows on screen ask again.
    if (this.inflight >= PAGE_REQUESTS) return;
    this.pages[p] = 'loading';
    this.inflight += 1;
    var spec = this.remoteSpec();
    spec.limit = this.pageLimit(p);
    spec.offset = p * this.pageSize;
    if (this.cursors[p]) spec.after = this.cursors[p];
    this.queryRemote(spec, { signal: this.abort ? this.abort.signal : undefined }).then(function (res) {
      if (seq !== self.seq) return;
      self.inflight -= 1;
      self.storePage(p, res);
      // The error of another page stays until the reader tries again.
      if (!self.hasFailedPages()) self.setStatus('');
      if (self.sizeChanged) { self.sizeChanged = false; self.resize(); }
      self.renderRows(true);
      if (self.pendingDrawer >= 0 && self.pageLoaded(self.pendingDrawer)) { var i = self.pendingDrawer; self.pendingDrawer = -1; self.openDrawer(i); }
    }, function (err) {
      if (seq !== self.seq || Data.isAbort(err)) return;
      self.inflight -= 1;
      // The page stays marked, so scrolling does not ask for it again and again; the reader tries again.
      self.pages[p] = 'failed';
      self.setStatus(self.errorText(err), true, function () {
        Object.keys(self.pages).forEach(function (k) { if (self.pages[k] === 'failed') delete self.pages[k]; });
        self.setStatus('');
        self.renderRows(true);
      });
      // Rows on screen that waited for a free request ask now.
      self.renderRows(false);
    });
  };

  Explorer.prototype.hasFailedPages = function () {
    var pages = this.pages;
    return Object.keys(pages).some(function (k) { return pages[k] === 'failed'; });
  };

  // FitToViewport: the grid reaches down to the bottom of the window when it starts in the first screen of the page, and
  // takes the window's height less the explorer's own toolbar further down, within the configured bounds. The rule for
  // the first screen is the one the report layout uses to fit its lists (hfx-report-layout.js): 20 px above the window's
  // bottom. A hidden explorer keeps its height until it is shown.
  var FIT_GAP = 20;
  Explorer.prototype.fitViewport = function () {
    var fit = this.cfg.fitViewport, body = this.root && this.root.querySelector('[data-hfx-dx-body]');
    if (!fit || !body) return false;
    // The explorer's own toolbar changes height after the first measure (quick views and filter chips arrive, a host grid
    // takes the search into its toolbar): the grid is fitted again where it then starts.
    if (!this.fitObserver && typeof ResizeObserver !== 'undefined') {
      var self = this, toolbar = this.root.querySelector('[data-hfx-dx-toolbar]');
      try {
        this.fitObserver = new ResizeObserver(function () { requestAnimationFrame(function () { if (!self.destroyed) self.fitViewport(); }); });
        if (toolbar) this.fitObserver.observe(toolbar);
      } catch (_) { this.fitObserver = null; }
    }
    if (!body.getClientRects().length) return false;
    var scroll = window.pageYOffset || 0, top = body.getBoundingClientRect().top + scroll;
    var chrome = top - (this.root.getBoundingClientRect().top + scroll);
    var room = top < window.innerHeight ? window.innerHeight - top - FIT_GAP : window.innerHeight - chrome - 2 * FIT_GAP;
    var height = Math.round(Math.max(fit.min, Math.min(fit.max, room)));
    if (height === this.cfg.height) return false;
    this.cfg.height = height;
    body.style.setProperty('--dx-height', height + 'px');
    if (this.renderer) this.renderer.repaint();
    else if (this.viewport) this.renderRows(false);
    return true;
  };
  // The height of the grid follows the number of rows without moving the reader.
  Explorer.prototype.resize = function () {
    if (this.renderer) { this.updateCount(); this.renderer.repaint(); return; }
    var total = this.size() * this.rowHeight;
    this.scale = total > MAX_CANVAS ? total / MAX_CANVAS : 1;
    this.canvas.style.height = Math.round(total / this.scale) + 'px';
    attr(this.viewport, 'aria-rowcount', String(this.size() + 1));
    if (this.active >= this.size()) this.active = this.size() - 1;
    this.updateCount();
  };

  Explorer.prototype.currentView = function () {
    var id = this.state && this.state.view;
    if (!id) return null;
    return this.views.filter(function (v) { return v.id === id; })[0] || this.saved.filter(function (v) { return v.id === id; })[0] || null;
  };

  // True when filters, quick filters or a search narrow the view beyond what the view itself defines.
  Explorer.prototype.isNarrowed = function () {
    var st = this.state, view = this.currentView();
    if (st.filters.some(function (f) { return !f.fromView; })) return true;
    if ((st.search || '') !== ((view && view.search) || '')) return true;
    return Object.keys(st.quick).some(function (k) { var set = st.quick[k]; return set && Object.keys(set).some(function (v) { return set[v]; }); });
  };

  Explorer.prototype.renderEmpty = function () {
    if (this.renderer) return;
    var box = this.empty, self = this;
    box.textContent = '';
    // After a failed query the status line says what happened; 'no rows' would be wrong.
    box.hidden = this.size() > 0 || (!!this.remote && !!this.failedQuery);
    if (box.hidden) return;
    box.style.maxWidth = (this.viewport.clientWidth || 600) + 'px';
    var narrowed = this.isNarrowed();
    box.appendChild(el('p', 'hfx-dx-empty-text', narrowed ? (this.labels.emptyFiltered || this.labels.empty) : this.labels.empty));
    if (narrowed) {
      var clear = el('button', 'hfx-dx-btn', this.labels.clearFilters || 'Clear filters'); attr(clear, 'type', 'button');
      clear.addEventListener('click', function () { self.clearFilters(); });
      box.appendChild(clear);
    }
  };

  // Drops filters, quick filters and search added on top of the current view; the view's own definition stays.
  Explorer.prototype.clearFilters = function () {
    var st = this.state, view = this.currentView();
    if (this.renderer && this.renderer.clearFilters) this.renderer.clearFilters();
    st.filters = st.filters.filter(function (f) { return f.fromView; });
    st.quick = dict();
    st.search = (view && view.search) || '';
    var search = this.root.querySelector('[data-hfx-dx-search]');
    if (search) search.value = st.search;
    this.refresh(true);
  };

  Explorer.prototype.visibleColumns = function () {
    var ds = this.ds;
    return this.state.columns.map(function (id) { return ds.column(id); }).filter(Boolean);
  };

  Explorer.prototype.definition = function (forSavedView) {
    var st = this.state, ds = this.ds;
    // Saved UI views keep local operands editable; exported definitions use the same portable query as the endpoint.
    var spec = this.querySpec(undefined, true, forSavedView);
    if (this.renderer && this.renderer.definition) spec = this.renderer.definition(spec);
    var def = I.wireQuery(spec, forSavedView ? null : ds);
    def.name = (this.cfg.definitionName ? this.cfg.definitionName + '-' : '') + (st.view || 'custom');
    def.dataset = ds.id;
    if (!(st.limit > 0)) delete def.limit;
    var labels = {}, anyLabel = false;
    st.columns.forEach(function (id) { var l = st.labels && Object.prototype.hasOwnProperty.call(st.labels, id) ? st.labels[id] : null; if (l) { labels[id] = String(l); anyLabel = true; } });
    if (anyLabel) def.labels = labels;
    var extras = this.cfg.definitionExtras || {};
    Object.keys(extras).forEach(function (k) { if (def[k] === undefined) def[k] = extras[k]; });
    var title = (this.views.concat(this.saved).filter(function (v) { return v.id === st.view; })[0] || {}).title;
    if (title) def.title = title;
    return def;
  };

  // ---- DOM
  Explorer.prototype.build = function () {
    var self = this, labels = this.labels, root = this.root;
    root.classList.add('is-ready');
    var toolbar = root.querySelector('[data-hfx-dx-toolbar]');
    toolbar.textContent = '';

    var viewsBar = el('div', 'hfx-dx-views');
    attr(viewsBar, 'role', 'tablist');
    attr(viewsBar, 'aria-label', (this.cfg.title || this.ds.title) + ' views');
    this.viewsBar = viewsBar;
    toolbar.appendChild(viewsBar);

    var phoneView = el('div', 'hfx-dx-phone-view');
    var phoneLabel = el('label', null, (labels.view || 'View') + ':');
    var viewSelect = el('select', 'hfx-dx-input');
    viewSelect.id = nextId('hfx-dx-phone-view'); attr(phoneLabel, 'for', viewSelect.id); phoneView.appendChild(phoneLabel);
    attr(viewSelect, 'aria-label', labels.view || 'View');
    viewSelect.addEventListener('change', function () {
      var view = self.views.concat(self.saved).filter(function (v) { return v.id === viewSelect.value; })[0];
      if (view) self.applyView(view, false);
    });
    phoneView.appendChild(viewSelect);
    var removeView = el('button', 'hfx-dx-btn is-quiet', '×'); attr(removeView, 'type', 'button'); removeView.hidden = true;
    removeView.addEventListener('click', function () { self.removeSavedView(viewSelect.value); });
    phoneView.appendChild(removeView); this.phoneRemoveView = removeView;
    this.phoneView = phoneView; this.viewSelect = viewSelect;
    toolbar.appendChild(phoneView);

    var tools = el('div', 'hfx-dx-tools');
    if (this.cfg.search !== false) {
      var label = el('label', 'hfx-dx-search');
      var sr = el('span', 'visually-hidden', labels.search); label.appendChild(sr);
      var input = el('input'); attr(input, 'type', 'search'); attr(input, 'placeholder', labels.search); attr(input, 'data-hfx-dx-search', '1'); attr(input, 'autocomplete', 'off');
      // The pause before a search runs grows with the data: a small dataset answers while the reader types, a large
      // one waits for a break in the typing so it does not search on every key.
      // A remote dataset answers over the network: it waits longest, so a word is one request, not one per letter.
      var rows = this.remote ? this.remote.rows : this.ds.rows;
      var pause = this.remote ? 250 : rows <= 20000 ? 40 : rows <= 200000 ? 90 : 160;
      input.addEventListener('input', debounce(function () { self.state.search = input.value; self.refresh(true); }, pause));
      label.appendChild(input);
      tools.appendChild(label);
    }
    this.count = el('span', 'hfx-dx-count'); attr(this.count, 'aria-live', 'polite');
    tools.appendChild(this.count);
    var actions = el('div', 'hfx-dx-actions');
    if (!this.cfg.viewportRenderer) {
      actions.appendChild(this.menuButton(labels.filters, 'filters', function (panel) { self.renderFilterPanel(panel); }));
      actions.appendChild(this.menuButton(labels.columns, 'columns', function (panel) { self.renderColumnPanel(panel); }));
    }
    var exports = this.cfg.exports || [];
    if (exports.length || this.cfg.officeIMOExports || this.hostFormats().length) actions.appendChild(this.menuButton(labels['export'], 'export', function (panel) { self.renderExportPanel(panel); }));
    if (this.cfg.savedViews) actions.appendChild(this.menuButton(labels.saveView, 'save', function (panel) { self.renderSavePanel(panel); }));
    var reset = el('button', 'hfx-dx-btn is-quiet', labels.reset); attr(reset, 'type', 'button'); attr(reset, 'data-hfx-dx-reset', '1');
    reset.addEventListener('click', function () { self.applyView(self.currentView(), false); });
    var actionPair = el('div', 'hfx-dx-action-pair');
    if (actions.lastElementChild) actionPair.appendChild(actions.lastElementChild);
    actionPair.appendChild(reset); actions.appendChild(actionPair);
    tools.appendChild(actions);
    toolbar.appendChild(tools);

    this.quickBar = el('div', 'hfx-dx-quick');
    toolbar.appendChild(this.quickBar);
    this.chipBar = el('div', 'hfx-dx-chips');
    toolbar.appendChild(this.chipBar);

    var body = root.querySelector('[data-hfx-dx-body]');
    var status = body.querySelector('[data-hfx-dx-status]');
    if (status) status.hidden = true;
    var renderer = this.cfg.viewportRenderer && viewportRenderers[this.cfg.viewportRenderer];
    if (this.cfg.viewportRenderer && !renderer) throw new Error('HtmlForgeX: the configured viewport renderer is not registered.');
    // A grid fitted to the window takes its height before the viewport is drawn at it.
    this.fitViewport();
    if (renderer) { this.renderer = renderer(this, body); this.viewport = this.renderer.element; }
    else {
    var viewport = el('div', 'hfx-dx-viewport');
    attr(viewport, 'role', 'grid');
    attr(viewport, 'tabindex', '0');
    attr(viewport, 'aria-label', this.cfg.title || this.ds.title);
    var inner = el('div', 'hfx-dx-inner');
    var head = el('div', 'hfx-dx-row hfx-dx-headrow'); attr(head, 'role', 'row'); attr(head, 'aria-rowindex', '1');
    var canvas = el('div', 'hfx-dx-canvas'); attr(canvas, 'role', 'rowgroup');
    inner.appendChild(head); inner.appendChild(canvas);
    viewport.appendChild(inner);
    body.appendChild(viewport);
    this.empty = el('div', 'hfx-dx-empty'); attr(this.empty, 'role', 'status'); this.empty.hidden = true;
    inner.appendChild(this.empty);
    this.viewport = viewport; this.inner = inner; this.head = head; this.canvas = canvas; this.pool = [];
    body.style.setProperty('--dx-row', this.rowHeight + 'px');

    var onScroll = function () { if (self.raf) return; self.raf = requestAnimationFrame(function () { self.raf = 0; self.renderRows(false); }); };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    viewport.addEventListener('keydown', function (e) { self.onKey(e); });
    // Only cut values get a tooltip, checked when pointed at because rows are recycled while scrolling.
    canvas.addEventListener('mouseover', function (e) {
      var cell = closest(e.target, '.hfx-dx-cell');
      if (!cell || cell.hasAttribute('title')) return;
      var inner = cell.firstElementChild;
      if (cell.scrollWidth > cell.clientWidth + 1 || (inner && inner.scrollWidth > inner.clientWidth + 1)) attr(cell, 'title', cell.textContent);
    });
    canvas.addEventListener('click', function (e) {
      var row = closest(e.target, '[data-r]');
      if (!row) return;
      var r = Number(row.getAttribute('data-r'));
      self.active = self.indexOfRow(r);
      self.renderRows(false);
      self.openRow(self.active, row);
    });
    if (typeof ResizeObserver !== 'undefined') {
      try { this.resizeObserver = new ResizeObserver(function () { self.renderRows(false); }); this.resizeObserver.observe(viewport); } catch (_) { }
    }
    }
    this.outsideClick = function (e) {
      if (self.openMenu && !closest(e.target, '.hfx-dx-menu')) self.closeMenus();
    };
    document.addEventListener('click', this.outsideClick);
  };

  // A host disposing a report also releases its viewport, observers and shared drawer ownership.
  Explorer.prototype.destroy = function () {
    if (this.destroyed) return;
    this.closeDrawer(); this.releaseDrawer(); this.destroyed = true; this.seq++;
    if (this.abort) this.abort.abort();
    if (this.exportAbort) this.exportAbort.abort();
    if (this.visibilityObserver) this.visibilityObserver.disconnect();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.fitObserver) this.fitObserver.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.outsideClick) document.removeEventListener('click', this.outsideClick);
    if (this.unlayerMenus) this.unlayerMenus();
    if (this.renderer) this.renderer.destroy();
    this.renderer = null;
    if (instances[this.id] === this) delete instances[this.id];
    if (this.root.hfxDataExplorer === this) delete this.root.hfxDataExplorer;
    ['[data-hfx-dx-body]', '[data-hfx-dx-toolbar]'].forEach(function (selector) {
      var node = this.root.querySelector(selector); if (node) node.textContent = '';
    }, this);
    this.ds = null; this.order = []; this.pending = null; this.pages = dict();
  };

  Explorer.prototype.menuButton = function (text, key, render) {
    var self = this;
    var wrap = el('div', 'hfx-dx-menu');
    var btn = el('button', 'hfx-dx-btn', text); attr(btn, 'type', 'button'); attr(btn, 'aria-expanded', 'false'); attr(btn, 'aria-haspopup', 'true');
    var panel = el('div', 'hfx-dx-panel'); panel.hidden = true; attr(panel, 'data-hfx-dx-panel', key);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = panel.hidden;
      self.closeMenus();
      if (open) {
        panel.textContent = ''; render(panel);
        // A menu that opens as a phone sheet (data-hfx-dx-sheet) leads with a back action to the menu it came from.
        if (wrap.hasAttribute('data-hfx-dx-sheet')) {
          var head = el('div', 'hfx-dx-sheet-head'), back = el('button', 'hfx-dx-sheet-back');
          attr(back, 'type', 'button');
          attr(back.appendChild(el('span', 'hfx-dx-sheet-back-mark', '\u2039')), 'aria-hidden', 'true');
          back.appendChild(el('span', null, self.labels.back || 'Back'));
          back.addEventListener('click', function (e) { e.stopPropagation(); self.closeMenus(); btn.focus(); });
          head.appendChild(back); head.appendChild(el('h3', 'hfx-dx-sheet-title', text));
          panel.insertBefore(head, panel.firstChild);
        }
        panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); self.openMenu = wrap;
        // CanopyX menus close while an explorer menu is open (canopyx:closemenus); a menu that holds this one (the grid's
        // more menu on a phone) stays open, as CanopyX and the listener below keep the menus around the source.
        dispatchCloseMenus(wrap);
        // A renderer that hosts the menus in a clipping container asks for them in the top layer (hfx-data-explorer.menus.js).
        if (self.layerMenu) self.layerMenu(btn, panel);
        var f = panel.querySelector('input, select, button:not(.hfx-dx-sheet-back)') || panel.querySelector('button'); if (f) f.focus();
      }
    });
    // Escape closes this panel only: a menu that holds the button (a grid's more menu on a phone) stays open.
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); self.closeMenus(); btn.focus(); } });
    wrap.appendChild(btn); wrap.appendChild(panel);
    return wrap;
  };

  // Menus of CanopyX and of the explorers close each other: an opening menu says so with canopyx:closemenus, its own
  // element as detail.source. An explorer menu that holds the source, or sits inside it (Export in the grid's more menu
  // on a phone), stays open.
  function dispatchCloseMenus(source) {
    try { document.dispatchEvent(new CustomEvent('canopyx:closemenus', { detail: { source: source } })); } catch (_) { }
  }
  if (typeof document !== 'undefined') document.addEventListener('canopyx:closemenus', function (e) {
    var source = e.detail && e.detail.source;
    Object.keys(instances).forEach(function (id) {
      var inst = instances[id], open = inst.openMenu;
      if (!open || inst.destroyed || source === open) return;
      if (source && source.nodeType === 1 && (open.contains(source) || source.contains(open))) return;
      inst.closeMenus();
    });
  });

  Explorer.prototype.closeMenus = function () {
    if (this.unlayerMenus) this.unlayerMenus();
    qsa(this.root, '.hfx-dx-panel').forEach(function (p) { p.hidden = true; });
    qsa(this.root, '.hfx-dx-menu > .hfx-dx-btn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    this.openMenu = null;
  };

  Explorer.prototype.renderViews = function () {
    var self = this, bar = this.viewsBar;
    bar.textContent = '';
    var all = this.views.map(function (v) { return { v: v, saved: false }; }).concat(this.saved.map(function (v) { return { v: v, saved: true }; }));
    this.viewSelect.textContent = '';
    this.phoneView.hidden = all.length < 2 && !this.saved.length;
    var selectedSaved = this.saved.filter(function (view) { return view.id === self.state.view; })[0];
    this.phoneRemoveView.hidden = !selectedSaved;
    if (selectedSaved) {
      var removeLabel = fmt(this.labels.removeView || 'Remove {view}', { view: selectedSaved.title });
      attr(this.phoneRemoveView, 'aria-label', removeLabel); attr(this.phoneRemoveView, 'title', removeLabel);
    }
    if (this.phoneView.hidden) { bar.hidden = true; return; }
    bar.hidden = false;
    all.forEach(function (item) {
      var v = item.v, on = v.id === self.state.view;
      var b = el('button', 'hfx-dx-view' + (item.saved ? ' is-saved' : ''), v.title);
      attr(b, 'type', 'button'); attr(b, 'role', 'tab'); attr(b, 'aria-selected', on ? 'true' : 'false');
      var count = self.viewCounts && self.viewCounts[v.id];
      var option = el('option', null, v.title + (count !== undefined ? ' · ' + num(count) : ''));
      option.value = v.id; option.selected = on;
      self.viewSelect.appendChild(option);
      if (count !== undefined) { b.textContent += ' · ' + num(count); attr(b, 'aria-label', v.title); attr(b, 'aria-description', num(count) + ' ' + (self.labels.rows || 'rows')); }
      if (v.description) attr(b, 'title', v.description);
      b.addEventListener('click', function () { self.applyView(v, false); });
      bar.appendChild(b);
      if (item.saved) {
        var x = el('button', 'hfx-dx-view-remove', '×'); attr(x, 'type', 'button'); attr(x, 'aria-label', fmt(self.labels.removeView || 'Remove {view}', { view: v.title }));
        x.addEventListener('click', function () {
          self.removeSavedView(v.id);
        });
        bar.appendChild(x);
      }
    });
  };

  Explorer.prototype.removeSavedView = function (id) {
    this.saved = this.saved.filter(function (view) { return view.id !== id; });
    storageSet(this.storageKey, this.saved);
    if (this.state.view === id) {
      var focus = this.viewSelect.getClientRects().length && (this.views.length > 1 || this.saved.length) ? this.viewSelect : this.root.querySelector('[data-hfx-dx-search]');
      if (!focus) { attr(this.root, 'tabindex', '-1'); focus = this.root; }
      // Set focus before refreshing: a native viewport replacement preserves the invoking search's focus.
      focus.focus();
      this.applyView(this.views.filter(function (view) { return view.default; })[0] || this.views[0] || null, false);
    } else this.renderViews();
  };

  Explorer.prototype.renderQuick = function () {
    var self = this, bar = this.quickBar, ds = this.ds;
    bar.textContent = '';
    var quick = (this.cfg.quick || []).map(function (id) { return ds.column(id); }).filter(Boolean);
    if (!quick.length) { bar.hidden = true; return; }
    bar.hidden = false;
    // Counts reflect the rows left by the other filters so each chip shows what clicking it would keep.
    quick.forEach(function (col) {
      var group = el('div', 'hfx-dx-quick-group');
      attr(group, 'role', 'group'); attr(group, 'aria-label', col.label);
      group.appendChild(el('span', 'hfx-dx-quick-label', col.label));
      var selected = self.state.quick[col.id] || dict();
      self.quickValues(col).forEach(function (d) {
        var on = !!selected[d.value];
        var b = el('button', 'hfx-dx-qchip');
        attr(b, 'type', 'button'); attr(b, 'aria-pressed', on ? 'true' : 'false');
        var tone = col.tone(col.parse(d.value)); if (tone) toneAttrs(b, tone);
        b.appendChild(el('span', 'hfx-dx-qchip-label', col.kind === 'b' ? booleanWord(self.labels, d.value) : col.textOf(col.parse(d.value), 'display')));
        b.appendChild(el('span', 'hfx-dx-qchip-count', num(d.count)));
        b.addEventListener('click', function () {
          var set = self.state.quick[col.id] || (self.state.quick[col.id] = dict());
          set[d.value] = !set[d.value];
          self.refresh(true);
        });
        group.appendChild(b);
      });
      bar.appendChild(group);
    });
  };

  // The most frequent values of a quick filter column among the rows the other filters leave, with their counts.
  // A remote dataset counts them on the server, together with the page.
  Explorer.prototype.quickValues = function (col) {
    if (this.remote) return this.facets[col.id.toLowerCase()] || [];
    var spec = this.querySpec(col.id);
    spec.limit = 0;
    var rows = runQuery(this.ds, spec, this.queryTime === undefined ? this.referenceTime() : this.queryTime);
    return col.distinct(rows).slice(0, QUICK_VALUES);
  };

  Explorer.prototype.renderChips = function () {
    var self = this, bar = this.chipBar, ds = this.ds;
    bar.textContent = '';
    var any = false;
    (this.cfg.contextChips || []).forEach(function (text) {
      any = true;
      bar.appendChild(el('span', 'hfx-dx-fchip is-context', String(text)));
    });
    // A filter another component applied comes first, named after it; removing it tells that component (hfx-dx:externalfilter).
    this.externalFilters().forEach(function (f) {
      any = true;
      var chip = el('span', 'hfx-dx-fchip is-linked'), text = (f.label ? f.label + ': ' : '') + f.values.slice(0, 3).join(', ') + (f.values.length > 3 ? ' +' + (f.values.length - 3) : '');
      chip.appendChild(el('span', null, text));
      var x = el('button', 'hfx-dx-fchip-remove', '×'); attr(x, 'type', 'button'); attr(x, 'aria-label', removeFilterLabel(self.labels, text));
      x.addEventListener('click', function () {
        self.setExternalFilter(f.source, null);
        self.root.dispatchEvent(new CustomEvent('hfx-dx:externalfilter', { bubbles: true, detail: { source: f.source, reason: 'user' } }));
      });
      chip.appendChild(x);
      bar.appendChild(chip);
    });
    this.state.filters.forEach(function (f, i) {
      any = true;
      var chip = el('span', 'hfx-dx-fchip' + (f.fromView ? ' is-view' : ''));
      var text = describeFilter(ds, f, self.labels);
      chip.appendChild(el('span', null, text));
      var x = el('button', 'hfx-dx-fchip-remove', '×'); attr(x, 'type', 'button'); attr(x, 'aria-label', removeFilterLabel(self.labels, text));
      x.addEventListener('click', function () { self.state.filters.splice(i, 1); self.refresh(true); });
      chip.appendChild(x);
      bar.appendChild(chip);
    });
    bar.hidden = !any;
  };

  // ---------------------------------------------------------------- linked views
  // Another component on the page narrows the rows with filters of its own (HtmlForgeX linked views): one entry per source,
  // { column, values, label }, joined with the reader's filters, shown as a chip and left out of saved views.
  Explorer.prototype.externalFilters = function () {
    var out = [], ext = this.external || dict();
    Object.keys(ext).forEach(function (source) { out.push({ source: source, column: ext[source].column, values: ext[source].values, label: ext[source].label }); });
    return out;
  };
  Explorer.prototype.setExternalFilter = function (source, filter) {
    var ext = this.external || (this.external = dict());
    if (filter && filter.column && filter.values && filter.values.length) ext[source] = { column: filter.column, values: filter.values.map(String), label: filter.label || '' };
    else if (ext[source]) delete ext[source];
    else return;
    if (this.ds) this.refresh(false);
  };
  // The reader's own equality and list filters, by column: what this explorer tells the components it drives.
  Explorer.prototype.linkValues = function () {
    var out = dict(), spec = this.querySpec(undefined, true);
    spec.filters.forEach(function (f) {
      var op = normOp(f.op);
      if (op !== 'eq' && op !== 'in') return;
      out[f.column] = (out[f.column] || []).concat(f.values || []);
    });
    return out;
  };

  Explorer.prototype.updateCount = function () {
    var shown = this.size(), total = this.totalRows(), totalLabel = this.totalRowsLabel();
    this.count.textContent = fmt(this.labels.count, { shown: num(shown), total: totalLabel });
    // The short form a narrow toolbar shows: the rows shown, and the total when filters narrow them. The full sentence
    // stays the element's text, for assistive technology and anything that reads it.
    this.count.setAttribute('data-short', shown === total ? num(shown) : num(shown) + ' / ' + totalLabel);
  };

  // Rows in the dataset before any filter. A remote dataset says so in the page; live data may have grown since.
  Explorer.prototype.totalRows = function () { return this.remote ? Math.max(this.remote.rows || 0, this.total) : this.ds.rows; };

  // Population counts may be unavailable while a scoped remote count is pending or refused.
  Explorer.prototype.totalRowsLabel = function () { var total = this.totalRows(); return total === null ? '…' : num(total); };

  Explorer.prototype.columnLayout = function (column) {
    var lines = this.cfg.columnWrapping && this.cfg.columnWrapping[column.id];
    return lines ? Object.assign({}, column.layout || {}, { wrap: true, maxLines: lines }) : column.layout;
  };

  Explorer.prototype.fonts = function () {
    if (!this.fontSet) {
      var style = getComputedStyle(this.root);
      var family = style.fontFamily || 'sans-serif';
      var mono = (style.getPropertyValue('--hfx-font-mono') || '').trim() || 'monospace';
      this.fontSet = { head: '700 11px ' + family, cell: '12.5px ' + family, mono: '11.5px ' + mono };
    }
    return this.fontSet;
  };

  // Header width when it may wrap onto two lines: the narrowest width at which some break between words leaves both
  // lines whole.
  Explorer.prototype.headerWidth = function (label) {
    var font = this.fonts().head, spacing = 0.44;
    var words = String(label || '').toUpperCase().split(/\s+/).filter(Boolean);
    function measure(parts) { var t = parts.join(' '); return textWidth(t, font) + t.length * spacing; }
    var best = measure(words);
    for (var i = 1; i < words.length; i++) best = Math.min(best, Math.max(measure(words.slice(0, i)), measure(words.slice(i))));
    // Padding, sort mark and a little slack for glyphs the canvas measures narrower than the page renders them.
    return Math.ceil(best) + CELL_PAD + 22;
  };

  // Fits the header and most values (the 95th percentile of a row sample; only visible rows exist in the page, so
  // values are measured as text), up to a cap per type. An explicit column width is the smallest the column gets.
  Explorer.prototype.columnWidth = function (col) {
    var label = headerOf(col, this.state.labels);
    var cache = this.widths || (this.widths = dict());
    var key = col.id + '\u0000' + label;
    if (cache[key]) return cache[key];
    var head = this.headerWidth(label);
    var font = col.format === 'mono' ? this.fonts().mono : this.fonts().cell;
    // A remote dataset is measured on its first page, which is what the reader sees first.
    var rows = this.remote ? (this.pages[0] === 'loaded' ? Math.min(this.total, this.pageSize) : 0) : this.ds.rows;
    var step = Math.max(1, Math.floor(rows / SAMPLE_ROWS)), sizes = [], chip = false;
    for (var r = 0; r < rows && sizes.length < SAMPLE_ROWS; r += step) {
      var v = col.raw(r), text = valueText(this.labels, col, v, 'display');
      if (!text) continue;
      sizes.push(textWidth(text, font));
      if (!chip && !col.numericTones.length && col.tone(v)) chip = true;
    }
    sizes.sort(function (a, b) { return a - b; });
    var content = (sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * 0.95))] : 0) + CELL_PAD + (chip ? CHIP_PAD : 0);
    var cap = col.format === 'mono' || col.format === 'link' ? WIDE_WIDTH : MAX_WIDTH[col.type] || 320;
    var width = Math.ceil(Math.max(MIN_WIDTH, col.width || 0, head, Math.min(cap, content)));
    // Without rows to measure the width is provisional: it is measured again when rows have arrived.
    if (!this.remote || sizes.length) cache[key] = width;
    return width;
  };

  Explorer.prototype.renderHeader = function () {
    if (this.renderer) return;
    var self = this, cols = this.visibleColumns(), head = this.head;
    this.rowHeight = Math.max(this.cfg.density === 'comfortable' ? 38 : 31,
      cols.reduce(function (height, c) { var layout = self.columnLayout(c); return layout && layout.wrap ? Math.max(height, (layout.maxLines || 2) * 17 + 10) : height; }, 0));
    this.viewport.style.setProperty('--dx-row', this.rowHeight + 'px');
    var widths = cols.map(function (c) { return self.columnWidth(c); });
    // Spare width goes to text-like columns in proportion to their size; numbers and dates keep their fit.
    var grow = cols.map(function (c) { return c.type === 'text' || c.type === 'category' || c.format === 'mono' || c.format === 'link'; });
    if (!grow.some(Boolean)) grow = cols.map(function () { return true; });
    var template = widths.map(function (w, i) { return grow[i] ? 'minmax(' + w + 'px, ' + w + 'fr)' : w + 'px'; }).join(' ');
    var total = widths.reduce(function (s, w) { return s + w; }, 0);
    this.inner.style.setProperty('--dx-cols', template);
    this.inner.style.minWidth = total + 'px';
    attr(this.viewport, 'aria-colcount', String(cols.length));
    attr(this.viewport, 'aria-rowcount', String(this.size() + 1));
    head.textContent = '';
    cols.forEach(function (c, i) {
      var cell = el('div', 'hfx-dx-cell hfx-dx-hcell'); attr(cell, 'role', 'columnheader'); attr(cell, 'aria-colindex', String(i + 1));
      var sortIndex = -1, desc = false;
      self.state.sort.forEach(function (s, k) { if (s.column.toLowerCase() === c.id.toLowerCase()) { sortIndex = k; desc = s.descending; } });
      attr(cell, 'aria-sort', sortIndex === 0 ? (desc ? 'descending' : 'ascending') : 'none');
      var b = el('button', 'hfx-dx-sort'); attr(b, 'type', 'button');
      b.appendChild(el('span', 'hfx-dx-hlabel', headerOf(c, self.state.labels)));
      if (sortIndex >= 0) b.appendChild(el('span', 'hfx-dx-sortmark', (desc ? '↓' : '↑') + (self.state.sort.length > 1 ? String(sortIndex + 1) : '')));
      var heading = headerOf(c, self.state.labels);
      attr(b, 'title', c.description ? heading + ' \u2014 ' + c.description : heading);
      b.addEventListener('click', function (e) { self.toggleSort(c.id, e.shiftKey); });
      cell.appendChild(b);
      if (c.kind === 'n') cell.classList.add('is-num');
      head.appendChild(cell);
    });
  };

  Explorer.prototype.toggleSort = function (colId, add) {
    var sort = this.state.sort, idx = -1;
    sort.forEach(function (s, i) { if (s.column.toLowerCase() === colId.toLowerCase()) idx = i; });
    if (!add) {
      var cur = idx >= 0 ? sort[idx] : null;
      this.state.sort = !cur ? [{ column: colId, descending: false }] : !cur.descending ? [{ column: colId, descending: true }] : [];
    } else if (idx < 0) sort.push({ column: colId, descending: false });
    else if (!sort[idx].descending) sort[idx].descending = true;
    else sort.splice(idx, 1);
    this.refresh(true);
  };

  Explorer.prototype.renderRows = function (force) {
    if (this.renderer) { this.renderer.repaint(); return; }
    if (!this.viewport) return;
    var rh = this.rowHeight, vp = this.viewport, cols = this.visibleColumns();
    var scale = this.scale || 1, logical = vp.scrollTop * scale, shift = vp.scrollTop * (scale - 1);
    var top = Math.max(0, logical - rh);
    var height = vp.clientHeight || 500;
    var first = Math.max(0, Math.floor(top / rh) - 4);
    var last = Math.min(this.size() - 1, Math.ceil((logical + height) / rh) + 4);
    var need = Math.max(0, last - first + 1);
    while (this.pool.length < need) {
      var rowEl = el('div', 'hfx-dx-row'); attr(rowEl, 'role', 'row'); rowEl.hidden = true;
      this.canvas.appendChild(rowEl);
      this.pool.push({ el: rowEl, r: -2, cols: '' });
    }
    var colKey = this.state.columns.join('|');
    for (var p = 0; p < this.pool.length; p++) {
      var slot = this.pool[p], i = first + p;
      if (i > last) { slot.el.hidden = true; slot.r = -2; continue; }
      var r = this.rowAt(i);
      slot.el.style.transform = 'translateY(' + (i * rh - shift) + 'px)';
      slot.el.hidden = false;
      attr(slot.el, 'aria-rowindex', String(i + 2));
      slot.el.classList.toggle('is-odd', i % 2 === 1);
      slot.el.classList.toggle('is-active', i === this.active);
      slot.el.classList.toggle('is-open', r >= 0 && r === this.drawerRow);
      slot.el.classList.toggle('is-pending', r < 0);
      if (r < 0) {
        // The page of this row has not arrived: the row keeps its place and is filled when it does.
        this.ensurePage(this.pageOf(i));
        if (slot.r !== -1 || slot.cols !== colKey) { slot.r = -1; slot.cols = colKey; slot.el.removeAttribute('data-r'); this.fillPending(slot.el, cols); }
        continue;
      }
      if (!force && slot.r === r && slot.cols === colKey) continue;
      slot.r = r; slot.cols = colKey;
      attr(slot.el, 'data-r', String(r));
      this.fillRow(slot.el, r, cols);
    }
  };

  Explorer.prototype.fillPending = function (rowEl, cols) {
    rowEl.textContent = '';
    for (var j = 0; j < cols.length; j++) {
      var cell = el('div', 'hfx-dx-cell', j === 0 ? '…' : ''); attr(cell, 'role', 'gridcell');
      rowEl.appendChild(cell);
    }
  };

  Explorer.prototype.fillRow = function (rowEl, r, cols) {
    rowEl.textContent = '';
    for (var j = 0; j < cols.length; j++) {
      var c = cols[j];
      var cell = el('div', 'hfx-dx-cell'); attr(cell, 'role', 'gridcell');
      this.fillCell(cell, r, c);
      rowEl.appendChild(cell);
    }
  };

  // Whether a column tone falls in the quiet tones of the column (ReportDatasetColumn.QuietTones) or the explorer
  // (DataExplorerSettings.QuietTones): success is a plain pass and up, info an informational pass and maintenance. Quiet
  // values are plain muted text instead of a chip, as in report lists. Values without a tone are plain text anyway.
  Explorer.prototype.isQuiet = function (c, tone) {
    var tokens = c.quiet || this.cfg.quietTones;
    if (!tokens || !tokens.length) return false;
    var kind = typeof tone === 'string' ? (tone === 'good' ? 'success' : tone === 'info' ? 'info' : null)
      : tone.state ? (tone.state === 'up' ? 'success' : tone.state === 'maintenance' ? 'info' : null)
      : tone.outcome === 'pass' ? (tone.severity === 'info' ? 'info' : 'success') : null;
    return !!kind && tokens.indexOf(kind) >= 0;
  };

  // The link of a link cell: its address, or for a link-text column the address in the row's target column with the
  // cell's text as the label.
  Explorer.prototype.linkOf = function (r, c, text) {
    if (!c.linkTarget) return linkNode(text);
    var target = this.ds.column(c.linkTarget);
    var address = target ? target.text(r, 'export') : '';
    return address ? linkNode(address, text) : document.createTextNode(text);
  };

  // Cell formatting is shared by viewport renderers, the query runtime remains its owner.
  Explorer.prototype.fillCell = function (cell, r, c) {
      var v = c.raw(r); cell.textContent = '';
      if (c.kind === 'n') cell.classList.add('is-num');
      if (c.format === 'mono') cell.classList.add('is-mono');
      var text = valueText(this.labels, c, v, 'display');
      var tone = c.tone(v);
      var layout = this.columnLayout(c);
      cell.classList.toggle('is-wrap', !!(layout && layout.wrap));
      if (layout && layout.wrap) {
        cell.style.setProperty('--dx-lines', layout.maxLines || 2);
        attr(cell, 'title', text);
      } else {
        cell.style.removeProperty('--dx-lines');
        var tooltip = layout && layout.tooltip, source = tooltip && tooltip !== 'auto' ? this.ds.column(tooltip) : null;
        if (tooltip === 'auto' || source) attr(cell, 'title', source ? valueText(this.labels, source, source.raw(r), 'display') : text);
        else cell.removeAttribute('title');
      }
      if (numericText(cell, c, v, text, false)) {
        // Numeric threshold colours never borrow the filled category-chip treatment.
      } else if (tone && this.isQuiet(c, tone)) {
        cell.appendChild(el('span', 'hfx-dx-quiet', text));
      } else if (tone) {
        var chip = toneAttrs(el('span', 'hfx-as-chip hfx-dx-chip'), tone);
        var dot = toneAttrs(el('span', 'hfx-as-dot'), tone); attr(dot, 'aria-hidden', 'true');
        chip.appendChild(dot); chip.appendChild(el('span', null, text));
        cell.appendChild(chip);
      } else if (c.format === 'link' && text) {
        cell.appendChild(this.linkOf(r, c, text));
      } else {
        cell.textContent = text;
      }
      if (layout && layout.wrap) {
        var wrapped = el('span', 'hfx-dx-wrap-value');
        while (cell.firstChild) wrapped.appendChild(cell.firstChild);
        cell.appendChild(wrapped);
      }
  };

  Explorer.prototype.onKey = function (e) {
    var n = this.size();
    if (!n) return;
    var page = Math.max(1, Math.floor(this.viewport.clientHeight / this.rowHeight) - 1);
    var a = this.active < 0 ? 0 : this.active;
    switch (e.key) {
      case 'ArrowDown': a = Math.min(n - 1, a + 1); break;
      case 'ArrowUp': a = Math.max(0, a - 1); break;
      case 'PageDown': a = Math.min(n - 1, a + page); break;
      case 'PageUp': a = Math.max(0, a - page); break;
      case 'Home': a = 0; break;
      case 'End': a = n - 1; break;
      case 'Enter': this.openRow(a, null); e.preventDefault(); return;
      default: return;
    }
    e.preventDefault();
    this.active = a;
    this.scrollToIndex(a);
    this.renderRows(false);
  };

  Explorer.prototype.scrollToIndex = function (i) {
    if (this.renderer) { this.renderer.scrollToIndex(i); return; }
    var rh = this.rowHeight, vp = this.viewport, headH = this.head.offsetHeight || rh, scale = this.scale || 1;
    var top = i * rh, bottom = top + rh, logical = vp.scrollTop * scale;
    if (top < logical) vp.scrollTop = top / scale;
    else if (bottom > logical + vp.clientHeight - headH) vp.scrollTop = (bottom - vp.clientHeight + headH) / scale;
  };

  // ---- panels
  Explorer.prototype.renderColumnPanel = function (panel) {
    var self = this, ds = this.ds;
    panel.classList.add('is-wide');
    var filter = el('input', 'hfx-dx-input'); attr(filter, 'type', 'search'); attr(filter, 'placeholder', this.labels.columns); attr(filter, 'aria-label', this.labels.columns);
    panel.appendChild(filter);
    var list = el('div', 'hfx-dx-collist');
    panel.appendChild(list);
    function draw() {
      list.textContent = '';
      var q = filter.value.trim().toLowerCase();
      var chosen = self.state.columns.map(function (id) { return id.toLowerCase(); });
      var groups = dict(), order = [];
      ds.columns.forEach(function (c) {
        if (q && c.label.toLowerCase().indexOf(q) < 0 && c.id.toLowerCase().indexOf(q) < 0) return;
        var g = c.group || self.labels.details;
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(c);
      });
      order.forEach(function (g) {
        list.appendChild(el('p', 'hfx-dx-colgroup', g));
        groups[g].forEach(function (c) {
          var pos = chosen.indexOf(c.id.toLowerCase());
          var row = el('div', 'hfx-dx-colrow');
          var label = el('label');
          var cb = el('input'); attr(cb, 'type', 'checkbox'); cb.checked = pos >= 0;
          cb.disabled = cb.checked && chosen.length === 1;
          cb.addEventListener('change', function () {
            if (!cb.checked && self.state.columns.length === 1) { cb.checked = true; return; }
            if (cb.checked) self.state.columns.push(c.id);
            else self.state.columns = self.state.columns.filter(function (id) { return id.toLowerCase() !== c.id.toLowerCase(); });
            self.refresh(true); draw();
          });
          label.appendChild(cb);
          label.appendChild(el('span', null, c.label));
          if (c.description) attr(label, 'title', c.description);
          row.appendChild(label);
          if (pos >= 0) {
            var up = el('button', 'hfx-dx-iconbtn', '↑'); attr(up, 'type', 'button'); attr(up, 'aria-label', fmt(self.labels.moveLeft || 'Move {column} left', { column: c.label })); up.disabled = pos === 0;
            var down = el('button', 'hfx-dx-iconbtn', '↓'); attr(down, 'type', 'button'); attr(down, 'aria-label', fmt(self.labels.moveRight || 'Move {column} right', { column: c.label })); down.disabled = pos === chosen.length - 1;
            up.addEventListener('click', function () { self.moveColumn(pos, -1); draw(); });
            down.addEventListener('click', function () { self.moveColumn(pos, 1); draw(); });
            row.appendChild(up); row.appendChild(down);
          }
          list.appendChild(row);
        });
      });
    }
    filter.addEventListener('input', draw);
    draw();
  };

  Explorer.prototype.moveColumn = function (pos, delta) {
    var cols = this.state.columns, to = pos + delta;
    if (to < 0 || to >= cols.length) return;
    var tmp = cols[pos]; cols[pos] = cols[to]; cols[to] = tmp;
    this.refresh(true);
  };

  Explorer.prototype.renderFilterPanel = function (panel) {
    var self = this, ds = this.ds;
    panel.classList.add('is-wide');
    var list = el('div', 'hfx-dx-filterlist');
    this.state.filters.forEach(function (f, i) {
      var row = el('div', 'hfx-dx-filterrow');
      var text = describeFilter(ds, f, self.labels);
      row.appendChild(el('span', null, text));
      var x = el('button', 'hfx-dx-iconbtn', '×'); attr(x, 'type', 'button'); attr(x, 'aria-label', removeFilterLabel(self.labels, text));
      x.addEventListener('click', function () { self.state.filters.splice(i, 1); self.refresh(true); panel.textContent = ''; self.renderFilterPanel(panel); });
      row.appendChild(x);
      list.appendChild(row);
    });
    panel.appendChild(list);

    var form = el('form', 'hfx-dx-filterform');
    var colSel = el('select', 'hfx-dx-input'); attr(colSel, 'aria-label', self.labels.filterColumn || 'Column');
    ds.columns.forEach(function (c) { var o = el('option', null, c.label); o.value = c.id; colSel.appendChild(o); });
    var opSel = el('select', 'hfx-dx-input'); attr(opSel, 'aria-label', self.labels.filterCondition || 'Condition');
    var valueWrap = el('span', 'hfx-dx-valuewrap');
    function redrawOps() {
      var col = ds.column(colSel.value);
      opSel.textContent = '';
      opsFor(col).forEach(function (op) { var o = el('option', null, opWord(self.labels, op).replace('{days}', 'N')); o.value = op; opSel.appendChild(o); });
      redrawValue();
    }
    function redrawValue() {
      var col = ds.column(colSel.value), op = opSel.value;
      valueWrap.textContent = '';
      if (!needsValue(op)) return;
      var input;
      var choice = op === 'eq' || op === 'ne' || op === 'in' || op === 'nin';
      function options(target, values) { values.forEach(function (d) { var o = el('option', null, d.label || d.value); o.value = d.value; target.appendChild(o); }); }
      if (choice && (col.kind === 'd' || col.kind === 'b')) {
        input = el('select', 'hfx-dx-input');
        if (op === 'in' || op === 'nin') attr(input, 'multiple', 'multiple');
        // Yes/no options show the report's words and keep the values a filter matches.
        options(input, col.kind === 'b' ? [{ value: 'Yes', label: booleanWord(self.labels, 'Yes') }, { value: 'No', label: booleanWord(self.labels, 'No') }] : col.distinct(allRows(ds)).slice(0, 500));
      } else if (choice && self.remote && col.type === 'category') {
        // The values of a remote column are on the server: the box takes any text and suggests them once they arrive.
        input = el('input', 'hfx-dx-input'); attr(input, 'type', 'text');
        var suggestions = el('datalist'); suggestions.id = nextId('hfx-dx-values');
        attr(input, 'list', suggestions.id);
        valueWrap.appendChild(suggestions);
        self.columnValues(col).then(function (values) { options(suggestions, values); }, function () { });
      } else {
        input = el('input', 'hfx-dx-input');
        attr(input, 'type', (op === 'next' || op === 'last' || op === 'older' || col.kind === 'n') ? 'number' : col.kind === 't' ? 'date' : 'text');
      }
      attr(input, 'aria-label', self.labels.filterValue || 'Value');
      input.setAttribute('data-hfx-dx-value', '1');
      valueWrap.appendChild(input);
    }
    colSel.addEventListener('change', redrawOps);
    opSel.addEventListener('change', redrawValue);
    var add = el('button', 'hfx-dx-btn', self.labels.addFilter || 'Add filter'); attr(add, 'type', 'submit');
    form.appendChild(colSel); form.appendChild(opSel); form.appendChild(valueWrap); form.appendChild(add);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = valueWrap.querySelector('[data-hfx-dx-value]');
      var values = [];
      if (input) {
        if (input.multiple) values = Array.prototype.slice.call(input.selectedOptions).map(function (o) { return o.value; });
        else if (input.value !== '') values = [input.value];
        if (!values.length) { input.focus(); return; }
      }
      self.state.filters.push({ column: colSel.value, op: OP_TOKENS[opSel.value], values: values });
      self.refresh(true);
      panel.textContent = ''; self.renderFilterPanel(panel);
    });
    panel.appendChild(form);
    redrawOps();
  };

  function allRows(ds) { var a = new Array(ds.rows); for (var i = 0; i < ds.rows; i++) a[i] = i; return a; }

  // The distinct values of a column of a remote dataset, asked for once.
  Explorer.prototype.columnValues = function (col) {
    var cache = this.valueCache || (this.valueCache = dict()), key = col.id.toLowerCase();
    var prior = cache[key];
    // A form can redraw synchronously after refresh aborts its old suggestions, before rejection handlers run.
    if (prior && !prior.completed && prior.signal && prior.signal.aborted) delete cache[key];
    if (!cache[key]) {
      var options = { signal: this.abort ? this.abort.signal : undefined };
      var entry = { signal: options.signal, completed: false };
      cache[key] = entry;
      entry.promise = this.queryRemote({ limit: 0, facets: [{ column: col.id, limit: 500 }] }, options).then(function (res) {
        entry.completed = true;
        return (res.facets[key] && res.facets[key].values) || [];
      });
      entry.promise.then(null, function () { if (cache[key] === entry) delete cache[key]; });
    }
    return cache[key].promise;
  };

  // The name field and Save button for a saved view, in the explorer's own Save view menu or in a menu a viewport
  // renderer hosts. options (optional): done closes that host menu instead of the explorer's (a host that keeps the form,
  // such as a grid's more-menu entry, gets a cleared field for the next view); fieldClass wraps the field in a label of
  // that class and buttonClass styles the button, so the form takes the host menu's own field and button styles.
  Explorer.prototype.renderSavePanel = function (panel, options) {
    var self = this, host = options || {}, done = host.done;
    var form = el('form', 'hfx-dx-saveform');
    var input = el('input', host.fieldClass ? null : 'hfx-dx-input'); attr(input, 'type', 'text'); attr(input, 'aria-label', this.labels.saveView); attr(input, 'placeholder', this.labels.saveView); attr(input, 'maxlength', '60');
    var ok = el('button', host.buttonClass || 'hfx-dx-btn', this.labels.saveView); attr(ok, 'type', 'submit');
    if (host.fieldClass) { var field = el('label', host.fieldClass); field.appendChild(input); form.appendChild(field); } else form.appendChild(input);
    form.appendChild(ok);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = input.value.trim();
      if (!title) { input.focus(); return; }
      var def;
      try { def = self.definition(true); }
      catch (error) { self.setStatus(error.message, true); return; }
      var view = { scopeView: def.scopeView, id: 'saved-' + Date.now().toString(36), title: title, columns: def.columns, keys: def.keys, filters: (def.filters || []).map(function (f) { return { column: f.column, op: f.op, values: f.values || (f.value !== undefined ? [f.value] : []) }; }), sort: def.sort || [], search: def.search || '', searchIn: def.searchIn, stableKeyOrder: !!def.stableKeyOrder, labels: def.labels || {}, limit: def.limit > 0 ? def.limit : null };
      self.saved.push(view);
      storageSet(self.storageKey, self.saved);
      input.value = '';
      if (typeof done === 'function') done(); else self.closeMenus();
      self.applyView(view, false);
    });
    panel.appendChild(form);
  };

  // ---- drawer
  var drawerHost = null;
  function ensureDrawer() {
    if (drawerHost) return drawerHost;
    var wrap = el('div', 'hfx-as hfx-dx-drawer-wrap'); wrap.hidden = true;
    var backdrop = el('div', 'hfx-dx-drawer-backdrop');
    var aside = el('div', 'hfx-dx-drawer'); attr(aside, 'role', 'dialog'); attr(aside, 'aria-modal', 'true'); attr(aside, 'tabindex', '-1');
    var titleId = nextId('hfx-dx-drawer-title');
    attr(aside, 'aria-labelledby', titleId);
    var head = el('div', 'hfx-dx-drawer-head');
    var titles = el('div', 'hfx-dx-drawer-titles');
    var eyebrow = el('p', 'hfx-as-eyebrow');
    var title = el('h2'); title.id = titleId;
    var sub = el('p', 'hfx-dx-drawer-sub');
    titles.appendChild(eyebrow); titles.appendChild(title); titles.appendChild(sub);
    var actions = el('div', 'hfx-dx-drawer-actions');
    var prev = el('button', 'hfx-dx-iconbtn', '‹'); attr(prev, 'type', 'button');
    var pos = el('span', 'hfx-dx-drawer-pos'); attr(pos, 'aria-live', 'polite');
    var next = el('button', 'hfx-dx-iconbtn', '›'); attr(next, 'type', 'button');
    var close = el('button', 'hfx-dx-iconbtn', '×'); attr(close, 'type', 'button');
    actions.appendChild(prev); actions.appendChild(pos); actions.appendChild(next); actions.appendChild(close);
    head.appendChild(titles); head.appendChild(actions);
    var body = el('div', 'hfx-dx-drawer-body');
    aside.appendChild(head); aside.appendChild(body);
    wrap.appendChild(backdrop); wrap.appendChild(aside);
    document.body.appendChild(wrap);
    drawerHost = { wrap: wrap, aside: aside, eyebrow: eyebrow, title: title, sub: sub, prev: prev, next: next, pos: pos, close: close, body: body, owner: null, contentOwner: null, returnFocus: null };
    function shut() { if (drawerHost.owner) drawerHost.owner.closeDrawer(); }
    backdrop.addEventListener('click', shut);
    close.addEventListener('click', shut);
    prev.addEventListener('click', function () { if (drawerHost.owner) drawerHost.owner.stepDrawer(-1); });
    next.addEventListener('click', function () { if (drawerHost.owner) drawerHost.owner.stepDrawer(1); });
    aside.addEventListener('keydown', function (e) {
      if (!drawerHost.owner) return;
      if (e.key === 'Escape') { e.preventDefault(); shut(); }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !closest(e.target, 'input, textarea, select')) { e.preventDefault(); drawerHost.owner.stepDrawer(e.key === 'ArrowLeft' ? -1 : 1); }
      else if (e.key === 'Tab') {
        var f = qsa(aside, 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').filter(function (n) { return n.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    return drawerHost;
  }

  // The targets of the rows around a row, for the previous and next buttons of what it opens: each target once, in the
  // view's order. Several rows can name the same target (findings of one check); rows of a remote dataset that have not
  // arrived are left out. Null when the row has no target.
  Explorer.prototype.rowTargets = function (index, targetOf) {
    var own = this.rowAt(index) >= 0 ? targetOf(this.rowAt(index)) : '';
    if (!own) return null;
    var from = Math.max(0, index - Math.floor(MAX_ROW_TARGETS / 2));
    var to = Math.min(this.size(), from + MAX_ROW_TARGETS);
    var ids = [], seen = dict();
    for (var i = from; i < to; i++) {
      var r = this.rowAt(i), id = r >= 0 ? targetOf(r) : '';
      if (!id || seen[id]) continue;
      seen[id] = true;
      ids.push(id);
    }
    return { ids: ids, at: ids.indexOf(own) };
  };

  // The page target of a row (RowTarget): an element id or a report entity, with or without a leading "#".
  Explorer.prototype.pageTargetOf = function (r) {
    var col = this.cfg.rowTarget ? this.ds.column(this.cfg.rowTarget) : null;
    return col ? String(col.text(r, 'export') || '').trim().replace(/^#/, '') : '';
  };

  // The report entity a row stands for (RowEntity): "type/key", with the key from the entity column.
  Explorer.prototype.entityOf = function (r) {
    var spec = this.cfg.rowEntity, col = spec && this.ds.column(spec.column);
    var key = col ? String(col.text(r, 'export') || '').trim() : '';
    return key ? spec.type + '/' + key : '';
  };

  // A row with a page target opens that element or entity (with the neighbouring rows' targets for previous/next); a
  // row that stands for a report entity opens the entity's panel in the report's drawer; any other row opens the record
  // drawer. A target or entity the report cannot show falls back to the record drawer too.
  Explorer.prototype.openRow = function (index, rowEl) {
    if (index < 0 || index >= this.size()) return;
    var self = this, back = rowEl || document.activeElement || this.viewport;
    var targets = this.cfg.rowTarget ? this.rowTargets(index, function (r) { return self.pageTargetOf(r); }) : null;
    if (targets && openPageTarget(targets.ids, targets.at, rowEl || this.root, back)) return;
    var report = window.hfxReport;
    var entities = this.cfg.rowEntity && report && typeof report.openEntities === 'function' ? this.rowTargets(index, function (r) { return self.entityOf(r); }) : null;
    if (entities && report.openEntities(entities.ids, entities.at, back)) return;
    if (this.cfg.drawer !== false) this.openDrawer(index);
  };

  // Inside a report shell a record opens in the shell's drawer, the one drawer of the report; on its own the explorer
  // keeps a drawer of its own with the same content.
  // An explorer that is itself shown in the drawer (inside an entity panel or a check) opens its records in its own
  // drawer on top, so the drawer it lives in stays; so does an explorer in a shell rendered without a drawer.
  Explorer.prototype.shellDrawer = function () {
    var api = window.hfxReport;
    if (!api || !api.drawer || typeof api.drawer.open !== 'function') return null;
    var shell = closest(this.root, '[data-hfx-shell]');
    if (!shell || closest(this.root, '[data-hfx-shell-drawer]') || !shell.querySelector('[data-hfx-shell-drawer-wrap]')) return null;
    return api.drawer;
  };

  Explorer.prototype.openDrawer = function (index) {
    if (index < 0 || index >= this.size()) return;
    if (this.rowAt(index) < 0) {
      // The page of the record is on its way: the drawer opens when it arrives.
      this.pendingDrawer = index;
      this.active = index;
      this.scrollToIndex(index);
      this.renderRows(false);
      return;
    }
    var shell = this.shellDrawer();
    // The runtime keeps where focus returns to while the drawer is open, so every open can name it.
    if (shell && shell.open(this.shellDrawerOptions(index, document.activeElement || this.viewport))) {
      this.inShellDrawer = true;
      this.showRecord(index);
      return;
    }
    var d = ensureDrawer(), labels = this.labels;
    if (!d.owner || d.owner !== this) d.returnFocus = document.activeElement;
    d.owner = this; d.contentOwner = this;
    d.close.setAttribute('aria-label', labels.close); d.close.title = labels.close;
    d.prev.setAttribute('aria-label', labels.previous); d.prev.title = labels.previous;
    d.next.setAttribute('aria-label', labels.next); d.next.title = labels.next;
    this.showRecord(index);
    this.fillDrawer(this.drawerRow);
    d.pos.textContent = num(index + 1) + ' / ' + num(this.size());
    d.prev.disabled = index <= 0;
    d.next.disabled = index >= this.size() - 1;
    // The page under the drawer must not scroll; the report runtime does that without restyling <html>.
    if (window.hfxReport && window.hfxReport.drawer.guardScroll) window.hfxReport.drawer.guardScroll(d.wrap, d.body);
    d.wrap.hidden = false;
    try { d.aside.focus({ preventScroll: true }); } catch (_) { d.aside.focus(); }
  };

  // Marks the record that is open and keeps its row in view.
  Explorer.prototype.showRecord = function (index) {
    this.active = index;
    this.pendingDrawer = -1;
    this.drawerRow = this.rowAt(index);
    this.scrollToIndex(index);
    this.renderRows(false);
  };

  // What the shell drawer shows for a record: the dataset as the eyebrow, the title column as the title, the fields and
  // related rows as the body; stepping walks the rows of the explorer as they are filtered and sorted.
  Explorer.prototype.shellDrawerOptions = function (index, returnFocus) {
    var self = this, r = this.rowAt(index), head = this.recordHead(r);
    var body = el('div', 'hfx-dx-record');
    if (head.sub) body.appendChild(el('p', 'hfx-dx-drawer-sub', head.sub));
    // The record is found again by its row, which survives a new order while the drawer is open.
    this.renderRecord(body, r, function () { if (self.inShellDrawer) self.openDrawer(self.indexOfRow(self.drawerRow)); });
    return {
      shell: this.root, owner: this, eyebrow: head.eyebrow, title: head.title, content: body, size: 'regular',
      index: index, count: this.size(), returnFocus: returnFocus || null,
      // openDrawer handles the ends, a remote row that is still on its way (it scrolls there and opens it when it
      // arrives) and filling the open drawer; the runtime has nothing more to do.
      onStep: function (next) { self.openDrawer(next); return null; },
      onClose: function () {
        self.inShellDrawer = false;
        self.drawerRow = -1;
        self.pendingDrawer = -1;
        self.renderRows(false);
      }
    };
  };

  Explorer.prototype.stepDrawer = function (delta) {
    var i = this.indexOfRow(this.drawerRow);
    this.openDrawer(Math.max(0, Math.min(this.size() - 1, i + delta)));
  };

  Explorer.prototype.closeDrawer = function () {
    if (this.inShellDrawer) { var shell = this.shellDrawer(); if (shell) shell.close(); return; }
    var d = drawerHost;
    if (!d || d.owner !== this) return;
    d.wrap.hidden = true;
    d.owner = null;
    this.drawerRow = -1;
    this.pendingDrawer = -1;
    this.renderRows(false);
    var back = d.returnFocus || this.viewport;
    try { back.focus({ preventScroll: true }); } catch (_) { }
  };

  // Closing preserves ordinary reopen behavior; disposal also releases the last record's retained controls.
  Explorer.prototype.releaseDrawer = function () {
    var shell = window.hfxReport && window.hfxReport.drawer;
    if (shell && typeof shell.release === 'function') shell.release(this);
    var d = drawerHost;
    if (!d || d.contentOwner !== this) return;
    d.wrap.hidden = true; d.body.textContent = '';
    d.owner = null; d.contentOwner = null; d.returnFocus = null;
  };

  Explorer.prototype.recordHead = function (r) {
    var ds = this.ds;
    var titleCol = ds.column(this.cfg.drawerTitle) || ds.keyColumn || this.visibleColumns()[0];
    var subCol = ds.column(this.cfg.drawerSubtitle);
    return {
      eyebrow: this.cfg.title || ds.title,
      title: titleCol ? titleCol.text(r, 'display') || '—' : '',
      sub: subCol ? subCol.text(r, 'display') : ''
    };
  };

  Explorer.prototype.fillDrawer = function (r) {
    var d = drawerHost, self = this, head = this.recordHead(r);
    d.eyebrow.textContent = head.eyebrow;
    d.title.textContent = head.title;
    d.sub.textContent = head.sub;
    d.sub.hidden = !head.sub;
    d.body.textContent = '';
    this.renderRecord(d.body, r, function () { self.fillDrawer(r); });
  };

  // The fields of a record by group, then its related rows. rerender draws the record again (the "show empty fields"
  // switch); a related list that arrives after the drawer moved to another record is dropped.
  Explorer.prototype.renderRecord = function (into, r, rerender) {
    var ds = this.ds, labels = this.labels, self = this;
    var showEmpty = !!this.showEmpty;
    var toggleRow = el('label', 'hfx-dx-toggle');
    var cb = el('input'); attr(cb, 'type', 'checkbox'); cb.checked = showEmpty;
    cb.addEventListener('change', function () {
      self.showEmpty = cb.checked;
      rerender();
      // The switch is drawn again with the record; focus goes to the new one so the keyboard stays in the drawer.
      var box = self.inShellDrawer ? document.querySelector('[data-hfx-shell-drawer-body] .hfx-dx-toggle input') : drawerHost && drawerHost.body.querySelector('.hfx-dx-toggle input');
      if (box) { try { box.focus({ preventScroll: true }); } catch (_) { } }
    });
    toggleRow.appendChild(cb); toggleRow.appendChild(el('span', null, labels.showEmpty));
    into.appendChild(toggleRow);

    var groups = dict(), order = [];
    ds.columns.forEach(function (c) {
      if (c.drawer === false) return; // a key hidden in the grid, or a column the host keeps out of the drawer
      var g = c.group || labels.details;
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(c);
    });
    var preferred = this.cfg.drawerGroups || [];
    order = preferred.filter(function (g, index) { return groups[g] && preferred.indexOf(g) === index; })
      .concat(order.filter(function (g) { return preferred.indexOf(g) < 0; }));
    order.forEach(function (g) {
      var cols = groups[g].filter(function (c) { return showEmpty || c.raw(r) !== null; });
      if (!cols.length) return;
      var sec = el('section', 'hfx-dx-dsec');
      sec.appendChild(el('h3', null, g));
      var dl = el('dl', 'hfx-dx-fields');
      cols.forEach(function (c) {
        var dt = el('dt', null, c.label);
        if (c.description) attr(dt, 'title', c.description);
        var dd = el('dd');
        var v = c.raw(r), text = valueText(labels, c, v, 'export');
        var tone = c.tone(v);
        if (numericText(dd, c, v, text, true)) {
          // Keep the raw number and show its localized threshold explanation alongside it.
        } else if (tone && self.isQuiet(c, tone)) {
          dd.appendChild(el('span', 'hfx-dx-quiet', text));
        } else if (tone) {
          var chip = toneAttrs(el('span', 'hfx-as-chip'), tone);
          var dot = toneAttrs(el('span', 'hfx-as-dot'), tone); attr(dot, 'aria-hidden', 'true');
          chip.appendChild(dot); chip.appendChild(el('span', null, text)); dd.appendChild(chip);
        } else if (c.format === 'link' && text) {
          dd.appendChild(self.linkOf(r, c, text));
        } else {
          dd.textContent = text || '—';
        }
        if (c.format === 'mono') dd.classList.add('is-mono');
        if (c.format === 'long') dd.classList.add('is-long');
        dl.appendChild(dt); dl.appendChild(dd);
      });
      sec.appendChild(dl);
      into.appendChild(sec);
    });

    (this.cfg.relations || []).forEach(function (rel) {
      var local = ds.column(rel.local);
      var key = local ? local.text(r, 'export') : '';
      var sec = el('section', 'hfx-dx-dsec hfx-dx-related');
      var h = el('h3', null, rel.title);
      sec.appendChild(h);
      var holder = el('div', 'hfx-dx-related-body', labels.loading ? fmt(labels.loading, { rows: '' }) : '');
      sec.appendChild(holder);
      into.appendChild(sec);
      if (!key) { holder.textContent = '—'; return; }
      relatedRows(rel, key).then(function (related) {
        if (self.drawerRow !== r || !into.isConnected) return;
        var rds = related.dataset, rows = related.rows;
        h.appendChild(el('span', 'hfx-dx-related-count', num(related.total)));
        holder.textContent = '';
        if (!rows.length) { holder.textContent = '—'; return; }
        var cols = (rel.columns || []).map(function (id) { return rds.column(id); }).filter(Boolean);
        var wrap = el('div', 'hfx-dx-related-scroll');
        var table = el('table', 'hfx-dx-related-table');
        var thead = el('thead'), tr = el('tr');
        cols.forEach(function (c) { tr.appendChild(el('th', null, c.label)); });
        thead.appendChild(tr); table.appendChild(thead);
        var tbody = el('tbody');
        rows.slice(0, rel.limit || 50).forEach(function (rr) {
          var row = el('tr');
          cols.forEach(function (c) {
            var v = c.raw(rr), td = el('td'), tone = c.tone(v), text = valueText(labels, c, v, 'display');
            if (numericText(td, c, v, text, false)) { /* The threshold word stays in the tooltip. */ }
            else if (tone && self.isQuiet(c, tone)) td.appendChild(el('span', 'hfx-dx-quiet', text));
            else if (tone) { var chip = toneAttrs(el('span', 'hfx-as-chip'), tone); chip.appendChild(el('span', null, text)); td.appendChild(chip); }
            else td.textContent = text;
            if (c.format === 'mono') td.classList.add('is-mono');
            row.appendChild(td);
          });
          tbody.appendChild(row);
        });
        table.appendChild(tbody); wrap.appendChild(table); holder.appendChild(wrap);
        if (related.total > (rel.limit || 50)) holder.appendChild(el('p', 'hfx-dx-note', fmt(labels.moreRelated, { more: num(related.total - (rel.limit || 50)) })));
      }, function (err) { holder.textContent = self.errorText(err); });
    });
  };

  // The rows of a related dataset whose match column holds the key of the selected record (without case): looked up
  // in a dataset the page holds, asked from the endpoint of a remote one. With a separator a cell holds several keys.
  function relatedRows(rel, key) {
    var src = Data.source(rel.dataset), limit = rel.limit || 50, separator = rel.separator || null;
    if (src.kind !== 'remote') {
      return src.load().then(function (rds) {
        var rows = rds.lookup(rel.foreign, key, separator);
        return { dataset: rds, rows: rows, total: rows.length };
      });
    }
    var columns = (rel.columns || []).slice();
    if (columns.indexOf(rel.foreign) < 0) columns.push(rel.foreign);
    return src.query({ columns: columns, filters: [{ column: rel.foreign, op: separator ? 'contains-token' : '=', values: separator ? [key, separator] : [key] }], limit: limit }).then(function (res) {
      var rows = [];
      for (var r = 0; r < res.count; r++) {
        rows.push(r);
      }
      return { dataset: res.dataset, rows: rows, total: res.total };
    });
  }

  // --------------------------------------------------------------- bootstrap
  function init(root) {
    if (!root || root.hfxDataExplorer) return;
    try { new Explorer(root); } catch (e) { try { console.error('HtmlForgeX data explorer', e); } catch (_) { } }
  }
  function initAll(scope) {
    scope = scope || document;
    if (scope.matches && scope.matches('[data-hfx-dx]')) init(scope);
    qsa(scope, '[data-hfx-dx]').forEach(init);
  }

  // A shell drawer removes its inserted panel when it closes. Retire detached owners after DOM moves settle;
  // moving an explorer between connected containers keeps its accepted grid and selection.
  var removalObserver = new MutationObserver(function (changes) {
    if (!changes.some(function (change) { return change.removedNodes.length; })) return;
    Object.keys(instances).forEach(function (id) {
      var instance = instances[id];
      if (!instance.root.isConnected) instance.destroy();
    });
  });
  removalObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Links elsewhere in the page can open an explorer with a view, filters or search applied:
  // <a href="#explorer-id" data-hfx-dx-apply="explorer-id" data-hfx-dx-view="view-key" data-hfx-dx-filters='[...]'>.
  document.addEventListener('click', function (e) {
    var link = closest(e.target, '[data-hfx-dx-apply]');
    if (!link) return;
    var id = link.getAttribute('data-hfx-dx-apply');
    var target = document.getElementById(id);
    if (target && !target.hfxDataExplorer) init(target);
    var inst = instances[id];
    if (!inst) return;
    var spec = {};
    if (link.hasAttribute('data-hfx-dx-view')) spec.view = link.getAttribute('data-hfx-dx-view');
    if (link.hasAttribute('data-hfx-dx-filters')) { try { spec.filters = JSON.parse(link.getAttribute('data-hfx-dx-filters')); } catch (_) { } }
    if (link.hasAttribute('data-hfx-dx-search')) spec.search = link.getAttribute('data-hfx-dx-search');
    inst.apply(spec);
  }, true);

  // Shortcut targets (<span data-hfx-dx-shortcut id="...">) let any in-page link or a bookmarked #address open an
  // explorer with a view, filters or search applied.
  function applyShortcut(target) {
    if (!target || !target.hasAttribute || !target.hasAttribute('data-hfx-dx-shortcut')) return false;
    var root = closest(target, '[data-hfx-dx]');
    if (!root) return false;
    init(root);
    var inst = root.hfxDataExplorer;
    if (!inst) return false;
    var spec = {};
    try { spec = JSON.parse(target.getAttribute('data-hfx-dx-shortcut') || '{}'); } catch (_) { }
    inst.apply(spec);
    return true;
  }
  function shortcutFromHash() {
    var id = '';
    try { id = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (_) { id = (location.hash || '').replace(/^#/, ''); }
    if (id) applyShortcut(document.getElementById(id));
  }
  document.addEventListener('click', function (e) {
    var link = closest(e.target, 'a[href^="#"]');
    if (!link) return;
    var id = '';
    try { id = decodeURIComponent(link.getAttribute('href').slice(1)); } catch (_) { return; }
    if (id) applyShortcut(document.getElementById(id));
  }, true);
  window.addEventListener('hashchange', shortcutFromHash);

  // Explorers decode their data when they scroll into view. Opening a report section or following a link also checks
  // explicitly, because visibility callbacks are delayed while a page is not being rendered.
  function wakeVisible() {
    Object.keys(instances).forEach(function (id) {
      var inst = instances[id];
      if (inst.loading || inst.failed || !inst.root.getClientRects().length) return;
      inst.load();
    });
  }
  var wakeSoon = debounce(wakeVisible, 60);
  function fitAll() {
    Object.keys(instances).forEach(function (id) { var inst = instances[id]; if (!inst.destroyed && inst.ds) inst.fitViewport(); });
  }
  document.addEventListener('hfx:report-shown', function (event) {
    initAll(event.target && event.target.querySelectorAll ? event.target : document);
    wakeVisible();
    // A page or chapter just shown has its explorers measured where they now stand.
    requestAnimationFrame(fitAll);
  });
  window.addEventListener('resize', debounce(fitAll, 120));
  document.addEventListener('click', wakeSoon, true);
  window.addEventListener('hashchange', wakeSoon);
  window.addEventListener('hfx:timezonechange', function () {
    Object.keys(instances).forEach(function (id) {
      var inst = instances[id];
      if (!inst.ds) return;
      var local = inst.ds.columns.filter(function (c) { return c.kind === 't' && c.local; });
      if (!local.length) return;
      // Search text is cached per column; it was built for the other zone.
      local.forEach(function (c) { c._lower = null; });
      // The display zone also changes how unzoned filter operands and display-text searches are interpreted.
      try { inst.refresh(false); } catch (_) { }
    });
  });

  window.HfxDataExplorerSnapshots.install({ Explorer: Explorer, Data: Data, runQuery: runQuery });
  window.HfxDataExplorerExports.install({Explorer:Explorer,Data:Data,I:I,el:el,attr:attr,fmt:fmt,num:num,pad:pad,dict:dict});
  if (window.HfxDataExplorerMenus) window.HfxDataExplorerMenus.install({ Explorer: Explorer, qsa: qsa });
  if (window.HfxDataExplorerPrint) window.HfxDataExplorerPrint.install({ Explorer: Explorer, instances: instances, el: el, attr: attr, fmt: fmt, num: num, closest: closest, qsa: qsa, describeFilter: describeFilter, headerOf: headerOf, initAll: initAll });

  window.HfxDataExplorerScope.install({ Explorer: Explorer, I: I, el: el, attr: attr, num: num, describeFilter: describeFilter });

  function start() { initAll(); shortcutFromHash(); setTimeout(wakeVisible, 400); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.HfxDataExplorer = {
    // Optional hosts register before the explorer becomes visible; controls and query ownership stay here.
    registerViewportRenderer: function (name, factory) {
      if (!name || typeof factory !== 'function' || viewportRenderers[name]) throw new Error('HtmlForgeX: invalid or repeated viewport renderer.');
      viewportRenderers[name] = factory;
    },
    get: function (id) { return instances[id] || null; },
    init: initAll,
    // Applies a shortcut target (an element with data-hfx-dx-shortcut); false when the element is not one.
    applyShortcut: applyShortcut,
    loadDataset: Data.loadDataset,
    // Exposed for tests and integrations that build their own exports.
    internals: { Dataset: I.Dataset, buildPredicate: I.buildPredicate, runQuery: runQuery, queryPage: I.queryPage, formatNumber: I.formatNumber, safeHref: safeHref, toCsv: toCsv },
    toCsv: function (dataset, columnIds, rows) {
      var cols = columnIds.map(function (id) { return dataset.column(id); }).filter(Boolean);
      return toCsv(cols, rows);
    }
  };
})();
