import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function testDomainsFromUrls(urls) {
  const domains = new Set();
  for (const url of Array.isArray(urls) ? urls : [urls]) {
    try {
      const parsed = new URL(String(url || ""));
      if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) {
        domains.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // Ignore malformed test inputs.
    }
  }
  return [...domains].sort();
}

const chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    getURL: path => `chrome-extension://fuguang-test/${path}`,
    sendMessage: async message => ({ domains: testDomainsFromUrls(message?.urls) })
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

const source = fs.readFileSync(new URL("../../extension/src/offscreen/offscreen.js", import.meta.url), "utf8");

{
  assert.equal(source.includes("OFFSCREEN_START_REALTIME"), false);
  assert.equal(source.includes("OFFSCREEN_STOP_REALTIME"), false);
  assert.equal(source.includes("OFFSCREEN_REALTIME"), false);
  assert.equal(source.includes("getUserMedia"), false);
  assert.equal(source.includes("WebSocket"), false);
}

vm.runInContext(source, context, { filename: "offscreen.js" });

{
  const url = context.normalizeWebFfmpegUrl("chrome-extension://fuguang-test/web-ffmpeg/index.html");
  assert.equal(url, "chrome-extension://fuguang-test/web-ffmpeg/index.html?fgv=20260522-webffmpeg-hls-playlist-safe");
  assert.throws(
    () => context.normalizeWebFfmpegUrl("https://ffmpeg.example.test/index.html"),
    /Web FFmpeg 必须使用扩展内置页面/
  );
}

{
  const master = context.parseHlsMasterPlaylist(`#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=64000,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1920x1080
video-low-bandwidth.m3u8
#EXT-X-STREAM-INF:CODECS="mp4a.40.2"
audio-stream-inf.m3u8
`, "https://cdn.example.test/master.m3u8");
  const audio = master.variants.find(variant => variant.url.endsWith("/audio-stream-inf.m3u8"));
  const chosen = context.chooseHlsVariantForAsr(master.variants);
  assert.equal(audio.audioOnly, true);
  assert.equal(chosen.url, "https://cdn.example.test/audio-stream-inf.m3u8");
}

{
  const originalFetch = context.fetch;
  const started = [];
  const resolvers = new Map();
  context.fetch = async url => {
    const href = String(url);
    const label = href.includes("init.mp4")
      ? "map"
      : href.includes("key.bin")
        ? "key"
        : href.includes("seg-000.m4s")
          ? "segment"
          : "other";
    started.push(label);
    return await new Promise(resolve => {
      resolvers.set(label, () => resolve({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
        text: async () => "",
        headers: { get: () => "application/octet-stream" }
      }));
    });
  };
  const groupResourcePromise = context.downloadHlsGroupResources({
    segments: [{
      url: "https://cdn.example.test/seg-000.m4s",
      byteRange: null,
      map: { id: "map-0", url: "https://cdn.example.test/init.mp4", byteRange: null },
      key: { id: "key-0", uri: "https://cdn.example.test/key.bin" }
    }]
  }, {}, 0, () => {});
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual([...new Set(started)].sort(), ["key", "map", "segment"]);
  for (const resolve of resolvers.values()) {
    resolve();
  }
  const resources = await groupResourcePromise;
  assert.equal(resources.mapFiles.length, 1);
  assert.equal(resources.keyFiles.length, 1);
  assert.equal(resources.segmentDownloads.length, 1);
  context.fetch = originalFetch;
}

