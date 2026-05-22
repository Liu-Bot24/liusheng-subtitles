from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class PreloadPipelineTests(unittest.TestCase):
    def test_default_chunk_length_preserves_translation_context(self) -> None:
        from fuguang_helper.preload import DEFAULT_CHUNK_SECONDS

        self.assertGreaterEqual(DEFAULT_CHUNK_SECONDS, 900)

    def test_hls_command_uses_segmented_64k_asr_audio(self) -> None:
        from fuguang_helper.preload import build_chunked_audio_command

        command = build_chunked_audio_command(
            ffmpeg="/usr/bin/ffmpeg",
            candidate={
                "url": "https://example.test/video.m3u8",
                "kind": "hls",
                "ext": "m3u8",
                "requestHeaders": {"user-agent": "TestAgent"},
            },
            source_url="https://example.test/video.m3u8",
            chunk_pattern="/tmp/fuguang/chunk-%05d.mp3",
            max_seconds=0,
            chunk_seconds=120,
        )

        self.assertIn("-allowed_segment_extensions", command)
        self.assertIn("-extension_picky", command)
        self.assertEqual(command[command.index("-b:a") + 1], "64k")
        self.assertEqual(command[command.index("-segment_time") + 1], "120")
        self.assertEqual(command[command.index("-f") + 1], "segment")
        self.assertEqual(command[-1], "/tmp/fuguang/chunk-%05d.mp3")

    def test_progress_snapshot_reports_ready_chunks_without_waiting_for_completion(self) -> None:
        from fuguang_helper.preload import build_progress_snapshot

        snapshot = build_progress_snapshot(
            status="running",
            stage="extracting",
            processed_seconds=245.2,
            total_seconds=600,
            chunk_seconds=120,
            chunks_ready=2,
            started_at=100.0,
            now=115.5,
        )

        self.assertEqual(snapshot["status"], "running")
        self.assertEqual(snapshot["stage"], "extracting")
        self.assertEqual(snapshot["chunksReady"], 2)
        self.assertEqual(snapshot["readySeconds"], 240)
        self.assertAlmostEqual(snapshot["processedSeconds"], 245.2)
        self.assertEqual(snapshot["percent"], 40.9)
        self.assertEqual(snapshot["elapsedSeconds"], 15.5)

    def test_translation_ready_chunks_excludes_active_file_until_done(self) -> None:
        from fuguang_helper.preload import translation_ready_chunks

        chunks = [{"index": 0}, {"index": 1}, {"index": 2}]

        self.assertEqual([item["index"] for item in translation_ready_chunks(chunks, extraction_done=False)], [0, 1])
        self.assertEqual([item["index"] for item in translation_ready_chunks(chunks, extraction_done=True)], [0, 1, 2])

    def test_list_audio_chunks_preserves_sparse_file_indexes(self) -> None:
        from fuguang_helper.preload import list_audio_chunks

        with tempfile.TemporaryDirectory() as tmp:
            chunk_dir = Path(tmp)
            (chunk_dir / "chunk-00000.mp3").write_bytes(b"audio-0")
            (chunk_dir / "chunk-00002.mp3").write_bytes(b"audio-2")

            chunks = list_audio_chunks(chunk_dir)

        self.assertEqual([chunk["index"] for chunk in chunks], [0, 2])

    def test_recovered_failed_job_keeps_error_status(self) -> None:
        import fuguang_helper.server as server

        original_output_dir = server.OUTPUT_DIR
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            (output_dir / "job-1.vtt").write_text("WEBVTT\n", encoding="utf-8")
            (output_dir / "job-1.json").write_text(
                json.dumps(
                    {
                        "translated": [],
                        "chunkStatuses": [
                            {"index": 0, "stage": "failed", "error": "语音识别结果没有 segment 或 word 时间戳"}
                        ],
                    }
                ),
                encoding="utf-8",
            )
            server.OUTPUT_DIR = output_dir
            try:
                job = server.recover_translated_job_from_disk("job-1")
            finally:
                server.OUTPUT_DIR = original_output_dir

        self.assertIsNotNone(job)
        self.assertEqual(job["status"], "error")
        self.assertEqual(job["progress"]["status"], "error")
        self.assertEqual(job["progress"]["chunksFailed"], 1)
        self.assertEqual(job["progress"]["percent"], 0.0)

    def test_retry_failed_job_does_not_start_duplicate_thread_when_already_retrying(self) -> None:
        import fuguang_helper.server as server

        calls: list[object] = []
        original_thread = server.Thread
        try:
            server.Thread = lambda *args, **kwargs: calls.append((args, kwargs))  # type: ignore[assignment]
            with server.JOBS_LOCK:
                server.JOBS["job-retrying"] = {
                    "id": "job-retrying",
                    "status": "running",
                    "stage": "retry_failed",
                    "progress": {"stage": "retry_failed"},
                }
            job = server.start_retry_failed_job_chunks("job-retrying", {})
        finally:
            server.Thread = original_thread
            with server.JOBS_LOCK:
                server.JOBS.pop("job-retrying", None)

        self.assertEqual(job["stage"], "retry_failed")
        self.assertEqual(calls, [])

    def test_retry_failed_job_rejects_retry_while_original_job_is_running(self) -> None:
        import fuguang_helper.server as server

        with server.JOBS_LOCK:
            server.JOBS["job-extracting"] = {
                "id": "job-extracting",
                "status": "running",
                "stage": "extracting",
                "progress": {"stage": "extracting"},
            }
        try:
            with self.assertRaisesRegex(RuntimeError, "仍在运行"):
                server.start_retry_failed_job_chunks("job-extracting", {})
        finally:
            with server.JOBS_LOCK:
                server.JOBS.pop("job-extracting", None)

    def test_retry_translation_job_uses_cached_source_without_asr(self) -> None:
        import fuguang_helper.server as server
        from fuguang_helper.translation_pipeline import TranscriptSegment

        original_output_dir = server.OUTPUT_DIR
        original_translate_segments = server.translate_segments
        original_transcribe_audio_chunk = server.transcribe_audio_chunk
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp)
            json_path = output_dir / "job-translation-only.json"
            json_path.write_text(
                json.dumps(
                    {
                        "source": [{"start": 1.0, "end": 2.0, "text": "hello"}],
                        "translated": [{"start": 1.0, "end": 2.0, "text": "old"}],
                        "chunkStatuses": [
                            {
                                "index": 0,
                                "stage": "failed",
                                "attempts": 1,
                                "source_segments": 1,
                                "translated_segments": 1,
                                "error": "翻译失败",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            server.OUTPUT_DIR = output_dir
            with server.JOBS_LOCK:
                server.JOBS["job-translation-only"] = {
                    "id": "job-translation-only",
                    "status": "error",
                    "stage": "failed",
                    "translation": {"jsonPath": str(json_path)},
                    "progress": {"stage": "failed"},
                }
            calls: list[str] = []

            def fake_transcribe(*_args: object, **_kwargs: object) -> list[TranscriptSegment]:
                raise AssertionError("translation-only retry must not call ASR")

            def fake_translate(**kwargs: object) -> list[TranscriptSegment]:
                calls.append("translate")
                segments = kwargs["segments"]
                assert isinstance(segments, list)
                return [TranscriptSegment(start=1.0, end=2.0, text="译文")]

            server.transcribe_audio_chunk = fake_transcribe  # type: ignore[assignment]
            server.translate_segments = fake_translate  # type: ignore[assignment]
            try:
                job = server.retry_translation_job_chunks(
                    "job-translation-only",
                    {
                        "candidate": {"title": "T", "chunkSeconds": 900},
                        "modelConfig": {
                            "targetLanguage": "zh-CN",
                            "chunkSeconds": 900,
                            "translation": {
                                "providerType": "openai",
                                "baseUrl": "https://llm.test/v1",
                                "model": "test",
                                "apiKey": "test",
                            },
                        },
                    },
                )
                written = json.loads(json_path.read_text(encoding="utf-8"))
            finally:
                server.translate_segments = original_translate_segments
                server.transcribe_audio_chunk = original_transcribe_audio_chunk
                server.OUTPUT_DIR = original_output_dir
                with server.JOBS_LOCK:
                    server.JOBS.pop("job-translation-only", None)

        self.assertEqual(calls, ["translate"])
        self.assertEqual(job["status"], "done")
        self.assertEqual(job["translation"]["chunksFailed"], 0)
        self.assertEqual(written["translated"][0]["text"], "译文")

    def test_runtime_cleanup_removes_old_artifacts_but_keeps_active_job(self) -> None:
        import fuguang_helper.server as server

        original_cache_dir = server.CACHE_DIR
        original_output_dir = server.OUTPUT_DIR
        original_log_dir = server.LOG_DIR
        old_time = time.time() - 10
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cache_dir = root / "audio"
            output_dir = root / "subtitles"
            log_dir = root / "logs"
            cache_dir.mkdir()
            output_dir.mkdir()
            log_dir.mkdir()

            old_audio = cache_dir / "old-job"
            old_audio.mkdir()
            old_audio_file = old_audio / "chunk-00000.mp3"
            old_audio_file.write_bytes(b"old audio")
            active_audio = cache_dir / "active-job"
            active_audio.mkdir()
            active_audio_file = active_audio / "chunk-00000.mp3"
            active_audio_file.write_bytes(b"active audio")
            old_json = output_dir / "old-job.json"
            old_json.write_text("{}", encoding="utf-8")
            recent_vtt = output_dir / "recent-job.vtt"
            recent_vtt.write_text("WEBVTT\n", encoding="utf-8")
            old_log = log_dir / "preload-old-job.log"
            old_log.write_text("old log", encoding="utf-8")

            for path in [old_audio_file, old_json, old_log]:
                os.utime(path, (old_time, old_time))
            for path in [active_audio_file, recent_vtt]:
                os.utime(path, None)

            server.CACHE_DIR = cache_dir
            server.OUTPUT_DIR = output_dir
            server.LOG_DIR = log_dir
            try:
                result = server.cleanup_runtime_artifacts(active_job_ids={"active-job"}, max_age_seconds=1, max_bytes=0)
                self.assertGreaterEqual(result["removed"], 3)
                self.assertFalse(old_audio.exists())
                self.assertFalse(old_json.exists())
                self.assertFalse(old_log.exists())
                self.assertTrue(active_audio.exists())
                self.assertTrue(recent_vtt.exists())
            finally:
                server.CACHE_DIR = original_cache_dir
                server.OUTPUT_DIR = original_output_dir
                server.LOG_DIR = original_log_dir

    def test_runtime_cleanup_enforces_audio_cache_budget(self) -> None:
        import fuguang_helper.server as server

        original_cache_dir = server.CACHE_DIR
        original_output_dir = server.OUTPUT_DIR
        original_log_dir = server.LOG_DIR
        old_time = time.time() - 10
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cache_dir = root / "audio"
            output_dir = root / "subtitles"
            log_dir = root / "logs"
            cache_dir.mkdir()
            output_dir.mkdir()
            log_dir.mkdir()

            old_audio = cache_dir / "old-job"
            old_audio.mkdir()
            old_audio_file = old_audio / "chunk-00000.mp3"
            old_audio_file.write_bytes(b"o" * 80)
            recent_audio = cache_dir / "recent-job"
            recent_audio.mkdir()
            recent_audio_file = recent_audio / "chunk-00000.mp3"
            recent_audio_file.write_bytes(b"r" * 40)
            active_audio = cache_dir / "active-job"
            active_audio.mkdir()
            active_audio_file = active_audio / "chunk-00000.mp3"
            active_audio_file.write_bytes(b"a" * 200)

            os.utime(old_audio_file, (old_time, old_time))
            os.utime(recent_audio_file, None)
            os.utime(active_audio_file, None)

            server.CACHE_DIR = cache_dir
            server.OUTPUT_DIR = output_dir
            server.LOG_DIR = log_dir
            try:
                result = server.cleanup_runtime_artifacts(
                    active_job_ids={"active-job"},
                    max_age_seconds=0,
                    max_bytes=0,
                    audio_max_age_seconds=0,
                    audio_max_bytes=64,
                )
                self.assertEqual(result["removed"], 1)
                self.assertFalse(old_audio.exists())
                self.assertTrue(recent_audio.exists())
                self.assertTrue(active_audio.exists())
            finally:
                server.CACHE_DIR = original_cache_dir
                server.OUTPUT_DIR = original_output_dir
                server.LOG_DIR = original_log_dir

    def test_cleanup_job_audio_cache_removes_chunk_dir_and_root_audio_file(self) -> None:
        import fuguang_helper.server as server

        original_cache_dir = server.CACHE_DIR
        with tempfile.TemporaryDirectory() as tmp:
            cache_dir = Path(tmp)
            job_dir = cache_dir / "job-1"
            job_dir.mkdir()
            (job_dir / "chunk-00000.mp3").write_bytes(b"chunk")
            root_audio = cache_dir / "job-1.mp3"
            root_audio.write_bytes(b"root")
            server.CACHE_DIR = cache_dir
            try:
                self.assertTrue(server.cleanup_job_audio_cache("job-1"))
                self.assertFalse(job_dir.exists())
                self.assertFalse(root_audio.exists())
            finally:
                server.CACHE_DIR = original_cache_dir

    def test_clear_preload_audio_cache_rejects_running_job(self) -> None:
        import fuguang_helper.server as server

        original_cache_dir = server.CACHE_DIR
        with tempfile.TemporaryDirectory() as tmp:
            cache_dir = Path(tmp)
            job_dir = cache_dir / "running-job"
            job_dir.mkdir()
            (job_dir / "chunk-00000.mp3").write_bytes(b"chunk")
            server.CACHE_DIR = cache_dir
            server.JOBS["running-job"] = {"id": "running-job", "status": "running", "stage": "extracting"}
            try:
                with self.assertRaisesRegex(RuntimeError, "运行中"):
                    server.clear_preload_audio_cache("running-job")
                self.assertTrue(job_dir.exists())
            finally:
                server.JOBS.pop("running-job", None)
                server.CACHE_DIR = original_cache_dir

    def test_clear_preload_audio_cache_marks_finished_job_removed(self) -> None:
        import fuguang_helper.server as server

        original_cache_dir = server.CACHE_DIR
        with tempfile.TemporaryDirectory() as tmp:
            cache_dir = Path(tmp)
            job_dir = cache_dir / "failed-job"
            job_dir.mkdir()
            (job_dir / "chunk-00000.mp3").write_bytes(b"chunk")
            server.CACHE_DIR = cache_dir
            server.JOBS["failed-job"] = {"id": "failed-job", "status": "error", "stage": "failed"}
            try:
                result = server.clear_preload_audio_cache("failed-job")
                self.assertTrue(result["removed"])
                self.assertFalse(job_dir.exists())
                self.assertTrue(server.JOBS["failed-job"]["audioCacheRemoved"])
            finally:
                server.JOBS.pop("failed-job", None)
                server.CACHE_DIR = original_cache_dir


class TranslationContextCardTests(unittest.TestCase):
    def test_same_language_metadata_becomes_trusted_anchor(self) -> None:
        from fuguang_helper.stabilizer import build_translation_context_card

        card = build_translation_context_card(
            metadata={
                "title": "Paris travel vlog with Montmartre",
                "description": "A walk through Montmartre and the Louvre.",
            },
            source_language="en",
        )

        self.assertIn("Paris travel vlog with Montmartre", card["trustedAnchors"])
        self.assertEqual(card["weakContext"], [])

    def test_cross_language_metadata_becomes_weak_context_only(self) -> None:
        from fuguang_helper.stabilizer import build_translation_context_card

        card = build_translation_context_card(
            metadata={
                "title": "法国旅行 vlog：蒙马特和卢浮宫",
                "description": "这个视频介绍巴黎旅行路线。",
            },
            source_language="en",
        )

        self.assertEqual(card["trustedAnchors"], [])
        self.assertTrue(any("法国旅行" in item for item in card["weakContext"]))


if __name__ == "__main__":
    unittest.main()
