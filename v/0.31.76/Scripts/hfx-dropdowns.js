// HtmlForgeX dropdown bootstrapper.
// Ensures dropdown toggles are initialized even when Tabler/Bootstrap JS loads in <head>.
(function () {
  'use strict';

  function resolveBootstrapDropdown() {
    try {
      if (window.bootstrap && window.bootstrap.Dropdown) return window.bootstrap.Dropdown;
    } catch (_e) { /* ignore */ }
    try {
      if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) return bootstrap.Dropdown;
    } catch (_e2) { /* ignore */ }
    return null;
  }

  function getDropdownContainer(toggle) {
    try {
      return toggle ? toggle.closest('.dropdown, .dropup, .dropstart, .dropend') : null;
    } catch (_e) {
      return null;
    }
  }

  function getDropdownMenu(toggle) {
    try {
      var parent = getDropdownContainer(toggle);
      if (!parent) return null;
      return parent.querySelector('.dropdown-menu');
    } catch (_e) {
      return null;
    }
  }

  // Fixed menus escape rounded cards and nested scrolling/clipping surfaces.
  // Keep the menu in its logical subtree so theme islands, focus and public
  // component anatomy continue to apply without a detached overlay copy.
  function hasClippingAncestor(toggle) {
    for (var node = toggle && toggle.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      var css = getComputedStyle(node);
      if (/hidden|clip|auto|scroll/.test(css.overflowX + ' ' + css.overflowY)) return true;
    }
    return false;
  }

  function dropdownInstance(Dropdown, toggle) {
    if (!hasClippingAncestor(toggle)) return Dropdown.getOrCreateInstance(toggle);
    return Dropdown.getOrCreateInstance(toggle, {
      popperConfig: function (config) { return Object.assign({}, config, { strategy: 'fixed' }); }
    });
  }

  var fixedFallbacks = new WeakMap();
  var fixedProperties = ['position', 'left', 'right', 'top', 'bottom', 'transform', 'maxWidth', 'maxHeight', 'overflowY', 'margin'];
  function releaseFixedFallback(menu) {
    var saved = fixedFallbacks.get(menu);
    if (!saved) return;
    fixedProperties.forEach(function (key) { menu.style[key] = saved.styles[key]; });
    fixedFallbacks.delete(menu);
  }

  function positionFixedFallback(toggle, menu) {
    if (!fixedFallbacks.has(menu)) {
      var styles = {};
      fixedProperties.forEach(function (key) { styles[key] = menu.style[key]; });
      fixedFallbacks.set(menu, { toggle: toggle, styles: styles });
    }
    var width = document.documentElement.clientWidth;
    var height = document.documentElement.clientHeight;
    var style = menu.style;
    style.position = 'fixed'; style.transform = 'none'; style.margin = '0';
    style.right = 'auto'; style.bottom = 'auto';
    style.maxWidth = width + 'px'; style.maxHeight = height + 'px'; style.overflowY = 'auto';
    var anchor = toggle.getBoundingClientRect();
    var box = menu.getBoundingClientRect();
    var parent = getDropdownContainer(toggle);
    var up = parent && parent.classList.contains('dropup');
    var left = menu.classList.contains('dropdown-menu-end') ? anchor.right - box.width : anchor.left;
    var top = anchor.bottom;
    if (parent && parent.classList.contains('dropend')) { left = anchor.right; top = anchor.top; }
    else if (parent && parent.classList.contains('dropstart')) { left = anchor.left - box.width; top = anchor.top; }
    else if (up || (box.height > height - anchor.bottom && anchor.top > height - anchor.bottom)) top = anchor.top - box.height;
    style.left = Math.max(0, Math.min(left, width - box.width)) + 'px';
    style.top = Math.max(0, Math.min(top, height - box.height)) + 'px';
  }

  function ensureStaticPosition(menu) {
    try {
      if (!menu) return;
      if (!menu.getAttribute('data-bs-popper')) {
        menu.setAttribute('data-bs-popper', 'static');
      }
    } catch (_e) { /* ignore */ }
  }

  function adjustMenuToViewport(toggle, menu, fallback) {
    try {
      if (!menu) return;
      if (hasClippingAncestor(toggle)) {
        // Popper owns native fixed positioning. Only the no-Popper fallback
        // needs explicit viewport coordinates; percentages would use the card.
        if (fallback) positionFixedFallback(toggle, menu);
        return;
      }
      var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      var toggleRect = toggle ? toggle.getBoundingClientRect() : menu.getBoundingClientRect();
      var menuRect = menu.getBoundingClientRect();
      var style = menu.style || {};

      style.left = '';
      style.right = '';
      style.top = '';
      style.bottom = '';

      var spaceBelow = vh - toggleRect.bottom;
      var spaceAbove = toggleRect.top;
      var preferUp = !!(toggle && toggle.closest && toggle.closest('.hfx-collection-card-actions'));
      var openUp = preferUp || (menuRect.height > spaceBelow && spaceAbove > spaceBelow);
      if (openUp) {
        style.top = 'auto';
        style.bottom = '100%';
      } else {
        style.top = '100%';
        style.bottom = 'auto';
      }

      var spaceRight = vw - toggleRect.right;
      var spaceLeft = toggleRect.left;
      var preferEnd = menu.classList.contains('dropdown-menu-end');
      var alignRight = preferEnd ? (menuRect.width > spaceRight && spaceLeft > spaceRight) : (menuRect.width > spaceRight);
      if (alignRight) {
        style.right = '0';
        style.left = 'auto';
      } else {
        style.left = '0';
        style.right = 'auto';
      }
    } catch (_e) { /* ignore */ }
  }

  function closeAllDropdowns() {
    try {
      var openMenus = document.querySelectorAll('.dropdown-menu.show');
      for (var i = 0; i < openMenus.length; i++) {
        try {
          openMenus[i].classList.remove('show');
          releaseFixedFallback(openMenus[i]);
          var parent = openMenus[i].closest('.dropdown, .dropup, .dropstart, .dropend');
          if (parent) parent.classList.remove('show');
        } catch (_e) { /* ignore */ }
      }
      var openToggles = document.querySelectorAll('[data-bs-toggle="dropdown"].show');
      for (var t = 0; t < openToggles.length; t++) {
        try {
          openToggles[t].classList.remove('show');
          openToggles[t].setAttribute('aria-expanded', 'false');
        } catch (_e2) { /* ignore */ }
      }
    } catch (_e3) { /* ignore */ }
  }

  function fallbackToggle(toggle) {
    var menu = getDropdownMenu(toggle);
    if (!menu) return;
    ensureStaticPosition(menu);
    var isOpen = menu.classList.contains('show');
    closeAllDropdowns();
    if (isOpen) return;
    try {
      menu.classList.add('show');
      toggle.classList.add('show');
      toggle.setAttribute('aria-expanded', 'true');
      var parent = getDropdownContainer(toggle);
      if (parent) parent.classList.add('show');
      adjustMenuToViewport(toggle, menu, true);
    } catch (_e) { /* ignore */ }
  }

  function fallbackClose(toggle) {
    var menu = getDropdownMenu(toggle);
    try {
      if (menu) {
        menu.classList.remove('show');
        releaseFixedFallback(menu);
      }
      if (toggle) {
        toggle.classList.remove('show');
        toggle.setAttribute('aria-expanded', 'false');
      }
      var parent = getDropdownContainer(toggle);
      if (parent) {
        parent.classList.remove('show');
      }
    } catch (_e) { /* ignore */ }
  }

  function bindToggle(toggle) {
    if (!toggle || toggle.__hfxDropdownBound) return;
    toggle.__hfxDropdownBound = true;

    toggle.addEventListener('click', function (e) {
      var menu = getDropdownMenu(toggle);
      var isHeaderUtilityToggle = !!(toggle.classList && toggle.classList.contains('hfx-header-utility-link--dropdown'));

      try {
        var Dropdown = resolveBootstrapDropdown();
        if (Dropdown && Dropdown.getOrCreateInstance) {
          if (isHeaderUtilityToggle) {
            if (e) {
              try { e.preventDefault(); } catch (_e0) { /* ignore */ }
              try { e.stopPropagation(); } catch (_e1) { /* ignore */ }
            }

            var instance = dropdownInstance(Dropdown, toggle);
            var before = menu && menu.classList.contains('show');
            if (before) {
              if (instance && instance.hide) {
                instance.hide();
              }
              if (menu && menu.classList.contains('show')) {
                fallbackClose(toggle);
              }
              return;
            }

            closeAllDropdowns();
            if (instance && instance.show) {
              instance.show();
            }
            if (menu && menu.classList.contains('show')) {
              toggle.classList.add('show');
              toggle.setAttribute('aria-expanded', 'true');
              ensureStaticPosition(menu);
              adjustMenuToViewport(toggle, menu);
            } else {
              fallbackToggle(toggle);
            }
            return;
          }

          // Allow Bootstrap to handle, but verify it opens; if not, fallback.
          var before = menu && menu.classList.contains('show');
          setTimeout(function () {
            try {
              var after = menu && menu.classList.contains('show');
              if (before) {
                if (after) {
                  var instance = dropdownInstance(Dropdown, toggle);
                  if (instance && instance.hide) {
                    instance.hide();
                  }
                  if (menu && menu.classList.contains('show')) {
                    fallbackClose(toggle);
                  }
                }
              } else if (after) {
                toggle.classList.add('show');
                toggle.setAttribute('aria-expanded', 'true');
                ensureStaticPosition(menu);
                adjustMenuToViewport(toggle, menu);
              } else if (menu) {
                fallbackToggle(toggle);
              }
            } catch (_e2) { /* ignore */ }
          }, 0);
          return;
        }
      } catch (_e) { /* ignore */ }

      if (e) {
        try { e.preventDefault(); } catch (_e3) { /* ignore */ }
        try { e.stopPropagation(); } catch (_e4) { /* ignore */ }
      }
      fallbackToggle(toggle);
    });
  }

  function initDropdowns(root) {
    try {
      if (!root || !root.querySelectorAll) return false;
      var toggles = root.querySelectorAll('[data-bs-toggle="dropdown"]');
      for (var i = 0; i < toggles.length; i++) {
        bindToggle(toggles[i]);
      }
      // Bootstrap instances are still created if available.
      var Dropdown = resolveBootstrapDropdown();
      if (Dropdown && Dropdown.getOrCreateInstance) {
        for (var j = 0; j < toggles.length; j++) {
          try { dropdownInstance(Dropdown, toggles[j]); } catch (_e5) { /* ignore */ }
        }
      }
      return true;
    } catch (_e6) {
      return false;
    }
  }

  function bindGlobalClose() {
    if (document.__hfxDropdownGlobalClose) return;
    document.__hfxDropdownGlobalClose = true;
    function repositionFallbacks() {
      document.querySelectorAll('.dropdown-menu.show').forEach(function (menu) {
        var saved = fixedFallbacks.get(menu);
        if (saved) positionFixedFallback(saved.toggle, menu);
      });
    }
    window.addEventListener('resize', repositionFallbacks);
    document.addEventListener('scroll', repositionFallbacks, true);
    document.addEventListener('click', function (e) {
      try {
        var target = e && e.target ? e.target : null;
        if (target && target.closest && target.closest('.dropdown, .dropup, .dropstart, .dropend')) return;
        closeAllDropdowns();
      } catch (_e) { /* ignore */ }
    });
    document.addEventListener('keydown', function (e) {
      try {
        if (e && e.key === 'Escape') closeAllDropdowns();
      } catch (_e2) { /* ignore */ }
    });
  }

  function initWithRetry(attempt) {
    var ok = initDropdowns(document);
    bindGlobalClose();
    if (ok) return;
    if (attempt >= 5) return;
    setTimeout(function () { initWithRetry(attempt + 1); }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initWithRetry(0); });
  } else {
    initWithRetry(0);
  }

  // Expose for dynamic content (HTMX/SPA)
  try {
    window.hfxInitDropdowns = function (root) { initDropdowns(root || document); };
  } catch (_e7) { /* ignore */ }
})();
