import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

{
  const html = fs.readFileSync(new URL("../src/sidepanel/sidepanel.html", import.meta.url), "utf8");
  const js = fs.readFileSync(new URL("../src/sidepanel/sidepanel.js", import.meta.url), "utf8");
  const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(html.includes("本机服务"), false);
  assert.equal(html.includes("Helper"), false);
  assert.equal(html.includes("helperHttp"), false);
  assert.equal(html.includes("helperWs"), false);
  assert.equal(js.includes("helperHttp"), false);
  assert.equal(js.includes("helperWs"), false);
  assert.equal(js.includes("FUGUANG_START_REALTIME"), false);
  assert.equal(js.includes("FUGUANG_STOP_REALTIME"), false);
  assert.equal(js.includes("实时"), false);
  assert.equal(manifest.description.includes("实时"), false);
  assert.equal(manifest.permissions.includes("tabCapture"), false);
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.textContent = "";
    this.hidden = false;
    this.value = "";
    this.dataset = {};
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
      digest: async () => new ArrayBuffer(32)
    }
  },
  FuguangSubtitleFormat: {
    parseSubtitleImportText: () => ({ transcript: { source: [], translated: [] }, metadata: {} })
  }
});

const source = fs.readFileSync(new URL("../src/sidepanel/sidepanel.js", import.meta.url), "utf8");
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
    elements.subtitleList.textContent = "旧字幕";
    buildSubtitleCacheKeyForCurrentPage = async () => "subtitle:test";
    deleteSubtitleCacheEntries = async ids => ids.includes("subtitle:test") ? 1 : 0;
    detachCurrentSubtitlesFromPage = async () => {
      globalThis.detached = true;
    };
    setMessage = text => {
      globalThis.lastMessage = text;
    };

    await clearCurrentSubtitleCache();

    return {
      detached: Boolean(globalThis.detached),
      message: globalThis.lastMessage,
      listText: elements.subtitleList.textContent,
      cuesLength: subtitleCues.length,
      renderedSubtitleJobId,
      currentTranscriptIsNull: currentTranscript === null
    };
  })()
`, context);

assert.equal(result.message, "已清除当前页面字幕缓存（1 条）。");
assert.equal(result.detached, true);
assert.equal(result.listText, "已清除当前页面字幕缓存。");
assert.equal(result.cuesLength, 0);
assert.equal(result.renderedSubtitleJobId, "");
assert.equal(result.currentTranscriptIsNull, true);

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
assert.match(audioButtonState.title, /再次扫描并清除/);

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
      translationDisabled: elements.retryTranslation.disabled
    };

    return { audioResume, translationResume };
  })()
`, context);

assert.deepEqual(JSON.parse(JSON.stringify(retryStageButtonState)), {
  audioResume: {
    retryDisabled: false,
    retryText: "继续 ASR",
    translationDisabled: true
  },
  translationResume: {
    retryDisabled: false,
    retryText: "继续翻译",
    translationDisabled: false
  }
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
    activeCueIndex = -1;

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
      { id: "local_whisper", name: "本地 Whisper", providerType: "local_whisper", model: "base" },
      { id: "old_custom_local", name: "旧本地 ASR", providerType: "local_whisper", model: "base" }
    ]);
    return {
      hasLocalWhisper: profiles.some(profile => profile.id === "local_whisper" || profile.id === "old_custom_local" || profile.providerType === "local_whisper"),
      selected: normalizeSelectedProfileId(profiles, "local_whisper", "openai_whisper")
    };
  })()
`, context);

assert.equal(asrProfileState.hasLocalWhisper, false);
assert.equal(asrProfileState.selected, "openai_whisper");

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
      hint: elements.asrApiKeyHint.textContent
    };
  })()
`, context);

assert.equal(xaiProfileUiState.disabled, true);
assert.match(xaiProfileUiState.placeholder, /不会发送|可选/);
assert.match(xaiProfileUiState.hint, /不会发送 model 字段/);

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

const chunkMessageState = await vm.runInContext(`
  (() => chunkMetaText({
    stage: "translation",
    attempts: 1,
    sourceCount: 32,
    message: "第 1 次尝试 · 第 2/4 批"
  }))()
`, context);

assert.match(chunkMessageState, /第 2\/4 批/);
