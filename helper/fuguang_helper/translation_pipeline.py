from __future__ import annotations

import ast
import json
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

import httpx

from .stabilizer import format_context_card_for_prompt


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ENV_PATH = PROJECT_ROOT / ".env"
HELPER_ENV_PATH = PROJECT_ROOT / "helper" / ".env"
OUTPUT_DIR = PROJECT_ROOT / "cache" / "subtitles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_TARGET_LANGUAGE = "zh-CN"
DEFAULT_MAX_WORKERS = 3
DEFAULT_ATTEMPTS = 2
DEFAULT_TRANSLATION_TIMEOUT_SECONDS = 300
DEFAULT_TRANSLATION_BATCH_SEGMENTS = 32


@dataclass(frozen=True)
class ModelConfig:
    base_url: str
    model: str
    api_key: str
    provider_type: str = "openai"


@dataclass(frozen=True)
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass
class ChunkStatus:
    index: int
    stage: str = "queued"
    attempts: int = 0
    error: str = ""
    source_segments: int = 0
    translated_segments: int = 0


ProgressCallback = Callable[[dict[str, Any]], None]


def load_pipeline_config(overrides: dict[str, Any] | None = None) -> tuple[ModelConfig, ModelConfig]:
    env = load_combined_env()
    overrides = overrides or {}
    asr = load_asr_config(env, overrides.get("asr") if isinstance(overrides.get("asr"), dict) else None)
    translation = load_translation_config(
        env,
        overrides.get("translation") if isinstance(overrides.get("translation"), dict) else None,
    )
    if not asr:
        raise RuntimeError("缺少语音识别配置：请在插件侧边栏填写在线 ASR 配置档。")
    if not translation:
        raise RuntimeError("缺少翻译模型配置：请在插件侧边栏填写翻译配置档的接口地址、模型名称和 API 密钥。")
    return asr, translation


def load_combined_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for path in (PROJECT_ENV_PATH, HELPER_ENV_PATH):
        values.update(read_env_file(path))
    values.update(os.environ)
    return values


def read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    output: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = parse_env_value(value)
        if key:
            output[key] = value
    return output


def parse_env_value(value: str) -> str:
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        try:
            parsed = ast.literal_eval(text)
        except (SyntaxError, ValueError):
            return text[1:-1]
        return str(parsed)
    return text


def load_asr_config(env: dict[str, str], override: dict[str, Any] | None = None) -> ModelConfig | None:
    base = load_asr_config_from_env(env)
    override = override or {}
    override_key = str(override.get("apiKey") or override.get("api_key") or "").strip()
    override_model = str(override.get("model") or "").strip()
    override_base_url = str(override.get("baseUrl") or override.get("base_url") or "").strip()
    override_provider_raw = str(override.get("providerType") or override.get("provider_type") or "").strip()
    if override_provider_raw == "local_whisper":
        return None
    override_provider = normalize_asr_provider_type(override_provider_raw) if override_provider_raw else ""
    has_override = bool(override_key or override_model or override_base_url or override_provider)
    if has_override:
        provider_type = override_provider or "openai"
        api_key = override_key
        model = override_model or default_asr_model(provider_type)
        base_url = override_base_url or default_asr_base_url(provider_type)
        if not api_key or not model:
            return None
        return ModelConfig(
            base_url=base_url,
            model=model,
            api_key=api_key,
            provider_type=provider_type,
        )
    return base


def load_asr_config_from_env(env: dict[str, str]) -> ModelConfig | None:
    provider_type_raw = str(env.get("FUGUANG_ASR_PROVIDER_TYPE") or "openai").strip()
    if provider_type_raw == "local_whisper":
        return None
    provider_type = normalize_asr_provider_type(provider_type_raw)
    explicit_key = env.get("FUGUANG_ASR_API_KEY")
    if explicit_key:
        return ModelConfig(
            base_url=env.get("FUGUANG_ASR_BASE_URL") or default_asr_base_url(provider_type),
            model=env.get("FUGUANG_ASR_MODEL") or default_asr_model(provider_type),
            api_key=explicit_key,
            provider_type=provider_type,
        )
    return None


def normalize_asr_provider_type(provider_type: object) -> str:
    value = str(provider_type or "").strip()
    if value == "local_whisper":
        return ""
    return value if value in {"openai", "groq", "xai"} else "openai"


def default_asr_base_url(provider_type: str) -> str:
    return {
        "groq": "https://api.groq.com/openai/v1",
        "xai": "https://api.x.ai/v1",
    }.get(provider_type, "https://api.openai.com/v1")


def default_asr_model(provider_type: str) -> str:
    return {
        "groq": "whisper-large-v3-turbo",
        "xai": "grok-2-voice-1212",
    }.get(provider_type, "whisper-1")


def load_translation_config(env: dict[str, str], override: dict[str, Any] | None = None) -> ModelConfig | None:
    base = load_translation_config_from_env(env)
    override = override or {}
    override_key = str(override.get("apiKey") or override.get("api_key") or "").strip()
    override_model = str(override.get("model") or "").strip()
    override_base_url = str(override.get("baseUrl") or override.get("base_url") or "").strip()
    override_provider = str(override.get("providerType") or override.get("provider_type") or "").strip()
    has_override = bool(override_key or override_model or override_base_url or override_provider)
    if has_override:
        api_key = override_key
        model = override_model
        base_url = override_base_url or (base.base_url if base else "https://api.openai.com/v1")
        provider_type = override_provider or "openai"
        if not api_key or not model:
            return None
        return ModelConfig(
            base_url=base_url,
            model=model,
            api_key=api_key,
            provider_type=provider_type,
        )
    return base


