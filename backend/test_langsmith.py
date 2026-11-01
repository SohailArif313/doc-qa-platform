import os
from dotenv import load_dotenv

# Load .env file explicitly
load_dotenv()

print("LANGSMITH_TRACING:", os.getenv("LANGSMITH_TRACING"))
print("LANGSMITH_API_KEY is set:", bool(os.getenv("LANGSMITH_API_KEY")))
print("LANGSMITH_PROJECT:", os.getenv("LANGSMITH_PROJECT"))
print("LANGSMITH_ENDPOINT:", os.getenv("LANGSMITH_ENDPOINT"))