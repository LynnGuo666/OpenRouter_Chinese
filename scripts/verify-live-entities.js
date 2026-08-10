"use strict";

const assert = require("node:assert/strict");
const {
  createEntityRegistry,
  entityCandidateText,
  maskProtectedTranslationText,
  parseDisplayedPrices,
  registerModelCandidate,
  registerProviderCandidate,
  restoreProtectedTranslationText,
  translationModuleNamesForPath,
  translateStaticValue,
} = require("../openrouter-zh-cny.user.js");

function readSnapshot() {
  const base64Index = process.argv.indexOf("--base64");
  if (base64Index >= 0 && process.argv[base64Index + 1]) {
    return JSON.parse(Buffer.from(process.argv[base64Index + 1], "base64").toString("utf8"));
  }
  if (process.stdin.isTTY) {
    throw new Error("请通过标准输入或 --base64 传入真实页面快照 JSON");
  }
  return JSON.parse(require("node:fs").readFileSync(0, "utf8"));
}

function verifyProtectedRoundTrip(label, registry) {
  const source = `Use ${label} on OpenRouter without translating its name.`;
  const protectedText = maskProtectedTranslationText(source, registry.matching(source));
  assert.ok(
    protectedText.entities.some(({ value }) => value.toLocaleLowerCase() === label.toLocaleLowerCase()),
    `实体未进入占位符：${label}`,
  );
  assert.equal(restoreProtectedTranslationText(protectedText.masked, protectedText.entities), source);
}

function verifyLiveSource(value, expectedPath, label) {
  assert.equal(typeof value, "string", `缺少真实页面来源：${label}`);
  const url = new URL(value);
  assert.equal(url.origin, "https://openrouter.ai", `${label} 不是 OpenRouter 真实页面`);
  assert.equal(url.username, "", `${label} URL 不应包含用户名`);
  assert.equal(url.password, "", `${label} URL 不应包含密码`);
  assert.equal(url.pathname, expectedPath, `${label} 路径与快照不一致`);
}