def load_translation_config_from_env(env: dict[str, str]) -> ModelConfig | None:
    if env.get("FUGUANG_LLM_API_KEY") and env.get("FUGUANG_LLM_MODEL"):
        return ModelConfig(
            base_url=env.get("FUGUANG_LLM_BASE_URL") or "https://api.openai.com/v1",
            model=env["FUGUANG_LLM_MODEL"],
            api_key=env["FUGUANG_LLM_API_KEY"],
            provider_type=env.get("FUGUANG_LLM_PROVIDER_TYPE") or "openai",
        )
    return None


def effective_config_summary(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    overrides = overrides or {}
    env = load_combined_env()
    asr = load_asr_config(env, overrides.get("asr") if isinstance(overrides.get("asr"), dict) else None)
    translation = load_translation_config(
        env,
        overrides.get("translation") if isinstance(overrides.get("translation"), dict) else None,
    )
    return {
        "asr": summarize_model_config(asr),
        "translation": summarize_model_config(translation),
        "targetLanguage": overrides.get("targetLanguage") or env.get("FUGUANG_TARGET_LANGUAGE") or DEFAULT_TARGET_LANGUAGE,
        "workers": int(env.get("FUGUANG_TRANSLATION_WORKERS") or DEFAULT_MAX_WORKERS),
        "sources": {
            "projectEnv": str(PROJECT_ENV_PATH),
            "projectEnvFound": PROJECT_ENV_PATH.exists(),
            "helperEnv": str(HELPER_ENV_PATH),
            "helperEnvFound": HELPER_ENV_PATH.exists(),
        },
    }


def summarize_model_config(config: ModelConfig | None) -> dict[str, Any]:
    if not config:
        return {
            "configured": False,
            "baseUrl": "",
            "model": "",
            "providerType": "openai",
            "apiKeyConfigured": False,
            "apiKeyPreview": "",
        }
    return {
        "configured": True,
        "baseUrl": config.base_url,
        "model": config.model,
        "providerType": config.provider_type,
        "apiKeyConfigured": bool(config.api_key),
        "apiKeyPreview": mask_secret(config.api_key),
    }


def mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "********"
    return f"{value[:4]}...{value[-4:]}"


def run_translation_pipeline(
    *,
    job_id: str,
    chunks: list[dict[str, Any]],
    chunk_seconds: int,
    context_card: dict[str, Any],
    title: str,
    source_language: str,
    target_language: str = DEFAULT_TARGET_LANGUAGE,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, Any]:
    asr_config, translation_config = load_pipeline_config()
    chunk_statuses = [ChunkStatus(index=index) for index in range(len(chunks))]
    max_workers = max(1, min(int(os.getenv("FUGUANG_TRANSLATION_WORKERS", str(DEFAULT_MAX_WORKERS))), 6))
    started_at = time.time()
    source_by_index: dict[int, list[TranscriptSegment]] = {}
    translated_by_index: dict[int, list[TranscriptSegment]] = {}

    def report() -> None:
        report_translation_progress(
            progress_callback=progress_callback,
            chunk_statuses=chunk_statuses,
            chunks_total=len(chunks),
            started_at=started_at,
        )

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                process_audio_chunk,
                index=index,
                chunk=chunk,
                chunk_seconds=chunk_seconds,
                context_card=context_card,
                title=title,
                source_language=source_language,
                target_language=target_language,
                asr_config=asr_config,
                translation_config=translation_config,
                status=chunk_statuses[index],
                progress_callback=report,
            ): index
            for index, chunk in enumerate(chunks)
        }
        for future in as_completed(future_map):
            index = future_map[future]
            try:
                chunk_index, source_segments, translated_segments = future.result()
            except Exception as exc:  # noqa: BLE001 - chunk failure is reported on the job.
                chunk_statuses[index].stage = "failed"
                chunk_statuses[index].error = str(exc)
                report()
                continue
            source_by_index[chunk_index] = source_segments
            translated_by_index[chunk_index] = translated_segments
            report()

    failed = [status for status in chunk_statuses if status.stage == "failed"]
    source_segments = [segment for index in sorted(source_by_index) for segment in source_by_index[index]]
    translated_segments = [segment for index in sorted(translated_by_index) for segment in translated_by_index[index]]
    outputs = write_pipeline_outputs(
        job_id=job_id,
        output_dir=OUTPUT_DIR,
        translated_segments=translated_segments,
        source_segments=source_segments,
        chunk_statuses=chunk_statuses,
    )
    return {
        **outputs,
        "chunksTotal": len(chunks),
        "chunksDone": len(chunks) - len(failed),
        "chunksFailed": len(failed),
        "chunkStatuses": [asdict(status) for status in chunk_statuses],
        "failed": bool(failed),
        "elapsedSeconds": round(time.time() - started_at, 2),
    }


