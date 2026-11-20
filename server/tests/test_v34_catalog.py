"""V34 — one authoritative catalogue (owner requirement 3) and the real-service checks.

Three groups:

* pure: the Monday 09:00 Asia/Seoul window, the normaliser (language minimums, tuition/fee matching, excluded units,
  no placeholder programmes), the polite fetcher (robots.txt, per-host interval, retries) — no database, no network;
* shared test database (non-destructive): filter algebra, scholarship linkage, empty-state object, N+1 / query count,
  ETag + 304, worker calendar windows, staff-only health;
* a private database (``<test db>_catalog``): migrate from scratch, seed reference data only, bootstrap from the
  "connected" state (institutions present, universities empty), idempotent refresh, a failing source, retirement,
  link revalidation with mocked HTTP, the first-admin CLI and a registered student's message reaching Operations;
  plus a migration round trip on a database at the previous head holding data.
"""
from __future__ import annotations

import json
import uuid
from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select, text

from tests import v34_isolated_db as iso

API = "/api/v1"


# ================================================================================================ pure

def test_weekly_window_is_monday_0900_seoul():
    from app.services.catalog_ingest.schedule import KST, next_refresh_at, weekly_window

    # Monday 2026-11-16 08:59 KST → the previous Monday's window; 09:00 KST → this Monday's.
    before = datetime(2026, 11, 16, 8, 59, tzinfo=KST)
    at = datetime(2026, 11, 16, 9, 0, tzinfo=KST)
    assert weekly_window(before).astimezone(KST) == datetime(2026, 11, 9, 9, 0, tzinfo=KST)
    assert weekly_window(at).astimezone(KST) == at
    # Sunday 23:00 UTC is already Monday 08:00 in Seoul — still last week's window (UTC would get this wrong).
    sunday_utc = datetime(2026, 11, 22, 23, 0, tzinfo=UTC)
    assert weekly_window(sunday_utc).astimezone(KST) == datetime(2026, 11, 16, 9, 0, tzinfo=KST)
    assert weekly_window(datetime(2026, 11, 23, 0, 0, tzinfo=UTC)).astimezone(KST) == datetime(2026, 11, 23, 9, 0, tzinfo=KST)
    nxt = next_refresh_at(datetime(2026, 11, 19, 12, 0, tzinfo=UTC)).astimezone(KST)
    assert (nxt.weekday(), nxt.hour, nxt.minute, nxt.date()) == (0, 9, 0, date(2026, 11, 23))


def test_language_requirement_only_numeric_application_minimums():
    from app.services.catalog_ingest.normalize import language_requirement

    g = {"language_rules": [
        {"test": "TOPIK", "min": "4", "group": "A"},
        {"test": "KING_SEJONG", "min": "중급2", "group": "A"},
        {"test": "IELTS_ACADEMIC", "min": "5.5", "group": "A"},
        {"test": "TOEFL_IBT", "min": "71", "group": "A"},
        {"test": "OTHER", "min": None, "group": "A"},
    ]}
    r = language_requirement(g)
    assert (r["min_topik_level"], r["min_ielts"], r["min_toefl_ibt"], r["language_alternative"]) == (4, 5.5, 71, True)
    both = language_requirement({"language_rules": [{"test": "TOPIK", "min": "3", "group": "A"}, {"test": "IELTS", "min": "6", "group": "B"}]})
    assert both["language_alternative"] is False  # different groups: both required
    assert language_requirement({"language_rules": [{"test": "TOPIK", "min": "4", "stage": "GRADUATION"}]}) is None
    assert language_requirement({"language_rules": [{"test": "OTHER", "min": None}]}) is None


