# Data model

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


## Identity & access

### `users`

| Column | Type | Null | Notes |
|---|---|---|---|
| `email` | varchar | no | unique indexed |
| `password_hash` | varchar | no |  |
| `full_name` | varchar | no |  |
| `preferred_name` | varchar | yes |  |
| `locale` | varchar | no |  |
| `timezone` | varchar | no |  |
| `phone` | varchar | yes |  |
| `email_verified_at` | datetime | yes |  |
| `phone_verified_at` | datetime | yes |  |
| `is_active` | boolean | no |  |
| `is_demo` | boolean | no |  |
| `last_login_at` | datetime | yes |  |
| `deletion_requested_at` | datetime | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `user_roles`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `role` | varchar | no |  |
| `id` | char | no | PK |

### `organizations`

| Column | Type | Null | Notes |
|---|---|---|---|
| `type` | varchar | no | indexed |
| `name` | varchar | no |  |
| `slug` | varchar | no | unique |
| `country_code` | varchar | yes |  |
| `university_id` | char | yes | → `universities` |
| `is_partner` | boolean | no |  |
| `languages` | json | yes |  |
| `timezone` | varchar | yes |  |
| `capacity_active_cases` | integer | yes |  |
| `sla_first_response_hours` | integer | yes |  |
| `license_number` | varchar | yes |  |
| `is_demo` | boolean | no |  |
| `load_weights` | json | yes |  |
| `legal_name` | varchar | yes |  |
| `registration_status` | varchar | no |  |
| `registration_number` | varchar | yes |  |
| `registration_authority` | varchar | yes |  |
| `registration_checked_on` | date | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `organization_members`

| Column | Type | Null | Notes |
|---|---|---|---|
| `organization_id` | char | no | → `organizations` indexed |
| `user_id` | char | no | → `users` indexed |
| `role` | varchar | no |  |
| `title` | varchar | yes |  |
| `is_active` | boolean | no |  |
| `languages` | json | yes |  |
| `countries` | json | yes |  |
| `university_ids` | json | yes |  |
| `degrees` | json | yes |  |
| `majors` | json | yes |  |
| `capacity_points` | integer | yes |  |
| `on_leave_until` | date | yes |  |
| `leave_note` | varchar | yes |  |
| `left_at` | datetime | yes |  |
| `left_reason` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `agency_specialties`

| Column | Type | Null | Notes |
|---|---|---|---|
| `organization_id` | char | no | → `organizations` indexed |
| `kind` | varchar | no |  |
| `value` | varchar | no |  |
| `weight` | integer | no |  |
| `id` | char | no | PK |

### `refresh_tokens`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `token_hash` | varchar | no | unique |
| `family_id` | char | no | indexed |
| `client` | varchar | no |  |
| `active_org_id` | char | yes |  |
| `created_at` | datetime | no |  |
| `expires_at` | datetime | no |  |
| `revoked_at` | datetime | yes |  |
| `replaced_by` | char | yes |  |
| `user_agent` | varchar | yes |  |
| `ip` | varchar | yes |  |
| `id` | char | no | PK |

### `login_events`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | yes | → `users` indexed |
| `email` | varchar | no |  |
| `success` | boolean | no |  |
| `reason` | varchar | yes |  |
| `client` | varchar | yes |  |
| `ip` | varchar | yes |  |
| `user_agent` | varchar | yes |  |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `consent_records`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `purpose` | varchar | no |  |
| `version` | varchar | no |  |
| `granted` | boolean | no |  |
| `scope_org_id` | char | yes |  |
| `created_at` | datetime | no |  |
| `locale` | varchar | yes |  |
| `document_version` | varchar | yes |  |
| `policy_effective_on` | date | yes |  |
| `ip_hash` | varchar | yes |  |
| `user_agent` | varchar | yes |  |
| `source` | varchar | yes |  |
| `id` | char | no | PK |

### `data_requests`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `kind` | varchar | no |  |
| `status` | varchar | no |  |
| `note` | text | yes |  |
| `due_at` | datetime | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

## Reference, sources & freshness

### `countries`

| Column | Type | Null | Notes |
|---|---|---|---|
| `code` | varchar | no | PK |
| `name_en` | varchar | no |  |
| `name_native` | varchar | yes |  |
| `name_ko` | varchar | yes |  |
| `region` | varchar | no |  |
| `default_locale` | varchar | no |  |
| `currency` | varchar | no |  |
| `is_priority_market` | boolean | no |  |
| `priority_rank` | integer | yes |  |
| `apostille_member` | boolean | yes |  |
| `apostille_effective_from` | date | yes |  |
| `apostille_source_url` | varchar | yes |  |
| `apostille_verified_at` | date | yes |  |
| `aliases` | json | yes |  |

