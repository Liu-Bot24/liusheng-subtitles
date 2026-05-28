export const FuguangBilibiliMediaAdapter = (() => {
  function assetsFromPlayinfo(playinfo = {}, model) {
    const data = playinfo?.dash ? playinfo : playinfo?.data?.dash ? playinfo.data : playinfo?.result?.dash ? playinfo.result : playinfo;
    const duration = Number(data?.dash?.duration || data?.duration || 0) || 0;
    const assets = [];
    for (const item of Array.isArray(data?.dash?.audio) ? data.dash.audio : []) {
      assets.push(...assetsFromDashItem(item, "audio", duration, model));
    }
    for (const item of Array.isArray(data?.dash?.video) ? data.dash.video : []) {
      assets.push(...assetsFromDashItem(item, "video", duration, model));
    }
    return assets;
  }

  function resolveAudioPlan(candidates = [], options = {}, model) {
    const assets = [
      ...assetsFromPlayinfo(options.playinfo || options.bilibiliPlayinfo || {}, model),
      ...candidates.filter(isBilibiliCandidate).map(candidate => normalizeCandidate(candidate, model))
    ];
    const audioAssets = assets.filter(asset => asset.role === "audio");
    if (!audioAssets.length) {
      return null;
    }
    const primaryAsset = [...audioAssets].sort(compareBilibiliAudioForAsr)[0];
    return model.createAudioSourcePlan({
      kind: "direct-audio",
      primaryAsset,
      companionAssets: assets.filter(asset => asset.url !== primaryAsset.url),
      reason: "selected Bilibili playurl audio track for ASR",
      confidence: 0.95,
      ffmpegInput: {
        type: "direct",
        url: primaryAsset.url,
        credentials: "include"
      },
      expectedAudio: {
        codec: primaryAsset.codecs[0] || "mp4a",
        duration: primaryAsset.duration || 0
      }
    });
  }

  function assetsFromDashItem(item, role, duration, model) {
    const urls = [
      item?.baseUrl,
      item?.base_url,
      ...(Array.isArray(item?.backupUrl) ? item.backupUrl : []),
      ...(Array.isArray(item?.backup_url) ? item.backup_url : [])
    ].filter(Boolean);
    return [...new Set(urls)].map(url => model.createMediaAsset({
      url,
      kind: model.ASSET_KIND.SEGMENT,
      role,
      container: "m4s",
      codecs: item?.codecs || item?.mimeType || item?.mime || "",
      bitrate: item?.bandwidth || item?.bitrate || 0,
      duration,
      durationEvidence: duration ? model.createDurationEvidence(model.DURATION_EVIDENCE_SOURCE.PLAYER_JSON, duration, { detail: "bilibili-playurl" }) : null,
      dimensions: { width: item?.width, height: item?.height },
      siteAdapter: "bilibili",
      evidence: [{ source: "bilibili-playurl", strength: 90, detail: String(item?.id || "") }]
    }));
  }

  function normalizeCandidate(candidate, model) {
    return model.createMediaAsset({
      ...candidate,
      kind: model.ASSET_KIND.SEGMENT,
      role: inferBilibiliRole(candidate),
      siteAdapter: "bilibili",
      evidence: [{ source: candidate.source || "candidate", strength: 70, detail: "bilibili media" }]
    });
  }

  function compareBilibiliAudioForAsr(left, right) {
    return bilibiliAudioPreference(left) - bilibiliAudioPreference(right) ||
      Math.abs((left.bitrate || 132000) - 132000) - Math.abs((right.bitrate || 132000) - 132000);
  }

  function bilibiliAudioPreference(asset) {
    const track = String(asset.url || "").match(/302(16|32|80)(?=\.(?:m4s|mp4))/i)?.[1] || "";
    if (track === "32") {
      return 0;
    }
    if (track === "16") {
      return 1;
    }
    if (track === "80") {
      return 2;
    }
    return 3;
  }

  function inferBilibiliRole(candidate) {
    const text = `${candidate.url || ""} ${candidate.contentType || ""} ${candidate.role || ""} ${candidate.kind || ""}`.toLowerCase();
    if (/302(?:16|32|80)(?=\.(?:m4s|mp4))/.test(text) || text.includes("audio")) {
      return "audio";
    }
    if (text.includes("video")) {
      return "video";
    }
    return "unknown";
  }

  function isBilibiliCandidate(candidate) {
    try {
      const url = new URL(candidate.url || "");
      return /(?:^|\.)bilivideo\.(?:com|cn)$/i.test(url.hostname) ||
        /(?:^|\.)bilibili(?:video)?\.com$/i.test(url.hostname) ||
        /\/upgcxcode\//i.test(url.pathname);
    } catch {
      return false;
    }
  }

  return {
    assetsFromPlayinfo,
    resolveAudioPlan
  };
})();
