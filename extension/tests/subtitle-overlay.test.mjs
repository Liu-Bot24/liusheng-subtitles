import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SAMPLE_VTT = `WEBVTT

00:00:00.500 --> 00:00:02.000
first cue

00:00:03.500 --> 00:00:05.000
second cue
`;

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.id = "";
    this.hidden = false;
    this.textContent = "";
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.offsetWidth = 480;
    this.offsetHeight = 80;
    this.clientWidth = 480;
    this.clientHeight = 80;
    this.listeners = new Map();
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, String(value))
    };
    this.classList = {
      add: () => {},
      remove: () => {}
    };
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    if (String(value).includes("data-fuguang-caption-text")) {
      const handle = new FakeElement("div");
      handle.dataset.fuguangDragHandle = "";
      const text = new FakeElement("div");
      text.dataset.fuguangCaptionText = "";
      this.appendChild(handle);
      this.appendChild(text);
    }
  }

  get innerHTML() {
    return this._innerHTML || "";
  }

  appendChild(child) {
    child.parentElement = this;
    child.isConnected = true;
    this.children.push(child);
    this.ownerDocument?.registerElement(child);
    child.ownerDocument = this.ownerDocument;
    return child;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const listeners = [...(this.listeners.get(event.type) || [])];
    for (const listener of listeners) {
      listener(event);
    }
    return true;
  }

  querySelector(selector) {
    if (selector === "[data-fuguang-caption-text]") {
      return this.children.find(child => Object.hasOwn(child.dataset, "fuguangCaptionText")) || null;
    }
    if (selector === "[data-fuguang-drag-handle]") {
      return this.children.find(child => Object.hasOwn(child.dataset, "fuguangDragHandle")) || null;
    }
    return null;
  }

  querySelectorAll() {
    return [];
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  }
}

class FakeMedia extends FakeElement {
  constructor({ width = 640, height = 360, currentTime = 0, paused = false } = {}) {
    super("video");
    this.clientWidth = width;
    this.clientHeight = height;
    this.videoWidth = width;
    this.videoHeight = height;
    this.currentTime = currentTime;
    this.duration = 120;
    this.paused = paused;
    this.ended = false;
    this.readyState = 4;
    this.currentSrc = "https://media.example.test/video.mp4";
    this.src = this.currentSrc;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  }
}

class FakeDocument {
  constructor(videos) {
    this.byId = new Map();
    this.videos = videos;
    this.fullscreenElement = null;
    this.documentElement = new FakeElement("html");
    this.documentElement.ownerDocument = this;
  }

  registerElement(element) {
    if (element.id) {
      this.byId.set(element.id, element);
    }
    element.ownerDocument = this;
  }

  createElement(tagName) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  getElementById(id) {
    return this.byId.get(id) || null;
  }

  querySelectorAll(selector) {
    if (selector === "video, audio") {
      return this.videos;
    }
    return [];
  }

  addEventListener() {}
  removeEventListener() {}
}

class FakeEvent {
  constructor(type) {
    this.type = type;
  }
}

function createHarness({ settings = {}, videos = [new FakeMedia()] } = {}) {
  const intervals = new Map();
  const timeouts = new Map();
  let nextTimer = 1;
  let messageListener = null;
  let storageListener = null;
  const document = new FakeDocument(videos);
  videos.forEach(video => {
    video.ownerDocument = document;
  });
  const window = {
    innerWidth: 1280,
    innerHeight: 720,
    document,
    Event: FakeEvent,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval(fn, delay) {
      const id = nextTimer++;
      intervals.set(id, { fn, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout(fn, delay) {
      const id = nextTimer++;
      timeouts.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    }
  };
  window.window = window;

  const chrome = {
    runtime: {
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
        removeListener() {}
      }
    },
    storage: {
      sync: {
        get: async defaults => ({ ...defaults, ...settings }),
        set: async () => {}
      },
      onChanged: {
        addListener(listener) {
          storageListener = listener;
        },
        removeListener() {}
      }
    }
  };

  const context = vm.createContext({
    chrome,
    console,
    document,
    window,
    Event: FakeEvent,
    performance: { now: () => 1000 },
    Map,
    Set,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Promise
  });

  const source = fs.readFileSync(new URL("../src/content/subtitle-overlay.js", import.meta.url), "utf8");
  assert.equal(source.includes("FUGUANG_SET_CAPTION"), false);
  assert.equal(source.includes("FUGUANG_CLEAR_CAPTION"), false);
  assert.equal(source.includes("realtime"), false);
  assert.equal(source.includes("实时"), false);
  vm.runInContext(source, context, { filename: "subtitle-overlay.js" });

  return {
    context,
    videos,
    intervals,
    timeouts,
    ready: async () => {
      await Promise.resolve();
      await Promise.resolve();
    },
    send: message => new Promise(resolve => {
      messageListener(message, {}, resolve);
    }),
    emitStorage: changes => storageListener(changes, "sync"),
    runIntervals: () => [...intervals.values()].forEach(timer => timer.fn()),
    overlayText: () => document.getElementById("fuguang-caption-overlay")
      ?.querySelector("[data-fuguang-caption-text]")
      ?.textContent || "",
    overlayHidden: () => document.getElementById("fuguang-caption-overlay")?.hidden
  };
}

{
  const harness = createHarness({ settings: { subtitleOverlayEnabled: false } });
  await harness.ready();
  const response = await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT });
  assert.equal(response.ok, false);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.overlayText(), "");
}

{
  const video = new FakeMedia({ currentTime: 1 });
  const harness = createHarness({ videos: [video] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");
  assert.equal(harness.intervals.size, 1);

  assert.equal((await harness.send({ type: "FUGUANG_SEEK_MEDIA", time: 4 })).ok, true);
  assert.equal(harness.overlayText(), "second cue");
  assert.equal(harness.timeouts.size, 3);

  harness.emitStorage({ subtitleOverlayEnabled: { newValue: false } });
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.timeouts.size, 0);
  assert.equal(harness.overlayHidden(), true);
  assert.equal(harness.overlayText(), "");
}

{
  const firstVideo = new FakeMedia({ width: 900, height: 500, currentTime: 1, paused: false });
  const secondVideo = new FakeMedia({ width: 240, height: 160, currentTime: 4, paused: true });
  const harness = createHarness({ videos: [firstVideo, secondVideo] });
  await harness.ready();
  assert.equal((await harness.send({ type: "FUGUANG_ATTACH_VTT", vtt: SAMPLE_VTT })).ok, true);
  assert.equal(harness.overlayText(), "first cue");

  secondVideo.clientWidth = 1200;
  secondVideo.clientHeight = 680;
  secondVideo.paused = false;
  harness.runIntervals();

  assert.equal(harness.overlayText(), "first cue");
  const stateResponse = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.state.currentTime, 1);
}

{
  const firstVideo = new FakeMedia({ width: 900, height: 500, currentTime: 1, paused: true });
  const secondVideo = new FakeMedia({ width: 240, height: 160, currentTime: 4, paused: true });
  const harness = createHarness({ videos: [firstVideo, secondVideo] });
  await harness.ready();
  const initialState = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(initialState.ok, true);
  assert.equal(initialState.state.currentTime, 1);

  secondVideo.clientWidth = 1400;
  secondVideo.clientHeight = 900;
  harness.runIntervals();

  const stableState = await harness.send({ type: "FUGUANG_GET_VIDEO_STATE" });
  assert.equal(stableState.ok, true);
  assert.equal(stableState.state.currentTime, 1);
}
