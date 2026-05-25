import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

{
  const html = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.html", import.meta.url), "utf8");
  const js = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.css", import.meta.url), "utf8");
  const background = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");
  const manifest = JSON.parse(fs.readFileSync(new URL("../../extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(html.includes("Helper"), false);
  assert.equal(html.includes("helperHttp"), false);
  assert.equal(html.includes("helperWs"), false);
  assert.equal(js.includes("helperHttp"), false);
  assert.equal(js.includes("helperWs"), false);
  assert.equal(js.includes("FUGUANG_START_REALTIME"), false);
  assert.equal(js.includes("FUGUANG_STOP_REALTIME"), false);
  assert.equal(js.includes("实时"), false);
  for (const [, body] of js.matchAll(/chrome\.storage\.sync\.set\(\{([\s\S]*?)\}\)/g)) {
    assert.equal(/asrApiKey|llmApiKey|apiKey/.test(body), false);
  }
  assert.equal(manifest.description.includes("实时"), false);
  assert.equal(manifest.permissions.includes("tabCapture"), false);
  assert.ok(html.includes('id="sourceLanguage"'), "source language selector missing");
  assert.ok(
    html.indexOf('id="sourceLanguage"') < html.indexOf('id="startPreload"'),
    "source language selector should sit near the task start controls"
  );
  assert.ok(js.includes('sourceLanguage: document.querySelector("#sourceLanguage")'));
  assert.ok(js.includes("sourceLanguage: getSourceLanguageValue()"));
  assert.equal(
    js.match(/const MODEL_SETTINGS_VERSION = (\d+);/)?.[1],
    background.match(/const MODEL_SETTINGS_VERSION = (\d+);/)?.[1]
  );
  const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
  const queriedIds = [...js.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map(match => match[1]).sort();
  assert.deepEqual(htmlIds, queriedIds);
  const webFfmpegHtml = fs.readFileSync(new URL("../../extension/web-ffmpeg/index.html", import.meta.url), "utf8");
  const webFfmpegJs = fs.readFileSync(new URL("../../extension/web-ffmpeg/src/app.js", import.meta.url), "utf8");
  const webFfmpegHtmlIds = [...webFfmpegHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).sort();
  const webFfmpegQueriedIds = [...webFfmpegJs.matchAll(/document\.querySelector\("#([^"]+)"\)/g)].map(match => match[1]).sort();
  assert.deepEqual(webFfmpegHtmlIds, webFfmpegQueriedIds);
  const literalClasses = new Set([
    ...[...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)),
    ...[...js.matchAll(/className\s*=\s*"([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)),
    ...[...js.matchAll(/classList\.(?:add|remove|toggle|contains)\("([^"]+)"\)/g)].map(match => match[1])
  ]);
  const dynamicCssClasses = new Set([
    "asr",
    "chunk",
    "completed",
    "completed_with_warnings",
    "done",
    "failed",
    "stage",
    "stage-cancelled",
    "stage-completed_with_warnings",
    "stage-error",
    "stage-failed",
    "subtitles-focus",
    "translated",
    "translation"
  ]);
  const cssClasses = [...new Set([...css.matchAll(/\.([A-Za-z_-][A-Za-z0-9_-]*)/g)].map(match => match[1]))];
  const orphanCssClasses = cssClasses.filter(name => !literalClasses.has(name) && !dynamicCssClasses.has(name));
  assert.deepEqual(orphanCssClasses, []);
  const htmlClasses = [...new Set([...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)))];
  const jsClasses = new Set([
    ...[...js.matchAll(/className\s*=\s*"([^"]+)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)),
    ...[...js.matchAll(/classList\.(?:add|remove|toggle|contains)\("([^"]+)"\)/g)].map(match => match[1])
  ]);
  const cssClassSet = new Set(cssClasses);
  const unusedHtmlClasses = htmlClasses.filter(name => !cssClassSet.has(name) && !jsClasses.has(name));
  assert.deepEqual(unusedHtmlClasses, []);
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.textContent = "";
    this.hidden = false;
    this.value = "";
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.className = "";
    this.listeners = new Map();
    this._classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => this._classes.add(name)),
      remove: (...names) => names.forEach(name => this._classes.delete(name)),
      toggle: name => {
        if (this._classes.has(name)) {
          this._classes.delete(name);
          return false;
        }
        this._classes.add(name);
        return true;
      },
      contains: name => this._classes.has(name)
    };
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  setAttribute(name, value) {
    this[name] = String(value);
  }
  append(...children) {
    this.children.push(...children);
  }
  appendChild(child) {
    this.children.push(child);
  }
  replaceChildren(...children) {
    this.children = children;
    this.textContent = "";
  }
  querySelector(selector) {
    const cueMatch = String(selector).match(/^\.cue\[data-index="(-?\d+)"\]$/);
    if (!cueMatch) {
      return null;
    }
    const target = cueMatch[1];
    return this.children.find(child => child.className === "cue" && child.dataset?.index === target) || null;
  }
  querySelectorAll(selector) {
    if (selector === ".cue.active") {
      return this.children.filter(child => child.className === "cue" && child.classList.contains("active"));
    }
    return [];
  }
  scrollIntoView(options) {
    this.scrolledIntoView = options || true;
  }
  removeAttribute(name) {
    delete this[name];
  }
  click() {
    this.listeners.get("click")?.();
  }
}

const elementBySelector = new Map();
const document = {
  addEventListener: () => {},
  querySelector(selector) {
    if (!elementBySelector.has(selector)) {
      elementBySelector.set(selector, new FakeElement(selector));
    }
    return elementBySelector.get(selector);
  },
  createElement(tagName) {
    return new FakeElement(tagName);
  }
};

const chrome = {
  runtime: { sendMessage: async () => ({ ok: true }) },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
      remove: async () => {}
    },
    sync: {
      get: async () => ({}),
      set: async () => {}
    }
  },
  tabs: {
    query: async () => [{ id: 1, title: "Video", url: "https://example.test/watch/1" }]
  }
};

const context = vm.createContext({
  chrome,
  console,
  document,
  window: {
    setInterval,
    clearInterval
  },
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
  Blob,
  TextEncoder,
  crypto: {
    subtle: {
      digest: async (_algorithm, bytes) => {
        const input = new Uint8Array(bytes);
        const output = new Uint8Array(32);
        for (let index = 0; index < input.length; index += 1) {
          output[index % output.length] = (output[index % output.length] + input[index] + index) % 256;
        }
        return output.buffer;
      }
    }
  },
  FuguangSubtitleFormat: {
    parseSubtitleImportText: () => ({ transcript: { source: [], translated: [] }, metadata: {} })
  }
});

const source = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.js", import.meta.url), "utf8");
const subtitleOutputSource = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-output.js", import.meta.url), "utf8");
const cacheUtilsSource = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-cache-utils.js", import.meta.url), "utf8");
const cacheStoreSource = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-cache-store.js", import.meta.url), "utf8");
const languageSource = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel-language.js", import.meta.url), "utf8");
const profilesSource = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel-profiles.js", import.meta.url), "utf8");
vm.runInContext(subtitleOutputSource, context, { filename: "subtitle-output.js" });
vm.runInContext(cacheUtilsSource, context, { filename: "subtitle-cache-utils.js" });
vm.runInContext(cacheStoreSource, context, { filename: "subtitle-cache-store.js" });
vm.runInContext(languageSource, context, { filename: "sidepanel-language.js" });
vm.runInContext(profilesSource, context, { filename: "sidepanel-profiles.js" });
vm.runInContext(source, context, { filename: "sidepanel.js" });

const result = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "job-1";
    renderedSubtitleJobId = "job-1";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "旧字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "旧字幕" }] };
    currentSubtitleCacheEntry = { id: "subtitle:test", transcript: currentTranscript };
    cachedSubtitleLoadedKey = "subtitle:test";
    subtitleLoadRequestId = 10;
    pendingSubtitlePromise = Promise.resolve({ cues: [{ start: 9, end: 10, text: "迟到字幕" }], source: "vtt", transcript: null });
    pendingSubtitleSignature = "old-load";
    elements.subtitleList.textContent = "旧字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:test";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async ids => ids.includes("subtitle:test") ? 1 : 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.detached = true;
    };
    setMessage = text => {
      globalThis.lastMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();

      return {
        detached: Boolean(globalThis.detached),
        message: globalThis.lastMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null,
        subtitleLoadRequestId,
        pendingSubtitlePromise,
        pendingSubtitleSignature
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      setMessage = originalSetMessage;
    }
  })()
`, context);

assert.equal(result.message, "已清除当前页面字幕缓存（1 条）。");
assert.equal(result.detached, true);
assert.equal(result.listText, "已清除当前页面字幕缓存。");
assert.equal(result.cuesLength, 0);
assert.equal(result.renderedSubtitleJobId, "");
assert.equal(result.currentTranscriptIsNull, true);
assert.equal(result.subtitleLoadRequestId, 11);
assert.equal(result.pendingSubtitlePromise, null);
assert.equal(result.pendingSubtitleSignature, "");

const clearCacheDetachesEvenWhenSuppressFailsState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "job-suppress-fails";
    renderedSubtitleJobId = "job-suppress-fails";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "缓存字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "缓存字幕" }] };
    currentSubtitleCacheEntry = { id: "subtitle:suppress-fails", transcript: currentTranscript };
    cachedSubtitleLoadedKey = "subtitle:suppress-fails";
    elements.subtitleList.textContent = "缓存字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:suppress-fails";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async ids => ids.includes("subtitle:suppress-fails") ? 1 : 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.detachedAfterSuppressFailure = true;
    };
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE) {
        return { ok: false, error: "后台测试失败" };
      }
      return { ok: true };
    };
    setMessage = text => {
      globalThis.lastSuppressFailureMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        detached: Boolean(globalThis.detachedAfterSuppressFailure),
        message: globalThis.lastSuppressFailureMessage,
        cuesLength: subtitleCues.length,
        currentTranscriptIsNull: currentTranscript === null
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      delete globalThis.detachedAfterSuppressFailure;
      delete globalThis.lastSuppressFailureMessage;
    }
  })()
`, context);

assert.equal(clearCacheDetachesEvenWhenSuppressFailsState.detached, true);
assert.equal(clearCacheDetachesEvenWhenSuppressFailsState.cuesLength, 0);
assert.equal(clearCacheDetachesEvenWhenSuppressFailsState.currentTranscriptIsNull, true);
assert.match(clearCacheDetachesEvenWhenSuppressFailsState.message, /已清除当前页面字幕缓存/);
assert.match(clearCacheDetachesEvenWhenSuppressFailsState.message, /后台字幕状态清理失败/);

const clearMissingDisplayedCacheState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "";
    renderedSubtitleJobId = "cache-subtitle:missing";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "已显示缓存字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "已显示缓存字幕" }] };
    currentSubtitleCacheEntry = { id: "subtitle:missing", transcript: currentTranscript };
    cachedSubtitleLoadedKey = "subtitle:missing";
    subtitleLoadRequestId = 20;
    elements.subtitleList.textContent = "已显示缓存字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:missing";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async () => 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.missingDisplayedCacheDetached = true;
    };
    chrome.runtime.sendMessage = async () => ({ ok: true });
    setMessage = text => {
      globalThis.lastMissingDisplayedCacheMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        detached: Boolean(globalThis.missingDisplayedCacheDetached),
        message: globalThis.lastMissingDisplayedCacheMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null,
        currentSubtitleCacheEntry,
        cachedSubtitleLoadedKey,
        subtitleLoadRequestId
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      delete globalThis.missingDisplayedCacheDetached;
      delete globalThis.lastMissingDisplayedCacheMessage;
    }
  })()
`, context);

assert.equal(clearMissingDisplayedCacheState.detached, true);
assert.match(clearMissingDisplayedCacheState.message, /没有已保存的字幕缓存/);
assert.match(clearMissingDisplayedCacheState.message, /已清除当前显示/);
assert.equal(clearMissingDisplayedCacheState.listText, "已清除当前页面字幕缓存。");
assert.equal(clearMissingDisplayedCacheState.cuesLength, 0);
assert.equal(clearMissingDisplayedCacheState.renderedSubtitleJobId, "");
assert.equal(clearMissingDisplayedCacheState.currentTranscriptIsNull, true);
assert.equal(clearMissingDisplayedCacheState.currentSubtitleCacheEntry, null);
assert.equal(clearMissingDisplayedCacheState.cachedSubtitleLoadedKey, "");
assert.equal(clearMissingDisplayedCacheState.subtitleLoadRequestId, 21);

const clearMissingNonCacheDisplayState = await vm.runInContext(`
  (async () => {
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    currentJobId = "running-job";
    renderedSubtitleJobId = "running-job";
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "运行中字幕" }];
    currentTranscript = { source: [], translated: [{ start: 1, end: 2, text: "运行中字幕" }] };
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    elements.subtitleList.textContent = "运行中字幕";
    const originalBuildSubtitleCacheKeyForCurrentPage = buildSubtitleCacheKeyForCurrentPage;
    const originalBuildMatchingSubtitleCacheKeysForCurrentPage = buildMatchingSubtitleCacheKeysForCurrentPage;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const originalSetMessage = setMessage;
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:missing-running";
    buildMatchingSubtitleCacheKeysForCurrentPage = async () => [];
    deleteSubtitleCacheEntries = async () => 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.missingNonCacheDetached = true;
    };
    setMessage = text => {
      globalThis.lastMissingNonCacheMessage = text;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        detached: Boolean(globalThis.missingNonCacheDetached),
        message: globalThis.lastMissingNonCacheMessage,
        listText: elements.subtitleList.textContent,
        cuesLength: subtitleCues.length,
        renderedSubtitleJobId,
        currentTranscriptIsNull: currentTranscript === null
      };
    } finally {
      buildSubtitleCacheKeyForCurrentPage = originalBuildSubtitleCacheKeyForCurrentPage;
      buildMatchingSubtitleCacheKeysForCurrentPage = originalBuildMatchingSubtitleCacheKeysForCurrentPage;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      setMessage = originalSetMessage;
      delete globalThis.missingNonCacheDetached;
      delete globalThis.lastMissingNonCacheMessage;
    }
  })()
