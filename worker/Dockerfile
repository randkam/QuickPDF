FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

# Run the RQ worker as PID 1 (processes queued PDF jobs).
CMD ["sh", "-lc", "rq worker -u ${REDIS_URL:-redis://redis:6379/0} ${RQ_QUEUE_NAME:-pdf}"]


