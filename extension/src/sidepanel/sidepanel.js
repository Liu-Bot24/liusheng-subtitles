const MESSAGE = {
  ACTIVATE_PAGE: "FUGUANG_ACTIVATE_PAGE",
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  START_PRELOAD_AUTO: "FUGUANG_START_PRELOAD_AUTO",
  RETRY_PRELOAD: "FUGUANG_RETRY_PRELOAD",
  RETRY_PRELOAD_CHUNKS: "FUGUANG_RETRY_PRELOAD_CHUNKS",
  RETRANSLATE_PRELOAD: "FUGUANG_RETRANSLATE_PRELOAD",
  CANCEL_PRELOAD: "FUGUANG_CANCEL_PRELOAD",
  CLEAR_PRELOAD_AUDIO_CACHE: "FUGUANG_CLEAR_PRELOAD_AUDIO_CACHE",
  CHECK_PRELOAD_JOB: "FUGUANG_CHECK_PRELOAD_JOB",
  GET_PRELOAD_VTT: "FUGUANG_GET_PRELOAD_VTT",
  GET_PRELOAD_TRANSCRIPT: "FUGUANG_GET_PRELOAD_TRANSCRIPT",
  GET_VIDEO_STATE: "FUGUANG_GET_VIDEO_STATE",
  ATTACH_VTT_TEXT: "FUGUANG_ATTACH_VTT_TEXT",
  DETACH_PRELOAD_VTT: "FUGUANG_DETACH_PRELOAD_VTT",
  CLEAR_PRELOAD_SUBTITLE_STATE: "FUGUANG_CLEAR_PRELOAD_SUBTITLE_STATE",
  SEEK_MEDIA: "FUGUANG_SEEK_MEDIA"
};

const DEFAULTS = {
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  asrWorkers: 1,
  translationWorkers: 3,
  chunkMinutes: 15,
  subtitleFontSize: 28,
  subtitleBackgroundOpacity: 78,
  subtitleOverlayEnabled: true,
  subtitleDisplayMode: "translated"
};
const MODEL_SETTINGS_VERSION = 5;
const LEGACY_MODEL_SYNC_KEYS = [
  "asrApiKey",
  "llmApiKey",
  "asrBaseUrl",
  "asrModel",
  "llmBaseUrl",
  "llmModel",
  "llmProviderType",
  "targetLanguage",
  "asrWorkers",
  "translationWorkers",
  "chunkMinutes"
];
const SUBTITLE_SYNC_KEYS = [
  "subtitleFontSize",
  "subtitleOverlayEnabled",
  "subtitleDisplayMode",
  "subtitleBackgroundOpacity"
];
const SUBTITLE_CACHE_DB_NAME = "fuguang-subtitle-cache";
const SUBTITLE_CACHE_DB_VERSION = 1;
const SUBTITLE_CACHE_SCHEMA_VERSION = 3;
const SUBTITLE_CACHE_LEGACY_SCHEMA_VERSION = 2;
const SUBTITLE_CACHE_STORE = "subtitles";
const SUBTITLE_CACHE_MAX_ENTRIES = 80;
const SUBTITLE_CACHE_MAX_AGE_DAYS = 30;
const SUBTITLE_USER_SCROLL_HOLD_MS = 8000;
const DEFAULT_ASR_PROFILE_ID = "openai_whisper";
const DEFAULT_LLM_PROFILE_ID = "llm";
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
const KNOWN_ASR_PROFILES = [
  {
    id: "openai_whisper",
    name: "OpenAI Whisper",
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    vadFilter: "auto",
    apiKey: ""
  },
  {
    id: "groq_whisper",
    name: "Groq Whisper",
    providerType: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    vadFilter: "auto",
    apiKey: ""
  },
  {
    id: "xai_grok",
    name: "xAI Grok",
    providerType: "xai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-2-voice-1212",
    vadFilter: "auto",
    apiKey: ""
  },
  {
    id: "custom_asr",
    name: "自定义 ASR",
    providerType: "openai",
    baseUrl: "",
    model: "",
    vadFilter: "auto",
    apiKey: ""
  }
];
const KNOWN_LLM_PROFILES = [
  {
    id: "test_llm",
    name: "Real LLM HLS",
    providerType: "openai",
    baseUrl: "https://llm.example.invalid/v1",
    model: "test-llm",
    apiKey: ""
  },
  {
    id: "custom_llm",
    name: "Custom LLM",
    providerType: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "deepseek-ai/DeepSeek-V3.2",
    apiKey: ""
  },
  {
    id: "siliconflow_hunyuan_mt_7b",
    name: "Custom LLM",
    providerType: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "custom-llm",
    apiKey: ""
  },
  {
    id: "openai_custom",
    name: "自定义 OpenAI 格式",
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "",
    apiKey: ""
  },
  {
    id: "anthropic",
    name: "自定义 Anthropic 格式",
    providerType: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "",
    apiKey: ""
  }
];

const elements = {
  pageTitle: document.querySelector("#pageTitle"),
  status: document.querySelector("#status"),
  tabTask: document.querySelector("#tabTask"),
  tabSettings: document.querySelector("#tabSettings"),
  taskPanel: document.querySelector("#taskPanel"),
  settingsPanel: document.querySelector("#settingsPanel"),
  startPreload: document.querySelector("#startPreload"),
  retryPreload: document.querySelector("#retryPreload"),
  retryTranslation: document.querySelector("#retryTranslation"),
  cancelPreload: document.querySelector("#cancelPreload"),
  clearAudioCache: document.querySelector("#clearAudioCache"),
  refresh: document.querySelector("#refresh"),
  refreshCandidates: document.querySelector("#refreshCandidates"),
  candidateSummary: document.querySelector("#candidateSummary"),
  candidateList: document.querySelector("#candidateList"),
  jobStatus: document.querySelector("#jobStatus"),
  subtitleList: document.querySelector("#subtitleList"),
  subtitleOverlayToggle: document.querySelector("#subtitleOverlayToggle"),
  subtitleModeToggle: document.querySelector("#subtitleModeToggle"),
  exportSubtitle: document.querySelector("#exportSubtitle"),
  importSubtitle: document.querySelector("#importSubtitle"),
  clearSubtitleCache: document.querySelector("#clearSubtitleCache"),
  subtitleImportFile: document.querySelector("#subtitleImportFile"),
  subtitleNotice: document.querySelector("#subtitleNotice"),
  toggleTaskDetails: document.querySelector("#toggleTaskDetails"),
  saveSettings: document.querySelector("#saveSettings"),
  taskMessage: document.querySelector("#taskMessage"),
  message: document.querySelector("#message"),
  asrProfileId: document.querySelector("#asrProfileId"),
  asrProfileName: document.querySelector("#asrProfileName"),
  addAsrProfile: document.querySelector("#addAsrProfile"),
  deleteAsrProfile: document.querySelector("#deleteAsrProfile"),
  asrBaseUrl: document.querySelector("#asrBaseUrl"),
  asrModel: document.querySelector("#asrModel"),
  asrVadFilter: document.querySelector("#asrVadFilter"),
  asrApiKey: document.querySelector("#asrApiKey"),
  asrApiKeyHint: document.querySelector("#asrApiKeyHint"),
  llmProfileId: document.querySelector("#llmProfileId"),
  llmProfileName: document.querySelector("#llmProfileName"),
  addLlmProfile: document.querySelector("#addLlmProfile"),
  deleteLlmProfile: document.querySelector("#deleteLlmProfile"),
  llmProviderType: document.querySelector("#llmProviderType"),
  llmBaseUrl: document.querySelector("#llmBaseUrl"),
  llmModel: document.querySelector("#llmModel"),
  llmApiKey: document.querySelector("#llmApiKey"),
  llmApiKeyHint: document.querySelector("#llmApiKeyHint"),
  sourceLanguage: document.querySelector("#sourceLanguage"),
  targetLanguage: document.querySelector("#targetLanguage"),
  asrWorkers: document.querySelector("#asrWorkers"),
  translationWorkers: document.querySelector("#translationWorkers"),
  chunkMinutes: document.querySelector("#chunkMinutes"),
  subtitleFontSize: document.querySelector("#subtitleFontSize"),
  subtitleBackgroundOpacity: document.querySelector("#subtitleBackgroundOpacity")
};

let activeTab = null;
let currentJobId = "";
let currentJob = null;
let renderedSubtitleJobId = "";
let pollTimer = 0;
let candidates = [];
let selectedCandidateKey = "";
let selectedCandidatePinned = false;
let asrProfiles = [];
let llmProfiles = [];
let currentAsrProfileId = "";
let currentLlmProfileId = "";
let startRequestInFlight = false;
let retryRequestInFlight = false;
let translationRetryRequestInFlight = false;
let subtitleCues = [];
let currentTranscript = null;
let currentSubtitleCacheEntry = null;
let subtitleDisplayMode = DEFAULTS.subtitleDisplayMode;
let subtitleOverlayEnabled = DEFAULTS.subtitleOverlayEnabled;
let attachedSubtitleTabId = 0;
let attachedSubtitleSignature = "";
let renderedSubtitleSignature = "";
let subtitleCueSource = "";
let activeCueIndex = -1;
let subtitleListPointerInside = false;
let subtitleListUserControlUntil = 0;
let subtitleFollowTimer = 0;
let subtitleFollowBusy = false;
let refreshStatusInFlight = false;
let subtitleLoadRequestId = 0;
let pendingSubtitleSignature = "";
let pendingSubtitlePromise = null;
let cachedSubtitleLoadedKey = "";
let cacheAutoLoadInFlight = false;
let taskDetailsExpanded = false;
let renderedCandidateSignature = "";
let lastActivatedTabKey = "";
let elapsedTicker = 0;
const clearedSubtitleJobIds = new Set();
const retryingChunks = new Set();

document.addEventListener("DOMContentLoaded", init);
elements.tabTask.addEventListener("click", () => showTab("task"));
elements.tabSettings.addEventListener("click", () => showTab("settings"));
elements.startPreload.addEventListener("click", () => startPreloadFromSidePanel());
elements.retryPreload.addEventListener("click", () => retryPreloadFromSidePanel());
elements.retryTranslation.addEventListener("click", () => retryTranslationFromSidePanel());
elements.cancelPreload.addEventListener("click", () => cancelPreloadFromSidePanel());
elements.clearAudioCache.addEventListener("click", () => clearCurrentAudioCache());
elements.refresh.addEventListener("click", () => refreshStatus());
elements.refreshCandidates.addEventListener("click", () => refreshCandidates());
elements.subtitleOverlayToggle.addEventListener("click", () => toggleSubtitleOverlay());
elements.subtitleModeToggle.addEventListener("click", () => toggleSubtitleMode());
elements.exportSubtitle.addEventListener("click", () => exportCurrentSubtitle());
elements.importSubtitle.addEventListener("click", () => elements.subtitleImportFile.click());
elements.clearSubtitleCache.addEventListener("click", () => clearCurrentSubtitleCache());
elements.subtitleImportFile.addEventListener("change", () => importSubtitleFile());
elements.toggleTaskDetails.addEventListener("click", () => toggleTaskDetails());
elements.saveSettings.addEventListener("click", () => saveSettings());
elements.sourceLanguage.addEventListener("change", () => saveSourceLanguageSetting());
elements.subtitleList.addEventListener("mouseenter", () => {
  subtitleListPointerInside = true;
});
elements.subtitleList.addEventListener("mouseleave", () => {
  subtitleListPointerInside = false;
});
elements.subtitleList.addEventListener("focusin", () => {
  subtitleListPointerInside = true;
});
elements.subtitleList.addEventListener("focusout", () => {
  subtitleListPointerInside = false;
});
elements.subtitleList.addEventListener("wheel", () => markSubtitleListUserControl(), { passive: true });
elements.subtitleList.addEventListener("touchstart", () => markSubtitleListUserControl(), { passive: true });
elements.subtitleList.addEventListener("pointerdown", () => markSubtitleListUserControl());
elements.subtitleList.addEventListener("scroll", () => {
  if (subtitleListPointerInside) {
    markSubtitleListUserControl();
  }
});
elements.asrProfileId.addEventListener("change", () => {
  saveProfileFields("asr", currentAsrProfileId);
  currentAsrProfileId = elements.asrProfileId.value;
  renderSelectedProfile("asr");
});
elements.addAsrProfile.addEventListener("click", () => addProfile("asr"));
elements.deleteAsrProfile.addEventListener("click", () => deleteProfile("asr"));
elements.llmProfileId.addEventListener("change", () => {
  saveProfileFields("llm", currentLlmProfileId);
  currentLlmProfileId = elements.llmProfileId.value;
  renderSelectedProfile("llm");
});
elements.addLlmProfile.addEventListener("click", () => addProfile("llm"));
elements.deleteLlmProfile.addEventListener("click", () => deleteProfile("llm"));
elements.llmProviderType.addEventListener("change", () => {
  elements.llmBaseUrl.placeholder = placeholderBaseUrl(elements.llmProviderType.value);
});

