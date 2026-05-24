import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fuguang-release-existing-zip-"));
const packageRoot = path.join(tmpDir, "package");
const zipPath = path.join(tmpDir, "bad-extension.zip");

try {
  writeFile("manifest.json", "{}\n");
  writeFile("src/background/service-worker.js", "\n");
  writeFile("src/offscreen/offscreen.js", "\n");
  writeFile("web-ffmpeg/index.html", "<!doctype html>\n");
  writeFile("web-ffmpeg/vendor/@ffmpeg/core/ffmpeg-core.wasm", "");
  writeFile("helper/legacy.txt", "legacy helper must not be packaged\n");
  childProcess.execFileSync("zip", ["-qr", zipPath, "."], { cwd: packageRoot });

  const result = childProcess.spawnSync(
    process.execPath,
    ["tests/extension/release-package.test.mjs"],
    {
      cwd: repoRoot,
      env: { ...process.env, FUGUANG_RELEASE_ZIP: zipPath },
      encoding: "utf8"
    }
  );

  assert.notEqual(result.status, 0, "existing release zip with helper/ should fail package audit");
  assert.match(`${result.stdout}\n${result.stderr}`, /helper packaged: helper\//);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function writeFile(relativePath, content) {
  const absolute = path.join(packageRoot, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}
