(function () {
  'use strict';

  // Leaflet default marker icons (data URIs) so markers work in Offline/Inline modes.
  // These are the stock Leaflet marker assets from the Leaflet distribution.
  var __hfxLeafletIconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFgUlEQVR4Aa1XA5BjWRTN2oW17d3YaZtr2962HUzbDNpjszW24mRt28p47v7zq/bXZtrp/lWnXr337j3nPCe85NcypgSFdugCpW5YoDAMRaIMqRi6aKq5E3YqDQO3qAwjVWrD8Ncq/RBpykd8oZUb/kaJutow8r1aP9II0WmLKLIsJyv1w/kqw9Ch2MYdB++12Onxee/QMwvf4/Dk/Lfp/i4nxTXtOoQ4pW5Aj7wpici1A9erdAN2OH64x8OSP9j3Ft3b7aWkTg/Fm91siTra0f9on5sQr9INejH6CUUUpavjFNq1B+Oadhxmnfa8RfEmN8VNAsQhPqF55xHkMzz3jSmChWU6f7/XZKNH+9+hBLOHYozuKQPxyMPUKkrX/K0uWnfFaJGS1QPRtZsOPtr3NsW0uyh6NNCOkU3Yz+bXbT3I8G3xE5EXLXtCXbbqwCO9zPQYPRTZ5vIDXD7U+w7rFDEoUUf7ibHIR4y6bLVPXrz8JVZEql13trxwue/uDivd3fkWRbS6/IA2bID4uk0UpF1N8qLlbBlXs4Ee7HLTfV1j54APvODnSfOWBqtKVvjgLKzF5YdEk5ewRkGlK0i33Eofffc7HT56jD7/6U+qH3Cx7SBLNntH5YIPvODnyfIXZYRVDPqgHtLs5ABHD3YzLuespb7t79FY34DjMwrVrcTuwlT55YMPvOBnRrJ4VXTdNnYug5ucHLBjEpt30701A3Ts+HEa73u6dT3FNWwflY86eMHPk+Yu+i6pzUpRrW7SNDg5JHR4KapmM5Wv2E8Tfcb1HoqqHMHU+uWDD7zg54mz5/2BSnizi9T1Dg4QQXLToGNCkb6tb1NU+QAlGr1++eADrzhn/u8Q2YZhQVlZ5+CAOtqfbhmaUCS1ezNFVm2imDbPmPng5wmz+gwh+oHDce0eUtQ6OGDIyR0uUhUsoO3vfDmmgOezH0mZN59x7MBi++WDL1g/eEiU3avlidO671bkLfwbw5XV2P8Pzo0ydy4t2/0eu33xYSOMOD8hTf4CrBtGMSoXfPLchX+J0ruSePw3LZeK0juPJbYzrhkH0io7B3k164hiGvawhOKMLkrQLyVpZg8rHFW7E2uHOL888IBPlNZ1FPzstSJM694fWr6RwpvcJK60+0HCILTBzZLFNdtAzJaohze60T8qBzyh5ZuOg5e7uwQppofEmf2++DYvmySqGBuKaicF1blQjhuHdvCIMvp8whTTfZzI7RldpwtSzL+F1+wkdZ2TBOW2gIF88PBTzD/gpeREAMEbxnJcaJHNHrpzji0gQCS6hdkEeYt9DF/2qPcEC8RM28Hwmr3sdNyht00byAut2k3gufWNtgtOEOFGUwcXWNDbdNbpgBGxEvKkOQsxivJx33iow0Vw5S6SVTrpVq11ysA2Rp7gTfPfktc6zhtXBBC+adRLshf6sG2RfHPZ5EAc4sVZ83yCN00Fk/4kggu40ZTvIEm5g24qtU4KjBrx/BTTH8ifVASAG7gKrnWxJDcU7x8X6Ecczhm3o6YicvsLXWfh3Ch1W0k8x0nXF+0fFxgt4phz8QvypiwCCFKMqXCnqXExjq10beH+UUA7+nG6mdG/Pu0f3LgFcGrl2s0kNNjpmoJ9o4B29CMO8dMT4Q5ox8uitF6fqsrJOr8qnwNbRzv6hSnG5wP+64C7h9lp30hKNtKdWjtdkbuPA19nJ7Tz3zR/ibgARbhb4AlhavcBebmTHcFl2fvYEnW0ox9xMxKBS8btJ+KiEbq9zA4RthQXDhPa0T9TEe69gWupwc6uBUphquXgf+/FrIjweHQS4/pduMe5ERUMHUd9xv8ZR98CxkS4F2n3EUrUZ10EYNw7BWm9x1GiPssi3GgiGRDKWRYZfXlON+dfNbM+GgIwYdwAAAAASUVORK5CYII=';
  var __hfxLeafletIconRetinaUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAABSCAMAAAAhFXfZAAAC91BMVEVMaXEzeak2f7I4g7g3g7cua5gzeKg8hJo3grY4g7c3grU0gLI2frE0daAubJc2gbQwd6QzeKk2gLMtd5sxdKIua5g1frA2f7IydaM0e6w2fq41fK01eqo3grgubJgta5cxdKI1f7AydaQydaMxc6EubJgvbJkwcZ4ubZkwcJwubZgubJcydqUydKIxapgubJctbJcubZcubJcvbJYubJcvbZkubJctbJctbZcubJg2f7AubJcrbZcubJcubJcua5g3grY0fq8ubJcubJdEkdEwhsw6i88vhswuhcsuhMtBjMgthMsrg8srgss6is8qgcs8i9A9iMYtg8spgcoogMo7hcMngMonf8olfso4gr8kfck5iM8jfMk4iM8he8k1fro7itAgesk2hs8eecgzfLcofssdeMg0hc4cd8g2hcsxeLQbdsgZdcgxeLImfcszhM0vda4xgckzhM4xg84wf8Yxgs4udKsvfcQucqhUndROmdM1fK0wcZ8vb5w0eqpQm9MzeKhXoNVcpdYydKNWn9VZotVKltJFjsIwcJ1Rms9OlslLmtH///8+kc9epdYzd6dbo9VHkMM2f7FHmNBClM8ydqVcpNY9hro3gLM9hLczealQmcw3fa46f7A8gLMxc6I3eagyc6FIldJMl9JSnNRSntNNl9JPnNJFi75UnM9ZodVKksg8kM45jc09e6ZHltFBk883gbRBh7pDk9EwcaBzn784g7dKkcY2i81Om9M7j85Llc81is09g7Q4grY/j9A0eqxKmdFFltBEjcXf6fFImdBCiLxJl9FGlNFBi78yiMxVndEvbpo6js74+vx+psPP3+o/ks5HkcpGmNCjwdZCkNDM3ehYoNJEls+lxNkxh8xHks0+jdC1zd5Lg6r+/v/H2ufz9/o3jM3t8/edvdM/k89Th61OiLBSjbZklbaTt9BfptdjmL1AicBHj8hGk9FAgK1dkLNTjLRekrdClc/k7fM0icy0y9tgp9c4jc2NtM9Dlc8zicxeXZn3AAAAQ3RSTlMAHDdTb4yPA+LtnEQmC4L2EmHqB7XA0d0sr478x4/Yd5i1zOfyPkf1sLVq4Nh3FvjxopQ2/STNuFzUwFIwxKaejILpIBEV9wAABhVJREFUeF6s1NdyFEcYBeBeoQIhRAkLlRDGrhIgY3BJL8CVeKzuyXFzzjkn5ZxzzuScg3PO8cKzu70JkO0LfxdTU//pM9vTu7Xgf6KqOVTb9X7toRrVEfBf1HTVjZccrT/2by1VV928Yty9ZbVuucdz90frG8DBjl9pVApbOstvmMuvVgaNXSfAAd6pGxpy6yxf5ph43pS/4f3uoaGm2rdu72S9xzOvMymkZFq/ptDrk90mhW7e4zl7HLzhxGWPR20xmSxJ/VqldG5m9XhaVOA1DadsNh3Pu5L2N6QtPO/32JpqQBVVk20oy/Pi2s23WEvyfHbe1thadVQttvm7Llf65gGmXK67XtupyoM7HQhmXdLS8oGWJNeOJ3C5fG5XCEJnkez3/oFdsvgJ4l2ANZwhrJKk/7OSXa+3Vw2WJMlKnGkobouYk6T0TyX30klOUnTD9HJ5qpckL3EW/w4XF3Xd0FGywXUrstrclVsqz5Pd/sXFYyDnPdrLcQODmGOK47IZb4CmibmMn+MYRzFZ5jg33ZL/EJrWcszHmANy3ARBK/IXtciJy8VsitPSdE3uuHxzougojcUdr8/32atnz/ev3f/K5wtpxUTpcaI45zusVDpYtZi+jg0oU9b3x74h7+n9ABvYEZeKaVq0sh0AtLKsFtqNBdeT0MrSzwwlq9+x6xAO4tgOtSzbCjrNQQiNvQUbUEubvzBUeGw26yDCsRHCoLkTHDa7IdOLIThs/gHvChszh2CimE8peRs47cxANI0lYNB5y1DljpOF0IhzBDPOZnDOqYYbeGKECbPzWnXludPphw5c2YBq5zlwXphIbO4VDCZ0gnPfUO1TwZoYwAs2ExPCedAu9DAjfQUjzITQb3jNj0KG2Sgt6BHaQUdYzWz+XmBktOHwanXjaSTcwwziBcuMOtwBmqPrTOxFQR/DRKKPqyur0aiW6cULYsx6tBm0jXpR/AUWR6HRq9WVW6MRhIq5jLyjbaCTDCijyYJNpCajdyobP/eTw0iexBAKkJ3gA5KcQb2zBXsIBckn+xVv8jkZSaEFHE+jFEleAEfayRU0MouNoBmB/L50Ai/HSLIHxcrpCvnhSQAuakKp2C/YbCylJjXRVy/z3+Kv/RrNcCo+WUzlVEhzKffnTQnxeN9fWF88fiNCUdSTsaufaChKWInHeysygfpIqagoakW+vV20J8uyl6TyNKEZWV4oRSPyCkWpgOLSbkCObT8o2r6tlG58HQquf6O0v50tB7JM7F4EORd2dx/K0w/KHsVkLPaoYrwgP/y7krr3SSMA4zj+OBgmjYkxcdIJQyQRKgg2viX9Hddi9UBb29LrKR7CVVEEEXWojUkXNyfTNDE14W9gbHJNuhjDettN3ZvbOvdOqCD3Jp/9l+/wJE+9PkYGjx/fqkys3S2rMozM/o2106rfMUINo6hVqz+eu/hd1c4xTg0TAfy5kV+4UG6+IthHTU9woWmxuKNbTfuCSfovBCxq7EtHqvYL4Sm6F8GVxsSXHMQ07TOi1DKtZxjWaaIyi4CXWjxPccUw8WVbMYY5wxC1mzEyXMJWkllpRloi+Kkoq69sxBTlElF6aAxYUbjXNlhlDZilDnM4U5SlN5biRsRHnbx3mbeWjEh4mEyiuJDl5XcWVmX5GvNkFgLWZM5qwsop4/AWfLhU1cR7k1VVvcYCWRkOI6Xy5gmnphCYIkvzuNYzHzosq2oNk2RtSs8khfUOfHIDgR6ysYBaMpl4uEgk2U/oJTs9AaTSwma7dT69geAE2ZpEjUsn2ieJNHeKfrI3EcAGJ2ZaNgVuC8EBctCLc57P5u5led6IOBkIYkuQMrmmjChs4VkfOerHqSBkPzZlhe06RslZ3zMjk2sscqKwY0RcjKK+LWbzd7KiHhkncs/siFJ+V5eXxD34B8nVuJEpGJNmxN2gH3vSvp7J70tF+D1Ej8qUJD1TkErAND2GZwTFg/LubvmgiBG3SOvdlsqFQrkEzJCL1rstlnVFROixZoDDSuXQFHESwVGlcuQcMb/b42NgjLowh5MTDFE3vNB5qStRIErdCQEh6pLPR92anSUb/wAIhldAaDMpGgAAAABJRU5ErkJggg==';
  var __hfxLeafletShadowUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAQAAAACach9AAACMUlEQVR4Ae3ShY7jQBAE0Aoz/f9/HTMzhg1zrdKUrJbdx+Kd2nD8VNudfsL/Th///dyQN2TH6f3y/BGpC379rV+S+qqetBOxImNQXL8JCAr2V4iMQXHGNJxeCfZXhSRBcQMfvkOWUdtfzlLgAENmZDcmo2TVmt8OSM2eXxBp3DjHSMFutqS7SbmemzBiR+xpKCNUIRkdkkYxhAkyGoBvyQFEJEefwSmmvBfJuJ6aKqKWnAkvGZOaZXTUgFqYULWNSHUckZuR1HIIimUExutRxwzOLROIG4vKmCKQt364mIlhSyzAf1m9lHZHJZrlAOMMztRRiKimp/rpdJDc9Awry5xTZCte7FHtuS8wJgeYGrex28xNTd086Dik7vUMscQOa8y4DoGtCCSkAKlNwpgNtphjrC6MIHUkR6YWxxs6Sc5xqn222mmCRFzIt8lEdKx+ikCtg91qS2WpwVfBelJCiQJwvzixfI9cxZQWgiSJelKnwBElKYtDOb2MFbhmUigbReQBV0Cg4+qMXSxXSyGUn4UbF8l+7qdSGnTC0XLCmahIgUHLhLOhpVCtw4CzYXvLQWQbJNmxoCsOKAxSgBJno75avolkRw8iIAFcsdc02e9iyCd8tHwmeSSoKTowIgvscSGZUOA7PuCN5b2BX9mQM7S0wYhMNU74zgsPBj3HU7wguAfnxxjFQGBE6pwN+GjME9zHY7zGp8wVxMShYX9NXvEWD3HbwJf4giO4CFIQxXScH1/TM+04kkBiAAAAAElFTkSuQmCC';

  function normalizeBool(val, def) {
    if (val === true || val === false) return val;
    if (val === 1 || val === 0) return val === 1;
    var s = String(val || '').toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
    return def;
  }

  function parseJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_e) { return null; }
  }

  function getTheme() {
    try {
      var t = null;
      try {
        t = document && document.documentElement && document.documentElement.getAttribute
          ? document.documentElement.getAttribute('data-bs-theme')
          : null;
      } catch (_e1) { t = null; }
      if (!t) {
        try {
          t = document && document.body && document.body.getAttribute
            ? document.body.getAttribute('data-bs-theme')
            : null;
        } catch (_e2) { t = null; }
      }
      t = String(t || '').toLowerCase();
      return t === 'dark' ? 'dark' : 'light';
    } catch (_e) {
      return 'light';
    }
  }

  function cloneTemplateFirstElement(templateId) {
    try {
      if (!templateId) return null;
      var tpl = document.getElementById(String(templateId));
      if (!tpl) return null;

      if (tpl.content && tpl.content.cloneNode) {
        var frag = tpl.content.cloneNode(true);
        var host = document.createElement('div');
        host.appendChild(frag);
        return host.firstElementChild || null;
      }

      // Fallback for older browsers: use innerHTML.
      var host2 = document.createElement('div');
      host2.innerHTML = tpl.innerHTML || '';
      return host2.firstElementChild || null;
    } catch (_e) {
      return null;
    }
  }

  function escapeRegex(text) {
    try {
      return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (_e) {
      return '';
    }
  }

  function resolveTableId(tableElOrId) {
    try {
      if (!tableElOrId) return '';
      if (typeof tableElOrId === 'string') {
        var s = String(tableElOrId);
        if (s.charAt(0) === '#') s = s.substring(1);
        return s;
      }
      if (tableElOrId.nodeType === 1) return tableElOrId.id || '';
      return '';
    } catch (_e) {
      return '';
    }
  }

  function findHeaderIndex(idxMap, keyColumnHeader) {
    try {
      if (!idxMap) return null;
      if (typeof idxMap[keyColumnHeader] === 'number') return idxMap[keyColumnHeader];
      var target = String(keyColumnHeader || '').toLowerCase();
      for (var k in idxMap) {
        if (!Object.prototype.hasOwnProperty.call(idxMap, k)) continue;
        if (String(k).toLowerCase() === target && typeof idxMap[k] === 'number') return idxMap[k];
      }
      return null;
    } catch (_e) {
      return null;
    }
  }

  function filterDataTablesByMarkerKey(tableIdOrElOrId, keyColumnHeader, key, opts) {
    try {
      var $ = window.jQuery || window.$;
      if (!$ || !$.fn || !$.fn.DataTable) return false;

      var tableId = resolveTableId(tableIdOrElOrId);
      if (!tableId) return false;

      var sel = '#' + tableId;
      if (!$.fn.DataTable.isDataTable || !$.fn.DataTable.isDataTable(sel)) return false;
      var api = $(sel).DataTable();
      if (!api) return false;

      var idxMap = null;
      try {
        if (window.hfxDtShared && hfxDtShared.headerIndexMap) idxMap = hfxDtShared.headerIndexMap(sel);
      } catch (_m0) { idxMap = null; }
      if (!idxMap) {
        idxMap = {};
        try {
          $(sel).find('thead th').each(function (i) {
            try {
              var t = ($(this).text() || '').trim();
              if (t) idxMap[t] = i;
            } catch (_ht) { /* swallow */ }
          });
        } catch (_m1) { /* swallow */ }
      }

      var keyIdx = findHeaderIndex(idxMap, keyColumnHeader);
      if (typeof keyIdx !== 'number') return false;

      var exact = !(opts && opts.exact === false);
      var resetGlobalSearch = !!(opts && opts.resetGlobalSearch === true);
      var resetColumnSearches = !!(opts && opts.resetColumnSearches === true);
      var scrollToRow = !(opts && opts.scrollToRow === false);
      var highlightRow = !(opts && opts.highlightRow === false);
      var highlightMs = (opts && typeof opts.highlightMs === 'number') ? opts.highlightMs : 1200;
      var persistSelection = !!(opts && opts.persistSelection === true);

      if (resetGlobalSearch) { try { api.search(''); } catch (_sg) { /* swallow */ } }
      if (resetColumnSearches) { try { api.columns().search(''); } catch (_sc) { /* swallow */ } }

      var keys = null;
      try {
        if (Array.isArray(key)) {
          keys = [];
          for (var ki = 0; ki < key.length; ki++) {
            var s0 = (key[ki] == null) ? '' : String(key[ki]);
            s0 = s0.trim();
            if (s0) keys.push(s0);
          }
        }
      } catch (_ka) { keys = null; }
      if (!keys || !keys.length) keys = [String(key || '').trim()];
      if (!keys[0]) return false;

      var val = String(keys[0] || '');
      var term = exact ? ('^' + escapeRegex(val) + '$') : val;
      var useRegex = exact;
      var useSmart = !exact;

      if (keys.length > 1) {
        var escKeys = [];
        for (var ek = 0; ek < keys.length; ek++) {
          try { escKeys.push(escapeRegex(String(keys[ek] || ''))); } catch (_ex) { /* swallow */ }
        }
        if (escKeys.length) {
          if (exact) term = '^(?:' + escKeys.join('|') + ')$';
          else term = '(?:' + escKeys.join('|') + ')';
          useRegex = true;
          useSmart = false;
        }
      }

      if (persistSelection) {
        try {
          $(sel).attr('data-hfx-geo-selected-header', String(keyColumnHeader || ''));
          $(sel).attr('data-hfx-geo-selected-key', val);
        } catch (_ps) { /* swallow */ }

        try {
          var tEl = $(sel).get(0);
          if (tEl && !tEl.__hfx_geo_persist_bound) {
            tEl.__hfx_geo_persist_bound = true;
            $(sel).on('draw.dt.hfxGeoPersist', function () {
              try {
                var hdr = ($(sel).attr('data-hfx-geo-selected-header') || '').trim();
                var skey = ($(sel).attr('data-hfx-geo-selected-key') || '').trim();
                if (!hdr || !skey) return;

                var im = null;
                try { if (window.hfxDtShared && hfxDtShared.headerIndexMap) im = hfxDtShared.headerIndexMap(sel); } catch (_m0) { im = null; }
                if (!im) {
                  im = {};
                  try {
                    $(sel).find('thead th').each(function (i) {
                      try { var t = ($(this).text() || '').trim(); if (t) im[t] = i; } catch (_ht) { /* swallow */ }
                    });
                  } catch (_m1) { /* swallow */ }
                }

                var kIdx = findHeaderIndex(im, hdr);
                if (typeof kIdx !== 'number') return;

                var nodes = null;
                try { nodes = api.rows({ filter: 'applied' }).nodes(); } catch (_rn) { try { nodes = api.rows().nodes(); } catch (_rn2) { nodes = null; } }
                if (!nodes || !nodes.length) return;

                try { $(sel).find('tbody tr.table-active').removeClass('table-active'); } catch (_rh) { /* swallow */ }

                for (var ni = 0; ni < nodes.length; ni++) {
                  var row = nodes[ni];
                  if (!row) continue;
                  var $tr = $(row);
                  if ($tr.hasClass('child')) $tr = $tr.prev();
                  var $td = $tr.find('td').eq(kIdx);
                  var v0 = ($td.attr('data-raw') || $td.text() || '').trim();
                  if (String(v0) === String(skey)) {
                    try { $tr.addClass('table-active'); } catch (_ha) { /* swallow */ }
                    break;
                  }
                }
              } catch (_e0) { /* swallow */ }
            });
          }
        } catch (_pb) { /* swallow */ }
      }

      if (scrollToRow || highlightRow) {
        try {
          $(sel).one('draw.dt.hfxGeoFrom', function () {
            try {
              var nodes = api.rows({ filter: 'applied' }).nodes();
              if (!nodes || !nodes.length) return;
              var row = nodes[0];

              if (highlightRow) {
                try { $(sel).find('tbody tr.table-active').removeClass('table-active'); } catch (_rh) { /* swallow */ }
                try { $(row).addClass('table-active'); } catch (_rh2) { /* swallow */ }
                if (!persistSelection && highlightMs > 0) {
                  try {
                    setTimeout(function () { try { $(row).removeClass('table-active'); } catch (_rr) { /* swallow */ } }, highlightMs);
                  } catch (_rt) { /* swallow */ }
                }
              }

              if (scrollToRow && row && row.scrollIntoView) {
                try { row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
                catch (_sv) { try { row.scrollIntoView(true); } catch (_sv2) { /* swallow */ } }
              }
            } catch (_dr) { /* swallow */ }
          });
        } catch (_on) { /* swallow */ }
      }

      try {
        api.column(keyIdx).search(term, useRegex, useSmart).draw();
        return true;
      } catch (_sr) {
        try { api.column(keyIdx).search(val).draw(); return true; } catch (_sr2) { /* swallow */ }
      }

      return false;
    } catch (_e) {
      return false;
    }
  }

  function clearDataTablesMarkerFilter(tableIdOrElOrId, keyColumnHeader, opts) {
    try {
      var $ = window.jQuery || window.$;
      if (!$ || !$.fn || !$.fn.DataTable) return false;

      var tableId = resolveTableId(tableIdOrElOrId);
      if (!tableId) return false;

      var sel = '#' + tableId;
      if (!$.fn.DataTable.isDataTable || !$.fn.DataTable.isDataTable(sel)) return false;
      var api = $(sel).DataTable();
      if (!api) return false;

      var idxMap = null;
      try {
        if (window.hfxDtShared && hfxDtShared.headerIndexMap) idxMap = hfxDtShared.headerIndexMap(sel);
      } catch (_m0) { idxMap = null; }
      if (!idxMap) {
        idxMap = {};
        try {
          $(sel).find('thead th').each(function (i) {
            try {
              var t = ($(this).text() || '').trim();
              if (t) idxMap[t] = i;
            } catch (_ht) { /* swallow */ }
          });
        } catch (_m1) { /* swallow */ }
      }

      var keyIdx = findHeaderIndex(idxMap, keyColumnHeader);
      if (typeof keyIdx !== 'number') return false;

      var resetGlobalSearch = !!(opts && opts.resetGlobalSearch === true);
      var resetColumnSearches = !!(opts && opts.resetColumnSearches === true);

      if (resetGlobalSearch) { try { api.search(''); } catch (_sg) { /* swallow */ } }

      if (resetColumnSearches) {
        try { api.columns().search(''); } catch (_sc) { /* swallow */ }
      } else {
        try { api.column(keyIdx).search(''); } catch (_sc2) { /* swallow */ }
      }

      try { $(sel).find('tbody tr.table-active').removeClass('table-active'); } catch (_rh) { /* swallow */ }
      try { $(sel).removeAttr('data-hfx-geo-selected-header').removeAttr('data-hfx-geo-selected-key'); } catch (_ps) { /* swallow */ }

      try { api.draw(); return true; } catch (_dr) { /* swallow */ }
      return false;
    } catch (_e) {
      return false;
    }
  }

  function handleMarkerClick(mapEl, markerKey) {
    try {
      var binds = mapEl.__hfx_leaflet_marker_click_bindings || [];
      if (!binds || !binds.length) return;
      for (var i = 0; i < binds.length; i++) {
        var b = binds[i] || {};
        if (!b.tableId || !b.keyColumnHeader) continue;
        filterDataTablesByMarkerKey(b.tableId, b.keyColumnHeader, markerKey, b.opts || null);
      }
    } catch (_e) { /* swallow */ }
  }

  function clearMarkerClickBindings(mapEl) {
    try {
      var binds = mapEl.__hfx_leaflet_marker_click_bindings || [];
      if (!binds || !binds.length) return false;
      var ok = false;
      for (var i = 0; i < binds.length; i++) {
        var b = binds[i] || {};
        if (!b.tableId || !b.keyColumnHeader) continue;
        if (clearDataTablesMarkerFilter(b.tableId, b.keyColumnHeader, b.opts || null)) ok = true;
      }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  function applyMarkerClickBindings(mapEl) {
    try {
      var binds = mapEl.__hfx_leaflet_marker_click_bindings || [];
      if (!binds || !binds.length) return;

      var dict = mapEl.__hfx_leaflet_marker_by_key || null;
      if (!dict) return;

      for (var k in dict) {
        if (!Object.prototype.hasOwnProperty.call(dict, k)) continue;
        var layer = dict[k];
        if (!layer || !layer.on) continue;
        if (layer.__hfx_marker_click_bound) continue;
        layer.__hfx_marker_click_bound = true;

        (function (key, lyr) {
          try {
            lyr.on('click', function (ev) {
              // Some Leaflet setups bubble marker clicks to map click; suppress the next clear handler.
              try { mapEl.__hfx_leaflet_ignore_next_map_click = true; } catch (_f) { /* swallow */ }

              // Toggle: clicking the currently selected marker clears selection + filters.
              try {
                var isSelected = false;
                try {
                  var arr = mapEl.__hfx_leaflet_selected_keys || null;
                  if (arr && arr.length) {
                    for (var ai = 0; ai < arr.length; ai++) {
                      if (String(arr[ai] || '') === String(key)) { isSelected = true; break; }
                    }
                  } else {
                    var current = mapEl.__hfx_leaflet_selected_key != null ? String(mapEl.__hfx_leaflet_selected_key) : '';
                    if (current && current === String(key)) isSelected = true;
                  }
                } catch (_sk) { isSelected = false; }

                if (isSelected) {
                  try { clearLeafletSelection(mapEl); } catch (_csel) { /* swallow */ }
                  clearMarkerClickBindings(mapEl);
                  try { geoEmitClear(mapEl, { sourceType: 'leaflet', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '' }); } catch (_gc) { /* swallow */ }
                  return;
                }
              } catch (_tg) { /* swallow */ }

              try { setSelectedLeafletMarker(mapEl, key); } catch (_sel0) { /* swallow */ }
              handleMarkerClick(mapEl, key);
              try { geoEmitSelect(mapEl, 'marker', String(key || ''), { sourceType: 'leaflet', sourceId: (mapEl && mapEl.id) ? String(mapEl.id) : '', affectsTables: true }); } catch (_gs) { /* swallow */ }

              // Best-effort: prevent map click from firing right after marker click.
              try { if (ev && ev.originalEvent && ev.originalEvent.stopPropagation) ev.originalEvent.stopPropagation(); } catch (_sp) { /* swallow */ }
            });
          } catch (_c) { /* swallow */ }
        })(k, layer);
      }
    } catch (_e) { /* swallow */ }
  }

  function bindMarkerClicksToDataTables(mapElOrId, tableElOrId, keyColumnHeader, opts) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;

      var tableId = resolveTableId(tableElOrId);
      if (!tableId) return false;

      var header = String(keyColumnHeader || '');
      if (!header) return false;

      try { if (!el.__hfx_leaflet_marker_click_bindings) el.__hfx_leaflet_marker_click_bindings = []; } catch (_b0) { /* swallow */ }
      try { el.__hfx_leaflet_marker_click_bindings.push({ tableId: tableId, keyColumnHeader: header, opts: opts || null }); } catch (_b1) { /* swallow */ }

      // Ensure initialized + bound.
      if (!el.__hfx_leaflet_map) initOne(el);
      applyMarkerClickBindings(el);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function applyDefaultMarkerIconOnce(L) {
    try {
      if (!L || !L.Icon || !L.Icon.Default) return;
      if (L.Icon.Default.__hfx_default_icon_applied) return;
      L.Icon.Default.__hfx_default_icon_applied = true;
      L.Icon.Default.mergeOptions({
        iconUrl: __hfxLeafletIconUrl,
        iconRetinaUrl: __hfxLeafletIconRetinaUrl,
        shadowUrl: __hfxLeafletShadowUrl
      });
    } catch (_e2) { /* swallow */ }
  }

  function initOne(el) {
    try {
      if (!el || el.__hfx_leaflet_init) return;
      el.__hfx_leaflet_init = true;

      var L = window.L;
      if (!L || !L.map) {
        // Leaflet not loaded (yet). Allow retry by clearing init flag.
        el.__hfx_leaflet_init = false;
        return;
      }

      applyDefaultMarkerIconOnce(L);

      var cfg = parseJson(el.getAttribute('data-hfx-leaflet-config')) || {};
      var height = cfg.height || el.getAttribute('data-hfx-leaflet-height');
      if (height) {
        try { el.style.height = String(height); } catch (_h) { /* swallow */ }
      }
      try {
        var styleName = (cfg.style || el.getAttribute('data-hfx-leaflet-style') || '').toString().toLowerCase();
        if (styleName) el.classList.add('hfx-leaflet-style-' + styleName);
      } catch (_sn) { /* swallow */ }
      try {
        if (cfg.sweep) el.classList.add('hfx-leaflet-sweep');
        if (typeof cfg.sweepSpeedSeconds === 'number') {
          el.style.setProperty('--hfx-leaflet-sweep-speed', String(cfg.sweepSpeedSeconds) + 's');
        }
      } catch (_ss) { /* swallow */ }
      try {
        if (cfg.sweep) {
          var sweep = el.__hfx_leaflet_sweep_overlay;
          if (!sweep) {
            sweep = document.createElement('div');
            sweep.className = 'hfx-leaflet-sweep-overlay';
            el.appendChild(sweep);
            el.__hfx_leaflet_sweep_overlay = sweep;
          }
          if (cfg.sweepColor) {
            try { sweep.style.setProperty('--hfx-leaflet-sweep-color', String(cfg.sweepColor)); } catch (_sc) { /* swallow */ }
          }
          if (typeof cfg.sweepOpacity === 'number') {
            try { sweep.style.setProperty('--hfx-leaflet-sweep-opacity', String(cfg.sweepOpacity)); } catch (_so) { /* swallow */ }
          }
          if (typeof cfg.sweepArcWidthDeg === 'number') {
            try { sweep.style.setProperty('--hfx-leaflet-sweep-arc', String(cfg.sweepArcWidthDeg) + 'deg'); } catch (_sa) { /* swallow */ }
          }
          if (typeof cfg.sweepSpeedSeconds === 'number') {
            try { sweep.style.setProperty('--hfx-leaflet-sweep-speed', String(cfg.sweepSpeedSeconds) + 's'); } catch (_ssp) { /* swallow */ }
          }
        }
      } catch (_sw) { /* swallow */ }

      var center = cfg.center || [0, 0];
      var zoom = typeof cfg.zoom === 'number' ? cfg.zoom : 2;
      var mapOptions = cfg.mapOptions || {};

      // Small defaults: better UX inside dashboards.
      if (typeof mapOptions.scrollWheelZoom === 'undefined') mapOptions.scrollWheelZoom = false;
      if (typeof mapOptions.zoomControl === 'undefined') mapOptions.zoomControl = true;

      var map = L.map(el, mapOptions).setView(center, zoom);
      el.__hfx_leaflet_map = map;
      try { setupGeoSelectionSync(el); } catch (_gs) { /* swallow */ }

      // Background click clears selection + bound DataTables filters.
      try {
        if (!el.__hfx_leaflet_clear_bind && map && map.on) {
          el.__hfx_leaflet_clear_bind = true;
          map.on('click', function () {
            try {
              if (el.__hfx_leaflet_ignore_next_map_click) {
                el.__hfx_leaflet_ignore_next_map_click = false;
                return;
              }
            } catch (_ig) { /* swallow */ }

            var hasSelection = !!(el.__hfx_leaflet_selected_key && String(el.__hfx_leaflet_selected_key));
            if (!hasSelection) return;

            try { clearLeafletSelection(el); } catch (_c0) { /* swallow */ }
            clearMarkerClickBindings(el);
            try { geoEmitClear(el, { sourceType: 'leaflet', sourceId: (el && el.id) ? String(el.id) : '' }); } catch (_gc) { /* swallow */ }
          });
        }
      } catch (_mc) { /* swallow */ }

      var layerControlCfg = cfg.layerControl || null;
      var enableLayerControl = !!layerControlCfg;

      // Optional: group metadata (order/label/initial visibility).
      var groupCfg = null;
      try {
        var groups = layerControlCfg && layerControlCfg.groups ? layerControlCfg.groups : null;
        if (groups && groups.length) {
          groupCfg = {};
          for (var gi = 0; gi < groups.length; gi++) {
            var g0 = groups[gi] || {};
            if (!g0.name) continue;
            groupCfg[String(g0.name)] = g0;
          }
        }
      } catch (_gc) { groupCfg = null; }

      function groupMeta(groupName) {
        try {
          if (!groupCfg) return null;
          return groupCfg[String(groupName || '')] || null;
        } catch (_gm) { return null; }
      }

      function groupLabel(groupName) {
        var m = groupMeta(groupName);
        if (m && m.label != null) return String(m.label);
        return String(groupName || '');
      }

      function groupOrder(groupName) {
        var m = groupMeta(groupName);
        return (m && typeof m.order === 'number') ? m.order : 0;
      }

      function groupVisible(groupName) {
        var m = groupMeta(groupName);
        if (m && typeof m.visible === 'boolean') return m.visible === true;
        return true;
      }

      function groupSection(groupName) {
        var m = groupMeta(groupName);
        if (m && m.section != null && String(m.section)) return String(m.section);
        return '';
      }

      // Optional: base layers (tile layer switcher) + theme-aware tiles (light/dark).
      var baseLayers = null;
      var activeBaseLayer = null;
      var themeTiles = null;

      function uniqueBaseLayerName(name, suffix) {
        try {
          var n = String(name || '').trim();
          if (!n) n = 'Layer';
          if (!baseLayers || !baseLayers[n]) return n;
          var sfx = suffix ? String(suffix) : '';
          if (sfx) {
            var alt = n + ' (' + sfx + ')';
            if (!baseLayers[alt]) return alt;
          }
          var i = 2;
          while (baseLayers[n + ' (' + i + ')']) i++;
          return n + ' (' + i + ')';
        } catch (_u) {
          return String(name || '') || 'Layer';
        }
      }

      function tileLayerFromCfg(tileCfg) {
        try {
          if (!tileCfg || !tileCfg.url || !L.tileLayer) return null;
          var opts = tileCfg.options || {};
          if (tileCfg.attribution && typeof opts.attribution === 'undefined') opts.attribution = tileCfg.attribution;
          return L.tileLayer(String(tileCfg.url), opts);
        } catch (_tlc) {
          return null;
        }
      }

      // Theme-aware tiles (if configured) become base layers too (useful with layer control).
      try {
        var tt = cfg.themeTiles || null;
        if (tt && tt.light && tt.dark && L.tileLayer) {
          baseLayers = baseLayers || {};

          var ln = tt.lightName ? String(tt.lightName) : 'Light';
          var dn = tt.darkName ? String(tt.darkName) : 'Dark';

          var lightLayer = tileLayerFromCfg(tt.light);
          var darkLayer = tileLayerFromCfg(tt.dark);

          if (lightLayer && darkLayer) {
            var lKey = uniqueBaseLayerName(ln, 'Light');
            baseLayers[lKey] = lightLayer;
            var dKey = uniqueBaseLayerName(dn, 'Dark');
            baseLayers[dKey] = darkLayer;

            themeTiles = {
              light: lightLayer,
              dark: darkLayer,
              follow: normalizeBool(tt.follow, true),
              userOverride: false
            };
            try { el.__hfx_leaflet_theme_tiles = themeTiles; } catch (_tt0) { /* swallow */ }

            activeBaseLayer = (getTheme() === 'dark') ? darkLayer : lightLayer;

            // If the user manually changes the base layer (layer control), stop auto-swapping unless they return to theme layers.
            try {
              if (!el.__hfx_leaflet_theme_tiles_bind && map && map.on) {
                el.__hfx_leaflet_theme_tiles_bind = true;
                map.on('baselayerchange', function (e) {
                  try {
                    var layer = e && e.layer ? e.layer : null;
                    if (!themeTiles) return;
                    themeTiles.userOverride = !(layer === themeTiles.light || layer === themeTiles.dark);
                  } catch (_ov) { /* swallow */ }
                });
              }
            } catch (_bt) { /* swallow */ }
          }
        }
      } catch (_tt) { /* swallow */ }

      // Additional configured base layers.
      try {
        var baseCfg = cfg.baseLayers;
        if (baseCfg && baseCfg.length && L.tileLayer) {
          baseLayers = baseLayers || {};
          for (var bi = 0; bi < baseCfg.length; bi++) {
            var bl = baseCfg[bi] || {};
            if (!bl.url) continue;

            var name = bl.name ? String(bl.name) : ('Layer ' + (bi + 1));
            var blOpts = bl.options || {};
            if (bl.attribution && typeof blOpts.attribution === 'undefined') blOpts.attribution = bl.attribution;

            var tl = L.tileLayer(String(bl.url), blOpts);
            var key = uniqueBaseLayerName(name, '');
            baseLayers[key] = tl;

            if (!activeBaseLayer) activeBaseLayer = tl;
            // Keep existing behavior (selected wins) unless theme tiles are used.
            if (!themeTiles && bl.selected === true) activeBaseLayer = tl;
          }
        }
      } catch (_bl) { /* swallow */ }

      // Fallback: single tile provider.
      if (!activeBaseLayer && cfg.tile && cfg.tile.url && L.tileLayer) {
        try { activeBaseLayer = tileLayerFromCfg(cfg.tile); } catch (_t) { activeBaseLayer = null; }
      }

      try {
        if (activeBaseLayer && activeBaseLayer.addTo) activeBaseLayer.addTo(map);
      } catch (_ab) { /* swallow */ }

      // Follow theme changes by swapping between the theme base layers (when enabled and not overridden by user selection).
      function applyThemeTiles(theme) {
        try {
          if (!themeTiles || themeTiles.follow === false) return;
          if (themeTiles.userOverride) return;
          var t = String(theme || '').toLowerCase();
          if (t !== 'dark' && t !== 'light') t = getTheme();
          var desired = (t === 'dark') ? themeTiles.dark : themeTiles.light;
          if (!desired || desired === activeBaseLayer) return;
          try { if (activeBaseLayer && map && map.removeLayer) map.removeLayer(activeBaseLayer); } catch (_rm) { /* swallow */ }
          activeBaseLayer = desired;
          try { if (activeBaseLayer && activeBaseLayer.addTo) activeBaseLayer.addTo(map); } catch (_add) { /* swallow */ }
        } catch (_at) { /* swallow */ }
      }

      try {
        if (themeTiles && themeTiles.follow !== false && window && window.addEventListener) {
          window.addEventListener('hfx:themechange', function (e) {
            try {
              var t = e && e.detail && e.detail.theme ? String(e.detail.theme) : null;
              applyThemeTiles(t);
            } catch (_te) { /* swallow */ }
          });
        }
      } catch (_evt) { /* swallow */ }

      // Fallback: observe attribute changes on <html>/<body> (covers non-Hfx theme engines).
      try {
        if (themeTiles && themeTiles.follow !== false && window.MutationObserver) {
          var mo = new MutationObserver(function (muts) {
            for (var mi = 0; mi < muts.length; mi++) {
              var m = muts[mi];
              if (!m || m.type !== 'attributes') continue;
              if (m.attributeName === 'data-bs-theme') {
                try { applyThemeTiles(getTheme()); } catch (_t1) { /* swallow */ }
                break;
              }
            }
          });
          mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
          try { if (document && document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['data-bs-theme'] }); } catch (_ob) { /* swallow */ }
          el.__hfx_leaflet_theme_tiles_mo = mo;
        }
      } catch (_moe) { /* swallow */ }

      var fitLayers = [];

      // Optional: marker clustering plugin.
      var cluster = null;
      var clusters = null;
      var clusterByKey = null;
      var clusterOptions = null;
      try {
        var clusterCfg = cfg.cluster || null;
        if (clusterCfg && L.markerClusterGroup) {
          var co = {};
          if (typeof clusterCfg.maxClusterRadius === 'number') co.maxClusterRadius = clusterCfg.maxClusterRadius;
          if (typeof clusterCfg.disableClusteringAtZoom === 'number') co.disableClusteringAtZoom = clusterCfg.disableClusteringAtZoom;
          if (typeof clusterCfg.spiderfyOnMaxZoom === 'boolean') co.spiderfyOnMaxZoom = clusterCfg.spiderfyOnMaxZoom;
          if (typeof clusterCfg.zoomToBoundsOnClick === 'boolean') co.zoomToBoundsOnClick = clusterCfg.zoomToBoundsOnClick;
          if (typeof clusterCfg.showCoverageOnHover === 'boolean') co.showCoverageOnHover = clusterCfg.showCoverageOnHover;
          if (typeof clusterCfg.chunkedLoading === 'boolean') co.chunkedLoading = clusterCfg.chunkedLoading;
          clusterOptions = co;

          // Without layer control, keep the single-cluster behavior for back-compat.
          if (!enableLayerControl) {
            cluster = L.markerClusterGroup(co);
            cluster.addTo(map);
            el.__hfx_leaflet_cluster = cluster;
            el.__hfx_leaflet_clusters = [cluster];
          } else {
            clusters = [];
            el.__hfx_leaflet_clusters = clusters;
          }
        }
      } catch (_cl) { /* swallow */ }

      // Optional: marker registry for cross-component linking.
      try { if (!el.__hfx_leaflet_marker_by_key) el.__hfx_leaflet_marker_by_key = {}; } catch (_rk) { /* swallow */ }
      try { if (!el.__hfx_leaflet_marker_cluster_by_key) el.__hfx_leaflet_marker_cluster_by_key = {}; } catch (_rcbk) { /* swallow */ }
      try { if (!el.__hfx_leaflet_marker_container_by_key) el.__hfx_leaflet_marker_container_by_key = {}; } catch (_mcbk) { /* swallow */ }

      // Optional: overlay groups (for layer control)
      var markerGroups = null;
      var ungroupedMarkers = null;
      var includeUngroupedMarkers = true;
      var ungroupedMarkersLabel = 'Markers';
      if (layerControlCfg) {
        includeUngroupedMarkers = normalizeBool(layerControlCfg.includeUngroupedMarkers, true);
        if (layerControlCfg.ungroupedMarkersLabel) ungroupedMarkersLabel = String(layerControlCfg.ungroupedMarkersLabel);
      }

      function createMarkerContainer(groupName) {
        try {
          var c = null;
          if (clusterOptions && L.markerClusterGroup) {
            c = L.markerClusterGroup(clusterOptions);
            try {
              if (clusters) clusters.push(c);
              else el.__hfx_leaflet_clusters = [c];
            } catch (_cc0) { /* swallow */ }
          } else if (L.layerGroup) {
            c = L.layerGroup();
          }

          if (c && c.addTo) {
            // Respect initial visibility from layer control config.
            if (!enableLayerControl || groupVisible(groupName)) c.addTo(map);
          }
          return c;
        } catch (_cc) {
          return null;
        }
      }

      function getMarkerContainer(groupName) {
        if (!enableLayerControl) return cluster;

        var g = String(groupName || '').trim();
        if (!g) {
          if (!ungroupedMarkers) ungroupedMarkers = createMarkerContainer('');
          return ungroupedMarkers;
        }

        if (!markerGroups) markerGroups = {};
        if (!markerGroups[g]) markerGroups[g] = createMarkerContainer(g);
        return markerGroups[g];
      }

      // Optional: non-marker overlay groups (circles/paths/GeoJSON).
      var overlayGroups = null;
      function getOverlayGroup(groupName) {
        try {
          var g = String(groupName || '').trim();
          if (!g || !L.layerGroup) return null;
          if (!overlayGroups) overlayGroups = {};
          if (overlayGroups[g]) return overlayGroups[g];
          var group = L.layerGroup();
          overlayGroups[g] = group;
          if (group && group.addTo) {
            // Respect initial visibility from layer control config.
            if (!enableLayerControl || groupVisible(g)) group.addTo(map);
          }
          return group;
        } catch (_eg) {
          return null;
        }
      }

      var markers = cfg.markers || [];
      for (var i = 0; i < markers.length; i++) {
        var m = markers[i] || {};
        if (typeof m.lat !== 'number' || typeof m.lng !== 'number') continue;
        var layer = null;

        var color = m.color || null;
        var usePulse = normalizeBool(m.pulse, false);
        var useGlow = normalizeBool(m.glow, false);

        // HTML marker overlays via <template> cloning.
        if (m.templateId && L.divIcon && L.marker && !usePulse && !useGlow) {
          var node = cloneTemplateFirstElement(m.templateId);
          if (node) {
            if (color) { try { node.style.setProperty('--hfx-leaflet-marker-color', String(color)); } catch (_mc) { /* swallow */ } }
            var icon = L.divIcon({
              html: node,
              className: 'hfx-leaflet-div-icon',
              iconSize: [0, 0]
            });
            layer = L.marker([m.lat, m.lng], { icon: icon });
          }
        }

        if (!layer && (usePulse || useGlow) && L.divIcon && L.marker) {
          try {
            var pulseNode = document.createElement('div');
            pulseNode.className = 'hfx-leaflet-pulse-anchor' + (usePulse ? ' hfx-leaflet-pulse' : (useGlow ? ' hfx-leaflet-glow' : ''));
            if (color) { try { pulseNode.style.setProperty('--hfx-leaflet-marker-color', String(color)); } catch (_pmc) { /* swallow */ } }
            if (typeof m.sizePx === 'number') { try { pulseNode.style.setProperty('--hfx-leaflet-marker-size', String(m.sizePx) + 'px'); } catch (_ms) { /* swallow */ } }
            if (typeof m.pulseSizePx === 'number') { try { pulseNode.style.setProperty('--hfx-leaflet-pulse-size', String(m.pulseSizePx) + 'px'); } catch (_ps) { /* swallow */ } }
            if (typeof m.pulseSpeedSeconds === 'number') { try { pulseNode.style.setProperty('--hfx-leaflet-pulse-speed', String(m.pulseSpeedSeconds) + 's'); } catch (_sp) { /* swallow */ } }
            if (typeof m.glowSizePx === 'number') { try { pulseNode.style.setProperty('--hfx-leaflet-glow-size', String(m.glowSizePx) + 'px'); } catch (_gs) { /* swallow */ } }
            if (usePulse) {
              var ring = document.createElement('span');
              ring.className = 'hfx-leaflet-pulse-ring';
              pulseNode.appendChild(ring);
            }
            var dot = document.createElement('span');
            dot.className = 'hfx-leaflet-pulse-dot';
            pulseNode.appendChild(dot);

            var pulseIcon = L.divIcon({
              html: pulseNode,
              className: 'hfx-leaflet-div-icon',
              iconSize: [0, 0]
            });
            layer = L.marker([m.lat, m.lng], { icon: pulseIcon });
          } catch (_pe) { /* swallow */ }
        }

        var useCircle = normalizeBool(m.circle, !!color);

        if (!layer && useCircle && L.circleMarker) {
          layer = L.circleMarker([m.lat, m.lng], {
            radius: typeof m.radius === 'number' ? m.radius : 7,
            color: color || 'var(--tblr-primary)',
            fillColor: color || 'var(--tblr-primary)',
            fillOpacity: typeof m.fillOpacity === 'number' ? m.fillOpacity : 0.75,
            weight: typeof m.weight === 'number' ? m.weight : 2
          });
        } else if (!layer) {
          layer = L.marker([m.lat, m.lng]);
        }

        if (layer) {
          var container = null;
          try {
            if (enableLayerControl) {
              container = getMarkerContainer(m.group || '');
              if (container && container.addLayer) container.addLayer(layer);
              else if (layer.addTo) layer.addTo(map);
            } else if (cluster && cluster.addLayer) cluster.addLayer(layer);
            else if (layer.addTo) layer.addTo(map);
          } catch (_am) { try { if (layer.addTo) layer.addTo(map); } catch (_am2) { /* swallow */ } }

          // Typed HTML popup/tooltip via <template> cloning (preferred).
          if (m.popupTemplateId) {
            try {
              var pop = cloneTemplateFirstElement(m.popupTemplateId);
              if (pop && layer.bindPopup) layer.bindPopup(pop);
            } catch (_pp0) { /* swallow */ }
          } else if (m.popup) { try { layer.bindPopup(String(m.popup)); } catch (_p) { /* swallow */ } }

          if (m.tooltipTemplateId) {
            try {
              var tip = cloneTemplateFirstElement(m.tooltipTemplateId);
              if (tip && layer.bindTooltip) layer.bindTooltip(tip);
            } catch (_tt0) { /* swallow */ }
          } else if (m.tooltip) { try { layer.bindTooltip(String(m.tooltip)); } catch (_t) { /* swallow */ } }

          if (m.key) {
            try { el.__hfx_leaflet_marker_by_key[String(m.key)] = layer; } catch (_k) { /* swallow */ }
            try { el.__hfx_leaflet_marker_container_by_key[String(m.key)] = container; } catch (_kc) { /* swallow */ }
            if (container && container.zoomToShowLayer) {
              try { el.__hfx_leaflet_marker_cluster_by_key[String(m.key)] = container; } catch (_kbk) { /* swallow */ }
            }
          }

          fitLayers.push(layer);
        }
      }

      // Optional: bind marker clicks to tables (marker -> DataTables filter).
      try { applyMarkerClickBindings(el); } catch (_mb) { /* swallow */ }

      // Optional: heatmap overlay (density layer).
      try {
        var hm = cfg.heatmap || null;
        var hmPts = hm && hm.points ? hm.points : null;
        if (hmPts && hmPts.length && L.heatLayer) {
          var hmOpts = hm.options || {};
          var hmLayer = L.heatLayer(hmPts, hmOpts);
          var hmGroup = getOverlayGroup(hm.group);
          if (hmGroup && hmGroup.addLayer) hmGroup.addLayer(hmLayer);
          else if (hmLayer && hmLayer.addTo) hmLayer.addTo(map);
        }
      } catch (_hm) { /* swallow */ }

      var circles = cfg.circles || [];
      for (var cIdx = 0; cIdx < circles.length; cIdx++) {
        var c = circles[cIdx] || {};
        if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
        if (typeof c.radius !== 'number') continue;
        if (!L.circle) continue;
        try {
          var cColor = c.color || 'var(--tblr-primary)';
          var cFill = c.fillColor || cColor;
          var cLayer = L.circle([c.lat, c.lng], {
            radius: c.radius,
            color: cColor,
            fillColor: cFill,
            fillOpacity: typeof c.fillOpacity === 'number' ? c.fillOpacity : 0.12,
            weight: typeof c.weight === 'number' ? c.weight : 2,
            opacity: typeof c.opacity === 'number' ? c.opacity : 0.9
          });

          var cGroup = getOverlayGroup(c.group);
          if (cGroup && cGroup.addLayer) cGroup.addLayer(cLayer);
          else if (cLayer && cLayer.addTo) cLayer.addTo(map);
          if (c.popup) { try { cLayer.bindPopup(String(c.popup)); } catch (_cp) { /* swallow */ } }
          if (c.tooltip) { try { cLayer.bindTooltip(String(c.tooltip)); } catch (_ct) { /* swallow */ } }
          fitLayers.push(cLayer);
        } catch (_ce) { /* swallow */ }
      }

      var polylines = cfg.polylines || [];
      for (var plIdx = 0; plIdx < polylines.length; plIdx++) {
        var pl = polylines[plIdx] || {};
        var ptsPl = pl.points;
        if (!ptsPl || !ptsPl.length || !L.polyline) continue;
        try {
          var plOpts = {
            color: pl.color || 'var(--tblr-primary)',
            weight: typeof pl.weight === 'number' ? pl.weight : 3,
            opacity: typeof pl.opacity === 'number' ? pl.opacity : 0.9
          };
          if (pl.dashArray) plOpts.dashArray = String(pl.dashArray);
          if (pl.dashOffset) plOpts.dashOffset = String(pl.dashOffset);
          if (pl.lineCap) plOpts.lineCap = String(pl.lineCap);
          if (pl.lineJoin) plOpts.lineJoin = String(pl.lineJoin);
          if (pl.className) plOpts.className = String(pl.className);

          var plLayer = L.polyline(ptsPl, plOpts);

          var plGroup = getOverlayGroup(pl.group);
          if (plGroup && plGroup.addLayer) plGroup.addLayer(plLayer);
          else if (plLayer && plLayer.addTo) plLayer.addTo(map);
          if (pl.popup) { try { plLayer.bindPopup(String(pl.popup)); } catch (_pp) { /* swallow */ } }
          if (pl.tooltip) { try { plLayer.bindTooltip(String(pl.tooltip)); } catch (_pt) { /* swallow */ } }
          fitLayers.push(plLayer);
        } catch (_ple) { /* swallow */ }
      }

      var polygons = cfg.polygons || [];
      for (var pgIdx = 0; pgIdx < polygons.length; pgIdx++) {
        var pg = polygons[pgIdx] || {};
        var ptsPg = pg.points;
        if (!ptsPg || !ptsPg.length || !L.polygon) continue;
        try {
          var pgColor = pg.color || 'var(--tblr-primary)';
          var pgFill = pg.fillColor || pgColor;
          var pgOpts = {
            color: pgColor,
            fillColor: pgFill,
            fillOpacity: typeof pg.fillOpacity === 'number' ? pg.fillOpacity : 0.12,
            weight: typeof pg.weight === 'number' ? pg.weight : 2,
            opacity: typeof pg.opacity === 'number' ? pg.opacity : 0.9
          };
          if (pg.dashArray) pgOpts.dashArray = String(pg.dashArray);
          if (pg.dashOffset) pgOpts.dashOffset = String(pg.dashOffset);
          if (pg.lineCap) pgOpts.lineCap = String(pg.lineCap);
          if (pg.lineJoin) pgOpts.lineJoin = String(pg.lineJoin);
          if (pg.className) pgOpts.className = String(pg.className);

          var pgLayer = L.polygon(ptsPg, pgOpts);

          var pgGroup = getOverlayGroup(pg.group);
          if (pgGroup && pgGroup.addLayer) pgGroup.addLayer(pgLayer);
          else if (pgLayer && pgLayer.addTo) pgLayer.addTo(map);
          if (pg.popup) { try { pgLayer.bindPopup(String(pg.popup)); } catch (_gp) { /* swallow */ } }
          if (pg.tooltip) { try { pgLayer.bindTooltip(String(pg.tooltip)); } catch (_gt) { /* swallow */ } }
          fitLayers.push(pgLayer);
        } catch (_pge) { /* swallow */ }
      }

      var geoJsonLayers = cfg.geoJsonLayers || [];
      for (var gjIdx = 0; gjIdx < geoJsonLayers.length; gjIdx++) {
        var gj = geoJsonLayers[gjIdx] || {};
        if (!gj.geoJson || !L.geoJSON) continue;
        try {
          var gjColor = gj.color || 'var(--tblr-primary)';
          var gjFill = gj.fillColor || gjColor;
          var tooltipProp = gj.tooltipProperty || null;
          var popupProp = gj.popupProperty || null;

          var useCircleMarkers = normalizeBool(gj.circleMarkers, true);
          var circleRadius = typeof gj.circleMarkerRadius === 'number' ? gj.circleMarkerRadius : 7;

          var geoLayer = L.geoJSON(gj.geoJson, {
            style: function (_feature) {
              return {
                color: gjColor,
                fillColor: gjFill,
                fillOpacity: typeof gj.fillOpacity === 'number' ? gj.fillOpacity : 0.12,
                weight: typeof gj.weight === 'number' ? gj.weight : 2,
                opacity: typeof gj.opacity === 'number' ? gj.opacity : 0.9
              };
            },
            pointToLayer: useCircleMarkers && L.circleMarker ? function (_feature, latlng) {
              return L.circleMarker(latlng, {
                radius: circleRadius,
                color: gjColor,
                fillColor: gjFill,
                fillOpacity: typeof gj.fillOpacity === 'number' ? gj.fillOpacity : 0.6,
                weight: typeof gj.weight === 'number' ? gj.weight : 2,
                opacity: typeof gj.opacity === 'number' ? gj.opacity : 0.9
              });
            } : undefined,
            onEachFeature: function (feature, layer) {
              try {
                var props = feature && feature.properties ? feature.properties : null;
                if (!props) return;
                if (popupProp && props[popupProp] != null) { try { layer.bindPopup(String(props[popupProp])); } catch (_pp2) { } }
                if (tooltipProp && props[tooltipProp] != null) { try { layer.bindTooltip(String(props[tooltipProp])); } catch (_pt2) { } }
              } catch (_oef) { /* swallow */ }
            }
          });

          var gjGroup = getOverlayGroup(gj.group);
          if (gjGroup && gjGroup.addLayer) gjGroup.addLayer(geoLayer);
          else if (geoLayer && geoLayer.addTo) geoLayer.addTo(map);

          fitLayers.push(geoLayer);
        } catch (_gje) { /* swallow */ }
      }

      // Optional: fit view to overlays (markers, circles, paths).
      if (cfg.fitContent && fitLayers.length && L.featureGroup) {
        try {
          var pad = typeof cfg.fitPadding === 'number' ? cfg.fitPadding : 24;
          var group = L.featureGroup(fitLayers);
          map.fitBounds(group.getBounds(), { padding: [pad, pad] });
        } catch (_fc) { /* swallow */ }
      } else if (cfg.fitMarkers && markers.length && L.latLngBounds) {
        // Back-compat: fit view to markers (common for dashboards).
        try {
          var pts = [];
          for (var j = 0; j < markers.length; j++) {
            var mm = markers[j] || {};
            if (typeof mm.lat !== 'number' || typeof mm.lng !== 'number') continue;
            pts.push([mm.lat, mm.lng]);
          }
          if (pts.length) {
            var bounds = L.latLngBounds(pts);
            var pad2 = typeof cfg.fitPadding === 'number' ? cfg.fitPadding : 24;
            map.fitBounds(bounds, { padding: [pad2, pad2] });
          }
        } catch (_fb) { /* swallow */ }
      }

      // Optional: layer control (base layers + overlay groups)
      try {
        if (layerControlCfg && L.control && L.control.layers) {
          var overlays = {};
          var overlayEntries = [];
          var overlayMeta = [];

          if (overlayGroups) {
            for (var ogk in overlayGroups) {
              if (!Object.prototype.hasOwnProperty.call(overlayGroups, ogk)) continue;
              overlayEntries.push({ name: ogk, label: groupLabel(ogk), section: groupSection(ogk), layer: overlayGroups[ogk], order: groupOrder(ogk), kind: 'overlay' });
            }
          }
          if (markerGroups) {
            for (var gk in markerGroups) {
              if (!Object.prototype.hasOwnProperty.call(markerGroups, gk)) continue;
              overlayEntries.push({ name: gk, label: groupLabel(gk), section: groupSection(gk), layer: markerGroups[gk], order: groupOrder(gk), kind: 'markers' });
            }
          }
          if (includeUngroupedMarkers && ungroupedMarkers) {
            overlayEntries.push({ name: '', label: ungroupedMarkersLabel, layer: ungroupedMarkers, order: 1000000, kind: 'ungrouped' });
          }

          overlayEntries.sort(function (a, b) {
            var ao = (a && typeof a.order === 'number') ? a.order : 0;
            var bo = (b && typeof b.order === 'number') ? b.order : 0;
            if (ao !== bo) return ao - bo;
            var al = a && a.label ? String(a.label) : '';
            var bl = b && b.label ? String(b.label) : '';
            if (al < bl) return -1;
            if (al > bl) return 1;
            return 0;
          });

          var used = {};
          function uniqLabel(label, kind) {
            var s = String(label || '');
            if (!s) s = kind === 'markers' ? 'Markers' : 'Layer';
            if (!used[s]) { used[s] = 1; return s; }
            var suffix = kind === 'markers' ? ' (Markers)' : (kind === 'overlay' ? ' (Overlay)' : '');
            if (suffix) {
              var alt = s + suffix;
              if (!used[alt]) { used[alt] = 1; return alt; }
            }
            var n = 2;
            while (used[s + ' (' + n + ')']) n++;
            var out = s + ' (' + n + ')';
            used[out] = 1;
            return out;
          }

          for (var ei = 0; ei < overlayEntries.length; ei++) {
            var e = overlayEntries[ei];
            if (!e || !e.layer) continue;
            var lbl = uniqLabel(e.label, e.kind);
            overlays[lbl] = e.layer;
            overlayMeta.push({ label: lbl, section: e.section || '' });
          }

          var hasBase = false;
          try { if (baseLayers) { for (var bk in baseLayers) { if (Object.prototype.hasOwnProperty.call(baseLayers, bk)) { hasBase = true; break; } } } } catch (_hb) { hasBase = false; }
          var hasOver = false;
          try { for (var ok in overlays) { if (Object.prototype.hasOwnProperty.call(overlays, ok)) { hasOver = true; break; } } } catch (_ho) { hasOver = false; }

          if (hasBase || hasOver) {
            var lcOpts = {};
            if (typeof layerControlCfg.collapsed === 'boolean') lcOpts.collapsed = layerControlCfg.collapsed;
            if (layerControlCfg.position) lcOpts.position = String(layerControlCfg.position);
            var ctl = L.control.layers(baseLayers || {}, overlays, lcOpts);
            if (ctl && ctl.addTo) ctl.addTo(map);
            el.__hfx_leaflet_layer_control = ctl;

            // Optional: visual grouping inside the control with section headings.
            try {
              if (overlayMeta && overlayMeta.length && ctl && ctl.getContainer) {
                var container = ctl.getContainer();
                var ov = container ? container.querySelector('.leaflet-control-layers-overlays') : null;
                if (ov) {
                  var labels = ov.querySelectorAll('label');
                  var last = '';
                  for (var li = 0; li < labels.length && li < overlayMeta.length; li++) {
                    var sec = overlayMeta[li] && overlayMeta[li].section ? String(overlayMeta[li].section) : '';
                    if (!sec) continue;
                    if (sec === last) continue;
                    last = sec;
                    var h = document.createElement('div');
                    h.className = 'hfx-leaflet-layer-heading';
                    h.textContent = sec;
                    ov.insertBefore(h, labels[li]);
                  }
                }
              }
            } catch (_lh) { /* swallow */ }
          }
        }
      } catch (_lc) { /* swallow */ }

      // Optional: legend control (simple swatches + labels).
      try {
        var legendCfg = cfg.legend || null;
        var legendItems = legendCfg && Array.isArray(legendCfg.items) ? legendCfg.items : [];
        var legendTitle = legendCfg && legendCfg.title != null ? String(legendCfg.title) : '';

        if ((legendTitle || (legendItems && legendItems.length)) && L.control) {
          var legendPos = (legendCfg && legendCfg.position) ? String(legendCfg.position) : 'bottomright';
          var legendCtl = L.control({ position: legendPos });

          legendCtl.onAdd = function (_map) {
            var div = document.createElement('div');
            div.className = 'hfx-leaflet-legend';

            try {
              if (legendTitle) {
                var titleEl = document.createElement('div');
                titleEl.className = 'hfx-leaflet-legend-title';
                titleEl.textContent = legendTitle;
                div.appendChild(titleEl);
              }

              for (var li = 0; li < legendItems.length; li++) {
                var item = legendItems[li] || {};
                var label = item.label != null ? String(item.label) : '';
                if (!label) continue;

                var row = document.createElement('div');
                row.className = 'hfx-leaflet-legend-item';

                var sw = document.createElement('span');
                sw.className = 'hfx-leaflet-legend-swatch';
                if (item.color) {
                  try { sw.style.backgroundColor = String(item.color); } catch (_lc0) { /* swallow */ }
                }
                row.appendChild(sw);

                var txt = document.createElement('span');
                txt.className = 'hfx-leaflet-legend-label';
                txt.textContent = label;
                row.appendChild(txt);

                div.appendChild(row);
              }

              if (L.DomEvent) {
                try { L.DomEvent.disableClickPropagation(div); } catch (_dcp) { /* swallow */ }
                try { L.DomEvent.disableScrollPropagation(div); } catch (_dsp) { /* swallow */ }
              }
            } catch (_legb) { /* swallow */ }

            return div;
          };

          if (legendCtl && legendCtl.addTo) legendCtl.addTo(map);
          el.__hfx_leaflet_legend = legendCtl;
        }
      } catch (_leg) { /* swallow */ }

      // Ensure proper sizing when maps are inside tabs/collapses.
      var invalidate = function () {
        try { map.invalidateSize(); } catch (_r) { /* swallow */ }
      };

      // Initial invalidate after layout.
      try { setTimeout(invalidate, 0); } catch (_s) { /* swallow */ }

      if (window.ResizeObserver) {
        try {
          var ro = new ResizeObserver(function () { invalidate(); });
          ro.observe(el);
          el.__hfx_leaflet_ro = ro;
        } catch (_ro) { /* swallow */ }
      } else {
        window.addEventListener('resize', invalidate);
      }
    } catch (_e3) {
      try { el.__hfx_leaflet_init = false; } catch (_e4) { /* swallow */ }
    }
  }

  function init(root) {
    try {
      if (!root) root = document;
      if (!root.querySelectorAll) return;

      var els = root.querySelectorAll('[data-hfx-leaflet="1"]');
      if (!els || !els.length) return;

      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.__hfx_leaflet_init) continue;

        if (window.htmlForgeXWhenVisible) {
          try {
            window.htmlForgeXWhenVisible(el, function (node) { initOne(node); });
            continue;
          } catch (_wv) { /* fall back */ }
        }

        initOne(el);
      }
    } catch (_e5) { /* swallow */ }
  }

  function resolveElement(elOrId) {
    try {
      if (!elOrId) return null;
      if (typeof elOrId === 'string') return document.getElementById(elOrId);
      if (elOrId.nodeType === 1) return elOrId;
      return null;
    } catch (_e) { return null; }
  }

  function geoGroupId(el) {
    try {
      if (!el || !el.getAttribute) return '';
      return String(el.getAttribute('data-hfx-geo-group') || '');
    } catch (_e) { return ''; }
  }

  function geoTableMode(el) {
    try {
      if (!el || !el.getAttribute) return 'all';
      var s = String(el.getAttribute('data-hfx-geo-table-mode') || '');
      s = s.trim().toLowerCase();
      return s ? s : 'all';
    } catch (_e) { return 'all'; }
  }

  function geoEmitSelect(el, kind, key, meta) {
    try {
      if (!window.hfxGeoSelection || typeof window.hfxGeoSelection.select !== 'function') return false;
      meta = meta || {};
      if (meta.tableMode == null) meta.tableMode = geoTableMode(el);
      return window.hfxGeoSelection.select(geoGroupId(el), kind, key, meta || null);
    } catch (_e) { return false; }
  }

  function geoEmitClear(el, meta) {
    try {
      if (!window.hfxGeoSelection || typeof window.hfxGeoSelection.clear !== 'function') return false;
      meta = meta || {};
      if (meta.tableMode == null) meta.tableMode = geoTableMode(el);
      return window.hfxGeoSelection.clear(geoGroupId(el), meta || null);
    } catch (_e) { return false; }
  }

  function setupGeoSelectionSync(el) {
    try {
      if (!el) return false;
      if (el.__hfx_geo_selection_sync) return true;
      el.__hfx_geo_selection_sync = true;

      if (!window.hfxGeoSelection || typeof window.hfxGeoSelection.subscribe !== 'function') return false;

      var groupId = geoGroupId(el);
      window.hfxGeoSelection.subscribe(function (ev) {
        try {
          if (!ev || !ev.type) return;
          if (String(ev.groupId || '') !== String(groupId || '')) return;
          if (String(ev.sourceType || '') === 'leaflet' && String(ev.sourceId || '') === String(el.id || '')) return;

          if (ev.type === 'clear') {
            var tm0 = '';
            try { tm0 = String(ev.tableMode || '').toLowerCase(); } catch (_tm0) { tm0 = ''; }
            if (tm0 === 'source') {
              try { clearLeafletSelection(el); } catch (_c0) { /* swallow */ }
            } else {
              try { clearSelectionAndFilters(el); } catch (_c1) { /* swallow */ }
            }
            return;
          }

          if (ev.type !== 'select') return;
          if (String(ev.kind || '') !== 'marker') return;
          var keys = null;
          try { if (Array.isArray(ev.keys) && ev.keys.length) keys = ev.keys; } catch (_k0) { keys = null; }
          if (!keys || !keys.length) keys = [String(ev.key || '')];
          if (!keys[0]) return;

          try { setSelectedLeafletMarker(el, keys); } catch (_s0) { /* swallow */ }
          var tm1 = '';
          try { tm1 = String(ev.tableMode || '').toLowerCase(); } catch (_tm1) { tm1 = ''; }
          if (ev.affectsTables !== false && tm1 !== 'source') {
            try { handleMarkerClick(el, keys); } catch (_f0) { /* swallow */ }
          }
        } catch (_e0) { /* swallow */ }
      });

      return true;
    } catch (_e) {
      return false;
    }
  }

  function clearLeafletSelection(mapElOrId) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      try {
        var els = el.__hfx_leaflet_selected_els || null;
        if (els && els.length) {
          for (var i = 0; i < els.length; i++) {
            var node = els[i];
            if (node && node.classList) {
              try { node.classList.remove('hfx-leaflet-selected'); } catch (_r0) { /* swallow */ }
            }
          }
        } else {
          var prev = el.__hfx_leaflet_selected_el || null;
          if (prev && prev.classList) {
            try { prev.classList.remove('hfx-leaflet-selected'); } catch (_r1) { /* swallow */ }
          }
        }
      } catch (_r2) { /* swallow */ }

      el.__hfx_leaflet_selected_el = null;
      el.__hfx_leaflet_selected_key = null;
      el.__hfx_leaflet_selected_els = [];
      el.__hfx_leaflet_selected_keys = [];
      return true;
    } catch (_e) {
      return false;
    }
  }

  function setSelectedLeafletMarker(mapElOrId, key) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;

      // Ensure initialized.
      if (!el.__hfx_leaflet_map) initOne(el);

      var keys = null;
      try {
        if (Array.isArray(key)) {
          keys = [];
          for (var ki = 0; ki < key.length; ki++) {
            var s0 = (key[ki] == null) ? '' : String(key[ki]);
            s0 = s0.trim();
            if (s0) keys.push(s0);
          }
        }
      } catch (_ka) { keys = null; }
      if (!keys || !keys.length) keys = [String(key || '').trim()];
      if (!keys[0]) return false;

      // Clear previous selection.
      try {
        var prevEls = el.__hfx_leaflet_selected_els || null;
        if (prevEls && prevEls.length) {
          for (var pi = 0; pi < prevEls.length; pi++) {
            var pnode = prevEls[pi];
            if (pnode && pnode.classList) pnode.classList.remove('hfx-leaflet-selected');
          }
        } else {
          var prev = el.__hfx_leaflet_selected_el || null;
          if (prev && prev.classList) prev.classList.remove('hfx-leaflet-selected');
        }
      } catch (_c0) { /* swallow */ }

      var dict = el.__hfx_leaflet_marker_by_key || {};
      var selectedEls = [];
      var selectedKeys = [];

      for (var ii = 0; ii < keys.length; ii++) {
        var k = String(keys[ii] || '');
        if (!k) continue;
        var layer = dict[k] || null;
        if (!layer) continue;

        var node = null;
        try { if (layer.getElement) node = layer.getElement(); } catch (_ge) { node = null; }
        try { if (!node && layer._path) node = layer._path; } catch (_p) { /* swallow */ }

        if (node && node.classList) {
          try { node.classList.add('hfx-leaflet-selected'); } catch (_a) { /* swallow */ }
          selectedEls.push(node);
          selectedKeys.push(k);
        }

        if (ii === 0) {
          try { if (layer.bringToFront) layer.bringToFront(); } catch (_bf) { /* swallow */ }
        }
      }

      if (!selectedKeys.length) return false;

      el.__hfx_leaflet_selected_els = selectedEls;
      el.__hfx_leaflet_selected_keys = selectedKeys;
      el.__hfx_leaflet_selected_el = selectedEls[0] || null;
      el.__hfx_leaflet_selected_key = selectedKeys[0] || null;
      return true;
    } catch (_e) {
      return false;
    }
  }

  // Public helper: focus a marker by key (works with and without clustering).
  function focusMarker(mapElOrId, key, opts) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;

      // Ensure initialized.
      if (!el.__hfx_leaflet_map) initOne(el);

      var map = el.__hfx_leaflet_map;
      if (!map) return false;

      var dict = el.__hfx_leaflet_marker_by_key || {};
      var layer = dict[String(key || '')] || null;
      if (!layer) return false;

      var openPopup = true;
      var zoom = null;
      if (opts) {
        if (opts.openPopup === false) openPopup = false;
        if (typeof opts.zoom === 'number') zoom = opts.zoom;
      }

      var latlng = null;
      try { if (layer.getLatLng) latlng = layer.getLatLng(); } catch (_ll) { latlng = null; }

      // If the marker belongs to an overlay group that is currently hidden, ensure it's added to the map first.
      try {
        var contByKey = el.__hfx_leaflet_marker_container_by_key || null;
        var cont = contByKey ? contByKey[String(key || '')] : null;
        if (cont && map && map.hasLayer && !map.hasLayer(cont) && cont.addTo) {
          cont.addTo(map);
        }
      } catch (_vis) { /* swallow */ }

      var doFocus = function () {
        try {
          if (latlng) {
            if (zoom != null && map.setView) map.setView(latlng, zoom, { animate: true });
            else if (map.panTo) map.panTo(latlng, { animate: true });
          }
          if (openPopup && layer.openPopup) layer.openPopup();
          try { setSelectedLeafletMarker(el, key); } catch (_sel) { /* swallow */ }
        } catch (_f) { /* swallow */ }
      };

      // If clustering is enabled, prefer the cluster group for this marker (when known).
      try {
        var byKey = el.__hfx_leaflet_marker_cluster_by_key || null;
        var cg = byKey ? byKey[String(key || '')] : null;
        if (cg && cg.zoomToShowLayer) {
          try { cg.zoomToShowLayer(layer, doFocus); return true; } catch (_z0) { /* fall back */ }
        }
      } catch (_ck) { /* swallow */ }

      // Back-compat: single cluster group.
      var cluster = el.__hfx_leaflet_cluster || null;
      if (cluster && cluster.zoomToShowLayer) {
        try { cluster.zoomToShowLayer(layer, doFocus); return true; } catch (_z) { /* fall back */ }
      }

      // Multi-cluster fallback: try each cluster group.
      try {
        var clusters = el.__hfx_leaflet_clusters || null;
        if (clusters && clusters.length) {
          for (var i = 0; i < clusters.length; i++) {
            var c = clusters[i];
            if (!c || !c.zoomToShowLayer) continue;
            try { c.zoomToShowLayer(layer, doFocus); return true; } catch (_z2) { /* continue */ }
          }
        }
      } catch (_z3) { /* swallow */ }

      doFocus();
      return true;
    } catch (_e) {
      return false;
    }
  }

  function clearSelectionAndFilters(mapElOrId) {
    try {
      var el = resolveElement(mapElOrId);
      if (!el) return false;
      var ok = false;
      try { if (clearLeafletSelection(el)) ok = true; } catch (_c0) { /* swallow */ }
      try { if (clearMarkerClickBindings(el)) ok = true; } catch (_c1) { /* swallow */ }
      return ok;
    } catch (_e) {
      return false;
    }
  }

  window.hfxInitLeafletMaps = init;
  window.hfxLeafletFocusMarker = focusMarker;
  window.hfxLeafletSelectMarker = setSelectedLeafletMarker;
  window.hfxLeafletBindMarkerClicksToDataTables = bindMarkerClicksToDataTables;
  window.hfxLeafletClearSelection = clearLeafletSelection;
  window.hfxLeafletClearSelectionAndFilters = clearSelectionAndFilters;

  if (!window.hfxGeoClearSelectionAll) {
    window.hfxGeoClearSelectionAll = function (root) {
      try {
        if (!root) root = document;
        var ok = false;

        try {
          if (window.hfxLeafletClearSelectionAndFilters && root.querySelectorAll) {
            var ms = root.querySelectorAll('[data-hfx-leaflet=\"1\"]');
            for (var i = 0; i < ms.length; i++) {
              try { if (window.hfxLeafletClearSelectionAndFilters(ms[i])) ok = true; } catch (_l0) { /* swallow */ }
            }
          }
        } catch (_l1) { /* swallow */ }

        try {
          if (window.hfxGlobeClearSelectionAndFilters && root.querySelectorAll) {
            var gs = root.querySelectorAll('[data-hfx-globe=\"1\"]');
            for (var j = 0; j < gs.length; j++) {
              try { if (window.hfxGlobeClearSelectionAndFilters(gs[j])) ok = true; } catch (_g0) { /* swallow */ }
            }
          }
        } catch (_g1) { /* swallow */ }

        try {
          if (window.hfxVectorMapClearSelectionAndFilters && root.querySelectorAll) {
            var vs = root.querySelectorAll('[data-hfx-jvm=\"1\"]');
            for (var k = 0; k < vs.length; k++) {
              try { if (window.hfxVectorMapClearSelectionAndFilters(vs[k])) ok = true; } catch (_v0) { /* swallow */ }
            }
          }
        } catch (_v1) { /* swallow */ }

        return ok;
      } catch (_e) {
        return false;
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
