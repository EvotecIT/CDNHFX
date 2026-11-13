// HtmlForgeX deferred report content: regions whose content arrives when the reader needs it. A single file keeps a
// region's content in the page, compressed or as an inert template; a bundle or hosted page names the content file
// that registers it. Either way
// the region loads when it is shown or comes near the viewport, when a link names something inside it, or before print.
(function () {
  if (window.hfxReportDeferred) return;

  var fragments = {};   // key -> markup that arrived in a content file
  var chunkMap = null;  // content file id (group/index) -> address
  var printing = false;
  var LABELS = {
    failed: 'This section could not be loaded.',
    retry: 'Try again',
    unprinted: 'This section had not loaded when printing started. Print again from the report to include it.'
  };

  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function noop() { }

  function regionsIn(scope) {
    scope = scope || document;
    var list = qsa(scope, '[data-hfx-deferred]');
    if (scope.matches && scope.matches('[data-hfx-deferred]')) list.unshift(scope);
    return list;
  }
  function keyOf(region) { return region.getAttribute('data-hfx-deferred'); }
  function stateOf(region) { return region.getAttribute('data-hfx-deferred-state'); }
  function isOpen(region) { var s = stateOf(region); return s === 'pending' || s === 'failed' || s === 'loading'; }
  function setState(region, state) {
    region.setAttribute('data-hfx-deferred-state', state);
    if (state === 'loading') region.setAttribute('aria-busy', 'true'); else region.removeAttribute('aria-busy');
  }
  function label(region, name) { return region.getAttribute('data-hfx-deferred-' + name) || LABELS[name]; }
  function templateOf(region) { return region.querySelector(':scope > template[data-hfx-deferred-content]'); }
  function packedOf(region) { return region.querySelector(':scope > script[data-hfx-deferred-gzip]'); }
  // Whether the region's content can be inserted now, without waiting for a file or for decompression.
  function atHand(region) {
    var packed = packedOf(region);
    return !!(templateOf(region) || (packed && packed.__hfxText !== undefined) || own(fragments, keyOf(region)));
  }
  function statusOf(region) { return region.querySelector(':scope > [data-hfx-deferred-status]'); }
  // Rendered: not hidden, and not inside a closed disclosure or other content the browser skips.
  function visible(el) {
    if (!el) return false;
    if (typeof el.checkVisibility === 'function') { try { return el.checkVisibility(); } catch (_) { } }
    return !!(el.getClientRects && el.getClientRects().length);
  }

  function findRegion(key) {
    var found = null;
    regionsIn(document).some(function (r) { if (keyOf(r) === key) { found = r; return true; } return false; });
    return found;
  }

  // ---------------------------------------------------------- content files
  function readChunkMap() {
    if (!chunkMap) {
      chunkMap = {};
      qsa(document, 'script[data-hfx-deferred-chunks]').forEach(function (node) {
        try {
          var map = JSON.parse(node.textContent || '{}');
          for (var k in map) if (own(map, k) && typeof map[k] === 'string') chunkMap[k] = map[k];
        } catch (_) { }
      });
    }
    return chunkMap;
  }
  function chunkSrc(region) {
    var id = region.getAttribute('data-hfx-deferred-chunk');
    if (!id) return null;
    var map = readChunkMap();
    return own(map, id) ? map[id] : null;
  }
  // Content files push their regions onto window.hfxReportFragments, whichever script runs first.
  function installFragments() {
    var queue = window.hfxReportFragments;
    if (!queue || !queue.length) return;
    queue.splice(0, queue.length).forEach(function (list) {
      (list || []).forEach(function (f) { if (f && typeof f.key === 'string' && !own(fragments, f.key)) fragments[f.key] = String(f.html || ''); });
    });
  }
  function loadFile(src) {
    if (window.hfxReport && window.hfxReport.chunks) return window.hfxReport.chunks.load(src);
    return Promise.reject(new Error('The report runtime is missing.'));
  }

  // Markup becomes nodes of this document with its scripts left runnable: they run when the region is inserted, as the
  // scripts of a single file's template do.
  function parse(html) {
    var range = document.createRange();
    range.selectNodeContents(document.body || document.documentElement);
    return range.createContextualFragment(html);
  }

  // ----------------------------------------------------------------- states
  function setMessage(region, text) {
    var status = statusOf(region), message = status && status.querySelector('.hfx-rv-empty-message');
    if (message) message.textContent = text;
  }
  // Keeps the loading words of a region before another state replaces them.
  function remember(region) {
    var status = statusOf(region), m = status && status.querySelector('.hfx-rv-empty-message');
    if (m && status.__hfxLoading === undefined) status.__hfxLoading = m.textContent;
  }
  function fail(region) {
    setState(region, 'failed');
    var status = statusOf(region);
    if (!status) return;
    remember(region);
    status.setAttribute('data-kind', 'not-collected');
    setMessage(region, label(region, 'failed'));
    var text = status.querySelector('.hfx-rv-empty-text');
    if (text && !text.querySelector('[data-hfx-deferred-retry]')) {
      var action = document.createElement('div');
      action.className = 'hfx-rv-empty-action';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'hfx-as-fchip';
      button.setAttribute('data-hfx-deferred-retry', '1');
      button.textContent = label(region, 'retry');
      action.appendChild(button);
      text.appendChild(action);
    }
  }
  function resetStatus(region) {
    var status = statusOf(region);
    if (!status) return;
    status.setAttribute('data-kind', 'nothing');
    var action = status.querySelector('.hfx-rv-empty-action');
    if (action) action.parentNode.removeChild(action);
    if (status.__hfxLoading !== undefined) setMessage(region, status.__hfxLoading);
  }

  // The inserted content starts through the shell's shown lifecycle (explorers, CanopyX grids, charts, nested
  // chapters); content that is hidden starts when its page or chapter is shown.
  function announce(region, opts) {
    var key = keyOf(region);
    try { region.dispatchEvent(new CustomEvent('hfx:report-deferred-loaded', { bubbles: true, detail: { key: key } })); } catch (_) { }
    if (opts && opts.quiet) return;
    if (printing) {
      // Print-time content takes the print paths of its components (CanopyX static outlines, for example).
      try { region.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true, detail: { print: true } })); } catch (_) { }
      return;
    }
    if (!visible(region)) return;
    if (window.hfxReport && window.hfxReport.refreshVisible) window.hfxReport.refreshVisible(region);
    else { try { region.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true })); } catch (_) { } }
  }

  function insert(region, content, opts) {
    region.appendChild(content);
    setState(region, 'loaded');
    unobserve(region);
    watch(region);
    announce(region, opts);
  }

  // ------------------------------------------------------------------ load
  // Loads a region: a promise that settles when its content is in. A region in a template of the page is inserted at
  // once; a region in a content file waits for its file. A failed file can be tried again.
  function load(region, opts) {
    if (!region || !isOpen(region)) return Promise.resolve();
    if (region.__hfxDeferred) return region.__hfxDeferred;
    var tpl = templateOf(region);
    if (tpl) {
      // The template stays, so the region can be unloaded and loaded again.
      insert(region, document.importNode(tpl.content, true), opts);
      return Promise.resolve();
    }
    var packed = packedOf(region);
    if (packed) {
      // Compressed in the page: decompressed once, kept as text, so the region can be unloaded and loaded again.
      if (packed.__hfxText !== undefined) { insert(region, parse(packed.__hfxText), opts); return Promise.resolve(); }
      resetStatus(region);
      setState(region, 'loading');
      // A browser without DecompressionStream rejects here instead of throwing past the callers.
      var decoding = Promise.resolve().then(function () { return window.hfxReportMarkup.read(packed); }).then(function (html) {
        packed.__hfxText = html;
        region.__hfxDeferred = null;
        if (stateOf(region) !== 'loading') return;
        insert(region, parse(html), opts);
      }).catch(function (error) {
        region.__hfxDeferred = null;
        if (stateOf(region) === 'loading') fail(region);
        throw error;
      });
      region.__hfxDeferred = decoding;
      return decoding;
    }
    var key = keyOf(region);
    installFragments();
    if (own(fragments, key)) {
      insert(region, parse(fragments[key]), opts);
      return Promise.resolve();
    }
    var src = chunkSrc(region);
    if (!src) { fail(region); return Promise.reject(new Error('The content of ' + key + ' is not in this report.')); }
    resetStatus(region);
    setState(region, 'loading');
    var loading = loadFile(src).then(function () {
      installFragments();
      if (!own(fragments, key)) throw new Error('The file ' + src + ' has no content for ' + key + '.');
      region.__hfxDeferred = null;
      healFailed();
      if (stateOf(region) !== 'loading') return;
      insert(region, parse(fragments[key]), opts);
      prefetchAfter(region);
    }, function (error) { throw error; }).catch(function (error) {
      region.__hfxDeferred = null;
      if (stateOf(region) === 'loading') fail(region);
      throw error;
    });
    region.__hfxDeferred = loading;
    return loading;
  }

  // A file that arrives for one region also carries its neighbours: regions that failed with it get their content.
  function healFailed() {
    regionsIn(document).forEach(function (r) {
      if (stateOf(r) === 'failed' && own(fragments, keyOf(r))) { resetStatus(r); setState(r, 'pending'); load(r).catch(noop); }
    });
  }

  // Loads the regions a scope shows at once (deferred chapters, regions set to load when shown) and watches the
  // others; a chapter waits for this before it announces that it is shown.
  function loadWithin(scope, opts) {
    var waits = [];
    regionsIn(scope).forEach(function (region) {
      if (!isOpen(region)) return;
      if (region.getAttribute('data-hfx-deferred-load') === 'shown') waits.push(load(region, opts).catch(noop));
      else watch(region);
    });
    return Promise.all(waits);
  }

  // Loads every region, also the ones inserted content brings with it, for print and search.
  function loadAll() {
    var lazyPanels = '[data-hfx-rv-panel] > template[data-hfx-rv-lazy], [data-hfx-rv-panel] > [data-hfx-rv-lazy-gzip]';
    function round() {
      var beforeTabs = Array.prototype.slice.call(document.querySelectorAll(lazyPanels));
      var tabs = window.hfxReportTabs && window.hfxReportTabs.materializeAll ? window.hfxReportTabs.materializeAll(printing) : Promise.resolve();
      return Promise.resolve(tabs).then(function () {
        var open = regionsIn(document).filter(isOpen);
        return Promise.all(open.map(function (r) { return load(r, { quiet: !printing && !visible(r) }).catch(noop); })).then(function () {
          // Regions that failed stay failed; only new ones start another round.
          var next = regionsIn(document).filter(function (r) { var state = stateOf(r); return state === 'pending' || state === 'loading'; });
          if (!next.length && !document.querySelector(lazyPanels)) return;
          // Newly inserted regions can be arbitrarily deep. Continue while loading makes progress rather than
          // returning successfully at a fixed depth; a pending region that did not advance must not spin forever.
          var progressed = open.some(function (r) { return stateOf(r) === 'loaded'; })
            || next.some(function (r) { return open.indexOf(r) < 0; })
            || beforeTabs.some(function (tpl) { return !document.documentElement.contains(tpl); });
          if (!progressed) throw new Error('Deferred report content could not finish loading.');
          return round();
        });
      });
    }
    return round();
  }

  // Removes a region's content to free the page; it loads again when needed. Components inside retire through their
  // removal observers.
  function unload(target) {
    var region = typeof target === 'string' ? findRegion(target) : target;
    if (!region || stateOf(region) !== 'loaded') return false;
    if (!templateOf(region) && !packedOf(region) && !own(fragments, keyOf(region))) return false;
    Array.prototype.slice.call(region.childNodes).forEach(function (node) {
      if (node.nodeType === 1 && (node.hasAttribute('data-hfx-deferred-status') || node.hasAttribute('data-hfx-deferred-content') || node.hasAttribute('data-hfx-deferred-gzip'))) return;
      region.removeChild(node);
    });
    resetStatus(region);
    setState(region, 'pending');
    region.__hfxDeferred = null;
    region.__hfxObserved = false;
    watch(region);
    return true;
  }

  // ----------------------------------------------------- near the viewport
  function margin(region) { var m = parseInt(region.getAttribute('data-hfx-deferred-margin'), 10); return isNaN(m) ? 800 : m; }
  var observers = {};
  function unobserve(region) {
    for (var k in observers) if (own(observers, k)) observers[k].unobserve(region);
    region.__hfxObserved = false;
  }
  function observerFor(px) {
    if (!window.IntersectionObserver) return null;
    if (!observers[px]) {
      observers[px] = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observers[px].unobserve(entry.target);
          entry.target.__hfxObserved = false;
          load(entry.target).catch(noop);
        });
      }, { rootMargin: px + 'px 0px ' + px + 'px 0px' });
    }
    return observers[px];
  }

  // Watches the open regions of a scope: those that load when shown load once they are shown, the others when they
  // come near the viewport.
  function watch(scope) {
    regionsIn(scope).forEach(function (region) {
      if (stateOf(region) !== 'pending' || region.__hfxObserved) return;
      var shown = region.getAttribute('data-hfx-deferred-load') === 'shown';
      if (shown && visible(region)) { load(region).catch(noop); return; }
      // A region shown by something other than the shell (a disclosure, a host's toggle) loads when it becomes visible.
      var io = observerFor(shown ? 0 : margin(region));
      if (!io) { if (visible(region)) load(region).catch(noop); return; }
      region.__hfxObserved = true;
      io.observe(region);
    });
  }

  // --------------------------------------------------------------- prefetch
  function prefetchAfter(region) {
    var map = document.querySelector('script[data-hfx-deferred-chunks][data-hfx-deferred-prefetch]');
    if (!map) return;
    var all = regionsIn(document), at = all.indexOf(region), mine = chunkSrc(region);
    for (var i = at + 1; i < all.length; i++) {
      if (stateOf(all[i]) !== 'pending') continue;
      var src = chunkSrc(all[i]);
      if (!src || src === mine) continue;
      var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };
      idle(function () { loadFile(src).then(installFragments, noop); });
      return;
    }
  }

  // ------------------------------------------------------------- deep links
  function cssEscape(value) { try { return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&'); } catch (_) { return value; } }
  // Whether something a link names is inside content that is not in the page yet.
  function contains(content, id) {
    if (!content) return false;
    try {
      if (content.getElementById && content.getElementById(id)) return true;
      if (content.querySelector('[data-hfx-rv-address="' + cssEscape(id) + '"]')) return true;
    } catch (_) { }
    return qsa(content, '[data-hfx-deferred]').some(function (r) { return names(r, id); });
  }
  function names(region, id) {
    if (!isOpen(region)) return false;
    var tpl = templateOf(region);
    if (tpl) return contains(tpl.content, id);
    var raw = region.getAttribute('data-hfx-deferred-targets');
    if (!raw) return false;
    try { return JSON.parse(raw).indexOf(id) >= 0; } catch (_) { return false; }
  }
  function after(id, opts) {
    var el = document.getElementById(id);
    if (!window.hfxReport) return;
    var instant = {};
    for (var k in (opts || {})) if (own(opts, k)) instant[k] = opts[k];
    instant.instant = true;
    if (el) {
      window.hfxReport.revealElement(el, (opts && opts.hash) || id, instant);
      keepInView(el);
    } else window.hfxReport.reveal(id, instant);
  }
  // Regions above a target can load while the reader arrives there (they come near the viewport on the way) and push
  // it down. For a moment after a link was followed the target is put back, unless the reader scrolls themselves.
  function keepInView(el) {
    var stopped = false, want = null, events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    var requestedNavigation = window.hfxReport.navigationVersion();
    function stop() { stopped = true; }
    events.forEach(function (t) { window.addEventListener(t, stop, { passive: true }); });
    [80, 180, 340, 640, 1000, 1600, 2500].forEach(function (ms, i, all) {
      setTimeout(function () {
        if (!stopped && window.hfxReport.navigationVersion() === requestedNavigation && el.isConnected) {
          var top = el.getBoundingClientRect().top;
          if (want === null) want = top;
          else if (Math.abs(top - want) > 2) { try { el.scrollIntoView({ block: 'start', behavior: 'auto' }); } catch (_) { el.scrollIntoView(); } want = el.getBoundingClientRect().top; }
        }
        if (i === all.length - 1) events.forEach(function (t) { window.removeEventListener(t, stop, { passive: true }); });
      }, ms);
    });
  }
  // A revealer of the report runtime: a link to an element or chapter inside a region that has not loaded loads the
  // region first, then goes there. Content of a chapter that has not been opened (a lazy template) opens the chapter.
  function onPage(el, opts) {
    if (!opts || !opts.page) return true;
    var page = el.closest('[data-hfx-shell-page]');
    return !page || page.getAttribute('data-hfx-shell-page') === opts.page;
  }
  function reveal(id, opts) {
    if (!id || document.getElementById(id)) return false;
    var requestedNavigation = window.hfxReport.navigationVersion();
    var region = null;
    // With opts.page, only that page is searched, as the report runtime's revealer contract says.
    regionsIn(document).some(function (r) { if (onPage(r, opts) && names(r, id)) { region = r; return true; } return false; });
    if (region) {
      // A region that cannot load is shown with its failure and its "Try again" action instead.
      load(region).then(function () {
        if (window.hfxReport.navigationVersion() === requestedNavigation) after(id, opts);
      }, function () {
        if (window.hfxReport.navigationVersion() !== requestedNavigation) return;
        if (!window.hfxReport) return;
        window.hfxReport.revealElement(region, (opts && opts.hash) || id, { instant: true });
        keepInView(region);
      });
      return true;
    }
    var hit = null;
    qsa(document, 'template[data-hfx-rv-lazy]').some(function (tpl) { if (onPage(tpl, opts) && contains(tpl.content, id)) { hit = tpl; return true; } return false; });
    var panel = hit && hit.parentElement, root = panel && panel.closest('[data-hfx-rv-tabs]');
    if (!root || !window.hfxReportTabs) return false;
    var address = root.getAttribute('data-hfx-rv-tabs') + '/' + panel.getAttribute('data-hfx-rv-panel');
    if (!window.hfxReportTabs.reveal(address)) return false;
    Promise.resolve(panel.__hfxMaterialized).then(function () {
      var inner = null;
      regionsIn(panel).some(function (r) { if (names(r, id)) { inner = r; return true; } return false; });
      return inner ? load(inner) : null;
    }).then(function () {
      if (window.hfxReport.navigationVersion() === requestedNavigation) after(id, opts);
    }, noop);
    return true;
  }

  // ------------------------------------------------------------------ search
  function norm(s) { return (s || '').toString().toLowerCase(); }
  // Finds regions whose words contain every word of the query: loaded regions by their text, regions that have not
  // loaded by the index the host chose to write. The page's own text is the host's search.
  function search(query) {
    var terms = norm(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return regionsIn(document).filter(function (r) { return stateOf(r) !== 'omitted'; }).map(function (r) {
      var loaded = stateOf(r) === 'loaded';
      var text = loaded ? textOf(r) : r.getAttribute('data-hfx-deferred-text');
      if (text === null) return null;
      var hay = norm(text);
      if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return null;
      return { key: keyOf(r), title: r.getAttribute('aria-label') || r.getAttribute('data-hfx-deferred-title') || '', loaded: loaded, element: r };
    }).filter(Boolean);
  }
  function textOf(region) {
    var parts = [];
    Array.prototype.slice.call(region.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && (n.hasAttribute('data-hfx-deferred-status') || n.tagName === 'TEMPLATE' || n.tagName === 'SCRIPT')) return;
      parts.push(n.textContent || '');
    });
    return parts.join(' ');
  }
  // Opens a region a search found: its page or chapter is shown, the region loads and comes into view.
  function open(key) {
    var region = findRegion(key);
    if (!region) return Promise.resolve(false);
    var page = region.closest('[data-hfx-shell-page]');
    if (page && page.hidden && window.hfxReport) window.hfxReport.showPage(page.getAttribute('data-hfx-shell-page'), { updateHash: false, scroll: false });
    var panel = region.closest('[data-hfx-rv-panel]'), root = panel && panel.closest('[data-hfx-rv-tabs]');
    if (panel && panel.hidden && root && window.hfxReportTabs) window.hfxReportTabs.reveal(root.getAttribute('data-hfx-rv-tabs') + '/' + panel.getAttribute('data-hfx-rv-panel'));
    return load(region).then(function () {
      try { region.scrollIntoView({ block: 'start' }); } catch (_) { }
      return true;
    }, function () { return false; });
  }

  // ------------------------------------------------------------------- print
  // The browser's print event cannot wait: regions with their content at hand are inserted now, regions whose file has
  // not arrived print a statement. The report's print command loads every region first.
  // Inserts what can be inserted now in a scope; repeated for the regions inserted content brings with it.
  function printScope(scope) {
    var was = printing;
    printing = true;
    installFragments();
    for (var round = 0; round < 16; round++) {
      var inserted = false;
      regionsIn(scope).forEach(function (region) {
        if (!isOpen(region) || region.__hfxUnprinted) return;
        if (atHand(region)) {
          region.__hfxDeferred = null;
          setState(region, 'pending');
          load(region).catch(noop);
          inserted = true;
          return;
        }
        remember(region);
        setMessage(region, label(region, 'unprinted'));
        region.__hfxUnprinted = true;
      });
      if (!inserted) break;
    }
    // Insertions above were synchronous; later loads announce as print only during a print.
    printing = was;
  }
  function afterPrint() {
    printing = false;
    regionsIn(document).forEach(function (region) {
      if (!region.__hfxUnprinted) return;
      region.__hfxUnprinted = false;
      var status = statusOf(region);
      if (stateOf(region) === 'failed') setMessage(region, label(region, 'failed'));
      else if (status && status.__hfxLoading !== undefined) setMessage(region, status.__hfxLoading);
    });
  }
  window.addEventListener('beforeprint', function () { printScope(document); printing = true; });
  window.addEventListener('afterprint', afterPrint);
  // The report's print command (Ctrl+P, hfxReport.print) and a PDF renderer that calls hfxReport.preparePrint() wait
  // for this: every region is in the page afterwards, also without the browser's print event.
  (window.hfxReportPrintPreparers = window.hfxReportPrintPreparers || []).push({
    pending: function () {
      return regionsIn(document).some(isOpen)
        || qsa(document, 'template[data-hfx-rv-lazy]').some(function (t) { return !!t.content.querySelector('[data-hfx-deferred]'); });
    },
    prepare: function () {
      printing = true;
      return loadAll().then(function () { printing = false; }, function () { printing = false; });
    }
  });

  // ------------------------------------------------------------------ events
  document.addEventListener('click', function (e) {
    var retry = e.target && e.target.closest && e.target.closest('[data-hfx-deferred-retry]');
    if (!retry) return;
    var region = retry.closest('[data-hfx-deferred]');
    if (region) { e.preventDefault(); load(region).catch(noop); }
  });
  // A page, chapter or drawer panel was shown or inserted: its regions load or start watching.
  document.addEventListener('hfx:report-shown', function (e) {
    if (e.detail && e.detail.print) return;
    watch(e.target && e.target.querySelectorAll ? e.target : document);
  });

  // Compressed regions are decompressed to text while the browser is idle, one at a time, so the browser's own print
  // can insert them at once; their elements are still created only when they are shown. Regions of chapters that
  // were never opened keep their text when the chapter moves them into the page.
  function predecode() {
    var nodes = qsa(document, '[data-hfx-deferred] > script[data-hfx-deferred-gzip]');
    qsa(document, 'template[data-hfx-rv-lazy]').forEach(function (t) { nodes = nodes.concat(qsa(t.content, '[data-hfx-deferred] > script[data-hfx-deferred-gzip]')); });
    nodes = nodes.filter(function (n) { return n.__hfxText === undefined; });
    if (!nodes.length || typeof DecompressionStream === 'undefined') return;
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 50); };
    var i = 0;
    function next() {
      if (i >= nodes.length) return;
      var node = nodes[i++];
      if (node.__hfxText !== undefined) { idle(next); return; }
      Promise.resolve().then(function () { return window.hfxReportMarkup.read(node); })
        .then(function (html) { if (node.__hfxText === undefined) node.__hfxText = html; }, noop)
        .then(function () { idle(next); });
    }
    idle(next);
  }
  function start() {
    watch(document);
    // After the page has loaded, so it never competes with the first paint.
    if (document.readyState === 'complete') setTimeout(predecode, 0);
    else window.addEventListener('load', function () { setTimeout(predecode, 0); });
  }

  // The report runtime takes revealers from this queue whenever it resolves an address.
  (window.hfxReportRevealers = window.hfxReportRevealers || []).push(reveal);

  window.hfxReportDeferred = {
    printScope: printScope,
    load: function (target, opts) { var r = typeof target === 'string' ? findRegion(target) : target; return r ? load(r, opts) : Promise.resolve(); },
    loadWithin: loadWithin,
    loadAll: loadAll,
    unload: unload,
    search: search,
    open: open,
    state: function (key) { var r = findRegion(key); return r ? stateOf(r) : null; },
    keys: function () { return regionsIn(document).map(keyOf); }
  };
  if (window.hfxReport) window.hfxReport.deferred = window.hfxReportDeferred;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