`, context);

assert.equal(clearMissingNonCacheDisplayState.detached, false);
assert.equal(clearMissingNonCacheDisplayState.message, "当前页面没有已保存的字幕缓存。");
assert.equal(clearMissingNonCacheDisplayState.listText, "运行中字幕");
assert.equal(clearMissingNonCacheDisplayState.cuesLength, 1);
assert.equal(clearMissingNonCacheDisplayState.renderedSubtitleJobId, "running-job");
assert.equal(clearMissingNonCacheDisplayState.currentTranscriptIsNull, false);

const audioButtonState = await vm.runInContext(`
  (() => {
    startRequestInFlight = false;
    retryRequestInFlight = false;
    const job = {
      id: "browser-cleared-job",
      status: "completed",
      audioCacheRemoved: true,
      translation: { chunksFailed: 0 }
    };
    updateActionButtons(job);
    return {
      disabled: elements.clearAudioCache.disabled,
      text: elements.clearAudioCache.textContent,
      title: elements.clearAudioCache.title
    };
  })()
`, context);

assert.equal(audioButtonState.disabled, false);
assert.equal(audioButtonState.text, "清音频缓存");
assert.match(audioButtonState.title, /浏览器本地音频切片缓存/);
assert.match(audioButtonState.title, /字幕缓存不受影响/);
assert.doesNotMatch(audioButtonState.title, /本机音频切片/);

const elapsedTextState = await vm.runInContext(`
  (() => ({
    positive: formatElapsedSeconds(123.48),
    zero: formatElapsedSeconds(0),
    negative: formatElapsedSeconds(-1)
  }))()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(elapsedTextState)), {
  positive: "123s",
  zero: "0s",
  negative: "0s"
});

const completedJobDisplayState = await vm.runInContext(`
  (() => ({
    completedTopStatus: statusLabel({ preload: "completed", preloadJob: { status: "completed" } }),
    warningTopStatus: statusLabel({ preload: "completed", preloadJob: { status: "completed", stage: "completed_with_warnings" } }),
    failedTopStatus: statusLabel({ preload: "failed", preloadJob: { status: "failed" } }),
    cancelledTopStatus: statusLabel({ preload: "cancelled", preloadJob: { status: "cancelled" } }),
    runningTopStatus: statusLabel({ preload: "running", preloadJob: { status: "running" } }),
    idleTopStatus: statusLabel({ preload: "idle" }),
    warningJobTitle: jobTitle({ status: "completed", stage: "completed_with_warnings" }),
    completedStep: extractionActivityText({ status: "completed", message: "正在用 Web FFmpeg 提取音频" }),
    completedPhaseStep: extractionActivityText({ phase: "completed", message: "正在用 Web FFmpeg 提取音频" }),
    doneStep: extractionActivityText({ status: "done", message: "较旧的抽取进度" }),
    runningStep: extractionActivityText({ status: "running", message: "正在用 Web FFmpeg 提取音频" })
  }))()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(completedJobDisplayState)), {
  completedTopStatus: "字幕已完成",
  warningTopStatus: "完成，有警告",
  failedTopStatus: "任务失败",
  cancelledTopStatus: "任务已停止",
  runningTopStatus: "预加载",
  idleTopStatus: "待机",
  warningJobTitle: "完成，有警告",
  completedStep: "已完成",
  completedPhaseStep: "已完成",
  doneStep: "已完成",
  runningStep: "正在用 Web FFmpeg 提取音频"
});

const refreshCompletedJobStatusState = await vm.runInContext(`
  (async () => {
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalTabsQuery = chrome.tabs.query;
    chrome.tabs.query = async () => [{ id: 1, title: "Video", url: "https://example.test/watch/1" }];
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.GET_STATUS) {
        return {
          ok: true,
          preload: "running",
          preloadJob: null,
          page: { title: "Video", url: "https://example.test/watch/1" },
          candidates: []
        };
      }
      if (message.type === MESSAGE.CHECK_PRELOAD_JOB) {
        return {
          ok: true,
          job: {
            id: "job-completed",
            status: "completed",
            stage: "completed",
            sourceUrl: "https://media.example.test/audio.m4s",
            progress: {
              extraction: {
                phase: "completed",
                percent: 100,
                message: "正在用 Web FFmpeg 提取音频",
                chunkSeconds: 1200
              },
              translation: {
                percent: 100,
                chunksDone: 1,
                chunksTotal: 1,
                chunkStatuses: []
              }
            },
            translation: {
              chunksDone: 1,
              chunksTotal: 1,
              chunkStatuses: []
            }
          }
        };
      }
      return { ok: true };
    };
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1" };
    lastActivatedTabKey = activeTabKey(activeTab);
    currentJobId = "job-completed";
    refreshStatusInFlight = false;
    try {
      await refreshStatus();
      const metrics = elements.jobStatus.children.find(child => child.className === "metrics");
      const currentStep = metrics.children
        .find(child => child.children[0].textContent === "当前步骤")
        .children[1].textContent;
      return {
        topStatus: elements.status.textContent,
        currentStep
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
      chrome.tabs.query = originalTabsQuery;
      refreshStatusInFlight = false;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(refreshCompletedJobStatusState)), {
  topStatus: "字幕已完成",
  currentStep: "已完成"
});

const renderCompletedJobStatusState = await vm.runInContext(`
  (() => {
    elements.status.textContent = "预加载";
    renderJob({
      id: "job-render-completed",
      status: "completed",
      stage: "completed",
      sourceUrl: "https://media.example.test/audio.m4s",
      extract: {
        status: "completed",
        progress: 100,
        chunkSeconds: 1200
      },
      translation: {
        chunksDone: 1,
        chunksTotal: 1,
        chunksFailed: 0,
        segmentCount: 2,
        chunkStatuses: []
      }
    });
    return {
      topStatus: elements.status.textContent,
      startDisabled: elements.startPreload.disabled,
      stopDisabled: elements.cancelPreload.disabled
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(renderCompletedJobStatusState)), {
  topStatus: "字幕已完成",
  startDisabled: false,
  stopDisabled: true
});

const exportSubtitleState = await vm.runInContext(`
  (async () => {
    const originalDownloadBlob = downloadBlob;
    const originalSubtitleCues = subtitleCues;
    const originalPageTitle = elements.pageTitle.textContent;
    const downloads = [];
    downloadBlob = async (blob, filename) => {
      downloads.push({ filename, text: await blob.text() });
    };
    try {
      elements.pageTitle.textContent = "A/B: 视频标题?";
      subtitleCues = [
        { start: 0, end: 1.5, time: "00:00:00.000 --> 00:00:01.500", sourceText: "hello", text: "你好" },
        { start: 2, end: 3, time: "00:00:02.000 --> 00:00:03.000", sourceText: "world", text: "世界" }
      ];
      subtitleDisplayMode = "bilingual";
      await exportCurrentSubtitle();
      const exportedMessage = elements.message.textContent;
      subtitleCues = [];
      await exportCurrentSubtitle();
      return {
        downloads,
        exportedMessage,
        emptyMessage: elements.message.textContent
      };
    } finally {
      downloadBlob = originalDownloadBlob;
      subtitleCues = originalSubtitleCues;
      elements.pageTitle.textContent = originalPageTitle;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(exportSubtitleState)), {
  downloads: [{
    filename: "A B 视频标题.srt",
    text: [
      "1",
      "00:00:00,000 --> 00:00:01,500",
      "hello",
      "你好",
      "",
      "2",
      "00:00:02,000 --> 00:00:03,000",
      "world",
      "世界",
      ""
    ].join("\n")
  }],
  exportedMessage: "SRT 字幕已导出。",
  emptyMessage: "还没有可导出的字幕。"
});

const exportDiagnosticsState = await vm.runInContext(`
  (async () => {
    const originalDownloadBlob = downloadBlob;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalPageTitle = elements.pageTitle.textContent;
    const downloads = [];
    const messages = [];
    downloadBlob = async (blob, filename) => {
      downloads.push({ filename, text: await blob.text(), bytes: new Uint8Array(await blob.arrayBuffer()) });
    };
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      if (message.type === "FUGUANG_GET_PRELOAD_DIAGNOSTICS") {
        return {
          ok: true,
          diagnostics: {
            version: 1,
            job: { id: message.jobId },
            audioChunks: [{ index: 0, file: { cacheUrl: "https://fuguang.local/audio/chunk.mp3" } }],
            asrChunks: [{ chunk: { index: 0 }, rawPayload: { text: "hello" } }]
          },
          audioFiles: [{
            path: "audio/chunk-0000.mp3",
            mime: "audio/mpeg",
            bytes: 3,
            base64: "AQID"
          }]
        };
      }
      return { ok: true };
    };
    try {
      elements.pageTitle.textContent = "诊断/视频?";
      currentJobId = "job-diag";
      await exportCurrentDiagnostics();
      return {
        messages,
        downloads,
        messageText: elements.message.textContent
      };
    } finally {
      downloadBlob = originalDownloadBlob;
      chrome.runtime.sendMessage = originalSendMessage;
      elements.pageTitle.textContent = originalPageTitle;
    }
  })()
`, context);

assert.equal(exportDiagnosticsState.messages[0].type, "FUGUANG_GET_PRELOAD_DIAGNOSTICS");
assert.equal(exportDiagnosticsState.messages[0].jobId, "job-diag");
assert.equal(exportDiagnosticsState.downloads[0].filename, "诊断 视频-asr-diagnostics.tar");
assert.match(exportDiagnosticsState.downloads[0].text, /diagnostics\.json/);
assert.match(exportDiagnosticsState.downloads[0].text, /audio\/chunk-0000\.mp3/);
assert.deepEqual(Array.from(exportDiagnosticsState.downloads[0].bytes.slice(-1024)), new Array(1024).fill(0));
assert.equal(exportDiagnosticsState.messageText, "ASR 诊断已导出（含 1 个音频分段）。");

const retryStageButtonState = await vm.runInContext(`
  (() => {
    startRequestInFlight = false;
    retryRequestInFlight = false;
    translationRetryRequestInFlight = false;

    updateActionButtons({
      id: "browser-resume-asr",
      status: "completed",
      reusableAudioChunks: 2,
      reusableSourceChunks: 0,
      translation: { chunksFailed: 0, chunkStatuses: [] }
    });
    const audioResume = {
      retryDisabled: elements.retryPreload.disabled,
      retryText: elements.retryPreload.textContent,
      retryTitle: elements.retryPreload.title,
      translationDisabled: elements.retryTranslation.disabled
    };

    updateActionButtons({
      id: "browser-resume-translation",
      status: "completed",
      reusableAudioChunks: 2,
      reusableSourceChunks: 2,
      translation: { chunksFailed: 0, chunkStatuses: [] }
    });
    const translationResume = {
      retryDisabled: elements.retryPreload.disabled,
      retryText: elements.retryPreload.textContent,
      retryTitle: elements.retryPreload.title,
      translationTitle: elements.retryTranslation.title,
      translationDisabled: elements.retryTranslation.disabled
    };

    return { audioResume, translationResume };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(retryStageButtonState)), {
  audioResume: {
    retryDisabled: false,
    retryText: "继续 ASR",
    retryTitle: "复用已抽取的音频缓存继续语音识别和翻译，不重新下载媒体切片。",
    translationDisabled: true
  },
  translationResume: {
    retryDisabled: false,
    retryText: "继续翻译",
    retryTitle: "后台仍保留当前任务的 ASR 原文时，继续翻译不重新抽取音频，也不重新语音识别。",
    translationTitle: "后台仍保留当前任务的 ASR 原文时，只重新翻译字幕；如果浏览器回收了后台任务状态，需要重新抽取。",
    translationDisabled: false
  }
});

const retryChunkTranslationOnlyTitleState = await vm.runInContext(`
  (() => {
    currentJob = {
      id: "browser-chunk-translation-title",
      status: "completed",
      stage: "completed_with_warnings",
      translation: {
        chunksFailed: 1,
        chunkStatuses: [
          { index: 0, stage: "completed_with_warnings", sourceCount: 2, error: "bad translation" }
        ]
      }
    };
    renderJob(currentJob);
    const chunks = elements.jobStatus.children.find(child => child.className === "chunks");
    const row = chunks.children[0];
    const retryButton = row.children.find(child => child.className === "chunk-retry");
    return {
      text: retryButton.textContent,
      title: retryButton.title,
      disabled: retryButton.disabled
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(retryChunkTranslationOnlyTitleState)), {
  text: "重翻译",
  title: "后台仍保留当前任务的 ASR 原文时，只重跑这个翻译分段；如果浏览器回收了后台任务状态，需要重新抽取。",
  disabled: false
});

const subtitleScrollState = await vm.runInContext(`
  (() => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    elements.subtitleList.replaceChildren(first, second);
    activeCueIndex = 1;

    subtitleListPointerInside = true;
    subtitleListUserControlUntil = Date.now() + 5000;
    setActiveCueIndex(0);
    const blockedAutoScroll = !first.scrolledIntoView;

    subtitleListPointerInside = true;
    subtitleListUserControlUntil = Date.now() + 5000;
    setActiveCueIndex(1, { forceScroll: true });
    return {
      blockedAutoScroll,
      forcedScroll: Boolean(second.scrolledIntoView),
      firstActiveRemoved: !first.classList.contains("active"),
      secondActive: second.classList.contains("active")
    };
  })()
`, context);

assert.equal(subtitleScrollState.blockedAutoScroll, true);
assert.equal(subtitleScrollState.forcedScroll, true);
assert.equal(subtitleScrollState.firstActiveRemoved, true);
assert.equal(subtitleScrollState.secondActive, true);

const singleActiveState = await vm.runInContext(`
  (() => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    const third = document.createElement("div");
    third.className = "cue";
    third.dataset.index = "2";
    elements.subtitleList.replaceChildren(first, second, third);
    first.classList.add("active");
    second.classList.add("active");
    activeCueIndex = 0;

    setActiveCueIndex(2);

    return {
      firstActive: first.classList.contains("active"),
      secondActive: second.classList.contains("active"),
      thirdActive: third.classList.contains("active")
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(singleActiveState)), {
  firstActive: false,
  secondActive: false,
  thirdActive: true
});

const asrProfileState = await vm.runInContext(`
  (() => {
    const profiles = normalizeStoredProfiles("asr", [
      { id: "custom_vad", name: "自定义 VAD", providerType: "openai", baseUrl: "https://asr.example/v1", model: "whisper-1", vadFilter: "on" }
    ]);
    const custom = profiles.find(profile => profile.id === "custom_vad");
    const openai = profiles.find(profile => profile.id === "openai_whisper");
    return {
      selected: normalizeSelectedProfileId(profiles, "missing_profile", "openai_whisper"),
      customVadFilter: custom?.vadFilter,
      defaultVadFilter: openai?.vadFilter
    };
  })()
`, context);

assert.equal(asrProfileState.selected, "openai_whisper");
assert.equal(asrProfileState.customVadFilter, "on");
assert.equal(asrProfileState.defaultVadFilter, "auto");

const targetLanguageState = await vm.runInContext(`
  (() => {
    setTargetLanguageValue("english");
    const english = getTargetLanguageValue();
    setTargetLanguageValue("zh_cn");
    const chinese = getTargetLanguageValue();
    setTargetLanguageValue("unknown-language");
    const fallback = getTargetLanguageValue();
    return { english, chinese, fallback };
  })()
`, context);

assert.equal(targetLanguageState.english, "en");
assert.equal(targetLanguageState.chinese, "zh-CN");
assert.equal(targetLanguageState.fallback, "zh-CN");

const sourceLanguageState = await vm.runInContext(`
  (() => {
    setSourceLanguageValue("auto");
    const auto = getSourceLanguageValue();
    setSourceLanguageValue("japanese");
    const japanese = getSourceLanguageValue();
    setSourceLanguageValue("zh_cn");
    const chinese = getSourceLanguageValue();
    setSourceLanguageValue("unknown-language");
    const fallback = getSourceLanguageValue();
    return { auto, japanese, chinese, fallback };
  })()
`, context);

assert.equal(sourceLanguageState.auto, "auto");
assert.equal(sourceLanguageState.japanese, "ja");
assert.equal(sourceLanguageState.chinese, "zh");
assert.equal(sourceLanguageState.fallback, "auto");

const syncedSubtitleSettingsState = await vm.runInContext(`
  (async () => {
    const originalSyncGet = chrome.storage.sync.get;
    const originalLocalGet = chrome.storage.local.get;
    let requestedKeys = [];
    chrome.storage.sync.get = async keys => {
      requestedKeys = keys;
      return {
        subtitleFontSize: 36,
        subtitleBackgroundOpacity: 42,
        subtitleOverlayEnabled: false,
        subtitleDisplayMode: "bilingual"
      };
    };
    chrome.storage.local.get = async () => ({ modelSettingsVersion: MODEL_SETTINGS_VERSION });
    try {
      await loadSettings();
      return {
        requestedKeys,
        fontSize: elements.subtitleFontSize.value,
        opacity: elements.subtitleBackgroundOpacity.value,
        overlayEnabled: subtitleOverlayEnabled,
        displayMode: subtitleDisplayMode,
        overlayText: elements.subtitleOverlayToggle.textContent,
        modeText: elements.subtitleModeToggle.textContent
      };
    } finally {
      chrome.storage.sync.get = originalSyncGet;
      chrome.storage.local.get = originalLocalGet;
    }
  })()
`, context);

assert.ok(syncedSubtitleSettingsState.requestedKeys.includes("subtitleFontSize"));
assert.ok(syncedSubtitleSettingsState.requestedKeys.includes("subtitleBackgroundOpacity"));
assert.equal(syncedSubtitleSettingsState.fontSize, 36);
assert.equal(syncedSubtitleSettingsState.opacity, 42);
assert.equal(syncedSubtitleSettingsState.overlayEnabled, false);
assert.equal(syncedSubtitleSettingsState.displayMode, "bilingual");
assert.equal(syncedSubtitleSettingsState.overlayText, "浮层关");
assert.equal(syncedSubtitleSettingsState.modeText, "双语开");

const subtitleCacheVersionState = await vm.runInContext(`
  (async () => buildSubtitleCacheKey({
    pageUrl: "https://example.test/watch/1?utm_source=old",
    sourceUrl: "https://media.example.test/audio.mp4?token=secret"
  }))()
`, context);

assert.match(subtitleCacheVersionState, /^subtitle:v/);

const samePageDifferentMediaCacheKeyState = await vm.runInContext(`
  (async () => {
    const first = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1?utm_source=old",
      sourceUrl: "https://media.example.test/audio-a.mp4?token=secret-a"
    });
    const sameMediaRotatedToken = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1?utm_source=new",
      sourceUrl: "https://media.example.test/audio-a.mp4?token=secret-b"
    });
    const queryIdentityA = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1",
      sourceUrl: "https://media.example.test/playback?id=clip-a&token=secret-a"
    });
    const queryIdentityARotatedToken = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1",
      sourceUrl: "https://media.example.test/playback?id=clip-a&token=secret-b"
    });
    const queryIdentityB = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1",
      sourceUrl: "https://media.example.test/playback?id=clip-b&token=secret-a"
    });
    const second = await buildSubtitleCacheKey({
      pageUrl: "https://example.test/watch/1?utm_source=old",
      sourceUrl: "https://media.example.test/audio-b.mp4?token=secret-a"
    });
    return { first, sameMediaRotatedToken, queryIdentityA, queryIdentityARotatedToken, queryIdentityB, second };
  })()
