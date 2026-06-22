(function () {
  'use strict';

  function clamp(value, min, max) {
    value = Number(value);
    if (!isFinite(value)) value = 100;
    return Math.max(min, Math.min(max, value));
  }

  function setZoom(map, percent) {
    if (!map) return;
    var zoom = clamp(percent, 60, 140);
    var canvas = map.querySelector('.hfx-service-config-map__canvas');
    var label = map.querySelector('[data-hfx-service-config-map-zoom-label]');
    map.setAttribute('data-hfx-service-config-map-zoom', String(zoom));
    if (canvas) canvas.style.setProperty('--hfx-service-config-map-scale', String(zoom / 100));
    if (label) label.textContent = String(zoom) + '%';
  }

  function fitMap(map) {
    if (!map) return;
    var viewport = map.querySelector('.hfx-service-config-map__viewport');
    var canvas = map.querySelector('.hfx-service-config-map__canvas');
    if (!viewport || !canvas) {
      setZoom(map, 100);
      return;
    }

    var current = clamp(map.getAttribute('data-hfx-service-config-map-zoom'), 60, 140) / 100;
    var naturalWidth = canvas.scrollWidth / current;
    var next = naturalWidth > 0 ? Math.floor((viewport.clientWidth / naturalWidth) * 100) : 100;
    setZoom(map, Math.min(100, next));
    viewport.scrollLeft = 0;
  }

  function selectMapNode(map, key) {
    if (!map || !key) return;
    map.setAttribute('data-hfx-service-config-map-active-node', key);

    var nodes = map.querySelectorAll('[data-hfx-service-config-map-node-key]');
    for (var i = 0; i < nodes.length; i++) {
      var selected = nodes[i].getAttribute('data-hfx-service-config-map-node-key') === key;
      nodes[i].classList.toggle('is-active', selected);
      nodes[i].setAttribute('aria-pressed', selected ? 'true' : 'false');
    }

    var panels = map.querySelectorAll('[data-hfx-service-config-map-panel]');
    for (var j = 0; j < panels.length; j++) {
      var show = panels[j].getAttribute('data-hfx-service-config-map-panel') === key;
      panels[j].hidden = !show;
    }
  }

  function initMap(map) {
    if (!map || map.__hfx_service_config_map_init) return;
    map.__hfx_service_config_map_init = true;
    setZoom(map, map.getAttribute('data-hfx-service-config-map-zoom') || 100);
    selectMapNode(map, map.getAttribute('data-hfx-service-config-map-active-node'));

    map.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var action = target.closest('[data-hfx-service-config-map-action]');
      if (action && map.contains(action)) {
        event.preventDefault();
        var current = clamp(map.getAttribute('data-hfx-service-config-map-zoom'), 60, 140);
        switch (action.getAttribute('data-hfx-service-config-map-action')) {
          case 'in':
            setZoom(map, current + 10);
            break;
          case 'out':
            setZoom(map, current - 10);
            break;
          case 'reset':
            setZoom(map, 100);
            break;
          case 'fit':
            fitMap(map);
            break;
        }
        return;
      }

      var node = target.closest('[data-hfx-service-config-map-node-key]');
      if (node && map.contains(node)) {
        selectMapNode(map, node.getAttribute('data-hfx-service-config-map-node-key'));
      }
    });

    map.addEventListener('keydown', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var node = target.closest('[data-hfx-service-config-map-node-key]');
      if (!node || !map.contains(node)) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      selectMapNode(map, node.getAttribute('data-hfx-service-config-map-node-key'));
    });
  }

  function init(root) {
    root = root || document;
    var maps = root.querySelectorAll('[data-hfx-service-config-map]');
    for (var i = 0; i < maps.length; i++) initMap(maps[i]);
  }

  window.HfxServiceStudio = window.HfxServiceStudio || {};
  window.HfxServiceStudio.init = init;
  window.HfxServiceStudio.setZoom = setZoom;
  window.HfxServiceStudio.fitMap = fitMap;
  window.HfxServiceStudio.selectMapNode = selectMapNode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
