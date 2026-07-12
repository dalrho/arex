"""Extract and canonicalize PDF remediation annotations for API responses."""
from __future__ import annotations

import hashlib
import re
import uuid
from typing import Any, Dict, List


_SECTION_RE = re.compile(
    r"Section:\s*(.*?)(?=\nOriginal Text:|\nProposed Text:|\nJustification:|\nRegulation Reference:|$)",
    re.DOTALL,
)
_ORIG_RE = re.compile(
    r"Original Text:\s*(.*?)(?=\nProposed Text:|\nJustification:|\nRegulation Reference:|$)",
    re.DOTALL,
)
_PROP_RE = re.compile(
    r"Proposed Text:\s*(.*?)(?=\nJustification:|\nRegulation Reference:|$)",
    re.DOTALL,
)
_JUST_RE = re.compile(
    r"Justification:\s*(.*?)(?=\nRegulation Reference:|$)",
    re.DOTALL,
)
_REG_RE = re.compile(r"Regulation Reference:\s*(.*)", re.DOTALL)


def parse_annotation_content(content: str) -> Dict[str, str]:
    section = "N/A"
    orig_text = ""
    proposed_text = ""
    justification = ""
    reg_ref = ""

    s_match = _SECTION_RE.search(content)
    o_match = _ORIG_RE.search(content)
    p_match = _PROP_RE.search(content)
    j_match = _JUST_RE.search(content)
    r_match = _REG_RE.search(content)

    if s_match:
        section = s_match.group(1).strip()
    if o_match:
        orig_text = o_match.group(1).strip()
    if p_match:
        proposed_text = p_match.group(1).strip()
    if j_match:
        justification = j_match.group(1).strip()
    if r_match:
        reg_ref = r_match.group(1).strip()

    return {
        "section": section,
        "original_text": orig_text,
        "proposed_text": proposed_text,
        "justification": justification,
        "regulation_reference": reg_ref,
    }


def annotation_fingerprint(
    title: str,
    section: str,
    original_text: str,
    proposed_text: str,
    justification: str,
    regulation_reference: str,
) -> str:
    payload = "\n".join(
        [
            title or "",
            section or "",
            original_text or "",
            proposed_text or "",
            justification or "",
            regulation_reference or "",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def stable_annotation_id(fingerprint: str) -> str:
    """Deterministic UUID from content fingerprint (for React keys / dedupe)."""
    return str(uuid.UUID(fingerprint[:32]))


def group_annotations(raw_annotations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Collapse duplicate remediation annotations that share the same recommendation
    payload into one item with merged pages[].
    """
    grouped: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    for annot in raw_annotations:
        title = annot.get("title") or "AI Remediation"
        section = annot.get("section") or "N/A"
        original_text = annot.get("original_text") or ""
        proposed_text = annot.get("proposed_text") or ""
        justification = annot.get("justification") or ""
        regulation_reference = annot.get("regulation_reference") or ""
        page = annot.get("page")
        fp = annotation_fingerprint(
            title, section, original_text, proposed_text, justification, regulation_reference
        )

        if fp not in grouped:
            order.append(fp)
            pages: List[int] = []
            if isinstance(page, int):
                pages.append(page)
            grouped[fp] = {
                "id": stable_annotation_id(fp),
                "page": page if isinstance(page, int) else (pages[0] if pages else 1),
                "pages": pages,
                "type": annot.get("type", "Highlight"),
                "title": title,
                "raw_content": annot.get("raw_content", ""),
                "section": section,
                "original_text": original_text,
                "proposed_text": proposed_text,
                "justification": justification,
                "regulation_reference": regulation_reference,
            }
        else:
            entry = grouped[fp]
            if isinstance(page, int) and page not in entry["pages"]:
                entry["pages"].append(page)
                entry["pages"].sort()
                entry["page"] = entry["pages"][0]

    return [grouped[fp] for fp in order]


def extract_annotations_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Read all PDF highlight annotations and return a canonical unique list."""
    import fitz

    raw: List[Dict[str, Any]] = []
    doc = fitz.open(file_path)
    try:
        for page_idx, page in enumerate(doc):
            annots = page.annots()
            if not annots:
                continue
            for annot in annots:
                info = annot.info
                content = info.get("content", "") or ""
                parsed = parse_annotation_content(content)
                raw.append(
                    {
                        "id": info.get("id") or None,
                        "page": page_idx + 1,
                        "type": annot.type[1],
                        "title": info.get("title", "AI Remediation"),
                        "raw_content": content,
                        **parsed,
                    }
                )
    finally:
        doc.close()

    return group_annotations(raw)
