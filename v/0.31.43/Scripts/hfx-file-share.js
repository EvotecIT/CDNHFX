(function () {
  'use strict';

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

  function init(root) {
    root = root || document;
    var shareForms = root.querySelectorAll('[data-hfx-file-share-options]');
    for (var i = 0; i < shareForms.length; i++) initShareOptions(shareForms[i]);
  }

  window.HfxFileShare = window.HfxFileShare || {};
  window.HfxFileShare.init = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
