(function () {
  'use strict';

  function getCssVar(name) {
    try {
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

  function getPalette() {
    var p1 = getCssVar('--hfx-palette-1');
    var p2 = getCssVar('--hfx-palette-2');
    var p3 = getCssVar('--hfx-palette-3');
    var p4 = getCssVar('--hfx-palette-4');
    var p5 = getCssVar('--hfx-palette-5');
    var p6 = getCssVar('--hfx-palette-6');
    var p7 = getCssVar('--hfx-palette-7');
    var list = [p1, p2, p3, p4, p5, p6, p7].filter(function (c) { return !!c; });
    if (list.length > 0) return list;
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

  function getTheme() {
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

  function resolveForeColor() {
    return getCssVar('--tblr-body-color') || getCssVar('--bs-body-color') || '#212529';
  }

  function resolveSurfaceBg() {
    return getCssVar('--tblr-bg-surface') || getCssVar('--tblr-card-bg') || getCssVar('--tblr-body-bg') || getCssVar('--bs-body-bg') || '';
  }

  function resolveBorderColor() {
    return getCssVar('--tblr-border-color') || getCssVar('--bs-border-color') || '';
  }

  function updateChart(chart, theme, foreColor) {
    if (!chart) return;

    try {
      if (chart.__hfxThemeManaged !== true) return;
    } catch (_m) {
      return;
    }

    var opts = {
      theme: { mode: theme },
      chart: { foreColor: foreColor },
      tooltip: { theme: theme }
    };

    var bg = resolveSurfaceBg();
    if (bg) opts.chart.background = bg;

    var bc = resolveBorderColor();
    if (bc) opts.grid = { borderColor: bc };

    try {
      var a11y = getA11yFlags();
      if (a11y.colorBlind) {
        if (!chart.__hfxA11yOrigColors) chart.__hfxA11yOrigColors = snapshotColors(chart);
        opts.colors = getPalette();
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
      var theme = getTheme();
      var foreColor = resolveForeColor();
      var map = window && window.htmlForgeXApexCharts ? window.htmlForgeXApexCharts : null;
      if (!map) return;

      for (var id in map) {
        if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
        updateChart(map[id], theme, foreColor);
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
