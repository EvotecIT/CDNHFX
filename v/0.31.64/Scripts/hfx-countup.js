(function () {
    if (window.__hfxCountUpInitDone) return;
    window.__hfxCountUpInitDone = true;

    function parseNumber(value, fallback) {
        var n = parseFloat(value);
        return isNaN(n) ? fallback : n;
    }

    function parseBool(value, fallback) {
        if (value == null || value === '') return fallback;
        var normalized = String(value).toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
        return fallback;
    }

    function formatNumber(value, options) {
        var places = Math.max(0, options.decimalPlaces || 0);
        var sign = value < 0 ? '-' : '';
        var absolute = Math.abs(value);
        var fixed = absolute.toFixed(places).split('.');
        var integer = fixed[0];
        var fraction = fixed.length > 1 ? fixed[1] : '';

        if (options.useGrouping !== false) {
            integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, options.separator || ',');
        }

        var text = sign + integer;
        if (places > 0) {
            text += (options.decimal || '.') + fraction;
        }

        return (options.prefix || '') + text + (options.suffix || '');
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animate(el) {
        if (!el || el.__hfxCountUpStarted) return;
        el.__hfxCountUpStarted = true;

        var startValue = parseNumber(el.getAttribute('data-hfx-countup-start'), 0);
        var targetValue = parseNumber(el.getAttribute('data-hfx-countup-target'), startValue);
        var duration = Math.max(0, parseNumber(el.getAttribute('data-hfx-countup-duration'), 2));
        var options = {
            decimalPlaces: Math.max(0, parseInt(el.getAttribute('data-hfx-countup-decimals') || '0', 10) || 0),
            useGrouping: parseBool(el.getAttribute('data-hfx-countup-grouping'), true),
            separator: el.getAttribute('data-hfx-countup-separator') || ',',
            decimal: el.getAttribute('data-hfx-countup-decimal') || '.',
            prefix: el.getAttribute('data-hfx-countup-prefix') || '',
            suffix: el.getAttribute('data-hfx-countup-suffix') || '',
            useEasing: parseBool(el.getAttribute('data-hfx-countup-easing'), true)
        };

        if (duration === 0 || startValue === targetValue) {
            el.textContent = formatNumber(targetValue, options);
            return;
        }

        var durationMs = duration * 1000;
        var startedAt = null;

        function step(timestamp) {
            if (startedAt === null) startedAt = timestamp;
            var elapsed = timestamp - startedAt;
            var progress = Math.min(elapsed / durationMs, 1);
            var eased = options.useEasing ? easeOutCubic(progress) : progress;
            var current = startValue + ((targetValue - startValue) * eased);

            el.textContent = formatNumber(current, options);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                el.textContent = formatNumber(targetValue, options);
            }
        }

        el.textContent = formatNumber(startValue, options);
        window.requestAnimationFrame(step);
    }

    function initElement(el) {
        if (!el || el.__hfxCountUpBootstrapped) return;
        el.__hfxCountUpBootstrapped = true;

        var boot = function () {
            animate(el);
        };

        if (window.htmlForgeXWhenVisible) {
            window.htmlForgeXWhenVisible(el, function () { boot(); });
            return;
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { boot(); }, { once: true });
            return;
        }

        boot();
    }

    function init(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var elements = scope.querySelectorAll('[data-hfx-countup]');
        for (var i = 0; i < elements.length; i++) {
            initElement(elements[i]);
        }
    }

    window.hfxCountUp = {
        init: init,
        animate: animate
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(document); }, { once: true });
    } else {
        init(document);
    }
})();
