export const FuguangHlsManifestParser = (() => {
  function parse(text, baseUrl = "") {
    const master = parseMasterPlaylist(text, baseUrl);
    const media = parseMediaPlaylist(text, baseUrl);
    return {
      type: master.variants.length || master.audioRenditions.length ? "master" : "media",
      master,
      media
    };
  }

  function parseMasterPlaylist(text, baseUrl = "") {
    const lines = splitHlsLines(text);
    const variants = [];
    const audioRenditions = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.startsWith("#EXT-X-MEDIA:")) {
        const attrs = parseHlsAttributes(line.slice("#EXT-X-MEDIA:".length));
        if (String(attrs.TYPE || "").toUpperCase() === "AUDIO" && attrs.URI) {
          audioRenditions.push({
            type: "audio",
            groupId: attrs["GROUP-ID"] || "",
            name: attrs.NAME || "",
            language: attrs.LANGUAGE || "",
            url: resolveHlsUrl(attrs.URI, baseUrl),
            codecs: attrs.CODECS || "",
            audioOnly: true
          });
        }
        continue;
      }
      if (!line.startsWith("#EXT-X-STREAM-INF:")) {
        continue;
      }
      const attrs = parseHlsAttributes(line.slice("#EXT-X-STREAM-INF:".length));
      const uri = nextHlsUri(lines, index + 1);
      if (!uri) {
        continue;
      }
      variants.push({
        url: resolveHlsUrl(uri, baseUrl),
        bandwidth: Number(attrs.BANDWIDTH || attrs["AVERAGE-BANDWIDTH"] || 0) || 0,
        resolution: attrs.RESOLUTION || "",
        codecs: attrs.CODECS || "",
        audioGroupId: attrs.AUDIO || "",
        videoGroupId: attrs.VIDEO || "",
        audioOnly: streamInfIsAudioOnly(attrs)
      });
    }
    return {
      variants: [...audioRenditions, ...variants],
      audioRenditions
    };
  }

  function parseMediaPlaylist(text, baseUrl = "") {
    const lines = splitHlsLines(text);
    const segments = [];
    const maps = [];
    const keys = [];
    let currentKey = null;
    let currentMap = null;
    let pendingDuration = 0;
    let unsupportedEncryption = "";
    for (const line of lines) {
      if (line.startsWith("#EXT-X-KEY:")) {
        const attrs = parseHlsAttributes(line.slice("#EXT-X-KEY:".length));
        const method = String(attrs.METHOD || "").toUpperCase();
        if (!method || method === "NONE") {
          currentKey = null;
        } else if (method === "AES-128" && attrs.URI) {
          currentKey = {
            method,
            uri: resolveHlsUrl(attrs.URI, baseUrl),
            iv: attrs.IV || ""
          };
          keys.push(currentKey);
        } else {
          unsupportedEncryption = method || "unknown";
          currentKey = null;
        }
        continue;
      }
      if (line.startsWith("#EXT-X-MAP:")) {
        const attrs = parseHlsAttributes(line.slice("#EXT-X-MAP:".length));
        if (attrs.URI) {
          currentMap = {
            url: resolveHlsUrl(attrs.URI, baseUrl),
            byteRange: attrs.BYTERANGE || ""
          };
          maps.push(currentMap);
        }
        continue;
      }
      if (line.startsWith("#EXTINF:")) {
        pendingDuration = Number.parseFloat(line.slice("#EXTINF:".length).split(",")[0]) || 0;
        continue;
      }
      if (!line || line.startsWith("#")) {
        continue;
      }
      segments.push({
        url: resolveHlsUrl(line, baseUrl),
        duration: pendingDuration || 0,
        key: currentKey,
        map: currentMap
      });
      pendingDuration = 0;
    }
    let cursor = 0;
    for (const segment of segments) {
      segment.start = cursor;
      cursor += segment.duration || 0;
      segment.end = cursor;
    }
    return {
      segments,
      maps,
      keys,
      duration: cursor,
      unsupportedEncryption,
      containerHint: inferHlsContainerHint(segments, maps)
    };
  }

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
    const output = [];
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return output;
    }
    const addPath = pathname => {
      const next = new URL(url.href);
      next.pathname = pathname;
      if (!output.includes(next.href)) {
        output.push(next.href);
      }
    };
    const pathname = url.pathname;
    const filename = pathname.split("/").pop() || "";
    const basePath = pathname.slice(0, pathname.length - filename.length);
    const addFilename = nextFilename => {
      if (nextFilename && nextFilename !== filename) {
        addPath(`${basePath}${nextFilename}`);
      }
    };
    if (/\/video\//i.test(pathname)) {
      addPath(pathname.replace(/\/video\//i, "/audio/"));
    }
    if (/\/video\.m3u8$/i.test(pathname)) {
      addPath(pathname.replace(/\/video\.m3u8$/i, "/audio.m3u8"));
    }
    const formatTrackMatch = filename.match(/([._-])f(\d+)([._-])v(\d+)(?=\.m3u8$|[._-])/i);
    if (formatTrackMatch) {
      const format = Number(formatTrackMatch[2]);
      const track = Number(formatTrackMatch[4]) || 1;
      for (const audioFormat of [...new Set([format - 1, format].filter(value => value > 0))]) {
        addFilename(filename.replace(/([._-])f\d+([._-])v\d+(?=\.m3u8$|[._-])/i, `$1f${audioFormat}$2a${track}`));
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
    if (/(^|\.)video\.twimg\.com$/i.test(url.hostname)) {
      const avcMatch = pathname.match(/^(.*\/pl\/)avc1\/[^/]+\/([^/]+\.m3u8)$/i);
      if (avcMatch) {
        for (const bitrate of ["128000", "64000", "32000"]) {
          addPath(`${avcMatch[1]}mp4a/${bitrate}/${avcMatch[2]}`);
        }
      }
    }
    return output;
  }

  function streamInfIsAudioOnly(attrs = {}) {
    if (attrs.RESOLUTION || attrs.VIDEO) {
      return false;
    }
    const codecs = String(attrs.CODECS || "")
      .split(",")
      .map(codec => codec.trim())
      .filter(Boolean);
    return codecs.length > 0 && codecs.every(isHlsAudioCodec);
  }

  function isHlsAudioCodec(codec) {
    return /^(?:mp4a|ac-3|ec-3|opus|vorbis|flac|alac)(?:\.|$)/i.test(String(codec || ""));
  }

  function inferHlsContainerHint(segments, maps) {
    const sample = maps[0]?.url || segments[0]?.url || "";
    const ext = String(sample).split("?")[0].split(".").pop()?.toLowerCase() || "";
    if (["cmfa", "cmfv", "cmf", "m4s", "m4a", "m4v", "mp4"].includes(ext)) {
      return "fmp4";
    }
    if (ext === "ts") {
      return "ts";
    }
    return ext || "";
  }

  function splitHlsLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  function nextHlsUri(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index += 1) {
      if (!lines[index].startsWith("#")) {
        return lines[index];
      }
    }
    return "";
  }

  function parseHlsAttributes(value) {
    const attrs = {};
    const pattern = /([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/gi;
    let match;
    while ((match = pattern.exec(value))) {
      attrs[match[1].toUpperCase()] = String(match[2] || "").replace(/^"|"$/g, "");
    }
    return attrs;
  }

  function resolveHlsUrl(value, baseUrl = "") {
    try {
      return new URL(String(value || ""), baseUrl || undefined).href;
    } catch {
      return String(value || "");
    }
  }

  return {
    buildAudioSiblingUrls,
    inferHlsRoleFromUrl,
    parse,
    parseHlsAttributes,
    parseMasterPlaylist,
    parseMediaPlaylist,
    resolveHlsUrl,
    splitHlsLines
  };
})();