def test_programme_payloads_skip_excluded_and_never_invent(tmp_path):
    from app.services.catalog_ingest.normalize import _fee, _tuition, programme_payloads

    guides = {"x-univ": {"researched_at": "2026-10-01", "guides": [{
        "status": "VERIFIED", "intake_year": 2027, "term": "SPRING", "degree_level": "BACHELOR", "track": "KOREAN",
        "source_url": "https://x.example/guide.pdf", "title": "2027 guide",
        "rounds": [{"round": "1차", "application_opens": "2026-09-01", "application_closes": "2026-09-10"},
                   {"round": "2차", "application_opens": "2026-11-01", "application_closes": "2026-11-30"}],
        "language_rules": [{"test": "TOPIK", "min": "3", "group": "A"}]}]},
        "y-univ": {"guides": []}}
    (tmp_path / "x-univ.json").write_text(json.dumps({
        "slug": "x-univ", "guide_source_url": "https://x.example/guide.pdf", "intake_year": 2027, "term": "SPRING",
        "degree_level": "BACHELOR", "extracted_at": "2026-11-19", "application_fee_krw": {"value": 150000},
        "tuition": [{"college_ko": ["공과대학"], "per_semester_krw": 6000000, "period_stated_in_guide": True},
                    {"college_ko": ["인문대학"], "per_semester_krw": 5000000, "period_stated_in_guide": False}],
        "units": [
            {"college_ko": "공과대학", "name_ko": "기계공학과", "name_en": "Mechanical Engineering", "field": "mechanical_engineering",
             "instruction_language": "KOREAN", "source_page": "p.3", "evidence": "공과대학 | 기계공학과"},
            {"college_ko": "인문대학", "name_ko": "국어국문학과", "name_en": None, "field": "not-a-field",
             "instruction_language": "KOREAN", "source_page": "p.3", "evidence": "인문대학 | 국어국문학과"},
            {"college_ko": "인문대학", "name_ko": "사학과", "excluded": True, "instruction_language": "KOREAN"},
        ]}), encoding="utf-8")
    (tmp_path / "y-univ.json").write_text(json.dumps({"slug": "y-univ", "degree_level": "BACHELOR", "units": [], "status": "FETCH_FAILED"}))
    out, problems = programme_payloads(guides, files=sorted(tmp_path.glob("*.json")))
    assert problems == []
    assert [p["name_ko"] for p in out] == ["기계공학과", "국어국문학과"]  # excluded unit skipped; no unit list → nothing
    mech, kor = out
    assert mech["tuition_per_semester_krw"] == 6000000 and mech["application_fee_krw"] == 150000
    assert [r["round"] for r in mech["intake"]["rounds"]] == [1, 2] and mech["requirement"]["min_topik_level"] == 3
    # A printed amount whose period the guide does not state is evidence, not a per-semester fact.
    assert kor["tuition_per_semester_krw"] is None and kor["tuition_unverified_period"]["amount_krw"] == 5000000
    assert kor["field"] is None and kor["name_en"] is None
    # Ambiguous tuition (two amounts for one college) is unknown, never a guess.
    assert _tuition([{"college_ko": ["A"], "per_semester_krw": 1}, {"college_ko": ["A"], "per_semester_krw": 2}], {"college_ko": "A", "name_ko": "z"})[0] is None
    fee = {"value": 150000, "by_scope": [{"scope": "base", "value": 150000}, {"scope": "예능", "value": 200000, "college_ko": ["예술"]}]}
    assert _fee(fee, {"college_ko": "예술", "name_ko": "회화과"}) == 200000
    assert _fee(fee, {"college_ko": "공과", "name_ko": "기계공학과"}) == 150000


def test_committed_v33_units_normalise():
    from app.services.catalog_ingest.normalize import programme_files, programme_payloads

    if not programme_files():
        pytest.skip("no v33 programme research committed")
    out, problems = programme_payloads()
    assert out and not problems
    assert all(p["source_url"] and p["verified_at"] and p["evidence"] for p in out)
    assert len({p["key"] for p in out}) == len(out)


class _Clock:
    def __init__(self):
        self.t = 0.0
        self.sleeps: list[float] = []

    def now(self):
        return self.t

    def sleep(self, s):
        self.sleeps.append(s)
        self.t += s


