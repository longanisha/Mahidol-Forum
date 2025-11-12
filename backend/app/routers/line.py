from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import AuthenticatedUser, get_current_user
from ..dependencies import SupabaseClientDep
from ..schemas import LineApplicationCreate, LineApplicationResponse

router = APIRouter(prefix='/line-applications', tags=['line'])


@router.post('/', response_model=LineApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
  payload: LineApplicationCreate,
  supabase: SupabaseClientDep,
  user: AuthenticatedUser = Depends(get_current_user),
):
  insert_payload = {
    'user_id': user.id,
    'message': payload.message,
    'status': 'pending',
  }

  response = supabase.table('line_applications').insert(insert_payload).execute()
  if not response.data:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to create application")

  application_id = response.data[0]['id']
  detail_response = (
    supabase.table('line_applications')
    .select('id, user_id, message, status, created_at')
    .eq('id', application_id)
    .execute()
  )

  if not detail_response.data:
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to load created application")

  record = detail_response.data[0]
  return LineApplicationResponse(**record)

