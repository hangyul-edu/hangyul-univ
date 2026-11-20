"""V34 catalogue observability.

`GET /ops/catalog/health`     Operations only (Hangyul staff or the Hangyul operations team, `AGENCY_ADMIN`): counts,
                              last run, last full success, next scheduled refresh (Asia/Seoul), failed sources, stale
                              records.
`GET /public/catalog/status`  anonymous: counts + READY | PREPARING | EMPTY — no internals (no URLs, errors or runs).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.caching import cached_json
from app.core.db import get_db
from app.core.deps import Principal, require_agency_or_hangyul
from app.services.catalog_ingest import status

router = APIRouter(tags=["catalog"])


@router.get("/ops/catalog/health")
def catalog_health(p: Principal = Depends(require_agency_or_hangyul), db: Session = Depends(get_db)):
    return status.health(db)


@router.get("/public/catalog/status")
def public_catalog_status(request: Request, db: Session = Depends(get_db)):
    s = status.summary(db)
    return cached_json(request, {"state": s["state"], "universities_total": s["universities_total"], "programs_total": s["programs_total"]})
