# OpenRouter 中文与人民币价格

一个零依赖 Tampermonkey 用户脚本，用来增强 OpenRouter 的模型列表、模型详情和对比页。

## 功能

- 用内置词典翻译常见界面文案，不发送页面数据。
- 保留 OpenRouter 官方美元价，并追加人民币估价。
- 正文价格只保留官网 `$` 并追加简洁的 `¥` 参考价。
- 顶部“译”菜单显示 `USD/CNY`、`USDC/USD` 和推导出的 `USDC/CNY`。
- 按导航、模型列表、详情、供应商、性能和页脚模块翻译常见界面文案。
- 默认翻译公开页面中的英文长文，可在顶部“译”菜单关闭。
- 兼容 OpenRouter 的客户端路由、懒加载和列表虚拟化。

## 安装

1. 在浏览器中安装 Tampermonkey。
2. 新建用户脚本。
3. 将 `openrouter-zh-cny.user.js` 的完整内容粘贴进去并保存。
4. 打开 [OpenRouter Models](https://openrouter.ai/models)，点击顶部导航的“译”按钮调整设置。

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
- `catalog`：模型列表、筛选、排序和模态。
- `details`：模型详情、上下文与价格标签。
- `providers`：供应商表格、隐私状态和路由选项。
- `metrics`：性能、可用率、基准测试和使用趋势。
- `footer`：页脚栏目与站点链接。
- `accessibility`：按钮说明、占位符和辅助标签。

模型名、供应商名、模型 slug、API 路径、代码块和指标缩写会保留原文。

## 翻译与隐私

固定 UI 文案只使用内置模块化词典。开启“页面内容中文”后，脚本会把模型列表、模型详情、供应商、性能、可用率和 FAQ 中的公开英文段落发送到 Google 翻译；不会处理 `/chat`、账户、账单、API Key、代码块或私有 Activity 页面。

Google 的公开翻译端点不是有 SLA 的正式产品接口，失败时脚本会保留英文原文。

## 开发

```bash
npm test
```

测试使用 Node.js 内置测试运行器，不需要安装第三方依赖。
