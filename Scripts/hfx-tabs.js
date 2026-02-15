// HtmlForgeX Tabs helper: persist last active tab per tabs header and provide optional reset
(function(){
  var tabsHeaderSelector = 'ul[data-bs-toggle="tabs"][data-hfx-tabs-id]';
  var tabsHeaderSavedSelector = tabsHeaderSelector + '[data-hfx-tabs-saved]';
  var segmentedHeaderSelector = 'ul[data-bs-toggle="tabs"].hfx-nav-segmented';
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

  function getTabApi(){
    try { return (window.bootstrap && window.bootstrap.Tab) || bootstrap.Tab; } catch(_e) { return null; }
  }
  function showTabLink(link){
    try {
      var Tab = getTabApi();
      if (!Tab || !link) return false;
      Tab.getOrCreateInstance(link).show();
      return true;
    } catch(_e){ return false; }
  }
  function getTabLinks(header){
    try {
      if (!header || !header.querySelectorAll) return [];
      return Array.prototype.slice.call(header.querySelectorAll('[data-bs-toggle="tab"]'));
    } catch(_e){ return []; }
  }
  function getActiveTabLink(header){
    try {
      if (!header || !header.querySelector) return null;
      var active = header.querySelector('[data-bs-toggle="tab"].active');
      if (active) return active;
      var links = getTabLinks(header);
      for (var i = 0; i < links.length; i++){
        var a = links[i];
        if (!a) continue;
        var disabled = (a.classList && a.classList.contains('disabled')) || !!a.getAttribute('disabled');
        if (!disabled) return a;
      }
    } catch(_e){ }
    return null;
  }
  function ensureSegmentedShell(header){
    try {
      if (!header || !header.parentElement) return null;
      var parent = header.parentElement;
      if (parent.classList && parent.classList.contains('hfx-seg-shell')) {
        return parent;
      }
      var shell = document.createElement('div');
      shell.className = 'hfx-seg-shell';
      parent.insertBefore(shell, header);
      shell.appendChild(header);
      return shell;
    } catch(_e){ return null; }
  }
  function ensureSegmentedThumb(header){
    try {
      if (!header || !header.querySelector) return null;
      var thumb = header.querySelector('.hfx-tabs-thumb');
      if (thumb) return thumb;
      thumb = document.createElement('span');
      thumb.className = 'hfx-tabs-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      header.appendChild(thumb);
      return thumb;
    } catch(_e){ return null; }
  }
  function scrollSegmentedBy(header, direction, amount){
    try {
      if (!header || !direction) return;
      var width = header.clientWidth || 0;
      var maxScroll = Math.max(0, (header.scrollWidth || 0) - width);
      if (maxScroll <= 0) return;
      var current = Math.max(0, header.scrollLeft || 0);
      var safe = Math.max(0, getSegmentedEdgeSafePx(header));
      var viewStart = current + safe;
      var items = [];
      try {
        items = Array.prototype.slice.call(header.querySelectorAll('.nav-item'));
      } catch(_itemsError) {
        items = [];
      }
      var next = current;
      if (items.length) {
        var alignedIndex = -1;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (!item || typeof item.offsetLeft !== 'number' || typeof item.offsetWidth !== 'number') continue;
          if (item.offsetLeft >= (viewStart - 1)) {
            alignedIndex = i;
            break;
          }
        }
        if (alignedIndex < 0) {
          alignedIndex = Math.max(0, items.length - 1);
        }
        var targetIndex = -1;
        if (direction > 0) {
          targetIndex = alignedIndex + 1;
        } else {
          targetIndex = alignedIndex - 1;
        }
        if (targetIndex < 0) {
          next = 0;
        } else if (targetIndex > (items.length - 1)) {
          next = maxScroll;
        } else if (direction > 0 && targetIndex >= (items.length - 1)) {
          next = maxScroll;
        } else if (direction < 0 && targetIndex <= 0) {
          next = 0;
        } else {
          var targetItem = items[targetIndex];
          if (targetItem && typeof targetItem.offsetLeft === 'number') {
            next = Math.max(0, targetItem.offsetLeft - safe);
          }
        }
      }
      if (Math.abs(next - current) < 1) {
        var step = (typeof amount === 'number' && amount > 0)
          ? amount
          : Math.max(140, Math.round(width * 0.55));
        next = Math.max(0, Math.min(maxScroll, current + (direction > 0 ? step : -step)));
      }
      next = Math.max(0, Math.min(maxScroll, next));
      if (Math.abs(next - current) < 1) return;
      try {
        header.scrollTo({ left: next, behavior: 'auto' });
      } catch(_smoothError) {
        header.scrollLeft = next;
      }
    } catch(_e){ }
  }
  function ensureSegmentedOverflowControls(header){
    try {
      if (!header) return;
      var shell = ensureSegmentedShell(header);
      if (!shell || shell.getAttribute('data-hfx-segmented-controls') === '1') return;
      shell.setAttribute('data-hfx-segmented-controls', '1');
      var createMask = function(side){
        var mask = document.createElement('span');
        mask.className = 'hfx-seg-mask hfx-seg-mask-' + side;
        mask.setAttribute('aria-hidden', 'true');
        return mask;
      };
      var createControl = function(direction){
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'hfx-seg-scroll hfx-seg-scroll-' + (direction < 0 ? 'left' : 'right');
        button.textContent = direction < 0 ? '\u2039' : '\u203A';
        button.setAttribute('aria-label', direction < 0 ? 'Scroll tabs left' : 'Scroll tabs right');
        button.setAttribute('tabindex', '-1');
        button.addEventListener('mousedown', function(ev){
          try { ev.preventDefault(); } catch(_e){}
        });
        button.addEventListener('click', function(ev){
          try {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          } catch(_e){}
          scrollSegmentedBy(header, direction);
        });
        return button;
      };
      shell.appendChild(createMask('left'));
      shell.appendChild(createMask('right'));
      shell.appendChild(createControl(-1));
      shell.appendChild(createControl(1));
    } catch(_e){ }
  }
  function initSegmentedWheel(header){
    try {
      if (!header || header.getAttribute('data-hfx-segmented-wheel') === '1') return;
      header.setAttribute('data-hfx-segmented-wheel', '1');
      header.addEventListener('wheel', function(ev){
        try {
          if (!header.classList || !header.classList.contains('hfx-nav-segmented-overflow')) return;
          if (!ev) return;
          var deltaX = typeof ev.deltaX === 'number' ? ev.deltaX : 0;
          var deltaY = typeof ev.deltaY === 'number' ? ev.deltaY : 0;
          var delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
          if (Math.abs(delta) < 1) return;
          var width = header.clientWidth || 0;
          var maxScroll = Math.max(0, (header.scrollWidth || 0) - width);
          if (maxScroll <= 0) return;
          var current = Math.max(0, header.scrollLeft || 0);
          var next = Math.max(0, Math.min(maxScroll, current + delta));
          if (Math.abs(next - current) < 1) return;
          ev.preventDefault();
          header.scrollLeft = next;
          positionSegmentedThumb(header, true, false);
        } catch(_e){}
      }, { passive: false });
    } catch(_e){ }
  }
  function parseCssLengthPx(value, referencePx, rootPx){
    try {
      var raw = (value || '').toString().trim().toLowerCase();
      if (!raw) return NaN;
      var num = parseFloat(raw);
      if (!isFinite(num)) return NaN;
      if (raw.endsWith('px')) return num;
      if (raw.endsWith('rem')) return num * (rootPx > 0 ? rootPx : 16);
      if (raw.endsWith('em')) return num * (referencePx > 0 ? referencePx : 16);
      return num;
    } catch(_e) {
      return NaN;
    }
  }
  function getSegmentedEdgeSafePx(header){
    try {
      if (!header) return 40;
      var style = null;
      var rootStyle = null;
      if (window.getComputedStyle) {
        style = window.getComputedStyle(header);
        rootStyle = window.getComputedStyle(document.documentElement || header);
      }
      var headerFont = parseFloat(style && style.fontSize ? style.fontSize : '');
      var rootFont = parseFloat(rootStyle && rootStyle.fontSize ? rootStyle.fontSize : '');
      if (!isFinite(headerFont) || headerFont <= 0) headerFont = 16;
      if (!isFinite(rootFont) || rootFont <= 0) rootFont = 16;
      var edgeRaw = style ? style.getPropertyValue('--hfx-seg-edge-safe') : '';
      var edgePx = parseCssLengthPx(edgeRaw, headerFont, rootFont);
      if (!isFinite(edgePx) || edgePx <= 0) edgePx = 40;
      return edgePx;
    } catch(_e){
      return 40;
    }
  }
  function ensureActiveSegmentedLinkVisible(header, link){
    try {
      if (!header || !link) return;
      var margin = 8;
      if (header.classList && header.classList.contains('hfx-nav-segmented-overflow')) {
        margin = Math.max(margin, getSegmentedEdgeSafePx(header));
      }
      var hostRect = header.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      if (!hostRect || !linkRect || !linkRect.width) return;
      var linkLeft = (linkRect.left - hostRect.left) + (header.scrollLeft || 0) - margin;
      var linkRight = linkLeft + linkRect.width + (margin * 2);
      var viewLeft = header.scrollLeft || 0;
      var viewRight = viewLeft + (header.clientWidth || 0);
      var nextLeft = null;
      if (linkLeft < viewLeft) {
        nextLeft = Math.max(0, linkLeft);
      } else if (linkRight > viewRight) {
        nextLeft = Math.max(0, linkRight - (header.clientWidth || 0));
      }
      if (nextLeft == null) return;
      if (Math.abs(nextLeft - viewLeft) < 1) return;
      header.scrollLeft = nextLeft;
    } catch(_e){ }
  }
  function updateSegmentedLayoutState(header){
    try {
      if (!header || !header.classList) return;
      var shell = ensureSegmentedShell(header);
      var links = getTabLinks(header);
      var segmentedMode = '';
      try {
        segmentedMode = (header.getAttribute('data-hfx-tabs-segmented-mode') || '').toLowerCase();
      } catch(_modeError) {
        segmentedMode = '';
      }
      var tops = [];
      var hasOverflow = false;
      var hostRect = null;
      try { hostRect = header.getBoundingClientRect(); } catch(_e) { hostRect = null; }
      for (var i = 0; i < links.length; i++){
        var link = links[i];
        if (!link) continue;
        var item = null;
        try { item = (link.closest && link.closest('.nav-item')) || link.parentElement; } catch(_e) { item = link.parentElement; }
        if (!item) item = link;
        var top = 0;
        try {
          if (hostRect && item.getBoundingClientRect) {
            var r = item.getBoundingClientRect();
            top = Math.round((r.top - hostRect.top) + header.scrollTop);
          } else if (typeof item.offsetTop === 'number') {
            top = Math.round(item.offsetTop || 0);
          }
        } catch(_e) {
          top = 0;
        }
        var exists = false;
        for (var t = 0; t < tops.length; t++) {
          if (Math.abs((tops[t] || 0) - top) <= 2) {
            exists = true;
            break;
          }
        }
        if (!exists) tops.push(top);
      }
      var lines = Math.max(1, tops.length);
      var hasWrapped = lines > 1;
      var overflowSlack = 8;
      try {
        hasOverflow = !!(header.scrollWidth > (header.clientWidth + overflowSlack));
      } catch(_e) {
        hasOverflow = hasWrapped;
      }
      var needsOverflowMode = segmentedMode === 'switcher'
        ? hasOverflow
        : (hasOverflow || hasWrapped);
      var scrollLeft = 0;
      var maxScrollLeft = 0;
      try {
        scrollLeft = Math.max(0, header.scrollLeft || 0);
        maxScrollLeft = Math.max(0, (header.scrollWidth || 0) - (header.clientWidth || 0));
      } catch(_e) {
        scrollLeft = 0;
        maxScrollLeft = 0;
      }
      var canScrollLeft = scrollLeft > 1;
      var canScrollRight = scrollLeft < (maxScrollLeft - 1);
      header.setAttribute('data-hfx-segmented-lines', String(lines));
      header.setAttribute('data-hfx-segmented-overflow', needsOverflowMode ? '1' : '0');
      header.setAttribute('data-hfx-segmented-can-left', canScrollLeft ? '1' : '0');
      header.setAttribute('data-hfx-segmented-can-right', canScrollRight ? '1' : '0');
      if (shell) {
        shell.setAttribute('data-hfx-segmented-overflow', needsOverflowMode ? '1' : '0');
        shell.setAttribute('data-hfx-segmented-can-left', canScrollLeft ? '1' : '0');
        shell.setAttribute('data-hfx-segmented-can-right', canScrollRight ? '1' : '0');
      }
      var leftControl = null;
      var rightControl = null;
      try {
        leftControl = shell ? shell.querySelector('.hfx-seg-scroll-left') : null;
        rightControl = shell ? shell.querySelector('.hfx-seg-scroll-right') : null;
      } catch(_controlFindError){
        leftControl = null;
        rightControl = null;
      }
      if (leftControl) {
        leftControl.disabled = !needsOverflowMode || !canScrollLeft;
      }
      if (rightControl) {
        rightControl.disabled = !needsOverflowMode || !canScrollRight;
      }

      if (needsOverflowMode) {
        header.classList.add('hfx-nav-segmented-overflow');
        header.classList.remove('hfx-nav-segmented-multiline');
        header.classList.remove('nav-fill');
        header.classList.remove('nav-justified');
        if (shell) shell.classList.add('hfx-seg-shell-overflow');
      } else {
        header.classList.remove('hfx-nav-segmented-overflow');
        header.classList.remove('hfx-nav-segmented-multiline');
        if (shell) shell.classList.remove('hfx-seg-shell-overflow');
      }
    } catch(_e){ }
  }
  function positionSegmentedThumb(header, immediate, keepActiveVisible){
    try {
      if (!header) return;
      updateSegmentedLayoutState(header);
      var thumb = ensureSegmentedThumb(header);
      if (!thumb) return;
      var active = getActiveTabLink(header);
      if (!active) {
        header.removeAttribute('data-hfx-segmented-ready');
        return;
      }
      var shouldEnsureActiveVisible = keepActiveVisible !== false && !immediate;
      if (shouldEnsureActiveVisible) {
        ensureActiveSegmentedLinkVisible(header, active);
      }
      var hostRect = header.getBoundingClientRect();
      var linkRect = active.getBoundingClientRect();
      if (!hostRect || !linkRect || !linkRect.width || !linkRect.height) {
        return;
      }
      var left = (linkRect.left - hostRect.left) + header.scrollLeft;
      var top = (linkRect.top - hostRect.top) + header.scrollTop;
      if (immediate) {
        thumb.style.transition = 'none';
      } else {
        thumb.style.transition = '';
      }
      thumb.style.width = Math.max(0, Math.round(linkRect.width)) + 'px';
      thumb.style.height = Math.max(0, Math.round(linkRect.height)) + 'px';
      thumb.style.transform = 'translate3d(' + Math.round(left) + 'px,' + Math.round(top) + 'px,0)';
      header.setAttribute('data-hfx-segmented-ready', '1');
      if (immediate) {
        setTimeout(function(){ try { thumb.style.transition = ''; } catch(_e){} }, 0);
      }
    } catch(_e){ }
  }
  function queueSegmentedRefresh(header, immediate, keepActiveVisible){
    try {
      if (!header) return;
      if (header.__hfxSegmentedRafQueued) return;
      header.__hfxSegmentedRafQueued = 1;
      var run = function(){
        try {
          header.__hfxSegmentedRafQueued = 0;
          positionSegmentedThumb(header, !!immediate, keepActiveVisible);
        } catch(_e){ }
      };
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(run);
      } else {
        setTimeout(run, 0);
      }
    } catch(_e){ }
  }
  function scheduleSegmentedWarmup(header){
    try {
      if (!header || header.__hfxSegmentedWarmupScheduled) return;
      header.__hfxSegmentedWarmupScheduled = 1;
      [0, 16, 64, 140].forEach(function(delay){
        setTimeout(function(){
          try { queueSegmentedRefresh(header, true, false); } catch(_e){}
        }, delay);
      });
    } catch(_e){ }
  }
  function refreshSegmented(root, immediate){
    try {
      var base = root || document;
      if (!base || !base.querySelectorAll) return;
      var headers = base.querySelectorAll(segmentedHeaderSelector);
      headers.forEach(function(header){
        if (!header) return;
        initSegmentedHeader(header);
        positionSegmentedThumb(header, !!immediate);
      });
    } catch(_e){ }
  }
  function showAdjacentSegmented(header, direction){
    try {
      if (!header || !direction) return false;
      var links = getTabLinks(header);
      if (!links.length) return false;
      var active = getActiveTabLink(header);
      if (!active) return false;
      var index = links.indexOf(active);
      if (index < 0) return false;
      var step = direction > 0 ? 1 : -1;
      for (var i = index + step; i >= 0 && i < links.length; i += step){
        var candidate = links[i];
        if (!candidate) continue;
        var disabled = (candidate.classList && candidate.classList.contains('disabled')) || !!candidate.getAttribute('disabled');
        if (disabled) continue;
        return showTabLink(candidate);
      }
    } catch(_e){ }
    return false;
  }
  function initSegmentedSwipe(header){
    try {
      if (!header || header.getAttribute('data-hfx-segmented-swipe') === '1') return;
      header.setAttribute('data-hfx-segmented-swipe', '1');
      var startX = 0;
      var startY = 0;
      var tracking = false;
      header.addEventListener('touchstart', function(ev){
        try {
          if (!ev || !ev.touches || ev.touches.length !== 1) return;
          var t = ev.touches[0];
          startX = t.clientX;
          startY = t.clientY;
          tracking = true;
        } catch(_e){}
      }, { passive: true });
      header.addEventListener('touchcancel', function(){ tracking = false; }, { passive: true });
      header.addEventListener('touchend', function(ev){
        try {
          if (!tracking || !ev || !ev.changedTouches || ev.changedTouches.length !== 1) return;
          tracking = false;
          var t = ev.changedTouches[0];
          var dx = t.clientX - startX;
          var dy = t.clientY - startY;
          if (Math.abs(dx) < 40 || Math.abs(dx) < (Math.abs(dy) + 12)) return;
          // Swipe left => next tab, swipe right => previous tab.
          showAdjacentSegmented(header, dx < 0 ? 1 : -1);
        } catch(_e){}
      }, { passive: true });
    } catch(_e){ }
  }
  function initSegmentedHeader(header){
    try {
      if (!header || header.getAttribute('data-hfx-segmented-init') === '1') return;
      header.setAttribute('data-hfx-segmented-init', '1');
      ensureSegmentedShell(header);
      ensureSegmentedThumb(header);
      initSegmentedSwipe(header);
      ensureSegmentedOverflowControls(header);
      initSegmentedWheel(header);
      header.addEventListener('scroll', function(){ queueSegmentedRefresh(header, true, false); }, { passive: true });
      if (window.ResizeObserver) {
        try {
          var ro = new ResizeObserver(function(){ queueSegmentedRefresh(header, true, false); });
          ro.observe(header);
          getTabLinks(header).forEach(function(link){ if (link) ro.observe(link); });
          header.__hfxSegmentedRo = ro;
        } catch(_e){}
      }
      if (window.MutationObserver) {
        try {
          var mo = new MutationObserver(function(){ queueSegmentedRefresh(header, true, false); });
          mo.observe(header, { childList: true, subtree: true, characterData: true });
          header.__hfxSegmentedMo = mo;
        } catch(_e){}
      }
      queueSegmentedRefresh(header, true, false);
      scheduleSegmentedWarmup(header);
    } catch(_e){ }
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
        ? root.querySelectorAll(tabsHeaderSavedSelector)
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
    window.hfxTabsApplySaved = function(root){
      var base = root || document;
      applySavedInRoot(base);
      refreshSegmented(base, true);
    };
  } catch(_){}

  document.addEventListener('shown.bs.tab', function(e){
    try {
      var link = e && (e.target || e.srcElement);
      var header = link && link.closest && link.closest('ul[data-bs-toggle="tabs"]');
      if (header) {
        var k = keyFor(header);
        var saved = buildSaved(link);
        if (k && saved) hfxStore.setItem(k, saved);
        if (header.matches && header.matches(segmentedHeaderSelector)) {
          positionSegmentedThumb(header, false);
        }
      }
      // When a tab pane becomes visible, apply any deferred saved selections inside it.
      applySavedInRoot(rootFromEvent(e));
      refreshSegmented(rootFromEvent(e), true);
    } catch(_){}
  });
  ['shown.bs.collapse','shown.bs.modal','shown.bs.offcanvas'].forEach(function(ev){
    document.addEventListener(ev, function(e){
      try {
        var root = rootFromEvent(e);
        applySavedInRoot(root);
        refreshSegmented(root, true);
      } catch(_){}
    }, true);
  });

  window.addEventListener('resize', function(){
    try { refreshSegmented(document, true); } catch(_e){}
  }, { passive: true });
  window.addEventListener('load', function(){
    try { refreshSegmented(document, true); } catch(_e){}
  });
  try {
    if (document && document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function(){
        try { refreshSegmented(document, true); } catch(_e){}
      });
    }
  } catch(_e){ }

  document.addEventListener('DOMContentLoaded', function(){
    try {
      document.querySelectorAll(tabsHeaderSelector).forEach(function(h){
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
      refreshSegmented(document, true);
      setTimeout(function(){ try { refreshSegmented(document, false); } catch(_e){} }, 0);
    } catch(_){}
  });

  // Expose helper for custom flows (wizard/stepper/show-hide) that need a manual refresh.
  try {
    window.hfxTabsRefreshSegmented = function(root){
      refreshSegmented(root || document, true);
    };
  } catch(_e) {}
})();
