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

  function resolveForeColor(scope) {
    return getCssVar('--hfx-op-dashboard-text', scope)
      || getCssVar('--hfx-op-text', scope)
      || getCssVar('--hfx-card-body-color', scope)
      || getCssVar('--tblr-body-color', scope)
      || getCssVar('--bs-body-color', scope)
      || '';
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

  function snapshotColors(chart) {
    try {
      if (chart && chart.w && chart.w.config && chart.w.config.colors) return chart.w.config.colors.slice();
    } catch (_e1) { }
    try {
      if (chart && chart.opts && chart.opts.colors) return chart.opts.colors.slice();
    } catch (_e2) { }
    return null;
  }

  function resolveChartElement(chart) {
    try { if (chart && chart.__hfxElement) return chart.__hfxElement; } catch (_e0) { }
    try { if (chart && chart.el) return chart.el; } catch (_e1) { }
    try { if (chart && chart.w && chart.w.globals && chart.w.globals.dom && chart.w.globals.dom.baseEl) return chart.w.globals.dom.baseEl; } catch (_e2) { }
    return null;
  }

  function updateManagedChart(chart) {
    if (!chart) return;
    try {
      if (chart.__hfxThemeManaged !== true) return;
    } catch (_m) {
      return;
    }

    var scope = resolveChartElement(chart);
    var theme = getTheme(scope);
    var opts = {
      theme: { mode: theme },
      chart: {
        background: 'transparent',
        foreColor: resolveForeColor(scope)
      },
      tooltip: { theme: theme }
    };

    var borderColor = resolveBorderColor(scope);
    if (borderColor) {
      opts.grid = { borderColor: borderColor };
    }

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
        chart.updateOptions(opts, true, false, true);
      }
    } catch (_u1) {
      try { if (typeof chart.updateOptions === 'function') chart.updateOptions(opts); } catch (_u2) { }
    }
  }

  function updateAllManagedCharts() {
    try {
      var map = window && window.htmlForgeXApexCharts ? window.htmlForgeXApexCharts : null;
      if (!map) return;
      for (var id in map) {
        if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
        updateManagedChart(map[id]);
      }
    } catch (_e) { }
  }

  function scheduleThemeRefresh() {
    try {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(updateAllManagedCharts);
        });
      } else {
        setTimeout(updateAllManagedCharts, 0);
      }
    } catch (_e) {
      updateAllManagedCharts();
    }
  }

  function applyThemeDefaults(options, autoColors, scope) {
    if (!options || typeof options !== 'object') return;

    var theme = getTheme(scope);
    if (!options.theme || typeof options.theme !== 'object') options.theme = {};
    // When following the document theme, ensure mode is always aligned (even if options were re-used).
    options.theme.mode = theme;

    if (!options.chart || typeof options.chart !== 'object') options.chart = {};
    if (!options.chart.foreColor) {
      var fc = resolveForeColor(scope);
      if (fc) options.chart.foreColor = fc;
    }

    if (!Object.prototype.hasOwnProperty.call(options.chart, 'background')) {
      // Most HtmlForgeX charts live inside themed cards/surfaces already.
      // Keep the chart stage transparent so the parent surface owns the look in light/dark/carbon.
      options.chart.background = 'transparent';
    }

    if (!options.tooltip || typeof options.tooltip !== 'object') options.tooltip = {};
    if (!options.tooltip.theme) options.tooltip.theme = theme;

    if (!options.grid || typeof options.grid !== 'object') options.grid = {};
    if (!options.grid.borderColor) {
      var bc = resolveBorderColor(scope);
      if (bc) options.grid.borderColor = bc;
    }

    if (autoColors && !options.colors) {
      options.colors = getPalette(scope);
    }

    try {
      var a11y = getA11yFlags();
      if (a11y.colorBlind && !options.colors) {
        options.colors = getPalette(scope);
      }
    } catch (_a) { }
  }

  function isInitialized(el) {
    try {
      return el && el.getAttribute && el.getAttribute('data-hfx-apex-init') === '1';
    } catch (e) {
      return false;
    }
  }

  function markInitialized(el) {
    try { if (el && el.setAttribute) el.setAttribute('data-hfx-apex-init', '1'); } catch (e) { /* ignore */ }
  }

  function storeChart(id, chart) {
    if (!id || !chart) return;
    try {
      window.htmlForgeXApexCharts = window.htmlForgeXApexCharts || {};
      window.htmlForgeXApexCharts[id] = chart;
    } catch (e) {
      /* ignore */
    }
  }

  function initOne(el, options, cfg) {
    try {
      if (!el) return null;
      if (isInitialized(el)) return null;
      markInitialized(el);

      var followTheme = !!(cfg && cfg.followTheme);
      var autoColors = !!(cfg && cfg.autoColors);
      var id = (cfg && cfg.id) ? String(cfg.id) : (el.id ? String(el.id) : '');
      var hadExplicitColors = !!(options && options.colors);

      if (followTheme) applyThemeDefaults(options, autoColors, el);

      if (typeof ApexCharts !== 'function') return null;
      var chart = new ApexCharts(el, options);

      // Keep a registry for visibility refresh/reflow handlers.
      storeChart(id, chart);

      if (followTheme) {
        try { chart.__hfxThemeManaged = true; } catch (_m) { /* ignore */ }
        try { chart.__hfxThemeAutoColors = autoColors && !hadExplicitColors; } catch (_ac) { /* ignore */ }
        try { chart.__hfxElement = el; } catch (_el) { /* ignore */ }
      }

      try {
        if (typeof chart.render === 'function') chart.render();
      } catch (e1) {
        /* ignore */
      }

      // Charts created during tab/carousel transitions may measure too early.
      // Schedule post-render reflow passes to stabilize geometry.
      try {
        var resizeNow = function () {
          try {
            if (!chart) return;
            if (typeof chart.resize === 'function') {
              chart.resize();
            } else if (typeof chart.updateOptions === 'function') {
              chart.updateOptions({}, false, false, false);
            } else {
              window.dispatchEvent(new Event('resize'));
            }
          } catch (_r0) { }
        };
        requestAnimationFrame(resizeNow);
        setTimeout(resizeNow, 220);
      } catch (_r1) { }

      return chart;
    } catch (e) {
      return null;
    }
  }

  function init(elOrSelector, options, cfg) {
    var el = elOrSelector;
    try {
      if (typeof elOrSelector === 'string') el = document.querySelector(elOrSelector);
    } catch (e) {
      /* ignore */
    }
    return initOne(el, options, cfg);
  }

  function initById(id, options, cfg) {
    var chartId = (id == null) ? '' : String(id);
    var config = cfg || {};
    if (!config.id) config.id = chartId;

    function boot() {
      initOne(document.getElementById(chartId), options, config);
    }

    var lazy = !!config.lazyInit;
    if (lazy && window.htmlForgeXWhenVisible) {
      try {
        window.htmlForgeXWhenVisible('#' + chartId, function (el) { initOne(el, options, config); });
        return;
      } catch (_w) {
        /* fallthrough */
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  window.hfxApexCharts = window.hfxApexCharts || {};
  window.hfxApexCharts.init = init;
  window.hfxApexCharts.initById = initById;
  window.hfxApexCharts.refreshTheme = updateAllManagedCharts;

  try {
    window.addEventListener('hfx:themechange', scheduleThemeRefresh);
    window.addEventListener('hfx:a11ychange', scheduleThemeRefresh);
    window.addEventListener('hfx:operational-workspace-theme-change', scheduleThemeRefresh);
  } catch (_events) { }
})();
