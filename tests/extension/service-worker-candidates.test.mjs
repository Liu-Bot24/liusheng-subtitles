import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const webNavigationCommittedListeners = [];
const webNavigationHistoryListeners = [];
const addListener = () => {};
const chrome = {
  action: { onClicked: { addListener } },
  offscreen: { hasDocument: async () => false, createDocument: async () => {} },
  runtime: { getURL: value => `chrome-extension://test-extension/${value}`, getContexts: async () => [], onMessage: { addListener }, sendMessage: async () => ({}) },
  sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {},
      setAccessLevel: async () => {}
    },
    sync: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {}
    }
  },
  scripting: { executeScript: async () => [] },
  declarativeNetRequest: {
    updateSessionRules: async () => {}
  },
  tabs: {
    get: async () => ({ id: 1, title: "Test page", url: "https://example.test/watch/1" }),
    sendMessage: async () => null,
    onRemoved: { addListener }
  },
  webNavigation: {
    getAllFrames: async () => [],
    onCommitted: { addListener: listener => webNavigationCommittedListeners.push(listener) },
    onHistoryStateUpdated: { addListener: listener => webNavigationHistoryListeners.push(listener) },
    onTabReplaced: { addListener }
  },
  webRequest: {
    onBeforeRequest: { addListener },
    onBeforeSendHeaders: { addListener },
    onCompleted: { addListener },
    onHeadersReceived: { addListener },
    onErrorOccurred: { addListener },
    OnBeforeSendHeadersOptions: { EXTRA_HEADERS: "extraHeaders" }
  }
};

class FakeResponse {
  constructor(body = new ArrayBuffer(0), options = {}) {
    this.body = body instanceof Uint8Array
      ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
      : body;
    this.headers = options.headers || {};
  }

  async arrayBuffer() {
    return this.body;
  }
}

const fakeCaches = new Map();
const caches = {
  async open(name) {
    if (!fakeCaches.has(name)) {
      const entries = new Map();
      fakeCaches.set(name, {
        async put(key, response) {
          entries.set(String(key), response);
        },
        async match(key) {
          return entries.get(String(key));
        },
        async delete(key) {
          return entries.delete(String(key));
        },
        async keys() {
          return [...entries.keys()].map(url => ({ url }));
        }
      });
    }
    return fakeCaches.get(name);
  }
};

const context = vm.createContext({
  chrome,
  caches,
  console,
  URL,
  Date,
  Map,
  Set,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Promise,
  Response: FakeResponse,
  ArrayBuffer,
  Uint8Array,
  Blob,
  FormData,
  AbortController,
  fetch: async () => ({ ok: true, json: async () => ({}), text: async () => "" }),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
});