async function init() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await loadSettings();
  await activateCurrentPage();
  await refreshStatus();
  pollTimer = window.setInterval(refreshStatus, 1500);
}

async function refreshActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const changed = Boolean(activeTab?.id && tab?.id && (tab.id !== activeTab.id || tab.url !== activeTab.url));
  if (tab?.id && (!activeTab?.id || changed)) {
    const sameTabNavigated = Boolean(activeTab?.id && tab.id === activeTab.id && tab.url !== activeTab.url);
    if (sameTabNavigated && (subtitleCues.length || attachedSubtitleTabId === activeTab.id)) {
      await detachCurrentSubtitlesFromPage();
    }
    activeTab = tab;
    if (changed) {
      currentJobId = "";
      currentJob = null;
      candidates = [];
      selectedCandidateKey = "";
      selectedCandidatePinned = false;
      renderedCandidateSignature = "";
      lastActivatedTabKey = "";
      clearedSubtitleJobIds.clear();
      clearSubtitles("字幕生成后会显示在这里。");
      renderEmptyJob("当前标签页已变化，正在读取新的媒体源。");
    }
  }
  return activeTab;
}

async function activateCurrentPage() {
  await refreshActiveTab();
  if (!activeTab?.id) {
    return;
  }
  const response = await send({ type: MESSAGE.ACTIVATE_PAGE, tabId: activeTab.id });
  if (!response.ok) {
    renderEmptyJob(response.error);
    return;
  }
  lastActivatedTabKey = activeTabKey(activeTab);
}

function activeTabKey(tab) {
  return tab?.id ? `${tab.id}:${tab.url || ""}` : "";
}

async function loadSettings() {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get([...LEGACY_MODEL_SYNC_KEYS, ...SUBTITLE_SYNC_KEYS]),
    chrome.storage.local.get(null)
  ]);
  const useStoredProfiles = localStored.modelSettingsVersion === MODEL_SETTINGS_VERSION;
  const subtitleSyncSettings = pickDefined(syncStored, SUBTITLE_SYNC_KEYS);
  asrProfiles = normalizeStoredProfiles("asr", useStoredProfiles ? localStored.asrProfiles : []);
  llmProfiles = normalizeStoredProfiles("llm", useStoredProfiles ? localStored.llmProfiles : []);
  renderProfileOptions(
    elements.asrProfileId,
    asrProfiles,
    normalizeSelectedProfileId(
      asrProfiles,
      localStored.selectedAsrProfileId || DEFAULT_ASR_PROFILE_ID,
      DEFAULT_ASR_PROFILE_ID
    )
  );
  renderProfileOptions(
    elements.llmProfileId,
    llmProfiles,
    normalizeSelectedProfileId(
      llmProfiles,
      localStored.selectedLlmProfileId || DEFAULT_LLM_PROFILE_ID,
      DEFAULT_LLM_PROFILE_ID
    )
  );
  currentAsrProfileId = elements.asrProfileId.value;
  currentLlmProfileId = elements.llmProfileId.value;
  applyStoredSettings({
    ...DEFAULTS,
    ...localStored,
    ...subtitleSyncSettings,
    asrWorkers:
      localStored.modelSettingsVersion === MODEL_SETTINGS_VERSION
        ? localStored.asrWorkers || DEFAULTS.asrWorkers
        : DEFAULTS.asrWorkers
  });
  renderSelectedProfile("asr");
  renderSelectedProfile("llm");
  await clearLegacySyncSettingsIfNeeded(syncStored);
}

function applyStoredSettings(data) {
  setSourceLanguageValue(data.sourceLanguage || DEFAULTS.sourceLanguage);
  setTargetLanguageValue(data.targetLanguage || DEFAULTS.targetLanguage);
  elements.asrWorkers.value = valueOrDefault(data.asrWorkers, DEFAULTS.asrWorkers);
  elements.translationWorkers.value = valueOrDefault(data.translationWorkers, DEFAULTS.translationWorkers);
  elements.chunkMinutes.value = valueOrDefault(data.chunkMinutes, DEFAULTS.chunkMinutes);
  elements.subtitleFontSize.value = valueOrDefault(data.subtitleFontSize, DEFAULTS.subtitleFontSize);
  elements.subtitleBackgroundOpacity.value = valueOrDefault(data.subtitleBackgroundOpacity, DEFAULTS.subtitleBackgroundOpacity);
  subtitleOverlayEnabled = data.subtitleOverlayEnabled !== false;
  subtitleDisplayMode = data.subtitleDisplayMode === "bilingual" ? "bilingual" : DEFAULTS.subtitleDisplayMode;
  renderSubtitleModeButton();
  renderSubtitleOverlayButton();
}

function normalizeTargetLanguageValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return DEFAULTS.targetLanguage;
  }
  const key = text.toLowerCase().replace("_", "-");
  return TARGET_LANGUAGE_ALIASES.get(key) || DEFAULTS.targetLanguage;
}

function setTargetLanguageValue(value) {
  elements.targetLanguage.value = normalizeTargetLanguageValue(value);
}

function getTargetLanguageValue() {
  return normalizeTargetLanguageValue(elements.targetLanguage.value);
}

function normalizeSourceLanguageValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return DEFAULTS.sourceLanguage;
  }
  const key = text.toLowerCase().replace("_", "-");
  return SOURCE_LANGUAGE_ALIASES.get(key) || DEFAULTS.sourceLanguage;
}

function setSourceLanguageValue(value) {
  elements.sourceLanguage.value = normalizeSourceLanguageValue(value);
}

function getSourceLanguageValue() {
  return normalizeSourceLanguageValue(elements.sourceLanguage.value);
}

