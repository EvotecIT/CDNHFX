/*!
 * Toggle View button for Buttons and DataTables.
 * Switches between responsive and scrollX modes.
 */
!function (n) { var o, r; "function" == typeof define && define.amd ? define(["jquery", "datatables.net", "datatables.net-buttons"], function (t) { return n(t, window, document) }) : "object" == typeof exports ? (o = require("jquery"), r = function (t, e) { e.fn.dataTable || require("datatables.net")(t, e), e.fn.dataTable.Buttons || require("datatables.net-buttons")(t, e) }, "undefined" == typeof window ? module.exports = function (t, e) { return t = t || window, e = e || o(t), r(t, e), n(e, t, t.document) } : (r(window, o), module.exports = n(o, window, window.document))) : n(jQuery, window, document) }(function (n, t, e) {
    "use strict";
    var o = n.fn.dataTable;

    function getToggleViewLabels(dt) {
        try {
            var init = dt && dt.init ? dt.init() : null;
            var labels = init && init.hfxToggleViewLabels && typeof init.hfxToggleViewLabels === "object"
                ? init.hfxToggleViewLabels
                : null;
            return labels || {};
        } catch (_) {
            return {};
        }
    }

    function resolveToggleViewLabel(dt, mode) {
        var labels = getToggleViewLabels(dt);
        if (mode === "ScrollX") {
            return labels.switchToResponsive || labels.defaultText || "Switch to Responsive";
        }
        if (mode === "Responsive") {
            return labels.switchToScrollX || labels.defaultText || "Switch to ScrollX";
        }
        return labels.defaultText || "Switch View";
    }

    function getTableId(dt) {
        try {
            var table = dt && dt.table ? dt.table().node() : null;
            if (table && table.id && !/^DataTables_Table_/i.test(table.id)) return table.id;
            var $wrap = dt && dt.table ? n(dt.table().container()) : null;
            var stableId = $wrap && $wrap.length
                ? $wrap.find('table[id]').filter(function () { return this.id && !/^DataTables_Table_/i.test(this.id); }).first().attr('id')
                : null;
            return stableId || (table && table.id ? table.id : null);
        } catch (_) { }
        return null;
    }

    function getColumnFilterState(dt) {
        var state = { id: getTableId(dt), header: false, footer: false };
        try {
            var $wrap = n(dt.table().container());
            state.header = $wrap.find('tr.hfx-header-filter, div.dt-scroll-head input.hfx-dt-column-filter-input, div.dataTables_scrollHead input.hfx-dt-column-filter-input').length > 0;
            state.footer = $wrap.find('tr.hfx-footer-filter, div.dt-scroll-foot input.hfx-dt-column-filter-input, div.dataTables_scrollFoot input.hfx-dt-column-filter-input').length > 0;
        } catch (_) { }
        return state;
    }

    function rebindColumnFilters(dt, state, attempt) {
        try {
            if (!window.hfxDt || !state || (!state.header && !state.footer)) return;
            var id = getTableId(dt) || state.id;
            if (!id) return;
            var selector = '#' + id;
            if (state.header && typeof window.hfxDt.headerFilters === 'function') window.hfxDt.headerFilters(selector);
            if (state.footer && typeof window.hfxDt.footerFilters === 'function') window.hfxDt.footerFilters(selector);
            var $wrap = n(dt.table().container());
            var headerReady = !state.header || $wrap.find('thead tr.hfx-header-filter input.hfx-dt-column-filter-input, div.dt-scroll-head input.hfx-dt-column-filter-input, div.dataTables_scrollHead input.hfx-dt-column-filter-input').length > 0;
            var footerReady = !state.footer || $wrap.find('tfoot tr.hfx-footer-filter input.hfx-dt-column-filter-input, div.dt-scroll-foot input.hfx-dt-column-filter-input, div.dataTables_scrollFoot input.hfx-dt-column-filter-input').length > 0;
            if ((!headerReady || !footerReady) && (attempt || 0) < 6) {
                setTimeout(function () { rebindColumnFilters(dt, state, (attempt || 0) + 1); }, 100);
            }
        } catch (_) {
            if ((attempt || 0) < 6) {
                setTimeout(function () { rebindColumnFilters(dt, state, (attempt || 0) + 1); }, 100);
            }
        }
    }

    // Add the toggleView button type (and alias hfxToggleView)
    var def = {
            className: "buttons-toggle-view", text: function (dt, node, config) {
                // Set initial button text based on current state
                var settings = dt.settings()[0];
                var isResponsive = settings.responsive !== undefined;
                return resolveToggleViewLabel(dt, isResponsive ? "Responsive" : "ScrollX");
            },
            action: function (e, dt, node, config) {
                // Prefer external helper if present (preserves state + rebinds plugins)
                var filterState = getColumnFilterState(dt);
                if (window.hfxToggleView) {
                    var api = window.hfxToggleView(dt);
                    rebindColumnFilters(api || dt, filterState, 0);
                    // Fix button text after toggle on the new instance
                    try {
                        var st = api.settings()[0];
                        var scroll = !!(st && st.oInit && st.oInit.scrollX);
                        var label = resolveToggleViewLabel(api, scroll ? "ScrollX" : "Responsive");
                        api.button('.buttons-toggle-view').text(label);
                    } catch(_){}
                    return;
                }
                // Fallback: keep legacy behavior but preserve more state
                try {
                    var table = dt.table().node(); var id = table && table.id ? table.id : null;
                    var settings = dt.settings()[0]; var isResponsive = settings.responsive !== undefined;
                    var options = n.extend ? n.extend(true, {}, dt.init()) : dt.init();
                    var state = { page: dt.page(), order: dt.order(), search: dt.search(), colSearch: [], colVisible: [] };
                    dt.columns().every(function(i){ state.colSearch[i] = this.search(); state.colVisible[i] = this.visible(); });
                    dt.destroy();
                    if (isResponsive) {
                        if (!options.responsiveConfig && options.responsive) options.responsiveConfig = options.responsive;
                        options.responsive = false;
                        options.scrollX = true;
                        options.autoWidth = true;
                    } else {
                        options.scrollX = false;
                        options.autoWidth = false;
                        options.responsive = options.responsiveConfig || { details: { type: 'inline' } };
                    }
                    var newTable = n(table).DataTable(options);
                    try { if (id) localStorage.setItem('hfx:dt:'+id+':mode', isResponsive ? 'ScrollX' : 'Responsive'); } catch(_){}
                    // Rebind ColumnHighlighter if present
                    try { if (id && window.DataTablesColumnHighlighter) { var CH = window.DataTablesColumnHighlighter; if (CH.configurations && CH.configurations[id]) { CH.configurations[id].table = newTable; if (CH.setupEventHandlers) CH.setupEventHandlers(id, newTable); } } } catch(_){}
                    // Restore state
                    if (Array.isArray(state.colVisible)) state.colVisible.forEach(function(v,i){ newTable.column(i).visible(v, false); });
                    if (typeof state.search === 'string') newTable.search(state.search, false, false);
                    if (Array.isArray(state.colSearch)) state.colSearch.forEach(function(v,i){ if (typeof v === 'string') newTable.column(i).search(v, false, false); });
                    if (Array.isArray(state.order)) newTable.order(state.order);
                    if (typeof state.page === 'number') newTable.page(state.page);
                    newTable.columns.adjust().draw(false);
                    rebindColumnFilters(newTable, filterState, 0);
                    // Update button text
                    try {
                        var ns = newTable.settings()[0];
                        node.innerHTML = resolveToggleViewLabel(newTable, ns.responsive ? "Responsive" : "ScrollX");
                    } catch(_){}
                } catch(_e) { }
            }
    };
    var map = {}; map['toggleView']=def; map['hfxToggleView']=def; n.extend(o.ext.buttons, map);

    return o;
});
