"""
Logging configuration for ML Service.
"""

from loguru import logger
import sys
from app.core.config import settings


def setup_logging():
    """Configure loguru logger with custom format and handlers."""
    
    # Remove default handler
    logger.remove()
    
    # Add console handler
    logger.add(
        sys.stdout,
        format=settings.LOG_FORMAT,
        level=settings.LOG_LEVEL,
        colorize=True
    )
    
    # Add file handler for errors
    logger.add(
        "logs/ml_service_error.log",
        format=settings.LOG_FORMAT,
        level="ERROR",
        rotation="500 MB",
        retention="30 days",
        compression="zip"
    )
    
    # Add file handler for all logs
    logger.add(
        "logs/ml_service.log",
        format=settings.LOG_FORMAT,
        level="INFO",
        rotation="1 GB",
        retention="7 days",
        compression="zip"
    )
    
    logger.info("Logging configured successfully")
