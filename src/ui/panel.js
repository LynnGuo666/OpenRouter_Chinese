  function element(tag, properties = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(properties)) {
      if (key === "className") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value !== undefined && value !== null) {
        node.setAttribute(key, String(value));
      }
    }
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child) node.append(child);
    }
    return node;
  }

  function checkboxRow(label, key, detail) {
    const input = element("input", { type: "checkbox" });
    input.checked = Boolean(settings[key]);
    input.addEventListener("change", () => {
      settings[key] = input.checked;
      saveSettings();
      if (key === "showCny" && !settings.showCny) restorePrices();
      if (!settings.enabled || (key === "translateContent" && !settings.translateContent)) {
        descriptionGeneration += 1;
        descriptionQueue.length = 0;
        descriptionPending.clear();
        attributePending.clear();
      }
      if (
        !settings.enabled ||
        (key === "translateUi" && !settings.translateUi) ||
        (key === "translateContent" && !settings.translateContent)
      ) {
        restoreEnhancements();
      }
      scheduleFullScan();
    });
    panelRefs[key] = input;
    return element("label", { className: "orl-check-row" }, [
      element("span", {}, [
        element("strong", { text: label }),
        detail ? element("small", { text: detail }) : null,
      ]),
      input,
    ]);
  }

  function mountPanel() {
    if (document.querySelector("[data-orl-panel-host]")) return;
    const host = element("div", {
      "data-orl-panel-host": "true",
      "data-orl-owned": "true",
      "data-orl-version": VERSION,
    });
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = element("style", {
      text: `
        :host { all: initial; color-scheme: light dark; display: inline-flex; align-items: center; margin-left: 4px; }
        * { box-sizing: border-box; letter-spacing: 0; }
        button, input { font: inherit; }
        .orl-menu-button { width: 34px; height: 34px; border: 1px solid rgba(127,127,127,.28); border-radius: 6px; color: inherit; background: transparent; cursor: pointer; font: 700 15px/1 system-ui, sans-serif; }
        .orl-menu-button:hover, .orl-menu-button[aria-expanded="true"] { background: rgba(127,127,127,.12); }
        .orl-panel { position: fixed; right: 16px; top: 58px; z-index: 2147483646; width: min(360px, calc(100vw - 24px)); max-height: min(680px, calc(100vh - 72px)); overflow: auto; border: 1px solid rgba(127,127,127,.34); border-radius: 8px; background: light-dark(#fff, #171717); color: light-dark(#171717, #f5f5f5); box-shadow: 0 18px 50px rgba(0,0,0,.28); font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .orl-hidden { display: none !important; }
        .orl-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(127,127,127,.22); background: inherit; }
        .orl-head strong { font-size: 14px; }
        .orl-icon-button { width: 30px; height: 30px; border: 0; border-radius: 6px; color: inherit; background: transparent; cursor: pointer; font-size: 19px; }
        .orl-icon-button:hover { background: rgba(127,127,127,.14); }
        .orl-section { padding: 13px 16px; border-bottom: 1px solid rgba(127,127,127,.18); }
        .orl-section-title { display: block; margin-bottom: 9px; font-weight: 700; font-size: 12px; color: light-dark(#5d6470, #b6bbc4); }
        .orl-check-row { min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
        .orl-check-row span { display: grid; gap: 2px; }
        .orl-check-row strong { font-weight: 600; }
        .orl-check-row small, .orl-note { color: light-dark(#6b7280, #a3a3a3); font-size: 11px; }
        .orl-check-row input { width: 17px; height: 17px; accent-color: #1677ff; }
        .orl-rates { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; align-items: baseline; }
        .orl-rates output { font-variant-numeric: tabular-nums; font-weight: 650; }
        .orl-rate-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 11px; }
        .orl-button { min-height: 32px; border: 1px solid rgba(127,127,127,.34); border-radius: 6px; padding: 0 11px; color: inherit; background: transparent; cursor: pointer; }
        .orl-button:hover { background: rgba(127,127,127,.12); }
        .orl-button:disabled { cursor: wait; opacity: .55; }
        .orl-manual-grid { display: grid; grid-template-columns: 1fr 108px; gap: 8px 12px; align-items: center; margin-top: 10px; }
        .orl-manual-grid input { width: 100%; min-height: 32px; border: 1px solid rgba(127,127,127,.34); border-radius: 6px; padding: 4px 8px; color: inherit; background: transparent; font-variant-numeric: tabular-nums; }
        .orl-status { padding: 12px 16px; color: light-dark(#5d6470, #b6bbc4); font-size: 11px; }
        @media (max-width: 560px) {
          .orl-panel { top: 52px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 60px - env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); }
        }
      `,
    });

    const menuButton = element("button", {
      className: "orl-menu-button",
      type: "button",
      text: "译",
      title: "OpenRouter 中文与价格设置",
      "aria-label": "打开 OpenRouter 中文与价格设置",
      "aria-expanded": "false",
    });
    const panel = element("section", {
      className: "orl-panel orl-hidden",
      role: "dialog",
      "aria-label": "OpenRouter 中文与价格设置",
    });
    const closeButton = element("button", {
      className: "orl-icon-button",
      type: "button",
      text: "×",
      title: "关闭",
      "aria-label": "关闭设置",
    });
    const refreshButton = element("button", {
      className: "orl-button",
      type: "button",
      text: "刷新行情",
    });
    const manualToggle = element("input", { type: "checkbox" });
    manualToggle.checked = settings.rateMode === "manual";
    const manualUsdInput = element("input", {
      type: "number",
      min: "1",
      max: "20",
      step: "0.0001",
      value: settings.manualUsdCny,
      "aria-label": "手动 USD/CNY",
    });
    const manualUsdcInput = element("input", {
      type: "number",
      min: "0.5",
      max: "1.5",
      step: "0.0001",
      value: settings.manualUsdcUsd,
      "aria-label": "手动 USDC/USD",
    });
    const manualGrid = element("div", { className: "orl-manual-grid" }, [
      element("span", { text: "USD/CNY" }),
      manualUsdInput,
      element("span", { text: "USDC/USD" }),
      manualUsdcInput,
    ]);
    manualGrid.classList.toggle("orl-hidden", settings.rateMode !== "manual");

    const usdOutput = element("output", { text: "--" });
    const usdcUsdOutput = element("output", { text: "--" });
    const usdcCnyOutput = element("output", { text: "--" });
    const rateStatus = element("div", { className: "orl-note", text: "等待行情" });
    const descriptionStatus = element("div", { className: "orl-status", text: `v${VERSION}` });

    panel.append(
      element("header", { className: "orl-head" }, [
        element("strong", { text: "中文与价格" }),
        closeButton,
      ]),
      element("div", { className: "orl-section" }, [
        element("span", { className: "orl-section-title", text: "显示" }),
        checkboxRow("启用脚本", "enabled"),
        checkboxRow("中文界面", "translateUi", "内置词典，不联网"),
        checkboxRow("页面内容中文", "translateContent", "公开长文使用 Google 翻译"),
        checkboxRow("人民币估价", "showCny", "保留 OpenRouter 官方美元价"),
      ]),
      element("div", { className: "orl-section" }, [
        element("span", { className: "orl-section-title", text: "Yahoo 行情" }),
        element("div", { className: "orl-rates" }, [
          element("span", { text: "USD/CNY" }),
          usdOutput,
          element("span", { text: "USDC/USD" }),
          usdcUsdOutput,
          element("span", { text: "USDC/CNY" }),
          usdcCnyOutput,
        ]),
        element("div", { className: "orl-rate-actions" }, [rateStatus, refreshButton]),
        element("label", { className: "orl-check-row" }, [
          element("span", {}, [
            element("strong", { text: "使用手动汇率" }),
            element("small", { text: "Yahoo 在部分地区可能不可用" }),
          ]),
          manualToggle,
        ]),
        manualGrid,
      ]),
      element("div", {
        className: "orl-status",
        text: "页面只追加 ¥ 参考价，OpenRouter 官方价格仍以 USD 结算。USDC/CNY 为市场参考。",
      }),
      descriptionStatus,
    );

    shadow.append(style, menuButton, panel);
    Object.assign(panelRefs, {
      host,
      menuButton,
      panel,
      refreshButton,
      manualToggle,
      manualGrid,
      manualUsdInput,
      manualUsdcInput,
      usdOutput,
      usdcUsdOutput,
      usdcCnyOutput,
      rateStatus,
      descriptionStatus,
    });

    function setPanelOpen(open) {
      panel.classList.toggle("orl-hidden", !open);
      menuButton.setAttribute("aria-expanded", String(open));
      if (open) closeButton.focus();
    }
    menuButton.addEventListener("click", () => setPanelOpen(panel.classList.contains("orl-hidden")));
    closeButton.addEventListener("click", () => setPanelOpen(false));
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        menuButton.focus();
      }
    });
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      await loadRates({ force: true });
      global.setTimeout(() => {
        refreshButton.disabled = false;
      }, RATE_RETRY_COOLDOWN_MS);
    });
    manualToggle.addEventListener("change", () => {
      settings.rateMode = manualToggle.checked ? "manual" : "yahoo";
      manualGrid.classList.toggle("orl-hidden", !manualToggle.checked);
      saveSettings();
      loadRates({ force: true });
    });
    for (const input of [manualUsdInput, manualUsdcInput]) {
      input.addEventListener("change", () => {
        settings.manualUsdCny = Number(manualUsdInput.value);
        settings.manualUsdcUsd = Number(manualUsdcInput.value);
        settings = clampSettings(settings);
        manualUsdInput.value = settings.manualUsdCny;
        manualUsdcInput.value = settings.manualUsdcUsd;
        saveSettings();
        if (settings.rateMode === "manual") loadRates({ force: true });
      });
    }
    updatePanelVisibility();
    ensurePanelPlacement();
    refreshPanel();
  }

  function findTopNavigation() {
    return [...document.querySelectorAll("nav")].find(
      (navigation) =>
        navigation.querySelector('a[href="/models"]') &&
        navigation.querySelector('a[href^="/docs"]'),
    );
  }

  function ensurePanelPlacement() {
    const host = panelRefs.host;
    if (!host) return;
    const navigation = findTopNavigation();
    if (navigation && host.parentElement !== navigation) navigation.append(host);
    host.style.visibility = navigation ? "visible" : "hidden";
  }

  function mountDocumentStyles() {
    if (document.querySelector("style[data-orl-styles]")) return;
    const style = element("style", {
      "data-orl-styles": "true",
      "data-orl-owned": "true",
      text: `
        .orl-price-cny {
          color: color-mix(in srgb, currentColor 78%, #1677ff 22%);
          font-size: .92em;
          font-weight: 600;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          text-decoration: inherit;
        }
      `,
    });
    document.head.append(style);
  }

  function updatePanelVisibility() {
    if (!panelRefs.host) return;
    panelRefs.host.style.display = isActivePage() ? "inline-flex" : "none";
    ensurePanelPlacement();
  }

  function saveSettings() {
    settings = clampSettings(settings);
    writeValue(SETTINGS_KEY, settings);
    refreshPanel();
  }

  function formatTime(timestamp) {
    if (!Number.isFinite(timestamp)) return "时间未知";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(timestamp));
  }

  function rateStatusText(currentRates) {
    if (!currentRates) return "暂无可用汇率，仅显示美元";
    const usdc =
      currentRates.usdcStatus === "peg-assumption"
        ? "USDC：锚定估算"
        : currentRates.usdcStatus === "stale"
          ? "USDC：缓存"
          : "USDC：Yahoo";
    if (currentRates.status === "manual") return "手动汇率";
    if (currentRates.status === "stale") return `使用缓存 · ${formatTime(currentRates.usdFetchedAt)} · ${usdc}`;
    if (currentRates.status === "fallback") return `Yahoo 不可用 · ${currentRates.source} · ${usdc}`;
    return `${currentRates.source} · ${formatTime(currentRates.asOf)} · ${usdc}`;
  }

  function refreshPanel() {
    if (!panelRefs.usdOutput) return;
    panelRefs.usdOutput.textContent = rates ? formatNumber(rates.usdCny, 4) : "--";
    panelRefs.usdcUsdOutput.textContent = rates ? formatNumber(rates.usdcUsd, 6) : "--";
    panelRefs.usdcCnyOutput.textContent = rates ? formatNumber(rates.usdcCny, 4) : "--";
    panelRefs.rateStatus.textContent = rateStatusText(rates);
    panelRefs.manualToggle.checked = settings.rateMode === "manual";
    panelRefs.manualGrid.classList.toggle("orl-hidden", settings.rateMode !== "manual");
    for (const key of ["enabled", "translateUi", "translateContent", "showCny"]) {
      if (panelRefs[key]) panelRefs[key].checked = Boolean(settings[key]);
    }
  }

  function setRateStatus(text) {
    if (panelRefs.rateStatus) panelRefs.rateStatus.textContent = text;
  }

  function setDescriptionStatus(text) {
    if (panelRefs.descriptionStatus) panelRefs.descriptionStatus.textContent = text;
  }

  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== "function") return;
    GM_registerMenuCommand("打开中文与价格设置", () => {
      panelRefs.panel?.classList.remove("orl-hidden");
    });
    GM_registerMenuCommand("立即刷新汇率", () => loadRates({ force: true }));
  }

