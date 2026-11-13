(function () {
  function hfxQuery(selector) {
    try {
      return document.querySelector(selector);
    } catch (_e) {
      return null;
    }
  }

  function getCopyText(el) {
    if (!el) return "";
    var txt = el.getAttribute("data-hfx-copy-text");
    if (txt != null) return txt;

    var target = el.getAttribute("data-hfx-copy-target");
    if (!target) return "";

    var node = hfxQuery(target);
    if (!node && target[0] !== "#") {
      node = document.getElementById(target);
    }
    if (!node) return "";

    try {
      if (typeof node.value !== "undefined") {
        return node.value || "";
      }
    } catch (_e) {}

    try {
      return node.textContent || "";
    } catch (_e) {}

    return "";
  }

  function copyViaTextarea(text) {
    var ta, onCopy, active = document.activeElement;
    try {
      ta = document.createElement("textarea");
      ta.value = text || "";
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      // A textarea normalizes CR/CRLF. Supply the original payload through the copy event instead of reading
      // its normalized value. If that event has no writable clipboard, cancel rather than copy altered text.
      var supplied = false, blocked = false;
      onCopy = function (event) {
        if (event.clipboardData && event.clipboardData.setData) {
          event.preventDefault();
          blocked = true;
          try { event.clipboardData.setData("text/plain", text); supplied = true; } catch (_) { }
        } else if (ta.value !== text) { event.preventDefault(); blocked = true; }
      };
      document.addEventListener("copy", onCopy, true);
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_e) {
        ok = false;
      }
      return ok && (supplied || !blocked && ta.value === text);
    } catch (_e) {
      return false;
    } finally {
      if (onCopy) document.removeEventListener("copy", onCopy, true);
      if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
      try { if (active && document.documentElement.contains(active)) active.focus({ preventScroll: true }); } catch (_) { }
    }
  }

  function setStatus(el, ok) {
    if (!el) return;
    var selector = el.getAttribute("data-hfx-copy-status-target");
    if (!selector) return;

    var statusEl = hfxQuery(selector);
    if (!statusEl && selector[0] !== "#") {
      statusEl = document.getElementById(selector);
    }
    if (!statusEl) return;

    var okText = el.getAttribute("data-hfx-copy-status-ok") || "Copied";
    var failText = el.getAttribute("data-hfx-copy-status-fail") || "Copy failed";

    try {
      statusEl.textContent = ok ? okText : failText;
    } catch (_e) {}

    // Clear after a short delay (best-effort).
    try {
      var timeout = parseInt(el.getAttribute("data-hfx-copy-status-clear-ms") || "2000", 10);
      if (timeout > 0) {
        setTimeout(function () {
          try {
            statusEl.textContent = "";
          } catch (_e) {}
        }, timeout);
      }
    } catch (_e) {}
  }

  function copyTextAsync(text, done) {
    // Modern API (secure contexts)
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text || "")
          .then(function () {
            done(true);
          })
          .catch(function () {
            done(copyViaTextarea(text));
          });
        return;
      }
    } catch (_e) {}

    done(copyViaTextarea(text));
  }

  function onClick(ev) {
    if (!ev) return;

    var el = ev.target;
    if (!el) return;

    // Find actionable element.
    try {
      if (el.closest) {
        el = el.closest("[data-hfx-copy-text],[data-hfx-copy-target]");
      } else {
        // Old browsers: walk up
        var cur = el;
        while (cur && cur !== document.documentElement) {
          if (
            cur.getAttribute &&
            (cur.getAttribute("data-hfx-copy-text") != null ||
              cur.getAttribute("data-hfx-copy-target") != null)
          ) {
            el = cur;
            break;
          }
          cur = cur.parentNode;
        }
      }
    } catch (_e) {}

    if (!el || !el.getAttribute) return;
    if (
      el.getAttribute("data-hfx-copy-text") == null &&
      el.getAttribute("data-hfx-copy-target") == null
    ) {
      return;
    }

    try {
      ev.preventDefault();
    } catch (_e) {}

    var text = getCopyText(el);
    copyTextAsync(text, function (ok) {
      try {
        el.setAttribute("data-hfx-copy-status", ok ? "copied" : "failed");
      } catch (_e) {}
      setStatus(el, ok);
    });
  }

  function init() {
    if (window.__hfxClipboardBound) return;
    window.__hfxClipboardBound = true;
    document.addEventListener("click", onClick);
  }

  // Public init hook for dynamic DOM injection (optional).
  window.hfxClipboardInit = function (_root) {
    init();
  };

  try {
    init();
  } catch (_e) {}
})();

