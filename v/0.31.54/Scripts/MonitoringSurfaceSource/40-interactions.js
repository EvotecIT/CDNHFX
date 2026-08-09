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

      var commandAction = target && target.closest ? target.closest('[data-hfx-monitoring-command-action]') : null;
      if (commandAction && root.contains(commandAction)) {
        event.preventDefault();
        commandAction.dispatchEvent(new CustomEvent('hfx:monitoring-command', {
          bubbles: true,
          detail: {
            action: commandAction.getAttribute('data-hfx-monitoring-command-action')
          }
        }));
        return;
      }

      var commandToggle = target && target.closest ? target.closest('[data-hfx-monitoring-command-toggle]') : null;
      if (commandToggle && root.contains(commandToggle)) {
        event.preventDefault();
        togglePressedAction(commandToggle);
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

      var columnFilter = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-column-filter]')
        : null;
      if (columnFilter && root.contains(columnFilter)) {
        resetPagedSearchSurfaces(scopeFor(columnFilter), columnFilter);
        applyFilters(scopeFor(columnFilter));
        return;
      }

      var input = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-search]')
        : null;
      if (!input || !root.contains(input)) return;
      resetPagedSearchSurfaces(scopeFor(input), input);
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

      var columnFilter = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-column-filter]')
        : null;
      if (columnFilter && root.contains(columnFilter)) {
        resetPagedSearchSurfaces(scopeFor(columnFilter), columnFilter);
        applyFilters(scopeFor(columnFilter));
        return;
      }

      var input = event.target && event.target.closest
        ? event.target.closest('[data-hfx-monitoring-search]')
        : null;
      if (!input || !root.contains(input)) return;
      resetPagedSearchSurfaces(scopeFor(input), input);
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
