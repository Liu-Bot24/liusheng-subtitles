import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";
import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";
import { FuguangBrowserLanguage } from "./browser-language.js";
import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";
import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";
import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";
import { FuguangMediaHeaderRules } from "./media-header-rules.js";

var normalizeAsrTimeoutMs = FuguangBrowserAsrProvider.normalizeAsrTimeoutMs;
var ASR_VAD_SPLIT_MIN_SILENCE_SECONDS = FuguangBrowserAsrPostprocess.ASR_VAD_SPLIT_MIN_SILENCE_SECONDS;
var filterAsrSegmentsByChunkOwnership = FuguangBrowserAsrPostprocess.filterAsrSegmentsByChunkOwnership;
var filterAsrSegmentsByHallucinationGuard = FuguangBrowserAsrPostprocess.filterAsrSegmentsByHallucinationGuard;
var filterAsrSegmentsBySpeechActivity = FuguangBrowserAsrPostprocess.filterAsrSegmentsBySpeechActivity;
var filterAsrSuspiciousRepeatedRuns = FuguangBrowserAsrPostprocess.filterAsrSuspiciousRepeatedRuns;
var mergeAdjacentDuplicateAsrSegments = FuguangBrowserAsrPostprocess.mergeAdjacentDuplicateAsrSegments;
var mergeAsrSpeechIntervals = FuguangBrowserAsrPostprocess.mergeAsrSpeechIntervals;
var normalizeAsrSegments = FuguangBrowserAsrPostprocess.normalizeAsrSegments;
var normalizeAsrSpeechIntervals = FuguangBrowserAsrPostprocess.normalizeAsrSpeechIntervals;
var shouldSkipBrowserAsrChunk = FuguangBrowserAsrPostprocess.shouldSkipBrowserAsrChunk;
var browserAsrRequestFields = FuguangBrowserAsrProvider.browserAsrRequestFields;
var resolveBrowserAsrSupportedRequestFields = FuguangBrowserAsrProvider.resolveBrowserAsrSupportedRequestFields;
var normalizeAsrVadFilterMode = FuguangBrowserAsrProvider.normalizeAsrVadFilterMode;
var browserAsrEndpoint = FuguangBrowserAsrProvider.browserAsrEndpoint;
var normalizeAsrLanguage = FuguangBrowserAsrProvider.normalizeAsrLanguage;
var normalizeTargetLanguage = FuguangBrowserLanguage.normalizeTargetLanguage;
var DEFAULT_ASR_PROFILE_ID = FuguangBrowserModelProfiles.DEFAULT_ASR_PROFILE_ID;
var AUDIO_EXTENSIONS = FuguangBrowserMediaCandidates.AUDIO_EXTENSIONS;
var MANIFEST_EXTENSIONS = FuguangBrowserMediaCandidates.MANIFEST_EXTENSIONS;
var candidateFingerprint = FuguangBrowserMediaCandidates.candidateFingerprint;
var candidatesReferToSamePreloadTarget = FuguangBrowserMediaCandidates.candidatesReferToSamePreloadTarget;
var classifyUrl = FuguangBrowserMediaCandidates.classifyUrl;
var compactRequestHeaders = FuguangBrowserMediaCandidates.compactRequestHeaders;
var compactResponseHeaders = FuguangBrowserMediaCandidates.compactResponseHeaders;
var firstUsefulTitle = FuguangBrowserMediaCandidates.firstUsefulTitle;
var getGroupedCandidatesForState = FuguangBrowserMediaCandidates.getGroupedCandidatesForState;
var getHeader = FuguangBrowserMediaCandidates.getHeader;
var inferKindFromContentType = FuguangBrowserMediaCandidates.inferKindFromContentType;
var isGenericBinaryContentType = FuguangBrowserMediaCandidates.isGenericBinaryContentType;
var isIgnoredMediaUrl = FuguangBrowserMediaCandidates.isIgnoredMediaUrl;
var isMediaContentType = FuguangBrowserMediaCandidates.isMediaContentType;
var mergeCandidate = FuguangBrowserMediaCandidates.mergeCandidate;
var pickFinite = FuguangBrowserMediaCandidates.pickFinite;
var resolvePreloadCandidateForStart = FuguangBrowserMediaCandidates.resolvePreloadCandidateForStart;
var sanitizeInternalRequestHeaders = FuguangBrowserMediaCandidates.sanitizeInternalRequestHeaders;
var stripCandidateRequestHeaders = FuguangBrowserMediaCandidates.stripCandidateRequestHeaders;
var DEFAULT_LLM_PROFILE_ID = FuguangBrowserModelProfiles.DEFAULT_LLM_PROFILE_ID;
var compactProviderConfig = FuguangBrowserModelProfiles.compactProviderConfig;
var findProfile = FuguangBrowserModelProfiles.findProfile;
var normalizeProviderType = FuguangBrowserModelProfiles.normalizeProviderType;
var normalizeSelectedProfileId = FuguangBrowserModelProfiles.normalizeSelectedProfileId;
var normalizeStoredProfiles = FuguangBrowserModelProfiles.normalizeStoredProfiles;
var translateBrowserSegments = FuguangBrowserTranslationPipeline.translateBrowserSegments;
var translateBrowserSegmentsBatch = FuguangBrowserTranslationPipeline.translateBrowserSegmentsBatch;
var browserTranslationFailures = FuguangBrowserTranslationPipeline.browserTranslationFailures;
var withMediaRequestHeaderRules = FuguangMediaHeaderRules.withMediaRequestHeaderRules;
var updateMediaRequestHeaderRuleDomains = FuguangMediaHeaderRules.updateMediaRequestHeaderRuleDomains;
var buildMediaHeaderRules = FuguangMediaHeaderRules.buildMediaHeaderRules;

const MESSAGE = {
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  ACTIVATE_PAGE: "FUGUANG_ACTIVATE_PAGE",
  START_PRELOAD_AUTO: "FUGUANG_START_PRELOAD_AUTO",
  RETRY_PRELOAD: "FUGUANG_RETRY_PRELOAD",
  RETRY_PRELOAD_CHUNKS: "FUGUANG_RETRY_PRELOAD_CHUNKS",
  RETRANSLATE_PRELOAD: "FUGUANG_RETRANSLATE_PRELOAD",
  CANCEL_PRELOAD: "FUGUANG_CANCEL_PRELOAD",
  CLEAR_PRELOAD_AUDIO_CACHE: "FUGUANG_CLEAR_PRELOAD_AUDIO_CACHE",
  CHECK_PRELOAD_JOB: "FUGUANG_CHECK_PRELOAD_JOB",
  GET_PRELOAD_VTT: "FUGUANG_GET_PRELOAD_VTT",
  GET_PRELOAD_TRANSCRIPT: "FUGUANG_GET_PRELOAD_TRANSCRIPT",
  PAGE_MEDIA_FOUND: "FUGUANG_PAGE_MEDIA_FOUND",
  PAGE_CONTEXT_FOUND: "FUGUANG_PAGE_CONTEXT_FOUND",
  ATTACH_VTT: "FUGUANG_ATTACH_VTT",
  ATTACH_VTT_TEXT: "FUGUANG_ATTACH_VTT_TEXT",
  DETACH_PRELOAD_VTT: "FUGUANG_DETACH_PRELOAD_VTT",
  CLEAR_PRELOAD_SUBTITLE_STATE: "FUGUANG_CLEAR_PRELOAD_SUBTITLE_STATE",
  GET_VIDEO_STATE: "FUGUANG_GET_VIDEO_STATE",
  SEEK_MEDIA: "FUGUANG_SEEK_MEDIA",
  OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  OFFSCREEN_WEB_FFMPEG_PROGRESS: "FUGUANG_OFFSCREEN_WEB_FFMPEG_PROGRESS",
  OFFSCREEN_WEB_FFMPEG_CHUNK_READY: "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY",
  UPDATE_MEDIA_HEADER_RULE_DOMAINS: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS"
};

const DEFAULT_WEB_FFMPEG_PATH = "web-ffmpeg/index.html";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const CAPTION_POSITION_STORAGE_KEY = "captionPosition";
const LEGACY_CAPTION_TOP_RATIO_KEY = "captionTopRatio";
const DEFAULT_MODEL_SETTINGS = {
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  asrWorkers: 1,
  translationWorkers: 3,
  chunkMinutes: 15
};
const BROWSER_ASR_UPLOAD_CHUNK_SECONDS = 15 * 60;
const BROWSER_ASR_MAX_UPLOAD_CHUNK_SECONDS = 30 * 60;
const BROWSER_ASR_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MODEL_SETTINGS_VERSION = 5;
const MAX_CANDIDATES_PER_TAB = 80;
const requestHeadersById = new Map();
const browserPreloadJobs = new Map();

const tabState = new Map();

try {
  const accessLevelPromise = chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
  accessLevelPromise?.catch?.(() => {});
} catch {
  // Older Chromium builds may not support storage access-level controls.
}
migrateLegacyCaptionPosition();
enableSidePanelAction();

