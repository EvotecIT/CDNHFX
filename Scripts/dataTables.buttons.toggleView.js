/*!
 * Toggle View button for Buttons and DataTables.
 * Switches between responsive and scrollX modes.
 */
!function (n) { var o, r; "function" == typeof define && define.amd ? define(["jquery", "datatables.net", "datatables.net-buttons"], function (t) { return n(t, window, document) }) : "object" == typeof exports ? (o = require("jquery"), r = function (t, e) { e.fn.dataTable || require("datatables.net")(t, e), e.fn.dataTable.Buttons || require("datatables.net-buttons")(t, e) }, "undefined" == typeof window ? module.exports = function (t, e) { return t = t || window, e = e || o(t), r(t, e), n(e, t, t.document) } : (r(window, o), module.exports = n(o, window, window.document))) : n(jQuery, window, document) }(function (n, t, e) {
    "use strict";
    var o = n.fn.dataTable;

    // Add the toggleView button type (and alias hfxToggleView)
    var def = {
            className: "buttons-toggle-view", text: function (dt, node, config) {
                // Set initial button text based on current state
                var settings = dt.settings()[0];
                var isResponsive = settings.responsive !== undefined;
                var isScrollX = settings.oInit.scrollX === true;

                if (isResponsive) {
                    return "Switch to ScrollX";
                } else {
                    return "Switch to Responsive";
                }
            },
            action: function (e, dt, node, config) {
                // Prefer external helper if present (preserves state + rebinds plugins)
                if (window.hfxToggleView) {
                    var api = window.hfxToggleView(dt);
                    // Fix button text after toggle on the new instance
                    try {
                        var st = api.settings()[0];
                        var scroll = !!(st && st.oInit && st.oInit.scrollX);
                        var label = scroll ? 'Switch to Responsive' : 'Switch to ScrollX';
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
                    // Update button text
                    try { var ns = newTable.settings()[0]; node.innerHTML = ns.responsive ? 'Switch to ScrollX' : 'Switch to Responsive'; } catch(_){}
                } catch(_e) { }
            }
    };
    var map = {}; map['toggleView']=def; map['hfxToggleView']=def; n.extend(o.ext.buttons, map);

    return o;
});
