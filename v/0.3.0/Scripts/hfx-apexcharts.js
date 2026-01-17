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
    return getCssVar('--tblr-body-color') || getCssVar('--bs-body-color') || '';
  }

  function resolveSurfaceBg() {
    return getCssVar('--tblr-bg-surface') || getCssVar('--tblr-card-bg') || getCssVar('--tblr-body-bg') || getCssVar('--bs-body-bg') || '';
  }

  function resolveBorderColor() {
    return getCssVar('--tblr-border-color') || getCssVar('--bs-border-color') || '';
  }

  function applyThemeDefaults(options) {
    if (!options || typeof options !== 'object') return;

    var theme = getTheme();
    if (!options.theme || typeof options.theme !== 'object') options.theme = {};
    // When following the document theme, ensure mode is always aligned (even if options were re-used).
    options.theme.mode = theme;

    if (!options.chart || typeof options.chart !== 'object') options.chart = {};
    if (!options.chart.foreColor) {
      var fc = resolveForeColor();
      if (fc) options.chart.foreColor = fc;
    }

    if (!options.chart.background) {
      var bg = resolveSurfaceBg();
      // Keep charts visually aligned with the surrounding card/surface background.
      if (bg) options.chart.background = bg;
    }

    if (!options.tooltip || typeof options.tooltip !== 'object') options.tooltip = {};
    if (!options.tooltip.theme) options.tooltip.theme = theme;

    if (!options.grid || typeof options.grid !== 'object') options.grid = {};
    if (!options.grid.borderColor) {
      var bc = resolveBorderColor();
      if (bc) options.grid.borderColor = bc;
    }

    try {
      var a11y = getA11yFlags();
      if (a11y.colorBlind && !options.colors) {
        options.colors = getPalette();
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
      var id = (cfg && cfg.id) ? String(cfg.id) : (el.id ? String(el.id) : '');

      if (followTheme) applyThemeDefaults(options);

      if (typeof ApexCharts !== 'function') return null;
      var chart = new ApexCharts(el, options);

      if (followTheme) {
        try { chart.__hfxThemeManaged = true; } catch (_m) { /* ignore */ }
        storeChart(id, chart);
      }

      try {
        if (typeof chart.render === 'function') chart.render();
      } catch (e1) {
        /* ignore */
      }

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
})();