### `locales`

| Column | Type | Null | Notes |
|---|---|---|---|
| `code` | varchar | no | PK |
| `name_en` | varchar | no |  |
| `name_native` | varchar | no |  |
| `direction` | varchar | no |  |
| `translation_status` | varchar | no |  |

### `sources`

| Column | Type | Null | Notes |
|---|---|---|---|
| `key` | varchar | no | unique |
| `name` | varchar | no |  |
| `url` | varchar | no |  |
| `source_type` | varchar | no |  |
| `topic` | varchar | yes |  |
| `summary` | text | yes |  |
| `last_checked_at` | datetime | yes |  |
| `last_changed_at` | datetime | yes |  |
| `review_interval_days` | integer | no |  |
| `status` | varchar | no |  |
| `reviewer_id` | char | yes | → `users` indexed |
| `ingestion_method` | varchar | no |  |
| `terms_note` | text | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `source_snapshots`

| Column | Type | Null | Notes |
|---|---|---|---|
| `source_id` | char | no | → `sources` indexed |
| `checked_at` | datetime | no |  |
| `content_hash` | varchar | yes |  |
| `http_status` | integer | yes |  |
| `note` | text | yes |  |
| `checked_by_id` | char | yes | → `users` indexed |
| `id` | char | no | PK |

### `freshness_reviews`

| Column | Type | Null | Notes |
|---|---|---|---|
| `entity_type` | varchar | no |  |
| `entity_id` | varchar | no |  |
| `entity_label` | varchar | no |  |
| `reason` | varchar | no |  |
| `detail` | text | yes |  |
| `source_id` | char | yes | → `sources` indexed |
| `resolved_at` | datetime | yes |  |
| `resolved_by_id` | char | yes | → `users` indexed |
| `resolution` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `legalization_rules`

| Column | Type | Null | Notes |
|---|---|---|---|
| `issuing_country` | varchar | yes | indexed |
| `document_category` | varchar | yes |  |
| `university_id` | char | yes |  |
| `consulate_note` | text | yes |  |
| `path` | varchar | no |  |
| `requires_notarization` | boolean | no |  |
| `requires_translation` | boolean | no |  |
| `steps` | json | no |  |
| `source_id` | char | yes | → `sources` indexed |
| `verified_at` | datetime | yes |  |
| `verification_status` | varchar | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

## Catalog

### `universities`

| Column | Type | Null | Notes |
|---|---|---|---|
| `slug` | varchar | no | unique |
| `name_en` | varchar | no | indexed |
| `name_ko` | varchar | no |  |
| `institution_type` | varchar | no |  |
| `region` | varchar | no | indexed |
| `city` | varchar | no |  |
| `website_url` | varchar | yes |  |
| `international_admissions_url` | varchar | yes |  |
| `summary` | text | yes |  |
| `founded_year` | integer | yes |  |
| `has_international_office` | boolean | no |  |
| `international_services` | json | yes |  |
| `est_living_cost_monthly_krw` | integer | yes |  |
| `is_partner` | boolean | no |  |
| `certification_status` | varchar | no |  |
| `certification_source_url` | varchar | yes |  |
| `certification_verified_at` | date | yes |  |
| `visa_certification` | varchar | yes |  |
| `visa_certification_verified_at` | date | yes |  |
| `brand_color` | varchar | yes |  |
| `latitude` | float | yes |  |
| `longitude` | float | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `campuses`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | no | → `universities` indexed |
| `name` | varchar | no |  |
| `city` | varchar | no |  |
| `address` | varchar | yes |  |
| `is_main` | boolean | no |  |
| `id` | char | no | PK |

### `colleges`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | no | → `universities` indexed |
| `name` | varchar | no |  |
| `id` | char | no | PK |

### `departments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `college_id` | char | no | → `colleges` indexed |
| `name` | varchar | no |  |
| `id` | char | no | PK |

### `programs`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | no | → `universities` indexed |
| `campus_id` | char | yes | → `campuses` indexed |
| `department_id` | char | yes | → `departments` indexed |
| `name_en` | varchar | no | indexed |
| `name_ko` | varchar | yes |  |
| `degree_level` | varchar | no | indexed |
| `field` | varchar | no | indexed |
| `instruction_language` | varchar | no |  |
| `duration_semesters` | integer | yes |  |
| `tuition_per_semester_krw` | integer | yes |  |
| `application_fee_krw` | integer | yes |  |
| `description` | text | yes |  |
| `is_active` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `program_intakes`

