/*
 * HtmlForgeX linked views: adapters for row components (hfx-linked-views.js explains the contract).
 *   grid, tree  CanopyX grids and trees: external filter chips, highlights and selection through the CanopyX link API,
 *               and the reader's selection and own filters through canopyx:linkchange.
 *   table       Classic tables (DataTablesTable): a filter of their own beside the reader's searches, removable chips,
 *               row highlights and selection through the Select extension.
 *   explorer    Data explorers: external filters with chips beside the reader's filters, and the reader's own filters.
 * apply returns false when the component could not apply an event, so the runtime does not count it as active.
 */
(function () {
  'use strict';

  var links = window.hfxLinks;
  if (!links || links.rowAdapters) return;
  links.rowAdapters = true;

  var MAX_VALUES = 1000, MAX_KEYS = 10000;
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  /** Cell text as a reader sees it: markup removed, spaces trimmed. */
  function plain(value) { return value === null || value === undefined ? '' : String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function contains(values, value) {
    if (value === null || value === undefined) return false;
    var text = plain(value);
    for (var i = 0; i < values.length; i++) if (values[i] === value || plain(values[i]) === text) return true;
    return false;
  }
  function cellValue(cell) { return cell !== null && typeof cell === 'object' && !Array.isArray(cell) ? cell.value : cell; }
  function report(error) { if (error && error.name !== 'AbortError' && window.console) console.error(error); }
  function short(text) { text = String(text || ''); return text.length > 128 ? text.slice(0, 127) + '…' : text; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // ---------- CanopyX grids and trees ----------
  function canopy(view) {
    var highlights = Object.create(null), selectSource = null, scopes = Object.create(null), watching = null;
    function root() { return document.querySelector('.hfx-cx[data-hfx-canopyx="' + links.css(view.ref) + '"]'); }
    function host() { var element = root(); return element && element.querySelector('[data-canopyx-host]'); }
    // The API of the grid mounted now: a host can mount, destroy and mount a view again.
    function api() { var element = host(); return element && element.canopyx; }
    /** Keys of the inline rows or nodes whose field holds one of the values. */
    function keysFor(grid, field, values) {
      var keys = [];
      if (grid.view.rows) {
        each(grid.view.rows, function (row) { if (row.cells && Object.prototype.hasOwnProperty.call(row.cells, field) && contains(values, cellValue(row.cells[field]))) keys.push(row.id); });
      } else if (grid.view.roots) {
        var first = grid.view.columns && grid.view.columns[0] && grid.view.columns[0].id, pending = grid.view.roots.slice();
        while (pending.length) {
          var node = pending.pop(), cells = node.cells || {};
          var value = field === first && !Object.prototype.hasOwnProperty.call(cells, field) ? node.label : Object.prototype.hasOwnProperty.call(cells, field) ? cellValue(cells[field]) : null;
          if (contains(values, value)) keys.push(node.id);
          each(node.children || [], function (child) { pending.push(child); });
        }
      }
      return keys.slice(0, MAX_KEYS);
    }
    function paintHighlights(grid) {
      var union = [], seen = Object.create(null);
      for (var key in highlights) if (Object.prototype.hasOwnProperty.call(highlights, key)) each(highlights[key], function (id) { if (!seen[id]) { seen[id] = true; union.push(id); } });
      return grid.setHighlight(union.slice(0, MAX_KEYS), { source: short(union.length ? lastLabel : '') || undefined }).catch(report);
    }
    var lastLabel = '';
    /** The reader's selection and own filters are separate scopes; the link follows both, the selection first. */
    function emit() {
      var values = Object.create(null), keys = [], labels = [], any = false;
      each(['select', 'filter'], function (scope) {
        var detail = scopes[scope];
        if (!detail) return;
        any = true;
        for (var name in detail.values) if (Object.prototype.hasOwnProperty.call(detail.values, name) && !Object.prototype.hasOwnProperty.call(values, name)) values[name] = detail.values[name];
        keys = keys.concat(detail.keys || []);
        if (detail.label) labels.push(detail.label);
      });
      links.selection(view.id, any ? { values: values, keys: keys, label: labels.join('; ') } : null);
    }
    return {
      element: root,
      bind: function (roles) {
        var element = host(), grid = element && element.canopyx;
        if (!grid) return false;
        if (watching === element) return true;
        watching = element;
        if (roles & 1) {
          grid.startLinkEvents().catch(report);
          element.addEventListener('canopyx:linkchange', function (event) {
            var detail = event.detail || {};
            scopes[detail.scope || 'select'] = detail.action === 'clear' ? null : detail;
            emit();
          });
        }
        // The reader removed a chip (or used Clear all): the sources whose filters went away let go of their selections.
        element.addEventListener('canopyx:externalfilter', function (event) {
          var detail = event.detail || {};
          if (detail.reason !== 'user') return;
          var still = Object.create(null), mine = links.applied(view.id);
          each(detail.filters || [], function (filter) { still[filter.source] = true; });
          for (var key in mine) if (Object.prototype.hasOwnProperty.call(mine, key) && mine[key].action === 'filter' && !still[key]) links.removed(view.id, key);
        });
        return true;
      },
      apply: function (detail) {
        var grid = api();
        if (!grid) return false;
        try {
          if (detail.action === 'clear') {
            if (grid.getExternalFilters().some(function (filter) { return filter.source === detail.source; })) grid.setExternalFilter(detail.source, null).catch(report);
            if (highlights[detail.source]) { delete highlights[detail.source]; paintHighlights(grid); }
            if (selectSource === detail.source) { selectSource = null; grid.clearSelection(); }
            return true;
          }
          if (!grid.view.columns.some(function (column) { return column.id === detail.field; }) && !(detail.keys && detail.keys.length)) return false;
          var keys = detail.keys && detail.keys.length ? detail.keys.slice(0, MAX_KEYS) : keysFor(grid, detail.field, detail.values || []);
          if (detail.action === 'filter') {
            grid.setExternalFilter(detail.source, { field: detail.field, values: (detail.values || []).slice(0, MAX_VALUES), sourceLabel: short(detail.label) || undefined }).catch(report);
          } else if (detail.action === 'highlight') {
            highlights[detail.source] = keys; lastLabel = detail.label;
            paintHighlights(grid);
          } else if (detail.action === 'select') {
            if (grid.view.selection === 'none' || !keys.length) return false;
            selectSource = detail.source;
            grid.setSelection(grid.view.selection === 'single' ? keys.slice(0, 1) : keys);
          } else return false;
          return true;
        } catch (error) { report(error); return false; }
      },
      clearSelection: function () { var grid = api(); if (grid) try { grid.clearSelection(); } catch (error) { report(error); } }
    };
  }
  links.registerAdapter('grid', canopy);
  links.registerAdapter('tree', canopy);

  // ---------- classic tables (DataTablesTable) ----------
  var tableFilterInstalled = false;
  function installTableFilter($) {
    if (tableFilterInstalled) return;
    tableFilterInstalled = true;
    // One filter for every linked table, beside the reader's own searches: a row stays when it matches every link.
    $.fn.dataTable.ext.search.push(function (settings, searchData, index, rowData) {
      var filters = settings.nTable && settings.nTable.hfxLinkFilters;
      if (!filters) return true;
      for (var key in filters) if (Object.prototype.hasOwnProperty.call(filters, key)) {
        var filter = filters[key];
        var raw = filter.data !== null && rowData && typeof rowData === 'object' && !Array.isArray(rowData) ? rowData[filter.data] : Array.isArray(rowData) ? rowData[filter.column] : searchData[filter.column];
        if (!contains(filter.values, raw) && !contains(filter.values, searchData[filter.column])) return false;
      }
      return true;
    });
  }
  function table(view) {
    var dt = null, highlights = Object.create(null), selectSource = null;
    function element() { return document.getElementById(view.ref); }
    function settings() { return dt.settings()[0]; }
    /** The column a field names: its data property, else its title, without regard to case. */
    function column(field) {
      var columns = settings().aoColumns, wanted = String(field).toLowerCase();
      for (var i = 0; i < columns.length; i++) if (typeof columns[i].mData === 'string' && columns[i].mData.toLowerCase() === wanted) return i;
      for (var j = 0; j < columns.length; j++) if (plain(columns[j].sTitle).toLowerCase() === wanted) return j;
      return -1;
    }
    function rowValue(index, col) {
      var data = dt.row(index).data(), mData = settings().aoColumns[col].mData;
      if (data && typeof data === 'object' && !Array.isArray(data) && typeof mData === 'string') return Object.prototype.hasOwnProperty.call(data, mData) ? data[mData] : null;
      return plain(Array.isArray(data) ? data[col] : dt.cell(index, col).data());
    }
    function chips(focusNext) {
      var container = dt.table().container(), bar = container.previousElementSibling && container.previousElementSibling.hfxLinkChips ? container.previousElementSibling : null;
      var filters = element().hfxLinkFilters || {}, keys = Object.keys(filters);
      if (!keys.length) { if (bar) bar.remove(); if (focusNext) element().focus(); return; }
      if (!bar) { bar = document.createElement('div'); bar.className = 'hfx-links-chips'; bar.hfxLinkChips = true; container.parentNode.insertBefore(bar, container); }
      bar.textContent = '';
      each(keys, function (key) {
        var filter = filters[key], values = filter.values.slice(0, 3).join(', ') + (filter.values.length > 3 ? ' +' + (filter.values.length - 3) : '');
        var chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'hfx-links-chip';
        chip.textContent = links.text('chip', 'Filtered by {source}: {values}', { source: filter.label, values: values }) + ' ×';
        chip.setAttribute('aria-label', links.text('chip-remove', 'Remove the filter from {source}: {values}', { source: filter.label, values: values }));
        chip.addEventListener('click', function () { remove(key, true); links.removed(view.id, key); });
        bar.appendChild(chip);
      });
      if (focusNext) bar.firstElementChild.focus();
    }
    function remove(key, focusNext) { var filters = element().hfxLinkFilters; if (filters) delete filters[key]; chips(focusNext); dt.draw(false); }
    function paintHighlights() {
      var marks = [];
      for (var key in highlights) if (Object.prototype.hasOwnProperty.call(highlights, key)) marks.push(highlights[key]);
      dt.rows({ page: 'current' }).every(function (index) {
        var node = this.node();
        if (!node) return;
        node.classList.toggle('hfx-link-row', marks.some(function (mark) { return contains(mark.values, rowValue(index, mark.column)); }));
      });
    }
    return {
      element: element,
      bind: function (roles) {
        var target = element(), $ = window.jQuery;
        if (!target || !$ || !$.fn || !$.fn.dataTable) return false;
        if (target.hfxLinkBound) return !!dt;
        target.hfxLinkBound = true;
        function start() {
          if (dt) return;
          dt = $(target).DataTable();
          installTableFilter($);
          dt.on('draw.dt', paintHighlights);
          if (roles & 1) dt.on('select.dt deselect.dt', function () {
            var selected = dt.rows({ selected: true }).indexes().toArray();
            if (!selected.length) { links.selection(view.id, null); return; }
            var values = Object.create(null);
            each(settings().aoColumns, function (col, c) {
              var list = selected.slice(0, MAX_VALUES).map(function (index) { return rowValue(index, c); });
              each([typeof col.mData === 'string' ? col.mData : null, plain(col.sTitle)], function (name) { if (name) values[name] = list; });
            });
            links.selection(view.id, { values: values, label: selected.length + ' rows' });
          });
        }
        // Tables that start when they become visible bind then.
        if ($.fn.dataTable.isDataTable(target)) start(); else $(target).one('init.dt', function () { start(); links.refresh(); });
        return !!dt;
      },
      apply: function (detail) {
        var target = element();
        if (detail.action === 'clear') {
          if (!dt) return true;
          if (target.hfxLinkFilters && target.hfxLinkFilters[detail.source]) remove(detail.source, false);
          if (highlights[detail.source]) { delete highlights[detail.source]; paintHighlights(); }
          if (selectSource === detail.source && dt.rows().deselect) { selectSource = null; dt.rows().deselect(); }
          return true;
        }
        // A server-side table filters on its server, which this filter cannot reach.
        if (!dt || settings().oFeatures.bServerSide) return false;
        var col = column(detail.field), values = (detail.values || []).slice(0, MAX_VALUES);
        if (col < 0) return false;
        if (detail.action === 'filter') {
          var filters = target.hfxLinkFilters || (target.hfxLinkFilters = Object.create(null)), mData = settings().aoColumns[col].mData;
          filters[detail.source] = { column: col, data: typeof mData === 'string' ? mData : null, values: values, label: short(detail.label) };
          chips(false); dt.draw();
        } else if (detail.action === 'highlight') {
          highlights[detail.source] = { column: col, values: values };
          paintHighlights();
        } else if (detail.action === 'select') {
          if (!dt.rows().select) return false;
          selectSource = detail.source;
          dt.rows().deselect();
          dt.rows(function (index) { return contains(values, rowValue(index, col)); }).select();
        } else return false;
        return true;
      },
      clearSelection: function () { if (dt && dt.rows().deselect) dt.rows().deselect(); }
    };
  }
  links.registerAdapter('table', table);

  // ---------- data explorers ----------
  function explorer(view) {
    var lastValues = null;
    function element() { return document.getElementById(view.ref); }
    function instance() { var root = element(); return root && (root.hfxDataExplorer || (window.HfxDataExplorer && window.HfxDataExplorer.get && window.HfxDataExplorer.get(view.ref))); }
    return {
      element: element,
      bind: function (roles) {
        var root = element();
        if (!root) return false;
        if (!root.hfxLinkBound) {
          root.hfxLinkBound = true;
          if (roles & 1) root.addEventListener('hfx-dx:change', function () {
            var dx = instance();
            if (!dx || !dx.linkValues) return;
            var values = dx.linkValues();
            if (same(values, lastValues)) return;
            lastValues = values;
            links.selection(view.id, Object.keys(values).length ? { values: values } : null);
          });
          root.addEventListener('hfx-dx:externalfilter', function (event) {
            var detail = event.detail || {};
            if (detail.reason === 'user' && detail.source) links.removed(view.id, detail.source);
          });
          // Hidden explorers and remote schemas can finish after the runtime's bounded retry window.
          root.addEventListener('hfx-dx:ready', function () { links.refresh(); });
        }
        var dx = instance();
        return !!(dx && dx.ds && dx.loaded);
      },
      // Explorers take filters; highlights and selections are not theirs.
      apply: function (detail) {
        var dx = instance();
        if (!dx || !dx.setExternalFilter) return false;
        if (detail.action === 'filter') {
          if (!dx.ds || !dx.loaded || !dx.ds.column(detail.field)) return false;
          dx.setExternalFilter(detail.source, { column: detail.field, values: (detail.values || []).slice(0, MAX_VALUES), label: detail.label }); return true;
        }
        if (detail.action === 'clear') { dx.setExternalFilter(detail.source, null); return true; }
        return false;
      },
      clearSelection: function () { }
    };
  }
  links.registerAdapter('explorer', explorer);
})();
