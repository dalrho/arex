# [EPIC-05-STORY-5.1] Compliance Dashboard - Aggregate Overview & Navigation UI

**Epic:** EPIC 5 — Compliance Dashboard
**User Story:** As a QA Manager, I want a single dashboard view of regulatory updates, impact, and status.

## Description
This ticket represents the implementation work for the user story in **EPIC 5 — Compliance Dashboard**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] Dashboard endpoint `/v1/dashboard` aggregates update feed, tasks, approvals, and KB stats.
- [ ] Responsive layout (`(dashboard)/layout.tsx`) with side navigation bar.
- [ ] Regulatory feed UI supports filtering by status, urgency, and date.
- [ ] UI gracefully handles empty, loading, and error states.
- [ ] Accessibility requirements met (keyboard navigation, semantic ARIA labels).

## Technical Tasks
- [ ] Design and implement API aggregate endpoints in `backend/app/api/v1/endpoints/dashboard.py`
- [ ] Create dashboard layout and structure in Next.js app router
- [ ] Build main page view with multiple dashboard widgets
- [ ] Add filters and sorting to the regulatory feed view
- [ ] Conduct accessibility review and fix ARIA labels/keyboard focus


## Collaborative Roles
*   **Frontend Developer (Lead):** Design responsive CSS grid layout. Build filters, search bars, navigation tabs, loading indicators, and error boundaries.
*   **Backend Developer:** Build the aggregation endpoint `GET /v1/dashboard` compiling stats from multiple database models in a single payload.

## Integration Contract
*   **Dashboard Response Schema (`GET /v1/dashboard`):**
    ```json
    {
      "statistics": {
        "active_sops": 24,
        "tracked_updates": 12,
        "pending_approvals": 3
      },
      "recent_updates": [
        {
          "id": "UUID",
          "title": "Title",
          "category": "records",
          "urgency": "high",
          "date": "2026-07-02T22:00:00Z"
        }
      ],
      "system_status": {
        "db_connected": true,
        "last_polled": "2026-07-04T15:00:00Z"
      }
    }
    ```

## Junior Developer Tips & Pitfalls
1.  **Avoid API Over-fetching:** Instead of requesting 5 different endpoints when loading the dashboard page, compile stats into a single `/v1/dashboard` endpoint to speed up rendering and reduce server round-trips.
2.  **React Suspense & Loading States:** Use skeletons/spinners when fetching dashboard metrics. Never let the dashboard screen render blank or crash on network delay.
\n## Affected Files
- [backend/app/api/v1/endpoints/dashboard.py](backend/app/api/v1/endpoints/dashboard.py)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/layout.tsx)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/page.tsx)
- [frontend/src/app/(dashboard](frontend/src/app/(dashboard)/regulations/page.tsx)

## Dependencies
- EPIC-04-STORY-4.1 (Impact Data Availability)
- EPIC-10-STORY-10.1 (Auth Guards)
