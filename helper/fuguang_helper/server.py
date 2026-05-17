from __future__ import annotations

import asyncio
import json
import logging
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from typing import Any

import websockets

from .config import HelperConfig
from .dashscope import DashScopeRealtimeSession
from .preload import build_audio_extract_plan, probe_ffmpeg


LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    filename=LOG_DIR / "helper.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


class HelperHttpHandler(BaseHTTPRequestHandler):
    server_version = "FuguangHelper/0.1"

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        if self.path == "/health":
            capability = probe_ffmpeg()
            self._send_json(
                {
                    "ok": True,
                    "ffmpeg": capability.ffmpeg,
                    "ffprobe": capability.ffprobe,
                    "preloadAvailable": capability.available,
                }
            )
            return
        self._send_json({"ok": False, "error": "not found"}, status=404)

    def do_POST(self) -> None:  # noqa: N802 - stdlib handler API
        if self.path == "/preload":
            payload = self._read_json()
            candidate = payload.get("candidate") or {}
            source_url = candidate.get("url", "")
            plan = build_audio_extract_plan(source_url)
            logging.info("preload requested url=%s available=%s", source_url, plan["available"])
            self._send_json(
                {
                    "ok": False,
                    "status": "not_implemented",
                    "error": "Preload pipeline is scaffolded but not implemented yet.",
                    "plan": plan,
                },
                status=501,
            )
            return
        self._send_json({"ok": False, "error": "not found"}, status=404)

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
        self.send_header("access-control-allow-origin", "*")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


async def realtime_handler(websocket: Any) -> None:
    config = HelperConfig.from_env()
    if not config.dashscope_api_key:
        await mock_realtime_handler(websocket)
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


async def mock_realtime_handler(websocket: Any) -> None:
    received = 0
    last_emit = time.monotonic()
    async for message in websocket:
        if isinstance(message, bytes):
            received += len(message)
        if time.monotonic() - last_emit > 3 and received:
            seconds = received / (16000 * 2)
            await websocket.send(
                json.dumps(
                    {
                        "type": "caption",
                        "text": f"[Mock] 已接收约 {seconds:.1f} 秒音频",
                    },
                    ensure_ascii=False,
                )
            )
            received = 0
            last_emit = time.monotonic()


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


async def async_main() -> None:
    config = HelperConfig.from_env()
    httpd = start_http_server(config)
    logging.info("helper http listening on %s:%s", config.http_host, config.http_port)
    try:
        async with websockets.serve(realtime_handler, config.ws_host, config.ws_port, max_size=8 * 1024 * 1024):
            logging.info("helper websocket listening on %s:%s", config.ws_host, config.ws_port)
            await asyncio.Future()
    finally:
        httpd.shutdown()


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
