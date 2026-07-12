import hashlib
import re
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

logger = logging.getLogger("arex.fda-poller")


class _BodyTextExtractor(HTMLParser):
    """
    Extracts visible body text from an HTML document, skipping
    <script>, <style>, <head>, and <nav> blocks entirely.
    """
    _SKIP_TAGS = {"script", "style", "head", "nav", "noscript", "footer", "header"}

    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if tag.lower() in self._SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str):
        if tag.lower() in self._SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str):
        if self._skip_depth == 0:
            stripped = data.strip()
            if stripped:
                self._chunks.append(stripped)

    def get_text(self) -> str:
        raw = " ".join(self._chunks)
        # Collapse multiple spaces / newlines
        return re.sub(r"\s{2,}", " ", raw).strip()


def extract_body_text(html: str) -> str:
    parser = _BodyTextExtractor()
    parser.feed(html)
    return parser.get_text()


def fetch_url_with_retry(url: str, params=None) -> httpx.Response:
    retries = 0
    delay = RATE_LIMIT_DELAY_SECONDS
    while retries < MAX_RETRIES:
        try:
            time.sleep(RATE_LIMIT_DELAY_SECONDS)
            response = httpx.get(url, params=params, timeout=20.0, follow_redirects=True)
            if response.status_code == 200:
                return response
            logger.warning(f"Failed to fetch {url}, status: {response.status_code}. Retrying...")
        except Exception as e:
            logger.warning(f"Error fetching {url}: {e}. Retrying...")

        retries += 1
        time.sleep(delay)
        delay *= BACKOFF_FACTOR

    raise httpx.HTTPError(f"Failed to fetch {url} after {MAX_RETRIES} attempts.")


def _fetch_regulation_text(detail_data: dict, doc_num: str) -> str:
    """
    Pull the best available plain-text content for a Federal Register document.
    Priority:
      1. raw_text_url  — plain-text version served by Federal Register
      2. body_html_url — full HTML body (script/style stripped)
      3. abstract / excerpts from the detail JSON
    """
    # 1. raw_text_url — GPO serves this as <html><body><pre>...</pre></body></html>
    #    so we must strip the HTML wrapper before storing.
    raw_text_url = detail_data.get("raw_text_url")
    if raw_text_url:
        try:
            r = fetch_url_with_retry(raw_text_url)
            # Always strip HTML — GPO wraps plain text in html/body/pre tags
            text = extract_body_text(r.text)
            # Remove the [Page XXXXX] markers and excessive whitespace
            text = re.sub(r"\[\[Page \d+\]\]", "", text)
            text = re.sub(r"\s{3,}", "\n\n", text).strip()
            if len(text) > 200:
                logger.info(f"[{doc_num}] Content from raw_text_url ({len(text)} chars)")
                return text
        except Exception as e:
            logger.warning(f"[{doc_num}] raw_text_url failed: {e}")

    # 2. HTML body with script/style-skipping parser
    body_html_url = detail_data.get("body_html_url")
    if body_html_url:
        try:
            r = fetch_url_with_retry(body_html_url)
            text = extract_body_text(r.text)
            if len(text) > 200:
                logger.info(f"[{doc_num}] Content from body_html_url ({len(text)} chars)")
                return text
        except Exception as e:
            logger.warning(f"[{doc_num}] body_html_url failed: {e}")

    # 3. Abstract / excerpts from JSON
    abstract = detail_data.get("abstract") or detail_data.get("excerpts") or ""
    if abstract:
        logger.info(f"[{doc_num}] Using abstract/excerpts ({len(abstract)} chars)")
        return abstract.strip()

    return ""


def poll_fda_regulations(db: Session, limit: int = 10) -> int:
    """
    Polls the Federal Register REST API for the latest FDA documents.
    Fetches full regulation text in real-time, deduplicates, diffs, and persists.
    """
    logger.info("Starting real-time FDA regulation poll from federalregister.gov...")

    params = {
        "conditions[agencies][]": FDA_API_AGENCIES,
        "per_page": limit,
        "order": "newest",
        "fields[]": [
            "document_number", "title", "publication_date",
            "html_url", "raw_text_url", "body_html_url",
            "abstract", "excerpts", "type"
        ],
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

        # Skip if already in DB by URL
        if db.query(RegulationUpdate).filter(RegulationUpdate.source_url == html_url).first():
            logger.info(f"Document {doc_num} already exists. Skipping.")
            continue

        # Fetch the detailed JSON to get content URLs
        detail_url = f"https://www.federalregister.gov/api/v1/documents/{doc_num}.json"
        try:
            detail_resp = fetch_url_with_retry(detail_url)
            detail_data = detail_resp.json()
        except Exception as e:
            logger.warning(f"Failed to fetch details for {doc_num}: {e}")
            continue

        # Merge top-level list fields into detail_data for fallback
        for field in ("raw_text_url", "body_html_url", "abstract", "excerpts"):
            if field not in detail_data and doc.get(field):
                detail_data[field] = doc[field]

        # Fetch actual regulation content in real-time
        raw_content = _fetch_regulation_text(detail_data, doc_num)
        if not raw_content:
            raw_content = title  # last resort

        # Deduplicate by content hash
        hash_val = hashlib.sha256(raw_content.encode("utf-8")).hexdigest()
        if db.query(RegulationUpdate).filter(RegulationUpdate.hash_value == hash_val).first():
            logger.info(f"Duplicate content for {doc_num}. Skipping.")
            continue

        # Compute diff against most recent existing regulation
        prev = db.query(RegulationUpdate).order_by(RegulationUpdate.published_date.desc()).first()
        if prev:
            diff_data = compute_content_diff(prev.raw_content, raw_content)
        else:
            diff_data = {"added": [l for l in raw_content.splitlines() if l.strip()], "removed": []}

        # Index first few sentences as sections
        parsed: dict = {}
        sentences = [s.strip() for s in raw_content.split(".") if len(s.strip()) > 20]
        for idx, sent in enumerate(sentences[:5]):
            parsed[f"section_1.{idx + 1}"] = sent + "."

        parsed_sections = {"sections": parsed, "diff": diff_data}

        # Parse published date
        try:
            published_date = (
                datetime.strptime(pub_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if pub_date_str
                else datetime.now(timezone.utc)
            )
        except ValueError:
            published_date = datetime.now(timezone.utc)

        summary = detail_data.get("abstract") or detail_data.get("excerpts") or doc.get("abstract") or doc.get("excerpts") or ""
        if isinstance(summary, str):
            summary = summary.strip()
        else:
            summary = ""

        reg = RegulationUpdate(
            id=uuid.uuid4(),
            source_url=html_url,
            title=title,
            published_date=published_date,
            raw_content=raw_content,
            parsed_sections=parsed_sections,
            hash_value=hash_val,
            status="pending_analysis",
            summary=summary if summary else None,
        )
        db.add(reg)
        db.commit()
        logger.info(f"Ingested: {title[:80]} ({doc_num})")
        new_records_count += 1

    logger.info(f"FDA poll complete. {new_records_count} new regulation(s) ingested.")
    return new_records_count
