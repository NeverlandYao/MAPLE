#!/bin/sh

# Start FastAPI app in the background
# We bind to 127.0.0.1 because Nginx is in the same container and will proxy to it via localhost
echo "Starting MAPLE Backend..."
uvicorn main:app --host 127.0.0.1 --port 8000 &

# Wait for the backend to be ready
# We'll try to connect to port 8000
echo "Waiting for backend to start..."
timeout=30
while ! nc -z 127.0.0.1 8000; do
  sleep 1
  timeout=$((timeout - 1))
  if [ $timeout -le 0 ]; then
    echo "Error: Backend failed to start within 30 seconds."
    exit 1
  fi
done
echo "Backend started!"

# Start Nginx in foreground
echo "Starting Nginx..."
nginx -g "daemon off;"
