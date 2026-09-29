(function () {
  'use strict';

  if (window.hfxChartXkcd) return;

  var registry = {};

  function getById(id) {
    try { return document.getElementById(id); } catch (_e) { return null; }
  }

  function getCssVar(name, scope) {
    try {
      if (scope && scope.nodeType === 1) {
        var scoped = getComputedStyle(scope).getPropertyValue(name);
        scoped = scoped == null ? '' : String(scoped).trim();
        if (scoped) return scoped;

        var surface = scope.closest ? scope.closest('[data-hfx-operational-workspace], [data-hfx-surface]') : null;
        if (surface) {
          scoped = getComputedStyle(surface).getPropertyValue(name);
          scoped = scoped == null ? '' : String(scoped).trim();
          if (scoped) return scoped;
        }
      }

      var root = document && document.documentElement ? document.documentElement : null;
      var value = root ? getComputedStyle(root).getPropertyValue(name) : '';
      value = value == null ? '' : String(value).trim();
      if (!value) {
        var body = document && document.body ? document.body : null;
        value = body ? getComputedStyle(body).getPropertyValue(name) : '';
        value = value == null ? '' : String(value).trim();
      }
      return value || '';
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
    var value = getRootAttr('data-hfx-a11y');
    if (!value) return { colorBlind: false, highContrast: false };
    var tokens = String(value).toLowerCase().split(/\s+/);
    return {
      colorBlind: tokens.indexOf('color-blind') >= 0,
      highContrast: tokens.indexOf('high-contrast') >= 0
    };
  }

  function isDarkTheme() {
    var mode = getRootAttr('data-bs-theme') || getRootAttr('data-hfx-theme');
    return String(mode || '').toLowerCase().indexOf('dark') === 0;
  }

  function highContrastPalette() {
    return isDarkTheme()
      ? ['#7cc7ff', '#ffb000', '#00d084', '#ff6b6b', '#d8a1ff', '#facc15', '#2dd4bf']
      : ['#005f99', '#9a5800', '#007a59', '#a13f00', '#8a4770', '#766800', '#267da8'];
  }

  function colorBlindPalette() {
    return ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#cc79a7', '#f0e442', '#56b4e9'];
  }

  function getPalette(scope, a11y) {
    var accentRgb = getCssVar('--hfx-surface-accent-rgb', scope) || getCssVar('--hfx-op-accent-rgb', scope);
    var accent = accentRgb ? ('rgb(' + accentRgb + ')') : '';
    var values = [
      getCssVar('--hfx-palette-1', scope),
      getCssVar('--hfx-palette-2', scope),
      getCssVar('--hfx-palette-3', scope),
      getCssVar('--hfx-palette-4', scope),
      getCssVar('--hfx-palette-5', scope),
      getCssVar('--hfx-palette-6', scope),
      getCssVar('--hfx-palette-7', scope)
    ].filter(function (color) { return !!color; });

    var hasAccent = accent && !(a11y && (a11y.highContrast || a11y.colorBlind));
    if (hasAccent) values.unshift(accent);
    if (hasAccent && values.length === 1) {
      values = values.concat(colorBlindPalette());
    }
    if (values.length > 0) return values;
    if (a11y && a11y.highContrast) return highContrastPalette();
    return colorBlindPalette();
  }

  function getDataColorCount(config) {
    try {
      var data = config && config.data ? config.data : {};
      var labels = Array.isArray(data.labels) ? data.labels.length : 0;
      var datasets = Array.isArray(data.datasets) ? data.datasets : [];
      var count = Math.max(labels, datasets.length);
      for (var i = 0; i < datasets.length; i++) {
        var values = datasets[i] && Array.isArray(datasets[i].data) ? datasets[i].data.length : 0;
        if (values > count) count = values;
      }
      return count;
    } catch (_e) {
      return 0;
    }
  }

  function extendPalette(colors, count) {
    colors = Array.isArray(colors) ? colors.slice(0) : [];
    if (colors.length === 0 || !count || count <= colors.length) return colors;
    var seed = colors.slice(0);
    for (var i = colors.length; i < count; i++) {
      colors.push(seed[i % seed.length]);
    }
    return colors;
  }

  function resolveTextColor(scope) {
    return getCssVar('--hfx-op-dashboard-text', scope)
      || getCssVar('--hfx-op-text', scope)
      || getCssVar('--hfx-card-body-color', scope)
      || getCssVar('--tblr-body-color', scope)
      || getCssVar('--bs-body-color', scope)
      || '#212529';
  }

  function isSolidSvgColor(value) {
    if (!value) return false;
    var normalized = String(value).trim();
    if (!normalized) return false;
    var lower = normalized.toLowerCase();
    return lower.indexOf('gradient(') < 0 && lower.indexOf('url(') < 0;
  }

  function getComputedBackgroundColor(scope) {
    try {
      var style = window.getComputedStyle ? window.getComputedStyle(scope || document.documentElement) : null;
      return style ? style.backgroundColor : '';
    } catch (_e) {
      return '';
    }
  }

  function resolveBackground(scope) {
    var values = [
      getCssVar('--hfx-op-dashboard-card-bg', scope),
      getCssVar('--hfx-surface-card-bg', scope),
      getCssVar('--tblr-bg-surface', scope),
      getCssVar('--tblr-card-bg', scope),
      getCssVar('--tblr-body-bg', scope),
      getCssVar('--bs-body-bg', scope),
      getComputedBackgroundColor(scope)
    ];

    for (var i = 0; i < values.length; i++) {
      if (isSolidSvgColor(values[i])) return values[i];
    }

    return '#ffffff';
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (_e) {
      return value || {};
    }
  }

  function applyTheme(svg, config, opts) {
    if (!config) return config;

    config.options = config.options || {};
    var a11y = getA11yFlags();
    var colorCount = getDataColorCount(config);

    if (config.options.dataColors && config.options.dataColors.length) {
      config.options.dataColors = extendPalette(config.options.dataColors, colorCount);
    }

    if (!opts || !opts.followTheme) {
      if ((!config.options.dataColors || !config.options.dataColors.length) && opts && opts.autoColors) {
        config.options.dataColors = extendPalette(colorBlindPalette(), colorCount);
      }
      return config;
    }

    if (opts.autoStrokeColor && !config.options.strokeColor) {
      config.options.strokeColor = resolveTextColor(svg);
    }

    if (opts.autoBackgroundColor && !config.options.backgroundColor) {
      config.options.backgroundColor = resolveBackground(svg);
    }

    if (opts.autoFontFamily && !config.options.fontFamily) {
      config.options.fontFamily = getCssVar('--tblr-font-sans-serif', svg)
        || getCssVar('--bs-font-sans-serif', svg)
        || 'Comic Sans MS, Comic Sans, cursive';
    }

    if ((!config.options.dataColors || !config.options.dataColors.length) && (opts.autoColors || a11y.colorBlind)) {
      config.options.dataColors = extendPalette(getPalette(svg, a11y), colorCount);
    }

    return config;
  }

  function clearSvg(svg) {
    try {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    } catch (_e) {
      try { svg.innerHTML = ''; } catch (_e2) { }
    }
  }

  function isVisible(svg) {
    try {
      if (!svg) return false;
      var parent = svg.parentElement;
      var rect = svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
      var ownWidth = rect && rect.width ? rect.width : svg.clientWidth;
      var parentWidth = parent ? parent.clientWidth : 0;
      return (ownWidth > 0 || parentWidth > 0) && (!svg.getClientRects || svg.getClientRects().length > 0);
    } catch (_e) {
      return true;
    }
  }

  function syncMeasuredHeight(svg, entry) {
    try {
      if (entry && entry.explicitHeight) return;
      var height = svg && svg.getAttribute ? svg.getAttribute('height') : '';
      if (!height) return;
      var numeric = parseFloat(height);
      if (!isFinite(numeric) || numeric <= 0) return;
      svg.style.height = numeric + 'px';
      svg.setAttribute('data-hfx-chart-xkcd-measured-height', String(numeric));
    } catch (_e) { }
  }

  function getExplicitHeight(entry) {
    try {
      if (!entry || !entry.explicitHeight || !entry.explicitHeightValue) return null;
      var height = parseFloat(entry.explicitHeightValue);
      return isFinite(height) && height > 0 ? height : null;
    } catch (_e) {
      return null;
    }
  }

  function restoreExplicitHeight(svg, entry) {
    try {
      var height = getExplicitHeight(entry);
      if (!height) return;
      svg.setAttribute('height', String(height));
      svg.style.height = height + 'px';
      svg.setAttribute('data-hfx-chart-xkcd-explicit-height', String(height));
    } catch (_e) { }
  }

  function withExplicitHeight(svg, entry, callback) {
    var height = getExplicitHeight(entry);
    if (!height || !svg || typeof svg.setAttribute !== 'function') return callback();

    var originalSetAttribute = svg.setAttribute;
    svg.setAttribute = function (name, value) {
      if (String(name).toLowerCase() === 'height') {
        return originalSetAttribute.call(svg, name, String(height));
      }

      return originalSetAttribute.call(svg, name, value);
    };

    try {
      return callback();
    } finally {
      svg.setAttribute = originalSetAttribute;
    }
  }

  function getContainerWidth(svg) {
    try {
      if (!svg) return 0;
      var parent = svg.parentElement;
      var rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
      var width = rect && rect.width ? rect.width : parent ? parent.clientWidth : 0;
      if (!width && svg.getBoundingClientRect) {
        rect = svg.getBoundingClientRect();
        width = rect && rect.width ? rect.width : svg.clientWidth;
      }
      return width || 0;
    } catch (_e) {
      return 0;
    }
  }

  function rememberContainerWidth(svg, entry) {
    try {
      var width = getContainerWidth(svg);
      if (width > 0) entry.lastContainerWidth = width;
    } catch (_e) { }
  }

  function hasContainerWidthChanged(svg, entry) {
    try {
      var width = getContainerWidth(svg);
      if (width <= 0) return false;
      if (!entry.instance) {
        entry.lastContainerWidth = width;
        return true;
      }
      if (!entry.lastContainerWidth) {
        entry.lastContainerWidth = width;
        return false;
      }
      return Math.abs(width - entry.lastContainerWidth) > 1;
    } catch (_e) {
      return true;
    }
  }

  function render(entry) {
    try {
      var svg = getById(entry.svgId);
      if (!svg || !window.chartXkcd) return;
      var ctor = window.chartXkcd[entry.chartType];
      if (typeof ctor !== 'function') return;
      clearSvg(svg);
      var config = applyTheme(svg, clone(entry.config), entry);
      var instance = withExplicitHeight(svg, entry, function () { return new ctor(svg, config); });
      entry.instance = instance;
      restoreExplicitHeight(svg, entry);
      syncMeasuredHeight(svg, entry);
      rememberContainerWidth(svg, entry);
      try { svg.setAttribute('data-hfx-chart-xkcd-init', '1'); } catch (_m) { }
    } catch (_e) { }
  }

  function renderWhenVisible(entry) {
    try {
      var svg = getById(entry.svgId);
      if (!svg) return;
      if (entry.lazyInit && !entry.instance && window.htmlForgeXWhenVisible) {
        if (entry.visibleRenderPending) return;
        entry.visibleRenderPending = true;
        window.htmlForgeXWhenVisible(svg, function () {
          entry.visibleRenderPending = false;
          render(entry);
        });
        return;
      }

      if (isVisible(svg) || !window.htmlForgeXWhenVisible) {
        render(entry);
        return;
      }

      if (entry.visibleRenderPending) return;
      entry.visibleRenderPending = true;
      window.htmlForgeXWhenVisible(svg, function () {
        entry.visibleRenderPending = false;
        render(entry);
      });
    } catch (_e) {
      render(entry);
    }
  }

  function init(opts) {
    opts = opts || {};
    if (!opts.svgId) return false;
    registry[opts.svgId] = opts;

    var svg = getById(opts.svgId);
    if (!svg) return false;
    observeResize(opts);

    if (opts.lazyInit && window.htmlForgeXWhenVisible) {
      renderWhenVisible(opts);
      return true;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { renderWhenVisible(opts); });
    } else {
      renderWhenVisible(opts);
    }
    return true;
  }

  function scheduleEntryResize(entry) {
    try {
      if (!entry || entry.resizeRenderPending) return;
      entry.resizeRenderPending = true;
      var run = function () {
        entry.resizeRenderPending = false;
        var svg = getById(entry.svgId);
        if (!svg || !hasContainerWidthChanged(svg, entry)) return;
        renderWhenVisible(entry);
      };

      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(run);
        });
      } else {
        setTimeout(run, 50);
      }
    } catch (_e) {
      renderWhenVisible(entry);
    }
  }

  function observeResize(entry) {
    try {
      if (!entry || entry.resizeObserved) return;
      var svg = getById(entry.svgId);
      if (!svg) return;
      var target = svg.parentElement || svg;
      entry.resizeObserved = true;

      if (window.ResizeObserver) {
        entry.resizeObserver = new ResizeObserver(function () {
          scheduleEntryResize(entry);
        });
        entry.resizeObserver.observe(target);
      }
    } catch (_e) { }
  }

  function rerenderAll() {
    try {
      for (var id in registry) {
        if (!Object.prototype.hasOwnProperty.call(registry, id)) continue;
        if (registry[id] && registry[id].followTheme) renderWhenVisible(registry[id]);
      }
    } catch (_e) { }
  }

  function resizeAll() {
    try {
      for (var id in registry) {
        if (!Object.prototype.hasOwnProperty.call(registry, id)) continue;
        scheduleEntryResize(registry[id]);
      }
    } catch (_e) { }
  }

  function scheduleRerenderAll() {
    try {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(rerenderAll);
        });
      } else {
        setTimeout(rerenderAll, 0);
      }
    } catch (_e) {
      rerenderAll();
    }
  }

  function scheduleResizeAll() {
    try {
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(resizeAll);
        });
      } else {
        setTimeout(resizeAll, 50);
      }
    } catch (_e) {
      resizeAll();
    }
  }

  try {
    window.addEventListener('hfx:themechange', scheduleRerenderAll);
    window.addEventListener('hfx:a11ychange', scheduleRerenderAll);
    window.addEventListener('hfx:operational-workspace-theme-change', scheduleRerenderAll);
    window.addEventListener('resize', scheduleResizeAll);
  } catch (_e) { }

  window.hfxChartXkcd = {
    init: init,
    rerenderAll: rerenderAll,
    resizeAll: resizeAll
  };
})();
