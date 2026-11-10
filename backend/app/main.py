# 1. Standard Library
import json
import shutil

import time
from pathlib import Path
from sqlalchemy import func
import os
from supabase import create_client, Client
# 2. Third-party Libraries
import jwt
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import uuid
# 3. Database
from app.core.database import engine, Base, get_db, SessionLocal
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
# 4. Models
from app.models import db_models
from app.models.schemas import ChatRequest, ChatResponse, UploadResponse, SourceSchema

# 5. Authentication & Configuration
from app.core.auth import require_auth
from app.core.config import settings

# 6. Services
from app.services.pdf_loader import load_and_split_pdf
from app.services.vector_store import create_vector_store
from app.services.rag import ask_question, stream_question


load_dotenv()

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Supabase environment variables are missing")

supabase: Client = create_client(supabase_url, supabase_key)

app = FastAPI(title=settings.app_name)
db_models.Base.metadata.create_all(bind=engine)


limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
@limiter.limit("2/minute")
def upload_document(
    request: Request,  
    file: UploadFile = File(...),
    auth_data = Depends(require_auth)
):

    """
    Accepts a PDF file, saves it locally, and builds the vector database.
    """
    
    start_time = time.time()
    token = auth_data.credentials
    payload = jwt.decode(token, options={"verify_signature": False})
    user_id = payload.get("sub", "unknown_user")
    
    if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file.file.seek(0, 2) # Go to end of file
    file_size = file.file.tell() # Get size in bytes
    file.file.seek(0) # Reset pointer

    MAX_SIZE = 10 * 1024 * 1024 # 10 MB
    if file_size > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File is too large. Maximum allowed size is 10MB.")
        
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )
    safe_filename = f"{uuid.uuid4()}.pdf"
    file_path = UPLOAD_DIR / safe_filename

    # Save the uploaded file to disk
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    print(f"⏱️ [1] File saved locally: {time.time() - start_time:.2f}s")
    # Process PDF and build Vector DB
    file_bytes = file_path.read_bytes()
    
    # (user_id/safe_filename)
    supabase_path = f"{user_id}/{safe_filename}" 
    
    try:
        supabase.storage.from_("documents").upload(
            path=supabase_path, 
            file=file_bytes,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
        # 2. Get the public link
        file_url = supabase.storage.from_("documents").get_public_url(supabase_path)
    except Exception as e:
        print("Supabase upload error:", e)
        file_url = ""
        
    print(f"⏱️ [2] Supabase upload done: {time.time() - start_time:.2f}s")
        
    try:
        chunks = load_and_split_pdf(file_path, original_filename=file.filename)
        for chunk in chunks:
            chunk.metadata["file_url"] = file_url
        print(f"⏱️ [3] PDF Parsing & Splitting done: {time.time() - start_time:.2f}s ({len(chunks)} chunks)") 
        create_vector_store(chunks,user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")
    
    print(f"⏱️ [4] Qdrant Embedding & Upsert done: {time.time() - start_time:.2f}s")
    print("=" * 50)

    return UploadResponse(
        message=f"Successfully processed {file.filename}",
        chunks_created=len(chunks)
    )

@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest,auth_data = Depends(require_auth)) -> ChatResponse:
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
@limiter.limit("3/minute")
async def chat_stream(
    request: Request,  # <-- YEH LINE ADD KAREIN
    req: ChatRequest,
    auth_data = Depends(require_auth),
    db: Session = Depends(get_db)
):
    # FIX: Decode token to get user ID
    token = auth_data.credentials
    payload = jwt.decode(token, options={"verify_signature": False})
    user_id = payload.get("sub", "unknown_user")
    
    # Save User Message
    user_msg = db_models.ChatMessage(user_id=user_id, role="user", session_id=req.session_id,content=req.message)
    db.add(user_msg)
    db.commit()

    # Stream and Save
    async def stream_and_save():
        full_answer = ""
        sources_data = []
        
        async for chunk in stream_question(req.message,user_id):
            data = json.loads(chunk)
            if data["type"] == "text":
                full_answer += data["content"]
            elif data["type"] == "sources":
                sources_data = data["content"]
            yield chunk
        
        # Create a new session for the background task
        background_db = SessionLocal()
        try:
            ai_msg = db_models.ChatMessage(
                user_id=user_id, 
                session_id=req.session_id,
                role="assistant", 
                content=full_answer,
                sources=json.dumps(sources_data)
            )
            background_db.add(ai_msg)
            background_db.commit()
        finally:
            background_db.close()

    return StreamingResponse(stream_and_save(), media_type="text/event-stream")


@app.get("/api/chat/history")
def get_chat_history(
    session_id: str,
    auth_data = Depends(require_auth),
    db: Session = Depends(get_db)
):
    # FIX: Decode token to get user ID
    token = auth_data.credentials
    payload = jwt.decode(token, options={"verify_signature": False})
    user_id = payload.get("sub", "unknown_user")
    
    messages = db.query(db_models.ChatMessage)\
                 .filter(db_models.ChatMessage.user_id == user_id,db_models.ChatMessage.session_id == session_id)\
                 .order_by(db_models.ChatMessage.created_at.asc())\
                 .all()
    
    formatted_messages = []
    for msg in messages:
        parsed_sources = []
        if msg.sources:
            try:
                parsed_sources = json.loads(msg.sources)
            except Exception:
                parsed_sources = []

        formatted_messages.append({
            "role": msg.role,
            "content": msg.content,
            "sources": parsed_sources
        })
        
    return formatted_messages



@app.get("/api/chat/sessions")
def get_chat_sessions(
    auth_data = Depends(require_auth),
    db: Session = Depends(get_db)
):
    token = auth_data.credentials
    payload = jwt.decode(token, options={"verify_signature": False})
    user_id = payload.get("sub", "unknown_user")

    # Subquery to get the first message (title) of each session
    subquery = db.query(
        db_models.ChatMessage.session_id,
        func.min(db_models.ChatMessage.id).label("min_id")
    ).filter(
        db_models.ChatMessage.user_id == user_id,
        db_models.ChatMessage.role == "user"
    ).group_by(db_models.ChatMessage.session_id).subquery()

    # Fetch the actual messages
    sessions = db.query(db_models.ChatMessage).join(
        subquery, db_models.ChatMessage.id == subquery.c.min_id
    ).all()

    return [{"session_id": s.session_id, "title": s.content[:30] + "..."} for s in sessions]