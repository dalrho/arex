"""Unit tests for PDF annotation extraction and duplicate grouping."""
from app.services.document_annotations import (
    group_annotations,
    parse_annotation_content,
    annotation_fingerprint,
    stable_annotation_id,
)


def test_parse_annotation_content():
    content = (
        "Section: 4.2\n"
        "Original Text: old wording\n"
        "Proposed Text: new wording\n"
        "Justification: Align with regulation\n"
        "Regulation Reference: 21 CFR 820"
    )
    parsed = parse_annotation_content(content)
    assert parsed["section"] == "4.2"
    assert parsed["original_text"] == "old wording"
    assert parsed["proposed_text"] == "new wording"
    assert parsed["justification"] == "Align with regulation"
    assert parsed["regulation_reference"] == "21 CFR 820"


def test_group_annotations_merges_duplicate_payloads_across_pages():
    shared = {
        "type": "Highlight",
        "title": "AI Remediation - Replacement Suggestion",
        "raw_content": "Section: 1.0\nOriginal Text: A\nProposed Text: B\nJustification: J\nRegulation Reference: R",
        "section": "1.0",
        "original_text": "A",
        "proposed_text": "B",
        "justification": "J",
        "regulation_reference": "R",
    }
    raw = [
        {**shared, "id": "x1", "page": 12},
        {**shared, "id": "x2", "page": 12},  # same page duplicate rect
        {**shared, "id": "x3", "page": 18},
        {**shared, "id": "x4", "page": 22},
        {
            **shared,
            "id": "other",
            "page": 5,
            "original_text": "Different original",
            "proposed_text": "Different proposed",
            "raw_content": "other",
        },
    ]

    grouped = group_annotations(raw)
    assert len(grouped) == 2

    capa = next(g for g in grouped if g["original_text"] == "A")
    assert capa["pages"] == [12, 18, 22]
    assert capa["page"] == 12
    assert capa["id"] == stable_annotation_id(
        annotation_fingerprint(
            shared["title"],
            shared["section"],
            "A",
            "B",
            "J",
            "R",
        )
    )

    other = next(g for g in grouped if g["original_text"] == "Different original")
    assert other["pages"] == [5]
    assert other["page"] == 5


def test_group_annotations_preserves_order_of_first_occurrence():
    raw = [
        {
            "page": 1,
            "type": "Highlight",
            "title": "AI Remediation - Replacement Suggestion",
            "raw_content": "",
            "section": "1",
            "original_text": "first",
            "proposed_text": "first-new",
            "justification": "j",
            "regulation_reference": "r",
        },
        {
            "page": 2,
            "type": "Highlight",
            "title": "AI Remediation - Deletion Suggestion",
            "raw_content": "",
            "section": "2",
            "original_text": "second",
            "proposed_text": "N/A (Deletion)",
            "justification": "j",
            "regulation_reference": "r",
        },
    ]
    grouped = group_annotations(raw)
    assert [g["original_text"] for g in grouped] == ["first", "second"]
