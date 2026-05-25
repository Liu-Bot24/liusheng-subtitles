const MESSAGE = {
  OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_EXTRACT_AUDIO",
  OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO: "FUGUANG_OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO",
  OFFSCREEN_WEB_FFMPEG_PROGRESS: "FUGUANG_OFFSCREEN_WEB_FFMPEG_PROGRESS",
  OFFSCREEN_WEB_FFMPEG_CHUNK_READY: "FUGUANG_OFFSCREEN_WEB_FFMPEG_CHUNK_READY",
  UPDATE_MEDIA_HEADER_RULE_DOMAINS: "FUGUANG_UPDATE_MEDIA_HEADER_RULE_DOMAINS"
};

const WEB_FFMPEG_APP = "fuguang-web-ffmpeg";
const WEB_FFMPEG_CACHE_VERSION = "20260522-webffmpeg-hls-playlist-safe";
const WEB_FFMPEG_AUDIO_CACHE = "fuguang-web-ffmpeg-audio";
const WEB_FFMPEG_AUDIO_CACHE_ORIGIN = "https://fuguang.local";
const WEB_FFMPEG_AUDIO_CACHE_PREFIX = "/__fuguang_audio_cache";
const WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS = 180;
const WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK = 60;
const WEB_FFMPEG_HLS_TS_MAX_SEGMENTS_PER_CHUNK = 360;
const WEB_FFMPEG_HLS_SEGMENT_DOWNLOAD_CONCURRENCY = 10;
const WEB_FFMPEG_ASR_LOGICAL_CHUNK_MIN_SECONDS = 10;
const WEB_FFMPEG_ASR_LOGICAL_CHUNK_MAX_SECONDS = 30 * 60;
const WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS = 2;
const WEB_FFMPEG_ASR_VAD_SPLIT_MIN_SILENCE_SECONDS = 2;
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
  if (message?.type === MESSAGE.OFFSCREEN_WEB_FFMPEG_COLLECT_SPEECH_AUDIO) {
    collectSpeechAudioWithWebFfmpeg(message)
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
      overlapSeconds: WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS,
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

async function collectSpeechAudioWithWebFfmpeg(message) {
  const file = message.file || {};
  const buffer = file.buffer instanceof ArrayBuffer
    ? file.buffer
    : await readPersistedWebFfmpegAudioFile(file).catch(() => null);
  if (!buffer) {
    throw new Error("缺少可收集语音窗口的音频文件。");
  }
  reportWebFfmpegExtractionProgress(message, {
    phase: "loading",
    percent: 1,
    message: "正在准备 Web FFmpeg 语音窗口"
  });
  await ensureWebFfmpegFrame(message.webFfmpegUrl);
  warmWebFfmpegFrame();
  const id = `collect-speech-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await requestWebFfmpeg({
    app: WEB_FFMPEG_APP,
    type: "collect-speech-audio",
    id,
    file: {
      name: file.name || "asr-source.mp3",
      mime: file.mime || "audio/mpeg",
      buffer
    },
    outputName: message.outputName || "speech-only.mp3",
    options: {
      format: "mp3",
      duration: message.duration,
      sourceStart: message.sourceStart,
      maxChunkSeconds: message.maxChunkSeconds || 30,
      speechIntervals: Array.isArray(message.speechIntervals) ? message.speechIntervals : []
    }
  }, [buffer], progress => {
    reportWebFfmpegExtractionProgress(message, {
      phase: "collect",
      percent: 92 + (Number(progress.percent || 0) / 100) * 6,
      message: progress.message || "正在按 VAD 收集语音窗口"
    });
  });
  return persistWebFfmpegAudioResult(result, message.cacheNamespace || id);
}

async function extractHlsAudioWithWebFfmpeg(message) {
  const fetchOptions = buildMediaFetchOptions(message);
  const logicalChunkSeconds = normalizeHlsLogicalChunkSeconds(message.asrChunkSeconds || message.chunkSeconds || 900);
  let playlistUrl = message.sourceUrl;
  let playlistText = "";
  await updateMediaHeaderRuleDomains(message, [
    playlistUrl,
    ...buildLikelyAudioCompanionPlaylistUrls(playlistUrl)
  ]);
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
    await updateMediaHeaderRuleDomains(message, master.variants.map(item => item.url));
    playlistUrl = variant.url;
    playlistText = await fetchText(playlistUrl, fetchOptions);
  }
  const media = parseHlsMediaPlaylist(playlistText, playlistUrl);
  await updateMediaHeaderRuleDomains(message, hlsMediaHeaderRuleUrls(media));
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
  const downloadedSegmentIds = new Set();
  let nextGroupDownload = null;
  const startGroupDownload = (group, index) => {
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
    return downloadHlsGroupResources(group, fetchOptions, index, progress => {
      const segmentId = hlsSegmentDownloadIdentity(progress.segment);
      if (segmentId && !downloadedSegmentIds.has(segmentId)) {
        downloadedSegmentIds.add(segmentId);
        downloadedSegments += 1;
      }
      if (progress.completed === 1 || progress.completed % 5 === 0 || progress.completed === progress.total) {
        reportWebFfmpegExtractionProgress(message, {
          phase: "download",
          percent: hlsExtractionPercent(index, progress.completed / Math.max(1, progress.total) * 0.55, groups.length),
          internalChunksDone: index,
          internalChunksTotal: groups.length,
          downloadedSegments,
          totalSegments: media.segments.length,
          readySeconds: internalChunksReadySeconds(internalChunks),
          message: `下载第 ${index + 1}/${groups.length} 组：已完成 ${progress.completed}/${progress.total} 个媒体切片`
        });
      }
    }).then(
      result => ({ ok: true, result }),
      error => ({ ok: false, error })
    );
  };
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
    const groupDownload = nextGroupDownload || startGroupDownload(group, index);
    nextGroupDownload = null;
    const groupDownloadResult = await groupDownload;
    if (!groupDownloadResult.ok) {
      throw groupDownloadResult.error;
    }
    const {
      files,
      mapNames,
      keyNames,
      keyFiles,
      segmentDownloads
    } = groupDownloadResult.result;
    if (index + 1 < groups.length) {
      nextGroupDownload = startGroupDownload(groups[index + 1], index + 1);
    }
    const playlistSegments = [];
    const segmentBuffers = [];
    const segmentFilesForPlaylist = [];
    const useConcatenatedTransport = canUseConcatenatedHlsTransportStream(media, keyFiles);
    for (const download of segmentDownloads) {
      const { segment, segmentBuffer, segmentFile, localSegment } = download;
      const segmentId = hlsSegmentDownloadIdentity(segment);
      if (segmentId && !downloadedSegmentIds.has(segmentId)) {
        downloadedSegmentIds.add(segmentId);
        downloadedSegments += 1;
      }
      segmentFilesForPlaylist.push({ file: segmentFile, segment: localSegment });
      if (useConcatenatedTransport) {
        segmentBuffers.push(segmentBuffer);
      } else {
        files.push(segmentFile);
        playlistSegments.push(localSegment);
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
      speechIntervals: result?.speechIntervalsReliable === false ? undefined : offsetSpeechIntervals(result?.speechIntervals, group.start),
      speechIntervalsReliable: result?.speechIntervalsReliable === false ? false : undefined,
      file: persisted.file,
      buffer: rawAudioBuffer,
      bytes: persisted.bytes || persisted.file?.bytes || 0
    };
    internalChunks.push(internalChunk);
    bytes += persisted.bytes || persisted.file?.bytes || 0;
    const asrParts = await splitHlsInternalChunkForAsr(message, internalChunk, logicalChunkSeconds, groups.length);
    for (const asrPart of asrParts) {
      const readyGroups = collectHlsLogicalPartGroups(logicalState, asrPart, false);
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

async function splitHlsInternalChunkForAsr(message, internalChunk, logicalChunkSeconds, groupCount) {
  const coreStart = hlsChunkCoreStart(internalChunk);
  const coreEnd = hlsChunkCoreEnd(internalChunk);
  const coreDuration = Math.max(0, coreEnd - coreStart);
  const uploadSeconds = normalizeHlsLogicalChunkSeconds(logicalChunkSeconds);
  if (!coreDuration || coreDuration <= uploadSeconds + 0.001) {
    return [internalChunk];
  }
  const buffer = internalChunk.buffer instanceof ArrayBuffer
    ? internalChunk.buffer
    : await readPersistedWebFfmpegAudioFile(internalChunk.file);
  const inputName = `hls-internal-${String(internalChunk.index + 1).padStart(3, "0")}.mp3`;
  const result = await requestWebFfmpeg({
    app: WEB_FFMPEG_APP,
    type: "extract-audio",
    id: `split-hls-${Date.now()}-${internalChunk.index}-${Math.random().toString(16).slice(2)}`,
    file: {
      name: inputName,
      mime: "audio/mpeg",
      buffer
    },
    outputName: `asr-${String(internalChunk.index + 1).padStart(3, "0")}.mp3`,
    options: {
      format: "mp3",
      chunkSeconds: uploadSeconds,
      overlapSeconds: WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS,
      duration: Math.max(0, Number(internalChunk.duration || (internalChunk.end - internalChunk.start)) || 0),
      coreStart: Math.max(0, coreStart - pickFiniteNumber(internalChunk.start, coreStart)),
      coreEnd: Math.max(0, coreEnd - pickFiniteNumber(internalChunk.start, coreStart))
    }
  }, [buffer], progress => {
    reportWebFfmpegExtractionProgress(message, {
      phase: "split",
      percent: hlsExtractionPercent(internalChunk.index, 0.91 + (Number(progress.percent || 0) / 100) * 0.05, groupCount),
      internalChunksDone: internalChunk.index,
      internalChunksTotal: groupCount,
      readySeconds: Math.round(coreStart),
      message: progress.message
        ? `正在生成第 ${internalChunk.index + 1}/${groupCount} 个内部媒体切片的 ASR 短窗：${progress.message}`
        : `正在生成第 ${internalChunk.index + 1}/${groupCount} 个内部媒体切片的 ASR 短窗`
    });
  });
  const persisted = await persistWebFfmpegAudioResult(result, `${message.cacheNamespace || "hls"}-asr-${internalChunk.index}`);
  const chunks = (persisted.chunks || []).map((chunk, index) => hlsAsrSubchunkToAbsoluteChunk(internalChunk, chunk, index));
  if (!chunks.length) {
    throw new Error("Web FFmpeg 没有生成可上传 ASR 的 HLS 短窗。");
  }
  await deletePersistedWebFfmpegAudioFiles([internalChunk.file]);
  if (message.webFfmpegUrl) {
    reportWebFfmpegExtractionProgress(message, {
      phase: "split",
      percent: hlsExtractionPercent(internalChunk.index, 0.97, groupCount),
      internalChunksDone: internalChunk.index + 1,
      internalChunksTotal: groupCount,
      readySeconds: Math.round(coreEnd),
      message: `已生成第 ${internalChunk.index + 1}/${groupCount} 个内部媒体切片的 ASR 短窗，正在回收 Web FFmpeg 工作区`
    });
    await reloadWebFfmpegFrame(message.webFfmpegUrl);
  }
  return chunks;
}

function hlsAsrSubchunkToAbsoluteChunk(internalChunk, chunk, fallbackIndex = 0) {
  const baseStart = pickFiniteNumber(internalChunk.start, 0);
  const relativeStart = pickFiniteNumber(chunk.start, 0);
  const relativeEnd = pickFiniteNumber(chunk.end, relativeStart + Number(chunk.duration || 0));
  const relativeCoreStart = pickFiniteNumber(chunk.coreStart, relativeStart);
  const relativeCoreEnd = pickFiniteNumber(chunk.coreEnd, relativeEnd);
  const start = roundHlsSecond(baseStart + relativeStart);
  const end = roundHlsSecond(baseStart + relativeEnd);
  const coreStart = roundHlsSecond(baseStart + relativeCoreStart);
  const coreEnd = roundHlsSecond(baseStart + relativeCoreEnd);
  const speechIntervals = chunk.speechIntervalsReliable === false
    ? undefined
    : offsetSpeechIntervals(chunk.speechIntervals, baseStart);
  return {
    index: (Number(internalChunk.index || 0) * 10000) + (Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : fallbackIndex),
    start,
    end,
    duration: Math.max(0, end - start),
    coreStart,
    coreEnd,
    coreDuration: Math.max(0, coreEnd - coreStart),
    speechIntervals,
    speechIntervalsReliable: chunk.speechIntervalsReliable === false ? false : undefined,
    file: chunk.file,
    bytes: chunk.bytes || chunk.file?.bytes || 0,
    internalChunkIndex: internalChunk.index,
    internalSubchunkIndex: Number.isInteger(Number(chunk.index)) ? Number(chunk.index) : fallbackIndex
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
    const chunkStart = hlsChunkCoreStart(chunk);
    const chunkEnd = hlsChunkCoreEnd(chunk);
    const chunkDuration = Math.max(0, chunkEnd - chunkStart);
    const chunkSpeechIntervals = chunk.speechIntervalsReliable === false ? null : normalizeSpeechIntervals(chunk.speechIntervals);
    if (Array.isArray(chunkSpeechIntervals) && !chunkSpeechIntervals.length) {
      pushPending();
      return ready;
    }
    const chunkStartWithContext = pickFiniteNumber(chunk.start, chunkStart);
    const chunkEndWithContext = pickFiniteNumber(chunk.end, chunkEnd);
    const hasOverlapContext = chunkStartWithContext < chunkStart || chunkEndWithContext > chunkEnd;
    const hasLogicalBoundaryContext =
      (chunkStartWithContext < chunkStart && hlsTimeIsLogicalBoundary(chunkStart, state.logicalChunkSeconds, 0))
      || (chunkEndWithContext > chunkEnd && hlsTimeIsLogicalBoundary(chunkEnd, state.logicalChunkSeconds, 0));
    if (hasOverlapContext && !hasLogicalBoundaryContext) {
      if (state.pendingParts.length) {
        pushPending();
      }
      state.pendingParts.push(chunk);
      state.pendingStart = chunkStart;
      state.pendingEnd = chunkEnd;
      pushPending();
      return ready;
    }
    const pendingDuration = state.pendingParts.length
      ? Math.max(0, Number(state.pendingEnd || 0) - Number(state.pendingStart || 0))
      : 0;
    if (state.pendingParts.length && pendingDuration + chunkDuration > state.logicalChunkSeconds) {
      pushPending();
    }
    if (hlsShouldSplitLogicalChunkAtVadGap(state.pendingParts, chunkSpeechIntervals)) {
      pushPending();
    }
    if (!state.pendingParts.length) {
      state.pendingStart = chunkStart;
      state.pendingEnd = chunkStart;
    }
    state.pendingParts.push(chunk);
    state.pendingEnd = chunkEnd;
    if (Math.max(0, Number(state.pendingEnd || 0) - Number(state.pendingStart || 0)) >= state.logicalChunkSeconds) {
      pushPending();
    }
  }
  if (final) {
    pushPending();
  }
  return ready;
}

function hlsChunkCoreStart(chunk = {}) {
  return pickFiniteNumber(chunk.coreStart, chunk.start, 0);
}

function hlsChunkCoreEnd(chunk = {}) {
  return pickFiniteNumber(chunk.coreEnd, chunk.end, hlsChunkCoreStart(chunk));
}

function hlsShouldSplitLogicalChunkAtVadGap(pendingParts, nextSpeechIntervals) {
  if (!pendingParts?.length || !Array.isArray(nextSpeechIntervals) || !nextSpeechIntervals.length) {
    return false;
  }
  if (pendingParts.some(part => part?.speechIntervalsReliable === false)) {
    return false;
  }
  const currentSpeech = mergeSpeechIntervals(pendingParts.flatMap(part => normalizeSpeechIntervals(part.speechIntervals) || []));
  if (!currentSpeech.length) {
    return false;
  }
  const lastCurrentSpeech = currentSpeech.at(-1);
  const firstNextSpeech = nextSpeechIntervals[0];
  return firstNextSpeech.start - lastCurrentSpeech.end >= WEB_FFMPEG_ASR_VAD_SPLIT_MIN_SILENCE_SECONDS;
}

function buildHlsInternalExtractionGroups(media, logicalChunkSeconds) {
  const coreGroups = groupHlsSegments(media.segments, {
    maxDurationSeconds: WEB_FFMPEG_HLS_EXTRACT_CHUNK_SECONDS,
    maxSegments: hlsMaxSegmentsPerExtractChunk(media)
  });
  return addHlsLogicalBoundaryContextToGroups(coreGroups, media.segments, logicalChunkSeconds);
}

function addHlsLogicalBoundaryContextToGroups(groups, segments, logicalChunkSeconds) {
  const overlap = WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS;
  const logicalSeconds = normalizeHlsLogicalChunkSeconds(logicalChunkSeconds);
  const mediaEnd = Array.isArray(segments) && segments.length
    ? pickFiniteNumber(segments.at(-1).end, 0)
    : 0;
  const allSegments = Array.isArray(segments) ? segments : [];
  return addHlsAsrContextOverlapToGroups(
    (groups || []).map(group => {
      const coreStart = pickFiniteNumber(group.coreStart, group.start);
      const coreEnd = pickFiniteNumber(group.coreEnd, group.end);
      const wantedStart = hlsTimeIsLogicalBoundary(coreStart, logicalSeconds, mediaEnd)
        ? Math.max(0, coreStart - overlap)
        : coreStart;
      const wantedEnd = hlsTimeIsLogicalBoundary(coreEnd, logicalSeconds, mediaEnd)
        ? coreEnd + overlap
        : coreEnd;
      const groupSegments = allSegments.filter(segment => {
        const segmentStart = pickFiniteNumber(segment.start);
        const segmentEnd = pickFiniteNumber(segment.end, segmentStart + Number(segment.duration || 0));
        return segmentEnd > wantedStart && segmentStart < wantedEnd;
      });
      return {
        ...group,
        start: pickFiniteNumber(groupSegments[0]?.start, coreStart),
        end: pickFiniteNumber(groupSegments.at(-1)?.end, coreEnd),
        coreStart,
        coreEnd,
        segments: groupSegments.length ? groupSegments : group.segments
      };
    }),
    segments,
    0
  );
}

function hlsTimeIsLogicalBoundary(value, logicalChunkSeconds, mediaEnd) {
  const time = Number(value);
  const logical = Number(logicalChunkSeconds);
  if (!Number.isFinite(time) || !Number.isFinite(logical) || logical <= 0) {
    return false;
  }
  if (time <= 0.001 || (Number.isFinite(mediaEnd) && mediaEnd > 0 && time >= mediaEnd - 0.001)) {
    return false;
  }
  return Math.abs((time / logical) - Math.round(time / logical)) <= 0.001;
}

async function buildHlsLogicalAudioChunk(message, index, parts, groupCount) {
  const normalizedParts = (parts || []).filter(part => part?.file);
  const start = Number(normalizedParts[0]?.start || 0) || 0;
  const end = Number(normalizedParts[normalizedParts.length - 1]?.end || start) || start;
  const coreStart = pickFiniteNumber(normalizedParts[0]?.coreStart, start);
  const coreEnd = pickFiniteNumber(normalizedParts[normalizedParts.length - 1]?.coreEnd, end);
  const coreDuration = Math.max(0, coreEnd - coreStart);
  const duration = Math.max(0, end - start);
  const speechIntervalsReliable = normalizedParts.every(part => part.speechIntervalsReliable !== false);
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
      speechIntervals: part.speechIntervalsReliable === false ? undefined : normalizeSpeechIntervals(part.speechIntervals),
      speechIntervalsReliable: part.speechIntervalsReliable === false ? false : undefined,
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
    speechIntervals: speechIntervalsReliable
      ? mergeSpeechIntervals(normalizedParts.flatMap(part => normalizeSpeechIntervals(part.speechIntervals)))
      : undefined,
    speechIntervalsReliable: speechIntervalsReliable ? undefined : false,
    internalChunkCount: normalizedParts.length
  };
}

function offsetSpeechIntervals(intervals, offsetSeconds) {
  const offset = Number(offsetSeconds) || 0;
  const normalized = normalizeSpeechIntervals(intervals);
  if (!Array.isArray(normalized)) {
    return undefined;
  }
  return normalized.map(interval => ({
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
  return applyFetchedByteRange(response, buffer, byteRange);
}

function normalizeByteRange(byteRange) {
  if (!byteRange || !Number.isFinite(Number(byteRange.offset)) || !Number.isFinite(Number(byteRange.length))) {
    return null;
  }
  const offset = Math.max(0, Math.floor(Number(byteRange.offset)));
  const length = Math.max(1, Math.floor(Number(byteRange.length)));
  return {
    offset,
    length,
    endExclusive: offset + length
  };
}

function applyFetchedByteRange(response, buffer, byteRange = null) {
  const range = normalizeByteRange(byteRange);
  if (!range) {
    return buffer;
  }
  if (response.status === 206) {
    const contentRange = parseContentRangeHeader(
      response.headers?.get?.("content-range") || response.headers?.get?.("Content-Range") || ""
    );
    if (contentRange && (
      contentRange.offset !== range.offset ||
      contentRange.endExclusive !== range.endExclusive
    )) {
      throw new Error("媒体切片服务器返回的 Content-Range 与 HLS 字节范围不一致。");
    }
    if (buffer.byteLength === range.length) {
      return buffer;
    }
    throw new Error("媒体切片服务器未按 Range 返回所需字节范围。");
  }
  if (response.status === 200) {
    if (range.offset === 0 && buffer.byteLength === range.length) {
      return buffer;
    }
    if (buffer.byteLength >= range.endExclusive) {
      return buffer.slice(range.offset, range.endExclusive);
    }
  }
  throw new Error("媒体切片服务器未按 Range 返回所需字节范围。");
}

function parseContentRangeHeader(value) {
  const match = /^bytes\s+(\d+)-(\d+)\/(?:\d+|\*)$/i.exec(String(value || "").trim());
  if (!match) {
    return null;
  }
  const offset = Number.parseInt(match[1], 10);
  const endInclusive = Number.parseInt(match[2], 10);
  if (!Number.isFinite(offset) || !Number.isFinite(endInclusive) || endInclusive < offset) {
    return null;
  }
  return {
    offset,
    endExclusive: endInclusive + 1
  };
}

function buildFetchOptionsWithByteRange(options = {}, byteRange = null) {
  const range = normalizeByteRange(byteRange);
  if (!range) {
    return options;
  }
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
  headers.Range = `bytes=${range.offset}-${range.endExclusive - 1}`;
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
  const results = await Promise.all(
    buildLikelyAudioCompanionPlaylistUrls(sourceUrl)
      .map(url => fetchLikelyAudioCompanionPlaylistCandidate(url, fetchOptions))
  );
  return results.find(Boolean) || null;
}

async function fetchLikelyAudioCompanionPlaylistCandidate(url, fetchOptions) {
  const text = await fetchText(url, fetchOptions).catch(() => "");
  if (!text) {
    return null;
  }
  const master = parseHlsMasterPlaylist(text, url);
  if (master.variants.some(variant => variant.audioOnly)) {
    return { url, text };
  }
  const media = parseHlsMediaPlaylist(text, url);
  return media.segments.length ? { url, text } : null;
}

function buildLikelyAudioCompanionPlaylistUrls(sourceUrl) {
  const output = [];
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return output;
  }
  const addPath = pathname => {
    const next = new URL(url.href);
    next.pathname = pathname;
    if (!output.includes(next.href)) {
      output.push(next.href);
    }
  };
  if (url.pathname.match(/\/video\.m3u8$/i)) {
    addPath(url.pathname.replace(/\/video\.m3u8$/i, "/audio.m3u8"));
  }
  const qualityVideoMatch = url.pathname.match(/^(.*)\/([^/]+)\/video\.m3u8$/i);
  if (qualityVideoMatch && isLikelyVideoQualityPathPart(qualityVideoMatch[2])) {
    const basePath = qualityVideoMatch[1];
    addPath(`${basePath}/audio/audio.m3u8`);
    addPath(`${basePath}/audio/index.m3u8`);
    addPath(`${basePath}/audio/playlist.m3u8`);
    addPath(`${basePath}/audio.m3u8`);
    addPath(`${basePath}/mp4a/audio.m3u8`);
    addPath(`${basePath}/aac/audio.m3u8`);
  }
  if (/\/video\//i.test(url.pathname)) {
    addPath(url.pathname.replace(/\/video\//i, "/audio/"));
  }
  if (/(^|\.)video\.twimg\.com$/i.test(url.hostname)) {
    const avcMatch = url.pathname.match(/^(.*\/pl\/)avc1\/[^/]+\/([^/]+\.m3u8)$/i);
    if (avcMatch) {
      for (const bitrate of ["128000", "64000", "32000"]) {
        addPath(`${avcMatch[1]}mp4a/${bitrate}/${avcMatch[2]}`);
      }
    }
  }
  return output;
}

function isLikelyVideoQualityPathPart(value) {
  return /^(?:\d{3,4}p|[1-9]\d{2,4}x[1-9]\d{2,4}|avc1|h264|h265|hevc|vp9|video)$/i.test(String(value || ""));
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
      codecs: String(attrs.CODECS || ""),
      audioOnly: hlsStreamInfIsAudioOnly(attrs)
    });
  }
  return { variants: [...audioMedia, ...variants] };
}

function hlsStreamInfIsAudioOnly(attrs = {}) {
  if (attrs.RESOLUTION || attrs.VIDEO) {
    return false;
  }
  const codecs = String(attrs.CODECS || "")
    .split(",")
    .map(codec => codec.trim().toLowerCase())
    .filter(Boolean);
  return codecs.length > 0 && codecs.every(isHlsAudioCodec);
}

function isHlsAudioCodec(codec) {
  return /^(?:mp4a|ac-3|ec-3|opus|vorbis|flac|alac)(?:\.|$)/i.test(String(codec || ""));
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

function hlsMediaHeaderRuleUrls(media) {
  const urls = new Set();
  for (const segment of Array.isArray(media?.segments) ? media.segments : []) {
    if (segment?.key?.uri) {
      urls.add(segment.key.uri);
    }
    if (segment?.map?.url) {
      urls.add(segment.map.url);
    }
    if (segment?.url) {
      urls.add(segment.url);
    }
  }
  return [...urls].sort();
}

async function updateMediaHeaderRuleDomains(message, urls) {
  const jobId = String(message?.jobId || "");
  const cleanUrls = mediaHeaderRuleRepresentativeUrls(urls);
  if (!jobId || !cleanUrls.length) {
    return;
  }
  const requiredDomains = mediaHeaderRuleDomainsFromUrls(cleanUrls);
  const response = await chrome.runtime.sendMessage({
    type: MESSAGE.UPDATE_MEDIA_HEADER_RULE_DOMAINS,
    jobId,
    urls: cleanUrls
  });
  if (response?.ok === false) {
    throw new Error(response.error || "HLS 子资源请求头规则更新失败。");
  }
  if (response?.updated === false && !Array.isArray(response?.domains)) {
    return;
  }
  if (response?.updated === false && Array.isArray(response?.domains) && !response.domains.length) {
    return;
  }
  if (requiredDomains.length) {
    const coveredDomains = new Set((Array.isArray(response?.domains) ? response.domains : [])
      .map(domain => String(domain || "").toLowerCase())
      .filter(Boolean));
    const missingDomains = requiredDomains.filter(domain => !coveredDomains.has(domain));
    if (missingDomains.length) {
      throw new Error(`HLS 子资源请求头规则未覆盖域名：${missingDomains.join(", ")}`);
    }
  }
}

function mediaHeaderRuleRepresentativeUrls(urls) {
  const byDomain = new Map();
  for (const url of Array.isArray(urls) ? urls : [urls]) {
    try {
      const parsed = new URL(String(url || ""));
      if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) {
        const domain = parsed.hostname.toLowerCase();
        if (!byDomain.has(domain)) {
          byDomain.set(domain, `${parsed.protocol}//${parsed.host}/`);
        }
      }
    } catch {
      // Invalid HLS child URLs are handled by the fetch path.
    }
  }
  return [...byDomain.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, representativeUrl]) => representativeUrl);
}

