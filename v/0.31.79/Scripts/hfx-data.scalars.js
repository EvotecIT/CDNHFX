// Scalar formatting and parsing shared by the dataset runtime; calendar dates remain distinct from instants.
(function () {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  // Dates are epoch milliseconds. Date columns hold a calendar date at UTC midnight; date-time columns hold an instant,
  // shown in UTC unless the column asks for the viewer's local time. Formats match HtmlForgeX ReportValueFormatter.
  // A report shell lets the reader choose UTC. Columns that show local time then show, parse and search UTC.
  function readerWantsUtc() {
    try { return document.documentElement.getAttribute('data-hfx-time-zone') === 'utc'; } catch (_) { return false; }
  }
  function formatDate(ms, type, mode, local, seconds) {
    var d = new Date(ms);
    var utc = type === 'date' || !local;
    var day = (utc ? d.getUTCFullYear() : d.getFullYear()) + '-' + pad((utc ? d.getUTCMonth() : d.getMonth()) + 1) + '-' + pad(utc ? d.getUTCDate() : d.getDate());
    if (type === 'date') return day;
    var time = pad(utc ? d.getUTCHours() : d.getHours()) + ':' + pad(utc ? d.getUTCMinutes() : d.getMinutes());
    return day + ' ' + time + (mode === 'export' || seconds ? ':' + pad(utc ? d.getUTCSeconds() : d.getSeconds()) : '');
  }
  // Shortest round-trip text (JavaScript number formatting), mirrored by ReportValueFormatter.FormatNumber.
  function formatNumber(n) { return n === 0 ? '0' : String(n); }
  var NUMBER_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  var DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$/i;
  function parseNumber(s) { return NUMBER_TEXT.test(s) ? Number(s) : NaN; }
  // Parses yyyy-MM-dd[ HH:mm[:ss[.fff]]][Z|UTC|+hh:mm]. Without a zone the value is UTC, or local time for local columns.
  function parseDateText(s, type, local) {
    var m = DATE_TEXT.exec(s);
    if (!m) return NaN;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    if (y < 1 || y > 9999 || mo < 0 || mo > 11 || d < 1) return NaN;
    var calendar = new Date(0); calendar.setUTCFullYear(y, mo + 1, 0);
    if (d > calendar.getUTCDate()) return NaN;
    calendar.setUTCFullYear(y, mo, d); calendar.setUTCHours(0, 0, 0, 0);
    if (type === 'date') return calendar.getTime();
    var h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0), ms = m[7] ? Math.floor(+('0.' + m[7]) * 1000) : 0;
    if (h > 23 || mi > 59 || se > 59) return NaN;
    var zone = m[8];
    var t;
    if (!zone && local) { var clock = new Date(0); clock.setFullYear(y, mo, d); clock.setHours(h, mi, se, ms); t = clock.getTime(); }
    else {
      calendar.setUTCHours(h, mi, se, ms); t = calendar.getTime();
      if (zone && !/^(z|utc)$/i.test(zone)) {
        var sign = zone[0] === '-' ? -1 : 1, digits = zone.slice(1).replace(':', '');
        var zh = +digits.slice(0, 2), zm = +digits.slice(2, 4);
        if (zh > 14 || zm > 59 || (zh === 14 && zm !== 0)) return NaN;
        t -= sign * ((+digits.slice(0, 2)) * 60 + (+digits.slice(2, 4))) * 60000;
      }
    }
    return isNaN(t) || t < -62135596800000 || t > 253402300799999 ? NaN : t;
  }
  // Today's calendar date in the viewer's time zone, as a UTC-midnight value like Date column values.
  function todayAsDate(now) { var d = new Date(now); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }

  window.HfxDataScalars = { readerWantsUtc: readerWantsUtc, formatDate: formatDate, formatNumber: formatNumber, parseNumber: parseNumber, parseDateText: parseDateText, todayAsDate: todayAsDate };
})();
