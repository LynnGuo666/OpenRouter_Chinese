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

    const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (monthYearMatch) {
      const month = MONTH_NUMBERS[monthYearMatch[1].toLowerCase()];
      if (month) return `${monthYearMatch[2]}年${month}月`;
    }

    const dateMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
    if (dateMatch) {
      const month = MONTH_NUMBERS[dateMatch[1].toLowerCase()];
      if (month) {
        return dateMatch[3]
          ? `${dateMatch[3]}年${month}月${Number(dateMatch[2])}日`
          : `${month}月${Number(dateMatch[2])}日`;
      }
    }

    return null;
  }

