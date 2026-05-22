from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = PROJECT_ROOT / "cache" / "audio"
LOG_DIR = PROJECT_ROOT / "logs"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
TARGET_AUDIO_BITRATE = "64k"
DEFAULT_CHUNK_SECONDS = 900


@dataclass(frozen=True)
class FfmpegCapability:
    ffmpeg: str | None
    ffprobe: str | None

    @property
    def available(self) -> bool:
        return bool(self.ffmpeg and self.ffprobe)


def probe_ffmpeg() -> FfmpegCapability:
    return FfmpegCapability(
        ffmpeg=shutil.which("ffmpeg"),
        ffprobe=shutil.which("ffprobe"),
    )


def build_audio_extract_plan(source_url: str) -> dict:
    capability = probe_ffmpeg()
    return {
        "available": capability.available,
        "ffmpeg": capability.ffmpeg,
        "ffprobe": capability.ffprobe,
        "sourceUrl": source_url,
        "target": f"16 kHz 单声道 {TARGET_AUDIO_BITRATE} 音频分段 -> 语音识别 -> WebVTT",
    }


def build_chunked_audio_command(
    *,
    ffmpeg: str,
    candidate: dict[str, Any],
    source_url: str,
    chunk_pattern: str,
    max_seconds: int = 0,
    chunk_seconds: int = DEFAULT_CHUNK_SECONDS,
) -> list[str]:
    headers = build_ffmpeg_headers(candidate)
    command = [
        ffmpeg,
        "-hide_banner",
        "-y",
        "-nostdin",
        "-loglevel",
        "info",
        "-progress",
        "pipe:1",
    ]
    if headers:
        command += ["-headers", headers]
    if candidate.get("kind") == "hls" or candidate.get("ext") in {"m3u", "m3u8"}:
        command += [
            "-allowed_extensions",
            "ALL",
            "-allowed_segment_extensions",
            "ALL",
            "-extension_picky",
            "0",
        ]
    command += ["-i", source_url, "-vn", "-map", "0:a:0?"]
    if max_seconds > 0:
        command += ["-t", str(max_seconds)]
    command += [
        "-ac",
        "1",
        "-ar",
        "16000",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        TARGET_AUDIO_BITRATE,
        "-f",
        "segment",
        "-segment_time",
        str(max(10, int(chunk_seconds))),
        "-reset_timestamps",
        "1",
        "-segment_format",
        "mp3",
        chunk_pattern,
    ]
    return command


def build_progress_snapshot(
    *,
    status: str,
    stage: str,
    processed_seconds: float,
    total_seconds: float | None,
    chunk_seconds: int,
    chunks_ready: int,
    started_at: float,
    now: float | None = None,
) -> dict[str, Any]:
    current_time = time.time() if now is None else now
    total = float(total_seconds or 0)
    processed = max(0.0, float(processed_seconds or 0))
    if status == "done":
        percent = 100.0
    elif status == "error":
        percent = 100.0
    else:
        percent = round(min(99.0, processed / total * 100), 1) if total > 0 else None
    ready_seconds = chunks_ready * max(1, int(chunk_seconds))
    if total > 0:
        ready_seconds = min(round(total), ready_seconds)
    return {
        "status": status,
        "stage": stage,
        "processedSeconds": round(processed, 2),
        "totalSeconds": round(total, 2) if total > 0 else None,
        "percent": percent,
        "chunksReady": chunks_ready,
        "readySeconds": ready_seconds,
        "chunkSeconds": max(1, int(chunk_seconds)),
        "elapsedSeconds": round(max(0.0, current_time - started_at), 2),
    }


