# Doc QA Platform

A full-stack Retrieval-Augmented Generation (RAG) application that allows users to upload PDF documents and interact with them using natural language. The platform provides precise answers backed by exact page citations from the source document.

**Live Demo:** [Insert Vercel Link Here]
**Backend API:** [Insert Render Link Here]

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