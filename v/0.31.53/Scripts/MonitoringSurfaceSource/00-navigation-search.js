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
    refreshMonitoringScope(activePage);
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
    if (owner && owner !== element) {
      target = (owner.getAttribute('data-hfx-monitoring-target') || '').trim();
      if (target) return target;
    }
    var page = element.closest ? element.closest('[data-hfx-monitoring-page]') : null;
    return page ? (page.getAttribute('data-hfx-monitoring-page') || '').trim() : '';
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

  function resetPagedSearchSurfaces(scope, control) {
    if (!scope) return;
    scope.querySelectorAll('[data-hfx-monitoring-search-table], [data-hfx-monitoring-search-surface]').forEach(function (surface) {
      if (surfaceAcceptsControl(surface, control) && pageSizeFor(surface)) {
        setCurrentPage(surface, 1);
      }
    });
  }