def extract_audio_sample(
    candidate: dict[str, Any],
    job_id: str,
    max_seconds: int = 0,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    source_url = candidate.get("url", "")
    if not source_url:
        raise ValueError("缺少可抽取媒体地址。请重新选择媒体源。")

    capability = probe_ffmpeg()
    if not capability.ffmpeg:
        raise RuntimeError("没有找到 ffmpeg。请先安装 ffmpeg，并确认它在 PATH 中。")

    chunk_seconds = int(candidate.get("chunkSeconds") or DEFAULT_CHUNK_SECONDS)
    chunk_dir = CACHE_DIR / job_id
    chunk_dir.mkdir(parents=True, exist_ok=True)
    chunk_pattern = str(chunk_dir / "chunk-%05d.mp3")
    log_path = LOG_DIR / f"preload-{job_id}.log"
    command = build_chunked_audio_command(
        ffmpeg=capability.ffmpeg,
        candidate=candidate,
        source_url=source_url,
        chunk_pattern=chunk_pattern,
        max_seconds=max_seconds,
        chunk_seconds=chunk_seconds,
    )

    started_at = time.time()
    total_seconds = _planned_total_seconds(candidate, max_seconds)
    logging.info("preload job=%s command=%s", job_id, redact_command(command))
    with log_path.open("w", encoding="utf-8") as log_file:
        log_file.write(f"job_id={job_id}\n")
        log_file.write(f"source_url={source_url}\n")
        log_file.write(f"candidate={json.dumps(redact_candidate(candidate), ensure_ascii=False)}\n")
        log_file.write(f"command={json.dumps(redact_command(command), ensure_ascii=False)}\n\n")
        log_file.flush()

        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=log_file,
            text=True,
        )
        processed_seconds = 0.0
        _report_progress(
            progress_callback,
            status="running",
            stage="extracting",
            processed_seconds=processed_seconds,
            total_seconds=total_seconds,
            chunk_seconds=chunk_seconds,
            chunks_ready=0,
            started_at=started_at,
            chunk_dir=chunk_dir,
        )
        assert process.stdout is not None
        for line in process.stdout:
            if should_cancel and should_cancel():
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                raise RuntimeError("任务已停止。")
            log_file.write(line)
            key, value = _parse_progress_line(line)
            if key in {"out_time_ms", "out_time_us"}:
                processed_seconds = max(processed_seconds, _progress_time_to_seconds(value))
            elif key == "out_time":
                processed_seconds = max(processed_seconds, _timestamp_to_seconds(value))
            elif key == "progress":
                chunks_ready = len(list_audio_chunks(chunk_dir))
                _report_progress(
                    progress_callback,
                    status="running",
                    stage="extracting",
                    processed_seconds=processed_seconds,
                    total_seconds=total_seconds,
                    chunk_seconds=chunk_seconds,
                    chunks_ready=chunks_ready,
                    started_at=started_at,
                    chunk_dir=chunk_dir,
                )
        returncode = process.wait()

    if returncode != 0:
        raise RuntimeError(f"ffmpeg 抽取失败，退出码 {returncode}。日志：{log_path}")
    chunks = list_audio_chunks(chunk_dir)
    if not chunks:
        raise RuntimeError(f"ffmpeg 没有生成可用音频。日志：{log_path}")
    total_size = sum(Path(chunk["path"]).stat().st_size for chunk in chunks)
    final_progress = build_progress_snapshot(
        status="done",
        stage="audio_ready",
        processed_seconds=total_seconds or processed_seconds,
        total_seconds=total_seconds,
        chunk_seconds=chunk_seconds,
        chunks_ready=len(chunks),
        started_at=started_at,
    )
    if progress_callback:
        progress_callback(
            {
                **final_progress,
                "chunkDir": str(chunk_dir),
                "chunks": chunks,
            }
        )

    return {
        "jobId": job_id,
        "sourceUrl": source_url,
        "outputPath": chunks[0]["path"],
        "chunkDir": str(chunk_dir),
        "chunks": chunks,
        "chunkCount": len(chunks),
        "logPath": str(log_path),
        "size": total_size,
        "audioBitrate": TARGET_AUDIO_BITRATE,
        "chunkSeconds": chunk_seconds,
        "readySeconds": final_progress["readySeconds"],
        "progress": final_progress,
        "secondsLimit": max_seconds,
        "elapsedSeconds": round(time.time() - started_at, 2),
    }


