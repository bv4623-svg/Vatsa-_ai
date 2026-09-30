# Multi-stage build: the builder stage has gcc/build headers for any
# dependency that needs to compile from source; the runtime stage copies
# only the resulting venv, so none of that toolchain ships in the final
# image.

FROM python:3.14-slim AS builder

# build-essential/libpq-dev/libjpeg-dev/zlib1g-dev/libfreetype6-dev: only
# actually needed if pip has to build a dependency from source instead of
# using a prebuilt wheel (psycopg2-binary and Pillow both normally ship
# wheels, but Python 3.14 is new enough -- Oct 2025 -- that wheel
# coverage for it isn't guaranteed for every package/platform yet).
# libfreetype6-dev specifically backs Pillow's ImageFont.truetype(), which
# app/services/image_service.py's branding step depends on.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg-dev \
        zlib1g-dev \
        libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


FROM python:3.14-slim AS runtime

RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /usr/sbin/nologin --create-home appuser

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY app/ /app/app/
COPY alembic/ /app/alembic/
COPY alembic.ini /app/alembic.ini
COPY intents_data.py /app/intents_data.py
COPY start.sh /app/start.sh

RUN chmod +x /app/start.sh \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:' + __import__('os').getenv('PORT','8000') + '/health')"

ENTRYPOINT ["sh", "/app/start.sh"]
