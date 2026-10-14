// HtmlForgeX report layout: bounded lists and distributions that fill the room their panel gets with more rows (never
// with wider spacing), and two-column splits whose columns end together. Everything here is measured in the browser;
// without script a list shows its minimum rows and a split stretches its shorter column through the stylesheet alone.
// Print shows every rendered row and stacks the columns.
(function () {
  'use strict';
  if (window.hfxReportLayout) return;

  function qsa(root, sel) { try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch (_) { return []; } }
  function closest(el, sel) { try { return el && el.closest ? el.closest(sel) : null; } catch (_) { return null; } }
  function shown(el) { return !!(el && el.getClientRects().length); }
  function bottomOf(el) { return el.getBoundingClientRect().bottom + window.pageYOffset; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  var printing = false;

  // ------------------------------------------------------------------ bounded lists and distributions
  // Rows of a fitted queue, or the measured bars of a fitted distribution (coverage gaps always show).
  function fitItems(root) { return qsa(root, ':scope > .hfx-rv-queue-list > .hfx-rv-queue-item, :scope > .hfx-rv-dist > .hfx-rv-dist-row:not(.is-gap)'); }

  function setShown(root, count) {
    fitItems(root).forEach(function (item, i) { item.classList.toggle('is-fit-extra', i >= count); });
    root.setAttribute('data-hfx-rv-shown', String(count));
    qsa(root, '[data-hfx-rv-shown-count]').forEach(function (node) {
      node.textContent = typeof count.toLocaleString === 'function' ? count.toLocaleString() : String(count);
    });
  }

  // The natural bottom of the other column of a split: its last child, measured while the split is not stretched.
  function partnerBottom(root) {
    var column = closest(root, '.hfx-as-split-main, .hfx-as-split-aside');
    var split = column && column.parentElement;
    if (!split || !split.classList.contains('hfx-as-split') || split.classList.contains('is-stacked')) return 0;
    if (getComputedStyle(split).gridTemplateColumns.split(' ').length < 2) return 0;
    var bottom = 0;
    Array.prototype.forEach.call(split.children, function (other) {
      if (other === column || !other.lastElementChild) return;
      bottom = Math.max(bottom, bottomOf(other.lastElementChild));
    });
    return bottom;
  }

  function fitQueue(root) {
    if (!shown(root)) return;
    var min = parseInt(root.getAttribute('data-hfx-rv-fit-min'), 10) || 1;
    var max = parseInt(root.getAttribute('data-hfx-rv-fit-max'), 10) || min;
    var items = fitItems(root);
    if (!items.length) return;
    setShown(root, Math.min(min, items.length));
    var panel = closest(root, '.hfx-as-panel') || root;
    // One row's share of the height at its natural spacing: the shown rows' span plus the gap between rows.
    var visibleRows = items.slice(0, Math.min(min, items.length));
    var gap = parseFloat(getComputedStyle(items[0].parentElement).rowGap) || 0;
    var span = visibleRows[visibleRows.length - 1].getBoundingClientRect().bottom - visibleRows[0].getBoundingClientRect().top;
    var rowHeight = (span + gap) / visibleRows.length;
    if (!(rowHeight > 0)) return;
    // The room the panel gets: down to the bottom of the window when the panel starts in the first screen, or to the
    // natural bottom of a taller column beside it, whichever is lower.
    var top = panel.getBoundingClientRect().top + window.pageYOffset;
    var target = top < window.innerHeight ? window.innerHeight - 20 : 0;
    target = Math.max(target, partnerBottom(root));
    var spare = target - bottomOf(panel);
    var extra = spare > 0 ? Math.floor(spare / rowHeight) : 0;
    setShown(root, clamp(min + extra, Math.min(min, items.length), Math.min(max, items.length)));
  }

  // ------------------------------------------------------------------ balanced splits
  function naturalHeights(split) {
    return Array.prototype.map.call(split.children, function (column) {
      var first = column.firstElementChild, last = column.lastElementChild;
      return first && last ? last.getBoundingClientRect().bottom - first.getBoundingClientRect().top : 0;
    });
  }

  function balanceSplit(split) {
    if (!shown(split)) return;
    split.classList.remove('is-stacked');
    var threshold = parseInt(split.getAttribute('data-balance-stack-above'), 10);
    if (!isNaN(threshold) && threshold >= 0 && getComputedStyle(split).gridTemplateColumns.split(' ').length > 1) {
      split.classList.add('is-measuring');
      var heights = naturalHeights(split);
      split.classList.remove('is-measuring');
      if (heights.length === 2 && Math.abs(heights[0] - heights[1]) > threshold) split.classList.add('is-stacked');
    }
  }

  // ------------------------------------------------------------------ orchestration
  function layout(scope) {
    if (printing) return;
    scope = scope || document;
    var splits = qsa(scope, '.hfx-as-split[data-balance]');
    splits.forEach(balanceSplit);
    // Lists measure the other column before it stretches, and every list starts from its minimum so two fitted lists
    // side by side never measure each other at an earlier, larger size.
    splits.forEach(function (split) { split.classList.add('is-measuring'); });
    var queues = qsa(scope, '[data-hfx-rv-fit-min]');
    queues.forEach(function (root) { if (shown(root)) setShown(root, Math.min(parseInt(root.getAttribute('data-hfx-rv-fit-min'), 10) || 1, fitItems(root).length)); });
    queues.forEach(fitQueue);
    splits.forEach(function (split) { split.classList.remove('is-measuring'); });
  }

  var pending = 0;
  function schedule(scope) {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(function () { pending = 0; layout(scope); });
  }

  window.hfxReportLayout = { layout: layout };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { schedule(document); });
  else schedule(document);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { schedule(document); });
  document.addEventListener('hfx:report-shown', function () { schedule(document); });
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { schedule(document); }, 120);
  });

  // Paper shows every rendered row; the count in the footer says so while printing.
  var printCounts = null;
  window.addEventListener('beforeprint', function () {
    printing = true;
    printCounts = qsa(document, '[data-hfx-rv-fit-min]').map(function (root) {
      var current = root.getAttribute('data-hfx-rv-shown');
      var all = fitItems(root).length;
      qsa(root, '[data-hfx-rv-shown-count]').forEach(function (node) { node.textContent = String(all); });
      return { root: root, shown: parseInt(current, 10) || all };
    });
  });
  window.addEventListener('afterprint', function () {
    printing = false;
    (printCounts || []).forEach(function (entry) { setShown(entry.root, entry.shown); });
    printCounts = null;
  });
})();
