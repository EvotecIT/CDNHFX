/*
 * HtmlForgeX linked views: the page runtime behind ContentContainer.Link(...).
 *
 * The contract between components is one DOM CustomEvent, "hfx:link", dispatched on the element of the component that
 * follows a link (it bubbles, so a page can watch every link at document level):
 *   detail = { source, action: "filter" | "highlight" | "select" | "clear", field, values, keys, label }
 *   source  who applied it (a stable id); "clear" removes what that source applied
 *   field   the field the target filters or matches; values are raw values of it, keys are row, node or mark keys
 *   label   the source's name, for chips ("Filtered by Status chart: Down")
 * Each component kind has an adapter (hfx-linked-views-adapters.js, hfx-linked-views-charts.js) that applies the event
 * with the component's own API and reports what the reader selects there. The runtime reads the links the document
 * declares (script[type="application/json"][data-hfx-links]), translates a source's selection into events for its
 * targets, keeps the linked-views bar and the print line current, and clears every link on request.
 */
(function () {
  'use strict';

  if (window.hfxLinks) return;

  var EVENT = 'hfx:link';
  var factories = {};
  var views = {};
  var order = [];
  var links = [];
  var linkBySource = Object.create(null);
  // target view id -> source key -> the detail it applied
  var applied = Object.create(null);
  var applying = 0;
  var read = 0;
  // source view id -> the last selection it reported, replayed to targets that bind later
  var last = {};
  var retries = 0, retryTimer = 0;

  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function unique(values) {
    var seen = {}, out = [];
    each(values, function (value) {
      if (value === null || value === undefined) return;
      var key = typeof value + ':' + String(value);
      if (!seen[key]) { seen[key] = true; out.push(value); }
    });
    return out;
  }
  function flat(value, out) {
    if (value === null || value === undefined) return out;
    if (Object.prototype.toString.call(value) === '[object Array]') each(value, function (item) { flat(item, out); });
    else out.push(value);
    return out;
  }
  function cssString(value) { return String(value).replace(/["\\]/g, '\\$&'); }

  /** Reads the link configurations the page carries (one per document, more when content arrives later). */
  function readConfig() {
    var scripts = document.querySelectorAll('script[type="application/json"][data-hfx-links]');
    each(scripts, function (script) {
      if (script.hfxLinksRead) return;
      script.hfxLinksRead = true;
      var config;
      try { config = JSON.parse(script.textContent || '{}'); } catch (_e) { return; }
      var prefix = 'c' + (++read) + '.';
      each(config.views || [], function (item) {
        var id = prefix + item.id;
        views[id] = { id: id, kind: item.kind, ref: item.ref, label: item.label || item.ref, adapter: null, element: null, roles: 0 };
        order.push(id);
      });
      each(config.links || [], function (item) {
        var link = {
          id: prefix + item.id, source: prefix + item.source, target: prefix + item.target, action: item.action, field: item.field,
          sourceField: item.sourceField || item.field, targetField: item.targetField || item.field, label: item.label || null,
          from: item.from || null, match: item.match || null
        };
        // The id a target knows the link by: its source view and the link, letters, digits, '.', '-' and '_' only.
        link.key = ('hfx.' + link.id).replace(/[^\w.-]/g, '-');
        links.push(link);
        linkBySource[link.key] = link;
        if (views[link.source]) views[link.source].roles |= 1;
        if (views[link.target]) views[link.target].roles |= 2;
      });
    });
  }

  /** Values a source selection stands for in one link: through the link's value table for marks, by field for rows. */
  function valuesFor(link, selection) {
    var out = [];
    if (link.from && link.from.series && selection.points) {
      each(selection.points, function (point) {
        var series = link.from.series[point.series];
        if (series) each(point.indices, function (index) { flat(series[index], out); });
      });
    }
    if (link.from && link.from.nodes && selection.nodes) {
      each(selection.nodes, function (id) { if (Object.prototype.hasOwnProperty.call(link.from.nodes, id)) flat(link.from.nodes[id], out); });
    }
    if (!link.from) {
      if (selection.values) {
        var field = link.sourceField, values = selection.values[field];
        if (values === undefined) {
          // Columns found by their titles match the field without regard to case.
          for (var name in selection.values) if (Object.prototype.hasOwnProperty.call(selection.values, name) && name.toLowerCase() === String(field).toLowerCase()) values = selection.values[name];
        }
        flat(values, out);
      }
      flat(selection.categories, out);
      flat(selection.nodes, out);
    }
    // Marks of a series the value table does not cover stand for their categories; a mark the table maps to nothing stays nothing.
    if (link.from && !out.length && selection.categories && !(link.from.series && selection.points && selection.points.some(function (point) { return link.from.series[point.series]; }))) flat(selection.categories, out);
    return unique(out);
  }

  /** Dispatches the contract event on a target's element; its adapter (or any listener) applies it. */
  function dispatch(target, detail) {
    var element = target.adapter && target.adapter.element();
    if (!element) return false;
    element.dispatchEvent(new CustomEvent(EVENT, { bubbles: true, detail: detail }));
    return true;
  }

  function sourceLabel(link) { var source = views[link.source]; return link.label || (source ? source.label : link.source); }

  function deliver(link, selection) {
    var target = views[link.target];
    if (!target) return;
    var values = selection ? valuesFor(link, selection) : [];
    var detail = values.length
      ? { source: link.key, action: link.action, field: link.targetField, values: values, keys: [], label: sourceLabel(link) }
      : { source: link.key, action: 'clear', field: link.targetField, values: [], keys: [], label: sourceLabel(link) };
    if (!values.length && !(applied[target.id] && applied[target.id][link.key])) return;
    dispatch(target, detail);
  }

  /**
   * A source adapter reports what the reader selected: { points: [{ series, indices }], nodes: [ids], categories, values:
   * { field: [values] }, label }, or null when the selection cleared. Changes an adapter makes while applying a link are
   * ignored, so linked components never echo each other.
   */
  function selection(viewId, value) {
    if (applying) return;
    last[viewId] = value;
    each(links, function (link) { if (link.source === viewId) deliver(link, value); });
  }

  /** A target adapter reports that the reader removed what a source applied (a chip): the source lets go everywhere. */
  function removed(viewId, sourceKey) {
    var link = linkBySource[sourceKey];
    if (applied[viewId]) delete applied[viewId][sourceKey];
    if (!link) { sync(); return; }
    var source = views[link.source];
    applying++;
    try { if (source && source.adapter && source.adapter.clearSelection) source.adapter.clearSelection(); } finally { applying--; }
    selection(link.source, null);
    sync();
  }

  /** Clears every link: each target lets go of what it applied, and each source of its selection. */
  function clearAll() {
    last = {};
    each(order, function (id) {
      var entries = applied[id];
      if (!entries) return;
      for (var key in entries) if (Object.prototype.hasOwnProperty.call(entries, key)) {
        dispatch(views[id], { source: key, action: 'clear', field: entries[key].field, values: [], keys: [], label: entries[key].label });
      }
    });
    applying++;
    try { each(order, function (id) { var view = views[id]; if (view.roles & 1 && view.adapter && view.adapter.clearSelection) view.adapter.clearSelection(); }); }
    finally { applying--; }
    sync();
  }

  /** Applies a contract event that reached a bound target, then records it for the bar, the print line and clear all. */
  function onLink(view, event) {
    var detail = event.detail || {};
    if (!detail.source || !detail.action) return;
    applying++;
    var ok = false;
    try { ok = view.adapter.apply(detail, linkBySource[detail.source] || null); }
    catch (error) { ok = false; if (window.console) console.error(error); }
    finally { applying--; }
    var entries = applied[view.id] || (applied[view.id] = Object.create(null));
    // An adapter returns false when the component could not apply the event (not mounted, no such column): it is not active.
    if (detail.action === 'clear' || ok === false) delete entries[detail.source];
    else entries[detail.source] = detail;
    sync();
  }

  /** The active links, for the bar and the print line: target label, source label and values. */
  function active() {
    var out = [];
    each(order, function (id) {
      var entries = applied[id];
      if (!entries) return;
      for (var key in entries) if (Object.prototype.hasOwnProperty.call(entries, key)) {
        var detail = entries[key], values = detail.values || detail.keys || [];
        out.push({ target: views[id].label, source: detail.label, action: detail.action, field: detail.field, values: values.slice(0, 5), more: Math.max(0, values.length - 5) });
      }
    });
    return out;
  }

  function sync() {
    var list = active();
    var bars = document.querySelectorAll('[data-hfx-links-controls]');
    var text = list.map(function (item) { return item.target + ' — ' + item.source + ': ' + item.values.join(', ') + (item.more ? ' +' + item.more : ''); }).join('; ');
    each(bars, function (bar) {
      var status = bar.querySelector('.hfx-links-status'), clear = bar.querySelector('[data-hfx-links-clear]'), print = bar.querySelector('[data-hfx-links-print]');
      var message = list.length ? (bar.getAttribute('data-hfx-links-active') || '{count}').replace('{count}', String(list.length)) : bar.getAttribute('data-hfx-links-none') || '';
      if (status && status.textContent !== message) status.textContent = message;
      if (clear) clear.disabled = !list.length;
      if (print) { print.hidden = !list.length; print.textContent = list.length ? (bar.getAttribute('data-hfx-links-print-lead') || 'Linked filters') + ': ' + text : ''; }
    });
    // Without a bar, print still names the active links on a line of its own at the top of the page.
    var auto = document.querySelector('[data-hfx-links-print-auto]');
    if (!bars.length && list.length && !auto && document.body) {
      auto = document.createElement('p');
      auto.className = 'hfx-links-print';
      auto.setAttribute('data-hfx-links-print-auto', '');
      document.body.insertBefore(auto, document.body.firstChild);
    }
    if (auto) { auto.hidden = !list.length; auto.textContent = list.length ? 'Linked filters: ' + text : ''; }
  }

  /** Binds every view whose adapter is registered and whose component is in the page; safe to call again. */
  function bindAll() {
    readConfig();
    each(order, function (id) {
      var view = views[id];
      if (!view.adapter && factories[view.kind]) view.adapter = factories[view.kind](view, api);
      if (!view.adapter || view.bound) return;
      var element = view.adapter.element();
      if (!element) return;
      if (view.element !== element) {
        view.element = element;
        element.addEventListener(EVENT, function (event) { if (event.target === element) onLink(view, event); });
      }
      // A component that is not mounted yet (a hidden page, a grid the host mounts later) binds on a later pass.
      if (view.adapter.bind(view.roles) === false) return;
      view.bound = true;
      // What the sources selected before this target was ready reaches it now.
      each(links, function (link) { if (link.target === id && last[link.source]) deliver(link, last[link.source]); });
    });
    sync();
    var waiting = order.some(function (id) { return views[id].adapter && !views[id].bound; });
    clearTimeout(retryTimer);
    if (waiting && retries < 40) { retries++; retryTimer = setTimeout(bindAll, 250); }
  }

  var api = {
    EVENT: EVENT,
    /** Registers the adapter of a component kind: factory(view, api) returns { element(), bind(roles), apply(detail, link), clearSelection() }. */
    registerAdapter: function (kind, factory) { factories[kind] = factory; bindAll(); },
    selection: selection,
    removed: removed,
    clearAll: clearAll,
    active: active,
    applied: function (viewId) { return applied[viewId] || {}; },
    refresh: bindAll,
    /** A text of the linked-views bar (data-hfx-links-<name>), with {placeholders} filled; English without a bar. */
    text: function (name, fallback, values) {
      var bar = document.querySelector('[data-hfx-links-controls]'), template = (bar && bar.getAttribute('data-hfx-links-' + name)) || fallback;
      return template.replace(/\{(\w+)\}/g, function (match, key) { return values && Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match; });
    },
    css: cssString
  };
  window.hfxLinks = api;

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-hfx-links-clear]') : null;
    if (button) { event.preventDefault(); clearAll(); }
  });
  // Components mount on DOMContentLoaded and later (tabs, deferred pages, visible-only tables): bind after them, and again.
  function later() { retries = 0; setTimeout(bindAll, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later); else later();
  window.addEventListener('load', later);
  document.addEventListener('hfx:report-shown', later);
  document.addEventListener('hfx:report-deferred-loaded', later);
})();
