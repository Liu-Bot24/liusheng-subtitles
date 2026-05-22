const MESSAGE = {
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  ACTIVATE_PAGE: "FUGUANG_ACTIVATE_PAGE",
  START_PRELOAD: "FUGUANG_START_PRELOAD",
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
  WEB_FFMPEG_EXTRACT_AUDIO: "FUGUANG_WEB_FFMPEG_EXTRACT_AUDIO"
};

const DEFAULT_WEB_FFMPEG_PATH = "web-ffmpeg/index.html";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const MEDIA_HEADER_RULE_ID_BASE = 250000;
let nextMediaHeaderRuleId = 0;
const CAPTION_POSITION_STORAGE_KEY = "captionPosition";
const LEGACY_CAPTION_TOP_RATIO_KEY = "captionTopRatio";
const DEFAULT_MODEL_SETTINGS = {
  targetLanguage: "zh-CN",
  asrWorkers: 1,
  translationWorkers: 3,
  chunkMinutes: 15
};
const BROWSER_TRANSLATION_BATCH_SIZE = 60;
const BROWSER_TRANSLATION_TIMEOUT_MS = 90_000;
const BROWSER_ASR_MIN_TIMEOUT_MS = 180_000;
const BROWSER_ASR_MAX_TIMEOUT_MS = 20 * 60_000;
const BROWSER_ASR_TIMEOUT_PER_AUDIO_SECOND_MS = 1_250;
const BROWSER_ASR_UPLOAD_CHUNK_SECONDS = 30;
const ASR_HALLUCINATION_COMPRESSION_RATIO = 8;
const ASR_HALLUCINATION_NO_SPEECH_PROBABILITY = 0.75;
const ASR_REPEATED_RUN_MIN_COUNT = 4;
const ASR_REPEATED_RUN_MIN_TEXT_CHARS = 6;
const ASR_REPEATED_RUN_MIN_DURATION_SECONDS = 6;
const ASR_ADJACENT_DUPLICATE_MAX_GAP_SECONDS = 0.2;
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
const MODEL_SETTINGS_VERSION = 4;
const DEFAULT_ASR_PROFILE_ID = "openai_whisper";
const DEFAULT_LLM_PROFILE_ID = "llm_profile_1";
const KNOWN_ASR_PROFILES = [
  {
    id: "openai_whisper",
    name: "OpenAI Whisper",
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    apiKey: ""
  },
  {
    id: "groq_whisper",
    name: "Groq Whisper",
    providerType: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    apiKey: ""
  },
  {
    id: "xai_grok",
    name: "xAI Grok",
    providerType: "xai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-2-voice-1212",
    apiKey: ""
  },
  {
    id: "custom_asr",
    name: "自定义 ASR",
    providerType: "openai",
    baseUrl: "",
    model: "",
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
const MAX_CANDIDATES_PER_TAB = 80;
const requestHeadersById = new Map();
const browserPreloadJobs = new Map();

const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"]);
const MANIFEST_EXTENSIONS = new Set(["m3u8", "m3u", "mpd"]);
const MEDIA_EXTENSIONS = new Set([...AUDIO_EXTENSIONS, ...MANIFEST_EXTENSIONS, "mp4", "m4s", "ts", "webm"]);
const MEDIA_CONTENT_TYPES = [
  "audio/",
  "video/",
  "application/dash+xml",
  "application/m4s",
  "application/octet-stream",
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "application/mpegurl",
  "video/mp2t"
];
const ASR_AUDIO_IDEAL_MIN_BPS = 96_000;
const ASR_AUDIO_IDEAL_MAX_BPS = 160_000;
const ASR_AUDIO_ACCEPTABLE_LOW_BPS = 48_000;
const ASR_AUDIO_ACCEPTABLE_HIGH_BPS = 320_000;

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
    tabState.delete(details.tabId);
  }
});

chrome.webNavigation.onHistoryStateUpdated?.addListener(details => {
  if (details.frameId === 0) {
    tabState.delete(details.tabId);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  tabState.delete(tabId);
});

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
    case MESSAGE.WEB_FFMPEG_EXTRACT_AUDIO:
      return extractAudioWithWebFfmpeg(message.tabId, message.candidate);
    case MESSAGE.START_PRELOAD:
      return startPreload(message.tabId, message.candidate);
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
    default:
      return {};
  }
}

async function getStatus(tabId) {
  await refreshTabInfo(tabId);
  const state = getState(tabId);
  const webFfmpeg = await getWebFfmpegConfig();
  const preloadJob = refreshBrowserPreloadJobForStatus(state.preloadJob);
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

async function extractAudioWithWebFfmpeg(tabId, candidate) {
  if (!canUseWebFfmpegExtraction(candidate)) {
    throw new Error("当前媒体源暂时不能直接交给 Web FFmpeg。");
  }
  await ensureOffscreenDocument();
  const webFfmpeg = await getWebFfmpegConfig();
  const chunkConfig = await getChunkConfig();
  const state = getState(tabId);
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const pageUrl = candidate.pageUrl || state.page?.url || tab?.url || candidate.initiator || state.context?.href || "";
  const duration = pickFinite(candidate.duration, state.context?.duration);
  const response = await withMediaRequestHeaderRules(candidate.url, pageUrl, async () => chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO,
    tabId,
    webFfmpegUrl: webFfmpeg.url,
    sourceUrl: candidate.url,
    kind: candidate.kind || "",
    ext: candidate.ext || "",
    requestHeaders: candidate.requestHeaders || null,
    fileName: candidate.fileName || candidate.filename || filenameFromUrl(candidate.url),
    mime: candidate.contentType || candidate.mime || "",
    pageUrl,
    initiator: candidate.initiator || "",
    duration,
    chunkSeconds: chunkConfig.chunkSeconds
  }));
  if (!response?.ok) {
    throw new Error(response?.error || "Web FFmpeg 音频提取失败。");
  }
  return { result: response.result };
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

function canUseWebFfmpegDirectExtraction(candidate) {
  if (candidate?.kind === "hls" || candidate?.kind === "dash") {
    return false;
  }
  const ext = String(candidate?.ext || classifyUrl(candidate?.url)?.ext || "").toLowerCase();
  if (MANIFEST_EXTENSIONS.has(ext)) {
    return false;
  }
  return canUseWebFfmpegExtraction(candidate);
}

async function startPreload(tabId, candidate) {
  if (!candidate?.url) {
    throw new Error("请先选择一个媒体源。");
  }
  if (isIgnoredMediaUrl(candidate.url)) {
    throw new Error("这个候选是播放器占位媒体，不是真实视频源。请刷新候选列表后选择真实媒体。");
  }
  const state = getState(tabId);
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
  const modelConfig = await getModelConfig();
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const pageUrl = candidate.pageUrl || state.page?.url || tab?.url || candidate.initiator || state.context?.href || "";
  const metadata = buildPreloadMetadata(candidate, state, pageUrl);
  const payload = await startBrowserPreload(tabId, {
    ...candidate,
    pageUrl,
    chunkSeconds: modelConfig.chunkSeconds
  }, metadata, modelConfig);
  setTabStatus(tabId, {
    preload: payload.status || "queued",
    preloadJob: payload.job || null,
    error: "",
    attachedVttSignature: ""
  });
  setTabStatus(tabId, { lastPreloadCandidate: candidate });
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
    if (!(record.audioChunks || []).length) {
      throw createNoBrowserAudioChunksError(audio);
    }
    record.job.extract = {
      ...record.job.extract,
      status: "completed",
      progress: 100,
      chunkCount: record.audioChunks.length,
      availableSeconds: Math.round(Number(audio.duration || 0) || record.audioChunks.reduce((sum, chunk) => sum + (chunk.duration || 0), 0)),
      elapsedSeconds: elapsedSeconds(record.startedAt)
    };
    record.job.stage = "asr";
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
  const failed = record.job.translation.chunkStatuses.filter(item => item.stage === "failed").length;
  record.job.status = "completed";
  record.job.stage = failed ? "completed_with_warnings" : "completed";
  record.job.error = failed ? browserFailureSummary(record) : "";
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  publishBrowserPreloadJob(record);
  await attachBrowserJobVttIfReady(record);
  if (!failed) {
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
  }));
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
  record.job.stage = "extracting";
  publishBrowserPreloadJob(record);
  return record.job.extract;
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
  const logicalChunkSeconds = Math.max(
    1,
    Number(record.browserAsrChunkSeconds || browserAsrUploadChunkSeconds(record.modelConfig)) || BROWSER_ASR_UPLOAD_CHUNK_SECONDS
  );
  while (record.browserInternalChunkCursor < record.browserInternalAudioChunks.length) {
    const chunk = record.browserInternalAudioChunks[record.browserInternalChunkCursor];
    const pending = record.browserPendingLogicalChunk;
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
  const fileParts = normalizedParts.map(part => ({
    index: part.index,
    start: part.start,
    end: part.end,
    duration: part.duration,
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
    group = {
      index: groupIndex,
      start: groupIndex * segmentSeconds,
      end: Math.min((groupIndex + 1) * segmentSeconds, pickFinite(record.metadata?.duration, (groupIndex + 1) * segmentSeconds)),
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
    group.chunks.sort((left, right) => left.start - right.start || left.index - right.index);
    group.total += 1;
    group.start = Math.min(group.start, Number(chunk.start || group.start) || group.start);
    group.end = Math.max(group.end, Number(chunk.end || group.end) || group.end);
    record.browserAsrChunkToTranslationGroup.set(chunk.index, groupIndex);
  }
  return group;
}

function browserTranslationGroupIndex(record, chunk) {
  const segmentSeconds = browserTranslationSegmentSeconds(record);
  const start = Math.max(0, Number(chunk?.start || 0) || 0);
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
    error: "",
    message: `识别音频切片 ${group.completed}/${group.total}${group.failed ? ` · ${group.failed} 失败` : ""}`
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
    error: group.failed ? `有 ${group.failed} 个音频切片识别失败，先翻译可用原文。` : "",
    message: `原文 ${sourceSegments.length}${group.empty ? ` · 跳过 ${group.empty} 个无语音切片` : ""}`
  });
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
  return {
    index: Number.isInteger(Number(chunk?.index)) ? Number(chunk.index) : 0,
    start,
    end,
    duration,
    file: chunk?.file,
    bytes: Number(chunk?.bytes || chunk?.file?.bytes || 0) || 0
  };
}

function browserInternalAudioChunkSignature(chunk) {
  return [
    chunk.index,
    roundTime(chunk.start),
    roundTime(chunk.end),
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
    message: `识别音频切片 ${group.completed + 1}/${group.total}`
  });
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
    updateChunkStatus(record, chunk.index, {
      stage: "completed",
      status: "完成",
      translatedCount: translatedSegments.length,
      message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
    });
  } catch (error) {
    translatedSegments = sourceSegments.map(segment => ({ ...segment }));
    updateChunkStatus(record, chunk.index, {
      stage: "failed",
      status: "失败",
      translatedCount: translatedSegments.length,
      error: `翻译失败，已先显示原文：${error.message || String(error)}`
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

async function withMediaRequestHeaderRules(sourceUrl, pageUrl, task) {
  const rules = buildMediaHeaderRules(sourceUrl, pageUrl);
  if (!rules.length || !chrome.declarativeNetRequest?.updateSessionRules) {
    return task();
  }
  const ruleIds = rules.map(rule => rule.id);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
    addRules: rules
  });
  try {
    return await task();
  } finally {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds }).catch(() => {});
  }
}

