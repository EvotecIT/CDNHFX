// HtmlForgeX deep-link helpers: activate Bootstrap tabs via query string and optionally apply DataTables search.
(function () {
  function norm(s) { return (s || '').toString().toLowerCase().trim(); }
  function bodyAttr(name) {
    try { return document.body && document.body.getAttribute ? document.body.getAttribute(name) : null; } catch (_) { return null; }
  }

  // Only enabled when the body attribute is present
  if (bodyAttr('data-hfx-deeplinks') !== '1') return;

  var tabParamName = bodyAttr('data-hfx-deeplinks-tab-param') || 'tab';
  var subtabParamName = bodyAttr('data-hfx-deeplinks-subtab-param') || 'subtab';

  var searchParamsCsv = bodyAttr('data-hfx-deeplinks-search-params') || '';
  var delayRaw = bodyAttr('data-hfx-deeplinks-search-delay');
  var searchDelayMs = parseInt(delayRaw || '150', 10);
  if (isNaN(searchDelayMs) || searchDelayMs < 0) searchDelayMs = 150;

  var searchRegex = bodyAttr('data-hfx-deeplinks-search-regex') === '1';
  var smartAttr = bodyAttr('data-hfx-deeplinks-search-smart');
  var searchSmart = (smartAttr == null) ? true : (smartAttr === '1');

  var searchKeys = [];
  var stateStore = null;
  try {
    if (searchParamsCsv) {
      searchParamsCsv.split(',').forEach(function (k) {
        k = (k || '').toString().trim();
        if (k) searchKeys.push(k);
      });
    }
  } catch (_) { searchKeys = []; }

  try {
    stateStore = window.hfxState && window.hfxState.store ? window.hfxState.store : null;
  } catch (_) { stateStore = null; }

  function getParam(name) {
    try {
      var u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch (e) {
      try {
        var q = (window.location && window.location.search) ? window.location.search : '';
        if (q && q.charAt(0) === '?') q = q.substring(1);
        if (!q) return null;
        var parts = q.split('&');
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          if (!p) continue;
          var idx = p.indexOf('=');
          var k = idx >= 0 ? p.substring(0, idx) : p;
          var v = idx >= 0 ? p.substring(idx + 1) : '';
          try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch (_e) { }
          if (norm(k) === norm(name)) {
            try { return decodeURIComponent((v || '').replace(/\+/g, ' ')); } catch (_e2) { return v; }
          }
        }
      } catch (_e3) { }
      return null;
    }
  }

  function showTab(trigger) {
    try {
      if (!trigger) return false;
      var Tab = (window.bootstrap && window.bootstrap.Tab) || (typeof bootstrap !== 'undefined' ? bootstrap.Tab : null);
      if (!Tab) return false;
      Tab.getOrCreateInstance(trigger).show();
      return true;
    } catch (_) { return false; }
  }

  function activateTabByTarget(scope, target) {
    try {
      if (!target) return false;
      var root = scope || document;
      var q = '' +
        '[data-bs-toggle=\"tab\"][href=\"' + target + '\"], [data-bs-toggle=\"tab\"][data-bs-target=\"' + target + '\"],' +
        '[data-bs-toggle=\"pill\"][href=\"' + target + '\"], [data-bs-toggle=\"pill\"][data-bs-target=\"' + target + '\"]';
      var a = root.querySelector ? root.querySelector(q) : null;
      return showTab(a);
    } catch (_) { return false; }
  }

  function activateTabByTitleOrKey(scope, value) {
    try {
      value = norm(value);
      if (!value) return false;
      var root = scope || document;
      var links = root.querySelectorAll ? root.querySelectorAll('[data-bs-toggle=tab], [data-bs-toggle=pill]') : [];
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        // Prefer explicit deep-link key when present
        try {
          var key = a.getAttribute && a.getAttribute('data-hfx-tab-key');
          if (key && norm(key) === value) return showTab(a);
        } catch (_k) { }

        // Fallback: match by visible title (TablerTabs emits .tab-title span)
        var tEl = a.querySelector ? a.querySelector('.tab-title') : null;
        var t = norm(tEl ? tEl.textContent : a.textContent);
        if (t === value) return showTab(a);
      }
    } catch (_) { }
    return false;
  }

  function activateTab(scope, rawValue) {
    try {
      rawValue = (rawValue || '').toString().trim();
      if (!rawValue) return false;

      // If the value looks like an id or target, try it first.
      var target = rawValue;
      try {
        if (target.charAt(0) !== '#') {
          // Support ?tab=panelId by converting to #panelId when an element exists.
          if (document.getElementById && document.getElementById(target)) target = '#' + target;
        }
      } catch (_e) { }
      if (target && target.charAt(0) === '#') {
        if (activateTabByTarget(scope, target)) return true;
      }

      // Otherwise, treat as key/title.
      return activateTabByTitleOrKey(scope, rawValue);
    } catch (_) { return false; }
  }

  function buildSearchTerm() {
    try {
      if (!searchKeys || !searchKeys.length) return '';
      var parts = [];
      for (var i = 0; i < searchKeys.length; i++) {
        var v = getParam(searchKeys[i]);
        if (v && norm(v)) parts.push(String(v).trim());
      }
      return parts.join(' ').trim();
    } catch (_) { return ''; }
  }

  function activeScopes() {
    try {
      var panes = document.querySelectorAll ? document.querySelectorAll('.tab-pane.active.show') : [];
      if (panes && panes.length) return panes;
    } catch (_) { }
    return [document];
  }

  function applyDataTableSearch(term) {
    try {
      term = (term || '').toString().trim();
      if (!term) return;
      var $ = window.jQuery || window.$;
      if (!$ || !$.fn || !$.fn.dataTable) return;

      var scopes = activeScopes();
      for (var i = 0; i < scopes.length; i++) {
        var scope = scopes[i] || document;
        var tables = scope.querySelectorAll ? scope.querySelectorAll('table') : [];
        for (var j = 0; j < tables.length; j++) {
          var tbl = tables[j];
          try {
            if (!$.fn.dataTable.isDataTable(tbl)) continue;
            var dt = $(tbl).DataTable();
            if (!dt) continue;
            try {
              var prev = (typeof dt.search === 'function') ? dt.search() : null;
              if (prev === term) continue;
            } catch (_p) { }
            dt.search(term, searchRegex, searchSmart).draw();
          } catch (_e) { }
        }
      }
    } catch (_) { }
  }

  function scheduleApply(term) {
    try {
      setTimeout(function () { applyDataTableSearch(term); }, searchDelayMs);
    } catch (_) { }
  }

  function getBootstrapTabTarget(trigger) {
    try {
      if (!trigger || !trigger.getAttribute) return null;
      var target = trigger.getAttribute('data-bs-target');
      if (target) return target;
      var href = trigger.getAttribute('href');
      return (href && href.charAt(0) === '#') ? href : null;
    } catch (_) { return null; }
  }

  function setTabTriggerState(trigger, active) {
    try {
      if (!trigger || !trigger.classList) return;
      trigger.classList[active ? 'add' : 'remove']('active');
      if (trigger.getAttribute && (trigger.getAttribute('role') || '').toLowerCase() === 'tab') {
        trigger.setAttribute('aria-selected', active ? 'true' : 'false');
        trigger.setAttribute('tabindex', active ? '0' : '-1');
      }
    } catch (_) { }
  }

  function setTabPanelState(panel, active) {
    try {
      if (!panel || !panel.classList) return;
      panel.classList[active ? 'add' : 'remove']('active');
      panel.classList[active ? 'add' : 'remove']('show');
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    } catch (_) { }
  }

  function syncTablistState(tablist) {
    try {
      if (!tablist || !tablist.querySelectorAll) return;
      var triggers = tablist.querySelectorAll('[data-bs-toggle="tab"], [data-bs-toggle="pill"], [data-bs-toggle="list"]');
      if (!triggers || !triggers.length) return;

      var selected = null;
      for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].classList && triggers[i].classList.contains('active')) {
          selected = triggers[i];
          break;
        }
      }

      if (!selected) {
        for (var j = 0; j < triggers.length; j++) {
          if ((triggers[j].getAttribute('aria-selected') || '').toLowerCase() === 'true') {
            selected = triggers[j];
            break;
          }
        }
      }

      if (!selected) {
        for (var k = 0; k < triggers.length; k++) {
          var panelTarget = getBootstrapTabTarget(triggers[k]);
          var panel = panelTarget && document.querySelector ? document.querySelector(panelTarget) : null;
          if (panel && panel.classList && panel.classList.contains('active')) {
            selected = triggers[k];
            break;
          }
        }
      }

      if (!selected) return;

      for (var m = 0; m < triggers.length; m++) {
        var trigger = triggers[m];
        var active = trigger === selected;
        setTabTriggerState(trigger, active);

        var target = getBootstrapTabTarget(trigger);
        var targetPanel = target && document.querySelector ? document.querySelector(target) : null;
        if (targetPanel) {
          setTabPanelState(targetPanel, active);
        }
      }
    } catch (_) { }
  }

  function normalizeBootstrapTabs(root) {
    try {
      var scope = root || document;
      var tablists = [];
      if (scope.matches && scope.matches('[role="tablist"]')) {
        tablists.push(scope);
      }

      if (scope.querySelectorAll) {
        var found = scope.querySelectorAll('[role="tablist"]');
        for (var i = 0; i < found.length; i++) {
          tablists.push(found[i]);
        }
      }

      for (var j = 0; j < tablists.length; j++) {
        syncTablistState(tablists[j]);
      }
    } catch (_) { }
  }

  function getSidebarStateKey(toggle) {
    try {
      if (!toggle || !toggle.getAttribute) return null;
      var explicitKey = toggle.getAttribute('data-hfx-sidebar-key');
      if (explicitKey) return explicitKey;
      var text = '';
      try { text = (toggle.textContent || '').trim(); } catch (_) { text = ''; }
      if (!text) return null;
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    } catch (_) { return null; }
  }

  function getSidebarStorageName(toggle) {
    var key = getSidebarStateKey(toggle);
    return key ? ('hfx.sidebar.' + key) : null;
  }

  function setSidebarOpen(toggle, open) {
    try {
      if (!toggle) return false;
      var parent = toggle.closest ? toggle.closest('.dropdown') : null;
      if (!parent) return false;
      var menu = parent.querySelector ? parent.querySelector('.dropdown-menu') : null;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.classList[open ? 'add' : 'remove']('show');
      parent.classList[open ? 'add' : 'remove']('show');
      if (menu) menu.classList[open ? 'add' : 'remove']('show');
      return true;
    } catch (_) { return false; }
  }

  function persistSidebarToggle(toggle, open) {
    try {
      if (!stateStore) return;
      var storageName = getSidebarStorageName(toggle);
      if (!storageName) return;
      if (open) stateStore.setItem(storageName, '1');
      else stateStore.removeItem(storageName);
    } catch (_) { }
  }

  function hasActiveSidebarChild(toggle) {
    try {
      var parent = toggle && toggle.closest ? toggle.closest('.dropdown') : null;
      if (!parent || !parent.querySelector) return false;
      return !!parent.querySelector('.dropdown-item.active, .dropdown-item[aria-current="page"]');
    } catch (_) { return false; }
  }

  function restoreSidebarDropdowns() {
    try {
      var toggles = document.querySelectorAll ? document.querySelectorAll('aside.navbar-vertical .dropdown-toggle[data-hfx-sidebar-key]') : [];
      for (var i = 0; i < toggles.length; i++) {
        var toggle = toggles[i];
        var shouldOpen = false;
        var canRestoreStoredState = false;
        try {
          var storageName = getSidebarStorageName(toggle);
          canRestoreStoredState = !!(storageName && stateStore);
          if (canRestoreStoredState) {
            var stored = stateStore.getItem(storageName);
            shouldOpen = stored === '1';
          }
        } catch (_) { shouldOpen = false; }
        if (!shouldOpen && hasActiveSidebarChild(toggle)) shouldOpen = true;
        if (!canRestoreStoredState && !shouldOpen) continue;
        setSidebarOpen(toggle, shouldOpen);
      }
    } catch (_) { }
  }

  function isSidebarDropdownEventForToggle(event, toggle) {
    try {
      if (!event || event.target !== toggle) return false;
      var parent = toggle.closest ? toggle.closest('.dropdown') : null;
      var sourceDropdown = event.target && event.target.closest ? event.target.closest('.dropdown') : null;
      if (sourceDropdown !== parent) return false;
      return !event.currentTarget || event.currentTarget === parent;
    } catch (_) { return false; }
  }

  function scheduleSidebarRestore() {
    try { setTimeout(restoreSidebarDropdowns, 0); } catch (_) { }
    try { setTimeout(restoreSidebarDropdowns, 60); } catch (_) { }
  }

  function wireSidebarDropdowns() {
    try {
      var toggles = document.querySelectorAll ? document.querySelectorAll('aside.navbar-vertical .dropdown-toggle[data-hfx-sidebar-key]') : [];
      for (var i = 0; i < toggles.length; i++) {
        (function(toggle) {
          if (!toggle || toggle.__hfxSidebarBound) return;
          toggle.__hfxSidebarBound = true;

          try {
            toggle.addEventListener('click', function () {
              setTimeout(function () {
                try {
                  var expanded = (toggle.getAttribute('aria-expanded') || '').toLowerCase() === 'true';
                  persistSidebarToggle(toggle, expanded);
                  scheduleSidebarRestore();
                } catch (_) { }
              }, 0);
            });
          } catch (_) { }

          try {
            var parent = toggle.closest ? toggle.closest('.dropdown') : null;
            if (parent) {
              parent.addEventListener('shown.bs.dropdown', function (event) {
                if (!isSidebarDropdownEventForToggle(event, toggle)) return;
                persistSidebarToggle(toggle, true);
                scheduleSidebarRestore();
              });
              parent.addEventListener('hidden.bs.dropdown', function (event) {
                if (!isSidebarDropdownEventForToggle(event, toggle)) return;
                persistSidebarToggle(toggle, false);
                scheduleSidebarRestore();
              });
            }
          } catch (_) { }

          try {
            var parentMenu = toggle.closest ? toggle.closest('.dropdown') : null;
            var items = parentMenu && parentMenu.querySelectorAll ? parentMenu.querySelectorAll('.dropdown-item') : [];
            for (var j = 0; j < items.length; j++) {
              items[j].addEventListener('click', scheduleSidebarRestore);
            }
          } catch (_) { }
        })(toggles[i]);
      }
    } catch (_) { }
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      var tab = getParam(tabParamName);
      if (tab) activateTab(document, tab);

      var subtab = getParam(subtabParamName);
      if (subtab) {
        setTimeout(function () {
          try {
            var panes = document.querySelectorAll ? document.querySelectorAll('.tab-pane.active.show') : [];
            for (var i = 0; i < panes.length; i++) {
              if (activateTab(panes[i], subtab)) break;
            }
          } catch (_) { }
        }, 50);
      }

      var term = buildSearchTerm();
      if (term) {
        scheduleApply(term);

        // Re-apply on navigation and deferred initializations.
        try { document.addEventListener('shown.bs.tab', function () { scheduleApply(term); }); } catch (_) { }
        try { document.addEventListener('shown.bs.collapse', function () { scheduleApply(term); }, true); } catch (_) { }

        try {
          var $ = window.jQuery || window.$;
          if ($ && $.fn && $.fn.dataTable) {
            $(document).on('init.dt', function () { scheduleApply(term); });
          }
        } catch (_) { }
      }

      normalizeBootstrapTabs(document);

      wireSidebarDropdowns();
      scheduleSidebarRestore();
      try {
        document.addEventListener('shown.bs.tab', function (evt) {
          try {
            var tablist = evt && evt.target && evt.target.closest ? evt.target.closest('[role="tablist"]') : document;
            normalizeBootstrapTabs(tablist || document);
          } catch (_) { normalizeBootstrapTabs(document); }
          scheduleSidebarRestore();
        });
      } catch (_) { }
      try {
        window.addEventListener('hashchange', function () {
          normalizeBootstrapTabs(document);
          scheduleSidebarRestore();
        });
      } catch (_) { }
      try { document.addEventListener('shown.bs.dropdown', scheduleSidebarRestore, true); } catch (_) { }
      try { document.addEventListener('hidden.bs.dropdown', scheduleSidebarRestore, true); } catch (_) { }
    } catch (_) { }
  });
})();