{
  const headers = context.normalizeRequestHeaders([
    { name: "Referer", value: "https://example.test/" },
    { name: "Origin", value: "https://example.test" },
    { name: "Sec-Fetch-Site", value: "same-site" },
    { name: "User-Agent", value: "Chrome" },
    { name: "Cookie", value: "sid=secret" },
    { name: "Authorization", value: "Bearer media-token" },
    { name: "Accept", value: "*/*" },
    { name: "Range", value: "bytes=0-1023" },
    { name: "If-Range", value: "\"etag\"" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(headers)), {
    Authorization: "Bearer media-token",
    Accept: "*/*"
  });

  const fetchOptions = context.buildMediaFetchOptions({
    requestHeaders: {
      authorization: "Bearer media-token",
      cookie: "sid=secret",
      referer: "https://example.test/",
      origin: "https://example.test",
      "user-agent": "Chrome",
      range: "bytes=0-1023",
      "if-range": "\"etag\""
    }
  });
  assert.equal(fetchOptions.credentials, "include");
  assert.deepEqual(JSON.parse(JSON.stringify(fetchOptions.headers)), {
    authorization: "Bearer media-token"
  });

  const rangedFetchOptions = context.buildFetchOptionsWithByteRange(fetchOptions, { offset: 1024, length: 512 });
  assert.equal(rangedFetchOptions.credentials, "include");
  assert.deepEqual(JSON.parse(JSON.stringify(rangedFetchOptions.headers)), {
    authorization: "Bearer media-token",
    Range: "bytes=1024-1535"
  });

  const unchangedFetchOptions = context.buildFetchOptionsWithByteRange(fetchOptions, null);
  assert.equal(unchangedFetchOptions, fetchOptions);
}

{
  const originalFetch = context.fetch;
  const requests = [];
  const fullBody = Uint8Array.from([10, 11, 12, 13, 14, 15, 16, 17]).buffer;
  context.fetch = async (_url, options) => {
    requests.push(JSON.parse(JSON.stringify(options.headers)));
    return {
      ok: true,
      status: 200,
      headers: { get: () => "video/mp4" },
      arrayBuffer: async () => fullBody
    };
  };

  try {
    const buffer = await context.fetchBinary(
      "https://cdn.example.test/media.mp4",
      { headers: { Authorization: "Bearer media-token" }, credentials: "include" },
      { offset: 2, length: 3 }
    );
    assert.deepEqual(Array.from(new Uint8Array(buffer)), [12, 13, 14]);
    assert.deepEqual(requests, [{ Authorization: "Bearer media-token", Range: "bytes=2-4" }]);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const originalFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "video/mp4" },
    arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
  });

  try {
    await assert.rejects(
      () => context.fetchBinary("https://cdn.example.test/media.mp4", {}, { offset: 8, length: 4 }),
      /Range|字节范围/
    );
  } finally {
    context.fetch = originalFetch;
  }
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
    playlistSegments: [
      { duration: 4, name: "seg-000.ts" },
      { duration: 4, name: "seg-001.ts" }
    ],
    segmentBuffers: [first, second],
    initName: "",
    keyNames: new Map()
  });
  assert.equal(input.inputName, "input-7.m3u8");
  assert.equal(input.inputKind, "playlist");
  assert.equal(input.files.length, 1);
  const playlist = new TextDecoder().decode(input.files[0].buffer);
  assert.match(playlist, /seg-000\.ts/);
  assert.match(playlist, /seg-001\.ts/);
}

{
  const first = vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context);
  const second = vm.runInContext("new Uint8Array([4, 5]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 7,
    media: { mapUrl: "", allowUnsafeTransportConcat: true },
    keyFiles: [],
    playlistSegments: [],
    segmentBuffers: [first, second],
    initName: "",
    keyNames: new Map()
  });
  assert.equal(input.inputName, "input-7.ts");
  assert.equal(input.inputKind, "transport-stream");
  assert.deepEqual([...new Uint8Array(input.files[0].buffer)], [1, 2, 3, 4, 5]);
}

