import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({
  URL,
  URLSearchParams,
  console,
  Object,
  String,
  Number,
  Array,
  Boolean,
  Math,
  Map,
  Set,
  RegExp,
  JSON
});

function loadModule(path, exportName, importLines = []) {
  let source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  for (const line of importLines) {
    source = source.replace(`${line}\n`, "");
  }
  source = source.replace(`export const ${exportName} =`, `var ${exportName} =`);
  vm.runInContext(source, context, { filename: path });
  return context[exportName];
}

const model = loadModule("../../extension/src/background/media-asset-model.js", "FuguangMediaAssetModel");
const hlsParser = loadModule("../../extension/src/background/hls-manifest-parser.js", "FuguangHlsManifestParser");
const dashParser = loadModule("../../extension/src/background/dash-manifest-parser.js", "FuguangDashManifestParser");
loadModule("../../extension/src/background/site-adapters/bilibili-media-adapter.js", "FuguangBilibiliMediaAdapter");
loadModule("../../extension/src/background/site-adapters/x-twitter-media-adapter.js", "FuguangXTwitterMediaAdapter");
loadModule("../../extension/src/background/site-adapters/youtube-media-adapter.js", "FuguangYoutubeMediaAdapter");
const resolvers = loadModule(
  "../../extension/src/background/media-source-resolvers.js",
  "FuguangMediaSourceResolvers",
  [
    'import { FuguangMediaAssetModel } from "./media-asset-model.js";',
    'import { FuguangHlsManifestParser } from "./hls-manifest-parser.js";',
    'import { FuguangDashManifestParser } from "./dash-manifest-parser.js";',
    'import { FuguangBilibiliMediaAdapter } from "./site-adapters/bilibili-media-adapter.js";',
    'import { FuguangXTwitterMediaAdapter } from "./site-adapters/x-twitter-media-adapter.js";',
    'import { FuguangYoutubeMediaAdapter } from "./site-adapters/youtube-media-adapter.js";'
  ]
);

function fixture(name) {
  return fs.readFileSync(new URL(`../fixtures/media-sites/${name}`, import.meta.url), "utf8");
}

{
  const media = hlsParser.parseMediaPlaylist(
    fixture("niconico-audio-aac-192kbps.m3u8"),
    "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/audio-aac-192kbps.m3u8"
  );
  assert.equal(media.segments.length, 2);
  assert.equal(media.containerHint, "fmp4");
  assert.equal(Math.round(media.duration * 1000), 7920);
}

{
  const videoUrl = "https://hls.ted.com/project_masters/1253/index-f9-v1.m3u8?intro_master_id=9294&preview=true";
  const audioUrl = "https://hls.ted.com/project_masters/1253/index-f8-a1.m3u8?intro_master_id=9294&preview=true";
  const plan = resolvers.resolveAudioSourcePlan({
    candidates: [{
      url: videoUrl,
      kind: "hls",
      ext: "m3u8",
      role: "playlist",
      duration: 1151
    }],
    manifestTextByUrl: {
      [videoUrl]: fixture("ted-index-f9-v1-video.m3u8"),
      [audioUrl]: fixture("ted-index-f8-a1-audio.m3u8")
    }
  });

  assert.equal(plan.kind, "hls-audio");
  assert.equal(plan.primaryAsset.url, audioUrl);
  assert.equal(plan.primaryAsset.role, "audio");
  assert.match(plan.reason, /sibling audio/);
}

{
  const audioUrl = "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/audio-aac-192kbps.m3u8?session=audio";
  const videoUrl = "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/video-h264-720p.m3u8?session=video";
  const plan = resolvers.resolveAudioSourcePlan({
    duration: 219,
    candidates: [
      { url: videoUrl, kind: "hls", ext: "m3u8", role: "playlist" },
      { url: audioUrl, kind: "hls", ext: "m3u8", role: "audio" }
    ],
    manifestTextByUrl: {
      [audioUrl]: fixture("niconico-audio-aac-192kbps.m3u8"),
      [videoUrl]: fixture("niconico-video-h264-720p.m3u8")
    }
  });

  assert.equal(plan.primaryAsset.url, audioUrl);
  assert.equal(plan.primaryAsset.container, "fmp4");
  assert.equal(plan.expectedAudio.container, "mp3-output");
}

