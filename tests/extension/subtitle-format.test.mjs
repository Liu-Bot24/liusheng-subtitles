import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/sidepanel/subtitle-format.js", import.meta.url), "utf8");
const context = vm.createContext({
  console,
  window: {},
  globalThis: {}
});
context.window = context;
context.globalThis = context;
vm.runInContext(source, context, { filename: "subtitle-format.js" });

const { parseSubtitleImportText } = context.FuguangSubtitleFormat;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

{
  const result = parseSubtitleImportText(`1
00:00:01,200 --> 00:00:03,400
第一句字幕

2
00:00:04,000 --> 00:00:05,500
第二句字幕
`, { filename: "sample.srt" });

  assert.equal(result.format, "srt");
  assert.equal(result.transcript.source.length, 0);
  assert.equal(result.transcript.translated.length, 2);
  assert.deepEqual(plain(result.transcript.translated[0]), {
    start: 1.2,
    end: 3.4,
    text: "第一句字幕"
  });
}

{
  const result = parseSubtitleImportText(`WEBVTT

NOTE 这是一条注释

00:00:07.100 --> 00:00:08.300 align:start
<b>Hello</b> world
`, { filename: "sample.vtt" });

  assert.equal(result.format, "vtt");
  assert.equal(result.transcript.translated.length, 1);
  assert.deepEqual(plain(result.transcript.translated[0]), {
    start: 7.1,
    end: 8.3,
    text: "Hello world"
  });
}

{
  const result = parseSubtitleImportText(`[Script Info]
Title: test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:01:02.50,0:01:05.00,Default,,0,0,0,,{\\i1}Hello\\NASS
`, { filename: "sample.ass" });

  assert.equal(result.format, "ass");
  assert.equal(result.transcript.translated.length, 1);
  assert.deepEqual(plain(result.transcript.translated[0]), {
    start: 62.5,
    end: 65,
    text: "Hello ASS"
  });
}

{
  const result = parseSubtitleImportText(JSON.stringify({
    format: "fuguang-subtitle",
    pageUrl: "https://example.test/watch",
    title: "测试视频",
    transcript: {
      source: [{ start: 1, end: 2, text: "hello" }],
      translated: [{ start: 1, end: 2, text: "你好" }]
    }
  }), { filename: "fuguang.json" });

  assert.equal(result.format, "json");
  assert.equal(result.metadata.pageUrl, "https://example.test/watch");
  assert.equal(result.metadata.title, "测试视频");
  assert.equal(result.transcript.source[0].text, "hello");
  assert.equal(result.transcript.translated[0].text, "你好");
}

{
  const result = parseSubtitleImportText(JSON.stringify({
    format: "fuguang-subtitle",
    transcript: {
      source: [
        { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
        { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
      ],
      translated: [
        { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
      ]
    }
  }), { filename: "fuguang.json" });

  assert.deepEqual(plain(result.transcript.source), [
    { start: 0, end: 2, text: "source first", chunkIndex: 0, segmentIndex: 0 },
    { start: 3, end: 5, text: "source second", chunkIndex: 1, segmentIndex: 0 }
  ]);
  assert.deepEqual(plain(result.transcript.translated), [
    { start: 3, end: 5, text: "translated second", chunkIndex: 1, segmentIndex: 0 }
  ]);
}

assert.throws(
  () => parseSubtitleImportText("这只是普通文本，没有时间轴。", { filename: "note.txt" }),
  /无法识别字幕文件格式/
);
