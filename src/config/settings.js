  function clampSettings(value) {
    const candidate = value && typeof value === "object" ? value : {};
    const manualUsdCny = Number(candidate.manualUsdCny);
    const manualUsdcUsd = Number(candidate.manualUsdcUsd);

    const booleanSetting = (key) =>
      typeof candidate[key] === "boolean" ? candidate[key] : DEFAULT_SETTINGS[key];

    return {
      ...DEFAULT_SETTINGS,
      ...candidate,
      enabled: booleanSetting("enabled"),
      translateUi: booleanSetting("translateUi"),
      translateContent: booleanSetting("translateContent"),
      showCny: booleanSetting("showCny"),
      rateMode: candidate.rateMode === "manual" ? "manual" : "yahoo",
      manualUsdCny:
        Number.isFinite(manualUsdCny) && manualUsdCny >= 1 && manualUsdCny <= 20
          ? manualUsdCny
          : DEFAULT_SETTINGS.manualUsdCny,
      manualUsdcUsd:
        Number.isFinite(manualUsdcUsd) && manualUsdcUsd >= 0.5 && manualUsdcUsd <= 1.5
          ? manualUsdcUsd
          : DEFAULT_SETTINGS.manualUsdcUsd,
    };
  }

