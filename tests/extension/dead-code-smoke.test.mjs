import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const extensionRoot = path.resolve(new URL("../../extension", import.meta.url).pathname);
const productFiles = [
  ...collectJs(path.join(extensionRoot, "src")),
  ...collectJs(path.join(extensionRoot, "web-ffmpeg/src"))
];
const productSource = productFiles.map(file => fs.readFileSync(file, "utf8")).join("\n");
const allowedSingleUseFunctions = new Map([
  ["src/content/page-sniffer.js", new Set(["fuguangFetch", "fuguangXhrOpen", "fuguangXhrSend", "fuguangJsonParse"])],
  ["src/sidepanel/subtitle-format.js", new Set(["initSubtitleFormat"])],
  ["web-ffmpeg/src/ffmpeg-options.js", new Set([
    "normalizeOutputFormat",
    "inferExtensionFromMime",
    "safeFileStem",
    "uniqueVirtualFileName",
    "buildExtractAudioArgs",
    "buildConcatAudioArgs"
  ])]
]);

const suspicious = [];
for (const file of productFiles) {
  const relative = normalizeRelative(path.relative(extensionRoot, file));
  const source = fs.readFileSync(file, "utf8");
  const allowed = allowedSingleUseFunctions.get(relative) || new Set();
  for (const name of declaredFunctionNames(source)) {
    const count = countWord(source, name);
    if (count <= 1 && countWord(productSource, name) <= 1 && !allowed.has(name)) {
      suspicious.push(`${relative}:${name}`);
    }
  }
}

assert.deepEqual(suspicious, []);

function declaredFunctionNames(source) {
  return [...new Set([
    ...[...source.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]),
    ...[...source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^=]*?\)\s*=>/g)].map(match => match[1])
  ])];
}

function countWord(source, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (source.match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length;
}

function collectJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectJs(absolute);
    }
    return entry.name.endsWith(".js") ? [absolute] : [];
  });
}

function normalizeRelative(value) {
  return value.split(path.sep).join("/");
}
