// Compressed classic scripts stay inert until the consumer explicitly activates them.
(function (global) {
    'use strict';
    if (global.hfxLazyAssets) return;
    var assets = Object.create(null);
    global.hfxLazyAssets = {
        register: function (name, payload, encoding, address) {
            var current = document.currentScript;
            var url = payload == null && current && current.src ? new URL(address || name, current.src).href : null;
            name = name.toLowerCase();
            if (!assets[name]) assets[name] = { payload: payload, encoding: encoding, url: url, nonce: current && current.nonce };
        },
        load: function (name) {
            name = name.toLowerCase();
            var asset = assets[name];
            if (!asset) return Promise.reject(new Error('Deferred asset is unavailable: ' + name));
            if (asset.promise) return asset.promise;
            asset.promise = Promise.resolve().then(async function () {
                if (asset.url) {
                    await new Promise(function (resolve, reject) {
                        var external = document.createElement('script');
                        if (asset.nonce) external.nonce = asset.nonce;
                        function finish(failure) {
                            external.remove();
                            if (failure) reject(new Error('Deferred asset could not load: ' + name));
                            else resolve();
                        }
                        external.onload = function () {finish(false);};
                        external.onerror = function () {finish(true);};
                        external.src = asset.url;
                        document.head.appendChild(external);
                    });
                    return;
                }
                if (!global.DecompressionStream) throw new Error('Deferred assets require DecompressionStream.');
                var binary = atob(asset.payload), bytes = new Uint8Array(binary.length);
                for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
                var decoded = new Uint8Array(await new Response(stream).arrayBuffer());
                var decoder = new TextDecoder(), source;
                if (asset.encoding === 'base64-literals') {
                    var size = new DataView(decoded.buffer).getUint32(0, true);
                    var header = JSON.parse(decoder.decode(decoded.subarray(4, 4 + size))), offset = 4 + size;
                    source = header.source;
                    header.lengths.forEach(function (length, index) {
                        var data = decoded.subarray(offset, offset + length), text = '';
                        for (var start = 0; start < data.length; start += 8192)
                            text += String.fromCharCode.apply(null, data.subarray(start, start + 8192));
                        source = source.split(header.marker + index + '\0').join(btoa(text));
                        offset += length;
                    });
                } else source = decoder.decode(decoded);
                var script = document.createElement('script');
                if (asset.nonce) script.nonce = asset.nonce;
                // Inline execution follows the page's existing CSP contract; it needs neither blob: nor unsafe-eval.
                // The tail marker detects blocked execution and syntax/runtime errors before accepting the asset.
                script.textContent = source + '\n;document.currentScript.setAttribute("data-hfx-asset-loaded","true");';
                try {
                    document.head.appendChild(script);
                    if (!script.hasAttribute('data-hfx-asset-loaded')) throw new Error('Deferred asset could not execute (check script CSP): ' + name);
                } finally {script.remove();}
                delete asset.payload;
            }).catch(function (failure) {
                delete asset.promise;
                throw failure;
            });
            return asset.promise;
        }
    };
})(typeof window === 'undefined' ? globalThis : window);
