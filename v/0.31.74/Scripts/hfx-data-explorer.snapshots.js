// Snapshot time and independent view counts are shared by both explorer viewports.
(function () {
  'use strict';
  window.HfxDataExplorerSnapshots = { install: function (context) {
    var Explorer = context.Explorer, Data = context.Data, runQuery = context.runQuery;
    Explorer.prototype.referenceTime = function () {
      if (this.cfg.liveClock) return Date.now();
      var generated = Date.parse(this.cfg.generatedAt);
      return Number.isFinite(generated) ? generated : this.ds.generatedAt;
    };
    Explorer.prototype.refreshViewCounts = function () {
      if (this.cfg.viewCounts === false || !this.ds) return;
      var self = this, views = this.views.concat(this.saved), now = this.queryTime === undefined ? this.referenceTime() : this.queryTime;
      var stamp = now + ':' + JSON.stringify(views);
      if (stamp === this.viewCountsStamp || views.length < 2) return;
      this.viewCountsStamp = stamp; this.viewCounts = Object.create(null);
      this.viewCountsController?.abort(); this.viewCountsController = new AbortController();
      var controller = this.viewCountsController;
      function accept(view, count) {
        if (self.destroyed || self.viewCountsController !== controller) return;
        self.viewCounts[view.id] = view.limit > 0 ? Math.min(view.limit, count) : count;
      }
      var pending = views.map(function (view) {
        if (!self.remote) { accept(view, runQuery(self.ds, view, now).length); return Promise.resolve(); }
        var spec = Object.assign({}, view, { offset: 0, limit: 0 });
        return self.queryRemote(spec, { now: now, signal: controller.signal })
          .then(function (result) { accept(view, result.total); }, function () { /* Unknown counts remain unlabelled. */ });
      });
      if (!this.remote) this.renderViews();
      else Promise.all(pending).then(function () { if (!self.destroyed && self.viewCountsController === controller) self.renderViews(); });
    };
    var destroy = Explorer.prototype.destroy;
    Explorer.prototype.destroy = function () { this.viewCountsController?.abort(); return destroy.apply(this, arguments); };
  }};
})();
