document.addEventListener('DOMContentLoaded', function () {
  var sels = document.querySelectorAll('select[data-hfx-tomselect]');
  if (!sels || sels.length === 0) return;
  sels.forEach(function (el) {
    if (el._hfx_ts) return; // prevent double init
    try {
      var options = {
        render: {
          option: function (data, escape) {
            var left = '';
            if (data.avatar) left = '<span class="avatar me-2" style="background-image:url(' + escape(data.avatar) + ')"></span>';
            else if (data.flag) left = '<span class="me-2 flag flag-country-' + escape(data.flag) + '"></span>';
            else if (data.icon) left = '<span class="me-2">' + data.icon + '</span>';
            var badge = '';
            if (data.badge) badge = '<span class="badge ms-2 bg-' + (data.badgeColor || 'secondary') + '">' + escape(data.badge) + '</span>';
            var desc = data.desc ? '<div class="text-secondary small">' + escape(data.desc) + '</div>' : '';
            return '<div class="d-flex align-items-center">' + left + '<div>' + escape(data.text) + badge + desc + '</div></div>';
          },
          item: function (data, escape) {
            var left = '';
            if (data.avatar) left = '<span class="avatar me-2" style="background-image:url(' + escape(data.avatar) + ')"></span>';
            else if (data.flag) left = '<span class="me-2 flag flag-country-' + escape(data.flag) + '"></span>';
            return '<div>' + left + escape(data.text) + '</div>';
          }
        }
      };
      if (el.hasAttribute('data-hfx-tags')) {
        options.create = true;
        options.persist = false;
        options.createOnBlur = true;
      }
      var ts = new TomSelect(el, options);
      el._hfx_ts = ts;
    } catch (e) {
      if (console && console.warn) console.warn('HFX TomSelect init failed', e);
    }
  });
});
