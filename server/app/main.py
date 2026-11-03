import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1 import (
    admin,
    agency,
    applications,
    auth,
    catalog,
    collab,
    concierge,
    devices,
    documents,
    dossier,
    journey,
    public,
    sso,
    student,
    success,
    templates,
    university,
    visa_routes,
    writing,
)
from app.core.config import get_settings
from app.core.db import engine
from app.core.logs import configure_logging

settings = get_settings()
log = logging.getLogger("hangyul")

app = FastAPI(
    title="Hangyul Univ API",
    version="0.1.0",
    description=(
        "Operating system for studying in Korea: students, partner agencies and partner universities.\n\n"
        "All time-sensitive facts carry `source_url`, `verified_at` and `verification_status`. "
        "Records with `verification_status = DEMO` are development sample data and are not verified facts."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# V29: university names in the reader's language, resolved when the response is rendered (app/core/localnames.py).
from app.core.localnames import LocalizedNamesMiddleware  # noqa: E402

app.add_middleware(LocalizedNamesMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


configure_logging(json_format=settings.log_json)  # V29: redaction always; JSON lines in production

#: V29 — the API serves JSON and private files only, so its own policy is "nothing": no scripts, no framing. The file
#: route sets its own narrower CSP (preview panes), which `setdefault` leaves in place.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
HSTS = "max-age=31536000; includeSubDomains"
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "testserver", "0.0.0.0"}


def _transport_security_applies(request: Request) -> bool:
    """HSTS/CSP only in production, and never on a local plain-HTTP request — an HSTS header served to
    `http://localhost` would pin a developer's browser to HTTPS for a year."""
    if not get_settings().is_production:
        return False
    host = (request.url.hostname or "").lower()
    forwarded = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").split(",")[0].strip().lower()
    return host not in _LOCAL_HOSTS or forwarded == "https"


@app.middleware("http")
async def security_headers(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    if _transport_security_applies(request):
        response.headers.setdefault("Strict-Transport-Security", HSTS)
        response.headers.setdefault("Content-Security-Policy", API_CSP)
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - start) * 1000:.1f}"
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    # V29: every 5xx is an operational event (no request body, no query string — paths only).
    from app.services import monitoring

    monitoring.record("API_5XX", f"{request.method} {request.url.path}", f"{type(exc).__name__} on {request.method} {request.url.path}",
                      detail={"exception": type(exc).__name__})
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again."})


PREFIX = "/api/v1"
for r in (auth.router, catalog.router, student.router, journey.router, documents.router, applications.router, collab.router, agency.router, university.router, admin.router, public.router, templates.router, devices.router,
          success.router, dossier.router, writing.router, concierge.router, visa_routes.router):
    app.include_router(r, prefix=PREFIX)
app.include_router(applications.requests_router, prefix=PREFIX)
app.include_router(student.payments_router, prefix=PREFIX)  # V9 reliability: provider payment callback (idempotent)
app.include_router(sso.router, prefix=PREFIX)
from app.api.v1 import directory  # noqa: E402  (V12 public Korean university directory)

app.include_router(directory.router, prefix=PREFIX)
from app.api.v1 import hq_ops  # noqa: E402  (V6 Hangyul operations overview)

app.include_router(hq_ops.router, prefix=PREFIX)
from app.api.v1 import agency_v8  # noqa: E402  (V8 agency + Hangyul operations: manager operations, channels, readiness)

for r in agency_v8.routers:
    app.include_router(r, prefix=PREFIX)
from app.api.v1 import accounts  # noqa: E402  (V22 account rosters: one permission per tenant)

for r in accounts.routers:
    app.include_router(r, prefix=PREFIX)
from app.api.v1 import mfa as mfa_api  # noqa: E402  (V29 staff MFA)
from app.api.v1 import ops_health  # noqa: E402  (V29 monitoring)

app.include_router(mfa_api.router, prefix=PREFIX)
app.include_router(mfa_api.hq_router, prefix=PREFIX)
app.include_router(ops_health.router, prefix=PREFIX)


@app.get("/healthz", tags=["system"])
def healthz():
    with engine.connect() as c:
        c.execute(text("select 1"))
    return {"ok": True, "env": settings.env}


@app.get("/", include_in_schema=False)
def root():
    return {"name": "Hangyul Univ API", "docs": "/docs", "health": "/healthz"}
