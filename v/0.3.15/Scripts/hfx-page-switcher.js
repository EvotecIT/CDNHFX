(function () {
  'use strict';

  function initSwitcher(el) {
    if (!el || el.__hfx_page_switcher_init) return;
    el.__hfx_page_switcher_init = true;

    var pageSelector = el.getAttribute('data-hfx-page-selector') || '.layout-page';
    var navLinkSelector = el.getAttribute('data-hfx-nav-link-selector') || '.nav-link';
    var updateNav = (el.getAttribute('data-hfx-update-navigation') || 'true').toLowerCase() !== 'false';
    var defaultPageId = el.getAttribute('data-hfx-default-page') || '';

    function getPages() {
      try { return document.querySelectorAll(pageSelector); } catch (e) { return []; }
    }

    function showPageById(pageId) {
      if (!pageId) return false;
      var target = document.getElementById(pageId);
      if (!target) return false;
      try {
        if (!target.matches(pageSelector)) return false;
      } catch (e) {
        // fallback for simple class selectors
        if (pageSelector.charAt(0) === '.' && !target.classList.contains(pageSelector.substring(1))) return false;
      }

      var pages = getPages();
      for (var i = 0; i < pages.length; i++) {
        pages[i].style.display = 'none';
      }
      target.style.display = 'block';
      return true;
    }

    // initial visibility
    var initial = defaultPageId;
    if (!initial && window.location && window.location.hash) {
      initial = window.location.hash.substring(1);
    }
    if (!showPageById(initial)) {
      var pages = getPages();
      if (pages.length > 0) {
        pages[0].style.display = 'block';
        for (var j = 1; j < pages.length; j++) pages[j].style.display = 'none';
      }
    }

    // bind clicks on internal anchors
    var links = document.querySelectorAll("a[href^='#']");
    for (var k = 0; k < links.length; k++) {
      var link = links[k];
      if (link.__hfx_page_switcher_bound) continue;
      link.__hfx_page_switcher_bound = true;

      link.addEventListener('click', function (e) {
        var href = this.getAttribute('href') || '';
        if (!href || href.charAt(0) !== '#') return;
        var targetId = href.substring(1);
        if (!showPageById(targetId)) return;

        e.preventDefault();

        if (updateNav) {
          try {
            var navs = document.querySelectorAll(navLinkSelector);
            for (var i2 = 0; i2 < navs.length; i2++) {
              navs[i2].classList.remove('active');
            }
          } catch (e2) {
            // swallow
          }
          this.classList.add('active');
        }
      });
    }
  }

  function initPageSwitchers(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;

      var nodes = root.querySelectorAll('[data-hfx-page-switcher]');
      for (var i = 0; i < nodes.length; i++) {
        initSwitcher(nodes[i]);
      }
    } catch (e) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. HTMX or client-side injected fragments)
  window.hfxInitPageSwitchers = initPageSwitchers;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initPageSwitchers(document); });
  } else {
    initPageSwitchers(document);
  }
})();

