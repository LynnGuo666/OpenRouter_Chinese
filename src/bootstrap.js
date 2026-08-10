// 此文件由 npm run build 从 src/ 生成，请勿直接编辑发布产物。

(function openRouterZhCny(global) {
  "use strict";

  const VERSION = "__VERSION__";
  const SETTINGS_KEY = "orl:settings:v1";
  const RATE_CACHE_KEY = "orl:rates:v1";
  const RATE_ATTEMPT_KEY = "orl:rates:last-attempt:v1";
  const TRANSLATION_CACHE_KEY = "orl:translations:v1";
  const RATE_TTL_MS = 30 * 60 * 1000;
  const RATE_MAX_STALE_MS = 72 * 60 * 60 * 1000;
  const RATE_RETRY_COOLDOWN_MS = 60 * 1000;
  const TRANSLATION_CACHE_LIMIT = 5000;
  const TRANSLATION_SCHEMA_VERSION = 7;
  const CONTENT_WORKER_LIMIT = 3;
  const CONTENT_TRANSLATION_RETRY_LIMIT = 2;
  const TRANSLATION_CHUNK_LIMIT = 900;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    translateUi: true,
    translateContent: true,
    showCny: true,
    rateMode: "yahoo",
    manualUsdCny: 7.2,
    manualUsdcUsd: 1,
  });
