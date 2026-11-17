(function (global) {
    'use strict';

    var excelCellTextLimit = 32767;
    var excelEscapedControlPattern = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
    var ooxmlEscapePattern = /_[xX][0-9A-Fa-f]{4}_/g;

    function encodeOoxmlText(value) {
        return String(value == null ? '' : value)
            .replace(ooxmlEscapePattern, function (match) { return '_x005F_' + match.slice(1); })
            .replace(excelEscapedControlPattern, function (character) {
                return '_x' + character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') + '_';
            });
    }

    function decodeOoxmlText(value) {
        var text = String(value == null ? '' : value);
        var result = '';
        var offset = 0;
        var token = /_[xX]([0-9A-Fa-f]{4})_/g;
        var match;
        while ((match = token.exec(text)) !== null) {
            result += text.slice(offset, match.index);
            var code = parseInt(match[1], 16);
            var escapedToken = text.slice(token.lastIndex).match(/^[xX][0-9A-Fa-f]{4}_/);
            if (code === 0x005F && escapedToken) {
                result += '_' + escapedToken[0];
                token.lastIndex += escapedToken[0].length;
            } else {
                result += String.fromCharCode(code);
            }
            offset = token.lastIndex;
        }
        return result + text.slice(offset);
    }

    function xmlEscape(value) {
        return encodeOoxmlText(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function splitText(value) {
        var text = String(value == null ? '' : value);
        var chunks = [];
        var offset = 0;
        while (offset < text.length) {
            var end = Math.min(offset + excelCellTextLimit, text.length);
            if (end < text.length) {
                var last = text.charCodeAt(end - 1);
                var next = text.charCodeAt(end);
                if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--;
            }
            chunks.push(text.slice(offset, end));
            offset = end;
        }
        return chunks;
    }

    function inlineStringCell(reference, value) {
        return '<c r="' + reference + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) + '</t></is></c>';
    }

    function resolveOverflowSheetName($, workbook) {
        var used = {};
        $('sheets sheet', workbook).each(function () {
            used[String($(this).attr('name') || '').toLowerCase()] = true;
        });
        var base = 'Export Overflow';
        var candidate = base;
        var suffix = 2;
        while (used[candidate.toLowerCase()]) candidate = base + ' ' + suffix++;
        return candidate;
    }

    function nextWorksheetFileName(worksheets) {
        var index = 1;
        while (Object.prototype.hasOwnProperty.call(worksheets, 'sheet' + index + '.xml')) index++;
        return 'sheet' + index + '.xml';
    }

    function nextRelationshipId($, relationships) {
        var used = {};
        $('Relationship', relationships).each(function () {
            used[String($(this).attr('Id') || '')] = true;
        });
        var index = 1;
        while (used['rId' + index]) index++;
        return 'rId' + index;
    }

    function resolveWorksheetNames($, workbook, relationships) {
        var relationshipTargets = {};
        $('Relationship', relationships).each(function () {
            var id = String($(this).attr('Id') || '');
            var target = String($(this).attr('Target') || '').replace(/\\/g, '/');
            if (!id || !target) return;
            var segments = target.split('/');
            relationshipTargets[id] = segments[segments.length - 1];
        });

        var names = {};
        var relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        $('sheets sheet', workbook).each(function () {
            var relationshipId = this.getAttributeNS(relationshipNamespace, 'id') || this.getAttribute('r:id');
            var worksheetKey = relationshipTargets[String(relationshipId || '')];
            var worksheetName = String($(this).attr('name') || '');
            if (worksheetKey && worksheetName) names[worksheetKey] = worksheetName;
        });
        return names;
    }

    function replaceCellValue(cell, value) {
        if (!cell || !cell.ownerDocument) return;
        var document = cell.ownerDocument;
        var namespace = cell.namespaceURI || document.documentElement.namespaceURI;
        while (cell.firstChild) cell.removeChild(cell.firstChild);
        cell.setAttribute('t', 'inlineStr');

        var inlineString = document.createElementNS(namespace, 'is');
        var text = document.createElementNS(namespace, 't');
        text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        text.textContent = encodeOoxmlText(value);
        inlineString.appendChild(text);
        cell.appendChild(inlineString);
    }

    function getElementsByLocalName(root, localName) {
        if (!root) return [];
        if (typeof root.getElementsByTagNameNS === 'function') {
            var namespaced = root.getElementsByTagNameNS('*', localName);
            if (namespaced && namespaced.length) return namespaced;
        }
        return typeof root.getElementsByTagName === 'function'
            ? root.getElementsByTagName(localName)
            : [];
    }

    function directChildElement(container, localName) {
        if (!container) return null;
        for (var index = 0; index < container.childNodes.length; index++) {
            var child = container.childNodes[index];
            if (elementName(child) === localName) return child;
        }
        return null;
    }

    function directChildText(container, localName) {
        var child = directChildElement(container, localName);
        return child ? child.textContent || '' : '';
    }

    function resolveSharedStringItem(sharedStringItems, cell) {
        if (!sharedStringItems) return null;
        var indexText = directChildText(cell, 'v');
        var index = parseInt(indexText, 10);
        if (isNaN(index) || index < 0) return null;
        return sharedStringItems[index] || null;
    }

    function elementName(node) {
        var name = node && (node.localName || node.nodeName) || '';
        var separator = name.indexOf(':');
        return separator >= 0 ? name.slice(separator + 1) : name;
    }

    function readSpreadsheetString(container) {
        if (!container) return '';
        var value = '';
        for (var index = 0; index < container.childNodes.length; index++) {
            var child = container.childNodes[index];
            var name = elementName(child);
            if (name === 't') {
                value += child.textContent || '';
            } else if (name === 'r') {
                for (var runIndex = 0; runIndex < child.childNodes.length; runIndex++) {
                    var runChild = child.childNodes[runIndex];
                    if (elementName(runChild) === 't') value += runChild.textContent || '';
                }
            }
        }
        return value;
    }

    function resolveInlineStringContainer(cell) {
        if (!cell) return null;
        for (var index = 0; index < cell.childNodes.length; index++) {
            if (elementName(cell.childNodes[index]) === 'is') return cell.childNodes[index];
        }
        return null;
    }

    function readSharedStringValue(sharedStringItems, cell) {
        var item = resolveSharedStringItem(sharedStringItems, cell);
        return item ? decodeOoxmlText(readSpreadsheetString(item)) : null;
    }

    function containsRawExcelControl(value) {
        return /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/.test(value || '');
    }

    function replaceSharedStringValue(item, value) {
        if (!item || !item.ownerDocument) return;
        var document = item.ownerDocument;
        var namespace = item.namespaceURI || document.documentElement.namespaceURI;
        while (item.firstChild) item.removeChild(item.firstChild);
        var text = document.createElementNS(namespace, 't');
        text.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        text.textContent = encodeOoxmlText(value);
        item.appendChild(text);
    }

    function readCellValue(sharedStringItems, cell) {
        var cellType = String(cell.getAttribute('t') || '').toLowerCase();
        if (cellType === 's') return readSharedStringValue(sharedStringItems, cell);
        var inlineString = resolveInlineStringContainer(cell);
        if (inlineString) return decodeOoxmlText(readSpreadsheetString(inlineString));
        if (cellType !== '' && cellType !== 'n' && cellType !== 'str') return null;
        var valueNode = directChildElement(cell, 'v');
        if (!valueNode) return null;
        return decodeOoxmlText(valueNode.textContent || '');
    }

    function encodeExportValue(value) {
        return typeof value === 'string' ? encodeOoxmlText(value) : value;
    }

    function encodeExportStructure(structure) {
        if (!Array.isArray(structure)) return;
        structure.forEach(function (row) {
            if (!Array.isArray(row)) return;
            row.forEach(function (cell) {
                if (cell && Object.prototype.hasOwnProperty.call(cell, 'title')) {
                    cell.title = encodeExportValue(cell.title);
                }
            });
        });
    }

    function encodeExportData(data) {
        if (!data) return;
        ['header', 'footer'].forEach(function (name) {
            if (Array.isArray(data[name])) data[name] = data[name].map(encodeExportValue);
        });
        if (Array.isArray(data.body)) {
            data.body.forEach(function (row) {
                if (!Array.isArray(row)) return;
                for (var index = 0; index < row.length; index++) row[index] = encodeExportValue(row[index]);
            });
        }
        encodeExportStructure(data.headerStructure);
        encodeExportStructure(data.footerStructure);
    }

    function documentTitle() {
        var title = global.document && global.document.querySelector
            ? global.document.querySelector('head > title')
            : null;
        return title && title.textContent ? title.textContent : 'Exported data';
    }

    function tableCaption(dt, side) {
        try {
            var $ = global.jQuery || global.$;
            var container = dt && dt.table && typeof dt.table === 'function' ? dt.table().container() : null;
            var caption = $ && container ? $('caption', container).first() : null;
            if (!caption || !caption.length || caption.css('caption-side') !== side) return null;
            return caption.text();
        } catch (_) {
            return null;
        }
    }

    function protectExportInfoOption(button, name, defaultValue, captionSide) {
        var configured = Object.prototype.hasOwnProperty.call(button, name) ? button[name] : defaultValue;
        button[name] = function (config, dt) {
            var value = typeof configured === 'function' ? configured.apply(this, arguments) : configured;
            if (value == null) return value;
            if (name === 'title' && typeof value === 'string' && value.indexOf('*') >= 0) {
                value = value.replace(/\*/g, documentTitle());
            } else if (captionSide && value === '*') {
                value = tableCaption(dt, captionSide);
            }
            return encodeExportValue(value);
        };
    }

    function protectExportInfo(button) {
        protectExportInfoOption(button, 'title', '*', null);
        protectExportInfoOption(button, 'messageTop', '*', 'top');
        protectExportInfoOption(button, 'messageBottom', '*', 'bottom');
    }

    function appendOverflowWorksheet($, xlsx, sheetName, overflow) {
        var worksheets = xlsx.xl.worksheets;
        var workbook = xlsx.xl['workbook.xml'];
        var relationships = xlsx.xl._rels && xlsx.xl._rels['workbook.xml.rels'];
        var contentTypes = xlsx['[Content_Types].xml'];
        if (!worksheets || !workbook || !relationships || !contentTypes || typeof $.parseXML !== 'function') return false;

        var worksheetFile = nextWorksheetFileName(worksheets);
        var relationshipId = nextRelationshipId($, relationships);
        var sheets = workbook.getElementsByTagNameNS(workbook.documentElement.namespaceURI, 'sheets')[0];
        if (!sheets) return false;
        var sheetId = 1;
        $('sheets sheet', workbook).each(function () {
            var current = parseInt($(this).attr('sheetId'), 10);
            if (!isNaN(current) && current >= sheetId) sheetId = current + 1;
        });

        var rows = [];
        rows.push('<row r="1">' +
            inlineStringCell('A1', 'Source Worksheet') +
            inlineStringCell('B1', 'Source Cell') +
            inlineStringCell('C1', 'Chunk') +
            inlineStringCell('D1', 'Total Chunks') +
            inlineStringCell('E1', 'Complete Value (concatenate chunks in order)') +
            '</row>');

        var rowNumber = 2;
        overflow.forEach(function (entry) {
            entry.chunks.forEach(function (chunk, chunkIndex) {
                rows.push('<row r="' + rowNumber + '">' +
                    inlineStringCell('A' + rowNumber, entry.worksheet) +
                    inlineStringCell('B' + rowNumber, entry.cell) +
                    inlineStringCell('C' + rowNumber, String(chunkIndex + 1)) +
                    inlineStringCell('D' + rowNumber, String(entry.chunks.length)) +
                    inlineStringCell('E' + rowNumber, chunk) +
                    '</row>');
                rowNumber++;
            });
        });

        var worksheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
            rows.join('') + '</sheetData></worksheet>';
        worksheets[worksheetFile] = $.parseXML(worksheetXml);

        var relationship = relationships.createElementNS(relationships.documentElement.namespaceURI, 'Relationship');
        relationship.setAttribute('Id', relationshipId);
        relationship.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');
        relationship.setAttribute('Target', 'worksheets/' + worksheetFile);
        relationships.documentElement.appendChild(relationship);

        var sheet = workbook.createElementNS(workbook.documentElement.namespaceURI, 'sheet');
        sheet.setAttribute('name', sheetName);
        sheet.setAttribute('sheetId', String(sheetId));
        sheet.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:id', relationshipId);
        sheets.appendChild(sheet);

        var override = contentTypes.createElementNS(contentTypes.documentElement.namespaceURI, 'Override');
        override.setAttribute('PartName', '/xl/worksheets/' + worksheetFile);
        override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
        contentTypes.documentElement.appendChild(override);
        return true;
    }

    function sanitizeWorkbook(xlsx) {
        var $ = global.jQuery || global.$;
        if (!$ || !xlsx || !xlsx.xl || !xlsx.xl.worksheets || !xlsx.xl['workbook.xml']) return 0;

        var workbook = xlsx.xl['workbook.xml'];
        var relationships = xlsx.xl._rels && xlsx.xl._rels['workbook.xml.rels'];
        if (!relationships) return 0;
        var sheetName = resolveOverflowSheetName($, workbook);
        var worksheetNames = resolveWorksheetNames($, workbook, relationships);
        var overflow = [];
        var normalizations = [];
        var referencedSharedStrings = new Set();
        var sharedStrings = xlsx.xl['sharedStrings.xml'];
        var sharedStringItems = sharedStrings ? getElementsByLocalName(sharedStrings, 'si') : null;
        Object.keys(xlsx.xl.worksheets).forEach(function (worksheetKey) {
            var worksheet = xlsx.xl.worksheets[worksheetKey];
            var cells = getElementsByLocalName(worksheet, 'c');
            for (var cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                var cell = cells[cellIndex];
                var value = readCellValue(sharedStringItems, cell);
                if (value == null) continue;

                var cellType = String(cell.getAttribute('t') || '').toLowerCase();
                var sharedStringItem = cellType === 's' ? resolveSharedStringItem(sharedStringItems, cell) : null;
                if (sharedStringItem) referencedSharedStrings.add(sharedStringItem);
                var inlineString = resolveInlineStringContainer(cell);
                var rawValue = sharedStringItem
                    ? readSpreadsheetString(sharedStringItem)
                    : (inlineString ? readSpreadsheetString(inlineString) : directChildText(cell, 'v'));
                if (value.length <= excelCellTextLimit) {
                    if (containsRawExcelControl(rawValue)) {
                        normalizations.push({ cellNode: cell, sharedStringItem: sharedStringItem, value: value });
                    }
                    continue;
                }

                var reference = String(cell.getAttribute('r') || 'unknown');
                overflow.push({
                    worksheet: worksheetNames[worksheetKey] || worksheetKey,
                    cell: reference,
                    chunks: splitText(value),
                    cellNode: cell,
                    sharedStringItem: sharedStringItem,
                    valueLength: value.length
                });
            }
        });

        if (sharedStringItems) {
            for (var sharedIndex = 0; sharedIndex < sharedStringItems.length; sharedIndex++) {
                var sharedStringItem = sharedStringItems[sharedIndex];
                if (referencedSharedStrings.has(sharedStringItem)) continue;
                var rawValue = readSpreadsheetString(sharedStringItem);
                var value = decodeOoxmlText(rawValue);
                if (value.length > excelCellTextLimit) {
                    overflow.push({
                        worksheet: 'Shared Strings',
                        cell: 'Index ' + sharedIndex,
                        chunks: splitText(value),
                        cellNode: null,
                        sharedStringItem: sharedStringItem,
                        valueLength: value.length
                    });
                } else if (containsRawExcelControl(rawValue)) {
                    normalizations.push({ cellNode: null, sharedStringItem: sharedStringItem, value: value });
                }
            }
        }

        if (overflow.length && !appendOverflowWorksheet($, xlsx, sheetName, overflow)) return 0;
        normalizations.forEach(function (entry) {
            if (entry.cellNode) replaceCellValue(entry.cellNode, entry.value);
            if (entry.sharedStringItem) replaceSharedStringValue(entry.sharedStringItem, entry.value);
        });
        var sanitizedSharedStrings = new Set();
        overflow.forEach(function (entry) {
            if (entry.cellNode) {
                replaceCellValue(entry.cellNode, '[Complete ' + entry.valueLength + '-character value is in "' + sheetName + '" for ' + entry.worksheet + '!' + entry.cell + ' (' + entry.chunks.length + ' chunks).]');
            }
            if (entry.sharedStringItem && !sanitizedSharedStrings.has(entry.sharedStringItem)) {
                replaceSharedStringValue(entry.sharedStringItem, '[Complete oversized shared string is preserved in "' + sheetName + '".]');
                sanitizedSharedStrings.add(entry.sharedStringItem);
            }
        });
        return overflow.length;
    }

    function protectExportButtons(conf) {
        var btns = conf && conf.buttons;
        if (!btns) return;
        var list = Array.isArray(btns) ? btns : (btns.buttons || []);
        list.forEach(function (button) {
            if (!button || button.__hfxExcelCellLimitProtected) return;
            var extend = String(button.extend || '').toLowerCase();
            if (extend !== 'excel' && extend !== 'excelhtml5') return;

            protectExportInfo(button);
            button.exportOptions = button.exportOptions || {};
            var userCustomizeData = typeof button.exportOptions.customizeData === 'function'
                ? button.exportOptions.customizeData
                : null;
            button.exportOptions.customizeData = function (data) {
                var result;
                if (userCustomizeData) result = userCustomizeData.apply(this, arguments);
                encodeExportData(data);
                return result;
            };

            var userCustomize = typeof button.customize === 'function' ? button.customize : null;
            button.customize = function (xlsx) {
                var result;
                try {
                    if (userCustomize) result = userCustomize.apply(this, arguments);
                } finally {
                    sanitizeWorkbook(xlsx);
                }
                return result;
            };
            button.__hfxExcelCellLimitProtected = true;
        });
    }

    global.hfxDtExcel = {
        protectExportButtons: protectExportButtons
    };
})(window);
