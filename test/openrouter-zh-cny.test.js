"use strict";

const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ENTITY_CATALOG,
  UI_TRANSLATION_MODULES,
  calculatePriceQuote,
  clampSettings,
  compareModelSlugs,
  createEntityRegistry,
  entityCandidateText,
  extractEntityNamesFromPath,
  formatCnyPrice,
  formatNumber,
  isAuthorEntityPath,
  isCompareModelLabel,
  isEntityLabelForPath,
  isKnownModelName,
  isKnownProviderName,
  isPublicContentPath,
  isPublicContentDocument,
  isModelEntityPath,
  isSensitiveText,
  isTargetPath,
  maskProtectedTranslationText,
  parseDisplayedPrice,
  parseDisplayedPrices,
  parsePriceContainerText,
  parseSplitDisplayedPrice,
  parseFrankfurterRate,
  parseYahooChart,
  registerModelCandidate,
  registerProviderCandidate,
  restoreProtectedTranslationText,
  shouldTranslateOnlineText,
  splitTranslationText,
  translationModuleNamesForPath,
  translateStaticValue,
} = require("../openrouter-zh-cny.user.js");

test("用户脚本元数据覆盖 OpenRouter 全站", () => {
  const source = fs.readFileSync(require.resolve("../openrouter-zh-cny.user.js"), "utf8");
  const packageVersion = JSON.parse(
    fs.readFileSync(require.resolve("../package.json"), "utf8"),
  ).version;
  const metadataVersion = source.match(/^\/\/ @version\s+(\S+)$/m)?.[1];
  const runtimeVersion = source.match(/const VERSION = "([^"]+)";/)?.[1];
  assert.match(source, /^\/\/ @match\s+https:\/\/openrouter\.ai\/\*$/m);
  assert.equal((source.match(/^\/\/ @match\s+/gm) || []).length, 1);
  assert.equal(metadataVersion, packageVersion);
  assert.equal(runtimeVersion, packageVersion);
  assert.match(source, /"data-orl-version": VERSION/);
  assert.match(source, /function boot\(\)[\s\S]+observePage\(\);\s+handleRouteChange\(\);/);
  assert.doesNotMatch(source, /CONTENT_QUEUE_LIMIT|CONTENT_CHARACTER_BUDGET/);
  assert.doesNotMatch(source, /translationCache\[key\]\s*=\s*\{\s*source/);
  assert.match(source, /kind: "attribute"/);
});

test("翻译词典按页面区域模块化", () => {
  assert.deepEqual(Object.keys(UI_TRANSLATION_MODULES), [
    "navigation",
    "common",
    "home",
    "catalog",
    "details",
    "providers",
    "metrics",
    "benchmarks",
    "rankings",
    "apps",
    "docsShell",
    "docs",
    "sdk",
    "blog",
    "legal",
    "support",
    "marketing",
    "data",
    "product",
    "fusion",
    "footer",
    "accessibility",
  ]);
  assert.equal(translateStaticValue("Effective Pricing", ["details"]), "有效价格");
  assert.equal(translateStaticValue("Effective Pricing", ["navigation"]), null);
  assert.equal(
    translateStaticValue("The Unified Interface For LLMs", ["home"]),
    "大语言模型统一接口",
  );
  assert.equal(translateStaticValue("Reasoning", ["home"]), null);
  assert.equal(translateStaticValue("Chat", ["home"]), null);
  assert.equal(
    translateStaticValue("Pricing: Low to High", ["catalog"]),
    "价格：从低到高",
  );
  assert.equal(
    translateStaticValue("Design Arena ELO: High to Low", ["catalog"]),
    "Design Arena ELO：从高到低",
  );
  assert.equal(
    translateStaticValue("400+ active models on 70+ providers", ["home"]),
    "400+ 个活跃模型，来自 70+ 个供应商",
  );
  assert.equal(translateStaticValue("Providers", ["home"]), "供应商");
  assert.equal(
    translateStaticValue("250k+ apps using OpenRouter with 4.2M+ users globally", ["home"]),
    "全球 4.2M+ 用户通过 OpenRouter 使用 250k+ 个应用",
  );
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
  assert.equal(
    translateStaticValue("Browse models provided by Anthropic"),
    "浏览 Anthropic 提供的模型",
  );
  assert.equal(
    translateStaticValue("OpenAI tokens processed on OpenRouter"),
    "OpenAI 在 OpenRouter 上已处理的令牌",
  );
  assert.equal(translateStaticValue("40% off"), "优惠 40%");
  assert.equal(translateStaticValue("21 more providers"), "还有 21 个供应商");
  assert.equal(translateStaticValue("Programming (#48)"), "编程（第 48 名）");
  assert.equal(
    translateStaticValue("Ranked at #31 in Finance category"),
    "金融类别排名第 31",
  );
  assert.equal(
    translateStaticValue("More information about GPQA Diamond"),
    "查看 GPQA Diamond 的更多信息",
  );
  assert.equal(translateStaticValue("Favicon for deepseek"), "deepseek 图标");
  assert.equal(
    translateStaticValue("What is the context length of GPT-5.6 Sol?"),
    "GPT-5.6 Sol 的上下文长度是多少？",
  );
  assert.equal(
    translateStaticValue("What inputs and outputs does GPT-5.6 Sol support?"),
    "GPT-5.6 Sol 支持哪些输入和输出？",
  );
  assert.equal(translateStaticValue("+7 Categories"), "+7 类别");
});

