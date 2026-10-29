(function () {
  'use strict';
  var current = null;
  var saved = [];
  var controlImages = ['--hfx-control-check-image', '--hfx-control-radio-image'];
  var properties = ['--hfx-color-accent', '--hfx-color-accent-contrast', '--hfx-color-surface'];
  function hex(value) {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Brand colours must use #rrggbb.');
    return value;
  }
  function rgb(value) {
    var probe = document.createElement('span'); probe.style.color = value; document.documentElement.appendChild(probe);
    var computed = getComputedStyle(probe).color; probe.remove();
    var channels = computed.match(/[\d.]+/g).map(Number);
    if (computed.indexOf('color(') === 0) channels = channels.map(function (n) { return n * 255; });
    return channels.slice(0, 3);
  }
  function luminance(value) {
    var c = rgb(value).map(function (n) { n /= 255; return n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  function contrast(a, b) { a = luminance(a); b = luminance(b); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }
  function clear() {
    saved.forEach(function (entry) {
      entry.values.forEach(function (value) {
        if (value[1]) entry.element.style.setProperty(value[0], value[1], value[2]);
        else entry.element.style.removeProperty(value[0]);
      });
    });
    saved = [];
    document.querySelectorAll('[data-hfx-brand-logo]').forEach(function (img) {
      if (img.dataset.hfxBrandOriginalLogo !== undefined) img.setAttribute('src', img.dataset.hfxBrandOriginalLogo);
    });
  }
  function apply(brand) {
    clear();
    if (!brand) { current = null; return true; }
    try {
      if (typeof brand === 'string') {
        var brands = window.HfxThemeRegistry && window.HfxThemeRegistry.registry.brands;
        brand = brands && brands.find(function (entry) { return entry.id === brand; });
        if (!brand) throw new Error('Unknown brand id.');
      }
      var allowed = ['id', 'accent', 'accentContrast', 'logo', 'surfaceTint'];
      Object.keys(brand).forEach(function (key) { if (allowed.indexOf(key) < 0) throw new Error('Unsupported brand role: ' + key); });
      var accent = hex(brand.accent), ink = hex(brand.accentContrast);
      var roles = getComputedStyle(document.documentElement);
      var surface = brand.surfaceTint ? hex(brand.surfaceTint) : roles.getPropertyValue('--hfx-color-surface').trim();
      if (contrast(accent, ink) < 4.5 || contrast(accent, surface) < 3 ||
          contrast(roles.getPropertyValue('--hfx-color-text'), surface) < 4.5 ||
          contrast(roles.getPropertyValue('--hfx-color-text-muted'), surface) < 4.5) throw new Error('Brand failed contrast validation.');
      if (brand.logo) {
        var url = new URL(brand.logo, location.href);
        if (!(/^(\/(?!\/)|https:\/\/)/.test(brand.logo)) || (url.protocol !== 'https:' && url.origin !== location.origin) || url.username || url.password) throw new Error('Invalid brand logo URL.');
      }
      var targets = document.querySelectorAll(':root, body, [data-hfx-style], [data-hfx-product], [data-hfx-theme], [data-hfx-mode], [data-hfx-tokens], [data-bs-theme]');
      targets.forEach(function (target) {
        var local = getComputedStyle(target), card = brand.surfaceTint || local.getPropertyValue('--hfx-color-surface');
        if (contrast(accent, card) < 3 || contrast(local.getPropertyValue('--hfx-color-text'), card) < 4.5 ||
            contrast(local.getPropertyValue('--hfx-color-text-muted'), card) < 4.5) throw new Error('Brand failed local surface contrast validation.');
      });
      targets.forEach(function (target) {
        var style = target.style, values = [];
        properties.forEach(function (p) { [p, p + '-rgb'].forEach(function (name) { values.push([name, style.getPropertyValue(name), style.getPropertyPriority(name)]); }); });
        controlImages.forEach(function (name) { values.push([name, style.getPropertyValue(name), style.getPropertyPriority(name)]); });
        saved.push({ element: target, values: values });
        style.setProperty(properties[0], accent); style.setProperty(properties[1], ink);
        style.setProperty(properties[0] + '-rgb', rgb(accent).join(', '));
        style.setProperty(properties[1] + '-rgb', rgb(ink).join(', '));
        var svg = function (shape) { return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 16 16\'%3E' + shape + '%3C/svg%3E")'; };
        var imageInk = encodeURIComponent(ink);
        style.setProperty(controlImages[0], svg("%3Cpath fill='none' stroke='" + imageInk + "' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m4 8 3 3 5-6'/%3E"));
        style.setProperty(controlImages[1], svg("%3Ccircle fill='" + imageInk + "' cx='8' cy='8' r='3'/%3E"));
        if (brand.surfaceTint) { style.setProperty(properties[2], surface); style.setProperty(properties[2] + '-rgb', rgb(surface).join(', ')); }
      });
      if (brand.logo) document.querySelectorAll('[data-hfx-brand-logo]').forEach(function (img) {
        if (img.dataset.hfxBrandOriginalLogo === undefined) img.dataset.hfxBrandOriginalLogo = img.getAttribute('src') || '';
        img.setAttribute('src', brand.logo);
      });
      current = Object.assign({}, brand); return true;
    } catch (error) {
      current = null; clear(); console.warn('HtmlForgeX: ' + error.message + ' Using the default theme.'); return false;
    }
  }
  window.HfxBrand = { apply: apply, clear: function () { return apply(null); } };
  window.addEventListener('hfx:themechange', function () { if (current) apply(current); });
  window.addEventListener('hfx:a11ychange', function () { if (current) apply(current); });
  function initial() {
    var data = document.querySelector('script[data-hfx-brand]');
    if (!data) return;
    try { apply(JSON.parse(data.textContent)); }
    catch (_error) { console.warn('HtmlForgeX: Invalid brand data. Using the default theme.'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initial);
  else initial();
})();
