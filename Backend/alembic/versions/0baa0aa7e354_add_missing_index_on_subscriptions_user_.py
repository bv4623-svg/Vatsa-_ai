"""add missing index on subscriptions.user_id

Revision ID: 0baa0aa7e354
Revises: 71eeb219e6a3
Create Date: 2026-09-23 10:12:27.059867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0baa0aa7e354'
down_revision: Union[str, Sequence[str], None] = '71eeb219e6a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """subscriptions.user_id was missing an index -- every other
    foreign-key column in this schema already has one. Found live via
    EXPLAIN ANALYZE (Postgres 16, 50k synthetic rows): queries filtering by
    user_id (payment_service.py's renewal and refund checks) were doing a
    sequential scan. if_not_exists guards a database where
    Base.metadata.create_all() already created it fresh from the
    now-updated model (see app/models/subscription.py)."""
    op.create_index(
        "ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False, if_not_exists=True
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions", if_exists=True)
