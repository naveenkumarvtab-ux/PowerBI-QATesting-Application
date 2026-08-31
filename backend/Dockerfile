FROM python:3.11-slim-bookworm

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Install build dependencies and system tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and chromium browser system dependencies
RUN playwright install --with-deps chromium

# Copy application files
COPY . .

# Setup directories for persistent data storage
RUN mkdir -p storage/uploads storage/reports/screenshots

# Expose port (default 5000, overridden by Render's PORT env)
EXPOSE 5000

# Run with Gunicorn, using the port environment variable injected by Render
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 app:app"]
