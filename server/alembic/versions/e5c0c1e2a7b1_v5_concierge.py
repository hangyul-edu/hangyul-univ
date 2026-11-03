"""v5 concierge: service cases, vendors, housing listings, arrival facts

Revision ID: e5c0c1e2a7b1
Revises: d5a1c0e55ccd
Create Date: 2026-09-29

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'e5c0c1e2a7b1'
down_revision: Union[str, Sequence[str], None] = 'd5a1c0e55ccd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts():
    return [
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    ]


def _fk(table: str, col: str, target: str, ondelete: str = 'CASCADE'):
    return sa.ForeignKeyConstraint([col], [f'{target}.id'], name=f'fk_{table}_{col}_{target}', ondelete=ondelete)


def upgrade() -> None:
    op.create_table(
        'vendors',
        sa.Column('organization_id', sa.Uuid(), nullable=True),
        sa.Column('name', sa.String(160), nullable=False),
        sa.Column('kind', sa.String(32), nullable=False),
        sa.Column('service_area', sa.JSON(), nullable=True),
        sa.Column('languages', sa.JSON(), nullable=True),
        sa.Column('price_model', sa.String(300), nullable=True),
        sa.Column('availability', sa.String(300), nullable=True),
        sa.Column('sla_hours', sa.Integer(), nullable=True),
        sa.Column('contact', sa.JSON(), nullable=True),
        sa.Column('quality_status', sa.String(16), nullable=False),
        sa.Column('agreement', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False),
        *_ts(),
        _fk('vendors', 'organization_id', 'organizations'),
        sa.PrimaryKeyConstraint('id', name='pk_vendors'),
    )
    op.create_index('ix_vendors_organization_id', 'vendors', ['organization_id'])
    op.create_index('ix_vendors_kind', 'vendors', ['kind'])

    op.create_table(
        'service_cases',
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('application_id', sa.Uuid(), nullable=True),
        sa.Column('agency_org_id', sa.Uuid(), nullable=True),
        sa.Column('owner_user_id', sa.Uuid(), nullable=True),
        sa.Column('routed_to', sa.String(16), nullable=False),
        sa.Column('case_type', sa.String(32), nullable=False),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('priority', sa.String(12), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sla_due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('vendor_id', sa.Uuid(), nullable=True),
        sa.Column('cost_amount', sa.Integer(), nullable=True),
        sa.Column('cost_currency', sa.String(3), nullable=True),
        sa.Column('cost_payer', sa.String(16), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('help_category', sa.String(32), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('feedback_ok', sa.Boolean(), nullable=True),
        sa.Column('feedback_comment', sa.String(500), nullable=True),
        sa.Column('feedback_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.Uuid(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False),
        *_ts(),
        _fk('service_cases', 'student_user_id', 'users'),
        _fk('service_cases', 'application_id', 'applications', 'SET NULL'),
        _fk('service_cases', 'agency_org_id', 'organizations', 'SET NULL'),
        _fk('service_cases', 'owner_user_id', 'users', 'SET NULL'),
        _fk('service_cases', 'vendor_id', 'vendors', 'SET NULL'),
        _fk('service_cases', 'created_by_id', 'users', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name='pk_service_cases'),
    )
    for col in ('student_user_id', 'application_id', 'agency_org_id', 'owner_user_id', 'case_type', 'status', 'due_at', 'sla_due_at', 'vendor_id', 'created_by_id'):
        op.create_index(f'ix_service_cases_{col}', 'service_cases', [col])

    op.create_table(
        'service_case_events',
        sa.Column('case_id', sa.Uuid(), nullable=False),
        sa.Column('kind', sa.String(24), nullable=False),
        sa.Column('from_status', sa.String(32), nullable=True),
        sa.Column('to_status', sa.String(32), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('visibility', sa.String(12), nullable=False),
        sa.Column('attachment_document_id', sa.Uuid(), nullable=True),
        sa.Column('actor_user_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        _fk('service_case_events', 'case_id', 'service_cases'),
        _fk('service_case_events', 'attachment_document_id', 'documents', 'SET NULL'),
        _fk('service_case_events', 'actor_user_id', 'users', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name='pk_service_case_events'),
    )
    for col in ('case_id', 'attachment_document_id', 'actor_user_id', 'created_at'):
        op.create_index(f'ix_service_case_events_{col}', 'service_case_events', [col])

    op.create_table(
        'housing_listings',
        sa.Column('vendor_id', sa.Uuid(), nullable=False),
        sa.Column('university_id', sa.Uuid(), nullable=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('area', sa.String(160), nullable=True),
        sa.Column('room_type', sa.String(40), nullable=True),
        sa.Column('rent_monthly_krw', sa.Integer(), nullable=True),
        sa.Column('deposit_krw', sa.Integer(), nullable=True),
        sa.Column('management_fee_krw', sa.Integer(), nullable=True),
        sa.Column('contract_months_min', sa.Integer(), nullable=True),
        sa.Column('commute_minutes', sa.Integer(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('furnished', sa.Boolean(), nullable=True),
        sa.Column('utilities', sa.String(200), nullable=True),
        sa.Column('available_from', sa.Date(), nullable=True),
        sa.Column('verification_status', sa.String(24), nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=False),
        *_ts(),
        _fk('housing_listings', 'vendor_id', 'vendors'),
        _fk('housing_listings', 'university_id', 'universities', 'SET NULL'),
        sa.PrimaryKeyConstraint('id', name='pk_housing_listings'),
    )
    op.create_index('ix_housing_listings_vendor_id', 'housing_listings', ['vendor_id'])
    op.create_index('ix_housing_listings_university_id', 'housing_listings', ['university_id'])

    op.create_table(
        'university_arrival_info',
        sa.Column('university_id', sa.Uuid(), nullable=False),
        sa.Column('group_residence_registration', sa.Boolean(), nullable=True),
        sa.Column('orientation_note', sa.Text(), nullable=True),
        sa.Column('orientation_date', sa.Date(), nullable=True),
        sa.Column('international_office_contact', sa.String(300), nullable=True),
        sa.Column('source_url', sa.String(1000), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_status', sa.String(24), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=False),
        *_ts(),
        _fk('university_arrival_info', 'university_id', 'universities'),
        sa.PrimaryKeyConstraint('id', name='pk_university_arrival_info'),
    )
    op.create_index('ix_university_arrival_info_university_id', 'university_arrival_info', ['university_id'])

    with op.batch_alter_table('dormitories') as b:
        b.add_column(sa.Column('application_opens', sa.Date(), nullable=True))
        b.add_column(sa.Column('application_closes', sa.Date(), nullable=True))
        b.add_column(sa.Column('eligibility', sa.Text(), nullable=True))
        b.add_column(sa.Column('meal_required', sa.Boolean(), nullable=True))
        b.add_column(sa.Column('move_in_date', sa.Date(), nullable=True))
        b.add_column(sa.Column('deposit_krw', sa.Integer(), nullable=True))
        b.add_column(sa.Column('required_documents', sa.JSON(), nullable=True))
        b.add_column(sa.Column('location', sa.String(300), nullable=True))
    with op.batch_alter_table('housing_cases') as b:
        b.add_column(sa.Column('profile', sa.JSON(), nullable=True))
        b.add_column(sa.Column('move_in', sa.JSON(), nullable=True))
    with op.batch_alter_table('arrival_plans') as b:
        b.add_column(sa.Column('flight_info', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('arrival_plans') as b:
        b.drop_column('flight_info')
    with op.batch_alter_table('housing_cases') as b:
        b.drop_column('move_in')
        b.drop_column('profile')
    with op.batch_alter_table('dormitories') as b:
        for c in ('location', 'required_documents', 'deposit_krw', 'move_in_date', 'meal_required', 'eligibility', 'application_closes', 'application_opens'):
            b.drop_column(c)
    op.drop_table('university_arrival_info')
    op.drop_table('housing_listings')
    op.drop_table('service_case_events')
    op.drop_table('service_cases')
    op.drop_table('vendors')
