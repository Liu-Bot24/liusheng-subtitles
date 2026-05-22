const MESSAGE = {
  OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  OFFSCREEN_WEB_FFMPEG_PROGRESS: "FUGUANG_OFFSCREEN_WEB_FFMPEG_PROGRESS",
  OFFSCREEN_WEB_FFMPEG_CHUNK_READY: "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY"
};

const WEB_FFMPEG_APP = "fuguang-web-ffmpeg";
const WEB_FFMPEG_CACHE_VERSION = "20260522-webffmpeg-perf";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS = 180;
const WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK = 60;
const WEB_FFMPEG_HLS_CONCAT_MAX_SEGMENTS_PER_CHUNK = 360;
const WEB_FFMPEG_READY_TIMEOUT_MS = 30 * 1000;
const WEB_FFMPEG_IDLE_TIMEOUT_MS = 120 * 1000;
const WEB_FFMPEG_ABSOLUTE_TIMEOUT_MS = 30 * 60 * 1000;
let webFfmpegFrame = null;
let webFfmpegReady = null;
const webFfmpegPending = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE.OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO) {
    extractAudioWithWebFfmpeg(message)
      .then(result => sendResponse({ ok: true, result }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});

window.addEventListener("message", event => {
  const message = event.data || {};
  if (message.app !== WEB_FFMPEG_APP || !message.type) {
    return;
  }
  if (!webFfmpegFrame) {
    return;
  }
  if (webFfmpegFrame?.iframe && event.source !== webFfmpegFrame.iframe.contentWindow) {
    return;
  }
  if (webFfmpegFrame?.origin && event.origin !== webFfmpegFrame.origin) {
    return;
  }
  if (message.type === "ready" || message.type === "loaded") {
    webFfmpegFrame.ready = true;
    webFfmpegFrame.resolveReady?.();
    return;
  }
  const pending = webFfmpegPending.get(message.id);
  if (!pending) {
    return;
  }
  if (message.type === "result") {
    webFfmpegPending.delete(message.id);
    pending.clear?.();
    pending.resolve(message.result);
  }
  if (message.type === "progress") {
    pending.onProgress?.(message);
  }
  if (message.type === "error") {
    webFfmpegPending.delete(message.id);
    pending.clear?.();
    pending.reject(new Error(message.error || "Web FFmpeg 返回错误。"));
  }
});

async function extractAudioWithWebFfmpeg(message) {
  const sourceUrl = String(message.sourceUrl || "");
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error("媒体源地址不是有效的 HTTP 地址。");
  }
  reportWebFfmpegExtractionProgress(message, {
    phase: "loading",
    percent: 1,
    message: "正在准备 Web FFmpeg"
  });
  await ensureWebFfmpegFrame(message.webFfmpegUrl);
  warmWebFfmpegFrame();
  if (isHlsSource(message)) {
    return extractHlsAudioWithWebFfmpeg(message);
  }
  reportWebFfmpegExtractionProgress(message, {
    phase: "download",
    percent: 5,
    message: "正在下载媒体文件"
  });
  const response = await fetch(sourceUrl, buildMediaFetchOptions(message));
  if (!response.ok) {
    throw new Error(`媒体文件下载失败：HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  reportWebFfmpegExtractionProgress(message, {
    phase: "ffmpeg",
    percent: 50,
    message: "媒体文件已下载，正在提取音频"
  });
  const id = `extract-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await requestWebFfmpeg({
    app: WEB_FFMPEG_APP,
    type: "extract-audio",
    id,
    file: {
      name: message.fileName || "media.bin",
      mime: message.mime || response.headers.get("content-type") || "",
      buffer
    },
    options: {
      format: "mp3",
      chunkSeconds: message.asrChunkSeconds || message.chunkSeconds,
      duration: message.duration
    }
  }, [buffer], progress => {
    reportWebFfmpegExtractionProgress(message, {
      phase: "ffmpeg",
      percent: 50 + (Number(progress.percent || 0) * 0.49),
      message: "正在用 Web FFmpeg 提取音频"
    });
  });
  return persistWebFfmpegAudioResult(result, message.cacheNamespace || id);
}

async function extractHlsAudioWithWebFfmpeg(message) {
  const fetchOptions = buildMediaFetchOptions(message);
  const logicalChunkSeconds = Math.max(10, Number(message.asrChunkSeconds || message.chunkSeconds || 900) || 900);
  let playlistUrl = message.sourceUrl;
  let playlistText = "";
  const companion = await fetchLikelyAudioCompanionPlaylist(playlistUrl, fetchOptions);
  if (companion) {
    playlistUrl = companion.url;
    playlistText = companion.text;
  } else {
    playlistText = await fetchText(playlistUrl, fetchOptions);
  }
  const master = parseHlsMasterPlaylist(playlistText, playlistUrl);
  if (master.variants.length) {
    const variant = chooseHlsVariantForAsr(master.variants);
    playlistUrl = variant.url;
    playlistText = await fetchText(playlistUrl, fetchOptions);
  }
  const media = parseHlsMediaPlaylist(playlistText, playlistUrl);
  if (media.unsupportedEncryption) {
    throw new Error(`当前 HLS 使用 ${media.unsupportedEncryption} 加密，浏览器内 Web FFmpeg 暂不能预处理。`);
  }
  if (!media.segments.length) {
    throw new Error("HLS 播放列表里没有可下载的媒体切片。");
  }
  const groups = groupHlsSegments(media.segments, {
    maxDurationSeconds: Math.min(WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS, logicalChunkSeconds),
    maxSegments: hlsMaxSegmentsPerExtractChunk(media)
  });
  reportWebFfmpegExtractionProgress(message, {
    phase: "playlist",
    percent: 3,
    internalChunksDone: 0,
    internalChunksTotal: groups.length,
    downloadedSegments: 0,
    totalSegments: media.segments.length,
    readySeconds: 0,
    message: `已解析播放列表，共 ${media.segments.length} 个媒体切片，准备生成 ${groups.length} 个内部音频切片`
  });
  const internalChunks = [];
  const logicalState = createHlsLogicalChunkState(logicalChunkSeconds);
  const logicalChunks = [];
  let bytes = 0;
  let downloadedSegments = 0;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    reportWebFfmpegExtractionProgress(message, {
      phase: "download",
      percent: hlsExtractionPercent(index, 0, groups.length),
      internalChunksDone: index,
      internalChunksTotal: groups.length,
      downloadedSegments,
      totalSegments: media.segments.length,
      readySeconds: internalChunksReadySeconds(internalChunks),
      message: `正在下载第 ${index + 1}/${groups.length} 个内部音频切片`
    });
    const files = [];
    const transfer = [];
    let initName = "";
    if (media.mapUrl) {
      initName = `init-${index}.mp4`;
      const initBuffer = await fetchBinary(media.mapUrl, fetchOptions);
      files.push({ name: initName, mime: "video/mp4", buffer: initBuffer });
      transfer.push(initBuffer);
    }
    const keyNames = new Map();
    const keyFiles = await downloadHlsKeysForGroup(group, fetchOptions, index, keyNames);
    for (const keyFile of keyFiles) {
      files.push(keyFile);
      transfer.push(keyFile.buffer);
    }
    const playlistSegments = [];
    const segmentBuffers = [];
    const useConcatenatedTransport = canUseConcatenatedHlsTransportStream(media, keyFiles);
    for (let itemIndex = 0; itemIndex < group.segments.length; itemIndex += 1) {
      const segment = group.segments[itemIndex];
      const segmentBuffer = await fetchBinary(segment.url, fetchOptions);
      downloadedSegments += 1;
      const segmentName = `seg-${index}-${String(itemIndex).padStart(5, "0")}.${guessHlsSegmentExtension(segment.url)}`;
      if (useConcatenatedTransport) {
        segmentBuffers.push(segmentBuffer);
      } else {
        files.push({ name: segmentName, mime: "video/mp2t", buffer: segmentBuffer });
        transfer.push(segmentBuffer);
        playlistSegments.push({ ...segment, name: segmentName });
      }
      if (itemIndex === 0 || (itemIndex + 1) % 5 === 0 || itemIndex === group.segments.length - 1) {
        reportWebFfmpegExtractionProgress(message, {
          phase: "download",
          percent: hlsExtractionPercent(index, (itemIndex + 1) / group.segments.length * 0.55, groups.length),
          internalChunksDone: index,
          internalChunksTotal: groups.length,
          downloadedSegments,
          totalSegments: media.segments.length,
          readySeconds: internalChunksReadySeconds(internalChunks),
          message: `下载第 ${index + 1}/${groups.length} 组：${itemIndex + 1}/${group.segments.length} 个媒体切片`
        });
      }
    }
    const ffmpegInput = buildHlsFfmpegInput({
      index,
      media,
      keyFiles,
      playlistSegments,
      segmentBuffers,
      initName,
      keyNames
    });
    for (let fileIndex = ffmpegInput.files.length - 1; fileIndex >= 0; fileIndex -= 1) {
      files.unshift(ffmpegInput.files[fileIndex]);
      transfer.unshift(ffmpegInput.files[fileIndex].buffer);
    }
    const inputName = ffmpegInput.inputName;
    const result = await requestWebFfmpeg({
      app: WEB_FFMPEG_APP,
      type: "extract-audio",
      id: `extract-hls-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      inputName,
      outputName: `chunk-${String(index + 1).padStart(3, "0")}.mp3`,
      files,
      options: { format: "mp3" }
    }, transfer, progress => {
      reportWebFfmpegExtractionProgress(message, {
        phase: "ffmpeg",
        percent: hlsExtractionPercent(index, 0.55 + (Number(progress.percent || 0) / 100) * 0.35, groups.length),
        internalChunksDone: index,
        internalChunksTotal: groups.length,
        downloadedSegments,
        totalSegments: media.segments.length,
        readySeconds: internalChunksReadySeconds(internalChunks),
        message: progress.message
          ? `第 ${index + 1}/${groups.length} 个内部音频切片：${progress.message}`
          : `正在转码第 ${index + 1}/${groups.length} 个内部音频切片`
      });
    });
    const rawAudioBuffer = result?.file?.buffer instanceof ArrayBuffer ? result.file.buffer : null;
    const persisted = await persistWebFfmpegAudioResult(result, `${message.cacheNamespace || "hls"}-${index}`);
    const internalChunk = {
      index,
      start: group.start,
      end: group.end,
      duration: group.end - group.start,
      file: persisted.file,
      buffer: rawAudioBuffer,
      bytes: persisted.bytes || persisted.file?.bytes || 0
    };
    internalChunks.push(internalChunk);
    bytes += persisted.bytes || persisted.file?.bytes || 0;
    const readyGroups = collectHlsLogicalPartGroups(logicalState, internalChunk, false);
    for (const parts of readyGroups) {
      const logicalChunk = await buildHlsLogicalAudioChunk(message, logicalState.nextIndex, parts, groups.length);
      logicalState.nextIndex += 1;
      logicalChunks.push(logicalChunk);
      await reportWebFfmpegChunkReady(message, logicalChunk, {
        duration: media.duration,
        logicalChunkSeconds,
        internalChunksDone: index + 1,
        internalChunksTotal: groups.length
      });
    }
    reportWebFfmpegExtractionProgress(message, {
      phase: "ready",
      percent: hlsExtractionPercent(index, 1, groups.length),
      internalChunksDone: index + 1,
      internalChunksTotal: groups.length,
      downloadedSegments,
      totalSegments: media.segments.length,
      readySeconds: internalChunksReadySeconds(internalChunks),
      message: `已生成 ${index + 1}/${groups.length} 个内部音频切片`
    });
  }
  const tailGroups = collectHlsLogicalPartGroups(logicalState, null, true);
  for (const parts of tailGroups) {
    const logicalChunk = await buildHlsLogicalAudioChunk(message, logicalState.nextIndex, parts, groups.length);
    logicalState.nextIndex += 1;
    logicalChunks.push(logicalChunk);
    await reportWebFfmpegChunkReady(message, logicalChunk, {
      duration: media.duration,
      logicalChunkSeconds,
      internalChunksDone: groups.length,
      internalChunksTotal: groups.length
    });
  }
  return {
    chunks: logicalChunks,
    bytes,
    duration: media.duration,
    chunkSeconds: logicalChunkSeconds,
    asrChunkSeconds: logicalChunkSeconds,
    extractChunkSeconds: WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS,
    internalChunkCount: internalChunks.length,
    sourceType: "hls"
  };
}

function createHlsLogicalChunkState(logicalChunkSeconds) {
  return {
    logicalChunkSeconds: Math.max(1, Number(logicalChunkSeconds || 900) || 900),
    pendingParts: [],
    pendingStart: 0,
    pendingEnd: 0,
    nextIndex: 0
  };
}

function collectHlsLogicalPartGroups(state, chunk, final = false) {
  const ready = [];
  const pushPending = () => {
    if (!state.pendingParts.length) {
      return;
    }
    ready.push(state.pendingParts);
    state.pendingParts = [];
    state.pendingStart = 0;
    state.pendingEnd = 0;
  };

  if (chunk) {
    const chunkDuration = Math.max(0, Number(chunk.duration || (chunk.end - chunk.start) || 0) || 0);
    const pendingDuration = state.pendingParts.length
      ? Math.max(0, Number(state.pendingEnd || 0) - Number(state.pendingStart || 0))
      : 0;
    if (state.pendingParts.length && pendingDuration + chunkDuration > state.logicalChunkSeconds) {
      pushPending();
    }
    if (!state.pendingParts.length) {
      state.pendingStart = chunk.start;
      state.pendingEnd = chunk.start;
    }
    state.pendingParts.push(chunk);
    state.pendingEnd = chunk.end;
    if (Math.max(0, Number(state.pendingEnd || 0) - Number(state.pendingStart || 0)) >= state.logicalChunkSeconds) {
      pushPending();
    }
  }
  if (final) {
    pushPending();
  }
  return ready;
}

async function buildHlsLogicalAudioChunk(message, index, parts, groupCount) {
  const normalizedParts = (parts || []).filter(part => part?.file);
  const start = Number(normalizedParts[0]?.start || 0) || 0;
  const end = Number(normalizedParts[normalizedParts.length - 1]?.end || start) || start;
  const duration = Math.max(0, end - start);
  if (normalizedParts.length === 1) {
    const part = normalizedParts[0];
    return {
      logical: true,
      index,
      start,
      end,
      duration,
      file: part.file,
      bytes: part.bytes || part.file?.bytes || 0,
      internalChunkCount: 1
    };
  }
  reportWebFfmpegExtractionProgress(message, {
    phase: "concat",
    percent: hlsExtractionPercent(Math.min(groupCount - 1, normalizedParts.at(-1)?.index || 0), 0.96, groupCount),
    internalChunksDone: normalizedParts.at(-1)?.index + 1 || 0,
    internalChunksTotal: groupCount,
    readySeconds: Math.round(end),
    message: `正在合并第 ${index + 1} 个识别音频切片`
  });
  const files = [];
  const transfer = [];
  for (let partIndex = 0; partIndex < normalizedParts.length; partIndex += 1) {
    const part = normalizedParts[partIndex];
    const buffer = part.buffer instanceof ArrayBuffer
      ? part.buffer
      : await readPersistedWebFfmpegAudioFile(part.file);
    const name = `logical-${index + 1}-part-${String(partIndex + 1).padStart(3, "0")}.mp3`;
    files.push({ name, mime: "audio/mpeg", buffer });
    transfer.push(buffer);
  }
  const result = await requestWebFfmpeg({
    app: WEB_FFMPEG_APP,
    type: "concat-audio",
    id: `concat-hls-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    outputName: `logical-${String(index + 1).padStart(3, "0")}.mp3`,
    files,
    options: { format: "mp3" }
  }, transfer, progress => {
    reportWebFfmpegExtractionProgress(message, {
      phase: "concat",
      percent: hlsExtractionPercent(Math.min(groupCount - 1, normalizedParts.at(-1)?.index || 0), 0.96 + (Number(progress.percent || 0) / 100) * 0.03, groupCount),
      internalChunksDone: normalizedParts.at(-1)?.index + 1 || 0,
      internalChunksTotal: groupCount,
      readySeconds: Math.round(end),
      message: progress.message
        ? `第 ${index + 1} 个识别音频切片：${progress.message}`
        : `正在合并第 ${index + 1} 个识别音频切片`
    });
  });
  const persisted = await persistWebFfmpegAudioResult(result, `${message.cacheNamespace || "hls"}-logical-${index}`);
  await deletePersistedWebFfmpegAudioFiles(normalizedParts.map(part => part.file));
  return {
    logical: true,
    index,
    start,
    end,
    duration,
    file: persisted.file,
    bytes: persisted.bytes || persisted.file?.bytes || 0,
    internalChunkCount: normalizedParts.length
  };
}

async function readPersistedWebFfmpegAudioFile(file) {
  if (!file?.cacheUrl) {
    throw new Error("内部音频切片缺少缓存地址，无法合并。");
  }
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  const response = await cache.match(file.cacheUrl);
  if (!response) {
    throw new Error("内部音频缓存已失效，无法合并。");
  }
  return response.arrayBuffer();
}

async function deletePersistedWebFfmpegAudioFiles(files) {
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  await Promise.all((files || []).map(file => file?.cacheUrl ? cache.delete(file.cacheUrl) : false));
}

async function persistWebFfmpegAudioResult(result, namespace) {
  if (!result || typeof result !== "object") {
    return result || {};
  }
  const safeNamespace = safeCachePathPart(namespace || `extract-${Date.now()}`);
  const cache = await caches.open(WEB_FFMPEG_AUDIO_CACHE);
  if (result.file?.buffer instanceof ArrayBuffer) {
    const file = await persistWebFfmpegAudioFile(cache, result.file, safeNamespace, "audio");
    return {
      ...result,
      file,
      bytes: result.bytes || file.bytes || 0
    };
  }
  if (Array.isArray(result.chunks)) {
    let bytes = 0;
    const chunks = [];
    for (const chunk of result.chunks) {
      if (!(chunk?.file?.buffer instanceof ArrayBuffer)) {
        chunks.push(chunk);
        bytes += Number(chunk?.bytes || chunk?.file?.bytes || 0) || 0;
        continue;
      }
      const file = await persistWebFfmpegAudioFile(
        cache,
        chunk.file,
        safeNamespace,
        `chunk-${Number.isInteger(chunk.index) ? chunk.index : chunks.length}`
      );
      chunks.push({
        ...chunk,
        file,
        bytes: chunk.bytes || file.bytes || 0
      });
      bytes += chunk.bytes || file.bytes || 0;
    }
    return {
      ...result,
      chunks,
      bytes: result.bytes || bytes
    };
  }
  return result;
}

async function persistWebFfmpegAudioFile(cache, file, namespace, fallbackName) {
  const buffer = file.buffer;
  const name = String(file.name || `${fallbackName}.mp3`);
  const mime = String(file.mime || "audio/mpeg");
  const cacheUrl = new URL(
    `${WEB_FFMPEG_AUDIO_CACHE_PREFIX}/${namespace}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeCachePathPart(name)}`,
    WEB_FFMPEG_AUDIO_CACHE_ORIGIN
  ).href;
  await cache.put(cacheUrl, new Response(buffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "no-store"
    }
  }));
  return {
    name,
    mime,
    cacheUrl,
    bytes: buffer.byteLength
  };
}

