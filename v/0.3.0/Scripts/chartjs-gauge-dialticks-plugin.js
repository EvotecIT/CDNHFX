/* HtmlForgeX – Chart.js gauge dial ticks plugin (Chart.js v4 compatible)
 * Draws major/minor radial ticks and optional numeric labels around doughnut/pie gauges.
 * options.plugins.hfxDialTicks = {
 *   enabled: true,
 *   majorCount: 6,
 *   minorPerSegment: 4,
 *   majorWidth: 2,
 *   minorWidth: 1,
 *   majorColor: '#111827',
 *   minorColor: '#9ca3af',
 *   radiusInnerPct: 80,
 *   radiusOuterPct: 100,
 *   showLabels: false,
 *   labelFontSize: 11,
 *   labelColor: '#111827',
 *   labelOffsetPct: 108,
 *   min: 0,
 *   max: 100
 * }
 */
(function () {
  function deg2rad(d) { return (Math.PI / 180) * d; }

  var plugin = {
    id: 'hfxDialTicks',
    afterDatasetsDraw: function (chart, args, pluginOptions) {
      var opts = pluginOptions || {};
      if (!opts.enabled) return;
      try {
        var rotationDeg = chart.options.rotation || 0; // degrees
        var circumferenceDeg = (chart.options.circumference == null ? 360 : chart.options.circumference);
        var rotation = deg2rad(rotationDeg);
        var circumference = deg2rad(circumferenceDeg);

        var meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;
        var arc = meta.data[0];

        var cx = arc.x, cy = arc.y;
        var ir = arc.innerRadius || 0;
        var or = arc.outerRadius || 0;
        var thickness = Math.max(1, (or - ir));

        var r1 = ir + thickness * (Math.max(0, Math.min(100, opts.radiusInnerPct || 80)) / 100);
        var r2 = ir + thickness * (Math.max(0, Math.min(100, opts.radiusOuterPct || 100)) / 100);

        var majorCount = Math.max(2, opts.majorCount || 6);
        var minorPer = Math.max(0, opts.minorPerSegment || 4);
        var majorColor = opts.majorColor || '#111827';
        var minorColor = opts.minorColor || '#9ca3af';
        var majorWidth = Math.max(1, opts.majorWidth || 2);
        var minorWidth = Math.max(1, opts.minorWidth || 1);

        var showLabels = !!opts.showLabels;
        var labelFontSize = Math.max(6, opts.labelFontSize || 11);
        var labelColor = opts.labelColor || '#111827';
        var labelOffsetPct = opts.labelOffsetPct == null ? 108 : opts.labelOffsetPct; // can be <100 (inside) or >100 (outside)
        var labelRadius = ir + thickness * (labelOffsetPct / 100);
        var min = (typeof opts.min === 'number') ? opts.min : 0;
        var max = (typeof opts.max === 'number') ? opts.max : 100;

        var ctx = chart.ctx;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(0);

        function drawTick(angle, fromR, toR, color, width) {
          ctx.save();
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.moveTo(fromR, 0);
          ctx.lineTo(toR, 0);
          ctx.stroke();
          ctx.restore();
        }

        // Draw major and minor ticks
        for (var i = 0; i < majorCount; i++) {
          var tMajor = (majorCount === 1) ? 0 : (i / (majorCount - 1));
          var aMajor = rotation + circumference * tMajor;
          drawTick(aMajor, r1, r2, majorColor, majorWidth);

          if (showLabels) {
            var val = min + (max - min) * tMajor;
            var text = String(Math.round(val));
            ctx.save();
            ctx.fillStyle = labelColor;
            ctx.font = labelFontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var lx = cx + Math.cos(aMajor) * labelRadius - cx;
            var ly = cy + Math.sin(aMajor) * labelRadius - cy;
            ctx.translate(lx, ly);
            ctx.rotate(0);
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }

          if (i < majorCount - 1 && minorPer > 0) {
            for (var k = 1; k <= minorPer; k++) {
              var tMinor = (i + k / (minorPer + 1)) / (majorCount - 1);
              var aMinor = rotation + circumference * tMinor;
              drawTick(aMinor, (r1 + r2) / 2, r2, minorColor, minorWidth);
            }
          }
        }

        ctx.restore();
      } catch (e) {
        // swallow errors
      }
    }
  };

  if (typeof window !== 'undefined' && window.Chart && window.Chart.register) {
    try { window.Chart.register(plugin); } catch (e) { }
  } else if (typeof Chart !== 'undefined' && Chart.register) {
    try { Chart.register(plugin); } catch (e) { }
  } else {
    try { window.hfxDialTicksPlugin = plugin; } catch (e) { }
  }
})();