const languageSource = fs.readFileSync(new URL("../../extension/src/background/browser-language.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserLanguage =", "var FuguangBrowserLanguage =");
const asrProviderSource = fs.readFileSync(new URL("../../extension/src/background/browser-asr-provider.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n\n', "")
  .replace("export const FuguangBrowserAsrProvider =", "var FuguangBrowserAsrProvider =");
const asrPostprocessSource = fs.readFileSync(new URL("../../extension/src/background/browser-asr-postprocess.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserAsrPostprocess =", "var FuguangBrowserAsrPostprocess =");
const mediaCandidatesSource = fs.readFileSync(new URL("../../extension/src/background/browser-media-candidates.js", import.meta.url), "utf8")
  .replace("export const FuguangBrowserMediaCandidates =", "var FuguangBrowserMediaCandidates =");
const modelProfilesSource = fs.readFileSync(new URL("../../extension/src/background/browser-model-profiles.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n\n', "")
  .replace("export const FuguangBrowserModelProfiles =", "var FuguangBrowserModelProfiles =");
const providerSource = fs.readFileSync(new URL("../../extension/src/background/browser-translation-provider.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n\n', "")
  .replace("export const FuguangBrowserTranslationProvider =", "var FuguangBrowserTranslationProvider =");
const pipelineSource = fs.readFileSync(new URL("../../extension/src/background/browser-translation-pipeline.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserTranslationProvider } from "./browser-translation-provider.js";\n\n', "")
  .replace("export const FuguangBrowserTranslationPipeline =", "var FuguangBrowserTranslationPipeline =");
const mediaHeaderRulesSource = fs.readFileSync(new URL("../../extension/src/background/media-header-rules.js", import.meta.url), "utf8")
  .replace("export const FuguangMediaHeaderRules =", "var FuguangMediaHeaderRules =");
const source = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8")
  .replace('import { FuguangBrowserAsrProvider } from "./browser-asr-provider.js";\n', "")
  .replace('import { FuguangBrowserAsrPostprocess } from "./browser-asr-postprocess.js";\n', "")
  .replace('import { FuguangBrowserLanguage } from "./browser-language.js";\n', "")
  .replace('import { FuguangBrowserMediaCandidates } from "./browser-media-candidates.js";\n', "")
  .replace('import { FuguangBrowserModelProfiles } from "./browser-model-profiles.js";\n', "")
  .replace('import { FuguangBrowserTranslationPipeline } from "./browser-translation-pipeline.js";\n', "")
  .replace('import { FuguangMediaHeaderRules } from "./media-header-rules.js";\n\n', "");

{
  assert.equal(source.includes("FUGUANG_START_REALTIME"), false);
  assert.equal(source.includes("FUGUANG_STOP_REALTIME"), false);
  assert.equal(source.includes("FUGUANG_OFFSCREEN_START_REALTIME"), false);
  assert.equal(source.includes("FUGUANG_OFFSCREEN_STOP_REALTIME"), false);
  assert.equal(source.includes("DEFAULT_HELPER"), false);
  assert.equal(source.includes("fetchHelper"), false);
  assert.equal(source.includes("getHelperConfig"), false);
  assert.equal(source.includes("tabCapture"), false);
  assert.equal(source.includes("FUGUANG_START_PRELOAD\""), false);
  assert.equal(source.includes("FUGUANG_WEB_FFMPEG_EXTRACT_AUDIO"), false);
  assert.ok(
    source.includes("后台任务状态已过期"),
    "重翻译/重试失败识别分段的错误提示必须说明 MV3 后台任务状态可能已过期，避免误导用户以为 ASR 原文一定可复用"
  );
}

vm.runInContext(languageSource, context, { filename: "browser-language.js" });
Object.assign(context, context.FuguangBrowserLanguage);
vm.runInContext(asrProviderSource, context, { filename: "browser-asr-provider.js" });
Object.assign(context, context.FuguangBrowserAsrProvider);
vm.runInContext(asrPostprocessSource, context, { filename: "browser-asr-postprocess.js" });
Object.assign(context, context.FuguangBrowserAsrPostprocess);
vm.runInContext(mediaCandidatesSource, context, { filename: "browser-media-candidates.js" });
Object.assign(context, context.FuguangBrowserMediaCandidates);
vm.runInContext(modelProfilesSource, context, { filename: "browser-model-profiles.js" });
Object.assign(context, context.FuguangBrowserModelProfiles);
vm.runInContext(providerSource, context, { filename: "browser-translation-provider.js" });
Object.assign(context, context.FuguangBrowserTranslationProvider);
vm.runInContext(pipelineSource, context, { filename: "browser-translation-pipeline.js" });
Object.assign(context, context.FuguangBrowserTranslationPipeline);
vm.runInContext(mediaHeaderRulesSource, context, { filename: "media-header-rules.js" });
vm.runInContext(source, context, { filename: "service-worker.js" });

{
  assert.equal(
    context.browserAsrUploadChunkSeconds({}),
    900,
    "默认 ASR 逻辑上传块应保持 15 分钟；成熟方案的 30 秒是 ASR 服务端 VAD/模型窗口，不是插件端强制碎片上传"
  );
  assert.equal(context.normalizeBrowserAsrUploadChunkSeconds(120), 120);
}

{
  assert.ok(webNavigationCommittedListeners.length > 0, "top-level committed listener should be registered");
  const tabId = 119;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3 };
  state.attachedVttSignature = "browser-committed-old";
  state.manualVttSignature = "manual:committed-old";
  const messages = [];
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 3 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationCommittedListeners[0]({ tabId, frameId: 0, url: "https://example.test/watch/committed-new" });

  assert.deepEqual(messages.map(message => message.type), [
    "FUGUANG_DETACH_PRELOAD_VTT",
    "FUGUANG_DETACH_PRELOAD_VTT"
  ]);
  assert.equal(context.getState(tabId).attachedVttSignature, "");
  assert.equal(context.getState(tabId).manualVttSignature, "");
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  assert.ok(webNavigationHistoryListeners.length > 0, "history-state listener should be registered");
  const tabId = 113;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3 };
  state.attachedVttSignature = "browser-spa-old";
  state.manualVttSignature = "manual:old";
  const messages = [];
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 3 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 0, url: "https://example.test/watch/2" });

  assert.deepEqual(messages.map(message => message.type), [
    "FUGUANG_DETACH_PRELOAD_VTT",
    "FUGUANG_DETACH_PRELOAD_VTT"
  ]);
  assert.equal(context.getState(tabId).attachedVttSignature, "");
  assert.equal(context.getState(tabId).manualVttSignature, "");
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 114;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.context = { frameId: 3 };
  state.attachedVttSignature = "iframe-spa-old";
  state.manualVttSignature = "manual:iframe-old";
  const messages = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 3, url: "https://frame.example.test/watch/2" });

  assert.deepEqual(messages, [{ type: "FUGUANG_DETACH_PRELOAD_VTT", frameId: 3 }]);
  assert.equal(context.getState(tabId).attachedVttSignature, "");
  assert.equal(context.getState(tabId).manualVttSignature, "");
  assert.equal(context.getState(tabId).subtitleFrameId, null);
  assert.equal(context.getState(tabId).mediaFrameId, null);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 118;
  const messages = [];
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 2 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 0, url: "https://example.test/watch/fresh" });

  assert.deepEqual(messages.map(message => message.type), [
    "FUGUANG_DETACH_PRELOAD_VTT",
    "FUGUANG_DETACH_PRELOAD_VTT"
  ]);
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 115;
  seedPage(tabId, { duration: 120 });
  const state = context.getState(tabId);
  state.subtitleFrameId = 3;
  state.mediaFrameId = 3;
  state.attachedVttSignature = "iframe-spa-current";
  const messages = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    messages.push({ type: message.type, frameId: options.frameId ?? null });
    return { ok: true };
  };

  await webNavigationHistoryListeners[0]({ tabId, frameId: 4, url: "https://other-frame.example.test/watch/2" });

  assert.deepEqual(messages, []);
  assert.equal(context.getState(tabId).attachedVttSignature, "iframe-spa-current");
  assert.equal(context.getState(tabId).subtitleFrameId, 3);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const segments = context.collectChunkSegments(new Map([
    [2, [{ start: 20, end: 21, text: "third" }]],
    [0, [{ start: 30, end: 31, text: "first" }]],
    [1, [{ start: 10, end: 11, text: "second" }]]
  ]));
  assert.equal(JSON.stringify(segments.map(segment => segment.text)), JSON.stringify(["first", "second", "third"]));
  assert.equal(JSON.stringify(segments.map(segment => segment.chunkIndex)), JSON.stringify([0, 1, 2]));
  assert.equal(JSON.stringify(segments.map(segment => segment.segmentIndex)), JSON.stringify([0, 0, 0]));
}

{
  const vtt = context.transcriptToBilingualVtt({
    source: [
      { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
      { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
    ],
    translated: [
      { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
    ]
  });
  assert.match(vtt, /00:00:00\.000 --> 00:00:02\.000\nsource first/);
  assert.match(vtt, /00:00:03\.000 --> 00:00:05\.000\nsource second\ntranslated second/);
  assert.doesNotMatch(vtt, /source first\ntranslated second/);
  const previewVtt = context.transcriptToBilingualVtt({
    source: [
      { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
      { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
    ],
    translated: [
      { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
    ]
  }, { allowSourcePreview: true });
  assert.match(previewVtt, /00:00:00\.000 --> 00:00:02\.000\nsource first/);
}

{
  const vtt = context.transcriptToBilingualVtt({
    source: [{ start: 0, end: 2, text: "source without identity" }],
    translated: [{ start: 0, end: 2, text: "translated without identity" }]
  });
  assert.match(vtt, /source without identity\ntranslated without identity/);
}

{
  assert.equal(context.targetLanguageName("zh-CN"), "Simplified Chinese");
  assert.equal(context.targetLanguageName("en"), "English");
  const messages = context.buildTranslationMessages(
    [{ start: 1, end: 2, text: "hello" }],
    "zh-CN",
    { title: "T" }
  );
  assert.match(messages[0].content, /Simplified Chinese/);
  assert.match(messages[1].content, /"name":"Simplified Chinese"/);
}

{
  const asrProfiles = context.normalizeStoredProfiles("asr", [
    { id: "custom_vad", name: "自定义 VAD", providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", vadFilter: "on" }
  ]);
  assert.equal(asrProfiles.find(profile => profile.id === "custom_vad")?.vadFilter, "on");
  assert.equal(context.normalizeSelectedProfileId(asrProfiles, "missing_profile", "openai_whisper"), "openai_whisper");
  assert.equal(context.browserAsrEndpoint({ providerType: "xai", baseUrl: "https://api.x.ai/v1" }), "https://api.x.ai/v1/stt");
  assert.equal(context.browserAsrEndpoint({ providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1" }), "http://127.0.0.1:8000/v1/audio/transcriptions");
  assert.equal(context.normalizeAsrLanguage("auto"), "");
  assert.equal(context.normalizeAsrLanguage("japanese"), "ja");
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "en")), JSON.stringify([["format", "true"], ["language", "en"]]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "zh-CN")), JSON.stringify([]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "openai", model: "whisper-1" }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "zh-CN")), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1"
  }, "zh-CN")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1"
  }, "zh-CN", { supportedRequestFields: new Set(["vad_filter"]) })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1",
    vadFilter: "auto"
  }, "zh-CN", {
    supportedRequestFields: new Set(["vad_filter"]),
    clientSpeechIntervalsAvailable: true
  })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://[::1]:8000/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "zh-CN", {
    supportedRequestFields: new Set(["vad_filter"]),
    clientSpeechIntervalsAvailable: true
  })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["language", "zh"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "ja", {
    supportedRequestFields: new Set([
      "vad_filter",
      "threshold",
      "min_speech_duration_ms",
      "max_speech_duration_s",
      "min_silence_duration_ms",
      "speech_pad_ms",
      "condition_on_previous_text",
      "no_speech_threshold",
      "without_timestamps",
      "compression_ratio_threshold",
      "log_prob_threshold",
      "hallucination_silence_threshold",
      "word_timestamps"
    ])
  })), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["threshold", "0.5"],
    ["min_speech_duration_ms", "0"],
    ["max_speech_duration_s", "30"],
    ["min_silence_duration_ms", "160"],
    ["speech_pad_ms", "400"],
    ["word_timestamps", "true"],
    ["condition_on_previous_text", "false"],
    ["without_timestamps", "false"],
    ["no_speech_threshold", "0.6"],
    ["compression_ratio_threshold", "2.4"],
    ["log_prob_threshold", "-1"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "ja", {
    supportedRequestFields: new Set([
      "vad_filter",
      "vad_parameters",
      "threshold",
      "min_speech_duration_ms",
      "max_speech_duration_s",
      "min_silence_duration_ms",
      "speech_pad_ms"
    ])
  })), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"],
    ["vad_parameters", "{\"threshold\":0.5,\"min_speech_duration_ms\":0,\"max_speech_duration_s\":30,\"min_silence_duration_ms\":160,\"speech_pad_ms\":400}"],
    ["language", "ja"]
  ]));
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 31, end: 33.2 },
      { start: 37, end: 39 }
    ], { start: 30, end: 60 }),
    "1,9"
  );
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 31, end: 32 },
      { start: 65, end: 66 }
    ], { start: 30, end: 90 }),
    "1,2,35,36"
  );
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 0, end: 29.8 },
      { start: 29.7, end: 40 }
    ], { start: 0, end: 60 }),
    "0,29.4,29.7,40"
  );
  assert.equal(
    context.browserAsrClipTimestampsValue([
      { start: 1, end: 35 }
    ], { start: 0, end: 60 }),
    "1,35"
  );
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start_ms: 1000, end_ms: 1500 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1, end: 1.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 1000, end: 1500 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1, end: 1.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 1, end: 1.5 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1, end: 1.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 1000, end: 1500 }
    ], { start: 900, end: 2700, duration: 1800 })
  ), JSON.stringify(
    [{ start: 901, end: 901.5 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start: 100, end: 170 }
    ], { start: 900, end: 2700, duration: 1800 })
  ), JSON.stringify(
    [{ start: 1000, end: 1070 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start_time: 10, end_time: 12 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 10, end: 12 }]
  ));
  assert.equal(JSON.stringify(
    context.normalizeBrowserAsrSpeechTimestampsPayload([
      { start_time: 0, end_time: 1.25 },
      { end_time: 2.5 }
    ], { start: 0, end: 1800, duration: 1800 })
  ), JSON.stringify(
    [{ start: 0, end: 1.25 }]
  ));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://clip-compatible.example/v1",
    model: "Systran/faster-whisper-large-v3",
    vadFilter: "auto"
  }, "ja", {
    supportedRequestFields: new Set(["clip_timestamps", "vad_filter", "vad_parameters"]),
    clipTimestamps: "1,9"
  })), JSON.stringify([
    ["model", "Systran/faster-whisper-large-v3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["clip_timestamps", "1,9"],
    ["vad_filter", "false"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"]
  ]));
  assert.equal(
    context.browserAsrRequestFields({
      providerType: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "whisper-1"
    }, "").some(([name, value]) => name === "temperature" && value === "0"),
    true
  );
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "ja", {
    supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text", "no_speech_threshold"])
  })), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://asr-compatible.example/v1",
    model: "whisper-1",
    vadFilter: "on"
  }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["vad_filter", "true"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    vadFilter: "on"
  }, "")), JSON.stringify([
    ["model", "whisper-large-v3-turbo"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    vadFilter: "on"
  }, "ja", {
    supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text", "no_speech_threshold"])
  })), JSON.stringify([
    ["model", "whisper-large-v3-turbo"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["temperature", "0"],
    ["language", "ja"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "xai",
    baseUrl: "https://api.x.ai/v1",
    vadFilter: "on"
  }, "en", { supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text"]) })), JSON.stringify([
    ["format", "true"],
    ["language", "en"]
  ]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({
    providerType: "openai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-3",
    vadFilter: "on"
  }, "en", {
    supportedRequestFields: new Set(["vad_filter", "condition_on_previous_text"])
  })), JSON.stringify([
    ["model", "grok-3"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"],
    ["timestamp_granularities[]", "word"],
    ["language", "en"]
  ]));
  assert.doesNotThrow(() => context.validateBrowserPreloadModelConfig({
    asr: { providerType: "xai", baseUrl: "https://api.x.ai/v1", apiKey: "test" }
  }));
  assert.throws(() => context.validateBrowserPreloadModelConfig({
    asr: { providerType: "openai", baseUrl: "https://asr.test/v1", apiKey: "test" }
  }), /模型名称/);
}

{
  const modelSettingsVersion = vm.runInContext("MODEL_SETTINGS_VERSION", context);
  const originalLocalGet = chrome.storage.local.get;
  const originalLocalSet = chrome.storage.local.set;
  const originalSyncRemove = chrome.storage.sync.remove;
  const stored = {
    modelSettingsVersion,
    selectedAsrProfileId: "openai_whisper",
    selectedLlmProfileId: "test_llm",
    sourceLanguage: "japanese",
    targetLanguage: "zh-CN",
    asrProfiles: [
      { id: "openai_whisper", name: "OpenAI Whisper", providerType: "openai", baseUrl: "https://api.openai.com/v1", model: "whisper-1", apiKey: "asr-key" }
    ],
    llmProfiles: [
      { id: "test_llm", name: "Test LLM", providerType: "openai", baseUrl: "https://llm.test/v1", model: "test-llm", apiKey: "llm-key" }
    ]
  };
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async () => {};
  chrome.storage.sync.remove = async () => {};
  try {
    const config = await context.getModelConfig();
    assert.equal(config.asr.language, "ja");
    assert.ok(context.browserAsrRequestFields(config.asr, config.asr.language).some(([name, value]) => name === "language" && value === "ja"));

    stored.sourceLanguage = "auto";
    const autoConfig = await context.getModelConfig();
    assert.equal(Object.hasOwn(autoConfig.asr, "language"), false);
    assert.equal(context.browserAsrRequestFields(autoConfig.asr, autoConfig.asr.language).some(([name]) => name === "language"), false);
  } finally {
    chrome.storage.local.get = originalLocalGet;
    chrome.storage.local.set = originalLocalSet;
    chrome.storage.sync.remove = originalSyncRemove;
  }
}

{
  const relativeSegments = context.normalizeAsrSegments({
    segments: [{ start: 1.5, end: 4, text: "relative" }]
  }, 1800, 2700);
  assert.equal(relativeSegments[0].start, 1801.5);
  assert.equal(relativeSegments[0].end, 1804);

  const absoluteSegments = context.normalizeAsrSegments({
    segments: [{ start: 1801.5, end: 1804, text: "absolute" }]
  }, 1800, 2700);
  assert.equal(absoluteSegments[0].start, 1801.5);
  assert.equal(absoluteSegments[0].end, 1804);

  const ambiguousRelativeSegments = context.normalizeAsrSegments({
    segments: [{ start: 899.2, end: 901, text: "ambiguous relative tail" }]
  }, 898, 1800);
  assert.equal(ambiguousRelativeSegments[0].start, 1797.2);
  assert.equal(ambiguousRelativeSegments[0].end, 1799);

  const sortedSegments = context.normalizeAsrSegments({
    segments: [
      { start: 8, end: 9, text: "second" },
      { start: 3, end: 4, text: "first" }
    ]
  }, 900, 1200);
  assert.equal(JSON.stringify(sortedSegments.map(segment => segment.text)), JSON.stringify(["first", "second"]));

  const xaiWordSegments = context.normalizeAsrSegments({
    text: "Hello world",
    words: [
      { word: "Hello", start: 1, end: 1.4 },
      { word: "world", start: 1.5, end: 2.0 }
    ]
  }, 30, 60);
  assert.equal(xaiWordSegments.length, 1);
  assert.equal(xaiWordSegments[0].start, 31);
  assert.equal(xaiWordSegments[0].end, 32);
  assert.equal(xaiWordSegments[0].text, "Hello world");

  const xaiNestedWordSegments = context.normalizeAsrSegments({
    result: {
      words: [
        { text: "你", start_time: 0.0, end_time: 0.2 },
        { text: "好", start_time: 0.2, end_time: 0.5 }
      ]
    }
  }, 120, 150);
  assert.equal(xaiNestedWordSegments.length, 1);
  assert.equal(xaiNestedWordSegments[0].start, 120);
  assert.equal(xaiNestedWordSegments[0].end, 120.5);
  assert.equal(xaiNestedWordSegments[0].text, "你好");

  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [{ start: 0, end: 1, text: "segment-only" }]
    })
  });
  try {
    await assert.rejects(
      () => context.transcribeBrowserAudioChunk(
        {
          index: 0,
          start: 30,
          end: 60,
          file: { name: "xai.mp3", mime: "audio/mpeg", buffer: new ArrayBuffer(1) }
        },
        { providerType: "xai", baseUrl: "https://api.x.ai/v1", apiKey: "test", timeoutMs: 1000 }
      ),
      /xAI.*word.*时间戳|word.*时间戳.*xAI/
    );
  } finally {
    context.fetch = originalFetch;
  }

  const nestedWordBoundaries = context.normalizeAsrSegments({
    segments: [{
      start: 43.159,
      end: 46.439,
      text: "何意味",
      words: [
        { word: "何", start: 45.0, end: 45.4 },
        { word: "意味", start: 45.4, end: 46.1 }
      ]
    }]
  }, 0, 60);
  assert.equal(nestedWordBoundaries.length, 1);
  assert.equal(nestedWordBoundaries[0].start, 45.0);
  assert.equal(nestedWordBoundaries[0].end, 46.1);
  assert.equal(nestedWordBoundaries[0].text, "何意味");

  const topLevelWordBoundaries = context.normalizeAsrSegments({
    segments: [{
      start: 43.159,
      end: 46.439,
      text: "何意味"
    }],
    words: [
      { word: "何", start: 45.0, end: 45.4 },
      { word: "意味", start: 45.4, end: 46.1 }
    ]
  }, 0, 60);
  assert.equal(topLevelWordBoundaries.length, 1);
  assert.equal(topLevelWordBoundaries[0].start, 45.0);
  assert.equal(topLevelWordBoundaries[0].end, 46.1);
  assert.equal(topLevelWordBoundaries[0].text, "何意味");

  const longWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 307.55,
      text: "気持ちいい",
      words: [
        { word: "気", start: 0.00, end: 0.38 },
        { word: "持", start: 307.13, end: 307.33 },
        { word: "ち", start: 307.33, end: 307.49 },
        { word: "いい", start: 307.49, end: 307.55 }
      ]
    }]
  }, 2700, 3600);
  assert.equal(longWordGapSegments.length, 1);
  assert.equal(longWordGapSegments[0].text, "気持ちいい");
  assert.equal(longWordGapSegments[0].start, 3007.13);
  assert.equal(longWordGapSegments[0].end, 3007.55);

  const splitWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 307.55,
      text: "気持ちいい",
      words: [
        { word: "気", start: 0.00, end: 0.42 },
        { word: "持", start: 0.42, end: 1.30 },
        { word: "ち", start: 307.13, end: 307.33 },
        { word: "いい", start: 307.33, end: 307.55 }
      ]
    }]
  }, 2700, 3600);
  assert.equal(splitWordGapSegments.length, 1);
  assert.equal(splitWordGapSegments[0].text, "気持ちいい");
  assert.equal(splitWordGapSegments[0].start, 3007.13);
  assert.equal(splitWordGapSegments[0].end, 3007.55);

  const meaningfulLongWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 75,
      text: "もう 待って",
      words: [
        { word: "もう", start: 0.00, end: 0.40 },
        { word: "待って", start: 72.20, end: 73.00 }
      ]
    }]
  }, 0, 60);
  assert.equal(JSON.stringify(meaningfulLongWordGapSegments.map(segment => segment.text)), JSON.stringify(["もう", "待って"]));
  assert.equal(meaningfulLongWordGapSegments[0].start, 0.00);
  assert.equal(meaningfulLongWordGapSegments[1].start, 72.20);

  const naturalWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 2.95,
      text: "少し待って",
      words: [
        { word: "少し", start: 0.00, end: 0.40 },
        { word: "待って", start: 2.20, end: 2.95 }
      ]
    }]
  }, 0, 60);
  assert.equal(naturalWordGapSegments.length, 1);
  assert.equal(naturalWordGapSegments[0].text, "少し待って");

  const mediumWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 7.3,
      text: "少し待って",
      words: [
        { word: "少し", start: 0.00, end: 0.40 },
        { word: "待って", start: 6.50, end: 7.30 }
      ]
    }]
  }, 0, 60);
  assert.equal(mediumWordGapSegments.length, 1);
  assert.equal(mediumWordGapSegments[0].text, "少し待って");

  const matureShortWordGapSegments = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 36,
      text: "嗯开始结束",
      words: [
        { word: "嗯", start: 0.00, end: 0.30 },
        { word: "开始", start: 12.00, end: 12.50 },
        { word: "结束", start: 34.00, end: 35.00 }
      ]
    }]
  }, 0, 60, { disableCustomRunFilters: true, disableCustomQualityFilters: true });
  assert.equal(JSON.stringify(matureShortWordGapSegments.map(segment => segment.text)), JSON.stringify(["嗯", "开始", "结束"]));
  assert.equal(matureShortWordGapSegments[0].start, 0.00);
  assert.equal(matureShortWordGapSegments[1].start, 12.00);
  assert.equal(matureShortWordGapSegments[2].start, 34.00);

  assert.equal(JSON.stringify(
    context.normalizeAsrSegments({
      segments: [{
        start: 11.76,
        end: 12.2,
        text: "ご視聴ありがとうございました",
        no_speech_prob: 0.66,
        avg_logprob: -0.98
      }]
    }, 334, 362, { disableCustomQualityFilters: true })
  ),
    JSON.stringify([])
  );
  assert.equal(JSON.stringify(
    context.normalizeAsrSegments({
      segments: [{
        start: 0,
        end: 5.64,
        text: "おやすみなさい",
        no_speech_prob: 0.26,
        words: [
          { word: "お", start: 0, end: 0.08, probability: 0.06 },
          { word: "や", start: 0.08, end: 1.34, probability: 0.17 },
          { word: "す", start: 1.34, end: 2.58, probability: 0.84 },
          { word: "み", start: 2.58, end: 5.16, probability: 0.99 }
        ]
      }]
    }, 1594, 1622, { disableCustomQualityFilters: true })
  ),
    JSON.stringify([])
  );
  assert.equal(
    context.normalizeAsrSegments({
      segments: [{
        start: 0,
        end: 1.2,
        text: "おやすみなさい",
        no_speech_prob: 0.2,
        words: [
          { word: "おやすみ", start: 0, end: 0.7, probability: 0.9 },
          { word: "なさい", start: 0.7, end: 1.2, probability: 0.9 }
        ]
      }]
    }, 0, 30, { disableCustomQualityFilters: true })[0].text,
    "おやすみなさい"
  );

  assert.throws(() => context.normalizeAsrSegments({
    words: [{ word: "hello without timestamp" }]
  }, 0, 30), /时间戳/);
  assert.throws(() => context.normalizeAsrSegments({
    text: "text only without timestamp"
  }, 0, 30), /时间戳/);

  const ownedBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.2, end: 30.2, text: "跨界句" },
    { start: 30.5, end: 31.2, text: "核心句" },
    { start: 60.1, end: 61.2, text: "下一段" }
  ], { start: 28, end: 62, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(ownedBoundarySegments.map(segment => segment.text), ["跨界句", "核心句", "下一段"]);
  assert.equal(ownedBoundarySegments[0].start, 28.2);
  assert.equal(ownedBoundarySegments[0].end, 30.2);

  const previousBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.2, end: 30.2, text: "跨界句" },
    { start: 29.2, end: 29.8, text: "上一段" },
    { start: 29.6, end: 30.4, text: "正中边界句" }
  ], { start: 0, end: 32, coreStart: 0, coreEnd: 30 });
  assert.deepEqual(previousBoundarySegments.map(segment => segment.text), ["跨界句", "上一段", "正中边界句"]);
  assert.equal(previousBoundarySegments[0].end, 30.2);

  const nextBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 29.6, end: 30.4, text: "正中边界句" }
  ], { start: 22, end: 68, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(nextBoundarySegments.map(segment => segment.text), ["正中边界句"]);
  assert.equal(nextBoundarySegments[0].start, 29.6);

  const longBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 58.4, end: 61.4, text: "长句跨右边界" }
  ], { start: 52, end: 68, coreStart: 30, coreEnd: 60 });
  assert.equal(JSON.stringify(longBoundarySegments), JSON.stringify([{ start: 58.4, end: 61.4, text: "长句跨右边界" }]));

  const driftedBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.7, end: 29.7, text: "左侧漂移真实句" },
    { start: 60.2, end: 61.1, text: "右侧漂移真实句" },
    { start: 62.4, end: 63.1, text: "远端越界幻觉" },
    { start: 0, end: 300, text: "异常长越界幻觉" }
  ], { start: 28, end: 62, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(driftedBoundarySegments.map(segment => segment.text), ["左侧漂移真实句", "右侧漂移真实句"]);

  const noOverlapBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 0.2, end: 1.6, text: "核心短句" },
    { start: 60, end: 61, text: "无重叠越界幻觉" }
  ], { start: 0, end: 2, coreStart: 0, coreEnd: 2 });
  assert.deepEqual(noOverlapBoundarySegments.map(segment => segment.text), ["核心短句"]);

  const mergedOverlapDuplicates = context.mergeAdjacentDuplicateAsrSegments([
    { start: 29.6, end: 30.4, text: "边界重复句" },
    { start: 29.7, end: 30.5, text: "边界重复句" }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(mergedOverlapDuplicates)), [
    { start: 29.6, end: 30.5, text: "边界重复句" }
  ]);

  assert.equal(context.filterAsrSegmentsBySpeechActivity([
    { start: 0, end: 29.98, text: "由 Amara.org 社群提供的字幕" }
  ], { speechIntervals: [] }).length, 0);
  assert.deepEqual(
    context.filterAsrSegmentsBySpeechActivity([
      { start: 9.54, end: 11.3, text: "第一段测试语音" },
      { start: 11.3, end: 14.4, text: "西瓜摊位在早上9点开门" },
      { start: 14.4, end: 16.54, text: "请不要重复这句话" },
      { start: 43.58, end: 44.98, text: "西瓜摊位在早上9点开门" }
    ], { speechIntervals: [{ start: 10.004625, end: 16.676875 }] }).map(segment => segment.text),
    ["第一段测试语音", "西瓜摊位在早上9点开门", "请不要重复这句话"]
  );
  assert.equal(
    context.filterAsrSegmentsBySpeechActivity([{ start: 0, end: 2, text: "未知语音区间保留" }], {}).length,
    1
  );
  assert.deepEqual(
    context.filterAsrSegmentsBySpeechActivity(
      [{ start: 0, end: 2, text: "弱 VAD 判空但 ASR 识别到的语音" }],
      { speechIntervals: [], speechIntervalsReliable: false }
    ).map(segment => segment.text),
    ["弱 VAD 判空但 ASR 识别到的语音"]
  );
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard(
      [{ start: 20, end: 30, text: "ご視聴ありがとうございました" }],
      { speechIntervals: [{ start: 20.1, end: 20.25 }] }
    )
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard(
      [{
        start: 20,
        end: 27,
        text: "赤い青い赤い青い",
        words: [
          { text: "赤い", start: 20, end: 22.8, probability: 0.08 },
          { text: "青い", start: 22.8, end: 25.4, probability: 0.09 }
        ]
      }],
      { speechIntervals: [{ start: 0, end: 1 }, { start: 50, end: 51 }] }
    )
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard(
      [{ start: 0, end: 1.2, text: "おやすみなさい" }],
      { speechIntervals: [{ start: 0.05, end: 1.15 }] }
    ).map(segment => segment.text)
  ), JSON.stringify(["おやすみなさい"]));
  assert.equal(JSON.stringify(
    context.filterAsrSuspiciousRepeatedRuns([
      { start: 0, end: 1.3, text: "ご視聴ありがとうございました" },
      { start: 1.6, end: 2.9, text: "ご視聴ありがとうございました" }
    ]).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSuspiciousRepeatedRuns([
      { start: 0, end: 1.1, text: "正常な発話" },
      { start: 1.3, end: 2.4, text: "正常な発話" }
    ]).map(segment => segment.text)
  ), JSON.stringify(["正常な発話", "正常な発話"]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 0.6, text: "あー" },
      { start: 1.1, end: 1.7, text: "あー" },
      { start: 2.2, end: 2.8, text: "あー" },
      { start: 4.0, end: 5.2, text: "あー、 あー" },
      { start: 7.0, end: 8.8, text: "あー" },
      { start: 12.0, end: 14.5, text: "あー" }
    ], { speechIntervals: [{ start: 0, end: 15 }] }).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 1, text: "、" },
      { start: 1, end: 2, text: "、" },
      { start: 2, end: 3, text: "、" },
      { start: 3, end: 4, text: "、" }
    ], { speechIntervals: [{ start: 0, end: 4 }] }).map(segment => segment.text)
  ), JSON.stringify([]));
  assert.equal(JSON.stringify(
    context.filterAsrSegmentsByHallucinationGuard([
      { start: 0, end: 1, text: "待って" },
      { start: 1.1, end: 1.6, text: "うん" },
      { start: 1.8, end: 2.8, text: "行くよ" }
    ], { speechIntervals: [{ start: 0, end: 3 }] }).map(segment => segment.text)
  ), JSON.stringify(["待って", "うん", "行くよ"]));
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [] }), true);
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [], speechIntervalsReliable: false }), false);
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [{ start: 10, end: 16.7 }] }), false);
  assert.equal(context.shouldSkipBrowserAsrChunk({}), false);

  const speechSuppressed = context.filterAsrSegmentsBySpeechActivity([
    {
      start: 10,
      end: 20,
      text: "noise real",
      words: [
        { text: "noise", start: 10, end: 13, probability: 0.2 },
        { text: "real", start: 15, end: 16, probability: 0.9 }
      ]
    }
  ], { speechIntervals: [{ start: 14.8, end: 16.2 }] });
  assert.equal(speechSuppressed.length, 1);
  assert.equal(speechSuppressed[0].start, 15);
  assert.equal(speechSuppressed[0].end, 16);
  assert.equal(speechSuppressed[0].text, "real");

  const shortJapaneseWordPreserved = context.filterAsrSegmentsBySpeechActivity([
    {
      start: 285.86,
      end: 286.58,
      text: "面白いよ",
      words: [
        { text: "面", start: 285.86, end: 286.08, probability: 0.53 },
        { text: "白", start: 286.08, end: 286.28, probability: 1 },
        { text: "い", start: 286.28, end: 286.34, probability: 0.66 },
        { text: "よ", start: 286.34, end: 286.58, probability: 0.33 }
      ]
    }
  ], { speechIntervals: [{ start: 285.856, end: 287.2 }] });
  assert.equal(shortJapaneseWordPreserved.length, 1);
  assert.equal(shortJapaneseWordPreserved[0].text, "面白いよ");
}

