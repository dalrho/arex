import uuid
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies import get_db, get_tenant_id
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate
from app.models.impact_assessment import ImpactAssessment
from app.models.remediation_draft import RemediationDraft
from app.models.implementation_task import ImplementationTask
from app.models.approval_record import ApprovalRecord

router = APIRouter()

class DashboardMetrics(BaseModel):
    total_documents: int
    total_regulations: int
    pending_assessments: int
    pending_remediations: int
    open_tasks: int
    max_risk_score: float
    recent_activity: List[Dict[str, Any]]

@router.get("/", response_model=DashboardMetrics)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Retrieve aggregated metrics and recent activity for the Sentinel OS dashboard view.
    """
    org_id = uuid.UUID(tenant_id)

    # Aggregations
    total_docs = db.query(Document).filter(Document.organization_id == org_id).count()
    total_regs = db.query(RegulationUpdate).count()
    
    pending_assessments = db.query(ImpactAssessment).filter(
        ImpactAssessment.organization_id == org_id,
        ImpactAssessment.status == "pending"
    ).count()

    pending_remediations = db.query(RemediationDraft).join(Document).filter(
        Document.organization_id == org_id,
        RemediationDraft.status == "PENDING_REVIEW"
    ).count()

    open_tasks = db.query(ImplementationTask).filter(
        ImplementationTask.status.in_(["TODO", "IN_PROGRESS"])
    ).count()

    # Max risk score
    max_risk = db.query(ImpactAssessment.risk_score).filter(
        ImpactAssessment.organization_id == org_id
    ).order_by(ImpactAssessment.risk_score.desc()).first()
    max_risk_score = max_risk[0] if max_risk else 0.0

    # Build recent activity feed
    activity = []
    
    # 1. Recent document uploads
    recent_docs = db.query(Document).filter(
        Document.organization_id == org_id
    ).order_by(Document.created_at.desc()).limit(3).all()
    for d in recent_docs:
        activity.append({
            "type": "document_uploaded",
            "message": f"Document '{d.filename}' (v{d.version}) uploaded to QMS.",
            "timestamp": d.created_at,
            "meta": {"document_id": str(d.id)}
        })

    # 2. Recent regulations
    recent_regs = db.query(RegulationUpdate).order_by(
        RegulationUpdate.published_date.desc()
    ).limit(3).all()
    for r in recent_regs:
        activity.append({
            "type": "regulation_monitored",
            "message": f"New FDA update monitored: '{r.title}'.",
            "timestamp": r.published_date,
            "meta": {"regulation_id": str(r.id)}
        })

    # 3. Recent approvals
    recent_approvals = db.query(ApprovalRecord).order_by(
        ApprovalRecord.timestamp.desc()
    ).limit(3).all()
    for ap in recent_approvals:
        activity.append({
            "type": "remediation_approved" if ap.status == "APPROVED" else "remediation_rejected",
            "message": f"Remediation draft for document has been {ap.status.lower()}.",
            "timestamp": ap.timestamp,
            "meta": {"record_id": str(ap.id)}
        })

    # Sort activity feed chronologically descending
    activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "total_documents": total_docs,
        "total_regulations": total_regs,
        "pending_assessments": pending_assessments,
        "pending_remediations": pending_remediations,
        "open_tasks": open_tasks,
        "max_risk_score": max_risk_score,
        "recent_activity": activity[:5]  # limit to top 5
    }