def test_fetcher_respects_robots_rate_limit_and_retries():
    from app.services.catalog_ingest.fetcher import USER_AGENT, PoliteFetcher

    seen: list[tuple[str, str, str]] = []
    flaky = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append((req.method, str(req.url), req.headers.get("user-agent")))
        if req.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private/\n")
        if req.url.path == "/private/x":
            raise AssertionError("a disallowed URL was requested")
        if req.url.path == "/gone.pdf":
            return httpx.Response(404)
        if req.url.path == "/flaky":
            flaky["n"] += 1
            return httpx.Response(503) if flaky["n"] < 2 else httpx.Response(200, headers={"etag": '"v1"'})
        if req.url.path == "/nohead" and req.method == "HEAD":
            return httpx.Response(405)
        return httpx.Response(200, headers={"etag": '"abc"', "content-length": "10"})

    c = _Clock()
    f = PoliteFetcher(min_interval=0.5, transport=httpx.MockTransport(handler), sleep=c.sleep, clock=c.now, backoff=1)
    assert f.min_interval == 2.0  # never faster than one request per 2 s per host
    assert f.check("https://u.example/private/x").status == "ROBOTS_DISALLOWED"
    ok = f.check("https://u.example/page")
    assert ok.status == "OK" and ok.http_status == 200 and '"abc"' in ok.fingerprint
    assert f.check("https://u.example/gone.pdf").status == "BROKEN"
    assert f.check("https://u.example/flaky").status == "OK"  # retried after a 503
    assert f.check("https://u.example/nohead").status == "OK"  # HEAD refused → GET
    assert all(ua == USER_AGENT for _m, _u, ua in seen)
    assert sum(1 for _m, u, _ua in seen if u.endswith("/robots.txt")) == 1  # robots read once per host
    assert c.sleeps and all(s >= 0 for s in c.sleeps) and any(abs(s - 2.0) < 1e-9 for s in c.sleeps)
    f.close()


# ================================================================================================ shared test database

def _programs(client, **params):
    r = client.get(f"{API}/programs", params={"page_size": 200, **params})
    assert r.status_code == 200, r.text
    return r.json()


def test_programs_response_is_backward_compatible_with_catalog_state(client):
    body = _programs(client)
    assert {"items", "total", "page", "page_size", "catalog"} <= set(body)
    assert body["catalog"]["state"] == "READY" and body["catalog"]["programs_total"] >= body["total"] > 0
    unis = client.get(f"{API}/universities").json()
    assert {"items", "total", "page", "page_size", "catalog"} <= set(unis)
    empty = _programs(client, q="zz-no-such-programme-zz")
    assert empty["total"] == 0 and empty["catalog"]["state"] == "READY"  # "no match", not "being prepared"


def test_filter_algebra_or_within_and_across(client, db):
    from app.models import Institution, Program, Scholarship, University

    biz = _programs(client, field="business")["total"]
    eco = _programs(client, field="economics")["total"]
    both = _programs(client, field=["business", "economics"])["total"]
    assert both == biz + eco  # chips in one category OR (a programme has one field) — never AND
    seoul = _programs(client, region="Seoul")["total"]
    busan = _programs(client, region="Busan")["total"]
    assert _programs(client, region=["Seoul", "Busan"])["total"] == seoul + busan
    combo = _programs(client, field=["business", "economics"], region=["Seoul", "Gyeonggi"], has_scholarship="true")
    # Same predicate computed independently: (business ∨ economics) ∧ (Seoul ∨ Gyeonggi) ∧ scholarship(uni ∨ institution).
    rows = db.execute(select(Program, University).join(University, University.id == Program.university_id)
                      .where(Program.is_active.is_(True), Program.field.in_(["business", "economics"]),
                             University.region.in_(["Seoul", "Gyeonggi"]))).all()
    linked = set(db.scalars(select(Scholarship.university_id).where(Scholarship.university_id.is_not(None), Scholarship.verification_status != "ARCHIVED")))
    via_inst = set(db.scalars(select(Institution.catalog_university_id).join(Scholarship, Scholarship.institution_id == Institution.id)
                              .where(Scholarship.verification_status != "ARCHIVED")))
    expected = {str(p.id) for p, u in rows if u.id in linked or u.id in via_inst}
    assert {i["id"] for i in combo["items"]} == expected and combo["total"] == len(expected)
    for item in combo["items"]:
        assert item["field"] in ("business", "economics")
    # degree × language × intake/deadline: every item satisfies every category.
    deadline = (date.today() + timedelta(days=400)).isoformat()
    res = _programs(client, degree=["BACHELOR", "MASTER"], language=["ENGLISH", "BILINGUAL"], intake_term="SPRING", deadline_before=deadline)
    for item in res["items"]:
        assert item["degree_level"] in ("BACHELOR", "MASTER") and item["instruction_language"] in ("ENGLISH", "BILINGUAL")
    assert res["total"] <= _programs(client, degree=["BACHELOR", "MASTER"])["total"]


