import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

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
    onCommitted: { addListener },
    onHistoryStateUpdated: { addListener },
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

const source = fs.readFileSync(new URL("../src/background/service-worker.js", import.meta.url), "utf8");

{
  assert.equal(source.includes("FUGUANG_START_REALTIME"), false);
  assert.equal(source.includes("FUGUANG_STOP_REALTIME"), false);
  assert.equal(source.includes("FUGUANG_OFFSCREEN_START_REALTIME"), false);
  assert.equal(source.includes("FUGUANG_OFFSCREEN_STOP_REALTIME"), false);
  assert.equal(source.includes("DEFAULT_HELPER"), false);
  assert.equal(source.includes("fetchHelper"), false);
  assert.equal(source.includes("getHelperConfig"), false);
  assert.equal(source.includes("本机服务"), false);
  assert.equal(source.includes("tabCapture"), false);
}

vm.runInContext(source, context, { filename: "service-worker.js" });

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
    { id: "local_whisper", name: "本地 Whisper", providerType: "local_whisper", model: "base" },
    { id: "old_custom_local", name: "旧本地 ASR", providerType: "local_whisper", model: "base" }
  ]);
  assert.equal(asrProfiles.some(profile => profile.id === "local_whisper" || profile.id === "old_custom_local" || profile.providerType === "local_whisper"), false);
  assert.equal(context.normalizeSelectedProfileId(asrProfiles, "local_whisper", "openai_whisper"), "openai_whisper");
  assert.equal(context.browserAsrEndpoint({ providerType: "xai", baseUrl: "https://api.x.ai/v1" }), "https://api.x.ai/v1/stt");
  assert.equal(context.browserAsrEndpoint({ providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1" }), "http://127.0.0.1:8000/v1/audio/transcriptions");
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "en")), JSON.stringify([["format", "true"], ["language", "en"]]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "xai" }, "zh-CN")), JSON.stringify([]));
  assert.equal(JSON.stringify(context.browserAsrRequestFields({ providerType: "openai", model: "whisper-1" }, "")), JSON.stringify([
    ["model", "whisper-1"],
    ["response_format", "verbose_json"],
    ["timestamp_granularities[]", "segment"]
  ]));
  assert.doesNotThrow(() => context.validateBrowserPreloadModelConfig({
    asr: { providerType: "xai", baseUrl: "https://api.x.ai/v1", apiKey: "test" }
  }));
  assert.throws(() => context.validateBrowserPreloadModelConfig({
    asr: { providerType: "openai", baseUrl: "https://asr.test/v1", apiKey: "test" }
  }), /模型名称/);
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

  assert.throws(() => context.normalizeAsrSegments({
    words: [{ word: "hello without timestamp" }]
  }, 0, 30), /时间戳/);
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
    message: "已生成 1/4 个内部音频切片"
  });
  assert.equal(record.job.extract.progress, 25);
  assert.equal(record.job.extract.readySeconds, 180);
  assert.equal(record.job.extract.internalChunksDone, 1);
  assert.equal(record.job.extract.internalChunksTotal, 4);
  assert.equal(record.job.extract.message, "已生成 1/4 个内部音频切片");
  assert.equal(record.job.progress.extraction.readySeconds, 180);

  context.applyBrowserExtractionProgress(record, {
    phase: "ffmpeg",
    percent: 20,
    readySeconds: 120,
    message: "较旧进度不应让进度条后退"
  });
  assert.equal(record.job.extract.progress, 25);
  assert.equal(record.job.extract.readySeconds, 180);
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
  assert.equal(
    context.canUseWebFfmpegDirectExtraction({
      kind: "audio",
      ext: "m4a",
      contentType: "audio/mp4",
      url: "https://cdn.example.test/audio.m4a"
    }),
    true
  );
  assert.equal(
    context.canUseWebFfmpegDirectExtraction({
      kind: "media",
      role: "audio",
      ext: "m4s",
      contentType: "application/octet-stream",
      url: "https://upos-sz.example.test/upgcxcode/1/2/389070477-1-30232.m4s"
    }),
    true
  );
  assert.equal(
    context.canUseWebFfmpegDirectExtraction({
      kind: "hls",
      ext: "m3u8",
      contentType: "application/vnd.apple.mpegurl",
      url: "https://cdn.example.test/master.m3u8"
    }),
    false
  );
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
      file: { name: "audio.mp3", mime: "audio/mpeg", cacheUrl: "chrome-extension://test/__fuguang_audio_cache/job/audio.mp3", bytes: 4096 },
      bytes: 4096
    }]
  }, 900, 120);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].bytes, 4096);
  assert.equal(chunks[0].file.cacheUrl.includes("__fuguang_audio_cache"), true);
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
  const cache = await caches.open("fuguang-web-ffmpeg-audio");
  const chunkUrl = "https://fuguang.local/__fuguang_audio_cache/chunk-only-test/logical-001.mp3";
  await cache.put(chunkUrl, new FakeResponse(new Uint8Array([5]).buffer));

  const removed = await context.clearBrowserAudioChunkCache([{
    file: {
      name: "logical-001.mp3",
      mime: "audio/mpeg",
      cacheUrl: chunkUrl,
      bytes: 1
    }
  }]);

  assert.equal(removed, 1);
  assert.equal(await cache.match(chunkUrl), undefined);
}

{
  const record = {
    tabId: 710,
    startedAt: Date.now() - 1000,
    modelConfig: { chunkSeconds: 900 },
    browserAsrChunkSeconds: 900,
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
    start: index * 180,
    end: (index + 1) * 180,
    duration: 180,
    file: {
      name: `internal-${index}.mp3`,
      mime: "audio/mpeg",
      cacheUrl: `https://fuguang.local/audio/${index}`,
      bytes: 1024
    },
    bytes: 1024
  });

  for (let index = 0; index < 4; index += 1) {
    const emitted = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(index));
    assert.equal(emitted.length, 0);
  }
  assert.equal((record.audioChunks || []).length, 0);
  assert.equal(record.job.translation.chunksTotal, 0);

  const emitted = context.appendBrowserInternalAudioChunk(record, makeInternalChunk(4));
  assert.equal(emitted.length, 1);
  assert.equal(record.audioChunks.length, 1);
  assert.equal(record.audioChunks[0].start, 0);
  assert.equal(record.audioChunks[0].end, 900);
  assert.equal(record.audioChunks[0].file.parts.length, 5);
  assert.equal(record.job.translation.chunksTotal, 1);
  assert.equal(record.job.translation.chunkStatuses[0].stage, "queued");
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
    end: 180,
    duration: 180,
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
  assert.equal(record.audioChunks[0].duration, 180);
  assert.equal(record.audioChunks[0].file.name, "tail.mp3");
  assert.equal(record.browserAsrQueue.items.length, 1);
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
        { providerType: "openai", baseUrl: "http://127.0.0.1:8000/v1", model: "whisper-1", apiKey: "test", timeoutMs: 20 }
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
