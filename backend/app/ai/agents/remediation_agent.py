import os
import uuid
import logging
import difflib
from typing import Dict, Any, List
from pydantic import BaseModel

from app.core.dependencies import SessionLocal
from app.models.document import Document
from app.models.regulation_update import RegulationUpdate
from app.models.remediation_draft import RemediationDraft
from app.ai.llm_client import llm_client
from app.ai.tools.citation_tool import validate_citations

logger = logging.getLogger("sentinel-os.remediation-agent")

class RemediationAgentOutput(BaseModel):
    proposed_text: str
    citations: List[str]
    rationale: str

def generate_diff_metadata(original: str, proposed: str) -> Dict[str, List[str]]:
    """
    Utility using python difflib to compute structured line difference metadata.
    """
    orig_lines = original.splitlines()
    prop_lines = proposed.splitlines()
    
    diff = list(difflib.ndiff(orig_lines, prop_lines))
    
    added = []
    removed = []
    for line in diff:
        if line.startswith("+ "):
            added.append(line[2:])
        elif line.startswith("- "):
            removed.append(line[2:])
            
    return {
        "added": added,
        "removed": removed
    }

def run_remediation_agent(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph agent node that reviews impacted SOP documents and proposes draft revisions.
    Performs validation on citations and computes side-by-side diff details.
    """
    logger.info("Executing Remediation Agent...")
    
    regulation_id_str = state.get("regulation_id")
    organization_id_str = state.get("organization_id")
    # Retrieve matching document list from state (or default to empty if not relevant)
    matched_doc_ids = state.get("matched_document_ids", [])
    
    if not regulation_id_str or not organization_id_str:
        logger.error("Regulation ID or Organization ID missing in state.")
        return {"remediation_draft_ids": []}
        
    if not matched_doc_ids:
        logger.info("No matched document IDs found. Skipping remediation generation.")
        return {"remediation_draft_ids": []}
        
    db = SessionLocal()
    draft_ids = []
    
    try:
        regulation = db.query(RegulationUpdate).filter(
            RegulationUpdate.id == uuid.UUID(regulation_id_str)
        ).first()
        if not regulation:
            logger.error("Regulation not found in database.")
            return {"remediation_draft_ids": []}
            
        # Read system prompt
        current_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(current_dir, "../prompts/remediation.md")
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        except Exception:
            system_prompt = (
                "You are a GxP compliance officer. Review the SOP and propose a revised "
                "version to comply with the regulation. Cite the exact clause numbers."
            )

        for doc_id_val in matched_doc_ids:
            doc_id = uuid.UUID(str(doc_id_val))
            doc = db.query(Document).filter(Document.id == doc_id).first()
            if not doc or not doc.parsed_text:
                logger.warning(f"SOP Document {doc_id} has empty content, skipping.")
                continue
                
            logger.info(f"Generating remediation draft for SOP: {doc.filename}...")
            
            user_prompt = (
                f"SOURCE REGULATION UPDATE:\n{regulation.raw_content}\n\n"
                f"SOP TARGET DOCUMENT ({doc.filename}):\n{doc.parsed_text}\n\n"
                "Review the target document and suggest changes required for compliance."
            )
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Execute agent call with citation validation retry loop
            attempts = 3
            result = None
            for attempt in range(1, attempts + 1):
                try:
                    result = llm_client.get_completion(
                        messages=messages,
                        response_model=RemediationAgentOutput,
                        temperature=0.0
                    )
                    
                    # Validate citations
                    is_valid = validate_citations(
                        citations=result.citations,
                        regulation_content=regulation.raw_content,
                        parsed_sections=regulation.parsed_sections
                    )
                    
                    if is_valid:
                        break
                    else:
                        logger.warning(f"Remediation draft citation validation failed on attempt {attempt}.")
                        messages.append({
                            "role": "assistant",
                            "content": f"Proposed revisions:\n{result.proposed_text}\nCitations:\n{result.citations}"
                        })
                        messages.append({
                            "role": "user",
                            "content": "Your citations list cannot be empty and must map directly to the clauses in the regulation. Please retry."
                        })
                except Exception as ex:
                    logger.error(f"Error on remediation generation attempt {attempt}: {ex}")
                    if attempt == attempts:
                        raise ex

            if not result:
                logger.error(f"Failed to generate valid draft for document {doc_id}")
                continue

            # Compute differences using difflib helper
            diff_meta = generate_diff_metadata(doc.parsed_text, result.proposed_text)
            
            # Check if a draft already exists for this doc/regulation combination
            existing_draft = db.query(RemediationDraft).filter(
                RemediationDraft.document_id == doc_id,
                RemediationDraft.regulation_id == regulation.id
            ).first()
            
            if existing_draft:
                logger.info(f"Draft already exists for {doc.filename}. Updating proposed text.")
                existing_draft.proposed_text = result.proposed_text
                existing_draft.diff_content = diff_meta
                existing_draft.status = "PENDING_REVIEW"
                db.commit()
                db.refresh(existing_draft)
                draft_ids.append(str(existing_draft.id))
            else:
                new_draft = RemediationDraft(
                    id=uuid.uuid4(),
                    document_id=doc_id,
                    regulation_id=regulation.id,
                    proposed_text=result.proposed_text,
                    original_text=doc.parsed_text,
                    diff_content=diff_meta,
                    status="PENDING_REVIEW"
                )
                db.add(new_draft)
                db.commit()
                db.refresh(new_draft)
                draft_ids.append(str(new_draft.id))
                
        logger.info(f"Remediation Agent successfully generated {len(draft_ids)} drafts.")
        return {"remediation_draft_ids": draft_ids}
        
    except Exception as e:
        logger.error(f"Remediation Agent failed: {e}")
        db.rollback()
        return {"remediation_draft_ids": []}
    finally:
        db.close()
