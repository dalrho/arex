import logging
import uuid
from qdrant_client import QdrantClient as RealQdrantClient
from qdrant_client.http import models as qdrant_models
from app.core.config import settings

logger = logging.getLogger("arex.vector-db")

class VectorDBClient:
    def __init__(self):
        # We try to use the configured URL. 
        # Fallback to localhost if connecting from host context in scripts.
        self.url = settings.QDRANT_URL
        self.client = RealQdrantClient(url=self.url)
        self._initialized_collections = set()

    @property
    def collection_name(self) -> str:
        mode = settings.AI_MODE.strip().lower()
        if mode == "developer":
            return "documents_gemini"
        elif mode == "hackathon":
            return "documents_fireworks"
        return "arex_docs"

    def _ensure_collection(self) -> None:
        col = self.collection_name
        if col not in self._initialized_collections:
            self.init_collection(force_recreate=False)
            self._initialized_collections.add(col)

    def init_collection(self, force_recreate: bool = False) -> None:
        """
        Ensures the vector collection exists in Qdrant.
        When force_recreate=True the existing collection is dropped first,
        clearing all stored embeddings (used by the admin data reset).
        """
        try:
            collections = self.client.get_collections()
            exist = any(c.name == self.collection_name for c in collections.collections)
            if exist:
                try:
                    col_info = self.client.get_collection(self.collection_name)
                    # Retrieve the vector configuration size to detect dimension mismatch
                    vectors_config = col_info.config.params.vectors
                    current_size = getattr(vectors_config, "size", None)
                    if current_size is None and isinstance(vectors_config, dict):
                        current_size = vectors_config.get("size")
                    if current_size != 768:
                        logger.warning(f"Existing collection size is {current_size}, expected 768. Forcing recreation.")
                        force_recreate = True
                except Exception as check_err:
                    logger.warning(f"Could not verify existing Qdrant collection size: {check_err}. Recreating.")
                    force_recreate = True

            if exist and force_recreate:
                logger.warning(f"Dropping Qdrant collection '{self.collection_name}' for reset/recreation.")
                self.client.delete_collection(collection_name=self.collection_name)
                exist = False
            if not exist:
                logger.info(f"Creating Qdrant collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qdrant_models.VectorParams(
                        size=768,  # Unified embedding size (text-embedding-004 / truncated gemini-embedding-001)
                        distance=qdrant_models.Distance.COSINE
                    )
                )
            else:
                logger.info(f"Qdrant collection '{self.collection_name}' already exists and matches expected dimensions (768).")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant collection: {e}")
            raise e

    def upsert_chunks(self, document_id: uuid.UUID, organization_id: uuid.UUID, chunks: list[dict]) -> None:
        """
        Upserts document chunks into Qdrant.
        chunks: list of dicts: [{"text": str, "vector": list[float], "chunk_index": int}]
        """
        self._ensure_collection()
        try:
            points = []
            for chunk in chunks:
                point_id = str(uuid.uuid4())
                points.append(
                    qdrant_models.PointStruct(
                        id=point_id,
                        vector=chunk["vector"],
                        payload={
                            "document_id": str(document_id),
                            "organization_id": str(organization_id),
                            "chunk_index": chunk["chunk_index"],
                            "text": chunk["text"]
                        }
                    )
                )
            self.client.upsert(collection_name=self.collection_name, points=points)
            logger.info(f"Successfully upserted {len(chunks)} chunks for document {document_id}")
        except Exception as e:
            logger.error(f"Failed to upsert chunks to Qdrant: {e}")
            raise e

    def search_chunks(self, query_vector: list[float], organization_id: uuid.UUID, limit: int = 5) -> list[dict]:
        """
        Searches for semantically similar chunks belonging to the given organization.
        """
        self._ensure_collection()
        try:
            # Enforce organization isolation using payload filtering
            query_filter = qdrant_models.Filter(
                must=[
                    qdrant_models.FieldCondition(
                        key="organization_id",
                        match=qdrant_models.MatchValue(value=str(organization_id))
                    )
                ]
            )

            response = self.client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=query_filter,
                limit=limit
            )

            return [
                {
                    "document_id": r.payload["document_id"],
                    "organization_id": r.payload["organization_id"],
                    "chunk_index": r.payload["chunk_index"],
                    "text": r.payload["text"],
                    "score": r.score
                }
                for r in response.points
            ]
        except Exception as e:
            logger.error(f"Failed to search Qdrant chunks: {e}")
            return []

    def delete_document_chunks(self, document_id: uuid.UUID) -> None:
        """
        Deletes all vector points associated with a specific document.
        """
        self._ensure_collection()
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qdrant_models.FilterSelector(
                    filter=qdrant_models.Filter(
                        must=[
                            qdrant_models.FieldCondition(
                                key="document_id",
                                match=qdrant_models.MatchValue(value=str(document_id))
                            )
                        ]
                    )
                )
            )
            logger.info(f"Deleted chunks for document {document_id} from Qdrant.")
        except Exception as e:
            logger.error(f"Failed to delete document chunks from Qdrant: {e}")
            raise e

vector_db_client = VectorDBClient()
