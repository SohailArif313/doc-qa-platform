from functools import lru_cache
from langchain.chat_models import init_chat_model
from langchain_core.runnables import Runnable
from app.core.config import settings

def _build_model(model_id: str) -> Runnable:
    provider, _, model_name = model_id.partition(":")
    if not provider or not model_name:
        raise ValueError(f"Invalid model id: {model_id!r}. Use 'provider:model'.")

    # Keeping a 15-second timeout for safety
    kwargs: dict = {"temperature": 0, "timeout": 15.0,"max_tokens": 1000}

    if provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not set in .env")
        kwargs["api_key"] = settings.openai_api_key
    elif provider == "groq": 
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not set in .env")
        kwargs["api_key"] = settings.groq_api_key
    elif provider in ["google_genai", "google-genai"]:
        # ... baqi code same rahega
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY is not set in .env")
        kwargs["api_key"] = settings.google_api_key

    return init_chat_model(model_name, model_provider=provider, **kwargs)

@lru_cache(maxsize=1)
def get_chat_model() -> Runnable:
    return _build_model(settings.primary_model) 