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

test("segments get no page duration in the candidate list, Bilibili CDN included", () => {
  const state = {
    candidates: [
      { url: "https://upos-sz-mirror.bilivideo.com/upgcxcode/seg-3.ts", source: "webrequest", kind: "media", ext: "ts" },
      { url: "https://cdn.example.test/hls/seg-3.ts", source: "webrequest", kind: "media", ext: "ts" }
    ],
    context: { duration: 660, hasMedia: true },
    page: { url: "https://www.bilibili.com/video/BV1x" }
  };
  for (const candidate of candidates.getGroupedCandidatesForState(state)) {
    assert.equal(candidate.duration, null, candidate.url);
  }
});
