  function preserveWhitespace(original, replacement) {
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    return `${leading}${replacement}${trailing}`;
  }

  function shouldSkipNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest("[data-orl-owned]")) return true;
    if (parent.closest("script, style, noscript, code, pre, textarea, input, select, [contenteditable='true']")) {
      return true;
    }
    return false;
  }

  function translationModuleNamesForPath(pathname) {
    const prefix = firstPathSegment(pathname);
    const shared = ["common", "navigation", "accessibility"];
    if (!prefix) return ["home", ...shared];
    if (ACCOUNT_UI_PATH_PREFIXES.has(prefix)) {
      return [
        "settings",
        "details",
        "providers",
        "metrics",
        "catalog",
        "rankings",
        "home",
        ...shared,
      ];
    }
    if (prefix === "docs") return ["docsShell", "docs", ...shared];
    if (prefix === "sdk") return ["sdk", ...shared];
    if (prefix === "blog") return ["blog", ...shared];
    if (["privacy", "terms", "terms-of-service-enterprise", "authorized-sub-processors"].includes(prefix)) {
      return ["legal", ...shared];
    }
    if (prefix === "support") return ["support", ...shared];
    if (prefix === "fusion") return ["fusion", "catalog", "providers", ...shared];
    if (["pricing", "enterprise", "labs", "about", "careers", "works-with-openrouter"].includes(prefix)) {
      return ["marketing", "apps", ...shared];
    }
    if (["provider", "providers"].includes(prefix)) {
      return ["providers", "catalog", "metrics", ...shared];
    }
    if (isAuthorEntityPath(pathname)) {
      return ["providers", "catalog", "metrics", ...shared];
    }
    if (prefix === "data") return ["data", "rankings", "metrics", "catalog", ...shared];
    if (prefix === "state-of-ai") return ["data", "rankings", "metrics", "marketing", ...shared];
    if (prefix === "benchmarks") {
      return ["benchmarks", "metrics", "rankings", "catalog", ...shared];
    }
    if (prefix === "rankings") return ["rankings", "apps", "metrics", "catalog", ...shared];
    if (prefix === "apps") return ["apps", "rankings", "metrics", ...shared];
    if (["models", "discover", "collections", "compare"].includes(prefix)) {
      return ["product", "catalog", "details", "providers", "metrics", ...shared];
    }
    if (["request-builder", "agents", "learn", "long-horizon", "customers", "spawn"].includes(prefix)) {
      return ["product", "marketing", "docs", "catalog", ...shared];
    }
    return ["details", "providers", "metrics", "catalog", "home", ...shared];
  }

  function translationModuleNamesForElement(element) {
    if (!element) return [];
    if (element.closest("footer")) return ["footer", "common", "navigation", "accessibility"];
    if (element.closest("main")) return translationModuleNamesForPath(location.pathname);
    if (element.closest("nav")) return ["navigation", "common", "accessibility"];
    if (
      element.closest(
        "#portal-container, [data-radix-popper-content-wrapper], [role='dialog'], [role='listbox'], [role='menu']",
      )
    ) {
      return translationModuleNamesForPath(location.pathname);
    }
    return ["footer", ...translationModuleNamesForPath(location.pathname)];
  }

  function isModelPagePath(pathname) {
    const segments = String(pathname || "").split("/").filter(Boolean);
    return isModelEntityPath(pathname) || (segments.length === 3 && segments[0] === "models");
  }

  function currentModelDisplayName() {
    if (!isModelPagePath(location.pathname)) return "";
    const heading = document.querySelector("#model-title-row h1, main h1")?.textContent?.trim() || "";
    return heading.includes(":") ? heading.slice(heading.indexOf(":") + 1).trim() : heading;
  }

  function isProtectedCompareEntityNode(element, value = null) {
    if (!element || !isComparePath(location.pathname)) return false;
    const text = String(value ?? element.textContent ?? "").trim();
    if (isCompareModelLabel(text, location.pathname)) return true;
    const modelButton = element.closest("main button[aria-haspopup='dialog']");
    if (modelButton?.querySelector("img")) return true;

    const entityControl = element.closest("button[role='combobox'], [role='option']");
    if (!entityControl) return false;
    return !translateStaticValue(text, translationModuleNamesForElement(element));
  }

  function currentCompareProtectedTranslationEntities() {
    if (!isComparePath(location.pathname)) return [];
    const candidates = [];
    for (const element of document.querySelectorAll("main [title]")) {
      candidates.push(element.getAttribute("title"));
    }
    for (const button of document.querySelectorAll("main button[aria-haspopup='dialog']")) {
      if (button.querySelector("img")) candidates.push(button.textContent);
    }

    const entities = new Set();
    for (const candidate of candidates) {
      const text = String(candidate || "").trim();
      if (!isCompareModelLabel(text, location.pathname)) continue;
      entities.add(text);
      const baseText = text.split(/[（(]/, 1)[0].trim();
      if (baseText) entities.add(baseText);
    }
    return [...entities].sort((left, right) => right.length - left.length);
  }

  function isProtectedBenchmarkEntityNode(element, value = null) {
    if (!element) return false;
    const text = String(value ?? element.textContent ?? "").trim();
    if (!text) return false;

    if (
      firstPathSegment(location.pathname) === "benchmarks" &&
      element.matches("[title]") &&
      element.getAttribute("title")?.trim() === text &&
      element.parentElement?.querySelector("img")
    ) {
      return true;
    }

    const modelName = currentModelDisplayName();
    if (!modelName || (text !== modelName && !text.startsWith(`${modelName} (`))) return false;
    return Boolean(
      element.closest("#benchmarks [role='combobox']") || element.closest("[role='option']"),
    );
  }

  function isProtectedEntityNode(element, value = null) {
    if (isProtectedCompareEntityNode(element, value)) return true;
    if (isProtectedBenchmarkEntityNode(element, value)) return true;
    const text = cleanEntityName(value ?? element?.textContent);
    if (isKnownProviderName(text) || isKnownModelName(text)) return true;
    const linkedEntity = element?.closest("main a[href]");
    if (linkedEntity) {
      try {
        const entityPath = new URL(linkedEntity.href, location.origin).pathname;
        const segments = entityPath.split("/").filter(Boolean);
        const entityRoute =
          isModelPagePath(entityPath) ||
          isAuthorEntityPath(entityPath) ||
          (segments.length > 1 &&
            ["apps", "provider", "providers", "works-with-openrouter"].includes(segments[0]));
        if (entityRoute && isEntityLabelElement(element, linkedEntity, entityPath, value)) {
          const hints = extractEntityNamesFromPath(entityPath);
          if (hints.models.length) registerModelCandidate(text, entityPath);
          else if (hints.providers.length) registerProviderCandidate(text, entityPath);
          return true;
        }
      } catch {
        // 无效链接交给普通词典处理。
      }
    }
    if (
      firstPathSegment(location.pathname) === "apps" &&
      location.pathname.split("/").filter(Boolean).length > 1 &&
      element?.closest("main h1")
    ) {
      return true;
    }
    if (
      (firstPathSegment(location.pathname) === "provider" ||
        isAuthorEntityPath(location.pathname)) &&
      element?.closest("main h1")
    ) {
      return true;
    }
    if (element?.closest("#providers tbody td:first-child")) return true;
    return Boolean(
      element?.closest(
        [
          "#model-title-row h1",
          "#model-title-row h2",
          "#model-title-row h3",
          "#providers tbody td:first-child button",
          "code",
          "pre",
          "kbd",
          "samp",
          "var",
          ".font-mono",
        ].join(", "),
      ),
    );
  }

  function isEntityLabelElement(element, anchor, pathname, value = null) {
    if (!element || !anchor) return false;
    if (element.closest("h1, h2, h3, h4, h5, h6, [data-slot='title']")) return true;
    const text =
      String(value ?? element.textContent ?? "").trim() ||
      String(anchor.getAttribute("aria-label") || "").trim();
    if (!text || /[.!?。！？]\s*$/.test(text)) return false;

    const listItem = element.closest("[data-testid='model-list-item']");
    if (listItem && isModelPagePath(pathname)) {
      const matchingAnchors = [...listItem.querySelectorAll("a[href]")].filter((candidate) => {
        try {
          return new URL(candidate.href, location.origin).pathname === pathname;
        } catch {
          return false;
        }
      });
      const titleAnchor =
        matchingAnchors.find((candidate) => candidate.querySelector(".font-semibold")) ||
        matchingAnchors[0];
      if (anchor === titleAnchor) return true;
    }

    const siblingListItem = anchor.parentElement?.querySelector("[data-testid='model-list-item']");
    if (
      siblingListItem &&
      anchor.hasAttribute("aria-label") &&
      text === anchor.getAttribute("aria-label") &&
      isModelPagePath(pathname)
    ) {
      return true;
    }

    if (isEntityLabelForPath(text, pathname)) return true;
    const slug = decodeEntityPathSegment(
      String(pathname || "").split("/").filter(Boolean).at(-1) || "",
    );
    const normalizedText = normalizedEntityText(text);
    const normalizedSlug = normalizedEntityText(slug);
    return Boolean(
      normalizedText &&
        normalizedSlug &&
        (normalizedText === normalizedSlug || normalizedText.endsWith(normalizedSlug)),
    );
  }

  function translateTextNode(node) {
    if (shouldSkipNode(node)) return false;
    const existing = textRecords.get(node);
    if (isProtectedEntityNode(node.parentElement, existing?.original ?? node.nodeValue)) {
      if (existing && node.nodeValue === existing.rendered) node.nodeValue = existing.original;
      textRecords.delete(node);
      return false;
    }
    if (existing) {
      if (!settings.enabled || !settings.translateUi) {
        if (node.nodeValue === existing.rendered) node.nodeValue = existing.original;
        textRecords.delete(node);
        return false;
      }
      if (node.nodeValue === existing.rendered) return true;
      textRecords.delete(node);
    }

    if (!settings.enabled || !settings.translateUi) return false;
    const original = node.nodeValue;
    const translated = translateStaticValue(
      original,
      translationModuleNamesForElement(node.parentElement),
    );
    if (!translated || translated === original.trim()) return false;
    const rendered = preserveWhitespace(original, translated);
    textRecords.set(node, { original, rendered, owner: "dictionary" });
    node.nodeValue = rendered;
    return true;
  }

  function translateAttributes(root) {
    const selector = TRANSLATABLE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(", ");
    const elements = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) elements.push(root);
    elements.push(...(root.querySelectorAll?.(selector) || []));

    for (const element of elements) {
      if (element.closest("[data-orl-owned]")) continue;
      let records = attributeRecords.get(element);

      if (isProtectedEntityNode(element)) {
        if (records) {
          for (const [attribute, prior] of Object.entries(records)) {
            if (element.getAttribute(attribute) === prior.rendered) {
              element.setAttribute(attribute, prior.original);
            }
          }
          attributeRecords.delete(element);
        }
        continue;
      }

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const current = element.getAttribute(attribute);
        let prior = records?.[attribute];
        if (!settings.enabled || !settings.translateUi) {
          if (prior && current === prior.rendered) element.setAttribute(attribute, prior.original);
          continue;
        }

        if (prior && current === prior.rendered) continue;
        if (prior && current !== prior.rendered) {
          delete records[attribute];
          prior = null;
        }
        const original = current;
        if (!original) continue;
        const translated = translateStaticValue(
          original,
          translationModuleNamesForElement(element),
        );
        if (!translated) continue;
        records ||= {};
        records[attribute] = { original, rendered: translated };
        element.setAttribute(attribute, translated);
      }

      if (records) attributeRecords.set(element, records);
    }
  }

  function getAttributePending(element, attribute) {
    return attributePending.get(element)?.get(attribute);
  }

  function setAttributePending(element, attribute, taskId) {
    let pending = attributePending.get(element);
    if (!pending) {
      pending = new Map();
      attributePending.set(element, pending);
    }
    pending.set(attribute, taskId);
  }

  function deleteAttributePending(element, attribute, taskId) {
    const pending = attributePending.get(element);
    if (!pending || (taskId !== undefined && pending.get(attribute) !== taskId)) return;
    pending.delete(attribute);
    if (pending.size === 0) attributePending.delete(element);
  }

  function scanStaticTranslations(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) translateTextNode(node);
    translateAttributes(root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement || document.body);
  }
