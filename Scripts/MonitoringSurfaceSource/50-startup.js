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