function buildMediaHeaderRules(sourceUrl, pageUrl) {
  let source;
  let page;
  try {
    source = new URL(String(sourceUrl || ""));
    page = new URL(String(pageUrl || ""));
  } catch {
    return [];
  }
  if (!["http:", "https:"].includes(source.protocol) || !["http:", "https:"].includes(page.protocol)) {
    return [];
  }
  const requestHeaders = [
    { header: "referer", operation: "set", value: page.href },
    { header: "origin", operation: "set", value: page.origin }
  ];
  const id = MEDIA_HEADER_RULE_ID_BASE + (nextMediaHeaderRuleId = (nextMediaHeaderRuleId + 1) % 10000);
  return [{
    id,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders
    },
    condition: {
      requestDomains: [source.hostname],
      resourceTypes: ["xmlhttprequest", "media", "other"]
    }
  }];
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

async function transcribeBrowserAudioChunk(chunk, asrConfig) {
  const endpoint = browserAsrEndpoint(asrConfig);
  const timeoutMs = normalizeAsrTimeoutMs(asrConfig?.timeoutMs, chunk);
  const formData = new FormData();
  const fileName = chunk.file?.name || `chunk-${chunk.index + 1}.mp3`;
  const fileBuffer = await getBrowserAudioChunkBuffer(chunk.file);
  for (const [name, value] of browserAsrRequestFields(asrConfig, asrConfig.language || asrConfig.sourceLanguage || "")) {
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
  return normalizeAsrSegments(payload, chunk.start, chunk.end);
}

function normalizeAsrTimeoutMs(timeoutMs, chunk = {}) {
  const normalized = Number(timeoutMs);
  if (Number.isFinite(normalized) && normalized > 0) {
    return normalized;
  }
  const duration = pickFinite(
    chunk.duration,
    Number(chunk.end) - Number(chunk.start)
  );
  if (!duration) {
    return BROWSER_ASR_MIN_TIMEOUT_MS;
  }
  return Math.min(
    BROWSER_ASR_MAX_TIMEOUT_MS,
    Math.max(BROWSER_ASR_MIN_TIMEOUT_MS, Math.ceil(duration * BROWSER_ASR_TIMEOUT_PER_AUDIO_SECOND_MS))
  );
}

function formatAsrFetchError(error, endpoint) {
  const message = error?.message || String(error || "网络不可达");
  return `${endpoint} 无法连接（${message}）。请确认这台机器能访问该地址、服务端口已监听，并允许浏览器扩展发起请求。`;
}

function browserAsrRequestFields(asrConfig, rawLanguage = "") {
  const provider = normalizeProviderType(asrConfig?.providerType);
  const language = normalizeAsrLanguage(rawLanguage);
  if (provider === "xai") {
    const xaiLanguage = xaiAsrLanguage(language);
    return xaiLanguage ? [["format", "true"], ["language", xaiLanguage]] : [];
  }
  const fields = [
    ["model", asrConfig?.model || ""],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"]
  ];
  if (language) {
    fields.push(["language", language]);
  }
  return fields;
}

function browserAsrEndpoint(asrConfig) {
  const provider = normalizeProviderType(asrConfig?.providerType);
  const baseUrl = normalizeApiBaseUrl(asrConfig?.baseUrl || "");
  if (provider === "xai") {
    return `${baseUrl}/stt`;
  }
  return baseUrl.endsWith("/audio/transcriptions") ? baseUrl : `${baseUrl}/audio/transcriptions`;
}

function normalizeAsrLanguage(language) {
  const text = String(language || "").trim();
  if (!text) {
    return "";
  }
  const key = text.toLowerCase().replace("_", "-");
  const normalized = TARGET_LANGUAGE_ALIASES.get(key) || key;
  return normalized === "zh-CN" ? "zh" : normalized;
}

function xaiAsrLanguage(language) {
  const supported = new Set(["en", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "es", "ja", "ko", "hi", "th", "vi"]);
  return supported.has(language) ? language : "";
}

async function getBrowserAudioChunkBuffer(file) {
  if (file?.buffer instanceof ArrayBuffer) {
    return file.buffer;
  }
  if (Array.isArray(file?.parts) && file.parts.length) {
    const buffers = [];
    let totalBytes = 0;
    for (const part of file.parts) {
      const buffer = await getBrowserAudioChunkBuffer(part?.file || part);
      buffers.push(buffer);
      totalBytes += buffer.byteLength;
    }
    const output = new Uint8Array(totalBytes);
    let offset = 0;
    for (const buffer of buffers) {
      output.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    return output.buffer;
  }
  if (file?.cacheUrl) {
    const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
    const response = await cache.match(file.cacheUrl);
    if (!response) {
      throw new Error("浏览器内音频缓存已失效，请重新抽取音频。");
    }
    return response.arrayBuffer();
  }
  throw new Error("音频切片缺少可上传的数据。");
}

function normalizeAsrSegments(payload, offsetSeconds, chunkEndSeconds) {
  const segments = asrTimedSegmentsFromPayload(payload);
  const chunkStart = Number(offsetSeconds || 0) || 0;
  const chunkEnd = Number(chunkEndSeconds || 0) || 0;
  const timeOffset = asrSegmentsUseAbsoluteTime(segments, chunkStart, chunkEnd) ? 0 : chunkStart;
  const timedSegments = segments
    .map(segment => ({
      start: segment.start + timeOffset,
      end: segment.end + timeOffset,
      text: cleanVttText(segment.text || ""),
      rawSegment: segment.rawSegment || segment
    }))
    .filter(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start && segment.text)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const qualityFilteredSegments = timedSegments.filter(segment => !isAsrHallucinatedSegment(segment.rawSegment, segment.text));
  const output = filterAsrRepeatedRuns(qualityFilteredSegments)
    .map(({ rawSegment, ...segment }) => segment);

  if (output.length) {
    return output;
  }
  if (timedSegments.length && output.length !== timedSegments.length) {
    return [];
  }
  const text = cleanVttText(asrPayloadText(payload));
  if (!text) {
    return [];
  }
  throw new Error("语音识别结果没有 segment 或 word 时间戳，无法生成可用字幕。");
}

function asrTimedSegmentsFromPayload(payload) {
  const segmentItems = asrSegmentItemsFromPayload(payload);
  if (segmentItems.length) {
    return segmentItems;
  }
  return segmentsFromAsrWordItems(asrWordItemsFromPayload(payload));
}

function asrSegmentItemsFromPayload(payload) {
  const segments = [];
  for (const item of asrArrayItemsFromPayload(payload, ["segments", "results", "chunks"])) {
    const text = cleanVttText(item?.text || item?.transcript || "");
    const start = firstAsrNumber(item, ["start", "start_time"]);
    const end = firstAsrNumber(item, ["end", "end_time"]);
    if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) {
      segments.push({ start, end, text, rawSegment: item });
    }
  }
  return segments;
}

function asrWordItemsFromPayload(payload) {
  return asrArrayItemsFromPayload(payload, ["words", "word_timestamps"]);
}

function asrArrayItemsFromPayload(payload, keys) {
  const sources = [];
  if (payload && typeof payload === "object") {
    sources.push(payload);
    if (payload.result && typeof payload.result === "object") {
      sources.push(payload.result);
    }
  }
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value.filter(item => item && typeof item === "object");
      }
    }
  }
  return [];
}