function safeCachePathPart(value) {
  return String(value || "item")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "item";
}

function isHlsSource(message) {
  const url = String(message.sourceUrl || "").toLowerCase();
  const mime = String(message.mime || "").toLowerCase();
  return (
    message.kind === "hls" ||
    message.ext === "m3u8" ||
    /\.m3u8(?:$|[?#])/i.test(url) ||
    mime.includes("mpegurl") ||
    mime.includes("vnd.apple.mpegurl")
  );
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HLS 播放列表下载失败：HTTP ${response.status}`);
  }
  return response.text();
}

async function fetchBinary(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`媒体切片下载失败：HTTP ${response.status}`);
  }
  return response.arrayBuffer();
}

async function fetchLikelyAudioCompanionPlaylist(sourceUrl, fetchOptions) {
  for (const url of buildLikelyAudioCompanionPlaylistUrls(sourceUrl)) {
    const text = await fetchText(url, fetchOptions).catch(() => "");
    if (!text) {
      continue;
    }
    const master = parseHlsMasterPlaylist(text, url);
    if (master.variants.some(variant => variant.audioOnly)) {
      return { url, text };
    }
    const media = parseHlsMediaPlaylist(text, url);
    if (media.segments.length) {
      return { url, text };
    }
  }
  return null;
}

function buildLikelyAudioCompanionPlaylistUrls(sourceUrl) {
  const output = [];
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return output;
  }
  if (!/(^|\.)video\.twimg\.com$/i.test(url.hostname)) {
    return output;
  }
  const avcMatch = url.pathname.match(/^(.*\/pl\/)avc1\/[^/]+\/([^/]+\.m3u8)$/i);
  if (!avcMatch) {
    return output;
  }
  for (const bitrate of ["128000", "64000", "32000"]) {
    const next = new URL(url.href);
    next.pathname = `${avcMatch[1]}mp4a/${bitrate}/${avcMatch[2]}`;
    output.push(next.href);
  }
  return output;
}

function parseHlsMasterPlaylist(text, baseUrl) {
  const lines = splitHlsLines(text);
  const variants = [];
  const audioMedia = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("#EXT-X-MEDIA:")) {
      const attrs = parseHlsAttributes(line.slice("#EXT-X-MEDIA:".length));
      if (String(attrs.TYPE || "").toUpperCase() === "AUDIO" && attrs.URI) {
        audioMedia.push({
          url: resolveHlsUrl(attrs.URI, baseUrl),
          bandwidth: 0,
          audioOnly: true
        });
      }
      continue;
    }
    if (!line.startsWith("#EXT-X-STREAM-INF:")) {
      continue;
    }
    const attrs = parseHlsAttributes(line.slice("#EXT-X-STREAM-INF:".length));
    const uri = nextHlsUri(lines, index + 1);
    if (!uri) {
      continue;
    }
    variants.push({
      url: resolveHlsUrl(uri, baseUrl),
      bandwidth: Number(attrs.BANDWIDTH || attrs["AVERAGE-BANDWIDTH"] || 0) || 0,
      resolution: String(attrs.RESOLUTION || ""),
      audioOnly: false
    });
  }
  return { variants: [...audioMedia, ...variants] };
}

function parseHlsMediaPlaylist(text, baseUrl) {
  const lines = splitHlsLines(text);
  const segments = [];
  let mapUrl = "";
  let pendingDuration = 0;
  let currentKey = null;
  let unsupportedEncryption = "";
  for (const line of lines) {
    if (line.startsWith("#EXT-X-KEY:")) {
      const attrs = parseHlsAttributes(line.slice("#EXT-X-KEY:".length));
      const method = String(attrs.METHOD || "").toUpperCase();
      if (!method || method === "NONE") {
        currentKey = null;
        continue;
      }
      if (method !== "AES-128" || !attrs.URI) {
        unsupportedEncryption = method || "未知";
        currentKey = null;
        continue;
      }
      currentKey = {
        id: `${method}:${resolveHlsUrl(attrs.URI, baseUrl)}:${attrs.IV || ""}`,
        method,
        uri: resolveHlsUrl(attrs.URI, baseUrl),
        iv: attrs.IV || ""
      };
      continue;
    }
    if (line.startsWith("#EXT-X-MAP:")) {
      const attrs = parseHlsAttributes(line.slice("#EXT-X-MAP:".length));
      if (attrs.URI) {
        mapUrl = resolveHlsUrl(attrs.URI, baseUrl);
      }
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      pendingDuration = Number.parseFloat(line.slice("#EXTINF:".length).split(",")[0]) || 0;
      continue;
    }
    if (line || line.startsWith("#")) {
      if (!line.startsWith("#")) {
        segments.push({
          url: resolveHlsUrl(line, baseUrl),
          duration: pendingDuration || 0,
          key: currentKey
        });
        pendingDuration = 0;
      }
    }
  }
  let cursor = 0;
  for (const segment of segments) {
    segment.start = cursor;
    cursor += segment.duration || 0;
    segment.end = cursor;
  }
  return { segments, mapUrl, unsupportedEncryption, duration: cursor };
}

function splitHlsLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function nextHlsUri(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#")) {
      return lines[index];
    }
  }
  return "";
}

function parseHlsAttributes(value) {
  const attrs = {};
  const pattern = /([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/gi;
  let match;
  while ((match = pattern.exec(value))) {
    attrs[match[1].toUpperCase()] = String(match[2] || "").replace(/^"|"$/g, "");
  }
  return attrs;
}

function resolveHlsUrl(value, baseUrl) {
  return new URL(String(value || ""), baseUrl).href;
}

function chooseHlsVariantForAsr(variants) {
  return [...variants].sort((a, b) => {
    if (a.audioOnly !== b.audioOnly) {
      return a.audioOnly ? -1 : 1;
    }
    return (a.bandwidth || Number.MAX_SAFE_INTEGER) - (b.bandwidth || Number.MAX_SAFE_INTEGER) ||
      hlsResolutionPixels(a.resolution) - hlsResolutionPixels(b.resolution);
  })[0];
}

function hlsResolutionPixels(resolution) {
  const match = String(resolution || "").match(/(\d+)x(\d+)/i);
  return match ? Number(match[1]) * Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

function groupHlsSegments(segments, options = {}) {
  const maxDurationSeconds = typeof options === "number"
    ? Number(options)
    : Number(options.maxDurationSeconds || options.chunkSeconds || 0);
  const maxSegments = typeof options === "number"
    ? Number.MAX_SAFE_INTEGER
    : Math.max(1, Math.floor(Number(options.maxSegments || Number.MAX_SAFE_INTEGER) || Number.MAX_SAFE_INTEGER));
  const groups = [];
  let current = [];
  let currentStart = segments[0]?.start || 0;
  let currentEnd = currentStart;
  for (const segment of segments) {
    const nextDuration = currentEnd - currentStart + (segment.duration || 0);
    const exceedsDuration = maxDurationSeconds > 0 && nextDuration > maxDurationSeconds;
    const exceedsSegmentCount = current.length >= maxSegments;
    if (current.length && (exceedsDuration || exceedsSegmentCount)) {
      groups.push({ start: currentStart, end: currentEnd, segments: current });
      current = [];
      currentStart = segment.start;
    }
    current.push(segment);
    currentEnd = segment.end;
  }
  if (current.length) {
    groups.push({ start: currentStart, end: currentEnd, segments: current });
  }
  return groups;
}

function hlsExtractionPercent(groupIndex, groupLocalRatio, groupCount) {
  const count = Math.max(1, Number(groupCount) || 1);
  const local = Math.max(0, Math.min(1, Number(groupLocalRatio) || 0));
  return Math.max(3, Math.min(99, Math.round((3 + ((groupIndex + local) / count) * 96) * 10) / 10));
}

function internalChunksReadySeconds(internalChunks) {
  if (!Array.isArray(internalChunks) || !internalChunks.length) {
    return 0;
  }
  return Math.round(Math.max(...internalChunks.map(chunk => Number(chunk.end || 0) || 0)));
}

async function downloadHlsKeysForGroup(group, fetchOptions, groupIndex, keyNames) {
  const keyFiles = [];
  const keys = new Map();
  for (const segment of group.segments) {
    if (segment.key?.id && !keys.has(segment.key.id)) {
      keys.set(segment.key.id, segment.key);
    }
  }
  let keyIndex = 0;
  for (const key of keys.values()) {
    const keyName = `key-${groupIndex}-${keyIndex}.key`;
    const buffer = await fetchBinary(key.uri, fetchOptions);
    keyNames.set(key.id, keyName);
    keyFiles.push({ name: keyName, mime: "application/octet-stream", buffer });
    keyIndex += 1;
  }
  return keyFiles;
}

function canUseConcatenatedHlsTransportStream(media, keyFiles = []) {
  return !media?.mapUrl && (!Array.isArray(keyFiles) || keyFiles.length === 0);
}

function canUseConcatenatedHlsMedia(media) {
  return !media?.mapUrl && !(media?.segments || []).some(segment => segment?.key);
}

function hlsMaxSegmentsPerExtractChunk(media) {
  return canUseConcatenatedHlsMedia(media)
    ? WEB_FFMPEG_HLS_CONCAT_MAX_SEGMENTS_PER_CHUNK
    : WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK;
}

function concatArrayBuffers(buffers) {
  const parts = (buffers || []).filter(buffer => buffer instanceof ArrayBuffer);
  const totalBytes = parts.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buffer of parts) {
    output.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return output.buffer;
}

function buildHlsFfmpegInput({ index, media, keyFiles, playlistSegments, segmentBuffers, initName, keyNames }) {
  if (canUseConcatenatedHlsTransportStream(media, keyFiles)) {
    const buffer = concatArrayBuffers(segmentBuffers);
    const inputName = `input-${index}.ts`;
    return {
      inputName,
      inputKind: "transport-stream",
      files: [{ name: inputName, mime: "video/mp2t", buffer }]
    };
  }
  const inputName = `input-${index}.m3u8`;
  const buffer = textToArrayBuffer(buildLocalHlsPlaylist(playlistSegments, initName, keyNames));
  return {
    inputName,
    inputKind: "playlist",
    files: [{ name: inputName, mime: "application/vnd.apple.mpegurl", buffer }]
  };
}

function buildLocalHlsPlaylist(segments, initName, keyNames = new Map()) {
  const targetDuration = Math.max(1, Math.ceil(Math.max(...segments.map(segment => segment.duration || 0), 1)));
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:7",
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    "#EXT-X-MEDIA-SEQUENCE:0"
  ];
  if (initName) {
    lines.push(`#EXT-X-MAP:URI="${initName}"`);
  }
  let currentKeyId = "";
  for (const segment of segments) {
    const key = segment.key || null;
    const keyId = key?.id || "";
    if (keyId !== currentKeyId) {
      if (key && keyNames.has(keyId)) {
        const keyLine = [`#EXT-X-KEY:METHOD=${key.method}`, `URI="${keyNames.get(keyId)}"`];
        if (key.iv) {
          keyLine.push(`IV=${key.iv}`);
        }
        lines.push(keyLine.join(","));
      } else if (currentKeyId) {
        lines.push("#EXT-X-KEY:METHOD=NONE");
      }
      currentKeyId = keyId;
    }
    lines.push(`#EXTINF:${Math.max(segment.duration || 0, 0).toFixed(3)},`);
    lines.push(segment.name);
  }
  lines.push("#EXT-X-ENDLIST", "");
  return lines.join("\n");
}

function guessHlsSegmentExtension(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  const match = pathname.match(/\.([a-z0-9]{1,8})$/);
  const ext = match?.[1] || "ts";
  return ["m4s", "mp4", "ts", "aac", "mp3"].includes(ext) ? ext : "ts";
}

function textToArrayBuffer(value) {
  return new TextEncoder().encode(value).buffer;
}

function buildMediaFetchOptions(message) {
  const headers = normalizeRequestHeaders(message.requestHeaders);
  return {
    credentials: "include",
    headers
  };
}

async function ensureWebFfmpegFrame(rawUrl) {
  const url = normalizeWebFfmpegUrl(rawUrl);
  const origin = new URL(url).origin;
  if (webFfmpegFrame?.url === url && webFfmpegFrame.ready) {
    return;
  }
  if (webFfmpegFrame?.url === url && webFfmpegReady) {
    return webFfmpegReady;
  }
  webFfmpegFrame?.iframe?.remove();
  const iframe = document.createElement("iframe");
  iframe.hidden = true;
  iframe.setAttribute("aria-hidden", "true");

  webFfmpegReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resetWebFfmpegFrame();
      reject(new Error("Web FFmpeg 页面加载超时。"));
    }, WEB_FFMPEG_READY_TIMEOUT_MS);
    webFfmpegFrame = {
      iframe,
      origin,
      url,
      ready: false,
      resolveReady: () => {
        clearTimeout(timeout);
        resolve();
      }
    };
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage({ app: WEB_FFMPEG_APP, type: "ping", id: "load" }, origin);
    });
    iframe.src = url;
    document.body.appendChild(iframe);
  }).finally(() => {
    webFfmpegReady = null;
  });
  return webFfmpegReady;
}

