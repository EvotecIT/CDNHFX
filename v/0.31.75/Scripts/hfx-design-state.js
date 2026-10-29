(function () {
  'use strict';
  // State synchronization is independent of presentation opt-in. The DOM contract
  // remains useful to extensions on pages retaining the legacy CSS.
  function state(node, token, enabled) {
    if (!node) return;
    var tokens = (node.getAttribute('data-state') || '').split(/\s+/).filter(Boolean);
    var next = tokens.filter(function (value) { return value !== token; });
    if (enabled) next.push(token);
    var value = next.join(' ');
    if (node.getAttribute('data-state') !== value) node.setAttribute('data-state', value);
  }
  function sync(node) {
    if (!node.matches || !node.matches('[data-hfx-part]')) return;
    if (node.hasAttribute('aria-selected')) state(node, 'selected', node.getAttribute('aria-selected') === 'true');
    if (node.hasAttribute('aria-expanded')) {
      var expanded = node.getAttribute('aria-expanded') === 'true';
      state(node, 'open', expanded); state(node, 'closed', !expanded);
      // The dropdown bootstrapper also changes aria-expanded on its fallback
      // path, which does not emit Bootstrap's shown/hidden events.
      if (node.getAttribute('data-hfx-part') === 'menu-trigger') dropdownState(node, expanded);
    }
    if ('disabled' in node) state(node, 'disabled', node.disabled);
    if ('checked' in node && (node.type === 'checkbox' || node.type === 'radio')) state(node, 'checked', node.checked);
  }
  function dropdownState(node, opened) {
    var root = node.closest('[data-hfx-part="dropdown"]');
    if (!root) return;
    state(root, 'open', opened); state(root, 'closed', !opened);
    root.querySelectorAll('[data-hfx-part="menu"], [data-hfx-part="menu-trigger"]').forEach(function (part) {
      if (part.closest('[data-hfx-part="dropdown"]') !== root) return;
      state(part, 'open', opened); state(part, 'closed', !opened);
    });
  }
  function density(scope) {
    scope.querySelectorAll('[data-density]').forEach(function (node) {
      var island = node.closest('[data-hfx-density]');
      if (island) node.setAttribute('data-density', island.getAttribute('data-hfx-density'));
    });
  }
  function overlay(event, opened) {
    var node = event.target;
    if (!node || !node.matches) return;
    if (event.type.indexOf('.tab') !== -1) {
      var tabs = node.closest('[data-hfx-part="tabs"]');
      if (tabs) tabs.querySelectorAll('[data-hfx-part="tab"]').forEach(function (tab) {
        var selected = tab.getAttribute('aria-selected') === 'true';
        state(tab, 'selected', selected);
        var panelId = tab.getAttribute('aria-controls');
        state(panelId && document.getElementById(panelId), 'selected', selected);
      });
      return;
    }
    dropdownState(node, opened);
    state(node, 'open', opened); state(node, 'closed', !opened);
    var item = node.closest('[data-hfx-part="accordion-item"]');
    if (item) { state(item, 'open', opened); state(item, 'closed', !opened); }
  }
  function initialize() {
    document.querySelectorAll('[data-hfx-part]').forEach(sync);
    density(document);
    document.addEventListener('change', function (event) { sync(event.target); });
    ['modal', 'offcanvas', 'dropdown', 'popover', 'tooltip', 'collapse', 'tab'].forEach(function (kind) {
      document.addEventListener('shown.bs.' + kind, function (event) { overlay(event, true); });
      document.addEventListener('hidden.bs.' + kind, function (event) { overlay(event, false); });
    });
    new MutationObserver(function (changes) {
      changes.forEach(function (change) {
        if (change.attributeName === 'data-hfx-density') density(change.target);
        else sync(change.target);
      });
    }).observe(document.documentElement, {
      subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-expanded', 'disabled', 'checked', 'data-hfx-density']
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}());
