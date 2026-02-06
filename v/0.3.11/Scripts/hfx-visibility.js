(function () {
    if (window.__hfxVisibleInitDone) return; window.__hfxVisibleInitDone = true;

    function getTargetFromEvent(e) {
        var t = e && e.target; if (!t) return null;
        var sel = t.getAttribute && (t.getAttribute('data-bs-target') || t.getAttribute('href'));
        if (sel && sel.startsWith('#')) return document.querySelector(sel);
        return t;
    }

    function bodyAttr(name) {
        try { return document.body && document.body.getAttribute ? document.body.getAttribute(name) : null; } catch (_e) { return null; }
    }

    // Behavior of htmlForgeXWhenVisible can be configured via body attributes:
    //  - data-hfx-whenvisible-mode="viewport" to defer until element enters viewport (IntersectionObserver)
    //  - data-hfx-whenvisible-root-margin="200px" to pre-initialize before it is fully visible
    //  - data-hfx-whenvisible-threshold="0" to control IntersectionObserver threshold
    var __hfxWhenVisibleMode = 'displayed';
    var __hfxWhenVisibleRootMargin = '200px';
    var __hfxWhenVisibleThreshold = 0;
    try {
        var m = bodyAttr('data-hfx-whenvisible-mode');
        m = (m || '').toString().toLowerCase().trim();
        if (m === 'viewport' || m === 'inviewport') __hfxWhenVisibleMode = 'viewport';
        var rm = bodyAttr('data-hfx-whenvisible-root-margin');
        rm = (rm || '').toString().trim();
        if (rm) __hfxWhenVisibleRootMargin = rm;
        var th = bodyAttr('data-hfx-whenvisible-threshold');
        if (th != null && th !== '') {
            var f = parseFloat(th);
            if (!isNaN(f)) __hfxWhenVisibleThreshold = f;
        }
    } catch (_e) { }

    // -------------------------
    // Deferred init helpers
    // -------------------------
    var __hfxWhenVisibleQueue = []; // [{ el:HTMLElement, cb:Function }]
    var __hfxWhenVisibleObserver = null;
    var __hfxWhenVisibleObserved = []; // [{ el:HTMLElement, cbs:[Function] }]

    function ensureWhenVisibleObserver() {
        try {
            if (__hfxWhenVisibleMode !== 'viewport') return null;
            if (__hfxWhenVisibleObserver) return __hfxWhenVisibleObserver;
            if (!(window && window.IntersectionObserver)) return null;
            __hfxWhenVisibleObserver = new IntersectionObserver(function (entries) {
                try {
                    (entries || []).forEach(function (entry) {
                        try {
                            if (!entry || !entry.isIntersecting) return;
                            var el = entry.target;
                            try { __hfxWhenVisibleObserver.unobserve(el); } catch (_u) { }
                            var cbs = [];
                            for (var i = 0; i < __hfxWhenVisibleObserved.length; i++) {
                                var it = __hfxWhenVisibleObserved[i];
                                if (it && it.el === el) {
                                    cbs = it.cbs || [];
                                    __hfxWhenVisibleObserved.splice(i, 1);
                                    break;
                                }
                            }
                            (cbs || []).forEach(function (cb) { try { cb(el); } catch (_cb) { } });
                        } catch (_e1) { }
                    });
                } catch (_e2) { }
            }, { root: null, rootMargin: __hfxWhenVisibleRootMargin, threshold: __hfxWhenVisibleThreshold });
            return __hfxWhenVisibleObserver;
        } catch (_e) {
            __hfxWhenVisibleObserver = null;
            return null;
        }
    }

    function observeWhenInViewport(el, cb) {
        try {
            if (!el || typeof cb !== 'function') return false;
            var obs = ensureWhenVisibleObserver();
            if (!obs) return false;
            var entry = null;
            for (var i = 0; i < __hfxWhenVisibleObserved.length; i++) {
                var it = __hfxWhenVisibleObserved[i];
                if (it && it.el === el) { entry = it; break; }
            }
            if (!entry) {
                entry = { el: el, cbs: [] };
                __hfxWhenVisibleObserved.push(entry);
                try { obs.observe(el); } catch (_o) { }
            }
            entry.cbs.push(cb);
            return true;
        } catch (_e) { return false; }
    }

    function isElementVisible(el) {
        try {
            if (!el) return false;
            // Prefer "has a box" checks; offsetParent can be null for some positioned elements.
            if (el.offsetWidth || el.offsetHeight) return true;
            var r = el.getClientRects && el.getClientRects();
            return !!(r && r.length);
        } catch (_e) { return false; }
    }

    function resolveElement(elOrSelector) {
        try {
            if (!elOrSelector) return null;
            if (typeof elOrSelector === 'string') return document.querySelector(elOrSelector);
            return elOrSelector;
        } catch (_e) { return null; }
    }

    function flushWhenVisible(root) {
        try {
            if (!__hfxWhenVisibleQueue.length) return;
            var keep = [];
            for (var i = 0; i < __hfxWhenVisibleQueue.length; i++) {
                var it = __hfxWhenVisibleQueue[i];
                var el = it && it.el; var cb = it && it.cb;
                if (!el || !cb) continue;
                if (!el.isConnected) continue;
                if (root && root !== document) {
                    try {
                        if (el !== root && !(root.contains && root.contains(el))) {
                            keep.push(it);
                            continue;
                        }
                    } catch (_c) { /* fall through */ }
                }
                if (isElementVisible(el)) {
                    if (__hfxWhenVisibleMode === 'viewport') {
                        // Don't initialize heavy widgets during initial HTML parsing.
                        try {
                            if (document && document.readyState === 'loading') {
                                keep.push(it);
                                continue;
                            }
                        } catch (_rs) { }
                        // Use IntersectionObserver when available; fall back to immediate init.
                        if (!observeWhenInViewport(el, cb)) {
                            try { cb(el); } catch (_cb) { }
                        }
                    } else {
                        try { cb(el); } catch (_cb) { }
                    }
                } else {
                    keep.push(it);
                }
            }
            __hfxWhenVisibleQueue = keep;
        } catch (_e) { }
    }

    // Public API: run callback once the element becomes visible (displayed)
    window.htmlForgeXWhenVisible = function (elOrSelector, callback) {
        try {
            var el = resolveElement(elOrSelector);
            if (!el || typeof callback !== 'function') return false;
            if (isElementVisible(el)) {
                // If called during initial HTML parsing (inline scripts), defer until DOMContentLoaded
                // so layout (tabs/cards/styles) is stable before heavy widgets initialize.
                try {
                    if (document && document.readyState === 'loading') {
                        __hfxWhenVisibleQueue.push({ el: el, cb: callback });
                        return false;
                    }
                } catch (_rs) { }
                if (__hfxWhenVisibleMode === 'viewport') {
                    if (observeWhenInViewport(el, callback)) return false;
                }
                try { callback(el); } catch (_e) { }
                return true;
            }
            __hfxWhenVisibleQueue.push({ el: el, cb: callback });
            return false;
        } catch (_e) { return false; }
    };

    // Public API: attempt to run any queued callbacks that are now visible (optionally scoped under root)
    window.htmlForgeXFlushWhenVisible = function (root) {
        try { flushWhenVisible(root || document); } catch (_e) { }
    };

    function hfxRefreshVisible(root) {
        try {
            if (!root) root = document;

            // Chart.js (resize canvases)
            if (window.htmlForgeXCharts) {
                var canvases = root.querySelectorAll && root.querySelectorAll('canvas[id]');
                if (canvases) {
                    canvases.forEach(function (cv) {
                        var ch = window.htmlForgeXCharts[cv.id];
                        if (ch && typeof ch.resize === 'function') {
                            try { ch.resize(); } catch (_) { }
                        }
                    });
                }
            }

            // DataTables: reset widths and recalc after reveal (lightweight)
            var $ = window.jQuery || window.$;
            if ($ && $.fn && $.fn.DataTable) {
                $(root).find('table.dataTable, table.dt-table').each(function () {
                    // Never initialize a new table here; only adjust already-initialized instances.
                    try {
                        if ($.fn.dataTable && $.fn.dataTable.isDataTable && !$.fn.dataTable.isDataTable(this)) return;
                    } catch(_d) { }

                    var api = $(this).DataTable();
                    if (api) {
                        try {
                            var $tbl = $(api.table().node());
                            var $wrap = $(api.table().container());
                            $tbl.css('width', '100%');
                            $wrap.css('width', '100%').css('max-width', '100%');
                            // Adjust column widths and redraw without changing paging
                            // Avoid draw() here: it can keep the "processing" overlay visible in heavy pages.
                            // Column adjustment + responsive recalc are enough for most reveal/layout fixes.
                            if (api.columns && api.columns.adjust) { api.columns.adjust(); }
                            if (api.responsive && api.responsive.recalc) api.responsive.recalc();
                        } catch (_) { }
                    }
                });
            }

            // jsVectorMap: refresh maps after reveal (tabs/collapse/modals/resize).
            try {
                if (window.hfxJsVectorMap && typeof window.hfxJsVectorMap.refresh === 'function') {
                    window.hfxJsVectorMap.refresh(root);
                }
            } catch (_m) { }

            // Apply deferred initializers (lazy DataTables/charts/etc.) when the region becomes visible.
            try { flushWhenVisible(root); } catch (_f) { }

            // VisNetwork: redraw any initialized networks under this root on reveal
            try {
                var tracker = (window.diagramTracker) || (typeof diagramTracker !== 'undefined' ? diagramTracker : null);
                if (tracker && root && root.querySelectorAll) {
                    var diagrams = root.querySelectorAll('div.diagramObject[id]');
                    if (diagrams) {
                        diagrams.forEach(function (el) {
                            try {
                                var id = el && el.id;
                                if (!id) return;
                                var net = tracker[id];
                                if (net && typeof net.redraw === 'function') {
                                    net.redraw();
                                }
                            } catch (_n) { }
                        });
                    }
                }
            } catch (_v) { }

            // If tabs persistence is enabled, apply any deferred saved tab selections under this root.
            try { if (window.hfxTabsApplySaved) window.hfxTabsApplySaved(root); } catch (_t) { }
        } catch (err) { }
    }

    window.htmlForgeXRefreshVisible = hfxRefreshVisible;

    var evts = ['shown.bs.tab', 'shown.bs.collapse', 'shown.bs.modal', 'shown.bs.offcanvas'];
    evts.forEach(function (ev) {
        document.addEventListener(ev, function (e) {
            var target = getTargetFromEvent(e) || document;
            requestAnimationFrame(function () { hfxRefreshVisible(target); });
            // Single follow-up pass to catch Bootstrap transition settling
            setTimeout(function () { hfxRefreshVisible(target); }, 240);
        });
    });

    // Safety net: if a tab link is clicked (some themes/plugins emit custom events),
    // schedule a late refresh on the likely target panel.
    document.addEventListener('click', function (e) {
        try {
            var t = e.target && e.target.closest && e.target.closest('[data-bs-toggle="tab"]');
            if (!t) return;
            var sel = t.getAttribute('data-bs-target') || t.getAttribute('href');
            if (!sel || sel.charAt(0) !== '#') return;
            var panel = document.querySelector(sel);
            if (!panel) return;
            setTimeout(function () { hfxRefreshVisible(panel); }, 500);
        } catch (_) { }
    }, true);

    // Mutation observer to catch class changes on tab panes becoming active
    try {
        var mo = new MutationObserver(function(muts){
            var pending = [];
            muts.forEach(function(m){ if(m.type==='attributes' && m.attributeName==='class'){ var el=m.target; if(el.classList && el.classList.contains('tab-pane') && (el.classList.contains('active')||el.classList.contains('show'))){ pending.push(el);} }});
            if(pending.length){ setTimeout(function(){ pending.forEach(function(el){ try{ hfxRefreshVisible(el); } catch(_){ } }); }, 60); }
        });
        document.addEventListener('DOMContentLoaded', function(){ try { document.querySelectorAll('.tab-pane').forEach(function(p){ mo.observe(p, { attributes:true }); }); } catch(_){ } });
    } catch(_){ }

    // Perform an initial pass on DOM ready to catch any components that
    // initialized while hidden or before our handlers attached.
    try {
        document.addEventListener('DOMContentLoaded', function(){
            try {
                requestAnimationFrame(function(){ hfxRefreshVisible(document); });
                setTimeout(function(){ hfxRefreshVisible(document); }, 240);
            } catch(_e){}
        });
    } catch(_){ }
})();