function segmentsFromAsrWordItems(words) {
  const segments = [];
  let currentWords = [];
  let currentStart = null;
  let currentEnd = null;
  for (const word of words) {
    const text = cleanVttText(word?.word || word?.text || word?.token || "");
    const start = firstAsrNumber(word, ["start", "start_time"]);
    const end = firstAsrNumber(word, ["end", "end_time"]);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    if (currentStart === null) {
      currentStart = start;
    }
    const shouldFlush = currentWords.length > 0 && currentEnd !== null && (
      joinAsrWords(currentWords).length >= 32
      || start - currentEnd >= 0.8
      || end - currentStart >= 7.0
    );
    if (shouldFlush && currentStart !== null && currentEnd !== null) {
      segments.push({
        start: currentStart,
        end: currentEnd,
        text: joinAsrWords(currentWords),
        rawSegment: { words: currentWords }
      });
      currentWords = [];
      currentStart = start;
    }
    currentWords.push(text);
    currentEnd = end;
  }
  if (currentWords.length && currentStart !== null && currentEnd !== null) {
    segments.push({
      start: currentStart,
      end: currentEnd,
      text: joinAsrWords(currentWords),
      rawSegment: { words: currentWords }
    });
  }
  return segments;
}

function firstAsrNumber(payload, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload || {}, key)) {
      const value = Number(payload[key]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return NaN;
}

function joinAsrWords(words) {
  return words.some(containsCjk) ? words.join("") : words.join(" ");
}

function containsCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function asrPayloadText(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const text = payload.text || payload.result?.text;
  if (text) {
    return text;
  }
  return asrArrayItemsFromPayload(payload, ["segments", "results", "chunks", "words", "word_timestamps"])
    .map(item => item?.text || item?.transcript || item?.word || item?.token || "")
    .join(" ");
}

function isAsrHallucinatedSegment(rawSegment, text) {
  const normalizedText = normalizeAsrHallucinationText(text);
  if (normalizedText.length < ASR_REPEATED_RUN_MIN_TEXT_CHARS) {
    return false;
  }
  const noSpeechProbability = Number(rawSegment?.no_speech_prob);
  if (Number.isFinite(noSpeechProbability) && noSpeechProbability >= ASR_HALLUCINATION_NO_SPEECH_PROBABILITY) {
    return true;
  }
  const compressionRatio = Number(rawSegment?.compression_ratio);
  return Number.isFinite(compressionRatio) && compressionRatio >= ASR_HALLUCINATION_COMPRESSION_RATIO;
}

function filterAsrRepeatedRuns(segments) {
  const output = [];
  for (let index = 0; index < segments.length;) {
    const key = normalizeAsrHallucinationText(segments[index]?.text);
    let nextIndex = index + 1;
    while (nextIndex < segments.length && key && normalizeAsrHallucinationText(segments[nextIndex]?.text) === key) {
      nextIndex += 1;
    }
    const run = segments.slice(index, nextIndex);
    if (!isAsrRepeatedRunHallucination(key, run)) {
      output.push(...run);
    }
    index = nextIndex;
  }
  return output;
}

function isAsrRepeatedRunHallucination(key, run) {
  if (!key || key.length < ASR_REPEATED_RUN_MIN_TEXT_CHARS || run.length < ASR_REPEATED_RUN_MIN_COUNT) {
    return false;
  }
  const duration = run.reduce((sum, segment) => sum + Math.max(0, Number(segment.end) - Number(segment.start)), 0);
  return duration >= ASR_REPEATED_RUN_MIN_DURATION_SECONDS;
}

function normalizeAsrHallucinationText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s,.!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—-]+/g, "");
}

function asrSegmentsUseAbsoluteTime(segments, chunkStart, chunkEnd) {
  if (!chunkStart || !Array.isArray(segments) || !segments.length) {
    return false;
  }
  const firstTimedSegment = segments.find(segment => Number.isFinite(Number(segment?.start)) && Number.isFinite(Number(segment?.end)));
  if (!firstTimedSegment) {
    return false;
  }
  const firstStart = Number(firstTimedSegment.start);
  const firstEnd = Number(firstTimedSegment.end);
  const tolerance = 1;
  if (firstStart < chunkStart - tolerance) {
    return false;
  }
  if (Number.isFinite(chunkEnd) && chunkEnd > chunkStart && firstStart > chunkEnd + tolerance) {
    return false;
  }
  return firstEnd > firstStart;
}

async function translateBrowserSegments(sourceSegments, llmConfig, targetLanguage, metadata, options = {}) {
  const batches = splitSegmentsForBrowserTranslation(sourceSegments, BROWSER_TRANSLATION_BATCH_SIZE);
  const translated = [];
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    options.onProgress?.({
      batchIndex: batchIndex + 1,
      batchTotal: batches.length,
      segmentCount: batches[batchIndex].length
    });
    const batchTranslated = await translateBrowserSegmentsBatch(
      batches[batchIndex],
      llmConfig,
      targetLanguage,
      metadata,
      options
    );
    translated.push(...batchTranslated);
  }
  return translated;
}

async function translateBrowserSegmentsBatch(sourceSegments, llmConfig, targetLanguage, metadata, options = {}) {
  const provider = normalizeProviderType(llmConfig.providerType);
  const messages = buildTranslationMessages(sourceSegments, targetLanguage, metadata);
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  try {
    const request = provider === "anthropic"
      ? requestAnthropicMessage(llmConfig, messages, options)
      : requestOpenAiCompatibleChat(llmConfig, messages, options);
    const content = await withPromiseTimeout(request, timeoutMs, "翻译模型请求超时");
    const json = parseModelJson(content);
    const items = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.translated_transcript)
        ? json.translated_transcript
        : [];
    if (!items.length) {
      throw new Error("翻译模型没有返回可用字幕条目。");
    }
    return alignTranslatedSegments(sourceSegments, items);
  } catch (error) {
    if (sourceSegments.length <= 1 || browserTranslationErrorIsPermanent(error)) {
      throw error;
    }
    const midpoint = Math.ceil(sourceSegments.length / 2);
    const left = await translateBrowserSegmentsBatch(sourceSegments.slice(0, midpoint), llmConfig, targetLanguage, metadata, options);
    const right = await translateBrowserSegmentsBatch(sourceSegments.slice(midpoint), llmConfig, targetLanguage, metadata, options);
    return [...left, ...right];
  }
}

function splitSegmentsForBrowserTranslation(sourceSegments, batchSize) {
  const size = Math.max(1, Number(batchSize) || 1);
  const batches = [];
  for (let index = 0; index < sourceSegments.length; index += size) {
    batches.push(sourceSegments.slice(index, index + size));
  }
  return batches;
}

function buildTranslationMessages(sourceSegments, targetLanguage, metadata) {
  const targetCode = normalizeTargetLanguage(targetLanguage);
  const targetName = targetLanguageName(targetCode);
  const context = {
    title: metadata?.title || "",
    description: metadata?.description || "",
    pageLanguage: metadata?.pageLanguage || "",
    channel: metadata?.channel || "",
    duration: metadata?.duration || null,
    pageUrl: metadata?.pageUrl || ""
  };
  return [
    {
      role: "system",
      content: [
        `你是专业字幕翻译器。把每一条字幕翻译成自然、口语化、适合视频字幕的 ${targetName}。`,
        "只返回一个合法 JSON 对象，不要 Markdown，不要解释，不要额外字段。",
        "输出格式必须是 {\"items\":[{\"i\":0,\"text\":\"译文\"}]}。",
        "items 数量必须与输入 segments 完全一致，i 必须逐条对应，顺序必须保持不变。",
        "不要合并、拆分、省略、总结字幕；不要把原语言文本留在译文里，除非它是人名、品牌名、网址、代码或明确应保留的专有名词。",
        "如果原文已经是目标语言，也要润色为自然字幕，而不是混入其他语言。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        targetLanguage: {
          code: targetCode,
          name: targetName
        },
        context,
        segments: sourceSegments.map((segment, index) => ({
          i: index,
          start: roundTime(segment.start),
          end: roundTime(segment.end),
          text: segment.text
        }))
      })
    }
  ];
}

async function requestOpenAiCompatibleChat(config, messages, options = {}) {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const { response, payload } = await fetchJsonWithTimeout(`${normalizeApiBaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" }
    })
  }, timeoutMs, "翻译模型");
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `翻译模型返回 HTTP ${response.status}`);
  }
  return payload.choices?.[0]?.message?.content || "";
}

async function requestAnthropicMessage(config, messages, options = {}) {
  const system = messages.find(message => message.role === "system")?.content || "";
  const user = messages.filter(message => message.role !== "system");
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const { response, payload } = await fetchJsonWithTimeout(`${normalizeApiBaseUrl(config.baseUrl)}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      temperature: 0.1,
      system,
      messages: user
    })
  }, timeoutMs, "翻译模型");
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `翻译模型返回 HTTP ${response.status}`);
  }
  return (payload.content || []).map(item => item.text || "").join("\n");
}

function normalizeTimeoutMs(timeoutMs) {
  const normalized = Number(timeoutMs);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : BROWSER_TRANSLATION_TIMEOUT_MS;
}

