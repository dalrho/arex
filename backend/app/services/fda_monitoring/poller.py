import hashlib
import time
import logging
import uuid
import httpx
from datetime import datetime, timezone
from html.parser import HTMLParser
from sqlalchemy.orm import Session

from app.models.regulation_update import RegulationUpdate
from app.services.change_detector.diff_engine import compute_content_diff
from app.services.fda_monitoring.source_config import (
    FDA_API_BASE_URL,
    FDA_API_AGENCIES,
    RATE_LIMIT_DELAY_SECONDS,
    MAX_RETRIES,
    BACKOFF_FACTOR
)

logger = logging.getLogger("sentinel-os.fda-poller")

class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []
    def handle_data(self, d):
        self.fed.append(d)
    def get_data(self):
        return ''.join(self.fed)

def strip_html_tags(html_content: str) -> str:
    s = HTMLStripper()
    s.feed(html_content)
    return s.get_data().strip()

def fetch_url_with_retry(url: str, params: dict = None) -> httpx.Response:
    retries = 0
    delay = RATE_LIMIT_DELAY_SECONDS
    while retries < MAX_RETRIES:
        try:
            # Respect rate limits
            time.sleep(RATE_LIMIT_DELAY_SECONDS)
            response = httpx.get(url, params=params, timeout=15.0)
            if response.status_code == 200:
                return response
            logger.warning(f"Failed to fetch {url}, status: {response.status_code}. Retrying...")
        except Exception as e:
            logger.warning(f"Error fetching {url}: {e}. Retrying...")
        
        retries += 1
        time.sleep(delay)
        delay *= BACKOFF_FACTOR
        
    raise httpx.HTTPError(f"Failed to fetch {url} after {MAX_RETRIES} attempts.")

def poll_fda_regulations(db: Session, limit: int = 10) -> int:
    """
    Polls Federal Register REST API for FDA guidance documents.
    Detects and ignores duplicates, runs content diff, and persists new updates.
    """
    logger.info("Starting automated FDA poller...")
    
    # 1. Fetch newest document list
    params = {
        "conditions[agencies][]": FDA_API_AGENCIES,
        "per_page": limit,
        "order": "newest"
    }
    
    try:
        response = fetch_url_with_retry(FDA_API_BASE_URL, params=params)
    except Exception as e:
        logger.error(f"Failed to poll Federal Register API: {e}")
        return 0
        
    data = response.json()
    results = data.get("results", [])
    new_records_count = 0
    
    for doc in results:
        html_url = doc.get("html_url")
        title = doc.get("title", "Untitled Document")
        pub_date_str = doc.get("publication_date")
        doc_num = doc.get("document_number")
        
        if not html_url or not doc_num:
            continue
            
        # Check if URL exists in DB
        existing_by_url = db.query(RegulationUpdate).filter(RegulationUpdate.source_url == html_url).first()
        if existing_by_url:
            logger.info(f"Document {doc_num} (URL {html_url}) already monitored. Skipping.")
            continue
            
        # 2. Fetch detailed document json
        detail_url = f"https://www.federalregister.gov/api/v1/documents/{doc_num}.json"
        try:
            detail_response = fetch_url_with_retry(detail_url)
            detail_data = detail_response.json()
        except Exception as e:
            logger.warning(f"Failed to fetch details for {doc_num}: {e}")
            continue
            
        body_html_url = detail_data.get("body_html_url")
        raw_content = ""
        
        if body_html_url:
            try:
                content_response = fetch_url_with_retry(body_html_url)
                # Clean html tags
                raw_content = strip_html_tags(content_response.text)
            except Exception as e:
                logger.warning(f"Failed to fetch html body from {body_html_url}: {e}")
                
        if not raw_content:
            # Fallback to abstract/excerpts if full body fetching failed
            raw_content = detail_data.get("abstract") or detail_data.get("excerpts") or title
            
        # Compute SHA-256 hash
        hash_val = hashlib.sha256(raw_content.encode("utf-8")).hexdigest()
        
        # Check for duplicates using hash checks
        existing_by_hash = db.query(RegulationUpdate).filter(RegulationUpdate.hash_value == hash_val).first()
        if existing_by_hash:
            logger.info(f"Document {doc_num} has duplicate content hash {hash_val}. Skipping.")
            continue
            
        # 3. Pass new documents to the diff engine to flag modified lines
        # Find the most recent regulation update to compare against
        prev_update = db.query(RegulationUpdate).order_by(RegulationUpdate.published_date.desc()).first()
        diff_data = None
        if prev_update:
            diff_data = compute_content_diff(prev_update.raw_content, raw_content)
        else:
            diff_data = {"added": [line for line in raw_content.splitlines() if line.strip()], "removed": []}
            
        # Parse sections (simple splitter mock matching regulations.py)
        parsed = {}
        lines = [line.strip() for line in raw_content.split(".") if len(line.strip()) > 10]
        for idx, line in enumerate(lines[:3]):
            parsed[f"section_1.{idx+1}"] = line + "."
            
        # Combine sections and diff in parsed_sections
        parsed_sections = {
            "sections": parsed,
            "diff": diff_data
        }
        
        # Parse published date
        if pub_date_str:
            try:
                published_date = datetime.strptime(pub_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                published_date = datetime.now(timezone.utc)
        else:
            published_date = datetime.now(timezone.utc)
            
        reg = RegulationUpdate(
            id=uuid.uuid4(),
            source_url=html_url,
            title=title,
            published_date=published_date,
            raw_content=raw_content,
            parsed_sections=parsed_sections,
            hash_value=hash_val,
            status="pending_analysis"
        )
        db.add(reg)
        db.commit()
        logger.info(f"Ingested new FDA regulation: {title} ({doc_num})")
        new_records_count += 1
        
    return new_records_count
