import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const extensionRoot = path.resolve(new URL("../../extension", import.meta.url).pathname);
const referencedFiles = new Set(["manifest.json"]);
const manifest = JSON.parse(readExtensionFile("manifest.json"));

for (const icon of Object.values(manifest.icons || {})) {
  addReferencedFile(icon);
}
addReferencedFile(manifest.side_panel?.default_path);
addReferencedFile(manifest.background?.service_worker);
for (const script of manifest.content_scripts || []) {
  for (const js of script.js || []) {
    addReferencedFile(js);
  }
}

for (const runtimeEntrypoint of ["src/background/service-worker.js"]) {
  for (const file of literalExtensionFiles(readExtensionFile(runtimeEntrypoint))) {
    addReferencedFile(file);
  }
}

let changed = true;
while (changed) {
  changed = false;
  for (const file of [...referencedFiles]) {
    if (!/\.(html|js|css)$/.test(file)) {
      continue;
    }
    for (const target of referencedTargets(file)) {
      if (addReferencedFile(target)) {
        changed = true;
      }
    }
  }
}

const releaseFiles = collectFiles(extensionRoot)
  .map(file => normalizeRelative(path.relative(extensionRoot, file)))
  .sort();
const unreferenced = releaseFiles.filter(file => !referencedFiles.has(file));

assert.deepEqual(unreferenced, []);

function referencedTargets(file) {
  const source = readExtensionFile(file);
  const found = [];
  if (file.endsWith(".html")) {
    for (const match of source.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
      found.push(resolveRelative(file, match[1]));
    }
  }
  if (file.endsWith(".js")) {
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)) {
      found.push(resolveRelative(file, match[1]));
    }
    for (const match of source.matchAll(/new URL\(["']([^"']+)["']\s*,\s*import\.meta\.url\)/g)) {
      found.push(resolveRelative(file, match[1]));
    }
    for (const match of source.matchAll(/chrome\.runtime\.getURL\(["']([^"']+)["']\)/g)) {
      found.push(stripQuery(match[1]));
    }
    for (const match of source.matchAll(/url:\s*["']([^"']+\.(?:html|js|css|wasm|png))["']/g)) {
      found.push(stripQuery(match[1]));
    }
    if (source.includes("ffmpeg-core.wasm")) {
      found.push("web-ffmpeg/vendor/@ffmpeg/core/ffmpeg-core.wasm");
    }
  }
  if (file.endsWith(".css")) {
    for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      found.push(resolveRelative(file, match[1]));
    }
  }
  return found.filter(Boolean);
}

function literalExtensionFiles(source) {
  return [...source.matchAll(/const\s+[A-Z0-9_]+\s*=\s*["']([^"']+\.(?:html|js|css|wasm|png))["']/g)]
    .map(match => stripQuery(match[1]));
}

function addReferencedFile(file) {
  const clean = stripQuery(file);
  if (!clean) {
    return false;
  }
  const absolute = path.join(extensionRoot, clean);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    return false;
  }
  const normalized = normalizeRelative(path.relative(extensionRoot, absolute));
  const before = referencedFiles.size;
  referencedFiles.add(normalized);
  return referencedFiles.size !== before;
}

function resolveRelative(baseFile, rawReference) {
  const reference = stripQuery(rawReference);
  if (!reference || /^(https?:|data:|blob:|chrome-extension:)/.test(reference)) {
    return "";
  }
  return normalizeRelative(path.relative(
    extensionRoot,
    path.resolve(path.dirname(path.join(extensionRoot, baseFile)), reference)
  ));
}

function readExtensionFile(file) {
  return fs.readFileSync(path.join(extensionRoot, file), "utf8");
}

function stripQuery(value = "") {
  return String(value).split(/[?#]/, 1)[0];
}

function normalizeRelative(value) {
  return value.split(path.sep).join("/");
}

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(absolute) : [absolute];
  });
}
