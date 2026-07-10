import uuid
import logging
from typing import List

from app.services.embeddings.embedding_service import embedding_service
from app.services.vector_db.qdrant_client import vector_db_client

logger = logging.getLogger("arex.kb-search-tool")

def search_knowledge_base(query: str, organization_id: uuid.UUID, limit: int = 5) -> List[str]:
    """
    Search Qdrant vector DB for document chunks relevant to the query.
    Used by the Remediation Agent to get specific SOP sections for context.
    """
    logger.info(f"Querying Knowledge Base: '{query[:60]}...'")
    try:
        query_vector = embedding_service.get_embedding(query)
        results = vector_db_client.search_chunks(
            query_vector=query_vector,
            organization_id=organization_id,
            limit=limit
        )
        
        # Extract and return the matched chunk texts
        chunks = [r["text"] for r in results]
        logger.info(f"KB Search returned {len(chunks)} relevant chunks.")
        return chunks
    except Exception as e:
        logger.error(f"Error searching knowledge base: {e}")
        return []
