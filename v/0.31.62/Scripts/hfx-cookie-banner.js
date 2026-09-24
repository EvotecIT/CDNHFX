(function () {
    if (window.__hfxCookieBannerInitDone) return;
    window.__hfxCookieBannerInitDone = true;

    function toBool(v, dflt) {
        if (v === null || v === undefined || v === '') return dflt;
        var s = ('' + v).toLowerCase().trim();
        if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
        if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
        return dflt;
    }

    function readLocalStorage(key) {
        try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch (_e) { return null; }
    }

    function writeLocalStorage(key, val) {
        try { if (window.localStorage) window.localStorage.setItem(key, val); } catch (_e) { }
    }

    function showFallback(el) {
        try {
            el.classList.add('show');
            el.style.visibility = 'visible';
        } catch (_e) { }
    }

    function hideFallback(el) {
        try {
            el.classList.remove('show');
            el.style.visibility = 'hidden';
        } catch (_e) { }
    }

    function initBanner(el) {
        try {
            if (!el || el.__hfxCookieBannerInit) return;
            el.__hfxCookieBannerInit = true;

            var key = el.getAttribute('data-hfx-cookie-key') || 'hfx-cookie-consent';
            var autoshow = toBool(el.getAttribute('data-hfx-cookie-autoshow'), true);

            var backdrop = toBool(el.getAttribute('data-hfx-cookie-backdrop'), false);
            var scroll = toBool(el.getAttribute('data-hfx-cookie-scroll'), true);

            var existing = readLocalStorage(key);

            // Bootstrap Offcanvas integration (preferred)
            var bs = window.bootstrap && window.bootstrap.Offcanvas;
            var instance = null;
            if (bs) {
                try {
                    if (typeof bs.getOrCreateInstance === 'function') {
                        instance = bs.getOrCreateInstance(el, { backdrop: backdrop, scroll: scroll });
                    } else {
                        instance = bs.getInstance(el) || new bs(el, { backdrop: backdrop, scroll: scroll });
                    }
                } catch (_e) { instance = null; }
            }

            function show() {
                try {
                    if (instance && typeof instance.show === 'function') instance.show();
                    else showFallback(el);
                } catch (_e) { showFallback(el); }
            }

            function hide() {
                try {
                    if (instance && typeof instance.hide === 'function') instance.hide();
                    else hideFallback(el);
                } catch (_e) { hideFallback(el); }
            }

            if (autoshow && !existing) show();
            else hide();

            var buttons = el.querySelectorAll ? el.querySelectorAll('[data-hfx-cookie-consent]') : [];
            if (buttons && buttons.forEach) {
                buttons.forEach(function (btn) {
                    try {
                        btn.addEventListener('click', function (ev) {
                            try { ev.preventDefault(); } catch (_p) { }
                            var val = btn.getAttribute('data-hfx-cookie-consent') || '1';
                            writeLocalStorage(key, val);
                            hide();
                        }, { passive: false });
                    } catch (_e) { }
                });
            }
        } catch (_e) { }
    }

    function init(root) {
        try {
            root = root || document;
            var list = root.querySelectorAll ? root.querySelectorAll('[data-hfx-cookie-banner]') : [];
            if (!list) return;
            if (list.forEach) list.forEach(initBanner);
            else for (var i = 0; i < list.length; i++) initBanner(list[i]);
        } catch (_e) { }
    }

    window.hfxInitCookieBanners = init;

    try {
        document.addEventListener('DOMContentLoaded', function () { init(document); });
    } catch (_e) { }
})();