{
  const segmentBuffer = vm.runInContext("new Uint8Array([9]).buffer", context);
  const input = context.buildHlsFfmpegInput({
    index: 8,
    media: { mapUrl: "" },
    keyFiles: [],
    playlistSegments: [{ duration: 4, name: "seg-000.ts" }],
    segmentBuffers: [segmentBuffer],
    initName: "",
    keyNames: new Map(),
    forcePlaylist: true
  });
  const playlist = new TextDecoder().decode(input.files[0].buffer);
  assert.equal(input.inputName, "input-8.m3u8");
  assert.equal(input.inputKind, "playlist");
  assert.match(playlist, /seg-000\.ts/);
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const requests = [];
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => {
        cache.set(url, response);
      },
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const text = `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXTINF:4.000,
seg-000.ts
#EXTINF:4.000,
seg-001.ts
#EXT-X-ENDLIST`;
    if (String(url).endsWith(".m3u8")) {
      return {
        ok: true,
        text: async () => text,
        arrayBuffer: async () => vm.runInContext("new Uint8Array([]).buffer", context),
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      text: async () => "",
      arrayBuffer: async () => vm.runInContext("new Uint8Array([1, 2, 3]).buffer", context),
      headers: { get: () => "video/mp2t" }
    };
  };
  context.requestWebFfmpeg = async payload => {
    requests.push(payload);
    if (payload.inputName === "input-0.ts") {
      throw new Error("simulated transport stream failure");
    }
    assert.equal(payload.inputName, "input-0.m3u8");
    return {
      file: {
        name: payload.outputName,
        mime: "audio/mpeg",
        buffer: vm.runInContext("new Uint8Array([7, 8]).buffer", context)
      },
      bytes: 2
    };
  };

  try {
    const result = await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-fallback-test",
      sourceUrl: "https://cdn.example.test/video.m3u8",
      cacheNamespace: "hls-fallback-test",
      asrChunkSeconds: 900
    });
    assert.equal(requests.length, 2);
    assert.equal(requests[0].inputName, "input-0.ts");
    assert.equal(requests[1].inputName, "input-0.m3u8");
    assert.equal(result.chunks.length, 1);
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
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
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "" }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true }, []), true);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", segments: [{ url: "https://cdn.example.test/0.ts" }] }, []), true);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "https://cdn.example.test/init.mp4" }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true }, [{ name: "key.key" }]), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true, segments: [{ discontinuityBefore: true }] }, []), false);
  assert.equal(context.canUseConcatenatedHlsTransportStream({ mapUrl: "", allowUnsafeTransportConcat: true, segments: [{ byteRange: { offset: 0, length: 100 } }] }, []), false);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [] }), 60);
  assert.equal(context.hlsMaxSegmentsPerExtractChunk({ mapUrl: "", segments: [{ url: "https://cdn.example.test/0.ts" }] }), 360);
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

  const overlapped = context.addHlsAsrContextOverlapToGroups(extractGroups, segments, 8);
  assert.equal(overlapped[0].start, 0);
  assert.equal(overlapped[0].coreStart, 0);
  assert.equal(overlapped[0].coreEnd, 180);
  assert.equal(overlapped[0].end, 188);
  assert.equal(overlapped[1].start, 172);
  assert.equal(overlapped[1].coreStart, 180);
  assert.equal(overlapped[1].coreEnd, 360);
  assert.equal(overlapped[1].end, 368);

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
  assert.equal(state.logicalChunkSeconds, 900);
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups.at(-1).at(-1).end, 600);
  assert.equal(logicalPartGroups.reduce((sum, group) => sum + group.reduce((inner, part) => inner + part.bytes, 0), 0), 4096);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/long-window-${index}.ts`
  }));
  const internalGroups = context.buildHlsInternalExtractionGroups({
    mapUrl: "",
    segments
  }, 900);
  assert.equal(internalGroups.length, 4);
  assert.equal(internalGroups.some(group => group.start < group.coreStart || group.end > group.coreEnd), false);
  assert.equal(internalGroups[0].start, 0);
  assert.equal(internalGroups[0].coreStart, 0);
  assert.equal(internalGroups[0].coreEnd, 180);
  assert.equal(internalGroups[0].end, 180);
  assert.equal(internalGroups[1].start, 180);
  assert.equal(internalGroups[1].coreStart, 180);
  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of internalGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `long-window-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/long-window-${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0].length, 4);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups[0][0].coreStart, 0);
  assert.equal(logicalPartGroups[0][0].coreEnd, 180);
  assert.equal(logicalPartGroups[0][1].start, 180);
  assert.equal(logicalPartGroups.at(-1).at(-1).end, 600);
  assert.equal(logicalPartGroups.at(-1).at(-1).coreEnd, 600);
}

{
  const segments = Array.from({ length: 150 }, (_, index) => ({
    start: index * 4,
    end: (index + 1) * 4,
    duration: 4,
    url: `https://cdn.example.test/mergeable-${index}.ts`
  }));
  const internalGroups = context.buildHlsInternalExtractionGroups({
    mapUrl: "",
    segments
  }, 900);
  const state = context.createHlsLogicalChunkState(900);
  const logicalPartGroups = [];
  for (const [index, group] of internalGroups.entries()) {
    logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, {
      index,
      start: group.start,
      end: group.end,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      duration: group.end - group.start,
      bytes: 1024,
      file: { name: `mergeable-${index}.mp3`, mime: "audio/mpeg", cacheUrl: `https://fuguang.local/mergeable-${index}`, bytes: 1024 }
    }));
  }
  logicalPartGroups.push(...context.collectHlsLogicalPartGroups(state, null, true));
  assert.equal(logicalPartGroups.length, 1);
  assert.equal(logicalPartGroups[0].length, 4);
  assert.equal(logicalPartGroups[0][0].start, 0);
  assert.equal(logicalPartGroups[0].at(-1).end, 600);
}

