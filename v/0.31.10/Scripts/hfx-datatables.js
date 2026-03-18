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

    function applyViewportAndToolbar(api, btnAlign, filterAlign) {
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
            $bar.addClass('hfx-controlbar');
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

    function buildColumnFilterInput(title, fallbackPlaceholder, index) {
        var trimmedTitle = title ? String(title).trim() : '';
        var placeholder = trimmedTitle || fallbackPlaceholder || '';
        return $('<input type=\'text\' class=\'form-control form-control-sm hfx-dt-column-filter-input\'/>')
            .attr('placeholder', placeholder)
            .attr('aria-label', trimmedTitle ? ('Filter ' + trimmedTitle) : 'Filter column')
            .attr('data-column-index', index);
    }

    function bindColumnFilters(api, $row, placeholder) {
        try {
            if (!$row || !$row.length) return;
            var settings = null;
            try { settings = api.settings()[0]; } catch (_) { }
            $row.find('th, td').each(function (i) {
                var $cell = $(this);
                var title = '';
                try {
                    title = ($(api.column(i).header()).text() || '').trim();
                } catch (_) { }

                var searchable = true;
                try {
                    searchable = settings.aoColumns[i].bSearchable !== false;
                } catch (_) { }

                var $input = $cell.find('.hfx-dt-column-filter-input').first();
                if (!$input.length) {
                    if (!searchable) return;
                    $input = buildColumnFilterInput(title, placeholder, i).appendTo($cell.empty());
                }

                if (!searchable) {
                    $input.prop('disabled', true).val('').attr('placeholder', '');
                    return;
                }

                if (!$input.attr('placeholder')) $input.attr('placeholder', title || placeholder);
                if (!$input.attr('aria-label')) $input.attr('aria-label', title ? ('Filter ' + title) : 'Filter column');

                $input.off('.hfxDtFilterGuard').on('mousedown.hfxDtFilterGuard click.hfxDtFilterGuard keydown.hfxDtFilterGuard', function (e) {
                    if (e && e.stopPropagation) e.stopPropagation();
                });

                $input.off('.hfxDtFilter').on('keyup.hfxDtFilter change.hfxDtFilter', function () {
                    if (api.column(i).search() !== this.value) {
                        api.column(i).search(this.value).draw();
                    }
                });
            });
        } catch (_) { }
    }

    function ensureFilterRow($section, rowClass, placeholder) {
        try {
            if (!$section || !$section.length) return $();
            var $row = $section.find('tr.' + rowClass).first();
            if ($row.length) return $row;

            var $headerRow = $section.closest('table').find('thead tr').first();
            if (!$headerRow.length) return $();

            $row = $('<tr/>').addClass(rowClass);
            $headerRow.find('th').each(function (i) {
                var title = ($(this).text() || '').trim();
                var $cell = $('<th/>').appendTo($row);
                buildColumnFilterInput(title, placeholder, i).appendTo($cell);
            });
            $section.append($row);
            return $row;
        } catch (_) { return $(); }
    }

    function headerFilters(tableSelector) {
        try {
            var $ = global.jQuery || global.$; if (!$) return;
            var $t = $(tableSelector); var api = $t.DataTable(); var $thead = $t.find('thead');
            if (!$thead.length) return;
            var $row = ensureFilterRow($thead, 'hfx-header-filter', 'Search');
            bindColumnFilters(api, $row, 'Search');
        } catch (_) { }
    }

    function footerFilters(tableSelector) {
        try {
            var $ = global.jQuery || global.$; if (!$) return;
            var $t = $(tableSelector); var api = $t.DataTable();
            var $tfoot = $t.find('tfoot');
            if (!$tfoot.length) { $tfoot = $('<tfoot/>').appendTo($t); }
            var $row = ensureFilterRow($tfoot, 'hfx-footer-filter', 'Filter');
            bindColumnFilters(api, $row, 'Filter');
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

    function resolveSafeBaseButton($, extend) {
        try {
            var ext = $.fn && $.fn.dataTable && $.fn.dataTable.ext ? $.fn.dataTable.ext.buttons : null;
            if (!ext) return null;
            var normalized = String(extend || '').toLowerCase();
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
                    candidates = [extend];
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

    function safeExportAction(e, dt, button, config, cb) {
        var $ = global.jQuery || global.$;
        if (!$ || !dt || !config) return;

        var base = resolveSafeBaseButton($, config.extend);
        if (!base || typeof base.action !== 'function') return;

        var originalExportData = null;
        try {
            originalExportData = dt.buttons && dt.buttons.exportData ? dt.buttons.exportData : null;
            if (!dt.buttons || typeof dt.buttons !== 'function') return;
            dt.buttons.exportData = function (options) {
                return safeExportData(dt, options || config.exportOptions || {});
            };
            return base.action.call(this, e, dt, button, config, cb);
        } finally {
            if (dt && dt.buttons && typeof originalExportData === 'function') {
                dt.buttons.exportData = originalExportData;
            }
        }
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
