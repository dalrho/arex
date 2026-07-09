import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class RegulationUpdate(Base):
    __tablename__ = "regulation_updates"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_url: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    published_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_sections: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)  # Structured clauses
    hash_value: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hash of raw_content
    status: Mapped[str] = mapped_column(String(50), default="Not Analyzed", nullable=False)  # Not Analyzed | Impact Assessment Complete | ...
    audit_history: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    impact_assessments: Mapped[list["ImpactAssessment"]] = relationship(back_populates="regulation", cascade="all, delete-orphan")
    remediation_drafts: Mapped[list["RemediationDraft"]] = relationship(back_populates="regulation", cascade="all, delete-orphan")
    tasks: Mapped[list["ImplementationTask"]] = relationship(back_populates="regulation", cascade="all, delete-orphan")