def test_has_scholarship_follows_institution_linkage(client, db):
    """V27 verified schemes are linked to the directory institution, not the catalogue university."""
    from app.models import Institution, Program, Scholarship, University
    from app.models.enums import ScholarshipKind

    with_schol = set(db.scalars(select(Scholarship.university_id).where(Scholarship.university_id.is_not(None))))
    with_schol |= set(db.scalars(select(Institution.catalog_university_id).join(Scholarship, Scholarship.institution_id == Institution.id)))
    target = db.scalar(select(University).where(University.id.not_in([x for x in with_schol if x]),
                                                University.id.in_(select(Program.university_id).where(Program.is_active.is_(True)))).limit(1))
    if target is None:
        pytest.skip("every fixture university already has a scheme")
    inst = db.scalar(select(Institution).where(Institution.slug == target.slug))
    created_inst = inst is None
    if created_inst:
        inst = Institution(slug=f"t34-{uuid.uuid4().hex[:6]}", academyinfo_id=uuid.uuid4().hex[:12], name_ko="시험대학교", institution_type="UNIVERSITY",
                           establishment="PRIVATE", region=target.region, status="ACTIVE")
        db.add(inst)
    old_link = inst.catalog_university_id
    inst.catalog_university_id = target.id
    db.flush()
    s = Scholarship(institution_id=inst.id, university_id=None, kind=ScholarshipKind.UNIVERSITY, name="T34 scheme", provider="t",
                    verification_status="CURRENT")
    db.add(s)
    db.commit()
    try:
        ids = {i["university_id"] for i in _programs(client, has_scholarship="true")["items"]}
        assert str(target.id) in ids
        unis = client.get(f"{API}/universities", params={"has_scholarship": "true", "page_size": 200}).json()
        assert target.slug in {u["slug"] for u in unis["items"]}
    finally:
        db.delete(s)
        if created_inst:
            db.delete(inst)
        else:
            inst.catalog_university_id = old_link
        db.commit()


class _QueryCounter:
    def __init__(self, engine):
        self.engine, self.n = engine, 0

    def _count(self, *a, **k):
        self.n += 1

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._count)
        return self

    def __exit__(self, *exc):
        event.remove(self.engine, "before_cursor_execute", self._count)


def test_query_count_is_flat(client):
    from app.core.db import engine
    from app.services.catalog_ingest import status

    status.invalidate()
    client.get(f"{API}/programs", params={"page_size": 1})  # warm caches
    client.get(f"{API}/directory/institutions", params={"page_size": 1})
    client.get(f"{API}/universities", params={"page_size": 1})
    counts = {}
    for path in ("/programs", "/directory/institutions", "/universities"):
        per = []
        for size in (5, 60):
            with _QueryCounter(engine) as qc:
                r = client.get(f"{API}{path}", params={"page_size": size})
                assert r.status_code == 200
            per.append(qc.n)
        counts[path] = per
        # Independent of page size (no N+1). One conditional lookup (programme presence) is skipped when a small page holds no
        # catalogue-linked rows, so a 1-query difference is allowed; an N+1 would add ~55 queries between 5 and 60 rows.
        assert per[1] - per[0] <= 1, (path, per)
    assert counts["/programs"][0] <= 12 and counts["/directory/institutions"][0] <= 8, counts


def test_public_catalogue_etag_and_304(client):
    for path in ("/directory/institutions", "/directory/regions", "/public/catalog/status"):
        r = client.get(f"{API}{path}")
        assert r.status_code == 200
        assert r.headers["cache-control"] == "public, max-age=300, stale-while-revalidate=86400"
        etag = r.headers["etag"]
        again = client.get(f"{API}{path}", headers={"If-None-Match": etag})
        assert again.status_code == 304 and again.content == b""
    st = client.get(f"{API}/public/catalog/status").json()
    assert set(st) == {"state", "universities_total", "programs_total"}
    slug = client.get(f"{API}/directory/institutions").json()["items"][0]["slug"]
    d = client.get(f"{API}/directory/institutions/{slug}")
    assert d.status_code == 200 and "etag" in d.headers and "university_id" in d.json()