{
  const selected = Array.from({ length: 150 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/cap-${index}.ts`
  }));
  const core = selected.slice(45, 105);
  const capped = context.capOverlappedHlsSegments(selected, core, 60);
  assert.equal(capped.length, 60);
  assert.equal(capped[0], core[0]);
  assert.equal(capped.at(-1), core.at(-1));
}

{
  const concatRequests = [];
  const deletedUrls = [];
  const cacheWrites = [];
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  context.Response = Response;
  context.caches = {
    open: async () => ({
      put: async (url, response) => {
        cacheWrites.push({
          url,
          contentType: response.headers.get("Content-Type")
        });
      },
      delete: async url => {
        deletedUrls.push(url);
        return true;
      }
    })
  };
  const outputBuffer = vm.runInContext("new Uint8Array([9, 8, 7, 6]).buffer", context);
  context.requestWebFfmpeg = async (payload, transfer, onProgress) => {
    concatRequests.push({
      type: payload.type,
      outputName: payload.outputName,
      files: payload.files.map(file => ({
        name: file.name,
        mime: file.mime,
        bytes: file.buffer.byteLength
      })),
      transferBytes: transfer.map(buffer => buffer.byteLength)
    });
    onProgress?.({ percent: 50, message: "stub concat progress" });
    return {
      file: {
        name: payload.outputName,
        mime: "audio/mpeg",
        buffer: outputBuffer
      },
      bytes: outputBuffer.byteLength
    };
  };

  try {
    const firstBuffer = vm.runInContext("new Uint8Array([1, 2]).buffer", context);
    const secondBuffer = vm.runInContext("new Uint8Array([3, 4, 5]).buffer", context);
    const result = await context.buildHlsLogicalAudioChunk(
      { tabId: 1, jobId: "hls-logical-concat-test", cacheNamespace: "hls-logical-concat" },
      0,
      [
        {
          index: 0,
          start: 0,
          end: 180,
          coreStart: 0,
          coreEnd: 180,
          file: {
            name: "internal-0.mp3",
            mime: "audio/mpeg",
            cacheUrl: "https://fuguang.local/audio/internal-0.mp3",
            bytes: firstBuffer.byteLength
          },
          buffer: firstBuffer,
          bytes: firstBuffer.byteLength,
          speechIntervals: [{ start: 1, end: 3 }]
        },
        {
          index: 1,
          start: 180,
          end: 360,
          coreStart: 180,
          coreEnd: 360,
          file: {
            name: "internal-1.mp3",
            mime: "audio/mpeg",
            cacheUrl: "https://fuguang.local/audio/internal-1.mp3",
            bytes: secondBuffer.byteLength
          },
          buffer: secondBuffer,
          bytes: secondBuffer.byteLength,
          speechIntervals: [{ start: 181, end: 183 }]
        }
      ],
      2
    );

    assert.equal(concatRequests.length, 1);
    assert.equal(concatRequests[0].type, "concat-audio");
    assert.equal(concatRequests[0].outputName, "logical-001.mp3");
    assert.deepEqual(Array.from(concatRequests[0].files, file => file.name), [
      "logical-1-part-001.mp3",
      "logical-1-part-002.mp3"
    ]);
    assert.deepEqual(Array.from(concatRequests[0].transferBytes), [2, 3]);
    assert.equal(result.logical, true);
    assert.equal(result.file.name, "logical-001.mp3");
    assert.equal(result.file.parts, undefined);
    assert.equal(result.file.bytes, outputBuffer.byteLength);
    assert.equal(result.internalChunkCount, 2);
    assert.deepEqual(deletedUrls, [
      "https://fuguang.local/audio/internal-0.mp3",
      "https://fuguang.local/audio/internal-1.mp3"
    ]);
    assert.equal(cacheWrites.length, 1);
    assert.match(cacheWrites[0].url, /^https:\/\/fuguang\.local\/__fuguang_audio_cache\/hls-logical-concat-logical-0\//);
    assert.equal(cacheWrites[0].contentType, "audio/mpeg");
  } finally {
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
  }
}

{
  const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-MAP:URI="init-0.mp4",BYTERANGE="100@0"
#EXTINF:5.000,
seg.mp4
#EXT-X-BYTERANGE:120@100
#EXTINF:5.000,
seg.mp4
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="init-1.mp4"
#EXTINF:5.000,
seg-2.m4s
#EXT-X-ENDLIST`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.equal(media.segments.length, 3);
  assert.equal(media.segments[0].map.url, "https://cdn.example.test/path/init-0.mp4");
  assert.deepEqual(
    JSON.parse(JSON.stringify(media.segments[1].byteRange)),
    { offset: 100, length: 120, endExclusive: 220 }
  );
  assert.equal(media.segments[2].discontinuityBefore, true);

  const groups = context.groupHlsSegments(media.segments, { maxDurationSeconds: 60, maxSegments: 60 });
  assert.equal(groups.length, 2);

  const mapNames = new Map([
    [media.segments[0].map.id, "map-0.mp4"],
    [media.segments[2].map.id, "map-1.mp4"]
  ]);
  const local = context.buildLocalHlsPlaylist(
    [
      { ...media.segments[0], name: "seg-0.m4s", byteRange: null },
      { ...media.segments[1], name: "seg-1.m4s", byteRange: null },
      { ...media.segments[2], name: "seg-2.m4s", byteRange: null }
    ],
    "",
    new Map(),
    mapNames
  );
  assert.match(local, /#EXT-X-MAP:URI="map-0\.mp4"/);
  assert.match(local, /#EXT-X-DISCONTINUITY/);
  assert.match(local, /#EXT-X-MAP:URI="map-1\.mp4"/);
}

{
  const playlist = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://key-cdn.example.test/key.bin"
#EXT-X-MAP:URI="https://map-cdn.example.test/init.mp4"
#EXTINF:5.000,
https://segment-cdn.example.test/seg-000.m4s
#EXT-X-ENDLIST`;
  const media = context.parseHlsMediaPlaylist(playlist, "https://cdn.example.test/path/index.m3u8");
  assert.deepEqual(JSON.parse(JSON.stringify(context.hlsMediaHeaderRuleUrls(media))), [
    "https://key-cdn.example.test/key.bin",
    "https://map-cdn.example.test/init.mp4",
    "https://segment-cdn.example.test/seg-000.m4s"
  ]);
}

{
  const sent = [];
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async message => {
    sent.push(JSON.parse(JSON.stringify(message)));
    return { ok: true, domains: testDomainsFromUrls(message.urls) };
  };

  try {
    await context.updateMediaHeaderRuleDomains({ jobId: "hls-header-test" }, [
      "https://cdn.example.test/master.m3u8",
      "https://cdn.example.test/master.m3u8",
      "https://segment-cdn.example.test/seg.ts"
    ]);
    await context.updateMediaHeaderRuleDomains({}, ["https://ignored.example.test/seg.ts"]);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
  }

  assert.deepEqual(sent, [{
    type: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS",
    jobId: "hls-header-test",
    urls: [
      "https://cdn.example.test/",
      "https://segment-cdn.example.test/"
    ]
  }]);
}

{
  const originalSendMessage = chrome.runtime.sendMessage;
  let sent = 0;
  chrome.runtime.sendMessage = async () => {
    sent += 1;
    return { ok: false, error: "DNR failed" };
  };

  try {
    await assert.rejects(
      () => context.updateMediaHeaderRuleDomains({ jobId: "hls-header-fail-test" }, [
        "https://segment-cdn.example.test/seg.ts"
      ]),
      /DNR failed/
    );
    assert.equal(sent, 1);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalSendMessage = chrome.runtime.sendMessage;
  let sent = 0;
  chrome.runtime.sendMessage = async () => {
    sent += 1;
    return { updated: false, domains: [] };
  };

  try {
    await context.updateMediaHeaderRuleDomains({ jobId: "hls-public-no-session-test" }, [
      "https://public-cdn.example.test/seg.ts"
    ]);
    assert.equal(sent, 1);
  } finally {
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const sent = [];
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    if (href === "https://cdn.example.test/master.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=128000
https://variant-cdn.example.test/audio.m3u8`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href === "https://variant-cdn.example.test/audio.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://key-cdn.example.test/key.bin"
#EXT-X-MAP:URI="https://map-cdn.example.test/init.mp4"
#EXTINF:4.000,
https://segment-cdn.example.test/seg-000.m4s
#EXT-X-ENDLIST`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      headers: { get: () => "video/mp4" }
    };
  };
  context.requestWebFfmpeg = async payload => ({
    file: {
      name: payload.outputName,
      mime: "audio/mpeg",
      buffer: Uint8Array.from([7, 8]).buffer
    },
    bytes: 2
  });
  chrome.runtime.sendMessage = async message => {
    sent.push(JSON.parse(JSON.stringify(message)));
    return { domains: testDomainsFromUrls(message.urls) };
  };

  try {
    await context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-cross-domain-header-test",
      sourceUrl: "https://cdn.example.test/master.m3u8",
      cacheNamespace: "hls-cross-domain-header-test",
      asrChunkSeconds: 900
    });
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }

  const domainUpdates = sent
    .filter(message => message.type === "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS")
    .map(message => message.urls);
  assert.deepEqual(domainUpdates, [
    ["https://cdn.example.test/"],
    ["https://variant-cdn.example.test/"],
    [
      "https://key-cdn.example.test/",
      "https://map-cdn.example.test/",
      "https://segment-cdn.example.test/"
    ]
  ]);
}

{
  const originalFetch = context.fetch;
  const originalRequestWebFfmpeg = context.requestWebFfmpeg;
  const originalCaches = context.caches;
  const originalResponse = context.Response;
  const originalSendMessage = chrome.runtime.sendMessage;
  const fetchedSegments = [];
  let ffmpegCalls = 0;
  let firstFfmpegResolve = null;
  const cache = new Map();
  context.Response = class {
    constructor(body) {
      this.body = body;
    }

    async arrayBuffer() {
      return this.body;
    }
  };
  context.caches = {
    open: async () => ({
      put: async (url, response) => cache.set(url, response),
      match: async url => cache.get(url) || null,
      delete: async url => cache.delete(url)
    })
  };
  context.fetch = async url => {
    const href = String(url);
    if (href === "https://cdn.example.test/two-groups.m3u8") {
      return {
        ok: true,
        text: async () => `#EXTM3U
#EXTINF:180.000,
https://segment-cdn.example.test/seg-000.ts
#EXTINF:180.000,
https://segment-cdn.example.test/seg-001.ts
#EXT-X-ENDLIST`,
        arrayBuffer: async () => Uint8Array.from([]).buffer,
        headers: { get: () => "application/vnd.apple.mpegurl" }
      };
    }
    if (href.includes("seg-")) {
      fetchedSegments.push(href);
    }
    return {
      ok: true,
      status: 200,
      text: async () => "",
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      headers: { get: () => "video/mp2t" }
    };
  };
  context.requestWebFfmpeg = async payload => {
    ffmpegCalls += 1;
    if (ffmpegCalls === 1) {
      return await new Promise(resolve => {
        firstFfmpegResolve = () => resolve({
          file: { name: payload.outputName, mime: "audio/mpeg", buffer: Uint8Array.from([7, 8]).buffer },
          bytes: 2
        });
      });
    }
    return {
      file: { name: payload.outputName, mime: "audio/mpeg", buffer: Uint8Array.from([9, 10]).buffer },
      bytes: 2
    };
  };
  chrome.runtime.sendMessage = async message => ({ domains: testDomainsFromUrls(message.urls) });
  try {
    const extractionPromise = context.extractHlsAudioWithWebFfmpeg({
      tabId: 3,
      jobId: "hls-next-group-prefetch-test",
      sourceUrl: "https://cdn.example.test/two-groups.m3u8",
      cacheNamespace: "hls-next-group-prefetch-test",
      asrChunkSeconds: 180
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(ffmpegCalls, 1);
    assert.ok(
      fetchedSegments.some(url => url.endsWith("seg-001.ts")),
      `expected next HLS group to prefetch while first group is in FFmpeg, got ${JSON.stringify(fetchedSegments)}`
    );
    firstFfmpegResolve();
    await extractionPromise;
  } finally {
    context.fetch = originalFetch;
    context.requestWebFfmpeg = originalRequestWebFfmpeg;
    context.caches = originalCaches;
    context.Response = originalResponse;
    chrome.runtime.sendMessage = originalSendMessage;
  }
}

{
  const originalFetch = context.fetch;
  let active = 0;
  let maxActive = 0;
  const completed = [];
  context.fetch = async url => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    const match = String(url).match(/seg-(\d+)\.ts$/);
    const index = match ? Number(match[1]) : 0;
    await new Promise(resolve => setTimeout(resolve, 20 - index));
    active -= 1;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "video/mp2t" },
      arrayBuffer: async () => Uint8Array.from([index]).buffer
    };
  };
  try {
    const result = await context.downloadHlsSegmentsForGroup({
      segments: Array.from({ length: 8 }, (_, index) => ({
        start: index,
        end: index + 1,
        duration: 1,
        url: `https://cdn.example.test/seg-${index}.ts`
      }))
    }, {}, 7, progress => completed.push(progress.completed));
    assert.equal(maxActive, 8);
    assert.equal(JSON.stringify(result.map(item => item.itemIndex)), JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]));
    assert.equal(JSON.stringify(result.map(item => item.segmentFile.name)), JSON.stringify([
      "seg-7-00000.ts",
      "seg-7-00001.ts",
      "seg-7-00002.ts",
      "seg-7-00003.ts",
      "seg-7-00004.ts",
      "seg-7-00005.ts",
      "seg-7-00006.ts",
      "seg-7-00007.ts"
    ]));
    assert.equal(completed.at(-1), 8);
  } finally {
    context.fetch = originalFetch;
  }
}

{
  assert.equal(
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 0, length: 100, endExclusive: 100 }
    }),
    "https://cdn.example.test/range.mp4#0-100"
  );
  assert.equal(
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 100, length: 120, endExclusive: 220 }
    }),
    "https://cdn.example.test/range.mp4#100-220"
  );
  assert.notEqual(
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 0, length: 100, endExclusive: 100 }
    }),
    context.hlsSegmentDownloadIdentity({
      url: "https://cdn.example.test/range.mp4",
      byteRange: { offset: 100, length: 120, endExclusive: 220 }
    })
  );
}

