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
            $bar.addClass('hfx-controlbar');
            if ($buttons.length) $buttons.addClass('hfx-controlbar-group hfx-controlbar-group-actions');
            if ($filter.length) $filter.addClass('hfx-controlbar-group hfx-controlbar-group-filter');
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

    function buildColumnFilterInput(title, placeholder, index) {
        return $('<input type=\'text\' class=\'form-control form-control-sm hfx-dt-column-filter-input\'/>')
            .attr('placeholder', placeholder)
            .attr('aria-label', title ? (placeholder + ' ' + title) : 'Filter column')
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

                if (!$input.attr('placeholder')) $input.attr('placeholder', placeholder);
                if (!$input.attr('aria-label')) $input.attr('aria-label', title ? (placeholder + ' ' + title) : 'Filter column');

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

    global.hfxDt = {
        reviveCallbacks: reviveCallbacks,
        renderCellValue: renderCellValue,
        applyViewportAndToolbar: applyViewportAndToolbar,
        headerFilters: headerFilters,
        footerFilters: footerFilters,
        alphabetFilter: alphabetFilter
    };
})(window);