`, context);

assert.notEqual(
  samePageDifferentMediaCacheKeyState.first,
  samePageDifferentMediaCacheKeyState.second,
  "same page with different media sources must not share a subtitle cache key"
);
assert.equal(
  samePageDifferentMediaCacheKeyState.first,
  samePageDifferentMediaCacheKeyState.sameMediaRotatedToken,
  "rotating tracking/source tokens should not create a new subtitle cache entry"
);
assert.equal(
  samePageDifferentMediaCacheKeyState.queryIdentityA,
  samePageDifferentMediaCacheKeyState.queryIdentityARotatedToken,
  "rotating media tokens should not change a query-identified media cache key"
);
assert.notEqual(
  samePageDifferentMediaCacheKeyState.queryIdentityA,
  samePageDifferentMediaCacheKeyState.queryIdentityB,
  "media identity query parameters must prevent subtitle cache collisions"
);

const subtitleCacheEntrySanitizesUrlsState = await vm.runInContext(`
  (async () => {
    const entry = await buildSubtitleCacheEntry(
      { source: [{ start: 0, end: 1, text: "hello" }], translated: [] },
      {
        pageUrl: "https://example.test/watch/1?access_token=page-secret&Policy=page-policy&utm_source=old",
        sourceUrl: "https://media.example.test/playback?id=clip-a&token=media-secret&signature=old-signature&Key-Pair-Id=key-pair&AWSAccessKeyId=aws-key",
        title: "Tokenized page"
      }
    );
    const malformed = normalizeMediaCacheUrl("not-a-url?token=bad-token&Policy=bad-policy&id=clip-a");
    return {
      pageUrl: entry.pageUrl,
      sourceUrl: entry.sourceUrl,
      malformed,
      serialized: JSON.stringify(entry)
    };
  })()
