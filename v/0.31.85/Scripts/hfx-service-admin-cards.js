/* Collection cards: draws a configured collection from the unsaved draft and reuses the collection Flow for Edit and Remove. */
(function () {
    'use strict';
    var api = window.HfxServiceAdmin = window.HfxServiceAdmin || {};
    function el(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
    function member(item, key) {
        if (!item || typeof item !== 'object') return undefined;
        if (Object.prototype.hasOwnProperty.call(item, key)) return item[key];
        var match = Object.keys(item).find(function (name) { return name.toLowerCase() === key.toLowerCase(); });
        return match === undefined ? undefined : item[match];
    }
    // A path may wrap only after a separator, so a long UNC path never splits inside a folder name (not even at its hyphens):
    // each segment, with its trailing separator, is kept whole unless it alone is wider than the card.
    function path(className, text) {
        var node = el('span', className);
        String(text).split(/(?<=[\\/])/).forEach(function (part, index) { if (index) node.append(document.createElement('wbr')); node.append(el('span', 'hfx-admin-card__segment', part)); });
        return node;
    }
    function plain(value) { return value && typeof value === 'object' ? (value.text ?? value.value) : value; }
    /**
     * Binds one cards element. host supplies items(), canWrite(), edit(index), remove(index), request(route, payload, signal)
     * and duration(value). Returns the refresh function the collection binding calls after every draft change.
     */
    api.bindCards = function (root, host) {
        if (root._hfxCards) return root._hfxCards;
        var definition = JSON.parse(root.dataset.hfxAdminCardsDefinition || '{}');
        var list = root.querySelector('[data-hfx-admin-cards-items]'), empty = root.querySelector('[data-hfx-admin-cards-empty]');
        var live = new Map(), timer = null, polling = null, controller = null, liveFailed = false;
        function format(value, fact) {
            if (value == null || value === '') return '';
            if (fact.format === 'duration') return host.duration(value);
            return Array.isArray(value) ? value.join(', ') : String(value);
        }
        function tone(cells) {
            var status = cells && cells[definition.live.status];
            var text = plain(status) == null ? '' : String(plain(status));
            var tones = definition.live.tones || {};
            return (status && status.tone) || tones[text] || Object.keys(tones).filter(function (key) { return key.toLowerCase() === text.toLowerCase(); }).map(function (key) { return tones[key]; })[0] || 'neutral';
        }
        function card(item, index) {
            var li = el('li', 'hfx-admin-card'), head = el('div', 'hfx-admin-card__head'), title = el('strong', 'hfx-admin-card__title', format(member(item, definition.title), {}) || 'Unnamed');
            li.dataset.hfxAdminCardIndex = String(index);
            head.append(title);
            var cells = definition.live ? live.get(String(plain(member(item, definition.title)) ?? '').toLowerCase()) : null;
            if (definition.live) {
                var chip = el('span', 'hfx-admin-status-chip', cells ? String(plain(cells[definition.live.status]) ?? 'Unknown') : liveFailed ? 'Status unavailable' : 'No observation yet');
                chip.dataset.tone = cells ? tone(cells) : liveFailed ? 'warning' : 'neutral'; li.dataset.tone = chip.dataset.tone; head.append(chip);
            }
            li.append(head);
            if (definition.variant === 'route' && definition.route) {
                var route = el('div', 'hfx-admin-card__route');
                [['from', definition.route.from, definition.route.fromLabel], ['to', definition.route.to, definition.route.toLabel]].forEach(function (end, position) {
                    if (position === 1) { var arrow = el('span', 'hfx-admin-card__arrow', '→'); arrow.setAttribute('aria-hidden', 'true'); route.append(arrow); }
                    var box = el('div', 'hfx-admin-card__end hfx-admin-card__end--' + end[0]);
                    var where = format(member(item, end[1]), {});
                    box.append(el('small', null, end[2]), where ? path('hfx-admin-card__path', where) : el('span', 'hfx-admin-card__path', 'Not set'));
                    route.append(box);
                });
                li.append(route);
            }
            var facts = el('dl', 'hfx-admin-card__facts');
            (definition.facts || []).forEach(function (fact) {
                var value = format(member(item, fact.key), fact); if (!value) return;
                var group = el('div'); group.dataset.hfxAdminCardFact = fact.key;
                var dd = el('dd', fact.format === 'path' ? 'hfx-admin-card__path' : null);
                if (fact.format === 'path') dd.append(path(null, value)); else dd.textContent = value;
                group.append(el('dt', null, fact.label), dd); facts.append(group);
            });
            if (cells && definition.live.activity && plain(cells[definition.live.activity])) {
                var group = el('div'), date = new Date(plain(cells[definition.live.activity]));
                group.dataset.hfxAdminCardFact = 'activity';
                group.append(el('dt', null, 'Last activity'), el('dd', null, Number.isNaN(date.getTime()) ? String(plain(cells[definition.live.activity])) : date.toLocaleString()));
                facts.append(group);
            }
            if (facts.childElementCount) li.append(facts);
            if (cells && definition.live.detail && plain(cells[definition.live.detail])) li.append(el('p', 'hfx-admin-card__detail', String(plain(cells[definition.live.detail]))));
            if (host.canWrite()) {
                var actions = el('div', 'hfx-admin-card__actions'), name = title.textContent;
                var edit = el('button', 'btn btn-sm btn-secondary', 'Edit'), remove = el('button', 'btn btn-sm btn-link hfx-admin-card__remove', 'Remove');
                edit.type = remove.type = 'button';
                edit.setAttribute('aria-label', 'Edit ' + name); remove.setAttribute('aria-label', 'Remove ' + name);
                edit.dataset.hfxAdminCardEdit = String(index); remove.dataset.hfxAdminCardRemove = String(index);
                actions.append(edit, remove); li.append(actions);
            }
            return li;
        }
        function refresh() {
            var items = host.items() || [];
            // Keep the reader's place: a redraw restores focus to the same action on the same card.
            var active = root.contains(document.activeElement) ? document.activeElement : null;
            var focus = active && (active.dataset.hfxAdminCardEdit !== undefined ? '[data-hfx-admin-card-edit="' + active.dataset.hfxAdminCardEdit + '"]' : active.dataset.hfxAdminCardRemove !== undefined ? '[data-hfx-admin-card-remove="' + active.dataset.hfxAdminCardRemove + '"]' : null);
            list.replaceChildren.apply(list, items.map(card));
            list.hidden = !items.length; empty.hidden = !!items.length;
            if (focus) root.querySelector(focus)?.focus({ preventScroll: true });
        }
        root.addEventListener('click', function (event) {
            var edit = event.target.closest('[data-hfx-admin-card-edit]'), remove = event.target.closest('[data-hfx-admin-card-remove]');
            var run = edit ? host.edit(Number(edit.dataset.hfxAdminCardEdit)) : remove ? host.remove(Number(remove.dataset.hfxAdminCardRemove)) : null;
            if (run && run.catch) run.catch(host.error);
        });
        function visible() { return !document.hidden && root.isConnected && !!root.getClientRects().length; }
        function stopPending() { clearTimeout(timer); controller?.abort(); controller = null; polling = null; }
        // One request at a time; a hidden or detached list stops polling and resumes when its page is shown again.
        function poll() {
            clearTimeout(timer);
            if (!definition.live || !root.isConnected || !visible()) return Promise.resolve();
            if (polling) return polling;
            var current = controller = new AbortController();
            var deadline = setTimeout(function () { current.abort(); }, 10000);
            polling = (async function () {
                try {
                    var snapshot = await host.request(definition.live.route, null, current.signal);
                    if (current.signal.aborted || controller !== current || !root.isConnected) return;
                    liveFailed = !snapshot.available;
                    live = new Map((snapshot.available && Array.isArray(snapshot.rows) ? snapshot.rows : []).map(function (row) {
                        return [String(plain(row.cells && row.cells[definition.live.match]) ?? '').toLowerCase(), row.cells || {}];
                    }));
                } catch (error) {
                    if (controller !== current || !root.isConnected) return;
                    live = new Map(); liveFailed = true;
                }
                refresh();
            })().finally(function () {
                clearTimeout(deadline);
                if (controller !== current) return;
                controller = null; polling = null;
                if (root.isConnected && visible()) timer = setTimeout(poll, (definition.live.refresh || 30) * 1000);
            });
            return polling;
        }
        if (definition.live) {
            api.observeVisibility(root, function (shown) { if (shown) poll(); else stopPending(); });
            poll();
        }
        root._hfxCards = refresh;
        return refresh;
    };
})();
