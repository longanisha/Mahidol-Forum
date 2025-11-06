from fastapi import APIRouter
from typing import List
from ..schemas.tag import Tag, TagCreate
from main import supabase
from responses import success_response, error_response

router = APIRouter(
    prefix="/api/v1",
    responses={404: {"description": "Not found"}},
)

@router.get("/tags", response_model=List[Tag], tags=["Tags"])
async def get_tags():
    try:
        # Try to get from Supabase
        result = supabase.table("tags").select("*").execute()
        
        if result.data:
            tags = [Tag(
                id=tag["id"],
                name=tag["name"],
                count=tag.get("count", 0)
            ) for tag in result.data]
            return success_response("Tags fetched", status_code=200, data=tags)
    except Exception as e:
        return error_response(str(e), status_code=422)
    

# POST Tag for admin 
@router.post("/admin/tags", response_model=Tag, tags=["Admin Tags"])
async def create_tag(tag: TagCreate):
    try:
        # Try to create in Supabase
        tag_data = {
            "name": tag.name,
            "count": 0
        }
        
        result = supabase.table("tags").insert(tag_data).execute()
        
        if result.data:
            created_tag = result.data[0]
            created = Tag(
                id=created_tag["id"],
                name=created_tag["name"],
                count=created_tag.get("count", 0)
            )
            return success_response("Tag created", status_code=201, data=created)
    except Exception as e:
        return error_response(str(e), status_code=422)


# GET Tag detail for admin
@router.get("/admin/tags/{tag_id}", response_model=Tag, tags=["Admin Tags"])
async def get_tag(tag_id: int):
    try:
        # Try to get from Supabase
        result = supabase.table("tags").select("*").eq("id", tag_id).execute()
        
        if result.data:
            tag_data = result.data[0]
            tag = Tag(
                id=tag_data["id"],
                name=tag_data["name"],
                count=tag_data.get("count", 0)
            )
            return success_response("Tag fetched", status_code=200, data=tag)
        else:
            return error_response("Tag not found", status_code=404)
    except Exception as e:
        return error_response(str(e), status_code=422)
    
@router.delete("/admin/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: int, tags=["Admin Tags"]):
    try:
        # Try to delete from Supabase
        result = supabase.table("tags").delete().eq("id", tag_id).execute()
        
        # Supabase client returns .error and .data
        if getattr(result, "error", None):
            return error_response(str(result.error), status_code=400)

        if getattr(result, "data", None) and len(result.data) > 0:
            return success_response("Tag deleted", status_code=200)

        return error_response("Tag not found", status_code=404)
    except Exception as e:
        return error_response(str(e), status_code=422)
