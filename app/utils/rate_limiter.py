from slowapi import Limiter
from slowapi.util import get_remote_address

# This uses the client's IP address.
# In a production environment with a load balancer, make sure uvicorn runs with --proxy-headers
limiter = Limiter(key_func=get_remote_address)