{
  const originalFetch = context.fetch;
  let active = 0;
  let maxActive = 0;
  context.fetch = async url => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    const match = String(url).match(/(?:key|init)-(\d+)/);
    const index = match ? Number(match[1]) : 0;
    await new Promise(resolve => setTimeout(resolve, 20 - index));
    active -= 1;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/octet-stream" },
      arrayBuffer: async () => Uint8Array.from([index]).buffer
    };
  };
  try {
    const segments = Array.from({ length: 8 }, (_, index) => ({
      start: index,
      end: index + 1,
      duration: 1,
      url: `https://cdn.example.test/s${index}.m4s`,
      map: {
        id: `map-${index}`,
        url: `https://cdn.example.test/init-${index}.mp4`
      },
      key: {
        id: `key-${index}`,
        method: "AES-128",
        uri: `https://cdn.example.test/key-${index}.bin`
      }
    }));
    const keyNames = new Map();
    const mapNames = new Map();
    const keyFiles = await context.downloadHlsKeysForGroup({ segments }, {}, 3, keyNames);
    const mapFiles = await context.downloadHlsMapsForGroup({ segments }, {}, 3, mapNames);
    assert.equal(maxActive, 8);
    assert.equal(JSON.stringify(keyFiles.map(file => file.name)), JSON.stringify([
      "key-3-0.key",
      "key-3-1.key",
      "key-3-2.key",
      "key-3-3.key",
      "key-3-4.key",
      "key-3-5.key",
      "key-3-6.key",
      "key-3-7.key"
    ]));
    assert.equal(JSON.stringify(mapFiles.map(file => file.name)), JSON.stringify([
      "map-3-0.mp4",
      "map-3-1.mp4",
      "map-3-2.mp4",
      "map-3-3.mp4",
      "map-3-4.mp4",
      "map-3-5.mp4",
      "map-3-6.mp4",
      "map-3-7.mp4"
    ]));
  } finally {
    context.fetch = originalFetch;
  }
}

