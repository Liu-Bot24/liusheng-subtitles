import assert from "node:assert/strict";

import {
  buildConcatAudioArgs,
  buildExtractAudioArgs,
  inferExtensionFromMime,
  normalizeOutputFormat,
  safeFileStem,
  safeVirtualFileName,
  uniqueVirtualFileName
} from "../src/ffmpeg-options.js";

{
  const args = buildExtractAudioArgs({
    inputName: "input.mp4",
    outputName: "chunk-000.mp3"
  });
  assert.deepEqual(args, [
    "-i",
    "input.mp4",
    "-vn",
    "-map",
    "0:a:0?",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    "chunk-000.mp3"
  ]);
}

{
  const args = buildExtractAudioArgs({
    inputName: "input.mp4",
    outputName: "chunk-%03d.mp3",
    segmentSeconds: 900
  });
  assert.deepEqual(args, [
    "-i",
    "input.mp4",
    "-vn",
    "-map",
    "0:a:0?",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    "-f",
    "segment",
    "-segment_time",
    "900",
    "-reset_timestamps",
    "1",
    "chunk-%03d.mp3"
  ]);
}

{
  const args = buildConcatAudioArgs({
    inputNames: ["logical-001-part-001.mp3", "logical-001-part-002.mp3", "logical-001-part-003.mp3"],
    outputName: "logical-001.mp3"
  });
  assert.deepEqual(args, [
    "-i",
    "logical-001-part-001.mp3",
    "-i",
    "logical-001-part-002.mp3",
    "-i",
    "logical-001-part-003.mp3",
    "-filter_complex",
    "[0:a:0][1:a:0][2:a:0]concat=n=3:v=0:a=1[aout]",
    "-map",
    "[aout]",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "64k",
    "logical-001.mp3"
  ]);
}

{
  assert.equal(normalizeOutputFormat("wav"), "mp3");
  assert.equal(normalizeOutputFormat("m4a"), "mp3");
  assert.equal(normalizeOutputFormat("mp3"), "mp3");
}

{
  assert.equal(inferExtensionFromMime("audio/mpeg"), "mp3");
  assert.equal(inferExtensionFromMime("video/mp4"), "mp4");
  assert.equal(inferExtensionFromMime("application/octet-stream"), "bin");
}

{
  assert.equal(safeFileStem("https://example.com/path/video.m4s?token=1", "media"), "video");
  assert.equal(safeVirtualFileName("38301994613-1-30232.m4s", "input.bin"), "38301994613-1-30232.m4s");
  assert.equal(safeVirtualFileName("https://example.com/path/video.m4s?token=1", "input.bin"), "video.m4s");
  assert.equal(safeVirtualFileName("../bad/name?.m4s", "input.bin"), "name");
}

{
  const used = new Set();
  assert.equal(uniqueVirtualFileName("segment.m4s", used, "input.bin"), "segment.m4s");
  assert.equal(uniqueVirtualFileName("segment.m4s", used, "input.bin"), "segment-2.m4s");
  assert.equal(uniqueVirtualFileName("segment.m4s", used, "input.bin"), "segment-3.m4s");
}
