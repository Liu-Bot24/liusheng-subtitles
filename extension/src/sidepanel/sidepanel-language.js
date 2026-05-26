const FuguangSidepanelLanguage = (() => {
  const TARGET_LANGUAGES = Object.freeze([
    { code: "zh-CN", labelKeys: { zh: "targetChinese", en: "targetChinese" } },
    { code: "en", labelKeys: { zh: "targetEnglish", en: "targetEnglish" } },
    { code: "ja", labelKeys: { zh: "langJapanese", en: "langJapanese" } },
    { code: "fr", labelKeys: { zh: "langFrench", en: "langFrench" } },
    { code: "ko", labelKeys: { zh: "langKorean", en: "langKorean" } },
    { code: "de", labelKeys: { zh: "langGerman", en: "langGerman" } },
    { code: "ru", labelKeys: { zh: "langRussian", en: "langRussian" } }
  ]);
  const SOURCE_LANGUAGES = Object.freeze([
    { code: "auto", labelKeys: { zh: "sourceAuto", en: "sourceAuto" } },
    { code: "zh", labelKeys: { zh: "langChinese", en: "langChinese" } },
    { code: "en", labelKeys: { zh: "langEnglish", en: "langEnglish" } },
    { code: "ja", labelKeys: { zh: "langJapanese", en: "langJapanese" } },
    { code: "ko", labelKeys: { zh: "langKorean", en: "langKorean" } },
    { code: "fr", labelKeys: { zh: "langFrench", en: "langFrench" } },
    { code: "de", labelKeys: { zh: "langGerman", en: "langGerman" } },
    { code: "ru", labelKeys: { zh: "langRussian", en: "langRussian" } },
    { code: "es", labelKeys: { zh: "langSpanish", en: "langSpanish" } },
    { code: "pt", labelKeys: { zh: "langPortuguese", en: "langPortuguese" } },
    { code: "it", labelKeys: { zh: "langItalian", en: "langItalian" } }
  ]);
  const TARGET_LANGUAGE_CODES = new Set(TARGET_LANGUAGES.map(language => language.code));
  const SOURCE_LANGUAGE_CODES = new Set(SOURCE_LANGUAGES.map(language => language.code));

  function normalizeTargetLanguageValue(value, fallback = "zh-CN") {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }
    return TARGET_LANGUAGE_CODES.has(text) ? text : fallback;
  }

  function normalizeSourceLanguageValue(value, fallback = "auto") {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }
    return SOURCE_LANGUAGE_CODES.has(text) ? text : fallback;
  }

  return {
    targetLanguages: TARGET_LANGUAGES,
    sourceLanguages: SOURCE_LANGUAGES,
    normalizeTargetLanguageValue,
    normalizeSourceLanguageValue
  };
})();