async function withPromiseTimeout(promise, timeoutMs, label) {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}（${Math.round(timeoutMs / 1000)} 秒）`));
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url, init, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${label}请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function browserTranslationErrorIsPermanent(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return /(401|403|404|unauthorized|forbidden|invalid api key|api key|quota|rate limit|不存在的模型|模型不存在)/.test(message);
}

function parseModelJson(content) {
  const text = String(content || "").trim().replace(/^```(?:json)?|```$/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("模型返回的 JSON 无法自动修复。");
    }
    return JSON.parse(match[0]);
  }
}

function alignTranslatedSegments(sourceSegments, items) {
  const byIndex = new Map();
  items.forEach((item, position) => {
    const index = Number.isInteger(Number(item.i)) ? Number(item.i) : position;
    byIndex.set(index, cleanVttText(item.text || item.translation || item.translated || ""));
  });
  return sourceSegments.map((segment, index) => ({
    start: segment.start,
    end: segment.end,
    chunkIndex: segment.chunkIndex,
    segmentIndex: segment.segmentIndex,
    text: byIndex.get(index) || segment.text
  }));
}

function normalizeBrowserSourceSegmentsForTranslation(segments, chunkIndex) {
  const usableSegments = (segments || [])
    .filter(isUsableTimedTextSegment)
    .map(segment => ({
      ...segment,
      start: Number(segment.start),
      end: Number(segment.end),
      text: cleanVttText(segment.text || "")
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  return tagSegmentsWithChunkOrder(mergeAdjacentDuplicateAsrSegments(usableSegments), chunkIndex);
}

function isUsableTimedTextSegment(segment) {
  const start = Number(segment?.start);
  const end = Number(segment?.end);
  const text = cleanVttText(segment?.text || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start && Boolean(text);
}

function mergeAdjacentDuplicateAsrSegments(segments) {
  const merged = [];
  for (const segment of segments || []) {
    const previous = merged[merged.length - 1];
    if (previous && canMergeAdjacentDuplicateAsrSegment(previous, segment)) {
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}

function canMergeAdjacentDuplicateAsrSegment(previous, current) {
  const previousText = normalizedAsrDuplicateText(previous?.text);
  const currentText = normalizedAsrDuplicateText(current?.text);
  if (!previousText || previousText !== currentText) {
    return false;
  }
  const gap = Number(current?.start) - Number(previous?.end);
  return Number.isFinite(gap) && gap >= -0.05 && gap <= ASR_ADJACENT_DUPLICATE_MAX_GAP_SECONDS;
}

function normalizedAsrDuplicateText(text) {
  return cleanVttText(text || "").replace(/\s+/g, " ").trim();
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
  const completed = statuses.filter(item => ["completed", "failed"].includes(item.stage)).length;
  const failed = statuses.filter(item => item.stage === "failed").length;
  const asrRunning = statuses.filter(item => item.stage === "asr").length;
  const translating = statuses.filter(item => item.stage === "translation").length;
  record.job.translation.chunksDone = completed;
  record.job.translation.chunksFailed = failed;
  record.job.translation.failed = failed;
  record.job.translation.chunksAsr = asrRunning;
  record.job.translation.asrRunning = asrRunning;
  record.job.translation.chunksTranslating = translating;
  record.job.translation.translationRunning = translating;
  publishBrowserPreloadJob(record);
}

function publishBrowserSubtitle(record) {
  const source = collectChunkSegments(record.sourceSegmentsByChunk);
  const translated = collectChunkSegments(record.translatedSegmentsByChunk);
  const display = translated.length ? translated : source;
  record.job.translation.sourceSegments = source.length;
  record.job.translation.translatedSegments = translated.length;
  record.job.translation.segmentCount = display.length;
  record.job.translation.vttPath = display.length ? "browser-memory" : "";
  record.job.translation.vttText = display.length ? segmentsToVtt(display) : "";
  record.job.translation.transcript = { source, translated, metadata: record.metadata };
  publishBrowserPreloadJob(record);
  attachBrowserJobVttIfReady(record).catch(() => {});
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
  if (hasManualVttAttachment(record.tabId)) {
    return;
  }
  if (isPreloadSubtitleAttachmentSuppressed(record.tabId, record.job.id)) {
    return;
  }
  const attachment = await buildBrowserVttAttachment(record.job);
  const signature = `${record.job.id}:${record.job.translation.segmentCount}:${record.job.translation.chunksDone}:${attachment.mode}`;
  const state = getState(record.tabId);
  if (state.attachedVttSignature === signature) {
    return;
  }
  await ensureSubtitleOverlay(record.tabId);
  const response = await sendMessageToMediaFrame(record.tabId, {
    type: MESSAGE.ATTACH_VTT,
    vtt: attachment.vtt,
    label: "浮光译影"
  });
  if (response?.ok) {
    state.attachedVttSignature = signature;
    state.manualVttSignature = "";
  }
}

async function buildBrowserVttAttachment(job) {
  const mode = await getSubtitleDisplayMode();
  if (mode === "bilingual") {
    const bilingual = transcriptToBilingualVtt(job.translation?.transcript);
    if (bilingual) {
      return { mode, vtt: bilingual };
    }
  }
  return { mode: "translated", vtt: job.translation?.vttText || "" };
}

function publishBrowserPreloadJob(record) {
  record.job.updatedAt = Date.now();
  record.job.extract.elapsedSeconds = elapsedSeconds(record.startedAt);
  record.job.reusableAudioChunks = (record.audioChunks || []).length;
  record.job.reusableSourceChunks = record.sourceSegmentsByChunk?.size || 0;
  record.job.translation.reusableAudioChunks = record.job.reusableAudioChunks;
  record.job.translation.reusableSourceChunks = record.job.reusableSourceChunks;
  record.job.progress = browserJobProgress(record.job);
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

function normalizeTargetLanguage(value) {
  const text = String(value || "").trim();
  if (!text) {
    return DEFAULT_MODEL_SETTINGS.targetLanguage;
  }
  const key = text.toLowerCase().replace("_", "-");
  return TARGET_LANGUAGE_ALIASES.get(key) || DEFAULT_MODEL_SETTINGS.targetLanguage;
}

function targetLanguageName(value) {
  const normalized = normalizeTargetLanguage(value);
  return TARGET_LANGUAGE_NAMES.get(normalized) || TARGET_LANGUAGE_NAMES.get(DEFAULT_MODEL_SETTINGS.targetLanguage);
}

function browserAsrUploadChunkSeconds(modelConfig = {}) {
  const configured = Number(modelConfig.asrUploadChunkSeconds || BROWSER_ASR_UPLOAD_CHUNK_SECONDS);
  const seconds = Number.isFinite(configured) && configured > 0
    ? configured
    : BROWSER_ASR_UPLOAD_CHUNK_SECONDS;
  return Math.max(10, Math.min(60, Math.floor(seconds)));
}

function browserTranslationSegmentSeconds(record) {
  const seconds = Number(record?.modelConfig?.chunkSeconds || DEFAULT_MODEL_SETTINGS.chunkMinutes * 60);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_MODEL_SETTINGS.chunkMinutes * 60;
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
  throw new Error("这个任务不是当前浏览器内预加载任务，不能重试失败识别分段。请重新抽取。");
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
  throw new Error("这个任务不是当前浏览器内预加载任务，不能只重翻译。请重新抽取。");
}

async function retryBrowserFailedPreload(record, chunkIndexes = []) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const requested = new Set(Array.isArray(chunkIndexes) ? chunkIndexes.map(Number) : []);
  const retryIndexes = collectBrowserRetryIndexes(record, requested);
  if (!retryIndexes.length) {
    throw new Error("当前任务没有可继续处理的识别分段。");
  }
  const sourceRetryIndexes = retryIndexes.filter(index => reusableBrowserSourceSegments(record, index).length);
  const asrRetryIndexes = retryIndexes.filter(index => !sourceRetryIndexes.includes(index));
  const asrRetryHasAudio = asrRetryIndexes.every(index => browserAudioChunksForTranslationGroup(record, index).length);
  if (asrRetryIndexes.length && !asrRetryHasAudio) {
    throw new Error("浏览器内任务没有保留可继续识别的音频切片，请重新开始任务。");
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
  const failed = record.job.translation.chunkStatuses.filter(item => item.stage === "failed").length;
  record.job.status = "completed";
  record.job.stage = failed ? "completed_with_warnings" : "completed";
  record.job.error = failed ? browserFailureSummary(record) : "";
  publishBrowserPreloadJob(record);
  if (!failed) {
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
      if (status.stage === "completed" && reusableBrowserSourceSegments(record, index).length) {
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
    throw new Error(`第 ${index + 1} 个识别分段没有可复用的音频切片。`);
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
    message: `第 ${attempt} 次尝试 · 重新识别 ${chunks.length} 个音频切片`
  });
  await runPool(chunks, Math.max(record.modelConfig.asrWorkers || 1, 1), async chunk => {
    const ordinal = chunks.findIndex(item => item.index === chunk.index) + 1;
    updateChunkStatus(record, index, {
      stage: "asr",
      status: "识别",
      attempts: attempt,
      sourceCount: sourceSegments.length,
      error: "",
      message: `第 ${attempt} 次尝试 · 识别音频切片 ${ordinal}/${chunks.length}`
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
      message: empty ? `无语音 · 跳过 ${empty} 个音频切片` : "无语音"
    });
    publishBrowserSubtitle(record);
    return;
  }
  const suffix = errors.length
    ? `重试识别后翻译，${errors.length} 个音频切片失败，先用可用原文`
    : "重试识别后翻译";
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
  const failed = record.job.translation.chunkStatuses.filter(item => item.stage === "failed").length;
  record.job.status = "completed";
  record.job.stage = failed ? "completed_with_warnings" : "completed";
  record.job.error = failed ? browserFailureSummary(record) : "";
  publishBrowserPreloadJob(record);
  return { preload: record.job.status, job: record.job };
}

function reusableBrowserSourceSegments(record, index) {
  const segments = record?.sourceSegmentsByChunk?.get(Number(index));
  return Array.isArray(segments) ? segments : [];
}

async function translateBrowserChunkFromSource(record, index, sourceSegments, message) {
  const statuses = record.job.translation?.chunkStatuses || [];
  const current = statuses[index] || {};
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
      translatedSegments = sourceSegments.map(segment => ({ ...segment }));
      record.translatedSegmentsByChunk.set(index, translatedSegments);
    }
    updateChunkStatus(record, index, {
      stage: "failed",
      status: "失败",
      sourceCount: sourceSegments.length,
      translatedCount: translatedSegments.length,
      error: `重翻译失败，已保留已有字幕：${error.message || String(error)}`
    });
    publishBrowserSubtitle(record);
    return;
  }
  record.translatedSegmentsByChunk.set(index, translatedSegments);
  updateChunkStatus(record, index, {
    stage: "completed",
    status: "完成",
    sourceCount: sourceSegments.length,
    translatedCount: translatedSegments.length,
    message: `原文 ${sourceSegments.length} · 译文 ${translatedSegments.length}`
  });
  publishBrowserSubtitle(record);
}

function countFailedChunks(job) {
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || [];
  if (!Array.isArray(statuses)) {
    return 0;
  }
  return statuses.filter(status => status?.stage === "failed").length;
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

async function clearBrowserAudioChunkCache(chunks = []) {
  const cacheUrls = collectBrowserAudioCacheUrls(chunks);
  if (!cacheUrls.size) {
    return 0;
  }
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
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
  if (state.attachedVttSignature === signature && state.manualVttSignature === signature) {
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
    label: "浮光译影"
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

function transcriptToBilingualVtt(transcript) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
  const total = Math.max(source.length, translated.length);
  const blocks = ["WEBVTT", ""];
  for (let index = 0; index < total; index += 1) {
    const sourceSegment = source[index] || {};
    const translatedSegment = translated[index] || {};
    const start = firstFiniteNumber(translatedSegment.start, sourceSegment.start);
    const end = firstFiniteNumber(translatedSegment.end, sourceSegment.end);
    const translatedText = cleanVttText(translatedSegment.text || sourceSegment.text);
    const sourceText = cleanVttText(sourceSegment.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || !translatedText) {
      continue;
    }
    const lines = [];
    if (sourceText && sourceText !== translatedText) {
      lines.push(sourceText);
    }
    lines.push(translatedText);
    blocks.push(`${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`);
    blocks.push(lines.join("\n"));
    blocks.push("");
  }
  return blocks.length > 2 ? blocks.join("\n") : "";
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
  if (state.subtitleOverlayInjectedAt && now - state.subtitleOverlayInjectedAt < 3000) {
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
  const defaultUrl = getDefaultWebFfmpegUrl();
  const data = await chrome.storage.sync.get({
    webFfmpegUrl: defaultUrl
  });
  return {
    url: normalizeWebFfmpegUrl(data.webFfmpegUrl || defaultUrl)
  };
}

function normalizeWebFfmpegUrl(value) {
  const defaultUrl = getDefaultWebFfmpegUrl();
  try {
    const raw = String(value || defaultUrl);
    const url = new URL(raw);
    if (url.hostname === "ffmpeg.liu-qi.cn") {
      return defaultUrl;
    }
    if (!["https:", "http:", "chrome-extension:"].includes(url.protocol)) {
      return defaultUrl;
    }
    if (url.protocol === "chrome-extension:" && url.origin !== chrome.runtime.getURL("").replace(/\/$/, "")) {
      return defaultUrl;
    }
    return url.href;
  } catch {
    return defaultUrl;
  }
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
  const [localStored, legacyStored] = await Promise.all([
    chrome.storage.local.get(null),
    chrome.storage.sync.get([
      "asrApiKey",
      "llmApiKey",
      "asrBaseUrl",
      "asrModel",
      "llmBaseUrl",
      "llmModel",
      "llmProviderType"
    ])
  ]);
  const stored = { ...legacyStored, ...localStored };
  const asrProfiles = normalizeStoredProfiles("asr", localStored.asrProfiles);
  const llmProfiles = normalizeStoredProfiles("llm", localStored.llmProfiles);
  applyLegacyModelSettings(asrProfiles, llmProfiles, stored);
  const selectedAsrId = normalizeSelectedProfileId(
    asrProfiles,
    localStored.selectedAsrProfileId || legacyAsrProfileId(stored) || DEFAULT_ASR_PROFILE_ID,
    DEFAULT_ASR_PROFILE_ID
  );
  const selectedLlmId = normalizeSelectedProfileId(
    llmProfiles,
    localStored.selectedLlmProfileId || legacyLlmProfileId(stored) || DEFAULT_LLM_PROFILE_ID,
    DEFAULT_LLM_PROFILE_ID
  );
  const selectedAsr = findProfile(asrProfiles, selectedAsrId, DEFAULT_ASR_PROFILE_ID);
  const selectedLlm = findProfile(llmProfiles, selectedLlmId, DEFAULT_LLM_PROFILE_ID);
  persistMigratedModelSettings(stored, asrProfiles, llmProfiles, selectedAsrId, selectedLlmId);
  validateSelectedModelProfiles(selectedAsr, selectedLlm);
  const migratedWorkerDefaults = localStored.modelSettingsVersion !== MODEL_SETTINGS_VERSION;
  return {
    asr: compactProviderConfig(selectedAsr),
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

async function getChunkConfig() {
  const stored = await chrome.storage.local.get(["chunkMinutes"]);
  const chunkMinutes = clampInteger(stored.chunkMinutes, 1, 60, DEFAULT_MODEL_SETTINGS.chunkMinutes);
  return {
    chunkMinutes,
    chunkSeconds: chunkMinutes * 60
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

function findProfile(profiles, selectedId, fallbackId) {
  return profiles.find(profile => profile.id === selectedId) ||
    profiles.find(profile => profile.id === fallbackId) ||
    profiles[0] ||
    {};
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

function normalizeStoredProfiles(kind, storedProfiles) {
  const profilesById = new Map(defaultProfiles(kind).map(profile => [profile.id, profile]));
  for (const rawProfile of Array.isArray(storedProfiles) ? storedProfiles : []) {
    if (isDeprecatedRawProfile(kind, rawProfile)) {
      continue;
    }
    const profile = normalizeProfile(rawProfile);
    if (!profile.id) {
      continue;
    }
    if (isDeprecatedProfile(kind, profile)) {
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
    apiKey: String(rawProfile.apiKey || rawProfile.api_key || "").trim()
  };
}

function normalizeProviderType(providerType) {
  const value = String(providerType || "").trim();
  return ["openai", "groq", "xai", "anthropic"].includes(value) ? value : "openai";
}

function isDeprecatedProfile(kind, profile) {
  return kind === "asr" && (profile.id === "local_whisper" || profile.providerType === "local_whisper");
}

function isDeprecatedRawProfile(kind, rawProfile = {}) {
  return kind === "asr" &&
    (String(rawProfile.id || "").trim() === "local_whisper" ||
      String(rawProfile.providerType || rawProfile.provider_type || "").trim() === "local_whisper");
}

function mergeProfileDefaults(defaultProfile, storedProfile) {
  return {
    id: storedProfile.id || defaultProfile.id,
    name: storedProfile.name || defaultProfile.name || "",
    providerType: storedProfile.providerType || defaultProfile.providerType || "openai",
    baseUrl: storedProfile.baseUrl || defaultProfile.baseUrl || "",
    model: storedProfile.model || defaultProfile.model || "",
    apiKey: storedProfile.apiKey || defaultProfile.apiKey || ""
  };
}

function hasProfileContent(profile) {
  if (profile.id === DEFAULT_LLM_PROFILE_ID && !profile.apiKey && !profile.baseUrl && !profile.model) {
    return false;
  }
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
    apiKey: profile.apiKey || ""
  };
}

function ensureProfile(profiles, kind, profileId) {
  let profile = profiles.find(item => item.id === profileId);
  if (profile) {
    return profile;
  }
  const knownProfile = knownProfileDefaults(kind).find(item => item.id === profileId);
  profile = knownProfile ? cloneProfile(knownProfile) : {
    id: profileId || `${kind}_profile_${Date.now()}`,
    name: "",
    providerType: "openai",
    baseUrl: "",
    model: "",
    apiKey: ""
  };
  profiles.push(profile);
  return profile;
}

function compactProviderConfig(config) {
  const output = {};
  for (const [key, value] of Object.entries(config || {})) {
    if (key === "id" || key === "name") {
      continue;
    }
    if (value !== undefined && value !== null && String(value).trim()) {
      output[key] = String(value).trim();
    }
  }
  return output;
}

function applyLegacyModelSettings(asrProfiles, llmProfiles, stored) {
  if (stored.asrApiKey || stored.asrBaseUrl || stored.asrModel) {
    const target = ensureProfile(asrProfiles, "asr", legacyAsrProfileId(stored) || "openai_whisper");
    target.baseUrl = stored.asrBaseUrl || target.baseUrl;
    target.model = stored.asrModel || target.model;
    target.apiKey = stored.asrApiKey || target.apiKey;
  }
  if (stored.llmApiKey || stored.llmBaseUrl || stored.llmModel) {
    const target = ensureProfile(llmProfiles, "llm", legacyLlmProfileId(stored) || DEFAULT_LLM_PROFILE_ID);
    target.providerType = stored.llmProviderType || target.providerType;
    target.baseUrl = stored.llmBaseUrl || target.baseUrl;
    target.model = stored.llmModel || target.model;
    target.apiKey = stored.llmApiKey || target.apiKey;
  }
}

function profileById(profiles, id) {
  return profiles.find(profile => profile.id === id) || profiles[0] || {};
}

function legacyAsrProfileId(stored) {
  if (!stored.asrApiKey && !stored.asrBaseUrl && !stored.asrModel) {
    return "";
  }
  const text = `${stored.asrBaseUrl || ""} ${stored.asrModel || ""}`.toLowerCase();
  if (text.includes("groq.com")) {
    return "groq_whisper";
  }
  if (text.includes("api.x.ai") || text.includes("grok")) {
    return "xai_grok";
  }
  return "openai_whisper";
}

function legacyLlmProfileId(stored) {
  if (!stored.llmApiKey && !stored.llmBaseUrl && !stored.llmModel) {
    return "";
  }
  const provider = String(stored.llmProviderType || "").toLowerCase();
  const text = `${stored.llmBaseUrl || ""} ${stored.llmModel || ""}`.toLowerCase();
  if (provider === "anthropic" || text.includes("anthropic")) {
    return "anthropic";
  }
  if (text.includes("deepseek")) {
    return text.includes("siliconflow") || text.includes("deepseek-ai/deepseek-v3.2")
      ? "custom_llm"
      : "openai_custom";
  }
  if (text.includes("hunyuan")) {
    return "siliconflow_hunyuan_mt_7b";
  }
  if (text.includes("example") || text.includes("llm")) {
    return "llm";
  }
  return "openai_custom";
}

function persistMigratedModelSettings(stored, asrProfiles, llmProfiles, selectedAsrId, selectedLlmId) {
  const hasLegacyModelFields = Boolean(
    stored.asrApiKey ||
      stored.asrBaseUrl ||
      stored.asrModel ||
      stored.llmApiKey ||
      stored.llmBaseUrl ||
      stored.llmModel
  );
  const needsVersionMigration = stored.modelSettingsVersion !== MODEL_SETTINGS_VERSION;
  const needsSelectionMigration =
    stored.selectedAsrProfileId !== selectedAsrId || stored.selectedLlmProfileId !== selectedLlmId;
  if (!hasLegacyModelFields && !needsVersionMigration && !needsSelectionMigration) {
    return;
  }
  chrome.storage.local.set({
    selectedAsrProfileId: selectedAsrId,
    selectedLlmProfileId: selectedLlmId,
    modelSettingsVersion: MODEL_SETTINGS_VERSION,
    asrProfiles,
    llmProfiles
  }).catch(() => {});
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

function formatErrorDetail(message = "") {
  const text = String(message || "").trim();
  if (!text) {
    return "未知错误";
  }
  if (/failed to fetch/i.test(text)) {
    return "请求失败，通常是网络不可达、接口地址不正确，或浏览器阻止了连接。";
  }
  if (/load failed/i.test(text)) {
    return "请求加载失败，请确认接口地址和网络状态。";
  }
  return text;
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
  const fingerprint = `${candidate.kind}:${candidate.url}`;
  if (state.candidateFingerprints.has(fingerprint)) {
    state.candidates = state.candidates.map(item => {
      if (`${item.kind}:${item.url}` !== fingerprint) {
        return item;
      }
      return mergeCandidate(item, candidate);
    });
    return;
  }
  state.candidateFingerprints.add(fingerprint);
  state.candidates.unshift(candidate);
  state.candidates = state.candidates.slice(0, MAX_CANDIDATES_PER_TAB);
}

function mergeCandidate(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "requestHeaders" || key === "responseHeaders") {
      continue;
    }
    if (shouldUseIncomingCandidateField(key, value, merged[key])) {
      merged[key] = value;
    }
  }
  return {
    ...merged,
    requestHeaders: {
      ...(existing.requestHeaders || {}),
      ...(incoming.requestHeaders || {})
    },
    responseHeaders: {
      ...(existing.responseHeaders || {}),
      ...(incoming.responseHeaders || {})
    },
    firstSeenAt: existing.firstSeenAt || existing.seenAt,
    seenAt: incoming.seenAt || Date.now()
  };
}

function shouldUseIncomingCandidateField(key, value, existingValue) {
  if (key === "seenAt") {
    return true;
  }
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string" && !value.trim()) {
    return false;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return false;
  }
  if (["duration", "size", "videoWidth", "videoHeight", "bandwidth"].includes(key)) {
    return Number(value) > 0;
  }
  if (key === "source") {
    return candidateSourceRank(value) >= candidateSourceRank(existingValue);
  }
  return true;
}

function candidateSourceRank(source) {
  return {
    "media-element": 8,
    "json-parse": 7,
    "xhr-body": 6,
    response: 5,
    request: 4,
    "request-headers": 3,
    "performance-entry": 2,
    page: 1
  }[source] || 0;
}

function getCandidates(tabId) {
  return getState(tabId).candidates || [];
}

function getDisplayCandidates(tabId) {
  const state = getState(tabId);
  return groupCandidatesForAsr(
    getCandidates(tabId)
      .filter(candidate => !isIgnoredMediaUrl(candidate.url))
      .map(candidate => enrichCandidate(candidate, state))
  );
}

function enrichCandidate(candidate, state) {
  const urlInfo = parseUrlInfo(candidate.url);
  const responseHeaders = candidate.responseHeaders || {};
  const contentType = normalizeContentType(candidate.contentType || responseHeaders.type || "");
  const size = Number(responseHeaders.size || candidate.size || 0) || 0;
  const inheritDuration = shouldInheritPageDuration(candidate, contentType, urlInfo, state);
  const inheritDimensions = shouldInheritPageDimensions(candidate, contentType, urlInfo);
  const pageTitle = pickCandidateDisplayTitle(candidate, state);
  const pageUrl = pickCandidatePageUrl(candidate, state);
  const duration = pickFinite(candidate.duration, inheritDuration ? state.context?.duration : null);
  const videoWidth = Number(candidate.videoWidth || (inheritDimensions ? state.context?.videoWidth : 0) || 0) || null;
  const videoHeight = Number(candidate.videoHeight || (inheritDimensions ? state.context?.videoHeight : 0) || 0) || null;
  const resolution = videoWidth && videoHeight ? `${videoWidth}x${videoHeight}` : "";
  const role = inferMediaRole(candidate, contentType, urlInfo, videoWidth, videoHeight);
  const quality = inferQuality(candidate.url, videoWidth, videoHeight);
  if (candidate.bandwidth) {
    quality.bandwidth = Number(candidate.bandwidth);
  }
  if (candidate.qualityLabel) {
    quality.label = candidate.qualityLabel;
  }
  return {
    ...candidate,
    pageUrl,
    title: pageTitle,
    filename: candidate.filename || urlInfo.filename,
    origin: urlInfo.origin,
    contentType,
    size,
    duration,
    videoWidth,
    videoHeight,
    resolution,
    role,
    quality,
    asrScore: scoreCandidateForAsr(candidate, role, quality, size, duration)
  };
}

function pickCandidateDisplayTitle(candidate, state) {
  return firstUsefulTitle(
    state.page?.title,
    state.context?.title,
    candidate.title
  );
}

function pickCandidatePageUrl(candidate, state) {
  return (
    state.page?.url ||
    state.context?.href ||
    candidate.pageUrl ||
    candidate.initiator ||
    ""
  );
}

function firstUsefulTitle(...titles) {
  for (const title of titles) {
    const cleaned = normalizeTitle(title);
    if (cleaned && !isNonVideoFrameTitle(cleaned)) {
      return cleaned;
    }
  }
  return "";
}

function normalizeTitle(title = "") {
  return String(title || "").trim().replace(/\s+/g, " ");
}

function isNonVideoFrameTitle(title) {
  return /^(cross origin local storage|about:blank|iframe)$/i.test(title);
}

function groupCandidatesForAsr(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = getSimilarityKey(candidate);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(candidate);
  }
  return [...groups.values()]
    .map(buildCandidateGroup)
    .sort((a, b) => a.asrScore - b.asrScore || (b.seenAt || 0) - (a.seenAt || 0));
}

function buildCandidateGroup(group) {
  const variants = [...group].sort((a, b) => a.asrScore - b.asrScore || compareSizeForAsr(a, b));
  const selected = variants[0];
  const hiddenCount = Math.max(variants.length - 1, 0);
  const variantStats = summarizeVariants(variants);
  const mergedHeaders = mergeVariantHeaders(variants);
  return {
    ...selected,
    requestHeaders: mergedHeaders.requestHeaders,
    responseHeaders: mergedHeaders.responseHeaders,
    variants: variants.map(summarizeVariant),
    hiddenCount,
    variantStats,
    selectionReason: describeSelection(selected, hiddenCount, variantStats)
  };
}

function mergeVariantHeaders(variants) {
  return variants.reduce(
    (headers, candidate) => ({
      requestHeaders: {
        ...headers.requestHeaders,
        ...(candidate.requestHeaders || {})
      },
      responseHeaders: {
        ...headers.responseHeaders,
        ...(candidate.responseHeaders || {})
      }
    }),
    { requestHeaders: {}, responseHeaders: {} }
  );
}

function summarizeVariants(variants) {
  return variants.reduce(
    (stats, candidate) => {
      stats.total += 1;
      stats[candidate.role] = (stats[candidate.role] || 0) + 1;
      if (candidate.kind === "hls" || candidate.kind === "dash") {
        stats.manifest += 1;
      }
      return stats;
    },
    { total: 0, audio: 0, video: 0, media: 0, playlist: 0, manifest: 0 }
  );
}

function summarizeVariant(candidate) {
  return {
    url: candidate.url,
    kind: candidate.kind,
    ext: candidate.ext,
    role: candidate.role,
    source: candidate.source,
    size: candidate.size,
    contentType: candidate.contentType,
    quality: candidate.quality,
    filename: candidate.filename
  };
}

function describeSelection(candidate, hiddenCount, stats) {
  if (!hiddenCount) {
    return candidate.role === "audio" ? "直接音频轨" : "单一候选";
  }
  if (candidate.role === "audio") {
    return `已折叠 ${hiddenCount} 条相似候选，自动选择适合 ASR 的音频轨`;
  }
  if (stats.manifest > 1) {
    return `已折叠 ${hiddenCount} 条清晰度变体，选择较轻的流用于语音识别`;
  }
  return `已折叠 ${hiddenCount} 条相似候选`;
}

function getSimilarityKey(candidate) {
  const urlInfo = parseUrlInfo(candidate.url);
  const pageKey = normalizeText(candidate.pageUrl || candidate.title || candidate.origin);
  const bilibiliMediaKey = getBilibiliMediaIdentity(urlInfo);
  if (bilibiliMediaKey) {
    return `asr:bilibili:${bilibiliMediaKey}`;
  }
  const durationKey = candidate.duration ? Math.round(candidate.duration / 5) * 5 : "";
  if (pageKey && durationKey && isAsrSameContentCandidate(candidate)) {
    return `asr:page-duration:${pageKey}:${durationKey}`;
  }
  const familyPath = canonicalAsrFamilyPath(candidate);
  if (pageKey && familyPath) {
    return `asr:${pageKey}:${familyPath}`;
  }
  if (pageKey && durationKey) {
    return `asr:${pageKey}:${durationKey}`;
  }
  return `${candidate.kind}:${canonicalStreamUrl(candidate.url)}`;
}

function isAsrSameContentCandidate(candidate) {
  return ["audio", "video", "playlist", "media"].includes(candidate.role) ||
    ["audio", "video", "hls", "dash", "media"].includes(candidate.kind);
}

function canonicalAsrFamilyPath(candidate) {
  let path = canonicalMediaFamilyPath(candidate.url);
  if (candidate.role === "audio" || candidate.kind === "audio") {
    path = path.replace(/\.(?:aac|flac|m4a|mp3|mp4|oga|ogg|opus|wav|weba)(?=$)/i, ".{audio}");
  }
  return path;
}

function scoreCandidateForAsr(candidate, role, quality, size, duration) {
  if (role === "audio") {
    return audioSuitabilityForAsr(candidate, quality, size, duration);
  }
  if (candidate.kind === "hls") {
    return 10 + qualityForAsr(quality) + (candidate.playlistType === "master" ? 5 : 0);
  }
  if (candidate.kind === "dash") {
    return 20 + qualityForAsr(quality);
  }
  if (candidate.ext === "m4s") {
    return 30 + Math.min(size / 1024 / 1024, 60);
  }
  if (role === "video") {
    return 40 + qualityForAsr(quality);
  }
  return 50;
}

function compareSizeForAsr(a, b) {
  if (a.role === "audio" && b.role === "audio") {
    return audioSuitabilityForAsr(a, a.quality, a.size, a.duration) -
      audioSuitabilityForAsr(b, b.quality, b.size, b.duration) ||
      compareKnownSizeAscending(a, b);
  }
  if (a.kind === "hls" && b.kind === "hls") {
    return qualityForAsr(a.quality) - qualityForAsr(b.quality);
  }
  return (a.size || 0) - (b.size || 0);
}

function audioSuitabilityForAsr(candidate, quality, size, duration) {
  const bitrate = inferAudioBitrate(candidate, quality, size, duration);
  let score = bitrate ? audioBitratePenalty(bitrate) : 2;
  score += audioContainerPenalty(candidate);
  if (!bitrate && size) {
    score += Math.min(size / 1024 / 1024 / 50, 6);
  }
  return score;
}

function inferAudioBitrate(candidate, quality, size, duration) {
  const bilibili = inferBilibiliAudioBitrate(candidate);
  if (bilibili) {
    return bilibili;
  }
  const explicit = positiveNumber(candidate.audioBitrate || candidate.bitrate || candidate.averageBitrate || quality?.bandwidth);
  if (explicit) {
    return explicit;
  }
  const seconds = positiveNumber(duration || candidate.duration);
  const bytes = positiveNumber(size || candidate.size);
  if (seconds && bytes) {
    return (bytes * 8) / seconds;
  }
  return 0;
}

function inferBilibiliAudioBitrate(candidate) {
  const urlInfo = parseUrlInfo(candidate.url || "");
  const match = urlInfo.filename.match(/(?:^|-)302(16|32|80)(?=\.m4s$)/i);
  if (!match) {
    return 0;
  }
  if (match[1] === "16") {
    return 64_000;
  }
  if (match[1] === "32") {
    return 132_000;
  }
  return 192_000;
}

function audioBitratePenalty(bitrate) {
  if (bitrate < ASR_AUDIO_ACCEPTABLE_LOW_BPS) {
    return 8 + (ASR_AUDIO_ACCEPTABLE_LOW_BPS - bitrate) / ASR_AUDIO_ACCEPTABLE_LOW_BPS;
  }
  if (bitrate < ASR_AUDIO_IDEAL_MIN_BPS) {
    return 1 + (ASR_AUDIO_IDEAL_MIN_BPS - bitrate) / ASR_AUDIO_IDEAL_MIN_BPS;
  }
  if (bitrate <= ASR_AUDIO_IDEAL_MAX_BPS) {
    return 0;
  }
  if (bitrate <= ASR_AUDIO_ACCEPTABLE_HIGH_BPS) {
    return 1 + (bitrate - ASR_AUDIO_IDEAL_MAX_BPS) / ASR_AUDIO_IDEAL_MAX_BPS;
  }
  return 5 + Math.min((bitrate - ASR_AUDIO_ACCEPTABLE_HIGH_BPS) / ASR_AUDIO_ACCEPTABLE_HIGH_BPS, 12);
}

function audioContainerPenalty(candidate) {
  const ext = String(candidate.ext || parseUrlInfo(candidate.url || "").filename.split(".").pop() || "").toLowerCase();
  if (["flac", "wav", "aiff", "aif", "alac"].includes(ext)) {
    return 6;
  }
  if (["aac", "m4a", "mp3", "mp4", "m4s", "oga", "ogg", "opus", "weba"].includes(ext)) {
    return 0;
  }
  return 1;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function compareKnownSizeAscending(a, b) {
  const sizeA = positiveNumber(a.size);
  const sizeB = positiveNumber(b.size);
  if (sizeA && sizeB) {
    return sizeA - sizeB;
  }
  if (sizeA) {
    return -1;
  }
  if (sizeB) {
    return 1;
  }
  return 0;
}

function qualityForAsr(quality) {
  if (!quality?.height && !quality?.bandwidth) {
    return 0;
  }
  return (quality.height || 0) / 1000 + (quality.bandwidth || 0) / 10_000_000;
}

function inferMediaRole(candidate, contentType, urlInfo, videoWidth, videoHeight) {
  if (candidate.kind === "audio" || contentType.startsWith("audio/") || AUDIO_EXTENSIONS.has(candidate.ext)) {
    return "audio";
  }
  if (isLikelyBilibiliAudio(urlInfo)) {
    return "audio";
  }
  if (candidate.kind === "hls" || candidate.kind === "dash") {
    return "playlist";
  }
  if (contentType.startsWith("video/") || videoWidth || videoHeight) {
    return "video";
  }
  return "media";
}

function shouldInheritPageDuration(candidate, contentType, urlInfo, state = null) {
  if (isIgnoredMediaUrl(candidate.url)) {
    return false;
  }
  if (candidate.duration) {
    return true;
  }
  if (candidate.source === "media-element") {
    return true;
  }
  if (candidate.kind === "hls" || candidate.kind === "dash") {
    return true;
  }
  if (candidate.ext === "m4s" || isLikelyBilibiliMedia(urlInfo)) {
    return true;
  }
  if (hasTrustedPageMediaContext(candidate, contentType, urlInfo, state)) {
    return true;
  }
  return false;
}

function hasTrustedPageMediaContext(candidate, contentType, urlInfo, state) {
  const duration = Number(state?.context?.duration);
  if (!state?.context?.hasMedia || !Number.isFinite(duration) || duration <= 0) {
    return false;
  }
  if (!isLikelyDirectPlayableMedia(candidate, contentType, urlInfo)) {
    return false;
  }
  const currentPageUrl = state.page?.url || state.context?.href || "";
  const initiator = candidate.pageUrl || candidate.initiator || "";
  if (!initiator || !currentPageUrl) {
    return true;
  }
  return normalizePageUrlForGrouping(initiator) === normalizePageUrlForGrouping(currentPageUrl) ||
    (initiator.startsWith("http") && currentPageUrl.startsWith("http"));
}

function isLikelyDirectPlayableMedia(candidate, contentType, urlInfo) {
  if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
    return true;
  }
  return AUDIO_EXTENSIONS.has(candidate.ext) || ["mp4", "webm"].includes(candidate.ext) ||
    /\.(?:m4a|mp3|aac|opus|oga|ogg|weba|mp4|webm)$/i.test(urlInfo.pathname || "");
}

function normalizePageUrlForGrouping(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl || "");
  }
}

function shouldInheritPageDimensions(candidate, contentType, urlInfo) {
  if (isIgnoredMediaUrl(candidate.url)) {
    return false;
  }
  if (candidate.videoWidth || candidate.videoHeight) {
    return true;
  }
  if (candidate.kind === "hls" || candidate.kind === "dash") {
    return true;
  }
  if (contentType.startsWith("video/") && !isLikelyBilibiliAudio(urlInfo)) {
    return true;
  }
  return candidate.source === "media-element" && !contentType.startsWith("audio/");
}

function isLikelyBilibiliAudio(urlInfo) {
  return /(?:^|-)302(?:16|32|80)(?=\.m4s$)/i.test(urlInfo.filename) || /\/audio\//i.test(urlInfo.pathname);
}

function isLikelyBilibiliMedia(urlInfo) {
  return (
    isLikelyBilibiliAudio(urlInfo) ||
    /(?:^|\.)bilibili(?:video)?\.com$/i.test(urlInfo.hostname) ||
    /(?:^|\.)bilivideo\.(?:com|cn)$/i.test(urlInfo.hostname) ||
    /\/upgcxcode\//i.test(urlInfo.pathname)
  );
}

function getBilibiliMediaIdentity(urlInfo) {
  if (!isLikelyBilibiliMedia(urlInfo)) {
    return "";
  }
  const filenameMatch = urlInfo.filename.match(/^(\d+-\d+)-\d+\.(?:m4s|mp4)$/i);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  const pathMatch = urlInfo.pathname.match(/\/upgcxcode\/(?:[^/]+\/){0,4}(\d+)(?:\/|$)/i);
  if (pathMatch) {
    return pathMatch[1];
  }
  return canonicalMediaFamilyPath(urlInfo.pathname || "");
}

function inferQuality(rawUrl, videoWidth, videoHeight) {
  const quality = {
    width: videoWidth || null,
    height: videoHeight || null,
    label: videoWidth && videoHeight ? `${videoHeight}p` : ""
  };
  try {
    const url = new URL(rawUrl);
    const text = `${url.pathname} ${url.search}`.toLowerCase();
    const heightMatch = text.match(/(?:^|[^\d])(\d{3,4})p(?:[^\d]|$)/);
    if (heightMatch) {
      quality.height = Number(heightMatch[1]);
      quality.label = `${quality.height}p`;
    }
    const resolutionMatch = text.match(/(\d{3,5})[x_](\d{3,5})/);
    if (resolutionMatch) {
      quality.width = Number(resolutionMatch[1]);
      quality.height = Number(resolutionMatch[2]);
      quality.label = `${quality.height}p`;
    }
    const bandwidthMatch = text.match(/(?:bandwidth|bw|br)=(\d+)/);
    if (bandwidthMatch) {
      quality.bandwidth = Number(bandwidthMatch[1]);
    }
  } catch {
    return quality;
  }
  return quality;
}

function parseUrlInfo(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const filename = decodeURIComponent(url.pathname.split("/").pop() || "");
    return {
      hostname: url.hostname,
      origin: url.origin,
      pathname: url.pathname,
      filename
    };
  } catch {
    return {
      hostname: "",
      origin: "",
      pathname: "",
      filename: rawUrl || ""
    };
  }
}

function canonicalStreamUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.host}${canonicalPathname(url.pathname)}`;
  } catch {
    return rawUrl || "";
  }
}

