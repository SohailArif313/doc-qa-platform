from functools import lru_cache
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain.embeddings import init_embeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient

from app.core.config import settings

import time
import random
from functools import lru_cache
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain.embeddings import init_embeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

from app.core.config import settings

# --- RETRY WRAPPER ---
class RetryEmbeddings(Embeddings):
    """
    Wraps another Embeddings object and retries on 429/5xx errors
    with exponential backoff.
    """
    def __init__(self, base_embeddings: Embeddings, max_retries: int = 3):
        self.base = base_embeddings
        self.max_retries = max_retries

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._embed_with_retry(self.base.embed_documents, texts)

    def embed_query(self, text: str) -> list[float]:
        return self._embed_with_retry(self.base.embed_query, text)

    def _embed_with_retry(self, func, *args):
        for attempt in range(self.max_retries):
            try:
                return func(*args)
            except Exception as e:
                error_str = str(e).lower()
                # Check if it's a rate limit or server error
                if "429" in error_str or "resource exhausted" in error_str or "500" in error_str or "503" in error_str:
                    if attempt == self.max_retries - 1:
                        raise e
                    # Exponential backoff: 1s, 2s, 4s, 8s... + jitter
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    print(f"⚠️ Rate limit hit. Retrying in {wait_time:.1f}s... (Attempt {attempt + 1}/{self.max_retries})")
                    time.sleep(wait_time)
                else:
                    raise e # Don't retry for non-rate-limit errors (e.g. invalid API key)
        raise RuntimeError("Max retries exceeded")

@lru_cache(maxsize=1)
def get_embedding_model() -> Embeddings:
    """
    Initialize the embedding model with retry logic.
    """
    provider, _, model_name = settings.embedding_model.partition(":")
    if not provider or not model_name:
        raise ValueError(f"Invalid embedding model ID: {settings.embedding_model!r}.")

    kwargs = {}
    if provider in ["google_genai", "google-genai"]:
        kwargs["api_key"] = settings.google_api_key
    elif provider == "openai":
        kwargs["api_key"] = settings.openai_api_key

    base_model = init_embeddings(model_name, provider=provider, **kwargs)
    
    # Wrap it with retry logic
    return RetryEmbeddings(base_model, max_retries=5)

@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClient:
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        timeout=60.0,
    )


def get_collection_name(user_id: str) -> str:
    # Clean user_id to make a valid collection name
    # e.g., "user_2aBc3..." -> "user_2abc3"
    safe_id = "".join(c for c in user_id if c.isalnum() or c == "_").lower()
    return f"doc_qa_{safe_id}"

def collection_exists(user_id: str) -> bool:
    client = get_qdrant_client()
    collection_name = get_collection_name(user_id)
    # Check if the collection is present in Qdrant
    return client.collection_exists(collection_name)

def create_vector_store(chunks: list[Document], user_id: str) -> QdrantVectorStore:
    """
    Embeds the document chunks and stores them in Qdrant Cloud.
    """
    embeddings = get_embedding_model()
    collection_name = get_collection_name(user_id)

    vector_store = QdrantVectorStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        collection_name=collection_name,
        force_recreate=True, # For now, we overwrite the collection on new upload 
    )
    return vector_store


def load_vector_store(user_id: str) -> QdrantVectorStore:
    """
    Loads the existing Qdrant database from the cloud.
    """
    embeddings = get_embedding_model()
    collection_name = get_collection_name(user_id)
    
    return QdrantVectorStore(
        client=get_qdrant_client(),
        collection_name=collection_name,
        embedding=embeddings,
    )