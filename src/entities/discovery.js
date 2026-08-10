  function entityCandidateText(element) {
    const labelledText = cleanEntityName(
      element?.getAttribute?.("aria-label") ||
        element?.getAttribute?.("data-provider-name") ||
        element?.getAttribute?.("title"),
    );
    const visibleText = cleanEntityName(element?.innerText);
    const rawText = cleanEntityName(element?.textContent);
    let text = labelledText || visibleText || rawText;
    if (!labelledText && visibleText && rawText !== visibleText && rawText.endsWith(visibleText)) {
      const responsiveFullText = cleanEntityName(rawText.slice(0, -visibleText.length));
      if (responsiveFullText.length > visibleText.length) text = responsiveFullText;
    }
    if (!text || text.length > 160 || /[!?。！？]\s*$/.test(text)) return "";
    return text;
  }

  function registerModelCandidate(value, pathname, registry = PAGE_ENTITY_REGISTRY) {
    const text = cleanEntityName(value);
    const pathHints = extractEntityNamesFromPath(pathname);
    const routeShortAlias =
      pathHints.models.length === 1 &&
      text.length <= 40 &&
      /^[a-z0-9][a-z0-9 ._+/-]*$/i.test(text) &&
      /[a-z]/i.test(text) &&
      /\d/.test(text) &&
      text.split(/\s+/).length <= 5;
    if (
      !text ||
      (!isEntityLabelForPath(text, pathname) &&
        !isKnownModelName(text, registry) &&
        !routeShortAlias)
    ) {
      return null;
    }
    const hint = pathHints.models.find((candidate) => {
      const normalizedText = normalizedEntityText(text);
      return candidate.aliases.some((alias) => {
        const normalizedAlias = normalizedEntityText(alias);
        return normalizedText === normalizedAlias || normalizedText.endsWith(normalizedAlias);
      });
    }) || (pathHints.models.length === 1 ? pathHints.models[0] : null);
    const providerName = text.match(/^([^:：]{2,80})[:：]\s*/)?.[1];
    const modelDisplayName = providerName
      ? text.replace(/^([^:：]{2,80})[:：]\s*/, "").trim()
      : "";
    const providerHint = pathHints.providers[0];
    if (providerName && providerHint) {
      registry.registerProvider(providerName, {
        aliases: providerHint.aliases,
        canonicalId: providerHint.canonicalId,
        route: pathname,
        source: "dom",
      });
    }
    return registry.registerModel(text, {
      aliases: [...(hint?.aliases || []), modelDisplayName].filter(Boolean),
      canonicalId: hint?.canonicalId || text,
      route: pathname,
      source: "dom",
    });
  }

  function registerProviderCandidate(value, pathname, registry = PAGE_ENTITY_REGISTRY) {
    const text = cleanEntityName(value);
    if (!text || text.length > 100 || /[!?。！？]\s*$/.test(text)) return null;
    const pathHints = extractEntityNamesFromPath(pathname);
    const hint = pathHints.providers.find((candidate) => {
      const normalizedText = normalizedEntityText(text);
      const directMatch = candidate.aliases.some((alias) => {
        const normalizedAlias = normalizedEntityText(alias);
        return (
          normalizedText === normalizedAlias ||
          normalizedText.startsWith(normalizedAlias) ||
          normalizedText.endsWith(normalizedAlias)
        );
      });
      if (directMatch) return true;
      const slugTokens = decodeEntityPathSegment(candidate.canonicalId)
        .replace(/^~/, "")
        .split(/[-_.]+/)
        .map(normalizedEntityText)
        .filter((token) => token.length >= 2);
      return slugTokens.length > 0 && slugTokens.every((token) => normalizedText.includes(token));
    });
    if (!hint && !isKnownProviderName(text, registry)) return null;
    return registry.registerProvider(text, {
      aliases: hint?.aliases || [],
      canonicalId: hint?.canonicalId || text,
      route: pathname,
      source: "dom",
    });
  }

  function discoverPageEntities(root, registry = PAGE_ENTITY_REGISTRY) {
    if (typeof document === "undefined" || typeof location === "undefined") return [];
    const scope = root?.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!scope?.querySelectorAll) return registry.snapshot();
    registerRouteEntityHints(location.pathname, registry);

    const currentHints = extractEntityNamesFromPath(location.pathname);
    const modelHeading = document.querySelector("#model-title-row h1, main h1");
    if (currentHints.models.length && modelHeading) {
      const modelName = entityCandidateText(modelHeading);
      const modelHint = currentHints.models[0];
      if (modelName) {
        registry.registerModel(modelName, {
          aliases: modelHint.aliases,
          canonicalId: modelHint.canonicalId,
          route: location.pathname,
          source: "dom",
        });
      }
    } else if (currentHints.providers.length && modelHeading) {
      const providerName = entityCandidateText(modelHeading);
      const providerHint = currentHints.providers[0];
      if (providerName) {
        registry.registerProvider(providerName, {
          aliases: providerHint.aliases,
          canonicalId: providerHint.canonicalId,
          route: location.pathname,
          source: "dom",
        });
      }
    }

    const anchors = [];
    if (scope.matches?.("a[href]")) anchors.push(scope);
    anchors.push(...scope.querySelectorAll("a[href]"));
    for (const anchor of anchors) {
      let pathname;
      try {
        const url = new URL(anchor.href, location.origin);
        if (url.origin !== location.origin) continue;
        pathname = url.pathname;
      } catch {
        continue;
      }
      const hints = extractEntityNamesFromPath(pathname);
      if (!hints.models.length && !hints.providers.length) continue;
      registerRouteEntityHints(pathname, registry);

      const candidates = [
        ...anchor.querySelectorAll(
          "h1, h2, h3, h4, strong, [data-testid*='model'], [data-testid*='provider']",
        ),
      ];
      if (candidates.length === 0) candidates.push(anchor);
      for (const candidate of candidates) {
        const text = entityCandidateText(candidate);
        if (!text) continue;
        if (hints.models.length) registerModelCandidate(text, pathname, registry);
        if (hints.providers.length && !hints.models.length) {
          registerProviderCandidate(text, pathname, registry);
        }
      }

      for (const image of anchor.querySelectorAll("img[alt]")) {
        const alt = cleanEntityName(image.alt)
          .replace(/^(?:logo|icon|favicon)\s+(?:for|of)\s+/i, "")
          .replace(/\s+(?:logo|icon|favicon)$/i, "");
        if (!alt) continue;
        if (hints.models.length) registerModelCandidate(alt, pathname, registry);
        else registerProviderCandidate(alt, pathname, registry);
      }
    }

    const providerElements = scope.querySelectorAll(
      "#providers tbody td:first-child button, #providers tbody td:first-child a, " +
        "[data-provider-name], [data-testid='provider-name']",
    );
    for (const element of providerElements) {
      const providerName = cleanEntityName(
        element.getAttribute("data-provider-name") || entityCandidateText(element),
      );
      if (!providerName || providerName.length > 100) continue;
      registry.registerProvider(providerName, {
        canonicalId: providerName,
        route: location.pathname,
        source: "dom",
      });
    }

    for (const modelName of currentCompareProtectedTranslationEntities()) {
      const hint = currentHints.models.find((candidate) =>
        candidate.aliases.some((alias) =>
          normalizedEntityText(modelName).includes(normalizedEntityText(alias)),
        ),
      );
      registry.registerModel(modelName, {
        aliases: hint?.aliases || [],
        canonicalId: hint?.canonicalId || modelName,
        route: location.pathname,
        source: "dom",
      });
    }
    return registry.snapshot();
  }

  function protectedEntityNamesForText(value, registry = PAGE_ENTITY_REGISTRY) {
    return registry.matching(value, { kinds: ["provider", "model", "model-family"] });
  }
