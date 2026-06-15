(function () {
  function hasPage(shell, key) {
    if (!shell || !key) return false;
    return Array.prototype.some.call(shell.querySelectorAll('[data-hfx-monitoring-page]'), function (page) {
      return page.getAttribute('data-hfx-monitoring-page') === key;
    });
  }

  function shellIndex(shell) {
    return Array.prototype.indexOf.call(document.querySelectorAll('[data-hfx-monitoring-shell]'), shell);
  }

  function stateId(shell) {
    var id = shell ? (shell.getAttribute('data-hfx-monitoring-state-id') || '').trim() : '';
    return id || ('shell-' + shellIndex(shell));
  }

  function hashMode(shell) {
    var mode = shell ? (shell.getAttribute('data-hfx-monitoring-hash-mode') || 'bare').trim().toLowerCase() : 'bare';
    if (mode === 'none' || mode === 'bare') return mode;
    return 'namespaced';
  }

  function persistEnabled(shell) {
    var persist = shell ? (shell.getAttribute('data-hfx-monitoring-persist') || 'true').trim().toLowerCase() : 'true';
    return persist !== 'false';
  }

  function encoded(value) {
    return encodeURIComponent(value || '');
  }

  function rawHash() {
    return (window.location.hash || '').replace(/^#/, '');
  }

  function namespacedPrefix(shell) {
    return 'hfx-monitoring:' + encoded(stateId(shell)) + ':';
  }

  function decodeHashPart(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function storageKey(shell) {
    return 'hfx-monitoring-active-page:' + window.location.pathname + ':' + stateId(shell);
  }

  function sidebarStorageKey(shell) {
    return 'hfx-monitoring-sidebar-collapsed:' + window.location.pathname + ':' + stateId(shell);
  }

  function readStoredPage(shell) {
    if (!persistEnabled(shell)) return null;
    try {
      return window.localStorage ? window.localStorage.getItem(storageKey(shell)) : null;
    } catch (error) {
      return null;
    }
  }

  function storePage(shell, key) {
    if (!persistEnabled(shell)) return;
    try {
      if (window.localStorage) window.localStorage.setItem(storageKey(shell), key);
    } catch (error) {
      // Static file reports can run in locked-down browser contexts. Navigation still works without storage.
    }
  }

  function readSidebarCollapsed(shell) {
    if (!persistEnabled(shell)) return false;
    try {
      return window.localStorage ? window.localStorage.getItem(sidebarStorageKey(shell)) === 'true' : false;
    } catch (error) {
      return false;
    }
  }

  function storeSidebarCollapsed(shell, collapsed) {
    if (!persistEnabled(shell)) return;
    try {
      if (window.localStorage) window.localStorage.setItem(sidebarStorageKey(shell), collapsed ? 'true' : 'false');
    } catch (error) {
      // Static file reports can run without storage; collapse still works for the current page view.
    }
  }

  function setSidebarCollapsed(shell, collapsed, options) {
    if (!shell) return;
    options = options || {};
    shell.classList.toggle('is-sidebar-collapsed', collapsed);
    shell.setAttribute('data-hfx-monitoring-sidebar-collapsed', collapsed ? 'true' : 'false');
    shell.querySelectorAll('[data-hfx-monitoring-sidebar-toggle]').forEach(function (button) {
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      button.setAttribute('aria-label', collapsed ? 'Expand navigation' : (button.getAttribute('title') || 'Collapse navigation'));
    });
    if (options.store !== false) storeSidebarCollapsed(shell, collapsed);
  }

  function toggleSidebar(shell) {
    if (!shell) return;
    setSidebarCollapsed(shell, !shell.classList.contains('is-sidebar-collapsed'), { store: true });
  }

  function setSidebarDrawerOpen(shell, open, options) {
    if (!shell) return;
    options = options || {};
    shell.classList.toggle('is-sidebar-drawer-open', open);
    shell.setAttribute('data-hfx-monitoring-sidebar-drawer-open', open ? 'true' : 'false');
    shell.querySelectorAll('[data-hfx-monitoring-sidebar-drawer-toggle]').forEach(function (button) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    shell.querySelectorAll('[data-hfx-monitoring-sidebar-drawer-close]').forEach(function (button) {
      button.setAttribute('aria-hidden', open ? 'false' : 'true');
    });

    if (open && options.focus !== false) {
      var search = shell.querySelector('[data-hfx-monitoring-nav-search]');
      if (search && search.focus) search.focus();
    }
  }

  function toggleSidebarDrawer(shell) {
    if (!shell) return;
    setSidebarDrawerOpen(shell, !shell.classList.contains('is-sidebar-drawer-open'));
  }

  function closeSidebarDrawer(shell) {
    if (!shell || !shell.classList.contains('is-sidebar-drawer-open')) return;
    setSidebarDrawerOpen(shell, false, { focus: false });
  }

  function pageFromHash(shell) {
    if (hashMode(shell) === 'none') return null;
    var hash = rawHash();
    if (!hash) return null;

    if (hashMode(shell) === 'namespaced') {
      var prefix = namespacedPrefix(shell);
      if (hash.indexOf(prefix) !== 0) return null;
      var key = decodeHashPart(hash.slice(prefix.length));
      return hasPage(shell, key) ? key : null;
    }

    var decoded = decodeHashPart(hash);
    return hasPage(shell, decoded) ? decoded : null;
  }

  function hashForPage(shell, key) {
    var mode = hashMode(shell);
    if (mode === 'none') return null;
    if (mode === 'namespaced') return '#' + namespacedPrefix(shell) + encoded(key);
    return '#' + encoded(key);
  }

  function updateHash(shell, key) {
    var hash = hashForPage(shell, key);
    if (!hash) return;
    if (window.location.hash === hash) return;

    if (window.history && window.history.pushState) {
      window.history.pushState({ hfxMonitoringPage: key, hfxMonitoringStateId: stateId(shell) }, '', hash);
      return;
    }

    window.location.hash = hash;
  }

  function replaceHistoryPage(shell, key, updateHash) {
    if (!window.history || !window.history.replaceState) return;
    var url = window.location.href;
    if (updateHash) {
      var hash = hashForPage(shell, key);
      if (!hash) return;
      url = window.location.href.replace(/#.*$/, '') + hash;
    }
    window.history.replaceState({ hfxMonitoringPage: key, hfxMonitoringStateId: stateId(shell) }, '', url);
  }

  function shouldReplaceInitialHash(shell, fromHash) {
    if (fromHash || hashMode(shell) === 'none') return false;
    var hash = rawHash();
    return hashMode(shell) === 'namespaced' && hash.indexOf(namespacedPrefix(shell)) === 0;
  }

  function preferredPage(shell, fallbackKey) {
    var fromHash = pageFromHash(shell);
    if (fromHash) return fromHash;

    var stored = readStoredPage(shell);
    if (stored && hasPage(shell, stored)) return stored;

    return fallbackKey;
  }

  function scrollPageStart(shell, page) {
    if (!page || !page.getBoundingClientRect || typeof window === 'undefined') return;
    var topbar = shell ? shell.querySelector('.hfx-monitoring-topbar') : null;
    var offset = topbar && topbar.getBoundingClientRect ? topbar.getBoundingClientRect().height : 0;
    var top = page.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }

  function activate(shell, key, options) {
    if (!shell || !key || !hasPage(shell, key)) return false;
    options = options || {};
    var buttons = shell.querySelectorAll('[data-hfx-monitoring-nav]');
    var pages = shell.querySelectorAll('[data-hfx-monitoring-page]');
    var activePage = null;

    buttons.forEach(function (button) {
      var active = button.getAttribute('data-hfx-monitoring-nav') === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });

    pages.forEach(function (page) {
      var active = page.getAttribute('data-hfx-monitoring-page') === key;
      page.classList.toggle('is-active', active);
      page.hidden = !active;
      if (active) {
        activePage = page;
        applyFilters(page);
      }
    });

    if (options.store !== false) storePage(shell, key);
    if (options.updateHash) updateHash(shell, key);
    if (options.scroll) scrollPageStart(shell, activePage);
    return true;
  }

  function scopeFor(element) {
    return element.closest('[data-hfx-monitoring-page].is-active') ||
      element.closest('[data-hfx-monitoring-shell]') ||
      document;
  }

  function searchableText(row) {
    return (row.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function navItemText(item) {
    return (item.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function applyNavSearch(shell) {
    if (!shell) return;
    var input = shell.querySelector('[data-hfx-monitoring-nav-search]');
    if (!input) return;

    var query = (input.value || '').trim().toLowerCase();
    var visible = 0;
    shell.querySelectorAll('[data-hfx-monitoring-nav]').forEach(function (item) {
      var match = !query || navItemText(item).indexOf(query) !== -1;
      item.hidden = !match;
      if (match) visible += 1;
    });

    shell.querySelectorAll('.hfx-monitoring-nav-group').forEach(function (group) {
      var hasVisibleItem = false;
      var sibling = group.nextElementSibling;
      while (sibling && !sibling.classList.contains('hfx-monitoring-nav-group') && !sibling.hasAttribute('data-hfx-monitoring-nav-boundary')) {
        if (sibling.matches && sibling.matches('[data-hfx-monitoring-nav]') && !sibling.hidden) {
          hasVisibleItem = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      group.hidden = !hasVisibleItem;
    });

    shell.querySelectorAll('[data-hfx-monitoring-nav-boundary]').forEach(function (boundary) {
      var hasVisibleItem = false;
      var sibling = boundary.nextElementSibling;
      while (sibling && !sibling.classList.contains('hfx-monitoring-nav-group') && !sibling.hasAttribute('data-hfx-monitoring-nav-boundary')) {
        if (sibling.matches && sibling.matches('[data-hfx-monitoring-nav]') && !sibling.hidden) {
          hasVisibleItem = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      boundary.hidden = !hasVisibleItem;
    });

    shell.querySelectorAll('[data-hfx-monitoring-nav-empty]').forEach(function (empty) {
      empty.hidden = visible !== 0;
    });
  }

  function firstVisibleNavItem(shell) {
    if (!shell) return null;
    return Array.prototype.find.call(shell.querySelectorAll('[data-hfx-monitoring-nav]'), function (item) {
      return !item.hidden;
    }) || null;
  }

  function elementTarget(element) {
    if (!element || !element.getAttribute) return '';
    var target = (element.getAttribute('data-hfx-monitoring-target') || '').trim();
    if (target) return target;
    var owner = element.closest ? element.closest('[data-hfx-monitoring-target]') : null;
    return owner && owner !== element ? (owner.getAttribute('data-hfx-monitoring-target') || '').trim() : '';
  }

  function surfaceAcceptsControl(surface, control) {
    var controlTarget = elementTarget(control);
    var surfaceTarget = elementTarget(surface);
    return controlTarget ? surfaceTarget === controlTarget : !surfaceTarget;
  }

  function activeFilterTokens(scope, surface) {
    var tokens = [];
    scope.querySelectorAll('[data-hfx-monitoring-chip].is-active').forEach(function (chip) {
      var chipGroup = chip.closest ? chip.closest('[data-hfx-monitoring-chips]') : null;
      if (!surfaceAcceptsControl(surface, chipGroup || chip)) return;
      var filter = (chip.getAttribute('data-hfx-monitoring-filter') || '').trim().toLowerCase();
      if (filter) tokens.push(filter);
    });
    return tokens;
  }

  function activeSearchQuery(scope, surface) {
    var queries = [];
    scope.querySelectorAll('[data-hfx-monitoring-search]').forEach(function (input) {
      if (!surfaceAcceptsControl(surface, input)) return;
      var value = (input.value || '').trim().toLowerCase();
      if (value) queries.push(value);
    });
    return queries.join(' ');
  }

  function initialSearchQuery() {
    if (typeof window === 'undefined' || !window.location) return '';
    var search = window.location.search || '';
    if (!search || search.length < 2) return '';
    try {
      var params = new URLSearchParams(search);
      return (params.get('hfxSearch') || params.get('q') || '').trim();
    } catch (_) {
      var match = search.match(/[?&](?:hfxSearch|q)=([^&]+)/i);
      return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() : '';
    }
  }

  function applyInitialSearch(shell) {
    var query = initialSearchQuery();
    if (!query || !shell) return;
    var page = shell.querySelector('[data-hfx-monitoring-page].is-active') || shell;
    var applied = false;
    page.querySelectorAll('[data-hfx-monitoring-search]').forEach(function (input) {
      if (!applied && !input.value) {
        input.value = query;
        applied = true;
      }
    });
  }

  function rowMatchesFilters(row, tokens) {
    if (!tokens.length) return true;
    var values = ' ' + (row.getAttribute('data-hfx-monitoring-filter-values') || '').toLowerCase() + ' ';
    return tokens.every(function (token) {
      return values.indexOf(' ' + token + ' ') !== -1;
    });
  }

  function ensureVisibleSelection(surface) {
    var selected = surface.querySelector('[data-hfx-monitoring-alert-row].is-selected');
    if (selected && !selected.hidden) return;
    var firstVisible = surface.querySelector('[data-hfx-monitoring-alert-row]:not([hidden])');
    if (firstVisible) {
      activateAlertRow(firstVisible);
    }
  }

  function numberAttribute(element, attributeName, fallback) {
    var value = Number(element && element.getAttribute ? element.getAttribute(attributeName) : '');
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function pageSizeFor(surface) {
    return numberAttribute(surface, 'data-hfx-monitoring-page-size', 0);
  }

  function currentPageFor(surface) {
    return numberAttribute(surface, 'data-hfx-monitoring-current-page', 1);
  }

  function setCurrentPage(surface, page) {
    if (!surface || !surface.setAttribute) return;
    surface.setAttribute('data-hfx-monitoring-current-page', String(Math.max(1, page)));
  }

  function tableBlockFor(surface) {
    return surface && surface.closest ? surface.closest('[data-hfx-monitoring-page-block], .hfx-monitoring-table-block') : null;
  }

  function visiblePages(currentPage, totalPages) {
    var pages = [];
    var page;
    if (totalPages <= 7) {
      for (page = 1; page <= totalPages; page += 1) pages.push(page);
      return pages;
    }

    pages.push(1);
    var start = Math.max(2, currentPage - 1);
    var end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push(0);
    for (page = start; page <= end; page += 1) pages.push(page);
    if (end < totalPages - 1) pages.push(0);
    pages.push(totalPages);
    return pages;
  }

  function pageButton(label, page, text, current, disabled) {
    var button = document.createElement('button');
    button.className = 'hfx-monitoring-table-page' + (text === '<' || text === '>' ? ' hfx-monitoring-table-page--icon' : '') + (current ? ' is-active' : '');
    button.type = 'button';
    button.setAttribute('data-hfx-monitoring-page-button', String(page));
    button.setAttribute('aria-label', label);
    if (current) button.setAttribute('aria-current', 'page');
    if (disabled) button.disabled = true;
    button.textContent = text;
    return button;
  }

  function clearElement(element) {
    if (!element) return;
    if (element.replaceChildren) {
      element.replaceChildren();
      return;
    }

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function renderPager(surface, currentPage, totalPages) {
    var block = tableBlockFor(surface);
    var pager = block ? block.querySelector('[data-hfx-monitoring-page-pager], [data-hfx-monitoring-table-pager]') : null;
    if (!pager) return;

    clearElement(pager);
    pager.appendChild(pageButton('Previous page', 'previous', '<', false, currentPage <= 1 || totalPages <= 1));

    visiblePages(currentPage, totalPages).forEach(function (page) {
      if (page === 0) {
        var gap = document.createElement('span');
        gap.className = 'hfx-monitoring-table-page-gap';
        gap.setAttribute('aria-hidden', 'true');
        gap.textContent = '...';
        pager.appendChild(gap);
        return;
      }

      pager.appendChild(pageButton(
        page === currentPage ? 'Page ' + page + ', current page' : 'Page ' + page,
        page,
        String(page),
        page === currentPage,
        false
      ));
    });

    pager.appendChild(pageButton('Next page', 'next', '>', false, currentPage >= totalPages || totalPages <= 1));
  }

  function updatePagingSummary(surface, currentPage, pageSize, totalRows) {
    var block = tableBlockFor(surface);
    var summary = block ? block.querySelector('[data-hfx-monitoring-page-summary], [data-hfx-monitoring-table-summary]') : null;
    if (!summary) return;

    if (totalRows <= 0) {
      summary.textContent = 'No rows to show';
      return;
    }

    var start = ((currentPage - 1) * pageSize) + 1;
    var end = Math.min(totalRows, currentPage * pageSize);
    summary.textContent = 'Showing ' + start + ' to ' + end + ' of ' + totalRows + ' rows';
  }

  function applyPagination(surface, rows, matchedRows) {
    var pageSize = pageSizeFor(surface);
    if (!pageSize) return matchedRows.length;

    var totalRows = matchedRows.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    var currentPage = Math.min(Math.max(1, currentPageFor(surface)), totalPages);
    setCurrentPage(surface, currentPage);

    var firstIndex = (currentPage - 1) * pageSize;
    var lastIndex = firstIndex + pageSize;
    var matchedIndex = 0;

    rows.forEach(function (row) {
      var matches = row.getAttribute('data-hfx-monitoring-row-match') === 'true';
      if (!matches) {
        row.setAttribute('data-hfx-monitoring-row-page-visible', 'false');
        row.hidden = true;
        return;
      }

      var visible = matchedIndex >= firstIndex && matchedIndex < lastIndex;
      row.setAttribute('data-hfx-monitoring-row-page-visible', visible ? 'true' : 'false');
      row.hidden = !visible;
      matchedIndex += 1;
    });

    updatePagingSummary(surface, currentPage, pageSize, totalRows);
    renderPager(surface, currentPage, totalPages);
    return totalRows;
  }

  function pagedSurfaceFor(button) {
    var block = button && button.closest ? button.closest('[data-hfx-monitoring-page-block], .hfx-monitoring-table-block') : null;
    return block ? block.querySelector('[data-hfx-monitoring-page-size]') : null;
  }

  function updateSearchGroups(surface) {
    surface.querySelectorAll('[data-hfx-monitoring-search-group]').forEach(function (group) {
      var rows = group.querySelectorAll('[data-hfx-monitoring-search-row]');
      var hasVisible = Array.prototype.some.call(rows, function (row) {
        return !row.hidden;
      });
      group.hidden = rows.length > 0 && !hasVisible;
    });
  }

  function activatePageButton(button) {
    var surface = pagedSurfaceFor(button);
    if (!surface) return false;

    var value = button.getAttribute('data-hfx-monitoring-page-button') || '';
    var page = currentPageFor(surface);
    if (value === 'previous') {
      page -= 1;
    } else if (value === 'next') {
      page += 1;
    } else {
      page = Number(value);
    }

    if (!Number.isFinite(page)) return false;
    setCurrentPage(surface, page);
    applyFilters(scopeFor(button));
    return true;
  }

  function applyFilters(scope) {
    if (!scope) return;
    var surfaces = scope.querySelectorAll('[data-hfx-monitoring-search-table], [data-hfx-monitoring-search-surface]');

    surfaces.forEach(function (surface) {
      var query = activeSearchQuery(scope, surface);
      var filters = activeFilterTokens(scope, surface);
      if (applyDeferredRecords(scope, surface, query, filters)) {
        return;
      }

      var rows = surface.querySelectorAll('[data-hfx-monitoring-search-row]');
      var matchedRows = [];

      rows.forEach(function (row) {
        var searchMatch = !query || searchableText(row).indexOf(query) !== -1;
        var filterMatch = rowMatchesFilters(row, filters);
        var match = searchMatch && filterMatch;
        row.setAttribute('data-hfx-monitoring-row-match', match ? 'true' : 'false');
        if (match) matchedRows.push(row);
      });

      var visible = applyPagination(surface, rows, matchedRows);
      if (!pageSizeFor(surface)) {
        rows.forEach(function (row) {
          var matched = row.getAttribute('data-hfx-monitoring-row-match') === 'true';
          row.setAttribute('data-hfx-monitoring-row-page-visible', matched ? 'true' : 'false');
          row.hidden = !matched;
        });
      }

      var treeVisible = applyTreeVisibility(surface);
      if (treeVisible !== null) visible = treeVisible;
      updateSearchGroups(surface);
      syncRecordDetails(surface);

      surface.querySelectorAll('[data-hfx-monitoring-search-empty]').forEach(function (empty) {
        empty.hidden = visible !== 0;
      });

      ensureVisibleSelection(surface);
    });
  }

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
    var records = (data.Records || data.records || []).filter(function (record) {
      return (!query || deferredRecordText(record).indexOf(query) !== -1) && deferredRecordMatchesFilters(record, filters);
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

  function activateColumnGroup(button) {
    var group = button && button.closest ? button.closest('.hfx-monitoring-column-groups') : null;
    if (!group) return;
    setExclusiveActive(group.querySelectorAll('[data-hfx-monitoring-column-group]'), button, 'is-active', 'aria-pressed');
    var explorer = button.closest ? button.closest('[data-hfx-monitoring-record-explorer]') : null;
    var state = (button.getAttribute('data-hfx-monitoring-column-state') || '').split(',').map(function (key) { return key.trim(); }).filter(Boolean);
    applyColumnState(explorer, state);
  }

  function applyInitialColumnGroups(root) {
    (root || document).querySelectorAll('[data-hfx-monitoring-record-explorer]').forEach(function (explorer) {
      var activeGroup = explorer.querySelector('[data-hfx-monitoring-column-group].is-active[data-hfx-monitoring-column-state]');
      if (!activeGroup) return;
      var state = (activeGroup.getAttribute('data-hfx-monitoring-column-state') || '').split(',').map(function (key) { return key.trim(); }).filter(Boolean);
      applyColumnState(explorer, state);
    });
  }

  function closeRecordPopovers(explorer, except) {
    if (!explorer) return;
    explorer.querySelectorAll('[data-hfx-monitoring-column-picker], [data-hfx-monitoring-view-save]').forEach(function (panel) {
      if (except && panel === except) return;
      panel.hidden = true;
    });
    explorer.querySelectorAll('[data-hfx-monitoring-column-picker-toggle], [data-hfx-monitoring-view-save-toggle]').forEach(function (button) {
      var controlsColumnPicker = button.hasAttribute('data-hfx-monitoring-column-picker-toggle');
      var controlled = controlsColumnPicker
        ? explorer.querySelector('[data-hfx-monitoring-column-picker]')
        : explorer.querySelector('[data-hfx-monitoring-view-save]');
      if (!except || controlled !== except) button.setAttribute('aria-expanded', 'false');
    });
  }

  function toggleRecordPopover(button, selector) {
    var explorer = button && button.closest ? button.closest('[data-hfx-monitoring-record-explorer]') : null;
    var panel = explorer ? explorer.querySelector(selector) : null;
    if (!panel) return;
    var open = panel.hidden;
    closeRecordPopovers(explorer, open ? panel : null);
    panel.hidden = !open;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var focusTarget = panel.querySelector('input:not([type="hidden"]), button');
      if (focusTarget && focusTarget.focus) focusTarget.focus();
    }
  }

  function columnOptions(explorer) {
    return explorer
      ? Array.prototype.slice.call(explorer.querySelectorAll('[data-hfx-monitoring-column-option]'))
      : [];
  }

  function checkedColumnKeys(explorer) {
    return columnOptions(explorer)
      .filter(function (input) { return input.checked; })
      .map(function (input) { return input.getAttribute('data-hfx-monitoring-column-option') || ''; })
      .filter(Boolean);
  }

  function updateColumnRail(explorer, visibleCount) {
    var rail = explorer ? explorer.querySelector('[data-hfx-monitoring-column-rail]') : null;
    if (!rail) return;
    clearElement(rail);
    var count = Math.max(12, visibleCount * 3);
    for (var i = 0; i < count; i++) {
      var marker = document.createElement('span');
      if (i % 9 === 4) marker.classList.add('is-wide');
      if (i % 7 === 2) marker.classList.add('is-pinned');
      rail.appendChild(marker);
    }
    var thumb = document.createElement('b');
    thumb.className = 'hfx-monitoring-column-rail-thumb';
    thumb.setAttribute('data-hfx-monitoring-column-rail-thumb', 'true');
    thumb.setAttribute('aria-hidden', 'true');
    rail.appendChild(thumb);
    syncColumnRail(explorer);
  }

  function tableScrollerForRail(rail) {
    var block = rail && rail.closest ? rail.closest('.hfx-monitoring-record-table-block') : null;
    return block ? block.querySelector('.hfx-monitoring-table-wrap') : null;
  }

  function syncColumnRail(explorerOrRail) {
    var rails = explorerOrRail && explorerOrRail.matches && explorerOrRail.matches('[data-hfx-monitoring-column-rail]')
      ? [explorerOrRail]
      : Array.prototype.slice.call((explorerOrRail || document).querySelectorAll('[data-hfx-monitoring-column-rail]'));

    rails.forEach(function (rail) {
      var scroller = tableScrollerForRail(rail);
      var thumb = rail.querySelector('[data-hfx-monitoring-column-rail-thumb]');
      if (!scroller || !thumb) return;

      var scrollable = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      var ratio = scrollable > 0 ? scroller.scrollLeft / scrollable : 0;
      var visibleRatio = scroller.scrollWidth > 0 ? Math.min(1, scroller.clientWidth / scroller.scrollWidth) : 1;
      var thumbWidth = Math.max(12, visibleRatio * 100);
      var thumbLeft = Math.min(100 - thumbWidth, Math.max(0, ratio * (100 - thumbWidth)));
      thumb.style.width = thumbWidth + '%';
      thumb.style.left = thumbLeft + '%';
      rail.classList.toggle('is-scrollable', scrollable > 1);
      rail.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      rail.setAttribute('aria-valuetext', scrollable > 1 ? Math.round(ratio * 100) + '% scrolled' : 'All columns visible');
    });
  }

  function scrollColumnRail(rail, ratio) {
    var scroller = tableScrollerForRail(rail);
    if (!scroller) return;
    var scrollable = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.max(0, Math.min(1, ratio)) * scrollable;
    syncColumnRail(rail);
  }

  function activateColumnRail(rail, event) {
    if (!rail || !event) return;
    var rect = rail.getBoundingClientRect ? rail.getBoundingClientRect() : null;
    if (!rect || rect.width <= 0) return;
    scrollColumnRail(rail, (event.clientX - rect.left) / rect.width);
  }

  var activeColumnRail = null;

  function beginColumnRailDrag(rail, event) {
    if (!rail || !event || (event.button !== undefined && event.button !== 0)) return;
    activeColumnRail = rail;
    rail.classList.add('is-dragging');
    if (rail.setPointerCapture && event.pointerId !== undefined) {
      try {
        rail.setPointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture is progressive; the drag still works with document listeners.
      }
    }
    activateColumnRail(rail, event);
  }

  function updateColumnRailDrag(event) {
    if (!activeColumnRail) return;
    event.preventDefault();
    activateColumnRail(activeColumnRail, event);
  }

  function endColumnRailDrag(event) {
    if (!activeColumnRail) return;
    var rail = activeColumnRail;
    activeColumnRail = null;
    rail.classList.remove('is-dragging');
    if (rail.releasePointerCapture && event && event.pointerId !== undefined) {
      try {
        rail.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Ignore lost capture when the pointer leaves the document.
      }
    }
  }

  function updateColumnPickerSummary(explorer) {
    var options = columnOptions(explorer);
    var checked = options.filter(function (input) { return input.checked; });
    var summary = explorer ? explorer.querySelector('[data-hfx-monitoring-column-picker-summary]') : null;
    if (summary) summary.textContent = checked.length + ' of ' + options.length + ' visible';
    options.forEach(function (input) {
      input.disabled = checked.length <= 1 && input.checked;
    });
    updateColumnRail(explorer, checked.length);
    return checked.map(function (input) {
      return input.getAttribute('data-hfx-monitoring-column-option') || '';
    }).filter(Boolean);
  }

  function setColumnVisibility(explorer, key, visible) {
    if (!explorer || !key) return;
    explorer.querySelectorAll('[data-hfx-monitoring-column-cell="' + key + '"], [data-hfx-monitoring-column-drawer="' + key + '"]').forEach(function (cell) {
      cell.hidden = !visible;
    });
    var visibleCount = checkedColumnKeys(explorer).length;
    explorer.querySelectorAll('[data-hfx-monitoring-record-details] > td').forEach(function (cell) {
      cell.setAttribute('colspan', String(Math.max(1, visibleCount + 1)));
    });
    var emptyRow = explorer.querySelector('[data-hfx-monitoring-search-empty] td');
    if (emptyRow) emptyRow.setAttribute('colspan', String(Math.max(1, visibleCount + 1)));
  }

  function applyColumnState(explorer, keys) {
    if (!explorer || !keys || !keys.length) return;
    var options = columnOptions(explorer);
    if (!options.length) return;
    var available = Object.create(null);
    options.forEach(function (input) {
      var key = input.getAttribute('data-hfx-monitoring-column-option') || '';
      if (key) available[key] = true;
    });
    var nextKeys = keys.filter(function (key) { return !!available[key]; });
    if (!nextKeys.length) {
      nextKeys = options.filter(function (input) { return input.checked; }).map(function (input) {
        return input.getAttribute('data-hfx-monitoring-column-option') || '';
      }).filter(Boolean);
    }
    if (!nextKeys.length) {
      nextKeys = [(options[0].getAttribute('data-hfx-monitoring-column-option') || '')].filter(Boolean);
    }
    if (!nextKeys.length) return;
    var wanted = Object.create(null);
    nextKeys.forEach(function (key) { wanted[key] = true; });
    options.forEach(function (input) {
      var key = input.getAttribute('data-hfx-monitoring-column-option') || '';
      var visible = !!wanted[key];
      input.checked = visible;
      setColumnVisibility(explorer, key, visible);
    });
    updateColumnPickerSummary(explorer);
    syncRecordDetails(explorer);
  }

  function activateColumnOption(input) {
    var explorer = input && input.closest ? input.closest('[data-hfx-monitoring-record-explorer]') : null;
    if (!explorer) return;
    if (!input.checked && checkedColumnKeys(explorer).length === 0) {
      input.checked = true;
      return;
    }
    setColumnVisibility(explorer, input.getAttribute('data-hfx-monitoring-column-option') || '', input.checked);
    updateColumnPickerSummary(explorer);
    syncRecordDetails(explorer);
  }

  function selectColumnPreset(button) {
    var explorer = button && button.closest ? button.closest('[data-hfx-monitoring-record-explorer]') : null;
    if (!explorer) return;
    var mode = button.getAttribute('data-hfx-monitoring-column-picker-select') || '';
    var keys = mode === 'all'
      ? columnOptions(explorer).map(function (input) { return input.getAttribute('data-hfx-monitoring-column-option') || ''; }).filter(Boolean)
      : (button.getAttribute('data-hfx-monitoring-column-defaults') || '').split(',').map(function (key) { return key.trim(); }).filter(Boolean);
    applyColumnState(explorer, keys);
  }

  function setActiveRecordView(view) {
    var explorer = view && view.closest ? view.closest('[data-hfx-monitoring-record-explorer]') : null;
    if (!explorer) return;
    explorer.querySelectorAll('[data-hfx-monitoring-record-view]').forEach(function (candidate) {
      var active = candidate === view;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var title = (view.getAttribute('data-hfx-monitoring-record-view') || view.textContent || '').replace(/\s+/g, ' ').trim();
    var activeName = explorer.querySelector('[data-hfx-monitoring-active-view-name]');
    if (activeName && title) activeName.textContent = title;
    var state = (view.getAttribute('data-hfx-monitoring-column-state') || '').split(',').map(function (key) { return key.trim(); }).filter(Boolean);
    applyColumnState(explorer, state);
  }

  function createRecordView(button) {
    var explorer = button && button.closest ? button.closest('[data-hfx-monitoring-record-explorer]') : null;
    if (!explorer) return;
    var input = explorer.querySelector('[data-hfx-monitoring-view-name-input]');
    var name = input ? (input.value || '').replace(/\s+/g, ' ').trim() : '';
    if (!name) name = 'Custom view';
    var keys = checkedColumnKeys(explorer);
    var list = explorer.querySelector('[data-hfx-monitoring-record-view-list]');
    if (!list) return;

    var existing = Array.prototype.filter.call(list.querySelectorAll('[data-hfx-monitoring-record-view]'), function (view) {
      return (view.getAttribute('data-hfx-monitoring-record-view') || '').toLowerCase() === name.toLowerCase();
    })[0];
    var view = existing || document.createElement('button');
    if (!existing) {
      view.className = 'hfx-monitoring-record-view-row';
      view.type = 'button';
      view.setAttribute('data-hfx-monitoring-record-view', name);
      var title = document.createElement('span');
      title.textContent = name;
      var detail = document.createElement('small');
      detail.textContent = 'Saved just now';
      view.appendChild(title);
      view.appendChild(detail);
      list.appendChild(view);
    }
    view.setAttribute('data-hfx-monitoring-column-state', keys.join(','));
    setActiveRecordView(view);
  }

  function commandSelectMenu(button) {
    var menuId = button ? button.getAttribute('aria-controls') : '';
    var wrap = button && button.closest ? button.closest('.hfx-monitoring-command-select-wrap') : null;
    var localMenu = wrap ? wrap.querySelector('.hfx-monitoring-command-select-menu') : null;
    return localMenu || (menuId ? document.getElementById(menuId) : null);
  }

  function closeCommandSelects(scope, except) {
    var rootScope = scope && scope.querySelectorAll ? scope : document;
    rootScope.querySelectorAll('[data-hfx-monitoring-command-select][aria-expanded="true"]').forEach(function (button) {
      if (except && button === except) return;
      button.setAttribute('aria-expanded', 'false');
      var menu = commandSelectMenu(button);
      if (menu) menu.hidden = true;
    });
  }

  function toggleCommandSelect(button) {
    if (!button) return;
    var menu = commandSelectMenu(button);
    if (!menu) return;
    var expanded = button.getAttribute('aria-expanded') === 'true';
    closeCommandSelects(button.closest('[data-hfx-monitoring-shell]') || document, button);
    button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    menu.hidden = expanded;
  }

  function chooseCommandSelectOption(option) {
    var wrap = option && option.closest ? option.closest('.hfx-monitoring-command-select-wrap') : null;
    var button = wrap ? wrap.querySelector('[data-hfx-monitoring-command-select]') : null;
    var menu = wrap ? wrap.querySelector('.hfx-monitoring-command-select-menu') : null;
    if (!button || !menu) return;

    var value = (option.getAttribute('data-hfx-monitoring-command-select-option') || option.textContent || '').replace(/\s+/g, ' ').trim();
    if (!value) return;

    button.setAttribute('data-hfx-monitoring-value', value);
    button.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    var pill = button.querySelector('.hfx-monitoring-pill');
    if (pill) pill.textContent = value;

    menu.querySelectorAll('[data-hfx-monitoring-command-select-option]').forEach(function (candidate) {
      var selected = candidate === option;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-selected', selected ? 'true' : 'false');
    });

    showActionToast(button);
  }

  function commandSelectOptions(menu) {
    return menu
      ? Array.prototype.filter.call(menu.querySelectorAll('[data-hfx-monitoring-command-select-option]'), function (option) {
        return !option.hidden;
      })
      : [];
  }

  function focusCommandSelectOption(button, direction) {
    var menu = commandSelectMenu(button);
    var options = commandSelectOptions(menu);
    if (!options.length) return;
    var selected = menu.querySelector('[data-hfx-monitoring-command-select-option][aria-selected="true"]');
    var index = selected ? options.indexOf(selected) : -1;
    if (index < 0) {
      index = direction < 0 ? options.length - 1 : 0;
    }
    if (direction !== 0 && document.activeElement && options.indexOf(document.activeElement) >= 0) {
      index = options.indexOf(document.activeElement) + direction;
    }
    if (index < 0) index = options.length - 1;
    if (index >= options.length) index = 0;
    if (options[index].focus) options[index].focus();
  }

  function setExclusiveActive(items, activeItem, activeClass, attributeName) {
    items.forEach(function (item) {
      var active = item === activeItem;
      item.classList.toggle(activeClass, active);
      if (attributeName) {
        item.setAttribute(attributeName, active ? 'true' : 'false');
      }
      item.setAttribute('tabindex', active ? '0' : '-1');
    });
  }

  function activateTab(tab) {
    var group = tab && tab.closest ? tab.closest('[data-hfx-monitoring-tabs]') : null;
    if (!group) return;
    setExclusiveActive(group.querySelectorAll('[data-hfx-monitoring-tab]'), tab, 'is-active', 'aria-selected');
    var tabset = group.closest('[data-hfx-monitoring-tabset]');
    if (!tabset) return;
    var panelId = tab.getAttribute('aria-controls') || '';
    var panelKey = tab.getAttribute('data-hfx-monitoring-tab-key') || '';
    tabset.querySelectorAll('[data-hfx-monitoring-tab-panel]').forEach(function (panel) {
      var active = (panelId && panel.id === panelId) ||
        (!panelId && panelKey && panel.getAttribute('data-hfx-monitoring-tab-panel') === panelKey);
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function activateChip(chip) {
    var group = chip && chip.closest ? chip.closest('[data-hfx-monitoring-chips]') : null;
    if (!group) return;
    setExclusiveActive(group.querySelectorAll('[data-hfx-monitoring-chip]'), chip, 'is-active', 'aria-pressed');
    applyFilters(scopeFor(chip));
  }

  function activateAlertRow(row) {
    var queue = row && row.closest ? row.closest('[data-hfx-monitoring-alert-queue]') : null;
    if (!queue) return;
    setExclusiveActive(queue.querySelectorAll('[data-hfx-monitoring-alert-row]'), row, 'is-selected', 'aria-selected');
  }

  function moveExclusiveItem(item, groupSelector, itemSelector, event, activateItem) {
    if (!item || !event) return false;
    var group = item.closest(groupSelector);
    if (!group) return false;

    var items = Array.prototype.filter.call(group.querySelectorAll(itemSelector), function (candidate) {
      return !candidate.hidden;
    });
    if (!items.length) return false;

    var index = items.indexOf(item);
    if (index < 0) return false;

    var targetIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      targetIndex = (index + 1) % items.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      targetIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      targetIndex = 0;
    } else if (event.key === 'End') {
      targetIndex = items.length - 1;
    } else {
      return false;
    }

    var next = items[targetIndex];
    activateItem(next);
    if (next.focus) next.focus();
    event.preventDefault();
    return true;
  }

  function shouldIgnoreRowActivation(target) {
    return target && target.closest && target.closest('a, button, input, select, textarea');
  }

  function recordDrawerDetailsBody(drawer) {
    var body = drawer ? drawer.querySelector('.hfx-monitoring-record-drawer-details') : null;
    if (body) return body;
    var drawerBody = drawer ? drawer.querySelector('.hfx-monitoring-record-drawer-body') : null;
    if (!drawerBody && drawer) {
      drawerBody = document.createElement('div');
      drawerBody.className = 'hfx-monitoring-record-drawer-body';
      drawer.appendChild(drawerBody);
    }
    if (!drawerBody) return null;
    body = document.createElement('div');
    body.className = 'hfx-monitoring-record-drawer-details';
    var actions = drawerBody.querySelector('.hfx-monitoring-record-drawer-actions');
    drawerBody.insertBefore(body, actions || null);
    return body;
  }

  function appendRecordDrawerValue(body, labelText, valueNode, valueText, columnKey) {
    if (!body || !labelText) return;
    var item = document.createElement('div');
    item.className = 'hfx-monitoring-key-value';
    if (columnKey) item.setAttribute('data-hfx-monitoring-column-drawer', columnKey);
    var label = document.createElement('span');
    label.textContent = labelText;
    item.appendChild(label);
    if (valueNode) {
      if (valueNode.classList && valueNode.classList.contains('hfx-monitoring-record-tags')) {
        item.appendChild(valueNode.cloneNode(true));
      } else {
        var value = document.createElement('strong');
        Array.prototype.slice.call(valueNode.childNodes).forEach(function (node) {
          value.appendChild(node.cloneNode(true));
        });
        item.appendChild(value);
      }
    } else {
      var textValue = document.createElement('strong');
      textValue.textContent = valueText || '';
      item.appendChild(textValue);
    }
    body.appendChild(item);
  }

  function recordColumnLabel(explorer, key) {
    if (!explorer || !key) return '';
    var headers = explorer.querySelectorAll('.hfx-monitoring-record-table thead [data-hfx-monitoring-column-cell]');
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].getAttribute('data-hfx-monitoring-column-cell') === key) {
        return (headers[i].textContent || '').replace(/\s+/g, ' ').trim();
      }
    }
    return key;
  }

  function recordDrawerPanel(drawer, key) {
    return drawer && key ? drawer.querySelector('[data-hfx-monitoring-record-drawer-panel="' + key + '"]') : null;
  }

  function clearRecordDrawerPanel(panel) {
    if (!panel) return;
    clearElement(panel);
  }

  function appendRecordDrawerNote(panel, text) {
    if (!panel) return;
    var note = document.createElement('div');
    note.className = 'hfx-monitoring-record-drawer-note';
    note.textContent = text || '';
    panel.appendChild(note);
  }

  function appendRecordDrawerList(panel, items) {
    if (!panel) return;
    var list = document.createElement('div');
    list.className = 'hfx-monitoring-record-drawer-list';
    (items || []).forEach(function (item) {
      if (!item || !item.label || !item.value) return;
      appendRecordDrawerValue(list, item.label, null, item.value);
    });
    if (!list.childNodes.length) {
      appendRecordDrawerNote(panel, 'No scoped values available for this record');
      return;
    }
    panel.appendChild(list);
  }

  function fieldValue(fields, label) {
    label = (label || '').toLowerCase();
    for (var i = 0; i < fields.length; i++) {
      if ((fields[i].label || '').toLowerCase() === label) return fields[i].value || '';
    }
    return '';
  }

  function preferredRecordFields(fields, labels) {
    return (labels || []).map(function (label) {
      return { label: label, value: fieldValue(fields, label) };
    }).filter(function (item) { return !!item.value; });
  }

  function collectRecordDrawerFields(explorer, row, details) {
    var fields = [];
    if (explorer && row) {
      row.querySelectorAll('[data-hfx-monitoring-column-cell]').forEach(function (cell) {
        var key = cell.getAttribute('data-hfx-monitoring-column-cell') || '';
        var label = recordColumnLabel(explorer, key);
        var value = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        if (label && value) fields.push({ key: key, label: label, value: value, visible: !cell.hidden });
      });
    }
    if (details) {
      details.querySelectorAll('.hfx-monitoring-record-detail').forEach(function (detail) {
        var labelSource = detail.querySelector('span') || detail;
        var valueSource = detail.querySelector('strong') || detail.querySelector('.hfx-monitoring-record-tags') || detail;
        var label = (labelSource.textContent || '').replace(/\s+/g, ' ').trim();
        var value = (valueSource.textContent || '').replace(/\s+/g, ' ').trim();
        if (label && value) fields.push({ key: detail.getAttribute('data-hfx-monitoring-column-drawer') || '', label: label, value: value, visible: !detail.hidden });
      });
    }
    return fields;
  }

  function updateRecordDrawerSupplementalPanels(explorer, row, drawer, details) {
    if (!drawer || !row) return;
    var fields = collectRecordDrawerFields(explorer, row, details);
    var relations = recordDrawerPanel(drawer, 'relations');
    clearRecordDrawerPanel(relations);
    appendRecordDrawerList(relations, preferredRecordFields(fields, ['Primary Domain', 'IP Address', 'Owner', 'Services', 'Region', 'Environment']));

    var history = recordDrawerPanel(drawer, 'history');
    clearRecordDrawerPanel(history);
    appendRecordDrawerList(history, preferredRecordFields(fields, ['Inventory gathered', 'Inventory seen', 'Last Seen', 'Last Scan', 'Cert Expiry', 'Status', 'Uptime (%)', 'Agent Version']));

    var raw = recordDrawerPanel(drawer, 'raw');
    clearRecordDrawerPanel(raw);
    if (raw) {
      var pre = document.createElement('pre');
      pre.className = 'hfx-monitoring-record-drawer-raw';
      pre.textContent = fields.map(function (field) { return field.label + ': ' + field.value; }).join('\n');
      raw.appendChild(pre);
    }

    var exportFields = recordDrawerPanel(drawer, 'export-fields');
    clearRecordDrawerPanel(exportFields);
    appendRecordDrawerList(exportFields, fields.filter(function (field) { return field.visible; }).slice(0, 10));
  }

  function appendRecordDrawerColumnValues(explorer, row, body) {
    if (!explorer || !row || !body) return;
    var count = 0;
    row.querySelectorAll('[data-hfx-monitoring-column-cell]').forEach(function (cell) {
      if (count >= 10 || cell.hidden) return;
      var key = cell.getAttribute('data-hfx-monitoring-column-cell') || '';
      appendRecordDrawerValue(body, recordColumnLabel(explorer, key), cell, '', key);
      count++;
    });
  }

  function resetRecordDrawer(explorer) {
    var drawer = explorer ? explorer.querySelector('[data-hfx-monitoring-record-drawer]') : null;
    if (!drawer) return;
    var titleTarget = drawer.querySelector('.hfx-monitoring-record-drawer-head h3');
    if (titleTarget) titleTarget.textContent = 'No record selected';
    var body = recordDrawerDetailsBody(drawer);
    if (body) {
      clearElement(body);
      appendRecordDrawerValue(body, 'Current result', null, 'No rows match the current filters');
    }
    ['relations', 'history', 'export-fields'].forEach(function (key) {
      var panel = recordDrawerPanel(drawer, key);
      clearRecordDrawerPanel(panel);
      appendRecordDrawerNote(panel, 'No scoped values available for this record');
    });
    var raw = recordDrawerPanel(drawer, 'raw');
    clearRecordDrawerPanel(raw);
    if (raw) {
      var pre = document.createElement('pre');
      pre.className = 'hfx-monitoring-record-drawer-raw';
      pre.textContent = 'No record selected';
      raw.appendChild(pre);
    }
  }

  function setRecordDrawer(explorer, row, options) {
    var drawer = explorer ? explorer.querySelector('[data-hfx-monitoring-record-drawer]') : null;
    if (!drawer || !row) return;
    options = options || {};
    var titleCell = row.querySelector('td:nth-child(2), th:nth-child(2)');
    var title = titleCell ? (titleCell.textContent || '').replace(/\s+/g, ' ').trim() : '';
    var titleTarget = drawer.querySelector('.hfx-monitoring-record-drawer-head h3');
    if (titleTarget && title) titleTarget.textContent = title;

    var body = recordDrawerDetailsBody(drawer);
    var details = explorer.querySelector('[data-hfx-monitoring-record-details="' + row.getAttribute('data-hfx-monitoring-record-row') + '"]');
    if (body) {
      clearElement(body);
      appendRecordDrawerColumnValues(explorer, row, body);
    }
    if (body && details) {
      details.querySelectorAll('.hfx-monitoring-record-detail').forEach(function (detail) {
        var valueSource = detail.querySelector('strong');
        var tagsSource = detail.querySelector('.hfx-monitoring-record-tags');
        var drawerKey = detail.getAttribute('data-hfx-monitoring-column-drawer') || '';
        if (tagsSource) {
          appendRecordDrawerValue(body, (detail.querySelector('span') || detail).textContent || '', tagsSource, '', drawerKey);
        } else {
          appendRecordDrawerValue(body, (detail.querySelector('span') || detail).textContent || '', null, (valueSource || detail).textContent || '', drawerKey);
        }
      });
    }
    updateRecordDrawerSupplementalPanels(explorer, row, drawer, details);

    if (options.open !== false) {
      drawer.classList.remove('is-collapsed');
      explorer.classList.remove('is-drawer-collapsed');
    }
  }

  function activateRecordRow(row) {
    if (!row) return;
    var explorer = row.closest('[data-hfx-monitoring-record-explorer]');
    if (!explorer) return;
    var key = row.getAttribute('data-hfx-monitoring-record-row');
    explorer.querySelectorAll('[data-hfx-monitoring-record-row]').forEach(function (candidate) {
      candidate.classList.toggle('is-selected', candidate === row);
    });
    explorer.querySelectorAll('[data-hfx-monitoring-record-details]').forEach(function (details) {
      details.hidden = details.getAttribute('data-hfx-monitoring-record-details') !== key;
    });
    explorer.querySelectorAll('[data-hfx-monitoring-record-toggle]').forEach(function (button) {
      var active = button.getAttribute('data-hfx-monitoring-record-toggle') === key;
      button.setAttribute('aria-expanded', active ? 'true' : 'false');
      var rowTitle = '';
      var buttonRow = button.closest ? button.closest('[data-hfx-monitoring-record-row]') : null;
      var titleCell = buttonRow ? buttonRow.querySelector('td:nth-child(2), th:nth-child(2)') : null;
      if (titleCell) rowTitle = (titleCell.textContent || '').replace(/\s+/g, ' ').trim();
      if (rowTitle) button.setAttribute('aria-label', (active ? 'Collapse ' : 'Expand ') + rowTitle);
    });
    setRecordDrawer(explorer, row);
  }

  function syncRecordDetails(surface) {
    var explorer = surface && surface.closest ? surface.closest('[data-hfx-monitoring-record-explorer]') : null;
    var drawerScope = explorer || surface;
    if (!surface || !surface.querySelector('[data-hfx-monitoring-record-row]')) {
      if (drawerScope) resetRecordDrawer(drawerScope);
      return;
    }
    var selected = surface.querySelector('[data-hfx-monitoring-record-row].is-selected:not([hidden])');
    if (!selected) {
      selected = surface.querySelector('[data-hfx-monitoring-record-row]:not([hidden])');
      if (selected) activateRecordRow(selected);
    }

    if (!selected) {
      surface.querySelectorAll('[data-hfx-monitoring-record-details]').forEach(function (details) {
        details.hidden = true;
      });
      surface.querySelectorAll('[data-hfx-monitoring-record-row].is-selected').forEach(function (row) {
        row.classList.remove('is-selected');
      });
      resetRecordDrawer(drawerScope);
      return;
    }

    var selectedKey = selected.getAttribute('data-hfx-monitoring-record-row');
    surface.querySelectorAll('[data-hfx-monitoring-record-details]').forEach(function (details) {
      details.hidden = details.getAttribute('data-hfx-monitoring-record-details') !== selectedKey || selected.hidden;
    });
    if (explorer) setRecordDrawer(explorer, selected, { open: false });
  }

  function toggleRecordDrawer(button) {
    var drawer = button && button.closest ? button.closest('[data-hfx-monitoring-record-drawer]') : null;
    if (!drawer) return;
    var explorer = drawer.closest('[data-hfx-monitoring-record-explorer]');
    var collapsed = !drawer.classList.contains('is-collapsed');
    drawer.classList.toggle('is-collapsed', collapsed);
    if (explorer) explorer.classList.toggle('is-drawer-collapsed', collapsed);
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', collapsed ? 'Show selected record' : 'Collapse selected record');
  }

  function activateRecordDrawerTab(tab) {
    var tabList = tab && tab.closest ? tab.closest('.hfx-monitoring-record-drawer-tabs') : null;
    if (!tabList) return;
    var drawer = tabList.closest('[data-hfx-monitoring-record-drawer]');
    var key = tab.getAttribute('data-hfx-monitoring-record-drawer-tab') || '';
    tabList.querySelectorAll('[data-hfx-monitoring-record-drawer-tab]').forEach(function (candidate) {
      var active = candidate === tab;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (!drawer) return;
    drawer.querySelectorAll('[data-hfx-monitoring-record-drawer-panel]').forEach(function (panel) {
      var active = panel.getAttribute('data-hfx-monitoring-record-drawer-panel') === key;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function moveRecordDrawerTab(tab, event) {
    return moveExclusiveItem(
      tab,
      '.hfx-monitoring-record-drawer-tabs',
      '[data-hfx-monitoring-record-drawer-tab]',
      event,
      activateRecordDrawerTab);
  }

  function activateRelationshipNode(node) {
    var map = node && node.closest ? node.closest('[data-hfx-monitoring-relationship-map]') : null;
    if (!map) return;
    map.querySelectorAll('[data-hfx-monitoring-relationship-node]').forEach(function (candidate) {
      candidate.classList.toggle('is-selected', candidate === node);
    });
  }

  function activateCorrelationCell(cell) {
    var workspace = cell && cell.closest ? cell.closest('[data-hfx-monitoring-correlation-workspace]') : null;
    if (!workspace) return;
    workspace.querySelectorAll('[data-hfx-monitoring-correlation-cell]').forEach(function (candidate) {
      candidate.classList.toggle('is-selected', candidate === cell);
    });
  }

  function syncExportField(input) {
    var option = input && input.closest ? input.closest('.hfx-monitoring-field-option') : null;
    if (!option) return;
    option.classList.toggle('is-included', input.checked);
    var state = option.querySelector('em');
    if (state) state.textContent = input.checked ? 'Included' : 'Hidden';
    updateExportSummary(input.closest('[data-hfx-monitoring-export-composer]'));
  }

  function updateExportSummary(composer) {
    if (!composer) return;
    var included = composer.querySelectorAll('[data-hfx-monitoring-export-field]:checked').length;
    var total = composer.querySelectorAll('[data-hfx-monitoring-export-field]').length;
    var includedTarget = composer.querySelector('[data-hfx-monitoring-export-included-count]');
    var totalTarget = composer.querySelector('[data-hfx-monitoring-export-total-count]');
    if (includedTarget) includedTarget.textContent = String(included);
    if (totalTarget) totalTarget.textContent = String(total);
  }

  function activateSavedView(button) {
    var pane = button && button.closest ? button.closest('.hfx-monitoring-saved-views') : null;
    if (!pane) return;
    setExclusiveActive(pane.querySelectorAll('[data-hfx-monitoring-saved-view]'), button, 'is-active', 'aria-pressed');
    var title = savedViewTitle(button);
    if (title) syncSavedViewWorkspace(button, title);
  }

  function savedViewTitle(button) {
    if (!button) return '';
    var title = button.getAttribute('data-hfx-monitoring-saved-view') || '';
    if (!title) {
      var label = button.querySelector('span');
      title = label ? label.textContent : button.textContent;
    }
    return (title || '').replace(/\s+/g, ' ').trim();
  }

  function syncSavedViewWorkspace(button, title) {
    var scope = scopeFor(button);
    var match = null;
    scope.querySelectorAll('[data-hfx-monitoring-record-view]').forEach(function (view) {
      if (match) return;
      var viewTitle = (view.getAttribute('data-hfx-monitoring-record-view') || view.textContent || '').replace(/\s+/g, ' ').trim();
      if (viewTitle === title) match = view;
    });
    if (match) {
      setActiveRecordView(match);
      return;
    }
    scope.querySelectorAll('[data-hfx-monitoring-active-view-name]').forEach(function (label) {
      label.textContent = title;
    });
  }

  function removeFilterChip(button) {
    if (!button) return;
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
    var builder = button.closest('[data-hfx-monitoring-filter-builder]');
    if (builder) builder.setAttribute('data-hfx-monitoring-filter-count', String(visibleFilterChipCount(builder)));
  }

  function clearFilterChips(button) {
    var builder = button && button.closest ? button.closest('[data-hfx-monitoring-filter-builder]') : null;
    if (!builder) return;
    builder.querySelectorAll('[data-hfx-monitoring-filter-chip-remove]').forEach(function (chip) {
      chip.hidden = true;
      chip.setAttribute('aria-hidden', 'true');
    });
    builder.setAttribute('data-hfx-monitoring-filter-count', '0');
  }

  function visibleFilterChipCount(builder) {
    if (!builder) return 0;
    return Array.prototype.filter.call(builder.querySelectorAll('[data-hfx-monitoring-filter-chip-remove]'), function (chip) {
      return !chip.hidden;
    }).length;
  }

  function clearBulkSelection(button) {
    var bar = button && button.closest ? button.closest('[data-hfx-monitoring-bulk-actions]') : null;
    if (!bar) return;
    bar.classList.add('is-empty');
    bar.setAttribute('data-hfx-monitoring-bulk-selection', '0');
    var count = bar.querySelector('[data-hfx-monitoring-bulk-count]');
    if (count) count.textContent = '0';
    bar.querySelectorAll('.hfx-monitoring-bulk-action-list [data-hfx-monitoring-action]').forEach(function (action) {
      action.disabled = true;
    });
    button.disabled = true;
  }

  function childTreeRows(table, key) {
    if (!table || !key) return [];
    return Array.prototype.slice.call(table.querySelectorAll('[data-hfx-monitoring-tree-parent="' + key + '"]'));
  }

  function setTreeChildren(table, key, expanded, visited) {
    visited = visited || Object.create(null);
    if (visited[key]) return;
    visited[key] = true;
    childTreeRows(table, key).forEach(function (row) {
      row.hidden = !expanded;
      if (!expanded) {
        var childKey = row.getAttribute('data-hfx-monitoring-tree-row');
        var toggle = table.querySelector('[data-hfx-monitoring-tree-toggle="' + childKey + '"]');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        setTreeChildren(table, childKey, false, visited);
      }
    });
  }

  function treeAncestorsExpanded(table, row) {
    var parentKey = row && row.getAttribute ? row.getAttribute('data-hfx-monitoring-tree-parent') : '';
    var visited = Object.create(null);
    while (parentKey) {
      if (visited[parentKey]) return true;
      visited[parentKey] = true;
      var parentRow = table.querySelector('[data-hfx-monitoring-tree-row="' + parentKey + '"]');
      if (!parentRow) return true;
      var parentToggle = table.querySelector('[data-hfx-monitoring-tree-toggle="' + parentKey + '"]');
      if (parentToggle && parentToggle.getAttribute('aria-expanded') !== 'true') return false;
      parentKey = parentRow.getAttribute('data-hfx-monitoring-tree-parent') || '';
    }

    return true;
  }

  function applyTreeVisibility(surface) {
    if (!surface || !surface.querySelector('[data-hfx-monitoring-tree-row]')) return null;
    var visible = 0;
    surface.querySelectorAll('[data-hfx-monitoring-tree-row]').forEach(function (row) {
      var matched = row.getAttribute('data-hfx-monitoring-row-match') === 'true';
      var pageVisible = row.getAttribute('data-hfx-monitoring-row-page-visible') !== 'false';
      var treeVisible = matched && pageVisible && treeAncestorsExpanded(surface, row);
      row.hidden = !treeVisible;
      if (treeVisible) visible += 1;
    });

    return visible;
  }

  function toggleTreeRow(button) {
    var table = button && button.closest ? button.closest('table') : null;
    var key = button ? button.getAttribute('data-hfx-monitoring-tree-toggle') : '';
    if (!table || !key) return;
    var expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    var label = '';
    var row = button.closest ? button.closest('[data-hfx-monitoring-tree-row]') : null;
    var title = row ? row.querySelector('.hfx-monitoring-tree-name strong') : null;
    if (title) label = title.textContent || '';
    if (label) button.setAttribute('aria-label', (expanded ? 'Collapse ' : 'Expand ') + label);
    setTreeChildren(table, key, expanded);
    applyFilters(scopeFor(button));
  }

  function activateDensityOption(button) {
    var group = button && button.closest ? button.closest('[data-hfx-monitoring-density-switcher]') : null;
    if (!group) return;
    setExclusiveActive(group.querySelectorAll('[data-hfx-monitoring-density-option]'), button, 'is-active', 'aria-pressed');
    var key = button.getAttribute('data-hfx-monitoring-density-option') || '';
    var page = button.closest('[data-hfx-monitoring-page]');
    if (page) {
      page.setAttribute('data-hfx-monitoring-density', key);
    }
  }

  function applyInitialDensity(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-hfx-monitoring-density-switcher]').forEach(function (group) {
      var active = group.querySelector('[data-hfx-monitoring-density-option].is-active') ||
        group.querySelector('[data-hfx-monitoring-density-option]');
      if (active) activateDensityOption(active);
    });
  }

  function bind(root) {
    if (!root || root.__hfxMonitoringBound) return;
    root.__hfxMonitoringBound = true;

    root.addEventListener('click', function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-nav]')
        : null;
      if (!button || !root.contains(button)) return;
      var shell = button.closest('[data-hfx-monitoring-shell]');
      if (!shell) return;
      event.preventDefault();
      activate(shell, button.getAttribute('data-hfx-monitoring-nav'), {
        store: true,
        updateHash: true,
        scroll: true
      });
      closeSidebarDrawer(shell);
    });

    root.addEventListener('click', function (event) {
      var target = event.target;
      var tab = target && target.closest ? target.closest('[data-hfx-monitoring-tab]') : null;
      if (tab && root.contains(tab)) {
        event.preventDefault();
        activateTab(tab);
        return;
      }

      var chip = target && target.closest ? target.closest('[data-hfx-monitoring-chip]') : null;
      if (chip && root.contains(chip)) {
        event.preventDefault();
        activateChip(chip);
        return;
      }

      var sorter = target && target.closest ? target.closest('[data-hfx-monitoring-sort]') : null;
      if (sorter && root.contains(sorter)) {
        event.preventDefault();
        sortTable(sorter);
        return;
      }

      var pageButton = target && target.closest ? target.closest('[data-hfx-monitoring-page-button]') : null;
      if (pageButton && root.contains(pageButton) && activatePageButton(pageButton)) {
        event.preventDefault();
        return;
      }

      var recordDrawerToggle = target && target.closest ? target.closest('[data-hfx-monitoring-record-drawer-toggle]') : null;
      if (recordDrawerToggle && root.contains(recordDrawerToggle)) {
        event.preventDefault();
        toggleRecordDrawer(recordDrawerToggle);
        return;
      }

      var recordDrawerTab = target && target.closest ? target.closest('[data-hfx-monitoring-record-drawer-tab]') : null;
      if (recordDrawerTab && root.contains(recordDrawerTab)) {
        event.preventDefault();
        activateRecordDrawerTab(recordDrawerTab);
        return;
      }

      var recordToggle = target && target.closest ? target.closest('[data-hfx-monitoring-record-toggle]') : null;
      if (recordToggle && root.contains(recordToggle)) {
        event.preventDefault();
        activateRecordRow(recordToggle.closest('tr'));
        return;
      }

      var explorerRow = target && target.closest ? target.closest('[data-hfx-monitoring-record-row]') : null;
      if (explorerRow && root.contains(explorerRow) && !shouldIgnoreRowActivation(target)) {
        activateRecordRow(explorerRow);
        return;
      }

      var relationNode = target && target.closest ? target.closest('[data-hfx-monitoring-relationship-node]') : null;
      if (relationNode && root.contains(relationNode)) {
        event.preventDefault();
        activateRelationshipNode(relationNode);
        return;
      }

      var correlationCell = target && target.closest ? target.closest('[data-hfx-monitoring-correlation-cell]') : null;
      if (correlationCell && root.contains(correlationCell)) {
        event.preventDefault();
        activateCorrelationCell(correlationCell);
        return;
      }

      var treeToggle = target && target.closest ? target.closest('[data-hfx-monitoring-tree-toggle]') : null;
      if (treeToggle && root.contains(treeToggle)) {
        event.preventDefault();
        toggleTreeRow(treeToggle);
        return;
      }

      var densityOption = target && target.closest ? target.closest('[data-hfx-monitoring-density-option]') : null;
      if (densityOption && root.contains(densityOption)) {
        event.preventDefault();
        activateDensityOption(densityOption);
        return;
      }

      var columnGroup = target && target.closest ? target.closest('[data-hfx-monitoring-column-group]') : null;
      if (columnGroup && root.contains(columnGroup)) {
        event.preventDefault();
        activateColumnGroup(columnGroup);
        showActionToast(columnGroup);
        return;
      }

      var columnRail = target && target.closest ? target.closest('[data-hfx-monitoring-column-rail]') : null;
      if (columnRail && root.contains(columnRail)) {
        event.preventDefault();
        activateColumnRail(columnRail, event);
        return;
      }

      var savedView = target && target.closest ? target.closest('[data-hfx-monitoring-saved-view]') : null;
      if (savedView && root.contains(savedView)) {
        event.preventDefault();
        activateSavedView(savedView);
        showActionToast(savedView);
        return;
      }

      var filterRemove = target && target.closest ? target.closest('[data-hfx-monitoring-filter-chip-remove]') : null;
      if (filterRemove && root.contains(filterRemove)) {
        event.preventDefault();
        removeFilterChip(filterRemove);
        showActionToast(filterRemove);
        return;
      }

      var filterClear = target && target.closest ? target.closest('[data-hfx-monitoring-filter-clear]') : null;
      if (filterClear && root.contains(filterClear)) {
        event.preventDefault();
        clearFilterChips(filterClear);
        showActionToast(filterClear);
        return;
      }

      var bulkClear = target && target.closest ? target.closest('[data-hfx-monitoring-bulk-clear]') : null;
      if (bulkClear && root.contains(bulkClear)) {
        event.preventDefault();
        clearBulkSelection(bulkClear);
        showActionToast(bulkClear);
        return;
      }

      var commandSelectOption = target && target.closest ? target.closest('[data-hfx-monitoring-command-select-option]') : null;
      if (commandSelectOption && root.contains(commandSelectOption)) {
        event.preventDefault();
        chooseCommandSelectOption(commandSelectOption);
        return;
      }

      var commandSelect = target && target.closest ? target.closest('[data-hfx-monitoring-command-select]') : null;
      if (commandSelect && root.contains(commandSelect)) {
        event.preventDefault();
        toggleCommandSelect(commandSelect);
        return;
      }

      closeCommandSelects(root, null);

      var sidebarDrawerToggle = target && target.closest ? target.closest('[data-hfx-monitoring-sidebar-drawer-toggle]') : null;
      if (sidebarDrawerToggle && root.contains(sidebarDrawerToggle)) {
        event.preventDefault();
        toggleSidebarDrawer(sidebarDrawerToggle.closest('[data-hfx-monitoring-shell]'));
        return;
      }

      var sidebarDrawerClose = target && target.closest ? target.closest('[data-hfx-monitoring-sidebar-drawer-close]') : null;
      if (sidebarDrawerClose && root.contains(sidebarDrawerClose)) {
        event.preventDefault();
        closeSidebarDrawer(sidebarDrawerClose.closest('[data-hfx-monitoring-shell]'));
        return;
      }

      var sidebarToggle = target && target.closest ? target.closest('[data-hfx-monitoring-sidebar-toggle]') : null;
      if (sidebarToggle && root.contains(sidebarToggle)) {
        event.preventDefault();
        toggleSidebar(sidebarToggle.closest('[data-hfx-monitoring-shell]'));
        return;
      }

      var navSearchWrap = target && target.closest ? target.closest('[data-hfx-monitoring-nav-search-wrap]') : null;
      if (navSearchWrap && root.contains(navSearchWrap)) {
        var navSearchShell = navSearchWrap.closest('[data-hfx-monitoring-shell]');
        if (navSearchShell && navSearchShell.classList.contains('is-sidebar-collapsed')) {
          setSidebarCollapsed(navSearchShell, false, { store: true });
          var searchInput = navSearchShell.querySelector('[data-hfx-monitoring-nav-search]');
          if (searchInput && searchInput.focus) searchInput.focus();
        }
      }

      var drilldownAction = target && target.closest ? target.closest('[data-hfx-monitoring-drilldown-action]') : null;
      if (drilldownAction && root.contains(drilldownAction)) {
        var href = drilldownAction.getAttribute('href') || '#';
        if (href === '#' || href.indexOf('#') === 0) {
          event.preventDefault();
          openDrilldown(drilldownAction);
          return;
        }
      }

      var closeDrilldownButton = target && target.closest ? target.closest('[data-hfx-monitoring-drilldown-close]') : null;
      if (closeDrilldownButton && root.contains(closeDrilldownButton)) {
        event.preventDefault();
        closeDrilldown(closeDrilldownButton.closest('[data-hfx-monitoring-drilldown]'));
        return;
      }

      var toastClose = target && target.closest ? target.closest('[data-hfx-monitoring-toast-close]') : null;
      if (toastClose && root.contains(toastClose)) {
        event.preventDefault();
        var toast = toastClose.closest('.hfx-monitoring-toast');
        if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
        return;
      }

      var recordPopoverClose = target && target.closest ? target.closest('[data-hfx-monitoring-record-popover-close]') : null;
      if (recordPopoverClose && root.contains(recordPopoverClose)) {
        event.preventDefault();
        closeRecordPopovers(recordPopoverClose.closest('[data-hfx-monitoring-record-explorer]'));
        return;
      }

      var columnPickerToggle = target && target.closest ? target.closest('[data-hfx-monitoring-column-picker-toggle]') : null;
      if (columnPickerToggle && root.contains(columnPickerToggle)) {
        event.preventDefault();
        toggleRecordPopover(columnPickerToggle, '[data-hfx-monitoring-column-picker]');
        return;
      }

      var viewSaveToggle = target && target.closest ? target.closest('[data-hfx-monitoring-view-save-toggle]') : null;
      if (viewSaveToggle && root.contains(viewSaveToggle)) {
        event.preventDefault();
        toggleRecordPopover(viewSaveToggle, '[data-hfx-monitoring-view-save]');
        return;
      }

      var columnPreset = target && target.closest ? target.closest('[data-hfx-monitoring-column-picker-select]') : null;
      if (columnPreset && root.contains(columnPreset)) {
        event.preventDefault();
        selectColumnPreset(columnPreset);
        showActionToast(columnPreset);
        return;
      }

      var viewCreate = target && target.closest ? target.closest('[data-hfx-monitoring-view-create]') : null;
      if (viewCreate && root.contains(viewCreate)) {
        event.preventDefault();
        createRecordView(viewCreate);
        showActionToast(viewCreate);
        return;
      }

      var recordView = target && target.closest ? target.closest('[data-hfx-monitoring-record-view]') : null;
      if (recordView && root.contains(recordView)) {
        event.preventDefault();
        setActiveRecordView(recordView);
        showActionToast(recordView);
        return;
      }

      var localAction = target && target.closest ? target.closest('[data-hfx-monitoring-action]') : null;
      if (localAction && root.contains(localAction)) {
        var actionHref = localAction.getAttribute('href') || '#';
        if (actionHref === '#' || actionHref.indexOf('#') === 0) {
          event.preventDefault();
          if (localAction.hasAttribute('data-hfx-monitoring-focus-nav-search')) {
            var actionShell = localAction.closest('[data-hfx-monitoring-shell]');
            if (!actionShell) return;
            setSidebarDrawerOpen(actionShell, true);
            var navSearchInput = actionShell.querySelector('[data-hfx-monitoring-nav-search]');
            if (navSearchInput && navSearchInput.focus) {
              navSearchInput.focus();
              return;
            }
          }
          togglePressedAction(localAction);
          showActionToast(localAction);
          return;
        }
      }

      var row = target && target.closest ? target.closest('[data-hfx-monitoring-alert-row]') : null;
      if (row && root.contains(row) && !shouldIgnoreRowActivation(target)) {
        activateAlertRow(row);
      }
    });

    root.addEventListener('pointerdown', function (event) {
      var target = event.target;
      var columnRail = target && target.closest ? target.closest('[data-hfx-monitoring-column-rail]') : null;
      if (!columnRail || !root.contains(columnRail)) return;
      event.preventDefault();
      beginColumnRailDrag(columnRail, event);
    });

    root.addEventListener('pointermove', function (event) {
      if (!activeColumnRail || !root.contains(activeColumnRail)) return;
      updateColumnRailDrag(event);
    });

    root.addEventListener('pointerup', endColumnRailDrag);
    root.addEventListener('pointercancel', endColumnRailDrag);

    root.addEventListener('keydown', function (event) {
      var openDrawerShell = root.querySelector('[data-hfx-monitoring-shell].is-sidebar-drawer-open');
      if (openDrawerShell && event.key === 'Escape') {
        closeSidebarDrawer(openDrawerShell);
        event.preventDefault();
        return;
      }

      var openOverlay = root.querySelector('[data-hfx-monitoring-drilldown].is-open');
      if (openOverlay && event.key === 'Escape') {
        closeDrilldown(openOverlay);
        event.preventDefault();
        return;
      }

      if (event.key === 'Escape') {
        var recordPopover = event.target && event.target.closest
          ? event.target.closest('[data-hfx-monitoring-column-picker], [data-hfx-monitoring-view-save]')
          : null;
        if (recordPopover && root.contains(recordPopover)) {
          closeRecordPopovers(recordPopover.closest('[data-hfx-monitoring-record-explorer]'));
          event.preventDefault();
          return;
        }
        closeCommandSelects(root, null);
      }

      var commandOption = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-command-select-option]')
        : null;
      if (commandOption && root.contains(commandOption)) {
        var optionWrap = commandOption.closest('.hfx-monitoring-command-select-wrap');
        var optionButton = optionWrap ? optionWrap.querySelector('[data-hfx-monitoring-command-select]') : null;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chooseCommandSelectOption(commandOption);
          if (optionButton && optionButton.focus) optionButton.focus();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCommandSelects(root, null);
          if (optionButton && optionButton.focus) optionButton.focus();
          return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          focusCommandSelectOption(optionButton, event.key === 'ArrowDown' ? 1 : -1);
          return;
        }
      }

      var commandButton = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-command-select]')
        : null;
      if (commandButton && root.contains(commandButton)) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          var wasExpanded = commandButton.getAttribute('aria-expanded') === 'true';
          if (!wasExpanded) {
            toggleCommandSelect(commandButton);
          }
          focusCommandSelectOption(commandButton, event.key === 'ArrowUp' ? -1 : 1);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCommandSelects(root, null);
          return;
        }
      }

      if (openOverlay && event.key === 'Tab') {
        trapDrilldownFocus(openOverlay, event);
        return;
      }

      var navSearch = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-nav-search]')
        : null;
      if (navSearch && root.contains(navSearch)) {
        var shell = navSearch.closest('[data-hfx-monitoring-shell]');
        if (!shell) return;

        if (event.key === 'Escape') {
          navSearch.value = '';
          applyNavSearch(shell);
          event.preventDefault();
          return;
        }

        if (event.key === 'Enter') {
          var item = firstVisibleNavItem(shell);
          if (item) {
            activate(shell, item.getAttribute('data-hfx-monitoring-nav'), {
              store: true,
              updateHash: true
            });
            item.focus();
          }
          event.preventDefault();
          return;
        }
      }

      var target = event.target;
      var tab = target && target.closest ? target.closest('[data-hfx-monitoring-tab]') : null;
      if (tab && root.contains(tab) && moveExclusiveItem(tab, '[data-hfx-monitoring-tabs]', '[data-hfx-monitoring-tab]', event, activateTab)) {
        return;
      }

      var recordDrawerTab = target && target.closest ? target.closest('[data-hfx-monitoring-record-drawer-tab]') : null;
      if (recordDrawerTab && root.contains(recordDrawerTab) && moveRecordDrawerTab(recordDrawerTab, event)) {
        return;
      }

      var chip = target && target.closest ? target.closest('[data-hfx-monitoring-chip]') : null;
      if (chip && root.contains(chip) && moveExclusiveItem(chip, '[data-hfx-monitoring-chips]', '[data-hfx-monitoring-chip]', event, activateChip)) {
        return;
      }

      var columnGroup = target && target.closest ? target.closest('[data-hfx-monitoring-column-group]') : null;
      if (columnGroup && root.contains(columnGroup) && moveExclusiveItem(columnGroup, '.hfx-monitoring-column-groups', '[data-hfx-monitoring-column-group]', event, activateColumnGroup)) {
        return;
      }

      var savedView = target && target.closest ? target.closest('[data-hfx-monitoring-saved-view]') : null;
      if (savedView && root.contains(savedView) && moveExclusiveItem(savedView, '.hfx-monitoring-saved-views', '[data-hfx-monitoring-saved-view]', event, activateSavedView)) {
        return;
      }

      var densityOption = target && target.closest ? target.closest('[data-hfx-monitoring-density-option]') : null;
      if (densityOption && root.contains(densityOption) && moveExclusiveItem(densityOption, '[data-hfx-monitoring-density-switcher]', '[data-hfx-monitoring-density-option]', event, activateDensityOption)) {
        return;
      }

      var columnRail = target && target.closest ? target.closest('[data-hfx-monitoring-column-rail]') : null;
      if (columnRail && root.contains(columnRail)) {
        var railScroller = tableScrollerForRail(columnRail);
        if (!railScroller) return;
        var maxScroll = Math.max(0, railScroller.scrollWidth - railScroller.clientWidth);
        if (event.key === 'Home') {
          event.preventDefault();
          scrollColumnRail(columnRail, 0);
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          scrollColumnRail(columnRail, 1);
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault();
          var direction = event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : 1;
          var step = event.key === 'PageUp' || event.key === 'PageDown' ? railScroller.clientWidth * .8 : 80;
          railScroller.scrollLeft = Math.max(0, Math.min(maxScroll, railScroller.scrollLeft + direction * step));
          syncColumnRail(columnRail);
          return;
        }
      }

      var viewNameInput = target && target.closest ? target.closest('[data-hfx-monitoring-view-name-input]') : null;
      if (viewNameInput && root.contains(viewNameInput) && event.key === 'Enter') {
        var viewPanel = viewNameInput.closest('[data-hfx-monitoring-view-save]');
        var createButton = viewPanel ? viewPanel.querySelector('[data-hfx-monitoring-view-create]') : null;
        if (createButton) {
          event.preventDefault();
          createRecordView(createButton);
          showActionToast(createButton);
          return;
        }
      }

      var navigableRow = target && target.closest ? target.closest('[data-hfx-monitoring-alert-row]') : null;
      if (navigableRow && root.contains(navigableRow) && !shouldIgnoreRowActivation(target) && moveExclusiveItem(navigableRow, '[data-hfx-monitoring-alert-queue]', '[data-hfx-monitoring-alert-row]', event, activateAlertRow)) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') return;
      var row = target && target.closest ? target.closest('[data-hfx-monitoring-alert-row]') : null;
      if (!row || !root.contains(row) || shouldIgnoreRowActivation(target)) return;
      event.preventDefault();
      activateAlertRow(row);
    });

    root.addEventListener('input', function (event) {
      var navSearch = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-nav-search]')
        : null;
      if (navSearch && root.contains(navSearch)) {
        applyNavSearch(navSearch.closest('[data-hfx-monitoring-shell]'));
        return;
      }

      var exportField = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-export-field]')
        : null;
      if (exportField && root.contains(exportField)) {
        syncExportField(exportField);
        return;
      }

      var columnOption = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-column-option]')
        : null;
      if (columnOption && root.contains(columnOption)) {
        activateColumnOption(columnOption);
        return;
      }

      var input = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-search]')
        : null;
      if (!input || !root.contains(input)) return;
      applyFilters(scopeFor(input));
    });

    root.addEventListener('search', function (event) {
      var navSearch = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-nav-search]')
        : null;
      if (navSearch && root.contains(navSearch)) {
        applyNavSearch(navSearch.closest('[data-hfx-monitoring-shell]'));
        return;
      }

      var input = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-search]')
        : null;
      if (!input || !root.contains(input)) return;
      applyFilters(scopeFor(input));
    });

    root.addEventListener('scroll', function (event) {
      var scroller = event.target && event.target.classList && event.target.classList.contains('hfx-monitoring-table-wrap')
        ? event.target
        : null;
      if (!scroller || !root.contains(scroller)) return;
      var block = scroller.closest ? scroller.closest('.hfx-monitoring-record-table-block') : null;
      var rail = block ? block.querySelector('[data-hfx-monitoring-column-rail]') : null;
      if (rail) syncColumnRail(rail);
    }, true);
  }

  function init() {
    bind(document);
    document.querySelectorAll('[data-hfx-monitoring-shell]').forEach(function (shell) {
      setSidebarCollapsed(shell, readSidebarCollapsed(shell), { store: false });
      setSidebarDrawerOpen(shell, false, { focus: false });
      var active = shell.querySelector('[data-hfx-monitoring-nav].is-active') ||
        shell.querySelector('[data-hfx-monitoring-nav]');
      if (active) {
        var fromHash = pageFromHash(shell);
        var key = fromHash || preferredPage(shell, active.getAttribute('data-hfx-monitoring-nav'));
        activate(shell, key, {
          store: true,
          updateHash: false
        });
        replaceHistoryPage(shell, key, shouldReplaceInitialHash(shell, fromHash));
      }
      applyInitialSearch(shell);
      applyNavSearch(shell);
    });
    applyInitialDensity(document);
    applyInitialColumnGroups(document);
    document.querySelectorAll('[data-hfx-monitoring-page].is-active').forEach(applyFilters);
    document.querySelectorAll('[data-hfx-monitoring-record-explorer]').forEach(updateColumnPickerSummary);
    syncColumnRail(document);
    document.querySelectorAll('[data-hfx-monitoring-export-field]').forEach(syncExportField);
    document.querySelectorAll('[data-hfx-monitoring-export-composer]').forEach(updateExportSummary);
  }

  window.addEventListener('popstate', function (event) {
    document.querySelectorAll('[data-hfx-monitoring-shell]').forEach(function (shell) {
      var key = event.state && event.state.hfxMonitoringPage && event.state.hfxMonitoringStateId === stateId(shell) && hasPage(shell, event.state.hfxMonitoringPage)
        ? event.state.hfxMonitoringPage
        : pageFromHash(shell);
      if (key) activate(shell, key, { store: false, updateHash: false });
    });
  });

  window.addEventListener('hashchange', function () {
    document.querySelectorAll('[data-hfx-monitoring-shell]').forEach(function (shell) {
      var key = pageFromHash(shell);
      if (key) activate(shell, key, { store: true, updateHash: false });
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HtmlForgeX = window.HtmlForgeX || {};
  window.HtmlForgeX.monitoringSurface = {
    init: init,
    activate: function (shellOrSelector, key) {
      var shell = typeof shellOrSelector === 'string'
        ? document.querySelector(shellOrSelector)
        : shellOrSelector;
      activate(shell, key, { store: true, updateHash: true });
    }
  };
})();