`, context);

assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("page-secret"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("page-policy"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("media-secret"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("old-signature"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("key-pair"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.serialized.includes("aws-key"), false);
assert.equal(subtitleCacheEntrySanitizesUrlsState.pageUrl, "https://example.test/watch/1");
assert.equal(subtitleCacheEntrySanitizesUrlsState.sourceUrl, "https://media.example.test/playback?id=clip-a");
assert.equal(subtitleCacheEntrySanitizesUrlsState.malformed, "not-a-url?id=clip-a");

const subtitleCacheIndexedDbStorageState = await vm.runInContext(`
  (async () => {
    function createFakeIndexedDB() {
      const databases = new Map();
      const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
      const schedule = callback => Promise.resolve().then(callback);

      class FakeRequest {
        constructor() {
          this.result = undefined;
          this.error = null;
          this.onupgradeneeded = null;
          this.onsuccess = null;
          this.onerror = null;
        }
      }

      class FakeStore {
        constructor(store, transaction) {
          this.store = store;
          this.transaction = transaction;
        }

        get(id) {
          return this.transaction.queue(() => clone(this.store.records.get(id)));
        }

        getAll() {
          return this.transaction.queue(() => [...this.store.records.values()].map(clone));
        }

        put(entry) {
          return this.transaction.queue(() => {
            const id = entry?.[this.store.keyPath];
            if (!id) {
              throw new Error("missing key");
            }
            this.store.records.set(id, clone(entry));
            return id;
          });
        }

        delete(id) {
          return this.transaction.queue(() => {
            this.store.records.delete(id);
            return undefined;
          });
        }
      }

      class FakeTransaction {
        constructor(store) {
          this.store = store;
          this.pending = 0;
          this.completed = false;
          this.error = null;
          this.oncomplete = null;
          this.onerror = null;
        }

        objectStore() {
          return new FakeStore(this.store, this);
        }

        queue(work) {
          const request = new FakeRequest();
          this.pending += 1;
          schedule(() => {
            try {
              request.result = work();
              request.onsuccess?.();
            } catch (error) {
              request.error = error;
              this.error = error;
              request.onerror?.();
              this.onerror?.();
            } finally {
              this.pending -= 1;
              if (!this.pending && !this.completed) {
                this.completed = true;
                schedule(() => this.oncomplete?.());
              }
            }
          });
          return request;
        }
      }

      class FakeDb {
        constructor(record) {
          this.record = record;
          this.objectStoreNames = {
            contains: name => this.record.stores.has(name)
          };
        }

        createObjectStore(name, options = {}) {
          const store = {
            keyPath: options.keyPath || "id",
            records: new Map()
          };
          this.record.stores.set(name, store);
          return new FakeStore(store, new FakeTransaction(store));
        }

        transaction(name) {
          const store = this.record.stores.get(name);
          if (!store) {
            throw new Error("missing store: " + name);
          }
          return new FakeTransaction(store);
        }

        close() {
          this.record.closeCount += 1;
        }
      }

      return {
        databases,
        open(name, version) {
          const request = new FakeRequest();
          schedule(() => {
            let record = databases.get(name);
            const needsUpgrade = !record || record.version < version;
            if (!record) {
              record = { version, stores: new Map(), closeCount: 0 };
              databases.set(name, record);
            }
            record.version = Math.max(record.version, version);
            request.result = new FakeDb(record);
            if (needsUpgrade) {
              request.onupgradeneeded?.();
            }
            request.onsuccess?.();
          });
          return request;
        }
      };
    }

    const hadIndexedDB = Object.prototype.hasOwnProperty.call(globalThis, "indexedDB");
    const originalIndexedDB = globalThis.indexedDB;
    const fakeIndexedDB = createFakeIndexedDB();
    globalThis.indexedDB = fakeIndexedDB;
    currentSubtitleCacheEntry = null;

    try {
      const entry = {
        id: "subtitle:vtest:indexeddb",
        pageUrl: "https://example.test/watch/1",
        sourceUrl: "https://media.example.test/audio.mp4",
        title: "IndexedDB storage",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        transcript: {
          source: [{ start: 0, end: 1, text: "hello" }],
          translated: [{ start: 0, end: 1, text: "你好" }]
        }
      };

      await putSubtitleCacheEntry(entry);
      const stored = await getSubtitleCacheEntry(entry.id);
      const allBeforeDelete = await getAllSubtitleCacheEntries();
      const deleted = await deleteSubtitleCacheEntries([entry.id, entry.id, "", "missing"]);
      const storedAfterDelete = await getSubtitleCacheEntry(entry.id);
      const allAfterDelete = await getAllSubtitleCacheEntries();
      const dbRecord = fakeIndexedDB.databases.get(SUBTITLE_CACHE_DB_NAME);

      return {
        storedText: stored?.transcript?.translated?.[0]?.text || "",
        allBeforeDeleteLength: allBeforeDelete.length,
        deleted,
        storedAfterDelete,
        allAfterDeleteLength: allAfterDelete.length,
        storeExists: dbRecord?.stores?.has(SUBTITLE_CACHE_STORE) || false,
        closeCount: dbRecord?.closeCount || 0
      };
    } finally {
      if (hadIndexedDB) {
        globalThis.indexedDB = originalIndexedDB;
      } else {
        delete globalThis.indexedDB;
      }
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(subtitleCacheIndexedDbStorageState)), {
  storedText: "你好",
  allBeforeDeleteLength: 1,
  deleted: 1,
  storedAfterDelete: null,
  allAfterDeleteLength: 0,
  storeExists: true,
  closeCount: 7
});

const bilibiliReloadCacheKeyState = await vm.runInContext(`
  (async () => {
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const reloadedPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id&vd_source=new";
    const savedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770000000&upsig=old&oi=111&trid=old&nbs=1";
    const reloadedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new&oi=222&trid=new&nbs=2";
    const savedKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const reloadedKey = await buildSubtitleCacheKey({ pageUrl: reloadedPage, sourceUrl: reloadedSource });
    const differentVideoKey = await buildSubtitleCacheKey({
      pageUrl: "https://www.bilibili.com/video/BVdifferent/",
      sourceUrl: reloadedSource
    });
    const bilibiliPageOnlyKey = await buildSubtitleCacheKey({
      pageUrl: reloadedPage,
      sourceUrl: ""
    });
    return {
      savedKey,
      reloadedKey,
      differentVideoKey,
      bilibiliPageOnlyKey,
      genericNoSlash: normalizeCacheUrl("https://example.test/watch/1"),
      genericSlash: normalizeCacheUrl("https://example.test/watch/1/"),
      bilibiliNoiseA: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old&spm_id_from=333.788&vd_source=old"),
      bilibiliNoiseB: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK/?trackid=new&share_source=copy_web"),
      bilibiliNoiseC: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK/"),
      bilibiliPartOne: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK?p=1&trackid=old"),
      bilibiliPartTwo: normalizeCacheUrl("https://www.bilibili.com/video/BV17oSmBWEAK?p=2&trackid=old")
    };
  })()
`, context);

assert.equal(
  bilibiliReloadCacheKeyState.savedKey,
  bilibiliReloadCacheKeyState.reloadedKey,
  "Bilibili page reload slash and signed media parameter rotation should keep the subtitle cache key stable"
);
assert.notEqual(
  bilibiliReloadCacheKeyState.savedKey,
  bilibiliReloadCacheKeyState.differentVideoKey,
  "different Bilibili videos must not share subtitle cache entries"
);
assert.equal(
  bilibiliReloadCacheKeyState.bilibiliPageOnlyKey,
  "",
  "Bilibili cache keys must not be page-only while media identity is still unknown"
);
assert.notEqual(
  bilibiliReloadCacheKeyState.genericNoSlash,
  bilibiliReloadCacheKeyState.genericSlash,
  "generic page URLs should not be merged only because of a trailing slash"
);
assert.equal(
  bilibiliReloadCacheKeyState.bilibiliNoiseA,
  bilibiliReloadCacheKeyState.bilibiliNoiseB,
  "Bilibili video cache identity must ignore tracking query parameters"
);
assert.equal(
  bilibiliReloadCacheKeyState.bilibiliNoiseA,
  bilibiliReloadCacheKeyState.bilibiliNoiseC,
  "Bilibili video cache identity must survive tracking query loss"
);
assert.notEqual(
  bilibiliReloadCacheKeyState.bilibiliPartOne,
  bilibiliReloadCacheKeyState.bilibiliPartTwo,
  "Bilibili multipart videos must keep the p query isolated"
);

const bilibiliReloadCacheAutoLoadState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const reloadedPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id&vd_source=new";
    const savedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770000000&upsig=old&oi=111&trid=old&nbs=1";
    const reloadedSource = "https://upos-sz-mirrorcos.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new&oi=222&trid=new&nbs=2";
    const savedKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    activeTab = { id: 1, title: "Bilibili video", url: reloadedPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: reloadedSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => {
      if (id === savedKey) {
        return {
          id,
          pageUrl: savedPage,
          sourceUrl: savedSource,
          transcript: {
            source: [],
            translated: [{ start: 1, end: 2, text: "reloaded cached cue" }]
          }
        };
      }
      return null;
    };
    getAllSubtitleCacheEntries = async () => [];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliReloadAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliReloadFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliReloadAttached),
        follow: Boolean(globalThis.bilibiliReloadFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliReloadAttached;
      delete globalThis.bilibiliReloadFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliReloadCacheAutoLoadState)), {
  loadedText: "reloaded cached cue",
  cachedSubtitleLoadedKey: bilibiliReloadCacheAutoLoadState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});
assert.match(bilibiliReloadCacheAutoLoadState.cachedSubtitleLoadedKey, /^subtitle:v/);

