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

  function isPieLike(type) {
    var t = String(type || '').toLowerCase();
    return t === 'pie' || t === 'doughnut' || t === 'polararea';
  }

  function storeOrig(ds) {
    if (!ds || ds.__hfxA11yOrig) return;
    ds.__hfxA11yOrig = {
      backgroundColor: ds.backgroundColor,
      borderColor: ds.borderColor,
      pointBackgroundColor: ds.pointBackgroundColor,
      pointBorderColor: ds.pointBorderColor
    };
  }

  function restoreOrig(ds) {
    if (!ds || !ds.__hfxA11yOrig) return;
    var o = ds.__hfxA11yOrig;
    ds.backgroundColor = o.backgroundColor;
    ds.borderColor = o.borderColor;
    ds.pointBackgroundColor = o.pointBackgroundColor;
    ds.pointBorderColor = o.pointBorderColor;
    delete ds.__hfxA11yOrig;
    delete ds.__hfxA11yApplied;
  }

  function applyPaletteToChart(chart) {
    try {
      if (!chart || !chart.data || !chart.data.datasets) return;
      var a11y = getA11yFlags();
      var datasets = chart.data.datasets;
      if (!a11y.colorBlind) {
        for (var r = 0; r < datasets.length; r++) restoreOrig(datasets[r]);
        return;
      }

      var palette = getPalette();
      if (!palette || palette.length === 0) return;
      var baseType = chart.config && chart.config.type ? chart.config.type : null;

      for (var i = 0; i < datasets.length; i++) {
        var ds = datasets[i] || {};
        var type = ds.type || baseType;
        storeOrig(ds);

        if (isPieLike(type)) {
          if (!ds.backgroundColor || ds.__hfxA11yApplied) {
            var colors = [];
            var count = (ds.data && ds.data.length != null) ? ds.data.length : palette.length;
            for (var j = 0; j < count; j++) {
              colors.push(palette[j % palette.length]);
            }
            ds.backgroundColor = colors;
          }
        } else {
          var color = palette[i % palette.length];
          if (!ds.borderColor || ds.__hfxA11yApplied) ds.borderColor = color;
          if (!ds.backgroundColor || ds.__hfxA11yApplied) ds.backgroundColor = withAlpha(color, 0.35);
          if (!ds.pointBackgroundColor || ds.__hfxA11yApplied) ds.pointBackgroundColor = ds.borderColor;
          if (!ds.pointBorderColor || ds.__hfxA11yApplied) ds.pointBorderColor = ds.borderColor;
        }

        ds.__hfxA11yApplied = true;
      }
    } catch (_e) { }
  }
  function parseHexColor(hex) {
    var h = String(hex || '').trim();
    if (!h) return null;
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) {
      var r3 = parseInt(h[0] + h[0], 16);
      var g3 = parseInt(h[1] + h[1], 16);
      var b3 = parseInt(h[2] + h[2], 16);
      if (isNaN(r3) || isNaN(g3) || isNaN(b3)) return null;
      return { r: r3, g: g3, b: b3 };
    }
    if (h.length === 6) {
      var r6 = parseInt(h.slice(0, 2), 16);
      var g6 = parseInt(h.slice(2, 4), 16);
      var b6 = parseInt(h.slice(4, 6), 16);
      if (isNaN(r6) || isNaN(g6) || isNaN(b6)) return null;
      return { r: r6, g: g6, b: b6 };
    }
    return null;
  }

  function parseRgbColor(rgb) {
    var s = String(rgb || '').trim();
    var m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (!m) return null;
    var r = parseFloat(m[1]);
    var g = parseFloat(m[2]);
    var b = parseFloat(m[3]);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
  }

  function withAlpha(color, alpha) {
    var a = (alpha == null) ? 1 : alpha;
    a = Math.max(0, Math.min(1, a));

    var c = String(color || '').trim();
    if (!c) return c;

    var rgb = parseRgbColor(c);
    if (rgb) return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';

    var hex = parseHexColor(c);
    if (hex) return 'rgba(' + hex.r + ',' + hex.g + ',' + hex.b + ',' + a + ')';

    return c;
  }

  function resolveThemeColors() {
    var text = getCssVar('--tblr-body-color') || getCssVar('--bs-body-color') || '#212529';
    var muted = getCssVar('--tblr-muted') || getCssVar('--bs-secondary-color') || text;
    var border = getCssVar('--tblr-border-color') || getCssVar('--bs-border-color') || 'rgba(0,0,0,.1)';
    var grid = withAlpha(border, 0.35);
    return { text: text, muted: muted, border: border, grid: grid };
  }

  function applyChartDefaults(colors) {
    try {
      if (!window || !window.Chart || !Chart.defaults) return;

      Chart.defaults.color = colors.text;
      Chart.defaults.borderColor = colors.grid || colors.border;

      try {
        Chart.defaults.scale = Chart.defaults.scale || {};
        Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
        Chart.defaults.scale.grid.color = colors.grid || colors.border;
        Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
        Chart.defaults.scale.ticks.color = colors.muted || colors.text;
      } catch (e1) { /* ignore */ }

      try {
        if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
          Chart.defaults.plugins.legend.labels.color = colors.text;
        }
      } catch (e2) { /* ignore */ }

      try {
        if (Chart.defaults.plugins && Chart.defaults.plugins.title) {
          Chart.defaults.plugins.title.color = colors.text;
        }
      } catch (e3) { /* ignore */ }
    } catch (e) {
      /* ignore */
    }
  }

  function updateScaleColors(scale, colors) {
    if (!scale) return;

    try {
      if (scale.ticks) scale.ticks.color = colors.muted || colors.text;
    } catch (e1) { /* ignore */ }

    try {
      if (scale.grid) scale.grid.color = colors.grid || colors.border;
    } catch (e2) { /* ignore */ }

    try {
      if (scale.border) scale.border.color = colors.border;
    } catch (e3) { /* ignore */ }

    try {
      if (scale.title) scale.title.color = colors.text;
    } catch (e4) { /* ignore */ }

    // Radial scale extras (Radar/PolarArea)
    try {
      if (scale.pointLabels) scale.pointLabels.color = colors.text;
    } catch (e5) { /* ignore */ }

    try {
      if (scale.angleLines) scale.angleLines.color = colors.grid || colors.border;
    } catch (e6) { /* ignore */ }
  }

  function updateChartInstance(chart, colors) {
    if (!chart || !chart.options) return;

    try {
      if (chart.__hfxThemeManaged !== true) return;
    } catch (_m) {
      return;
    }

    try {
      var plugins = chart.options.plugins;
      if (plugins) {
        if (plugins.legend && plugins.legend.labels) plugins.legend.labels.color = colors.text;
        if (plugins.title) plugins.title.color = colors.text;
        if (plugins.subtitle) plugins.subtitle.color = colors.text;
      }
    } catch (e1) { /* ignore */ }

    try {
      var scales = chart.options.scales;
      if (scales) {
        for (var k in scales) {
          if (!Object.prototype.hasOwnProperty.call(scales, k)) continue;
          updateScaleColors(scales[k], colors);
        }
      }
    } catch (e2) { /* ignore */ }

    applyPaletteToChart(chart);

    try {
      if (typeof chart.update === 'function') {
        chart.update('none');
      }
    } catch (e3) {
      try { if (typeof chart.update === 'function') chart.update(); } catch (_e4) { /* ignore */ }
    }
  }

  function updateAllCharts() {
    var colors = resolveThemeColors();
    applyChartDefaults(colors);

    try {
      var map = window && window.htmlForgeXCharts ? window.htmlForgeXCharts : null;
      if (!map) return;
      for (var id in map) {
        if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
        updateChartInstance(map[id], colors);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function init() {
    updateAllCharts();
    try {
      window.addEventListener('hfx:themechange', function () { updateAllCharts(); });
      window.addEventListener('hfx:a11ychange', function () { updateAllCharts(); });
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