function normalizedLabel(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function main() {
  const snapshot = readSnapshot();
  verifyLiveSource(snapshot.sources?.models, "/models", "模型页");
  verifyLiveSource(snapshot.sources?.providers, "/providers", "供应商页");
  assert.ok(Array.isArray(snapshot.models) && snapshot.models.length > 0, "缺少真实模型数据");
  assert.ok(
    Array.isArray(snapshot.providers) && snapshot.providers.length > 0,
    "缺少真实供应商数据",
  );

  const registry = createEntityRegistry();
  for (const model of snapshot.models) {
    assert.match(model.href, /^\/[a-z0-9~._-]+\/[a-z0-9~._:-]+$/i);
    const record = registerModelCandidate(model.label, model.href, registry);
    assert.ok(record, `无法识别真实模型：${model.label} (${model.href})`);
    assert.equal(record.kind, "model");
    assert.equal(record.canonicalId, model.href.slice(1));
    verifyProtectedRoundTrip(model.label, registry);
    const shortLabel = model.label.replace(/^.*?[:：]\s*/, "");
    if (shortLabel !== model.label) verifyProtectedRoundTrip(shortLabel, registry);
  }

  for (const provider of snapshot.providers) {
    assert.match(provider.href, /^\/provider\/[a-z0-9._-]+$/i);
    const record = registerProviderCandidate(provider.label, provider.href, registry);
    assert.ok(record, `无法识别真实供应商：${provider.label} (${provider.href})`);
    assert.equal(record.canonicalId, provider.href.slice("/provider/".length));
    assert.equal(registry.hasProvider(provider.label), true);
    verifyProtectedRoundTrip(provider.label, registry);

    const matchingProviders = registry
      .snapshot({ kinds: ["provider"] })
      .filter((candidate) =>
        candidate.aliases.some(
          (alias) => normalizedLabel(alias) === normalizedLabel(provider.label),
        ),
      );
    assert.equal(
      matchingProviders.length,
      1,
      `供应商 catalog 与路由身份未合并：${provider.label}`,
    );
  }

  verifyLiveSource(snapshot.sources?.modelsMobile, "/models", "移动模型页");
  assert.ok(
    Number.isFinite(snapshot.mobileViewport?.width) && snapshot.mobileViewport.width <= 600,
    "移动模型页快照缺少有效的小屏视口宽度",
  );
  assert.ok(
    Array.isArray(snapshot.mobileModels) && snapshot.mobileModels.length > 0,
    "缺少真实移动模型标题数据",
  );
  for (const model of snapshot.mobileModels) {
    assert.match(model.href, /^\/[a-z0-9~._-]+\/[a-z0-9~._:-]+$/i);
    const candidate = entityCandidateText({
      getAttribute: (name) => (name === "aria-label" ? model.ariaLabel || null : null),
      innerText: model.visibleLabel,
      textContent: model.rawLabel,
    });
    assert.equal(candidate, model.expectedLabel, `移动端标题恢复失败：${model.href}`);
    const fullRecord = registerModelCandidate(candidate, model.href, registry);
    const shortRecord = registerModelCandidate(model.visibleLabel, model.href, registry);
    assert.ok(fullRecord && shortRecord, `无法识别真实移动模型标题：${model.visibleLabel}`);
    assert.equal(fullRecord.canonicalId, model.href.slice(1));
    assert.equal(shortRecord.canonicalId, model.href.slice(1));
    verifyProtectedRoundTrip(model.visibleLabel, registry);
  }

  assert.ok(snapshot.compare?.pathname, "缺少真实 Compare 页面数据");
  verifyLiveSource(snapshot.sources?.compare, snapshot.compare.pathname, "Compare 页面");
  assert.match(snapshot.compare.pathname, /^\/compare\//);
  assert.ok(
    Array.isArray(snapshot.compare.models) && snapshot.compare.models.length >= 2,
    "Compare 页面至少需要两个真实模型",
  );
  for (const model of snapshot.compare.models) {
    assert.equal(model.href, `/${model.canonicalId}`);
    for (const label of new Set([model.fullLabel, model.visibleLabel].filter(Boolean))) {
      const record = registerModelCandidate(label, model.href, registry);
      assert.ok(record, `无法识别 Compare 模型别名：${label}`);
      assert.equal(record.canonicalId, model.canonicalId);
      verifyProtectedRoundTrip(label, registry);
    }
  }

  let unavailablePriceCellCount = 0;
  if (snapshot.detail) {
    const { detail } = snapshot;
    verifyLiveSource(snapshot.sources?.detail, detail.pathname, "模型详情页");
    assert.equal(new URL(detail.canonical).pathname, detail.pathname);
    assert.equal(detail.modelId, detail.pathname.slice(1));
    const record = registerModelCandidate(detail.heading, detail.pathname, registry);
    assert.ok(record, `无法识别真实详情页标题：${detail.heading}`);
    assert.equal(record.canonicalId, detail.modelId);

    const modelDisplayName = detail.heading.replace(/^.*?[:：]\s*/, "");
    assert.ok(
      registry.matching(detail.description).includes(modelDisplayName),
      `真实详情正文未保护完整模型名：${modelDisplayName}`,
    );

    const modules = translationModuleNamesForPath(detail.pathname);
    for (const label of ["Providers", "Effective Pricing", "Performance", "Throughput", "Uptime"]) {
      assert.ok(translateStaticValue(label, modules), `真实 UI 文案未命中词典：${label}`);
    }
    assert.equal(translateStaticValue("DeepInfra", modules), null);

    let priceCellCount = 0;
    for (const row of detail.providerRows || []) {
      for (const cell of row.slice(1, 4)) {
        const prices = parseDisplayedPrices(cell);
        if (prices.length === 0) {
          assert.match(
            String(cell).trim(),
            /^(?:--|—|N\/A)$/i,
            `无法解析真实价格：${cell}`,
          );
          unavailablePriceCellCount += 1;
          continue;
        }
        assert.ok(prices.every(({ amount }) => Number.isFinite(amount) && amount >= 0));
        priceCellCount += 1;
      }
    }
    assert.ok(priceCellCount > 0, "真实详情页没有可验证的价格单元格");

    for (const providerName of detail.providerNames || []) {
      registry.registerProvider(providerName, {
        canonicalId: providerName,
        route: detail.pathname,
        source: "dom",
      });
      assert.equal(registry.hasProvider(providerName), true);
    }
  }

  console.log(
    `真实页面实体快照校验通过：${snapshot.models.length} 个模型，` +
      `${snapshot.providers.length} 个供应商，${snapshot.mobileModels.length} 个移动标题，` +
      `${snapshot.compare.models.length} 个对比模型` +
      (snapshot.detail
        ? `，${snapshot.detail.providerRows.length} 行详情价格` +
          (unavailablePriceCellCount ? `（${unavailablePriceCellCount} 个不可用价格项）` : "")
        : ""),
  );
}

main();
