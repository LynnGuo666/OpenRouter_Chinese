  const Core = Object.freeze({
    ENTITY_CATALOG,
    UI_TRANSLATION_MODULES,
    calculatePriceQuote,
    clampSettings,
    compareModelSlugs,
    createEntityRegistry,
    entityCandidateText,
    extractEntityNamesFromPath,
    formatCnyPrice,
    formatNumber,
    isPublicContentPath,
    isAuthorEntityPath,
    isCompareModelLabel,
    isEntityLabelForPath,
    isKnownModelName,
    isKnownProviderName,
    isModelEntityPath,
    isPublicContentDocument,
    isSensitiveText,
    isTargetPath,
    maskProtectedTranslationText,
    parseDisplayedPrice,
    parseDisplayedPrices,
    parsePriceContainerText,
    parseSplitDisplayedPrice,
    parseFrankfurterRate,
    parseYahooChart,
    providerCandidateText,
    registerModelCandidate,
    registerProviderCandidate,
    restoreProtectedTranslationText,
    shouldTranslateOnlineText,
    splitTranslationText,
    translationModuleNamesForPath,
    translateStaticValue,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Core;
  }

  if (typeof window === "undefined" || typeof document === "undefined") return;
