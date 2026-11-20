"""V34 test helper: a private PostgreSQL database for tests that must start from an empty catalogue or an empty user
base (bootstrap, first admin, migrations) without disturbing the shared, fixture-seeded test database.

The name always contains "test" and derives from HG_TEST_DATABASE_URL, so it can never point at a real database.
"""
from __future__ import annotations

import os
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker


def url_for(suffix: str) -> str:
    from app.core.config import get_settings

    base = make_url(get_settings().test_database_url)
    name = f"{base.database}_{suffix}"
    assert "test" in name
    return base.set(database=name).render_as_string(hide_password=False)


def recreate(url: str) -> None:
    u = make_url(url)
    admin = create_engine(u.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :d AND pid <> pg_backend_pid()"),
                  {"d": u.database})
        c.execute(text(f'DROP DATABASE IF EXISTS "{u.database}"'))
        c.execute(text(f'CREATE DATABASE "{u.database}"'))
    admin.dispose()


def drop(url: str) -> None:
    u = make_url(url)
    admin = create_engine(u.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :d AND pid <> pg_backend_pid()"),
                  {"d": u.database})
        c.execute(text(f'DROP DATABASE IF EXISTS "{u.database}"'))
    admin.dispose()


@contextmanager
def pointed_at(url: str):
    """Temporarily point the settings (and so alembic's env.py) at another database."""
    from app.core.config import get_settings

    old = os.environ.get("HG_DATABASE_URL")
    os.environ["HG_DATABASE_URL"] = url
    get_settings.cache_clear()
    try:
        yield
    finally:
        if old is None:
            os.environ.pop("HG_DATABASE_URL", None)
        else:
            os.environ["HG_DATABASE_URL"] = old
        get_settings.cache_clear()


def alembic(url: str, cmd: str, rev: str) -> None:
    from pathlib import Path

    from alembic.config import Config

    from alembic import command

    cfg = Config()  # no ini file: env.py would otherwise re-run logging.fileConfig in the test process
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    with pointed_at(url):
        getattr(command, cmd)(cfg, rev)


def engine_and_sessions(url: str):
    eng = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
    return eng, sessionmaker(bind=eng, autoflush=False, expire_on_commit=False)
