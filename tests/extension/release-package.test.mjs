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
  const entries = childProcess.execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n")
    .map(entry => entry.trim())
    .filter(Boolean)
    .sort();

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
  }
} finally {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
