"""Regenerates docs/DATA_MODEL.md from the SQLAlchemy models. Run: python scripts/gen_data_model_doc.py"""
from pathlib import Path

from app.models import Base

GROUPS = {
    "Identity & access": ["users", "user_roles", "organizations", "organization_members", "agency_specialties", "refresh_tokens", "login_events", "consent_records", "data_requests"],
    "Reference, sources & freshness": ["countries", "locales", "sources", "source_snapshots", "freshness_reviews", "legalization_rules"],
    "Catalog": ["universities", "campuses", "colleges", "departments", "programs", "program_intakes", "admission_requirements", "document_requirements", "dormitories", "scholarships", "scholarship_rules"],
    "Student": ["student_profiles", "student_educations", "student_languages", "saved_universities", "comparisons", "match_snapshots", "appointments"],
    "Workflow": ["agency_assignments", "applications", "application_status_history", "documents", "document_versions", "application_documents", "document_reviews", "essays", "essay_versions", "essay_comments", "tasks", "conversations", "conversation_participants", "messages", "message_reads", "notifications"],
    "Business & partnerships": ["service_products", "service_prices", "service_add_ons", "orders", "payments", "partner_contracts", "partner_quotas", "scholarship_pools", "scholarship_awards"],
    "Visa, housing, arrival & lifecycle": ["visa_requirements", "visa_cases", "housing_cases", "arrival_plans", "student_enrollments", "student_terms", "student_outcomes", "support_tickets"],
    "Content, analytics & audit": ["content_articles", "analytics_events", "daily_metrics", "audit_logs"],
}

HEADER = """# Data model

PostgreSQL 16 via SQLAlchemy 2 (typed `Mapped[...]` models in `server/app/models/`) and Alembic migrations (`server/alembic/`).
The reference below is **generated from the models** by `server/scripts/gen_data_model_doc.py` — regenerate after model changes.

## Design notes

- **UUID primary keys** everywhere (non-enumerable IDs), `created_at`/`updated_at` timestamps (UTC).
- **Enums** are stored as `VARCHAR` with Python-side validation (`native_enum=False`) so adding a status never needs a DB type migration. Definitions: `server/app/models/enums.py`.
- **Provenance** (`SourcedMixin`): `source_id`, `source_url`, `verified_at`, `effective_from`, `effective_to`, `verification_status` (`CURRENT | REVIEW_DUE | CHANGED | CONFLICT | ARCHIVED | DEMO`) on universities, programs, intakes, requirements, document requirements, dormitories, scholarships and visa requirements.
- **Time-versioned rules**: `countries.apostille_member` + `apostille_effective_from` (e.g. Vietnam 2026-09-11, Thailand 2027-02-28); `legalization_rules` for country/category/university-specific routes; `visa_requirements` rows per visa type with nationality/consulate specialisations that add or replace generic steps.
- **Tenancy**: `organizations.type ∈ {HANGYUL, AGENCY, UNIVERSITY}`; org-scoped roles on `organization_members`; students are linked to agencies through `agency_assignments` (ACTIVE) and to universities through `applications` (visible to the university only from SUBMITTED on). `applications.university_id` is denormalised for cheap tenant filtering.
- **Documents**: logical `documents` in a student vault + immutable `document_versions` (private storage key, SHA-256, MIME sniffed, malware scan status) + `document_reviews`; `application_documents` links a vault document to a university requirement (reuse across applications) and records whether it is shared with the university.
- **Essays**: `essays` + `essay_versions` (full text per version, diffable) + `essay_comments` (anchored quote, suggestion, INTERNAL vs PARTICIPANTS visibility, resolution).
- **Messaging**: conversations with user or organisation participants; `messages.visibility = INTERNAL` never leaves staff tenants; `message_reads` per user.
- **Partnership economics**: `partner_contracts` (fees, commission, guaranteed minimum, incentive tiers, conditional guarantee terms & criteria), `partner_quotas`, `scholarship_pools` → `scholarship_awards` (PROPOSED → COMMITTED → PAID). `scholarships.kind = HANGYUL_PARTNER` rows point at a pool.
- **JSON columns** only where flexibility is genuinely useful (lists of fields/regions, rule steps, score breakdowns, event properties).
- **Analytics**: raw `analytics_events` + `daily_metrics` rollup (unique per day/metric/scope/dimension) so dashboards never scan raw events.
- **Privacy**: passport numbers stored only masked on the profile; `consent_records` (append-only), `data_requests` (export/delete workflow), `login_events`, `audit_logs` (who accessed whose data).

"""


def main():
    out = [HEADER]
    tables = Base.metadata.tables
    seen = set()
    for group, names in GROUPS.items():
        out.append(f"## {group}\n")
        for n in names:
            t = tables[n]
            seen.add(n)
            out.append(f"### `{n}`\n\n| Column | Type | Null | Notes |\n|---|---|---|---|")
            for c in t.columns:
                notes = []
                if c.primary_key:
                    notes.append("PK")
                for fk in c.foreign_keys:
                    notes.append(f"→ `{fk.column.table.name}`")
                if c.unique:
                    notes.append("unique")
                if c.index:
                    notes.append("indexed")
                typ = str(c.type).replace("VARCHAR", "varchar").split("(")[0].lower()
                out.append(f"| `{c.name}` | {typ} | {'yes' if c.nullable else 'no'} | {' '.join(notes)} |")
            out.append("")
    rest = sorted(set(tables) - seen)
    if rest:
        out.append("## Other\n" + "\n".join(f"- `{r}`" for r in rest))
    Path(__file__).resolve().parents[2].joinpath("docs", "DATA_MODEL.md").write_text("\n".join(out))
    print(f"documented {len(seen)} tables")


if __name__ == "__main__":
    main()
