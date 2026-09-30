(function () {
    if (window.__hfxSignaturePadInitDone) return;
    window.__hfxSignaturePadInitDone = true;

    var __pads = []; // [{ el, pad, resize }]
    var __resizeHooked = false;

    function safeGetAttr(el, name) {
        try { return el && el.getAttribute ? el.getAttribute(name) : null; } catch (_e) { return null; }
    }

    function getFormat(container) {
        var f = safeGetAttr(container, 'data-hfx-signature-format');
        f = (f || '').toString().trim();
        return f || 'image/png';
    }

    function resizeCanvas(canvas, pad) {
        try {
            if (!canvas) return;
            var ratio = Math.max(window.devicePixelRatio || 1, 1);
            var data = null;
            try { if (pad && typeof pad.toData === 'function') data = pad.toData(); } catch (_d) { data = null; }

            var w = canvas.offsetWidth || 0;
            var h = canvas.offsetHeight || 0;
            if (!w || !h) return;

            canvas.width = w * ratio;
            canvas.height = h * ratio;
            var ctx = canvas.getContext && canvas.getContext('2d');
            if (ctx && ctx.scale) ctx.scale(ratio, ratio);

            try {
                if (pad && typeof pad.fromData === 'function' && data) {
                    pad.fromData(data);
                }
            } catch (_r) { }
        } catch (_e) { }
    }

    function randomColor() {
        var r = Math.round(Math.random() * 255);
        var g = Math.round(Math.random() * 255);
        var b = Math.round(Math.random() * 255);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function dataURLToBlob(dataURL) {
        try {
            var parts = (dataURL || '').split(';base64,');
            if (parts.length !== 2) return null;
            var contentType = parts[0].split(':')[1];
            var raw = window.atob(parts[1]);
            var rawLength = raw.length;
            var uInt8Array = new Uint8Array(rawLength);
            for (var i = 0; i < rawLength; ++i) uInt8Array[i] = raw.charCodeAt(i);
            return new Blob([uInt8Array], { type: contentType });
        } catch (_e) { return null; }
    }

    function download(dataURL, filename) {
        try {
            var blob = dataURLToBlob(dataURL);
            if (!blob) return;
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (_e) { }
    }

    function ensureGlobalResize() {
        if (__resizeHooked) return;
        __resizeHooked = true;
        try {
            var t = null;
            window.addEventListener('resize', function () {
                try {
                    if (t) clearTimeout(t);
                    t = setTimeout(function () {
                        try {
                            for (var i = 0; i < __pads.length; i++) {
                                var p = __pads[i];
                                if (!p || !p.el || !p.el.isConnected) continue;
                                try { if (p.resize) p.resize(); } catch (_r) { }
                            }
                        } catch (_e2) { }
                    }, 120);
                } catch (_e1) { }
            });
        } catch (_e) { }
    }

    function initOne(container) {
        try {
            if (!container || container.__hfxSignatureInit) return;
            container.__hfxSignatureInit = true;

            var SignaturePad = window.SignaturePad;
            if (!SignaturePad) return;

            var canvas = container.querySelector && container.querySelector('canvas.signature-canvas');
            if (!canvas) canvas = container.querySelector && container.querySelector('canvas');
            if (!canvas) return;

            var input = container.querySelector && container.querySelector('input[data-hfx-signature-input]');
            if (!input) input = container.querySelector && container.querySelector('input[type="hidden"]');

            var pen = safeGetAttr(container, 'data-hfx-signature-pen');
            if (!pen) {
                try { pen = (getComputedStyle(canvas).color || '').toString(); } catch (_c) { pen = null; }
            }
            var bg = safeGetAttr(container, 'data-hfx-signature-bg') || 'transparent';

            var pad = null;
            try { pad = new SignaturePad(canvas, { backgroundColor: bg, penColor: pen || '#000' }); } catch (_e) { return; }

            function syncInput() {
                try {
                    if (!input) return;
                    if (!pad || typeof pad.isEmpty !== 'function') return;
                    if (pad.isEmpty()) { input.value = ''; return; }
                    var fmt = getFormat(container);
                    if (typeof pad.toDataURL === 'function') {
                        input.value = pad.toDataURL(fmt);
                    }
                } catch (_e) { }
            }

            try { pad.onEnd = function () { syncInput(); }; } catch (_e) { }

            var resize = function () { resizeCanvas(canvas, pad); };
            resize();

            // Restore from initial hidden input value (if present)
            try {
                var initial = input && input.value ? ('' + input.value) : '';
                if (initial && initial.indexOf('data:image') === 0 && typeof pad.fromDataURL === 'function') {
                    pad.fromDataURL(initial);
                }
            } catch (_e) { }

            // Tooling buttons
            try {
                var clearBtn = container.querySelector && container.querySelector('[data-hfx-signature-action="clear"]');
                if (clearBtn) {
                    clearBtn.addEventListener('click', function (ev) {
                        try { ev.preventDefault(); } catch (_p) { }
                        try { pad.clear(); } catch (_c) { }
                        syncInput();
                    }, { passive: false });
                }
            } catch (_e) { }

            try {
                var colorBtn = container.querySelector && container.querySelector('[data-hfx-signature-action="color"]');
                if (colorBtn) {
                    colorBtn.addEventListener('click', function (ev) {
                        try { ev.preventDefault(); } catch (_p) { }
                        try { pad.penColor = randomColor(); } catch (_c) { }
                    }, { passive: false });
                }
            } catch (_e) { }

            try {
                var dls = container.querySelectorAll && container.querySelectorAll('[data-hfx-signature-download]');
                if (dls && dls.forEach) {
                    dls.forEach(function (btn) {
                        try {
                            btn.addEventListener('click', function (ev) {
                                try { ev.preventDefault(); } catch (_p) { }
                                try {
                                    if (!pad || typeof pad.isEmpty !== 'function' || pad.isEmpty()) return;
                                    var mode = (btn.getAttribute('data-hfx-signature-download') || 'png').toLowerCase().trim();
                                    var mime = mode === 'svg' ? 'image/svg+xml' : 'image/png';
                                    var filename = btn.getAttribute('data-hfx-signature-filename') || ('signature.' + (mode === 'svg' ? 'svg' : 'png'));
                                    var dataURL = pad.toDataURL(mime);
                                    download(dataURL, filename);
                                } catch (_e1) { }
                            }, { passive: false });
                        } catch (_e2) { }
                    });
                }
            } catch (_e) { }

            // Track for global resize
            __pads.push({ el: container, pad: pad, resize: resize });
            ensureGlobalResize();
        } catch (_e) { }
    }

    function init(root) {
        try {
            root = root || document;
            var list = root.querySelectorAll ? root.querySelectorAll('[data-hfx-signature-pad]') : [];
            if (!list) return;

            function schedule(container) {
                try {
                    if (window.htmlForgeXWhenVisible) {
                        window.htmlForgeXWhenVisible(container, function () { initOne(container); });
                    } else {
                        initOne(container);
                    }
                } catch (_e) { initOne(container); }
            }

            if (list.forEach) list.forEach(schedule);
            else for (var i = 0; i < list.length; i++) schedule(list[i]);
        } catch (_e) { }
    }

    window.hfxInitSignaturePads = init;

    try {
        document.addEventListener('DOMContentLoaded', function () { init(document); });
    } catch (_e) { }
})();

