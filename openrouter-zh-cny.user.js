// ==UserScript==
// @name         OpenRouter 中文与人民币价格
// @namespace    openrouter-zh-cny
// @version      0.2.0
// @description  为 OpenRouter 模型页补充中文界面与人民币估价
// @author       OpenRouterLite
// @match        https://openrouter.ai/models*
// @match        https://openrouter.ai/compare*
// @match        https://openrouter.ai/*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      query1.finance.yahoo.com
// @connect      api.frankfurter.dev
// @connect      translate.googleapis.com
// ==/UserScript==

(function openRouterZhCny(global) {
  "use strict";

  const VERSION = "0.2.0";
  const SETTINGS_KEY = "orl:settings:v1";
  const RATE_CACHE_KEY = "orl:rates:v1";
  const RATE_ATTEMPT_KEY = "orl:rates:last-attempt:v1";
  const TRANSLATION_CACHE_KEY = "orl:translations:v1";
  const RATE_TTL_MS = 30 * 60 * 1000;
  const RATE_MAX_STALE_MS = 72 * 60 * 60 * 1000;
  const RATE_RETRY_COOLDOWN_MS = 60 * 1000;
  const TRANSLATION_CACHE_LIMIT = 400;
  const TRANSLATION_SCHEMA_VERSION = 1;
  const CONTENT_QUEUE_LIMIT = 80;
  const CONTENT_CHARACTER_BUDGET = 30_000;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    translateUi: true,
    translateContent: true,
    showCny: true,
    rateMode: "yahoo",
    manualUsdCny: 7.2,
    manualUsdcUsd: 1,
  });

  const EXCLUDED_PATH_PREFIXES = new Set([
    "about",
    "activity",
    "api",
    "apps",
    "careers",
    "chat",
    "credits",
    "data",
    "docs",
    "enterprise",
    "fusion",
    "keys",
    "privacy",
    "providers",
    "rankings",
    "sdk",
    "settings",
    "support",
    "terms",
  ]);

  const UI_TRANSLATION_MODULES = Object.freeze({
    navigation: Object.freeze({
      Search: "搜索",
      Models: "模型",
      Fusion: "融合",
      Chat: "对话",
      Rankings: "排行榜",
      Apps: "应用",
      Docs: "文档",
      "Sign Up": "注册",
      Compare: "对比",
      Home: "首页",
      Documentation: "文档",
      "API Reference": "API 参考",
      "Skip to content": "跳到正文",
      "Get API Key": "获取 API 密钥",
      "Model weights": "模型权重",
    }),
    catalog: Object.freeze({
      Model: "模型",
      "Discover Models": "发现模型",
      Newest: "最新",
      "Sort by": "排序",
      Filters: "筛选",
      "Clear filters": "清除筛选",
      "Most popular": "最受欢迎",
      Trending: "热门趋势",
      List: "列表",
      Table: "表格",
      All: "全部",
      Text: "文本",
      Image: "图片",
      File: "文件",
      Audio: "音频",
      Video: "视频",
      Embeddings: "嵌入",
      Rerank: "重排序",
      Speech: "语音",
      Transcription: "转录",
      "Input Modalities": "输入模态",
      "Context length": "上下文长度",
      "Prompt pricing": "输入价格",
      "Output pricing": "输出价格",
      Series: "系列",
      Categories: "类别",
      "Supported Parameters": "支持的参数",
      Distillable: "可蒸馏",
      "Zero Data Retention": "零数据保留",
      "In-Region Routing": "区域内路由",
      "Model age": "模型发布时间",
      "Tool Calling": "工具调用",
      "Inactive Models": "非活跃模型",
      "Model Authors": "模型作者",
      Architecture: "架构",
      Tokenizer: "分词器",
      "Max output": "最大输出",
      "Knowledge cutoff": "知识截止时间",
      Moderated: "内容审核",
      "No results": "无结果",
      "Search models...": "搜索模型...",
      by: "来自",
    }),
    details: Object.freeze({
      Providers: "供应商",
      Playground: "试用",
      "Try this model": "试用此模型",
      Modalities: "模态",
      Price: "价格",
      Free: "免费",
      Context: "上下文",
      Released: "发布时间",
      "Effective Pricing": "有效价格",
      "Weighted Average": "加权平均",
      "Weighted Avg Input Price": "加权平均输入价格",
      "Weighted Avg Output Price": "加权平均输出价格",
      "per 1M": "每百万",
      "More models from": "更多模型，来自",
    }),
    providers: Object.freeze({
      Provider: "供应商",
      Input: "输入",
      Output: "输出",
      "In / Out Price": "输入 / 输出价格",
      "Input Price": "输入价格",
      "Output Price": "输出价格",
      "Input /M": "输入 / 百万",
      "Output /M": "输出 / 百万",
      "Cache Read": "缓存读取",
      "Cache read": "缓存读取",
      "Cache read /M": "缓存读取 / 百万",
      Standard: "标准",
      Balanced: "均衡",
      Nitro: "极速",
      Exacto: "精准",
      "Latency / throughput": "延迟 / 吞吐量",
      "Filter quantization": "筛选量化类型",
      Quantization: "量化",
      Region: "地区",
      "Data Policy": "数据策略",
      "Prompt Training": "提示词训练",
      "Prompt Logging": "提示词日志",
      "Retains Prompts": "保留提示词",
      Healthy: "正常",
      Degraded: "性能下降",
      Unavailable: "不可用",
      "Supports Tools": "支持工具调用",
      "% off": "% 优惠",
      "Not routable": "不可路由",
      Private: "私密",
      Logs: "记录日志",
      Trains: "用于训练",
      "All locations": "全部地区",
    }),
    metrics: Object.freeze({
      Performance: "性能",
      Uptime: "可用率",
      Activity: "使用趋势",
      FAQ: "常见问题",
      Benchmarks: "基准测试",
      Latency: "延迟",
      Throughput: "吞吐量",
      "E2E Latency": "端到端延迟",
      "Tool Call Error Rate": "工具调用错误率",
      "Structured Output Error Rate": "结构化输出错误率",
      "Cache Hit Rate": "缓存命中率",
      "Cache hit rate": "缓存命中率",
      "Token share 1d": "令牌占比（1 天）",
      "Token share": "令牌占比",
      "Token Volume": "令牌用量",
      Requests: "请求数",
      "Input Tokens": "输入令牌",
      "Output Tokens": "输出令牌",
      "Time to First Token": "首字延迟",
      "Tokens per second": "每秒令牌数",
      Median: "中位数",
      "Success Rate": "成功率",
      "Error Rate": "错误率",
      "No data": "暂无数据",
      "30 days": "30 天",
      "Category Performance": "分类表现",
      "Ranking Distribution": "排名分布",
      "Expand chart": "展开图表",
      First: "第一",
      Second: "第二",
      Third: "第三",
      Fourth: "第四",
      Rank: "排名",
      Average: "平均",
      Avg: "平均",
      "1 week": "1 周",
      "1d": "1 天",
      Tokens: "令牌",
      Prompt: "输入",
      Reasoning: "推理",
      Completion: "输出",
      "Frequently asked questions": "常见问题",
    }),
    footer: Object.freeze({
      Product: "产品",
      Providers: "供应商",
      Company: "公司",
      Developer: "开发者",
      Connect: "关注我们",
      Pricing: "定价",
      Enterprise: "企业服务",
      Labs: "实验室",
      About: "关于",
      Blog: "博客",
      Careers: "招聘",
      Discover: "发现",
      Hiring: "招聘中",
      "Works With OR": "与 OpenRouter 集成",
      Data: "数据",
      Privacy: "隐私",
      "Terms of Service": "服务条款",
      Support: "支持",
      Status: "状态",
    }),
    accessibility: Object.freeze({
      Dismiss: "关闭",
      "Open account navigation": "打开账户菜单",
      "Latency / throughput percentile": "延迟 / 吞吐量百分位",
      "(opens in new tab)": "（在新标签页打开）",
      "List view": "列表视图",
      "Table view": "表格视图",
      "Video generated in the last 7 days": "最近 7 天生成的视频",
      "Tokens processed in the last 7 days": "最近 7 天处理的令牌",
      "Characters transcribed in the last 7 days": "最近 7 天转录的字符",
      "Copy to clipboard": "复制到剪贴板",
      "Previous slide": "上一项",
      "Next slide": "下一项",
    }),
  });

  const UI_DICTIONARY = new Map(
    Object.values(UI_TRANSLATION_MODULES).flatMap((module) => Object.entries(module)),
  );
  const UI_TRANSLATION_MODULE_LOOKUPS = Object.freeze(
    Object.fromEntries(
      Object.entries(UI_TRANSLATION_MODULES).map(([name, module]) => [
        name,
        new Map(Object.entries(module).map(([key, value]) => [key.toLocaleLowerCase(), value])),
      ]),
    ),
  );

  const UI_TRANSLATION_TEMPLATES = Object.freeze([
    {
      pattern: /^More models from\s+(.+)$/i,
      render: ([, provider]) => `更多来自 ${provider} 的模型`,
    },
    {
      pattern: /^What is\s+(.+)\?$/i,
      render: ([, subject]) => `${subject} 是什么？`,
    },
    {
      pattern: /^How much does\s+(.+)\s+cost\?$/i,
      render: ([, subject]) => `${subject} 的价格是多少？`,
    },
    {
      pattern: /^What is the context length of\s+(.+)\?$/i,
      render: ([, subject]) => `${subject} 的上下文长度是多少？`,
    },
    {
      pattern: /^Does\s+(.+)\s+support tool calling(?: and structured outputs)?\?$/i,
      render: ([, subject]) => `${subject} 支持工具调用和结构化输出吗？`,
    },
    {
      pattern: /^Which providers (?:serve|offer)\s+(.+)\?$/i,
      render: ([, subject]) => `哪些供应商提供 ${subject}？`,
    },
    {
      pattern: /^When was\s+(.+)\s+released\?$/i,
      render: ([, subject]) => `${subject} 是什么时候发布的？`,
    },
    {
      pattern: /^(\d+(?:\.\d+)?)\s*%\s*off$/i,
      render: ([, amount]) => `优惠 ${amount}%`,
    },
    {
      pattern: /^(\d+)\s+more providers$/i,
      render: ([, amount]) => `还有 ${amount} 个供应商`,
    },
    {
      pattern: /^(\d+(?:\.\d+)?[KMBT]?)\s+(requests?|tokens?|characters?)$/i,
      render: ([, amount, unit]) => {
        const normalized = unit.toLowerCase();
        if (normalized.startsWith("request")) return `${amount} 次请求`;
        if (normalized.startsWith("character")) return `${amount} 字符`;
        return `${amount} 令牌`;
      },
    },
    {
      pattern: /^Open\s+(.+)\s+details$/i,
      render: ([, subject]) => `打开 ${subject} 详情`,
    },
    {
      pattern: /^Privacy:\s*(Private|Logs|Trains)$/i,
      render: ([, policy]) => `隐私：${UI_TRANSLATION_MODULES.providers[policy] || policy}`,
    },
    {
      pattern: /^Top\s+(\d+(?:\.\d+)?)\s*%$/i,
      render: ([, amount]) => `前 ${amount}%`,
    },
  ]);

  const UNIT_LABELS = Object.freeze({
    "m input tokens": "百万输入令牌",
    "m output tokens": "百万输出令牌",
    "m tokens": "百万令牌",
    "k input tokens": "千输入令牌",
    "k output tokens": "千输出令牌",
    "k tokens": "千令牌",
    "1k input tokens": "千输入令牌",
    "1k output tokens": "千输出令牌",
    "1k tokens": "千令牌",
    "input token": "输入令牌",
    "input tokens": "输入令牌",
    "output token": "输出令牌",
    "output tokens": "输出令牌",
    token: "令牌",
    tokens: "令牌",
    second: "秒",
    seconds: "秒",
    minute: "分钟",
    minutes: "分钟",
    hour: "小时",
    hours: "小时",
    image: "张图片",
    images: "张图片",
    request: "次请求",
    requests: "次请求",
    generation: "次生成",
    generations: "次生成",
    "web search": "次联网搜索",
    "web searches": "次联网搜索",
    character: "字符",
    characters: "字符",
  });

  const PRICE_PATTERN = /(?:from\s+)?\$\s*([\d,]+(?:\.\d+)?)(?:\s*\/\s*(M\s+(?:input\s+|output\s+)?tokens?|1?K\s+(?:input\s+|output\s+)?tokens?|(?:input\s+|output\s+)?tokens?|seconds?|minutes?|hours?|images?|requests?|generations?|web\s+search(?:es)?|characters?))?/i;

  function clampSettings(value) {
    const candidate = value && typeof value === "object" ? value : {};
    const manualUsdCny = Number(candidate.manualUsdCny);
    const manualUsdcUsd = Number(candidate.manualUsdcUsd);

    const booleanSetting = (key) =>
      typeof candidate[key] === "boolean" ? candidate[key] : DEFAULT_SETTINGS[key];

    return {
      ...DEFAULT_SETTINGS,
      ...candidate,
      enabled: booleanSetting("enabled"),
      translateUi: booleanSetting("translateUi"),
      translateContent: booleanSetting("translateContent"),
      showCny: booleanSetting("showCny"),
      rateMode: candidate.rateMode === "manual" ? "manual" : "yahoo",
      manualUsdCny:
        Number.isFinite(manualUsdCny) && manualUsdCny >= 1 && manualUsdCny <= 20
          ? manualUsdCny
          : DEFAULT_SETTINGS.manualUsdCny,
      manualUsdcUsd:
        Number.isFinite(manualUsdcUsd) && manualUsdcUsd >= 0.5 && manualUsdcUsd <= 1.5
          ? manualUsdcUsd
          : DEFAULT_SETTINGS.manualUsdcUsd,
    };
  }

  function isTargetPath(pathname) {
    if (pathname === "/models" || pathname.startsWith("/models/")) return true;
    if (pathname === "/compare" || pathname.startsWith("/compare/")) return true;

    const segments = pathname.split("/").filter(Boolean);
    return segments.length === 2 && !EXCLUDED_PATH_PREFIXES.has(segments[0]);
  }

  function parseDisplayedPrice(text) {
    if (typeof text !== "string" || text.length > 160) return null;
    const match = text.match(PRICE_PATTERN);
    if (!match) return null;
    if (match.index > 0 && /[-A-Za-z_]/.test(text[match.index - 1])) return null;
    const nextCharacter = text.slice(match.index + match[0].length).trimStart()[0];
    if (nextCharacter === "/") return null;

    const amount = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount < 0) return null;

    const rawUnit = (match[2] || "").replace(/\s+/g, " ").trim();
    const normalizedUnit = rawUnit.toLowerCase();
    return {
      amount,
      rawUnit,
      unitZh: UNIT_LABELS[normalizedUnit] || rawUnit,
      matchedText: match[0],
      index: match.index || 0,
      isFrom: /^from\s+/i.test(match[0]),
    };
  }

  function decimalPlacesFor(value) {
    const absolute = Math.abs(value);
    if (absolute === 0) return 0;
    if (absolute >= 100) return 2;
    if (absolute >= 1) return 3;
    if (absolute >= 0.01) return 4;
    if (absolute >= 0.0001) return 6;
    return 8;
  }

  function formatNumber(value, maximumFractionDigits = decimalPlacesFor(value)) {
    if (!Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits,
      minimumFractionDigits: 0,
      useGrouping: true,
    }).format(value);
  }

  function calculatePriceQuote(usdAmount, rates) {
    if (!Number.isFinite(usdAmount) || usdAmount < 0 || !rates) return null;
    const usdCny = Number(rates.usdCny);
    const usdcUsd = Number(rates.usdcUsd);
    const cny = Number.isFinite(usdCny) && usdCny > 0 ? usdAmount * usdCny : null;
    const usdc = Number.isFinite(usdcUsd) && usdcUsd > 0 ? usdAmount / usdcUsd : null;
    const usdcCny =
      Number.isFinite(usdCny) && usdCny > 0 && Number.isFinite(usdcUsd) && usdcUsd > 0
        ? usdCny * usdcUsd
        : null;

    return { cny, usdc, usdcCny };
  }

  function formatCnyBadgeText(quotes) {
    const values = quotes
      .filter((quote) => Number.isFinite(quote?.cny))
      .map((quote) => `¥${formatNumber(quote.cny)}`);
    return values.length ? ` · ${values.join(" / ")}` : "";
  }

  function parseYahooChart(payload, symbol) {
    const result = payload?.chart?.result?.[0];
    if (!result || payload?.chart?.error) return null;

    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const closes = result.indicators?.quote?.[0]?.close;
    let price = Number(result.meta?.regularMarketPrice);
    let timestamp = Number(result.meta?.regularMarketTime) * 1000;

    if (!Number.isFinite(price) && Array.isArray(closes)) {
      for (let index = closes.length - 1; index >= 0; index -= 1) {
        const close = Number(closes[index]);
        if (Number.isFinite(close)) {
          price = close;
          timestamp = Number(timestamps[index]) * 1000;
          break;
        }
      }
    }

    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      symbol: result.meta?.symbol || symbol,
      price,
      currency: result.meta?.currency || null,
      asOf: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    };
  }

  function parseFrankfurterRate(payload) {
    const direct = Number(payload?.rate);
    const legacy = Number(payload?.rates?.CNY);
    const rate = Number.isFinite(direct) ? direct : legacy;
    if (!Number.isFinite(rate) || rate < 1 || rate > 20) return null;
    return {
      price: rate,
      asOf: payload?.date ? Date.parse(`${payload.date}T00:00:00Z`) : Date.now(),
    };
  }

  const Core = Object.freeze({
    UI_TRANSLATION_MODULES,
    calculatePriceQuote,
    clampSettings,
    formatCnyBadgeText,
    formatNumber,
    isTargetPath,
    parseDisplayedPrice,
    parseDisplayedPrices,
    parseFrankfurterRate,
    parseYahooChart,
    translateStaticValue,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  }

  if (typeof window === "undefined" || typeof document === "undefined") return;

  let settings = clampSettings(readValue(SETTINGS_KEY, DEFAULT_SETTINGS));
  let rates = null;
  let ratePromise = null;
  let rateGeneration = 0;
  let descriptionGeneration = 0;
  let routeKey = "";
  let observer = null;
  let scanFrame = 0;
  let translationPersistTimer = 0;
  let descriptionWorkers = 0;
  let descriptionTaskId = 0;
  let contentBudgetRoute = "";
  let contentBudgetCount = 0;
  let contentBudgetCharacters = 0;
  const pendingRoots = new Set();
  const priceBadges = new Map();
  const uiTextRecords = new Map();
  const attributeRecords = new Map();
  const descriptionRecords = new Map();
  const descriptionQueue = [];
  const descriptionPending = new Map();
  const translationInFlight = new Map();
  const translationCache = readValue(TRANSLATION_CACHE_KEY, {});
  const panelRefs = {};

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

  function requestJson(url, timeout = 8000) {
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout,
          anonymous: true,
          headers: { Accept: "application/json" },
          onload(response) {
            if (response.status < 200 || response.status >= 300) {
              reject(new Error(`HTTP ${response.status}`));
              return;
            }
            try {
              resolve(JSON.parse(response.responseText));
            } catch {
              reject(new Error("JSON 响应无效"));
            }
          },
          onerror: () => reject(new Error("网络请求失败")),
          ontimeout: () => reject(new Error("网络请求超时")),
        });
      });
    }

    return fetch(url, { headers: { Accept: "application/json" } }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  async function fetchYahooQuote(symbol, interval, range) {
    const encoded = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${interval}&range=${range}`;
    const payload = await requestJson(url);
    const quote = parseYahooChart(payload, symbol);
    if (!quote) throw new Error(`Yahoo ${symbol} 行情无效`);
    const normalizedSymbol = String(quote.symbol || "").toUpperCase();
    if (normalizedSymbol !== symbol.toUpperCase()) {
      throw new Error(`Yahoo 返回了错误标的：${quote.symbol || "unknown"}`);
    }
    const age = Date.now() - quote.asOf;
    const isFiat = symbol === "CNY=X";
    const inRange = isFiat
      ? quote.price >= 1 && quote.price <= 20
      : quote.price >= 0.5 && quote.price <= 1.5;
    const maxAge = isFiat ? 7 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
    if (!inRange || age < -5 * 60 * 1000 || age > maxAge) {
      throw new Error(`Yahoo ${symbol} 行情越界或过期`);
    }
    return quote;
  }

  async function fetchFrankfurterUsdCny() {
    const payload = await requestJson("https://api.frankfurter.dev/v2/rate/USD/CNY");
    const quote = parseFrankfurterRate(payload);
    if (!quote) throw new Error("Frankfurter 汇率无效");
    return quote;
  }

  function manualRates() {
    const now = Date.now();
    return {
      usdCny: settings.manualUsdCny,
      usdcUsd: settings.manualUsdcUsd,
      usdcCny: settings.manualUsdCny * settings.manualUsdcUsd,
      source: "手动汇率",
      usdcSource: "手动汇率",
      asOf: now,
      usdcAsOf: now,
      fetchedAt: now,
      usdFetchedAt: now,
      usdcFetchedAt: now,
      checkedAt: now,
      status: "manual",
      usdcStatus: "manual",
    };
  }

  function normalizeCachedRates(candidate, now = Date.now()) {
    if (!candidate || typeof candidate !== "object") return null;
    const usdCny = Number(candidate.usdCny);
    const usdcUsd = Number(candidate.usdcUsd);
    const usdFetchedAt = Number(candidate.usdFetchedAt || candidate.fetchedAt);
    const usdcFetchedAt = Number(candidate.usdcFetchedAt || candidate.fetchedAt);
    if (!Number.isFinite(usdCny) || usdCny < 1 || usdCny > 20) return null;
    if (!Number.isFinite(usdcUsd) || usdcUsd < 0.5 || usdcUsd > 1.5) return null;
    if (!Number.isFinite(usdFetchedAt) || now - usdFetchedAt > RATE_MAX_STALE_MS) return null;
    const usdcIsFresh = Number.isFinite(usdcFetchedAt) && now - usdcFetchedAt <= 60 * 60 * 1000;
    const effectiveUsdcUsd = usdcIsFresh ? usdcUsd : 1;
    return {
      ...candidate,
      usdCny,
      usdcUsd: effectiveUsdcUsd,
      usdcCny: usdCny * effectiveUsdcUsd,
      fetchedAt: usdFetchedAt,
      usdFetchedAt,
      usdcFetchedAt,
      status: now - usdFetchedAt > RATE_TTL_MS ? "stale" : candidate.status || "live",
      usdcStatus: usdcIsFresh ? candidate.usdcStatus || "live" : "peg-assumption",
      usdcSource: usdcIsFresh ? candidate.usdcSource || "Yahoo Finance 推导" : "1 USDC≈1 USD 锚定估算",
    };
  }

  async function loadRates({ force = false } = {}) {
    if (settings.rateMode === "manual") {
      rateGeneration += 1;
      ratePromise = null;
      rates = manualRates();
      refreshPanel();
      scheduleFullScan();
      return rates;
    }

    const now = Date.now();
    const cached = normalizeCachedRates(readValue(RATE_CACHE_KEY, null), now);
    if (!force && cached && now - cached.usdFetchedAt < RATE_TTL_MS) {
      rates = cached;
      refreshPanel();
      scheduleFullScan();
      return cached;
    }

    const lastAttempt = Number(readValue(RATE_ATTEMPT_KEY, 0));
    if (!force && now - lastAttempt < RATE_RETRY_COOLDOWN_MS) {
      rates = cached;
      refreshPanel();
      scheduleFullScan();
      return cached;
    }

    if (ratePromise) return ratePromise;
    const generation = ++rateGeneration;
    writeValue(RATE_ATTEMPT_KEY, now);
    setRateStatus("正在更新 Yahoo 行情...");

    const activePromise = (async () => {
      const [fiatResult, usdcResult] = await Promise.allSettled([
        fetchYahooQuote("CNY=X", "1d", "5d"),
        fetchYahooQuote("USDC-USD", "5m", "1d"),
      ]);

      let usdCnyQuote = fiatResult.status === "fulfilled" ? fiatResult.value : null;
      let usdcUsdQuote = usdcResult.status === "fulfilled" ? usdcResult.value : null;
      let source = "Yahoo Finance";
      let status = "live";
      let usdcStatus = "live";
      let usdFetchedAt = now;
      let usdcFetchedAt = now;

      if (!usdCnyQuote) {
        try {
          usdCnyQuote = await fetchFrankfurterUsdCny();
          source = "Frankfurter 回退";
          status = "fallback";
        } catch {
          usdCnyQuote = cached
            ? { price: cached.usdCny, asOf: cached.asOf || cached.usdFetchedAt }
            : null;
          usdFetchedAt = cached?.usdFetchedAt || 0;
          source = cached?.source || "无可用汇率";
          status = cached ? "stale" : "unavailable";
        }
      }

      if (!usdcUsdQuote) {
        if (
          cached &&
          cached.usdcStatus !== "peg-assumption" &&
          now - cached.usdcFetchedAt <= 60 * 60 * 1000
        ) {
          usdcUsdQuote = { price: cached.usdcUsd, asOf: cached.usdcAsOf || cached.usdcFetchedAt };
          usdcFetchedAt = cached.usdcFetchedAt;
          usdcStatus = "stale";
        } else {
          usdcUsdQuote = { price: 1, asOf: now };
          usdcStatus = "peg-assumption";
        }
      }

      if (!usdCnyQuote) {
        if (generation !== rateGeneration || settings.rateMode !== "yahoo") return rates;
        rates = null;
        restorePrices();
        refreshPanel();
        setRateStatus("暂无可用汇率，仅显示官方美元价");
        scheduleFullScan();
        return null;
      }

      const nextRates = {
        usdCny: usdCnyQuote.price,
        usdcUsd: usdcUsdQuote.price,
        usdcCny: usdCnyQuote.price * usdcUsdQuote.price,
        source,
        usdcSource:
          usdcStatus === "live"
            ? "Yahoo Finance 推导"
            : usdcStatus === "stale"
              ? "Yahoo Finance 缓存"
              : "1 USDC≈1 USD 锚定估算",
        asOf: usdCnyQuote.asOf,
        usdcAsOf: usdcUsdQuote.asOf,
        fetchedAt: usdFetchedAt,
        usdFetchedAt,
        usdcFetchedAt,
        checkedAt: now,
        status,
        usdcStatus,
      };

      if (generation !== rateGeneration || settings.rateMode !== "yahoo") return rates;
      rates = nextRates;
      writeValue(RATE_CACHE_KEY, nextRates);
      refreshPanel();
      scheduleFullScan();
      return nextRates;
    })();
    let wrappedPromise;
    wrappedPromise = activePromise.finally(() => {
      if (ratePromise === wrappedPromise) ratePromise = null;
    });
    ratePromise = wrappedPromise;

    return ratePromise;
  }

  function translateStaticValue(value, moduleNames = null) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (moduleNames) {
      for (const moduleName of moduleNames) {
        const translated = UI_TRANSLATION_MODULE_LOOKUPS[moduleName]?.get(trimmed.toLocaleLowerCase());
        if (translated) return translated;
      }
    } else if (UI_DICTIONARY.has(trimmed)) {
      return UI_DICTIONARY.get(trimmed);
    }

    for (const template of UI_TRANSLATION_TEMPLATES) {
      const match = trimmed.match(template.pattern);
      if (match) return template.render(match);
    }

    const contextMatch = trimmed.match(/^([\d.]+\s*[KMB]?)\s+context$/i);
    if (contextMatch) return `${contextMatch[1]} 上下文`;

    const durationMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+(seconds?|minutes?|hours?|days?)$/i);
    if (durationMatch) {
      const unit = {
        second: "秒",
        seconds: "秒",
        minute: "分钟",
        minutes: "分钟",
        hour: "小时",
        hours: "小时",
        day: "天",
        days: "天",
      }[durationMatch[2].toLowerCase()];
      return `${durationMatch[1]} ${unit}`;
    }

    const agoMatch = trimmed.match(/^(\d+)\s+(minutes?|hours?|days?)\s+ago$/i);
    if (agoMatch) {
      const unit = agoMatch[2].toLowerCase().startsWith("minute")
        ? "分钟前"
        : agoMatch[2].toLowerCase().startsWith("hour")
          ? "小时前"
          : "天前";
      return `${agoMatch[1]} ${unit}`;
    }

    return null;
  }

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

  function translationModuleNamesForElement(element) {
    if (!element) return [];
    if (element.closest("footer")) return ["footer", "navigation", "accessibility"];
    if (element.closest("main")) {
      if (location.pathname === "/models" || location.pathname.startsWith("/models/")) {
        return ["catalog", "details", "navigation", "accessibility"];
      }
      return ["details", "providers", "metrics", "catalog", "navigation", "accessibility"];
    }
    if (element.closest("nav")) return ["navigation", "accessibility"];
    return ["footer", "navigation", "accessibility"];
  }

  function isProtectedEntityNode(element) {
    const linkedEntity = element?.closest("main li a[href]");
    if (linkedEntity) {
      try {
        const segments = new URL(linkedEntity.href, location.origin).pathname.split("/").filter(Boolean);
        if (segments.length === 2 && segments[0] !== "models") return true;
      } catch {
        // 无效链接交给普通词典处理。
      }
    }
    return Boolean(
      element?.closest(
        [
          '[data-testid="model-list-item"] a[href]',
          "#model-title-row h1",
          "#model-title-row h2",
          "#model-title-row h3",
          "#providers tbody td:first-child button",
          "main table tbody td:first-child button",
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

  function translateTextNode(node) {
    if (shouldSkipNode(node)) return;
    if (isProtectedEntityNode(node.parentElement)) return;
    const existing = uiTextRecords.get(node);
    if (existing) {
      if (!settings.enabled || !settings.translateUi) {
        if (node.nodeValue === existing.rendered) node.nodeValue = existing.original;
        uiTextRecords.delete(node);
        return;
      }
      if (node.nodeValue === existing.rendered) return;
    }

    if (!settings.enabled || !settings.translateUi) return;
    const original = existing?.original || node.nodeValue;
    const translated = translateStaticValue(
      original,
      translationModuleNamesForElement(node.parentElement),
    );
    if (!translated || translated === original.trim()) return;
    const rendered = preserveWhitespace(original, translated);
    uiTextRecords.set(node, { original, rendered });
    node.nodeValue = rendered;
  }

  function translateAttributes(root) {
    const selector = "[placeholder], [aria-label], [title]";
    const elements = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) elements.push(root);
    elements.push(...(root.querySelectorAll?.(selector) || []));

    for (const element of elements) {
      if (element.closest("[data-orl-owned]")) continue;
      let records = attributeRecords.get(element);

      for (const attribute of ["placeholder", "aria-label", "title"]) {
        const current = element.getAttribute(attribute);
        const prior = records?.[attribute];
        if (!settings.enabled || !settings.translateUi) {
          if (prior && current === prior.rendered) element.setAttribute(attribute, prior.original);
          continue;
        }

        const original = prior?.original || current;
        if (!original || (prior && current === prior.rendered)) continue;
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

  function scanStaticTranslations(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) translateTextNode(node);
    translateAttributes(root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement || document.body);
  }

  function parseDisplayedPrices(text) {
    const dollarMatches = [...text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)];
    if (dollarMatches.length <= 1) {
      const parsed = parseDisplayedPrice(text);
      return parsed ? [parsed] : [];
    }

    return dollarMatches.flatMap((match) => {
      if (match.index > 0 && /[-A-Za-z_]/.test(text[match.index - 1])) return [];
      const amount = Number(match[1].replaceAll(",", ""));
      if (!Number.isFinite(amount) || amount < 0) return [];
      return [{
        amount,
        rawUnit: "",
        unitZh: "",
        matchedText: match[0],
        index: match.index,
        isFrom: false,
      }];
    });
  }

  function isAllowedPriceNode(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest('[data-marketplace-wrapper="true"], #providers, main table')) return true;
    if (location.pathname.startsWith("/compare")) return Boolean(parent.closest("main"));

    const modelTitle = document.querySelector("#model-title-row");
    if (!modelTitle || !parent.closest("main")) return false;
    const context = parent.closest("div, section, td")?.textContent || parent.textContent || "";
    return context.length <= 500 && /\b(?:price|input\s*\/m|output\s*\/m|in\s*\/\s*out)\b/i.test(context);
  }

  function createPriceBadge(parsedPrices, quotes) {
    const badge = document.createElement("span");
    badge.dataset.orlOwned = "true";
    badge.dataset.orlPriceBadge = "true";
    badge.className = "orl-price-badge";
    updatePriceBadge(badge, parsedPrices, quotes);
    return badge;
  }

  function updatePriceBadge(badge, parsedPrices, quotes) {
    const nextText = formatCnyBadgeText(quotes);
    if (badge.textContent !== nextText) badge.textContent = nextText;
    badge.removeAttribute("title");
  }

  function removePriceBadge(node) {
    const badge = priceBadges.get(node);
    if (!badge) return;
    badge.remove();
    priceBadges.delete(node);
  }

  function enhancePriceNode(node) {
    if (
      !settings.enabled ||
      !settings.showCny ||
      !rates ||
      shouldSkipNode(node)
    ) {
      removePriceBadge(node);
      return;
    }
    if (!isAllowedPriceNode(node)) {
      removePriceBadge(node);
      return;
    }
    const parsedPrices = parseDisplayedPrices(node.nodeValue || "");
    if (parsedPrices.length === 0) {
      const container = node.parentElement;
      const containerText = container?.textContent || "";
      if (
        container &&
        !container.closest("main table td") &&
        containerText.length <= 160 &&
        parseDisplayedPrices(containerText).length > 0
      ) {
        removePriceBadge(node);
        enhancePriceElement(container);
        return;
      }
      removePriceBadge(node);
      return;
    }
    const quotes = parsedPrices.map((parsed) => calculatePriceQuote(parsed.amount, rates));
    if (quotes.some((quote) => !quote)) return;

    const parent = node.parentElement;
    if (!parent) return;
    let badge = priceBadges.get(node);
    if (!badge) {
      badge = createPriceBadge(parsedPrices, quotes);
      priceBadges.set(node, badge);
      node.after(badge);
    } else {
      updatePriceBadge(badge, parsedPrices, quotes);
    }
  }

  function enhancePriceElement(element) {
    if (!settings.enabled || !settings.showCny || !rates || element.closest("[data-orl-owned]")) {
      removePriceBadge(element);
      return;
    }
    const parsedPrices = parseDisplayedPrices(element.textContent || "");
    if (parsedPrices.length === 0) {
      removePriceBadge(element);
      return;
    }
    const quotes = parsedPrices.map((parsed) => calculatePriceQuote(parsed.amount, rates));
    if (quotes.some((quote) => !quote)) return;

    let badge = priceBadges.get(element);
    if (!badge) {
      badge = createPriceBadge(parsedPrices, quotes);
      priceBadges.set(element, badge);
      element.append(badge);
    } else {
      updatePriceBadge(badge, parsedPrices, quotes);
    }
  }

  function scanPrices(root) {
    if (!settings.enabled || !settings.showCny || !rates) return;
    const scope = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!(scope instanceof Element) || scope.closest("[data-orl-owned]")) return;

    const priceCells = new Set();
    const ancestorCell = scope.closest("main table td");
    if (ancestorCell) priceCells.add(ancestorCell);
    if (scope.matches("main table td")) priceCells.add(scope);
    scope.querySelectorAll("main table td").forEach((cell) => priceCells.add(cell));
    for (const cell of priceCells) enhancePriceElement(cell);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest("main table td")) continue;
      if (node.nodeValue?.includes("$")) enhancePriceNode(node);
      else {
        removePriceBadge(node);
        if (!node.parentElement?.textContent.includes("$")) removePriceBadge(node.parentElement);
      }
    }
  }

  function restorePrices() {
    for (const badge of priceBadges.values()) badge.remove();
    priceBadges.clear();
    document.querySelectorAll("[data-orl-price-badge]").forEach((element) => element.remove());
  }

  function isEnglishDescription(element) {
    if (!(element instanceof HTMLElement) || element.children.length > 0) return false;
    if (!element.matches("p")) return false;
    if (element.closest("[data-orl-owned], footer, nav, aside, [role='dialog'], [hidden], [aria-hidden='true'], code, pre, kbd, samp, var")) {
      return false;
    }
    if (element.matches(".font-mono, [class~='font-mono']")) return false;
    const text = element.textContent?.trim() || "";
    if (text.length < 40 || text.length > 1200) return false;
    if (/\b(?:api[_ -]?key|authorization|bearer)\b/i.test(text)) return false;
    const englishLetters = (text.match(/[A-Za-z]/g) || []).length;
    return englishLetters / text.length > 0.35;
  }

  function collectDescriptionCandidates(root) {
    if (!settings.enabled || !settings.translateContent) return;
    const scope = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!(scope instanceof Element)) return;
    const selector = location.pathname === "/models"
      ? '[data-testid="model-list-item"] p, [data-marketplace-wrapper="true"] li p'
      : "main p";
    const candidates = [];
    if (scope.matches(selector)) candidates.push(scope);
    candidates.push(...scope.querySelectorAll(selector));

    const currentRoute = location.pathname;
    if (contentBudgetRoute !== currentRoute) {
      contentBudgetRoute = currentRoute;
      contentBudgetCount = 0;
      contentBudgetCharacters = 0;
    }

    for (const element of new Set(candidates)) {
      if (!isEnglishDescription(element) || descriptionPending.has(element)) continue;
      const prior = descriptionRecords.get(element);
      if (prior && element.textContent === prior.translated) continue;
      const original = element.textContent.trim();
      if (
        descriptionQueue.length >= CONTENT_QUEUE_LIMIT ||
        contentBudgetCount >= CONTENT_QUEUE_LIMIT ||
        contentBudgetCharacters + original.length > CONTENT_CHARACTER_BUDGET
      ) {
        continue;
      }
      const taskId = ++descriptionTaskId;
      descriptionPending.set(element, taskId);
      contentBudgetCount += 1;
      contentBudgetCharacters += original.length;
      descriptionQueue.push({
        element,
        original,
        route: currentRoute,
        generation: descriptionGeneration,
        taskId,
      });
    }
    runDescriptionWorkers();
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  async function translateDescription(text) {
    const key = `${TRANSLATION_SCHEMA_VERSION}:${hashText(text)}`;
    const cached = translationCache[key];
    if (cached?.source === text && typeof cached.translated === "string") {
      cached.lastUsed = Date.now();
      return cached.translated;
    }
    if (translationInFlight.has(key)) return translationInFlight.get(key);

    const promise = (async () => {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=" +
        encodeURIComponent(text);
      const payload = await requestJson(url, 12000);
      const translated = payload?.[0]?.map((part) => part?.[0] || "").join("").trim();
      if (!translated) throw new Error("翻译响应为空");

      translationCache[key] = { source: text, translated, lastUsed: Date.now() };
      const entries = Object.entries(translationCache);
      if (entries.length > TRANSLATION_CACHE_LIMIT) {
        entries
          .sort(([, left], [, right]) => Number(left?.lastUsed || 0) - Number(right?.lastUsed || 0))
          .slice(0, entries.length - TRANSLATION_CACHE_LIMIT)
          .forEach(([oldKey]) => delete translationCache[oldKey]);
      }
      scheduleTranslationCachePersist();
      return translated;
    })();
    translationInFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      if (translationInFlight.get(key) === promise) translationInFlight.delete(key);
    }
  }

  function scheduleTranslationCachePersist() {
    global.clearTimeout(translationPersistTimer);
    translationPersistTimer = global.setTimeout(() => {
      writeValue(TRANSLATION_CACHE_KEY, translationCache);
    }, 1000);
  }

  function runDescriptionWorkers() {
    while (descriptionWorkers < 2 && descriptionQueue.length > 0) {
      const task = descriptionQueue.shift();
      const { element, original, route, generation, taskId } = task;
      descriptionWorkers += 1;
      (async () => {
        try {
          if (
            !element.isConnected ||
            !settings.translateContent ||
            generation !== descriptionGeneration ||
            route !== location.pathname ||
            element.textContent.trim() !== original
          ) {
            return;
          }
          const translated = await translateDescription(original);
          if (
            !element.isConnected ||
            !settings.translateContent ||
            generation !== descriptionGeneration ||
            route !== location.pathname ||
            element.textContent.trim() !== original
          ) {
            return;
          }
          descriptionRecords.set(element, {
            original,
            translated,
            originalLang: element.getAttribute("lang"),
            originalTitle: element.getAttribute("title"),
          });
          element.textContent = translated;
          element.lang = "zh-CN";
          element.title = original;
        } catch {
          setDescriptionStatus("部分页面内容暂时无法翻译");
        } finally {
          if (descriptionPending.get(element) === taskId) descriptionPending.delete(element);
          descriptionWorkers -= 1;
          runDescriptionWorkers();
        }
      })();
    }
  }

  function restoreEnhancements() {
    for (const [node, record] of uiTextRecords) {
      if (node.isConnected && node.nodeValue === record.rendered) node.nodeValue = record.original;
    }
    uiTextRecords.clear();

    for (const [element, records] of attributeRecords) {
      if (!element.isConnected) continue;
      for (const [attribute, record] of Object.entries(records)) {
        if (element.getAttribute(attribute) === record.rendered) {
          element.setAttribute(attribute, record.original);
        }
      }
    }
    attributeRecords.clear();

    for (const [element, record] of descriptionRecords) {
      if (element.isConnected && element.textContent === record.translated) {
        element.textContent = record.original;
        if (record.originalLang === null) element.removeAttribute("lang");
        else element.setAttribute("lang", record.originalLang);
        if (record.originalTitle === null) element.removeAttribute("title");
        else element.setAttribute("title", record.originalTitle);
      }
    }
    descriptionRecords.clear();
    restorePrices();
  }

  function isActivePage() {
    if (location.pathname === "/models" || location.pathname.startsWith("/models/")) return true;
    if (location.pathname === "/compare" || location.pathname.startsWith("/compare/")) return true;
    return isTargetPath(location.pathname) && Boolean(document.querySelector("#model-title-row"));
  }

  function scanRoot(root) {
    updatePanelVisibility();
    if (!isActivePage()) return;
    if (!settings.enabled) {
      restoreEnhancements();
      return;
    }
    if (settings.translateUi) scanStaticTranslations(root);
    if (settings.showCny && rates) scanPrices(root);
    else restorePrices();
    if (settings.translateContent) collectDescriptionCandidates(root);
  }

  function scheduleScan(root) {
    if (!root || !root.isConnected) return;
    pendingRoots.add(root);
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
    for (const node of uiTextRecords.keys()) if (!node.isConnected) uiTextRecords.delete(node);
    for (const element of attributeRecords.keys()) if (!element.isConnected) attributeRecords.delete(element);
    for (const element of descriptionRecords.keys()) if (!element.isConnected) descriptionRecords.delete(element);
    for (const [node, badge] of priceBadges) {
      if (!node.isConnected || !badge.isConnected) priceBadges.delete(node);
    }
  }

  function handleRouteChange() {
    const nextRoute = location.pathname;
    if (nextRoute === routeKey) return;
    routeKey = nextRoute;
    descriptionGeneration += 1;
    descriptionQueue.length = 0;
    descriptionPending.clear();
    contentBudgetRoute = nextRoute;
    contentBudgetCount = 0;
    contentBudgetCharacters = 0;
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
        if (mutation.type === "characterData") {
          const parent = mutation.target.parentElement;
          if (parent && !parent.closest("[data-orl-owned]")) scheduleScan(parent);
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            scheduleScan(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    global.addEventListener("popstate", handleRouteChange);
    global.addEventListener("hashchange", handleRouteChange);
    global.setInterval(handleRouteChange, 1000);
  }

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
      if (key === "translateContent" && !settings.translateContent) {
        descriptionGeneration += 1;
        descriptionQueue.length = 0;
        descriptionPending.clear();
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
    const host = element("div", { "data-orl-panel-host": "true", "data-orl-owned": "true" });
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
        .orl-price-badge {
          color: color-mix(in srgb, currentColor 78%, #1677ff 22%);
          font-size: .92em;
          font-weight: 600;
          white-space: normal;
          font-variant-numeric: tabular-nums;
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

  function boot() {
    mountDocumentStyles();
    mountPanel();
    registerMenuCommands();
    observePage();
    handleRouteChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(globalThis);
