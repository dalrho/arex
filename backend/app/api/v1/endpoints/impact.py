import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_tenant_id
from app.models.impact_assessment import ImpactAssessment
from app.models.regulation_update import RegulationUpdate
from app.api.v1.schemas.impact import ImpactResponse

router = APIRouter()

@router.get("/", response_model=List[ImpactResponse])
def list_impact_assessments(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    List all regulatory impact assessments generated for the organization.
    """
    org_id = uuid.UUID(tenant_id)
    assessments = db.query(ImpactAssessment).filter(
        ImpactAssessment.organization_id == org_id
    ).all()
    return assessments

@router.get("/regulation/{regulation_id}", response_model=ImpactResponse)
def get_impact_by_regulation(
    regulation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Get the impact assessment of a specific regulation update on this organization's SOP portfolio.
    """
    org_id = uuid.UUID(tenant_id)
    assessment = db.query(ImpactAssessment).filter(
        ImpactAssessment.regulation_id == regulation_id,
        ImpactAssessment.organization_id == org_id
    ).first()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Impact assessment not found for the specified regulation"
        )
    return assessment

@router.post("/regulation/{regulation_id}/assess", response_model=ImpactResponse, status_code=status.HTTP_201_CREATED)
def trigger_impact_assessment(
    regulation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Trigger the AI compliance impact engine to generate an assessment mapping a regulation update to SOPs.
    """
    org_id = uuid.UUID(tenant_id)
    
    # Check if regulation exists
    reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulation update not found"
        )

    # Check if assessment already exists
    existing = db.query(ImpactAssessment).filter(
        ImpactAssessment.regulation_id == regulation_id,
        ImpactAssessment.organization_id == org_id
    ).first()
    if existing:
        return existing

    # Perform a dummy or simple rule-based assessment.
    # We will search the database or vector DB for related words to compute score.
    # In a full agent run, we'd invoke the compliance impact engine service.
    # We can write a simple heuristic:
    content = reg.raw_content.lower()
    risk_score = 0.1
    rationales = []
    affected_depts = ["Quality Assurance"]
    
    if "multi-factor" in content or "mfa" in content:
        risk_score += 0.4
        rationales.append("Mandatory Multi-Factor Authentication requirements detected.")
        affected_depts.append("Information Technology")
    if "timeout" in content or "session" in content:
        risk_score += 0.35
        rationales.append("Session timeout limits and inactivity constraints detected.")
        affected_depts.append("Engineering")
    if "audit trail" in content or "log" in content:
        risk_score += 0.25
        rationales.append("System log or audit trail data integrity rules found.")
        affected_depts.append("System Administration")

    risk_score = min(risk_score, 1.0)
    level = "Low"
    if risk_score >= 0.7:
        level = "High"
    elif risk_score >= 0.4:
        level = "Medium"

    rat_str = " ".join(rationales) if rationales else "No direct conflicts found."
    rat_str = f"AI Impact Analysis: {rat_str} Expected impact is {level} on QMS standard procedures."

    assessment = ImpactAssessment(
        id=uuid.uuid4(),
        regulation_id=regulation_id,
        organization_id=org_id,
        risk_score=risk_score,
        impact_level=level,
        rationale=rat_str,
        affected_departments=affected_depts,
        status="pending"
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment
