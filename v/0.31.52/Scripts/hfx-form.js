document.addEventListener('DOMContentLoaded', function () {
  var areas = document.querySelectorAll('textarea[data-auto-resize]');
  function fit(el) {
    el.style.height = 'auto';
    el.style.overflowY = 'hidden';
    el.style.height = el.scrollHeight + 'px';
  }
  areas.forEach(function (el) {
    fit(el);
    el.addEventListener('input', function () { fit(el); });
  });
});