{
  const selectedVideoUrl = "https://video.twimg.com/amplify_video/2049886560490053635/pl/avc1/480x270/video-playlist.m3u8?tag=27";
  const masterUrl = "https://video.twimg.com/amplify_video/2049886560490053635/pl/master.m3u8?tag=27";
  const plan = resolvers.resolveAudioSourcePlan({
    pageText: `<script>{"playlist":"${masterUrl.replace(/&/g, "&amp;")}"}</script>`,
    candidates: [{ url: selectedVideoUrl, kind: "hls", ext: "m3u8", role: "playlist", duration: 139 }],
    manifestTextByUrl: {
      [masterUrl]: fixture("x-amplify-master.m3u8")
    }
  });

  assert.equal(plan.kind, "hls-audio");
  assert.match(plan.primaryAsset.url, /\/mp4a\/128000\/audio-playlist\.m3u8$/);
  assert.equal(plan.primaryAsset.siteAdapter, "x-twitter");
  assert.match(plan.reason, /X\/Twitter/);
}

{
  const mpdUrl = "https://cdn.example.test/manifest/generic.mpd";
  const plan = resolvers.resolveAudioSourcePlan({
    candidates: [{ url: mpdUrl, kind: "dash", ext: "mpd", role: "playlist" }],
    manifestTextByUrl: {
      [mpdUrl]: fixture("generic-dash.mpd")
    }
  });

  assert.equal(plan.kind, "dash-audio");
  assert.equal(plan.primaryAsset.role, "audio");
  assert.equal(plan.expectedAudio.codec, "mp4a.40.2");
  assert.equal(plan.executable, false);
  assert.equal(plan.warnings[0].code, "unsupported-dash-audio");
}

{
  const mpdUrl = "https://cdn.example.test/manifest/self-closing.mpd";
  const plan = resolvers.resolveAudioSourcePlan({
    candidates: [{ url: mpdUrl, kind: "dash", ext: "mpd", role: "playlist" }],
    manifestTextByUrl: {
      [mpdUrl]: fixture("generic-dash-self-closing.mpd")
    }
  });

  assert.equal(plan.kind, "dash-audio");
  assert.equal(plan.primaryAsset.role, "audio");
  assert.equal(plan.primaryAsset.bitrate, 128000);
}

{
  const playinfo = JSON.parse(fixture("bilibili-playinfo-dash.json"));
  const plan = resolvers.resolveAudioSourcePlan({
    bilibiliPlayinfo: playinfo,
    candidates: []
  });

  assert.equal(plan.kind, "direct-audio");
  assert.match(plan.primaryAsset.url, /30232\.m4s$/);
  assert.equal(plan.primaryAsset.siteAdapter, "bilibili");
}

{
  const playerResponse = JSON.parse(fixture("youtube-player-response.json"));
  const assets = resolvers.youtubeAssetsFromPlayerResponse(playerResponse);
  assert.equal(assets.length, 1);
  assert.match(assets[0].url, /googlevideo\.com\/videoplayback/);
  assert.equal(assets[0].warnings[0].code, "requires-signature-deciphering");
  const plan = resolvers.resolveAudioSourcePlan({ candidates: assets });
  assert.equal(plan.kind, "direct-audio");
  assert.equal(plan.executable, false);
  assert.equal(plan.warnings[0].code, "requires-signature-deciphering");
}

{
  const assets = resolvers.youtubeAssetsFromPlayerResponse({
    streamingData: {
      adaptiveFormats: [{
        url: "https://www.youtube.com/s/search/audio/no_input.mp3",
        mimeType: "audio/mpeg",
        approxDurationMs: "1000"
      }]
    }
  });
  assert.equal(assets.length, 0);
}

