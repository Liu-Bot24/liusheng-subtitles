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
loadModule("../../extension/src/shared/hls-url-helpers.js", "FuguangHlsUrlHelpers");
const hlsParser = loadModule(
  "../../extension/src/background/hls-manifest-parser.js",
  "FuguangHlsManifestParser",
  ['import { FuguangHlsUrlHelpers } from "../shared/hls-url-helpers.js";']
);
const dashParser = loadModule("../../extension/src/shared/dash-manifest-parser.js", "FuguangDashManifestParser");
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
  const selectedVideoUrl = "https://video.twimg.com/amplify_video/2059183692569071878/pl/avc1/650x360/_6Jux_HKzlwgTTC3.m3u8?tag=16";
  const plan = resolvers.resolveAudioSourcePlan({
    duration: 82,
    candidates: [
      { url: selectedVideoUrl, kind: "hls", ext: "m3u8", role: "playlist", duration: 82 },
      { url: "https://video.twimg.com/amplify_video/2059183692569071878/seg-00001.m4s", kind: "segment", ext: "m4s", role: "audio", duration: 82 },
      { url: "https://video.twimg.com/amplify_video/2059183692569071878/seg-00002.m4s", kind: "segment", ext: "m4s", role: "audio", duration: 82 }
    ]
  });

  assert.equal(plan.kind, "mse-fragments");
  assert.equal(plan.executable, false);
  assert.match(plan.warnings[0].code, /unsupported-mse-fragments/);
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
  assert.equal(plan.executable, true);
  assert.equal(plan.ffmpegInput.type, "dash");
  assert.equal(plan.ffmpegInput.fragments.length, 3);
  assert.equal(plan.ffmpegInput.fragments[0].segmentType, "init");
  assert.match(plan.ffmpegInput.fragments[0].url, /\/manifest\/audio\/init\.mp4$/);
  assert.match(plan.ffmpegInput.fragments[1].url, /\/manifest\/audio\/seg-1\.m4s$/);
  assert.match(plan.ffmpegInput.fragments[2].url, /\/manifest\/audio\/seg-2\.m4s$/);
  assert.equal(plan.normalizeStrategy.type, "dash-manifest");
  assert.equal(plan.normalizeStrategy.action, "parse-manifest-extract-audio");
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
  const mpdUrl = "https://cdn.example.test/manifest/webm-opus.mpd";
  const plan = resolvers.resolveAudioSourcePlan({
    candidates: [{ url: mpdUrl, kind: "dash", ext: "mpd", role: "playlist" }],
    manifestTextByUrl: {
      [mpdUrl]: `<?xml version="1.0"?>
<MPD mediaPresentationDuration="PT10S">
  <Period>
    <AdaptationSet mimeType="audio/webm" contentType="audio" codecs="opus">
      <Representation id="audio-opus" bandwidth="96000">
        <BaseURL>audio/</BaseURL>
        <SegmentTemplate initialization="init.webm" media="seg-$Number$.webm" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="5000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`
    }
  });

  assert.equal(plan.kind, "dash-audio");
  assert.equal(plan.executable, false);
  assert.match(plan.warnings[0].message, /DASH WebM\/Opus/);
}

{
  const mpdUrl = "https://cdn.example.test/manifest/mp4-opus.mpd";
  const plan = resolvers.resolveAudioSourcePlan({
    candidates: [{ url: mpdUrl, kind: "dash", ext: "mpd", role: "playlist" }],
    manifestTextByUrl: {
      [mpdUrl]: `<?xml version="1.0"?>
<MPD mediaPresentationDuration="PT10S">
  <Period>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" codecs="opus">
      <Representation id="audio-opus-mp4" bandwidth="96000">
        <BaseURL>audio/</BaseURL>
        <SegmentTemplate initialization="init.mp4" media="seg-$Number$.m4s" startNumber="1" timescale="1000">
          <SegmentTimeline>
            <S d="5000" r="1" />
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`
    }
  });

  assert.equal(plan.kind, "dash-audio");
  assert.equal(plan.executable, true);
  assert.equal(plan.expectedAudio.codec, "opus");
  assert.equal(plan.ffmpegInput.fragments.length, 3);
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
  assert.equal(directPlan.normalizeStrategy.type, "direct-audio-file");
  assert.equal(directPlan.normalizeStrategy.action, "transcode-or-remux-audio");
}

{
  const muxedPlan = resolvers.resolveAudioSourcePlan({
    duration: 42,
    candidates: [{
      url: "https://cdn.example.test/media/clip.mp4",
      kind: "video",
      ext: "mp4",
      role: "video",
      contentType: "video/mp4",
      duration: 42
    }]
  });
  assert.equal(muxedPlan.kind, "muxed-media");
  assert.equal(muxedPlan.primaryAsset.role, "muxed");
  assert.equal(muxedPlan.ffmpegInput.type, "direct");
  assert.equal(muxedPlan.normalizeStrategy.type, "muxed-media-file");
  assert.equal(muxedPlan.normalizeStrategy.action, "extract-audio-track");
}

{
  const xVideoOnlyPlan = resolvers.resolveAudioSourcePlan({
    duration: 82,
    candidates: [{
      url: "https://video.twimg.com/amplify_video/2058958000000000001/vid/avc1/2160x2160/mYURGjflKU62W4IR.mp4?tag=27",
      kind: "media",
      ext: "mp4",
      role: "video",
      contentType: "video/mp4",
      duration: 82
    }]
  });
  assert.equal(xVideoOnlyPlan, null);
}

