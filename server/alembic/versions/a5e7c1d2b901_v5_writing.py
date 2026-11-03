"""v5 writing review: prompts, rubric, findings, reviewer matching, SLA events, outcomes

Revision ID: a5e7c1d2b901
Revises: e5c0c1e2a7b1
Create Date: 2026-09-29
"""
import sqlalchemy as sa

from alembic import op

revision = "a5e7c1d2b901"
down_revision = "e5c0c1e2a7b1"
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.create_table('writing_prompts',
    sa.Column('university_id', sa.Uuid(), nullable=False),
    sa.Column('program_id', sa.Uuid(), nullable=True),
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('essay_type', sa.String(length=32), nullable=False),
    sa.Column('intake_year', sa.Integer(), nullable=True),
    sa.Column('intake_term', sa.String(length=16), nullable=True),
    sa.Column('effective_from_year', sa.Integer(), nullable=True),
    sa.Column('effective_from_term', sa.String(length=16), nullable=True),
    sa.Column('prompt_text', sa.Text(), nullable=False),
    sa.Column('prompt_language', sa.String(length=8), nullable=False),
    sa.Column('word_limit', sa.Integer(), nullable=True),
    sa.Column('char_limit', sa.Integer(), nullable=True),
    sa.Column('required_language', sa.String(length=8), nullable=True),
    sa.Column('source_url', sa.String(length=1000), nullable=True),
    sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('verification_status', sa.String(length=24), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('superseded_by_id', sa.Uuid(), nullable=True),
    sa.Column('created_by_id', sa.Uuid(), nullable=True),
    sa.Column('note', sa.String(length=500), nullable=True),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name=op.f('fk_writing_prompts_created_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_writing_prompts_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], name=op.f('fk_writing_prompts_program_id_programs'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['superseded_by_id'], ['writing_prompts.id'], name=op.f('fk_writing_prompts_superseded_by_id_writing_prompts'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['university_id'], ['universities.id'], name=op.f('fk_writing_prompts_university_id_universities'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_writing_prompts'))
    )
    op.create_index(op.f('ix_writing_prompts_program_id'), 'writing_prompts', ['program_id'], unique=False)
    op.create_index(op.f('ix_writing_prompts_essay_type'), 'writing_prompts', ['essay_type'], unique=False)
    op.create_index(op.f('ix_writing_prompts_created_by_id'), 'writing_prompts', ['created_by_id'], unique=False)
    op.create_index(op.f('ix_writing_prompts_organization_id'), 'writing_prompts', ['organization_id'], unique=False)
    op.create_index(op.f('ix_writing_prompts_superseded_by_id'), 'writing_prompts', ['superseded_by_id'], unique=False)
    op.create_index(op.f('ix_writing_prompts_university_id'), 'writing_prompts', ['university_id'], unique=False)
    op.create_table('review_rubrics',
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('dimensions', sa.JSON(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_review_rubrics_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_review_rubrics'))
    )
    op.create_index(op.f('ix_review_rubrics_organization_id'), 'review_rubrics', ['organization_id'], unique=False)
    op.create_table('rubric_scores',
    sa.Column('essay_id', sa.Uuid(), nullable=False),
    sa.Column('dimension', sa.String(length=48), nullable=False),
    sa.Column('rating', sa.String(length=16), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('version', sa.Integer(), nullable=True),
    sa.Column('reviewer_user_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['essay_id'], ['essays.id'], name=op.f('fk_rubric_scores_essay_id_essays'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['reviewer_user_id'], ['users.id'], name=op.f('fk_rubric_scores_reviewer_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_rubric_scores')),
    sa.UniqueConstraint('essay_id', 'dimension', name=op.f('uq_rubric_scores_essay_id'))
    )
    op.create_index(op.f('ix_rubric_scores_reviewer_user_id'), 'rubric_scores', ['reviewer_user_id'], unique=False)
    op.create_index(op.f('ix_rubric_scores_essay_id'), 'rubric_scores', ['essay_id'], unique=False)
    op.create_table('essay_reviews',
    sa.Column('essay_id', sa.Uuid(), nullable=False),
    sa.Column('prompt_id', sa.Uuid(), nullable=True),
    sa.Column('rubric_id', sa.Uuid(), nullable=True),
    sa.Column('review_round', sa.Integer(), nullable=False),
    sa.Column('first_submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expected_review_by', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('overdue_flagged_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('escalated_to_id', sa.Uuid(), nullable=True),
    sa.Column('sla_breaches', sa.Integer(), nullable=False),
    sa.Column('reviewer_assigned_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('assigned_by', sa.String(length=24), nullable=True),
    sa.Column('assignment_reasons', sa.JSON(), nullable=True),
    sa.Column('override_reason', sa.String(length=500), nullable=True),
    sa.Column('approved_version', sa.Integer(), nullable=True),
    sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('approved_by_id', sa.Uuid(), nullable=True),
    sa.Column('approval_override_reason', sa.String(length=1000), nullable=True),
    sa.Column('approval_override_blockers', sa.JSON(), nullable=True),
    sa.Column('checks_version', sa.Integer(), nullable=True),
    sa.Column('checks_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('checks_provider', sa.String(length=24), nullable=True),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['approved_by_id'], ['users.id'], name=op.f('fk_essay_reviews_approved_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['escalated_to_id'], ['users.id'], name=op.f('fk_essay_reviews_escalated_to_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['essay_id'], ['essays.id'], name=op.f('fk_essay_reviews_essay_id_essays'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['prompt_id'], ['writing_prompts.id'], name=op.f('fk_essay_reviews_prompt_id_writing_prompts'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['rubric_id'], ['review_rubrics.id'], name=op.f('fk_essay_reviews_rubric_id_review_rubrics'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_essay_reviews')),
    sa.UniqueConstraint('essay_id', name=op.f('uq_essay_reviews_essay_id'))
    )
    op.create_index(op.f('ix_essay_reviews_escalated_to_id'), 'essay_reviews', ['escalated_to_id'], unique=False)
    op.create_index(op.f('ix_essay_reviews_prompt_id'), 'essay_reviews', ['prompt_id'], unique=False)
    op.create_index(op.f('ix_essay_reviews_approved_by_id'), 'essay_reviews', ['approved_by_id'], unique=False)
    op.create_index(op.f('ix_essay_reviews_rubric_id'), 'essay_reviews', ['rubric_id'], unique=False)
    op.create_index(op.f('ix_essay_reviews_expected_review_by'), 'essay_reviews', ['expected_review_by'], unique=False)
    op.create_index(op.f('ix_essay_reviews_essay_id'), 'essay_reviews', ['essay_id'], unique=False)
    op.create_table('writing_findings',
    sa.Column('essay_id', sa.Uuid(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('code', sa.String(length=48), nullable=False),
    sa.Column('severity', sa.String(length=16), nullable=False),
    sa.Column('params', sa.JSON(), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('quote', sa.Text(), nullable=True),
    sa.Column('anchor_start', sa.Integer(), nullable=True),
    sa.Column('anchor_end', sa.Integer(), nullable=True),
    sa.Column('staff_only', sa.Boolean(), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('resolved_note', sa.String(length=1000), nullable=True),
    sa.Column('resolved_by_id', sa.Uuid(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['essay_id'], ['essays.id'], name=op.f('fk_writing_findings_essay_id_essays'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], name=op.f('fk_writing_findings_resolved_by_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_writing_findings'))
    )
    op.create_index(op.f('ix_writing_findings_resolved_by_id'), 'writing_findings', ['resolved_by_id'], unique=False)
    op.create_index(op.f('ix_writing_findings_kind'), 'writing_findings', ['kind'], unique=False)
    op.create_index(op.f('ix_writing_findings_essay_id'), 'writing_findings', ['essay_id'], unique=False)
    op.create_index(op.f('ix_writing_findings_fingerprint'), 'writing_findings', ['fingerprint'], unique=False)
    op.create_table('reviewer_profiles',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('languages', sa.JSON(), nullable=True),
    sa.Column('degrees', sa.JSON(), nullable=True),
    sa.Column('fields', sa.JSON(), nullable=True),
    sa.Column('university_ids', sa.JSON(), nullable=True),
    sa.Column('countries', sa.JSON(), nullable=True),
    sa.Column('capacity', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_reviewer_profiles_organization_id_organizations'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_reviewer_profiles_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_reviewer_profiles'))
    )
    op.create_index(op.f('ix_reviewer_profiles_user_id'), 'reviewer_profiles', ['user_id'], unique=False)
    op.create_index(op.f('ix_reviewer_profiles_organization_id'), 'reviewer_profiles', ['organization_id'], unique=False)
    op.create_table('writing_policies',
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('first_review_hours', sa.Integer(), nullable=False),
    sa.Column('revision_review_hours', sa.Integer(), nullable=False),
    sa.Column('final_review_hours', sa.Integer(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_writing_policies_organization_id_organizations'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_writing_policies'))
    )
    op.create_index(op.f('ix_writing_policies_organization_id'), 'writing_policies', ['organization_id'], unique=False)
    op.create_table('writing_events',
    sa.Column('essay_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('round', sa.Integer(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=True),
    sa.Column('actor_user_id', sa.Uuid(), nullable=True),
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('detail', sa.JSON(), nullable=True),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], name=op.f('fk_writing_events_actor_user_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['essay_id'], ['essays.id'], name=op.f('fk_writing_events_essay_id_essays'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_writing_events_organization_id_organizations'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_writing_events'))
    )
    op.create_index(op.f('ix_writing_events_essay_id'), 'writing_events', ['essay_id'], unique=False)
    op.create_index(op.f('ix_writing_events_at'), 'writing_events', ['at'], unique=False)
    op.create_index(op.f('ix_writing_events_kind'), 'writing_events', ['kind'], unique=False)
    op.create_index(op.f('ix_writing_events_actor_user_id'), 'writing_events', ['actor_user_id'], unique=False)
    op.create_index(op.f('ix_writing_events_organization_id'), 'writing_events', ['organization_id'], unique=False)
    op.create_table('writing_outcomes',
    sa.Column('essay_id', sa.Uuid(), nullable=False),
    sa.Column('application_id', sa.Uuid(), nullable=False),
    sa.Column('organization_id', sa.Uuid(), nullable=True),
    sa.Column('university_id', sa.Uuid(), nullable=True),
    sa.Column('program_id', sa.Uuid(), nullable=True),
    sa.Column('essay_type', sa.String(length=32), nullable=False),
    sa.Column('intake_year', sa.Integer(), nullable=True),
    sa.Column('approved_version', sa.Integer(), nullable=True),
    sa.Column('decision', sa.String(length=16), nullable=False),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('review_rounds', sa.Integer(), nullable=False),
    sa.Column('first_turnaround_hours', sa.Float(), nullable=True),
    sa.Column('sla_breaches', sa.Integer(), nullable=False),
    sa.Column('rubric_meets', sa.Integer(), nullable=False),
    sa.Column('rubric_needs_work', sa.Integer(), nullable=False),
    sa.Column('override_used', sa.Boolean(), nullable=False),
    sa.Column('is_demo', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['application_id'], ['applications.id'], name=op.f('fk_writing_outcomes_application_id_applications'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['essay_id'], ['essays.id'], name=op.f('fk_writing_outcomes_essay_id_essays'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], name=op.f('fk_writing_outcomes_organization_id_organizations'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], name=op.f('fk_writing_outcomes_program_id_programs'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['university_id'], ['universities.id'], name=op.f('fk_writing_outcomes_university_id_universities'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_writing_outcomes')),
    sa.UniqueConstraint('essay_id', 'application_id', name=op.f('uq_writing_outcomes_essay_id'))
    )
    op.create_index(op.f('ix_writing_outcomes_university_id'), 'writing_outcomes', ['university_id'], unique=False)
    op.create_index(op.f('ix_writing_outcomes_organization_id'), 'writing_outcomes', ['organization_id'], unique=False)
    op.create_index(op.f('ix_writing_outcomes_program_id'), 'writing_outcomes', ['program_id'], unique=False)
    op.create_index(op.f('ix_writing_outcomes_essay_id'), 'writing_outcomes', ['essay_id'], unique=False)
    op.create_index(op.f('ix_writing_outcomes_application_id'), 'writing_outcomes', ['application_id'], unique=False)


def downgrade() -> None:
    op.drop_table("writing_outcomes")
    op.drop_table("writing_events")
    op.drop_table("writing_policies")
    op.drop_table("reviewer_profiles")
    op.drop_table("writing_findings")
    op.drop_table("essay_reviews")
    op.drop_table("rubric_scores")
    op.drop_table("review_rubrics")
    op.drop_table("writing_prompts")