{
  assert.equal(context.browserAsrUploadChunkSeconds({}), 900);
  assert.equal(context.browserAsrUploadChunkSeconds({ asrUploadChunkSeconds: 20 }), 20);
  assert.equal(context.browserAsrUploadChunkSeconds({ asrUploadChunkSeconds: 9999 }), 1800);
  assert.equal(context.browserAsrMaxUploadBytes({}), 25 * 1024 * 1024);
  assert.equal(context.browserAsrMaxUploadBytes({ maxUploadMb: 100 }), 100 * 1024 * 1024);
}

{
  const originalFetch = context.fetch;
  context.fetch = async url => {
    const host = new URL(String(url)).hostname;
    const withClip = host === "speaches-clip.example";
    const withSpeechTimestamps = host === "speaches-vad-endpoint.example";
    const fullVadFields = host === "speaches-full-vad.example";
    return {
      ok: true,
      json: async () => ({
        paths: {
          "/v1/audio/transcriptions": {
            post: {
              requestBody: {
                content: {
                  "application/x-www-form-urlencoded": {
                    schema: {
                      properties: {
                        vad_filter: { type: "boolean" },
                        ...(withClip ? { clip_timestamps: { type: "string" } } : {}),
                        ...(fullVadFields ? {
                          threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" }
                        } : {})
                      }
                    }
                  }
                }
              }
            }
          },
          ...(withSpeechTimestamps ? {
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          } : {})
        }
      })
    };
  };
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-endpoint.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 30);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 30);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-full-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 900);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asrUploadChunkSeconds: 20,
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 20);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-clip.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  }), 900);
  assert.equal(await context.browserAsrEffectiveUploadChunkSeconds({
    asr: {
      providerType: "openai",
      baseUrl: "https://speaches-vad-only.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "off"
    }
  }), 900);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const probedUrls = [];
  context.fetch = async url => {
    probedUrls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        paths: {
          "/v1/audio/transcriptions": {
            post: {
              requestBody: {
                content: {
                  "multipart/form-data": {
                    schema: { $ref: "#/components/schemas/Body_transcribe_file_v1_audio_transcriptions_post" }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            Body_transcribe_file_v1_audio_transcriptions_post: {
              properties: {
                vad_filter: { type: "boolean" },
                condition_on_previous_text: { type: "boolean" },
                no_speech_threshold: { type: "number" },
                max_speech_duration_s: { type: "number" },
                min_silence_duration_ms: { type: "integer" },
                speech_pad_ms: { type: "integer" },
                vad_parameters: { type: "string" },
                without_timestamps: { type: "boolean" }
              }
            }
          }
        }
      })
    };
  };
  assert.equal((await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://selfhosted.example/v1",
    model: "whisper-1"
  })).has("vad_filter"), true);
  assert.equal(JSON.stringify(Array.from(await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://selfhosted.example/v1",
    model: "whisper-1"
  })).sort()), JSON.stringify([
    "condition_on_previous_text",
    "max_speech_duration_s",
    "min_silence_duration_ms",
    "no_speech_threshold",
    "speech_pad_ms",
    "vad_filter",
    "vad_parameters",
    "without_timestamps"
  ]));
  assert.deepEqual(probedUrls, ["https://selfhosted.example/openapi.json"]);
  probedUrls.length = 0;
  assert.equal((await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://selfhosted-transcription.example/v1/audio/transcriptions",
    model: "whisper-1"
  })).has("vad_filter"), true);
  assert.deepEqual(probedUrls, ["https://selfhosted-transcription.example/openapi.json"]);
  probedUrls.length = 0;
  context.fetch = async url => {
    probedUrls.push(String(url));
    return { ok: true, json: async () => ({ openapi: "3.1.0", paths: {} }) };
  };
  assert.equal((await context.resolveBrowserAsrSupportedRequestFields({
    providerType: "openai",
    baseUrl: "https://faster-whisper-compatible.example/v1",
    model: "Systran/faster-whisper-large-v3"
  })).has("vad_filter"), false);
  assert.deepEqual(probedUrls, [
    "https://faster-whisper-compatible.example/openapi.json",
    "https://faster-whisper-compatible.example/v1/openapi.json"
  ]);
  context.fetch = originalFetch;
}

{
  assert.equal(context.schemaAudioTranscriptionRequestProperties({
    paths: {
      "/v1/audio/transcriptions": {
        post: {
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { vad_filter: { type: "boolean" } }
                }
              }
            }
          }
        }
      }
    }
  }).has("vad_filter"), true);
  assert.equal(context.schemaAudioTranscriptionRequestProperties({
    paths: {
      "/v1/audio/transcriptions": {
        post: {
          responses: {
            200: {
              description: "Mentions vad_filter only in response docs."
            }
          }
        }
      }
    },
    components: {
      schemas: {
        ResponseOnly: {
          type: "object",
          properties: { vad_filter: { type: "boolean" } }
        }
      }
    }
  }).has("vad_filter"), false);
  assert.equal(context.schemaAudioTranscriptionRequestProperties({
    paths: {
      "/health": {
        get: {
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { vad_filter: { type: "boolean" } }
                }
              }
            }
          }
        }
      }
    }
  }).has("vad_filter"), false);
}

{
  const originalFetch = context.fetch;
  const requests = [];
  const resolvers = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requests.push(segments.map(segment => segment.text));
    return await new Promise(resolve => {
      resolvers.push(() => resolve({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
              })
            }
          }]
        })
      }));
    });
  };
  const translationPromise = context.translateBrowserSegments(
    Array.from({ length: 61 }, (_, index) => ({
      start: index,
      end: index + 0.5,
      text: `parallel-${index}`,
      chunkIndex: 0,
      segmentIndex: index
    })),
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {},
    { batchWorkers: 2 }
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.length, 2, "second translation batch should start before the first one resolves");
  resolvers.forEach(resolve => resolve());
  const translated = await translationPromise;
  assert.equal(translated.length, 61);
  assert.equal(translated[0].text, "译文-parallel-0");
  assert.equal(translated[60].text, "译文-parallel-60");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [
        { start: 0, end: 1, text: "a" },
        { start: 1, end: 2, text: "b" },
        { start: 2, end: 3, text: "c" },
        { start: 3, end: 4, text: "d" }
      ],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /自动拆分/
  );
  assert.ok(calls <= 8, `automatic split retry used ${calls} LLM calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (requestedSizes.length === 1) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
            })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "c", chunkIndex: 0, segmentIndex: 2 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.deepEqual(requestedSizes, [3, 3]);
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-a", "译文-b", "译文-c"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    const items = requestedSizes.length === 1
      ? segments.map((segment, index) => ({ i: index + 10, text: `错位-${segment.text}` }))
      : segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }));
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "c", chunkIndex: 0, segmentIndex: 2 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.deepEqual(requestedSizes, [3, 3]);
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-a", "译文-b", "译文-c"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (segments.length > 1 || segments[0]?.text === "bad") {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "bad", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "c", chunkIndex: 0, segmentIndex: 2 },
      { start: 3, end: 4, text: "d", chunkIndex: 0, segmentIndex: 3 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-a", "译文-c", "译文-d"]));
  assert.equal(translated.some(segment => segment.text === "bad"), false);
  assert.ok(requestedSizes.some(size => size === 1), `expected fallback to retry single subtitles, got ${requestedSizes.join(",")}`);
  const failures = context.browserTranslationFailures(translated);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].source.text, "bad");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length > 1 || segments[0]?.text.startsWith("bad")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "bad-a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "bad-b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "ok-c", chunkIndex: 0, segmentIndex: 2 },
      { start: 3, end: 4, text: "ok-d", chunkIndex: 0, segmentIndex: 3 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-ok-c", "译文-ok-d"]));
  const failures = context.browserTranslationFailures(translated);
  assert.equal(JSON.stringify(failures.map(failure => failure.source.text)), JSON.stringify(["bad-a", "bad-b"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requestedSizes = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedSizes.push(segments.length);
    if (segments.length > 1 || segments.some(segment => segment.text === "blocked")) {
      return {
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: "Forbidden: content safety policy violation" }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "ok-a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "blocked", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "ok-c", chunkIndex: 0, segmentIndex: 2 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-ok-a", "译文-ok-c"]));
  assert.ok(requestedSizes.some(size => size === 1), `expected content policy fallback to retry single subtitles, got ${requestedSizes.join(",")}`);
  const failures = context.browserTranslationFailures(translated);
  assert.equal(JSON.stringify(failures.map(failure => failure.source.text)), JSON.stringify(["blocked"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({
      error: { message: "Forbidden: content safety policy violation" }
    })
  });
  const translated = await context.translateBrowserSegments(
    [{ start: 1, end: 2, text: "blocked only", chunkIndex: 0, segmentIndex: 0 }],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(translated.length, 0);
  assert.equal(JSON.stringify(context.browserTranslationFailures(translated).map(failure => failure.source.text)), JSON.stringify(["blocked only"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const splitRequests = [];
  const splitResolvers = [];
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length === 4) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    splitRequests.push(segments.map(segment => segment.text));
    return await new Promise(resolve => {
      splitResolvers.push(() => resolve({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                items: segments.map((segment, index) => ({ i: index, text: `译文-${segment.text}` }))
              })
            }
          }]
        })
      }));
    });
  };
  const translationPromise = context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "split-a", chunkIndex: 0, segmentIndex: 0 },
      { start: 1, end: 2, text: "split-b", chunkIndex: 0, segmentIndex: 1 },
      { start: 2, end: 3, text: "split-c", chunkIndex: 0, segmentIndex: 2 },
      { start: 3, end: 4, text: "split-d", chunkIndex: 0, segmentIndex: 3 }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {},
    { splitWorkers: 2 }
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(splitRequests.length, 2, "split fallback halves should start concurrently");
  splitResolvers.forEach(resolve => resolve());
  const translated = await translationPromise;
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify([
    "译文-split-a",
    "译文-split-b",
    "译文-split-c",
    "译文-split-d"
  ]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 403,
      json: async () => ({
        error: { message: "Forbidden: invalid API key" }
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [
        { start: 0, end: 1, text: "a", chunkIndex: 0, segmentIndex: 0 },
        { start: 1, end: 2, text: "b", chunkIndex: 0, segmentIndex: 1 }
      ],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /invalid api key/i
  );
  assert.equal(calls, 1);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length > 1 || segments[0]?.text.startsWith("bad")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  const sourceSegments = [
    ...Array.from({ length: 60 }, (_, index) => ({
      start: index,
      end: index + 0.5,
      text: `bad-${index}`,
      chunkIndex: 0,
      segmentIndex: index
    })),
    { start: 60, end: 61, text: "ok-final", chunkIndex: 0, segmentIndex: 60 }
  ];
  const translated = await context.translateBrowserSegments(
    sourceSegments,
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["译文-ok-final"]));
  assert.equal(context.browserTranslationFailures(translated).length, 60);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      Array.from({ length: 60 }, (_, index) => ({
        start: index,
        end: index + 0.5,
        text: `bad-${index}`,
        chunkIndex: 0,
        segmentIndex: index
      })),
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /没有得到可用译文/
  );
  assert.ok(calls <= 120, `60-line split fallback used ${calls} LLM calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  context.fetch = async (_url, init = {}) => {
    calls += 1;
    const body = JSON.parse(init.body);
    if (Object.hasOwn(body, "response_format")) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "response_format is not supported by this compatible endpoint" } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }]
      })
    };
  };
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      Array.from({ length: 60 }, (_, index) => ({
        start: index,
        end: index + 0.5,
        text: `response-format-bad-${index}`,
        chunkIndex: 0,
        segmentIndex: index
      })),
      {
        providerType: "openai",
        baseUrl: "https://llm-response-format-budget.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /没有得到可用译文/
  );
  assert.ok(calls <= 121, `response_format fallback plus 60-line split used ${calls} HTTP calls`);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, text: "" }] }) } }]
    })
  });
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [{ start: 0, end: 1, text: "hello" }],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /空译文/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ items: [{ i: 1, text: "错位译文" }] }) } }]
    })
  });
  await assert.rejects(
    () => context.translateBrowserSegmentsBatch(
      [{ start: 0, end: 1, text: "hello" }],
      {
        providerType: "openai",
        baseUrl: "https://llm.example/v1",
        model: "test-model",
        apiKey: "test-key"
      },
      "zh-CN",
      {}
    ),
    /索引/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let calls = 0;
  const requestedTexts = [];
  context.fetch = async (_url, init = {}) => {
    calls += 1;
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    requestedTexts.push(segments.map(segment => segment.text));
    const items = segments.length > 1
      ? [{ i: 0, text: "第一句译文" }]
      : segments.map(segment => ({ i: 0, text: `译文-${segment.text}` }));
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ items }) } }]
      })
    };
  };
  const translated = await context.translateBrowserSegmentsBatch(
    [
      { start: 0, end: 1, text: "a" },
      { start: 1, end: 2, text: "b" }
    ],
    {
      providerType: "openai",
      baseUrl: "https://llm.example/v1",
      model: "test-model",
      apiKey: "test-key"
    },
    "zh-CN",
    {}
  );
  assert.equal(calls, 2);
  assert.deepEqual(requestedTexts, [["a", "b"], ["b"]]);
  assert.equal(JSON.stringify(translated.map(segment => segment.text)), JSON.stringify(["第一句译文", "译文-b"]));
  context.fetch = originalFetch;
}

