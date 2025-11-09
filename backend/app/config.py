from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  """Application configuration loaded from environment variables."""

  model_config = SettingsConfigDict(
    env_file='.env',
    env_file_encoding='utf-8',
    case_sensitive=False,
  )

  supabase_url: str = Field(..., validation_alias='SUPABASE_URL')
  supabase_service_key: str = Field(..., validation_alias='SUPABASE_SERVICE_KEY')
  cors_allow_origins: str = Field(
    default='http://localhost:5173',
    validation_alias='CORS_ALLOW_ORIGINS',
  )

  @field_validator('cors_allow_origins', mode='after')
  @classmethod
  def parse_cors_origins(cls, v):
    if isinstance(v, str):
      return [origin.strip() for origin in v.split(',') if origin.strip()]
    if isinstance(v, list):
      return v
    return ['http://localhost:5173']

  @property
  def cors_origins_list(self) -> List[str]:
    if isinstance(self.cors_allow_origins, list):
      return self.cors_allow_origins
    return [origin.strip() for origin in str(self.cors_allow_origins).split(',') if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
  return Settings()


