// HtmlForgeX assessment report behaviour: section navigation, deep links, check lists, findings and matrix filters.
(function () {
  if (window.__hfxAssessmentInit) return;
  window.__hfxAssessmentInit = true;

  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function closest(el, sel) { try { return el && el.closest ? el.closest(sel) : null; } catch (_) { return null; } }
  function norm(s) { return (s || '').toString().toLowerCase(); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }

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
  }

  // ---------------------------------------------------------------- sections
  function reportOf(el) { return closest(el, '[data-hfx-asr]') || document.querySelector('[data-hfx-asr]'); }

  function showSection(report, key, opts) {
    if (!report || !key) return false;
    var panel = null;
    qsa(report, '[data-hfx-asr-section]').forEach(function (p) {
      if (p.getAttribute('data-hfx-asr-section') === key) panel = p;
    });
    if (!panel) return false;
    qsa(report, '[data-hfx-asr-section]').forEach(function (p) {
      if (p === panel) p.removeAttribute('hidden'); else p.setAttribute('hidden', 'hidden');
    });
    qsa(report, '.hfx-asr-nav-list > [data-hfx-asr-target]').forEach(function (t) {
      var on = t.getAttribute('data-hfx-asr-target') === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
      if (on) scrollNavItemIntoView(t);
    });
    // Collapsed navigation groups: mark the group item current and show which entry is open.
    qsa(report, '[data-hfx-asr-group]').forEach(function (g) {
      var match = null;
      qsa(g, '[data-hfx-asr-target]').forEach(function (o) {
        var on = o.getAttribute('data-hfx-asr-target') === key;
        if (on) { match = o; o.setAttribute('aria-current', 'true'); } else o.removeAttribute('aria-current');
      });
      var trigger = g.querySelector('.hfx-asr-group-trigger');
      if (trigger) {
        trigger.setAttribute('aria-selected', match ? 'true' : 'false');
        trigger.setAttribute('tabindex', match ? '0' : '-1');
      }
      var current = g.querySelector('[data-hfx-asr-group-current]');
      if (current) {
        var label = match && match.querySelector('.hfx-as-picker-opt-label');
        current.textContent = label ? label.textContent : '';
        if (match) current.removeAttribute('hidden'); else current.setAttribute('hidden', 'hidden');
      }
      if (match && trigger) scrollNavItemIntoView(trigger);
    });
    if (!opts || opts.updateHash !== false) {
      try { history.replaceState(null, '', '#' + key); } catch (_) { }
    }
    if (!opts || opts.scroll !== false) {
      try { window.scrollTo({ top: 0 }); } catch (_) { window.scrollTo(0, 0); }
    }
    setTimeout(function () { refreshVisible(panel); }, 0);
    return true;
  }

  function scrollNavItemIntoView(item) {
    var list = closest(item, '.hfx-asr-nav-list');
    if (!list) return;
    if (list.scrollWidth > list.clientWidth) {
      var left = item.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
      if (left < list.scrollLeft || left + item.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = Math.max(0, left - 24);
      }
    }
    updateNavOverflow(list);
  }

  // Scroll hints on the navigation strip when it is wider than the bar (narrow screens, many sections).
  function updateNavOverflow(list) {
    var nav = closest(list, '.hfx-asr-nav');
    if (!nav) return;
    var max = list.scrollWidth - list.clientWidth;
    nav.setAttribute('data-overflow-start', list.scrollLeft > 2 ? '1' : '0');
    nav.setAttribute('data-overflow-end', max - list.scrollLeft > 2 ? '1' : '0');
  }

  function sectionKeyOf(el) {
    var p = closest(el, '[data-hfx-asr-section]');
    return p ? p.getAttribute('data-hfx-asr-section') : null;
  }

  // --------------------------------------------------------------- reveal
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

  function templateContainsId(content, id) {
    if (qsa(content, '[id]').some(function (el) { return el.id === id; })) return true;
    return qsa(content, 'template[data-hfx-as-deferred]').some(function (tpl) {
      return templateContainsId(tpl.content, id);
    });
  }

  function templateCheckForId(content, id) {
    var target = qsa(content, '[id]').find(function (el) { return el.id === id; });
    if (target) return closest(target, '.hfx-as-check');
    var nested = qsa(content, 'template[data-hfx-as-deferred]').find(function (tpl) {
      return templateContainsId(tpl.content, id);
    });
    return nested ? (templateCheckForId(nested.content, id) || closest(nested, '.hfx-as-check')) : null;
  }

  function findTarget(id) {
    var target = document.getElementById(id);
    if (target) return target;
    var seen = [];
    while (!target) {
      var tpl = qsa(document, '.hfx-as-check-body > template[data-hfx-as-deferred]').find(function (candidate) {
        return seen.indexOf(candidate) < 0 && templateContainsId(candidate.content, id);
      });
      if (!tpl) break;
      seen.push(tpl);
      materialize(tpl.parentNode);
      target = document.getElementById(id);
    }
    return target;
  }

  function revealTarget(id, opts) {
    if (!id) return false;
    var target = findTarget(id);
    if (!target) {
      var report = document.querySelector('[data-hfx-asr]');
      return report ? showSection(report, id, opts) : false;
    }
    if (target.hasAttribute('data-hfx-asr-section')) {
      return showSection(reportOf(target), target.getAttribute('data-hfx-asr-section'), opts);
    }
    var key = sectionKeyOf(target);
    if (key) showSection(reportOf(target), key, { updateHash: false, scroll: false });
    showViewsFor(target);

    var check = closest(target, '.hfx-as-check');
    var checkAncestors = [];
    for (var parent = target; parent; parent = parent.parentElement) {
      if (parent.classList && parent.classList.contains('hfx-as-check')) checkAncestors.unshift(parent);
    }
    checkAncestors.forEach(function (item) {
      var list = closest(item, '[data-hfx-as-checks]');
      if (list) {
        var group = item.getAttribute('data-group');
        if (group && list.getAttribute('data-group') && list.getAttribute('data-group') !== group) setGroup(list, group);
        if (item.hasAttribute('hidden')) resetFilters(list);
      }
      setOpen(item, true);
    });
    var extraItem = closest(target, '[data-hfx-as-extra][hidden]');
    if (extraItem) {
      var fl = closest(extraItem, '[data-hfx-as-findings], [data-hfx-as-scopes]');
      if (fl && fl.hasAttribute('data-hfx-as-findings')) { setExtras(fl, 'all'); }
      else {
        var btn = fl && fl.querySelector('[data-hfx-as-toggle-extra]');
        if (btn) toggleExtra(btn, true);
      }
    }
    for (var ancestor = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
    showBootstrapPanes(target);
    try { history.replaceState(null, '', '#' + id); } catch (_) { }
    setTimeout(function () {
      try { target.scrollIntoView({ block: 'start', behavior: (opts && opts.instant) ? 'auto' : 'smooth' }); } catch (_) { target.scrollIntoView(); }
      if (check) {
        check.classList.remove('is-flash');
        void check.offsetWidth;
        check.classList.add('is-flash');
      }
    }, 30);
    return true;
  }

  // ----------------------------------------------------------------- views
  // Alternative views of one scope (for example "across domain controllers" and "rule results"): one is shown at a time.
  function setView(set, key) {
    if (!set) return;
    var pane = null;
    qsa(set, ':scope > .hfx-as-view-pane').forEach(function (p) {
      var on = p.getAttribute('data-hfx-as-view-pane') === key;
      if (on) { p.removeAttribute('hidden'); pane = p; } else p.setAttribute('hidden', 'hidden');
    });
    qsa(set, ':scope > .hfx-as-views-bar [data-hfx-as-view]').forEach(function (b) {
      var on = b.getAttribute('data-hfx-as-view') === key;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '0' : '-1');
    });
    if (pane) setTimeout(function () { refreshVisible(pane); }, 0);
  }

  function showViewsFor(el) {
    var pane = closest(el, '.hfx-as-view-pane[hidden]');
    while (pane) {
      setView(closest(pane, '[data-hfx-as-views]'), pane.getAttribute('data-hfx-as-view-pane'));
      pane = closest(pane.parentElement, '.hfx-as-view-pane[hidden]');
    }
  }

  // ---------------------------------------------------------------- drawer
  // Results reached through links open in a side drawer: the check's content moves into the drawer while it is open
  // and back into the check when it closes, so the reader keeps their place and nothing is duplicated.
  var drawer = null; // { wrap, check, body, links, index, returnFocus }

  function linkTargetCheck(link, materializeTarget) {
    var id = link && link.getAttribute('data-hfx-as-link');
    var el = id ? (materializeTarget ? findTarget(id) : document.getElementById(id)) : null;
    var check = el && closest(el, '.hfx-as-check');
    // A closed check may hold the linked element in an inert template. Locate its owner without
    // materializing the template; opening the chosen drawer is the first point that needs its content.
    if (!check && !el && id) {
      var template = qsa(document, '.hfx-as-check-body > template[data-hfx-as-deferred]').find(function (candidate) {
        return templateContainsId(candidate.content, id);
      });
      check = template && (templateCheckForId(template.content, id) || closest(template, '.hfx-as-check'));
    }
    return check && !check.contains(link) ? check : null;
  }

  function drawerSet(link) {
    // Neighbouring links to other results: the same finding on other scopes, a matrix row, a distribution row.
    var scope = closest(link, '.hfx-as-dist-body') || closest(link, '.hfx-as-tags, tr, .hfx-as-bars, .hfx-as-finding-list');
    var seen = [];
    var links = scope ? qsa(scope, 'a[data-hfx-as-link]').filter(function (a) {
      var check = linkTargetCheck(a);
      if (!check || seen.indexOf(check) >= 0) return false;
      seen.push(check);
      return true;
    }) : [];
    return links.length ? links : [link];
  }

  function restoreDrawerContent() {
    if (!drawer || !drawer.check) return;
    var target = drawer.wrap.querySelector('[data-hfx-asr-drawer-body]');
    while (target.firstChild) drawer.body.appendChild(target.firstChild);
    var restoredBody = drawer.body;
    setTimeout(function () { if (!closest(restoredBody, '[hidden]')) refreshVisible(restoredBody); }, 0);
    drawer.check = null;
  }

  function fillDrawer(check) {
    var wrap = drawer.wrap;
    restoreDrawerContent();
    var body = check.querySelector(':scope > .hfx-as-check-body');
    materialize(body);
    var target = wrap.querySelector('[data-hfx-asr-drawer-body]');
    while (body.firstChild) target.appendChild(body.firstChild);
    drawer.check = check;
    drawer.body = body;
    var titleEl = check.querySelector('.hfx-as-check-title > span');
    var eyebrowParts = [];
    var category = check.querySelector('.hfx-as-check-eyebrow > span:first-child');
    if (category) eyebrowParts.push(category.textContent);
    var scope = check.getAttribute('data-hfx-as-scope');
    if (scope) eyebrowParts.push(scope);
    wrap.querySelector('[data-hfx-asr-drawer-eyebrow]').textContent = eyebrowParts.join(' \u00b7 ');
    wrap.querySelector('[data-hfx-asr-drawer-title]').textContent = titleEl ? titleEl.textContent : '';
    var status = wrap.querySelector('[data-hfx-asr-drawer-status]');
    status.innerHTML = '';
    var chip = check.querySelector('.hfx-as-check-status .hfx-as-chip');
    if (chip) status.appendChild(chip.cloneNode(true));
    var nav = wrap.querySelector('[data-hfx-asr-drawer-nav]');
    if (drawer.links.length > 1) {
      nav.removeAttribute('hidden');
      wrap.querySelector('[data-hfx-asr-drawer-pos]').textContent = (drawer.index + 1) + ' / ' + drawer.links.length;
      qsa(nav, '[data-hfx-asr-drawer-step]').forEach(function (b) {
        var next = drawer.index + parseInt(b.getAttribute('data-hfx-asr-drawer-step'), 10);
        b.disabled = next < 0 || next >= drawer.links.length;
      });
    } else {
      nav.setAttribute('hidden', 'hidden');
    }
    target.scrollTop = 0;
    setTimeout(function () { refreshVisible(target); }, 0);
  }

  function openDrawer(check, link) {
    var report = reportOf(check);
    var wrap = report && report.querySelector('[data-hfx-asr-drawer-wrap]');
    if (!wrap) return false;
    if (drawer && drawer.wrap !== wrap) closeDrawer(false);
    var links = drawerSet(link);
    var index = Math.max(0, links.findIndex(function (item) { return linkTargetCheck(item) === check; }));
    if (!drawer || drawer.wrap !== wrap) drawer = { wrap: wrap, check: null, body: null, links: links, index: index, returnFocus: link };
    else { drawer.links = links; drawer.index = index; if (wrap.hasAttribute('hidden')) drawer.returnFocus = link; }
    fillDrawer(check);
    if (wrap.hasAttribute('hidden')) {
      wrap.removeAttribute('hidden');
      document.documentElement.classList.add('hfx-asr-drawer-open');
      try { wrap.querySelector('[data-hfx-asr-drawer]').focus({ preventScroll: true }); } catch (_) { }
    }
    return true;
  }

  function stepDrawer(delta) {
    if (!drawer) return;
    var next = drawer.index + delta;
    if (next < 0 || next >= drawer.links.length) return;
    var check = linkTargetCheck(drawer.links[next], true);
    if (!check) return;
    drawer.index = next;
    fillDrawer(check);
  }

  function closeDrawer(focusBack) {
    if (!drawer || drawer.wrap.hasAttribute('hidden')) return null;
    var check = drawer.check;
    restoreDrawerContent();
    drawer.wrap.setAttribute('hidden', 'hidden');
    document.documentElement.classList.remove('hfx-asr-drawer-open');
    if (focusBack !== false && drawer.returnFocus) { try { drawer.returnFocus.focus({ preventScroll: true }); } catch (_) { } }
    return check;
  }

  // ---------------------------------------------------------------- checks
  // Closed checks may keep their content in an inert <template>. Recreate scripts in the
  // fragment before insertion so each component initializer runs exactly once.
  function materialize(body) {
    var tpl = body && body.querySelector(':scope > template[data-hfx-as-deferred]');
    if (!tpl) return;
    try {
      var fragment = document.importNode(tpl.content, true);
      var scripts = qsa(fragment, 'script');
      scripts.forEach(function (oldScript) {
        var script = document.createElement('script');
        Array.prototype.forEach.call(oldScript.attributes, function (attr) { script.setAttribute(attr.name, attr.value); });
        if (oldScript.src) script.async = false;
        script.textContent = oldScript.textContent;
        oldScript.parentNode.replaceChild(script, oldScript);
      });
      tpl.parentNode.replaceChild(fragment, tpl);
      qsa(body, '[data-hfx-as-checks]').forEach(applyChecks);
      qsa(body, '[data-hfx-as-matrix]').forEach(applyMatrix);
      qsa(body, '[data-hfx-as-scopes]').forEach(applyScopes);
      qsa(body, '[data-hfx-as-dist]').forEach(applyDist);
    } catch (_) { }
  }

  function materializeAll() {
    var seen = [];
    while (true) {
      var pending = qsa(document, '.hfx-as-check-body > template[data-hfx-as-deferred]').filter(function (tpl) { return seen.indexOf(tpl) < 0; });
      if (!pending.length) break;
      pending.forEach(function (tpl) { seen.push(tpl); materialize(tpl.parentNode); });
    }
  }

  function setOpen(check, open) {
    var row = check.querySelector(':scope > .hfx-as-check-row');
    var body = check.querySelector(':scope > .hfx-as-check-body');
    if (!row || !body) return;
    if (open) {
      materialize(body);
      check.classList.add('is-open');
      body.removeAttribute('hidden');
      row.setAttribute('aria-expanded', 'true');
      setTimeout(function () { refreshVisible(body); }, 0);
    } else {
      check.classList.remove('is-open');
      body.setAttribute('hidden', 'hidden');
      row.setAttribute('aria-expanded', 'false');
    }
  }

  function stateMatches(filter, state) {
    if (!filter || filter === 'all') return true;
    if (filter === 'fail') return state === 'fail';
    if (filter === 'pass') return state === 'pass';
    return state === 'info' || state === 'skip';
  }

  function cancelExpand(list) {
    list.__hfxExpandGeneration = (list.__hfxExpandGeneration || 0) + 1;
    var button = list.querySelector('[data-hfx-as-expand-all]');
    if (button) {
      button.setAttribute('data-expanded', '0');
      button.textContent = button.getAttribute('data-label-expand') || '';
    }
  }

  function applyChecks(list) {
    cancelExpand(list);
    var group = list.getAttribute('data-group');
    var q = norm(list.getAttribute('data-q'));
    var filter = list.getAttribute('data-filter') || 'all';
    var terms = q.split(/\s+/).filter(Boolean);
    var counts = { all: 0, fail: 0, pass: 0, other: 0 };
    var visible = 0;
    qsa(list, ':scope > .hfx-as-check-list > .hfx-as-check').forEach(function (check) {
      var inGroup = !group || check.getAttribute('data-group') === group;
      var hay = check.getAttribute('data-search') || '';
      var textOk = terms.every(function (t) { return hay.indexOf(t) >= 0; });
      var state = check.getAttribute('data-state') || 'pass';
      if (inGroup && textOk) {
        counts.all++;
        if (state === 'fail') counts.fail++;
        else if (state === 'pass') counts.pass++;
        else counts.other++;
      }
      var show = inGroup && textOk && stateMatches(filter, state);
      if (show) { check.removeAttribute('hidden'); visible++; } else { check.setAttribute('hidden', 'hidden'); }
    });
    qsa(list, ':scope > .hfx-as-toolbar [data-hfx-as-filter-count]').forEach(function (c) {
      var k = c.getAttribute('data-hfx-as-filter-count');
      c.textContent = counts[k] != null ? String(counts[k]) : '';
      var chip = closest(c, '[data-hfx-as-filter]');
      if (chip && k !== 'all') {
        if (counts[k] === 0 && chip.getAttribute('aria-pressed') !== 'true') chip.setAttribute('hidden', 'hidden'); else chip.removeAttribute('hidden');
      }
    });
    var none = list.querySelector(':scope > .hfx-as-checks-none');
    if (none) { if (visible === 0) none.removeAttribute('hidden'); else none.setAttribute('hidden', 'hidden'); }
  }

  function setGroup(list, group) {
    list.setAttribute('data-group', group);
    var chosen = null;
    qsa(list, ':scope > .hfx-as-toolbar [data-hfx-as-group]').forEach(function (b) {
      var on = b.getAttribute('data-hfx-as-group') === group;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (b.hasAttribute('data-hfx-as-picker-opt')) { if (on) { b.setAttribute('aria-current', 'true'); chosen = b; } else b.removeAttribute('aria-current'); }
    });
    if (chosen) syncPicker(closest(chosen, '[data-hfx-as-picker]'), chosen);
    applyChecks(list);
    // Open checks of a scope that was hidden at load keep their content deferred until the scope is shown.
    qsa(list, ':scope > .hfx-as-check-list > .hfx-as-check.is-open:not([hidden]) > .hfx-as-check-body').forEach(materialize);
    refreshVisible(list);
  }

  function resetFilters(list) {
    list.setAttribute('data-q', '');
    list.setAttribute('data-filter', 'all');
    var input = list.querySelector('[data-hfx-as-checks-search]');
    if (input) input.value = '';
    qsa(list, ':scope > .hfx-as-toolbar [data-hfx-as-filter]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-hfx-as-filter') === 'all' ? 'true' : 'false'); });
    applyChecks(list);
  }

  // -------------------------------------------------------------- findings
  // Long lists (findings, scope rows) reveal extra items in steps or all at once. Collapsing brings the top of
  // the list back into view so the reader is not left far below the shortened list.
  function extrasOf(list) { return qsa(list, '[data-hfx-as-extra]'); }

  // Findings: "show N more" and "show all" reveal extra items; "show fewer" returns to the initial list and is
  // available as soon as anything beyond it is shown.
  function syncMoreBar(list) {
    var bar = list.querySelector('[data-hfx-as-more-bar]');
    if (!bar) return;
    var extras = extrasOf(list);
    var hidden = extras.filter(function (li) { return li.hasAttribute('hidden'); }).length;
    var step = bar.querySelector('[data-hfx-as-more-step]');
    var all = bar.querySelector('[data-hfx-as-show-all]');
    var fewer = bar.querySelector('[data-hfx-as-collapse]');
    if (step) {
      var size = parseInt(step.getAttribute('data-hfx-as-more-step'), 10) || 10;
      if (hidden === 0) step.setAttribute('hidden', 'hidden'); else step.removeAttribute('hidden');
      step.textContent = (step.getAttribute('data-label-format') || '{0}').replace('{0}', String(Math.min(size, hidden)));
    }
    if (all) { if (hidden === 0) all.setAttribute('hidden', 'hidden'); else all.removeAttribute('hidden'); }
    var expanded = hidden < extras.length;
    if (fewer) { if (expanded) fewer.removeAttribute('hidden'); else fewer.setAttribute('hidden', 'hidden'); }
    bar.classList.toggle('is-expanded', expanded);
  }

  function setExtras(list, mode) {
    var extras = extrasOf(list);
    if (mode === 'all') extras.forEach(function (li) { li.removeAttribute('hidden'); });
    else if (mode === 'none') extras.forEach(function (li) { li.setAttribute('hidden', 'hidden'); });
    else extras.filter(function (li) { return li.hasAttribute('hidden'); }).slice(0, mode).forEach(function (li) { li.removeAttribute('hidden'); });
    syncMoreBar(list);
    if (mode === 'none') scrollListIntoView(list);
  }

  function scrollListIntoView(list) {
    var anchor = closest(list, '.hfx-as-panel') || list;
    var top = anchor.getBoundingClientRect().top;
    if (top < 0) {
      var bar = document.querySelector('.hfx-asr-bar.is-sticky');
      var offset = bar ? bar.getBoundingClientRect().height + 12 : 12;
      window.scrollTo({ top: window.scrollY + top - offset, behavior: 'instant' });
    }
  }

  // Scope rows use a single "show all / show fewer" toggle combined with their filter box.
  function toggleExtra(btn, forceOpen) {
    var list = closest(btn, '[data-hfx-as-scopes]');
    if (!list) return;
    var hidden = extrasOf(list).filter(function (li) { return li.hasAttribute('hidden'); }).length;
    var open = forceOpen === true ? true : hidden > 0;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? (btn.getAttribute('data-label-less') || '') : (btn.getAttribute('data-label-more') || '');
    applyScopes(list);
    if (!open) scrollListIntoView(list);
  }

  // ---------------------------------------------------------------- scopes
  function applyScopes(list) {
    var terms = norm(list.getAttribute('data-q')).split(/\s+/).filter(Boolean);
    var btn = list.querySelector('[data-hfx-as-toggle-extra]');
    var expanded = !btn || btn.getAttribute('aria-expanded') === 'true';
    var visible = 0;
    qsa(list, '.hfx-as-scoperow').forEach(function (row) {
      var hay = row.getAttribute('data-search') || '';
      var match = terms.every(function (t) { return hay.indexOf(t) >= 0; });
      var show = match && (terms.length > 0 || expanded || !row.hasAttribute('data-hfx-as-extra'));
      if (show) { row.removeAttribute('hidden'); visible++; } else row.setAttribute('hidden', 'hidden');
    });
    var more = btn && closest(btn, '.hfx-as-more');
    if (more) {
      if (terms.length > 0) more.setAttribute('hidden', 'hidden'); else more.removeAttribute('hidden');
      more.classList.toggle('is-expanded', expanded);
    }
    var none = list.querySelector('.hfx-as-scopes-none');
    if (none) { if (visible === 0) none.removeAttribute('hidden'); else none.setAttribute('hidden', 'hidden'); }
  }

  // ---------------------------------------------------------- distribution
  function applyDist(root) {
    var terms = norm(root.getAttribute('data-q')).split(/\s+/).filter(Boolean);
    var failing = root.getAttribute('data-failing-only') === '1';
    var visible = 0;
    qsa(root, '.hfx-as-dist').forEach(function (row) {
      var hay = row.getAttribute('data-search') || '';
      var ok = terms.every(function (t) { return hay.indexOf(t) >= 0; }) && (!failing || row.getAttribute('data-failing') === '1');
      if (ok) { row.removeAttribute('hidden'); visible++; } else row.setAttribute('hidden', 'hidden');
    });
    var none = root.querySelector('.hfx-as-dist-none');
    if (none) { if (visible === 0) none.removeAttribute('hidden'); else none.setAttribute('hidden', 'hidden'); }
  }

  // ---------------------------------------------------------------- picker
  // Drop-down used for collapsed navigation groups and long scope lists. The panel is fixed-positioned so the
  // scrolling navigation strip or toolbars do not clip it.
  var openPicker = null;

  function placePicker(picker) {
    var btn = picker.querySelector('[data-hfx-as-picker-toggle]');
    var panel = picker.querySelector('.hfx-as-picker-panel');
    if (!btn || !panel) return;
    var r = btn.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var width = Math.min(Math.max(r.width, 320), vw - 16);
    var left = Math.min(Math.max(8, r.left), vw - width - 8);
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
      var current = panel.querySelector('[aria-current="true"]');
      try { (input || current || panel.querySelector('[data-hfx-as-picker-opt]')).focus({ preventScroll: true }); } catch (_) { }
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

  // ---------------------------------------------------------------- matrix
  // Rows are filtered by text, category and minimum status in the visible columns; columns can be hidden and any
  // column sorted (worst first, then best first, then the original order).
  function matrixHiddenCols(matrix) {
    var hidden = {};
    qsa(matrix, '[data-hfx-as-matrix-col]').forEach(function (cb) { if (!cb.checked) hidden[cb.getAttribute('data-hfx-as-matrix-col')] = true; });
    return hidden;
  }

  function applyMatrix(matrix) {
    var terms = norm(matrix.getAttribute('data-q')).split(/\s+/).filter(Boolean);
    var category = matrix.getAttribute('data-cat') || '';
    var minRank = parseInt(matrix.getAttribute('data-min-rank') || '', 10);
    var hidden = matrixHiddenCols(matrix);
    var sorted = matrix.querySelector('th[aria-sort="ascending"], th[aria-sort="descending"]');
    if (sorted && sorted.hasAttribute('data-col') && hidden[sorted.getAttribute('data-col')]) {
      sorted.setAttribute('aria-sort', 'none');
      sortMatrix(matrix, 'name', 'none');
      sorted = null;
    }
    var rows = qsa(matrix, 'tbody > tr');
    var visible = 0;
    var failingOption = matrix.querySelector('[data-hfx-as-matrix-failing-label]');
    var failingRank = failingOption ? parseInt(failingOption.value, 10) : NaN;
    var failingCount = 0;
    rows.forEach(function (tr) {
      if (failingOption && qsa(tr, ':scope > td').some(function (td) {
        return !hidden[td.getAttribute('data-col')] && parseInt(td.getAttribute('data-rank'), 10) >= failingRank;
      })) failingCount++;
      var hay = tr.getAttribute('data-search') || '';
      var ok = terms.every(function (t) { return hay.indexOf(t) >= 0; });
      if (ok && category) ok = tr.getAttribute('data-cat') === category;
      if (ok && !isNaN(minRank)) {
        ok = qsa(tr, ':scope > td').some(function (td) {
          return !hidden[td.getAttribute('data-col')] && (parseInt(td.getAttribute('data-rank'), 10) || -1) >= minRank;
        });
      }
      if (ok) { tr.removeAttribute('hidden'); visible++; } else tr.setAttribute('hidden', 'hidden');
    });
    qsa(matrix, 'th[data-col], td[data-col]').forEach(function (cell) {
      if (hidden[cell.getAttribute('data-col')]) cell.setAttribute('hidden', 'hidden'); else cell.removeAttribute('hidden');
    });
    var none = matrix.querySelector('.hfx-as-matrix-none');
    if (none) { if (visible === 0) none.removeAttribute('hidden'); else none.setAttribute('hidden', 'hidden'); }
    var count = matrix.querySelector('[data-hfx-as-matrix-count]');
    if (count) count.textContent = (matrix.getAttribute('data-count-format') || '{0} / {1}').replace('{0}', String(visible)).replace('{1}', String(rows.length));
    if (failingOption) failingOption.textContent = failingOption.getAttribute('data-hfx-as-matrix-failing-label') + ' (' + failingCount + ')';
    var boxes = qsa(matrix, '[data-hfx-as-matrix-col]');
    var colCount = matrix.querySelector('[data-hfx-as-matrix-colcount]');
    if (colCount) colCount.textContent = boxes.filter(function (cb) { return cb.checked; }).length + '/' + boxes.length;
    var dirty = terms.length > 0 || !!category || !isNaN(minRank) || Object.keys(hidden).length > 0 || !!sorted;
    var reset = matrix.querySelector('[data-hfx-as-matrix-reset]');
    if (reset) { if (dirty) reset.removeAttribute('hidden'); else reset.setAttribute('hidden', 'hidden'); }
  }

  function sortMatrix(matrix, key, direction) {
    var tbody = matrix.querySelector('tbody');
    if (!tbody) return;
    var rows = qsa(tbody, ':scope > tr');
    function order(tr) { return parseInt(tr.getAttribute('data-order'), 10) || 0; }
    rows.sort(function (a, b) {
      if (direction === 'none') return order(a) - order(b);
      var d;
      if (key === 'name') {
        d = (a.getAttribute('data-name') || '').localeCompare(b.getAttribute('data-name') || '');
        return direction === 'ascending' ? d : -d;
      }
      var ca = a.querySelector(':scope > td[data-col="' + key + '"]');
      var cb = b.querySelector(':scope > td[data-col="' + key + '"]');
      var ra = parseInt(ca && ca.getAttribute('data-rank'), 10), rb = parseInt(cb && cb.getAttribute('data-rank'), 10);
      var fa = parseInt(ca && ca.getAttribute('data-fail'), 10) || 0, fb = parseInt(cb && cb.getAttribute('data-fail'), 10) || 0;
      if (isNaN(ra)) ra = -1; if (isNaN(rb)) rb = -1;
      // Rows without a result in the column always go last.
      if ((ra < 0) !== (rb < 0)) return ra < 0 ? 1 : -1;
      d = (ra - rb) || (fa - fb);
      d = direction === 'descending' ? -d : d;
      return d || (order(a) - order(b));
    });
    rows.forEach(function (tr) { tbody.appendChild(tr); });
  }

  function onMatrixSort(btn) {
    var matrix = closest(btn, '[data-hfx-as-matrix]');
    var th = closest(btn, 'th');
    if (!matrix || !th) return;
    var key = btn.getAttribute('data-hfx-as-matrix-sort');
    var current = th.getAttribute('aria-sort') || 'none';
    // Severity columns start worst first; the name column starts A to Z.
    var cycle = key === 'name' ? ['none', 'ascending', 'descending'] : ['none', 'descending', 'ascending'];
    var next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    qsa(matrix, 'thead th').forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
    th.setAttribute('aria-sort', next);
    sortMatrix(matrix, key, next);
    applyMatrix(matrix);
  }

  function resetMatrix(matrix) {
    matrix.removeAttribute('data-q');
    matrix.removeAttribute('data-cat');
    matrix.removeAttribute('data-min-rank');
    var input = matrix.querySelector('[data-hfx-as-matrix-search]');
    if (input) input.value = '';
    qsa(matrix, 'select.hfx-as-select').forEach(function (sel) { sel.value = ''; });
    qsa(matrix, '[data-hfx-as-matrix-col]').forEach(function (cb) { cb.checked = true; });
    qsa(matrix, 'thead th').forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
    sortMatrix(matrix, 'name', 'none');
    applyMatrix(matrix);
  }

  document.addEventListener('change', function (e) {
    var t = e.target;
    var matrix = closest(t, '[data-hfx-as-matrix]');
    if (!matrix || !t.hasAttribute) return;
    if (t.hasAttribute('data-hfx-as-matrix-category')) { if (t.value) matrix.setAttribute('data-cat', t.value); else matrix.removeAttribute('data-cat'); }
    else if (t.hasAttribute('data-hfx-as-matrix-status')) { if (t.value) matrix.setAttribute('data-min-rank', t.value); else matrix.removeAttribute('data-min-rank'); }
    else if (!t.hasAttribute('data-hfx-as-matrix-col')) return;
    applyMatrix(matrix);
  });

  // ---------------------------------------------------------------- events
  document.addEventListener('click', function (e) {
    var t = e.target;
    var toggle = closest(t, '[data-hfx-as-picker-toggle]');
    if (toggle) {
      var pk = closest(toggle, '[data-hfx-as-picker]');
      setPickerOpen(pk, !pk.classList.contains('is-open'));
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
    if (closest(t, '[data-hfx-asr-drawer-close]')) { closeDrawer(); return; }
    var stepDrawerBtn = closest(t, '[data-hfx-asr-drawer-step]');
    if (stepDrawerBtn) { stepDrawer(parseInt(stepDrawerBtn.getAttribute('data-hfx-asr-drawer-step'), 10)); return; }
    if (closest(t, '[data-hfx-asr-drawer-context]')) {
      var shown = closeDrawer(false);
      if (shown && shown.id) revealTarget(shown.id);
      return;
    }
    var nav = closest(t, '[data-hfx-asr-target]');
    if (nav) {
      e.preventDefault();
      closeDrawer(false);
      showSection(reportOf(nav), nav.getAttribute('data-hfx-asr-target'));
      return;
    }
    var link = closest(t, '[data-hfx-as-link]');
    if (link) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var targetCheck = linkTargetCheck(link, true);
      if (targetCheck && openDrawer(targetCheck, link)) return;
      closeDrawer(false);
      revealTarget(link.getAttribute('data-hfx-as-link'));
      return;
    }
    var viewBtn = closest(t, '[data-hfx-as-view]');
    if (viewBtn) { setView(closest(viewBtn, '[data-hfx-as-views]'), viewBtn.getAttribute('data-hfx-as-view')); return; }
    var row = closest(t, '.hfx-as-check-row');
    if (row) {
      var check = closest(row, '.hfx-as-check');
      var checkList = closest(row, '[data-hfx-as-checks]');
      if (checkList) cancelExpand(checkList);
      if (check) setOpen(check, !check.classList.contains('is-open'));
      return;
    }
    var groupBtn = closest(t, '[data-hfx-as-group]');
    if (groupBtn) { setGroup(closest(groupBtn, '[data-hfx-as-checks]'), groupBtn.getAttribute('data-hfx-as-group')); return; }
    var filterBtn = closest(t, '[data-hfx-as-filter]');
    if (filterBtn) {
      var list = closest(filterBtn, '[data-hfx-as-checks]');
      list.setAttribute('data-filter', filterBtn.getAttribute('data-hfx-as-filter'));
      qsa(list, '[data-hfx-as-filter]').forEach(function (b) { b.setAttribute('aria-pressed', b === filterBtn ? 'true' : 'false'); });
      applyChecks(list);
      return;
    }
    var expand = closest(t, '[data-hfx-as-expand-all]');
    if (expand) {
      var l2 = closest(expand, '[data-hfx-as-checks]');
      var opening = expand.getAttribute('data-expanded') !== '1';
      cancelExpand(l2);
      var generation = l2.__hfxExpandGeneration;
      var targets = qsa(l2, ':scope > .hfx-as-check-list > .hfx-as-check').filter(function (c) { return !c.hasAttribute('hidden'); });
      if (opening) {
        // Open in small batches so pages with hundreds of checks stay responsive while their widgets initialize.
        var index = 0;
        (function step() {
          if (l2.__hfxExpandGeneration !== generation) return;
          var end = Math.min(index + 4, targets.length);
          for (; index < end; index++) setOpen(targets[index], true);
          if (index < targets.length) setTimeout(step, 16);
        })();
      } else {
        targets.forEach(function (c) { setOpen(c, false); });
      }
      expand.setAttribute('data-expanded', opening ? '1' : '0');
      expand.textContent = opening ? (expand.getAttribute('data-label-collapse') || '') : (expand.getAttribute('data-label-expand') || '');
      return;
    }
    var extra = closest(t, '[data-hfx-as-toggle-extra]');
    if (extra) { toggleExtra(extra); return; }
    var stepBtn = closest(t, '[data-hfx-as-more-step]');
    if (stepBtn) { setExtras(closest(stepBtn, '[data-hfx-as-findings]'), parseInt(stepBtn.getAttribute('data-hfx-as-more-step'), 10) || 10); return; }
    var allBtn = closest(t, '[data-hfx-as-show-all]');
    if (allBtn) { setExtras(closest(allBtn, '[data-hfx-as-findings]'), 'all'); return; }
    var fewerBtn = closest(t, '[data-hfx-as-collapse]');
    if (fewerBtn) { setExtras(closest(fewerBtn, '[data-hfx-as-findings]'), 'none'); return; }
    var sortBtn = closest(t, '[data-hfx-as-matrix-sort]');
    if (sortBtn) { onMatrixSort(sortBtn); return; }
    var resetBtn = closest(t, '[data-hfx-as-matrix-reset]');
    if (resetBtn) { resetMatrix(closest(resetBtn, '[data-hfx-as-matrix]')); return; }
    var allCols = closest(t, '[data-hfx-as-matrix-allcols]');
    if (allCols) {
      var mc = closest(allCols, '[data-hfx-as-matrix]');
      qsa(mc, '[data-hfx-as-matrix-col]').forEach(function (cb) { cb.checked = true; });
      applyMatrix(mc);
      return;
    }
    var distBtn = closest(t, '[data-hfx-as-dist-failing]');
    if (distBtn) {
      var dr = closest(distBtn, '[data-hfx-as-dist]');
      var dOn = distBtn.getAttribute('aria-pressed') !== 'true';
      distBtn.setAttribute('aria-pressed', dOn ? 'true' : 'false');
      dr.setAttribute('data-failing-only', dOn ? '1' : '0');
      applyDist(dr);
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (drawer && !drawer.wrap.hasAttribute('hidden')) {
      if (e.key === 'Escape' && !closest(e.target, '[data-hfx-as-picker]')) { e.preventDefault(); closeDrawer(); return; }
      if (e.key === 'Tab') {
        var dialog = drawer.wrap.querySelector('[data-hfx-asr-drawer]');
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
      if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && closest(e.target, '[data-hfx-asr-drawer]') && !closest(e.target, '[data-hfx-as-picker]')) {
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
        var first = qsa(picker, '[data-hfx-as-picker-opt]').filter(function (o) { return !o.parentNode.hasAttribute('hidden'); })[0];
        if (first) first.click();
        return;
      }
    }
    if (e.key === 'Escape' && openPicker) { setPickerOpen(openPicker, false, true); return; }
    // Alternative views use one tab stop; arrows and Home/End move between them.
    var view = closest(e.target, '.hfx-as-views-bar [data-hfx-as-view]');
    if (view && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
      var viewSet = closest(view, '[data-hfx-as-views]');
      var viewItems = qsa(viewSet, ':scope > .hfx-as-views-bar [data-hfx-as-view]');
      var viewIndex = viewItems.indexOf(view);
      var nextView = e.key === 'Home' ? 0 : e.key === 'End' ? viewItems.length - 1 : (viewIndex + (e.key === 'ArrowRight' ? 1 : -1) + viewItems.length) % viewItems.length;
      e.preventDefault();
      viewItems[nextView].focus();
      setView(viewSet, viewItems[nextView].getAttribute('data-hfx-as-view'));
      return;
    }
    // Arrow keys move between top-level navigation items; section tabs switch as they receive focus.
    var item = closest(e.target, '.hfx-asr-nav-item');
    var list = item && closest(item, '.hfx-asr-nav-list');
    if (!list || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')) return;
    var items = qsa(list, ':scope > .hfx-asr-nav-item, :scope > .hfx-asr-navgroup > .hfx-asr-nav-item');
    var i = items.indexOf(item);
    var next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    e.preventDefault();
    items[next].focus();
    var key = items[next].getAttribute('data-hfx-asr-target');
    if (key) showSection(reportOf(items[next]), key);
  });

  var onSearch = debounce(function (input) {
    var list = closest(input, '[data-hfx-as-checks]');
    if (list && input.hasAttribute('data-hfx-as-checks-search')) { list.setAttribute('data-q', input.value || ''); applyChecks(list); return; }
    var matrix = closest(input, '[data-hfx-as-matrix]');
    if (matrix && input.hasAttribute('data-hfx-as-matrix-search')) { matrix.setAttribute('data-q', input.value || ''); applyMatrix(matrix); return; }
    var scopes = closest(input, '[data-hfx-as-scopes]');
    if (scopes && input.hasAttribute('data-hfx-as-scopes-search')) { scopes.setAttribute('data-q', input.value || ''); applyScopes(scopes); return; }
    var dist = closest(input, '[data-hfx-as-dist]');
    if (dist && input.hasAttribute('data-hfx-as-dist-search')) { dist.setAttribute('data-q', input.value || ''); applyDist(dist); }
  }, 120);
  // Capture phase: other page scripts may stop propagation of input events on search boxes.
  function onSearchEvent(e) {
    var t = e.target;
    if (!t || !t.hasAttribute) return;
    if (t.hasAttribute('data-hfx-as-picker-search')) { filterPicker(t); return; }
    if (t.hasAttribute('data-hfx-as-checks-search') || t.hasAttribute('data-hfx-as-matrix-search')
      || t.hasAttribute('data-hfx-as-scopes-search') || t.hasAttribute('data-hfx-as-dist-search')) onSearch(t);
  }
  document.addEventListener('input', onSearchEvent, true);
  document.addEventListener('search', onSearchEvent, true);

  function handleHash(instant) {
    var h = '';
    try { h = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (_) { h = (location.hash || '').replace(/^#/, ''); }
    if (!h) return;
    revealTarget(h, { instant: instant, scroll: true });
  }
  window.addEventListener('hashchange', function () { closeDrawer(false); handleHash(false); });

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
    qsa(document, '.hfx-asr-nav-list').forEach(updateNavOverflow);
  });

  function initNav() {
    qsa(document, '.hfx-asr-nav-list').forEach(function (list) {
      list.addEventListener('scroll', function () { updateNavOverflow(list); }, { passive: true });
      // Let a vertical mouse wheel scroll an overflowing navigation strip sideways.
      list.addEventListener('wheel', function (e) {
        if (list.scrollWidth <= list.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        list.scrollLeft += e.deltaY;
        e.preventDefault();
      }, { passive: false });
      var current = list.querySelector('.hfx-asr-nav-item[aria-selected="true"]');
      if (current) scrollNavItemIntoView(current); else updateNavOverflow(list);
    });
  }

  function init() {
    qsa(document, '[data-hfx-as-checks]').forEach(applyChecks);
    qsa(document, '[data-hfx-as-matrix]').forEach(applyMatrix);
    qsa(document, '[data-hfx-as-scopes]').forEach(applyScopes);
    qsa(document, '[data-hfx-as-dist]').forEach(applyDist);
    initNav();
    handleHash(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Native details hide their contents even when print CSS expands the surrounding report.
  var printClosedDetails = null;
  function preparePrint() {
    closeDrawer(false);
    materializeAll();
    if (printClosedDetails !== null) return;
    printClosedDetails = qsa(document, '.hfx-asr details:not([open])');
    printClosedDetails.forEach(function (details) { details.open = true; });
  }
  function restorePrint() {
    if (printClosedDetails === null) return;
    printClosedDetails.forEach(function (details) { details.open = false; });
    printClosedDetails = null;
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restorePrint);
  try {
    var printQuery = window.matchMedia && window.matchMedia('print');
    if (printQuery) {
      var onPrintChange = function (q) { if (q.matches) preparePrint(); else restorePrint(); };
      if (printQuery.addEventListener) printQuery.addEventListener('change', onPrintChange);
      else if (printQuery.addListener) printQuery.addListener(onPrintChange);
    }
  } catch (_) { }

  window.hfxAssessment = { materializeAll: materializeAll, reveal: revealTarget, showSection: function (key) { return showSection(document.querySelector('[data-hfx-asr]'), key); } };
})();
