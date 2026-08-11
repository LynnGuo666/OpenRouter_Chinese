  function restoreEnhancements() {
    for (const [node, record] of textRecords) {
      if (node.isConnected && node.nodeValue === record.rendered) node.nodeValue = record.original;
    }
    textRecords.clear();

    for (const [element, records] of attributeRecords) {
      if (!element.isConnected) continue;
      for (const [attribute, record] of Object.entries(records)) {
        if (element.getAttribute(attribute) === record.rendered) {
          element.setAttribute(attribute, record.original);
        }
      }
    }
    attributeRecords.clear();

    restorePrices();
  }

  function isActivePage() {
    return isTargetPath(location.pathname);
  }

  function scanRoot(root) {
    updatePanelVisibility();
    if (!isActivePage()) return;
    if (!settings.enabled) {
      restoreEnhancements();
      return;
    }
    discoverPageEntities(root);
    if (settings.translateUi) scanStaticTranslations(root);
    if (settings.showCny && rates) scanPrices(root);
    else if (priceRecords.size > 0) restorePrices();
    if (settings.translateContent) collectContentCandidates(root);
  }

  function scheduleScan(root) {
    const scope = root?.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!(scope instanceof Element) || !scope.isConnected || scope.closest("[data-orl-owned]")) return;
    for (const pending of pendingRoots) {
      if (pending.contains(scope)) return;
      if (scope.contains(pending)) pendingRoots.delete(pending);
    }
    pendingRoots.add(scope);
    if (pendingRoots.size > MAX_PENDING_SCAN_ROOTS) {
      pendingRoots.clear();
      pendingRoots.add(document.body);
    }
    if (scanFrame) return;
    scanFrame = global.requestAnimationFrame(() => {
      scanFrame = 0;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      for (const current of roots) scanRoot(current);
      cleanDisconnectedRecords();
    });
  }

  function scheduleFullScan() {
    if (document.body) scheduleScan(document.body);
  }

  function cleanDisconnectedRecords() {
    if (!recordsNeedCleanup) return;
    const now = Date.now();
    if (now - lastRecordCleanupAt < RECORD_CLEANUP_INTERVAL_MS) return;
    lastRecordCleanupAt = now;
    recordsNeedCleanup = false;
    for (const node of textRecords.keys()) if (!node.isConnected) textRecords.delete(node);
    for (const element of attributeRecords.keys()) if (!element.isConnected) attributeRecords.delete(element);
    for (const node of descriptionPending.keys()) if (!node.isConnected) descriptionPending.delete(node);
    for (const element of attributePending.keys()) if (!element.isConnected) attributePending.delete(element);
    for (const [node, record] of priceRecords) {
      if (!record.wrapper.isConnected) priceRecords.delete(node);
    }
  }

  function scheduleRecordCleanup() {
    recordsNeedCleanup = true;
    if (recordCleanupTimer) return;
    const elapsed = Date.now() - lastRecordCleanupAt;
    const delay = Math.max(0, RECORD_CLEANUP_INTERVAL_MS - elapsed);
    recordCleanupTimer = global.setTimeout(() => {
      recordCleanupTimer = 0;
      cleanDisconnectedRecords();
    }, delay);
  }

  function handleRouteChange() {
    const nextRoute = location.pathname;
    if (nextRoute === routeKey) return;
    routeKey = nextRoute;
    PAGE_ENTITY_REGISTRY.resetDynamic();
    registerRouteEntityHints(nextRoute);
    descriptionGeneration += 1;
    descriptionQueue.length = 0;
    descriptionPending.clear();
    attributePending.clear();
    recordsNeedCleanup = false;
    restoreEnhancements();
    updatePanelVisibility();
    if (isTargetPath(location.pathname)) {
      loadRates();
      scheduleFullScan();
    }
  }

  function observePage() {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      handleRouteChange();
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const element = mutation.target;
          const record = attributeRecords.get(element)?.[mutation.attributeName];
          if (record && element.getAttribute(mutation.attributeName) === record.rendered) continue;
          if (!element.closest?.("[data-orl-owned]")) scheduleScan(element);
          continue;
        }
        if (mutation.type === "characterData") {
          const record = textRecords.get(mutation.target);
          if (record && mutation.target.nodeValue === record.rendered) continue;
          const parent = mutation.target.parentElement;
          if (parent && !parent.closest("[data-orl-owned]")) scheduleScan(parent);
          continue;
        }
        if (mutation.removedNodes.length > 0) scheduleRecordCleanup();
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            scheduleScan(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
          }
        }
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
      childList: true,
      characterData: true,
      subtree: true,
    });
    global.addEventListener("popstate", handleRouteChange);
    global.addEventListener("hashchange", handleRouteChange);
    global.setInterval(handleRouteChange, 1000);
  }
