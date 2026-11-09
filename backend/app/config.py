from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Supabase configuration
    supabase_url: str
    supabase_key: str
    
    # Database configuration
    database_url: str

    # Worker and sandbox configuration
    redis_url: str
    workspace_root: str
    answer_timeout: int = 60  # Default timeout in seconds
   
    # API and model configuration
    api_key: str
    base_url: str
    model_id: str

    # Frontend redirect URLs
    frontend_redirect: str = "http://localhost:3000/auth/redirect"
    frontend_callback: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_file_encoding="utf-8",
    )


settings = Settings()