const staleAsyncCacheLoadAfterNavigationIgnoredState = await vm.runInContext(`
  (async () => {
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const originalGetSubtitleCacheEntryForCurrentPage = getSubtitleCacheEntryForCurrentPage;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    activeTab = { id: 1, title: "old", url: "https://www.bilibili.com/video/BV1XadwBeEzP" };
    currentJobId = "";
    currentJob = null;
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    subtitleLoadRequestId = 100;
    elements.subtitleList.textContent = "";
    pruneSubtitleCache = async () => {};
    getSubtitleCacheEntryForCurrentPage = async () => {
      activeTab = { id: 1, title: "new", url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
      clearSubtitles("新页面字幕生成后会显示在这里。");
      return {
        key: "subtitle:old",
        entry: {
          id: "subtitle:old",
          pageUrl: "https://www.bilibili.com/video/BV1XadwBeEzP",
          sourceUrl: "https://upos.example.test/old.m4s",
          transcript: {
            source: [],
            translated: [{ start: 0, end: 2, text: "old cached cue" }]
          }
        }
      };
    };
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.staleAsyncCacheAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.staleAsyncCacheFollow = true;
    };
    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        listText: elements.subtitleList.textContent,
        attached: Boolean(globalThis.staleAsyncCacheAttached),
        follow: Boolean(globalThis.staleAsyncCacheFollow)
      };
    } finally {
      pruneSubtitleCache = originalPruneSubtitleCache;
      getSubtitleCacheEntryForCurrentPage = originalGetSubtitleCacheEntryForCurrentPage;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      delete globalThis.staleAsyncCacheAttached;
      delete globalThis.staleAsyncCacheFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(staleAsyncCacheLoadAfterNavigationIgnoredState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  listText: "新页面字幕生成后会显示在这里。",
  attached: false,
  follow: false
});

const bilibiliOldSchemaWrongVideoCacheIgnoredState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17DLP6UEPw";
    const currentSource = "https://upos.example.test/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new";
    const oldSchemaSeed = subtitleCacheSeed(normalizeCacheUrl(currentPage), normalizeMediaCacheUrl(currentSource));
    const wrongOldEntry = {
      id: "subtitle:v3:" + await sha256Text(oldSchemaSeed),
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "郝啦B梦_哔哩哔哩_bilibili",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: {
        source: [{ start: 0, end: 3, text: "哦我的天,今天海绵强强有" }],
        translated: [{ start: 0, end: 3, text: "我的天哪 海绵强强今天" }],
        metadata: { pageUrl: "https://www.bilibili.com/video/BV1XadwBeEzP" }
      }
    };
    activeTab = { id: 1, title: "郝啦B梦_哔哩哔哩_bilibili", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "郝啦B梦_哔哩哔哩_bilibili", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [wrongOldEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliOldWrongAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliOldWrongFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliOldWrongAttached),
        follow: Boolean(globalThis.bilibiliOldWrongFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliOldWrongAttached;
      delete globalThis.bilibiliOldWrongFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliOldSchemaWrongVideoCacheIgnoredState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false,
  follow: false
});

const bilibiliOldSchemaExactCacheLoadsState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17DLP6UEPw";
    const currentSource = "https://upos.example.test/upgcxcode/80/97/1455429780/1455429780-1-30232.m4s?deadline=1770001234&upsig=new";
    const oldSchemaSeed = subtitleCacheSeed(normalizeCacheUrl(currentPage), normalizeMediaCacheUrl(currentSource));
    const oldEntry = {
      id: "subtitle:v3:" + await sha256Text(oldSchemaSeed),
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "郝啦B梦_哔哩哔哩_bilibili",
      updatedAt: "2026-05-24T12:05:00.000Z",
      transcript: {
        source: [{ start: 0, end: 3, text: "郝啦B梦原文" }],
        translated: [{ start: 0, end: 3, text: "郝啦B梦译文" }],
        metadata: { pageUrl: currentPage, sourceUrl: currentSource }
      }
    };
    activeTab = { id: 1, title: "郝啦B梦_哔哩哔哩_bilibili", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "郝啦B梦_哔哩哔哩_bilibili", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === oldEntry.id ? oldEntry : null;
    getAllSubtitleCacheEntries = async () => [oldEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliOldExactAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliOldExactFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliOldExactAttached),
        follow: Boolean(globalThis.bilibiliOldExactFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliOldExactAttached;
      delete globalThis.bilibiliOldExactFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliOldSchemaExactCacheLoadsState)), {
  loadedText: "郝啦B梦译文",
  cachedSubtitleLoadedKey: bilibiliOldSchemaExactCacheLoadsState.cachedSubtitleLoadedKey,
  attached: true,
  follow: true
});
assert.match(bilibiliOldSchemaExactCacheLoadsState.cachedSubtitleLoadedKey, /^subtitle:v3:/);

const bilibiliCurrentSchemaWrongMetadataCacheIgnoredState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const currentPage = "https://www.bilibili.com/video/BV17DLP6UEPw";
    const currentSource = "https://upos.example.test/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const wrongEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "郝啦B梦_哔哩哔哩_bilibili",
      updatedAt: "2026-05-24T12:30:00.000Z",
      transcript: {
        source: [{ start: 0, end: 3, text: "哦我的天,今天海绵强强有" }],
        translated: [{ start: 0, end: 3, text: "我的天哪 海绵强强今天" }],
        metadata: { pageUrl: "https://www.bilibili.com/video/BV1XadwBeEzP" }
      }
    };
    activeTab = { id: 1, title: "郝啦B梦_哔哩哔哩_bilibili", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "郝啦B梦_哔哩哔哩_bilibili", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? wrongEntry : null;
    getAllSubtitleCacheEntries = async () => [wrongEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliCurrentWrongAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliCurrentWrongFollow = true;
    };
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.bilibiliCurrentWrongDetached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliCurrentWrongAttached),
        follow: Boolean(globalThis.bilibiliCurrentWrongFollow),
        detached: Boolean(globalThis.bilibiliCurrentWrongDetached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      delete globalThis.bilibiliCurrentWrongAttached;
      delete globalThis.bilibiliCurrentWrongFollow;
      delete globalThis.bilibiliCurrentWrongDetached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliCurrentSchemaWrongMetadataCacheIgnoredState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false,
  follow: false,
  detached: true
});

const bilibiliReloadCacheSourceDriftState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const reloadedPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id&vd_source=new";
    const savedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1770000000&upsig=old";
    const reloadedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const savedKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const directReloadKey = await buildSubtitleCacheKey({ pageUrl: reloadedPage, sourceUrl: reloadedSource });
    activeTab = { id: 1, title: "Bilibili video", url: reloadedPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: reloadedSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    const savedEntry = {
      id: savedKey,
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Bilibili video",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "same page source drift cue" }]
      }
    };
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [savedEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliSourceDriftAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliSourceDriftFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliSourceDriftAttached),
        follow: Boolean(globalThis.bilibiliSourceDriftFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliSourceDriftAttached;
      delete globalThis.bilibiliSourceDriftFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliReloadCacheSourceDriftState)), {
  loadedText: "",
  cachedSubtitleLoadedKey: "",
  attached: false,
  follow: false
});

const bilibiliBadExactCacheFallsBackState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?trackid=current";
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id";
    const currentSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const savedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1770000000&upsig=old";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const fallbackKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const badExactEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "Bad exact cache",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: { source: [], translated: [] }
    };
    const fallbackEntry = {
      id: fallbackKey,
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Fallback cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "fallback after bad exact cache" }]
      }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? badExactEntry : null;
    getAllSubtitleCacheEntries = async () => [badExactEntry, fallbackEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliBadExactFallbackAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliBadExactFallbackFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        expectedKey: fallbackEntry.id,
        attached: Boolean(globalThis.bilibiliBadExactFallbackAttached),
        follow: Boolean(globalThis.bilibiliBadExactFallbackFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliBadExactFallbackAttached;
      delete globalThis.bilibiliBadExactFallbackFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliBadExactCacheFallsBackState)), {
  loadedText: "",
  cachedSubtitleLoadedKey: "",
  expectedKey: bilibiliBadExactCacheFallsBackState.expectedKey,
  attached: false,
  follow: false
});

const bilibiliSourceOnlyExactCacheFallsBackState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?trackid=current";
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id";
    const currentSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/80/97/1455429780/1455429780-1-30280.m4s?deadline=1770001234&upsig=new";
    const savedSource = "https://cn-xz-ct-01-01.bilivideo.com/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1770000000&upsig=old";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const fallbackKey = await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource });
    const sourceOnlyExactEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "Source-only exact cache",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: {
        source: [{ start: 1, end: 2, text: "source-only preview cache" }],
        translated: []
      }
    };
    const fallbackEntry = {
      id: fallbackKey,
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Translated fallback cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "translated fallback after source-only cache" }]
      }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    subtitleDisplayMode = "translated";
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? sourceOnlyExactEntry : null;
    getAllSubtitleCacheEntries = async () => [sourceOnlyExactEntry, fallbackEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliSourceOnlyExactFallbackAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliSourceOnlyExactFallbackFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        expectedKey: sourceOnlyExactEntry.id,
        attached: Boolean(globalThis.bilibiliSourceOnlyExactFallbackAttached),
        follow: Boolean(globalThis.bilibiliSourceOnlyExactFallbackFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliSourceOnlyExactFallbackAttached;
      delete globalThis.bilibiliSourceOnlyExactFallbackFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliSourceOnlyExactCacheFallsBackState)), {
  loadedText: "source-only preview cache",
  cachedSubtitleLoadedKey: bilibiliSourceOnlyExactCacheFallsBackState.expectedKey,
  expectedKey: bilibiliSourceOnlyExactCacheFallsBackState.expectedKey,
  attached: true,
  follow: true
});

const ordinaryPageBadExactDoesNotPageFallbackState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const currentPage = "https://example.test/watch/1";
    const currentSource = "https://cdn.example.test/current.mp4?token=current";
    const fallbackSource = "https://cdn.example.test/other.mp4?token=other";
    const exactKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const fallbackKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: fallbackSource });
    const badExactEntry = {
      id: exactKey,
      pageUrl: currentPage,
      sourceUrl: currentSource,
      title: "Bad exact ordinary cache",
      updatedAt: "2026-05-24T12:00:00.000Z",
      transcript: { source: [], translated: [] }
    };
    const otherMediaEntry = {
      id: fallbackKey,
      pageUrl: currentPage,
      sourceUrl: fallbackSource,
      title: "Other media cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "must not cross-media fallback" }]
      }
    };
    activeTab = { id: 1, title: "Ordinary page", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "video", role: "video", url: currentSource, title: "Ordinary page", source: "performance-entry" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async id => id === exactKey ? badExactEntry : null;
    getAllSubtitleCacheEntries = async () => [badExactEntry, otherMediaEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.ordinaryBadExactAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.ordinaryBadExactFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.ordinaryBadExactAttached),
        follow: Boolean(globalThis.ordinaryBadExactFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.ordinaryBadExactAttached;
      delete globalThis.ordinaryBadExactFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(ordinaryPageBadExactDoesNotPageFallbackState)), {
  loadedText: "",
  cachedSubtitleLoadedKey: "",
  attached: false,
  follow: false
});

const bilibiliSourceDriftPrefersNewestCacheState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const page = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id";
    const olderSource = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const newerSource = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30232.m4s?deadline=2";
    const currentSource = "https://upos.example.test/upgcxcode/55/66/55556666/55556666-1-30280.m4s?deadline=3";
    const olderEntry = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: olderSource }),
      pageUrl: page,
      sourceUrl: olderSource,
      title: "Bilibili older cache",
      updatedAt: "2026-05-23T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "older same page cue" }]
      }
    };
    const newerEntry = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: newerSource }),
      pageUrl: page,
      sourceUrl: newerSource,
      title: "Bilibili newer cache",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "newer same page cue" }]
      }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [olderEntry, newerEntry];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliNewestFallbackAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.bilibiliNewestFallbackFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        expectedKey: newerEntry.id,
        attached: Boolean(globalThis.bilibiliNewestFallbackAttached),
        follow: Boolean(globalThis.bilibiliNewestFallbackFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliNewestFallbackAttached;
      delete globalThis.bilibiliNewestFallbackFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliSourceDriftPrefersNewestCacheState)), {
  loadedText: "",
  cachedSubtitleLoadedKey: "",
  expectedKey: bilibiliSourceDriftPrefersNewestCacheState.expectedKey,
  attached: false,
  follow: false
});

const bilibiliSourceDriftClearCacheState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalDeleteSubtitleCacheEntries = deleteSubtitleCacheEntries;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    const page = "https://www.bilibili.com/video/BV17oSmBWEAK?trackid=old-router-id&vd_source=old";
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK/?spm_id_from=333.788&trackid=new-router-id";
    const oldSourceA = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const oldSourceB = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30232.m4s?deadline=2";
    const currentSource = "https://upos.example.test/upgcxcode/55/66/55556666/55556666-1-30280.m4s?deadline=3";
    const currentKey = await buildSubtitleCacheKey({ pageUrl: currentPage, sourceUrl: currentSource });
    const entryA = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: oldSourceA }),
      pageUrl: page,
      sourceUrl: oldSourceA,
      title: "Bilibili source drift cache A",
      updatedAt: "2026-05-23T00:00:00.000Z",
      transcript: { source: [], translated: [{ start: 1, end: 2, text: "cache A" }] }
    };
    const entryB = {
      id: await buildSubtitleCacheKey({ pageUrl: page, sourceUrl: oldSourceB }),
      pageUrl: page,
      sourceUrl: oldSourceB,
      title: "Bilibili source drift cache B",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: { source: [], translated: [{ start: 1, end: 2, text: "cache B" }] }
    };
    activeTab = { id: 1, title: "Bilibili video", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili video", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [{ start: 1, end: 2, time: "00:00:01.000 --> 00:00:02.000", text: "cache B" }];
    currentTranscript = entryB.transcript;
    currentSubtitleCacheEntry = entryB;
    cachedSubtitleLoadedKey = entryB.id;
    renderedSubtitleJobId = "cache-" + entryB.id;
    getSubtitleCacheEntry = async id => {
      if (id === entryA.id) return entryA;
      if (id === entryB.id) return entryB;
      return null;
    };
    getAllSubtitleCacheEntries = async () => [entryA, entryB];
    let deletedIds = [];
    deleteSubtitleCacheEntries = async ids => {
      deletedIds = [...ids].sort();
      return ids.filter(id => [entryA.id, entryB.id].includes(id)).length;
    };
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.bilibiliSourceDriftDetached = true;
    };

    try {
      await clearCurrentSubtitleCache();
      return {
        deletedIds,
        expectedDeletedIds: [currentKey, entryA.id, entryB.id].sort(),
        detached: Boolean(globalThis.bilibiliSourceDriftDetached),
        cuesLength: subtitleCues.length,
        currentSubtitleCacheEntry,
        cachedSubtitleLoadedKey
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      deleteSubtitleCacheEntries = originalDeleteSubtitleCacheEntries;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      delete globalThis.bilibiliSourceDriftDetached;
    }
  })()
`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(bilibiliSourceDriftClearCacheState.deletedIds)),
  JSON.parse(JSON.stringify(bilibiliSourceDriftClearCacheState.expectedDeletedIds))
);
assert.equal(bilibiliSourceDriftClearCacheState.detached, true);
assert.equal(bilibiliSourceDriftClearCacheState.cuesLength, 0);
assert.equal(bilibiliSourceDriftClearCacheState.currentSubtitleCacheEntry, null);
assert.equal(bilibiliSourceDriftClearCacheState.cachedSubtitleLoadedKey, "");

const bilibiliPartedVideoCacheIsolationState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/video/BV17oSmBWEAK?p=1";
    const currentPage = "https://www.bilibili.com/video/BV17oSmBWEAK?p=2";
    const savedSource = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const currentSource = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30280.m4s?deadline=2";
    activeTab = { id: 1, title: "Bilibili part 2", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili part 2", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [{
      id: await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource }),
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Bilibili part 1",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "part 1 cue" }]
      }
    }];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliPartedVideoAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliPartedVideoAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliPartedVideoAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliPartedVideoCacheIsolationState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false
});

const bilibiliBangumiPageCacheFallbackMissState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://www.bilibili.com/bangumi/play/ep123456?spm_id_from=333.337.0.0";
    const currentPage = "https://www.bilibili.com/bangumi/play/ep123456?from_spmid=666.25";
    const savedSource = "https://upos.example.test/upgcxcode/11/22/11112222/11112222-1-30232.m4s?deadline=1";
    const currentSource = "https://upos.example.test/upgcxcode/33/44/33334444/33334444-1-30280.m4s?deadline=2";
    activeTab = { id: 1, title: "Bilibili bangumi", url: currentPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Bilibili bangumi", source: "bilibili-playurl" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [{
      id: await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource }),
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Bilibili bangumi old media",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "bangumi wrong media cue" }]
      }
    }];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.bilibiliBangumiFallbackAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.bilibiliBangumiFallbackAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.bilibiliBangumiFallbackAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(bilibiliBangumiPageCacheFallbackMissState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false
});

const genericPageSourceDriftCacheMissState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalGetAllSubtitleCacheEntries = getAllSubtitleCacheEntries;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const savedPage = "https://example.test/watch/1";
    const savedSource = "https://media.example.test/audio-a.mp4?token=old";
    const currentSource = "https://media.example.test/audio-b.mp4?token=new";
    activeTab = { id: 1, title: "Generic video", url: savedPage };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: currentSource, title: "Generic video" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    getSubtitleCacheEntry = async () => null;
    getAllSubtitleCacheEntries = async () => [{
      id: await buildSubtitleCacheKey({ pageUrl: savedPage, sourceUrl: savedSource }),
      pageUrl: savedPage,
      sourceUrl: savedSource,
      title: "Generic video",
      updatedAt: "2026-05-24T00:00:00.000Z",
      transcript: {
        source: [],
        translated: [{ start: 1, end: 2, text: "wrong source cue" }]
      }
    }];
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.genericSourceDriftAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.genericSourceDriftAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      getAllSubtitleCacheEntries = originalGetAllSubtitleCacheEntries;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.genericSourceDriftAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(genericPageSourceDriftCacheMissState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false
});

const legacySubtitleCacheMatchState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalStartSubtitleFollow = startSubtitleFollow;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const lookups = [];
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1?utm_source=old" };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/audio-a.mp4?token=current" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    const legacyKeys = await buildLegacySubtitleCacheKeys({
      pageUrl: activeTab.url,
      sourceUrl: "https://media.example.test/audio-a.mp4?token=old"
    });
    getSubtitleCacheEntry = async id => {
      lookups.push(id);
      if (id === legacyKeys[0]) {
        return {
          id,
          pageUrl: activeTab.url,
          sourceUrl: "https://media.example.test/audio-a.mp4?token=old",
          transcript: {
            source: [],
            translated: [{ start: 1, end: 2, text: "legacy matched cue" }]
          }
        };
      }
      return null;
    };
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.legacyMatchedAttached = true;
    };
    startSubtitleFollow = () => {
      globalThis.legacyMatchedFollow = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        loadedText: subtitleCues[0]?.text || "",
        cachedSubtitleLoadedKey,
        lookedUpLegacyPageKey: lookups.includes(legacyKeys[0]),
        attached: Boolean(globalThis.legacyMatchedAttached),
        follow: Boolean(globalThis.legacyMatchedFollow)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      startSubtitleFollow = originalStartSubtitleFollow;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.legacyMatchedAttached;
      delete globalThis.legacyMatchedFollow;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(legacySubtitleCacheMatchState)), {
  loadedText: "legacy matched cue",
  cachedSubtitleLoadedKey: legacySubtitleCacheMatchState.cachedSubtitleLoadedKey,
  lookedUpLegacyPageKey: true,
  attached: true,
  follow: true
});
assert.match(legacySubtitleCacheMatchState.cachedSubtitleLoadedKey, /^subtitle:v3:/);

