import { FuguangMediaAssetModel } from "./media-asset-model.js";
import { FuguangHlsManifestParser } from "./hls-manifest-parser.js";
import { FuguangDashManifestParser } from "./dash-manifest-parser.js";
import { FuguangBilibiliMediaAdapter } from "./site-adapters/bilibili-media-adapter.js";
import { FuguangXTwitterMediaAdapter } from "./site-adapters/x-twitter-media-adapter.js";
import { FuguangYoutubeMediaAdapter } from "./site-adapters/youtube-media-adapter.js";

export const FuguangMediaSourceResolvers = (() => {
  function resolveAudioSourcePlan(input = {}) {
    const manifestTextByUrl = input.manifestTextByUrl || {};
    const candidates = normalizeCandidates(input.candidates || input.assets || []);

    const bilibiliPlan = FuguangBilibiliMediaAdapter.resolveAudioPlan(candidates, input, FuguangMediaAssetModel);
    if (bilibiliPlan) {
      return bilibiliPlan;
    }

    const hlsPlan = resolveHlsAudioPlan(candidates, { ...input, manifestTextByUrl });
    if (hlsPlan) {
      return hlsPlan;
    }

    const dashPlan = resolveDashAudioPlan(candidates, { ...input, manifestTextByUrl });
    const fragmentPlan = resolveFragmentAudioPlan(candidates, input);
    const directPlan = resolveDirectAudioPlan(candidates, input);
    return [dashPlan, fragmentPlan, directPlan].find(plan => plan?.executable !== false) ||
      dashPlan ||
      fragmentPlan ||
      directPlan ||
      null;
  }

  function resolveHlsAudioPlan(candidates, options) {
    const hlsCandidates = candidates.filter(candidate => isHlsCandidate(candidate));
    if (!hlsCandidates.length) {
      return null;
    }
    const xPlan = FuguangXTwitterMediaAdapter.resolveAudioPlan(hlsCandidates, options, {
      hlsParser: FuguangHlsManifestParser,
      model: FuguangMediaAssetModel
    });
    if (xPlan) {
      return xPlan;
    }
    const candidatePlans = [];
    for (const candidate of hlsCandidates) {
      candidatePlans.push(...plansFromHlsCandidate(candidate, options));
    }
    return candidatePlans.sort((a, b) => b.confidence - a.confidence)[0] || null;
  }

  function plansFromHlsCandidate(candidate, options) {
    const plans = [];
    const text = manifestTextForUrl(options.manifestTextByUrl, candidate.url);
    if (!text && FuguangHlsManifestParser.inferHlsRoleFromUrl(candidate.url) === "audio") {
      plans.push(createHlsPlan(candidate.url, {
        candidate,
        reason: "selected audio-only HLS candidate by track identity",
        confidence: 0.74,
        duration: candidate.duration || options.duration || 0,
        evidenceSource: "hls-url-token"
      }));
    }
    if (text) {
      const parsed = FuguangHlsManifestParser.parse(text, candidate.url);
      if (parsed.master.variants.length) {
        const audioVariant = chooseHlsAudioVariant(parsed.master.variants);
        if (audioVariant) {
          plans.push(createHlsPlan(audioVariant.url, {
            candidate,
            reason: "selected parsed audio rendition from HLS master",
            confidence: 0.92,
            bitrate: audioVariant.bandwidth,
            codecs: audioVariant.codecs,
            duration: candidate.duration || options.duration || 0,
            evidenceSource: "hls-master"
          }));
        }
      }
      if (parsed.media.segments.length && FuguangHlsManifestParser.inferHlsRoleFromUrl(candidate.url) === "audio") {
        plans.push(createHlsPlan(candidate.url, {
          candidate,
          reason: "selected audio-only HLS media playlist",
          confidence: 0.9,
          duration: candidate.duration || parsed.media.duration || options.duration || 0,
          evidenceSource: "hls-media",
          container: parsed.media.containerHint
        }));
      }
    }
    if (FuguangHlsManifestParser.inferHlsRoleFromUrl(candidate.url) !== "audio") {
      for (const siblingUrl of FuguangHlsManifestParser.buildAudioSiblingUrls(candidate.url)) {
        const siblingText = manifestTextForUrl(options.manifestTextByUrl, siblingUrl);
        if (!siblingText) {
          continue;
        }
        const parsedSibling = FuguangHlsManifestParser.parse(siblingText, siblingUrl);
        if (parsedSibling.media.segments.length || parsedSibling.master.variants.some(variant => variant.audioOnly)) {
          plans.push(createHlsPlan(siblingUrl, {
            candidate,
            reason: "selected HLS sibling audio track",
            confidence: 0.88,
            duration: candidate.duration || parsedSibling.media.duration || options.duration || 0,
            evidenceSource: "hls-sibling",
            container: parsedSibling.media.containerHint
          }));
        }
      }
    }
    return plans;
  }

  function resolveDashAudioPlan(candidates, options) {
    for (const candidate of candidates.filter(item => isDashCandidate(item))) {
      const text = manifestTextForUrl(options.manifestTextByUrl, candidate.url);
      if (!text) {
        continue;
      }
      const parsed = FuguangDashManifestParser.parse(text, candidate.url);
      const representation = parsed.adaptationSets
        .flatMap(set => set.representations)
        .filter(item => item.role === "audio")
        .sort((a, b) => Math.abs((a.bandwidth || 128000) - 128000) - Math.abs((b.bandwidth || 128000) - 128000))[0];
      if (!representation) {
        continue;
      }
      const primaryAsset = FuguangMediaAssetModel.createMediaAsset({
        url: representation.baseUrl || candidate.url,
        kind: FuguangMediaAssetModel.ASSET_KIND.DASH_MPD,
        role: FuguangMediaAssetModel.MEDIA_ROLE.AUDIO,
        container: "dash",
        codecs: representation.codecs,
        bitrate: representation.bandwidth,
        duration: candidate.duration || parsed.duration || options.duration || 0,
        durationEvidence: durationEvidence(candidate.duration || parsed.duration || options.duration, "manifest"),
        evidence: [{ source: "dash-manifest", strength: 75, detail: representation.id }]
      });
      return FuguangMediaAssetModel.createAudioSourcePlan({
        kind: "dash-audio",
        primaryAsset,
        reason: "selected DASH audio representation",
        confidence: 0.84,
        executable: false,
        ffmpegInput: { type: "dash", url: candidate.url, credentials: "include" },
        expectedAudio: { codec: primaryAsset.codecs[0] || "mp4a", duration: primaryAsset.duration || 0 },
        warnings: [unsupportedRuntimeWarning("dash-audio", "DASH manifest parsing is available, but browser Web FFmpeg execution is not wired yet.")]
      });
    }
    return null;
  }

  function resolveFragmentAudioPlan(candidates, options) {
    const assessment = assessFragmentGroupForAsr(candidates, options);
    if (assessment.role !== "audio" || !assessment.segments?.length) {
      return null;
    }
    const primary = assessment.segments[0];
    const primaryAsset = normalizeCandidateAsset(primary, {
      role: FuguangMediaAssetModel.MEDIA_ROLE.AUDIO,
      duration: primary.duration || options.duration || 0
    });
    return FuguangMediaAssetModel.createAudioSourcePlan({
      kind: "mse-fragments",
      primaryAsset,
      companionAssets: [assessment.initSegment, ...assessment.segments.slice(1)].filter(Boolean).map(item => normalizeCandidateAsset(item)),
      reason: assessment.reason,
      confidence: 0.62,
      executable: false,
      ffmpegInput: { type: "mse-fragments", url: primaryAsset.url, credentials: "include" },
      expectedAudio: { codec: primaryAsset.codecs[0] || "mp4a", duration: primaryAsset.duration || 0 },
      warnings: [unsupportedRuntimeWarning("mse-fragments", "MSE/fMP4 fragments are identifiable, but browser Web FFmpeg execution needs init+segment assembly before ASR.")]
    });
  }

  function assessFragmentGroupForAsr(candidates = [], options = {}) {
    const fragments = (Array.isArray(candidates) ? candidates : [])
      .filter(candidate => isFragmentCandidate(candidate));
    if (!fragments.length) {
      return { executable: false, reconstructable: false, role: "unknown", reason: "no media fragments were captured", segments: [] };
    }
    const assessments = groupFragmentsByTrack(fragments).map(group => assessSingleFragmentGroup(group, options));
    const reconstructableAudio = assessments.find(item => item.reconstructable && item.role === "audio");
    if (reconstructableAudio) {
      return reconstructableAudio;
    }
    return assessments.find(item => item.reconstructable) || assessments[0];
  }

  function assessSingleFragmentGroup(fragments, options = {}) {
    const initSegment = fragments.find(candidate => isInitFragment(candidate));
    const mediaSegments = fragments.filter(candidate => !isInitFragment(candidate)).sort(compareFragmentSequence);
    const role = inferFragmentGroupRole(fragments);
    const hasTimeline = Boolean(options.duration || mediaSegments.some(segment => segment.duration || segment.start != null || segment.end != null));
    if (!initSegment) {
      return { executable: false, reconstructable: false, role, reason: "missing init segment for fMP4 reconstruction", segments: mediaSegments };
    }
    if (mediaSegments.length < 2) {
      return { executable: false, reconstructable: false, role, reason: "not enough contiguous media segments", initSegment, segments: mediaSegments };
    }
    if (!hasTimeline) {
      return { executable: false, reconstructable: false, role, reason: "missing trusted duration or segment timeline", initSegment, segments: mediaSegments };
    }
    if (!["audio", "video"].includes(role)) {
      return { executable: false, reconstructable: false, role, reason: "fragment track role is unknown or mixed", initSegment, segments: mediaSegments };
    }
    if (!fragmentSequenceLooksContiguous(mediaSegments)) {
      return { executable: false, reconstructable: false, role, reason: "media fragment sequence is not contiguous", initSegment, segments: mediaSegments };
    }
    return {
      executable: false,
      reconstructable: true,
      role,
      reason: `selected reconstructable MSE/fMP4 ${role} fragment group; runtime execution is disabled until init+segment assembly is implemented`,
      initSegment,
      segments: mediaSegments
    };
  }

  function resolveDirectAudioPlan(candidates, options) {
    const audio = candidates
      .filter(candidate => candidate.role === "audio" || candidate.kind === "audio")
      .filter(candidate => !isFragmentCandidate(candidate))
      .sort((a, b) => Math.abs((a.bitrate || a.bandwidth || 128000) - 128000) - Math.abs((b.bitrate || b.bandwidth || 128000) - 128000))[0];
    if (!audio) {
      return null;
    }
    const primaryAsset = normalizeCandidateAsset(audio, {
      role: FuguangMediaAssetModel.MEDIA_ROLE.AUDIO,
      duration: audio.duration || options.duration || 0
    });
    return FuguangMediaAssetModel.createAudioSourcePlan({
      kind: "direct-audio",
      primaryAsset,
      reason: "selected direct audio candidate",
      confidence: 0.72,
      executable: !hasBlockingWarnings(primaryAsset.warnings),
      ffmpegInput: { type: "direct", url: primaryAsset.url, credentials: "include" },
      expectedAudio: { codec: primaryAsset.codecs[0] || "", duration: primaryAsset.duration || 0 },
      warnings: primaryAsset.warnings || []
    });
  }

  function youtubeAssetsFromPlayerResponse(playerResponse) {
    return FuguangYoutubeMediaAdapter.assetsFromPlayerResponse(playerResponse, FuguangMediaAssetModel);
  }

  function chooseHlsAudioVariant(variants) {
    return [...variants]
      .filter(variant => variant.audioOnly || FuguangHlsManifestParser.inferHlsRoleFromUrl(variant.url) === "audio")
      .sort((a, b) => Math.abs((a.bandwidth || 128000) - 128000) - Math.abs((b.bandwidth || 128000) - 128000))[0] || null;
  }

  function createHlsPlan(url, details) {
    const duration = Number(details.duration || 0) || 0;
    const primaryAsset = FuguangMediaAssetModel.createMediaAsset({
      url,
      kind: FuguangMediaAssetModel.ASSET_KIND.HLS_MEDIA,
      role: FuguangMediaAssetModel.MEDIA_ROLE.AUDIO,
      container: details.container || "hls",
      codecs: details.codecs || "mp4a",
      bitrate: details.bitrate || 0,
      duration,
      durationEvidence: durationEvidence(duration, details.evidenceSource || "manifest"),
      evidence: [{ source: details.evidenceSource || "hls", strength: 80, detail: details.reason }],
      siteAdapter: details.siteAdapter || ""
    });
    return FuguangMediaAssetModel.createAudioSourcePlan({
      kind: "hls-audio",
      primaryAsset,
      companionAssets: details.candidate ? [normalizeCandidateAsset(details.candidate)] : [],
      reason: details.reason,
      confidence: details.confidence,
      ffmpegInput: { type: "hls", url, credentials: "include" },
      expectedAudio: { codec: primaryAsset.codecs[0] || "aac", duration }
    });
  }

  function normalizeCandidates(candidates) {
    return (Array.isArray(candidates) ? candidates : [])
      .filter(candidate => candidate && candidate.url)
      .map(candidate => candidate.mediaAsset || candidate);
  }

  function normalizeCandidateAsset(candidate, overrides = {}) {
    if (candidate?.url && candidate?.kind && candidate?.role && candidate?.evidence) {
      return FuguangMediaAssetModel.createMediaAsset({ ...candidate, ...overrides });
    }
    return FuguangMediaAssetModel.createMediaAsset({
      url: candidate.url,
      kind: inferAssetKind(candidate),
      role: overrides.role || candidate.role || (candidate.kind === "audio" ? "audio" : candidate.kind === "video" ? "video" : "unknown"),
      container: candidate.ext || "",
      codecs: candidate.codecs || candidate.contentType || "",
      bitrate: candidate.bitrate || candidate.bandwidth || 0,
      duration: overrides.duration || candidate.duration || 0,
      durationEvidence: durationEvidence(overrides.duration || candidate.duration, "inferred"),
      evidence: [{ source: candidate.source || "candidate", strength: 50, detail: candidate.contentType || "" }],
      siteAdapter: candidate.siteAdapter || ""
    });
  }

  function inferAssetKind(candidate = {}) {
    if (candidate.kind === "hls" || candidate.ext === "m3u8" || /\.m3u8(?:$|[?#])/i.test(candidate.url || "")) {
      return FuguangMediaAssetModel.ASSET_KIND.HLS_MEDIA;
    }
    if (candidate.kind === "dash" || candidate.ext === "mpd" || /\.mpd(?:$|[?#])/i.test(candidate.url || "")) {
      return FuguangMediaAssetModel.ASSET_KIND.DASH_MPD;
    }
    return FuguangMediaAssetModel.ASSET_KIND.DIRECT;
  }

  function isHlsCandidate(candidate = {}) {
    return candidate.kind === "hls" ||
      candidate.ext === "m3u8" ||
      candidate.kind === FuguangMediaAssetModel.ASSET_KIND.HLS_MEDIA ||
      candidate.kind === FuguangMediaAssetModel.ASSET_KIND.HLS_MASTER ||
      /\.m3u8(?:$|[?#])/i.test(candidate.url || "");
  }

  function isDashCandidate(candidate = {}) {
    return candidate.kind === "dash" ||
      candidate.ext === "mpd" ||
      candidate.kind === FuguangMediaAssetModel.ASSET_KIND.DASH_MPD ||
      /\.mpd(?:$|[?#])/i.test(candidate.url || "");
  }

  function isFragmentCandidate(candidate = {}) {
    const ext = normalizeExtension(candidate.ext || extensionFromUrl(candidate.url));
    return candidate.kind === "segment" ||
      candidate.kind === FuguangMediaAssetModel.ASSET_KIND.SEGMENT ||
      candidate.kind === FuguangMediaAssetModel.ASSET_KIND.INIT ||
      ["m4s", "cmfa", "cmfv", "cmf", "m4v"].includes(ext) ||
      (ext === "mp4" && isInitFragment(candidate));
  }

  function isInitFragment(candidate = {}) {
    const text = `${candidate.url || ""} ${candidate.filename || ""}`.toLowerCase();
    return /(?:^|[-_/])init(?:[-_.\/]|$)/i.test(text) ||
      candidate.segmentType === "init" ||
      candidate.kind === FuguangMediaAssetModel.ASSET_KIND.INIT;
  }

  function inferFragmentGroupRole(candidates = []) {
    const roles = new Set(candidates.map(inferSingleFragmentRole).filter(role => role && role !== "unknown"));
    if (roles.size === 1) {
      return [...roles][0];
    }
    if (roles.size > 1) {
      return "mixed";
    }
    const text = candidates.map(candidate => `${candidate.url || ""} ${candidate.role || ""} ${candidate.kind || ""} ${candidate.contentType || ""}`).join(" ").toLowerCase();
    if (/(?:audio|mp4a|aac|302(?:16|32|80))/.test(text)) {
      return "audio";
    }
    if (/(?:video|avc|h264|h265|hevc|vp9|av01)/.test(text)) {
      return "video";
    }
    return "unknown";
  }

  function inferSingleFragmentRole(candidate = {}) {
    const text = `${candidate.url || ""} ${candidate.role || ""} ${candidate.kind || ""} ${candidate.contentType || ""}`.toLowerCase();
    if (/(?:^|\W)(?:audio|mp4a|aac|opus|302(?:16|32|80))(?:\W|$)/.test(text)) {
      return "audio";
    }
    if (/(?:^|\W)(?:video|avc|h264|h265|hevc|vp9|av01|100\d{3})(?:\W|$)/.test(text)) {
      return "video";
    }
    return "unknown";
  }

  function groupFragmentsByTrack(fragments) {
    const groups = new Map();
    for (const fragment of fragments) {
      const key = fragmentTrackKey(fragment);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(fragment);
    }
    return [...groups.values()];
  }

  function fragmentTrackKey(candidate = {}) {
    const explicitTrack = candidate.trackId || candidate.representationId || candidate.adaptationSetId || "";
    const role = inferSingleFragmentRole(candidate);
    try {
      const url = new URL(candidate.url || "");
      const directory = url.pathname.replace(/[^/]*$/, "");
      return `${url.origin}${directory}:${explicitTrack || role || "unknown"}`;
    } catch {
      return `${explicitTrack || role || "unknown"}:${String(candidate.url || "").replace(/[^/]*$/, "")}`;
    }
  }

  function compareFragmentSequence(left, right) {
    const leftNumber = fragmentSequenceNumber(left);
    const rightNumber = fragmentSequenceNumber(right);
    if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return String(left.url || "").localeCompare(String(right.url || ""));
  }

  function fragmentSequenceLooksContiguous(segments = []) {
    const numbers = segments.map(fragmentSequenceNumber).filter(value => value != null);
    if (numbers.length !== segments.length || numbers.length < 2) {
      return true;
    }
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    if (sorted.length !== numbers.length) {
      return false;
    }
    return sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  }

  function fragmentSequenceNumber(candidate = {}) {
    const match = String(candidate.url || candidate.filename || "").match(/(?:seg(?:ment)?[-_]?|\/)(\d{1,8})(?=\.(?:m4s|cmf|cmfa|cmfv|m4a|m4v)|[/?#_-])/i);
    return match ? Number(match[1]) : null;
  }

  function extensionFromUrl(rawUrl = "") {
    try {
      const url = new URL(rawUrl);
      return normalizeExtension(url.pathname.split(".").pop() || "");
    } catch {
      return normalizeExtension(String(rawUrl || "").split(/[?#]/)[0].split(".").pop() || "");
    }
  }

  function normalizeExtension(value = "") {
    return String(value || "").trim().replace(/^\./, "").toLowerCase();
  }

  function unsupportedRuntimeWarning(code, message) {
    return { code: `unsupported-${code}`, message };
  }

  function hasBlockingWarnings(warnings = []) {
    return (Array.isArray(warnings) ? warnings : []).some(warning =>
      ["requires-signature-deciphering"].includes(String(warning?.code || ""))
    );
  }

  function manifestTextForUrl(manifestTextByUrl = {}, rawUrl) {
    if (!rawUrl) {
      return "";
    }
    if (manifestTextByUrl[rawUrl]) {
      return manifestTextByUrl[rawUrl];
    }
    const stripped = stripQuery(rawUrl);
    return manifestTextByUrl[stripped] || "";
  }

  function stripQuery(rawUrl) {
    try {
      const url = new URL(rawUrl);
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return String(rawUrl || "");
    }
  }

  function durationEvidence(duration, source) {
    const seconds = Number(duration || 0) || 0;
    if (!seconds) {
      return null;
    }
    const sourceText = String(source || "");
    let evidenceSource = FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.PLAYER_JSON;
    if (sourceText === "hls-url-token") {
      evidenceSource = FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.URL_TOKEN;
    } else if (sourceText === "manifest" || sourceText.startsWith("hls-") || sourceText === "dash-manifest") {
      evidenceSource = FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.MANIFEST;
    } else if (sourceText === "inferred") {
      evidenceSource = FuguangMediaAssetModel.DURATION_EVIDENCE_SOURCE.INFERRED;
    }
    return FuguangMediaAssetModel.createDurationEvidence(evidenceSource, seconds);
  }

  return {
    resolveAudioSourcePlan,
    resolveDashAudioPlan,
    resolveDirectAudioPlan,
    resolveFragmentAudioPlan,
    resolveHlsAudioPlan,
    assessFragmentGroupForAsr,
    youtubeAssetsFromPlayerResponse
  };
})();
