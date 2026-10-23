(function () {
  'use strict';

  if (window.hfxChartJs) return;

  function getById(id) {
    try { return document.getElementById(id); } catch (_e) { return null; }
  }

  function isInit(canvas) {
    try { return canvas && canvas.getAttribute && canvas.getAttribute('data-hfx-chartjs-init') === '1'; } catch (_e) { return false; }
  }

  function markInit(canvas) {
    try { if (canvas && canvas.setAttribute) canvas.setAttribute('data-hfx-chartjs-init', '1'); } catch (_e) { }
  }

  function applyCanvasDefaults(canvas) {
    try {
      if (!canvas || !canvas.style) return;
      canvas.style.display = 'block';
      canvas.style.maxWidth = '100%';
      canvas.style.minWidth = '0';
    } catch (_e) { }
  }

  function storeChart(id, chart) {
    try {
      if (!id || !chart) return;
      window.htmlForgeXCharts = window.htmlForgeXCharts || {};
      window.htmlForgeXCharts[id] = chart;
    } catch (_e) { }
  }

  function markThemeManaged(chart) {
    try { if (chart) chart.__hfxThemeManaged = true; } catch (_e) { }
  }

  function getCssVar(name) {
    try {
      var root = document && document.documentElement ? document.documentElement : null;
      var v = root ? getComputedStyle(root).getPropertyValue(name) : '';
      v = (v == null) ? '' : String(v).trim();
      if (!v) {
        var body = document && document.body ? document.body : null;
        v = body ? getComputedStyle(body).getPropertyValue(name) : '';
        v = (v == null) ? '' : String(v).trim();
      }
      return v || '';
    } catch (_e) {
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

  function isPieLike(type) {
    var t = String(type || '').toLowerCase();
    return t === 'pie' || t === 'doughnut' || t === 'polararea';
  }

  function applyPaletteToConfig(cfg) {
    try {
      if (!cfg || !cfg.data || !cfg.data.datasets) return;
      var a11y = getA11yFlags();
      if (!a11y.colorBlind) return;

      var palette = getPalette();
      if (!palette || palette.length === 0) return;

      var datasets = cfg.data.datasets;
      var baseType = cfg.type;
      for (var i = 0; i < datasets.length; i++) {
        var ds = datasets[i] || {};
        var type = ds.type || baseType;
        if (isPieLike(type)) {
          if (!ds.backgroundColor && ds.data && ds.data.length != null) {
            var colors = [];
            for (var j = 0; j < ds.data.length; j++) {
              colors.push(palette[j % palette.length]);
            }
            ds.backgroundColor = colors;
          }
        } else {
          var color = palette[i % palette.length];
          if (!ds.borderColor) ds.borderColor = color;
          if (!ds.backgroundColor) ds.backgroundColor = withAlpha(color, 0.35);
          if (!ds.pointBackgroundColor) ds.pointBackgroundColor = ds.borderColor;
          if (!ds.pointBorderColor) ds.pointBorderColor = ds.borderColor;
        }
      }
    } catch (_e) { }
  }

  function createChart(canvas, cfg) {
    try {
      if (!canvas || !cfg) return null;
      if (!window.Chart) return null;
      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return null;
      return new Chart(ctx, cfg);
    } catch (_e) { return null; }
  }

  function attachResizeHandlers(canvas, chart) {
    try {
      if (!canvas || !chart) return;
      if (typeof ResizeObserver !== 'undefined') {
        try {
          var ro = new ResizeObserver(function () {
            try {
              if (chart && typeof chart.resize === 'function') {
                requestAnimationFrame(function () { try { chart.resize(); } catch (_e0) { } });
              }
            } catch (_e1) { }
          });
          ro.observe(canvas.parentElement || canvas);
        } catch (_e2) { }
      }

      var resize = function () { try { if (chart && typeof chart.resize === 'function') chart.resize(); } catch (_e3) { } };
      try { window.addEventListener('resize', resize); } catch (_e4) { }
      try { window.addEventListener('orientationchange', function () { setTimeout(resize, 0); }); } catch (_e5) { }
      try { setTimeout(resize, 0); } catch (_e6) { }
    } catch (_e) { }
  }

  function runLazy(canvasId, lazyInit, initFn) {
    try {
      if (!canvasId || typeof initFn !== 'function') return false;
      var canvas = getById(canvasId);
      if (!canvas) return false;

      if (lazyInit && window.htmlForgeXWhenVisible) {
        window.htmlForgeXWhenVisible(canvas, function () { try { initFn(canvas); } catch (_e0) { } });
        return true;
      }

      initFn(canvas);
      return true;
    } catch (_e) { return false; }
  }

  function registerChartGeoParts(parts) {
    try {
      if (!parts || !parts.length) return;
      if (!window.Chart || !Chart.register) return;
      Chart.register.apply(Chart, parts);
    } catch (_e) { }
  }

  function ensureChartGeoBubbleRegistered() {
    try {
      if (!window.ChartGeo) return;
      var parts = [];
      if (ChartGeo.BubbleMapController) parts.push(ChartGeo.BubbleMapController);
      if (ChartGeo.ProjectionScale) parts.push(ChartGeo.ProjectionScale);
      if (ChartGeo.ColorScale) parts.push(ChartGeo.ColorScale);
      if (ChartGeo.SizeScale) parts.push(ChartGeo.SizeScale);
      registerChartGeoParts(parts);
    } catch (_e) { }
  }

  function ensureChartGeoChoroplethRegistered() {
    try {
      if (!window.ChartGeo) return;
      var parts = [];
      if (ChartGeo.ChoroplethController) parts.push(ChartGeo.ChoroplethController);
      if (ChartGeo.ProjectionScale) parts.push(ChartGeo.ProjectionScale);
      if (ChartGeo.ColorScale) parts.push(ChartGeo.ColorScale);
      if (ChartGeo.GeoFeature) parts.push(ChartGeo.GeoFeature);
      if (ChartGeo.ColorLegend) parts.push(ChartGeo.ColorLegend);
      registerChartGeoParts(parts);
    } catch (_e) { }
  }

  function filterPointsByRegion(points, region) {
    try {
      if (!region) return points || [];
      var r = String(region).toLowerCase();
      var boxes = {
        europe: [-31, 34, 40, 72],
        asia: [25, 0, 180, 80],
        africa: [-20, -35, 55, 38],
        north_america: [-170, 7, -20, 83],
        south_america: [-82, -56, -34, 13],
        oceania: [110, -50, 180, 0],
        antarctica: [-180, -90, 180, -60]
      };
      var box = boxes[r] || null;
      if (!box) return points || [];
      var inBox = function (lon, lat) { return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3]; };
      return (points || []).filter(function (p) {
        var lon = (p && p.longitude != null) ? p.longitude : (p ? p.Longitude : null);
        var lat = (p && p.latitude != null) ? p.latitude : (p ? p.Latitude : null);
        if (lon == null || lat == null) return false;
        return inBox(lon, lat);
      });
    } catch (_e) { return points || []; }
  }

  function initStandard(opts) {
    opts = opts || {};
    return runLazy(opts.canvasId, !!opts.lazyInit, function (canvas) {
      if (!canvas) return;
      if (isInit(canvas)) return;
      markInit(canvas);
      applyCanvasDefaults(canvas);

      var cfg = opts.config || opts.cfg;
      applyPaletteToConfig(cfg);
      var chart = createChart(canvas, cfg);
      if (!chart) return;
      markThemeManaged(chart);
      storeChart(opts.canvasId, chart);
      attachResizeHandlers(canvas, chart);
    });
  }

  function initGeoBubble(opts) {
    opts = opts || {};
    return runLazy(opts.canvasId, !!opts.lazyInit, function (canvas) {
      if (!canvas) return;
      if (isInit(canvas)) return;
      markInit(canvas);
      applyCanvasDefaults(canvas);
      ensureChartGeoBubbleRegistered();

      var points = filterPointsByRegion(opts.points || [], opts.region);
      var ptsXY = (points || []).map(function (p) {
        var lon = (p && p.longitude != null) ? p.longitude : (p ? p.Longitude : null);
        var lat = (p && p.latitude != null) ? p.latitude : (p ? p.Latitude : null);
        var value = (p && p.value != null) ? p.value : (p ? p.Value : null);
        var label = (p && p.label != null) ? p.label : (p ? p.Label : null);
        return { x: lon, y: lat, value: value, label: label };
      });

      var units = (opts.units == null) ? '' : String(opts.units);
      var colorLegendPos = (opts.colorLegendPosition == null) ? 'bottom-right' : String(opts.colorLegendPosition);
      var colorScheme = (opts.colorScheme == null) ? 'blues' : String(opts.colorScheme);
      var projection = (opts.projection == null) ? 'equalEarth' : String(opts.projection);

      var sizeMin = (opts.sizeRange && opts.sizeRange.min != null) ? opts.sizeRange.min : 2;
      var sizeMax = (opts.sizeRange && opts.sizeRange.max != null) ? opts.sizeRange.max : 15;
      var domainMin = (opts.colorDomain && opts.colorDomain.min != null) ? opts.colorDomain.min : null;
      var domainMax = (opts.colorDomain && opts.colorDomain.max != null) ? opts.colorDomain.max : null;

      var cfg = {
        type: 'bubbleMap',
        data: {
          datasets: [{
            label: 'Points',
            data: ptsXY,
            backgroundColor: function (ctx) {
              try {
                return (ctx && ctx.chart && ctx.chart.scales && ctx.chart.scales.color)
                  ? ctx.chart.scales.color.getColorForValue((ctx.raw && ctx.raw.value) || 0)
                  : '#1f77b4';
              } catch (_e) { return '#1f77b4'; }
            },
            radius: function (ctx) {
              try {
                return (ctx && ctx.chart && ctx.chart.scales && ctx.chart.scales.size)
                  ? ctx.chart.scales.size.getSizeForValue((ctx.raw && ctx.raw.value) || 0)
                  : 5;
              } catch (_e) { return 5; }
            }
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: !!opts.legend },
            colorLegend: { display: !!opts.colorLegend, position: colorLegendPos },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  try {
                    var d = (ctx && ctx.raw) ? ctx.raw : {};
                    var n = d.label || '';
                    var v = d.value;
                    return (n ? (n + ': ') : '') + v + units;
                  } catch (_e) { return ''; }
                }
              }
            }
          },
          scales: {
            projection: { axis: 'x', projection: projection },
            color: { axis: 'y', scheme: colorScheme, domain: [domainMin, domainMax] },
            size: { range: [sizeMin, sizeMax] }
          }
        }
      };

      var chart = createChart(canvas, cfg);
      if (!chart) return;
      markThemeManaged(chart);
      storeChart(opts.canvasId, chart);
      attachResizeHandlers(canvas, chart);

      // Optional click output element
      try {
        if (opts.clickOutputElementId) {
          var outId = String(opts.clickOutputElementId);
          canvas.addEventListener('click', function (evt) {
            try {
              var els = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
              if (!els || !els.length) return;
              var e = els[0];
              var d = chart.data && chart.data.datasets && chart.data.datasets[e.datasetIndex] && chart.data.datasets[e.datasetIndex].data
                ? chart.data.datasets[e.datasetIndex].data[e.index]
                : null;
              var out = getById(outId);
              if (out && d) out.textContent = (d.label || '') + ': ' + d.value + units;
            } catch (_e1) { }
          });
        }
      } catch (_e2) { }
    });
  }

  function initGeoWorld(opts) {
    opts = opts || {};
    return runLazy(opts.canvasId, !!opts.lazyInit, function (canvas) {
      if (!canvas) return;
      if (isInit(canvas)) return;
      markInit(canvas);
      applyCanvasDefaults(canvas);
      ensureChartGeoChoroplethRegistered();

      var topoUrl = String(opts.topologyUrl || '');
      var objectName = String(opts.objectName || 'countries');
      var valuesByName = opts.valuesByCountry || {};

      var region = opts.region ? String(opts.region) : null;
      var showOutline = (region ? false : !!opts.showOutline);
      var showGraticule = !!opts.showGraticule;
      var legend = !!opts.legend;
      var colorLegend = !!opts.colorLegend;
      var colorLegendPos = String(opts.colorLegendPosition || 'bottom-right');
      var colorScheme = String(opts.colorScheme || 'blues');
      var domainMin = (opts.colorDomain && opts.colorDomain.min != null) ? opts.colorDomain.min : null;
      var domainMax = (opts.colorDomain && opts.colorDomain.max != null) ? opts.colorDomain.max : null;
      var projection = String(opts.projection || 'equalEarth');
      var projPadding = (opts.projectionPadding != null) ? opts.projectionPadding : 0;

      function buildChart(world) {
        try {
          var topo = (window.ChartGeo && ChartGeo.topojson) ? ChartGeo.topojson : (window.topojson || null);
          if (!topo || !topo.feature) return;
          var countries = topo.feature(world, world.objects[objectName]).features;

          // Optional region filter by approximate bounding boxes
          if (region) {
            var r = String(region).toLowerCase();
            var boxes = {
              europe: [-31, 34, 40, 72],
              asia: [25, 0, 180, 80],
              africa: [-20, -35, 55, 38],
              north_america: [-170, 7, -20, 83],
              south_america: [-82, -56, -34, 13],
              oceania: [110, -50, 180, 0],
              antarctica: [-180, -90, 180, -60]
            };
            var box = boxes[r] || null;
            if (box) {
              function inBBox(lon, lat) { return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3]; }
              function anyCoordInBox(coords) {
                if (!coords) return false;
                if (typeof coords[0] === 'number') return inBBox(coords[0], coords[1]);
                for (var i = 0; i < coords.length; i++) { if (anyCoordInBox(coords[i])) return true; }
                return false;
              }
              countries = (countries || []).filter(function (f) {
                try {
                  var g = f && f.geometry;
                  if (!g) return false;
                  var inside = anyCoordInBox(g.coordinates);
                  if (!inside) return false;
                  if (r === 'north_america') {
                    var nm = (f.properties && (f.properties.name || f.properties.NAME_EN || f.properties.ADMIN) || '').toLowerCase();
                    if (nm.indexOf('russia') >= 0 || nm.indexOf('kazakhstan') >= 0) return false;
                  }
                  return true;
                } catch (_e1) { return false; }
              });
            }
          }

          var labels = (countries || []).map(function (f) {
            try { return (f.properties && (f.properties.name || f.properties.NAME_EN || f.properties.ADMIN)) || ''; } catch (_e) { return ''; }
          });

          var data = (countries || []).map(function (f) {
            var name = '';
            try { name = (f.properties && (f.properties.name || f.properties.NAME_EN || f.properties.ADMIN)) || ''; } catch (_e0) { name = ''; }
            var v = (valuesByName && (name in valuesByName)) ? valuesByName[name] : Math.random() * 100;
            return { feature: f, value: v };
          });

          var cfg = {
            type: 'choropleth',
            data: { labels: labels, datasets: [{ label: 'World', data: data }] },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              showOutline: showOutline,
              showGraticule: showGraticule,
              plugins: {
                legend: { display: legend },
                colorLegend: { display: colorLegend, position: colorLegendPos }
              },
              scales: {
                projection: { axis: 'x', projection: projection, padding: projPadding },
                color: { axis: 'y', scheme: colorScheme, domain: [domainMin, domainMax] }
              }
            }
          };

          var chart = createChart(canvas, cfg);
          if (!chart) return;
          markThemeManaged(chart);
          storeChart(opts.canvasId, chart);
          attachResizeHandlers(canvas, chart);
        } catch (_e2) { }
      }

      try {
        if (!topoUrl) return;
        fetch(topoUrl).then(function (r) { return r.json(); }).then(function (world) { buildChart(world); });
      } catch (_e3) { }
    });
  }

  window.hfxChartJs = {
    initChart: initStandard,
    initGeoBubble: initGeoBubble,
    initGeoWorld: initGeoWorld
  };
})();
