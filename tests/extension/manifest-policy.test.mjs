import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync(new URL("../../extension/manifest.json", import.meta.url), "utf8"));
const extensionCsp = manifest.content_security_policy?.extension_pages || "";
const releaseAudit = fs.readFileSync(new URL("../../release notes", import.meta.url), "utf8");

assert.match(extensionCsp, /connect-src[^;]*http:\/\/\*:\*/);
assert.doesNotMatch(extensionCsp, /connect-src[^;]*ws:\/\//);
assert.match(extensionCsp, /frame-src 'self'/);
assert.doesNotMatch(extensionCsp, /frame-src[^;]*https:\/\/\*/);
assert.doesNotMatch(extensionCsp, /frame-src[^;]*localhost/);
assert.ok(manifest.host_permissions.includes("<all_urls>"));
assert.equal(manifest.host_permissions.length, 1);
assert.equal(manifest.web_accessible_resources, undefined);
assert.equal(manifest.externally_connectable, undefined);
assert.equal(manifest.options_page, undefined);
assert.equal(manifest.devtools_page, undefined);
for (const permission of ["nativeMessaging", "tabCapture", "downloads", "management", "debugger"]) {
  assert.equal(manifest.permissions.includes(permission), false);
}
assert.equal(manifest.action?.default_popup, undefined);

const contentScripts = manifest.content_scripts || [];
assert.equal(contentScripts.length, 2);

const isolatedContentScript = contentScripts.find(script =>
  Array.isArray(script.js) &&
  script.js.includes("src/content/subtitle-overlay.js") &&
  script.js.includes("src/content/media-bridge.js")
);
assert.ok(isolatedContentScript, "isolated overlay/media bridge content script missing");
assert.deepEqual(isolatedContentScript.matches, ["http://*/*", "https://*/*"]);
assert.equal(isolatedContentScript.run_at, "document_start");
assert.equal(isolatedContentScript.all_frames, true);
assert.equal(isolatedContentScript.world, undefined);

const mainWorldSnifferScript = contentScripts.find(script =>
  Array.isArray(script.js) &&
  script.js.length === 1 &&
  script.js[0] === "src/content/page-sniffer.js"
);
assert.ok(mainWorldSnifferScript, "MAIN world page sniffer content script missing");
assert.deepEqual(mainWorldSnifferScript.matches, ["http://*/*", "https://*/*"]);
assert.equal(mainWorldSnifferScript.run_at, "document_start");
assert.equal(mainWorldSnifferScript.all_frames, true);
assert.equal(mainWorldSnifferScript.world, "MAIN");

const serviceWorker = fs.readFileSync(new URL("../../extension/src/background/service-worker.js", import.meta.url), "utf8");
for (const [permission, apiName] of [
  ["offscreen", "chrome.offscreen"],
  ["declarativeNetRequestWithHostAccess", "chrome.declarativeNetRequest"],
  ["sidePanel", "chrome.sidePanel"],
  ["scripting", "chrome.scripting"],
  ["storage", "chrome.storage"],
  ["webNavigation", "chrome.webNavigation"],
  ["webRequest", "chrome.webRequest"]
]) {
  assert.ok(manifest.permissions.includes(permission), `${permission} permission missing`);
  assert.ok(serviceWorker.includes(apiName), `${permission} permission has no ${apiName} product use`);
}

for (const permission of manifest.permissions) {
  assert.match(releaseAudit, new RegExp(`\\| \`${escapeRegExp(permission)}\` \\|`), `${permission} missing release-audit purpose`);
}
for (const hostPermission of manifest.host_permissions || []) {
  assert.match(releaseAudit, new RegExp(`\\| \`${escapeRegExp(hostPermission)}\` \\|`), `${hostPermission} missing release-audit purpose`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
