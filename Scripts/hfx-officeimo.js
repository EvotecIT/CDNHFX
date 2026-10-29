// HtmlForgeX host policy over canonical OfficeIMO writers. No file-format code lives here.
(function (global) {
    'use strict';
    if (global.hfxOfficeIMO) return;
    var cachedFonts;
    async function load(adapter, pdf) {
        await global.hfxLazyAssets.load('officeimo-' + adapter + '.js');
        if (pdf) await global.hfxLazyAssets.load('vfs_fonts.js');
    }
    function fonts() {
        if (cachedFonts) return cachedFonts;
        var vfs = global.pdfMake && global.pdfMake.vfs;
        if (!vfs) throw new Error('HtmlForgeX Roboto font data is unavailable.');
        function face(name) {
            var encoded = vfs[name];
            if (!encoded) throw new Error('HtmlForgeX PDF font is unavailable: ' + name);
            var binary = atob(encoded), bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new global.OfficeIMO.PdfFont(bytes);
        }
        cachedFonts = { regular: face('Roboto-Regular.ttf'), bold: face('Roboto-Medium.ttf'),
            italic: face('Roboto-Italic.ttf'), boldItalic: face('Roboto-MediumItalic.ttf') };
        return cachedFonts;
    }
    function bindValues(conf, element, host) {
        var bindings = {}, metadata = conf.hfxOfficeIMOValues || {};
        Object.keys(metadata).forEach(function (row) {
            var original = conf.data ? conf.data[row] : element && element.tBodies[0] && element.tBodies[0].rows[row];
            if (!original) return;
            var cells = bindings[row] = {};
            var columns = conf.data ? (conf.columns || []).map(function (_column, index) {return index;}) : Object.keys(metadata[row]);
            columns.forEach(function (column) {
                var selector = conf.columns && conf.columns[column] && conf.columns[column].data != null ? conf.columns[column].data : Number(column);
                var originalColumn = !conf.data ? column : Array.isArray(original) ? selector : (conf.hfxOfficeIMOColumns || []).lastIndexOf(selector);
                var value = metadata[row][originalColumn];
                if (!value) return;
                var source = conf.data ? host.util.get(selector)(original) : original.cells[column] && original.cells[column].innerHTML.trim();
                // Object metadata describes literal generated fields, not nested or functional selectors.
                if (conf.data && !Array.isArray(original) && source !== original[selector]) return;
                cells[column] = {value:value, source:source, selector:conf.data ? selector : undefined, row:conf.data ? original : null, node:conf.data ? null : original};
            });
        });
        // DOM rows acquire their DataTables data arrays at ingestion, before user render/init callbacks.
        if (!conf.data && element && Object.keys(bindings).length) global.jQuery(element).one('preInit.dt.hfxOfficeIMO', function (_event, settings) {
            var table = new host.Api(settings);
            Object.keys(bindings).forEach(function (row) {
                Object.keys(bindings[row]).forEach(function (column) {
                    var binding = bindings[row][column];
                    if (table.row(Number(row)).node() === binding.node) binding.row = table.row(Number(row)).data();
                });
            });
        });
        return bindings;
    }
    function scalar(data, row, column, node, useRaw, table, bindings) {
        var originalColumn = table && table.colReorder ? table.colReorder.transpose(column, 'toOriginal') : column;
        var binding = bindings[row] && bindings[row][originalColumn];
        // Dynamic/replaced rows use their current data. Display renderers may redact an unchanged source;
        // only an explicit raw export opts into the original scalar in that case.
        if (binding && table && table.row(row).data() === binding.row && table.cell(row, column).data() === binding.source &&
            (binding.selector === undefined || table.column(column).dataSrc() === binding.selector) &&
            (useRaw || data === binding.source)) {
            var kind = binding.value[0], value = binding.value[1];
            var rawValue = kind === 'null' ? null : kind === 'number' ? Number(value) : kind === 'boolean' ? value === 'true' : kind === 'date' ? new Date(value) : value;
            var display = global.jQuery.fn.dataTable.Buttons.stripData(data, {stripHtml:true, stripNewlines:true, decodeEntities:true, trim:true});
            return new global.OfficeIMO.ExportCell(rawValue, {text: String(display == null ? '' : display)});
        }
        var root = node;
        if (!root && typeof data === 'string' && data.indexOf('<') !== -1) {
            root = document.createElement('template'); root.innerHTML = data; root = root.content;
        }
        if (useRaw && root && root.querySelector) {
            var raw = root.querySelector('[data-raw]');
            if (raw) return raw.getAttribute('data-raw');
        }
        return global.jQuery.fn.dataTable.Buttons.stripData(data, {stripHtml: true, stripNewlines: true, decodeEntities: true, trim: true});
    }
    function error(error) {
        console.error('HtmlForgeX OfficeIMO export failed.', error);
        // The event lets a host show its own message without replacing the export action.
        document.dispatchEvent(new CustomEvent('hfx:export-error', { detail: error }));
    }
    function dataTables(conf, element) {
        var host = global.jQuery && global.jQuery.fn.dataTable;
        if (!host) throw new Error('HtmlForgeX DataTables is unavailable.');
        // Lightweight definitions make Buttons available before its optional writer has been activated.
        ['Excel', 'Pdf'].forEach(function (kind) {
            var name = 'hfxOfficeimo' + kind;
            if (!host.ext.buttons[name]) host.ext.buttons[name] = {text:kind === 'Pdf' ? 'PDF' : kind, async:1};
        });
        var bindings = bindValues(conf, element, host);
        (conf.buttons || []).forEach(function (button) {
            var format = String(button.extend || '').toLowerCase().replace(/html5$/, '');
            if (['excel', 'pdf'].indexOf(format) < 0) return;
            if (button.action || button.customize || button.exportOptions && button.exportOptions.format && button.exportOptions.format.body)
                throw new Error('Native callbacks require DataTablesExportEngine.Legacy.');
            button.className = ((button.className || '') + ' buttons-' + format + ' buttons-html5').trim();
            button.extend = {excel: 'hfxOfficeimoExcel', pdf: 'hfxOfficeimoPdf'}[format];
            var tableApi, configuredFilename = button.filename;
            var exportOptions = Object.assign({orthogonal:'export'}, button.exportOptions);
            exportOptions.format = Object.assign({}, exportOptions.format, {body: function (data, row, column, node) {
                return scalar(data, row, column, node, conf.hfxExportRaw, tableApi, bindings);
            }});
            // Buttons passes this effective object to the canonical action, including its selectors and formatters.
            button.exportOptions = exportOptions;
            var options = { onError: error, exportOptions:exportOptions, filename:function (_configuration, table) {
                tableApi = table; return configuredFilename || '*';
            }};
            delete button.filename;
            if (format === 'excel') {
                var excel = button.hfxExcel || {};
                options.xlsx = {oversizedText:'preserve', dateMode:'utc', sheet:{name:excel.sheetName || 'Sheet1',
                    freezeHeader:!!excel.freezeHeader, autoFilter:!!excel.autoFilter, boldHeader:true}};
                // Buttons' '*' title resolves through exportInfo once the table exists.
                var configuredTitle = button.title;
                options.columnOptions = {};
                options.filename = function (configuration, table) {
                    tableApi = table;
                    return configuredFilename || '*';
                };
                // Native report layout is translated above; the writer owns worksheet layout.
                delete button.title;
                delete button.filename;
            } else if (format === 'pdf') {
                if (button.title === undefined) button.title = '*';
                options.pdf = {fontSize:10, pageSize:'A4', orientation:'portrait', wideTable:'fit'};
            }
            button.officeimo = options;
            button.action = function (event, table, node, configuration, complete) {
                var context = this;
                load('datatables', format === 'pdf').then(function () {
                    tableApi = table;
                    // Resolve host labels and selectors before OfficeIMO captures its immutable writer options.
                    if (format === 'excel') {
                        var effective = configuration.officeimo;
                        var info = table.buttons.exportInfo(Object.assign({}, configuration, {title:configuredTitle === undefined ? '*' : configuredTitle}));
                        effective.xlsx.sheet.title = info.title ? {text:info.title} : undefined;
                        Object.keys(effective.columnOptions).forEach(function (key) {delete effective.columnOptions[key];});
                        table.columns(effective.exportOptions.columns || '').indexes().toArray().forEach(function (source, position) {
                            var width = excel.widths && excel.widths[position + 1], fmt = excel.formats && excel.formats[position + 1];
                            if (width || fmt) effective.columnOptions[source] = Object.assign({}, width ? {width:width} : {}, fmt ? {format:fmt} : {});
                        });
                    }
                    if (!host.ext.buttons.officeimoExcel) global.OfficeIMO.registerDataTablesButtons(host);
                    if (format === 'pdf') configuration.officeimo.pdf.fonts = fonts();
                    host.ext.buttons[format === 'excel' ? 'officeimoExcel' : 'officeimoPdf'].action.call(context, event, table, node, configuration, complete);
                }).catch(function (failure) {error(failure); if (complete) complete();});
            };
        });
    }
    function canopy(root, buttons) {
        var tones = {success:{background:'#d1e7dd',color:'#0f5132'}, warning:{background:'#fff3cd',color:'#664d03'},
            danger:{background:'#f8d7da',color:'#842029'}, info:{background:'#cff4fc',color:'#055160'},
            muted:{background:'#e2e3e5',color:'#41464b'}, neutral:{background:'#f8f9fa',color:'#212529'}};
        var nativeMenu = root.getAttribute('data-hfx-cx-officeimo-menu') === 'native';
        var formats = buttons.map(function (button) {
            var extend = String(button.extend || '').toLowerCase();
            return extend.indexOf('excel') === 0 ? 'xlsx' : extend.indexOf('csv') === 0 ? 'csv' : 'pdf';
        });
        // Each provider closure travels with its native immutable capture and job lifetime, including concurrent calls.
        var providers = buttons.map(function (button, index) {
            var format = formats[index], unique = formats.filter(function (item) {return item === format;}).length === 1;
            // CanopyX reserves "csv" for its built-in writer; this optional provider must use its own identity.
            return {id:unique && format !== 'csv' ? format : 'hfx-' + format + '-' + index, label:button.text || (format === 'xlsx' ? 'Excel' : format.toUpperCase()), extension:format, showInMenu:nativeMenu,
                mime:format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : format === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf',
                write:async function (capture, context) {
                    try {
                        await load('canopyx', format === 'pdf');
                        if (context.signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
                        var options = {signal:context.signal, tones:tones, onProgress:function (event) {context.progress(event.rows);}};
                        var configuredTitle = button.title === undefined ? '*' : button.title;
                        var title = configuredTitle === '*' ? document.title : configuredTitle;
                        if (format === 'pdf') {
                            options.pdf = {fonts:fonts(), fontSize:10, wideTable:'fit', title:title || undefined};
                            // Printable fit wraps text independently of the browser grid's single-line layout.
                            options.columnOptions = {};
                            capture.request.columns.forEach(function (column) {options.columnOptions[column.id] = {wrapText:true};});
                        } else if (format === 'xlsx') {
                            var excel = button.hfxExcel || {};
                            options.xlsx = {oversizedText:'preserve', dateMode:'utc', sheet:{name:excel.sheetName || 'Sheet1', freezeHeader:!!excel.freezeHeader,
                                autoFilter:!!excel.autoFilter, boldHeader:true, title:title ? {text:title} : undefined}};
                            options.columnOptions = {};
                            capture.request.columns.forEach(function (column, position) {
                                var width = excel.widths && excel.widths[position + 1], fmt = excel.formats && excel.formats[position + 1];
                                if (width || fmt) options.columnOptions[column.id] = Object.assign({}, width ? {width:width} : {}, fmt ? {format:fmt} : {});
                            });
                        }
                        var blob = await global.OfficeIMO.exportCanopy(capture, format, options);
                        if (context.signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
                        var name = button.filename && button.filename !== '*' ? button.filename : context.fileName;
                        return new File([blob], name + '.' + format, {type:blob.type});
                    } catch (failure) {
                        if (failure.name === 'AbortError') throw failure;
                        error(failure);
                        throw new Error(root.getAttribute('data-hfx-cx-export-failed') || "Couldn't export this view.");
                    }
                }};
        });
        var configuration = {exportFormats:providers};
        if (nativeMenu) configuration.exportMenu = {csv:false,copy:true,values:root.getAttribute('data-hfx-cx-officeimo-values') === 'raw' ? 'raw' : 'display'};
        global.CanopyX.configure(root.getAttribute('data-hfx-canopyx'), configuration);
        if (nativeMenu) return;
        var toolbar = root.querySelector('[data-hfx-cx-document-exports]'), scope = toolbar.querySelector('select');
        var status = toolbar.querySelector('[data-hfx-cx-document-status]'), cancel = toolbar.querySelector('[data-hfx-cx-document-cancel]');
        var controls = toolbar.querySelectorAll('[data-hfx-cx-document-format]'), operation;
        cancel.addEventListener('click', function () {if (operation) operation.abort();});
        Array.prototype.forEach.call(controls, function (button) { button.addEventListener('click', function () {
            if (operation) return;
            var host = root.querySelector('[data-canopyx-host]'), grid = host && host.canopyx;
            if (!grid) {status.textContent = 'The grid is still loading.'; return;}
            var provider = providers[Number(button.getAttribute('data-hfx-cx-document-button'))];
            var controller = operation = new AbortController(); scope.disabled = true; cancel.hidden = false;
            Array.prototype.forEach.call(controls, function (control) {control.disabled = true;}); status.textContent = 'Preparing export...';
            Promise.resolve().then(function () {return grid.exportAs(provider.id, {
                scope:scope.value, values:root.getAttribute('data-hfx-cx-officeimo-values') === 'raw' ? 'raw' : 'display', signal:controller.signal,
                onProgress:function (event) {if (operation === controller) status.textContent = event.completed + (event.total == null ? ' records' : ' of ' + event.total + ' records');}});})
                .then(function () {status.textContent = 'Export ready.';}, function (failure) {
                    status.textContent = failure.name === 'AbortError' ? 'Export cancelled.' : root.getAttribute('data-hfx-cx-export-failed');
                }).finally(function () {operation = null; scope.disabled = false;
                    var returnFocus = controller.signal.aborted || document.activeElement === cancel; cancel.hidden = true;
                    Array.prototype.forEach.call(controls, function (control) {control.disabled = false;}); if (returnFocus) button.focus();});
        }); });
    }
    async function explorer(capture, format, signal) {
        await load('canopyx', format === 'pdf');
        if (signal && signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
        // The report's projected cells carry resolved text. Rich presenters degrade explicitly to that text;
        // OfficeIMO remains the only writer and owns CSV escaping and formula safety.
        var options = {signal:signal, unsupportedPresentation:'text'};
        if (format === 'pdf') options.pdf = {fonts:fonts(),fontSize:10,wideTable:'fit'};
        if (format === 'xlsx') options.xlsx = {oversizedText:'preserve',dateMode:'utc',sheet:{name:'Sheet1',freezeHeader:true,autoFilter:true,boldHeader:true}};
        return global.OfficeIMO.exportCanopy(capture, format, options);
    }
    global.hfxOfficeIMO = {dataTables:dataTables, canopy:canopy, explorer:explorer, fonts:fonts};
})(typeof window === 'undefined' ? globalThis : window);
