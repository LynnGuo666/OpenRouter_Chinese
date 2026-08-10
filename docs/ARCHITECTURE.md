# 架构说明

## 设计目标

项目同时满足两个约束：

1. 开发源码按职责拆分，词典、实体、隐私、价格和运行时可以独立维护。
2. Tampermonkey 最终只安装一个无运行时依赖的 `openrouter-zh-cny.user.js`。

因此 `src/` 中的文件不是独立发布包，而是同一用户脚本闭包内的有序源码片段。
`src/bootstrap.js` 打开闭包，`src/entry.js` 完成启动并关闭闭包。

## 构建模型

`scripts/build.js` 按 `src/manifest.json` 的顺序读取并拼接源码，然后：

- 用 `package.json` 的版本替换 `__VERSION__`；
- 校验 package、用户脚本元数据和运行时版本一致；
- 使用 Node.js `vm.Script` 做最终语法检查；
- 生成根目录 `openrouter-zh-cny.user.js`。

构建过程不转译代码，也不解析模块导入。新增源码文件时，必须把它放在所有依赖项之后、
所有使用方之前。`npm run check:build` 会拒绝过期的生成文件。

根目录用户脚本是发布物，不是源码入口。所有业务改动都应从 `src/` 发起，再运行：

```bash
npm run build
npm run check
```

## 模块边界

```text
src/
├── userscript.meta.js       Tampermonkey 元数据
├── bootstrap.js             闭包、版本、缓存键和全局常量
├── config/                  路由策略与设置收敛
├── locales/zh-CN/           页面域词典、模板和词典注册表
├── entities/                稳定目录、canonical 身份、别名发现
├── privacy/                 内容发送策略与私密 DOM 判定
├── pricing/                 美元价格解析、换算和 DOM 增强
├── rates/                   Yahoo/Frankfurter 解析与行情生命周期
├── platform/                GM/localStorage 和 HTTP 适配
├── translation/             静态与在线翻译流程
├── runtime/                 共享状态、扫描调度和路由生命周期
├── ui/                      设置面板与页面样式
├── core/public-api.js       Node 单元测试使用的纯逻辑出口
└── entry.js                 浏览器启动入口
```

主要数据流如下：

```text
[boot]
  ├── [设置面板] ──→ 设置 / 行情 / 重新扫描
  └── [路由与 MutationObserver]
          ↓
      [页面实体发现]
          ↓
      [scanRoot]
       ├── 固定 UI 词典翻译
       ├── 美元价格追加人民币参考价
       └── 公开正文候选
              ↓
          隐私策略 → 实体占位符 → 在线翻译 → 恢复实体
```

## 翻译模块

每个页面域词典位于 `src/locales/zh-CN/`。`index.js` 以稳定顺序组装
`UI_TRANSLATION_MODULES`，`registry.js` 为每个模块建立大小写无关查找表。

页面使用哪些词典由路由映射决定。导航、页脚和无障碍属性拥有独立模块，避免把所有词条
放进一个全局命名空间。带变量的句式位于 `templates.js`，例如模型名、供应商名和数量。

同一英文短词在不同页面域可以有不同译文。新增重复词条时必须确认路由上下文明确，不能
依赖全局词典的后写覆盖顺序。

## 实体识别

实体系统的目标不是翻译名称，而是为模型、供应商和模型家族建立稳定身份，并把页面中的
所有显示别名保护起来。

### 稳定目录

`src/entities/catalog.js` 是人工维护的稳定目录：

- `providers`：长期稳定、跨页面出现的供应商名称；
- `modelFamilies`：Claude、GPT、Llama 等稳定模型家族；
- `stableLabels`：Benchmark、品牌、协议和技术名词，仅用于固定保护集合。

供应商与模型家族会作为 `createEntityRegistry()` 的持久种子。
具体且频繁变化的单个模型不应批量硬编码进稳定目录，应由路由和真实 DOM 动态发现。

