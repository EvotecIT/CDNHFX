// HtmlForgeX DataTables helpers
// Small utilities to reduce inline script size in generated pages.
(function (global) {
    if (global.hfxDt) return; // singleton
    function looksFunction(s) {
        if (typeof s !== 'string') return false; var t = s.trim();
        return t.indexOf('function') === 0 || t.indexOf('(') === 0 || t.indexOf('async ') === 0;
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
            $bar.css('justify-content',''); var $filter = $bar.find('.dataTables_filter'); $filter.css('margin-left','');
            function jc(v){ $bar.css('justify-content', v); }
            if (btnAlign === 'Left' && filterAlign === 'Right') { jc('space-between'); $filter.css('margin-left','auto'); }
            else if (btnAlign === 'Right' && filterAlign === 'Left') { jc('space-between'); }
            else if (btnAlign === 'Center' && filterAlign === 'Center') { jc('center'); }
            else if (btnAlign === 'Right' && filterAlign === 'Right') { jc('flex-end'); }
            else if (btnAlign === 'Left' && filterAlign === 'Left') { jc('flex-start'); }
            else { jc('space-between'); }
        } catch (_) { }
    }

    function headerFilters(tableSelector) {
        try {
            var $ = global.jQuery || global.$; if (!$) return;
            var $t = $(tableSelector); var api = $t.DataTable(); var $thead = $t.find('thead');
            if ($thead.find('tr.hfx-header-filter').length) return;
            var $orig = $thead.find('tr').first(); var $filter = $('<tr class=\'hfx-header-filter\'/>' );
            $orig.find('th').each(function(i){ var $th=$('<th/>').appendTo($filter); $('<input type=\'text\' placeholder=\'Search\' class=\'form-control form-control-sm\'/>').appendTo($th).on('keyup change', function(){ if(api.column(i).search()!==this.value){ api.column(i).search(this.value).draw(); } }); });
            $filter.appendTo($thead);
        } catch (_) { }
    }

    function alphabetFilter(api, col) {
        try {
            var $ = global.jQuery || global.$; if (!$ || !api) return;
            var inject = function(){
                if ($.fn.dataTable && $.fn.dataTable.AlphabetSearch) { $.fn.dataTable.AlphabetSearch(api, col); return; }
                var $wrap = $(api.table().container()); var $cont = $wrap.find('div.dataTables_filter');
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
        applyViewportAndToolbar: applyViewportAndToolbar,
        headerFilters: headerFilters,
        alphabetFilter: alphabetFilter
    };
})(window);

