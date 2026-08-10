  function isUiTextElement(element) {
    return Boolean(
      element?.closest(
        [
          "header",
          "nav",
          "footer",
          "aside",
          "button",
          "label",
          "legend",
          "th",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "[role='menu']",
          "[role='listbox']",
          "[role='option']",
          "[role='tab']",
          "[role='tooltip']",
        ].join(", "),
      ),
    );
  }

  function isPrivateContentElement(element) {
    return Boolean(
      element?.closest(
        [
          "form",
          "[role='textbox']",
          "[contenteditable]",
          "[data-private]",
          "[data-user]",
          "[data-message]",
          "[data-testid*='chat']",
          "[data-testid*='message']",
          "[data-testid*='prompt']",
        ].join(", "),
      ),
    );
  }

  function isPublicContentDocument(pathname) {
    if (PRIVATE_CONTENT_PATH_PREFIXES.has(firstPathSegment(pathname))) return false;
    if (isPublicContentPath(pathname)) return true;
    const modelEntity = isModelEntityPath(pathname);
    const authorEntity = isAuthorEntityPath(pathname);
    if (!modelEntity && !authorEntity) return false;
    const canonical = document.querySelector('link[rel="canonical"][href]');
    if (!canonical) return false;
    try {
      const canonicalUrl = new URL(canonical.href, location.origin);
      if (canonicalUrl.origin !== location.origin || canonicalUrl.pathname !== pathname) return false;
    } catch {
      return false;
    }

    if (modelEntity) {
      return Boolean(
        document.querySelector("#model-title-row h1, main h1") &&
          document.querySelector(
            '#providers, main nav a[href="#providers"], main a[href$="#providers"]',
          ),
      );
    }

    const author = firstPathSegment(pathname);
    return Boolean(
      document.querySelector("main h1") &&
        Array.from(
          document.querySelectorAll("main [data-testid='model-list-item'] a[href]"),
        ).some((anchor) => {
          try {
            const url = new URL(anchor.href, location.origin);
            const segments = url.pathname.split("/").filter(Boolean);
            return (
              url.origin === location.origin &&
              segments.length >= 2 &&
              segments[0] === author &&
              isModelEntityPath(url.pathname)
            );
          } catch {
            return false;
          }
        }),
    );
  }

  function isProtectedContentNode(node, value = null) {
    const element = node.parentElement;
    if (!element || shouldSkipNode(node)) return true;
    if (
      element.closest(
        "template, svg, math, canvas, [hidden], [aria-hidden='true'], [data-orl-owned]",
      )
    ) {
      return true;
    }

    const text = String(value ?? node.nodeValue ?? "").trim();
    return (
      PROTECTED_LABELS.has(text) ||
      isKnownProviderName(text) ||
      isKnownModelName(text) ||
      isProtectedEntityNode(element, text)
    );
  }

  function isEnglishContentNode(node) {
    if (!(node instanceof Text) || isProtectedContentNode(node)) return false;
    if (firstPathSegment(location.pathname) === "fusion") return false;
    const element = node.parentElement;
    if (isPrivateContentElement(element)) return false;
    const publicContent = isPublicContentDocument(location.pathname);
    const uiContext = isUiTextElement(element);
    return shouldTranslateOnlineText(node.nodeValue, { publicContent, uiContext });
  }

  function collectContentCandidates(root) {
    if (!settings.enabled || !settings.translateContent) return;
    const scope = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!(scope instanceof Element)) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const candidates = [];
    while (walker.nextNode()) candidates.push(walker.currentNode);

    const currentRoute = location.pathname;
    for (const node of candidates) {
      const prior = textRecords.get(node);
      if (isProtectedContentNode(node, prior?.original ?? node.nodeValue)) {
        if (prior && node.nodeValue === prior.rendered) node.nodeValue = prior.original;
        textRecords.delete(node);
        continue;
      }
      if (prior && node.nodeValue === prior.rendered) continue;
      if (prior) textRecords.delete(node);
      if (!isEnglishContentNode(node) || descriptionPending.has(node)) continue;
      const original = node.nodeValue;
      const source = original.trim();
      const taskId = ++descriptionTaskId;
      descriptionPending.set(node, taskId);
      descriptionQueue.push({
        kind: "text",
        node,
        original,
        source,
        route: currentRoute,
        protectedEntities: protectedEntityNamesForText(source),
        generation: descriptionGeneration,
        taskId,
        attempt: 0,
      });
    }

    if (isPublicContentDocument(currentRoute)) {
      const selector = TRANSLATABLE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(", ");
      const elements = [];
      if (scope.matches?.(selector)) elements.push(scope);
      elements.push(...scope.querySelectorAll(selector));
      for (const element of elements) {
        if (
          element.closest("[data-orl-owned]") ||
          isPrivateContentElement(element) ||
          isProtectedEntityNode(element)
        ) {
          continue;
        }
        const records = attributeRecords.get(element);
        for (const attribute of TRANSLATABLE_ATTRIBUTES) {
          const original = element.getAttribute(attribute);
          const prior = records?.[attribute];
          if (!original || (prior && original === prior.rendered)) continue;
          if (getAttributePending(element, attribute)) continue;
          if (!shouldTranslateOnlineText(original, { publicContent: true, uiContext: true })) {
            continue;
          }
          const taskId = ++descriptionTaskId;
          setAttributePending(element, attribute, taskId);
          descriptionQueue.push({
            kind: "attribute",
            element,
            attribute,
            original,
            source: original.trim(),
            route: currentRoute,
            protectedEntities: protectedEntityNamesForText(original),
            generation: descriptionGeneration,
            taskId,
            attempt: 0,
          });
        }
      }
    }
    runDescriptionWorkers();
  }
