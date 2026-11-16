(function () {
  function formatTime(date) {
    try {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    } catch (_e) {
      var h = date.getHours();
      var m = String(date.getMinutes()).padStart(2, '0');
      var s = String(date.getSeconds()).padStart(2, '0');
      return h + ':' + m + ':' + s;
    }
  }

  function findTimestamp(root) {
    if (!root) return null;
    var el = root.querySelector('[data-hfx-panel-timestamp]');
    if (el) return el;
    return document.querySelector('.page-header .page-pretitle');
  }

  function updateTimestamp(root) {
    var el = findTimestamp(root || document);
    if (!el) return;
    el.textContent = 'UPDATED ' + formatTime(new Date());
  }

  function togglePanels() {
    try { document.body.classList.toggle('hfx-panel-compact'); } catch (_e) { }
  }

  function syncPanelButtons(root) {
    if (!root || !root.querySelectorAll) return;
    var compact = false;
    try { compact = document.body.classList.contains('hfx-panel-compact'); } catch (_e) { }
    var buttons = root.querySelectorAll('[data-hfx-panel-action=\"panels\"]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (!btn || !btn.classList) continue;
      if (compact) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      try { btn.setAttribute('aria-pressed', compact ? 'true' : 'false'); } catch (_p) { }
    }
  }

  function bindActions(root) {
    if (!root || !root.querySelectorAll) return;
    var buttons = root.querySelectorAll('[data-hfx-panel-action]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (!btn || btn.__hfx_panel_init) continue;
      btn.__hfx_panel_init = true;

      btn.addEventListener('click', function (e) {
        var action = this.getAttribute('data-hfx-panel-action');
        if (!action) return;

        if (action === 'panels') {
          togglePanels();
          syncPanelButtons(document);
        } else if (action === 'refresh') {
          updateTimestamp(document);
        }
      });
    }
  }

  function init() {
    updateTimestamp(document);
    bindActions(document);
    syncPanelButtons(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
