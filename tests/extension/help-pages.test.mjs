import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const helpSource = fs.readFileSync(new URL("../../extension/src/help/help.js", import.meta.url), "utf8");

function renderHelpWithLocaleInputs({ search = "", storedLocale = "", languages = [] } = {}) {
  const listeners = new Map();
  const document = {
    title: "",
    body: { dataset: {} },
    documentElement: { lang: "" },
    addEventListener(type, listener) {
      listeners.set(`document:${type}`, listener);
    },
    querySelectorAll() {
      return [];
    }
  };
  const context = vm.createContext({
    document,
    navigator: {
      language: languages[0] || "",
      languages
    },
    URLSearchParams,
    window: {
      location: { search },
      localStorage: {
        getItem() {
          return storedLocale;
        }
      },
      addEventListener(type, listener) {
        listeners.set(`window:${type}`, listener);
      },
      setTimeout() {}
    }
  });
  vm.runInContext(helpSource, context, { filename: "help.js" });
  listeners.get("document:DOMContentLoaded")?.();
  return document.documentElement.lang;
}

assert.equal(
  renderHelpWithLocaleInputs({ search: "?lang=en", storedLocale: "zh", languages: ["zh-CN"] }),
  "en"
);

assert.equal(
  renderHelpWithLocaleInputs({ search: "?lang=zh", storedLocale: "en", languages: ["en-US"] }),
  "zh-CN"
);
