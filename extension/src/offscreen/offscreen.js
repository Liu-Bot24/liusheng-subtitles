const MESSAGE = {
  OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  OFFSCREEN_WEB_FFMPEG_PROGRESS: "FUGUANG_OFFSCREEN_WEB_FFMPEG_PROGRESS",
  OFFSCREEN_WEB_FFMPEG_CHUNK_READY: "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY"
};

const WEB_FFMPEG_APP = "fuguang-web-ffmpeg";
const WEB_FFMPEG_CACHE_VERSION = "20260522-webffmpeg-hls-playlist-safe";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS = 180;
const WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK = 60;
const WEB_FFMPEG_HLS_TS_MAX_SEGMENTS_PER_CHUNK = 360;
const WEB_FFMPEG_ASR_LOGICAL_CHUNK_MIN_SECONDS = 10;
const WEB_FFMPEG_ASR_LOGICAL_CHUNK_MAX_SECONDS = 30 * 60;
const WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS = 8;
const WEB_FFMPEG_WORKER_RECYCLE_INTERNAL_CHUNKS = 48;
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
  const logicalChunkSeconds = normalizeHlsLogicalChunkSeconds(message.asrChunkSeconds || message.chunkSeconds || 900);
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
  const groups = buildHlsInternalExtractionGroups(media, logicalChunkSeconds);
  reportWebFfmpegExtractionProgress(message, {
    phase: "playlist",
    percent: 3,
    internalChunksDone: 0,
    internalChunksTotal: groups.length,
    downloadedSegments: 0,
    totalSegments: media.segments.length,
    readySeconds: 0,
    message: `已解析播放列表，共 ${media.segments.length} 个媒体切片，准备生成 ${groups.length} 个内部媒体切片`
  });
  const internalChunks = [];
  const logicalState = createHlsLogicalChunkState(logicalChunkSeconds);
  const logicalChunks = [];
  let bytes = 0;
  let downloadedSegments = 0;
  const downloadedSegmentUrls = new Set();
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (message.webFfmpegUrl && index > 0 && index % WEB_FFMPEG_WORKER_RECYCLE_INTERNAL_CHUNKS === 0) {
      reportWebFfmpegExtractionProgress(message, {
        phase: "ffmpeg",
        percent: hlsExtractionPercent(index, 0, groups.length),
        internalChunksDone: index,
        internalChunksTotal: groups.length,
        downloadedSegments,
        totalSegments: media.segments.length,
        readySeconds: internalChunksReadySeconds(internalChunks),
        message: `正在重置 Web FFmpeg 工作区，准备处理第 ${index + 1}/${groups.length} 个内部媒体切片`
      });
      await reloadWebFfmpegFrame(message.webFfmpegUrl);
    }
    reportWebFfmpegExtractionProgress(message, {
      phase: "download",
      percent: hlsExtractionPercent(index, 0, groups.length),
      internalChunksDone: index,
      internalChunksTotal: groups.length,
      downloadedSegments,
      totalSegments: media.segments.length,
      readySeconds: internalChunksReadySeconds(internalChunks),
      message: `正在下载第 ${index + 1}/${groups.length} 个内部媒体切片`
    });
    const files = [];
    const mapNames = new Map();
    const mapFiles = await downloadHlsMapsForGroup(group, fetchOptions, index, mapNames);
    for (const mapFile of mapFiles) {
      files.push(mapFile);
    }
    const keyNames = new Map();
    const keyFiles = await downloadHlsKeysForGroup(group, fetchOptions, index, keyNames);
    for (const keyFile of keyFiles) {
      files.push(keyFile);
    }
    const playlistSegments = [];
    const segmentBuffers = [];
    const segmentFilesForPlaylist = [];
    const useConcatenatedTransport = canUseConcatenatedHlsTransportStream(media, keyFiles);
    for (let itemIndex = 0; itemIndex < group.segments.length; itemIndex += 1) {
      const segment = group.segments[itemIndex];
      if (segment.gap) {
        throw new Error(`第 ${Number(segment.originalIndex || 0) + 1} 个 HLS 媒体切片被标记为 GAP，无法保证音频连续。`);
      }
      const segmentBuffer = await fetchBinary(segment.url, fetchOptions, segment.byteRange);
      if (!downloadedSegmentUrls.has(segment.url)) {
        downloadedSegmentUrls.add(segment.url);
        downloadedSegments += 1;
      }
      const segmentName = `seg-${index}-${String(itemIndex).padStart(5, "0")}.${guessHlsSegmentExtension(segment.url)}`;
      const segmentFile = { name: segmentName, mime: "video/mp2t", buffer: segmentBuffer };
      const localSegment = { ...segment, name: segmentName, byteRange: null };
      segmentFilesForPlaylist.push({ file: segmentFile, segment: localSegment });
      if (useConcatenatedTransport) {
        segmentBuffers.push(segmentBuffer);
      } else {
        files.push(segmentFile);
        playlistSegments.push(localSegment);
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
      initName: "",
      keyNames,
      mapNames
    });
    let result;
    try {
      result = await runHlsAudioExtraction(message, {
        index,
        groupCount: groups.length,
        ffmpegInput,
        files: [...ffmpegInput.files, ...files],
        outputName: `chunk-${String(index + 1).padStart(3, "0")}.mp3`,
        groupDuration: group.end - group.start,
        downloadedSegments,
        totalSegments: media.segments.length,
        internalChunks
      });
    } catch (error) {
      if (ffmpegInput.inputKind !== "transport-stream") {
        if (!message.webFfmpegUrl) {
          throw error;
        }
        reportWebFfmpegExtractionProgress(message, {
          phase: "ffmpeg",
          percent: hlsExtractionPercent(index, 0.9, groups.length),
          internalChunksDone: index,
          internalChunksTotal: groups.length,
          downloadedSegments,
          totalSegments: media.segments.length,
          readySeconds: internalChunksReadySeconds(internalChunks),
          message: `Web FFmpeg 执行异常，正在重置工作区并重试第 ${index + 1}/${groups.length} 个内部媒体切片`
        });
        try {
          await reloadWebFfmpegFrame(message.webFfmpegUrl);
          result = await runHlsAudioExtraction(message, {
            index,
            groupCount: groups.length,
            ffmpegInput,
            files: [...ffmpegInput.files, ...files],
            outputName: `chunk-${String(index + 1).padStart(3, "0")}.mp3`,
            groupDuration: group.end - group.start,
            downloadedSegments,
            totalSegments: media.segments.length,
            internalChunks,
            fallback: true
          });
        } catch (retryError) {
          throw new Error(`${retryError.message || retryError}（已重置 Web FFmpeg 后重试，仍然失败；原错误：${error.message || error}）`);
        }
      } else {
        reportWebFfmpegExtractionProgress(message, {
          phase: "ffmpeg",
          percent: hlsExtractionPercent(index, 0.9, groups.length),
          internalChunksDone: index,
          internalChunksTotal: groups.length,
          downloadedSegments,
          totalSegments: media.segments.length,
          readySeconds: internalChunksReadySeconds(internalChunks),
          message: `TS 拼接输入失败，正在重置 Web FFmpeg 并改用本地播放列表重试第 ${index + 1}/${groups.length} 个内部媒体切片`
        });
        const fallbackInput = buildHlsFfmpegInput({
          index,
          media,
          keyFiles,
          playlistSegments: segmentFilesForPlaylist.map(item => item.segment),
          segmentBuffers: [],
          initName: "",
          keyNames,
          mapNames,
          forcePlaylist: true
        });
        try {
          if (message.webFfmpegUrl) {
            await reloadWebFfmpegFrame(message.webFfmpegUrl);
          }
          result = await runHlsAudioExtraction(message, {
            index,
            groupCount: groups.length,
            ffmpegInput: fallbackInput,
            files: [...fallbackInput.files, ...files, ...segmentFilesForPlaylist.map(item => item.file)],
            outputName: `chunk-${String(index + 1).padStart(3, "0")}.mp3`,
            groupDuration: group.end - group.start,
            downloadedSegments,
            totalSegments: media.segments.length,
            internalChunks,
            fallback: true
          });
        } catch (fallbackError) {
          throw new Error(`${fallbackError.message || fallbackError}（已从 TS 拼接输入降级为本地播放列表，仍然失败；原错误：${error.message || error}）`);
        }
      }
    }
    const rawAudioBuffer = result?.file?.buffer instanceof ArrayBuffer ? result.file.buffer : null;
    const persisted = await persistWebFfmpegAudioResult(result, `${message.cacheNamespace || "hls"}-${index}`);
    const internalChunk = {
      index,
      start: group.start,
      end: group.end,
      duration: group.end - group.start,
      coreStart: group.coreStart,
      coreEnd: group.coreEnd,
      coreDuration: group.coreDuration,
      speechIntervals: offsetSpeechIntervals(result?.speechIntervals, group.start),
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
      message: `已生成 ${index + 1}/${groups.length} 个内部媒体切片`
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
    logicalChunkSeconds: normalizeHlsLogicalChunkSeconds(logicalChunkSeconds),
    pendingParts: [],
    pendingStart: 0,
    pendingEnd: 0,
    nextIndex: 0
  };
}

