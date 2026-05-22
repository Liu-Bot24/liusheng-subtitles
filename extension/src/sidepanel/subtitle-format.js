(function initSubtitleFormat(global) {
  "use strict";

  function parseSubtitleImportText(text, options = {}) {
    const value = stripBom(String(text || "")).trim();
    const filename = String(options.filename || "").toLowerCase();
    if (!value) {
      throw new Error("字幕文件为空。");
    }

    if (filename.endsWith(".json") || looksLikeJson(value)) {
      return parseJsonSubtitle(value);
    }
    if (filename.endsWith(".vtt") || /^WEBVTT\b/i.test(value)) {
      return fromSegments("vtt", parseWebVtt(value));
    }
    if (filename.endsWith(".srt") || looksLikeSrt(value)) {
      return fromSegments("srt", parseTimedTextBlocks(value));
    }
    if (filename.endsWith(".ass") || filename.endsWith(".ssa") || looksLikeAss(value)) {
      return fromSegments(filename.endsWith(".ssa") ? "ssa" : "ass", parseAss(value));
    }

    const fallbackParsers = [
      ["vtt", parseWebVtt],
      ["srt", parseTimedTextBlocks],
      ["ass", parseAss]
    ];
    for (const [format, parser] of fallbackParsers) {
      const segments = parser(value);
      if (segments.length) {
        return fromSegments(format, segments);
      }
    }

    throw new Error("无法识别字幕文件格式；支持 JSON、SRT、VTT、ASS/SSA。");
  }

  function parseJsonSubtitle(text) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON 字幕文件无法解析：${error.message}`);
    }
    const transcript = normalizeTranscript(payload?.transcript || payload);
    return {
      format: "json",
      transcript,
      metadata: {
        pageUrl: String(payload?.pageUrl || ""),
        sourceUrl: String(payload?.sourceUrl || ""),
        title: String(payload?.title || ""),
        jobId: String(payload?.jobId || "")
      }
    };
  }

  function normalizeTranscript(transcript) {
    const source = Array.isArray(transcript?.source) ? transcript.source : [];
    const translated = Array.isArray(transcript?.translated) ? transcript.translated : [];
    if (!source.length && !translated.length) {
      throw new Error("导入文件缺少可用字幕数组。");
    }
    return {
      source: source.map(normalizeSegment).filter(Boolean),
      translated: translated.map(normalizeSegment).filter(Boolean),
      chunkStatuses: Array.isArray(transcript?.chunkStatuses) ? transcript.chunkStatuses : []
    };
  }

  function normalizeSegment(segment) {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    const text = cleanSubtitleText(segment?.text);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || !text) {
      return null;
    }
    return { start, end, text };
  }

  function fromSegments(format, segments) {
    const normalized = segments.map(normalizeSegment).filter(Boolean);
    if (!normalized.length) {
      throw new Error("导入文件没有可用字幕。");
    }
    return {
      format,
      transcript: {
        source: [],
        translated: normalized,
        chunkStatuses: []
      },
      metadata: {}
    };
  }

  function parseWebVtt(text) {
    const body = stripWebVttHeader(text);
    return parseTimedTextBlocks(body);
  }

  function parseTimedTextBlocks(text) {
    return normalizeNewlines(text)
      .split(/\n{2,}/)
      .map(block => block.trim())
      .filter(Boolean)
      .filter(block => !/^(NOTE|STYLE|REGION)(\s|$)/i.test(block))
      .map(parseTimedTextBlock)
      .filter(Boolean);
  }

  function parseTimedTextBlock(block) {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex(line => line.includes("-->"));
    if (timeIndex < 0) {
      return null;
    }
    const [startText, endWithSettings] = lines[timeIndex].split("-->");
    const endText = String(endWithSettings || "").trim().split(/\s+/)[0];
    const start = parseTimestamp(startText.trim());
    const end = parseTimestamp(endText);
    const text = cleanSubtitleText(lines.slice(timeIndex + 1).join(" "));
    if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
      return null;
    }
    return { start, end, text };
  }

  function parseAss(text) {
    const lines = normalizeNewlines(text).split("\n");
    let inEvents = false;
    let format = [];
    const segments = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";")) {
        continue;
      }
      if (/^\[events\]$/i.test(line)) {
        inEvents = true;
        continue;
      }
      if (/^\[.+\]$/.test(line)) {
        inEvents = false;
        continue;
      }
      if (!inEvents) {
        continue;
      }
      if (/^format\s*:/i.test(line)) {
        format = line
          .replace(/^format\s*:/i, "")
          .split(",")
          .map(value => value.trim().toLowerCase());
        continue;
      }
      if (/^dialogue\s*:/i.test(line)) {
        const segment = parseAssDialogue(line, format);
        if (segment) {
          segments.push(segment);
        }
      }
    }
    return segments;
  }

  function parseAssDialogue(line, format) {
    const fields = splitAssFields(line.replace(/^dialogue\s*:/i, "").trim(), Math.max(format.length, 10));
    const startIndex = format.indexOf("start");
    const endIndex = format.indexOf("end");
    const textIndex = format.indexOf("text");
    const fallbackOffset = fields.length >= 10 ? 0 : -1;
    const start = parseTimestamp(fields[startIndex >= 0 ? startIndex : 1 + fallbackOffset]);
    const end = parseTimestamp(fields[endIndex >= 0 ? endIndex : 2 + fallbackOffset]);
    const text = cleanSubtitleText(fields[textIndex >= 0 ? textIndex : fields.length - 1]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
      return null;
    }
    return { start, end, text };
  }

  function splitAssFields(text, fieldCount) {
    const fields = [];
    let rest = text;
    for (let index = 0; index < fieldCount - 1; index += 1) {
      const commaIndex = rest.indexOf(",");
      if (commaIndex < 0) {
        fields.push(rest);
        rest = "";
        break;
      }
      fields.push(rest.slice(0, commaIndex));
      rest = rest.slice(commaIndex + 1);
    }
    fields.push(rest);
    return fields.map(value => value.trim());
  }

  function stripWebVttHeader(text) {
    const normalized = normalizeNewlines(text).replace(/^\uFEFF?WEBVTT[^\n]*(?:\n|$)/i, "");
    return normalized.replace(/^(Kind|Language):[^\n]*\n/gi, "");
  }

  function parseTimestamp(value) {
    const parts = String(value || "").replace(",", ".").split(":");
    if (parts.length < 2 || parts.length > 3) {
      return Number.NaN;
    }
    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length ? Number(parts.pop()) : 0;
    if (![hours, minutes, seconds].every(Number.isFinite)) {
      return Number.NaN;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }

  function cleanSubtitleText(value) {
    return decodeEntities(String(value || "")
      .replace(/\\[Nn]/g, " ")
      .replace(/\{[^}]*\}/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim());
  }

  function decodeEntities(value) {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  }

  function looksLikeJson(value) {
    return /^\{/.test(value.trim());
  }

  function looksLikeSrt(value) {
    return /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/.test(value);
  }

  function looksLikeAss(value) {
    return /\[Events\]/i.test(value) && /^Dialogue\s*:/im.test(value);
  }

  function stripBom(value) {
    return value.replace(/^\uFEFF/, "");
  }

  function normalizeNewlines(value) {
    return stripBom(String(value || "")).replace(/\r\n?/g, "\n");
  }

  global.FuguangSubtitleFormat = {
    parseSubtitleImportText
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
