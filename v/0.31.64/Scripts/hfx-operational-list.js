(function () {
  "use strict";

  const initializedLists = new WeakSet();
  const initializedWorkspaces = new WeakSet();
  let filterDocumentCloseInitialized = false;
  const workspacePresetClasses = {
    standard: "",
    framed: "hfx-operational-workspace--framed",
    frosted: "hfx-operational-workspace--frosted",
    dark: "hfx-operational-workspace--dark",
    "mixed-dashboard": "hfx-operational-workspace--mixed",
    "product-suite": "hfx-operational-workspace--product-suite"
  };
  const workspacePaletteClasses = {
    default: "",
    neutral: "hfx-operational-workspace--palette-neutral",
    emerald: "hfx-operational-workspace--palette-emerald",
    azure: "hfx-operational-workspace--palette-azure",
    indigo: "hfx-operational-workspace--palette-indigo",
    amber: "hfx-operational-workspace--palette-amber",
    rose: "hfx-operational-workspace--palette-rose"
  };
  const workspaceThemeStates = [
    { preset: "mixed-dashboard", palette: "azure", label: "Dashboard / Azure" },
    { preset: "product-suite", palette: "indigo", label: "Product / Indigo" },
    { preset: "standard", palette: "emerald", label: "Clean / Emerald" },
    { preset: "frosted", palette: "indigo", label: "Frosted / Indigo" },
    { preset: "dark", palette: "default", label: "Command / Dark" },
    { preset: "mixed-dashboard", palette: "amber", label: "Dashboard / Amber" },
    { preset: "framed", palette: "neutral", label: "Framed / Neutral" }
  ];

  function normalize(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function debounce(callback, delay) {
    let timeoutId = 0;
    return function debounced() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(callback, delay);
    };
  }

  function initOperationalList(list) {
    if (!list || initializedLists.has(list)) {
      return;
    }

    initializedLists.add(list);

    const search = list.querySelector("[data-hfx-operational-search-input]");
    const tabs = Array.from(list.querySelectorAll("[data-hfx-operational-tab]"));
    const filters = Array.from(list.querySelectorAll("[data-hfx-operational-filter]"));
    const items = Array.from(list.querySelectorAll("[data-hfx-operational-item]"));

    items.forEach((item, index) => {
      item.setAttribute("data-hfx-operational-order", index.toString());
    });

    if (search) {
      const applySearchFilters = debounce(() => applyListFilters(list), 150);
      search.addEventListener("input", applySearchFilters);
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((candidate) => {
          const active = candidate === tab;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-pressed", active ? "true" : "false");
        });
        applyListFilters(list);
      });
    });

    initListFilterControls(list, filters);

    items.forEach((item) => {
      item.querySelectorAll("[data-hfx-operational-item-action]").forEach((action) => {
        if (normalize(action.getAttribute("data-hfx-operational-item-action")) === "inspect") {
          updateInspectionAction(action, action.getAttribute("aria-expanded") === "true");
        }

        action.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const actionName = action.getAttribute("data-hfx-operational-item-action");
          const inspected = normalize(actionName) === "inspect" && hasInspectionTrigger(list, "action-button")
            ? toggleItemInspection(list, item, action)
            : null;
          list.dispatchEvent(new CustomEvent("hfx:operational-list-action", {
            bubbles: true,
            detail: {
              action: actionName,
              label: (action.textContent || "").trim(),
              id: item.getAttribute("data-hfx-operational-id"),
              key: item.getAttribute("data-hfx-operational-key"),
              inspected
            }
          }));
        });
      });
      item.addEventListener("click", (event) => activateItem(list, item, event));
      item.addEventListener("keydown", (event) => {
        if (getSelectionMode(list) === "none" && !hasInspectionTrigger(list, "item-click")) {
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        activateItem(list, item, event);
      });
    });

    applyListFilters(list);
  }

  function getSelectionMode(list) {
    const mode = normalize(list.getAttribute("data-hfx-operational-selection"));
    if (mode === "none" || mode === "multiple") {
      return mode;
    }
    return "single";
  }

  function hasInspectionTrigger(list, trigger) {
    const value = normalize(list.getAttribute("data-hfx-operational-inspection-trigger")) || "action-button item-click";
    if (value === "none") {
      return false;
    }
    return value.split(/[\s,|]+/).includes(trigger);
  }

  function initListFilterControls(list, filters) {
    if (!filters.length) {
      return;
    }

    initFilterDocumentCloseHandler();

    filters.forEach((filter, index) => {
      const id = resolveFilterMenuId(list, filter, index);
      filter.setAttribute("aria-haspopup", "menu");
      filter.setAttribute("aria-expanded", "false");
      filter.setAttribute("aria-controls", id);
      if (!filter.hasAttribute("aria-pressed")) {
        filter.setAttribute("aria-pressed", "false");
      }
      filter.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFilterMenu(list, filter, id);
      });
      filter.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowDown") {
          return;
        }
        event.preventDefault();
        toggleFilterMenu(list, filter, id, true);
      });
    });

    list.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const openOwner = list.querySelector("[data-hfx-operational-filter][aria-expanded='true']");
        closeFilterMenus(list);
        openOwner?.focus();
      }
    });

  }

  function resolveFilterMenuId(list, filter, index) {
    const listId = list.id || "hfx-operational-list";
    const label = toSafeId(filter.getAttribute("data-hfx-operational-filter") || "filter");
    return `${listId}-filter-menu-${label}-${index + 1}`;
  }

  function initFilterDocumentCloseHandler() {
    if (filterDocumentCloseInitialized) {
      return;
    }

    filterDocumentCloseInitialized = true;
    document.addEventListener("click", (event) => {
      const target = event.target;
      document.querySelectorAll("[data-hfx-operational-list]").forEach((list) => {
        const filter = target?.closest?.("[data-hfx-operational-filter]");
        const menu = target?.closest?.("[data-hfx-operational-filter-menu]");
        const clickedThisListFilter = Boolean(filter && list.contains(filter));
        const clickedThisListMenu = Boolean(menu && list.contains(menu));
        if (!clickedThisListFilter && !clickedThisListMenu) {
          closeFilterMenus(list);
        }
      });
    });
  }

  function toggleFilterMenu(list, filter, id, focusMenu) {
    const menu = ensureFilterMenu(list, filter, id);
    const willOpen = menu.hidden;

    closeAllFilterMenus(filter);
    menu.hidden = !willOpen;
    filter.classList.toggle("is-open", willOpen);
    filter.setAttribute("aria-expanded", willOpen ? "true" : "false");

    list.dispatchEvent(new CustomEvent("hfx:operational-list-filter-click", {
      bubbles: true,
      detail: { label: filter.getAttribute("data-hfx-operational-filter"), open: willOpen }
    }));

    if (willOpen && focusMenu) {
      const focusable = menu.querySelector("button, input");
      focusable?.focus();
    }
  }

  function closeFilterMenus(list, exceptFilter) {
    list.querySelectorAll("[data-hfx-operational-filter-menu]").forEach((menu) => {
      const owner = list.querySelector(`[aria-controls="${menu.id}"]`);
      if (owner && owner === exceptFilter) {
        return;
      }
      menu.hidden = true;
      owner?.classList.remove("is-open");
      owner?.setAttribute("aria-expanded", "false");
    });
  }

  function closeAllFilterMenus(exceptFilter) {
    document.querySelectorAll("[data-hfx-operational-list]").forEach((list) => {
      closeFilterMenus(list, exceptFilter);
    });
  }

  function ensureFilterMenu(list, filter, id) {
    let menu = document.getElementById(id);
    if (menu && !list.contains(menu)) {
      menu = null;
    }
    if (menu) {
      return menu;
    }

    const label = filter.getAttribute("data-hfx-operational-filter") || "Filter";
    menu = document.createElement("div");
    menu.id = id;
    menu.hidden = true;
    menu.className = "hfx-operational-list__filter-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("data-hfx-operational-filter-menu", label);
    menu.addEventListener("click", (event) => event.stopPropagation());

    menu.appendChild(createFilterMenuHeader(list, filter, label));

    if (getFilterKind(filter) === "sort") {
      menu.appendChild(createSortOption(list, filter, "default", "Original order"));
      menu.appendChild(createSortOption(list, filter, "newest", "Newest first"));
      menu.appendChild(createSortOption(list, filter, "oldest", "Oldest first"));
    } else {
      const statuses = getStatusOptions(list);
      if (statuses.length) {
        const group = document.createElement("div");
        group.className = "hfx-operational-list__filter-group";
        statuses.forEach((status, index) => group.appendChild(createStatusOption(list, filter, status, index)));
        menu.appendChild(group);
      } else {
        const empty = document.createElement("div");
        empty.className = "hfx-operational-list__filter-empty";
        empty.textContent = "No filterable statuses";
        menu.appendChild(empty);
      }

      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "hfx-operational-list__filter-reset";
      clear.textContent = "Clear filters";
      clear.addEventListener("click", () => {
        list.__hfxOperationalFilterStatuses = new Set();
        menu.querySelectorAll("input[type='checkbox']").forEach((input) => {
          input.checked = false;
        });
        updateFilterButtonState(list, filter);
        applyListFilters(list);
        dispatchFilterChange(list, filter);
      });
      menu.appendChild(clear);
    }

    filter.insertAdjacentElement("afterend", menu);
    return menu;
  }

  function createFilterMenuHeader(list, filter, label) {
    const header = document.createElement("div");
    header.className = "hfx-operational-list__filter-title";

    const title = document.createElement("span");
    title.textContent = label;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "hfx-operational-list__filter-close";
    close.setAttribute("aria-label", `Close ${label} menu`);
    close.textContent = "Close";
    close.addEventListener("click", () => {
      closeFilterMenus(list);
      filter.focus();
    });

    header.append(title, close);
    return header;
  }

  function getFilterKind(filter) {
    const kind = normalize(filter?.getAttribute("data-hfx-operational-filter-kind"));
    return kind === "sort" ? "sort" : "status";
  }

  function getStatusOptions(list) {
    const counts = new Map();
    Array.from(list.querySelectorAll("[data-hfx-operational-item]")).forEach((item) => {
      const raw = (item.getAttribute("data-hfx-operational-status") || "").trim();
      if (!raw) {
        return;
      }
      counts.set(raw, (counts.get(raw) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  }

  function getActiveStatusFilters(list) {
    if (!(list.__hfxOperationalFilterStatuses instanceof Set)) {
      list.__hfxOperationalFilterStatuses = new Set();
    }
    return list.__hfxOperationalFilterStatuses;
  }

  function createStatusOption(list, filter, status, index) {
    const ownerId = filter.getAttribute("aria-controls") || "hfx-operational-filter";
    const id = `${ownerId}-status-${toSafeId(status.label)}-${index}`;
    const label = document.createElement("label");
    label.className = "hfx-operational-list__filter-option";
    label.setAttribute("role", "menuitemcheckbox");
    label.setAttribute("for", id);

    const input = document.createElement("input");
    input.id = id;
    input.type = "checkbox";
    input.value = status.label;
    input.checked = getActiveStatusFilters(list).has(normalize(status.label));
    input.addEventListener("change", () => {
      const active = getActiveStatusFilters(list);
      const token = normalize(status.label);
      if (input.checked) {
        active.add(token);
      } else {
        active.delete(token);
      }
      updateFilterButtonState(list, filter);
      applyListFilters(list);
      dispatchFilterChange(list, filter);
    });

    const text = document.createElement("span");
    text.textContent = status.label;
    const count = document.createElement("small");
    count.textContent = status.count.toString();

    label.append(input, text, count);
    return label;
  }

  function toSafeId(value) {
    return normalize(value)
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "option";
  }

  function createSortOption(list, filter, mode, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hfx-operational-list__filter-sort";
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("data-hfx-operational-sort-option", mode);
    button.setAttribute("aria-checked", getSortMode(list) === mode ? "true" : "false");
    button.textContent = label;
    button.addEventListener("click", () => {
      list.setAttribute("data-hfx-operational-sort", mode);
      sortOperationalItems(list, mode);
      updateSortOptions(list);
      filter.classList.toggle("is-active", mode !== "default");
      filter.setAttribute("aria-pressed", mode !== "default" ? "true" : "false");
      closeFilterMenus(list);
      list.dispatchEvent(new CustomEvent("hfx:operational-list-sort-change", {
        bubbles: true,
        detail: { label: filter.getAttribute("data-hfx-operational-filter"), sort: mode }
      }));
    });
    return button;
  }

  function getSortMode(list) {
    return normalize(list.getAttribute("data-hfx-operational-sort")) || "default";
  }

  function updateSortOptions(list) {
    const mode = getSortMode(list);
    list.querySelectorAll(".hfx-operational-list__filter-sort").forEach((button) => {
      const checked = button.getAttribute("data-hfx-operational-sort-option") === mode;
      button.setAttribute("aria-checked", checked ? "true" : "false");
    });
  }

  function sortOperationalItems(list, mode) {
    const cards = list.querySelector(".hfx-operational-list__cards");
    if (!cards) {
      return;
    }

    const empty = cards.querySelector("[data-hfx-operational-empty]");
    const items = Array.from(cards.querySelectorAll("[data-hfx-operational-item]"));
    items.sort((a, b) => {
      const aOrder = Number(a.getAttribute("data-hfx-operational-order") || "0");
      const bOrder = Number(b.getAttribute("data-hfx-operational-order") || "0");
      if (mode !== "default") {
        const aHasSortValue = hasOperationalSortValue(a);
        const bHasSortValue = hasOperationalSortValue(b);
        if (aHasSortValue !== bHasSortValue) {
          return aHasSortValue ? -1 : 1;
        }

        const sortValue = compareOperationalSortValues(a, b, aOrder, bOrder);
        if (sortValue !== 0) {
          return mode === "oldest" ? sortValue : -sortValue;
        }
      }
      if (mode === "oldest") {
        return bOrder - aOrder;
      }
      return aOrder - bOrder;
    });

    items.forEach((item) => cards.insertBefore(item, empty || null));
  }

  function hasOperationalSortValue(item) {
    return Boolean((item.getAttribute("data-hfx-operational-sort-key") || "").trim());
  }

  function compareOperationalSortValues(a, b, aOrder, bOrder) {
    const aValue = (a.getAttribute("data-hfx-operational-sort-key") || "").trim();
    const bValue = (b.getAttribute("data-hfx-operational-sort-key") || "").trim();
    if (!aValue && !bValue) {
      return 0;
    }

    const aNumber = Number(aValue);
    const bNumber = Number(bValue);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber === bNumber ? aOrder - bOrder : aNumber - bNumber;
    }

    const aTime = Date.parse(aValue);
    const bTime = Date.parse(bValue);
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return aTime === bTime ? aOrder - bOrder : aTime - bTime;
    }

    const compared = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: "base" });
    return compared === 0 ? aOrder - bOrder : compared;
  }

  function updateFilterButtonState(list, filter) {
    const active = getActiveStatusFilters(list).size > 0;
    filter.classList.toggle("is-active", active);
    filter.setAttribute("aria-pressed", active ? "true" : "false");
    list.setAttribute("data-hfx-operational-active-filters", Array.from(getActiveStatusFilters(list)).join(" "));
  }

  function dispatchFilterChange(list, filter) {
    list.dispatchEvent(new CustomEvent("hfx:operational-list-filter-change", {
      bubbles: true,
      detail: {
        label: filter.getAttribute("data-hfx-operational-filter"),
        statuses: Array.from(getActiveStatusFilters(list))
      }
    }));
  }

  function applyListFilters(list) {
    const query = normalize(list.querySelector("[data-hfx-operational-search-input]")?.value);
    const activeTab = list.querySelector("[data-hfx-operational-tab].is-active");
    const activeToken = normalize(activeTab?.getAttribute("data-hfx-operational-tab"));
    const items = Array.from(list.querySelectorAll("[data-hfx-operational-item]"));
    const activeStatuses = getActiveStatusFilters(list);
    let visibleCount = 0;

    items.forEach((item) => {
      const searchable = normalize(item.getAttribute("data-hfx-operational-search"));
      const status = normalize(item.getAttribute("data-hfx-operational-status"));
      const matchesSearch = !query || searchable.includes(query);
      const matchesTab = !activeToken || activeToken === "all" || status === activeToken;
      const matchesFilters = activeStatuses.size === 0 || activeStatuses.has(status);
      const visible = matchesSearch && matchesTab && matchesFilters;

      item.hidden = !visible;
      item.classList.toggle("is-hidden", !visible);
      if (!visible) {
        closeItemInspection(item);
      }
      if (visible) {
        visibleCount += 1;
      }
    });

    const empty = list.querySelector("[data-hfx-operational-empty]");
    if (empty) {
      empty.hidden = visibleCount > 0;
    }

    list.dispatchEvent(new CustomEvent("hfx:operational-list-filtered", {
      bubbles: true,
      detail: { visibleCount, query, status: activeToken, filters: Array.from(activeStatuses) }
    }));
  }

  function getItemInspectionPanel(item) {
    return Array.from(item.children).find((child) => {
      return child.matches && child.matches("[data-hfx-operational-inspection]");
    }) || null;
  }

  function updateInspectionAction(action, open) {
    if (!action) {
      return;
    }

    const collapsedLabel = action.getAttribute("data-hfx-operational-action-label") || "Inspect";
    const expandedLabel = action.getAttribute("data-hfx-operational-action-expanded-label") || "Collapse";
    const label = action.querySelector("[data-hfx-operational-action-label-text]");
    const activeLabel = open ? expandedLabel : collapsedLabel;
    const itemLabel = action.closest("[data-hfx-operational-item]")?.getAttribute("data-hfx-operational-label");

    if (label) {
      label.textContent = activeLabel;
    }

    action.setAttribute("aria-expanded", open ? "true" : "false");
    action.setAttribute("aria-label", itemLabel ? `${activeLabel} ${itemLabel}` : activeLabel);
    action.setAttribute("title", activeLabel);
  }

  function getItemInspectionAction(item) {
    return item.querySelector("[data-hfx-operational-action-kind='inspect']");
  }

  function closeItemInspection(item) {
    const panel = getItemInspectionPanel(item);
    const wasOpen = Boolean(panel && !panel.hidden) || item.classList.contains("is-inspected");

    if (panel) {
      panel.hidden = true;
    }

    item.classList.remove("is-inspected");
    if (item.hasAttribute("aria-expanded")) {
      item.setAttribute("aria-expanded", "false");
    }

    item.querySelectorAll("[data-hfx-operational-action-kind='inspect']").forEach((candidateAction) => {
      updateInspectionAction(candidateAction, false);
    });

    return wasOpen;
  }

  function shouldIgnoreItemActivation(event, item) {
    const target = event?.target;
    if (!target || !target.closest) {
      return false;
    }

    if (target.closest("[data-hfx-operational-inspection]")) {
      return true;
    }

    const interactive = target.closest("a, button, input, select, textarea, label, summary, [data-hfx-operational-item-action]");
    return Boolean(interactive && interactive !== item);
  }

  function activateItem(list, item, event) {
    if (shouldIgnoreItemActivation(event, item)) {
      return;
    }

    if (hasInspectionTrigger(list, "item-click")) {
      toggleItemInspection(list, item, getItemInspectionAction(item));
    }

    toggleItemSelection(list, item);
  }

  function toggleItemInspection(list, item, action) {
    const panel = getItemInspectionPanel(item);
    if (!panel) {
      return null;
    }

    const willOpen = panel.hidden;
    Array.from(list.querySelectorAll("[data-hfx-operational-item].is-inspected")).forEach((candidate) => {
      if (candidate === item) {
        return;
      }

      closeItemInspection(candidate);
    });

    panel.hidden = !willOpen;
    item.classList.toggle("is-inspected", willOpen);
    if (item.hasAttribute("aria-expanded")) {
      item.setAttribute("aria-expanded", willOpen ? "true" : "false");
    }
    updateInspectionAction(action, willOpen);

    list.dispatchEvent(new CustomEvent("hfx:operational-list-inspection-toggle", {
      bubbles: true,
      detail: {
        id: item.getAttribute("data-hfx-operational-id"),
        key: item.getAttribute("data-hfx-operational-key"),
        open: willOpen,
        panel
      }
    }));

    return willOpen;
  }

  function toggleItemSelection(list, item) {
    const mode = getSelectionMode(list);
    if (mode === "none") {
      return;
    }

    const selected = item.classList.contains("is-selected");

    if (mode === "single") {
      Array.from(list.querySelectorAll("[data-hfx-operational-item].is-selected")).forEach((candidate) => {
        candidate.classList.remove("is-selected");
        candidate.setAttribute("aria-selected", "false");
      });
    }

    if (!selected) {
      item.classList.add("is-selected");
      item.setAttribute("aria-selected", "true");
    } else if (mode === "multiple") {
      item.classList.remove("is-selected");
      item.setAttribute("aria-selected", "false");
    }

    list.dispatchEvent(new CustomEvent("hfx:operational-list-selected", {
      bubbles: true,
      detail: {
        id: selected ? null : item.getAttribute("data-hfx-operational-id"),
        key: selected ? null : item.getAttribute("data-hfx-operational-key"),
        mode,
        selected: !selected
      }
    }));
  }

  function directWorkspaceItems(workspace, selector) {
    return Array.from(workspace.querySelectorAll(selector)).filter((candidate) => {
      return candidate.closest("[data-hfx-operational-workspace]") === workspace;
    });
  }

  function initOperationalWorkspace(workspace) {
    if (!workspace || initializedWorkspaces.has(workspace)) {
      return;
    }

    initializedWorkspaces.add(workspace);

    workspace.addEventListener("click", (event) => {
      const item = event.target.closest("[data-hfx-operational-nav-item]");
      if (!item || !workspace.contains(item)) {
        return;
      }

      if (item.closest("[data-hfx-operational-workspace]") !== workspace) {
        return;
      }

      if (item.tagName === "A") {
        return;
      }

      const target = item.getAttribute("data-hfx-operational-nav-target");
      if (!target) {
        const action = normalize(item.getAttribute("data-hfx-operational-nav-action"));
        let theme = null;
        if (action === "theme") {
          theme = cycleWorkspaceTheme(workspace);
        }

        workspace.dispatchEvent(new CustomEvent("hfx:operational-workspace-nav-action", {
          bubbles: true,
          detail: {
            action: item.getAttribute("data-hfx-operational-nav-action") || null,
            label: (item.textContent || "").trim(),
            theme
          }
        }));
        return;
      }

      showWorkspacePage(workspace, target);
    });

    directWorkspaceItems(workspace, "[data-hfx-operational-sidebar-search]").forEach((search) => {
      const applySidebarSearch = debounce(() => applyWorkspaceSidebarSearch(workspace, search.value), 150);
      search.addEventListener("input", applySidebarSearch);
    });

    const activeTarget = directWorkspaceItems(workspace, "[data-hfx-operational-nav-item].is-active[data-hfx-operational-nav-target]")[0];
    if (activeTarget) {
      showWorkspacePage(workspace, activeTarget.getAttribute("data-hfx-operational-nav-target"));
    }

    const currentTheme = getCurrentWorkspaceTheme(workspace);
    workspace.setAttribute("data-hfx-operational-theme-label", currentTheme.label);
    updateThemeActions(workspace, currentTheme);
  }

  function applyWorkspaceSidebarSearch(workspace, query) {
    const normalizedQuery = normalize(query);
    const items = directWorkspaceItems(workspace, "[data-hfx-operational-nav-item]");

    items.forEach((item) => {
      const text = normalize(item.textContent);
      const matched = !normalizedQuery || text.includes(normalizedQuery);
      item.hidden = !matched;
    });

    directWorkspaceItems(workspace, "[data-hfx-operational-nav-section]").forEach((section) => {
      const sectionItems = Array.from(section.querySelectorAll("[data-hfx-operational-nav-item]")).filter((candidate) => {
        return candidate.closest("[data-hfx-operational-workspace]") === workspace;
      });
      section.hidden = normalizedQuery.length > 0 && sectionItems.length > 0 && sectionItems.every((item) => item.hidden);
    });
  }

  function getCurrentWorkspaceTheme(workspace) {
    const preset = normalize(workspace.getAttribute("data-hfx-operational-preset")) || "standard";
    const palette = normalize(workspace.getAttribute("data-hfx-operational-palette")) || "default";
    return workspaceThemeStates.find((state) => state.preset === preset && state.palette === palette)
      || { preset, palette, label: formatThemeLabel(preset, palette) };
  }

  function cycleWorkspaceTheme(workspace) {
    const current = getCurrentWorkspaceTheme(workspace);
    const index = workspaceThemeStates.findIndex((state) => state.preset === current.preset && state.palette === current.palette);
    const next = workspaceThemeStates[(index + 1 + workspaceThemeStates.length) % workspaceThemeStates.length];
    applyWorkspaceTheme(workspace, next);
    return { preset: next.preset, palette: next.palette, label: next.label };
  }

  function applyWorkspaceTheme(workspace, state) {
    Object.values(workspacePresetClasses).forEach((className) => {
      if (className) {
        workspace.classList.remove(className);
      }
    });
    Object.values(workspacePaletteClasses).forEach((className) => {
      if (className) {
        workspace.classList.remove(className);
      }
    });

    const presetClass = workspacePresetClasses[state.preset];
    const paletteClass = workspacePaletteClasses[state.palette];
    if (presetClass) {
      workspace.classList.add(presetClass);
    }
    if (paletteClass) {
      workspace.classList.add(paletteClass);
    }

    workspace.setAttribute("data-hfx-operational-preset", state.preset);
    workspace.setAttribute("data-hfx-operational-palette", state.palette);
    workspace.setAttribute("data-hfx-operational-theme-label", state.label);
    updateThemeActions(workspace, state);

    workspace.dispatchEvent(new CustomEvent("hfx:operational-workspace-theme-change", {
      bubbles: true,
      detail: { preset: state.preset, palette: state.palette, label: state.label }
    }));
  }

  function updateThemeActions(workspace, state) {
    directWorkspaceItems(workspace, "[data-hfx-operational-nav-action='theme']").forEach((item) => {
      const label = item.querySelector(".hfx-operational-workspace__nav-label");
      if (!item.hasAttribute("data-hfx-operational-theme-base-label")) {
        item.setAttribute("data-hfx-operational-theme-base-label", (label?.textContent || item.textContent || "Theme").trim());
      }
      const base = item.getAttribute("data-hfx-operational-theme-base-label") || "Theme";
      const nextText = `${base}: ${state.label}`;
      if (label) {
        label.textContent = base;
        const meta = document.createElement("small");
        meta.className = "hfx-operational-workspace__nav-meta";
        meta.textContent = state.label;
        label.appendChild(meta);
      }
      item.setAttribute("aria-label", nextText);
      item.setAttribute("title", nextText);
    });
  }

  function formatThemeLabel(preset, palette) {
    const presetLabel = preset.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const paletteLabel = palette && palette !== "default"
      ? palette.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
      : "";
    return paletteLabel ? `${presetLabel} / ${paletteLabel}` : presetLabel;
  }

  function showWorkspacePage(workspace, target) {
    const normalizedTarget = normalize(target);
    if (!normalizedTarget) {
      return;
    }

    const pages = directWorkspaceItems(workspace, "[data-hfx-operational-page]");
    const activePage = pages.find((page) => normalize(page.getAttribute("data-hfx-operational-page")) === normalizedTarget);
    if (!activePage) {
      return;
    }

    pages.forEach((page) => {
      const active = normalize(page.getAttribute("data-hfx-operational-page")) === normalizedTarget;
      page.hidden = !active;
      page.classList.toggle("is-active", active);
      page.setAttribute("aria-hidden", active ? "false" : "true");
    });

    directWorkspaceItems(workspace, "[data-hfx-operational-nav-item][data-hfx-operational-nav-target]").forEach((candidate) => {
      const active = normalize(candidate.getAttribute("data-hfx-operational-nav-target")) === normalizedTarget;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-current", active ? "page" : "false");
    });

    workspace.dispatchEvent(new CustomEvent("hfx:operational-workspace-page-change", {
      bubbles: true,
      detail: { target: normalizedTarget, page: activePage }
    }));
  }

  function initAll(root) {
    const scope = root || document;
    if (scope.matches?.("[data-hfx-operational-list]")) {
      initOperationalList(scope);
    }
    if (scope.matches?.("[data-hfx-operational-workspace]")) {
      initOperationalWorkspace(scope);
    }
    scope.querySelectorAll?.("[data-hfx-operational-list]").forEach(initOperationalList);
    scope.querySelectorAll?.("[data-hfx-operational-workspace]").forEach(initOperationalWorkspace);
  }

  function refresh(target) {
    const scope = target || document;
    if (scope.matches?.("[data-hfx-operational-list]")) {
      applyListFilters(scope);
      return;
    }

    scope.querySelectorAll?.("[data-hfx-operational-list]").forEach(applyListFilters);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(document));
  } else {
    initAll(document);
  }

  window.HfxOperationalList = {
    init: initAll,
    refresh,
    showPage: showWorkspacePage,
    cycleTheme: cycleWorkspaceTheme
  };
})();
