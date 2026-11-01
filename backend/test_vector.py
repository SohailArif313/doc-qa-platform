from app.services.pdf_loader import load_and_split_pdf
from app.services.vector_store import create_vector_store, load_vector_store
from app.core.config import settings

def main():
    pdf_path = "sample.pdf"
    print("=" * 60)
    print(f"Embedding Model Configured: {settings.embedding_model}")
    print("Action: This step WILL hit the Embedding API (Gemini).")
    print("=" * 60)

    # 1. Load and split PDF
    print("\n[1] Loading and splitting PDF...")
    chunks = load_and_split_pdf(pdf_path)
    print(f"Created {len(chunks)} chunks.")

    # 2. Create Vector Store (API Call happens here)
    print("\n[2] Generating embeddings and saving to Chroma DB...")
    create_vector_store(chunks)
    print("Successfully saved to data/chroma_db")

    # 3. Load the vector store and search
    print("\n[3] Searching the vector store...")
    vector_store = load_vector_store()
    
    # Change this query based on your sample PDF content
    query = "What is the main topic of this document?" 
    print(f"Query: '{query}'")
    
    # Retrieve top 2 most relevant chunks
    results = vector_store.similarity_search(query, k=2)

    for i, doc in enumerate(results):
        print(f"\n--- Result {i+1} (Source: {doc.metadata.get('source')}, Page: {doc.metadata.get('page')}) ---")
        print(doc.page_content[:300] + "...")

if __name__ == "__main__":
    main()