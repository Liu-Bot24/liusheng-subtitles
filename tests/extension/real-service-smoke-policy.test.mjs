import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const smokePath = path.join(repoRoot, "tests/smoke/real-speaches-llm-hls-smoke.mjs");
const smokeSource = fs.readFileSync(smokePath, "utf8");

{
  const result = spawnSync(process.execPath, [smokePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FUGUANG_ALLOW_REAL_SERVICES: "",
      LLM_API_KEY: "",
      SPEACHES_BASE_URL: "http://127.0.0.1:9/v1"
    },
    encoding: "utf8",
    timeout: 10_000
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /FUGUANG_ALLOW_REAL_SERVICES=1 is required/);
  assert.doesNotMatch(result.stdout, /REAL_HLS_SMOKE_STATUS=/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Speaches models check failed|ECONNREFUSED|playwright|chromium/i);
}

{
  const result = spawnSync(process.execPath, [smokePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FUGUANG_ALLOW_REAL_SERVICES: "1",
      LLM_API_KEY: "",
      SPEACHES_BASE_URL: "http://127.0.0.1:9/v1"
    },
    encoding: "utf8",
    timeout: 10_000
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /LLM_API_KEY is required/);
  assert.doesNotMatch(result.stdout, /REAL_HLS_SMOKE_STATUS=/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Speaches models check failed|ECONNREFUSED|playwright|chromium/i);
}

{
  assert.match(smokeSource, /const realSmokeVerbose = process\.env\.FUGUANG_REAL_SMOKE_VERBOSE === "1";/);
  assert.match(smokeSource, /REAL_HLS_SMOKE_SOURCE_COUNT=/);
  assert.match(smokeSource, /REAL_HLS_SMOKE_TRANSLATED_COUNT=/);
  assert.match(smokeSource, /REAL_HLS_SMOKE_VTT_BYTES=/);
  assert.match(smokeSource, /if \(realSmokeVerbose\) \{/);
  assert.match(smokeSource, /REAL_HLS_SMOKE_SOURCE_VERBOSE=/);
  assert.match(smokeSource, /REAL_HLS_SMOKE_TRANSLATED_VERBOSE=/);
  assert.match(smokeSource, /REAL_HLS_SMOKE_VTT_VERBOSE=/);
  assert.doesNotMatch(smokeSource, /REAL_HLS_SMOKE_SOURCE=\$\{JSON\.stringify/);
  assert.doesNotMatch(smokeSource, /REAL_HLS_SMOKE_TRANSLATED=\$\{JSON\.stringify/);
  assert.doesNotMatch(smokeSource, /REAL_HLS_SMOKE_VTT=\$\{JSON\.stringify/);
  assert.doesNotMatch(smokeSource, /REAL_HLS_SMOKE_HISTORY_TAIL=\$\{JSON\.stringify/);
  const verboseBlock = smokeSource.match(/if \(realSmokeVerbose\) \{\n([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(verboseBlock, /REAL_HLS_SMOKE_SOURCE_VERBOSE=/);
  assert.match(verboseBlock, /REAL_HLS_SMOKE_TRANSLATED_VERBOSE=/);
  assert.match(verboseBlock, /REAL_HLS_SMOKE_VTT_VERBOSE=/);
  const withoutVerboseBlock = smokeSource.replace(/if \(realSmokeVerbose\) \{\n[\s\S]*?\n  \}/, "");
  assert.doesNotMatch(withoutVerboseBlock, /REAL_HLS_SMOKE_(?:ERROR|SOURCE|TRANSLATED|VTT|HISTORY_TAIL)_VERBOSE=/);
}
