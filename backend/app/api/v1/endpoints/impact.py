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

from app.services.compliance_impact.impact_engine import assess_compliance_impact

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

    try:
        assessment = assess_compliance_impact(
            regulation_id=regulation_id,
            organization_id=org_id,
            db=db
        )
        
        # Update case status
        reg.status = "Impact Assessment Complete"
        db.add(reg)
        db.commit()
        
        # Log audit events
        from app.core.audit import add_audit_event
        add_audit_event(db, regulation_id, "impact_assessment_completed", "Compliance impact assessment completed successfully.")
        
        if assessment.affected_documents:
            doc_names = [d["document_name"] for d in assessment.affected_documents]
            doc_str = ", ".join(doc_names) if doc_names else "None"
            add_audit_event(db, regulation_id, "documents_identified", f"Identified affected documents: {doc_str}.")
            
        return assessment
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compliance impact assessment failed: {str(e)}"
        )

