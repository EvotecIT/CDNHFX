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
    var activePanel = null;
    tabset.querySelectorAll('[data-hfx-monitoring-tab-panel]').forEach(function (panel) {
      var active = (panelId && panel.id === panelId) ||
        (!panelId && panelKey && panel.getAttribute('data-hfx-monitoring-tab-panel') === panelKey);
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
      if (active) activePanel = panel;
    });
    refreshMonitoringTabPanel(activePanel);
  }

  function refreshMonitoringTabPanel(panel) {
    refreshMonitoringScope(panel);
  }

  function refreshMonitoringScope(scope) {
    if (!scope) return;
    setTimeout(function () {
      try {
        if (window.htmlForgeXRefreshVisible && typeof window.htmlForgeXRefreshVisible === 'function') {
          window.htmlForgeXRefreshVisible(scope);
        }
      } catch (_) { }
      try {
        var $ = window.jQuery || window.$;
        if (!$ || !$.fn || !$.fn.DataTable) return;
        initializeLazyMonitoringDataTables(scope, $);
        $(scope).find('table.dataTable, table.dt-table').each(function () {
          try {
            if ($.fn.dataTable && $.fn.dataTable.isDataTable && !$.fn.dataTable.isDataTable(this)) return;
          } catch (_) { }
          var api = $(this).DataTable();
          if (api && api.columns && api.columns.adjust) api.columns.adjust();
          if (api && api.responsive && api.responsive.recalc) api.responsive.recalc();
        });
      } catch (_) { }
    }, 40);
  }

  function initializeLazyMonitoringDataTables(panel, $) {
    if (!panel || !$) return;
    var registry = window.hfxDataTablesLazyInit;
    if (!registry) return;
    $(panel).find('table[id]').each(function () {
      try {
        if ($.fn.dataTable && $.fn.dataTable.isDataTable && $.fn.dataTable.isDataTable(this)) return;
      } catch (_) { }
      var initializer = registry[this.id];
      if (typeof initializer === 'function') {
        try { initializer(); } catch (_) { }
      }
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
