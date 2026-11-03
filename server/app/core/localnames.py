"""University names in the reader's language, resolved at response time (V29, REPORT §378.11, brief §34).

Fifty-odd server sites put ``"university": <University>.name_en`` into task titles, notification parameters,
submission/dossier/visa payloads and the sponsor view — several of them **stored** (``Task.title_params``,
notification params), so a Korean reader saw an English name inside a Korean sentence. V29 stores the
``university_id`` beside the name at every write site, and this middleware resolves the name when the response is
rendered, for whoever is reading:

* the API client sends ``Accept-Language`` with the UI language (packages/api-client);
* the naming rule is V28's ``localName()``: the Korean name on ``ko``, the English name everywhere else — so only a
  ``ko`` reader's response ever changes, and nothing is rewritten for anyone else;
* a dict carrying ``university`` (a string) is resolved by ``university_id`` when present, else — for rows written
  before V29 — by an exact match of the stored English name. Anything that is not exactly a known university name is
  left untouched, so user text is never altered.

The name map is the 425-row directory, cached in memory and refreshed every ten minutes.
"""
from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy import select

_TTL = 600.0
_cache: dict[str, Any] = {"at": 0.0, "by_id": {}, "by_en": {}, "prog": {}}


def _maps() -> tuple[dict[str, str], dict[str, str]]:
    if time.monotonic() - _cache["at"] > _TTL:
        from app.core.db import SessionLocal
        from app.models import Program, University

        with SessionLocal() as db:
            rows = db.execute(select(University.id, University.name_en, University.name_ko)).all()
            prows = db.execute(select(University.name_en, Program.name_en, Program.name_ko).join(University, University.id == Program.university_id)).all()
        _cache["by_id"] = {str(i): ko for i, _en, ko in rows if ko}
        _cache["by_en"] = {en: ko for _i, en, ko in rows if en and ko}
        # V31: programme names keyed by (university, programme) in English — the same English programme name can be
        # 경영학과 at one university and 경영학부 at another, so a name alone is never enough.
        _cache["prog"] = {(u, pe): pk for u, pe, pk in prows if u and pe and pk}
        _cache["at"] = time.monotonic()
    return _cache["by_id"], _cache["by_en"]


def _programs() -> dict[tuple[str, str], str]:
    _maps()
    return _cache["prog"]


def localize(node: Any, by_id: dict[str, str], by_en: dict[str, str]) -> int:
    """Rewrite ``university`` values in place for a Korean reader. Returns how many were changed."""
    n = 0
    if isinstance(node, dict):
        v = node.get("university")
        if isinstance(v, str) and v:
            # V31 (REPORT §424): a programme stored beside its university ("program": "Business Administration (BBA)")
            # is resolved by the (university, programme) pair BEFORE the university is rewritten.
            prog = node.get("program")
            if isinstance(prog, str) and prog:
                pk = _programs().get((v, prog))
                if pk and pk != prog:
                    node["program"] = pk
                    n += 1
            ko = by_id.get(str(node.get("university_id") or "")) or by_en.get(v)
            if not ko and " · " in v:
                # V31: an application label "University · Programme" — rewritten only when BOTH parts match exactly.
                u_en, p_en = v.split(" · ", 1)
                u_ko, p_ko = by_en.get(u_en), _programs().get((u_en, p_en))
                if u_ko and p_ko:
                    ko = f"{u_ko} · {p_ko}"
            if ko and ko != v:
                node["university"] = ko
                n += 1
        # V31: `application_label` ("University · Programme", student deadlines) — same both-parts-must-match rule.
        al = node.get("application_label")
        if isinstance(al, str) and al in by_en:
            node["application_label"] = by_en[al]
            n += 1
        elif isinstance(al, str) and " · " in al:
            u_en, p_en = al.split(" · ", 1)
            u_ko, p_ko = by_en.get(u_en), _programs().get((u_en, p_en))
            if u_ko and p_ko:
                node["application_label"] = f"{u_ko} · {p_ko}"
                n += 1
        # V31: a university object of the shape {name, name_ko} (caseload `top_university`) or a waiting party
        # {kind: "university", name} — same exact-match rule, so non-university names are never touched.
        nm = node.get("name")
        if isinstance(nm, str) and nm and nm in by_en and (node.get("kind") == "university" or "name_ko" in node):
            node["name"] = node.get("name_ko") or by_en[nm]
            n += 1
        for child in node.values():
            if isinstance(child, (dict, list)):
                n += localize(child, by_id, by_en)
    elif isinstance(node, list):
        for child in node:
            if isinstance(child, (dict, list)):
                n += localize(child, by_id, by_en)
    return n


def _wants_ko(scope) -> bool:
    for k, v in scope.get("headers") or []:
        if k == b"accept-language":
            return v[:2].lower() == b"ko"
    return False


class LocalizedNamesMiddleware:
    """Pure ASGI, so streaming responses (document downloads) pass through untouched."""

    MAX = 4 * 1024 * 1024

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope.get("path", "").startswith("/api/") or not _wants_ko(scope):
            await self.app(scope, receive, send)
            return
        start: dict | None = None
        chunks: list[bytes] = []
        passthrough = False

        async def wrapped(message):
            nonlocal start, passthrough
            if message["type"] == "http.response.start":
                ctype = dict(message.get("headers") or []).get(b"content-type", b"")
                if not ctype.startswith(b"application/json"):
                    passthrough = True
                    await send(message)
                    return
                start = message
                return
            if passthrough or start is None:
                await send(message)
                return
            chunks.append(message.get("body", b""))
            if message.get("more_body"):
                return
            body = b"".join(chunks)
            if (b'"university"' in body or b'"application_label"' in body or b'"name_ko"' in body or b'"kind":"university"' in body or b'"kind": "university"' in body) and len(body) <= self.MAX:
                try:
                    data = json.loads(body)
                    by_id, by_en = _maps()
                    if localize(data, by_id, by_en):
                        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
                except (ValueError, RuntimeError):
                    pass
            headers = [(k, v) for k, v in start.get("headers", []) if k != b"content-length"]
            headers.append((b"content-length", str(len(body)).encode()))
            await send({**start, "headers": headers})
            await send({"type": "http.response.body", "body": body})

        await self.app(scope, receive, wrapped)
