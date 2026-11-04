  function revealRecordExplorerTabs(explorer) {
    var panels = [];
    var cursor = explorer;
    while (cursor && cursor.closest) {
      var panel = cursor.closest('[data-hfx-monitoring-tab-panel]');
      if (!panel) break;
      panels.unshift(panel);
      cursor = panel.parentElement;
    }
    panels.forEach(function (panel) {
      if (!panel.hidden) return;
      var tabset = panel.closest('[data-hfx-monitoring-tabset]');
      var tabs = tabset ? tabset.querySelector('[data-hfx-monitoring-tabs]') : null;
      var labelledBy = panel.getAttribute('aria-labelledby');
      var tab = tabs && labelledBy ? Array.prototype.find.call(tabs.querySelectorAll('[data-hfx-monitoring-tab]'), function (candidate) {
        return candidate.id === labelledBy;
      }) : null;
      if (tab) activateTab(tab);
    });
  }

  function activateCorrelationCell(cell, options) {
    var workspace = cell && cell.closest ? cell.closest('[data-hfx-monitoring-correlation-workspace]') : null;
    if (!workspace) return;
    workspace.querySelectorAll('[data-hfx-monitoring-correlation-cell]').forEach(function (candidate) {
      candidate.classList.toggle('is-selected', candidate === cell);
    });
    var recordKey = cell.getAttribute('data-hfx-monitoring-related-record-key');
    if (!recordKey) return;
    var scope = workspace.closest('[data-hfx-monitoring-page]') ||
      workspace.closest('[data-hfx-monitoring-shell]') || document;
    activateRelatedRecord(scope, recordKey, options);
  }

  function activateRecordLink(link, options) {
    var scope = link && link.closest ? link.closest('[data-hfx-monitoring-page]') ||
      link.closest('[data-hfx-monitoring-shell]') || document : null;
    if (!scope) return;
    activateRelatedRecord(scope, link.getAttribute('data-hfx-monitoring-record-link'), options);
  }

  function activateRelatedRecord(scope, recordKey, options) {
    if (!recordKey) return;
    var matchingExplorer = null;
    var matchingRow = null;
    var matchingTable = null;
    var matchingRenderedKey = '';
    var matchCount = 0;
    var normalizedRecordKey = recordKey.toLowerCase();
    scope.querySelectorAll('[data-hfx-monitoring-record-explorer]').forEach(function (explorer) {
      var rows = Array.prototype.filter.call(explorer.querySelectorAll('[data-hfx-monitoring-record-row]'), function (candidate) {
        return (candidate.getAttribute('data-hfx-monitoring-record-source-key') ||
          candidate.getAttribute('data-hfx-monitoring-record-row') || '').toLowerCase() === normalizedRecordKey;
      });
      var row = rows.length ? rows[0] : null;
      var table = null;
      var deferredCount = 0;
      var hasDeferredData = false;
      explorer.querySelectorAll('[data-hfx-monitoring-deferred-records]').forEach(function (candidate) {
        var data = deferredRecordData(candidate);
        if (!data) return;
        hasDeferredData = true;
        var matches = (data.Records || data.records || []).filter(function (record) {
          return (record.SourceKey || record.sourceKey || record.Key || record.key || '').toLowerCase() === normalizedRecordKey;
        });
        deferredCount += matches.length;
        if (matches.length && !table) {
          table = candidate;
          matchingRenderedKey = matches[0].Key || matches[0].key || '';
        }
      });
      var recordMatches = hasDeferredData ? deferredCount : rows.length;
      if (!recordMatches) return;
      matchCount += recordMatches;
      matchingExplorer = explorer;
      matchingRow = row;
      matchingTable = table;
    });
    if (matchCount !== 1) return;
    revealRecordExplorerTabs(matchingExplorer);
    if (matchingTable) matchingRow = revealDeferredRecord(matchingTable, matchingRenderedKey);
    if (!matchingRow) return;
    activateRecordRow(matchingRow, { focusDrawer: !!(options && options.focusDrawer), forceOpen: true });
    var drawer = matchingExplorer ? matchingExplorer.querySelector('[data-hfx-monitoring-record-drawer]') : null;
    if (drawer && drawer.scrollIntoView) drawer.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
