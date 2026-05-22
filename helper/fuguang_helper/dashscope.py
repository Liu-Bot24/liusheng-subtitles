from __future__ import annotations

import base64
import json
import queue
import threading
import time
from typing import Iterable

import websocket

from .config import HelperConfig


BASE_WS_ENDPOINT = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"


class DashScopeRealtimeSession:
    def __init__(self, config: HelperConfig) -> None:
        self._config = config
        self._ws: websocket.WebSocket | None = None
        self._event_counter = 0
        self._captions: queue.Queue[str] = queue.Queue()
        self._errors: queue.Queue[str] = queue.Queue()
        self._receiver: threading.Thread | None = None
        self._stop = threading.Event()

    def start(self) -> None:
        if not self._config.dashscope_api_key:
            raise RuntimeError("实时翻译模型缺少 DASHSCOPE_API_KEY。请在 helper/.env 中配置后重启本机服务。")
        url = f"{BASE_WS_ENDPOINT}?model={self._config.dashscope_model}"
        self._ws = websocket.create_connection(
            url,
            header=[f"Authorization: Bearer {self._config.dashscope_api_key}"],
            enable_multithread=True,
        )
        self._ws.settimeout(0.2)
        self._send_json(
            {
                "event_id": self._next_event_id(),
                "type": "session.update",
                "session": {
                    "modalities": ["text"],
                    "input_audio_format": "pcm16",
                    "translation": {"language": self._config.target_language},
                },
            }
        )
        self._receiver = threading.Thread(target=self._receive_loop, daemon=True)
        self._receiver.start()

    def send_audio(self, pcm_chunk: bytes) -> None:
        if not self._ws or not pcm_chunk:
            return
        self._send_json(
            {
                "event_id": self._next_event_id(),
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm_chunk).decode("ascii"),
            }
        )

    def poll_captions(self) -> Iterable[str]:
        while True:
            try:
                yield self._captions.get_nowait()
            except queue.Empty:
                break
        try:
            error = self._errors.get_nowait()
        except queue.Empty:
            return
        raise RuntimeError(error)

    def stop(self) -> None:
        self._stop.set()
        if self._ws:
            self._ws.close()
            self._ws = None

    def _send_json(self, message: dict) -> None:
        if not self._ws:
            raise RuntimeError("实时翻译连接尚未建立。")
        self._ws.send(json.dumps(message))

    def _receive_loop(self) -> None:
        while not self._stop.is_set() and self._ws:
            try:
                payload = self._ws.recv()
            except websocket.WebSocketTimeoutException:
                continue
            except Exception as exc:  # noqa: BLE001 - receiver reports runtime errors to the websocket client.
                if not self._stop.is_set():
                    self._errors.put(str(exc))
                return
            self._handle_event(payload)

    def _handle_event(self, payload: str) -> None:
        data = json.loads(payload)
        event_type = data.get("type", "")
        text = ""
        if event_type in {"response.audio_transcript.delta", "response.audio_transcript.done"}:
            text = data.get("transcript", "")
        elif "response.text" in event_type:
            text = data.get("text") or data.get("stash") or ""
            if not text and isinstance(data.get("part"), dict):
                text = data["part"].get("text", "")
        elif event_type == "response.content_part.added":
            part = data.get("part") or {}
            if part.get("type") == "text":
                text = part.get("text", "")
        elif event_type == "error":
            details = data.get("message")
            if not details and isinstance(data.get("error"), dict):
                details = data["error"].get("message")
            self._errors.put(details or json.dumps(data, ensure_ascii=False))
        if text:
            self._captions.put(text)

    def _next_event_id(self) -> str:
        self._event_counter += 1
        return f"event_{int(time.time() * 1000)}_{self._event_counter}"
