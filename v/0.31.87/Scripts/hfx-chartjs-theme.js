(function () {
  'use strict';

  function getCssVar(name, element) {
    try {
      var root = element || (document && document.documentElement ? document.documentElement : null);
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

  function getRootAttr(name, element) {
    if (element && element.closest) {
      var scope = element.closest('[' + name + ']');
      if (scope) return scope.getAttribute(name);
    }
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

  function getA11yFlags(element) {
    var v = getRootAttr('data-hfx-a11y', element);
    if (!v) return { colorBlind: false, highContrast: false };
    var tokens = String(v).toLowerCase().split(/\s+/);
    return {
      colorBlind: tokens.indexOf('color-blind') >= 0,
      highContrast: tokens.indexOf('high-contrast') >= 0
    };
  }

  function getPalette(element) {
    var colors = [];
    for (var index = 1; index <= 10; index++) {
      var color = getCssVar('--hfx-color-chart-series-' + index, element) || getCssVar('--hfx-color-series-' + index, element);
      if (color) colors.push(color);
    }
    return colors;
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
  }

  function applyPaletteToChart(chart) {
    try {
      if (!chart || !chart.data || !chart.data.datasets) return;
      var a11y = getA11yFlags(chart.canvas);
      var datasets = chart.data.datasets;
      var palette = getPalette(chart.canvas);
      if (!a11y.colorBlind) {
        for (var r = 0; r < datasets.length; r++) {
          var managed = datasets[r];
          restoreOrig(managed);
          var auto = managed && managed.__hfxThemeAutoPalette;
          if (!auto || !palette.length) continue;
          var kind = managed.type || (chart.config && chart.config.type);
          if (isPieLike(kind)) {
            if (auto.background) managed.backgroundColor = (managed.data || []).map(function (_value, index) { return palette[index % palette.length]; });
          } else {
            var tone = palette[r % palette.length];
            if (auto.border) managed.borderColor = tone;
            if (auto.background) managed.backgroundColor = withAlpha(tone, 0.35);
            if (auto.pointBackground) managed.pointBackgroundColor = managed.borderColor;
            if (auto.pointBorder) managed.pointBorderColor = managed.borderColor;
          }
        }
        return;
      }

      if (!palette || palette.length === 0) return;
      var baseType = chart.config && chart.config.type ? chart.config.type : null;

      for (var i = 0; i < datasets.length; i++) {
        var ds = datasets[i] || {};
        var type = ds.type || baseType;
        storeOrig(ds);
        var original = ds.__hfxA11yOrig;
        var automatic = ds.__hfxThemeAutoPalette || {
          background: !original.backgroundColor, border: !original.borderColor,
          pointBackground: !original.pointBackgroundColor, pointBorder: !original.pointBorderColor
        };

        if (isPieLike(type)) {
          if (automatic.background) {
            var colors = [];
            var count = (ds.data && ds.data.length != null) ? ds.data.length : palette.length;
            for (var j = 0; j < count; j++) {
              colors.push(palette[j % palette.length]);
            }
            ds.backgroundColor = colors;
          }
        } else {
          var color = palette[i % palette.length];
          if (automatic.border) ds.borderColor = color;
          if (automatic.background) ds.backgroundColor = withAlpha(color, 0.35);
          if (automatic.pointBackground) ds.pointBackgroundColor = ds.borderColor;
          if (automatic.pointBorder) ds.pointBorderColor = ds.borderColor;
        }

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

  function resolveThemeColors(element) {
    var text = getCssVar('--hfx-color-text', element);
    var muted = getCssVar('--hfx-color-text-muted', element) || text;
    var border = getCssVar('--hfx-color-border', element);
    var grid = withAlpha(border, 0.35);
    return { text: text, muted: muted, border: border, grid: grid };
  }

  function applyChartDefaults(colors) {
    try {
      if (!window || !window.Chart || !Chart.defaults) return;

      Chart.defaults.color = colors.text;
      Chart.defaults.font = Chart.defaults.font || {};
      Chart.defaults.font.family = getCssVar('--hfx-font-sans');
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

    if (chart.__hfxThemeAutoFont === true) {
      if (!chart.options.font) chart.options.font = {};
      chart.options.font.family = getCssVar('--hfx-font-sans', chart.canvas);
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
        updateChartInstance(map[id], resolveThemeColors(map[id].canvas));
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
      // Canvas text needs a redraw when an offline or web font finishes loading.
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', updateAllCharts);
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
