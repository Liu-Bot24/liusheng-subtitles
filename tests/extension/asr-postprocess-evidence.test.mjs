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

test("frequent repeats reported as clear speech are kept", () => {
  for (const phrase of ["Thank you so much", "谢谢大家", "ありがとうございます"]) {
    const output = postprocess.filterAsrDistributedRepeatedRuns(
      distributedRun(phrase, { noSpeechProbability: 0.01, avgLogProbability: -0.1 })
    );
    assert.equal(output.filter(segment => segment.text === phrase).length, 8, phrase);
  }
});

test("frequent repeats without quality numbers or with weak quality are still dropped", () => {
  const blind = postprocess.filterAsrDistributedRepeatedRuns(distributedRun("Thank you for watching"));
  assert.equal(blind.some(segment => segment.text === "Thank you for watching"), false);
  const weak = postprocess.filterAsrDistributedRepeatedRuns(
    distributedRun("Thank you for watching", { noSpeechProbability: 0.85, avgLogProbability: -1.4 })
  );
  assert.equal(weak.some(segment => segment.text === "Thank you for watching"), false);
});

test("a long low-information line is kept only when the recognizer is confident", () => {
  const confident = normalizeOne({ start: 0, end: 3.5, text: "对对对", no_speech_prob: 0.02, avg_logprob: -0.15 });
  assert.equal(confident.length, 1);
  const blind = normalizeOne({ start: 0, end: 3.5, text: "对对对" });
  assert.equal(blind.length, 0);
  const weak = normalizeOne({ start: 0, end: 3.5, text: "对对对", no_speech_prob: 0.8, avg_logprob: -1.3 });
  assert.equal(weak.length, 0);
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
