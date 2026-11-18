/* Settings filter: narrows the settings rows of its own page. Presentation only; it never changes values or the draft. */
(function () {
    'use strict';
    function words(text) { return String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }
    function bind(root) {
        if (root._hfxFilter) return;
        var input = root.querySelector('[data-hfx-admin-setting-filter-input]'), result = root.querySelector('[data-hfx-admin-setting-filter-result]');
        var scope = root.closest('[data-hfx-operational-page]') || root.parentElement;
        var opened = [];
        function apply() {
            var query = words(input.value).trim(), terms = query ? query.split(/\s+/) : [];
            var rows = Array.from(scope.querySelectorAll('[data-hfx-admin-setting]')), shown = 0;
            rows.forEach(function (row) {
                var text = row._hfxFilterText || (row._hfxFilterText = words((row.querySelector('.hfx-admin-setting__copy')?.textContent || '') + ' ' + row.getAttribute('data-hfx-admin-setting')));
                var match = terms.every(function (term) { return text.includes(term); });
                if (match) { row.removeAttribute('data-hfx-admin-filter-hidden'); shown++; } else row.setAttribute('data-hfx-admin-filter-hidden', '');
            });
            // Groups and panels with no visible setting hide; a closed group with a match opens and closes again when cleared.
            opened.forEach(function (button) { if (!terms.length && button.getAttribute('aria-expanded') === 'true') button.click(); });
            if (!terms.length) opened = [];
            scope.querySelectorAll('.accordion-item').forEach(function (item) {
                var settings = item.querySelectorAll('[data-hfx-admin-setting]'); if (!settings.length) return;
                var visible = item.querySelector('[data-hfx-admin-setting]:not([data-hfx-admin-filter-hidden])');
                if (terms.length && !visible) item.setAttribute('data-hfx-admin-filter-hidden', ''); else item.removeAttribute('data-hfx-admin-filter-hidden');
                var button = item.querySelector(':scope > .accordion-header .accordion-button');
                if (terms.length && visible && button && button.getAttribute('aria-expanded') === 'false') {
                    // Only the item's own header is opened; nested groups follow their own matches.
                    button.click(); if (opened.indexOf(button) < 0) opened.push(button);
                }
            });
            scope.querySelectorAll('.hfx-service-config-panel').forEach(function (panel) {
                if (!panel.querySelector('[data-hfx-admin-setting]') || panel.querySelector('[data-hfx-admin-setting-filter]')) return;
                var visible = panel.querySelector('[data-hfx-admin-setting]:not([data-hfx-admin-filter-hidden])');
                if (terms.length && !visible) panel.setAttribute('data-hfx-admin-filter-hidden', ''); else panel.removeAttribute('data-hfx-admin-filter-hidden');
            });
            result.textContent = !terms.length ? '' : shown === 0 ? 'No settings match "' + input.value.trim() + '".' : shown === 1 ? '1 matching setting' : shown + ' matching settings';
        }
        input.addEventListener('input', apply);
        input.addEventListener('keydown', function (event) { if (event.key === 'Escape' && input.value) { event.preventDefault(); input.value = ''; apply(); } });
        root._hfxFilter = { apply: apply };
    }
    function start() { document.querySelectorAll('[data-hfx-admin-setting-filter]').forEach(bind); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
