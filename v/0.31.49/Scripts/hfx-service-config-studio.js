(function () {
  "use strict";

  const initializedStudios = new WeakSet();
  const initializedWorkbenches = new WeakSet();
  const initializedJsonPanels = new WeakSet();
  const initializedScrollableTabs = new WeakSet();
  const initializedLiveTables = new WeakSet();
  const jsonPanelState = new WeakMap();
  const configState = new WeakMap();

  function normalize(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function dispatch(target, name, detail, cancelable) {
    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable: Boolean(cancelable),
      detail
    });
    target.dispatchEvent(event);
    return event;
  }

  function closestStudio(element) {
    return element?.closest?.("[data-hfx-service-config-studio]") || null;
  }

  function initStudio(studio) {
    if (!studio || initializedStudios.has(studio)) {
      return;
    }

    initializedStudios.add(studio);

    studio.addEventListener("click", (event) => {
      const secretButton = event.target.closest("[data-hfx-service-config-secret-update]");
      if (secretButton && studio.contains(secretButton)) {
        handleSecretUpdateClick(studio, secretButton, event);
        return;
      }

      const repeaterButton = event.target.closest("[data-hfx-service-config-repeater-add],[data-hfx-service-config-repeater-duplicate],[data-hfx-service-config-repeater-remove]");
      if (repeaterButton && studio.contains(repeaterButton)) {
        handleRepeaterClick(studio, repeaterButton, event);
        return;
      }

      const formSubmit = event.target.closest("[data-hfx-service-config-form-submit]");
      if (formSubmit && studio.contains(formSubmit)) {
        handleFormSubmitClick(studio, formSubmit, event);
        return;
      }

      const action = event.target.closest("[data-hfx-service-config-action]");
      if (action && studio.contains(action)) {
        handleActionClick(studio, action, event);
        return;
      }

      const choice = event.target.closest("[data-hfx-service-config-choice]");
      if (choice && studio.contains(choice)) {
        handleChoiceClick(studio, choice, event);
        return;
      }

      const probe = event.target.closest("[data-hfx-service-config-probe]");
      if (probe && studio.contains(probe)) {
        handleProbeClick(studio, probe, event);
      }
    });

    studio.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-hfx-service-config-form]");
      if (form && studio.contains(form)) {
        handleFormSubmit(studio, form, event);
      }
    });

    studio.addEventListener("input", (event) => {
      const input = event.target.closest("[data-hfx-service-config-field-input]");
      if (input && studio.contains(input)) {
        handleFieldChange(studio, input);
      }
    });

    studio.addEventListener("change", (event) => {
      const input = event.target.closest("[data-hfx-service-config-field-input]");
      if (input && studio.contains(input)) {
        handleFieldChange(studio, input);
      }
    });

    refreshDependencies(studio);
    rememberConfig(studio);
    initChangeSummaries(studio);
    initScrollableTabNavs(studio);
    initLiveTables(studio);
    studio.querySelectorAll("[data-hfx-service-config-workbench]").forEach(initWorkbench);
  }

  function initWorkbench(workbench) {
    if (!workbench || initializedWorkbenches.has(workbench)) {
      return;
    }

    initializedWorkbenches.add(workbench);
    workbench.addEventListener("click", (event) => {
      const step = event.target.closest("[data-hfx-service-config-workbench-step]");
      if (step && workbench.contains(step)) {
        handleWorkbenchStepClick(closestStudio(workbench), step, event);
        return;
      }

      const action = event.target.closest("[data-hfx-service-config-workbench-action]");
      if (action && workbench.contains(action)) {
        handleWorkbenchActionClick(closestStudio(workbench), action, event);
      }
    });
    updateWorkbenchActions(workbench);
    initLiveTables(workbench);
  }

  function initLiveTables(studio) {
    studio.querySelectorAll("[data-hfx-service-config-live-table]").forEach((block) => {
      if (!block || initializedLiveTables.has(block)) {
        return;
      }

      initializedLiveTables.add(block);
      applyLiveTableCellLabels(block);
      const body = block.querySelector("tbody");
      if (body && typeof MutationObserver === "function") {
        const observer = new MutationObserver(() => applyLiveTableCellLabels(block));
        observer.observe(body, { childList: true, subtree: true });
      }
    });
  }

  function applyLiveTableCellLabels(block) {
    const table = block.querySelector(".hfx-service-config-live-table__table");
    if (!table) {
      return;
    }

    const labels = Array.from(table.querySelectorAll("thead th")).map((header) => (header.textContent || "").trim());
    if (labels.length === 0) {
      return;
    }

    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!cell || cell.tagName !== "TD") {
          return;
        }

        if (cell.hasAttribute("colspan")) {
          cell.removeAttribute("data-hfx-service-config-cell-label");
          return;
        }

        const label = labels[index] || "";
        if (label) {
          cell.setAttribute("data-hfx-service-config-cell-label", label);
        } else {
          cell.removeAttribute("data-hfx-service-config-cell-label");
        }
      });
    });
  }

  function initScrollableTabNavs(studio) {
    const navs = Array.from(studio.querySelectorAll(".nav.nav-underline, [data-hfx-tabs-id]"));
    navs.forEach((nav) => {
      if (!nav || initializedScrollableTabs.has(nav)) {
        return;
      }

      initializedScrollableTabs.add(nav);
      nav.setAttribute("data-hfx-scrollable-tabs", "1");
      let startX = 0;
      let startScroll = 0;
      let moved = false;
      let pointerActive = false;

      const hasOverflow = () => nav.scrollWidth > nav.clientWidth + 1;
      const finish = () => {
        pointerActive = false;
        nav.classList.remove("is-dragging");
        window.setTimeout(() => {
          moved = false;
        }, 0);
      };

      nav.addEventListener("wheel", (event) => {
        if (!hasOverflow()) {
          return;
        }

        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        const delta = horizontal ? event.deltaX : event.deltaY;
        if (delta === 0) {
          return;
        }

        nav.scrollLeft += delta;
        event.preventDefault();
      }, { passive: false });

      nav.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !hasOverflow()) {
          return;
        }

        pointerActive = true;
        moved = false;
        startX = event.clientX;
        startScroll = nav.scrollLeft;
        nav.classList.add("is-dragging");
        if (typeof nav.setPointerCapture === "function") {
          nav.setPointerCapture(event.pointerId);
        }
      });

      nav.addEventListener("pointermove", (event) => {
        if (!pointerActive) {
          return;
        }

        const delta = event.clientX - startX;
        if (Math.abs(delta) > 4) {
          moved = true;
        }

        nav.scrollLeft = startScroll - delta;
      });

      nav.addEventListener("pointerup", finish);
      nav.addEventListener("pointercancel", finish);
      nav.addEventListener("click", (event) => {
        if (!moved) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      }, true);
    });
  }

  function handleWorkbenchStepClick(studio, step, event) {
    const workbench = step.closest("[data-hfx-service-config-workbench]");
    if (!workbench || isDisabled(step)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setWorkbenchStep(studio, workbench, step.getAttribute("data-hfx-service-config-workbench-step"), "step");
  }

  function handleWorkbenchActionClick(studio, button, event) {
    const workbench = button.closest("[data-hfx-service-config-workbench]");
    if (!workbench || isDisabled(button)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const action = normalize(button.getAttribute("data-hfx-service-config-workbench-action"));
    if (action === "previous" || action === "back") {
      moveWorkbenchStep(studio, workbench, -1);
      return;
    }

    if (action === "next" || action === "continue") {
      moveWorkbenchStep(studio, workbench, 1);
      return;
    }

    dispatch(workbench, "hfx:service-config-workbench-action", {
      studio,
      workbench,
      button,
      action
    }, true);
  }

  function updateWorkbenchActions(workbench) {
    const steps = Array.from(workbench.querySelectorAll("[data-hfx-service-config-workbench-step]"));
    if (steps.length === 0) {
      return;
    }

    const active = normalize(workbench.getAttribute("data-hfx-service-config-workbench-active"));
    const index = Math.max(0, steps.findIndex(step => normalize(step.getAttribute("data-hfx-service-config-workbench-step")) === active));
    workbench.querySelectorAll("[data-hfx-service-config-workbench-action]").forEach(button => {
      const action = normalize(button.getAttribute("data-hfx-service-config-workbench-action"));
      if (action === "previous" || action === "back") {
        setWorkbenchActionDisabled(button, index <= 0);
      } else if (action === "next" || action === "continue") {
        setWorkbenchActionDisabled(button, index >= steps.length - 1);
      }
    });
  }

  function setWorkbenchActionDisabled(button, disabled) {
    if (disabled) {
      button.setAttribute("disabled", "disabled");
      button.setAttribute("aria-disabled", "true");
      button.disabled = true;
    } else {
      button.removeAttribute("disabled");
      button.setAttribute("aria-disabled", "false");
      button.disabled = false;
    }
  }

  function moveWorkbenchStep(studio, workbench, direction) {
    const steps = Array.from(workbench.querySelectorAll("[data-hfx-service-config-workbench-step]"));
    if (steps.length === 0) {
      return;
    }

    const active = normalize(workbench.getAttribute("data-hfx-service-config-workbench-active"));
    const index = Math.max(0, steps.findIndex(step => normalize(step.getAttribute("data-hfx-service-config-workbench-step")) === active));
    const next = Math.max(0, Math.min(steps.length - 1, index + direction));
    setWorkbenchStep(studio, workbench, steps[next].getAttribute("data-hfx-service-config-workbench-step"), direction < 0 ? "previous" : "next");
  }

  function setWorkbenchStep(studio, workbench, key, source) {
    const normalizedKey = normalize(key);
    if (!normalizedKey) {
      return;
    }

    workbench.setAttribute("data-hfx-service-config-workbench-active", normalizedKey);
    workbench.querySelectorAll("[data-hfx-service-config-workbench-step]").forEach(step => {
      const selected = normalize(step.getAttribute("data-hfx-service-config-workbench-step")) === normalizedKey;
      step.classList.toggle("is-active", selected);
      step.setAttribute("aria-selected", selected ? "true" : "false");
    });
    workbench.querySelectorAll("[data-hfx-service-config-workbench-panel]").forEach(panel => {
      const selected = normalize(panel.getAttribute("data-hfx-service-config-workbench-panel")) === normalizedKey;
      panel.classList.toggle("is-active", selected);
      panel.setAttribute("data-hfx-service-config-workbench-panel-active", selected ? "true" : "false");
      if (selected) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "hidden");
      }
    });
    updateWorkbenchActions(workbench);
    dispatch(workbench, "hfx:service-config-workbench-step-change", {
      studio,
      workbench,
      step: normalizedKey,
      source
    });
  }

  function initJsonPanel(panel) {
    if (!panel || initializedJsonPanels.has(panel)) {
      return;
    }

    initializedJsonPanels.add(panel);
    rememberJson(panel);

    const editor = getJsonEditor(panel);
    if (editor) {
      editor.addEventListener("input", () => {
        jsonPanelState.set(panel, getJson(panel));
        markDirty(closestStudio(panel), panel);
        dispatch(panel, "hfx:service-config-json-change", jsonDetail(panel));
      });
    }
  }

  function handleActionClick(studio, action, event) {
    const actionName = normalize(action.getAttribute("data-hfx-service-config-action"));
    const panel = action.closest("[data-hfx-service-config-json]");
    const panels = panel ? [panel] : Array.from(studio.querySelectorAll("[data-hfx-service-config-json]"));
    const detail = {
      action: actionName,
      label: (action.textContent || "").trim(),
      button: action,
      studio,
      panel,
      panels,
      config: collectConfig(studio)
    };

    dispatch(studio, "hfx:service-config-action", detail, true);

    if (actionName === "apply" || actionName === "apply-changes") {
      if (!validateConfig(studio).valid) {
        return;
      }

      const applyRequest = dispatch(studio, "hfx:service-config-apply-request", detail, true);
      if (applyRequest.defaultPrevented) {
        return;
      }
    }

    if (actionName === "export" || actionName === "export-json") {
      panels.forEach(exportJson);
      return;
    }

    if (actionName === "load" || actionName === "reload" || actionName === "read-json" || actionName === "restore") {
      if (actionName === "restore") {
        resetConfig(studio);
        return;
      }

      runStudioOperation(studio, loadConfig);
      panels.forEach((targetPanel) => runPanelOperation(targetPanel, loadJson));
      return;
    }

    if (actionName === "save" || actionName === "save-json" || actionName === "apply" || actionName === "apply-changes") {
      if (!validateConfig(studio).valid) {
        return;
      }

      runStudioOperation(studio, saveConfig);
      panels.forEach((targetPanel) => runPanelOperation(targetPanel, saveJson));
    }
  }

  function runStudioOperation(studio, operation) {
    operation(studio).catch((error) => {
      dispatch(studio, "hfx:service-config-error", {
        studio,
        error
      });
    });
  }

  function runPanelOperation(panel, operation) {
    operation(panel).catch((error) => {
      dispatch(panel, "hfx:service-config-json-error", {
        panel,
        studio: closestStudio(panel),
        error
      });
    });
  }

  function handleFormSubmitClick(studio, button, event) {
    event.preventDefault();
    const form = button.closest("[data-hfx-service-config-form]");
    handleFormSubmit(studio, form, event);
  }

  function handleFormSubmit(studio, form, event) {
    event.preventDefault();
    const paths = parseSubmitPaths(form?.getAttribute("data-hfx-service-config-form-submit-paths"));
    const validationScope = paths.length > 0 ? studio : form;
    if (!form || !validateConfig(validationScope, paths).valid) {
      return;
    }

    runStudioOperation(studio, () => saveFormConfig(studio, form));
  }

  function handleChoiceClick(studio, choice, event) {
    if (isDisabled(choice)) {
      event.preventDefault();
      return;
    }

    const group = choice.closest("[data-hfx-service-config-choices]");
    group?.querySelectorAll("[data-hfx-service-config-choice]").forEach((candidate) => {
      const active = candidate === choice;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("data-hfx-service-config-choice-active", active ? "true" : "false");
      candidate.setAttribute("aria-pressed", active ? "true" : "false");
    });

    dispatch(studio, "hfx:service-config-choice-change", {
      studio,
      group,
      key: choice.getAttribute("data-hfx-service-config-choice"),
      option: choice
    });
    markDirty(studio, choice);
  }

  function handleProbeClick(studio, probe, event) {
    if (isDisabled(probe)) {
      event.preventDefault();
      return;
    }

    const group = probe.closest("[data-hfx-service-config-probes]");
    group?.querySelectorAll("[data-hfx-service-config-probe]").forEach((candidate) => {
      const active = candidate === probe;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("data-hfx-service-config-probe-active", active ? "true" : "false");
    });

    dispatch(studio, "hfx:service-config-probe-select", {
      studio,
      group,
      key: probe.getAttribute("data-hfx-service-config-probe"),
      state: probe.getAttribute("data-hfx-service-config-probe-state"),
      probe
    });
    markDirty(studio, probe);
  }

  function handleFieldChange(studio, input) {
    markDirty(studio, input);
    refreshDependencies(studio);
    validateField(input);

    const field = input.closest("[data-hfx-service-config-field]");
    const detail = {
      studio,
      field,
      input,
      key: field?.getAttribute("data-hfx-service-config-field"),
      path: field?.getAttribute("data-hfx-service-config-field-path") || input.getAttribute("name"),
      type: field?.getAttribute("data-hfx-service-config-field-type"),
      value: readInputValue(input),
      config: collectConfig(studio)
    };

    dispatch(studio, "hfx:service-config-field-change", detail);
  }

  function handleSecretUpdateClick(studio, button, event) {
    event.preventDefault();
    const field = button.closest("[data-hfx-service-config-field]");
    dispatch(studio, "hfx:service-config-secret-update-request", {
      studio,
      field,
      button,
      key: field?.getAttribute("data-hfx-service-config-field"),
      path: field?.getAttribute("data-hfx-service-config-field-path"),
      currentReference: field?.querySelector("[data-hfx-service-config-field-input]")?.value || ""
    }, true);
  }

  function handleRepeaterClick(studio, button, event) {
    const repeater = button.closest("[data-hfx-service-config-repeater]");
    const item = button.closest("[data-hfx-service-config-repeater-item]");
    if (!repeater) {
      return;
    }

    event.preventDefault();

    if (button.matches("[data-hfx-service-config-repeater-remove]")) {
      const removedKey = item?.getAttribute("data-hfx-service-config-repeater-item");
      removeRepeaterItem(repeater, item);
      updateRepeaterItemPaths(repeater);
      markDirty(studio, repeater);
      dispatch(studio, "hfx:service-config-repeater-remove", {
        studio,
        repeater,
        item,
        key: removedKey,
        path: repeater.getAttribute("data-hfx-service-config-repeater-path"),
        config: collectConfig(studio)
      });
      return;
    }

    const list = repeater.querySelector(".hfx-service-config-repeater__items");
    const source = button.matches("[data-hfx-service-config-repeater-duplicate]")
      ? item
      : getRepeaterTemplate(repeater) || getRepeaterItems(repeater)[0];
    const clone = source?.cloneNode(true);
    if (clone && list) {
      const key = `${source.getAttribute("data-hfx-service-config-repeater-item") || "item"}-${Date.now()}`;
      clone.setAttribute("data-hfx-service-config-repeater-item", key);
      setRepeaterTemplateState(clone, false);
      if (button.matches("[data-hfx-service-config-repeater-add]")) {
        clearRepeaterItem(clone);
        list.appendChild(clone);
      } else {
        source.insertAdjacentElement("afterend", clone);
      }
      updateRepeaterItemPaths(repeater);
      refreshDependencies(studio);
    }

    markDirty(studio, repeater);
    dispatch(studio, button.matches("[data-hfx-service-config-repeater-duplicate]") ? "hfx:service-config-repeater-duplicate" : "hfx:service-config-repeater-add", {
      studio,
      repeater,
      source,
      item: clone,
      path: repeater.getAttribute("data-hfx-service-config-repeater-path"),
      config: collectConfig(studio)
    });
  }

  function isDisabled(element) {
    return element.getAttribute("aria-disabled") === "true"
      || element.getAttribute("disabled") === "disabled"
      || element.getAttribute("data-hfx-service-config-choice-disabled") === "true"
      || element.getAttribute("data-hfx-service-config-probe-state") === "disabled";
  }

  function getJsonEditor(panel) {
    return panel?.querySelector?.("[data-hfx-service-config-json-editor]") || null;
  }

  function getJsonPreview(panel) {
    return panel?.querySelector?.(".hfx-service-config-json__preview code") || null;
  }

  function getJson(panel) {
    const editor = getJsonEditor(panel);
    if (editor) {
      return editor.value || "";
    }

    const preview = getJsonPreview(panel);
    return preview ? preview.textContent || "" : jsonPanelState.get(panel) || "";
  }

  function setJson(panel, value, options) {
    const json = value == null ? "" : value.toString();
    const editor = getJsonEditor(panel);
    const preview = getJsonPreview(panel);
    if (editor) {
      editor.value = json;
    } else if (preview) {
      preview.textContent = json;
    }

    jsonPanelState.set(panel, json);
    if (options?.dirty !== false) {
      markDirty(closestStudio(panel), panel);
    }
    dispatch(panel, "hfx:service-config-json-change", jsonDetail(panel));
  }

  function rememberJson(panel) {
    jsonPanelState.set(panel, getJson(panel));
  }

  function jsonDetail(panel) {
    return {
      panel,
      studio: closestStudio(panel),
      path: panel.getAttribute("data-hfx-service-config-json-path"),
      schema: panel.getAttribute("data-hfx-service-config-json-schema"),
      json: getJson(panel)
    };
  }

  async function loadJson(panel) {
    const detail = jsonDetail(panel);
    const request = dispatch(panel, "hfx:service-config-json-load-request", detail, true);
    if (request.defaultPrevented) {
      return null;
    }

    const url = panel.getAttribute("data-hfx-service-config-json-load-url");
    if (!url) {
      return null;
    }

    const response = await fetch(url, { headers: { "Accept": "application/json, text/plain" } });
    if (!response.ok) {
      throw new Error(`Service config load failed with HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const json = contentType.includes("application/json")
      ? JSON.stringify(await response.json(), null, 2)
      : await response.text();
    setJson(panel, json, { dirty: false });
    rememberJson(panel);
    dispatch(panel, "hfx:service-config-json-load", jsonDetail(panel));
    return json;
  }

  async function saveJson(panel) {
    const detail = jsonDetail(panel);
    const request = dispatch(panel, "hfx:service-config-json-save-request", detail, true);
    if (request.defaultPrevented) {
      return null;
    }

    const url = panel.getAttribute("data-hfx-service-config-json-save-url");
    if (!url) {
      return null;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: detail.path,
        schema: detail.schema,
        json: detail.json
      })
    });

    if (!response.ok) {
      throw new Error(`Service config save failed with HTTP ${response.status}`);
    }

    dispatch(panel, "hfx:service-config-json-save", jsonDetail(panel));
    const studio = closestStudio(panel);
    if (studio) {
      studio.setAttribute("data-hfx-service-config-dirty", "false");
      studio.classList.remove("is-dirty");
      rememberConfig(studio);
    }
    return response;
  }

  async function loadConfig(studio) {
    const detail = { studio, config: collectConfig(studio) };
    const request = dispatch(studio, "hfx:service-config-load-request", detail, true);
    if (request.defaultPrevented) {
      return null;
    }

    const url = studio.getAttribute("data-hfx-service-config-load-url");
    if (!url) {
      return null;
    }

    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) {
      throw new Error(`Service config load failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    applyConfigPayload(studio, payload);
    studio.setAttribute("data-hfx-service-config-dirty", "false");
    studio.classList.remove("is-dirty");
    rememberConfig(studio);
    dispatch(studio, "hfx:service-config-load", { studio, payload, config: collectConfig(studio) });
    return payload;
  }

  async function saveConfig(studio) {
    const detail = { studio, config: collectConfig(studio) };
    const request = dispatch(studio, "hfx:service-config-save-request", detail, true);
    if (request.defaultPrevented) {
      return null;
    }

    const url = studio.getAttribute("data-hfx-service-config-save-url");
    if (!url) {
      return null;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(detail.config)
    });

    if (!response.ok) {
      throw new Error(`Service config save failed with HTTP ${response.status}`);
    }

    studio.setAttribute("data-hfx-service-config-dirty", "false");
    studio.classList.remove("is-dirty");
    rememberConfig(studio);
    dispatch(studio, "hfx:service-config-save", { studio, response, config: collectConfig(studio) });
    return response;
  }

  async function saveFormConfig(studio, form) {
    const config = collectConfig(studio);
    const formConfig = collectConfig(form);
    const paths = parseSubmitPaths(form.getAttribute("data-hfx-service-config-form-submit-paths"));
    const payload = buildSubmitPayloadFromSources(formConfig, config, paths);
    const detail = {
      studio,
      form,
      method: form.getAttribute("data-hfx-service-config-form-submit-method") || "POST",
      url: form.getAttribute("data-hfx-service-config-form-submit-url") || "",
      paths,
      payload,
      formConfig,
      config
    };
    if (!detail.url) {
      return null;
    }

    const request = dispatch(studio, "hfx:service-config-form-save-request", detail, true);
    if (request.defaultPrevented) {
      return null;
    }

    const response = await fetch(
      buildSubmitRequestUrl(detail.url, detail.method, detail.payload),
      buildSubmitRequestOptions(detail.method, detail.payload));
    const responsePayload = await readSubmitResponsePayload(response);
    renderFormResult(form, response.ok, response.status, responsePayload);

    if (!response.ok) {
      dispatch(studio, "hfx:service-config-form-save-error", {
        studio,
        form,
        response,
        responsePayload,
        paths: detail.paths,
        payload: detail.payload,
        config: collectConfig(studio)
      });
      return response;
    }

    const commitPaths = buildSubmitCommitPaths(detail.paths, formConfig);
    commitConfigPaths(studio, commitPaths, "form.save");
    dispatch(studio, "hfx:service-config-form-save", {
      studio,
      form,
      response,
      responsePayload,
      paths: detail.paths,
      commitPaths,
      payload: detail.payload,
      config: collectConfig(studio)
    });
    return response;
  }

  function applyConfigPayload(studio, payload) {
    const dataFields = flattenConfigObject(payload?.data || payload?.object || payload?.config?.data || payload?.config?.object || {});
    const explicitFields = payload?.fields || payload?.config?.fields || {};
    const fields = { ...dataFields, ...explicitFields };
    syncRepeatersForPayload(studio, payload, fields);
    Object.entries(fields).forEach(([path, value]) => {
      const input = findFieldInput(studio, path);
      if (!input) {
        return;
      }

      setInputValue(input, value);
    });

    refreshDependencies(studio);

    (payload?.jsonPanels || payload?.config?.jsonPanels || []).forEach((panelPayload) => {
      const path = panelPayload.path || "";
      const panel = Array.from(studio.querySelectorAll("[data-hfx-service-config-json]"))
        .find((candidate) => candidate.getAttribute("data-hfx-service-config-json-path") === path);
      if (panel && panelPayload.json != null) {
        setJson(panel, panelPayload.json, { dirty: false });
        rememberJson(panel);
      }
    });
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }

    return value.replace(/["\\]/g, "\\$&");
  }

  function findFieldInput(studio, path) {
    return Array.from(studio.querySelectorAll(`[name="${cssEscape(path)}"]`))
      .find((input) => !isRepeaterTemplateElement(input)) || null;
  }

  function exportJson(panel) {
    const detail = jsonDetail(panel);
    const request = dispatch(panel, "hfx:service-config-json-export-request", detail, true);
    if (request.defaultPrevented || !detail.json) {
      return;
    }

    const blob = new Blob([detail.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const path = detail.path || "service-config.json";
    link.href = url;
    link.download = path.split(/[\\/]/).pop() || "service-config.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    dispatch(panel, "hfx:service-config-json-export", detail);
  }

  function setCheckState(check, state) {
    if (!check) {
      return;
    }

    const normalized = normalize(state) || "success";
    ["success", "warning", "error", "info", "disabled"].forEach((candidate) => {
      check.classList.remove(`hfx-service-config-checklist__item--${candidate}`);
    });
    check.classList.add(`hfx-service-config-checklist__item--${normalized}`);
    check.setAttribute("data-hfx-service-config-check-state", normalized);
    dispatch(check, "hfx:service-config-check-state-change", {
      check,
      state: normalized,
      key: check.getAttribute("data-hfx-service-config-check")
    });
  }

  function initChangeSummaries(studio) {
    const summaries = Array.from(studio.querySelectorAll("[data-hfx-service-config-change-summary]"));
    if (summaries.length === 0) {
      return;
    }

    const render = () => renderChangeSummaries(studio);
    [
      "hfx:service-config-field-change",
      "hfx:service-config-repeater-add",
      "hfx:service-config-repeater-duplicate",
      "hfx:service-config-repeater-remove",
      "hfx:service-config-json-change",
      "hfx:service-config-json-save",
      "hfx:service-config-load",
      "hfx:service-config-save",
      "hfx:service-config-set",
      "hfx:service-config-reset",
      "hfx:service-config-commit"
    ].forEach((name) => studio.addEventListener(name, render));
    render();
  }

  function renderChangeSummaries(studio) {
    const changes = collectConfig(studio).changes || {};
    studio.querySelectorAll("[data-hfx-service-config-change-summary]").forEach((summary) => {
      renderChangeSummary(summary, changes);
    });
  }

  function renderChangeSummary(summary, changes) {
    const counts = changes.counts || {};
    setChangeSummaryMetric(summary, "fields", counts.fields || 0);
    setChangeSummaryMetric(summary, "repeaters", counts.repeaters || 0);
    setChangeSummaryMetric(summary, "json", counts.jsonPanels || 0);

    const items = collectChangeSummaryItems(changes);
    const list = summary.querySelector("[data-hfx-service-config-change-summary-list]");
    const emptyText = summary.getAttribute("data-hfx-service-config-change-summary-empty") || "No pending changes.";
    const maxItems = Math.max(1, Number(summary.getAttribute("data-hfx-service-config-change-summary-max") || "8"));

    summary.classList.toggle("is-empty", items.length === 0);
    summary.setAttribute("data-hfx-service-config-change-summary-count", items.length.toString());

    if (!list) {
      return;
    }

    list.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "hfx-service-config-change-summary__empty";
      empty.textContent = emptyText;
      list.appendChild(empty);
      return;
    }

    items.slice(0, maxItems).forEach((item) => {
      list.appendChild(renderChangeSummaryItem(item));
    });

    if (items.length > maxItems) {
      const more = document.createElement("li");
      more.className = "hfx-service-config-change-summary__more";
      more.textContent = `${items.length - maxItems} more changes`;
      list.appendChild(more);
    }
  }

  function setChangeSummaryMetric(summary, key, value) {
    const metric = summary.querySelector(`[data-hfx-service-config-change-summary-metric="${key}"] strong`);
    if (metric) {
      metric.textContent = value.toString();
    }
  }

  function collectChangeSummaryItems(changes) {
    const items = [];
    (changes.fields || []).forEach((change) => {
      items.push({
        group: "Field",
        type: change.type,
        path: change.path,
        detail: formatChangeTransition(change.before, change.after)
      });
    });
    (changes.repeaters || []).forEach((change) => {
      items.push({
        group: "Array",
        type: change.type === "count" ? "row count" : change.type,
        path: change.path,
        detail: `${change.before || 0} to ${change.after || 0} rows`
      });
    });
    (changes.jsonPanels || []).forEach((change) => {
      items.push({
        group: "JSON",
        type: change.type,
        path: change.path || change.schema || "json panel",
        detail: change.schema || "artifact text changed"
      });
    });
    return items;
  }

  function renderChangeSummaryItem(change) {
    const item = document.createElement("li");
    item.className = "hfx-service-config-change-summary__item";
    item.setAttribute("data-hfx-service-config-change-type", change.type || "modified");

    const type = document.createElement("span");
    type.className = "hfx-service-config-change-summary__type";
    type.textContent = `${change.group} ${change.type || "modified"}`;

    const path = document.createElement("code");
    path.className = "hfx-service-config-change-summary__path";
    path.textContent = change.path || "configuration";
    path.setAttribute("title", change.path || "configuration");

    const detail = document.createElement("span");
    detail.className = "hfx-service-config-change-summary__detail";
    detail.textContent = change.detail || "";
    detail.setAttribute("title", change.detail || "");

    item.append(type, path, detail);
    return item;
  }

  function formatChangeTransition(before, after) {
    if (before === undefined) {
      return `set to ${formatChangeValue(after)}`;
    }

    if (after === undefined) {
      return `removed ${formatChangeValue(before)}`;
    }

    return `${formatChangeValue(before)} to ${formatChangeValue(after)}`;
  }

  function formatChangeValue(value) {
    if (Array.isArray(value)) {
      return value.length === 0 ? "[]" : value.map(formatChangeValue).join(", ");
    }

    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }

    if (value === "") {
      return "(empty)";
    }

    if (value == null) {
      return "(none)";
    }

    return value.toString();
  }

  function validateConfig(studio, paths) {
    const roots = Array.isArray(paths) ? paths : [];
    const invalid = Array.from(studio.querySelectorAll("[data-hfx-service-config-field-input]"))
      .filter((input) => !isRepeaterTemplateElement(input))
      .filter((input) => roots.length === 0 || inputMatchesRoots(input, roots))
      .filter((input) => !validateField(input));
    const detail = {
      studio,
      valid: invalid.length === 0,
      invalid,
      paths: roots,
      config: collectConfig(studio)
    };
    dispatch(studio, "hfx:service-config-validation", detail);
    return detail;
  }

  function buildSubmitRequestUrl(url, method, payload) {
    if (!usesQueryPayload(method)) {
      return url;
    }

    const parsed = new URL(url, window.location.href);
    appendQueryPayload(parsed.searchParams, "", payload);
    return parsed.toString();
  }

  function buildSubmitRequestOptions(method, payload) {
    const normalizedMethod = normalizeHttpMethod(method);
    const headers = {
      "Accept": "application/json, text/plain"
    };
    const options = {
      method: normalizedMethod,
      headers
    };
    if (!usesQueryPayload(normalizedMethod)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    return options;
  }

  async function readSubmitResponsePayload(response) {
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    return contentType.includes("application/json") && body.trim().length > 0
      ? JSON.parse(body)
      : body;
  }

  function renderFormResult(form, success, status, payload) {
    let result = form.querySelector(":scope > [data-hfx-service-config-form-result]");
    if (!result) {
      result = document.createElement("div");
      result.className = "hfx-service-config-form__result";
      result.setAttribute("data-hfx-service-config-form-result", "1");
      result.setAttribute("role", "status");
      form.querySelector(":scope > .hfx-service-config-form__header")?.after(result);
    }

    const title = success ? "Completed" : "Needs attention";
    const message = extractSubmitResponseMessage(payload) || (success ? "Request completed." : `Request needs attention (${status}).`);
    result.classList.toggle("is-success", success);
    result.classList.toggle("is-error", !success);
    result.replaceChildren(Object.assign(document.createElement("strong"), { textContent: title }), Object.assign(document.createElement("span"), { textContent: message }));
  }

  function extractSubmitResponseMessage(payload) {
    if (typeof payload === "string") {
      return payload.trim();
    }

    return payload?.message || payload?.title || payload?.detail || payload?.error || "";
  }

  function usesQueryPayload(method) {
    const normalizedMethod = normalizeHttpMethod(method);
    return normalizedMethod === "GET" || normalizedMethod === "HEAD";
  }

  function normalizeHttpMethod(method) {
    return String(method || "POST").trim().toUpperCase();
  }

  function appendQueryPayload(params, prefix, value) {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => appendQueryPayload(params, prefix, item));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => {
        const childPrefix = prefix ? `${prefix}.${key}` : key;
        appendQueryPayload(params, childPrefix, child);
      });
      return;
    }
    if (prefix) {
      params.append(prefix, String(value));
    }
  }

  function inputMatchesRoots(input, roots) {
    const field = input.closest("[data-hfx-service-config-field]");
    const path = field?.getAttribute("data-hfx-service-config-field-path") || input.getAttribute("name") || "";
    return roots.some((root) => pathMatchesRoot(path, root));
  }

  function validateField(input) {
    if (!input || input.disabled || isRepeaterTemplateElement(input)) {
      return true;
    }

    const field = input.closest("[data-hfx-service-config-field]");
    const valid = typeof input.checkValidity === "function" ? input.checkValidity() : true;
    field?.classList.toggle("is-invalid", !valid);
    field?.setAttribute("data-hfx-service-config-field-valid", valid ? "true" : "false");
    return valid;
  }

  function markDirty(studio, source) {
    if (!studio) {
      return;
    }

    const wasDirty = studio.getAttribute("data-hfx-service-config-dirty") === "true";
    studio.setAttribute("data-hfx-service-config-dirty", "true");
    studio.classList.add("is-dirty");
    if (!wasDirty) {
      dispatch(studio, "hfx:service-config-dirty-change", {
        studio,
        dirty: true,
        source
      });
    }
  }

  function readInputValue(input) {
    if (!input) {
      return null;
    }

    if (input.type === "checkbox") {
      return input.checked;
    }

    const field = input.closest("[data-hfx-service-config-field]");
    if (field?.getAttribute("data-hfx-service-config-value-mode") === "lines") {
      return (input.value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    if (input.tagName === "SELECT" && input.multiple) {
      return Array.from(input.selectedOptions).map((option) => option.value);
    }

    return input.value;
  }

  function setInputValue(input, value) {
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
      return;
    }

    if (input.tagName === "SELECT" && input.multiple) {
      const selectedValues = Array.isArray(value)
        ? value.map((item) => item == null ? "" : item.toString())
        : (value == null || value === "" ? [] : value.toString().split(",").map((item) => item.trim()));
      Array.from(input.options).forEach((option) => {
        option.selected = selectedValues.includes(option.value);
      });
      return;
    }

    const field = input.closest("[data-hfx-service-config-field]");
    if (field?.getAttribute("data-hfx-service-config-value-mode") === "lines" && Array.isArray(value)) {
      input.value = value.map((item) => item == null ? "" : item.toString()).filter((item) => item.length > 0).join("\n");
      return;
    }

    input.value = value == null ? "" : value;
  }

  function clearRepeaterItem(item) {
    item.querySelectorAll("[data-hfx-service-config-field-input]").forEach((input) => {
      if (input.type === "checkbox") {
        input.checked = false;
      } else if (input.tagName === "SELECT" && input.multiple) {
        Array.from(input.options).forEach((option) => {
          option.selected = false;
        });
      } else if (input.tagName === "SELECT") {
        input.selectedIndex = 0;
      } else {
        input.value = "";
      }
    });
  }

  function getRepeaterItems(repeater, options) {
    const list = repeater?.querySelector?.(".hfx-service-config-repeater__items");
    const items = Array.from(list?.children || [])
      .filter((child) => child.matches?.("[data-hfx-service-config-repeater-item]"));
    return options?.includeTemplates
      ? items
      : items.filter((item) => item.getAttribute("data-hfx-service-config-repeater-template") !== "true");
  }

  function getRepeaterTemplate(repeater) {
    return getRepeaterItems(repeater, { includeTemplates: true })
      .find((item) => item.getAttribute("data-hfx-service-config-repeater-template") === "true") || null;
  }

  function setRepeaterTemplateState(item, template) {
    if (!item) {
      return;
    }

    if (template) {
      item.setAttribute("data-hfx-service-config-repeater-template", "true");
      item.setAttribute("hidden", "hidden");
      item.setAttribute("aria-hidden", "true");
      item.querySelectorAll("[data-hfx-service-config-field-input]").forEach((input) => {
        input.disabled = true;
      });
    } else {
      item.removeAttribute("data-hfx-service-config-repeater-template");
      item.removeAttribute("hidden");
      item.removeAttribute("aria-hidden");
    }
  }

  function removeRepeaterItem(repeater, item) {
    if (!item) {
      return;
    }

    const activeItems = getRepeaterItems(repeater);
    if (activeItems.length <= 1) {
      clearRepeaterItem(item);
      setRepeaterTemplateState(item, true);
      return;
    }

    item.remove();
  }

  function syncRepeatersForPayload(studio, payload, fields) {
    const data = payload?.data || payload?.object || payload?.config?.data || payload?.config?.object;
    studio.querySelectorAll("[data-hfx-service-config-repeater]").forEach((repeater) => {
      const path = repeater.getAttribute("data-hfx-service-config-repeater-path");
      if (!path) {
        return;
      }

      const nestedValue = readConfigPath(data, path);
      if (Array.isArray(nestedValue)) {
        syncRepeaterItemCount(repeater, nestedValue.length);
        return;
      }

      const pattern = new RegExp(`^${escapeRegExp(path)}\\[(\\d+)\\](?:\\.|$)`);
      let maxIndex = -1;
      Object.keys(fields || {}).forEach((fieldPath) => {
        const match = pattern.exec(fieldPath);
        if (match) {
          maxIndex = Math.max(maxIndex, Number(match[1]));
        }
      });
      if (maxIndex >= 0) {
        syncRepeaterItemCount(repeater, maxIndex + 1);
      }
    });
  }

  function syncRepeaterItemCount(repeater, count) {
    if (!repeater || count == null || count < 0) {
      return;
    }

    const list = repeater.querySelector(".hfx-service-config-repeater__items");
    if (!list) {
      return;
    }

    let activeItems = getRepeaterItems(repeater);
    let template = getRepeaterTemplate(repeater);
    if (!template && activeItems.length > 0) {
      template = activeItems[0].cloneNode(true);
      clearRepeaterItem(template);
      setRepeaterTemplateState(template, true);
      list.insertBefore(template, list.firstChild);
    }

    if (count === 0) {
      activeItems.forEach((item) => item.remove());
      if (template) {
        clearRepeaterItem(template);
        setRepeaterTemplateState(template, true);
      }
      updateRepeaterItemPaths(repeater);
      return;
    }

    if (!template && activeItems.length === 0) {
      return;
    }

    while (activeItems.length < count) {
      const source = activeItems[activeItems.length - 1] || template;
      const clone = source.cloneNode(true);
      clone.setAttribute("data-hfx-service-config-repeater-item", `${source.getAttribute("data-hfx-service-config-repeater-item") || "item"}-${Date.now()}-${activeItems.length}`);
      clearRepeaterItem(clone);
      setRepeaterTemplateState(clone, false);
      list.appendChild(clone);
      activeItems = getRepeaterItems(repeater);
    }

    while (activeItems.length > count) {
      activeItems[activeItems.length - 1].remove();
      activeItems = getRepeaterItems(repeater);
    }

    updateRepeaterItemPaths(repeater);
  }

  function updateRepeaterItemPaths(repeater) {
    const repeaterPath = repeater.getAttribute("data-hfx-service-config-repeater-path");
    if (!repeaterPath) {
      return;
    }

    getRepeaterItems(repeater).forEach((item, index) => {
      item.setAttribute("data-hfx-service-config-repeater-index", index.toString());
      item.querySelectorAll("[data-hfx-service-config-form]").forEach((form) => {
        const currentPath = form.getAttribute("data-hfx-service-config-form-path") || "";
        const nextPath = currentPath.includes("[")
          ? currentPath.replace(/\[\d+\]/, `[${index}]`)
          : `${repeaterPath}[${index}]`;
        form.setAttribute("data-hfx-service-config-form-path", nextPath);
        form.querySelectorAll("[data-hfx-service-config-field]").forEach((field) => {
          const oldPath = field.getAttribute("data-hfx-service-config-field-path") || "";
          const segment = currentPath && oldPath.startsWith(`${currentPath}.`)
            ? oldPath.slice(currentPath.length + 1)
            : oldPath.split(".").pop() || field.getAttribute("data-hfx-service-config-field") || "value";
          const nextFieldPath = `${nextPath}.${segment}`;
          const dependsOn = field.getAttribute("data-hfx-service-config-depends-on");
          if (dependsOn) {
            field.setAttribute("data-hfx-service-config-depends-on", updatePathReference(dependsOn, currentPath, nextPath));
          }

          field.setAttribute("data-hfx-service-config-field-path", nextFieldPath);
          field.querySelectorAll("[data-hfx-service-config-field-input]").forEach((input) => {
            input.setAttribute("name", nextFieldPath);
          });
          updateComboBoxListId(field, index);
        });
      });
    });
  }

  function updatePathReference(path, currentBase, nextBase) {
    if (!path || !currentBase || !nextBase) {
      return path;
    }

    if (path === currentBase) {
      return nextBase;
    }

    return path.startsWith(`${currentBase}.`) ? `${nextBase}${path.slice(currentBase.length)}` : path;
  }

  function updateComboBoxListId(field, index) {
    if (field.getAttribute("data-hfx-service-config-field-type") !== "combo-box") {
      return;
    }

    const input = field.querySelector("input[list][data-hfx-service-config-field-input]");
    const dataList = field.querySelector("datalist");
    if (!input || !dataList) {
      return;
    }

    const key = field.getAttribute("data-hfx-service-config-field") || "field";
    const path = field.getAttribute("data-hfx-service-config-field-path") || key;
    const listId = `hfx-service-config-options-${key}-${index}-${Math.abs(hashString(path))}`;
    input.setAttribute("list", listId);
    dataList.setAttribute("id", listId);
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  function readConfigPath(value, path) {
    if (value == null || typeof value !== "object") {
      return undefined;
    }

    return parseConfigPath(path).reduce((current, part) => {
      if (current == null) {
        return undefined;
      }
      return current[part];
    }, value);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function refreshDependencies(studio) {
    if (!studio) {
      return;
    }

    studio.querySelectorAll("[data-hfx-service-config-field]").forEach((field) => {
      if (isRepeaterTemplateElement(field)) {
        field.setAttribute("aria-disabled", "true");
        field.querySelectorAll("[data-hfx-service-config-field-input]").forEach((input) => {
          input.disabled = true;
        });
        return;
      }

      const inputs = Array.from(field.querySelectorAll("[data-hfx-service-config-field-input]"));
      const intrinsicDisabled = field.getAttribute("data-hfx-service-config-field-disabled") === "true";
      const dependsOn = field.getAttribute("data-hfx-service-config-depends-on");
      const expectedValue = field.getAttribute("data-hfx-service-config-depends-value") || "true";
      const dependencySatisfied = !dependsOn || dependencyMatches(studio, dependsOn, expectedValue);
      const enabled = !intrinsicDisabled && dependencySatisfied;

      field.classList.toggle("is-dependency-disabled", !dependencySatisfied);
      field.setAttribute("data-hfx-service-config-dependency-active", dependencySatisfied ? "true" : "false");
      field.setAttribute("aria-disabled", enabled ? "false" : "true");
      inputs.forEach((input) => {
        input.disabled = !enabled;
      });
    });
  }

  function dependencyMatches(studio, path, expectedValue) {
    const input = findFieldInput(studio, path);
    if (!input) {
      return false;
    }

    const value = readInputValue(input);
    if (Array.isArray(value)) {
      return value.map((item) => normalize(item)).includes(normalize(expectedValue));
    }

    return normalize(value) === normalize(expectedValue);
  }

  function isRepeaterTemplateElement(element) {
    return Boolean(element?.closest?.("[data-hfx-service-config-repeater-template=\"true\"]"));
  }

  function collectFields(scope) {
    const root = scope || document;
    const values = {};
    root.querySelectorAll?.("[data-hfx-service-config-field-input]").forEach((input) => {
      const field = input.closest("[data-hfx-service-config-field]");
      if (isRepeaterTemplateElement(field)) {
        return;
      }

      const path = field?.getAttribute("data-hfx-service-config-field-path") || input.getAttribute("name");
      if (path) {
        values[path] = readInputValue(input);
      }
    });
    return values;
  }

  function collectRepeaters(scope) {
    const root = scope || document;
    return Array.from(root.querySelectorAll?.("[data-hfx-service-config-repeater]") || []).map((repeater) => ({
      path: repeater.getAttribute("data-hfx-service-config-repeater-path"),
      items: getRepeaterItems(repeater).map((item) => ({
        key: item.getAttribute("data-hfx-service-config-repeater-item"),
        fields: collectFields(item)
      }))
    }));
  }

  function collectJsonPanels(scope) {
    const root = scope || document;
    return Array.from(root.querySelectorAll?.("[data-hfx-service-config-json]") || []).map((panel) => jsonDetail(panel));
  }

  function parseSubmitPaths(value) {
    return (value || "")
      .split(";")
      .map((path) => path.trim())
      .filter(Boolean);
  }

  function buildSubmitPayload(config, paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return config?.data || {};
    }

    const payload = {};
    paths.forEach((path) => {
      const value = readConfigPath(config?.data || {}, path);
      if (value !== undefined) {
        assignConfigPath(payload, path, value);
      }
    });
    return payload;
  }

  function buildSubmitPayloadFromSources(primaryConfig, fallbackConfig, paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return primaryConfig?.data || {};
    }

    const payload = {};
    paths.forEach((path) => {
      let value = readConfigPath(primaryConfig?.data || {}, path);
      if (value === undefined) {
        value = readConfigPath(fallbackConfig?.data || {}, path);
      }
      if (value !== undefined) {
        assignConfigPath(payload, path, value);
      }
    });
    return payload;
  }

  function buildSubmitCommitPaths(paths, formConfig) {
    if (Array.isArray(paths) && paths.length > 0) {
      return paths;
    }

    const roots = new Set();
    Object.keys(formConfig?.fields || {}).forEach((path) => roots.add(path));
    (formConfig?.repeaters || []).forEach((repeater) => {
      if (repeater.path) {
        roots.add(repeater.path);
      }
    });
    (formConfig?.jsonPanels || []).forEach((panel) => {
      if (panel.path) {
        roots.add(panel.path);
      }
    });
    return Array.from(roots);
  }

  function collectConfig(studio) {
    const root = studio || document;
    const fields = collectFields(root);
    const repeaters = collectRepeaters(root);
    const jsonPanels = collectJsonPanels(root);
    const data = buildConfigObject(fields);
    repeaters
      .filter((repeater) => repeater.path && repeater.items.length === 0)
      .forEach((repeater) => assignConfigPath(data, repeater.path, []));
    return {
      dirty: root.getAttribute?.("data-hfx-service-config-dirty") === "true",
      fields,
      data,
      repeaters,
      jsonPanels,
      changes: collectConfigChanges(configState.get(root), fields, repeaters, jsonPanels)
    };
  }

  function collectConfigChanges(snapshot, fields, repeaters, jsonPanels) {
    const fieldChanges = diffMap(snapshot?.fields || {}, fields || {});
    const repeaterChanges = diffRepeaters(snapshot?.repeaters || [], repeaters || []);
    const jsonPanelChanges = diffJsonPanels(snapshot?.jsonPanels || [], jsonPanels || []);
    return {
      dirty: fieldChanges.changed || repeaterChanges.changed || jsonPanelChanges.changed,
      fields: fieldChanges.items,
      repeaters: repeaterChanges.items,
      jsonPanels: jsonPanelChanges.items,
      counts: {
        fields: fieldChanges.items.length,
        repeaters: repeaterChanges.items.length,
        jsonPanels: jsonPanelChanges.items.length
      }
    };
  }

  function diffMap(before, after) {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const items = [];
    keys.forEach((path) => {
      const hadBefore = Object.prototype.hasOwnProperty.call(before || {}, path);
      const hasAfter = Object.prototype.hasOwnProperty.call(after || {}, path);
      const previous = hadBefore ? before[path] : undefined;
      const current = hasAfter ? after[path] : undefined;
      if (hadBefore && hasAfter && configValuesEqual(previous, current)) {
        return;
      }

      items.push({
        path,
        type: hadBefore ? (hasAfter ? "modified" : "removed") : "added",
        before: previous,
        after: current
      });
    });

    return {
      changed: items.length > 0,
      items
    };
  }

  function diffRepeaters(before, after) {
    const previous = mapByPath(before);
    const current = mapByPath(after);
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    const items = [];
    keys.forEach((path) => {
      const beforeItems = previous[path]?.items || [];
      const afterItems = current[path]?.items || [];
      if (beforeItems.length !== afterItems.length) {
        items.push({
          path,
          type: "count",
          before: beforeItems.length,
          after: afterItems.length
        });
      }
    });

    return {
      changed: items.length > 0,
      items
    };
  }

  function diffJsonPanels(before, after) {
    const previous = mapByPath(before);
    const current = mapByPath(after);
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    const items = [];
    keys.forEach((path) => {
      const beforePanel = previous[path];
      const afterPanel = current[path];
      const hadBefore = beforePanel != null;
      const hasAfter = afterPanel != null;
      const beforeJson = beforePanel?.json;
      const afterJson = afterPanel?.json;
      if (hadBefore && hasAfter && configValuesEqual(beforeJson, afterJson)) {
        return;
      }

      items.push({
        path,
        schema: afterPanel?.schema || beforePanel?.schema || "",
        type: hadBefore ? (hasAfter ? "modified" : "removed") : "added",
        before: beforeJson,
        after: afterJson
      });
    });

    return {
      changed: items.length > 0,
      items
    };
  }

  function mapByPath(items) {
    const map = {};
    (items || []).forEach((item, index) => {
      map[item.path || `#${index}`] = item;
    });
    return map;
  }

  function configValuesEqual(first, second) {
    return stableConfigValue(first) === stableConfigValue(second);
  }

  function stableConfigValue(value) {
    if (Array.isArray(value)) {
      return `[${value.map(stableConfigValue).join(",")}]`;
    }

    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableConfigValue(value[key])}`).join(",")}}`;
    }

    return JSON.stringify(value);
  }

  function buildConfigObject(fields) {
    const output = {};
    Object.entries(fields || {}).forEach(([path, value]) => {
      assignConfigPath(output, path, value);
    });
    return output;
  }

  function flattenConfigObject(value, prefix, output) {
    const result = output || {};
    if (value == null || typeof value !== "object") {
      return result;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const nextPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
        if (item != null && typeof item === "object" && !Array.isArray(item)) {
          flattenConfigObject(item, nextPrefix, result);
        } else {
          result[nextPrefix] = item;
        }
      });
      return result;
    }

    Object.entries(value).forEach(([key, item]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(item)) {
        if (item.some((entry) => entry != null && typeof entry === "object" && !Array.isArray(entry))) {
          flattenConfigObject(item, nextPrefix, result);
        } else {
          result[nextPrefix] = item;
        }
      } else if (item != null && typeof item === "object") {
        flattenConfigObject(item, nextPrefix, result);
      } else {
        result[nextPrefix] = item;
      }
    });

    return result;
  }

  function assignConfigPath(target, path, value) {
    const parts = parseConfigPath(path);
    if (parts.length === 0) {
      return;
    }

    let cursor = target;
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      if (last) {
        cursor[part] = value;
        return;
      }

      const nextPart = parts[index + 1];
      if (cursor[part] == null || typeof cursor[part] !== "object") {
        cursor[part] = typeof nextPart === "number" ? [] : {};
      }
      cursor = cursor[part];
    });
  }

  function parseConfigPath(path) {
    const parts = [];
    const matcher = /([^[.\]]+)|\[(\d+)\]/g;
    let match;
    while ((match = matcher.exec(path || "")) !== null) {
      parts.push(match[1] != null ? match[1] : Number(match[2]));
    }
    return parts;
  }

  function readConfigPath(source, path) {
    const parts = parseConfigPath(path);
    let cursor = source;
    for (const part of parts) {
      if (cursor == null || !Object.prototype.hasOwnProperty.call(cursor, part)) {
        return undefined;
      }

      cursor = cursor[part];
    }

    return cursor;
  }

  function pathMatchesRoot(path, root) {
    return path === root || path.startsWith(`${root}.`) || path.startsWith(`${root}[`);
  }

  function rebuildSnapshot(fields, repeaters, jsonPanels) {
    const data = buildConfigObject(fields);
    (repeaters || [])
      .filter((repeater) => repeater.path && repeater.items.length === 0)
      .forEach((repeater) => assignConfigPath(data, repeater.path, []));
    return {
      fields,
      data,
      repeaters: repeaters || [],
      jsonPanels: jsonPanels || []
    };
  }

  function commitConfigPaths(studio, paths, source) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return;
    }

    const previous = configState.get(studio) || rebuildSnapshot({}, [], []);
    const current = collectConfig(studio);
    const fields = { ...(previous.fields || {}) };
    Object.keys(fields).forEach((path) => {
      if (paths.some((root) => pathMatchesRoot(path, root))) {
        delete fields[path];
      }
    });
    Object.entries(current.fields || {}).forEach(([path, value]) => {
      if (paths.some((root) => pathMatchesRoot(path, root))) {
        fields[path] = value;
      }
    });

    const repeaters = (previous.repeaters || []).filter((repeater) =>
      !paths.some((root) => pathMatchesRoot(repeater.path || "", root)));
    (current.repeaters || []).forEach((repeater) => {
      if (paths.some((root) => pathMatchesRoot(repeater.path || "", root))) {
        repeaters.push(repeater);
      }
    });

    const jsonPanels = (previous.jsonPanels || []).filter((panel) =>
      !paths.some((root) => pathMatchesRoot(panel.path || "", root)));
    (current.jsonPanels || []).forEach((panel) => {
      if (paths.some((root) => pathMatchesRoot(panel.path || "", root))) {
        jsonPanels.push(panel);
      }
    });

    configState.set(studio, rebuildSnapshot(fields, repeaters, jsonPanels));
    const dirty = collectConfig(studio).changes?.dirty === true;
    studio.setAttribute("data-hfx-service-config-dirty", dirty ? "true" : "false");
    studio.classList.toggle("is-dirty", dirty);
    dispatch(studio, "hfx:service-config-commit", { studio, source, paths, config: collectConfig(studio) });
  }

  function rememberConfig(studio) {
    if (!studio) {
      return;
    }

    configState.set(studio, collectConfig(studio));
  }

  function commitConfig(studio, source) {
    if (!studio) {
      return null;
    }

    studio.setAttribute("data-hfx-service-config-dirty", "false");
    studio.classList.remove("is-dirty");
    rememberConfig(studio);
    const detail = { studio, source, config: collectConfig(studio) };
    dispatch(studio, "hfx:service-config-commit", detail);
    return detail;
  }

  function setConfig(studio, payload, options) {
    if (!studio || !payload) {
      return null;
    }

    applyConfigPayload(studio, payload);
    const remember = options?.remember !== false;
    if (remember) {
      commitConfig(studio, options?.source || "setConfig");
    } else {
      refreshDependencies(studio);
    }

    const detail = { studio, payload, config: collectConfig(studio) };
    dispatch(studio, "hfx:service-config-set", detail);
    return detail;
  }

  function resetConfig(studio) {
    const snapshot = configState.get(studio);
    if (!snapshot) {
      return null;
    }

    applyConfigPayload(studio, snapshot);
    studio.setAttribute("data-hfx-service-config-dirty", "false");
    studio.classList.remove("is-dirty");
    dispatch(studio, "hfx:service-config-reset", { studio, config: collectConfig(studio) });
    return snapshot;
  }

  function bindAdapter(studio, adapter) {
    if (!studio || !adapter) {
      return null;
    }

    const removers = [];
    const on = (target, name, handler) => {
      target.addEventListener(name, handler);
      removers.push(() => target.removeEventListener(name, handler));
    };
    const run = async (type, handler, event, after) => {
      event.preventDefault();
      dispatch(studio, "hfx:service-config-adapter-operation", {
        studio,
        type,
        detail: event.detail
      });

      try {
        const result = await handler(event.detail);
        after?.(result, event.detail);
        dispatch(studio, "hfx:service-config-adapter-success", {
          studio,
          type,
          result,
          detail: event.detail
        });
      } catch (error) {
        dispatch(studio, "hfx:service-config-adapter-error", {
          studio,
          type,
          error,
          detail: event.detail
        });
      }
    };

    if (typeof adapter.load === "function") {
      on(studio, "hfx:service-config-load-request", (event) => run("load", adapter.load, event, (payload) => {
        if (payload) {
          setConfig(studio, payload, { source: "adapter.load" });
        }
      }));
    }

    if (typeof adapter.save === "function") {
      on(studio, "hfx:service-config-save-request", (event) => run("save", adapter.save, event, () => {
        commitConfig(studio, "adapter.save");
      }));
    }

    if (typeof adapter.saveForm === "function") {
      on(studio, "hfx:service-config-form-save-request", (event) => run("form-save", adapter.saveForm, event, () => {
        const paths = buildSubmitCommitPaths(event.detail?.paths || [], event.detail?.formConfig);
        commitConfigPaths(studio, paths, "adapter.form.save");
      }));
    }

    if (typeof adapter.apply === "function") {
      on(studio, "hfx:service-config-apply-request", (event) => run("apply", adapter.apply, event, () => {
        commitConfig(studio, "adapter.apply");
      }));
    }

    if (typeof adapter.updateSecret === "function") {
      on(studio, "hfx:service-config-secret-update-request", (event) => run("secret", adapter.updateSecret, event, (result, detail) => {
        applySecretReference(detail, result);
      }));
    }

    if (typeof adapter.loadJson === "function") {
      studio.querySelectorAll("[data-hfx-service-config-json]").forEach((panel) => {
        on(panel, "hfx:service-config-json-load-request", (event) => run("json-load", adapter.loadJson, event, (json) => {
          if (json != null) {
            setJson(panel, typeof json === "string" ? json : JSON.stringify(json, null, 2), { dirty: false });
            rememberJson(panel);
          }
        }));
      });
    }

    if (typeof adapter.saveJson === "function") {
      studio.querySelectorAll("[data-hfx-service-config-json]").forEach((panel) => {
        on(panel, "hfx:service-config-json-save-request", (event) => run("json-save", adapter.saveJson, event, () => {
          commitConfig(studio, "adapter.saveJson");
        }));
      });
    }

    return {
      destroy() {
        removers.splice(0).forEach((remove) => remove());
      }
    };
  }

  function applySecretReference(detail, result) {
    const input = detail?.field?.querySelector("[data-hfx-service-config-field-input]");
    if (!input || result == null) {
      return;
    }

    const reference = typeof result === "string"
      ? result
      : result.reference || result.currentReference || result.value;
    if (!reference) {
      return;
    }

    input.value = reference;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function initAll(root) {
    const scope = root || document;
    if (scope.matches?.("[data-hfx-service-config-studio]")) {
      initStudio(scope);
    }
    if (scope.matches?.("[data-hfx-service-config-json]")) {
      initJsonPanel(scope);
    }
    if (scope.matches?.("[data-hfx-service-config-workbench]")) {
      initWorkbench(scope);
    }

    scope.querySelectorAll?.("[data-hfx-service-config-studio]").forEach(initStudio);
    scope.querySelectorAll?.("[data-hfx-service-config-workbench]").forEach(initWorkbench);
    scope.querySelectorAll?.("[data-hfx-service-config-json]").forEach(initJsonPanel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(document));
  } else {
    initAll(document);
  }

  window.HfxServiceConfigStudio = {
    init: initAll,
    getJson,
    setJson,
    loadJson,
    saveJson,
    loadConfig,
    saveConfig,
    saveFormConfig,
    setConfig,
    commitConfig,
    commitConfigPaths,
    resetConfig,
    validateConfig,
    bindAdapter,
    exportJson,
    setCheckState,
    collectFields,
    collectRepeaters,
    collectJsonPanels,
    collectConfig,
    buildSubmitPayload,
    toConfigData: buildConfigObject,
    toConfigFields: flattenConfigObject
  };
})();
