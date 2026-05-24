export const FuguangBrowserAsrPostprocess = (() => {
  const ASR_HALLUCINATION_COMPRESSION_RATIO = 8;
  const ASR_HALLUCINATION_NO_SPEECH_PROBABILITY = 0.75;
  const ASR_REPEATED_RUN_MIN_COUNT = 4;
  const ASR_REPEATED_RUN_MIN_TEXT_CHARS = 6;
  const ASR_REPEATED_RUN_MIN_DURATION_SECONDS = 6;
  const ASR_SUSPICIOUS_REPEAT_MIN_COUNT = 2;
  const ASR_SUSPICIOUS_REPEAT_MIN_DURATION_SECONDS = 2;
  const ASR_ADJACENT_DUPLICATE_MAX_GAP_SECONDS = 0.2;
  const ASR_VAD_SPLIT_MIN_SILENCE_SECONDS = 2;
  const ASR_WORD_LOW_PROBABILITY_THRESHOLD = 0.15;
  const ASR_WORD_SHORT_DURATION_SECONDS = 0.133;
  const ASR_WORD_LONG_DURATION_SECONDS = 2.0;
  const ASR_WORD_ANOMALY_SCORE_THRESHOLD = 3.0;
  const ASR_HALLUCINATION_SILENCE_THRESHOLD_SECONDS = 1.0;
  const ASR_STABLE_TS_NONSPEECH_ERROR_RATIO = 0.3;
  const ASR_STABLE_TS_MIN_WORD_DURATION_SECONDS = 0.1;
  const ASR_SUSPICIOUS_HALLUCINATION_PATTERNS = [
    /ご視聴.*ありがとう/,
    /ご覧.*ありがとう/,
    /チャンネル登録/,
    /おやすみなさい/,
    /thank(?:s|you).*watch/,
    /thanks.*watch/,
    /like.*subscribe/,
    /subscribe.*channel/,
    /see.*next.*(?:video|time)/,
    /goodnight/,
    /subtitles?by/,
    /captions?by/,
    /amaraorg/,
    /感谢.*观看/,
    /感謝.*觀看/,
    /谢谢.*观看/,
    /謝謝.*觀看/,
    /请.*订阅/,
    /請.*訂閱/,
    /下(?:期|次)再见/,
    /晚安/,
    /시청해주셔서감사/,
    /구독.*좋아요/,
    /안녕히주무세요/,
    /untertitel/,
    /gracias.*ver/,
    /suscr[ií]b/,
    /merci.*regard/
  ];
  
  function cleanVttText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
  
    function normalizeAsrProviderType(value) {
    return String(value || "").trim().toLowerCase();
  }
  
    function browserAudioChunkCoreStart(chunk) {
    return pickFinite(chunk?.coreStart, chunk?.start, 0);
  }
  
  function browserAudioChunkCoreEnd(chunk) {
    return pickFinite(chunk?.coreEnd, chunk?.end, chunk?.duration, browserAudioChunkCoreStart(chunk));
  }
  
  function pickFinite(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) {
        return number;
      }
    }
    return 0;
  }
  
    function filterAsrSegmentsByChunkOwnership(segments, chunk = {}) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    const hasCoreWindow = Number.isFinite(Number(chunk?.coreStart)) || Number.isFinite(Number(chunk?.coreEnd));
    if (!hasCoreWindow) {
      return segments;
    }
    const coreStart = browserAudioChunkCoreStart(chunk);
    const coreEnd = browserAudioChunkCoreEnd(chunk);
    return segments.map(segment => {
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }
      const ownerTime = start + ((end - start) / 2);
      if (ownerTime < coreStart) {
        return null;
      }
      if (ownerTime >= coreEnd) {
        return null;
      }
      const clippedStart = Math.max(start, coreStart);
      const clippedEnd = Math.min(end, coreEnd);
      if (clippedEnd <= clippedStart) {
        return null;
      }
      if (clippedStart === start && clippedEnd === end) {
        return segment;
      }
      return { ...segment, start: clippedStart, end: clippedEnd };
    }).filter(Boolean);
  }
  
  function shouldSkipBrowserAsrChunk(chunk = {}) {
    if (!Array.isArray(chunk?.speechIntervals)) {
      return false;
    }
    const speechIntervals = normalizeAsrSpeechIntervals(chunk.speechIntervals);
    return !speechIntervals || speechIntervals.length === 0;
  }
  
  function filterAsrSegmentsBySpeechActivity(segments, chunk = {}) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals);
    if (speechIntervals === null) {
      return segments;
    }
    if (!speechIntervals.length) {
      return [];
    }
    const ownerSlack = 0.45;
    return segments.map(segment => {
      const speechSuppressed = suppressAsrSegmentNonspeechWords(segment, speechIntervals);
      if (speechSuppressed) {
        return speechSuppressed;
      }
      if (normalizeAsrWordTimingItems(segment?.words || []).length) {
        return null;
      }
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
      }
      const duration = Math.max(0, end - start);
      const ownerTime = start + duration / 2;
      const minOverlap = Math.min(0.25, Math.max(0.05, duration * 0.15));
      const hasSpeechEvidence = speechIntervals.some(interval => {
        if (ownerTime >= interval.start - ownerSlack && ownerTime <= interval.end + ownerSlack) {
          return true;
        }
        const overlap = Math.min(end, interval.end + ownerSlack) - Math.max(start, interval.start - ownerSlack);
        return overlap >= minOverlap;
      });
      return hasSpeechEvidence ? segment : null;
    }).filter(Boolean);
  }
  
  function filterAsrSegmentsByHallucinationGuard(segments, chunk = {}) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals);
    const speechFiltered = segments.filter(segment => {
      const wordAnomaly = isAsrWordAnomalySegment(segment);
      const suspiciousText = isLikelyAsrHallucinationText(segment?.text);
      if (!wordAnomaly && !suspiciousText) {
        return true;
      }
      if (speechIntervals === null) {
        return true;
      }
      if (!speechIntervals.length) {
        return false;
      }
      if (hasStrongSpeechEvidence(segment, speechIntervals)) {
        return true;
      }
      if (wordAnomaly && isAsrSegmentSurroundedByNonspeech(segment, speechIntervals)) {
        return false;
      }
      return !suspiciousText;
    });
    return filterAsrSuspiciousRepeatedRuns(speechFiltered);
  }
  
  function suppressAsrSegmentNonspeechWords(segment, speechIntervals) {
    const words = normalizeAsrWordTimingItems(segment?.words || []);
    if (!words.length) {
      return null;
    }
    const keptWords = words.map(word => suppressAsrWordNonspeechTiming(word, speechIntervals)).filter(Boolean);
    if (!keptWords.length) {
      return null;
    }
    return {
      ...segment,
      start: Math.min(...keptWords.map(word => word.start)),
      end: Math.max(...keptWords.map(word => word.end)),
      text: joinAsrWords(keptWords.map(word => word.text)),
      words: keptWords
    };
  }
  
  function suppressAsrWordNonspeechTiming(word, speechIntervals) {
    const start = Number(word?.start);
    const end = Number(word?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }
    const overlaps = speechIntervals.map(interval => ({
      start: Math.max(start, interval.start),
      end: Math.min(end, interval.end)
    })).filter(interval => interval.end > interval.start);
    if (!overlaps.length) {
      return null;
    }
    const duration = end - start;
    const overlap = overlaps.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
    const overlapRatio = overlap / duration;
    const minOverlap = Math.min(0.2, Math.max(0.03, duration * (1 - ASR_STABLE_TS_NONSPEECH_ERROR_RATIO)));
    if (overlapRatio < (1 - ASR_STABLE_TS_NONSPEECH_ERROR_RATIO) && overlap < minOverlap) {
      return null;
    }
    const clampedStart = Math.min(...overlaps.map(interval => interval.start));
    const clampedEnd = Math.max(...overlaps.map(interval => interval.end));
    if (clampedEnd - clampedStart < ASR_STABLE_TS_MIN_WORD_DURATION_SECONDS) {
      return null;
    }
    return {
      ...word,
      start: clampedStart,
      end: clampedEnd
    };
  }
  
  function hasStrongSpeechEvidence(segment, speechIntervals) {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return false;
    }
    const duration = end - start;
    const overlap = asrSpeechOverlapSeconds(start, end, speechIntervals, 0.05);
    const required = Math.min(1, Math.max(0.35, duration * 0.45));
    return overlap >= required || overlap / duration >= 0.55;
  }
  
  function isAsrWordAnomalySegment(segment) {
    const words = normalizeAsrWordTimingItems(segment?.words || nestedAsrWordItemsFromSegment(segment?.rawSegment));
    const contentWords = words
      .filter(word => !isAsrPunctuationOnlyWord(word.text))
      .slice(0, 8);
    if (!contentWords.length) {
      return false;
    }
    const score = contentWords.reduce((sum, word) => sum + asrWordAnomalyScore(word), 0);
    return score >= ASR_WORD_ANOMALY_SCORE_THRESHOLD || score + 0.01 >= contentWords.length;
  }
  
  function asrWordAnomalyScore(word) {
    const duration = Number(word?.end) - Number(word?.start);
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    let score = 0;
    const probability = optionalAsrNumber(word, ["probability", "prob"]);
    if (probability !== null && probability < ASR_WORD_LOW_PROBABILITY_THRESHOLD) {
      score += 1;
    }
    if (duration < ASR_WORD_SHORT_DURATION_SECONDS) {
      score += (ASR_WORD_SHORT_DURATION_SECONDS - duration) * 15;
    }
    if (duration > ASR_WORD_LONG_DURATION_SECONDS) {
      score += duration - ASR_WORD_LONG_DURATION_SECONDS;
    }
    return score;
  }
  
  function isAsrPunctuationOnlyWord(text) {
    return /^[\s.,!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—-]+$/.test(String(text || ""));
  }
  
  function isAsrSegmentSurroundedByNonspeech(segment, speechIntervals) {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return false;
    }
    const duration = end - start;
    const overlap = asrSpeechOverlapSeconds(start, end, speechIntervals, 0.05);
    if (overlap >= Math.min(0.35, duration * 0.2)) {
      return false;
    }
    const previousSpeechEnd = speechIntervals
      .filter(interval => interval.end <= start)
      .reduce((max, interval) => Math.max(max, interval.end), -Infinity);
    const nextSpeechStart = speechIntervals
      .filter(interval => interval.start >= end)
      .reduce((min, interval) => Math.min(min, interval.start), Infinity);
    const silenceBefore = Number.isFinite(previousSpeechEnd)
      ? start - previousSpeechEnd
      : Infinity;
    const silenceAfter = Number.isFinite(nextSpeechStart)
      ? nextSpeechStart - end
      : Infinity;
    return silenceBefore > ASR_HALLUCINATION_SILENCE_THRESHOLD_SECONDS
      && silenceAfter > ASR_HALLUCINATION_SILENCE_THRESHOLD_SECONDS;
  }
  
  function asrSpeechOverlapSeconds(start, end, speechIntervals, slack = 0) {
    if (!Array.isArray(speechIntervals) || !speechIntervals.length) {
      return 0;
    }
    return speechIntervals.reduce((sum, interval) => {
      const intervalStart = Number(interval.start) - slack;
      const intervalEnd = Number(interval.end) + slack;
      if (!Number.isFinite(intervalStart) || !Number.isFinite(intervalEnd)) {
        return sum;
      }
      return sum + Math.max(0, Math.min(end, intervalEnd) - Math.max(start, intervalStart));
    }, 0);
  }
  
  function normalizeAsrSpeechIntervals(intervals) {
    if (!Array.isArray(intervals)) {
      return null;
    }
    return intervals
      .map(interval => ({
        start: Number(interval?.start),
        end: Number(interval?.end)
      }))
      .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
      .sort((left, right) => left.start - right.start || left.end - right.end);
  }
  
  function mergeAsrSpeechIntervals(intervals) {
    const normalized = normalizeAsrSpeechIntervals(intervals) || [];
    const merged = [];
    for (const interval of normalized) {
      const previous = merged.at(-1);
      if (previous && interval.start <= previous.end + 0.15) {
        previous.end = Math.max(previous.end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }
    return merged;
  }
  
    function normalizeAsrSegments(payload, offsetSeconds, chunkEndSeconds, options = {}) {
    const xaiWordTimestampsOnly = normalizeAsrProviderType(options.providerType) === "xai";
    const segments = xaiWordTimestampsOnly
      ? segmentsFromAsrWordItems(asrWordItemsFromPayload(payload))
      : asrTimedSegmentsFromPayload(payload);
    const chunkStart = Number(offsetSeconds || 0) || 0;
    const chunkEnd = Number(chunkEndSeconds || 0) || 0;
    const timeOffset = asrSegmentsUseAbsoluteTime(segments, chunkStart, chunkEnd) ? 0 : chunkStart;
    const timedSegments = segments
      .map(segment => {
        const words = normalizeAsrWordTimingItems(segment.words || nestedAsrWordItemsFromSegment(segment.rawSegment))
          .map(word => ({
            ...word,
            start: word.start + timeOffset,
            end: word.end + timeOffset
          }));
        return {
          start: segment.start + timeOffset,
          end: segment.end + timeOffset,
          text: cleanVttText(segment.text || ""),
          ...(words.length ? { words } : {}),
          rawSegment: segment.rawSegment || segment
        };
      })
      .filter(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start && segment.text)
      .sort((left, right) => left.start - right.start || left.end - right.end);
  
    const qualityFilteredSegments = timedSegments.filter(segment => !isAsrHallucinatedSegment(segment.rawSegment, segment.text));
    const output = filterAsrSuspiciousRepeatedRuns(filterAsrRepeatedRuns(qualityFilteredSegments))
      .map(({ rawSegment, ...segment }) => segment);
  
    if (output.length) {
      return output;
    }
    if (timedSegments.length && output.length !== timedSegments.length) {
      return [];
    }
    const text = cleanVttText(asrPayloadText(payload));
    if (!text) {
      return [];
    }
    if (xaiWordTimestampsOnly) {
      throw new Error("xAI ASR 结果缺少 word-level 时间戳，无法生成可用字幕。");
    }
    throw new Error("语音识别结果没有 segment 或 word 时间戳，无法生成可用字幕。");
  }
  
  function asrTimedSegmentsFromPayload(payload) {
    const segmentItems = asrSegmentItemsFromPayload(payload);
    if (segmentItems.length) {
      return refineAsrSegmentsWithTopLevelWords(segmentItems, asrWordItemsFromPayload(payload));
    }
    return segmentsFromAsrWordItems(asrWordItemsFromPayload(payload));
  }
  
  function refineAsrSegmentsWithTopLevelWords(segments, words) {
    const timedWords = normalizeAsrWordTimingItems(words);
    if (!timedWords.length) {
      return segments;
    }
    return segments.map(segment => {
      const matchedWords = asrWordsForWindow(timedWords, segment.start, segment.end);
      if (!matchedWords.length) {
        return segment;
      }
      return {
        ...segment,
        start: Math.min(...matchedWords.map(word => word.start)),
        end: Math.max(...matchedWords.map(word => word.end)),
        words: matchedWords
      };
    });
  }
  
  function asrSegmentItemsFromPayload(payload) {
    const segments = [];
    for (const item of asrArrayItemsFromPayload(payload, ["segments", "results", "chunks"])) {
      const text = cleanVttText(item?.text || item?.transcript || "");
      const start = firstAsrNumber(item, ["start", "start_time"]);
      const end = firstAsrNumber(item, ["end", "end_time"]);
      if (text && Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const words = normalizeAsrWordTimingItems(nestedAsrWordItemsFromSegment(item));
        const bounds = refinedAsrSegmentBoundsFromTimedWords(words, start, end);
        segments.push({ start: bounds.start, end: bounds.end, text, ...(words.length ? { words } : {}), rawSegment: item });
      }
    }
    return segments;
  }
  
  function refinedAsrSegmentBoundsFromTimedWords(words, fallbackStart, fallbackEnd) {
    const bounds = asrWordBounds(words);
    if (!bounds) {
      return { start: fallbackStart, end: fallbackEnd };
    }
    const margin = 0.5;
    if (bounds.start < fallbackStart - margin || bounds.start > fallbackEnd + margin) {
      return { start: fallbackStart, end: fallbackEnd };
    }
    if (bounds.end < fallbackStart - margin || bounds.end > fallbackEnd + margin || bounds.end <= bounds.start) {
      return { start: fallbackStart, end: fallbackEnd };
    }
    return { start: bounds.start, end: bounds.end };
  }
  
  function nestedAsrWordItemsFromSegment(segment) {
    for (const key of ["words", "word_timestamps", "tokens"]) {
      const value = segment?.[key];
      if (Array.isArray(value)) {
        return value.filter(item => item && typeof item === "object");
      }
    }
    return [];
  }
  
  function asrWordBounds(words) {
    const timedWords = normalizeAsrWordTimingItems(words);
    if (!timedWords.length) {
      return null;
    }
    return {
      start: Math.min(...timedWords.map(word => word.start)),
      end: Math.max(...timedWords.map(word => word.end))
    };
  }
  
  function asrWordsForWindow(words, fallbackStart, fallbackEnd) {
    const start = Number(fallbackStart);
    const end = Number(fallbackEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return [];
    }
    const margin = 0.05;
    return normalizeAsrWordTimingItems(words).filter(word => word.end > start + margin && word.start < end - margin);
  }
  
  function normalizeAsrWordTimingItems(words) {
    const output = [];
    let start = null;
    let end = null;
    for (const word of words) {
      const text = cleanVttText(word?.word || word?.text || word?.token || "");
      const wordStart = firstAsrNumber(word, ["start", "start_time"]);
      const wordEnd = firstAsrNumber(word, ["end", "end_time"]);
      if (!text || !Number.isFinite(wordStart) || !Number.isFinite(wordEnd) || wordEnd <= wordStart) {
        continue;
      }
      start = wordStart;
      end = wordEnd;
      const probability = optionalAsrNumber(word, ["probability", "prob"]);
      output.push({
        start,
        end,
        text,
        ...(probability === null ? {} : { probability })
      });
    }
    return output;
  }
  
  function asrWordItemsFromPayload(payload) {
    return asrArrayItemsFromPayload(payload, ["words", "word_timestamps"]);
  }
  
  function asrArrayItemsFromPayload(payload, keys) {
    const sources = [];
    if (payload && typeof payload === "object") {
      sources.push(payload);
      if (payload.result && typeof payload.result === "object") {
        sources.push(payload.result);
      }
    }
    for (const source of sources) {
      for (const key of keys) {
        const value = source[key];
        if (Array.isArray(value)) {
          return value.filter(item => item && typeof item === "object");
        }
      }
    }
    return [];
  }
  
  function segmentsFromAsrWordItems(words) {
    const timedWords = normalizeAsrWordTimingItems(words);
    const segments = [];
    let currentWords = [];
    let currentStart = null;
    let currentEnd = null;
    for (const word of timedWords) {
      const start = word.start;
      const end = word.end;
      if (currentStart === null) {
        currentStart = start;
      }
      const shouldFlush = currentWords.length > 0 && currentEnd !== null && (
        joinAsrWords(currentWords.map(item => item.text)).length >= 32
        || start - currentEnd >= 0.8
        || end - currentStart >= 7.0
      );
      if (shouldFlush && currentStart !== null && currentEnd !== null) {
        segments.push({
          start: currentStart,
          end: currentEnd,
          text: joinAsrWords(currentWords.map(item => item.text)),
          words: currentWords,
          rawSegment: { words: currentWords }
        });
        currentWords = [];
        currentStart = start;
      }
      currentWords.push(word);
      currentEnd = end;
    }
    if (currentWords.length && currentStart !== null && currentEnd !== null) {
      segments.push({
        start: currentStart,
        end: currentEnd,
        text: joinAsrWords(currentWords.map(item => item.text)),
        words: currentWords,
        rawSegment: { words: currentWords }
      });
    }
    return segments;
  }
  
  function firstAsrNumber(payload, keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(payload || {}, key)) {
        const value = Number(payload[key]);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }
    return NaN;
  }
  
  function optionalAsrNumber(payload, keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(payload || {}, key)) {
        const value = Number(payload[key]);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }
    return null;
  }
  
  function joinAsrWords(words) {
    return words.some(containsCjk) ? words.join("") : words.join(" ");
  }
  
  function containsCjk(value) {
    return /[\u3400-\u9fff]/.test(String(value || ""));
  }
  
  function asrPayloadText(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    const text = payload.text || payload.result?.text;
    if (text) {
      return text;
    }
    return asrArrayItemsFromPayload(payload, ["segments", "results", "chunks", "words", "word_timestamps"])
      .map(item => item?.text || item?.transcript || item?.word || item?.token || "")
      .join(" ");
  }
  
  function isAsrHallucinatedSegment(rawSegment, text) {
    const normalizedText = normalizeAsrHallucinationText(text);
    if (normalizedText.length < ASR_REPEATED_RUN_MIN_TEXT_CHARS) {
      return false;
    }
    const noSpeechProbability = Number(rawSegment?.no_speech_prob);
    if (Number.isFinite(noSpeechProbability) && noSpeechProbability >= ASR_HALLUCINATION_NO_SPEECH_PROBABILITY) {
      return true;
    }
    const compressionRatio = Number(rawSegment?.compression_ratio);
    return Number.isFinite(compressionRatio) && compressionRatio >= ASR_HALLUCINATION_COMPRESSION_RATIO;
  }
  
  function filterAsrRepeatedRuns(segments) {
    const output = [];
    for (let index = 0; index < segments.length;) {
      const key = normalizeAsrHallucinationText(segments[index]?.text);
      let nextIndex = index + 1;
      while (nextIndex < segments.length && key && normalizeAsrHallucinationText(segments[nextIndex]?.text) === key) {
        nextIndex += 1;
      }
      const run = segments.slice(index, nextIndex);
      if (!isAsrRepeatedRunHallucination(key, run)) {
        output.push(...run);
      }
      index = nextIndex;
    }
    return output;
  }
  
  function filterAsrSuspiciousRepeatedRuns(segments) {
    const output = [];
    for (let index = 0; index < segments.length;) {
      const key = normalizeAsrHallucinationText(segments[index]?.text);
      let nextIndex = index + 1;
      while (
        nextIndex < segments.length
        && key
        && normalizeAsrHallucinationText(segments[nextIndex]?.text) === key
      ) {
        nextIndex += 1;
      }
      const run = segments.slice(index, nextIndex);
      if (!isAsrSuspiciousRepeatedRunHallucination(key, run)) {
        output.push(...run);
      }
      index = nextIndex;
    }
    return output;
  }
  
  function isAsrRepeatedRunHallucination(key, run) {
    if (!key || key.length < ASR_REPEATED_RUN_MIN_TEXT_CHARS || run.length < ASR_REPEATED_RUN_MIN_COUNT) {
      return false;
    }
    const duration = run.reduce((sum, segment) => sum + Math.max(0, Number(segment.end) - Number(segment.start)), 0);
    return duration >= ASR_REPEATED_RUN_MIN_DURATION_SECONDS;
  }
  
  function isAsrSuspiciousRepeatedRunHallucination(key, run) {
    if (!key || run.length < ASR_SUSPICIOUS_REPEAT_MIN_COUNT || !isLikelyAsrHallucinationText(key)) {
      return false;
    }
    const duration = run.reduce((sum, segment) => sum + Math.max(0, Number(segment.end) - Number(segment.start)), 0);
    return duration >= ASR_SUSPICIOUS_REPEAT_MIN_DURATION_SECONDS;
  }
  
  function isLikelyAsrHallucinationText(text) {
    const normalizedText = normalizeAsrHallucinationText(text);
    if (normalizedText.length < ASR_REPEATED_RUN_MIN_TEXT_CHARS) {
      return false;
    }
    return ASR_SUSPICIOUS_HALLUCINATION_PATTERNS.some(pattern => pattern.test(normalizedText));
  }
  
  function normalizeAsrHallucinationText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\s,.!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—-]+/g, "");
  }
  
  function asrSegmentsUseAbsoluteTime(segments, chunkStart, chunkEnd) {
    if (!chunkStart || !Array.isArray(segments) || !segments.length) {
      return false;
    }
    const firstTimedSegment = segments.find(segment => Number.isFinite(Number(segment?.start)) && Number.isFinite(Number(segment?.end)));
    if (!firstTimedSegment) {
      return false;
    }
    const firstStart = Number(firstTimedSegment.start);
    const firstEnd = Number(firstTimedSegment.end);
    const tolerance = 1;
    if (firstStart < chunkStart - tolerance) {
      return false;
    }
    if (Number.isFinite(chunkEnd) && chunkEnd > chunkStart && firstStart > chunkEnd + tolerance) {
      return false;
    }
    return firstEnd > firstStart;
  }
  
    function mergeAdjacentDuplicateAsrSegments(segments) {
    const merged = [];
    for (const segment of segments || []) {
      const previous = merged[merged.length - 1];
      if (previous && canMergeAdjacentDuplicateAsrSegment(previous, segment)) {
        previous.end = Math.max(previous.end, segment.end);
        continue;
      }
      merged.push({ ...segment });
    }
    return merged;
  }
  
  function canMergeAdjacentDuplicateAsrSegment(previous, current) {
    const previousText = normalizedAsrDuplicateText(previous?.text);
    const currentText = normalizedAsrDuplicateText(current?.text);
    if (!previousText || previousText !== currentText) {
      return false;
    }
    const gap = Number(current?.start) - Number(previous?.end);
    return Number.isFinite(gap) && gap >= -0.05 && gap <= ASR_ADJACENT_DUPLICATE_MAX_GAP_SECONDS;
  }
  
  function normalizedAsrDuplicateText(text) {
    return cleanVttText(text || "").replace(/\s+/g, " ").trim();
  }
  
    return {
    ASR_VAD_SPLIT_MIN_SILENCE_SECONDS,
    filterAsrSegmentsByChunkOwnership,
    filterAsrSegmentsByHallucinationGuard,
    filterAsrSegmentsBySpeechActivity,
    filterAsrSuspiciousRepeatedRuns,
    mergeAdjacentDuplicateAsrSegments,
    mergeAsrSpeechIntervals,
    normalizeAsrSegments,
    normalizeAsrSpeechIntervals,
    shouldSkipBrowserAsrChunk
  };
})();
