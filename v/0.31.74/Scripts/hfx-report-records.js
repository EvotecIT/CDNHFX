// Resolves a manifest entity's real row identity after its page/chapter has materialized.
(function () {
  var ticket = 0;
  function current(request, address) {
    var hash = location.hash.slice(1);
    try { hash = decodeURIComponent(hash); } catch (_) { return false; }
    return request === ticket && hash === address;
  }
  window.hfxReportRecords = { open: function (record, address) {
    var request = ++ticket, report = window.hfxReport;
    if (record.chapter) report.reveal(record.chapter, { instant: true });
    // Chapters may complete asynchronously. The entity address remains the public link.
    // A viewer can inject a base for assets on another origin; history belongs to the viewer's document.
    try { history.replaceState(null, '', String(location.href).replace(/#.*$/, '') + '#' + encodeURI(address).replace(/#/g, '%23')); } catch (_) { }
    var stopAt = performance.now() + 10000;
    function attempt() {
      if (!current(request, address)) return;
      var root = document.getElementById(record.component) || Array.from(document.querySelectorAll('[data-hfx-canopyx]'))
        .find(function (node) { return node.getAttribute('data-hfx-canopyx') === record.component; });
      var explorer = root && root.hfxDataExplorer;
      if (explorer && explorer.openRecordKey && explorer.openRecordKey(record.key)) return;
      var host = root && root.querySelector('[data-canopyx-host]'), grid = host && host.canopyx;
      if (!explorer && grid && grid.getQuery && grid.getQuery()) {
        Promise.resolve(grid.ready).then(function () { if (current(request, address)) return grid.openRecord(record.key); }).catch(function () { });
        return;
      }
      if (performance.now() < stopAt) requestAnimationFrame(attempt);
    }
    requestAnimationFrame(attempt);
  } };
})();
