"""Partner seats used, kept true at runtime (V29 — found while re-running the V4 seed invariant).

`PartnerQuota.used` ("seats used" on the university partnership page) was written by the seed and never again, so the
first real offer at a partner intake left it stale. It is a derived number: the applications of that university,
intake (and programme, when the quota names one) that have reached an offer. This recomputes it whenever an
application enters or leaves the offer stages — the same rule the seed applies.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Application, PartnerContract, PartnerQuota


def sync_for(db: Session, app: Application) -> None:
    from app.seed.extra_40_partner_consistency import OFFER_ONWARD, _intake_apps

    db.flush()
    contracts = db.scalars(select(PartnerContract).where(PartnerContract.university_id == app.university_id)).all()
    for contract in contracts:
        for quota in db.scalars(select(PartnerQuota).where(PartnerQuota.contract_id == contract.id)):
            apps = _intake_apps(db, contract.university_id, quota.intake_label, quota.program_id)
            if any(a.id == app.id for a in apps):
                quota.used = sum(1 for a in apps if a.status in OFFER_ONWARD)
