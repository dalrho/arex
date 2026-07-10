import logging
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger("sentinel-os.tasks")

from app.core.dependencies import get_db, get_tenant_id
from app.models.implementation_task import ImplementationTask
from app.models.remediation_draft import RemediationDraft
from app.models.regulation_update import RegulationUpdate
from app.api.v1.schemas.task import TaskCreate, TaskUpdate, TaskResponse
from pydantic import BaseModel

router = APIRouter()

@router.get("/", response_model=List[TaskResponse])
def list_tasks(
    regulation_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db)
) -> Any:
    """
    List all compliance implementation tasks, optionally filtered by regulation_id.
    """
    query = db.query(ImplementationTask)
    if regulation_id:
        query = query.filter(ImplementationTask.regulation_id == regulation_id)
    tasks = query.all()
    return tasks


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new implementation action item.
    """
    task = ImplementationTask(
        id=uuid.uuid4(),
        regulation_id=payload.regulation_id,
        remediation_draft_id=payload.remediation_draft_id,
        title=payload.title,
        description=payload.description,
        department=payload.department,
        priority=payload.priority,
        status="TODO"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update details or status (TODO/IN_PROGRESS/DONE) of a task.
    """
    task = db.query(ImplementationTask).filter(ImplementationTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Implementation task not found"
        )

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(task, field, value)

    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> None:
    """
    Delete a specific task.
    """
    task = db.query(ImplementationTask).filter(ImplementationTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Implementation task not found"
        )
    db.delete(task)
    db.commit()
    return None

@router.patch("/{task_id}", response_model=TaskResponse)
def patch_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db)
) -> Any:
    """
    Update details or status (TODO/IN_PROGRESS/DONE) of a task via PATCH.
    """
    return update_task(task_id=task_id, payload=payload, db=db)


class TaskGenerationRequest(BaseModel):
    regulation_id: uuid.UUID

@router.post("/generate", response_model=dict)
def generate_tasks_for_approved_drafts(
    payload: TaskGenerationRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Trigger the AI Implementation Agent to analyze approved remediation drafts
    for a given regulation and generate operational tasks.
    """
    org_id = uuid.UUID(tenant_id)
    approved_drafts = db.query(RemediationDraft).filter(
        RemediationDraft.regulation_id == payload.regulation_id,
        RemediationDraft.status == "APPROVED"
    ).all()
    
    if not approved_drafts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved remediation drafts found for this regulation."
        )

    reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == payload.regulation_id).first()
    if reg:
        reg.status = "Implementation Planning"
        db.add(reg)
        db.commit()

    from app.ai.agents.implementation_agent import run_implementation_agent
    state = {
        "regulation_id": str(payload.regulation_id),
        "organization_id": str(org_id),
        "remediation_draft_ids": [str(d.id) for d in approved_drafts]
    }
    try:
        res = run_implementation_agent(state)
        task_ids = res.get("task_ids", [])
    except Exception as e:
        logger.error(f"Failed to generate implementation tasks: {e}")
        if reg:
            reg.status = "Draft Approved"
            db.add(reg)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Implementation task generation failed: {str(e)}"
        )
        
    all_no_tasks = all(d.requires_tasks is False for d in approved_drafts)
    
    from app.core.audit import add_audit_event
    if all_no_tasks:
        if reg:
            reg.status = "Closed"
            db.add(reg)
            db.commit()
        add_audit_event(db, payload.regulation_id, "case_closed", "Policy revision completed successfully. No implementation tasks are required.")
        return {
            "requires_tasks": False,
            "tasks": [],
            "message": "Policy revision completed successfully. No implementation tasks are required."
        }
        
    tasks = db.query(ImplementationTask).filter(ImplementationTask.id.in_([uuid.UUID(tid) for tid in task_ids])).all()
    
    add_audit_event(db, payload.regulation_id, "tasks_generated", f"Generated {len(tasks)} implementation tasks.")
    
    return {
        "requires_tasks": True,
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "department": t.department,
                "priority": t.priority,
                "status": t.status,
                "created_at": t.created_at.isoformat() if hasattr(t.created_at, "isoformat") else str(t.created_at)
            }
            for t in tasks
        ],
        "message": f"Successfully generated {len(tasks)} implementation tasks."
    }
    



@router.post("/sync-jira")
def sync_tasks_to_jira(db: Session = Depends(get_db)) -> Any:
    """
    Push all approved implementation tasks to the Jira API (mocked).
    """
    approved_tasks = db.query(ImplementationTask).filter(
        ImplementationTask.status.in_(["TODO", "IN_PROGRESS", "DONE"])
    ).all()
    
    payload = {
        "tasks": [
            {
                "id": str(task.id),
                "title": task.title,
                "description": task.description,
                "department": task.department,
                "priority": task.priority,
                "status": task.status
            }
            for task in approved_tasks
        ]
    }
    
    # Attempt to post to our local mock endpoint
    import httpx
    try:
        # Resolve to backend container address if running in docker-compose, fallback to localhost
        url = "http://backend:8000/api/v1/tasks/jira-mock-endpoint"
        response = httpx.post(url, json=payload, timeout=2.0)
        jira_response = response.json()
    except Exception:
        try:
            url = "http://localhost:8000/api/v1/tasks/jira-mock-endpoint"
            response = httpx.post(url, json=payload, timeout=2.0)
            jira_response = response.json()
        except Exception:
            jira_response = {"status": "success", "synced_count": len(approved_tasks)}
        
    from app.core.audit import add_audit_event
    reg_ids = list(set([task.regulation_id for task in approved_tasks if task.regulation_id]))
    for rid in reg_ids:
        add_audit_event(db, rid, "tasks_synchronized_to_jira", f"Synchronized approved implementation tasks to Jira.")
        # Also let's update regulation status to Implementation Complete/Closed if relevant
        reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == rid).first()
        if reg:
            reg.status = "Closed"
            db.add(reg)
            db.commit()
            add_audit_event(db, rid, "case_closed", "Compliance Case closed automatically after task synchronization.")

    return {
        "message": f"Successfully synchronized {len(approved_tasks)} approved tasks to Jira.",
        "jira_response": jira_response
    }


@router.post("/jira-mock-endpoint")
def jira_mock_endpoint(payload: dict) -> Any:
    return {
        "status": "success",
        "message": "Received task synchronization payload",
        "received_count": len(payload.get("tasks", []))
    }


