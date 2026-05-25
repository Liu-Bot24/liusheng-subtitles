import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const manifest = JSON.parse(fs.readFileSync(new URL("../../extension/manifest.json", import.meta.url), "utf8"));
const extensionCsp = manifest.content_security_policy?.extension_pages || "";
const extensionRoot = path.resolve(new URL("../../extension", import.meta.url).pathname);

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

assert.equal(manifest.background?.type, "module");
assert.equal(manifest.background?.service_worker, "src/background/service-worker.js");
const backgroundModuleSources = assertLocalModuleImportsExist(manifest.background.service_worker);

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

for (const [permission, apiName] of [
  ["alarms", "chrome.alarms"],
  ["offscreen", "chrome.offscreen"],
  ["declarativeNetRequestWithHostAccess", "chrome.declarativeNetRequest"],
  ["sidePanel", "chrome.sidePanel"],
  ["scripting", "chrome.scripting"],
  ["storage", "chrome.storage"],
  ["webNavigation", "chrome.webNavigation"],
  ["webRequest", "chrome.webRequest"]
]) {
  assert.ok(manifest.permissions.includes(permission), `${permission} permission missing`);
  assert.ok(backgroundModuleSources.includes(apiName), `${permission} permission has no ${apiName} product use`);
}

function assertLocalModuleImportsExist(entrypoint) {
  const seen = new Set();
  const stack = [entrypoint];
  const sources = [];
  while (stack.length) {
    const relative = normalizeRelative(stack.pop());
    if (!relative || seen.has(relative)) {
      continue;
    }
    seen.add(relative);
    const absolute = path.join(extensionRoot, relative);
    assert.equal(fs.existsSync(absolute), true, `module file missing: ${relative}`);
    const source = fs.readFileSync(absolute, "utf8");
    sources.push(source);
    for (const imported of localStaticImports(source)) {
      stack.push(resolveExtensionRelative(relative, imported));
    }
  }
  return sources.join("\n");
}

function localStaticImports(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(target => target.startsWith("./") || target.startsWith("../"));
}

function resolveExtensionRelative(baseFile, target) {
  return normalizeRelative(path.relative(
    extensionRoot,
    path.resolve(path.dirname(path.join(extensionRoot, baseFile)), target)
  ));
}

function normalizeRelative(value) {
  return String(value || "").split(path.sep).join("/");
}
