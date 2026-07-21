  function normalizeSortValue(value) {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function compareSortValues(left, right) {
    var leftNumber = Number(left);
    var rightNumber = Number(right);
    if (left !== '' && right !== '' && !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  }

  function compareSortValuesForDirection(left, right, direction) {
    var leftEmpty = left === '';
    var rightEmpty = right === '';
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;
    var result = compareSortValues(left, right);
    return direction === 'asc' ? result : -result;
  }

  function cellSortValue(row, column) {
    var cell = row.children[column];
    if (!cell) return '';
    return normalizeSortValue(cell.getAttribute('data-hfx-monitoring-sort-value') || cell.textContent || '');
  }

  function recordDetailsForRow(tbody, row) {
    var key = row && row.getAttribute ? row.getAttribute('data-hfx-monitoring-record-row') : '';
    return key && tbody ? tbody.querySelector('[data-hfx-monitoring-record-details="' + key + '"]') : null;
  }

  function appendSortableRow(tbody, row) {
    tbody.appendChild(row);
    var details = recordDetailsForRow(tbody, row);
    if (details) tbody.appendChild(details);
  }

  function deferredRecordData(table) {
    if (!table || table.getAttribute('data-hfx-monitoring-deferred-records') !== 'true') return null;
    if (table.__hfxMonitoringRecordData) return table.__hfxMonitoringRecordData;
    var block = tableBlockFor(table);
    var dataNode = block ? block.querySelector('[data-hfx-monitoring-record-data]') : null;
    if (!dataNode) return null;
    try {
      table.__hfxMonitoringRecordData = JSON.parse(dataNode.textContent || '{}');
    } catch (error) {
      table.__hfxMonitoringRecordData = { Columns: [], Records: [] };
    }
    table.__hfxMonitoringRecordData.Columns = table.__hfxMonitoringRecordData.Columns || [];
    table.__hfxMonitoringRecordData.Records = table.__hfxMonitoringRecordData.Records || [];
    return table.__hfxMonitoringRecordData;
  }

  function deferredCell(record, key) {
    var cells = record && (record.Cells || record.cells) || [];
    for (var i = 0; i < cells.length; i += 1) {
      if ((cells[i].Key || cells[i].key || '') === key) return cells[i];
    }
    return { Key: key, Value: '', Sort: '' };
  }

  function deferredCellSortValue(cell) {
    if (!cell) return '';
    if (Object.prototype.hasOwnProperty.call(cell, 'Sort')) return cell.Sort || '';
    if (Object.prototype.hasOwnProperty.call(cell, 'sort')) return cell.sort || '';
    return cell.Value || cell.value || '';
  }

  function deferredRecordText(record) {
    var parts = [record.Title || record.title || ''];
    (record.Cells || record.cells || []).forEach(function (cell) { parts.push(cell.Value || cell.value || ''); });
    (record.Details || record.details || []).forEach(function (detail) {
      parts.push((detail.Label || detail.label || '') + ' ' + (detail.Value || detail.value || ''));
    });
    (record.Tags || record.tags || []).forEach(function (tag) { parts.push(tag || ''); });
    return parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function deferredRecordMatchesFilters(record, tokens) {
    if (!tokens.length) return true;
    var values = ' ' + ((record.Filter || record.filter || '') + '').toLowerCase() + ' ';
    return tokens.every(function (token) {
      return values.indexOf(' ' + token + ' ') !== -1;
    });
  }

  function activeRecordColumnFilters(table) {
    var explorer = table && table.closest ? table.closest('[data-hfx-monitoring-record-explorer]') : null;
    var filters = [];
    if (!explorer) return filters;
    explorer.querySelectorAll('[data-hfx-monitoring-column-filter]').forEach(function (input) {
      if (!isRecordColumnFilterVisible(input)) return;
      var key = (input.getAttribute('data-hfx-monitoring-column-filter') || '').trim();
      var value = (input.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (key && value) filters.push({ key: key, value: value });
    });
    return filters;
  }

  function isRecordColumnFilterVisible(input) {
    if (!input || input.disabled) return false;
    var cell = input.closest ? input.closest('th,td') : null;
    if (cell) {
      if (cell.hidden || cell.getAttribute('aria-hidden') === 'true') return false;
      var cellStyle = window.getComputedStyle ? window.getComputedStyle(cell) : null;
      if (cellStyle && (cellStyle.display === 'none' || cellStyle.visibility === 'hidden')) return false;
    }
    var style = window.getComputedStyle ? window.getComputedStyle(input) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }

  function deferredRecordMatchesColumnFilters(record, filters) {
    if (!filters.length) return true;
    return filters.every(function (filter) {
      var cell = deferredCell(record, filter.key);
      var value = ((cell.Value || cell.value || '') + ' ' + deferredCellSortValue(cell)).replace(/\s+/g, ' ').trim().toLowerCase();
      return value.indexOf(filter.value) !== -1;
    });
  }

  function activeDeferredSort(table) {
    var active = table ? table.querySelector('[data-hfx-monitoring-sort].is-active') : null;
    var direction = active ? (active.getAttribute('data-hfx-monitoring-sort-direction') || 'none') : 'none';
    if (!active || direction === 'none') return null;
    var column = Number(active.getAttribute('data-hfx-monitoring-sort'));
    return Number.isFinite(column) ? { index: column - 1, direction: direction } : null;
  }

  function visibleDeferredColumnKeys(table, data) {
    var checked = {};
    var explorer = table && table.closest ? table.closest('[data-hfx-monitoring-record-explorer]') : null;
    if (explorer) {
      explorer.querySelectorAll('[data-hfx-monitoring-column-option]').forEach(function (input) {
        checked[input.getAttribute('data-hfx-monitoring-column-option') || ''] = input.checked;
      });
    }
    return (data.Columns || data.columns || []).reduce(function (state, column) {
      var key = column.Key || column.key || '';
      state[key] = Object.prototype.hasOwnProperty.call(checked, key) ? checked[key] : !!(column.Visible || column.visible);
      return state;
    }, {});
  }

  function createDeferredPill(value, state) {
    var pill = document.createElement('span');
    var stateKey = state || 'unknown';
    pill.className = 'hfx-monitoring-pill hfx-monitoring-pill--' + stateKey;
    pill.setAttribute('aria-label', value && value.toLowerCase() !== stateKey ? value + ', ' + stateKey : (value || stateKey));
    pill.title = pill.getAttribute('aria-label');
    pill.textContent = value || '';
    return pill;
  }

  function createDeferredCell(cell, column, visibleMap) {
    var td = document.createElement('td');
    var key = column.Key || column.key || '';
    var value = cell.Value || cell.value || '';
    td.setAttribute('data-hfx-monitoring-sort-value', cell.Sort || cell.sort || value);
    td.setAttribute('data-hfx-monitoring-column-cell', key);
    if (column.Pinned || column.pinned) td.classList.add('is-pinned');
    if (visibleMap[key] === false) td.hidden = true;
    if (cell.State || cell.state) {
      td.appendChild(createDeferredPill(value, cell.State || cell.state));
    } else {
      var span = document.createElement('span');
      span.textContent = value;
      td.appendChild(span);
    }
    return td;
  }

  function createDeferredRecordRows(table, data, record, visibleMap, selected) {
    var key = record.Key || record.key || '';
    var title = record.Title || record.title || '';
    var row = document.createElement('tr');
    row.className = 'hfx-monitoring-record-row' + (selected ? ' is-selected' : '');
    row.setAttribute('data-hfx-monitoring-search-row', 'true');
    row.setAttribute('data-hfx-monitoring-filter-values', record.Filter || record.filter || '');
    row.setAttribute('data-hfx-monitoring-row-match', 'true');
    row.setAttribute('data-hfx-monitoring-row-page-visible', 'true');
    row.setAttribute('data-hfx-monitoring-record-row', key);

    var toggleCell = document.createElement('td');
    toggleCell.className = 'hfx-monitoring-record-toggle-cell';
    var button = document.createElement('button');
    button.className = 'hfx-monitoring-record-toggle';
    button.type = 'button';
    button.setAttribute('aria-expanded', selected ? 'true' : 'false');
    button.setAttribute('aria-label', (selected ? 'Collapse ' : 'Expand ') + title);
    button.setAttribute('data-hfx-monitoring-record-toggle', key);
    button.textContent = '›';
    toggleCell.appendChild(button);
    row.appendChild(toggleCell);

    (data.Columns || data.columns || []).forEach(function (column) {
      row.appendChild(createDeferredCell(deferredCell(record, column.Key || column.key || ''), column, visibleMap));
    });

    var details = document.createElement('tr');
    details.className = 'hfx-monitoring-record-details-row';
    details.setAttribute('data-hfx-monitoring-record-details', key);
    details.hidden = !selected;
    var detailCell = document.createElement('td');
    var visibleCount = Object.keys(visibleMap || {}).filter(function (key) { return visibleMap[key] !== false; }).length;
    detailCell.colSpan = Math.max(1, visibleCount + 1);
    var grid = document.createElement('div');
    grid.className = 'hfx-monitoring-record-details-grid';
    (record.Details || record.details || []).forEach(function (detail) {
      var item = document.createElement('div');
      item.className = 'hfx-monitoring-record-detail';
      var label = document.createElement('span');
      label.textContent = detail.Label || detail.label || '';
      var value = document.createElement('strong');
      value.textContent = detail.Value || detail.value || '';
      item.appendChild(label);
      item.appendChild(value);
      grid.appendChild(item);
    });
    if ((record.Tags || record.tags || []).length) {
      var tagItem = document.createElement('div');
      tagItem.className = 'hfx-monitoring-record-detail';
      var tagLabel = document.createElement('span');
      tagLabel.textContent = 'Tags';
      var tags = document.createElement('div');
      tags.className = 'hfx-monitoring-record-tags';
      (record.Tags || record.tags || []).forEach(function (tag) {
        var token = document.createElement('span');
        token.className = 'hfx-monitoring-mini-token';
        token.textContent = tag || '';
        tags.appendChild(token);
      });
      tagItem.appendChild(tagLabel);
      tagItem.appendChild(tags);
      grid.appendChild(tagItem);
    }
    detailCell.appendChild(grid);
    details.appendChild(detailCell);
    return { row: row, details: details };
  }

  function renderDeferredRecords(table, records, data) {
    var tbody = table && table.tBodies && table.tBodies[0];
    if (!tbody) return;
    var selected = tbody.querySelector('[data-hfx-monitoring-record-row].is-selected');
    var selectedKey = selected ? selected.getAttribute('data-hfx-monitoring-record-row') : '';
    var emptyRows = Array.prototype.slice.call(tbody.querySelectorAll('[data-hfx-monitoring-search-empty]'));
    tbody.querySelectorAll('[data-hfx-monitoring-record-row], [data-hfx-monitoring-record-details]').forEach(function (row) {
      if (row.parentNode) row.parentNode.removeChild(row);
    });
    var visibleMap = visibleDeferredColumnKeys(table, data);
    var before = emptyRows[0] || null;
    records.forEach(function (record, index) {
      var key = record.Key || record.key || '';
      var pair = createDeferredRecordRows(table, data, record, visibleMap, selectedKey ? key === selectedKey : index === 0);
      tbody.insertBefore(pair.row, before);
      tbody.insertBefore(pair.details, before);
    });
    emptyRows.forEach(function (row) {
      row.hidden = records.length !== 0;
      if (row.parentNode !== tbody) tbody.appendChild(row);
    });
  }

  function applyDeferredRecords(scope, table, query, filters) {
    var data = deferredRecordData(table);
    if (!data) return false;
    var columnFilters = activeRecordColumnFilters(table);
    var records = (data.Records || data.records || []).filter(function (record) {
      return (!query || deferredRecordText(record).indexOf(query) !== -1) &&
        deferredRecordMatchesFilters(record, filters) &&
        deferredRecordMatchesColumnFilters(record, columnFilters);
    });
    var sort = activeDeferredSort(table);
    if (sort) {
      records.sort(function (left, right) {
        var leftCell = (left.Cells || left.cells || [])[sort.index] || {};
        var rightCell = (right.Cells || right.cells || [])[sort.index] || {};
        return compareSortValuesForDirection(
          normalizeSortValue(deferredCellSortValue(leftCell)),
          normalizeSortValue(deferredCellSortValue(rightCell)),
          sort.direction
        );
      });
    }
    var pageSize = pageSizeFor(table);
    var totalRows = records.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    var currentPage = Math.min(Math.max(1, currentPageFor(table)), totalPages);
    setCurrentPage(table, currentPage);
    var pageRecords = pageSize ? records.slice((currentPage - 1) * pageSize, currentPage * pageSize) : records;
    renderDeferredRecords(table, pageRecords, data);
    updatePagingSummary(table, currentPage, pageSize || Math.max(1, totalRows), totalRows);
    renderPager(table, currentPage, totalPages);
    syncRecordDetails(table);
    table.querySelectorAll('[data-hfx-monitoring-search-empty]').forEach(function (empty) {
      empty.hidden = totalRows !== 0;
    });
    return true;
  }

  function setSortState(table, button, direction) {
    table.querySelectorAll('[data-hfx-monitoring-sort]').forEach(function (item) {
      var active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
      item.setAttribute('data-hfx-monitoring-sort-direction', active ? direction : 'none');
      var th = item.closest('th');
      if (th) {
        th.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
      }
    });
  }

  function sortTable(button) {
    var table = button && button.closest ? button.closest('[data-hfx-monitoring-sort-table]') : null;
    if (!table) return;

    var column = Number(button.getAttribute('data-hfx-monitoring-sort'));
    if (Number.isNaN(column)) return;

    var current = button.getAttribute('data-hfx-monitoring-sort-direction') || 'none';
    var direction = current === 'asc' ? 'desc' : 'asc';
    if (table.getAttribute('data-hfx-monitoring-deferred-records') === 'true') {
      setSortState(table, button, direction);
      setCurrentPage(table, 1);
      applyFilters(scopeFor(button));
      return;
    }

    var tbody = table.tBodies && table.tBodies[0];
    if (!tbody) return;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('[data-hfx-monitoring-search-row]'));
    var emptyRows = Array.prototype.slice.call(tbody.querySelectorAll('[data-hfx-monitoring-search-empty]'));

    rows.sort(function (left, right) {
      return compareSortValuesForDirection(cellSortValue(left, column), cellSortValue(right, column), direction);
    });

    rows.forEach(function (row) {
      appendSortableRow(tbody, row);
    });
    emptyRows.forEach(function (row) {
      tbody.appendChild(row);
    });

    setSortState(table, button, direction);
    applyFilters(scopeFor(button));
  }

  function panelTitle(panel) {
    return panel.getAttribute('data-hfx-monitoring-panel-title') ||
      (panel.querySelector('.hfx-monitoring-panel-title') && panel.querySelector('.hfx-monitoring-panel-title').textContent || 'Details')
        .replace(/\s+/g, ' ')
        .trim();
  }

  function closeIcon() {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hfx-monitoring-close-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    var firstPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    firstPath.setAttribute('d', 'M18 6 6 18');
    svg.appendChild(firstPath);

    var secondPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    secondPath.setAttribute('d', 'm6 6 12 12');
    svg.appendChild(secondPath);

    return svg;
  }

  function ensureDrilldown(shell) {
    var existing = shell.querySelector('[data-hfx-monitoring-drilldown]');
    if (existing) return existing;

    var overlay = document.createElement('div');
    overlay.className = 'hfx-monitoring-drilldown';
    overlay.setAttribute('data-hfx-monitoring-drilldown', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;

    var backdrop = document.createElement('div');
    backdrop.className = 'hfx-monitoring-drilldown-backdrop';
    backdrop.setAttribute('data-hfx-monitoring-drilldown-close', 'true');
    overlay.appendChild(backdrop);

    var sheet = document.createElement('section');
    sheet.className = 'hfx-monitoring-drilldown-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Monitoring drilldown');

    var header = document.createElement('header');
    header.className = 'hfx-monitoring-drilldown-head';

    var titleWrap = document.createElement('div');
    var eyebrow = document.createElement('div');
    eyebrow.className = 'hfx-monitoring-drilldown-eyebrow';
    eyebrow.textContent = 'Focused view';
    titleWrap.appendChild(eyebrow);

    var title = document.createElement('h2');
    title.className = 'hfx-monitoring-drilldown-title';
    title.setAttribute('data-hfx-monitoring-drilldown-title', 'true');
    titleWrap.appendChild(title);
    header.appendChild(titleWrap);

    var closeButton = document.createElement('button');
    closeButton.className = 'hfx-monitoring-drilldown-close';
    closeButton.type = 'button';
    closeButton.setAttribute("aria-label", "Close drilldown");
    closeButton.setAttribute('data-hfx-monitoring-drilldown-close', 'true');
    closeButton.appendChild(closeIcon());
    header.appendChild(closeButton);
    sheet.appendChild(header);

    var body = document.createElement('div');
    body.className = 'hfx-monitoring-drilldown-body';
    body.setAttribute('data-hfx-monitoring-drilldown-body', 'true');
    sheet.appendChild(body);
    overlay.appendChild(sheet);
    shell.appendChild(overlay);
    return overlay;
  }

  function focusableElements(container) {
    return Array.prototype.filter.call(container.querySelectorAll([
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',')), function (item) {
      return !item.hidden && item.offsetParent !== null;
    });
  }

  function trapDrilldownFocus(overlay, event) {
    var items = focusableElements(overlay);
    if (!items.length) {
      event.preventDefault();
      return;
    }

    var first = items[0];
    var last = items[items.length - 1];
    var current = document.activeElement;

    if (event.shiftKey && (current === first || !overlay.contains(current))) {
      last.focus();
      event.preventDefault();
      return;
    }

    if (!event.shiftKey && current === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function closeDrilldown(overlay, options) {
    if (!overlay) return;
    options = options || {};
    var trigger = overlay.__hfxMonitoringTrigger;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    overlay.__hfxMonitoringTrigger = null;
    document.documentElement.classList.remove('hfx-monitoring-drilldown-open');

    if (options.returnFocus !== false && trigger && document.contains(trigger) && trigger.focus) {
      trigger.focus();
    }
  }

  function openDrilldown(action) {
    var panel = action && action.closest ? action.closest('[data-hfx-monitoring-panel]') : null;
    var shell = action && action.closest ? action.closest('[data-hfx-monitoring-shell]') : null;
    if (!panel || !shell) return false;

    var overlay = ensureDrilldown(shell);
    var title = panelTitle(panel);
    var titleTarget = overlay.querySelector('[data-hfx-monitoring-drilldown-title]');
    var bodyTarget = overlay.querySelector('[data-hfx-monitoring-drilldown-body]');
    var body = panel.querySelector('.hfx-monitoring-panel-body');
    if (!titleTarget || !bodyTarget || !body) return false;

    titleTarget.textContent = title;
    clearElement(bodyTarget);
    bodyTarget.appendChild(body.cloneNode(true));
    overlay.__hfxMonitoringTrigger = action;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');
    document.documentElement.classList.add('hfx-monitoring-drilldown-open');

    applyFilters(overlay);
    var closeButton = overlay.querySelector('[data-hfx-monitoring-drilldown-close]');
    if (closeButton && closeButton.focus) closeButton.focus();
    return true;
  }

  function ensureToastRegion(shell) {
    var existing = shell.querySelector('[data-hfx-monitoring-toasts]');
    if (existing) return existing;

    var region = document.createElement('div');
    region.className = 'hfx-monitoring-toasts';
    region.setAttribute('data-hfx-monitoring-toasts', 'true');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    shell.appendChild(region);
    return region;
  }

  function actionContext(action) {
    var explicitContext = (action.getAttribute('data-hfx-monitoring-action-context') || '').trim();
    if (explicitContext) {
      return explicitContext;
    }

    var row = action.closest('[data-hfx-monitoring-search-row]');
    if (row) {
      var title = row.querySelector('.hfx-monitoring-list-title') ||
        row.querySelector('td:nth-child(2)') ||
        row.querySelector('td');
      if (title) {
        return (title.textContent || '').replace(/\s+/g, ' ').trim();
      }
    }

    var panel = action.closest('[data-hfx-monitoring-panel]');
    return panel ? panelTitle(panel) : '';
  }

  function showActionToast(action) {
    var shell = action && action.closest ? action.closest('[data-hfx-monitoring-shell]') : null;
    if (!shell) return;

    var region = ensureToastRegion(shell);
    var label = (action.getAttribute('data-hfx-monitoring-action-label') ||
      action.getAttribute('aria-label') ||
      action.textContent ||
      'Action').replace(/\s+/g, ' ').trim();
    var context = actionContext(action);
    var message = context ? label + ': ' + context : label;

    var toast = document.createElement('div');
    toast.className = 'hfx-monitoring-toast';
    toast.setAttribute('role', 'status');

    var dot = document.createElement('span');
    dot.className = 'hfx-monitoring-toast-dot';
    dot.setAttribute('aria-hidden', 'true');
    toast.appendChild(dot);

    var text = document.createElement('span');
    text.className = 'hfx-monitoring-toast-text';
    text.textContent = message;
    toast.appendChild(text);

    var closeButton = document.createElement('button');
    closeButton.className = 'hfx-monitoring-toast-close';
    closeButton.type = 'button';
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.setAttribute('data-hfx-monitoring-toast-close', 'true');
    closeButton.appendChild(closeIcon());
    toast.appendChild(closeButton);

    region.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add('is-visible');
    }, 0);
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 4200);
  }

  function togglePressedAction(action) {
    if (!action || !action.hasAttribute('aria-pressed')) return;
    var enabled = action.getAttribute('aria-pressed') !== 'true';
    action.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    var pill = action.querySelector('.hfx-monitoring-pill');
    if (pill) {
      pill.textContent = enabled ? 'On' : 'Off';
      pill.classList.toggle('hfx-monitoring-pill--healthy', enabled);
      pill.classList.toggle('hfx-monitoring-pill--unknown', !enabled);
    }

    if (action.hasAttribute('data-hfx-monitoring-freeze-columns')) {
      var explorer = action.closest('.hfx-monitoring-record-explorer');
      if (explorer) explorer.classList.toggle('is-freeze-columns-disabled', !enabled);
    }
  }
