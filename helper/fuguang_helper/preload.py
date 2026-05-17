from __future__ import annotations

import shutil
from dataclasses import dataclass


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
        "target": "16k mono audio -> ASR -> WebVTT",
    }
