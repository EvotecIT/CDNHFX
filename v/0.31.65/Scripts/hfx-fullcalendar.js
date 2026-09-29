(function () {
  'use strict';

  try {
    window.calendarTracker = window.calendarTracker || {};
  } catch (_e) { /* ignore */ }

  function isInitialized(el) {
    try {
      return el && el.getAttribute && el.getAttribute('data-hfx-fullcalendar-init') === '1';
    } catch (_e) {
      return false;
    }
  }

  function markInitialized(el) {
    try { if (el && el.setAttribute) el.setAttribute('data-hfx-fullcalendar-init', '1'); } catch (_e) { /* ignore */ }
  }

  function storeCalendar(id, cal) {
    if (!id || !cal) return;
    try {
      if (window.calendarTracker) window.calendarTracker[id] = cal;
      else if (typeof calendarTracker !== 'undefined') calendarTracker[id] = cal;
    } catch (_e) { /* ignore */ }
  }

  function initOne(el, options, cfg) {
    try {
      if (!el) return null;
      if (isInitialized(el)) return null;
      markInitialized(el);

      var id = (cfg && cfg.id) ? String(cfg.id) : (el.id ? String(el.id) : '');
      if (typeof FullCalendar === 'undefined' || !FullCalendar || !FullCalendar.Calendar) return null;

      var calendar = new FullCalendar.Calendar(el, options || {});
      try { calendar.render(); } catch (_e) { /* ignore */ }
      storeCalendar(id, calendar);
      return calendar;
    } catch (_e) {
      return null;
    }
  }

  function init(elOrSelector, options, cfg) {
    var el = elOrSelector;
    try { if (typeof elOrSelector === 'string') el = document.querySelector(elOrSelector); } catch (_e) { /* ignore */ }
    return initOne(el, options, cfg || {});
  }

  function initById(id, options, cfg) {
    var calendarId = (id == null) ? '' : String(id);
    var el = null;
    try { el = document.getElementById(calendarId); } catch (_e) { el = null; }
    var config = cfg || {};
    if (!config.id) config.id = calendarId;
    return initOne(el, options, config);
  }

  window.hfxFullCalendar = window.hfxFullCalendar || {};
  window.hfxFullCalendar.init = init;
  window.hfxFullCalendar.initById = initById;
})();
