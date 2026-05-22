from __future__ import annotations

import ast
import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCAL_ENV_PATHS = (PROJECT_ROOT / ".env", PROJECT_ROOT / "helper" / ".env")


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
        load_local_env_files()
        return cls(
            dashscope_api_key=os.getenv("DASHSCOPE_API_KEY", ""),
            dashscope_model=os.getenv("DASHSCOPE_MODEL", cls.dashscope_model),
            target_language=os.getenv("FUGUANG_TARGET_LANGUAGE", cls.target_language),
            ws_host=os.getenv("FUGUANG_WS_HOST", cls.ws_host),
            ws_port=int(os.getenv("FUGUANG_WS_PORT", str(cls.ws_port))),
            http_host=os.getenv("FUGUANG_HTTP_HOST", cls.http_host),
            http_port=int(os.getenv("FUGUANG_HTTP_PORT", str(cls.http_port))),
        )


def load_local_env_files() -> None:
    for path in LOCAL_ENV_PATHS:
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), parse_env_value(value))


def parse_env_value(value: str) -> str:
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        try:
            parsed = ast.literal_eval(text)
        except (SyntaxError, ValueError):
            return text[1:-1]
        return str(parsed)
    return text
