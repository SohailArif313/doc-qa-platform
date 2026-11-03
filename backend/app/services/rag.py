import json
from typing import AsyncGenerator
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.core.llm import get_chat_model
from app.services.vector_store import load_vector_store

PROMPT_TEMPLATE = """You are an expert AI assistant and a smart technical recruiter. 
Use the provided document context to answer the user's question. 

Instructions:
1. Base your answer strictly on the facts found in the context.
2. If the user asks for an opinion, evaluation, or decision (e.g., "Can I hire him?"), analyze the skills, experience, and projects mentioned in the context and provide a logical conclusion.
3. CRITICAL: If the user asks about a specific person or entity that is NOT mentioned in the context, you must explicitly state: "I cannot find information about [Person/Entity Name] in the provided document." DO NOT attribute facts, projects, or skills from the context to the wrong person.
4. If the context is completely irrelevant to the question, say "I cannot find the answer in the provided document."
5. Be concise, professional, and accurate.
6. HARD LIMIT: Never exceed 150 words in your response. If the user asks for an essay or a specific word count (like "tell me in 500 words"), you must ignore their word count request and provide a concise summary strictly under 150 words based on the document.

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
async def stream_question(question: str, top_k: int = 3) -> AsyncGenerator[str, None]:
    vector_store = load_vector_store()
    retriever = vector_store.as_retriever(search_kwargs={"k": top_k})
    docs = retriever.invoke(question)
    context_text = "\n\n---\n\n".join([doc.page_content for doc in docs])

    sources = []
    for doc in docs:
        source_info = {"file": doc.metadata.get("source", "Unknown"), "page": doc.metadata.get("page", 0)}
        if source_info not in sources: 
            sources.append(source_info)


    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    llm = get_chat_model()
    chain = prompt | llm | StrOutputParser()

    # Stream the response token by token
    async for chunk in chain.astream({"context": context_text, "question": question}):
        yield json.dumps({"type": "text", "content": chunk}) + "\n"
    
    # At the end, send the sources
    yield json.dumps({"type": "sources", "content": sources}) + "\n"