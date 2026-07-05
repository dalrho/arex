import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.implementation_task import ImplementationTask
from app.api.v1.schemas.task import TaskCreate, TaskUpdate, TaskResponse

router = APIRouter()

@router.get("/", response_model=List[TaskResponse])
def list_tasks(
    db: Session = Depends(get_db)
) -> Any:
    """
    List all compliance implementation tasks.
    """
    tasks = db.query(ImplementationTask).all()
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
