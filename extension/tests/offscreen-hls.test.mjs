import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: async () => ({})
  }
};

const node = {
  appendChild: () => {},
  remove: () => {},
  setAttribute: () => {},
  addEventListener: () => {},
  scrollTop: 0,
  scrollHeight: 0,
  textContent: ""
};

const context = vm.createContext({
  chrome,
  console,
  URL,
  Map,
  Set,
  String,
  Number,
  Boolean,
  Math,
  TextEncoder,
  document: {
    body: node,
    createElement: () => ({ ...node }),
    querySelector: () => ({ ...node })
  },
  window: {
    addEventListener: () => {},
    parent: { postMessage: () => {} },
    opener: null
  }
});

const source = fs.readFileSync(new URL("../src/offscreen/offscreen.js", import.meta.url), "utf8");

{
  assert.equal(source.includes("OFFSCREEN_START_REALTIME"), false);
  assert.equal(source.includes("OFFSCREEN_STOP_REALTIME"), false);
  assert.equal(source.includes("OFFSCREEN_REALTIME"), false);
  assert.equal(source.includes("getUserMedia"), false);
  assert.equal(source.includes("WebSocket"), false);
  assert.equal(source.includes("本机服务"), false);
}

vm.runInContext(source, context, { filename: "offscreen.js" });

{
  const headers = context.normalizeRequestHeaders([
    { name: "Referer", value: "https://example.test/" },
    { name: "Origin", value: "https://example.test" },
    { name: "Sec-Fetch-Site", value: "same-site" },
    { name: "User-Agent", value: "Chrome" },
    { name: "Accept", value: "*/*" },
    { name: "Range", value: "bytes=0-1023" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(headers)), {
    Accept: "*/*"
  });
}

{
  const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-KEY:METHOD=AES-128,URI="keys/audio.key",IV=0x00000000000000000000000000000001
#EXTINF:5.000,
seg-000.ts
#EXT-X-ENDLIST`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.equal(media.unsupportedEncryption, "");
  assert.equal(media.segments.length, 1);
  assert.equal(media.segments[0].key.uri, "https://cdn.example.test/path/keys/audio.key");

  const local = context.buildLocalHlsPlaylist(
    [{ ...media.segments[0], name: "seg-000.ts" }],
    "",
    new Map([[media.segments[0].key.id, "key-0.key"]])
  );
  assert.match(local, /#EXT-X-KEY:METHOD=AES-128,URI="key-0\.key",IV=0x00000000000000000000000000000001/);
  assert.match(local, /seg-000\.ts/);
}

{
  const playlist = `#EXTM3U
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.bin"
#EXTINF:5.000,
seg-000.ts`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.equal(media.unsupportedEncryption, "SAMPLE-AES");
}

{
  const first = vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context);
  const second = vm.runInContext("new Uint8Array([4, 5]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 7,
    media: { mapUrl: "" },
    keyFiles: [],
    playlistSegments: [],
    segmentBuffers: [first, second],
    initName: "",
    keyNames: new Map()
  });
  assert.equal(input.inputName, "input-7.ts");
  assert.equal(input.inputKind, "transport-stream");
  assert.equal(input.files.length, 1);
  assert.deepEqual([...new Uint8Array(input.files[0].buffer)], [1, 2, 3, 4, 5]);
}

{
  const segmentBuffer = vm.runInContext("new Uint8Array([1]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 2,
    media: { mapUrl: "https://cdn.example.test/init.mp4" },
    keyFiles: [],
    playlistSegments: [{ duration: 4, name: "seg-000.m4s" }],
    segmentBuffers: [segmentBuffer],
    initName: "init-2.mp4",
    keyNames: new Map()
  });
  const playlist = new TextDecoder().decode(input.files[0].buffer);
  assert.equal(input.inputName, "input-2.m3u8");
  assert.equal(input.inputKind, "playlist");
  assert.match(playlist, /#EXT-X-MAP:URI="init-2\.mp4"/);
  assert.match(playlist, /seg-000\.m4s/);
}

{
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "" }, []), true);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "https://cdn.example.test/init.mp4" }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "" }, [{ name: "key.key" }]), false);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [] }), 360);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "https://cdn.example.test/init.mp4", segments: [] }), 60);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [{ key: { id: "key" } }] }), 60);
}

{
  const tinySegments = Array.from({ length: 720 }, (_, index) => ({
    start: index * 0.5,
    end: (index + 1) * 0.5,
    duration: 0.5,
    url: `https://cdn.example.test/tiny-${index}.ts`
  }));
  const groups = context.groupHlsSegments(tinySegments, {
    maxDurationSeconds: 180,
    maxSegments: context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: tinySegments })
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].segments.length, 360);
  assert.equal(groups[0].end, 180);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/seg-${index}.ts`
  }));
  const extractGroups = context.groupHlsSegments(segments, {
    maxDurationSeconds: 180,
    maxSegments: 60
  });
  assert.equal(extractGroups.length, 4);
  assert.equal(extractGroups[0].segments.length, 45);
  assert.equal(extractGroups[0].end, 180);
  assert.equal(extractGroups[3].segments.length, 15);

  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of extractGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `extract-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups[0].at(-1).end, 600);
  assert.equal(logicalPartGroups[0].length, 4);
  assert.equal(logicalPartGroups[0].reduce((sum, part) => sum + part.bytes, 0), 4096);
}

{
  const urls = context.buildLikelyAudioCompanionPlaylistUrls(
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/avc1/480x270/GNTxdMNeTEMv2IMX.m3u8?tag=16"
  );
  assert.equal(urls.length, 3);
  assert.equal(
    urls[0],
    "https://video.twimg.com/amplify_video/2051739000000000000/pl/mp4a/128000/GNTxdMNeTEMv2IMX.m3u8?tag=16"
  );
  assert.equal(
    context.buildLikelyAudioCompanionPlaylistUrls("https://cdn.example.test/video/pl/avc1/480x270/index.m3u8").length,
    0
  );
}

{
  const state = context.createHlsLogicalChunkState(900);
  const readyBeforeLimit = [];
  for (let index = 0; index < 4; index += 1) {
    readyBeforeLimit.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: index * 180,
      end: (index + 1) * 180,
      duration: 180,
      file: { name: `internal-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/${index}` }
    }));
  }
  assert.equal(readyBeforeLimit.length, 0);

  const readyAtLimit = context.collectHlsLogicalPartGroups(state, {
    index: 4,
    start: 720,
    end: 900,
    duration: 180,
    file: { name: "internal-4.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/4" }
  });
  assert.equal(readyAtLimit.length, 1);
  assert.equal(readyAtLimit[0].length, 5);
}

{
  const sent = [];
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async message => {
    sent.push(JSON.parse(JSON.stringify(message)));
    return {};
  };
  await context.reportWebFfmpegChunkReady(
    { tabId: 1, jobId: "browser-streaming-test" },
    {
      index: 0,
      start: 0,
      end: 180,
      duration: 180,
      file: {
        name: "chunk-001.mp3",
        mime: "audio/mpeg",
        cacheUrl: "https://fuguang.local/audio/chunk-001.mp3",
        bytes: 1024
      },
      bytes: 1024
    },
    { duration: 600, internalChunksDone: 1, internalChunksTotal: 4 }
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY");
  assert.equal(sent[0].jobId, "browser-streaming-test");
  assert.equal(sent[0].chunk.end, 180);
  chrome.runtime.sendMessage = originalSendMessage;
}
