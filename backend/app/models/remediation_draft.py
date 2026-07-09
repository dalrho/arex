import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON, Boolean

from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class RemediationDraft(Base):
    __tablename__ = "remediation_drafts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    regulation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regulation_updates.id", ondelete="CASCADE"), nullable=False)
    proposed_text: Mapped[str] = mapped_column(Text, nullable=False)
    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    diff_content: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {added: [], removed: []}
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    requires_tasks: Mapped[bool | None] = mapped_column(Boolean, default=True, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING_REVIEW", nullable=False)  # PENDING_REVIEW | APPROVED | REJECTED

    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="remediation_drafts")
    regulation: Mapped["RegulationUpdate"] = relationship(back_populates="remediation_drafts")
    reviewer: Mapped["User"] = relationship()
    tasks: Mapped[list["ImplementationTask"]] = relationship(back_populates="remediation_draft", cascade="all, delete-orphan")
