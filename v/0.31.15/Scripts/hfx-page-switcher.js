(function () {
  'use strict';

  function initSwitcher(el) {
    if (!el || el.__hfx_page_switcher_init) return;
    el.__hfx_page_switcher_init = true;

    var pageSelector = el.getAttribute('data-hfx-page-selector') || '.layout-page';
    var navLinkSelector = el.getAttribute('data-hfx-nav-link-selector') || '.nav-link';
    var updateNav = (el.getAttribute('data-hfx-update-navigation') || 'true').toLowerCase() !== 'false';
    var defaultPageId = el.getAttribute('data-hfx-default-page') || '';
    var defaultDocumentTitle = document.title || '';

    function getPages() {
      try { return document.querySelectorAll(pageSelector); } catch (e) { return []; }
    }

    function clearActiveNavigation() {
      if (!updateNav) return;
      try {
        var navs = document.querySelectorAll(navLinkSelector + ', .dropdown-item');
        for (var i = 0; i < navs.length; i++) {
          navs[i].classList.remove('active');
          navs[i].removeAttribute('aria-current');
        }
      } catch (e) {
        // swallow
      }
    }

    function markLinkActive(link) {
      if (!link) return;

      link.classList.add('active');
      link.setAttribute('aria-current', 'page');

      var node = link.parentElement;
      while (node && node !== document.body) {
        if (node.classList && (node.classList.contains('dropdown') || node.classList.contains('dropend'))) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            if (child && child.tagName === 'A' && child.classList.contains('dropdown-toggle')) {
              child.classList.add('active');
              child.setAttribute('aria-current', 'page');
              break;
            }
          }
        }
        node = node.parentElement;
      }
    }

    function syncNavigationForPage(pageId, clickedLink) {
      if (!updateNav || !pageId) return;

      clearActiveNavigation();

      if (clickedLink) {
        markLinkActive(clickedLink);
        return;
      }

      try {
        var links = document.querySelectorAll("a[href^='#']");
        var matched = false;
        for (var i = 0; i < links.length; i++) {
          var candidate = links[i];
          var href = candidate.getAttribute('href') || '';
          if (href.substring(1) !== pageId) continue;
          if (!candidate.classList || (!candidate.classList.contains('nav-link') && !candidate.classList.contains('dropdown-item'))) {
            continue;
          }

          markLinkActive(candidate);
          matched = true;
        }

        if (matched) {
          return;
        }

        for (var j = 0; j < links.length; j++) {
          var fallback = links[j];
          var fallbackHref = fallback.getAttribute('href') || '';
          if (fallbackHref.substring(1) === pageId) {
            markLinkActive(fallback);
            return;
          }
        }
      } catch (e) {
        // swallow
      }
    }

    function notifyPageVisible(pageId, target) {
      if (!target) return;

      try {
        var detail = { pageId: pageId || '', pageElement: target };
        if (typeof CustomEvent === 'function') {
          var evt = new CustomEvent('hfx:page-activated', { detail: detail });
          target.dispatchEvent(evt);
          document.dispatchEvent(new CustomEvent('hfx:page-activated', { detail: detail }));
        }
      } catch (e) {
        // swallow
      }

      function refresh() {
        try {
          if (window.htmlForgeXRefreshVisible) {
            window.htmlForgeXRefreshVisible(target);
          }
        } catch (e2) {
          // swallow
        }
      }

      try {
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(refresh);
        } else {
          refresh();
        }
      } catch (e3) {
        refresh();
      }

      setTimeout(refresh, 240);
      setTimeout(refresh, 600);
    }

    function updateDocumentTitle(target) {
      if (!target) return;

      var pageTitle = target.getAttribute('data-hfx-page-title') || '';
      var pageSubtitle = target.getAttribute('data-hfx-page-subtitle') || '';
      var nextTitle = '';

      if (pageSubtitle && pageTitle) {
        nextTitle = pageTitle + ' - ' + pageSubtitle;
      } else if (pageTitle) {
        nextTitle = pageTitle;
      } else if (pageSubtitle) {
        nextTitle = pageSubtitle;
      } else {
        nextTitle = defaultDocumentTitle;
      }

      if (!nextTitle) return;

      try {
        document.title = nextTitle;
      } catch (e) {
        // swallow
      }
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
      updateDocumentTitle(target);
      notifyPageVisible(pageId, target);
      return true;
    }

    // initial visibility
    var initial = '';
    if (window.location && window.location.hash) {
      initial = window.location.hash.substring(1);
    }
    if (!initial) {
      initial = defaultPageId;
    }
    if (showPageById(initial)) {
      syncNavigationForPage(initial, null);
    } else {
      var pages = getPages();
      if (pages.length > 0) {
        pages[0].style.display = 'block';
        for (var j = 1; j < pages.length; j++) pages[j].style.display = 'none';
        updateDocumentTitle(pages[0]);
        var firstId = pages[0].id || '';
        if (firstId) {
          syncNavigationForPage(firstId, null);
        }
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

        syncNavigationForPage(targetId, this);

        try {
          if (window.location && window.location.hash.substring(1) !== targetId) {
            if (window.history && window.history.pushState) {
              window.history.pushState(null, '', '#' + targetId);
            } else {
              window.location.hash = targetId;
            }
          }
        } catch (e2) {
          // swallow
        }
      });
    }

    if (!el.__hfx_page_switcher_hash_bound) {
      el.__hfx_page_switcher_hash_bound = true;
      window.addEventListener('hashchange', function () {
        var hash = window.location && window.location.hash ? window.location.hash.substring(1) : '';
        if (!hash) return;
        if (showPageById(hash)) {
          syncNavigationForPage(hash, null);
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
