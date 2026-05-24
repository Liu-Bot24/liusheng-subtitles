import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const extensionRoot = path.join(repoRoot, "extension");
const providedZipPath = process.env.FUGUANG_RELEASE_ZIP || process.argv[2] || "";
const tmpDir = providedZipPath ? "" : fs.mkdtempSync(path.join(os.tmpdir(), "fuguang-release-"));
const zipPath = providedZipPath ? path.resolve(providedZipPath) : path.join(tmpDir, "extension.zip");

try {
  if (providedZipPath) {
    assert.equal(fs.existsSync(zipPath), true, `release zip does not exist: ${zipPath}`);
  } else {
    childProcess.execFileSync("zip", ["-qr", zipPath, "."], { cwd: extensionRoot });
  }
  verifyReleaseZip(zipPath);
  verifyZipOnlyExtraEntryIsRejected();
} finally {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function verifyReleaseZip(targetZipPath) {
  const entries = zipEntries(targetZipPath);
  const fileEntries = entries.filter(entry => !entry.endsWith("/")).sort();
  const expectedFiles = listExtensionFiles(extensionRoot).sort();

  assert.ok(entries.includes("manifest.json"));
  assert.ok(entries.includes("src/background/service-worker.js"));
  assert.ok(entries.includes("src/offscreen/offscreen.js"));
  assert.ok(entries.includes("web-ffmpeg/index.html"));
  assert.ok(entries.includes("web-ffmpeg/vendor/@ffmpeg/core/ffmpeg-core.wasm"));

  for (const entry of entries) {
    assert.equal(entry.startsWith(".git/"), false, `git internals packaged: ${entry}`);
    assert.equal(entry.startsWith("helper/"), false, `helper packaged: ${entry}`);
    assert.equal(entry.startsWith("tests/"), false, `tests packaged: ${entry}`);
    assert.equal(entry.startsWith("src/popup/"), false, `old popup packaged: ${entry}`);
    assert.equal(entry.includes("/tests/"), false, `nested tests packaged: ${entry}`);
    assert.equal(entry.includes(".env"), false, `env file packaged: ${entry}`);
    assert.equal(entry.endsWith(".log"), false, `log file packaged: ${entry}`);
    assert.equal(entry.endsWith(".tmp"), false, `tmp file packaged: ${entry}`);
    assert.equal(entry.endsWith(".zip"), false, `zip file packaged: ${entry}`);
    assert.equal(entry.endsWith(".DS_Store"), false, `OS noise packaged: ${entry}`);
    assert.equal(isAllowedReleaseEntry(entry), true, `unexpected release zip entry: ${entry}`);
  }

  assert.deepEqual(fileEntries, expectedFiles, releaseFileListDiffMessage(expectedFiles, fileEntries));

  for (const entry of expectedFiles) {
    const packaged = childProcess.execFileSync("unzip", ["-p", targetZipPath, entry], { maxBuffer: 64 * 1024 * 1024 });
    const current = fs.readFileSync(path.join(extensionRoot, entry));
    assert.deepEqual(packaged, current, `release zip content differs from current extension file: ${entry}`);
  }
}

function zipEntries(targetZipPath) {
  return childProcess.execFileSync("unzip", ["-Z1", targetZipPath], { encoding: "utf8" })
    .split("\n")
    .map(entry => entry.trim())
    .filter(Boolean)
    .sort();
}

function listExtensionFiles(root) {
  const files = [];
  function walk(dir, prefix = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
  walk(root);
  return files;
}

function releaseFileListDiffMessage(expectedFiles, actualFiles) {
  const expected = new Set(expectedFiles);
  const actual = new Set(actualFiles);
  const extra = actualFiles.filter(entry => !expected.has(entry));
  const missing = expectedFiles.filter(entry => !actual.has(entry));
  return [
    "release zip file list must match current extension",
    `unexpected release zip files: ${extra.join(", ") || "(none)"}`,
    `missing release zip files: ${missing.join(", ") || "(none)"}`
  ].join("\n");
}

function verifyZipOnlyExtraEntryIsRejected() {
  const badZipTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuguang-release-bad-"));
  try {
    const badZipPath = path.join(badZipTmpDir, "bad-extension.zip");
    childProcess.execFileSync("zip", ["-qr", badZipPath, "."], { cwd: extensionRoot });
    const injectRoot = path.join(badZipTmpDir, "inject");
    const injectedFile = path.join(injectRoot, "src", "unused-helper.js");
    fs.mkdirSync(path.dirname(injectedFile), { recursive: true });
    fs.writeFileSync(injectedFile, "console.log('unused helper');\n");
    childProcess.execFileSync("zip", ["-q", badZipPath, "src/unused-helper.js"], { cwd: injectRoot });
    assert.throws(
      () => verifyReleaseZip(badZipPath),
      /unexpected release zip files: src\/unused-helper\.js/
    );
  } finally {
    fs.rmSync(badZipTmpDir, { recursive: true, force: true });
  }
}

function isAllowedReleaseEntry(entry) {
  return entry === "manifest.json"
    || entry === "assets/"
    || entry.startsWith("assets/")
    || entry === "src/"
    || entry.startsWith("src/")
    || entry === "web-ffmpeg/"
    || entry.startsWith("web-ffmpeg/");
}
