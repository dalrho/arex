import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)  # remediation_draft | implementation_task
    item_id: Mapped[uuid.UUID] = mapped_column(nullable=False)  # UUID of the target item
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # APPROVED | REJECTED | EDITED
    reviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    original_content: Mapped[dict | list | str | None] = mapped_column(JSON, nullable=True)
    final_content: Mapped[dict | list | str | None] = mapped_column(JSON, nullable=True)

    # Relationships
    reviewer: Mapped["User"] = relationship()
