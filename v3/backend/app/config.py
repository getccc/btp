from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://signal:signal_pass@localhost:5432/signal_platform"
    REDIS_URL: str = "redis://localhost:6379/0"
    DEEPSEEK_API_KEY: str = ""
    TG_API_ID: int = 0
    TG_API_HASH: str = ""
    TG_PHONE: str = ""
    TG_BOT_TOKEN: str = ""
    TG_OWNER_CHAT_ID: str = ""
    X_ACCOUNTS: str = "[]"
    BSC_API_KEYS: str = "[]"
    SOLANA_API_KEYS: str = "[]"
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