| Column | Type | Null | Notes |
|---|---|---|---|
| `program_id` | char | no | → `programs` indexed |
| `year` | integer | no |  |
| `term` | varchar | no |  |
| `round` | integer | no |  |
| `application_opens` | date | yes |  |
| `application_deadline` | date | no | indexed |
| `document_deadline` | date | yes |  |
| `interview_window` | varchar | yes |  |
| `decision_date` | date | yes |  |
| `tuition_deadline` | date | yes |  |
| `semester_start` | date | yes |  |
| `seats_international` | integer | yes |  |
| `is_open` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `admission_requirements`

| Column | Type | Null | Notes |
|---|---|---|---|
| `program_id` | char | no | → `programs` indexed |
| `min_prior_education` | varchar | yes |  |
| `min_gpa_percent` | float | yes |  |
| `min_topik_level` | integer | yes |  |
| `min_ielts` | float | yes |  |
| `min_toefl_ibt` | integer | yes |  |
| `language_alternative` | boolean | no |  |
| `requires_both_parents_foreign` | boolean | no |  |
| `excluded_nationalities` | json | yes |  |
| `requires_interview` | boolean | no |  |
| `requires_portfolio` | boolean | no |  |
| `notes` | text | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `document_requirements`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | yes | → `universities` indexed |
| `program_id` | char | yes | → `programs` indexed |
| `degree_level` | varchar | yes |  |
| `category` | varchar | no |  |
| `label` | varchar | no |  |
| `is_required` | boolean | no |  |
| `legalization_required` | boolean | no |  |
| `translation_required` | boolean | no |  |
| `applies_to_nationalities` | json | yes |  |
| `max_age_days` | integer | yes |  |
| `notes` | text | yes |  |
| `sort_order` | integer | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `dormitories`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | no | → `universities` indexed |
| `name` | varchar | no |  |
| `room_types` | json | yes |  |
| `capacity` | integer | yes |  |
| `cost_per_semester_krw_min` | integer | yes |  |
| `cost_per_semester_krw_max` | integer | yes |  |
| `international_priority` | boolean | no |  |
| `meal_plan` | boolean | yes |  |
| `application_note` | text | yes |  |
| `application_opens` | date | yes |  |
| `application_closes` | date | yes |  |
| `eligibility` | text | yes |  |
| `meal_required` | boolean | yes |  |
| `move_in_date` | date | yes |  |
| `deposit_krw` | integer | yes |  |
| `required_documents` | json | yes |  |
| `location` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `scholarships`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | yes | → `universities` indexed |
| `kind` | varchar | no | indexed |
| `name` | varchar | no |  |
| `provider` | varchar | no |  |
| `description` | text | yes |  |
| `coverage` | varchar | yes |  |
| `tuition_waiver_percent_min` | integer | yes |  |
| `tuition_waiver_percent_max` | integer | yes |  |
| `amount_krw` | integer | yes |  |
| `degree_levels` | json | yes |  |
| `application_deadline` | date | yes |  |
| `is_automatic` | boolean | no |  |
| `pool_id` | char | yes | → `scholarship_pools` indexed |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `scholarship_rules`

| Column | Type | Null | Notes |
|---|---|---|---|
| `scholarship_id` | char | no | → `scholarships` indexed |
| `field` | varchar | no |  |
| `operator` | varchar | no |  |
| `value` | varchar | no |  |
| `description` | varchar | no |  |
| `id` | char | no | PK |

## Student

### `student_profiles`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `nationality` | varchar | yes | indexed |
| `residence_country` | varchar | yes |  |
| `date_of_birth` | date | yes |  |
| `gender` | varchar | yes |  |
| `passport_number_masked` | varchar | yes |  |
| `passport_expiry` | date | yes |  |
| `has_passport` | boolean | yes |  |
| `target_degree` | varchar | yes |  |
| `target_intake_year` | integer | yes |  |
| `target_intake_term` | varchar | yes |  |
| `desired_fields` | json | yes |  |
| `preferred_regions` | json | yes |  |
| `preferred_university_ids` | json | yes |  |
| `annual_budget_krw` | integer | yes |  |
| `needs_scholarship` | boolean | yes |  |
| `housing_preference` | varchar | yes |  |
| `korean_self_level` | varchar | yes |  |
| `english_self_level` | varchar | yes |  |
| `previous_korean_visa` | varchar | yes |  |
| `current_korean_visa` | varchar | yes |  |
| `in_korea_now` | boolean | yes |  |
| `financial_sponsor` | varchar | yes |  |
| `academic_priorities` | json | yes |  |
| `career_goal` | text | yes |  |
| `onboarding_step` | integer | no |  |
| `onboarding_completed_at` | datetime | yes |  |
| `pipeline_stage` | varchar | no | indexed |
| `lead_source` | varchar | yes |  |
| `is_demo` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `student_educations`

