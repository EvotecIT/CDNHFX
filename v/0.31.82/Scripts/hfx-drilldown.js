(function () {
    function findWorkspace(element) {
        return element ? element.closest('[data-hfx-drilldown-workspace]') : null;
    }

    function scopedQueryAll(workspace, selector) {
        if (!workspace) {
            return [];
        }

        return Array.prototype.slice.call(workspace.querySelectorAll(selector)).filter(function (element) {
            return findWorkspace(element) === workspace;
        });
    }

    function scopedQuery(workspace, selector) {
        var matches = scopedQueryAll(workspace, selector);
        return matches.length ? matches[0] : null;
    }

    function buildPanelUrl(url, key) {
        var requestUrl = new URL(url, window.location.href);
        requestUrl.searchParams.set('key', key || '');
        return requestUrl.toString();
    }

    function setBusy(workspace, busy) {
        if (!workspace) {
            return;
        }

        workspace.setAttribute('aria-busy', busy ? 'true' : 'false');
        workspace.classList.toggle('hfx-drilldown-workspace--loading', !!busy);
    }

    function sanitizeRemotePanelHtml(html) {
        var parser = new DOMParser();
        var parsed = parser.parseFromString(html || '', 'text/html');
        var fragment = document.createDocumentFragment();
        Array.prototype.slice.call(parsed.body.childNodes).forEach(function (node) {
            fragment.appendChild(document.importNode(node, true));
        });

        Array.prototype.slice.call(fragment.querySelectorAll('script, iframe, object, embed, link, meta, base')).forEach(function (element) {
            element.remove();
        });

        Array.prototype.slice.call(fragment.querySelectorAll('*')).forEach(function (element) {
            Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
                var name = attribute.name.toLowerCase();
                var value = attribute.value || '';
                if (name.indexOf('on') === 0 || name === 'srcdoc' || ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'formaction') && /^\s*javascript:/i.test(value))) {
                    element.removeAttribute(attribute.name);
                }
            });
        });

        return fragment;
    }

    function appendRemotePanel(workspace, key, html, label) {
        var detail = getDetailLane(workspace);
        if (!detail) {
            return null;
        }

        var panel = document.createElement('div');
        panel.className = 'hfx-drilldown-workspace__panel';
        panel.setAttribute('data-hfx-drilldown-panel', key);
        panel.setAttribute('data-hfx-drilldown-label', label || key);
        panel.setAttribute('aria-hidden', 'true');
        panel.appendChild(sanitizeRemotePanelHtml(html));
        detail.appendChild(panel);
        return panel;
    }

    function activateDeferredScripts(root) {
        if (!root) {
            return;
        }

        Array.prototype.slice.call(root.querySelectorAll('script')).forEach(function (oldScript) {
            var script = document.createElement('script');
            Array.prototype.slice.call(oldScript.attributes).forEach(function (attribute) {
                script.setAttribute(attribute.name, attribute.value);
            });
            script.text = oldScript.textContent || '';
            oldScript.parentNode.replaceChild(script, oldScript);
        });
    }

    function dispatchContentMounted(root) {
        if (!root) {
            return;
        }

        var event;
        if (typeof CustomEvent === 'function') {
            event = new CustomEvent('hfx:content-mounted', {
                bubbles: true,
                detail: {
                    source: 'drilldown-deferred-panel',
                    root: root
                }
            });
        } else {
            event = document.createEvent('CustomEvent');
            event.initCustomEvent('hfx:content-mounted', true, false, {
                source: 'drilldown-deferred-panel',
                root: root
            });
        }

        root.dispatchEvent(event);
    }

    function initializeMountedContent(root) {
        if (!root) {
            return;
        }

        if (window.hfxCollections && typeof window.hfxCollections.init === 'function') {
            window.hfxCollections.init(root);
        }

        Array.prototype.slice.call(root.querySelectorAll('[data-hfx-drilldown-workspace]')).forEach(initialize);
        dispatchContentMounted(root);
    }

    function hydrateDeferredPanel(workspace, panel) {
        if (!workspace || !panel ||
            panel.getAttribute('data-hfx-drilldown-deferred') !== 'true' ||
            panel.getAttribute('data-hfx-drilldown-hydrated') === 'true') {
            return panel;
        }

        var key = panel.getAttribute('data-hfx-drilldown-panel') || '';
        var template = scopedQuery(workspace, 'template[data-hfx-drilldown-template="' + cssEscape(key) + '"]');
        if (!template || !template.content) {
            return panel;
        }

        panel.appendChild(template.content.cloneNode(true));
        panel.setAttribute('data-hfx-drilldown-hydrated', 'true');
        activateDeferredScripts(panel);
        initializeMountedContent(panel);

        if (template.parentNode) {
            template.parentNode.removeChild(template);
        }

        return panel;
    }

    function getMode(workspace) {
        return workspace ? (workspace.getAttribute('data-hfx-drilldown-mode') || 'split') : 'split';
    }

    function canToggleSelection(workspace) {
        return !workspace || workspace.getAttribute('data-hfx-drilldown-toggle-selection') !== 'false';
    }

    function getDetailLane(workspace) {
        return scopedQuery(workspace, '.hfx-drilldown-workspace__detail');
    }

    function restorePushdownPanels(workspace) {
        var detail = getDetailLane(workspace);
        if (!workspace || !detail) {
            return;
        }

        scopedQueryAll(workspace, '.hfx-drilldown-workspace__push-row').forEach(function (row) {
            Array.prototype.slice.call(row.children).forEach(function (cell) {
                Array.prototype.slice.call(cell.children).forEach(function (shell) {
                    if (!shell.classList || !shell.classList.contains('hfx-drilldown-workspace__push-shell')) {
                        return;
                    }

                    Array.prototype.slice.call(shell.children).forEach(function (panel) {
                        if (panel.hasAttribute('data-hfx-drilldown-panel') && findWorkspace(panel) === workspace && !panel.contains(detail)) {
                            detail.appendChild(panel);
                        }
                    });
                });
            });
            row.remove();
        });
    }

    function mountPushdownPanel(workspace, panel, source) {
        if (!workspace || !panel) {
            return;
        }

        var row = source && source.closest ? source.closest('tr') : null;
        if (!row) {
            var selector = scopedQuery(workspace, '[data-hfx-drilldown-select="' + cssEscape(panel.getAttribute('data-hfx-drilldown-panel') || '') + '"]');
            row = selector && selector.closest ? selector.closest('tr') : null;
        }
        if (!row || !row.parentNode) {
            return;
        }

        var table = row.closest('table');
        var columns = row.children && row.children.length
            ? row.children.length
            : table ? table.querySelectorAll('thead th').length : 1;

        var pushRow = document.createElement('tr');
        pushRow.className = 'hfx-drilldown-workspace__push-row';
        pushRow.setAttribute('data-hfx-drilldown-push-row', panel.getAttribute('data-hfx-drilldown-panel') || '');

        var cell = document.createElement('td');
        cell.className = 'hfx-drilldown-workspace__push-cell';
        cell.colSpan = Math.max(1, columns);

        var shell = document.createElement('div');
        shell.className = 'hfx-drilldown-workspace__push-shell';
        shell.appendChild(panel);
        cell.appendChild(shell);
        pushRow.appendChild(cell);

        row.parentNode.insertBefore(pushRow, row.nextSibling);
    }

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }

        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function requestPanel(workspace, key, source) {
        var url = workspace ? workspace.getAttribute('data-hfx-drilldown-panel-url') : '';
        if (!workspace || !url || !key) {
            return;
        }

        workspace.__hfxDrilldownRequestId = (workspace.__hfxDrilldownRequestId || 0) + 1;
        var requestId = workspace.__hfxDrilldownRequestId;
        setBusy(workspace, true);

        fetch(buildPanelUrl(url, key), {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json, text/html' }
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Remote drilldown request failed with ' + response.status);
                }
                var contentType = response.headers.get('content-type') || '';
                if (contentType.indexOf('application/json') !== -1) {
                    return response.json();
                }
                return response.text().then(function (html) {
                    return { html: html };
                });
            })
            .then(function (payload) {
                if (workspace.__hfxDrilldownRequestId !== requestId) {
                    return;
                }

                appendRemotePanel(workspace, key, payload.html || payload.panelHtml || '', payload.label);
                select(workspace, key, source, true);
            })
            .catch(function () {
                if (workspace.__hfxDrilldownRequestId !== requestId) {
                    return;
                }

                appendRemotePanel(
                    workspace,
                    key,
                    '<div class="card"><div class="card-body text-secondary">Could not load details.</div></div>',
                    key);
                select(workspace, key, source, true);
            })
            .finally(function () {
                if (workspace.__hfxDrilldownRequestId === requestId) {
                    setBusy(workspace, false);
                }
            });
    }

    function select(workspace, key, source, skipRemote) {
        if (!workspace) {
            return;
        }

        var mode = getMode(workspace);
        if (mode === 'pushdown') {
            restorePushdownPanels(workspace);
        }

        var panels = scopedQueryAll(workspace, '[data-hfx-drilldown-panel]');
        var empty = scopedQuery(workspace, '[data-hfx-drilldown-empty]');
        var activePanel = null;

        panels.forEach(function (panel) {
            var isActive = key && panel.getAttribute('data-hfx-drilldown-panel') === key;
            panel.classList.toggle('is-active', !!isActive);
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            if (isActive) {
                activePanel = panel;
            }
        });

        if (empty) {
            var showEmpty = !activePanel;
            empty.classList.toggle('is-active', showEmpty);
            empty.setAttribute('aria-hidden', showEmpty ? 'false' : 'true');
        }

        if (key && !activePanel && !skipRemote && workspace.getAttribute('data-hfx-drilldown-panel-url')) {
            requestPanel(workspace, key, source);
            return;
        }

        scopedQueryAll(workspace, '[data-hfx-drilldown-select]').forEach(function (control) {
            var isActive = key && control.getAttribute('data-hfx-drilldown-select') === key;
            control.classList.toggle('active', !!isActive);
            control.classList.toggle('btn-primary', !!isActive && control.classList.contains('btn'));
            control.classList.toggle('btn-outline-primary', !isActive && control.classList.contains('btn'));
            control.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            control.setAttribute('aria-expanded', isActive ? 'true' : 'false');

            var idleText = control.getAttribute('data-hfx-drilldown-idle-text');
            var activeText = control.getAttribute('data-hfx-drilldown-active-text');
            if (idleText && activeText) {
                control.textContent = isActive ? activeText : idleText;
            }

            var row = control.closest('tr');
            if (row) {
                row.classList.toggle('table-active', !!isActive);
                row.classList.toggle('hfx-drilldown-workspace__row-active', !!isActive);
                row.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            }
        });

        workspace.setAttribute('data-hfx-drilldown-current', activePanel ? key : '');
        workspace.classList.toggle('hfx-drilldown-workspace--side-panel-open', mode === 'side-panel' && !!activePanel);

        if (mode === 'pushdown' && activePanel) {
            mountPushdownPanel(workspace, activePanel, source);
        }

        if (activePanel) {
            hydrateDeferredPanel(workspace, activePanel);
        }

        if (source && activePanel && window.matchMedia('(max-width: 1399.98px)').matches) {
            activePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function initialize(workspace) {
        if (!workspace || workspace.hasAttribute('data-hfx-drilldown-ready')) {
            return;
        }

        workspace.setAttribute('data-hfx-drilldown-ready', 'true');

        workspace.addEventListener('click', function (event) {
            var clear = event.target.closest('[data-hfx-drilldown-clear]');
            if (clear && findWorkspace(clear) === workspace) {
                event.preventDefault();
                event.stopPropagation();
                select(workspace, null, clear);
                return;
            }

            var selector = event.target.closest('[data-hfx-drilldown-select]');
            if (!selector || findWorkspace(selector) !== workspace) {
                var row = event.target.closest('tr');
                selector = row ? row.querySelector('[data-hfx-drilldown-select]') : null;
            }

            if (!selector || findWorkspace(selector) !== workspace) {
                return;
            }

            if (event.target.closest('a,button,input,label,.dropdown,.dropdown-menu') && !event.target.closest('[data-hfx-drilldown-select]')) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            var key = selector.getAttribute('data-hfx-drilldown-select');
            var current = workspace.getAttribute('data-hfx-drilldown-current');
            select(workspace, canToggleSelection(workspace) && current && current === key ? null : key, selector);
        });

        var reapplySelection = function (event) {
            if (event && findWorkspace(event.target) !== workspace) {
                return;
            }

            var current = workspace.getAttribute('data-hfx-drilldown-current');
            if (current) {
                select(workspace, current, null, true);
            }
        };

        workspace.addEventListener('hfx:collection:remote-loaded', reapplySelection);
        workspace.addEventListener('hfx:collection:rendered', reapplySelection);

        workspace.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && workspace.getAttribute('data-hfx-drilldown-current')) {
                event.preventDefault();
                event.stopPropagation();
                select(workspace, null, null);
            }
        });

        var initial = workspace.getAttribute('data-hfx-drilldown-default');
        if (!initial && workspace.getAttribute('data-hfx-drilldown-start') === 'first') {
            var firstPanel = scopedQuery(workspace, '[data-hfx-drilldown-panel]');
            initial = firstPanel ? firstPanel.getAttribute('data-hfx-drilldown-panel') : '';
        }

        select(workspace, initial || null, null);
    }

    function initializeAll() {
        Array.prototype.slice.call(document.querySelectorAll('[data-hfx-drilldown-workspace]')).forEach(initialize);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAll);
    } else {
        initializeAll();
    }

    window.HfxDrilldownWorkspace = {
        initializeAll: initializeAll,
        select: function (workspace, key) {
            select(workspace, key, null);
        }
    };
})();
