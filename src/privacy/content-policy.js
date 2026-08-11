  function isPublicContentPath(pathname) {
    const prefix = firstPathSegment(pathname);
    if (!prefix) return true;
    if (PRIVATE_CONTENT_PATH_PREFIXES.has(prefix)) return false;
    return PUBLIC_CONTENT_PATH_PREFIXES.has(prefix);
  }

  function isCredentialText(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    return (
      /\bsk-[A-Za-z0-9_-]{12,}\b/.test(text) ||
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(text) ||
      /\b[A-Fa-f0-9]{32,}\b/.test(text) ||
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(
        text,
      ) ||
      /__ORL_P\d+__/.test(text) ||
      /\bauthorization\s*:\s*bearer\s+\S+/i.test(text) ||
      /\b(?:api[_ -]?key|password|secret|private[_ -]?key)\s*[:=]\s*["']?(?!your\b|the\b|a\b|an\b|<)[A-Za-z0-9_./+~-]{8,}/i.test(
        text,
      ) ||
      /^(?:export\s+)?[A-Z][A-Z0-9_]{2,}\s*=\s*\S+/m.test(text)
    );
  }

  function hasPrivateIdentifier(value) {
    const text = String(value || "");
    return (
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(
        text,
      )
    );
  }

  function isSensitiveText(value) {
    return isCredentialText(value) || hasPrivateIdentifier(value);
  }

  function shouldTranslateOnlineText(value, options = {}) {
    const text = String(value || "").trim();
    if (text.length < 2) return false;
    if (!options.publicContent) return false;
    if (isCredentialText(text)) return false;
    if (PROTECTED_LABELS.has(text) || isKnownProviderName(text) || isKnownModelName(text)) {
      return false;
    }
    if (/^©\s*\d{4}\s+OpenRouter\b/i.test(text)) return false;
    if (/^(?:[$¥€£]\s*)?[\d.,+\-/%]+(?:\s*[KMBT])?$/.test(text)) return false;
    if (/^(?:\s*[$¥]\s*[\d,.]+(?:\s*[KMBT])?\s*)+$/.test(text)) return false;
    const displayedPrice = parseDisplayedPrice(text);
    if (displayedPrice && displayedPrice.matchedText.trim() === text) return false;
    if (/^[\d,.]+\s*(?:ms|s|tps|tok\/s|tokens?\/s)$/i.test(text)) return false;
    if (/^(?:https?:\/\/|mailto:|tel:)/i.test(text)) return false;
    if (/^[A-Z][A-Z0-9_.+-]{1,15}$/.test(text)) return false;
    if (/^[\w.-]+@[\w.-]+$/.test(text)) return false;
    if (/^[a-z0-9_.~-]+\/[a-z0-9_.:~/-]+$/i.test(text)) return false;
    const unprotectedText = maskProtectedTranslationText(text).masked.replace(/__ORL_P\d+__/g, "");
    return (unprotectedText.match(/[A-Za-z]/g) || []).length >= 2;
  }

  function splitTranslationText(value, limit = TRANSLATION_CHUNK_LIMIT) {
    const text = String(value || "").trim();
    if (!text) return [];
    const safeLimit = Math.max(100, Number(limit) || TRANSLATION_CHUNK_LIMIT);
    const chunks = [];
    let remaining = text;

    while (remaining.length > safeLimit) {
      const window = remaining.slice(0, safeLimit);
      let boundary = -1;
      for (const pattern of [/[.!?]["')\]]?\s+(?=[A-Z0-9])/g, /[;:]\s+/g, /\s+/g]) {
        for (const match of window.matchAll(pattern)) boundary = match.index + match[0].length;
        if (boundary >= Math.floor(safeLimit * 0.55)) break;
        boundary = -1;
      }
      if (boundary < 1) boundary = safeLimit;
      const markerStart = remaining.lastIndexOf("__ORL_P", boundary - 1);
      if (markerStart >= 0) {
        const markerEnd = remaining.indexOf("__", markerStart + 7);
        if (markerStart < boundary && markerEnd + 2 > boundary) {
          boundary = markerStart > 0 ? markerStart : markerEnd + 2;
        }
      }
      const previousCodeUnit = remaining.charCodeAt(boundary - 1);
      const nextCodeUnit = remaining.charCodeAt(boundary);
      if (
        previousCodeUnit >= 0xd800 &&
        previousCodeUnit <= 0xdbff &&
        nextCodeUnit >= 0xdc00 &&
        nextCodeUnit <= 0xdfff
      ) {
        boundary -= 1;
      }
      chunks.push(remaining.slice(0, boundary));
      remaining = remaining.slice(boundary);
    }
    if (remaining) chunks.push(remaining);
    return chunks.filter((chunk) => chunk.length > 0);
  }

  function maskProtectedTranslationText(value, additionalEntities = []) {
    const entities = [];
    const text = String(value);
    const dynamicEntities = [...new Set(additionalEntities)]
      .map((entity) => String(entity || "").trim())
      .filter(
        (entity) =>
          entity.length >= 2 && text.toLocaleLowerCase().includes(entity.toLocaleLowerCase()),
      )
      .sort((left, right) => right.length - left.length)
      .slice(0, 16);
    const protectedPattern = dynamicEntities.length
      ? new RegExp(
          [
            ...dynamicEntities.map((entity) =>
              entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            ),
            PROTECTED_TRANSLATION_PATTERN.source,
          ].join("|"),
          "gi",
        )
      : PROTECTED_TRANSLATION_PATTERN;
    const protect = (match) => {
      const marker = `__ORL_P${entities.length}__`;
      entities.push({ marker, value: match });
      return marker;
    };
    const masked = text.replace(protectedPattern, protect).replace(PROTECTED_HTTP_METHOD_PATTERN, protect);
    return { masked, entities };
  }

  function restoreProtectedTranslationText(value, entities) {
    let restored = String(value);
    for (const entity of entities || []) {
      if (restored.split(entity.marker).length !== 2) return null;
      restored = restored.replace(entity.marker, entity.value);
    }
    if (/__ORL_P\d+__/.test(restored)) return null;
    return restored;
  }
