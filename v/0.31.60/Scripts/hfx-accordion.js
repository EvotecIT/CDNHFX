(function () {
    // Single-open behavior and persistence for accordions
    var hfxState = null;
    try { hfxState = window.hfxState || null; } catch (_e) { hfxState = null; }
    if (!hfxState) {
        hfxState = {
            store: {
                getItem: function () { return null; },
                setItem: function () { return false; },
                removeItem: function () { return false; }
            },
            shouldReset: function () { return false; }
        };
    }
    var hfxStore = hfxState.store || {
        getItem: function () { return null; },
        setItem: function () { return false; },
        removeItem: function () { return false; }
    };
    function shouldReset(kind) {
        try { return hfxState && hfxState.shouldReset ? hfxState.shouldReset(kind) : false; } catch (_e) { return false; }
    }
    /** @param {Element} acc */
    function accStorageKey(acc) { var id = acc && acc.getAttribute && acc.getAttribute('data-hfx-acc-id'); return id ? 'hfx:acc:' + id : null; }
    /** @param {Element} acc */
    function saveAccState(acc) {
        try {
            var key = accStorageKey(acc); if (!key) return;
            var openIds = [];
            acc.querySelectorAll('.accordion-collapse.show').forEach(function (c) {
                var k = c.getAttribute && c.getAttribute('data-hfx-acc-key');
                if (k) { openIds.push('k:' + k); return; }
                if (c.id) openIds.push('i:' + c.id);
            });
            hfxStore.setItem(key, JSON.stringify(openIds));
        } catch (_) { }
    }
    /** @param {Element} acc */
    function restoreAccState(acc) {
        try {
            var key = accStorageKey(acc); if (!key) return;
            var raw = hfxStore.getItem(key); if (!raw) return;
            var list = JSON.parse(raw); if (!Array.isArray(list)) return;
            list.forEach(function (token) {
                var el = null;
                var val = (token || '').toString();
                if (val.indexOf('k:') === 0) {
                    var k = val.substring(2);
                    el = acc.querySelector ? acc.querySelector('[data-hfx-acc-key=\"' + k + '\"]') : null;
                } else if (val.indexOf('i:') === 0) {
                    var id = val.substring(2);
                    el = document.getElementById(id);
                } else {
                    // Legacy token: prefer data-hfx-acc-key to avoid ID/key collisions.
                    el = (acc.querySelector ? acc.querySelector('[data-hfx-acc-key=\"' + val + '\"]') : null) || document.getElementById(val);
                }
                if (el) {
                    try { (window.bootstrap && window.bootstrap.Collapse ? window.bootstrap.Collapse : bootstrap).getOrCreateInstance(el).show(); } catch (_) { }
                }
            });
        } catch (_) { }
    }

    // Debug helpers
    function isDebugAcc(acc) { return !!(acc && (acc.getAttribute('data-hfx-debug') === '1' || window.HFX_ACC_DEBUG === true)); }
    function getPanel(btn) { var sel = btn && btn.getAttribute && (btn.getAttribute('data-bs-target') || btn.getAttribute('href')); if (!sel || sel.charAt(0) !== '#') return null; return document.querySelector(sel); }
    function ensureDebugChip(btn) { try { var hdr = btn.closest('.accordion-header'); if (!hdr) return null; var chip = hdr.querySelector('.hfx-acc-debug'); if (!chip) { chip = document.createElement('small'); chip.className = 'hfx-acc-debug text-muted'; hdr.appendChild(chip); } return chip; } catch (_) { return null; } }
    function accState(btn) {
        try {
            var acc = btn.closest('.accordion'); var pnl = getPanel(btn); return {
                btnTarget: (btn.getAttribute('data-bs-target') || btn.getAttribute('href') || '').toString(),
                expanded: btn.getAttribute('aria-expanded'),
                panelId: pnl && pnl.id,
                panelShown: !!(pnl && pnl.classList.contains('show')),
                panelParent: pnl && pnl.getAttribute('data-bs-parent') || '',
                accId: acc && acc.getAttribute('id') || '',
                singleOpen: acc && acc.getAttribute('data-hfx-single-open') || '',
                persistKey: acc && acc.getAttribute('data-hfx-acc-id') || ''
            };
        } catch (_) { return null; }
    }
    function updateChip(btn, label) {
        try { var chip = ensureDebugChip(btn); if (!chip) return; var s = accState(btn); var parts = []; if (label) parts.push(label); if (s) { parts.push('t=' + s.btnTarget); parts.push('open=' + s.panelShown); if (s.panelParent) parts.push('parent=' + s.panelParent); if (s.singleOpen) parts.push('singleOpen=' + s.singleOpen); if (s.persistKey) parts.push('persist=' + s.persistKey); } chip.textContent = parts.join(' | '); } catch (_) { }
    }

    document.addEventListener('show.bs.collapse', function (e) {
        try {
            var el = e && (e.target || e.srcElement); if (!el) return;
            // Only apply single-open behavior within the nearest accordion to avoid closing parent accordions.
            var acc = el.closest && el.closest('.accordion'); if (!acc) return;
            if (!acc.hasAttribute || !acc.hasAttribute('data-hfx-single-open')) return;
            if (acc.getAttribute && acc.getAttribute('data-hfx-single-open') !== '1') return;
            var open = acc.querySelectorAll('.accordion-collapse.show');
            open.forEach(function (p) {
                if (p !== el && (!p.closest || p.closest('.accordion') === acc)) {
                    try { (window.bootstrap && window.bootstrap.Collapse ? window.bootstrap.Collapse : bootstrap).getOrCreateInstance(p).hide(); } catch (_) { }
                }
            });
        } catch (_) { }
    });

    // Update button state as soon as transition starts for snappier icon feedback
    document.addEventListener('show.bs.collapse', function (e) { var el = e && (e.target || e.srcElement); if (!el) return; var acc = el.closest && el.closest('.accordion'); var btn = acc && acc.querySelector && (acc.querySelector('[data-bs-target="#' + el.id + '"]') || acc.querySelector('[href="#' + el.id + '"]')); if (btn) { try { btn.classList.remove('collapsed'); btn.setAttribute('aria-expanded', 'true'); } catch (_) { } } });
    document.addEventListener('hide.bs.collapse', function (e) { var el = e && (e.target || e.srcElement); if (!el) return; var acc = el.closest && el.closest('.accordion'); var btn = acc && acc.querySelector && (acc.querySelector('[data-bs-target="#' + el.id + '"]') || acc.querySelector('[href="#' + el.id + '"]')); if (btn) { try { btn.classList.add('collapsed'); btn.setAttribute('aria-expanded', 'false'); } catch (_) { } } });
    document.addEventListener('shown.bs.collapse', function (e) { var el = e && (e.target || e.srcElement); if (!el) return; var acc = el.closest && el.closest('.accordion'); var btn = acc && acc.querySelector && (acc.querySelector('[data-bs-target="#' + el.id + '"]') || acc.querySelector('[href="#' + el.id + '"]')); if (isDebugAcc(acc)) { if (btn) updateChip(btn, 'shown'); try { console.debug('[HFX:acc] shown', accState(btn || {})); } catch (_) { } } if (acc && acc.getAttribute && acc.getAttribute('data-hfx-acc-id')) saveAccState(acc); });
    document.addEventListener('hidden.bs.collapse', function (e) { var el = e && (e.target || e.srcElement); if (!el) return; var acc = el.closest && el.closest('.accordion'); var btn = acc && acc.querySelector && (acc.querySelector('[data-bs-target="#' + el.id + '"]') || acc.querySelector('[href="#' + el.id + '"]')); if (isDebugAcc(acc)) { if (btn) updateChip(btn, 'hidden'); try { console.debug('[HFX:acc] hidden', accState(btn || {})); } catch (_) { } } if (acc && acc.getAttribute && acc.getAttribute('data-hfx-acc-id')) saveAccState(acc); });
    // Block inadvertent reopen immediately after a deliberate hide
    document.addEventListener('show.bs.collapse', function (e) { var el = e && (e.target || e.srcElement); if (!el) return; if (el.getAttribute('data-hfx-no-reopen') === '1') { try { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); e.stopPropagation(); } catch (_) { } return false; } });
    document.addEventListener('hidden.bs.collapse', function (e) { var el = e && (e.target || e.srcElement); if (!el) return; try { el.removeAttribute('data-hfx-no-reopen'); } catch (_) { } });

    // Robust toggle: always handle header clicks ourselves to avoid double-toggles
    // and to guarantee that clicking the same header closes it (even with/without data-bs-parent).
    document.addEventListener('click', function (e) {
        var btn = e && e.target && e.target.closest && e.target.closest('.accordion .accordion-button');
        if (!btn) return;
        var acc = btn.closest && btn.closest('.accordion');
        if (isDebugAcc(acc)) { updateChip(btn, 'clicked'); try { console.debug('[HFX:acc] click', accState(btn)); } catch (_) { } }
        // Copy title button: prevent toggle and copy to clipboard
        var copyEl = e.target && e.target.closest && e.target.closest('.hfx-copy-title');
        if (copyEl) {
            try {
                var txt = copyEl.getAttribute('data-copytext') || '';
                var doDone = function(ok){ try { copyEl.setAttribute('data-copied', ok ? '1' : '0'); setTimeout(function(){ try { copyEl.removeAttribute('data-copied'); } catch(_){} }, 1200); } catch(_){} };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(txt).then(function(){ doDone(true); }, function(){ doDone(false); });
                } else {
                    var ta = document.createElement('textarea'); ta.value = txt; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.focus(); ta.select();
                    try { var ok = document.execCommand('copy'); doDone(!!ok); } catch(_) { doDone(false); }
                    document.body.removeChild(ta);
                }
            } catch(_){}
            e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); e.stopPropagation(); return;
        }
        // Ignore clicks on explicit header actions and trailing area inside the button
        if (e.target && e.target.closest && (e.target.closest('.hfx-accordion-actions') || e.target.closest('.hfx-accordion-trailing'))) {
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            e.stopPropagation();
            return;
        }
        var sel = btn.getAttribute && (btn.getAttribute('data-bs-target') || btn.getAttribute('href'));
        if (!sel || sel.charAt(0) !== '#') return;
        var panel = document.querySelector(sel);
        if (!panel) return;
        try {
            var BS = (window.bootstrap && window.bootstrap.Collapse ? window.bootstrap.Collapse : bootstrap);
            var inst = BS.getOrCreateInstance(panel);
            var isShown = panel.classList && panel.classList.contains('show');
            if (isShown) {
                try { panel.setAttribute('data-hfx-no-reopen', '1'); } catch (_) { }
                inst.hide();
            } else {
                if (acc && acc.getAttribute && acc.getAttribute('data-hfx-single-open') === '1') {
                    try { acc.querySelectorAll('.accordion-collapse.show').forEach(function (p) { if (p !== panel) { BS.getOrCreateInstance(p).hide(); } }); } catch (_) { }
                }
                inst.show();
            }
            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            e.stopPropagation();
        } catch (_) { }
    }, true);

    // Search/filter support
    function parseQuery(q) {
        try {
            var s = (q || '').toString();
            // Normalize OR operators
            var norm = s.replace(/\s+or\s+/ig, ' | ');
            // Split into OR groups
            var parts = norm.split('|').map(function (p) { return p.trim(); }).filter(Boolean);
            if (parts.length === 0) return [];
            function scanTokens(part) {
                var tokens = [];
                var re = /\"([^\"]+)\"|([^\s]+)/g; // quoted phrase or word
                var m; while ((m = re.exec(part)) !== null) {
                    var raw = (m[1] || m[2] || '').trim();
                    if (!raw) continue;
                    // Ignore common AND joiners
                    if (/^(&&?|and)$/i.test(raw)) continue;
                    var neg = false;
                    if (raw[0] === '!' || raw[0] === '-') { neg = true; raw = raw.substring(1); }
                    tokens.push({ t: raw.toLowerCase(), neg: neg });
                }
                return tokens;
            }
            return parts.map(function (p) { return scanTokens(p); });
        } catch (_) { return []; }
    }

    // Cache accordion items to avoid repeated DOM queries on each keystroke
    var ACC_CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var ACC_OBS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    function getAccItems(acc) {
        try {
            if (ACC_CACHE) {
                var c = ACC_CACHE.get(acc);
                if (c && Array.isArray(c.items)) return c.items;
                var list = Array.prototype.slice.call(acc.querySelectorAll('.accordion-item'));
                ACC_CACHE.set(acc, { items: list });
                return list;
            }
            return Array.prototype.slice.call(acc.querySelectorAll('.accordion-item'));
        } catch (_) { return []; }
    }

    function filterAccByQuery(acc, q, noResultsEl, items) {
        try {
            var query = (q || '').toString().trim();
            var groups = parseQuery(query); // array of arrays of {t,neg}
            items = items && items.length ? items : getAccItems(acc);
            var visible = 0;
            (items.forEach ? items : Array.prototype.slice.call(items)).forEach(function (it) {
                var btn = it.querySelector('.accordion-button');
                var text = (btn && (btn.textContent || btn.innerText) || '').toString().toLowerCase();
                var match;
                if (!query) {
                    match = true;
                } else if (groups.length === 0) {
                    match = text.indexOf(query.toLowerCase()) !== -1;
                } else {
                    // OR across groups; within a group use AND, with support for negated tokens
                    match = groups.some(function (tokens) {
                        var ok = true;
                        for (var i = 0; i < tokens.length && ok; i++) {
                            var tok = tokens[i];
                            var has = text.indexOf(tok.t) !== -1;
                            ok = tok.neg ? !has : has;
                        }
                        return ok;
                    });
                }
                if (match) {
                    it.classList.remove('hfx-acc-hidden');
                    visible++;
                } else {
                    // If currently shown, close to avoid stray open states
                    var pnl = it.querySelector('.accordion-collapse.show');
                    if (pnl) {
                        try { (window.bootstrap && window.bootstrap.Collapse ? window.bootstrap.Collapse : bootstrap).getOrCreateInstance(pnl).hide(); } catch (_) { }
                    }
                    it.classList.add('hfx-acc-hidden');
                }
            });
            if (noResultsEl) {
                if (query && visible === 0) noResultsEl.classList.remove('d-none'); else noResultsEl.classList.add('d-none');
            }
        } catch (_) { }
    }

    function ensureObserver(acc) {
        try {
            if (!ACC_CACHE || !window.MutationObserver) return;
            if (ACC_OBS && ACC_OBS.get(acc)) return;
            var refresh = function () {
                try {
                    var list = Array.prototype.slice.call(acc.querySelectorAll('.accordion-item'));
                    ACC_CACHE.set(acc, { items: list });
                } catch (_) { }
            };
            var t;
            var obs = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].type === 'childList') { clearTimeout(t); t = setTimeout(refresh, 100); break; }
                }
            });
            obs.observe(acc, { childList: true, subtree: true });
            if (ACC_OBS) ACC_OBS.set(acc, obs);
        } catch (_) { }
    }

    function bindSearchInputs() {
        try {
            document.querySelectorAll('[data-hfx-acc-search]').forEach(function (inp) {
                if (inp.getAttribute('data-hfx-bound') === '1') return; // avoid duplicate bindings
                var sel = inp.getAttribute('data-hfx-acc-search');
                if (!sel) return;
                var acc = null; try { acc = document.querySelector(sel); } catch (_) { }
                if (!acc) return;
                var noRes = inp.nextElementSibling && inp.nextElementSibling.classList && inp.nextElementSibling.classList.contains('hfx-acc-no-results') ? inp.nextElementSibling : null;
                ensureObserver(acc);
                // Debounce input to improve perf on large accordions
                var debounce = function (fn, wait) { var t; return function () { var ctx = this, args = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(ctx, args); }, wait || 150); }; };
                var waitAttr = parseInt(inp.getAttribute('data-hfx-acc-debounce') || '', 10);
                var wait = isNaN(waitAttr) ? 150 : Math.max(0, waitAttr);
                var handler = debounce(function () { var items = getAccItems(acc); filterAccByQuery(acc, inp.value, noRes, items); }, wait);
                inp.addEventListener('input', handler);
                inp.addEventListener('change', handler);
                inp.addEventListener('keydown', function (e) { if ((e.key || e.keyCode) === 'Escape' || e.keyCode === 27) { try { inp.value = ''; } catch (_) { } filterAccByQuery(acc, '', noRes, getAccItems(acc)); } });
                inp.setAttribute('data-hfx-bound', '1');
            });
        } catch (_) { }
    }

    function initTooltips(root) {
        try {
            var doc = root || document;
            var BS = (window.bootstrap && window.bootstrap.Tooltip ? window.bootstrap : (typeof bootstrap !== 'undefined' ? bootstrap : null));
            if (!BS || !BS.Tooltip) return;
            var els = doc.querySelectorAll('[data-bs-toggle="tooltip"]');
            if (!els) return;
            els.forEach(function (el) { try { BS.Tooltip.getOrCreateInstance(el); } catch (_) { } });
        } catch (_) { }
    }

    function init() {
        document.querySelectorAll('.accordion').forEach(function (acc) {
            if (acc.getAttribute && acc.getAttribute('data-hfx-acc-id')) {
                var key = accStorageKey(acc);
                if (key && shouldReset('accordion')) {
                    try { hfxStore.removeItem(key); } catch (_r) { }
                } else {
                    restoreAccState(acc);
                }
            }
            if (isDebugAcc(acc)) { try { console.debug('[HFX:acc] init', { accId: acc.id || '', singleOpen: acc.getAttribute('data-hfx-single-open') || '', persistKey: acc.getAttribute('data-hfx-acc-id') || '' }); } catch (_) { } var btns = acc.querySelectorAll('.accordion-button'); btns && btns.forEach(function (b) { updateChip(b, 'ready'); }); }
        });
        bindSearchInputs(); initTooltips(document);
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
