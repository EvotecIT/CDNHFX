(function () {
  'use strict';

  function initEvidenceForm(form) {
    if (!form || form.__hfx_file_evidence_init) return;
    form.__hfx_file_evidence_init = true;

    var detections = form.querySelector('input[name="detections"]');
    var total = form.querySelector('input[name="total"]');
    if (!detections || !total) return;

    function clamp() {
      var detected = parseInt(detections.value || '0', 10);
      var totalValue = parseInt(total.value || '0', 10);
      if (isNaN(detected) || detected < 0) detected = 0;
      if (isNaN(totalValue) || totalValue < 0) totalValue = 0;
      if (detected > totalValue) totalValue = detected;
      detections.value = String(detected);
      total.value = String(totalValue);
    }

    detections.addEventListener('change', clamp);
    total.addEventListener('change', clamp);
    form.addEventListener('submit', clamp);
  }

  function init(root) {
    root = root || document;
    var evidenceForms = root.querySelectorAll('[data-hfx-scan-evidence]');
    for (var i = 0; i < evidenceForms.length; i++) initEvidenceForm(evidenceForms[i]);
  }

  window.HfxFileReview = window.HfxFileReview || {};
  window.HfxFileReview.init = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
