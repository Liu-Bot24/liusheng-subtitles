const MESSAGE = {
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  START_REALTIME: "FUGUANG_START_REALTIME",
  STOP_REALTIME: "FUGUANG_STOP_REALTIME",
  START_PRELOAD: "FUGUANG_START_PRELOAD",
  PAGE_MEDIA_FOUND: "FUGUANG_PAGE_MEDIA_FOUND",
  SET_CAPTION: "FUGUANG_SET_CAPTION",
  CLEAR_CAPTION: "FUGUANG_CLEAR_CAPTION",
  OFFSCREEN_START_REALTIME: "FUGUANG_OFFSCREEN_START_REALTIME",
  OFFSCREEN_STOP_REALTIME: "FUGUANG_OFFSCREEN_STOP_REALTIME",
  OFFSCREEN_REALTIME_CAPTION: "FUGUANG_OFFSCREEN_REALTIME_CAPTION",
  OFFSCREEN_REALTIME_ERROR: "FUGUANG_OFFSCREEN_REALTIME_ERROR"
};

const DEFAULT_HELPER_HTTP = "http://127.0.0.1:8766";
const DEFAULT_HELPER_WS = "ws://127.0.0.1:8765/realtime";
const MAX_CANDIDATES_PER_TAB = 80;

const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"]);
const MANIFEST_EXTENSIONS = new Set(["m3u8", "m3u", "mpd"]);
const MEDIA_EXTENSIONS = new Set([...AUDIO_EXTENSIONS, ...MANIFEST_EXTENSIONS, "mp4", "m4s", "ts", "webm"]);
const MEDIA_CONTENT_TYPES = [
  "audio/",
  "application/dash+xml",
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "application/mpegurl",
  "video/mp2t"
];

const tabState = new Map();

chrome.webRequest.onBeforeRequest.addListener(
  details => {
    if (details.tabId < 0 || !details.url) {
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
    const contentType = getHeader(details.responseHeaders, "content-type");
    if (!contentType || !isMediaContentType(contentType)) {
      return;
    }
    const classification = classifyUrl(details.url) || { kind: inferKindFromContentType(contentType), ext: "" };
    addCandidate(details.tabId, {
      url: details.url,
      source: "response",
      kind: classification.kind,
      ext: classification.ext,
      contentType,
      requestType: details.type,
      seenAt: Date.now()
    });
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] },
  ["responseHeaders"]
);

chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId === 0) {
    tabState.delete(details.tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case MESSAGE.GET_STATUS:
      return getStatus(message.tabId);
    case MESSAGE.GET_CANDIDATES:
      return { candidates: getCandidates(message.tabId) };
    case MESSAGE.START_REALTIME:
      return startRealtime(message.tabId);
    case MESSAGE.STOP_REALTIME:
      return stopRealtime(message.tabId);
    case MESSAGE.START_PRELOAD:
      return startPreload(message.tabId, message.candidate);
    case MESSAGE.PAGE_MEDIA_FOUND:
      addPageMediaCandidate(sender.tab?.id, message.media);
      return {};
    case MESSAGE.OFFSCREEN_REALTIME_CAPTION:
      await setCaption(message.tabId, message.text, "realtime");
      return {};
    case MESSAGE.OFFSCREEN_REALTIME_ERROR:
      setTabStatus(message.tabId, { realtime: "error", error: message.error });
      return {};
    default:
      return {};
  }
}

async function getStatus(tabId) {
  const state = getState(tabId);
  const helper = await getHelperConfig();
  return {
    helper,
    realtime: state.realtime || "idle",
    preload: state.preload || "idle",
    error: state.error || "",
    candidates: getCandidates(tabId)
  };
}

async function startRealtime(tabId) {
  if (!tabId) {
    throw new Error("No active tab is available.");
  }
  const helper = await getHelperConfig();
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  await chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_START_REALTIME,
    tabId,
    streamId,
    helperWsUrl: helper.wsUrl
  });
  setTabStatus(tabId, { realtime: "running", error: "" });
  return { realtime: "running" };
}

async function stopRealtime(tabId) {
  await chrome.runtime.sendMessage({ type: MESSAGE.OFFSCREEN_STOP_REALTIME, tabId });
  await chrome.tabs.sendMessage(tabId, { type: MESSAGE.CLEAR_CAPTION }).catch(() => {});
  setTabStatus(tabId, { realtime: "idle" });
  return { realtime: "idle" };
}

async function startPreload(tabId, candidate) {
  if (!candidate?.url) {
    throw new Error("No media candidate selected.");
  }
  const helper = await getHelperConfig();
  const response = await fetch(`${helper.httpUrl}/preload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tabId,
      candidate,
      requestedOutput: "webvtt"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || payload.message || `Helper returned HTTP ${response.status}.`);
  }
  setTabStatus(tabId, { preload: payload.status || "queued", error: "" });
  return { preload: payload.status || "queued", job: payload.job };
}

async function setCaption(tabId, text, mode) {
  if (!tabId || !text) {
    return;
  }
  await chrome.tabs.sendMessage(tabId, {
    type: MESSAGE.SET_CAPTION,
    text,
    mode
  }).catch(() => {});
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
    reasons: ["USER_MEDIA"],
    justification: "Capture current tab audio for realtime translated subtitles."
  });
}

async function getHelperConfig() {
  const data = await chrome.storage.sync.get({
    helperHttpUrl: DEFAULT_HELPER_HTTP,
    helperWsUrl: DEFAULT_HELPER_WS
  });
  return {
    httpUrl: data.helperHttpUrl || DEFAULT_HELPER_HTTP,
    wsUrl: data.helperWsUrl || DEFAULT_HELPER_WS
  };
}

function addPageMediaCandidate(tabId, media) {
  if (!tabId || !media?.url) {
    return;
  }
  const classification = classifyUrl(media.url) || { kind: media.kind || "media", ext: "" };
  addCandidate(tabId, {
    url: media.url,
    source: "page",
    kind: classification.kind,
    ext: classification.ext,
    title: media.title || "",
    duration: media.duration,
    seenAt: Date.now()
  });
}

function addCandidate(tabId, candidate) {
  const state = getState(tabId);
  const fingerprint = `${candidate.kind}:${candidate.url}`;
  if (state.candidateFingerprints.has(fingerprint)) {
    return;
  }
  state.candidateFingerprints.add(fingerprint);
  state.candidates.unshift(candidate);
  state.candidates = state.candidates.slice(0, MAX_CANDIDATES_PER_TAB);
}

function getCandidates(tabId) {
  return getState(tabId).candidates || [];
}

function setTabStatus(tabId, patch) {
  Object.assign(getState(tabId), patch);
}

function getState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      candidates: [],
      candidateFingerprints: new Set(),
      realtime: "idle",
      preload: "idle",
      error: ""
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
  const ext = url.pathname.split(".").pop()?.toLowerCase() || "";
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

function getHeader(headers = [], name) {
  return headers.find(header => header.name.toLowerCase() === name)?.value || "";
}
