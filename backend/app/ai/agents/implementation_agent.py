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

def _process_single_draft(
    draft_id_str: str,
    regulation_id_str: str,
    system_prompt: str
):
    """
    Worker function to process task generation for a single draft.
    Runs inside a thread pool with its own database session.
    """
    import time
    import uuid
    from app.core.dependencies import SessionLocal
    from app.core.profiler import RequestProfiler
    from app.models.remediation_draft import RemediationDraft
    from app.models.implementation_task import ImplementationTask

    # Initialize thread-local metrics
    RequestProfiler.reset()
    
    db_thread = SessionLocal()
    try:
        draft_id = uuid.UUID(draft_id_str)
        draft = db_thread.query(RemediationDraft).filter(RemediationDraft.id == draft_id).first()
        if not draft:
            logger.warning(f"Remediation draft {draft_id} not found in DB.")
            return [], RequestProfiler.get_metrics()

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
            f"[ImplementationAgent Thread] Calling LLM for draft {draft_id} | "
            f"mode={'online' if not llm_client.is_offline_mode() else 'offline'}"
        )
        
        result: ImplementationAgentOutput = llm_client.get_completion(
            messages=messages,
            response_model=ImplementationAgentOutput,
            temperature=0.0,
        )

        draft.requires_tasks = result.requires_tasks
        
        t_db = time.time()
        db_thread.add(draft)
        db_thread.commit()
        RequestProfiler.log_metric("database_write_time", time.time() - t_db)

        thread_task_ids = []
        if result.requires_tasks:
            tasks_list = []
            for item in result.tasks:
                dept_normalized = item.department.strip()
                if dept_normalized.upper() in ["IT", "INFORMATION TECHNOLOGY"]:
                    dept = "IT"
                elif dept_normalized.upper() in ["ENGINEERING", "ENG"]:
                    dept = "Engineering"
                elif dept_normalized.upper() in ["QA", "QUALITY ASSURANCE"]:
                    dept = "QA"
                else:
                    dept = "Training"

                priority = item.priority.strip().capitalize()
                if priority not in ["Low", "Medium", "High"]:
                    priority = "Medium"

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
                tasks_list.append(task)
            
            t_db = time.time()
            for t in tasks_list:
                db_thread.add(t)
            db_thread.commit()
            RequestProfiler.log_metric("database_write_time", time.time() - t_db)
            
            for t in tasks_list:
                thread_task_ids.append(str(t.id))

        return thread_task_ids, RequestProfiler.get_metrics()
    except Exception as err:
        db_thread.rollback()
        logger.error(f"Failed processing draft {draft_id_str} in thread: {err}")
        return [], RequestProfiler.get_metrics()
    finally:
        db_thread.close()


def run_implementation_agent(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph agent node that breaks down approved/suggested remediation changes
    into concrete, department-specific tasks with audit links.
    """
    from app.core.profiler import RequestProfiler
    import time
    RequestProfiler.reset()
    t_start = time.time()

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

        # Process drafts in parallel
        import concurrent.futures
        
        max_workers = min(len(draft_ids), 4)
        logger.info(f"Processing {len(draft_ids)} drafts in parallel using {max_workers} threads...")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(
                    _process_single_draft,
                    draft_id_str,
                    regulation_id_str,
                    system_prompt
                ): draft_id_str
                for draft_id_str in draft_ids
            }
            
            for future in concurrent.futures.as_completed(futures):
                d_id_str = futures[future]
                try:
                    thread_task_ids, thread_metrics = future.result()
                    task_ids.extend(thread_task_ids)
                    # Aggregate thread-local metrics into the main profiler
                    for metric, val in thread_metrics.items():
                        if metric != "total_time":
                            RequestProfiler.log_metric(metric, val)
                except Exception as exc:
                    logger.error(f"Draft thread processing for {d_id_str} raised exception: {exc}")

        logger.info(f"Implementation Agent successfully created {len(task_ids)} tasks.")
        RequestProfiler.log_metric("total_time", time.time() - t_start)
        RequestProfiler.print_summary("Implementation Agent")
        return {"task_ids": task_ids}

    except Exception as e:
        logger.error(f"Implementation Agent failed: {e}")
        db.rollback()
        if not llm_client.is_offline_mode():
            raise e
        return {"task_ids": []}
    finally:
        db.close()