{
  const merged = context.normalizeBrowserSourceSegmentsForTranslation([
    { start: 89.06, end: 89.879, text: "算一下多少钱" },
    { start: 89.879, end: 89.939, text: "算一下多少钱" },
    { start: 90.5, end: 91, text: "下一句" }
  ], 2);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].start, 89.06);
  assert.equal(merged[0].end, 89.939);
  assert.equal(merged[0].text, "算一下多少钱");
  assert.equal(merged[0].chunkIndex, 2);
  assert.equal(merged[0].segmentIndex, 0);
  assert.equal(merged[1].segmentIndex, 1);

  const separated = context.normalizeBrowserSourceSegmentsForTranslation([
    { start: 1, end: 2, text: "谢谢" },
    { start: 2.4, end: 3, text: "谢谢" }
  ], 0);
  assert.equal(separated.length, 2);

  const different = context.normalizeBrowserSourceSegmentsForTranslation([
    { start: 1, end: 2, text: "谢谢" },
    { start: 2, end: 3, text: "謝謝" }
  ], 0);
  assert.equal(different.length, 2);
}

{
  const compressionHallucination = context.normalizeAsrSegments({
      segments: [{
        start: 0,
        end: 10,
        text: "お母さんのお母さんのお母さんのお母さんのお母さんのお母さんのお母さん",
        compression_ratio: 25.36,
        no_speech_prob: 0.44
      }]
    }, 900, 1200);
  assert.equal(compressionHallucination.length, 0);

  const repeatedHallucination = context.normalizeAsrSegments({
      segments: Array.from({ length: 8 }, (_, index) => ({
        start: index * 2,
        end: index * 2 + 2,
        text: "何か漏れてきちゃってますよ"
      }))
    }, 900, 1200);
  assert.equal(repeatedHallucination.length, 0);

  const noSpeechHallucination = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 30,
      text: "Thank you for watching.",
      compression_ratio: 1.12,
      no_speech_prob: 0.88,
      avg_logprob: -1.2
    }]
  }, 900, 930);
  assert.equal(noSpeechHallucination.length, 0);

  const noSpeechButConfidentSpeech = context.normalizeAsrSegments({
    segments: [{
      start: 0,
      end: 3,
      text: "これは本当の発話です",
      compression_ratio: 1.12,
      no_speech_prob: 0.88,
      avg_logprob: -0.2
    }]
  }, 900, 930);
  assert.equal(noSpeechButConfidentSpeech.length, 1);
  assert.equal(noSpeechButConfidentSpeech[0].text, "これは本当の発話です");

  const filteredHallucination = context.normalizeAsrSegments({
    segments: [
      { start: 0, end: 2, text: "正常第一句" },
      ...Array.from({ length: 5 }, (_, index) => ({
        start: 2 + index * 2,
        end: 4 + index * 2,
        text: "何か漏れてきちゃってますよ"
      })),
      { start: 14, end: 16, text: "正常第二句" }
    ]
  }, 900, 1200);
  assert.equal(JSON.stringify(filteredHallucination.map(segment => segment.text)), JSON.stringify(["正常第一句", "正常第二句"]));

  const repeatedSoundLabel = context.normalizeAsrSegments({
    segments: Array.from({ length: 15 }, (_, index) => ({
      start: 874.83 + index * 0.8,
      end: 875.43 + index * 0.8,
      text: "笑い声",
      compression_ratio: 9.85,
      no_speech_prob: 0.2
    }))
  }, 0, 900);
  assert.equal(repeatedSoundLabel.length, 0);

  const longSingleVocalization = context.normalizeAsrSegments({
    segments: [{
      start: 2108,
      end: 2124.25,
      text: "うううううううううううううううううううううううううううう"
    }]
  }, 2108, 2138);
  assert.equal(longSingleVocalization.length, 0);

  const longSingleRepeatedPhrase = context.normalizeAsrSegments({
    segments: [{
      start: 1490,
      end: 1518.58,
      text: "お腹が空いたら、お腹が空いたら、お腹が空いたら、お腹が空いたら、お腹が空いたら、"
    }]
  }, 1490, 1520);
  assert.equal(longSingleRepeatedPhrase.length, 0);

  const shortSpokenJapanese = context.normalizeAsrSegments({
    segments: [{
      start: 285.86,
      end: 286.58,
      text: "面白いよ"
    }]
  }, 270, 300);
  assert.equal(shortSpokenJapanese.length, 1);
  assert.equal(shortSpokenJapanese[0].text, "面白いよ");
}

function seedPage(tabId, { title = "Video", url = "https://example.test/watch/1", duration = 600 } = {}) {
  const state = context.getState(tabId);
  state.page = { title, url };
  state.context = { hasMedia: true, duration, href: url, title, currentTime: 0, frameId: 0 };
  return state;
}

function add(tabId, candidate) {
  context.addCandidate(tabId, {
    source: "request",
    seenAt: Date.now(),
    ...candidate
  });
}

{
  const record = {
    job: {
      id: "browser-progress-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 0, elapsedSeconds: 0 },
      translation: { chunkStatuses: [] }
    },
    startedAt: Date.now() - 5000,
    tabId: 700
  };
  context.applyBrowserExtractionProgress(record, {
    phase: "download",
    percent: 25,
    readySeconds: 180,
    internalChunksDone: 1,
    internalChunksTotal: 4,
    message: "已生成 1/4 个内部媒体切片"
  });
  assert.equal(record.job.extract.progress, 25);
  assert.equal(record.job.extract.readySeconds, 180);
  assert.equal(record.job.extract.internalChunksDone, 1);
  assert.equal(record.job.extract.internalChunksTotal, 4);
  assert.equal(record.job.extract.message, "已生成 1/4 个内部媒体切片");
  assert.equal(record.job.progress.extraction.readySeconds, 180);

  context.applyBrowserExtractionProgress(record, {
    phase: "ffmpeg",
    percent: 20,
    readySeconds: 120,
    message: "较旧进度不应让进度条后退"
  });
  assert.equal(record.job.extract.progress, 25);
  assert.equal(record.job.extract.readySeconds, 180);

  record.job.stage = "translation";
  context.applyBrowserExtractionProgress(record, {
    phase: "download",
    percent: 40,
    readySeconds: 360,
    message: "后续抽取进度不应覆盖更晚的处理阶段"
  });
  assert.equal(record.job.stage, "translation");
}

{
  const startedAt = Date.now() - 123480;
  assert.equal(context.elapsedSeconds(startedAt), 123);
}

{
  const record = {
    job: {
      id: "browser-chunk-status-test",
      status: "running",
      stage: "asr",
      extract: { status: "completed", progress: 100, elapsedSeconds: 0 },
      translation: { chunkStatuses: [context.createChunkStatus(0, "queued")] }
    },
    startedAt: Date.now() - 1000,
    tabId: 701
  };
  context.updateChunkStatus(record, 0, { stage: "asr", status: "识别" });
  assert.equal(typeof record.job.translation.chunkStatuses[0].stageStartedAt, "number");
  record.job.translation.chunkStatuses[0].stageStartedAt = 1;
  context.updateChunkStatus(record, 0, { stage: "asr", status: "识别", message: "仍在识别" });
  assert.equal(record.job.translation.chunkStatuses[0].stageStartedAt, 1);
  context.updateChunkStatus(record, 0, { stage: "translation", status: "翻译" });
  assert.equal(record.job.translation.chunkStatuses[0].stageStartedAt > 1, true);
}

{
  const tabId = 101;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/master.m3u8",
    kind: "hls",
    ext: "m3u8",
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/video-1080.mp4",
    kind: "video",
    ext: "mp4",
    contentType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    size: 9_600_000,
    initiator: "https://example.test/watch/1"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].role, "audio");
  assert.equal(candidates[0].hiddenCount, 2);
  assert.equal(Math.round(candidates[0].duration), 600);
}

{
  const tabId = 102;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/preview/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 120,
    initiator: "https://example.test/watch/1"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 2);
}

{
  const tabId = 103;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    source: "performance-entry"
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.role, "audio");
  assert.equal(Math.round(candidate.duration), 600);
}

{
  const tabId = 104;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "media",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });
  add(tabId, {
    url: "https://cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/1"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].hiddenCount, 0);
}

{
  const tabId = 106;
  seedPage(tabId, { duration: 600 });
  const url = "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s";
  add(tabId, {
    url,
    kind: "media",
    ext: "m4s",
    source: "performance-entry"
  });
  add(tabId, {
    url,
    kind: "audio",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 72_683
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "bilibili-playurl");
  assert.equal(candidate.role, "audio");
  assert.equal(Math.round(candidate.duration), 600);
}

{
  const tabId = 107;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?official=1",
    kind: "audio",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 125_995
  });
  add(tabId, {
    url: "https://xy115.example.mcdn.bilivideo.cn/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?from=performance",
    kind: "media",
    ext: "m4s",
    source: "performance-entry",
    duration: 600
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.source, "bilibili-playurl");
}

{
  const tabId = 120;
  seedPage(tabId, { title: "Bilibili ASR candidate", url: "https://www.bilibili.com/video/BV17DLP6UEPw", duration: 600 });
  add(tabId, {
    url: "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s",
    kind: "audio",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 125_995
  });
  add(tabId, {
    url: "https://upos-sz.example.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-100078.m4s",
    kind: "video",
    ext: "m4s",
    source: "bilibili-playurl",
    contentType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    duration: 600,
    bandwidth: 8_000_000
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.role, "audio");
  assert.match(candidate.url, /30232\.m4s/);
  assert.equal(candidate.hiddenCount, 1);
  assert.equal(candidate.variantStats.audio, 1);
  assert.equal(candidate.variantStats.video, 1);
}

{
  const tabId = 121;
  seedPage(tabId, { title: "Generic DASH ASR candidate", url: "https://example.test/watch/generic-dash", duration: 600 });
  add(tabId, {
    url: "https://cdn.example.test/dash/movie-30232.m4s",
    kind: "audio",
    role: "audio",
    ext: "m4s",
    source: "request",
    contentType: "audio/mp4",
    duration: 600,
    bandwidth: 132_000
  });
  add(tabId, {
    url: "https://cdn.example.test/dash/movie-100078.m4s",
    kind: "video",
    role: "video",
    ext: "m4s",
    source: "request",
    contentType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    duration: 600,
    bandwidth: 8_000_000
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.role, "audio");
  assert.match(candidate.url, /30232\.m4s/);
  assert.equal(candidate.hiddenCount, 1);
  assert.equal(candidate.variantStats.audio, 1);
  assert.equal(candidate.variantStats.video, 1);
}

{
  const tabId = 105;
  seedPage(tabId, { title: "HLS quality variants", url: "https://example.test/watch/hls", duration: 0 });
  add(tabId, {
    url: "https://cdn.example.test/path/video_1080p.m3u8",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    initiator: "https://example.test/watch/hls"
  });
  add(tabId, {
    url: "https://cdn.example.test/path/video_720p.m3u8",
    kind: "hls",
    ext: "m3u8",
    contentType: "application/vnd.apple.mpegurl",
    initiator: "https://example.test/watch/hls"
  });

  const candidates = context.getDisplayCandidates(tabId);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].hiddenCount, 0);
}

{
  const compactedHeaders = context.compactRequestHeaders([
    { name: "Authorization", value: "Bearer request-token" },
    { name: "Cookie", value: "sid=request-secret" },
    { name: "Referer", value: "https://example.test/watch" },
    { name: "Origin", value: "https://example.test" },
    { name: "User-Agent", value: "Chrome" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(compactedHeaders)), {
    authorization: "Bearer request-token"
  });
  assert.equal(JSON.stringify(compactedHeaders).includes("request-secret"), false);
}

{
  const tabId = 108;
  seedPage(tabId, { duration: 600 });
  add(tabId, {
    url: "https://secure-cdn.example.test/media/audio-128k.m4a",
    kind: "audio",
    ext: "m4a",
    contentType: "audio/mp4",
    duration: 600,
    initiator: "https://example.test/watch/secure",
    requestHeaders: {
      authorization: "Bearer display-secret",
      cookie: "sid=display-secret",
      referer: "https://example.test/watch/secure",
      origin: "https://example.test",
      "user-agent": "Chrome"
    }
  });

  const [candidate] = context.getDisplayCandidates(tabId);
  assert.equal(candidate.requestHeaders, undefined);
  assert.equal(JSON.stringify(candidate).includes("display-secret"), false);
  const internalCandidate = context.resolvePreloadCandidateForStart(context.getState(tabId), candidate);
  assert.deepEqual(JSON.parse(JSON.stringify(internalCandidate.requestHeaders)), {
    authorization: "Bearer display-secret"
  });
  assert.equal(JSON.stringify(internalCandidate.requestHeaders).includes("sid=display-secret"), false);
}

{
  const rules = context.buildMediaHeaderRules(
    "https://cdn.example.test/media/audio.m4a",
    "https://example.test/watch/1"
  );
  assert.equal(rules.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(rules[0].condition.requestDomains)), ["cdn.example.test"]);
  assert.deepEqual(JSON.parse(JSON.stringify(rules[0].action.requestHeaders)), [
    { header: "referer", operation: "set", value: "https://example.test/watch/1" },
    { header: "origin", operation: "set", value: "https://example.test" }
  ]);
  assert.equal(context.buildMediaHeaderRules("https://cdn.example.test/a.m4a", "chrome://extensions").length, 0);
}

{
  const rules = context.buildMediaHeaderRules([
    "https://cdn.example.test/hls/master.m3u8",
    "https://audio-cdn.example.test/hls/variant.m3u8",
    "https://key-cdn.example.test/hls/key.bin"
  ], "https://example.test/watch/1");
  assert.equal(rules.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(rules[0].condition.requestDomains)), [
    "audio-cdn.example.test",
    "cdn.example.test",
    "key-cdn.example.test"
  ]);
}

{
  const updates = [];
  const originalUpdateSessionRules = chrome.declarativeNetRequest.updateSessionRules;
  chrome.declarativeNetRequest.updateSessionRules = async payload => {
    updates.push(JSON.parse(JSON.stringify(payload)));
  };

  try {
    await context.withMediaRequestHeaderRules(
      "https://cdn.example.test/hls/master.m3u8",
      "https://example.test/watch/1",
      async () => {
        await context.updateMediaRequestHeaderRuleDomains("browser-cross-domain-hls", [
          "https://audio-cdn.example.test/hls/variant.m3u8",
          "https://segment-cdn.example.test/hls/seg-000.ts"
        ]);
      },
      "browser-cross-domain-hls"
    );
  } finally {
    chrome.declarativeNetRequest.updateSessionRules = originalUpdateSessionRules;
  }

  assert.equal(updates.length, 3);
  assert.deepEqual(updates[0].addRules[0].condition.requestDomains, ["cdn.example.test"]);
  assert.deepEqual(updates[1].removeRuleIds, updates[0].removeRuleIds);
  assert.deepEqual(updates[1].addRules[0].condition.requestDomains, [
    "audio-cdn.example.test",
    "cdn.example.test",
    "segment-cdn.example.test"
  ]);
  assert.deepEqual(updates[2], { removeRuleIds: updates[0].removeRuleIds });
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    sourceType: "direct",
    duration: 120,
    chunks: []
  }, 900, 120);
  assert.equal(chunks.length, 0);
  assert.match(
    context.createNoBrowserAudioChunksError({ sourceType: "direct", duration: 120, chunks: [] }).message,
    /没有返回可处理的音频切片/
  );
}

{
  assert.equal(context.browserAudioResultHasOnlyKnownNonspeech({
    sourceType: "direct",
    duration: 120,
    knownNonspeech: true,
    speechIntervals: [],
    chunks: []
  }), true);
  assert.equal(context.browserAudioResultHasOnlyKnownNonspeech({
    sourceType: "direct",
    duration: 120,
    chunks: []
  }), false);
}

