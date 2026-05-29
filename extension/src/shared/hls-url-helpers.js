export const FuguangHlsUrlHelpers = (() => {
  function inferHlsRoleFromUrl(rawUrl) {
    let path = "";
    try {
      const url = new URL(rawUrl);
      path = `${url.pathname} ${url.search}`.toLowerCase();
    } catch {
      path = String(rawUrl || "").toLowerCase();
    }
    if (/(?:^|[-_/])(?:audio|aac|m4a|mp3|opus)(?:[-_.\/]|$)/i.test(path) ||
      /(?:^|[-_/])(?:f\d+[-_.])?a\d+(?=[-_.\/]|$)/i.test(path) ||
      /\/mp4a\//i.test(path)) {
      return "audio";
    }
    if (/(?:^|[-_/])(?:video|h264|h265|hevc|avc1|vp9)(?:[-_.\/]|$)/i.test(path) ||
      /(?:^|[-_/])(?:f\d+[-_.])?v\d+(?=[-_.\/]|$)/i.test(path) ||
      /\/avc1\//i.test(path)) {
      return "video";
    }
    return "unknown";
  }

  function buildAudioSiblingUrls(rawUrl) {
    const collector = createUrlCollector(rawUrl);
    if (!collector) {
      return [];
    }
    const { addPath, url } = collector;
    if (/\/video\//i.test(url.pathname)) {
      addPath(url.pathname.replace(/\/video\//i, "/audio/"));
    }
    if (/\/video\.m3u8$/i.test(url.pathname)) {
      addPath(url.pathname.replace(/\/video\.m3u8$/i, "/audio.m3u8"));
    }
    addAudioTrackTokenCompanionPaths(url, addPath);
    addVideoTwimgCompanionPaths(url, addPath);
    return collector.output;
  }

  function buildLikelyAudioCompanionPlaylistUrls(rawUrl) {
    const collector = createUrlCollector(rawUrl);
    if (!collector) {
      return [];
    }
    const { addPath, url } = collector;
    if (/\/video\.m3u8$/i.test(url.pathname)) {
      addPath(url.pathname.replace(/\/video\.m3u8$/i, "/audio.m3u8"));
    }
    addQualityDirectoryCompanionPaths(url, addPath);
    if (/\/video\//i.test(url.pathname)) {
      addPath(url.pathname.replace(/\/video\//i, "/audio/"));
    }
    addAudioTrackTokenCompanionPaths(url, addPath);
    addVideoTwimgCompanionPaths(url, addPath);
    return collector.output;
  }

  function createUrlCollector(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    const output = [];
    const addPath = pathname => {
      const next = new URL(url.href);
      next.pathname = pathname;
      if (!output.includes(next.href)) {
        output.push(next.href);
      }
    };
    return { addPath, output, url };
  }

  function addQualityDirectoryCompanionPaths(url, addPath) {
    const qualityVideoMatch = String(url?.pathname || "").match(/^(.*)\/([^/]+)\/video\.m3u8$/i);
    if (!qualityVideoMatch || !isLikelyVideoQualityPathPart(qualityVideoMatch[2])) {
      return;
    }
    const basePath = qualityVideoMatch[1];
    addPath(`${basePath}/audio/audio.m3u8`);
    addPath(`${basePath}/audio/index.m3u8`);
    addPath(`${basePath}/audio/playlist.m3u8`);
    addPath(`${basePath}/audio.m3u8`);
    addPath(`${basePath}/mp4a/audio.m3u8`);
    addPath(`${basePath}/aac/audio.m3u8`);
  }

  function addAudioTrackTokenCompanionPaths(url, addPath) {
    const pathname = String(url?.pathname || "");
    const filename = pathname.split("/").pop() || "";
    if (!/\.m3u8$/i.test(filename)) {
      return;
    }
    const basePath = pathname.slice(0, pathname.length - filename.length);
    const addFilename = nextFilename => {
      if (nextFilename && nextFilename !== filename) {
        addPath(`${basePath}${nextFilename}`);
      }
    };
    const formatTrackMatch = filename.match(/([._-])f(\d+)([._-])v(\d+)(?=\.m3u8$|[._-])/i);
    if (formatTrackMatch) {
      const format = Number(formatTrackMatch[2]);
      const track = Number(formatTrackMatch[4]) || 1;
      const formats = [
        Number.isFinite(format) && format > 1 ? format - 1 : 0,
        format
      ].filter(value => Number.isFinite(value) && value > 0);
      for (const audioFormat of [...new Set(formats)]) {
        addFilename(filename.replace(
          /([._-])f\d+([._-])v\d+(?=\.m3u8$|[._-])/i,
          `$1f${audioFormat}$2a${track || 1}`
        ));
      }
    }
    const numberedVideoTrackMatch = filename.match(/([._-])v(\d+)(?=\.m3u8$|[._-])/i);
    if (numberedVideoTrackMatch) {
      const track = Number(numberedVideoTrackMatch[2]) || 1;
      for (const audioTrack of [...new Set([track, 1])]) {
        addFilename(filename.replace(/([._-])v\d+(?=\.m3u8$|[._-])/i, `$1a${audioTrack}`));
      }
    }
    addFilename(filename.replace(/([._-])video(?=\.m3u8$|[._-])/i, "$1audio"));
  }

  function addVideoTwimgCompanionPaths(url, addPath) {
    if (!/(^|\.)video\.twimg\.com$/i.test(String(url?.hostname || ""))) {
      return;
    }
    const avcMatch = String(url?.pathname || "").match(/^(.*\/pl\/)avc1\/[^/]+\/([^/]+\.m3u8)$/i);
    if (!avcMatch) {
      return;
    }
    for (const bitrate of ["128000", "64000", "32000"]) {
      addPath(`${avcMatch[1]}mp4a/${bitrate}/${avcMatch[2]}`);
    }
  }

  function isLikelyVideoQualityPathPart(value) {
    return /^(?:\d{3,4}p|[1-9]\d{2,4}x[1-9]\d{2,4}|avc1|h264|h265|hevc|vp9|video)$/i.test(String(value || ""));
  }

  return {
    buildAudioSiblingUrls,
    buildLikelyAudioCompanionPlaylistUrls,
    inferHlsRoleFromUrl,
    isLikelyVideoQualityPathPart
  };
})();
