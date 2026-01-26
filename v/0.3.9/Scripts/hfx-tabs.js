// HtmlForgeX Tabs helper: persist last active tab per tabs header and provide optional reset
(function(){
  var hfxState = null;
  try { hfxState = window.hfxState || null; } catch(_e) { hfxState = null; }
  if (!hfxState) {
    hfxState = {
      store: {
        getItem: function(){ return null; },
        setItem: function(){ return false; },
        removeItem: function(){ return false; }
      },
      shouldReset: function(){ return false; }
    };
  }
  var hfxStore = hfxState.store || {
    getItem: function(){ return null; },
    setItem: function(){ return false; },
    removeItem: function(){ return false; }
  };
  function shouldReset(kind){
    try { return hfxState && hfxState.shouldReset ? hfxState.shouldReset(kind) : false; } catch(_e){ return false; }
  }
  function keyFor(header){ try { var id = header && header.getAttribute && header.getAttribute('data-hfx-tabs-id'); return id ? 'hfx:tabs:'+id : null; } catch(_) { return null; } }
  function findLinkByTarget(header, target){
    try {
      if (!header || !header.querySelectorAll) return null;
      var links = header.querySelectorAll('[data-bs-toggle="tab"]');
      for (var i = 0; i < links.length; i++){
        var a = links[i];
        if (!a || !a.getAttribute) continue;
        var t = a.getAttribute('data-bs-target') || a.getAttribute('href');
        if (t === target) return a;
      }
    } catch(_e) { }
    return null;
  }
  function activateTarget(header, target){
    try {
      var a = findLinkByTarget(header, target);
      if (!a) return false;
      var Tab = (window.bootstrap && window.bootstrap.Tab) || bootstrap.Tab;
      Tab.getOrCreateInstance(a).show();
      return true;
    } catch(_) { return false; }
  }
  function activateByKey(header, key){
    try{
      if (!header || !key) return false;
      var links = header.querySelectorAll ? header.querySelectorAll('[data-bs-toggle="tab"]') : [];
      for (var i=0;i<links.length;i++){
        var a = links[i];
        if (!a || !a.getAttribute) continue;
        var k = a.getAttribute('data-hfx-tab-key');
        if (k && k === key){
          var Tab = (window.bootstrap && window.bootstrap.Tab) || bootstrap.Tab;
          Tab.getOrCreateInstance(a).show();
          return true;
        }
      }
    }catch(_e){}
    return false;
  }
  function activateByIndex(header, index){
    try{
      if (!header || typeof index !== 'number' || index < 0) return false;
      var links = header.querySelectorAll ? header.querySelectorAll('[data-bs-toggle="tab"]') : [];
      if (!links || index >= links.length) return false;
      var a = links[index];
      if (!a) return false;
      var Tab = (window.bootstrap && window.bootstrap.Tab) || bootstrap.Tab;
      Tab.getOrCreateInstance(a).show();
      return true;
    }catch(_e){}
    return false;
  }
  function firstTarget(header){ try { var a = header.querySelector('[data-bs-toggle="tab"]'); return a ? (a.getAttribute('data-bs-target') || a.getAttribute('href')) : null; } catch(_) { return null; } }
  function isVisible(el){
    try {
      if (!el) return false;
      // Prefer "has box" checks over offsetParent (fails for some positioned elements).
      if (el.offsetWidth || el.offsetHeight) return true;
      var r = el.getClientRects && el.getClientRects();
      return !!(r && r.length);
    } catch(_) { return false; }
  }
  function ensureResetUi(header){
    try {
      if (header.getAttribute('data-hfx-tabs-reset') !== '1') return;
      if (header.querySelector('.hfx-tabs-reset')) return;
      var btn = document.createElement('button');
      btn.type='button';
      btn.className='btn btn-link btn-sm hfx-tabs-reset ms-2';
      btn.textContent='Reset tabs';
      header.parentElement && header.parentElement.appendChild(btn);
      btn.addEventListener('click', function(){
        try {
          var k = keyFor(header);
          if (k) hfxStore.removeItem(k);
          header.removeAttribute('data-hfx-tabs-saved');
          var t = firstTarget(header);
          if (t) activateTarget(header, t);
        } catch(_){}  
      });
    } catch(_){}  
  }
  function storeSavedTarget(header, value){ try { if (header && value) header.setAttribute('data-hfx-tabs-saved', value); } catch(_){} }
  function readSavedTarget(header){ try { return header ? header.getAttribute('data-hfx-tabs-saved') : null; } catch(_) { return null; } }
  function clearSavedTarget(header){ try { header && header.removeAttribute && header.removeAttribute('data-hfx-tabs-saved'); } catch(_){} }
  /** @param {any} val @returns {number|null} */
  function normalizeIndex(val){
    try{
      var idx = null;
      if (typeof val === 'number') idx = val;
      else if (val != null && val !== '') idx = parseInt(val, 10);
      if (idx != null && isNaN(idx)) idx = null;
      return idx;
    } catch(_e){ return null; }
  }
  /** @param {string|null} raw */
  function parseSaved(raw){
    try{
      if (!raw) return null;
      if (raw.charAt(0) === '{'){
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object'){
          return {
            key: obj.key || null,
            index: normalizeIndex(obj.index),
            target: obj.target || null
          };
        }
      }
    }catch(_e){}
    return { key: null, index: null, target: raw };
  }
  /** @param {Element} link */
  function buildSaved(link){
    try{
      if (!link || !link.getAttribute) return null;
      var key = link.getAttribute('data-hfx-tab-key');
      var idxRaw = link.getAttribute('data-hfx-tab-index');
      var idx = normalizeIndex(idxRaw);
      var target = link.getAttribute('data-bs-target') || link.getAttribute('href');
      if (key || idx != null) {
        return JSON.stringify({ key: key || null, index: idx, target: target || null });
      }
      return target;
    }catch(_e){ return null; }
  }
  /** @param {Element} header */
  function applySavedForHeader(header){
    try {
      if (!header) return false;
      var saved = readSavedTarget(header);
      if (!saved) return false;
      if (!isVisible(header)) return false;
      var data = parseSaved(saved);
      var ok = false;
      if (data && data.key) ok = activateByKey(header, data.key);
      if (!ok && data && data.target) ok = activateTarget(header, data.target);
      if (!ok && data && data.index != null) ok = activateByIndex(header, data.index);
      if (!ok) {
        var t = firstTarget(header);
        if (t) activateTarget(header, t);
      }
      clearSavedTarget(header);
      return true;
    } catch(_) { return false; }
  }
  /** @param {Element|Document} root */
  function applySavedInRoot(root){
    try {
      if (!root) root = document;
      var list = root.querySelectorAll
        ? root.querySelectorAll('ul.nav-tabs[data-bs-toggle="tabs"][data-hfx-tabs-id][data-hfx-tabs-saved]')
        : [];
      if (!list || !list.length) return;
      list.forEach(function(h){ applySavedForHeader(h); });
    } catch(_){}
  }
  function rootFromEvent(e){
    try {
      var t = e && (e.target || e.srcElement);
      if (!t) return document;
      // For shown.bs.tab we get the tab trigger link; resolve to its target pane.
      var sel = t.getAttribute && (t.getAttribute('data-bs-target') || t.getAttribute('href'));
      if (sel && sel.charAt(0) === '#') {
        var el = document.querySelector(sel);
        if (el) return el;
      }
      // For collapse/modal/offcanvas, the target is usually the revealed element itself.
      return t;
    } catch(_) { return document; }
  }

  // Expose a small helper so other scripts (e.g., visibility refresh) can apply saved selections
  // when a hidden region becomes visible via non-Bootstrap mechanisms (SmartWizard, custom show/hide).
  try {
    window.hfxTabsApplySaved = function(root){ applySavedInRoot(root || document); };
  } catch(_){}

  document.addEventListener('shown.bs.tab', function(e){
    try {
      var link = e && (e.target || e.srcElement);
      var header = link && link.closest && link.closest('ul.nav-tabs[data-bs-toggle="tabs"][data-hfx-tabs-id]');
      if (!header) return;
      var k = keyFor(header);
      var saved = buildSaved(link);
      if (k && saved) hfxStore.setItem(k, saved);
      // When a tab pane becomes visible, apply any deferred saved selections inside it.
      applySavedInRoot(rootFromEvent(e));
    } catch(_){}
  });
  ['shown.bs.collapse','shown.bs.modal','shown.bs.offcanvas'].forEach(function(ev){
    document.addEventListener(ev, function(e){
      try { applySavedInRoot(rootFromEvent(e)); } catch(_){}
    }, true);
  });

  document.addEventListener('DOMContentLoaded', function(){
    try {
      document.querySelectorAll('ul.nav-tabs[data-bs-toggle="tabs"][data-hfx-tabs-id]').forEach(function(h){
        var k = keyFor(h);
        ensureResetUi(h);
        if (k && shouldReset('tabs')) {
          try { hfxStore.removeItem(k); } catch(_r){}
          clearSavedTarget(h);
          return;
        }
        if (!k) return;
        var saved = hfxStore.getItem(k);
        if (!saved) return;
        // If the header isn't visible yet (e.g., nested in an inactive tab/accordion),
        // store the target and apply it only when the region is revealed.
        if (isVisible(h)) {
          var data = parseSaved(saved);
          var ok = false;
          if (data && data.key) ok = activateByKey(h, data.key);
          if (!ok && data && data.target) ok = activateTarget(h, data.target);
          if (!ok && data && data.index != null) ok = activateByIndex(h, data.index);
          if (!ok) {
            var t = firstTarget(h);
            if (t) activateTarget(h, t);
          }
        } else {
          storeSavedTarget(h, saved);
        }
      });
    } catch(_){}
  });
})();
