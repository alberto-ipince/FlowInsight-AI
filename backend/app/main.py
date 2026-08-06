from fastapi import FastAPI

from app.api.v1.health import router as health_router
from app.config.settings import APP_NAME, APP_VERSION, DEBUG

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    debug=DEBUG,
)

app.include_router(health_router)
