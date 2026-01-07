(function () {
  'use strict';

  function getCssVar(name) {
    try {
      // Prefer :root but fall back to <body> because some themes apply tokens there.
      var root = document && document.documentElement ? document.documentElement : null;
      var v = root ? getComputedStyle(root).getPropertyValue(name) : '';
      v = (v == null) ? '' : String(v).trim();
      if (!v) {
        var body = document && document.body ? document.body : null;
        v = body ? getComputedStyle(body).getPropertyValue(name) : '';
        v = (v == null) ? '' : String(v).trim();
      }
      return v || '';
    } catch (_e) {
      return '';
    }
  }

  function getThemeMode() {
    try {
      var t = document && document.documentElement && document.documentElement.getAttribute
        ? document.documentElement.getAttribute('data-bs-theme')
        : null;
      if (t === 'dark' || t === 'light') return t;
    } catch (_e1) { /* ignore */ }

    try {
      var b = document && document.body && document.body.getAttribute
        ? document.body.getAttribute('data-bs-theme')
        : null;
      if (b === 'dark' || b === 'light') return b;
    } catch (_e2) { /* ignore */ }

    return 'light';
  }

  function resolvePalette() {
    var text = getCssVar('--tblr-body-color') || getCssVar('--bs-body-color') || '#212529';
    var border = getCssVar('--tblr-border-color') || getCssVar('--bs-border-color') || 'rgba(0,0,0,.1)';
    var surface = getCssVar('--tblr-bg-surface') || getCssVar('--tblr-secondary-bg') || getCssVar('--bs-body-bg') || '#fff';
    var primary = getCssVar('--tblr-primary') || getCssVar('--bs-primary') || '#066fd1';
    var primaryFg = getCssVar('--tblr-primary-fg') || getCssVar('--bs-primary-text-emphasis') || '#fff';

    // When Tabler exposes primary text emphasis, it's not always a suitable foreground; fall back to white in dark mode.
    try {
      if (getThemeMode() === 'dark' && primaryFg && primaryFg.indexOf('rgb(') === 0) {
        primaryFg = '#ffffff';
      }
    } catch (_e) { /* ignore */ }

    return { text: text, border: border, surface: surface, primary: primary, primaryFg: primaryFg };
  }

  function ensureObject(obj, key) {
    if (!obj) return null;
    if (obj[key] == null || typeof obj[key] !== 'object') obj[key] = {};
    return obj[key];
  }

  function applyThemeDefaults(container, options) {
    if (!options || typeof options !== 'object') return null;

    var pal = resolvePalette();
    var applied = { nodesColor: false, nodesFont: false, edgesColor: false, edgesFont: false };

    try {
      var nodes = ensureObject(options, 'nodes');
      if (nodes) {
        if (nodes.color == null) {
          nodes.color = {
            background: pal.surface,
            border: pal.border,
            highlight: { background: pal.primary, border: pal.primary },
            hover: { background: pal.primary, border: pal.primary }
          };
          applied.nodesColor = true;
        }

        var font = ensureObject(nodes, 'font');
        if (font && font.color == null) {
          font.color = pal.text;
          applied.nodesFont = true;
        }
      }
    } catch (_n) { /* ignore */ }

    try {
      var edges = ensureObject(options, 'edges');
      if (edges) {
        if (edges.color == null) {
          edges.color = {
            color: pal.border,
            highlight: pal.primary,
            hover: pal.primary,
            inherit: false
          };
          applied.edgesColor = true;
        }

        var efont = ensureObject(edges, 'font');
        if (efont && efont.color == null) {
          efont.color = pal.text;
          applied.edgesFont = true;
        }
      }
    } catch (_e) { /* ignore */ }

    // Mark container so we can avoid double-binding listeners in dynamic apps.
    try {
      if (container && container.setAttribute) container.setAttribute('data-hfx-vis-theme', '1');
    } catch (_a) { /* ignore */ }

    return applied;
  }

  function bindTheme(container, network, applied) {
    try {
      if (!network || typeof network.setOptions !== 'function') return;
      if (!applied || typeof applied !== 'object') return;
      if (network.__hfxVisThemeBound) return;
      network.__hfxVisThemeBound = true;

      function update() {
        var pal = resolvePalette();
        var patch = {};

        if (applied.nodesColor || applied.nodesFont) {
          patch.nodes = patch.nodes || {};
          if (applied.nodesColor) {
            patch.nodes.color = {
              background: pal.surface,
              border: pal.border,
              highlight: { background: pal.primary, border: pal.primary },
              hover: { background: pal.primary, border: pal.primary }
            };
          }
          if (applied.nodesFont) {
            patch.nodes.font = patch.nodes.font || {};
            patch.nodes.font.color = pal.text;
          }
        }

        if (applied.edgesColor || applied.edgesFont) {
          patch.edges = patch.edges || {};
          if (applied.edgesColor) {
            patch.edges.color = { color: pal.border, highlight: pal.primary, hover: pal.primary, inherit: false };
          }
          if (applied.edgesFont) {
            patch.edges.font = patch.edges.font || {};
            patch.edges.font.color = pal.text;
          }
        }

        try { network.setOptions(patch); } catch (_e) { /* ignore */ }
      }

      try { window.addEventListener('hfx:themechange', function () { update(); }); } catch (_l) { /* ignore */ }

      // Apply once in case the document was themed after initial render.
      try { update(); } catch (_u) { /* ignore */ }
    } catch (_e2) { /* ignore */ }
  }

  function normalizePayload(payload) {
    // Support both camelCase and PascalCase payloads (ASP.NET uses camelCase by default,
    // but direct System.Text.Json usage may produce Nodes/Edges).
    var payloadNodes = (payload && (payload.nodes || payload.Nodes)) ? (payload.nodes || payload.Nodes) : null;
    var payloadEdges = (payload && (payload.edges || payload.Edges)) ? (payload.edges || payload.Edges) : null;

    var remoteNodes = (payloadNodes != null) ? payloadNodes : payload;
    var remoteEdges = (payloadEdges != null) ? payloadEdges : [];
    if (!Array.isArray(remoteNodes)) remoteNodes = [];
    if (!Array.isArray(remoteEdges)) remoteEdges = [];

    return { nodes: remoteNodes, edges: remoteEdges };
  }

  function cloneJsonObject(obj) {
    try { return obj ? JSON.parse(JSON.stringify(obj)) : {}; } catch (_e) { return {}; }
  }

  async function fetchPayload(targetUrl, request) {
    var req = request || {};
    var method = (req.method == null || String(req.method).trim() === '') ? 'GET' : String(req.method).trim().toUpperCase();
    var baseHeaders = req.headers || {};
    var bodyObj = (Object.prototype.hasOwnProperty.call(req, 'bodyObj')) ? req.bodyObj : null;
    var includeCreds = !!req.includeCredentials;
    var timeoutMs = (typeof req.timeoutMs === 'number') ? req.timeoutMs : 0;

    var fetchInit = { method: method, headers: cloneJsonObject(baseHeaders) };
    if (bodyObj != null && fetchInit.method !== 'GET' && fetchInit.method !== 'HEAD') {
      try {
        if (!fetchInit.headers) fetchInit.headers = {};
        if (!fetchInit.headers['Content-Type']) fetchInit.headers['Content-Type'] = 'application/json';
      } catch (_e) { }
      try { fetchInit.body = JSON.stringify(bodyObj); } catch (_e) { }
    }
    if (includeCreds) {
      try { fetchInit.credentials = 'include'; } catch (_e) { }
    }
    try {
      if (timeoutMs > 0 && window.AbortController) {
        var ctrl = new AbortController();
        fetchInit.signal = ctrl.signal;
        setTimeout(function () { try { ctrl.abort(); } catch (_e) { } }, timeoutMs);
      }
    } catch (_e) { }

    var res = await fetch(targetUrl, fetchInit);
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : ''));
    return await res.json();
  }

  function applyPayload(state, payload) {
    try {
      if (!state || !state.nodes || !state.edges) return;
      var p = normalizePayload(payload);

      try { state.nodes.clear(); } catch (_e) { }
      try { state.edges.clear(); } catch (_e) { }

      try { if (p.nodes && p.nodes.length) state.nodes.add(p.nodes); } catch (_e) { }
      try { if (p.edges && p.edges.length) state.edges.add(p.edges); } catch (_e) { }

      // Re-apply embedded nodes/edges (optional)
      try { if (state.embeddedNodes && state.embeddedNodes.length) state.nodes.add(state.embeddedNodes); } catch (_e) { try { state.nodes.update(state.embeddedNodes); } catch (_e2) { } }
      try { if (state.embeddedEdges && state.embeddedEdges.length) state.edges.add(state.embeddedEdges); } catch (_e) { try { state.edges.update(state.embeddedEdges); } catch (_e2) { } }

      try { if (state.network && state.network.redraw) state.network.redraw(); } catch (_e) { }
    } catch (_e) { }
  }

  function trackNetwork(id, network) {
    try {
      if (!id || !network) return;
      if (window.diagramTracker) window.diagramTracker[id] = network;
      else if (typeof diagramTracker !== 'undefined') diagramTracker[id] = network;
    } catch (_e) { }
  }

  function afterNetworkCreated(container, state, cfg) {
    try { trackNetwork(cfg.id, state.network); } catch (_e) { }

    if (cfg.disablePhysicsAfterStabilization) {
      try {
        state.network.once('stabilizationIterationsDone', function () {
          try { state.network.setOptions({ physics: { enabled: false } }); } catch (_e) { }
        });
      } catch (_e) { }
    }

    try {
      if (cfg.onNetworkReady && typeof cfg.onNetworkReady === 'function') {
        cfg.onNetworkReady({ container: container, nodes: state.nodes, edges: state.edges, network: state.network });
      }
    } catch (_e) { }
  }

  function tryRenderEmbeddedFallback(container, state, cfg) {
    try {
      var embeddedNodes = state.embeddedNodes || [];
      var embeddedEdges = state.embeddedEdges || [];

      var nodesFallback = new vis.DataSet(embeddedNodes || []);
      var edgesFallback = new vis.DataSet(embeddedEdges || []);
      var dataFallback = { nodes: nodesFallback, edges: edgesFallback };
      var networkFallback = loadDiagramWithFonts(container, dataFallback, cfg.options, cfg.id, !!cfg.enableLoadingBar, false);

      state.nodes = nodesFallback;
      state.edges = edgesFallback;
      state.network = networkFallback;

      afterNetworkCreated(container, state, cfg);
      return true;
    } catch (_e) { }
    return false;
  }

  function startLiveUpdates(state, cfg) {
    try {
      if (!cfg || !cfg.updateTransport || cfg.updateTransport === 'none') return;
      var u = cfg.updatesUrl || cfg.url;
      if (!u) return;

      if (cfg.updateTransport === 'polling') {
        var poll = cfg.pollingMs || 0;
        if (poll <= 0) return;
        var busy = false;
        setInterval(function () {
          if (busy) return;
          busy = true;
          fetchPayload(u, cfg.request)
            .then(function (payload) { applyPayload(state, payload); })
            .catch(function (err) { try { console.error('VisNetwork polling update failed', err); } catch (_e) { } })
            .then(function () { busy = false; });
        }, poll);
        return;
      }

      if (cfg.updateTransport === 'sse') {
        if (!window.EventSource) return;
        try {
          var es = null;
          try {
            es = cfg.sseWithCredentials ? new EventSource(u, { withCredentials: true }) : new EventSource(u);
          } catch (_e) {
            // Older browsers may not support the options bag.
            es = new EventSource(u);
          }

          es.onmessage = function (ev) {
            try {
              if (!ev || !ev.data) return;
              applyPayload(state, JSON.parse(ev.data));
            } catch (_e) { }
          };
          es.onerror = function (err) { try { console.error('VisNetwork SSE error', err); } catch (_e) { } };

          try {
            window.addEventListener('beforeunload', function () { try { es.close(); } catch (_e) { } });
          } catch (_e) { }
        } catch (_e) { }
        return;
      }

      if (cfg.updateTransport === 'ws') {
        if (!window.WebSocket) return;
        var ws = null;
        var stopped = false;
        function connect() {
          if (stopped) return;
          try {
            ws = new WebSocket(u);
          } catch (_e) {
            try { setTimeout(connect, 1000); } catch (_e2) { }
            return;
          }

          ws.onmessage = function (ev) {
            try {
              if (!ev || !ev.data) return;
              applyPayload(state, JSON.parse(ev.data));
            } catch (_e) { }
          };
          ws.onerror = function (err) {
            try { console.error('VisNetwork WebSocket error', err); } catch (_e) { }
            try { if (ws) ws.close(); } catch (_e) { }
          };
          ws.onclose = function () {
            if (stopped) return;
            try { setTimeout(connect, 1000); } catch (_e) { }
          };
        }
        connect();

        try {
          window.addEventListener('beforeunload', function () {
            stopped = true;
            try { if (ws) ws.close(); } catch (_e) { }
          });
        } catch (_e) { }
        return;
      }
    } catch (_e) { }
  }

  function initRemote(container, cfg) {
    if (!container || !cfg) return;

    var embeddedNodes = cfg.embeddedNodes || [];
    var embeddedEdges = cfg.embeddedEdges || [];

    var state = {
      nodes: null,
      edges: null,
      network: null,
      embeddedNodes: embeddedNodes,
      embeddedEdges: embeddedEdges
    };

    (async function () {
      var payload = await fetchPayload(cfg.url, cfg.request);
      var p = normalizePayload(payload);

      var nodes = null;
      var edges = null;
      var network = null;

      nodes = new vis.DataSet(p.nodes);
      edges = new vis.DataSet(p.edges);

      try { if (embeddedNodes && embeddedNodes.length) nodes.add(embeddedNodes); } catch (_e) { }
      try { if (embeddedEdges && embeddedEdges.length) edges.add(embeddedEdges); } catch (_e) { }

      var data = { nodes: nodes, edges: edges };

      var appliedTheme = null;
      try {
        if (window.hfxVisNetwork && typeof window.hfxVisNetwork.applyThemeDefaults === 'function') {
          appliedTheme = window.hfxVisNetwork.applyThemeDefaults(container, cfg.options);
        }
      } catch (_th) { /* ignore */ }

      network = loadDiagramWithFonts(container, data, cfg.options, cfg.id, !!cfg.enableLoadingBar, false);

      state.nodes = nodes;
      state.edges = edges;
      state.network = network;

      try {
        if (window.hfxVisNetwork && typeof window.hfxVisNetwork.bindTheme === 'function') {
          window.hfxVisNetwork.bindTheme(container, state.network, appliedTheme);
        }
      } catch (_tb) { /* ignore */ }

      afterNetworkCreated(container, state, cfg);
      startLiveUpdates(state, cfg);
    })().catch(function (err) {
      try { console.error('VisNetwork remote data load failed', err); } catch (_e) { }

      // Fallback: if embedded nodes/edges are present, render them instead of only showing Error.
      var fallbackPossible = false;
      try { fallbackPossible = (embeddedNodes && embeddedNodes.length) || (embeddedEdges && embeddedEdges.length); } catch (_e) { }
      if (fallbackPossible) {
        try {
          if (tryRenderEmbeddedFallback(container, state, cfg)) {
            startLiveUpdates(state, cfg);
            return;
          }
        } catch (_e) { }
      }

      try { var txt = document.getElementById(cfg.id + '-diagramText'); if (txt) txt.textContent = 'Error'; } catch (_e) { }
    });
  }

  window.hfxVisNetwork = window.hfxVisNetwork || {};
  window.hfxVisNetwork.applyThemeDefaults = applyThemeDefaults;
  window.hfxVisNetwork.bindTheme = bindTheme;
  window.hfxVisNetwork.initRemote = initRemote;
})();
