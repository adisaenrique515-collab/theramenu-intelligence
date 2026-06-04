FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and database (database copied for static offline seed)
COPY api /app/api
COPY database /app/database

# Expose port
EXPOSE 8000

# Run with Gunicorn and Uvicorn workers
CMD ["gunicorn", "api.app:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
