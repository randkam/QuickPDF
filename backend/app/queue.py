from __future__ import annotations

from redis import Redis
from rq import Queue
from flask import current_app


def get_redis() -> Redis:
    return Redis.from_url(current_app.config["REDIS_URL"])


def get_queue() -> Queue:
    return Queue(name=current_app.config["RQ_QUEUE_NAME"], connection=get_redis())