{
  const audioOnlyPlan = resolvers.resolveAudioSourcePlan({
    duration: 42,
    candidates: [{
      url: "https://cdn.example.test/media/audio-track.mp4",
      kind: "audio",
      ext: "mp4",
      role: "audio",
      contentType: "audio/mp4",
      duration: 42
    }]
  });
  assert.equal(audioOnlyPlan.kind, "direct-audio");
  assert.equal(audioOnlyPlan.primaryAsset.role, "audio");
  assert.equal(audioOnlyPlan.normalizeStrategy.type, "direct-audio-file");
}

{
  const cases = [
    {
      url: "https://cdn.example.test/media/speech.webm",
      ext: "webm",
      contentType: "audio/webm; codecs=opus",
      expectedCodec: "audio/webm; codecs=opus"
    },
    {
      url: "https://cdn.example.test/media/speech.weba",
      ext: "weba",
      contentType: "audio/webm",
      expectedCodec: "audio/webm"
    },
    {
      url: "https://cdn.example.test/media/speech.opus",
      ext: "opus",
      contentType: "audio/ogg; codecs=opus",
      expectedCodec: "audio/ogg; codecs=opus"
    },
    {
      url: "https://cdn.example.test/media/speech.ogg",
      ext: "ogg",
      contentType: "audio/ogg",
      expectedCodec: "audio/ogg"
    }
  ];
  for (const item of cases) {
    const plan = resolvers.resolveAudioSourcePlan({
      duration: 30,
      candidates: [{
        url: item.url,
        kind: "audio",
        ext: item.ext,
        role: "audio",
        contentType: item.contentType,
        duration: 30
      }]
    });
    assert.equal(plan.kind, "direct-audio");
    assert.equal(plan.primaryAsset.role, "audio");
    assert.equal(plan.ffmpegInput.type, "direct");
    assert.equal(plan.normalizeStrategy.type, "direct-audio-file");
    assert.equal(plan.expectedAudio.codec, item.expectedCodec);
  }
}

{
  const plan = resolvers.resolveAudioSourcePlan({
    duration: 12,
    candidates: [
      {
        url: "https://cdn.example.test/audio/init.webm",
        kind: "segment",
        ext: "webm",
        role: "audio",
        contentType: "audio/webm; codecs=opus"
      },
      {
        url: "https://cdn.example.test/audio/seg-00001.webm",
        kind: "segment",
        ext: "webm",
        role: "audio",
        contentType: "audio/webm; codecs=opus",
        duration: 6
      },
      {
        url: "https://cdn.example.test/audio/seg-00002.webm",
        kind: "segment",
        ext: "webm",
        role: "audio",
        contentType: "audio/webm; codecs=opus",
        duration: 6
      }
    ]
  });
  assert.equal(plan.kind, "mse-fragments");
  assert.equal(plan.executable, false);
  assert.match(plan.warnings[0].message, /WebM\/Opus fragments/);
}

{
  const plan = resolvers.resolveAudioSourcePlan({
    duration: 8,
    candidates: [
      {
        url: "https://cdn.example.test/mixed/init.mp4",
        kind: "segment",
        ext: "mp4",
        role: "audio",
        contentType: "audio/mp4"
      },
      {
        url: "https://cdn.example.test/mixed/seg-00001.m4s",
        kind: "segment",
        ext: "m4s",
        role: "audio",
        contentType: "audio/mp4",
        duration: 4
      },
      {
        url: "https://cdn.example.test/mixed/seg-00002.m4s",
        kind: "segment",
        ext: "m4s",
        role: "audio",
        contentType: "audio/mp4",
        duration: 4
      },
      {
        url: "https://cdn.example.test/mixed/seg-00001.webm",
        kind: "segment",
        ext: "webm",
        role: "audio",
        contentType: "audio/webm; codecs=opus",
        duration: 4
      }
    ]
  });
  assert.equal(plan.kind, "mse-fragments");
  assert.equal(plan.executable, true);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.ffmpegInput.fragments.map(fragment => fragment.url))), [
    "https://cdn.example.test/mixed/init.mp4",
    "https://cdn.example.test/mixed/seg-00001.m4s",
    "https://cdn.example.test/mixed/seg-00002.m4s"
  ]);
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
  assert.equal(plan.normalizeStrategy.type, "hls-playlist");
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
  assert.equal(reconstructable.executable, true);
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
  assert.equal(plan.executable, true);
  assert.equal(plan.warnings.length, 0);
  assert.equal(plan.normalizeStrategy.type, "fmp4-fragments");
  assert.equal(plan.normalizeStrategy.action, "assemble-fragments-extract-audio");
  assert.deepEqual(JSON.parse(JSON.stringify(plan.ffmpegInput.fragments.map(fragment => fragment.url))), [
    "https://cdn.example.test/audio/init.mp4",
    "https://cdn.example.test/audio/seg-00001.m4s",
    "https://cdn.example.test/audio/seg-00002.m4s"
  ]);
  assert.equal(plan.ffmpegInput.fragments[0].segmentType, "init");

  const mixed = resolvers.assessFragmentGroupForAsr([
    { url: "https://cdn.example.test/media/init.mp4", kind: "segment" },
    { url: "https://cdn.example.test/media/audio-00001.m4s", kind: "segment", role: "audio", duration: 4 },
    { url: "https://cdn.example.test/media/video-00001.m4s", kind: "segment", role: "video", duration: 4 }
  ], { duration: 8 });
  assert.equal(mixed.executable, false);
  assert.equal(mixed.reconstructable, false);
}