def test_ops_catalog_health_is_staff_only(client, student, lotus_counselor):
    assert client.get(f"{API}/ops/catalog/health", headers=student).status_code in (403, 404)
    assert client.get(f"{API}/ops/catalog/health").status_code in (401, 403)
    r = client.get(f"{API}/ops/catalog/health", headers=lotus_counselor)
    assert r.status_code == 200, r.text
    h = r.json()
    assert {"counts", "last_run", "last_full_success", "next_refresh_at", "failed_sources", "stale_records", "state"} <= set(h)
    assert h["next_refresh_at"].endswith("+09:00") and h["schedule"]["timezone"] == "Asia/Seoul"
    for k in ("universities", "programmes", "intakes", "admission_requirements", "document_requirements", "scholarships",
              "dormitories", "official_guides", "official_videos"):
        assert isinstance(h["counts"][k], int)


def test_worker_calendar_window_runs_once_per_window(db):
    from app.models import JobRun
    from app.worker import JOBS, Job, run_job

    calls = []
    windows = {"w": datetime(2026, 11, 16, 0, 0, tzinfo=UTC)}
    name = f"t34_{uuid.uuid4().hex[:6]}"
    job = Job(name, 7 * 86400, lambda _db: calls.append(1) or {"ok": True}, window_fn=lambda now: windows["w"])
    JOBS[name] = job
    try:
        assert run_job(job) == "SUCCEEDED"
        assert run_job(job) == "SKIPPED_DONE"
        windows["w"] = None
        assert run_job(job) == "SKIPPED_NOT_DUE"
        windows["w"] = datetime(2026, 11, 23, 0, 0, tzinfo=UTC)
        assert run_job(job) == "SUCCEEDED"
        assert len(calls) == 2
        assert db.scalar(select(func.count()).select_from(JobRun).where(JobRun.name == name)) == 2
    finally:
        JOBS.pop(name)
    from app.services.catalog_ingest.schedule import weekly_window

    assert JOBS["catalog_refresh"].window_fn(datetime(2026, 11, 19, 3, 0, tzinfo=UTC)) == weekly_window(datetime(2026, 11, 19, 3, 0, tzinfo=UTC))


# ================================================================================================ private database

@pytest.fixture(scope="module")
def cat():
    """A fresh database: alembic upgrade head (fresh-DB migration test), then reference data only — the connected
    environment's state (425 institutions, no universities, no users)."""
    from app.seed.run import seed_reference_all

    url = iso.url_for("catalog")
    iso.recreate(url)
    iso.alembic(url, "upgrade", "head")
    eng, sf = iso.engine_and_sessions(url)
    with sf() as db:
        seed_reference_all(db)
        db.commit()
    yield {"url": url, "engine": eng, "sf": sf}
    eng.dispose()
    iso.drop(url)


@pytest.fixture(scope="module")
def cat_client(cat):
    from app.core.db import get_db
    from app.main import app

    def _db():
        s = cat["sf"]()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