test("对比页标题只翻译连接词并识别 URL 中的模型名", () => {
  const pathname = "/compare/openai/gpt-5.6-luna/deepseek/deepseek-v4-flash-0731";
  assert.deepEqual(compareModelSlugs(pathname), [
    "gpt-5.6-luna",
    "deepseek-v4-flash-0731",
  ]);
  assert.equal(isCompareModelLabel("GPT-5.6 Luna", pathname), true);
  assert.equal(isCompareModelLabel("GPT-5.6 Luna (max)", pathname), true);
  assert.equal(isCompareModelLabel("DeepSeek V4 Flash 0731", pathname), true);
  assert.equal(isCompareModelLabel("V4 Flash 0731", pathname), true);
  assert.equal(isCompareModelLabel("V4 Flash 0731 (Reasoning, Max Effort)", pathname), true);
  assert.equal(isCompareModelLabel("DigitalOcean", pathname), false);
  assert.equal(isCompareModelLabel("GPT-5.6 Luna vs DeepSeek V4 Flash 0731", pathname), false);
  assert.equal(
    translateStaticValue("GPT-5.6 Luna vs DeepSeek V4 Flash 0731"),
    "GPT-5.6 Luna 与 DeepSeek V4 Flash 0731",
  );
});

test("基准测试标签完整翻译并保留专名", () => {
  assert.equal(translateStaticValue("Intelligence Index", ["metrics"]), "智能指数");
  assert.equal(translateStaticValue("Better than", ["metrics"]), "优于");
  assert.equal(translateStaticValue("Data Visualization", ["metrics"]), "数据可视化");
  assert.equal(translateStaticValue("Methodology info", ["accessibility"]), "方法说明");
  assert.equal(
    translateStaticValue("Better than 97% of models compared", ["metrics"]),
    "优于 97% 的参评模型",
  );
  assert.equal(
    translateStaticValue("Expand benchmark scores", ["metrics"]),
    "展开基准测试分数",
  );
  assert.equal(translateStaticValue("Math Index", ["metrics"]), "数学指数");
  assert.equal(
    translateStaticValue("No benchmark data available for this model yet.", ["metrics"]),
    "该模型暂时没有基准测试数据。",
  );
  assert.equal(
    translateStaticValue("Agentic Planning & Tool Use", ["metrics"]),
    "智能体规划与工具使用",
  );
  assert.equal(
    translateStaticValue("AA-Omniscience Non-Hallucination Rate", ["metrics"]),
    "AA-Omniscience 非幻觉率",
  );
  assert.equal(
    translateStaticValue("Median Throughput on OpenRouter", ["metrics"]),
    "OpenRouter 吞吐量中位数",
  );
  assert.equal(
    translateStaticValue("Tool Call Error Rate by Provider", ["metrics"]),
    "各供应商工具调用错误率",
  );
  assert.equal(translateStaticValue("2,552 tournaments", ["metrics"]), "2,552 场锦标赛");
  assert.equal(translateStaticValue("64.0% Win", ["metrics"]), "胜率 64.0%");
  assert.equal(translateStaticValue("Top", ["metrics"]), "前");
  assert.equal(translateStaticValue("Win", ["metrics"]), "胜率");
  assert.equal(
    translateStaticValue("Metrics sourced from Design Arena", ["metrics"]),
    "指标来源：Design Arena",
  );
  assert.equal(translateStaticValue("Y-axis scale", ["metrics"]), "Y 轴刻度");
  assert.equal(translateStaticValue("1K - 10K tokens", ["metrics"]), "1K - 10K 令牌");
  assert.equal(translateStaticValue("Artificial Analysis", ["metrics"]), null);
  assert.equal(translateStaticValue("Elo", ["metrics"]), null);
  assert.equal(translateStaticValue("GPQA Diamond", ["metrics"]), null);
  assert.equal(translateStaticValue("τ²-Bench Airline", ["benchmarks"]), null);
  assert.equal(translateStaticValue("TAU-Bench", ["metrics"]), null);
});