| Column | Type | Null | Notes |
|---|---|---|---|
| `profile_id` | char | no | → `student_profiles` indexed |
| `level` | varchar | no |  |
| `institution` | varchar | no |  |
| `country` | varchar | no |  |
| `major` | varchar | yes |  |
| `start_year` | integer | yes |  |
| `graduation_year` | integer | yes |  |
| `graduation_status` | varchar | no |  |
| `gpa_value` | float | yes |  |
| `gpa_scale_min` | float | yes |  |
| `gpa_scale_max` | float | yes |  |
| `gpa_percent` | float | yes |  |
| `gpa_override_note` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `student_languages`

| Column | Type | Null | Notes |
|---|---|---|---|
| `profile_id` | char | no | → `student_profiles` indexed |
| `test` | varchar | no |  |
| `score` | float | no |  |
| `test_date` | date | yes |  |
| `expires_on` | date | yes |  |
| `is_planned` | boolean | no |  |
| `verified` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `saved_universities`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `university_id` | char | no | → `universities` indexed |
| `program_id` | char | yes | → `programs` indexed |
| `note` | varchar | yes |  |
| `source` | varchar | no |  |
| `recommended_by_user_id` | char | yes | → `users` indexed |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `comparisons`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `program_ids` | json | no |  |
| `name` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `match_snapshots`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `program_id` | char | no | → `programs` indexed |
| `engine_version` | varchar | no |  |
| `eligible` | boolean | no |  |
| `tier` | varchar | no |  |
| `score` | float | no |  |
| `reasons` | json | no |  |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `appointments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `organization_id` | char | yes | → `organizations` indexed |
| `host_user_id` | char | yes | → `users` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `kind` | varchar | no |  |
| `starts_at` | datetime | no |  |
| `duration_minutes` | integer | no |  |
| `channel` | varchar | no |  |
| `status` | varchar | no |  |
| `notes` | text | yes |  |
| `outcome_notes` | text | yes |  |
| `follow_up_task_id` | char | yes | → `tasks` indexed |
| `decisions` | json | yes |  |
| `follow_up_task_ids` | json | yes |  |
| `next_appointment_id` | char | yes |  |
| `closed_at` | datetime | yes |  |
| `closed_by_user_id` | char | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

## Workflow

### `agency_assignments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `organization_id` | char | no | → `organizations` indexed |
| `counselor_user_id` | char | yes | → `users` indexed |
| `status` | varchar | no | indexed |
| `score` | float | yes |  |
| `score_breakdown` | json | yes |  |
| `assigned_by` | varchar | no |  |
| `override_reason` | varchar | yes |  |
| `order_id` | char | yes | → `orders` indexed |
| `first_response_due_at` | datetime | yes |  |
| `first_response_at` | datetime | yes |  |
| `ended_at` | datetime | yes |  |
| `sub_agent_name` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `applications`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `program_id` | char | no | → `programs` indexed |
| `intake_id` | char | no | → `program_intakes` indexed |
| `university_id` | char | no | → `universities` indexed |
| `agency_org_id` | char | yes | → `organizations` indexed |
| `status` | varchar | no | indexed |
| `readiness_percent` | integer | no |  |
| `submitted_at` | datetime | yes |  |
| `decided_at` | datetime | yes |  |
| `external_reference` | varchar | yes |  |
| `university_reviewer_id` | char | yes | → `users` indexed |
| `flagged` | boolean | no |  |
| `flag_reason` | varchar | yes |  |
| `interview_at` | datetime | yes |  |
| `offer_scholarship_note` | varchar | yes |  |
| `tuition_amount_krw` | integer | yes |  |
| `tuition_due` | date | yes |  |
| `is_demo` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `application_status_history`