chrome.action.onClicked.addListener(tab => {
  if (!tab?.id) {
    return;
  }
  openSidePanel(tab.id).catch(error => {
    setTabStatus(tab.id, { error: error.message });
  });
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    if (details.requestId && details.requestHeaders) {
      requestHeadersById.set(details.requestId, compactRequestHeaders(details.requestHeaders));
    }
    if (details.tabId < 0 || !details.url) {
      return;
    }
    if (isIgnoredMediaUrl(details.url)) {
      return;
    }
    const classification = classifyUrl(details.url);
    if (!classification) {
      return;
    }
    addCandidate(details.tabId, {
      url: details.url,
      source: "request-headers",
      kind: classification.kind,
      ext: classification.ext,
      requestId: details.requestId,
      requestHeaders: requestHeadersById.get(details.requestId),
      initiator: details.initiator || details.documentUrl || "",
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId < 0 || !details.url) {
      return;
    }
    if (isIgnoredMediaUrl(details.url)) {
      return;
    }
    const classification = classifyUrl(details.url);
    if (!classification) {
      return;
    }
    addCandidate(details.tabId, {
      url: details.url,
      source: "request",
      kind: classification.kind,
      ext: classification.ext,
      requestId: details.requestId,
      initiator: details.initiator || details.documentUrl || "",
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] }
);

chrome.webRequest.onHeadersReceived.addListener(
  details => {
    if (details.tabId < 0 || !details.url) {
      return;
    }
    if (isIgnoredMediaUrl(details.url)) {
      return;
    }
    const contentType = getHeader(details.responseHeaders, "content-type");
    const classification = classifyUrl(details.url);
    if (!contentType || (!classification && !isMediaContentType(contentType))) {
      return;
    }
    if (!classification && isGenericBinaryContentType(contentType)) {
      return;
    }
    const resolvedClassification = classification || { kind: inferKindFromContentType(contentType), ext: "" };
    const responseHeaders = compactResponseHeaders(details.responseHeaders);
    addCandidate(details.tabId, {
      url: details.url,
      source: "response",
      kind: resolvedClassification.kind,
      ext: resolvedClassification.ext,
      requestId: details.requestId,
      contentType,
      responseHeaders,
      requestHeaders: requestHeadersById.get(details.requestId),
      initiator: details.initiator || details.documentUrl || "",
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] },
  ["responseHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  details => {
    requestHeadersById.delete(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  details => {
    requestHeadersById.delete(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId === 0) {
    return clearTopLevelNavigationState(details.tabId, { detachSubtitles: true });
  }
  return undefined;
});

chrome.webNavigation.onHistoryStateUpdated?.addListener(details => {
  if (details.frameId === 0) {
    return clearTopLevelNavigationState(details.tabId, { detachSubtitles: true });
  }
  return clearFrameNavigationState(details.tabId, details.frameId);
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabState.delete(tabId);
});

async function clearTopLevelNavigationState(tabId, { detachSubtitles = false } = {}) {
  try {
    if (detachSubtitles) {
      await broadcastMessageToFrames(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT });
    }
  } finally {
    tabState.delete(tabId);
  }
}

async function clearFrameNavigationState(tabId, frameId) {
  const state = tabState.get(tabId);
  const numericFrameId = Number(frameId);
  if (!state || !Number.isFinite(numericFrameId)) {
    return;
  }
  const ownsCurrentMedia =
    state.subtitleFrameId === numericFrameId ||
    state.mediaFrameId === numericFrameId ||
    state.context?.frameId === numericFrameId ||
    state.lastPreloadCandidate?.frameId === numericFrameId;
  if (!ownsCurrentMedia) {
    return;
  }
  if (state.attachedVttSignature || state.manualVttSignature) {
    await chrome.tabs.sendMessage(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT }, { frameId: numericFrameId }).catch(() => null);
  }
  state.attachedVttSignature = "";
  state.manualVttSignature = "";
  if (state.subtitleFrameId === numericFrameId) {
    state.subtitleFrameId = null;
  }
  if (state.mediaFrameId === numericFrameId) {
    state.mediaFrameId = null;
  }
  if (state.context?.frameId === numericFrameId) {
    state.context = {};
  }
  if (state.lastPreloadCandidate?.frameId === numericFrameId) {
    state.lastPreloadCandidate = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      if (message?.tabId) {
        setTabStatus(message.tabId, { error: error.message });
      }
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case MESSAGE.GET_STATUS:
      return getStatus(message.tabId);
    case MESSAGE.GET_CANDIDATES:
      await refreshTabInfo(message.tabId);
      return { candidates: getDisplayCandidates(message.tabId) };
    case MESSAGE.ACTIVATE_PAGE:
      await activatePage(message.tabId);
      return {};
    case MESSAGE.START_PRELOAD_AUTO:
      return startBestPreload(message.tabId, message.candidate);
    case MESSAGE.RETRY_PRELOAD:
      return retryPreload(message.tabId);
    case MESSAGE.RETRY_PRELOAD_CHUNKS:
      return retryPreload(message.tabId, message.chunkIndexes || []);
    case MESSAGE.RETRANSLATE_PRELOAD:
      return retranslatePreload(message.tabId, message.chunkIndexes || []);
    case MESSAGE.CANCEL_PRELOAD:
      return cancelPreload(message.tabId, message.jobId);
    case MESSAGE.CLEAR_PRELOAD_AUDIO_CACHE:
      return clearPreloadAudioCache(message.tabId, message.jobId);
    case MESSAGE.CHECK_PRELOAD_JOB:
      return checkPreloadJob(message.jobId, message.tabId);
    case MESSAGE.GET_PRELOAD_VTT:
      return getPreloadVtt(message.jobId);
    case MESSAGE.GET_PRELOAD_TRANSCRIPT:
      return getPreloadTranscript(message.jobId);
    case MESSAGE.GET_VIDEO_STATE:
      return getVideoState(message.tabId);
    case MESSAGE.ATTACH_VTT_TEXT:
      return attachVttText(message.tabId, message.vtt);
    case MESSAGE.DETACH_PRELOAD_VTT:
      await detachPreloadVtt(message.tabId);
      return {};
    case MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE:
      return clearPreloadSubtitleState(message.tabId, message.jobId);
    case MESSAGE.SEEK_MEDIA:
      return seekMedia(message.tabId, message.time);
    case MESSAGE.PAGE_MEDIA_FOUND:
      addPageMediaCandidate(sender.tab?.id, message.media, sender.frameId);
      return {};
    case MESSAGE.PAGE_CONTEXT_FOUND:
      updateTabContext(sender.tab?.id, message.context, sender.frameId);
      return {};
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_PROGRESS:
      return applyOffscreenWebFfmpegProgress(message);
    case MESSAGE.OFFSCREEN_WEB_FFMPEG_CHUNK_READY:
      return applyOffscreenWebFfmpegChunkReady(message);
    case MESSAGE.UPDATE_MEDIA_HEADER_RULE_DOMAINS:
      return updateMediaRequestHeaderRuleDomains(message.jobId, message.urls || []);
    default:
      return {};
  }
}

async function getStatus(tabId) {
  await refreshTabInfo(tabId);
  const state = getState(tabId);
  const webFfmpeg = await getWebFfmpegConfig();
  const currentPageUrl = state.page?.url || state.context?.href || "";
  let preloadJob = refreshBrowserPreloadJobForStatus(state.preloadJob);
  if (preloadJob && !browserPreloadJobMatchesPageUrl(preloadJob, currentPageUrl)) {
    state.preload = "idle";
    state.preloadJob = null;
    state.attachedVttSignature = "";
    preloadJob = null;
  }
  if (!preloadJob) {
    const matchingRecord = findBrowserPreloadRecordForTabPage(tabId, currentPageUrl);
    if (matchingRecord) {
      preloadJob = matchingRecord.job;
      state.preload = matchingRecord.job.status || "running";
      state.preloadJob = matchingRecord.job;
    }
  }
  return {
    webFfmpeg,
    preload: state.preload || "idle",
    preloadJob: withSubtitleSuppression(preloadJob, tabId),
    error: state.error || "",
    page: state.page,
    context: state.context,
    candidates: getDisplayCandidates(tabId)
  };
}

function refreshBrowserPreloadJobForStatus(job) {
  if (!job?.id || !browserPreloadJobs.has(job.id)) {
    return job || null;
  }
  const record = browserPreloadJobs.get(job.id);
  if (!record || record.cancelled) {
    return job;
  }
  if (!["completed", "failed", "cancelled"].includes(record.job.status)) {
    publishBrowserPreloadJob(record);
  }
  return record.job;
}

async function activatePage(tabId) {
  if (!tabId) {
    throw new Error("没有可用的当前标签页。");
  }
  await injectPageScript(tabId, ["src/content/subtitle-overlay.js"], { allFrames: true });
  await injectPageScript(tabId, ["src/content/media-bridge.js"], { allFrames: true });
  await injectPageScript(tabId, ["src/content/page-sniffer.js"], { allFrames: true, world: "MAIN" });
  await refreshTabInfo(tabId);
}

async function injectPageScript(tabId, files, options = {}) {
  const injection = {
    target: { tabId, allFrames: Boolean(options.allFrames) },
    files,
    injectImmediately: true
  };
  if (options.world) {
    injection.world = options.world;
  }
  try {
    await chrome.scripting.executeScript(injection);
  } catch (error) {
    if (!options.allFrames) {
      throw error;
    }
    const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => []);
    let injected = false;
    for (const frame of frames) {
      if (!/^https?:/i.test(frame.url || "")) {
        continue;
      }
      try {
        await chrome.scripting.executeScript({
          ...injection,
          target: { tabId, frameIds: [frame.frameId] }
        });
        injected = true;
      } catch {
        // Some cross-origin or special frames reject dynamic injection. Keep injecting reachable frames.
      }
    }
    if (injected) {
      return;
    }
    await chrome.scripting.executeScript({
      ...injection,
      target: { tabId, allFrames: false }
    });
  }
}

function canUseWebFfmpegExtraction(candidate) {
  if (!candidate?.url || isIgnoredMediaUrl(candidate.url)) {
    return false;
  }
  if (candidate.kind === "dash") {
    return false;
  }
  const ext = String(candidate.ext || classifyUrl(candidate.url)?.ext || "").toLowerCase();
  if (candidate.kind === "hls" || ext === "m3u8") {
    return true;
  }
  if (MANIFEST_EXTENSIONS.has(ext)) {
    return false;
  }
  const contentType = String(candidate.contentType || candidate.mime || "").toLowerCase();
  return (
    candidate.role === "audio" ||
    candidate.role === "video" ||
    candidate.kind === "audio" ||
    candidate.kind === "video" ||
    contentType.startsWith("audio/") ||
    contentType.startsWith("video/") ||
    AUDIO_EXTENSIONS.has(ext) ||
    ["mp4", "webm", "m4v", "mov", "m4s", "ts"].includes(ext)
  );
}

async function startPreload(tabId, candidate) {
  if (!candidate?.url) {
    throw new Error("请先选择一个媒体源。");
  }
  const state = getState(tabId);
  const preloadCandidate = resolvePreloadCandidateForStart(state, candidate);
  if (isIgnoredMediaUrl(preloadCandidate.url)) {
    throw new Error("这个候选是播放器占位媒体，不是真实视频源。请刷新候选列表后选择真实媒体。");
  }
  const now = Date.now();
  if (Number(state.preloadStartLockUntil || 0) > now) {
    return {
      preload: state.preload || "submitting",
      job: state.preloadJob || null,
      duplicated: true,
      message: "正在提交任务，已忽略重复点击。"
    };
  }
  state.preloadStartLockUntil = now + 2500;
  clearPreloadSubtitleSuppression(tabId);
  state.manualVttSignature = "";
  await detachPreloadVtt(tabId);
  await refreshTabInfo(tabId);
  const modelConfig = await getModelConfig();
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const pageUrl = preloadCandidate.pageUrl || state.page?.url || tab?.url || preloadCandidate.initiator || state.context?.href || "";
  const metadata = buildPreloadMetadata(preloadCandidate, state, pageUrl);
  const payload = await startBrowserPreload(tabId, {
    ...preloadCandidate,
    pageUrl,
    chunkSeconds: modelConfig.chunkSeconds
  }, metadata, modelConfig);
  setTabStatus(tabId, {
    preload: payload.status || "queued",
    preloadJob: payload.job || null,
    error: "",
    attachedVttSignature: ""
  });
  setTabStatus(tabId, { lastPreloadCandidate: preloadCandidate });
  return { preload: payload.status || "queued", job: payload.job, result: payload.result };
}

async function startBestPreload(tabId, selectedCandidate = null) {
  await refreshTabInfo(tabId);
  const candidate = selectedCandidate?.url ? selectedCandidate : getDisplayCandidates(tabId)[0];
  if (!candidate) {
    throw new Error("还没有发现可抽取的媒体源。请先播放或刷新页面后重试。");
  }
  return startPreload(tabId, candidate);
}

async function startBrowserPreload(tabId, candidate, metadata, modelConfig) {
  if (!canUseWebFfmpegExtraction(candidate)) {
    throw new Error("当前媒体源暂不支持浏览器内预加载。请选择 HLS 或直连音视频源。");
  }
  validateBrowserPreloadModelConfig(modelConfig);
  const jobId = `browser-${Date.now()}`;
  const job = {
    id: jobId,
    status: "running",
    stage: "extracting",
    source: candidate.url,
    sourceUrl: candidate.url,
    metadata: {
      title: metadata.title || "",
      pageUrl: metadata.pageUrl || "",
      sourceUrl: metadata.sourceUrl || candidate.url || "",
      duration: metadata.duration || null
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    extract: {
      status: "running",
      progress: 0,
      chunkCount: 0,
      availableSeconds: 0,
      duration: metadata.duration || null,
      chunkSeconds: modelConfig.chunkSeconds,
      asrChunkSeconds: browserAsrUploadChunkSeconds(modelConfig),
      bitrate: "64k",
      elapsedSeconds: 0
    },
    translation: {
      status: "queued",
      chunkCount: 0,
      chunksTotal: 0,
      chunksDone: 0,
      chunksFailed: 0,
      chunksAsr: 0,
      chunksTranslating: 0,
      chunkStatuses: [],
      segmentCount: 0,
      sourceSegments: 0,
      translatedSegments: 0,
      asrWorkers: modelConfig.asrWorkers,
      translationWorkers: modelConfig.workers,
      workers: modelConfig.workers
    }
  };
  const record = {
    tabId,
    candidate,
    metadata,
    modelConfig,
    job,
    startedAt: Date.now(),
    cancelled: false,
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    browserAsrChunkSeconds: browserAsrUploadChunkSeconds(modelConfig)
  };
  browserPreloadJobs.set(jobId, record);
  publishBrowserPreloadJob(record);
  runBrowserPreloadJob(jobId).catch(error => {
    const latest = browserPreloadJobs.get(jobId);
    if (!latest || latest.cancelled) {
      return;
    }
    latest.job.status = "failed";
    latest.job.stage = "failed";
    latest.job.error = error.message || String(error);
    latest.job.extract.elapsedSeconds = elapsedSeconds(latest.startedAt);
    publishBrowserPreloadJob(latest);
  });
  return { status: "running", job };
}

function validateBrowserPreloadModelConfig(modelConfig) {
  const asr = modelConfig.asr || {};
  const provider = normalizeProviderType(asr.providerType);
  const needsModel = provider !== "xai";
  if (!asr.baseUrl || !asr.apiKey || (needsModel && !asr.model)) {
    throw new Error(needsModel
      ? "浏览器内预加载需要完整的在线 ASR 配置：接口地址、模型名称和 API 密钥。"
      : "浏览器内预加载需要完整的 xAI ASR 配置：接口地址和 API 密钥。");
  }
}

async function runBrowserPreloadJob(jobId) {
  const record = browserPreloadJobs.get(jobId);
  if (!record) {
    return;
  }
  startBrowserChunkPipeline(record);
  let audio = {};
  let extractionError = null;
  try {
    audio = await extractCandidateAudioInBrowser(record);
    if (isBrowserJobCancelled(record)) {
      return;
    }
    if (record.browserStreamingInternalChunks) {
      flushBrowserInternalAudioChunks(record, true);
    } else {
      const chunks = normalizeBrowserAudioChunks(
        audio,
        Number(audio.asrChunkSeconds || audio.chunkSeconds || record.browserAsrChunkSeconds) || browserAsrUploadChunkSeconds(record.modelConfig),
        record.metadata?.duration
      );
      for (const chunk of chunks) {
        enqueueBrowserLogicalAudioChunk(record, chunk);
      }
    }
    const hasAudioChunks = Boolean((record.audioChunks || []).length);
    if (!hasAudioChunks && !browserPreloadRecordHasOnlyKnownNonspeechAudio(record)) {
      throw createNoBrowserAudioChunksError(audio);
    }
    record.job.extract = {
      ...record.job.extract,
      status: "completed",
      progress: 100,
      phase: "completed",
      message: "",
      chunkCount: record.audioChunks.length,
      availableSeconds: Math.round(Number(audio.duration || 0) || record.audioChunks.reduce((sum, chunk) => sum + (chunk.duration || 0), 0)),
      elapsedSeconds: elapsedSeconds(record.startedAt)
    };
    record.job.translation = {
      ...record.job.translation,
      status: hasAudioChunks ? (record.job.translation?.status || "running") : "completed",
      chunksTotal: hasAudioChunks
        ? Math.max(Number(record.job.translation?.chunksTotal || 0) || 0, record.browserTranslationGroups?.size || 0)
        : 0,
      chunkStatuses: record.job.translation?.chunkStatuses || []
    };
    record.job.stage = hasAudioChunks ? "asr" : "completed";
    publishBrowserPreloadJob(record);
  } catch (error) {
    extractionError = error;
  } finally {
    closeBrowserAsrQueue(record);
  }

  await waitBrowserChunkPipeline(record).catch(error => {
    extractionError = extractionError || error;
  });
  if (extractionError) {
    throw extractionError;
  }
  if (isBrowserJobCancelled(record)) {
    return;
  }
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  await attachBrowserJobVttIfReady(record);
  if (browserCompletionAllowsAudioRelease(completion)) {
    await releaseBrowserAudioChunks(record);
  }
}

async function extractCandidateAudioInBrowser(record) {
  await ensureOffscreenDocument();
  const webFfmpeg = await getWebFfmpegConfig();
  const candidate = record.candidate;
  const pageUrl = candidate.pageUrl || record.metadata?.pageUrl || record.metadata?.url || candidate.initiator || "";
  const response = await withMediaRequestHeaderRules(candidate.url, pageUrl, async () => chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO,
    tabId: record.tabId,
    webFfmpegUrl: webFfmpeg.url,
    sourceUrl: candidate.url,
    kind: candidate.kind || "",
    ext: candidate.ext || "",
    requestHeaders: candidate.requestHeaders || null,
    fileName: candidate.fileName || candidate.filename || filenameFromUrl(candidate.url),
    mime: candidate.contentType || candidate.mime || "",
    pageUrl,
    initiator: candidate.initiator || "",
    duration: pickFinite(candidate.duration, record.metadata?.duration),
    chunkSeconds: record.modelConfig.chunkSeconds,
    asrChunkSeconds: record.browserAsrChunkSeconds || browserAsrUploadChunkSeconds(record.modelConfig),
    cacheNamespace: record.job.id,
    jobId: record.job.id
  }), record.job.id);
  if (!response?.ok) {
    throw new Error(response?.error || "Web FFmpeg 音频提取失败。");
  }
  return response.result || {};
}

function applyOffscreenWebFfmpegProgress(message) {
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!record || record.cancelled) {
    return {};
  }
  applyBrowserExtractionProgress(record, message.progress || {});
  return {};
}

function applyOffscreenWebFfmpegChunkReady(message) {
  const record = findBrowserPreloadRecord(message?.jobId, message?.tabId);
  if (!record || record.cancelled) {
    return {};
  }
  const emitted = appendBrowserInternalAudioChunk(record, message.chunk || {});
  if (message.duration) {
    record.job.extract.duration = pickFinite(message.duration, record.job.extract.duration);
  }
  if (message.internalChunksDone || message.internalChunksTotal) {
    record.job.extract.internalChunksDone = pickNonNegativeInteger(message.internalChunksDone, record.job.extract.internalChunksDone);
    record.job.extract.internalChunksTotal = pickNonNegativeInteger(message.internalChunksTotal, record.job.extract.internalChunksTotal);
  }
  publishBrowserPreloadJob(record);
  return { chunks: emitted.length };
}

function findBrowserPreloadRecord(jobId, tabId) {
  if (jobId && browserPreloadJobs.has(jobId)) {
    return browserPreloadJobs.get(jobId);
  }
  for (const record of browserPreloadJobs.values()) {
    if (record.tabId === tabId && !["completed", "failed", "cancelled"].includes(record.job.status)) {
      return record;
    }
  }
  return null;
}

function applyBrowserExtractionProgress(record, progress = {}) {
  if (!record?.job?.extract) {
    return null;
  }
  const current = record.job.extract || {};
  const currentProgress = Number(current.progress || 0) || 0;
  const nextProgress = clampProgressPercent(progress.percent);
  const readySeconds = Math.max(
    Number(current.readySeconds || 0) || 0,
    Number(progress.readySeconds || 0) || 0
  );
  record.job.extract = {
    ...current,
    status: "running",
    progress: Math.max(currentProgress, nextProgress),
    phase: progress.phase || current.phase || "",
    message: progress.message || current.message || "",
    readySeconds,
    internalChunksDone: pickNonNegativeInteger(progress.internalChunksDone, current.internalChunksDone),
    internalChunksTotal: pickNonNegativeInteger(progress.internalChunksTotal, current.internalChunksTotal),
    downloadedSegments: pickNonNegativeInteger(progress.downloadedSegments, current.downloadedSegments),
    totalSegments: pickNonNegativeInteger(progress.totalSegments, current.totalSegments),
    elapsedSeconds: elapsedSeconds(record.startedAt),
    updatedAt: Date.now()
  };
  if (!browserJobStageIsPastExtraction(record.job.stage)) {
    record.job.stage = "extracting";
  }
  publishBrowserPreloadJob(record);
  return record.job.extract;
}

function browserJobStageIsPastExtraction(stage) {
  return [
    "asr",
    "asr_done",
    "translation",
    "retrying",
    "retry_translation",
    "completed",
    "completed_with_warnings",
    "failed",
    "cancelled"
  ].includes(String(stage || ""));
}

function appendBrowserInternalAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  const normalized = normalizeBrowserInternalAudioChunk(chunk);
  if (!normalized || !isUsableBrowserAudioFile(normalized.file)) {
    return [];
  }
  if (chunk?.logical) {
    record.browserStreamingInternalChunks = true;
    return enqueueBrowserLogicalAudioChunk(record, normalized) ? [normalized] : [];
  }
  const signature = browserInternalAudioChunkSignature(normalized);
  if (record.browserInternalChunkSignatures.has(signature)) {
    return [];
  }
  record.browserInternalChunkSignatures.add(signature);
  record.browserStreamingInternalChunks = true;
  record.browserInternalAudioChunks.push(normalized);
  record.browserInternalAudioChunks.sort((a, b) => a.start - b.start || a.index - b.index);
  record.job.extract.availableSeconds = Math.max(
    Number(record.job.extract.availableSeconds || 0) || 0,
    Math.round(Number(normalized.end || 0) || 0)
  );
  return flushBrowserInternalAudioChunks(record, false);
}

function flushBrowserInternalAudioChunks(record, final = false) {
  ensureBrowserChunkPipelineState(record);
  const emitted = [];
  const logicalChunkSeconds = normalizeBrowserAsrUploadChunkSeconds(
    record.browserAsrChunkSeconds || record.modelConfig?.asrUploadChunkSeconds
  );
  while (record.browserInternalChunkCursor < record.browserInternalAudioChunks.length) {
    const chunk = record.browserInternalAudioChunks[record.browserInternalChunkCursor];
    const pending = record.browserPendingLogicalChunk;
    if (browserInternalChunkIsKnownNonspeech(chunk)) {
      record.browserInternalChunkCursor += 1;
      record.browserSkippedNonspeechInternalChunks = (Number(record.browserSkippedNonspeechInternalChunks || 0) || 0) + 1;
      if (pending?.parts?.length) {
        emitted.push(buildAndEnqueueBrowserLogicalChunk(record, pending.parts));
        record.browserPendingLogicalChunk = null;
      }
      continue;
    }
    if (pending?.parts?.length && browserShouldSplitLogicalChunkAtVadGap(pending.parts, chunk)) {
      emitted.push(buildAndEnqueueBrowserLogicalChunk(record, pending.parts));
      record.browserPendingLogicalChunk = null;
      continue;
    }
    const pendingDuration = pending ? Math.max(0, Number(pending.end || pending.start || 0) - Number(pending.start || 0)) : 0;
    const chunkDuration = Math.max(0, Number(chunk.duration || (chunk.end - chunk.start) || 0) || 0);
    if (pending?.parts?.length && pendingDuration + chunkDuration > logicalChunkSeconds) {
      emitted.push(buildAndEnqueueBrowserLogicalChunk(record, pending.parts));
      record.browserPendingLogicalChunk = null;
      continue;
    }
    record.browserInternalChunkCursor += 1;
    const current = record.browserPendingLogicalChunk || {
      start: chunk.start,
      end: chunk.start,
      parts: []
    };
    current.parts.push(chunk);
    current.end = chunk.end;
    record.browserPendingLogicalChunk = current;
    const currentDuration = Math.max(0, Number(current.end || 0) - Number(current.start || 0));
    if (currentDuration >= logicalChunkSeconds) {
      emitted.push(buildAndEnqueueBrowserLogicalChunk(record, current.parts));
      record.browserPendingLogicalChunk = null;
    }
  }
  if (final && record.browserPendingLogicalChunk?.parts?.length) {
    emitted.push(buildAndEnqueueBrowserLogicalChunk(record, record.browserPendingLogicalChunk.parts));
    record.browserPendingLogicalChunk = null;
  }
  return emitted.filter(Boolean);
}

function browserInternalChunkIsKnownNonspeech(chunk) {
  const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals);
  return Array.isArray(speechIntervals) && speechIntervals.length === 0;
}

function browserShouldSplitLogicalChunkAtVadGap(parts, nextChunk) {
  const currentSpeech = mergeAsrSpeechIntervals((parts || []).flatMap(part => normalizeAsrSpeechIntervals(part?.speechIntervals) || []));
  const nextSpeech = normalizeAsrSpeechIntervals(nextChunk?.speechIntervals);
  if (!currentSpeech.length || !Array.isArray(nextSpeech) || !nextSpeech.length) {
    return false;
  }
  const lastCurrentSpeech = currentSpeech[currentSpeech.length - 1];
  const firstNextSpeech = nextSpeech[0];
  return firstNextSpeech.start - lastCurrentSpeech.end >= ASR_VAD_SPLIT_MIN_SILENCE_SECONDS;
}

function browserPreloadRecordHasOnlyKnownNonspeechAudio(record) {
  return Boolean(
    record?.browserStreamingInternalChunks
    && !(record.audioChunks || []).length
    && (Number(record.browserSkippedNonspeechInternalChunks || 0) || 0) > 0
  );
}

function buildAndEnqueueBrowserLogicalChunk(record, parts) {
  const chunk = buildBrowserLogicalAudioChunk(record, parts);
  return enqueueBrowserLogicalAudioChunk(record, chunk) ? chunk : null;
}

function buildBrowserLogicalAudioChunk(record, parts) {
  const normalizedParts = (parts || []).filter(part => isUsableBrowserAudioFile(part?.file));
  const index = Number.isInteger(record.browserNextLogicalChunkIndex)
    ? record.browserNextLogicalChunkIndex
    : (record.audioChunks || []).length;
  record.browserNextLogicalChunkIndex = index + 1;
  const bytes = normalizedParts.reduce((sum, part) => sum + (Number(part.bytes || part.file?.bytes || 0) || 0), 0);
  const start = Number(normalizedParts[0]?.start || 0) || 0;
  const end = Number(normalizedParts[normalizedParts.length - 1]?.end || start) || start;
  const coreStart = browserAudioChunkCoreStart(normalizedParts[0] || { start });
  const coreEnd = browserAudioChunkCoreEnd(normalizedParts[normalizedParts.length - 1] || { end });
  const fileParts = normalizedParts.map(part => ({
    index: part.index,
    start: part.start,
    end: part.end,
    duration: part.duration,
    coreStart: part.coreStart,
    coreEnd: part.coreEnd,
    coreDuration: part.coreDuration,
    speechIntervals: Array.isArray(part.speechIntervals) ? normalizeAsrSpeechIntervals(part.speechIntervals) || [] : undefined,
    bytes: part.bytes || part.file?.bytes || 0,
    file: part.file
  }));
  const file = fileParts.length === 1
    ? fileParts[0].file
    : {
        name: `logical-${String(index + 1).padStart(3, "0")}.mp3`,
        mime: "audio/mpeg",
        bytes,
        parts: fileParts
      };
  return {
    index,
    start,
    end,
    duration: Math.max(0, end - start),
    coreStart,
    coreEnd,
    coreDuration: Math.max(0, coreEnd - coreStart),
    speechIntervals: mergeAsrSpeechIntervals(normalizedParts.flatMap(part => normalizeAsrSpeechIntervals(part.speechIntervals) || [])),
    file,
    bytes,
    internalChunkCount: fileParts.length
  };
}

function enqueueBrowserLogicalAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  if (!chunk || !isUsableBrowserAudioFile(chunk.file)) {
    return false;
  }
  if (record.browserAsrQueue?.closed) {
    return false;
  }
  const nextIndex = Number.isInteger(chunk.index) ? chunk.index : record.audioChunks.length;
  const normalized = { ...chunk, index: nextIndex };
  if (record.audioChunks.some(item => item?.index === normalized.index)) {
    return false;
  }
  record.audioChunks.push(normalized);
  record.audioChunks.sort((a, b) => a.index - b.index);
  const group = ensureBrowserTranslationGroupForAudioChunk(record, normalized);
  record.job.stage = "asr";
  record.job.translation = {
    ...record.job.translation,
    status: "running",
    chunkCount: record.browserTranslationGroups.size,
    chunksTotal: Math.max(Number(record.job.translation.chunksTotal || 0) || 0, record.browserTranslationGroups.size),
    asrWorkers: record.modelConfig.asrWorkers,
    translationWorkers: record.modelConfig.workers,
    workers: record.modelConfig.workers,
    chunkStatuses: record.job.translation.chunkStatuses || []
  };
  if (!record.job.translation.chunkStatuses[group.index]) {
    record.job.translation.chunkStatuses[group.index] = createChunkStatus(group.index, "queued");
  }
  enqueueAsyncQueue(record.browserAsrQueue, normalized);
  publishBrowserPreloadJob(record);
  return true;
}

function ensureBrowserTranslationGroupForAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  const groupIndex = browserTranslationGroupIndex(record, chunk);
  closeBrowserTranslationGroupsBefore(record, groupIndex);
  let group = record.browserTranslationGroups.get(groupIndex);
  if (!group) {
    const segmentSeconds = browserTranslationSegmentSeconds(record);
    const targetEnd = browserTranslationGroupTargetEnd(record, groupIndex);
    group = {
      index: groupIndex,
      start: groupIndex * segmentSeconds,
      end: targetEnd,
      targetEnd,
      chunks: [],
      chunkIndexes: new Set(),
      total: 0,
      completed: 0,
      failed: 0,
      empty: 0,
      sourceSegments: [],
      errors: [],
      closed: false,
      translationQueued: false
    };
    record.browserTranslationGroups.set(groupIndex, group);
  }
  if (!group.chunkIndexes.has(chunk.index)) {
    group.chunkIndexes.add(chunk.index);
    group.chunks.push(chunk);
    group.chunks.sort((left, right) => browserAudioChunkCoreStart(left) - browserAudioChunkCoreStart(right) || left.index - right.index);
    group.total += 1;
    group.start = Math.min(group.start, browserAudioChunkCoreStart(chunk));
    group.end = Math.max(group.end, browserAudioChunkCoreEnd(chunk));
    record.browserAsrChunkToTranslationGroup.set(chunk.index, groupIndex);
    closeBrowserTranslationGroupIfChunkCompletesWindow(record, group, chunk);
  }
  return group;
}

function browserTranslationGroupTargetEnd(record, groupIndex) {
  const segmentSeconds = browserTranslationSegmentSeconds(record);
  const boundaryEnd = (groupIndex + 1) * segmentSeconds;
  const duration = pickFinite(
    record?.metadata?.duration,
    record?.candidate?.duration,
    record?.job?.extract?.duration
  );
  return duration ? Math.min(boundaryEnd, duration) : boundaryEnd;
}

function closeBrowserTranslationGroupIfChunkCompletesWindow(record, group, chunk) {
  if (!group || group.closed) {
    return false;
  }
  const targetEnd = pickFinite(group.targetEnd, group.end);
  if (!targetEnd) {
    return false;
  }
  if (browserAudioChunkCoreEnd(chunk) + 0.001 < targetEnd) {
    return false;
  }
  group.closed = true;
  maybeFinalizeBrowserTranslationGroup(record, group);
  return true;
}

function browserTranslationGroupIndex(record, chunk) {
  const segmentSeconds = browserTranslationSegmentSeconds(record);
  const start = Math.max(0, browserAudioChunkCoreStart(chunk));
  return Math.max(0, Math.floor((start + 0.001) / segmentSeconds));
}

function getBrowserTranslationGroupForAudioChunk(record, chunk) {
  ensureBrowserChunkPipelineState(record);
  const known = record.browserAsrChunkToTranslationGroup.get(chunk.index);
  if (Number.isFinite(Number(known))) {
    return record.browserTranslationGroups.get(Number(known));
  }
  return ensureBrowserTranslationGroupForAudioChunk(record, chunk);
}

function closeBrowserTranslationGroupsBefore(record, groupIndex) {
  ensureBrowserChunkPipelineState(record);
  for (const group of record.browserTranslationGroups.values()) {
    if (group.index < groupIndex && !group.closed) {
      group.closed = true;
      maybeFinalizeBrowserTranslationGroup(record, group);
    }
  }
}

function closeAllBrowserTranslationGroups(record) {
  ensureBrowserChunkPipelineState(record);
  for (const group of record.browserTranslationGroups.values()) {
    group.closed = true;
    maybeFinalizeBrowserTranslationGroup(record, group);
  }
}

function completeBrowserAsrChunkForGroup(record, chunk, sourceSegments, error = null) {
  const group = getBrowserTranslationGroupForAudioChunk(record, chunk);
  if (!group) {
    return;
  }
  group.completed += 1;
  if (error) {
    group.failed += 1;
    group.errors.push(error.message || String(error));
  } else if (Array.isArray(sourceSegments) && sourceSegments.length) {
    group.sourceSegments.push(...sourceSegments);
  } else {
    group.empty += 1;
  }
  updateChunkStatus(record, group.index, {
    stage: "asr",
    status: "识别",
    attempts: Math.max(1, record.job.translation.chunkStatuses[group.index]?.attempts || 1),
    sourceCount: group.sourceSegments.length,
    asrFailures: group.failed,
    asrErrors: group.errors.slice(0, 5),
    error: "",
    message: `识别音频分段 ${group.completed}/${group.total}${group.failed ? ` · ${group.failed} 失败` : ""}`
  });
  maybeFinalizeBrowserTranslationGroup(record, group);
}

function maybeFinalizeBrowserTranslationGroup(record, group) {
  if (!group || group.translationQueued || !group.closed || group.completed < group.total) {
    return false;
  }
  const sourceSegments = normalizeBrowserSourceSegmentsForTranslation(group.sourceSegments, group.index);
  record.sourceSegmentsByChunk.set(group.index, sourceSegments);
  if (group.failed && !sourceSegments.length) {
    group.translationQueued = true;
    updateChunkStatus(record, group.index, {
      stage: "failed",
      status: "失败",
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: group.failed,
      asrErrors: group.errors.slice(0, 5),
      error: group.errors[0] || "这个识别分段没有可用原文。"
    });
    publishBrowserSubtitle(record);
    return true;
  }
  if (!sourceSegments.length) {
    group.translationQueued = true;
    record.translatedSegmentsByChunk.set(group.index, []);
    updateChunkStatus(record, group.index, {
      stage: "completed",
      status: "完成",
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: 0,
      asrErrors: [],
      message: "无语音"
    });
    publishBrowserSubtitle(record);
    return true;
  }
  group.translationQueued = true;
  updateChunkStatus(record, group.index, {
    stage: "asr_done",
    status: "待翻译",
    sourceCount: sourceSegments.length,
    asrFailures: group.failed,
    asrErrors: group.errors.slice(0, 5),
    error: group.failed ? `有 ${group.failed} 个识别音频分段失败，先翻译可用原文。` : "",
    message: `原文 ${sourceSegments.length}${group.empty ? ` · 跳过 ${group.empty} 个无语音分段` : ""}`
  });
  publishBrowserSubtitle(record);
  enqueueAsyncQueue(record.browserTranslationQueue, {
    chunk: {
      index: group.index,
      start: group.start,
      end: group.end,
      duration: Math.max(0, group.end - group.start)
    },
    sourceSegments
  });
  return true;
}

function normalizeBrowserInternalAudioChunk(chunk) {
  const start = Number(chunk?.start || 0) || 0;
  const end = Number(chunk?.end || (start + Number(chunk?.duration || 0))) || start;
  const duration = Number(chunk?.duration || (end - start) || 0) || 0;
  const coreStart = pickFinite(chunk?.coreStart, start);
  const coreEnd = pickFinite(chunk?.coreEnd, end);
  return {
    index: Number.isInteger(Number(chunk?.index)) ? Number(chunk.index) : 0,
    start,
    end,
    duration,
    coreStart,
    coreEnd,
    coreDuration: Math.max(0, pickFinite(chunk?.coreDuration, coreEnd - coreStart)),
    speechIntervals: Array.isArray(chunk?.speechIntervals) ? normalizeAsrSpeechIntervals(chunk.speechIntervals) || [] : undefined,
    file: chunk?.file,
    bytes: Number(chunk?.bytes || chunk?.file?.bytes || 0) || 0
  };
}