{
  const segments = Array.from({ length: 6 }, (_, index) => ({
    start: index * 5,
    end: (index + 1) * 5,
    duration: 5,
    url: `https://cdn.example.test/s${index}.m4s`,
    map: {
      id: `map-${index}`,
      url: `https://cdn.example.test/init-${index}.mp4`
    },
    key: {
      id: `key-${index}`,
      method: "AES-128",
      uri: `https://cdn.example.test/key-${index}.bin`
    }
  }));
  const groups = context.groupHlsSegments(segments, { maxDurationSeconds: 60, maxSegments: 60 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].segments.length, 6);
}

{
  const segments = Array.from({ length: 80 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/seg-${index}.ts`
  }));
  const extractGroups = context.groupHlsSegments(segments, {
    maxDurationSeconds: 60,
    maxSegments: 60
  });
  assert.equal(extractGroups[0].segments.length, 60);
  const overlapped = context.addHlsAsrContextOverlapToGroups(extractGroups, segments, 8);
  assert.equal(overlapped[0].segments.length, 60);
  assert.equal(overlapped[1].segments.length, 28);
}

{
  const segments = Array.from({ length: 40 }, (_, index) => ({
    start: index,
    end: index + 1,
    duration: 1,
    url: `https://cdn.example.test/default-overlap-${index}.ts`
  }));
  const groups = context.groupHlsSegments(segments, {
    maxDurationSeconds: 20,
    maxSegments: 20
  });
  const overlapped = context.addHlsAsrContextOverlapToGroups(groups, segments);
  assert.equal(overlapped[0].start, 0);
  assert.equal(overlapped[0].coreEnd, 20);
  assert.equal(overlapped[0].end, 28);
  assert.equal(overlapped[1].start, 12);
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
  const genericUrls = context.buildLikelyAudioCompanionPlaylistUrls(
    "https://media.example.test/sample-hls/720p/video.m3u8"
  );
  assert.equal(JSON.stringify(genericUrls.slice(0, 4)), JSON.stringify([
    "https://media.example.test/sample-hls/720p/audio.m3u8",
    "https://media.example.test/sample-hls/audio/audio.m3u8",
    "https://media.example.test/sample-hls/audio/index.m3u8",
    "https://media.example.test/sample-hls/audio/playlist.m3u8"
  ]));
}

