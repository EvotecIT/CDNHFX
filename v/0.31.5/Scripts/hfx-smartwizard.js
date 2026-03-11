(function(){
  // Timing constants to avoid "magic numbers" and ease tuning
  var LAYOUT_DELAYS = { immediate: 0, short: 120, medium: 240, long: 520 };
  // Feature detection (cached at module scope)
  var hasResizeObserver = (typeof ResizeObserver !== 'undefined');

  // Internal: prefer natural auto-height so container follows current tab content
  /**
   * Return index of the active step anchor inside the wizard nav.
   * Returns -1 if the nav is missing or no link is marked active.
   */
  function _activeStepIndex(root){
    try{
      var links = root && root.querySelectorAll && root.querySelectorAll('.sw .nav .nav-link');
      if(!links || !links.length) return -1;
      for(var i=0;i<links.length;i++){ if(links[i].classList && links[i].classList.contains('active')) return i; }
      return -1;
    }catch(_e){ return -1; }
  }
  function fixHeightForWizard(root){
    try{
      if(!root) return;
      var $root = (root.jquery ? root : $(root));
      var $cont = $root.find('.tab-content').first();
      if(!$cont || !$cont.length) return;
      var pane = $cont.find('.tab-pane.active').get(0);
      // Clear any stale min/height first
      $cont.css({'min-height':'0','height':''});
      if(pane){
        // Measure current active pane and set explicit height to match
        var h = pane.scrollHeight || pane.offsetHeight || 0;
        if(h > 0){ $cont.css({'height': h + 'px'}); }
      } else {
        // Fallback to auto
        $cont.css({'height':'auto'});
      }
    }catch(e){
      try{
        if(window.__HFX_DEV_LOG && console && console.warn){
          var ctx = { id: (root && root.id) || null, active: _activeStepIndex(root) };
          console.warn('SmartWizard height fix failed', ctx, e);
        }
      }catch(_d){}
    }
  }
  // Coalesced scheduling to avoid hammering layout in the same frame.
  // Schedules a single fix per rAF and drops subsequent requests in the same frame.
  function scheduleFix(root){
    try{
      if(!root) return;
      if(root.__hfx_fixScheduled) return;
      root.__hfx_fixScheduled = true;
      requestAnimationFrame(function(){
        try{ fixHeightForWizard(root); }catch(_e){}
        root.__hfx_fixScheduled = false;
      });
    }catch(_e){}
  }
  function updateProgress(root, index){
    try{
      var meta = __hfx_wizMeta.get(root) || _computeMeta(root);
      var total = meta && typeof meta.count==='number' ? meta.count : 0;
      var pct = (total>1) ? (100 * (index / (total-1))) : 0;
      var bar = (meta && meta.bar) ? meta.bar : (root && root.querySelector && root.querySelector('.progress .progress-bar'));
      if(bar){ bar.style.width = pct + '%'; if(meta){ meta.bar = bar; __hfx_wizMeta.set(root, meta); } }
    }catch(_e){}
  }

  // Track observers without pinning DOM elements
  var __hfx_wizObservers = new WeakMap();
  // Lightweight per‑wizard meta to reduce repeated DOM queries
  var __hfx_wizMeta = new WeakMap(); // { nav:Element|null, count:number }

  function _computeMeta(root){
    try{
      var nav = (root && (root.querySelector('.sw-nav') || root.querySelector('.nav'))) || null;
      var count = 0;
      if(nav){
        var links = nav.querySelectorAll('.nav-link');
        count = links ? links.length : 0;
      }
      var bar = (root && root.querySelector && root.querySelector('.progress .progress-bar')) || null;
      var existing = __hfx_wizMeta.get(root) || {};
      var meta = { nav: nav, count: count, bar: bar, lastStyle: existing.lastStyle, lastTransition: existing.lastTransition, lastToolbar: existing.lastToolbar, lastJustified: existing.lastJustified, lastAccent: existing.lastAccent };
      __hfx_wizMeta.set(root, meta);
      return meta;
    }catch(_e){ return { nav:null, count:0 }; }
  }

  window.hfxSmartWizardInit = function(selector, opts){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      // Clean previous bindings/meta if re-initializing the same root
      try{ window.hfxSmartWizardDestroy(el); }catch(_d){}
      var $wiz = $(el);
      function ensureActive(){
        try{
          var hasActive = $wiz.find('.nav .nav-link.active').length > 0;
          var opts = $wiz.smartWizard('getOptions')||{};
          var sel = (typeof opts.selected === 'number') ? opts.selected : 0;
          if(!hasActive){ $wiz.smartWizard('goToStep', sel); }
        }catch(_e){}
      }
      if(opts && opts.progress){
        $wiz.on('initialized', function(){ try{ _computeMeta(el); }catch(_m){}; updateProgress(el, ($wiz.smartWizard('getOptions')||{}).selected||0); });
        $wiz.on('shownStep', function(e, anchorObject, stepIndex){ try{ _computeMeta(el); }catch(_m){}; updateProgress(el, stepIndex||0); });
      }

      // Keep DataTables/Charts sized after wizard events and apply deferred tab selections.
      var relayoutWiz = function(){ try{
        var root = el;
        if (typeof window.htmlForgeXRefreshVisible === 'function'){
          requestAnimationFrame(function(){ window.htmlForgeXRefreshVisible(root); });
          setTimeout(function(){ window.htmlForgeXRefreshVisible(root); }, LAYOUT_DELAYS.medium);
        }
        if (typeof window.hfxTabsApplySaved === 'function') {
          try { window.hfxTabsApplySaved(root); } catch(_e){}
        }
      }catch(_e){} };
      $wiz.on('initialized', relayoutWiz);
      $wiz.on('shownStep', relayoutWiz);
      $wiz.on('loaded', relayoutWiz);
      // Observe active pane size and keep wizard height in sync
      var ro = null;
      function observeActivePane(){
        try{
          if(!hasResizeObserver) return;
          var pane = el.querySelector('.tab-content .tab-pane.active');
          if(!pane) return;
          if(ro) { try{ ro.disconnect(); }catch(_e){} ro = null; }
          ro = new ResizeObserver(function(){ try{ scheduleFix(el); }catch(_e){} });
          ro.observe(pane);
          __hfx_wizObservers.set(el, ro);
        }catch(_e){}
      }
      // Ensure a step is selected on init (fallback to first) and recalc height, coordinated
      function settleWizard(){ try{ ensureActive(); observeActivePane(); scheduleFix(el); }catch(_e){} }
      $wiz.on('initialized', function(){ try{ _computeMeta(el); requestAnimationFrame(settleWizard); setTimeout(settleWizard, LAYOUT_DELAYS.medium); }catch(_e){} });
      // In case we bound after init, run once with the same coordination
      setTimeout(function(){ try{ requestAnimationFrame(settleWizard); setTimeout(settleWizard, LAYOUT_DELAYS.medium); }catch(_e){} }, LAYOUT_DELAYS.immediate);
      if(opts && opts.validation){
        $wiz.on('leaveStep', function(e, anchorObject, currentStepIndex, nextStepIndex, stepDirection){
          if(stepDirection==='forward'){
            var panes = el.querySelectorAll('.tab-content .tab-pane');
            var pane = (panes && panes.length>currentStepIndex) ? panes[currentStepIndex] : null;
            var form = pane ? pane.querySelector('form') : null;
            if(form && !form.checkValidity()){ e.preventDefault(); form.classList.add('was-validated'); return false; }
          }
          return true;
        });
      }
    }catch(_e){}
  }

  // Per-instance validators: [{index:0, fn:'myValidator'}, ...]
  window.hfxSmartWizardBindValidators = function(selector, validators){
    try{
      var map = {};
      (validators||[]).forEach(function(v){ if(v && typeof v.index==='number' && v.fn) map[v.index] = v.fn; });
      var $wiz = $(selector);
      $wiz.on('leaveStep', function(e, anchorObject, currentStepIndex, nextStepIndex, stepDirection){
        try{
          if(stepDirection==='forward' && map.hasOwnProperty(currentStepIndex)){
            var name = map[currentStepIndex];
            var fn = (typeof name==='function') ? name : (window[name]||null);
            if(typeof fn === 'function'){
              var ok = fn(currentStepIndex, nextStepIndex);
              if(ok === false){ e.preventDefault(); return false; }
            }
          }
        }catch(_e){}
        return true;
      });
    }catch(_e){}
  }

  // Per-instance AJAX steps: [{index:0, id:'paneId', url:'...', cache:true}]
  window.hfxSmartWizardBindAjax = function(selector, steps){
    try{
      var map = {};
      (steps||[]).forEach(function(s){ if(s && typeof s.index==='number' && s.url){ map[s.index] = s; } });
      var $wiz = $(selector);
      $wiz.on('showStep', function(e, anchorObject, stepIndex){
        try{
          var cfg = map[stepIndex]; if(!cfg) return;
          var $pane = cfg.id ? $('#'+cfg.id) : null;
          if(!$pane || !$pane.length) return;
          if(anchorObject && typeof anchorObject.data==='function' && anchorObject.data('loaded')) return;
          $.ajax({ url: cfg.url, cache: !!cfg.cache, success: function(data){ try{ $pane.html(data); if(anchorObject&&anchorObject.data) anchorObject.data('loaded', true);}catch(_e){} }, error: function(){ try{ $pane.html('<div class="alert alert-danger">Failed to load step content</div>'); }catch(_e){} } });
        }catch(_e){}
      });
    }catch(_e){}
  }

  // When a Bootstrap tab inside a SmartWizard step becomes visible, re-calc wizard height
  // so tall tab panes are not clipped. Also handle collapse panels.
  try{
    var relayout = function(e){
      try{
        var t = e && e.target; if(!t) return;
        // Find the nearest wizard root from the activated tab/collapse button
        var root = (t.closest && t.closest('.sw')) || null;
        if(!root){
          // Some events bubble from the pane; try the pane itself
          var pane = (t.getAttribute && (t.getAttribute('data-bs-target')||t.getAttribute('href')));
          if(pane && pane.charAt(0)==='#'){
            var el = document.querySelector(pane);
            if(el) root = el.closest && el.closest('.sw');
          }
        }
        if(!root) return;
        // Defer to allow inner components to resize, then fix height (coalesced)
        requestAnimationFrame(function(){ try{ scheduleFix(root); }catch(_e){} });
        setTimeout(function(){ try{ scheduleFix(root); }catch(_e){} }, LAYOUT_DELAYS.medium);
        // Re-attach ResizeObserver to the new active pane of this wizard
        try{
          var wiz = root;
          if(wiz){
            var pane = wiz.querySelector('.tab-content .tab-pane.active');
            if(hasResizeObserver && pane){
              var prev = __hfx_wizObservers.get(wiz);
              if(prev){ try{ prev.disconnect(); }catch(_e){} __hfx_wizObservers.delete(wiz); }
              var _ro = new ResizeObserver(function(){ try{ scheduleFix(wiz); }catch(_e){} });
              _ro.observe(pane);
              __hfx_wizObservers.set(wiz, _ro);
              try{ _computeMeta(wiz); }catch(_mm){}
            }
          }
        }catch(_o){}
      }catch(_e){}
    };
    document.addEventListener('shown.bs.tab', relayout, true);
    document.addEventListener('shown.bs.collapse', relayout, true);
  }catch(_e){}

  // Helper: set vendor theme safely
  function setTheme($wiz, theme){
    try{ $wiz.smartWizard('setOptions', { theme: (theme||'basic').toLowerCase() }); }catch(_e){}
  }
  function clearNavLooks(root){
    var nav = root.querySelector('.sw-nav') || root.querySelector('.nav');
    if(!nav) return;
    nav.classList.remove('nav-tabs','nav-pills','mb-2','gap-2','bg-body-tertiary','bg-body','bg-white','rounded','shadow-sm','border','px-3','py-2','px-2','py-1');
    nav.classList.remove('hfx-sw-look-tabs','hfx-sw-look-chips','hfx-sw-look-dg');
    root.classList.remove('hfx-sw-dg');
  }
  function applyLook(root, look){
    var nav = root.querySelector('.sw-nav') || root.querySelector('.nav');
    if(!nav) return;
    switch(look){
      case 'Tabs': nav.classList.add('hfx-sw-look-tabs','nav-tabs','mb-2'); break;
      case 'Chips': nav.classList.add('hfx-sw-look-chips','nav-pills','gap-2'); break;
      case 'DataGrid': nav.classList.add('hfx-sw-look-dg'); root.classList.add('hfx-sw-dg'); break;
    }
  }

  // Public API: change style programmatically (mutually exclusive mapping)
  window.hfxSmartWizardSetStyle = function(selector, style){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var $wiz = $(el);
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastStyle === style) return; // no-op if unchanged
      clearNavLooks(el);
      switch(style){
        case 'Basic': case 'Arrows': case 'Square': case 'Round': case 'Dots': case 'Progress': case 'Material': case 'Dark':
          // Vendor themes
          setTheme($wiz, style);
          break;
        default:
          // HFX looks
          setTheme($wiz, 'basic');
          applyLook(el, style);
          break;
      }
      try{ meta.lastStyle = style; __hfx_wizMeta.set(el, meta); }catch(_ms){}
    }catch(_e){}
  }

  window.hfxSmartWizardSetTransition = function(selector, transition){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return; var $wiz = $(el);
      var map = { None:'none', Fade:'fade', SlideHorizontal:'slide-horizontal', SlideVertical:'slide-vertical', SlideSwing:'slide-swing', 'CSS Rotate':'css' };
      var anim = map[transition] || 'none';
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastTransition === transition) return;
      if(anim === 'css'){
        $wiz.smartWizard('setOptions', { transition: { animation: 'css', speed: 300, easing: '', script: { enter: 'anim-rotate-in', leave: 'anim-rotate-out' } } });
      } else {
        $wiz.smartWizard('setOptions', { transition: { animation: anim, speed: 300 } });
      }
      try{ meta.lastTransition = transition; __hfx_wizMeta.set(el, meta); }catch(_mt){}
    }catch(_e){}
  }

  window.hfxSmartWizardSetJustified = function(selector, justified){
    try{ var el = (typeof selector === 'string') ? document.querySelector(selector) : selector; if(!el) return; var $wiz = $(el); var meta = __hfx_wizMeta.get(el) || _computeMeta(el); if(meta && meta.lastJustified === !!justified) return; $wiz.smartWizard('setOptions', { justified: !!justified }); try{ meta.lastJustified = !!justified; __hfx_wizMeta.set(el, meta); }catch(_mj){} }catch(_e){}
  }

  window.hfxSmartWizardSetToolbar = function(selector, pos){
    try{
      var p = (pos||'bottom').toLowerCase();
      var $wiz = $(selector);
      var show = (p !== 'none');
      if(p === 'both') p = 'both';
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector; if(!el) return; var meta = __hfx_wizMeta.get(el) || _computeMeta(el); if(meta && meta.lastToolbar === p) return; $wiz.smartWizard('setOptions', { toolbar: { position: p, showNextButton: show, showPreviousButton: show } }); try{ meta.lastToolbar = p; __hfx_wizMeta.set(el, meta); }catch(_mb){}
    }catch(_e){}
  }

  window.hfxSmartWizardSetAccent = function(selector, accent){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el); if(meta && meta.lastAccent === accent) return;
      // Clear previous accent utility
      el.classList.remove('hfx-sw-accent-blue','hfx-sw-accent-green','hfx-sw-accent-red','hfx-sw-accent-purple','hfx-sw-accent-sea');
      switch(accent){
        case 'Blue': el.classList.add('hfx-sw-accent-blue'); break;
        case 'Green': el.classList.add('hfx-sw-accent-green'); break;
        case 'Red': el.classList.add('hfx-sw-accent-red'); break;
        case 'Purple': el.classList.add('hfx-sw-accent-purple'); break;
        case 'Sea': el.classList.add('hfx-sw-accent-sea'); break;
        default: break;
      }
      try{ meta.lastAccent = accent; __hfx_wizMeta.set(el, meta); }catch(_ma){}
    }catch(_e){}
  }

  // Public API: clean up observers/handlers for a wizard root
  window.hfxSmartWizardDestroy = function(selector){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var ro = __hfx_wizObservers.get(el);
      if(ro){ try{ ro.disconnect(); }catch(_e){} __hfx_wizObservers.delete(el); }
      // Remove event handlers we may have attached
      try{ var $wiz = $(el); if($wiz && $wiz.off){ $wiz.off('initialized shownStep loaded leaveStep showStep'); } }catch(_off){}
      // jQuery plugin may have its own destroy; call if available
      try{ var $w = $(el); if($w && $w.smartWizard){ $w.smartWizard('unset'); } }catch(_p){}
      // Clear scheduling flag
      try{ if(el.__hfx_fixScheduled) el.__hfx_fixScheduled = false; }catch(_f){}
      // Clear cached meta
      try{ __hfx_wizMeta.delete(el); }catch(_md){}
    }catch(_e){}
  }

  // Note: demo wiring helper moved to the example to avoid shipping app‑specific glue here
})();
