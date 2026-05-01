"""
API Router v1 - Main router for all v1 endpoints.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import predict

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(
    predict.router,
    prefix="/predict",
    tags=["Predictions"]
)
