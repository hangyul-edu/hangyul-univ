"""V34: HTTP caching for anonymous public catalogue GETs (`/directory/*`, `/public/catalog/status`).

A strong-enough validator (SHA-256 of the serialised body, weak ETag because the body is re-serialised per request)
plus `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. A matching `If-None-Match` gets an empty 304.
The catalogue changes at most weekly (and on a bootstrap), so five minutes fresh / a day stale-while-revalidate keeps
pages instant without ever serving a catalogue more than a refresh behind.
"""
from __future__ import annotations

import hashlib
import json

from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder

PUBLIC_CACHE = "public, max-age=300, stale-while-revalidate=86400"


def cached_json(request: Request, payload, *, cache_control: str = PUBLIC_CACHE) -> Response:
    body = json.dumps(jsonable_encoder(payload), ensure_ascii=False, separators=(",", ":")).encode()
    etag = 'W/"' + hashlib.sha256(body).hexdigest()[:32] + '"'
    headers = {"ETag": etag, "Cache-Control": cache_control, "Vary": "Accept-Language"}
    inm = request.headers.get("if-none-match")
    if inm and (inm.strip() == "*" or etag in {t.strip() for t in inm.split(",")}):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)
