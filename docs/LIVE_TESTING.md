# 真实页面验收

## 验收边界

页面验收只接受从 `https://openrouter.ai` 当前真实页面得到的结果。

以下内容不能作为页面验收证据：

- `test/fixture.html`；
- `npm run fixture` 启动的 localhost 页面；
- `file://` 页面；
- 手工伪造或从单元测试复制的快照；
- 仅有 `npm test` 通过的结果。

fixture 可以复现已知 DOM 边界，但它只属于开发调试。真实页面的路由、文案、懒加载、
虚拟列表和供应商表格随时可能变化，发布前必须单独验收。

## 前置检查

使用 Node.js 20 或 22，在仓库根目录运行：

```bash
npm run build
npm run check
```

把最新 `openrouter-zh-cny.user.js` 安装或更新到 Tampermonkey。打开浏览器开发者工具时，
先确认：

```js
location.origin === "https://openrouter.ai"
```

若结果不是 `true`，立即停止。不要从本地 fixture 继续采集。

## 必验页面

每次发布至少覆盖：

1. `https://openrouter.ai/models`：模型卡片、筛选文案、模型名保护和动态加载。
2. `https://openrouter.ai/providers`：供应商入口和供应商名称保护。
3. 一个当前真实模型详情页：标题、正文、供应商表和美元/人民币价格。
4. 一个由两个当前真实模型组成的 Compare 页面：完整名、短名和切换器。
5. 一个公开长文页面与一个私有页面：验证在线翻译边界。

不要在文档中固化某个具体模型 URL。模型可能下线，应从本次 `/models` 页面选择仍可访问的
canonical 路由。

## 结构化快照

`npm run verify:live-entities` 不会联网或打开浏览器。它只校验通过标准输入或 `--base64`
传入的真实页面快照。下面的采集片段使用同一真实 OpenRouter 标签页的 `sessionStorage`
暂存公开实体，不读取 Cookie、localStorage、请求头、账户数据或用户输入。

### 1. 采集模型

打开真实 `/models` 页面，等待模型列表完成首屏渲染，在 DevTools Console 执行：

```js
(() => {
  if (location.origin !== "https://openrouter.ai" || location.pathname !== "/models") {
    throw new Error("必须在真实 OpenRouter /models 页面采集");
  }
  const key = "orl:live-verification:v1";
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const records = new Map();
  for (const item of document.querySelectorAll("main [data-testid='model-list-item']")) {
    for (const anchor of item.querySelectorAll("a[href]")) {
      const href = new URL(anchor.href, location.origin).pathname;
      if (!/^\/[a-z0-9~._-]+\/[a-z0-9~._:-]+$/i.test(href)) continue;
      const label = clean(
        anchor.getAttribute("aria-label") ||
          anchor.querySelector("h1,h2,h3,h4,strong,.font-semibold")?.innerText ||
          anchor.innerText,
      );
      if (label && label.length <= 160 && !/[.!?。！？]$/.test(label)) {
        records.set(href, { label, href });
      }
    }
  }
  const models = [...records.values()];
  if (models.length === 0) throw new Error("未找到模型，请检查真实页面当前 DOM");
  const snapshot = JSON.parse(sessionStorage.getItem(key) || "{}");
  snapshot.sources ||= {};
  snapshot.sources.models = location.href;
  snapshot.models = models;
  sessionStorage.setItem(key, JSON.stringify(snapshot));
  console.table(models);
})();
```

如果页面使用虚拟列表，可先滚动几屏再重新执行；同一路由会自动去重。

### 2. 采集移动端响应式标题

把真实 `/models` 页面切换到小屏视口（建议 `390 × 844`），刷新并等待首屏模型卡片完成
渲染。下面的片段会同时记录可见短名、原始响应式文本和识别器应恢复的标题：

