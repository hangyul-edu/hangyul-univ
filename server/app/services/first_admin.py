"""Create the FIRST Hangyul Operations administrator — once, from a terminal on the server.

    python -m app.services.first_admin --email ops@example.com --name "Operations" --password-file /run/secrets/pw
    python -m app.services.first_admin --email ops@example.com --name "Operations" --password-stdin < pw.txt
    python -m app.services.first_admin --email ops@example.com --name "Operations"            # prompts (TTY), or
    python -m app.services.first_admin --email ops@example.com --name "Operations" --setup-code

* Creates the Hangyul Operations organisation (``hangyul-operations``) if needed and one ``AGENCY_ADMIN`` member.
* **Refuses** when any active operations administrator already exists (any active member of an AGENCY organisation,
  or any non-demo user holding a ``HANGYUL_*`` role). Later administrators are invited from the Operations console.
* The password never appears on the command line: it is read from a file, from stdin, or typed at a hidden prompt —
  or, with ``--setup-code``, the account gets an unusable password and a one-time code (``INVITE`` challenge, valid for
  ``HG_OTP_TTL_SECONDS``) is printed to this terminal only, to be redeemed through ``POST /api/v1/auth/reset-password``.
* MFA follows the existing rule (``services/mfa.login_gate``): an AGENCY_ADMIN is staff, so in production the first
  sign-in must enrol a TOTP factor before anything else. Nothing here weakens that.
* There is no HTTP endpoint for this, on purpose.
"""
from __future__ import annotations

import argparse
import getpass
import secrets
import sys
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Organization, OrganizationMember, User, UserRole, VerificationChallenge
from app.models.base import utcnow
from app.models.enums import HANGYUL_ROLES, OrgType, Role
from app.services.identity import IdentityError, normalize_email
from app.services.operations_org import ensure_operations_org

MIN_PASSWORD = 12


class Refused(RuntimeError):
    pass


def operations_admin_exists(db: Session) -> bool:
    members = db.scalar(select(func.count()).select_from(OrganizationMember)
                        .join(Organization, Organization.id == OrganizationMember.organization_id)
                        .join(User, User.id == OrganizationMember.user_id)
                        .where(Organization.type == OrgType.AGENCY, OrganizationMember.is_active.is_(True), User.is_active.is_(True)))
    hq = db.scalar(select(func.count()).select_from(UserRole).join(User, User.id == UserRole.user_id)
                   .where(UserRole.role.in_(list(HANGYUL_ROLES)), User.is_demo.is_(False), User.is_active.is_(True)))
    return bool(members or hq)


def create_first_admin(db: Session, *, email: str, full_name: str, password: str | None, locale: str = "ko") -> dict:
    if operations_admin_exists(db):
        raise Refused("An operations administrator already exists. Invite further administrators from the Operations console.")
    try:
        email = normalize_email(email)
        # The sign-in form validates with pydantic's EmailStr; an address it rejects (e.g. a *.local domain) would
        # create an administrator who can never sign in.
        from email_validator import EmailNotValidError, validate_email

        validate_email(email, check_deliverability=False)
    except (IdentityError, EmailNotValidError) as exc:
        raise Refused(str(exc)) from None
    if db.scalar(select(User).where(User.email == email)):
        raise Refused("An account with this email already exists.")
    if password is not None and len(password) < MIN_PASSWORD:
        raise Refused(f"The password must be at least {MIN_PASSWORD} characters.")
    org = ensure_operations_org(db)
    now = utcnow()
    user = User(email=email, password_hash=hash_password(password or secrets.token_urlsafe(32)), full_name=full_name.strip()[:200],
                locale=locale, email_verified_at=now if password else None, is_demo=False)
    db.add(user)
    db.flush()
    db.add(OrganizationMember(organization_id=org.id, user_id=user.id, role=Role.AGENCY_ADMIN, title="Administrator", is_active=True))
    out: dict = {"organization": {"id": str(org.id), "slug": org.slug, "name": org.name}, "user_id": str(user.id)}
    if password is None:
        from app.core.config import get_settings
        from app.services import verification
        from app.services.identity import target_hash

        ch = VerificationChallenge(id=uuid.uuid4(), user_id=user.id, purpose="INVITE", channel="EMAIL", target=email,
                                   target_hash=target_hash(email), code_hash="", locale=locale, created_at=now,
                                   expires_at=now + timedelta(seconds=get_settings().otp_ttl_seconds), attempt_count=0,
                                   max_attempts=get_settings().otp_max_attempts, send_count=1, delivery_status="SKIPPED",
                                   provider="console")
        code = verification.generate_code()
        ch.code_hash = verification.code_hash(ch.id, code)
        db.add(ch)
        out["setup"] = {"challenge_id": str(ch.id), "code": code, "expires_in": get_settings().otp_ttl_seconds}
    from app.core.audit import audit

    audit(db, action="accounts.first_admin", entity_type="organization_member", entity_id=user.id, actor=None, subject_user_id=user.id,
          detail={"organization_id": str(org.id), "role": Role.AGENCY_ADMIN.value, "method": "password" if password else "setup_code"})
    db.flush()
    return out


def _read_password(args) -> str | None:
    if args.password_file:
        with open(args.password_file, encoding="utf-8") as f:
            return f.read().rstrip("\n")
    if args.password_stdin:
        return sys.stdin.readline().rstrip("\n")
    if args.setup_code:
        return None
    if sys.stdin.isatty():
        a = getpass.getpass("Password for the first operations administrator: ")
        b = getpass.getpass("Repeat the password: ")
        if a != b:
            raise Refused("The two passwords do not match.")
        return a
    raise Refused("No password source: use --password-file, --password-stdin, --setup-code or run in a terminal.")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.services.first_admin")
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", default="Hangyul Operations")
    ap.add_argument("--locale", default="ko")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--password-file")
    src.add_argument("--password-stdin", action="store_true")
    src.add_argument("--setup-code", action="store_true", help="print a one-time setup code instead of setting a password")
    args = ap.parse_args(argv)
    from app.core.db import SessionLocal

    try:
        password = _read_password(args)
        with SessionLocal() as db:
            out = create_first_admin(db, email=args.email, full_name=args.name, password=password, locale=args.locale)
            db.commit()
    except Refused as exc:
        print(f"refused: {exc}", file=sys.stderr)
        return 2
    print(f"Created the first operations administrator in '{out['organization']['name']}' ({out['organization']['slug']}).")
    if "setup" in out:
        s = out["setup"]
        print("One-time setup code (shown once, valid for", s["expires_in"], "seconds). Set the password with:")
        print(f'  POST /api/v1/auth/reset-password {{"challenge_id": "{s["challenge_id"]}", "code": "{s["code"]}", '
              '"new_password": "…", "new_password_confirm": "…"}')
    print("Sign in to the Operations console; MFA enrolment is required on first sign-in where staff MFA is enforced.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