async function clearLegacySyncSettingsIfNeeded(syncStored) {
  if (!LEGACY_MODEL_SYNC_KEYS.some(key => syncStored[key] !== undefined && syncStored[key] !== "")) {
    return;
  }
  await chrome.storage.sync.remove(LEGACY_MODEL_SYNC_KEYS).catch(() => {});
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source?.[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function normalizeStoredProfiles(kind, storedProfiles) {
  const profilesById = new Map(defaultProfiles(kind).map(profile => [profile.id, profile]));
  for (const rawProfile of Array.isArray(storedProfiles) ? storedProfiles : []) {
    const profile = normalizeProfile(rawProfile);
    if (!profile.id) {
      continue;
    }
    const knownProfile = profilesById.get(profile.id);
    if (knownProfile) {
      profilesById.set(profile.id, mergeProfileDefaults(knownProfile, profile));
    } else if (hasProfileContent(profile)) {
      profilesById.set(profile.id, profile);
    }
  }
  return uniqueProfiles([...profilesById.values()]);
}

function normalizeProfile(rawProfile = {}) {
  return {
    id: String(rawProfile.id || "").trim(),
    name: String(rawProfile.name || "").trim(),
    providerType: normalizeProviderType(rawProfile.providerType || rawProfile.provider_type),
    baseUrl: String(rawProfile.baseUrl || rawProfile.base_url || "").trim(),
    model: String(rawProfile.model || "").trim(),
    vadFilter: normalizeAsrVadFilterMode(rawProfile.vadFilter || rawProfile.vad_filter || rawProfile.vadFilterMode),
    apiKey: String(rawProfile.apiKey || rawProfile.api_key || "").trim()
  };
}

function normalizeAsrVadFilterMode(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (["on", "true", "1", "yes", "force", "enabled"].includes(normalized)) {
    return "on";
  }
  if (["off", "false", "0", "no", "disabled"].includes(normalized)) {
    return "off";
  }
  return "auto";
}

function normalizeProviderType(providerType) {
  const value = String(providerType || "").trim();
  return ["openai", "groq", "xai", "anthropic"].includes(value) ? value : "openai";
}

function mergeProfileDefaults(defaultProfile, storedProfile) {
  return {
    id: storedProfile.id || defaultProfile.id,
    name: storedProfile.name || defaultProfile.name || "",
    providerType: storedProfile.providerType || defaultProfile.providerType || "openai",
    baseUrl: storedProfile.baseUrl || defaultProfile.baseUrl || "",
    model: storedProfile.model || defaultProfile.model || "",
    vadFilter: storedProfile.vadFilter || defaultProfile.vadFilter || "auto",
    apiKey: storedProfile.apiKey || defaultProfile.apiKey || ""
  };
}

function hasProfileContent(profile) {
  return Boolean(profile.apiKey || profile.baseUrl || profile.model || profile.name);
}

function uniqueProfiles(profiles) {
  const seen = new Set();
  const output = [];
  for (const profile of profiles) {
    if (seen.has(profile.id)) {
      continue;
    }
    seen.add(profile.id);
    output.push({
      ...profile,
      name: profile.name || profile.model || "未命名档案"
    });
  }
  return output;
}

function defaultProfiles(kind) {
  return knownProfileDefaults(kind).map(cloneProfile);
}

function knownProfileDefaults(kind) {
  return kind === "asr" ? KNOWN_ASR_PROFILES : KNOWN_LLM_PROFILES;
}

function cloneProfile(profile) {
  return {
    id: profile.id,
    name: profile.name || "",
    providerType: profile.providerType || "openai",
    baseUrl: profile.baseUrl || "",
    model: profile.model || "",
    vadFilter: profile.vadFilter || "auto",
    apiKey: profile.apiKey || ""
  };
}

function renderProfileOptions(select, profiles, selectedId) {
  select.replaceChildren();
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    select.appendChild(option);
  }
  select.value = profiles.some(profile => profile.id === selectedId) ? selectedId : profiles[0]?.id || "";
}

function selectedProfile(kind) {
  const profiles = kind === "asr" ? asrProfiles : llmProfiles;
  const selectedId = kind === "asr" ? elements.asrProfileId.value : elements.llmProfileId.value;
  return profileById(profiles, selectedId);
}

function profileById(profiles, id) {
  return profiles.find(profile => profile.id === id) || profiles[0] || {};
}

function normalizeSelectedProfileId(profiles, selectedId, fallbackId) {
  if (profiles.some(profile => profile.id === selectedId)) {
    return selectedId;
  }
  if (profiles.some(profile => profile.id === fallbackId)) {
    return fallbackId;
  }
  return profiles[0]?.id || "";
}

function renderSelectedProfile(kind) {
  const profile = selectedProfile(kind);
  if (kind === "asr") {
    const usesXaiAsr = profile.providerType === "xai";
    elements.asrProfileName.value = profile.name || "";
    elements.asrBaseUrl.value = profile.baseUrl || "";
    elements.asrModel.value = profile.model || "";
    elements.asrVadFilter.value = normalizeAsrVadFilterMode(profile.vadFilter);
    elements.asrApiKey.value = profile.apiKey || "";
    elements.asrBaseUrl.disabled = false;
    elements.asrApiKey.disabled = false;
    elements.asrModel.disabled = usesXaiAsr;
    elements.asrBaseUrl.placeholder = placeholderBaseUrl(profile.providerType);
    elements.asrModel.placeholder = usesXaiAsr ? "xAI 不发送 model；这里只作可选备注" : "";
    elements.asrApiKey.placeholder = "只保存在本机浏览器";
    elements.asrApiKeyHint.textContent = usesXaiAsr
        ? "xAI ASR 调用 /stt；模型名称仅用于配置标识，请求里不会发送 model 字段。API 密钥只保存在本机浏览器。"
        : "API 密钥只保存在本机浏览器。自动 VAD 对自建兼容接口只读取 openapi.json 判断 vad_filter 支持；不会探测 OpenAI、Groq 或 xAI。";
    return;
  }
  elements.llmProviderType.value = ["openai", "anthropic"].includes(profile.providerType) ? profile.providerType : "openai";
  elements.llmProfileName.value = profile.name || "";
  elements.llmBaseUrl.value = profile.baseUrl || "";
  elements.llmModel.value = profile.model || "";
  elements.llmApiKey.value = profile.apiKey || "";
  elements.llmBaseUrl.placeholder = placeholderBaseUrl(elements.llmProviderType.value);
  elements.llmApiKey.placeholder = "只保存在本机浏览器";
  elements.llmApiKeyHint.textContent = "API 密钥只保存在本机浏览器的扩展本地存储中。";
}

function saveProfileFields(kind, profileId) {
  if (kind === "asr") {
    const profile = profileById(asrProfiles, profileId || elements.asrProfileId.value);
    profile.name = elements.asrProfileName.value.trim() || profile.name || profile.model || "未命名档案";
    profile.baseUrl = elements.asrBaseUrl.value.trim();
    profile.model = elements.asrModel.value.trim();
    profile.vadFilter = normalizeAsrVadFilterMode(elements.asrVadFilter.value);
    profile.apiKey = elements.asrApiKey.value.trim();
    return;
  }
  const profile = profileById(llmProfiles, profileId || elements.llmProfileId.value);
  profile.name = elements.llmProfileName.value.trim() || profile.name || profile.model || "未命名档案";
  profile.providerType = elements.llmProviderType.value.trim() || "openai";
  profile.baseUrl = elements.llmBaseUrl.value.trim();
  profile.model = elements.llmModel.value.trim();
  profile.apiKey = elements.llmApiKey.value.trim();
}

function addProfile(kind) {
  saveProfileFields(kind, kind === "asr" ? currentAsrProfileId : currentLlmProfileId);
  const profile = createEmptyProfile(kind);
  const profiles = kind === "asr" ? asrProfiles : llmProfiles;
  profiles.push(profile);
  const select = kind === "asr" ? elements.asrProfileId : elements.llmProfileId;
  renderProfileOptions(select, profiles, profile.id);
  if (kind === "asr") {
    currentAsrProfileId = profile.id;
  } else {
    currentLlmProfileId = profile.id;
  }
  renderSelectedProfile(kind);
  setMessage("已新增空白档案。请填写接口格式、接口地址、模型名称和 API 密钥后保存。");
}

function deleteProfile(kind) {
  const profiles = kind === "asr" ? asrProfiles : llmProfiles;
  const select = kind === "asr" ? elements.asrProfileId : elements.llmProfileId;
  const selectedId = select.value;
  const index = profiles.findIndex(profile => profile.id === selectedId);
  if (index >= 0) {
    profiles.splice(index, 1);
  }
  if (!profiles.length) {
    profiles.push(...defaultProfiles(kind));
  }
  renderProfileOptions(select, profiles, profiles[Math.max(0, index - 1)]?.id || profiles[0]?.id || "");
  if (kind === "asr") {
    currentAsrProfileId = select.value;
  } else {
    currentLlmProfileId = select.value;
  }
  renderSelectedProfile(kind);
  setMessage("已删除当前档案。本机存储会在保存设置后更新。");
}

function createEmptyProfile(kind) {
  const prefix = kind === "asr" ? "asr_profile" : "llm_profile";
  return {
    id: `${prefix}_${Date.now()}`,
    name: "",
    providerType: "openai",
    baseUrl: "",
    model: "",
    vadFilter: "auto",
    apiKey: ""
  };
}

function placeholderBaseUrl(providerType) {
  if (providerType === "anthropic") {
    return "https://api.anthropic.com/v1";
  }
  if (providerType === "groq") {
    return "https://api.groq.com/openai/v1";
  }
  if (providerType === "xai") {
    return "https://api.x.ai/v1";
  }
  return "https://api.openai.com/v1";
}

async function saveSettings() {
  saveProfileFields("asr", elements.asrProfileId.value);
  saveProfileFields("llm", elements.llmProfileId.value);
  await chrome.storage.sync.set({
    subtitleFontSize: clampSetting(elements.subtitleFontSize.value, 18, 48, DEFAULTS.subtitleFontSize),
    subtitleOverlayEnabled,
    subtitleDisplayMode,
    subtitleBackgroundOpacity: clampSetting(
      elements.subtitleBackgroundOpacity.value,
      0,
      95,
      DEFAULTS.subtitleBackgroundOpacity
    )
  });
  await chrome.storage.local.set({
    modelSettingsVersion: MODEL_SETTINGS_VERSION,
    selectedAsrProfileId: elements.asrProfileId.value || DEFAULT_ASR_PROFILE_ID,
    selectedLlmProfileId: elements.llmProfileId.value || DEFAULT_LLM_PROFILE_ID,
    asrProfiles: uniqueProfiles(asrProfiles),
    llmProfiles: uniqueProfiles(llmProfiles),
    sourceLanguage: getSourceLanguageValue(),
    targetLanguage: getTargetLanguageValue(),
    asrWorkers: clampSetting(elements.asrWorkers.value, 1, 8, DEFAULTS.asrWorkers),
    translationWorkers: clampSetting(elements.translationWorkers.value, 1, 6, DEFAULTS.translationWorkers),
    chunkMinutes: Math.round(clampSetting(elements.chunkMinutes.value, 1, 60, DEFAULTS.chunkMinutes))
  });
  await chrome.storage.local.remove(["asrApiKey", "llmApiKey", "asrBaseUrl", "asrModel", "llmBaseUrl", "llmModel", "llmProviderType"]).catch(() => {});
  setMessage("设置已保存。新的预加载任务会使用当前 ASR 和翻译配置档。");
}

async function saveSourceLanguageSetting() {
  await chrome.storage.local.set({
    sourceLanguage: getSourceLanguageValue()
  }).catch(() => {});
}

async function refreshStatus() {
  if (refreshStatusInFlight) {
    return;
  }
  refreshStatusInFlight = true;
  try {
  await refreshActiveTab();
  if (!activeTab?.id) {
    renderEmptyJob("没有可用的当前标签页。");
    return;
  }
  if (activeTabKey(activeTab) !== lastActivatedTabKey) {
    await activateCurrentPage();
  }
  const response = await send({ type: MESSAGE.GET_STATUS, tabId: activeTab.id });
  if (!response.ok) {
    renderEmptyJob(response.error);
    return;
  }
  elements.pageTitle.textContent = response.page?.title || response.page?.url || "当前标签页";
  elements.status.textContent = statusLabel(response);
  candidates = response.candidates || [];
  ensureSelection();
  renderCandidates(candidates);
  const job = response.preloadJob;
  const jobId = job?.id || currentJobId;
  if (jobId) {
    currentJobId = jobId;
    const jobResponse = await send({ type: MESSAGE.CHECK_PRELOAD_JOB, jobId, tabId: activeTab.id });
    if (jobResponse.ok) {
      if (jobResponse.missing || !jobResponse.job) {
        currentJobId = "";
        clearSubtitles("字幕生成后会显示在这里。");
        renderEmptyJob("旧预加载任务已失效。请重新提交任务。");
        await tryLoadCachedSubtitleForCurrentPage();
        return;
      }
      elements.status.textContent = statusLabel({
        ...response,
        preload: jobResponse.job.status || response.preload,
        preloadJob: jobResponse.job
      });
      renderJob(jobResponse.job);
      if (
        jobResponse.job?.translation?.vttPath &&
        Number(jobResponse.job?.translation?.segmentCount || 0) > 0 &&
        !jobResponse.job?.subtitleCleared &&
        !isSubtitleJobCleared(jobId)
      ) {
        await renderSubtitles(jobId, jobResponse.job);
      }
      return;
    }
    setMessage(jobResponse.error || "无法读取任务状态。");
    currentJobId = "";
    renderEmptyJob(`无法读取旧任务状态：${jobResponse.error || "扩展后台没有响应"}。可以重新提交当前媒体源。`);
    await tryLoadCachedSubtitleForCurrentPage();
    return;
  }
  renderEmptyJob("还没有正在跟踪的预加载任务。");
  await tryLoadCachedSubtitleForCurrentPage();
  } finally {
    refreshStatusInFlight = false;
  }
}

async function startPreloadFromSidePanel() {
  if (startRequestInFlight) {
    return;
  }
  await refreshActiveTab();
  candidates = [];
  renderedCandidateSignature = "";
  renderCandidates(candidates);
  const refreshed = await refreshCandidates({ silent: true });
  if (!refreshed) {
    return;
  }
  const requestTabId = activeTab?.id;
  const requestTabUrl = activeTab?.url || "";
  const selected = getSelectedCandidate();
  if (!selected) {
    setMessage("还没有发现可抽取的媒体源。请确认页面里有视频，或播放/刷新页面后再试。");
    return;
  }
  await saveSourceLanguageSetting();
  startRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage("正在提交当前页面的媒体源...");
  try {
    await refreshActiveTab();
    if (activeTab?.id !== requestTabId || (activeTab?.url || "") !== requestTabUrl) {
      setMessage("当前标签页已经变化，已取消提交。请确认媒体源后再开始。");
      return;
    }
    const response = await send({
      type: MESSAGE.START_PRELOAD_AUTO,
      tabId: requestTabId,
      candidate: toPreloadCandidate(selected)
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!response.job?.id) {
      setMessage(response.message || "后台没有创建预加载任务，请重新加载扩展后重试。");
      await refreshStatus();
      return;
    }
    await refreshActiveTab();
    if (activeTab?.id !== requestTabId || (activeTab?.url || "") !== requestTabUrl) {
      setMessage("当前标签页已经变化，已忽略刚才返回的旧任务。");
      return;
    }
    currentJobId = response.job.id;
    clearedSubtitleJobIds.clear();
    clearSubtitles("正在等待新任务的字幕。", currentJobId);
    setMessage("任务已提交。");
    renderJob(response.job);
  } finally {
    startRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

async function refreshCandidates(options = {}) {
  await refreshActiveTab();
  if (!activeTab?.id) {
    setMessage("没有可用的当前标签页。");
    return false;
  }
  if (!options.skipActivate) {
    await activateCurrentPage();
  }
  const response = await send({ type: MESSAGE.GET_CANDIDATES, tabId: activeTab.id });
  if (!response.ok) {
    setMessage(response.error);
    return false;
  }
  candidates = response.candidates || [];
  ensureSelection();
  renderCandidates(candidates);
  if (!options.silent) {
    setMessage(candidates.length ? `已刷新 ${candidates.length} 个媒体源。` : "还没有发现可抽取的媒体源。");
  }
  return true;
}

async function retryPreloadFromSidePanel() {
  if (retryRequestInFlight) {
    return;
  }
  await refreshActiveTab();
  retryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage(retryPreloadMessage(currentJob));
  try {
    const response = await send({ type: MESSAGE.RETRY_PRELOAD, tabId: activeTab?.id });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    currentJobId = response.job?.id || "";
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || "已提交失败识别分段重试。");
    renderJob(response.job);
  } finally {
    retryRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

function retryPreloadMessage(job) {
  const failed = Number(job?.translation?.chunksFailed || job?.progress?.chunksFailed || 0);
  if (failed > 0) {
    return "正在重试失败识别分段...";
  }
  if (countReusableSourceChunks(job) > 0) {
    return "正在复用 ASR 原文继续翻译...";
  }
  if (countReusableAudioChunks(job) > 0) {
    return "正在复用音频缓存继续 ASR...";
  }
  return "正在继续处理任务...";
}

async function retryTranslationFromSidePanel(chunkIndexes = []) {
  if (translationRetryRequestInFlight) {
    return;
  }
  await refreshActiveTab();
  translationRetryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage("正在只重翻译字幕，不会重新语音识别...");
  try {
    const response = await send({
      type: MESSAGE.RETRANSLATE_PRELOAD,
      tabId: activeTab?.id,
      chunkIndexes: Array.isArray(chunkIndexes) ? chunkIndexes : []
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    currentJobId = response.job?.id || currentJobId;
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || "已提交字幕重翻译。");
    renderJob(response.job);
  } finally {
    translationRetryRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

async function retryChunkFromSidePanel(index, options = {}) {
  await refreshActiveTab();
  if (!currentJobId || !Number.isFinite(index)) {
    setMessage("没有可重试的识别分段。");
    return;
  }
  if (retryingChunks.has(index)) {
    return;
  }
  retryingChunks.add(index);
  updateActionButtons(currentJob);
  setMessage(options.translationOnly ? `正在重翻译第 ${index + 1} 个翻译分段...` : `正在重试第 ${index + 1} 个失败识别分段...`);
  try {
    const response = await send({
      type: options.translationOnly ? MESSAGE.RETRANSLATE_PRELOAD : MESSAGE.RETRY_PRELOAD_CHUNKS,
      tabId: activeTab?.id,
      chunkIndexes: [index]
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || (options.translationOnly ? `已提交第 ${index + 1} 个翻译分段重翻译。` : `已提交第 ${index + 1} 个失败识别分段重试。`));
    renderJob(response.job);
  } finally {
    retryingChunks.delete(index);
    updateActionButtons(currentJob);
  }
}

async function cancelPreloadFromSidePanel() {
  await refreshActiveTab();
  if (!currentJobId) {
    setMessage("没有正在跟踪的任务。");
    return;
  }
  setMessage("正在停止任务...");
  const response = await send({ type: MESSAGE.CANCEL_PRELOAD, tabId: activeTab?.id, jobId: currentJobId });
  if (!response.ok) {
    setMessage(response.error);
    return;
  }
  setMessage("任务已停止。");
  renderJob(response.job);
}

async function clearCurrentAudioCache() {
  await refreshActiveTab();
  if (!currentJobId) {
    setMessage("没有可清理音频缓存的预加载任务。");
    return;
  }
  const running = isRunningJob(currentJob);
  if (running) {
    setMessage("任务仍在运行中，不能清除它的音频缓存。请先停止或等待结束。");
    return;
  }
  setMessage("正在清除当前任务的音频缓存...");
  const response = await send({
    type: MESSAGE.CLEAR_PRELOAD_AUDIO_CACHE,
    tabId: activeTab?.id,
    jobId: currentJobId
  });
  if (!response.ok) {
    setMessage(response.error);
    return;
  }
  setMessage(response.message || "当前任务音频缓存已清除。");
  renderJob(response.job);
}

function renderJob(job) {
  if (!job) {
    renderEmptyJob("后台没有返回任务详情。请刷新或重新提交任务。");
    return;
  }
  currentJob = job || null;
  elements.jobStatus.replaceChildren();
  if (job?.id) {
    if (currentJobId && currentJobId !== job.id) {
      taskDetailsExpanded = false;
      renderedSubtitleSignature = "";
      activeCueIndex = -1;
      currentTranscript = null;
      currentSubtitleCacheEntry = null;
    }
    currentJobId = job.id;
  }
  if (job?.id && renderedSubtitleJobId && renderedSubtitleJobId !== job.id) {
    clearSubtitles("正在等待新任务的字幕。", job.id);
  }
  const progress = job.progress || {};
  const extraction = progress.extraction || job.extract || progress;
  const translation = progress.translation || job.translation || {};
  elements.status.textContent = statusLabel({ preload: job.status, preloadJob: job });
  updateActionButtons(job);
  updateTaskPanelFocus(job);
  updateElapsedTicker(job);

  const header = document.createElement("div");
  header.className = "job-header";
  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "job-title";
  title.textContent = jobTitle(job);
  const subtitle = document.createElement("div");
  subtitle.className = "job-subtitle";
  subtitle.textContent = `任务 ${job.id} · ${shorten(job.sourceUrl || job.source || "", 88)}`;
  titleWrap.append(title, subtitle);
  const stage = document.createElement("span");
  const stageKey = job.stage || progress.stage || job.status;
  stage.className = `stage stage-${stageClassName(stageKey)}`;
  stage.textContent = stageLabel(stageKey);
  header.append(titleWrap, stage);

  const metrics = document.createElement("div");
  metrics.className = "metrics";
  metrics.append(
    metric("抽取", extractionProgressText(extraction, job.status)),
    metric("识别 / 翻译", translationProgressText(translation)),
    metric("当前步骤", extractionActivityText(extraction)),
    metric("翻译分段时长", extraction.chunkSeconds ? `${Math.round(Number(extraction.chunkSeconds) / 60)} 分钟` : "-"),
    metric("已可用", extraction.readySeconds ? formatDuration(extraction.readySeconds) : "-"),
    metric("翻译分段完成", `${translation.chunksDone || 0}/${translation.chunksTotal || "?"}`),
    metric("识别中", translation.chunksAsr || 0),
    metric("翻译中", translation.chunksTranslating || 0),
    metric("ASR 并发", translation.asrWorkers || "-"),
    metric("翻译并发", translation.translationWorkers || "-"),
    metric("失败", translation.chunksFailed || 0),
    metric("耗时", formatElapsedSeconds(progress.elapsedSeconds || translation.elapsedSeconds || 0), "elapsed")
  );

  const children = [
    header,
    progressBar("音频抽取", normalizedPercent(progress.extractPercent ?? extraction.percent, job.status), extractionProgressText(extraction, job.status)),
    progressBar("识别 / 翻译", normalizedPercent(progress.translationPercent ?? translation.percent, job.status), translationProgressText(translation)),
    metrics,
    chunkList(translation.chunkStatuses || progress.chunkStatuses || [])
  ];
  if (job.error) {
    const error = document.createElement("div");
    error.className = "job-error";
    error.textContent = formatRuntimeError(job.error);
    children.splice(1, 0, error);
  }
  elements.jobStatus.append(...children);
}

function renderEmptyJob(text) {
  currentJob = null;
  updateElapsedTicker(null);
  updateTaskPanelFocus(null);
  stopSubtitleFollow();
  updateActionButtons(null);
  elements.jobStatus.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "job-empty";
  empty.textContent = text;
  elements.jobStatus.appendChild(empty);
}

function renderCandidates(items) {
  const nextSignature = candidateListSignature(items);
  const previousScrollTop = elements.candidateList.scrollTop;
  if (nextSignature === renderedCandidateSignature) {
    updateActionButtons(currentJob);
    return;
  }
  renderedCandidateSignature = nextSignature;
  elements.candidateList.replaceChildren();
  const visibleItems = items.slice(0, 5);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);
  elements.candidateSummary.textContent = items.length
    ? `${items.length} 个来源，已选择第 ${selectedIndex() + 1} 个${hiddenCount ? `，另外 ${hiddenCount} 个已折叠在列表外` : ""}。`
    : "还没有发现可抽取的媒体源。";
  if (!items.length) {
    updateActionButtons(currentJob);
    return;
  }
  updateActionButtons(currentJob);
  for (const [index, item] of visibleItems.entries()) {
    const key = candidateKey(item, index);
    const selected = key === selectedCandidateKey;
    const card = document.createElement("button");
    card.className = "candidate-card";
    card.type = "button";
    card.setAttribute("aria-pressed", String(selected));
    card.addEventListener("click", () => selectCandidate(key));

    const title = document.createElement("span");
    title.className = "candidate-title";
    title.textContent = item.title || item.filename || item.origin || "未命名媒体";
    const meta = document.createElement("span");
    meta.className = "candidate-meta";
    meta.textContent = candidateMetaText(item);
    const reason = document.createElement("span");
    reason.className = "candidate-reason";
    reason.textContent = item.selectionReason || item.url || "";
    card.append(title, meta, reason);
    elements.candidateList.appendChild(card);
  }
  elements.candidateList.scrollTop = previousScrollTop;
}

function candidateListSignature(items) {
  return JSON.stringify(
    items.map((item, index) => ({
      key: candidateKey(item, index),
      title: item.title || "",
      meta: candidateMetaText(item),
      reason: item.selectionReason || "",
      selected: candidateKey(item, index) === selectedCandidateKey
    }))
  );
}

function selectCandidate(key) {
  selectedCandidateKey = key;
  selectedCandidatePinned = true;
  renderCandidates(candidates);
}

function ensureSelection() {
  if (!candidates.length) {
    selectedCandidateKey = "";
    selectedCandidatePinned = false;
    return;
  }
  const firstKey = candidateKey(candidates[0], 0);
  const exists = candidates.some((item, index) => candidateKey(item, index) === selectedCandidateKey);
  if (!selectedCandidatePinned || !exists) {
    selectedCandidateKey = firstKey;
    selectedCandidatePinned = false;
  }
}

function selectedIndex() {
  return Math.max(0, candidates.findIndex((item, index) => candidateKey(item, index) === selectedCandidateKey));
}

function getSelectedCandidate() {
  return candidates.find((item, index) => candidateKey(item, index) === selectedCandidateKey);
}

function candidateKey(item, index) {
  return `${item.kind || "media"}:${item.role || ""}:${item.url || index}`;
}

function toPreloadCandidate(item) {
  const {
    variants,
    variantStats,
    hiddenCount,
    selectionReason,
    asrScore,
    ...candidate
  } = item;
  return {
    ...candidate,
    variantCount: variants?.length || 1,
    selectedBecause: selectionReason,
    foldedVariantStats: variantStats
  };
}

function candidateMetaText(item) {
  const parts = [
    formatRole(item.role),
    `${item.kind || "media"}/${item.ext || "?"}`
  ];
  if (item.duration) {
    parts.push(formatDuration(item.duration));
  }
  if (item.resolution) {
    parts.push(item.resolution);
  } else if (item.quality?.label) {
    parts.push(item.quality.label);
  }
  if (item.hiddenCount) {
    parts.push(`折叠 ${item.hiddenCount}`);
  }
  if (item.source) {
    parts.push(formatSource(item.source));
  }
  return parts.filter(Boolean).join(" · ");
}

async function renderSubtitles(jobId, job = null) {
  if (job?.subtitleCleared || isSubtitleJobCleared(jobId)) {
    return;
  }
  const signature = subtitleSignature(jobId, job);
  const needsTranscriptRetry = subtitleDisplayMode === "bilingual" && subtitleCues.length && subtitleCueSource !== "transcript";
  if (signature && renderedSubtitleSignature === signature && renderedSubtitleJobId === jobId && subtitleCues.length && !needsTranscriptRetry) {
    startSubtitleFollow();
    await attachCurrentSubtitlesToPage();
    return;
  }
  const pendingKey = `${signature || jobId}:${needsTranscriptRetry ? "transcript" : "normal"}`;
  if (pendingSubtitlePromise && pendingSubtitleSignature === pendingKey) {
    await pendingSubtitlePromise;
    return;
  }
  const requestId = ++subtitleLoadRequestId;
  pendingSubtitleSignature = pendingKey;
  pendingSubtitlePromise = loadSubtitleCues(jobId);
  const result = await pendingSubtitlePromise;
  if (requestId !== subtitleLoadRequestId) {
    return;
  }
  pendingSubtitlePromise = null;
  pendingSubtitleSignature = "";
  const cues = result.cues;
  renderedSubtitleJobId = jobId || renderedSubtitleJobId;
  renderedSubtitleSignature = signature || `${jobId}:${cues.length}`;
  subtitleCueSource = result.source;
  currentTranscript = result.transcript || (result.source === "transcript" ? transcriptFromCues(cues) : currentTranscript);
  subtitleCues = cues;
  activeCueIndex = -1;
  renderSubtitleCueList();
  startSubtitleFollow();
  await attachCurrentSubtitlesToPage();
  if (result.source === "transcript") {
    cacheCurrentSubtitles().catch(() => {});
  }
}

async function loadSubtitleCues(jobId) {
  const transcriptResponse = await send({ type: MESSAGE.GET_PRELOAD_TRANSCRIPT, jobId });
  if (transcriptResponse.ok && transcriptResponse.transcript) {
    const transcriptCues = cuesFromTranscript(transcriptResponse.transcript);
    if (transcriptCues.length) {
      return { cues: transcriptCues, source: "transcript", transcript: transcriptResponse.transcript };
    }
  }
  const response = await send({ type: MESSAGE.GET_PRELOAD_VTT, jobId });
  if (!response.ok || !response.vtt) {
    return { cues: [], source: "empty", transcript: null };
  }
  return { cues: parseVtt(response.vtt), source: "vtt", transcript: null };
}

function renderSubtitleCueList() {
  elements.subtitleList.replaceChildren();
  if (!subtitleCues.length) {
    elements.subtitleList.textContent = renderedSubtitleJobId ? "字幕文件为空。" : "字幕生成后会显示在这里。";
    renderSubtitleNotice();
    return;
  }
  for (const [index, cue] of subtitleCues.entries()) {
    const item = document.createElement("div");
    item.className = "cue";
    item.dataset.index = String(index);
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = cue.time;
    const textWrap = document.createElement("div");
    textWrap.className = "subtitle-lines";
    if (subtitleDisplayMode === "bilingual" && cue.sourceText) {
      const source = document.createElement("div");
      source.className = "subtitle-source";
      source.textContent = cue.sourceText;
      textWrap.appendChild(source);
    }
    const text = document.createElement("div");
    text.className = "subtitle-text";
    text.textContent = cue.text;
    textWrap.appendChild(text);
    item.title = "双击跳转到这句字幕";
    item.addEventListener("dblclick", () => seekToCue(cue.start, index));
    item.append(time, textWrap);
    elements.subtitleList.appendChild(item);
  }
  renderSubtitleModeButton();
  renderSubtitleNotice();
}

function clearSubtitles(text, jobId = "") {
  subtitleLoadRequestId += 1;
  pendingSubtitlePromise = null;
  pendingSubtitleSignature = "";
  renderedSubtitleJobId = jobId || "";
  renderedSubtitleSignature = "";
  attachedSubtitleTabId = 0;
  attachedSubtitleSignature = "";
  subtitleCues = [];
  subtitleCueSource = "";
  currentTranscript = null;
  currentSubtitleCacheEntry = null;
  activeCueIndex = -1;
  stopSubtitleFollow();
  renderSubtitleNotice("");
  elements.subtitleList.replaceChildren();
  elements.subtitleList.textContent = text || "字幕生成后会显示在这里。";
}

async function seekToCue(start, preferredIndex = null) {
  const time = Number(start);
  if (!activeTab?.id || !Number.isFinite(time)) {
    return;
  }
  const response = await send({ type: MESSAGE.SEEK_MEDIA, tabId: activeTab.id, time });
  if (response.ok) {
    releaseSubtitleListAutoFollow();
    const index = Number.isInteger(preferredIndex) && preferredIndex >= 0 ? preferredIndex : findCueIndexAt(time);
    activeCueIndex = -1;
    setActiveCueIndex(index, { forceScroll: true });
  }
  setMessage(response.ok ? "已跳转到字幕时间点。" : response.error);
}

function startSubtitleFollow() {
  if (subtitleFollowTimer || !subtitleCues.length) {
    return;
  }
  syncSubtitleHighlight();
  subtitleFollowTimer = window.setInterval(syncSubtitleHighlight, 500);
}

function stopSubtitleFollow() {
  if (!subtitleFollowTimer) {
    return;
  }
  window.clearInterval(subtitleFollowTimer);
  subtitleFollowTimer = 0;
}

async function syncSubtitleHighlight() {
  if (subtitleFollowBusy || !activeTab?.id || !subtitleCues.length) {
    return;
  }
  subtitleFollowBusy = true;
  try {
    const response = await send({ type: MESSAGE.GET_VIDEO_STATE, tabId: activeTab.id });
    const time = Number(response.state?.currentTime);
    if (
      response.ok
      && response.state?.synthetic !== true
      && Number.isFinite(time)
    ) {
      setActiveCueIndex(findCueIndexAt(time));
    }
  } finally {
    subtitleFollowBusy = false;
  }
}

function findCueIndexAt(time) {
  const current = Number(time);
  if (!Number.isFinite(current)) {
    return -1;
  }
  const startTolerance = 0.001;
  let bestIndex = -1;
  let bestStart = Number.NEGATIVE_INFINITY;
  subtitleCues.forEach((cue, index) => {
    const start = Number(cue.start);
    const end = Number(cue.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return;
    }
    if (current + startTolerance < start) {
      return;
    }
    if (!(current < end || (index === subtitleCues.length - 1 && current <= end + startTolerance))) {
      return;
    }
    if (start >= bestStart) {
      bestStart = start;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function markSubtitleListUserControl() {
  subtitleListUserControlUntil = Date.now() + SUBTITLE_USER_SCROLL_HOLD_MS;
}

function releaseSubtitleListAutoFollow() {
  subtitleListPointerInside = false;
  subtitleListUserControlUntil = 0;
}

function shouldScrollActiveCue(options = {}) {
  if (options.forceScroll) {
    return true;
  }
  if (!subtitleListPointerInside) {
    return true;
  }
  return Date.now() >= subtitleListUserControlUntil;
}

function setActiveCueIndex(index, options = {}) {
  const nextIndex = Number(index);
  const current = Number.isInteger(nextIndex) && nextIndex >= 0
    ? elements.subtitleList.querySelector(`.cue[data-index="${nextIndex}"]`)
    : null;
  elements.subtitleList.querySelectorAll(".cue.active").forEach(item => {
    if (item !== current) {
      item.classList.remove("active");
    }
  });
  if (activeCueIndex === nextIndex && current?.classList.contains("active") && !options.forceScroll) {
    return;
  }
  activeCueIndex = Number.isInteger(nextIndex) ? nextIndex : -1;
  if (!current) {
    return;
  }
  current.classList.add("active");
  if (shouldScrollActiveCue(options)) {
    current.scrollIntoView({ block: "nearest" });
  }
}

async function toggleSubtitleMode() {
  subtitleDisplayMode = subtitleDisplayMode === "bilingual" ? "translated" : "bilingual";
  await chrome.storage.sync.set({ subtitleDisplayMode }).catch(() => {});
  renderSubtitleCueList();
  if (subtitleDisplayMode === "bilingual" && renderedSubtitleJobId && subtitleCueSource !== "transcript") {
    renderedSubtitleSignature = "";
    await renderSubtitles(renderedSubtitleJobId, currentJob);
  }
  if (activeCueIndex >= 0) {
    const index = activeCueIndex;
    activeCueIndex = -1;
    setActiveCueIndex(index, { forceScroll: true });
  }
  await attachCurrentSubtitlesToPage();
}

async function toggleSubtitleOverlay() {
  await setSubtitleOverlayEnabled(!subtitleOverlayEnabled);
}

async function setSubtitleOverlayEnabled(enabled) {
  subtitleOverlayEnabled = enabled !== false;
  renderSubtitleOverlayButton();
  await chrome.storage.sync.set({ subtitleOverlayEnabled }).catch(() => {});
  if (subtitleOverlayEnabled) {
    await attachCurrentSubtitlesToPage();
  } else {
    await detachCurrentSubtitlesFromPage();
    renderSubtitleNotice();
  }
}

function renderSubtitleModeButton() {
  const bilingual = subtitleDisplayMode === "bilingual";
  elements.subtitleModeToggle.textContent = bilingual ? "双语开" : "双语";
  elements.subtitleModeToggle.setAttribute("aria-pressed", String(bilingual));
}

function renderSubtitleOverlayButton() {
  elements.subtitleOverlayToggle.textContent = subtitleOverlayEnabled ? "浮层开" : "浮层关";
  elements.subtitleOverlayToggle.setAttribute("aria-pressed", String(subtitleOverlayEnabled));
}

function renderSubtitleNotice(forcedText = null) {
  const text = forcedText ?? subtitleNoticeText();
  elements.subtitleNotice.hidden = !text;
  elements.subtitleNotice.textContent = text || "";
}

function subtitleNoticeText() {
  if (!subtitleCues.length) {
    return "";
  }
  if (currentSubtitleCacheEntry) {
    return `已加载本地缓存：${currentSubtitleCacheEntry.title || "未命名字幕"}`;
  }
  const sourcePreviewText = subtitleSourcePreviewNoticeText();
  if (sourcePreviewText) {
    return sourcePreviewText;
  }
  if (subtitleDisplayMode === "bilingual") {
    if (subtitleCueSource !== "transcript") {
      return "双语需要读取字幕原文；当前只拿到 VTT 译文。请重新生成字幕或导入带原文的字幕文件。";
    }
    if (!subtitleCues.some(cue => cue.sourceText)) {
      return "这份字幕没有原文轨，只能显示译文。";
    }
  }
  return "";
}

function subtitleSourcePreviewNoticeText() {
  if (subtitleCueSource !== "transcript" || !currentTranscript) {
    return "";
  }
  const sourceCount = Array.isArray(currentTranscript.source) ? currentTranscript.source.length : 0;
  const translatedCount = Array.isArray(currentTranscript.translated) ? currentTranscript.translated.length : 0;
  if (!sourceCount) {
    return "";
  }
  if (!translatedCount) {
    return "正在显示 ASR 原文；译文完成后会自动替换。";
  }
  if (translatedCount < sourceCount) {
    return "部分译文已完成；未完成部分先显示 ASR 原文。";
  }
  return "";
}

function toggleTaskDetails() {
  taskDetailsExpanded = !taskDetailsExpanded;
  updateTaskPanelFocus(currentJob);
}

function updateTaskPanelFocus(job) {
  const ready = isCompleteJobWithSubtitles(job);
  const focusSubtitles = ready && !taskDetailsExpanded;
  elements.taskPanel.classList.toggle("subtitles-focus", focusSubtitles);
  elements.toggleTaskDetails.hidden = !ready;
  elements.toggleTaskDetails.textContent = focusSubtitles ? "任务详情" : "收起任务";
}

function isCompleteJobWithSubtitles(job) {
  if (!job) {
    return false;
  }
  const translation = job.translation || job.progress?.translation || {};
  const status = job.status || job.progress?.status;
  const stage = job.stage || job.progress?.stage;
  return (
    Number(translation.segmentCount || 0) > 0 &&
    Number(translation.chunksFailed || job.progress?.chunksFailed || 0) === 0 &&
    (status === "done" || status === "completed" || stage === "translated" || stage === "completed")
  );
}

function progressBar(label, percent, text) {
  const row = document.createElement("div");
  row.className = "progress-row";
  const head = document.createElement("div");
  head.className = "progress-label";
  const left = document.createElement("span");
  left.textContent = label;
  const right = document.createElement("span");
  right.textContent = text;
  head.append(left, right);
  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${percent}%`;
  track.appendChild(fill);
  row.append(head, track);
  return row;
}

function metric(label, value, key = "") {
  const item = document.createElement("div");
  item.className = "metric";
  if (key) {
    item.dataset.metric = key;
  }
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  if (key) {
    valueNode.dataset.metricValue = key;
  }
  valueNode.textContent = value || "-";
  item.append(labelNode, valueNode);
  return item;
}

function updateElapsedTicker(job) {
  const running = isRunningJob(job);
  if (!running && elapsedTicker) {
    window.clearInterval(elapsedTicker);
    elapsedTicker = 0;
    return;
  }
  if (!running || elapsedTicker) {
    return;
  }
  elapsedTicker = window.setInterval(() => {
    if (!isRunningJob(currentJob)) {
      updateElapsedTicker(null);
      return;
    }
    const valueNode = document.querySelector('[data-metric-value="elapsed"]');
    if (!valueNode) {
      return;
    }
    const startedAt = Number(currentJob?.createdAt || currentJob?.startedAt || 0);
    const current = Number(currentJob?.progress?.elapsedSeconds || currentJob?.extract?.elapsedSeconds || 0) || 0;
    const liveElapsed = startedAt > 0 ? Math.max(current, (Date.now() - startedAt) / 1000) : current;
    valueNode.textContent = formatElapsedSeconds(liveElapsed);
    const waiting = document.querySelector(".chunks .job-empty");
    if (waiting && (!currentJob?.translation?.chunkStatuses || !currentJob.translation.chunkStatuses.length)) {
      waiting.textContent = waitingFirstChunkText(currentJob);
    }
  }, 1000);
}

function chunkList(statuses) {
  const list = document.createElement("div");
  list.className = "chunks";
  if (!statuses.length) {
    const empty = document.createElement("div");
    empty.className = "job-empty";
    empty.textContent = waitingFirstChunkText(currentJob);
    list.appendChild(empty);
    return list;
  }
  for (const status of statuses) {
    const row = document.createElement("div");
    row.className = `chunk ${status.stage || "queued"}`;
    const index = document.createElement("code");
    index.textContent = `#${Number(status.index) + 1}`;
    const stage = document.createElement("span");
    stage.textContent = chunkStageLabel(status.stage);
    const meta = document.createElement("span");
    meta.textContent = chunkMetaText(status);
    const error = document.createElement("div");
    error.className = "chunk-error";
    error.textContent = status.error ? friendlyChunkError(status.error) : "";
    row.append(index, stage, meta);
    if (status.stage === "failed") {
      const running = isRunningJob(currentJob);
      const audioCacheRemoved = Boolean(currentJob?.audioCacheRemoved);
      const sourceAvailable = chunkHasReusableSource(status);
      const retry = document.createElement("button");
      retry.className = "chunk-retry";
      retry.type = "button";
      retry.textContent = sourceAvailable ? "重翻译" : "重试";
      retry.disabled = running || (!sourceAvailable && audioCacheRemoved) || retryingChunks.has(Number(status.index));
      retry.title = audioCacheRemoved
        ? (sourceAvailable ? "只重跑翻译，不会重新识别，也不需要音频缓存。" : "当前任务的音频缓存已清除，需要重新抽取全部。")
        : running
          ? "当前任务仍在运行，结束后可单独重试这个失败识别分段。"
          : (sourceAvailable ? "只重跑这个翻译分段的翻译，不重新语音识别。" : "重新识别并翻译这个失败识别分段。");
      retry.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        retryChunkFromSidePanel(Number(status.index), { translationOnly: sourceAvailable });
      });
      row.appendChild(retry);
    }
    if (error.textContent) {
      row.appendChild(error);
    }
    list.appendChild(row);
  }
  return list;
}

function chunkHasReusableSource(status) {
  return Number(status?.sourceCount || status?.source_segments || status?.sourceSegments || 0) > 0;
}

function parseVtt(vtt) {
  return vtt
    .split(/\n\n+/)
    .map(block => block.trim())
    .filter(block => block && !block.startsWith("WEBVTT"))
    .map(block => {
      const lines = block.split("\n").filter(Boolean);
      const timeIndex = lines.findIndex(line => line.includes("-->"));
      if (timeIndex < 0) {
        return null;
      }
      const [startText, endText] = lines[timeIndex].split("-->").map(value => value.trim().split(/\s+/)[0]);
      const start = parseTimestamp(startText);
      const end = parseTimestamp(endText);
      const text = lines.slice(timeIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
      return {
        start,
        end,
        time: lines[timeIndex],
        text,
        sourceText: ""
      };
    })
    .filter(cue => cue && Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.text);
}

function cuesFromTranscript(transcript) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
  const cues = [];
  for (const { sourceSegment, translatedSegment } of mergeTranscriptSegments(source, translated)) {
    const start = firstFiniteNumber(translatedSegment.start, sourceSegment.start);
    const end = firstFiniteNumber(translatedSegment.end, sourceSegment.end);
    const translatedText = cleanSubtitleText(translatedSegment.text);
    const sourceText = cleanSubtitleText(sourceSegment.text);
    const text = translatedText || sourceText;
    if (Number.isFinite(start) && Number.isFinite(end) && text) {
      cues.push({
        start,
        end,
        time: formatCueTime(start, end),
        text,
        sourceText: translatedText && sourceText && sourceText !== text ? sourceText : ""
      });
    }
  }
  return cues;
}

function mergeTranscriptSegments(source, translated) {
  const sourceSegments = Array.isArray(source) ? source : [];
  const translatedSegments = Array.isArray(translated) ? translated : [];
  const useIdentity = sourceSegments.some(hasSegmentIdentity) || translatedSegments.some(hasSegmentIdentity);
  if (!useIdentity) {
    const total = Math.max(sourceSegments.length, translatedSegments.length);
    return Array.from({ length: total }, (_, index) => ({
      sourceSegment: sourceSegments[index] || {},
      translatedSegment: translatedSegments[index] || {}
    }));
  }
  const translatedByKey = new Map();
  translatedSegments.forEach(segment => {
    const key = segmentIdentityKey(segment);
    if (key) {
      translatedByKey.set(key, segment);
    }
  });
  const usedKeys = new Set();
  const merged = sourceSegments.map(segment => {
    const key = segmentIdentityKey(segment);
    const translatedSegment = key ? translatedByKey.get(key) : null;
    if (key && translatedSegment) {
      usedKeys.add(key);
    }
    return {
      sourceSegment: segment,
      translatedSegment: translatedSegment || {}
    };
  });
  for (const segment of translatedSegments) {
    const key = segmentIdentityKey(segment);
    if (!key || usedKeys.has(key)) {
      continue;
    }
    merged.push({
      sourceSegment: {},
      translatedSegment: segment
    });
  }
  return merged.sort((left, right) => {
    const leftStart = firstFiniteNumber(left.translatedSegment.start, left.sourceSegment.start);
    const rightStart = firstFiniteNumber(right.translatedSegment.start, right.sourceSegment.start);
    return leftStart - rightStart;
  });
}

function hasSegmentIdentity(segment) {
  return Boolean(segmentIdentityKey(segment));
}

function segmentIdentityKey(segment) {
  const chunkIndex = Number(segment?.chunkIndex);
  const segmentIndex = Number(segment?.segmentIndex);
  if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
    return `${chunkIndex}:${segmentIndex}`;
  }
  return "";
}

function transcriptFromCues(cues) {
  return {
    source: cues.map(cue => ({ start: cue.start, end: cue.end, text: cue.sourceText || "" })),
    translated: cues.map(cue => ({ start: cue.start, end: cue.end, text: cue.text || "" })),
    chunkStatuses: []
  };
}

function cuesToVtt(cues, mode = subtitleDisplayMode) {
  const lines = ["WEBVTT", ""];
  for (const cue of cues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || !cue.text) {
      continue;
    }
    const textLines = [];
    if (mode === "bilingual" && cue.sourceText) {
      textLines.push(cue.sourceText);
    }
    textLines.push(cue.text);
    lines.push(formatCueTime(cue.start, cue.end));
    lines.push(textLines.join("\n"));
    lines.push("");
  }
  return lines.join("\n");
}

function cuesToSrt(cues, mode = subtitleDisplayMode) {
  return cues
    .filter(cue => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.text)
    .map((cue, index) => {
      const textLines = [];
      if (mode === "bilingual" && cue.sourceText) {
        textLines.push(cue.sourceText);
      }
      textLines.push(cue.text);
      return [
        String(index + 1),
        `${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}`,
        textLines.join("\n")
      ].join("\n");
    })
    .join("\n\n")
    .concat("\n");
}

async function attachCurrentSubtitlesToPage() {
  if (!activeTab?.id || !subtitleCues.length) {
    return;
  }
  if (!subtitleOverlayEnabled) {
    await detachCurrentSubtitlesFromPage();
    return;
  }
  const vtt = cuesToVtt(subtitleCues);
  const signature = subtitleAttachSignature(activeTab.id, vtt);
  const response = await send({ type: MESSAGE.ATTACH_VTT_TEXT, tabId: activeTab.id, vtt });
  if (!response.ok) {
    renderSubtitleNotice(response.error || "当前页面没有可挂载字幕的播放器。");
    return;
  }
  attachedSubtitleTabId = activeTab.id;
  attachedSubtitleSignature = signature;
  renderSubtitleNotice();
}

async function ensureCurrentSubtitlesAttachedToPage() {
  if (!activeTab?.id || !subtitleCues.length) {
    return;
  }
  if (!subtitleOverlayEnabled) {
    await detachCurrentSubtitlesFromPage();
    return;
  }
  const vtt = cuesToVtt(subtitleCues);
  const signature = subtitleAttachSignature(activeTab.id, vtt);
  if (attachedSubtitleTabId === activeTab.id && attachedSubtitleSignature === signature) {
    const stateResponse = await send({ type: MESSAGE.GET_VIDEO_STATE, tabId: activeTab.id }).catch(() => null);
    if (
      stateResponse?.ok &&
      stateResponse.state?.subtitleSignature === signature &&
      Number(stateResponse.state?.subtitleCueCount || 0) > 0
    ) {
      return;
    }
  }
  await attachCurrentSubtitlesToPage();
}

async function detachCurrentSubtitlesFromPage() {
  attachedSubtitleTabId = 0;
  attachedSubtitleSignature = "";
  if (!activeTab?.id) {
    return;
  }
  await send({ type: MESSAGE.DETACH_PRELOAD_VTT, tabId: activeTab.id }).catch(() => null);
}

function subtitleAttachSignature(tabId, vtt) {
  const text = String(vtt || "");
  // Must match background attachVttText(); the page reports that signature back.
  return `manual:${vttContentSignature(text)}`;
}

function vttContentSignature(vtt) {
  const text = String(vtt || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

async function cacheCurrentSubtitles() {
  if (!subtitleCues.length) {
    return;
  }
  const transcript = currentTranscript || transcriptFromCues(subtitleCues);
  const entry = await buildSubtitleCacheEntry(transcript);
  if (!entry.id) {
    return;
  }
  await putSubtitleCacheEntry(entry);
  currentSubtitleCacheEntry = entry;
  cachedSubtitleLoadedKey = entry.id;
  renderSubtitleNotice();
}

async function exportCurrentSubtitle() {
  if (!subtitleCues.length) {
    setMessage("还没有可导出的字幕。");
    return;
  }
  const blob = new Blob([cuesToSrt(subtitleCues)], { type: "application/x-subrip;charset=utf-8" });
  downloadBlob(blob, `${safeFilename(elements.pageTitle.textContent || "fuguang-subtitle")}.srt`);
  setMessage("SRT 字幕已导出。");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importSubtitleFile() {
  const file = elements.subtitleImportFile.files?.[0];
  elements.subtitleImportFile.value = "";
  if (!file) {
    return;
  }
  try {
    const parsed = FuguangSubtitleFormat.parseSubtitleImportText(await file.text(), {
      filename: file.name,
      mimeType: file.type
    });
    const transcript = parsed.transcript;
    const cues = cuesFromTranscript(transcript);
    if (!cues.length) {
      throw new Error("导入文件没有可用字幕。");
    }
    const entry = await buildSubtitleCacheEntry(transcript, parsed.metadata || {});
    if (!entry.id) {
      throw new Error("导入文件缺少可用于保存的网页链接或媒体源。");
    }
    await putSubtitleCacheEntry(entry);
    currentSubtitleCacheEntry = entry;
    currentTranscript = transcript;
    subtitleCues = cues;
    subtitleCueSource = "transcript";
    renderedSubtitleJobId = entry.jobId || `imported-${Date.now()}`;
    renderedSubtitleSignature = `${entry.id}:${cues.length}`;
    activeCueIndex = -1;
    renderSubtitleCueList();
    await attachCurrentSubtitlesToPage();
    startSubtitleFollow();
    setMessage(`已导入 ${formatImportedSubtitleType(parsed.format)} 字幕，并已纳入当前页面缓存。`);
  } catch (error) {
    setMessage(`导入失败：${formatRuntimeError(error.message)}`);
  }
}

function formatImportedSubtitleType(format) {
  return {
    json: "浮光 JSON",
    srt: "SRT",
    vtt: "VTT",
    ass: "ASS",
    ssa: "SSA"
  }[format] || "字幕";
}

async function clearCurrentSubtitleCache() {
  try {
    const ids = new Set();
    const currentPageKey = await buildSubtitleCacheKeyForCurrentPage();
    if (currentPageKey) {
      ids.add(currentPageKey);
    }
    for (const matchingKey of await buildMatchingSubtitleCacheKeysForCurrentPage()) {
      ids.add(matchingKey);
    }
    if (cachedSubtitleLoadedKey) {
      ids.add(cachedSubtitleLoadedKey);
    }
    if (currentSubtitleCacheEntry?.id) {
      ids.add(currentSubtitleCacheEntry.id);
    }
    const cacheIds = [...ids].filter(Boolean);
    if (!cacheIds.length) {
      setMessage("当前页面没有可定位的字幕缓存。");
      return;
    }

    const wasShowingClearedCache =
      Boolean(cachedSubtitleLoadedKey && ids.has(cachedSubtitleLoadedKey)) ||
      Boolean(currentSubtitleCacheEntry?.id && ids.has(currentSubtitleCacheEntry.id)) ||
      String(renderedSubtitleJobId || "").startsWith("cache-");
    const deleted = await deleteSubtitleCacheEntries(cacheIds);
    if (currentSubtitleCacheEntry?.id && ids.has(currentSubtitleCacheEntry.id)) {
      currentSubtitleCacheEntry = null;
    }
    if (cachedSubtitleLoadedKey && ids.has(cachedSubtitleLoadedKey)) {
      cachedSubtitleLoadedKey = "";
    }

    if (!deleted) {
      renderSubtitleNotice();
      setMessage("当前页面没有已保存的字幕缓存。");
      return;
    }
    if (wasShowingClearedCache || subtitleCues.length) {
      const jobIdToSuppress = currentJobId || renderedSubtitleJobId || currentSubtitleCacheEntry?.jobId || "";
      if (jobIdToSuppress) {
        clearedSubtitleJobIds.add(jobIdToSuppress);
        await suppressPreloadSubtitleState(jobIdToSuppress);
      }
      await detachCurrentSubtitlesFromPage();
      clearSubtitles("已清除当前页面字幕缓存。");
    } else {
      renderSubtitleNotice();
    }
    setMessage(`已清除当前页面字幕缓存（${deleted} 条）。`);
  } catch (error) {
    setMessage(`清除字幕缓存失败：${formatRuntimeError(error.message)}`);
  }
}

function isSubtitleJobCleared(jobId) {
  return Boolean(jobId && clearedSubtitleJobIds.has(String(jobId)));
}

async function suppressPreloadSubtitleState(jobId) {
  if (!activeTab?.id || !jobId) {
    return;
  }
  const response = await send({
    type: MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE,
    tabId: activeTab.id,
    jobId
  });
  if (!response.ok) {
    throw new Error(response.error || "后台没有完成字幕状态清理。");
  }
}

async function tryLoadCachedSubtitleForCurrentPage() {
  if (cacheAutoLoadInFlight || currentJobId) {
    return;
  }
  if (subtitleCues.length) {
    startSubtitleFollow();
    await ensureCurrentSubtitlesAttachedToPage();
    return;
  }
  cacheAutoLoadInFlight = true;
  try {
    await pruneSubtitleCache();
    const { key, entry } = await getSubtitleCacheEntryForCurrentPage();
    if (!key) {
      return;
    }
    if (!entry?.transcript) {
      return;
    }
    const cues = cuesFromTranscript(entry.transcript);
    if (!cues.length) {
      return;
    }
    cachedSubtitleLoadedKey = key;
    currentSubtitleCacheEntry = entry;
    currentTranscript = entry.transcript;
    subtitleCues = cues;
    subtitleCueSource = "transcript";
    renderedSubtitleJobId = entry.jobId || `cache-${key}`;
    renderedSubtitleSignature = `${key}:${cues.length}`;
    activeCueIndex = -1;
    renderSubtitleCueList();
    await ensureCurrentSubtitlesAttachedToPage();
    startSubtitleFollow();
  } finally {
    cacheAutoLoadInFlight = false;
  }
}

async function buildSubtitleCacheEntry(transcript, importedPayload = {}) {
  const context = currentSubtitleCacheContext(importedPayload);
  const selected = getSelectedCandidate();
  const pageUrl = context.pageUrl;
  const title = importedPayload.title || elements.pageTitle.textContent || selected?.title || "";
  const sourceUrl = context.sourceUrl;
  const id = await buildSubtitleCacheKey({ pageUrl, sourceUrl });
  return {
    id,
    pageUrl,
    title,
    sourceUrl,
    jobId: importedPayload.jobId || renderedSubtitleJobId || currentJobId || "",
    transcript,
    createdAt: importedPayload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    segmentCount: Math.max(transcript.source?.length || 0, transcript.translated?.length || 0),
    approxBytes: JSON.stringify(transcript).length
  };
}

async function buildSubtitleCacheKeyForCurrentPage() {
  return buildSubtitleCacheKey(currentSubtitleCacheContext());
}

async function buildSubtitleCacheKey({ pageUrl = "", sourceUrl = "" }) {
  const normalizedPage = normalizeCacheUrl(pageUrl);
  const normalizedSource = normalizeMediaCacheUrl(sourceUrl);
  const seed = subtitleCacheSeed(normalizedPage, normalizedSource);
  if (!seed) {
    return "";
  }
  return `subtitle:v${SUBTITLE_CACHE_SCHEMA_VERSION}:${await sha256Text(seed)}`;
}

function currentSubtitleCacheContext(payload = {}) {
  const selected = getSelectedCandidate();
  return {
    pageUrl: payload.pageUrl || activeTab?.url || selected?.pageUrl || "",
    sourceUrl: payload.sourceUrl || selected?.url || currentJob?.sourceUrl || ""
  };
}

function subtitleCacheSeed(normalizedPage, normalizedSource) {
  if (normalizedPage && normalizedSource) {
    return `page:${normalizedPage}\nsource:${normalizedSource}`;
  }
  if (normalizedPage) {
    return `page:${normalizedPage}`;
  }
  if (normalizedSource) {
    return `source:${normalizedSource}`;
  }
  return "";
}

async function getSubtitleCacheEntryForCurrentPage() {
  const context = currentSubtitleCacheContext();
  const key = await buildSubtitleCacheKey(context);
  const entry = key ? await getSubtitleCacheEntry(key) : null;
  if (entry) {
    return { key, entry };
  }
  for (const legacyKey of await buildLegacySubtitleCacheKeys(context)) {
    const legacyEntry = await getSubtitleCacheEntry(legacyKey);
    if (subtitleCacheEntryMatchesContext(legacyEntry, context)) {
      return { key: legacyKey, entry: legacyEntry };
    }
  }
  const pageMatched = await findSubtitleCacheEntryByPageContext(context);
  if (pageMatched) {
    return pageMatched;
  }
  return { key, entry: null };
}

async function buildMatchingSubtitleCacheKeysForCurrentPage() {
  const context = currentSubtitleCacheContext();
  const keys = new Set();
  for (const legacyKey of await buildLegacySubtitleCacheKeys(context)) {
    const entry = await getSubtitleCacheEntry(legacyKey);
    if (subtitleCacheEntryMatchesContext(entry, context)) {
      keys.add(legacyKey);
    }
  }
  for (const entry of await getSubtitleCacheEntriesMatchingPageContext(context)) {
    if (entry?.id) {
      keys.add(entry.id);
    }
  }
  return [...keys];
}

async function buildLegacySubtitleCacheKeys({ pageUrl = "", sourceUrl = "" }) {
  const normalizedPage = normalizeCacheUrl(pageUrl);
  const normalizedSource = normalizeMediaCacheUrl(sourceUrl);
  const seeds = [...new Set([normalizedPage, normalizedSource].filter(Boolean))];
  const keys = [];
  for (const seed of seeds) {
    keys.push(`subtitle:v${SUBTITLE_CACHE_LEGACY_SCHEMA_VERSION}:${await sha256Text(seed)}`);
  }
  return keys;
}

function subtitleCacheEntryMatchesContext(entry, context) {
  if (!entry?.transcript) {
    return false;
  }
  const currentSource = normalizeMediaCacheUrl(context.sourceUrl);
  const entrySource = normalizeMediaCacheUrl(entry.sourceUrl);
  if (currentSource) {
    return Boolean(entrySource && entrySource === currentSource);
  }
  const currentPage = normalizeCacheUrl(context.pageUrl);
  const entryPage = normalizeCacheUrl(entry.pageUrl);
  return Boolean(currentPage && entryPage === currentPage);
}

async function findSubtitleCacheEntryByPageContext(context) {
  const [entry] = await getSubtitleCacheEntriesMatchingPageContext(context);
  return entry?.id ? { key: entry.id, entry } : null;
}

async function getSubtitleCacheEntriesMatchingPageContext(context) {
  const currentPage = normalizeCacheUrl(context.pageUrl);
  if (!canUsePageOnlySubtitleCacheFallback(currentPage)) {
    return [];
  }
  return (await getAllSubtitleCacheEntries())
    .filter(entry => subtitleCacheEntryMatchesPageFallback(entry, currentPage))
    .sort((left, right) => subtitleCacheEntryTime(right) - subtitleCacheEntryTime(left));
}

function subtitleCacheEntryMatchesPageFallback(entry, normalizedPage) {
  return Boolean(
    entry?.id &&
    entry?.transcript &&
    normalizedPage &&
    normalizeCacheUrl(entry.pageUrl) === normalizedPage
  );
}

function canUsePageOnlySubtitleCacheFallback(normalizedPage) {
  if (!normalizedPage) {
    return false;
  }
  try {
    const url = new URL(normalizedPage);
    return /(^|\.)bilibili\.com$/i.test(url.hostname) && /^\/video\/[A-Za-z0-9_-]+$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function subtitleCacheEntryTime(entry) {
  return Date.parse(entry?.updatedAt || entry?.createdAt || "") || 0;
}

function normalizeCacheUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    normalizeBilibiliPageCacheUrl(url);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|spm_|vd_source$|from$|share_|fbclid$|gclid$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return String(rawUrl || "").trim();
  }
}

function normalizeMediaCacheUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    const bilibiliIdentity = getBilibiliMediaCacheIdentity(url);
    if (bilibiliIdentity) {
      return `bilibili:${bilibiliIdentity}`;
    }
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|spm_|vd_source$|from$|share_|fbclid$|gclid$|token$|access_?token$|auth(?:_key)?$|signature$|sign$|sig$|expires?$|expiration$|deadline$|timestamp$|ts$|nonce$|session(?:id)?$|sid$|x-amz-|x-oss-|x-goog-)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return String(rawUrl || "").trim();
  }
}

function normalizeBilibiliPageCacheUrl(url) {
  if (!/(^|\.)bilibili\.com$/i.test(url.hostname)) {
    return;
  }
  const match = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/?$/);
  if (match) {
    url.pathname = `/video/${match[1]}`;
    const part = url.searchParams.get("p");
    url.search = "";
    if (part && /^\d+$/.test(part)) {
      url.searchParams.set("p", part);
    }
  }
}

function getBilibiliMediaCacheIdentity(url) {
  if (!isLikelyBilibiliMediaCacheUrl(url)) {
    return "";
  }
  const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
  const filenameMatch = filename.match(/^(\d+-\d+)-\d+\.(?:m4s|mp4)$/i);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  const pathMatch = url.pathname.match(/\/upgcxcode\/(?:[^/]+\/){0,4}(\d+)(?:\/|$)/i);
  if (pathMatch) {
    return pathMatch[1];
  }
  const path = canonicalMediaCachePathname(url.pathname || "");
  return path ? `${url.hostname}${path}` : "";
}

function isLikelyBilibiliMediaCacheUrl(url) {
  return (
    /(?:^|\.)bilibili(?:video)?\.com$/i.test(url.hostname) ||
    /(?:^|\.)bilivideo\.(?:com|cn)$/i.test(url.hostname) ||
    /\/upgcxcode\//i.test(url.pathname)
  );
}

function canonicalMediaCachePathname(pathname) {
  return String(pathname || "")
    .replace(/\/\d{3,5}x\d{3,5}(?=\/)/g, "/{resolution}")
    .replace(/\/(?:\d{3,4}p|[1-9]\d{1,3}k|[48]k)(?=\/)/gi, "/{quality}")
    .replace(/(?:^|[-_/])\d{3,4}p(?=[-_/.]|$)/gi, "-{quality}")
    .replace(/(?:^|[-_/])(?:[1-9]\d{1,3}k|[48]k)(?=[-_/.])/gi, "-{quality}")
    .replace(/-\d{5,6}(?=\.m4s$)/i, "-{track}");
}

async function sha256Text(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function openSubtitleCacheDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SUBTITLE_CACHE_DB_NAME, SUBTITLE_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SUBTITLE_CACHE_STORE)) {
        db.createObjectStore(SUBTITLE_CACHE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开字幕缓存。"));
  });
}

async function getSubtitleCacheEntry(id) {
  if (!id) {
    return null;
  }
  const db = await openSubtitleCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readonly");
    const request = transaction.objectStore(SUBTITLE_CACHE_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("无法读取字幕缓存。"));
    transaction.oncomplete = () => db.close();
  });
}

async function getAllSubtitleCacheEntries() {
  const db = await openSubtitleCacheDb();
  return new Promise((resolve, reject) => {
    let entries = [];
    const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readonly");
    const request = transaction.objectStore(SUBTITLE_CACHE_STORE).getAll();
    request.onsuccess = () => {
      entries = Array.isArray(request.result) ? request.result : [];
    };
    request.onerror = () => reject(request.error || new Error("无法读取字幕缓存。"));
    transaction.oncomplete = () => {
      db.close();
      resolve(entries);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("无法读取字幕缓存。"));
    };
  });
}

async function deleteSubtitleCacheEntries(ids) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) {
    return 0;
  }
  const db = await openSubtitleCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readwrite");
    const store = transaction.objectStore(SUBTITLE_CACHE_STORE);
    let deleted = 0;
    for (const id of uniqueIds) {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          store.delete(id);
          deleted += 1;
        }
      };
      request.onerror = () => {
        reject(request.error || new Error("无法读取字幕缓存。"));
      };
    }
    transaction.oncomplete = () => {
      db.close();
      resolve(deleted);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("无法删除字幕缓存。"));
    };
  });
}

