from functools import cached_property
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Doc QA Platform"
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"

    google_api_key: str = ""
    # openai_api_key: str = ""
    groq_api_key: str = ""

    # Defaults updated to Groq for chat, Gemini for embeddings
    primary_model: str = "groq:openai/gpt-oss-120b"
    embedding_model: str = "google_genai:gemini-embedding-001"

    @cached_property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

settings = Settings() 