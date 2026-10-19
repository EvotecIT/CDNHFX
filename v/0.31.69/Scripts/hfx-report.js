// HtmlForgeX report runtime: shell pages and navigation, deep links, the picker, the drawer, the time switch and print.
(function () {
  if (window.hfxReport) return;

  // Compressed report payloads are decoded once and remain inert until their owning view inserts them.
  window.hfxReportMarkup = { read: function (node) {
    if (node.__hfxDecoded) return node.__hfxDecoded;
    var raw = atob(node.textContent.trim()), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    node.__hfxDecoded = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return node.__hfxDecoded;
  } };

  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function closest(el, sel) { try { return el && el.closest ? el.closest(sel) : null; } catch (_) { return null; } }
  function norm(s) { return (s || '').toString().toLowerCase(); }
  function storeGet(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } }
  function storeSet(key, value) { try { window.localStorage.setItem(key, value); } catch (_) { } }

  function refreshVisible(root) {
    try { if (window.htmlForgeXFlushWhenVisible) window.htmlForgeXFlushWhenVisible(root); } catch (_) { }
    try { if (window.htmlForgeXRefreshVisible) window.htmlForgeXRefreshVisible(root); } catch (_) { }
    try {
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
        window.jQuery(root).find('table.dataTable').each(function () {
          try { window.jQuery(this).DataTable().columns.adjust(); } catch (_) { }
        });
      }
    } catch (_) { }
    applyTimes(root);
    try { root.dispatchEvent(new CustomEvent('hfx:report-shown', { bubbles: true })); } catch (_) { }
  }

  // ------------------------------------------------------------------ pages
  function shellOf(el) { return closest(el, '[data-hfx-shell]') || document.querySelector('[data-hfx-shell]'); }

  function pageKeyOf(el) {
    var p = closest(el, '[data-hfx-shell-page]');
    return p ? p.getAttribute('data-hfx-shell-page') : null;
  }

  // A return through history can restore the same address while superseding work started there.
  // Content revealers retain this revision until their asynchronous materialization completes.
  var navigationRevision = 0;
  function navigationVersion() { return navigationRevision; }

  function setHash(value, push) {
    navigationRevision++;
    // A host may inject <base href>, which would resolve a bare fragment against another document. Write the
    // fragment onto this document's own address, and ignore the rejection when the host does not allow it.
    try { if (push && currentHash() !== value) history.pushState(null, '', String(location.href).replace(/#.*$/, '') + '#' + value);
      else history.replaceState(null, '', String(location.href).replace(/#.*$/, '') + '#' + value); } catch (_) { }
  }

  function showPage(shell, key, opts) {
    if (!shell || !key) return false;
    var panel = null;
    qsa(shell, '[data-hfx-shell-page]').forEach(function (p) {
      if (p.getAttribute('data-hfx-shell-page') === key) panel = p;
    });
    if (!panel) return false;
    // A page or chapter choice supersedes a pending entity load, including navigation through pushState.
    closeDrawer(false);
    qsa(shell, '[data-hfx-shell-page]').forEach(function (p) {
      if (p === panel) p.removeAttribute('hidden'); else p.setAttribute('hidden', 'hidden');
    });
    // The top navigation is a tab list when every item is a page of this document, otherwise a list of links.
    qsa(shell, '.hfx-shell-nav-list > [data-hfx-shell-target]').forEach(function (t) {
      var on = t.getAttribute('data-hfx-shell-target') === key;
      if (t.getAttribute('role') === 'tab') {
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
      } else if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
      if (on) scrollNavItemIntoView(t);
    });
    qsa(shell, '.hfx-shell-side-item[data-hfx-shell-target]').forEach(function (t) {
      if (t.getAttribute('data-hfx-shell-target') === key) { t.setAttribute('aria-current', 'page'); sideItemIntoView(t); }
      else t.removeAttribute('aria-current');
    });
    setSideOpen(shell, false);
    // Collapsed navigation groups: mark the group item current and show which entry is open.
    qsa(shell, '[data-hfx-shell-group]').forEach(function (g) {
      var match = null;
      qsa(g, '[data-hfx-shell-target]').forEach(function (o) {
        var on = o.getAttribute('data-hfx-shell-target') === key;
        if (on) { match = o; o.setAttribute('aria-current', 'true'); } else o.removeAttribute('aria-current');
      });
      var trigger = g.querySelector('.hfx-shell-group-trigger');
      if (trigger) trigger.classList.toggle('is-current', !!match);
      var current = g.querySelector('[data-hfx-shell-group-current]');
      if (current) {
        var label = match && match.querySelector('.hfx-as-picker-opt-label');
        current.textContent = label ? label.textContent : '';
        if (match) current.removeAttribute('hidden'); else current.setAttribute('hidden', 'hidden');
      }
      if (match && trigger) scrollNavItemIntoView(trigger);
      updatePickerSteps(g);
    });
    if (!opts || opts.updateHash !== false) setHash(key, true);
    if (!opts || opts.scroll !== false) {
      try { window.scrollTo({ top: 0 }); } catch (_) { window.scrollTo(0, 0); }
    }
    setTimeout(function () { refreshVisible(panel); }, 0);
    return true;
  }

  // ------------------------------------------------------------- page files
  // A page without content in this document (another page of a bundle, a page a host serves) is reached through its
  // file; the shell lists those files in a JSON script. Links to pages from views (figures, queues, facts, matrix rows)
  // name the page key, so they work the same in a single file and in a bundle.
  var pageFiles = null;
  function pageFileOf(key) {
    if (pageFiles === null) {
      pageFiles = {};
      qsa(document, 'script[data-hfx-shell-pages]').forEach(function (node) {
        try {
          var map = JSON.parse(node.textContent || '{}');
          for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k) && typeof map[k] === 'string') pageFiles[k] = map[k];
        } catch (_) { }
      });
    }
    // Keys match exactly, as the pages of the document do.
    var file = key && Object.prototype.hasOwnProperty.call(pageFiles, key) ? pageFiles[key] : null;
    return file ? safePageHref(file) : null;
  }

  // The file a page link goes to, or null when its target is in this document (an element, or a page shown here).
  function pageLinkFile(key) {
    if (!key || document.getElementById(key)) return null;
    var pageKey = key.split('/')[0], fragment = key.indexOf('/') > 0 ? '#' + key : '';
    var shell = document.querySelector('[data-hfx-shell]');
    if (shell && qsa(shell, '[data-hfx-shell-page]').some(function (p) { return p.getAttribute('data-hfx-shell-page') === pageKey; })) return null;
    var file = pageFileOf(pageKey);
    return file ? file + fragment : null;
  }

  // Gives a page link of a page kept in another file that file as its address, so opening it in a new tab, copying
  // it and a host's base address all lead to the page.
  function pointToFile(link) {
    var file = link && pageLinkFile(link.getAttribute('data-hfx-as-link'));
    if (file && link.getAttribute('href') !== file) link.setAttribute('href', file);
    return file;
  }

  function goToPageFile(key) {
    var file = pageLinkFile(key);
    if (!file) return false;
    try { window.location.assign(file); } catch (_) { }
    return true;
  }

  function scrollNavItemIntoView(item) {
    var list = closest(item, '.hfx-shell-nav-list');
    if (!list) return;
    if (list.scrollWidth > list.clientWidth) {
      var left = item.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
      if (left < list.scrollLeft || left + item.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = Math.max(0, left - 24);
      }
    }
    updateNavOverflow(list);
  }

  // Scroll hints on the navigation strip when it is wider than the bar (narrow screens, many pages).
  function updateNavOverflow(list) {
    var nav = closest(list, '.hfx-shell-nav');
    if (!nav) return;
    var max = list.scrollWidth - list.clientWidth;
    nav.setAttribute('data-overflow-start', list.scrollLeft > 2 ? '1' : '0');
    nav.setAttribute('data-overflow-end', max - list.scrollLeft > 2 ? '1' : '0');
  }

  // ------------------------------------------------------ sidebar navigation
  var SIDE_STORE = 'hfx-shell-side-collapsed';
  function isNarrow() {
    try { return window.matchMedia('(max-width: 991.98px)').matches; } catch (_) { return window.innerWidth < 992; }
  }
  // On narrow screens the sidebar is a drawer over the page.
  function setSideOpen(shell, open) {
    if (!shell || !shell.classList.contains('has-sidebar')) return;
    var toggle = shell.querySelector('[data-hfx-shell-side-toggle]');
    // A closed drawer is hidden: focus that is inside it goes back to the button that opens it.
    var side = shell.querySelector('[data-hfx-shell-side]');
    var hadFocus = !open && side && side.contains(document.activeElement);
    shell.classList.toggle('is-side-open', !!open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (hadFocus && toggle && isNarrow()) { try { toggle.focus(); } catch (_) { } }
  }
  // On wide screens it collapses to an icon rail; the choice is remembered in this browser.
  function setSideCollapsed(shell, collapsed) {
    if (!shell) return;
    shell.classList.toggle('is-side-collapsed', !!collapsed);
    storeSet(SIDE_STORE, collapsed ? '1' : '0');
  }
  function toggleSide(shell, collapseOnly) {
    if (!shell) return;
    if (!collapseOnly && isNarrow()) setSideOpen(shell, !shell.classList.contains('is-side-open'));
    else setSideCollapsed(shell, !shell.classList.contains('is-side-collapsed'));
  }
  function sideItemIntoView(item) {
    var scroll = closest(item, '.hfx-shell-side-scroll');
    if (!scroll) return;
    var r = item.getBoundingClientRect(), s = scroll.getBoundingClientRect();
    if (r.top < s.top || r.bottom > s.bottom) scroll.scrollTop += r.top - s.top - s.height / 3;
  }
  // Filters entries by their text; a group heading that matches keeps all of its entries.
  function filterSide(input) {
    var shell = shellOf(input);
    var terms = norm(input.value).split(/\s+/).filter(Boolean);
    function matches(text) { var hay = norm(text); return terms.every(function (t) { return hay.indexOf(t) >= 0; }); }
    qsa(shell, '.hfx-shell-side-list > li:not(.hfx-shell-side-group)').forEach(function (li) { li.hidden = !matches(li.textContent); });
    qsa(shell, '.hfx-shell-side-group').forEach(function (group) {
      var heading = group.querySelector('.hfx-shell-side-heading');
      var headingMatch = terms.length > 0 && heading && matches(heading.textContent);
      var any = false;
      qsa(group, '.hfx-shell-side-sublist > li').forEach(function (li) {
        li.hidden = !(headingMatch || matches(li.textContent));
        if (!li.hidden) any = true;
      });
      group.hidden = !any;
    });
  }
  function syncBarHeight(shell) {
    var bar = shell && shell.querySelector('.hfx-shell-bar');
    if (bar && bar.offsetHeight) shell.style.setProperty('--as-bar-offset', bar.offsetHeight + 'px');
  }

  // ----------------------------------------------------------------- reveal
  function showBootstrapPanes(el) {
    // Walk outward and activate any Bootstrap tab panes that contain the element.
    var panes = [];
    var n = el;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains('tab-pane')) panes.unshift(n);
      n = n.parentElement;
    }
    panes.forEach(function (pane) {
      if (pane.classList.contains('active')) return;
      var id = pane.id;
      if (!id) return;
      var trigger = document.querySelector('[data-bs-target="#' + id + '"], [href="#' + id + '"][data-bs-toggle]');
      if (!trigger) return;
      try {
        if (window.bootstrap && window.bootstrap.Tab) { window.bootstrap.Tab.getOrCreateInstance(trigger).show(); return; }
      } catch (_) { }
      try { trigger.click(); } catch (_) { }
    });
  }

  // Walk outward and select every report chapter (ReportTabs panel) that holds the element and is not shown.
  // Returns the promise of the innermost chapter's content being in place, or null when nothing was hidden.
  function showReportTabs(el) {
    var panels = [];
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hasAttribute && n.hasAttribute('data-hfx-rv-panel')) panels.unshift(n);
    }
    if (!panels.length || !window.hfxReportTabs || !window.hfxReportTabs.select) return null;
    var shown = null;
    panels.forEach(function (panel) {
      if (!panel.hidden) return;
      var root = panel.closest('[data-hfx-rv-tabs]');
      if (root && window.hfxReportTabs.select(root, panel.getAttribute('data-hfx-rv-panel'), false, false)) shown = panel.__hfxMaterialized || true;
    });
    return shown;
  }

  // An explorer shortcut that came into the page with its chapter missed the click or hash change that names it.
  function applyShortcutTarget(el) {
    if (!el.hasAttribute || !el.hasAttribute('data-hfx-dx-shortcut') || !window.HfxDataExplorer || !window.HfxDataExplorer.applyShortcut) return;
    try { window.HfxDataExplorer.applyShortcut(el); } catch (_) { }
  }

  // Content libraries register a revealer for targets only they can find (for example content kept in a template).
  // A revealer returns true when it has shown the target.
  var revealers = [];

  function revealElement(target, id, opts) {
    // The reader goes to something in the page: the drawer would cover it.
    closeDrawer(false);
    var key = pageKeyOf(target);
    if (key) showPage(shellOf(target), key, { updateHash: false, scroll: false });
    for (var ancestor = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
    var chapter = showReportTabs(target);
    showBootstrapPanes(target);
    setHash(id);
    var requestedNavigation = navigationVersion();
    Promise.resolve(chapter).then(function () {
      if (navigationVersion() !== requestedNavigation) return;
      applyShortcutTarget(target);
      setTimeout(function () {
        if (navigationVersion() !== requestedNavigation) return;
        try { target.scrollIntoView({ block: 'start', behavior: (opts && opts.instant) ? 'auto' : 'smooth' }); } catch (_) { target.scrollIntoView(); }
      }, 30);
    });
    return true;
  }

  // A content library whose script runs before this one leaves its revealer on window.hfxReportRevealers. A
  // revealer gets the target and options; options.page, when set, is the only page it may look in.
  function runRevealers(id, opts) {
    var queue = window.hfxReportRevealers;
    if (queue && queue.length) {
      queue.splice(0, queue.length).forEach(function (fn) { if (typeof fn === 'function') revealers.push(fn); });
    }
    for (var i = 0; i < revealers.length; i++) {
      try { if (revealers[i](id, opts) === true) return true; } catch (_) { }
    }
    return false;
  }

  function reveal(id, opts) {
    if (!id) return false;
    navigationRevision++;
    if (runRevealers(id, opts)) return true;
    var target = document.getElementById(id);
    if (!target) {
      var shell = document.querySelector('[data-hfx-shell]');
      // A page of this report kept in another file: go there.
      return (shell ? showPage(shell, id, opts) : false) || goToPageFile(id);
    }
    if (target.hasAttribute('data-hfx-shell-page')) {
      return showPage(shellOf(target), target.getAttribute('data-hfx-shell-page'), opts);
    }
    return revealElement(target, (opts && opts.hash) || id, opts);
  }

  // --------------------------------------------------------------- entities
  // Entity links use the shared scheme "<type>/<key>" (for example dc/DC1.corp.example or gpo/<guid>). An entity opens
  // in the drawer when the page carries a panel for it; otherwise the shell goes to the page the manifest names.
  var ENTITY = /^([a-z][a-z0-9-]*)\/(.+)$/i;
  // One revision of an entity (a policy version, an incident update) is "<type>/<key>/rev/<n>". It resolves to its
  // entity: the entity's page and index entry, and its panel unless the revision has a panel of its own.
  var REVISION = /^(.+)\/rev\/([^\/]+)$/i;
  var entityIndex = null;

  // A key may itself contain "/rev/": an id the entity index knows as it is, is an entity, never a revision.
  function revisionOf(id) {
    var m = REVISION.exec(String(id || ''));
    if (!m || !ENTITY.test(m[1])) return null;
    if (Object.prototype.hasOwnProperty.call(readEntityIndex(), String(id).toLowerCase())) return null;
    return { base: m[1], revision: m[2] };
  }

  // The index entry of an entity, or of the entity a revision belongs to.
  function entityEntry(id) {
    var index = readEntityIndex(), lower = String(id || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(index, lower)) return index[lower];
    var rev = revisionOf(id);
    return rev && Object.prototype.hasOwnProperty.call(index, rev.base.toLowerCase()) ? index[rev.base.toLowerCase()] : null;
  }

  function addEntities(items) {
    (items || []).forEach(function (e) { if (e && e.id) entityIndex[String(e.id).toLowerCase()] = e; });
  }

  // The index is inline for a small report. A bundle shares one script file between its pages; that file pushes
  // its entries onto window.hfxReportEntities, whichever script runs first.
  function readEntityIndex() {
    if (!entityIndex) {
      entityIndex = {};
      qsa(document, 'script[data-hfx-shell-entities]').forEach(function (node) {
        try { addEntities(JSON.parse(node.textContent || '[]')); } catch (_) { }
      });
    }
    var queue = window.hfxReportEntities;
    if (queue && queue.length) { queue.splice(0, queue.length).forEach(addEntities); }
    return entityIndex;
  }

  // ----------------------------------------------------------- panel files
  // A bundle writes its entity panels once, into panel files next to the pages, and the shared entity index names the
  // file of each panel (window.hfxReportPanelFiles). The file is loaded when a link to one of its entities is followed;
  // it pushes its panels onto window.hfxReportPanels, which become the same templates a single file carries.
  var panelFiles = null;
  function readPanelFiles() {
    if (!panelFiles) panelFiles = {};
    var queue = window.hfxReportPanelFiles;
    if (queue && queue.length) {
      queue.splice(0, queue.length).forEach(function (map) {
        for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k) && typeof map[k] === 'string') panelFiles[k.toLowerCase()] = map[k];
      });
    }
    return panelFiles;
  }

  // The panel file of an entity, or of the entity a revision without a file of its own belongs to.
  function panelFileOf(id) {
    var files = readPanelFiles(), lower = String(id || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(files, lower)) return files[lower];
    var rev = revisionOf(id);
    return rev && Object.prototype.hasOwnProperty.call(files, rev.base.toLowerCase()) ? files[rev.base.toLowerCase()] : null;
  }

  function hasPanel(id) { return !!(entityPanel(id) || panelFileOf(id)); }

  function installPanels() {
    var queue = window.hfxReportPanels;
    if (!queue || !queue.length) return;
    var holder = document.querySelector('[data-hfx-shell]') || document.body;
    queue.splice(0, queue.length).forEach(function (list) {
      (list || []).forEach(function (p) {
        if (!p || !p.id || exactPanel(p.id)) return;
        var tpl = document.createElement('template');
        tpl.setAttribute('data-hfx-shell-entity-panel', p.id);
        tpl.setAttribute('data-hfx-shell-entity-title', p.title || '');
        tpl.setAttribute('data-hfx-shell-entity-size', p.size || 'regular');
        if (p.eyebrow) tpl.setAttribute('data-hfx-shell-entity-eyebrow', p.eyebrow);
        // Parsed in a document without a window, so nothing in it loads or runs yet, but with its scripts left runnable:
        // they run when the panel opens, as they do from a template of a single file.
        var inert = document.implementation.createHTMLDocument('');
        var range = inert.createRange();
        range.selectNodeContents(inert.body);
        tpl.content.appendChild(range.createContextualFragment(p.html || ''));
        holder.appendChild(tpl);
      });
    });
  }

  // Loads the panel file of an entity when its panel is not in the page yet: a promise, or null when nothing needs
  // loading. A file that fails to load can be tried again.
  function loadPanel(id) {
    var inline = entityPanel(id), compressed = inline && inline.content.querySelector('[data-hfx-shell-panel-gzip]');
    if (compressed) return window.hfxReportMarkup.read(compressed).then(function (html) {
      if (!compressed.parentNode) return;
      var holder = document.createElement('template'); holder.innerHTML = html;
      inline.content.appendChild(holder.content); compressed.remove();
    });
    if (exactPanel(id)) return null;
    // A revision with a panel of its own loads it, even when its entity's panel is already in the page.
    var files = readPanelFiles(), own = Object.prototype.hasOwnProperty.call(files, String(id).toLowerCase());
    if (!own && entityPanel(id)) return null;
    var file = panelFileOf(id), src = file && safePageHref(file);
    if (!src) return null;
    return loadChunk(src).then(installPanels);
  }

  // ----------------------------------------------------------- chunk files
  // Files a packager wrote next to the page (entity panels, deferred content) are scripts that push their entries onto
  // a global array. A script element loads them, which works from file:// and under an injected <base href>, where
  // fetch does not. Each file loads once; a file that fails to load can be tried again.
  var chunkLoads = {};
  function loadChunk(src) {
    if (!chunkLoads[src]) {
      chunkLoads[src] = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.onload = function () { resolve(); };
        script.onerror = function () { delete chunkLoads[src]; reject(new Error('The file ' + src + ' could not be loaded.')); };
        script.src = src;
        document.head.appendChild(script);
      });
    }
    return chunkLoads[src];
  }

  // Only files of the report (relative, file or http(s) addresses) load; anything else is refused.
  function loadReportChunk(src) {
    var safe = safePageHref(src);
    return safe ? loadChunk(safe) : Promise.reject(new Error('The address ' + src + ' is not a file of this report.'));
  }

  function exactPanel(id) {
    var lower = id.toLowerCase();
    var found = null;
    qsa(document, 'template[data-hfx-shell-entity-panel]').forEach(function (tpl) {
      if (!found && (tpl.getAttribute('data-hfx-shell-entity-panel') || '').toLowerCase() === lower) found = tpl;
    });
    return found;
  }

  // The panel of an entity; for a revision, its own panel or else the panel of its entity.
  function entityPanel(id) {
    var own = exactPanel(id);
    if (own) return own;
    var rev = revisionOf(id);
    return rev ? exactPanel(rev.base) : null;
  }

  function entityLinks(link) {
    var scope = closest(link, '[data-hfx-shell-entity-set]') || closest(link, 'tr, ul, ol, table');
    var seen = {};
    var links = scope ? qsa(scope, '[data-hfx-shell-entity]').filter(function (a) {
      var id = (a.getAttribute('data-hfx-shell-entity') || '').toLowerCase();
      if (!id || seen[id] || !hasPanel(id)) return false;
      seen[id] = true;
      return true;
    }) : [];
    return links.length ? links : [link];
  }

  // The entities a drawer steps through: identifiers with a panel, each once, compared without case.
  function entityIds(ids) {
    var seen = {};
    return (ids || []).map(function (id) { return id == null ? '' : String(id); }).filter(function (id) {
      var lower = id.toLowerCase();
      if (!id || seen[lower] || !hasPanel(id)) return false;
      seen[lower] = true;
      return true;
    });
  }

  function entityDrawerOptions(id, ids, index, returnFocus) {
    var tpl = entityPanel(id);
    if (!tpl) return null;
    var entry = entityEntry(id) || {};
    var eyebrow = tpl.getAttribute('data-hfx-shell-entity-eyebrow') || entry.kind || '';
    // The entity's panel stands in for a revision without one of its own: the eyebrow names the revision.
    var rev = revisionOf(id);
    if (rev && !exactPanel(id)) {
      var drawerNode = document.querySelector('[data-hfx-shell-revision-label]');
      var template = (drawerNode && drawerNode.getAttribute('data-hfx-shell-revision-label')) || 'Revision {n}';
      // A function replacement, so "$" in a revision taken from the address is text, not a pattern.
      var named = template.replace(/\{n\}/g, function () { return rev.revision; });
      eyebrow = eyebrow ? eyebrow + ' \u00b7 ' + named : named;
    }
    return {
      entityId: id,
      content: document.importNode(tpl.content, true),
      eyebrow: eyebrow,
      title: tpl.getAttribute('data-hfx-shell-entity-title') || entry.title || id,
      size: tpl.getAttribute('data-hfx-shell-entity-size') || 'regular',
      index: index,
      count: ids.length,
      returnFocus: returnFocus,
      onStep: function (next) {
        var nextId = ids[next];
        // The neighbour's panel may be in another panel file: the drawer fills when it has arrived.
        var loading = loadPanel(nextId);
        if (!loading) return entityDrawerOptions(nextId, ids, next, returnFocus);
        return loading.then(function () { return entityDrawerOptions(nextId, ids, next, returnFocus); });
      },
      onContext: (entry.page || entry.file) ? function () { goToEntity(id, entry); } : null
    };
  }

  // Hosted reports can name an address for entities the report does not contain, for example /entity/{type}/{key}.
  function hostedEntityAddress(id) {
    var shell = document.querySelector('[data-hfx-shell]');
    var template = shell && shell.getAttribute('data-hfx-shell-entity-address');
    // A revision's address is its entity's, with the revision in {revision} when the host names one.
    var rev = revisionOf(id);
    var parts = ENTITY.exec(rev ? rev.base : id);
    if (!template || !parts) return null;
    return template.replace(/\{type\}/g, function () { return encodeURIComponent(parts[1]); })
      .replace(/\{key\}/g, function () { return encodeURIComponent(parts[2]); })
      .replace(/\{revision\}/g, function () { return rev ? encodeURIComponent(rev.revision) : ''; });
  }

  function goToEntity(id, entry) {
    // Going to the entity's page (from a link inside the drawer, or its context action): the drawer would cover it.
    closeDrawer(false);
    if (!entry) {
      // A row of a component in this report comes before the address a host has for entities the report lacks.
      if (runRevealers(id, {})) return true;
      var hosted = safePageHref(hostedEntityAddress(id), true);
      if (!hosted) return false;
      try { window.location.assign(hosted); } catch (_) { }
      return true;
    }
    var shell = document.querySelector('[data-hfx-shell]');
    var local = entry.page && shell && qsa(shell, '[data-hfx-shell-page]').some(function (p) { return p.getAttribute('data-hfx-shell-page') === entry.page; });
    if (local) {
      showPage(shell, entry.page, { updateHash: false });
      // Commit the reader's entity address once, before a grid selects its row. A revealer may otherwise write
      // its own address first, replacing the source page and making Back remain on the entity's page.
      setHash(id, true);
      var anchor = entry.anchor && document.getElementById(entry.anchor);
      // An anchor inside content that has not loaded yet (a deferred region, an unopened chapter) is found by its
      // library, which keeps the entity's address. Without an anchor the entity may be a row inside a component of that
      // page, which only its library can find.
      if (anchor) revealElement(anchor, id, {});
      else if (!(entry.anchor && runRevealers(entry.anchor, { page: entry.page, hash: id }))) runRevealers(id, { page: entry.page });
      return true;
    }
    var href = safePageHref(entry.file);
    if (href) {
      // Another file of the bundle: an ordinary relative link, resolved the way the browser resolves every link.
      try { window.location.assign(href + '#' + encodeURI(id).replace(/#/g, '%23')); } catch (_) { }
      return true;
    }
    return false;
  }

  // Pages of a report are files or http(s) addresses; anything else (a script address, for example) is refused.
  function safePageHref(value, keepFragment) {
    var s = String(value || '').trim();
    if (!keepFragment) s = s.replace(/#.*$/, '');
    if (!s) return null;
    try {
      var url = new URL(s, document.baseURI || location.href);
      return (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:') ? s : null;
    } catch (_) { return null; }
  }

  // Counts what the reader does with the drawer, so a panel file that arrives late opens nothing they moved on from.
  var entityTicket = 0;

  function openEntity(id, link) {
    var ids = link ? entityLinks(link).map(function (a) { return a.getAttribute('data-hfx-shell-entity'); }) : [];
    return openEntityAmong(id, ids, link || null);
  }

  // The entity a link address names: an address of this document (or a bare fragment, which a link resolves against
  // the base address) whose fragment is an entity identifier that no element carries. Null for any other address.
  function entityFromHref(href) {
    try {
      var url = new URL(String(href || ''), document.baseURI || location.href);
      if (!url.hash) return null;
      var same = function (base) {
        var other = new URL(base);
        return url.origin === other.origin && url.pathname === other.pathname && url.search === other.search;
      };
      if (!same(location.href) && !(document.baseURI && same(document.baseURI))) return null;
      var id = url.hash.slice(1);
      try { id = decodeURIComponent(id); } catch (_) { }
      return ENTITY.test(id) && !document.getElementById(id) ? id : null;
    } catch (_) { return null; }
  }

  // Opens one of several entities, for example the rows of a list or a grid: its panel opens in the drawer, whose
  // previous and next buttons step through the others that have a panel, in the given order. An entity without a panel
  // goes to its page, or to the address a hosted report names for it. Returns false when the report knows nothing
  // that shows the entity, so the caller can show it another way.
  function openEntities(ids, index, returnFocus) {
    var list = (ids || []).map(function (id) { return id == null ? '' : String(id); });
    var id = list[index];
    return !!id && openEntityAmong(id, list, returnFocus || null);
  }

  function openEntityAmong(id, ids, returnFocus) {
    if (!id) return false;
    entityTicket++;
    if (hasPanel(id)) {
      var lower = id.toLowerCase();
      ids = entityIds(ids);
      // Several links may name the same entity; the position is the entity's, not the clicked link's.
      var index = ids.findIndex(function (other) { return other.toLowerCase() === lower; });
      if (index < 0) { ids = [id]; index = 0; }
      var open = function () {
        var options = entityDrawerOptions(id, ids, index, returnFocus);
        return !!options && openDrawer(options);
      };
      var loading = loadPanel(id);
      if (!loading) {
        if (open()) return true;
      } else {
        // A panel in a panel file of a bundle opens once its file has arrived, unless the reader has opened, closed or
        // followed something else meanwhile; without the panel the entity's page opens, or the element it names.
        var ticket = ++entityTicket;
        var elsewhere = function () { if (!goToEntity(id, entityEntry(id))) reveal(id, {}); };
        // The ticket is checked once, before anything is tried: opening the drawer counts as an action itself.
        loading.then(function () { if (ticket === entityTicket && !open()) elsewhere(); }, function () { if (ticket === entityTicket) elsewhere(); });
        return true;
      }
    }
    return goToEntity(id, entityEntry(id));
  }

  // ----------------------------------------------------------------- drawer
  // One drawer per page. Content is either moved in from a source element and moved back when the drawer closes or
  // steps (so nothing is duplicated and widgets keep their state), or supplied as a fragment.
  var drawer = null; // { wrap, options, source, returnFocus }
  var drawerLabels = { close: 'Close', previous: 'Previous', next: 'Next', context: 'Show in page', print: 'Print this record', record: 'Record' };

  function drawerWrap(options) {
    var shell = options.shell ? shellOf(options.shell) : document.querySelector('[data-hfx-shell]');
    var wrap = shell && shell.querySelector('[data-hfx-shell-drawer-wrap]');
    if (wrap) return wrap;
    // A shell rendered without a drawer has turned it off: links then go to their target instead.
    if (shell) return null;
    wrap = document.querySelector('body > [data-hfx-shell-drawer-wrap]');
    return wrap || buildDrawer(options.labels || {});
  }

  // Pages without a shell (a lone component) get the same drawer, created on first use.
  function buildDrawer(custom) {
    var labels = {};
    for (var name in drawerLabels) labels[name] = custom[name] || drawerLabels[name];
    function el(tag, cls, attrs) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
      return n;
    }
    var id = 'hfx-shell-drawer-' + Math.random().toString(36).slice(2, 8);
    var wrap = el('div', 'hfx-as hfx-shell-drawer-wrap', { 'data-hfx-shell-drawer-wrap': '1', hidden: 'hidden' });
    wrap.appendChild(el('div', 'hfx-shell-drawer-backdrop', { 'data-hfx-shell-drawer-close': '1' }));
    var aside = el('div', 'hfx-shell-drawer', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-title', 'data-hfx-shell-drawer': '1', tabindex: '-1' });
    var head = el('div', 'hfx-shell-drawer-head');
    var titles = el('div', 'hfx-shell-drawer-titles');
    titles.appendChild(el('p', 'hfx-as-eyebrow', { 'data-hfx-shell-drawer-eyebrow': '1' }));
    var row = el('div', 'hfx-shell-drawer-title-row');
    row.appendChild(el('h2', '', { id: id + '-title', 'data-hfx-shell-drawer-title': '1' }));
    row.appendChild(el('span', '', { 'data-hfx-shell-drawer-status': '1' }));
    titles.appendChild(row);
    head.appendChild(titles);
    var actions = el('div', 'hfx-shell-drawer-actions');
    var nav = el('div', 'hfx-shell-drawer-nav', { 'data-hfx-shell-drawer-nav': '1', hidden: 'hidden' });
    var prev = el('button', 'hfx-shell-drawer-step', { type: 'button', 'data-hfx-shell-drawer-step': '-1', 'aria-label': labels.previous, title: labels.previous });
    prev.textContent = '‹';
    var next = el('button', 'hfx-shell-drawer-step', { type: 'button', 'data-hfx-shell-drawer-step': '1', 'aria-label': labels.next, title: labels.next });
    next.textContent = '›';
    nav.appendChild(prev);
    nav.appendChild(el('span', 'hfx-shell-drawer-pos', { 'data-hfx-shell-drawer-pos': '1', 'aria-live': 'polite' }));
    nav.appendChild(next);
    actions.appendChild(nav);
    var print = el('button', 'hfx-as-linkbtn', { type: 'button', 'data-hfx-shell-drawer-print': '1', 'data-hfx-shell-record-label': labels.record });
    print.textContent = labels.print;
    actions.appendChild(print);
    var context = el('button', 'hfx-as-linkbtn', { type: 'button', 'data-hfx-shell-drawer-context': '1', hidden: 'hidden' });
    context.textContent = labels.context;
    actions.appendChild(context);
    var close = el('button', 'hfx-shell-drawer-close', { type: 'button', 'data-hfx-shell-drawer-close': '1', 'aria-label': labels.close, title: labels.close });
    close.textContent = '×';
    actions.appendChild(close);
    head.appendChild(actions);
    aside.appendChild(head);
    aside.appendChild(el('div', 'hfx-shell-drawer-body', { 'data-hfx-shell-drawer-body': '1' }));
    wrap.appendChild(aside);
    document.body.appendChild(wrap);
    return wrap;
  }

  function restoreDrawerContent() {
    if (!drawer) return;
    var body = drawer.wrap.querySelector('[data-hfx-shell-drawer-body]');
    if (drawer.source) {
      while (body.firstChild) drawer.source.appendChild(body.firstChild);
      var restored = drawer.source;
      setTimeout(function () { if (!closest(restored, '[hidden]')) refreshVisible(restored); }, 0);
      drawer.source = null;
    } else {
      while (body.firstChild) body.removeChild(body.firstChild);
    }
  }

  function fillDrawer(options) {
    var wrap = drawer.wrap;
    // Content of another owner (an explorer's record, an entity) takes the drawer: the one it replaces is told, so
    // it does not go on believing it is open.
    var previous = drawer.options;
    if (previous && previous !== options && previous.owner && previous.owner !== options.owner && typeof previous.onClose === 'function') {
      try { previous.onClose(); } catch (_) { }
    }
    restoreDrawerContent();
    drawer.options = options;
    var body = wrap.querySelector('[data-hfx-shell-drawer-body]');
    if (options.source) {
      while (options.source.firstChild) body.appendChild(options.source.firstChild);
      drawer.source = options.source;
    } else if (options.content) {
      body.appendChild(options.content);
    }
    wrap.querySelector('[data-hfx-shell-drawer]').setAttribute('data-size', options.size || 'wide');
    wrap.querySelector('[data-hfx-shell-drawer-eyebrow]').textContent = options.eyebrow || '';
    wrap.querySelector('[data-hfx-shell-drawer-title]').textContent = options.title || '';
    var status = wrap.querySelector('[data-hfx-shell-drawer-status]');
    status.innerHTML = '';
    if (options.status) status.appendChild(options.status);
    var nav = wrap.querySelector('[data-hfx-shell-drawer-nav]');
    var count = options.count || 0, index = options.index || 0;
    if (count > 1 && typeof options.onStep === 'function') {
      nav.removeAttribute('hidden');
      wrap.querySelector('[data-hfx-shell-drawer-pos]').textContent = localeNumber(index + 1) + ' / ' + localeNumber(count);
      qsa(nav, '[data-hfx-shell-drawer-step]').forEach(function (b) {
        var next = index + parseInt(b.getAttribute('data-hfx-shell-drawer-step'), 10);
        b.disabled = next < 0 || next >= count;
      });
    } else {
      nav.setAttribute('hidden', 'hidden');
    }
    var context = wrap.querySelector('[data-hfx-shell-drawer-context]');
    if (context) { if (typeof options.onContext === 'function') context.removeAttribute('hidden'); else context.setAttribute('hidden', 'hidden'); }
    body.scrollTop = 0;
    // Commit the address after content is applied, for both initial opens and guarded asynchronous steps.
    if (options.entityId) setHash(options.entityId, true);
    setTimeout(function () { refreshVisible(body); }, 0);
  }

  function localeNumber(n) { try { return Number(n).toLocaleString(); } catch (_) { return String(n); } }

  // The page under an open drawer does not scroll. The open state stays on the drawer itself: a class or a style on
  // <html> or <body> would restyle the whole document (every page of a single file) each time the drawer opens. So a
  // wheel or touch movement over the drawer scrolls only something inside it that can still scroll that way, a scroll
  // key scrolls the drawer's body or nothing, and anything else that moves the page (its scroll bar, an embedded
  // frame) is put back.
  function canScroll(el, stop, dx, dy) {
    for (var n = el; n && n !== stop && n.nodeType === 1; n = n.parentElement) {
      // Only an element with something to scroll needs its style read.
      var vertical = dy && n.scrollHeight > n.clientHeight + 1, horizontal = dx && n.scrollWidth > n.clientWidth + 1;
      if (!vertical && !horizontal) continue;
      var style = window.getComputedStyle(n);
      if (vertical && /(auto|scroll)/.test(style.overflowY) && (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
      if (horizontal && /(auto|scroll)/.test(style.overflowX) && (dx < 0 ? n.scrollLeft > 0 : n.scrollLeft + n.clientWidth < n.scrollWidth - 1)) return true;
    }
    return false;
  }

  // A movement scrolls along its main axis; Shift with a vertical wheel scrolls sideways.
  function canScrollBy(el, stop, dx, dy, shift) {
    if (shift && !dx) { dx = dy; dy = 0; }
    return Math.abs(dx) > Math.abs(dy) ? canScroll(el, stop, dx, 0) : canScroll(el, stop, 0, dy);
  }

  // Guarded drawers, the most recently opened last. A drawer a host removed from the page no longer counts.
  var guardedDrawers = [];
  function openGuardedDrawer(target) {
    var latest = null;
    for (var i = guardedDrawers.length - 1; i >= 0; i--) {
      var wrap = guardedDrawers[i];
      if (wrap.hidden || !wrap.isConnected) continue;
      if (!target || wrap.contains(target)) return wrap;
      if (!latest) latest = wrap;
    }
    return latest;
  }

  var SCROLL_KEYS = { PageDown: 1, PageUp: -1, ArrowDown: 1, ArrowUp: -1, End: 1, Home: -1, ' ': 1 };
  var TEXT_INPUT = /^(text|search|email|url|tel|password|number|date|datetime-local|month|week|time|radio|range)$/;

  // Whether the focused control uses the key itself, so it must reach it: text entry, choices and sliders use every
  // scroll key, buttons and check boxes use Space.
  function usesKey(t, key) {
    var tag = t.tagName || '';
    if (tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return true;
    if (tag === 'INPUT') return TEXT_INPUT.test((t.type || 'text').toLowerCase()) || key === ' ';
    return key === ' ' && !!closest(t, 'button, summary, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"]');
  }

  // Runs after the drawer's own controls (grids, pickers, tab lists) had the key: what they did not use scrolls the
  // drawer's body, never the page. With the focus outside the body (the dialog, its title bar, or the page after the
  // focused content was replaced) the body scrolls by the key.
  function drawerScrollKey(e) {
    var dir = SCROLL_KEYS[e.key];
    if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var wrap = openGuardedDrawer(e.target);
    if (!wrap || usesKey(e.target, e.key)) return;
    if (e.key === ' ' && e.shiftKey) dir = -1;
    var body = wrap.__hfxScrollBody, inside = body && body.contains(e.target);
    if (inside && canScroll(e.target, wrap, 0, dir)) return;
    e.preventDefault();
    if (!body || inside) return;
    var page = Math.max(40, body.clientHeight - 40);
    body.scrollTop += e.key === 'Home' ? -body.scrollHeight : e.key === 'End' ? body.scrollHeight : /Arrow/.test(e.key) ? dir * 40 : dir * page;
  }

  function keepPageStill() {
    var wrap = openGuardedDrawer();
    if (!wrap || !wrap.__hfxScrollAt) return;
    var at = wrap.__hfxScrollAt;
    if (window.scrollX !== at[0] || window.scrollY !== at[1]) {
      try { window.scrollTo({ left: at[0], top: at[1], behavior: 'instant' }); } catch (_) { window.scrollTo(at[0], at[1]); }
    }
  }

  // A new size or zoom moves the page under the drawer: where it is then is where it stays.
  function recordPagePosition() {
    var wrap = openGuardedDrawer();
    if (wrap) wrap.__hfxScrollAt = [window.scrollX, window.scrollY];
  }

  // Installs the guards on a drawer once: the report drawer, and the data explorer's own drawer outside a shell. Call
  // it before the drawer is shown each time: it records where the page is, which is where it stays.
  function guardDrawerScroll(wrap, body) {
    if (!wrap) return;
    wrap.__hfxScrollAt = [window.scrollX, window.scrollY];
    if (body) wrap.__hfxScrollBody = body;
    var known = guardedDrawers.indexOf(wrap);
    if (known >= 0) guardedDrawers.splice(known, 1);
    if (!guardedDrawers.length && known < 0 && !window.__hfxDrawerGuards) {
      window.__hfxDrawerGuards = true;
      window.addEventListener('keydown', drawerScrollKey);
      window.addEventListener('scroll', keepPageStill, { passive: true });
      window.addEventListener('resize', recordPagePosition, { passive: true });
    }
    guardedDrawers.push(wrap);
    if (wrap.__hfxScrollGuard) return;
    wrap.__hfxScrollGuard = true;
    wrap.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !canScrollBy(e.target, wrap, e.deltaX, e.deltaY, e.shiftKey)) e.preventDefault();
    }, { passive: false });
    var touch = null;
    function at(e) { return { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    wrap.addEventListener('touchstart', function (e) { touch = e.touches.length === 1 ? at(e) : null; }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) { touch = null; return; }
      var now = at(e);
      // A move without movement (a change of pressure) decides nothing: cancelling it would end the gesture's scroll.
      if (touch && now.x === touch.x && now.y === touch.y) return;
      // A finger moving up scrolls the content down.
      if (touch && e.cancelable && !canScrollBy(e.target, wrap, touch.x - now.x, touch.y - now.y, false)) e.preventDefault();
      touch = now;
    }, { passive: false });
  }

  function openDrawer(options) {
    if (!options) return false;
    entityTicket++;
    var wrap = drawerWrap(options);
    if (!wrap) return false;
    if (drawer && drawer.wrap !== wrap) closeDrawer(false);
    var wasHidden = wrap.hasAttribute('hidden');
    if (!drawer || drawer.wrap !== wrap) drawer = { wrap: wrap, options: null, source: null, returnFocus: options.returnFocus || null };
    else if (wasHidden) drawer.returnFocus = options.returnFocus || null;
    fillDrawer(options);
    if (wasHidden) {
      guardDrawerScroll(wrap, wrap.querySelector('[data-hfx-shell-drawer-body]'));
      wrap.removeAttribute('hidden');
      try { wrap.querySelector('[data-hfx-shell-drawer]').focus({ preventScroll: true }); } catch (_) { }
    }
    return true;
  }

  function stepDrawer(delta) {
    if (!drawer || !drawer.options || typeof drawer.options.onStep !== 'function') return;
    var next = (drawer.options.index || 0) + delta;
    if (next < 0 || next >= (drawer.options.count || 0)) return;
    var options = drawer.options.onStep(next);
    if (options && typeof options.then === 'function') {
      // The next panel is on its way: fill the drawer when it arrives, unless the reader has moved on or closed it.
      var from = drawer.options;
      options.then(function (ready) { if (ready && drawerIsOpen() && drawer.options === from) fillDrawer(ready); }, function () { });
    } else if (options) fillDrawer(options);
  }

  function drawerIsOpen() { return !!drawer && !drawer.wrap.hasAttribute('hidden'); }

  // Returns the options the drawer was showing, so a caller can act on what was open.
  function closeDrawer(focusBack) {
    entityTicket++;
    if (!drawerIsOpen()) return null;
    var options = drawer.options;
    restoreDrawerContent();
    drawer.wrap.setAttribute('hidden', 'hidden');
    if (options && typeof options.onClose === 'function') { try { options.onClose(); } catch (_) { } }
    if (focusBack !== false && drawer.returnFocus) { try { drawer.returnFocus.focus({ preventScroll: true }); } catch (_) { } }
    return options;
  }

  // Only the disposed content owner can release these callbacks, including after an ordinary close.
  function releaseDrawer(owner) {
    if (!drawer || !drawer.options || drawer.options.owner !== owner) return;
    var options = drawer.options;
    if (drawerIsOpen()) closeDrawer(false);
    if (drawer.options !== options) return;
    restoreDrawerContent();
    drawer.options = null; drawer.returnFocus = null;
  }

  // ----------------------------------------------------------------- picker
  // Drop-down used for collapsed navigation groups, long scope lists and the display settings. The panel is
  // fixed-positioned so the scrolling navigation strip or toolbars do not clip it.
  var openPicker = null;

  function placePicker(picker) {
    var btn = picker.querySelector('[data-hfx-as-picker-toggle]');
    var panel = picker.querySelector('.hfx-as-picker-panel');
    if (!btn || !panel) return;
    var r = btn.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var width = Math.min(Math.max(r.width, parseInt(picker.getAttribute('data-hfx-as-picker-width'), 10) || 320), vw - 16);
    var left = picker.hasAttribute('data-hfx-as-picker-end') ? r.right - width : r.left;
    left = Math.min(Math.max(8, left), vw - width - 8);
    var below = vh - r.bottom - 18;
    var above = r.top - 18;
    panel.style.width = width + 'px';
    panel.style.left = left + 'px';
    // Open upwards when the trigger sits low in the viewport and there is more room above.
    if (below < 260 && above > below) {
      panel.style.maxHeight = Math.min(above, 520) + 'px';
      panel.style.top = Math.max(8, r.top - 6 - panel.offsetHeight) + 'px';
    } else {
      panel.style.maxHeight = Math.max(160, Math.min(below, 560)) + 'px';
      panel.style.top = (r.bottom + 6) + 'px';
    }
  }

  function setPickerOpen(picker, open, focusTrigger) {
    if (!picker) return;
    var btn = picker.querySelector('[data-hfx-as-picker-toggle]');
    var panel = picker.querySelector('.hfx-as-picker-panel');
    if (!btn || !panel) return;
    if (open) {
      if (openPicker && openPicker !== picker) setPickerOpen(openPicker, false);
      panel.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
      picker.classList.add('is-open');
      placePicker(picker);
      openPicker = picker;
      var input = panel.querySelector('[data-hfx-as-picker-search]');
      var current = panel.querySelector('[aria-current="true"], [aria-checked="true"]');
      var first = input || current || panel.querySelector('[data-hfx-as-picker-opt], button, a[href], input');
      try { if (first) first.focus({ preventScroll: true }); } catch (_) { }
      // Scroll only the option list; scrollIntoView would also scroll the page and close the picker.
      var list = panel.querySelector('.hfx-as-picker-list');
      if (current && list) {
        var top = current.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
        if (top + current.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = Math.max(0, top - 8);
      }
    } else {
      panel.setAttribute('hidden', 'hidden');
      btn.setAttribute('aria-expanded', 'false');
      picker.classList.remove('is-open');
      if (openPicker === picker) openPicker = null;
      if (focusTrigger) { try { btn.focus(); } catch (_) { } }
    }
  }

  function syncPicker(picker, option) {
    if (!picker || !option || !picker.hasAttribute('data-hfx-as-picker-sync')) return;
    var label = picker.querySelector('[data-hfx-as-picker-label]');
    var srcLabel = option.querySelector('.hfx-as-picker-opt-label');
    if (label && srcLabel) label.textContent = srcLabel.textContent;
    var count = picker.querySelector('[data-hfx-as-picker-count]');
    var srcCount = option.querySelector('.hfx-as-picker-opt-count');
    if (count) count.textContent = srcCount ? srcCount.textContent : '';
    var dot = picker.querySelector('[data-hfx-as-picker-dot]');
    var srcDot = option.querySelector('.hfx-as-dot');
    if (dot && srcDot) dot.setAttribute('data-sev', srcDot.getAttribute('data-sev') || 'good');
  }

  function updatePickerSteps(picker) {
    var options = qsa(picker, '[data-hfx-as-picker-opt][data-hfx-as-picker-page]'), current = -1;
    options.forEach(function (o, i) { if (o.getAttribute('aria-current') === 'true') current = i; });
    qsa(picker, '[data-hfx-as-picker-step]').forEach(function (button) {
      var next = current + parseInt(button.getAttribute('data-hfx-as-picker-step'), 10);
      button.disabled = current < 0 || next < 0 || next >= options.length;
    });
  }

  function filterPicker(input) {
    var picker = closest(input, '[data-hfx-as-picker]');
    if (!picker) return;
    var terms = norm(input.value).split(/\s+/).filter(Boolean);
    var visible = 0;
    qsa(picker, '[data-hfx-as-picker-opt]').forEach(function (o) {
      var hay = o.getAttribute('data-search') || '';
      var ok = terms.every(function (t) { return hay.indexOf(t) >= 0; });
      var li = o.parentNode;
      if (ok) { li.removeAttribute('hidden'); visible++; } else li.setAttribute('hidden', 'hidden');
    });
    var none = picker.querySelector('.hfx-as-picker-none');
    if (none) { if (visible === 0) none.removeAttribute('hidden'); else none.setAttribute('hidden', 'hidden'); }
  }

  function movePickerFocus(picker, from, delta) {
    var options = qsa(picker, '[data-hfx-as-picker-opt]').filter(function (o) { return !o.parentNode.hasAttribute('hidden'); });
    if (options.length === 0) return;
    var i = options.indexOf(from);
    var next = i < 0 ? (delta > 0 ? 0 : options.length - 1) : Math.min(options.length - 1, Math.max(0, i + delta));
    try { options[next].focus(); } catch (_) { }
  }

  // ------------------------------------------------------------------- time
  // Timestamps are written as <time datetime="...Z" data-hfx-time="datetime|date|time"> with UTC text, so they are
  // right without script and in print. The reader's choice (local or UTC) is kept in this browser.
  var TIME_STORE = 'hfx-report-time-zone';
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function timeZone() {
    var root = document.documentElement;
    var zone = root.getAttribute('data-hfx-time-zone');
    return zone === 'utc' ? 'utc' : 'local';
  }

  function offsetLabel(date) {
    var minutes = -date.getTimezoneOffset();
    var sign = minutes < 0 ? '-' : '+';
    minutes = Math.abs(minutes);
    return 'UTC' + sign + pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
  }

  function formatTime(date, kind, zone) {
    var utc = zone === 'utc';
    var day = (utc ? date.getUTCFullYear() : date.getFullYear()) + '-' + pad((utc ? date.getUTCMonth() : date.getMonth()) + 1) + '-' + pad(utc ? date.getUTCDate() : date.getDate());
    var time = pad(utc ? date.getUTCHours() : date.getHours()) + ':' + pad(utc ? date.getUTCMinutes() : date.getMinutes());
    var suffix = utc ? 'UTC' : offsetLabel(date);
    if (kind === 'date') return day;
    if (kind === 'time') return time + ' ' + suffix;
    return day + ' ' + time + ' ' + suffix;
  }

  function applyTimes(root) {
    var zone = timeZone();
    qsa(root || document, 'time[data-hfx-time]').forEach(function (node) {
      var date = new Date(node.getAttribute('datetime') || '');
      if (isNaN(date.getTime())) return;
      var kind = node.getAttribute('data-hfx-time') || 'datetime';
      node.textContent = formatTime(date, kind, kind === 'date' ? 'utc' : zone);
      if (kind !== 'date') node.setAttribute('title', formatTime(date, 'datetime', zone === 'utc' ? 'local' : 'utc'));
    });
  }

  function setTimeZone(zone, persist) {
    zone = zone === 'utc' ? 'utc' : 'local';
    document.documentElement.setAttribute('data-hfx-time-zone', zone);
    if (persist !== false) storeSet(TIME_STORE, zone);
    qsa(document, '[data-hfx-shell-time-set]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-hfx-shell-time-set') === zone ? 'true' : 'false');
    });
    applyTimes(document);
    try { window.dispatchEvent(new CustomEvent('hfx:timezonechange', { detail: { zone: zone } })); } catch (_) { }
  }

  // The provenance line says so when the report is read after its data has gone stale.
  function markStale() {
    qsa(document, 'time[data-hfx-shell-stale-after]').forEach(function (node) {
      var at = new Date(node.getAttribute('datetime') || '').getTime();
      var limit = parseInt(node.getAttribute('data-hfx-shell-stale-after'), 10);
      if (isNaN(at) || isNaN(limit) || Date.now() - at <= limit * 1000) return;
      var line = closest(node, '.hfx-shell-provenance');
      var note = line && line.querySelector('[data-hfx-shell-stale]');
      if (note) note.removeAttribute('hidden');
    });
  }

  // ----------------------------------------------------------------- events
  document.addEventListener('click', function (e) {
    var t = e.target;
    var toggle = closest(t, '[data-hfx-as-picker-toggle]');
    if (toggle) {
      var pk = closest(toggle, '[data-hfx-as-picker]');
      setPickerOpen(pk, !pk.classList.contains('is-open'));
      return;
    }
    var pickerStep = closest(t, '[data-hfx-as-picker-step]');
    if (pickerStep) {
      var stepOwner = closest(pickerStep, '[data-hfx-as-picker]'), stepOptions = qsa(stepOwner, '[data-hfx-as-picker-opt][data-hfx-as-picker-page]');
      var currentOption = stepOptions.filter(function (o) { return o.getAttribute('aria-current') === 'true'; })[0];
      var nextOption = stepOptions[stepOptions.indexOf(currentOption) + parseInt(pickerStep.getAttribute('data-hfx-as-picker-step'), 10)];
      if (currentOption && nextOption) nextOption.click();
      return;
    }
    var option = closest(t, '[data-hfx-as-picker-opt]');
    if (option) {
      var owner = closest(option, '[data-hfx-as-picker]');
      syncPicker(owner, option);
      setPickerOpen(owner, false);
    } else if (openPicker && !closest(t, '[data-hfx-as-picker]')) {
      setPickerOpen(openPicker, false);
    }
    if (closest(t, '[data-hfx-shell-drawer-close]')) { closeDrawer(); return; }
    var stepBtn = closest(t, '[data-hfx-shell-drawer-step]');
    if (stepBtn) { stepDrawer(parseInt(stepBtn.getAttribute('data-hfx-shell-drawer-step'), 10)); return; }
    if (closest(t, '[data-hfx-shell-drawer-context]')) {
      var shown = closeDrawer(false);
      if (shown && typeof shown.onContext === 'function') shown.onContext();
      return;
    }
    if (closest(t, '[data-hfx-shell-side-toggle]')) { toggleSide(shellOf(t), false); return; }
    if (closest(t, '[data-hfx-shell-side-collapse]')) { toggleSide(shellOf(t), true); return; }
    if (closest(t, '[data-hfx-shell-side-close]')) { setSideOpen(shellOf(t), false); return; }
    var zoneBtn = closest(t, '[data-hfx-shell-time-set]');
    if (zoneBtn) { setTimeZone(zoneBtn.getAttribute('data-hfx-shell-time-set')); return; }
    var skip = closest(t, '[data-hfx-shell-skip]');
    if (skip) {
      e.preventDefault();
      var main = shellOf(skip) && shellOf(skip).querySelector('.hfx-shell-main');
      if (main) { try { main.focus({ preventScroll: false }); } catch (_) { } }
      return;
    }
    var nav = closest(t, '[data-hfx-shell-target]');
    if (nav) {
      e.preventDefault();
      closeDrawer(false);
      showPage(shellOf(nav), nav.getAttribute('data-hfx-shell-target'));
      return;
    }
    var pageLink = closest(t, '[data-hfx-as-link]');
    if (pageLink && !e.defaultPrevented) {
      // A page kept in another file: go to its file (with a modifier key the browser opens the address the link now
      // carries). A target in this document belongs to the assessment script when it is loaded (results open in the
      // drawer); without it the runtime reveals the target, never through the bare fragment.
      var modified = e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;
      if (pointToFile(pageLink)) {
        if (modified) return;
        e.preventDefault();
        closeDrawer(false);
        goToPageFile(pageLink.getAttribute('data-hfx-as-link'));
        return;
      }
      if (!window.hfxAssessment && !modified) {
        e.preventDefault();
        closeDrawer(false);
        reveal(pageLink.getAttribute('data-hfx-as-link'), { scroll: true });
        return;
      }
    }
    var entity = closest(t, '[data-hfx-shell-entity]');
    if (entity) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      // The bare fragment must never reach the browser: under an injected base address it names another document.
      e.preventDefault();
      openEntity(entity.getAttribute('data-hfx-shell-entity'), entity);
      return;
    }
  });

  // Links drawn later (a matrix row, a drawer panel) get their file when the reader reaches for them.
  ['auxclick', 'contextmenu', 'focusin'].forEach(function (type) {
    document.addEventListener(type, function (e) { var link = closest(e.target, '[data-hfx-as-link]'); if (link) pointToFile(link); }, true);
  });

  document.addEventListener('keydown', function (e) {
    if (drawerIsOpen()) {
      if (e.key === 'Escape' && !closest(e.target, '[data-hfx-as-picker]')) { e.preventDefault(); closeDrawer(); return; }
      if (e.key === 'Tab') {
        var dialog = drawer.wrap.querySelector('[data-hfx-shell-drawer]');
        var focusable = qsa(dialog, 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
          .filter(function (el) { return !el.closest('[hidden]') && el.getAttribute('aria-disabled') !== 'true' && !el.classList.contains('disabled') && el.getClientRects().length > 0; });
        if (!focusable.length) { e.preventDefault(); dialog.focus(); return; }
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog || !dialog.contains(document.activeElement))) {
          e.preventDefault(); last.focus(); return;
        }
        if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog || !dialog.contains(document.activeElement))) {
          e.preventDefault(); first.focus(); return;
        }
      }
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '');
      if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && closest(e.target, '[data-hfx-shell-drawer]') && !closest(e.target, '[data-hfx-as-picker], [role="treegrid"], [role="grid"], [role="tablist"]')) {
        e.preventDefault();
        stepDrawer(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
    }
    var picker = closest(e.target, '[data-hfx-as-picker]');
    if (picker && picker.classList.contains('is-open')) {
      if (e.key === 'Escape') { e.preventDefault(); setPickerOpen(picker, false, true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        movePickerFocus(picker, closest(e.target, '[data-hfx-as-picker-opt]'), e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (e.key === 'Enter' && e.target.hasAttribute('data-hfx-as-picker-search')) {
        e.preventDefault();
        var firstOption = qsa(picker, '[data-hfx-as-picker-opt]').filter(function (o) { return !o.parentNode.hasAttribute('hidden'); })[0];
        if (firstOption) firstOption.click();
        return;
      }
    }
    if (e.key === 'Escape' && openPicker) { setPickerOpen(openPicker, false, true); return; }
    // Arrow keys move between top-level navigation items; page tabs switch as they receive focus.
    var item = closest(e.target, '.hfx-shell-nav-item');
    var list = item && closest(item, '.hfx-shell-nav-list[role="tablist"]');
    if (!list || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')) return;
    var items = qsa(list, ':scope > .hfx-shell-nav-item, :scope > .hfx-shell-navgroup > .hfx-shell-nav-item');
    var i = items.indexOf(item);
    var next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    e.preventDefault();
    items[next].focus();
    var key = items[next].getAttribute('data-hfx-shell-target');
    if (key) showPage(shellOf(items[next]), key);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    qsa(document, '.hfx-shell.is-side-open').forEach(function (shell) { setSideOpen(shell, false); });
  });

  // Capture phase: other page scripts may stop propagation of input events on search boxes.
  function onSearchEvent(e) {
    var t = e.target;
    if (!t || !t.hasAttribute) return;
    if (t.hasAttribute('data-hfx-as-picker-search')) { filterPicker(t); return; }
    if (t.hasAttribute('data-hfx-shell-side-filter')) filterSide(t);
  }
  document.addEventListener('input', onSearchEvent, true);
  document.addEventListener('search', onSearchEvent, true);

  function currentHash() {
    try { return decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (_) { return (location.hash || '').replace(/^#/, ''); }
  }
  function handleHash(instant) {
    var h = currentHash();
    if (!h) return;
    if (ENTITY.test(h) && !document.getElementById(h) && openEntity(h, null)) return;
    reveal(h, { instant: instant, scroll: true });
  }
  window.addEventListener('hashchange', function () { navigationRevision++; closeDrawer(false); handleHash(false); });
  window.addEventListener('popstate', function () { navigationRevision++; closeDrawer(false); handleHash(false); });

  // A fixed-position picker follows its trigger while the page scrolls and closes once the trigger leaves the view.
  window.addEventListener('scroll', function (e) {
    if (!openPicker || closest(e.target, '.hfx-as-picker-panel')) return;
    var btn = openPicker.querySelector('[data-hfx-as-picker-toggle]');
    var r = btn ? btn.getBoundingClientRect() : null;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (!r || r.bottom < 0 || r.top > vh) setPickerOpen(openPicker, false); else placePicker(openPicker);
  }, true);
  window.addEventListener('resize', function () {
    if (openPicker) setPickerOpen(openPicker, false);
    qsa(document, '.hfx-shell-nav-list').forEach(updateNavOverflow);
    qsa(document, '.hfx-shell.has-sidebar').forEach(function (shell) {
      syncBarHeight(shell);
      if (!isNarrow()) setSideOpen(shell, false);
    });
  });

  function initNav() {
    qsa(document, '.hfx-shell-nav-list').forEach(function (list) {
      list.addEventListener('scroll', function () { updateNavOverflow(list); }, { passive: true });
      // Let a vertical mouse wheel scroll an overflowing navigation strip sideways.
      list.addEventListener('wheel', function (e) {
        if (list.scrollWidth <= list.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        list.scrollLeft += e.deltaY;
        e.preventDefault();
      }, { passive: false });
      var current = list.querySelector('.hfx-shell-nav-item[aria-selected="true"], .hfx-shell-nav-item[aria-current="page"], .hfx-shell-nav-item.is-current');
      if (current) scrollNavItemIntoView(current); else updateNavOverflow(list);
    });
  }

  function init() {
    var shell = document.querySelector('[data-hfx-shell]');
    initNav();
    qsa(document, '[data-hfx-as-link]').forEach(pointToFile);
    qsa(document, '.hfx-shell.has-sidebar').forEach(function (s) {
      if (storeGet(SIDE_STORE) === '1') s.classList.add('is-side-collapsed');
      syncBarHeight(s);
      var current = s.querySelector('.hfx-shell-side-item[aria-current="page"]');
      if (current) sideItemIntoView(current);
    });
    // A stored choice only applies where the reader can change it again.
    var stored = document.querySelector('[data-hfx-shell-time-set]') ? storeGet(TIME_STORE) : null;
    var zone = stored || (shell && shell.getAttribute('data-hfx-shell-time-zone')) || 'local';
    setTimeZone(zone, false);
    markStale();
    handleHash(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Native details hide their contents even when print CSS expands the surrounding report.
  var beforePrint = [];
  var printClosedDetails = null;
  var printTheme = null;
  var THEME_ATTRIBUTES = ['data-bs-theme', 'data-hfx-theme'];
  // Paper is light: a report read in the dark theme prints with the light tokens, and gets its theme back after.
  function lightForPrint() {
    if (printTheme !== null) return;
    printTheme = [];
    [document.documentElement, document.body].forEach(function (node) {
      if (!node) return;
      THEME_ATTRIBUTES.forEach(function (name) {
        var value = node.getAttribute(name);
        if (value && /^dark/.test(value)) { printTheme.push([node, name, value]); node.setAttribute(name, 'light'); }
      });
    });
    if (printTheme.length) announceTheme('light');
  }
  // Charts and other widgets that redraw on a theme change hear about the temporary one too.
  function announceTheme(mode) {
    try { window.dispatchEvent(new CustomEvent('hfx:themechange', { detail: { theme: mode, variant: mode, selection: 'print' } })); } catch (_) { }
  }
  function restoreTheme() {
    if (printTheme === null) return;
    var changed = printTheme.length > 0;
    printTheme.forEach(function (entry) { entry[0].setAttribute(entry[1], entry[2]); });
    printTheme = null;
    if (changed) announceTheme('dark');
  }
  // The title block of the first printed page says when it was printed and whether the data was stale by then.
  // Written like the report's other printed times ("5 Oct 2026 15:40"), in the reader's zone and the report's language.
  function printedText(date) {
    try {
      var parts = {};
      new Intl.DateTimeFormat(document.documentElement.lang || undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
      return parts.day + ' ' + parts.month + ' ' + parts.year + ' ' + parts.hour + ':' + parts.minute;
    } catch (_) { return date.toLocaleString(); }
  }
  function markPrinted() {
    var now = new Date();
    qsa(document, '[data-hfx-shell-printed]').forEach(function (item) {
      var value = item.querySelector('b');
      if (value) value.textContent = printedText(now);
      item.removeAttribute('hidden');
    });
    qsa(document, '[data-hfx-shell-print-stale]').forEach(function (item) {
      var at = new Date(item.getAttribute('data-hfx-shell-print-stale') || '').getTime();
      var limit = parseInt(item.getAttribute('data-hfx-shell-stale-after'), 10);
      if (!isNaN(at) && !isNaN(limit) && now.getTime() - at > limit * 1000) item.removeAttribute('hidden'); else item.setAttribute('hidden', 'hidden');
    });
  }
  function preparePrint() {
    // A record printed from the drawer prints alone; the drawer stays as the reader left it.
    if (!printingRecord) closeDrawer(false);
    lightForPrint();
    markPrinted();
    beforePrint.forEach(function (fn) { try { fn(); } catch (_) { } });
    if (printClosedDetails !== null) return;
    // Disclosures print open unless their component decided otherwise (a chart's data table is left out on paper).
    printClosedDetails = qsa(document, '.hfx-shell details:not([open]):not([data-hfx-print="hide"])');
    printClosedDetails.forEach(function (details) { details.open = true; });
  }
  function restorePrint() {
    restoreTheme();
    endRecordPrint();
    if (printClosedDetails === null) return;
    printClosedDetails.forEach(function (details) { details.open = false; });
    printClosedDetails = null;
  }

  // "Print this record": the drawer's record alone, under its title, with the report's running header and footer.
  var printingRecord = null;
  function cssString(text) { return '"' + String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"'; }
  function printRecord() {
    if (!drawerIsOpen() || printingRecord) return;
    var wrap = drawer.wrap;
    var host = closest(wrap, '[data-hfx-shell]') || document.body;
    var title = (wrap.querySelector('[data-hfx-shell-drawer-title]') || {}).textContent || '';
    var eyebrow = (wrap.querySelector('[data-hfx-shell-drawer-eyebrow]') || {}).textContent || '';
    var button = wrap.querySelector('[data-hfx-shell-drawer-print]');
    var word = (button && button.getAttribute('data-hfx-shell-record-label')) || drawerLabels.record;
    var record = document.createElement('section');
    record.className = 'hfx-as hfx-shell-print-record';
    var heading = document.createElement('h1');
    heading.className = 'hfx-shell-print-record-title';
    heading.textContent = word + ' · ' + title;
    if (eyebrow) { var small = document.createElement('small'); small.textContent = eyebrow; heading.appendChild(small); }
    record.appendChild(heading);
    var body = wrap.querySelector('[data-hfx-shell-drawer-body]');
    if (body) { var copy = body.cloneNode(true); copy.removeAttribute('data-hfx-shell-drawer-body'); copy.className = 'hfx-shell-print-record-body'; record.appendChild(copy); }
    var style = document.createElement('style');
    style.textContent = '@page hfx-record{@top-right{content:' + cssString(word + ' · ' + title) + '}}';
    record.appendChild(style);
    host.appendChild(record);
    host.classList.add('is-printing-record');
    printingRecord = { host: host, record: record };
    window.print();
    // Browsers that print without the afterprint event (or print asynchronously) clean up on the next interaction.
    setTimeout(function () { if (printingRecord && !(window.matchMedia && window.matchMedia('print').matches)) endRecordPrint(); }, 1000);
  }
  function endRecordPrint() {
    if (!printingRecord) return;
    printingRecord.host.classList.remove('is-printing-record');
    if (printingRecord.record.parentNode) printingRecord.record.parentNode.removeChild(printingRecord.record);
    printingRecord = null;
  }
  document.addEventListener('click', function (e) {
    if (closest(e.target, '[data-hfx-shell-drawer-print]')) { e.preventDefault(); printRecord(); }
  });
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restorePrint);

  // The browser's print event cannot wait for files. Content libraries whose print needs work first (compressed
  // chapters, deferred content in files) register a preparer on window.hfxReportPrintPreparers: pending() says whether
  // it has work, prepare() returns a promise. The report's print command, Ctrl+P and a PDF renderer that calls
  // hfxReport.preparePrint() wait for them.
  var printPreparers = [];
  function readPrintPreparers() {
    var queue = window.hfxReportPrintPreparers;
    if (queue && queue.length) {
      queue.splice(0, queue.length).forEach(function (p) { if (p && typeof p.prepare === 'function') printPreparers.push(p); });
    }
    return printPreparers;
  }
  function hasPrintWork(p) { try { return typeof p.pending !== 'function' || !!p.pending(); } catch (_) { return false; } }
  function printPending() { return readPrintPreparers().some(hasPrintWork); }
  // Only preparers with work run; what needs no waiting is done by the browser's print event. Content one preparer
  // inserts can bring work for another (a deferred chapter holding a data explorer), so they run again while any has
  // work, a few rounds at most.
  function preparePrintAsync() {
    var rounds = 0;
    function round() {
      var work = readPrintPreparers().filter(hasPrintWork);
      if (!work.length || rounds++ >= 4) return Promise.resolve();
      return Promise.all(work.map(function (p) {
        try { return Promise.resolve(p.prepare()).catch(function () { }); } catch (_) { return null; }
      })).then(round);
    }
    return round();
  }
  // One print at a time: a held or repeated Ctrl+P while the report prepares does not queue more.
  var printJob = null;
  function printReport() {
    if (printJob) return printJob;
    printJob = preparePrintAsync().then(function () { printJob = null; window.print(); }, function () { printJob = null; });
    return printJob;
  }
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key || '').toLowerCase() !== 'p') return;
    if (!printJob && !printPending()) return;
    e.preventDefault();
    printReport();
  });
  try {
    var printQuery = window.matchMedia && window.matchMedia('print');
    if (printQuery) {
      var onPrintChange = function (q) { if (q.matches) preparePrint(); else restorePrint(); };
      if (printQuery.addEventListener) printQuery.addEventListener('change', onPrintChange);
      else if (printQuery.addListener) printQuery.addListener(onPrintChange);
    }
  } catch (_) { }

  window.hfxReport = {
    shellOf: shellOf,
    pageKeyOf: pageKeyOf,
    showPage: function (key, opts) { return showPage(document.querySelector('[data-hfx-shell]'), key, opts); },
    showPageIn: showPage,
    reveal: reveal,
    revealElement: revealElement,
    addRevealer: function (fn) { if (typeof fn === 'function') revealers.push(fn); },
    onBeforePrint: function (fn) { if (typeof fn === 'function') beforePrint.push(fn); },
    onPreparePrint: function (preparer) { if (preparer && typeof preparer.prepare === 'function') printPreparers.push(preparer); },
    preparePrint: preparePrintAsync,
    print: printReport,
    refreshVisible: refreshVisible,
    setHash: setHash,
    navigationVersion: navigationVersion,
    openEntity: openEntity,
    openEntities: openEntities,
    isEntityId: function (id) { return ENTITY.test(String(id || '')) && !document.getElementById(String(id)); },
    entityFromHref: entityFromHref,
    chunks: { load: loadReportChunk },
    picker: { setOpen: setPickerOpen, sync: syncPicker },
    drawer: { open: openDrawer, close: closeDrawer, release: releaseDrawer, isOpen: drawerIsOpen, step: stepDrawer, guardScroll: guardDrawerScroll, print: printRecord },
    time: { zone: timeZone, set: setTimeZone, apply: applyTimes, format: formatTime }
  };
})();
