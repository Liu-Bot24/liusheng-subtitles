import assert from "node:assert/strict";
import test from "node:test";

const { FuguangBrowserMediaCandidates: candidates } = await import(
  new URL("../../extension/src/background/browser-media-candidates.js", import.meta.url)
);

test("network-captured MPEG-TS segments are recognized as segments", () => {
  assert.equal(candidates.isMpegTsSegmentCandidate({ url: "https://cdn.example.test/hls/seg-12.ts", source: "webrequest" }), true);
  assert.equal(candidates.isMpegTsSegmentCandidate({ url: "https://cdn.example.test/chunk?id=4", contentType: "video/mp2t" }), true);
  assert.equal(candidates.isMpegTsSegmentCandidate({ url: "https://cdn.example.test/v.ts", ext: "ts", source: "fetch-url" }), true);
});

test("whole recordings keep their page duration", () => {
  assert.equal(candidates.isMpegTsSegmentCandidate({ url: "https://cdn.example.test/full.ts", source: "media-element" }), false);
  assert.equal(candidates.isMpegTsSegmentCandidate({ url: "file:///D:/videos/recording.ts", ext: "ts" }), false);
  assert.equal(candidates.isMpegTsSegmentCandidate({ url: "https://cdn.example.test/video.mp4", source: "webrequest" }), false);
});