def _n(db, model, *where):
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def test_bootstrap_fills_an_empty_catalogue(cat, cat_client):
    from app.models import (
        AdmissionGuide,
        AdmissionRequirement,
        CatalogState,
        DocumentRequirement,
        Institution,
        Program,
        ProgramIntake,
        Scholarship,
        University,
        User,
    )
    from app.services.catalog_ingest import bootstrap, normalize, status

    sf, eng = cat["sf"], cat["engine"]
    with sf() as db:
        assert _n(db, University) == 0 and _n(db, Institution) == 425 and _n(db, User) == 0
    status.invalidate()
    assert cat_client.get(f"{API}/public/catalog/status").json()["state"] == "EMPTY"

    out = bootstrap.run_bootstrap(trigger="TEST", sf=sf, eng=eng)
    assert out["status"] == "SUCCEEDED", out
    with sf() as db:
        active = db.scalars(select(Institution).where(Institution.status == "ACTIVE")).all()
        unis = {u.slug: u for u in db.scalars(select(University))}
        assert len(unis) == len(active) == 425
        for i in active:
            assert i.catalog_university_id == unis[i.slug].id  # one University per institution, same slug
        sample = unis["pusan-national-university"]
        assert sample.name_ko == "부산대학교" and sample.institution_type.value == "NATIONAL" and sample.institution_kind == "UNIVERSITY"
        assert sample.source_url and sample.verification_status == "CURRENT"
        unnamed = [u for u in unis.values() if u.name_en_recorded is False]
        assert unnamed and all(u.name_en == u.name_ko for u in unnamed)  # official Korean name, flagged — never translated
        payloads, _ = normalize.programme_payloads()
        assert _n(db, Program, Program.is_active.is_(True)) == len(payloads)
        assert _n(db, Program, Program.origin == "OFFICIAL_GUIDE", Program.source_url.is_(None)) == 0
        assert _n(db, ProgramIntake) > 0 and _n(db, AdmissionRequirement) > 0
        # V27 research rows now hang off the catalogue universities as well (no duplicates created).
        assert _n(db, DocumentRequirement, DocumentRequirement.guide_id.is_not(None), DocumentRequirement.university_id.is_(None)) == 0
        assert _n(db, Scholarship, Scholarship.institution_id.is_not(None), Scholarship.university_id.is_(None)) == 0
        assert _n(db, AdmissionGuide, AdmissionGuide.university_id.is_(None)) == 0
        excluded = _n(db, Program, Program.name_ko == "국어국문학과", Program.university_id == unis["chung-ang-university"].id)
        assert excluded == 0  # CAU 국어국문학과 is transfer-only (excluded) in the guide
        # A stale guide's dates are kept but never offered as open.
        assert _n(db, ProgramIntake, ProgramIntake.verification_status == "STALE", ProgramIntake.is_open.is_(True)) == 0
        assert db.get(CatalogState, "bootstrap").value["universities"] == 425
        assert db.get(CatalogState, "revalidation").value["requested_at"]
        assert _n(db, User) == 0  # the bootstrap never creates users
    status.invalidate()
    uni_api = cat_client.get(f"{API}/universities", params={"page_size": 200}).json()
    assert uni_api["total"] == 425 and uni_api["catalog"]["state"] == "READY"
    directory = cat_client.get(f"{API}/directory/institutions", params={"page_size": 200}).json()
    assert directory["total"] == 425
    dir_slugs = set()
    for page in range(1, 4):
        dir_slugs |= {i["slug"] for i in cat_client.get(f"{API}/directory/institutions", params={"page_size": 200, "page": page}).json()["items"]}
    api_slugs = set()
    for page in range(1, 4):
        api_slugs |= {u["slug"] for u in cat_client.get(f"{API}/universities", params={"page_size": 200, "page": page}).json()["items"]}
    assert dir_slugs == api_slugs and len(api_slugs) == 425  # Marketing and Student share canonical slugs
    card = next(i for i in directory["items"] if i["slug"] == "pusan-national-university") if any(
        i["slug"] == "pusan-national-university" for i in directory["items"]) else cat_client.get(
        f"{API}/directory/institutions/pusan-national-university").json()
    assert card["has_catalog"] is True and card["university_id"]
    # Restart: the marker + non-empty check mean nothing runs again.
    assert bootstrap.run_bootstrap(trigger="TEST", sf=sf, eng=eng)["status"] == "NOT_NEEDED"


def test_refresh_is_idempotent_and_survives_a_failing_source(cat):
    from app.models import CatalogSourceResult, Program, University
    from app.services.catalog_ingest import pipeline, sources

    sf, eng = cat["sf"], cat["engine"]
    first = pipeline.run(kind="REFRESH", trigger="TEST", full=False, sf=sf, eng=eng)
    assert first["status"] == "SUCCEEDED" and first["created"] == 0, first
    assert first["unchanged"] > 0

    def broken(_db):
        raise RuntimeError("official site timed out")

    specs = [s if s.key != "official.guides.units" else sources.SourceSpec(s.key, s.priority, s.tier, s.description, broken)
             for s in sources.SOURCES]
    with sf() as db:
        before = (_n(db, University), _n(db, Program, Program.is_active.is_(True)))
    out = pipeline.run(kind="REFRESH", trigger="TEST", full=False, sf=sf, eng=eng, sources=specs)
    assert out["status"] == "PARTIAL" and out["source_failures"] == 1
    with sf() as db:
        assert (_n(db, University), _n(db, Program, Program.is_active.is_(True))) == before  # previous values kept
        failed = db.scalar(select(CatalogSourceResult).where(CatalogSourceResult.source_key == "official.guides.units",
                                                             CatalogSourceResult.status == "FAILED"))
        assert failed is not None and "timed out" in failed.error


