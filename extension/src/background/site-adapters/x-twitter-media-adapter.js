export const FuguangXTwitterMediaAdapter = (() => {
  function resolveAudioPlan(candidates = [], options = {}, deps = {}) {
    const { hlsParser, model } = deps;
    const candidate = candidates.find(item => videoTwimgAmplifyMediaId(item.url));
    if (!candidate || !hlsParser || !model) {
      return null;
    }
    const mediaId = videoTwimgAmplifyMediaId(candidate.url);
    const pageText = String(options.pageText || options.html || "");
    const urls = [
      ...extractVideoTwimgPlaylistUrlsFromText(pageText),
      ...Object.keys(options.manifestTextByUrl || {})
    ].filter(url => videoTwimgAmplifyMediaId(url) === mediaId);
    for (const url of urls) {
      const text = manifestTextForUrl(options.manifestTextByUrl, url);
      if (!text) {
        continue;
      }
      const master = hlsParser.parseMasterPlaylist(text, url);
      const audio = master.variants.find(variant => variant.audioOnly || /\/mp4a\//i.test(variant.url));
      if (!audio) {
        continue;
      }
      return createXTwitterAudioPlan({
        model,
        candidate,
        mediaId,
        audioUrl: audio.url,
        bitrate: audio.bandwidth,
        codecs: audio.codecs || "mp4a",
        evidenceSource: "x-twitter-page-master",
        reason: "selected X/Twitter mp4a audio from amplify master",
        confidence: 0.9,
        options
      });
    }
    return null;
  }

  function createXTwitterAudioPlan({ model, candidate, mediaId, audioUrl, executionUrl, audioCandidateUrls, bitrate, codecs, evidenceSource, reason, confidence, options }) {
    const primaryAsset = model.createMediaAsset({
      url: audioUrl,
      kind: model.ASSET_KIND.HLS_MEDIA,
      role: model.MEDIA_ROLE.AUDIO,
      container: "hls",
      codecs: codecs || "mp4a",
      bitrate,
      duration: candidate.duration || options.duration || 0,
      durationEvidence: durationEvidence(candidate, options, model),
      siteAdapter: "x-twitter",
      evidence: [{ source: evidenceSource, strength: 86, detail: mediaId }]
    });
    return model.createAudioSourcePlan({
      kind: "hls-audio",
      primaryAsset,
      companionAssets: [model.createMediaAsset({ ...candidate, role: "video", siteAdapter: "x-twitter" })],
      reason,
      confidence,
      ffmpegInput: {
        type: "hls",
        url: executionUrl || audioUrl,
        credentials: "include",
        audioCandidateUrls: normalizeAudioCandidateUrls(audioCandidateUrls)
      },
      expectedAudio: { codec: "aac", duration: primaryAsset.duration || 0 }
    });
  }

  function normalizeAudioCandidateUrls(urls = []) {
    const output = [];
    for (const url of Array.isArray(urls) ? urls : []) {
      const value = String(url || "");
      if (/^https?:\/\//i.test(value) && !output.includes(value)) {
        output.push(value);
      }
    }
    return output;
  }

  function extractVideoTwimgPlaylistUrlsFromText(text) {
    const decoded = decodeHtmlEntitiesForUrlScan(String(text || ""))
      .replace(/\\\//g, "/")
      .replace(/\\u002f/gi, "/");
    const urls = [];
    const pattern = /https?:\/\/video\.twimg\.com[^\s"'<>\\)]+/gi;
    let match;
    while ((match = pattern.exec(decoded))) {
      const url = String(match[0]).replace(/[.,;:!?]+$/g, "");
      if (/\.m3u8(?:$|[?#])/i.test(url) && !urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  }

  function videoTwimgAmplifyMediaId(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (!/(^|\.)video\.twimg\.com$/i.test(url.hostname)) {
        return "";
      }
      return url.pathname.match(/\/amplify_video\/(\d+)\//i)?.[1] || "";
    } catch {
      return "";
    }
  }

  function manifestTextForUrl(manifestTextByUrl = {}, url) {
    return manifestTextByUrl[url] || manifestTextByUrl[stripQuery(url)] || "";
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

  function durationEvidence(candidate, options, model) {
    const duration = Number(candidate.duration || options.duration || 0) || 0;
    return duration ? model.createDurationEvidence(model.DURATION_EVIDENCE_SOURCE.PLAYER_JSON, duration, { detail: "x-status" }) : null;
  }

  function decodeHtmlEntitiesForUrlScan(value) {
    return String(value || "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#x3d;|&#61;/gi, "=")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  return {
    extractVideoTwimgPlaylistUrlsFromText,
    resolveAudioPlan,
    videoTwimgAmplifyMediaId
  };
})();
