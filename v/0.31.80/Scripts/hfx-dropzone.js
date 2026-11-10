(function () {
  'use strict';

  // Async upload feature flags (must match DropzoneUploadFeatures enum)
  var DZ_UPLOAD_AUTOSTART = 1 << 0;
  var DZ_UPLOAD_SHOW_PROGRESS = 1 << 1;
  var DZ_UPLOAD_REDIRECT_ON_SUCCESS = 1 << 2;
  var DZ_UPLOAD_DISABLE_DURING_UPLOAD = 1 << 3;
  var DZ_UPLOAD_RESET_ON_SUCCESS = 1 << 4;
  var DZ_UPLOAD_INCLUDE_FORM_FIELDS = 1 << 5;
  var DZ_UPLOAD_ALLOW_CANCEL = 1 << 6;

  function parseIntAttr(el, name) {
    if (!el) return null;
    var raw = el.getAttribute(name);
    if (!raw) return null;
    var n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }

  function formatBytes(bytes) {
    var b = Number(bytes);
    if (!isFinite(b) || b < 0) return '';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var u = 0;
    while (b >= 1024 && u < units.length - 1) { b = b / 1024; u++; }
    var digits = u === 0 ? 0 : (b >= 10 ? 1 : 2);
    return b.toFixed(digits) + ' ' + units[u];
  }

  function getAcceptList(input) {
    if (!input) return [];
    var a = input.getAttribute('accept');
    if (!a) return [];
    return a.split(',').map(function (s) { return (s || '').trim(); }).filter(Boolean);
  }

  function acceptsFile(file, acceptList) {
    if (!acceptList || acceptList.length === 0) return true;

    var name = (file && file.name ? String(file.name) : '').toLowerCase();
    var type = (file && file.type ? String(file.type) : '').toLowerCase();

    for (var i = 0; i < acceptList.length; i++) {
      var pat = String(acceptList[i]).toLowerCase();
      if (!pat) continue;
      if (pat === '*/*') return true;

      if (pat.slice(-2) === '/*') {
        var base = pat.slice(0, -2);
        if (type && type.indexOf(base + '/') === 0) return true;
        continue;
      }

      if (pat[0] === '.') {
        if (name && name.slice(-pat.length) === pat) return true;
        continue;
      }

      if (type && type === pat) return true;
    }

    return false;
  }

  function toArray(fileList) {
    var result = [];
    if (!fileList) return result;
    for (var i = 0; i < fileList.length; i++) {
      result.push(fileList[i]);
    }
    return result;
  }

  function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function setInputFiles(input, files) {
    if (!input) return false;
    try {
      // DataTransfer is widely supported (Chromium/Edge). If it fails, we still show previews.
      var dt = new DataTransfer();
      for (var i = 0; i < files.length; i++) {
        dt.items.add(files[i]);
      }
      input.files = dt.files;
      return true;
    } catch (e) {
      return false;
    }
  }

  function updateUi(listEl, summaryEl, errorsEl, accepted, errors, totalBytes) {
    if (summaryEl) {
      summaryEl.textContent = accepted.length ? (accepted.length + ' file(s) — ' + formatBytes(totalBytes)) : '';
    }

    if (listEl) {
      clear(listEl);
      for (var i = 0; i < accepted.length; i++) {
        var f = accepted[i];
        var item = document.createElement('div');
        item.className = 'hfx-dz-item';
        item.textContent = f.name + ' (' + formatBytes(f.size) + ')';
        listEl.appendChild(item);
      }
    }

    if (errorsEl) {
      clear(errorsEl);
      for (var j = 0; j < errors.length; j++) {
        var err = document.createElement('div');
        err.className = 'hfx-dz-error';
        err.textContent = errors[j];
        errorsEl.appendChild(err);
      }
    }
  }

  function validateFiles(zone, input, filesArr) {
    var acceptList = getAcceptList(input);
    var maxFiles = parseIntAttr(zone, 'data-hfx-dz-max-files');
    var maxFileBytes = parseIntAttr(zone, 'data-hfx-dz-max-file-bytes');
    var maxTotalBytes = parseIntAttr(zone, 'data-hfx-dz-max-total-bytes');

    // Respect the input's "multiple" attribute as a hard cap of 1.
    var allowMultiple = !!(input && input.hasAttribute('multiple'));
    if (!allowMultiple) {
      maxFiles = 1;
    }

    var errors = [];
    var accepted = [];
    var totalBytes = 0;

    for (var i = 0; i < filesArr.length; i++) {
      var file = filesArr[i];
      if (!file) continue;

      if (maxFiles && accepted.length >= maxFiles) {
        // Ignore extras (but keep a single warning)
        if (errors.indexOf('Too many files selected.') === -1) {
          errors.push('Too many files selected.');
        }
        continue;
      }

      if (maxFileBytes && file.size > maxFileBytes) {
        errors.push(file.name + ' is too large (max ' + formatBytes(maxFileBytes) + ').');
        continue;
      }

      if (!acceptsFile(file, acceptList)) {
        errors.push(file.name + ' is not an accepted file type.');
        continue;
      }

      accepted.push(file);
      totalBytes += file.size || 0;

      if (maxTotalBytes && totalBytes > maxTotalBytes) {
        // Revert this file to keep selection under limit.
        accepted.pop();
        totalBytes -= file.size || 0;
        errors.push('Total size exceeds limit (max ' + formatBytes(maxTotalBytes) + ').');
      }
    }

    return { accepted: accepted, errors: errors, totalBytes: totalBytes };
  }

  function initZone(zone) {
    if (!zone || zone.__hfx_dz_init) return;
    zone.__hfx_dz_init = true;

    var input = zone.querySelector('input[type=file]');
    var previewEnabled = zone.getAttribute('data-hfx-dz-preview') !== '0';

    var listEl = null;
    var summaryEl = null;
    var errorsEl = null;

    var selected = [];
    var selectedTotalBytes = 0;

    var uploadUrl = zone.getAttribute('data-hfx-dz-upload-url');
    var uploadEnabled = !!uploadUrl;
    var uploadMethod = (zone.getAttribute('data-hfx-dz-upload-method') || 'POST').toUpperCase();
    var uploadFeatures = parseIntAttr(zone, 'data-hfx-dz-upload-features') || 0;

    var uploadMode = (zone.getAttribute('data-hfx-dz-upload-mode') || '').toLowerCase();
    var resumableEnabled = uploadMode === 'resumable';
    var resumableChunkBytes = parseIntAttr(zone, 'data-hfx-dz-upload-chunk-bytes');
    if (!resumableChunkBytes || resumableChunkBytes < 1024) resumableChunkBytes = 8 * 1024 * 1024;
    var resumableChunkRetries = parseIntAttr(zone, 'data-hfx-dz-upload-chunk-retries');
    if (resumableChunkRetries == null || resumableChunkRetries < 0) resumableChunkRetries = 3;

    var uploadUi = null;
    var uploadStatusEl = null;
    var uploadProgressBar = null;
    var uploadStartBtn = null;
    var uploadCancelBtn = null;
    var xhr = null;
    var isUploading = false;
    var resumableCancelRequested = false;

    function hasUploadFeature(flag) {
      return (uploadFeatures & flag) === flag;
    }

    if (uploadEnabled) {
      uploadUi = zone.querySelector('[data-hfx-dz-upload-ui]');
      uploadStatusEl = zone.querySelector('[data-hfx-dz-upload-status]');
      uploadProgressBar = zone.querySelector('[data-hfx-dz-upload-progress-bar]');
      uploadStartBtn = zone.querySelector('[data-hfx-dz-upload-start]');
      uploadCancelBtn = zone.querySelector('[data-hfx-dz-upload-cancel]');

      if (uploadCancelBtn) {
        uploadCancelBtn.classList.add('d-none');
      }
    }

    if (previewEnabled) {
      listEl = zone.querySelector('[data-hfx-dz-list]') || zone.querySelector('.hfx-dz-list');
      summaryEl = zone.querySelector('[data-hfx-dz-summary]') || zone.querySelector('.hfx-dz-summary');
      errorsEl = zone.querySelector('[data-hfx-dz-errors]') || zone.querySelector('.hfx-dz-errors');

      if (!summaryEl) {
        summaryEl = document.createElement('div');
        summaryEl.className = 'hfx-dz-summary text-secondary small';
        zone.appendChild(summaryEl);
      }
      if (!listEl) {
        listEl = document.createElement('div');
        listEl.className = 'hfx-dz-list';
        zone.appendChild(listEl);
      }
      if (!errorsEl) {
        errorsEl = document.createElement('div');
        errorsEl.className = 'hfx-dz-errors text-danger small';
        zone.appendChild(errorsEl);
      }
    }

    function setUploadUiVisible(visible) {
      if (!uploadUi) return;
      if (visible) uploadUi.classList.remove('d-none');
      else uploadUi.classList.add('d-none');
    }

    function setUploadStatus(text, isError) {
      if (!uploadStatusEl) return;
      uploadStatusEl.textContent = text || '';
      uploadStatusEl.classList.toggle('text-danger', !!isError);
      uploadStatusEl.classList.toggle('text-secondary', !isError);
    }

    function setUploadProgress(percent) {
      if (!uploadProgressBar) return;
      var p = Number(percent);
      if (!isFinite(p)) p = 0;
      if (p < 0) p = 0;
      if (p > 100) p = 100;
      uploadProgressBar.style.width = p.toFixed(0) + '%';
      uploadProgressBar.setAttribute('aria-valuenow', p.toFixed(0));
    }

    function setUploading(uploading) {
      isUploading = !!uploading;
      zone.classList.toggle('hfx-dz-uploading', isUploading);

      if (uploadEnabled && hasUploadFeature(DZ_UPLOAD_DISABLE_DURING_UPLOAD) && input) {
        input.disabled = isUploading;
      }

      if (uploadStartBtn) uploadStartBtn.disabled = isUploading;
      if (uploadCancelBtn) {
        uploadCancelBtn.disabled = !isUploading;
        uploadCancelBtn.classList.toggle('d-none', !isUploading);
      }
    }

    function buildUploadFormData() {
      var form = null;
      if (uploadEnabled && hasUploadFeature(DZ_UPLOAD_INCLUDE_FORM_FIELDS) && zone.closest) {
        form = zone.closest('form');
      }

      var fd = form ? new FormData(form) : new FormData();

      var inputName = (input && input.getAttribute('name')) ? input.getAttribute('name') : 'files';
      try { fd.delete(inputName); } catch (e) { /* ignore */ }
      for (var i = 0; i < selected.length; i++) {
        fd.append(inputName, selected[i], selected[i].name);
      }

      return fd;
    }

    function tryParseJson(text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (e) { return null; }
    }

    function getCsrfToken() {
      try {
        var csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta && csrfMeta.getAttribute('content')) {
          return csrfMeta.getAttribute('content');
        }
      } catch (e) { /* ignore */ }
      return null;
    }

    function trySetCsrfHeader(request) {
      try {
        var token = getCsrfToken();
        if (token) {
          request.setRequestHeader('X-CSRF-Token', token);
        }
      } catch (e) { /* ignore */ }
    }

    function startUpload() {
      if (!uploadEnabled || isUploading) return;
      if (!selected || selected.length === 0) {
        setUploadUiVisible(true);
        setUploadStatus('Please choose at least one file.', true);
        return;
      }

      if (resumableEnabled) {
        startResumableUpload();
        return;
      }

      setUploadUiVisible(true);
      setUploadStatus('Uploading…', false);
      setUploadProgress(0);
      setUploading(true);

      xhr = new XMLHttpRequest();
      xhr.open(uploadMethod, uploadUrl, true);

      // Optional CSRF header (works with Document.Head.CsrfMeta + common ASP.NET settings)
      trySetCsrfHeader(xhr);

      xhr.upload.onprogress = function (evt) {
        if (!evt) return;
        if (evt.lengthComputable) {
          setUploadProgress((evt.loaded / evt.total) * 100);
        }
      };

      xhr.onload = function () {
        var ok = xhr.status >= 200 && xhr.status < 300;
        var text = xhr.responseText || '';

        if (!ok) {
          setUploadStatus(text ? ('Upload failed: ' + text) : 'Upload failed.', true);
          setUploading(false);
          return;
        }

        setUploadProgress(100);
        setUploadStatus('Upload complete.', false);
        setUploading(false);

        var redirectUrl = null;
        var json = tryParseJson(text);
        if (json && typeof json === 'object') {
          redirectUrl = json.redirectUrl || json.redirect || json.url || null;
        }

        if (redirectUrl && hasUploadFeature(DZ_UPLOAD_REDIRECT_ON_SUCCESS)) {
          try { window.location.href = redirectUrl; } catch (e) { /* ignore */ }
          return;
        }

        if (hasUploadFeature(DZ_UPLOAD_RESET_ON_SUCCESS)) {
          selected = [];
          selectedTotalBytes = 0;
          if (input) {
            try { input.value = ''; } catch (e) { /* ignore */ }
          }
          if (previewEnabled) updateUi(listEl, summaryEl, errorsEl, [], [], 0);
        }
      };

      xhr.onerror = function () {
        setUploadStatus('Upload failed.', true);
        setUploading(false);
      };

      xhr.onabort = function () {
        setUploadStatus('Upload cancelled.', true);
        setUploading(false);
      };

      xhr.send(buildUploadFormData());
    }

    function buildContextFormData() {
      var form = null;
      if (zone.closest) {
        form = zone.closest('form');
      }

      var fd = (uploadEnabled && hasUploadFeature(DZ_UPLOAD_INCLUDE_FORM_FIELDS) && form) ? new FormData(form) : new FormData();

      // Ensure we do NOT send selected files as part of context/init request.
      var inputName = (input && input.getAttribute('name')) ? input.getAttribute('name') : 'files';
      try { fd.delete(inputName); } catch (e) { /* ignore */ }

      return fd;
    }

    function xhrSendJson(method, url, body, contentType, onProgress, cb) {
      var req = new XMLHttpRequest();
      req.open(method, url, true);
      trySetCsrfHeader(req);

      if (contentType) {
        try { req.setRequestHeader('Content-Type', contentType); } catch (e) { /* ignore */ }
      }

      if (onProgress && req.upload) {
        req.upload.onprogress = onProgress;
      }

      req.onload = function () {
        var ok = req.status >= 200 && req.status < 300;
        var text = req.responseText || '';
        if (!ok) {
          cb(new Error(text || ('Request failed: ' + req.status)), null, req);
          return;
        }

        var json = tryParseJson(text);
        cb(null, json, req);
      };

      req.onerror = function () { cb(new Error('Request failed.'), null, req); };
      req.onabort = function () { cb(new Error('Request cancelled.'), null, req); };

      req.send(body);
      return req;
    }

    function xhrSendChunk(url, blob, offset, totalLength, onProgress, cb) {
      var req = new XMLHttpRequest();
      req.open('PUT', url, true);
      trySetCsrfHeader(req);

      try { req.setRequestHeader('Content-Type', 'application/octet-stream'); } catch (e) { /* ignore */ }
      try { req.setRequestHeader('X-Upload-Offset', String(offset)); } catch (e) { /* ignore */ }
      try { req.setRequestHeader('X-Upload-Length', String(totalLength)); } catch (e) { /* ignore */ }

      if (onProgress && req.upload) {
        req.upload.onprogress = onProgress;
      }

      req.onload = function () {
        var text = req.responseText || '';
        if (req.status === 409) {
          var conflict = tryParseJson(text) || {};
          cb(null, { conflict: true, expectedOffset: conflict.expectedOffset }, req);
          return;
        }

        var ok = req.status >= 200 && req.status < 300;
        if (!ok) {
          cb(new Error(text ? ('Chunk upload failed: ' + text) : 'Chunk upload failed.'), null, req);
          return;
        }

        var json = tryParseJson(text) || {};
        cb(null, { conflict: false, offset: json.offset }, req);
      };

      req.onerror = function () { cb(new Error('Chunk upload failed.'), null, req); };
      req.onabort = function () { cb(new Error('Chunk upload cancelled.'), null, req); };

      req.send(blob);
      return req;
    }

    function startResumableUpload() {
      if (!uploadEnabled || isUploading) return;
      if (!selected || selected.length === 0) {
        setUploadUiVisible(true);
        setUploadStatus('Please choose at least one file.', true);
        return;
      }

      resumableCancelRequested = false;
      setUploadUiVisible(true);
      setUploadStatus('Preparing upload…', false);
      setUploadProgress(0);
      setUploading(true);

      var totalBytes = selectedTotalBytes || 0;
      var uploadedSoFar = 0;
      var currentIndex = 0;

      function finishAll(ok, message, redirectUrl) {
        if (!isUploading) return;
        if (!ok) {
          setUploadStatus(message || 'Upload failed.', true);
          setUploading(false);
          return;
        }

        setUploadProgress(100);
        setUploadStatus(message || 'Upload complete.', false);
        setUploading(false);

        if (redirectUrl && hasUploadFeature(DZ_UPLOAD_REDIRECT_ON_SUCCESS)) {
          try { window.location.href = redirectUrl; } catch (e) { /* ignore */ }
          return;
        }

        if (hasUploadFeature(DZ_UPLOAD_RESET_ON_SUCCESS)) {
          selected = [];
          selectedTotalBytes = 0;
          if (input) {
            try { input.value = ''; } catch (e) { /* ignore */ }
          }
          if (previewEnabled) updateUi(listEl, summaryEl, errorsEl, [], [], 0);
        }
      }

      function updateOverallProgress(extra) {
        var v = uploadedSoFar + (extra || 0);
        if (totalBytes > 0) {
          setUploadProgress((v / totalBytes) * 100);
        }
      }

      function setStatusForFile(file, offset) {
        var name = file && file.name ? file.name : 'file';
        var idx = currentIndex + 1;
        var total = selected.length;
        var base = 'Uploading ' + name + ' (' + idx + '/' + total + ')';
        if (typeof offset === 'number' && file && file.size) {
          var pct = Math.floor((offset / file.size) * 100);
          base += ' — ' + pct + '%';
        }
        setUploadStatus(base, false);
      }

      function uploadNextFile(context) {
        if (resumableCancelRequested || !isUploading) return;
        if (currentIndex >= selected.length) {
          finishAll(true, 'Upload complete.', context && context.redirectUrl);
          return;
        }

        var file = selected[currentIndex];
        if (!file) { currentIndex++; uploadNextFile(context); return; }

        var initUrl = context && context.fileInitUrl;
        if (!initUrl) {
          finishAll(false, 'Upload failed: missing fileInitUrl.', null);
          return;
        }

        var meta = {
          fileName: file.name || '',
          contentType: file.type || 'application/octet-stream',
          length: file.size || 0,
          lastModifiedMs: (typeof file.lastModified === 'number') ? file.lastModified : 0
        };

        setStatusForFile(file, 0);

        xhr = xhrSendJson('POST', initUrl, JSON.stringify(meta), 'application/json; charset=utf-8', null, function (err, json) {
          if (err) {
            finishAll(false, err.message || 'Upload failed.', null);
            return;
          }

          if (!json || typeof json !== 'object') {
            finishAll(false, 'Upload failed: invalid init response.', null);
            return;
          }

          var chunkUrl = json.chunkUrl;
          var finishUrl = json.finishUrl;
          var offset = Number(json.offset || 0);
          if (!isFinite(offset) || offset < 0) offset = 0;

          if (!chunkUrl || !finishUrl) {
            finishAll(false, 'Upload failed: invalid init response.', null);
            return;
          }

          // Resume support: count already uploaded bytes.
          if (offset > 0) {
            uploadedSoFar += offset;
            updateOverallProgress(0);
          }

          function uploadNextChunk() {
            if (resumableCancelRequested || !isUploading) return;
            if (offset >= file.size) {
              // Commit file
              xhr = xhrSendJson('POST', finishUrl, '', null, null, function (err2) {
                if (err2) {
                  finishAll(false, err2.message || 'Upload failed.', null);
                  return;
                }

                currentIndex++;
                uploadNextFile(context);
              });
              return;
            }

            setStatusForFile(file, offset);

            var end = offset + resumableChunkBytes;
            if (end > file.size) end = file.size;

            var chunk = file.slice(offset, end);
            var chunkLen = end - offset;
            if (!chunkLen || chunkLen <= 0) {
              finishAll(false, 'Upload failed: invalid chunk size.', null);
              return;
            }

            var attemptsLeft = resumableChunkRetries;

            function sendChunkAttempt() {
              if (resumableCancelRequested || !isUploading) return;

              xhr = xhrSendChunk(chunkUrl, chunk, offset, file.size, function (evt) {
                if (!evt || !evt.lengthComputable) return;
                updateOverallProgress(evt.loaded);
              }, function (err3, result) {
                if (resumableCancelRequested || !isUploading) return;

                if (err3) {
                  if (attemptsLeft > 0) {
                    attemptsLeft--;
                    setTimeout(sendChunkAttempt, 250);
                    return;
                  }
                  finishAll(false, err3.message || 'Upload failed.', null);
                  return;
                }

                if (result && result.conflict && typeof result.expectedOffset === 'number') {
                  var expected = Number(result.expectedOffset);
                  if (isFinite(expected) && expected >= 0 && expected <= file.size) {
                    if (expected > offset) {
                      uploadedSoFar += (expected - offset);
                    }
                    offset = expected;
                    uploadNextChunk();
                    return;
                  }
                }

                // Success: advance
                uploadedSoFar += chunkLen;
                offset = end;
                updateOverallProgress(0);
                uploadNextChunk();
              });
            }

            sendChunkAttempt();
          }

          uploadNextChunk();
        });
      }

      // Context init: returns { fileInitUrl, redirectUrl, ... }
      xhr = xhrSendJson(uploadMethod, uploadUrl, buildContextFormData(), null, null, function (err, json) {
        if (err) {
          finishAll(false, err.message || 'Upload failed.', null);
          return;
        }

        if (!json || typeof json !== 'object') {
          finishAll(false, 'Upload failed: invalid server response.', null);
          return;
        }

        if (!json.fileInitUrl) {
          finishAll(false, 'Upload failed: missing fileInitUrl.', null);
          return;
        }

        uploadNextFile(json);
      });
    }

    function applyFiles(fileList, emitChange, allowUploadStart) {
      var res = validateFiles(zone, input, toArray(fileList));

      selected = res.accepted;
      selectedTotalBytes = res.totalBytes;

      if (previewEnabled) {
        updateUi(listEl, summaryEl, errorsEl, res.accepted, res.errors, res.totalBytes);
      }

      if (uploadEnabled && !isUploading) {
        setUploadStatus('', false);
        if (!hasUploadFeature(DZ_UPLOAD_AUTOSTART)) {
          setUploadUiVisible(selected.length > 0);
        }
      }

      // Always try to set input.files for real form submission.
      if (input) {
        var ok = setInputFiles(input, res.accepted);
        if (ok) {
          if (emitChange) {
            try { input.__hfx_dz_internal_change = true; } catch (e) { /* ignore */ }
            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { /* ignore */ }
          }
        }
      }

      if (uploadEnabled && allowUploadStart && !isUploading && hasUploadFeature(DZ_UPLOAD_AUTOSTART) && selected.length > 0) {
        startUpload();
      }
    }

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (uploadEnabled && isUploading && hasUploadFeature(DZ_UPLOAD_DISABLE_DURING_UPLOAD)) return;
      zone.classList.add('hfx-dz-hover');
    });

    zone.addEventListener('dragleave', function () {
      zone.classList.remove('hfx-dz-hover');
    });

    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('hfx-dz-hover');
      if (uploadEnabled && isUploading && hasUploadFeature(DZ_UPLOAD_DISABLE_DURING_UPLOAD)) return;
      if (e.dataTransfer && e.dataTransfer.files) {
        applyFiles(e.dataTransfer.files, true, true);
      }
    });

    if (input) {
      input.addEventListener('change', function () {
        if (input.__hfx_dz_internal_change) {
          input.__hfx_dz_internal_change = false;
          return;
        }
        applyFiles(input.files, false, true);
      });
    }

    var label = zone.querySelector('label.dz-message');
    if (label && input) {
      label.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (uploadEnabled && isUploading && hasUploadFeature(DZ_UPLOAD_DISABLE_DURING_UPLOAD)) return;
          input.click();
        }
      });
    }

    if (uploadStartBtn) {
      uploadStartBtn.addEventListener('click', function (e) {
        try { e.preventDefault(); } catch (ex) { /* ignore */ }
        startUpload();
      });
    }

    if (uploadCancelBtn && uploadEnabled && hasUploadFeature(DZ_UPLOAD_ALLOW_CANCEL)) {
      uploadCancelBtn.addEventListener('click', function (e) {
        try { e.preventDefault(); } catch (ex) { /* ignore */ }
        resumableCancelRequested = true;
        if (xhr && isUploading) {
          try { xhr.abort(); } catch (ex2) { /* ignore */ }
        }
        setUploadStatus('Upload cancelled.', true);
        setUploading(false);
      });
    }

    // Initial UI render
    if (input && input.files && input.files.length) {
      applyFiles(input.files, false, false);
    }
  }

  function initDropzones(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;
      var zones = root.querySelectorAll('[data-hfx-dz]');
      for (var i = 0; i < zones.length; i++) {
        initZone(zones[i]);
      }
    } catch (e) {
      // swallow
    }
  }

  // Expose for dynamic apps (e.g. HTMX or client-side injected fragments)
  window.hfxInitDropzones = initDropzones;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initDropzones(document); });
  } else {
    initDropzones(document);
  }
})();