test("排行榜和应用页使用独立词典", () => {
  assert.equal(
    translateStaticValue("AI Model Rankings", ["rankings"]),
    "AI 模型排行榜",
  );
  assert.equal(translateStaticValue("Market Share", ["rankings"]), "市场份额");
  assert.equal(translateStaticValue("Chart options", ["rankings"]), "图表选项");
  assert.equal(translateStaticValue("This Month", ["rankings"]), "本月");
  assert.equal(translateStaticValue("Share of tokens", ["rankings"]), "令牌占比");
  assert.equal(translateStaticValue("Frontend & UI", ["rankings"]), "前端与 UI");
  assert.equal(translateStaticValue("spend", ["rankings"]), "支出");
  assert.equal(translateStaticValue("Show 40 more", ["rankings"]), "再显示 40 项");
  assert.equal(
    translateStaticValue("Find a model to pin, 2 of 5 pinned", ["rankings"]),
    "搜索要固定的模型，已固定 2/5",
  );
  assert.equal(translateStaticValue("12 turns: $0.43", ["rankings"]), "12 轮：$0.43");
  assert.equal(translateStaticValue("17.5% of all spend", ["rankings"]), "占全部支出的 17.5%");
  assert.equal(
    translateStaticValue("App & Agent Rankings", ["apps"]),
    "应用与智能体排行榜",
  );
  assert.equal(translateStaticValue("CLI Agents", ["apps"]), "命令行智能体");
  assert.equal(translateStaticValue("opting into", ["apps"]), "选择加入");
  assert.equal(
    translateStaticValue("usage tracking on OpenRouter.", ["apps"]),
    "OpenRouter 使用情况跟踪。",
  );
  assert.equal(translateStaticValue("View more →", ["apps"]), "查看更多 →");
  assert.equal(translateStaticValue("Hermes Agent", ["apps"]), null);
});

test("基准测试总览和详情页使用独立词典", () => {
  assert.equal(translateStaticValue("Benchmark categories", ["benchmarks"]), "基准测试分类");
  assert.equal(translateStaticValue("Agents & tools", ["benchmarks"]), "智能体与工具");
  assert.equal(translateStaticValue("Cost efficiency", ["benchmarks"]), "成本效率");
  assert.equal(translateStaticValue("Output tok / question", ["benchmarks"]), "输出令牌 / 题");
  assert.equal(translateStaticValue("2 benchmarks", ["benchmarks"]), "2 项基准测试");
  assert.equal(
    translateStaticValue("2,432,621 task evaluations", ["benchmarks"]),
    "2,432,621 次任务评估",
  );
  assert.equal(translateStaticValue("110 models", ["benchmarks"]), "110 个模型");
  assert.equal(
    translateStaticValue("last run Aug 9, 2026", ["benchmarks"]),
    "最近运行：2026年8月9日",
  );
  assert.equal(translateStaticValue("10 selected", ["benchmarks"]), "已选择 10 个");
  assert.equal(
    translateStaticValue("Last benchmark run Aug 9, 2026, 4:07 PM UTC", ["benchmarks"]),
    "最近一次基准测试运行：2026年8月9日 4:07 PM UTC",
  );
  assert.equal(translateStaticValue("GPQA Diamond", ["benchmarks"]), null);
});

test("模型页固定表单标签和无障碍属性可离线翻译", () => {
  assert.equal(translateStaticValue("First Frame", ["details"]), "首帧");
  assert.equal(translateStaticValue("Video + audio", ["details"]), "视频和音频");
  assert.equal(translateStaticValue("Generate", ["details"]), "生成");
  assert.equal(translateStaticValue("Endpoints API", ["details"]), "端点 API");
  assert.equal(
    translateStaticValue("Input / Output Pricing", ["details"]),
    "输入 / 输出价格",
  );
  assert.equal(translateStaticValue("Release Date", ["details"]), "发布时间");
  assert.equal(
    translateStaticValue("Model identifier for use in the API", ["accessibility"]),
    "API 使用的模型标识符",
  );
  assert.equal(
    translateStaticValue("Upload last frame", ["accessibility"]),
    "上传末帧",
  );
});

test("英文页面日期转换为中文日期", () => {
  assert.equal(translateStaticValue("Aug 8, 2026"), "2026年8月8日");
  assert.equal(translateStaticValue("August 6, 2026"), "2026年8月6日");
  assert.equal(translateStaticValue("Apr 1"), "4月1日");
  assert.equal(translateStaticValue("Feb 2026"), "2026年2月");
});

