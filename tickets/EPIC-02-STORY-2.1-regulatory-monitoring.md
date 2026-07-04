# [EPIC-02-STORY-2.1] Regulatory Monitoring - Automated FDA Poller & Change Detection

**Epic:** EPIC 2 — Regulatory Monitoring (Deterministic)
**User Story:** As a System (Automated Agent), I want to continuously poll FDA sources so new guidance is captured automatically.

## Description
This ticket represents the implementation work for the user story in **EPIC 2 — Regulatory Monitoring (Deterministic)**. The objective is to design, develop, and integrate the related backend APIs, service layers, and frontend components to ensure a fully functioning, security-compliant, and regulatory-traceable implementation.

## Acceptance Criteria
- [ ] FDA sources (Federal Register API, FDA.gov guidance pages) configured in `source_config.py`.
- [ ] `fda_monitoring/poller.py` implemented as a scheduled background job.
- [ ] `change_detector/diff_engine.py` detects changes using hash comparison and structured text diffs.
- [ ] `regulation_update` records persisted in Postgres.
- [ ] Rate-limiting, backoff strategy, and dead-letter queue handling implemented.
- [ ] Unit tests mock FDA responses and verify duplicate detection.

## Technical Tasks
- [ ] Configure external FDA endpoints in `backend/app/services/fda_monitoring/source_config.py`
- [ ] Implement scheduled worker job in `backend/app/services/fda_monitoring/poller.py`
- [ ] Implement `backend/app/services/change_detector/diff_engine.py` for content comparison
- [ ] Define DB models and schemas for `regulation_update`
- [ ] Implement poller worker process integration (`backend/app/workers/monitoring_job.py`)
- [ ] Add rate-limiting & error recovery strategies in poller service
- [ ] Write unit tests with mocked FDA API responses

## Affected Files
- [source_config.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/fda_monitoring/source_config.py)
- [poller.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/fda_monitoring/poller.py)
- [diff_engine.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/services/change_detector/diff_engine.py)
- [regulation_update.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/models/regulation_update.py)
- [monitoring_job.py](file:///d:/yciad/Documents/AMD%20HACKATHON/arex/backend/app/workers/monitoring_job.py)

## Dependencies
- EPIC-11-STORY-11.1 (Database and Worker Infrastructure)
