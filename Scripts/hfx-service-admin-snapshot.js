/* Presentation adapter only. CanopyX owns polling, cancellation, live rows, queries and record lifetimes. */
(function () {
    'use strict';
    var api = window.HfxServiceAdmin = window.HfxServiceAdmin || {};
    api.bindSnapshot = async function (wrapper, request) {
        var root = wrapper.closest('[data-hfx-admin-snapshot]');
        if (!root || root.dataset.hfxSnapshotBound) return;
        root.dataset.hfxSnapshotBound = 'true';
        var get = function (name) { return root.querySelector('[data-hfx-snapshot-' + name + ']'); };
        var host = wrapper.querySelector('.cx-host'), status = wrapper.querySelector('[data-hfx-admin-read-status]');
        var refresh = get('refresh'), notice = get('notice'), freshness = get('freshness'), data = get('data');
        var snapshot, pending, poller, stage = '', state = 'loading';
        host.hidden = true;
        var text = function (element, value) { element.textContent = value || ''; };
        function message(element, title, body) {
            element.replaceChildren();
            var heading = document.createElement('strong'), copy = document.createElement('span');
            text(heading, title); text(copy, body); element.append(heading, copy);
        }
        function setState(next, announcement) {
            root.setAttribute('data-hfx-snapshot-state', next);
            if (next !== state && ['stale', 'unavailable', 'fresh', 'forbidden'].includes(next))
                text(get('live'), next === 'fresh' ? 'Current data is available.' : announcement);
            state = next;
        }
        function finish() { refresh.disabled = false; text(refresh, 'Refresh'); root.setAttribute('aria-busy', 'false'); }
        function summary(value) {
            var count = (value.stages || []).find(function (item) { return item.name === 'Needs attention'; })?.count || 0;
            document.querySelectorAll('[data-hfx-snapshot-summary="' + CSS.escape(root.dataset.hfxAdminSnapshot) + '"]').forEach(function (item) {
                item.hidden = !value.available;
                text(item.querySelector('[data-hfx-snapshot-summary-text]'), item.querySelector('[data-hfx-snapshot-stage]') ? value.scope || ''
                    : (value.stages || []).map(function (part) { return part.name + ': ' + part.count; }).join(' · ') + (value.scope ? ' · ' + value.scope : ''));
                item.querySelectorAll('[data-hfx-snapshot-stage]').forEach(function (stage) {
                    var part=(value.stages||[]).find(function (entry) { return entry.name===stage.dataset.hfxSnapshotFilter; });
                    text(stage.querySelector('[data-hfx-snapshot-value]'), part ? String(part.count) : '—');
                    stage.dataset.hfxSnapshotCount=part ? String(part.count) : ''; stage.setAttribute('aria-disabled',String(!part));
                });
            });
            window.HfxOperationalList?.setNavBadge(document, root.dataset.hfxAdminSnapshot, value.available && count > 0 ? String(count) : '');
        }
        function closeRecord() {
            document.querySelector('dialog[data-cx-view="' + CSS.escape(wrapper.getAttribute('data-hfx-canopyx')) + '"][open]')?.close();
        }
        function unavailable(value) {
            closeRecord(); snapshot = null; data.hidden = true; host.hidden = true; get('empty').hidden = true; get('restart').hidden = true;
            text(status, value.message || 'Current data is unavailable.');
            text(freshness, 'Unavailable'); notice.hidden = false; message(notice, 'Activity is unavailable.', status.textContent);
            summary(value); setState('unavailable', status.textContent); finish();
        }
        function failure(error) {
            console.error('HtmlForgeX: operational snapshot refresh failed.', error);
            pending = null;
            if (error.status === 403) {
                closeRecord(); snapshot = null; data.hidden = true; host.hidden = true; get('empty').hidden = true; get('restart').hidden = true; status.hidden = true;
                notice.hidden = false; message(notice, 'Access required.', root.dataset.hfxSnapshotForbidden || 'Your account cannot view these records. Ask an administrator for access.');
                text(freshness, 'Access required'); refresh.hidden = true; summary({ available: false }); setState('forbidden', notice.textContent); poller?.stop();
            } else {
                if (!snapshot) data.hidden = true;
                notice.hidden = false;
                message(notice, snapshot ? 'Showing earlier data.' : 'Unable to load current data.',
                    (snapshot ? 'Showing data from ' + new Date(snapshot.capturedUtc).toLocaleTimeString() + '. ' : '') + 'The last refresh failed. Use Refresh to try again.');
                text(freshness, snapshot ? 'Stale · refresh needed' : 'Unable to load current data');
                setState(snapshot ? 'stale' : 'unavailable', notice.textContent);
            }
            finish();
        }
        function paint(value) {
            snapshot = value; data.hidden = false; host.hidden = false; notice.hidden = true; status.hidden = false;
            get('empty').hidden = !!value.rows?.length;
            text(status, ''); status.hidden = true; text(get('scope'), value.scope || value.message);
            text(freshness, 'Updated ' + new Date(value.capturedUtc).toLocaleTimeString() + ' · every 15 s');
            root.querySelectorAll('[data-hfx-snapshot-stage]').forEach(function (button) {
                var item = (value.stages || []).find(function (part) { return part.name === button.dataset.hfxSnapshotFilter; });
                text(button.querySelector('[data-hfx-snapshot-value]'), item ? String(item.count) : '—');
                button.dataset.hfxSnapshotCount = item ? String(item.count) : ''; button.disabled = !item;
            });
            text(get('unknown'), value.unknownCount > 0 ? '+' + value.unknownCount + ' unknown' : '');
            var workers = get('workers'); workers.replaceChildren();
            (value.workers || []).forEach(function (worker) {
                var chip = document.createElement('span'); chip.setAttribute('data-hfx-snapshot-worker', ''); chip.dataset.status = String(worker.status).toLowerCase();
                text(chip, worker.name + ' · ' + worker.status + (worker.detail ? ': ' + worker.detail : '')); workers.append(chip);
            });
            message(get('restart'), "Saved settings aren't running yet.", value.restartMessage || 'The worker continues using its startup configuration. Restart the service to apply saved changes.');
            get('restart').hidden = !value.restartRequired;
            summary(value); setState('fresh'); finish();
        }
        window.CanopyX.configure(wrapper.getAttribute('data-hfx-canopyx'), Object.assign({
            live: { stableOrder: true, announce: false }, requestTimeoutMs: 10000,
            onQuery: function (event) {
                var selected = (event.query.filters || []).find(function (item) { return item.column === 'stage' && item.operator === 'eq'; });
                stage = selected?.values?.[0] || '';
                root.querySelectorAll('[data-hfx-snapshot-stage]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.hfxSnapshotFilter === stage)); });
            },
            onError: function (event) { failure(event.error); },
            recordHeading: function (record) {
                var started = record.cells?.started, completed = record.cells?.completed;
                return { title: String(record.cells?.file || record.id), subtitle: started ? 'Started ' + new Date(started).toLocaleString() + (completed ? ' · Completed ' + new Date(completed).toLocaleString() : '') : '' };
            }
        }, window.HfxServiceAdmin.recordOptions(wrapper, request, function () { return poller.refresh(); })));
        var grids = window.CanopyX.mount(wrapper);
        await Promise.all(grids.map(function (grid) { return grid.ready; }));
        if (grids.length !== 1) throw new Error('A snapshot requires one native grid.');
        var grid = grids[0];
        root.querySelectorAll('[data-hfx-snapshot-stage]').forEach(function (button) {
            button.addEventListener('click', function () {
                var selected = stage === button.dataset.hfxSnapshotFilter ? '' : button.dataset.hfxSnapshotFilter, query = grid.getQuery();
                grid.setQuery(Object.assign({}, query, { offset: 0, filters: (query.filters || []).filter(function (item) { return item.column !== 'stage'; }).concat(selected ? [{ column: 'stage', operator: 'eq', values: [selected] }] : []) })).catch(failure);
            });
        });
        poller = await grid.poll({ intervalMs: 15000, pauseWhenHidden: true,
            onRefresh: function () { if (pending) { var value = pending; pending = null; paint(value); } }, load: async function (context) {
            pending = null; refresh.disabled = true; text(refresh, 'Refreshing…'); root.setAttribute('aria-busy', 'true');
            root.setAttribute('data-hfx-snapshot-state', snapshot ? 'refreshing' : 'loading');
            try {
                var value = await request(wrapper.dataset.hfxAdminReadGrid, null, context.signal);
                if (context.signal.aborted || !root.isConnected) return null;
                if (!value.available) { unavailable(value); return null; }
                pending = value; return value.rows || [];
            } catch (error) { if (!context.signal.aborted) failure(error); return null; }
        } });
        refresh.addEventListener('click', function () { poller.refresh().catch(failure); });
        await poller.refresh();
    };
})();
