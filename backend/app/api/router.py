from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.llm import router as llm_router
from app.api.projects import router as projects_router
from app.api.runs import router as runs_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(llm_router, prefix="/llm", tags=["llm"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(runs_router, prefix="/projects/{project_id}/runs", tags=["runs"])
