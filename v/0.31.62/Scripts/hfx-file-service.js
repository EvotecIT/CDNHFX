(function () {
  'use strict';

  function formatBytes(bytes) {
    var value = Number(bytes || 0);
    if (!isFinite(value) || value <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value = value / 1024;
      unit++;
    }
    var digits = unit === 0 ? 0 : (value >= 10 ? 1 : 2);
    return value.toFixed(digits) + ' ' + units[unit];
  }

  function toArray(list) {
    var result = [];
    if (!list) return result;
    for (var i = 0; i < list.length; i++) result.push(list[i]);
    return result;
  }

  function updateSelectedSummary(form) {
    if (!form) return;
    var summary = form.querySelector('[data-hfx-file-selected-summary]');
    if (!summary) return;

    var inputs = form.querySelectorAll('input[type="file"]');
    var files = [];
    for (var i = 0; i < inputs.length; i++) {
      files = files.concat(toArray(inputs[i].files));
    }

    if (!files.length) {
      summary.textContent = summary.getAttribute('data-hfx-empty-text') || 'No files selected';
      return;
    }

    var bytes = 0;
    for (var j = 0; j < files.length; j++) bytes += files[j].size || 0;
    summary.textContent = files.length + ' file(s) selected - ' + formatBytes(bytes);
  }

  function initSendForm(form) {
    if (!form || form.__hfx_file_send_init) return;
    form.__hfx_file_send_init = true;

    form.addEventListener('change', function (event) {
      var target = event.target;
      if (target && target.matches && target.matches('input[type="file"]')) {
        updateSelectedSummary(form);
      }
    });

    updateSelectedSummary(form);
  }

  function setPasswordPanelState(form) {
    if (!form) return;
    var toggle = form.querySelector('[data-hfx-file-password-toggle]');
    var panel = form.querySelector('[data-hfx-file-password-panel]');
    if (!toggle || !panel) return;

    var visible = !!toggle.checked;
    panel.classList.toggle('is-visible', visible);
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');

    var input = panel.querySelector('input,textarea,select');
    if (input) {
      if (visible) input.removeAttribute('disabled');
      else input.setAttribute('disabled', 'disabled');
    }
  }

  function initShareOptions(form) {
    if (!form || form.__hfx_file_share_options_init) return;
    form.__hfx_file_share_options_init = true;

    var toggle = form.querySelector('[data-hfx-file-password-toggle]');
    if (toggle) {
      toggle.addEventListener('change', function () { setPasswordPanelState(form); });
      setPasswordPanelState(form);
    }
  }

  function updateSecureMessageMeta(form) {
    if (!form) return;
    var payload = form.querySelector('[data-hfx-secure-message-payload]');
    var count = form.querySelector('[data-hfx-secure-message-count]');
    var text = '';
    if (payload && count) {
      text = String(payload.value || '');
      var lines = text ? text.split(/\r\n|\r|\n/).length : 0;
      count.textContent = text.length + ' chars' + (lines ? ' / ' + lines + ' lines' : '');
    } else if (payload) {
      text = String(payload.value || '');
    }

    var activeKind = form.querySelector('[data-hfx-secure-message-kind]:checked');
    if (activeKind) {
      form.setAttribute('data-hfx-secure-message-kind-active', activeKind.value || '');
    }

    var kindOptions = form.querySelectorAll('.hfx-file-secure-message__kind');
    for (var i = 0; i < kindOptions.length; i++) {
      var input = kindOptions[i].querySelector('[data-hfx-secure-message-kind]');
      kindOptions[i].classList.toggle('is-active', !!input && !!input.checked);
    }

    updateSecureMessageHighlight(form, text);
  }

  function secureMessageHighlightLanguage(form) {
    var picker = form.querySelector('[data-hfx-secure-message-language]');
    if (picker && picker.value) return picker.value;

    var configured = form.getAttribute('data-hfx-secure-message-highlight-language');
    if (configured) return configured;

    var activeKind = form.querySelector('[data-hfx-secure-message-kind]:checked');
    var kind = activeKind ? activeKind.value : form.getAttribute('data-hfx-secure-message-kind-active');
    return kind === 'script' ? 'powershell' : 'none';
  }

  function updateSecureMessageHighlight(form, text) {
    var code = form.querySelector('[data-hfx-secure-message-highlight-code]');
    if (!code) return;

    var pre = code.closest ? code.closest('pre') : null;
    var language = secureMessageHighlightLanguage(form);
    var languageClass = 'language-' + language;

    code.textContent = text || '';
    code.className = languageClass;
    if (pre) pre.className = 'hfx-file-secure-message__highlight ' + languageClass;

    if (window.Prism && typeof window.Prism.highlightElement === 'function' && language !== 'none') {
      window.Prism.highlightElement(code);
    }
  }

  function initSecureMessage(form) {
    if (!form || form.__hfx_file_secure_message_init) return;
    form.__hfx_file_secure_message_init = true;

    var payload = form.querySelector('[data-hfx-secure-message-payload]');
    var highlight = form.querySelector('[data-hfx-secure-message-highlight-code]');
    var highlightPre = highlight && highlight.closest ? highlight.closest('pre') : null;
    if (payload) {
      payload.addEventListener('input', function () { updateSecureMessageMeta(form); });
      if (highlightPre) {
        payload.addEventListener('scroll', function () {
          highlightPre.scrollTop = payload.scrollTop;
          highlightPre.scrollLeft = payload.scrollLeft;
        });
      }
    }

    var kinds = form.querySelectorAll('[data-hfx-secure-message-kind]');
    for (var i = 0; i < kinds.length; i++) {
      kinds[i].addEventListener('change', function () { updateSecureMessageMeta(form); });
    }

    var languagePicker = form.querySelector('[data-hfx-secure-message-language]');
    if (languagePicker) {
      languagePicker.addEventListener('change', function () { updateSecureMessageMeta(form); });
    }

    var passwordToggle = form.querySelector('[data-hfx-file-password-toggle]');
    if (passwordToggle) {
      passwordToggle.addEventListener('change', function () { setPasswordPanelState(form); });
      setPasswordPanelState(form);
    }

    updateSecureMessageMeta(form);
  }

  function initEvidenceForm(form) {
    if (!form || form.__hfx_file_evidence_init) return;
    form.__hfx_file_evidence_init = true;

    var detections = form.querySelector('input[name="detections"]');
    var total = form.querySelector('input[name="total"]');
    if (!detections || !total) return;

    function clamp() {
      var detected = parseInt(detections.value || '0', 10);
      var totalValue = parseInt(total.value || '0', 10);
      if (isNaN(detected) || detected < 0) detected = 0;
      if (isNaN(totalValue) || totalValue < 0) totalValue = 0;
      if (detected > totalValue) totalValue = detected;
      detections.value = String(detected);
      total.value = String(totalValue);
    }

    detections.addEventListener('change', clamp);
    total.addEventListener('change', clamp);
    form.addEventListener('submit', clamp);
  }

  function setPortalDrawer(shell, open) {
    if (!shell) return;
    var drawer = shell.querySelector('[data-hfx-file-portal-drawer]');
    if (!drawer) return;

    var visible = !!open;
    shell.classList.toggle('is-drawer-open', visible);
    shell.setAttribute('data-hfx-file-portal-drawer-open', visible ? 'true' : 'false');
    drawer.setAttribute('aria-hidden', visible ? 'false' : 'true');

    var toggles = shell.querySelectorAll('[data-hfx-file-portal-drawer-toggle]');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-expanded', visible ? 'true' : 'false');
    }
  }

  function normalizeFilterValue(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function applyTransferListFilter(list) {
    if (!list) return;

    var search = list.querySelector('[data-hfx-file-transfer-search]');
    var query = search ? String(search.value || '').trim().toLowerCase() : '';
    var activeTab = list.querySelector('[data-hfx-file-transfer-tab].is-active');
    var activeFilter = activeTab ? (activeTab.getAttribute('data-hfx-file-transfer-filter') || 'all') : 'all';
    var rows = list.querySelectorAll('[data-hfx-file-transfer-row]');
    var revealSearchDetails = query && list.getAttribute('data-hfx-file-transfer-reveal-search-details') === 'true';
    var singleOpenDetails = list.getAttribute('data-hfx-file-transfer-single-open') === 'true';
    var revealedSearchDetail = false;
    var visible = 0;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowStatus = row.getAttribute('data-hfx-file-transfer-status') || '';
      var rowText = (row.getAttribute('data-hfx-file-transfer-text') || row.textContent || '').toLowerCase();
      var normalizedStatus = normalizeFilterValue(rowStatus);
      var statusMatches = activeFilter === 'all' ||
        normalizedStatus === activeFilter ||
        normalizedStatus.indexOf(activeFilter) === 0 ||
        normalizedStatus.indexOf(activeFilter + '-') === 0;
      var textMatches = !query || rowText.indexOf(query) !== -1;
      var show = statusMatches && textMatches;
      row.hidden = !show;
      var detailId = row.getAttribute('data-hfx-file-transfer-detail-id');
      if (detailId) {
        var detailRow = list.querySelector('[data-hfx-file-transfer-detail-row="' + detailId + '"]');
        if (detailRow) {
          if (!show || (!query && row.hasAttribute('data-hfx-file-transfer-auto-opened'))) {
            closeTransferDetail(list, row, detailId);
          } else if (show && revealSearchDetails) {
            if (!singleOpenDetails || !revealedSearchDetail) {
              openTransferDetailFromSearch(list, row, detailId);
              revealedSearchDetail = true;
            } else if (row.hasAttribute('data-hfx-file-transfer-auto-opened')) {
              closeTransferDetail(list, row, detailId);
            }
          }
        }
      }
      if (show) visible++;
    }

    var empty = list.querySelector('[data-hfx-file-transfer-empty]');
    if (empty) empty.hidden = visible > 0;
  }

  function isInteractiveTransferTarget(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('a,button,input,select,textarea,label,[role="button"],[data-hfx-file-transfer-detail-toggle]');
  }

  function closeTransferDetail(list, row, detailId) {
    if (!list || !row || !detailId) return;

    var detailRow = list.querySelector('[data-hfx-file-transfer-detail-row="' + detailId + '"]');
    if (detailRow) detailRow.hidden = true;
    row.classList.remove('is-detail-open');
    row.setAttribute('data-hfx-file-transfer-detail-open', 'false');
    if (row.hasAttribute('data-hfx-file-transfer-row-toggle')) {
      row.setAttribute('aria-expanded', 'false');
    }

    var toggle = row.querySelector('[data-hfx-file-transfer-detail-toggle="' + detailId + '"]');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    row.removeAttribute('data-hfx-file-transfer-auto-opened');
  }

  function toggleTransferDetail(list, row, detailId, forceOpen, options) {
    if (!list || !row || !detailId) return;

    var detailRow = list.querySelector('[data-hfx-file-transfer-detail-row="' + detailId + '"]');
    if (!detailRow) return;

    var open = typeof forceOpen === 'boolean' ? forceOpen : detailRow.hidden;
    var autoOpen = options && options.autoOpen === true;
    if (open && list.getAttribute('data-hfx-file-transfer-single-open') === 'true') {
      var openRows = list.querySelectorAll('[data-hfx-file-transfer-row][data-hfx-file-transfer-detail-open="true"]');
      for (var i = 0; i < openRows.length; i++) {
        var openRow = openRows[i];
        var openDetailId = openRow.getAttribute('data-hfx-file-transfer-detail-id');
        if (openRow !== row && openDetailId) closeTransferDetail(list, openRow, openDetailId);
      }
    }

    detailRow.hidden = !open;
    row.classList.toggle('is-detail-open', open);
    row.setAttribute('data-hfx-file-transfer-detail-open', open ? 'true' : 'false');
    if (row.hasAttribute('data-hfx-file-transfer-row-toggle')) {
      row.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    var toggle = row.querySelector('[data-hfx-file-transfer-detail-toggle="' + detailId + '"]');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open && autoOpen) row.setAttribute('data-hfx-file-transfer-auto-opened', 'true');
    else row.removeAttribute('data-hfx-file-transfer-auto-opened');
  }

  function openTransferDetailFromSearch(list, row, detailId) {
    if (!list || !row || !detailId) return;
    var detailRow = list.querySelector('[data-hfx-file-transfer-detail-row="' + detailId + '"]');
    var wasOpen = detailRow && !detailRow.hidden;
    toggleTransferDetail(list, row, detailId, true, { autoOpen: !wasOpen });
  }

  function initTransferList(list) {
    if (!list || list.__hfx_file_transfer_list_init) return;
    list.__hfx_file_transfer_list_init = true;

    list.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var toggle = target.closest('[data-hfx-file-transfer-detail-toggle]');
      if (toggle && list.contains(toggle)) {
        event.preventDefault();
        var detailId = toggle.getAttribute('data-hfx-file-transfer-detail-toggle');
        if (!detailId) return;

        var row = toggle.closest('[data-hfx-file-transfer-row]');
        toggleTransferDetail(list, row, detailId);
        return;
      }

      var rowToggle = target.closest('[data-hfx-file-transfer-row-toggle="true"]');
      if (!rowToggle || !list.contains(rowToggle) || isInteractiveTransferTarget(target)) return;

      event.preventDefault();
      toggleTransferDetail(list, rowToggle, rowToggle.getAttribute('data-hfx-file-transfer-detail-id'));
    });

    list.addEventListener('keydown', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;

      var row = target.closest('[data-hfx-file-transfer-row-toggle="true"]');
      if (!row || !list.contains(row) || target !== row) return;

      event.preventDefault();
      toggleTransferDetail(list, row, row.getAttribute('data-hfx-file-transfer-detail-id'));
    });

    var tabs = list.querySelectorAll('[data-hfx-file-transfer-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (event) {
        var href = this.getAttribute('href') || '#';
        if (href === '#') event.preventDefault();

        for (var j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove('is-active');
          tabs[j].setAttribute('aria-pressed', 'false');
        }
        this.classList.add('is-active');
        this.setAttribute('aria-pressed', 'true');
        applyTransferListFilter(list);
      });
    }

    var search = list.querySelector('[data-hfx-file-transfer-search]');
    if (search) {
      search.addEventListener('input', function () { applyTransferListFilter(list); });
      search.addEventListener('search', function () { applyTransferListFilter(list); });
    }

    applyTransferListFilter(list);
  }

  function initPortalShell(shell) {
    if (!shell || shell.__hfx_file_portal_init) return;
    shell.__hfx_file_portal_init = true;

    var drawer = shell.querySelector('[data-hfx-file-portal-drawer]');
    if (!drawer) return;

    setPortalDrawer(shell, shell.getAttribute('data-hfx-file-portal-drawer-open') === 'true');

    shell.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var toggle = target.closest('[data-hfx-file-portal-drawer-toggle]');
      if (toggle && shell.contains(toggle)) {
        event.preventDefault();
        var isOpen = shell.getAttribute('data-hfx-file-portal-drawer-open') === 'true';
        setPortalDrawer(shell, !isOpen);
        return;
      }

      var close = target.closest('[data-hfx-file-portal-drawer-close]');
      if (close && shell.contains(close)) {
        event.preventDefault();
        setPortalDrawer(shell, false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && shell.getAttribute('data-hfx-file-portal-drawer-open') === 'true') {
        setPortalDrawer(shell, false);
      }
    });
  }

  function initProofNav(nav) {
    if (!nav || nav.__hfx_file_proof_nav_init) return;
    nav.__hfx_file_proof_nav_init = true;

    nav.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var link = target.closest('a[href^="#"]');
      if (!link || !nav.contains(link)) return;

      var id = (link.getAttribute('href') || '').slice(1);
      if (!id) return;

      var section = document.getElementById(id);
      if (!section) return;

      event.preventDefault();
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', '#' + id);
      } else {
        window.location.hash = id;
      }
      section.scrollIntoView({ block: 'start', inline: 'nearest' });
    });
  }

  function proofSections() {
    return toArray(document.querySelectorAll('[data-hfx-proof-section]'));
  }

  function proofSectionIdFromHash() {
    var hash = (window.location.hash || '').replace(/^#/, '');
    if (!hash) return 'proof-source';

    var decodedHash = hash;
    try {
      decodedHash = decodeURIComponent(hash);
    } catch (_) {
      decodedHash = hash;
    }

    var section = document.getElementById(decodedHash);
    if (section && section.hasAttribute('data-hfx-proof-section')) return section.id;

    var nested = section && section.closest ? section.closest('[data-hfx-proof-section]') : null;
    return nested ? nested.id : decodedHash;
  }

  function setProofFocus(sectionId) {
    var sections = proofSections();
    var requestedId = sectionId || proofSectionIdFromHash();
    var target = document.getElementById(requestedId);
    if (!target || !target.hasAttribute('data-hfx-proof-section')) {
      target = document.getElementById('proof-source') || sections[0];
    }

    if (!target) return;

    var targetId = target.id;

    for (var i = 0; i < sections.length; i++) {
      sections[i].hidden = sections[i].id !== targetId;
    }

    target.hidden = false;
    document.documentElement.classList.add('hfx-file-proof-focus');
    target.scrollIntoView({ block: 'start', inline: 'nearest' });
  }

  function showAllProofSections() {
    var sections = proofSections();
    for (var i = 0; i < sections.length; i++) sections[i].hidden = false;
    document.documentElement.classList.remove('hfx-file-proof-focus');
  }

  function resetProofOrder() {
    var order = ['proof-model', 'proof-lab', 'proof-source', 'proof-target', 'proof-sharing', 'proof-owner', 'proof-admin'];
    var firstSection = document.querySelector('[data-hfx-proof-section]');
    var parent = firstSection ? firstSection.parentElement : null;
    if (!parent) return;

    for (var i = 0; i < order.length; i++) {
      var section = document.getElementById(order[i]);
      if (section) parent.appendChild(section);
    }
  }

  function setProofButtonState(controls, action, pressed) {
    var button = controls ? controls.querySelector('[data-hfx-proof-action="' + action + '"]') : null;
    if (button) button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  function initProofControls(controls) {
    if (!controls || controls.__hfx_file_proof_controls_init) return;
    controls.__hfx_file_proof_controls_init = true;

    controls.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var button = target.closest('[data-hfx-proof-action]');
      if (!button || !controls.contains(button)) return;

      var action = button.getAttribute('data-hfx-proof-action');
      if (!action) return;
      event.preventDefault();

      if (action === 'show-all') {
        showAllProofSections();
        setProofButtonState(controls, 'focus-current', false);
        return;
      }

      if (action === 'focus-current') {
        setProofFocus();
        setProofButtonState(controls, 'focus-current', true);
        return;
      }

      if (action === 'compact') {
        var compact = !document.documentElement.classList.contains('hfx-file-proof-compact');
        document.documentElement.classList.toggle('hfx-file-proof-compact', compact);
        setProofButtonState(controls, 'compact', compact);
        return;
      }

      if (action === 'admin-first') {
        showAllProofSections();
        var firstSection = document.querySelector('[data-hfx-proof-section]');
        var parent = firstSection ? firstSection.parentElement : null;
        var anchor = document.getElementById('proof-lab') || document.getElementById('proof-model');
        var admin = document.getElementById('proof-admin');
        if (parent && anchor && admin) {
          parent.insertBefore(admin, anchor.nextSibling);
          admin.scrollIntoView({ block: 'start', inline: 'nearest' });
        }
        return;
      }

      if (action === 'hide-map') {
        var map = document.getElementById('proof-model');
        if (!map) return;
        var hidden = !map.hidden;
        map.hidden = hidden;
        setProofButtonState(controls, 'hide-map', hidden);
        return;
      }

      if (action === 'reset-order') {
        showAllProofSections();
        resetProofOrder();
        document.documentElement.classList.remove('hfx-file-proof-compact');
        setProofButtonState(controls, 'compact', false);
        setProofButtonState(controls, 'focus-current', false);
        setProofButtonState(controls, 'hide-map', false);
      }
    });
  }

  function setTransferMapNode(map, nodeId) {
    if (!map) return;
    var nodes = toArray(map.querySelectorAll('[data-hfx-file-transfer-map-node-id]'));
    var panels = toArray(map.querySelectorAll('[data-hfx-file-transfer-map-detail-panel]'));
    if (!nodes.length || !panels.length) return;

    var selectedId = String(nodeId || map.getAttribute('data-hfx-file-transfer-map-active') || nodes[0].getAttribute('data-hfx-file-transfer-map-node-id') || '');
    var hasNode = false;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-hfx-file-transfer-map-node-id') === selectedId) {
        hasNode = true;
        break;
      }
    }

    if (!hasNode) selectedId = nodes[0].getAttribute('data-hfx-file-transfer-map-node-id') || selectedId;

    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      var selected = node.getAttribute('data-hfx-file-transfer-map-node-id') === selectedId;
      node.classList.toggle('is-active', selected);
      if (node.hasAttribute('aria-expanded')) node.setAttribute('aria-expanded', selected ? 'true' : 'false');
    }

    for (var k = 0; k < panels.length; k++) {
      var show = panels[k].getAttribute('data-hfx-file-transfer-map-detail-panel') === selectedId;
      panels[k].hidden = !show;
      panels[k].classList.toggle('is-active', show);
    }

    map.setAttribute('data-hfx-file-transfer-map-active', selectedId);
  }

  function initTransferMap(map) {
    if (!map || map.__hfx_file_transfer_map_init) return;
    map.__hfx_file_transfer_map_init = true;
    if (map.getAttribute('data-hfx-file-transfer-map-interactive') !== 'true') return;

    map.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var node = target.closest('[data-hfx-file-transfer-map-node-id]');
      if (!node || !map.contains(node)) return;
      setTransferMapNode(map, node.getAttribute('data-hfx-file-transfer-map-node-id'));
    });

    map.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var target = event.target;
      if (!target || !target.closest) return;
      var node = target.closest('[data-hfx-file-transfer-map-node-id]');
      if (!node || !map.contains(node)) return;
      event.preventDefault();
      setTransferMapNode(map, node.getAttribute('data-hfx-file-transfer-map-node-id'));
    });

    setTransferMapNode(map, map.getAttribute('data-hfx-file-transfer-map-active'));
  }

  function setGuidedFlowStep(flow, stepValue) {
    if (!flow) return;
    var tabs = toArray(flow.querySelectorAll('[data-hfx-file-guided-tab]'));
    var panels = toArray(flow.querySelectorAll('[data-hfx-file-guided-panel]'));
    if (!tabs.length || !panels.length) return;

    var step = String(stepValue || tabs[0].getAttribute('data-hfx-file-guided-tab') || '');
    var hasStep = false;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-hfx-file-guided-tab') === step) {
        hasStep = true;
        break;
      }
    }

    if (!hasStep) step = tabs[0].getAttribute('data-hfx-file-guided-tab') || step;

    for (var j = 0; j < tabs.length; j++) {
      var selected = tabs[j].getAttribute('data-hfx-file-guided-tab') === step;
      tabs[j].classList.toggle('is-active', selected);
      tabs[j].setAttribute('aria-selected', selected ? 'true' : 'false');
    }

    for (var k = 0; k < panels.length; k++) {
      var show = panels[k].getAttribute('data-hfx-file-guided-panel') === step;
      panels[k].hidden = !show;
      panels[k].classList.toggle('is-active', show);
    }

    flow.setAttribute('data-hfx-file-guided-flow-active', step);

    var index = tabs.findIndex ? tabs.findIndex(function (tab) {
      return tab.getAttribute('data-hfx-file-guided-tab') === step;
    }) : -1;
    var previous = flow.querySelector('[data-hfx-file-guided-flow-action="previous"]');
    var next = flow.querySelector('[data-hfx-file-guided-flow-action="next"]');
    if (previous) previous.disabled = index <= 0;
    if (next) next.disabled = index < 0 || index >= tabs.length - 1;
  }

  function initGuidedFlow(flow) {
    if (!flow || flow.__hfx_file_guided_flow_init) return;
    flow.__hfx_file_guided_flow_init = true;

    flow.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var tab = target.closest('[data-hfx-file-guided-tab]');
      if (tab && flow.contains(tab)) {
        event.preventDefault();
        setGuidedFlowStep(flow, tab.getAttribute('data-hfx-file-guided-tab'));
        return;
      }

      var action = target.closest('[data-hfx-file-guided-flow-action]');
      if (!action || !flow.contains(action)) return;

      event.preventDefault();
      var tabs = toArray(flow.querySelectorAll('[data-hfx-file-guided-tab]'));
      if (!tabs.length) return;

      var active = flow.getAttribute('data-hfx-file-guided-flow-active') || tabs[0].getAttribute('data-hfx-file-guided-tab');
      var activeIndex = 0;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].getAttribute('data-hfx-file-guided-tab') === active) {
          activeIndex = i;
          break;
        }
      }

      var nextIndex = action.getAttribute('data-hfx-file-guided-flow-action') === 'previous'
        ? Math.max(0, activeIndex - 1)
        : Math.min(tabs.length - 1, activeIndex + 1);
      setGuidedFlowStep(flow, tabs[nextIndex].getAttribute('data-hfx-file-guided-tab'));
    });

    setGuidedFlowStep(flow, flow.getAttribute('data-hfx-file-guided-flow-active'));
  }

  function init(root) {
    root = root || document;
    var sendForms = root.querySelectorAll('[data-hfx-file-service-send]');
    for (var i = 0; i < sendForms.length; i++) initSendForm(sendForms[i]);

    var shareForms = root.querySelectorAll('[data-hfx-file-share-options]');
    for (var j = 0; j < shareForms.length; j++) initShareOptions(shareForms[j]);

    var secureMessages = root.querySelectorAll('[data-hfx-file-secure-message]');
    for (var r = 0; r < secureMessages.length; r++) initSecureMessage(secureMessages[r]);

    var evidenceForms = root.querySelectorAll('[data-hfx-scan-evidence]');
    for (var k = 0; k < evidenceForms.length; k++) initEvidenceForm(evidenceForms[k]);

    var portalShells = root.querySelectorAll('[data-hfx-file-portal-shell]');
    for (var l = 0; l < portalShells.length; l++) initPortalShell(portalShells[l]);

    var transferLists = root.querySelectorAll('[data-hfx-file-transfer-list]');
    for (var m = 0; m < transferLists.length; m++) initTransferList(transferLists[m]);

    var transferMaps = root.querySelectorAll('[data-hfx-file-transfer-map]');
    for (var q = 0; q < transferMaps.length; q++) initTransferMap(transferMaps[q]);

    var proofNavs = root.querySelectorAll('.hfx-file-proof-nav');
    for (var n = 0; n < proofNavs.length; n++) initProofNav(proofNavs[n]);

    var proofControls = root.querySelectorAll('[data-hfx-file-proof-controls]');
    for (var o = 0; o < proofControls.length; o++) initProofControls(proofControls[o]);

    var guidedFlows = root.querySelectorAll('[data-hfx-file-guided-flow]');
    for (var p = 0; p < guidedFlows.length; p++) initGuidedFlow(guidedFlows[p]);
  }

  window.HfxFileService = window.HfxFileService || {};
  window.HfxFileService.init = init;
  window.HfxFileService.setPortalDrawer = setPortalDrawer;
  window.HfxFileService.setTransferMapNode = setTransferMapNode;
  window.HfxFileService.setGuidedFlowStep = setGuidedFlowStep;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