const legacySubtitleCacheMismatchState = await vm.runInContext(`
  (async () => {
    const originalGetSubtitleCacheEntry = getSubtitleCacheEntry;
    const originalEnsureCurrentSubtitlesAttachedToPage = ensureCurrentSubtitlesAttachedToPage;
    const originalPruneSubtitleCache = pruneSubtitleCache;
    activeTab = { id: 1, title: "Video", url: "https://example.test/watch/1?utm_source=old" };
    currentJobId = "";
    currentJob = null;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/audio-a.mp4?token=current" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    cacheAutoLoadInFlight = false;
    const legacyKeys = await buildLegacySubtitleCacheKeys({
      pageUrl: activeTab.url,
      sourceUrl: "https://media.example.test/audio-b.mp4?token=old"
    });
    getSubtitleCacheEntry = async id => {
      if (id === legacyKeys[0]) {
        return {
          id,
          pageUrl: activeTab.url,
          sourceUrl: "https://media.example.test/audio-b.mp4?token=old",
          transcript: {
            source: [],
            translated: [{ start: 1, end: 2, text: "wrong media cue" }]
          }
        };
      }
      return null;
    };
    ensureCurrentSubtitlesAttachedToPage = async () => {
      globalThis.legacyMismatchAttached = true;
    };
    pruneSubtitleCache = async () => {};

    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey,
        attached: Boolean(globalThis.legacyMismatchAttached)
      };
    } finally {
      getSubtitleCacheEntry = originalGetSubtitleCacheEntry;
      ensureCurrentSubtitlesAttachedToPage = originalEnsureCurrentSubtitlesAttachedToPage;
      pruneSubtitleCache = originalPruneSubtitleCache;
      delete globalThis.legacyMismatchAttached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(legacySubtitleCacheMismatchState)), {
  cuesLength: 0,
  cachedSubtitleLoadedKey: "",
  attached: false
});

const xaiProfileUiState = await vm.runInContext(`
  (() => {
    asrProfiles = [
      {
        id: "xai_asr",
        name: "xAI ASR",
        providerType: "xai",
        baseUrl: "https://api.x.ai/v1",
        model: "",
        apiKey: ""
      }
    ];
    elements.asrProfileId.value = "xai_asr";
    renderSelectedProfile("asr");
    return {
      disabled: elements.asrModel.disabled,
      placeholder: elements.asrModel.placeholder,
      hint: elements.asrApiKeyHint.textContent,
      vadFilter: elements.asrVadFilter.value
    };
  })()
`, context);

assert.equal(xaiProfileUiState.disabled, true);
assert.match(xaiProfileUiState.placeholder, /不会发送|可选/);
assert.match(xaiProfileUiState.hint, /不会发送 model 字段/);
assert.equal(xaiProfileUiState.vadFilter, "auto");

const syntheticHighlightState = await vm.runInContext(`
  (async () => {
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = 1;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 0.5, paused: true, synthetic: true }
    });
    await syncSubtitleHighlight();
    return {
      activeCueIndex
    };
  })()
`, context);

assert.equal(syntheticHighlightState.activeCueIndex, 1);

const pausedHighlightState = await vm.runInContext(`
  (async () => {
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = -1;
    chrome.runtime.sendMessage = async () => ({
      ok: true,
      state: { currentTime: 0.5, paused: true, synthetic: false }
    });
    await syncSubtitleHighlight();
    return { activeCueIndex };
  })()
`, context);

assert.equal(pausedHighlightState.activeCueIndex, 0);

const boundarySeekState = await vm.runInContext(`
  (async () => {
    const first = document.createElement("div");
    first.className = "cue";
    first.dataset.index = "0";
    const second = document.createElement("div");
    second.className = "cue";
    second.dataset.index = "1";
    elements.subtitleList.replaceChildren(first, second);
    subtitleCues = [
      { start: 48.760, end: 52.019, time: "00:00:48.760 --> 00:00:52.019", text: "15斤30块" },
      { start: 52.019, end: 57.000, time: "00:00:52.019 --> 00:00:57.000", text: "这是什么啊" }
    ];
    activeTab = { id: 1 };
    activeCueIndex = -1;
    chrome.runtime.sendMessage = async message => (
      message.type === "FUGUANG_SEEK_MEDIA" ? { ok: true } : { ok: false, error: "unexpected" }
    );

    const boundaryIndex = findCueIndexAt(52.019);
    await seekToCue(52.019, 1);

    return {
      boundaryIndex,
      activeCueIndex,
      firstActive: first.classList.contains("active"),
      secondActive: second.classList.contains("active")
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(boundarySeekState)), {
  boundaryIndex: 1,
  activeCueIndex: 1,
  firstActive: false,
  secondActive: true
});

const overlappingCueState = await vm.runInContext(`
  (() => {
    subtitleCues = [
      { start: 0, end: 120, time: "00:00:00.000 --> 00:02:00.000", text: "stale long cue" },
      { start: 76, end: 80, time: "00:01:16.000 --> 00:01:20.000", text: "current cue" }
    ];
    return { activeIndex: findCueIndexAt(77) };
  })()
`, context);

assert.equal(overlappingCueState.activeIndex, 1);

const partialTranscriptMergeState = await vm.runInContext(`
  (() => {
    const cues = cuesFromTranscript({
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
      ]
    });
    return cues.map(cue => ({
      text: cue.text,
      sourceText: cue.sourceText,
      sourceOnly: cue.sourceOnly,
      start: cue.start,
      end: cue.end
    }));
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(partialTranscriptMergeState)), [
  { text: "source first", sourceText: "source first", sourceOnly: true, start: 0, end: 2 },
  { text: "translated second", sourceText: "source second", sourceOnly: false, start: 3, end: 5 }
]);

const mixedIdentityTranscriptMergeState = await vm.runInContext(`
  (() => {
    const cues = cuesFromTranscript({
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
      ],
      translated: [
        { start: 0, end: 2, text: "translated first without identity" },
        { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
      ]
    });
    return cues.map(cue => ({
      text: cue.text,
      sourceText: cue.sourceText,
      sourceOnly: cue.sourceOnly,
      start: cue.start,
      end: cue.end
    }));
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(mixedIdentityTranscriptMergeState)), [
  { text: "translated first without identity", sourceText: "source first", sourceOnly: false, start: 0, end: 2 },
  { text: "translated second", sourceText: "source second", sourceOnly: false, start: 3, end: 5 }
]);

const partialTranscriptAttachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    currentJob = { id: "partial", status: "completed", stage: "completed_with_warnings" };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 0, segmentIndex: 1 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 0, segmentIndex: 1 }
      ]
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return { attachedVtt: attachMessage?.vtt || "" };
  })()
`, context);

assert.match(partialTranscriptAttachState.attachedVtt, /source first/);
assert.match(partialTranscriptAttachState.attachedVtt, /translated second/);

const sourceOnlyBilingualCueState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "bilingual";
    const cues = cuesFromTranscript({
      source: [
        { start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    });
    return {
      cues: cues.map(cue => ({ text: cue.text, sourceText: cue.sourceText, sourceOnly: cue.sourceOnly })),
      vtt: cuesToVtt(cues),
      srt: cuesToSrt(cues)
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyBilingualCueState.cues)), [
  { text: "source only", sourceText: "source only", sourceOnly: true }
]);
assert.equal((sourceOnlyBilingualCueState.vtt.match(/source only/g) || []).length, 1);
assert.equal((sourceOnlyBilingualCueState.srt.match(/source only/g) || []).length, 1);

const sourceOnlyCompletedTranslatedAttachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    currentJob = { id: "source-only-completed", status: "completed", stage: "completed_with_warnings" };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return {
      types: messages.map(message => message.type),
      attachedVtt: attachMessage?.vtt || ""
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyCompletedTranslatedAttachState.types)), ["FUGUANG_ATTACH_VTT_TEXT"]);
assert.match(sourceOnlyCompletedTranslatedAttachState.attachedVtt, /source only/);

const sourceOnlyCompletedTranslatedListState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "translated";
    currentJob = { id: "source-only-completed-list", status: "completed", stage: "completed_with_warnings" };
    renderedSubtitleJobId = "source-only-completed-list";
    subtitleCues = [
      {
        start: 0,
        end: 2,
        time: "00:00:00.000 --> 00:00:02.000",
        text: "source only",
        sourceText: "source only",
        sourceOnly: true
      },
      {
        start: 3,
        end: 5,
        time: "00:00:03.000 --> 00:00:05.000",
        text: "translated second",
        sourceText: "source second",
        sourceOnly: false
      }
    ];
    renderSubtitleCueList();
    return {
      listText: elements.subtitleList.textContent,
      children: elements.subtitleList.children.map(item => item.children[1].children.map(line => line.textContent))
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyCompletedTranslatedListState.children)), [
  ["source only"],
  ["translated second"]
]);

const sourceOnlyRunningTranslatedPreviewState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    currentJob = { id: "source-only-running", status: "running", stage: "asr" };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source only while running", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return {
      types: messages.map(message => message.type),
      attachedVtt: attachMessage?.vtt || ""
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyRunningTranslatedPreviewState.types)), ["FUGUANG_ATTACH_VTT_TEXT"]);
assert.match(sourceOnlyRunningTranslatedPreviewState.attachedVtt, /source only while running/);

const sourceOnlyRunningTranslatedListState = await vm.runInContext(`
  (() => {
    subtitleDisplayMode = "translated";
    currentJob = { id: "source-only-running-list", status: "running", stage: "asr" };
    renderedSubtitleJobId = "source-only-running-list";
    subtitleCues = [
      {
        start: 0,
        end: 2,
        time: "00:00:00.000 --> 00:00:02.000",
        text: "source only while running",
        sourceText: "source only while running",
        sourceOnly: true
      }
    ];
    renderSubtitleCueList();
    return elements.subtitleList.children.map(item => item.children[1].children.map(line => line.textContent));
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyRunningTranslatedListState)), [
  ["source only while running"]
]);

const sourceOnlyTranslatedExportState = await vm.runInContext(`
  (async () => {
    const downloads = [];
    subtitleDisplayMode = "translated";
    subtitleCues = [
      {
        start: 0,
        end: 2,
        time: "00:00:00.000 --> 00:00:02.000",
        text: "source only while running",
        sourceText: "source only while running",
        sourceOnly: true
      }
    ];
    downloadBlob = async (blob, filename) => {
      downloads.push({ text: await blob.text(), filename });
    };
    await exportCurrentSubtitle();
    return {
      downloads: downloads.length,
      message: elements.message.textContent,
      text: downloads[0]?.text || ""
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(sourceOnlyTranslatedExportState)), {
  downloads: 1,
  message: "SRT 字幕已导出。",
  text: "1\n00:00:00,000 --> 00:00:02,000\nsource only while running\n"
});

const sourceOnlyBilingualAttachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source only", chunkIndex: 0, segmentIndex: 0 }
      ],
      translated: []
    };
    subtitleCues = cuesFromTranscript(currentTranscript);
    renderedSubtitleJobId = "cache-source-only";
    renderedSubtitleSignature = "source-only:1";
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    chrome.runtime.sendMessage = async message => {
      messages.push(message);
      return { ok: true };
    };
    await toggleSubtitleMode();
    const attachMessage = messages.find(message => message.type === "FUGUANG_ATTACH_VTT_TEXT");
    return {
      subtitleDisplayMode,
      attachedVtt: attachMessage?.vtt || ""
    };
  })()
`, context);

assert.equal(sourceOnlyBilingualAttachState.subtitleDisplayMode, "bilingual");
assert.equal((sourceOnlyBilingualAttachState.attachedVtt.match(/source only/g) || []).length, 1);

const sourcePreviewNoticeText = await vm.runInContext(`
  (() => {
    currentSubtitleCacheEntry = null;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    subtitleCues = [
      { start: 0, end: 2, text: "source first", sourceText: "source first" }
    ];
    currentTranscript = {
      source: [{ start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 }],
      translated: []
    };
    return subtitleNoticeText();
  })()
`, context);

assert.match(sourcePreviewNoticeText, /ASR 原文/);
assert.match(sourcePreviewNoticeText, /补位/);
assert.match(sourcePreviewNoticeText, /自动替换/);
assert.match(sourcePreviewNoticeText, /列表.*浮层.*导出/);

const partialSourcePreviewNoticeText = await vm.runInContext(`
  (() => {
    currentSubtitleCacheEntry = null;
    subtitleDisplayMode = "translated";
    subtitleCueSource = "transcript";
    subtitleCues = [
      { start: 0, end: 2, text: "source first", sourceText: "source first", sourceOnly: true },
      { start: 3, end: 5, text: "translated second", sourceText: "source second", sourceOnly: false }
    ];
    currentTranscript = {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
      ]
    };
    return subtitleNoticeText();
  })()
`, context);

