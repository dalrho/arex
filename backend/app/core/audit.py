import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.regulation_update import RegulationUpdate

def add_audit_event(
    db: Session,
    regulation_id: uuid.UUID,
    event_type: str,
    description: str,
    user_email: Optional[str] = None
):
    reg = db.query(RegulationUpdate).filter(RegulationUpdate.id == regulation_id).first()
    if not reg:
        return
    event_entry = {
        "event_type": event_type,
        "description": description,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user_email or "System"
    }
    history = reg.audit_history or []
    if not isinstance(history, list):
        history = []
    history = list(history)
    history.append(event_entry)
    reg.audit_history = history
    db.add(reg)
    db.commit()
