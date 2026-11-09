// HtmlForgeX explorer remote behavior; installed by the shared bootstrap.
(function () {
  'use strict';
  window.HfxDataExplorerRemote = { install: function (context) {
    var Explorer = context.Explorer, Data = context.Data, I = context.I, qsa = context.qsa, closest = context.closest;
    var el = context.el, attr = context.attr, toneAttrs = context.toneAttrs, fmt = context.fmt, safeHref = context.safeHref;
    var openPageTarget = context.openPageTarget, linkNode = context.linkNode, num = context.num, pad = context.pad, dict = context.dict;
    var debounce = context.debounce, storageGet = context.storageGet, storageSet = context.storageSet, nextId = context.nextId, normOp = context.normOp;
    var OP_TOKENS = context.OP_TOKENS, runQuery = context.runQuery, headerOf = context.headerOf, toCsv = context.toCsv, opWord = context.opWord;
    var opsFor = context.opsFor, needsValue = context.needsValue, booleanWord = context.booleanWord, valueText = context.valueText, describeFilter = context.describeFilter;
    var removeFilterLabel = context.removeFilterLabel, instances = context.instances, MAX_CANVAS = context.MAX_CANVAS, MAX_WIDTH = context.MAX_WIDTH, WIDE_WIDTH = context.WIDE_WIDTH;
    var MIN_WIDTH = context.MIN_WIDTH, SAMPLE_ROWS = context.SAMPLE_ROWS, CELL_PAD = context.CELL_PAD, CHIP_PAD = context.CHIP_PAD, textWidth = context.textWidth;
    var viewportRenderers = context.viewportRenderers, MAX_ROW_TARGETS = context.MAX_ROW_TARGETS, PAGE_CACHE = context.PAGE_CACHE, PAGE_REQUESTS = context.PAGE_REQUESTS, QUICK_VALUES = context.QUICK_VALUES;
    var EXPORT_PAGE = context.EXPORT_PAGE;
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
      shared.facets = counted.map(function (c) { return { column: c.id, limit: self.facetLimits[c.id] || QUICK_VALUES }; });
      counts(shared);
    }
    quick.filter(function (c) { return self.hasQuick(c.id); }).forEach(function (c) {
      var own = self.remoteSpec(c.id);
      own.limit = 0;
      own.facets = [{ column: c.id, limit: self.facetLimits[c.id] || QUICK_VALUES }];
      counts(own);
    });

    // The rows are drawn as soon as they arrive; the counts fill the chips when they come.
    this.facets = dict();
    this.facetTruncated = dict();
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
        Object.keys(res.facets).forEach(function (k) { self.facets[k] = res.facets[k].values; self.facetTruncated[k] = !!res.facets[k].truncated; });
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
  }};
})();