{
  const state = context.createHlsLogicalChunkState(900);
  assert.equal(state.logicalChunkSeconds, 900);
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
  const state = context.createHlsLogicalChunkState(900);
  const first = context.collectHlsLogicalPartGroups(state, {
    index: 0,
    start: 0,
    end: 30,
    duration: 30,
    speechIntervals: [{ start: 2, end: 8 }],
    file: { name: "speech-a.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/speech-a" }
  });
  assert.equal(first.length, 0);
  const skippedSilence = context.collectHlsLogicalPartGroups(state, {
    index: 1,
    start: 30,
    end: 60,
    duration: 30,
    speechIntervals: [],
    file: { name: "silence.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/silence" }
  });
  assert.equal(skippedSilence.length, 1);
  assert.equal(skippedSilence[0].length, 1);
  assert.equal(skippedSilence[0][0].index, 0);
  const splitAtVadGap = context.collectHlsLogicalPartGroups(state, {
    index: 2,
    start: 60,
    end: 90,
    duration: 30,
    speechIntervals: [{ start: 70, end: 76 }],
    file: { name: "speech-b.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/speech-b" }
  });
  assert.equal(splitAtVadGap.length, 0);
  const tail = context.collectHlsLogicalPartGroups(state, null, true);
  assert.equal(tail.length, 1);
  assert.equal(tail[0].length, 1);
  assert.equal(tail[0][0].index, 2);
}

{
  const state = context.createHlsLogicalChunkState(900);
  const first = context.collectHlsLogicalPartGroups(state, {
    index: 0,
    start: 0,
    end: 33,
    coreStart: 0,
    coreEnd: 30,
    duration: 33,
    file: { name: "overlap-0.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/overlap-0" }
  });
  const second = context.collectHlsLogicalPartGroups(state, {
    index: 1,
    start: 27,
    end: 63,
    coreStart: 30,
    coreEnd: 60,
    duration: 36,
    file: { name: "overlap-1.mp3", mime: "audio/mpeg", cacheUrl: "https://fuguang.local/overlap-1" }
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].length, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].length, 1);
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
