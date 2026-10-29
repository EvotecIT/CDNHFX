// Facet menus and active-filter chips for the report explorer.
(function () {
  window.HfxDataExplorerFacets = { install: function (c) {
    var Explorer = c.Explorer, el = c.el, attr = c.attr, closest = c.closest, qsa = c.qsa, dict = c.dict;
    var num = c.num, booleanWord = c.booleanWord, toneAttrs = c.toneAttrs, runQuery = c.runQuery;
    var describeFilter = c.describeFilter, removeFilterLabel = c.removeFilterLabel, QUICK_VALUES = c.quickValues;
  Explorer.prototype.renderQuick = function () {
    var self = this, bar = this.quickBar, ds = this.ds;
    var active = document.activeElement, previous = closest(active, '.hfx-dx-quick-group');
    var focus = this.quickFocus;
    if (focus && focus.origin !== document.activeElement) focus = null;
    if (!focus && previous && bar.contains(previous)) {
      focus = { id: previous.getAttribute('data-hfx-facet-id'),
        control: active.hasAttribute('data-hfx-facet-value') ? 'value' : active.hasAttribute('data-hfx-facet-more') ? 'more' : 'summary',
        value: active.getAttribute('data-hfx-facet-value') };
    }
    this.quickFocus = null;
    bar.textContent = '';
    var quick = (this.cfg.quick || []).map(function (id) { return ds.column(id); }).filter(Boolean);
    if (!quick.length) { bar.hidden = true; return; }
    bar.hidden = false;
    // Counts reflect the rows left by the other filters so each chip shows what clicking it would keep.
    quick.forEach(function (col) {
      var group = el('details', 'hfx-dx-quick-group');
      attr(group, 'data-hfx-facet-id', col.id);
      group.open = self.openQuick === col.id;
      group.addEventListener('toggle', function () {
        if (!group.isConnected) return;
        if (group.open) {
          self.openQuick = col.id;
          qsa(bar, '.hfx-dx-quick-group[open]').forEach(function (other) { if (other !== group) other.open = false; });
          var right = choices.getBoundingClientRect().right, excess = Math.max(0, right - window.innerWidth + 8);
          choices.style.insetInlineStart = -excess + 'px';
        } else if (self.openQuick === col.id) self.openQuick = null;
      });
      group.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && group.open) { group.open = false; group.querySelector('summary').focus(); event.preventDefault(); event.stopPropagation(); }
      });
      group.appendChild(el('summary', 'hfx-dx-quick-label', col.label));
      var choices = el('div', 'hfx-dx-quick-choices');
      attr(choices, 'role', 'group'); attr(choices, 'aria-label', col.label);
      var selected = self.state.quick[col.id] || dict();
      var values = self.quickValues(col), shown = self.quickShown[col.id] || QUICK_VALUES;
      values.slice(0, shown).forEach(function (d) {
        var on = !!selected[d.value];
        var b = el('button', 'hfx-dx-qchip');
        attr(b, 'type', 'button'); attr(b, 'aria-pressed', on ? 'true' : 'false');
        attr(b, 'data-hfx-facet-value', d.value);
        var tone = col.tone(col.parse(d.value)); if (tone) toneAttrs(b, tone);
        b.appendChild(el('span', 'hfx-dx-qchip-label', col.kind === 'b' ? booleanWord(self.labels, d.value) : col.textOf(col.parse(d.value), 'display')));
        b.appendChild(el('span', 'hfx-dx-qchip-count', num(d.count)));
        b.addEventListener('click', function () {
          var set = self.state.quick[col.id] || (self.state.quick[col.id] = dict());
          set[d.value] = !set[d.value];
          self.openQuick = null;
          self.quickFocus = { id: col.id, control: 'summary', origin: document.activeElement };
          self.refresh(true);
        });
        choices.appendChild(b);
      });
      var truncated = self.remote && self.facetTruncated[col.id.toLowerCase()];
      var capped = truncated && (self.facetLimits[col.id] || QUICK_VALUES) > values.length;
      if (capped) {
        var limitNote = el('span', 'hfx-dx-quick-limit', self.labels.facetLimit || 'Narrow the filters to see more values.');
        attr(limitNote, 'role', 'status'); choices.appendChild(limitNote);
      } else if (values.length > shown || truncated) {
        var more = el('button', 'hfx-dx-btn', self.labels.more || 'More'); attr(more, 'type', 'button'); attr(more, 'data-hfx-facet-more', '1');
        more.addEventListener('click', function () {
          self.openQuick = col.id; self.quickShown[col.id] = shown + QUICK_VALUES;
          self.quickFocus = { id: col.id, control: 'summary', origin: document.activeElement };
          if (self.remote) { self.facetLimits[col.id] = shown + QUICK_VALUES; self.refresh(false); }
          else self.renderQuick();
        });
        choices.appendChild(more);
      }
      group.appendChild(choices);
      bar.appendChild(group);
      if (focus && focus.id === col.id) {
        var target = group.querySelector('summary');
        if (group.open && focus.control === 'more') target = group.querySelector('[data-hfx-facet-more]') || target;
        if (group.open && focus.control === 'value') target = qsa(group, '[data-hfx-facet-value]').filter(function (node) { return node.getAttribute('data-hfx-facet-value') === focus.value; })[0] || target;
        try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
      }
    });
  };

  // The most frequent values of a quick filter column among the rows the other filters leave, with their counts.
  // A remote dataset counts them on the server, together with the page.
  Explorer.prototype.quickValues = function (col) {
    if (this.remote) return this.facets[col.id.toLowerCase()] || [];
    var spec = this.querySpec(col.id);
    spec.limit = 0;
    var rows = runQuery(this.ds, spec, this.queryTime === undefined ? this.referenceTime() : this.queryTime);
    return col.distinct(rows);
  };

  Explorer.prototype.renderChips = function () {
    var self = this, bar = this.chipBar, ds = this.ds;
    bar.textContent = '';
    var any = false, removable = false;
    (this.cfg.contextChips || []).forEach(function (text) {
      any = true;
      bar.appendChild(el('span', 'hfx-dx-fchip is-context', String(text)));
    });
    // A filter another component applied comes first, named after it; removing it tells that component (hfx-dx:externalfilter).
    this.externalFilters().forEach(function (f) {
      any = true; removable = true;
      var chip = el('span', 'hfx-dx-fchip is-linked'), text = (f.label ? f.label + ': ' : '') + f.values.slice(0, 3).join(', ') + (f.values.length > 3 ? ' +' + (f.values.length - 3) : '');
      chip.appendChild(el('span', null, text));
      var x = el('button', 'hfx-dx-fchip-remove', '×'); attr(x, 'type', 'button'); attr(x, 'aria-label', removeFilterLabel(self.labels, text));
      x.addEventListener('click', function () {
        self.setExternalFilter(f.source, null);
        self.root.dispatchEvent(new CustomEvent('hfx-dx:externalfilter', { bubbles: true, detail: { source: f.source, reason: 'user' } }));
      });
      chip.appendChild(x);
      bar.appendChild(chip);
    });
    this.state.filters.forEach(function (f, i) {
      any = true; removable = true;
      var chip = el('span', 'hfx-dx-fchip' + (f.fromView ? ' is-view' : ''));
      var text = describeFilter(ds, f, self.labels);
      chip.appendChild(el('span', null, text));
      var x = el('button', 'hfx-dx-fchip-remove', '×'); attr(x, 'type', 'button'); attr(x, 'aria-label', removeFilterLabel(self.labels, text));
      x.addEventListener('click', function () { self.state.filters.splice(i, 1); self.refresh(true); });
      chip.appendChild(x);
      bar.appendChild(chip);
    });
    Object.keys(this.state.quick).forEach(function (id) {
      var col = ds.column(id), set = self.state.quick[id];
      if (!col) return;
      Object.keys(set).filter(function (value) { return set[value]; }).forEach(function (value) {
        any = true; removable = true;
        var text = col.label + ': ' + (col.kind === 'b' ? booleanWord(self.labels, value) : col.textOf(col.parse(value), 'display'));
        var chip = el('span', 'hfx-dx-fchip'); chip.appendChild(el('span', null, text));
        var remove = el('button', 'hfx-dx-fchip-remove', '×'); attr(remove, 'type', 'button'); attr(remove, 'aria-label', removeFilterLabel(self.labels, text));
        remove.addEventListener('click', function () { delete set[value]; self.refresh(true); });
        chip.appendChild(remove); bar.appendChild(chip);
      });
    });
    (this.nativeFilterDetails || []).forEach(function (filter, index) {
      any = true; removable = true;
      var text = describeFilter(ds, { column: filter.column, op: filter.operator, values: filter.values || [] }, self.labels);
      var chip = el('span', 'hfx-dx-fchip'); chip.appendChild(el('span', null, text));
      var remove = el('button', 'hfx-dx-fchip-remove', '×'); attr(remove, 'type', 'button'); attr(remove, 'aria-label', removeFilterLabel(self.labels, text));
      remove.addEventListener('click', function () { if (self.renderer && self.renderer.removeNativeFilter) self.renderer.removeNativeFilter(index); });
      chip.appendChild(remove); bar.appendChild(chip);
    });
    if (this.nativeFilterGroup) {
      any = true; removable = true;
      var grouped = el('span', 'hfx-dx-fchip', self.labels.filters || 'Filters');
      var removeGroup = el('button', 'hfx-dx-fchip-remove', '×'); attr(removeGroup, 'type', 'button'); attr(removeGroup, 'aria-label', self.labels.clearFilters || 'Clear filters');
      removeGroup.addEventListener('click', function () { if (self.renderer && self.renderer.clearFilters) self.renderer.clearFilters(); self.refresh(true); });
      grouped.appendChild(removeGroup); bar.appendChild(grouped);
    }
    if (this.viewModified && this.currentView()) {
      any = true;
      var reset = el('button', 'hfx-dx-btn is-quiet hfx-dx-reset-view', self.labels.resetView || 'Reset view'); attr(reset, 'type', 'button');
      reset.addEventListener('click', function () {
        if (self.renderer && self.renderer.clearFilters) self.renderer.clearFilters();
        self.applyView(self.currentView(), false);
      });
      bar.appendChild(reset);
    }
    if (removable) {
      var clear = el('button', 'hfx-dx-btn is-quiet', self.labels.clearAll || 'Clear all'); attr(clear, 'type', 'button');
      clear.addEventListener('click', function () {
        self.externalFilters().forEach(function (f) {
          self.setExternalFilter(f.source, null, true);
          self.root.dispatchEvent(new CustomEvent('hfx-dx:externalfilter', { bubbles: true, detail: { source: f.source, reason: 'user' } }));
        });
        self.state.filters = []; self.state.quick = dict();
        if (self.renderer && self.renderer.clearFilters) self.renderer.clearFilters();
        self.refresh(true);
      });
      bar.appendChild(clear);
    }
    bar.hidden = !any;
  };

  } };
})();
