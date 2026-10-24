// Report chapters share the shell's reveal and shown lifecycle. Template content is inert until selected.
(function () {
  if (window.hfxReportTabs) return;
  function all(root, selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); }
  function own(root, selector) { return all(root, selector).filter(function (el) { return el.closest('[data-hfx-rv-tabs]') === root; }); }
  function tabs(root) { return own(root, '[data-hfx-rv-tab]'); }
  function caption(tab) { return Array.prototype.map.call(tab.childNodes, function (node) { return (node.textContent || '').trim(); }).filter(Boolean).join(' '); }
  function materialize(panel) {
    var template = panel.querySelector(':scope > template[data-hfx-rv-lazy]');
    if (template) { panel.appendChild(template.content); template.remove(); }
    else if (panel.querySelector(':scope > [data-hfx-rv-lazy-gzip]')) return prepare(panel).then(function () { return materialize(panel); });
    // A deferred chapter's content loads before the chapter announces that it is shown.
    return window.hfxReportDeferred ? window.hfxReportDeferred.loadWithin(panel, { quiet: true }) : Promise.resolve();
  }
  function prepare(panel) {
    if (panel.__hfxPrepare) return panel.__hfxPrepare;
    var node = panel.querySelector(':scope > [data-hfx-rv-lazy-gzip]');
    panel.__hfxPrepare = (node ? window.hfxReportMarkup.read(node).then(function (html) {
      var holder = document.createElement('template'); holder.innerHTML = html;
      panel.appendChild(holder.content); node.remove();
    }) : Promise.resolve()).then(function () {
      // Drawings are safe to prepare inside inert templates. Controls and data sources stay lazy,
      // while native printing can synchronously include every chapter's complete SVG.
      var template = panel.querySelector(':scope > template[data-hfx-rv-lazy]');
      return window.hfxReportViews ? window.hfxReportViews.prepareDrawings(template ? template.content : panel) : undefined;
    });
    return panel.__hfxPrepare;
  }
  function laneLinks(scope) {
    all(scope, '[data-hfx-rv-lane-links]').forEach(function (root) {
      var links; try { links = JSON.parse(root.getAttribute('data-hfx-rv-lane-links')); } catch (_) { return; }
      all(root, 'svg').forEach(function (svg) {
        all(svg, '[data-cfx-role="state-lane-label"]').forEach(function (label, i) {
          if (!links[i] || label.parentNode.localName === 'a') return;
          var a = document.createElementNS('http://www.w3.org/2000/svg', 'a');
          a.setAttribute('href', links[i]); a.setAttribute('data-hfx-shell-entity', decodeURIComponent(links[i].slice(1)));
          a.setAttribute('tabindex', '0'); a.setAttribute('aria-label', label.textContent);
          label.parentNode.insertBefore(a, label); a.appendChild(label);
        });
      });
    });
  }
  function closeMenu(root, focus) {
    var menu = root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tabs-menu');
    var more = root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tabs-more');
    if (!menu || !more) return;
    menu.hidden = true; more.setAttribute('aria-expanded', 'false');
    if (focus) more.focus();
  }
  function binding(tab) {
    var spec;
    try { spec = JSON.parse(tab.getAttribute('data-hfx-rv-binding') || 'null'); } catch (_) { return; }
    if (!spec || !window.HfxDataExplorer) return;
    window.HfxDataExplorer.init(document);
    var explorer = window.HfxDataExplorer.get(spec.explorer);
    if (!explorer) return;
    if (spec.shortcut) {
      var node = document.getElementById(spec.shortcut) || document.getElementById(spec.explorer + '--' + spec.shortcut);
      if (!node || !explorer.root.contains(node)) return;
      try { explorer.apply(JSON.parse(node.getAttribute('data-hfx-dx-shortcut') || '{}')); } catch (_) { }
    } else explorer.apply({ view: spec.view });
  }
  function select(root, key, updateAddress, focus) {
    var items = tabs(root), selected = items.filter(function (t) { return t.getAttribute('data-hfx-rv-tab') === key; })[0];
    if (!selected) return false;
    var page = root.closest('[data-hfx-shell-page]');
    if (page && window.hfxReport) window.hfxReport.showPageIn(root.closest('[data-hfx-shell]'), page.getAttribute('data-hfx-shell-page'), { updateHash: false, scroll: false });
    items.forEach(function (tab) {
      var active = tab === selected;
      tab.setAttribute('aria-selected', active ? 'true' : 'false'); tab.tabIndex = active ? 0 : -1;
      var panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (!panel) return;
      if (active) panel.__hfxMaterialized = materialize(panel);
      panel.hidden = !active;
    });
    var panel = document.getElementById(selected.getAttribute('aria-controls'));
    if (updateAddress) {
      var address = selected.getAttribute('data-hfx-rv-address');
      if (window.hfxReport) window.hfxReport.setHash(address, true);
      else { try { history.pushState(null, '', String(location.href).replace(/#.*$/, '') + '#' + address); } catch (_) { } }
    }
    closeMenu(root, false);
    overflow(root);
    // Initial and history addresses keep the active chapter visible without scrolling the report vertically.
    if (window.innerWidth >= 768 && root.getAttribute('data-layout') !== 'vertical') {
      var list = selected.parentElement, itemBox = selected.getBoundingClientRect(), listBox = list.getBoundingClientRect();
      if (itemBox.left < listBox.left) list.scrollLeft += itemBox.left - listBox.left;
      else if (itemBox.right > listBox.right) list.scrollLeft += itemBox.right - listBox.right;
    }
    if (focus) {
      if (window.innerWidth < 768) root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tabs-more').focus();
      else selected.focus({ preventScroll: true });
    }
    if (panel) {
      Promise.resolve(panel.__hfxMaterialized).then(function () {
        if (panel.hidden) return;
        if (window.hfxReportViews) window.hfxReportViews.init(panel);
        if (window.HfxDataExplorer) window.HfxDataExplorer.init(panel);
        binding(selected);
        requestAnimationFrame(function () {
        Promise.resolve(window.hfxReportViews && window.hfxReportViews.ready).then(function () { laneLinks(panel); });
        try { if (window.htmlForgeXFlushWhenVisible) window.htmlForgeXFlushWhenVisible(panel); } catch (_) { }
        try { if (window.htmlForgeXRefreshVisible) window.htmlForgeXRefreshVisible(panel); } catch (_) { }
        panel.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true, detail: { page: root.getAttribute('data-hfx-rv-tabs'), tab: key } }));
        panel.dispatchEvent(new CustomEvent('hfx:report-tab-shown', { bubbles: true, detail: { page: root.getAttribute('data-hfx-rv-tabs'), tab: key } }));
        });
      });
    }
    return true;
  }
  function reveal(address) {
    var split = String(address || '').indexOf('/');
    if (split < 1) return false;
    var page = address.slice(0, split), key = address.slice(split + 1), found = false;
    all(document, '[data-hfx-rv-tabs]').some(function (root) {
      if (root.getAttribute('data-hfx-rv-tabs') !== page) return false;
      var aliases = {};
      try { aliases = JSON.parse(root.getAttribute('data-hfx-rv-aliases') || '{}'); } catch (_) { }
      found = select(root, Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : key, false, false); return found;
    });
    return found;
  }
  function fromAddress() {
    var address = ''; try { address = decodeURIComponent(location.hash.slice(1)); } catch (_) { address = location.hash.slice(1); }
    if (reveal(address)) return;
    // A history entry for a page without a chapter names its default panel, including a bundle/hosted initial URL.
    if (address.indexOf('/') >= 0) return;
    all(document, '[data-hfx-rv-tabs]').forEach(function (root) {
      var page = root.closest('[data-hfx-shell-page]');
      if ((address && root.getAttribute('data-hfx-rv-tabs') === address) || (!address && (!page || !page.hidden))) {
        var first = tabs(root)[0]; if (first) select(root, first.getAttribute('data-hfx-rv-tab'), false, false);
      }
    });
  }
  function overflow(root) {
    if (!root.getClientRects().length) return;
    var vertical = root.getAttribute('data-layout') === 'vertical' && window.innerWidth >= 768;
    var phone = window.innerWidth < 768;
    var list = root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tablist');
    var more = root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tabs-more');
    var menu = root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tabs-menu');
    if (!list || !more || !menu) return;
    list.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
    var items = tabs(root), current = items.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
    items.forEach(function (t) { t.hidden = false; });
    more.hidden = !phone; menu.textContent = '';
    if (phone) {
      items.forEach(function (tab) {
        var option = document.createElement('button'); option.type = 'button'; option.setAttribute('role', 'menuitemradio');
        option.setAttribute('aria-checked', tab.getAttribute('aria-selected')); option.setAttribute('data-hfx-rv-menu-tab', tab.getAttribute('data-hfx-rv-tab'));
        option.textContent = caption(tab); option.tabIndex = -1; menu.appendChild(option);
      });
      if (!more.__hfxLabel) more.__hfxLabel = more.textContent;
      more.textContent = current ? caption(current) + ' \u25be' : more.__hfxLabel;
    } else closeMenu(root, false);
    own(root, '[data-hfx-rv-scroll]').forEach(function (button) {
      button.hidden = phone || vertical || list.scrollWidth <= list.clientWidth + 1;
    });
  }
  function init(scope) {
    all(scope, '[data-hfx-rv-tabs]').forEach(function (root) {
      if (!root.hfxTabs) {
        root.hfxTabs = true;
        if (window.ResizeObserver) { var observer = new ResizeObserver(function () { overflow(root); }); observer.observe(root); }
      }
      overflow(root);
    });
  }
  document.addEventListener('click', function (e) {
    var target = e.target.closest && e.target.closest('[data-hfx-rv-tab], [data-hfx-rv-menu-tab], .hfx-rv-tabs-more, [data-hfx-rv-scroll]');
    if (!target) { all(document, '[data-hfx-rv-tabs]').forEach(function (root) { closeMenu(root, false); }); return; }
    var root = target.closest('[data-hfx-rv-tabs]');
    if (target.hasAttribute('data-hfx-rv-scroll')) {
      var list = root.querySelector(':scope > .hfx-rv-tabs-bar > .hfx-rv-tablist');
      list.scrollBy({ left: Number(target.getAttribute('data-hfx-rv-scroll')) * list.clientWidth * .75, behavior: 'smooth' }); return;
    }
    if (target.classList.contains('hfx-rv-tabs-more')) {
      var menu = root.querySelector('.hfx-rv-tabs-menu'), open = menu.hidden;
      menu.hidden = !open; target.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && menu.firstElementChild) menu.firstElementChild.focus(); return;
    }
    e.preventDefault();
    select(root, target.getAttribute('data-hfx-rv-tab') || target.getAttribute('data-hfx-rv-menu-tab'), true, true);
  });
  document.addEventListener('keydown', function (e) {
    var target = e.target, root = target.closest && target.closest('[data-hfx-rv-tabs]');
    if (!root) return;
    if (target.classList.contains('hfx-rv-tabs-more') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault(); var popup = root.querySelector('.hfx-rv-tabs-menu');
      popup.hidden = false; target.setAttribute('aria-expanded', 'true');
      var edge = e.key === 'ArrowUp' ? popup.lastElementChild : popup.firstElementChild;
      if (edge) edge.focus(); return;
    }
    var menu = target.closest('.hfx-rv-tabs-menu');
    if (menu) {
      if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); closeMenu(root, e.key === 'Escape'); return; }
      var options = all(menu, '[role=menuitemradio]'), index = options.indexOf(target);
      if (e.key === 'ArrowDown') index = (index + 1) % options.length;
      else if (e.key === 'ArrowUp') index = (index + options.length - 1) % options.length;
      else if (e.key === 'Home') index = 0;
      else if (e.key === 'End') index = options.length - 1;
      else return;
      e.preventDefault(); if (options[index]) options[index].focus(); return;
    }
    if (!target.hasAttribute('data-hfx-rv-tab')) return;
    var items = tabs(root), index = items.indexOf(target), vertical = root.getAttribute('data-layout') === 'vertical' && window.innerWidth >= 768;
    if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) index = (index + 1) % items.length;
    else if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) index = (index + items.length - 1) % items.length;
    else if (e.key === 'Home') index = 0;
    else if (e.key === 'End') index = items.length - 1;
    else return;
    e.preventDefault(); select(root, items[index].getAttribute('data-hfx-rv-tab'), true, true);
  });
  document.addEventListener('hfx:report-shown', function (e) { init(e.target); laneLinks(e.target); });
  document.addEventListener('hfx:report-drawings-ready', function (e) { laneLinks(e.target); });
  window.addEventListener('hashchange', fromAddress); window.addEventListener('popstate', fromAddress);
  window.addEventListener('resize', function () { all(document, '[data-hfx-rv-tabs]').forEach(overflow); });
  function printPanel(panel) {
      var materialized = materialize(panel);
      // Deferred content kept in the page prints with its chapter; content in files waits for the print command.
      if (window.hfxReportDeferred && window.hfxReportDeferred.printScope) window.hfxReportDeferred.printScope(panel);
      panel.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true, detail: { print: true } }));
      return Promise.resolve(materialized).then(function () {
        // A file-backed region can finish after the synchronous native print preparation.
        panel.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true, detail: { print: true } }));
      });
  }
  function printPanels() {
    return Promise.all(all(document, '[data-hfx-rv-panel]').map(printPanel));
  }
  window.addEventListener('beforeprint', printPanels);
  var ready = Promise.resolve();
  function start() {
    init(document); laneLinks(document);
    ready = Promise.all(all(document, '[data-hfx-rv-panel]').map(prepare)).then(function () { fromAddress(); });
    window.hfxReportTabs.ready = ready;
  }
  // The report runtime's print command waits for compressed chapters; without the runtime, Ctrl+P does. Chapters still
  // held as inert templates are put in the page first too, so what they hold (a data explorer) can prepare for print.
  (window.hfxReportPrintPreparers = window.hfxReportPrintPreparers || []).push({
    pending: function () { return !!document.querySelector('[data-hfx-rv-lazy-gzip], [data-hfx-rv-panel] > template[data-hfx-rv-lazy]'); },
    prepare: function () { return materializeAll(true); }
  });
  document.addEventListener('keydown', function (e) {
    if (window.hfxReport && window.hfxReport.print) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && document.querySelector('[data-hfx-rv-lazy-gzip]')) {
      e.preventDefault(); materializeAll(true).then(function () { window.print(); });
    }
  });
  // ------------------------------------------------------------ element links
  // A link to an element in a chapter whose content is not in the page yet: kept as an inert template, or as
  // compressed text whose ids the page lists (data-hfx-rv-targets). The chapter is selected like a tab switch, its
  // content put in place, and the link resolved again. An element already in the page is the shell's: revealElement
  // selects the chapters around it. A deferred region inside the chapter loads through its own revealer.
  function cssEscape(value) { try { return window.CSS && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&'); } catch (_) { return value; } }
  function listed(node, attribute, id) { try { return JSON.parse(node.getAttribute(attribute) || '[]').indexOf(id) >= 0; } catch (_) { return false; } }
  function holds(content, id) {
    if (!content) return false;
    try {
      if (content.getElementById ? content.getElementById(id) : content.querySelector('#' + cssEscape(id))) return true;
      if (content.querySelector('[data-hfx-rv-address="' + cssEscape(id) + '"]')) return true;
    } catch (_) { }
    return all(content, '[data-hfx-deferred-targets]').some(function (n) { return listed(n, 'data-hfx-deferred-targets', id); })
      || all(content, '[data-hfx-rv-targets]').some(function (n) { return listed(n, 'data-hfx-rv-targets', id); })
      || all(content, 'template').some(function (t) { return holds(t.content, id); });
  }
  function onPage(el, opts) {
    if (!opts || !opts.page) return true;
    var page = el.closest('[data-hfx-shell-page]');
    return !page || page.getAttribute('data-hfx-shell-page') === opts.page;
  }
  function heldBy(id, opts) {
    return all(document, '[data-hfx-rv-panel]').filter(function (panel) {
      if (!onPage(panel, opts)) return false;
      var template = panel.querySelector(':scope > template[data-hfx-rv-lazy]');
      if (template) return holds(template.content, id);
      return !!panel.querySelector(':scope > [data-hfx-rv-lazy-gzip]') && listed(panel, 'data-hfx-rv-targets', id);
    })[0] || null;
  }
  function openChapter(panel) {
    // Outer chapters first: a chapter inside another chapter's content.
    var chain = [];
    for (var p = panel; p; p = p.parentElement && p.parentElement.closest('[data-hfx-rv-panel]')) chain.unshift(p);
    chain.forEach(function (p) {
      var root = p.closest('[data-hfx-rv-tabs]');
      if (root && (p.hidden || p === panel)) select(root, p.getAttribute('data-hfx-rv-panel'), false, false);
    });
    return Promise.resolve(panel.__hfxMaterialized);
  }
  function revealHeld(id, opts) {
    if (!id || document.getElementById(id)) return false;
    var panel = heldBy(id, opts);
    if (!panel) return false;
    var requestedNavigation = window.hfxReport.navigationVersion();
    openChapter(panel).then(function () {
      if (window.hfxReport.navigationVersion() !== requestedNavigation) return;
      var again = {};
      for (var k in (opts || {})) if (Object.prototype.hasOwnProperty.call(opts, k)) again[k] = opts[k];
      again.instant = true;
      // Resolve another chapter that becomes reachable when its outer chapter opens, as well as live elements and
      // deferred regions. Require progress to a different holder so a stale index cannot repeat this chapter.
      var inPage = document.getElementById(id);
      var deferred = !inPage && all(panel, '[data-hfx-deferred]').some(function (r) { return listed(r, 'data-hfx-deferred-targets', id) || holds(r.querySelector(':scope > template[data-hfx-deferred-content]') ? r.querySelector(':scope > template[data-hfx-deferred-content]').content : null, id); });
      var next = !inPage && !deferred ? heldBy(id, again) : null;
      if (!inPage && !deferred && (!next || next === panel)) return;
      if (window.hfxReport && window.hfxReport.reveal) window.hfxReport.reveal(id, again);
      else if (inPage) { try { inPage.scrollIntoView({ block: 'start' }); } catch (_) { } }
    }, function () { });
    return true;
  }

  (window.hfxReportRevealers = window.hfxReportRevealers || []).push(reveal);
  window.hfxReportRevealers.push(revealHeld);
  // Puts every chapter's content in the page: for print with the print lifecycle, otherwise quietly (controls start
  // when their chapter is selected).
  function materializeAll(print) {
    var seen = [];
    function round() {
      var panels = all(document, '[data-hfx-rv-panel]').filter(function (panel) { return seen.indexOf(panel) < 0; });
      if (!panels.length) return;
      panels.forEach(function (panel) { seen.push(panel); });
      // A lazy chapter may itself contain more chapters. Exhaust that finite tree before reporting completion.
      return Promise.all(panels.map(print ? printPanel : materialize)).then(round);
    }
    return ready.then(round);
  }
  window.hfxReportTabs = { select: select, reveal: reveal, revealElement: revealHeld, init: init, ready: ready, materializeAll: materializeAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
