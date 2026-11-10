import json
from typing import AsyncGenerator
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.services.vector_store import load_vector_store,collection_exists 

from app.core.llm import get_chat_model


PROMPT_TEMPLATE = """You are an expert AI assistant. 
Use ONLY the provided document context to answer the user's question. 

Instructions:
1. Base your answer strictly on the facts found in the context.
2. CRITICAL: If the context does NOT explicitly contain the answer, you must say "I cannot find the answer in the provided document." DO NOT guess or use outside knowledge.
3. Do not attribute facts to the wrong person.
4. Be concise and accurate.

Context:
{context}

Question: {question}

Answer:"""


def ask_question(question: str, top_k: int = 3) -> dict:
    """
    Retrieves relevant document chunks and generates an answer using the LLM.
    """
    vector_store = load_vector_store()
    retriever = vector_store.as_retriever(search_kwargs={"k": top_k})

    docs = retriever.invoke(question)
    context_text = "\n\n---\n\n".join([doc.page_content for doc in docs])

    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    llm = get_chat_model()
    
    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({
        "context": context_text,
        "question": question
    })

    sources = []
    for doc in docs:
        source_info = {
            "file": doc.metadata.get("source", "Unknown"),
            "page": doc.metadata.get("page", 0)
        }
        if source_info not in sources:
            sources.append(source_info)

    return {
        "answer": answer,
        "sources": sources
    } 
    
    
# NEW FUNCTION FOR STREAMING
async def stream_question(question: str, user_id: str, top_k: int = 3) -> AsyncGenerator[str, None]:
    if not collection_exists(user_id):
        error_message = "You haven't uploaded any document yet. Please upload a PDF first to ask questions about it."
        yield json.dumps({"type": "text", "content": error_message}) + "\n"
        yield json.dumps({"type": "sources", "content": []}) + "\n"
        return
    
    vector_store = load_vector_store(user_id)
    
    # YAHAN FIX KIYA HAI: Simple k=3 wapas laga diya hai
    retriever = vector_store.as_retriever(search_kwargs={"k": top_k})
    docs = retriever.invoke(question)
    
    if not docs:
        no_result_msg = "I cannot find the answer in the provided document."
        yield json.dumps({"type": "text", "content": no_result_msg}) + "\n"
        yield json.dumps({"type": "sources", "content": []}) + "\n"
        return
        
    context_text = "\n\n---\n\n".join([doc.page_content for doc in docs])

    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    llm = get_chat_model()
    chain = prompt | llm | StrOutputParser()

    full_answer = ""
    async for chunk in chain.astream({"context": context_text, "question": question}):
        full_answer += chunk
        yield json.dumps({"type": "text", "content": chunk}) + "\n"

    sources = []
    seen = set()
    if "cannot find the answer" in full_answer.lower() or "i cannot find" in full_answer.lower():
        sources = []
    else:
        for doc in docs:
            file_name = doc.metadata.get("source", "Unknown")
            page_num = doc.metadata.get("page", 0)
            file_url = doc.metadata.get("file_url", "")
            
            key = f"{file_name}_{page_num}"
            if key not in seen:
                seen.add(key)
                sources.append({
                    "file": file_name,
                    "page": page_num,
                    "file_url": file_url,
                    "snippet": doc.page_content.strip()[:300] + "..."
                })

    yield json.dumps({"type": "sources", "content": sources}) + "\n"