def test_retired_unit_is_deactivated_not_deleted(cat):
    from app.models import Program
    from app.services.catalog_ingest import pipeline, sources

    sf, eng = cat["sf"], cat["engine"]
    real = sources.collect_programmes

    def minus_one(db):
        out = real(db)
        dropped = next(r for r in out.records if r.payload["slug"] == "sogang-university")
        out.records = [r for r in out.records if r is not dropped]
        minus_one.key = dropped.entity_key
        return out

    specs = [s if s.key != "official.guides.units" else sources.SourceSpec(s.key, s.priority, s.tier, s.description, minus_one)
             for s in sources.SOURCES]
    out = pipeline.run(kind="REFRESH", trigger="TEST", full=False, sf=sf, eng=eng, sources=specs)
    assert out["retired"] == 1
    with sf() as db:
        p = db.scalar(select(Program).where(Program.catalog_key == minus_one.key))
        assert p is not None and p.is_active is False and all(not i.is_open for i in p.intakes)
    pipeline.run(kind="REFRESH", trigger="TEST", full=False, sf=sf, eng=eng)  # restored by the next full list
    with sf() as db:
        assert db.scalar(select(Program).where(Program.catalog_key == minus_one.key)).is_active is True


def test_link_revalidation_flags_without_losing_data(cat):
    from app.models import AdmissionGuide, CatalogLinkCheck, DocumentRequirement
    from app.services.catalog_ingest import pipeline
    from app.services.catalog_ingest.fetcher import PoliteFetcher

    sf, eng = cat["sf"], cat["engine"]
    with sf() as db:
        guide = db.scalar(select(AdmissionGuide).where(AdmissionGuide.status == "VERIFIED").limit(1))
        gone = guide.source_url
        reqs = _n(db, DocumentRequirement, DocumentRequirement.guide_id == guide.id)

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        if str(req.url) == str(httpx.URL(gone)):
            return httpx.Response(404)
        return httpx.Response(200, headers={"etag": '"1"'})

    fetcher = PoliteFetcher(transport=httpx.MockTransport(handler), sleep=lambda s: None)
    out = pipeline.run(kind="REVALIDATE", trigger="TEST", full=True, sf=sf, eng=eng, fetcher=fetcher, link_checks=True)
    assert out["status"] == "SUCCEEDED" and out["full"] is True, out
    with sf() as db:
        g = db.get(AdmissionGuide, guide.id)
        assert g.verification_status == "REVIEW_DUE" and g.status == "VERIFIED"  # flagged, still usable
        assert _n(db, DocumentRequirement, DocumentRequirement.guide_id == guide.id) == reqs  # data kept
        assert _n(db, CatalogLinkCheck, CatalogLinkCheck.status == "BROKEN") >= 1
        assert _n(db, CatalogLinkCheck, CatalogLinkCheck.status == "OK") > 100
    with sf() as db:
        from app.services.catalog_ingest import status

        h = status.health(db)
        assert h["last_full_success"]["id"] == out["id"]
        assert any(x["source_url"] == gone for x in h["stale_records"]["guides_review_due"])


def test_first_admin_and_registered_student_reaches_operations(cat, cat_client, capsys):
    from app.models import Organization, OrganizationMember
    from app.services import first_admin
    from tests.v22_helpers import register_student

    sf = cat["sf"]
    with sf() as db:
        out = first_admin.create_first_admin(db, email="Ops.Admin@Example.com", full_name="Operations", password="a-long-enough-pw-34")
        db.commit()
        assert out["organization"]["slug"] == "hangyul-operations"
        with pytest.raises(first_admin.Refused):
            first_admin.create_first_admin(db, email="second@example.com", full_name="Second", password="another-long-pw-34")
        db.rollback()
        org = db.scalar(select(Organization).where(Organization.slug == "hangyul-operations"))
        assert _n(db, OrganizationMember, OrganizationMember.organization_id == org.id) == 1
    # The CLI refuses too, and never prints a password.
    assert first_admin.main(["--email", "third@example.com", "--setup-code"]) == 2
    assert "refused" in capsys.readouterr().err

    s = register_student(cat_client, email=f"real-{uuid.uuid4().hex[:6]}@example.com")
    r = cat_client.post(f"{API}/conversations", headers=s["h"], json={"subject": "Question", "body": "Hello, I need help choosing."})
    assert r.status_code == 201, r.text
    conv_id = r.json()["id"]
    login = cat_client.post(f"{API}/auth/login", json={"email": "ops.admin@example.com", "password": "a-long-enough-pw-34", "client": "agency"})
    assert login.status_code == 200, login.text
    ops = {"Authorization": f"Bearer {login.json()['access_token']}"}
    inbox = cat_client.get(f"{API}/conversations", headers=ops)
    assert inbox.status_code == 200 and conv_id in {c["id"] for c in inbox.json()}
    msgs = cat_client.get(f"{API}/conversations/{conv_id}/messages", headers=ops).json()["messages"]
    assert any("Hello, I need help" in m["body"] for m in msgs)
    health = cat_client.get(f"{API}/ops/catalog/health", headers=ops)
    assert health.status_code == 200 and health.json()["counts"]["universities"] == 425


