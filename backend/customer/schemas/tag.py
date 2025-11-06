from pydantic import BaseModel

class Tag(BaseModel):
    id: int
    name: str
    count: int

class TagCreate(BaseModel):
    name: str