{
  const buffer = vm.runInContext("new ArrayBuffer(8)", context);
  const chunks = context.normalizeBrowserAudioChunks({
    duration: 120,
    file: { name: "audio.mp3", mime: "audio/mpeg", buffer }
  }, 900, 120);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].bytes, 8);
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    duration: 120,
    chunks: [{
      index: 0,
      start: 0,
      end: 120,
      duration: 120,
      speechIntervals: [{ start: 10, end: 18 }],
      file: { name: "audio.mp3", mime: "audio/mpeg", cacheUrl: "chrome-extension://test/__fuguang_audio_cache/job/audio.mp3", bytes: 4096 },
      bytes: 4096
    }]
  }, 900, 120);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].bytes, 4096);
  assert.equal(chunks[0].file.cacheUrl.includes("__fuguang_audio_cache"), true);
  assert.equal(JSON.stringify(chunks[0].speechIntervals), JSON.stringify([{ start: 10, end: 18 }]));
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    sourceType: "hls",
    duration: 900,
    chunks: [{
      index: 0,
      start: 0,
      end: 600,
      duration: 600,
      file: {
        name: "logical-001.mp3",
        mime: "audio/mpeg",
        parts: [
          { file: { name: "extract-001.mp3", cacheUrl: "https://fuguang.local/audio/1", bytes: 1024 } },
          { file: { name: "extract-002.mp3", cacheUrl: "https://fuguang.local/audio/2", bytes: 2048 } }
        ]
      }
    }]
  }, 900, 900);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].duration, 600);
  assert.equal(chunks[0].bytes, 3072);
}

{
  const chunks = context.normalizeBrowserAudioChunks({
    sourceType: "direct",
    duration: 120,
    chunks: [{ index: 0, start: 0, end: 120, duration: 120, bytes: 4096 }]
  }, 900, 120);
  assert.equal(chunks.length, 0);
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  const jobId = "browser-cache-clear-test";
  const knownUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test/logical-001.mp3";
  const leftoverInternalUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test-0/internal-001.mp3";
  const leftoverConcatUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test-logical-0/concat.mp3";
  const unrelatedUrl = "https://fuguang.local/__fuguang_audio_cache/browser-cache-clear-test-older/keep.mp3";
  await cache.put(knownUrl, new FakeResponse(new Uint8Array([1]).buffer));
  await cache.put(leftoverInternalUrl, new FakeResponse(new Uint8Array([2]).buffer));
  await cache.put(leftoverConcatUrl, new FakeResponse(new Uint8Array([3]).buffer));
  await cache.put(unrelatedUrl, new FakeResponse(new Uint8Array([4]).buffer));

  const removed = await context.clearBrowserAudioCacheForJob(jobId, [{
    file: {
      name: "logical-001.mp3",
      mime: "audio/mpeg",
      cacheUrl: knownUrl,
      bytes: 1
    }
  }]);

  assert.equal(removed, 3);
  assert.equal(await cache.match(knownUrl), undefined);
  assert.equal(await cache.match(leftoverInternalUrl), undefined);
  assert.equal(await cache.match(leftoverConcatUrl), undefined);
  assert.notEqual(await cache.match(unrelatedUrl), undefined);
}

{
  const record = {
    tabId: 710,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 60,
    job: {
      id: "browser-streaming-logical-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const makeInternalChunk = index => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    file: {
      name: `internal-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  for (let index = 0; index < 1; index += 1) {
    const emitted = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(index));
    assert.equal(emitted.length, 0);
  }
  assert.equal((record.audioChunks || []).length, 0);
  assert.equal(record.job.translation.chunksTotal, 0);

  const emitted = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(1));
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].start, 0);
  assert.equal(record.audioChunks[0].end, 60);
  assert.equal(record.audioChunks[0].file.parts.length, 2);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
  assert.equal(record.browserAsrQueue.items.length, 1);
  assert.throws(
    () => context.assertBrowserAsrChunkCanUpload(record.audioChunks[0]),
    /不能直接字节拼接/
  );
}

{
  const record = {
    tabId: 715,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-vad-speech-window-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const makeInternalChunk = (index, speechIntervals) => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    speechIntervals,
    file: {
      name: `vad-internal-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/vad-${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  assert.equal(context.appendBrowserInternalAudioChunk(record, makeInternalChunk(0, [{ start: 2, end: 8 }])).length, 0);
  const emittedBeforeSilence = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(1, []));
  assert.equal(emittedBeforeSilence.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].start, 0);
  assert.equal(record.audioChunks[0].end, 30);
  assert.equal(record.audioChunks[0].file.name, "vad-internal-0.mp3");
  assert.equal(JSON.stringify(record.audioChunks[0].speechIntervals), JSON.stringify([{ start: 2, end: 8 }]));

  assert.equal(context.appendBrowserInternalAudioChunk(record, makeInternalChunk(2, [{ start: 62, end: 68 }])).length, 0);
  const emittedTail = context.flushBrowserInternalAudioChunks(record, true);
  assert.equal(emittedTail.length, 1);
  assert.equal(record.audioChunks.length, 2);
  assert.equal(record.audioChunks[1].start, 60);
  assert.equal(record.audioChunks[1].end, 90);
  assert.equal(record.browserAsrQueue.items.length, 2);
  assert.equal(JSON.stringify(record.audioChunks.map(chunk => chunk.file.name)), JSON.stringify(["vad-internal-0.mp3", "vad-internal-2.mp3"]));
}

{
  const record = {
    tabId: 716,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-vad-all-nonspeech-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };

  context.appendBrowserInternalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    speechIntervals: [],
    file: {
      name: "music-only.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/music-only",
      bytes: 1024
    },
    bytes: 1024
  });
  context.flushBrowserInternalAudioChunks(record, true);

  assert.equal((record.audioChunks || []).length, 0);
  assert.equal(record.browserAsrQueue.items.length, 0);
  assert.equal(context.browserPreloadRecordHasOnlyKnownNonspeechAudio(record), true);
}

