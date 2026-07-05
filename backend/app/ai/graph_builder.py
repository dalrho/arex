import os
import uuid
import sqlite3
import logging
from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

from app.core.dependencies import SessionLocal
from app.services.compliance_impact.impact_engine import assess_compliance_impact
from app.ai.agents.regulatory_intelligence_agent import run_regulatory_intelligence
from app.ai.agents.remediation_agent import run_remediation_agent
from app.ai.agents.implementation_agent import run_implementation_agent

logger = logging.getLogger("sentinel-os.graph-builder")

class AgentState(TypedDict):
    regulation_id: str
    organization_id: str
    raw_content: str
    
    # Node outputs: Regulatory Intelligence
    relevant: Optional[bool]
    category: Optional[str]
    urgency: Optional[str]
    affected_business_areas: Optional[List[str]]
    rationale: Optional[str]
    
    # Node outputs: Compliance Impact Assessment
    risk_score: Optional[float]
    impact_level: Optional[str]
    affected_departments: Optional[List[str]]
    matched_document_ids: Optional[List[str]]
    
    # Node outputs: Remediation Drafts
    remediation_draft_ids: Optional[List[str]]
    
    # Node outputs: Implementation Tasks
    task_ids: Optional[List[str]]


def run_compliance_impact(state: AgentState) -> Dict[str, Any]:
    """
    Wrapper node function invoking the compliance impact service.
    Queries vector DB and runs deterministic risk rules.
    """
    logger.info("Executing Compliance Impact Assessment Node...")
    regulation_id = uuid.UUID(state["regulation_id"])
    organization_id = uuid.UUID(state["organization_id"])
    
    db = SessionLocal()
    try:
        assessment = assess_compliance_impact(
            regulation_id=regulation_id,
            organization_id=organization_id,
            db=db
        )
        matched_doc_ids = getattr(assessment, "matched_document_ids", [])
        return {
            "risk_score": assessment.risk_score,
            "impact_level": assessment.impact_level,
            "affected_departments": assessment.affected_departments,
            "matched_document_ids": [str(d) for d in matched_doc_ids]
        }
    except Exception as e:
        logger.error(f"Compliance Impact Node failed: {e}")
        return {
            "risk_score": 0.0,
            "impact_level": "Low",
            "affected_departments": ["Quality Assurance"],
            "matched_document_ids": []
        }
    finally:
        db.close()


def route_relevance(state: AgentState) -> str:
    """
    Conditional edge router evaluating relevance of regulation update.
    """
    if state.get("relevant"):
        return "compliance_impact"
    return "end"


# Setup the graph workflow
workflow = StateGraph(AgentState)

# Add all agents and processing nodes
workflow.add_node("regulatory_intelligence", run_regulatory_intelligence)
workflow.add_node("compliance_impact", run_compliance_impact)
workflow.add_node("remediation", run_remediation_agent)
workflow.add_node("implementation_task", run_implementation_agent)

# Configure flow entrypoint
workflow.set_entry_point("regulatory_intelligence")

# Add conditional routing
workflow.add_conditional_edges(
    "regulatory_intelligence",
    route_relevance,
    {
        "compliance_impact": "compliance_impact",
        "end": END
    }
)

# Connect remaining pipelines
workflow.add_edge("compliance_impact", "remediation")
workflow.add_edge("remediation", "implementation_task")
workflow.add_edge("implementation_task", END)

# Set up SQLite checkpointer persistence
storage_dir = "/app/storage"
os.makedirs(storage_dir, exist_ok=True)
db_path = os.path.join(storage_dir, "checkpoints.sqlite")

conn = sqlite3.connect(db_path, check_same_thread=False)
memory = SqliteSaver(conn=conn)

# Compile LangGraph orchestrator
graph = workflow.compile(checkpointer=memory)

def trigger_agent_pipeline(
    regulation_id: str,
    organization_id: str,
    raw_content: str
) -> Dict[str, Any]:
    """
    Executes the compiled LangGraph workflow synchronously.
    Thread configuration tracks checkpoint states.
    """
    thread_id = f"reg_{regulation_id}"
    config = {"configurable": {"thread_id": thread_id}}
    
    initial_state = {
        "regulation_id": regulation_id,
        "organization_id": organization_id,
        "raw_content": raw_content,
        "relevant": None,
        "category": None,
        "urgency": None,
        "affected_business_areas": [],
        "rationale": "",
        "risk_score": 0.0,
        "impact_level": "Low",
        "affected_departments": [],
        "matched_document_ids": [],
        "remediation_draft_ids": [],
        "task_ids": []
    }
    
    logger.info(f"Triggering LangGraph pipeline for Thread: {thread_id}")
    final_state = graph.invoke(initial_state, config=config)
    return final_state
