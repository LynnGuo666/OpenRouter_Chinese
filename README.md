# OpenRouter 中文与人民币价格

一个零依赖 Tampermonkey 用户脚本，用来增强 OpenRouter 全站公开页面与私有页面的固定界面。
源码按职责拆分在 `src/`，构建后仍交付一个可直接安装的用户脚本。

## 功能

- 用内置词典翻译常见界面文案，不发送页面数据。
- 保留 OpenRouter 官方美元价，并追加人民币估价。
- 正文价格只保留官网 `$` 并追加简洁的 `¥` 参考价。
- 顶部“译”菜单显示 `USD/CNY`、`USDC/USD` 和推导出的 `USDC/CNY`。
- 按导航、首页、模型、供应商、排行榜、应用、文档、博客、法律、支持、营销和数据产品模块翻译固定界面文案。
- 默认翻译公开页面中的英文长文，可在顶部“译”菜单关闭。
- 兼容 OpenRouter 的客户端路由、懒加载和列表虚拟化。

## 安装

1. 在浏览器中安装 Tampermonkey。
2. 打开 [安装或更新用户脚本](https://raw.githubusercontent.com/LynnGuo666/OpenRouter_Chinese/main/openrouter-zh-cny.user.js)。
3. 在 Tampermonkey 的安装页面确认安装。
4. 打开 [OpenRouter Models](https://openrouter.ai/models)，点击顶部导航的“译”按钮调整设置。

从旧版本手工粘贴安装的用户需要通过上面的链接重新安装一次。此后 Tampermonkey 会从
GitHub `main` 分支检查并获取新版本；每次更新都会保留现有脚本设置。

## 数据口径

OpenRouter 页面显示的美元价格是唯一官方价格。脚本直接增强官网已经渲染的价格，
不会覆盖美元原价。这样也能覆盖官方 Models API 尚未完整返回的按秒视频、按分钟转录等计价单位。

```text
人民币估价 = OpenRouter USD 价格 × USD/CNY
USDC/CNY   = USDC/USD × USD/CNY
```

行情顺序：

1. Yahoo Finance `CNY=X` 和 `USDC-USD`。
2. Yahoo 不可用时，`USD/CNY` 回退到 Frankfurter。
3. `USDC/USD` 无可用行情时，明确标记为 `1 USDC≈1 USD` 锚定估算。
4. 用户可切换到手动汇率。

Yahoo 在中国大陆可能返回 `403` 或 `429`。脚本缓存行情 30 分钟，避免每次页面变化都请求；缓存最多回退 72 小时。

人民币和 USDC 都只是参考，不代表 OpenRouter 以人民币或 USDC 结算，也不包含交易所价差、网络费、支付手续费或税费。

## 翻译模块

Tampermonkey 最终安装文件保持单文件，运行时词典按页面区域拆分：

- `navigation`：顶部导航与主要入口。
- `home`：首页 Hero、功能说明、精选模型、智能体和博客入口。
- `catalog`：模型列表、筛选、排序和模态。
- `details`：模型详情、上下文与价格标签。
- `providers`：供应商表格、隐私状态和路由选项。
- `metrics`：性能、可用率、基准测试和使用趋势。
- `benchmarks`：Benchmark 总览、详情表头、动态计数和日期。
- `rankings`：排行榜、基准数据、任务和市场份额图表。
- `apps`：应用与智能体排行榜、分类标签和时间筛选。
- `docsShell` / `docs`：文档导航、操作按钮与 API 文档标题。
- `sdk` / `blog`：SDK 产品页、博客列表和文章结构。
- `legal` / `support`：隐私、条款、支持分类和工单入口。
- `marketing`：定价、企业、实验室、关于、招聘与生态页面。
- `data` / `product`：数据、发现、对比与模型合集。
- `fusion`：模型融合的固定控制界面；用户输入和生成结果永不在线翻译。
- `footer`：页脚栏目与站点链接。
- `accessibility`：按钮说明、占位符和辅助标签。

模型名、供应商名、模型 slug、API 路径、代码块和指标缩写会保留原文。

## 源码结构

`openrouter-zh-cny.user.js` 是提交到仓库并供 Tampermonkey 安装的生成文件。
开发时不要直接编辑它，应修改 `src/` 后运行 `npm run build`。

- `src/locales/zh-CN/`：按页面区域拆分的固定界面词典与动态句式。
- `src/entities/`：稳定实体目录、路由身份识别和页面动态别名发现。
- `src/privacy/`：公开页面判定、敏感信息保护和 DOM 私密区域规则。
- `src/translation/`：离线词典翻译、在线正文翻译及其 DOM 处理。
- `src/pricing/` / `src/rates/`：价格识别、人民币换算与行情服务。
- `src/runtime/` / `src/ui/`：页面扫描生命周期、状态和设置面板。
- `src/manifest.json`：源码拼接顺序，也是模块依赖顺序。
- `scripts/build.js`：生成根目录用户脚本并校验版本与语法。

GitHub `main` 分支中的 `openrouter-zh-cny.user.js` 是 Tampermonkey 的安装与自动更新源。

详细设计见 [架构说明](docs/ARCHITECTURE.md)。

## 翻译与隐私

固定 UI 文案只使用内置模块化词典。开启“页面内容中文”后，脚本会把公开页面中未命中词典的英文正文和可访问属性发送到 Google 翻译。品牌、模型 ID、价格、URL、邮箱、代码和常见技术缩写会先用占位符保护。

公开正文覆盖首页、模型与模型子页面、作者页、供应商详情、Benchmark、排行榜、应用、文档、博客和法律页面。模型名、供应商名与 Benchmark 专名始终保留原文。

`/chat`、`/fusion`、账户、账单、API Key、用户输入、生成结果和私有 Activity 页面不会发送普通正文或属性。公开文档中对 API Key、密码或邮箱的说明可以翻译，但实际密钥、令牌和凭据始终拒绝发送。

Google 的公开翻译端点不是有 SLA 的正式产品接口，失败时脚本会保留英文原文。

## 许可证

本项目源代码公开（source-available），按 [PolyForm Noncommercial License
1.0.0](LICENSE) 授权，仅可用于该许可证定义的非商业目的。本项目不是 OSI 定义的
开源软件。

复制、修改或再分发时，必须同时保留许可证条款或官方链接，以及项目的
[Required Notice](NOTICE)。商业用途不在本许可证授权范围内，需要另行取得书面许可；
具体适用范围以许可证原文为准。

## 开发

需要 Node.js 20 或 22。项目没有运行时依赖。

```bash
npm run build
npm run check
npm test
```

常用命令：

- `npm run build`：按 `src/manifest.json` 生成 `openrouter-zh-cny.user.js`。
- `npm run check`：依次检查构建产物、词典并运行离线单元测试。
- `npm run check:build`：确认生成文件与 `src/` 完全一致。
- `npm run check:locales`：检查词典模块顺序以及词条基本格式。
- `npm test`：使用 Node.js 内置测试运行器执行离线单元测试。
- `npm run verify:live-entities`：校验从真实 OpenRouter 桌面、移动和 Compare 页面采集的实体快照；不等同于浏览器页面验收。
- `npm run fixture`：启动本地开发夹具，仅用于调试，不属于页面验收。

`npm test` 和本地 fixture 都不能替代真实页面验收。涉及路由、实体识别、
DOM 结构、价格增强或隐私边界的变更，必须在 `https://openrouter.ai` 的真实页面上验证。
完整流程见 [真实页面验收](docs/LIVE_TESTING.md)。

参与开发前请阅读 [贡献指南](CONTRIBUTING.md)。
