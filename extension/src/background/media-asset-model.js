export const FuguangMediaAssetModel = (() => {
  const MEDIA_ROLE = Object.freeze({
    AUDIO: "audio",
    VIDEO: "video",
    MUXED: "muxed",
    PLAYLIST: "playlist",
    UNKNOWN: "unknown"
  });

  const ASSET_KIND = Object.freeze({
    DIRECT: "direct",
    HLS_MASTER: "hls-master",
    HLS_MEDIA: "hls-media",
    DASH_MPD: "dash-mpd",
    SEGMENT: "segment",
    INIT: "init",
    KEY: "key"
  });

  const DURATION_EVIDENCE_SOURCE = Object.freeze({
    MEDIA_ELEMENT: "media-element",
    PLAYER_JSON: "player-json",
    MANIFEST: "manifest",
    NETWORK_HEADER: "network-header",
    PAGE_META: "page-meta",
    URL_TOKEN: "url-token",
    INFERRED: "inferred"
  });

  const EVIDENCE_STRENGTH = Object.freeze({
    DIRECT_MEDIA_ELEMENT: 90,
    PLAYER_JSON: 80,
    MANIFEST_PARSE: 75,
    NETWORK_HEADER: 60,
    URL_TOKEN: 40,
    PAGE_META: 35,
    INFERRED: 20
  });

  const DURATION_SOURCE_STRENGTH = Object.freeze({
    [DURATION_EVIDENCE_SOURCE.MEDIA_ELEMENT]: EVIDENCE_STRENGTH.DIRECT_MEDIA_ELEMENT,
    [DURATION_EVIDENCE_SOURCE.PLAYER_JSON]: EVIDENCE_STRENGTH.PLAYER_JSON,
    [DURATION_EVIDENCE_SOURCE.MANIFEST]: EVIDENCE_STRENGTH.MANIFEST_PARSE,
    [DURATION_EVIDENCE_SOURCE.NETWORK_HEADER]: EVIDENCE_STRENGTH.NETWORK_HEADER,
    [DURATION_EVIDENCE_SOURCE.PAGE_META]: EVIDENCE_STRENGTH.PAGE_META,
    [DURATION_EVIDENCE_SOURCE.URL_TOKEN]: EVIDENCE_STRENGTH.URL_TOKEN,
    [DURATION_EVIDENCE_SOURCE.INFERRED]: EVIDENCE_STRENGTH.INFERRED
  });

  function createMediaAsset(input = {}) {
    const duration = positiveNumber(input.duration);
    const durationEvidence = normalizeDurationEvidence(input.durationEvidence, duration);
    return {
      url: String(input.url || ""),
      finalUrl: String(input.finalUrl || input.url || ""),
      pageUrl: String(input.pageUrl || ""),
      title: String(input.title || ""),
      kind: normalizeAssetKind(input.kind),
      role: normalizeMediaRole(input.role),
      container: String(input.container || ""),
      codecs: normalizeStringArray(input.codecs),
      bitrate: positiveNumberOrNull(input.bitrate),
      duration: duration || null,
      durationEvidence,
      dimensions: normalizeDimensions(input.dimensions, input),
      requestContext: input.requestContext || null,
      relation: input.relation || null,
      siteAdapter: String(input.siteAdapter || ""),
      evidence: normalizeEvidenceList(input.evidence),
      warnings: normalizeWarningList(input.warnings)
    };
  }

  function createMediaGroup(input = {}) {
    const assets = Array.isArray(input.assets) ? input.assets.map(createMediaAsset) : [];
    return {
      id: String(input.id || ""),
      title: String(input.title || ""),
      pageUrl: String(input.pageUrl || ""),
      assets,
      selectedAsset: input.selectedAsset ? createMediaAsset(input.selectedAsset) : null,
      reason: String(input.reason || ""),
      evidence: normalizeEvidenceList(input.evidence),
      warnings: normalizeWarningList(input.warnings)
    };
  }

  function createAudioSourcePlan(input = {}) {
    const warnings = normalizeWarningList(input.warnings);
    return {
      kind: String(input.kind || "unknown"),
      primaryAsset: input.primaryAsset ? createMediaAsset(input.primaryAsset) : null,
      companionAssets: Array.isArray(input.companionAssets) ? input.companionAssets.map(createMediaAsset) : [],
      reason: String(input.reason || ""),
      confidence: clampConfidence(input.confidence),
      executable: input.executable === undefined ? true : Boolean(input.executable),
      ffmpegInput: normalizeFfmpegInput(input.ffmpegInput),
      expectedAudio: {
        codec: String(input.expectedAudio?.codec || ""),
        container: String(input.expectedAudio?.container || "mp3-output"),
        duration: positiveNumber(input.expectedAudio?.duration)
      },
      warnings
    };
  }

  function createDurationEvidence(source, seconds, details = {}) {
    const duration = positiveNumber(seconds);
    if (!duration) {
      return null;
    }
    const normalizedSource = String(source || DURATION_EVIDENCE_SOURCE.INFERRED);
    return {
      source: normalizedSource,
      seconds: duration,
      strength: positiveNumber(details.strength) || durationEvidenceStrength(normalizedSource),
      detail: String(details.detail || "")
    };
  }

  function durationEvidenceStrength(sourceOrEvidence) {
    const source = typeof sourceOrEvidence === "object"
      ? sourceOrEvidence?.source
      : sourceOrEvidence;
    return DURATION_SOURCE_STRENGTH[String(source || "")] || EVIDENCE_STRENGTH.INFERRED;
  }

  function strongerDurationEvidence(left, right) {
    const leftStrength = durationEvidenceStrength(left);
    const rightStrength = durationEvidenceStrength(right);
    if (leftStrength !== rightStrength) {
      return leftStrength > rightStrength ? left : right;
    }
    return positiveNumber(left?.seconds) >= positiveNumber(right?.seconds) ? left : right;
  }

  function canDurationEvidenceCap(candidateEvidence, mediaEvidence) {
    if (!candidateEvidence || !mediaEvidence) {
      return false;
    }
    return durationEvidenceStrength(candidateEvidence) >= durationEvidenceStrength(mediaEvidence);
  }

  function normalizeAssetKind(kind) {
    const value = String(kind || "").toLowerCase();
    return Object.values(ASSET_KIND).includes(value) ? value : ASSET_KIND.DIRECT;
  }

  function normalizeMediaRole(role) {
    const value = String(role || "").toLowerCase();
    return Object.values(MEDIA_ROLE).includes(value) ? value : MEDIA_ROLE.UNKNOWN;
  }

  function normalizeDurationEvidence(evidence, fallbackDuration) {
    if (!evidence && fallbackDuration) {
      return null;
    }
    if (!evidence) {
      return null;
    }
    if (typeof evidence === "string") {
      return createDurationEvidence(evidence, fallbackDuration || 0);
    }
    return createDurationEvidence(evidence.source, evidence.seconds || fallbackDuration, evidence);
  }

  function normalizeDimensions(dimensions, fallback = {}) {
    const width = positiveNumber(dimensions?.width || fallback.videoWidth || fallback.width);
    const height = positiveNumber(dimensions?.height || fallback.videoHeight || fallback.height);
    return width && height ? { width, height } : null;
  }

  function normalizeStringArray(values) {
    if (typeof values === "string") {
      return values.split(",").map(item => item.trim()).filter(Boolean);
    }
    if (!Array.isArray(values)) {
      return [];
    }
    return values.map(item => String(item || "").trim()).filter(Boolean);
  }

  function normalizeEvidenceList(items) {
    return (Array.isArray(items) ? items : [])
      .map(item => ({
        source: String(item?.source || ""),
        strength: positiveNumber(item?.strength),
        detail: String(item?.detail || "")
      }))
      .filter(item => item.source || item.detail);
  }

  function normalizeWarningList(items) {
    return (Array.isArray(items) ? items : [])
      .map(item => ({
        code: String(item?.code || ""),
        message: String(item?.message || "")
      }))
      .filter(item => item.code || item.message);
  }

  function normalizeFfmpegInput(input = {}) {
    return {
      type: String(input.type || ""),
      url: String(input.url || ""),
      headers: input.headers && typeof input.headers === "object" ? { ...input.headers } : {},
      credentials: String(input.credentials || "include")
    };
  }

  function clampConfidence(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.min(1, Math.max(0, number));
  }

  function positiveNumberOrNull(value) {
    const number = positiveNumber(value);
    return number || null;
  }

  function positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  return {
    ASSET_KIND,
    DURATION_EVIDENCE_SOURCE,
    EVIDENCE_STRENGTH,
    MEDIA_ROLE,
    canDurationEvidenceCap,
    createAudioSourcePlan,
    createDurationEvidence,
    createMediaAsset,
    createMediaGroup,
    durationEvidenceStrength,
    strongerDurationEvidence
  };
})();