```js
(() => {
  if (location.origin !== "https://openrouter.ai" || location.pathname !== "/models") {
    throw new Error("必须在真实 OpenRouter /models 页面采集");
  }
  if (innerWidth > 600) throw new Error("当前不是小屏视口");
  const key = "orl:live-verification:v1";
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const records = [];
  const modelAnchors = [
    ...document.querySelectorAll("main [data-testid='model-list-item'] a[href]"),
  ];
  const routes = new Set(
    modelAnchors
      .map((anchor) => new URL(anchor.href, location.origin).pathname)
      .filter((href) => /^\/[a-z0-9~._-]+\/[a-z0-9~._:-]+$/i.test(href)),
  );

  for (const href of routes) {
    const links = modelAnchors.filter(
      (anchor) => new URL(anchor.href, location.origin).pathname === href,
    );
    const title = links.find((anchor) => {
      const visible = clean(anchor.innerText);
      const raw = clean(anchor.textContent);
      return visible && visible.length <= 80 && raw.length <= 160;
    });
    if (!title) continue;
    const visibleLabel = clean(title.innerText);
    const rawLabel = clean(title.textContent);
    let expectedLabel = visibleLabel || rawLabel;
    if (visibleLabel && rawLabel !== visibleLabel && rawLabel.endsWith(visibleLabel)) {
      const responsiveFull = clean(rawLabel.slice(0, -visibleLabel.length));
      if (responsiveFull.length > visibleLabel.length) expectedLabel = responsiveFull;
    }
    records.push({
      href,
      ariaLabel: title.getAttribute("aria-label"),
      visibleLabel,
      rawLabel,
      expectedLabel,
    });
  }

  if (records.length === 0) throw new Error("未找到真实移动端模型标题");
  const snapshot = JSON.parse(sessionStorage.getItem(key) || "{}");
  snapshot.sources ||= {};
  snapshot.sources.modelsMobile = location.href;
  snapshot.mobileViewport = { width: innerWidth, height: innerHeight };
  snapshot.mobileModels = records;
  sessionStorage.setItem(key, JSON.stringify(snapshot));
  console.table(records);
})();
```

### 3. 采集供应商

在同一标签页打开真实 `/providers` 页面并执行：

```js
(() => {
  if (location.origin !== "https://openrouter.ai" || location.pathname !== "/providers") {
    throw new Error("必须在真实 OpenRouter /providers 页面采集");
  }
  const key = "orl:live-verification:v1";
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const records = new Map();
  for (const anchor of document.querySelectorAll("main a[href]")) {
    const href = new URL(anchor.href, location.origin).pathname;
    if (!/^\/provider\/[a-z0-9._-]+$/i.test(href)) continue;
    const label = clean(
      anchor.getAttribute("aria-label") ||
        anchor.querySelector("h1,h2,h3,h4,strong,[data-provider-name]")?.innerText ||
        anchor.innerText,
    ).replace(/\s+(?:logo|icon|favicon)$/i, "");
    if (label && label.length <= 100) records.set(href, { label, href });
  }
  const providers = [...records.values()];
  if (providers.length === 0) throw new Error("未找到供应商，请检查真实页面当前 DOM");
  const snapshot = JSON.parse(sessionStorage.getItem(key) || "{}");
  snapshot.sources ||= {};
  snapshot.sources.providers = location.href;
  snapshot.providers = providers;
  sessionStorage.setItem(key, JSON.stringify(snapshot));
  console.table(providers);
})();
```

### 4. 采集模型详情

从本次真实模型列表打开一个 `/{provider}/{model}` 详情页，等待 Providers 表格出现后执行：

```js
(() => {
  if (location.origin !== "https://openrouter.ai") {
    throw new Error("必须在真实 OpenRouter 页面采集");
  }
  if (!/^\/[a-z0-9~._-]+\/[a-z0-9~._:-]+$/i.test(location.pathname)) {
    throw new Error("当前页面不是模型 canonical 路由");
  }
  const key = "orl:live-verification:v1";
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const canonical = document.querySelector('link[rel="canonical"][href]')?.href;
  const heading = clean(document.querySelector("#model-title-row h1, main h1")?.innerText);
  if (!canonical || !heading) throw new Error("详情页 canonical 或标题尚未渲染");

  const providerRows = [];
  const providerNames = [];
  for (const row of document.querySelectorAll("#providers tbody tr")) {
    const cells = [...row.querySelectorAll("td")].map((cell) => clean(cell.innerText));
    const providerName = clean(row.querySelector("td:first-child button")?.innerText || cells[0]);
    const prices = cells.slice(1, 4);
    if (!providerName || !prices.some((text) => /\$\s*[\d,.]+/.test(text))) continue;
    providerNames.push(providerName);
    providerRows.push([providerName, ...prices]);
  }
  if (providerRows.length === 0) throw new Error("真实详情页没有可采集的供应商价格");

  const publicParagraphs = [...document.querySelectorAll("main p")]
    .map((element) => clean(element.innerText))
    .filter(Boolean)
    .slice(0, 20);
  const snapshot = JSON.parse(sessionStorage.getItem(key) || "{}");
  snapshot.sources ||= {};
  snapshot.sources.detail = location.href;
  snapshot.detail = {
    canonical,
    pathname: location.pathname,
    modelId: location.pathname.slice(1),
    heading,
    description: [heading, ...publicParagraphs].join(" "),
    providerRows,
    providerNames: [...new Set(providerNames)],
  };
  sessionStorage.setItem(key, JSON.stringify(snapshot));
  console.log(snapshot.detail);
})();
```

### 5. 采集 Compare 页面

