from typing import Annotated

from fastapi import Depends
from supabase import Client, create_client

from .config import Settings, get_settings


def get_supabase_client(settings: Annotated[Settings, Depends(get_settings)]) -> Client:
  return create_client(settings.supabase_url, settings.supabase_service_key)


SupabaseClientDep = Annotated[Client, Depends(get_supabase_client)]

