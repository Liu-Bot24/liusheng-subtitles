from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import secrets
import shutil
import time
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Any
from urllib.parse import urlparse

import websockets

from .config import HelperConfig
from .dashscope import DashScopeRealtimeSession
from .preload import CACHE_DIR, build_audio_extract_plan, extract_audio_sample, list_audio_chunks, probe_ffmpeg, translation_ready_chunks
from .stabilizer import build_translation_context_card
from .translation_pipeline import (
    DEFAULT_MAX_WORKERS,
    OUTPUT_DIR,
    ChunkStatus,
    TranscriptSegment,
    load_combined_env,
    load_pipeline_config,
    load_translation_config,
    retry_step,
    transcribe_audio_chunk,
    translate_segments,
    write_pipeline_outputs,
)


LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    filename=LOG_DIR / "helper.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = Lock()
JOB_CANCEL_EVENTS: dict[str, Event] = {}
RUNTIME_CACHE_MAX_AGE_DAYS = int(os.getenv("FUGUANG_RUNTIME_CACHE_MAX_AGE_DAYS", "7"))
RUNTIME_CACHE_MAX_BYTES = int(float(os.getenv("FUGUANG_RUNTIME_CACHE_MAX_MB", "1024")) * 1024 * 1024)
AUDIO_CACHE_MAX_AGE_HOURS = float(os.getenv("FUGUANG_AUDIO_CACHE_MAX_AGE_HOURS", "12"))
AUDIO_CACHE_MAX_BYTES = int(float(os.getenv("FUGUANG_AUDIO_CACHE_MAX_MB", "256")) * 1024 * 1024)
RUNTIME_CACHE_KEEP_FAILED_JOBS = int(os.getenv("FUGUANG_RUNTIME_CACHE_KEEP_FAILED_JOBS", "2"))
AUDIO_CACHE_FILE_EXTENSIONS = {".aac", ".flac", ".m4a", ".mp3", ".oga", ".ogg", ".opus", ".wav", ".weba"}
HELPER_TOKEN = os.getenv("FUGUANG_HELPER_TOKEN", "").strip() or secrets.token_urlsafe(24)


class JobCancelled(RuntimeError):
    pass


class HelperHttpHandler(BaseHTTPRequestHandler):
    server_version = "FuguangHelper/0.1"

    def do_OPTIONS(self) -> None:  # noqa: N802 - stdlib handler API
        self.send_response(204)
        self._send_cors_headers()
        self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")
        self.send_header("access-control-allow-headers", "content-type, authorization, x-fuguang-helper-token")
        self.send_header("access-control-max-age", "86400")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        if self.path == "/health":
            capability = probe_ffmpeg()
            self._send_json(
                {
                    "ok": True,
                    "ffmpeg": capability.ffmpeg,
                    "ffprobe": capability.ffprobe,
                    "preloadAvailable": capability.available,
                    "helperToken": HELPER_TOKEN,
                }
            )
            return
        if not self._is_authorized():
            self._send_json({"ok": False, "error": "本机服务拒绝了未授权请求。请从浮光译影扩展内发起操作。"}, status=403)
            return
        parsed = urlparse(self.path)
        if parsed.path.startswith("/jobs/") and parsed.path.endswith("/vtt"):
            job_id = parsed.path.split("/")[-2]
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            translation = job.get("translation", {}) if isinstance(job, dict) else {}
            progress_translation = job.get("progress", {}).get("translation", {}) if isinstance(job, dict) else {}
            vtt_path_text = ""
            if isinstance(translation, dict):
                vtt_path_text = str(translation.get("vttPath") or "")
            if not vtt_path_text and isinstance(progress_translation, dict):
                vtt_path_text = str(progress_translation.get("vttPath") or "")
            vtt_path = Path(vtt_path_text) if vtt_path_text else OUTPUT_DIR / f"{job_id}.vtt"
            if not vtt_path.is_file():
                self._send_json({"ok": False, "error": "字幕文件不存在。"}, status=404)
                return
            self._send_text(vtt_path.read_text(encoding="utf-8"), content_type="text/vtt; charset=utf-8")
            return
        if parsed.path.startswith("/jobs/") and parsed.path.endswith("/transcript"):
            job_id = parsed.path.split("/")[-2]
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            transcript = read_transcript_payload(job_id, job)
            if transcript is None:
                self._send_json({"ok": False, "error": "字幕转写文件不存在。"}, status=404)
                return
            self._send_json({"ok": True, "jobId": job_id, "transcript": transcript})
            return
        if parsed.path.startswith("/jobs/"):
            job_id = parsed.path.rsplit("/", 1)[-1]
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                recovered = recover_translated_job_from_disk(job_id)
                if not recovered:
                    self._send_json({"ok": False, "error": "预加载任务不存在。"}, status=404)
                    return
                job = recovered
            self._send_json({"ok": True, "job": job})
            return
        self._send_json({"ok": False, "error": "没有找到请求的资源。"}, status=404)

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        if not self._is_authorized():
            self._send_json({"ok": False, "error": "本机服务拒绝了未授权请求。请从浮光译影扩展内发起操作。"}, status=403)
            return
        if self.path == "/preload":
            payload = self._read_json()
            candidate = payload.get("candidate") or {}
            metadata = payload.get("metadata") or {}
            model_config = payload.get("modelConfig") if isinstance(payload.get("modelConfig"), dict) else {}
            candidate["chunkSeconds"] = configured_chunk_seconds(candidate, model_config)
            source_url = candidate.get("url", "")
            plan = build_audio_extract_plan(source_url)
            context_card = build_translation_context_card(
                metadata={**metadata, **_candidate_metadata(candidate)},
                source_language=payload.get("sourceLanguage") or candidate.get("sourceLanguage") or "auto",
            )
            job_id = f"{int(time.time() * 1000)}"
            max_seconds = int(os.getenv("FUGUANG_PRELOAD_MAX_SECONDS", "0"))
            logging.info("preload requested job=%s url=%s available=%s", job_id, source_url, plan["available"])
            with JOBS_LOCK:
                JOBS[job_id] = {
                    "id": job_id,
                    "status": "queued",
                    "stage": "queued",
                    "progress": {
                        "status": "queued",
                        "stage": "queued",
                        "percent": 0,
                        "chunksReady": 0,
                        "readySeconds": 0,
                    },
                    "sourceUrl": source_url,
                    "createdAt": time.time(),
                    "plan": plan,
                    "translationContext": context_card,
                }
            Thread(target=run_preload_job, args=(job_id, candidate, max_seconds, model_config), daemon=True).start()
            cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids({job_id}))
            self._send_json(
                {
                    "ok": True,
                    "status": "queued",
                    "job": JOBS[job_id],
                }
            )
            return
        parsed = urlparse(self.path)
        if parsed.path.startswith("/jobs/") and parsed.path.endswith("/cancel"):
            job_id = parsed.path.split("/")[-2]
            cancel_job(job_id)
            self._send_json({"ok": True, "status": "cancelled"})
            return
        if parsed.path.startswith("/jobs/") and parsed.path.endswith("/retry-failed"):
            job_id = parsed.path.split("/")[-2]
            payload = self._read_json()
            try:
                job = start_retry_failed_job_chunks(job_id, payload)
            except Exception as exc:  # noqa: BLE001 - return stable JSON errors to the extension.
                logging.exception("retry failed request rejected job=%s", job_id)
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._send_json({"ok": True, "status": job.get("status"), "job": job})
            return
        if parsed.path.startswith("/jobs/") and parsed.path.endswith("/retry-translation"):
            job_id = parsed.path.split("/")[-2]
            payload = self._read_json()
            try:
                job = start_retry_translation_job_chunks(job_id, payload)
            except Exception as exc:  # noqa: BLE001 - return stable JSON errors to the extension.
                logging.exception("retry translation request rejected job=%s", job_id)
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._send_json({"ok": True, "status": job.get("status"), "job": job})
            return
        if parsed.path.startswith("/jobs/") and parsed.path.endswith("/clear-audio-cache"):
            job_id = parsed.path.split("/")[-2]
            try:
                result = clear_preload_audio_cache(job_id)
            except Exception as exc:  # noqa: BLE001 - return stable JSON errors to the extension.
                logging.exception("clear audio cache request rejected job=%s", job_id)
                self._send_json({"ok": False, "error": str(exc)}, status=400)
                return
            self._send_json({"ok": True, **result})
            return
        self._send_json({"ok": False, "error": "没有找到请求的资源。"}, status=404)

    def log_message(self, format: str, *args: Any) -> None:
        logging.info("http %s", format % args)

    def _read_json(self) -> dict:
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def _send_json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self._send_cors_headers()
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_text(self, text: str, *, content_type: str, status: int = 200) -> None:
        data = text.encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", content_type)
        self._send_cors_headers()
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_cors_headers(self) -> None:
        origin = self.headers.get("origin", "")
        if self._is_extension_origin(origin):
            self.send_header("access-control-allow-origin", origin)
            self.send_header("vary", "Origin")

    def _is_authorized(self) -> bool:
        token = self.headers.get("x-fuguang-helper-token", "")
        return secrets.compare_digest(token, HELPER_TOKEN)

    @staticmethod
    def _is_extension_origin(origin: str) -> bool:
        return origin.startswith(("chrome-extension://", "moz-extension://"))


