// HtmlForgeX explorer records behavior; installed by the shared bootstrap.
(function () {
  'use strict';
  window.HfxDataExplorerRecords = { install: function (context) {
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

    var explicit = self.cfg.drawerColumns && self.cfg.drawerColumns.length, sections = [], byGroup = dict();
    var columns = explicit ? self.cfg.drawerColumns.map(function (id) { return ds.column(id); }).filter(Boolean) : ds.columns;
    columns.forEach(function (c) {
      if (!explicit && c.drawer === false) return;
      var name = c.group || labels.details, section;
      if (explicit) {
        section = sections[sections.length - 1];
        if (!section || section.name !== name) { section = { name: name, columns: [] }; sections.push(section); }
      } else {
        section = byGroup[name];
        if (!section) { section = byGroup[name] = { name: name, columns: [] }; sections.push(section); }
      }
      section.columns.push(c);
    });
    if (!explicit) {
      var preferred = this.cfg.drawerGroups || [];
      sections = preferred.map(function (name) { return byGroup[name]; }).filter(Boolean)
        .concat(sections.filter(function (section) { return preferred.indexOf(section.name) < 0; }));
    }
    sections.forEach(function (group) {
      var g = group.name, cols = group.columns.filter(function (c) { return showEmpty || c.raw(r) !== null; });
      if (!cols.length) return;
      var sec = el('section', 'hfx-dx-dsec');
      sec.appendChild(el('h3', null, g));
      var dl = el('dl', 'hfx-dx-fields');
      cols.forEach(function (c) {
        var dt = el('dt', null, self.cfg.drawerLabels && self.cfg.drawerLabels[c.id] || c.label);
        if (c.description) attr(dt, 'title', c.description);
        var dd = el('dd');
        var v = c.raw(r), text = valueText(labels, c, v, 'export');
        var tone = c.tone(v);
        if (c.kind === 'a') {
          self.fillTags(dd, v);
        } else if (numericText(dd, c, v, text, true)) {
          // Keep threshold explanations beside the raw number in record details.
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
            if (numericText(td, c, v, text, false)) { /* Threshold explanations stay in the tooltip. */ }
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
  }};
})();
