// HtmlForgeX shared state helpers: storage + reset token parsing.
(function(){
  if (typeof window === 'undefined') return;
  if (window.hfxState) return;

  /** @param {Object} o @param {string} k */
  function hasOwn(o, k){ return Object.prototype.hasOwnProperty.call(o, k); }
  function isFileProtocol(){
    try { return !!window.location && window.location.protocol === 'file:'; } catch(_e){ return false; }
  }
  var store = (function(){
    var kind = null; // 'url' | 'local' | 'session' | 'history' | 'none'
    var backing = null;
    function canUse(s){
      try {
        if (!s) return false;
        var k = '__hfx_storage_test__';
        s.setItem(k, '1'); s.removeItem(k);
        return true;
      } catch(_e){ return false; }
    }
    function ensure(){
      if (kind) return;
      try {
        if (isFileProtocol() && window.history && typeof window.history.replaceState === 'function') {
          kind = 'url';
          return;
        }
      } catch(_e){}
      try { if (canUse(window.localStorage)) { kind = 'local'; backing = window.localStorage; return; } } catch(_e){}
      try { if (canUse(window.sessionStorage)) { kind = 'session'; backing = window.sessionStorage; return; } } catch(_e){}
      try { if (window.history && typeof window.history.replaceState === 'function') { kind = 'history'; return; } } catch(_e){}
      kind = 'none';
    }
    function readUrlState(){
      try {
        var url = new URL(window.location.href);
        var raw = url.searchParams.get('hfx-state');
        if (!raw) return {};
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch(_e){
        try {
          var q = (window.location && window.location.search) ? window.location.search : '';
          if (q && q.charAt(0) === '?') q = q.substring(1);
          if (!q) return {};
          var parts = q.split('&');
          for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (!p) continue;
            var idx = p.indexOf('=');
            var k = idx >= 0 ? p.substring(0, idx) : p;
            var v = idx >= 0 ? p.substring(idx + 1) : '';
            try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch(_k){}
            if ((k || '') !== 'hfx-state') continue;
            try {
              var rawValue = decodeURIComponent((v || '').replace(/\+/g, ' '));
              var parsedValue = JSON.parse(rawValue);
              return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
            } catch(_v){ return {}; }
          }
        } catch(_e2){}
        return {};
      }
    }
    function writeUrlState(state){
      try {
        var url = new URL(window.location.href);
        if (state && Object.keys(state).length) {
          url.searchParams.set('hfx-state', JSON.stringify(state));
        } else {
          url.searchParams.delete('hfx-state');
        }
        window.history.replaceState(window.history ? window.history.state : null, document.title, url.toString());
        return true;
      } catch(_e){
        return false;
      }
    }
    function getUrl(key){
      try {
        var state = readUrlState();
        return hasOwn(state, key) ? state[key] : null;
      } catch(_e){ return null; }
    }
    function setUrl(key, value){
      try {
        var state = readUrlState();
        state[key] = value;
        return writeUrlState(state);
      } catch(_e){ return false; }
    }
    function removeUrl(key){
      try {
        var state = readUrlState();
        if (hasOwn(state, key)) delete state[key];
        return writeUrlState(state);
      } catch(_e){ return false; }
    }
    function getHistory(key){
      try {
        var st = window.history && window.history.state;
        if (st && typeof st === 'object' && hasOwn(st, key)) return st[key];
      } catch(_e){}
      return null;
    }
    function setHistory(key, value){
      try {
        var prev = window.history && window.history.state;
        var next = {};
        if (prev && typeof prev === 'object') {
          for (var p in prev) { if (hasOwn(prev, p)) next[p] = prev[p]; }
        }
        next[key] = value;
        window.history.replaceState(next, document.title, window.location.href);
        return true;
      } catch(_e){ return false; }
    }
    function removeHistory(key){
      try {
        var prev = window.history && window.history.state;
        if (!prev || typeof prev !== 'object') return true;
        var next = {};
        for (var p in prev) { if (hasOwn(prev, p) && p !== key) next[p] = prev[p]; }
        window.history.replaceState(next, document.title, window.location.href);
        return true;
      } catch(_e){ return false; }
    }
    return {
      getItem: function(key){ try { ensure(); if (kind === 'url') return getUrl(key); if (kind === 'local' || kind === 'session') return backing.getItem(key); if (kind === 'history') return getHistory(key); } catch(_e){} return null; },
      setItem: function(key, val){ try { ensure(); if (kind === 'url') return setUrl(key, val); if (kind === 'local' || kind === 'session') { backing.setItem(key, val); return true; } if (kind === 'history') return setHistory(key, val); } catch(_e){} return false; },
      removeItem: function(key){ try { ensure(); if (kind === 'url') return removeUrl(key); if (kind === 'local' || kind === 'session') { backing.removeItem(key); return true; } if (kind === 'history') return removeHistory(key); } catch(_e){} return false; },
      kind: function(){ try { ensure(); return kind; } catch(_e){ return 'none'; } }
    };
  })();

  /** @returns {string|null} */
  function readResetParam(){
    try {
      var u = new URL(window.location.href);
      return u.searchParams.get('hfx-reset');
    } catch(_e){
      try{
        var q = (window.location && window.location.search) ? window.location.search : '';
        if (q && q.charAt(0) === '?') q = q.substring(1);
        if (!q) return null;
        var parts = q.split('&');
        for (var i=0;i<parts.length;i++){
          var p = parts[i]; if (!p) continue;
          var idx = p.indexOf('=');
          var k = idx>=0 ? p.substring(0, idx) : p;
          var v = idx>=0 ? p.substring(idx+1) : '';
          try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch(_k){}
          if ((k||'').toLowerCase() === 'hfx-reset'){
            try { return decodeURIComponent((v||'').replace(/\+/g, ' ')); } catch(_v){ return v; }
          }
        }
      } catch(_e2){}
      return null;
    }
  }

  /** @param {string} kind @returns {boolean} */
  function shouldReset(kind){
    try{
      var v = readResetParam();
      if (v == null) return false;
      v = (''+v).toLowerCase().trim();
      if (!v || v === '1' || v === 'true' || v === 'all') return true;
      return v.indexOf(kind) !== -1;
    }catch(_e){ return false; }
  }

  window.hfxState = {
    store: store,
    readResetParam: readResetParam,
    shouldReset: shouldReset
  };
})();
