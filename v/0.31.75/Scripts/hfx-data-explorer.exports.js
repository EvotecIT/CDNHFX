// HtmlForgeX explorer exports: query snapshots, scoped files and clipboard records.
(function () {
  window.HfxDataExplorerExports = { install: function (context) {
    var Explorer = context.Explorer, Data = context.Data, I = context.I, el = context.el, attr = context.attr;
    var fmt = context.fmt, num = context.num, pad = context.pad, dict = context.dict, EXPORT_PAGE = 1000, toCsv = I.toCsv;
    window.HfxDataExplorerExportQuery.install(context);
  // ---------------------------------------------------------------- exports
  function download(name, mime, parts) {
    var blob = new Blob(parts, { type: mime });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob, name); return; }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function writeClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
      var previous = document.activeElement, box = el('textarea');
      box.value = text; box.style.position = 'fixed'; box.style.left = '-10000px';
      document.body.appendChild(box);
      try {
        box.select();
        if (!document.execCommand('copy')) throw new Error('The browser did not allow clipboard access.');
      } finally { box.remove(); if (previous && previous.isConnected) previous.focus(); }
      return Promise.resolve();
    } catch (error) { return Promise.reject(error); }
  }

  Explorer.prototype.exportName = function (ext) {
    var d = new Date();
    var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    var base = this.cfg.exportName || (this.ds.id + (this.state.view ? '-' + this.state.view : ''));
    return base.replace(/[^\w.-]+/g, '-') + '-' + stamp + '.' + ext;
  };

  Explorer.prototype.renderExportPanel = function (panel) {
    var self = this, labels = this.labels, ex = this.cfg.exports || [];
    function item(text, fn) { var b = el('button', 'hfx-dx-menuitem', text); attr(b, 'type', 'button'); b.addEventListener('click', fn); panel.appendChild(b); return b; }
    // The note of the open panel: an export that is still running reports there, also after the menu was reopened.
    var note = el('p', 'hfx-dx-note', this.exportMessage || fmt(labels.count, { shown: num(this.size()), total: this.totalRowsLabel() }));
    attr(note, 'role', 'status');
    panel.appendChild(note);
    this.exportNote = note;
    var scopeLabel = el('label', 'hfx-dx-export-scope', labels.exportScope), scope = el('select', 'hfx-dx-input');
    attr(scope, 'aria-label', labels.exportScope);
    [['filtered', labels.exportFiltered], ['selected', labels.exportSelected], ['all', labels.exportAll]].forEach(function (value) {
      if (value[0] === 'selected' && !self.cfg.selectedRowExports) return;
      var option = el('option', '', value[1]); option.value = value[0];
      option.disabled = value[0] === 'selected' && !(self.cfg.selectedRowExports && self.renderer && self.renderer.getSelection);
      scope.appendChild(option);
    });
    scope.value = this.exportScope || 'filtered';
    scope.addEventListener('change', function () { self.exportScope = scope.value; });
    scopeLabel.appendChild(scope); panel.appendChild(scopeLabel);
    if (ex.indexOf('csv') >= 0 && !this.cfg.officeIMOExports) item(labels.exportCsv, function () {
      if (self.exporting) { self.exportSay(labels.exportBusy, true); return; }
      var capture = self.tryCaptureExport(scope.value, 'CSV');
      if (!capture) return;
      if (self.remote) { self.exportRemoteCsv(capture); return; }
      download(capture.name, 'text/csv;charset=utf-8', ['\uFEFF' + toCsv(capture.columns, capture.rows, capture.labels)]); self.closeMenus();
    });
    if (ex.indexOf('copy') >= 0) item(labels.copyRows, function () { self.copyRows(scope.value); });
    if (this.cfg.officeIMOExports) ['xlsx', 'csv', 'pdf'].forEach(function (format) {
      item(format === 'csv' ? labels.exportCsv : fmt(labels.exportFile, {format:format.toUpperCase()}), function () { self.exportOfficeIMO(format, scope.value); });
    });
    // Hosted downloads retain their own endpoint contract. Browser-side OfficeIMO owns its configured formats.
    this.hostFormats().forEach(function (format) {
      if (self.cfg.officeIMOExports && ['xlsx', 'csv', 'pdf'].indexOf(format) >= 0) return;
      item(fmt(labels.exportFile || 'Download {format}', { format: String(format).toUpperCase() }), function () { self.exportHost(format, scope.value); });
    });
    if (ex.indexOf('definition') >= 0) {
      var box = el('textarea', 'hfx-dx-definition'); attr(box, 'readonly', 'readonly'); attr(box, 'rows', '8'); attr(box, 'aria-label', labels.exportDefinition);
      try { box.value = JSON.stringify(this.definition(), null, 2); }
      catch (error) { self.exportSay(error.message, true); return; }
      panel.appendChild(el('p', 'hfx-dx-colgroup', labels.exportDefinition));
      panel.appendChild(box);
      item(labels.copy, function () {
        writeClipboard(box.value).then(function () { if (!self.destroyed) self.exportSay(labels.copied); },
          function (error) { if (!self.destroyed) self.exportSay(fmt(labels.copyError, {reason:error.message})); });
      });
      panel.classList.add('is-wide');
    }
  };

  Explorer.prototype.tryCaptureExport = function (scope, format) {
    try { return this.captureExport(scope); }
    catch (error) { this.exportSay(this.labels.exportFailed); return null; }
  };

  Explorer.prototype.exportOfficeIMO = function (format, scope) {
    if (this.destroyed) return;
    var self = this, labels = this.labels, upper = format.toUpperCase();
    if (this.exporting) { this.exportSay(labels.exportBusy, true); return; }
    var capture = this.tryCaptureExport(scope, upper);
    if (!capture) return;
    var abort = this.exportAbort = new AbortController();
    this.exporting = true;
    this.exportSay(fmt(labels.exportPreparing, {format:upper}), true);
    Promise.resolve().then(function () {
      if (!self.renderer || !self.renderer.prepareExport || !window.hfxOfficeIMO)
        throw new Error('OfficeIMO exports are unavailable.');
      return window.hfxOfficeIMO.explorer(self.renderer.prepareExport(capture, abort.signal), format, abort.signal);
    }).then(function (blob) {
      if (self.destroyed || abort.signal.aborted) return;
      download(capture.name.slice(0, -4) + '.' + format, blob.type, [blob]);
      self.exportSay(fmt(labels.count, {shown:num(self.size()),total:num(self.totalRows())}));
      self.closeMenus();
    }).catch(function (failure) {
      if (!self.destroyed && !abort.signal.aborted) self.exportSay(labels.exportFailed);
    }).then(function () {
      if (self.exportAbort === abort) self.exportAbort = null;
      self.exporting = false;
    });
  };

  Explorer.prototype.copyRows = function (scope) {
    var self = this, labels = this.labels;
    if (this.exporting) { this.exportSay(labels.exportBusy, true); return; }
    var capture = this.tryCaptureExport(scope, labels.copyRows);
    if (!capture) return;
    this.exporting = true;
    var records;
    try {
      if (this.remote) records = this.collectExport(capture, 10000, true, '\t').then(function (result) { return result.parts.join(''); });
      else {
        if (capture.rows.length > 10000) throw new Error('Copy at most 10,000 rows; use a file export for larger results.');
        records = [I.csvHeader(capture.columns, capture.labels, '\t')].concat(I.csvLines(capture.columns, capture.rows, '\t')).join('\r\n') + '\r\n';
      }
    } catch (error) { records = Promise.reject(error); }
    // Local clipboard access starts within the click gesture. Remote queries may require clipboard permission.
    (typeof records === 'string' ? writeClipboard(records) : records.then(function (text) {
      if (self.destroyed || capture.seq !== self.seq) throw new DOMException('Cancelled', 'AbortError');
      return writeClipboard(text);
    })).then(function () { if (!self.destroyed) self.exportSay(labels.copied); }, function (error) {
      if (!self.destroyed) self.exportSay(fmt(labels.copyError, {reason:error.message}));
    }).then(function () { self.exporting = false; });
  };

  // The formats the host renders, offered only where a host can answer: a page served over HTTP(S).
  Explorer.prototype.hostFormats = function () {
    var host = this.cfg.hostExport;
    if (!host || !host.href || !host.formats || !host.formats.length) return [];
    return /^https?:$/.test(location.protocol) ? host.formats : [];
  };

  // What an export says: in the note of the export panel that is open now, and kept for the next one while it runs.
  Explorer.prototype.exportSay = function (text, running) {
    this.exportMessage = running ? text : null;
    if (this.exportNote) this.exportNote.textContent = text;
  };

  // A file the host renders: the current view goes to the export endpoint as a query (its columns, filters, search,
  // sort, column labels and row limit), with the page's antiforgery token, and the answer is downloaded under the name
  // the host gives it. Only an endpoint of the page's own site is asked, so the token never leaves it.
  Explorer.prototype.exportHost = function (format, scope) {
    if (this.destroyed) return;
    var self = this, labels = this.labels, host = this.cfg.hostExport, upper = String(format).toUpperCase();
    if (this.exporting) { this.exportSay(labels.exportBusy || 'An export is already running.', true); return; }
    var url;
    try { url = new URL(String(host.href).replace(/\{(id|dataset)\}/g, encodeURIComponent(this.ds.id)), document.baseURI); } catch (_) { url = null; }
    if (!url || url.origin !== location.origin) {
      this.exportSay(fmt(labels.exportError, { format: upper, reason: 'The export address is not on this site.' }));
      return;
    }
    var capture = this.tryCaptureExport(scope, upper);
    if (!capture) return;
    var query = capture.query;
    var headers = { 'Content-Type': 'application/json', 'Accept': '*/*' };
    var token = document.querySelector('meta[name="csrf-token"]');
    if (token && token.getAttribute('content')) headers['X-CSRF-Token'] = token.getAttribute('content');
    var abort = this.exportAbort = new AbortController();
    this.exporting = true;
    this.exportSay(fmt(labels.exportPreparing || '…', { format: upper }), true);
    // A redirect (a sign-in page after the session ended) is never saved as the file.
    fetch(url.href, { method: 'POST', credentials: 'same-origin', redirect: 'error', headers: headers, body: JSON.stringify({ format: format, query: query }), signal: abort.signal })
      .then(function (response) {
        if (self.destroyed || abort.signal.aborted) return;
        var type = (response.headers.get('Content-Type') || '').toLowerCase();
        if (!response.ok || type.indexOf('text/html') === 0 || type.indexOf('application/json') === 0) {
          return response.text().then(function (text) {
            var message = '';
            try { var parsed = JSON.parse(text); message = (parsed && (parsed.message || parsed.error)) || ''; } catch (_) { }
            throw new Error(message || 'The server answered ' + response.status + '.');
          });
        }
        return response.blob().then(function (blob) {
          if (self.destroyed || abort.signal.aborted) return;
          download(fileNameOf(response.headers.get('Content-Disposition'), format) || capture.name.slice(0,-4) + '.' + format, blob.type || 'application/octet-stream', [blob]);
          self.exportSay(fmt(labels.count, { shown: num(self.size()), total: self.totalRowsLabel() }));
        });
      })
      .then(null, function (err) { if (!self.destroyed && !abort.signal.aborted) self.exportSay(fmt(labels.exportError, { format: upper, reason: err && err.message ? err.message : '' }).trim()); })
      .then(function () { if (self.exportAbort === abort) self.exportAbort = null; self.exporting = false; });
  };

  // The file name of a download from Content-Disposition: its last part only, without control, direction and
  // reserved characters, ending with the extension of the format asked for.
  function fileNameOf(header, format) {
    if (!header) return null;
    var star = /filename\*\s*=\s*UTF-8''([^;\s]+)/i.exec(header), quoted = /filename\s*=\s*"([^"]*)"/i.exec(header), plain = /filename\s*=\s*([^;"\s][^;]*)/i.exec(header), name = null;
    try { name = star ? decodeURIComponent(star[1]) : null; } catch (_) { name = null; }
    if (!name) name = quoted ? quoted[1] : plain ? plain[1] : null;
    if (!name) return null;
    name = name.split(/[\\\/]/).pop()
      .replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]+/g, '')
      .replace(/[:*?"<>|]+/g, '-').replace(/^[.\s]+/, '').replace(/[.\s]+$/, '').slice(0, 120);
    if (!name) return null;
    var ext = '.' + String(format || '').toLowerCase();
    if (ext.length > 1 && name.toLowerCase().slice(-ext.length) !== ext) name += ext;
    return name;
  }

  // Fetch the captured query page by page, bounded independently of the viewport cache.
  Explorer.prototype.collectExport = function (capture, cap, requireComplete, separator) {
    var self = this, cols = capture.columns, labels = this.labels;
    var parts = ['' + I.csvHeader(cols, capture.labels, separator) + '\r\n'], done = 0, after = null, wanted = null;
    var signal = this.abort ? this.abort.signal : undefined, cursors = new Set();
    var viewLimit = capture.spec.limit > 0 ? capture.spec.limit : Infinity;
    cap = Math.min(cap, viewLimit);
    function guard() {
      if (self.destroyed || capture.seq !== self.seq || signal && signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    }
    function finish() { guard(); return {parts:parts,done:done,total:wanted}; }
    function step() {
      guard();
      if (wanted !== null && done >= Math.min(cap, wanted)) return finish();
      var spec = JSON.parse(JSON.stringify(capture.spec));
      spec.limit = Math.min(EXPORT_PAGE, cap - done);
      spec.offset = done;
      if (after) spec.after = after;
      return self.remote.query(spec, {signal:signal}).then(function (res) {
        guard();
        var total = Math.min(res.total, viewLimit);
        if (wanted === null) wanted = total;
        if (requireComplete && wanted > cap) throw new Error('Copy at most 10,000 rows; use a file export for larger results.');
        if (total !== wanted || res.offset !== done || res.count > spec.limit) throw new Error('The export data changed; try again.');
        var pageCols = cols.map(function (c) {
          var found = res.dataset.column(c.id);
          if (!found) throw new Error('An export column is missing from the response.');
          return found;
        }), rows = [];
        for (var r = 0; r < res.count; r++) rows.push(r);
        if (rows.length) parts.push(I.csvLines(pageCols, rows, separator).join('\r\n') + '\r\n');
        done += res.count;
        if (done >= Math.min(cap, wanted)) return finish();
        if (!res.count || !res.next || cursors.has(res.next)) throw new Error('The export response did not continue through the results.');
        after = res.next; cursors.add(after);
        self.exportSay(fmt(labels.loadingProgress || labels.loading, {loaded:num(done),rows:num(Math.min(cap,wanted))}), true);
        return step();
      });
    }
    return Promise.resolve().then(step);
  };

  Explorer.prototype.exportRemoteCsv = function (capture) {
    if (this.exporting) { this.exportSay(this.labels.exportBusy, true); return; }
    capture = capture || this.tryCaptureExport('filtered', 'CSV');
    if (!capture) return;
    var self = this, cap = this.cfg.remoteExportRows > 0 ? this.cfg.remoteExportRows : 50000;
    this.exporting = true;
    this.collectExport(capture, cap, false, ',').then(function (result) {
      if (self.destroyed || capture.seq !== self.seq) throw new DOMException('Cancelled', 'AbortError');
      download(capture.name, 'text/csv;charset=utf-8', ['\uFEFF'].concat(result.parts));
      var truncated = result.done < result.total;
      // A truncation reports the known file-result size. A completed scoped export keeps the view-population count.
      var total = !truncated && self.scopeFilters && self.scopeFilters().length ? self.totalRowsLabel() : num(result.total);
      self.exportSay(fmt(truncated ? self.labels.exportTruncated : self.labels.count, {shown:num(result.done),total:total}));
    }).catch(function (error) { if (!self.destroyed) self.exportSay(self.errorText(error)); })
    .then(function () { self.exporting = false; });
  };
  }};
})();
