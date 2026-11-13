(function () {
  "use strict";

  var labels = {
    connecting: "Live stream connecting",
    connected: "Live stream connected",
    updated: "Live data updated",
    waiting: "Waiting for live data",
    unsupported: "Live stream unsupported",
    disconnected: "Live stream reconnecting",
    "invalid-source": "Live stream address invalid",
    "invalid-event": "Live stream event invalid",
    "invalid-data": "Live data invalid"
  };

  function attribute(root, name, fallback) {
    var value = root.getAttribute(name);
    return value === null ? fallback : value;
  }

  function enabled(root, name, fallback) {
    return attribute(root, name, fallback ? "true" : "false").trim().toLowerCase() === "true";
  }

  function setState(root, state) {
    if (root.getAttribute("data-hfx-monitoring-live-state") === state) return;
    root.setAttribute("data-hfx-monitoring-live-state", state);
    var label = root.querySelector("[data-hfx-monitoring-live-label]");
    if (label) label.textContent = labels[state] || labels.connecting;
    root.dispatchEvent(new CustomEvent("hfx:monitoring-live-state-changed", {
      bubbles: true,
      detail: { state: state }
    }));
  }

  function fingerprint(payload, propertyName) {
    if (!payload || typeof payload !== "object" || !propertyName) return "";
    var value = payload[propertyName];
    return value === null || value === undefined ? "" : String(value);
  }

  function init(root) {
    if (!root || root.getAttribute("data-hfx-monitoring-live-ready") === "true") return;
    root.setAttribute("data-hfx-monitoring-live-ready", "true");

    var streamUrl = attribute(root, "data-hfx-monitoring-live-stream-url", "").trim();
    var updateEvent = attribute(root, "data-hfx-monitoring-live-update-event", "message").trim() || "message";
    var fingerprintProperty = attribute(root, "data-hfx-monitoring-live-fingerprint-property", "payloadHash").trim() || "payloadHash";
    var currentFingerprint = attribute(root, "data-hfx-monitoring-live-initial-fingerprint", "");
    var waitingEvent = attribute(root, "data-hfx-monitoring-live-waiting-event", "").trim();
    var invalidEvent = attribute(root, "data-hfx-monitoring-live-invalid-event", "").trim();
    var refreshPage = enabled(root, "data-hfx-monitoring-live-refresh", true);
    var withCredentials = enabled(root, "data-hfx-monitoring-live-with-credentials", false);
    var reloadDelay = Number.parseInt(attribute(root, "data-hfx-monitoring-live-reload-delay", "350"), 10);
    var reloadPending = false;

    if (!Number.isFinite(reloadDelay) || reloadDelay < 0) reloadDelay = 350;
    if (!streamUrl || !("EventSource" in window)) {
      setState(root, "unsupported");
      return;
    }

    var source;
    try {
      source = withCredentials
        ? new EventSource(streamUrl, { withCredentials: true })
        : new EventSource(streamUrl);
    } catch (error) {
      setState(root, "invalid-source");
      return;
    }

    source.addEventListener("open", function () {
      setState(root, "connected");
    });

    source.addEventListener(updateEvent, function (event) {
      try {
        var payload = JSON.parse(event.data);
        var nextFingerprint = fingerprint(payload, fingerprintProperty);
        if (!nextFingerprint) {
          setState(root, "invalid-event");
          return;
        }

        if (nextFingerprint === currentFingerprint) {
          setState(root, "connected");
          return;
        }
        currentFingerprint = nextFingerprint;
        setState(root, "updated");
        root.dispatchEvent(new CustomEvent("hfx:monitoring-live-updated", {
          bubbles: true,
          detail: payload
        }));
        if (refreshPage && !reloadPending) {
          reloadPending = true;
          window.setTimeout(function () { window.location.reload(); }, reloadDelay);
        }
      } catch (error) {
        setState(root, "invalid-event");
      }
    });

    if (waitingEvent) {
      source.addEventListener(waitingEvent, function () {
        setState(root, "waiting");
      });
    }

    if (invalidEvent) {
      source.addEventListener(invalidEvent, function () {
        setState(root, "invalid-data");
      });
    }

    source.addEventListener("error", function () {
      setState(root, "disconnected");
    });
  }

  function initAll(scope) {
    (scope || document).querySelectorAll("[data-hfx-monitoring-live]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initAll(document); });
  } else {
    initAll(document);
  }

  window.HtmlForgeX = window.HtmlForgeX || {};
  window.HtmlForgeX.monitoringLive = { init: init, initAll: initAll };
}());
