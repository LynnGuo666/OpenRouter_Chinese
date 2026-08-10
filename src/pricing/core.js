  function parseDisplayedPrice(text) {
    if (typeof text !== "string" || text.length > 160) return null;
    const match = text.match(PRICE_PATTERN);
    if (!match) return null;
    if (match.index > 0 && /[-A-Za-z_]/.test(text[match.index - 1])) return null;
    const nextCharacter = text.slice(match.index + match[0].length).trimStart()[0];
    if (nextCharacter === "/") return null;

    const amount = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount < 0) return null;

    const rawUnit = (match[2] || "").replace(/\s+/g, " ").trim();
    const normalizedUnit = rawUnit.toLowerCase();
    return {
      amount,
      rawUnit,
      unitZh: UNIT_LABELS[normalizedUnit] || rawUnit,
      matchedText: match[0],
      index: match.index || 0,
      isFrom: /^from\s+/i.test(match[0]),
    };
  }

  function decimalPlacesFor(value) {
    const absolute = Math.abs(value);
    if (absolute === 0) return 0;
    if (absolute >= 100) return 2;
    if (absolute >= 1) return 3;
    if (absolute >= 0.01) return 4;
    if (absolute >= 0.0001) return 6;
    return 8;
  }

  function formatNumber(value, maximumFractionDigits = decimalPlacesFor(value)) {
    if (!Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits,
      minimumFractionDigits: 0,
      useGrouping: true,
    }).format(value);
  }

  function formatCnyPrice(value) {
    if (!Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: true,
    }).format(value);
  }

  function calculatePriceQuote(usdAmount, rates) {
    if (!Number.isFinite(usdAmount) || usdAmount < 0 || !rates) return null;
    const usdCny = Number(rates.usdCny);
    const usdcUsd = Number(rates.usdcUsd);
    const cny = Number.isFinite(usdCny) && usdCny > 0 ? usdAmount * usdCny : null;
    const usdc = Number.isFinite(usdcUsd) && usdcUsd > 0 ? usdAmount / usdcUsd : null;
    const usdcCny =
      Number.isFinite(usdCny) && usdCny > 0 && Number.isFinite(usdcUsd) && usdcUsd > 0
        ? usdCny * usdcUsd
        : null;

    return { cny, usdc, usdcCny };
  }

