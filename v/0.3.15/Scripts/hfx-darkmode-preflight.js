// HtmlForgeX preflight: runs in <head> before styles to avoid FOUC in ThemeMode.System.
// Kept tiny and defensive; may be inlined for ordering guarantees in Online/Offline modes.
(function(){
  try {
    var root = document && document.documentElement ? document.documentElement : null;
    if (!root || !root.setAttribute) return;

    var DEFAULT_STORAGE_KEY = 'theme';
    var DEFAULT_A11Y_KEY = 'hfx-a11y';

    var key = DEFAULT_STORAGE_KEY;
    if (root.getAttribute) {
      var k = null;
      try { k = root.getAttribute('data-hfx-darkmode-key'); } catch(_k) { k = null; }
      if (k && String(k).trim()) key = String(k).trim();
    }

    var a11yKey = DEFAULT_A11Y_KEY;
    if (root.getAttribute) {
      var ak = null;
      try { ak = root.getAttribute('data-hfx-a11y-key'); } catch(_ak) { ak = null; }
      if (ak && String(ak).trim()) a11yKey = String(ak).trim();
    }

    function norm(v){
      var s = String(v || '').toLowerCase();
      if (s === 'dark' || s === 'light') return s;
      if (s === 'auto' || s === 'system') return 'auto';
      if (s === 'dark-black' || s === 'black' || s === 'darkblack') return 'dark-black';
      if (s === 'dark-carbon' || s === 'carbon' || s === 'darkcarbon') return 'dark-carbon';
      return null;
    }

    function base(t){
      var x = norm(t);
      if (!x) return null;
      if (x === 'dark') return 'dark';
      if (x === 'light') return 'light';
      if (x === 'dark-black') return 'dark';
      if (x === 'dark-carbon') return 'dark';
      if (x === 'auto') return 'auto';
      return null;
    }

    function pref(){
      try { return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; } catch(_e){ return 'light'; }
    }

    function normA11y(v){
      var s = String(v || '').toLowerCase().replace(/[+_]/g, ' ');
      if (!s || s === 'none' || s === 'default') return '';
      var tokens = s.split(/\s+/);
      var hc = false;
      var cb = false;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t === 'high-contrast' || t === 'highcontrast' || t === 'contrast' || t === 'hc') hc = true;
        if (t === 'color-blind' || t === 'colorblind' || t === 'colorblind-safe' || t === 'cb') cb = true;
      }
      if (hc && cb) return 'high-contrast color-blind';
      if (hc) return 'high-contrast';
      if (cb) return 'color-blind';
      return '';
    }

    function qp(name){
      try {
        var search = (window.location && window.location.search) ? String(window.location.search) : '';
        if (!search) return null;
        var re = new RegExp('(?:^|[?&])' + name + '=([^&]*)', 'i');
        var m = re.exec(search);
        if (!m || m.length < 2) return null;
        var raw = String(m[1] || '').replace(/\+/g, ' ');
        try { return decodeURIComponent(raw); } catch(_d){ return raw; }
      } catch(_e){ return null; }
    }

    var urlTheme = null;
    try { urlTheme = norm(qp('theme')); } catch(_qt){ urlTheme = null; }

    function resolveAuto(){
      var m = pref();
      var token = m;
      try {
        var a = (m === 'dark') ? 'data-hfx-theme-default-dark' : 'data-hfx-theme-default-light';
        var def = null;
        try { def = norm(root.getAttribute ? root.getAttribute(a) : null); } catch(_da){ def = null; }
        if (def && base(def) === m) token = def;
      } catch(_e) { }
      return { m: m, t: token, s: 'auto' };
    }

    function resolve(sel){
      var x = norm(sel);
      if (!x || x === 'auto') return resolveAuto();
      var m2 = base(x);
      if (m2 !== 'dark' && m2 !== 'light') return resolveAuto();
      return { m: m2, t: x, s: x };
    }

    var sel2 = null;
    if (urlTheme) sel2 = urlTheme;
    else {
      var stored = null;
      try { stored = norm(localStorage.getItem(key)); } catch(_ls){ stored = null; }
      if (stored === 'auto') stored = null;
      sel2 = stored || 'auto';
    }

    var r = resolve(sel2);
    try { root.setAttribute('data-bs-theme', r.m); } catch(_a) { }
    try { root.setAttribute('data-hfx-theme', r.t); } catch(_b) { }
    try { root.setAttribute('data-hfx-theme-selection', r.s); } catch(_c) { }

    // Accessibility overrides (high-contrast / color-blind)
    try {
      var storedA11y = null;
      try { storedA11y = normA11y(localStorage.getItem(a11yKey)); } catch(_ls2){ storedA11y = null; }
      if (storedA11y) {
        try { root.setAttribute('data-hfx-a11y', storedA11y); } catch(_d) { }
      }
    } catch(_e2) { }
  } catch(_e) { }
})();
