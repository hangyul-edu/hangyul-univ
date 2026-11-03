"""Tests run against a dedicated PostgreSQL database (HG_TEST_DATABASE_URL), rebuilt and seeded once per session."""
import os
import tempfile

os.environ.setdefault("HG_ENV", "development")  # V23: the server default is production (fail closed)

from app.core.config import Settings  # noqa: E402

_settings = Settings()
os.environ["HG_DATABASE_URL"] = _settings.test_database_url
os.environ["HG_STORAGE_DIR"] = tempfile.mkdtemp(prefix="hg-test-uploads-")
# The suite must never depend on a payment gateway. `server/.env` carries real Toss TEST credentials so the
# running product can take a real test payment (V16, REPORT §135); a test run that inherited them would make
# every purchase in the suite a network call to a third party, and would make the suite's result depend on
# that third party being up. The one file that cares — tests/test_v16_payments.py — turns Toss back on for
# itself and hands it a stub.
os.environ["HG_PAYMENT_PROVIDER"] = "demo"
# V22: one TestClient address runs ~450 tests; the limiter tests set the scale back to 1 for themselves.
os.environ["HG_RATELIMIT_SCALE"] = "1000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.core.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed.fixtures import FIXTURE_PASSWORD as PASSWORD  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded_db():
    assert "test" in str(engine.url), "Refusing to run tests against a non-test database"
    from app.seed import fixtures
    from app.seed import run as seed

    seed.reset(engine)
    fixtures.main()  # reference data + the synthetic test layer (refuses a non-test database)
    _test_fixture_guides()
    yield


def _test_fixture_guides() -> None:
    from scripts.v27_test_fixture_guides import build

    build()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email: str, client_name: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD, "client": client_name})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def student(client):
    return login(client, "student@demo.hangyul.kr", "student")


@pytest.fixture(scope="session")
def lotus_counselor(client):
    return login(client, "counselor@lotus.demo.hangyul.kr", "agency")


@pytest.fixture(scope="session")
def silk_manager(client):
    return login(client, "manager@silk.demo.hangyul.kr", "agency")


@pytest.fixture(scope="session")
def pnu_admin(client):
    return login(client, "admin@pusan.univ.demo.hangyul.kr", "university")


@pytest.fixture(scope="session")
def skku_admin(client):
    return login(client, "admin@sungkyunkwan.univ.demo.hangyul.kr", "university")


@pytest.fixture
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
