// HtmlForgeX owns export scope even when a host supplies the scrolling viewport.
(function () {
  window.HfxDataExplorerExportQuery = { install: function (context) {
    var Explorer = context.Explorer, I = context.I;
    function clone(value) { return JSON.parse(JSON.stringify(value)); }

    // Called only after a query succeeds. Typing a new search or awaiting a remote page cannot replace it.
    Explorer.prototype.acceptExportQuery = function (spec, now) {
      spec = clone(spec || this.querySpec());
      if (!(spec.limit > 0)) delete spec.limit;
      if (!(spec.searchIn && spec.searchIn.length)) spec.searchIn = spec.columns.slice();
      var query = I.wireQuery(spec, this.ds);
      query.labels = clone(this.state.labels || {});
      this.acceptedExport = { spec: spec, query: query, now: now || Date.now(), order: this.remote ? null : this.order.slice() };
    };

    Explorer.prototype.captureExport = function (scope) {
      scope = scope || 'filtered';
      if (['filtered', 'selected', 'all'].indexOf(scope) < 0) throw new Error('Unknown export scope.');
      if (this.destroyed || !this.acceptedExport || this.remote && this.loadedQuery !== this.seq ||
          this.renderer && this.renderer.isQueryAccepted && !this.renderer.isQueryAccepted()) {
        throw new Error('Wait for the current query to finish before exporting.');
      }
      var accepted = this.acceptedExport, spec = clone(accepted.spec), query = clone(accepted.query);
      if (scope !== 'filtered') {
        spec.filters = []; spec.search = ''; delete spec.keys; delete spec.limit;
        delete query.filters; delete query.search; delete query.keys; delete query.limit;
      }
      if (scope === 'selected') {
        if (!this.renderer || !this.renderer.getSelection) throw new Error('This view does not support row selection.');
        var keys = this.renderer.getSelection().slice();
        if (!keys.length) throw new Error('Select rows before exporting.');
        if (keys.length > 10000) throw new Error('Select at most 10,000 rows for an export.');
        spec.keys = keys; query.keys = keys.slice();
      }
      delete spec.offset; delete spec.after; delete query.offset; delete query.after;
      var rows = this.remote ? null : scope === 'filtered' ? accepted.order.slice() : I.runQuery(this.ds, spec, accepted.now);
      var ds = this.ds, columns = spec.columns.map(function (id) {
        var column = ds.column(id);
        if (!column) throw new Error('An export column is no longer available.');
        return column;
      });
      return { scope: scope, spec: spec, query: query, columns: columns, labels: query.labels, rows: rows,
        seq: this.seq, name: this.exportName('csv') };
    };
  }};
})();
