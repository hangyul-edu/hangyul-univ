"""v5 dossier: document analyses, findings, extracted fields, dossier state, reuse events

Revision ID: f5d055e1a001
Revises: a5e7c1d2b901
Create Date: 2026-09-29

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'f5d055e1a001'
down_revision: Union[str, Sequence[str], None] = 'a5e7c1d2b901'
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
    op.create_table(
        'document_analyses',
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('text_chars', sa.Integer(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('detected_category', sa.String(48), nullable=True),
        sa.Column('has_mrz', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('file_findings', sa.JSON(), nullable=True),
        sa.Column('error', sa.String(200), nullable=True),
        sa.Column('method', sa.String(24), nullable=False, server_default='RULES'),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
        *_base(),
        _fk('document_id', 'documents', 'document_analyses'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_document_analyses')),
        sa.UniqueConstraint('document_id', 'version', name='uq_document_analyses_document_id'),
    )
    op.create_index(op.f('ix_document_analyses_document_id'), 'document_analyses', ['document_id'])

    op.create_table(
        'document_findings',
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(40), nullable=False),
        sa.Column('severity', sa.String(12), nullable=False),
        sa.Column('params', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(12), nullable=False, server_default='OPEN'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by_id', sa.Uuid(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
        *_base(),
        _fk('document_id', 'documents', 'document_findings'),
        _fk('student_user_id', 'users', 'document_findings'),
        _fk('resolved_by_id', 'users', 'document_findings', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_document_findings')),
        sa.UniqueConstraint('document_id', 'code', 'version', name='uq_document_findings_document_id'),
    )
    for c in ('document_id', 'student_user_id', 'code', 'status', 'resolved_by_id'):
        op.create_index(op.f(f'ix_document_findings_{c}'), 'document_findings', [c])

    op.create_table(
        'extracted_fields',
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('field', sa.String(32), nullable=False),
        sa.Column('value', sa.String(200), nullable=False),
        sa.Column('confidence', sa.String(8), nullable=False),
        sa.Column('source', sa.String(12), nullable=False),
        sa.Column('status', sa.String(12), nullable=False, server_default='SUGGESTED'),
        sa.Column('confirmed_value', sa.String(200), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decided_by_id', sa.Uuid(), nullable=True),
        sa.Column('applied', sa.JSON(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
        *_base(),
        _fk('document_id', 'documents', 'extracted_fields'),
        _fk('student_user_id', 'users', 'extracted_fields'),
        _fk('decided_by_id', 'users', 'extracted_fields', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_extracted_fields')),
        sa.UniqueConstraint('document_id', 'version', 'field', name='uq_extracted_fields_document_id'),
    )
    for c in ('document_id', 'student_user_id', 'status', 'decided_by_id'):
        op.create_index(op.f(f'ix_extracted_fields_{c}'), 'extracted_fields', [c])

    op.create_table(
        'dossier_document_states',
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('translation_status', sa.String(12), nullable=True),
        sa.Column('updated_by_id', sa.Uuid(), nullable=True),
        *_base(),
        _fk('document_id', 'documents', 'dossier_document_states'),
        _fk('updated_by_id', 'users', 'dossier_document_states', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_dossier_document_states')),
        sa.UniqueConstraint('document_id', name='uq_dossier_document_states_document_id'),
    )
    for c in ('document_id', 'updated_by_id'):
        op.create_index(op.f(f'ix_dossier_document_states_{c}'), 'dossier_document_states', [c])

    op.create_table(
        'dossier_reuse_events',
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('document_id', sa.Uuid(), nullable=True),
        sa.Column('application_id', sa.Uuid(), nullable=True),
        sa.Column('request_id', sa.Uuid(), nullable=True),
        sa.Column('category', sa.String(48), nullable=True),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('actor_user_id', sa.Uuid(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()),
        *_base(),
        _fk('student_user_id', 'users', 'dossier_reuse_events'),
        _fk('document_id', 'documents', 'dossier_reuse_events', 'SET NULL'),
        _fk('application_id', 'applications', 'dossier_reuse_events', 'SET NULL'),
        _fk('request_id', 'document_requests', 'dossier_reuse_events', 'SET NULL'),
        _fk('actor_user_id', 'users', 'dossier_reuse_events', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_dossier_reuse_events')),
    )
    for c in ('student_user_id', 'document_id', 'application_id', 'request_id', 'kind', 'actor_user_id'):
        op.create_index(op.f(f'ix_dossier_reuse_events_{c}'), 'dossier_reuse_events', [c])


def downgrade() -> None:
    for t in ('dossier_reuse_events', 'dossier_document_states', 'extracted_fields', 'document_findings', 'document_analyses'):
        op.drop_table(t)
