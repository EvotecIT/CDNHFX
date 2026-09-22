(function () {
  'use strict';

  function getCssVar(name, scope) {
    try {
      if (scope && scope.nodeType === 1) {
        var scoped = getComputedStyle(scope).getPropertyValue(name);
        scoped = (scoped == null) ? '' : String(scoped).trim();
        if (scoped) return scoped;

        var workspace = scope.closest ? scope.closest('[data-hfx-operational-workspace], [data-hfx-surface]') : null;
        if (workspace) {
          scoped = getComputedStyle(workspace).getPropertyValue(name);
          scoped = (scoped == null) ? '' : String(scoped).trim();
          if (scoped) return scoped;
        }
      }

      // Prefer :root but fall back to <body> because some themes apply tokens there.
      var root = document && document.documentElement ? document.documentElement : null;
      var v = root ? getComputedStyle(root).getPropertyValue(name) : '';
      v = (v == null) ? '' : String(v).trim();
      if (!v) {
        var body = document && document.body ? document.body : null;
        v = body ? getComputedStyle(body).getPropertyValue(name) : '';
        v = (v == null) ? '' : String(v).trim();
      }
      return v || '';
    } catch (e) {
      return '';
    }
  }

  function getRootAttr(name) {
    try {
      var root = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute(name)
        : null;
      if (root) return root;
    } catch (_e1) { }
    try {
      var body = document && document.body && document.body.getAttribute
        ? document.body.getAttribute(name)
        : null;
      if (body) return body;
    } catch (_e2) { }
    return null;
  }

  function getA11yFlags() {
    var v = getRootAttr('data-hfx-a11y');
    if (!v) return { colorBlind: false, highContrast: false };
    var tokens = String(v).toLowerCase().split(/\s+/);
    return {
      colorBlind: tokens.indexOf('color-blind') >= 0,
      highContrast: tokens.indexOf('high-contrast') >= 0
    };
  }

  function getPalette(scope) {
    var accentRgb = getCssVar('--hfx-surface-accent-rgb', scope) || getCssVar('--hfx-op-accent-rgb', scope);
    var accent = accentRgb ? ('rgb(' + accentRgb + ')') : '';
    var p1 = getCssVar('--hfx-palette-1', scope);
    var p2 = getCssVar('--hfx-palette-2', scope);
    var p3 = getCssVar('--hfx-palette-3', scope);
    var p4 = getCssVar('--hfx-palette-4', scope);
    var p5 = getCssVar('--hfx-palette-5', scope);
    var p6 = getCssVar('--hfx-palette-6', scope);
    var p7 = getCssVar('--hfx-palette-7', scope);
    var list = [p1, p2, p3, p4, p5, p6, p7].filter(function (c) { return !!c; });
    if (accent) list.unshift(accent);
    if (list.length > 0) return list;
    if (accent) return [accent, '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
    return ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#f0e442', '#56b4e9'];
  }

  function snapshotColors(chart) {
    try {
      if (chart && chart.w && chart.w.config && chart.w.config.colors) return chart.w.config.colors.slice();
    } catch (_e1) { }
    try {
      if (chart && chart.opts && chart.opts.colors) return chart.opts.colors.slice();
    } catch (_e2) { }
    return null;
  }

  function getTheme(scope) {
    try {
      var workspace = scope && scope.closest ? scope.closest('[data-hfx-operational-workspace]') : null;
      if (workspace) {
        var preset = workspace.getAttribute('data-hfx-operational-preset');
        if (preset === 'dark' || workspace.classList.contains('hfx-operational-workspace--dark')) return 'dark';
        return 'light';
      }
    } catch (_ws) { }

    try {
      var t = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-bs-theme')
        : null;
      if (t === 'dark' || t === 'light') return t;
    } catch (e1) { /* ignore */ }

    try {
      var b = document && document.body && document.body.getAttribute ? document.body.getAttribute('data-bs-theme') : null;
      if (b === 'dark' || b === 'light') return b;
    } catch (e2) { /* ignore */ }

    return 'light';
  }

  function resolveChartElement(chart) {
    try { if (chart && chart.__hfxElement) return chart.__hfxElement; } catch (_e0) { }
    try { if (chart && chart.el) return chart.el; } catch (_e1) { }
    try { if (chart && chart.w && chart.w.globals && chart.w.globals.dom && chart.w.globals.dom.baseEl) return chart.w.globals.dom.baseEl; } catch (_e2) { }
    return null;
  }

  function resolveForeColor(scope) {
    return getCssVar('--hfx-op-dashboard-text', scope)
      || getCssVar('--hfx-op-text', scope)
      || getCssVar('--hfx-card-body-color', scope)
      || getCssVar('--tblr-body-color', scope)
      || getCssVar('--bs-body-color', scope)
      || '#212529';
  }

  function resolveSurfaceBg(scope) {
    return getCssVar('--hfx-op-dashboard-card-bg', scope)
      || getCssVar('--hfx-surface-card-bg', scope)
      || getCssVar('--tblr-bg-surface', scope)
      || getCssVar('--tblr-card-bg', scope)
      || getCssVar('--tblr-body-bg', scope)
      || getCssVar('--bs-body-bg', scope)
      || '';
  }

  function resolveBorderColor(scope) {
    return getCssVar('--hfx-surface-border', scope)
      || getCssVar('--tblr-border-color', scope)
      || getCssVar('--bs-border-color', scope)
      || '';
  }

  function updateChart(chart) {
    if (!chart) return;

    try {
      if (chart.__hfxThemeManaged !== true) return;
    } catch (_m) {
      return;
    }

    var scope = resolveChartElement(chart);
    var theme = getTheme(scope);
    var foreColor = resolveForeColor(scope);
    var opts = {
      theme: { mode: theme },
      chart: { foreColor: foreColor },
      tooltip: { theme: theme }
    };

    opts.chart.background = 'transparent';

    var bc = resolveBorderColor(scope);
    if (bc) opts.grid = { borderColor: bc };

    try {
      var a11y = getA11yFlags();
      if (a11y.colorBlind) {
        if (!chart.__hfxA11yOrigColors) chart.__hfxA11yOrigColors = snapshotColors(chart);
        opts.colors = getPalette(scope);
      } else if (chart.__hfxThemeAutoColors === true) {
        opts.colors = getPalette(scope);
      } else if (chart.__hfxA11yOrigColors) {
        opts.colors = chart.__hfxA11yOrigColors;
      }
    } catch (_a) { }

    try {
      if (typeof chart.updateOptions === 'function') {
        // Note: Passing redrawPaths=false can prevent theme changes from taking effect.
        // Force a redraw so switching dark -> light updates fully.
        chart.updateOptions(opts, true, false, true);
      }
    } catch (e1) {
      try { if (typeof chart.updateOptions === 'function') chart.updateOptions(opts); } catch (_e2) { /* ignore */ }
    }
  }

  function updateAllApexCharts() {
    try {
      var map = window && window.htmlForgeXApexCharts ? window.htmlForgeXApexCharts : null;
      if (!map) return;

      for (var id in map) {
        if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
        updateChart(map[id]);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function init() {
    updateAllApexCharts();
    try {
      window.addEventListener('hfx:themechange', function () {
        // Defer to allow CSS variables/layout to settle after <html data-bs-theme> changes.
        // Some engines update computed styles (CSS variables/color-mix) 1+ frames after attribute changes.
        // Double RAF waits for two paint opportunities before reading styles and re-theming charts.
        try {
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(updateAllApexCharts);
            });
          } else {
            setTimeout(updateAllApexCharts, 0);
          }
        } catch (_t) {
          try { setTimeout(updateAllApexCharts, 0); } catch (_t2) { updateAllApexCharts(); }
        }
      });
      window.addEventListener('hfx:a11ychange', function () { updateAllApexCharts(); });
      window.addEventListener('hfx:operational-workspace-theme-change', function () {
        try {
          if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(updateAllApexCharts);
            });
          } else {
            setTimeout(updateAllApexCharts, 0);
          }
        } catch (_ow) {
          updateAllApexCharts();
        }
      });
    } catch (e) {
      /* ignore */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
