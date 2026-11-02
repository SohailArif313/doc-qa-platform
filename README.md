# Doc QA Platform

A full-stack Retrieval-Augmented Generation (RAG) application that allows users to upload PDF documents and interact with them using natural language. The platform provides precise answers backed by exact page citations from the source document.

| Resource | Link |
|---|---|
| 🌐 **Live Demo** | [Open Application](https://doc-qa-platform.vercel.app/) |
| ⚙️ **Backend API** | [View API](https://doc-qa-platform.onrender.com/) |
| 📚 **API Documentation** | [Swagger UI](https://doc-qa-platform.onrender.com/docs) |

## Features

- **PDF Ingestion:** Upload PDF files to extract and process text.
- **Semantic Search:** Utilizes vector embeddings to find the most relevant context for user queries.
- **Grounded Generation:** Generates answers strictly based on the provided document context to minimize hallucinations.
- **Source Citations:** Every answer includes the exact file name and page number it was derived from.
- **Observability:** Integrated with LangSmith to monitor token usage, latency, and trace the execution pipeline.

## Tech Stack

- **Backend:** FastAPI, Python 3.13, uv (package manager)
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **AI & Orchestration:** LangChain
- **LLM:** Groq (for high-speed generation)
- **Embeddings:** Google Gemini
- **Vector Database:** ChromaDB
- **Deployment:** Render (Backend), Vercel (Frontend)

## Architecture Flow

1. The user uploads a PDF via the Next.js frontend.
2. The FastAPI backend uses `PyPDFLoader` to extract text and `RecursiveCharacterTextSplitter` to chunk the document.
3. Chunks are converted into vector embeddings using Gemini and stored locally in ChromaDB.
4. When a question is asked, the system embeds the query, retrieves the top 3 most relevant chunks from ChromaDB, and sends them to the LLM (Groq).
5. The generated answer and the source metadata are returned to the frontend.

```
Next.js (Vercel)
      │  upload PDF / ask question
      ▼
FastAPI (Render)
      │
      ├── PyPDFLoader → RecursiveCharacterTextSplitter
      ├── Gemini embeddings → ChromaDB (vector store)
      └── Top-3 retrieval → Groq LLM → answer + citations
                                   │
                              LangSmith (tracing)
```

## Local Setup & Installation

### Prerequisites

- Python 3.13+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) installed
- API Keys for Groq, Google Gemini, and LangSmith.

### 1. Backend Setup

```bash
cd backend
uv sync

# Create a .env file and add the following variables
cp .env.example .env
```

Fill in `backend/.env`:

```env
GROQ_API_KEY=your_groq_key
GOOGLE_API_KEY=your_gemini_key

# LangSmith tracing (optional but recommended)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=doc-qa-platform
```

Start the API server:

```bash
uv run uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000` and the interactive docs are at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend
npm install

# Point the frontend to your backend
cp .env.example .env.local
```

Set the backend URL in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Usage

1. Open the app and upload a PDF.
2. Wait for the ingestion to finish (text extraction, chunking, embedding).
3. Ask a question about the document in natural language.
4. Read the answer and check the file name and page number shown with it.

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Backend | LLM generation via Groq |
| `GOOGLE_API_KEY` | Backend | Embeddings via Google Gemini |
| `LANGCHAIN_TRACING_V2` | Backend | Enables LangSmith tracing |
| `LANGCHAIN_API_KEY` | Backend | LangSmith authentication |
| `LANGCHAIN_PROJECT` | Backend | Project name shown in LangSmith |
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL of the FastAPI backend |

Never commit `.env` files. Only `.env.example` (with empty values) belongs in the repository.

## Deployment

### Backend (Render)

1. Create a new **Web Service** from the GitHub repository and set the root directory to `backend`.
2. Set the build command to `uv sync` and the start command to `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Add the backend environment variables from the table above in the Render dashboard.
4. Deploy and copy the service URL.

### Frontend (Vercel)

1. Import the repository in Vercel and set the root directory to `frontend`.
2. Add `NEXT_PUBLIC_API_URL` with the Render service URL.
3. Deploy.

## Limitations

- **Ephemeral vector storage on Render:** ChromaDB is stored locally on the backend's filesystem. On hosting plans without a persistent disk, uploaded documents and their embeddings can be lost when the service restarts or redeploys. Users may need to re-upload their PDFs.
- **Free-tier API limits:** Groq and Gemini free tiers have rate limits, so many requests in a short time can fail or slow down.
- **Text-based PDFs only:** Scanned PDFs without a text layer are not supported because there is no OCR step.
- **Fixed retrieval size:** Only the top 3 chunks are used per question, so answers that need information from many places in a document may be incomplete.

## Future Improvements

- Persistent vector storage (a persistent disk or a hosted vector database).
- OCR support for scanned PDFs.
- Multi-document chat with per-user document libraries.
- Conversation memory for follow-up questions.
- Streaming responses in the UI.
- Automated evaluation of retrieval and answer quality.
- Authentication and per-user data isolation.

## License

This project is open-source and available under the [MIT License](LICENSE).