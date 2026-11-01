from app.services.rag import ask_question
from app.core.config import settings

def main():
    print("=" * 60)
    print(f"RAG Generation Model: {settings.primary_model}")
    print("Action: This step WILL hit the Generation API (LLM).")
    print("=" * 60)

    # Change this question based on your sample PDF content
    question = "What is the main topic of this document?"
    print(f"\nQuestion: {question}\n")
    
    print("Generating answer...\n")
    result = ask_question(question)

    print("--- Answer ---")
    print(result["answer"])
    
    print("\n--- Sources (Citations) ---")
    for source in result["sources"]:
        print(f"- File: {source['file']}, Page: {source['page']}")

if __name__ == "__main__":
    main()