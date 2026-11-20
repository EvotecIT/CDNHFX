/* HtmlForgeX linked chart adapters translate declared values into ChartForgeX public commands.
 * ChartForgeX owns selection, highlight paint, responsive geometry and renderer state.
 */
(function () {
  'use strict';

  var links = window.hfxLinks;
  if (!links || links.chartAdapters) return;
  links.chartAdapters = true;

  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }
  function contains(values, value) {
    if (value === null || value === undefined) return false;
    return values.some(function (item) { return item === value || String(item) === String(value); });
  }
  function flat(value, out) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) each(value, function (item) { flat(item, out); }); else out.push(value);
    }
    return out;
  }

  /** Link filters intersect; independent highlights add foregrounds to that intersection. */
  function matchesBySource(paint, identity) {
    var entries = Object.create(null);
    function combined() {
      var filters = [], highlights = [], result = [], seen = Object.create(null);
      for (var source in entries) if (Object.prototype.hasOwnProperty.call(entries, source)) {
        var entry = entries[source];
        if (entry.action === 'filter') filters.push(entry.values); else highlights = highlights.concat(entry.values);
      }
      var filterKeys = filters.map(function (values) {
        var keys = Object.create(null);
        each(values, function (value) { keys[identity(value)] = true; });
        return keys;
      });
      if (filters.length) highlights = filters[0].filter(function (value) {
        var key = identity(value);
        return filterKeys.every(function (keys) { return keys[key] === true; });
      }).concat(highlights);
      each(highlights, function (value) {
        var key = identity(value);
        if (!seen[key]) { seen[key] = true; result.push(value); }
      });
      paint(result, Object.keys(entries).length > 0);
    }
    return {
      set: function (detail, values) { entries[detail.source] = { action: detail.action, values: values }; combined(); },
      clear: function (source) { if (entries[source]) { delete entries[source]; combined(); } }
    };
  }

  // ---------- ChartForgeX interactive charts ----------
  function chart(view) {
    var bound = [], selectSource = null;
    function roots() { return Array.prototype.slice.call(document.querySelectorAll('.cfx-interactive-chart[data-cfx-chart-id="' + links.css(view.ref) + '"]')); }
    function root() { return roots()[0] || null; }
    function controller(element) { return window.ChartForgeXCharts && window.ChartForgeXCharts.get(element); }
    function targetKey(target) { return JSON.stringify([target.targetKind, target.targetId, target.seriesKey || '']); }
    var marks = matchesBySource(function (targets, active) {
      each(roots(), function (element) {
        var api = controller(element);
        if (api) {
          if (active) api.highlight({ targets: targets }, { dim: true, emit: false, sync: false });
          else api.clearHighlight({ emit: false, sync: false });
        }
      });
    }, targetKey);
    function clearSelection() {
      each(roots(), function (element) { var api = controller(element); if (api) api.clearSelection({ emit: false, sync: false }); });
    }
    function report(event) {
      var targets = (event.detail || {}).targets || [], points = [], categories = [], labels = [];
      each(targets, function (target) {
        var indices = target.sourcePoints || (target.sourcePoint !== undefined && target.sourcePoint !== null ? [target.sourcePoint] : []);
        if (target.series !== undefined && isFinite(Number(target.series))) points.push({ series: Number(target.series), indices: indices });
        flat(target.category, categories);
        flat(target.label !== undefined ? target.label : target.category, labels);
      });
      // Wide and narrow sections share the same identities and public selection command.
      each(roots(), function (element) {
        if (element !== event.currentTarget) controller(element).select({ targets: targets }, { emit: false, sync: false });
      });
      links.selection(view.id, targets.length ? { points: points, categories: categories, label: labels.slice(0, 3).join(', ') } : null);
    }
    /** Declared custom values map to native source identities; ChartForgeX resolves rendered facts. */
    function matchFor(detail, link, api) {
      if (detail.keys && detail.keys.length) return { targets: api.resolveTargets().filter(function (target) { return contains(detail.keys, target.targetId); }) };
      var values = detail.values || [];
      if (!link || !link.match || !link.match.series) return { categories: values };
      var points = [];
      each(link.match.series, function (table, series) {
        each(table || [], function (value, index) {
          if (flat(value, []).some(function (item) { return contains(values, item); })) points.push({ seriesKey: link.match.seriesKeys[series], index: index });
        });
      });
      return { sourcePoints: points };
    }
    return {
      element: root,
      bind: function (roles) {
        var all = roots();
        if (!all.length || all.some(function (element) { return !controller(element); })) return false;
        if (roles & 1) each(all, function (element) {
          if (bound.indexOf(element) < 0) { bound.push(element); element.addEventListener('cfxselectionchange', report); }
        });
        return true;
      },
      apply: function (detail, link) {
        var all = roots();
        if (!all.length || all.some(function (element) { return !controller(element); })) return false;
        if (detail.action === 'clear') {
          marks.clear(detail.source);
          if (selectSource === detail.source) { selectSource = null; clearSelection(); }
          return true;
        }
        if (['filter', 'highlight', 'select'].indexOf(detail.action) < 0) return false;
        var targets = [];
        each(all, function (element) {
          var api = controller(element), match = matchFor(detail, link, api);
          if (detail.action === 'select') api.select(match, { emit: false, sync: false });
          else targets = targets.concat(api.resolveTargets(match));
        });
        if (detail.action === 'select') selectSource = detail.source;
        else marks.set(detail, targets);
        return true;
      },
      clearSelection: clearSelection
    };
  }
  links.registerAdapter('chart', chart);

  // ---------- ChartForgeX topology diagrams and graph explorers ----------
  function diagram(view, graph) {
    var selectSource = null, watching = null;
    function root() {
      return document.querySelector(graph ? 'section.cfx-graph-explorer[data-cfx-graph-id="' + links.css(view.ref) + '"]'
        : '.cfx-topology-wrapper[data-chart-id="' + links.css(view.ref) + '"]');
    }
    function command(name, detail) { root().dispatchEvent(new CustomEvent('cfx-topology-' + name, { detail: detail || {} })); }
    function graphItems(ids) { return ids.map(function (id) { return { role: 'graph-node', id: id }; }); }
    function clearSelection() {
      if (!root()) return;
      if (graph) window.ChartForgeXGraphExplorer.clearSelection(root(), { emit: false });
      else command('clear-selection', { emit: false, sync: false });
    }
    var marks = matchesBySource(function (ids, active) {
      if (graph) {
        if (active) window.ChartForgeXGraphExplorer.highlight(root(), graphItems(ids), { dim: true });
        else window.ChartForgeXGraphExplorer.clearHighlight(root());
      } else if (active) command('highlight', { nodeIds: ids, edgeIds: [], dim: true });
      else command('clear-highlight');
    }, function (id) { return id; });
    function matching(detail, link) {
      var values = detail.keys && detail.keys.length ? detail.keys : detail.values || [], ids = [];
      if (!link || !link.match || !link.match.nodes || detail.keys && detail.keys.length) return values.map(String);
      for (var id in link.match.nodes) if (Object.prototype.hasOwnProperty.call(link.match.nodes, id)) {
        if (flat(link.match.nodes[id], []).some(function (value) { return contains(values, value); })) ids.push(id);
      }
      return ids;
    }
    return {
      element: root,
      bind: function (roles) {
        var element = root();
        if (!element || graph && !window.ChartForgeXGraphExplorer) return false;
        if (watching === element) return true;
        watching = element;
        if (roles & 1) {
          if (graph) element.addEventListener('cfxgraphselection', function (event) {
            var ids = ((event.detail || {}).items || []).filter(function (item) { return item.role === 'graph-node'; }).map(function (item) { return item.id; });
            links.selection(view.id, ids.length ? { nodes: ids, label: ids.slice(0, 3).join(', ') } : null);
          });
          else {
            element.addEventListener('cfx-topology-select', function (event) {
              var detail = event.detail || {}, ids = [];
              each(detail.selections || [detail], function (item) {
                if (item.kind === 'edge') flat([item.sourceNodeId, item.targetNodeId], ids);
                else if (item.kind === 'node') flat(item.id, ids);
              });
              links.selection(view.id, ids.length ? { nodes: ids, label: detail.label || ids.slice(0, 3).join(', ') } : null);
            });
            element.addEventListener('cfx-topology-clear', function () { links.selection(view.id, null); });
          }
        }
        return true;
      },
      apply: function (detail, link) {
        if (!root() || graph && !window.ChartForgeXGraphExplorer) return false;
        if (detail.action === 'clear') {
          marks.clear(detail.source);
          if (selectSource === detail.source) { selectSource = null; clearSelection(); }
          return true;
        }
        if (['filter', 'highlight', 'select'].indexOf(detail.action) < 0) return false;
        var ids = matching(detail, link);
        if (detail.action === 'select') {
          selectSource = detail.source;
          if (graph) window.ChartForgeXGraphExplorer.select(root(), graphItems(ids), { mode: 'replace', emit: false });
          else command('set-selection', { kind: 'node', ids: ids, emit: false, sync: false });
        } else marks.set(detail, ids);
        return true;
      },
      clearSelection: clearSelection
    };
  }
  links.registerAdapter('network', function (view) { return diagram(view, false); });
  links.registerAdapter('graph', function (view) { return diagram(view, true); });
})();
