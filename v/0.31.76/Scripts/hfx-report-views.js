// HtmlForgeX report views: behaviour of the view archetypes that need script. Everything is delegated from the
// document, so views that a report inserts later (a drawer panel, an entity panel) work without registration.
(function () {
  if (window.hfxReportViews) return;

  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function closest(el, sel) { try { return el && el.closest ? el.closest(sel) : null; } catch (_) { return null; } }
  function norm(s) { return (s || '').toString().toLowerCase(); }
  function format(template, a, b) { return (template || '').replace('{0}', a).replace('{1}', b); }

  // An empty-state action targets one named view. Each view keeps ownership of its filter behavior; the explorer's
  // existing clear operation preserves its selected view definition and only drops reader-applied constraints.
  document.addEventListener('click', function (e) {
    var button = closest(e.target, '[data-hfx-rv-clear-filters]');
    if (!button) return;
    var root = document.getElementById(button.getAttribute('data-hfx-rv-clear-filters'));
    if (!root) return;
    var explorerRoot = root.hasAttribute('data-hfx-dx') ? root : root.querySelector('[data-hfx-dx]');
    var explorer = explorerRoot && explorerRoot.hfxDataExplorer;
    if (explorer && explorer.state) explorer.clearFilters();
    else {
      qsa(root, '[data-hfx-rv-facet]').forEach(function (select) {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      qsa(root, '[data-hfx-rv-filter-input], [data-hfx-rv-matrix-filter]').forEach(function (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      qsa(root, '[data-hfx-rv-chips] [data-hfx-rv-chip=""][aria-pressed="false"]').forEach(function (all) { all.click(); });
      var attention = root.querySelector('[data-hfx-rv-matrix-attention][aria-pressed="true"]');
      if (attention) attention.click();
    }
    var search = root.querySelector('[data-hfx-dx-search], [data-hfx-rv-filter-input], [data-hfx-rv-matrix-filter]');
    if (search) search.focus();
  });

  // ------------------------------------------------------------------ text filter
  // A container marked data-hfx-rv-filter filters its [data-search] items by the words typed into its filter box.
  // Every word has to occur. A pressed chip of its [data-hfx-rv-chips] group also keeps only the items of that
  // [data-category]. Groups without a visible item are hidden, and the count is announced.
  function applyFilter(root) {
    if (!root) return;
    var input = root.querySelector('[data-hfx-rv-filter-input]');
    var words = norm(input ? input.value : '').split(/\s+/).filter(Boolean);
    var chip = root.querySelector('[data-hfx-rv-chips] [data-hfx-rv-chip][aria-pressed="true"]');
    var category = chip ? chip.getAttribute('data-hfx-rv-chip') : '';
    var facets = qsa(root, '[data-hfx-rv-facet]').filter(function (select) {
      return closest(select, '[data-hfx-rv-filter]') === root && select.value !== '';
    });
    var items = qsa(root, '[data-search]');
    var shown = 0;
    items.forEach(function (item) {
      var text = item.getAttribute('data-search') || '';
      var values = {};
      try { values = JSON.parse(item.getAttribute('data-hfx-rv-facets') || '{}'); } catch (_) { }
      var match = words.every(function (w) { return text.indexOf(w) >= 0; }) &&
        (!category || item.getAttribute('data-category') === category) &&
        facets.every(function (select) { return Object.prototype.hasOwnProperty.call(values, select.getAttribute('data-hfx-rv-facet')) && values[select.getAttribute('data-hfx-rv-facet')] === select.value; });
      item.classList.toggle('hfx-rv-filtered', !match);
      if (match) shown++;
    });
    qsa(root, '[data-hfx-rv-filter-group]').forEach(function (group) {
      group.classList.toggle('hfx-rv-filtered', !group.querySelector('[data-search]:not(.hfx-rv-filtered)'));
    });
    var none = root.querySelector('[data-hfx-rv-filter-none]');
    if (none) none.hidden = shown > 0;
    var count = root.querySelector('[data-hfx-rv-filter-count]');
    var filtered = words.length > 0 || !!category || facets.length > 0;
    // A timeline sized to its panel shows every rendered match while it is filtered.
    root.classList.toggle('is-filtering', filtered);
    if (root.hasAttribute('data-hfx-rv-fit-min') && window.hfxReportLayout) window.hfxReportLayout.layout(document);
    if (count) count.textContent = filtered ? format(count.getAttribute('data-hfx-rv-filter-count'), shown, items.length) : '';
    // Matches folded under "show more" would otherwise stay out of sight.
    if (filtered) qsa(root, 'details.hfx-rv-changes-more').forEach(function (more) { more.open = true; });
  }

  // A chip of a [data-hfx-rv-chips] group is one choice of several: pressing it releases the others.
  document.addEventListener('click', function (e) {
    var chip = closest(e.target, '[data-hfx-rv-chips] [data-hfx-rv-chip]');
    if (!chip) return;
    qsa(closest(chip, '[data-hfx-rv-chips]'), '[data-hfx-rv-chip]').forEach(function (other) {
      other.setAttribute('aria-pressed', other === chip ? 'true' : 'false');
    });
    applyFilter(closest(chip, '[data-hfx-rv-filter]'));
  });

  document.addEventListener('input', function (e) {
    var target = e.target;
    if (target && target.matches && target.matches('[data-hfx-rv-filter-input]')) applyFilter(closest(target, '[data-hfx-rv-filter]'));
  });
  document.addEventListener('change', function (e) {
    var target = e.target;
    if (target && target.matches && target.matches('[data-hfx-rv-facet]')) applyFilter(closest(target, '[data-hfx-rv-filter]'));
  });

  // Native disclosures retain their semantics; newly visible grids receive the shared reveal lifecycle.
  document.addEventListener('toggle', function (e) {
    var panel = e.target;
    if (panel.matches && panel.matches('details.hfx-as-panel') && panel.open)
      panel.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true }));
  }, true);

  // ------------------------------------------------------------------ class toggles
  // A button marked data-hfx-rv-toggle="class" switches that class on the view it belongs to.
  document.addEventListener('click', function (e) {
    var button = closest(e.target, '[data-hfx-rv-toggle]');
    if (!button) return;
    var view = closest(button, '.hfx-as');
    if (!view) return;
    var on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    view.classList.toggle(button.getAttribute('data-hfx-rv-toggle'), on);
    // Rows may have been hidden: keep the one tab stop of a grid on a row that is still shown.
    qsa(view, '[data-hfx-rv-grid]').forEach(restoreGridTabStop);
  });

  // ------------------------------------------------------------------ grid keyboard (static tables)
  // A table marked data-hfx-rv-grid has one tab stop; arrow keys move between its body cells and Enter follows the
  // link of a cell.
  function gridCells(row) { return Array.prototype.slice.call(row.children); }
  function gridRows(table) {
    return qsa(table, 'tbody > tr').filter(function (tr) { return tr.offsetParent !== null || tr.getClientRects().length; });
  }
  function prepareGrid(table) {
    if (table.__hfxGrid) return;
    table.__hfxGrid = true;
    qsa(table, 'tbody a').forEach(function (a) { a.tabIndex = -1; });
    restoreGridTabStop(table);
  }
  function restoreGridTabStop(table) {
    var rows = gridRows(table);
    var current = table.querySelector('tbody > tr > [tabindex="0"]');
    if (current && rows.indexOf(current.parentNode) >= 0) return;
    if (current) current.tabIndex = -1;
    // Before layout (a hidden page) no row measures as shown; the first row is then the best guess.
    var first = rows.length ? rows[0].firstElementChild : table.querySelector('tbody > tr > *');
    if (first) first.tabIndex = 0;
  }
  // Pinned header cells cover the edges of the scrolling frame; tell the browser, so a focused cell is never
  // scrolled underneath them.
  function padScroll(table) {
    var scroller = closest(table, '.hfx-rv-matrix-scroll');
    var head = table.tHead;
    if (!scroller || !head) return;
    var corner = head.rows.length ? head.rows[0].firstElementChild : null;
    scroller.style.scrollPaddingTop = head.offsetHeight + 'px';
    scroller.style.scrollPaddingInlineStart = (corner ? corner.offsetWidth : 0) + 'px';
  }
  function moveGridFocus(table, from, to) {
    if (!to || to === from) return;
    from.tabIndex = -1;
    to.tabIndex = 0;
    padScroll(table);
    to.focus({ preventScroll: true });
    try { to.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { }
  }
  document.addEventListener('keydown', function (e) {
    var cell = closest(e.target, '[data-hfx-rv-grid] tbody > tr > *');
    if (!cell || e.altKey || e.metaKey) return;
    var table = closest(cell, '[data-hfx-rv-grid]');
    var rows = gridRows(table);
    var r = rows.indexOf(cell.parentNode);
    var c = gridCells(cell.parentNode).indexOf(cell);
    if (r < 0) return;
    var last = gridCells(rows[r]).length - 1;
    switch (e.key) {
      case 'ArrowDown': r = Math.min(rows.length - 1, r + 1); break;
      case 'ArrowUp': r = Math.max(0, r - 1); break;
      case 'ArrowRight': c = Math.min(last, c + 1); break;
      case 'ArrowLeft': c = Math.max(0, c - 1); break;
      case 'PageDown': r = Math.min(rows.length - 1, r + 10); break;
      case 'PageUp': r = Math.max(0, r - 10); break;
      case 'Home': c = 0; if (e.ctrlKey) r = 0; break;
      case 'End': c = last; if (e.ctrlKey) r = rows.length - 1; break;
      case 'Enter': {
        var link = cell.querySelector('a');
        if (link) { e.preventDefault(); link.click(); }
        return;
      }
      default: return;
    }
    e.preventDefault();
    var target = gridCells(rows[r]);
    moveGridFocus(table, cell, target[Math.min(c, target.length - 1)]);
  });
  document.addEventListener('focusin', function (e) {
    var cell = closest(e.target, '[data-hfx-rv-grid] tbody > tr > *');
    if (!cell || cell !== e.target) return;
    var table = closest(cell, '[data-hfx-rv-grid]');
    qsa(table, 'tbody > tr > [tabindex="0"]').forEach(function (other) { if (other !== cell) other.tabIndex = -1; });
    cell.tabIndex = 0;
  });
  document.addEventListener('click', function (e) {
    var cell = closest(e.target, '[data-hfx-rv-grid] tbody > tr > *');
    if (!cell) return;
    var table = closest(cell, '[data-hfx-rv-grid]');
    qsa(table, 'tbody > tr > [tabindex="0"]').forEach(function (other) { other.tabIndex = -1; });
    cell.tabIndex = 0;
  });

  // ------------------------------------------------------------------ status matrix
  // Draws the matrix from its JSON: a table whose body holds only the rows near the viewport. Rows are groups and
  // entities; a group row shows the worst status of each check and how many of its rows need attention.
  var ROW_HEIGHT = 30;
  var OVERSCAN = 8;
  var WINDOW_ABOVE = 80;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function applyStatus(node, status) {
    if (status.st) node.setAttribute('data-state', status.st);
    if (status.o) node.setAttribute('data-outcome', status.o);
    if (status.s) node.setAttribute('data-severity', status.s);
    return node;
  }

  function markFor(status) {
    var mark = applyStatus(el('span', 'hfx-rv-mark'), status);
    mark.setAttribute('aria-hidden', 'true');
    return mark;
  }

  function initMatrix(root) {
    if (root.__hfxMatrix) return root.__hfxMatrix;
    var source = root.querySelector('[data-hfx-rv-matrix-data]');
    if (!source) return null;
    var data;
    try { data = JSON.parse(source.textContent); } catch (_) { return null; }
    var host = source.parentNode;
    data.rows.forEach(function (row, index) {
      row.i = index;
      row.a = row.c.some(function (ix) { return data.statuses[ix].a; });
      row.s = norm(row.l + ' ' + (row.g || ''));
    });

    var scroller = el('div', 'hfx-rv-matrix-scroll');
    var table = el('table', 'hfx-rv-matrix-grid');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', data.labels.grid);
    table.setAttribute('aria-colcount', String(data.columns.length + 1));
    var thead = el('thead');
    var headRow = el('tr');
    headRow.setAttribute('role', 'row');
    headRow.setAttribute('aria-rowindex', '1');
    var corner = el('th', 'hfx-rv-matrix-corner', data.rowHeader);
    corner.setAttribute('role', 'columnheader');
    corner.scope = 'col';
    headRow.appendChild(corner);
    data.columns.forEach(function (title) {
      var th = el('th', 'hfx-rv-matrix-col');
      th.setAttribute('role', 'columnheader');
      th.scope = 'col';
      th.title = title;
      th.appendChild(el('span', null, title));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    var tbody = el('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    scroller.appendChild(table);
    host.insertBefore(scroller, host.firstChild);
    host.classList.add('is-enhanced');
    root.classList.add('is-live');
    // Only the rows near the viewport are drawn, so the name column gets its width from the data, not from them.
    var longest = data.rowHeader.length;
    data.rows.forEach(function (row) {
      longest = Math.max(longest, row.l.length, row.g ? row.g.length + 12 : 0);
    });
    table.style.setProperty('--rv-matrix-name', Math.max(150, Math.min(280, Math.round(longest * 7.6 + 36))) + 'px');

    var state = {
      root: root, data: data, host: host, scroller: scroller, table: table, thead: thead, tbody: tbody,
      words: [], attentionOnly: false, open: Object.create(null), model: [], active: { key: null, col: -1 }, first: -1, last: -1
    };
    root.__hfxMatrix = state;

    var pending = false;
    scroller.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      (window.requestAnimationFrame || window.setTimeout)(function () { pending = false; renderMatrix(state, false); });
    });
    table.addEventListener('keydown', function (e) { matrixKey(state, e); });
    table.addEventListener('focusin', function (e) {
      var cell = closest(e.target, '[data-col]');
      if (!cell) return;
      var key = cell.parentNode.getAttribute('data-key');
      var col = Number(cell.getAttribute('data-col'));
      if (state.active.key === key && state.active.col === col) return;
      var previous = state.tbody.querySelector('[tabindex="0"]');
      if (previous) previous.tabIndex = -1;
      cell.tabIndex = 0;
      state.active = { key: key, col: col };
    });
    table.addEventListener('click', function (e) {
      var header = closest(e.target, '.hfx-rv-matrix-group > th');
      if (header) toggleGroup(state, header.parentNode.getAttribute('data-key').slice(2), true);
    });
    var filter = root.querySelector('[data-hfx-rv-matrix-filter]');
    if (filter) filter.addEventListener('input', function () {
      state.words = norm(filter.value).split(/\s+/).filter(Boolean);
      rebuildMatrix(state, true);
    });
    var attention = root.querySelector('[data-hfx-rv-matrix-attention]');
    if (attention) state.attentionOnly = attention.getAttribute('aria-pressed') === 'true';
    if (attention) attention.addEventListener('click', function () {
      state.attentionOnly = !state.attentionOnly;
      attention.setAttribute('aria-pressed', state.attentionOnly ? 'true' : 'false');
      rebuildMatrix(state, true);
    });
    rebuildMatrix(state, false);
    return state;
  }

  function groupOpen(state, name) { return !!state.open[name] || state.words.length > 0; }

  function rebuildMatrix(state, announce) {
    var data = state.data;
    var rows = data.rows.filter(function (row) {
      if (state.attentionOnly && !row.a) return false;
      return state.words.every(function (w) { return row.s.indexOf(w) >= 0; });
    });
    var model = [];
    if (data.grouped) {
      var groups = Object.create(null);
      var order = [];
      rows.forEach(function (row) {
        var name = row.g || data.labels.ungrouped;
        if (!groups[name]) { groups[name] = []; order.push(name); }
        groups[name].push(row);
      });
      order.forEach(function (name) {
        model.push({ key: 'g:' + name, group: name, rows: groups[name] });
        if (groupOpen(state, name)) groups[name].forEach(function (row) { model.push({ key: 'r:' + row.i, row: row }); });
      });
    } else {
      rows.forEach(function (row) { model.push({ key: 'r:' + row.i, row: row }); });
    }
    state.model = model;
    state.shown = rows.length;
    if (!model.some(function (m) { return m.key === state.active.key; })) state.active = { key: model.length ? model[0].key : null, col: -1 };
    var none = state.root.querySelector('[data-hfx-rv-matrix-none]');
    if (none) none.hidden = rows.length > 0;
    state.scroller.hidden = rows.length === 0;
    var count = state.root.querySelector('[data-hfx-rv-matrix-count]');
    if (count) count.textContent = (announce || state.words.length || state.attentionOnly) && rows.length !== data.rows.length
      ? format(data.labels.shown, rows.length, data.rows.length) : '';
    renderMatrix(state, true);
  }

  function toggleGroup(state, name, keepFocus) {
    // A filter opens every group that has a match; closing one then would hide what was asked for.
    if (state.words.length) return;
    state.open[name] = !state.open[name];
    state.active = { key: 'g:' + name, col: -1 };
    rebuildMatrix(state, false);
    if (keepFocus) focusActive(state);
  }

  function indexOfActive(state) {
    for (var i = 0; i < state.model.length; i++) if (state.model[i].key === state.active.key) return i;
    return -1;
  }

  function renderMatrix(state, force) {
    var total = state.model.length;
    var first = 0;
    var last = total;
    if (total > WINDOW_ABOVE) {
      var view = state.scroller.clientHeight || 520;
      var visibleFirst = Math.max(0, Math.floor(state.scroller.scrollTop / ROW_HEIGHT));
      var visibleLast = Math.min(total, Math.ceil((state.scroller.scrollTop + view) / ROW_HEIGHT));
      // The drawn window is larger than the viewport; it is redrawn only when the viewport leaves it.
      if (!force && visibleFirst >= state.first && visibleLast <= state.last) return;
      first = Math.max(0, visibleFirst - OVERSCAN);
      last = Math.min(total, visibleLast + OVERSCAN);
    } else if (!force && state.first === 0 && state.last === total) {
      return;
    }
    var hadFocus = state.tbody.contains(document.activeElement);
    state.first = first;
    state.last = last;
    var columns = state.data.columns.length + 1;
    var fragment = document.createDocumentFragment();
    if (first > 0) fragment.appendChild(spacer(first * ROW_HEIGHT, columns));
    for (var i = first; i < last; i++) fragment.appendChild(matrixRow(state, i));
    if (last < total) fragment.appendChild(spacer((total - last) * ROW_HEIGHT, columns));
    state.tbody.textContent = '';
    state.tbody.appendChild(fragment);
    state.table.setAttribute('aria-rowcount', String(total + 1));
    // Exactly one cell is in the tab order: the active one, or the first drawn row when the active one is far away.
    var active = activeCell(state) || state.tbody.querySelector('[data-col="-1"]');
    if (active) active.tabIndex = 0;
    if (hadFocus) focusActive(state);
  }

  function spacer(height, columns) {
    var tr = el('tr', 'hfx-rv-matrix-spacer');
    tr.setAttribute('aria-hidden', 'true');
    var td = el('td');
    td.colSpan = columns;
    td.style.height = height + 'px';
    tr.appendChild(td);
    return tr;
  }

  function matrixRow(state, index) {
    var data = state.data;
    var item = state.model[index];
    var tr = el('tr');
    tr.setAttribute('role', 'row');
    tr.setAttribute('aria-rowindex', String(index + 2));
    tr.setAttribute('data-key', item.key);
    var header = el('th', 'hfx-rv-matrix-name');
    header.setAttribute('role', 'rowheader');
    header.scope = 'row';
    header.tabIndex = -1;
    header.setAttribute('data-col', '-1');
    tr.appendChild(header);
    if (item.group !== undefined) {
      tr.className = 'hfx-rv-matrix-group';
      var open = groupOpen(state, item.group);
      header.setAttribute('aria-expanded', open ? 'true' : 'false');
      var chevron = el('span', 'hfx-rv-matrix-chevron', '›');
      chevron.setAttribute('aria-hidden', 'true');
      header.appendChild(chevron);
      header.appendChild(el('span', null, item.group));
      header.appendChild(el('small', null, format(data.labels.rowCount, item.rows.length)));
      header.title = (open ? data.labels.collapse : data.labels.expand) + ' ' + item.group;
      header.setAttribute('aria-label', item.group + ', ' + format(data.labels.rowCount, item.rows.length));
      if (!item.summary) item.summary = summarise(data, item.rows);
      for (var c = 0; c < data.columns.length; c++) {
        var worst = item.summary[c].worst;
        var attention = item.summary[c].attention;
        var name = item.group + ', ' + data.columns[c] + ': ' + data.labels.groupCell.replace('{0}', attention).replace('{1}', item.rows.length).replace('{2}', worst.l);
        tr.appendChild(matrixCell(c, worst, attention > 0 ? String(attention) : null, name));
      }
    } else {
      var row = item.row;
      if (row.h) {
        var link = el('a', null, row.l);
        link.href = row.h;
        link.tabIndex = -1;
        if (row.e) link.setAttribute('data-hfx-shell-entity', row.e);
        else if (row.h.charAt(0) === '#') link.setAttribute('data-hfx-as-link', row.h.slice(1));
        header.appendChild(link);
      } else {
        header.textContent = row.l;
      }
      header.title = row.l;
      for (var k = 0; k < data.columns.length; k++) {
        var cellStatus = data.statuses[row.c[k]];
        var text = row.t ? row.t[k] : null;
        tr.appendChild(matrixCell(k, cellStatus, text, row.l + ', ' + data.columns[k] + ': ' + cellStatus.l + (text ? ' (' + text + ')' : '')));
      }
    }
    return tr;
  }

  // The worst status and the number of rows that need attention, per column, for one group of rows.
  function summarise(data, rows) {
    var summary = [];
    for (var c = 0; c < data.columns.length; c++) {
      var worst = data.statuses[0];
      var attention = 0;
      for (var r = 0; r < rows.length; r++) {
        var status = data.statuses[rows[r].c[c]];
        if (status.r > worst.r) worst = status;
        if (status.a) attention++;
      }
      summary.push({ worst: worst, attention: attention });
    }
    return summary;
  }

  function matrixCell(column, status, text, name) {
    var td = el('td', 'hfx-rv-cell');
    td.setAttribute('role', 'gridcell');
    td.tabIndex = -1;
    td.setAttribute('data-col', String(column));
    td.setAttribute('aria-label', name);
    td.title = name;
    td.appendChild(markFor(status));
    if (text) {
      var label = el('span', 'hfx-rv-cell-text', text);
      label.setAttribute('aria-hidden', 'true');
      td.appendChild(label);
    }
    return td;
  }

  function activeCell(state) {
    if (state.active.key === null) return null;
    var rows = state.tbody.children;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-key') === state.active.key) return rows[i].querySelector('[data-col="' + state.active.col + '"]');
    }
    return null;
  }

  function focusActive(state) {
    var cell = activeCell(state);
    if (cell) { cell.tabIndex = 0; padScroll(state.table); cell.focus({ preventScroll: true }); }
  }

  function ensureVisible(state, index) {
    if (state.model.length <= WINDOW_ABOVE) {
      var cell = activeCell(state);
      if (cell) { try { cell.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { } }
      return;
    }
    var head = state.thead.offsetHeight || 0;
    var view = Math.max(ROW_HEIGHT, state.scroller.clientHeight - head);
    var top = index * ROW_HEIGHT;
    if (top < state.scroller.scrollTop) state.scroller.scrollTop = top;
    else if (top + ROW_HEIGHT > state.scroller.scrollTop + view) state.scroller.scrollTop = top + ROW_HEIGHT - view;
  }

  function matrixKey(state, e) {
    if (e.altKey || e.metaKey || !closest(e.target, '[data-col]')) return;
    var index = indexOfActive(state);
    if (index < 0) return;
    var item = state.model[index];
    var col = state.active.col;
    var lastCol = state.data.columns.length - 1;
    var lastRow = state.model.length - 1;
    switch (e.key) {
      case 'ArrowDown': index = Math.min(lastRow, index + 1); break;
      case 'ArrowUp': index = Math.max(0, index - 1); break;
      case 'ArrowRight':
        if (item.group !== undefined && col === -1 && !groupOpen(state, item.group)) { e.preventDefault(); toggleGroup(state, item.group, true); return; }
        col = Math.min(lastCol, col + 1);
        break;
      case 'ArrowLeft':
        if (item.group !== undefined && col === -1 && state.open[item.group]) { e.preventDefault(); toggleGroup(state, item.group, true); return; }
        col = Math.max(-1, col - 1);
        break;
      case 'PageDown': index = Math.min(lastRow, index + 10); break;
      case 'PageUp': index = Math.max(0, index - 10); break;
      case 'Home': col = -1; if (e.ctrlKey) index = 0; break;
      case 'End': col = lastCol; if (e.ctrlKey) index = lastRow; break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (item.group !== undefined) { toggleGroup(state, item.group, true); return; }
        var cell = activeCell(state);
        var link = cell && cell.parentNode.querySelector('a');
        if (link) link.click();
        return;
      default: return;
    }
    e.preventDefault();
    state.active = { key: state.model[index].key, col: col };
    ensureVisible(state, index);
    renderMatrix(state, true);
    focusActive(state);
    var focused = activeCell(state);
    if (focused) { try { focused.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { } }
  }

  function prepareDrawings(scope) {
    var drawings = qsa(scope, '[data-hfx-rv-drawing-gzip]').map(function (node) {
      if (!node.__hfxDrawing) node.__hfxDrawing = window.hfxReportMarkup.read(node).then(function (markup) {
        var holder = document.createElement('template'); holder.innerHTML = markup;
        node.parentNode.replaceChild(holder.content, node);
      });
      return node.__hfxDrawing;
    });
    return Promise.all(drawings).then(function () {
      if (drawings.length && scope.dispatchEvent) scope.dispatchEvent(new CustomEvent('hfx:report-drawings-ready', { bubbles: true }));
    });
  }
  function initViews(scope) {
    window.hfxReportViews.ready = prepareDrawings(scope);
    qsa(scope, '[data-hfx-rv-grid]').forEach(prepareGrid);
    qsa(scope, '[data-hfx-rv-matrix]').forEach(function (root) {
      var state = initMatrix(root);
      // A matrix that was drawn while its page was hidden had no height to measure.
      if (state) renderMatrix(state, true);
    });
  }

  window.hfxReportViews = { applyFilter: applyFilter, init: initViews, prepareDrawings: prepareDrawings, ready: Promise.resolve() };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initViews(document); });
  else initViews(document);
  // The report runtime announces content it has just shown or inserted (a page, a drawer panel).
  document.addEventListener('hfx:report-shown', function (e) {
    var scope = e.target && e.target.querySelectorAll ? e.target : document;
    initViews(scope);
    // Tabs and deferred regions can insert closed disclosures after our beforeprint listener has already run.
    if (printOpened !== null) openPrintDisclosures(scope);
  });

  // ------------------------------------------------------------------ print
  // Items under a disclosure print too. The report shell opens the disclosures inside it; this covers views that are
  // used without a shell.
  var printOpened = null;
  function openPrintDisclosures(scope) {
    qsa(scope, 'details.hfx-rv-queue-more:not([open]), details.hfx-rv-consistency-more:not([open]), details[data-hfx-rv-print-open]:not([open])').forEach(function (details) {
      printOpened.push(details);
      details.open = true;
    });
  }
  window.addEventListener('beforeprint', function () {
    if (printOpened === null) printOpened = [];
    openPrintDisclosures(document);
  });
  window.addEventListener('afterprint', function () {
    if (!printOpened) return;
    printOpened.forEach(function (d) { d.open = false; });
    printOpened = null;
  });

})();
