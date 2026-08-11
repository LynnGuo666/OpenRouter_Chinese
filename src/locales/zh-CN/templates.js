  const UI_TRANSLATION_TEMPLATES = Object.freeze([
    {
      pattern: /^(.+?)\s+vs\s+(.+)$/i,
      render: ([, left, right]) => `${left} 与 ${right}`,
    },
    {
      pattern: /^Browse models provided by\s+(.+)$/i,
      render: ([, provider]) => `浏览 ${provider} 提供的模型`,
    },
    {
      pattern: /^(.+)\s+tokens processed on OpenRouter$/i,
      render: ([, provider]) => `${provider} 在 OpenRouter 上已处理的令牌`,
    },
    {
      pattern: /^More models from\s+(.+)$/i,
      render: ([, provider]) => `更多来自 ${provider} 的模型`,
    },
    {
      pattern: /^What is the context length of\s+(.+)\?$/i,
      render: ([, subject]) => `${subject} 的上下文长度是多少？`,
    },
    {
      pattern: /^What inputs and outputs does\s+(.+)\s+support\?$/i,
      render: ([, subject]) => `${subject} 支持哪些输入和输出？`,
    },
    {
      pattern: /^What other\s+(.+)\s+models does\s+(.+)\s+have\?$/i,
      render: ([, modality, provider]) =>
        `${provider} 还有哪些${UI_TRANSLATION_MODULE_LOOKUPS.catalog.get(modality.toLocaleLowerCase()) || modality}模型？`,
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
      pattern: /^Show\s+(\d+)\s+more$/i,
      render: ([, amount]) => `再显示 ${amount} 项`,
    },
    {
      pattern: /^Find a model to pin,\s*(\d+)\s+of\s+5\s+pinned$/i,
      render: ([, amount]) => `搜索要固定的模型，已固定 ${amount}/5`,
    },
    {
      pattern: /^(\d+)\s+turns?:\s*(\$[\d,.]+)$/i,
      render: ([, turns, amount]) => `${turns} 轮：${amount}`,
    },
    {
      pattern: /^(\d+(?:\.\d+)?)%\s+of all spend$/i,
      render: ([, amount]) => `占全部支出的 ${amount}%`,
    },
    {
      pattern: /^Change in tokens processed in (the last (?:day|week|month)) from the previous period$/i,
      render: ([, , period]) => {
        const periodZh = { day: "过去一天", week: "过去一周", month: "过去一个月" }[
          period.toLowerCase()
        ];
        return `${periodZh}处理的令牌量相较上一周期的变化`;
      },
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
      pattern: /^([\d.]+[KMBT]?)\+ active models on ([\d.]+[KMBT]?)\+ providers$/i,
      render: ([, models, providers]) => `${models}+ 个活跃模型，来自 ${providers}+ 个供应商`,
    },
    {
      pattern: /^([\d.]+[KMBT]?)\+ apps using OpenRouter with ([\d.]+[KMBT]?)\+ users globally$/i,
      render: ([, apps, users]) => `全球 ${users}+ 用户通过 OpenRouter 使用 ${apps}+ 个应用`,
    },
    {
      pattern: /^Better than\s+(\d+(?:\.\d+)?)%\s+of models compared$/i,
      render: ([, amount]) => `优于 ${amount}% 的参评模型`,
    },
    {
      pattern: /^Avg\. Provider Uptime \((\d+)d\)$/i,
      render: ([, days]) => `供应商平均可用率（${days} 天）`,
    },
    {
      pattern: /^Avg\. OpenRouter Uptime \((\d+)d\)$/i,
      render: ([, days]) => `OpenRouter 平均可用率（${days} 天）`,
    },
    {
      pattern: /^\+(\d+)\s+Categories$/i,
      render: ([, amount]) => `+${amount} 类别`,
    },
    {
      pattern: /^Open\s+(.+)\s+details$/i,
      render: ([, subject]) => `打开 ${subject} 详情`,
    },
    {
      pattern: /^(.+?)\s+—\s+Price History explanation$/i,
      render: ([, subject]) => `${subject} — 价格历史说明`,
    },
    {
      pattern: /^(.+?)\s+—\s+Price History$/i,
      render: ([, subject]) => `${subject} — 价格历史`,
    },
    {
      pattern: /^Toggle\s+(.+?)\s+on price history chart$/i,
      render: ([, provider]) => `在价格历史图表中显示或隐藏 ${provider}`,
    },
    {
      pattern: /^Privacy:\s*(Private|Logs|Trains)$/i,
      render: ([, policy]) => `隐私：${UI_TRANSLATION_MODULES.providers[policy] || policy}`,
    },
    {
      pattern: /^Top\s+(\d+(?:\.\d+)?)\s*%$/i,
      render: ([, amount]) => `前 ${amount}%`,
    },
    {
      pattern: /^More information about\s+(.+)$/i,
      render: ([, benchmark]) => `查看 ${benchmark} 的更多信息`,
    },
    {
      pattern: /^Favicon for\s+(.+)$/i,
      render: ([, subject]) => `${subject} 图标`,
    },
    {
      pattern: /^(.+)\s+preview$/i,
      render: ([, subject]) => `${subject} 预览`,
    },
    {
      pattern: /^Ranked at\s+#?(\d+)\s+in\s+(.+)\s+category$/i,
      render: ([, rank, category]) =>
        `${CATEGORY_LABELS[category] || category}类别排名第 ${rank}`,
    },
    {
      pattern: /^(.+)\s+\(#(\d+)\)$/i,
      render: ([, category, rank]) => {
        const translated = CATEGORY_LABELS[category];
        return translated ? `${translated}（第 ${rank} 名）` : null;
      },
    },
    {
      pattern: /^(\d+(?:\.\d+)?)(?:st|nd|rd|th)\s+percentile$/i,
      render: ([, percentile]) => `第 ${percentile} 百分位`,
    },
    {
      pattern: /^(First|Second|Third|Fourth):?\s+(\d+(?:\.\d+)?)%$/i,
      render: ([, rank, amount]) =>
        `${UI_TRANSLATION_MODULES.metrics[rank]}：${amount}%`,
    },
    {
      pattern: /^Based on\s+([\d.]+[KMBT]?)\s+(requests?|samples?)$/i,
      render: ([, amount, unit]) =>
        `基于 ${amount} ${unit.toLowerCase().startsWith("request") ? "次请求" : "个样本"}`,
    },
    {
      pattern: /^([\d,.]+)\s+tournaments$/i,
      render: ([, amount]) => `${amount} 场锦标赛`,
    },
    {
      pattern: /^(\d[\d,]*)\s+benchmarks?$/i,
      render: ([, amount]) => `${amount} 项基准测试`,
    },
    {
      pattern: /^([\d,]+)\s+task evaluations$/i,
      render: ([, amount]) => `${amount} 次任务评估`,
    },
    {
      pattern: /^(\d+)\s+models$/i,
      render: ([, amount]) => `${amount} 个模型`,
    },
    {
      pattern: /^(\d+)\s+selected$/i,
      render: ([, amount]) => `已选择 ${amount} 个`,
    },
    {
      pattern: /^last run\s+(.+)$/i,
      render: ([, date]) => `最近运行：${translateStaticValue(date) || date}`,
    },
    {
      pattern: /^Last benchmark run\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+(.+)$/i,
      render: ([, monthName, day, year, time]) => {
        const month = MONTH_NUMBERS[monthName.toLowerCase()];
        return month
          ? `最近一次基准测试运行：${year}年${month}月${Number(day)}日 ${time}`
          : `最近一次基准测试运行：${monthName} ${day}, ${year}, ${time}`;
      },
    },
    {
      pattern: /^Metrics sourced from\s+(.+)$/i,
      render: ([, source]) => `指标来源：${source}`,
    },
    {
      pattern: /^(\d+(?:\.\d+)?)%\s+Win$/i,
      render: ([, amount]) => `胜率 ${amount}%`,
    },
    {
      pattern: /^([\d.]+[KMBT]?)\s*[-–]\s*([\d.]+[KMBT]?)\s+tokens$/i,
      render: ([, start, end]) => `${start} - ${end} 令牌`,
    },
    {
      pattern: /^Elo:\s*(.+)$/i,
      render: ([, score]) => `Elo：${score}`,
    },
    {
      pattern: /^(.+)\s+(\d+(?:\.\d+)?)%\s+off for a limited time\. See all discounted models$/i,
      render: ([, models, amount]) => `${models} 限时 ${amount}% 优惠。查看全部折扣模型`,
    },
    {
      pattern: /^Copy link to\s+.+$/i,
      render: () => "复制本节链接",
    },
    {
      pattern: /^(.+?)\s+logo$/i,
      render: ([, subject]) => `${subject} 标志`,
    },
    {
      pattern: /^(\d+)\s+of\s+(\d+)\s+providers$/i,
      render: ([, shown, total]) => `显示 ${shown}/${total} 个供应商`,
    },
    {
      pattern: /^(\d+)\s+of\s+(\d+)$/i,
      render: ([, shown, total]) => `${shown}/${total}`,
    },
    {
      pattern: /^(\d+)\s+day retention$/i,
      render: ([, days]) => `保留 ${days} 天`,
    },
    {
      pattern: /^(\d+)\+\s+(free\s+)?(models|providers)$/i,
      render: ([, amount, free, kind]) =>
        `${amount}+ 个${free ? "免费" : ""}${kind.toLowerCase() === "models" ? "模型" : "供应商"}`,
    },
    {
      pattern: /^(\d+)\s+reqs\/day$/i,
      render: ([, amount]) => `每天 ${amount} 次请求`,
    },
    {
      pattern: /^(\$[\d,.]+)\s+of list price inference\s*\/\s*month with no fees,\s*([\d.]+)%\s+fee after$/i,
      render: ([, amount, fee]) => `每月标价推理额度 ${amount} 内免手续费，超出后收取 ${fee}% 手续费`,
    },
    {
      pattern: /^Last Updated:\s*(.+)$/i,
      render: ([, date]) => `最后更新：${translateStaticValue(date) || date}`,
    },
    {
      pattern: /^Waiting for\s+(.+)$/i,
      render: ([, model]) => `正在等待 ${model}`,
    },
    {
      pattern: /^Step\s+(\d+)$/i,
      render: ([, step]) => `第 ${step} 步`,
    },
    {
      pattern: /^(.+) OpenRouter Usage$/i,
      render: ([, app]) => `${app} 的 OpenRouter 用量`,
    },
    {
      pattern: /^Top models used by (.+) this month$/i,
      render: ([, app]) => `${app} 本月使用最多的模型`,
    },
    {
      pattern: /^#(\d+)\s+in\s+(.+)$/i,
      render: ([, rank, category]) => `${CATEGORY_LABELS[category] || category}排名第 ${rank}`,
    },
    {
      pattern: /^(Text|Image|Embedding|Rerank|Video|Speech|Transcription) Model Rankings$/i,
      render: ([, modality]) =>
        `${UI_TRANSLATION_MODULE_LOOKUPS.catalog.get(modality.toLocaleLowerCase()) || modality}模型排行榜`,
    },
    {
      pattern: /^(Text|Image|Embedding|Rerank|Video|Speech|Transcription) Requests Over Time$/i,
      render: ([, modality]) =>
        `${UI_TRANSLATION_MODULE_LOOKUPS.catalog.get(modality.toLocaleLowerCase()) || modality}请求趋势`,
    },
    {
      pattern: /^Show\s+(.+)$/i,
      render: ([, metric]) => `显示${translateStaticValue(metric) || metric}`,
    },
    {
      pattern: /^(\d+\.)\s+(.+)$/,
      render: ([, number, heading]) => {
        const translated = translateStaticValue(heading);
        return translated ? `${number} ${translated}` : null;
      },
    },
  ]);

  const MONTH_NUMBERS = Object.freeze({
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  });

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