| Column | Type | Null | Notes |
|---|---|---|---|
| `application_id` | char | no | → `applications` indexed |
| `from_status` | varchar | yes |  |
| `to_status` | varchar | no |  |
| `actor_user_id` | char | yes | → `users` indexed |
| `actor_org_type` | varchar | yes |  |
| `note` | text | yes |  |
| `created_at` | datetime | no | indexed |
| `id` | char | no | PK |

### `documents`

| Column | Type | Null | Notes |
|---|---|---|---|
| `owner_user_id` | char | no | → `users` indexed |
| `category` | varchar | no | indexed |
| `title` | varchar | no |  |
| `issuing_country` | varchar | yes |  |
| `issue_date` | date | yes |  |
| `expires_on` | date | yes |  |
| `language` | varchar | yes |  |
| `translation_required` | boolean | no |  |
| `legalization_path` | varchar | no |  |
| `legalization_status` | varchar | no |  |
| `legalization_progress` | json | yes |  |
| `status` | varchar | no | indexed |
| `reviewer_user_id` | char | yes | → `users` indexed |
| `rejection_reason` | text | yes |  |
| `reusable` | boolean | no |  |
| `current_version` | integer | no |  |
| `is_demo` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `document_versions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `document_id` | char | no | → `documents` indexed |
| `version` | integer | no |  |
| `storage_key` | varchar | no |  |
| `original_filename` | varchar | no |  |
| `mime_type` | varchar | no |  |
| `size_bytes` | bigint | no |  |
| `sha256` | varchar | no |  |
| `scan_status` | varchar | no |  |
| `uploaded_by_id` | char | yes | → `users` indexed |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `application_documents`

| Column | Type | Null | Notes |
|---|---|---|---|
| `application_id` | char | no | → `applications` indexed |
| `requirement_id` | char | no | → `document_requirements` indexed |
| `document_id` | char | yes | → `documents` indexed |
| `shared_with_university` | boolean | no |  |
| `id` | char | no | PK |

### `document_reviews`

| Column | Type | Null | Notes |
|---|---|---|---|
| `document_id` | char | no | → `documents` indexed |
| `version` | integer | no |  |
| `reviewer_user_id` | char | yes | → `users` indexed |
| `reviewer_org_id` | char | yes | → `organizations` indexed |
| `decision` | varchar | no |  |
| `reason` | text | yes |  |
| `checks` | json | yes |  |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `essays`

| Column | Type | Null | Notes |
|---|---|---|---|
| `owner_user_id` | char | no | → `users` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `program_id` | char | yes | → `programs` indexed |
| `essay_type` | varchar | no |  |
| `title` | varchar | no |  |
| `prompt` | text | yes |  |
| `word_limit` | integer | yes |  |
| `status` | varchar | no | indexed |
| `reviewer_user_id` | char | yes | → `users` indexed |
| `due_date` | date | yes |  |
| `current_version` | integer | no |  |
| `precheck` | json | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `essay_versions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `essay_id` | char | no | → `essays` indexed |
| `version` | integer | no |  |
| `body` | text | no |  |
| `author_user_id` | char | yes | → `users` indexed |
| `note` | varchar | yes |  |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `essay_comments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `essay_id` | char | no | → `essays` indexed |
| `version` | integer | no |  |
| `author_user_id` | char | yes | → `users` indexed |
| `anchor_start` | integer | yes |  |
| `anchor_end` | integer | yes |  |
| `quote` | text | yes |  |
| `body` | text | no |  |
| `suggestion` | text | yes |  |
| `visibility` | varchar | no |  |
| `resolved_at` | datetime | yes |  |
| `resolved_by_id` | char | yes | → `users` indexed |
| `created_at` | datetime | no |  |
| `id` | char | no | PK |

### `tasks`

| Column | Type | Null | Notes |
|---|---|---|---|
| `title` | varchar | no |  |
| `title_key` | varchar | yes |  |
| `title_params` | json | yes |  |
| `description` | text | yes |  |
| `task_type` | varchar | no | indexed |
| `priority` | varchar | no |  |
| `status` | varchar | no | indexed |
| `due_at` | datetime | yes | indexed |
| `owner_user_id` | char | yes | → `users` indexed |
| `owner_org_id` | char | yes | → `organizations` indexed |
| `student_user_id` | char | yes | → `users` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `university_id` | char | yes | → `universities` indexed |
| `depends_on_id` | char | yes | → `tasks` |
| `source` | varchar | no |  |
| `dedupe_key` | varchar | yes | unique |
| `link` | varchar | yes |  |
| `reminder_offsets_hours` | json | yes |  |
| `visible_to_student` | boolean | no |  |
| `completed_at` | datetime | yes |  |
| `created_by_id` | char | yes | → `users` indexed |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `conversations`

| Column | Type | Null | Notes |
|---|---|---|---|
| `kind` | varchar | no |  |
| `subject` | varchar | no |  |
| `student_user_id` | char | yes | → `users` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `last_message_at` | datetime | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `conversation_participants`

| Column | Type | Null | Notes |
|---|---|---|---|
| `conversation_id` | char | no | → `conversations` indexed |
| `user_id` | char | yes | → `users` indexed |
| `organization_id` | char | yes | → `organizations` indexed |
| `id` | char | no | PK |

### `messages`

| Column | Type | Null | Notes |
|---|---|---|---|
| `conversation_id` | char | no | → `conversations` indexed |
| `author_user_id` | char | yes | → `users` indexed |
| `body` | text | no |  |
| `visibility` | varchar | no |  |
| `mentions` | json | yes |  |
| `attachment_document_id` | char | yes | → `documents` indexed |
| `channel` | varchar | no |  |
| `created_task_id` | char | yes | → `tasks` indexed |
| `created_at` | datetime | no | indexed |
| `id` | char | no | PK |

### `message_reads`

| Column | Type | Null | Notes |
|---|---|---|---|
| `conversation_id` | char | no | → `conversations` indexed |
| `user_id` | char | no | → `users` indexed |
| `last_read_at` | datetime | no |  |
| `id` | char | no | PK |

### `notifications`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `kind` | varchar | no |  |
| `title_key` | varchar | no |  |
| `params` | json | yes |  |
| `fallback_text` | varchar | no |  |
| `link` | varchar | yes |  |
| `channel` | varchar | no |  |
| `read_at` | datetime | yes |  |
| `created_at` | datetime | no | indexed |
| `id` | char | no | PK |

## Business & partnerships

### `service_products`

| Column | Type | Null | Notes |
|---|---|---|---|
| `code` | varchar | no | unique |
| `name_key` | varchar | no |  |
| `name_en` | varchar | no |  |
| `name_ko` | varchar | yes |  |
| `tagline_en` | varchar | yes |  |
| `features` | json | no |  |
| `entitlements` | json | no |  |
| `is_recommended` | boolean | no |  |
| `sort_order` | integer | no |  |
| `is_active` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `service_prices`

| Column | Type | Null | Notes |
|---|---|---|---|
| `product_id` | char | no | → `service_products` indexed |
| `currency` | varchar | no |  |
| `amount_minor` | bigint | no |  |
| `country_code` | varchar | yes |  |
| `valid_from` | date | yes |  |
| `valid_to` | date | yes |  |
| `is_demo` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `service_add_ons`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `code` | varchar | no |  |
| `entitlement_key` | varchar | no | indexed |
| `quantity` | integer | no |  |
| `status` | varchar | no | indexed |
| `amount_minor` | bigint | yes |  |
| `currency` | varchar | yes |  |
| `note` | text | yes |  |
| `offered_by_user_id` | char | yes | → `users` indexed |
| `decided_at` | datetime | yes |  |
| `order_id` | char | yes | → `orders` indexed |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `orders`

| Column | Type | Null | Notes |
|---|---|---|---|
| `user_id` | char | no | → `users` indexed |
| `product_id` | char | no | → `service_products` indexed |
| `price_id` | char | yes | → `service_prices` indexed |
| `currency` | varchar | no |  |
| `amount_minor` | bigint | no |  |
| `status` | varchar | no | indexed |
| `paid_at` | datetime | yes |  |
| `refunded_at` | datetime | yes |  |
| `refund_amount_minor` | bigint | yes |  |
| `refund_reason` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `payments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `order_id` | char | no | → `orders` indexed |
| `provider` | varchar | no |  |
| `provider_ref` | varchar | yes |  |
| `status` | varchar | no |  |
| `amount_minor` | bigint | no |  |
| `currency` | varchar | no |  |
| `raw` | json | yes |  |
| `refunded_amount_minor` | bigint | yes |  |
| `refund_ref` | varchar | yes |  |
| `refunded_at` | datetime | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `partner_contracts`

