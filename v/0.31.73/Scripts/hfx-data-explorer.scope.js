// Fixed view scope composes ordinary report filters; the data runtime still owns every query.
(function () {
  'use strict';
  window.HfxDataExplorerScope = { install: function (context) {
    var Explorer = context.Explorer, I = context.I, el = context.el, attr = context.attr, num = context.num;
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function baseView(explorer, view) {
      if (!view) return null;
      var id = view.scopeView || view.id;
      return explorer.views.filter(function (v) { return v.id === id; })[0] || null;
    }
    function filtersOf(explorer, view) {
      var base = baseView(explorer, view);
      return clone(base && base.scope && base.scope.filters || []);
    }
    Explorer.prototype.scopeFilters = function () { return filtersOf(this, this.currentView()); };
    var querySpec = Explorer.prototype.querySpec;
    Explorer.prototype.querySpec = function (skipQuick, skipExternal, skipScope) {
      var spec = querySpec.call(this, skipQuick, skipExternal);
      if (!skipScope) spec.filters = this.scopeFilters().concat(spec.filters);
      return spec;
    };
    // Saved layouts reference the authored view; its current scope is resolved again after loading.
    // Exported/requested definitions instead contain ordinary, portable filters including scope.
    var definition = Explorer.prototype.definition;
    Explorer.prototype.definition = function (saved) {
      var def = definition.call(this, saved), base = baseView(this, this.currentView());
      if (saved && base && base.scope && base.scope.filters && base.scope.filters.length) def.scopeView = base.id;
      return def;
    };
    var applyView = Explorer.prototype.applyView;
    Explorer.prototype.applyView = function (view, initial, deferRefresh) {
      // A saved layout whose scoped base disappeared cannot silently become an unscoped view.
      if (view && view.scopeView && !baseView(this, view)) throw new Error('The saved view is no longer available.');
      if (this.hideScopeTooltip) this.hideScopeTooltip();
      return applyView.call(this, view, initial, deferRefresh);
    };

    var build = Explorer.prototype.build;
    Explorer.prototype.build = function () {
      if (!this.views.some(function (view) { return view.scope && view.scope.filters && view.scope.filters.length; }))
        return build.apply(this, arguments);
      // Created before a viewport factory runs, so both toolbar owners can place the same control.
      var button = this.scopeControl = el('button', 'hfx-dx-btn is-quiet hfx-dx-scope');
      attr(button, 'type', 'button'); attr(button, 'data-hfx-dx-scope', '1');
      button.hidden = true;
      var tip = this.scopeTooltip = el('span', 'hfx-dx-scope-tooltip');
      attr(tip, 'id', this.id + '--scope-description'); attr(tip, 'role', 'tooltip');
      attr(button, 'aria-describedby', tip.id);
      button.appendChild(tip);
      function hide() {
        tip.removeAttribute('data-open');
        if (typeof tip.hidePopover === 'function' && tip.hasAttribute('popover') && tip.isConnected) tip.hidePopover();
      }
      function show() {
        if (button.hidden) return;
        if (typeof tip.showPopover === 'function') { tip.setAttribute('popover', 'manual'); tip.showPopover(); }
        attr(tip, 'data-open', '1');
        var box = button.getBoundingClientRect(), width = document.documentElement.clientWidth;
        tip.style.left = Math.max(8, Math.min(box.right - tip.offsetWidth, width - tip.offsetWidth - 8)) + 'px';
        tip.style.top = Math.max(8, Math.min(box.bottom + 6, window.innerHeight - tip.offsetHeight - 8)) + 'px';
      }
      button.addEventListener('focus', show); button.addEventListener('mouseenter', show);
      button.addEventListener('blur', hide); button.addEventListener('mouseleave', hide);
      button.addEventListener('keydown', function (event) { if (event.key === 'Escape') hide(); });
      this.hideScopeTooltip = hide;
      document.addEventListener('scroll', hide, true); window.addEventListener('resize', hide);
      build.apply(this, arguments);
      if (!button.parentNode) this.count.parentNode.insertBefore(button, this.count);
    };
    Explorer.prototype.renderScope = function () {
      if (!this.scopeControl) return;
      var self = this, filters = this.scopeFilters(), label = this.labels.viewScope || 'View scope';
      this.scopeControl.hidden = !filters.length;
      if (!filters.length) return;
      if (!this.scopeCaption) {
        this.scopeCaption = el('span'); this.scopeControl.insertBefore(this.scopeCaption, this.scopeTooltip);
      }
      this.scopeCaption.textContent = label;
      var text = filters.map(function (f) {
        var column = self.ds.column(f.column), description = context.describeFilter(self.ds, f, self.labels);
        var header = column && I.headerOf(column, self.state.labels);
        return column && header !== column.label ? header + description.slice(column.label.length) : description;
      }).join('; ');
      this.scopeTooltip.textContent = text;
      attr(this.scopeControl, 'aria-label', label);
      attr(this.scopeControl, 'title', text);
    };

    // M is the population within scope alone. Search, initial Where, native filters, keys and limits narrow N.
    Explorer.prototype.refreshScopeTotal = function () {
      var filters = this.scopeFilters();
      if (!filters.length) { this.scopeCountStamp = null; this.scopeTotal = null; return; }
      var self = this, now = this.queryTime === undefined ? this.referenceTime() : this.queryTime;
      var stamp = now + ':' + JSON.stringify(filters);
      if (stamp === this.scopeCountStamp) return;
      this.scopeCountStamp = stamp; this.scopeTotal = null;
      this.scopeCountController?.abort(); this.scopeCountController = new AbortController();
      var controller = this.scopeCountController, spec = { filters: filters, limit: 0 };
      if (!this.remote) { this.scopeTotal = I.runQuery(this.ds, { filters: filters }, now).length; return; }
      this.queryRemote(spec, { now: now, signal: controller.signal }).then(function (result) {
        if (self.destroyed || self.scopeCountController !== controller) return;
        self.scopeTotal = result.total; self.updateCount();
      }, function () { /* An unavailable scope count stays unknown; never substitute the global count. */ });
    };
    var totalRows = Explorer.prototype.totalRows, updateCount = Explorer.prototype.updateCount;
    Explorer.prototype.totalRows = function () {
      return this.scopeFilters().length ? (this.scopeTotal == null ? null : this.scopeTotal) : totalRows.call(this);
    };
    Explorer.prototype.updateCount = function () {
      this.renderScope(); this.refreshScopeTotal(); updateCount.call(this);
    };

    // Use the existing view-count path when no scope is authored. Scoped views use the same query owner,
    // adding their baseline filters; counts remain independent of the currently selected view and reader state.
    var refreshViewCounts = Explorer.prototype.refreshViewCounts;
    Explorer.prototype.refreshViewCounts = function () {
      if (!this.views.some(function (v) { return v.scope && v.scope.filters && v.scope.filters.length; }))
        return refreshViewCounts.call(this);
      if (this.cfg.viewCounts === false || !this.ds) return;
      var self = this, views = this.views.concat(this.saved), now = this.queryTime === undefined ? this.referenceTime() : this.queryTime;
      var specs = views.map(function (view) { return Object.assign({}, view, { filters: filtersOf(self, view).concat(view.filters || []) }); });
      var stamp = now + ':' + JSON.stringify(specs);
      if (stamp === this.viewCountsStamp || views.length < 2) return;
      this.viewCountsStamp = stamp; this.viewCounts = Object.create(null);
      this.viewCountsController?.abort(); this.viewCountsController = new AbortController();
      var controller = this.viewCountsController;
      var pending = specs.map(function (spec, i) {
        if (views[i].scopeView && !baseView(self, views[i])) return Promise.resolve();
        function accept(count) {
          if (!self.destroyed && self.viewCountsController === controller)
            self.viewCounts[views[i].id] = spec.limit > 0 ? Math.min(spec.limit, count) : count;
        }
        if (!self.remote) { accept(I.runQuery(self.ds, spec, now).length); return Promise.resolve(); }
        var countSpec = Object.assign({}, spec, { offset: 0, limit: 0 });
        return self.queryRemote(countSpec, { now: now, signal: controller.signal })
          .then(function (result) { accept(result.total); }, function () { /* Unknown counts stay unlabelled. */ });
      });
      if (!this.remote) this.renderViews();
      else Promise.all(pending).then(function () { if (!self.destroyed && self.viewCountsController === controller) self.renderViews(); });
    };

    var acceptExportQuery = Explorer.prototype.acceptExportQuery, captureExport = Explorer.prototype.captureExport;
    Explorer.prototype.acceptExportQuery = function (spec, now) {
      acceptExportQuery.call(this, spec, now);
      this.acceptedExport.scope = this.scopeFilters();
    };
    Explorer.prototype.captureExport = function (scope) {
      var captured = captureExport.call(this, scope), accepted = this.acceptedExport;
      if (captured.scope === 'filtered' || !accepted.scope.length) return captured;
      captured.spec.filters = clone(accepted.scope);
      var wire = I.wireQuery(captured.spec, this.ds);
      captured.query.filters = wire.filters;
      if (!this.remote) {
        var rows = I.runQuery(this.ds, captured.spec, accepted.now);
        // Ordinal selections exist only as local row positions, never as portable keys.
        if (captured.scope === 'selected' && this.ds.rowIdentity === 'ordinal') {
          var selected = new Set(captured.rows); rows = rows.filter(function (r) { return selected.has(r); });
        }
        captured.rows = rows;
      }
      return captured;
    };
    var destroy = Explorer.prototype.destroy;
    Explorer.prototype.destroy = function () {
      this.scopeCountController?.abort();
      if (this.hideScopeTooltip) {
        this.hideScopeTooltip(); document.removeEventListener('scroll', this.hideScopeTooltip, true);
        window.removeEventListener('resize', this.hideScopeTooltip); this.hideScopeTooltip = null;
      }
      return destroy.apply(this, arguments);
    };
  }};
})();
