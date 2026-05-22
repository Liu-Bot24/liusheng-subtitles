from __future__ import annotations

import re
from typing import Any


MAX_CONTEXT_ITEM_CHARS = 180


def build_translation_context_card(
    *,
    metadata: dict[str, Any],
    source_language: str | None,
) -> dict[str, Any]:
    source_family = _language_family(source_language or "")
    trusted: list[str] = []
    weak: list[str] = []
    ignored: list[str] = []

    for key in ("title", "description", "channel", "uploader", "creator", "pageUrl", "sourceUrl"):
        value = _clean_text(metadata.get(key))
        if not value:
            continue
        if key in {"pageUrl", "sourceUrl"}:
            ignored.append(f"{key}: {value[:MAX_CONTEXT_ITEM_CHARS]}")
            continue

        value_family = _text_language_family(value)
        entry = value[:MAX_CONTEXT_ITEM_CHARS]
        if source_family and value_family and source_family == value_family:
            trusted.append(entry)
        elif value_family:
            weak.append(entry)
        else:
            weak.append(entry)

    return {
        "mode": "inline_translation_stabilizer",
        "sourceLanguage": source_language or "auto",
        "trustedAnchors": _dedupe(trusted),
        "weakContext": _dedupe(weak),
        "ignored": _dedupe(ignored),
        "rules": [
            "Use metadata as hints, not truth.",
            "Only same-language trusted anchors may support exact ASR name/entity corrections.",
            "Cross-language or possibly translated metadata may only provide topic, scene, location, and domain scope.",
            "Prefer no implicit correction over uncertain correction.",
            "Do not add a separate review step or ask the user to approve patches.",
        ],
    }


def format_context_card_for_prompt(card: dict[str, Any]) -> str:
    lines = [
        "Lightweight context for subtitle translation:",
        f"- source_language: {card.get('sourceLanguage') or 'auto'}",
    ]
    trusted = card.get("trustedAnchors") or []
    weak = card.get("weakContext") or []
    if trusted:
        lines.append("- trusted_anchors:")
        lines.extend(f"  - {item}" for item in trusted[:8])
    if weak:
        lines.append("- weak_context:")
        lines.extend(f"  - {item}" for item in weak[:8])
    lines.extend(
        [
            "- rules:",
            "  - Treat this context as low-cost hints inside the current translation call.",
            "  - Do not run a separate correction workflow.",
            "  - Correct only obvious high-confidence ASR mistakes while translating.",
            "  - If context and transcript conflict, trust the transcript unless the mistake is obvious.",
        ]
    )
    return "\n".join(lines)


def _clean_text(value: object) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text


def _language_family(language: str) -> str:
    value = language.strip().lower()
    if not value or value == "auto":
        return ""
    if value.startswith(("zh", "cmn", "yue")):
        return "cjk"
    if value.startswith(("ja", "jp")):
        return "cjk"
    if value.startswith("ko"):
        return "cjk"
    if value.startswith(("en", "fr", "de", "es", "it", "pt", "nl", "sv", "no", "da")):
        return "latin"
    if value.startswith(("ru", "uk", "bg", "sr")):
        return "cyrillic"
    return value.split("-", 1)[0]


def _text_language_family(text: str) -> str:
    cjk = len(re.findall(r"[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    cyrillic = len(re.findall(r"[\u0400-\u04ff]", text))
    if cjk >= max(2, latin // 2) and cjk >= cyrillic:
        return "cjk"
    if cyrillic >= max(2, latin // 2):
        return "cyrillic"
    if latin:
        return "latin"
    return ""


def _dedupe(items: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output