def process_audio_chunk(
    *,
    index: int,
    chunk: dict[str, Any],
    chunk_seconds: int,
    context_card: dict[str, Any],
    title: str,
    source_language: str,
    target_language: str,
    asr_config: ModelConfig,
    translation_config: ModelConfig,
    status: ChunkStatus,
    progress_callback: Callable[[], None] | None = None,
) -> tuple[int, list[TranscriptSegment], list[TranscriptSegment]]:
    status.stage = "asr"
    status.error = ""
    _notify(progress_callback)
    offset = float(index * chunk_seconds)
    audio_path = Path(str(chunk["path"]))
    source_segments = retry_step(
        lambda: transcribe_audio_chunk(audio_path, asr_config, source_language, offset),
        attempts=DEFAULT_ATTEMPTS,
        label=f"第 {index + 1} 个音频分段识别",
        on_attempt=lambda attempt: _record_attempt(status, attempt),
        on_error=lambda exc: _record_error(status, exc, progress_callback),
    )
    status.source_segments = len(source_segments)
    status.stage = "translation"
    _notify(progress_callback)
    translated_segments = retry_step(
        lambda: translate_segments(
            title=title,
            segments=source_segments,
            config=translation_config,
            context_card=context_card,
            target_language=target_language,
        ),
        attempts=DEFAULT_ATTEMPTS,
        label=f"第 {index + 1} 个音频分段翻译",
        on_attempt=lambda attempt: _record_attempt(status, attempt),
        on_error=lambda exc: _record_error(status, exc, progress_callback),
    )
    status.translated_segments = len(translated_segments)
    status.stage = "done"
    status.error = ""
    _notify(progress_callback)
    return index, source_segments, translated_segments


def report_translation_progress(
    *,
    progress_callback: ProgressCallback | None,
    chunk_statuses: list[ChunkStatus],
    chunks_total: int,
    started_at: float,
    stage: str = "translating",
) -> None:
    if not progress_callback:
        return
    completed = sum(1 for status in chunk_statuses if status.stage == "done")
    failed = sum(1 for status in chunk_statuses if status.stage == "failed")
    progress_callback(
        {
            "status": "running" if failed == 0 else "error",
            "stage": stage,
            "chunksTotal": chunks_total,
            "chunksSubmitted": sum(1 for status in chunk_statuses if status.stage != "queued"),
            "chunksDone": completed,
            "chunksFailed": failed,
            "chunksAsr": sum(1 for status in chunk_statuses if status.stage == "asr"),
            "chunksTranslating": sum(1 for status in chunk_statuses if status.stage == "translation"),
            "percent": round((completed / max(1, chunks_total)) * 100, 1),
            "elapsedSeconds": round(time.time() - started_at, 2),
            "chunkStatuses": [asdict(status) for status in chunk_statuses],
        }
    )


def _notify(callback: Callable[[], None] | None) -> None:
    if callback:
        callback()


def _record_attempt(status: ChunkStatus, attempt: int) -> None:
    status.attempts = max(status.attempts, attempt)


def _record_error(status: ChunkStatus, error: Exception, progress_callback: Callable[[], None] | None = None) -> None:
    status.error = str(error)
    _notify(progress_callback)


def retry_step(
    operation: Callable[[], Any],
    *,
    attempts: int,
    label: str,
    on_attempt: Callable[[int], None] | None = None,
    on_error: Callable[[Exception], None] | None = None,
) -> Any:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        if on_attempt:
            on_attempt(attempt)
        try:
            return operation()
        except Exception as exc:  # noqa: BLE001 - retry wrapper returns final error.
            last_error = exc
            logging.warning("%s attempt %s/%s failed: %s", label, attempt, attempts, exc)
            if on_error:
                on_error(exc)
    raise RuntimeError(f"{label}连续 {attempts} 次失败：{last_error}") from last_error


def transcribe_audio_chunk(
    audio_path: Path,
    config: ModelConfig,
    language: str,
    offset: float,
) -> list[TranscriptSegment]:
    endpoint = transcription_endpoint(config)
    with audio_path.open("rb") as audio_file:
        response = httpx.post(
            endpoint,
            headers={"Authorization": f"Bearer {config.api_key}"},
            data=asr_request_data(config, language),
            files={"file": (audio_path.name, audio_file, "audio/mpeg")},
            timeout=600,
    )
    response.raise_for_status()
    payload: object = response.json() if "json" in response.headers.get("content-type", "") else response.text
    logging.info("ASR response shape provider=%s %s", config.provider_type, describe_asr_payload_shape(payload))
    return offset_segments(segments_from_asr_payload(payload), offset)


def asr_request_data(config: ModelConfig, language: str) -> dict[str, str]:
    if config.provider_type == "xai":
        data: dict[str, str] = {}
        normalized = xai_format_language(normalize_language(language))
        if normalized:
            data["language"] = normalized
            data["format"] = "true"
        return data
    data = {
        "model": config.model,
        "response_format": "verbose_json",
        "timestamp_granularities[]": "segment",
    }
    normalized = normalize_language(language)
    if normalized:
        data["language"] = normalized
    return data


def transcription_endpoint(config_or_base_url: ModelConfig | str) -> str:
    if isinstance(config_or_base_url, ModelConfig):
        if config_or_base_url.provider_type == "xai":
            return f"{config_or_base_url.base_url.rstrip('/')}/stt"
        base_url = config_or_base_url.base_url
    else:
        base_url = config_or_base_url
    base = base_url.rstrip("/")
    return base if base.endswith("/audio/transcriptions") else f"{base}/audio/transcriptions"


def xai_format_language(language: str) -> str:
    supported = {
        "en",
        "fr",
        "de",
        "it",
        "pt",
        "pl",
        "tr",
        "ru",
        "nl",
        "cs",
        "ar",
        "es",
        "ja",
        "ko",
        "hi",
        "th",
        "vi",
    }
    return language if language in supported else ""


