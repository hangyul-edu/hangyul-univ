"""v6 submission: connector completion, authorised-agency submission (legal basis, agency permission, student consent)

* submission_connectors: portal_name, official_url, fee_payer, originals_by_mail, receipt_method, status_sync (NONE |
  MANUAL | WEBHOOK | POLLING), verified_source, agency_submission_basis(+_url, _verified).
* application_submissions: authorization_id, failure_reason, failed_at.
* submission_agency_permissions (per-connector / per-agency flag) and submission_authorizations (student consent + snapshot).
* Data: method AGENCY_ASSISTED → AUTHORIZED_AGENCY (the code still reads the old value as an alias).

Revision ID: e6a1b2c3d4f5
Revises: f5e1a2b3c454
Create Date: 2026-10-01

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'e6a1b2c3d4f5'
down_revision: Union[str, Sequence[str], None] = 'f5e1a2b3c454'
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
    sc = 'submission_connectors'
    op.add_column(sc, sa.Column('portal_name', sa.String(length=160), nullable=True))
    op.add_column(sc, sa.Column('official_url', sa.String(length=1000), nullable=True))
    op.add_column(sc, sa.Column('fee_payer', sa.String(length=16), nullable=True))
    op.add_column(sc, sa.Column('originals_by_mail', sa.Boolean(), nullable=True))
    op.add_column(sc, sa.Column('receipt_method', sa.Text(), nullable=True))
    op.add_column(sc, sa.Column('status_sync', sa.String(length=16), server_default='NONE', nullable=False))
    op.add_column(sc, sa.Column('verified_source', sa.String(length=300), nullable=True))
    op.add_column(sc, sa.Column('agency_submission_basis', sa.Text(), nullable=True))
    op.add_column(sc, sa.Column('agency_submission_basis_url', sa.String(length=1000), nullable=True))
    op.add_column(sc, sa.Column('agency_submission_basis_verified', sa.Date(), nullable=True))

    op.create_table(
        'submission_agency_permissions', *_base(),
        sa.Column('connector_id', sa.Uuid(), nullable=False),
        sa.Column('agency_org_id', sa.Uuid(), nullable=False),
        sa.Column('basis', sa.String(length=16), nullable=False),
        sa.Column('contract_reference', sa.String(length=160), nullable=True),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_until', sa.Date(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('is_demo', sa.Boolean(), nullable=False),
        _fk('connector_id', 'submission_connectors', 'submission_agency_permissions'),
        _fk('agency_org_id', 'organizations', 'submission_agency_permissions'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_submission_agency_permissions')),
        sa.UniqueConstraint('connector_id', 'agency_org_id', name=op.f('uq_submission_agency_permissions_connector_id')),
    )
    op.create_index(op.f('ix_submission_agency_permissions_connector_id'), 'submission_agency_permissions', ['connector_id'])
    op.create_index(op.f('ix_submission_agency_permissions_agency_org_id'), 'submission_agency_permissions', ['agency_org_id'])

    op.create_table(
        'submission_authorizations', *_base(),
        sa.Column('application_id', sa.Uuid(), nullable=False),
        sa.Column('student_user_id', sa.Uuid(), nullable=False),
        sa.Column('agency_org_id', sa.Uuid(), nullable=False),
        sa.Column('submitter_user_id', sa.Uuid(), nullable=True),
        sa.Column('permission_id', sa.Uuid(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_reason', sa.Text(), nullable=True),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('consent_version', sa.String(length=32), nullable=False),
        sa.Column('snapshot', sa.JSON(), nullable=False),
        sa.Column('is_demo', sa.Boolean(), nullable=False),
        _fk('application_id', 'applications', 'submission_authorizations'),
        _fk('student_user_id', 'users', 'submission_authorizations'),
        _fk('agency_org_id', 'organizations', 'submission_authorizations'),
        _fk('submitter_user_id', 'users', 'submission_authorizations', ondelete='SET NULL'),
        _fk('permission_id', 'submission_agency_permissions', 'submission_authorizations', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_submission_authorizations')),
    )
    for col in ('application_id', 'student_user_id', 'agency_org_id', 'submitter_user_id', 'permission_id', 'status'):
        op.create_index(op.f(f'ix_submission_authorizations_{col}'), 'submission_authorizations', [col])

    op.add_column('application_submissions', sa.Column('authorization_id', sa.Uuid(), nullable=True))
    op.add_column('application_submissions', sa.Column('failure_reason', sa.Text(), nullable=True))
    op.add_column('application_submissions', sa.Column('failed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(op.f('fk_application_submissions_authorization_id_submission_authorizations'), 'application_submissions',
                          'submission_authorizations', ['authorization_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_application_submissions_authorization_id'), 'application_submissions', ['authorization_id'])

    # AGENCY_ASSISTED → AUTHORIZED_AGENCY (alias kept in code for anything written by an older build).
    op.execute("UPDATE submission_connectors SET method = 'AUTHORIZED_AGENCY' WHERE method = 'AGENCY_ASSISTED'")
    op.execute("UPDATE application_submissions SET method = 'AUTHORIZED_AGENCY' WHERE method = 'AGENCY_ASSISTED'")


def downgrade() -> None:
    op.execute("UPDATE application_submissions SET method = 'AGENCY_ASSISTED' WHERE method = 'AUTHORIZED_AGENCY'")
    op.execute("UPDATE submission_connectors SET method = 'AGENCY_ASSISTED' WHERE method = 'AUTHORIZED_AGENCY'")
    op.drop_index(op.f('ix_application_submissions_authorization_id'), table_name='application_submissions')
    op.drop_constraint(op.f('fk_application_submissions_authorization_id_submission_authorizations'), 'application_submissions', type_='foreignkey')
    for col in ('failed_at', 'failure_reason', 'authorization_id'):
        op.drop_column('application_submissions', col)
    op.drop_table('submission_authorizations')
    op.drop_table('submission_agency_permissions')
    for col in ('agency_submission_basis_verified', 'agency_submission_basis_url', 'agency_submission_basis', 'verified_source', 'status_sync',
                'receipt_method', 'originals_by_mail', 'fee_payer', 'official_url', 'portal_name'):
        op.drop_column('submission_connectors', col)
