# Dockerfile for Research Agent System

# Use Python 3.9 as base image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY research/ ./research
COPY pyproject.toml README.md ./

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir -r research/requirements.txt

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "research/run.py"]