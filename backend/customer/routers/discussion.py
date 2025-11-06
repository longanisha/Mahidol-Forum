from fastapi import APIRouter
from ..schemas.discussion import Discussion, DiscussionCreate
from main import supabase, User
from typing import List
from datetime import datetime
from responses import success_response, error_response

router = APIRouter(
    prefix="/api/v1/discussions",
    tags=["Discussions"],
    responses={404: {"description": "Not found"}},
)


# Discussion routes
@router.get("/", response_model=List[Discussion])
async def get_discussions():
    # try:
        # Try to get from Supabase
        result = supabase.table("discussions").select("""
            *,
            author:users!author_id(id, username, email, created_at),
            tags:discussion_tags!inner (
                tags (
                    id,
                    name,
                    count
                )
            )
        """).execute()
        
        if result.data:
            discussions = []
            for discussion in result.data:
                # author = discussion.get("author")
                author_data = supabase.table("users").select("*").eq("id", discussion["author_id"]).execute()
                if not author_data.data:
                    author = None
                else:
                    author = User(
                        id=author_data.data[0]["id"],
                        username=author_data.data[0]["username"],
                        email=author_data.data[0]["email"],
                        created_at=author_data.data[0]["created_at"]
                    )
                discussions.append(Discussion(
                    id=discussion["id"],
                    title=discussion["title"],
                    content=discussion["content"],
                    author=author,
                    tags=discussion.get("tags", ["science"]),
                    views=discussion.get("views", 0),
                    comments=discussion.get("comments", 0),
                    upvotes=discussion.get("upvotes", 0),
                    created_at=discussion["created_at"]
                ))
            return success_response("Discussions fetched", status_code=200, data={"discussions": discussions, "meta": {"total": len(discussions)}})
    # except Exception as e:
    #     return error_response(str(e), status_code=422)
    
@router.post("/", response_model=Discussion)
async def create_discussion(discussion: DiscussionCreate):
    try:
        # Create the discussion without tags first
        discussion_data = {
            "title": discussion.title,
            "content": discussion.content,
            "author_id": 2,  # Mock author ID
        }
        
        result = supabase.table("discussions").insert(discussion_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create discussion")
            
        created_discussion = result.data[0]
        discussion_id = created_discussion["id"]
        
        # Process tags - for each tag, ensure it exists and create the pivot entry
        for tag_name in discussion.tags:
            # Try to find existing tag
            tag_result = supabase.table("tags").select("id").eq("name", tag_name).execute()
            
            if tag_result.data and len(tag_result.data) > 0:
                tag_id = tag_result.data[0]["id"]
            else:
                # Create new tag if it doesn't exist
                new_tag_result = supabase.table("tags").insert({"name": tag_name}).execute()
                if not new_tag_result.data:
                    continue  # Skip if tag creation fails
                tag_id = new_tag_result.data[0]["id"]
            
            # Create pivot table entry
            supabase.table("discussion_tags").insert({
                "discussion_id": discussion_id,
                "tag_id": tag_id
            }).execute()

        # Fetch the complete discussion with author and tags
        complete_result = supabase.table("discussions").select("""
            *,
            author:users!inner (
                id,
                username,
                email,
                created_at
            ),
            tags:discussion_tags!inner (
                tags (
                    id,
                    name,
                    count
                )
            )
        """).eq("id", discussion_id).execute()
        
        if complete_result.data:
            discussion_with_tags = complete_result.data[0]
            created = Discussion(
                id=discussion_with_tags["id"],
                title=discussion_with_tags["title"],
                content=discussion_with_tags["content"],
                author=User(
                    id=discussion_with_tags["author"]["id"],
                    username=discussion_with_tags["author"]["username"],
                    email=discussion_with_tags["author"]["email"],
                    created_at=discussion_with_tags["author"]["created_at"]
                ),
                tags=[tag["name"] for tag in discussion_with_tags.get("tags", [])],
                views=discussion_with_tags.get("views", 0),
                comments=discussion_with_tags.get("comments", 0),
                upvotes=discussion_with_tags.get("upvotes", 0),
                created_at=discussion_with_tags["created_at"]
            )
            return success_response("Discussion created", status_code=201, data=created)
    except Exception as e:
        return error_response(str(e), status_code=422)