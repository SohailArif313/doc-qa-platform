import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from app.services.rag import stream_question
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.models.schemas import ChatRequest, ChatResponse, UploadResponse, SourceSchema
from app.services.pdf_loader import load_and_split_pdf
from app.services.vector_store import create_vector_store
from app.services.rag import ask_question
from dotenv import load_dotenv
load_dotenv()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
 
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}

@app.post("/api/upload", response_model=UploadResponse)
def upload_document(file: UploadFile = File(...)):
    """
    Accepts a PDF file, saves it locally, and builds the vector database.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_path = UPLOAD_DIR / file.filename

    # Save the uploaded file to disk
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Process PDF and build Vector DB
    try:
        chunks = load_and_split_pdf(file_path)
        create_vector_store(chunks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

    return UploadResponse(
        message=f"Successfully processed {file.filename}",
        chunks_created=len(chunks)
    )

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """
    Takes a user question, retrieves context from the vector store, and generates an answer.
    """
    try:
        result = ask_question(req.message)
        
        return ChatResponse(
            answer=result["answer"],
            sources=[SourceSchema(**src) for src in result["sources"]],
            model=settings.primary_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest): # Add async here
    return StreamingResponse(stream_question(req.message), media_type="text/event-stream")