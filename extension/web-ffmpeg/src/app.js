import { FFmpeg } from "../vendor/@ffmpeg/ffmpeg/index.js";

import {
  buildConcatAudioArgs,
  buildExtractAudioArgs,
  inferExtensionFromMime,
  normalizeOutputFormat,
  safeFileStem,
  safeVirtualFileName,
  uniqueVirtualFileName
} from "./ffmpeg-options.js";

const APP = "fuguang-web-ffmpeg";
const CORE_BASE_URL = new URL("../vendor/@ffmpeg/core", import.meta.url).href.replace(/\/$/, "");

const state = {
  ffmpeg: null,
  loadPromise: null,
  currentClient: null,
  currentRequestId: "",
  allowedOrigin: new URL(location.href).searchParams.get("allowedOrigin") || "",
  status: document.querySelector("#status"),
  log: document.querySelector("#log"),
  ffmpegLogs: []
};

window.addEventListener("message", event => {
  handleMessage(event).catch(error => {
    post(event, {
      type: "error",
      id: event.data?.id || "",
      error: error.message || String(error)
    });
  });
});

postReady();

async function handleMessage(event) {
  const message = event.data || {};
  if (message.app !== APP || !message.type) {
    return;
  }
  if (state.allowedOrigin && event.origin !== state.allowedOrigin) {
    return;
  }
  state.currentClient = { source: event.source, origin: event.origin || "*" };

  if (message.type === "ping") {
    post(event, { type: "ready", id: message.id || "", loaded: Boolean(state.ffmpeg?.loaded) });
    return;
  }
  if (message.type === "load") {
    await loadFfmpeg(event, message.id || "");
    post(event, { type: "loaded", id: message.id || "" });
    return;
  }
  if (message.type === "extract-audio") {
    const result = await extractAudio(event, message);
    post(event, { type: "result", id: message.id || "", result }, audioResultTransferList(result));
  }
  if (message.type === "concat-audio") {
    const result = await concatAudio(event, message);
    post(event, { type: "result", id: message.id || "", result }, audioResultTransferList(result));
  }
}

async function loadFfmpeg(event = null, id = "") {
  if (state.ffmpeg) {
    return state.ffmpeg;
  }
  if (state.loadPromise) {
    return state.loadPromise;
  }
  state.status.textContent = "加载 FFmpeg...";
  state.loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => appendLog(message));
    ffmpeg.on("progress", progress => {
      const ratio = Number(progress.progress || 0);
      post(null, {
        type: "progress",
        id: state.currentRequestId || id,
        stage: "ffmpeg",
        percent: Math.max(0, Math.min(100, Math.round(ratio * 1000) / 10)),
        message: "FFmpeg 正在处理音频"
      });
    });
    await ffmpeg.load({
      coreURL: `${CORE_BASE_URL}/ffmpeg-core.js`,
      wasmURL: `${CORE_BASE_URL}/ffmpeg-core.wasm`
    });
    state.ffmpeg = ffmpeg;
    state.status.textContent = "就绪";
    appendLog("FFmpeg loaded.");
    return ffmpeg;
  })().finally(() => {
    state.loadPromise = null;
  });
  return state.loadPromise;
}