function requestWebFfmpeg(payload, transfer = [], onProgress = null) {
  return new Promise((resolve, reject) => {
    if (!webFfmpegFrame?.iframe?.contentWindow) {
      reject(new Error("Web FFmpeg 页面尚未就绪。"));
      return;
    }
    let idleTimeout = null;
    let absoluteTimeout = null;
    const clearTimers = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
      }
      if (absoluteTimeout) {
        clearTimeout(absoluteTimeout);
        absoluteTimeout = null;
      }
    };
    const failWithTimeout = error => {
      if (!webFfmpegPending.has(payload.id)) {
        return;
      }
      webFfmpegPending.delete(payload.id);
      clearTimers();
      resetWebFfmpegFrame();
      reject(error);
    };
    const refreshIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      idleTimeout = setTimeout(() => {
        failWithTimeout(new Error(`Web FFmpeg 处理超时：超过 ${formatTimeoutSeconds(WEB_FFMPEG_IDLE_TIMEOUT_MS)} 没有进展。`));
      }, WEB_FFMPEG_IDLE_TIMEOUT_MS);
    };
    absoluteTimeout = setTimeout(() => {
      failWithTimeout(new Error(`Web FFmpeg 处理超时：单次任务超过 ${formatTimeoutSeconds(WEB_FFMPEG_ABSOLUTE_TIMEOUT_MS)}。`));
    }, WEB_FFMPEG_ABSOLUTE_TIMEOUT_MS);
    refreshIdleTimeout();
    webFfmpegPending.set(payload.id, {
      onProgress: progress => {
        refreshIdleTimeout();
        onProgress?.(progress);
      },
      clear: clearTimers,
      resolve: result => {
        clearTimers();
        resolve(result);
      },
      reject: error => {
        clearTimers();
        reject(error);
      }
    });
    try {
      webFfmpegFrame.iframe.contentWindow.postMessage(payload, webFfmpegFrame.origin, transfer);
    } catch (error) {
      webFfmpegPending.delete(payload.id);
      clearTimers();
      reject(error);
    }
  });
}

