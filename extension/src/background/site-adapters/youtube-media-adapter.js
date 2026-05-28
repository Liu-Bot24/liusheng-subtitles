export const FuguangYoutubeMediaAdapter = (() => {
  function isPlaceholderUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return url.hostname.toLowerCase().endsWith("youtube.com") &&
        url.pathname.toLowerCase() === "/s/search/audio/no_input.mp3";
    } catch {
      return false;
    }
  }

  function assetsFromPlayerResponse(playerResponse = {}, model) {
    const formats = [
      ...(Array.isArray(playerResponse?.streamingData?.formats) ? playerResponse.streamingData.formats : []),
      ...(Array.isArray(playerResponse?.streamingData?.adaptiveFormats) ? playerResponse.streamingData.adaptiveFormats : [])
    ];
    return formats.map(format => assetFromFormat(format, model)).filter(Boolean);
  }

  function assetFromFormat(format = {}, model) {
    const directUrl = format.url || parseCipherUrl(format.signatureCipher) || parseCipherUrl(format.cipher);
    if (!directUrl || isPlaceholderUrl(directUrl)) {
      return null;
    }
    const mimeType = String(format.mimeType || format.mime || "");
    const role = mimeType.startsWith("audio/")
      ? model.MEDIA_ROLE.AUDIO
      : mimeType.startsWith("video/")
        ? model.MEDIA_ROLE.VIDEO
        : model.MEDIA_ROLE.UNKNOWN;
    const requiresSignatureDeciphering = Boolean((format.signatureCipher || format.cipher) && !format.url);
    const duration = Number(format.approxDurationMs || 0) / 1000 || Number(format.duration || 0) || 0;
    return model.createMediaAsset({
      url: directUrl,
      kind: model.ASSET_KIND.DIRECT,
      role,
      container: mimeType.includes("webm") ? "webm" : "mp4",
      codecs: mimeType.match(/codecs="([^"]+)"/i)?.[1] || "",
      bitrate: format.bitrate || format.averageBitrate || 0,
      duration,
      durationEvidence: duration ? model.createDurationEvidence(model.DURATION_EVIDENCE_SOURCE.PLAYER_JSON, duration, { detail: "youtube-player-response" }) : null,
      siteAdapter: "youtube",
      evidence: [{ source: "youtube-player-response", strength: 80, detail: String(format.itag || "") }],
      warnings: requiresSignatureDeciphering ? [{
        code: "requires-signature-deciphering",
        message: "YouTube candidate requires player signature deciphering before extraction."
      }] : []
    });
  }

  function parseCipherUrl(value) {
    if (!value) {
      return "";
    }
    const params = new URLSearchParams(String(value || ""));
    return params.get("url") || "";
  }

  return {
    assetsFromPlayerResponse,
    isPlaceholderUrl
  };
})();
