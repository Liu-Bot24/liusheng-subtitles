export const FuguangDashManifestParser = (() => {
  function parse(text, baseUrl = "") {
    const duration = parseIsoDuration(matchAttr(text, "mediaPresentationDuration"));
    const adaptationSets = [];
    for (const adaptationBlock of matchElements(text, "AdaptationSet")) {
      const adaptationAttrs = parseXmlAttributes(adaptationBlock.open);
      const adaptationBaseUrl = firstElementText(adaptationBlock.body, "BaseURL") || "";
      const contentType = String(adaptationAttrs.contentType || "").toLowerCase();
      const mimeType = String(adaptationAttrs.mimeType || "").toLowerCase();
      const role = inferDashRole({ contentType, mimeType, codecs: adaptationAttrs.codecs });
      const representations = [];
      for (const representationBlock of matchElements(adaptationBlock.body, "Representation")) {
        const representationAttrs = parseXmlAttributes(representationBlock.open);
        const representationBaseUrl = firstElementText(representationBlock.body, "BaseURL") || adaptationBaseUrl;
        const segmentTemplate = parseSegmentTemplate(representationBlock.body) || parseSegmentTemplate(adaptationBlock.body);
        representations.push({
          id: representationAttrs.id || "",
          role,
          mimeType: representationAttrs.mimeType || adaptationAttrs.mimeType || "",
          codecs: representationAttrs.codecs || adaptationAttrs.codecs || "",
          bandwidth: Number(representationAttrs.bandwidth || 0) || 0,
          width: Number(representationAttrs.width || adaptationAttrs.width || 0) || 0,
          height: Number(representationAttrs.height || adaptationAttrs.height || 0) || 0,
          baseUrl: resolveDashUrl(representationBaseUrl, baseUrl),
          segmentTemplate
        });
      }
      adaptationSets.push({
        role,
        mimeType: adaptationAttrs.mimeType || "",
        codecs: adaptationAttrs.codecs || "",
        representations
      });
    }
    return { duration, adaptationSets };
  }

  function parseSegmentTemplate(body) {
    const match = String(body || "").match(/<SegmentTemplate\b([^>]*)>([\s\S]*?)<\/SegmentTemplate>|<SegmentTemplate\b([^>]*)\/>/i);
    if (!match) {
      return null;
    }
    const attrs = parseXmlAttributes(match[1] || match[3] || "");
    const timelineBody = match[2] || "";
    return {
      initialization: attrs.initialization || "",
      media: attrs.media || "",
      startNumber: Number(attrs.startNumber || 1) || 1,
      timescale: Number(attrs.timescale || 1) || 1,
      timeline: parseSegmentTimeline(timelineBody)
    };
  }

  function parseSegmentTimeline(body) {
    const timeline = [];
    const timelineMatch = String(body || "").match(/<SegmentTimeline\b[^>]*>([\s\S]*?)<\/SegmentTimeline>/i);
    if (!timelineMatch) {
      return timeline;
    }
    for (const segmentMatch of timelineMatch[1].matchAll(/<S\b([^>]*)\/?>/gi)) {
      const attrs = parseXmlAttributes(segmentMatch[1]);
      timeline.push({
        t: Number(attrs.t || 0) || 0,
        d: Number(attrs.d || 0) || 0,
        r: Number(attrs.r || 0) || 0
      });
    }
    return timeline;
  }

  function inferDashRole({ contentType = "", mimeType = "", codecs = "" } = {}) {
    const text = `${contentType} ${mimeType} ${codecs}`.toLowerCase();
    if (text.includes("audio") || /(?:mp4a|opus|vorbis|flac)/i.test(text)) {
      return "audio";
    }
    if (text.includes("video") || /(?:avc|hvc|hev|vp8|vp9|av01)/i.test(text)) {
      return "video";
    }
    return "unknown";
  }

  function matchElements(text, tagName) {
    const items = [];
    const pattern = new RegExp(`<${tagName}\\b([^>]*?)\\/>|<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
    let match;
    while ((match = pattern.exec(String(text || "")))) {
      items.push({ open: match[1] || match[2] || "", body: match[3] || "" });
    }
    return items;
  }

  function firstElementText(text, tagName) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = String(text || "").match(pattern);
    return match ? decodeXmlEntities(match[1].trim()) : "";
  }

  function parseXmlAttributes(value) {
    const attrs = {};
    const pattern = /([:\w-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
    let match;
    while ((match = pattern.exec(String(value || "")))) {
      attrs[match[1]] = decodeXmlEntities(String(match[2] || "").slice(1, -1));
    }
    return attrs;
  }

  function matchAttr(text, attrName) {
    const match = String(text || "").match(new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "i"));
    return match?.[1] || "";
  }

  function parseIsoDuration(value) {
    const match = String(value || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
    if (!match) {
      return 0;
    }
    return (Number(match[1] || 0) * 86400) +
      (Number(match[2] || 0) * 3600) +
      (Number(match[3] || 0) * 60) +
      Number(match[4] || 0);
  }

  function resolveDashUrl(value, baseUrl = "") {
    try {
      return new URL(String(value || ""), baseUrl || undefined).href;
    } catch {
      return String(value || "");
    }
  }

  function decodeXmlEntities(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  return {
    inferDashRole,
    parse,
    parseIsoDuration,
    parseSegmentTemplate,
    parseXmlAttributes,
    resolveDashUrl
  };
})();