def segments_from_vtt_text(vtt: str, *, offset: float = 0.0, allow_empty: bool = False) -> list[TranscriptSegment]:
    lines = vtt.replace("\r", "").split("\n")
    segments: list[TranscriptSegment] = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line or line == "WEBVTT" or line.startswith(("NOTE", "STYLE", "REGION")):
            index += 1
            continue
        if "-->" not in line and index + 1 < len(lines) and "-->" in lines[index + 1]:
            index += 1
            line = lines[index].strip()
        if "-->" not in line:
            index += 1
            continue
        start_text, end_text = [part.strip().split()[0] for part in line.split("-->", 1)]
        start = parse_vtt_timestamp(start_text)
        end = parse_vtt_timestamp(end_text)
        text_lines: list[str] = []
        index += 1
        while index < len(lines) and lines[index].strip():
            text_lines.append(lines[index].strip())
            index += 1
        text = re.sub(r"<[^>]+>", "", " ".join(text_lines)).strip()
        if start is not None and end is not None and end > start and text:
            segments.append(TranscriptSegment(start=start + offset, end=end + offset, text=text))
        index += 1
    if not segments and not allow_empty:
        raise RuntimeError("VTT 字幕文件没有可用时间戳。")
    return segments


def parse_vtt_timestamp(value: str) -> float | None:
    match = re.match(r"^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{1,3})$", value.strip())
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    millis = int(match.group(4).ljust(3, "0"))
    return hours * 3600 + minutes * 60 + seconds + millis / 1000


def segments_from_asr_payload(payload: object) -> list[TranscriptSegment]:
    if isinstance(payload, str):
        text = payload.strip()
        if not text:
            return []
        if "-->" in text:
            return segments_from_vtt_text(text, allow_empty=True)
        raise RuntimeError("语音识别只返回纯文本，没有时间戳，不能生成可跳转字幕。")
    if not isinstance(payload, dict):
        raise RuntimeError("语音识别返回格式无法识别。")
    segments = segments_from_segment_payload(payload)
    if segments:
        return segments
    words = word_items_from_asr_payload(payload)
    if words:
        word_segments = segments_from_word_items(words)
        if word_segments:
            return word_segments
    if has_text_without_timestamps(payload, words):
        raise RuntimeError("语音识别结果没有 segment 或 word 时间戳，无法生成字幕。")
    text = str(payload.get("text") or "").strip()
    if text and "-->" in text:
        return segments_from_vtt_text(text, allow_empty=True)
    if not text:
        return []
    raise RuntimeError("语音识别结果没有 segment 或 word 时间戳，无法生成字幕。")


def has_text_without_timestamps(payload: dict[str, Any], words: list[dict[str, Any]]) -> bool:
    raw_segments = payload.get("segments") or payload.get("results") or payload.get("chunks")
    if isinstance(raw_segments, list):
        for item in raw_segments:
            if isinstance(item, dict) and str(item.get("text") or item.get("transcript") or "").strip():
                return True
    for item in words:
        if str(item.get("word") or item.get("text") or item.get("token") or "").strip():
            return True
    return False


def segments_from_segment_payload(payload: dict[str, Any]) -> list[TranscriptSegment]:
    raw_segments = payload.get("segments") or payload.get("results") or payload.get("chunks")
    if not isinstance(raw_segments, list):
        return []
    segments: list[TranscriptSegment] = []
    for item in raw_segments:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or item.get("transcript") or "").strip()
        start = coerce_float(item.get("start"))
        end = coerce_float(item.get("end"))
        if text and start is not None and end is not None and end > start:
            segments.append(TranscriptSegment(start=start, end=end, text=text))
    return segments


