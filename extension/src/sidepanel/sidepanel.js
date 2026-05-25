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
  GET_PRELOAD_DIAGNOSTICS: "FUGUANG_GET_PRELOAD_DIAGNOSTICS",
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
const SUBTITLE_CACHE_SCHEMA_VERSION = 4;
const SUBTITLE_CACHE_STRICT_LEGACY_SCHEMA_VERSION = 3;
const SUBTITLE_CACHE_LEGACY_SCHEMA_VERSION = 2;
const SUBTITLE_USER_SCROLL_HOLD_MS = 8000;
const normalizeTargetLanguageValue = FuguangSidepanelLanguage.normalizeTargetLanguageValue;
const normalizeSourceLanguageValue = FuguangSidepanelLanguage.normalizeSourceLanguageValue;
const DEFAULT_ASR_PROFILE_ID = FuguangSidepanelProfiles.DEFAULT_ASR_PROFILE_ID;
const DEFAULT_LLM_PROFILE_ID = FuguangSidepanelProfiles.DEFAULT_LLM_PROFILE_ID;
const createEmptyProfile = FuguangSidepanelProfiles.createEmptyProfile;
const defaultProfiles = FuguangSidepanelProfiles.defaultProfiles;
const normalizeAsrVadFilterMode = FuguangSidepanelProfiles.normalizeAsrVadFilterMode;
const normalizeSelectedProfileId = FuguangSidepanelProfiles.normalizeSelectedProfileId;
const normalizeStoredProfiles = FuguangSidepanelProfiles.normalizeStoredProfiles;
const placeholderBaseUrl = FuguangSidepanelProfiles.placeholderBaseUrl;
const profileById = FuguangSidepanelProfiles.profileById;
const uniqueProfiles = FuguangSidepanelProfiles.uniqueProfiles;

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
  exportDiagnostics: document.querySelector("#exportDiagnostics"),
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