async function putSubtitleCacheEntry(entry) {
  const db = await openSubtitleCacheDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readwrite");
    transaction.objectStore(SUBTITLE_CACHE_STORE).put(entry);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("无法写入字幕缓存。"));
    };
  });
  await pruneSubtitleCache();
}

async function pruneSubtitleCache() {
  const db = await openSubtitleCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SUBTITLE_CACHE_STORE, "readwrite");
    const store = transaction.objectStore(SUBTITLE_CACHE_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = Array.isArray(request.result) ? request.result : [];
      const cutoff = Date.now() - SUBTITLE_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      const sorted = entries
        .map(entry => ({
          entry,
          updatedAt: Date.parse(entry?.updatedAt || entry?.createdAt || "") || 0
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const idsToDelete = new Set();
      for (const item of sorted) {
        if (item.updatedAt && item.updatedAt < cutoff) {
          idsToDelete.add(item.entry.id);
        }
      }
      for (const item of sorted.slice(SUBTITLE_CACHE_MAX_ENTRIES)) {
        idsToDelete.add(item.entry.id);
      }
      for (const id of idsToDelete) {
        if (id && id !== currentSubtitleCacheEntry?.id) {
          store.delete(id);
        }
      }
    };
    request.onerror = () => reject(request.error || new Error("无法维护字幕缓存。"));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("无法维护字幕缓存。"));
    };
  });
}

