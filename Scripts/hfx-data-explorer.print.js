// HtmlForgeX explorer print: on paper an explorer is a static table of the reader's current view.
// The view's search, filters and sort are written as one line above the table, rows go up to the report's print row
// limit (200 unless the report sets data-hfx-print-rows), and a sentence under a longer table says how many rows the view
// has. A report's build-time print version writes the same markup from the default view (DataExplorer.Print.cs).
(function () {
  window.HfxDataExplorerPrint = { install: function (context) {
    var Explorer = context.Explorer, instances = context.instances, el = context.el, attr = context.attr, fmt = context.fmt, num = context.num;
    var closest = context.closest, qsa = context.qsa, describeFilter = context.describeFilter, headerOf = context.headerOf, initAll = context.initAll;
    var DEFAULT_ROWS = 200;

    // A label with its value in bold, for example "Filtered: <b>Status is down</b>".
    function phrase(template, placeholder, value) {
      var span = el('span'), at = template.indexOf(placeholder);
      if (at < 0) { span.appendChild(document.createTextNode(template + ' ')); span.appendChild(el('b', null, value)); return span; }
      if (at > 0) span.appendChild(document.createTextNode(template.slice(0, at)));
      span.appendChild(el('b', null, value));
      var rest = template.slice(at + placeholder.length);
      if (rest) span.appendChild(document.createTextNode(rest));
      return span;
    }

    Explorer.prototype.printRows = function () {
      var holder = closest(this.root, '[data-hfx-print-rows]');
      var rows = holder ? parseInt(holder.getAttribute('data-hfx-print-rows'), 10) : NaN;
      return rows > 0 ? rows : DEFAULT_ROWS;
    };

    Explorer.prototype.renderPrint = function () {
      this.removePrint();
      if (!this.ds || !this.state || this.destroyed) return;
      var self = this, labels = this.labels, ds = this.ds, st = this.state, cols = this.visibleColumns();
      var size = this.size(), limit = this.printRows(), shown = 0, spec = this.querySpec();
      var holder = el('div', 'hfx-dx-print');
      var parts = [];
      if (st.search) parts.push(phrase(labels.printSearch || 'Search: “{text}”', '{text}', st.search));
      if (spec.filters.length) parts.push(phrase(labels.printFiltered || 'Filtered: {filters}', '{filters}', spec.filters.map(function (f) { return describeFilter(ds, f); }).join(', ')));
      if (st.sort.length) {
        parts.push(phrase(labels.printSorted || 'sorted by {sort}', '{sort}', st.sort.map(function (s) {
          var col = ds.column(s.column);
          return (col ? headerOf(col, st.labels) : s.column) + ', ' + (s.descending ? (labels.printDescending || 'descending') : (labels.printAscending || 'ascending'));
        }).join(', ')));
      }
      if (parts.length) {
        var line = el('p', 'hfx-dx-print-state');
        parts.forEach(function (part, i) { if (i) line.appendChild(el('span', null, ' · ')); line.appendChild(part); });
        line.appendChild(el('span', null, ' · ' + fmt(labels.count, { shown: num(size), total: num(this.totalRows()) })));
        holder.appendChild(line);
      }
      var table = el('table', 'hfx-dx-print-table'), head = el('thead'), headRow = el('tr');
      cols.forEach(function (c) { var th = el('th', c.kind === 'n' ? 'is-num' : null, headerOf(c, st.labels)); attr(th, 'scope', 'col'); headRow.appendChild(th); });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = el('tbody');
      for (var i = 0; i < size && shown < limit; i++) {
        var r = this.rowAt(i);
        // A remote page that has not arrived ends the printed rows; the sentence below says how many there are.
        if (r < 0) break;
        var tr = el('tr');
        for (var j = 0; j < cols.length; j++) { var td = el('td'); self.fillCell(td, r, cols[j]); tr.appendChild(td); }
        body.appendChild(tr);
        shown++;
      }
      table.appendChild(body);
      holder.appendChild(table);
      if (size > shown) {
        var exports = (this.cfg.exports || []).indexOf('csv') >= 0 || !!this.cfg.hostExport;
        holder.appendChild(el('p', 'hfx-dx-print-more', fmt(exports ? (labels.printLimitedExport || labels.printLimited) : labels.printLimited, { shown: num(shown), total: num(size) })));
      }
      this.root.appendChild(holder);
      this.root.classList.add('has-print');
      this.printNode = holder;
    };

    Explorer.prototype.removePrint = function () {
      if (this.printNode && this.printNode.parentNode) this.printNode.parentNode.removeChild(this.printNode);
      this.printNode = null;
      if (this.root) this.root.classList.remove('has-print');
    };

    function printAll() {
      Object.keys(instances).forEach(function (id) { var x = instances[id]; if (x.ds && x.state && !x.destroyed) x.renderPrint(); });
    }
    function unprintAll() {
      Object.keys(instances).forEach(function (id) { instances[id].removePrint(); });
    }
    // The browser's print event cannot wait: explorers whose data is decoded print now.
    window.addEventListener('beforeprint', printAll);
    window.addEventListener('afterprint', unprintAll);
    // The report's print command and a PDF renderer that calls hfxReport.preparePrint() decode the others first.
    (window.hfxReportPrintPreparers = window.hfxReportPrintPreparers || []).push({
      pending: function () {
        return qsa(document, '[data-hfx-dx]').some(function (root) {
          var x = root.hfxDataExplorer;
          return !x || (!x.destroyed && ((!x.loaded && !x.failed) ||
            (x.remote && x.loaded && !x.failedQuery && x.loadedQuery !== x.seq)));
        });
      },
      prepare: function () {
        initAll(document);
        return Promise.all(qsa(document, '[data-hfx-dx]').map(function (root) {
          var x = root.hfxDataExplorer;
          return x && !x.destroyed ? Promise.resolve(x.load()).then(function () {
            // Loading the schema and accepting the current row query are separate stages. A view may also change
            // after the initial load; the print preparation loop rechecks readiness for that accepted query.
            return x.queryLoading;
          }).catch(function () { }) : null;
        })).then(printAll);
      }
    });
  } };
})();
