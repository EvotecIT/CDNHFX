/* HtmlForgeX – Chart.js segment labels plugin (Chart.js v4 compatible)
 * Draws labels (either data labels or chart labels) on doughnut/gauge segments.
 * options.plugins.hfxSegmentLabels = {
 *   enabled: true,
 *   mode: 'value' | 'label',   // what to render
 *   color: '#111827',          // text color
 *   fontSize: 11,              // px
 *   fontFamily: 'sans-serif',
 *   offsetPct: 85              // radial position within thickness (0..100 from inner radius)
 * }
 */
(function(){
  var plugin = {
    id: 'hfxSegmentLabels',
    afterDatasetsDraw: function(chart, args, pluginOptions){
      var opts = pluginOptions || {};
      if (!opts.enabled) return;
      var mode = opts.mode || 'value';
      var color = opts.color || '#111827';
      var fontSize = Math.max(6, opts.fontSize || 11);
      var fontFamily = opts.fontFamily || 'sans-serif';
      var offsetPct = (opts.offsetPct==null?85:opts.offsetPct);
      var ctx = chart.ctx;

      var datasets = chart.data && chart.data.datasets || [];
      for (var di=0; di<datasets.length; di++){
        var meta = chart.getDatasetMeta(di);
        if (!meta || !meta.data) continue;
        for (var i=0;i<meta.data.length;i++){
          var arc = meta.data[i];
          if (!arc) continue;
          // compute mid-angle and radii
          var start = arc.startAngle || 0;
          var end = arc.endAngle || 0;
          var mid = (start + end)/2;
          var ir = arc.innerRadius || 0;
          var or = arc.outerRadius || 0;
          var thickness = Math.max(1, (or - ir));
          var r = ir + thickness*(offsetPct/100);
          var cx = arc.x, cy = arc.y;

          var text;
          if (mode === 'label'){
            var labels = chart.data && chart.data.labels || [];
            text = (labels && labels[i]!=null)? String(labels[i]) : ''+ (i+1);
          } else {
            var ds = datasets[di];
            var data = ds && ds.data || [];
            text = (data && data[i]!=null)? String(data[i]) : '';
          }
          if (!text) continue;

          ctx.save();
          ctx.fillStyle = color;
          ctx.font = fontSize + 'px ' + fontFamily;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var x = cx + Math.cos(mid)*r;
          var y = cy + Math.sin(mid)*r;
          ctx.fillText(text, x, y);
          ctx.restore();
        }
      }
    }
  };
  if (typeof window !== 'undefined' && window.Chart && window.Chart.register){ try{ window.Chart.register(plugin);}catch(e){}}
  else if (typeof Chart !== 'undefined' && Chart.register){ try{ Chart.register(plugin);}catch(e){}}
})();
