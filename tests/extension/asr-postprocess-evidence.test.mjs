import assert from "node:assert/strict";
import test from "node:test";

const { FuguangBrowserAsrPostprocess: postprocess } = await import(
  new URL("../../extension/src/background/browser-asr-postprocess.js", import.meta.url)
);

const CHUNK = { start: 0, end: 30, speechIntervalsReliable: false };

function normalizeOne(segment) {
  return postprocess.normalizeAsrSegments({ segments: [segment] }, 0, 30, { providerType: "openai" });
}

function distributedRun(phrase, quality) {
  const segments = [];
  for (let index = 0; index < 8; index += 1) {
    const start = index * 45;
    segments.push({ start, end: start + 1.5, text: phrase, ...(quality ? { asrQuality: quality } : {}) });
    segments.push({ start: start + 10, end: start + 11.5, text: `different line ${index}`, ...(quality ? { asrQuality: quality } : {}) });
  }
  return segments;
}

// Whisper emits its hallucinations with quality numbers inside its own acceptance thresholds, so those
// numbers must not be enough to keep a line the repeat or low-information rules flag.
const HALLUCINATION_QUALITY = { noSpeechProbability: 0.3, avgLogProbability: -0.4 };

test("frequent repeats are dropped even when their quality numbers look like speech", () => {
  for (const phrase of ["Thank you for watching", "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目", "ご視聴ありがとうございました"]) {
    for (const quality of [undefined, HALLUCINATION_QUALITY, { noSpeechProbability: 0.01, avgLogProbability: -0.1 }]) {
      const output = postprocess.filterAsrDistributedRepeatedRuns(distributedRun(phrase, quality));
      assert.equal(output.some(segment => segment.text === phrase), false, phrase);
      assert.equal(output.filter(segment => segment.text.startsWith("different line")).length, 8);
    }
  }
});

test("a long low-information line is dropped whatever its quality numbers say", () => {
  for (const extra of [{}, { no_speech_prob: 0.4, avg_logprob: -0.5 }, { no_speech_prob: 0.02, avg_logprob: -0.15 }]) {
    assert.equal(normalizeOne({ start: 0, end: 3.5, text: "对对对", ...extra }).length, 0);
  }
  assert.equal(normalizeOne({ start: 0, end: 1.2, text: "对对对", no_speech_prob: 0.02, avg_logprob: -0.15 }).length, 1);
});

test("the no-speech check reads the quality numbers normalized segments actually carry", () => {
  const normalized = normalizeOne({
    start: 0,
    end: 9,
    text: "so long word",
    no_speech_prob: 0.9,
    avg_logprob: -0.2,
    words: [
      { start: 0, end: 0.5, word: "so", probability: 0.9 },
      { start: 0.5, end: 4.5, word: "long", probability: 0.9 },
      { start: 4.5, end: 9, word: "word", probability: 0.9 }
    ]
  });
  assert.ok(normalized[0]?.asrQuality, "normalized output keeps quality under asrQuality");
  assert.equal("rawSegment" in normalized[0], false);
  assert.equal(
    postprocess.filterAsrSegmentsByHallucinationGuard(normalized, CHUNK, { disableCustomRunFilters: true }).length,
    0
  );
});

const CREDIT = "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目";

test("known subtitle-credit lines are removed even when they appear once", () => {
  for (const text of [CREDIT, "請不吝點贊 訂閱 轉發 打賞支持明鏡與點點欄目", "字幕由Amara.org社区提供", "中文字幕志愿者 李宗盛"]) {
    for (const options of [{ providerType: "openai" }, { providerType: "openai", disableCustomRunFilters: true, disableCustomQualityFilters: true }]) {
      const output = postprocess.normalizeAsrSegments({
        segments: [
          { start: 0, end: 2, text: "今天就讲到这里" },
          { start: 25, end: 29, text, no_speech_prob: 0.3, avg_logprob: -0.4 }
        ]
      }, 0, 30, options);
      assert.deepEqual(output.map(segment => segment.text), ["今天就讲到这里"], text);
    }
  }
});

test("a credit line appended to real speech removes only that sentence and its words", () => {
  const output = postprocess.filterAsrKnownHallucinationPhrases([{
    start: 0,
    end: 6,
    text: `今天就讲到这里。${CREDIT}`,
    words: [
      { start: 0, end: 0.6, text: "今天" },
      { start: 0.6, end: 1.2, text: "就讲到" },
      { start: 1.2, end: 1.8, text: "这里。" },
      { start: 2.5, end: 3.5, text: "请不吝点赞" },
      { start: 3.5, end: 4.5, text: "订阅转发" },
      { start: 4.5, end: 6, text: "打赏支持明镜与点点栏目" }
    ]
  }]);
  assert.equal(output.length, 1);
  assert.equal(output[0].text, "今天就讲到这里。");
  assert.equal(output[0].words.length, 3);
  assert.equal(output[0].end, 1.8);
});

test("ordinary speech about likes, subscriptions or subtitles is kept", () => {
  const lines = [
    "记得点赞订阅",
    "喜欢的话请点赞订阅转发",
    "Thank you for watching",
    "感谢字幕组的辛苦付出",
    "明镜高悬",
    "我们去优酷看剧吧"
  ];
  const segments = lines.map((text, index) => ({ start: index * 3, end: index * 3 + 2, text }));
  assert.deepEqual(postprocess.filterAsrKnownHallucinationPhrases(segments).map(segment => segment.text), lines);
});
