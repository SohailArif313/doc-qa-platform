from pydantic import BaseModel, Field

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)

class SourceSchema(BaseModel):
    file: str
    page: int

class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceSchema]
    model: str

class UploadResponse(BaseModel):
    message: str
    chunks_created: int