// Report navigation and paint over ChartForgeX's public semantic schedule roles. Native geometry stays with ChartForgeX.
(function () {
  'use strict';
  if (window.hfxReportTimeline) return;
  function all(root, selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); }
  function roots(scope, selector) { return (scope.matches && scope.matches(selector) ? [scope] : []).concat(all(scope, selector)); }
  function read(node, name, fallback) { try { return JSON.parse(node.getAttribute(name)) || fallback; } catch (_) { return fallback; } }
  function wrap(mark, href, entity) {
    if (!href) return null;
    if (mark.parentNode.localName === 'a') return mark.parentNode;
    var link = document.createElementNS('http://www.w3.org/2000/svg', 'a');
    link.setAttribute('href', href); link.setAttribute('tabindex', '0');
    link.setAttribute('aria-label', mark.getAttribute('aria-label') || mark.textContent);
    if (entity && href.charAt(0) === '#' && href.indexOf('/') > 0) {
      try { link.setAttribute('data-hfx-shell-entity', decodeURIComponent(href.slice(1))); } catch (_) { }
    }
    mark.parentNode.insertBefore(link, mark); link.appendChild(mark); return link;
  }
  function bind(root) {
    var lanes = read(root, 'data-hfx-rv-lane-links', []), segments = read(root, 'data-hfx-rv-segment-links', []);
    var groups = read(root, 'data-hfx-rv-group-links', []);
    all(root, 'svg').filter(function (svg) { return svg.closest('[data-hfx-rv-lane-links]') === root; }).forEach(function (svg) {
      all(svg, '[data-cfx-role="state-lane-label"], [data-cfx-role="schedule-row-label"]').forEach(function (label, i) { wrap(label, lanes[i], true); });
      all(svg, '[data-cfx-role="state-timeline-segment"]').forEach(function (mark) {
        var row = segments[Number(mark.getAttribute('data-cfx-series'))] || [];
        wrap(mark, row[Number(mark.getAttribute('data-cfx-point'))], true);
      });
      all(svg, '[data-cfx-role="state-timeline-group"]').forEach(function (heading) {
        var text = heading.querySelector('text'), name = text ? text.textContent : heading.textContent;
        var action = groups.filter(function (g) { return g.Group === name || name.indexOf(g.Group + ' · ') === 0; })[0];
        if (!action) return;
        var link = wrap(heading, action.Target || '#', false);
        if (link && action.Target && action.Target.charAt(0) === '#') link.setAttribute('data-hfx-as-link', action.Target.slice(1));
        if (!action.Column || !link) return;
        link.setAttribute('data-hfx-rv-group-action', name); link.setAttribute('role', 'button');
        var timeline = root.closest('[data-hfx-rv-timeline]');
        link.setAttribute('aria-pressed', timeline && timeline.__hfxGroup === name ? 'true' : 'false');
      });
    });
    if (!root.__hfxTimelineObserver) {
      root.__hfxTimelineObserver = new MutationObserver(function () { if (root.isConnected) bind(root); });
      root.__hfxTimelineObserver.observe(root, { childList: true, subtree: true });
    }
  }
  function filter(root, group) {
    var actions = read(root, 'data-hfx-rv-group-actions', []), selected = actions.filter(function (a) { return a.Group === group; })[0];
    var view = root.querySelector(':scope > [data-hfx-rv-timeline-view]');
    if (!view) return;
    if (!root.__hfxAllLanes) { root.__hfxAllLanes = document.createElement('template'); root.__hfxAllLanes.content.appendChild(view.cloneNode(true)); }
    var next = group && root.__hfxGroup !== group ? group : null;
    var template = next ? all(root, ':scope > template[data-hfx-rv-timeline-template]').filter(function (t) { return t.getAttribute('data-hfx-rv-timeline-template') === next; })[0] : root.__hfxAllLanes;
    if (!template) return;
    root.__hfxGroup = next;
    if (window.HfxDataExplorer) {
      window.HfxDataExplorer.init(document);
      var source = root.getAttribute('data-hfx-rv-timeline');
      var ids = [];
      actions.forEach(function (a) { (a.Explorers || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
      ids.forEach(function (id) {
        var explorer = window.HfxDataExplorer.get(id);
        if (explorer) explorer.setExternalFilter(source, next && selected && selected.Explorers.indexOf(id) >= 0 ? { column: selected.Column, values: [selected.Value], label: next } : null);
      });
    }
    var fragment = template.content.cloneNode(true);
    // The original template contains the view wrapper; group templates contain only its content.
    if (!next) { var original = fragment.firstElementChild; fragment = document.createDocumentFragment(); while (original.firstChild) fragment.appendChild(original.firstChild); }
    view.replaceChildren(fragment);
    Promise.resolve(window.hfxReportViews && window.hfxReportViews.prepareDrawings(view)).then(function () {
      if (window.ChartForgeXResponsive) window.ChartForgeXResponsive.mount(view);
      init(view);
      view.dispatchEvent(new CustomEvent('hfx:report-drawings-ready', { bubbles: true }));
      requestAnimationFrame(function () {
        var control = all(view, '[data-hfx-rv-group-action]').filter(function (a) { return a.getAttribute('data-hfx-rv-group-action') === group; })[0];
        if (control) control.focus({ preventScroll: true });
      });
    });
  }
  function init(scope) { roots(scope || document, '[data-hfx-rv-lane-links]').forEach(bind); }
  document.addEventListener('click', function (event) {
    var target = event.target.closest && event.target.closest('[data-hfx-rv-group-action]');
    if (!target) return;
    var root = target.closest('[data-hfx-rv-timeline]');
    if (!root) return;
    event.preventDefault(); filter(root, target.getAttribute('data-hfx-rv-group-action'));
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== ' ' || !event.target.matches('[data-hfx-rv-group-action]')) return;
    event.preventDefault(); event.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  document.addEventListener('hfx-dx:externalfilter', function (event) {
    var source = event.detail && event.detail.source;
    all(document, '[data-hfx-rv-timeline]').forEach(function (root) { if (root.__hfxGroup && root.getAttribute('data-hfx-rv-timeline') === source) filter(root, null); });
  });
  document.addEventListener('hfx:report-shown', function (event) { init(event.target); });
  document.addEventListener('hfx:report-drawings-ready', function (event) { init(event.target); });
  window.hfxReportTimeline = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); }); else init(document);
})();
