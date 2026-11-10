/* Generic selected-record/Flow transport. Hosts own identity, permission, evidence versions and effects. */
(function () {
    'use strict';
    var api = window.HfxServiceAdmin = window.HfxServiceAdmin || {};
    api.recordOptions = function (wrapper, request, refresh) {
        var route = wrapper.getAttribute('data-hfx-admin-record-route');
        if (!route) return {};
        var actions = JSON.parse(wrapper.getAttribute('data-hfx-admin-record-actions') || '[]'), active;
        function recordRoute(id) { return route.replace('{id}', encodeURIComponent(id)); }
        async function open(action, context) {
            if (active) return;
            var endpoint = recordRoute(context.record.id) + '/flow/' + encodeURIComponent(action.Id || action.id);
            var definition = await request(endpoint, null, context.signal);
            if (context.signal.aborted || !wrapper.isConnected || active) return;
            var host = document.createElement('div'); host.className = 'hfx-cx hfx-canopyx-flow';
            wrapper.appendChild(host);
            var flow, disposed = false, reopen = false;
            function dispose() {
                if (disposed) return; disposed = true;
                context.signal.removeEventListener('abort', dispose);
                flow?.destroy(); host.remove(); active = null;
                if (reopen && !context.signal.aborted && wrapper.isConnected) context.api.openRecord(context.record.id, {reload:true}).catch(function (error) {
                    window.HfxCanopyX.showFailure(wrapper, error, refresh);
                });
            }
            active = { dispose: dispose };
            context.signal.addEventListener('abort', dispose, {once:true});
            try {
                flow = window.CanopyX.createFlow(host, {flow:definition.flow, timeout:15000,
                    hooks:{submit:async function (detail) {
                        try {
                            var result = await request(endpoint, {baseline:definition.revision, values:detail.values}, detail.signal);
                            return {status:'saved',message:result.message || 'Saved. Reload the record for its current state.'};
                        } catch (error) {
                            return {status:error.status === 409 ? 'conflict' : 'error',message:error.message};
                        }
                    }}, onSubmitted:function () { reopen = true; refresh().catch(function () {}); }});
                await flow.ready;
                if (disposed) return;
                document.querySelector('dialog[data-cx-view="' + CSS.escape(context.view) + '"]')?.close();
                var launch = host.querySelector('.cx-flow-launch'); if (launch) launch.hidden = true;
                host.querySelector('dialog')?.addEventListener('close', function () { queueMicrotask(dispose); }, {once:true});
                flow.open();
            } catch (error) {
                dispose();
                window.HfxCanopyX.showFailure(wrapper, error, refresh);
                throw new Error('Unable to open the record action. Refresh the table and try again.');
            }
        }
        return {
            loadRecord:function (query, options) { return request(recordRoute(query.id), null, options.signal); },
            recordActions:actions.map(function (action) {
                var id = action.Id || action.id;
                return {label:action.Label || action.label,
                    visible:function (context) { return context.payload?.fields?.['action-' + id] === true; },
                    prominent:function (context) { return context.payload?.fields?.primaryAction === id; },
                    run:function (context) { return open(action, context); }};
            })
        };
    };
})();
