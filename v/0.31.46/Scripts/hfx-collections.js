(function () {
  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function parseMaybeNumber(value) {
    var raw = String(value || '').trim();
    if (!raw) return null;
    var cleaned = raw
      .replace(/[$€£,%]/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
    var multiplier = 1;
    if (cleaned.endsWith('k')) {
      multiplier = 1000;
      cleaned = cleaned.slice(0, -1);
    } else if (cleaned.endsWith('m')) {
      multiplier = 1000000;
      cleaned = cleaned.slice(0, -1);
    } else if (cleaned.endsWith('b')) {
      multiplier = 1000000000;
      cleaned = cleaned.slice(0, -1);
    }
    if (!/^-?\d*\.?\d+$/.test(cleaned)) {
      return null;
    }
    var number = Number(cleaned);
    return Number.isFinite(number) ? number * multiplier : null;
  }

  function getToolbar(root) {
    return root.querySelector('[data-hfx-collection-toolbar]') || null;
  }

  function findStandaloneToolbar(tableWrapper) {
    var current = tableWrapper;
    while (current && current !== document.body) {
      var sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.matches && sibling.matches('[data-hfx-collection-toolbar]')) {
          return sibling;
        }
        if (sibling.querySelector) {
          var nested = sibling.querySelector('[data-hfx-collection-toolbar]');
          if (nested) {
            return nested;
          }
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return null;
  }

  function getCellByKey(row, key) {
    var cells = row.querySelectorAll('td[data-hfx-col-key]');
    var target = normalizeText(key);
    for (var i = 0; i < cells.length; i++) {
      if (normalizeText(cells[i].getAttribute('data-hfx-col-key')) === target) {
        return cells[i];
      }
    }
    return null;
  }

  function compareValues(left, right, direction) {
    var leftNumber = parseMaybeNumber(left);
    var rightNumber = parseMaybeNumber(right);
    var result;
    if (leftNumber != null && rightNumber != null) {
      result = leftNumber - rightNumber;
    } else {
      result = String(left || '').localeCompare(String(right || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    }
    return direction === 'desc' ? -result : result;
  }

  function buildBlocks(tbody) {
    var blocks = [];
    var current = { section: null, rows: [] };
    Array.prototype.slice.call(tbody.children || []).forEach(function (node) {
      if (!(node instanceof HTMLElement)) return;
      if (node.hasAttribute('data-hfx-collection-section')) {
        if (current.section || current.rows.length) {
          blocks.push(current);
        }
        current = { section: node, rows: [] };
        return;
      }
      if (node.hasAttribute('data-hfx-collection-row')) {
        current.rows.push(node);
      }
    });
    if (current.section || current.rows.length) {
      blocks.push(current);
    }
    return blocks;
  }

  function getActiveFilter(toolbar) {
    if (!toolbar) return '';
    var active = toolbar.querySelector('[data-hfx-filter-value].active');
    return normalizeText(active ? active.getAttribute('data-hfx-filter-value') : '');
  }

  function getFilterTokens(value) {
    var normalized = normalizeText(value);
    if (!normalized) {
      return [];
    }
    return normalized
      .split('|')
      .map(function (token) { return normalizeText(token); })
      .filter(function (token) { return !!token; });
  }

  function filterMatches(statusValue, filterValue) {
    if (!filterValue) {
      return true;
    }

    var filterTokens = getFilterTokens(statusValue || '');
    var activeFilterTokens = getFilterTokens(filterValue);
    if (!activeFilterTokens.length) {
      activeFilterTokens = [normalizeText(filterValue)];
    }

    return activeFilterTokens.some(function (token) {
      return filterTokens.indexOf(token) !== -1;
    });
  }

  function getColumnFilters(table) {
    var filters = {};
    if (!table) return filters;
    table.querySelectorAll('[data-hfx-collection-column-filter]').forEach(function (input) {
      var key = normalizeText(input.getAttribute('data-hfx-collection-column-filter'));
      var value = normalizeText(input.value);
      if (key && value) {
        filters[key] = value;
      }
    });
    return filters;
  }

  function rowMatchesColumnFilters(row, filters) {
    if (!filters) return true;
    var keys = Object.keys(filters);
    for (var i = 0; i < keys.length; i++) {
      var cell = getCellByKey(row, keys[i]);
      var haystack = normalizeText(cell ? (cell.getAttribute('data-hfx-search') || cell.textContent) : '');
      if (haystack.indexOf(filters[keys[i]]) === -1) {
        return false;
      }
    }
    return true;
  }

  function getDeferredColumnValue(columns, key) {
    if (!columns || !key) return '';
    if (Object.prototype.hasOwnProperty.call(columns, key)) {
      return columns[key];
    }

    var target = normalizeText(key);
    var columnKeys = Object.keys(columns);
    for (var i = 0; i < columnKeys.length; i++) {
      if (normalizeText(columnKeys[i]) === target) {
        return columns[columnKeys[i]];
      }
    }
    return '';
  }

  function rowMatches(row, state) {
    var searchHaystack = normalizeText(row.getAttribute('data-hfx-search') || row.textContent);
    if (state.query && searchHaystack.indexOf(state.query) === -1) {
      return false;
    }
    if (state.filter && !filterMatches(row.getAttribute('data-hfx-status') || '', state.filter)) {
      return false;
    }
    if (!rowMatchesColumnFilters(row, state.columnFilters)) {
      return false;
    }
    return true;
  }

  function isDeferredTable(table) {
    return !!(table && table.getAttribute('data-hfx-collection-deferred') === '1');
  }

  function getDeferredRows(table) {
    if (!table) return [];
    if (table.__hfxDeferredRows) {
      return table.__hfxDeferredRows;
    }

    var wrapper = table.closest('[data-hfx-collection-table-wrapper]');
    var source = wrapper ? wrapper.querySelector('[data-hfx-collection-deferred-source]') : null;
    if (!source) {
      table.__hfxDeferredRows = [];
      return table.__hfxDeferredRows;
    }

    try {
      table.__hfxDeferredRows = JSON.parse(source.textContent || '[]') || [];
    } catch (error) {
      table.__hfxDeferredRows = [];
    }

    return table.__hfxDeferredRows;
  }

  function deferredRowMatchesColumnFilters(record, filters) {
    if (!filters || record.section) return true;
    var keys = Object.keys(filters);
    var columns = record.columns || {};
    for (var i = 0; i < keys.length; i++) {
      var haystack = normalizeText(getDeferredColumnValue(columns, keys[i]) || '');
      if (haystack.indexOf(filters[keys[i]]) === -1) {
        return false;
      }
    }
    return true;
  }

  function deferredRowMatches(record, state) {
    if (!record || record.section) return false;
    var searchHaystack = normalizeText(record.search || '');
    if (state.query && searchHaystack.indexOf(state.query) === -1) {
      return false;
    }
    if (state.filter && !filterMatches(record.filter || '', state.filter)) {
      return false;
    }
    if (!deferredRowMatchesColumnFilters(record, state.columnFilters)) {
      return false;
    }
    return true;
  }

  function getPageSize(state) {
    var size = Number(state.limit || state.pageSize || 0);
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  function getPageWindow(state, totalMatches) {
    var pageSize = getPageSize(state);
    if (!pageSize) {
      state.page = 1;
      return {
        pageSize: 0,
        page: 1,
        totalPages: 1,
        start: 0,
        end: totalMatches
      };
    }

    var totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
    var page = Math.max(1, Math.min(Number(state.page || 1), totalPages));
    state.page = page;
    return {
      pageSize: pageSize,
      page: page,
      totalPages: totalPages,
      start: (page - 1) * pageSize,
      end: Math.min(page * pageSize, totalMatches)
    };
  }

  function syncPageSizeControls(table, toolbar, value, source) {
    var stringValue = String(value || '');
    var wrapper = table ? table.closest('[data-hfx-collection-table-wrapper]') : null;
    var pagerSelect = wrapper ? wrapper.querySelector('[data-hfx-collection-page-size-select]') : null;
    var toolbarSelect = toolbar ? toolbar.querySelector('[data-hfx-collection-records]') : null;
    [pagerSelect, toolbarSelect].forEach(function (select) {
      if (!select || select === source || !stringValue) return;
      var option = Array.prototype.slice.call(select.options || []).some(function (item) {
        return item.value === stringValue;
      });
      if (option) {
        select.value = stringValue;
      }
    });
  }

  function updatePager(table, state, totalMatches, totalRows, pageWindow) {
    var wrapper = table ? table.closest('[data-hfx-collection-table-wrapper]') : null;
    var pager = wrapper ? wrapper.querySelector('[data-hfx-collection-pager]') : null;
    if (!pager) return;

    var info = pager.querySelector('[data-hfx-collection-page-info]');
    var previous = pager.querySelector('[data-hfx-collection-page-prev]');
    var next = pager.querySelector('[data-hfx-collection-page-next]');
    var select = pager.querySelector('[data-hfx-collection-page-size-select]');
    var hasPageSize = !!pageWindow.pageSize;
    var from = totalMatches === 0 ? 0 : pageWindow.start + 1;
    var to = totalMatches === 0 ? 0 : pageWindow.end;
    var text = hasPageSize
      ? 'Showing ' + from + '-' + to + ' of ' + totalMatches
      : 'Showing ' + totalMatches + ' records';
    if (totalRows !== totalMatches) {
      text += ' filtered from ' + totalRows;
    }
    if (info) {
      info.textContent = text;
    }
    if (previous) {
      previous.disabled = !hasPageSize || pageWindow.page <= 1;
    }
    if (next) {
      next.disabled = !hasPageSize || pageWindow.page >= pageWindow.totalPages;
    }
    if (select && hasPageSize) {
      select.value = String(pageWindow.pageSize);
    }
  }

  function getRemoteUrl(table) {
    return table ? table.getAttribute('data-hfx-collection-remote-url') || '' : '';
  }

  function isRemoteTable(table) {
    return !!getRemoteUrl(table);
  }

  function setRemoteBusy(table, busy) {
    if (!table) return;
    table.setAttribute('aria-busy', busy ? 'true' : 'false');
    var wrapper = table.closest('[data-hfx-collection-table-wrapper]');
    if (wrapper) {
      wrapper.classList.toggle('hfx-collection-table-wrapper--loading', !!busy);
    }
  }

  function buildRemotePayload(state) {
    var payload = {
      page: Number(state.page || 1),
      pageSize: getPageSize(state),
      search: state.query || '',
      filter: state.filter || '',
      sort: state.sortKey || '',
      direction: state.sortDirection || 'asc',
      columnFilters: state.columnFilters || {}
    };
    return payload;
  }

  function buildRemoteGetUrl(url, payload) {
    var requestUrl = new URL(url, window.location.href);
    requestUrl.searchParams.set('page', String(payload.page || 1));
    requestUrl.searchParams.set('pageSize', String(payload.pageSize || 0));
    if (payload.search) requestUrl.searchParams.set('search', payload.search);
    if (payload.filter) requestUrl.searchParams.set('filter', payload.filter);
    if (payload.sort) requestUrl.searchParams.set('sort', payload.sort);
    if (payload.direction) requestUrl.searchParams.set('direction', payload.direction);
    Object.keys(payload.columnFilters || {}).forEach(function (key) {
      requestUrl.searchParams.set('column_' + key, payload.columnFilters[key]);
    });
    return requestUrl.toString();
  }

  function renderRemoteError(table, message) {
    var tbody = table ? table.querySelector('tbody') : null;
    if (!tbody) return;
    var columns = table.querySelectorAll('thead th').length || 1;
    tbody.innerHTML = '<tr><td colspan="' + columns + '"><div class="text-secondary py-3">' + message + '</div></td></tr>';
  }

  function applyRemoteTableResponse(table, state, response) {
    if (!table || !response) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;
    var html = response.html || response.rowsHtml || response.body || '';
    tbody.innerHTML = html;

    var totalMatches = Number(response.total || response.totalMatches || response.filtered || response.filteredTotal || 0);
    var totalRows = Number(response.totalRows || response.grandTotal || totalMatches);
    var pageSize = Number(response.pageSize || getPageSize(state) || 0);
    var page = Number(response.page || state.page || 1);
    state.page = page > 0 ? page : 1;
    if (pageSize > 0) {
      state.pageSize = pageSize;
      state.limit = pageSize;
    }

    var start = pageSize > 0 ? (state.page - 1) * pageSize : 0;
    var pageWindow = {
      pageSize: pageSize,
      page: state.page,
      totalPages: pageSize > 0 ? Math.max(1, Math.ceil(totalMatches / pageSize)) : 1,
      start: start,
      end: pageSize > 0 ? Math.min(start + pageSize, totalMatches) : totalMatches
    };
    updatePager(table, state, totalMatches, totalRows, pageWindow);
    table.dispatchEvent(new CustomEvent('hfx:collection:remote-loaded', {
      bubbles: true,
      detail: {
        total: totalMatches,
        totalRows: totalRows,
        page: state.page,
        pageSize: pageSize
      }
    }));
  }

  function requestRemoteTable(table, state) {
    if (!table) return;
    var url = getRemoteUrl(table);
    if (!url) return;
    var method = normalizeText(table.getAttribute('data-hfx-collection-remote-method') || 'get');
    var payload = buildRemotePayload(state);
    state.__remoteRequestId = (state.__remoteRequestId || 0) + 1;
    var requestId = state.__remoteRequestId;
    setRemoteBusy(table, true);

    var request = method === 'post'
      ? fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        })
      : fetch(buildRemoteGetUrl(url, payload), {
          method: 'GET',
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });

    request
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Remote table request failed with ' + response.status);
        }
        return response.json();
      })
      .then(function (json) {
        if (state.__remoteRequestId !== requestId) return;
        applyRemoteTableResponse(table, state, json);
        table.dispatchEvent(new CustomEvent('hfx:collection:rendered', {
          bubbles: true,
          detail: {
            remote: true
          }
        }));
      })
      .catch(function () {
        if (state.__remoteRequestId !== requestId) return;
        renderRemoteError(table, 'Could not load records.');
        updatePager(table, state, 0, 0, getPageWindow(state, 0));
      })
      .finally(function () {
        if (state.__remoteRequestId === requestId) {
          setRemoteBusy(table, false);
        }
      });
  }

  function applyTableState(table, state) {
    if (!table) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;

    var blocks = buildBlocks(tbody);
    var totalRows = 0;
    var totalMatches = 0;

    blocks.forEach(function (block) {
      totalRows += block.rows.length;
      block.__hfxMatchedRows = block.rows.filter(function (row) { return rowMatches(row, state); });
      totalMatches += block.__hfxMatchedRows.length;
    });

    var pageWindow = getPageWindow(state, totalMatches);

    if (state.sortKey) {
      var allRows = [];
      blocks.forEach(function (block) {
        if (block.section) {
          block.section.style.display = 'none';
        }
        Array.prototype.push.apply(allRows, block.rows);
      });

      var matchedRows = allRows.filter(function (row) { return rowMatches(row, state); });
      matchedRows.sort(function (left, right) {
        var leftCell = getCellByKey(left, state.sortKey);
        var rightCell = getCellByKey(right, state.sortKey);
        var leftValue = leftCell ? (leftCell.getAttribute('data-hfx-sort') || leftCell.textContent) : '';
        var rightValue = rightCell ? (rightCell.getAttribute('data-hfx-sort') || rightCell.textContent) : '';
        return compareValues(leftValue, rightValue, state.sortDirection);
      });

      var hiddenRows = allRows.filter(function (row) {
        return matchedRows.indexOf(row) === -1;
      });

      matchedRows.concat(hiddenRows).forEach(function (row) {
        tbody.appendChild(row);
      });

      allRows.forEach(function (row) {
        row.style.display = 'none';
      });

      matchedRows.forEach(function (row, index) {
        row.style.display = index >= pageWindow.start && index < pageWindow.end ? '' : 'none';
      });

      table.querySelectorAll('[data-hfx-sort-key]').forEach(function (header) {
        var active = normalizeText(header.getAttribute('data-hfx-sort-key')) === normalizeText(state.sortKey);
        var ariaSort = active ? (state.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none';
        header.setAttribute('aria-sort', ariaSort);
      });
      updatePager(table, state, totalMatches, totalRows, pageWindow);
      return;
    }

    var visibleIndex = 0;
    blocks.forEach(function (block) {
      var visibleRows = block.__hfxMatchedRows || [];

      if (block.section) {
        tbody.appendChild(block.section);
      }

      block.rows.forEach(function (row) {
        tbody.appendChild(row);
      });

      block.rows.forEach(function (row) {
        row.style.display = 'none';
      });

      var sectionVisible = false;
      block.rows.forEach(function (row) {
        if (visibleRows.indexOf(row) === -1) {
          row.style.display = 'none';
          return;
        }

        var visible = visibleIndex >= pageWindow.start && visibleIndex < pageWindow.end;
        row.style.display = visible ? '' : 'none';
        if (visible) {
          sectionVisible = true;
        }
        visibleIndex += 1;
      });

      if (block.section) {
        block.section.style.display = sectionVisible ? '' : 'none';
      }
    });

    table.querySelectorAll('[data-hfx-sort-key]').forEach(function (header) {
      var active = normalizeText(header.getAttribute('data-hfx-sort-key')) === normalizeText(state.sortKey);
      var ariaSort = active ? (state.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none';
      header.setAttribute('aria-sort', ariaSort);
    });

    updatePager(table, state, totalMatches, totalRows, pageWindow);
  }

  function applyDeferredTableState(table, state) {
    if (!table) return;
    var tbody = table.querySelector('tbody');
    if (!tbody) return;

    var records = getDeferredRows(table);
    var rows = records.filter(function (record) { return record && !record.section; });
    var totalRows = rows.length;
    var matchedRows = rows.filter(function (record) { return deferredRowMatches(record, state); });
    var totalMatches = matchedRows.length;
    var pageWindow = getPageWindow(state, totalMatches);
    var visibleRecords = [];

    if (state.sortKey) {
      var sortKey = normalizeText(state.sortKey);
      matchedRows.sort(function (left, right) {
        var leftValue = (left.sort && (left.sort[state.sortKey] || left.sort[sortKey])) ||
          (left.columns && (left.columns[state.sortKey] || left.columns[sortKey])) ||
          left.search ||
          '';
        var rightValue = (right.sort && (right.sort[state.sortKey] || right.sort[sortKey])) ||
          (right.columns && (right.columns[state.sortKey] || right.columns[sortKey])) ||
          right.search ||
          '';
        return compareValues(leftValue, rightValue, state.sortDirection);
      });
      visibleRecords = getPageSize(state) ? matchedRows.slice(pageWindow.start, pageWindow.end) : matchedRows;
    } else {
      var matchedIndex = 0;
      var currentSection = null;
      var renderedSection = null;
      records.forEach(function (record) {
        if (!record) return;
        if (record.section) {
          currentSection = record;
          renderedSection = null;
          return;
        }
        if (!deferredRowMatches(record, state)) {
          return;
        }
        var visible = !getPageSize(state) || (matchedIndex >= pageWindow.start && matchedIndex < pageWindow.end);
        if (visible) {
          if (currentSection && renderedSection !== currentSection) {
            visibleRecords.push(currentSection);
            renderedSection = currentSection;
          }
          visibleRecords.push(record);
        }
        matchedIndex += 1;
      });
    }

    tbody.innerHTML = visibleRecords.map(function (record) { return record.html || ''; }).join('');

    table.querySelectorAll('[data-hfx-sort-key]').forEach(function (header) {
      var active = normalizeText(header.getAttribute('data-hfx-sort-key')) === normalizeText(state.sortKey);
      var ariaSort = active ? (state.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none';
      header.setAttribute('aria-sort', ariaSort);
    });

    updatePager(table, state, totalMatches, totalRows, pageWindow);
    table.dispatchEvent(new CustomEvent('hfx:collection:rendered', {
      bubbles: true,
      detail: {
        total: totalMatches,
        totalRows: totalRows,
        page: state.page,
        pageSize: pageWindow.pageSize,
        deferred: true
      }
    }));
  }

  function applyItemState(items, state) {
    var remaining = state.limit > 0 ? state.limit : Number.POSITIVE_INFINITY;
    Array.prototype.forEach.call(items || [], function (item) {
      var searchHaystack = normalizeText(item.getAttribute('data-hfx-search') || item.textContent);
      var visible = true;

      if (state.query && searchHaystack.indexOf(state.query) === -1) {
        visible = false;
      }
      if (visible && state.filter && !filterMatches(item.getAttribute('data-hfx-status') || '', state.filter)) {
        visible = false;
      }
      if (visible && remaining <= 0) {
        visible = false;
      }

      item.style.display = visible ? '' : 'none';
      if (visible) {
        remaining -= 1;
      }
    });
  }

  function activateFilterButton(toolbar, value) {
    toolbar.querySelectorAll('[data-hfx-filter-value]').forEach(function (button) {
      var active = normalizeText(button.getAttribute('data-hfx-filter-value')) === normalizeText(value) && !!value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function switchEntityCollectionView(host, view) {
    var normalized = normalizeText(view) || 'table';
    host.setAttribute('data-hfx-active-view', normalized);
    host.querySelectorAll('[data-hfx-entity-view-target]').forEach(function (button) {
      var active = normalizeText(button.getAttribute('data-hfx-entity-view-target')) === normalized;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    host.querySelectorAll('[data-hfx-entity-pane]').forEach(function (pane) {
      var active = normalizeText(pane.getAttribute('data-hfx-entity-pane')) === normalized;
      pane.classList.toggle('show', active);
      pane.classList.toggle('active', active);
    });
  }

  function closeContainingDropdown(trigger) {
    var dropdownToggle = trigger && trigger.closest
      ? trigger.closest('.dropdown-menu') && trigger.closest('.dropdown-menu').previousElementSibling
      : null;
    if (!dropdownToggle) return;

    if (window.bootstrap && window.bootstrap.Dropdown) {
      var instance = window.bootstrap.Dropdown.getInstance(dropdownToggle);
      if (instance) {
        instance.hide();
        return;
      }
    }

    dropdownToggle.setAttribute('aria-expanded', 'false');
    var menu = dropdownToggle.nextElementSibling;
    if (menu) {
      menu.classList.remove('show');
    }
  }

  function buildState(toolbar, table) {
    var records = toolbar ? toolbar.querySelector('[data-hfx-collection-records]') : null;
    var search = toolbar ? toolbar.querySelector('[data-hfx-collection-search]') : null;
    var configuredPageSize = table ? Number(table.getAttribute('data-hfx-collection-page-size') || 0) : 0;
    var selectedPageSize = records ? Number(records.value || 0) : configuredPageSize;
    var defaultSortHeader = table
      ? table.querySelector('[data-hfx-sort-key][data-hfx-sort-direction="ascending"], [data-hfx-sort-key][data-hfx-sort-direction="descending"]')
      : null;
    return {
      query: normalizeText(search ? search.value : ''),
      limit: Number.isFinite(selectedPageSize) ? selectedPageSize : 0,
      pageSize: Number.isFinite(selectedPageSize) ? selectedPageSize : 0,
      page: 1,
      filter: getActiveFilter(toolbar),
      columnFilters: getColumnFilters(table),
      sortKey: defaultSortHeader ? (defaultSortHeader.getAttribute('data-hfx-sort-key') || '') : '',
      sortDirection: defaultSortHeader && normalizeText(defaultSortHeader.getAttribute('data-hfx-sort-direction')) === 'descending' ? 'desc' : 'asc'
    };
  }

  function bindTableSorting(table, state, apply) {
    if (!table) return;
    table.querySelectorAll('[data-hfx-sort-key]').forEach(function (header) {
      var activate = function (event) {
        if (event) {
          event.preventDefault();
        }
        var key = header.getAttribute('data-hfx-sort-key') || '';
        if (normalizeText(state.sortKey) === normalizeText(key)) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDirection = normalizeText(header.getAttribute('data-hfx-sort-direction')) === 'descending' ? 'desc' : 'asc';
        }
        state.page = 1;
        apply();
      };
      header.addEventListener('click', activate);
      header.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          activate(event);
        }
      });
    });
  }

  function bindToolbar(toolbar, table, state, apply) {
    if (!toolbar) return;
    var search = toolbar.querySelector('[data-hfx-collection-search]');
    if (search) {
      search.addEventListener('input', function () {
        state.query = normalizeText(search.value);
        state.page = 1;
        apply();
      });
    }

    var records = toolbar.querySelector('[data-hfx-collection-records]');
    if (records) {
      records.addEventListener('change', function () {
        var value = Number(records.value || 0);
        state.limit = Number.isFinite(value) ? value : 0;
        state.pageSize = state.limit;
        state.page = 1;
        syncPageSizeControls(table, toolbar, state.limit, records);
        apply();
      });
    }

    toolbar.querySelectorAll('[data-hfx-filter-value]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        var value = normalizeText(button.getAttribute('data-hfx-filter-value'));
        state.filter = state.filter === value ? '' : value;
        state.page = 1;
        activateFilterButton(toolbar, state.filter);
        apply();
      });
    });
  }

  function bindColumnFilters(table, state, apply) {
    if (!table) return;
    table.querySelectorAll('[data-hfx-collection-column-filter]').forEach(function (input) {
      input.addEventListener('input', function () {
        state.columnFilters = getColumnFilters(table);
        state.page = 1;
        apply();
      });
    });
  }

  function bindPager(table, toolbar, state, apply) {
    var wrapper = table ? table.closest('[data-hfx-collection-table-wrapper]') : null;
    var pager = wrapper ? wrapper.querySelector('[data-hfx-collection-pager]') : null;
    if (!pager) return;

    var select = pager.querySelector('[data-hfx-collection-page-size-select]');
    if (select) {
      select.addEventListener('change', function () {
        var value = Number(select.value || 0);
        state.limit = Number.isFinite(value) ? value : 0;
        state.pageSize = state.limit;
        state.page = 1;
        syncPageSizeControls(table, toolbar, state.limit, select);
        apply();
      });
    }

    var previous = pager.querySelector('[data-hfx-collection-page-prev]');
    if (previous) {
      previous.addEventListener('click', function () {
        state.page = Math.max(1, Number(state.page || 1) - 1);
        apply();
      });
    }

    var next = pager.querySelector('[data-hfx-collection-page-next]');
    if (next) {
      next.addEventListener('click', function () {
        state.page = Number(state.page || 1) + 1;
        apply();
      });
    }
  }

  function initStandaloneTable(wrapper) {
    if (!wrapper || typeof wrapper !== 'object' || wrapper.nodeType !== 1 || wrapper.__hfxCollectionReady) return;
    wrapper.__hfxCollectionReady = true;

    var table = wrapper.querySelector('[data-hfx-collection-table]');
    var toolbar = findStandaloneToolbar(wrapper);
    var state = buildState(toolbar, table);
    var remoteTimer = null;
    var apply = function () {
      if (isRemoteTable(table)) {
        var debounce = Number(table.getAttribute('data-hfx-collection-remote-debounce') || 0);
        window.clearTimeout(remoteTimer);
        remoteTimer = window.setTimeout(function () {
          requestRemoteTable(table, state);
        }, Math.max(0, debounce));
        return;
      }

      if (isDeferredTable(table)) {
        applyDeferredTableState(table, state);
        return;
      }

      applyTableState(table, state);
    };

    bindToolbar(toolbar, table, state, apply);
    bindTableSorting(table, state, apply);
    bindColumnFilters(table, state, apply);
    bindPager(table, toolbar, state, apply);
    apply();
  }

  function initEntityCollection(host) {
    if (!host || host.__hfxEntityCollectionReady) return;
    host.__hfxEntityCollectionReady = true;

    var toolbar = getToolbar(host);
    var table = host.querySelector('[data-hfx-collection-table]');
    var listItems = host.querySelectorAll('.hfx-entity-list [data-hfx-collection-item]');
    var cards = host.querySelectorAll('.hfx-collection-cards [data-hfx-collection-item]');
    var state = buildState(toolbar, table);
    var initialView = host.getAttribute('data-hfx-active-view') || 'table';
    var remoteTimer = null;

    var apply = function () {
      if (isRemoteTable(table)) {
        var debounce = Number(table.getAttribute('data-hfx-collection-remote-debounce') || 0);
        window.clearTimeout(remoteTimer);
        remoteTimer = window.setTimeout(function () {
          requestRemoteTable(table, state);
        }, Math.max(0, debounce));
      } else if (isDeferredTable(table)) {
        applyDeferredTableState(table, state);
      } else {
        applyTableState(table, state);
      }
      applyItemState(listItems, state);
      applyItemState(cards, state);
    };

    bindToolbar(toolbar, table, state, apply);
    bindTableSorting(table, state, apply);
    bindColumnFilters(table, state, apply);
    bindPager(table, toolbar, state, apply);

    host.querySelectorAll('[data-hfx-entity-view-target]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        switchEntityCollectionView(host, button.getAttribute('data-hfx-entity-view-target'));
        closeContainingDropdown(button);
      });
    });

    switchEntityCollectionView(host, initialView);
    apply();
  }

  function initAll(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-hfx-entity-collection]').forEach(initEntityCollection);
    scope.querySelectorAll('[data-hfx-collection-table-wrapper]').forEach(function (wrapper) {
      if (!wrapper.closest('[data-hfx-entity-collection]')) {
        initStandaloneTable(wrapper);
      }
    });
  }

  window.hfxCollections = window.hfxCollections || {};
  window.hfxCollections.init = initAll;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(document); });
  } else {
    initAll(document);
  }
})();