| Column | Type | Null | Notes |
|---|---|---|---|
| `university_id` | char | no | → `universities` indexed |
| `title` | varchar | no |  |
| `status` | varchar | no |  |
| `start_date` | date | no |  |
| `end_date` | date | no |  |
| `recruitment_fee_krw` | bigint | yes |  |
| `commission_percent` | double | yes |  |
| `guaranteed_minimum_krw` | bigint | yes |  |
| `target_countries` | json | yes |  |
| `target_program_ids` | json | yes |  |
| `intake_label` | varchar | yes |  |
| `incentive_tiers` | json | yes |  |
| `guarantee_enabled` | boolean | no |  |
| `guarantee_terms` | text | yes |  |
| `guarantee_criteria` | json | yes |  |
| `notes` | text | yes |  |
| `is_demo` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `partner_quotas`

| Column | Type | Null | Notes |
|---|---|---|---|
| `contract_id` | char | no | → `partner_contracts` indexed |
| `program_id` | char | yes | → `programs` indexed |
| `intake_label` | varchar | no |  |
| `seats` | integer | no |  |
| `used` | integer | no |  |
| `id` | char | no | PK |

### `scholarship_pools`

| Column | Type | Null | Notes |
|---|---|---|---|
| `contract_id` | char | no | → `partner_contracts` indexed |
| `name` | varchar | no |  |
| `intake_label` | varchar | no |  |
| `total_krw` | bigint | no |  |
| `rules_summary` | text | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `scholarship_awards`

