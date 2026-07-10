"""add_audit_history_to_regulation_update

Revision ID: e7b99c0e4451
Revises: 7e3fb3b95051
Create Date: 2026-07-10 02:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e7b99c0e4451'
down_revision: Union[str, Sequence[str], None] = '7e3fb3b95051'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('regulation_updates', sa.Column('audit_history', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('regulation_updates', 'audit_history')
