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

    // The table keeps what fits a page and the other columns print under each row, split as DataExplorer.Print.cs splits
    // them: optional columns always, then the last columns that are not essential while the table is over its limit.
    function splitColumns(cols, limit) {
      function priority(c) { return c.layout ? c.layout.priority : undefined; }
      function optional(c) { var p = priority(c); return p === 'optional' || (typeof p === 'number' && p >= 10000); }
      function essential(c) { var p = priority(c); return p === 'essential' || (typeof p === 'number' && p <= 1) || !!(c.layout && c.layout.rowHeader === true); }
      var table = [], detail = [];
      cols.forEach(function (c, i) { (i > 0 && optional(c) ? detail : table).push(i); });
      for (var k = table.length - 1; k > 0 && table.length > limit; k--) {
        if (essential(cols[table[k]])) continue;
        detail.push(table[k]);
        table.splice(k, 1);
      }
      detail.sort(function (a, b) { return a - b; });
      return { table: table, detail: detail };
    }

    // A cell holding a run of 20 or more characters without a space (a hash, a name with dots, a path) may break it
    // anywhere on paper; DataExplorer.Print.cs marks the same cells.
    // Plain text breaks after the separators of a token where it has them; a token without any (a hash) breaks anywhere.
    function markToken(node) {
      var text = node.textContent || '';
      if (!/\S{20}/.test(text)) return;
      if (node.childNodes.length === 1 && node.firstChild.nodeType === 3 && /[.\-_,\/\\=@:]/.test(text)) {
        node.textContent = '';
        text.split(/([.\-_,\/\\=@:])/).forEach(function (part, i) {
          if (!part) return;
          node.appendChild(document.createTextNode(part));
          if (i % 2 === 1) node.appendChild(document.createElement('wbr'));
        });
      }
      if (/[^\s.\-_,\/\\=@:]{20}/.test(text)) node.classList.add('is-token');
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
      if (spec.filters.length) parts.push(phrase(labels.printFiltered || 'Filtered: {filters}', '{filters}', spec.filters.map(function (f) { return describeFilter(ds, f, labels); }).join(', ')));
      if (st.sort.length) {
        parts.push(phrase(labels.printSorted || 'sorted by {sort}', '{sort}', st.sort.map(function (s) {
          var col = ds.column(s.column);
          return (col ? headerOf(col, st.labels) : s.column) + ', ' + (s.descending ? (labels.printDescending || 'descending') : (labels.printAscending || 'ascending'));
        }).join(', ')));
      }
      if (parts.length) {
        var line = el('p', 'hfx-dx-print-state');
        parts.forEach(function (part, i) { if (i) line.appendChild(el('span', null, ' · ')); line.appendChild(part); });
        line.appendChild(el('span', null, ' · ' + fmt(labels.count, { shown: num(size), total: this.totalRowsLabel() })));
        holder.appendChild(line);
      }
      var split = splitColumns(cols, this.cfg.printColumns || 8);
      var table = el('table', 'hfx-dx-print-table' + (split.detail.length ? ' has-detail' : '')), head = el('thead'), headRow = el('tr');
      split.table.forEach(function (j) { var c = cols[j]; var th = el('th', c.kind === 'n' ? 'is-num' : null, headerOf(c, st.labels)); attr(th, 'scope', 'col'); headRow.appendChild(th); });
      head.appendChild(headRow);
      table.appendChild(head);
      var body = el('tbody');
      for (var i = 0; i < size && shown < limit; i++) {
        var r = this.rowAt(i);
        // A remote page that has not arrived ends the printed rows; the sentence below says how many there are.
        if (r < 0) break;
        var tr = el('tr');
        split.table.forEach(function (j) { var td = el('td'); self.fillCell(td, r, cols[j]); markToken(td); tr.appendChild(td); });
        if (split.detail.length) {
          // A record and its detail line stay together on one sheet.
          var record = el('tbody', 'hfx-dx-print-record'), detail = el('td');
          attr(detail, 'colspan', String(split.table.length));
          split.detail.forEach(function (j) {
            var c = cols[j];
            if (c.raw(r) === null || c.textOf(c.raw(r), 'display') === '') return;
            var field = el('span', 'hfx-dx-print-field'), value = el('span', 'hfx-dx-print-value');
            field.appendChild(el('span', 'hfx-dx-print-name', headerOf(c, st.labels)));
            self.fillCell(value, r, c);
            markToken(value);
            field.appendChild(value);
            detail.appendChild(field);
          });
          record.appendChild(tr);
          if (detail.firstChild) {
            var detailRow = el('tr', 'hfx-dx-print-detail');
            detailRow.appendChild(detail);
            record.appendChild(detailRow);
          }
          table.appendChild(record);
        } else {
          body.appendChild(tr);
        }
        shown++;
      }
      if (!split.detail.length) table.appendChild(body);
      holder.appendChild(table);
      if (size > shown) {
        var exports = (this.cfg.exports || []).indexOf('csv') >= 0 || this.cfg.officeIMOExports || !!this.cfg.hostExport;
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
