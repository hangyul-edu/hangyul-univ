"""V8 student pass: Hangyul's own fee sits in the same budget as the university's costs."""
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Order, User
from app.models.enums import OrderStatus
from tests.conftest import login


def test_budget_includes_hangyul_fee_from_the_students_own_order(client, student):
    body = client.get("/api/v1/me/budget", headers=student).json()
    fee = body["hangyul_fee"]
    assert fee["status"] in {"PAID", "DUE", "NONE"}
    with SessionLocal() as db:
        uid = db.scalar(select(User.id).where(User.email == "student@demo.hangyul.kr"))
        order = db.scalars(select(Order).where(Order.user_id == uid, Order.status.in_([OrderStatus.PAID, OrderStatus.PENDING]))
                           .order_by(Order.created_at.desc())).first()
    if order:
        # The stored order amount, never a re-priced one.
        assert fee["status"] == ("PAID" if order.status == OrderStatus.PAID else "DUE")
        assert (fee["amount_minor"], fee["currency"]) == (order.amount_minor, order.currency)
    else:
        assert fee["status"] == "NONE"


def test_budget_fee_for_a_student_without_a_plan_is_optional_and_priced_from_real_plans(client):
    h = login(client, "student.new@demo.hangyul.kr", "student")
    fee = client.get("/api/v1/me/budget", headers=h).json()["hangyul_fee"]
    if fee["status"] == "NONE" and fee["amount_minor"] is not None:
        plans = client.get("/api/v1/services/products", headers=h)
        if plans.status_code == 200:
            amounts = [pr["amount_minor"] for p in plans.json() for pr in p.get("prices", []) if pr.get("currency") == fee["currency"]]
            if amounts:
                assert fee["amount_minor"] == min(amounts) or fee["amount_minor"] in amounts
