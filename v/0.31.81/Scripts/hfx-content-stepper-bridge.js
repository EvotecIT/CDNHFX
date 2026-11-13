/* HFX compatibility and layout bridge. The interaction engine lives in hfx-content-stepper.js. */
(function () {
  'use strict';
  var instances = new WeakMap();
  function resolve(root) { return typeof root === 'string' ? document.querySelector(root) : root; }
  function engine() { return window.hfxContentStepperEngine; }
  function init(root, options, settings, handlers, validators, ajax) {
    root = resolve(root);
    if (!root) return;
    if (instances.has(root)) return instances.get(root).api;
    var lifecycle = new AbortController();
    function layout(event) {
      if (event.target !== root) return;
      var index = event.detail.stepIndex;
      var link = root.querySelector(':scope > [role="tablist"] [data-step-index="' + index + '"]');
      var panel = link && document.getElementById(link.getAttribute('aria-controls'));
      if (panel) panel.dispatchEvent(new CustomEvent('shown.bs.tab', { bubbles: true }));
      window.dispatchEvent(new Event('resize'));
    }
    root.addEventListener('hfx:stepper:showStep', layout, { signal: lifecycle.signal });
    root.addEventListener('hfx:stepper:loaded', layout, { signal: lifecycle.signal });
    var instance = { api: null, lifecycle: lifecycle };
    instances.set(root, instance);
    try {
      var api = engine().init(root, {
        options: options, settings: settings, handlers: handlers, validators: validators, ajax: ajax,
        connect: function (controller) { instance.api = controller; }
      });
      instance.api = api;
      return api;
    } catch (error) {
      lifecycle.abort();
      instances.delete(root);
      throw error;
    }
  }
  function command(root, method) {
    root = resolve(root);
    var instance = instances.get(root);
    if (!instance || !instance.api || typeof instance.api[method] !== 'function') return;
    var result = instance.api[method].apply(instance.api, Array.prototype.slice.call(arguments, 2));
    if (method === 'destroy') { instance.lifecycle.abort(); instances.delete(root); }
    return result;
  }
  window.hfxContentStepper = {
    init: init,
    goToStep: function (root, index, force) { return command(root, 'goToStep', index, force); },
    next: function (root) { return command(root, 'next'); },
    prev: function (root) { return command(root, 'prev'); },
    on: function (root, name, handler) { return engine().on(resolve(root), name, handler); },
    command: command
  };
  // Existing HFX live-demo helpers forward to the same native owner.
  window.hfxSmartWizardCommand = command;
  window.hfxSmartWizardDestroy = function (root) { command(root, 'destroy'); };
  window.hfxSmartWizardSetJustified = function (root, value) { resolve(root).classList.toggle('sw-justified', !!value); };
  window.hfxSmartWizardSetStyle = function (root, theme) {
    root = resolve(root);
    theme = String(theme).toLowerCase();
    root.setAttribute('data-hfx-stepper-variant', theme === 'arrows' ? 'arrows' : theme === 'dots' ? 'dots' : /^(square|round|pills|chips)$/.test(theme) ? 'pills' : 'basic');
    if (theme === 'dark') root.setAttribute('data-bs-theme', 'dark'); else root.removeAttribute('data-bs-theme');
  };
  window.hfxSmartWizardSetToolbar = function (root, position) { command(root, 'setToolbar', position); };
  window.hfxSmartWizardSetAccent = function (root, accent) {
    root = resolve(root);
    ['blue', 'green', 'red', 'purple', 'sea'].forEach(function (name) { root.classList.remove('hfx-sw-accent-' + name); });
    accent = String(accent).toLowerCase();
    if (/^(blue|green|red|purple|sea)$/.test(accent)) root.classList.add('hfx-sw-accent-' + accent);
  };
})();
