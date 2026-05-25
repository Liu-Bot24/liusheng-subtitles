export const FuguangBrowserAsrPostprocess = (() => {
  const ASR_HALLUCINATION_COMPRESSION_RATIO = 8;
  const ASR_VAD_BACKED_HALLUCINATION_COMPRESSION_RATIO = 4;
  const ASR_VAD_BACKED_HALLUCINATION_NO_SPEECH_PROBABILITY = 0.35;
  const ASR_HALLUCINATION_NO_SPEECH_PROBABILITY = 0.6;
  const ASR_HALLUCINATION_LOG_PROBABILITY = -1.0;
  const ASR_REPEATED_RUN_MIN_COUNT = 4;
  const ASR_REPEATED_RUN_MIN_TEXT_CHARS = 6;
  const ASR_REPEATED_RUN_MIN_NON_LATIN_TEXT_CHARS = 3;
  const ASR_REPEATED_RUN_MIN_DURATION_SECONDS = 6;
  const ASR_LOW_INFORMATION_RUN_MIN_COUNT = 5;
  const ASR_LOW_INFORMATION_RUN_MIN_SPAN_SECONDS = 10;
  const ASR_LOW_INFORMATION_SINGLE_MIN_SPAN_SECONDS = 3;
  const ASR_REPEATED_PHRASE_SINGLE_MIN_COUNT = 4;
  const ASR_REPEATED_PHRASE_SINGLE_MIN_SPAN_SECONDS = 8;
  const ASR_PUNCTUATION_RUN_MIN_COUNT = 3;
  const ASR_PUNCTUATION_RUN_MIN_SPAN_SECONDS = 2;
  const ASR_ADJACENT_DUPLICATE_MAX_GAP_SECONDS = 0.2;
  const ASR_VAD_SPLIT_MIN_SILENCE_SECONDS = 2;
  const ASR_WORD_LOW_PROBABILITY_THRESHOLD = 0.15;
  const ASR_WORD_SHORT_DURATION_SECONDS = 0.133;
  const ASR_WORD_LONG_DURATION_SECONDS = 2.0;
  const ASR_WORD_ANOMALY_SCORE_THRESHOLD = 3.0;
  const ASR_SEGMENT_WORD_GAP_MIN_SEGMENT_SECONDS = 8.0;
  const ASR_SEGMENT_WORD_GAP_SPLIT_SECONDS = 10.0;
  const ASR_HALLUCINATION_SILENCE_THRESHOLD_SECONDS = 1.0;
  const ASR_SEVERE_WORD_TIMING_MIN_SEGMENT_SECONDS = 6.0;
  const ASR_SEVERE_WORD_TIMING_LONG_WORD_SECONDS = 6.0;
  const ASR_DISTRIBUTED_REPEAT_MIN_COUNT = 2;
  const ASR_DISTRIBUTED_REPEAT_MIN_SUSPICIOUS_COUNT = 2;
  const ASR_DISTRIBUTED_REPEAT_MIN_SPAN_SECONDS = 60;
  const ASR_DISTRIBUTED_REPEAT_MEDIUM_COUNT = 5;
  const ASR_DISTRIBUTED_REPEAT_MEDIUM_SPAN_SECONDS = 600;
  const ASR_DISTRIBUTED_REPEAT_MEDIUM_MIN_SUSPICIOUS_COUNT = 2;
  const ASR_DISTRIBUTED_REPEAT_MEDIUM_MIN_WEAK_RATIO = 0.25;
  const ASR_DISTRIBUTED_REPEAT_WEAK_MIN_TEXT_CHARS = 3;
  const ASR_DISTRIBUTED_REPEAT_WEAK_MAX_TEXT_CHARS = 24;
  const ASR_DISTRIBUTED_REPEAT_HIGH_COUNT = 8;
  const ASR_DISTRIBUTED_REPEAT_HIGH_SPAN_SECONDS = 300;
  const ASR_WORD_TEXT_COVERAGE_MIN_CHARS = 10;
  const ASR_WORD_TEXT_COVERAGE_MIN_RATIO = 0.35;
  const ASR_EMPTY_VAD_WEAK_TEXT_MIN_CHARS = 10;
  const ASR_WEAK_WORD_EVIDENCE_MIN_TEXT_CHARS = 6;
  const ASR_STABLE_TS_NONSPEECH_ERROR_RATIO = 0.3;
  const ASR_STABLE_TS_MIN_WORD_DURATION_SECONDS = 0.1;
  const ASR_CHUNK_OWNERSHIP_TOLERANCE_SECONDS = 1.5;
  const ASR_CHUNK_OWNERSHIP_MIN_DRIFT_OVERLAP_SECONDS = 0.08;
  const ASR_CHUNK_OWNERSHIP_MAX_DRIFT_ONLY_DURATION_SECONDS = 8;
  const ASR_STRICT_VAD_RECOVERY_HIGH_NO_SPEECH_PROBABILITY = 0.5;
  const ASR_STRICT_VAD_RECOVERY_MIN_SUBSTANTIVE_CHARS = 10;
  const ASR_STRICT_VAD_RECOVERY_MIN_COMPACT_CHARS = 5;
  const ASR_STRICT_VAD_RECOVERY_MIN_COMPACT_WORDS = 5;
  const ASR_STRICT_VAD_RECOVERY_MIN_COMPACT_AVG_LOG_PROBABILITY = -0.45;
  const ASR_STRICT_VAD_RECOVERY_MAX_COMPACT_NO_SPEECH_PROBABILITY = 0.8;
  const ASR_STRICT_VAD_RECOVERY_MAX_COMPACT_COMPRESSION_RATIO = 2.5;
  
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
      if (end <= start) {
        return null;
      }
      if (isClearlyAbnormalAsrOwnershipSegment(start, end, coreStart, coreEnd)) {
        return null;
      }
      if (!asrSegmentTouchesCoreOwnership(start, end, coreStart, coreEnd)) {
        return null;
      }
      return segment;
    }).filter(Boolean);
  }

  function asrSegmentTouchesCoreOwnership(start, end, coreStart, coreEnd) {
    const coreOverlap = intervalOverlapSeconds(start, end, coreStart, coreEnd);
    if (coreOverlap > 0) {
      return true;
    }
    const tolerance = ASR_CHUNK_OWNERSHIP_TOLERANCE_SECONDS;
    const paddedStart = coreStart - tolerance;
    const paddedEnd = coreEnd + tolerance;
    const paddedOverlap = intervalOverlapSeconds(start, end, paddedStart, paddedEnd);
    if (paddedOverlap <= 0) {
      return false;
    }
    const duration = Math.max(0, end - start);
    if (duration > ASR_CHUNK_OWNERSHIP_MAX_DRIFT_ONLY_DURATION_SECONDS) {
      return false;
    }
    const requiredOverlap = Math.min(0.35, Math.max(ASR_CHUNK_OWNERSHIP_MIN_DRIFT_OVERLAP_SECONDS, duration * 0.12));
    return paddedOverlap >= requiredOverlap;
  }

  function isClearlyAbnormalAsrOwnershipSegment(start, end, coreStart, coreEnd) {
    const duration = Math.max(0, end - start);
    const coreDuration = Math.max(0, coreEnd - coreStart);
    const abnormalDuration = Math.max(45, coreDuration * 1.5);
    if (duration <= abnormalDuration) {
      return false;
    }
    const coreOverlap = intervalOverlapSeconds(start, end, coreStart, coreEnd);
    return duration > 0 && coreOverlap / duration < 0.5;
  }

  function intervalOverlapSeconds(leftStart, leftEnd, rightStart, rightEnd) {
    return Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
  }
  
  function shouldSkipBrowserAsrChunk(chunk = {}) {
    if (!asrChunkSpeechIntervalsAreReliable(chunk)) {
      return false;
    }
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
    if (!asrChunkSpeechIntervalsAreReliable(chunk)) {
      return segments;
    }
    const speechIntervals = normalizeAsrSpeechIntervals(chunk?.speechIntervals);
    if (speechIntervals === null) {
      return segments;
    }
    if (!speechIntervals.length) {
      return [];
    }
    const ownerSlack = 0.45;
    return segments.flatMap(segment => {
      const speechSuppressedSegments = suppressAsrSegmentNonspeechWords(segment, speechIntervals);
      if (speechSuppressedSegments) {
        return speechSuppressedSegments;
      }
      if (normalizeAsrWordTimingItems(segment?.words || []).length) {
        return [];
      }
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return [];
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
      return hasSpeechEvidence ? [segment] : [];
    });
  }
  
  function filterAsrSegmentsByHallucinationGuard(segments, chunk = {}, options = {}) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    const speechIntervals = asrChunkSpeechIntervalsAreReliable(chunk)
      ? normalizeAsrSpeechIntervals(chunk?.speechIntervals)
      : null;
    const speechFiltered = segments.filter(segment => {
      if (isAsrSevereWordTimingHallucination(segment)) {
        return false;
      }
      if (isAsrWordTextCoverageSuspicious(segment)) {
        return false;
      }
      const words = normalizeAsrWordTimingItems(segment?.words || []);
      if (speechIntervals && !hasStrongSpeechEvidence(segment, speechIntervals)) {
        if (isAsrLikelyNonspeechHallucination(segment, speechIntervals)) {
          return false;
        }
      }
      if (speechIntervals && speechIntervals.length && !words.length && !hasStrongSpeechEvidence(segment, speechIntervals)) {
        return false;
      }
      const wordAnomaly = isAsrWordAnomalySegment(segment);
      if (!wordAnomaly) {
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
      return true;
    });
    if (options.disableCustomRunFilters) {
      return speechFiltered;
    }
    return filterAsrLowInformationRuns(filterAsrSuspiciousRepeatedRuns(speechFiltered));
  }

  function filterAsrStrictVadRecoverySegments(segments) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    return segments.filter(segment => isAsrStrictVadRecoverySegment(segment));
  }

  function isAsrStrictVadRecoverySegment(segment) {
    const text = cleanVttText(segment?.text || "");
    if (!text) {
      return false;
    }
    const duration = asrSegmentDuration(segment);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 8) {
      return false;
    }
    if (asrLowInformationTextKind(text)) {
      return false;
    }
    if (isAsrStrictVadRecoveryWeakFragment(segment, text)) {
      return false;
    }
    if (isAsrSingleLowInformationHallucination(segment) || isAsrSingleRepeatedPhraseHallucination(segment, duration)) {
      return false;
    }
    const hasStrongEvidence = hasStrongStrictVadRecoveryEvidence(segment, text);
    if (isAsrWordAnomalySegment(segment) && !hasStrongEvidence) {
      return false;
    }
    if (isAsrSuspiciousWordTimingSegment(segment) && !hasStrongEvidence) {
      return false;
    }
    return true;
  }

  function isAsrStrictVadRecoveryWeakFragment(segment, text) {
    const textLength = asrSegmentTextContentLength(text);
    const noSpeechProbability = asrSegmentQualityNumber(segment, ["noSpeechProbability", "no_speech_prob"]);
    if (noSpeechProbability === null) {
      return false;
    }
    if (textLength <= 2 && noSpeechProbability >= 0.35) {
      return true;
    }
    if (noSpeechProbability < ASR_STRICT_VAD_RECOVERY_HIGH_NO_SPEECH_PROBABILITY) {
      return false;
    }
    if (isFragmentedCjkAsrText(text)) {
      return true;
    }
    if (textLength < ASR_STRICT_VAD_RECOVERY_MIN_SUBSTANTIVE_CHARS) {
      return !hasCompactStrictVadRecoveryEvidence(segment, text);
    }
    const avgLogProbability = asrSegmentQualityNumber(segment, ["avgLogProbability", "avg_logprob", "avg_log_probability"]);
    const stats = asrWordEvidenceStats(segment);
    if (hasCompactStrictVadRecoveryEvidence(segment, text)) {
      return false;
    }
    return textLength < ASR_STRICT_VAD_RECOVERY_MIN_SUBSTANTIVE_CHARS + 4
      && ((avgLogProbability !== null && avgLogProbability <= -0.5)
        || (stats.lowProbabilityCount > 0 && stats.maxWordDuration >= 1));
  }

  function hasStrongStrictVadRecoveryEvidence(segment, text) {
    return hasSubstantiveStrictVadRecoveryEvidence(segment, text)
      || hasCompactStrictVadRecoveryEvidence(segment, text);
  }

  function hasSubstantiveStrictVadRecoveryEvidence(segment, text) {
    const stats = asrWordEvidenceStats(segment);
    const avgLogProbability = asrSegmentQualityNumber(segment, ["avgLogProbability", "avg_logprob", "avg_log_probability"]);
    const noSpeechProbability = asrSegmentQualityNumber(segment, ["noSpeechProbability", "no_speech_prob"]);
    return asrSegmentTextContentLength(text) >= ASR_STRICT_VAD_RECOVERY_MIN_SUBSTANTIVE_CHARS
      && stats.words.length >= 6
      && stats.lowProbabilityCount === 0
      && stats.maxWordDuration <= 1
      && (avgLogProbability === null || avgLogProbability >= -0.75)
      && (noSpeechProbability === null || noSpeechProbability <= 0.58);
  }

  function hasCompactStrictVadRecoveryEvidence(segment, text) {
    if (isFragmentedCjkAsrText(text)) {
      return false;
    }
    const stats = asrWordEvidenceStats(segment);
    const avgLogProbability = asrSegmentQualityNumber(segment, ["avgLogProbability", "avg_logprob", "avg_log_probability"]);
    const noSpeechProbability = asrSegmentQualityNumber(segment, ["noSpeechProbability", "no_speech_prob"]);
    const compressionRatio = asrSegmentQualityNumber(segment, ["compressionRatio", "compression_ratio"]);
    return asrSegmentTextContentLength(text) >= ASR_STRICT_VAD_RECOVERY_MIN_COMPACT_CHARS
      && stats.words.length >= ASR_STRICT_VAD_RECOVERY_MIN_COMPACT_WORDS
      && stats.coverageRatio >= 0.8
      && stats.lowProbabilityCount <= 1
      && stats.maxWordDuration <= 0.75
      && (avgLogProbability !== null && avgLogProbability >= ASR_STRICT_VAD_RECOVERY_MIN_COMPACT_AVG_LOG_PROBABILITY)
      && (noSpeechProbability === null || noSpeechProbability <= ASR_STRICT_VAD_RECOVERY_MAX_COMPACT_NO_SPEECH_PROBABILITY)
      && (compressionRatio === null || compressionRatio <= ASR_STRICT_VAD_RECOVERY_MAX_COMPACT_COMPRESSION_RATIO);
  }

  function isFragmentedCjkAsrText(text) {
    const raw = cleanVttText(text || "");
    if (!/\s/u.test(raw)) {
      return false;
    }
    const parts = raw
      .split(/\s+/u)
      .map(part => part.replace(/[\s.,!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—\-~〜ー]+/gu, ""))
      .filter(Boolean);
    if (parts.length < 2) {
      return false;
    }
    const compactLength = asrSegmentTextContentLength(raw);
    if (compactLength < 3) {
      return false;
    }
    const cjkParts = parts.filter(part => /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(part));
    const shortCjkParts = cjkParts.filter(part => Array.from(part).length <= 2);
    return cjkParts.length >= 2 && shortCjkParts.length / parts.length >= 0.6;
  }
  
  function suppressAsrSegmentNonspeechWords(segment, speechIntervals) {
    const words = normalizeAsrWordTimingItems(segment?.words || []);
    if (!words.length) {
      return null;
    }
    const keptWords = words.map(word => {
      const kept = suppressAsrWordNonspeechTiming(word, speechIntervals);
      if (!kept) {
        return null;
      }
      return {
        ...kept,
        speechIntervalIndex: asrWordSpeechIntervalIndex(kept, speechIntervals)
      };
    }).filter(Boolean);
    if (!keptWords.length) {
      return null;
    }
    return splitAsrWordsBySpeechIntervals(keptWords)
      .map(group => asrSegmentFromWordGroup(segment, group.map(cleanAsrSpeechWordGroupItem)))
      .filter(item => item.text);
  }

  function splitAsrWordsBySpeechIntervals(words) {
    const groups = [];
    let current = [];
    for (const word of words) {
      const previous = current.at(-1);
      if (previous && shouldSplitAsrSpeechWordGroup(previous, word)) {
        groups.push(current);
        current = [word];
      } else {
        current.push(word);
      }
    }
    if (current.length) {
      groups.push(current);
    }
    return groups;
  }

  function shouldSplitAsrSpeechWordGroup(previous, word) {
    const gap = Number(word?.start) - Number(previous?.end);
    if (!Number.isFinite(gap) || gap <= 0) {
      return false;
    }
    if (gap > ASR_SEGMENT_WORD_GAP_SPLIT_SECONDS) {
      return true;
    }
    const previousIndex = Number(previous?.speechIntervalIndex);
    const currentIndex = Number(word?.speechIntervalIndex);
    return Number.isInteger(previousIndex)
      && Number.isInteger(currentIndex)
      && previousIndex !== currentIndex
      && gap > ASR_VAD_SPLIT_MIN_SILENCE_SECONDS;
  }

  function cleanAsrSpeechWordGroupItem(word) {
    const { speechIntervalIndex: _speechIntervalIndex, ...cleanWord } = word || {};
    return cleanWord;
  }

  function asrWordSpeechIntervalIndex(word, speechIntervals) {
    let bestIndex = -1;
    let bestOverlap = 0;
    for (let index = 0; index < speechIntervals.length; index += 1) {
      const interval = speechIntervals[index];
      const overlap = Math.max(0, Math.min(Number(word?.end), interval.end) - Math.max(Number(word?.start), interval.start));
      if (overlap > bestOverlap) {
        bestIndex = index;
        bestOverlap = overlap;
      }
    }
    return bestIndex;
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
    if (clampedEnd - clampedStart < ASR_STABLE_TS_MIN_WORD_DURATION_SECONDS && overlapRatio < 0.8) {
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

  function isAsrLikelyNonspeechHallucination(segment, speechIntervals) {
    if (!Array.isArray(speechIntervals)) {
      return false;
    }
    if (isAsrWordTextCoverageSuspicious(segment)) {
      return true;
    }
    const duration = asrSegmentDuration(segment);
    if (isAsrSingleLowInformationHallucination(segment) || isAsrSingleRepeatedPhraseHallucination(segment, duration)) {
      return true;
    }
    if (!speechIntervals.length) {
      return isAsrWeakEmptyVadTextSegment(segment) || isAsrVadBackedQualityHallucination(segment);
    }
    return (isAsrWeakWordEvidenceSegment(segment) || isAsrVadBackedQualityHallucination(segment))
      && isAsrSegmentSurroundedByNonspeech(segment, speechIntervals);
  }

  function isAsrVadBackedQualityHallucination(segment) {
    const compressionRatio = asrSegmentQualityNumber(segment, ["compressionRatio", "compression_ratio"]);
    const noSpeechProbability = asrSegmentQualityNumber(segment, ["noSpeechProbability", "no_speech_prob"]);
    return compressionRatio !== null
      && compressionRatio >= ASR_VAD_BACKED_HALLUCINATION_COMPRESSION_RATIO
      && noSpeechProbability !== null
      && noSpeechProbability >= ASR_VAD_BACKED_HALLUCINATION_NO_SPEECH_PROBABILITY;
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

  function isAsrWeakWordEvidenceSegment(segment) {
    const stats = asrWordEvidenceStats(segment);
    if (!stats.words.length || stats.textLength < ASR_WEAK_WORD_EVIDENCE_MIN_TEXT_CHARS) {
      return false;
    }
    if (stats.coverageSuspicious) {
      return true;
    }
    if (stats.lowProbabilityCount >= 1
      && stats.textLength >= ASR_EMPTY_VAD_WEAK_TEXT_MIN_CHARS
      && stats.coverageRatio < 0.7) {
      return true;
    }
    if (stats.lowProbabilityCount >= 2) {
      return true;
    }
    return stats.lowProbabilityCount >= 1
      && (stats.duration >= 3 || stats.maxWordDuration >= 2.5 || stats.words.length <= 2);
  }

  function isAsrWordTextCoverageSuspicious(segment) {
    const stats = asrWordEvidenceStats(segment);
    return stats.coverageSuspicious;
  }

  function isAsrWeakEmptyVadTextSegment(segment) {
    const stats = asrWordEvidenceStats(segment);
    return stats.textLength >= ASR_EMPTY_VAD_WEAK_TEXT_MIN_CHARS
      && stats.lowProbabilityCount > 0
      && stats.coverageRatio < 0.7;
  }

  function asrWordEvidenceStats(segment) {
    const words = normalizeAsrWordTimingItems(segment?.words || nestedAsrWordItemsFromSegment(segment?.rawSegment))
      .filter(word => !isAsrPunctuationOnlyWord(word.text));
    const textLength = asrSegmentTextContentLength(segment?.text);
    const wordTextLength = asrSegmentTextContentLength(words.map(word => word.text).join(""));
    const coverageRatio = textLength > 0 ? wordTextLength / textLength : 1;
    const lowProbabilityCount = words.filter(word => {
      const probability = optionalAsrNumber(word, ["probability", "prob"]);
      return probability !== null && probability < ASR_WORD_LOW_PROBABILITY_THRESHOLD;
    }).length;
    const maxWordDuration = words.reduce((max, word) => {
      const duration = Number(word?.end) - Number(word?.start);
      return Number.isFinite(duration) ? Math.max(max, duration) : max;
    }, 0);
    return {
      words,
      textLength,
      wordTextLength,
      coverageRatio,
      lowProbabilityCount,
      maxWordDuration,
      duration: asrSegmentDuration(segment),
      coverageSuspicious: textLength >= ASR_WORD_TEXT_COVERAGE_MIN_CHARS
        && wordTextLength > 0
        && coverageRatio < ASR_WORD_TEXT_COVERAGE_MIN_RATIO
    };
  }

  function asrSegmentTextContentLength(text) {
    return cleanVttText(text)
      .replace(/[\s.,!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—-]+/gu, "")
      .length;
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

  function asrChunkSpeechIntervalsAreReliable(chunk = {}) {
    return chunk?.speechIntervalsReliable !== false;
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
    const chunkDuration = Math.max(0, chunkEnd - chunkStart);
    const timeOffset = asrSegmentsUseAbsoluteTime(segments, chunkStart, chunkEnd, chunkDuration) ? 0 : chunkStart;
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
  
    const wordGapSplitSegments = splitAsrSegmentsByWordGaps(timedSegments, {
      preserveTinyFragments: options.disableCustomRunFilters || options.disableCustomQualityFilters
    });
    const qualityFilteredSegments = wordGapSplitSegments.filter(segment => {
      if (options.disableCustomQualityFilters) {
        return true;
      }
      return !isAsrHallucinatedSegment(segment.rawSegment, segment.text);
    });
    const runFilteredSegments = options.disableCustomRunFilters
      ? qualityFilteredSegments
      : filterAsrLowInformationRuns(filterAsrSuspiciousRepeatedRuns(filterAsrRepeatedRuns(qualityFilteredSegments)));
    const output = runFilteredSegments
      .map(({ rawSegment, ...segment }) => {
        const asrQuality = asrSegmentQualityFromRawSegment(rawSegment);
        return asrQuality ? { ...segment, asrQuality } : segment;
      });
  
    if (output.length) {
      return output;
    }
    if (wordGapSplitSegments.length && output.length !== wordGapSplitSegments.length) {
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

  function splitAsrSegmentsByWordGaps(segments, options = {}) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    return segments.flatMap(segment => splitAsrSegmentByWordGaps(segment, options));
  }

  function splitAsrSegmentByWordGaps(segment, options = {}) {
    const segmentDuration = Number(segment?.end) - Number(segment?.start);
    if (!Number.isFinite(segmentDuration) || segmentDuration < ASR_SEGMENT_WORD_GAP_MIN_SEGMENT_SECONDS) {
      return [segment];
    }
    const words = normalizeAsrWordTimingItems(segment?.words || nestedAsrWordItemsFromSegment(segment?.rawSegment));
    if (words.length < 2) {
      return [segment];
    }
    const groups = [];
    let current = [words[0]];
    for (let index = 1; index < words.length; index += 1) {
      const previous = current.at(-1);
      const word = words[index];
      const gap = word.start - previous.end;
      if (Number.isFinite(gap) && gap > ASR_SEGMENT_WORD_GAP_SPLIT_SECONDS) {
        groups.push(current);
        current = [word];
      } else {
        current.push(word);
      }
    }
    groups.push(current);
    if (groups.length <= 1) {
      return [segment];
    }
    return compactAsrWordGapGroups(segment, groups, options)
      .map(group => asrSegmentFromWordGroup(segment, group.words, group.text));
  }

  function compactAsrWordGapGroups(segment, groups, options = {}) {
    const originalText = cleanVttText(segment?.text || "");
    const allWordsText = joinAsrWords(groups.flat().map(word => word.text));
    const canRestoreOriginalText = asrCompactFragmentKey(originalText)
      && asrCompactFragmentKey(originalText) === asrCompactFragmentKey(allWordsText);
    const output = groups.map(words => ({
      words,
      text: joinAsrWords(words.map(word => word.text))
    }));
    if (options.preserveTinyFragments) {
      return output;
    }
    let droppedTinyFragment = false;
    while (output.length > 1 && isTinyAsrWordGapFragment(output[0]?.text)) {
      output.shift();
      droppedTinyFragment = true;
    }
    while (output.length > 1 && isTinyAsrWordGapFragment(output.at(-1)?.text)) {
      output.pop();
      droppedTinyFragment = true;
    }
    if (droppedTinyFragment && output.length === 1 && canRestoreOriginalText) {
      output[0].text = originalText;
    }
    return output;
  }

  function isTinyAsrWordGapFragment(text) {
    const key = asrCompactFragmentKey(text);
    return (key.length === 1 && /^[\u3040-\u30ff\u3400-\u9fff]$/u.test(key))
      || (key.length <= 2 && /[\u3400-\u9fff]/u.test(key));
  }

  function asrCompactFragmentKey(text) {
    return cleanVttText(text || "")
      .replace(/[\s,.!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—\-~〜ー]+/g, "")
      .trim();
  }

  function asrSegmentFromWordGroup(segment, words, textOverride = "") {
    const start = Math.min(...words.map(word => word.start));
    const end = Math.max(...words.map(word => word.end));
    const text = cleanVttText(textOverride || joinAsrWords(words.map(word => word.text)));
    const rawSegment = segment?.rawSegment && typeof segment.rawSegment === "object"
      ? { ...segment.rawSegment, start, end, text, words }
      : { start, end, text, words };
    return {
      ...segment,
      start,
      end,
      text,
      words,
      rawSegment
    };
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

  function asrSegmentQualityFromRawSegment(rawSegment) {
    if (!rawSegment || typeof rawSegment !== "object") {
      return null;
    }
    const quality = {};
    const compressionRatio = optionalAsrNumber(rawSegment, ["compression_ratio", "compressionRatio"]);
    if (compressionRatio !== null) {
      quality.compressionRatio = compressionRatio;
    }
    const noSpeechProbability = optionalAsrNumber(rawSegment, ["no_speech_prob", "noSpeechProbability"]);
    if (noSpeechProbability !== null) {
      quality.noSpeechProbability = noSpeechProbability;
    }
    const avgLogProbability = optionalAsrNumber(rawSegment, [
      "avg_logprob",
      "avg_log_probability",
      "avg_log_prob",
      "average_logprob",
      "average_log_probability",
      "logprob",
      "log_prob"
    ]);
    if (avgLogProbability !== null) {
      quality.avgLogProbability = avgLogProbability;
    }
    return Object.keys(quality).length ? quality : null;
  }

  function asrSegmentQualityNumber(segment, keys) {
    const fromQuality = optionalAsrNumber(segment?.asrQuality, keys);
    if (fromQuality !== null) {
      return fromQuality;
    }
    return optionalAsrNumber(segment?.rawSegment || segment, keys);
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
    if (Number.isFinite(noSpeechProbability) && noSpeechProbability > ASR_HALLUCINATION_NO_SPEECH_PROBABILITY) {
      const avgLogProbability = optionalAsrNumber(rawSegment, [
        "avg_logprob",
        "avg_log_probability",
        "avg_log_prob",
        "average_logprob",
        "average_log_probability",
        "logprob",
        "log_prob"
      ]);
      if (avgLogProbability !== null) {
        return avgLogProbability <= ASR_HALLUCINATION_LOG_PROBABILITY;
      }
    }
    const compressionRatio = Number(rawSegment?.compression_ratio);
    return Number.isFinite(compressionRatio) && compressionRatio >= ASR_HALLUCINATION_COMPRESSION_RATIO;
  }

  function isAsrSuspiciousWordTimingSegment(segment) {
    const words = normalizeAsrWordTimingItems(segment?.words || nestedAsrWordItemsFromSegment(segment?.rawSegment));
    const contentWords = words
      .filter(word => !isAsrPunctuationOnlyWord(word.text))
      .slice(0, 8);
    if (contentWords.length < 2) {
      return false;
    }
    const weakWords = contentWords.filter(word => {
      const duration = Number(word?.end) - Number(word?.start);
      const probability = optionalAsrNumber(word, ["probability", "prob"]);
      return (probability !== null && probability < 0.2)
        || (Number.isFinite(duration) && (duration < ASR_WORD_SHORT_DURATION_SECONDS || duration > ASR_WORD_LONG_DURATION_SECONDS));
    });
    return weakWords.length >= 2;
  }

  function isAsrSevereWordTimingHallucination(segment) {
    const duration = asrSegmentDuration(segment);
    if (!Number.isFinite(duration) || duration < ASR_SEVERE_WORD_TIMING_MIN_SEGMENT_SECONDS) {
      return false;
    }
    const words = normalizeAsrWordTimingItems(segment?.words || nestedAsrWordItemsFromSegment(segment?.rawSegment))
      .filter(word => !isAsrPunctuationOnlyWord(word.text));
    if (!words.length || words.length > 12) {
      return false;
    }
    const durations = words
      .map(word => Number(word.end) - Number(word.start))
      .filter(value => Number.isFinite(value) && value > 0);
    if (!durations.length) {
      return false;
    }
    const maxWordDuration = Math.max(...durations);
    const lowProbabilityCount = words.filter(word => {
      const probability = optionalAsrNumber(word, ["probability", "prob"]);
      return probability !== null && probability < 0.2;
    }).length;
    const veryLongWord = maxWordDuration >= Math.min(
      ASR_SEVERE_WORD_TIMING_LONG_WORD_SECONDS,
      Math.max(3.5, duration * 0.45)
    );
    if (veryLongWord && (duration >= 10 || lowProbabilityCount > 0)) {
      return true;
    }
    const noSpeechProbability = optionalAsrNumber(segment?.rawSegment || segment, ["no_speech_prob", "noSpeechProbability"]);
    if (noSpeechProbability !== null && noSpeechProbability >= ASR_HALLUCINATION_NO_SPEECH_PROBABILITY) {
      if (isAsrSuspiciousWordTimingSegment(segment)) {
        return true;
      }
      return duration >= 8 && words.length <= 8 && maxWordDuration >= 3;
    }
    return false;
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

  function filterAsrDistributedRepeatedRuns(segments) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    const runs = new Map();
    for (const segment of segments) {
      const key = normalizeAsrHallucinationText(segment?.text);
      if (!isAsrRepeatedRunKeyEligible(key)) {
        continue;
      }
      if (!runs.has(key)) {
        runs.set(key, []);
      }
      runs.get(key).push(segment);
    }
    const droppedKeys = new Set();
    for (const [key, run] of runs.entries()) {
      if (isAsrDistributedRepeatedRunHallucination(key, run)) {
        droppedKeys.add(key);
      }
    }
    if (!droppedKeys.size) {
      return segments;
    }
    return segments.filter(segment => !droppedKeys.has(normalizeAsrHallucinationText(segment?.text)));
  }

  function isAsrDistributedRepeatedRunHallucination(key, run) {
    if (!isAsrRepeatedRunKeyEligible(key) || !Array.isArray(run) || run.length < ASR_DISTRIBUTED_REPEAT_MIN_COUNT) {
      return false;
    }
    const sorted = [...run].sort((left, right) => Number(left?.start) - Number(right?.start));
    const firstStart = Number(sorted[0]?.start);
    const lastEnd = Number(sorted.at(-1)?.end);
    const span = Number.isFinite(firstStart) && Number.isFinite(lastEnd) ? Math.max(0, lastEnd - firstStart) : 0;
    if (span < ASR_DISTRIBUTED_REPEAT_MIN_SPAN_SECONDS) {
      return false;
    }
    const suspicious = sorted.filter(segment => isAsrSuspiciousDistributedRepeatOccurrence(segment));
    if (sorted.length >= ASR_DISTRIBUTED_REPEAT_HIGH_COUNT && span >= ASR_DISTRIBUTED_REPEAT_HIGH_SPAN_SECONDS) {
      return true;
    }
    if (sorted.length >= ASR_DISTRIBUTED_REPEAT_MEDIUM_COUNT && span >= ASR_DISTRIBUTED_REPEAT_MEDIUM_SPAN_SECONDS) {
      const weak = sorted.filter(segment => isAsrWeakDistributedRepeatOccurrence(segment));
      if (weak.length >= ASR_DISTRIBUTED_REPEAT_MEDIUM_MIN_SUSPICIOUS_COUNT
        && weak.length / sorted.length >= ASR_DISTRIBUTED_REPEAT_MEDIUM_MIN_WEAK_RATIO) {
        return true;
      }
    }
    return suspicious.length >= ASR_DISTRIBUTED_REPEAT_MIN_SUSPICIOUS_COUNT
      && suspicious.length / sorted.length >= 0.5;
  }

  function isAsrSuspiciousDistributedRepeatOccurrence(segment) {
    const duration = asrSegmentDuration(segment);
    if (!Number.isFinite(duration) || duration <= 0) {
      return false;
    }
    if (isAsrSevereWordTimingHallucination(segment) || isAsrSingleLowInformationHallucination(segment)) {
      return true;
    }
    if (isAsrWeakWordEvidenceSegment(segment)) {
      return true;
    }
    const noSpeechProbability = optionalAsrNumber(segment?.rawSegment || segment, ["no_speech_prob", "noSpeechProbability"]);
    return duration >= 3
      && noSpeechProbability !== null
      && noSpeechProbability >= ASR_HALLUCINATION_NO_SPEECH_PROBABILITY;
  }

  function isAsrWeakDistributedRepeatOccurrence(segment) {
    if (isAsrSuspiciousDistributedRepeatOccurrence(segment)) {
      return true;
    }
    const stats = asrWordEvidenceStats(segment);
    return stats.textLength >= ASR_DISTRIBUTED_REPEAT_WEAK_MIN_TEXT_CHARS
      && stats.textLength <= ASR_DISTRIBUTED_REPEAT_WEAK_MAX_TEXT_CHARS
      && stats.lowProbabilityCount >= 1;
  }
  
  function filterAsrSuspiciousRepeatedRuns(segments) {
    return filterAsrRepeatedRuns(Array.isArray(segments) ? segments : []);
  }

  function filterAsrLowInformationRuns(segments) {
    if (!Array.isArray(segments) || !segments.length) {
      return [];
    }
    const output = [];
    for (let index = 0; index < segments.length;) {
      if (isAsrSingleLowInformationHallucination(segments[index])) {
        index += 1;
        continue;
      }
      const runKind = asrLowInformationTextKind(segments[index]?.text);
      if (!runKind) {
        output.push(segments[index]);
        index += 1;
        continue;
      }
      let nextIndex = index + 1;
      while (nextIndex < segments.length && asrLowInformationTextKind(segments[nextIndex]?.text)) {
        nextIndex += 1;
      }
      const run = segments.slice(index, nextIndex);
      if (!isAsrLowInformationRunHallucination(run)) {
        output.push(...run);
      }
      index = nextIndex;
    }
    return output;
  }

  function isAsrSingleLowInformationHallucination(segment) {
    const duration = asrSegmentDuration(segment);
    if (!Number.isFinite(duration) || duration <= 0) {
      return false;
    }
    const kind = asrLowInformationTextKind(segment?.text);
    if (kind === "low_information" && duration >= ASR_LOW_INFORMATION_SINGLE_MIN_SPAN_SECONDS) {
      return true;
    }
    return isAsrSingleRepeatedPhraseHallucination(segment, duration);
  }

  function isAsrSingleRepeatedPhraseHallucination(segment, duration = asrSegmentDuration(segment)) {
    if (!Number.isFinite(duration) || duration < ASR_REPEATED_PHRASE_SINGLE_MIN_SPAN_SECONDS) {
      return false;
    }
    const parts = splitAsrRepeatedPhraseParts(segment?.text);
    if (parts.length < ASR_REPEATED_PHRASE_SINGLE_MIN_COUNT) {
      return false;
    }
    const counts = new Map();
    for (const part of parts) {
      counts.set(part, (counts.get(part) || 0) + 1);
    }
    const dominant = Math.max(...counts.values());
    return dominant >= ASR_REPEATED_PHRASE_SINGLE_MIN_COUNT
      && dominant / parts.length >= 0.75;
  }

  function splitAsrRepeatedPhraseParts(text) {
    return cleanVttText(text || "")
      .split(/[、,，。.!?！？;；\n]+/u)
      .map(part => normalizeAsrHallucinationText(part))
      .filter(part => part.length >= 3);
  }

  function asrSegmentDuration(segment) {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : NaN;
  }

  function isAsrLowInformationRunHallucination(run) {
    if (!Array.isArray(run) || !run.length) {
      return false;
    }
    const firstStart = Number(run[0]?.start);
    const lastEnd = Number(run.at(-1)?.end);
    const span = Number.isFinite(firstStart) && Number.isFinite(lastEnd)
      ? Math.max(0, lastEnd - firstStart)
      : 0;
    if (run.every(segment => asrLowInformationTextKind(segment?.text) === "punctuation")) {
      return run.length >= ASR_PUNCTUATION_RUN_MIN_COUNT && span >= ASR_PUNCTUATION_RUN_MIN_SPAN_SECONDS;
    }
    return run.length >= ASR_LOW_INFORMATION_RUN_MIN_COUNT && span >= ASR_LOW_INFORMATION_RUN_MIN_SPAN_SECONDS;
  }

  function asrLowInformationTextKind(text) {
    const raw = cleanVttText(text || "");
    if (!raw) {
      return null;
    }
    const key = normalizeAsrHallucinationText(raw);
    if (!key && raw.replace(/\s+/g, "")) {
      return "punctuation";
    }
    const compact = raw
      .toLowerCase()
      .replace(/[\s,.!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—\-~〜ー]+/g, "");
    if (!compact) {
      return null;
    }
    if (isStructurallyLowInformationAsrText(compact)) {
      return "low_information";
    }
    return null;
  }

  function isStructurallyLowInformationAsrText(compact) {
    const chars = Array.from(String(compact || ""));
    if (!chars.length || /\p{Number}/u.test(compact)) {
      return false;
    }
    if (/^[a-z]+$/i.test(compact)) {
      if (chars.length <= 4 && !/[aeiouy]/i.test(compact)) {
        return true;
      }
      if (isRepeatedAsrUnit(chars, 1, 4, 3)) {
        return true;
      }
      const uniqueCount = new Set(chars).size;
      return chars.length >= 8 && uniqueCount / chars.length <= 0.25;
    }
    const uniqueCount = new Set(chars).size;
    if (chars.length === 1) {
      return true;
    }
    if (isRepeatedAsrUnit(chars, 1, 4, 2)) {
      return true;
    }
    return chars.length >= 8 && uniqueCount / chars.length <= 0.25;
  }

  function isRepeatedAsrUnit(chars, minUnitLength = 1, maxUnitLength = 4, minRepeats = 2) {
    if (!Array.isArray(chars) || !chars.length) {
      return false;
    }
    const maxLength = Math.min(maxUnitLength, Math.floor(chars.length / minRepeats));
    for (let unitLength = minUnitLength; unitLength <= maxLength; unitLength += 1) {
      if (chars.length % unitLength !== 0) {
        continue;
      }
      const unit = chars.slice(0, unitLength).join("");
      if (!unit.trim()) {
        continue;
      }
      const repeats = chars.length / unitLength;
      if (repeats >= minRepeats && unit.repeat(repeats) === chars.join("")) {
        return true;
      }
    }
    return false;
  }
  
  function isAsrRepeatedRunHallucination(key, run) {
    if (!isAsrRepeatedRunKeyEligible(key) || run.length < ASR_REPEATED_RUN_MIN_COUNT) {
      return false;
    }
    const duration = run.reduce((sum, segment) => sum + Math.max(0, Number(segment.end) - Number(segment.start)), 0);
    return duration >= ASR_REPEATED_RUN_MIN_DURATION_SECONDS;
  }

  function isAsrRepeatedRunKeyEligible(key) {
    const text = String(key || "");
    if (text.length >= ASR_REPEATED_RUN_MIN_TEXT_CHARS) {
      return true;
    }
    if (text.length < ASR_REPEATED_RUN_MIN_NON_LATIN_TEXT_CHARS) {
      return false;
    }
    return /[^\p{Script=Latin}\p{Number}_]/u.test(text);
  }
  
  function normalizeAsrHallucinationText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\s,.!?;:'"()[\]{}，。！？；：“”‘’（）【】《》、·…—-]+/g, "");
  }
  
  function asrSegmentsUseAbsoluteTime(segments, chunkStart, chunkEnd, chunkDuration = 0) {
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
    if (Number.isFinite(chunkDuration) && chunkDuration > 0 && firstStart >= -tolerance && firstEnd <= chunkDuration + tolerance) {
      return false;
    }
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
        previous.start = Math.min(previous.start, segment.start);
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
    if (!Number.isFinite(gap)) {
      return false;
    }
    if (gap >= -0.05 && gap <= ASR_ADJACENT_DUPLICATE_MAX_GAP_SECONDS) {
      return true;
    }
    const previousStart = Number(previous?.start);
    const previousEnd = Number(previous?.end);
    const currentStart = Number(current?.start);
    const currentEnd = Number(current?.end);
    if (![previousStart, previousEnd, currentStart, currentEnd].every(Number.isFinite)) {
      return false;
    }
    const overlap = intervalOverlapSeconds(previousStart, previousEnd, currentStart, currentEnd);
    const shorterDuration = Math.min(previousEnd - previousStart, currentEnd - currentStart);
    return overlap > 0 && shorterDuration > 0 && overlap / shorterDuration >= 0.5;
  }
  
  function normalizedAsrDuplicateText(text) {
    return cleanVttText(text || "").replace(/\s+/g, " ").trim();
  }
  
    return {
    ASR_VAD_SPLIT_MIN_SILENCE_SECONDS,
    filterAsrSegmentsByChunkOwnership,
    filterAsrDistributedRepeatedRuns,
    filterAsrSegmentsByHallucinationGuard,
    filterAsrSegmentsBySpeechActivity,
    filterAsrStrictVadRecoverySegments,
    filterAsrSuspiciousRepeatedRuns,
    mergeAdjacentDuplicateAsrSegments,
    mergeAsrSpeechIntervals,
    normalizeAsrSegments,
    normalizeAsrSpeechIntervals,
    shouldSkipBrowserAsrChunk
  };
})();