setSubtitleOutputRuntimeStateProvider(() => ({
  mode: subtitleDisplayMode,
  isRunning: isRunningJob(currentJob)
}));

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
elements.exportDiagnostics.addEventListener("click", () => exportCurrentDiagnostics());
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
    const previousTab = activeTab;
    if (changed && previousTab?.id && (subtitleCues.length || attachedSubtitleTabId === previousTab.id)) {
      await detachSubtitlesFromTab(previousTab.id);
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

function setTargetLanguageValue(value) {
  elements.targetLanguage.value = normalizeTargetLanguageValue(value, DEFAULTS.targetLanguage);
}

function getTargetLanguageValue() {
  return normalizeTargetLanguageValue(elements.targetLanguage.value, DEFAULTS.targetLanguage);
}

function setSourceLanguageValue(value) {
  elements.sourceLanguage.value = normalizeSourceLanguageValue(value, DEFAULTS.sourceLanguage);
}

function getSourceLanguageValue() {
  return normalizeSourceLanguageValue(elements.sourceLanguage.value, DEFAULTS.sourceLanguage);
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
  const requestContext = captureSidepanelRequestContext();
  retryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage(retryPreloadMessage(currentJob));
  try {
    const response = await send({ type: MESSAGE.RETRY_PRELOAD, tabId: requestContext.tabId });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage("当前标签页已经变化，已忽略刚才返回的旧任务。");
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
  const asrPartialFailed = Number(job?.translation?.chunksAsrPartialFailed || job?.progress?.translation?.chunksAsrPartialFailed || 0);
  if (failed + asrPartialFailed > 0) {
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
  const requestContext = captureSidepanelRequestContext();
  translationRetryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage("正在只重翻译字幕，不会重新语音识别...");
  try {
    const response = await send({
      type: MESSAGE.RETRANSLATE_PRELOAD,
      tabId: requestContext.tabId,
      chunkIndexes: Array.isArray(chunkIndexes) ? chunkIndexes : []
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage("当前标签页已经变化，已忽略刚才返回的旧任务。");
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
  const requestContext = captureSidepanelRequestContext();
  if (retryingChunks.has(index)) {
    return;
  }
  retryingChunks.add(index);
  updateActionButtons(currentJob);
  setMessage(options.translationOnly ? `正在重翻译第 ${index + 1} 个翻译分段...` : `正在重试第 ${index + 1} 个失败识别分段...`);
  try {
    const response = await send({
      type: options.translationOnly ? MESSAGE.RETRANSLATE_PRELOAD : MESSAGE.RETRY_PRELOAD_CHUNKS,
      tabId: requestContext.tabId,
      chunkIndexes: [index]
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage("当前标签页已经变化，已忽略刚才返回的旧任务。");
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

function captureSidepanelRequestContext() {
  return {
    tabId: activeTab?.id || 0,
    tabKey: activeTabKey(activeTab),
    jobId: currentJobId || ""
  };
}

async function sidepanelRequestStillCurrent(requestContext) {
  await refreshActiveTab();
  return sidepanelRequestContextStillCurrent(requestContext);
}

function sidepanelRequestContextStillCurrent(requestContext) {
  return Boolean(
    requestContext?.tabId &&
    requestContext.tabKey &&
    activeTabKey(activeTab) === requestContext.tabKey &&
    (currentJobId || "") === (requestContext.jobId || "")
  );
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
  const requestTabKey = activeTabKey(activeTab);
  const requestCurrentJobId = currentJobId || "";
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
  const pending = loadSubtitleCues(jobId);
  pendingSubtitlePromise = pending;
  let result;
  try {
    result = await pending;
  } finally {
    if (pendingSubtitlePromise === pending) {
      pendingSubtitlePromise = null;
      pendingSubtitleSignature = "";
    }
  }
  if (!shouldApplySubtitleRenderLoad(requestId, requestTabKey, requestCurrentJobId)) {
    return;
  }
  const cues = result.cues;
  renderedSubtitleJobId = jobId || renderedSubtitleJobId;
  renderedSubtitleSignature = signature || "";
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

function shouldApplySubtitleRenderLoad(requestId, requestTabKey, requestCurrentJobId) {
  if (requestId !== subtitleLoadRequestId) {
    return false;
  }
  if (!requestTabKey || activeTabKey(activeTab) !== requestTabKey) {
    return false;
  }
  if (requestCurrentJobId && currentJobId !== requestCurrentJobId) {
    return false;
  }
  return true;
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
  const visibleCues = subtitleCues
    .map((cue, index) => ({ cue, index }))
    .filter(item => shouldIncludeCueInSubtitleOutput(item.cue, subtitleDisplayMode, subtitleCues));
  if (!subtitleCues.length) {
    elements.subtitleList.textContent = renderedSubtitleJobId ? "字幕文件为空。" : "字幕生成后会显示在这里。";
    renderSubtitleNotice();
    return;
  }
  if (!visibleCues.length) {
    elements.subtitleList.textContent = "当前模式下没有可显示的真实译文。";
    renderSubtitleNotice();
    return;
  }
  for (const { cue, index } of visibleCues) {
    const item = document.createElement("div");
    item.className = "cue";
    item.dataset.index = String(index);
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = cue.time;
    const textWrap = document.createElement("div");
    textWrap.className = "subtitle-lines";
    if (subtitleDisplayMode === "bilingual" && cue.sourceText && cue.sourceText !== cue.text) {
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
  cachedSubtitleLoadedKey = "";
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
    return "字幕列表、浮层和导出会先用 ASR 原文补位；译文完成后会自动替换，若模型最终拒绝翻译也不会留下空白。";
  }
  if (translatedCount < sourceCount) {
    return "部分译文已完成；缺译句已用 ASR 原文补位，字幕列表、浮层和导出保持完整，重翻译成功后会自动替换。";
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
    if (["failed", "completed_with_warnings"].includes(status.stage)) {
      const running = isRunningJob(currentJob);
      const audioCacheRemoved = Boolean(currentJob?.audioCacheRemoved);
      const needsAsrRetry = chunkNeedsAsrRetry(status);
      const sourceAvailable = chunkHasReusableSource(status) && !needsAsrRetry;
      const retry = document.createElement("button");
      retry.className = "chunk-retry";
      retry.type = "button";
      retry.textContent = sourceAvailable ? "重翻译" : "重试";
      retry.disabled = running || (!sourceAvailable && audioCacheRemoved) || retryingChunks.has(Number(status.index));
      retry.title = audioCacheRemoved
        ? (sourceAvailable ? "后台仍保留当前任务的 ASR 原文时，只重跑这个翻译分段；如果浏览器回收了后台任务状态，需要重新抽取。" : "当前任务的音频缓存已清除，需要重新抽取全部。")
        : running
          ? "当前任务仍在运行，结束后可单独重试这个失败识别分段。"
          : (sourceAvailable ? "后台仍保留当前任务的 ASR 原文时，只重跑这个翻译分段；如果浏览器回收了后台任务状态，需要重新抽取。" : "重新识别并翻译这个失败识别分段。");
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

function chunkNeedsAsrRetry(status) {
  return Number(status?.asrFailures || status?.asr_failures || 0) > 0;
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
  if (!hasDisplayableSubtitleVtt(vtt)) {
    await detachCurrentSubtitlesFromPage();
    renderSubtitleNotice();
    return;
  }
  const requestContext = captureSidepanelRequestContext();
  const signature = subtitleAttachSignature(requestContext.tabId, vtt);
  const response = await send({ type: MESSAGE.ATTACH_VTT_TEXT, tabId: requestContext.tabId, vtt });
  if (!response.ok) {
    renderSubtitleNotice(response.error || "当前页面没有可挂载字幕的播放器。");
    return;
  }
  if (!sidepanelRequestContextStillCurrent(requestContext)) {
    await detachSubtitlesFromTab(requestContext.tabId);
    return;
  }
  attachedSubtitleTabId = requestContext.tabId;
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
  if (!hasDisplayableSubtitleVtt(vtt)) {
    await detachCurrentSubtitlesFromPage();
    return;
  }
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
  if (!activeTab?.id) {
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    return;
  }
  await detachSubtitlesFromTab(activeTab.id);
}

async function detachSubtitlesFromTab(tabId) {
  if (attachedSubtitleTabId === tabId) {
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
  }
  if (!tabId) {
    return;
  }
  await send({ type: MESSAGE.DETACH_PRELOAD_VTT, tabId }).catch(() => null);
}

function subtitleAttachSignature(tabId, vtt) {
  const text = String(vtt || "");
  // Must match background attachVttText(); the page reports that signature back.
  return `manual:${vttContentSignature(text)}`;
}

function hasDisplayableSubtitleVtt(vtt) {
  return /-->/.test(String(vtt || ""));
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
  if (isRunningJob(currentJob) && !transcriptHasRealTranslatedCue(transcript)) {
    return;
  }
  if (!transcriptHasDisplayableCues(transcript, subtitleDisplayMode, { allowRunningSourcePreview: false })) {
    return;
  }
  const entry = await buildSubtitleCacheEntry(transcript, transcript?.metadata || {});
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
  const srt = cuesToSrt(subtitleCues, subtitleDisplayMode, { allowRunningSourcePreview: false });
  if (!/\d+\n\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(srt)) {
    setMessage("当前模式下还没有可导出的真实译文。");
    return;
  }
  const blob = new Blob([srt], { type: "application/x-subrip;charset=utf-8" });
  await downloadBlob(blob, `${safeFilename(elements.pageTitle.textContent || "fuguang-subtitle")}.srt`);
  setMessage("SRT 字幕已导出。");
}

async function exportCurrentDiagnostics() {
  const jobId = currentJobId || renderedSubtitleJobId;
  if (!jobId) {
    setMessage("还没有可导出的诊断任务。");
    return;
  }
  const response = await send({ type: MESSAGE.GET_PRELOAD_DIAGNOSTICS, jobId });
  if (!response.ok || !response.diagnostics) {
    setMessage(response.error || "ASR 诊断导出失败。");
    return;
  }
  const baseName = `${safeFilename(elements.pageTitle.textContent || "fuguang-subtitle")}-asr-diagnostics`;
  const audioFiles = normalizeDiagnosticAudioFiles(response.audioFiles);
  if (audioFiles.length) {
    const archive = buildDiagnosticsTarArchive(response.diagnostics, audioFiles);
    const blob = new Blob([archive], { type: "application/x-tar" });
    await downloadBlob(blob, `${baseName}.tar`);
    setMessage(`ASR 诊断已导出（含 ${audioFiles.length} 个音频分段）。`);
    return;
  }
  const json = JSON.stringify(response.diagnostics, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  await downloadBlob(blob, `${baseName}.json`);
  setMessage("ASR 诊断已导出。");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function normalizeDiagnosticAudioFiles(files) {
  if (!Array.isArray(files)) {
    return [];
  }
  return files
    .map((file, index) => {
      const bytes = diagnosticFileBytes(file?.buffer) || diagnosticBase64FileBytes(file?.base64);
      if (!bytes?.byteLength) {
        return null;
      }
      return {
        path: safeTarPath(file.path || `audio/chunk-${String(index).padStart(4, "0")}.mp3`),
        bytes
      };
    })
    .filter(Boolean);
}

function diagnosticFileBytes(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer);
  }
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  return null;
}

function diagnosticBase64FileBytes(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) {
    return null;
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = text.replace(/=+$/, "");
  const bytes = [];
  for (let index = 0; index < clean.length; index += 4) {
    const first = alphabet.indexOf(clean[index]);
    const second = alphabet.indexOf(clean[index + 1]);
    const third = alphabet.indexOf(clean[index + 2]);
    const fourth = alphabet.indexOf(clean[index + 3]);
    if (first < 0 || second < 0) {
      return null;
    }
    const triplet = (first << 18)
      | (second << 12)
      | ((third >= 0 ? third : 0) << 6)
      | (fourth >= 0 ? fourth : 0);
    bytes.push((triplet >> 16) & 255);
    if (third >= 0 && index + 2 < clean.length) {
      bytes.push((triplet >> 8) & 255);
    }
    if (fourth >= 0 && index + 3 < clean.length) {
      bytes.push(triplet & 255);
    }
  }
  return new Uint8Array(bytes);
}

function buildDiagnosticsTarArchive(diagnostics, audioFiles) {
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(JSON.stringify(diagnostics, null, 2));
  const entries = [
    { path: "diagnostics.json", bytes: jsonBytes },
    ...audioFiles
  ];
  const totalBytes = entries.reduce((sum, entry) => sum + 512 + tarPaddedSize(entry.bytes.byteLength), 1024);
  const archive = new Uint8Array(totalBytes);
  let offset = 0;
  for (const entry of entries) {
    writeTarHeader(archive, offset, entry.path, entry.bytes.byteLength);
    offset += 512;
    archive.set(entry.bytes, offset);
    offset += tarPaddedSize(entry.bytes.byteLength);
  }
  return archive;
}

function tarPaddedSize(size) {
  return Math.ceil(Math.max(0, Number(size) || 0) / 512) * 512;
}

function writeTarHeader(archive, offset, path, size) {
  const header = archive.subarray(offset, offset + 512);
  writeTarString(header, 0, 100, safeTarPath(path));
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  for (let index = 148; index < 156; index += 1) {
    header[index] = 32;
  }
  header[156] = 48;
  writeTarString(header, 257, 6, "ustar");
  writeTarString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarOctal(header, 148, 8, checksum);
}

function writeTarString(header, offset, length, value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  header.set(bytes.slice(0, length), offset);
}

function writeTarOctal(header, offset, length, value) {
  const text = Math.max(0, Number(value) || 0)
    .toString(8)
    .padStart(length - 1, "0")
    .slice(-(length - 1));
  writeTarString(header, offset, length - 1, text);
  header[offset + length - 1] = 0;
}

function safeTarPath(value = "") {
  return String(value || "")
    .replace(/^\/+/, "")
    .replace(/\.\.(?:\/|$)/g, "")
    .replace(/[\\\u0000-\u001f]+/g, "_")
    .slice(0, 100) || "diagnostics.bin";
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

    if (!deleted && !wasShowingClearedCache) {
      renderSubtitleNotice();
      setMessage("当前页面没有已保存的字幕缓存。");
      return;
    }
    let suppressError = "";
    if (wasShowingClearedCache || subtitleCues.length) {
      const jobIdToSuppress = currentJobId || renderedSubtitleJobId || currentSubtitleCacheEntry?.jobId || "";
      if (jobIdToSuppress) {
        clearedSubtitleJobIds.add(jobIdToSuppress);
        try {
          await suppressPreloadSubtitleState(jobIdToSuppress);
        } catch (error) {
          suppressError = formatRuntimeError(error.message);
        }
      }
      await detachCurrentSubtitlesFromPage();
      clearSubtitles("已清除当前页面字幕缓存。");
    } else {
      renderSubtitleNotice();
    }
    if (suppressError) {
      setMessage(`已清除当前页面字幕缓存（${deleted} 条），但后台字幕状态清理失败：${suppressError}`);
    } else if (deleted) {
      setMessage(`已清除当前页面字幕缓存（${deleted} 条）。`);
    } else {
      setMessage("当前页面没有已保存的字幕缓存，已清除当前显示的缓存字幕。");
    }
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
  const requestTabKey = activeTabKey(activeTab);
  const requestLoadId = subtitleLoadRequestId;
  cacheAutoLoadInFlight = true;
  try {
    await pruneSubtitleCache();
    if (!shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId)) {
      return;
    }
    const { key, entry } = await getSubtitleCacheEntryForCurrentPage();
    if (!shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId)) {
      return;
    }
    if (!key) {
      await detachStalePageSubtitlesWithoutCache();
      return;
    }
    if (!entry?.transcript) {
      await detachStalePageSubtitlesWithoutCache();
      return;
    }
    const cues = cuesFromTranscript(entry.transcript);
    if (!cues.length) {
      await detachStalePageSubtitlesWithoutCache();
      return;
    }
    if (!shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId)) {
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

function shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId) {
  return Boolean(
    requestTabKey &&
    activeTabKey(activeTab) === requestTabKey &&
    subtitleLoadRequestId === requestLoadId &&
    !currentJobId &&
    !subtitleCues.length
  );
}

async function detachStalePageSubtitlesWithoutCache() {
  if (!activeTab?.id || currentJobId || subtitleCues.length) {
    return;
  }
  await detachCurrentSubtitlesFromPage();
}

async function buildSubtitleCacheEntry(transcript, importedPayload = {}) {
  const metadata = transcript?.metadata && typeof transcript.metadata === "object" ? transcript.metadata : {};
  const payload = { ...metadata, ...importedPayload };
  const context = currentSubtitleCacheContext(payload);
  const selected = getSelectedCandidate();
  const pageUrl = normalizeCacheUrl(context.pageUrl);
  const title = payload.title || elements.pageTitle.textContent || selected?.title || "";
  const sourceUrl = normalizeMediaCacheUrl(context.sourceUrl);
  const id = await buildSubtitleCacheKey({ pageUrl, sourceUrl });
  return {
    id,
    pageUrl,
    title,
    sourceUrl,
    jobId: payload.jobId || renderedSubtitleJobId || currentJobId || "",
    transcript,
    createdAt: payload.createdAt || new Date().toISOString(),
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

async function getSubtitleCacheEntryForCurrentPage() {
  const context = currentSubtitleCacheContext();
  const key = await buildSubtitleCacheKey(context);
  const entry = key ? await getSubtitleCacheEntry(key) : null;
  if (subtitleCacheEntryMatchesContext(entry, context) && subtitleCacheEntryHasDisplayableCues(entry)) {
    return { key, entry };
  }
  for (const legacyKey of await buildLegacySubtitleCacheKeys(context)) {
    const legacyEntry = await getSubtitleCacheEntry(legacyKey);
    if (subtitleCacheEntryMatchesContext(legacyEntry, context) && subtitleCacheEntryHasDisplayableCues(legacyEntry)) {
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
  for (const entry of await getSubtitleCacheEntriesMatchingPageContext(context, { includeUnsafeForClear: true })) {
    if (entry?.id) {
      keys.add(entry.id);
    }
  }
  return [...keys];
}

async function buildLegacySubtitleCacheKeys({ pageUrl = "", sourceUrl = "" }) {
  const normalizedPage = normalizeCacheUrl(pageUrl);
  const normalizedSource = normalizeMediaCacheUrl(sourceUrl);
  const keys = [];
  const strictSeed = normalizedPage && normalizedSource
    ? subtitleCacheSeed(normalizedPage, normalizedSource)
    : "";
  if (strictSeed) {
    keys.push(`subtitle:v${SUBTITLE_CACHE_STRICT_LEGACY_SCHEMA_VERSION}:${await sha256Text(strictSeed)}`);
  }
  if (canUsePageOnlySubtitleCacheFallback(normalizedPage)) {
    return keys;
  }
  const seeds = [...new Set([normalizedPage, normalizedSource].filter(Boolean))];
  for (const seed of seeds) {
    keys.push(`subtitle:v${SUBTITLE_CACHE_LEGACY_SCHEMA_VERSION}:${await sha256Text(seed)}`);
  }
  return keys;
}

async function findSubtitleCacheEntryByPageContext(context) {
  const entry = (await getSubtitleCacheEntriesMatchingPageContext(context))
    .find(subtitleCacheEntryHasDisplayableCues);
  return entry?.id ? { key: entry.id, entry } : null;
}

async function getSubtitleCacheEntriesMatchingPageContext(context, { includeUnsafeForClear = false } = {}) {
  const currentPage = normalizeCacheUrl(context.pageUrl);
  if (!canUsePageOnlySubtitleCacheFallback(currentPage)) {
    return [];
  }
  return (await getAllSubtitleCacheEntries())
    .filter(entry => includeUnsafeForClear
      ? subtitleCacheEntryMatchesPageForClear(entry, currentPage)
      : subtitleCacheEntryMatchesPageFallback(entry, currentPage, context))
    .sort((left, right) => subtitleCacheEntryTime(right) - subtitleCacheEntryTime(left));
}

function subtitleCacheEntryMatchesPageFallback(entry, normalizedPage, context) {
  return Boolean(
    entry?.id &&
    entry?.transcript &&
    subtitleCacheEntryHasCurrentSchema(entry) &&
    normalizedPage &&
    normalizeCacheUrl(entry.pageUrl) === normalizedPage &&
    subtitleCacheEntryHasSameMediaIdentity(entry, context) &&
    subtitleCacheEntryMetadataMatchesContext(entry, context)
  );
}

function subtitleCacheEntryHasDisplayableCues(entry) {
  return Boolean(entry?.transcript && transcriptHasDisplayableCues(entry.transcript, subtitleDisplayMode, {
    allowRunningSourcePreview: false
  }));
}

function subtitleCacheEntryHasCurrentSchema(entry) {
  return String(entry?.id || "").startsWith(`subtitle:v${SUBTITLE_CACHE_SCHEMA_VERSION}:`);
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
  const contentVersion = subtitleContentVersion(translation);
  return contentVersion ? `${base}:${contentVersion}` : "";
}

function subtitleContentVersion(translation = {}) {
  for (const key of ["vttSignature", "transcriptHash", "contentHash"]) {
    const value = String(translation?.[key] || "").trim();
    if (value) {
      return `${key}:${value}`;
    }
  }
  if (translation.vttText) {
    return `vtt:${textContentSignature(translation.vttText)}`;
  }
  if (translation.transcript) {
    return `transcript:${textContentSignature(JSON.stringify(translation.transcript))}`;
  }
  return "";
}

function textContentSignature(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

function safeFilename(value) {
  const text = String(value || "fuguang-subtitle")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text || "fuguang-subtitle").slice(0, 80);
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
    completed_with_warnings: "部分完成",
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
  const asrFailures = Number(status.asrFailures || status.asr_failures || 0);
  if (asrFailures > 0) {
    parts.push(`${asrFailures} 个音频分段识别失败`);
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
  const asrPartialFailed = Number(job?.translation?.chunksAsrPartialFailed || job?.progress?.translation?.chunksAsrPartialFailed || 0);
  const retryableAsrFailures = failed + asrPartialFailed;
  const sourceChunks = countReusableSourceChunks(job);
  const audioChunks = countReusableAudioChunks(job);
  const canResumeAudio = audioChunks > 0 && !sourceChunks;
  const canResumeTranslation = sourceChunks > 0;
  const canRetryPreload = retryableAsrFailures > 0 || canResumeAudio || canResumeTranslation;
  const audioCacheRemoved = Boolean(job?.audioCacheRemoved);
  elements.startPreload.disabled = startRequestInFlight || running;
  elements.startPreload.textContent = job ? "重新抽取全部" : "开始抽取";
  elements.startPreload.title = job ? "放弃当前任务状态，从选中的媒体源重新抽取音频并创建新任务。" : "从当前选中的媒体源抽取音频并生成字幕。";
  elements.retryPreload.textContent = retryableAsrFailures
    ? `重试失败识别分段 ${retryableAsrFailures}`
    : canResumeTranslation
      ? "继续翻译"
      : canResumeAudio
        ? "继续 ASR"
        : "重试失败识别分段";
  elements.retryPreload.title = audioCacheRemoved
    ? "当前任务的音频缓存已清除，需要重新抽取全部。"
    : canResumeTranslation && !retryableAsrFailures
      ? "后台仍保留当前任务的 ASR 原文时，继续翻译不重新抽取音频，也不重新语音识别。"
      : canResumeAudio && !retryableAsrFailures
        ? "复用已抽取的音频缓存继续语音识别和翻译，不重新下载媒体切片。"
        : "只重试当前任务里的失败识别分段，优先复用已有 ASR 原文，其次复用已抽取的音频缓存。";
  elements.retryPreload.disabled = retryRequestInFlight || !job || running || audioCacheRemoved || !canRetryPreload;
  elements.retryTranslation.textContent = "重翻译字幕";
  elements.retryTranslation.title = "后台仍保留当前任务的 ASR 原文时，只重新翻译字幕；如果浏览器回收了后台任务状态，需要重新抽取。";
  elements.retryTranslation.disabled = translationRetryRequestInFlight || !job || running || sourceChunks <= 0;
  elements.cancelPreload.disabled = !running;
  elements.clearAudioCache.disabled = !job || running;
  elements.clearAudioCache.textContent = "清音频缓存";
  elements.clearAudioCache.title = running
    ? "任务运行中不能清音频缓存，请先停止或等待结束。"
    : audioCacheRemoved
      ? "再次清除当前任务的浏览器本地音频切片缓存；字幕缓存不受影响。"
      : "只清除当前任务的浏览器本地音频切片缓存；字幕缓存不受影响。";
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