function resetWebFfmpegFrame() {
  webFfmpegFrame?.iframe?.remove?.();
  webFfmpegFrame = null;
  webFfmpegReady = null;
}

function formatTimeoutSeconds(ms) {
  const seconds = Math.max(1, Math.round(Number(ms || 0) / 1000));
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)} 分钟`;
  }
  return `${seconds} 秒`;
}

function warmWebFfmpegFrame() {
  if (!webFfmpegFrame?.iframe?.contentWindow) {
    return;
  }
  webFfmpegFrame.iframe.contentWindow.postMessage({
    app: WEB_FFMPEG_APP,
    type: "load",
    id: `warm-${Date.now()}`
  }, webFfmpegFrame.origin);
}

function reportWebFfmpegExtractionProgress(message, progress) {
  if (!message?.jobId && !message?.tabId) {
    return;
  }
  chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_WEB_FFMPEG_PROGRESS,
    tabId: message.tabId,
    jobId: message.jobId || "",
    progress
  }).catch(() => {});
}

async function reportWebFfmpegChunkReady(message, chunk, extra = {}) {
  if (!message?.jobId || !chunk?.file) {
    return {};
  }
  return chrome.runtime.sendMessage({
    type: MESSAGE.OFFSCREEN_WEB_FFMPEG_CHUNK_READY,
    tabId: message.tabId,
    jobId: message.jobId,
    chunk,
    ...extra
  }).catch(() => ({}));
}

function normalizeWebFfmpegUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("Web FFmpeg 地址无效。");
  }
  if (!["http:", "https:", "chrome-extension:"].includes(url.protocol)) {
    throw new Error("Web FFmpeg 地址必须是 HTTP、HTTPS 或扩展内置页面。");
  }
  url.searchParams.set("fgv", WEB_FFMPEG_CACHE_VERSION);
  return url.href;
}

function normalizeRequestHeaders(headers) {
  const output = {};
  if (Array.isArray(headers)) {
    for (const header of headers) {
      if (header?.name && header?.value != null && isForwardableRequestHeader(header.name)) {
        output[header.name] = String(header.value);
      }
    }
    return output;
  }
  if (headers && typeof headers === "object") {
    for (const [name, value] of Object.entries(headers)) {
      if (value != null && isForwardableRequestHeader(name)) {
        output[name] = String(value);
      }
    }
  }
  return output;
}

function isForwardableRequestHeader(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("sec-") || normalized.startsWith("proxy-")) {
    return false;
  }
  return !new Set([
    "accept-encoding",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "host",
    "keep-alive",
    "origin",
    "range",
    "if-range",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent"
  ]).has(normalized);
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
