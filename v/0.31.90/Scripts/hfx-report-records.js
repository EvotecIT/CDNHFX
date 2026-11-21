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
      var host = root && (root.matches('[data-canopyx-host]') ? root : root.querySelector('[data-canopyx-host]')), grid = host && host.canopyx;
      if (!explorer && grid && grid.getQuery && grid.getQuery()) {
        Promise.resolve(grid.ready).then(function () { if (current(request, address)) return grid.openRecord(record.key); }).catch(function () { });
        return;
      }
      if (performance.now() < stopAt) requestAnimationFrame(attempt);
    }
    requestAnimationFrame(attempt);
  },
  // The address of a page in another file of a bundle that opens one of its rows: the request rides in the query
  // (hfx-record), so it needs no storage and survives a file:// bundle.
  address: function (file, page, component, key) {
    var base = String(file).replace(/#.*$/, '');
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'hfx-record=' + encodeURIComponent(JSON.stringify([component, key])) + '#' + encodeURIComponent(page);
  } };

  // A file opened with ?hfx-record asks for one row: the request is taken out of the address (a reload or a copied
  // link shows the page only), the component is revealed and its row opened.
  function fromAddress() {
    var match = /[?&]hfx-record=([^&#]*)/.exec(location.search);
    if (!match) return;
    var request;
    try { request = JSON.parse(decodeURIComponent(match[1])); } catch (_) { return; }
    try { history.replaceState(null, '', String(location.href).replace(/([?&])hfx-record=[^&#]*&?/, '$1').replace(/[?&](#|$)/, '$1')); } catch (_) { }
    if (!request || typeof request[0] !== 'string' || typeof request[1] !== 'string') return;
    var address = '';
    try { address = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    var report = window.hfxReport;
    if (report && typeof report.reveal === 'function') report.reveal(request[0], { page: address || undefined, hash: address, instant: true });
    window.hfxReportRecords.open({ component: request[0], key: request[1] }, address);
  }
  // After the report runtime has shown the page the address names.
  function start() { setTimeout(fromAddress, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