assert.match(partialSourcePreviewNoticeText, /缺译句/);
assert.match(partialSourcePreviewNoticeText, /ASR 原文补位/);
assert.match(partialSourcePreviewNoticeText, /列表.*浮层.*导出/);

const attachRefreshState = await vm.runInContext(`
  (async () => {
    let attachCount = 0;
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    renderedSubtitleSignature = "job-1:2";
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    chrome.runtime.sendMessage = async message => {
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        attachCount += 1;
      }
      return { ok: true };
    };
    await attachCurrentSubtitlesToPage();
    await attachCurrentSubtitlesToPage();
    return { attachCount };
  })()
`, context);

assert.equal(attachRefreshState.attachCount, 2);

const staleAttachIgnoredState = await vm.runInContext(`
  (async () => {
    const messages = [];
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "job-old";
    subtitleOverlayEnabled = true;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "old cue" }
    ];
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    chrome.runtime.sendMessage = async message => {
      messages.push({ type: message.type, tabId: message.tabId });
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        activeTab = { id: 2, title: "New video", url: "https://example.test/watch/new" };
        currentJobId = "job-new";
      }
      return { ok: true };
    };
    try {
      await attachCurrentSubtitlesToPage();
      return {
        messages,
        attachedSubtitleTabId,
        attachedSubtitleSignature
      };
    } finally {
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.equal(staleAttachIgnoredState.attachedSubtitleTabId, 0);
assert.equal(staleAttachIgnoredState.attachedSubtitleSignature, "");
assert.deepEqual(
  JSON.parse(JSON.stringify(staleAttachIgnoredState.messages)),
  [
    { type: "FUGUANG_ATTACH_VTT_TEXT", tabId: 1 },
    { type: "FUGUANG_DETACH_PRELOAD_VTT", tabId: 1 }
  ]
);

const staleRetryResultIgnoredState = await vm.runInContext(`
  (async () => {
    const sent = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    let queryCount = 0;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "job-old";
    currentJob = {
      id: "job-old",
      status: "failed",
      stage: "failed",
      translation: { chunksFailed: 1, chunkStatuses: [] },
      progress: { chunksFailed: 1 }
    };
    retryRequestInFlight = false;
    chrome.tabs.query = async () => {
      queryCount += 1;
      return queryCount === 1
        ? [{ id: 1, title: "Old video", url: "https://example.test/watch/old" }]
        : [{ id: 2, title: "New video", url: "https://example.test/watch/new" }];
    };
    chrome.runtime.sendMessage = async message => {
      sent.push({ type: message.type, tabId: message.tabId });
      return {
        ok: true,
        message: "旧任务重试返回",
        job: {
          id: "job-stale",
          status: "running",
          stage: "translation",
          translation: { chunkStatuses: [] }
        }
      };
    };
    try {
      await retryPreloadFromSidePanel();
      return {
        sent,
        activeTabId: activeTab.id,
        currentJobId,
        message: elements.message.textContent
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(staleRetryResultIgnoredState.sent)), [
  { type: "FUGUANG_RETRY_PRELOAD", tabId: 1 },
  { type: "FUGUANG_DETACH_PRELOAD_VTT", tabId: 1 }
]);
assert.equal(staleRetryResultIgnoredState.activeTabId, 2);
assert.notEqual(staleRetryResultIgnoredState.currentJobId, "job-stale");
assert.match(staleRetryResultIgnoredState.message, /标签页.*变化|忽略/);

const cachedSubtitleOverlayRecoveryState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1, url: "https://example.test/watch" };
    currentJobId = "";
    cacheAutoLoadInFlight = false;
    subtitleOverlayEnabled = true;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "cached cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === "FUGUANG_GET_VIDEO_STATE") {
        return {
          ok: true,
          state: {
            currentTime: 0,
            subtitleSignature: "",
            subtitleCueCount: 0
          }
        };
      }
      return { ok: true };
    };
    await tryLoadCachedSubtitleForCurrentPage();
    stopSubtitleFollow();
    return { messages };
  })()
`, context);

assert.equal(cachedSubtitleOverlayRecoveryState.messages.includes("FUGUANG_GET_VIDEO_STATE"), true);
assert.equal(cachedSubtitleOverlayRecoveryState.messages.at(-1), "FUGUANG_ATTACH_VTT_TEXT");

const cachedSubtitleAlreadyAttachedState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1, url: "https://example.test/watch" };
    currentJobId = "";
    cacheAutoLoadInFlight = false;
    subtitleOverlayEnabled = true;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "cached cue" }
    ];
    const vtt = cuesToVtt(subtitleCues);
    const pageSignature = (() => {
      let hash = 0;
      for (let index = 0; index < vtt.length; index += 1) {
        hash = ((hash << 5) - hash + vtt.charCodeAt(index)) | 0;
      }
      return "manual:" + vtt.length + ":" + Math.abs(hash);
    })();
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, vtt);
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === "FUGUANG_GET_VIDEO_STATE") {
        return {
          ok: true,
          state: {
            currentTime: 0,
            subtitleSignature: pageSignature,
            subtitleCueCount: 1
          }
        };
      }
      return { ok: true };
    };
    await tryLoadCachedSubtitleForCurrentPage();
    stopSubtitleFollow();
    return { messages };
  })()
`, context);

assert.equal(cachedSubtitleAlreadyAttachedState.messages.includes("FUGUANG_GET_VIDEO_STATE"), true);
assert.equal(cachedSubtitleAlreadyAttachedState.messages.includes("FUGUANG_ATTACH_VTT_TEXT"), false);

const noCacheDetachesStaleOverlayState = await vm.runInContext(`
  (async () => {
    const originalPruneSubtitleCache = pruneSubtitleCache;
    const originalGetSubtitleCacheEntryForCurrentPage = getSubtitleCacheEntryForCurrentPage;
    const originalDetachCurrentSubtitlesFromPage = detachCurrentSubtitlesFromPage;
    activeTab = { id: 1, url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
    currentJobId = "";
    cacheAutoLoadInFlight = false;
    subtitleCues = [];
    currentTranscript = null;
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    pruneSubtitleCache = async () => {};
    getSubtitleCacheEntryForCurrentPage = async () => ({ key: "", entry: null });
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.noCacheStaleOverlayDetached = true;
    };
    try {
      await tryLoadCachedSubtitleForCurrentPage();
      return {
        detached: Boolean(globalThis.noCacheStaleOverlayDetached),
        cuesLength: subtitleCues.length,
        cachedSubtitleLoadedKey
      };
    } finally {
      pruneSubtitleCache = originalPruneSubtitleCache;
      getSubtitleCacheEntryForCurrentPage = originalGetSubtitleCacheEntryForCurrentPage;
      detachCurrentSubtitlesFromPage = originalDetachCurrentSubtitlesFromPage;
      delete globalThis.noCacheStaleOverlayDetached;
    }
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(noCacheDetachesStaleOverlayState)), {
  detached: true,
  cuesLength: 0,
  cachedSubtitleLoadedKey: ""
});

const sameTabNavigationDetachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "job-old";
    currentJob = { id: "job-old" };
    candidates = [{ key: "old-candidate" }];
    selectedCandidateKey = "old-candidate";
    selectedCandidatePinned = true;
    renderedCandidateSignature = "old-signature";
    lastActivatedTabKey = "old-tab-key";
    clearedSubtitleJobIds.add("job-old");
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "old cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    const before = {
      activeUrl: activeTab.url,
      cuesLength: subtitleCues.length,
      attachedSubtitleTabId,
      shouldDetach: Boolean(activeTab?.id && subtitleCues.length)
    };
    chrome.tabs.query = async () => [{ id: 1, title: "New video", url: "https://example.test/watch/new" }];
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      return { ok: true };
    };
    try {
      await refreshActiveTab();
      return {
        messages,
        before,
        changed: Boolean(activeTab?.id && activeTab.url === "https://example.test/watch/new"),
        activeUrl: activeTab.url,
        cuesLength: subtitleCues.length,
        attachedSubtitleTabId,
        selectedCandidateKey,
        selectedCandidatePinned,
        clearedSize: clearedSubtitleJobIds.size
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.equal(
  sameTabNavigationDetachState.messages.includes("FUGUANG_DETACH_PRELOAD_VTT"),
  true,
  JSON.stringify(sameTabNavigationDetachState)
);
assert.equal(sameTabNavigationDetachState.activeUrl, "https://example.test/watch/new");
assert.equal(sameTabNavigationDetachState.cuesLength, 0);
assert.equal(sameTabNavigationDetachState.attachedSubtitleTabId, 0);
assert.equal(sameTabNavigationDetachState.selectedCandidateKey, "");
assert.equal(sameTabNavigationDetachState.selectedCandidatePinned, false);
assert.equal(sameTabNavigationDetachState.clearedSize, 0);

const differentTabDetachState = await vm.runInContext(`
  (async () => {
    const messages = [];
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    activeTab = { id: 1, title: "Old tab", url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
    currentJobId = "";
    currentJob = null;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "old tab cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    chrome.tabs.query = async () => [{ id: 2, title: "New tab", url: "https://www.bilibili.com/video/BV1XadwBeEzP" }];
    chrome.runtime.sendMessage = async message => {
      messages.push({ type: message.type, tabId: message.tabId });
      return { ok: true };
    };
    try {
      await refreshActiveTab();
      return {
        messages,
        activeTabId: activeTab.id,
        cuesLength: subtitleCues.length,
        attachedSubtitleTabId
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
    }
  })()
`, context);

assert.deepEqual(
  JSON.parse(JSON.stringify(differentTabDetachState.messages.filter(message => message.type === "FUGUANG_DETACH_PRELOAD_VTT"))),
  [{ type: "FUGUANG_DETACH_PRELOAD_VTT", tabId: 1 }]
);
assert.equal(differentTabDetachState.activeTabId, 2);
assert.equal(differentTabDetachState.cuesLength, 0);
assert.equal(differentTabDetachState.attachedSubtitleTabId, 0);

const staleSubtitleLoadIgnoredState = await vm.runInContext(`
  (async () => {
    const originalLoadSubtitleCues = loadSubtitleCues;
    const originalSendMessage = chrome.runtime.sendMessage;
    let resolveLoad;
    activeTab = { id: 1, title: "Old video", url: "https://www.bilibili.com/video/BV17DLP6UEPw" };
    currentJobId = "job-old";
    subtitleLoadRequestId = 0;
    renderedSubtitleJobId = "";
    renderedSubtitleSignature = "";
    subtitleCues = [];
    loadSubtitleCues = async () => new Promise(resolve => {
      resolveLoad = resolve;
    });
    chrome.runtime.sendMessage = async () => ({ ok: true });
    const pending = renderSubtitles("job-old", {
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        chunksFailed: 0,
        vttPath: "browser-memory",
        contentHash: "old-hash"
      }
    });
    await Promise.resolve();
    activeTab = { id: 1, title: "New video", url: "https://www.bilibili.com/video/BV1XadwBeEzP" };
    currentJobId = "job-new";
    resolveLoad({
      cues: [{ start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "late old cue" }],
      source: "vtt",
      transcript: null
    });
    await pending;
    const state = {
      cuesLength: subtitleCues.length,
      renderedSubtitleJobId,
      renderedSubtitleSignature
    };
    loadSubtitleCues = originalLoadSubtitleCues;
    chrome.runtime.sendMessage = originalSendMessage;
    return state;
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(staleSubtitleLoadIgnoredState)), {
  cuesLength: 0,
  renderedSubtitleJobId: "",
  renderedSubtitleSignature: ""
});

const startPreloadRefreshesCandidatesState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    const messages = [];
    let startedCandidate = null;
    activeTab = { id: 1, title: "Fresh video", url: "https://example.test/watch/fresh" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/old.m4s", title: "Old video" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => [{ id: 1, title: "Fresh video", url: "https://example.test/watch/fresh" }];
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            { kind: "audio", role: "audio", url: "https://media.example.test/fresh.m4s", title: "Fresh video" }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        startedCandidate = message.candidate;
        return {
          ok: true,
          job: {
            id: "job-fresh",
            status: "running",
            stage: "extract",
            extract: {},
            translation: {}
          }
        };
      }
      return { ok: true };
    };
    try {
      await startPreloadFromSidePanel();
      return {
        messages,
        startedUrl: startedCandidate?.url || "",
        selectedCandidateKey,
        candidateCount: candidates.length
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
    }
  })()