function subtitleSignature(jobId, job) {
  if (!jobId) {
    return "";
  }
  const translation = job?.translation || job?.progress?.translation || {};
  const progress = job?.progress || {};
  const segmentCount = Number(translation.segmentCount || 0);
  const chunksDone = Number(translation.chunksDone || progress.chunksDone || 0);
  const chunksFailed = Number(translation.chunksFailed || progress.chunksFailed || 0);
  const base = `${jobId}:${segmentCount}:${chunksDone}:${chunksFailed}`;
  return translation.vttText ? `${base}:${textContentSignature(translation.vttText)}` : base;
}

function textContentSignature(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return Number.NaN;
}

function cleanSubtitleText(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function safeFilename(value) {
  const text = String(value || "fuguang-subtitle")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text || "fuguang-subtitle").slice(0, 80);
}

function formatCueTime(start, end) {
  return `${formatTimestamp(start)} --> ${formatTimestamp(end)}`;
}

function formatTimestamp(value) {
  const time = Math.max(0, Number(value) || 0);
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function formatSrtTimestamp(value) {
  return formatTimestamp(value).replace(".", ",");
}

function parseTimestamp(value) {
  const parts = value.replace(",", ".").split(":");
  if (parts.length < 2 || parts.length > 3) {
    return Number.NaN;
  }
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts.pop()) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function showTab(tab) {
  const task = tab === "task";
  elements.tabTask.classList.toggle("active", task);
  elements.tabSettings.classList.toggle("active", !task);
  elements.taskPanel.classList.toggle("active", task);
  elements.settingsPanel.classList.toggle("active", !task);
}

function statusLabel(status) {
  const preloadStatus = status?.preloadJob?.status || status?.preload;
  const preloadStage = status?.preloadJob?.stage;
  if (preloadStage === "completed_with_warnings") {
    return "完成，有警告";
  }
  if (preloadStatus === "done" || preloadStatus === "completed") {
    return "字幕已完成";
  }
  if (preloadStatus === "error" || preloadStatus === "failed") {
    return "任务失败";
  }
  if (preloadStatus === "cancelled") {
    return "任务已停止";
  }
  if (preloadStatus && preloadStatus !== "idle") {
    return "预加载";
  }
  return "待机";
}

function formatRole(role) {
  return {
    audio: "音频轨",
    video: "视频轨",
    playlist: "播放列表"
  }[role] || "媒体";
}

function formatSource(source) {
  return {
    "request-headers": "请求头",
    request: "请求",
    response: "响应",
    page: "页面",
    "media-element": "播放器",
    "json-parse": "页面数据",
    "hls-parse": "HLS 列表",
    "dash-parse": "DASH 列表"
  }[source] || source || "";
}

function jobTitle(job) {
  if (job.stage === "completed_with_warnings") {
    return "完成，有警告";
  }
  if (job.status === "done" || job.status === "completed") {
    return "字幕已完成";
  }
  if (job.status === "error" || job.status === "failed") {
    return "任务失败";
  }
  if (job.status === "cancelled") {
    return "任务已停止";
  }
  if (job.stage === "extracting_translating") {
    return "正在边抽边译";
  }
  if (job.stage === "asr_translation") {
    return "正在识别和翻译分段";
  }
  if (job.stage === "retry_failed") {
    return "正在重试失败识别分段";
  }
  return "正在预加载音频";
}

function stageLabel(stage) {
  return {
    queued: "排队中",
    extracting: "抽取",
    extracting_translating: "边抽边译",
    asr: "语音识别",
    asr_translation: "识别翻译",
    retry_failed: "重试失败",
    translating: "识别翻译",
    translated: "完成",
    completed: "完成",
    completed_with_warnings: "完成，有警告",
    cancelled: "已停止",
    failed: "失败",
    done: "完成",
    error: "失败"
  }[stage] || stage || "处理中";
}

function stageClassName(stage) {
  return String(stage || "unknown").toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "unknown";
}

function chunkStageLabel(stage) {
  return {
    queued: "排队",
    asr: "识别",
    asr_done: "待翻译",
    translation: "翻译",
    completed: "完成",
    done: "完成",
    failed: "失败",
    cancelled: "停止"
  }[stage] || stage || "排队";
}

function chunkMetaText(status) {
  const sourceSegments = status.sourceSegments || status.source_segments;
  const translatedSegments = status.translatedSegments || status.translated_segments;
  const parts = [];
  const message = String(status.message || "").trim();
  if (status.attempts) {
    parts.push(`第 ${status.attempts} 次尝试`);
  }
  if (status.stage === "done" && !sourceSegments && !translatedSegments) {
    parts.push("无语音");
  }
  if (sourceSegments) {
    parts.push(`原文 ${sourceSegments}`);
  }
  if (translatedSegments) {
    parts.push(`译文 ${translatedSegments}`);
  }
  if (!sourceSegments && status.sourceCount) {
    parts.push(`原文 ${status.sourceCount}`);
  }
  if (!translatedSegments && status.translatedCount) {
    parts.push(`译文 ${status.translatedCount}`);
  }
  if (message) {
    const duplicateMessage = parts.some(part => part === message);
    if (!duplicateMessage) {
      parts.push(message);
    }
  }
  const waiting = runningChunkWaitText(status);
  if (waiting) {
    parts.push(waiting);
  }
  return parts.join(" · ");
}

function runningChunkWaitText(status) {
  if (!["asr", "translation"].includes(status?.stage)) {
    return "";
  }
  const startedAt = Number(status.stageStartedAt || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return "";
  }
  return `已等待 ${formatDuration((Date.now() - startedAt) / 1000)}`;
}

function waitingFirstChunkText(job) {
  const progress = job?.progress || {};
  const extraction = progress.extraction || job?.extract || {};
  const parts = [];
  const activity = extractionActivityText(extraction);
  if (activity && activity !== "-") {
    parts.push(activity);
  } else {
    parts.push("等待首个音频切片生成");
  }
  const elapsed = Number(progress.elapsedSeconds || extraction.elapsedSeconds || 0) || 0;
  if (elapsed > 0) {
    parts.push(`已等待 ${formatDuration(elapsed)}`);
  }
  const readySeconds = Number(extraction.readySeconds || 0) || 0;
  if (readySeconds > 0) {
    parts.push(`已生成 ${formatDuration(readySeconds)} 可处理音频`);
  }
  return `${parts.join(" · ")}。`;
}

function extractionActivityText(extraction) {
  if (!extraction) {
    return "-";
  }
  const status = extraction.status || extraction.phase;
  if (status === "done" || status === "completed") {
    return "已完成";
  }
  if (status === "error" || status === "failed") {
    return "失败";
  }
  if (extraction.message) {
    return shorten(extraction.message, 34);
  }
  const done = Number(extraction.internalChunksDone || 0) || 0;
  const total = Number(extraction.internalChunksTotal || 0) || 0;
  if (total) {
    return `内部媒体切片 ${done}/${total}`;
  }
  const downloaded = Number(extraction.downloadedSegments || 0) || 0;
  const segmentTotal = Number(extraction.totalSegments || 0) || 0;
  if (segmentTotal) {
    return `下载媒体切片 ${downloaded}/${segmentTotal}`;
  }
  return "-";
}

function friendlyChunkError(error) {
  const text = String(error || "");
  if (!text) {
    return "";
  }
  if (text.includes("自动修复也失败") || text.includes("Expecting value") || text.includes("Expecting ',' delimiter")) {
    return "模型返回的 JSON 无法自动修复。建议降低翻译并发，或切换到更稳定的翻译模型后重试。";
  }
  if (text.includes("没有可用字幕")) {
    return "模型没有返回可用字幕条目。已保留失败状态，可重试。";
  }
  return shorten(text, 120);
}

function updateActionButtons(job) {
  const running = isRunningJob(job);
  const failed = Number(job?.translation?.chunksFailed || job?.progress?.chunksFailed || 0);
  const sourceChunks = countReusableSourceChunks(job);
  const audioChunks = countReusableAudioChunks(job);
  const canResumeAudio = audioChunks > 0 && !sourceChunks;
  const canResumeTranslation = sourceChunks > 0;
  const canRetryPreload = failed > 0 || canResumeAudio || canResumeTranslation;
  const audioCacheRemoved = Boolean(job?.audioCacheRemoved);
  elements.startPreload.disabled = startRequestInFlight || running;
  elements.startPreload.textContent = job ? "重新抽取全部" : "开始抽取";
  elements.startPreload.title = job ? "放弃当前任务状态，从选中的媒体源重新抽取音频并创建新任务。" : "从当前选中的媒体源抽取音频并生成字幕。";
  elements.retryPreload.textContent = failed
    ? `重试失败识别分段 ${failed}`
    : canResumeTranslation
      ? "继续翻译"
      : canResumeAudio
        ? "继续 ASR"
        : "重试失败识别分段";
  elements.retryPreload.title = audioCacheRemoved
    ? "当前任务的音频缓存已清除，需要重新抽取全部。"
    : canResumeTranslation && !failed
      ? "复用已有 ASR 原文继续翻译，不重新抽取音频，也不重新语音识别。"
      : canResumeAudio && !failed
        ? "复用已抽取的音频缓存继续语音识别和翻译，不重新下载媒体切片。"
        : "只重试当前任务里的失败识别分段，优先复用已有 ASR 原文，其次复用已抽取的音频缓存。";
  elements.retryPreload.disabled = retryRequestInFlight || !job || running || audioCacheRemoved || !canRetryPreload;
  elements.retryTranslation.textContent = "重翻译字幕";
  elements.retryTranslation.title = "只复用已有 ASR 原文重新翻译，不重新抽取音频，也不重新语音识别。";
  elements.retryTranslation.disabled = translationRetryRequestInFlight || !job || running || sourceChunks <= 0;
  elements.cancelPreload.disabled = !running;
  elements.clearAudioCache.disabled = !job || running;
  elements.clearAudioCache.textContent = "清音频缓存";
  elements.clearAudioCache.title = running
    ? "任务运行中不能清音频缓存，请先停止或等待结束。"
    : audioCacheRemoved
      ? "再次扫描并清除当前任务的本机音频切片；字幕缓存不受影响。"
      : "只清除当前任务的本机音频切片；字幕缓存不受影响。";
}

function countReusableSourceChunks(job) {
  const direct = Number(job?.reusableSourceChunks || job?.translation?.reusableSourceChunks || job?.progress?.translation?.reusableSourceChunks || 0);
  if (direct > 0) {
    return direct;
  }
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || [];
  if (Array.isArray(statuses)) {
    const count = statuses.filter(chunkHasReusableSource).length;
    if (count) {
      return count;
    }
  }
  const sourceSegments = Number(job?.translation?.sourceSegments || job?.progress?.sourceSegments || 0);
  return sourceSegments > 0 ? 1 : 0;
}

function countReusableAudioChunks(job) {
  const direct = Number(job?.reusableAudioChunks || job?.translation?.reusableAudioChunks || job?.progress?.translation?.reusableAudioChunks || 0);
  if (direct > 0) {
    return direct;
  }
  const total = Number(job?.translation?.chunksTotal || job?.progress?.translation?.chunksTotal || job?.progress?.chunksTotal || 0);
  const extractDone = job?.extract?.status === "completed" || job?.progress?.extraction?.status === "completed";
  return extractDone && total > 0 ? total : 0;
}

function isRunningJob(job) {
  if (!job) {
    return false;
  }
  return !["done", "completed", "error", "failed", "cancelled"].includes(job.status);
}

function extractionProgressText(progress, status) {
  if (status === "error" || status === "failed") {
    return "失败";
  }
  if (progress?.status === "done" || progress?.status === "completed") {
    return "100%";
  }
  if (progress?.message && Number.isFinite(Number(progress?.percent))) {
    return `${Number(progress.percent).toFixed(1)}% · ${shorten(progress.message, 24)}`;
  }
  if (Number.isFinite(Number(progress?.percent))) {
    return `${Number(progress.percent).toFixed(1)}%`;
  }
  return stageLabel(progress?.stage || status);
}

function translationProgressText(translation) {
  const total = translation?.chunksTotal || 0;
  const done = translation?.chunksDone || 0;
  const active = (translation?.chunksAsr || 0) + (translation?.chunksTranslating || 0);
  const failed = translation?.chunksFailed || 0;
  if (!total) {
    return "等待首段";
  }
  const parts = [`${done}/${total}`];
  if (active) {
    parts.push(`${active} 处理中`);
  }
  if (failed) {
    parts.push(`${failed} 失败`);
  }
  return parts.join(" · ");
}

function normalizedPercent(percent, status) {
  if (status === "done" || status === "completed") {
    return 100;
  }
  if (status === "error" || status === "failed") {
    return 100;
  }
  const value = Number(percent);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function formatDuration(seconds) {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) {
    return "";
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function formatElapsedSeconds(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${total}s`;
}

function shorten(value, max = 92) {
  const text = String(value || "");
  if (text.length <= max) {
    return text;
  }
  const head = Math.max(24, Math.floor(max * 0.52));
  const tail = Math.max(20, max - head - 3);
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function clampSetting(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return clamp(number, min, max);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function setMessage(text = "") {
  const value = String(text || "").trim();
  elements.message.textContent = value;
  elements.taskMessage.textContent = value;
  elements.taskMessage.hidden = !value;
}

function valueOrDefault(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function send(message) {
  return chrome.runtime.sendMessage(message).catch(error => ({
    ok: false,
    error: `扩展后台暂时没有响应：${formatRuntimeError(error.message)}`
  }));
}

function formatRuntimeError(message = "") {
  const text = String(message || "").trim();
  if (/Extension context invalidated/i.test(text)) {
    return "扩展上下文已失效，请重新加载扩展并刷新当前页面。";
  }
  if (/Receiving end does not exist/i.test(text)) {
    return "页面脚本还没有准备好，请刷新当前页面后重试。";
  }
  if (/message port closed/i.test(text)) {
    return "后台响应中断，请重试。";
  }
  return text || "未知错误";
}
