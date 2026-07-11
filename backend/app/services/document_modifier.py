import os
import shutil
import difflib
import re
import fitz  # PyMuPDF
import docx
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

def find_section_number(lines, index):
    # Look back up to 30 lines to find nearest section header
    for idx in range(min(index, len(lines) - 1), max(-1, index - 30), -1):
        line = lines[idx].strip()
        # Match common section patterns like "1.2 ", "Section 2.1", "4.0.1"
        match = re.match(r'^((?:Section\s+)?\d+(?:\.\d+)*)', line, re.IGNORECASE)
        if match:
            return match.group(1)
    return None

def apply_remediation(
    original_file_path: str,
    new_file_path: str,
    proposed_text: str,
    diff_content: dict,
    justification: str = None,
    regulation_reference: str = None
) -> None:
    _, ext = os.path.splitext(original_file_path.lower())
    
    # Read original text for diff alignment
    original_text = ""
    if ext == ".txt":
        try:
            with open(original_file_path, "r", encoding="utf-8") as f:
                original_text = f.read()
        except Exception:
            pass
    elif ext == ".docx":
        try:
            doc = docx.Document(original_file_path)
            original_text = "\n".join([p.text for p in doc.paragraphs])
        except Exception:
            pass
    elif ext == ".pdf":
        try:
            pdf_doc = fitz.open(original_file_path)
            original_text = ""
            for page in pdf_doc:
                original_text += page.get_text()
            pdf_doc.close()
        except Exception:
            pass

    if not original_text:
        # Fallback to diff_content's current_content if original text read failed
        original_text = diff_content.get("current_content") or ""

    if ext == ".txt":
        with open(new_file_path, "w", encoding="utf-8") as f:
            f.write(proposed_text)
            
    elif ext == ".docx":
        try:
            # 1. Copy the original document to the destination first.
            # This guarantees we NEVER start with an empty document and preserve all headers, footers, logos, tables, layout.
            shutil.copy(original_file_path, new_file_path)
            
            # 2. Open the copied file to perform in-place replacement
            doc = docx.Document(new_file_path)
            
            orig_paras = [p.text for p in doc.paragraphs]
            prop_paras = proposed_text.splitlines()
            
            # Align original paragraphs with proposed paragraphs using SequenceMatcher
            sm = difflib.SequenceMatcher(None, orig_paras, prop_paras)
            opcodes = sm.get_opcodes()
            
            # Apply edits in reverse order to prevent index shifting issues
            for tag, i1, i2, j1, j2 in reversed(opcodes):
                if tag == 'equal':
                    continue
                elif tag == 'replace':
                    num_orig = i2 - i1
                    num_prop = j2 - j1
                    for k in range(min(num_orig, num_prop)):
                        doc.paragraphs[i1 + k].text = prop_paras[j1 + k]
                    
                    if num_orig < num_prop:
                        # Insert remaining proposed paragraphs in-place
                        ref_para = doc.paragraphs[i2] if i2 < len(doc.paragraphs) else None
                        for k in range(num_orig, num_prop):
                            val = prop_paras[j1 + k]
                            if ref_para:
                                ref_para.insert_paragraph_before(val)
                            else:
                                doc.add_paragraph(val)
                    elif num_orig > num_prop:
                        # Remove extra original paragraphs in reverse to prevent shifting
                        for k in reversed(range(num_prop, num_orig)):
                            p = doc.paragraphs[i1 + k]
                            p_element = p._element
                            p_element.getparent().remove(p_element)
                            
                elif tag == 'delete':
                    # Delete extra paragraphs in reverse to prevent index shifting
                    for idx in reversed(range(i1, i2)):
                        p = doc.paragraphs[idx]
                        p_element = p._element
                        p_element.getparent().remove(p_element)
                        
                elif tag == 'insert':
                    ref_para = doc.paragraphs[i1] if i1 < len(doc.paragraphs) else None
                    for idx in range(j1, j2):
                        val = prop_paras[idx]
                        if ref_para:
                            ref_para.insert_paragraph_before(val)
                        else:
                            doc.add_paragraph(val)
                            
            doc.save(new_file_path)
        except Exception as e:
            # Fallback: if in-place editing crashes for any reason, we already copied the original file
            # to new_file_path, so formatting is preserved. We do NOT overwrite it with a blank document.
            print(f"Error during DOCX template editing: {e}")
            
    elif ext == ".pdf":
        try:
            # For PDF, do NOT modify the document text. Instead, generate an annotated review PDF.
            # Open the original PDF as read-only template
            doc = fitz.open(original_file_path)
            
            original_lines = original_text.splitlines()
            proposed_lines = proposed_text.splitlines()
            
            sm = difflib.SequenceMatcher(None, original_lines, proposed_lines)
            opcodes = sm.get_opcodes()
            
            for tag, i1, i2, j1, j2 in opcodes:
                if tag == 'equal':
                    continue
                    
                rem_lines = [line.strip() for line in original_lines[i1:i2] if line.strip()]
                add_text = "\n".join(proposed_lines[j1:j2]).strip()
                
                # Extract section number from original lines
                section_num = find_section_number(original_lines, i1)
                
                # Format annotation contents
                orig_text_block = "\n".join(rem_lines) if rem_lines else "N/A (Insertion)"
                annot_content = (
                    f"Section: {section_num if section_num else 'N/A'}\n"
                    f"Original Text: {orig_text_block}\n"
                    f"Proposed Text: {add_text if add_text else 'N/A (Deletion)'}\n"
                    f"Justification: {justification if justification else 'AI Compliance Recommendation'}\n"
                    f"Regulation Reference: {regulation_reference if regulation_reference else 'FDA Regulation'}"
                )
                
                if tag == 'insert':
                    # Pure insertion: find the preceding line as anchor
                    anchor_idx = i1 - 1
                    anchor_line = None
                    while anchor_idx >= 0:
                        if original_lines[anchor_idx].strip():
                            anchor_line = original_lines[anchor_idx].strip()
                            break
                        anchor_idx -= 1
                        
                    if anchor_line:
                        for page in doc:
                            rects = page.search_for(anchor_line)
                            if rects:
                                rect = rects[0]
                                annot = page.add_highlight_annot(rect)
                                annot.set_colors(stroke=(0.2, 0.8, 0.2))  # green highlight for insertion anchor
                                annot.set_info(title="AI Remediation - Insertion Suggestion", content=annot_content)
                                annot.update()
                                break
                    continue
                
                # Try to locate rem_lines on any page
                for page in doc:
                    rects = []
                    for line in rem_lines:
                        # Approximate matching helper
                        line_rects = page.search_for(line)
                        if not line_rects and len(line) > 30:
                            line_rects = page.search_for(line[:30])
                        if not line_rects and len(line) > 15:
                            line_rects = page.search_for(line[5:25])
                        if line_rects:
                            rects.extend(line_rects)
                            
                    if rects:
                        # Highlight the affected text blocks
                        for r in rects:
                            annot = page.add_highlight_annot(r)
                            if tag == 'delete':
                                annot.set_colors(stroke=(0.9, 0.2, 0.2))  # red highlight for deletion
                                title = "AI Remediation - Deletion Suggestion"
                            else:
                                annot.set_colors(stroke=(1.0, 0.9, 0.0))  # yellow highlight for replacement
                                title = "AI Remediation - Replacement Suggestion"
                            annot.set_info(title=title, content=annot_content)
                            annot.update()
                        break
                        
            doc.save(new_file_path, incremental=False, encryption=fitz.PDF_ENCRYPT_KEEP)
            doc.close()
        except Exception as e:
            # Fallback: copy original if anything fails
            print(f"Error during PDF annotation: {e}")
            try:
                shutil.copy(original_file_path, new_file_path)
            except Exception:
                pass
    else:
        # Save other files directly
        with open(new_file_path, "w", encoding="utf-8") as f:
            f.write(proposed_text)
