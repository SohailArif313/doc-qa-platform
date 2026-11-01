from dotenv import load_dotenv
load_dotenv()

from langsmith import Client
from langsmith import utils as ls_utils
ls_utils.get_env_var.cache_clear()

client = Client()
try:
    projects = list(client.list_projects())
    print(f"✅ Connected to LangSmith! Found {len(projects)} projects.")
    for p in projects[:5]:
        print(f"   - {p.name}")
except Exception as e:
    print(f"❌ Connection failed: {e}")