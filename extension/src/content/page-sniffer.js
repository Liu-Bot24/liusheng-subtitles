(() => {
  if (typeof window.__fuguangPageSnifferCleanup === "function") {
    window.__fuguangPageSnifferCleanup();
  }

  const MESSAGE_TYPE = "FUGUANG_PAGE_SNIFFER_MEDIA";
  const CONTEXT_TYPE = "FUGUANG_PAGE_SNIFFER_CONTEXT";
  const MAX_DEPTH = 8;
  const URL_PATTERN = /https?:\/\/[^\s"'<>\\)]+|\/\/[^\s"'<>\\)]+/gi;
  const MEDIA_EXTENSIONS = new Set([
    "aac",
    "flac",
    "m3u",
    "m3u8",
    "m4a",
    "m4s",
    "mp3",
    "mp4",
    "mpd",
    "oga",
    "ogg",
    "opus",
    "ts",
    "wav",
    "weba",
    "webm"
  ]);

  const originalFetch = window.fetch;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const originalJsonParse = JSON.parse;
  let lastContextSignature = "";
  const seenPerformanceUrls = new Set();
  const timers = [];
  const contextTimer = setInterval(reportPageContext, 1200);
  const performanceTimer = setInterval(scanPerformanceEntries, 1500);
  timers.push(contextTimer, performanceTimer);

  reportPageContext();
  scheduleInitialScan();
  window.__fuguangPageSnifferCleanup = cleanup;

  window.fetch = function fuguangFetch(input, init) {
    inspectUrl(typeof input === "string" ? input : input?.url, "fetch-url");
    inspectHeaders(init?.headers);
    const promise = originalFetch.apply(this, arguments);
    promise.then(
      response => inspectResponse(response),
      () => {}
    );
    return promise;
  };
  window.fetch.toString = () => originalFetch.toString();

  XMLHttpRequest.prototype.open = function fuguangXhrOpen(method, url) {
    this.__fuguangUrl = url;
    return originalXhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.open.toString = () => originalXhrOpen.toString();

  XMLHttpRequest.prototype.send = function fuguangXhrSend() {
    this.addEventListener("load", () => {
      inspectUrl(this.responseURL || this.__fuguangUrl, "xhr-url");
      if (typeof this.response === "string") {
        inspectText(this.response, this.responseURL || this.__fuguangUrl, "xhr-body");
      } else if (this.response && typeof this.response === "object") {
        inspectObject(this.response, "xhr-object");
      }
    });
    return originalXhrSend.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send.toString = () => originalXhrSend.toString();

  JSON.parse = function fuguangJsonParse(text, reviver) {
    const result = originalJsonParse.apply(this, arguments);
    inspectObject(result, "json-parse");
    return result;
  };
  JSON.parse.toString = () => originalJsonParse.toString();

  function cleanup() {
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXhrOpen;
    XMLHttpRequest.prototype.send = originalXhrSend;
    JSON.parse = originalJsonParse;
    timers.forEach(timer => clearTimeout(timer));
    timers.length = 0;
    if (window.__fuguangPageSnifferCleanup === cleanup) {
      delete window.__fuguangPageSnifferCleanup;
    }
  }

  function scheduleInitialScan() {
    scanKnownPageState();
    scanPerformanceEntries();
    probeBilibiliPlayurl();
    timers.push(setTimeout(scanKnownPageState, 500));
    timers.push(setTimeout(scanPerformanceEntries, 500));
    timers.push(setTimeout(probeBilibiliPlayurl, 1000));
    timers.push(setTimeout(scanKnownPageState, 2000));
    timers.push(setTimeout(scanPerformanceEntries, 2000));
    timers.push(setTimeout(probeBilibiliPlayurl, 3000));
    timers.push(setTimeout(probeBilibiliPlayurl, 7000));
  }

  async function probeBilibiliPlayurl() {
    const ids = readBilibiliVideoIds();
    if (!ids.bvid || !ids.cid) {
      return;
    }
    const key = `${ids.bvid}:${ids.cid}`;
    const lastProbe = window.__fuguangLastBilibiliPlayurlProbe || {};
    if (lastProbe.key === key && lastProbe.ok) {
      return;
    }
    window.__fuguangLastBilibiliPlayurlProbe = { key, ok: false, at: Date.now() };
    const params = new URLSearchParams({
      bvid: ids.bvid,
      cid: String(ids.cid),
      qn: "80",
      fnval: "4048",
      fnver: "0",
      fourk: "1"
    });
    if (ids.aid) {
      params.set("avid", String(ids.aid));
    }
    try {
      const response = await originalFetch.call(window, `https://api.bilibili.com/x/player/playurl?${params}`, {
        credentials: "include"
      });
      if (!response.ok) {
        return;
      }
      const json = await response.json();
      postBilibiliPlayurlMedia(json?.data || json?.result || {});
      window.__fuguangLastBilibiliPlayurlProbe = { key, ok: true, at: Date.now() };
    } catch {
      // Bilibili fallback is opportunistic; normal network sniffing remains active.
    }
  }

  function readBilibiliVideoIds() {
    if (!/(^|\.)bilibili\.com$/i.test(location.hostname)) {
      return {};
    }
    const initial = window.__INITIAL_STATE__ || {};
    const videoData = initial.videoData || {};
    const pages = Array.isArray(videoData.pages) ? videoData.pages : Array.isArray(initial.pages) ? initial.pages : [];
    const bvid = String(
      videoData.bvid ||
      initial.bvid ||
      location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1] ||
      ""
    );
    const aid = parseInteger(videoData.aid || initial.aid || initial.aidInfo?.aid);
    const cid = parseInteger(
      videoData.cid ||
      initial.cid ||
      initial.cidMap?.[bvid]?.cid ||
      pages.find(page => parseInteger(page?.cid))?.cid
    );
    return { bvid, aid, cid };
  }

  function postBilibiliPlayurlMedia(data) {
    const duration = parseDurationValue(data?.dash?.duration || data?.duration || data?.timelength);
    const audioItems = Array.isArray(data?.dash?.audio) ? data.dash.audio : [];
    const videoItems = Array.isArray(data?.dash?.video) ? data.dash.video : [];
    for (const item of audioItems) {
      postBilibiliDashItem(item, "audio", duration);
    }
    for (const item of videoItems) {
      postBilibiliDashItem(item, "media", duration);
    }
  }

  function postBilibiliDashItem(item, kind, duration) {
    const urls = [
      item?.baseUrl,
      item?.base_url,
      ...(Array.isArray(item?.backupUrl) ? item.backupUrl : []),
      ...(Array.isArray(item?.backup_url) ? item.backup_url : [])
    ].filter(Boolean);
    const contentType = normalizeMime(item?.mimeType || item?.mime || (kind === "audio" ? "audio/mp4" : "video/mp4"));
    for (const url of [...new Set(urls)]) {
      postMedia(url, kind, "m4s", "bilibili-playurl", {
        contentType,
        duration,
        videoWidth: parseInteger(item?.width),
        videoHeight: parseInteger(item?.height),
        bandwidth: parseInteger(item?.bandwidth || item?.bitrate),
        qualityLabel: item?.qualityLabel || item?.quality || String(item?.id || "")
      });
    }
  }

  function scanKnownPageState() {
    [
      "__playinfo__",
      "__INITIAL_STATE__",
      "__NEXT_DATA__",
      "__NUXT__",
      "__APOLLO_STATE__",
      "ytInitialData",
      "ytInitialPlayerResponse"
    ].forEach(name => {
      try {
        inspectObject(window[name], `global:${name}`);
      } catch {
        // Ignore page globals that throw during access.
      }
    });
  }

  function scanPerformanceEntries() {
    try {
      const entries = window.performance?.getEntriesByType?.("resource") || [];
      for (const entry of entries) {
        if (!entry?.name || seenPerformanceUrls.has(entry.name)) {
          continue;
        }
        seenPerformanceUrls.add(entry.name);
        const classified = classifyUrl(entry.name);
        if (!classified) {
          continue;
        }
        postMedia(classified.url, classified.kind, classified.ext, "performance-entry", {
          size: parseInteger(entry.transferSize || entry.encodedBodySize || entry.decodedBodySize)
        });
      }
      if (seenPerformanceUrls.size > 2000) {
        seenPerformanceUrls.clear();
      }
    } catch {
      // Resource timing can be unavailable on some pages/frames.
    }
  }

  function inspectResponse(response) {
    const contentType = response.headers?.get("content-type") || "";
    if (!shouldInspectResponse(response.url, contentType)) {
      return;
    }
    response
      .clone()
      .text()
      .then(text => inspectText(text, response.url, "fetch-body"))
      .catch(() => {});
  }

  function shouldInspectResponse(url, contentType) {
    const normalized = contentType.toLowerCase();
    return (
      classifyUrl(url) ||
      normalized.includes("json") ||
      normalized.includes("mpegurl") ||
      normalized.includes("dash+xml") ||
      normalized.includes("text/") ||
      normalized.includes("javascript")
    );
  }

  function inspectHeaders(headers) {
    if (!headers) {
      return;
    }
    try {
      if (headers instanceof Headers) {
        headers.forEach(value => inspectText(String(value), location.href, "fetch-header"));
      } else if (Array.isArray(headers)) {
        headers.forEach(([, value]) => inspectText(String(value), location.href, "fetch-header"));
      } else if (typeof headers === "object") {
        Object.values(headers).forEach(value => inspectText(String(value), location.href, "fetch-header"));
      }
    } catch {
      return;
    }
  }

  function inspectObject(value, source, depth = 0, seen = new WeakSet()) {
    if (!value || depth > MAX_DEPTH) {
      return;
    }
    if (typeof value === "string") {
      inspectText(value, location.href, source);
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    inspectStructuredMediaObject(value, source);
    if (Array.isArray(value)) {
      value.forEach(item => inspectObject(item, source, depth + 1, seen));
      return;
    }
    Object.values(value).forEach(item => inspectObject(item, source, depth + 1, seen));
  }

  function inspectText(text, baseUrl, source) {
    if (!text) {
      return;
    }
    if (text.slice(0, 7).toUpperCase() === "#EXTM3U") {
      const manifest = parseHlsManifest(text, baseUrl);
      postMedia(baseUrl, "hls", "m3u8", source, manifest);
      for (const variant of manifest.variants) {
        postMedia(variant.url, "hls", "m3u8", source, variant);
      }
      return;
    }
    if (text.includes("urn:mpeg:dash:schema:mpd") || text.includes("<MPD")) {
      postMedia(baseUrl, "dash", "mpd", source, parseDashManifest(text));
      return;
    }
    for (const match of text.matchAll(URL_PATTERN)) {
      inspectUrl(match[0], source);
    }
  }

  function inspectUrl(rawUrl, source) {
    const classified = classifyUrl(rawUrl);
    if (!classified) {
      return;
    }
    postMedia(classified.url, classified.kind, classified.ext, source);
  }

  function classifyUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
      return null;
    }
    let url = rawUrl.trim().replace(/[),.;]+$/, "");
    if (url.startsWith("//")) {
      url = `${location.protocol}${url}`;
    }
    try {
      url = new URL(url, location.href).href;
    } catch {
      return null;
    }
    if (isIgnoredMediaUrl(url)) {
      return null;
    }
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const ext = pathname.split(".").pop() || "";
    const mime = normalizeMime(parsed.searchParams.get("mime") || parsed.searchParams.get("mimeType") || "");
    if (mime.startsWith("audio/")) {
      return { url, kind: "audio", ext: extFromMime(mime, ext) };
    }
    if (mime.startsWith("video/")) {
      return { url, kind: "media", ext: extFromMime(mime, ext) };
    }
    if (mime.includes("mpegurl")) {
      return { url, kind: "hls", ext: "m3u8" };
    }
    if (mime.includes("dash+xml")) {
      return { url, kind: "dash", ext: "mpd" };
    }
    if (isYoutubePlaybackUrl(parsed)) {
      return { url, kind: "media", ext: ext || "" };
    }
    if (!MEDIA_EXTENSIONS.has(ext)) {
      return null;
    }
    if (ext === "m3u8" || ext === "m3u") {
      return { url, kind: "hls", ext };
    }
    if (ext === "mpd") {
      return { url, kind: "dash", ext };
    }
    if (["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav", "weba"].includes(ext)) {
      return { url, kind: "audio", ext };
    }
    return { url, kind: "media", ext };
  }

  function isIgnoredMediaUrl(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href);
      const pathname = url.pathname.toLowerCase();
      if (url.hostname === "cdn.plyr.io" && pathname === "/static/blank.mp4") {
        return true;
      }
      if (isYoutubePlaceholderAudio(url)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function inspectStructuredMediaObject(value, source) {
    if (!value || typeof value !== "object") {
      return;
    }
    const urls = extractStructuredMediaUrls(value);
    if (!urls.length) {
      return;
    }
    const mime = normalizeMime(value.mimeType || value.mime || value.contentType || "");
    for (const rawUrl of urls) {
      const classified = classifyUrl(rawUrl);
      if (!classified && !mime.startsWith("audio/") && !mime.startsWith("video/")) {
        continue;
      }
      const kind = mime.startsWith("audio/") ? "audio" : classified?.kind || "media";
      postMedia(rawUrl, kind, classified?.ext || extFromMime(mime), source, {
        contentType: mime,
        size: parseInteger(value.contentLength || value.size || value.clen),
        duration: parseStructuredMediaDuration(value),
        videoWidth: parseInteger(value.width),
        videoHeight: parseInteger(value.height),
        bandwidth: parseInteger(value.bitrate || value.averageBitrate || value.bandwidth),
        qualityLabel: value.qualityLabel || value.quality || value.audioQuality || "",
        source: "structured-media"
      });
    }
  }

  function extractStructuredMediaUrls(value) {
    const urls = [];
    addUrl(value.url);
    addUrl(value.baseUrl);
    addUrl(value.base_url);
    addUrl(parseCipherUrl(value.signatureCipher));
    addUrl(parseCipherUrl(value.cipher));
    addUrls(value.backupUrl);
    addUrls(value.backup_url);
    addUrls(value.backupUrls);
    return [...new Set(urls)];

    function addUrls(items) {
      if (Array.isArray(items)) {
        items.forEach(addUrl);
      } else {
        addUrl(items);
      }
    }

    function addUrl(url) {
      if (typeof url === "string" && url.trim()) {
        urls.push(url);
      }
    }
  }

  function parseCipherUrl(cipher) {
    try {
      return new URLSearchParams(cipher).get("url") || "";
    } catch {
      return "";
    }
  }

  function normalizeMime(value) {
    return String(value || "").split(";", 1)[0].trim().toLowerCase();
  }

  function parseInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
  }

  function parseStructuredMediaDuration(value) {
    const milliseconds = Number(value.approxDurationMs || value.durationMs || value.lengthMs);
    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      return milliseconds / 1000;
    }
    return parseDurationValue(value.duration || value.lengthSeconds || value.durationSeconds);
  }

  function isYoutubePlaceholderAudio(url) {
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    return hostname.endsWith("youtube.com") && pathname === "/s/search/audio/no_input.mp3";
  }

  function isYoutubePlaybackUrl(url) {
    return /(^|\.)googlevideo\.com$/i.test(url.hostname) && /\/videoplayback$/i.test(url.pathname);
  }

  function extFromMime(mime, fallback = "") {
    if (mime.includes("mp4")) {
      return "mp4";
    }
    if (mime.includes("webm")) {
      return "webm";
    }
    if (mime.includes("mp3") || mime.includes("mpeg")) {
      return "mp3";
    }
    if (mime.includes("ogg")) {
      return "ogg";
    }
    return fallback || "";
  }

  function parseHlsManifest(text, baseUrl) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const manifest = {
      duration: 0,
      playlistType: "media",
      variants: []
    };
    let pendingVariant = null;
    for (const line of lines) {
      if (line.startsWith("#EXTINF:")) {
        const seconds = Number.parseFloat(line.slice(8).split(",", 1)[0]);
        if (Number.isFinite(seconds)) {
          manifest.duration += seconds;
        }
        continue;
      }
      if (line.startsWith("#EXT-X-STREAM-INF:")) {
        manifest.playlistType = "master";
        pendingVariant = parseHlsAttributes(line.slice(18));
        continue;
      }
      if (pendingVariant && !line.startsWith("#")) {
        const url = absoluteUrl(line, baseUrl);
        if (url) {
          manifest.variants.push({
            ...pendingVariant,
            url,
            playlistType: "variant"
          });
        }
        pendingVariant = null;
      }
    }
    if (!manifest.duration) {
      delete manifest.duration;
    }
    return manifest;
  }

  function parseHlsAttributes(value) {
    const output = {};
    const resolution = value.match(/RESOLUTION=(\d+)x(\d+)/i);
    if (resolution) {
      output.videoWidth = Number(resolution[1]);
      output.videoHeight = Number(resolution[2]);
      output.qualityLabel = `${output.videoHeight}p`;
    }
    const bandwidth = value.match(/BANDWIDTH=(\d+)/i);
    if (bandwidth) {
      output.bandwidth = Number(bandwidth[1]);
    }
    return output;
  }

  function parseDashManifest(text) {
    const durationMatch = text.match(/\bmediaPresentationDuration=(["'])(.*?)\1/i);
    return {
      duration: durationMatch ? parseIsoDuration(durationMatch[2]) : undefined
    };
  }

  function reportPageContext() {
    const context = extractPageContext();
    const signature = JSON.stringify(context);
    if (signature === lastContextSignature) {
      return;
    }
    lastContextSignature = signature;
    window.postMessage(
      {
        type: CONTEXT_TYPE,
        context
      },
      "*"
    );
  }

  function extractPageContext() {
    const media = findPrimaryMedia();
    const dimensions = media
      ? {
          videoWidth: media.videoWidth || null,
          videoHeight: media.videoHeight || null,
          elementWidth: media.clientWidth || null,
          elementHeight: media.clientHeight || null,
          mediaTag: media.tagName.toLowerCase(),
          readyState: media.readyState || 0
        }
      : {};
    return {
      href: location.href,
      title: document.title,
      description: readMetaDescription(),
      language: readPageLanguage(),
      hasMedia: Boolean(media),
      duration: firstFiniteDuration(
        media?.duration,
        readStructuredDuration(),
        readKnownPlayerDuration(window.__INITIAL_STATE__),
        readKnownPlayerDuration(window.__playinfo__),
        readKnownPlayerDuration(window.ytInitialPlayerResponse)
      ),
      currentTime: Number.isFinite(media?.currentTime) ? media.currentTime : null,
      ...dimensions
    };
  }

  function readMetaDescription() {
    return (
      document.querySelector('meta[property="og:description"]')?.content ||
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[name="twitter:description"]')?.content ||
      ""
    ).trim();
  }

  function readPageLanguage() {
    return (
      document.documentElement.lang ||
      document.querySelector('meta[http-equiv="content-language"]')?.content ||
      document.querySelector('meta[property="og:locale"]')?.content ||
      ""
    ).trim();
  }

  function findPrimaryMedia() {
    const media = [...document.querySelectorAll("video, audio")];
    if (!media.length) {
      return null;
    }
    return media
      .map(element => ({
        element,
        area: (element.clientWidth || 0) * (element.clientHeight || 0)
      }))
      .sort((a, b) => b.area - a.area)[0].element;
  }

  function readStructuredDuration() {
    const metaDuration =
      document.querySelector('meta[property="video:duration"]')?.content ||
      document.querySelector('meta[itemprop="duration"]')?.content ||
      document.querySelector("time[datetime]")?.getAttribute("datetime") ||
      "";
    const parsedMeta = parseDurationValue(metaDuration);
    if (parsedMeta) {
      return parsedMeta;
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const json = originalJsonParse(script.textContent || "{}");
        const duration = findStructuredDuration(json);
        if (duration) {
          return duration;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  function findStructuredDuration(value, depth = 0) {
    if (!value || depth > 5) {
      return null;
    }
    if (typeof value === "string") {
      return parseDurationValue(value);
    }
    if (typeof value !== "object") {
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const duration = findStructuredDuration(item, depth + 1);
        if (duration) {
          return duration;
        }
      }
      return null;
    }
    const explicit = parseDurationValue(value.duration || value.lengthSeconds || value.durationSeconds);
    if (explicit) {
      return explicit;
    }
    for (const item of Object.values(value)) {
      const duration = findStructuredDuration(item, depth + 1);
      if (duration) {
        return duration;
      }
    }
    return null;
  }

  function readKnownPlayerDuration(value) {
    const candidates = [
      value?.videoData?.duration,
      value?.epInfo?.duration,
      value?.videoDetails?.lengthSeconds,
      value?.data?.dash?.duration,
      value?.dash?.duration
    ];
    for (const candidate of candidates) {
      const duration = parseDurationValue(candidate);
      if (duration) {
        return duration;
      }
    }
    return findDurationByKey(value);
  }

  function findDurationByKey(value, depth = 0, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) {
      return null;
    }
    seen.add(value);
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      if (["duration", "durationsec", "durationseconds", "lengthseconds"].includes(normalizedKey)) {
        const duration = parseDurationValue(item);
        if (duration) {
          return duration;
        }
      }
      const nested = findDurationByKey(item, depth + 1, seen);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  function firstFiniteDuration(...values) {
    for (const value of values) {
      const duration = parseDurationValue(value);
      if (duration) {
        return duration;
      }
    }
    return null;
  }

  function parseDurationValue(value) {
    if (typeof value === "string" && value.trim().startsWith("P")) {
      return parseIsoDuration(value.trim());
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return null;
    }
    return number > 100000 ? number / 1000 : number;
  }

  function parseIsoDuration(value) {
    const match = String(value).match(
      /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
    );
    if (!match) {
      return null;
    }
    const [, years, months, weeks, days, hours, minutes, seconds] = match.map(part => Number(part || 0));
    return (
      years * 31536000 +
      months * 2592000 +
      weeks * 604800 +
      days * 86400 +
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  function absoluteUrl(rawUrl, baseUrl) {
    try {
      return new URL(rawUrl, baseUrl || location.href).href;
    } catch {
      return "";
    }
  }

  function postMedia(url, kind, ext, source, extra = {}) {
    if (!url) {
      return;
    }
    window.postMessage(
      {
        type: MESSAGE_TYPE,
        media: {
          url,
          kind,
          ext,
          source,
          href: location.href,
          title: document.title,
          duration: extra.duration,
          contentType: extra.contentType,
          size: extra.size,
          videoWidth: extra.videoWidth,
          videoHeight: extra.videoHeight,
          bandwidth: extra.bandwidth,
          qualityLabel: extra.qualityLabel,
          playlistType: extra.playlistType
        }
      },
      "*"
    );
  }
})();
