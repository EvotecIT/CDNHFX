(function () {
    function onReady(callback) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", callback, { once: true });
            return;
        }

        callback();
    }

    function isMobileSidebar() {
        return window.matchMedia && window.matchMedia("(max-width: 991.98px)").matches;
    }

    function setSidebarState(page, collapse, toggles, open) {
        collapse.classList.remove("collapsing");
        collapse.classList.add("collapse", "navbar-collapse");
        collapse.classList.toggle("show", open);
        page.setAttribute("data-hfx-mobile-sidebar", open ? "open" : "closed");

        toggles.forEach(function (toggle) {
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            toggle.classList.toggle("collapsed", !open);
        });
    }

    function createHeaderSidebarToggle(page, target, collapseId) {
        var header = page.querySelector(":scope > header.navbar");
        if (!header) return null;

        var container = header.querySelector(".hfx-header-navbar__container, .container-fluid") || header;
        if (container.querySelector("[data-hfx-generated-sidebar-toggle='true']")) {
            return container.querySelector("[data-hfx-generated-sidebar-toggle='true']");
        }

        var button = document.createElement("button");
        button.type = "button";
        button.className = "navbar-toggler hfx-mobile-sidebar-toggle collapsed";
        button.setAttribute("data-hfx-generated-sidebar-toggle", "true");
        button.setAttribute("data-hfx-sidebar-toggle", "true");
        button.setAttribute("data-bs-target", target);
        button.setAttribute("aria-controls", collapseId);
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Open sidebar navigation");

        var icon = document.createElement("span");
        icon.className = "navbar-toggler-icon";
        button.appendChild(icon);

        var headerToggle = container.querySelector(".navbar-toggler:not([data-hfx-generated-sidebar-toggle])");
        if (headerToggle && headerToggle.parentNode === container) {
            headerToggle.insertAdjacentElement("afterend", button);
        } else {
            container.insertBefore(button, container.firstChild);
        }

        return button;
    }

    function initComboSidebar(page) {
        var aside = page.querySelector(":scope > aside.navbar-vertical");
        if (!aside) return;

        var collapse = aside.querySelector(".navbar-collapse.collapse[id]");
        if (!collapse) return;

        var target = "#" + collapse.id;
        var toggles = Array.prototype.slice.call(page.querySelectorAll(":scope > header.navbar .navbar-toggler, :scope > aside.navbar-vertical .navbar-toggler"));
        toggles = toggles.filter(function (toggle) {
            var rawTarget = toggle.getAttribute("data-bs-target") || "";
            var targetElement = rawTarget.charAt(0) === "#" ? document.getElementById(rawTarget.substring(1)) : null;
            return toggle.closest("aside.navbar-vertical") || rawTarget === target || !targetElement;
        });

        var hasHeaderSidebarToggle = toggles.some(function (toggle) {
            return toggle.closest("header.navbar");
        });
        if (!hasHeaderSidebarToggle) {
            var generated = createHeaderSidebarToggle(page, target, collapse.id);
            if (generated) {
                toggles.push(generated);
            }
        }

        if (toggles.length === 0) return;

        toggles.forEach(function (toggle) {
            toggle.setAttribute("data-hfx-sidebar-toggle", "true");
            toggle.removeAttribute("data-bs-toggle");
            toggle.setAttribute("data-bs-target", target);
            toggle.setAttribute("aria-controls", collapse.id);
        });

        setSidebarState(page, collapse, toggles, !isMobileSidebar() && collapse.classList.contains("show"));

        page.addEventListener("click", function (event) {
            var toggle = event.target.closest("[data-hfx-sidebar-toggle='true']");
            if (!toggle || !page.contains(toggle) || !isMobileSidebar()) return;

            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            setSidebarState(page, collapse, toggles, !collapse.classList.contains("show"));
        }, true);

        collapse.addEventListener("shown.bs.collapse", function () {
            setSidebarState(page, collapse, toggles, true);
        });

        collapse.addEventListener("hidden.bs.collapse", function () {
            setSidebarState(page, collapse, toggles, false);
        });
    }

    onReady(function () {
        document.querySelectorAll(".page.layout-combo[data-hfx-navigation-shell]").forEach(initComboSidebar);
    });
})();