function browserAudioChunkCoreStart(chunk) {
  return Math.max(0, pickFinite(chunk?.coreStart, chunk?.start, 0));
}

function browserAudioChunkCoreEnd(chunk) {
  const start = browserAudioChunkCoreStart(chunk);
  return Math.max(start, pickFinite(chunk?.coreEnd, chunk?.end, start + Number(chunk?.duration || 0), start));
}

function browserInternalAudioChunkSignature(chunk) {
  return [
    chunk.index,
    roundTime(chunk.start),
    roundTime(chunk.end),
    roundTime(chunk.coreStart),
    roundTime(chunk.coreEnd),
    chunk.file?.cacheUrl || chunk.file?.name || ""
  ].join(":");
}

function ensureBrowserChunkPipelineState(record) {
  if (!record.audioChunks) {
    record.audioChunks = [];
  }
  if (!record.browserInternalAudioChunks) {
    record.browserInternalAudioChunks = [];
  }
  if (!record.browserInternalChunkSignatures) {
    record.browserInternalChunkSignatures = new Set();
  }
  if (!Number.isInteger(record.browserInternalChunkCursor)) {
    record.browserInternalChunkCursor = 0;
  }
  if (!record.browserAsrQueue) {
    record.browserAsrQueue = createAsyncQueue();
  }
  if (!record.browserTranslationQueue) {
    record.browserTranslationQueue = createAsyncQueue();
  }
  if (!record.browserTranslationGroups) {
    record.browserTranslationGroups = new Map();
  }
  if (!record.browserAsrChunkToTranslationGroup) {
    record.browserAsrChunkToTranslationGroup = new Map();
  }
}

function startBrowserChunkPipeline(record) {
  ensureBrowserChunkPipelineState(record);
  if (record.browserPipelinePromise) {
    return record.browserPipelinePromise;
  }
  const asrWorkers = Math.max(1, Number(record.modelConfig.asrWorkers || 1) || 1);
  const translationWorkers = Math.max(1, Number(record.modelConfig.workers || 1) || 1);
  const asrPromise = runQueueWorkers(record.browserAsrQueue, asrWorkers, async chunk => {
    await processBrowserAsrChunk(record, chunk);
  }).finally(() => {
    closeAsyncQueue(record.browserTranslationQueue);
  });
  const translationPromise = runQueueWorkers(record.browserTranslationQueue, translationWorkers, async payload => {
    await processBrowserTranslationChunk(record, payload.chunk, payload.sourceSegments);
  });
  record.browserPipelinePromise = Promise.all([asrPromise, translationPromise]);
  return record.browserPipelinePromise;
}

async function waitBrowserChunkPipeline(record) {
  if (!record.browserPipelinePromise) {
    return;
  }
  await record.browserPipelinePromise;
}

function closeBrowserAsrQueue(record) {
  ensureBrowserChunkPipelineState(record);
  closeAllBrowserTranslationGroups(record);
  closeAsyncQueue(record.browserAsrQueue);
}

async function processBrowserAsrChunk(record, chunk) {
  if (isBrowserJobCancelled(record)) {
    return;
  }
  const group = getBrowserTranslationGroupForAudioChunk(record, chunk);
  const current = record.job.translation.chunkStatuses[group.index] || {};
  updateChunkStatus(record, group.index, {
    stage: "asr",
    status: "识别",
    attempts: Math.max(1, current.attempts || 1),
    error: "",
    message: `识别音频分段 ${group.completed + 1}/${group.total}`
  });
  if (shouldSkipBrowserAsrChunk(chunk)) {
    updateChunkStatus(record, group.index, {
      stage: "asr",
      status: "跳过",
      attempts: Math.max(1, current.attempts || 1),
      error: "",
      message: `跳过无语音分段 ${group.completed + 1}/${group.total}`
    });
    completeBrowserAsrChunkForGroup(record, chunk, []);
    return;
  }
  let sourceSegments;
  try {
    sourceSegments = await transcribeBrowserAudioChunk(chunk, record.modelConfig.asr);
  } catch (error) {
    completeBrowserAsrChunkForGroup(record, chunk, [], error);
    return;
  }
  completeBrowserAsrChunkForGroup(record, chunk, sourceSegments);
}

async function processBrowserTranslationChunk(record, chunk, sourceSegments) {
  if (isBrowserJobCancelled(record)) {
    return;
  }
  const current = record.job.translation.chunkStatuses[chunk.index] || {};
  const asrFailures = chunkStatusAsrFailureCount(current);
  const asrErrors = Array.isArray(current.asrErrors) ? current.asrErrors : [];
  const attempt = current.attempts || 1;
  updateChunkStatus(record, chunk.index, {
    stage: "translation",
    status: "翻译",
    attempts: attempt,
    sourceCount: sourceSegments.length,
    error: "",
    message: `第 ${attempt} 次尝试`
  });
  let translatedSegments;
  try {
    translatedSegments = await translateBrowserSegments(
      sourceSegments,
      record.modelConfig.translation,
      record.modelConfig.targetLanguage,
      record.metadata,
      {
        batchWorkers: browserTranslationBatchWorkers(record),
        splitWorkers: browserTranslationSplitWorkers(record),
        onProgress(progress) {
          updateChunkStatus(record, chunk.index, {
            stage: "translation",
            status: "翻译",
            attempts: attempt,
            sourceCount: sourceSegments.length,
            message: `第 ${attempt} 次尝试 · 第 ${progress.batchIndex}/${progress.batchTotal} 批`
          });
        }
      }
    );
    const translationFailures = browserTranslationFailures(translatedSegments);
    const warningMessage = browserCompletedChunkWarningMessage(translationFailures, asrFailures);
    updateChunkStatus(record, chunk.index, {
      stage: warningMessage ? "completed_with_warnings" : "completed",
      status: warningMessage ? "部分完成" : "完成",
      translatedCount: translatedSegments.length,
      translationFailures: translationFailures.length,
      asrFailures,
      asrErrors,
      error: warningMessage,
      message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
    });
  } catch (error) {
    translatedSegments = [];
    updateChunkStatus(record, chunk.index, {
      stage: "failed",
      status: "失败",
      translatedCount: 0,
      error: `翻译失败，已保留原文供重试：${error.message || String(error)}`
    });
  }
  record.translatedSegmentsByChunk.set(chunk.index, translatedSegments);
  publishBrowserSubtitle(record);
}

function createAsyncQueue() {
  return {
    items: [],
    waiters: [],
    closed: false
  };
}

function enqueueAsyncQueue(queue, item) {
  if (!queue || queue.closed) {
    return false;
  }
  if (queue.waiters.length) {
    queue.waiters.shift()(item);
  } else {
    queue.items.push(item);
  }
  return true;
}

function closeAsyncQueue(queue) {
  if (!queue || queue.closed) {
    return;
  }
  queue.closed = true;
  while (queue.waiters.length) {
    queue.waiters.shift()(null);
  }
}

async function runQueueWorkers(queue, concurrency, worker) {
  const count = Math.max(1, Number(concurrency) || 1);
  await Promise.all(Array.from({ length: count }, async () => {
    while (true) {
      const item = await takeAsyncQueue(queue);
      if (!item) {
        return;
      }
      await worker(item);
    }
  }));
}

function takeAsyncQueue(queue) {
  if (!queue) {
    return Promise.resolve(null);
  }
  if (queue.items.length) {
    return Promise.resolve(queue.items.shift());
  }
  if (queue.closed) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    queue.waiters.push(resolve);
  });
}

function normalizeBrowserAudioChunks(audio, chunkSeconds, fallbackDuration = 0) {
  const duration = pickFinite(audio?.duration, fallbackDuration, chunkSeconds);
  let chunks = [];
  if (Array.isArray(audio?.chunks) && audio.chunks.length) {
    chunks = audio.chunks;
  } else if (isUsableBrowserAudioFile(audio?.file)) {
    chunks = [{ index: 0, start: 0, end: duration, duration, file: audio.file, bytes: audio.bytes || browserAudioFileByteLength(audio.file) || 0 }];
  }
  return chunks.map((chunk, index) => ({
    index: Number.isInteger(chunk.index) ? chunk.index : index,
    start: Number(chunk.start || index * chunkSeconds) || 0,
    end: Number(chunk.end || (index + 1) * chunkSeconds) || (index + 1) * chunkSeconds,
    duration: Number(chunk.duration || chunkSeconds) || chunkSeconds,
    coreStart: pickFinite(chunk.coreStart, chunk.start, index * chunkSeconds),
    coreEnd: pickFinite(chunk.coreEnd, chunk.end, (index + 1) * chunkSeconds),
    coreDuration: pickFinite(chunk.coreDuration, pickFinite(chunk.coreEnd, chunk.end, (index + 1) * chunkSeconds) - pickFinite(chunk.coreStart, chunk.start, index * chunkSeconds)),
    speechIntervals: Array.isArray(chunk.speechIntervals) ? normalizeAsrSpeechIntervals(chunk.speechIntervals) || [] : undefined,
    file: chunk.file,
    bytes: chunk.bytes || browserAudioFileByteLength(chunk.file) || 0
  })).filter(chunk => isUsableBrowserAudioFile(chunk.file));
}

function createNoBrowserAudioChunksError(audio) {
  const hasFile = isUsableBrowserAudioFile(audio?.file);
  const chunkCount = Array.isArray(audio?.chunks) ? audio.chunks.length : 0;
  const bytes = pickFinite(
    audio?.bytes,
    browserAudioFileByteLength(audio?.file),
    Array.isArray(audio?.chunks)
      ? audio.chunks.reduce((sum, chunk) => sum + (Number(chunk?.bytes || browserAudioFileByteLength(chunk?.file) || 0) || 0), 0)
      : 0
  );
  const parts = [
    `source=${audio?.sourceType || "unknown"}`,
    `duration=${pickFinite(audio?.duration, 0)}`,
    `chunks=${chunkCount}`,
    `file=${hasFile ? "yes" : "no"}`,
    `bytes=${bytes}`
  ];
  return new Error(`Web FFmpeg 没有返回可处理的音频切片：${parts.join("，")}。`);
}

function isUsableBrowserAudioFile(file) {
  if (file?.buffer instanceof ArrayBuffer || Boolean(file?.cacheUrl)) {
    return true;
  }
  if (Array.isArray(file?.parts) && file.parts.length) {
    return file.parts.every(part => isUsableBrowserAudioFile(part?.file || part));
  }
  return false;
}

function browserAudioFileByteLength(file) {
  if (file?.buffer instanceof ArrayBuffer) {
    return file.buffer.byteLength;
  }
  if (Array.isArray(file?.parts)) {
    return file.parts.reduce((sum, part) => sum + browserAudioFileByteLength(part?.file || part), 0);
  }
  return Number(file?.bytes || 0) || 0;
}

function assertBrowserAsrChunkCanUpload(chunk = {}, asrConfig = {}, byteLength = null) {
  if (Array.isArray(chunk.file?.parts) && chunk.file.parts.length) {
    throw new Error("识别音频分段仍由多个 MP3 片段组成，不能直接字节拼接上传；请重新抽取音频。");
  }
  const bytes = Math.max(
    0,
    Number(byteLength) || browserAudioFileByteLength(chunk.file) || Number(chunk.bytes || 0) || 0
  );
  const maxBytes = browserAsrMaxUploadBytes(asrConfig);
  if (bytes > maxBytes) {
    throw new Error(`识别音频分段过大（${formatBytes(bytes)}），超过当前 ASR 上传限制（${formatBytes(maxBytes)}）。请降低 ASR 上传窗口或改用支持长文件的 ASR。`);
  }
}

