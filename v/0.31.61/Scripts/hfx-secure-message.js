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

  function init(root) {
    root = root || document;
    var secureMessages = root.querySelectorAll('[data-hfx-file-secure-message]');
    for (var i = 0; i < secureMessages.length; i++) initSecureMessage(secureMessages[i]);
  }

  window.HfxSecureMessage = window.HfxSecureMessage || {};
  window.HfxSecureMessage.init = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
