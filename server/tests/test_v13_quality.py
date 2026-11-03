"""V13 — application quality check: the essay gates reach the application, and identity stays consistent.

The first test here exists because of a specific eight-pass failure. `strategy.register_essay_hook` was built
in V5, `docs/ADMISSION_SUCCESS.md` has documented it as the writing workstream's hook ever since, and
`test_essay_hook_adds_items` has been green the whole time — because it registers *its own* hook after
clearing the list. It proved the mechanism worked and never once asked whether anything used it. Nothing did.

So this asserts the thing that was actually missing: that the shipped application carries a real registration.
"""
import pytest
from sqlalchemy import select

from app.models import Application, Essay, User
from app.models.enums import ApplicationStatus as S
from app.services import strategy


def test_a_real_essay_hook_is_registered_in_the_running_app():
    """Importing the app must leave the writing workstream's hook in place — not merely leave the list usable."""
    import app.main  # noqa: F401  — the import IS the assertion: it is what registers the hook in production

    names = [f.__name__ for f in strategy._ESSAY_HOOKS]
    assert "application_quality_items" in names, (
        "the writing quality gates no longer reach an application's quality check; "
        f"registered hooks: {names or 'none'}"
    )


def test_gate_blockers_become_named_application_items(db):
    """A quality-gate blocker must arrive as a *named* item, not as a generic 'revise your essay'."""
    from app.services import writing

    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    app = db.scalars(select(Application).where(
        Application.student_user_id == lan.id, Application.status.in_([S.DRAFT, S.DOCUMENT_PREPARATION]))).first()
    essay = db.scalar(select(Essay).where(Essay.application_id == app.id))
    if essay is None:
        pytest.skip("no essay on this application")

    items = writing.application_quality_items(db, essay)
    # Shape, not presence: the seeded essays may legitimately pass every gate.
    for i in items:
        assert i["code"] in {c for c, _s, _o, _r in writing.GATE_ITEM.values()}
        assert i["severity"] == "blocker"
        assert i["params"]["essay_id"] == str(essay.id)
        assert i["action"]["link"].endswith(str(essay.id))
        # The whole point of the hook: the item says which check failed.
        assert i["params"]["gate"]


def test_quality_check_never_reports_a_score(db):
    """Brief Part 6: actionable risks, never an invented probability of admission."""
    lan = db.scalar(select(User).where(User.email == "student@demo.hangyul.kr"))
    app = db.scalars(select(Application).where(
        Application.student_user_id == lan.id, Application.status.in_([S.DRAFT, S.DOCUMENT_PREPARATION]))).first()
    out = strategy.application_strategy(db, app)
    text = repr(out).lower()
    for banned in ("probability", "chance of admission", "acceptance_score", "admission_score"):
        assert banned not in text
    assert out["state"] in ("BLOCKED", "IMPROVABLE", "READY")
