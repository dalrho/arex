import logging
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger("arex.tasks")

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
    



def format_task_as_adf(description: str, department: str, priority: str, status: str, regulation_id: str) -> dict:
    """
    Formats task metadata and description into a fully structured Atlassian Document Format (ADF) payload.
    """
    content = []
    
    # 1. Main task description paragraph
    if description:
        for line in description.split("\n"):
            if line.strip():
                content.append({
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": line
                        }
                    ]
                })
            else:
                content.append({
                    "type": "paragraph",
                    "content": []
                })
    
    # 2. Add a divider line (rule)
    content.append({
        "type": "rule"
    })
    
    # 3. Heading for Metadata
    content.append({
        "type": "heading",
        "attrs": {
            "level": 3
        },
        "content": [
            {
                "type": "text",
                "text": "Task Metadata"
            }
        ]
    })
    
    # 4. Bullet list for details
    metadata_items = [
        ("Department", department),
        ("Priority", priority),
        ("Status", status),
        ("Regulatory Traceability ID", str(regulation_id))
    ]
    
    list_items = []
    for label, val in metadata_items:
        list_items.append({
            "type": "listItem",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": f"{label}: ",
                            "marks": [{"type": "strong"}]
                        },
                        {
                            "type": "text",
                            "text": val
                        }
                    ]
                }
            ]
        })
        
    content.append({
        "type": "bulletList",
        "content": list_items
    })
    
    return {
        "version": 1,
        "type": "doc",
        "content": content
    }


@router.post("/sync-jira")
def sync_tasks_to_jira(db: Session = Depends(get_db)) -> Any:
    """
    Push all approved implementation tasks to the Jira API.
    If Jira credentials are not configured, runs in simulated local mode.
    """
    from app.core.config import settings
    import httpx

    # Fetch all tasks that have status TODO, IN_PROGRESS, or DONE
    approved_tasks = db.query(ImplementationTask).filter(
        ImplementationTask.status.in_(["TODO", "IN_PROGRESS", "DONE"])
    ).all()

    if not approved_tasks:
        return {
            "message": "No approved tasks to sync.",
            "jira_response": {"status": "skipped", "synced_count": 0}
        }

    # Check if Jira settings are configured
    jira_configured = (
        settings.JIRA_URL and settings.JIRA_URL.strip() and
        settings.JIRA_EMAIL and settings.JIRA_EMAIL.strip() and
        settings.JIRA_API_TOKEN and settings.JIRA_API_TOKEN.strip()
    )

    synced_keys = []
    failed_count = 0
    simulated = False

    if jira_configured:
        # Real Jira integration
        project_key = (settings.JIRA_PROJECT_KEY or "AREX").strip()
        jira_base_url = settings.JIRA_URL.strip().rstrip("/")
        create_issue_url = f"{jira_base_url}/rest/api/3/issue"

        for task in approved_tasks:
            # Skip if already synced
            if task.jira_issue_key:
                synced_keys.append(task.jira_issue_key)
                continue

            # Prepare Jira create issue payload using ADF format for description
            payload = {
                "fields": {
                    "project": {
                        "key": project_key
                    },
                    "summary": f"[AREX Compliance] {task.title}",
                    "description": format_task_as_adf(
                        task.description,
                        task.department,
                        task.priority,
                        task.status,
                        task.regulation_id
                    ),
                    "issuetype": {
                        "name": "Task"
                    }
                }
            }

            try:
                # Basic Auth
                response = httpx.post(
                    create_issue_url,
                    json=payload,
                    auth=(settings.JIRA_EMAIL.strip(), settings.JIRA_API_TOKEN.strip()),
                    timeout=5.0
                )
                if response.status_code in [200, 201]:
                    res_data = response.json()
                    issue_key = res_data.get("key")
                    if issue_key:
                        task.jira_issue_key = issue_key
                        db.add(task)
                        synced_keys.append(issue_key)
                    else:
                        failed_count += 1
                else:
                    logger.error(f"Jira API returned {response.status_code}: {response.text}")
                    failed_count += 1
            except Exception as e:
                logger.error(f"Jira API connection error: {e}")
                failed_count += 1
        
        db.commit()
        jira_response = {
            "status": "success",
            "synced_count": len(synced_keys),
            "keys": synced_keys,
            "failed_count": failed_count,
            "mode": "live"
        }
        msg = f"Successfully synced {len(synced_keys)} tasks to Jira Cloud."
        if failed_count > 0:
            msg += f" ({failed_count} tasks failed to sync)."
    else:
        # Simulated local mode
        simulated = True
        sim_index = 101
        for task in approved_tasks:
            if not task.jira_issue_key:
                project_key = (settings.JIRA_PROJECT_KEY or "AREX").strip()
                task.jira_issue_key = f"{project_key}-{sim_index}"
                db.add(task)
                sim_index += 1
            synced_keys.append(task.jira_issue_key)
        
        db.commit()
        jira_response = {
            "status": "success",
            "synced_count": len(approved_tasks),
            "keys": synced_keys,
            "mode": "simulated"
        }
        msg = (
            f"Local simulated sync completed. Synced {len(approved_tasks)} tasks "
            f"under project '{settings.JIRA_PROJECT_KEY or 'AREX'}'. Configure JIRA_URL, "
            f"JIRA_EMAIL, and JIRA_API_TOKEN in your .env file to enable live sync to Atlassian."
        )

    # Auditing
    from app.core.audit import add_audit_event
    from app.models.regulation_update import RegulationUpdate
    reg_ids = list(set([task.regulation_id for task in approved_tasks if task.regulation_id]))
    for rid in reg_ids:
        add_audit_event(
            db, 
            rid, 
            "tasks_synchronized_to_jira", 
            f"Synchronized approved implementation tasks to Jira (Mode: {'Simulated' if simulated else 'Live'}). Keys: {', '.join(synced_keys)}"
        )
        
        reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == rid).first()
        if reg and reg.status != "Closed":
            reg.status = "Closed"
            db.add(reg)
            db.commit()
            add_audit_event(db, rid, "case_closed", "Compliance Case closed automatically after task synchronization.")

    return {
        "message": msg,
        "jira_response": jira_response
    }


@router.post("/jira-mock-endpoint")
def jira_mock_endpoint(payload: dict) -> Any:
    return {
        "status": "success",
        "message": "Received task synchronization payload",
        "received_count": len(payload.get("tasks", []))
    }


