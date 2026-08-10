  async function fetchYahooQuote(symbol, interval, range) {
    const encoded = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=${interval}&range=${range}`;
    const payload = await requestJson(url);
    const quote = parseYahooChart(payload, symbol);
    if (!quote) throw new Error(`Yahoo ${symbol} 行情无效`);
    const normalizedSymbol = String(quote.symbol || "").toUpperCase();
    if (normalizedSymbol !== symbol.toUpperCase()) {
      throw new Error(`Yahoo 返回了错误标的：${quote.symbol || "unknown"}`);
    }
    const age = Date.now() - quote.asOf;
    const isFiat = symbol === "CNY=X";
    const inRange = isFiat
      ? quote.price >= 1 && quote.price <= 20
      : quote.price >= 0.5 && quote.price <= 1.5;
    const maxAge = isFiat ? 7 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
    if (!inRange || age < -5 * 60 * 1000 || age > maxAge) {
      throw new Error(`Yahoo ${symbol} 行情越界或过期`);
    }
    return quote;
  }

  async function fetchFrankfurterUsdCny() {
    const payload = await requestJson("https://api.frankfurter.dev/v2/rate/USD/CNY");
    const quote = parseFrankfurterRate(payload);
    if (!quote) throw new Error("Frankfurter 汇率无效");
    return quote;
  }

  function manualRates() {
    const now = Date.now();
    return {
      usdCny: settings.manualUsdCny,
      usdcUsd: settings.manualUsdcUsd,
      usdcCny: settings.manualUsdCny * settings.manualUsdcUsd,
      source: "手动汇率",
      usdcSource: "手动汇率",
      asOf: now,
      usdcAsOf: now,
      fetchedAt: now,
      usdFetchedAt: now,
      usdcFetchedAt: now,
      checkedAt: now,
      status: "manual",
      usdcStatus: "manual",
    };
  }

  function normalizeCachedRates(candidate, now = Date.now()) {
    if (!candidate || typeof candidate !== "object") return null;
    const usdCny = Number(candidate.usdCny);
    const usdcUsd = Number(candidate.usdcUsd);
    const usdFetchedAt = Number(candidate.usdFetchedAt || candidate.fetchedAt);
    const usdcFetchedAt = Number(candidate.usdcFetchedAt || candidate.fetchedAt);
    if (!Number.isFinite(usdCny) || usdCny < 1 || usdCny > 20) return null;
    if (!Number.isFinite(usdcUsd) || usdcUsd < 0.5 || usdcUsd > 1.5) return null;
    if (!Number.isFinite(usdFetchedAt) || now - usdFetchedAt > RATE_MAX_STALE_MS) return null;
    const usdcIsFresh = Number.isFinite(usdcFetchedAt) && now - usdcFetchedAt <= 60 * 60 * 1000;
    const effectiveUsdcUsd = usdcIsFresh ? usdcUsd : 1;
    return {
      ...candidate,
      usdCny,
      usdcUsd: effectiveUsdcUsd,
      usdcCny: usdCny * effectiveUsdcUsd,
      fetchedAt: usdFetchedAt,
      usdFetchedAt,
      usdcFetchedAt,
      status: now - usdFetchedAt > RATE_TTL_MS ? "stale" : candidate.status || "live",
      usdcStatus: usdcIsFresh ? candidate.usdcStatus || "live" : "peg-assumption",
      usdcSource: usdcIsFresh ? candidate.usdcSource || "Yahoo Finance 推导" : "1 USDC≈1 USD 锚定估算",
    };
  }

  async function loadRates({ force = false } = {}) {
    if (settings.rateMode === "manual") {
      rateGeneration += 1;
      ratePromise = null;
      rates = manualRates();
      refreshPanel();
      scheduleFullScan();
      return rates;
    }

    const now = Date.now();
    const cached = normalizeCachedRates(readValue(RATE_CACHE_KEY, null), now);
    if (!force && cached && now - cached.usdFetchedAt < RATE_TTL_MS) {
      rates = cached;
      refreshPanel();
      scheduleFullScan();
      return cached;
    }

    const lastAttempt = Number(readValue(RATE_ATTEMPT_KEY, 0));
    if (!force && now - lastAttempt < RATE_RETRY_COOLDOWN_MS) {
      rates = cached;
      refreshPanel();
      scheduleFullScan();
      return cached;
    }

    if (ratePromise) return ratePromise;
    const generation = ++rateGeneration;
    writeValue(RATE_ATTEMPT_KEY, now);
    setRateStatus("正在更新 Yahoo 行情...");

    const activePromise = (async () => {
      const [fiatResult, usdcResult] = await Promise.allSettled([
        fetchYahooQuote("CNY=X", "1d", "5d"),
        fetchYahooQuote("USDC-USD", "5m", "1d"),
      ]);

      let usdCnyQuote = fiatResult.status === "fulfilled" ? fiatResult.value : null;
      let usdcUsdQuote = usdcResult.status === "fulfilled" ? usdcResult.value : null;
      let source = "Yahoo Finance";
      let status = "live";
      let usdcStatus = "live";
      let usdFetchedAt = now;
      let usdcFetchedAt = now;

      if (!usdCnyQuote) {
        try {
          usdCnyQuote = await fetchFrankfurterUsdCny();
          source = "Frankfurter 回退";
          status = "fallback";
        } catch {
          usdCnyQuote = cached
            ? { price: cached.usdCny, asOf: cached.asOf || cached.usdFetchedAt }
            : null;
          usdFetchedAt = cached?.usdFetchedAt || 0;
          source = cached?.source || "无可用汇率";
          status = cached ? "stale" : "unavailable";
        }
      }

      if (!usdcUsdQuote) {
        if (
          cached &&
          cached.usdcStatus !== "peg-assumption" &&
          now - cached.usdcFetchedAt <= 60 * 60 * 1000
        ) {
          usdcUsdQuote = { price: cached.usdcUsd, asOf: cached.usdcAsOf || cached.usdcFetchedAt };
          usdcFetchedAt = cached.usdcFetchedAt;
          usdcStatus = "stale";
        } else {
          usdcUsdQuote = { price: 1, asOf: now };
          usdcStatus = "peg-assumption";
        }
      }

      if (!usdCnyQuote) {
        if (generation !== rateGeneration || settings.rateMode !== "yahoo") return rates;
        rates = null;
        restorePrices();
        refreshPanel();
        setRateStatus("暂无可用汇率，仅显示官方美元价");
        scheduleFullScan();
        return null;
      }

      const nextRates = {
        usdCny: usdCnyQuote.price,
        usdcUsd: usdcUsdQuote.price,
        usdcCny: usdCnyQuote.price * usdcUsdQuote.price,
        source,
        usdcSource:
          usdcStatus === "live"
            ? "Yahoo Finance 推导"
            : usdcStatus === "stale"
              ? "Yahoo Finance 缓存"
              : "1 USDC≈1 USD 锚定估算",
        asOf: usdCnyQuote.asOf,
        usdcAsOf: usdcUsdQuote.asOf,
        fetchedAt: usdFetchedAt,
        usdFetchedAt,
        usdcFetchedAt,
        checkedAt: now,
        status,
        usdcStatus,
      };

      if (generation !== rateGeneration || settings.rateMode !== "yahoo") return rates;
      rates = nextRates;
      writeValue(RATE_CACHE_KEY, nextRates);
      refreshPanel();
      scheduleFullScan();
      return nextRates;
    })();
    let wrappedPromise;
    wrappedPromise = activePromise.finally(() => {
      if (ratePromise === wrappedPromise) ratePromise = null;
    });
    ratePromise = wrappedPromise;

    return ratePromise;
  }

