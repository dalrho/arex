import logging
import hashlib
import random
from typing import List

from app.core.config import settings

logger = logging.getLogger("arex.embedding-service")

# Gemini embedding dimension for text-embedding-004
GEMINI_EMBEDDING_DIM = 768
MOCK_EMBEDDING_DIM = 1024


class EmbeddingService:
    def __init__(self):
        self.settings = settings

    def is_offline_mode(self) -> bool:
        """Returns True when offline mock embeddings should be used."""
        if not self.settings.is_online_mode:
            return True
        if not self.settings.effective_gemini_key:
            return True
        return False

    def get_embedding(self, text: str) -> List[float]:
        return self.get_embeddings([text])[0]

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Returns embeddings for a list of texts.
        Online Mode  → Google text-embedding-004 via generativeai SDK
        Offline Mode → Deterministic mock embeddings (keyword-biased)
        """
        if self.is_offline_mode():
            logger.warning(
                "[EmbeddingService] Offline mode: returning deterministic mock embeddings."
            )
            return [self._generate_mock_embedding(text) for text in texts]

        logger.info(
            f"[EmbeddingService] Online mode: fetching real embeddings for "
            f"{len(texts)} text(s) via {self.settings.GEMINI_EMBEDDING_MODEL}."
        )
        try:
            return self._call_gemini_embeddings(texts)
        except Exception as e:
            if not self.is_offline_mode():
                logger.error(
                    f"[EmbeddingService] Gemini embedding call failed: {e}."
                )
                raise e
            logger.error(
                f"[EmbeddingService] Gemini embedding call failed: {e}. "
                "Falling back to mock embeddings."
            )
            return [self._generate_mock_embedding(text) for text in texts]

    def _call_gemini_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Calls Google Gemini text-embedding-004 via the google.genai SDK."""
        try:
            from google import genai  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "google-genai is not installed. Run: pip install google-genai"
            ) from exc

        client = genai.Client(api_key=self.settings.effective_gemini_key)
        model = self.settings.GEMINI_EMBEDDING_MODEL

        embeddings = []
        for text in texts:
            response = client.models.embed_content(
                model=model,
                contents=text,
            )
            # The new SDK returns response.embeddings (list of ContentEmbedding)
            embedding_values = response.embeddings[0].values
            embeddings.append(embedding_values)
            logger.debug(
                f"[EmbeddingService] Embedded {len(text)} chars → "
                f"{len(embedding_values)}d vector."
            )

        logger.info(
            f"[EmbeddingService] Successfully embedded {len(texts)} text(s) "
            f"using {model}."
        )
        return embeddings

    def _generate_mock_embedding(self, text: str) -> List[float]:
        """
        Generates a deterministic mock embedding of 1024 floats based on text hash.
        Keyword-biased to enable realistic semantic similarity for demos.
        """
        h = hashlib.sha256(text.encode("utf-8")).digest()
        rng = random.Random(h)
        embedding = [rng.uniform(-0.001, 0.001) for _ in range(MOCK_EMBEDDING_DIM)]

        keywords_biases = {
            "password": 0,
            "timeout": 1,
            "lockout": 2,
            "access control": 3,
            "signature": 4,
            "electronic record": 5,
            "audit trail": 6,
            "log": 7,
            "version": 8,
            "archive": 9,
            "approval": 10,
            "sop": 11,
        }

        normalized_text = text.lower()
        for keyword, dim in keywords_biases.items():
            if keyword in normalized_text:
                embedding[dim] += 1.0
                break

        magnitude = sum(x * x for x in embedding) ** 0.5
        if magnitude > 0:
            embedding = [x / magnitude for x in embedding]

        return embedding


embedding_service = EmbeddingService()
