import os
import sys
import time
import logging
import uuid
from datetime import datetime, timezone

# Add parent dir to path so we can import app modules
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.core.dependencies import SessionLocal
from app.models.user import User
from app.models.organization import Organization
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.regulation_update import RegulationUpdate, REGULATION_SOURCE_FDA_API
from app.models.remediation_draft import RemediationDraft
from app.models.approval_record import ApprovalRecord
from app.models.impact_assessment import ImpactAssessment
from app.models.implementation_task import ImplementationTask
from app.ai.agents.regulatory_intelligence_agent import run_regulatory_intelligence
from app.services.compliance_impact.impact_engine import assess_compliance_impact
from app.ai.agents.remediation_agent import run_remediation_agent
from app.ai.agents.implementation_agent import run_implementation_agent

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("arex.run-profile")

def main():
    db = SessionLocal()
    try:
        # 1. Fetch organization
        org = db.query(Organization).first()
        if not org:
            logger.error("No organization found. Please run seed script first.")
            return
        
        logger.info(f"Using Organization: {org.name} (ID: {org.id})")

        # 2. Ingest a sample FDA regulation update
        title = "FDA Guidance: Security Requirements for Electronic Records & Signatures (21 CFR Part 11)"
        raw_content = (
            "FDA guidelines require that electronic records, electronic signatures, and handwritten signatures "
            "executed to electronic records shall be trustworthy, reliable, and generally equivalent to paper "
            "records. Specifically, the system must enforce: "
            "1. Password aging and account lockout after 3 consecutive failed login attempts. "
            "2. Automated session timeout/inactivity termination after 15 minutes of idle time. "
            "3. Encryption of records during transmission using TLS 1.3. "
            "4. Maintaining a computer-generated, time-stamped audit trail that records the date, time, and "
            "author of all actions that create, modify, or delete electronic records. "
            "5. Strict dual-authorization approvals for all SOP modifications and document releases."
        )
        
        hash_val = "demo-profile-hash-" + str(uuid.uuid4())
        
        reg = RegulationUpdate(
            id=uuid.uuid4(),
            source_url=f"https://www.fda.gov/regulatory-information/search-fda-guidance-documents/demo-{uuid.uuid4()}",
            title=title,
            published_date=datetime.now(timezone.utc),
            raw_content=raw_content,
            parsed_sections={
                "section_1.1": "Password aging and account lockout after 3 consecutive failed login attempts.",
                "section_1.2": "Automated session timeout/inactivity termination after 15 minutes of idle time.",
                "section_1.3": "Encryption of records during transmission using TLS 1.3.",
                "section_1.4": "Maintaining a computer-generated, time-stamped audit trail.",
                "section_1.5": "Strict dual-authorization approvals."
            },
            hash_value=hash_val,
            status="Not Analyzed",
            source=REGULATION_SOURCE_FDA_API
        )
        
        db.add(reg)
        db.commit()
        db.refresh(reg)
        logger.info(f"Ingested Demo Regulation: {reg.title} (ID: {reg.id})")

        # 3. Execute Regulatory Intelligence
        logger.info("\n--- STEP 1: RUNNING REGULATORY INTELLIGENCE AGENT ---")
        ri_state = {
            "regulation_id": str(reg.id),
            "organization_id": str(org.id),
            "raw_content": reg.raw_content
        }
        ri_result = run_regulatory_intelligence(ri_state)
        
        # Save classification back to DB
        reg.parsed_sections = {
            "sections": reg.parsed_sections,
            "classification": {
                "relevant": ri_result.get("relevant", False),
                "category": ri_result.get("category", "other"),
                "urgency": ri_result.get("urgency", "low"),
                "affected_business_areas": ri_result.get("affected_business_areas", []),
                "rationale": ri_result.get("rationale", ""),
            }
        }
        db.add(reg)
        db.commit()
        db.refresh(reg)

        # 4. Execute Impact Assessment
        logger.info("\n--- STEP 2: RUNNING COMPLIANCE IMPACT ASSESSMENT ---")
        assessment = assess_compliance_impact(
            regulation_id=reg.id,
            organization_id=org.id,
            db=db,
            similarity_threshold=0.50
        )
        
        # 5. Execute Remediation Drafts
        logger.info("\n--- STEP 3: RUNNING REMEDIATION AGENT ---")
        rem_state = {
            "regulation_id": str(reg.id),
            "organization_id": str(org.id),
            "matched_document_ids": assessment.matched_document_ids
        }
        rem_result = run_remediation_agent(rem_state)
        
        # 6. Execute Implementation Tasks
        logger.info("\n--- STEP 4: RUNNING IMPLEMENTATION AGENT ---")
        impl_state = {
            "regulation_id": str(reg.id),
            "remediation_draft_ids": rem_result.get("remediation_draft_ids", [])
        }
        run_implementation_agent(impl_state)

        logger.info("\n=== END-TO-END PIPELINE PROFILING COMPLETE ===")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
