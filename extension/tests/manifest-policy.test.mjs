import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const extensionCsp = manifest.content_security_policy?.extension_pages || "";

assert.match(extensionCsp, /connect-src[^;]*http:\/\/\*:\*/);
assert.match(extensionCsp, /connect-src[^;]*ws:\/\/\*:\*/);
assert.ok(manifest.host_permissions.includes("<all_urls>"));