### 路由 canonical ID

路由提供与页面展示文案无关的 canonical 身份。路径段会先安全解码：

| 真实路由 | 实体 | canonical ID |
| --- | --- | --- |
| `/{provider}/{model}` | 模型 | `{provider}/{model}` |
| `/models/{provider}/{model}` | 模型 | `{provider}/{model}` |
| `/compare/{p1}/{m1}/{p2}/{m2}` | 两个模型 | `p1/m1`、`p2/m2` |
| `/provider/{provider}` | 供应商 | `{provider}` |
| `/providers/{provider}` | 供应商 | `{provider}` |
| `/{author}` | 作者/供应商候选 | `{author}` |

路由提示同时生成 slug 原文、去掉前导 `~` 的形式和把 `-` / `_` 换成空格的显示提示。
canonical ID 始终保留路由身份，不应替换成某次渲染得到的短标题。

### DOM 动态别名

实体记录结构为：

```js
{
  kind,         // provider | model | model-family
  canonicalId,  // 路由或稳定目录提供的身份
  canonicalSource,
  displayName,  // 当前采用的展示名
  aliases,      // 页面上观察到的完整名、短名和 slug
  source,       // route | runtime | dom | catalog | manual
  route,
}
```

注册表按 `kind + canonicalId` 合并记录，canonical 键只统一大小写与 Unicode 形式，保留
`/`、`-`、`:`、`~` 等路由语义，避免不同模型 ID 被压成同一个键。别名使用 Set 去重。

展示名与 canonical ID 使用独立来源优先级：目录可以决定稳定展示名，真实路由则优先决定
canonical ID。这样 `OpenAI` 仍以官方大小写显示，但 `/provider/openai` 的身份保持为
`openai`。已有别名始终合并。

`discoverPageEntities()` 从以下真实结构补充别名：

- 模型或供应商详情页的 `#model-title-row h1` / `main h1`；
- 指向模型或供应商 canonical 路由的卡片链接；
- 标题、`aria-label`、`title`、相关 `data-testid`；
- 链接内图片的 `alt`；
- `#providers` 表格及 `data-provider-name`；
- Compare 页面模型选择器中的完整名和短名。

`Provider: Model Name` 形式会同时登记供应商、完整模型名和 `Model Name` 短别名。
实体发现发生在固定 UI 与正文翻译之前，不依赖某一个翻译开关。发生客户端路由切换时，
运行时先清除动态记录，再根据新路由重新登记提示；稳定目录不会清除。

在线翻译前，注册表会在正文中执行最长别名优先匹配，重叠的短别名不会重复占位。

## 隐私边界

固定 UI 词典始终离线。在线正文翻译只有同时满足以下条件才会发起：

- 当前路由被判定为公开内容页面；
- 节点不在表单、输入区、聊天消息或用户数据区域；
- 文本不是凭据、令牌、邮箱、UUID 或其他敏感标识；
- 模型、供应商、价格、URL、代码和技术名词已转换为占位符。

`/chat`、`/fusion`、账户、账单、密钥、组织、设置等私有路由不能发送普通正文。
已知公开路由使用显式白名单；未知的单段或两段动态路由即使拥有自指 canonical，也必须同时
出现模型标题、`#providers` 或真实模型卡片等页面结构才能在线翻译，否则默认拒绝发送。
修改 `src/config/routes.js`、`src/privacy/` 或在线翻译调用链时，必须执行真实页面隐私验收。

## 测试边界

- `npm test` 验证可从生成脚本导出的纯逻辑，不操作真实页面。
- `npm run fixture` 仅提供本地 DOM 调试环境，不是发布验收证据。
- `npm run verify:live-entities` 校验真实页面来源 URL、canonical 路由、动态别名、占位符和价格。
- DOM、路由和视觉行为必须在 `https://openrouter.ai` 上人工或通过浏览器自动化验收。

具体步骤见 [真实页面验收](LIVE_TESTING.md)。
