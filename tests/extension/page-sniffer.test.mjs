import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/content/page-sniffer.js", import.meta.url), "utf8");

{
  const harness = createHarness({
    html: `
      <html>
        <body>
          <a href="https://t.co/BmJcY2BZXu">pic.twitter.com/BmJcY2BZXu</a>
          <script>
            {"playlist":"https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag&#x3D;27"}
            {"mp4":"https://video.twimg.com/amplify_video/2049886560490053635/vid/avc1/1280x720/Lx5E_J_ePkKL_Nwf.mp4?tag&#x3D;27"}
          </script>
        </body>
      </html>
    `
  });
  vm.runInContext(source, harness.context, { filename: "page-sniffer.js" });

  const media = harness.messages.filter(message => message.type === "FUGUANG_PAGE_SNIFFER_MEDIA").map(message => message.media);
  assert.ok(
    media.some(item => item.kind === "hls" && item.ext === "m3u8" && item.url === "https://video.twimg.com/amplify_video/2049886560490053635/pl/EfJCfVGPgvF963Yl.m3u8?tag=27"),
    "X initial HTML HLS playlist should be discovered and HTML entities should be decoded"
  );
  assert.ok(
    media.some(item => item.kind === "media" && item.ext === "mp4" && item.url === "https://video.twimg.com/amplify_video/2049886560490053635/vid/avc1/1280x720/Lx5E_J_ePkKL_Nwf.mp4?tag=27"),
    "X initial HTML MP4 fallback should be discovered"
  );
  assert.equal(
    media.some(item => item.url.startsWith("https://t.co/")),
    false,
    "ordinary social links must not be reported as media"
  );
}

function createHarness({ html = "" } = {}) {
  const messages = [];
  let nextTimer = 1;
  const window = {
    fetch() {
      return Promise.reject(new Error("fetch not used by this test"));
    },
    postMessage(message) {
      messages.push(message);
    }
  };
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function open() {};
  XMLHttpRequest.prototype.send = function send() {};
  const document = {
    title: "X test page",
    documentElement: { innerHTML: html, lang: "en" },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    createElement() {
      return {
        value: "",
        set innerHTML(value) {
          this.value = String(value || "")
            .replace(/&#x3D;/gi, "=")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, "\"")
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">");
        }
      };
    }
  };
  const context = vm.createContext({
    window,
    document,
    location: {
      href: "https://x.com/AndrewYNg/status/2049886895530967534",
      hostname: "x.com",
      protocol: "https:"
    },
    XMLHttpRequest,
    URL,
    URLSearchParams,
    Headers,
    JSON,
    Number,
    String,
    Boolean,
    Promise,
    WeakSet,
    Set,
    setInterval() {
      const id = nextTimer;
      nextTimer += 1;
      return id;
    },
    clearTimeout() {},
    setTimeout() {
      const id = nextTimer;
      nextTimer += 1;
      return id;
    }
  });
  return { context, messages };
}