def test_status_counts_cli_has_no_personal_data(cat, capsys):
    from app.services.catalog_ingest.__main__ import operational_counts

    with cat["sf"]() as db:
        c = operational_counts(db)
    assert c["students"] == 1 and c["operations_admins"] == 1 and c["universities"] == 425
    assert c["conversations"] >= 1 and c["messages"] >= 1
    assert all(isinstance(v, int) for v in c.values())
    blob = json.dumps(c)
    assert "@" not in blob and "example.com" not in blob


# ================================================================================================ migration round trip

def test_migration_upgrade_with_data_and_round_trip():
    url = iso.url_for("migr")
    iso.recreate(url)
    try:
        iso.alembic(url, "upgrade", "v33billing0001")
        eng, _sf = iso.engine_and_sessions(url)
        uid, pid, iid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        with eng.begin() as c:
            c.execute(text("INSERT INTO universities (id, slug, name_en, name_ko, institution_type, region, city, has_international_office, "
                           "is_partner, certification_status, verification_status, created_at, updated_at) VALUES "
                           "(:id, 'old-u', 'Old U', '옛대학교', 'PRIVATE', 'Seoul', 'Seoul', true, false, 'UNKNOWN', 'DEMO', now(), now())"), {"id": uid})
            c.execute(text("INSERT INTO programs (id, university_id, name_en, degree_level, field, instruction_language, is_active, "
                           "verification_status, created_at, updated_at) VALUES (:id, :u, 'BBA', 'BACHELOR', 'business', 'KOREAN', true, 'DEMO', now(), now())"),
                      {"id": pid, "u": uid})
            c.execute(text("INSERT INTO institutions (id, slug, academyinfo_id, name_ko, institution_type, establishment, region, status, "
                           "ieqas_certified, ieqas_excellent, ieqas_language_programme, catalog_university_id, created_at, updated_at) VALUES "
                           "(:id, 'old-u', '0000001', '옛대학교', 'UNIVERSITY', 'PRIVATE', 'Seoul', 'ACTIVE', false, false, false, :u, now(), now())"),
                      {"id": iid, "u": uid})
        eng.dispose()
        iso.alembic(url, "upgrade", "head")
        eng, _sf = iso.engine_and_sessions(url)
        with eng.connect() as c:
            row = c.execute(text("SELECT name_en, city, institution_kind, name_en_recorded FROM universities WHERE id = :id"), {"id": uid}).one()
            assert tuple(row) == ("Old U", "Seoul", None, None)
            p = c.execute(text("SELECT field, catalog_key, origin FROM programs WHERE id = :id"), {"id": pid}).one()
            assert tuple(p) == ("business", None, None)
            assert c.execute(text("SELECT count(*) FROM catalog_ingestion_runs")).scalar() == 0
            assert c.execute(text("SELECT catalog_university_id FROM institutions WHERE id = :id"), {"id": iid}).scalar() == uid
        eng.dispose()
        iso.alembic(url, "downgrade", "v33billing0001")
        eng, _sf = iso.engine_and_sessions(url)
        with eng.connect() as c:
            assert c.execute(text("SELECT to_regclass('catalog_ingestion_runs')")).scalar() is None
            assert c.execute(text("SELECT name_en FROM universities WHERE id = :id"), {"id": uid}).scalar() == "Old U"
            assert c.execute(text("SELECT count(*) FROM programs")).scalar() == 1
        eng.dispose()
        iso.alembic(url, "upgrade", "head")
        eng, _sf = iso.engine_and_sessions(url)
        with eng.connect() as c:
            assert c.execute(text("SELECT version_num FROM alembic_version")).scalar() == "v34catalog0001"
            assert c.execute(text("SELECT count(*) FROM universities")).scalar() == 1
        eng.dispose()
    finally:
        iso.drop(url)
