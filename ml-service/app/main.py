"""
GeoShield AI - ML Prediction Service
FastAPI application for landslide prediction using ensemble machine learning models.

Author: GeoShield AI Team
Version: 3.2.0
Date: November 2025
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
from loguru import logger
import sys

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1.router import api_router
from app.ml.registry.model_store import ModelRegistry

# Setup logging
setup_logging()

# Global model registry
model_registry = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown events."""
    # Startup
    logger.info("Starting GeoShield AI ML Service...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Version: {settings.VERSION}")
    
    # Initialize model registry
    global model_registry
    model_registry = ModelRegistry()
    
    # Load models
    try:
        await model_registry.load_models()
        logger.info("All models loaded successfully")
    except Exception as e:
        logger.error(f"Error loading models: {e}")
        logger.warning("Service starting without pre-loaded models")
    
    # Store in app state
    app.state.model_registry = model_registry
    
    logger.info("ML Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Service...")
    if model_registry:
        await model_registry.cleanup()
    logger.info("ML Service shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="GeoShield AI - ML Prediction Service",
    description="Enterprise-grade machine learning service for landslide prediction with ensemble models",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for Kubernetes liveness probe."""
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check endpoint for Kubernetes readiness probe."""
    try:
        if model_registry and model_registry.is_ready():
            return {
                "status": "ready",
                "models_loaded": model_registry.get_loaded_models(),
                "service": "ml-service"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Models not loaded"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}"
        )


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with service information."""
    return {
        "service": "GeoShield AI ML Prediction Service",
        "version": settings.VERSION,
        "status": "operational",
        "documentation": "/docs",
        "health": "/health",
        "api": "/api/v1"
    }


# Include API router
app.include_router(api_router, prefix="/api/v1")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An unexpected error occurred",
            "path": str(request.url.path)
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
        log_level="info",
        access_log=True
    )