打开本次选定的真实 Compare 页面，切换到小屏视口后执行：

```js
(() => {
  if (location.origin !== "https://openrouter.ai" || !location.pathname.startsWith("/compare/")) {
    throw new Error("必须在真实 OpenRouter Compare 页面采集");
  }
  const key = "orl:live-verification:v1";
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const segments = location.pathname.split("/").filter(Boolean);
  const canonicalIds = [];
  for (let index = 1; index + 1 < segments.length; index += 2) {
    canonicalIds.push(`${decodeURIComponent(segments[index])}/${decodeURIComponent(segments[index + 1])}`);
  }
  const buttons = [...document.querySelectorAll('button[aria-label="Change model"]')]
    .filter((button) => button.offsetParent !== null)
    .slice(0, canonicalIds.length);
  if (canonicalIds.length < 2 || buttons.length !== canonicalIds.length) {
    throw new Error("Compare 页面模型尚未完整渲染");
  }
  const models = buttons.map((button, index) => {
    const canonicalId = canonicalIds[index];
    const visibleLabel = clean(button.innerText);
    const fullLabel = clean(button.querySelector("[title]")?.getAttribute("title") || visibleLabel);
    return { canonicalId, href: `/${canonicalId}`, fullLabel, visibleLabel };
  });
  const snapshot = JSON.parse(sessionStorage.getItem(key) || "{}");
  snapshot.sources ||= {};
  snapshot.sources.compare = location.href;
  snapshot.compare = {
    pathname: location.pathname,
    heading: clean(document.querySelector("main h1")?.innerText),
    models,
  };
  sessionStorage.setItem(key, JSON.stringify(snapshot));
  console.table(models);
})();
```

### 6. 执行快照校验

仍在真实 OpenRouter 标签页中执行以下片段。它会把快照编码后复制到剪贴板，并清理临时键：

```js
(() => {
  if (location.origin !== "https://openrouter.ai") throw new Error("来源不是 OpenRouter");
  const key = "orl:live-verification:v1";
  const raw = sessionStorage.getItem(key);
  if (!raw) throw new Error("没有待验收快照");
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  copy(btoa(binary));
  sessionStorage.removeItem(key);
  console.log("快照 Base64 已复制，临时数据已清理");
})();
```

回到仓库终端，将剪贴板内容作为参数传入：

```bash
npm run verify:live-entities -- --base64 '粘贴真实页面快照的 Base64'
```

校验器会拒绝来源 URL 缺失、来源不是 `https://openrouter.ai`、来源路径与快照不一致、
缺少移动端标题或缺少 Compare 模型的输入。成功输出只表示**真实页面实体快照校验通过**，
会报告模型、供应商、移动标题、Compare 模型和详情价格样本数；它不会证明脚本已安装到
浏览器，也不能替代下一节的页面行为检查。采集结果会随 OpenRouter 页面变化，默认不要
提交快照文件；在 PR 中记录采集日期、真实 URL、视口、样本数量和校验输出即可。

## 页面行为检查

结构化脚本只验证实体与价格数据，不能代替页面行为检查。至少确认：

- 模型、供应商、Benchmark 专名和 canonical ID 没有被翻译；
- 固定 UI 文案命中正确页面域词典；
- 美元价完整保留，人民币价只追加一次，路由切换后不重复；
- 模型详情、供应商表和 Compare 选择器的完整名与短名均保持原文；
- 关闭中文界面、页面内容中文或人民币估价后，原 DOM 能正确恢复；
- 客户端路由、懒加载和虚拟列表新增内容会被处理；
- 在线翻译失败时保留英文原文。

检查 DOM 和可访问名称时优先使用浏览器的结构化可访问性快照。只有颜色、间距、遮挡、
响应式布局等视觉问题需要截图佐证。

## 隐私检查

打开 DevTools Network 并筛选 `translate.googleapis.com`：

1. 在公开长文页面启用“页面内容中文”，允许公开正文请求出现。
2. 进入 `/chat`、账户、账单、密钥或设置页面，确认普通正文和属性不会发出翻译请求。
3. 不要在测试中输入真实 API Key、令牌、邮箱或其他个人数据。
4. 若需要验证敏感模式，只使用明确的虚构值，并在检查后清除。

任何私有页面数据外发都属于发布阻断问题，不能用单元测试通过来豁免。

## PR 验收记录

涉及实体、路由、DOM 或隐私的 PR 至少记录：

- 验收日期；
- 实际访问的 `https://openrouter.ai/...` URL；
- 浏览器与用户脚本版本；
- 模型、供应商和价格样本数量；
- `npm run check` 与 `npm run verify:live-entities` 的结果；
- 页面行为检查结论；
- 明确声明未使用 fixture 作为页面验收证据。
