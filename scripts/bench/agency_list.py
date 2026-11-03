"""Benchmark the agency caseload endpoints at realistic scale on a SEPARATE database.

    server/.venv/bin/python scripts/bench/agency_list.py [label]

Creates (once) `hangyul_univ_bench` with ~1,000 students, 5,000 applications, 10,000 documents, 20,000 tasks and
2,000 conversations for one agency, then times the list + view-count endpoints in-process and writes
docs/qa/v3/agency/bench-<label>.json. Never touches the development database.
"""
from __future__ import annotations

import json
import os
import random
import statistics
import sys
import time
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "server"
BENCH_URL = "postgresql+psycopg://hangyul:hangyul_dev@localhost:5432/hangyul_univ_bench"
os.environ["HG_DATABASE_URL"] = BENCH_URL
sys.path.insert(0, str(SERVER))
os.chdir(SERVER)

import psycopg  # noqa: E402

with psycopg.connect("postgresql://hangyul:hangyul_dev@localhost:5432/hangyul_univ", autocommit=True) as c:
    if not c.execute("select 1 from pg_database where datname='hangyul_univ_bench'").fetchone():
        c.execute("create database hangyul_univ_bench owner hangyul")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

cfg = Config(str(SERVER / "alembic.ini"))
cfg.set_main_option("sqlalchemy.url", BENCH_URL)
command.upgrade(cfg, "head")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    AgencyAssignment, Application, Conversation, Document, Message, Organization, OrganizationMember, Program, ProgramIntake,
    StudentProfile, Task, University, User, UserRole,
)
from app.models.base import utcnow  # noqa: E402
from app.models.enums import (  # noqa: E402
    ApplicationStatus, AssignmentStatus, ConversationKind, DegreeLevel, DocumentCategory, DocumentStatus, InstitutionType,
    InstructionLanguage, IntakeTerm, OrgType, PipelineStage, Role, TaskStatus, TaskType,
)

rng = random.Random(7)
N_STUDENTS, APPS_PER, DOCS_PER, TASKS_PER = 1000, 5, 10, 20
PASSWORD = "Bench!2026"


def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            return
        print("seeding bench database…", flush=True)
        now = utcnow()
        org = Organization(type=OrgType.AGENCY, name="Bench Agency", slug="bench-agency", is_partner=True)
        db.add(org)
        db.flush()
        pw = hash_password(PASSWORD)
        manager = User(email="manager@bench.example.com", password_hash=pw, full_name="Bench Manager")
        counselors = [User(email=f"c{i}@bench.example.com", password_hash=pw, full_name=f"Counselor {i}") for i in range(8)]
        db.add_all([manager, *counselors])
        db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=manager.id, role=Role.AGENCY_MANAGER))
        db.add_all([OrganizationMember(organization_id=org.id, user_id=c.id, role=Role.AGENCY_COUNSELOR) for c in counselors])
        unis = [University(slug=f"u{i}", name_en=f"University {i}", name_ko=f"대학 {i}", institution_type=InstitutionType.PRIVATE, region="Seoul", city="Seoul")
                for i in range(10)]
        db.add_all(unis)
        db.flush()
        intakes = []
        for u in unis:
            for j in range(3):
                p = Program(university_id=u.id, name_en=f"Program {j}", degree_level=DegreeLevel.BACHELOR, field="business",
                            instruction_language=InstructionLanguage.KOREAN)
                db.add(p)
                db.flush()
                for k in range(2):
                    it = ProgramIntake(program_id=p.id, year=2027, term=IntakeTerm.SPRING if k == 0 else IntakeTerm.FALL,
                                       application_deadline=date.today() + timedelta(days=rng.randint(-20, 120)))
                    db.add(it)
                    intakes.append((u, p, it))
        db.flush()
        statuses = list(ApplicationStatus)
        stages = list(PipelineStage)
        for i in range(N_STUDENTS):
            u = User(email=f"s{i}@bench.example.com", password_hash=pw, full_name=f"Student {i:04d}", is_demo=True)
            db.add(u)
            db.flush()
            db.add(UserRole(user_id=u.id, role=Role.STUDENT))
            db.add(StudentProfile(user_id=u.id, nationality=rng.choice(["VN", "CN", "UZ", "MN", "NP"]), pipeline_stage=rng.choice(stages),
                                  target_intake_year=2027, target_intake_term=IntakeTerm.SPRING))
            db.add(AgencyAssignment(student_user_id=u.id, organization_id=org.id, counselor_user_id=rng.choice(counselors).id,
                                    status=AssignmentStatus.ACTIVE, first_response_due_at=now - timedelta(hours=rng.randint(-48, 48)),
                                    first_response_at=None if rng.random() < 0.2 else now))
            for u2, p, it in rng.sample(intakes, APPS_PER):
                db.add(Application(student_user_id=u.id, program_id=p.id, intake_id=it.id, university_id=u2.id, status=rng.choice(statuses),
                                   readiness_percent=rng.randint(20, 100)))
            db.add_all([Document(owner_user_id=u.id, category=rng.choice(list(DocumentCategory)), title="Doc",
                                 status=rng.choice(list(DocumentStatus))) for _ in range(DOCS_PER)])
            db.add_all([Task(title="Task", task_type=rng.choice(list(TaskType)), status=rng.choice(list(TaskStatus)), student_user_id=u.id,
                             owner_org_id=org.id, visible_to_student=rng.random() < 0.4, due_at=now + timedelta(days=rng.randint(-10, 30)))
                        for _ in range(TASKS_PER)])
            if i % 2 == 0:
                conv = Conversation(kind=ConversationKind.STUDENT_SUPPORT, subject="Hi", student_user_id=u.id, last_message_at=now)
                db.add(conv)
                db.flush()
                db.add(Message(conversation_id=conv.id, author_user_id=u.id if rng.random() < 0.5 else manager.id, body="…", created_at=now))
            if i % 100 == 99:
                db.commit()
                print(f"  {i + 1} students", flush=True)
        db.commit()


def bench(label: str) -> None:
    client = TestClient(app)
    r = client.post("/api/v1/auth/login", json={"email": "manager@bench.example.com", "password": PASSWORD, "client": "agency"})
    r.raise_for_status()
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    cases = {
        "list page 1 (50)": "/api/v1/agency/students?page_size=50",
        "list page 10 (50)": "/api/v1/agency/students?page_size=50&page=10",
        "list attention view": "/api/v1/agency/students?page_size=50&view=attention",
        "view counts": "/api/v1/agency/students/views",
    }
    results = {}
    for name, url in cases.items():
        client.get(url, headers=h)  # warm
        times = []
        for _ in range(12):
            t = time.perf_counter()
            res = client.get(url, headers=h)
            times.append((time.perf_counter() - t) * 1000)
            assert res.status_code == 200, res.text[:200]
        times.sort()
        results[name] = {"p50_ms": round(statistics.median(times), 1), "p95_ms": round(times[int(len(times) * 0.95) - 1], 1)}
        print(f"{name:24s} p50 {results[name]['p50_ms']:8.1f} ms   p95 {results[name]['p95_ms']:8.1f} ms", flush=True)
    with SessionLocal() as db:
        volume = {m.__tablename__: db.scalar(select(func.count()).select_from(m)) for m in (StudentProfile, Application, Document, Task, Message)}
    out = ROOT / "docs/qa/v3/agency"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"bench-{label}.json").write_text(json.dumps({"label": label, "volume": volume, "results": results}, indent=2))


if __name__ == "__main__":
    seed()
    bench(sys.argv[1] if len(sys.argv) > 1 else "run")
