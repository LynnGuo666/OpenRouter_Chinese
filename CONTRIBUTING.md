# 贡献指南

感谢参与 OpenRouter 中文与人民币价格脚本。项目的源码与发布物分离，提交前请遵守下面的
构建、隐私和真实页面验收约束。

## 开发环境

- Node.js 20 或 22；
- Tampermonkey；
- 能访问 `https://openrouter.ai` 真实页面的浏览器。

项目当前没有第三方运行时依赖。先确认基线：

```bash
npm run check
```

## 修改流程

1. 只在 `src/` 修改业务源码，不直接编辑根目录 `openrouter-zh-cny.user.js`。
2. 新增源码片段时同步更新 `src/manifest.json`，并保证定义先于使用。
3. 运行 `npm run build` 生成发布脚本。
4. 运行 `npm run check` 验证生成文件、词典和单元测试。
5. 按变更范围执行真实 OpenRouter 页面验收。
6. 提交 `src/` 改动和同步生成的 `openrouter-zh-cny.user.js`。

构建或测试失败时不要手工修补生成文件，应回到对应 `src/` 模块修复。

## 发布与版本

GitHub `main` 分支中的 `openrouter-zh-cny.user.js` 是 Tampermonkey 的自动更新源。
任何会改变生成脚本内容的发布都必须先提升 `package.json` 版本，再运行 `npm run build`
和 `npm run check`。不要在同一版本号下多次覆盖发布文件。

## 模块约定

- 配置与路由规则放在 `src/config/`。
- 固定译文放在最具体的 `src/locales/zh-CN/` 页面域文件。
- 含变量的动态句式放在 `templates.js`，不得把模型名或供应商名写死进译文。
- 稳定实体目录、路由身份与 DOM 动态发现分别放在 `entities/catalog.js`、
  `entities/recognizer.js` 和 `entities/discovery.js`。
- 价格纯逻辑与 DOM 修改分离在 `pricing/core.js` 和 `pricing/dom.js`。
- 网络、缓存和 GM API 通过 `platform/` 访问。
- 私密路由或敏感文本规则只能在 `config/routes.js` 与 `privacy/` 中集中维护。

每个源码文件都是同一闭包中的有序片段，不使用隐式循环依赖。需要跨模块共享的新函数，
先放到职责归属明确的模块，再调整 manifest 顺序。

## 翻译贡献

添加固定界面译文时：

1. 在真实页面确认英文原文，包括大小写、空格和标点。
2. 选择与路由最匹配的词典模块，避免无条件加入 `common`。
3. 保留品牌、模型、供应商、Benchmark、API 路径和代码原文。
4. 同一英文词在多个页面域译法不同时，补充带模块上下文的单元测试。
5. 运行 `npm run check:locales` 和 `npm test`。

不要为了覆盖一次性动态文案而无限扩充固定目录。带数量、日期、模型名或供应商名的句子应
优先使用模板，公开长文则由受隐私策略约束的在线翻译处理。

## 实体贡献

实体系统分为三层：

- 稳定目录：长期稳定的供应商、模型家族和技术专名；
- 路由 canonical ID：由 OpenRouter URL 提供稳定身份；
- DOM 动态别名：从真实标题、卡片、表格、图片 alt 和 Compare 控件发现。

仅当名称跨页面长期稳定时才加入 `src/entities/catalog.js`。频繁变化的单个模型应依赖
canonical 路由与动态别名，不要建立需要持续人工追赶的完整模型清单。

修改实体逻辑时必须验证：

- `/{provider}/{model}`、`/models/{provider}/{model}` 与 Compare 路由的 canonical ID；
- `Provider: Model` 完整名、短模型名和 slug 被合并到同一模型记录；
- 动态实体在路由切换后清理，稳定目录仍保留；
- 实体进入在线翻译占位符且能无损恢复；
- 普通 UI 词汇不会被误判成模型或供应商。

## 隐私要求

隐私边界优先于翻译覆盖率。以下变更必须额外审查：

- 新增或调整公开/私有路由；
- 修改表单、聊天、用户内容或私密 DOM 选择器；
- 修改敏感信息正则、占位符或在线翻译请求；
- 扩大在线翻译的属性或节点范围。

不得使用真实 API Key、访问令牌、邮箱或账户数据作为测试样本。任何可能把私有页面文本
发送到第三方翻译服务的回归都必须阻断发布。

## 测试层级

- `npm test`：离线单元测试，验证词典、路由、实体、隐私、价格和行情纯逻辑。
- `npm run fixture`：本地 DOM 调试工具，只能辅助开发。
- `npm run verify:live-entities`：验证从真实 OpenRouter 页面采集的结构化快照。
- 真实页面行为检查：验证当前 DOM、SPA 路由、懒加载、恢复逻辑和视觉结果。

**本地 fixture 和 Test 页面不得作为页面验收。** 涉及 DOM、路由、实体、价格或隐私的
变更，请严格执行 [真实页面验收](docs/LIVE_TESTING.md)。

## 提交前检查

```bash
npm run build
npm run check
```

PR 描述应包含：

- 变更范围和行为影响；
- 新增或调整的测试；
- 构建与检查结果；
- 需要真实页面验收时的日期、真实 URL、样本数与结果；
- 隐私相关变更的风险说明；
- 生成文件已与 `src/` 同步的确认。

不提交 Cookie、令牌、账户页面快照、浏览器配置或含个人数据的日志。
