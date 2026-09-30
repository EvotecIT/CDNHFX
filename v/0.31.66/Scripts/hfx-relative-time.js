(function(){
  function formatRelative(diffMs, style){
    var diffSec = Math.round(diffMs / 1000);
    var absSec = Math.abs(diffSec);
    var value, unit;
    if (absSec >= 86400) { value = Math.round(absSec / 86400); unit = value === 1 ? 'day' : 'days'; }
    else if (absSec >= 3600) { value = Math.round(absSec / 3600); unit = value === 1 ? 'hour' : 'hours'; }
    else if (absSec >= 60) { value = Math.round(absSec / 60); unit = value === 1 ? 'minute' : 'minutes'; }
    else { value = Math.max(0, Math.round(absSec)); unit = value === 1 ? 'second' : 'seconds'; }
    if (style === 'compact'){
      var u = unit.charAt(0);
      if (unit === 'minute' || unit === 'minutes') u = 'm';
      if (unit === 'hour' || unit === 'hours') u = 'h';
      if (unit === 'day' || unit === 'days') u = 'd';
      if (unit === 'second' || unit === 'seconds') u = 's';
      if (diffSec < 0) { return 'in ' + value + u; }
      return value + u + ' ago';
    }
    if (diffSec < 0) { return 'in ' + value + ' ' + unit; }
    return value + ' ' + unit + ' ago';
  }

  function pad(n){ return (n < 10 ? '0' : '') + n; }

  function formatAbsolute(date, mode, format, tz, offsetMin, locale){
    var dt = date;
    if (tz === 'fixed' && typeof offsetMin === 'number' && !isNaN(offsetMin)) {
      dt = new Date(date.getTime() + offsetMin * 60000);
    }
    if (format === 'iso-utc') {
      var iso = date.toISOString();
      return iso.replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
    }
    if (format === 'iso-local') {
      return dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    }
    if (format === 'date') {
      return dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate());
    }
    if (format === 'time-24') {
      return pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    }
    if (format === 'datetime-24') {
      return dt.getFullYear() + '-' + pad(dt.getMonth()+1) + '-' + pad(dt.getDate()) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
    }
    if (tz === 'utc') {
      return dt.toLocaleString(locale || undefined, { timeZone: 'UTC' });
    }
    return dt.toLocaleString(locale || undefined);
  }

  function applyColor(el, ageSeconds){
    var thresholdsRaw = el.getAttribute('data-hfx-rt-thresholds');
    if (!thresholdsRaw) return;
    var thresholds;
    try { thresholds = JSON.parse(thresholdsRaw); } catch (e) { return; }
    if (!thresholds || !thresholds.length) return;

    var chosen = null;
    for (var i = 0; i < thresholds.length; i++){
      var t = thresholds[i];
      if (ageSeconds >= t.s) { chosen = t.c; }
    }

    var allClasses = (el.getAttribute('data-hfx-rt-classes') || '').split(' ');
    for (var j = 0; j < allClasses.length; j++){
      var cls = allClasses[j];
      if (cls) el.classList.remove(cls);
    }

    var fallback = el.getAttribute('data-hfx-rt-default');
    var finalClass = chosen || fallback;
    if (finalClass) el.classList.add(finalClass);
  }

  function updateOne(el){
    var iso = el.getAttribute('data-hfx-rt-utc');
    if (!iso) return;
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return;
    var now = new Date();
    var diff = now.getTime() - dt.getTime();
    var relStyle = el.getAttribute('data-hfx-rt-rel-style') || 'full';
    var rel = formatRelative(diff, relStyle);
    var mode = el.getAttribute('data-hfx-rt-mode') || 'relative';
    var tz = el.getAttribute('data-hfx-rt-abs-tz') || 'local';
    var fmt = el.getAttribute('data-hfx-rt-abs-format') || 'default';
    var locale = el.getAttribute('data-hfx-rt-locale') || null;
    var offsetRaw = el.getAttribute('data-hfx-rt-abs-offset-min');
    var offsetMin = offsetRaw !== null ? parseInt(offsetRaw, 10) : null;
    var abs = formatAbsolute(dt, mode, fmt, tz, offsetMin, locale);
    var text = rel;
    if (mode === 'absolute-only') { text = abs; }
    else if (mode === 'absolute-relative') { text = abs + ' (' + rel + ')'; }
    else if (mode === 'relative-absolute') { text = rel + ' (' + abs + ')'; }
    el.textContent = text;
    if (el.getAttribute('data-hfx-rt-tooltip') === 'true') {
      el.title = abs;
    }
    var ageSeconds = Math.abs(diff) / 1000;
    applyColor(el, ageSeconds);
  }

  function updateAll(){
    var els = document.querySelectorAll('[data-hfx-relative-time]');
    for (var i = 0; i < els.length; i++){
      updateOne(els[i]);
    }
  }

  function init(){
    updateAll();
    var els = document.querySelectorAll('[data-hfx-relative-time][data-hfx-rt-refresh]');
    if (!els.length) return;
    var min = null;
    for (var i = 0; i < els.length; i++){
      var val = parseInt(els[i].getAttribute('data-hfx-rt-refresh'), 10);
      if (!isNaN(val) && val > 0){
        min = min === null ? val : Math.min(min, val);
      }
    }
    if (min !== null) {
      setInterval(updateAll, min * 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
