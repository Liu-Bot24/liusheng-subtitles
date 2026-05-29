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

    const dashPlan = resolveDashAudioPlan(candidates, { ...input, manifestTextByUrl });
    const fragmentPlan = resolveFragmentAudioPlan(candidates, input);
    const directPlan = resolveDirectAudioPlan(candidates, { ...input, fragmentPlan });
    if (directPlan && directPlan.executable !== false) {
      return directPlan;
    }
    const hlsPlan = resolveHlsAudioPlan(candidates, { ...input, manifestTextByUrl });
    if (hlsPlan) {
      return hlsPlan;
    }
    const muxedPlan = resolveMuxedMediaPlan(candidates, input);
    return [dashPlan, fragmentPlan, directPlan, muxedPlan].find(plan => plan?.executable !== false) ||
      dashPlan ||
      fragmentPlan ||
      directPlan ||
      muxedPlan ||
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
      const audioRepresentations = parsed.adaptationSets
        .flatMap(set => set.representations)
        .filter(item => item.role === "audio")
        .sort((a, b) => Math.abs((a.bandwidth || 128000) - 128000) - Math.abs((b.bandwidth || 128000) - 128000));
      const representation = audioRepresentations.find(item => !FuguangDashManifestParser.isUnsupportedWebmOpusRepresentation(item)) || audioRepresentations[0];
      if (!representation) {
        continue;
      }
      const fragments = FuguangDashManifestParser.expandRepresentationFragments(representation, parsed.duration);
      const unsupportedDashWebmOpus = FuguangDashManifestParser.isUnsupportedWebmOpusRepresentation(representation);
      const executable = fragments.some(fragment => fragment.segmentType === "init") &&
        fragments.some(fragment => fragment.segmentType === "media") &&
        !unsupportedDashWebmOpus;
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
        executable,
        ffmpegInput: {
          type: "dash",
          url: candidate.url,
          credentials: "include",
          fragments
        },
        normalizeStrategy: { type: "dash-manifest", action: "parse-manifest-extract-audio", requiresAssembly: true },
        expectedAudio: { codec: primaryAsset.codecs[0] || "mp4a", duration: primaryAsset.duration || 0 },
        warnings: executable
          ? []
          : (unsupportedDashWebmOpus
            ? [unsupportedRuntimeWarning("dash-webm-opus", "DASH WebM/Opus fragments need a dedicated reconstruction path before ASR.")]
            : [unsupportedRuntimeWarning("dash-audio", "DASH audio representation is identifiable, but init+segment expansion is incomplete.")])
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
      executable: assessment.executable !== false && assessment.reconstructable === true,
      ffmpegInput: {
        type: "mse-fragments",
        url: primaryAsset.url,
        credentials: "include",
        fragments: assessment.reconstructable
          ? [assessment.initSegment, ...assessment.segments].filter(Boolean).map(fragment => summarizeFfmpegFragment(fragment))
          : []
      },
      normalizeStrategy: { type: "fmp4-fragments", action: "assemble-fragments-extract-audio", requiresAssembly: true },
      expectedAudio: { codec: primaryAsset.codecs[0] || "mp4a", duration: primaryAsset.duration || 0 },
      warnings: assessment.reconstructable
        ? []
        : [unsupportedRuntimeWarning("mse-fragments", `MSE/fMP4 fragments are identifiable, but ${assessment.reason || "init+segment assembly is incomplete"}.`)]
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
    if (isSegmentedWebmOpusGroup(fragments)) {
      return {
        executable: false,
        reconstructable: false,
        role,
        reason: "WebM/Opus fragments need a dedicated reconstruction path before ASR",
        initSegment,
        segments: mediaSegments
      };
    }
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
      executable: true,
      reconstructable: true,
      role,
      reason: `selected reconstructable MSE/fMP4 ${role} fragment group`,
      initSegment,
      segments: mediaSegments
    };
  }

  function summarizeFfmpegFragment(fragment = {}) {
    return {
      url: String(fragment.url || ""),
      name: String(fragment.filename || fragment.name || ""),
      segmentType: isInitFragment(fragment) ? "init" : "media",
      role: inferSingleFragmentRole(fragment),
      duration: Number(fragment.duration || 0) || 0,
      start: Number(fragment.start || 0) || 0,
      end: Number(fragment.end || 0) || 0,
      byteRange: fragment.byteRange || null
    };
  }

  function resolveDirectAudioPlan(candidates, options) {
    const reconstructableFragmentUrls = new Set(
      options.fragmentPlan?.executable !== false
        ? (options.fragmentPlan?.ffmpegInput?.fragments || []).map(fragment => fragment.url).filter(Boolean)
        : []
    );
    const audio = candidates
      .filter(candidate => candidate.role === "audio" || candidate.kind === "audio")
      .filter(candidate => !reconstructableFragmentUrls.has(candidate.url))
      .filter(candidate => !isHlsCandidate(candidate) && !isDashCandidate(candidate))
      .filter(candidate => !isFragmentCandidate(candidate) || isStandaloneDirectAudioFragment(candidate))
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
      normalizeStrategy: { type: "direct-audio-file", action: "transcode-or-remux-audio", requiresAssembly: false },
      expectedAudio: { codec: primaryAsset.codecs[0] || "", duration: primaryAsset.duration || 0 },
      warnings: primaryAsset.warnings || []
    });
  }

  function isStandaloneDirectAudioFragment(candidate = {}) {
    if (candidate.segmentType) {
      return false;
    }
    if (isSegmentedWebmOpusFragment(candidate)) {
      return false;
    }
    const codecText = Array.isArray(candidate.codecs) ? candidate.codecs.join(" ") : candidate.codecs;
    const contentType = String(
      candidate.contentType ||
      candidate.mime ||
      codecText ||
      candidate.evidence?.map(item => item?.detail).join(" ") ||
      ""
    ).toLowerCase();
    if (!contentType.startsWith("audio/")) {
      return false;
    }
    const ext = normalizeExtension(candidate.ext || extensionFromUrl(candidate.url));
    if (!["mp4", "m4a", "m4s", "cmfa", "aac", "mp3"].includes(ext) &&
        !contentType.includes("mp4") &&
        !contentType.includes("mpeg") &&
        !contentType.includes("aac")) {
      return false;
    }
    return Number(candidate.duration || 0) > 0 || Number(candidate.bitrate || candidate.bandwidth || 0) > 0;
  }

  function resolveMuxedMediaPlan(candidates, options) {
    const muxed = candidates
      .filter(candidate => isDirectMuxedMediaCandidate(candidate))
      .sort((a, b) => Math.abs((a.bitrate || a.bandwidth || 512000) - 512000) - Math.abs((b.bitrate || b.bandwidth || 512000) - 512000))[0];
    if (!muxed) {
      return null;
    }
    const primaryAsset = normalizeCandidateAsset(muxed, {
      role: FuguangMediaAssetModel.MEDIA_ROLE.MUXED,
      duration: muxed.duration || options.duration || 0
    });
    return FuguangMediaAssetModel.createAudioSourcePlan({
      kind: "muxed-media",
      primaryAsset,
      reason: "selected complete muxed media file for audio extraction",
      confidence: 0.58,
      executable: !hasBlockingWarnings(primaryAsset.warnings),
      ffmpegInput: { type: "direct", url: primaryAsset.url, credentials: "include" },
      normalizeStrategy: { type: "muxed-media-file", action: "extract-audio-track", requiresAssembly: false },
      expectedAudio: { codec: "", duration: primaryAsset.duration || 0 },
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

  function isDirectMuxedMediaCandidate(candidate = {}) {
    if (isHlsCandidate(candidate) || isDashCandidate(candidate) || isFragmentCandidate(candidate)) {
      return false;
    }
    if (isKnownSeparatedVideoTrack(candidate)) {
      return false;
    }
    const ext = normalizeExtension(candidate.ext || extensionFromUrl(candidate.url));
    const contentType = String(candidate.contentType || candidate.mime || "").toLowerCase();
    const role = String(candidate.role || "");
    const kind = String(candidate.kind || "");
    if (role === "audio" || kind === "audio") {
      return false;
    }
    if (["mp4", "m4v", "mov", "webm", "mkv"].includes(ext)) {
      return true;
    }
    return contentType.startsWith("video/") ||
      role === "video" ||
      role === "media" ||
      kind === "video" ||
      kind === "media";
  }

  function isSegmentedWebmOpusGroup(fragments = []) {
    return (Array.isArray(fragments) ? fragments : []).some(isSegmentedWebmOpusFragment);
  }

  function isSegmentedWebmOpusFragment(candidate = {}) {
    if (!isFragmentCandidate(candidate)) {
      return false;
    }
    const ext = normalizeExtension(candidate.ext || extensionFromUrl(candidate.url));
    const codecText = Array.isArray(candidate.codecs) ? candidate.codecs.join(" ") : candidate.codecs;
    const contentType = String(candidate.contentType || candidate.mime || "").toLowerCase();
    const codec = String(codecText || "").toLowerCase();
    const mp4Container = ["mp4", "m4a", "m4s", "cmf", "cmfa", "cmfv"].includes(ext) ||
      contentType.includes("mp4") ||
      contentType.includes("iso.segment");
    const webmOrOggContainer = ["webm", "weba", "opus", "ogg", "oga"].includes(ext) ||
      contentType.includes("webm") ||
      contentType.includes("ogg") ||
      (!mp4Container && codec.includes("opus"));
    return webmOrOggContainer && !mp4Container;
  }

  function isKnownSeparatedVideoTrack(candidate = {}) {
    const rawUrl = String(candidate.url || "");
    const path = safeUrlPath(rawUrl).toLowerCase();
    if (/(^|\.)video\.twimg\.com$/i.test(safeUrlHostname(rawUrl)) &&
        /\/amplify_video\/\d+\/(?:vid|pl)\/(?:avc1|h264|h265|hevc|vp9|av01)(?:\/|$)/i.test(path)) {
      return true;
    }
    const codecs = String(candidate.codecs || candidate.quality?.codecs || "")
      .split(",")
      .map(codec => codec.trim())
      .filter(Boolean);
    return codecs.length > 0 && codecs.every(isVideoCodec) && !codecs.some(isAudioCodec);
  }

  function isVideoCodec(codec = "") {
    return /^(?:avc1|avc3|hvc1|hev1|vp8|vp9|av01|theora)(?:\.|$)/i.test(String(codec || ""));
  }

  function isAudioCodec(codec = "") {
    return /^(?:mp4a|ac-3|ec-3|opus|vorbis|flac|alac|aac)(?:\.|$)/i.test(String(codec || ""));
  }

  function safeUrlHostname(rawUrl = "") {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return "";
    }
  }

  function safeUrlPath(rawUrl = "") {
    try {
      return new URL(rawUrl).pathname;
    } catch {
      return String(rawUrl || "");
    }
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
    const text = candidates.map(candidate => `${fragmentUrlRoleText(candidate.url)} ${candidate.role || ""} ${candidate.kind || ""} ${nonGenericSegmentContentType(candidate.contentType)}`).join(" ").toLowerCase();
    if (/(?:audio|mp4a|aac|302(?:16|32|80))/.test(text)) {
      return "audio";
    }
    if (/(?:video|avc|h264|h265|hevc|vp9|av01)/.test(text)) {
      return "video";
    }
    return "unknown";
  }

  function inferSingleFragmentRole(candidate = {}) {
    const role = String(candidate.role || "").toLowerCase();
    const kind = String(candidate.kind || "").toLowerCase();
    const contentType = String(candidate.contentType || "").toLowerCase();
    const text = `${fragmentUrlRoleText(candidate.url)} ${role} ${kind} ${nonGenericSegmentContentType(contentType)}`.toLowerCase();
    if (role === "audio" || kind === "audio" || contentType.startsWith("audio/") ||
      /(?:^|\W)(?:audio|mp4a|aac|opus|302(?:16|32|80))(?:\W|$)/.test(text)) {
      return "audio";
    }
    if (role === "video" || kind === "video" || (contentType.startsWith("video/") && !contentType.includes("iso.segment")) ||
      /(?:^|\W)(?:video|avc|h264|h265|hevc|vp9|av01|100\d{3})(?:\W|$)/.test(text)) {
      return "video";
    }
    return "unknown";
  }

  function nonGenericSegmentContentType(value = "") {
    const contentType = String(value || "").toLowerCase();
    return contentType.includes("iso.segment") ? "" : contentType;
  }

  function fragmentUrlRoleText(rawUrl = "") {
    try {
      const url = new URL(rawUrl);
      return `${url.pathname} ${url.search}`.toLowerCase();
    } catch {
      return String(rawUrl || "").toLowerCase();
    }
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
    return [
      ...groups.values(),
      ...fragmentDirectoryFallbackGroups(fragments)
    ];
  }

  function fragmentDirectoryFallbackGroups(fragments = []) {
    const directories = new Map();
    for (const fragment of fragments) {
      const key = fragmentDirectoryKey(fragment);
      if (!directories.has(key)) {
        directories.set(key, []);
      }
      directories.get(key).push(fragment);
    }
    return [...directories.values()].filter(group =>
      group.some(isInitFragment) &&
      group.some(fragment => !isInitFragment(fragment)) &&
      group.some(fragment => inferSingleFragmentRole(fragment) === "unknown")
    );
  }

  function fragmentTrackKey(candidate = {}) {
    const explicitTrack = candidate.trackId || candidate.representationId || candidate.adaptationSetId || "";
    const role = inferSingleFragmentRole(candidate);
    try {
      const url = new URL(candidate.url || "");
      const directory = url.pathname.replace(/[^/]*$/, "");
      return `${url.origin}${directory}:${explicitTrack || role || "unknown"}:${fragmentContainerFamily(candidate)}`;
    } catch {
      return `${explicitTrack || role || "unknown"}:${String(candidate.url || "").replace(/[^/]*$/, "")}:${fragmentContainerFamily(candidate)}`;
    }
  }

  function fragmentContainerFamily(candidate = {}) {
    if (isSegmentedWebmOpusFragment(candidate)) {
      return "webm-ogg";
    }
    const ext = normalizeExtension(candidate.ext || extensionFromUrl(candidate.url));
    const contentType = String(candidate.contentType || candidate.mime || "").toLowerCase();
    if (["mp4", "m4a", "m4s", "cmf", "cmfa", "cmfv", "m4v"].includes(ext) ||
        contentType.includes("mp4") ||
        contentType.includes("iso.segment")) {
      return "fmp4";
    }
    return "unknown";
  }

  function fragmentDirectoryKey(candidate = {}) {
    try {
      const url = new URL(candidate.url || "");
      return `${url.origin}${url.pathname.replace(/[^/]*$/, "")}`;
    } catch {
      return String(candidate.url || "").replace(/[^/]*$/, "");
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
