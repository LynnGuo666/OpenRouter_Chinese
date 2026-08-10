  function isTargetPath(pathname) {
    return typeof pathname === "string" && pathname.startsWith("/");
  }

  function firstPathSegment(pathname) {
    return String(pathname || "").split("/").filter(Boolean)[0] || "";
  }

  function isComparePath(pathname) {
    return firstPathSegment(pathname) === "compare";
  }

  function normalizedEntityText(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  const ENTITY_KINDS = new Set(["provider", "model", "model-family"]);
  const ENTITY_SOURCE_PRIORITY = Object.freeze({
    route: 1,
    runtime: 2,
    dom: 3,
    catalog: 4,
    manual: 5,
  });
  const ENTITY_CANONICAL_SOURCE_PRIORITY = Object.freeze({
    catalog: 1,
    runtime: 2,
    dom: 3,
    route: 4,
    manual: 5,
  });
  const MODEL_FAMILY_VARIANTS = new Set([
    "audio",
    "base",
    "chat",
    "code",
    "coder",
    "embed",
    "embedding",
    "flash",
    "guard",
    "haiku",
    "image",
    "instruct",
    "large",
    "latest",
    "lite",
    "max",
    "micro",
    "mini",
    "nano",
    "nemo",
    "opus",
    "oss",
    "preview",
    "pro",
    "small",
    "sonnet",
    "thinking",
    "transcribe",
    "turbo",
    "vision",
  ]);

  function cleanEntityName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizedCanonicalEntityId(value) {
    return cleanEntityName(value).normalize("NFKC").toLocaleLowerCase();
  }

  function createEntityRegistry(seed = ENTITY_CATALOG) {
    const records = new Map();
    const aliasIndex = new Map();
    const dynamicKeys = new Set();

    function rebuildAliasIndex() {
      aliasIndex.clear();
      for (const [recordKey, record] of records) {
        for (const alias of record.aliases) {
          const aliasKey = normalizedEntityText(alias);
          if (!aliasKey) continue;
          const keys = aliasIndex.get(aliasKey) || new Set();
          keys.add(recordKey);
          aliasIndex.set(aliasKey, keys);
        }
      }
    }

    function register(kind, value, options = {}) {
      if (!ENTITY_KINDS.has(kind)) throw new TypeError(`不支持的实体类型：${kind}`);
      const displayName = cleanEntityName(value);
      if (
        displayName.length < 2 ||
        displayName.length > 160 ||
        /[!?。！？]\s*$/.test(displayName)
      ) {
        return null;
      }

      const canonicalId = cleanEntityName(options.canonicalId || displayName);
      const canonicalKey = normalizedCanonicalEntityId(canonicalId);
      if (!canonicalKey) return null;
      const source = Object.hasOwn(ENTITY_SOURCE_PRIORITY, options.source)
        ? options.source
        : "runtime";
      let recordKey = `${kind}:${canonicalKey}`;
      let previous = records.get(recordKey);
      let migratedCatalogProvider = false;
      if (!previous && kind === "provider" && source !== "catalog") {
        const aliasKeys = new Set(
          [displayName, ...(Array.isArray(options.aliases) ? options.aliases : [])]
            .map(normalizedEntityText)
            .filter(Boolean),
        );
        const catalogMatches = new Set();
        for (const aliasKey of aliasKeys) {
          for (const candidateKey of aliasIndex.get(aliasKey) || []) {
            const candidate = records.get(candidateKey);
            if (
              candidate?.kind === "provider" &&
              candidate.source === "catalog" &&
              (candidate.canonicalSource || candidate.source) === "catalog"
            ) {
              catalogMatches.add(candidateKey);
            }
          }
        }
        if (catalogMatches.size === 1) {
          const [catalogKey] = catalogMatches;
          previous = records.get(catalogKey);
          records.delete(catalogKey);
          dynamicKeys.delete(catalogKey);
          migratedCatalogProvider = true;
        }
      }
      const aliases = new Set([
        ...(previous?.aliases || []),
        displayName,
        ...(Array.isArray(options.aliases) ? options.aliases.map(cleanEntityName) : []),
      ]);
      aliases.delete("");

      const previousPriority = ENTITY_SOURCE_PRIORITY[previous?.source] || 0;
      const nextPriority = ENTITY_SOURCE_PRIORITY[source];
      const replaceDisplay = !previous || nextPriority > previousPriority;
      const previousCanonicalPriority =
        ENTITY_CANONICAL_SOURCE_PRIORITY[previous?.canonicalSource || previous?.source] || 0;
      const nextCanonicalPriority = ENTITY_CANONICAL_SOURCE_PRIORITY[source];
      const replaceCanonical = !previous || nextCanonicalPriority > previousCanonicalPriority;
      const record = Object.freeze({
        kind,
        canonicalId: replaceCanonical ? canonicalId : previous.canonicalId,
        canonicalSource: replaceCanonical ? source : previous.canonicalSource || previous.source,
        displayName: replaceDisplay ? displayName : previous.displayName,
        aliases: Object.freeze([...aliases]),
        source: replaceDisplay ? source : previous.source,
        route: options.route || previous?.route || null,
      });
      records.set(recordKey, record);
      if (source !== "catalog" && previous?.source !== "catalog") dynamicKeys.add(recordKey);
      if (migratedCatalogProvider) rebuildAliasIndex();
      else {
        for (const alias of record.aliases) {
          const aliasKey = normalizedEntityText(alias);
          if (!aliasKey) continue;
          const keys = aliasIndex.get(aliasKey) || new Set();
          keys.add(recordKey);
          aliasIndex.set(aliasKey, keys);
        }
      }
      return record;
    }

    function has(kind, value) {
      const keys = aliasIndex.get(normalizedEntityText(value));
      return Boolean(keys && [...keys].some((key) => records.get(key)?.kind === kind));
    }

    function matching(value, options = {}) {
      const text = String(value || "").toLocaleLowerCase();
      if (!text) return [];
      const allowedKinds = options.kinds ? new Set(options.kinds) : ENTITY_KINDS;
      const candidates = [];
      for (const record of records.values()) {
        if (!allowedKinds.has(record.kind)) continue;
        for (const alias of record.aliases) {
          const normalizedAlias = alias.toLocaleLowerCase();
          if (normalizedAlias.length < 2) continue;
          let offset = 0;
          while (offset < text.length) {
            const start = text.indexOf(normalizedAlias, offset);
            if (start < 0) break;
            const end = start + normalizedAlias.length;
            const startsWithWord = /[a-z0-9]/i.test(normalizedAlias[0]);
            const endsWithWord = /[a-z0-9]/i.test(normalizedAlias.at(-1));
            const hasLeftBoundary =
              !startsWithWord || start === 0 || !/[a-z0-9]/i.test(text[start - 1]);
            const hasRightBoundary =
              !endsWithWord || end === text.length || !/[a-z0-9]/i.test(text[end]);
            if (hasLeftBoundary && hasRightBoundary) candidates.push({ alias, end, start });
            offset = start + normalizedAlias.length;
          }
        }
      }
      candidates.sort(
        (left, right) => right.alias.length - left.alias.length || left.start - right.start,
      );
      const selected = [];
      for (const candidate of candidates) {
        if (
          selected.some(
            (existing) => candidate.start < existing.end && candidate.end > existing.start,
          )
        ) {
          continue;
        }
        selected.push(candidate);
      }
      return [...new Map(selected.map(({ alias }) => [alias.toLocaleLowerCase(), alias])).values()]
        .sort((left, right) => right.length - left.length);
    }

    function snapshot(options = {}) {
      const allowedKinds = options.kinds ? new Set(options.kinds) : ENTITY_KINDS;
      return [...records.values()].filter((record) => allowedKinds.has(record.kind));
    }

    function resetDynamic() {
      for (const key of dynamicKeys) records.delete(key);
      dynamicKeys.clear();
      rebuildAliasIndex();
    }

    for (const provider of seed?.providers || []) {
      register("provider", provider, { source: "catalog" });
    }
    for (const modelFamily of seed?.modelFamilies || []) {
      register("model-family", modelFamily, { source: "catalog" });
    }

    return Object.freeze({
      hasModel: (value) => has("model", value) || has("model-family", value),
      hasProvider: (value) => has("provider", value),
      matching,
      registerModel: (value, options) => register("model", value, options),
      registerProvider: (value, options) => register("provider", value, options),
      resetDynamic,
      snapshot,
    });
  }

  function compareModelSlugs(pathname) {
    const segments = String(pathname || "").split("/").filter(Boolean);
    if (segments[0] !== "compare") return [];
    return segments.flatMap((segment, index) => {
      if (index < 2 || index % 2 !== 0) return [];
      try {
        return [decodeURIComponent(segment)];
      } catch {
        return [segment];
      }
    });
  }

  function isCompareModelLabel(value, pathname) {
    const text = String(value || "").trim();
    if (!text || text.length > 160) return false;
    const normalized = normalizedEntityText(text);
    const normalizedBase = normalizedEntityText(text.split(/[（(]/, 1)[0]);
    const segments = String(pathname || "").split("/").filter(Boolean);
    return compareModelSlugs(pathname).some((slug, index) => {
      const normalizedSlug = normalizedEntityText(slug);
      const normalizedAuthor = normalizedEntityText(segments[index * 2 + 1] || "");
      return [normalizedSlug, `${normalizedAuthor}${normalizedSlug}`].some(
        (label) =>
          normalized === label ||
          (/[（(]/.test(text) && normalizedBase === label) ||
          (normalizedBase.length >= 6 &&
            /[a-z]/.test(normalizedBase) &&
            /[0-9]/.test(normalizedBase) &&
            label.endsWith(normalizedBase)),
      );
    });
  }

  function isModelEntityPath(pathname) {
    const segments = String(pathname || "").split("/").filter(Boolean);
    const prefix = segments[0] || "";
    if (PRIVATE_CONTENT_PATH_PREFIXES.has(prefix) || NON_MODEL_TWO_SEGMENT_PREFIXES.has(prefix)) {
      return false;
    }
    if (segments.length === 2) return true;
    return segments.length === 3 && MODEL_ENTITY_TAB_SEGMENTS.has(segments[2]);
  }

  function isAuthorEntityPath(pathname) {
    const segments = String(pathname || "").split("/").filter(Boolean);
    if (segments.length !== 1) return false;
    const prefix = segments[0];
    return (
      !PRIVATE_CONTENT_PATH_PREFIXES.has(prefix) &&
      !PUBLIC_CONTENT_PATH_PREFIXES.has(prefix) &&
      /^[a-z0-9][a-z0-9._~-]*$/i.test(prefix) &&
      !/\.(?:json|txt|xml)$/i.test(prefix)
    );
  }

  function isEntityLabelForPath(value, pathname) {
    const text = String(value || "").trim();
    if (!text || text.length > 160 || /[.!?。！？]\s*$/.test(text)) return false;

    const segments = String(pathname || "").split("/").filter(Boolean);
    const modelEntity =
      isModelEntityPath(pathname) || (segments.length === 3 && segments[0] === "models");
    const authorEntity = isAuthorEntityPath(pathname);
    if (!modelEntity && !authorEntity) return false;

    const slug = decodeEntityPathSegment(segments.at(-1) || "");
    const normalizedText = normalizedEntityText(text);
    const normalizedSlug = normalizedEntityText(slug);
    if (!normalizedText || !normalizedSlug) return false;
    if (
      normalizedText === normalizedSlug ||
      normalizedText.endsWith(normalizedSlug) ||
      (normalizedText.length >= 4 && normalizedSlug.endsWith(normalizedText))
    ) {
      return true;
    }

    if (!modelEntity || !/[:：]/.test(text)) return false;
    const authorSegment = segments[0] === "models" ? segments[1] : segments[0];
    const normalizedAuthor = normalizedEntityText(String(authorSegment || "").replace(/^~/, ""));
    return Boolean(normalizedAuthor && normalizedText.startsWith(normalizedAuthor));
  }

  function decodeEntityPathSegment(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function entityHintFromSlug(slug, canonicalId = slug) {
    const decoded = decodeEntityPathSegment(slug);
    return Object.freeze({
      canonicalId: decodeEntityPathSegment(canonicalId),
      displayName: decoded.replace(/^~/, "").replace(/[-_]+/g, " "),
      aliases: Object.freeze([decoded, decoded.replace(/^~/, "")]),
    });
  }

  function extractEntityNamesFromPath(pathname) {
    const segments = String(pathname || "").split("/").filter(Boolean);
    const providers = [];
    const models = [];
    const addPair = (providerSlug, modelSlug) => {
      if (!providerSlug || !modelSlug) return;
      providers.push(entityHintFromSlug(providerSlug));
      models.push(entityHintFromSlug(modelSlug, `${providerSlug}/${modelSlug}`));
    };

    if (segments[0] === "compare") {
      for (let index = 1; index + 1 < segments.length; index += 2) {
        addPair(segments[index], segments[index + 1]);
      }
    } else if (segments[0] === "models" && segments.length >= 3) {
      addPair(segments[1], segments[2]);
    } else if (["provider", "providers"].includes(segments[0]) && segments[1]) {
      providers.push(entityHintFromSlug(segments[1]));
    } else if (isModelEntityPath(pathname)) {
      addPair(segments[0], segments[1]);
    } else if (isAuthorEntityPath(pathname)) {
      providers.push(entityHintFromSlug(segments[0]));
    }

    return Object.freeze({
      models: Object.freeze(models),
      providers: Object.freeze(providers),
    });
  }

  function registerRouteEntityHints(
    pathname,
    registry = PAGE_ENTITY_REGISTRY,
    source = "route",
  ) {
    const hints = extractEntityNamesFromPath(pathname);
    for (const provider of hints.providers) {
      registry.registerProvider(provider.displayName, {
        aliases: provider.aliases,
        canonicalId: provider.canonicalId,
        route: pathname,
        source,
      });
    }
    for (const model of hints.models) {
      registry.registerModel(model.displayName, {
        aliases: model.aliases,
        canonicalId: model.canonicalId,
        route: pathname,
        source,
      });
    }
    return hints;
  }

  function isKnownProviderName(value, registry = PAGE_ENTITY_REGISTRY) {
    const text = cleanEntityName(value).replace(/\s+provider$/i, "");
    return Boolean(text && registry.hasProvider(text));
  }

  function isKnownModelName(value, registry = PAGE_ENTITY_REGISTRY) {
    const text = cleanEntityName(value);
    if (!text || text.length > 160 || /[!?。！？]\s*$/.test(text)) return false;
    if (registry.hasModel(text)) return true;
    if (/^[a-z0-9_.~-]+\/[a-z0-9_.:~/-]+$/i.test(text)) return true;
    if (text.split(/\s+/).length > 8) return false;
    if (/\b(?:is|are|was|were|with|and|or|for|from|supports?|provides?|uses?)\b/i.test(text)) {
      return false;
    }
    return ENTITY_CATALOG.modelFamilies.some((family) => {
      const lowerText = text.toLocaleLowerCase();
      const lowerFamily = family.toLocaleLowerCase();
      if (lowerText === lowerFamily) return true;
      if (!lowerText.startsWith(lowerFamily)) return false;
      const suffix = text.slice(family.length);
      if (!/^(?:\s+|[-_.:+/])/.test(suffix)) return false;
      if (/\d/.test(suffix) || suffix.trim() === "+") return true;
      const variant = suffix
        .replace(/^[\s\-_.:+/]+/, "")
        .split(/\s+/, 1)[0]
        .toLocaleLowerCase();
      return MODEL_FAMILY_VARIANTS.has(variant);
    });
  }

  const PAGE_ENTITY_REGISTRY = createEntityRegistry();
