document.addEventListener('DOMContentLoaded', function () {
  function element(tagName, className, text) {
    var node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function visual(data) {
    if (data.avatar) {
      var avatar = element('span', 'avatar me-2');
      avatar.style.backgroundImage = 'url(' + JSON.stringify(String(data.avatar)) + ')';
      return avatar;
    }
    if (data.flag) return element('span', 'me-2 flag flag-country-' + String(data.flag));
    if (data.icon) return element('i', 'ti ti-' + String(data.icon) + ' me-2');
    return null;
  }

  function richOption(data, includeDetails) {
    var root = element('div', 'd-flex align-items-center');
    var left = visual(data);
    if (left) root.appendChild(left);
    var copy = element('div', null, data.text);
    if (includeDetails && data.badge) {
      copy.appendChild(element('span', 'badge ms-2 bg-' + (data.badgeColor || 'secondary'), data.badge));
    }
    if (includeDetails && data.desc) copy.appendChild(element('div', 'text-secondary small', data.desc));
    root.appendChild(copy);
    return root;
  }

  var sels = document.querySelectorAll('select[data-hfx-tomselect]');
  if (!sels || sels.length === 0) return;
  sels.forEach(function (el) {
    if (el._hfx_ts) return; // prevent double init
    try {
      var options = {
        render: {
          option: function (data, escape) {
            return richOption(data, true);
          },
          item: function (data, escape) {
            return richOption(data, false);
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
