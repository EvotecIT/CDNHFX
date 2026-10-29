/* Shared component behavior only. Hosts own authentication, CSRF, validation, writes and activation. */
(function () {
    'use strict';
    var lastFocus, modalSiblings = [], activeReview = null;
    document.addEventListener('hfx:operational-workspace-page-change', function (event) {
        if (!(event.target instanceof Element) || !event.target.classList.contains('hfx-service-admin')) return;
        var main = event.target.querySelector('.hfx-service-config-studio__main');
        if (main) main.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: 'instant' });
    });
    function redirectLocal(url) {
        if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || new URL(url,location.href).origin !== location.origin) throw new Error('The response has an invalid destination.');
        location.assign(url);
    }
    function close(root) {
        if (root.hasAttribute('data-hfx-admin-saving')) return;
        root.hidden = true;
        if (activeReview !== root) return;
        activeReview = null;
        modalSiblings.forEach(function (item) { item.node.inert = item.inert; }); modalSiblings = [];
        if (lastFocus && lastFocus.isConnected) lastFocus.focus();
    }
    document.addEventListener('click', function (event) {
        var closeButton = event.target.closest('[data-hfx-admin-close]');
        if (closeButton) { var drawer = closeButton.closest('[data-hfx-admin-review-root]'); if (drawer) close(drawer); }
        var review = event.target.closest('[data-hfx-admin-review]');
        if (review) document.dispatchEvent(new CustomEvent('hfx:adminReview', { detail: { trigger: review } }));
        var discard = event.target.closest('[data-hfx-admin-discard]');
        if (discard) document.dispatchEvent(new CustomEvent('hfx:adminDiscard', { detail: { trigger: discard } }));
        var apply = event.target.closest('[data-hfx-admin-apply]');
        if (apply) document.dispatchEvent(new CustomEvent('hfx:adminApply', { detail: { trigger: apply } }));
    });
    document.addEventListener('keydown', function (event) {
        var root = document.querySelector('[data-hfx-admin-review-root]:not([hidden])'); if (!root) return;
        if (event.key === 'Escape') close(root);
        if (event.key !== 'Tab') return;
        var items = Array.from(root.querySelectorAll('button,input,textarea,select,[tabindex="0"]')).filter(function (item) { return !item.disabled && item.getClientRects().length; });
        var first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector('[role=dialog]'))) { event.preventDefault(); if (last) last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); if (first) first.focus(); }
    });
    window.HfxServiceAdmin = Object.freeze({
        bindSnapshot: window.HfxServiceAdmin?.bindSnapshot,
        recordOptions: window.HfxServiceAdmin?.recordOptions,
        openReview: function (id) {
            var root = document.querySelector('[data-hfx-admin-review-root="' + CSS.escape(id) + '"]'); if (!root) return;
            if (activeReview === root) return;
            if (activeReview) { close(activeReview); if (activeReview) return; }
            activeReview = root; lastFocus = document.activeElement;
            modalSiblings = Array.from(root.parentElement.children).filter(function (node) { return node !== root && !['SCRIPT','STYLE'].includes(node.tagName); }).map(function (node) { var item = {node:node,inert:node.inert}; node.inert = true; return item; });
            root.hidden = false; root.querySelector('[role=dialog]').focus();
        }
    });

    var durationUnits={Seconds:1,Minutes:60,Hours:3600,Days:86400};
    var sizeUnits={bytes:1,KB:1024,MB:1048576,GB:1073741824};
    function timeSpanSeconds(value) {
        if (typeof value!=='string') return null;
        if (/^\d+$/.test(value)) return Number(value)*86400;
        var match=/^(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/.exec(value);
        return match?Number(match[1]||0)*86400+Number(match[2])*3600+Number(match[3])*60+Number(match[4]||0)+Number('0.'+(match[5]||0)):null;
    }
    function isoDurationSeconds(value) {
        if (value===null) return null;
        var match=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,7})?)S)?)?$/.exec(value||'');
        if (!match) throw new Error('Enter a valid non-negative duration.');
        return Number(match[1]||0)*86400+Number(match[2]||0)*3600+Number(match[3]||0)*60+Number(match[4]||0);
    }
    function durationDisplay(value) {var seconds=timeSpanSeconds(value);if(seconds===null)return JSON.stringify(value);var unit=seconds!==0&&seconds%86400===0?'Days':seconds!==0&&seconds%3600===0?'Hours':seconds!==0&&seconds%60===0?'Minutes':'Seconds', amount=seconds/durationUnits[unit];return amount+' '+(amount===1?unit.slice(0,-1):unit).toLowerCase();}
    function displaySetting(value,field) {
        if(value===null||value===undefined)return 'Not set';
        if(field?.type==='duration')return durationDisplay(value);
        if(field?.unit==='bytes' && typeof value==='number'){var unit=Object.keys(sizeUnits).reverse().find(function(key){return value!==0 && value%sizeUnits[key]===0;})||'bytes';return value/sizeUnits[unit]+' '+unit;}
        if(typeof value==='boolean')return value?'On':'Off';
        if(typeof value==='string')return value||'Empty';
        return JSON.stringify(value);
    }
    function timeSpanText(seconds) {
        if (seconds===null) return null;
        if (!Number.isFinite(seconds)||seconds<0||seconds>922337203685) throw new Error('Enter a valid non-negative duration.');
        var whole=Math.floor(seconds), fraction=Math.round((seconds-whole)*1e7);
        if(fraction===1e7){whole++;fraction=0;}
        var days=Math.floor(whole/86400), hours=Math.floor(whole%86400/3600), minutes=Math.floor(whole%3600/60), second=whole%60;
        return (days?days+'.':'')+String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(second).padStart(2,'0')+(fraction?'.'+String(fraction).padStart(7,'0').replace(/0+$/,''):'');
    }
    function adminRequest(base, csrf) {
        return async function (route, payload, signal) {
            var response = await fetch(base + '/' + route, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json', 'X-Admin-CSRF': csrf() } : {}, body: payload ? JSON.stringify(payload) : undefined, signal:signal });
            var result = await response.json().catch(function () { return {}; });
            if (!response.ok) { var failure = new Error(result.error || result.message || result.detail || (response.status === 401 ? 'Your sign-in session has expired. Reload to sign in again, then retry.' : 'The request failed. Reload the document and check your session, account scope and input.')); failure.status = response.status; throw failure; }
            return result;
        };
    }
    async function readGrids(studio, request) {
        for (var wrapper of studio.querySelectorAll('[data-hfx-admin-read-grid]')) {
            if (wrapper.hasAttribute('data-hfx-admin-snapshot-grid')) {
                await window.HfxServiceAdmin.bindSnapshot(wrapper, request);
                continue;
            }
            await readGrid(wrapper, request);
        }
    }
    async function readGrid(wrapper, request) {
        (wrapper._hfxAdminReadPollers || []).forEach(function (poller) { poller.stop(); });
        wrapper._hfxAdminReadPollers = [];
        var status=wrapper.querySelector('[data-hfx-admin-read-status]'), host=wrapper.querySelector('.cx-host');
        host.hidden=true;
        status.hidden=false;
        status.textContent='Loading the current snapshot…';
        try {
                window.HfxCanopyX.prepareFrames(wrapper.parentElement);
                var snapshot=await request(wrapper.getAttribute('data-hfx-admin-read-grid'));
                status.textContent=snapshot.message||'';
                if (!snapshot.available) return;
                host.hidden=false;
                var mounted;
                var reload = function (element, line) { return async function () {
                    var current = await request(element.getAttribute('data-hfx-admin-read-grid'));
                    line.textContent = current.message || ''; line.hidden = false;
                    await Promise.all(Array.from(element.querySelectorAll('.cx-host')).map(function (item) {
                        item.hidden = !current.available;
                        return current.available ? item.canopyx?.setRows(current.rows) : undefined;
                    }));
                }; }(wrapper, status);
                window.CanopyX.configure(wrapper.getAttribute('data-hfx-canopyx'), window.HfxServiceAdmin.recordOptions(wrapper, request, reload));
                mounted=window.CanopyX.mount(wrapper); await Promise.all(mounted.map(function(grid){return grid.ready;}));
                await Promise.all(mounted.map(function(grid){return grid.setRows(snapshot.rows);}));
                var refreshSeconds = Number(wrapper.getAttribute('data-hfx-admin-read-refresh'));
                if (refreshSeconds >= 15 && refreshSeconds <= 3600) {
                    wrapper._hfxAdminReadPollers = await Promise.all(mounted.map(function (grid) {
                        return grid.poll({ intervalMs: refreshSeconds * 1000, pauseWhenHidden: true, load: async function (context) {
                            if (!wrapper.isConnected || !wrapper.getClientRects().length) return null;
                            try {
                                var current = await request(wrapper.getAttribute('data-hfx-admin-read-grid'), null, context.signal);
                                if (context.signal.aborted || !wrapper.isConnected) return null;
                                var alert = wrapper.querySelector('[data-hfx-cx-failure]'); if (alert) alert.hidden = true;
                                status.textContent = current.message || ''; status.hidden = false; host.hidden = !current.available;
                                return current.available ? current.rows || [] : null;
                            } catch (error) {
                                if (context.signal.aborted || !wrapper.isConnected) return null;
                                // A last-known successful row must not masquerade as a current observation.
                                host.hidden = true;
                                window.HfxCanopyX.showFailure(wrapper, error, function () { return readGrid(wrapper, request); });
                                var description = wrapper.querySelector('[data-hfx-cx-failure] .alert-description');
                                if (description) description.textContent = error.status === 401
                                    ? 'Your sign-in session expired. Sign in again, then retry.'
                                    : 'The current snapshot is unavailable. Check your connection and account access, then retry.';
                                return null;
                            }
                        } });
                    }));
                }
        } catch(e) { host.hidden = true; window.HfxCanopyX.showFailure(wrapper, e, function () { return readGrid(wrapper, request); }); }
    }
    async function bindOperations(client) {
        client.setAttribute('aria-busy', 'true');
        var session, studio = document.querySelector('.hfx-service-admin');
        var request = adminRequest(client.getAttribute('data-hfx-admin-client'), function () { return session.csrf; });
        try {
            session = await request('session');
            studio.addEventListener('click', async function (event) {
                var button = event.target.closest('[data-hfx-admin-sign-out]');
                if (!button) return;
                event.preventDefault(); button.disabled = true;
                try { redirectLocal((await request('logout', {})).url); }
                catch (error) { client.textContent = error.message; button.disabled = false; }
            });
            await readGrids(studio, request);
            client.setAttribute('data-hfx-admin-ready', 'true');
        } catch (error) { client.textContent = error.message; }
        finally { client.setAttribute('aria-busy', 'false'); }
    }
    async function bind(client) {
        if (client.getAttribute('data-hfx-admin-mode') === 'operations') return bindOperations(client);
        client.setAttribute('aria-busy','true');
        var base = client.getAttribute('data-hfx-admin-client'), model, draft, secrets = {}, restoreBeforeId = null, busy = false, checks = {}, historyGrids = [], checkBindings = [], collections = [], generation = 0, transition = 0, reviewTicket = 0, reviewPending = false, reviewed = null;
        var studio = document.querySelector('.hfx-service-admin');
        if (!studio) return;
        var rows = Array.from(studio.querySelectorAll('[data-hfx-admin-setting]'));
        var root = document.querySelector('[data-hfx-admin-review-root]');
        var bar = document.querySelector('[data-hfx-admin-unsaved]');
        var body = root.querySelector('.hfx-admin-review__body');
        var error = function (e) { client.textContent = e.message || String(e); };
        var copy = function (value) { return JSON.parse(JSON.stringify(value)); };
        var equals = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
        var own = function(value,key){return Object.prototype.hasOwnProperty.call(value,key);};
        var property = function(value,key){return own(value,key)?key:Object.keys(value).find(function(candidate){return candidate.toLowerCase()===key.toLowerCase();})??key;};
        var escapePointer = function(key){return key.replace(/~/g,'~0').replace(/\//g,'~1');};
        var read = function (value, pointer) { return pointer.split('/').slice(1).reduce(function (o, key) { if(o==null||typeof o!=='object')return undefined;var actual=property(o,key.replace(/~1/g, '/').replace(/~0/g, '~'));return own(o,actual)?o[actual]:undefined; }, value); };
        var assign = function(target,key,value){Object.defineProperty(target,key,{value:value,writable:true,enumerable:true,configurable:true});};
        var write = function (value, pointer, next) { var keys = pointer.split('/').slice(1).map(function (key) { return key.replace(/~1/g, '/').replace(/~0/g, '~'); }); var target = value; keys.slice(0, -1).forEach(function (key) { var actual=property(target,key);if(!own(target,actual)||target[actual]===null||typeof target[actual]!=='object')assign(target,actual,{});target=target[actual]; }); assign(target,property(target,keys[keys.length-1]),next); };
        var proposal = function () { return copy({ revision: model.snapshot.revision, document: draft, secrets: secrets, restoreBeforeId: restoreBeforeId }); };
        function retireReview() {
            reviewTicket++; reviewPending = false; reviewed = null;
            root.querySelector('[data-hfx-admin-apply]').disabled = true;
            if (!busy && !root.hidden) close(root);
        }
        function changed() { generation++; transition++; retireReview(); }
        function draftTransition() {
            var revision = generation, ticket = ++transition;
            return function (signal) { return !busy && revision === generation && ticket === transition && !signal?.aborted; };
        }
        var request = adminRequest(base, function () { return model.csrf; });
        function mark() {
            var changed = model.schema.filter(function (field) { return field.type !== 'section' && !field.path.includes('/[]') && (!equals(read(draft, field.path), read(model.snapshot.document, field.path)) || secrets[field.path]); });
            bar.hidden = !model.canWrite || changed.length === 0;
            bar.querySelector('[data-hfx-admin-change-summary]').textContent = changed.length + (changed.length === 1 ? ' unsaved change · ' : ' unsaved changes · ') + Array.from(new Set(changed.map(function (c) { return c.group; }))).join(', ');
            studio.querySelectorAll('[data-hfx-admin-group]').forEach(function(item){
                var dirty=changed.some(function(field){return field.group===item.getAttribute('data-hfx-admin-group');});
                item.setAttribute('data-hfx-admin-changed',String(dirty));
                if(!item.hasAttribute('data-hfx-admin-nav-label'))item.setAttribute('data-hfx-admin-nav-label',item.getAttribute('aria-label')||item.textContent.trim());
                item.setAttribute('aria-label',item.getAttribute('data-hfx-admin-nav-label')+(dirty?', unsaved changes':''));
            });
            rows.forEach(function (row) {
                var path = row.getAttribute('data-hfx-admin-setting'); var isChanged = !equals(read(draft, path), read(model.snapshot.document, path)) || !!secrets[path];
                row.classList.toggle('is-changed', isChanged);
                var previous = row.querySelector('[data-hfx-admin-previous]'); previous.hidden = !isChanged;
                var field = model.schema.find(function (f) { return f.path === path; });
                previous.textContent = 'Was: ' + (field && field.secret ? 'kept private' : displaySetting(read(model.snapshot.document,path),field));
                var reset=row.querySelector('[data-hfx-admin-reset]'), effective=read(draft,path); if(reset)reset.hidden=!model.canWrite||!field||field.secret||equals(effective===undefined?field?.default:effective,field?.default);
                var defaultChange=row.querySelector('[data-hfx-admin-default-change]'); if(defaultChange)defaultChange.hidden=!reset||reset.hidden;
            });
        }
        function jsonPanel() { return studio.querySelector('[data-hfx-service-config-json]'); }
        function sync() {
            studio.querySelectorAll('[data-hfx-admin-state="configuration"]').forEach(function(element){element.textContent=model.snapshot.restartRequired?'Saved · needs restart':'Loaded';});
            rows.forEach(function (row) {
                var path = row.getAttribute('data-hfx-admin-setting'), field = model.schema.find(function (f) { return f.path === path; }), value = read(draft, path);
                var input = row.querySelector('[data-hfx-service-config-field-input]');
                if (!input || !field) return;
                input.disabled = !model.canWrite;
                if (field.secret) {
                    var secretEditor = row.querySelector('[data-hfx-admin-secret]'), change = secrets[path];
                    secretEditor.querySelector('select').value = change ? change.operation : 'Keep';
                    var replacement = secretEditor.querySelector('input[type=password]');
                    replacement.value = change && change.operation === 'Replace' ? change.value : '';
                    replacement.disabled = !model.canWrite || !change || change.operation !== 'Replace';
                    replacement.closest('[data-hfx-service-config-field]').setAttribute('data-hfx-service-config-field-disabled',String(replacement.disabled));
                }
                else if (field.type === 'duration') {
                    var seconds=timeSpanSeconds(value===undefined?field.default:value), unit=seconds!==null&&seconds!==0&&seconds%86400===0?'Days':seconds!==null&&seconds!==0&&seconds%3600===0?'Hours':seconds!==null&&seconds!==0&&seconds%60===0?'Minutes':'Seconds';
                    row.querySelector('[data-hfx-admin-duration] input').value=seconds===null?'':seconds/durationUnits[unit]; row.querySelector('[data-hfx-admin-duration] select').value=unit;
                }
                else if (row.querySelector('[data-hfx-admin-size]')) {
                    var bytes=value===undefined?field.default:value, sizeUnit=Object.keys(sizeUnits).reverse().find(function(key){return bytes!==0 && bytes%sizeUnits[key]===0;})||'bytes';
                    row.querySelector('[data-hfx-admin-size] input').value=bytes===null?'':bytes/sizeUnits[sizeUnit]; row.querySelector('[data-hfx-admin-size] select').value=sizeUnit;
                }
                else if (input.type === 'checkbox') input.checked = (value === undefined ? field.default : value) === true;
                else input.value = Array.isArray(value) ? value.join('\n') : value === undefined || value === null ? typeof field.default === 'object' ? '' : field.default : value;
            });
            var panel = jsonPanel();
            if (panel) { var code = panel.querySelector('pre code'); if (code) { code.textContent = JSON.stringify(draft, null, 2); if (window.Prism) window.Prism.highlightElement(code); code.querySelectorAll('.token.string').forEach(function(token){if(token.textContent.includes('••••••'))token.classList.add('hfx-admin-masked');}); } }
            mark();
            collections.forEach(function (binding) { binding.refresh(); });
        }
        function confirmation(text, index) {
            var item = root.querySelector('[data-hfx-admin-confirm-template]').content.cloneNode(true);
            item.querySelector('input').id = 'hfx-admin-risk-' + index;
            item.querySelector('span').textContent = text;
            root.querySelector('[data-hfx-admin-confirmations]').append(item);
        }
        async function review() {
            if (busy || reviewPending) return;
            var payload = proposal(), revision = generation, ticket = ++reviewTicket;
            reviewPending = true; reviewed = null;
            var preview;
            try { preview = await request('preview', payload); }
            finally { if (ticket === reviewTicket) reviewPending = false; }
            if (busy || ticket !== reviewTicket || revision !== generation) return;
            reviewed = {payload:payload,generation:revision,ticket:ticket};
            var list = root.querySelector('[data-hfx-admin-diff]'); list.replaceChildren();
            preview.changes.forEach(function (change) {
                var item = root.querySelector('[data-hfx-admin-diff-template]').content.cloneNode(true);
                item.querySelector('[data-hfx-admin-diff-label]').textContent = change.group + ' › ' + change.label;
                item.querySelector('[data-hfx-admin-diff-path]').textContent = change.path;
                var descriptor=model.schema.find(function(field){return field.path.toLowerCase()===change.path.replace(/\/\d+(?=\/|$)/g,'/[]').toLowerCase();});
                item.querySelector('[data-hfx-admin-diff-before]').textContent = displaySetting(change.before,descriptor);
                item.querySelector('[data-hfx-admin-diff-after]').textContent = displaySetting(change.after,descriptor);
                list.append(item);
            });
            root.querySelector('[data-hfx-admin-effect-title]').textContent = preview.restartRequired ? '⚠ Needs a restart' : 'Applies without restart';
            root.querySelector('[data-hfx-admin-effect-body]').textContent = preview.restartRequired ? "Saved now; the service picks it up when it is restarted through Windows service administration." : 'The service can use these settings immediately.';
            var confirms = root.querySelector('[data-hfx-admin-confirmations]'); confirms.replaceChildren();
            Array.from(new Set(preview.changes.map(function (change) { return change.risk; }).filter(Boolean))).forEach(function(risk,index){confirmation("I understand: "+risk,index);});
            Object.keys(checks).forEach(function (key, index) { if (preview.changes.some(function (change) { return !checks[key].group || change.group === checks[key].group; }) && (checks[key].status !== 'pass' || checks[key].stale)) confirmation('The ' + (checks[key].name || key) + ' check failed or is stale. Save anyway?', index + 1000); });
            var progress = root.querySelector('[data-hfx-admin-progress]'); progress.textContent = preview.errors.join(' '); progress.removeAttribute('data-hfx-admin-failed'); root.querySelector('[data-hfx-admin-apply]').textContent='Apply changes';
            var apply = root.querySelector('[data-hfx-admin-apply]');
            var enable = function () { apply.disabled = !reviewed || reviewed.ticket !== reviewTicket || preview.errors.length > 0 || preview.changes.length === 0 || Array.from(confirms.querySelectorAll('input')).some(function (c) { return !c.checked; }); };
            reviewed.enable = enable; confirms.onchange = enable; enable();
            window.HfxServiceAdmin.openReview(root.getAttribute('data-hfx-admin-review-root'));
        }
        function editSetting(event) {
            var row = event.target.closest('[data-hfx-admin-setting]'); if (!row || !model || !model.canWrite || busy) return;
            var path = row.getAttribute('data-hfx-admin-setting'), field = model.schema.find(function (f) { return f.path === path; });
            if (!field || !field.managed) return;
            var before = JSON.stringify([read(draft,path),secrets[path]]);
            var input = row.querySelector('[data-hfx-service-config-field-input]'); if (!input) return;
            if (field.secret) {
                var editor = row.querySelector('[data-hfx-admin-secret]'), operation = editor.querySelector('select').value, replacement = editor.querySelector('input[type=password]');
                replacement.disabled = operation !== 'Replace';
                replacement.closest('[data-hfx-service-config-field]').setAttribute('data-hfx-service-config-field-disabled',String(replacement.disabled));
                if (operation === 'Clear') { replacement.value = ''; secrets[path] = {operation:'Clear'}; }
                else if (operation === 'Replace' && replacement.value.trim()) secrets[path] = {operation:'Replace',value:replacement.value};
                else { if (operation === 'Keep') replacement.value = ''; delete secrets[path]; }
            }
            else if (field.type==='duration') {
                var amount=row.querySelector('[data-hfx-admin-duration] input').value, unit=row.querySelector('[data-hfx-admin-duration] select').value;
                try {write(draft,path,timeSpanText(amount===''?null:Number(amount)*durationUnits[unit]));}catch(e){error(e);return;}
            }
            else if (row.querySelector('[data-hfx-admin-size]')) {
                var size=row.querySelector('[data-hfx-admin-size] input').value, sizeUnit=row.querySelector('[data-hfx-admin-size] select').value, bytes=size===''?null:Number(size)*sizeUnits[sizeUnit];
                if(bytes!==null && (!Number.isSafeInteger(bytes)||bytes<0)){error(new Error('Enter a size that is a non-negative whole number of bytes.'));return;}
                write(draft,path,bytes);
            }
            else write(draft, path, field.type === 'boolean' ? input.checked : field.type === 'number' ? input.value === '' ? null : Number(input.value) : field.type === 'array' ? input.value.split(/\r?\n/).filter(Boolean) : input.value);
            if (before === JSON.stringify([read(draft,path),secrets[path]])) return;
            changed(); invalidateChecks([path]); mark();
        }
        studio.addEventListener('input', editSetting);
        studio.addEventListener('change', editSetting);
        studio.addEventListener('click',function(event){var button=event.target.closest('[data-hfx-admin-reset]');if(!button||!model?.canWrite||busy)return;var path=button.closest('[data-hfx-admin-setting]').getAttribute('data-hfx-admin-setting'),field=model.schema.find(function(item){return item.path===path;});if(!field||field.secret||!field.managed)return;write(draft,path,copy(field.default));changed();invalidateChecks([path]);sync();});
        document.addEventListener('hfx:adminReview', function () { if (model?.canWrite) review().catch(error); });
        document.addEventListener('hfx:adminDiscard', function () { if (busy) return; changed(); draft = copy(model.snapshot.document); secrets = {}; restoreBeforeId = null; sync(); });
        document.addEventListener('hfx:adminApply', async function () {
            if (busy || !model.canWrite || root.hidden || !reviewed || reviewed.generation !== generation || reviewed.ticket !== reviewTicket || root.querySelector('[data-hfx-admin-apply]').disabled) return;
            var saving = copy(reviewed.payload); transition++; busy = true; root.setAttribute('data-hfx-admin-saving','');
            var apply = root.querySelector('[data-hfx-admin-apply]'), progress = root.querySelector('[data-hfx-admin-progress]'); apply.disabled = true;
            progress.textContent = 'Validating · backing up · saving atomically · verifying…';
            try {
                var payload = saving; payload.confirmRisks = Array.from(root.querySelectorAll('[data-hfx-admin-confirmations] input')).every(function (input) { return input.checked; });
                payload.note = root.querySelector('input[name$="-note"]')?.value || '';
                var result = await request('apply', payload);
                if (result.state === 'Applied' || result.state === 'Unchanged' || result.state === 'SavedNotActive') {
                    model = await request('settings'); draft = copy(model.snapshot.document); secrets = {}; restoreBeforeId = null;
                    root.removeAttribute('data-hfx-admin-saving'); close(root); changed(); sync(); await refreshHistory(); client.textContent = 'Saved · backup ' + (result.backup || 'not needed') + (result.restartRequired ? ' · Needs restart' : '') + (result.warning ? ' · ' + result.warning : '') + (result.error ? ' · ' + result.error : '');
                } else { progress.setAttribute('data-hfx-admin-failed',''); progress.textContent = result.state === 'RolledBack' ? 'Save failed — configuration restored. The previous file was restored and verified. Nothing changed.' : result.error || result.state; apply.textContent='Try again'; }
            } catch (e) { progress.setAttribute('data-hfx-admin-failed',''); progress.textContent = e.message; apply.textContent='Try again'; }
            finally { busy = false; root.removeAttribute('data-hfx-admin-saving'); if (reviewed) reviewed.enable(); else apply.disabled = true; }
        });
        studio.addEventListener('click', async function (event) {
            var target = event.target.closest('button'); if (!target || !model) return;
            try {
                var panel = jsonPanel();
                if (target.hasAttribute('data-hfx-admin-sign-out')) {
                    if(busy||!bar.hidden&&!window.confirm('Discard unsaved changes and sign out?'))return;
                    var signedOut=await request('logout',{}); redirectLocal(signedOut.url); return;
                }
                if (target.hasAttribute('data-hfx-admin-json-copy')) await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
                if (target.hasAttribute('data-hfx-admin-json-download')) location.assign(base + '/download');
                if (target.hasAttribute('data-hfx-admin-json-edit')) { var editor = panel.querySelector('[data-hfx-admin-json-editor]'); editor.value = JSON.stringify(draft, null, 2); editor.hidden = false; editor.focus(); }
                if (target.hasAttribute('data-hfx-admin-json-validate')) {
                    if (busy || !model.canWrite) return;
                    var editor = panel.querySelector('[data-hfx-admin-json-editor]'), text = editor.value, current = draftTransition();
                    var preview = await request('preview-json', {revision:model.snapshot.revision,json:text,secrets:secrets,restoreBeforeId:restoreBeforeId});
                    if (!current() || editor.value !== text) return;
                    if (preview.errors.length) throw new Error(preview.errors.join(' '));
                    changed(); draft = JSON.parse(text); invalidateChecks(); sync(); await review();
                }
                if (target.hasAttribute('data-hfx-admin-json-schema')) { var schema = panel.querySelector('[data-hfx-admin-json-schema-view]'); schema.hidden = !schema.hidden; var code = schema.querySelector('code'); code.textContent = JSON.stringify(model.schema, null, 2); if (window.Prism) window.Prism.highlightElement(code); code.querySelectorAll('.token.string').forEach(function(token){if(token.textContent.includes('••••••'))token.classList.add('hfx-admin-masked');}); }
            } catch (e) { error(e); }
        });
        function intersects(changed, watched) {
            if (!changed || !watched.length) return true;
            return changed.some(function (a) { return watched.some(function (b) {
                a=a.toLowerCase();b=b.toLowerCase();return a===b||a.startsWith(b+'/')||b.startsWith(a+'/');
            }); });
        }
        function invalidateChecks(changedPaths) {
            Object.keys(checks).forEach(function (key) { if (intersects(changedPaths,checks[key].paths)) checks[key].stale = true; });
            checkBindings.forEach(function (binding) { if (intersects(changedPaths,binding.paths)) {binding.generation++;binding.api.invalidateChecks();} });
            updateCheckSummary();
        }
        function updateCheckSummary() {
            studio.querySelectorAll('[data-hfx-admin-health]').forEach(function(element){
                var id=element.getAttribute('data-hfx-admin-health'), result=Object.keys(checks).filter(function(key){return key.endsWith(':'+id);}).map(function(key){return checks[key];}).at(-1);
                element.textContent=result?(result.stale?'Stale':result.status):'Not run'; element.setAttribute('data-status',result?.status||'neutral'); element.title=result?.message||'No check has run in this session.';
            });
        }
        studio.addEventListener('click',async function(event){
            var button=event.target.closest('[data-hfx-admin-test-all],[data-hfx-admin-test]');if(!button||!model?.canWrite||button.disabled||busy)return; var selectedCheck=button.getAttribute('data-hfx-admin-test');
            button.disabled=true;
            try{for(var binding of checkBindings)for(var step of binding.api.flow.steps)for(var check of step.checks||[])if(!selectedCheck||check.id===selectedCheck)await binding.api.runCheck(check.id);}
            catch(e){error(e);}finally{button.disabled=false;}
        });
        function historyRows(entries) {
            return entries.map(function (entry) { return {id:entry.id,cells:{when:entry.when,actor:entry.actor,sections:Array.from(new Set(entry.changes.map(function (c) {return c.group;}))).join(', '),note:entry.note||'',restart:entry.restartRequired?'Yes':'No',result:entry.result},fields:{diff:entry.changes.map(function (c) {return c.group+' › '+c.label+': '+JSON.stringify(c.before)+' → '+JSON.stringify(c.after);}).join('\n'),retention:'Keep the latest '+(entry.retentionCount||30)+' versions. Older backups are pruned after a successful save; cleanup warnings appear with the save result.'}}; });
        }
        async function refreshHistory() {
            if (!historyGrids.length) return;
            var entries=await request('history'), rows = historyRows(entries);
            studio.querySelectorAll('[data-hfx-admin-state="last-change"]').forEach(function(element){element.textContent=entries.length?new Date(entries[0].when).toLocaleString()+' · '+entries[0].actor:'No retained changes';});
            await Promise.all(historyGrids.map(function (binding) {var grid=binding.api;return grid.setRows(rows.slice(0,binding.limit).map(function(row){var cells={};grid.view.columns.forEach(function(column){cells[column.id]=row.cells[column.id];});return{id:row.id,cells:cells,fields:grid.view.record?row.fields:undefined};}));}));
        }
        async function bindHistory() {
            for (var wrapper of studio.querySelectorAll('[data-hfx-admin-history]')) {
                var id = wrapper.getAttribute('data-hfx-canopyx');
                window.CanopyX.configure(id, {live:{stableOrder:false},recordHeading:function(record){return{title:'Change by '+(record.cells?.actor||'Unknown account'),subtitle:record.cells?.when?new Date(record.cells.when).toLocaleString():''};},recordActions:model.canWrite && !wrapper.hasAttribute('data-hfx-admin-history-readonly') ? [{label:'Restore this version',prominent:true,run:async function (context) {
                    if (!bar.hidden && !window.confirm('Replace the current unsaved changes with this retained version?')) return;
                    if (busy) return;
                    var stillCurrent = draftTransition();
                    var current = await request('settings'), restored = await request('history/' + encodeURIComponent(context.record.id));
                    if (!stillCurrent(context.signal)) return;
                    if (current.snapshot.revision !== restored.revision) throw new Error('The file changed while loading the retained version. Reload before restoring.');
                    changed(); model = current; draft = restored.document; secrets = {}; restoreBeforeId = restored.restoreBeforeId;
                    var dialog = document.querySelector('dialog[data-cx-view="'+CSS.escape(context.view)+'"]');
                    if (dialog) dialog.close();
                    invalidateChecks(); sync(); await review();
                }}] : []});
                var mounted = window.CanopyX.mount(wrapper); await Promise.all(mounted.map(function (api) {return api.ready;}));
                var limit=wrapper.hasAttribute('data-hfx-admin-history-limit')?Number(wrapper.getAttribute('data-hfx-admin-history-limit')):undefined;
                mounted.forEach(function(api){historyGrids.push({api:api,limit:limit});});
            }
            await refreshHistory();
        }
        studio.addEventListener('input', function (event) {
            if (!event.target.closest('[data-hfx-admin-json-search]')) return;
            var panel = jsonPanel(), code = panel.querySelector('pre code'), query = event.target.value;
            var text = code.textContent, offset = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
            panel.querySelector('[data-hfx-admin-json-search-result]').textContent = !query ? '' : offset < 0 ? 'No match' : 'Match found';
            if (offset < 0) return;
            var walker = document.createTreeWalker(code,NodeFilter.SHOW_TEXT), node, position=0, range=document.createRange(), started=false;
            while ((node=walker.nextNode())) {
                var end=position+node.textContent.length;
                if (!started && offset < end) {range.setStart(node,offset-position);started=true;}
                if (started && offset+query.length <= end) {range.setEnd(node,offset+query.length-position);break;}
                position=end;
            }
            if (started) { var selection=window.getSelection();selection.removeAllRanges();selection.addRange(range); range.startContainer.parentElement.scrollIntoView({block:'nearest'}); }
        });
        async function bindFlows() {
            for (var wrapper of studio.querySelectorAll('[data-hfx-admin-flow]')) {
                var flowId = wrapper.getAttribute('data-hfx-cx-flow'), kind = wrapper.getAttribute('data-hfx-admin-flow');
                var binding = {paths:JSON.parse(wrapper.getAttribute('data-hfx-admin-check-paths')||'[]'),generation:0,editIndex:null};
                var makeHooks = function (element, flowKind, owner) { return {
                    check: async function (checkId, values, context) {
                        var checkedGeneration = owner.generation;
                        var result = await request('check/' + encodeURIComponent(checkId), proposal(), context.signal);
                        result.stale = checkedGeneration !== owner.generation;
                        result.group = element.getAttribute('data-hfx-admin-check-group'); result.paths=owner.paths; checks[element.getAttribute('data-hfx-cx-flow')+':'+checkId] = result;
                        retireReview(); updateCheckSummary();
                        return result.stale ? {status:'warning',message:'Settings changed while checking. Run the check again.'} : result;
                    },
                    submit: async function (detail) {
                        if (flowKind !== 'collection') return {status:'saved',message:'Checks complete. No configuration was saved.'};
                        if (busy || !model.canWrite) return {status:'error',message:'This account cannot edit now.'};
                        var current = draftTransition(); owner.pending = null;
                        var pointer = element.getAttribute('data-hfx-admin-collection'), properties = JSON.parse(element.getAttribute('data-hfx-admin-flow-properties'));
                        var candidate = copy(draft), collection = read(candidate, pointer);
                        if(collection===undefined||collection===null){collection=[];write(candidate,pointer,collection);}
                        if (!Array.isArray(collection)) return {status:'error',message:'Reload the collection before editing.'};
                        if (owner.editIndex !== null && !collection[owner.editIndex]) return {status:'error',message:'This item changed. Close the editor and select it again.'};
                        var item = owner.editIndex === null ? {} : copy(collection[owner.editIndex]);
                        var spans=new Set(JSON.parse(element.getAttribute('data-hfx-admin-time-spans')||'[]'));
                        var recordFields=JSON.parse(element.getAttribute('data-hfx-admin-record-fields')||'{}');
                        for(var key of Object.keys(properties)) {
                            if(owner.editIndex!==null&&equals(detail.values[key],owner.baselineValues[key]))continue;
                            var path=properties[key].startsWith('/')?properties[key]:'/'+properties[key];
                            var currentRecords=read(item,path)||[], knownColumns=(recordFields[key]||[]).map(function(column){return column.toLowerCase();});
                            if(recordFields[key]&&currentRecords.some(function(row){return Object.keys(row).some(function(column){return !knownColumns.includes(column.toLowerCase());});}))
                                return {status:'error',message:'This table contains settings outside this editor. Use the JSON editor and preserve the not-managed values.'};
                            var next=spans.has(key)?timeSpanText(isoDurationSeconds(detail.values[key])):detail.values[key];
                            if(recordFields[key]&&Array.isArray(next))next=next.map(function(row,index){var result={};Object.keys(row).forEach(function(column){assign(result,currentRecords[index]?property(currentRecords[index],column):column,row[column]);});return result;});
                            write(item,path,next);
                        }
                        if (owner.editIndex === null) collection.push(item); else collection[owner.editIndex] = item;
                        var payload = proposal(); payload.document = candidate;
                        var preview = await request('preview', payload);
                        if (!current()) return {status:'error',message:'The draft changed while validating. Reopen the item and try again.'};
                        if (preview.errors.length) return {status:'error',message:preview.errors.join(' ')};
                        // Only native settlement may commit: cancelled, reset, timed-out or destroyed submissions never settle here.
                        owner.pending = {candidate:candidate,pointer:pointer,current:current};
                        return {status:'saved',message:'Updated unsaved changes. Review the complete change set before saving.'};
                    }
                }; };
                window.CanopyX.configure(flowId, {hooks:makeHooks(wrapper,kind,binding), timeout:15000,
                    labels:kind==='checks'?{flowCancel:'Close'}:undefined,
                    onSubmitted:function(owner){return function(answer){var pending=owner.pending;owner.pending=null;if(answer.status==='saved'&&pending?.current()){changed();draft=pending.candidate;invalidateChecks([pending.pointer]);sync();}};}(binding)});
                var mounted = window.CanopyX.mount(wrapper);
                await Promise.all(mounted.map(function (api) { return api.ready; }));
                if (kind==='checks') {binding.api=mounted[0];checkBindings.push(binding);}
                if (kind==='collection') await bindCollection(wrapper,mounted[0],binding);
            }
        }
        async function bindCollection(wrapper, flow, binding) {
            var gridId=wrapper.getAttribute('data-hfx-admin-collection-grid'); if (!gridId) return;
            var gridElement=studio.querySelector('[data-hfx-canopyx="'+CSS.escape(gridId)+'"]'); if (!gridElement) return;
            var pointer=wrapper.getAttribute('data-hfx-admin-collection'), properties=JSON.parse(wrapper.getAttribute('data-hfx-admin-flow-properties'));
            var spans=new Set(JSON.parse(wrapper.getAttribute('data-hfx-admin-time-spans')||'[]'));
            var recordFields=JSON.parse(wrapper.getAttribute('data-hfx-admin-record-fields')||'{}');
            function itemValues(item) {var values={};Object.keys(properties).forEach(function(key){var path=properties[key],value=read(item,path.startsWith('/')?path:'/'+path);if(value!==undefined){var seconds=spans.has(key)?timeSpanSeconds(value):null;values[key]=spans.has(key)?seconds===null?null:'PT'+seconds+'S':recordFields[key]?value.map(function(row){var known={};recordFields[key].forEach(function(column){var cell=read(row,'/'+escapePointer(column));if(cell!==undefined)assign(known,column,cell);});return known;}):value;}});return values;}
            async function edit(context) {
                if (busy) return;
                var index=Number(context.record.id), item=read(draft,pointer)?.[index]; if (!item) throw new Error('Reload the item before editing.');
                document.querySelector('dialog[data-cx-view="'+CSS.escape(context.view)+'"]')?.close();
                binding.editIndex=index; flow.reset(); flow.setValues(itemValues(item)); binding.baselineValues=copy(flow.getValues()); await flow.goTo(flow.flow.steps[0].id); flow.open();
            }
            async function remove(context) {
                if (busy || !window.confirm('Remove this item from the unsaved configuration? Review and apply are still required.')) return;
                var current=draftTransition(), candidate=copy(draft), items=read(candidate,pointer), index=Number(context.record.id);
                if (!Number.isInteger(index)||index<0||index>=items.length) throw new Error('Reload the item before removing it.');
                items.splice(index,1); var payload=proposal();payload.document=candidate;
                var preview=await request('preview',payload,context.signal);if(!current(context.signal))return;if(preview.errors.length)throw new Error(preview.errors.join(' '));
                changed();draft=candidate;invalidateChecks([pointer]);sync();document.querySelector('dialog[data-cx-view="'+CSS.escape(context.view)+'"]')?.close();
            }
            window.CanopyX.configure(gridId,{recordActions:[{label:'Edit item',run:edit},{label:'Remove item',run:remove}]});
            var grids=window.CanopyX.mount(gridElement); await Promise.all(grids.map(function(grid){return grid.ready;}));
                binding.refresh=function(){var items=read(draft,pointer)||[];grids.forEach(function(grid){var rows=items.map(function(item,index){var cells={};grid.view.columns.forEach(function(column){var value=read(item,'/'+escapePointer(column.id)), descriptor=model.schema.find(function(field){return field.path===pointer+'/[]/'+escapePointer(column.id);});assign(cells,column.id,value==null?null:descriptor?.type==='duration'?durationDisplay(value):value);});return{id:String(index),cells:cells};});grid.setRows(rows).catch(error);});};
            wrapper.addEventListener('click',function(event){if(event.target.closest('.cx-flow-launch')){binding.editIndex=null;flow.reset();}},true);
            collections.push(binding);binding.refresh();
        }
        function bindReadGrids() { return readGrids(studio, request); }
        try { model = await request('settings'); draft = copy(model.snapshot.document); sync(); await bindHistory(); await bindFlows(); await bindReadGrids(); client.setAttribute('data-hfx-admin-ready','true'); }
        catch (e) { error(e); }
        finally { client.setAttribute('aria-busy','false'); }
    }
    function signIn(surface) {
        var buttons = Array.from(surface.querySelectorAll('[data-hfx-admin-sign-in-submit]'));
        var alert = surface.querySelector('[data-hfx-sign-in-part=alert]'), status = surface.querySelector('[data-hfx-admin-sign-in-status]');
        buttons.forEach(function (submit) {
            var container = submit.closest('[data-hfx-sign-in-method]'), kind = container.dataset.hfxSignInMethod;
            var input = container.querySelector('input[type=password]'), username = container.querySelector('input[name=username]');
            async function exchange() {
                if (submit.disabled) return;
                if (kind === 'password' && !username.value.trim()) { username.value = ''; username.reportValidity(); return; }
                if (!input.value) { input.reportValidity(); return; }
                var secret = input.value; input.value = '';
                var headers = { 'X-Admin-CSRF': surface.getAttribute('data-hfx-admin-csrf') }, payload;
                var endpoint = surface.getAttribute('data-hfx-admin-sign-in');
                if (kind === 'key') headers['X-Api-Key'] = secret;
                else {
                    var methods = Number(surface.dataset.hfxSignInPasswordMethods), selector = container.querySelector('select[name=method]');
                    var method = methods === 2 || methods === 3 && selector.value === 'Domain account' ? 'domain' : 'local';
                    payload = { method: method, username: username.value.trim(), password: secret };
                    endpoint = surface.dataset.hfxSignInPasswordEndpoint; headers['Content-Type'] = 'application/json';
                }
                alert.replaceChildren(); status.textContent = ''; surface.dataset.hfxSignInState = 'working';
                surface.querySelectorAll('[aria-invalid]').forEach(function (field) { field.removeAttribute('aria-invalid'); });
                buttons.forEach(function (button) { button.disabled = true; });
                try {
                    var response = await fetch(endpoint, { method: 'POST', headers: headers, body: payload ? JSON.stringify(payload) : undefined });
                    secret = ''; if (payload) payload.password = '';
                    var result = await response.json().catch(function () { return {}; });
                    if (!response.ok) { var error = new Error(result.error || result.detail || (kind === 'key' ? 'Sign-in failed. Check the key and its administration scope.' : 'Sign-in failed. Check the account type, username and password.')); error.status = response.status; throw error; }
                    redirectLocal(typeof result.url === 'string' && !result.url.includes('#') ? result.url + location.hash : result.url);
                } catch (error) {
                    var heading = document.createElement('strong'), copy = document.createElement('span');
                    heading.textContent = error.status === 429 ? 'Please wait before trying again.' : error.status === 403 ? 'Administration access is required.' : 'Could not sign in.';
                    copy.textContent = error.message; alert.append(heading, copy); alert.dataset.tone = error.status === 429 ? 'warn' : error.status === 403 ? 'info' : 'bad';
                    surface.dataset.hfxSignInState = 'failed'; input.setAttribute('aria-invalid', 'true'); if (username) username.setAttribute('aria-invalid', 'true'); alert.focus();
                } finally { secret = ''; if (payload) payload.password = ''; buttons.forEach(function (button) { button.disabled = false; }); }
            }
            submit.addEventListener('click', exchange);
            container.querySelectorAll('input').forEach(function (field) { field.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); exchange(); } }); });
        });
    }
    function start() {
        // Install the client/picker listeners before initial address navigation emits its page-change event.
        document.querySelectorAll('[data-hfx-admin-client]').forEach(function (client) { bind(client); });
        document.querySelectorAll('.hfx-service-admin').forEach(function (studio) {
            studio.addEventListener('hfx:operational-workspace-page-change', function (event) {
                var picker = studio.querySelector('.hfx-admin-section-picker'), target = event.detail.target;
                if (!picker) return;
                var option = picker.querySelector('[data-hfx-operational-nav-target="' + CSS.escape(target) + '"]');
                picker.querySelector('[data-hfx-as-picker-label]').textContent = option ? option.querySelector('.hfx-as-picker-opt-label').textContent : event.detail.page?.querySelector('.hfx-service-config-panel__title-group strong')?.textContent || target;
            });
            var fromAddress = false;
            function navigate() {
                var key = location.hash.slice(1).split('&')[0];
                if (!/^[a-z0-9-]+$/i.test(key) || !window.HfxOperationalList) return;
                fromAddress = true;
                try { window.HfxOperationalList.showPage(studio, key); }
                finally { fromAddress = false; }
            }
            studio.addEventListener('hfx:operational-workspace-page-change', function (event) {
                if (fromAddress || event.target !== studio || !/^[a-z0-9-]+$/i.test(event.detail.target)) return;
                history.replaceState(history.state, '', location.pathname + location.search + '#' + event.detail.target);
            });
            window.addEventListener('hashchange', navigate);
            navigate();
        });
        document.querySelectorAll('[data-hfx-admin-sign-in]').forEach(signIn);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
