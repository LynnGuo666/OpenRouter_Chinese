  function parseYahooChart(payload, symbol) {
    const result = payload?.chart?.result?.[0];
    if (!result || payload?.chart?.error) return null;

    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const closes = result.indicators?.quote?.[0]?.close;
    let price = Number(result.meta?.regularMarketPrice);
    let timestamp = Number(result.meta?.regularMarketTime) * 1000;

    if (!Number.isFinite(price) && Array.isArray(closes)) {
      for (let index = closes.length - 1; index >= 0; index -= 1) {
        const close = Number(closes[index]);
        if (Number.isFinite(close)) {
          price = close;
          timestamp = Number(timestamps[index]) * 1000;
          break;
        }
      }
    }

    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      symbol: result.meta?.symbol || symbol,
      price,
      currency: result.meta?.currency || null,
      asOf: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    };
  }

  function parseFrankfurterRate(payload) {
    const direct = Number(payload?.rate);
    const legacy = Number(payload?.rates?.CNY);
    const rate = Number.isFinite(direct) ? direct : legacy;
    if (!Number.isFinite(rate) || rate < 1 || rate > 20) return null;
    return {
      price: rate,
      asOf: payload?.date ? Date.parse(`${payload.date}T00:00:00Z`) : Date.now(),
    };
  }

