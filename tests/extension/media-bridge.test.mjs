import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/content/media-bridge.js", import.meta.url), "utf8");

{
  const harness = createHarness({
    sendMessage() {
      throw new Error("Extension context invalidated.");
    }
  });
  vm.runInContext(source, harness.context, { filename: "media-bridge.js" });

  assert.equal(harness.activeTimerCount(), 0);
  assert.equal(harness.window.__fuguangMediaBridgeCleanup, undefined);
  assert.equal(harness.listenerCount("message"), 0);
}

{
  const harness = createHarness({
    sendMessage() {
      return Promise.reject(new Error("Extension context invalidated."));
    }
  });
  vm.runInContext(source, harness.context, { filename: "media-bridge.js" });
  assert.equal(harness.activeTimerCount(), 2);

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(harness.activeTimerCount(), 0);
  assert.equal(harness.window.__fuguangMediaBridgeCleanup, undefined);
  assert.equal(harness.listenerCount("message"), 0);
}

{
  let messages = 0;
  const harness = createHarness({
    sendMessage() {
      messages += 1;
      return Promise.reject(new Error("ordinary transient runtime error"));
    }
  });
  vm.runInContext(source, harness.context, { filename: "media-bridge.js" });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(messages, 1);
  assert.equal(harness.activeTimerCount(), 2);
  assert.equal(typeof harness.window.__fuguangMediaBridgeCleanup, "function");
  assert.equal(harness.listenerCount("message"), 1);
}

function createHarness({ sendMessage }) {
  const listeners = new Map();
  const activeTimers = new Set();
  let nextTimer = 1;
  const window = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    }
  };
  const document = {
    title: "Test page",
    documentElement: { lang: "en" },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    }
  };
  const context = vm.createContext({
    window,
    document,
    location: { href: "https://example.test/watch" },
    chrome: {
      runtime: {
        id: "test-extension",
        sendMessage
      }
    },
    Number,
    JSON,
    String,
    Boolean,
    Promise,
    setInterval(fn) {
      const id = nextTimer;
      nextTimer += 1;
      activeTimers.add(id);
      return id;
    },
    clearInterval(id) {
      activeTimers.delete(id);
    }
  });
  return {
    context,
    window,
    activeTimerCount: () => activeTimers.size,
    listenerCount: type => listeners.get(type)?.size || 0
  };
}