async function extractAudio(event, message) {
  const files = normalizeInputFiles(message);
  if (!files.length) {
    throw new Error("没有收到可处理的媒体文件。");
  }

  const requestId = String(message.id || "");
  activateRequest(requestId);
  let ffmpeg;
  try {
    ffmpeg = await loadFfmpeg(event, message.id || "");
  } catch (error) {
    deactivateRequest(requestId);
    throw error;
  }
  const requestedInputName = String(message.inputName || "");
  const requestedFile = requestedInputName
    ? files.find(file => file.name === requestedInputName || file.originalName === requestedInputName)
    : null;
  if (requestedInputName && !requestedFile) {
    throw new Error(`指定的 FFmpeg 输入文件没有随请求发送：${requestedInputName}`);
  }
  const primaryFile = requestedFile || files[0];
  const inputExtension = extensionFromFile(primaryFile.name) || inferExtensionFromMime(primaryFile.mime);
  const inputName = primaryFile.name || `input-${message.id || Date.now()}.${inputExtension}`;
  const outputFormat = normalizeOutputFormat(message.options?.format);
  const segmentSeconds = normalizeSegmentSeconds(message.options?.chunkSeconds);
  const totalDuration = positiveNumber(message.options?.duration);
  const outputName = uniqueVirtualFileName(
    message.outputName || `${safeFileStem(primaryFile.name, "audio")}.${outputFormat}`,
    new Set(files.map(file => file.name)),
    `output.${outputFormat}`
  );
  const outputPattern = segmentSeconds ? segmentOutputPattern(outputName, outputFormat) : outputName;
  const command = buildExtractAudioArgs({ inputName, outputName: outputPattern, segmentSeconds });
  const logStartIndex = state.ffmpegLogs.length;
  const cleanupTargets = new Set([outputName, outputPattern]);

  state.status.textContent = "提取音频...";
  postOperationProgress("write", 0, "正在写入 Web FFmpeg 虚拟文件");

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      postOperationProgress(
        "write",
        Math.min(8, Math.round((index / Math.max(1, files.length)) * 8)),
        `正在写入输入文件 ${index + 1}/${files.length}`
      );
      await ffmpeg.writeFile(file.name, new Uint8Array(file.buffer));
      cleanupTargets.add(file.name);
    }
    postOperationProgress("write", 8, "输入文件写入完成");

    let returnCode = 0;
    try {
      postOperationProgress("exec", 10, "正在执行 FFmpeg 音频提取");
      returnCode = await ffmpeg.exec(command);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 执行异常", {
        inputName,
        outputName: outputPattern,
        command,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }
    if (returnCode !== 0) {
      throw buildFfmpegError("FFmpeg 返回非零退出码", {
        inputName,
        outputName: outputPattern,
        command,
        returnCode,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    if (segmentSeconds) {
      postOperationProgress("read", 96, "正在读取音频分段输出");
      const chunks = await readSegmentOutputs(ffmpeg, outputPattern, segmentSeconds, totalDuration);
      for (const chunk of chunks) {
        cleanupTargets.add(chunk.file.name);
      }
      if (!chunks.length) {
        throw buildFfmpegError("FFmpeg 没有生成音频切片", {
          inputName,
          outputName: outputPattern,
          command,
          returnCode,
          logs: recentFfmpegLogs(logStartIndex)
        });
      }
      const bytes = chunks.reduce((sum, chunk) => sum + (chunk.bytes || chunk.file?.buffer?.byteLength || 0), 0);
      state.status.textContent = "完成";
      return {
        chunks,
        bytes,
        duration: totalDuration || chunks[chunks.length - 1]?.end || 0,
        chunkSeconds: segmentSeconds,
        sourceType: "direct"
      };
    }

    let output;
    try {
      postOperationProgress("read", 96, "正在读取输出音频");
      output = await ffmpeg.readFile(outputName);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 没有生成输出文件", {
        inputName,
        outputName,
        command,
        returnCode,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    state.status.textContent = "完成";
    return {
      file: {
        name: outputName,
        mime: "audio/mpeg",
        buffer
      },
      bytes: buffer.byteLength
    };
  } finally {
    postOperationProgress("cleanup", 99, "正在清理 Web FFmpeg 临时文件");
    await cleanup(ffmpeg, ...cleanupTargets);
    deactivateRequest(requestId);
  }
}

async function concatAudio(event, message) {
  const files = normalizeInputFiles(message);
  if (!files.length) {
    throw new Error("没有收到可合并的音频文件。");
  }

  const requestId = String(message.id || "");
  activateRequest(requestId);
  let ffmpeg;
  try {
    ffmpeg = await loadFfmpeg(event, message.id || "");
  } catch (error) {
    deactivateRequest(requestId);
    throw error;
  }
  const outputFormat = normalizeOutputFormat(message.options?.format);
  const outputName = uniqueVirtualFileName(
    message.outputName || `concat.${outputFormat}`,
    new Set(files.map(file => file.name)),
    `concat.${outputFormat}`
  );
  const command = buildConcatAudioArgs({ inputNames: files.map(file => file.name), outputName });
  const cleanupTargets = new Set([outputName]);
  const logStartIndex = state.ffmpegLogs.length;

  state.status.textContent = "合并音频...";
  postOperationProgress("write", 0, "正在写入待合并音频");

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      postOperationProgress(
        "write",
        Math.min(8, Math.round((index / Math.max(1, files.length)) * 8)),
        `正在写入待合并音频 ${index + 1}/${files.length}`
      );
      await ffmpeg.writeFile(file.name, new Uint8Array(file.buffer));
      cleanupTargets.add(file.name);
    }
    postOperationProgress("write", 8, "待合并音频写入完成");

    let returnCode = 0;
    try {
      postOperationProgress("exec", 10, "正在执行 FFmpeg 音频合并");
      returnCode = await ffmpeg.exec(command);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 合并执行异常", {
        inputName: files.map(file => file.name).join(","),
        outputName,
        command,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }
    if (returnCode !== 0) {
      throw buildFfmpegError("FFmpeg 合并返回非零退出码", {
        inputName: files.map(file => file.name).join(","),
        outputName,
        command,
        returnCode,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    let output;
    try {
      postOperationProgress("read", 96, "正在读取合并后的音频");
      output = await ffmpeg.readFile(outputName);
    } catch (error) {
      throw buildFfmpegError("FFmpeg 合并没有生成输出文件", {
        inputName: files.map(file => file.name).join(","),
        outputName,
        command,
        returnCode,
        error,
        logs: recentFfmpegLogs(logStartIndex)
      });
    }

    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    state.status.textContent = "完成";
    return {
      file: {
        name: outputName,
        mime: "audio/mpeg",
        buffer
      },
      bytes: buffer.byteLength
    };
  } finally {
    postOperationProgress("cleanup", 99, "正在清理 Web FFmpeg 临时文件");
    await cleanup(ffmpeg, ...cleanupTargets);
    deactivateRequest(requestId);
  }
}

function activateRequest(id) {
  state.currentRequestId = String(id || "");
}

function deactivateRequest(id) {
  if (!id || state.currentRequestId === id) {
    state.currentRequestId = "";
  }
}

function postOperationProgress(stage, percent, message = "") {
  post(null, {
    type: "progress",
    id: state.currentRequestId,
    stage,
    percent: Math.max(0, Math.min(100, Number(percent) || 0)),
    message
  });
}

function normalizeInputFiles(message) {
  const rawFiles = Array.isArray(message.files) ? message.files : [message.file];
  const usedNames = new Set();
  return rawFiles
    .filter(file => file?.buffer instanceof ArrayBuffer && file.buffer.byteLength > 0)
    .map((file, index) => ({
      originalName: String(file.name || ""),
      name: uniqueVirtualFileName(
        safeVirtualFileName(file.name, index === 0 ? "input.bin" : `input-${index}.bin`),
        usedNames,
        index === 0 ? "input.bin" : `input-${index}.bin`
      ),
      mime: String(file.mime || ""),
      buffer: file.buffer
    }));
}

function audioResultTransferList(result) {
  if (result?.file?.buffer instanceof ArrayBuffer) {
    return [result.file.buffer];
  }
  if (!Array.isArray(result?.chunks)) {
    return [];
  }
  return result.chunks
    .map(chunk => chunk?.file?.buffer)
    .filter(buffer => buffer instanceof ArrayBuffer);
}

async function readSegmentOutputs(ffmpeg, outputPattern, segmentSeconds, totalDuration) {
  const pattern = segmentPatternParts(outputPattern);
  const entries = await ffmpeg.listDir(".");
  const names = entries
    .filter(entry => !entry.isDir && pattern.matches(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => pattern.indexOf(a) - pattern.indexOf(b));
  const chunks = [];
  for (const name of names) {
    const output = await ffmpeg.readFile(name);
    const buffer = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
    const index = pattern.indexOf(name);
    const start = Math.max(0, index * segmentSeconds);
    const end = totalDuration ? Math.min(totalDuration, start + segmentSeconds) : start + segmentSeconds;
    const duration = Math.max(0, end - start);
    if (totalDuration && duration <= 0) {
      continue;
    }
    chunks.push({
      index,
      start,
      end,
      duration,
      file: {
        name,
        mime: "audio/mpeg",
        buffer
      },
      bytes: buffer.byteLength
    });
  }
  return chunks;
}

function segmentOutputPattern(outputName, outputFormat) {
  const stem = safeFileStem(outputName, "chunk");
  return `${stem}-%03d.${outputFormat}`;
}

function segmentPatternParts(pattern) {
  const [prefix, suffix] = String(pattern).split("%03d");
  return {
    matches(name) {
      return String(name).startsWith(prefix) && String(name).endsWith(suffix);
    },
    indexOf(name) {
      const value = String(name).slice(prefix.length, String(name).length - suffix.length);
      return Number.parseInt(value, 10) || 0;
    }
  };
}

function normalizeSegmentSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(seconds));
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

async function cleanup(ffmpeg, ...files) {
  for (const file of files) {
    await ffmpeg.deleteFile(file).catch(() => {});
  }
}

function extensionFromFile(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] || "";
}

function postReady() {
  const message = { app: APP, type: "ready", loaded: false };
  window.parent?.postMessage(message, "*");
  window.opener?.postMessage(message, "*");
}

function post(event, payload, transfer = []) {
  const target = event?.source || state.currentClient?.source || window.parent;
  const origin = state.allowedOrigin || event?.origin || state.currentClient?.origin || "*";
  target?.postMessage({ app: APP, ...payload }, origin, transfer);
}

function appendLog(message) {
  state.ffmpegLogs.push(String(message || ""));
  if (state.ffmpegLogs.length > 300) {
    state.ffmpegLogs.splice(0, state.ffmpegLogs.length - 300);
  }
  const line = document.createElement("div");
  line.textContent = String(message || "");
  state.log.appendChild(line);
  state.log.scrollTop = state.log.scrollHeight;
}

function recentFfmpegLogs(startIndex) {
  return state.ffmpegLogs
    .slice(Math.max(0, startIndex))
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-12);
}

function buildFfmpegError(reason, { inputName, outputName, command, returnCode = null, error = null, logs = [] }) {
  const codeText = returnCode == null ? "未知" : String(returnCode);
  const commandText = command?.join(" ") || "";
  const causeText = error?.message ? `；异常：${error.message}` : "";
  const logText = logs.length ? `；最近日志：${logs.join(" | ").slice(0, 900)}` : "";
  return new Error(
    `FFmpeg 提取失败：${reason}。输入 ${inputName}，输出 ${outputName}，返回码 ${codeText}。命令：${commandText}${causeText}${logText}`
  );
}

async function toBlobURL(url, mimeType) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法加载 FFmpeg 资源：${response.status} ${url}`);
  }
  const blob = new Blob([await response.arrayBuffer()], { type: mimeType });
  return URL.createObjectURL(blob);
}
