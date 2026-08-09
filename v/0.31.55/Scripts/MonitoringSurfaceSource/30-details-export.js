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
