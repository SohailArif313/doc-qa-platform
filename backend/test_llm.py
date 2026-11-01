from app.core.llm import get_chat_model

print("Testing LLM direct call...")
llm = get_chat_model()
try:
    response = llm.invoke("Hello, who are you?")
    print("✅ SUCCESS:", response.content)
except Exception as e:
    print("❌ FAILED WITH ERROR:", str(e))