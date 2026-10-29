// HtmlForgeX explorer controls behavior; installed by the shared bootstrap.
(function () {
  'use strict';
  window.HfxDataExplorerControls = { install: function (context) {
    var Explorer = context.Explorer, Data = context.Data, I = context.I, qsa = context.qsa, closest = context.closest;
    var el = context.el, attr = context.attr, toneAttrs = context.toneAttrs, fmt = context.fmt, safeHref = context.safeHref;
    var openPageTarget = context.openPageTarget, linkNode = context.linkNode, num = context.num, pad = context.pad, dict = context.dict;
    var debounce = context.debounce, storageGet = context.storageGet, storageSet = context.storageSet, nextId = context.nextId, normOp = context.normOp;
    var OP_TOKENS = context.OP_TOKENS, runQuery = context.runQuery, headerOf = context.headerOf, toCsv = context.toCsv, opWord = context.opWord;
    var opsFor = context.opsFor, needsValue = context.needsValue, booleanWord = context.booleanWord, valueText = context.valueText, numericText = context.numericText, describeFilter = context.describeFilter;
    var removeFilterLabel = context.removeFilterLabel, instances = context.instances, MAX_CANVAS = context.MAX_CANVAS, MAX_WIDTH = context.MAX_WIDTH, WIDE_WIDTH = context.WIDE_WIDTH;
    var MIN_WIDTH = context.MIN_WIDTH, SAMPLE_ROWS = context.SAMPLE_ROWS, CELL_PAD = context.CELL_PAD, CHIP_PAD = context.CHIP_PAD, textWidth = context.textWidth;
    var viewportRenderers = context.viewportRenderers, MAX_ROW_TARGETS = context.MAX_ROW_TARGETS, PAGE_CACHE = context.PAGE_CACHE, PAGE_REQUESTS = context.PAGE_REQUESTS, QUICK_VALUES = context.QUICK_VALUES;
    var EXPORT_PAGE = context.EXPORT_PAGE;
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

  Explorer.prototype.totalRowsLabel = function () { var total = this.totalRows(); return total === null ? '…' : num(total); };


  Explorer.prototype.columnLayout = function (column) {
    var lines = this.cfg.columnWrapping && this.cfg.columnWrapping[column.id];
    return lines ? Object.assign({}, column.layout || {}, { wrap: true, maxLines: lines }) : column.layout;
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
    var current = this.currentView(), initialFilters = current && current.filters || [];
    var viewFilters = this.state.filters.filter(function (f) { return f.fromView; });
    var modified = !!this.nativeFiltersModified || viewFilters.length !== initialFilters.length || this.state.filters.some(function (f) { return !f.fromView; }) ||
      Object.keys(this.state.quick).some(function (id) { return self.hasQuick(id); });
    this.viewModified = !!current && modified;
    if (this.phoneView.hidden) { bar.hidden = true; return; }
    bar.hidden = false;
    all.forEach(function (item) {
      var v = item.v, on = v.id === self.state.view;
      var duplicateTitle = item.saved && all.some(function (other) { return !other.saved && other.v.title === v.title; });
      var title = v.title + (duplicateTitle ? ' · ' + (self.labels.savedView || 'Saved') : '');
      var b = el('button', 'hfx-dx-view' + (item.saved ? ' is-saved' : ''), title);
      attr(b, 'type', 'button'); attr(b, 'role', 'tab'); attr(b, 'aria-selected', on ? 'true' : 'false');
      var count = self.viewCounts && self.viewCounts[v.id];
      var option = el('option', null, title + (count !== undefined ? ' · ' + num(count) : ''));
      option.value = v.id; option.selected = on;
      self.viewSelect.appendChild(option);
      if (count !== undefined) { b.textContent += ' · ' + num(count); attr(b, 'aria-label', title); attr(b, 'aria-description', num(count) + ' ' + (self.labels.rows || 'rows')); }
      if (on && modified) {
        var dot = el('span', 'hfx-dx-view-edited'); attr(dot, 'aria-hidden', 'true'); b.appendChild(dot);
        attr(b, 'aria-label', title + ', ' + (self.labels.modified || 'changed'));
        option.textContent += ' · ' + (self.labels.modified || 'changed');
      }
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

  // ---------------------------------------------------------------- linked views
  // Another component on the page narrows the rows with filters of its own (HtmlForgeX linked views): one entry per source,
  // { column, values, label }, joined with the reader's filters, shown as a chip and left out of saved views.
  Explorer.prototype.externalFilters = function () {
    var out = [], ext = this.external || dict();
    Object.keys(ext).forEach(function (source) { out.push({ source: source, column: ext[source].column, values: ext[source].values, label: ext[source].label }); });
    return out;
  };
  Explorer.prototype.setExternalFilter = function (source, filter, deferRefresh) {
    var ext = this.external || (this.external = dict());
    if (filter && filter.column && filter.values && filter.values.length) ext[source] = { column: filter.column, values: filter.values.map(String), label: filter.label || '' };
    else if (ext[source]) delete ext[source];
    else return;
    if (this.ds && !deferRefresh) this.refresh(false);
  };
  // The reader's own equality and list filters, by column: what this explorer tells the components it drives.
  Explorer.prototype.linkValues = function () {
    var out = dict(), spec = this.querySpec(undefined, true, forSavedView);
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

  Explorer.prototype.fonts = function () {
    if (!this.fontSet) {
      var style = getComputedStyle(this.root);
      var family = style.fontFamily || 'sans-serif';
      var mono = (style.getPropertyValue('--as-mono') || '').trim() || 'monospace';
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
      sizes.push(col.kind === 'a' ? (v || []).reduce(function (width, tag) { return width + textWidth(tag.label === undefined ? tag.labelKey : tag.label, font) + CHIP_PAD; }, 0) : textWidth(text, font));
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
  Explorer.prototype.fillTags = function (parent, values) {
    var list = el('span', 'hfx-dx-tags');
    (values || []).forEach(function (tag) {
      var chip = el('span', 'hfx-as-chip hfx-dx-tag', tag.label === undefined ? tag.labelKey : tag.label);
      if (tag.tone) toneAttrs(chip, tag.tone);
      if (tag.tooltip) attr(chip, 'title', tag.tooltip);
      attr(chip, 'data-hfx-tag', tag.labelKey); list.appendChild(chip);
    });
    parent.appendChild(list);
  };
  Explorer.prototype.fillCell = function (cell, r, c) {
      var v = c.raw(r); cell.textContent = '';
      if (c.kind === 'a') { this.fillTags(cell, v); return; }
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
      var view = { scopeView: def.scopeView, id: 'saved-' + Date.now().toString(36), title: title, columns: def.columns, keys: def.keys, groupBy: (def.groupBy || []).slice(), filters: (def.filters || []).map(function (f) { return { column: f.column, op: f.op, values: f.values || (f.value !== undefined ? [f.value] : []) }; }), sort: def.sort || [], search: def.search || '', searchIn: def.searchIn, stableKeyOrder: !!def.stableKeyOrder, labels: def.labels || {}, limit: def.limit > 0 ? def.limit : null };
      self.saved.push(view);
      storageSet(self.storageKey, self.saved);
      input.value = '';
      if (typeof done === 'function') done(); else self.closeMenus();
      self.applyView(view, false);
    });
    panel.appendChild(form);
  };

  // ---- drawer
  }};
})();
