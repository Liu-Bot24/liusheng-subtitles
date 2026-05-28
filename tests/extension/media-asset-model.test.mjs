import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../extension/src/background/media-asset-model.js", import.meta.url), "utf8")
  .replace("export const FuguangMediaAssetModel =", "var FuguangMediaAssetModel =");
const context = vm.createContext({ Object, String, Number, Array, Math });
vm.runInContext(source, context, { filename: "media-asset-model.js" });

const model = context.FuguangMediaAssetModel;

{
  const asset = model.createMediaAsset({
    url: "https://delivery.example.test/playlists/media/audio-aac-192kbps.m3u8",
    kind: model.ASSET_KIND.HLS_MEDIA,
    role: model.MEDIA_ROLE.AUDIO,
    container: "hls",
    codecs: "mp4a.40.2",
    duration: 219,
    durationEvidence: model.createDurationEvidence(model.DURATION_EVIDENCE_SOURCE.MANIFEST, 219)
  });

  assert.equal(asset.kind, "hls-media");
  assert.equal(asset.role, "audio");
  assert.deepEqual(JSON.parse(JSON.stringify(asset.codecs)), ["mp4a.40.2"]);
  assert.equal(asset.durationEvidence.source, "manifest");
  assert.equal(asset.durationEvidence.strength, model.EVIDENCE_STRENGTH.MANIFEST_PARSE);
}

{
  const lowConfidenceAudio = model.createMediaAsset({
    url: "https://example.test/support-announcement.mp3",
    kind: model.ASSET_KIND.DIRECT,
    role: model.MEDIA_ROLE.AUDIO,
    duration: null,
    durationEvidence: null,
    evidence: [{ source: "response", strength: 20, detail: "audio/mpeg without media-element duration" }]
  });

  assert.equal(lowConfidenceAudio.duration, null);
  assert.equal(lowConfidenceAudio.durationEvidence, null);
  assert.equal(lowConfidenceAudio.evidence[0].source, "response");
}

{
  const pageDuration = model.createDurationEvidence(model.DURATION_EVIDENCE_SOURCE.PLAYER_JSON, 219);
  const manifestDuration = model.createDurationEvidence(model.DURATION_EVIDENCE_SOURCE.MANIFEST, 757);
  assert.equal(model.canDurationEvidenceCap(pageDuration, manifestDuration), true);
  assert.equal(model.strongerDurationEvidence(pageDuration, manifestDuration), pageDuration);
}

{
  const plan = model.createAudioSourcePlan({
    kind: "hls-audio",
    primaryAsset: {
      url: "https://cdn.example.test/audio.m3u8",
      kind: "hls-media",
      role: "audio",
      duration: 120
    },
    reason: "selected parsed audio rendition from HLS master",
    confidence: 1.2,
    ffmpegInput: { type: "hls", url: "https://cdn.example.test/audio.m3u8" },
    expectedAudio: { codec: "aac", duration: 120 }
  });

  assert.equal(plan.confidence, 1);
  assert.equal(plan.primaryAsset.role, "audio");
  assert.equal(plan.ffmpegInput.credentials, "include");
  assert.equal(plan.expectedAudio.container, "mp3-output");
}
