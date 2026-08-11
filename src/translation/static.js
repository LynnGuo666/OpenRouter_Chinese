  function isValidEnglishClock(value) {
    const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59;
  }

  function isValidEnglishMonthDay(month, day, year = null) {
    const numericDay = Number(day);
    if (!Number.isInteger(numericDay) || numericDay < 1) return false;
    const leapYear =
      year === null ||
      (Number(year) % 4 === 0 &&
        (Number(year) % 100 !== 0 || Number(year) % 400 === 0));
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return numericDay <= daysInMonth[month - 1];
  }

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

    const dateTimeRangeMatch = trimmed.match(
      /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{1,2}:\d{2})\s*(am|pm)\s*[–-]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{1,2}:\d{2})\s*(am|pm)$/i,
    );
    if (dateTimeRangeMatch) {
      const startMonth = MONTH_NUMBERS[dateTimeRangeMatch[1].toLowerCase()];
      const endMonth = MONTH_NUMBERS[dateTimeRangeMatch[5].toLowerCase()];
      if (
        startMonth &&
        endMonth &&
        isValidEnglishMonthDay(startMonth, dateTimeRangeMatch[2]) &&
        isValidEnglishMonthDay(endMonth, dateTimeRangeMatch[6]) &&
        isValidEnglishClock(dateTimeRangeMatch[3]) &&
        isValidEnglishClock(dateTimeRangeMatch[7])
      ) {
        const period = { am: "上午", pm: "下午" };
        return (
          `${startMonth}月${Number(dateTimeRangeMatch[2])}日 ` +
          `${period[dateTimeRangeMatch[4].toLowerCase()]} ${dateTimeRangeMatch[3]} – ` +
          `${endMonth}月${Number(dateTimeRangeMatch[6])}日 ` +
          `${period[dateTimeRangeMatch[8].toLowerCase()]} ${dateTimeRangeMatch[7]}`
        );
      }
    }

    const dateTimeMatch = trimmed.match(
      /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}:\d{2})\s*(am|pm)$/i,
    );
    if (dateTimeMatch) {
      const month = MONTH_NUMBERS[dateTimeMatch[1].toLowerCase()];
      const period = { am: "上午", pm: "下午" }[dateTimeMatch[5].toLowerCase()];
      if (
        month &&
        isValidEnglishMonthDay(month, dateTimeMatch[2], dateTimeMatch[3]) &&
        isValidEnglishClock(dateTimeMatch[4])
      ) {
        return `${dateTimeMatch[3]}年${month}月${Number(dateTimeMatch[2])}日 ${period} ${dateTimeMatch[4]}`;
      }
    }

    const dateMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
    if (dateMatch) {
      const month = MONTH_NUMBERS[dateMatch[1].toLowerCase()];
      if (month && isValidEnglishMonthDay(month, dateMatch[2], dateMatch[3] || null)) {
        return dateMatch[3]
          ? `${dateMatch[3]}年${month}月${Number(dateMatch[2])}日`
          : `${month}月${Number(dateMatch[2])}日`;
      }
    }

    return null;
  }
