import logging

logger = logging.getLogger("arex.workflow-state-machine")

class WorkflowStateMachine:
    STATUS_PENDING = "PENDING_REVIEW"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"

    @classmethod
    def validate_transition(cls, current_status: str, new_status: str):
        """
        Validates state transitions for a remediation draft or approval item.
        """
        current = current_status.upper()
        target = new_status.upper()

        if current == cls.STATUS_APPROVED:
            raise ValueError(f"Transition denied. Draft is already '{cls.STATUS_APPROVED}' and cannot be transitioned.")

        if current == cls.STATUS_REJECTED:
            if target == cls.STATUS_PENDING:
                return  # Reset is permitted
            raise ValueError(f"Transition denied. Draft is in state '{cls.STATUS_REJECTED}' and cannot transition directly to '{target}'. It must be reset to '{cls.STATUS_PENDING}' first.")

        if current == cls.STATUS_PENDING:
            if target in [cls.STATUS_APPROVED, cls.STATUS_REJECTED, cls.STATUS_PENDING]:
                return
            raise ValueError(f"Invalid transition from '{current}' to '{target}'.")

    @classmethod
    def validate_edit(cls, current_status: str):
        """
        Validates if modifications are permitted in the current state.
        """
        current = current_status.upper()
        if current != cls.STATUS_PENDING:
            raise ValueError(f"Draft cannot be modified in status '{current}'. It must be in '{cls.STATUS_PENDING}' state.")
