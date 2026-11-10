// Keep report provenance and figure strips readable as their available width changes.
(function () {
  if (window.hfxReportResponsive) return;
  window.hfxReportResponsive = true;

  function initProvenance(shell) {
    if (shell.__hfxResponsiveProvenance) return;
    var bar = shell.querySelector('.hfx-shell-bar-inner');
    var note = shell.querySelector('.hfx-shell-bar-provenance');
    if (!bar || !note) return;
    var line = note.querySelector('.hfx-shell-bar-prov-items');
    var more = note.querySelector('.hfx-shell-prov-more');
    var panel = more && more.querySelector('.hfx-shell-prov-more-items');
    if (!line || !more || !panel) return;
    shell.__hfxResponsiveProvenance = true;
    var optional = Array.prototype.slice.call(line.querySelectorAll('[data-hfx-prov-priority]'));
    var queued = false;
    function fit() {
      queued = false;
      shell.classList.remove('has-tight-provenance');
      panel.querySelectorAll('[data-hfx-prov-full-time]').forEach(function (item) { item.remove(); });
      optional.forEach(function (item) { line.appendChild(item); });
      more.hidden = true;
      if (window.matchMedia('(max-width: 575.98px)').matches) { more.open = false; return; }
      for (var i = 0; i < optional.length && line.scrollWidth > line.clientWidth + 1; i++) {
        more.hidden = false;
        panel.appendChild(optional[i]);
      }
      if (line.scrollWidth > line.clientWidth + 1) {
        shell.classList.add('has-tight-provenance');
        Array.prototype.forEach.call(line.children, function (item) {
          item.title = item.textContent.trim();
          var full = document.createElement('div');
          full.className = 'hfx-shell-prov-item';
          full.setAttribute('data-hfx-prov-full-time', '');
          full.textContent = item.textContent.trim();
          panel.appendChild(full);
        });
        more.hidden = false;
      }
      if (!panel.childElementCount) { more.hidden = true; more.open = false; }
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(fit); } }
    window.addEventListener('resize', schedule);
    window.addEventListener('hfx:timezonechange', schedule);
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(schedule);
      observer.observe(bar);
      observer.observe(note);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    document.addEventListener('click', function (event) { if (!more.contains(event.target)) more.open = false; });
    more.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && more.open) { more.open = false; more.querySelector('summary').focus(); event.preventDefault(); }
    });
    schedule();
  }

  function initFigures(strip) {
    if (strip.__hfxResponsiveFigures) return;
    strip.__hfxResponsiveFigures = true;
    var queued = false;
    function fit() {
      queued = false;
      var count = strip.children.length, width = strip.clientWidth;
      if (!count || !width) return;
      var style = getComputedStyle(strip), gap = parseFloat(style.columnGap) || 0;
      var minimum = strip.classList.contains('is-compact') ? 140 : 148;
      var columns = Math.min(count, Math.max(1, Math.floor((width + gap) / (minimum + gap))));
      if (count === 6) while (columns > 1 && count % columns) columns--;
      else while (columns > 2 && count % columns === 1) columns--;
      strip.style.setProperty('--hfx-kpi-columns', String(columns));
      strip.setAttribute('data-hfx-balanced', '1');
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(fit); } }
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(strip);
    else window.addEventListener('resize', schedule);
    schedule();
  }

  function init(root) {
    root = root && root.querySelectorAll ? root : document;
    if (root.matches && root.matches('[data-hfx-shell]')) initProvenance(root);
    if (root.matches && root.matches('.hfx-rv-kpis')) initFigures(root);
    root.querySelectorAll('[data-hfx-shell]').forEach(initProvenance);
    root.querySelectorAll('.hfx-rv-kpis').forEach(initFigures);
  }
  document.addEventListener('hfx:report-shown', function (event) { init(event.target); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); }, { once: true });
  else init();
})();
