import logging
from app.core.dependencies import SessionLocal
from app.services.fda_monitoring.poller import poll_fda_regulations

logger = logging.getLogger("arex.monitoring-job")

def run_monitoring_job(limit: int = 10) -> int:
    """
    Task wrapper run by scheduled cron jobs/workers to fetch FDA updates.
    """
    logger.info("Executing scheduled FDA monitoring job...")
    db = SessionLocal()
    try:
        new_count = poll_fda_regulations(db, limit=limit)
        logger.info(f"FDA monitoring job complete. Ingested {new_count} new regulations.")
        return new_count
    except Exception as e:
        logger.error(f"Error running monitoring job: {e}")
        return 0
    finally:
        db.close()
