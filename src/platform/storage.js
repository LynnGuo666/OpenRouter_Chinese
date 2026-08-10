  function sanitizeTranslationCache(value) {
    if (!value || typeof value !== "object") return {};
    const prefix = `${TRANSLATION_SCHEMA_VERSION}:`;
    return Object.fromEntries(
      Object.entries(value).filter(
        ([key, entry]) =>
          key.startsWith(prefix) &&
          entry &&
          typeof entry === "object" &&
          typeof entry.translatedMasked === "string" &&
          Number.isFinite(Number(entry.lastUsed)),
      ),
    );
  }

  function readValue(key, fallback) {
    try {
      if (typeof GM_getValue === "function") return GM_getValue(key, fallback);
      const stored = global.localStorage?.getItem(key);
      return stored ? JSON.parse(stored) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeValue(key, value) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        return;
      }
      global.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      // 缓存失败不应影响页面原有功能。
    }
  }

