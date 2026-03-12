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
  try {
    if (searchParamsCsv) {
      searchParamsCsv.split(',').forEach(function (k) {
        k = (k || '').toString().trim();
        if (k) searchKeys.push(k);
      });
    }
  } catch (_) { searchKeys = []; }

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
    } catch (_) { }
  });
})();
