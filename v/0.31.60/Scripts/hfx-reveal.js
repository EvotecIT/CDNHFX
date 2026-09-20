(function () {
  'use strict';

  if (window.__hfxRevealInitDone) return;
  window.__hfxRevealInitDone = true;

  function closestTrigger(el) {
    while (el) {
      try {
        if (el.getAttribute && el.getAttribute('data-hfx-reveal-target')) return el;
      } catch (_e) { }
      el = el.parentNode;
    }
    return null;
  }

  function resolveTarget(root, selector) {
    if (!selector) return null;
    try { return (root || document).querySelector(selector); } catch (_e) { return null; }
  }

  function isPasswordInput(input) {
    try {
      var t = (input.getAttribute('type') || '').toLowerCase();
      return t === 'password';
    } catch (_e) { return false; }
  }

  function setTriggerState(trigger, revealed) {
    if (!trigger) return;
    try { trigger.setAttribute('aria-pressed', revealed ? 'true' : 'false'); } catch (_e) { }

    // Update title / aria-label if provided as data attributes
    var titleAttr = revealed ? 'data-hfx-reveal-title-hide' : 'data-hfx-reveal-title-show';
    var ariaAttr = revealed ? 'data-hfx-reveal-aria-hide' : 'data-hfx-reveal-aria-show';

    try {
      var t = trigger.getAttribute(titleAttr);
      if (t) trigger.setAttribute('title', t);
    } catch (_e1) { }

    try {
      var a = trigger.getAttribute(ariaAttr);
      if (a) trigger.setAttribute('aria-label', a);
    } catch (_e2) { }
  }

  function toggle(trigger, input) {
    if (!trigger || !input) return;

    var wasPassword = isPasswordInput(input);
    var toPassword = !wasPassword ? true : false;

    try { input.setAttribute('type', toPassword ? 'password' : 'text'); } catch (_e) { }

    // Focus the input for better UX (do not select text)
    try { if (typeof input.focus === 'function') input.focus({ preventScroll: true }); } catch (_e2) { }

    setTriggerState(trigger, !toPassword);
  }

  function initReveal(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;
      var triggers = root.querySelectorAll('[data-hfx-reveal-target]');
      for (var i = 0; i < triggers.length; i++) {
        var trig = triggers[i];
        var sel = trig.getAttribute('data-hfx-reveal-target');
        var input = resolveTarget(root, sel) || resolveTarget(document, sel);
        if (input) {
          setTriggerState(trig, !isPasswordInput(input));
        }
      }
    } catch (_e) { }
  }

  document.addEventListener('click', function (e) {
    try {
      var trigger = closestTrigger(e.target);
      if (!trigger) return;
      var sel = trigger.getAttribute('data-hfx-reveal-target');
      var input = resolveTarget(document, sel);
      if (!input) return;
      e.preventDefault();
      toggle(trigger, input);
    } catch (_e) { }
  });

  // Keyboard accessibility: Enter/Space on the trigger
  document.addEventListener('keydown', function (e) {
    try {
      if (!e) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var trigger = closestTrigger(e.target);
      if (!trigger) return;
      var sel = trigger.getAttribute('data-hfx-reveal-target');
      var input = resolveTarget(document, sel);
      if (!input) return;
      e.preventDefault();
      toggle(trigger, input);
    } catch (_e) { }
  });

  // Expose for dynamic apps (fragments injected after initial load)
  window.hfxInitReveal = initReveal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initReveal(document); });
  } else {
    initReveal(document);
  }
})();

