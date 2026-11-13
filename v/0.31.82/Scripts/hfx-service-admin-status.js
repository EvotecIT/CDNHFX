/* Status lists show a small live source as readable records. They share the authenticated admin transport and never submit settings. */
(function () {
    'use strict';
    var api = window.HfxServiceAdmin = window.HfxServiceAdmin || {};
    function plain(value) { return value && typeof value === 'object' ? (value.text ?? value.value) : value; }
    function format(value, fact) {
        value = plain(value);
        if (value == null || value === '' || value === '—') return '';
        if (/\bdatetime\b/.test(fact.format)) {
            var date = new Date(value);
            return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
        }
        return String(value);
    }
    function item(definition, row) {
        var cells = row.cells || {}, li = document.createElement('li'), head = document.createElement('div');
        li.className = 'hfx-admin-status-item'; li.dataset.hfxAdminStatusRow = row.id ?? '';
        head.className = 'hfx-admin-status-item__head';
        var title = document.createElement('strong');
        title.textContent = definition.title ? (format(cells[definition.title], { format: '' }) || 'Not named') : '';
        if (definition.title) head.append(title);
        if (definition.status) {
            var text = format(cells[definition.status], { format: '' }) || 'Unknown', chip = document.createElement('span');
            var tone = (cells[definition.status] && cells[definition.status].tone) || (definition.tones || {})[text] ||
                Object.keys(definition.tones || {}).filter(function (key) { return key.toLowerCase() === text.toLowerCase(); }).map(function (key) { return definition.tones[key]; })[0] || 'neutral';
            chip.className = 'hfx-admin-status-chip'; chip.dataset.tone = tone; chip.textContent = text;
            li.dataset.tone = tone; head.append(chip);
        }
        // Actions follow only same-page addresses: a page (#activity) or a page with plain parameters such as a record deep link
        // (#activity&record=42). A cell can carry its own label ({ value, text }); otherwise the list's label is used.
        var actionCell = definition.action && cells[definition.action.key], target = plain(actionCell);
        if (actionCell && typeof actionCell === 'object' && actionCell.value !== undefined) target = actionCell.value;
        if (typeof target === 'string' && /^#[a-z0-9-]+(&[A-Za-z0-9_.-]+=[A-Za-z0-9_.:~%-]+)*$/i.test(target)) {
            var link = document.createElement('a'); link.className = 'hfx-admin-status-action hfx-admin-status-item__action';
            link.href = target; link.textContent = (actionCell && typeof actionCell === 'object' && actionCell.text) || definition.action.label; head.append(link);
        }
        li.append(head);
        var facts = document.createElement('dl'); facts.className = 'hfx-admin-status-item__facts';
        (definition.facts || []).forEach(function (fact) {
            var value = format(cells[fact.key], fact); if (!value) return;
            var group = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
            group.dataset.hfxAdminStatusFact = fact.key;
            if (/\bwide\b/.test(fact.format)) group.className = 'is-wide';
            if (/\bpath\b/.test(fact.format)) detail.className = 'is-path';
            var explanation = fact.explanation && format(cells[fact.explanation], { format: '' });
            term.textContent = fact.label; detail.textContent = value + (explanation ? ' — ' + explanation : ''); group.append(term, detail); facts.append(group);
        });
        if (facts.childElementCount) li.append(facts);
        return li;
    }
    api.bindStatusLists = function (studio, request) {
        return Promise.all(Array.from(studio.querySelectorAll('[data-hfx-admin-status-list]')).map(function (root) {
            if (root._hfxStatus) return root._hfxStatus.refresh();
            var definition = JSON.parse(root.dataset.hfxAdminStatusDefinition || '{}');
            var items = root.querySelector('[data-hfx-admin-status-items]'), message = root.querySelector('[data-hfx-admin-status-message]');
            var freshness = root.querySelector('[data-hfx-admin-status-freshness]'), button = root.querySelector('[data-hfx-admin-status-refresh-button]');
            var timer, pending, controller, disposed = false;
            var interval = Math.max(15, Math.min(3600, Number(root.dataset.hfxAdminStatusRefresh) || 15)) * 1000;
            function visible() { return !document.hidden && root.isConnected && !!root.getClientRects().length; }
            function say(text, state) {
                items.hidden = true; message.hidden = false; message.textContent = text; root.dataset.hfxAdminStatusState = state;
                button.textContent = state === 'unavailable' ? 'Retry' : 'Refresh';
            }
            function paint(snapshot) {
                if (!snapshot.available) { say(snapshot.message || 'Current status is unavailable.', 'unavailable'); return; }
                var rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
                if (!rows.length) { say(snapshot.message || definition.empty || 'Nothing to show yet.', 'empty'); return; }
                items.replaceChildren.apply(items, rows.map(function (row) { return item(definition, row); }));
                items.hidden = false; message.hidden = true; root.dataset.hfxAdminStatusState = 'fresh'; button.textContent = 'Refresh';
                freshness.textContent = 'Updated ' + new Date().toLocaleTimeString();
            }
            function stopPending() { clearTimeout(timer); controller?.abort(); controller = null; pending = null; }
            function refresh() {
                clearTimeout(timer);
                // A list removed from the document stops for good; a hidden one waits for its page to show again.
                if (!disposed && !root.isConnected) dispose();
                if (disposed || !visible()) return Promise.resolve();
                if (pending) return pending;
                var current = controller = new AbortController(), signal = current.signal;
                var deadline = setTimeout(function () { current.abort(); }, 10000);
                button.disabled = true; root.setAttribute('aria-busy', 'true');
                pending = request(root.dataset.hfxAdminStatusList, null, signal).then(function (snapshot) {
                    if (!signal.aborted && root.isConnected) paint(snapshot);
                }).catch(function (error) {
                    if (controller !== current || disposed || !root.isConnected || !visible()) return;
                    // A last-known record must not masquerade as a current observation.
                    say(error.status === 401 ? 'Your sign-in session expired. Sign in again, then retry.'
                        : error.status === 403 ? 'Your account cannot view this status. Ask an administrator for access.'
                        : 'Current status could not be refreshed. Check your connection and the service, then retry.', 'unavailable');
                }).finally(function () {
                    clearTimeout(deadline);
                    if (controller !== current) return;
                    controller = null; pending = null; button.disabled = false; root.setAttribute('aria-busy', 'false');
                    if (!disposed && visible()) timer = setTimeout(refresh, interval);
                });
                return pending;
            }
            function dispose() {
                disposed = true; stopPending(); delete root._hfxStatus;
                unwatch(); button.removeEventListener('click', refresh);
            }
            var unwatch = api.observeVisibility(root, function (shown) {
                if (!root.isConnected) dispose();
                else if (shown) refresh(); else stopPending();
            });
            button.addEventListener('click', refresh); root._hfxStatus = { refresh: refresh, dispose: dispose };
            return refresh();
        }));
    };
})();
