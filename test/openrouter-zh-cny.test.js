"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../openrouter-zh-cny.user.js");

test("翻译词典按页面区域模块化", () => {
  assert.deepEqual(Object.keys(UI_TRANSLATION_MODULES), [
    "navigation",
    "catalog",
    "details",
    "providers",
    "metrics",
    "footer",
    "accessibility",
  ]);
  assert.equal(translateStaticValue("Effective Pricing", ["details"]), "有效价格");
  assert.equal(translateStaticValue("Effective Pricing", ["navigation"]), null);
});

test("动态句式保留模型名和供应商名", () => {
  assert.equal(
    translateStaticValue("How much does DeepSeek V4 Flash cost?"),
    "DeepSeek V4 Flash 的价格是多少？",
  );
  assert.equal(
    translateStaticValue("More models from Anthropic"),
    "更多来自 Anthropic 的模型",
  );
  assert.equal(translateStaticValue("40% off"), "优惠 40%");
  assert.equal(translateStaticValue("21 more providers"), "还有 21 个供应商");
});

test("识别 OpenRouter 常见价格单位", () => {
  assert.deepEqual(parseDisplayedPrice("$0.25/M input tokens"), {
    amount: 0.25,
    rawUnit: "M input tokens",
    unitZh: "百万输入令牌",
    matchedText: "$0.25/M input tokens",
    index: 0,
    isFrom: false,
  });

  assert.deepEqual(parseDisplayedPrice("from $0.1028/second"), {
    amount: 0.1028,
    rawUnit: "second",
    unitZh: "秒",
    matchedText: "from $0.1028/second",
    index: 0,
    isFrom: true,
  });

  assert.equal(parseDisplayedPrice("Free"), null);
  assert.equal(parseDisplayedPrice("-$1/M tokens"), null);
  assert.equal(parseDisplayedPrice("CA$1/M tokens"), null);
  assert.equal(parseDisplayedPrice("$1/unknown-unit"), null);
  assert.equal(parseDisplayedPrice("$3/1K tokens").unitZh, "千令牌");
  assert.deepEqual(
    parseDisplayedPrices("$0.14$0.084").map(({ amount }) => amount),
    [0.14, 0.084],
  );
});

test("USD、CNY 与 USDC 使用不同语义计算", () => {
  const quote = calculatePriceQuote(3, { usdCny: 7.2, usdcUsd: 0.999 });
  assert.equal(quote.cny, 21.6);
  assert.ok(Math.abs(quote.usdc - 3.003003003) < 1e-9);
  assert.ok(Math.abs(quote.usdcCny - 7.1928) < 1e-9);
});

test("正文价格徽标只展示人民币数值", () => {
  const text = formatCnyBadgeText([
    { cny: 11.8, usdc: 1.75, usdcCny: 6.74 },
    { cny: 94.42, usdc: 14, usdcCny: 6.74 },
  ]);
  assert.equal(text, " · ¥11.8 / ¥94.42");
  assert.equal(text.includes("USDC"), false);
  assert.equal(text.includes("Yahoo"), false);
});

test("解析 Yahoo chart 的实时价与收盘价回退", () => {
  const live = parseYahooChart(
    {
      chart: {
        error: null,
        result: [
          {
            meta: { symbol: "CNY=X", currency: "CNY", regularMarketPrice: 7.1234, regularMarketTime: 1_700_000_000 },
            timestamp: [],
            indicators: { quote: [{ close: [] }] },
          },
        ],
      },
    },
    "CNY=X",
  );
  assert.equal(live.price, 7.1234);
  assert.equal(live.asOf, 1_700_000_000_000);

  const fallback = parseYahooChart(
    {
      chart: {
        error: null,
        result: [
          {
            meta: { symbol: "USDC-USD" },
            timestamp: [100, 200, 300],
            indicators: { quote: [{ close: [0.998, null, 1.001] }] },
          },
        ],
      },
    },
    "USDC-USD",
  );
  assert.equal(fallback.price, 1.001);
  assert.equal(fallback.asOf, 300_000);
});

test("解析 Frankfurter v2 与旧格式", () => {
  assert.equal(parseFrankfurterRate({ date: "2026-08-09", rate: 6.7444 }).price, 6.7444);
  assert.equal(parseFrankfurterRate({ rates: { CNY: 6.75 } }).price, 6.75);
  assert.equal(parseFrankfurterRate({ rate: -1 }), null);
});

test("只增强模型、对比和模型详情路径", () => {
  assert.equal(isTargetPath("/models"), true);
  assert.equal(isTargetPath("/compare/openai/gpt-5"), true);
  assert.equal(isTargetPath("/openai/gpt-5"), true);
  assert.equal(isTargetPath("/docs/quickstart"), false);
  assert.equal(isTargetPath("/chat"), false);
});

test("设置值会被收敛到安全范围", () => {
  const settings = clampSettings({
    rateMode: "unexpected",
    manualUsdCny: 99,
    manualUsdcUsd: 0,
  });
  assert.equal(settings.rateMode, "yahoo");
  assert.equal(settings.manualUsdCny, 7.2);
  assert.equal(settings.manualUsdcUsd, 1);
  assert.equal(settings.translateContent, true);
  assert.equal(formatNumber(0.0000123456), "0.00001235");
});