def word_items_from_asr_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("words", "word_timestamps"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    result = payload.get("result")
    if isinstance(result, dict):
        value = result.get("words")
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def segments_from_word_items(words: list[dict[str, Any]]) -> list[TranscriptSegment]:
    segments: list[TranscriptSegment] = []
    current_words: list[str] = []
    current_start: float | None = None
    current_end: float | None = None
    for word in words:
        text = str(word.get("word") or word.get("text") or "").strip()
        start = first_float(word, "start", "start_time")
        end = first_float(word, "end", "end_time")
        if not text or start is None or end is None or end <= start:
            continue
        if current_start is None:
            current_start = start
        should_flush = (
            current_words
            and (
                len("".join(current_words)) >= 32
                or (current_end is not None and start - current_end >= 0.8)
                or (current_end is not None and end - current_start >= 7.0)
            )
        )
        if should_flush and current_start is not None and current_end is not None:
            segments.append(TranscriptSegment(start=current_start, end=current_end, text=join_asr_words(current_words)))
            current_words = []
            current_start = start
        current_words.append(text)
        current_end = end
    if current_words and current_start is not None and current_end is not None:
        segments.append(TranscriptSegment(start=current_start, end=current_end, text=join_asr_words(current_words)))
    return segments


def first_float(payload: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        if key in payload:
            value = coerce_float(payload.get(key))
            if value is not None:
                return value
    return None


def join_asr_words(words: list[str]) -> str:
    if any(contains_cjk(word) for word in words):
        return "".join(words)
    return " ".join(words)


def contains_cjk(value: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in value)


def describe_asr_payload_shape(payload: object) -> str:
    if isinstance(payload, str):
        return f"type=text length={len(payload)} has_timing={'-->' in payload}"
    if not isinstance(payload, dict):
        return f"type={type(payload).__name__}"
    keys = sorted(str(key) for key in payload.keys())[:20]
    parts = [f"type=json keys={keys}"]
    for key in ("segments", "results", "chunks", "words", "word_timestamps"):
        value = payload.get(key)
        if isinstance(value, list):
            parts.append(f"{key}_len={len(value)}")
    result = payload.get("result")
    if isinstance(result, dict):
        parts.append(f"result_keys={sorted(str(key) for key in result.keys())[:20]}")
        words = result.get("words")
        if isinstance(words, list):
            parts.append(f"result_words_len={len(words)}")
    text = payload.get("text")
    if isinstance(text, str):
        parts.append(f"text_len={len(text)}")
        parts.append(f"text_has_timing={'-->' in text}")
    return " ".join(parts)


def translate_segments(
    *,
    title: str,
    segments: list[TranscriptSegment],
    config: ModelConfig,
    context_card: dict[str, Any],
    target_language: str,
) -> list[TranscriptSegment]:
    if not segments:
        return []
    if segments_are_all_target_language(segments, target_language):
        return list(segments)
    batch_size = translation_batch_size(config)
    if len(segments) > batch_size:
        translated: list[TranscriptSegment] = []
        for batch in segment_batches(segments, batch_size):
            translated.extend(translate_segment_batch_with_fallback(
                title=title,
                segments=batch,
                config=config,
                context_card=context_card,
                target_language=target_language,
            ))
        return align_translation(segments, translated)
    return translate_segment_batch_with_fallback(
        title=title,
        segments=segments,
        config=config,
        context_card=context_card,
        target_language=target_language,
    )


def translate_segment_batch_with_fallback(
    *,
    title: str,
    segments: list[TranscriptSegment],
    config: ModelConfig,
    context_card: dict[str, Any],
    target_language: str,
) -> list[TranscriptSegment]:
    try:
        return translate_segment_batch(
            title=title,
            segments=segments,
            config=config,
            context_card=context_card,
            target_language=target_language,
        )
    except Exception:
        if len(segments) <= 1:
            raise
        midpoint = max(1, len(segments) // 2)
        logging.warning("translation batch failed; retrying as smaller batches size=%s", len(segments))
        left = translate_segment_batch_with_fallback(
            title=title,
            segments=segments[:midpoint],
            config=config,
            context_card=context_card,
            target_language=target_language,
        )
        right = translate_segment_batch_with_fallback(
            title=title,
            segments=segments[midpoint:],
            config=config,
            context_card=context_card,
            target_language=target_language,
        )
        return align_translation(segments, [*left, *right])


def translate_segment_batch(
    *,
    title: str,
    segments: list[TranscriptSegment],
    config: ModelConfig,
    context_card: dict[str, Any],
    target_language: str,
) -> list[TranscriptSegment]:
    translated = _translate_segments_once(
        title=title,
        segments=segments,
        config=config,
        context_card=context_card,
        target_language=target_language,
    )
    aligned = align_translation(segments, translated)
    repaired = repair_untranslated_segments(
        title=title,
        source_segments=segments,
        translated_segments=aligned,
        config=config,
        context_card=context_card,
        target_language=target_language,
    )
    incomplete = translation_repair_indices(segments, repaired, target_language)
    if incomplete:
        logging.warning("subtitle translation still has suspected untranslated segments count=%s", len(incomplete))
    return repaired


def translation_batch_size(config: ModelConfig) -> int:
    try:
        configured = int(os.getenv("FUGUANG_TRANSLATION_BATCH_SEGMENTS", str(DEFAULT_TRANSLATION_BATCH_SEGMENTS)))
    except ValueError:
        configured = DEFAULT_TRANSLATION_BATCH_SEGMENTS
    if "hunyuan" in config.model.lower():
        configured = min(configured, 24)
    return max(8, min(configured, 48))


def segment_batches(segments: list[TranscriptSegment], batch_size: int) -> list[list[TranscriptSegment]]:
    return [segments[index : index + batch_size] for index in range(0, len(segments), batch_size)]


def _translate_segments_once(
    *,
    title: str,
    segments: list[TranscriptSegment],
    config: ModelConfig,
    context_card: dict[str, Any],
    target_language: str,
) -> list[TranscriptSegment]:
    messages = translation_messages(title, segments, context_card, target_language)
    content = chat_text(
        config,
        messages,
        temperature=0.08,
        max_tokens=12000,
        timeout=translation_timeout_seconds(),
    )
    logging.info("translation response shape provider=%s %s", config.provider_type, describe_text_payload_shape(content))
    try:
        payload = loads_json_content(content)
    except json.JSONDecodeError as exc:
        payload = repair_json_content(
            config,
            messages,
            content,
            expected_key="translated_transcript",
            parse_error=exc,
        )
    try:
        translated = translated_segments_from_payload(payload)
    except RuntimeError as exc:
        logging.warning("translation payload schema invalid: %s %s", exc, describe_payload_shape(payload))
        payload = repair_json_content(
            config,
            messages,
            content,
            expected_key="translated_transcript",
            schema_error=str(exc),
        )
        translated = translated_segments_from_payload(payload)
    return align_translation(segments, translated)


def translation_timeout_seconds() -> int:
    try:
        value = int(os.getenv("FUGUANG_TRANSLATION_TIMEOUT_SECONDS", str(DEFAULT_TRANSLATION_TIMEOUT_SECONDS)))
    except ValueError:
        value = DEFAULT_TRANSLATION_TIMEOUT_SECONDS
    return max(60, min(value, 300))




def translation_messages(
    title: str,
    segments: list[TranscriptSegment],
    context_card: dict[str, Any],
    target_language: str,
) -> list[dict[str, str]]:
    target = target_language_name(target_language)
    count = len(segments)
    return [
        {
            "role": "system",
            "content": (
                f"Translate subtitle segments into natural {target}. "
                "Return exactly one valid JSON object. No markdown, no comments, no prose, "
                "and no trailing commas. "
                "The only top-level key must be \"translated_transcript\". "
                "Schema: {\"translated_transcript\":[{\"start\":number,\"end\":number,\"text\":string}]}. "
                "Preserve segment count, order, start, and end exactly. Do not summarize. "
                "Return one JSON item for every input segment, including very short lines, filler lines, "
                "and lines already written in the target language. Never return an empty array unless "
                "the input segment list is empty. "
                "You may silently resolve only obvious high-confidence ASR mistakes while translating. "
                "Prefer no correction over uncertain correction."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Title: {title}\n"
                f"{format_context_card_for_prompt(context_card)}\n\n"
                f"Input segment count: {count}\n"
                f"Output translated_transcript length must be exactly {count}.\n\n"
                "Segments:\n"
                + "\n".join(f"[{segment.start:.2f}-{segment.end:.2f}] {segment.text}" for segment in segments)
            ),
        },
    ]


def chat_text(
    config: ModelConfig,
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    timeout: float,
) -> str:
    base_url = config.base_url.rstrip("/")
    if config.provider_type == "anthropic":
        system = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
        anthropic_messages = [
            {"role": "assistant" if message["role"] == "assistant" else "user", "content": message["content"]}
            for message in messages
            if message["role"] != "system"
        ]
        response = httpx.post(
            anthropic_endpoint(base_url),
            headers={
                "x-api-key": config.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": config.model,
                "system": system or None,
                "messages": anthropic_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        parts = response.json().get("content") or []
        return "".join(part.get("text", "") for part in parts if isinstance(part, dict))

    request_payload = {
        "model": config.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    response = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {config.api_key}"},
        json=request_payload,
        timeout=timeout,
    )
    response.raise_for_status()
    content = str(response.json()["choices"][0]["message"]["content"])
    if openai_json_mode_rejected(content):
        logging.warning("model rejected OpenAI response_format; retrying without JSON mode provider=%s model=%s", config.provider_type, config.model)
        retry_payload = dict(request_payload)
        retry_payload.pop("response_format", None)
        response = httpx.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json=retry_payload,
            timeout=timeout,
        )
        response.raise_for_status()
        content = str(response.json()["choices"][0]["message"]["content"])
    return content


def anthropic_endpoint(base_url: str) -> str:
    base = base_url.strip().rstrip("/")
    if base.endswith("/messages"):
        return base
    if base.endswith("/v1"):
        return f"{base}/messages"
    if re.search(r"api\.anthropic\.com$", base) or base.endswith("/anthropic"):
        return f"{base}/v1/messages"
    return f"{base}/messages"


def openai_json_mode_rejected(content: str) -> bool:
    text = content.strip().lower()
    return "response_format" in text and (
        "not supported" in text
        or "unsupported" in text
        or "not support" in text
        or "does not support" in text
    )


def repair_json_content(
    config: ModelConfig,
    original_messages: list[dict[str, str]],
    content: str,
    *,
    expected_key: str,
    parse_error: json.JSONDecodeError | None = None,
    schema_error: str = "",
) -> object:
    original_instruction = "\n\n".join(
        f"{message['role'].upper()}:\n{message['content']}"
        for message in original_messages
    )
    error_description = (
        f"The JSON parser failed with: {parse_error.msg} at line {parse_error.lineno}, column {parse_error.colno}."
        if parse_error
        else f"The payload schema was invalid: {schema_error}"
    )
    repaired = chat_text(
        config,
        [
            {
                "role": "system",
                "content": (
                    "You repair JSON for a subtitle translation pipeline. Return valid JSON only. "
                    "Preserve the schema requested by the original instruction. Do not add explanations. "
                    "Do not add new facts. If an array item is incomplete, discard that item."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"{error_description}\n"
                    f"Return a valid JSON object with top-level key \"{expected_key}\". "
                    "Keep only complete recoverable subtitle items from the malformed payload.\n\n"
                    f"Original instruction:\n{trim_for_json_repair(original_instruction, 12000)}\n\n"
                    f"Malformed payload:\n{trim_for_json_repair(content)}"
                ),
            },
        ],
        temperature=0,
        max_tokens=8000,
        timeout=180,
    )
    try:
        return loads_json_content(repaired)
    except json.JSONDecodeError as repair_exc:
        if parse_error:
            raise RuntimeError(
                "模型返回了无法解析的 JSON，自动修复也失败；"
                f"原始错误在 line {parse_error.lineno}, column {parse_error.colno}: {parse_error.msg}; "
                f"修复后错误在 line {repair_exc.lineno}, column {repair_exc.colno}: {repair_exc.msg}"
            ) from repair_exc
        raise RuntimeError(
            "模型返回的 JSON 结构不符合字幕格式，自动修复也失败；"
            f"原始结构错误：{schema_error}; "
            f"修复后错误在 line {repair_exc.lineno}, column {repair_exc.colno}: {repair_exc.msg}"
        ) from repair_exc


def loads_json_content(content: str) -> object:
    stripped = content.strip()
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", stripped, flags=re.DOTALL)
    if match:
        stripped = match.group(1).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        embedded = extract_first_balanced_json(stripped)
        if embedded and embedded != stripped:
            return json.loads(embedded)
        raise


def extract_first_balanced_json(content: str) -> str | None:
    for index, char in enumerate(content):
        if char in "{[":
            candidate = balanced_json_slice(content, index)
            if candidate:
                return candidate
    return None


def balanced_json_slice(content: str, start: int) -> str | None:
    opener = content[start]
    closer = "}" if opener == "{" else "]"
    stack = [closer]
    in_string = False
    escaped = False
    for index in range(start + 1, len(content)):
        char = content[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char in "{[":
            stack.append("}" if char == "{" else "]")
        elif char in "}]":
            if not stack or char != stack[-1]:
                return None
            stack.pop()
            if not stack:
                return content[start : index + 1]
    return None


def trim_for_json_repair(content: str, limit: int = 24000) -> str:
    if len(content) <= limit:
        return content
    half = limit // 2
    return f"{content[:half]}\n...truncated middle...\n{content[-half:]}"


def translated_segments_from_payload(payload: object) -> list[TranscriptSegment]:
    if isinstance(payload, list):
        raw = payload
    elif isinstance(payload, dict):
        raw = payload.get("translated_transcript")
        if not isinstance(raw, list):
            for key in ("translations", "segments", "subtitles", "items"):
                value = payload.get(key)
                if isinstance(value, list):
                    raw = value
                    break
    else:
        raise RuntimeError("翻译模型没有返回 JSON 对象。")
    if not isinstance(raw, list):
        raise RuntimeError("翻译 JSON 缺少 translated_transcript 数组。")
    segments: list[TranscriptSegment] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        start = coerce_float(item.get("start"))
        end = coerce_float(item.get("end"))
        if text and start is not None and end is not None and end > start:
            segments.append(TranscriptSegment(start=start, end=end, text=text))
    if not segments:
        raise RuntimeError("翻译 JSON 没有可用字幕。")
    return segments


def describe_text_payload_shape(content: str) -> str:
    stripped = content.strip()
    first = stripped[:1] or ""
    return f"content_len={len(content)} first={first!r} fenced={stripped.startswith('```')}"


def describe_payload_shape(payload: object) -> str:
    if isinstance(payload, list):
        return f"type=list len={len(payload)}"
    if isinstance(payload, dict):
        parts = [f"type=dict keys={sorted(str(key) for key in payload.keys())[:20]}"]
        for key in ("translated_transcript", "translations", "segments", "subtitles", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                parts.append(f"{key}_len={len(value)}")
        return " ".join(parts)
    return f"type={type(payload).__name__}"


def align_translation(source: list[TranscriptSegment], translated: list[TranscriptSegment]) -> list[TranscriptSegment]:
    output: list[TranscriptSegment] = []
    for index, segment in enumerate(source):
        text = translated[index].text if index < len(translated) and translated[index].text.strip() else segment.text
        output.append(TranscriptSegment(start=segment.start, end=segment.end, text=text))
    if len(output) != len(source):
        raise RuntimeError("翻译结果数量与源字幕数量不一致。")
    return output


def repair_untranslated_segments(
    *,
    title: str,
    source_segments: list[TranscriptSegment],
    translated_segments: list[TranscriptSegment],
    config: ModelConfig,
    context_card: dict[str, Any],
    target_language: str,
) -> list[TranscriptSegment]:
    repaired = align_translation(source_segments, translated_segments)
    for attempt in range(2):
        indices = translation_repair_indices(source_segments, repaired, target_language)
        if not indices:
            return repaired
        logging.info("repairing untranslated subtitle segments attempt=%s count=%s", attempt + 1, len(indices))
        for indexed_chunk in chunk_indices(indices, target_size=8):
            source_chunk = [source_segments[index] for index in indexed_chunk]
            try:
                translated_chunk = _translate_segments_once(
                    title=title,
                    segments=source_chunk,
                    config=config,
                    context_card=context_card,
                    target_language=target_language,
                )
            except Exception:  # noqa: BLE001 - whole chunk retry handles persistent repair failures.
                logging.exception("subtitle repair chunk failed")
                continue
            aligned = align_translation(source_chunk, translated_chunk)
            for index, translated_segment in zip(indexed_chunk, aligned):
                if not needs_translation_repair(source_segments[index], translated_segment, target_language):
                    repaired[index] = translated_segment
    return repaired


def ensure_translation_complete(
    source_segments: list[TranscriptSegment],
    translated_segments: list[TranscriptSegment],
    target_language: str,
) -> None:
    indices = translation_repair_indices(source_segments, translated_segments, target_language)
    if indices:
        raise RuntimeError(f"字幕翻译不完整，仍有 {len(indices)} 条疑似漏翻。")


def translation_repair_indices(
    source_segments: list[TranscriptSegment],
    translated_segments: list[TranscriptSegment],
    target_language: str,
) -> list[int]:
    aligned = align_translation(source_segments, translated_segments)
    return [
        index
        for index, (source, translated) in enumerate(zip(source_segments, aligned))
        if needs_translation_repair(source, translated, target_language)
    ]


def needs_translation_repair(source: TranscriptSegment, translated: TranscriptSegment | None, target_language: str) -> bool:
    if not translated or not translated.text.strip():
        return True
    source_text = normalize_translation_compare(source.text)
    translated_text = normalize_translation_compare(translated.text)
    if source_text and source_text == translated_text and len(source_text) > 12:
        return True
    return text_needs_target_language_repair(translated.text, target_language)


def text_needs_target_language_repair(value: str, target_language: str) -> bool:
    text = value.strip()
    if not text:
        return False
    target = normalize_language(target_language)
    if target == "zh":
        cjk_count = len(re.findall(r"[\u4e00-\u9fff]", text))
        latin_count = len(re.findall(r"[A-Za-z]", text))
        if cjk_count >= 2 or not latin_count:
            return False
        return looks_like_short_latin_text(text)
    if target == "ja":
        kana_count = len(re.findall(r"[\u3040-\u30ff]", text))
        cjk_count = len(re.findall(r"[\u4e00-\u9fff]", text))
        latin_count = len(re.findall(r"[A-Za-z]", text))
        if kana_count >= 2 or cjk_count >= 2 or not latin_count:
            return False
        return looks_like_short_latin_text(text)
    if target == "en":
        cjk_or_kana_count = len(re.findall(r"[\u3040-\u30ff\u4e00-\u9fff]", text))
        latin_word_count = len(re.findall(r"[A-Za-z][A-Za-z']+", text))
        return cjk_or_kana_count >= 4 and latin_word_count < 4
    return False


def segments_are_all_target_language(segments: list[TranscriptSegment], target_language: str) -> bool:
    non_empty = [segment for segment in segments if segment.text.strip()]
    if not non_empty:
        return False
    target_like = sum(1 for segment in non_empty if segment_text_matches_target_language(segment.text, target_language))
    return target_like == len(non_empty)


def segment_text_matches_target_language(text: str, target_language: str) -> bool:
    value = text.strip()
    if not value:
        return False
    target = normalize_language(target_language)
    if target == "zh":
        cjk_count = len(re.findall(r"[\u4e00-\u9fff]", value))
        latin_word_count = len(re.findall(r"[A-Za-z][A-Za-z']+", value))
        return cjk_count >= 2 and latin_word_count <= max(2, cjk_count // 3)
    if target == "ja":
        kana_count = len(re.findall(r"[\u3040-\u30ff]", value))
        cjk_count = len(re.findall(r"[\u4e00-\u9fff]", value))
        latin_word_count = len(re.findall(r"[A-Za-z][A-Za-z']+", value))
        return kana_count + cjk_count >= 2 and latin_word_count <= max(2, (kana_count + cjk_count) // 3)
    if target == "en":
        latin_word_count = len(re.findall(r"[A-Za-z][A-Za-z']+", value))
        cjk_or_kana_count = len(re.findall(r"[\u3040-\u30ff\u4e00-\u9fff]", value))
        return latin_word_count >= 3 and cjk_or_kana_count <= 2
    return False


def looks_like_short_latin_text(value: str) -> bool:
    tokens = re.findall(r"[A-Za-z][A-Za-z']*", value)
    if not tokens:
        return False
    ignored = {"ai", "api", "asr", "gpt", "llm", "url", "rag", "chatgpt", "youtube", "deeplearning"}
    for token in tokens:
        normalized = token.lower().replace("'", "")
        if normalized in ignored:
            continue
        if token.isupper() and len(token) <= 6:
            continue
        return True
    return False


def normalize_translation_compare(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def chunk_indices(indices: list[int], target_size: int) -> list[list[int]]:
    chunks: list[list[int]] = []
    current: list[int] = []
    previous: int | None = None
    for index in indices:
        if current and (len(current) >= target_size or previous is not None and index != previous + 1):
            chunks.append(current)
            current = []
        current.append(index)
        previous = index
    if current:
        chunks.append(current)
    return chunks


def offset_segments(segments: list[TranscriptSegment], offset: float) -> list[TranscriptSegment]:
    return [TranscriptSegment(start=segment.start + offset, end=segment.end + offset, text=segment.text) for segment in segments]


def write_pipeline_outputs(
    *,
    job_id: str,
    output_dir: Path,
    translated_segments: list[TranscriptSegment],
    source_segments: list[TranscriptSegment],
    chunk_statuses: list[ChunkStatus],
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    vtt_path = output_dir / f"{job_id}.vtt"
    json_path = output_dir / f"{job_id}.json"
    vtt_path.write_text(segments_to_vtt(translated_segments), encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "source": [asdict(segment) for segment in source_segments],
                "translated": [asdict(segment) for segment in translated_segments],
                "chunkStatuses": [asdict(status) for status in chunk_statuses],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {
        "vttPath": str(vtt_path),
        "jsonPath": str(json_path),
        "segmentCount": len(translated_segments),
    }


def segments_to_vtt(segments: list[TranscriptSegment]) -> str:
    lines = ["WEBVTT", ""]
    for index, segment in enumerate(sorted(segments, key=lambda item: (item.start, item.end)), start=1):
        lines.extend(
            [
                str(index),
                f"{format_timestamp(segment.start)} --> {format_timestamp(segment.end)}",
                segment.text.replace("\n", " ").strip(),
                "",
            ]
        )
    return "\n".join(lines)


def format_timestamp(seconds: float) -> str:
    millis = int(round(max(0.0, seconds) * 1000))
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def coerce_float(value: object) -> float | None:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def normalize_language(language: str) -> str:
    value = (language or "").strip().lower().replace("_", "-")
    if not value or value == "auto":
        return ""
    if value.startswith("zh"):
        return "zh"
    return value.split("-", 1)[0]


def target_language_name(language: str) -> str:
    normalized = normalize_language(language)
    names = {
        "zh": "Simplified Chinese",
        "en": "English",
        "ja": "Japanese",
        "fr": "French",
        "ko": "Korean",
        "de": "German",
        "ru": "Russian",
    }
    return names.get(normalized, language or "Simplified Chinese")
