from functools import lru_cache
from pathlib import Path
from langchain_chroma import Chroma
from langchain_core.embeddings import Embeddings
from langchain_core.documents import Document
from langchain.embeddings import init_embeddings

from app.core.config import settings
 
@lru_cache(maxsize=1)
def get_embedding_model() -> Embeddings:
    """
    Initialize the embedding model based on settings and cache it.
    """
    provider, _, model_name = settings.embedding_model.partition(":")
    if not provider or not model_name:
        raise ValueError(f"Invalid embedding model ID: {settings.embedding_model!r}. Use 'provider:model'.")

    kwargs = {}
    if provider in ["google_genai", "google-genai"]:
        kwargs["api_key"] = settings.google_api_key
    elif provider == "openai":
        kwargs["api_key"] = settings.openai_api_key

    return init_embeddings(model_name, provider=provider, **kwargs)

def create_vector_store(chunks: list[Document], collection_name: str = "doc_qa") -> Chroma:
    """
    Embeds the document chunks and stores them in a local Chroma database.
    """
    embeddings = get_embedding_model()
    persist_directory = Path("data/chroma_db")
    persist_directory.mkdir(parents=True, exist_ok=True)

    vector_store = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=str(persist_directory)
    )
    return vector_store

@lru_cache(maxsize=1)
def load_vector_store(collection_name: str = "doc_qa") -> Chroma:
    """
    Loads an existing Chroma database from disk and caches it.
    """
    embeddings = get_embedding_model()
    persist_directory = Path("data/chroma_db")
    
    return Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=str(persist_directory)
    ) 