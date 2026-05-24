import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sidepanel = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.js", import.meta.url), "utf8");
const background = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");
const architecture = fs.readFileSync(new URL("../../implementation notes", import.meta.url), "utf8");
const privacy = fs.readFileSync(new URL("../../docs/PRIVACY.md", import.meta.url), "utf8");
const strategy = fs.readFileSync(new URL("../../implementation notes", import.meta.url), "utf8");
const sidepanelHtml = fs.readFileSync(new URL("../../extension/src/sidepanel/sidepanel.html", import.meta.url), "utf8");

assert.equal(constNumber(sidepanel, "MODEL_SETTINGS_VERSION"), constNumber(background, "MODEL_SETTINGS_VERSION"));
assert.equal(constString(sidepanel, "DEFAULT_ASR_PROFILE_ID"), constString(background, "DEFAULT_ASR_PROFILE_ID"));
assert.equal(constString(sidepanel, "DEFAULT_LLM_PROFILE_ID"), constString(background, "DEFAULT_LLM_PROFILE_ID"));
assert.deepEqual(constObject(sidepanel, "KNOWN_ASR_PROFILES"), constObject(background, "KNOWN_ASR_PROFILES"));
assert.deepEqual(constObject(sidepanel, "KNOWN_LLM_PROFILES"), constObject(background, "KNOWN_LLM_PROFILES"));

const asrProfiles = constObject(background, "KNOWN_ASR_PROFILES");
const llmProfiles = constObject(background, "KNOWN_LLM_PROFILES");
assert.ok(asrProfiles.some(profile => profile.id === constString(background, "DEFAULT_ASR_PROFILE_ID")));
assert.ok(llmProfiles.some(profile => profile.id === constString(background, "DEFAULT_LLM_PROFILE_ID")));
assert.equal(asrProfiles.every(profile => profile.apiKey === ""), true);
assert.equal(llmProfiles.every(profile => profile.apiKey === ""), true);
assert.equal(asrProfiles.every(profile => ["auto", "on", "off"].includes(profile.vadFilter)), true);

const defaultSettings = constObject(background, "DEFAULT_MODEL_SETTINGS");
assert.equal(defaultSettings.chunkMinutes, 15);
assert.equal(constExpression(background, "BROWSER_ASR_UPLOAD_CHUNK_SECONDS"), 15 * 60);
assert.equal(constExpression(background, "BROWSER_ASR_MAX_UPLOAD_CHUNK_SECONDS"), 30 * 60);
assert.equal(constExpression(background, "BROWSER_ASR_MAX_UPLOAD_BYTES"), 25 * 1024 * 1024);
assert.match(architecture, /默认上传窗口是 15 分钟，上限 30 分钟/);
assert.match(architecture, /25MB 文件大小保护/);
assert.match(privacy, /API 密钥保存在本机浏览器的扩展本地存储中，不同步到浏览器账号/);
assert.match(strategy, /`on` 是用户确认端点兼容后手动强制发送 `vad_filter` 的例外/);
assert.match(sidepanelHtml, /强制开启（自建）/);

function constString(source, name) {
  const match = source.match(new RegExp(`const ${name} = "([^"]+)";`));
  assert.ok(match, `${name} string constant missing`);
  return match[1];
}

function constNumber(source, name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(match, `${name} number constant missing`);
  return Number(match[1]);
}

function constExpression(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
  assert.ok(match, `${name} expression constant missing`);
  return vm.runInNewContext(match[1], {});
}

function constObject(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  assert.ok(match, `${name} object constant missing`);
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${match[1]})`, {})));
}
