const MIME_EXTENSION_MAP = new Map([
  ["audio/aac", "aac"],
  ["audio/flac", "flac"],
  ["audio/m4a", "m4a"],
  ["audio/mp4", "m4a"],
  ["audio/mpeg", "mp3"],
  ["audio/ogg", "ogg"],
  ["audio/opus", "opus"],
  ["audio/wav", "wav"],
  ["audio/webm", "webm"],
  ["application/vnd.apple.mpegurl", "m3u8"],
  ["application/x-mpegurl", "m3u8"],
  ["audio/mpegurl", "m3u8"],
  ["video/mp2t", "ts"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"]
]);

export function normalizeOutputFormat(format) {
  return String(format || "mp3").toLowerCase() === "mp3" ? "mp3" : "mp3";
}

export function inferExtensionFromMime(mime) {
  const normalized = String(mime || "").split(";")[0].trim().toLowerCase();
  return MIME_EXTENSION_MAP.get(normalized) || "bin";
}

export function safeFileStem(value, fallback = "media") {
  const baseName = String(value || "").split(/[?#]/)[0].split(/[\\/]/).pop() || "";
  const stem = baseName
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return stem || fallback;
}

export function safeVirtualFileName(value, fallback = "input.bin") {
  const fallbackName = String(fallback || "input.bin");
  const baseName = String(value || "")
    .split(/[?#]/)[0]
    .split(/[\\/]/)
    .pop() || fallbackName;
  const cleaned = baseName
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallbackName;
}

export function uniqueVirtualFileName(value, usedNames, fallback = "input.bin") {
  const used = usedNames || new Set();
  const baseName = safeVirtualFileName(value, fallback);
  if (!used.has(baseName)) {
    used.add(baseName);
    return baseName;
  }

  const dotIndex = baseName.lastIndexOf(".");
  const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  const extension = dotIndex > 0 ? baseName.slice(dotIndex) : "";
  let counter = 2;
  let candidate = `${stem}-${counter}${extension}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${stem}-${counter}${extension}`;
  }
  used.add(candidate);
  return candidate;
}

export function buildExtractAudioArgs({ inputName, outputName, segmentSeconds = 0, detectSpeech = false }) {
  const args = [
    "-i",
    inputName,
    "-vn",
    "-map",
    "0:a:0?",
    "-ac",
    "1",
    "-ar",
    "16000",
    ...(detectSpeech ? ["-af", "silencedetect=n=-45dB:d=0.4"] : []),
    "-b:a",
    "64k"
  ];
  if (Number(segmentSeconds) > 0) {
    args.push(
      "-f",
      "segment",
      "-segment_time",
      String(Math.max(1, Math.floor(Number(segmentSeconds)))),
      "-reset_timestamps",
      "1"
    );
  }
  args.push(outputName);
  return args;
}

export function buildConcatAudioArgs({ inputNames, outputName }) {
  const names = Array.isArray(inputNames) ? inputNames.filter(Boolean) : [];
  if (!names.length) {
    throw new Error("没有可合并的音频输入。");
  }

  const args = names.flatMap(name => ["-i", name]);
  if (names.length === 1) {
    args.push("-vn");
  } else {
    const inputs = names.map((_, index) => `[${index}:a:0]`).join("");
    args.push(
      "-filter_complex",
      `${inputs}concat=n=${names.length}:v=0:a=1[aout]`,
      "-map",
      "[aout]"
    );
  }
  args.push(
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    outputName
  );
  return args;
}
