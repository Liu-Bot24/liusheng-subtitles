from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class TranslationPipelineTests(unittest.TestCase):
    def test_loads_json_content_strips_markdown_fence(self) -> None:
        from fuguang_helper.translation_pipeline import loads_json_content

        payload = loads_json_content('```json\n{"translated_transcript":[]}\n```')

        self.assertEqual(payload, {"translated_transcript": []})

    def test_loads_json_content_extracts_embedded_json_object(self) -> None:
        from fuguang_helper.translation_pipeline import loads_json_content

        payload = loads_json_content('Here is the JSON:\n{"translated_transcript":[]}\nDone.')

        self.assertEqual(payload, {"translated_transcript": []})

    def test_translation_prompt_contains_strict_json_contract(self) -> None:
        from fuguang_helper.translation_pipeline import TranscriptSegment, translation_messages

        messages = translation_messages(
            "Lesson",
            [TranscriptSegment(start=0, end=1, text="hello")],
            {},
            "zh-CN",
        )
        combined = "\n".join(message["content"] for message in messages)

        self.assertIn("Return exactly one valid JSON object", combined)
        self.assertIn("No markdown", combined)
        self.assertIn("Input segment count: 1", combined)
        self.assertIn("Output translated_transcript length must be exactly 1", combined)

    def test_target_language_names_cover_sidepanel_options(self) -> None:
        from fuguang_helper.translation_pipeline import target_language_name

        self.assertEqual(target_language_name("zh-CN"), "Simplified Chinese")
        self.assertEqual(target_language_name("en"), "English")
        self.assertEqual(target_language_name("ja"), "Japanese")
        self.assertEqual(target_language_name("fr"), "French")
        self.assertEqual(target_language_name("ko"), "Korean")
        self.assertEqual(target_language_name("de"), "German")
        self.assertEqual(target_language_name("ru"), "Russian")

    def test_anthropic_endpoint_supports_learning_path_prefix_case(self) -> None:
        from fuguang_helper.translation_pipeline import anthropic_endpoint

        self.assertEqual(anthropic_endpoint("https://api.anthropic.com"), "https://api.anthropic.com/v1/messages")
        self.assertEqual(anthropic_endpoint("https://api.anthropic.com/v1"), "https://api.anthropic.com/v1/messages")
        self.assertEqual(
            anthropic_endpoint("https://token-plan-cn.xiaomimimo.com/anthropic"),
            "https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages",
        )
        self.assertEqual(
            anthropic_endpoint("https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages"),
            "https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages",
        )

    def test_chat_text_retries_without_json_mode_when_compat_endpoint_rejects_it(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        calls: list[dict] = []

        class Response:
            def __init__(self, content: str) -> None:
                self.content = content

            def raise_for_status(self) -> None:
                return None

            def json(self) -> dict:
                return {"choices": [{"message": {"content": self.content}}]}

        def fake_post(url, headers, json, timeout):
            calls.append(json)
            if "response_format" in json:
                return Response("The response_format parameter is not supported by this model.")
            return Response('{"translated_transcript":[]}')

        original_post = pipeline.httpx.post
        try:
            pipeline.httpx.post = fake_post
            content = pipeline.chat_text(
                pipeline.ModelConfig(base_url="https://compat.test/v1", model="compat-model", api_key="key"),
                [{"role": "user", "content": "Return JSON."}],
                temperature=0,
                max_tokens=100,
                timeout=30,
            )
        finally:
            pipeline.httpx.post = original_post

        self.assertEqual(content, '{"translated_transcript":[]}')
        self.assertEqual(len(calls), 2)
        self.assertIn("response_format", calls[0])
        self.assertNotIn("response_format", calls[1])

    def test_model_config_overrides_take_precedence(self) -> None:
        from fuguang_helper.translation_pipeline import load_asr_config, load_translation_config

        asr = load_asr_config({}, {"baseUrl": "https://asr.example/v1", "model": "asr-model", "apiKey": "asr-key"})
        llm = load_translation_config(
            {},
            {
                "baseUrl": "https://llm.example/v1",
                "model": "llm-model",
                "apiKey": "llm-key",
                "providerType": "anthropic",
            },
        )

        self.assertEqual(asr.base_url, "https://asr.example/v1")
        self.assertEqual(asr.model, "asr-model")
        self.assertEqual(llm.provider_type, "anthropic")
        self.assertEqual(llm.model, "llm-model")

    def test_online_asr_override_without_key_does_not_reuse_env_key(self) -> None:
        from fuguang_helper.translation_pipeline import load_asr_config

        env = {
            "FUGUANG_ASR_API_KEY": "openai-asr-key",
            "FUGUANG_ASR_MODEL": "whisper-1",
        }

        asr = load_asr_config(env, {"providerType": "xai", "baseUrl": "https://api.x.ai/v1", "model": "grok-2-voice-1212"})

        self.assertIsNone(asr)

    def test_asr_config_does_not_use_global_openai_key(self) -> None:
        from fuguang_helper.translation_pipeline import load_asr_config

        asr = load_asr_config({"OPENAI_API_KEY": "global-openai-key", "FUGUANG_ASR_MODEL": "whisper-1"})

        self.assertIsNone(asr)

    def test_llm_override_without_key_does_not_reuse_env_key(self) -> None:
        from fuguang_helper.translation_pipeline import load_translation_config

        env = {
            "FUGUANG_LLM_BASE_URL": "https://token-plan-cn.xiaomimimo.com/v1",
            "FUGUANG_LLM_MODEL": "mimo-v2.5-pro",
            "FUGUANG_LLM_API_KEY": "mimo-key",
        }

        llm = load_translation_config(env, {"baseUrl": "https://api.siliconflow.cn/v1", "model": "deepseek-ai/DeepSeek-V3.2"})

        self.assertIsNone(llm)

    def test_env_config_used_only_when_no_override_is_supplied(self) -> None:
        from fuguang_helper.translation_pipeline import load_asr_config, load_translation_config

        env = {
            "FUGUANG_ASR_API_KEY": "asr-key",
            "FUGUANG_ASR_MODEL": "whisper-1",
            "FUGUANG_LLM_BASE_URL": "https://llm.local/v1",
            "FUGUANG_LLM_MODEL": "default-model",
            "FUGUANG_LLM_API_KEY": "llm-key",
        }

        asr = load_asr_config(env)
        llm = load_translation_config(env)

        self.assertEqual(asr.model, "whisper-1")
        self.assertEqual(asr.api_key, "asr-key")
        self.assertEqual(llm.base_url, "https://llm.local/v1")
        self.assertEqual(llm.model, "default-model")
        self.assertEqual(llm.api_key, "llm-key")

    def test_incomplete_override_does_not_fall_back_to_local_model_config(self) -> None:
        from fuguang_helper.translation_pipeline import load_translation_config

        env = {
            "FUGUANG_LLM_BASE_URL": "https://local-model.example/v1",
            "FUGUANG_LLM_MODEL": "mimo-v2.5-pro",
            "FUGUANG_LLM_API_KEY": "llm-key",
        }

        llm = load_translation_config(env, {"baseUrl": "https://api.openai.com/v1"})

        self.assertIsNone(llm)

    def test_local_whisper_asr_profile_is_ignored(self) -> None:
        from fuguang_helper.translation_pipeline import load_asr_config

        asr = load_asr_config({}, {"providerType": "local_whisper", "model": "base"})

        self.assertIsNone(asr)
        self.assertIsNone(load_asr_config({
            "FUGUANG_ASR_PROVIDER_TYPE": "local_whisper",
            "FUGUANG_ASR_MODEL": "base",
            "FUGUANG_ASR_API_KEY": "unused",
        }))

    def test_xai_asr_uses_stt_endpoint_and_format_request(self) -> None:
        from fuguang_helper.translation_pipeline import asr_request_data, ModelConfig, transcription_endpoint

        config = ModelConfig(
            base_url="https://api.x.ai/v1",
            model="grok-2-voice-1212",
            api_key="xai-key",
            provider_type="xai",
        )

        self.assertEqual(transcription_endpoint(config), "https://api.x.ai/v1/stt")
        self.assertEqual(asr_request_data(config, "en"), {"language": "en", "format": "true"})
        self.assertEqual(asr_request_data(config, "zh-CN"), {})

    def test_vtt_segments_are_offset(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_vtt_text

        segments = segments_from_vtt_text(
            "WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nhello\n\n",
            offset=900,
        )

        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].start, 901.0)
        self.assertEqual(segments[0].end, 903.5)
        self.assertEqual(segments[0].text, "hello")

    def test_asr_payload_parses_word_timestamps(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_asr_payload

        segments = segments_from_asr_payload(
            {
                "text": "Hello world",
                "words": [
                    {"word": "Hello", "start": 1.0, "end": 1.4},
                    {"word": "world", "start": 1.5, "end": 2.0},
                ],
            }
        )

        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].start, 1.0)
        self.assertEqual(segments[0].end, 2.0)
        self.assertEqual(segments[0].text, "Hello world")

    def test_asr_payload_parses_nested_result_word_timestamps(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_asr_payload

        segments = segments_from_asr_payload(
            {
                "result": {
                    "words": [
                        {"text": "你", "start_time": 0.0, "end_time": 0.2},
                        {"text": "好", "start_time": 0.2, "end_time": 0.5},
                    ]
                }
            }
        )

        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].text, "你好")

    def test_asr_payload_with_text_segment_but_no_timestamp_fails(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_asr_payload

        with self.assertRaisesRegex(RuntimeError, "时间戳"):
            segments_from_asr_payload({"segments": [{"text": "hello without time"}]})

    def test_asr_payload_parses_srt_text(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_asr_payload

        segments = segments_from_asr_payload("1\n00:00:01,0 --> 00:00:02,500\nhello\n\n")

        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].start, 1.0)
        self.assertEqual(segments[0].end, 2.5)
        self.assertEqual(segments[0].text, "hello")

    def test_asr_payload_rejects_plain_text_without_timestamps(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_asr_payload

        with self.assertRaisesRegex(RuntimeError, "没有时间戳"):
            segments_from_asr_payload("plain transcript only")

    def test_asr_payload_allows_empty_text_as_silent_chunk(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_asr_payload

        self.assertEqual(segments_from_asr_payload({"text": "", "segments": []}), [])
        self.assertEqual(segments_from_asr_payload(""), [])

    def test_vtt_parser_can_allow_empty_silent_chunk(self) -> None:
        from fuguang_helper.translation_pipeline import segments_from_vtt_text

        self.assertEqual(segments_from_vtt_text("WEBVTT\n\n", allow_empty=True), [])
        with self.assertRaisesRegex(RuntimeError, "没有可用时间戳"):
            segments_from_vtt_text("WEBVTT\n\n")

    def test_asr_shape_log_does_not_include_transcript_text(self) -> None:
        from fuguang_helper.translation_pipeline import describe_asr_payload_shape

        shape = describe_asr_payload_shape({"text": "sensitive transcript text", "words": [{"word": "secret"}]})

        self.assertIn("words_len=1", shape)
        self.assertIn("text_len=25", shape)
        self.assertNotIn("sensitive", shape)

    def test_load_combined_env_only_reads_project_env_files(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_project = pipeline.PROJECT_ENV_PATH
        original_helper = pipeline.HELPER_ENV_PATH
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            project_env = root / ".env"
            helper_env = root / "helper" / ".env"
            unrelated_env = root / "learning" / ".env"
            helper_env.parent.mkdir()
            unrelated_env.parent.mkdir()
            project_env.write_text("FUGUANG_LLM_MODEL=project-model\n", encoding="utf-8")
            helper_env.write_text("FUGUANG_LLM_MODEL=helper-model\nFUGUANG_LLM_API_KEY=helper-key\n", encoding="utf-8")
            unrelated_env.write_text("FUGUANG_LLM_MODEL=unrelated-model\n", encoding="utf-8")
            pipeline.PROJECT_ENV_PATH = project_env
            pipeline.HELPER_ENV_PATH = helper_env
            try:
                with mock.patch.dict(os.environ, {}, clear=True):
                    env = pipeline.load_combined_env()
            finally:
                pipeline.PROJECT_ENV_PATH = original_project
                pipeline.HELPER_ENV_PATH = original_helper

        self.assertEqual(env["FUGUANG_LLM_MODEL"], "helper-model")
        self.assertNotEqual(env["FUGUANG_LLM_MODEL"], "unrelated-model")

    def test_effective_config_summary_never_exposes_api_keys(self) -> None:
        from fuguang_helper.translation_pipeline import summarize_model_config, ModelConfig

        summary = summarize_model_config(
            ModelConfig(base_url="https://llm.test/v1", model="model", api_key="secret-api-key", provider_type="openai")
        )

        self.assertTrue(summary["apiKeyConfigured"])
        self.assertNotIn("secret-api-key", str(summary))
        self.assertEqual(summary["apiKeyPreview"], "secr...-key")

    def test_segments_to_vtt_offsets_chunk_times(self) -> None:
        from fuguang_helper.translation_pipeline import TranscriptSegment, segments_to_vtt

        vtt = segments_to_vtt(
            [
                TranscriptSegment(start=900.0, end=902.5, text="你好"),
                TranscriptSegment(start=3661.25, end=3662.0, text="世界"),
            ]
        )

        self.assertIn("00:15:00.000 --> 00:15:02.500", vtt)
        self.assertIn("01:01:01.250 --> 01:01:02.000", vtt)

    def test_retry_chunk_task_retries_only_failed_attempt(self) -> None:
        from fuguang_helper.translation_pipeline import retry_step

        attempts = {"count": 0}

        def flaky() -> str:
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise ValueError("bad json")
            return "ok"

        self.assertEqual(retry_step(flaky, attempts=2, label="translate"), "ok")
        self.assertEqual(attempts["count"], 2)

    def test_process_audio_chunk_reports_asr_translation_and_done(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_transcribe = pipeline.transcribe_audio_chunk
        original_translate = pipeline.translate_segments
        stages: list[str] = []
        status = pipeline.ChunkStatus(index=0)

        def fake_transcribe(audio_path, config, language, offset):
            return [pipeline.TranscriptSegment(start=offset, end=offset + 1.0, text="hello")]

        def fake_translate(*, title, segments, config, context_card, target_language, **kwargs):
            return [pipeline.TranscriptSegment(start=segments[0].start, end=segments[0].end, text="你好")]

        try:
            pipeline.transcribe_audio_chunk = fake_transcribe
            pipeline.translate_segments = fake_translate
            result = pipeline.process_audio_chunk(
                index=0,
                chunk={"path": "/tmp/chunk-00000.mp3"},
                chunk_seconds=900,
                context_card={},
                title="",
                source_language="en",
                target_language="zh-CN",
                asr_config=pipeline.ModelConfig(base_url="http://asr.test", model="asr", api_key="key"),
                translation_config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                status=status,
                progress_callback=lambda: stages.append(status.stage),
            )
        finally:
            pipeline.transcribe_audio_chunk = original_transcribe
            pipeline.translate_segments = original_translate

        self.assertEqual(result[0], 0)
        self.assertEqual(status.stage, "done")
        self.assertEqual(status.source_segments, 1)
        self.assertEqual(status.translated_segments, 1)
        self.assertEqual(stages, ["asr", "translation", "done"])

    def test_translate_segments_repairs_untranslated_target_language_leak(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        calls: list[str] = []
        source = [
            pipeline.TranscriptSegment(start=0, end=1.0, text="In contrast, advanced users ask neutral questions."),
            pipeline.TranscriptSegment(start=1.0, end=2.0, text="Let's go on to the next video to learn about how AI gets its knowledge."),
        ]

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            user_message = messages[-1]["content"]
            calls.append(user_message)
            if "In contrast" in user_message:
                return json.dumps(
                    {
                        "translated_transcript": [
                            {"start": 0, "end": 1.0, "text": "相比之下，高级用户会提出中性问题。"},
                            {
                                "start": 1.0,
                                "end": 2.0,
                                "text": "Let's go on to the next video to learn about how AI gets its knowledge.",
                            },
                        ]
                    }
                )
            return json.dumps(
                {
                    "translated_transcript": [
                        {"start": 1.0, "end": 2.0, "text": "让我们进入下一个视频，了解 AI 如何获得知识。"}
                    ]
                }
            )

        try:
            pipeline.chat_text = fake_chat_text
            translated = pipeline.translate_segments(
                title="",
                segments=source,
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(len(calls), 2)
        self.assertEqual(translated[0].text, "相比之下，高级用户会提出中性问题。")
        self.assertEqual(translated[1].text, "让我们进入下一个视频，了解 AI 如何获得知识。")

    def test_translate_segments_keeps_partial_result_when_final_repair_still_incomplete(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        source = [
            pipeline.TranscriptSegment(start=0, end=1.0, text="First line is translated."),
            pipeline.TranscriptSegment(start=1.0, end=2.0, text="Second line is still English."),
        ]

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            user_message = messages[-1]["content"]
            if "First line is translated" in user_message:
                return json.dumps(
                    {
                        "translated_transcript": [
                            {"start": 0, "end": 1.0, "text": "第一句已经翻译。"},
                            {"start": 1.0, "end": 2.0, "text": "Second line is still English."},
                        ]
                    },
                    ensure_ascii=False,
                )
            return json.dumps(
                {
                    "translated_transcript": [
                        {"start": 1.0, "end": 2.0, "text": "Second line is still English."},
                    ]
                },
                ensure_ascii=False,
            )

        try:
            pipeline.chat_text = fake_chat_text
            translated = pipeline.translate_segments(
                title="",
                segments=source,
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(translated[0].text, "第一句已经翻译。")
        self.assertEqual(translated[1].text, "Second line is still English.")

    def test_translate_segments_skips_model_when_already_target_language(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text

        def fail_chat_text(*args, **kwargs):
            raise AssertionError("中文原文不应该再请求翻译模型")

        source = [
            pipeline.TranscriptSegment(start=0, end=1, text="完全没问题。"),
            pipeline.TranscriptSegment(start=1, end=2, text="不过坏消息是很多 AI 数据源。"),
        ]

        try:
            pipeline.chat_text = fail_chat_text
            translated = pipeline.translate_segments(
                title="",
                segments=source,
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(translated, source)

    def test_translate_segments_does_not_skip_chinese_when_target_is_english(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        calls = {"count": 0}

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            calls["count"] += 1
            return json.dumps(
                {
                    "translated_transcript": [
                        {"start": 0, "end": 1, "text": "No problem at all."},
                    ]
                }
            )

        try:
            pipeline.chat_text = fake_chat_text
            translated = pipeline.translate_segments(
                title="",
                segments=[pipeline.TranscriptSegment(start=0, end=1, text="完全没问题。")],
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="en",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(calls["count"], 1)
        self.assertEqual(translated[0].text, "No problem at all.")

    def test_translate_segments_does_not_skip_mixed_language_chunk(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        calls = {"count": 0}
        source = [
            pipeline.TranscriptSegment(start=0, end=1, text="完全没问题。"),
            pipeline.TranscriptSegment(start=1, end=2, text="Let's continue with the next video."),
        ]

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            calls["count"] += 1
            return json.dumps(
                {
                    "translated_transcript": [
                        {"start": 0, "end": 1, "text": "完全没问题。"},
                        {"start": 1, "end": 2, "text": "让我们继续下一个视频。"},
                    ]
                },
                ensure_ascii=False,
            )

        try:
            pipeline.chat_text = fake_chat_text
            translated = pipeline.translate_segments(
                title="",
                segments=source,
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(calls["count"], 1)
        self.assertEqual(translated[1].text, "让我们继续下一个视频。")

    def test_translate_segments_batches_large_asr_chunk(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        source = [
            pipeline.TranscriptSegment(start=float(index), end=float(index) + 0.5, text=f"Sentence {index}.")
            for index in range(45)
        ]
        calls: list[str] = []

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            user_message = messages[-1]["content"]
            calls.append(user_message)
            payload = {"translated_transcript": []}
            for match in re.finditer(r"\[(?P<start>\d+\.\d+)-(?P<end>\d+\.\d+)\]", user_message):
                start = float(match.group("start"))
                end = float(match.group("end"))
                payload["translated_transcript"].append({"start": start, "end": end, "text": f"译文 {int(start)}"})
            return json.dumps(payload, ensure_ascii=False)

        try:
            pipeline.chat_text = fake_chat_text
            with mock.patch.dict(os.environ, {"FUGUANG_TRANSLATION_BATCH_SEGMENTS": "20"}):
                translated = pipeline.translate_segments(
                    title="",
                    segments=source,
                    config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                    context_card={},
                    target_language="zh-CN",
                )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(len(translated), 45)
        self.assertEqual(len(calls), 3)
        self.assertEqual(translated[-1].text, "译文 44")

    def test_translate_segments_splits_failed_batch_before_failing_chunk(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_translate_batch = pipeline.translate_segment_batch
        source = [
            pipeline.TranscriptSegment(start=float(index), end=float(index) + 0.5, text=f"Sentence {index}.")
            for index in range(4)
        ]
        call_sizes: list[int] = []

        def fake_translate_batch(*, title, segments, config, context_card, target_language):
            call_sizes.append(len(segments))
            if len(segments) > 1:
                raise RuntimeError("model returned malformed json")
            return [pipeline.TranscriptSegment(start=segments[0].start, end=segments[0].end, text=f"译文 {int(segments[0].start)}")]

        try:
            pipeline.translate_segment_batch = fake_translate_batch
            translated = pipeline.translate_segments(
                title="",
                segments=source,
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.translate_segment_batch = original_translate_batch

        self.assertEqual([segment.text for segment in translated], ["译文 0", "译文 1", "译文 2", "译文 3"])
        self.assertIn(4, call_sizes)
        self.assertIn(1, call_sizes)

    def test_translate_segments_does_not_hide_single_segment_failure(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_translate_batch = pipeline.translate_segment_batch

        def fake_translate_batch(*, title, segments, config, context_card, target_language):
            raise RuntimeError("model returned no usable subtitle")

        try:
            pipeline.translate_segment_batch = fake_translate_batch
            with self.assertRaisesRegex(RuntimeError, "no usable subtitle"):
                pipeline.translate_segments(
                    title="",
                    segments=[pipeline.TranscriptSegment(start=0, end=1, text="Hello there.")],
                    config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                    context_card={},
                    target_language="zh-CN",
                )
        finally:
            pipeline.translate_segment_batch = original_translate_batch

    def test_translated_segments_accepts_top_level_array_payload(self) -> None:
        from fuguang_helper.translation_pipeline import translated_segments_from_payload

        segments = translated_segments_from_payload(
            [
                {"start": 0, "end": 1.5, "text": "你好"},
                {"start": 1.5, "end": 2.0, "text": "世界"},
            ]
        )

        self.assertEqual(len(segments), 2)
        self.assertEqual(segments[0].text, "你好")

    def test_translate_segments_repairs_schema_valid_but_wrong_shape(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        calls: list[str] = []

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            user_message = messages[-1]["content"]
            calls.append(user_message)
            if "payload schema was invalid" in user_message:
                return '{"translated_transcript":[{"start":0,"end":1,"text":"你好"}]}'
            return '{"unexpected":[{"start":0,"end":1,"text":"你好"}]}'

        try:
            pipeline.chat_text = fake_chat_text
            translated = pipeline._translate_segments_once(
                title="",
                segments=[pipeline.TranscriptSegment(start=0, end=1, text="hello")],
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(translated[0].text, "你好")
        self.assertTrue(any("payload schema was invalid" in call for call in calls))

    def test_translate_segments_repairs_malformed_json_with_original_instruction(self) -> None:
        import fuguang_helper.translation_pipeline as pipeline

        original_chat_text = pipeline.chat_text
        calls: list[str] = []

        def fake_chat_text(config, messages, *, temperature, max_tokens, timeout):
            user_message = messages[-1]["content"]
            calls.append(user_message)
            if "JSON parser failed" in user_message:
                return '{"translated_transcript":[{"start":0,"end":1,"text":"你好"}]}'
            return '{"translated_transcript":[{"start":0,"end":1,"text":"你好"'

        try:
            pipeline.chat_text = fake_chat_text
            translated = pipeline._translate_segments_once(
                title="",
                segments=[pipeline.TranscriptSegment(start=0, end=1, text="hello")],
                config=pipeline.ModelConfig(base_url="http://llm.test", model="llm", api_key="key"),
                context_card={},
                target_language="zh-CN",
            )
        finally:
            pipeline.chat_text = original_chat_text

        self.assertEqual(translated[0].text, "你好")
        self.assertTrue(any("JSON parser failed" in call and "Original instruction" in call for call in calls))

    def test_untranslated_english_sentence_is_marked_for_chinese_repair(self) -> None:
        from fuguang_helper.translation_pipeline import (
            TranscriptSegment,
            needs_translation_repair,
            translation_repair_indices,
        )

        source = [
            TranscriptSegment(start=0, end=1, text="Let's go on to the next video to learn about how AI gets its knowledge."),
            TranscriptSegment(start=1, end=2, text="AI"),
        ]
        translated = [
            TranscriptSegment(start=0, end=1, text="Let's go on to the next video to learn about how AI gets its knowledge."),
            TranscriptSegment(start=1, end=2, text="AI"),
        ]

        self.assertTrue(needs_translation_repair(source[0], translated[0], "zh-CN"))
        self.assertFalse(needs_translation_repair(source[1], translated[1], "zh-CN"))
        self.assertEqual(translation_repair_indices(source, translated, "zh-CN"), [0])

    def test_write_outputs_writes_vtt_and_json(self) -> None:
        from fuguang_helper.translation_pipeline import TranscriptSegment, write_pipeline_outputs

        with tempfile.TemporaryDirectory() as tmp:
            result = write_pipeline_outputs(
                job_id="test-job",
                output_dir=Path(tmp),
                translated_segments=[TranscriptSegment(start=0, end=1.2, text="字幕")],
                source_segments=[TranscriptSegment(start=0, end=1.2, text="caption")],
                chunk_statuses=[],
            )

            self.assertTrue(Path(result["vttPath"]).exists())
            self.assertTrue(Path(result["jsonPath"]).exists())
            self.assertIn("WEBVTT", Path(result["vttPath"]).read_text(encoding="utf-8"))
            payload = json.loads(Path(result["jsonPath"]).read_text(encoding="utf-8"))
            self.assertEqual(payload["translated"][0]["text"], "字幕")

    def test_worker_count_clamps_asr_and_translation_limits_separately(self) -> None:
        from fuguang_helper.server import worker_count

        self.assertEqual(worker_count("9", fallback=1, upper=3), 3)
        self.assertEqual(worker_count("bad", fallback=1, upper=3), 1)
        self.assertEqual(worker_count("0", fallback=3, upper=6), 1)

    def test_configured_chunk_seconds_accepts_minutes_and_clamps_range(self) -> None:
        from fuguang_helper.server import configured_chunk_seconds

        self.assertEqual(configured_chunk_seconds({}, {"chunkMinutes": 20}), 1200)
        self.assertEqual(configured_chunk_seconds({"chunkSeconds": 30}, {}), 60)
        self.assertEqual(configured_chunk_seconds({}, {"chunkMinutes": 90}), 3600)


if __name__ == "__main__":
    unittest.main()
