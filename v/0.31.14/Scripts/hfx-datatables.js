// HtmlForgeX DataTables helpers
// Small utilities to reduce inline script size in generated pages.
(function (global) {
    if (global.hfxDt) return; // singleton
    function looksFunction(s) {
        if (typeof s !== 'string') return false; var t = s.trim();
        return t.indexOf('function') === 0 || t.indexOf('(') === 0 || t.indexOf('async ') === 0;
    }
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function sanitizeHref(href) {
        if (href == null) return null;
        var s = String(href).trim();
        if (!s) return null;
        if (/^javascript:/i.test(s)) return null;
        if (/^(https?:|mailto:)/i.test(s) || s.indexOf('?') === 0 || s.indexOf('#') === 0 || s.indexOf('/') === 0) return s;
        return null;
    }
    function badgeCss(tone) {
        switch (String(tone || 'Secondary').toLowerCase()) {
            case 'success': return 'bg-green-lt';
            case 'warning': return 'bg-orange-lt';
            case 'caution': return 'bg-yellow-lt';
            case 'danger': return 'bg-red-lt';
            case 'info': return 'bg-azure-lt';
            case 'primary': return 'bg-blue-lt';
            default: return 'bg-gray-lt';
        }
    }
    function cellScalar(cell, type) {
        if (!cell || typeof cell !== 'object' || !cell.__hfxCell) return cell;
        if (type === 'sort' || type === 'type') return cell.sort != null ? cell.sort : (cell.raw != null ? cell.raw : cell.text);
        if (type === 'filter' || type === 'search') return cell.filter != null ? cell.filter : (cell.raw != null ? cell.raw : cell.text);
        if (type === 'export') return cell.export != null ? cell.export : (cell.raw != null ? cell.raw : cell.text);
        return cell.text != null ? cell.text : '';
    }
    function renderCellValue(data, type) {
        if (!data || typeof data !== 'object' || !data.__hfxCell) return data;
        if (type === 'sort' || type === 'type' || type === 'filter' || type === 'search' || type === 'export') {
            return cellScalar(data, type);
        }

        var text = esc(data.text != null ? data.text : '');
        var raw = data.raw != null ? ' data-raw="' + esc(data.raw) + '"' : '';
        var order = data.sort != null ? ' data-order="' + esc(data.sort) + '"' : '';
        var title = data.title != null ? ' title="' + esc(data.title) + '"' : '';
        var cls = data.className ? ' ' + esc(data.className) : '';
        var kind = String(data.kind || 'Text').toLowerCase();

        if (kind === 'badge') {
            return '<span class="badge ' + badgeCss(data.tone) + cls + '"' + order + raw + title + '>' + text + '</span>';
        }
        if (kind === 'ellipsis') {
            var maxWidth = data.maxWidthPx && Number(data.maxWidthPx) > 0 ? Number(data.maxWidthPx) : 420;
            return '<span class="hfx-dt-cell-ellipsis' + cls + '"' + raw + title + order + ' style="max-width:' + maxWidth + 'px">' + text + '</span>';
        }
        if (kind === 'wrap') {
            return '<span class="hfx-dt-cell-wrap' + cls + '"' + raw + title + order + '>' + text + '</span>';
        }
        if (kind === 'link') {
            var href = sanitizeHref(data.href);
            if (!href) return text;
            return '<a class="hfx-dt-cell-link' + cls + '" href="' + esc(href) + '"' + raw + title + order + '>' + text + '</a>';
        }
        if (kind === 'badgelist') {
            var badges = Array.isArray(data.badges) ? data.badges : [];
            if (!badges.length) return text;
            var html = badges.map(function (b) {
                return '<span class="badge ' + badgeCss(b && b.tone) + cls + '">' + esc(b && b.text != null ? b.text : '') + '</span>';
            }).join(' ');
            return '<span class="hfx-dt-cell-badges"' + raw + title + '>' + html + '</span>';
        }
        return order ? '<span' + order + raw + title + '>' + text + '</span>' : text;
    }
    var banned = /(\bwindow\b|\bdocument\b|\beval\b|\bFunction\b|\bimport\b|\blocation\b|\bXMLHttpRequest\b|\bfetch\b|\blocalStorage\b|\bsessionStorage\b|\bconstructor\b|\bprototype\b)/;
    function reviveCallbacks(conf, policy) {
        try {
            if (!conf) return;
            if (policy === 'Off') return;
            var revive = function (str) {
                if (typeof str !== 'string') return null;
                if (policy === 'KnownSafeOnly') { if (!looksFunction(str) || banned.test(str)) return null; }
                try { return (new Function('return (' + str + ')'))(); } catch (_) { return null; }
            };
            ['rowCallback','headerCallback','footerCallback','drawCallback','initComplete','createdRow','stateSaveCallback','stateLoadCallback'].forEach(function(k){
                var v = conf[k]; if (typeof v === 'string') { var fn = revive(v); if (fn) conf[k] = fn; }
            });

            // RowGroup: revive start/end render callbacks when provided as strings
            var rg = conf.rowGroup;
            if (rg) {
                if (typeof rg.startRender === 'string') { var rs = revive(rg.startRender); if (rs) rg.startRender = rs; }
                if (typeof rg.endRender === 'string') { var re = revive(rg.endRender); if (re) rg.endRender = re; }
            }

            [conf.columns, conf.columnDefs].forEach(function(list){
                if (!Array.isArray(list)) return;
                list.forEach(function(col){
                    if (!col) return;
                    if (typeof col.render === 'string') { var rc = revive(col.render); if (rc) col.render = rc; }
                });
            });

            // Buttons: revive per-button callbacks like customize/action and nested exportOptions.format.body
            var btns = conf.buttons;
            if (btns) {
                var list = Array.isArray(btns) ? btns : (btns.buttons || []);
                list.forEach(function(b){
                    if (!b) return;
                    if (typeof b.customize === 'string') { var f = revive(b.customize); if (f) b.customize = f; }
                    if (typeof b.action === 'string') { var g = revive(b.action); if (g) b.action = g; }
                    var fmt = b.exportOptions && b.exportOptions.format;
                    if (fmt && typeof fmt.body === 'string') { var h = revive(fmt.body); if (h) fmt.body = h; }
                });
            }
        } catch (_) { }
    }

    function applyViewportAndToolbar(api, btnAlign, filterAlign, density) {
        try {
            var $ = global.jQuery || global.$; if (!$ || !api) return;
            var $tbl = $(api.table().node()); var $wrap = $(api.table().container());
            $tbl.css('width','100%'); $wrap.css('width','100%').css('max-width','100%');
            // Avoid draw() here: it can trigger the "processing" overlay and add jank in large reports.
            // Column adjustment + responsive recalc are enough for most reveal/layout fixes.
            if (api.columns && api.columns.adjust) { api.columns.adjust(); }
            if (api.responsive && api.responsive.recalc) api.responsive.recalc();
            var $bar = $wrap.find('.dt-toolbar'); if (!$bar.length) return;
            var $filter = $bar.find('.dataTables_filter, .dt-search').first();
            var $buttons = $bar.find('.dt-buttons').first();
            var $paging = $bar.find('.dt-paging').first();
            var densitySlug = null;
            if (density === 'Compact') densitySlug = 'compact';
            else if (density === 'Default') densitySlug = 'default';
            else if (density === 'Dense') densitySlug = 'dense';
            if (!densitySlug) {
                if ($bar.hasClass('hfx-dt-toolbar-density-compact') || $bar.hasClass('hfx-controlbar-density-compact')) densitySlug = 'compact';
                else if ($bar.hasClass('hfx-dt-toolbar-density-dense') || $bar.hasClass('hfx-controlbar-density-dense')) densitySlug = 'dense';
                else densitySlug = 'default';
            }
            $bar
                .addClass('hfx-controlbar')
                .removeClass('hfx-dt-toolbar-density-default hfx-dt-toolbar-density-compact hfx-dt-toolbar-density-dense hfx-controlbar-density-default hfx-controlbar-density-compact hfx-controlbar-density-dense')
                .addClass('hfx-dt-toolbar-density-' + densitySlug)
                .addClass('hfx-controlbar-density-' + densitySlug);
            if ($buttons.length) $buttons.addClass('hfx-controlbar-group hfx-controlbar-group-actions');
            if ($filter.length) $filter.addClass('hfx-controlbar-group hfx-controlbar-group-filter');
            if ($paging.length) $paging.addClass('hfx-controlbar-group hfx-controlbar-group-paging');
            $bar.css('justify-content',''); $filter.css('margin-left','');
            function jc(v){ $bar.css('justify-content', v); }
            if (btnAlign === 'Left' && filterAlign === 'Right') { jc('space-between'); $filter.css('margin-left','auto'); }
            else if (btnAlign === 'Right' && filterAlign === 'Left') { jc('space-between'); }
            else if (btnAlign === 'Center' && filterAlign === 'Center') { jc('center'); }
            else if (btnAlign === 'Right' && filterAlign === 'Right') { jc('flex-end'); }
            else if (btnAlign === 'Left' && filterAlign === 'Left') { jc('flex-start'); }
            else { jc('space-between'); }
        } catch (_) { }
    }

    function bindColumnFilterRow(api, $row, $headerCells, fallbackPlaceholder) {
        try {
            var $ = global.jQuery || global.$; if (!$ || !api || !$row || !$row.length) return;
            var settings = null;
            try { settings = api.settings && api.settings()[0]; } catch (_) { }

            $row.find('th').each(function (i) {
                var $cell = $(this);
                var $input = $cell.find('input.hfx-dt-column-filter-input, input[type="text"]').first();
                if (!$input.length) {
                    $input = $('<input type=\'text\' class=\'form-control form-control-sm hfx-dt-column-filter-input\'/>').appendTo($cell);
                }

                var searchable = true;
                try {
                    searchable = !settings || !settings.aoColumns || !settings.aoColumns[i] || settings.aoColumns[i].bSearchable !== false;
                } catch (_) { }

                var title = '';
                try { title = String($headerCells.eq(i).text() || '').trim(); } catch (_) { }
                var placeholder = title || fallbackPlaceholder || 'Filter';

                $input
                    .attr('data-column-index', i)
                    .attr('placeholder', placeholder)
                    .attr('aria-label', title ? ('Filter ' + title) : 'Filter column')
                    .prop('disabled', !searchable);

                if (!searchable) {
                    $input.val('');
                    return;
                }

                try { $input.val(api.column(i).search() || ''); } catch (_) { }

                $input
                    .off('.hfxDtFilter')
                    .on('input.hfxDtFilter keyup.hfxDtFilter change.hfxDtFilter', function () {
                        var value = this.value == null ? '' : String(this.value);
                        try {
                            if (api.column(i).search() !== value) {
                                api.column(i).search(value).draw();
                            }
                        } catch (_) { }
                    });
            });
        } catch (_) { }
    }

    function headerFilters(tableSelector) {
        try {
            var $ = global.jQuery || global.$; if (!$) return;
            var $t = $(tableSelector); var api = $t.DataTable(); var $thead = $t.find('thead');
            var $orig = $thead.find('tr').first();
            if (!$orig.length) return;
            var $filter = $thead.find('tr.hfx-header-filter').first();
            if (!$filter.length) {
                $filter = $('<tr class=\'hfx-header-filter\' data-dt-order=\'disable\'/>' );
                $orig.find('th').each(function(){ $('<th data-dt-order=\'disable\'/>').appendTo($filter); });
                $filter.appendTo($thead);
            }
            bindColumnFilterRow(api, $filter, $orig.find('th'), 'Search');
        } catch (_) { }
    }

    function footerFilters(tableSelector) {
        try {
            var $ = global.jQuery || global.$; if (!$) return;
            var $t = $(tableSelector); var api = $t.DataTable();
            var $thead = $t.find('thead'); if (!$thead.length) return;
            var $headerCells = $thead.find('tr').first().find('th');
            if (!$headerCells.length) return;
            var $tfoot = $t.find('tfoot');
            if (!$tfoot.length) { $tfoot = $('<tfoot/>').appendTo($t); }
            var $filter = $tfoot.find('tr.hfx-footer-filter').first();
            if (!$filter.length) {
                $filter = $('<tr class=\'hfx-footer-filter\' data-dt-order=\'disable\'/>');
                $headerCells.each(function () {
                    $('<th data-dt-order=\'disable\'/>').appendTo($filter);
                });
                $tfoot.append($filter);
            }

            bindColumnFilterRow(api, $filter, $headerCells, 'Filter');
            try { if (api.columns && api.columns.adjust) api.columns.adjust(); } catch (_) { }
        } catch (_) { }
    }

    function alphabetFilter(api, col) {
        try {
            var $ = global.jQuery || global.$; if (!$ || !api) return;
            var inject = function(){
                if ($.fn.dataTable && $.fn.dataTable.AlphabetSearch) { $.fn.dataTable.AlphabetSearch(api, col); return; }
                var $wrap = $(api.table().container()); var $cont = $wrap.find('div.dataTables_filter, div.dt-search').first();
                if(!$cont.length) $cont = $wrap.find('.dt-toolbar'); if(!$cont.length) $cont = $wrap.find('.dt-buttons').first().parent(); if(!$cont.length) $cont = $wrap;
                if($wrap.find('.hfx-alpha-filter').length) return;
                var $alpha = $('<div class=\'hfx-alpha-filter btn-group btn-group-sm me-2 mb-2\' role=\'group\' aria-label=\'Alphabet Filter\'></div>');
                $('<button type=\'button\' class=\'btn btn-light\'>All</button>').appendTo($alpha).on('click', function(){ api.column(col).search('').draw(); });
                'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function(ch){ $('<button type=\'button\' class=\'btn btn-light\'>'+ch+'</button>').appendTo($alpha).on('click', function(){ api.column(col).search('^'+ch, true, false).draw(); }); });
                $cont.prepend($alpha);
            };
            setTimeout(inject, 0); $(api.table().container()).on('init.dt', inject);
        } catch (_) { }
    }

    function stripHtmlValue(value) {
        if (value == null) return '';
        if (typeof value !== 'string') return String(value);
        return value
            .replace(/<script\b[^<]*(?:(?!<\/script[^>]*>)<[^<]*)*<\/script[^>]*>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();
    }

    function normalizeExportModifier(api, rowsSelector, exportOptions) {
        var base = { search: 'applied', order: 'applied' };
        var modifier = {};
        try {
            if (exportOptions && exportOptions.modifier && typeof exportOptions.modifier === 'object') {
                for (var k in exportOptions.modifier) {
                    if (Object.prototype.hasOwnProperty.call(exportOptions.modifier, k)) {
                        modifier[k] = exportOptions.modifier[k];
                    }
                }
            }
        } catch (_) { }

        if (modifier.search == null) modifier.search = base.search;
        if (modifier.order == null) modifier.order = base.order;

        try {
            if (api.select && typeof api.select.info === 'function' && modifier.selected === undefined) {
                var selectedModifier = {};
                for (var key in modifier) {
                    if (Object.prototype.hasOwnProperty.call(modifier, key)) {
                        selectedModifier[key] = modifier[key];
                    }
                }
                selectedModifier.selected = true;
                if (api.rows(rowsSelector, selectedModifier).any()) {
                    modifier.selected = true;
                }
            }
        } catch (_) { }

        return modifier;
    }

    function resolveColumnIndexes(api, exportOptions) {
        try {
            var selector = exportOptions && exportOptions.columns !== undefined ? exportOptions.columns : '';
            return api.columns(selector).indexes().toArray();
        } catch (_) {
            return api.columns().indexes().toArray();
        }
    }

    function resolveRowIndexes(api, exportOptions) {
        var rowsSelector = exportOptions && exportOptions.rows !== undefined ? exportOptions.rows : null;
        var modifier = normalizeExportModifier(api, rowsSelector, exportOptions);
        try {
            return api.rows(rowsSelector, modifier).indexes().toArray();
        } catch (_) {
            return api.rows().indexes().toArray();
        }
    }

    function resolveColumnHeaderText(api, columnIndex) {
        try {
            var headerNode = api.column(columnIndex).header();
            if (!headerNode) return '';
            var titleNode = headerNode.querySelector ? headerNode.querySelector('.dt-column-title') : null;
            var text = titleNode ? titleNode.textContent : headerNode.textContent;
            return String(text || '').trim();
        } catch (_) {
            return '';
        }
    }

    function resolveColumnFooterText(api, columnIndex) {
        try {
            var footerNode = api.column(columnIndex).footer();
            if (!footerNode) return '';
            var titleNode = footerNode.querySelector ? footerNode.querySelector('.dt-column-title') : null;
            var text = titleNode ? titleNode.textContent : footerNode.textContent;
            return String(text || '').trim();
        } catch (_) {
            return '';
        }
    }

    function resolveRenderedExportCell(api, rowIndex, columnIndex, exportOptions) {
        var value = '';
        try {
            value = api.cell(rowIndex, columnIndex).render('export');
        } catch (_) {
            try {
                value = api.cell(rowIndex, columnIndex).render('display');
            } catch (_2) {
                value = '';
            }
        }

        if (value && typeof value === 'object' && value.__hfxCell) {
            value = cellScalar(value, 'export');
        }

        if (value == null) {
            value = '';
        }

        var formatBody = exportOptions && exportOptions.format ? exportOptions.format.body : null;
        if (typeof formatBody === 'function') {
            try {
                value = formatBody(value, rowIndex, columnIndex, null);
            } catch (_) { }
        }

        return stripHtmlValue(value);
    }

    function safeExportData(api, exportOptions) {
        var columnIndexes = resolveColumnIndexes(api, exportOptions);
        var rowIndexes = resolveRowIndexes(api, exportOptions);
        var header = columnIndexes.map(function (columnIndex) { return resolveColumnHeaderText(api, columnIndex); });
        var footer = columnIndexes.map(function (columnIndex) { return resolveColumnFooterText(api, columnIndex); });
        var hasFooter = footer.some(function (value) { return String(value || '').length > 0; });
        var body = rowIndexes.map(function (rowIndex) {
            return columnIndexes.map(function (columnIndex) {
                return resolveRenderedExportCell(api, rowIndex, columnIndex, exportOptions);
            });
        });

        return {
            header: header,
            headerStructure: [header.map(function (title) { return { title: title }; })],
            footer: hasFooter ? footer : null,
            footerStructure: hasFooter ? [footer.map(function (title) { return { title: title }; })] : [],
            body: body
        };
    }

    function resolveSafeBaseExtend(extend, config, button) {
        if (extend) {
            return extend;
        }

        var className = '';
        if (config && typeof config.className === 'string') {
            className += ' ' + config.className;
        }

        if (button && typeof button.className === 'string') {
            className += ' ' + button.className;
        }

        className = className.toLowerCase();
        if (className.indexOf('buttons-excel') >= 0) return 'excelHtml5';
        if (className.indexOf('buttons-csv') >= 0) return 'csvHtml5';
        if (className.indexOf('buttons-pdf') >= 0) return 'pdfHtml5';
        if (className.indexOf('buttons-copy') >= 0) return 'copyHtml5';

        var text = '';
        if (config && typeof config.text === 'string') {
            text = config.text.trim().toLowerCase();
        } else if (button && typeof button.textContent === 'string') {
            text = button.textContent.trim().toLowerCase();
        }

        switch (text) {
            case 'excel':
                return 'excelHtml5';
            case 'csv':
                return 'csvHtml5';
            case 'pdf':
                return 'pdfHtml5';
            case 'copy':
                return 'copyHtml5';
            default:
                return extend;
        }
    }

    function resolveSafeBaseButton($, extend, config, button) {
        try {
            var ext = $.fn && $.fn.dataTable && $.fn.dataTable.ext ? $.fn.dataTable.ext.buttons : null;
            if (!ext) return null;
            var resolvedExtend = resolveSafeBaseExtend(extend, config, button);
            var normalized = String(resolvedExtend || '').toLowerCase();
            var candidates;
            switch (normalized) {
                case 'excel':
                case 'excelhtml5':
                    candidates = ['excelHtml5'];
                    break;
                case 'csv':
                case 'csvhtml5':
                    candidates = ['csvHtml5'];
                    break;
                case 'pdf':
                case 'pdfhtml5':
                    candidates = ['pdfHtml5'];
                    break;
                case 'copy':
                case 'copyhtml5':
                    candidates = ['copyHtml5'];
                    break;
                default:
                    candidates = [resolvedExtend];
                    break;
            }

            for (var i = 0; i < candidates.length; i++) {
                var base = ext[candidates[i]];
                if (base && typeof base.action === 'function') {
                    return base;
                }
            }
        } catch (_) { }

        return null;
    }

    function ensureExportBusyStyles() {
        if (!global.document || !global.document.head) return;
        if (global.document.getElementById('hfx-dt-export-busy-style')) return;

        var style = global.document.createElement('style');
        style.id = 'hfx-dt-export-busy-style';
        style.textContent =
            'body.hfx-export-busy, body.hfx-export-busy * { cursor: progress !important; }' +
            '.dt-button.hfx-export-busy { opacity: 0.85; pointer-events: none; position: relative; }' +
            '.dt-button.hfx-export-busy::after { content: attr(data-hfx-export-busy-label); margin-left: 0.35rem; font-weight: 600; }';
        global.document.head.appendChild(style);
    }

    function setExportBusy(button, isBusy) {
        ensureExportBusyStyles();

        if (button && button.classList) {
            if (isBusy) {
                button.classList.add('hfx-export-busy');
                button.setAttribute('aria-busy', 'true');
                button.setAttribute('aria-disabled', 'true');
                if (!button.getAttribute('data-hfx-export-busy-label')) {
                    button.setAttribute('data-hfx-export-busy-label', ' Preparing...');
                }
            } else {
                button.classList.remove('hfx-export-busy');
                button.removeAttribute('aria-busy');
                button.removeAttribute('aria-disabled');
                button.removeAttribute('data-hfx-export-busy-label');
            }
        }

        if (global.document && global.document.body && global.document.body.classList) {
            if (isBusy) {
                global.document.body.classList.add('hfx-export-busy');
            } else if (!global.document.querySelector('.hfx-export-busy')) {
                global.document.body.classList.remove('hfx-export-busy');
            }
        }
    }

    function scheduleSafeExport(run) {
        var raf = typeof global.requestAnimationFrame === 'function'
            ? global.requestAnimationFrame.bind(global)
            : function (callback) { return global.setTimeout(callback, 0); };

        raf(function () {
            global.setTimeout(run, 0);
        });
    }

    function safeExportAction(e, dt, button, config, cb) {
        var $ = global.jQuery || global.$;
        if (!$ || !dt || !config) return;

        var base = resolveSafeBaseButton($, config.extend, config, button);
        if (!base || typeof base.action !== 'function') return;
        if (!dt.buttons || typeof dt.buttons !== 'function') return;

        var actionContext = this;
        var callbackInvoked = false;

        function finalize() {
            if (callbackInvoked) return;
            callbackInvoked = true;
            setExportBusy(button, false);
            if (typeof cb === 'function') {
                try {
                    cb();
                } catch (_) { }
            }
        }

        setExportBusy(button, true);
        scheduleSafeExport(function () {
            var originalExportData = dt.buttons && dt.buttons.exportData ? dt.buttons.exportData : null;
            try {
                dt.buttons.exportData = function (options) {
                    return safeExportData(dt, options || config.exportOptions || {});
                };

                var result = base.action.call(actionContext, e, dt, button, config, function () {
                    finalize();
                });

                global.setTimeout(function () {
                    finalize();
                }, 0);

                return result;
            } catch (error) {
                finalize();
                if (global.console && typeof global.console.error === 'function') {
                    global.console.error('HtmlForgeX safe export failed.', error);
                }
            } finally {
                if (dt && dt.buttons && typeof originalExportData === 'function') {
                    dt.buttons.exportData = originalExportData;
                }
                global.setTimeout(function () {
                    finalize();
                }, 120000);
            }
        });
    }

    global.hfxDt = {
        reviveCallbacks: reviveCallbacks,
        renderCellValue: renderCellValue,
        applyViewportAndToolbar: applyViewportAndToolbar,
        headerFilters: headerFilters,
        footerFilters: footerFilters,
        alphabetFilter: alphabetFilter,
        safeExportAction: safeExportAction
    };
})(window);