async function transcribeBrowserAudioChunk(chunk, asrConfig) {
  const endpoint = browserAsrEndpoint(asrConfig);
  const timeoutMs = normalizeAsrTimeoutMs(asrConfig?.timeoutMs, chunk);
  const supportedRequestFields = await resolveBrowserAsrSupportedRequestFields(asrConfig);
  const formData = new FormData();
  const fileName = chunk.file?.name || `chunk-${chunk.index + 1}.mp3`;
  assertBrowserAsrChunkCanUpload(chunk, asrConfig);
  const fileBuffer = await getBrowserAudioChunkBuffer(chunk.file);
  assertBrowserAsrChunkCanUpload(chunk, asrConfig, fileBuffer.byteLength);
  for (const [name, value] of browserAsrRequestFields(asrConfig, asrConfig.language || asrConfig.sourceLanguage || "", { supportedRequestFields })) {
    formData.append(name, value);
  }
  formData.append("file", new Blob([fileBuffer], { type: chunk.file.mime || "audio/mpeg" }), fileName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${asrConfig.apiKey}`
      },
      body: formData,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`ASR 请求超时（${Math.round(timeoutMs / 1000)} 秒）：${endpoint}`);
    }
    throw new Error(`ASR 请求失败：${formatAsrFetchError(error, endpoint)}`);
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `ASR 返回 HTTP ${response.status}`);
  }
  const normalized = normalizeAsrSegments(payload, chunk.start, chunk.end, {
    providerType: asrConfig?.providerType
  });
  const speechFiltered = filterAsrSegmentsBySpeechActivity(normalized, chunk);
  const hallucinationFiltered = filterAsrSegmentsByHallucinationGuard(speechFiltered, chunk);
  return filterAsrSegmentsByChunkOwnership(hallucinationFiltered, chunk);
}

function formatAsrFetchError(error, endpoint) {
  const message = error?.message || String(error || "网络不可达");
  return `${endpoint} 无法连接（${message}）。请确认浏览器能访问该 API 地址，并且目标服务允许扩展发起跨域请求。`;
}

async function getBrowserAudioChunkBuffer(file) {
  if (file?.buffer instanceof ArrayBuffer) {
    return file.buffer;
  }
  if (Array.isArray(file?.parts) && file.parts.length) {
    throw new Error("识别音频分段仍由多个 MP3 片段组成，不能直接字节拼接上传；请重新抽取音频。");
  }
  if (file?.cacheUrl) {
    const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
    const response = await cache.match(file.cacheUrl);
    if (!response) {
      throw new Error("浏览器内音频缓存已失效，请重新抽取音频。");
    }
    return response.arrayBuffer();
  }
  throw new Error("识别音频分段缺少可上传的数据。");
}

function normalizeBrowserSourceSegmentsForTranslation(segments, chunkIndex) {
  const usableSegments = (segments || [])
    .filter(isUsableTimedTextSegment)
    .map(segment => {
      const { rawSegment, words, ...publicSegment } = segment;
      return {
        ...publicSegment,
        start: Number(segment.start),
        end: Number(segment.end),
        text: cleanVttText(segment.text || "")
      };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
  return tagSegmentsWithChunkOrder(mergeAdjacentDuplicateAsrSegments(usableSegments), chunkIndex);
}

function isUsableTimedTextSegment(segment) {
  const start = Number(segment?.start);
  const end = Number(segment?.end);
  const text = cleanVttText(segment?.text || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start && Boolean(text);
}

function tagSegmentsWithChunkOrder(segments, chunkIndex) {
  const normalizedChunkIndex = Number(chunkIndex);
  return (segments || []).map((segment, segmentIndex) => ({
    ...segment,
    chunkIndex: Number.isFinite(normalizedChunkIndex) ? normalizedChunkIndex : chunkIndex,
    segmentIndex
  }));
}

function createChunkStatus(index, stage) {
  const now = Date.now();
  return {
    index,
    stage,
    status: stage === "queued" ? "排队" : stage,
    attempts: 0,
    sourceCount: 0,
    translatedCount: 0,
    message: "",
    stageStartedAt: now,
    updatedAt: now
  };
}

function updateChunkStatus(record, index, patch) {
  const statuses = record.job.translation.chunkStatuses;
  const current = statuses[index] || createChunkStatus(index, "queued");
  const now = Date.now();
  const nextStage = patch.stage || current.stage;
  statuses[index] = {
    ...current,
    ...patch,
    index,
    stageStartedAt: nextStage !== current.stage ? now : (current.stageStartedAt || now),
    updatedAt: now
  };
  const completed = statuses.filter(item => ["completed", "completed_with_warnings", "failed"].includes(item.stage)).length;
  const failed = statuses.filter(item => item.stage === "failed").length;
  const asrRunning = statuses.filter(item => item.stage === "asr").length;
  const translating = statuses.filter(item => item.stage === "translation").length;
  const asrPartialFailed = statuses.filter(item => item?.stage !== "failed" && chunkStatusAsrFailureCount(item) > 0).length;
  record.job.translation.chunksDone = completed;
  record.job.translation.chunksFailed = failed;
  record.job.translation.failed = failed;
  record.job.translation.chunksAsrPartialFailed = asrPartialFailed;
  record.job.translation.chunksAsr = asrRunning;
  record.job.translation.asrRunning = asrRunning;
  record.job.translation.chunksTranslating = translating;
  record.job.translation.translationRunning = translating;
  publishBrowserPreloadJob(record);
}

function chunkStatusAsrFailureCount(status) {
  return Math.max(0, Number(status?.asrFailures || status?.asr_failures || 0) || 0);
}

function publishBrowserSubtitle(record) {
  const source = collectChunkSegments(record.sourceSegmentsByChunk);
  const translated = collectChunkSegments(record.translatedSegmentsByChunk);
  const display = mergeTranslatedDisplaySegments(source, translated);
  record.job.translation.sourceSegments = source.length;
  record.job.translation.translatedSegments = translated.length;
  record.job.translation.segmentCount = display.length;
  record.job.translation.vttPath = display.length ? "browser-memory" : "";
  record.job.translation.vttText = display.length ? segmentsToVtt(display) : "";
  record.job.translation.transcript = { source, translated, metadata: record.metadata };
  publishBrowserPreloadJob(record);
  attachBrowserJobVttIfReady(record).catch(() => {});
}

function mergeTranslatedDisplaySegments(source, translated) {
  const sourceSegments = Array.isArray(source) ? source : [];
  const translatedSegments = Array.isArray(translated) ? translated : [];
  if (!sourceSegments.length) {
    return translatedSegments;
  }
  if (!translatedSegments.length) {
    return sourceSegments;
  }
  const translatedByKey = new Map();
  translatedSegments.forEach((segment, index) => {
    const key = segmentIdentityKey(segment, index);
    if (key) {
      translatedByKey.set(key, segment);
    }
  });
  const usedKeys = new Set();
  const display = sourceSegments.map((segment, index) => {
    const key = segmentIdentityKey(segment, index);
    const translatedSegment = key ? translatedByKey.get(key) : translatedSegments[index];
    if (key && translatedSegment) {
      usedKeys.add(key);
    }
    return translatedSegment || segment;
  });
  for (const [index, segment] of translatedSegments.entries()) {
    const key = segmentIdentityKey(segment, index);
    if (key && usedKeys.has(key)) {
      continue;
    }
    if (!key && index < sourceSegments.length) {
      continue;
    }
    display.push(segment);
  }
  return display.sort((left, right) => left.start - right.start || left.end - right.end);
}

function segmentIdentityKey(segment, fallbackIndex = null) {
  const chunkIndex = Number(segment?.chunkIndex);
  const segmentIndex = Number(segment?.segmentIndex);
  if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
    return `${chunkIndex}:${segmentIndex}`;
  }
  return Number.isInteger(fallbackIndex) ? `fallback:${fallbackIndex}` : "";
}

function browserFailureSummary(record) {
  const failed = (record?.job?.translation?.chunkStatuses || []).filter(item => item?.stage === "failed").length;
  if (!failed) {
    return "";
  }
  const sourceCount = collectChunkSegments(record.sourceSegmentsByChunk || new Map()).length;
  const translatedCount = collectChunkSegments(record.translatedSegmentsByChunk || new Map()).length;
  if (!sourceCount && !translatedCount) {
    return `有 ${failed} 个识别分段失败，没有可显示的原文；请检查 ASR 服务后重试。`;
  }
  if (translatedCount) {
    return `有 ${failed} 个识别分段失败，已先显示可用字幕。`;
  }
  return `有 ${failed} 个识别分段失败，已先显示可用原文。`;
}

function finalizeBrowserCompletionState(record) {
  const failed = record.job.translation.chunkStatuses.filter(item => item.stage === "failed").length;
  const coverageWarning = browserSubtitleCoverageWarning(record);
  const asrPartialWarning = browserAsrPartialFailureSummary(record);
  const partialWarning = browserPartialTranslationSummary(record);
  const messages = [failed ? browserFailureSummary(record) : "", asrPartialWarning, partialWarning, coverageWarning].filter(Boolean);
  record.job.status = "completed";
  record.job.stage = messages.length ? "completed_with_warnings" : "completed";
  record.job.error = messages.join(" ");
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  publishBrowserPreloadJob(record);
  return { failed, asrPartialFailure: Boolean(asrPartialWarning), partialWarning, coverageWarning };
}

function browserPartialTranslationChunkMessage(failures) {
  const count = Array.isArray(failures) ? failures.length : 0;
  return count ? `部分句子翻译失败，已显示可用译文并保留 ${count} 条原文供重试。` : "";
}

function browserAsrPartialChunkMessage(count) {
  const failed = Math.max(0, Number(count || 0) || 0);
  return failed ? `有 ${failed} 个识别音频分段失败，已翻译可用原文；可重试失败识别分段。` : "";
}

function browserCompletedChunkWarningMessage(translationFailures, asrFailures = 0) {
  return [
    browserPartialTranslationChunkMessage(translationFailures),
    browserAsrPartialChunkMessage(asrFailures)
  ].filter(Boolean).join(" ");
}

function browserAsrPartialFailureSummary(record) {
  const partialStatuses = (record?.job?.translation?.chunkStatuses || [])
    .filter(item => item?.stage !== "failed" && chunkStatusAsrFailureCount(item) > 0);
  if (!partialStatuses.length) {
    return "";
  }
  const failedAudioChunks = partialStatuses.reduce((sum, item) => sum + chunkStatusAsrFailureCount(item), 0);
  return `有 ${partialStatuses.length} 个字幕分段存在 ${failedAudioChunks} 个失败音频分段，已先显示可用字幕；可重试失败识别分段。`;
}

function browserPartialTranslationSummary(record) {
  const partialStatuses = (record?.job?.translation?.chunkStatuses || [])
    .filter(item => item?.stage === "completed_with_warnings" && Math.max(0, Number(item.translationFailures || 0) || 0) > 0);
  if (!partialStatuses.length) {
    return "";
  }
  const failedSentences = partialStatuses.reduce((sum, item) => sum + Math.max(0, Number(item.translationFailures || 0) || 0), 0);
  return failedSentences
    ? `有 ${partialStatuses.length} 个翻译分段只完成部分句子，${failedSentences} 条失败句子已保留原文供重试。`
    : `有 ${partialStatuses.length} 个翻译分段只完成部分句子，失败句子已保留原文供重试。`;
}

function browserCompletionAllowsAudioRelease(completion) {
  return !completion?.failed && !completion?.coverageWarning && !completion?.asrPartialFailure;
}

function browserSubtitleCoverageWarning(record) {
  const expectedDuration = browserExpectedMediaDuration(record);
  if (!Number.isFinite(expectedDuration) || expectedDuration < 300) {
    return "";
  }
  const displaySegments = mergeTranslatedDisplaySegments(
    collectChunkSegments(record.sourceSegmentsByChunk || new Map()),
    collectChunkSegments(record.translatedSegmentsByChunk || new Map())
  );
  const subtitleEnd = Math.max(
    0,
    ...displaySegments
      .map(segment => Number(segment.end))
      .filter(value => Number.isFinite(value) && value > 0)
  );
  if (!subtitleEnd) {
    return "没有生成可显示字幕；如果视频确实没有语音可忽略，否则请确认媒体源是否完整，必要时清缓存后重新抽取。";
  }
  const uncoveredSeconds = expectedDuration - subtitleEnd;
  if (uncoveredSeconds <= 120 || subtitleEnd >= expectedDuration * 0.75) {
    return "";
  }
  return `字幕只覆盖到 ${formatCoverageDuration(subtitleEnd)} / 预计 ${formatCoverageDuration(expectedDuration)}，覆盖明显不足；请确认媒体源是否完整，必要时清缓存后重新抽取。`;
}

function browserExpectedMediaDuration(record) {
  return [
    record?.metadata?.duration,
    record?.candidate?.duration,
    record?.job?.extract?.duration
  ]
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left)[0] || 0;
}

function formatCoverageDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function collectChunkSegments(map) {
  return [...map.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .flatMap(([chunkIndex, segments]) => {
      const normalizedChunkIndex = Number(chunkIndex);
      return [...(segments || [])]
        .map((segment, fallbackSegmentIndex) => {
          const segmentIndex = Number(segment.segmentIndex);
          const segmentChunkIndex = Number(segment.chunkIndex);
          return {
            ...segment,
            chunkIndex: Number.isFinite(segmentChunkIndex)
              ? segmentChunkIndex
              : Number.isFinite(normalizedChunkIndex)
                ? normalizedChunkIndex
                : chunkIndex,
            segmentIndex: Number.isFinite(segmentIndex) ? segmentIndex : fallbackSegmentIndex
          };
        })
        .sort((left, right) =>
          left.segmentIndex - right.segmentIndex ||
          left.start - right.start ||
          left.end - right.end
        );
    });
}

function segmentsToVtt(segments) {
  const blocks = ["WEBVTT", ""];
  for (const segment of segments) {
    const text = cleanVttText(segment.text);
    if (!Number.isFinite(Number(segment.start)) || !Number.isFinite(Number(segment.end)) || !text) {
      continue;
    }
    blocks.push(`${formatVttTimestamp(segment.start)} --> ${formatVttTimestamp(segment.end)}`);
    blocks.push(text);
    blocks.push("");
  }
  return blocks.length > 2 ? blocks.join("\n") : "";
}

async function attachBrowserJobVttIfReady(record) {
  if (!record.tabId || !record.job.translation.vttText || !(await isSubtitleOverlayEnabled())) {
    return;
  }
  if (!browserPreloadRecordMatchesCurrentPage(record)) {
    return;
  }
  if (hasManualVttAttachment(record.tabId)) {
    return;
  }
  if (isPreloadSubtitleAttachmentSuppressed(record.tabId, record.job.id)) {
    return;
  }
  const attachment = await buildBrowserVttAttachment(record.job);
  if (!attachment.vtt) {
    return;
  }
  const signature = browserVttAttachmentSignature(record.job, attachment);
  const state = getState(record.tabId);
  if (state.attachedVttSignature === signature && await hasAttachedSubtitleSignature(record.tabId, signature)) {
    return;
  }
  await ensureSubtitleOverlay(record.tabId);
  const response = await sendMessageToMediaFrame(record.tabId, {
    type: MESSAGE.ATTACH_VTT,
    vtt: attachment.vtt,
    label: "浮光译影",
    signature
  });
  if (response?.ok) {
    state.attachedVttSignature = signature;
    state.manualVttSignature = "";
  }
}

async function buildBrowserVttAttachment(job) {
  const mode = await getSubtitleDisplayMode();
  const transcript = job.translation?.transcript;
  const allowSourcePreview = browserJobAllowsSourcePreview(job);
  if (mode === "bilingual") {
    const bilingual = transcriptToBilingualVtt(transcript, { allowSourcePreview });
    if (bilingual) {
      return { mode, vtt: bilingual };
    }
  }
  const translated = transcriptToTranslatedVtt(transcript, { allowSourcePreview });
  if (translated) {
    return { mode: "translated", vtt: translated };
  }
  return { mode: "translated", vtt: transcript ? "" : (job.translation?.vttText || "") };
}

function browserJobAllowsSourcePreview(job) {
  return !["done", "completed", "error", "failed", "cancelled"].includes(String(job?.status || ""));
}

function browserVttAttachmentSignature(job, attachment) {
  return [
    job.id,
    job.translation?.segmentCount || 0,
    job.translation?.chunksDone || 0,
    attachment.mode,
    vttContentSignature(attachment.vtt)
  ].join(":");
}

function findBrowserPreloadRecordForTabPage(tabId, pageUrl) {
  if (!tabId || !normalizeBrowserPageIdentity(pageUrl)) {
    return null;
  }
  return [...browserPreloadJobs.values()]
    .filter(record => record?.tabId === tabId && !record.cancelled && browserPreloadRecordMatchesPageUrl(record, pageUrl))
    .sort((left, right) => Number(right.job?.updatedAt || 0) - Number(left.job?.updatedAt || 0))[0] || null;
}

function browserPreloadRecordMatchesCurrentPage(record) {
  if (!record?.tabId) {
    return false;
  }
  const state = tabState.get(record.tabId);
  const currentPageUrl = state?.page?.url || state?.context?.href || "";
  return browserPreloadRecordMatchesPageUrl(record, currentPageUrl);
}

function browserPreloadRecordMatchesPageUrl(record, pageUrl) {
  if (!record) {
    return false;
  }
  return browserPreloadJobMatchesPageUrl(record.job, pageUrl)
    || browserPageIdentitiesMatch(record.metadata?.pageUrl || record.candidate?.pageUrl || "", pageUrl);
}

function browserPreloadJobMatchesPageUrl(job, pageUrl) {
  if (!job) {
    return false;
  }
  return browserPageIdentitiesMatch(
    job.metadata?.pageUrl || job.translation?.transcript?.metadata?.pageUrl || "",
    pageUrl
  );
}

function browserPageIdentitiesMatch(left, right) {
  const expected = normalizeBrowserPageIdentity(left);
  if (!expected) {
    return false;
  }
  const actual = normalizeBrowserPageIdentity(right);
  return Boolean(actual && actual === expected);
}

function normalizeBrowserPageIdentity(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    url.hash = "";
    normalizeBilibiliBrowserPageIdentity(url);
    for (const key of [...url.searchParams.keys()]) {
      if (isBrowserPageTrackingParam(key) || isBrowserPageSensitiveParam(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return stripBrowserPageSensitiveQuery(rawUrl, { removeTracking: true });
  }
}

function normalizeBilibiliBrowserPageIdentity(url) {
  if (!/(^|\.)bilibili\.com$/i.test(url.hostname)) {
    return;
  }
  const match = url.pathname.match(/^\/video\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) {
    return;
  }
  const part = url.searchParams.get("p");
  url.pathname = `/video/${match[1]}`;
  url.search = "";
  if (part && /^\d+$/.test(part)) {
    url.searchParams.set("p", part);
  }
}

function stripBrowserPageSensitiveQuery(rawUrl, { removeTracking = false } = {}) {
  const text = String(rawUrl || "").trim();
  const [withoutHash] = text.split("#");
  const queryStart = withoutHash.indexOf("?");
  if (queryStart < 0) {
    return withoutHash;
  }
  const base = withoutHash.slice(0, queryStart);
  const query = withoutHash.slice(queryStart + 1);
  const params = query.split("&").filter(Boolean).filter(part => {
    const key = decodeBrowserPageQueryKey(part.split("=")[0] || "");
    return !isBrowserPageSensitiveParam(key) && !(removeTracking && isBrowserPageTrackingParam(key));
  });
  params.sort();
  return params.length ? `${base}?${params.join("&")}` : base;
}

function decodeBrowserPageQueryKey(value) {
  try {
    return decodeURIComponent(String(value || "").replace(/\+/g, " "));
  } catch {
    return String(value || "");
  }
}

function isBrowserPageTrackingParam(key) {
  return /^(utm_|spm_|vd_source$|from$|share_|fbclid$|gclid$|trackid$)/i.test(String(key || ""));
}

function isBrowserPageSensitiveParam(key) {
  return /^(token$|access_?token$|auth(?:_key)?$|authorization$|signature$|sign$|sig$|policy$|key-pair-id$|awsaccesskeyid$|expires?$|expiration$|deadline$|timestamp$|ts$|nonce$|session(?:id)?$|sid$|x-amz-|x-oss-|x-goog-)/i.test(String(key || ""));
}

function publishBrowserPreloadJob(record) {
  record.job.updatedAt = Date.now();
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  record.job.reusableAudioChunks = (record.audioChunks || []).length;
  record.job.reusableSourceChunks = record.sourceSegmentsByChunk?.size || 0;
  record.job.translation.reusableAudioChunks = record.job.reusableAudioChunks;
  record.job.translation.reusableSourceChunks = record.job.reusableSourceChunks;
  record.job.progress = browserJobProgress(record.job);
  if (!browserPreloadRecordMatchesCurrentPage(record)) {
    return;
  }
  setTabStatus(record.tabId, {
    preload: record.job.status,
    preloadJob: record.job,
    error: record.job.error || ""
  });
}

function browserJobProgress(job) {
  const extract = job.extract || {};
  const translation = job.translation || {};
  const total = Number(translation.chunksTotal || translation.chunkCount || 0);
  const done = Number(translation.chunksDone || 0);
  const failed = Number(translation.chunksFailed || translation.failed || 0);
  const extractPercent = Number(extract.progress || 0) || 0;
  return {
    status: job.status,
    stage: job.stage,
    elapsedSeconds: extract.elapsedSeconds || 0,
    extractPercent,
    translationPercent: total ? Math.round((done / total) * 1000) / 10 : 0,
    extraction: {
      ...extract,
      percent: extractPercent,
      status: extract.status || job.stage
    },
    translation: {
      ...translation,
      chunksTotal: total,
      chunksDone: done,
      chunksFailed: failed,
      chunksAsr: Number(translation.chunksAsr || translation.asrRunning || 0),
      chunksTranslating: Number(translation.chunksTranslating || translation.translationRunning || 0),
      asrWorkers: translation.asrWorkers,
      translationWorkers: translation.translationWorkers || translation.workers,
      chunkStatuses: translation.chunkStatuses || []
    },
    chunkStatuses: translation.chunkStatuses || [],
    chunksFailed: failed
  };
}

function isBrowserJobCancelled(record) {
  return record.cancelled || record.job.status === "cancelled";
}

function elapsedSeconds(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function clampProgressPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number * 10) / 10));
}

function pickNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) {
    return Math.floor(number);
  }
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber >= 0 ? Math.floor(fallbackNumber) : 0;
}

async function runPool(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(Number(concurrency) || 1, queue.length || 1)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function normalizeApiBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function browserAsrUploadChunkSeconds(modelConfig = {}) {
  return normalizeBrowserAsrUploadChunkSeconds(modelConfig.asrUploadChunkSeconds);
}

function normalizeBrowserAsrUploadChunkSeconds(value) {
  const configured = Number(value || BROWSER_ASR_UPLOAD_CHUNK_SECONDS);
  const seconds = Number.isFinite(configured) && configured > 0
    ? configured
    : BROWSER_ASR_UPLOAD_CHUNK_SECONDS;
  return Math.max(10, Math.min(BROWSER_ASR_MAX_UPLOAD_CHUNK_SECONDS, Math.floor(seconds)));
}

function browserAsrMaxUploadBytes(asrConfig = {}) {
  const directBytes = Number(asrConfig?.maxUploadBytes || asrConfig?.maxFileBytes || 0);
  if (Number.isFinite(directBytes) && directBytes > 0) {
    return Math.floor(directBytes);
  }
  const mb = Number(asrConfig?.maxUploadMb || asrConfig?.maxFileSizeMb || 0);
  if (Number.isFinite(mb) && mb > 0) {
    return Math.floor(mb * 1024 * 1024);
  }
  return BROWSER_ASR_MAX_UPLOAD_BYTES;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) {
    return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
  }
  if (value >= 1024) {
    return `${Math.round((value / 1024) * 10) / 10} KB`;
  }
  return `${Math.round(value)} B`;
}

function browserTranslationSegmentSeconds(record) {
  const seconds = Number(record?.modelConfig?.chunkSeconds || DEFAULT_MODEL_SETTINGS.chunkMinutes * 60);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_MODEL_SETTINGS.chunkMinutes * 60;
}

function browserTranslationBatchWorkers(record) {
  const configuredWorkers = Number(record?.modelConfig?.workers || DEFAULT_MODEL_SETTINGS.translationWorkers);
  return Math.max(1, Math.min(2, Number.isFinite(configuredWorkers) ? Math.floor(configuredWorkers) : 1));
}

function browserTranslationSplitWorkers(record) {
  const configuredWorkers = Number(record?.modelConfig?.workers || DEFAULT_MODEL_SETTINGS.translationWorkers);
  return Math.max(1, Math.min(2, Number.isFinite(configuredWorkers) ? Math.floor(configuredWorkers) : 1));
}

function roundTime(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

async function retryPreload(tabId, chunkIndexes = []) {
  const state = getState(tabId);
  const jobId = state.preloadJob?.id;
  if (!jobId) {
    throw new Error("没有正在跟踪的预加载任务，不能重试失败识别分段。请先重新抽取。");
  }
  clearPreloadSubtitleSuppression(tabId, jobId);
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    return retryBrowserFailedPreload(browserRecord, chunkIndexes);
  }
  if (state.preloadJob?.status === "running" || state.preloadJob?.status === "queued") {
    return {
      preload: state.preloadJob.status,
      job: state.preloadJob,
      message: "当前任务仍在运行，已忽略重复重试请求。"
    };
  }
  const failedChunkCount = countFailedChunks(state.preloadJob);
  if (failedChunkCount <= 0) {
    throw new Error("当前任务没有失败识别分段可重试。需要重新抽取时请点击“重新抽取”。");
  }
  throw new Error("后台任务状态已过期或这个任务不是当前浏览器内预加载任务，不能重试失败识别分段。请重新抽取。");
}

async function retranslatePreload(tabId, chunkIndexes = []) {
  const state = getState(tabId);
  const jobId = state.preloadJob?.id;
  if (!jobId) {
    throw new Error("没有正在跟踪的预加载任务，不能只重翻译字幕。请先完成一次抽取和识别。");
  }
  clearPreloadSubtitleSuppression(tabId, jobId);
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    return retryBrowserTranslationOnly(browserRecord, chunkIndexes, { failedOnly: false });
  }
  if (state.preloadJob?.status === "running" || state.preloadJob?.status === "queued") {
    return {
      preload: state.preloadJob.status,
      job: state.preloadJob,
      message: "当前任务仍在运行，已忽略重复重翻译请求。"
    };
  }
  throw new Error("后台任务状态已过期或这个任务不是当前浏览器内预加载任务，不能只重翻译。请重新抽取。");
}

async function retryBrowserFailedPreload(record, chunkIndexes = []) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number) : []);
  const retryIndexes = collectBrowserRetryIndexes(record, requested);
  if (!retryIndexes.length) {
    throw new Error("当前任务没有可继续处理的识别分段。");
  }
  const sourceRetryIndexes = retryIndexes.filter(index => {
    const status = statuses[index] || {};
    return reusableBrowserSourceSegments(record, index).length && chunkStatusAsrFailureCount(status) <= 0;
  });
  const asrRetryIndexes = retryIndexes.filter(index => !sourceRetryIndexes.includes(index));
  const asrRetryHasAudio = asrRetryIndexes.every(index => browserAudioChunksForTranslationGroup(record, index).length);
  if (asrRetryIndexes.length && !asrRetryHasAudio) {
    throw new Error("浏览器内任务没有保留可继续识别的音频分段，请重新开始任务。");
  }
  record.job.status = "running";
  record.job.stage = "retrying";
  publishBrowserPreloadJob(record);
  if (sourceRetryIndexes.length) {
    await runPool(sourceRetryIndexes, Math.max(record.modelConfig.workers || 1, 1), async index => {
      await translateBrowserChunkFromSource(record, index, reusableBrowserSourceSegments(record, index), "重翻译，不重新识别");
    });
  }
  await runPool(asrRetryIndexes, Math.max(record.modelConfig.asrWorkers, 1), async index => {
    await retryBrowserAsrGroup(record, index);
  });
  publishBrowserSubtitle(record);
  const completion = finalizeBrowserCompletionState(record);
  if (browserCompletionAllowsAudioRelease(completion)) {
    await releaseBrowserAudioChunks(record);
  }
  return { preload: record.job.status, job: record.job };
}

function collectBrowserRetryIndexes(record, requested) {
  const requestedIndexes = requested instanceof Set ? requested : new Set();
  const statuses = record.job.translation?.chunkStatuses || [];
  const failedIndexes = statuses
    .filter(status => status?.stage === "failed" && (!requestedIndexes.size || requestedIndexes.has(Number(status.index))))
    .map(status => Number(status.index))
    .filter(Number.isFinite);
  if (failedIndexes.length) {
    return [...new Set(failedIndexes)].sort((left, right) => left - right);
  }
  const sourceIndexes = [...(record.sourceSegmentsByChunk?.keys?.() || [])]
    .map(Number)
    .filter(Number.isFinite);
  const audioIndexes = (record.audioChunks || [])
    .map(chunk => browserTranslationGroupIndex(record, chunk))
    .filter(Number.isFinite);
  const indexes = [...new Set([...sourceIndexes, ...audioIndexes])]
    .filter(index => !requestedIndexes.size || requestedIndexes.has(index))
    .filter(index => {
      const status = statuses[index];
      if (!status) {
        return true;
      }
      if (status.stage === "completed" && reusableBrowserSourceSegments(record, index).length && chunkStatusAsrFailureCount(status) <= 0) {
        return false;
      }
      return status.stage !== "completed";
    })
    .sort((left, right) => left - right);
  return indexes;
}

function browserAudioChunksForTranslationGroup(record, groupIndex) {
  const target = Number(groupIndex);
  if (!Number.isFinite(target)) {
    return [];
  }
  ensureBrowserChunkPipelineState(record);
  return (record.audioChunks || [])
    .filter(chunk => {
      const mapped = record.browserAsrChunkToTranslationGroup?.get?.(chunk.index);
      if (Number.isFinite(Number(mapped))) {
        return Number(mapped) === target;
      }
      return browserTranslationGroupIndex(record, chunk) === target;
    })
    .sort((left, right) => left.start - right.start || left.index - right.index);
}

async function retryBrowserAsrGroup(record, groupIndex) {
  const index = Number(groupIndex);
  const chunks = browserAudioChunksForTranslationGroup(record, index);
  if (!chunks.length) {
    throw new Error(`第 ${index + 1} 个识别分段没有可复用的音频分段。`);
  }
  const current = record.job.translation?.chunkStatuses?.[index] || {};
  const attempt = (current.attempts || 0) + 1;
  const sourceSegments = [];
  const errors = [];
  let empty = 0;
  updateChunkStatus(record, index, {
    stage: "asr",
    status: "识别",
    attempts: attempt,
    sourceCount: 0,
    translatedCount: 0,
    error: "",
    message: `第 ${attempt} 次尝试 · 重新识别 ${chunks.length} 个音频分段`
  });
  await runPool(chunks, Math.max(record.modelConfig.asrWorkers || 1, 1), async chunk => {
    const ordinal = chunks.findIndex(item => item.index === chunk.index) + 1;
    updateChunkStatus(record, index, {
      stage: "asr",
      status: "识别",
      attempts: attempt,
      sourceCount: sourceSegments.length,
      error: "",
      message: `第 ${attempt} 次尝试 · 识别音频分段 ${ordinal}/${chunks.length}`
    });
    try {
      const chunkSegments = await transcribeBrowserAudioChunk(chunk, record.modelConfig.asr);
      if (chunkSegments.length) {
        sourceSegments.push(...chunkSegments);
      } else {
        empty += 1;
      }
    } catch (error) {
      errors.push(error.message || String(error));
    }
  });
  const normalizedSource = normalizeBrowserSourceSegmentsForTranslation(sourceSegments, index);
  record.sourceSegmentsByChunk.set(index, normalizedSource);
  if (errors.length && !normalizedSource.length) {
    updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      attempts: attempt,
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: errors.length,
      asrErrors: errors.slice(0, 5),
      error: `第 ${index + 1} 个识别分段连续 ${attempt} 次失败：${errors[0]}`
    });
    publishBrowserSubtitle(record);
    return;
  }
  if (!normalizedSource.length) {
    record.translatedSegmentsByChunk.set(index, []);
    updateChunkStatus(record, index, {
      stage: "completed",
      status: "完成",
      attempts: attempt,
      sourceCount: 0,
      translatedCount: 0,
      asrFailures: 0,
      asrErrors: [],
      message: empty ? `无语音 · 跳过 ${empty} 个音频分段` : "无语音"
    });
    publishBrowserSubtitle(record);
    return;
  }
  const suffix = errors.length
    ? `重试识别后翻译，${errors.length} 个音频分段失败，先用可用原文`
    : "重试识别后翻译";
  updateChunkStatus(record, index, {
    asrFailures: errors.length,
    asrErrors: errors.slice(0, 5),
    error: errors.length ? `有 ${errors.length} 个识别音频分段失败，先翻译可用原文。` : ""
  });
  await translateBrowserChunkFromSource(record, index, normalizedSource, suffix);
}

async function retryBrowserTranslationOnly(record, chunkIndexes = [], options = {}) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number) : []);
  let indexes = [...record.sourceSegmentsByChunk.keys()]
    .map(Number)
    .filter(index => Number.isFinite(index) && reusableBrowserSourceSegments(record, index).length);
  if (options.failedOnly) {
    const failed = new Set(
      statuses
        .filter(status => status?.stage === "failed")
        .map(status => Number(status.index))
        .filter(Number.isFinite)
    );
    indexes = indexes.filter(index => failed.has(index));
  }
  if (requested.size) {
    indexes = indexes.filter(index => requested.has(index));
  }
  indexes = [...new Set(indexes)].sort((left, right) => left - right);
  if (!indexes.length) {
    throw new Error("没有可复用的 ASR 原文，不能只重翻译字幕。");
  }
  record.job.status = "running";
  record.job.stage = "retry_translation";
  publishBrowserPreloadJob(record);
  await runPool(indexes, Math.max(record.modelConfig.workers || 1, 1), async index => {
    await translateBrowserChunkFromSource(record, index, reusableBrowserSourceSegments(record, index), "只重翻译，不重新识别");
  });
  publishBrowserSubtitle(record);
  finalizeBrowserCompletionState(record);
  return { preload: record.job.status, job: record.job };
}

function reusableBrowserSourceSegments(record, index) {
  const segments = record?.sourceSegmentsByChunk?.get(Number(index));
  return Array.isArray(segments) ? segments : [];
}

async function translateBrowserChunkFromSource(record, index, sourceSegments, message) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const current = statuses[index] || {};
  const asrFailures = chunkStatusAsrFailureCount(current);
  const asrErrors = Array.isArray(current.asrErrors) ? current.asrErrors : [];
  const attempt = (current.attempts || 0) + 1;
  updateChunkStatus(record, index, {
    stage: "translation",
    status: "翻译",
    attempts: attempt,
    sourceCount: sourceSegments.length,
    error: "",
    message: `第 ${attempt} 次尝试 · ${message}`
  });
  let translatedSegments;
  try {
    translatedSegments = await translateBrowserSegments(
      sourceSegments,
      record.modelConfig.translation,
      record.modelConfig.targetLanguage,
      record.metadata,
      {
        batchWorkers: browserTranslationBatchWorkers(record),
        splitWorkers: browserTranslationSplitWorkers(record),
        onProgress(progress) {
          updateChunkStatus(record, index, {
            stage: "translation",
            status: "翻译",
            attempts: attempt,
            sourceCount: sourceSegments.length,
            message: `第 ${attempt} 次尝试 · ${message} · 第 ${progress.batchIndex}/${progress.batchTotal} 批`
          });
        }
      }
    );
  } catch (error) {
    const previous = record.translatedSegmentsByChunk.get(index);
    if (Array.isArray(previous) && previous.length) {
      translatedSegments = previous;
    } else {
      translatedSegments = [];
      record.translatedSegmentsByChunk.set(index, translatedSegments);
    }
    updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      sourceCount: sourceSegments.length,
      translatedCount: translatedSegments.length,
      error: translatedSegments.length
        ? `重翻译失败，已保留已有译文：${error.message || String(error)}`
        : `重翻译失败，未生成译文，已保留原文供重试：${error.message || String(error)}`
    });
    publishBrowserSubtitle(record);
    return;
  }
  record.translatedSegmentsByChunk.set(index, translatedSegments);
  const translationFailures = browserTranslationFailures(translatedSegments);
  const warningMessage = browserCompletedChunkWarningMessage(translationFailures, asrFailures);
  updateChunkStatus(record, index, {
    stage: warningMessage ? "completed_with_warnings" : "completed",
    status: warningMessage ? "部分完成" : "完成",
    sourceCount: sourceSegments.length,
    translatedCount: translatedSegments.length,
    translationFailures: translationFailures.length,
    asrFailures,
    asrErrors,
    error: warningMessage,
    message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
  });
  publishBrowserSubtitle(record);
}

function countFailedChunks(job) {
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || [];
  if (!Array.isArray(statuses)) {
    return 0;
  }
  return statuses.filter(status => status?.stage === "failed" || chunkStatusAsrFailureCount(status) > 0).length;
}

async function cancelPreload(tabId, jobId) {
  const state = getState(tabId);
  const targetJobId = jobId || state.preloadJob?.id;
  if (!targetJobId) {
    throw new Error("没有正在运行的预加载任务。");
  }
  const browserRecord = browserPreloadJobs.get(targetJobId);
  if (browserRecord) {
    browserRecord.cancelled = true;
    browserRecord.job.status = "cancelled";
    browserRecord.job.stage = "cancelled";
    browserRecord.job.error = "任务已停止。";
    await releaseBrowserAudioChunks(browserRecord);
    await detachPreloadVtt(tabId);
    publishBrowserPreloadJob(browserRecord);
    return { job: browserRecord.job };
  }
  await detachPreloadVtt(tabId);
  const job = {
    ...(state.preloadJob || {}),
    id: targetJobId,
    status: "cancelled",
    stage: "cancelled",
    error: "任务已停止。"
  };
  setTabStatus(tabId, { preload: "cancelled", preloadJob: job, error: "", attachedVttSignature: "" });
  return { job };
}

async function clearPreloadAudioCache(tabId, jobId) {
  const state = getState(tabId);
  const targetJobId = jobId || state.preloadJob?.id;
  if (!targetJobId) {
    throw new Error("没有可清理音频缓存的预加载任务。");
  }
  const browserRecord = browserPreloadJobs.get(targetJobId);
  if (browserRecord) {
    const removed = await clearBrowserAudioCacheForJob(targetJobId, [
      ...(browserRecord.audioChunks || []),
      ...(browserRecord.browserInternalAudioChunks || []),
      ...(browserRecord.browserPendingLogicalChunk?.parts || [])
    ]);
    browserRecord.audioChunks = [];
    browserRecord.browserInternalAudioChunks = [];
    browserRecord.browserPendingLogicalChunk = null;
    browserRecord.job.audioCacheRemoved = true;
    browserRecord.job.audioCacheRemovedCount = removed;
    publishBrowserPreloadJob(browserRecord);
    return {
      job: browserRecord.job,
      removed: removed > 0,
      message: removed > 0
        ? `浏览器内任务的音频切片缓存已清除（${removed} 项）。`
        : "当前任务没有可清理的浏览器音频缓存。"
    };
  }
  if (String(targetJobId).startsWith("browser-")) {
    const removed = await clearBrowserAudioCacheForJob(targetJobId, []);
    const job = {
      ...(state.preloadJob || {}),
      id: targetJobId,
      audioCacheRemoved: true,
      audioCacheRemovedCount: removed
    };
    setTabStatus(tabId, { preloadJob: job, error: "" });
    return {
      job,
      removed: removed > 0,
      message: removed > 0
        ? `浏览器内任务的音频切片缓存已清除（${removed} 项）。`
        : "当前任务没有可清理的浏览器音频缓存。"
    };
  }
  throw new Error("这个任务不是当前浏览器内预加载任务，不能清理浏览器音频缓存。请重新抽取。");
}

async function clearBrowserAudioCacheForJob(jobId, chunks = []) {
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  const cacheUrls = collectBrowserAudioCacheUrls(chunks);
  const keys = await cache.keys().catch(() => []);
  for (const key of keys) {
    const url = typeof key === "string" ? key : key?.url;
    if (isBrowserAudioCacheUrlForJob(url, jobId)) {
      cacheUrls.add(url);
    }
  }
  let removed = 0;
  for (const cacheUrl of cacheUrls) {
    if (await cache.delete(cacheUrl)) {
      removed += 1;
    }
  }
  return removed;
}

async function releaseBrowserAudioChunks(record) {
  const removed = await clearBrowserAudioCacheForJob(record?.job?.id || "", [
    ...(record.audioChunks || []),
    ...(record.browserInternalAudioChunks || []),
    ...(record.browserPendingLogicalChunk?.parts || [])
  ]);
  if (removed) {
    record.audioChunks = [];
    record.browserInternalAudioChunks = [];
    record.browserPendingLogicalChunk = null;
    record.job.audioCacheRemoved = true;
    record.job.audioCacheRemovedCount = removed;
    publishBrowserPreloadJob(record);
  }
  return removed;
}

function collectBrowserAudioCacheUrls(chunks = []) {
  const cacheUrls = new Set();
  const collectCacheUrls = file => {
    if (file?.cacheUrl) {
      cacheUrls.add(file.cacheUrl);
    }
    if (Array.isArray(file?.parts)) {
      for (const part of file.parts) {
        collectCacheUrls(part?.file || part);
      }
    }
  };
  for (const chunk of chunks || []) {
    collectCacheUrls(chunk?.file || chunk);
  }
  return cacheUrls;
}

function isBrowserAudioCacheUrlForJob(rawUrl, jobId) {
  if (!rawUrl || !jobId) {
    return false;
  }
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return false;
  }
  if (url.origin !== WEB_FFMPEG_AUDIO_CACHE_ORIGIN) {
    return false;
  }
  const safeJobId = safeAudioCachePathPart(jobId);
  const basePath = `${WEB_FFMPEG_AUDIO_CACHE_PREFIX}/${safeJobId}`;
  if (!url.pathname.startsWith(basePath)) {
    return false;
  }
  const suffix = url.pathname.slice(basePath.length);
  return (
    suffix === "" ||
    suffix.startsWith("/") ||
    /^-(?:\d+|logical(?:-|\/|$))/.test(suffix)
  );
}

function safeAudioCachePathPart(value) {
  return String(value || "item")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

async function detachPreloadVtt(tabId) {
  if (!tabId) {
    return;
  }
  const state = getState(tabId);
  state.attachedVttSignature = "";
  state.manualVttSignature = "";
  state.subtitleFrameId = null;
  await broadcastMessageToFrames(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT }).catch(() => {});
}

async function clearPreloadSubtitleState(tabId, jobId) {
  const state = getState(tabId);
  const targetJobId = jobId || state.preloadJob?.id || "";
  suppressPreloadSubtitleAttachment(tabId, targetJobId);
  await detachPreloadVtt(tabId);
  return { cleared: Boolean(targetJobId) };
}

function suppressPreloadSubtitleAttachment(tabId, jobId) {
  if (!tabId || !jobId) {
    return;
  }
  const state = getState(tabId);
  if (!state.suppressedSubtitleJobIds) {
    state.suppressedSubtitleJobIds = new Set();
  }
  state.suppressedSubtitleJobIds.add(String(jobId));
  state.attachedVttSignature = "";
}

function clearPreloadSubtitleSuppression(tabId, jobId = "") {
  if (!tabId) {
    return;
  }
  const state = getState(tabId);
  if (!state.suppressedSubtitleJobIds) {
    return;
  }
  if (jobId) {
    state.suppressedSubtitleJobIds.delete(String(jobId));
  } else {
    state.suppressedSubtitleJobIds.clear();
  }
}

function isPreloadSubtitleAttachmentSuppressed(tabId, jobId) {
  if (!tabId || !jobId) {
    return false;
  }
  return Boolean(getState(tabId).suppressedSubtitleJobIds?.has(String(jobId)));
}

function withSubtitleSuppression(job, tabId) {
  if (!job?.id || !isPreloadSubtitleAttachmentSuppressed(tabId, job.id)) {
    return job;
  }
  return {
    ...job,
    subtitleCleared: true
  };
}

async function checkPreloadJob(jobId, tabId) {
  if (!jobId) {
    throw new Error("没有可查询的预加载任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    if (tabId) {
      await refreshTabInfo(tabId);
      if (!browserPreloadRecordMatchesPageUrl(browserRecord, getState(tabId).page?.url || getState(tabId).context?.href || "")) {
        return { job: null, missing: true, pageMismatch: true };
      }
      setTabStatus(tabId, { preload: browserRecord.job.status || "running", preloadJob: browserRecord.job || null });
      if (browserRecord.job.translation?.vttText) {
        await attachBrowserJobVttIfReady(browserRecord);
      }
    }
    return { job: withSubtitleSuppression(browserRecord.job, tabId) };
  }
  if (tabId) {
    setTabStatus(tabId, {
      preload: "idle",
      preloadJob: null,
      attachedVttSignature: "",
      error: "这个浏览器内任务状态已失效。请重新提交任务。"
    });
  }
  return { job: null, missing: true };
}

async function getPreloadVtt(jobId) {
  if (!jobId) {
    throw new Error("没有可读取的字幕任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    return { vtt: browserRecord.job.translation?.vttText || "" };
  }
  throw new Error("这个任务的字幕不在当前浏览器内任务中。请使用本地字幕缓存或重新生成。");
}

async function attachVttText(tabId, vtt) {
  if (!tabId || !vtt) {
    throw new Error("没有可挂载的字幕。");
  }
  const state = getState(tabId);
  const signature = `manual:${vttContentSignature(vtt)}`;
  if (
    state.attachedVttSignature === signature
    && state.manualVttSignature === signature
    && await hasAttachedSubtitleSignature(tabId, signature)
  ) {
    return { attached: true };
  }
  await broadcastMessageToFrames(tabId, { type: MESSAGE.DETACH_PRELOAD_VTT }).catch(() => {});
  state.attachedVttSignature = "";
  state.manualVttSignature = "";
  state.subtitleFrameId = null;
  await ensureSubtitleOverlay(tabId);
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.ATTACH_VTT,
    vtt,
    label: "浮光译影",
    signature
  });
  if (!response?.ok) {
    throw new Error("当前页面没有可挂载字幕的播放器。");
  }
  state.attachedVttSignature = signature;
  state.manualVttSignature = signature;
  return { attached: true };
}

function hasManualVttAttachment(tabId) {
  const state = getState(tabId);
  return Boolean(state.manualVttSignature);
}

function vttContentSignature(vtt) {
  const text = String(vtt || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

async function getSubtitleDisplayMode() {
  const stored = await chrome.storage.sync.get({ subtitleDisplayMode: "translated" }).catch(() => ({}));
  return stored.subtitleDisplayMode === "bilingual" ? "bilingual" : "translated";
}

async function isSubtitleOverlayEnabled() {
  const stored = await chrome.storage.sync.get({ subtitleOverlayEnabled: true }).catch(() => ({}));
  return stored.subtitleOverlayEnabled !== false;
}

function transcriptToTranslatedVtt(transcript, options = {}) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
  if (source.length) {
    return segmentsToVtt(mergeTranslatedDisplaySegments(source, translated));
  }
  if (translated.length) {
    return segmentsToVtt(translated);
  }
  return "";
}

function transcriptToBilingualVtt(transcript, options = {}) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
  const blocks = ["WEBVTT", ""];
  for (const { sourceSegment, translatedSegment } of mergeTranscriptSegmentsForBilingualVtt(source, translated)) {
    const start = firstFiniteNumber(translatedSegment.start, sourceSegment.start);
    const end = firstFiniteNumber(translatedSegment.end, sourceSegment.end);
    const translatedText = cleanVttText(translatedSegment.text);
    const sourceText = cleanVttText(sourceSegment.text);
    const displayText = translatedText || sourceText;
    if (!Number.isFinite(start) || !Number.isFinite(end) || !displayText) {
      continue;
    }
    const lines = [];
    if (translatedText && sourceText && sourceText !== translatedText) {
      lines.push(sourceText);
    }
    lines.push(displayText);
    blocks.push(`${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`);
    blocks.push(lines.join("\n"));
    blocks.push("");
  }
  return blocks.length > 2 ? blocks.join("\n") : "";
}

function mergeTranscriptSegmentsForBilingualVtt(source, translated) {
  const sourceSegments = Array.isArray(source) ? source : [];
  const translatedSegments = Array.isArray(translated) ? translated : [];
  const useIdentity = sourceSegments.some(segment => segmentIdentityKey(segment))
    || translatedSegments.some(segment => segmentIdentityKey(segment));
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
  const merged = sourceSegments.map(sourceSegment => {
    const key = segmentIdentityKey(sourceSegment);
    const translatedSegment = key ? translatedByKey.get(key) : null;
    if (key && translatedSegment) {
      usedKeys.add(key);
    }
    return { sourceSegment, translatedSegment: translatedSegment || {} };
  });
  translatedSegments.forEach(translatedSegment => {
    const key = segmentIdentityKey(translatedSegment);
    if (key && usedKeys.has(key)) {
      return;
    }
    merged.push({ sourceSegment: {}, translatedSegment });
  });
  return merged.sort((left, right) => {
    const leftStart = firstFiniteNumber(left.translatedSegment.start, left.sourceSegment.start);
    const rightStart = firstFiniteNumber(right.translatedSegment.start, right.sourceSegment.start);
    return leftStart - rightStart;
  });
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

function cleanVttText(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function formatVttTimestamp(value) {
  const time = Math.max(0, Number(value) || 0);
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time - Math.floor(time)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

async function getPreloadTranscript(jobId) {
  if (!jobId) {
    throw new Error("没有可读取的字幕任务。");
  }
  const browserRecord = browserPreloadJobs.get(jobId);
  if (browserRecord) {
    return { transcript: browserRecord.job.translation?.transcript || null };
  }
  throw new Error("这个任务的字幕明细不在当前浏览器内任务中。请使用本地字幕缓存或重新生成。");
}

async function getVideoState(tabId) {
  if (!tabId) {
    return { state: null };
  }
  let response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.GET_VIDEO_STATE
  });
  if (!response?.state) {
    await ensureSubtitleOverlay(tabId);
    response = await sendMessageToMediaFrame(tabId, {
      type: MESSAGE.GET_VIDEO_STATE
    });
  }
  if (response?.state) {
    return { state: response.state };
  }
  const context = getState(tabId).context || {};
  if (Number.isFinite(Number(context.currentTime))) {
    return {
      state: {
        currentTime: Number(context.currentTime),
        duration: Number.isFinite(Number(context.duration)) ? Number(context.duration) : null,
        paused: null,
        playbackRate: null,
        currentSrc: "",
        synthetic: true
      }
    };
  }
  return { state: null };
}

async function hasAttachedSubtitleSignature(tabId, signature) {
  if (!tabId || !signature) {
    return false;
  }
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.GET_VIDEO_STATE
  });
  return response?.state?.subtitleSignature === signature;
}

async function seekMedia(tabId, time) {
  if (!tabId) {
    throw new Error("没有可跳转的当前标签页。");
  }
  await ensureSubtitleOverlay(tabId);
  const response = await sendMessageToMediaFrame(tabId, {
    type: MESSAGE.SEEK_MEDIA,
    time
  });
  if (!response?.ok) {
    throw new Error("当前页面没有可跳转的播放器。");
  }
  return { time };
}

async function sendMessageToMediaFrame(tabId, message) {
  const frameIds = await getCandidateMediaFrameIds(tabId);
  let lastResponse = null;
  for (const frameId of frameIds) {
    const response = await chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null);
    if (response?.ok || response?.state) {
      getState(tabId).mediaFrameId = frameId;
      if (message?.type === MESSAGE.ATTACH_VTT && response?.ok) {
        getState(tabId).subtitleFrameId = frameId;
      }
      return response;
    }
    if (response) {
      lastResponse = response;
    }
  }
  const response = await chrome.tabs.sendMessage(tabId, message).catch(() => null);
  if (response?.ok || response?.state) {
    if (message?.type === MESSAGE.ATTACH_VTT && response?.ok) {
      getState(tabId).subtitleFrameId = null;
    }
    return response;
  }
  return lastResponse || response;
}

async function getCandidateMediaFrameIds(tabId) {
  const state = getState(tabId);
  const frameIds = [];
  pushFrameId(frameIds, state.subtitleFrameId);
  pushFrameId(frameIds, state.mediaFrameId);
  pushFrameId(frameIds, state.context?.frameId);
  pushFrameId(frameIds, state.lastPreloadCandidate?.frameId);
  pushFrameId(frameIds, 0);
  const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => []);
  for (const frame of frames) {
    pushFrameId(frameIds, frame.frameId);
  }
  return frameIds;
}

async function broadcastMessageToFrames(tabId, message) {
  const frameIds = await getCandidateMediaFrameIds(tabId);
  await Promise.all(frameIds.map(frameId => chrome.tabs.sendMessage(tabId, message, { frameId }).catch(() => null)));
}

async function ensureSubtitleOverlay(tabId) {
  if (!tabId) {
    return;
  }
  const state = getState(tabId);
  const now = Date.now();
  if (state.subtitleOverlayInjectedAt && now - state.subtitleOverlayInjectedAt < 3000 && await hasSubtitleOverlayInMediaFrame(tabId)) {
    return;
  }
  if (await hasSubtitleOverlayInMediaFrame(tabId)) {
    state.subtitleOverlayInjectedAt = now;
    return;
  }
  await injectPageScript(tabId, ["src/content/subtitle-overlay.js"], { allFrames: true }).catch(() => {});
  state.subtitleOverlayInjectedAt = now;
}

async function hasSubtitleOverlayInMediaFrame(tabId) {
  const frameIds = await getCandidateMediaFrameIds(tabId);
  let lastResponse = null;
  for (const frameId of frameIds) {
    const response = await chrome.tabs
      .sendMessage(tabId, { type: MESSAGE.GET_VIDEO_STATE }, { frameId })
      .catch(() => null);
    if (response?.ok && response.state) {
      getState(tabId).mediaFrameId = frameId;
      return true;
    }
    if (response) {
      lastResponse = response;
    }
  }
  const response = await chrome.tabs.sendMessage(tabId, { type: MESSAGE.GET_VIDEO_STATE }).catch(() => null);
  if (response?.ok && response.state) {
    return true;
  }
  return Boolean(lastResponse?.ok && lastResponse.state);
}

function pushFrameId(frameIds, value) {
  const frameId = Number(value);
  if (Number.isInteger(frameId) && frameId >= 0 && !frameIds.includes(frameId)) {
    frameIds.push(frameId);
  }
}

async function openSidePanel(tabId) {
  if (!tabId || !chrome.sidePanel?.open) {
    throw new Error("当前 Chrome 不支持侧边栏。请升级 Chrome 后重试。");
  }
  await chrome.sidePanel.open({ tabId });
  return {};
}

function enableSidePanelAction() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

async function ensureOffscreenDocument() {
  const url = chrome.runtime.getURL("src/offscreen/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (contexts.length > 0) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: "src/offscreen/offscreen.html",
    reasons: ["IFRAME_SCRIPTING"],
    justification: "托管隐藏的 Web FFmpeg 音频处理页面。"
  });
}

async function getWebFfmpegConfig() {
  return {
    url: getDefaultWebFfmpegUrl()
  };
}

function getDefaultWebFfmpegUrl() {
  return chrome.runtime.getURL(DEFAULT_WEB_FFMPEG_PATH);
}

function filenameFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return name || "media.bin";
  } catch {
    return "media.bin";
  }
}

async function getModelConfig() {
  const localStored = await chrome.storage.local.get(null);
  const useStoredProfiles = localStored.modelSettingsVersion === MODEL_SETTINGS_VERSION;
  const asrProfiles = normalizeStoredProfiles("asr", useStoredProfiles ? localStored.asrProfiles : []);
  const llmProfiles = normalizeStoredProfiles("llm", useStoredProfiles ? localStored.llmProfiles : []);
  const selectedAsrId = normalizeSelectedProfileId(
    asrProfiles,
    localStored.selectedAsrProfileId || DEFAULT_ASR_PROFILE_ID,
    DEFAULT_ASR_PROFILE_ID
  );
  const selectedLlmId = normalizeSelectedProfileId(
    llmProfiles,
    localStored.selectedLlmProfileId || DEFAULT_LLM_PROFILE_ID,
    DEFAULT_LLM_PROFILE_ID
  );
  const selectedAsr = findProfile(asrProfiles, selectedAsrId, DEFAULT_ASR_PROFILE_ID);
  const selectedLlm = findProfile(llmProfiles, selectedLlmId, DEFAULT_LLM_PROFILE_ID);
  clearLegacyModelSyncFields();
  persistMigratedModelSettings(localStored, asrProfiles, llmProfiles, selectedAsrId, selectedLlmId);
  validateSelectedModelProfiles(selectedAsr, selectedLlm);
  const migratedWorkerDefaults = localStored.modelSettingsVersion !== MODEL_SETTINGS_VERSION;
  const sourceLanguage = normalizeAsrLanguage(localStored.sourceLanguage || DEFAULT_MODEL_SETTINGS.sourceLanguage);
  const asrConfig = compactProviderConfig(selectedAsr);
  if (sourceLanguage) {
    asrConfig.language = sourceLanguage;
  }
  return {
    asr: asrConfig,
    translation: compactProviderConfig(selectedLlm),
    targetLanguage: normalizeTargetLanguage(localStored.targetLanguage || DEFAULT_MODEL_SETTINGS.targetLanguage),
    asrWorkers: migratedWorkerDefaults
      ? DEFAULT_MODEL_SETTINGS.asrWorkers
      : Number(localStored.asrWorkers) || DEFAULT_MODEL_SETTINGS.asrWorkers,
    workers: Number(localStored.translationWorkers) || DEFAULT_MODEL_SETTINGS.translationWorkers,
    chunkMinutes: clampInteger(localStored.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes),
    chunkSeconds: clampInteger(localStored.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes) * 60
  };
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function validateSelectedModelProfiles(asrProfile, llmProfile) {
  if (!String(asrProfile.apiKey || "").trim()) {
    throw new Error(`语音识别配置“${asrProfile.name || asrProfile.model || "未命名"}”缺少 API 密钥。请在侧边栏设置里填写。`);
  }
  if (
    !String(llmProfile.apiKey || "").trim() &&
    !String(llmProfile.model || "").trim() &&
    !String(llmProfile.baseUrl || "").trim()
  ) {
    throw new Error("还没有保存可用的翻译模型档案。请在侧边栏设置里新增档案，填写接口格式、接口地址、模型名称和 API 密钥。");
  }
  if (!String(llmProfile.apiKey || "").trim()) {
    throw new Error(`翻译配置“${llmProfile.name || llmProfile.model || "未命名"}”缺少 API 密钥。请在侧边栏设置里填写。`);
  }
  if (!String(llmProfile.model || "").trim()) {
    throw new Error(`翻译配置“${llmProfile.name || "未命名"}”缺少模型名称。`);
  }
}

function persistMigratedModelSettings(stored, asrProfiles, llmProfiles, selectedAsrId, selectedLlmId) {
  const needsVersionMigration = stored.modelSettingsVersion !== MODEL_SETTINGS_VERSION;
  const needsSelectionMigration =
    stored.selectedAsrProfileId !== selectedAsrId || stored.selectedLlmProfileId !== selectedLlmId;
  if (!needsVersionMigration && !needsSelectionMigration) {
    return;
  }
  chrome.storage.local.set({
    selectedAsrProfileId: selectedAsrId,
    selectedLlmProfileId: selectedLlmId,
    modelSettingsVersion: MODEL_SETTINGS_VERSION,
    asrProfiles,
    llmProfiles
  }).catch(() => {});
}

function clearLegacyModelSyncFields() {
  chrome.storage.sync.remove([
    "asrApiKey",
    "llmApiKey",
    "asrBaseUrl",
    "asrModel",
    "llmBaseUrl",
    "llmModel",
    "llmProviderType"
  ]).catch(() => {});
}

async function migrateLegacyCaptionPosition() {
  try {
    const [localData, syncData] = await Promise.all([
      chrome.storage.local.get([CAPTION_POSITION_STORAGE_KEY, LEGACY_CAPTION_TOP_RATIO_KEY]),
      chrome.storage.sync.get([CAPTION_POSITION_STORAGE_KEY])
    ]);
    if (syncData[CAPTION_POSITION_STORAGE_KEY]) {
      return;
    }
    const stored = localData[CAPTION_POSITION_STORAGE_KEY];
    if (stored && typeof stored === "object") {
      await chrome.storage.sync.set({ [CAPTION_POSITION_STORAGE_KEY]: stored });
      return;
    }
    const legacyTop = Number(localData[LEGACY_CAPTION_TOP_RATIO_KEY]);
    if (Number.isFinite(legacyTop)) {
      await chrome.storage.sync.set({ [CAPTION_POSITION_STORAGE_KEY]: { x: 0.5, y: legacyTop } });
    }
  } catch {
    // Position migration is best-effort and should never block the extension.
  }
}

function buildPreloadMetadata(candidate, state, pageUrl) {
  return {
    title: firstUsefulTitle(state.page?.title, state.context?.title, candidate.title) || "",
    description: candidate.description || state.context?.description || "",
    pageLanguage: state.context?.language || "",
    channel: candidate.channel || candidate.uploader || candidate.creator || "",
    duration: candidate.duration || state.context?.duration || null,
    pageUrl,
    sourceUrl: candidate.url || ""
  };
}

async function refreshTabInfo(tabId) {
  if (!tabId) {
    return;
  }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) {
    return;
  }
  const state = getState(tabId);
  state.page = {
    title: tab.title || state.page?.title || "",
    url: tab.url || state.page?.url || "",
    favIconUrl: tab.favIconUrl || state.page?.favIconUrl || ""
  };
}

function updateTabContext(tabId, context, frameId = 0) {
  if (!tabId || !context) {
    return;
  }
  const state = getState(tabId);
  const current = state.context || {};
  const incomingFrameId = normalizeFrameId(frameId);
  const isMainFrame = incomingFrameId === 0;
  const incomingArea = (context.elementWidth || context.videoWidth || 0) * (context.elementHeight || context.videoHeight || 0);
  const currentArea = (current.elementWidth || current.videoWidth || 0) * (current.elementHeight || current.videoHeight || 0);
  const shouldReplaceMedia = context.hasMedia && (!current.hasMedia || incomingArea >= currentArea);
  const shouldUpdateTime = context.hasMedia && (shouldReplaceMedia || state.mediaFrameId === incomingFrameId || current.frameId === incomingFrameId);
  if (shouldReplaceMedia) {
    state.mediaFrameId = incomingFrameId;
  }
  state.context = {
    ...current,
    href: isMainFrame ? context.href || current.href || "" : current.href || "",
    title: isMainFrame ? context.title || current.title || "" : current.title || "",
    description: isMainFrame ? context.description || current.description || "" : current.description || "",
    language: isMainFrame ? context.language || current.language || "" : current.language || "",
    hasMedia: current.hasMedia || Boolean(context.hasMedia),
    duration: pickFinite(context.duration, current.duration),
    currentTime: shouldUpdateTime ? pickFinite(context.currentTime, current.currentTime) : current.currentTime,
    videoWidth: shouldReplaceMedia ? context.videoWidth || current.videoWidth || null : current.videoWidth || context.videoWidth || null,
    videoHeight: shouldReplaceMedia ? context.videoHeight || current.videoHeight || null : current.videoHeight || context.videoHeight || null,
    elementWidth: shouldReplaceMedia ? context.elementWidth || current.elementWidth || null : current.elementWidth || context.elementWidth || null,
    elementHeight: shouldReplaceMedia ? context.elementHeight || current.elementHeight || null : current.elementHeight || context.elementHeight || null,
    mediaTag: context.mediaTag || current.mediaTag || "",
    readyState: context.readyState || current.readyState || 0,
    frameId: shouldReplaceMedia ? incomingFrameId : current.frameId ?? incomingFrameId,
    seenAt: Date.now()
  };
}

function addPageMediaCandidate(tabId, media, frameId = 0) {
  if (!tabId || !media?.url) {
    return;
  }
  if (isIgnoredMediaUrl(media.url)) {
    return;
  }
  if (media.url.startsWith("blob:") || media.url.startsWith("data:")) {
    return;
  }
  const mediaFrameId = normalizeFrameId(frameId);
  if (media.source === "media-element") {
    getState(tabId).mediaFrameId = mediaFrameId;
  }
  const classification = classifyUrl(media.url) || { kind: media.kind || "media", ext: "" };
  addCandidate(tabId, {
    url: media.url,
    source: media.source || "page",
    kind: media.kind || classification.kind,
    ext: media.ext || classification.ext,
    title: media.title || "",
    initiator: media.href || "",
    duration: media.duration,
    contentType: media.contentType,
    size: media.size,
    videoWidth: media.videoWidth,
    videoHeight: media.videoHeight,
    bandwidth: media.bandwidth,
    qualityLabel: media.qualityLabel,
    playlistType: media.playlistType,
    frameId: mediaFrameId,
    seenAt: Date.now()
  });
}

function normalizeFrameId(value) {
  const frameId = Number(value);
  return Number.isInteger(frameId) && frameId >= 0 ? frameId : 0;
}

function addCandidate(tabId, candidate) {
  const state = getState(tabId);
  const safeCandidate = sanitizeCandidateRequestHeaders(candidate);
  const fingerprint = candidateFingerprint(safeCandidate);
  if (state.candidateFingerprints.has(fingerprint)) {
    state.candidates = state.candidates.map(item => {
      if (candidateFingerprint(item) !== fingerprint) {
        return item;
      }
      return mergeCandidate(item, safeCandidate);
    });
    return;
  }
  state.candidateFingerprints.add(fingerprint);
  state.candidates.unshift(safeCandidate);
  state.candidates = state.candidates.slice(0, MAX_CANDIDATES_PER_TAB);
}

function sanitizeCandidateRequestHeaders(candidate = {}) {
  return {
    ...candidate,
    requestHeaders: sanitizeInternalRequestHeaders(candidate.requestHeaders)
  };
}

function getDisplayCandidates(tabId) {
  const state = getState(tabId);
  return getGroupedCandidatesForState(state).map(stripCandidateRequestHeaders);
}

function setTabStatus(tabId, patch) {
  Object.assign(getState(tabId), patch);
}

function getState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      candidates: [],
      candidateFingerprints: new Set(),
      preload: "idle",
      error: "",
      page: {},
      context: {},
      attachedVttSignature: "",
      manualVttSignature: "",
      subtitleFrameId: null,
      lastPreloadCandidate: null
    });
  }
  return tabState.get(tabId);
}
