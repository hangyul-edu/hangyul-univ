"""V15 — reconcile the demo caseload with the new plan model, and give it something to operate on.

Why this exists. ``seed_products`` writes the three retail plans, and ``run.py`` buys one for each assigned
student *before* their applications and essays are generated. Under the old model that was harmless: the
packages had no limits worth enforcing. Under the new one it produced a dataset where almost every case was
over its allowance — three managed applications on an All-in-One that sells two — which would have made the
Agency Console's scope panel read as a wall of breaches and the 200-case simulation meaningless.

So this runs last and reconciles each student's plan with the work that actually exists on their case:

* most students get the plan that **covers** what their case contains;
* a deliberate minority stay over their limit with an **approved add-on** that covers it — this is what the
  business plan's §6-2 looks like once it is working;
* a smaller minority stay genuinely over with **nothing** covering it, and one has an **offer waiting**.
  These are not untidy data: they are the cases the console exists to surface, and without them the
  entitlement behaviour ships untested against its own demo set.

It also seeds staff institution recommendations, so 추천 대학 최대 N곳 has something to count. Without them
every case reads "0 / 5 사용", which tests nothing.
"""
from __future__ import annotations

import random

from sqlalchemy import func, select

from app.models import (
    AddOnStatus,
    Application,
    Essay,
    EssayReview,
    Order,
    OrderStatus,
    Payment,
    SavedUniversity,
    ServiceAddOn,
    ServiceProduct,
)
from app.models.base import utcnow
from app.services import entitlements as ent_svc

rng = random.Random(20261019)


def _cap(prod: ServiceProduct, key: str) -> int | None:
    """A plan's allowance; ``None`` = not rationed within the contract (V29 Premium editing)."""
    v = (prod.entitlements or {}).get(key, 0)
    return None if v is None else int(v)


def _plan_for(products: dict[str, ServiceProduct], apps: int, rounds: int, roll: float) -> ServiceProduct:
    """Which plan a case with this much work would realistically have been sold.

    Driven by the work rather than by a weighted draw, because the plans *are* defined by it: Basic
    explicitly does not include application management (업무 범위: 대학 지원서 작성·제출 지원 미포함), so a Basic
    student with two live applications is not a realistic case, it is a data error.

    The first version reconciled in the other direction — it capped ``EssayReview.review_round`` down to
    whatever plan had been drawn. That quietly destroyed seeded demo states the rest of the product is
    built on; ``test_seeded_demo_states`` caught a "revised" essay that no longer existed. **The work is
    the fact and the plan is what should fit it**, not the other way round.
    """
    ORDER = ["BASIC", "ALL_IN_ONE", "PREMIUM"]
    floor = next((c for c in ORDER if _cap(products[c], "essay_review_rounds") is None or rounds <= _cap(products[c], "essay_review_rounds")),
                 "PREMIUM")
    if apps == 0:
        by_apps = "BASIC" if roll < 0.75 else "ALL_IN_ONE"
    elif apps <= 2:
        by_apps = "ALL_IN_ONE" if roll < 0.78 else "PREMIUM"
    else:
        by_apps = "PREMIUM"
    return products[max(floor, by_apps, key=ORDER.index)]


