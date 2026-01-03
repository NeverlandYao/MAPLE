# Use official Python runtime as a parent image
FROM python:3.9-slim

# Set work directory
WORKDIR /app

# Install system dependencies if needed
# RUN apt-get update && apt-get install -y gcc

# Copy requirements file
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose port 8000
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
