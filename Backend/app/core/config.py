import os

class Settings:
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-me")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
    # आप चाहें तो और variables डाल सकते हैं, पर `pydantic_settings` का use न करें
    # अगर `pydantic_settings` का use करना ही है तो `extra="allow"` दें

settings = Settings()