import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class ImplementationTask(Base):
    __tablename__ = "implementation_tasks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    regulation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regulation_updates.id", ondelete="CASCADE"), nullable=False)
    remediation_draft_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("remediation_drafts.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    department: Mapped[str] = mapped_column(String(50), nullable=False)  # Engineering | QA | IT | Training
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default="Medium")  # Low | Medium | High
    status: Mapped[str] = mapped_column(String(50), default="TODO", nullable=False)  # TODO | IN_PROGRESS | DONE
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    jira_issue_key: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Relationships
    regulation: Mapped["RegulationUpdate"] = relationship(back_populates="tasks")
    remediation_draft: Mapped["RemediationDraft"] = relationship(back_populates="tasks")
