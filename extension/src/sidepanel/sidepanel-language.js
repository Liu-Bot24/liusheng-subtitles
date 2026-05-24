const FuguangSidepanelLanguage = (() => {
  const TARGET_LANGUAGE_ALIASES = new Map([
    ["zh-cn", "zh-CN"],
    ["zh-hans", "zh-CN"],
    ["zh", "zh-CN"],
    ["chinese", "zh-CN"],
    ["中文", "zh-CN"],
    ["简体中文", "zh-CN"],
    ["en", "en"],
    ["english", "en"],
    ["英文", "en"],
    ["ja", "ja"],
    ["jp", "ja"],
    ["japanese", "ja"],
    ["日语", "ja"],
    ["fr", "fr"],
    ["french", "fr"],
    ["法语", "fr"],
    ["ko", "ko"],
    ["kr", "ko"],
    ["korean", "ko"],
    ["韩语", "ko"],
    ["de", "de"],
    ["german", "de"],
    ["德语", "de"],
    ["ru", "ru"],
    ["russian", "ru"],
    ["俄语", "ru"]
  ]);
  const SOURCE_LANGUAGE_ALIASES = new Map([
    ["auto", "auto"],
    ["automatic", "auto"],
    ["detect", "auto"],
    ["default", "auto"],
    ["自动", "auto"],
    ["自动识别", "auto"],
    ["zh-cn", "zh"],
    ["zh-hans", "zh"],
    ["zh", "zh"],
    ["chinese", "zh"],
    ["中文", "zh"],
    ["简体中文", "zh"],
    ["en", "en"],
    ["english", "en"],
    ["英语", "en"],
    ["英文", "en"],
    ["ja", "ja"],
    ["jp", "ja"],
    ["japanese", "ja"],
    ["日语", "ja"],
    ["ko", "ko"],
    ["kr", "ko"],
    ["korean", "ko"],
    ["韩语", "ko"],
    ["fr", "fr"],
    ["french", "fr"],
    ["法语", "fr"],
    ["de", "de"],
    ["german", "de"],
    ["德语", "de"],
    ["ru", "ru"],
    ["russian", "ru"],
    ["俄语", "ru"],
    ["es", "es"],
    ["spanish", "es"],
    ["西语", "es"],
    ["西班牙语", "es"],
    ["pt", "pt"],
    ["portuguese", "pt"],
    ["葡语", "pt"],
    ["葡萄牙语", "pt"],
    ["it", "it"],
    ["italian", "it"],
    ["意语", "it"],
    ["意大利语", "it"]
  ]);

  function normalizeTargetLanguageValue(value, fallback = "zh-CN") {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }
    const key = text.toLowerCase().replace("_", "-");
    return TARGET_LANGUAGE_ALIASES.get(key) || fallback;
  }

  function normalizeSourceLanguageValue(value, fallback = "auto") {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }
    const key = text.toLowerCase().replace("_", "-");
    return SOURCE_LANGUAGE_ALIASES.get(key) || fallback;
  }

  return {
    normalizeTargetLanguageValue,
    normalizeSourceLanguageValue
  };
})();
