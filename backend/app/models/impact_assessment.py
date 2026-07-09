import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Float, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class ImpactAssessment(Base):
    __tablename__ = "impact_assessments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    regulation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("regulation_updates.id", ondelete="CASCADE"), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    impact_level: Mapped[str] = mapped_column(String(50), nullable=False)  # Low | Medium | High
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    affected_departments: Mapped[list[str]] = mapped_column(JSON, nullable=False)  # list of department names
    affected_documents: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # pending | reviewed

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    regulation: Mapped["RegulationUpdate"] = relationship(back_populates="impact_assessments")