| Column | Type | Null | Notes |
|---|---|---|---|
| `pool_id` | char | yes | → `scholarship_pools` indexed |
| `scholarship_id` | char | yes | → `scholarships` indexed |
| `student_user_id` | char | no | → `users` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `amount_krw` | bigint | no |  |
| `status` | varchar | no |  |
| `decided_by_id` | char | yes | → `users` indexed |
| `note` | varchar | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

## Visa, housing, arrival & lifecycle

### `visa_requirements`

| Column | Type | Null | Notes |
|---|---|---|---|
| `visa_type` | varchar | no | indexed |
| `nationality` | varchar | yes |  |
| `consulate` | varchar | yes |  |
| `step_key` | varchar | no |  |
| `title` | varchar | no |  |
| `detail` | text | yes |  |
| `document_category` | varchar | yes |  |
| `depends_on` | json | yes |  |
| `is_required` | boolean | no |  |
| `replaces_step_key` | varchar | yes |  |
| `sort_order` | integer | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |
| `source_id` | char | yes | → `sources` |
| `source_url` | varchar | yes |  |
| `verified_at` | datetime | yes |  |
| `effective_from` | date | yes |  |
| `effective_to` | date | yes |  |
| `verification_status` | varchar | no |  |

### `visa_cases`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `visa_type` | varchar | no |  |
| `visa_type_reason` | text | yes |  |
| `status` | varchar | no | indexed |
| `consulate` | varchar | yes |  |
| `completed_steps` | json | yes |  |
| `submitted_on` | date | yes |  |
| `issued_on` | date | yes |  |
| `expires_on` | date | yes |  |
| `target_entry_date` | date | yes |  |
| `notes` | text | yes |  |
| `blockers` | json | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `housing_cases`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `university_id` | char | yes | → `universities` indexed |
| `dormitory_id` | char | yes | → `dormitories` indexed |
| `status` | varchar | no |  |
| `preference` | varchar | yes |  |
| `budget_monthly_krw` | integer | yes |  |
| `room_preference` | varchar | yes |  |
| `max_commute_minutes` | integer | yes |  |
| `application_deadline` | date | yes |  |
| `completed_items` | json | yes |  |
| `notes` | text | yes |  |
| `profile` | json | yes |  |
| `move_in` | json | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `arrival_plans`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `flight_number` | varchar | yes |  |
| `arrival_airport` | varchar | yes |  |
| `arrival_at` | datetime | yes |  |
| `pickup_requested` | boolean | no |  |
| `pickup_status` | varchar | yes |  |
| `completed_items` | json | no |  |
| `arrived_at` | datetime | yes |  |
| `residence_card_due` | date | yes |  |
| `flight_info` | json | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `student_enrollments`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `university_id` | char | no | → `universities` indexed |
| `program_id` | char | yes | → `programs` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `agency_org_id` | char | yes | → `organizations` indexed |
| `cohort_label` | varchar | no | indexed |
| `nationality` | varchar | yes |  |
| `status` | varchar | no |  |
| `enrolled_on` | date | no |  |
| `expected_graduation` | date | yes |  |
| `visa_expires_on` | date | yes |  |
| `is_demo` | boolean | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `student_terms`