def seed(db, ctx) -> None:
    products = {p.code: p for p in db.scalars(select(ServiceProduct))}
    if len(products) < 3:
        return
    prices = {c: next((pr for pr in p.prices if pr.country_code is None), None) for c, p in products.items()}

    orders = db.scalars(select(Order).where(Order.status == OrderStatus.PAID, Order.kind != "ADD_ON")).all()
    # Work per student, read from the records rather than assumed.
    app_counts = dict(db.execute(
        select(Application.student_user_id, func.count())
        .where(Application.status != "DRAFT").group_by(Application.student_user_id)
    ).all())
    round_counts = dict(db.execute(
        select(Essay.owner_user_id, func.max(EssayReview.review_round))
        .join(EssayReview, EssayReview.essay_id == Essay.id).group_by(Essay.owner_user_id)
    ).all())

    over_with_addon = over_bare = offered = 0
    pending: list = []
    for o in orders:
        apps = int(app_counts.get(o.user_id, 0) or 0)
        rounds = int(round_counts.get(o.user_id, 0) or 0)
        chosen = _plan_for(products, apps, rounds, rng.random())

        if chosen.id != o.product_id:
            o.product_id = chosen.id
            price = prices[chosen.code]
            if price is not None:
                o.price_id, o.currency, o.amount_minor = price.id, price.currency, price.amount_minor

        # What is still beyond even Premium. The work stays; an add-on is what brings it into scope, which
        # is the business plan's own answer (§6-2 추가 유료 서비스).
        cap_rounds = _cap(chosen, "essay_review_rounds")
        over_rounds = 0 if cap_rounds is None else max(0, rounds - cap_rounds)
        over_apps = max(0, apps - int(_cap(chosen, "max_managed_applications") or 0))
        if not (over_rounds or over_apps):
            continue
        roll = rng.random()
        if roll < 0.55:
            # V29: an extra is only ever granted by a PAID add-on order, priced inside the catalogue range (the range's
            # lower end here — a demo choice the operator would make, not a default the product applies).
            for key, qty in (("max_managed_applications", over_apps), ("essay_review_rounds", over_rounds)):
                if qty <= 0:
                    continue
                d = ent_svc.add_on_for_key(key)
                unit = d["pricing"]["min_minor"]
                pending.append((o, d, qty, unit, AddOnStatus.ACTIVE))
            over_with_addon += 1
        elif roll < 0.85 and over_rounds > 0:
            # An offer the student has not answered — the state the student's own service page shows.
            d = ent_svc.add_on_for_key("essay_review_rounds")
            pending.append((o, d, over_rounds, d["pricing"]["max_minor"], AddOnStatus.OFFERED))
            offered += 1
        else:
            # Over with nothing covering it: the case the console exists to surface.
            over_bare += 1

    # V29: every demo purchase is a service engagement on the current catalogue, snapshotted like a real checkout.
    db.flush()
    for o in sorted(orders, key=lambda o: (o.paid_at or o.created_at)):
        prod = db.get(ServiceProduct, o.product_id)
        plan = ent_svc.plan_def(prod.code)
        o.kind, o.catalog_version = "PLAN", ent_svc.catalog_version()
        o.plan_snapshot = ent_svc.snapshot(plan, amount_minor=o.amount_minor, currency=o.currency)
        eng = ent_svc.start_engagement(db, o, prod)
        eng.service_started_at = o.paid_at
        ent_svc.recompute_dates(eng)
    db.flush()
    for o, d, qty, unit, status in pending:
        row = ServiceAddOn(user_id=o.user_id, code=d["code"], entitlement_key=d["effect"]["key"], quantity=qty, status=status,
                           unit_amount_minor=unit, amount_minor=unit * qty, currency="USD", catalog_version=ent_svc.catalog_version())
        db.add(row)
        if status == AddOnStatus.ACTIVE:
            ao = Order(user_id=o.user_id, product_id=o.product_id, currency="USD", amount_minor=unit * qty, status=OrderStatus.PAID,
                       kind="ADD_ON", catalog_version=ent_svc.catalog_version(), paid_at=utcnow(),
                       plan_snapshot={"kind": "ADD_ON", "code": d["code"], "quantity": qty, "unit_amount_minor": unit,
                                      "amount_minor": unit * qty, "currency": "USD", "effect": d["effect"]})
            db.add(ao)
            db.flush()
            db.add(Payment(order_id=ao.id, provider="demo", provider_ref=f"demo_addon_{ao.id.hex[:10]}", status="PAID",
                           amount_minor=ao.amount_minor, currency="USD", raw={"demo": True}))
            row.order_id, row.decided_at, row.paid_at, row.activated_at = ao.id, utcnow(), utcnow(), utcnow()

    # 추천 대학: mark some of each student's saved universities as Hangyul's own recommendations, within the
    # plan's allowance for most and at the limit for a few, so the counter has a realistic spread.
    saved = db.scalars(select(SavedUniversity).order_by(SavedUniversity.user_id, SavedUniversity.created_at)).all()
    by_user: dict = {}
    for s in saved:
        by_user.setdefault(s.user_id, []).append(s)
    plan_by_user = {o.user_id: db.get(ServiceProduct, o.product_id) for o in orders}
    for uid, rows in by_user.items():
        plan = plan_by_user.get(uid)
        if plan is None:
            continue
        cap = int(_cap(plan, "max_recommended_institutions") or 0)
        n = min(len(rows), max(0, cap - rng.choice([0, 0, 1, 2])))
        for s in rows[:n]:
            s.source = "HANGYUL"

    db.flush()
    print(f"  V15 plans: reconciled {len(orders)} orders · {over_with_addon} covered by add-on · "
          f"{offered} offer waiting · {over_bare} over with nothing")
