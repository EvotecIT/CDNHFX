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
    return word == null ? op === 'tag' ? 'has tag' : op : word;
  }

  function opsFor(col) {
    if (col.kind === 'a') return ['tag', 'contains', 'ncontains', 'empty', 'nempty'];
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
    this.facetLimits = dict();
    this.facetTruncated = dict();
    this.quickShown = dict();
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
    this.nativeFiltersModified = false;
    this.nativeFilterDetails = [];
    this.nativeFilterGroup = false;
    var cols = (view && view.columns && view.columns.length ? view.columns : this.defaultColumns()).filter(function (id) { return ds.column(id); });
    this.state = {
      view: view ? view.id : null,
      columns: cols.map(function (id) { return ds.column(id).id; }),
      keys: view && view.keys !== undefined ? view.keys.slice() : undefined,
      filters: (view && view.filters || []).map(function (f) { return { column: f.column, op: f.op, values: (f.values || []).slice(), fromView: true }; }),
      groupBy: (view && view.groupBy || []).slice(),
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
    if (spec.groupBy !== undefined) this.state.groupBy = spec.groupBy.slice();
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
    var st = this.state, ds = this.ds;
    var filters = st.filters.map(function (f) { return { column: f.column, op: f.op, values: f.values }; });
    // Filters other components apply through linked views (setExternalFilter) narrow the rows too, outside saved views.
    if (!skipExternal) this.externalFilters().forEach(function (f) { filters.push({ column: f.column, op: 'in', values: f.values }); });
    Object.keys(st.quick).forEach(function (colId) {
      if (colId === skipQuick) return;
      var set = st.quick[colId];
      var vals = Object.keys(set).filter(function (k) { return set[k]; });
      if (vals.length) filters.push({ column: colId, op: ds.column(colId).kind === 'a' ? 'has-tag' : 'in', values: vals });
    });
    return { filters: filters, search: st.search, searchIn: st.searchIn, columns: st.columns, groupBy: st.groupBy, sort: st.sort, limit: st.limit,
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
    this.renderViews();
    var body = this.root.querySelector('[data-hfx-dx-body]');
    if (body && this.cfg.fitViewport && this.cfg.fitViewport.fill) body.classList.toggle('is-window-fill', this.size() > 0);
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
      if (!closest(e.target, '.hfx-dx-quick-group')) {
        qsa(self.root, '.hfx-dx-quick-group[open]').forEach(function (group) { group.open = false; });
        self.openQuick = null;
      }
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

  var componentContext = {
    Explorer: Explorer, Data: Data, I: I, qsa: qsa, closest: closest,
    el: el, attr: attr, toneAttrs: toneAttrs, fmt: fmt, safeHref: safeHref,
    openPageTarget: openPageTarget, linkNode: linkNode, num: num, pad: pad, dict: dict,
    debounce: debounce, storageGet: storageGet, storageSet: storageSet, nextId: nextId, normOp: normOp,
    OP_TOKENS: OP_TOKENS, runQuery: runQuery, headerOf: headerOf, toCsv: toCsv, opWord: opWord,
    opsFor: opsFor, needsValue: needsValue, booleanWord: booleanWord, valueText: valueText, numericText: numericText, describeFilter: describeFilter,
    removeFilterLabel: removeFilterLabel, instances: instances, MAX_CANVAS: MAX_CANVAS, MAX_WIDTH: MAX_WIDTH, WIDE_WIDTH: WIDE_WIDTH,
    MIN_WIDTH: MIN_WIDTH, SAMPLE_ROWS: SAMPLE_ROWS, CELL_PAD: CELL_PAD, CHIP_PAD: CHIP_PAD, textWidth: textWidth,
    viewportRenderers: viewportRenderers, MAX_ROW_TARGETS: MAX_ROW_TARGETS, PAGE_CACHE: PAGE_CACHE, PAGE_REQUESTS: PAGE_REQUESTS, QUICK_VALUES: QUICK_VALUES,
    EXPORT_PAGE: EXPORT_PAGE
  };
  window.HfxDataExplorerRemote.install(componentContext);
  window.HfxDataExplorerControls.install(componentContext);
  window.HfxDataExplorerRecords.install(componentContext);
  window.HfxDataExplorerSnapshots.install({ Explorer: Explorer, Data: Data, runQuery: runQuery });
  window.HfxDataExplorerExports.install({Explorer:Explorer,Data:Data,I:I,el:el,attr:attr,fmt:fmt,num:num,pad:pad,dict:dict});
  if (window.HfxDataExplorerMenus) window.HfxDataExplorerMenus.install({ Explorer: Explorer, qsa: qsa });
  if (window.HfxDataExplorerPrint) window.HfxDataExplorerPrint.install({ Explorer: Explorer, instances: instances, el: el, attr: attr, fmt: fmt, num: num, closest: closest, qsa: qsa, describeFilter: describeFilter, headerOf: headerOf, initAll: initAll });

  window.HfxDataExplorerScope.install({ Explorer: Explorer, I: I, el: el, attr: attr, num: num, describeFilter: describeFilter });
  window.HfxDataExplorerFacets.install({ Explorer: Explorer, el: el, attr: attr, closest: closest, qsa: qsa, dict: dict, num: num, booleanWord: booleanWord, toneAttrs: toneAttrs, runQuery: runQuery, describeFilter: describeFilter, removeFilterLabel: removeFilterLabel, quickValues: QUICK_VALUES });

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