async def realtime_handler(websocket: Any) -> None:
    config = HelperConfig.from_env()
    if not config.dashscope_api_key:
        await websocket.send(
            json.dumps(
                {
                    "type": "error",
                    "error": "实时字幕未配置：请在 helper/.env 中填写 DASHSCOPE_API_KEY，或先使用预加载模式。",
                },
                ensure_ascii=False,
            )
        )
        return

    session = DashScopeRealtimeSession(config)
    session.start()
    try:
        while True:
            message = await websocket.recv()
            if isinstance(message, bytes):
                session.send_audio(message)
                await forward_captions(websocket, session)
            else:
                logging.info("realtime control message=%s", message)
    except websockets.ConnectionClosed:
        logging.info("realtime client disconnected")
    finally:
        session.stop()


async def forward_captions(websocket: Any, session: DashScopeRealtimeSession) -> None:
    try:
        for caption in session.poll_captions():
            await websocket.send(json.dumps({"type": "caption", "text": caption}, ensure_ascii=False))
    except RuntimeError as exc:
        await websocket.send(json.dumps({"type": "error", "error": str(exc)}, ensure_ascii=False))


def start_http_server(config: HelperConfig) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer((config.http_host, config.http_port), HelperHttpHandler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def _candidate_metadata(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": candidate.get("title") or "",
        "description": candidate.get("description") or "",
        "channel": candidate.get("channel") or candidate.get("uploader") or candidate.get("creator") or "",
        "pageUrl": candidate.get("pageUrl") or candidate.get("initiator") or "",
        "sourceUrl": candidate.get("url") or "",
    }


def _job_context_card(job_id: str) -> dict[str, Any]:
    with JOBS_LOCK:
        return dict(JOBS.get(job_id, {}).get("translationContext") or {})


def _coerce_number(value: object) -> float | None:
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def read_transcript_payload(job_id: str, job: dict[str, Any] | None = None) -> dict[str, Any] | None:
    translation = job.get("translation", {}) if isinstance(job, dict) else {}
    json_path_text = str(translation.get("jsonPath") or "") if isinstance(translation, dict) else ""
    json_path = Path(json_path_text) if json_path_text else OUTPUT_DIR / f"{job_id}.json"
    if not json_path.exists():
        return None
    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    return {
        "source": payload.get("source") if isinstance(payload.get("source"), list) else [],
        "translated": payload.get("translated") if isinstance(payload.get("translated"), list) else [],
        "chunkStatuses": payload.get("chunkStatuses") if isinstance(payload.get("chunkStatuses"), list) else [],
    }


def configured_chunk_seconds(
    candidate: dict[str, Any] | None,
    model_config: dict[str, Any] | None,
    *,
    fallback: int = 900,
) -> int:
    candidate = candidate or {}
    model_config = model_config or {}
    value = candidate.get("chunkSeconds") or model_config.get("chunkSeconds")
    if not value and model_config.get("chunkMinutes"):
        value = int(_coerce_number(model_config.get("chunkMinutes")) or 0) * 60
    seconds = int(_coerce_number(value) or fallback)
    return max(60, min(seconds, 3600))


def original_job_chunk_seconds(job: dict[str, Any], fallback: int = 900) -> int:
    progress = job.get("progress") if isinstance(job.get("progress"), dict) else {}
    extraction = progress.get("extraction") if isinstance(progress.get("extraction"), dict) else {}
    audio = job.get("audio") if isinstance(job.get("audio"), dict) else {}
    value = extraction.get("chunkSeconds") or audio.get("chunkSeconds")
    seconds = int(_coerce_number(value) or fallback)
    return max(60, min(seconds, 3600))


def worker_count(value: object, *, fallback: int, upper: int) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        number = fallback
    return max(1, min(number, upper))


def recover_translated_job_from_disk(job_id: str) -> dict[str, Any] | None:
    vtt_path = OUTPUT_DIR / f"{job_id}.vtt"
    json_path = OUTPUT_DIR / f"{job_id}.json"
    if not vtt_path.exists() or not json_path.exists():
        return None
    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        payload = {}
    translated = payload.get("translated") if isinstance(payload, dict) else []
    chunk_statuses = payload.get("chunkStatuses") if isinstance(payload, dict) else []
    segment_count = len(translated) if isinstance(translated, list) else 0
    chunks_done = sum(1 for item in chunk_statuses if isinstance(item, dict) and item.get("stage") == "done")
    chunks_failed = sum(1 for item in chunk_statuses if isinstance(item, dict) and item.get("stage") == "failed")
    chunks_total = len(chunk_statuses) if isinstance(chunk_statuses, list) else chunks_done
    recovered_status = "error" if chunks_failed else "done"
    recovered_stage = "failed" if chunks_failed else "translated"
    percent = 100 if not chunks_total or not chunks_failed else round((chunks_done / max(1, chunks_total)) * 100, 1)
    return {
        "id": job_id,
        "status": recovered_status,
        "stage": recovered_stage,
        "sourceUrl": "",
        "progress": {
            "status": recovered_status,
            "stage": recovered_stage,
            "percent": percent,
            "chunksDone": chunks_done,
            "chunksFailed": chunks_failed,
            "chunksTotal": chunks_total,
            "chunkStatuses": chunk_statuses if isinstance(chunk_statuses, list) else [],
        },
        "translation": {
            "vttPath": str(vtt_path),
            "jsonPath": str(json_path),
            "segmentCount": segment_count,
            "chunksDone": chunks_done,
            "chunksFailed": chunks_failed,
            "chunksTotal": chunks_total,
            "chunkStatuses": chunk_statuses if isinstance(chunk_statuses, list) else [],
            "recoveredFromDisk": True,
        },
        "finishedAt": time.time(),
    }


def cancel_job(job_id: str) -> None:
    with JOBS_LOCK:
        event = JOB_CANCEL_EVENTS.setdefault(job_id, Event())
        event.set()
        job = JOBS.get(job_id)
        if job:
            progress = dict(job.get("progress") or {})
            progress.update({"status": "cancelled", "stage": "cancelled"})
            job.update(
                {
                    "status": "cancelled",
                    "stage": "cancelled",
                    "error": "任务已停止。",
                    "progress": progress,
                    "updatedAt": time.time(),
                }
            )


def cleanup_job_audio_cache(job_id: str) -> bool:
    chunk_dir = CACHE_DIR / job_id
    removed = False
    if chunk_dir.is_dir():
        shutil.rmtree(chunk_dir, ignore_errors=True)
        removed = not chunk_dir.exists()
    for audio_file in CACHE_DIR.glob(f"{job_id}.*") if CACHE_DIR.exists() else []:
        if audio_file.is_file() and audio_file.suffix.lower() in AUDIO_CACHE_FILE_EXTENSIONS:
            try:
                audio_file.unlink()
                removed = True
            except OSError:
                logging.exception("failed to remove audio cache file job=%s path=%s", job_id, audio_file)
    if removed:
        logging.info("removed audio cache job=%s path=%s", job_id, chunk_dir)
        with JOBS_LOCK:
            if job_id in JOBS:
                JOBS[job_id]["audioCacheRemoved"] = True
    return removed


def clear_preload_audio_cache(job_id: str) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job and (
            job.get("status") in {"queued", "running"}
            or job.get("stage") in {"queued", "extracting", "extracting_translating", "asr_translation", "retry_failed"}
        ):
            raise RuntimeError("任务仍在运行中，不能清除它的音频缓存。请先停止或等待结束。")
    removed = cleanup_job_audio_cache(job_id)
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is not None:
            job["audioCacheRemoved"] = True
            job["updatedAt"] = time.time()
            return {"removed": removed, "job": job}
    return {"removed": removed, "job": None}


def cleanup_runtime_artifacts(
    *,
    active_job_ids: set[str] | None = None,
    max_age_seconds: int | None = None,
    max_bytes: int | None = None,
    audio_max_age_seconds: int | None = None,
    audio_max_bytes: int | None = None,
) -> dict[str, int]:
    active_job_ids = active_job_ids or set()
    max_age_seconds = (
        RUNTIME_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 if max_age_seconds is None else max(0, int(max_age_seconds))
    )
    max_bytes = RUNTIME_CACHE_MAX_BYTES if max_bytes is None else max(0, int(max_bytes))
    audio_max_age_seconds = (
        int(AUDIO_CACHE_MAX_AGE_HOURS * 60 * 60)
        if audio_max_age_seconds is None
        else max(0, int(audio_max_age_seconds))
    )
    audio_max_bytes = AUDIO_CACHE_MAX_BYTES if audio_max_bytes is None else max(0, int(audio_max_bytes))
    artifacts = runtime_artifacts(active_job_ids)
    now = time.time()
    removed = 0
    freed = 0

    def remove_artifact(artifact: dict[str, Any]) -> None:
        nonlocal removed, freed
        path = Path(str(artifact["path"]))
        try:
            if path.is_dir():
                shutil.rmtree(path)
            elif path.exists():
                path.unlink()
        except OSError:
            logging.exception("failed to remove runtime artifact path=%s", path)
            return
        removed += 1
        freed += int(artifact.get("size") or 0)

    for artifact in list(artifacts):
        age = now - float(artifact.get("mtime") or now)
        if max_age_seconds and age > max_age_seconds:
            remove_artifact(artifact)
        elif artifact.get("kind") == "audio" and audio_max_age_seconds and age > audio_max_age_seconds:
            remove_artifact(artifact)

    artifacts = runtime_artifacts(active_job_ids)
    audio_artifacts = [item for item in artifacts if item.get("kind") == "audio"]
    audio_size = sum(int(item.get("size") or 0) for item in audio_artifacts)
    if audio_max_bytes and audio_size > audio_max_bytes:
        for artifact in sorted(audio_artifacts, key=lambda item: float(item.get("mtime") or 0)):
            if audio_size <= audio_max_bytes:
                break
            remove_artifact(artifact)
            audio_size -= int(artifact.get("size") or 0)

    artifacts = runtime_artifacts(active_job_ids)
    total_size = sum(int(item.get("size") or 0) for item in artifacts)
    if max_bytes and total_size > max_bytes:
        for artifact in sorted(artifacts, key=lambda item: float(item.get("mtime") or 0)):
            if total_size <= max_bytes:
                break
            remove_artifact(artifact)
            total_size -= int(artifact.get("size") or 0)

    if removed:
        logging.info("runtime cache cleanup removed=%s freed=%s", removed, freed)
    return {"removed": removed, "freedBytes": freed}


def runtime_artifacts(active_job_ids: set[str]) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    for path in CACHE_DIR.iterdir() if CACHE_DIR.exists() else []:
        if path.is_dir():
            if path.name in active_job_ids:
                continue
            artifacts.append({"path": path, "size": path_size(path), "mtime": path_mtime(path), "jobId": path.name, "kind": "audio"})
            continue
        if path.is_file() and path.suffix.lower() in AUDIO_CACHE_FILE_EXTENSIONS and path.stem not in active_job_ids:
            artifacts.append({"path": path, "size": path.stat().st_size, "mtime": path.stat().st_mtime, "jobId": path.stem, "kind": "audio"})
    for path in OUTPUT_DIR.glob("*") if OUTPUT_DIR.exists() else []:
        if not path.is_file() or path.suffix.lower() not in {".json", ".vtt"}:
            continue
        job_id = path.stem
        if job_id in active_job_ids:
            continue
        artifacts.append({"path": path, "size": path.stat().st_size, "mtime": path.stat().st_mtime, "jobId": job_id, "kind": "subtitle"})
    for path in LOG_DIR.glob("preload-*.log") if LOG_DIR.exists() else []:
        if not path.is_file():
            continue
        artifacts.append({"path": path, "size": path.stat().st_size, "mtime": path.stat().st_mtime, "jobId": "", "kind": "log"})
    return artifacts


def protected_runtime_job_ids(extra_job_ids: set[str] | None = None) -> set[str]:
    protected = set(extra_job_ids or set())
    with JOBS_LOCK:
        running = {
            job_id
            for job_id, job in JOBS.items()
            if job.get("status") in {"queued", "running"} or job.get("stage") in {"queued", "extracting", "translating", "retry_failed"}
        }
        failed_jobs = [
            (
                job_id,
                float(job.get("updatedAt") or job.get("finishedAt") or job.get("createdAt") or 0),
            )
            for job_id, job in JOBS.items()
            if job.get("status") == "error" or job.get("stage") == "failed"
        ]
    protected.update(running)
    for job_id, _timestamp in sorted(failed_jobs, key=lambda item: item[1], reverse=True)[: max(0, RUNTIME_CACHE_KEEP_FAILED_JOBS)]:
        protected.add(job_id)
    return protected


def path_size(path: Path) -> int:
    if path.is_file():
        return path.stat().st_size
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total


def path_mtime(path: Path) -> float:
    if path.is_file():
        return path.stat().st_mtime
    mtimes = [item.stat().st_mtime for item in path.rglob("*") if item.exists()]
    return max(mtimes) if mtimes else path.stat().st_mtime


def job_cancelled(job_id: str) -> bool:
    with JOBS_LOCK:
        return JOB_CANCEL_EVENTS.get(job_id, Event()).is_set()


def raise_if_cancelled(job_id: str) -> None:
    if job_cancelled(job_id):
        raise JobCancelled("任务已停止。")


def start_retry_failed_job_chunks(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        job = recover_translated_job_from_disk(job_id)
    if not job:
        raise RuntimeError("预加载任务不存在，无法重试。")
    if job.get("status") == "running" and job.get("stage") == "retry_failed":
        return job
    if job.get("status") == "running":
        raise RuntimeError("当前任务仍在运行，不能重试失败分段。")
    progress = dict(job.get("progress") or {})
    progress.update({"status": "running", "stage": "retry_failed"})
    job.update({"status": "running", "stage": "retry_failed", "progress": progress, "updatedAt": time.time()})
    with JOBS_LOCK:
        JOB_CANCEL_EVENTS[job_id] = Event()
        JOBS[job_id] = job
    Thread(target=run_retry_failed_job_chunks, args=(job_id, payload), daemon=True).start()
    return job


def run_retry_failed_job_chunks(job_id: str, payload: dict[str, Any]) -> None:
    try:
        retry_failed_job_chunks(job_id, payload)
    except Exception as exc:  # noqa: BLE001 - surfaced through job status.
        logging.exception("retry failed chunks failed job=%s", job_id)
        with JOBS_LOCK:
            job = JOBS.get(job_id, {"id": job_id})
            progress = dict(job.get("progress") or {})
            progress.update({"status": "error", "stage": "failed"})
            job.update(
                {
                    "status": "error",
                    "stage": "failed",
                    "error": str(exc),
                    "progress": progress,
                    "finishedAt": time.time(),
                }
            )
            JOBS[job_id] = job


def start_retry_translation_job_chunks(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        job = recover_translated_job_from_disk(job_id)
    if not job:
        raise RuntimeError("预加载任务不存在，无法重翻译字幕。")
    if job.get("status") == "running" and job.get("stage") == "retry_translation":
        return job
    if job.get("status") == "running":
        raise RuntimeError("当前任务仍在运行，不能重翻译字幕。")
    progress = dict(job.get("progress") or {})
    progress.update({"status": "running", "stage": "retry_translation"})
    job.update({"status": "running", "stage": "retry_translation", "progress": progress, "updatedAt": time.time()})
    with JOBS_LOCK:
        JOB_CANCEL_EVENTS[job_id] = Event()
        JOBS[job_id] = job
    Thread(target=run_retry_translation_job_chunks, args=(job_id, payload), daemon=True).start()
    return job


def run_retry_translation_job_chunks(job_id: str, payload: dict[str, Any]) -> None:
    try:
        retry_translation_job_chunks(job_id, payload)
    except Exception as exc:  # noqa: BLE001 - surfaced through job status.
        logging.exception("retry translation chunks failed job=%s", job_id)
        with JOBS_LOCK:
            job = JOBS.get(job_id, {"id": job_id})
            progress = dict(job.get("progress") or {})
            progress.update({"status": "error", "stage": "failed"})
            job.update(
                {
                    "status": "error",
                    "stage": "failed",
                    "error": str(exc),
                    "progress": progress,
                    "finishedAt": time.time(),
                }
            )
            JOBS[job_id] = job


def retry_translation_job_chunks(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        job = recover_translated_job_from_disk(job_id)
    if not job:
        raise RuntimeError("预加载任务不存在，无法重翻译字幕。")

    translation = job.get("translation") if isinstance(job.get("translation"), dict) else {}
    json_path = Path(str(translation.get("jsonPath") or OUTPUT_DIR / f"{job_id}.json"))
    if not json_path.exists():
        raise RuntimeError("没有找到这个任务的字幕缓存，无法只重翻译字幕。")
    try:
        cached = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("字幕缓存已损坏，无法只重翻译字幕。") from exc

    candidate = payload.get("candidate") if isinstance(payload.get("candidate"), dict) else {}
    model_config = payload.get("modelConfig") if isinstance(payload.get("modelConfig"), dict) else {}
    translation_override = model_config.get("translation") if isinstance(model_config.get("translation"), dict) else None
    translation_config = load_translation_config(load_combined_env(), translation_override)
    if not translation_config:
        raise RuntimeError("缺少翻译模型配置：请在插件侧边栏填写翻译配置档。")
    target_language = str(model_config.get("targetLanguage") or os.getenv("FUGUANG_TARGET_LANGUAGE", "zh-CN"))
    chunk_seconds = configured_chunk_seconds(candidate, model_config, fallback=original_job_chunk_seconds(job))
    context_card = dict(job.get("translationContext") or {})
    if not context_card:
        context_card = build_translation_context_card(
            metadata={**(payload.get("metadata") or {}), **_candidate_metadata(candidate)},
            source_language=payload.get("sourceLanguage") or candidate.get("sourceLanguage") or "auto",
        )

    source_by_index = group_segments_by_chunk(cached.get("source", []), chunk_seconds)
    if not source_by_index:
        raise RuntimeError("没有可复用的 ASR 原文，不能只重翻译字幕。")
    translated_by_index = group_segments_by_chunk(cached.get("translated", []), chunk_seconds)
    requested_indices = payload.get("chunkIndexes") if isinstance(payload.get("chunkIndexes"), list) else []
    requested = {int(index) for index in requested_indices if _coerce_number(index) is not None}
    target_indices = sorted(index for index in source_by_index if not requested or index in requested)
    if not target_indices:
        raise RuntimeError("没有匹配到可重翻译的分段。")

    old_statuses = [item for item in cached.get("chunkStatuses", []) if isinstance(item, dict)]
    total = max(max(source_by_index, default=0) + 1, len(old_statuses))
    statuses = [ChunkStatus(index=index) for index in range(total)]
    for item in old_statuses:
        index = int(item.get("index", -1))
        if 0 <= index < len(statuses):
            statuses[index] = ChunkStatus(
                index=index,
                stage=str(item.get("stage") or "queued"),
                attempts=int(item.get("attempts") or 0),
                error=str(item.get("error") or ""),
                source_segments=int(item.get("source_segments") or item.get("sourceSegments") or 0),
                translated_segments=int(item.get("translated_segments") or item.get("translatedSegments") or 0),
            )
    started_at = time.time()

    def persist(status: str = "running") -> dict[str, Any]:
        source_segments = [segment for index in sorted(source_by_index) for segment in source_by_index[index]]
        translated_segments = [segment for index in sorted(translated_by_index) for segment in translated_by_index[index]]
        failed = [item for item in statuses if item.stage == "failed"]
        done = sum(1 for item in statuses if item.stage == "done")
        outputs = write_pipeline_outputs(
            job_id=job_id,
            output_dir=OUTPUT_DIR,
            translated_segments=translated_segments,
            source_segments=source_segments,
            chunk_statuses=statuses,
        )
        next_translation = {
            **outputs,
            "segmentCount": len(translated_segments),
            "chunksTotal": len(statuses),
            "chunksDone": done,
            "chunksFailed": len(failed),
            "chunksAsr": 0,
            "chunksTranslating": sum(1 for item in statuses if item.stage == "translation"),
            "chunkStatuses": [asdict(item) for item in statuses],
            "failed": bool(failed),
            "retryingTranslationOnly": status == "running",
            "asrWorkers": worker_count(model_config.get("asrWorkers") or os.getenv("FUGUANG_ASR_WORKERS", "1"), fallback=1, upper=8),
            "translationWorkers": worker_count(
                model_config.get("workers") or os.getenv("FUGUANG_TRANSLATION_WORKERS", str(DEFAULT_MAX_WORKERS)),
                fallback=DEFAULT_MAX_WORKERS,
                upper=6,
            ),
            "percent": round(done / max(1, len(statuses)) * 100, 1),
            "elapsedSeconds": round(time.time() - started_at, 2),
        }
        next_stage = "retry_translation" if status == "running" else ("failed" if failed else "translated")
        next_status = "error" if failed and status != "running" else status
        extraction = dict((job.get("progress") or {}).get("extraction") or {"status": "done", "stage": "audio_ready", "percent": 100.0})
        next_progress = {
            **next_translation,
            "status": next_status,
            "stage": next_stage,
            "extractPercent": _coerce_number(extraction.get("percent")) or 100.0,
            "translationPercent": next_translation["percent"],
            "extraction": extraction,
            "translation": next_translation,
        }
        next_job = {
            **job,
            "id": job_id,
            "status": next_status,
            "stage": next_stage,
            "progress": next_progress,
            "translation": next_translation,
            "updatedAt": time.time(),
        }
        with JOBS_LOCK:
            JOBS[job_id] = next_job
        return next_job

    persist()
    for index in target_indices:
        status = statuses[index]
        source_segments = source_by_index.get(index, [])
        if not source_segments:
            status.stage = "failed"
            status.error = "这个分段没有可复用的 ASR 原文，不能只重翻译。"
            persist()
            continue
        status.stage = "translation"
        status.error = ""
        status.source_segments = len(source_segments)
        persist()
        try:
            translated_segments = retry_step(
                lambda: translate_segments(
                    title=str(candidate.get("title") or ""),
                    segments=source_segments,
                    config=translation_config,
                    context_card=context_card,
                    target_language=target_language,
                ),
                attempts=2,
                label=f"第 {index + 1} 个音频分段翻译",
                on_attempt=lambda attempt, item=status: setattr(item, "attempts", max(item.attempts, attempt)) or persist(),
                on_error=lambda exc, item=status: setattr(item, "error", str(exc)) or persist(),
            )
            translated_by_index[index] = translated_segments
            status.translated_segments = len(translated_segments)
            status.stage = "done"
            status.error = ""
            persist()
        except Exception as exc:  # noqa: BLE001 - keep prior translated content visible.
            status.stage = "failed"
            status.error = f"重翻译失败，已保留已有字幕：{exc}"
            persist()
    final_job = persist(status="error" if [item for item in statuses if item.stage == "failed"] else "done")
    cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids({job_id}))
    return final_job


def retry_failed_job_chunks(job_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        job = recover_translated_job_from_disk(job_id)
    if not job:
        raise RuntimeError("预加载任务不存在，无法重试。")

    translation = job.get("translation") if isinstance(job.get("translation"), dict) else {}
    json_path = Path(str(translation.get("jsonPath") or OUTPUT_DIR / f"{job_id}.json"))
    if not json_path.exists():
        raise RuntimeError("没有找到这个任务的字幕缓存，无法只重试失败分段。")
    try:
        cached = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("字幕缓存已损坏，无法只重试失败分段。") from exc

    old_statuses = [item for item in cached.get("chunkStatuses", []) if isinstance(item, dict)]
    requested_indices = payload.get("chunkIndexes") if isinstance(payload.get("chunkIndexes"), list) else []
    requested = {int(index) for index in requested_indices if _coerce_number(index) is not None}
    failed_indices = [
        int(item.get("index", -1))
        for item in old_statuses
        if item.get("stage") == "failed" and (not requested or int(item.get("index", -1)) in requested)
    ]
    failed_indices = [index for index in failed_indices if index >= 0]
    if not failed_indices:
        raise RuntimeError("没有失败分段可重试。")

    candidate = payload.get("candidate") if isinstance(payload.get("candidate"), dict) else {}
    model_config = payload.get("modelConfig") if isinstance(payload.get("modelConfig"), dict) else {}
    asr_config, translation_config = load_pipeline_config(model_config)
    target_language = str(model_config.get("targetLanguage") or os.getenv("FUGUANG_TARGET_LANGUAGE", "zh-CN"))
    chunk_seconds = original_job_chunk_seconds(job, fallback=configured_chunk_seconds(candidate, model_config))
    context_card = dict(job.get("translationContext") or {})
    if not context_card:
        context_card = build_translation_context_card(
            metadata={**(payload.get("metadata") or {}), **_candidate_metadata(candidate)},
            source_language=payload.get("sourceLanguage") or candidate.get("sourceLanguage") or "auto",
        )

    chunk_dir = CACHE_DIR / job_id
    audio_chunks = {int(chunk.get("index") or 0): chunk for chunk in list_audio_chunks(chunk_dir)}
    source_by_index = group_segments_by_chunk(cached.get("source", []), chunk_seconds)
    translated_by_index = group_segments_by_chunk(cached.get("translated", []), chunk_seconds)
    statuses = [ChunkStatus(index=index) for index in range(max(max(failed_indices, default=0) + 1, len(old_statuses)))]
    for item in old_statuses:
        index = int(item.get("index", -1))
        if 0 <= index < len(statuses):
            statuses[index] = ChunkStatus(
                index=index,
                stage=str(item.get("stage") or "queued"),
                attempts=int(item.get("attempts") or 0),
                error=str(item.get("error") or ""),
                source_segments=int(item.get("source_segments") or item.get("sourceSegments") or 0),
                translated_segments=int(item.get("translated_segments") or item.get("translatedSegments") or 0),
            )

    started_at = time.time()

    def persist(status: str = "running") -> dict[str, Any]:
        source_segments = [segment for index in sorted(source_by_index) for segment in source_by_index[index]]
        translated_segments = [segment for index in sorted(translated_by_index) for segment in translated_by_index[index]]
        failed = [item for item in statuses if item.stage == "failed"]
        done = sum(1 for item in statuses if item.stage == "done")
        total = len(statuses)
        extraction = dict((job.get("progress") or {}).get("extraction") or {})
        if not extraction:
            extraction = {"status": "done", "stage": "audio_ready", "percent": 100.0}
        outputs = write_pipeline_outputs(
            job_id=job_id,
            output_dir=OUTPUT_DIR,
            translated_segments=translated_segments,
            source_segments=source_segments,
            chunk_statuses=statuses,
        )
        next_translation = {
            **outputs,
            "segmentCount": len(translated_segments),
            "chunksTotal": total,
            "chunksDone": done,
            "chunksFailed": len(failed),
            "chunksAsr": sum(1 for item in statuses if item.stage == "asr"),
            "chunksTranslating": sum(1 for item in statuses if item.stage == "translation"),
            "chunkStatuses": [asdict(item) for item in statuses],
            "failed": bool(failed),
            "retryingFailedOnly": status == "running",
            "asrWorkers": worker_count(model_config.get("asrWorkers") or os.getenv("FUGUANG_ASR_WORKERS", "1"), fallback=1, upper=8),
            "translationWorkers": worker_count(
                model_config.get("workers") or os.getenv("FUGUANG_TRANSLATION_WORKERS", str(DEFAULT_MAX_WORKERS)),
                fallback=DEFAULT_MAX_WORKERS,
                upper=6,
            ),
            "percent": round(done / max(1, total) * 100, 1),
            "elapsedSeconds": round(time.time() - started_at, 2),
        }
        next_stage = "retry_failed" if status == "running" else ("failed" if failed else "translated")
        next_status = "error" if failed and status != "running" else status
        next_progress = {
            **next_translation,
            "status": next_status,
            "stage": next_stage,
            "extractPercent": _coerce_number(extraction.get("percent")) or 100.0,
            "translationPercent": next_translation["percent"],
            "extraction": extraction,
            "translation": next_translation,
        }
        next_job = {
            **job,
            "id": job_id,
            "status": next_status,
            "stage": next_stage,
            "progress": next_progress,
            "translation": next_translation,
            "updatedAt": time.time(),
        }
        with JOBS_LOCK:
            JOBS[job_id] = next_job
        return next_job

    def record_retry_attempt(status: ChunkStatus, attempt: int) -> None:
        status.attempts = max(status.attempts, attempt)
        persist()

    def record_retry_error(status: ChunkStatus, error: Exception) -> None:
        status.error = str(error)
        persist()

    persist()
    for index in failed_indices:
        status = statuses[index]
        status.attempts = 0
        status.error = ""
        try:
            if not source_by_index.get(index):
                chunk = audio_chunks.get(index)
                if not chunk:
                    raise RuntimeError("这个失败分段没有可复用的音频缓存。")
                status.stage = "asr"
                persist()
                source_segments = retry_step(
                    lambda: transcribe_audio_chunk(
                        Path(str(chunk["path"])),
                        asr_config,
                        str(candidate.get("sourceLanguage") or payload.get("sourceLanguage") or "auto"),
                        float(index * chunk_seconds),
                    ),
                    attempts=2,
                    label=f"第 {index + 1} 个音频分段识别",
                    on_attempt=lambda attempt, item=status: record_retry_attempt(item, attempt),
                    on_error=lambda exc, item=status: record_retry_error(item, exc),
                )
                source_by_index[index] = source_segments
                status.source_segments = len(source_segments)
            status.stage = "translation"
            persist()
            translated_segments = retry_step(
                lambda: translate_segments(
                    title=str(candidate.get("title") or ""),
                    segments=source_by_index[index],
                    config=translation_config,
                    context_card=context_card,
                    target_language=target_language,
                ),
                attempts=2,
                label=f"第 {index + 1} 个音频分段翻译",
                on_attempt=lambda attempt, item=status: record_retry_attempt(item, attempt),
                on_error=lambda exc, item=status: record_retry_error(item, exc),
            )
            translated_by_index[index] = translated_segments
            status.translated_segments = len(translated_segments)
            status.stage = "done"
            status.error = ""
            persist()
        except Exception as exc:  # noqa: BLE001 - keep retry result visible per chunk.
            status.stage = "failed"
            status.error = str(exc)
            persist()
    failed = [item for item in statuses if item.stage == "failed"]
    final_job = persist(status="error" if failed else "done")
    if not failed:
        cleanup_job_audio_cache(job_id)
    cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids({job_id}))
    return final_job


def group_segments_by_chunk(raw_segments: object, chunk_seconds: int) -> dict[int, list[TranscriptSegment]]:
    output: dict[int, list[TranscriptSegment]] = {}
    if not isinstance(raw_segments, list):
        return output
    for item in raw_segments:
        if not isinstance(item, dict):
            continue
        start = _coerce_number(item.get("start"))
        end = _coerce_number(item.get("end"))
        text = str(item.get("text") or "").strip()
        if start is None or end is None or not text:
            continue
        index = max(0, int(start // max(1, chunk_seconds)))
        output.setdefault(index, []).append(TranscriptSegment(start=start, end=end, text=text))
    return output


def run_preload_job(
    job_id: str,
    candidate: dict[str, Any],
    max_seconds: int,
    model_config: dict[str, Any] | None = None,
) -> None:
    with JOBS_LOCK:
        JOB_CANCEL_EVENTS[job_id] = Event()
        JOBS[job_id].update(
            {
                "status": "running",
                "stage": "extracting",
                "startedAt": time.time(),
            }
        )

    try:
        model_config = model_config or {}
        asr_config, translation_config = load_pipeline_config(model_config)
        context_card = _job_context_card(job_id)
        chunk_seconds = configured_chunk_seconds(candidate, model_config)
        target_language = str(model_config.get("targetLanguage") or os.getenv("FUGUANG_TARGET_LANGUAGE", "zh-CN"))
        max_asr_workers = worker_count(
            model_config.get("asrWorkers") or os.getenv("FUGUANG_ASR_WORKERS", "1"),
            fallback=1,
            upper=8,
        )
        max_translation_workers = worker_count(
            model_config.get("workers") or os.getenv("FUGUANG_TRANSLATION_WORKERS", str(DEFAULT_MAX_WORKERS)),
            fallback=DEFAULT_MAX_WORKERS,
            upper=6,
        )
        translation_started_at = time.time()
        extraction_progress: dict[str, Any] = {}
        chunk_statuses: list[ChunkStatus] = []
        asr_futures: dict[Future, int] = {}
        translation_futures: dict[Future, int] = {}
        submitted_indices: set[int] = set()
        source_by_index: dict[int, list[TranscriptSegment]] = {}
        translated_by_index: dict[int, list[TranscriptSegment]] = {}
        partial_outputs: dict[str, Any] = {}

        def ensure_status(index: int) -> ChunkStatus:
            while len(chunk_statuses) <= index:
                chunk_statuses.append(ChunkStatus(index=len(chunk_statuses)))
            return chunk_statuses[index]

        def estimate_chunks_total() -> int:
            total_seconds = _coerce_number(extraction_progress.get("totalSeconds"))
            estimated = math.ceil(total_seconds / max(1, chunk_seconds)) if total_seconds else 0
            return max(estimated, len(chunk_statuses), len(submitted_indices), 1)

        def translation_snapshot() -> dict[str, Any]:
            total = estimate_chunks_total()
            completed = sum(1 for status in chunk_statuses if status.stage == "done")
            failed = sum(1 for status in chunk_statuses if status.stage == "failed")
            return {
                **partial_outputs,
                "status": "running",
                "stage": "asr_translation",
                "chunksTotal": total,
                "chunksSubmitted": len(submitted_indices),
                "chunksDone": completed,
                "chunksFailed": failed,
                "chunksAsr": sum(1 for status in chunk_statuses if status.stage == "asr"),
                "chunksTranslating": sum(1 for status in chunk_statuses if status.stage == "translation"),
                "asrWorkers": max_asr_workers,
                "translationWorkers": max_translation_workers,
                "percent": round(completed / max(1, total) * 100, 1),
                "elapsedSeconds": round(time.time() - translation_started_at, 2),
                "chunkStatuses": [asdict(status) for status in chunk_statuses],
            }

        def merged_progress(stage: str) -> dict[str, Any]:
            extract = dict(extraction_progress)
            translation = translation_snapshot()
            extract_percent = _coerce_number(extract.get("percent"))
            translation_percent = _coerce_number(translation.get("percent")) or 0
            if extract.get("status") == "done":
                overall = round(50 + translation_percent * 0.5, 1)
            elif extract_percent is not None:
                overall = round(extract_percent * 0.5 + translation_percent * 0.5, 1)
            else:
                overall = translation_percent
            return {
                **extract,
                "status": "running",
                "stage": stage,
                "percent": min(99.0, overall),
                "extractPercent": extract_percent,
                "translationPercent": translation_percent,
                "chunksTotal": translation["chunksTotal"],
                "chunksSubmitted": translation["chunksSubmitted"],
                "chunksDone": translation["chunksDone"],
                "chunksFailed": translation["chunksFailed"],
                "chunksAsr": translation["chunksAsr"],
                "chunksTranslating": translation["chunksTranslating"],
                "asrWorkers": translation["asrWorkers"],
                "translationWorkers": translation["translationWorkers"],
                "chunkStatuses": translation["chunkStatuses"],
                "extraction": extract,
                "translation": translation,
            }

        def current_stage() -> str:
            if submitted_indices and extraction_progress.get("status") != "done":
                return "extracting_translating"
            if submitted_indices:
                return "asr_translation"
            return extraction_progress.get("stage") or "extracting"

        def report_job_progress() -> None:
            stage = current_stage()
            progress = merged_progress(stage)
            with JOBS_LOCK:
                if job_id not in JOBS:
                    return
                JOBS[job_id].update(
                    {
                        "status": "running",
                        "stage": stage,
                        "progress": progress,
                        "translation": progress["translation"],
                        "updatedAt": time.time(),
                    }
                )

        def write_partial_outputs() -> None:
            nonlocal partial_outputs
            if not translated_by_index:
                return
            source_segments = [segment for chunk_index in sorted(source_by_index) for segment in source_by_index[chunk_index]]
            translated_segments = [
                segment for chunk_index in sorted(translated_by_index) for segment in translated_by_index[chunk_index]
            ]
            partial_outputs = {
                **write_pipeline_outputs(
                    job_id=job_id,
                    output_dir=OUTPUT_DIR,
                    translated_segments=translated_segments,
                    source_segments=source_segments,
                    chunk_statuses=chunk_statuses,
                ),
                "partial": True,
            }

        def record_attempt(status: ChunkStatus, attempt: int) -> None:
            status.attempts = max(status.attempts, attempt)
            report_job_progress()

        def record_error(status: ChunkStatus, error: Exception) -> None:
            status.error = str(error)
            report_job_progress()

        def run_asr_chunk(index: int, chunk: dict[str, Any]) -> tuple[int, list[TranscriptSegment]]:
            raise_if_cancelled(job_id)
            status = ensure_status(index)
            status.stage = "asr"
            status.error = ""
            report_job_progress()
            offset = float(index * chunk_seconds)
            audio_path = Path(str(chunk["path"]))
            source_segments = retry_step(
                lambda: transcribe_audio_chunk(
                    audio_path,
                    asr_config,
                    str(candidate.get("sourceLanguage") or "auto"),
                    offset,
                ),
                attempts=2,
                label=f"第 {index + 1} 个音频分段识别",
                on_attempt=lambda attempt: record_attempt(status, attempt),
                on_error=lambda exc: record_error(status, exc),
            )
            status.source_segments = len(source_segments)
            raise_if_cancelled(job_id)
            return index, source_segments

        def run_translation_chunk(index: int, source_segments: list[TranscriptSegment]) -> tuple[int, list[TranscriptSegment]]:
            raise_if_cancelled(job_id)
            status = ensure_status(index)
            status.stage = "translation"
            status.error = ""
            report_job_progress()
            translated_segments = retry_step(
                lambda: translate_segments(
                    title=str(candidate.get("title") or ""),
                    segments=source_segments,
                    config=translation_config,
                    context_card=context_card,
                    target_language=target_language,
                ),
                attempts=2,
                label=f"第 {index + 1} 个音频分段翻译",
                on_attempt=lambda attempt: record_attempt(status, attempt),
                on_error=lambda exc: record_error(status, exc),
            )
            status.translated_segments = len(translated_segments)
            status.stage = "done"
            status.error = ""
            report_job_progress()
            raise_if_cancelled(job_id)
            return index, translated_segments

        def collect_finished(block: bool = False) -> None:
            raise_if_cancelled(job_id)
            while True:
                pending = list(asr_futures) + list(translation_futures)
                if not pending:
                    return
                if block:
                    finished, _ = wait(pending, return_when=FIRST_COMPLETED)
                else:
                    finished = {future for future in pending if future.done()}
                    if not finished:
                        return
                for future in finished:
                    raise_if_cancelled(job_id)
                    if future in asr_futures:
                        index = asr_futures.pop(future)
                        try:
                            chunk_index, source_segments = future.result()
                        except Exception as exc:  # noqa: BLE001 - chunk errors are shown in the job status.
                            status = ensure_status(index)
                            status.stage = "failed"
                            status.error = str(exc)
                            logging.exception("asr chunk failed job=%s chunk=%s", job_id, index)
                        else:
                            source_by_index[chunk_index] = source_segments
                            status = ensure_status(chunk_index)
                            status.stage = "translation"
                            translation_futures[
                                translation_executor.submit(run_translation_chunk, chunk_index, source_segments)
                            ] = chunk_index
                    elif future in translation_futures:
                        index = translation_futures.pop(future)
                        try:
                            chunk_index, translated_segments = future.result()
                        except Exception as exc:  # noqa: BLE001 - chunk errors are shown in the job status.
                            status = ensure_status(index)
                            status.stage = "failed"
                            status.error = str(exc)
                            logging.exception("translation chunk failed job=%s chunk=%s", job_id, index)
                        else:
                            translated_by_index[chunk_index] = translated_segments
                            write_partial_outputs()
                    report_job_progress()
                if not block:
                    return

        def submit_ready_chunks(chunks: list[dict[str, Any]], *, extraction_done: bool, asr_executor: ThreadPoolExecutor) -> None:
            raise_if_cancelled(job_id)
            for chunk in translation_ready_chunks(chunks, extraction_done=extraction_done):
                index = int(chunk.get("index") or 0)
                if index in submitted_indices:
                    continue
                ensure_status(index)
                submitted_indices.add(index)
                asr_futures[asr_executor.submit(run_asr_chunk, index, chunk)] = index
            if submitted_indices:
                report_job_progress()

        def update_extraction_progress(progress: dict[str, Any]) -> None:
            raise_if_cancelled(job_id)
            nonlocal extraction_progress
            extraction_progress = dict(progress)
            submit_ready_chunks(
                progress.get("chunks") or [],
                extraction_done=progress.get("status") == "done",
                asr_executor=asr_executor,
            )
            collect_finished(block=False)
            report_job_progress()

        with ThreadPoolExecutor(max_workers=max_asr_workers) as asr_executor, ThreadPoolExecutor(
            max_workers=max_translation_workers
        ) as translation_executor:
            result = extract_audio_sample(
                candidate,
                job_id,
                max_seconds=max_seconds,
                progress_callback=update_extraction_progress,
                should_cancel=lambda: job_cancelled(job_id),
            )
            raise_if_cancelled(job_id)
            extraction_progress = {
                **(result.get("progress") or {}),
                "chunks": result.get("chunks") or [],
                "chunkDir": result.get("chunkDir"),
            }
            with JOBS_LOCK:
                JOBS[job_id].update({"audio": result, "result": result})
            submit_ready_chunks(result.get("chunks") or [], extraction_done=True, asr_executor=asr_executor)
            collect_finished(block=True)

        failed = [status for status in chunk_statuses if status.stage == "failed"]
        source_segments = [segment for index in sorted(source_by_index) for segment in source_by_index[index]]
        translated_segments = [segment for index in sorted(translated_by_index) for segment in translated_by_index[index]]
        translation = {
            **write_pipeline_outputs(
                job_id=job_id,
                output_dir=OUTPUT_DIR,
                translated_segments=translated_segments,
                source_segments=source_segments,
                chunk_statuses=chunk_statuses,
            ),
            "chunksTotal": len(chunk_statuses),
            "chunksDone": len(chunk_statuses) - len(failed),
            "chunksFailed": len(failed),
            "chunksAsr": 0,
            "chunksTranslating": 0,
            "asrWorkers": max_asr_workers,
            "translationWorkers": max_translation_workers,
            "percent": round(((len(chunk_statuses) - len(failed)) / max(1, len(chunk_statuses))) * 100, 1),
            "status": "error" if failed else "done",
            "stage": "failed" if failed else "translated",
            "chunkStatuses": [asdict(status) for status in chunk_statuses],
            "failed": bool(failed),
            "elapsedSeconds": round(time.time() - translation_started_at, 2),
        }
        if failed:
            extraction = dict(extraction_progress)
            if extraction.get("status") == "done":
                extraction["percent"] = 100.0
            translation_percent = round((translation["chunksDone"] / max(1, translation["chunksTotal"])) * 100, 1)
            failure_progress = {
                **translation,
                "status": "error",
                "stage": "failed",
                "percent": round(((_coerce_number(extraction.get("percent")) or 100.0) * 0.5) + translation_percent * 0.5, 1),
                "extractPercent": _coerce_number(extraction.get("percent")) or 100.0,
                "translationPercent": translation_percent,
                "extraction": extraction,
                "translation": translation,
            }
            with JOBS_LOCK:
                JOBS[job_id].update({"translation": translation, "progress": failure_progress})
            raise RuntimeError("部分分段识别或翻译失败，已保留已完成字幕，可重试失败分段。")
    except JobCancelled as exc:
        with JOBS_LOCK:
            progress = dict(JOBS.get(job_id, {}).get("progress") or {})
            progress.update({"status": "cancelled", "stage": "cancelled"})
            JOBS[job_id].update(
                {
                    "status": "cancelled",
                    "stage": "cancelled",
                    "error": str(exc),
                    "progress": progress,
                    "finishedAt": time.time(),
                }
            )
        cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids({job_id}))
        return
    except Exception as exc:  # noqa: BLE001 - job errors are returned to the extension UI.
        logging.exception("preload failed job=%s", job_id)
        with JOBS_LOCK:
            JOBS[job_id].update(
                {
                    "status": "error",
                    "stage": "failed",
                    "error": str(exc),
                    "finishedAt": time.time(),
                }
        )
        cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids({job_id}))
        return
    with JOBS_LOCK:
        extraction = dict(extraction_progress)
        if extraction.get("status") == "done":
            extraction["percent"] = 100.0
        final_progress = {
            **translation,
            "status": "done",
            "stage": "translated",
            "percent": 100.0,
            "extractPercent": _coerce_number(extraction.get("percent")) or 100.0,
            "translationPercent": 100.0,
            "extraction": extraction,
            "translation": translation,
        }
        JOBS[job_id].update(
            {
                "status": "done",
                "stage": "translated",
                "progress": final_progress,
                "result": result,
                "translation": translation,
                "finishedAt": time.time(),
            }
        )
    cleanup_job_audio_cache(job_id)
    cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids({job_id}))


def update_translation_progress(job_id: str):
    def update(progress: dict[str, Any]) -> None:
        with JOBS_LOCK:
            if job_id not in JOBS:
                return
            JOBS[job_id].update(
                {
                    "status": progress.get("status") or "running",
                    "stage": progress.get("stage") or "translating",
                    "translation": progress,
                    "progress": progress,
                    "updatedAt": time.time(),
                }
            )

    return update


async def async_main() -> None:
    config = HelperConfig.from_env()
    cleanup_runtime_artifacts(active_job_ids=protected_runtime_job_ids())
    try:
        httpd = start_http_server(config)
    except OSError as exc:
        raise SystemExit(
            f"浮光译影本机服务无法监听任务端口 {config.http_host}:{config.http_port}：{exc}"
        ) from exc
    logging.info("helper http listening on %s:%s", config.http_host, config.http_port)
    try:
        try:
            async with websockets.serve(
                realtime_handler,
                config.ws_host,
                config.ws_port,
                max_size=8 * 1024 * 1024,
            ):
                logging.info("helper websocket listening on %s:%s", config.ws_host, config.ws_port)
                print_startup_banner(config)
                await asyncio.Future()
        except OSError as exc:
            raise SystemExit(
                f"浮光译影本机服务无法监听实时端口 {config.ws_host}:{config.ws_port}：{exc}"
            ) from exc
    finally:
        httpd.shutdown()


def print_startup_banner(config: HelperConfig) -> None:
    print(
        "\n".join(
            [
                "浮光译影本机服务已启动。",
                f"任务服务：http://{config.http_host}:{config.http_port}",
                f"实时连接：ws://{config.ws_host}:{config.ws_port}/realtime",
                f"日志目录：{LOG_DIR}",
            ]
        ),
        flush=True,
    )


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
