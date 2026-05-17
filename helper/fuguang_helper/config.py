from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class HelperConfig:
    dashscope_api_key: str
    dashscope_model: str = "qwen3-livetranslate-flash-realtime"
    target_language: str = "zh"
    ws_host: str = "127.0.0.1"
    ws_port: int = 8765
    http_host: str = "127.0.0.1"
    http_port: int = 8766

    @classmethod
    def from_env(cls) -> "HelperConfig":
        return cls(
            dashscope_api_key=os.getenv("DASHSCOPE_API_KEY", ""),
            dashscope_model=os.getenv("DASHSCOPE_MODEL", cls.dashscope_model),
            target_language=os.getenv("FUGUANG_TARGET_LANGUAGE", cls.target_language),
            ws_host=os.getenv("FUGUANG_WS_HOST", cls.ws_host),
            ws_port=int(os.getenv("FUGUANG_WS_PORT", str(cls.ws_port))),
            http_host=os.getenv("FUGUANG_HTTP_HOST", cls.http_host),
            http_port=int(os.getenv("FUGUANG_HTTP_PORT", str(cls.http_port))),
        )
