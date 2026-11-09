(function () {
  function activate(preview, key) {
    preview.setAttribute('data-hfx-dashboard-model-active', key);
    preview.querySelectorAll('[data-hfx-dashboard-model-choice]').forEach(function (button) {
      var active = button.getAttribute('data-hfx-dashboard-model-choice') === key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    preview.querySelectorAll('[data-hfx-dashboard-model-panel]').forEach(function (panel) {
      var active = panel.getAttribute('data-hfx-dashboard-model-panel') === key;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    preview.dispatchEvent(new CustomEvent('hfx:dashboard-model-change', {
      bubbles: true,
      detail: { model: key }
    }));
  }

  function moveChoice(preview, current, direction) {
    var buttons = Array.prototype.slice.call(preview.querySelectorAll('[data-hfx-dashboard-model-choice]'));
    var index = buttons.indexOf(current);
    if (index < 0 || buttons.length === 0) return;
    var next = buttons[(index + direction + buttons.length) % buttons.length];
    next.focus();
    activate(preview, next.getAttribute('data-hfx-dashboard-model-choice'));
  }

  function bind() {
    document.querySelectorAll('[data-hfx-dashboard-model-preview]').forEach(function (preview) {
      if (preview.__hfxDashboardModelPreviewBound) return;
      preview.__hfxDashboardModelPreviewBound = true;
      activate(preview, preview.getAttribute('data-hfx-dashboard-model-active') || 'detached');
      preview.addEventListener('click', function (event) {
        var button = event.target.closest('[data-hfx-dashboard-model-choice]');
        if (!button || !preview.contains(button)) return;
        activate(preview, button.getAttribute('data-hfx-dashboard-model-choice'));
      });
      preview.addEventListener('keydown', function (event) {
        var button = event.target.closest('[data-hfx-dashboard-model-choice]');
        if (!button || !preview.contains(button)) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          moveChoice(preview, button, 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          moveChoice(preview, button, -1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          var first = preview.querySelector('[data-hfx-dashboard-model-choice]');
          if (first) {
            first.focus();
            activate(preview, first.getAttribute('data-hfx-dashboard-model-choice'));
          }
        } else if (event.key === 'End') {
          event.preventDefault();
          var choices = preview.querySelectorAll('[data-hfx-dashboard-model-choice]');
          var last = choices[choices.length - 1];
          if (last) {
            last.focus();
            activate(preview, last.getAttribute('data-hfx-dashboard-model-choice'));
          }
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
