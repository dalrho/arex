import fitz  # PyMuPDF
import logging

logger = logging.getLogger("arex.pdf-parser")

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts text from a PDF document using PyMuPDF (fitz).
    """
    try:
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        logger.error(f"Failed to parse PDF {file_path}: {e}")
        raise e