{
  const directPlan = resolvers.resolveAudioSourcePlan({
    duration: 90,
    candidates: [{
      url: "https://cdn.example.test/media/audio-128k.m4a",
      kind: "audio",
      ext: "m4a",
      role: "audio",
      bitrate: 128000
    }]
  });
  assert.equal(directPlan.kind, "direct-audio");
  assert.equal(directPlan.primaryAsset.role, "audio");
  assert.equal(directPlan.ffmpegInput.type, "direct");
}

{
  const audioUrl = "https://delivery.domand.nicovideo.jp/hlsbid/test/playlists/media/audio-aac-192kbps.m3u8?session=audio";
  const plan = resolvers.resolveAudioSourcePlan({
    duration: 219,
    candidates: [{ url: audioUrl, kind: "hls", ext: "m3u8", role: "audio" }]
  });
  assert.equal(plan.kind, "hls-audio");
  assert.equal(plan.primaryAsset.url, audioUrl);
  assert.match(plan.reason, /track identity/);
}

{
  const incomplete = resolvers.assessFragmentGroupForAsr([
    { url: "https://cdn.example.test/audio/seg-00001.m4s", kind: "segment", role: "audio" },
    { url: "https://cdn.example.test/audio/seg-00002.m4s", kind: "segment", role: "audio" }
  ], { duration: 8 });
  assert.equal(incomplete.executable, false);
  assert.match(incomplete.reason, /missing init/);
  const incompletePlan = resolvers.resolveAudioSourcePlan({
    duration: 8,
    candidates: [
      { url: "https://cdn.example.test/audio/seg-00001.m4s", kind: "segment", role: "audio", duration: 4 },
      { url: "https://cdn.example.test/audio/seg-00002.m4s", kind: "segment", role: "audio", duration: 4 }
    ]
  });
  assert.equal(incompletePlan.kind, "mse-fragments");
  assert.equal(incompletePlan.executable, false);

  const reconstructable = resolvers.assessFragmentGroupForAsr([
    { url: "https://cdn.example.test/audio/init.mp4", kind: "segment", role: "audio" },
    { url: "https://cdn.example.test/audio/seg-00001.m4s", kind: "segment", role: "audio", duration: 4 },
    { url: "https://cdn.example.test/audio/seg-00002.m4s", kind: "segment", role: "audio", duration: 4 }
  ], { duration: 8 });
  assert.equal(reconstructable.executable, false);
  assert.equal(reconstructable.reconstructable, true);
  assert.equal(reconstructable.role, "audio");

  const plan = resolvers.resolveAudioSourcePlan({
    duration: 8,
    candidates: [
      { url: "https://cdn.example.test/audio/init.mp4", kind: "segment", role: "audio" },
      { url: "https://cdn.example.test/audio/seg-00001.m4s", kind: "segment", role: "audio", duration: 4 },
      { url: "https://cdn.example.test/audio/seg-00002.m4s", kind: "segment", role: "audio", duration: 4 }
    ]
  });
  assert.equal(plan.kind, "mse-fragments");
  assert.equal(plan.ffmpegInput.type, "mse-fragments");
  assert.equal(plan.executable, false);
  assert.equal(plan.warnings[0].code, "unsupported-mse-fragments");

  const mixed = resolvers.assessFragmentGroupForAsr([
    { url: "https://cdn.example.test/media/init.mp4", kind: "segment" },
    { url: "https://cdn.example.test/media/audio-00001.m4s", kind: "segment", role: "audio", duration: 4 },
    { url: "https://cdn.example.test/media/video-00001.m4s", kind: "segment", role: "video", duration: 4 }
  ], { duration: 8 });
  assert.equal(mixed.executable, false);
  assert.equal(mixed.reconstructable, false);
}