function mediaHeaderRuleDomainsFromUrls(urls) {
  const domains = new Set();
  for (const url of Array.isArray(urls) ? urls : [urls]) {
    try {
      const parsed = new URL(String(url || ""));
      if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) {
        domains.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // Invalid HLS child URLs are handled by the fetch path.
    }
  }
  return [...domains].sort();
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

function addHlsAsrContextOverlapToGroups(groups, segments, overlapSeconds = WEB_FFMPEG_ASR_CONTEXT_OVERLAP_SECONDS, options = {}) {
  const overlap = Math.max(0, Number(overlapSeconds) || 0);
  const maxDurationSeconds = Math.max(0, Number(options?.maxDurationSeconds || 0) || 0);
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
      WEB_FFMPEG_HLS_MAX_SEGMENTS_PER_CHUNK,
      maxDurationSeconds
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

function capOverlappedHlsSegments(selectedSegments, coreSegments, maxSegments, maxDurationSeconds = 0) {
  const selected = Array.isArray(selectedSegments) ? selectedSegments : [];
  const core = Array.isArray(coreSegments) ? coreSegments : [];
  const totalLimit = Math.max(core.length || 1, Math.floor(Number(maxSegments) || 0) || selected.length || core.length || 1);
  const limit = totalLimit;
  const durationLimit = Math.max(0, Number(maxDurationSeconds) || 0);
  if (!selected.length || (selected.length <= limit && (!durationLimit || hlsSegmentsDuration(selected) <= durationLimit + 0.001))) {
    return selected;
  }
  if (!core.length) {
    return capHlsSegmentsByDuration(selected.slice(0, limit), durationLimit);
  }
  const firstCore = core[0];
  const lastCore = core[core.length - 1];
  const firstIndex = selected.indexOf(firstCore);
  const lastIndex = selected.indexOf(lastCore);
  if (firstIndex < 0 || lastIndex < 0) {
    return capHlsSegmentsByDuration(selected.slice(0, limit), durationLimit);
  }
  let left = firstIndex;
  let right = lastIndex + 1;
  while (right - left > limit) {
    if (left < firstIndex) {
      left += 1;
    } else if (right > lastIndex + 1) {
      right -= 1;
    } else {
      break;
    }
  }
  let capped = selected.slice(left, right);
  if (!durationLimit) {
    return capped;
  }
  left = firstIndex;
  right = lastIndex + 1;
  capped = selected.slice(left, right);
  if (hlsSegmentsDuration(capped) >= durationLimit - 0.001) {
    return capped;
  }
  while (right - left < limit && (left > 0 || right < selected.length)) {
    let expanded = false;
    if (left > 0) {
      const candidate = selected.slice(left - 1, right);
      if (hlsSegmentsDuration(candidate) <= durationLimit + 0.001) {
        left -= 1;
        capped = candidate;
        expanded = true;
      }
    }
    if (right - left >= limit) {
      break;
    }
    if (right < selected.length) {
      const candidate = selected.slice(left, right + 1);
      if (hlsSegmentsDuration(candidate) <= durationLimit + 0.001) {
        right += 1;
        capped = candidate;
        expanded = true;
      }
    }
    if (!expanded) {
      break;
    }
  }
  return capped;
}

function hlsSegmentsDuration(segments) {
  if (!Array.isArray(segments) || !segments.length) {
    return 0;
  }
  const start = pickFiniteNumber(segments[0]?.start);
  const end = pickFiniteNumber(segments[segments.length - 1]?.end, start);
  return Math.max(0, end - start);
}

function capHlsSegmentsByDuration(segments, maxDurationSeconds = 0) {
  const limit = Math.max(0, Number(maxDurationSeconds) || 0);
  if (!limit || hlsSegmentsDuration(segments) <= limit + 0.001) {
    return segments;
  }
  const capped = [];
  for (const segment of segments) {
    const next = [...capped, segment];
    if (capped.length && hlsSegmentsDuration(next) > limit + 0.001) {
      break;
    }
    capped.push(segment);
  }
  return capped.length ? capped : segments.slice(0, 1);
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

function roundHlsSecond(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0;
}

function internalChunksReadySeconds(internalChunks) {
  if (!Array.isArray(internalChunks) || !internalChunks.length) {
    return 0;
  }
  return Math.round(Math.max(...internalChunks.map(chunk => pickFiniteNumber(chunk.coreEnd, chunk.end))));
}

async function downloadHlsGroupResources(group, fetchOptions, groupIndex, onSegmentProgress = null) {
  const mapNames = new Map();
  const keyNames = new Map();
  const [mapFiles, keyFiles, segmentDownloads] = await Promise.all([
    downloadHlsMapsForGroup(group, fetchOptions, groupIndex, mapNames),
    downloadHlsKeysForGroup(group, fetchOptions, groupIndex, keyNames),
    downloadHlsSegmentsForGroup(group, fetchOptions, groupIndex, onSegmentProgress)
  ]);
  return {
    files: [...mapFiles, ...keyFiles],
    mapNames,
    keyNames,
    mapFiles,
    keyFiles,
    segmentDownloads
  };
}

async function downloadHlsKeysForGroup(group, fetchOptions, groupIndex, keyNames) {
  const keys = new Map();
  for (const segment of group.segments) {
    if (segment.key?.id && !keys.has(segment.key.id)) {
      keys.set(segment.key.id, segment.key);
    }
  }
  return downloadHlsResources([...keys.values()], async (key, keyIndex) => {
    const keyName = `key-${groupIndex}-${keyIndex}.key`;
    const buffer = await fetchBinary(key.uri, fetchOptions);
    keyNames.set(key.id, keyName);
    return { name: keyName, mime: "application/octet-stream", buffer };
  });
}

async function downloadHlsMapsForGroup(group, fetchOptions, groupIndex, mapNames) {
  const maps = new Map();
  for (const segment of group.segments || []) {
    if (segment.map?.id && !maps.has(segment.map.id)) {
      maps.set(segment.map.id, segment.map);
    }
  }
  return downloadHlsResources([...maps.values()], async (map, mapIndex) => {
    const mapName = `map-${groupIndex}-${mapIndex}.mp4`;
    const buffer = await fetchBinary(map.url, fetchOptions, map.byteRange);
    mapNames.set(map.id, mapName);
    return { name: mapName, mime: "video/mp4", buffer };
  });
}

async function downloadHlsResources(items, downloadItem) {
  const resources = Array.isArray(items) ? items : [];
  const results = new Array(resources.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    WEB_FFMPEG_HLS_SEGMENT_DOWNLOAD_CONCURRENCY,
    Math.max(1, resources.length)
  );
  async function worker() {
    while (nextIndex < resources.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await downloadItem(resources[itemIndex], itemIndex);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function downloadHlsSegmentsForGroup(group, fetchOptions, groupIndex, onProgress = null) {
  const segments = Array.isArray(group?.segments) ? group.segments : [];
  const results = new Array(segments.length);
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(
    WEB_FFMPEG_HLS_SEGMENT_DOWNLOAD_CONCURRENCY,
    Math.max(1, segments.length)
  );
  async function worker() {
    while (nextIndex < segments.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const segment = segments[itemIndex];
      if (segment.gap) {
        throw new Error(`第 ${Number(segment.originalIndex || 0) + 1} 个 HLS 媒体切片被标记为 GAP，无法保证音频连续。`);
      }
      const segmentBuffer = await fetchBinary(segment.url, fetchOptions, segment.byteRange);
      const segmentName = `seg-${groupIndex}-${String(itemIndex).padStart(5, "0")}.${guessHlsSegmentExtension(segment.url)}`;
      const segmentFile = { name: segmentName, mime: "video/mp2t", buffer: segmentBuffer };
      const localSegment = { ...segment, name: segmentName, byteRange: null };
      results[itemIndex] = {
        itemIndex,
        segment,
        segmentBuffer,
        segmentFile,
        localSegment
      };
      completed += 1;
      onProgress?.({
        completed,
        total: segments.length,
        itemIndex,
        segment
      });
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function hlsSegmentDownloadIdentity(segment) {
  const originalIndex = Number(segment?.originalIndex);
  if (Number.isFinite(originalIndex)) {
    return `index:${originalIndex}`;
  }
  const range = normalizeByteRange(segment?.byteRange);
  return [
    String(segment?.url || ""),
    range ? `${range.offset}-${range.endExclusive}` : "full"
  ].join("#");
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