function canonicalStreamPath(rawUrl) {
  try {
    return canonicalPathname(new URL(rawUrl).pathname);
  } catch {
    return rawUrl || "";
  }
}

function canonicalMediaFamilyPath(rawUrl) {
  const path = canonicalStreamPath(rawUrl);
  return path
    .replace(/\/\d{3,5}x\d{3,5}(?=\/)/g, "/{resolution}")
    .replace(/\/(?:\d{3,4}p|[1-9]\d{1,3}k|[48]k)(?=\/)/gi, "/{quality}")
    .replace(/(?:^|[-_/])(?:[1-9]\d{1,3}k|[48]k)(?=[-_/.])/gi, "-{quality}");
}

function canonicalPathname(pathname) {
  return pathname
    .replace(/\/\d{3,5}x\d{3,5}(?=\/)/g, "/{resolution}")
    .replace(/\/(?:\d{3,4}p|[1-9]\d{1,3}k|[48]k)(?=\/)/gi, "/{quality}")
    .replace(/(?:^|[-_/])\d{3,4}p(?=[-_/])/gi, "-{quality}")
    .replace(/(?:^|[-_/])(?:[1-9]\d{1,3}k|[48]k)(?=[-_/.])/gi, "-{quality}")
    .replace(/-\d{5,6}(?=\.m4s$)/i, "-{track}");
}

