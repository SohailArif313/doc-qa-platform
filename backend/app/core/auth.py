from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer
from app.core.config import settings

clerk_config = ClerkConfig(
    jwks_url=settings.clerk_jwks_url,
    # We don't strictly need secret key for simple JWT verification, but it's good to have
)

# This is the dependency we will use to protect our routes
require_auth = ClerkHTTPBearer(clerk_config)