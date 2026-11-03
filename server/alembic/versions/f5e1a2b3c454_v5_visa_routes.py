"""v5 visa routes: versioned embassy playbooks, route answers, visa case tracking, embassy requests, university visa tier

Revision ID: f5e1a2b3c454
Revises: f5d055e1a001
Create Date: 2026-09-29

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'f5e1a2b3c454'
down_revision: Union[str, Sequence[str], None] = 'f5d055e1a001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _base():
    return [
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    ]


def _fk(col, table, name_table, ondelete='CASCADE'):
    return sa.ForeignKeyConstraint([col], [f'{table}.id'], name=op.f(f'fk_{name_table}_{col}_{table}'), ondelete=ondelete)


def upgrade() -> None:
    op.add_column('universities', sa.Column('visa_certification', sa.String(length=16), nullable=True))
    op.add_column('universities', sa.Column('visa_certification_verified_at', sa.Date(), nullable=True))
    op.execute("UPDATE universities SET visa_certification = 'UNKNOWN' WHERE visa_certification IS NULL")

    op.create_table(
        'visa_routes', *_base(),
        sa.Column('country', sa.String(length=2), nullable=False),
        sa.Column('country_name', sa.String(length=80), nullable=False),
        sa.Column('visa_type', sa.String(length=8), nullable=False),
        sa.Column('degree_levels', sa.JSON(), nullable=False),
        sa.Column('jurisdiction', sa.JSON(), nullable=False),
        sa.Column('application_method', sa.JSON(), nullable=False),
        sa.Column('e_visa_available', sa.Boolean(), nullable=False),
        sa.Column('e_visa_condition', sa.Text(), nullable=True),
        sa.Column('financial', sa.JSON(), nullable=True),
        sa.Column('fees', sa.JSON(), nullable=True),
        sa.Column('processing_time', sa.Text(), nullable=True),
        sa.Column('special_notes', sa.JSON(), nullable=True),
        sa.Column('reviewer_notes', sa.Text(), nullable=True),
        sa.Column('sources', sa.JSON(), nullable=False),
        sa.Column('verification_status', sa.String(length=24), nullable=False),
        sa.Column('verified_at', sa.Date(), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('dataset', sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_visa_routes')),
        sa.UniqueConstraint('country', 'visa_type', 'version', name='uq_visa_route_version'),
    )
    op.create_index(op.f('ix_visa_routes_country'), 'visa_routes', ['country'])
    op.create_index(op.f('ix_visa_routes_is_current'), 'visa_routes', ['is_current'])

    op.create_table(
        'visa_route_documents', *_base(),
        sa.Column('route_id', sa.Uuid(), nullable=False),
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('requirement', sa.String(length=16), nullable=False),
        sa.Column('condition', sa.Text(), nullable=True),
        sa.Column('validity_text', sa.Text(), nullable=True),
        sa.Column('validity_days', sa.Integer(), nullable=True),
        sa.Column('legalization', sa.String(length=16), nullable=True),
        sa.Column('translation', sa.Text(), nullable=True),
        sa.Column('provided_by', sa.String(length=16), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('document_category', sa.String(length=48), nullable=True),
        sa.Column('source_url', sa.String(length=1000), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        _fk('route_id', 'visa_routes', 'visa_route_documents'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_visa_route_documents')),
    )
    op.create_index(op.f('ix_visa_route_documents_route_id'), 'visa_route_documents', ['route_id'])

    op.create_table(
        'visa_route_answers', *_base(),
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=False),
        _fk('student_user_id', 'users', 'visa_route_answers'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_visa_route_answers')),
        sa.UniqueConstraint('student_user_id', name=op.f('uq_visa_route_answers_student_user_id')),
    )

    op.create_table(
        'visa_case_tracks', *_base(),
        sa.Column('visa_case_id', sa.Uuid(), nullable=False),
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('route_id', sa.Uuid(), nullable=True),
        sa.Column('post_key', sa.String(length=64), nullable=True),
        sa.Column('method', sa.String(length=24), nullable=True),
        sa.Column('form', sa.JSON(), nullable=True),
        sa.Column('item_documents', sa.JSON(), nullable=True),
        sa.Column('item_marks', sa.JSON(), nullable=True),
        sa.Column('appointment_on', sa.Date(), nullable=True),
        sa.Column('appointment_status', sa.String(length=12), nullable=True),
        sa.Column('appointment_post', sa.String(length=64), nullable=True),
        sa.Column('appointment_reference', sa.String(length=120), nullable=True),
        sa.Column('handoff_opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submission_reference', sa.String(length=120), nullable=True),
        sa.Column('submission_document_id', sa.Uuid(), nullable=True),
        sa.Column('decision', sa.String(length=12), nullable=True),
        sa.Column('decision_on', sa.Date(), nullable=True),
        sa.Column('decision_document_id', sa.Uuid(), nullable=True),
        sa.Column('visa_document_id', sa.Uuid(), nullable=True),
        sa.Column('pack_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pack_reviewed_by_id', sa.Uuid(), nullable=True),
        sa.Column('support_case_id', sa.Uuid(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
        _fk('visa_case_id', 'visa_cases', 'visa_case_tracks'),
        _fk('student_user_id', 'users', 'visa_case_tracks'),
        _fk('route_id', 'visa_routes', 'visa_case_tracks', 'SET NULL'),
        _fk('submission_document_id', 'documents', 'visa_case_tracks', 'SET NULL'),
        _fk('decision_document_id', 'documents', 'visa_case_tracks', 'SET NULL'),
        _fk('visa_document_id', 'documents', 'visa_case_tracks', 'SET NULL'),
        _fk('pack_reviewed_by_id', 'users', 'visa_case_tracks', 'SET NULL'),
        _fk('support_case_id', 'service_cases', 'visa_case_tracks', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_visa_case_tracks')),
        sa.UniqueConstraint('visa_case_id', name=op.f('uq_visa_case_tracks_visa_case_id')),
    )
    for col in ('student_user_id', 'route_id', 'submission_document_id', 'decision_document_id', 'visa_document_id', 'pack_reviewed_by_id', 'support_case_id'):
        op.create_index(op.f(f'ix_visa_case_tracks_{col}'), 'visa_case_tracks', [col])

    op.create_table(
        'visa_embassy_requests', *_base(),
        sa.Column('visa_case_id', sa.Uuid(), nullable=False),
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('due_on', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=12), nullable=False),
        sa.Column('created_by_id', sa.Uuid(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('response_document_id', sa.Uuid(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
        _fk('visa_case_id', 'visa_cases', 'visa_embassy_requests'),
        _fk('student_user_id', 'users', 'visa_embassy_requests'),
        _fk('created_by_id', 'users', 'visa_embassy_requests', 'SET NULL'),
        _fk('response_document_id', 'documents', 'visa_embassy_requests', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_visa_embassy_requests')),
    )
    for col in ('visa_case_id', 'student_user_id', 'created_by_id', 'response_document_id'):
        op.create_index(op.f(f'ix_visa_embassy_requests_{col}'), 'visa_embassy_requests', [col])


def downgrade() -> None:
    op.drop_table('visa_embassy_requests')
    op.drop_table('visa_case_tracks')
    op.drop_table('visa_route_answers')
    op.drop_table('visa_route_documents')
    op.drop_table('visa_routes')
    op.drop_column('universities', 'visa_certification_verified_at')
    op.drop_column('universities', 'visa_certification')
