(function(global){
  'use strict';
  function headerIndexMap(tableSelector){
    try{
      var $ = global.jQuery || global.$; if(!$) return {};
      var map = {};
      $(tableSelector + ' thead th').each(function(i,th){
        var t = $(th).text().trim();
        if(t && map[t] === undefined) map[t] = i;
      });
      return map;
    } catch(_){ return {}; }
  }
  function getShared(key){ try{ var s = global.hfxShared || {}; return s[key] || []; } catch(_) { return []; } }
  global.hfxDtShared = { headerIndexMap: headerIndexMap, getShared: getShared };
})(window);

