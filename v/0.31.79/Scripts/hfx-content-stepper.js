/* HtmlForgeX native content stepper. Original HFX implementation; no jQuery or vendor wizard code. */
(function () {
  'use strict';
  var instances = new WeakMap();
  function resolve(root) { return typeof root === 'string' ? document.querySelector(root) : root; }
  function init(root, configuration) {
    configuration = configuration || {};
    var options = configuration.options;
    var settings = configuration.settings;
    var handlers = configuration.handlers;
    var validators = configuration.validators;
    var ajax = configuration.ajax;
    root = resolve(root);
    if (!root) return;
    if (instances.has(root)) return instances.get(root);
    options = options || {};
    settings = settings || {};
    handlers = handlers || {};
    validators = validators || {};
    ajax = ajax || [];
    // Direct children only: nested steppers and tabs keep their own state and keyboard scope.
    var nav = root.querySelector(':scope > [role="tablist"]');
    var links = Array.from(nav.querySelectorAll(':scope > [role="presentation"] > [role="tab"]'));
    var content = root.querySelector(':scope > .sw-content');
    var panels = Array.from(content.children).filter(function (p) { return p.matches('[role="tabpanel"]'); });
    var picker = root.querySelector(':scope > .hfx-stepper-compact select');
    var counter = root.querySelector(':scope > .hfx-stepper-compact .hfx-stepper-counter');
    var previous = Array.from(root.querySelectorAll(':scope > .hfx-stepper-toolbar > .sw-btn-prev'));
    var next = Array.from(root.querySelectorAll(':scope > .hfx-stepper-toolbar > .sw-btn-next'));
    var navigation = options.navigation || {};
    var completedOptions = navigation.completed || {};
    var behavior = options.behavior || {};
    var states = options.stepStates || {};
    var hidden = new Set(states.hidden || []);
    var disabled = new Set(states.disabled || []);
    var completed = new Set(states.completed || []);
    var loaded = new Set();
    var loading = new Map();
    var controller = new AbortController();
    var active = -1;
    var destroyed = false;
    var initial = Number.isInteger(options.initialStep) ? options.initialStep : 0;
    links.forEach(function (link, i) {
      if (link.closest('li').hidden || link.style.display === 'none') hidden.add(i);
      if (link.classList.contains('disabled')) disabled.add(i);
      if (link.classList.contains('completed')) completed.add(i);
    });
    (states.error || []).forEach(function (i) { if (links[i]) links[i].classList.add('error'); });
    (states.warning || []).forEach(function (i) { if (links[i]) links[i].classList.add('warning'); });
    var baseline = { hidden: new Set(hidden), disabled: new Set(disabled), completed: new Set(completed), classes: links.map(function (link) { return link.className; }) };
    function available(i) { return i >= 0 && i < links.length && !hidden.has(i) && !disabled.has(i); }
    function adjacent(from, direction) {
      for (var i = from + direction; i >= 0 && i < links.length; i += direction) if (available(i)) return i;
      return -1;
    }
    function clickable(i) {
      return available(i) && navigation.enabled !== false &&
        (i === active || navigation.alwaysClickable === true || (completed.has(i) && completedOptions.clickable !== false));
    }
    function emit(name, from, to, cancelable, direction) {
      var args = { stepIndex: from, nextStepIndex: to, stepDirection: direction || (to >= from ? 'forward' : 'backward') };
      var event = new CustomEvent('hfx:stepper:' + name, { bubbles: true, cancelable: !!cancelable, detail: args });
      var handler = handlers[name];
      if (typeof handler === 'function' && handler.call(root, event, args) === false && cancelable) event.preventDefault();
      root.dispatchEvent(event);
      return !event.defaultPrevented;
    }
    function load(i) {
      var cfg = ajax.find(function (a) { return a.index === i; });
      if (!cfg || loaded.has(i) && cfg.cache !== false || loading.has(i)) return;
      var panel = panels[i];
      var request = new AbortController();
      loading.set(i, request);
      panel.setAttribute('aria-busy', 'true');
      fetch(cfg.url, { signal: request.signal, cache: cfg.cache === false ? 'no-store' : 'default' })
        .then(function (response) { if (!response.ok) throw new Error('Step content request failed'); return response.text(); })
        .then(function (html) {
          if (destroyed) return;
          panel.innerHTML = html;
          loaded.add(i);
          emit('loaded', i, i);
        })
        .catch(function (error) {
          if (destroyed || error.name === 'AbortError') return;
          var message = document.createElement('div');
          message.className = 'alert alert-danger';
          message.setAttribute('role', 'alert');
          message.textContent = 'Failed to load step content. Select this step again to retry.';
          panel.replaceChildren(message);
        })
        .finally(function () { loading.delete(i); panel.removeAttribute('aria-busy'); });
    }
    function updateNavigationEdges() {
      var bounds = nav.getBoundingClientRect();
      var visible = links.filter(function (link) { return !link.parentElement.hidden; });
      nav.toggleAttribute('data-scroll-start', visible.some(function (link) { return link.getBoundingClientRect().left < bounds.left - 1; }));
      nav.toggleAttribute('data-scroll-end', visible.some(function (link) { return link.getBoundingClientRect().right > bounds.right + 1; }));
    }
    function revealActiveStep() {
      if (destroyed || !nav.clientWidth || root.classList.contains('sw-vertical')) return;
      var link = links[active];
      if (link) {
        var bounds = nav.getBoundingClientRect();
        var item = link.getBoundingClientRect();
        var inset = parseFloat(getComputedStyle(nav).scrollPaddingLeft) || 0;
        // Scroll only this bar; selecting a step must not move the report vertically.
        if (item.left < bounds.left + inset) nav.scrollBy({ left: item.left - bounds.left - inset });
        else if (item.right > bounds.right - inset) nav.scrollBy({ left: item.right - bounds.right + inset });
      }
      updateNavigationEdges();
    }
    var navigationObserver = new ResizeObserver(revealActiveStep);
    navigationObserver.observe(nav);
    listen(nav, 'scroll', updateNavigationEdges);
    function sync() {
      var visible = links.filter(function (_, i) { return !hidden.has(i); });
      links.forEach(function (link, i) {
        var selected = i === active;
        link.classList.toggle('active', selected);
        link.classList.toggle('completed', completed.has(i));
        link.classList.toggle('disabled', disabled.has(i));
        link.setAttribute('aria-selected', String(selected));
        link.setAttribute('aria-disabled', String(!clickable(i)));
        link.tabIndex = selected ? 0 : -1;
        link.parentElement.hidden = hidden.has(i);
        link.parentElement.classList.toggle('active', selected);
        link.style.removeProperty('display');
        panels[i].style.removeProperty('display');
        panels[i].classList.toggle('active', selected);
        panels[i].setAttribute('data-hfx-step-hidden', String(hidden.has(i)));
        picker.options[i].hidden = hidden.has(i);
        picker.options[i].disabled = !clickable(i);
      });
      picker.value = String(active);
      picker.disabled = active < 0 || navigation.enabled === false;
      var ordinal = active < 0 ? 0 : visible.indexOf(links[active]) + 1;
      counter.textContent = 'Step ' + ordinal + ' of ' + visible.length;
      previous.forEach(function (b) { b.disabled = adjacent(active, -1) < 0 || active < 0; });
      next.forEach(function (b) { b.disabled = adjacent(active, 1) < 0 || active < 0; });
      var progress = root.querySelector(':scope > .progress > .progress-bar');
      if (progress) {
        progress.style.width = (visible.length ? ordinal / visible.length * 100 : 0) + '%';
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', String(visible.length));
        progress.setAttribute('aria-valuenow', String(ordinal));
        progress.setAttribute('aria-label', 'Step progress');
      }
      revealActiveStep();
    }
    function select(i, force, focus, updateHash, resetting) {
      i = Number(i);
      if (!Number.isInteger(i) || !available(i)) { sync(); return false; }
      if (i === active) { sync(); load(i); return true; }
      var from = active;
      if (from >= 0 && !force) {
        if (i > from) {
          var validate = validators[from];
          if (typeof validate === 'string') validate = window[validate];
          if (typeof validate === 'function' && validate(from, i) === false) { sync(); return false; }
          if (settings.validation) {
            var invalid = panels[from].querySelector('input:invalid,select:invalid,textarea:invalid');
            if (invalid) { invalid.reportValidity(); sync(); return false; }
          }
        }
        if (!emit('leaveStep', from, i, true)) { sync(); return false; }
      }
      if (!resetting && from >= 0 && completedOptions.enabled !== false) {
        completed.add(from);
        if (completedOptions.clearOnBack && i < from) {
          completed.forEach(function (index) { if (index >= i) completed.delete(index); });
        }
      }
      if (!resetting && completedOptions.enabled !== false && completedOptions.completeAllPreviousSteps !== false && i > from) {
        for (var prior = 0; prior < i; prior++) if (available(prior)) completed.add(prior);
      }
      active = i;
      sync();
      load(i);
      if (updateHash !== false && behavior.useUrlHash !== false) {
        var hash = '#' + encodeURIComponent(panels[i].id);
        if (location.hash !== hash) history[behavior.supportBrowserHistory === false ? 'replaceState' : 'pushState'](null, '', hash);
      }
      if (focus) {
        if (window.matchMedia('(max-width: 575.98px)').matches) picker.focus();
        else links[i].focus();
      }
      if (options.scrollToView) root.scrollIntoView({ block: 'nearest' });
      emit('showStep', i, i, false, i >= from ? 'forward' : 'backward');
      return true;
    }
    function listen(target, name, fn) { target.addEventListener(name, fn, { signal: controller.signal }); }
    listen(nav, 'click', function (event) {
      var link = event.target.closest('[role="tab"]');
      var i = links.indexOf(link);
      if (i < 0) return;
      event.preventDefault();
      if (clickable(i)) select(i, false, false);
    });
    listen(picker, 'change', function () {
      var i = Number(picker.value);
      if (clickable(i)) select(i, false, true); else sync();
    });
    listen(nav, 'keydown', function (event) {
      if (options.keyboardNavigation && options.keyboardNavigation.enabled === false) return;
      var from = links.indexOf(event.target);
      if (from < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
      var keys = options.keyboardNavigation && options.keyboardNavigation.keys || {};
      var rtl = getComputedStyle(root).direction === 'rtl';
      var destination = -1;
      if ((options.keyboardNavigation && options.keyboardNavigation.home || [36]).indexOf(event.keyCode) >= 0) destination = adjacent(-1, 1);
      else if ((options.keyboardNavigation && options.keyboardNavigation.end || [35]).indexOf(event.keyCode) >= 0) destination = adjacent(links.length, -1);
      else if ((keys.left || [37, 38]).indexOf(event.keyCode) >= 0) destination = adjacent(from, rtl && event.keyCode === 37 ? 1 : -1);
      else if ((keys.right || [39, 40]).indexOf(event.keyCode) >= 0) destination = adjacent(from, rtl && event.keyCode === 39 ? -1 : 1);
      else return;
      event.preventDefault();
      if (destination >= 0) select(destination, false, true);
    });
    previous.forEach(function (button) { listen(button, 'click', function () { select(adjacent(active, -1), false, true); }); });
    next.forEach(function (button) { listen(button, 'click', function () { select(adjacent(active, 1), false, true); }); });
    function hashIndex() {
      var id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return -1; }
      return panels.findIndex(function (panel) { return panel.id === id; });
    }
    if (behavior.useUrlHash !== false && behavior.supportBrowserHistory !== false) {
      var followHistory = function () {
        var i = location.hash ? hashIndex() : initial;
        if (i >= 0 && i !== active) select(i, false, false, false);
      };
      listen(window, 'popstate', followHistory);
      listen(window, 'hashchange', followHistory);
    }
    if (options.swipeNavigation && options.swipeNavigation.enabled) {
      var start;
      listen(content, 'touchstart', function (event) {
        if (event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) { start = null; return; }
        start = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
      });
      listen(content, 'touchend', function (event) {
        if (!start || !event.changedTouches.length) return;
        var dx = event.changedTouches[0].clientX - start.x;
        var dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) >= (options.swipeNavigation.threshold || 60) && Math.abs(dx) > Math.abs(dy)) select(adjacent(active, dx < 0 ? 1 : -1), false, false);
        start = null;
      });
    }
    var api = {
      options: options,
      next: function () { return select(adjacent(active, 1), false, true); },
      prev: function () { return select(adjacent(active, -1), false, true); },
      goToStep: function (i, force) { return select(i, !!force, true); },
      reset: function () {
        hidden = new Set(baseline.hidden);
        disabled = new Set(baseline.disabled);
        completed = new Set(baseline.completed);
        links.forEach(function (link, i) { link.className = baseline.classes[i]; });
        var target = available(initial) ? initial : adjacent(-1, 1);
        if (completedOptions.enabled !== false && completedOptions.completeAllPreviousSteps !== false) {
          for (var i = 0; i < target; i++) if (available(i)) completed.add(i);
        }
        return select(target, true, true, true, true);
      },
      setToolbar: function (position) {
        position = String(position).toLowerCase();
        var toolbars = Array.from(root.querySelectorAll(':scope > .hfx-stepper-toolbar'));
        var template = toolbars[0];
        if (!template) {
          template = document.createElement('div');
          template.className = 'sw-toolbar hfx-stepper-toolbar';
          var labels = options.localization && options.localization.buttons || {};
          ['prev', 'next'].forEach(function (direction) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn sw-btn-' + direction + (direction === 'prev' ? ' btn-outline-secondary' : ' btn-primary');
            button.textContent = direction === 'prev' ? labels.previous || 'Previous' : labels.next || 'Next';
            template.appendChild(button);
          });
        }
        toolbars.forEach(function (toolbar) { toolbar.remove(); });
        ['top', 'bottom'].forEach(function (place) {
          if (position !== place && position !== 'both') return;
          var toolbar = template.cloneNode(true);
          toolbar.setAttribute('data-position', place);
          if (place === 'top') root.insertBefore(toolbar, content); else root.appendChild(toolbar);
        });
        previous = Array.from(root.querySelectorAll(':scope > .hfx-stepper-toolbar > .sw-btn-prev'));
        next = Array.from(root.querySelectorAll(':scope > .hfx-stepper-toolbar > .sw-btn-next'));
        previous.forEach(function (button) { listen(button, 'click', function () { api.prev(); }); });
        next.forEach(function (button) { listen(button, 'click', function () { api.next(); }); });
        sync();
      },
      setState: function (indices, state) {
        (indices || []).forEach(function (i) {
          if (i < 0 || i >= links.length) return;
          if (state === 'active') { select(i, true, false); return; }
          if (state === 'default') { disabled.delete(i); hidden.delete(i); completed.delete(i); links[i].classList.remove('error', 'warning'); }
          if (state === 'completed') completed.add(i);
          if (state === 'disable' || state === 'disabled') disabled.add(i);
          if (state === 'hidden') hidden.add(i);
          if (state === 'error' || state === 'warning') links[i].classList.add(state);
        });
        if (!available(active)) { active = -1; select(adjacent(-1, 1), true, false); }
        sync();
      },
      destroy: function () {
        destroyed = true;
        controller.abort();
        navigationObserver.disconnect();
        loading.forEach(function (request) { request.abort(); });
        root.removeAttribute('data-hfx-sw-init');
        instances.delete(root);
      }
    };
    instances.set(root, api);
    if (typeof configuration.connect === 'function') configuration.connect(api);
    root.setAttribute('data-hfx-sw-init', '1');
    var deepLink = behavior.useUrlHash !== false ? hashIndex() : -1;
    if (!available(initial)) initial = adjacent(-1, 1);
    select(available(deepLink) ? deepLink : initial, true, false, false);
    sync();
    emit('initialized', active, active);
    return api;
  }
  function invoke(root, method, args) {
    var api = instances.get(resolve(root));
    if (api) return api[method].apply(api, args || []);
  }
  function on(root, name, handler) {
    root = resolve(root);
    var listener = function (event) {
      if (event.target !== root) return;
      if (handler.call(root, event, event.detail) === false && event.cancelable) event.preventDefault();
    };
    root.addEventListener('hfx:stepper:' + name, listener);
    return function () { root.removeEventListener('hfx:stepper:' + name, listener); };
  }
  // Replace this engine behind the HFX bridge when CanopyX UI supplies its stepper.
  // The role-based markup, C# initialization calls and public HFX event names stay stable.
  window.hfxContentStepperEngine = {
    init: init,
    goToStep: function (root, index, force) { return invoke(root, 'goToStep', [index, force]); },
    next: function (root) { return invoke(root, 'next'); },
    prev: function (root) { return invoke(root, 'prev'); },
    on: on
  };
})();
