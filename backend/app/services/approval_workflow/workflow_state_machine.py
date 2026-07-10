import logging

logger = logging.getLogger("arex.workflow-state-machine")

class WorkflowStateMachine:
    STATUS_DRAFT = "DRAFT"
    STATUS_UNDER_REVIEW = "UNDER_REVIEW"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"
    STATUS_NEEDS_REVISION = "NEEDS_REVISION"

    @classmethod
    def validate_transition(cls, current_status: str, new_status: str):
        """
        Validates state transitions for a remediation draft or approval item.
        """
        current = current_status.upper().replace(" ", "_")
        target = new_status.upper().replace(" ", "_")

        # Map legacy/UI statuses
        if current == "PENDING_REVIEW":
            current = cls.STATUS_UNDER_REVIEW
        if target == "PENDING_REVIEW":
            target = cls.STATUS_UNDER_REVIEW

        valid_statuses = {cls.STATUS_DRAFT, cls.STATUS_UNDER_REVIEW, cls.STATUS_APPROVED, cls.STATUS_REJECTED, cls.STATUS_NEEDS_REVISION}
        if target not in valid_statuses:
            raise ValueError(f"Invalid transition from '{current}' to '{target}'.")

        if current == cls.STATUS_APPROVED:
            if target != cls.STATUS_DRAFT:
                raise ValueError(f"Transition denied. Draft is already '{cls.STATUS_APPROVED}' and cannot be transitioned.")

        if current == cls.STATUS_REJECTED:
            if target == cls.STATUS_APPROVED:
                raise ValueError(f"Transition denied. Draft cannot transition directly from REJECTED to APPROVED.")

    @classmethod
    def validate_edit(cls, current_status: str):
        """
        Validates if modifications are permitted in the current state.
        """
        current = current_status.upper().replace(" ", "_")
        if current == "PENDING_REVIEW":
            current = cls.STATUS_UNDER_REVIEW

        if current in (cls.STATUS_APPROVED, cls.STATUS_REJECTED):
            raise ValueError(f"Draft cannot be modified in status '{current_status}'. It must not be in '{current}' state.")

