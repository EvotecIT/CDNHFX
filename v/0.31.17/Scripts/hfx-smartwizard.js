(function(){
  var LAYOUT_DELAYS = { immediate: 0, short: 120, medium: 240, long: 520 };
  var hasResizeObserver = (typeof ResizeObserver !== 'undefined');
  var __hfx_wizObservers = new WeakMap();
  var __hfx_wizMeta = new WeakMap();

  function _activeStepIndex(root){
    try{
      var links = root && root.querySelectorAll && root.querySelectorAll('.nav .nav-link');
      if(!links || !links.length) return -1;
      for(var i=0;i<links.length;i++){ if(links[i].classList && links[i].classList.contains('active')) return i; }
      return -1;
    }catch(_e){ return -1; }
  }

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
      var meta = {
        nav: nav,
        count: count,
        bar: bar,
        lastStyle: existing.lastStyle,
        lastTransition: existing.lastTransition,
        lastToolbar: existing.lastToolbar,
        lastJustified: (typeof existing.lastJustified === 'boolean') ? existing.lastJustified : !!(root && root.classList && root.classList.contains('sw-justified')),
        lastAccent: existing.lastAccent
      };
      __hfx_wizMeta.set(root, meta);
      return meta;
    }catch(_e){ return { nav:null, count:0, bar:null }; }
  }

  function _getVisiblePane(root){
    try{
      if(!root || !root.querySelectorAll) return null;
      var panes = root.querySelectorAll('.tab-content .tab-pane');
      if(!panes || !panes.length) return null;
      for(var i=0;i<panes.length;i++){
        var pane = panes[i];
        if(!pane) continue;
        var isVisible = !(pane.hasAttribute('hidden')) &&
          pane.style.display !== 'none' &&
          ((!window.getComputedStyle) || window.getComputedStyle(pane).display !== 'none');
        if(isVisible && (pane.classList.contains('active') || pane.offsetHeight > 0 || pane.offsetParent !== null)){
          return pane;
        }
      }
      for(var j=0;j<panes.length;j++){
        if(panes[j].classList.contains('active')) return panes[j];
      }
      return panes[0] || null;
    }catch(_e){ return null; }
  }

  function updateProgress(root, index){
    try{
      var meta = __hfx_wizMeta.get(root) || _computeMeta(root);
      var total = meta && typeof meta.count === 'number' ? meta.count : 0;
      var pct = (total > 1) ? (100 * ((index + 1) / total)) : 0;
      var bar = (meta && meta.bar) ? meta.bar : (root && root.querySelector && root.querySelector('.progress .progress-bar'));
      if(bar){
        bar.style.width = pct.toFixed(2) + '%';
        try{ bar.setAttribute('aria-valuenow', String(Math.round(pct))); }catch(_a){}
        if(meta){ meta.bar = bar; __hfx_wizMeta.set(root, meta); }
      }
    }catch(_e){}
  }

  function fixHeightForWizard(root){
    try{
      if(!root) return;
      var $root = (root.jquery ? root : $(root));
      var $cont = $root.find('.tab-content').first();
      if(!$cont || !$cont.length) return;
      var pane = _getVisiblePane(root);
      $cont.css({'min-height':'0','height':''});
      if(pane){
        var h = pane.scrollHeight || pane.offsetHeight || 0;
        if(h > 0){ $cont.css({'height': h + 'px'}); }
      } else {
        $cont.css({'height':'auto'});
      }
    }catch(e){
      try{
        if(window.__HFX_DEV_LOG && console && console.warn){
          console.warn('SmartWizard height fix failed', { id: (root && root.id) || null, active: _activeStepIndex(root) }, e);
        }
      }catch(_d){}
    }
  }

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

  function bridgeLegacyEvents($wiz, el){
    try{
      $wiz.off('.hfxLegacyBridge');
      $wiz.on('initialized.sw.hfxLegacyBridge', function(e){
        try{ $wiz.triggerHandler('initialized'); }catch(_l){}
      });
      $wiz.on('loaded.sw.hfxLegacyBridge', function(e){
        try{ $wiz.triggerHandler('loaded'); }catch(_l){}
      });
      $wiz.on('leave.sw.hfxLegacyBridge', function(e, args){
        try{
          var payload = args || {};
          var anchor = payload.stepElement || null;
          var current = typeof payload.stepIndex === 'number' ? payload.stepIndex : 0;
          var next = typeof payload.nextStepIndex === 'number' ? payload.nextStepIndex : current;
          var dir = payload.stepDirection || (next > current ? 'forward' : 'backward');
          var legacyEvent = $.Event('leaveStep');
          $wiz.trigger(legacyEvent, [anchor, current, next, dir]);
          if(legacyEvent.isDefaultPrevented()){
            e.preventDefault();
            return false;
          }
        }catch(_l){}
        return true;
      });
      $wiz.on('shown.sw.hfxLegacyBridge', function(e, args){
        try{
          var payload = args || {};
          var anchor = payload.stepElement || null;
          var index = typeof payload.stepIndex === 'number' ? payload.stepIndex : 0;
          var dir = payload.stepDirection || 'forward';
          var pos = payload.stepPosition || 'middle';
          $wiz.triggerHandler('showStep', [anchor, index, dir, pos]);
        }catch(_l){}
      });
    }catch(_e){}
  }

  function observeActivePane(el){
    try{
      if(!hasResizeObserver) return;
      var pane = _getVisiblePane(el);
      if(!pane) return;
      var prev = __hfx_wizObservers.get(el);
      if(prev){ try{ prev.disconnect(); }catch(_e){} }
      var ro = new ResizeObserver(function(){ try{ scheduleFix(el); }catch(_e){} });
      ro.observe(pane);
      __hfx_wizObservers.set(el, ro);
    }catch(_e){}
  }

  window.hfxSmartWizardInit = function(selector, opts){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      try{ window.hfxSmartWizardDestroy(el); }catch(_d){}
      var $wiz = $(el);
      bridgeLegacyEvents($wiz, el);

      function ensureActive(){
        try{
          var hasActive = $wiz.find('.nav .nav-link.active').length > 0;
          var cfg = $wiz.smartWizard('getOptions') || {};
          var sel = (typeof cfg.initialStep === 'number') ? cfg.initialStep : 0;
          if(!hasActive){ $wiz.smartWizard('goToStep', sel, true); }
        }catch(_e){}
      }

      function relayoutWiz(){
        try{
          if(typeof window.htmlForgeXRefreshVisible === 'function'){
            requestAnimationFrame(function(){ window.htmlForgeXRefreshVisible(el); });
            setTimeout(function(){ window.htmlForgeXRefreshVisible(el); }, LAYOUT_DELAYS.medium);
          }
          if(typeof window.hfxTabsApplySaved === 'function'){
            try{ window.hfxTabsApplySaved(el); }catch(_e){}
          }
        }catch(_e){}
      }

      function settleWizard(){
        try{
          if(opts && typeof opts.justified === 'boolean'){
            el.classList.toggle('sw-justified', !!opts.justified);
            try{
              var meta = __hfx_wizMeta.get(el) || {};
              meta.lastJustified = !!opts.justified;
              __hfx_wizMeta.set(el, meta);
            }catch(_jm){}
          }
          ensureActive();
          _computeMeta(el);
          observeActivePane(el);
          scheduleFix(el);
        }catch(_e){}
      }

      if(opts && opts.progress){
        $wiz.on('initialized.sw.hfxProgress', function(){
          try{ _computeMeta(el); }catch(_m){}
          updateProgress(el, (($wiz.smartWizard('getStepInfo') || {}).currentStep || 0));
        });
        $wiz.on('shown.sw.hfxProgress', function(e, args){
          try{ _computeMeta(el); }catch(_m){}
          updateProgress(el, (args && typeof args.stepIndex === 'number') ? args.stepIndex : 0);
        });
      }

      $wiz.on('initialized.sw.hfxLayout', relayoutWiz);
      $wiz.on('shown.sw.hfxLayout', function(){ relayoutWiz(); observeActivePane(el); scheduleFix(el); });
      $wiz.on('loaded.sw.hfxLayout', relayoutWiz);

      $wiz.on('initialized.sw.hfxSettle', function(){
        try{
          requestAnimationFrame(settleWizard);
          setTimeout(settleWizard, LAYOUT_DELAYS.medium);
        }catch(_e){}
      });

      setTimeout(function(){
        try{
          requestAnimationFrame(settleWizard);
          setTimeout(settleWizard, LAYOUT_DELAYS.medium);
        }catch(_e){}
      }, LAYOUT_DELAYS.immediate);

      if(opts && opts.validation){
        $wiz.on('leave.sw.hfxValidation', function(e, args){
          try{
            if(args && args.stepDirection === 'forward'){
              var currentStepIndex = typeof args.stepIndex === 'number' ? args.stepIndex : 0;
              var panes = el.querySelectorAll('.tab-content .tab-pane');
              var pane = (panes && panes.length > currentStepIndex) ? panes[currentStepIndex] : null;
              var form = pane ? pane.querySelector('form') : null;
              if(form && !form.checkValidity()){
                e.preventDefault();
                form.classList.add('was-validated');
                return false;
              }
            }
          }catch(_e){}
          return true;
        });
      }
    }catch(_e){}
  };

  window.hfxSmartWizardBindValidators = function(selector, validators){
    try{
      var map = {};
      (validators || []).forEach(function(v){
        if(v && typeof v.index === 'number' && v.fn){ map[v.index] = v.fn; }
      });
      var $wiz = $(selector);
      $wiz.on('leave.sw.hfxCustomValidators', function(e, args){
        try{
          var current = args && typeof args.stepIndex === 'number' ? args.stepIndex : -1;
          if(args && args.stepDirection === 'forward' && Object.prototype.hasOwnProperty.call(map, current)){
            var name = map[current];
            var fn = (typeof name === 'function') ? name : (window[name] || null);
            if(typeof fn === 'function'){
              var ok = fn(current, args.nextStepIndex);
              if(ok === false){
                e.preventDefault();
                return false;
              }
            }
          }
        }catch(_e){}
        return true;
      });
    }catch(_e){}
  };

  window.hfxSmartWizardBindAjax = function(selector, steps){
    try{
      var map = {};
      (steps || []).forEach(function(s){
        if(s && typeof s.index === 'number' && s.url){ map[s.index] = s; }
      });
      var $wiz = $(selector);
      $wiz.on('shown.sw.hfxAjax', function(e, args){
        try{
          var stepIndex = args && typeof args.stepIndex === 'number' ? args.stepIndex : -1;
          var cfg = map[stepIndex];
          if(!cfg) return;
          var $pane = cfg.id ? $('#' + cfg.id) : null;
          if(!$pane || !$pane.length) return;
          if($pane.data('hfxAjaxLoaded') && cfg.cache !== false) return;
          $.ajax({
            url: cfg.url,
            cache: !!cfg.cache,
            success: function(data){
              try{
                $pane.html(data);
                if(cfg.cache !== false){ $pane.data('hfxAjaxLoaded', true); }
                scheduleFix((typeof selector === 'string') ? document.querySelector(selector) : selector);
              }catch(_e){}
            },
            error: function(){
              try{ $pane.html('<div class="alert alert-danger">Failed to load step content</div>'); }catch(_e){}
            }
          });
        }catch(_e){}
      });
    }catch(_e){}
  };

  try{
    var relayout = function(e){
      try{
        var t = e && e.target; if(!t) return;
        var root = (t.closest && t.closest('.sw')) || null;
        if(!root){
          var pane = (t.getAttribute && (t.getAttribute('data-bs-target') || t.getAttribute('href')));
          if(pane && pane.charAt(0) === '#'){
            var el = document.querySelector(pane);
            if(el) root = el.closest && el.closest('.sw');
          }
        }
        if(!root) return;
        requestAnimationFrame(function(){ try{ scheduleFix(root); }catch(_e){} });
        setTimeout(function(){ try{ scheduleFix(root); }catch(_e){} }, LAYOUT_DELAYS.medium);
        observeActivePane(root);
      }catch(_e){}
    };
    document.addEventListener('shown.bs.tab', relayout, true);
    document.addEventListener('shown.bs.collapse', relayout, true);
  }catch(_e){}

  function clearNavLooks(root){
    var nav = root.querySelector('.sw-nav') || root.querySelector('.nav');
    if(!nav) return;
    nav.classList.remove('nav-tabs','nav-pills','mb-2','gap-2','bg-body-tertiary','bg-body','bg-white','rounded','shadow-sm','border','px-3','py-2','px-2','py-1');
    nav.classList.remove('hfx-sw-look-tabs','hfx-sw-look-chips','hfx-sw-look-dg');
    root.classList.remove('hfx-sw-dg','hfx-sw-variant-square','hfx-sw-variant-round','hfx-sw-variant-dots','hfx-sw-variant-progress');
  }

  function applyLook(root, look){
    var nav = root.querySelector('.sw-nav') || root.querySelector('.nav');
    if(!nav) return;
    switch(look){
      case 'Tabs':
        nav.classList.add('hfx-sw-look-tabs','nav-tabs','mb-2');
        break;
      case 'Chips':
        nav.classList.add('hfx-sw-look-chips','nav-pills','gap-2');
        break;
      case 'DataGrid':
        nav.classList.add('hfx-sw-look-dg');
        root.classList.add('hfx-sw-dg');
        break;
      case 'Square':
        root.classList.add('hfx-sw-variant-square');
        break;
      case 'Round':
        root.classList.add('hfx-sw-variant-round');
        break;
      case 'Dots':
        root.classList.add('hfx-sw-variant-dots');
        break;
      case 'Progress':
        root.classList.add('hfx-sw-variant-progress');
        break;
    }
  }

  function normalizeStyle(style){
    return String(style || '').replace(/\s+\([^)]*\)\s*$/,'').trim();
  }

  function mapStyle(style){
    switch(normalizeStyle(style)){
      case 'Basic': return { theme: 'basic', displayMode: 'none' };
      case 'Arrows': return { theme: 'arrows', displayMode: 'none' };
      case 'Square': return { theme: 'pills', displayMode: 'none' };
      case 'Round': return { theme: 'pills', displayMode: 'none' };
      case 'Dots': return { theme: 'pills', displayMode: 'none' };
      case 'Progress': return { theme: 'basic', displayMode: 'none' };
      case 'Material': return { theme: 'glow', displayMode: 'none' };
      case 'Dark': return { theme: 'basic', displayMode: 'dark' };
      default: return null;
    }
  }

  window.hfxSmartWizardSetStyle = function(selector, style){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var $wiz = $(el);
      var styleKey = normalizeStyle(style);
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastStyle === styleKey) return;
      clearNavLooks(el);

      var mapped = mapStyle(styleKey);
      if(mapped){
        $wiz.smartWizard('setOptions', { theme: mapped.theme, displayMode: mapped.displayMode });
        applyLook(el, styleKey);
      } else {
        $wiz.smartWizard('setOptions', { theme: 'basic', displayMode: 'none' });
        applyLook(el, styleKey);
      }
      try{ meta.lastStyle = styleKey; __hfx_wizMeta.set(el, meta); }catch(_ms){}
    }catch(_e){}
  };

  window.hfxSmartWizardCommand = function(selector, command){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var jq = window.jQuery || window.$;
      if(jq && jq.fn && jq.fn.smartWizard){
        jq(el).smartWizard(command);
      }
    }catch(_e){}
  };

  window.hfxSmartWizardSetTransition = function(selector, transition){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var $wiz = $(el);
      var map = {
        None: 'none',
        Fade: 'fade',
        SlideHorizontal: 'slideHorizontal',
        SlideVertical: 'slideVertical',
        SlideSwing: 'slideSwing',
        'CSS Rotate': 'css'
      };
      var effect = map[transition] || 'none';
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastTransition === transition) return;
      if(effect === 'css'){
        $wiz.smartWizard('setOptions', {
          transition: {
            effect: 'css',
            speed: 300,
            easing: '',
            css: {
              prefix: '',
              forward: { show: 'anim-rotate-in', hide: 'anim-rotate-out' },
              backward: { show: 'anim-rotate-in', hide: 'anim-rotate-out' }
            }
          }
        });
      } else {
        $wiz.smartWizard('setOptions', { transition: { effect: effect, speed: 300, easing: '' } });
      }
      try{ meta.lastTransition = transition; __hfx_wizMeta.set(el, meta); }catch(_mt){}
    }catch(_e){}
  };

  window.hfxSmartWizardSetJustified = function(selector, justified){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastJustified === !!justified) return;
      el.classList.toggle('sw-justified', !!justified);
      try{ meta.lastJustified = !!justified; __hfx_wizMeta.set(el, meta); }catch(_mj){}
    }catch(_e){}
  };

  window.hfxSmartWizardSetToolbar = function(selector, pos){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var $wiz = $(el);
      var p = (pos || 'bottom').toLowerCase();
      var show = (p !== 'none');
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastToolbar === p) return;
      $wiz.smartWizard('setOptions', {
        toolbar: {
          position: p,
          buttons: {
            showNext: show,
            showPrevious: show
          }
        }
      });
      try{ meta.lastToolbar = p; __hfx_wizMeta.set(el, meta); }catch(_mb){}
    }catch(_e){}
  };

  window.hfxSmartWizardSetAccent = function(selector, accent){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var meta = __hfx_wizMeta.get(el) || _computeMeta(el);
      if(meta && meta.lastAccent === accent) return;
      el.classList.remove('hfx-sw-accent-blue','hfx-sw-accent-green','hfx-sw-accent-red','hfx-sw-accent-purple','hfx-sw-accent-sea');
      switch(accent){
        case 'Blue': el.classList.add('hfx-sw-accent-blue'); break;
        case 'Green': el.classList.add('hfx-sw-accent-green'); break;
        case 'Red': el.classList.add('hfx-sw-accent-red'); break;
        case 'Purple': el.classList.add('hfx-sw-accent-purple'); break;
        case 'Sea': el.classList.add('hfx-sw-accent-sea'); break;
      }
      try{ meta.lastAccent = accent; __hfx_wizMeta.set(el, meta); }catch(_ma){}
    }catch(_e){}
  };

  window.hfxSmartWizardDestroy = function(selector){
    try{
      var el = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!el) return;
      var ro = __hfx_wizObservers.get(el);
      if(ro){ try{ ro.disconnect(); }catch(_e){} __hfx_wizObservers.delete(el); }
      try{
        var $wiz = $(el);
        if($wiz && $wiz.off){
          $wiz.off('.hfxLegacyBridge .hfxProgress .hfxLayout .hfxSettle .hfxValidation .hfxCustomValidators .hfxAjax');
        }
      }catch(_off){}
      try{
        var $w = $(el);
        if($w && $w.smartWizard){ $w.smartWizard('destroy'); }
      }catch(_p){}
      try{ if(el.__hfx_fixScheduled) el.__hfx_fixScheduled = false; }catch(_f){}
      try{ __hfx_wizMeta.delete(el); }catch(_md){}
    }catch(_e){}
  };
})();