function normalizeHlsLogicalChunkSeconds(value) {
  const seconds = Number(value);
  const fallback = WEB_FFMPEG_ASR_LOGICAL_CHUNK_MAX_SECONDS;
  const normalized = Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
  return Math.max(
    WEB_FFMPEG_ASR_LOGICAL_CHUNK_MIN_SECONDS,
    Math.min(WEB_FFMPEG_ASR_LOGICAL_CHUNK_MAX_SECONDS, Math.floor(normalized))
  );
}

async function runHlsAudioExtraction(message, options) {
  const files = options.files || [];
  return requestWebFfmpeg({
    app: WEB_FFMPEG_APP,
    type: "extract-audio",
    id: `extract-hls-${Date.now()}-${options.index}-${Math.random().toString(16).slice(2)}`,
    inputName: options.ffmpegInput.inputName,
    outputName: options.outputName,
    files,
    options: { format: "mp3", duration: options.groupDuration }
  }, files.map(file => file.buffer).filter(buffer => buffer instanceof ArrayBuffer), progress => {
    reportWebFfmpegExtractionProgress(message, {
      phase: "ffmpeg",
      percent: hlsExtractionPercent(options.index, 0.55 + (Number(progress.percent || 0) / 100) * 0.35, options.groupCount),
      internalChunksDone: options.index,
      internalChunksTotal: options.groupCount,
      downloadedSegments: options.downloadedSegments,
      totalSegments: options.totalSegments,
      readySeconds: internalChunksReadySeconds(options.internalChunks),
      message: progress.message
        ? `第 ${options.index + 1}/${options.groupCount} 个内部媒体切片${options.fallback ? "（playlist 重试）" : ""}：${progress.message}`
        : `正在转码第 ${options.index + 1}/${options.groupCount} 个内部媒体切片${options.fallback ? "（playlist 重试）" : ""}`
    });
  });
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
    const hasOverlapContext =
      pickFiniteNumber(chunk.start, 0) < pickFiniteNumber(chunk.coreStart, chunk.start) ||
      pickFiniteNumber(chunk.end, 0) > pickFiniteNumber(chunk.coreEnd, chunk.end);
    if (hasOverlapContext && state.pendingParts.length) {
      pushPending();
    }
    if (hasOverlapContext) {
      state.pendingParts.push(chunk);
      pushPending();
      return ready;
    }
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

function buildHlsInternalExtractionGroups(media, logicalChunkSeconds) {
  const coreGroups = groupHlsSegments(media.segments, {
    maxDurationSeconds: Math.min(WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS, logicalChunkSeconds),
    maxSegments: hlsMaxSegmentsPerExtractChunk(media)
  });
  return addHlsAsrContextOverlapToGroups(coreGroups, media.segments, 0);
}

async function buildHlsLogicalAudioChunk(message, index, parts, groupCount) {
  const normalizedParts = (parts || []).filter(part => part?.file);
  const start = Number(normalizedParts[0]?.start || 0) || 0;
  const end = Number(normalizedParts[normalizedParts.length - 1]?.end || start) || start;
  const coreStart = pickFiniteNumber(normalizedParts[0]?.coreStart, start);
  const coreEnd = pickFiniteNumber(normalizedParts[normalizedParts.length - 1]?.coreEnd, end);
  const coreDuration = Math.max(0, coreEnd - coreStart);
  const duration = Math.max(0, end - start);
  if (normalizedParts.length === 1) {
    const part = normalizedParts[0];
    return {
      logical: true,
      index,
      start,
      end,
      duration,
      coreStart,
      coreEnd,
      coreDuration,
      file: part.file,
      bytes: part.bytes || part.file?.bytes || 0,
      speechIntervals: normalizeSpeechIntervals(part.speechIntervals),
      internalChunkCount: 1
    };
  }
  reportWebFfmpegExtractionProgress(message, {
    phase: "concat",
    percent: hlsExtractionPercent(Math.min(groupCount - 1, normalizedParts.at(-1)?.index || 0), 0.96, groupCount),
    internalChunksDone: normalizedParts.at(-1)?.index + 1 || 0,
    internalChunksTotal: groupCount,
    readySeconds: Math.round(end),
    message: `正在合并第 ${index + 1} 个识别音频分段`
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
        ? `第 ${index + 1} 个识别音频分段：${progress.message}`
        : `正在合并第 ${index + 1} 个识别音频分段`
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
    coreStart,
    coreEnd,
    coreDuration,
    file: persisted.file,
    bytes: persisted.bytes || persisted.file?.bytes || 0,
    speechIntervals: mergeSpeechIntervals(normalizedParts.flatMap(part => normalizeSpeechIntervals(part.speechIntervals))),
    internalChunkCount: normalizedParts.length
  };
}

function offsetSpeechIntervals(intervals, offsetSeconds) {
  const offset = Number(offsetSeconds) || 0;
  return (normalizeSpeechIntervals(intervals) || []).map(interval => ({
    start: interval.start + offset,
    end: interval.end + offset
  }));
}

function normalizeSpeechIntervals(intervals) {
  if (!Array.isArray(intervals)) {
    return null;
  }
  return intervals
    .map(interval => ({
      start: Number(interval?.start),
      end: Number(interval?.end)
    }))
    .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

function mergeSpeechIntervals(intervals) {
  const normalized = normalizeSpeechIntervals(intervals) || [];
  const merged = [];
  for (const interval of normalized) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end + 0.15) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

async function readPersistedWebFfmpegAudioFile(file) {
  if (!file?.cacheUrl) {
    throw new Error("内部媒体切片缺少缓存地址，无法合并。");
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

async function fetchBinary(url, options, byteRange = null) {
  const response = await fetch(url, buildFetchOptionsWithByteRange(options, byteRange));
  if (!response.ok) {
    throw new Error(`媒体切片下载失败：HTTP ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  if (!buffer?.byteLength) {
    throw new Error("媒体切片下载结果为空。");
  }
  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if ((contentType.includes("text/") || contentType.includes("json")) && looksLikeTextErrorBody(buffer)) {
    throw new Error(`媒体切片下载结果不是二进制媒体：${contentType || "unknown"}`);
  }
  return buffer;
}

function buildFetchOptionsWithByteRange(options = {}, byteRange = null) {
  if (!byteRange || !Number.isFinite(Number(byteRange.offset)) || !Number.isFinite(Number(byteRange.length))) {
    return options;
  }
  const start = Math.max(0, Math.floor(Number(byteRange.offset)));
  const end = start + Math.max(1, Math.floor(Number(byteRange.length))) - 1;
  const headers = {};
  const originalHeaders = options?.headers || {};
  if (typeof Headers !== "undefined" && originalHeaders instanceof Headers) {
    originalHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(originalHeaders)) {
    for (const [key, value] of originalHeaders) {
      headers[key] = value;
    }
  } else if (originalHeaders && typeof originalHeaders === "object") {
    Object.assign(headers, originalHeaders);
  }
  headers.Range = `bytes=${start}-${end}`;
  return { ...options, headers };
}

function looksLikeTextErrorBody(buffer) {
  const bytes = new Uint8Array(buffer.slice(0, Math.min(64, buffer.byteLength)));
  for (const byte of bytes) {
    if (byte === 9 || byte === 10 || byte === 13 || byte === 32) {
      continue;
    }
    return byte === 60 || byte === 123 || byte === 91;
  }
  return false;
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
  let currentMap = null;
  let pendingByteRange = null;
  let pendingDiscontinuity = false;
  let pendingGap = false;
  let unsupportedEncryption = "";
  const byteRangeCursors = new Map();
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
        currentMap = createHlsMap(attrs, baseUrl);
        mapUrl = mapUrl || currentMap.url;
      }
      continue;
    }
    if (line.startsWith("#EXT-X-DISCONTINUITY")) {
      pendingDiscontinuity = true;
      continue;
    }
    if (line.startsWith("#EXT-X-GAP")) {
      pendingGap = true;
      continue;
    }
    if (line.startsWith("#EXT-X-BYTERANGE:")) {
      pendingByteRange = parseHlsByteRangeSpec(line.slice("#EXT-X-BYTERANGE:".length));
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      pendingDuration = Number.parseFloat(line.slice("#EXTINF:".length).split(",")[0]) || 0;
      continue;
    }
    if (line || line.startsWith("#")) {
      if (!line.startsWith("#")) {
        const url = resolveHlsUrl(line, baseUrl);
        const byteRange = materializeHlsByteRange(pendingByteRange, byteRangeCursors.get(url) || 0);
        if (byteRange) {
          byteRangeCursors.set(url, byteRange.endExclusive);
        }
        segments.push({
          originalIndex: segments.length,
          url,
          duration: pendingDuration || 0,
          key: currentKey,
          map: currentMap,
          byteRange,
          discontinuityBefore: pendingDiscontinuity,
          gap: pendingGap
        });
        pendingDuration = 0;
        pendingByteRange = null;
        pendingDiscontinuity = false;
        pendingGap = false;
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

function createHlsMap(attrs, baseUrl) {
  const url = resolveHlsUrl(attrs.URI, baseUrl);
  const byteRange = materializeHlsByteRange(parseHlsByteRangeSpec(attrs.BYTERANGE || ""), 0);
  return {
    id: `map:${url}:${byteRange ? `${byteRange.offset}-${byteRange.endExclusive}` : "full"}`,
    url,
    byteRange
  };
}

function parseHlsByteRangeSpec(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const [lengthText, offsetText] = text.split("@");
  const length = Number.parseInt(lengthText, 10);
  if (!Number.isFinite(length) || length <= 0) {
    return null;
  }
  const offset = offsetText === undefined || offsetText === ""
    ? null
    : Number.parseInt(offsetText, 10);
  return {
    length,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : null
  };
}

function materializeHlsByteRange(spec, previousEnd = 0) {
  if (!spec || !Number.isFinite(Number(spec.length)) || Number(spec.length) <= 0) {
    return null;
  }
  const offset = Number.isFinite(Number(spec.offset)) && Number(spec.offset) >= 0
    ? Number(spec.offset)
    : Math.max(0, Number(previousEnd) || 0);
  const length = Math.max(1, Math.floor(Number(spec.length)));
  return {
    offset,
    length,
    endExclusive: offset + length
  };
}

function hlsMapId(map) {
  return map?.id || "";
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
    const hasStructuralBoundary = current.length && startsNewHlsExtractionGroup(current.at(-1), segment);
    if (current.length && (hasStructuralBoundary || exceedsDuration || exceedsSegmentCount)) {
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

function startsNewHlsExtractionGroup(previous, segment) {
  if (!previous || !segment) {
    return false;
  }
  if (segment.discontinuityBefore || previous.gap || segment.gap) {
    return true;
  }
  return false;
}

function addHlsAsrContextOverlapToGroups(groups, segments, overlapSeconds = WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS) {
  const overlap = Math.max(0, Number(overlapSeconds) || 0);
  const allSegments = Array.isArray(segments) ? segments : [];
  return (groups || []).map(group => {
    const coreStart = pickFiniteNumber(group.coreStart, group.start);
    const coreEnd = pickFiniteNumber(group.coreEnd, group.end);
    if (!overlap || !allSegments.length) {
      return {
        ...group,
        coreStart,
        coreEnd,
        coreDuration: Math.max(0, coreEnd - coreStart),
        duration: Math.max(0, pickFiniteNumber(group.end, coreEnd) - pickFiniteNumber(group.start, coreStart))
      };
    }
    const wantedStart = Math.max(0, coreStart - overlap);
    const wantedEnd = coreEnd + overlap;
    const selectedSegments = allSegments.filter(segment => {
      const segmentStart = pickFiniteNumber(segment.start);
      const segmentEnd = pickFiniteNumber(segment.end, segmentStart + Number(segment.duration || 0));
      return segmentEnd > wantedStart && segmentStart < wantedEnd;
    });
    const groupSegments = capOverlappedHlsSegments(
      selectedSegments.length ? selectedSegments : group.segments || [],
      group.segments || [],
      WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK
    );
    const start = pickFiniteNumber(groupSegments[0]?.start, coreStart);
    const end = pickFiniteNumber(groupSegments[groupSegments.length - 1]?.end, coreEnd);
    return {
      ...group,
      start,
      end,
      duration: Math.max(0, end - start),
      coreStart,
      coreEnd,
      coreDuration: Math.max(0, coreEnd - coreStart),
      segments: groupSegments
    };
  });
}

function capOverlappedHlsSegments(selectedSegments, coreSegments, maxSegments) {
  const selected = Array.isArray(selectedSegments) ? selectedSegments : [];
  const core = Array.isArray(coreSegments) ? coreSegments : [];
  const extraBudget = Math.max(0, Math.floor(Number(maxSegments) || 0));
  const limit = Math.max(core.length || 1, (core.length || 0) + extraBudget);
  if (!selected.length || selected.length <= limit) {
    return selected;
  }
  if (!core.length) {
    return selected.slice(0, limit);
  }
  const firstCore = core[0];
  const lastCore = core[core.length - 1];
  const firstIndex = selected.indexOf(firstCore);
  const lastIndex = selected.indexOf(lastCore);
  if (firstIndex < 0 || lastIndex < 0) {
    return selected.slice(0, limit);
  }
  let left = firstIndex;
  let right = lastIndex + 1;
  while (right - left < limit && (left > 0 || right < selected.length)) {
    if (left > 0) {
      left -= 1;
    }
    if (right - left >= limit) {
      break;
    }
    if (right < selected.length) {
      right += 1;
    }
  }
  return selected.slice(left, right);
}

function hlsExtractionPercent(groupIndex, groupLocalRatio, groupCount) {
  const count = Math.max(1, Number(groupCount) || 1);
  const local = Math.max(0, Math.min(1, Number(groupLocalRatio) || 0));
  return Math.max(3, Math.min(99, Math.round((3 + ((groupIndex + local) / count) * 96) * 10) / 10));
}

function pickFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return 0;
}

function internalChunksReadySeconds(internalChunks) {
  if (!Array.isArray(internalChunks) || !internalChunks.length) {
    return 0;
  }
  return Math.round(Math.max(...internalChunks.map(chunk => pickFiniteNumber(chunk.coreEnd, chunk.end))));
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

async function downloadHlsMapsForGroup(group, fetchOptions, groupIndex, mapNames) {
  const mapFiles = [];
  const maps = new Map();
  for (const segment of group.segments || []) {
    if (segment.map?.id && !maps.has(segment.map.id)) {
      maps.set(segment.map.id, segment.map);
    }
  }
  let mapIndex = 0;
  for (const map of maps.values()) {
    const mapName = `map-${groupIndex}-${mapIndex}.mp4`;
    const buffer = await fetchBinary(map.url, fetchOptions, map.byteRange);
    mapNames.set(map.id, mapName);
    mapFiles.push({ name: mapName, mime: "video/mp4", buffer });
    mapIndex += 1;
  }
  return mapFiles;
}

function canUseConcatenatedHlsTransportStream(media, keyFiles = []) {
  const segments = media?.segments || [];
  return (Boolean(media?.allowUnsafeTransportConcat) || isPlainHlsTransportStream(media)) &&
    !media?.mapUrl &&
    (!Array.isArray(keyFiles) || keyFiles.length === 0) &&
    !segments.some(segment =>
      segment?.key ||
      segment?.map ||
      segment?.byteRange ||
      segment?.discontinuityBefore ||
      segment?.gap
    );
}

function hlsMaxSegmentsPerExtractChunk(media) {
  return isPlainHlsTransportStream(media)
    ? WEB_FFMPEG_HLS_TS_MAX_SEGMENTS_PER_CHUNK
    : WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK;
}

function isPlainHlsTransportStream(media) {
  const segments = Array.isArray(media?.segments) ? media.segments : [];
  if (!segments.length || media?.mapUrl) {
    return false;
  }
  return !segments.some(segment =>
    segment?.key ||
    segment?.map ||
    segment?.byteRange ||
    segment?.discontinuityBefore ||
    segment?.gap ||
    guessHlsSegmentExtension(segment.url || "") !== "ts"
  );
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

function buildHlsFfmpegInput({ index, media, keyFiles, playlistSegments, segmentBuffers, initName, keyNames, mapNames, forcePlaylist = false }) {
  if (!forcePlaylist && canUseConcatenatedHlsTransportStream(media, keyFiles)) {
    const buffer = concatArrayBuffers(segmentBuffers);
    const inputName = `input-${index}.ts`;
    return {
      inputName,
      inputKind: "transport-stream",
      files: [{ name: inputName, mime: "video/mp2t", buffer }]
    };
  }
  const inputName = `input-${index}.m3u8`;
  const buffer = textToArrayBuffer(buildLocalHlsPlaylist(playlistSegments, initName, keyNames, mapNames));
  return {
    inputName,
    inputKind: "playlist",
    files: [{ name: inputName, mime: "application/vnd.apple.mpegurl", buffer }]
  };
}

function buildLocalHlsPlaylist(segments, initName, keyNames = new Map(), mapNames = new Map()) {
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
  let currentMapId = initName ? "__legacy_init__" : "";
  let currentKeyId = "";
  for (const segment of segments) {
    if (segment.discontinuityBefore) {
      lines.push("#EXT-X-DISCONTINUITY");
    }
    const map = segment.map || null;
    const mapId = hlsMapId(map);
    if (mapId !== currentMapId) {
      if (map) {
        const mapName = mapNames.get(mapId);
        if (!mapName) {
          throw new Error("HLS 初始化媒体切片缺少本地缓存文件，无法重建播放列表。");
        }
        lines.push(`#EXT-X-MAP:URI="${mapName}"`);
      }
      currentMapId = mapId;
    }
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
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    pathname = String(url || "").toLowerCase();
  }
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

async function reloadWebFfmpegFrame(rawUrl) {
  resetWebFfmpegFrame();
  await ensureWebFfmpegFrame(rawUrl);
  warmWebFfmpegFrame();
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
  const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
  if (url.protocol !== "chrome-extension:" || url.origin !== extensionOrigin) {
    throw new Error("Web FFmpeg 必须使用扩展内置页面。");
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