test("在线翻译只接收合格的英文公开内容", () => {
  assert.equal(
    shouldTranslateOnlineText("Market Share", { publicContent: true, uiContext: false }),
    true,
  );
  assert.equal(
    shouldTranslateOnlineText("Workspace Settings", { publicContent: false, uiContext: true }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("Private conversation", { publicContent: false, uiContext: false }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("已经有中文 OpenRouter", { publicContent: true, uiContext: false }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("已经翻译前半句，Learn more about routing options.", {
      publicContent: true,
      uiContext: false,
    }),
    true,
  );
  assert.equal(
    shouldTranslateOnlineText("Artificial Analysis", { publicContent: true, uiContext: true }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("npm", { publicContent: true, uiContext: true }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("TypeScript", { publicContent: true, uiContext: true }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("$1.25/M input tokens", { publicContent: true, uiContext: false }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("OpenRouter Raises $113M Series B", {
      publicContent: true,
      uiContext: false,
    }),
    true,
  );
  assert.equal(
    shouldTranslateOnlineText("Get your API key and ship your first AI feature in minutes.", {
      publicContent: true,
      uiContext: false,
    }),
    true,
  );
  assert.equal(
    shouldTranslateOnlineText("Contact owner@example.com for privacy requests.", {
      publicContent: true,
      uiContext: false,
    }),
    true,
  );
  assert.equal(
    shouldTranslateOnlineText("Contact owner@example.com", {
      publicContent: false,
      uiContext: true,
    }),
    false,
  );
  assert.equal(
    shouldTranslateOnlineText("© 2026 OpenRouter, Inc", { publicContent: true, uiContext: false }),
    false,
  );
});

test("敏感内容不会进入在线翻译", () => {
  assert.equal(isSensitiveText("Authorization: Bearer abc123"), true);
  assert.equal(isSensitiveText(["sk", "or", "v1", "abcdefghijklmnop"].join("-")), true);
  assert.equal(isSensitiveText("owner@example.com"), true);
  assert.equal(isSensitiveText("OPENROUTER_API_KEY=secret"), true);
  assert.equal(isSensitiveText("user id 550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isSensitiveText("Get your API key from the dashboard."), false);
  assert.equal(isSensitiveText("Public documentation text"), false);
});

test("长正文按自然边界拆分且不会丢字", () => {
  const sentence = "This legal paragraph explains account data, billing, privacy, and security. ";
  const source = sentence.repeat(40).trim();
  const chunks = splitTranslationText(source, 240);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 240));
  assert.equal(chunks.join(""), source);

  const unbroken = "a".repeat(2500);
  const hardChunks = splitTranslationText(unbroken, 400);
  assert.ok(hardChunks.every((chunk) => chunk.length <= 400));
  assert.equal(hardChunks.join(""), unbroken);

  const masked = maskProtectedTranslationText(`${"a".repeat(890)}.OpenRouter tail`).masked;
  const protectedChunks = splitTranslationText(masked, 900);
  assert.equal(protectedChunks.join(""), masked);
  assert.equal(protectedChunks.filter((chunk) => chunk.includes("__ORL_P0__")).length, 1);

  const emojiText = `${"a".repeat(899)}😀tail`;
  const emojiChunks = splitTranslationText(emojiText, 900);
  assert.equal(emojiChunks.join(""), emojiText);
  assert.equal(emojiChunks.some((chunk) => /[\ud800-\udbff]$|^[\udc00-\udfff]/.test(chunk)), false);
});

test("在线翻译占位符保护品牌、模型 ID、价格和缩写", () => {
  const source = "OpenRouter calls openai/gpt-5 for $1.25 using the API.";
  const protectedText = maskProtectedTranslationText(source);
  assert.notEqual(protectedText.masked, source);
  assert.deepEqual(
    protectedText.entities.map((entry) => entry.value),
    ["OpenRouter", "openai/gpt-5", "$1.25", "API"],
  );
  assert.equal(
    restoreProtectedTranslationText(protectedText.masked, protectedText.entities),
    source,
  );
  assert.equal(
    restoreProtectedTranslationText("缺少保护标记", protectedText.entities),
    null,
  );
  assert.equal(
    restoreProtectedTranslationText(
      `${protectedText.entities[0].marker}${protectedText.entities[0].marker}`,
      [protectedText.entities[0]],
    ),
    null,
  );

  const benchmarkText = maskProtectedTranslationText(
    "IFBench by Google Research and τ²-Bench Telecom",
  );
  assert.deepEqual(
    benchmarkText.entities.map((entry) => entry.value),
    ["IFBench", "Google Research", "τ²-Bench Telecom"],
  );

  const benchmarkFamilyText = maskProtectedTranslationText(
    "Compare τ²-Bench Airline with TAU-Bench results.",
  );
  assert.deepEqual(
    benchmarkFamilyText.entities.map((entry) => entry.value),
    ["τ²-Bench Airline", "TAU-Bench"],
  );

  const publicContact = maskProtectedTranslationText(
    "OpenRouter Raises $113M Series B. Contact privacy@openrouter.ai.",
  );
  assert.deepEqual(
    publicContact.entities.map((entry) => entry.value),
    ["OpenRouter", "$113M", "privacy@openrouter.ai"],
  );

  const ordinaryGo = maskProtectedTranslationText("Go from prototype to production.");
  assert.deepEqual(ordinaryGo.entities, []);

  const mixedLanguage = maskProtectedTranslationText("已翻译内容，Learn more about OpenRouter.");
  assert.deepEqual(
    mixedLanguage.entities.map((entry) => entry.value),
    ["已翻译内容", "OpenRouter"],
  );
  assert.equal(
    restoreProtectedTranslationText(mixedLanguage.masked, mixedLanguage.entities),
    "已翻译内容，Learn more about OpenRouter.",
  );

  const compareTitle = "Compare GPT-5.6 Luna with DeepSeek V4 Flash 0731.";
  const protectedCompareTitle = maskProtectedTranslationText(compareTitle, [
    "GPT-5.6 Luna",
    "DeepSeek V4 Flash 0731",
  ]);
  assert.deepEqual(
    protectedCompareTitle.entities.map((entry) => entry.value),
    ["GPT-5.6 Luna", "DeepSeek V4 Flash 0731"],
  );
  assert.equal(
    restoreProtectedTranslationText(
      protectedCompareTitle.masked,
      protectedCompareTitle.entities,
    ),
    compareTitle,
  );
});

test("实体目录按供应商、模型家族和动态模型分层", () => {
  assert.ok(Object.isFrozen(ENTITY_CATALOG));
  assert.ok(Object.isFrozen(ENTITY_CATALOG.providers));
  assert.ok(ENTITY_CATALOG.providers.includes("Together AI"));
  assert.ok(ENTITY_CATALOG.modelFamilies.includes("GPT"));

  const registry = createEntityRegistry();
  assert.equal(registry.hasProvider("openai"), true);
  assert.equal(registry.hasModel("Claude"), true);
  const model = registry.registerModel("GPT-5.6 Luna", {
    aliases: ["gpt-5.6-luna"],
    canonicalId: "openai/gpt-5.6-luna",
    route: "/openai/gpt-5.6-luna",
    source: "dom",
  });
  assert.equal(model.kind, "model");
  assert.equal(model.canonicalId, "openai/gpt-5.6-luna");
  assert.deepEqual(
    registry.matching("Compare GPT-5.6 Luna with Anthropic Claude"),
    ["GPT-5.6 Luna", "Anthropic", "Claude"],
  );
  assert.deepEqual(registry.matching("Metadata preserves identity fields."), []);
  assert.equal(isKnownModelName("GPT-5.6 Luna", registry), true);

  registry.resetDynamic();
  assert.equal(registry.hasModel("GPT-5.6 Luna"), false);
  assert.equal(registry.hasModel("Claude"), true);
  assert.equal(registry.hasProvider("OpenAI"), true);
});

test("canonical ID 保留路由分隔符且不会发生模型身份碰撞", () => {
  const registry = createEntityRegistry();
  registry.registerModel("Model V1", {
    canonicalId: "foo/model-v1",
    source: "route",
  });
  registry.registerModel("Modelv1", {
    canonicalId: "foo/modelv1",
    source: "route",
  });
  assert.deepEqual(
    registry.snapshot({ kinds: ["model"] }).map(({ canonicalId }) => canonicalId).sort(),
    ["foo/model-v1", "foo/modelv1"],
  );

  const provider = registerProviderCandidate("OpenAI", "/provider/openai", registry);
  assert.equal(provider.canonicalId, "openai");

  const routedCatalogProviders = [
    ["Google Vertex", "google-vertex"],
    ["Amazon Bedrock", "amazon-bedrock"],
    ["Google AI Studio", "google-ai-studio"],
  ];
  for (const [displayName, slug] of routedCatalogProviders) {
    const record = registerProviderCandidate(displayName, `/provider/${slug}`, registry);
    assert.equal(record.canonicalId, slug);
    assert.equal(
      registry
        .snapshot({ kinds: ["provider"] })
        .filter(({ aliases }) => aliases.includes(displayName)).length,
      1,
    );
  }

  registry.resetDynamic();
  for (const [displayName, slug] of routedCatalogProviders) {
    const matches = registry
      .snapshot({ kinds: ["provider"] })
      .filter(({ aliases }) => aliases.includes(displayName));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].canonicalId, slug);
    assert.equal(
      registerProviderCandidate(displayName, `/provider/${slug}`, registry).canonicalId,
      slug,
    );
  }
});

test("供应商候选必须与路由或已知目录存在可证明关系", () => {
  const registry = createEntityRegistry();
  assert.equal(registerProviderCandidate("Pricing", "/provider/openai", registry), null);
  assert.equal(
    registerProviderCandidate("Tencent Cloud", "/provider/tencent", registry).canonicalId,
    "tencent",
  );
  assert.equal(
    registerProviderCandidate("Claude Platform on AWS", "/provider/claude-on-aws", registry)
      .canonicalId,
    "claude-on-aws",
  );
});

test("从 OpenRouter 路由识别模型与供应商实体", () => {
  const compare = extractEntityNamesFromPath(
    "/compare/openai/gpt-5.6-luna/deepseek/deepseek-v4-flash-0731",
  );
  assert.deepEqual(
    compare.providers.map(({ canonicalId }) => canonicalId),
    ["openai", "deepseek"],
  );
  assert.deepEqual(
    compare.models.map(({ canonicalId }) => canonicalId),
    ["openai/gpt-5.6-luna", "deepseek/deepseek-v4-flash-0731"],
  );
  assert.equal(
    extractEntityNamesFromPath("/provider/together").providers[0].canonicalId,
    "together",
  );
  assert.equal(isKnownProviderName("Together AI"), true);
  assert.equal(isKnownModelName("DeepSeek V4 Flash 0731"), true);
  assert.equal(isKnownModelName("Claude is a model available today"), false);
  assert.equal(
    shouldTranslateOnlineText("GPT-5.6 Luna", { publicContent: true, uiContext: false }),
    false,
  );
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
  assert.equal(parseDisplayedPrice("$0.08/M 输入 令牌").amount, 0.08);
  assert.equal(parseDisplayedPrice("$0.252/M 输出令牌").amount, 0.252);
  assert.deepEqual(
    parseDisplayedPrices("$0.14$0.084").map(({ amount }) => amount),
    [0.14, 0.084],
  );
  assert.deepEqual(
    parseDisplayedPrices("$0.10 / $0.60").map(({ amount, index, matchedText }) => ({
      amount,
      index,
      matchedText,
    })),
    [
      { amount: 0.1, index: 0, matchedText: "$0.10" },
      { amount: 0.6, index: 8, matchedText: "$0.60" },
    ],
  );
  assert.equal(parseDisplayedPrices("$0.10")[0].amount, 0.1);
  assert.equal(parseSplitDisplayedPrice(["$", "0.10"]).amount, 0.1);
  assert.equal(parseSplitDisplayedPrice(["$0.10"]), null);
  assert.equal(parseSplitDisplayedPrice(["$", "0.10", "/M tokens"]), null);
  assert.equal(parsePriceContainerText("$0.10").amount, 0.1);
  assert.equal(parsePriceContainerText("$0.10/M 输入 令牌").amount, 0.1);
  assert.equal(parsePriceContainerText(" $0.60/M output tokens ").amount, 0.6);
  assert.equal(parsePriceContainerText("input $0.10/M tokens"), null);
  assert.equal(parsePriceContainerText("$0.10 / $0.60"), null);
});

test("USD、CNY 与 USDC 使用不同语义计算", () => {
  const quote = calculatePriceQuote(3, { usdCny: 7.2, usdcUsd: 0.999 });
  assert.equal(quote.cny, 21.6);
  assert.ok(Math.abs(quote.usdc - 3.003003003) < 1e-9);
  assert.ok(Math.abs(quote.usdcCny - 7.1928) < 1e-9);
});

test("内联人民币价格固定显示两位小数", () => {
  assert.equal(formatCnyPrice(0.67444), "0.67");
  assert.equal(formatCnyPrice(4.047), "4.05");
  assert.equal(formatCnyPrice(1234.5), "1,234.50");
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

test("全站启动，但私有路由不发送普通正文", () => {
  assert.equal(isTargetPath("/"), true);
  assert.equal(isTargetPath("/models"), true);
  assert.equal(isTargetPath("/compare/openai/gpt-5"), true);
  assert.equal(isTargetPath("/openai/gpt-5"), true);
  assert.equal(isTargetPath("/docs/quickstart"), true);
  assert.equal(isTargetPath("/chat"), true);
  assert.equal(isTargetPath("https://example.com"), false);
  assert.equal(isPublicContentPath("/docs/quickstart"), true);
  assert.equal(isPublicContentPath("/blog/post"), true);
  assert.equal(isPublicContentPath("/benchmarks/gpqa-diamond"), true);
  assert.equal(isPublicContentPath("/state-of-ai"), true);
  assert.equal(isPublicContentPath("/customers/paxhistoria"), true);
  assert.equal(isPublicContentPath("/provider/anthropic"), true);
  assert.equal(isPublicContentPath("/authorized-sub-processors"), true);
  assert.equal(isPublicContentPath("/terms-of-service-enterprise"), true);
  assert.equal(isPublicContentPath("/chat"), false);
  assert.equal(isPublicContentPath("/settings/keys"), false);
  assert.equal(isPublicContentPath("/organizations/acme"), false);
  assert.equal(isPublicContentPath("/fusion"), false);
  assert.equal(isPublicContentPath("/request-builder"), false);
  assert.equal(isPublicContentPath("/spawn/codex"), false);
  assert.equal(isPublicContentPath("/oauth/callback"), false);
  assert.equal(isPublicContentPath("/login"), false);
  assert.equal(isPublicContentPath("/openai/gpt-5.6-sol"), false);
});

test("未知两段路由必须通过真实模型页结构验证后才允许在线翻译", () => {
  const originalDocument = global.document;
  const originalLocation = global.location;
  global.location = { origin: "https://openrouter.ai" };

  try {
    global.document = {
      querySelector(selector) {
        if (selector === 'link[rel="canonical"][href]') {
          return { href: "https://openrouter.ai/teams/acme" };
        }
        if (selector === "#model-title-row h1, main h1") return {};
        return null;
      },
      querySelectorAll: () => [],
    };
    assert.equal(isPublicContentDocument("/teams/acme"), false);

    global.document = {
      querySelector(selector) {
        if (selector === 'link[rel="canonical"][href]') {
          return { href: "https://openrouter.ai/openai/gpt-5.6-sol" };
        }
        if (selector === "#model-title-row h1, main h1") return {};
        if (selector.includes("#providers")) return {};
        return null;
      },
      querySelectorAll: () => [],
    };
    assert.equal(isPublicContentDocument("/openai/gpt-5.6-sol"), true);
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    if (originalLocation === undefined) delete global.location;
    else global.location = originalLocation;
  }
});

test("只把真正的模型路由识别为实体链接", () => {
  assert.equal(isModelEntityPath("/openai/gpt-5.6-sol"), true);
  assert.equal(isModelEntityPath("/deepseek/deepseek-v4"), true);
  assert.equal(isModelEntityPath("/docs/quickstart"), false);
  assert.equal(isModelEntityPath("/apps/hermes-agent"), false);
  assert.equal(isModelEntityPath("/blog/announcements"), false);
  assert.equal(isModelEntityPath("/sdk/quickstart"), false);
  assert.equal(isModelEntityPath("/works-with-openrouter/aider"), false);
  assert.equal(isModelEntityPath("/customers/paxhistoria"), false);
  assert.equal(isModelEntityPath("/benchmarks/gpqa-diamond"), false);
  assert.equal(isModelEntityPath("/provider/anthropic"), false);
  for (const tab of [
    "activity",
    "api",
    "apps",
    "benchmarks",
    "performance",
    "pricing",
    "providers",
    "uptime",
  ]) {
    assert.equal(isModelEntityPath(`/openai/gpt-transcribe/${tab}`), true);
  }
  assert.equal(isModelEntityPath("/openai/gpt-transcribe/llms.txt"), false);
  assert.equal(isModelEntityPath("/organizations/acme"), false);
  assert.equal(isModelEntityPath("/activity/123"), false);
  assert.equal(isModelEntityPath("/billing/history"), false);
  assert.equal(isModelEntityPath("/keys/new"), false);
  assert.equal(isModelEntityPath("/oauth/callback"), false);
});

test("模型实体标签兼容作者前缀、短标题和展示名与 slug 不一致", () => {
  assert.equal(
    isEntityLabelForPath("ByteDance: Seedance 2.5", "/bytedance/seedance-2.5"),
    true,
  );
  assert.equal(isEntityLabelForPath("MiniMax: H3", "/minimax/hailuo-3"), true);
  assert.equal(
    isEntityLabelForPath("R1 Distill Qwen 7B", "/deepseek/deepseek-r1-distill-qwen-7b"),
    true,
  );
  assert.equal(
    isEntityLabelForPath(
      "Seedance 2.5 is a video generation model from ByteDance.",
      "/bytedance/seedance-2.5",
    ),
    false,
  );
  assert.equal(isEntityLabelForPath("Pricing", "/models"), false);
  assert.doesNotThrow(() => isEntityLabelForPath("Model", "/openai/%E0%A4%A"));
});

test("模型家族识别要求边界和模型变体特征", () => {
  assert.equal(isKnownModelName("GPT-5.6 Luna"), true);
  assert.equal(isKnownModelName("Claude Sonnet"), true);
  assert.equal(isKnownModelName("Qwen Image 3 Pro"), true);
  assert.equal(isKnownModelName("Yield"), false);
  assert.equal(isKnownModelName("Philosophy"), false);
  assert.equal(isKnownModelName("Nova available today"), false);
  assert.equal(isKnownModelName("Command Reset"), false);
});

test("实体候选优先读取真实可见文本，避免响应式副本重复", () => {
  const element = {
    getAttribute: () => null,
    innerText: "MiniMax: H3",
    textContent: "MiniMax: H3H3",
  };
  assert.equal(entityCandidateText(element), "MiniMax: H3");

  element.innerText = "H3";
  assert.equal(entityCandidateText(element), "MiniMax: H3");

  const registry = createEntityRegistry();
  const shortModel = registerModelCandidate("H3", "/minimax/hailuo-3", registry);
  assert.equal(shortModel.canonicalId, "minimax/hailuo-3");
  assert.ok(registry.matching("MiniMax H3 supports video generation.").includes("H3"));
  assert.equal(registerModelCandidate("Pricing", "/minimax/hailuo-3", registry), null);

  delete element.innerText;
  assert.equal(entityCandidateText(element), "MiniMax: H3H3");
});

test("只把未知的安全单段路径识别为作者候选", () => {
  assert.equal(isAuthorEntityPath("/openai"), true);
  assert.equal(isAuthorEntityPath("/anthropic"), true);
  assert.equal(isAuthorEntityPath("/chat"), false);
  assert.equal(isAuthorEntityPath("/settings"), false);
  assert.equal(isAuthorEntityPath("/robots.txt"), false);
  assert.equal(isAuthorEntityPath("/openai/gpt-5.6-sol"), false);
});

test("公开页面按路由加载独立翻译模块", () => {
  assert.deepEqual(translationModuleNamesForPath("/docs/quickstart").slice(0, 2), [
    "docsShell",
    "docs",
  ]);
  assert.equal(translationModuleNamesForPath("/pricing")[0], "marketing");
  assert.equal(translationModuleNamesForPath("/data")[0], "data");
  assert.equal(translationModuleNamesForPath("/discover")[0], "product");
  assert.equal(translationModuleNamesForPath("/fusion")[0], "fusion");
  assert.equal(translationModuleNamesForPath("/benchmarks/gpqa-diamond")[0], "benchmarks");
  assert.ok(translationModuleNamesForPath("/benchmarks/gpqa-diamond").includes("metrics"));
  assert.equal(translationModuleNamesForPath("/authorized-sub-processors")[0], "legal");
  assert.equal(translationModuleNamesForPath("/state-of-ai")[0], "data");
  assert.ok(translationModuleNamesForPath("/rankings").includes("apps"));
  assert.ok(translationModuleNamesForPath("/apps/hermes-agent").includes("rankings"));
  assert.equal(translationModuleNamesForPath("/provider/anthropic")[0], "providers");
  assert.ok(translationModuleNamesForPath("/provider/anthropic").includes("metrics"));
  assert.equal(translationModuleNamesForPath("/openai")[0], "providers");
});

test("新增页面的稳定文案与动态属性可离线翻译", () => {
  assert.equal(translateStaticValue("Open search", ["docsShell"]), "打开搜索");
  assert.equal(translateStaticValue("Privacy Policy", ["legal"]), "隐私政策");
  assert.equal(translateStaticValue("Management API key", ["marketing"]), "管理 API 密钥");
  assert.equal(translateStaticValue("AI Model Comparison", ["product"]), "AI 模型对比");
  assert.equal(translateStaticValue("Maxim AI logo"), "Maxim AI 标志");
  assert.equal(translateStaticValue("Copy link to payment"), "复制本节链接");
  assert.equal(translateStaticValue("1. Collection of Personal Data"), "1. 个人数据收集");
  assert.equal(
    translateStaticValue("What other text models does Meta have?"),
    "Meta 还有哪些文本模型？",
  );
  assert.equal(translateStaticValue("8 of 72 providers"), "显示 8/72 个供应商");
  assert.equal(
    translateStaticValue("Tokens processed on OpenRouter", ["providers"]),
    "OpenRouter 已处理令牌",
  );
  assert.equal(translateStaticValue("30 day retention"), "保留 30 天");
  assert.equal(translateStaticValue("25+ free models"), "25+ 个免费模型");
  assert.equal(
    translateStaticValue("$25,000 of list price inference / month with no fees, 5% fee after"),
    "每月标价推理额度 $25,000 内免手续费，超出后收取 5% 手续费",
  );
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