def _report_progress(
    callback: Callable[[dict[str, Any]], None] | None,
    *,
    status: str,
    stage: str,
    processed_seconds: float,
    total_seconds: float | None,
    chunk_seconds: int,
    chunks_ready: int,
    started_at: float,
    chunk_dir: Path,
) -> None:
    if not callback:
        return
    snapshot = build_progress_snapshot(
        status=status,
        stage=stage,
        processed_seconds=processed_seconds,
        total_seconds=total_seconds,
        chunk_seconds=chunk_seconds,
        chunks_ready=chunks_ready,
        started_at=started_at,
    )
    snapshot["chunkDir"] = str(chunk_dir)
    snapshot["chunks"] = list_audio_chunks(chunk_dir)
    callback(snapshot)


def list_audio_chunks(chunk_dir: Path) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for path in sorted(chunk_dir.glob("chunk-*.mp3")):
        if not path.is_file() or path.stat().st_size <= 0:
            continue
        match = re.match(r"^chunk-(\d+)\.mp3$", path.name)
        if not match:
            continue
        chunks.append(
            {
                "index": int(match.group(1)),
                "path": str(path),
                "size": path.stat().st_size,
            }
        )
    return chunks


def translation_ready_chunks(chunks: list[dict[str, Any]], *, extraction_done: bool) -> list[dict[str, Any]]:
    if extraction_done:
        return list(chunks)
    if len(chunks) <= 1:
        return []
    return list(chunks[:-1])


def _planned_total_seconds(candidate: dict[str, Any], max_seconds: int) -> float | None:
    duration = _coerce_float(candidate.get("duration"))
    if max_seconds > 0 and duration:
        return min(duration, float(max_seconds))
    if max_seconds > 0:
        return float(max_seconds)
    return duration


def _parse_progress_line(line: str) -> tuple[str, str]:
    if "=" not in line:
        return "", ""
    key, value = line.strip().split("=", 1)
    return key, value


def _progress_time_to_seconds(value: str) -> float:
    try:
        return max(0.0, float(value) / 1_000_000)
    except ValueError:
        return 0.0


def _timestamp_to_seconds(value: str) -> float:
    try:
        parts = value.strip().split(":")
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        return float(parts[0])
    except (ValueError, IndexError):
        return 0.0


def _coerce_float(value: object) -> float | None:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def build_ffmpeg_headers(candidate: dict[str, Any]) -> str:
    headers = {str(key).lower(): value for key, value in (candidate.get("requestHeaders") or {}).items()}
    page_url = candidate.get("pageUrl") or candidate.get("initiator") or ""
    output = []
    referer = headers.get("referer") or page_url
    header_map = {
        "User-Agent": headers.get("user-agent"),
        "Referer": referer,
        "Origin": headers.get("origin"),
        "Cookie": headers.get("cookie"),
        "Authorization": headers.get("authorization"),
    }
    for name, value in header_map.items():
        if value:
            output.append(f"{name}: {value}")
    return "\r\n".join(output) + ("\r\n" if output else "")


def redact_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    redacted = dict(candidate)
    request_headers = dict(redacted.get("requestHeaders") or {})
    for key in ["authorization", "cookie"]:
        if key in request_headers:
            request_headers[key] = "<redacted>"
    redacted["requestHeaders"] = request_headers
    return redacted


def redact_command(command: list[str]) -> list[str]:
    redacted = []
    skip_next = False
    for index, item in enumerate(command):
        if skip_next:
            skip_next = False
            continue
        if item == "-headers" and index + 1 < len(command):
            redacted.extend(["-headers", redact_header_blob(command[index + 1])])
            skip_next = True
        else:
            redacted.append(item)
    return redacted


def redact_header_blob(headers: str) -> str:
    lines = []
    for line in headers.splitlines():
        lower = line.lower()
        if lower.startswith("cookie:") or lower.startswith("authorization:"):
            name = line.split(":", 1)[0]
            lines.append(f"{name}: <redacted>")
        else:
            lines.append(line)
    return "\r\n".join(lines)
