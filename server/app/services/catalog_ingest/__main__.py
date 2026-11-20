"""``python -m app.services.catalog_ingest bootstrap | refresh [--no-links] | status [--counts] [--json]``

``status --counts`` is read-only and prints aggregate counts only (no names, e-mails or any other personal data), so
it is safe to run against the connected production database.
"""

from __future__ import annotations

import argparse
import json
import sys

from sqlalchemy import func, select


def operational_counts(db) -> dict:
    """Aggregate counts of the live service. Numbers only — never a name, e-mail or identifier."""
    from app.models import (
        AgencyAssignment,
        Application,
        Conversation,
        Message,
        Organization,
        OrganizationMember,
        Program,
        ProgramIntake,
        University,
        User,
        UserRole,
    )
    from app.models.enums import AssignmentStatus, OrgType, Role

    def n(stmt) -> int:
        return int(db.scalar(stmt) or 0)

    real = User.is_demo.is_(False)
    students = n(select(func.count(func.distinct(UserRole.user_id))).join(User, User.id == UserRole.user_id)
                 .where(UserRole.role == Role.STUDENT, real))
    ops_admins = n(select(func.count(func.distinct(OrganizationMember.user_id)))
                   .join(Organization, Organization.id == OrganizationMember.organization_id)
                   .join(User, User.id == OrganizationMember.user_id)
                   .where(Organization.type == OrgType.AGENCY, OrganizationMember.is_active.is_(True), real))
    hq_staff = n(select(func.count(func.distinct(UserRole.user_id))).join(User, User.id == UserRole.user_id)
                 .where(UserRole.role.in_([Role.HANGYUL_SUPER_ADMIN, Role.HANGYUL_OPERATIONS, Role.HANGYUL_COUNSELOR, Role.HANGYUL_FINANCE]), real))
    uni_users = n(select(func.count(func.distinct(OrganizationMember.user_id)))
                  .join(Organization, Organization.id == OrganizationMember.organization_id)
                  .join(User, User.id == OrganizationMember.user_id)
                  .where(Organization.type == OrgType.UNIVERSITY, OrganizationMember.is_active.is_(True), real))
    return {
        "students": students,
        "operations_admins": ops_admins,
        "hangyul_staff_global_roles": hq_staff,
        "university_users": uni_users,
        "operations_organisations": n(select(func.count()).select_from(Organization).where(Organization.type == OrgType.AGENCY)),
        "students_assigned_to_operations": n(select(func.count()).select_from(AgencyAssignment).where(AgencyAssignment.status == AssignmentStatus.ACTIVE)),
        "universities": n(select(func.count()).select_from(University)),
        "programmes": n(select(func.count()).select_from(Program).where(Program.is_active.is_(True))),
        "intakes": n(select(func.count()).select_from(ProgramIntake)),
        "applications": n(select(func.count()).select_from(Application)),
        "conversations": n(select(func.count()).select_from(Conversation)),
        "messages": n(select(func.count()).select_from(Message)),
        "demo_users_excluded": n(select(func.count()).select_from(User).where(User.is_demo.is_(True))),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.services.catalog_ingest")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("bootstrap", help="fill an empty catalogue (no-op when it already has universities)")
    r = sub.add_parser("refresh", help="run the staged pipeline now (full refresh)")
    r.add_argument("--no-links", action="store_true", help="skip the official-link revalidation (no network)")
    s = sub.add_parser("status", help="read-only: catalogue state, last/next refresh")
    s.add_argument("--counts", action="store_true", help="also print aggregate service counts (no personal data)")
    s.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    from app.core.db import SessionLocal
    from app.services.catalog_ingest import bootstrap, pipeline, status

    if args.cmd == "bootstrap":
        out = bootstrap.run_bootstrap(trigger="CLI")
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0 if out.get("status") in ("SUCCEEDED", "PARTIAL", "NOT_NEEDED") else 1
    if args.cmd == "refresh":
        try:
            out = pipeline.run(kind="REFRESH", trigger="CLI", full=True, link_checks=False if args.no_links else None)
        except pipeline.CatalogBusy as exc:
            print(str(exc), file=sys.stderr)
            return 2
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0 if out["status"] in ("SUCCEEDED", "PARTIAL") else 1
    with SessionLocal() as db:
        h = status.health(db)
        out = {"state": h["state"], "catalogue": h["counts"], "last_run": h["last_run"], "last_full_success": h["last_full_success"],
               "next_refresh_at": h["next_refresh_at"], "failed_sources": [f["source"] for f in h["failed_sources"]],
               "stale": {"broken_links": len(h["stale_records"]["broken_links"]), "guides_review_due": len(h["stale_records"]["guides_review_due"]),
                         "stale_intakes": h["stale_records"]["stale_intakes"]}}
        if args.counts:
            out["service"] = operational_counts(db)
        db.rollback()
    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
    else:
        def flat(prefix, v):
            if isinstance(v, dict):
                for k, x in v.items():
                    flat(f"{prefix}.{k}" if prefix else k, x)
            else:
                print(f"{prefix:45s} {v}")
        flat("", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
