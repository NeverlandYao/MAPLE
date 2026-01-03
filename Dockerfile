# Unified Dockerfile (FastAPI Serving Static Files)

# Base image: Python 3.9 Slim
FROM python:3.9-slim

# Set work directory
WORKDIR /app

# Copy Backend Requirements
COPY backend/requirements.txt .

# Install Python dependencies using Tencent Cloud PyPI mirror
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.cloud.tencent.com/pypi/simple/

# Copy Backend Code
COPY backend/ .

# Create Static Directory Structure
RUN mkdir -p static/chatbot static/dashboard

# Copy Frontend Code to Static Directory
COPY frontend/chatbot static/chatbot
COPY frontend/dashboard static/dashboard

# Expose Port 8000
EXPOSE 8000

# Environment Variables
ENV MS_API_KEY=""
ENV MS_BASE_URL="https://api-inference.modelscope.cn/v1"
ENV MS_MODEL="deepseek-ai/DeepSeek-R1-distill-Qwen-7B"

# Start FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
