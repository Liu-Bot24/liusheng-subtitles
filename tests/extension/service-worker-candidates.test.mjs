import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const webNavigationCommittedListeners = [];
const webNavigationHistoryListeners = [];
const addListener = () => {};
const chrome = {
  action: { onClicked: { addListener } },
  offscreen: { hasDocument: async () => false, createDocument: async () => {} },
  runtime: { getURL: value => `chrome-extension://test-extension/${value}`, onMessage: { addListener }, sendMessage: async () => ({}) },
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
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "Systran/faster-whisper-large-v3"
  }, "ja", {
    supportedRequestFields: new Set([
      "vad_filter",
      "condition_on_previous_text",
      "no_speech_threshold",
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
    ["word_timestamps", "true"],
    ["condition_on_previous_text", "false"],
    ["no_speech_threshold", "0.45"],
    ["compression_ratio_threshold", "2.4"],
    ["log_prob_threshold", "-1"],
    ["hallucination_silence_threshold", "1"],
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
    ["timestamp_granularities[]", "word"]
  ]));
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
    ["timestamp_granularities[]", "word"]
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
  assert.deepEqual(ownedBoundarySegments.map(segment => segment.text), ["核心句"]);

  const previousBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 28.2, end: 30.2, text: "跨界句" },
    { start: 29.2, end: 29.8, text: "上一段" },
    { start: 29.6, end: 30.4, text: "正中边界句" }
  ], { start: 0, end: 32, coreStart: 0, coreEnd: 30 });
  assert.deepEqual(previousBoundarySegments.map(segment => segment.text), ["跨界句", "上一段"]);
  assert.equal(previousBoundarySegments[0].end, 30);

  const nextBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 29.6, end: 30.4, text: "正中边界句" }
  ], { start: 22, end: 68, coreStart: 30, coreEnd: 60 });
  assert.deepEqual(nextBoundarySegments.map(segment => segment.text), ["正中边界句"]);
  assert.equal(nextBoundarySegments[0].start, 30);

  const longBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 58.4, end: 61.4, text: "长句跨右边界" }
  ], { start: 52, end: 68, coreStart: 30, coreEnd: 60 });
  assert.equal(JSON.stringify(longBoundarySegments), JSON.stringify([{ start: 58.4, end: 60, text: "长句跨右边界" }]));

  const noOverlapBoundarySegments = context.filterAsrSegmentsByChunkOwnership([
    { start: 0.2, end: 1.6, text: "核心短句" },
    { start: 60, end: 61, text: "无重叠越界幻觉" }
  ], { start: 0, end: 2, coreStart: 0, coreEnd: 2 });
  assert.deepEqual(noOverlapBoundarySegments.map(segment => segment.text), ["核心短句"]);

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
  assert.equal(context.shouldSkipBrowserAsrChunk({ speechIntervals: [] }), true);
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
                no_speech_threshold: { type: "number" }
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
  })).sort()), JSON.stringify(["condition_on_previous_text", "no_speech_threshold", "vad_filter"]));
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
      no_speech_prob: 0.88
    }]
  }, 900, 930);
  assert.equal(noSpeechHallucination.length, 0);

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
