export const FuguangBrowserLanguage = (() => {
  const DEFAULT_TARGET_LANGUAGE = "zh-CN";
  const TARGET_LANGUAGE_NAMES = new Map([
    ["zh-CN", "Simplified Chinese"],
    ["en", "English"],
    ["ja", "Japanese"],
    ["fr", "French"],
    ["ko", "Korean"],
    ["de", "German"],
    ["ru", "Russian"]
  ]);
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
  const ASR_LANGUAGE_ALIASES = new Map([
    ["auto", ""],
    ["automatic", ""],
    ["detect", ""],
    ["default", ""],
    ["自动", ""],
    ["自动识别", ""],
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

  function normalizeTargetLanguage(value, fallback = DEFAULT_TARGET_LANGUAGE) {
    const text = String(value || "").trim();
    if (!text) {
      return fallback;
    }
    const key = text.toLowerCase().replace("_", "-");
    return TARGET_LANGUAGE_ALIASES.get(key) || fallback;
  }

  function targetLanguageName(value) {
    const normalized = normalizeTargetLanguage(value);
    return TARGET_LANGUAGE_NAMES.get(normalized) || TARGET_LANGUAGE_NAMES.get(DEFAULT_TARGET_LANGUAGE);
  }

  function normalizeAsrLanguage(language) {
    const text = String(language || "").trim();
    if (!text) {
      return "";
    }
    const key = text.toLowerCase().replace("_", "-");
    const normalized = ASR_LANGUAGE_ALIASES.has(key)
      ? ASR_LANGUAGE_ALIASES.get(key)
      : TARGET_LANGUAGE_ALIASES.get(key) || key;
    return normalized === DEFAULT_TARGET_LANGUAGE ? "zh" : normalized;
  }

  return {
    normalizeTargetLanguage,
    targetLanguageName,
    normalizeAsrLanguage
  };
})();
