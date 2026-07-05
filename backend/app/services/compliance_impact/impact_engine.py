import uuid
import logging
from sqlalchemy.orm import Session

from app.models.regulation_update import RegulationUpdate
from app.models.impact_assessment import ImpactAssessment
from app.services.embeddings.embedding_service import embedding_service
from app.services.vector_db.qdrant_client import vector_db_client
from app.services.risk_scoring.risk_rules import calculate_risk_score

logger = logging.getLogger("sentinel-os.compliance-impact-engine")

def assess_compliance_impact(
    regulation_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: Session,
    similarity_threshold: float = 0.75
) -> ImpactAssessment:
    """
    Assess compliance impact of a regulation update:
    1. Embed regulation update content.
    2. Query Qdrant vector database for matching company SOP chunks.
    3. Filter retrieved chunks above similarity threshold.
    4. Compute deterministic risk score and ranking.
    5. Save/update ImpactAssessment record in DB.
    """
    logger.info(f"Assessing compliance impact for regulation {regulation_id}...")
    
    # 1. Fetch regulation content
    regulation = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not regulation:
        raise ValueError(f"Regulation update with ID {regulation_id} not found.")

    # Check if assessment already exists for this org/regulation
    existing = db.query(ImpactAssessment).filter(
        ImpactAssessment.regulation_id == regulation_id,
        ImpactAssessment.organization_id == organization_id
    ).first()
    if existing:
        logger.info(f"Impact assessment already exists for regulation {regulation_id}.")
        return existing

    # 2. Get embeddings and query Qdrant
    query_vector = embedding_service.get_embedding(regulation.raw_content)
    # Search for matching document chunks
    matched_chunks = vector_db_client.search_chunks(
        query_vector=query_vector,
        organization_id=organization_id,
        limit=20
    )

    # 3. Filter matched SOPs based on similarity threshold
    unique_docs = {}
    for chunk in matched_chunks:
        score = chunk.get("score", 0.0)
        doc_id_str = chunk.get("document_id")
        if doc_id_str and score >= similarity_threshold:
            doc_id = uuid.UUID(doc_id_str)
            if doc_id not in unique_docs or score > unique_docs[doc_id]["max_score"]:
                unique_docs[doc_id] = {
                    "max_score": score,
                    "text_snippet": chunk.get("text", "")
                }
                
    matched_doc_ids = list(unique_docs.keys())
    logger.info(f"Found {len(matched_doc_ids)} documents matching regulation with similarity >= {similarity_threshold}")

    # 4. Map departments and category based on heuristic analysis or previous state
    # (Since this is step-by-step logic, we derive it from keyword analysis or metadata)
    affected_departments = ["Quality Assurance"]
    content_lower = regulation.raw_content.lower()
    
    # Standard keyword extraction for departments
    if "multi-factor" in content_lower or "mfa" in content_lower:
        affected_departments.append("IT")
    if "timeout" in content_lower or "session" in content_lower:
        if "Engineering" not in affected_departments:
            affected_departments.append("Engineering")
    if "signature" in content_lower or "sign" in content_lower:
        if "Training" not in affected_departments:
            affected_departments.append("Training")

    # Determine category matching RegulatoryIntelligence category structure
    category = "other"
    if "signature" in content_lower:
        category = "signatures"
    elif "audit" in content_lower or "log" in content_lower:
        category = "records"
    elif "mfa" in content_lower or "timeout" in content_lower:
        category = "validation"

    # Default urgency (will override based on keywords or database update status)
    urgency = "low"
    if "suspend" in content_lower or "warning" in content_lower or "penalty" in content_lower:
        urgency = "critical"
    elif "mfa" in content_lower or "timeout" in content_lower:
        urgency = "high"
    elif "signature" in content_lower:
        urgency = "medium"

    # Compute deterministic risk
    risk_info = calculate_risk_score(
        urgency=urgency,
        category=category,
        affected_departments_count=len(affected_departments)
    )

    # Compile rationale string
    matched_sops_names = []
    from app.models.document import Document
    if matched_doc_ids:
        docs = db.query(Document).filter(Document.id.in_(matched_doc_ids)).all()
        matched_sops_names = [d.filename for d in docs]

    sops_str = ", ".join(matched_sops_names) if matched_sops_names else "None"
    rationale = (
        f"Compliance assessment of '{regulation.title}'. "
        f"Matched SOPs: {sops_str}. "
        f"Identified impact category as '{category}' and urgency as '{urgency}'. "
        f"Affected departments: {', '.join(affected_departments)}."
    )

    # 5. Save impact assessment
    assessment = ImpactAssessment(
        id=uuid.uuid4(),
        regulation_id=regulation_id,
        organization_id=organization_id,
        risk_score=risk_info["risk_score"],
        impact_level=risk_info["impact_level"],
        rationale=rationale,
        affected_departments=affected_departments,
        status="pending"
    )

    # Attach document list as transient property if needed or store in state
    # (Since PostgreSQL model has matched_document_ids, wait, let's check model definition)
    # Ah! In the PostgreSQL model we defined, we had no matched_document_ids list. Let's see models/impact_assessment.py.
    # It has: id, regulation_id, organization_id, risk_score, impact_level, rationale, affected_departments (JSON), status.
    # That is perfectly fine, we store the metadata in the rationale or state.
    
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    
    # Store matched document list on the transient property for graph state
    assessment.matched_document_ids = matched_doc_ids
    
    return assessment
