import os
import uuid
import logging
from typing import Dict, Any, List
from pydantic import BaseModel

from app.core.dependencies import SessionLocal
from app.models.remediation_draft import RemediationDraft
from app.models.implementation_task import ImplementationTask
from app.ai.llm_client import llm_client

logger = logging.getLogger("arex.implementation-agent")

class TaskItem(BaseModel):
    title: str
    description: str
    department: str  # Engineering | QA | IT | Training
    priority: str = "Medium"  # Low | Medium | High

class ImplementationAgentOutput(BaseModel):
    requires_tasks: bool
    tasks: List[TaskItem]

def run_implementation_agent(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph agent node that breaks down approved/suggested remediation changes
    into concrete, department-specific tasks with audit links.
    """
    logger.info("Executing Implementation Agent...")
    
    regulation_id_str = state.get("regulation_id")
    draft_ids = state.get("remediation_draft_ids", [])
    
    if not regulation_id_str:
        logger.error("Regulation ID missing in state.")
        return {"task_ids": []}
        
    if not draft_ids:
        logger.info("No remediation draft IDs found. Skipping task generation.")
        return {"task_ids": []}
        
    db = SessionLocal()
    task_ids = []
    
    try:
        # Read system prompt
        current_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_path = os.path.join(current_dir, "../prompts/implementation.md")
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        except Exception:
            system_prompt = (
                "You are an implementation project manager in a GxP environment. "
                "Determine if operational execution tasks are required. If so, output requires_tasks as true "
                "and list tasks for IT, Engineering, QA, or Training. Otherwise, output requires_tasks as false."
            )

        for draft_id_str in draft_ids:
            draft_id = uuid.UUID(draft_id_str)
            draft = db.query(RemediationDraft).filter(RemediationDraft.id == draft_id).first()
            if not draft:
                logger.warning(f"Remediation draft {draft_id} not found in DB.")
                continue
                
            logger.info(f"Breaking down draft changes into tasks for draft: {draft_id}...")
            
            user_prompt = (
                f"REMEDIATION DRAFT SUGGESTED TEXT:\n{draft.proposed_text}\n\n"
                f"ORIGINAL SOP TEXT:\n{draft.original_text}\n\n"
                "Please analyze the additions/deletions and outline the operational tasks required to execute this update."
            )
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            logger.info(
                f"[ImplementationAgent] Calling LLM for draft {draft_id} | "
                f"mode={'online' if not llm_client.is_offline_mode() else 'offline'}"
            )
            # Call LLM client
            result: ImplementationAgentOutput = llm_client.get_completion(
                messages=messages,
                response_model=ImplementationAgentOutput,
                temperature=0.0,
            )
            
            # Save requires_tasks state on the draft
            draft.requires_tasks = result.requires_tasks
            db.add(draft)
            db.commit()

            # Store generated tasks if operational work is needed
            if result.requires_tasks:
                for item in result.tasks:
                    # Validate department enum matching models
                    dept_normalized = item.department.strip()
                    if dept_normalized.upper() in ["IT", "INFORMATION TECHNOLOGY"]:
                        dept = "IT"
                    elif dept_normalized.upper() in ["ENGINEERING", "ENG"]:
                        dept = "Engineering"
                    elif dept_normalized.upper() in ["QA", "QUALITY ASSURANCE"]:
                        dept = "QA"
                    else:
                        dept = "Training"
                        
                    # Normalize priority
                    priority = item.priority.strip().capitalize()
                    if priority not in ["Low", "Medium", "High"]:
                        priority = "Medium"
                        
                    # Save task
                    task = ImplementationTask(
                        id=uuid.uuid4(),
                        regulation_id=uuid.UUID(regulation_id_str),
                        remediation_draft_id=draft.id,
                        title=item.title,
                        description=item.description,
                        department=dept,
                        priority=priority,
                        status="PENDING_APPROVAL"
                    )
                    db.add(task)
                    db.commit()
                    db.refresh(task)
                    task_ids.append(str(task.id))
                    
        logger.info(f"Implementation Agent successfully created {len(task_ids)} tasks.")
        return {"task_ids": task_ids}

        
    except Exception as e:
        logger.error(f"Implementation Agent failed: {e}")
        db.rollback()
        if not llm_client.is_offline_mode():
            raise e
        return {"task_ids": []}
    finally:
        db.close()
