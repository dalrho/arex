# [EPIC-08-STORY-8.1] Human Approval Workflow - Safety-Critical State Machine & Immutable Logs

**Epic:** EPIC 8 — Human Approval Workflow (Safety-Critical)
**User Story:** As a Authorized Reviewer, I want to approve, edit, or reject any AI recommendation before it's considered final.

## Description
This ticket represents the implementation work for the user story in **EPIC 8 — Human Approval Workflow (Safety-Critical)**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Approval DB model tracks status, reviewer ID, timestamp, original, and modified contents.
- [ ] `workflow_state_machine.py` enforces valid transition rules.
- [ ] API endpoint `POST /v1/approvals/{item_id}/decision` enforces RBAC restrictions.
- [ ] UI `ApprovalActionBar.tsx` integrated on remediation and task interfaces.
- [ ] Security/Audit requirement: Immutable audit trail records every decision.
- [ ] Rejected or edited drafts are blocked from being exported without re-approval.

## Technical Tasks
- [ ] Implement `backend/app/models/approval_record.py` model
- [ ] Build workflow state engine `backend/app/services/approval_workflow/workflow_state_machine.py`
- [ ] Create API endpoints for decisions with security validation
- [ ] Build `ApprovalActionBar.tsx` in frontend components
- [ ] Design and build approval queue UI page in `frontend/src/app/(dashboard)/approvals/page.tsx`
- [ ] Write role restriction tests ensuring only authorized roles can invoke decisions
- [ ] Implement immutable logging constraints for approval transactions


## Collaborative Roles
*   **Backend Developer (Lead):** Design the `approval_records` database table. Implement the state engine transitions inside `workflow_state_machine.py`. Configure append-only constraints.
*   **Frontend Developer:** Build the `ApprovalActionBar.tsx` overlaying draft reviews with Approve, Edit, and Reject actions.

## Integration Contract
*   **Postgres Model (`ApprovalRecord`):**
    ```python
    id: UUID (Primary Key)
    organization_id: UUID (Foreign Key)
    reviewer_id: UUID (Foreign Key)
    target_type: str  # Enum: "remediation_draft" | "implementation_task"
    target_id: UUID  # Foreign Key linking to the approved entity
    status: str  # Enum: "approved" | "edited" | "rejected"
    original_snapshot: JSON  # The raw AI text proposal
    final_snapshot: JSON  # The final text (with human adjustments if edited)
    comments: str
    timestamp: datetime
    ```

## Junior Developer Tips & Pitfalls
1.  **Enforce Immutable Database Logs:** Under 21 CFR Part 11, electronic sign-off records and audit logs must be immutable. Enforce this by writing database triggers in PostgreSQL or using application ORM hook overrides that raise an exception if a developer/user attempts an `UPDATE` or `DELETE` on the `approval_records` table.
2.  **Role Authorization Guards:** Explicitly check the user's JWT role before processing decisions. Only "QA Manager" or "Org Admin" roles should have permissions to invoke approvals. Throw a 403 Forbidden error for unauthorized roles.
\n## Affected Files
- [backend/app/models/approval_record.py](backend/app/models/approval_record.py)
- [backend/app/services/approval_workflow/workflow_state_machine.py](backend/app/services/approval_workflow/workflow_state_machine.py)
- [backend/app/api/v1/endpoints/approvals.py](backend/app/api/v1/endpoints/approvals.py)
- [frontend/src/components/approvals/ApprovalActionBar.tsx](frontend/src/components/approvals/ApprovalActionBar.tsx)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/approvals/page.tsx)

## Dependencies
- EPIC-10-STORY-10.1 (Role-Based Access Control)
- EPIC-06-STORY-6.1 (Remediation), EPIC-07-STORY-7.1 (Implementation)