`, context);

assert.equal(
  startPreloadRefreshesCandidatesState.startedUrl,
  "https://media.example.test/fresh.m4s",
  JSON.stringify(startPreloadRefreshesCandidatesState)
);
assert.deepEqual(JSON.parse(JSON.stringify(startPreloadRefreshesCandidatesState.messages.slice(0, 3))), [
  "FUGUANG_ACTIVATE_PAGE",
  "FUGUANG_GET_CANDIDATES",
  "FUGUANG_START_PRELOAD_AUTO"
]);
assert.equal(startPreloadRefreshesCandidatesState.candidateCount, 1);
assert.match(startPreloadRefreshesCandidatesState.selectedCandidateKey, /fresh\.m4s$/);

const startPreloadResetsUnpinnedBilibiliSelectionState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    let startedCandidate = null;
    activeTab = { id: 1, title: "Bilibili video", url: "https://www.bilibili.com/video/BV1test" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      {
        kind: "audio",
        role: "audio",
        url: "https://upos.example.test/audio.m4s?bili=1",
        title: "Bilibili video",
        source: "bilibili-playurl"
      },
      {
        kind: "media",
        role: "audio",
        url: "https://mcdn.example.test/audio.m4s?perf=1",
        title: "Bilibili video",
        source: "performance-entry"
      }
    ];
    selectedCandidateKey = candidateKey(candidates[1], 1);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => [{ id: 1, title: "Bilibili video", url: "https://www.bilibili.com/video/BV1test" }];
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            {
              kind: "audio",
              role: "audio",
              url: "https://upos.example.test/audio.m4s?bili=1",
              title: "Bilibili video",
              source: "bilibili-playurl"
            },
            {
              kind: "media",
              role: "audio",
              url: "https://mcdn.example.test/audio.m4s?perf=1",
              title: "Bilibili video",
              source: "performance-entry"
            }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        startedCandidate = message.candidate;
        return {
          ok: true,
          job: {
            id: "job-bilibili",
            status: "running",
            stage: "extract",
            extract: {},
            translation: {}
          }
        };
      }
      return { ok: true };
    };
    try {
      await startPreloadFromSidePanel();
      return {
        startedUrl: startedCandidate?.url || "",
        startedSource: startedCandidate?.source || "",
        selectedCandidateKey,
        selectedCandidatePinned
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
    }
  })()
`, context);

assert.equal(startPreloadResetsUnpinnedBilibiliSelectionState.startedSource, "bilibili-playurl");
assert.match(startPreloadResetsUnpinnedBilibiliSelectionState.startedUrl, /bili=1/);
assert.match(startPreloadResetsUnpinnedBilibiliSelectionState.selectedCandidateKey, /bili=1/);
assert.equal(startPreloadResetsUnpinnedBilibiliSelectionState.selectedCandidatePinned, false);

const startPreloadKeepsFreshUserSelectionState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    let startedCandidate = null;
    activeTab = { id: 1, title: "Current video", url: "https://example.test/watch/current" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/official.m4s", title: "Current video" },
      { kind: "audio", role: "audio", url: "https://media.example.test/user-selected.m4s", title: "Current video" }
    ];
    selectedCandidateKey = candidateKey(candidates[1], 1);
    selectedCandidatePinned = true;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => [{ id: 1, title: "Current video", url: "https://example.test/watch/current" }];
    chrome.runtime.sendMessage = async message => {
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            { kind: "audio", role: "audio", url: "https://media.example.test/official.m4s", title: "Current video" },
            { kind: "audio", role: "audio", url: "https://media.example.test/user-selected.m4s", title: "Current video" }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        startedCandidate = message.candidate;
        return {
          ok: true,
          job: {
            id: "job-user-selected",
            status: "running",
            stage: "extract",
            extract: {},
            translation: {}
          }
        };
      }
      return { ok: true };
    };
    try {
      await startPreloadFromSidePanel();
      return {
        startedUrl: startedCandidate?.url || "",
        selectedCandidateKey,
        selectedCandidatePinned
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
    }
  })()
`, context);

assert.equal(startPreloadKeepsFreshUserSelectionState.startedUrl, "https://media.example.test/user-selected.m4s");
assert.match(startPreloadKeepsFreshUserSelectionState.selectedCandidateKey, /user-selected\.m4s$/);
assert.equal(startPreloadKeepsFreshUserSelectionState.selectedCandidatePinned, true);

const startPreloadCancelsIfTabChangesState = await vm.runInContext(`
  (async () => {
    const originalTabsQuery = chrome.tabs.query;
    const originalSendMessage = chrome.runtime.sendMessage;
    const originalSetMessage = setMessage;
    const messages = [];
    let queryCount = 0;
    activeTab = { id: 1, title: "Old video", url: "https://example.test/watch/old" };
    currentJobId = "";
    currentJob = null;
    startRequestInFlight = false;
    candidates = [
      { kind: "audio", role: "audio", url: "https://media.example.test/old.m4s", title: "Old video" }
    ];
    selectedCandidateKey = candidateKey(candidates[0], 0);
    selectedCandidatePinned = false;
    renderedCandidateSignature = "old-signature";
    chrome.tabs.query = async () => {
      queryCount += 1;
      if (queryCount >= 4) {
        return [{ id: 1, title: "New video", url: "https://example.test/watch/new" }];
      }
      return [{ id: 1, title: "Old video", url: "https://example.test/watch/old" }];
    };
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      if (message.type === MESSAGE.ACTIVATE_PAGE) {
        return { ok: true };
      }
      if (message.type === MESSAGE.GET_CANDIDATES) {
        return {
          ok: true,
          candidates: [
            { kind: "audio", role: "audio", url: "https://media.example.test/old-refreshed.m4s", title: "Old video" }
          ]
        };
      }
      if (message.type === MESSAGE.START_PRELOAD_AUTO) {
        throw new Error("START_PRELOAD_AUTO should not run after tab changes");
      }
      return { ok: true };
    };
    setMessage = text => {
      globalThis.startCancelledMessage = text;
    };
    try {
      await startPreloadFromSidePanel();
      return {
        messages,
        message: globalThis.startCancelledMessage || "",
        activeUrl: activeTab?.url || "",
        queryCount
      };
    } finally {
      chrome.tabs.query = originalTabsQuery;
      chrome.runtime.sendMessage = originalSendMessage;
      setMessage = originalSetMessage;
      startRequestInFlight = false;
      updateElapsedTicker(null);
      delete globalThis.startCancelledMessage;
    }
  })()
`, context);

assert.equal(startPreloadCancelsIfTabChangesState.messages.includes("FUGUANG_START_PRELOAD_AUTO"), false);
assert.equal(startPreloadCancelsIfTabChangesState.message, "当前标签页已经变化，已取消提交。请确认媒体源后再开始。");
assert.equal(startPreloadCancelsIfTabChangesState.activeUrl, "https://example.test/watch/new");

const unchangedSubtitleReattachState = await vm.runInContext(`
  (async () => {
    let attachCount = 0;
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    renderedSubtitleJobId = "job-reattach";
    renderedSubtitleSignature = "job-reattach:2:2:0";
    subtitleCueSource = "vtt";
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "first cue" },
      { start: 3, end: 5, time: "00:00:03.000 --> 00:00:05.000", text: "second cue" }
    ];
    const currentVtt = cuesToVtt(subtitleCues);
    const currentJob = {
      translation: {
        segmentCount: 2,
        chunksDone: 2,
        chunksFailed: 0,
        vttPath: "cache.vtt",
        vttText: currentVtt
      }
    };
    renderedSubtitleSignature = subtitleSignature("job-reattach", currentJob);
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, currentVtt);
    chrome.runtime.sendMessage = async message => {
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        attachCount += 1;
      }
      return { ok: true };
    };
    await renderSubtitles("job-reattach", currentJob);
    stopSubtitleFollow();
    return { attachCount };
  })()
`, context);

assert.equal(unchangedSubtitleReattachState.attachCount, 1);

const sameCountUpdatedSubtitleState = await vm.runInContext(`
  (async () => {
    let attachedVtt = "";
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    renderedSubtitleJobId = "job-text-change";
    renderedSubtitleSignature = "job-text-change:1:1:0";
    subtitleCueSource = "vtt";
    subtitleCues = [
      { start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "old text" }
    ];
    chrome.runtime.sendMessage = async message => {
      if (message.type === "FUGUANG_GET_PRELOAD_TRANSCRIPT") {
        return { ok: false };
      }
      if (message.type === "FUGUANG_GET_PRELOAD_VTT") {
        return { ok: true, vtt: "WEBVTT\\n\\n00:00:00.000 --> 00:00:01.000\\nnew text\\n" };
      }
      if (message.type === "FUGUANG_ATTACH_VTT_TEXT") {
        attachedVtt = message.vtt;
        return { ok: true };
      }
      return { ok: true };
    };
    await renderSubtitles("job-text-change", {
      translation: {
        segmentCount: 1,
        chunksDone: 1,
        chunksFailed: 0,
        vttPath: "browser-memory"
      }
    });
    stopSubtitleFollow();
    return {
      cueText: subtitleCues[0]?.text,
      attachedVtt
    };
  })()
`, context);

assert.equal(sameCountUpdatedSubtitleState.cueText, "new text");
assert.match(sameCountUpdatedSubtitleState.attachedVtt, /new text/);

const subtitlePendingFailureClearsState = await vm.runInContext(`
  (async () => {
    const originalLoadSubtitleCues = loadSubtitleCues;
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    renderedSubtitleJobId = "job-pending-fail";
    renderedSubtitleSignature = "";
    subtitleCues = [];
    pendingSubtitlePromise = null;
    pendingSubtitleSignature = "";
    let firstError = "";
    loadSubtitleCues = async () => {
      throw new Error("simulated subtitle load failure");
    };
    try {
      await renderSubtitles("job-pending-fail", {
        translation: { segmentCount: 1, chunksDone: 1, chunksFailed: 0, vttPath: "browser-memory" }
      });
    } catch (error) {
      firstError = error.message;
    }
    const afterFailure = {
      pendingSubtitlePromise,
      pendingSubtitleSignature
    };
    loadSubtitleCues = async () => ({
      cues: [{ start: 0, end: 1, time: "00:00:00.000 --> 00:00:01.000", text: "loaded after failure" }],
      source: "vtt",
      transcript: null
    });
    try {
      await renderSubtitles("job-pending-fail", {
        translation: { segmentCount: 1, chunksDone: 1, chunksFailed: 0, vttPath: "browser-memory" }
      });
      stopSubtitleFollow();
      return {
        firstError,
        afterFailure,
        cueText: subtitleCues[0]?.text || "",
        pendingSubtitlePromise,
        pendingSubtitleSignature
      };
    } finally {
      loadSubtitleCues = originalLoadSubtitleCues;
    }
  })()
`, context);

assert.equal(subtitlePendingFailureClearsState.firstError, "simulated subtitle load failure");
assert.equal(subtitlePendingFailureClearsState.afterFailure.pendingSubtitlePromise, null);
assert.equal(subtitlePendingFailureClearsState.afterFailure.pendingSubtitleSignature, "");
assert.equal(subtitlePendingFailureClearsState.cueText, "loaded after failure");
assert.equal(subtitlePendingFailureClearsState.pendingSubtitlePromise, null);
assert.equal(subtitlePendingFailureClearsState.pendingSubtitleSignature, "");

const overlayToggleRoundTripState = await vm.runInContext(`
  (async () => {
    const messages = [];
    activeTab = { id: 1 };
    subtitleOverlayEnabled = true;
    subtitleDisplayMode = "translated";
    currentSubtitleCacheEntry = null;
    subtitleCues = [
      { start: 0, end: 2, time: "00:00:00.000 --> 00:00:02.000", text: "paused cue" }
    ];
    attachedSubtitleTabId = 1;
    attachedSubtitleSignature = subtitleAttachSignature(1, cuesToVtt(subtitleCues));
    chrome.runtime.sendMessage = async message => {
      messages.push(message.type);
      return { ok: true };
    };

    await setSubtitleOverlayEnabled(false);
    await setSubtitleOverlayEnabled(true);
    stopSubtitleFollow();

    return {
      messages,
      enabled: subtitleOverlayEnabled,
      attachedSubtitleTabId,
      attachedSubtitleSignature,
      overlayText: elements.subtitleOverlayToggle.textContent,
      ariaPressed: elements.subtitleOverlayToggle["aria-pressed"]
    };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(overlayToggleRoundTripState.messages)), [
  "FUGUANG_DETACH_PRELOAD_VTT",
  "FUGUANG_ATTACH_VTT_TEXT"
]);
assert.equal(overlayToggleRoundTripState.enabled, true);
assert.equal(overlayToggleRoundTripState.attachedSubtitleTabId, 1);
assert.match(overlayToggleRoundTripState.attachedSubtitleSignature, /^manual:/);
assert.equal(overlayToggleRoundTripState.overlayText, "浮层开");
assert.equal(overlayToggleRoundTripState.ariaPressed, "true");

const chunkMessageState = await vm.runInContext(`
  (() => chunkMetaText({
    stage: "translation",
    attempts: 1,
    sourceCount: 32,
    message: "第 1 次尝试 · 第 2/4 批"
  }))()
`, context);

assert.match(chunkMessageState, /第 2\/4 批/);
