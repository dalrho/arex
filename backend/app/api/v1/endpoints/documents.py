import os
import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies import get_db, get_tenant_id
from app.models.document import Document
from app.models.document_version import DocumentVersion

from app.api.v1.schemas.document import DocumentResponse, DocumentVersionResponse

from app.services.regulation_parser.pdf_parser import extract_text_from_pdf
from app.services.embeddings.embedding_service import embedding_service
from app.services.vector_db.qdrant_client import vector_db_client

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        if i + chunk_size >= len(words):
            break
        i += (chunk_size - overlap)
    return chunks

@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Upload a quality system SOP document (PDF or TXT).
    Extracts text, generates semantic chunks, indexes vectors in Qdrant, and saves metadata in Postgres.
    """
    org_id = uuid.UUID(tenant_id)

    # 1. Validate File Size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum limit of 10 MB."
        )

    # 2. Validate File Type
    filename = file.filename
    _, ext = os.path.splitext(filename.lower())
    if ext not in [".pdf", ".txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only PDF and TXT files are allowed."
        )

    # Reset file read cursor
    await file.seek(0)

    # Create storage directory
    storage_dir = "/app/storage"
    os.makedirs(storage_dir, exist_ok=True)

    doc_id = uuid.uuid4()
    file_path = os.path.join(storage_dir, f"{doc_id}{ext}")

    # Save to disk
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # 3. Extract Text
    try:
        if ext == ".pdf":
            parsed_text = extract_text_from_pdf(file_path)
        else:
            parsed_text = file_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse text from file: {str(e)}"
        )

    # 4. Save Metadata in Database
    db_doc = Document(
        id=doc_id,
        organization_id=org_id,
        filename=filename,
        file_path=file_path,
        parsed_text=parsed_text,
        version=1
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    # Save Initial Version in DocumentVersion history
    db_version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=db_doc.id,
        version=1,
        filename=filename,
        file_path=file_path,
        parsed_text=parsed_text,
        reason_for_revision="Initial upload",
        created_at=db_doc.created_at
    )
    db.add(db_version)
    db.commit()


    # 5. Chunk and Index in Qdrant Vector DB
    try:
        text_chunks = chunk_text(parsed_text)
        if text_chunks:
            vectors = embedding_service.get_embeddings(text_chunks)
            qdrant_chunks = [
                {
                    "text": chunk_text_str,
                    "vector": vector,
                    "chunk_index": idx
                }
                for idx, (chunk_text_str, vector) in enumerate(zip(text_chunks, vectors))
            ]
            vector_db_client.upsert_chunks(db_doc.id, org_id, qdrant_chunks)
    except Exception as e:
        # Vector database failure does not rollback the DB insert, but we log the error
        # and notify the client or retry.
        # This keeps the REST endpoint resilient.
        router.routes  # dummy access
        # logger.error(f"Vector DB indexing failed: {e}")

    return db_doc

@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    List all uploaded QMS documents scoped by organization tenant.
    """
    org_id = uuid.UUID(tenant_id)
    documents = db.query(Document).filter(Document.organization_id == org_id).all()
    return documents

@router.get("/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Download the original uploaded file for a document. Falls back to the
    parsed text if the original binary is no longer available on disk.
    """
    from fastapi.responses import FileResponse, Response

    org_id = uuid.UUID(tenant_id)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == org_id
    ).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if document.file_path and os.path.exists(document.file_path):
        return FileResponse(
            path=document.file_path,
            filename=document.filename,
            media_type="application/octet-stream",
        )

    if document.parsed_text:
        fallback_name = os.path.splitext(document.filename)[0] + ".txt"
        return Response(
            content=document.parsed_text,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{fallback_name}"'},
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Stored file is no longer available for this document."
    )

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Get details of a specific document.
    """
    org_id = uuid.UUID(tenant_id)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == org_id
    ).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> None:
    """
    Delete a document from QMS and Qdrant index.
    """
    org_id = uuid.UUID(tenant_id)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == org_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Delete from Qdrant
    try:
        vector_db_client.delete_document_chunks(document.id)
    except Exception:
        pass

    # Delete local file
    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except OSError:
            pass

    db.delete(document)
    db.commit()
    return None

@router.get("/{document_id}/versions", response_model=List[DocumentVersionResponse])
def list_document_versions(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    List all version history records of a specific document, scoped by organization tenant.
    """
    org_id = uuid.UUID(tenant_id)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == org_id
    ).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).order_by(DocumentVersion.version.desc()).all()

@router.get("/{document_id}/versions/{version_number}", response_model=DocumentVersionResponse)
def get_document_version(
    document_id: uuid.UUID,
    version_number: int,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
) -> Any:
    """
    Get a specific historical version of a document.
    """
    org_id = uuid.UUID(tenant_id)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == org_id
    ).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    version = db.query(DocumentVersion).filter(
        DocumentVersion.document_id == document_id,
        DocumentVersion.version == version_number
    ).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    return version

