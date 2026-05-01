#!/usr/bin/env python3
"""
GeoShield AI - ML Service Startup Script
Initializes the FastAPI ML service with proper configuration
"""

import os
import sys
import subprocess
import time
import signal
import requests
from pathlib import Path

# Configuration
ML_SERVICE_DIR = Path(__file__).parent
ML_SERVICE_PORT = int(os.getenv('PORT', 8001))
ML_SERVICE_HOST = os.getenv('HOST', '0.0.0.0')
HEALTH_CHECK_URL = f"http://localhost:{ML_SERVICE_PORT}/health"
MAX_RETRIES = 30
RETRY_INTERVAL = 2

def check_health():
    """Check if ML service is running and healthy"""
    try:
        response = requests.get(HEALTH_CHECK_URL, timeout=5)
        return response.status_code == 200
    except:
        return False

def start_ml_service():
    """Start the ML service using uvicorn"""
    print("=" * 70)
    print("GeoShield AI - ML Service Startup")
    print("=" * 70)
    
    # Check if .env file exists, if not use .env.example
    env_file = ML_SERVICE_DIR / '.env'
    if not env_file.exists():
        print(f"⚠️  .env file not found, using .env.example")
        env_example = ML_SERVICE_DIR / '.env.example'
        if env_example.exists():
            print(f"📋 Copy .env.example to .env and update values for your environment")
            return False
    
    print(f"📍 Starting ML Service on {ML_SERVICE_HOST}:{ML_SERVICE_PORT}")
    print(f"📁 Service Directory: {ML_SERVICE_DIR}")
    
    try:
        # Start the service
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host", ML_SERVICE_HOST,
                "--port", str(ML_SERVICE_PORT),
                "--reload" if os.getenv('ENVIRONMENT', 'development') == 'development' else "",
                "--workers", os.getenv('WORKERS', '4'),
            ],
            cwd=str(ML_SERVICE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        print(f"⏳ Waiting for service to start...")
        
        # Wait for service to be healthy
        for attempt in range(MAX_RETRIES):
            time.sleep(RETRY_INTERVAL)
            if check_health():
                print(f"✅ ML Service is healthy!")
                print(f"📊 API Docs: http://localhost:{ML_SERVICE_PORT}/docs")
                print(f"📘 ReDoc: http://localhost:{ML_SERVICE_PORT}/redoc")
                print(f"❤️  Health Check: {HEALTH_CHECK_URL}")
                print("=" * 70)
                
                # Keep the service running
                process.wait()
                return True
        
        print(f"❌ ML Service failed to start after {MAX_RETRIES * RETRY_INTERVAL} seconds")
        process.terminate()
        return False
        
    except Exception as e:
        print(f"❌ Error starting ML Service: {e}")
        return False

def handle_signal(signum, frame):
    """Handle termination signals"""
    print("\n\n🛑 Shutting down ML Service...")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    # Change to service directory
    os.chdir(str(ML_SERVICE_DIR))
    
    # Start the service
    success = start_ml_service()
    sys.exit(0 if success else 1)
