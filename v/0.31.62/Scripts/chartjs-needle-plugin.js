/* HtmlForgeX – Chart.js needle gauge plugin (Chart.js v4 compatible)
 * Draws a needle over doughnut/pie charts using configurable options.
 * options.plugins.hfxNeedle = {
 *   enabled: true,
 *   value: number,        // current value
 *   min: number,          // default 0
 *   max: number,          // default 100
 *   widthPercentage: 3.2, // percent of gauge thickness used as line width
 *   lengthPercentage: 80, // percent of radius span (inner->outer)
 *   radiusPercentage: 2,  // percent of gauge thickness for hub circle radius
 *   color: 'rgba(0,0,0,1)'
 * }
 */
(function () {
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

    var plugin = {
        id: 'hfxNeedle',
        afterDatasetsDraw: function (chart, args, pluginOptions) {
            var opts = pluginOptions || {};
            if (!opts.enabled) return;
            try {
                // Chart.js user options are provided in DEGREES for rotation/circumference.
                // Convert them to radians for our math.
                var deg2rad = function(d){ return (Math.PI / 180) * d; };
                var rotationDeg = chart.options.rotation || 0; // degrees
                var circumferenceDeg = (chart.options.circumference == null ? 360 : chart.options.circumference); // degrees
                var rotation = deg2rad(rotationDeg);
                var circumference = deg2rad(circumferenceDeg);
                // Resolve value/min/max
                var v = opts.value;
                if (typeof v !== 'number') {
                    var ds0 = (chart.config.data && chart.config.data.datasets && chart.config.data.datasets[0]) || {};
                    v = (typeof ds0.value === 'number') ? ds0.value : 0;
                }
                var min = (typeof opts.min === 'number') ? opts.min : 0;
                var max = (typeof opts.max === 'number') ? opts.max : 100;
                if (max <= min) max = min + 1;
                v = clamp(v, min, max);

                // Fetch first arc element to compute geometry
                var meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || !meta.data.length) return;
                var arc = meta.data[0];
                // Arc element exposes geometry during draw
                var cx = arc.x, cy = arc.y;
                var ir = arc.innerRadius || 0;
                var or = arc.outerRadius || 0;
                var thickness = Math.max(1, (or - ir));

                var lengthPct = (typeof opts.lengthPercentage === 'number' ? opts.lengthPercentage : 80) / 100;
                var widthPct = (typeof opts.widthPercentage === 'number' ? opts.widthPercentage : 3.2) / 100;
                var radiusPct = (typeof opts.radiusPercentage === 'number' ? opts.radiusPercentage : 2) / 100;
                var color = opts.color || 'rgba(0,0,0,1)';

                var t = (v - min) / (max - min);
                var angle = rotation + circumference * t; // radians

                var ctx = chart.ctx;
                ctx.save();
                ctx.translate(cx, cy);
                // Chart.js rotation 0 points to the right; our needle angle is absolute from rotation.
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.lineWidth = Math.max(1, thickness * widthPct);
                ctx.strokeStyle = color;
                // draw from inner radius to inner + span*lengthPct
                var needleLen = ir + (thickness * lengthPct);
                ctx.moveTo(ir, 0);
                ctx.lineTo(needleLen, 0);
                ctx.stroke();

                // hub circle
                ctx.beginPath();
                ctx.fillStyle = color;
                var hubR = Math.max(1, thickness * radiusPct);
                ctx.arc(0, 0, hubR, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } catch (e) {
                // swallow errors to avoid breaking the chart
            }
        }
    };

    if (typeof window !== 'undefined' && window.Chart && window.Chart.register) {
        try { window.Chart.register(plugin); } catch (e) { /* ignore */ }
    } else if (typeof Chart !== 'undefined' && Chart.register) {
        try { Chart.register(plugin); } catch (e) { /* ignore */ }
    } else {
        // fallback – will be picked up by manual registration in custom environments
        try { window.hfxNeedlePlugin = plugin; } catch (e) { }
    }
})();
