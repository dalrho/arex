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


## Collaborative Roles
*   **Backend Developer (Lead):** Set up scheduled execution worker processes using Celery Beat/APScheduler. Design the database table `regulation_updates` to store guidance metadata and parsed texts.
*   **AI/Data Engineer:** Write the Web Scraper and RSS parser in `poller.py` to extract Federal Register updates. Write the diff engine to identify structural modifications between revisions.

## Integration Contract
*   **Postgres Model (`RegulationUpdate`):**
    ```python
    id: UUID (Primary Key)
    source_url: str (Unique)
    title: str
    published_date: datetime
    raw_content: str
    parsed_sections: JSON  # Structured dictionary of sections/clauses
    hash_value: str  # MD5/SHA256 checksum to quickly detect content changes
    status: str  # Enum: "pending_analysis" | "classified"
    ```

## Junior Developer Tips & Pitfalls
1.  **Rate Limiting & Backoff:** The Federal Register and FDA servers will block you if you poll aggressively. Configure the poller with random sleep delays and exponential backoff (e.g. retry in 5, 10, then 30 mins) on connection errors.
2.  **Idempotency Checks:** Store checksum hashes of fetched guidance documents. Do not trigger the RAG pipeline or AI agents if the content has not changed.
3.  **Celery Dead-Letter Handling:** Ensure failed scrapers are logged, retried max 3 times, and sent to a dead-letter state rather than clogging the worker queue.
\n## Affected Files
- [backend/app/services/fda_monitoring/source_config.py](backend/app/services/fda_monitoring/source_config.py)
- [backend/app/services/fda_monitoring/poller.py](backend/app/services/fda_monitoring/poller.py)
- [backend/app/services/change_detector/diff_engine.py](backend/app/services/change_detector/diff_engine.py)
- [backend/app/models/regulation_update.py](backend/app/models/regulation_update.py)
- [backend/app/workers/monitoring_job.py](backend/app/workers/monitoring_job.py)

## Dependencies
- EPIC-11-STORY-11.1 (Database and Worker Infrastructure)
