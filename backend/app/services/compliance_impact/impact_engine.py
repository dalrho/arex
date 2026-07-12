import uuid
import time
import logging
from sqlalchemy.orm import Session

from app.models.regulation_update import RegulationUpdate
from app.models.impact_assessment import ImpactAssessment
from app.services.embeddings.embedding_service import embedding_service
from app.services.vector_db.qdrant_client import vector_db_client
from app.services.risk_scoring.risk_rules import calculate_risk_score

logger = logging.getLogger("arex.compliance-impact-engine")

def assess_compliance_impact(
    regulation_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: Session,
    similarity_threshold: float = 0.60
) -> ImpactAssessment:
    """
    Assess compliance impact of a regulation update:
    1. Embed regulation update content.
    2. Query Qdrant vector database for matching company SOP chunks.
    3. Filter retrieved chunks above similarity threshold.
    4. Compute deterministic risk score and ranking.
    5. Save/update ImpactAssessment record in DB.
    """
    from app.core.profiler import RequestProfiler
    RequestProfiler.reset()
    logger.info(f"[Timing] assess_compliance_impact START for regulation {regulation_id}")
    t_total = time.time()
    
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
        logger.info(f"Overwriting existing impact assessment and invalidating drafts/tasks for regulation {regulation_id}...")
        db.delete(existing)
        
        from app.models.remediation_draft import RemediationDraft
        db.query(RemediationDraft).filter(RemediationDraft.regulation_id == regulation_id).delete()
        
        from app.models.implementation_task import ImplementationTask
        db.query(ImplementationTask).filter(ImplementationTask.regulation_id == regulation_id).delete()
        
        db.commit()

    # 2. Get embeddings and query Qdrant
    query_text = regulation.summary if regulation.summary and regulation.summary.strip() else regulation.raw_content
    t_embed = time.time()
    query_vector = embedding_service.get_embedding(query_text)
    logger.info(f"[Timing] Embedding generated in {time.time() - t_embed:.2f}s")
    # Search for matching document chunks
    t_qdrant = time.time()
    matched_chunks = vector_db_client.search_chunks(
        query_vector=query_vector,
        organization_id=organization_id,
        limit=20
    )
    logger.info(f"[Timing] Qdrant search completed in {time.time() - t_qdrant:.2f}s — {len(matched_chunks)} chunks")

    # Log retrieved chunks info
    from app.models.document import Document
    logger.info(f"[DEBUG LOG] Retrieved {len(matched_chunks)} total raw chunks from Qdrant.")
    for idx, chunk in enumerate(matched_chunks):
        doc_id_str = chunk.get("document_id")
        doc_name = "Unknown"
        if doc_id_str:
            doc_obj = db.query(Document).filter(Document.id == uuid.UUID(doc_id_str)).first()
            if doc_obj:
                doc_name = doc_obj.filename
        logger.info(
            f"[DEBUG LOG] Chunk {idx} | Document Name: {doc_name} | "
            f"Doc ID: {doc_id_str} | Chunk Index: {chunk.get('chunk_index')} | "
            f"Similarity Score: {chunk.get('score', 0.0):.4f}"
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

    # 4. AI-Powered RAG Analysis (or mock fallback in offline mode)
    from app.ai.llm_client import llm_client
    from pydantic import BaseModel, Field
    from app.models.document import Document

    class ImpactAssessmentLLMOutput(BaseModel):
        risk_score: float = Field(..., description="The risk score calculated as a float between 0.0 and 1.0 representing the compliance risk of the regulation update")
        impact_level: str = Field(..., description="The overall impact level: 'Low', 'Medium', or 'High'")
        rationale: str = Field(..., description="A clear, comprehensive compliance rationale explaining the conflicts, gaps, or alignment between the regulation update and our SOP portfolio")
        affected_departments: list[str] = Field(..., description="List of affected department names (e.g. IT, Quality Assurance, Engineering, Training, Operations)")
        explanations: dict[str, str] = Field(..., description="A dictionary mapping the filename of each affected SOP to a short paragraph explaining exactly what compliance gaps or conflicts exist in its retrieved snippet and what modifications are required for compliance")

    # Fetch document objects for matched IDs
    docs = []
    sop_context_parts = []
    if matched_doc_ids:
        docs = db.query(Document).filter(Document.id.in_(matched_doc_ids)).all()
        for doc in docs:
            snippet = unique_docs[doc.id]["text_snippet"]
            sop_context_parts.append(
                f"SOP Document: {doc.filename}\n"
                f"Retrieved Context Snippet:\n{snippet}\n"
                f"---"
            )

    sop_context = "\n\n".join(sop_context_parts) if sop_context_parts else "No matching company SOP documents found in QMS."

    system_prompt = (
        "You are an expert FDA GxP compliance officer. Your task is to perform a compliance impact assessment "
        "mapping a new regulatory update to a set of company Standard Operating Procedures (SOPs). "
        "Analyze the new regulation content against the provided company SOP context snippets. "
        "Identify any conflicts, gaps, or security requirements. You must output the overall impact level "
        "(Low, Medium, High), a calculated risk score (0.0 to 1.0), a detailed compliance rationale, "
        "the affected departments, and specific explanations for each affected SOP detailing why it "
        "requires modification."
    )

    regulation_content = regulation.summary if regulation.summary and regulation.summary.strip() else regulation.raw_content
    if len(regulation_content) > 12000:
        regulation_content = regulation_content[:12000] + "\n... [Content Truncated for Token Optimization] ..."

    user_prompt = (
        f"NEW REGULATORY UPDATE:\n"
        f"Title: {regulation.title}\n"
        f"Published Date: {regulation.published_date}\n"
        f"Content:\n{regulation_content}\n\n"
        f"COMPANY SOP CONTEXT (RELEVANT SECTIONS):\n"
        f"{sop_context}\n\n"
        f"Analyze the regulation update against our SOP context and generate the structured compliance impact assessment."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    from app.core.exceptions import LLMConfigurationError
    try:
        logger.info(f"[Timing] LLM impact assessment call START for '{regulation.title}'")
        t_llm = time.time()
        llm_response = llm_client.get_completion(
            messages=messages,
            response_model=ImpactAssessmentLLMOutput,
            temperature=0.0
        )
        logger.info(f"[Timing] LLM impact assessment call completed in {time.time() - t_llm:.2f}s")
    except LLMConfigurationError:
        raise
    except Exception as llm_err:
        logger.error(f"LLM call failed for impact assessment: {llm_err}. Using baseline fallback.")
        # Minimal fallback in case of API failure
        llm_response = ImpactAssessmentLLMOutput(
            risk_score=0.5,
            impact_level="Medium",
            rationale=f"Automatic compliance assessment for '{regulation.title}' completed with fallback due to LLM error.",
            affected_departments=["Quality Assurance"],
            explanations={}
        )

    # 5. Compile and serialize final affected documents list
    affected_docs_list = []

    # In offline/demo mode, the vector similarity threshold is never met (scores ~0.02),
    # so docs is empty. We fall back to loading all org documents and use the LLM
    # explanations to determine which ones need revision.
    from app.ai.llm_client import llm_client as _llm_client_ref
    is_offline = _llm_client_ref.is_offline_mode()
    if not docs and is_offline:
        all_org_docs = db.query(Document).filter(Document.organization_id == organization_id).all()
        # Build a dummy unique_docs entry for each so the loop below works
        for d in all_org_docs:
            if d.id not in unique_docs:
                unique_docs[d.id] = {"max_score": 0.0, "text_snippet": ""}
        docs = all_org_docs

    # Match the LLM explanations back to actual db documents
    for doc in docs:
        # Check if the document was marked as affected by the LLM (case-insensitive name check)
        explanation = None
        for filename_key, exp_text in llm_response.explanations.items():
            import os
            doc_base = os.path.splitext(doc.filename)[0].lower().strip()
            key_base = os.path.splitext(filename_key)[0].lower().strip()
            if doc_base in key_base or key_base in doc_base:
                explanation = exp_text
                break
        
        # If the LLM didn't return an explanation but the chunk was a strong vector match,
        # we still flag it as affected with a default explanation.
        # In offline mode, we rely strictly on the LLM explanations dict to determine
        # which files actually need revision — skip any doc not explicitly listed.
        if explanation is None and matched_doc_ids and not is_offline:
            explanation = (
                f"SOP section conflicts with new guidelines on {regulation.title}. "
                f"Requires review of authentication/access mechanisms."
            )

        # In offline mode, only include documents the mock LLM explicitly flagged as needing revision
        if explanation is None and is_offline:
            continue

        fname_lower = doc.filename.lower()
        if "sop" in fname_lower:
            doc_type = "SOP"
        elif "policy" in fname_lower:
            doc_type = "Company Policy"
        elif "plan" in fname_lower:
            doc_type = "Validation Plan"
        else:
            doc_type = "Other controlled document"

        score = unique_docs[doc.id]["max_score"]
        snippet = unique_docs[doc.id]["text_snippet"]

        affected_docs_list.append({
            "document_id": str(doc.id),
            "document_name": doc.filename,
            "document_type": doc_type,
            "affected_sections": snippet,
            "explanation": explanation,
            "confidence_score": round(score * 100, 1)
        })

    # 6. Save or update ImpactAssessment in database
    assessment = ImpactAssessment(
        id=uuid.uuid4(),
        regulation_id=regulation_id,
        organization_id=organization_id,
        risk_score=llm_response.risk_score,
        impact_level=llm_response.impact_level,
        rationale=llm_response.rationale,
        affected_departments=llm_response.affected_departments,
        affected_documents=affected_docs_list,
        status="pending"
    )

    t_db = time.time()
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    RequestProfiler.log_metric("database_write_time", time.time() - t_db)

    # Store matched document list on the transient property for graph state
    assessment.matched_document_ids = [uuid.UUID(d["document_id"]) for d in affected_docs_list]

    logger.info(f"[Timing] assess_compliance_impact TOTAL: {time.time() - t_total:.2f}s for regulation {regulation_id}")
    RequestProfiler.log_metric("total_time", time.time() - t_total)
    RequestProfiler.print_summary("Compliance Impact Assessment")

    return assessment


from typing import List, Dict, Any

def get_matched_documents(regulation_id: uuid.UUID, organization_id: uuid.UUID, db: Session) -> List[Dict[str, Any]]:
    """
    Fast pre-scan of matched documents using vector similarity search.
    """
    regulation = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not regulation:
        return []

    from app.models.document import Document
    from app.core.exceptions import LLMConfigurationError

    query_text = regulation.summary if regulation.summary and regulation.summary.strip() else regulation.raw_content
    try:
        query_vector = embedding_service.get_embedding(query_text)
        matched_chunks = vector_db_client.search_chunks(
            query_vector=query_vector,
            organization_id=organization_id,
            limit=20
        )
    except LLMConfigurationError:
        raise
    except Exception as e:
        logger.error(f"Error querying matched documents for pre_scan: {e}")
        return []

    unique_docs = {}
    for chunk in matched_chunks:
        score = chunk.get("score", 0.0)
        doc_id_str = chunk.get("document_id")
        if doc_id_str and score >= 0.75:
            doc_id = uuid.UUID(doc_id_str)
            if doc_id not in unique_docs:
                doc_obj = db.query(Document).filter(Document.id == doc_id).first()
                if doc_obj:
                    unique_docs[doc_id] = doc_obj.filename

    return [{"id": str(d_id), "filename": fname} for d_id, fname in unique_docs.items()]