function normalizeText(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeContentType(value = "") {
  return String(value).split(";")[0].trim().toLowerCase();
}

function pickFinite(primary, fallback) {
  const first = Number(primary);
  if (Number.isFinite(first) && first > 0) {
    return first;
  }
  const second = Number(fallback);
  if (Number.isFinite(second) && second > 0) {
    return second;
  }
  return null;
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

function classifyUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (isIgnoredMediaUrl(url.href)) {
    return null;
  }
  const ext = url.pathname.split(".").pop()?.toLowerCase() || "";
  const mime = normalizeContentType(url.searchParams.get("mime") || url.searchParams.get("mimeType") || "");
  if (mime.startsWith("audio/")) {
    return { kind: "audio", ext: extFromMime(mime, ext) };
  }
  if (mime.startsWith("video/")) {
    return { kind: "media", ext: extFromMime(mime, ext) };
  }
  if (mime.includes("mpegurl")) {
    return { kind: "hls", ext: "m3u8" };
  }
  if (mime.includes("dash+xml")) {
    return { kind: "dash", ext: "mpd" };
  }
  if (isYoutubePlaybackUrl(url)) {
    return { kind: "media", ext: ext || "" };
  }
  if (!MEDIA_EXTENSIONS.has(ext)) {
    return null;
  }
  if (AUDIO_EXTENSIONS.has(ext)) {
    return { kind: "audio", ext };
  }
  if (MANIFEST_EXTENSIONS.has(ext)) {
    return { kind: ext === "mpd" ? "dash" : "hls", ext };
  }
  return { kind: "media", ext };
}

function inferKindFromContentType(contentType) {
  const type = contentType.toLowerCase();
  if (type.startsWith("audio/")) {
    return "audio";
  }
  if (type.includes("dash+xml")) {
    return "dash";
  }
  if (type.includes("mpegurl")) {
    return "hls";
  }
  return "media";
}

function isMediaContentType(contentType) {
  const normalized = contentType.toLowerCase();
  return MEDIA_CONTENT_TYPES.some(type => normalized.includes(type));
}

function isIgnoredMediaUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.toLowerCase();
    if (url.hostname === "cdn.plyr.io" && pathname === "/static/blank.mp4") {
      return true;
    }
    if (isYoutubePlaceholderAudio(url)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isYoutubePlaceholderAudio(url) {
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  return hostname.endsWith("youtube.com") && pathname === "/s/search/audio/no_input.mp3";
}

function isYoutubePlaybackUrl(url) {
  return /(^|\.)googlevideo\.com$/i.test(url.hostname) && /\/videoplayback$/i.test(url.pathname);
}

function extFromMime(mime, fallback = "") {
  if (mime.includes("mp4")) {
    return "mp4";
  }
  if (mime.includes("webm")) {
    return "webm";
  }
  if (mime.includes("mp3") || mime.includes("mpeg")) {
    return "mp3";
  }
  if (mime.includes("ogg")) {
    return "ogg";
  }
  return fallback || "";
}

function isGenericBinaryContentType(contentType) {
  return normalizeContentType(contentType) === "application/octet-stream";
}

function getHeader(headers = [], name) {
  return headers.find(header => header.name.toLowerCase() === name)?.value || "";
}

function compactRequestHeaders(headers = []) {
  const keep = new Set(["authorization", "cookie", "origin", "referer", "user-agent"]);
  const output = {};
  for (const header of headers) {
    const name = header.name.toLowerCase();
    if (keep.has(name)) {
      output[name] = header.value;
    }
  }
  return output;
}

function compactResponseHeaders(headers = []) {
  const output = {};
  for (const header of headers || []) {
    const name = header.name.toLowerCase();
    if (name === "content-length") {
      output.size = Number(header.value) || undefined;
    } else if (name === "content-type") {
      output.type = header.value.split(";")[0].toLowerCase();
    } else if (name === "content-disposition") {
      output.attachment = header.value;
    } else if (name === "content-range") {
      const size = header.value.split("/")[1];
      if (size && size !== "*") {
        output.size = Number(size) || output.size;
      }
    }
  }
  return output;
}
