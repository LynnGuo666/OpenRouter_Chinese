  let settings = clampSettings(readValue(SETTINGS_KEY, DEFAULT_SETTINGS));
  let rates = null;
  let ratePromise = null;
  let rateGeneration = 0;
  let descriptionGeneration = 0;
  let routeKey = "";
  let observer = null;
  let scanFrame = 0;
  let translationPersistTimer = 0;
  let translationPersistIdle = 0;
  let descriptionWorkers = 0;
  let descriptionTaskId = 0;
  let recordCleanupTimer = 0;
  let lastRecordCleanupAt = 0;
  let recordsNeedCleanup = false;
  const pendingRoots = new Set();
  const priceRecords = new Map();
  const textRecords = new Map();
  const attributeRecords = new Map();
  const descriptionQueue = [];
  const descriptionPending = new Map();
  const attributePending = new Map();
  const translationInFlight = new Map();
  const storedTranslationCache = readValue(TRANSLATION_CACHE_KEY, {});
  const translationCache = sanitizeTranslationCache(storedTranslationCache);
  let translationCacheSize = Object.keys(translationCache).length;
  const panelRefs = {};

  if (Object.keys(translationCache).length !== Object.keys(storedTranslationCache || {}).length) {
    writeValue(TRANSLATION_CACHE_KEY, translationCache);
  }
