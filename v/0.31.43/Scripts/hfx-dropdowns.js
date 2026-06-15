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

  function ensureStaticPosition(menu) {
    try {
      if (!menu) return;
      if (!menu.getAttribute('data-bs-popper')) {
        menu.setAttribute('data-bs-popper', 'static');
      }
    } catch (_e) { /* ignore */ }
  }

  function adjustMenuToViewport(toggle, menu) {
    try {
      if (!menu) return;
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
      adjustMenuToViewport(toggle, menu);
    } catch (_e) { /* ignore */ }
  }

  function fallbackClose(toggle) {
    var menu = getDropdownMenu(toggle);
    try {
      if (menu) {
        menu.classList.remove('show');
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

            var instance = Dropdown.getOrCreateInstance(toggle);
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
                  var instance = Dropdown.getOrCreateInstance(toggle);
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
          try { Dropdown.getOrCreateInstance(toggles[j]); } catch (_e5) { /* ignore */ }
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