| Column | Type | Null | Notes |
|---|---|---|---|
| `enrollment_id` | char | no | → `student_enrollments` indexed |
| `term_label` | varchar | no |  |
| `registered` | boolean | no |  |
| `gpa_percent` | float | yes |  |
| `attendance_percent` | float | yes |  |
| `academic_standing` | varchar | yes |  |
| `data_source` | varchar | no |  |
| `id` | char | no | PK |

### `student_outcomes`

| Column | Type | Null | Notes |
|---|---|---|---|
| `enrollment_id` | char | no | → `student_enrollments` indexed |
| `kind` | varchar | no |  |
| `occurred_on` | date | no |  |
| `detail` | text | yes |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `support_tickets`

| Column | Type | Null | Notes |
|---|---|---|---|
| `student_user_id` | char | no | → `users` indexed |
| `category` | varchar | no |  |
| `subject` | varchar | no |  |
| `status` | varchar | no |  |
| `priority` | varchar | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

## Content, analytics & audit

### `content_articles`

| Column | Type | Null | Notes |
|---|---|---|---|
| `slug` | varchar | no | indexed |
| `locale` | varchar | no |  |
| `content_type` | varchar | no |  |
| `title` | varchar | no |  |
| `summary` | text | yes |  |
| `body_md` | text | no |  |
| `seo_title` | varchar | yes |  |
| `seo_description` | varchar | yes |  |
| `source_keys` | json | yes |  |
| `country_code` | varchar | yes |  |
| `status` | varchar | no |  |
| `author_name` | varchar | yes |  |
| `reviewer_name` | varchar | yes |  |
| `last_verified_at` | date | yes |  |
| `translation_status` | varchar | no |  |
| `id` | char | no | PK |
| `created_at` | datetime | no |  |
| `updated_at` | datetime | no |  |

### `analytics_events`

| Column | Type | Null | Notes |
|---|---|---|---|
| `name` | varchar | no | indexed |
| `user_id` | char | yes | → `users` indexed |
| `organization_id` | char | yes | → `organizations` indexed |
| `university_id` | char | yes | → `universities` indexed |
| `application_id` | char | yes | → `applications` indexed |
| `nationality` | varchar | yes |  |
| `properties` | json | yes |  |
| `occurred_at` | datetime | no | indexed |
| `id` | char | no | PK |

### `daily_metrics`

| Column | Type | Null | Notes |
|---|---|---|---|
| `day` | date | no | indexed |
| `metric` | varchar | no |  |
| `scope_type` | varchar | no |  |
| `scope_id` | varchar | no |  |
| `dimension` | varchar | no |  |
| `dimension_value` | varchar | no |  |
| `value` | float | no |  |
| `id` | char | no | PK |

### `audit_logs`

| Column | Type | Null | Notes |
|---|---|---|---|
| `actor_user_id` | char | yes | → `users` indexed |
| `actor_org_id` | char | yes | → `organizations` indexed |
| `action` | varchar | no | indexed |
| `entity_type` | varchar | no |  |
| `entity_id` | varchar | yes | indexed |
| `subject_user_id` | char | yes | → `users` indexed |
| `detail` | json | yes |  |
| `ip` | varchar | yes |  |
| `created_at` | datetime | no | indexed |
| `id` | char | no | PK |

## Other
- `application_admin_checks`
- `application_submissions`
- `auth_security_events`
- `document_analyses`
- `document_findings`
- `document_requests`
- `dossier_document_states`
- `dossier_reuse_events`
- `essay_attestations`
- `essay_reviews`
- `essay_suggestion_decisions`
- `export_jobs`
- `export_presets`
- `extracted_fields`
- `housing_listings`
- `institutions`
- `language_recommendations`
- `message_attachments`
- `message_templates`
- `org_sso_configs`
- `portfolio_reviews`
- `push_tokens`
- `requirement_changes`
- `review_rubrics`
- `reviewer_profiles`
- `rubric_scores`
- `saved_views`
- `service_case_events`
- `service_cases`
- `sso_login_states`
- `student_payment_methods`
- `submission_agency_permissions`
- `submission_authorizations`
- `submission_connectors`
- `university_arrival_info`
- `vendors`
- `verification_challenges`
- `visa_case_tracks`
- `visa_embassy_requests`
- `visa_route_answers`
- `visa_route_documents`
- `visa_routes`
- `writing_events`
- `writing_findings`
- `writing_outcomes`
- `writing_policies`
- `writing_prompts`