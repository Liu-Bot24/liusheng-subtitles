import assert from "node:assert/strict";

import { FuguangDashManifestParser as BackgroundDashParser } from "../../extension/src/background/dash-manifest-parser.js";
import { FuguangHlsManifestParser } from "../../extension/src/background/hls-manifest-parser.js";
import { FuguangDashManifestParser } from "../../extension/src/shared/dash-manifest-parser.js";
import { FuguangHlsUrlHelpers } from "../../extension/src/shared/hls-url-helpers.js";

assert.equal(BackgroundDashParser, FuguangDashManifestParser);
assert.equal(typeof FuguangDashManifestParser.parse, "function");
assert.equal(typeof FuguangDashManifestParser.expandRepresentationFragments, "function");
assert.equal(typeof FuguangDashManifestParser.isUnsupportedWebmOpusRepresentation, "function");
assert.equal(typeof FuguangDashManifestParser.fragmentsContainUnsupportedWebmOpus, "function");

assert.equal(typeof FuguangHlsUrlHelpers.buildAudioSiblingUrls, "function");
assert.equal(typeof FuguangHlsUrlHelpers.buildLikelyAudioCompanionPlaylistUrls, "function");
assert.equal(typeof FuguangHlsUrlHelpers.inferHlsRoleFromUrl, "function");

assert.equal(
  FuguangHlsManifestParser.inferHlsRoleFromUrl("https://cdn.example.test/audio-aac-192kbps.m3u8"),
  FuguangHlsUrlHelpers.inferHlsRoleFromUrl("https://cdn.example.test/audio-aac-192kbps.m3u8")
);