{
  const record = {
    tabId: 718,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-weak-vad-empty-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const weakEmptyChunk = index => ({
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    speechIntervals: [],
    speechIntervalsReliable: false,
    file: {
      name: `weak-vad-empty-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/weak-vad-empty-${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  assert.equal(context.appendBrowserInternalAudioChunk(record, weakEmptyChunk(0)).length, 0);
  assert.equal(context.appendBrowserInternalAudioChunk(record, weakEmptyChunk(1)).length, 0);
  const emitted = context.flushBrowserInternalAudioChunks(record, true);
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].speechIntervalsReliable, false);
  assert.equal(context.shouldSkipBrowserAsrChunk(record.audioChunks[0]), false);
  assert.equal(record.browserAsrQueue.items.length, 1);
}

{
  const record = {
    tabId: 712,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900, asrWorkers: 3, workers: 3 },
    job: {
      id: "browser-logical-direct-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 90, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };

  const emitted = context.appendBrowserInternalAudioChunk(record, {
    logical: true,
    index: 0,
    start: 0,
    end: 900,
    duration: 900,
    internalChunkCount: 5,
    file: {
      name: "logical-001.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/logical-001.mp3",
      bytes: 5120
    },
    bytes: 5120
  });

  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].file.name, "logical-001.mp3");
  assert.equal(record.audioChunks[0].file.parts, undefined);
  assert.equal(record.browserInternalAudioChunks.length, 0);
  assert.equal(record.browserAsrQueue.items.length, 1);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.doesNotThrow(() => context.assertBrowserAsrChunkCanUpload(record.audioChunks[0]));
  assert.doesNotThrow(
    () => context.assertBrowserAsrChunkCanUpload({
      duration: 900,
      file: {
        name: "duration-only.mp3",
        mime: "audio/mpeg",
        cacheUrl: "https://fuguang.local/audio/duration-only.mp3",
        bytes: 5120
      }
    })
  );
  assert.throws(
    () => context.assertBrowserAsrChunkCanUpload({
      duration: 60,
      file: {
        name: "too-large.mp3",
        mime: "audio/mpeg",
        cacheUrl: "https://fuguang.local/audio/too-large.mp3",
        bytes: (25 * 1024 * 1024) + 1
      }
    }),
    /识别音频分段过大/
  );
}

{
  const record = {
    tabId: 713,
    startedAt: Date.now() - 1000,
    metadata: { duration: 1800 },
    modelConfig: { chunkSeconds: 900, asrWorkers: 3, workers: 2 },
    job: {
      id: "browser-asr-upload-decouple-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const makeLogicalChunk = index => ({
    logical: true,
    index,
    start: index * 30,
    end: (index + 1) * 30,
    duration: 30,
    file: {
      name: `asr-upload-${index + 1}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/asr-upload-${index + 1}.mp3`,
      bytes: 4096
    },
    bytes: 4096
  });

  context.appendBrowserInternalAudioChunk(record, makeLogicalChunk(0));
  context.appendBrowserInternalAudioChunk(record, makeLogicalChunk(1));

  assert.equal(record.audioChunks.length, 2);
  assert.equal(record.browserAsrQueue.items.length, 2);
  assert.equal(record.browserTranslationGroups.size, 1);
  assert.equal(record.browserTranslationGroups.get(0).total, 2);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.equal(record.job.translation.chunkStatuses.length, 1);
  assert.equal(record.browserAsrChunkToTranslationGroup.get(0), 0);
  assert.equal(record.browserAsrChunkToTranslationGroup.get(1), 0);
}

{
  const record = {
    tabId: 719,
    startedAt: Date.now() - 1000,
    metadata: { duration: 1800 },
    modelConfig: { chunkSeconds: 900, asrWorkers: 1, workers: 1 },
    job: {
      id: "browser-first-window-translation-races-next-extract",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 35, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  const chunk = {
    logical: true,
    index: 0,
    start: 0,
    end: 900,
    coreStart: 0,
    coreEnd: 900,
    duration: 900,
    file: {
      name: "logical-first-window.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/logical-first-window.mp3",
      bytes: 8192
    },
    bytes: 8192
  };

  context.enqueueBrowserLogicalAudioChunk(record, chunk);
  const group = record.browserTranslationGroups.get(0);
  assert.equal(group.closed, true);
  assert.equal(record.browserTranslationQueue.items.length, 0);

  context.completeBrowserAsrChunkForGroup(record, chunk, [
    { start: 10, end: 12, text: "first window source" }
  ]);

  assert.equal(record.browserTranslationQueue.items.length, 1);
  assert.equal(record.browserTranslationQueue.items[0].chunk.index, 0);
  assert.equal(record.browserTranslationQueue.items[0].sourceSegments[0].text, "first window source");
}

{
  const record = {
    tabId: 714,
    startedAt: Date.now() - 1000,
    metadata: { duration: 90 },
    modelConfig: { chunkSeconds: 30, asrWorkers: 1, workers: 1 },
    job: {
      id: "browser-asr-core-ownership-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 50, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };

  context.appendBrowserInternalAudioChunk(record, {
    logical: true,
    index: 1,
    start: 28,
    end: 62,
    coreStart: 30,
    coreEnd: 60,
    duration: 34,
    coreDuration: 30,
    file: {
      name: "asr-upload-overlap-002.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/asr-upload-overlap-002.mp3",
      bytes: 4096
    },
    bytes: 4096
  });

  assert.equal(record.audioChunks[0].start, 28);
  assert.equal(record.audioChunks[0].coreStart, 30);
  assert.equal(context.browserTranslationGroupIndex(record, record.audioChunks[0]), 1);
  assert.equal(record.browserAsrChunkToTranslationGroup.get(1), 1);
}

{
  const record = {
    tabId: 711,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
    job: {
      id: "browser-streaming-tail-test",
      status: "running",
      stage: "extracting",
      extract: { status: "running", progress: 99, elapsedSeconds: 0 },
      translation: { chunkStatuses: [], chunksTotal: 0, chunksDone: 0 }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  context.appendBrowserInternalAudioChunk(record, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    file: {
      name: "tail.mp3",
      mime: "audio/mpeg",
      cacheUrl: "https://fuguang.local/audio/tail",
      bytes: 2048
    },
    bytes: 2048
  });
  assert.equal((record.audioChunks || []).length, 0);
  const emitted = context.flushBrowserInternalAudioChunks(record, true);
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks[0].duration, 30);
  assert.equal(record.audioChunks[0].file.name, "tail.mp3");
  assert.equal(record.browserAsrQueue.items.length, 1);
  context.assertBrowserAsrChunkCanUpload(record.audioChunks[0]);
}

{
  const tabId = 201;
  let injections = 0;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalExecuteScript = chrome.scripting.executeScript;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleOverlayInjectedAt = Date.now() - 10_000;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE" && options.frameId === 5) {
      return { ok: true, state: { currentTime: 12, duration: 600 } };
    }
    return null;
  };
  chrome.scripting.executeScript = async () => {
    injections += 1;
    return [];
  };

  await context.ensureSubtitleOverlay(tabId);

  assert.equal(injections, 0);
  assert.equal(context.getState(tabId).mediaFrameId, 5);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.scripting.executeScript = originalExecuteScript;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 202;
  let injections = 0;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalExecuteScript = chrome.scripting.executeScript;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleOverlayInjectedAt = Date.now() - 10_000;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }];
  chrome.tabs.sendMessage = async () => null;
  chrome.scripting.executeScript = async () => {
    injections += 1;
    return [];
  };

  await context.ensureSubtitleOverlay(tabId);

  assert.equal(injections, 1);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.scripting.executeScript = originalExecuteScript;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 2021;
  let injections = 0;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalExecuteScript = chrome.scripting.executeScript;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  const state = seedPage(tabId, { duration: 600 });
  state.subtitleOverlayInjectedAt = Date.now();
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }];
  chrome.tabs.sendMessage = async () => null;
  chrome.scripting.executeScript = async () => {
    injections += 1;
    return [];
  };

  await context.ensureSubtitleOverlay(tabId);

  assert.equal(injections, 1);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.scripting.executeScript = originalExecuteScript;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 203;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.attachedVttSignature = "job-1:10:10:translated";

  context.suppressPreloadSubtitleAttachment(tabId, "job-1");

  assert.equal(state.attachedVttSignature, "");
  assert.equal(context.isPreloadSubtitleAttachmentSuppressed(tabId, "job-1"), true);
  assert.equal(context.isPreloadSubtitleAttachmentSuppressed(tabId, "job-2"), false);
  assert.equal(context.withSubtitleSuppression({ id: "job-1", status: "completed" }, tabId).subtitleCleared, true);
  assert.equal(context.withSubtitleSuppression({ id: "job-2", status: "completed" }, tabId).subtitleCleared, undefined);
}

{
  const record = {
    tabId: 211,
    startedAt: Date.now() - 1000,
    metadata: { duration: 60 },
    modelConfig: { chunkSeconds: 30, asrWorkers: 1, workers: 1 },
    audioChunks: [],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-asr-source-preview",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  const chunk = {
    logical: true,
    index: 0,
    start: 0,
    end: 30,
    coreStart: 0,
    coreEnd: 30,
    duration: 30,
    file: { name: "preview-source.mp3", buffer: new ArrayBuffer(1), mime: "audio/mpeg" }
  };
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.attachBrowserJobVttIfReady = async () => {};
  context.enqueueBrowserLogicalAudioChunk(record, chunk);
  record.browserTranslationGroups.get(0).closed = true;

  context.completeBrowserAsrChunkForGroup(record, chunk, [
    { start: 1, end: 2, text: "source preview" }
  ]);

  assert.equal(record.job.translation.vttPath, "browser-memory");
  assert.match(record.job.translation.vttText, /source preview/);
  assert.equal(record.job.translation.sourceSegments, 1);
  assert.equal(record.job.translation.translatedSegments, 0);
  assert.equal(record.job.translation.segmentCount, 1);
  assert.equal(record.job.translation.transcript.source[0].text, "source preview");
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 212,
    startedAt: Date.now() - 1000,
    metadata: { duration: 600 },
    sourceSegmentsByChunk: new Map([
      [0, [{ start: 10, end: 120, text: "only the first part", chunkIndex: 0, segmentIndex: 0 }]]
    ]),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [{ index: 0 }],
    job: {
      id: "browser-short-coverage-warning",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1, duration: 600 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };

  const result = context.finalizeBrowserCompletionState(record);

  assert.equal(result.failed, 0);
  assert.match(result.coverageWarning, /字幕只覆盖到/);
  assert.equal(record.job.status, "completed");
  assert.equal(record.job.stage, "completed_with_warnings");
  assert.match(record.job.error, /预计/);
}

{
  const record = {
    tabId: 213,
    startedAt: Date.now() - 1000,
    metadata: { duration: 600 },
    sourceSegmentsByChunk: new Map([
      [0, [{ start: 10, end: 570, text: "nearly full coverage", chunkIndex: 0, segmentIndex: 0 }]]
    ]),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [{ index: 0 }],
    job: {
      id: "browser-good-coverage-completed",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1, duration: 600 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };

  const result = context.finalizeBrowserCompletionState(record);

  assert.equal(result.failed, 0);
  assert.equal(result.coverageWarning, "");
  assert.equal(record.job.status, "completed");
  assert.equal(record.job.stage, "completed");
  assert.equal(record.job.error, "");
  assert.equal(
    context.browserCompletionAllowsAudioRelease(result),
    false,
    "成功完成后仍应保留音频缓存供诊断导出和失败复盘，直到用户显式清理"
  );
}

{
  const record = {
    tabId: 214,
    startedAt: Date.now() - 1000,
    metadata: { duration: 600 },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    audioChunks: [{ index: 0 }],
    job: {
      id: "browser-no-subtitle-coverage-warning",
      status: "running",
      stage: "asr",
      extract: { elapsedSeconds: 1, duration: 600 },
      translation: {
        chunkStatuses: [],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 0
      }
    }
  };

  const result = context.finalizeBrowserCompletionState(record);

  assert.equal(result.failed, 0);
  assert.match(result.coverageWarning, /没有生成可显示字幕/);
  assert.equal(record.job.status, "completed");
  assert.equal(record.job.stage, "completed_with_warnings");
  assert.match(record.job.error, /没有生成可显示字幕/);
}

{
  const tabId = 204;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const sentTypes = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      sentTypes.push("detach");
      return { ok: true };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentTypes.push("attach");
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachVttText(tabId, "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual cache\n");
  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-after-manual",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"
      }
    }
  });

  assert.deepEqual(sentVtts, ["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual cache\n"]);
  assert.deepEqual(sentTypes, ["detach", "attach"]);
  assert.match(state.manualVttSignature, /^manual:/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 205;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-without-manual",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"
      }
    }
  });

  assert.deepEqual(sentVtts, ["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 215;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-partial-source-fallback",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        segmentCount: 2,
        chunksDone: 1,
        vttText: [
          "WEBVTT",
          "",
          "00:00:00.000 --> 00:00:02.000",
          "source first",
          "",
          "00:00:03.000 --> 00:00:05.000",
          "translated second",
          ""
        ].join("\n"),
        transcript: {
          source: [
            { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
            { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
          ],
          translated: [
            { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
          ]
        }
      }
    }
  });

  assert.equal(sentVtts.length, 1);
  assert.match(sentVtts[0], /source first/);
  assert.match(sentVtts[0], /translated second/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 216;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-failed-source-only",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource only\n",
        transcript: {
          source: [{ start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }],
          translated: []
        }
      }
    }
  });

  assert.equal(sentVtts.length, 1);
  assert.match(sentVtts[0], /source only/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 218;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-running-partial-source-preview",
      status: "running",
      stage: "translation",
      translation: {
        segmentCount: 2,
        chunksDone: 0,
        vttText: [
          "WEBVTT",
          "",
          "00:00:00.000 --> 00:00:02.000",
          "source first",
          "",
          "00:00:03.000 --> 00:00:05.000",
          "translated second",
          ""
        ].join("\n"),
        transcript: {
          source: [
            { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
            { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
          ],
          translated: [
            { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
          ]
        }
      }
    }
  });

  assert.equal(sentVtts.length, 1);
  assert.match(sentVtts[0], /source first/);
  assert.match(sentVtts[0], /translated second/);
  assert.doesNotMatch(sentVtts[0], /source second\ntranslated second/);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 217;
  seedPage(tabId, { duration: 600 });
  context.getState(tabId).subtitleOverlayInjectedAt = Date.now();
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-running-source-only",
      status: "running",
      stage: "translation",
      translation: {
        segmentCount: 1,
        chunksDone: 0,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource only while running\n",
        transcript: {
          source: [{ start: 0, end: 2, text: "source only while running", chunkIndex: 0, segmentIndex: 0 }],
          translated: []
        }
      }
    }
  });

  assert.deepEqual(sentVtts, [
    "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nsource only while running\n"
  ]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 207;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  state.attachedVttSignature = "browser-auto-reattach:1:1:translated";
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: "" } };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      return { ok: true };
    }
    return null;
  };

  await context.attachBrowserJobVttIfReady({
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-reattach",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"
      }
    }
  });

  assert.deepEqual(sentVtts, ["WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nauto job\n"]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 210;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  let attachedSignature = "";
  const sentVtts = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: attachedSignature } };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentVtts.push(message.vtt);
      attachedSignature = message.signature;
      return { ok: true };
    }
    return null;
  };
  const record = {
    tabId,
    metadata: { pageUrl: context.getState(tabId).page.url },
    job: {
      id: "browser-auto-vtt-change",
      status: "completed",
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold text\n"
      }
    }
  };

  await context.attachBrowserJobVttIfReady(record);
  record.job.translation.vttText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnew text\n";
  await context.attachBrowserJobVttIfReady(record);

  assert.deepEqual(sentVtts, [
    "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nold text\n",
    "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nnew text\n"
  ]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 209;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  const vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nmanual cache\n";
  const signature = `manual:${context.vttContentSignature(vtt)}`;
  state.attachedVttSignature = signature;
  state.manualVttSignature = signature;
  const sentTypes = [];
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async (_tabId, message) => {
    if (message.type === "FUGUANG_GET_VIDEO_STATE") {
      return { ok: true, state: { currentTime: 0, duration: 600, subtitleSignature: "" } };
    }
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      sentTypes.push("detach");
      return { ok: true };
    }
    if (message.type === "FUGUANG_ATTACH_VTT") {
      sentTypes.push("attach");
      return { ok: true };
    }
    return null;
  };

  await context.attachVttText(tabId, vtt);

  assert.deepEqual(sentTypes, ["detach", "attach"]);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const tabId = 206;
  seedPage(tabId, { duration: 600 });
  const state = context.getState(tabId);
  state.subtitleOverlayInjectedAt = Date.now();
  state.mediaFrameId = 5;
  const originalSendMessage = chrome.tabs.sendMessage;
  const originalGetAllFrames = chrome.webNavigation.getAllFrames;
  chrome.webNavigation.getAllFrames = async () => [{ frameId: 0 }, { frameId: 5 }];
  chrome.tabs.sendMessage = async (_tabId, message, options = {}) => {
    if (message.type === "FUGUANG_DETACH_PRELOAD_VTT") {
      return { ok: true };
    }
    if (message.type === "FUGUANG_ATTACH_VTT" && options.frameId === 5) {
      return { ok: true };
    }
    if (message.type === "FUGUANG_GET_VIDEO_STATE" && options.frameId === 5) {
      return { ok: true, state: { currentTime: 22, duration: 600 } };
    }
    if (message.type === "FUGUANG_GET_VIDEO_STATE" && options.frameId === 0) {
      return { ok: true, state: { currentTime: 3, duration: 600 } };
    }
    return null;
  };

  await context.attachVttText(tabId, "WEBVTT\n\n00:00:20.000 --> 00:00:24.000\nmanual cache\n");
  state.mediaFrameId = 0;
  const response = await context.getVideoState(tabId);

  assert.equal(state.subtitleFrameId, 5);
  assert.equal(response.state.currentTime, 22);
  chrome.tabs.sendMessage = originalSendMessage;
  chrome.webNavigation.getAllFrames = originalGetAllFrames;
}

{
  const tabId = 208;
  const state = seedPage(tabId, { duration: 600 });
  state.context.currentTime = 18;
  const originalSendMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = async () => null;

  const response = await context.getVideoState(tabId);

  assert.equal(response.state.currentTime, 18);
  assert.equal(response.state.synthetic, true);
  chrome.tabs.sendMessage = originalSendMessage;
}

{
  const sourceSegment = { start: 1, end: 2, text: "hello", chunkIndex: 0, segmentIndex: 0 };
  const record = {
    tabId: 300,
    startedAt: Date.now() - 1000,
    metadata: { title: "Translation failure keeps source only" },
    modelConfig: {
      targetLanguage: "zh-CN",
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [],
    sourceSegmentsByChunk: new Map([[0, [sourceSegment]]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-translation-failure-source-only",
      status: "running",
      stage: "translation",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "queued", status: "等待", attempts: 1 }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  const originalTranslate = context.translateBrowserSegments;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.translateBrowserSegments = async () => {
    throw new Error("mock translation failed");
  };
  context.attachBrowserJobVttIfReady = async () => {};

  await context.processBrowserTranslationChunk(record, { index: 0 }, [sourceSegment]);

  assert.deepEqual(JSON.parse(JSON.stringify(record.translatedSegmentsByChunk.get(0))), []);
  assert.deepEqual(JSON.parse(JSON.stringify(record.job.translation.transcript.translated)), []);
  assert.equal(record.job.translation.transcript.source[0].text, "hello");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "failed");
  assert.match(record.job.translation.chunkStatuses[0].error, /翻译失败/);
  context.translateBrowserSegments = originalTranslate;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const originalFetch = context.fetch;
  const calls = [];
  context.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (calls.length === 1) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "response_format is not supported by this compatible endpoint" } })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: "兼容接口译文" }] })
          }
        }]
      })
    };
  };

  const items = await context.requestBrowserTranslationItems(
    [{ start: 1, end: 2, text: "hello" }],
    { providerType: "openai", baseUrl: "https://llm-compatible.test/v1", model: "test", apiKey: "test" },
    "zh-CN",
    { title: "response_format fallback" },
    { timeoutMs: 1000 }
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(body => Object.hasOwn(body, "response_format")), [true, false]);
  assert.equal(items[0].text, "兼容接口译文");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const calls = [];
  context.fetch = async (_url, init = {}) => {
    calls.push(JSON.parse(init.body));
    return {
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid api key" } })
    };
  };

  await assert.rejects(
    context.requestBrowserTranslationItems(
      [{ start: 1, end: 2, text: "hello" }],
      { providerType: "openai", baseUrl: "https://llm-invalid-key-compatible.test/v1", model: "test", apiKey: "bad" },
      "zh-CN",
      { title: "response_format fallback negative" },
      { timeoutMs: 1000 }
    ),
    /invalid api key/
  );
  assert.equal(calls.length, 1);
  assert.equal(Object.hasOwn(calls[0], "response_format"), true);
  context.fetch = originalFetch;
}

{
  const sourceSegments = [
    { start: 1, end: 2, text: "ok-a", chunkIndex: 0, segmentIndex: 0 },
    { start: 2, end: 3, text: "bad", chunkIndex: 0, segmentIndex: 1 },
    { start: 3, end: 4, text: "ok-c", chunkIndex: 0, segmentIndex: 2 }
  ];
  const record = {
    tabId: 303,
    startedAt: Date.now() - 1000,
    metadata: { title: "Translation partial failure keeps only real translations" },
    modelConfig: {
      targetLanguage: "zh-CN",
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [],
    sourceSegmentsByChunk: new Map([[0, sourceSegments]]),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-translation-partial-failure",
      status: "running",
      stage: "translation",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "queued", status: "等待", attempts: 1 }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 0
      }
    }
  };
  const originalFetch = context.fetch;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.fetch = async (_url, init = {}) => {
    const payload = JSON.parse(init.body);
    const userMessage = payload.messages.find(message => message.role === "user");
    const request = JSON.parse(userMessage.content);
    const segments = request.segments || [];
    if (segments.length > 1 || segments[0]?.text === "bad") {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "not json" } }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({ items: [{ i: 0, text: `译文-${segments[0].text}` }] })
          }
        }]
      })
    };
  };
  context.attachBrowserJobVttIfReady = async () => {};

  await context.processBrowserTranslationChunk(record, { index: 0 }, sourceSegments);

  assert.equal(JSON.stringify(record.translatedSegmentsByChunk.get(0).map(segment => segment.text)), JSON.stringify(["译文-ok-a", "译文-ok-c"]));
  assert.equal(JSON.stringify(record.job.translation.transcript.translated.map(segment => segment.text)), JSON.stringify(["译文-ok-a", "译文-ok-c"]));
  assert.equal(record.job.translation.transcript.translated.some(segment => segment.text === "bad"), false);
  assert.match(record.job.translation.vttText, /bad/);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed_with_warnings");
  assert.match(record.job.translation.chunkStatuses[0].error, /部分句子翻译失败/);
  context.fetch = originalFetch;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 301,
    metadata: { title: "Retry translation only" },
    modelConfig: {
      asrWorkers: 3,
      workers: 2,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3" } }],
    sourceSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "hello", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 1, end: 2, text: "old", chunkIndex: 0, segmentIndex: 0 }]]]),
    job: {
      id: "browser-retry-translation-only",
      status: "failed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{
          index: 0,
          stage: "failed",
          status: "失败",
          attempts: 1,
          sourceCount: 1,
          translatedCount: 1,
          error: "翻译失败"
        }],
        chunksTotal: 1,
        chunksDone: 0,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let asrCalls = 0;
  let translationCalls = 0;
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeBrowserAudioChunk = async () => {
    asrCalls += 1;
    return [{ start: 1, end: 2, text: "fresh asr" }];
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: "译文" }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  await context.retryBrowserFailedPreload(record, [0]);

  assert.equal(asrCalls, 0);
  assert.equal(translationCalls, 1);
  assert.equal(record.translatedSegmentsByChunk.get(0)[0].text, "译文");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  context.transcribeBrowserAudioChunk = originalTranscribe;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 302,
    metadata: { title: "Resume ASR from cached audio" },
    modelConfig: {
      asrWorkers: 2,
      workers: 2,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [
      { index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } },
      { index: 1, start: 900, end: 1800, file: { name: "chunk-002.mp3", buffer: new ArrayBuffer(1) } }
    ],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-resume-asr-from-audio",
      status: "completed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [
          { index: 0, stage: "queued", status: "排队", attempts: 0 },
          { index: 1, stage: "queued", status: "排队", attempts: 0 }
        ],
        chunksTotal: 2,
        chunksDone: 0,
        chunksFailed: 0,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  let asrCalls = 0;
  let translationCalls = 0;
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalTranslate = context.translateBrowserSegments;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeBrowserAudioChunk = async chunk => {
    asrCalls += 1;
    return [{ start: chunk.start + 1, end: chunk.start + 2, text: `source-${chunk.index}` }];
  };
  context.translateBrowserSegments = async segments => {
    translationCalls += 1;
    return segments.map(segment => ({ ...segment, text: `译文-${segment.chunkIndex}` }));
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  await context.retryBrowserFailedPreload(record);

  assert.equal(asrCalls, 2);
  assert.equal(translationCalls, 2);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "completed");
  assert.equal(record.job.translation.chunkStatuses[1].stage, "completed");
  context.transcribeBrowserAudioChunk = originalTranscribe;
  context.translateBrowserSegments = originalTranslate;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const record = {
    tabId: 303,
    metadata: { title: "Retry ASR failure stays per chunk" },
    modelConfig: {
      asrWorkers: 1,
      workers: 1,
      targetLanguage: "zh-CN",
      asr: { providerType: "openai", baseUrl: "https://asr.test/v1", model: "whisper", apiKey: "test" },
      translation: { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" }
    },
    audioChunks: [{ index: 0, start: 0, end: 900, file: { name: "chunk-001.mp3", buffer: new ArrayBuffer(1) } }],
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map(),
    job: {
      id: "browser-retry-asr-failed",
      status: "failed",
      stage: "completed_with_warnings",
      extract: { elapsedSeconds: 1 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "failed", status: "失败", attempts: 1, error: "old" }],
        chunksTotal: 1,
        chunksDone: 1,
        chunksFailed: 1,
        chunksAsr: 0,
        chunksTranslating: 0
      }
    }
  };
  const originalTranscribe = context.transcribeBrowserAudioChunk;
  const originalEnsureSubtitleOverlay = context.ensureSubtitleOverlay;
  const originalAttachBrowserJobVttIfReady = context.attachBrowserJobVttIfReady;
  context.transcribeBrowserAudioChunk = async () => {
    throw new Error("Failed to fetch");
  };
  context.ensureSubtitleOverlay = async () => {};
  context.attachBrowserJobVttIfReady = async () => {};

  const result = await context.retryBrowserFailedPreload(record, [0]);

  assert.equal(result.job.status, "completed");
  assert.equal(result.job.stage, "completed_with_warnings");
  assert.equal(record.job.translation.chunkStatuses[0].stage, "failed");
  assert.match(record.job.translation.chunkStatuses[0].error, /Failed to fetch/);
  context.transcribeBrowserAudioChunk = originalTranscribe;
  context.ensureSubtitleOverlay = originalEnsureSubtitleOverlay;
  context.attachBrowserJobVttIfReady = originalAttachBrowserJobVttIfReady;
}

{
  const timeoutMs = context.normalizeAsrTimeoutMs(undefined, { start: 0, end: 900 });
  assert.ok(timeoutMs >= 900_000, `15 分钟 ASR 音频切片不应仍使用 45 秒超时，实际 ${timeoutMs}`);
}

{
  const record = {
    job: {
      translation: {
        chunkStatuses: [
          { index: 0, stage: "failed", error: "ASR 请求超时" },
          { index: 1, stage: "failed", error: "ASR 请求超时" }
        ]
      }
    },
    sourceSegmentsByChunk: new Map(),
    translatedSegmentsByChunk: new Map()
  };
  assert.equal(
    context.browserFailureSummary(record),
    "有 2 个识别分段失败，没有可显示的原文；请检查 ASR 服务后重试。"
  );
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          word_timestamps: { type: "boolean" },
                          condition_on_previous_text: { type: "boolean" },
                          no_speech_threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" },
                          vad_parameters: { type: "string" },
                          temperature: { type: "number" },
                          without_timestamps: { type: "boolean" },
                          hallucination_silence_threshold: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    postedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 0, end: 1, text: "ok" }]
      })
    };
  };
  const clientVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 0,
      end: 120,
      speechIntervals: [{ start: 0, end: 120 }],
      file: { name: "chunk.wav", buffer: new ArrayBuffer(1), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://client-vad-compatible.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(clientVadSegments.length, 1);
  assert.equal(postedFields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(postedFields.some(([name, value]) => name === "word_timestamps" && value === "true"), true);
  assert.equal(postedFields.some(([name, value]) => name === "condition_on_previous_text" && value === "false"), true);
  assert.equal(postedFields.some(([name, value]) => name === "without_timestamps" && value === "false"), true);
  assert.equal(postedFields.some(([name, value]) => name === "temperature" && value === "0"), true);
  assert.equal(postedFields.some(([name, value]) => name === "vad_parameters" && value === "{\"threshold\":0.5,\"min_speech_duration_ms\":0,\"max_speech_duration_s\":30,\"min_silence_duration_ms\":160,\"speech_pad_ms\":400}"), true);
  assert.equal(postedFields.some(([name]) => name === "threshold"), false);
  assert.equal(postedFields.some(([name]) => name === "min_speech_duration_ms"), false);
  assert.equal(postedFields.some(([name]) => name === "max_speech_duration_s"), false);
  assert.equal(postedFields.some(([name]) => name === "min_silence_duration_ms"), false);
  assert.equal(postedFields.some(([name]) => name === "speech_pad_ms"), false);
  assert.equal(postedFields.some(([name, value]) => name === "no_speech_threshold" && value === "0.6"), true);
  assert.equal(postedFields.some(([name]) => name === "hallucination_silence_threshold"), false);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requested = [];
  const postedFields = [];
  context.fetch = async (url, init = {}) => {
    requested.push([String(url), init.method || "GET"]);
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          file: { type: "string", format: "binary" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [] };
    }
    postedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1, end: 2, text: "speech missed by precheck" }]
      })
    };
  };
  const emptyVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "silent.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-vad-empty.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(Array.isArray(emptyVadSegments), true);
  assert.equal(emptyVadSegments.length, 1);
  assert.equal(emptyVadSegments[0].text, "speech missed by precheck");
  assert.equal(postedFields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.deepEqual(requested.map(([url, method]) => [new URL(url).pathname, method]), [
    ["/openapi.json", "GET"],
    ["/v1/audio/speech/timestamps", "POST"],
    ["/v1/audio/transcriptions", "POST"]
  ]);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let recoveryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          word_timestamps: { type: "boolean" },
                          condition_on_previous_text: { type: "boolean" },
                          no_speech_threshold: { type: "number" },
                          temperature: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [] };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return { ok: true, json: async () => ({ segments: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 9.94, end: 29.98, text: "ご視聴ありがとうございました" },
          { start: 8.12, end: 8.96, text: "早く" },
          { start: 13.44, end: 15.06, text: "そうしても見れば分かる" }
        ]
      })
    };
  };
  const recoveredEmptyVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 25,
      start: 642,
      end: 672,
      duration: 30,
      coreStart: 644,
      coreEnd: 670,
      file: { name: "empty-vad-recovery.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-empty-vad-recovery.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { recoveryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "vad_filter"), false);
  assert.equal(recoveredEmptyVadSegments.length, 2);
  assert.equal(JSON.stringify(recoveredEmptyVadSegments.map(segment => segment.text)), JSON.stringify([
    "早く",
    "そうしても見れば分かる"
  ]));
  assert.equal(recoveryDiagnostics.retry.postprocess.strictVadRecoveryFilterApplied, true);
  assert.equal(recoveryDiagnostics.retry.postprocess.strictVadRecoveryInputFinalCount, 3);
  assert.equal(recoveryDiagnostics.retry.postprocess.strictVadRecoveryFinalCount, 2);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const requested = [];
  context.fetch = async (url, init = {}) => {
    requested.push([String(url), init.method || "GET"]);
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [] };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1.1, end: 1.8, text: "native internal vad speech" }]
      })
    };
  };
  const nativeInternalVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 12,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "speaches-native-internal-vad.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native-internal-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(JSON.stringify(nativeInternalVadSegments.map(segment => segment.text)), JSON.stringify(["native internal vad speech"]));
  assert.deepEqual(requested.map(([url, method]) => [new URL(url).pathname, method]), [
    ["/openapi.json", "GET"],
    ["/v1/audio/transcriptions", "POST"]
  ]);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [{ start: 0, end: 2400 }] };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 0.2, end: 1.4, text: "real speech" },
          { start: 10, end: 12, text: "static tail" }
        ]
      })
    };
  };
  const vadFilteredSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 0,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "speech.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-vad-filter.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(vadFilteredSegments.length, 1);
  assert.equal(vadFilteredSegments[0].text, "real speech");
  assert.equal(vadFilteredSegments[0].start, 30.2);
  assert.equal(vadFilteredSegments[0].end, 31.4);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  let nativeDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 10000, end: 12000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    postedFields.push(...fields);
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 9.7,
          end: 12.4,
          text: "native prefix middle suffix",
          words: [
            { text: "native", start: 9.7, end: 9.95, probability: 0.9 },
            { text: "prefix", start: 10, end: 10.3, probability: 0.91 },
            { text: "middle", start: 10.4, end: 11.6, probability: 0.94 },
            { text: "suffix", start: 12.05, end: 12.35, probability: 0.9 }
          ]
        }]
      })
    };
  };
  const nativeSpeachesSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 6,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "speaches-native.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { nativeDiagnostics = diagnostics; } }
  );
  assert.equal(postedFields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(postedFields.some(([name]) => name === "vad_filter"), false);
  assert.equal(nativeSpeachesSegments.length, 1);
  assert.equal(nativeSpeachesSegments[0].text, "native prefix middle suffix");
  assert.equal(nativeSpeachesSegments[0].start, 39.7);
  assert.equal(nativeSpeachesSegments[0].end, 42.35);
  assert.equal(nativeDiagnostics.postprocess.matureVadRequest, true);
  assert.equal(nativeDiagnostics.postprocess.speechActivityFilterApplied, true);
  assert.equal(nativeDiagnostics.postprocess.customRunFiltersDisabled, false);
  assert.equal(nativeDiagnostics.postprocess.vadHallucinationGuardDisabled, false);
  assert.deepEqual(nativeDiagnostics.postprocess.segmentCounts, {
    normalized: 1,
    speechFiltered: 1,
    hallucinationFiltered: 1,
    final: 1
  });
  assert.deepEqual(nativeDiagnostics.postprocess.dropCounts, {
    speechActivity: 0,
    hallucinationGuard: 0,
    chunkOwnership: 0,
    total: 0
  });
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  let nativeDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: false, status: 500, json: async () => ({ message: "temporary VAD failure" }) };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    postedFields.push(...fields);
    return {
      ok: true,
      json: async () => ({
        segments: Array.from({ length: 6 }, (_, index) => ({
          start: index,
          end: index + 0.25,
          text: "うん"
        }))
      })
    };
  };
  const nativeSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 7,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "speaches-native-vad-error.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native-vad-error.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { nativeDiagnostics = diagnostics; } }
  );
  assert.equal(postedFields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(postedFields.some(([name]) => name === "vad_filter"), false);
  assert.equal(nativeSegments.length, 6);
  assert.equal(JSON.stringify(nativeSegments.map(segment => segment.text)), JSON.stringify(["うん", "うん", "うん", "うん", "うん", "うん"]));
  assert.equal(nativeDiagnostics.vad, null);
  assert.equal(nativeDiagnostics.matureAsrPlan.vad.precheckState, "native");
  assert.equal(nativeDiagnostics.postprocess.matureVadRequest, true);
  assert.equal(nativeDiagnostics.postprocess.externalVadServiceAvailable, false);
  assert.equal(nativeDiagnostics.postprocess.nativeVadRequest, true);
  assert.equal(nativeDiagnostics.postprocess.customRunFiltersDisabled, false);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let nativeDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return { ok: true, json: async () => [{ start: 1000, end: 4000 }] };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 1.1,
          end: 3.7,
          text: "これは本当に話した内容です",
          no_speech_prob: 0.7,
          avg_logprob: -1.1
        }]
      })
    };
  };
  const retainedQualitySegments = await context.transcribeBrowserAudioChunk(
    {
      index: 8,
      start: 0,
      end: 30,
      duration: 30,
      file: { name: "speaches-native-quality.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-native-quality.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { nativeDiagnostics = diagnostics; } }
  );
  assert.equal(retainedQualitySegments.length, 1);
  assert.equal(retainedQualitySegments[0].text, "これは本当に話した内容です");
  assert.equal(nativeDiagnostics.postprocess.qualityFiltersDisabled, true);
  assert.equal(nativeDiagnostics.postprocess.dropCounts.total, 0);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  const vadPostedFields = [];
  let capturedDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      vadPostedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
      return {
        ok: true,
        json: async () => [
          { start: 1000, end: 3200 },
          { start: 7000, end: 9000 }
        ]
      };
    }
    postedFields.push(...Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]));
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 1.2, end: 2.4, text: "clip speech" },
          { start: 7.2, end: 8.4, text: "clip speech tail" }
        ]
      })
    };
  };
  const clippedSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 1,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-compatible.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { capturedDiagnostics = diagnostics; } }
  );
  assert.equal(clippedSegments.length, 2);
  assert.equal(clippedSegments[0].text, "clip speech");
  assert.equal(clippedSegments[1].text, "clip speech tail");
  assert.equal(vadPostedFields.some(([name, value]) => name === "threshold" && value === "0.5"), true);
  assert.equal(vadPostedFields.some(([name, value]) => name === "min_speech_duration_ms" && value === "0"), true);
  assert.equal(postedFields.some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(postedFields.some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(postedFields.some(([name]) => name === "vad_parameters"), false);
  assert.equal(capturedDiagnostics.matureAsrPlan.strategy, "speaches_faster_whisper");
  assert.equal(capturedDiagnostics.matureAsrPlan.request.mode, "external_vad_clip");
  assert.equal(capturedDiagnostics.matureAsrPlan.vad.precheckState, "reliable");
  assert.equal(capturedDiagnostics.matureAsrPlan.clipTimestamps, "1,9");
  assert.equal(capturedDiagnostics.matureAsrPlan.postprocessPolicy.matureVadRequest, true);
  assert.equal(capturedDiagnostics.vad.requestFields.some(([name, value]) => name === "threshold" && value === "0.5"), true);
  assert.equal(capturedDiagnostics.vad.requestFields.some(([name, value]) => name === "min_speech_duration_ms" && value === "0"), true);
  assert.equal(capturedDiagnostics.request.fields.some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(capturedDiagnostics.request.fields.some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(capturedDiagnostics.postprocess.policySource, "matureAsrPlan");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const postedFields = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          word_timestamps: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 10000, end: 12000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    postedFields.push(...fields);
    return {
      ok: true,
      json: async () => ({
        segments: [{
          start: 9.7,
          end: 12.4,
          text: "prefix middle suffix",
          words: [
            { text: "prefix", start: 9.7, end: 10.05, probability: 0.91 },
            { text: "middle", start: 10.1, end: 11.7, probability: 0.94 },
            { text: "suffix", start: 12.05, end: 12.35, probability: 0.9 }
          ]
        }]
      })
    };
  };
  const driftedClipSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 3,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-edge-drift.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-edge-drift.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(postedFields.some(([name, value]) => name === "clip_timestamps" && value === "10,12"), true);
  assert.equal(driftedClipSegments.length, 1);
  assert.equal(driftedClipSegments[0].text, "prefix middle suffix");
  assert.equal(driftedClipSegments[0].start, 39.7);
  assert.equal(driftedClipSegments[0].end, 42.35);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 9700, end: 10400 }]
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 9.7, end: 10.4, text: "おやすみなさい" }]
      })
    };
  };
  const suspiciousButSpokenSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 4,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-suspicious-spoken.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-suspicious-spoken.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(suspiciousButSpokenSegments.length, 1);
  assert.equal(suspiciousButSpokenSegments[0].text, "おやすみなさい");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 18000 }]
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: Array.from({ length: 6 }, (_, index) => ({
          start: 1 + index * 2.6,
          end: 1.8 + index * 2.6,
          text: index % 2 ? "うん" : "嗯"
        }))
      })
    };
  };
  const conversationalBackchannels = await context.transcribeBrowserAudioChunk(
    {
      index: 5,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-backchannels.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-backchannels.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(conversationalBackchannels.length, 6);
  assert.equal(JSON.stringify(conversationalBackchannels.map(segment => segment.text)), JSON.stringify(["嗯", "うん", "嗯", "うん", "嗯", "うん"]));
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let retryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [
          { start: 1000, end: 2000 },
          { start: 7000, end: 9000 }
        ]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.1, end: 1.8, text: "first clip only" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 7.2, end: 8.6, text: "second clip" }
        ]
      })
    };
  };
  const recoveredSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 2,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-retry.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(retryDiagnostics.clipTimestampsAttempt.request.fields.some(([name, value]) => name === "clip_timestamps" && value === "1,9"), true);
  assert.equal(retryDiagnostics.clipTimestampsAttempt.request.fields.some(([name, value]) => name === "vad_filter" && value === "false"), true);
  assert.equal(retryDiagnostics.request.fields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(retryDiagnostics.retry.request.fields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(recoveredSegments.map(segment => segment.text)), JSON.stringify(["first clip only", "second clip"]));
  assert.equal(recoveredSegments[1].start, 37.2);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 1500 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return { ok: true, json: async () => ({ segments: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1.05, end: 1.42, text: "嗯" }]
      })
    };
  };
  const shortBackchannelRecovery = await context.transcribeBrowserAudioChunk(
    {
      index: 9,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-short-backchannel.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-short-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,1.5"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(JSON.stringify(shortBackchannelRecovery.map(segment => segment.text)), JSON.stringify(["嗯"]));
  assert.equal(shortBackchannelRecovery[0].start, 31.05);
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let retryDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 20000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "first long speech sentence" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 12.2, end: 13.5, text: "later long speech sentence" }]
      })
    };
  };
  const longSpeechRecovery = await context.transcribeBrowserAudioChunk(
    {
      index: 13,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "long-vad-window.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-long-vad-window.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { retryDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,20"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(longSpeechRecovery.map(segment => segment.text)), JSON.stringify([
    "first long speech sentence",
    "later long speech sentence"
  ]));
  assert.equal(retryDiagnostics.retry.reason, "可靠 VAD 语音区间未被 clip_timestamps 识别结果覆盖，已不带 clip_timestamps 重试。");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const transcriptionRequests = [];
  let matureDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          vad_parameters: { type: "string" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 59000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 1.2, end: 2.4, text: "first continuous sentence" },
          { start: 35.2, end: 36.5, text: "server vad later sentence" }
        ]
      })
    };
  };
  const serverVadSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 14,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "unsafe-long-vad-window.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-long-window-server-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { matureDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(transcriptionRequests[0].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(serverVadSegments.map(segment => segment.text)), JSON.stringify([
    "first continuous sentence",
    "server vad later sentence"
  ]));
  assert.equal(Boolean(matureDiagnostics.vadFilterAttempt), false);
  assert.equal(Boolean(matureDiagnostics.retry), false);
  assert.equal(matureDiagnostics.matureAsrPlan.request.mode, "compatible_vad_filter");
  assert.equal(matureDiagnostics.matureAsrPlan.vad.clipTimestampsSkippedReason, "long_speech_interval_requires_server_vad");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  const requested = [];
  const transcriptionRequests = [];
  let speachesDiagnostics = null;
  const offscreenMessages = [];
  chrome.runtime.sendMessage = async message => {
    offscreenMessages.push(message);
    return {
      ok: true,
      result: {
        chunks: [
          {
            index: 0,
            start: 31,
            end: 59,
            duration: 2,
            sourceStart: 31,
            sourceEnd: 59,
            speechIntervals: [
              { start: 31, end: 32 },
              { start: 58, end: 59 }
            ],
            timeMap: [
              { outputStart: 0, outputEnd: 1, sourceStart: 31, sourceEnd: 32 },
              { outputStart: 1, outputEnd: 2, sourceStart: 58, sourceEnd: 59 }
            ],
            file: { name: "speech-only-000.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
            bytes: 4
          }
        ]
      }
    };
  };
  context.fetch = async (url, init = {}) => {
    requested.push([String(url), init.method || "GET"]);
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          model: { type: "string" },
                          response_format: { type: "string" },
                          timestamp_granularities: { type: "array" },
                          vad_filter: { type: "boolean" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 2000 }, { start: 28000, end: 29000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "server vad first sentence" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [{ start: 1.1, end: 1.6, text: "speech-only second sentence" }]
      })
    };
  };
  const recoveredSpeachesSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 15,
      start: 30,
      end: 90,
      duration: 60,
      file: {
        name: "speaches-form-urlencoded-vad.wav",
        buffer: new ArrayBuffer(4),
        cacheUrl: "https://fuguang.local/audio/speaches-form-urlencoded-vad.wav",
        mime: "audio/wav"
      }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-form-urlencoded-vad.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { speachesDiagnostics = diagnostics; } }
  );
  assert.deepEqual(requested.map(([url, method]) => [new URL(url).pathname, method]), [
    ["/openapi.json", "GET"],
    ["/v1/audio/speech/timestamps", "POST"],
    ["/v1/audio/transcriptions", "POST"]
  ]);
  assert.equal(offscreenMessages.length, 0);
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(transcriptionRequests[0].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(JSON.stringify(recoveredSpeachesSegments.map(segment => segment.text)), JSON.stringify([
    "server vad first sentence"
  ]));
  assert.equal(Math.round(recoveredSpeachesSegments[0].start * 10) / 10, 31.2);
  assert.equal(Math.round(recoveredSpeachesSegments[0].end * 10) / 10, 32.4);
  assert.equal(speachesDiagnostics.vad.speechIntervals.length, 2);
  assert.equal(speachesDiagnostics.vad.requestFields.some(([name, value]) => name === "min_silence_duration_ms" && value === "160"), true);
  assert.equal(speachesDiagnostics.matureAsrPlan.request.mode, "compatible_vad_filter");
  assert.equal(speachesDiagnostics.collectedSpeech, null);
  assert.equal(Boolean(speachesDiagnostics.vadFilterAttempt), false);
  assert.equal(Boolean(speachesDiagnostics.retry), false);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const restored = context.restoreBrowserAsrCollectedSpeechSegments([
    {
      start: 0.9,
      end: 1.2,
      text: "boundary word",
      words: [{ start: 0.9, end: 1.2, text: "boundary", probability: 0.9 }]
    },
    {
      start: 0.9,
      end: 1.2,
      text: "segment-only boundary"
    }
  ], [
    { outputStart: 0, outputEnd: 1, sourceStart: 31, sourceEnd: 32 },
    { outputStart: 1, outputEnd: 2, sourceStart: 58, sourceEnd: 59 }
  ]);
  assert.equal(restored.length, 2);
  assert.equal(restored[0].start, 57.9);
  assert.equal(restored[0].end, 58.2);
  assert.equal(restored[0].words[0].start, 57.9);
  assert.equal(restored[0].words[0].end, 58.2);
  assert.equal(restored[1].start, 31.9);
  assert.equal(restored[1].end, 58.2);
}

{
  const originalFetch = context.fetch;
  const originalSendMessage = chrome.runtime.sendMessage;
  const transcriptionRequests = [];
  let speachesDiagnostics = null;
  chrome.runtime.sendMessage = async () => ({
    ok: true,
    result: {
      chunks: [
        {
          index: 0,
          start: 31,
          end: 89,
          duration: 58,
          sourceStart: 31,
          sourceEnd: 89,
          speechIntervals: [{ start: 31, end: 89 }],
          timeMap: [{ outputStart: 0, outputEnd: 58, sourceStart: 31, sourceEnd: 89 }],
          file: { name: "speech-only-hallucination.mp3", buffer: new ArrayBuffer(4), mime: "audio/mpeg" },
          bytes: 4
        }
      ]
    }
  });
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          model: { type: "string" },
                          response_format: { type: "string" },
                          timestamp_granularities: { type: "array" },
                          vad_filter: { type: "boolean" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "application/x-www-form-urlencoded": {
                      schema: {
                        properties: {
                          threshold: { type: "number" },
                          min_speech_duration_ms: { type: "integer" },
                          max_speech_duration_s: { type: "number" },
                          min_silence_duration_ms: { type: "integer" },
                          speech_pad_ms: { type: "integer" },
                          file: { type: "string", format: "binary" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 59000 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (fields.some(([name, value]) => name === "vad_filter" && value === "true")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.2, end: 2.4, text: "server vad first sentence" }]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        segments: [
          { start: 2.5, end: 4, text: "お腹いっぱいになったら、" },
          { start: 4.1, end: 8, text: "お腹いっぱいになったら、" },
          { start: 8.1, end: 14, text: "お腹いっぱいになったら、" },
          { start: 14.1, end: 20, text: "お腹いっぱいになったら、" },
          { start: 50, end: 55, text: "お腹いっぱいになったら、" }
        ]
      })
    };
  };
  const recoveredSpeachesSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 16,
      start: 30,
      end: 90,
      duration: 60,
      file: { name: "speaches-no-vad-hallucination-retry.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-no-vad-hallucination-retry.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto",
      experimentalCollectedSpeechAudio: true
    },
    { onDiagnostics: diagnostics => { speachesDiagnostics = diagnostics; } }
  );
  assert.equal(transcriptionRequests.length, 1);
  assert.equal(transcriptionRequests[0].some(([name]) => name === "vad_filter"), false);
  assert.equal(JSON.stringify(recoveredSpeachesSegments.map(segment => segment.text)), JSON.stringify([]));
  assert.equal(speachesDiagnostics.matureAsrPlan.request.mode, "collected_external_vad");
  assert.equal(Boolean(speachesDiagnostics.retry), false);
  chrome.runtime.sendMessage = originalSendMessage;
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let failedDiagnostics = null;
  const transcriptionRequests = [];
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: {
                        properties: {
                          clip_timestamps: { type: "string" },
                          vad_filter: { type: "boolean" },
                          without_timestamps: { type: "boolean" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/v1/audio/speech/timestamps": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { file: { type: "string", format: "binary" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    if (String(url).endsWith("/v1/audio/speech/timestamps")) {
      return {
        ok: true,
        json: async () => [{ start: 1000, end: 1800 }]
      };
    }
    const fields = Array.from(init.body.entries()).map(([name, value]) => [name, value instanceof Blob ? "[blob]" : String(value)]);
    transcriptionRequests.push(fields);
    if (!fields.some(([name]) => name === "clip_timestamps")) {
      return {
        ok: true,
        json: async () => ({
          segments: [{ start: 1.05, end: 1.75, text: "fallback speech" }]
        })
      };
    }
    return {
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "clip timestamp parse failed" } })
    };
  };
  const fallbackSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 10,
      start: 30,
      end: 60,
      duration: 30,
      file: { name: "clip-failed.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://speaches-clip-fail.example/v1",
      model: "Systran/faster-whisper-large-v3",
      apiKey: "test",
      vadFilter: "auto"
    },
    { onDiagnostics: diagnostics => { failedDiagnostics = diagnostics; } }
  );
  assert.equal(JSON.stringify(fallbackSegments.map(segment => segment.text)), JSON.stringify(["fallback speech"]));
  assert.equal(transcriptionRequests.length, 2);
  assert.equal(transcriptionRequests[0].some(([name, value]) => name === "clip_timestamps" && value === "1,1.8"), true);
  assert.equal(transcriptionRequests[1].some(([name]) => name === "clip_timestamps"), false);
  assert.equal(transcriptionRequests[1].some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(Boolean(failedDiagnostics), true);
  assert.equal(failedDiagnostics.vad.speechIntervals.length, 1);
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.stage, "asr_request");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.status, 400);
  assert.equal(failedDiagnostics.clipTimestampsAttempt.error.message, "clip timestamp parse failed");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.rawPayload.error.message, "clip timestamp parse failed");
  assert.equal(failedDiagnostics.clipTimestampsAttempt.matureAsrPlan.request.mode, "external_vad_clip");
  assert.equal(failedDiagnostics.matureAsrPlan.request.mode, "compatible_vad_filter");
  assert.equal(failedDiagnostics.request.fields.some(([name]) => name === "clip_timestamps"), false);
  assert.equal(failedDiagnostics.retry.request.fields.some(([name, value]) => name === "vad_filter" && value === "true"), true);
  assert.equal(failedDiagnostics.retry.matureAsrPlan.request.mode, "compatible_vad_filter");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let postprocessDiagnostics = null;
  context.fetch = async (_url, init = {}) => {
    if (!init.method) {
      return {
        ok: true,
        json: async () => ({
          paths: {
            "/v1/audio/transcriptions": {
              post: {
                requestBody: {
                  content: {
                    "multipart/form-data": {
                      schema: { properties: { without_timestamps: { type: "boolean" } } }
                    }
                  }
                }
              }
            }
          }
        })
      };
    }
    return {
      ok: true,
      json: async () => ({ text: "no timestamps here" })
    };
  };
  await assert.rejects(
    context.transcribeBrowserAudioChunk(
      {
        index: 11,
        start: 0,
        end: 30,
        duration: 30,
        file: { name: "text-only.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
      },
      {
        providerType: "openai",
        baseUrl: "https://speaches-text-only.example/v1",
        model: "Systran/faster-whisper-large-v3",
        apiKey: "test",
        vadFilter: "auto"
      },
      { onDiagnostics: diagnostics => { postprocessDiagnostics = diagnostics; } }
    ),
    /时间戳/
  );
  assert.equal(Boolean(postprocessDiagnostics), true);
  assert.equal(postprocessDiagnostics.error.stage, "postprocess");
  assert.equal(postprocessDiagnostics.rawPayload.text, "no timestamps here");
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  context.fetch = async (_url, init = {}) => new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      reject(error);
    });
  });
  await assert.rejects(
    Promise.race([
      context.transcribeBrowserAudioChunk(
        { index: 0, start: 0, end: 10, file: { name: "chunk.mp3", buffer: new ArrayBuffer(1), mime: "audio/mpeg" } },
        { providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1", model: "whisper-1", apiKey: "test", timeoutMs: 20, vadFilter: "off" }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ASR timeout did not trigger")), 80))
    ]),
    /ASR 请求超时/
  );
  context.fetch = originalFetch;
}

{
  const originalFetch = context.fetch;
  let capturedDiagnostics = null;
  context.fetch = async (url, init = {}) => {
    if (!init.method) {
      return { ok: true, json: async () => ({ paths: {} }) };
    }
    return {
      ok: true,
      json: async () => ({
        duration: 30,
        segments: [
          { start: 0.2, end: 1.4, text: "kept" },
          { start: 42, end: 44, text: "outside" }
        ]
      })
    };
  };
  const finalSegments = await context.transcribeBrowserAudioChunk(
    {
      index: 7,
      start: 30,
      end: 60,
      coreStart: 30,
      coreEnd: 60,
      duration: 30,
      bytes: 4,
      file: { name: "diag.wav", cacheUrl: "https://fuguang.local/audio/diag.wav", buffer: new ArrayBuffer(4), mime: "audio/wav" }
    },
    {
      providerType: "openai",
      baseUrl: "https://diagnostics-asr.example/v1",
      model: "whisper-1",
      apiKey: "test",
      vadFilter: "off"
    },
    {
      onDiagnostics: diagnostics => {
        capturedDiagnostics = diagnostics;
      }
    }
  );
  assert.equal(finalSegments.length, 1);
  assert.equal(capturedDiagnostics.chunk.index, 7);
  assert.equal(capturedDiagnostics.chunk.file.cacheUrl, "https://fuguang.local/audio/diag.wav");
  assert.equal(capturedDiagnostics.request.fields.some(([name]) => name === "file"), false);
  assert.equal(capturedDiagnostics.request.authorizationIncluded, false);
  assert.equal(capturedDiagnostics.rawPayload.segments.length, 2);
  assert.equal(capturedDiagnostics.normalizedSegments.length, 2);
  assert.equal(capturedDiagnostics.finalSegments.length, 1);
  assert.deepEqual(capturedDiagnostics.postprocess.droppedSegments.map(item => ({
    stage: item.stage,
    reason: item.reason,
    text: item.segment.text
  })), [
    { stage: "chunkOwnership", reason: "outside_chunk_core", text: "outside" }
  ]);
  context.fetch = originalFetch;
}

{
  const diagnostics = context.buildPreloadDiagnostics({
    job: {
      id: "job-diag",
      status: "completed",
      stage: "completed",
      extract: { status: "completed", duration: 60 },
      translation: {
        chunkStatuses: [{ index: 0, stage: "completed", sourceCount: 1 }],
        vttText: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n你好\n"
      }
    },
    metadata: { title: "诊断视频", pageUrl: "https://example.test/watch?token=secret" },
    audioChunks: [{
      index: 0,
      start: 0,
      end: 30,
      coreStart: 0,
      coreEnd: 30,
      speechIntervalsReliable: false,
      file: { name: "chunk-001.mp3", cacheUrl: "https://fuguang.local/__fuguang_audio_cache/chunk-001.mp3", mime: "audio/mpeg" },
      bytes: 123
    }],
    browserAsrDiagnosticsByChunk: new Map([[0, {
      chunk: { index: 0, start: 0, end: 30 },
      request: { endpoint: "https://asr.example/v1/audio/transcriptions?api_key=secret", fields: [["model", "whisper-1"]], authorizationIncluded: false },
      rawPayload: { segments: [{ text: "hello" }] },
      finalSegments: [{ start: 0, end: 1, text: "hello" }]
    }]]),
    sourceSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "hello", chunkIndex: 0, segmentIndex: 0 }]]]),
    translatedSegmentsByChunk: new Map([[0, [{ start: 0, end: 1, text: "你好", chunkIndex: 0, segmentIndex: 0 }]]]),
    modelConfig: {
      asr: { providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", apiKey: "do-not-export" }
    }
  });
  assert.equal(diagnostics.version, 1);
  assert.equal(diagnostics.job.id, "job-diag");
  assert.equal(diagnostics.audioChunks[0].file.cacheUrl.includes("__fuguang_audio_cache"), true);
  assert.equal(diagnostics.asrChunks[0].rawPayload.segments[0].text, "hello");
  assert.equal(JSON.stringify(diagnostics).includes("do-not-export"), false);
  assert.equal(JSON.stringify(diagnostics).includes("api_key=secret"), false);
}

{
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  const cacheUrl = "https://fuguang.local/__fuguang_audio_cache/job-audio/chunk-001.mp3";
  await cache.put(cacheUrl, new FakeResponse(new Uint8Array([5, 6, 7]).buffer));
  vm.runInContext(`
    browserPreloadJobs.set("job-audio", {
      job: {
        id: "job-audio",
        status: "completed",
        stage: "completed",
        extract: { status: "completed" },
        translation: { chunkStatuses: [] }
      },
      metadata: { title: "audio diag" },
      audioChunks: [{
        index: 0,
        start: 0,
        end: 30,
        file: {
          name: "chunk-001.mp3",
          mime: "audio/mpeg",
          cacheUrl: "${cacheUrl}",
          bytes: 3
        },
        bytes: 3
      }],
      browserAsrDiagnosticsByChunk: new Map(),
      sourceSegmentsByChunk: new Map(),
      translatedSegmentsByChunk: new Map(),
      modelConfig: {
        asr: { providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", apiKey: "do-not-export" }
      }
    });
  `, context);
  try {
    const response = await vm.runInContext("getPreloadDiagnostics('job-audio')", context);
    assert.equal(response.audioFiles.length, 1);
    assert.equal(response.audioFiles[0].path, "audio/chunk-0000-chunk-001.mp3");
    assert.equal(response.audioFiles[0].mime, "audio/mpeg");
    assert.equal(response.audioFiles[0].base64, "BQYH");
    assert.equal(JSON.parse(JSON.stringify(response)).audioFiles[0].base64, "BQYH");
    assert.equal(response.diagnostics.audioExport.files[0].included, true);
    assert.equal(response.diagnostics.audioExport.files[0].path, "audio/chunk-0000-chunk-001.mp3");
    assert.equal(JSON.stringify(response.diagnostics).includes("do-not-export"), false);
  } finally {
    vm.runInContext("browserPreloadJobs.delete('job-audio')", context);
  }
}

{
  const originalRequest = context.requestOpenAiCompatibleChat;
  context.requestOpenAiCompatibleChat = async () => new Promise(() => {});
  await assert.rejects(
    Promise.race([
      context.translateBrowserSegments(
        [{ start: 1, end: 2, text: "hello" }],
        { providerType: "openai", baseUrl: "https://llm.test/v1", model: "test", apiKey: "test" },
        "zh-CN",
        { title: "timeout test" },
        { timeoutMs: 20 }
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("translation timeout did not trigger")), 80))
    ]),
    /翻译模型请求超时/
  );
  context.requestOpenAiCompatibleChat = originalRequest;
}
